'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getEntityGraph,
  relationsFor,
  getEntityById,
  type Entity,
  type EntityCountry,
  type Relation,
  type RelationType,
} from '@/lib/entities';
import { FACTIONS, FACTION_BY_ID } from '@/lib/entities/factions';

type Pt = { x: number; y: number };

// Andrew's monotone-chain convex hull — used to wrap each faction's
// member nodes in a blob. Returns input as-is for <3 points (the caller
// renders a circle / capsule fallback instead).
function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Dependency-free force-directed leadership graph. We deliberately avoid
// react-force-graph / d3 here: the app already pays a bundling tax for
// Cesium, and a ~40-node graph needs only a small custom simulation.
//
// Forces: pairwise repulsion (O(n²), trivial at this size), spring
// attraction along relations, and a weak pull to center. Alpha cools
// each tick and the rAF loop parks itself once settled; dragging or a
// filter change reheats it.

const COUNTRY_COLOR: Record<EntityCountry, string> = {
  cn: '#f59e0b', // amber — PRC
  kp: '#60a5fa', // blue — DPRK
};

const RELATION_COLOR: Record<RelationType, string> = {
  family: '#a78bfa',
  successor: '#f472b6',
  command: '#34d399',
  member: '#52525b',
  patron: '#fbbf24',
  faction: '#38bdf8',
  rival: '#f87171',
};

const RELATION_LABEL: Record<RelationType, string> = {
  family: 'Family',
  successor: 'Succession',
  command: 'Chain of command',
  member: 'Membership',
  patron: 'Patron–client (interpretive)',
  faction: 'Factional (interpretive)',
  rival: 'Rivalry / purge (interpretive)',
};

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'bg-emerald-900/50 text-emerald-300' },
  purged: { label: 'Purged / under investigation', tone: 'bg-red-900/50 text-red-300' },
  deceased: { label: 'Deceased', tone: 'bg-zinc-800 text-zinc-400' },
  retired: { label: 'Retired', tone: 'bg-zinc-800 text-zinc-400' },
  unknown: { label: 'Status unclear', tone: 'bg-amber-900/40 text-amber-300' },
};

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null; // fixed position while dragged
  fy: number | null;
}

type Filter = EntityCountry | 'all';

export default function EntityGraph() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Faction layer: cluster members together + draw hulls, and let a
  // legend click isolate one faction. Default on — it's the point of the view.
  const [showFactions, setShowFactions] = useState(true);
  const [activeFaction, setActiveFaction] = useState<string | null>(null);

  const graph = useMemo(() => getEntityGraph(filter), [filter]);

  const entById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const e of graph.entities) m.set(e.id, e);
    return m;
  }, [graph]);

  // Factions that actually have a member in the current (filtered) graph,
  // in canonical order — drives both the clustering anchors and the legend.
  const presentFactions = useMemo(
    () => FACTIONS.filter((f) => graph.entities.some((e) => e.factionTags?.includes(f.id))),
    [graph],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Physics working state lives in a ref (mutated every frame, only ever
  // touched in effects/handlers — never read during render). Each frame
  // publishes a lightweight {id: {x,y}} snapshot to state, which is what
  // render reads. This keeps refs out of the render path.
  const nodesRef = useRef<Map<string, SimNode>>(new Map());
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const alphaRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  // Holds the current tick fn so event handlers can restart a parked loop.
  const stepRef = useRef<(() => void) | null>(null);

  function kick(minAlpha = 0.4) {
    alphaRef.current = Math.max(alphaRef.current, minAlpha);
    if (rafRef.current == null && stepRef.current) {
      rafRef.current = requestAnimationFrame(stepRef.current);
    }
  }

  // View transform (pan + zoom). Mirrored into a ref (in an effect) so
  // pointer math can read the latest value without re-subscribing.
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 1 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Measure container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // (Re)seed node positions when the filtered node set changes. Existing
  // nodes keep their position so a filter toggle doesn't scramble layout.
  useEffect(() => {
    const map = nodesRef.current;
    const present = new Set(graph.entities.map((e) => e.id));
    for (const id of map.keys()) if (!present.has(id)) map.delete(id);
    const cx = size.w / 2;
    const cy = size.h / 2;
    const n = graph.entities.length;
    graph.entities.forEach((e, i) => {
      if (map.has(e.id)) return;
      // Seed on a circle (deterministic) so layout is stable across reloads.
      const angle = (i / Math.max(1, n)) * Math.PI * 2;
      const radius = Math.min(size.w, size.h) * 0.32;
      map.set(e.id, {
        id: e.id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      });
    });
    alphaRef.current = 1; // reheat
  }, [graph, size.w, size.h]);

  // Simulation loop.
  useEffect(() => {
    const REPULSION = 9000;
    const SPRING = 0.02;
    const SPRING_LEN = 110;
    const CENTER = 0.012;
    const CLUSTER = 0.03;
    const DAMP = 0.82;

    // Faction anchors arranged on a ring; members get pulled toward the
    // average of their factions' anchors so the groups visibly separate.
    const ringR = Math.min(size.w, size.h) * 0.3;
    const anchorOf = (factionId: string): Pt | null => {
      const idx = presentFactions.findIndex((f) => f.id === factionId);
      if (idx < 0) return null;
      const ang = (idx / Math.max(1, presentFactions.length)) * Math.PI * 2 - Math.PI / 2;
      return { x: size.w / 2 + Math.cos(ang) * ringR, y: size.h / 2 + Math.sin(ang) * ringR };
    };

    function step() {
      const map = nodesRef.current;
      const nodes = [...map.values()];
      const alpha = alphaRef.current;
      const cx = size.w / 2;
      const cy = size.h / 2;

      // Repulsion (all pairs).
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          const d = Math.sqrt(d2);
          const f = (REPULSION / d2) * alpha;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Springs along relations.
      for (const r of graph.relations) {
        const a = map.get(r.from);
        const b = map.get(r.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - SPRING_LEN) * SPRING * alpha;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Centering + integrate.
      for (const node of nodes) {
        if (node.fx != null) {
          node.x = node.fx;
          node.y = node.fy as number;
          node.vx = 0;
          node.vy = 0;
          continue;
        }
        node.vx += (cx - node.x) * CENTER * alpha;
        node.vy += (cy - node.y) * CENTER * alpha;

        // Faction clustering pull (toward mean of the node's anchors).
        if (showFactions) {
          const tags = entById.get(node.id)?.factionTags;
          if (tags && tags.length) {
            let ax = 0;
            let ay = 0;
            let cnt = 0;
            for (const t of tags) {
              const anchor = anchorOf(t);
              if (anchor) {
                ax += anchor.x;
                ay += anchor.y;
                cnt++;
              }
            }
            if (cnt) {
              node.vx += (ax / cnt - node.x) * CLUSTER * alpha;
              node.vy += (ay / cnt - node.y) * CLUSTER * alpha;
            }
          }
        }

        node.vx *= DAMP;
        node.vy *= DAMP;
        node.x += node.vx;
        node.y += node.vy;
      }

      alphaRef.current = Math.max(0, alpha - 0.012);

      // Publish a render snapshot (refs stay out of the render path).
      const snap: Record<string, { x: number; y: number }> = {};
      for (const node of nodes) snap[node.id] = { x: node.x, y: node.y };
      setPos(snap);

      if (alphaRef.current > 0.005) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    }

    stepRef.current = step;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [graph, size.w, size.h, showFactions, presentFactions, entById]);

  // — Pointer interaction: node drag + background pan + wheel zoom —
  const dragRef = useRef<{ id: string | null; panning: boolean; lastX: number; lastY: number }>({
    id: null,
    panning: false,
    lastX: 0,
    lastY: 0,
  });

  function toSim(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    const px = clientX - (rect?.left ?? 0);
    const py = clientY - (rect?.top ?? 0);
    return { x: (px - v.tx) / v.scale, y: (py - v.ty) / v.scale };
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current.id = id;
    setSelectedId(id);
    const p = toSim(e.clientX, e.clientY);
    const node = nodesRef.current.get(id);
    if (node) {
      node.fx = p.x;
      node.fy = p.y;
    }
    kick(0.5);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (drag.id) {
      const p = toSim(e.clientX, e.clientY);
      const node = nodesRef.current.get(drag.id);
      if (node) {
        node.fx = p.x;
        node.fy = p.y;
      }
      kick(0.3);
    } else if (drag.panning) {
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
  }

  function onPointerUp() {
    const drag = dragRef.current;
    if (drag.id) {
      const node = nodesRef.current.get(drag.id);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    drag.id = null;
    drag.panning = false;
  }

  function onBackgroundPointerDown(e: React.PointerEvent) {
    dragRef.current.panning = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setSelectedId(null);
  }

  function onWheel(e: React.WheelEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    const px = e.clientX - (rect?.left ?? 0);
    const py = e.clientY - (rect?.top ?? 0);
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const scale = Math.min(3, Math.max(0.3, v.scale * factor));
      // Zoom around the cursor.
      const tx = px - ((px - v.tx) * scale) / v.scale;
      const ty = py - ((py - v.ty) * scale) / v.scale;
      return { tx, ty, scale };
    });
  }

  const selected = selectedId ? getEntityById(selectedId) : undefined;
  const selectedRels = selectedId ? relationsFor(selectedId) : [];
  // Set of ids to keep bright; null = nothing dimmed. A node selection
  // highlights its neighborhood; a faction legend click highlights members.
  const focusSet = useMemo(() => {
    if (selectedId) {
      const s = new Set<string>([selectedId]);
      for (const r of relationsFor(selectedId)) {
        s.add(r.from);
        s.add(r.to);
      }
      return s;
    }
    if (activeFaction) {
      return new Set(
        graph.entities.filter((e) => e.factionTags?.includes(activeFaction)).map((e) => e.id),
      );
    }
    return null;
  }, [selectedId, activeFaction, graph]);

  return (
    <div className="relative h-full w-full bg-[#05070d]">
      {/* Controls */}
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        <div className="flex overflow-hidden rounded border border-zinc-800 bg-[#0a0e16] text-[11px]">
          {(['all', 'cn', 'kp'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setSelectedId(null);
              }}
              className={`px-2.5 py-1 transition ${
                filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/60'
              }`}
            >
              {f === 'all' ? 'All' : f === 'cn' ? '🇨🇳 PRC' : '🇰🇵 DPRK'}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setView({ tx: 0, ty: 0, scale: 1 });
            kick(1);
          }}
          className="rounded border border-zinc-800 bg-[#0a0e16] px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800/60"
        >
          Reset view
        </button>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-10 max-w-[180px] rounded border border-zinc-800 bg-[#0a0e16]/90 p-2 text-[10px] leading-relaxed text-zinc-500">
        <div className="mb-1 font-semibold uppercase tracking-widest text-zinc-400">
          Leadership graph
        </div>
        Solid = documented fact (family, post). Dashed = analyst interpretation
        (faction, patron). Hand-curated OSINT seed — not a live feed.
      </div>

      <div
        ref={containerRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <svg width="100%" height="100%">
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
            {/* Faction hulls (behind everything). Fat round stroke pads
                the convex hull into a soft blob; non-clickable. */}
            {showFactions &&
              presentFactions.map((f) => {
                const memberPts = graph.entities
                  .filter((e) => e.factionTags?.includes(f.id))
                  .map((e) => pos[e.id])
                  .filter(Boolean) as Pt[];
                if (memberPts.length === 0) return null;
                const dim = activeFaction != null && activeFaction !== f.id;
                const labelY = Math.min(...memberPts.map((p) => p.y)) - 16;
                const cx = memberPts.reduce((s, p) => s + p.x, 0) / memberPts.length;
                const hull = convexHull(memberPts);
                const label = (
                  <text
                    x={cx}
                    y={labelY}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={f.color}
                    opacity={0.85}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {f.label}
                  </text>
                );
                return (
                  <g key={f.id} opacity={dim ? 0.25 : 1} style={{ pointerEvents: 'none' }}>
                    {memberPts.length === 1 ? (
                      <circle cx={memberPts[0].x} cy={memberPts[0].y} r={34} fill={`${f.color}14`} stroke={`${f.color}55`} strokeWidth={1} />
                    ) : memberPts.length === 2 ? (
                      <line x1={memberPts[0].x} y1={memberPts[0].y} x2={memberPts[1].x} y2={memberPts[1].y} stroke={`${f.color}22`} strokeWidth={52} strokeLinecap="round" />
                    ) : (
                      <polygon
                        points={hull.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill={`${f.color}14`}
                        stroke={f.color}
                        strokeOpacity={0.22}
                        strokeWidth={30}
                        strokeLinejoin="round"
                      />
                    )}
                    {label}
                  </g>
                );
              })}

            {/* Edges */}
            {graph.relations.map((r, i) => {
              const a = pos[r.from];
              const b = pos[r.to];
              if (!a || !b) return null;
              const dimmed = focusSet && !(focusSet.has(r.from) && focusSet.has(r.to));
              const interpretive = r.confidence < 0.7;
              return (
                <line
                  key={`${r.from}-${r.to}-${r.type}-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={RELATION_COLOR[r.type]}
                  strokeWidth={r.type === 'member' ? 1 : 1.6}
                  strokeDasharray={interpretive ? '4 4' : undefined}
                  opacity={dimmed ? 0.08 : interpretive ? 0.5 : 0.7}
                />
              );
            })}

            {/* Nodes */}
            {graph.entities.map((e) => {
              const node = pos[e.id];
              if (!node) return null;
              const r = 7 + (e.prominence ?? 0.4) * 13;
              const color = COUNTRY_COLOR[e.country];
              const dimmed = focusSet && !focusSet.has(e.id);
              const isSel = e.id === selectedId;
              const faded = e.status === 'deceased' || e.status === 'retired';
              const purged = e.status === 'purged';
              return (
                <g
                  key={e.id}
                  transform={`translate(${node.x},${node.y})`}
                  opacity={dimmed ? 0.2 : faded ? 0.55 : 1}
                  className="cursor-pointer"
                  onPointerDown={(ev) => onNodePointerDown(ev, e.id)}
                >
                  {purged && (
                    <circle r={r + 4} fill="none" stroke="#f87171" strokeWidth={1.2} strokeDasharray="3 3" />
                  )}
                  {e.type === 'org' ? (
                    <rect
                      x={-r}
                      y={-r}
                      width={r * 2}
                      height={r * 2}
                      rx={3}
                      fill={`${color}22`}
                      stroke={color}
                      strokeWidth={isSel ? 2.5 : 1.4}
                    />
                  ) : (
                    <circle
                      r={r}
                      fill={`${color}33`}
                      stroke={isSel ? '#fbbf24' : color}
                      strokeWidth={isSel ? 3 : 1.6}
                    />
                  )}
                  <text
                    y={r + 11}
                    textAnchor="middle"
                    fontSize={10}
                    fill={isSel ? '#fef3c7' : '#a1a1aa'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {e.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Faction legend — click to isolate a faction; toggle hulls. */}
      {presentFactions.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 max-w-[210px] rounded border border-zinc-800 bg-[#0a0e16]/90 p-2 text-[11px]">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Factions</span>
            <button
              onClick={() => {
                setShowFactions((s) => !s);
                kick(0.7);
              }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              {showFactions ? 'hide hulls' : 'show hulls'}
            </button>
          </div>
          <ul className="flex flex-col gap-0.5">
            {presentFactions.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => {
                    setActiveFaction((a) => (a === f.id ? null : f.id));
                    setSelectedId(null);
                  }}
                  title={f.note}
                  className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition ${
                    activeFaction === f.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 flex-none rounded-sm"
                    style={{ background: f.color }}
                  />
                  <span className="truncate text-zinc-300">{f.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="absolute bottom-3 right-3 z-10 max-h-[60%] w-[300px] overflow-y-auto rounded-lg border border-zinc-800 bg-[#0a0e16]/95 p-3 text-sm shadow-xl backdrop-blur">
          <button
            onClick={() => setSelectedId(null)}
            className="float-right text-zinc-600 hover:text-zinc-300"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: COUNTRY_COLOR[selected.country] }}
            />
            <span className="font-semibold text-zinc-100">{selected.name}</span>
            {selected.nameNative && (
              <span className="text-xs text-zinc-500">{selected.nameNative}</span>
            )}
          </div>
          {selected.role && <div className="mt-1 text-xs text-zinc-400">{selected.role}</div>}
          {selected.status && STATUS_BADGE[selected.status] && (
            <span
              className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[selected.status].tone}`}
            >
              {STATUS_BADGE[selected.status].label}
            </span>
          )}
          {selected.bio && (
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{selected.bio}</p>
          )}
          {selected.factionTags && selected.factionTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selected.factionTags.map((t) => {
                const f = FACTION_BY_ID.get(t);
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setActiveFaction(t);
                      setSelectedId(null);
                    }}
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      background: f ? `${f.color}22` : '#27272a',
                      color: f ? f.color : '#a1a1aa',
                    }}
                  >
                    {f?.label ?? t}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 border-t border-zinc-800 pt-2">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
              Relations ({selectedRels.length})
            </div>
            <ul className="flex flex-col gap-1">
              {selectedRels.map((rel: Relation, i) => {
                const otherId = rel.from === selected.id ? rel.to : rel.from;
                const other = entById.get(otherId) ?? getEntityById(otherId);
                const outward = rel.from === selected.id;
                return (
                  <li key={i} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block h-2 w-2 flex-none rounded-full"
                      style={{ background: RELATION_COLOR[rel.type] }}
                      title={RELATION_LABEL[rel.type]}
                    />
                    <button
                      onClick={() => setSelectedId(otherId)}
                      className="truncate text-left text-zinc-300 hover:text-amber-300"
                    >
                      {other?.name ?? otherId}
                    </button>
                    <span className="truncate text-[11px] text-zinc-500">
                      {rel.label ?? rel.type}
                      {outward ? '' : ' ←'}
                      {rel.confidence < 0.7 && ' ·?'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected.sourceUrl && (
            <a
              href={selected.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[11px] text-sky-400 hover:underline"
            >
              Source ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

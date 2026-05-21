'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntelEvent } from '@/lib/types';
import { BASES, OPERATOR_COLOR } from '@/lib/military-bases';

// All bases get a single non-emoji glyph so they read as "fixed
// installations" and don't visually collide with event emojis
// (✈ ⚓ 🚀 💻) which mean "active occurrence."
const BASE_GLYPH = '★';

// We deliberately do NOT `import 'cesium'`. The npm package's source modules
// contain syntax that some modern bundlers re-emit in a way that breaks under
// strict-mode parsing. Instead we load the prebuilt IIFE script at runtime
// and use the resulting global. Cesium static files are copied into
// /public/cesium by scripts/copy-cesium-assets.mjs.

type CesiumNS = typeof import('cesium');

declare global {
  interface Window {
    Cesium?: CesiumNS;
    CESIUM_BASE_URL?: string;
    __cesiumLoadingPromise?: Promise<CesiumNS>;
  }
}

const SEVERITY_HEX: Record<string, string> = {
  info: '#a1a1aa',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#dc2626',
};

// Categories that get an emoji glyph on the map instead of a colored dot.
// Aircraft + ships are the user's main asks; missile/cyber/diplomacy
// are easier to recognize as a glyph than a 'just another dot'.
// Thermal (satellite) and seismic stay as dots because they spawn in
// dense clusters and emoji-spam would obscure the underlying map.
const EMOJI_CATEGORY: Record<string, string> = {
  air: '✈',
  naval: '⚓',
  missile: '🚀',
  cyber: '💻',
};

function loadCesium(): Promise<CesiumNS> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (window.__cesiumLoadingPromise) return window.__cesiumLoadingPromise;

  window.CESIUM_BASE_URL = '/cesium';

  const cssId = 'cesium-widgets-css';
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = '/cesium/Widgets/widgets.css';
    document.head.appendChild(link);
  }

  window.__cesiumLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/cesium/Cesium.js';
    script.async = true;
    script.onload = () => {
      if (window.Cesium) resolve(window.Cesium);
      else reject(new Error('Cesium loaded but window.Cesium is undefined'));
    };
    script.onerror = () => reject(new Error('Failed to load /cesium/Cesium.js'));
    document.head.appendChild(script);
  });

  return window.__cesiumLoadingPromise;
}

interface CesiumGlobeProps {
  events: IntelEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  aircraftTrace?: { eventId: string; points: Array<[number, number]> } | null;
}

export default function CesiumGlobe({
  events,
  selectedId,
  onSelect,
  aircraftTrace,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<InstanceType<CesiumNS['Viewer']> | null>(null);
  const CesiumRef = useRef<CesiumNS | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const cleanupRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadCesium()
      .then((Cesium) => {
        if (cancelled || !containerRef.current) return;
        CesiumRef.current = Cesium;

        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (token) Cesium.Ion.defaultAccessToken = token;

        const viewer = new Cesium.Viewer(containerRef.current, {
          timeline: false,
          animation: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          homeButton: false,
          geocoder: false,
          sceneModePicker: false,
          infoBox: false,
          selectionIndicator: false,
          fullscreenButton: false,
        });

        viewer.scene.globe.enableLighting = false;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#05070d');
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b1220');

        const credit = viewer.creditDisplay.container as HTMLElement;
        if (credit) {
          credit.style.color = '#71717a';
          credit.style.fontSize = '10px';
        }

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(125, 28, 6_500_000),
          duration: 0,
        });

        // ADIZ overlay polygons are intentionally not rendered here. They
        // looked like crude rectangles. When real GeoJSON boundaries land,
        // re-enable by iterating ZONES (kept in src/lib/zones.ts).

        // Military bases — static background layer, drawn once. Keep a
        // lookup so the hover tooltip can show meaningful info.
        const baseById = new Map<string, (typeof BASES)[number]>();
        for (const b of BASES) {
          const id = `base-${b.id}`;
          baseById.set(id, b);
          viewer.entities.add({
            id,
            name: b.name,
            position: Cesium.Cartesian3.fromDegrees(b.lon, b.lat),
            label: {
              text: BASE_GLYPH,
              font: 'bold 14px sans-serif',
              fillColor: Cesium.Color.fromCssColorString(OPERATOR_COLOR[b.operator]),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              showBackground: false,
              translucencyByDistance: new Cesium.NearFarScalar(
                500_000, 1.0,
                15_000_000, 0.25,
              ),
            },
          });
        }

        // Custom hover tooltip — Cesium's built-in infoBox needs a click.
        // We render a tiny absolutely-positioned div next to the cursor on
        // mouseover. Works for bases (shows base name + operator) and for
        // events (shows event title).
        const tip = document.createElement('div');
        tip.style.cssText =
          'position:fixed;z-index:9999;pointer-events:none;display:none;' +
          'background:#0a0a0acc;color:#fafafa;padding:6px 10px;border-radius:4px;' +
          'border:1px solid #27272a;font:12px ui-sans-serif,system-ui,sans-serif;' +
          'max-width:240px;line-height:1.35;box-shadow:0 4px 12px #0008';
        document.body.appendChild(tip);

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction(
          (move: { endPosition: { x: number; y: number } }) => {
            const picked = viewer.scene.pick(move.endPosition as never);
            if (picked && picked.id && typeof picked.id.id === 'string') {
              const id = picked.id.id as string;
              if (id.startsWith('base-')) {
                const b = baseById.get(id);
                if (b) {
                  tip.innerHTML = `<div style="color:${OPERATOR_COLOR[b.operator]};font-weight:600;font-size:10px;letter-spacing:.08em">${b.operator}</div><div style="margin-top:2px">${b.name}</div><div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-top:1px">${b.kind}</div>`;
                  tip.style.display = 'block';
                }
              } else {
                // Event hover — find current event for name
                const ent = viewer.entities.getById(id);
                const name = (ent?.name as string) || (ent?.id as string) || id;
                tip.innerHTML = `<div>${name}</div>`;
                tip.style.display = 'block';
              }
              // Position next to cursor; use canvas-relative coords + offset
              const rect = viewer.scene.canvas.getBoundingClientRect();
              tip.style.left = `${rect.left + move.endPosition.x + 14}px`;
              tip.style.top = `${rect.top + move.endPosition.y + 14}px`;
            } else {
              tip.style.display = 'none';
            }
          },
          Cesium.ScreenSpaceEventType.MOUSE_MOVE,
        );
        handler.setInputAction((click: { position: { x: number; y: number } }) => {
          const picked = viewer.scene.pick(click.position as never);
          if (picked && picked.id && typeof picked.id.id === 'string') {
            const id = picked.id.id as string;
            // Bases are background — don't propagate as event selection.
            if (id.startsWith('base-')) return;
            onSelectRef.current(id);
            return;
          }
          onSelectRef.current(null);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        // Stash for cleanup
        cleanupRef.current = () => {
          try { handler.destroy(); } catch {}
          try { tip.remove(); } catch {}
        };

        viewerRef.current = viewer;
        setReady(true);
      })
      .catch((err) => {
        console.error('[CesiumGlobe] init failed:', err);
      });

    return () => {
      cancelled = true;
      try {
        viewerRef.current?.destroy();
      } catch {
        // ignore
      }
      viewerRef.current = null;
    };
  }, []);

  // Sync event entities. We can't `removeAll` anymore because the military
  // base entities (added once at mount) live in the same collection.
  // Track our event IDs in a ref instead.
  const prevEventIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium) return;

    // Remove previously-added event entities only.
    for (const id of prevEventIdsRef.current) {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    }
    prevEventIdsRef.current.clear();

    // Defensive dedupe: if any source ever produces colliding IDs, the
    // first wins. Without this, Cesium throws DeveloperError on the
    // duplicate add and tears down the globe.
    const seen = new Set<string>();
    for (const evt of events) {
      if (seen.has(evt.id)) continue;
      seen.add(evt.id);
      prevEventIdsRef.current.add(evt.id);
      const isSel = evt.id === selectedId;
      const color = Cesium.Color.fromCssColorString(SEVERITY_HEX[evt.severity] ?? '#ffffff');
      const emoji = EMOJI_CATEGORY[evt.category];

      // Build base entity options.
      const base: Record<string, unknown> = {
        id: evt.id,
        position: Cesium.Cartesian3.fromDegrees(evt.lon, evt.lat),
      };

      if (emoji) {
        // Emoji-rendered event (aircraft, ship, missile, cyber).
        base.label = {
          text: emoji,
          font: isSel ? '22px sans-serif' : '17px sans-serif',
          fillColor: color,
          outlineColor: isSel
            ? Cesium.Color.fromCssColorString('#fbbf24')
            : Cesium.Color.BLACK,
          outlineWidth: isSel ? 3 : 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
        };
      } else {
        // Dot-rendered event (satellite, seismic, diplomatic, economic).
        base.point = {
          pixelSize: isSel ? 20 : 10,
          color,
          outlineColor: isSel
            ? Cesium.Color.fromCssColorString('#fbbf24')
            : Cesium.Color.WHITE,
          outlineWidth: isSel ? 4 : 1.5,
        };
      }

      if (isSel) {
        const title = evt.title.length > 60 ? evt.title.slice(0, 57) + '...' : evt.title;
        base.label = {
          ...(base.label as object || {}),
          // Override text to show the title when selected (emoji items
          // still show the emoji at larger size by virtue of being the
          // 'label' graphic). For dot items we add a separate label here.
          text: emoji ? `${emoji}  ${title}` : title,
          font: '13px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -28),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0a0a0acc'),
          backgroundPadding: new Cesium.Cartesian2(8, 6),
        };
      }

      viewer.entities.add(base);

      // Trailing polyline for moving entities (aircraft now; later ships).
      // When the user selects an ADSB event AND a full trace has been
      // fetched for it, use the full 24h trace instead of our short
      // in-memory accumulator. Otherwise fall back to track from events.
      let trail = evt.track;
      if (isSel && aircraftTrace?.eventId === evt.id && aircraftTrace.points.length > 1) {
        trail = aircraftTrace.points;
      }
      if (trail && trail.length > 1) {
        const trailId = `${evt.id}-trail`;
        prevEventIdsRef.current.add(trailId);
        const flat: number[] = [];
        for (const [lo, la] of trail) {
          flat.push(lo, la);
        }
        viewer.entities.add({
          id: trailId,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(flat),
            width: isSel ? 2.5 : 1.5,
            material: color.withAlpha(isSel ? 0.85 : 0.55),
            clampToGround: false,
          },
        });
      }
    }
  }, [events, selectedId, ready, aircraftTrace]);

  // Fly camera to the selected event so a click on a tiny dot reveals
  // where you actually are.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium || !selectedId) return;
    const evt = events.find((e) => e.id === selectedId);
    if (!evt) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(evt.lon, evt.lat, 900_000),
      duration: 1.0,
    });
  }, [selectedId, events, ready]);

  return <div ref={containerRef} className="h-full w-full" />;
}

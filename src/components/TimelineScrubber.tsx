'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  onRangeChange: (range: { since: string; until: string } | null) => void;
}

const WINDOW_MIN = 60; // each "tick" shows ±60 min around it
const HISTORY_HOURS = 24;

function fmt(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
}

export default function TimelineScrubber({ onRangeChange }: Props) {
  // 0 = NOW (live), -1 = 1 h ago, -24 = 24 h ago
  const [offsetHours, setOffsetHours] = useState(0);
  // Local-relative-time anchor; recomputed every minute so the slider
  // doesn't drift when the page is left open.
  const [anchor, setAnchor] = useState(() => Date.now());
  const lastRange = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setAnchor(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { rangeStart, rangeEnd, label } = useMemo(() => {
    if (offsetHours === 0) {
      return { rangeStart: null, rangeEnd: null, label: 'LIVE' };
    }
    const center = anchor + offsetHours * 60 * 60 * 1000;
    const start = center - WINDOW_MIN * 60 * 1000;
    const end = center + WINDOW_MIN * 60 * 1000;
    return {
      rangeStart: new Date(start).toISOString(),
      rangeEnd: new Date(end).toISOString(),
      label: `${fmt(new Date(center))} ± ${WINDOW_MIN} min`,
    };
  }, [offsetHours, anchor]);

  useEffect(() => {
    const key = rangeStart && rangeEnd ? `${rangeStart}|${rangeEnd}` : 'live';
    if (lastRange.current === key) return;
    lastRange.current = key;
    onRangeChange(rangeStart && rangeEnd ? { since: rangeStart, until: rangeEnd } : null);
  }, [rangeStart, rangeEnd, onRangeChange]);

  return (
    <div className="flex items-center gap-3 border-t border-zinc-800 bg-[#0a0a0a] px-4 py-2">
      <button
        onClick={() => setOffsetHours(0)}
        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
          offsetHours === 0
            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
            : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
        }`}
      >
        LIVE
      </button>
      <input
        type="range"
        min={-HISTORY_HOURS}
        max={0}
        step={1}
        value={offsetHours}
        onChange={(e) => setOffsetHours(parseInt(e.target.value, 10))}
        className="flex-1 accent-amber-500"
        aria-label="Timeline (hours ago)"
      />
      <span className="min-w-[140px] text-right font-mono text-[11px] text-zinc-400 tabular-nums">
        {label}
      </span>
    </div>
  );
}

'use client';

import { useRef } from 'react';

interface Props {
  // Current top-half (globe) percentage of viewport on mobile, 15–85.
  mainPct: number;
  setMainPct: (pct: number) => void;
  // Approximate header height to subtract from clientY for clamping.
  headerOffset?: number;
}

export default function SplitHandle({ mainPct, setMainPct, headerOffset = 56 }: Props) {
  const dragging = useRef(false);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize map and feed"
      className="relative z-10 flex h-10 w-full cursor-row-resize touch-none select-none items-center justify-center border-y border-zinc-800 bg-zinc-900 active:bg-zinc-800 md:hidden"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const vh = window.innerHeight - headerOffset;
        if (vh <= 0) return;
        const pct = ((e.clientY - headerOffset) / vh) * 100;
        setMainPct(Math.max(15, Math.min(85, pct)));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={(e) => {
        dragging.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onDoubleClick={() => setMainPct(45)}
    >
      {/* pointer-events: none so the handle div, not this grip, is always
          e.currentTarget for pointer capture */}
      <div className="pointer-events-none flex flex-col items-center gap-0.5">
        <div className="h-1 w-12 rounded-full bg-zinc-500" />
        <div className="h-1 w-12 rounded-full bg-zinc-500" />
      </div>
    </div>
  );
}

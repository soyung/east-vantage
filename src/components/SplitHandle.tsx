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
      className="flex h-4 w-full cursor-row-resize touch-none items-center justify-center bg-zinc-900/80 md:hidden"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
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
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }}
      onDoubleClick={() => setMainPct(45)}
    >
      <div className="h-1 w-10 rounded-full bg-zinc-600" />
    </div>
  );
}

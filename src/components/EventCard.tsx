'use client';

import type { IntelEvent } from '@/lib/types';
import { CATEGORY_LABEL, SEVERITY_COLOR, SEVERITY_RING, timeAgo } from '@/lib/format';

interface Props {
  event: IntelEvent;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function EventCard({ event, selected, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(event.id)}
      className={`group flex w-full flex-col gap-1.5 border-l-2 px-4 py-3 text-left transition hover:bg-zinc-900/60 ${
        selected
          ? `border-l-amber-500 bg-zinc-900/80 ring-1 ${SEVERITY_RING[event.severity]}`
          : 'border-l-transparent'
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500">
        <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_COLOR[event.severity]}`} />
        <span>{CATEGORY_LABEL[event.category]}</span>
        <span className="text-zinc-700">·</span>
        <span>{timeAgo(event.timestamp)}</span>
        <span className="ml-auto text-zinc-600">{event.source}</span>
      </div>
      <div className="text-sm font-medium leading-snug text-zinc-100">{event.title}</div>
      <div className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{event.summary}</div>
      {event.tags && event.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {event.tags.map((t) => (
            <span
              key={t}
              className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

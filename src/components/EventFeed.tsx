'use client';

import type { IntelEvent } from '@/lib/types';
import EventCard from './EventCard';

interface Props {
  events: IntelEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  loading: boolean;
}

export default function EventFeed({ events, selectedId, onSelect, loading }: Props) {
  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#0a0a0a] px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-500">
        <span>Event feed</span>
        <span>{events.length} active</span>
      </div>
      <div className="divide-y divide-zinc-900 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {loading ? (
          <div className="space-y-2 px-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-2 w-1/3 animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-800" />
                <div className="h-2 w-3/5 animate-pulse rounded bg-zinc-900" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            No events from any source in the last 24 h.
            <div className="mt-1 text-xs text-zinc-600">
              Try widening the region or category filter, or wait — sources refresh every 5 min.
            </div>
          </div>
        ) : (
          events.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              selected={evt.id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

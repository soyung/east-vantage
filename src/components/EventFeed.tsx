'use client';

import type { IntelEvent } from '@/lib/types';
import EventCard from './EventCard';

interface Props {
  events: IntelEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function EventFeed({ events, selectedId, onSelect }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#0a0a0a] px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-500">
        <span>Event feed</span>
        <span>{events.length} active</span>
      </div>
      <div className="flex-1 divide-y divide-zinc-900 overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            No events match current filters.
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

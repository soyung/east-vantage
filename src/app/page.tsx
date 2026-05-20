'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/Header';
import Globe from '@/components/Globe';
import EventFeed from '@/components/EventFeed';
import FilterChips from '@/components/FilterChips';
import { SAMPLE_EVENTS } from '@/lib/sample-events';
import type { EventCategory, EventRegion } from '@/lib/types';

const ALL_CATEGORIES: EventCategory[] = [
  'air',
  'naval',
  'missile',
  'cyber',
  'satellite',
  'diplomatic',
  'economic',
];

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<EventRegion | 'all'>('all');
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(
    new Set(ALL_CATEGORIES),
  );

  const filtered = useMemo(() => {
    return SAMPLE_EVENTS.filter((e) => {
      if (activeRegion !== 'all' && e.region !== activeRegion) return false;
      if (!activeCategories.has(e.category)) return false;
      return true;
    }).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  }, [activeRegion, activeCategories]);

  const toggleCategory = (c: EventCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="flex h-screen flex-col bg-[#05070d] text-zinc-100">
      <Header eventCount={filtered.length} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[380px] flex-shrink-0 flex-col border-r border-zinc-800 bg-[#070a10]">
          <FilterChips
            activeRegion={activeRegion}
            activeCategories={activeCategories}
            onRegionChange={setActiveRegion}
            onCategoryToggle={toggleCategory}
          />
          <EventFeed
            events={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        <main className="relative flex-1">
          <Globe events={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </main>
      </div>
    </div>
  );
}

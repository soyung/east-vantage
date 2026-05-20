'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Globe from '@/components/Globe';
import EventFeed from '@/components/EventFeed';
import FilterChips from '@/components/FilterChips';
import MarketPanel from '@/components/MarketPanel';
import { SAMPLE_EVENTS } from '@/lib/sample-events';
import type {
  EventCategory,
  EventRegion,
  IntelEvent,
  MarketCard,
  SourceStatus,
} from '@/lib/types';

const ALL_CATEGORIES: EventCategory[] = [
  'air',
  'naval',
  'missile',
  'cyber',
  'satellite',
  'seismic',
  'diplomatic',
  'economic',
];

type DataSource = 'loading' | 'live' | 'sample';

interface EventsResponse {
  events: IntelEvent[];
  markets: MarketCard[];
  sources: SourceStatus[];
  source: 'live' | 'sample';
  fetchedAt?: string;
  error?: string;
}

export default function Home() {
  const [events, setEvents] = useState<IntelEvent[]>(SAMPLE_EVENTS);
  const [markets, setMarkets] = useState<MarketCard[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('loading');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<EventRegion | 'all'>('all');
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(
    new Set(ALL_CATEGORIES),
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        const data = (await res.json()) as EventsResponse;
        if (cancelled) return;
        setEvents(data.events.length > 0 ? data.events : SAMPLE_EVENTS);
        setMarkets(data.markets ?? []);
        setSources(data.sources ?? []);
        setDataSource(data.source);
        setFetchedAt(data.fetchedAt ?? new Date().toISOString());
      } catch (err) {
        console.error('[page] /api/events fetch failed:', err);
        if (!cancelled) {
          setDataSource('sample');
          setFetchedAt(new Date().toISOString());
        }
      }
    }

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    return events
      .filter((e) => {
        if (activeRegion !== 'all' && e.region !== activeRegion) return false;
        if (!activeCategories.has(e.category)) return false;
        return true;
      })
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  }, [events, activeRegion, activeCategories]);

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
      <Header
        eventCount={filtered.length}
        dataSource={dataSource}
        fetchedAt={fetchedAt}
        sources={sources}
      />
      {/* Mobile: globe pinned at top 45dvh, sidebar fills rest (scrolls).
          Desktop (md+): sidebar 380px left, globe fills rest. */}
      <div className="flex flex-1 flex-col-reverse overflow-hidden md:flex-row">
        <aside className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[#070a10] md:w-[380px] md:flex-none md:overflow-hidden md:border-r md:border-zinc-800">
          <FilterChips
            activeRegion={activeRegion}
            activeCategories={activeCategories}
            onRegionChange={setActiveRegion}
            onCategoryToggle={toggleCategory}
          />
          {markets.length > 0 && <MarketPanel markets={markets} />}
          <EventFeed events={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <main className="relative h-[45dvh] flex-shrink-0 md:h-auto md:flex-1">
          <Globe events={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </main>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Globe from '@/components/Globe';
import EventFeed from '@/components/EventFeed';
import FilterChips from '@/components/FilterChips';
import MarketPanel from '@/components/MarketPanel';
import SeverityLegend from '@/components/SeverityLegend';
import SplitHandle from '@/components/SplitHandle';
import type {
  EventCategory,
  EventRegion,
  IntelEvent,
  MarketCard,
  SourceStatus,
} from '@/lib/types';

type DataSource = 'loading' | 'live';

interface EventsResponse {
  events: IntelEvent[];
  markets: MarketCard[];
  sources: SourceStatus[];
  source: 'live';
  fetchedAt?: string;
  error?: string;
}

export default function Home() {
  const [events, setEvents] = useState<IntelEvent[]>([]);
  const [markets, setMarkets] = useState<MarketCard[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('loading');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<EventRegion | 'all'>('all');
  const [activeCategory, setActiveCategory] = useState<EventCategory | 'all'>('all');
  // Mobile-only: globe height as % of viewport. Drag the handle to resize.
  const [mobileMainPct, setMobileMainPct] = useState(45);
  // Full historical trace of the selected aircraft (lon,lat pairs from
  // ADSBexchange via /api/aircraft-trace/[hex]). When set, the globe
  // replaces the short in-memory trail for that event with this trace.
  const [aircraftTrace, setAircraftTrace] = useState<{
    eventId: string;
    points: Array<[number, number]>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        const data = (await res.json()) as EventsResponse;
        if (cancelled) return;
        setEvents(data.events ?? []);
        setMarkets(data.markets ?? []);
        setSources(data.sources ?? []);
        setDataSource('live');
        setFetchedAt(data.fetchedAt ?? new Date().toISOString());
      } catch (err) {
        console.error('[page] /api/events fetch failed:', err);
        if (!cancelled) {
          setDataSource('live');
          setFetchedAt(new Date().toISOString());
        }
      }
    }

    load();
    // 90s refresh keeps the ADSB trails feeling live without hammering
    // the API route. Heavier sources cache further on the server side
    // so this doesn't multiply upstream cost.
    const id = setInterval(load, 90 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // When an ADSB event is selected, fetch its full 24h trace from
  // ADSBexchange (via our proxy). Cleared when selection changes away
  // from that aircraft.
  useEffect(() => {
    if (!selectedId || !selectedId.startsWith('adsb-')) {
      setAircraftTrace(null);
      return;
    }
    const hex = selectedId.replace(/^adsb-/, '');
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/aircraft-trace/${hex}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled || !data.points) return;
        setAircraftTrace({
          eventId: selectedId,
          points: data.points.map((p: { lon: number; lat: number }) => [p.lon, p.lat]),
        });
      } catch (err) {
        console.warn('[page] aircraft trace fetch failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // After region filter only — used for chip counts so the user sees how
  // many events each category has within their current region selection.
  const regionFiltered = useMemo(
    () => (activeRegion === 'all' ? events : events.filter((e) => e.region === activeRegion)),
    [events, activeRegion],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<EventCategory, number> = {
      air: 0,
      naval: 0,
      missile: 0,
      cyber: 0,
      satellite: 0,
      seismic: 0,
      diplomatic: 0,
      economic: 0,
    };
    for (const e of regionFiltered) counts[e.category]++;
    return counts;
  }, [regionFiltered]);

  const filtered = useMemo(() => {
    const base =
      activeCategory === 'all'
        ? regionFiltered
        : regionFiltered.filter((e) => e.category === activeCategory);
    return [...base].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  }, [regionFiltered, activeCategory]);

  return (
    <div className="flex h-screen flex-col bg-[#05070d] text-zinc-100">
      <Header
        eventCount={filtered.length}
        dataSource={dataSource}
        fetchedAt={fetchedAt}
        sources={sources}
      />
      {/* Mobile: globe at top (resizable via SplitHandle), sidebar fills rest.
          Desktop (md+): sidebar 380px left, globe fills rest. */}
      <div className="flex flex-1 flex-col-reverse overflow-hidden md:flex-row">
        <aside className="flex min-h-0 w-full flex-1 flex-col bg-[#070a10] md:w-[380px] md:flex-none md:border-r md:border-zinc-800">
          {/* Drag handle stays put — outside the scrollable region */}
          <SplitHandle mainPct={mobileMainPct} setMainPct={setMobileMainPct} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:overflow-hidden">
            <FilterChips
              activeRegion={activeRegion}
              activeCategory={activeCategory}
              categoryCounts={categoryCounts}
              totalCount={regionFiltered.length}
              onRegionChange={setActiveRegion}
              onCategoryChange={setActiveCategory}
            />
            {markets.length > 0 && <MarketPanel markets={markets} />}
            <SeverityLegend />
            <EventFeed
              events={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              loading={dataSource === 'loading'}
            />
          </div>
        </aside>
        <main
          className="relative h-[var(--main-h)] flex-shrink-0 md:h-auto md:flex-1"
          style={{ '--main-h': `${mobileMainPct}dvh` } as React.CSSProperties}
        >
          <Globe
            events={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            aircraftTrace={aircraftTrace}
          />
        </main>
      </div>
    </div>
  );
}

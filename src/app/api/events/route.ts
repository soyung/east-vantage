import { NextResponse } from 'next/server';
import { getAllSources } from '@/lib/sources';
import { record, getInRange, size as storeSize } from '@/lib/event-store';

export const dynamic = 'force-dynamic';
// Hobby plan max is 60s. Need >25s to absorb GDELT connect window.
export const maxDuration = 35;
// Run from Vercel iad1 — close to api.gdeltproject.org.
export const preferredRegion = 'iad1';

const JSON_HEADERS = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json; charset=utf-8',
  ...extra,
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  // ?since=ISO_DATE&until=ISO_DATE → return events from the accumulated
  // store within that window instead of fetching fresh. Used by the
  // timeline scrubber to surface past events the container has seen.
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');

  try {
    const { events, markets, sources, fetchedAt } = await getAllSources();
    // Always record the fresh snapshot into the rolling store.
    record(events);

    let returned = events;
    let historical = false;
    if (since && until) {
      const s = Date.parse(since);
      const u = Date.parse(until);
      if (!isNaN(s) && !isNaN(u) && u > s) {
        returned = getInRange(s, u);
        historical = true;
      }
    }

    return NextResponse.json(
      {
        events: returned,
        markets,
        sources,
        source: 'live',
        fetchedAt,
        historical,
        storeSize: storeSize(),
      },
      {
        headers: JSON_HEADERS({
          'Cache-Control': historical
            ? 'public, s-maxage=30'
            : 'public, s-maxage=60, stale-while-revalidate=600',
        }),
      },
    );
  } catch (err) {
    console.error('[api/events] failed:', err);
    return NextResponse.json(
      {
        events: [],
        markets: [],
        sources: [],
        source: 'live',
        error: err instanceof Error ? err.message : String(err),
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: JSON_HEADERS({ 'Cache-Control': 'public, s-maxage=30' }),
        status: 200,
      },
    );
  }
}

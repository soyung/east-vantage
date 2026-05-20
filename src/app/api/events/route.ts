import { NextResponse } from 'next/server';
import { fetchGdeltEvents } from '@/lib/gdelt';
import { SAMPLE_EVENTS } from '@/lib/sample-events';

// Always run on request (don't statically prerender at build time).
// The CDN-side Cache-Control headers below give us a 5-min edge cache.
export const dynamic = 'force-dynamic';
// Raise Vercel function timeout above default 10s so two sequential GDELT
// calls (with a 5.5s inter-request gap) can finish comfortably.
export const maxDuration = 30;

export async function GET() {
  try {
    const events = await fetchGdeltEvents();
    if (events.length === 0) {
      return NextResponse.json(
        { events: SAMPLE_EVENTS, source: 'sample', reason: 'gdelt returned 0 events' },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
      );
    }
    return NextResponse.json(
      { events, source: 'gdelt', fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    console.error('[api/events] failed:', err);
    return NextResponse.json(
      {
        events: SAMPLE_EVENTS,
        source: 'sample',
        reason: 'fetch failed',
        error: err instanceof Error ? err.message : String(err),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=30' } },
    );
  }
}

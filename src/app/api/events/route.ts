import { NextResponse } from 'next/server';
import { getEvents } from '@/lib/gdelt';
import { SAMPLE_EVENTS } from '@/lib/sample-events';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

export async function GET() {
  try {
    const { events, fromCache, error } = await getEvents();
    if (events.length === 0) {
      return NextResponse.json(
        { events: SAMPLE_EVENTS, source: 'sample', reason: 'gdelt returned 0 events' },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
      );
    }
    return NextResponse.json(
      {
        events,
        source: fromCache === 'stale' ? 'gdelt-stale' : 'gdelt',
        fetchedAt: new Date().toISOString(),
        ...(error ? { warning: error } : {}),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        },
      },
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

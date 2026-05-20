import { NextResponse } from 'next/server';
import { getAllSources } from '@/lib/sources';

export const dynamic = 'force-dynamic';
// Hobby plan max is 60s. Need >25s to absorb GDELT connect window.
export const maxDuration = 35;
// Run from Vercel iad1 — close to api.gdeltproject.org.
export const preferredRegion = 'iad1';

const JSON_HEADERS = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json; charset=utf-8',
  ...extra,
});

export async function GET() {
  try {
    const { events, markets, sources, fetchedAt } = await getAllSources();
    return NextResponse.json(
      { events, markets, sources, source: 'live', fetchedAt },
      {
        headers: JSON_HEADERS({
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
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

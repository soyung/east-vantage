import { NextResponse } from 'next/server';
import { getAllSources } from '@/lib/sources';
import { SAMPLE_EVENTS } from '@/lib/sample-events';

export const dynamic = 'force-dynamic';
// Hobby plan max is 60s. We need >25s to absorb the GDELT connect window.
export const maxDuration = 35;
// Run this function from Vercel's US East region — much closer to
// api.gdeltproject.org (Georgetown / US East) than the default SFO.
export const preferredRegion = 'iad1';

const JSON_HEADERS = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json; charset=utf-8',
  ...extra,
});

export async function GET() {
  try {
    const { events, markets, sources, fetchedAt } = await getAllSources();
    const anyOk = sources.some((s) => s.ok && s.count > 0);
    if (!anyOk) {
      return NextResponse.json(
        {
          events: SAMPLE_EVENTS,
          markets: [],
          sources,
          source: 'sample',
          fetchedAt,
        },
        {
          headers: JSON_HEADERS({
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          }),
        },
      );
    }
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
        events: SAMPLE_EVENTS,
        markets: [],
        sources: [],
        source: 'sample',
        error: err instanceof Error ? err.message : String(err),
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: JSON_HEADERS({ 'Cache-Control': 'public, s-maxage=30' }),
      },
    );
  }
}

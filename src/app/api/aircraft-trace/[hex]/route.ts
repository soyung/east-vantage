import { NextResponse } from 'next/server';

// Proxy to ADSBexchange's per-aircraft full-trace data. Their CDN
// requires a browser User-Agent + Referer header, so we can't fetch it
// directly from the browser (CORS would block) — we go through this
// route. Cached on the edge for 5 min per hex.

export const dynamic = 'force-dynamic';
export const maxDuration = 15;
export const preferredRegion = 'iad1';

interface TraceResponse {
  icao: string;
  r?: string;
  t?: string;
  timestamp: number;
  trace: Array<[
    number, // seconds since `timestamp`
    number, // latitude
    number, // longitude
    number | string | null, // altitude
    number | null, // ground speed (kt)
    number | null, // track heading (deg)
    ...unknown[]
  ]>;
}

interface Point {
  ts: number;       // ms since epoch
  lat: number;
  lon: number;
  alt: number | null;
  gs: number | null;
  heading: number | null;
}

const JSON_HEADERS = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json; charset=utf-8',
  ...extra,
});

export async function GET(_req: Request, ctx: { params: Promise<{ hex: string }> }) {
  const { hex } = await ctx.params;
  const hexLc = hex.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (!/^[0-9a-f]{4,8}$/.test(hexLc)) {
    return NextResponse.json({ error: 'bad hex' }, { status: 400 });
  }
  const prefix = hexLc.slice(-2);
  const url = `https://globe.adsbexchange.com/data/traces/${prefix}/trace_full_${hexLc}.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://globe.adsbexchange.com/',
        Accept: 'application/json,*/*',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `trace ${res.status}` },
        { status: 200, headers: JSON_HEADERS() },
      );
    }
    const data = (await res.json()) as TraceResponse;
    const baseMs = data.timestamp * 1000;
    const points: Point[] = data.trace
      .filter((row) => typeof row[1] === 'number' && typeof row[2] === 'number')
      .map((row) => ({
        ts: baseMs + row[0] * 1000,
        lat: row[1],
        lon: row[2],
        alt: typeof row[3] === 'number' ? row[3] : null,
        gs: typeof row[4] === 'number' ? row[4] : null,
        heading: typeof row[5] === 'number' ? row[5] : null,
      }));

    return NextResponse.json(
      {
        hex: hexLc,
        registration: data.r,
        type: data.t,
        points,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: JSON_HEADERS({
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        }),
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 200, headers: JSON_HEADERS() },
    );
  }
}

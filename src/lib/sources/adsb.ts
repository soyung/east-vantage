import type { IntelEvent } from '../types';

// adsb.lol — community-run ADS-B aggregator, no auth, ~1 req/sec.
// We use the curated /v2/mil endpoint which returns all aircraft currently
// flagged as military by adsb.lol's database, then filter to our region.

const ADSB_MIL = 'https://api.adsb.lol/v2/mil';
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60 * 1000;

// Bbox covering Taiwan Strait + Korean peninsula + adjacent waters
const REGION_BBOXES: Array<{ region: IntelEvent['region']; w: number; s: number; e: number; n: number }> = [
  { region: 'taiwan-strait', w: 117, s: 21, e: 124, n: 29 },
  { region: 'korean-peninsula', w: 124, s: 33, e: 131, n: 43 },
  { region: 'japan', w: 129, s: 30, e: 146, n: 46 },
  // China bbox is large — most PLA flights stay in mainland airspace
  // and many don't broadcast ADS-B, but we still want to catch those
  // that do (transports, AEW, surveillance).
  { region: 'china-mainland', w: 73, s: 18, e: 135, n: 53 },
];

function regionFor(lat: number, lon: number): IntelEvent['region'] | null {
  // Order matters — smaller / more-specific bboxes first so e.g. an
  // aircraft right above Taiwan gets 'taiwan-strait' not 'china-mainland'.
  for (const b of REGION_BBOXES) {
    if (lon >= b.w && lon <= b.e && lat >= b.s && lat <= b.n) return b.region;
  }
  return null;
}

interface AdsbAircraft {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  gs?: number;
  track?: number;
  dbFlags?: number;
  desc?: string;
}

interface AdsbResp {
  ac?: AdsbAircraft[];
}

function altString(alt: number | string | undefined): string {
  if (typeof alt === 'number') return `${alt}ft`;
  if (alt === 'ground') return 'ground';
  return '?';
}

async function fetchMil(): Promise<IntelEvent[]> {
  const res = await fetch(ADSB_MIL, {
    headers: { 'User-Agent': 'east-vantage/0.2 (research)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const data = (await res.json()) as AdsbResp;
  const planes = data.ac ?? [];

  const events: IntelEvent[] = [];
  for (const a of planes) {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;
    const region = regionFor(a.lat, a.lon);
    if (!region) continue;

    events.push({
      id: `adsb-${a.hex}`,
      title: `${a.flight?.trim() || a.r || a.hex} · ${a.t ?? 'mil aircraft'}`,
      summary: `${a.desc ?? 'military aircraft'} · ${altString(a.alt_baro)} · ${
        a.gs ? Math.round(a.gs) + 'kt' : '?'
      } · hdg ${a.track !== undefined ? Math.round(a.track) + '°' : '?'}`,
      category: 'air',
      severity: 'medium',
      region,
      lat: a.lat,
      lon: a.lon,
      timestamp: new Date().toISOString(),
      source: 'adsb.lol',
      sourceUrl: `https://globe.adsbexchange.com/?icao=${a.hex}`,
      tags: ['military', `type:${a.t ?? '?'}`, `reg:${a.r ?? '?'}`],
    });
  }
  return events;
}

interface CacheEntry {
  events: IntelEvent[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<IntelEvent[]> | null = null;

export async function getAdsbEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = fetchMil().finally(() => {
      inflight = null;
    });
  }

  try {
    const events = await inflight;
    cache = { events, at: now };
    return events;
  } catch (err) {
    if (cache) return cache.events;
    throw err;
  }
}

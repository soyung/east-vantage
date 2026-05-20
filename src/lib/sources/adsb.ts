import type { IntelEvent } from '../types';

// adsb.lol — community-run ADS-B aggregator, no auth, ~1 req/sec.
// We use the curated /v2/mil endpoint which returns all currently-tracked
// military aircraft, then filter to East Asia bboxes.
//
// To make positions less static, we accumulate a per-aircraft track in
// module-level memory across refreshes. Each IntelEvent then carries a
// `track` array of [lon, lat] points (oldest → current) so the globe can
// draw a trailing polyline. On Vercel the history survives only within a
// warm container (~5–15 min), which is fine: a fresh container just
// builds up its own trail from the next few refreshes.

const ADSB_MIL = 'https://api.adsb.lol/v2/mil';
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 45 * 1000; // refresh aggressively — these move fast

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

// ─── Per-aircraft track history (module-level memory) ──────────────
interface TrackPoint {
  lat: number;
  lon: number;
  ts: number;
}
const TRACK_MAX_AGE_MS = 60 * 60 * 1000; // 1 h trail max
const TRACK_MAX_POINTS = 120;
const trackHistory = new Map<string, TrackPoint[]>();

function appendTrack(hex: string, lat: number, lon: number, now: number): TrackPoint[] {
  let pts = trackHistory.get(hex) ?? [];
  // Avoid duplicating identical successive positions (e.g. aircraft parked)
  const last = pts[pts.length - 1];
  if (last && last.lat === lat && last.lon === lon) {
    return pts;
  }
  pts = [...pts, { lat, lon, ts: now }];
  const cutoff = now - TRACK_MAX_AGE_MS;
  pts = pts.filter((p) => p.ts >= cutoff).slice(-TRACK_MAX_POINTS);
  trackHistory.set(hex, pts);
  return pts;
}

// ─── Callsign → operator/route hint (best-effort, not authoritative) ─
function callsignHint(callsign?: string): string | null {
  if (!callsign) return null;
  const c = callsign.trim().toUpperCase();
  if (/^RCH\d/.test(c)) return 'US AMC transport (Reach)';
  if (/^PAT\d/.test(c)) return 'US Army Priority Air Transport';
  if (/^SPAR\d/.test(c)) return 'US DV transport (SAM)';
  if (/^CNV\d/.test(c)) return 'US Navy (Convoy)';
  if (/^JAKE|^RUDY|^SQID/.test(c)) return 'USMC V-22 / aviation';
  if (/^LOBO|^SHARK|^DRAGO|^TIGER/.test(c)) return 'US Air Force fighter / patrol';
  if (/^EAGLE\d|^HKR\d/.test(c)) return 'ROKAF / JASDF';
  if (/^HOKO|^TANGO/.test(c)) return 'JASDF';
  if (/^CKK|^CHN|^CCA/.test(c)) return 'China Civil / PLAAF transport';
  return null;
}

async function fetchMil(): Promise<IntelEvent[]> {
  const res = await fetch(ADSB_MIL, {
    headers: { 'User-Agent': 'east-vantage/0.3 (research)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const data = (await res.json()) as AdsbResp;
  const planes = data.ac ?? [];

  const now = Date.now();
  const events: IntelEvent[] = [];

  for (const a of planes) {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;
    const region = regionFor(a.lat, a.lon);
    if (!region) continue;

    const pts = appendTrack(a.hex, a.lat, a.lon, now);
    const track: Array<[number, number]> = pts.map((p) => [p.lon, p.lat]);

    const callsign = a.flight?.trim() || a.r || a.hex;
    const hint = callsignHint(a.flight);
    const alt =
      typeof a.alt_baro === 'number' ? a.alt_baro : a.alt_baro === 'ground' ? 0 : undefined;

    const trackDuration =
      pts.length > 1 ? Math.round((pts[pts.length - 1].ts - pts[0].ts) / 60000) : 0;

    events.push({
      id: `adsb-${a.hex}`,
      title: `${callsign} · ${a.t ?? 'mil aircraft'}`,
      summary: `${hint ?? a.desc ?? 'military aircraft'}${
        alt !== undefined ? ` · ${alt.toLocaleString()} ft` : ''
      }${a.gs !== undefined ? ` · ${Math.round(a.gs)} kt` : ''}${
        a.track !== undefined ? ` · heading ${Math.round(a.track)}°` : ''
      }${trackDuration > 0 ? ` · tracked ${trackDuration} min` : ''}`,
      category: 'air',
      severity: 'medium',
      region,
      lat: a.lat,
      lon: a.lon,
      timestamp: new Date().toISOString(),
      source: 'adsb.lol',
      sourceUrl: `https://globe.adsbexchange.com/?icao=${a.hex}`,
      tags: [
        'military',
        `type:${a.t ?? '?'}`,
        `reg:${a.r ?? '?'}`,
        ...(track.length > 1 ? [`track:${pts.length}pts`] : []),
      ],
      track: track.length > 1 ? track : undefined,
      headingDeg: a.track,
      altitudeFt: alt,
      speedKt: a.gs,
    });
  }

  // Garbage-collect: aircraft we haven't seen in this fetch, drop from
  // history if they've been silent for > TRACK_MAX_AGE_MS so the map
  // doesn't pile up stale phantom tracks.
  const seenHexes = new Set(planes.map((p) => p.hex));
  for (const [hex, pts] of trackHistory) {
    if (seenHexes.has(hex)) continue;
    const lastSeen = pts[pts.length - 1]?.ts ?? 0;
    if (now - lastSeen > TRACK_MAX_AGE_MS) trackHistory.delete(hex);
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

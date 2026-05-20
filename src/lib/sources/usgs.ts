import type { EventSeverity, IntelEvent } from '../types';

// USGS Earthquake API — anonymous, no auth, GeoJSON output.
// We bound the query to East Asia and any quake within 50km of Punggye-ri
// (DPRK nuclear test site) gets flagged as a possible test.

const USGS = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

const PUNGGYE_RI = { lat: 41.28, lon: 129.08 };

// Haversine distance in km
function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface UsgsFeature {
  type: 'Feature';
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    url: string;
    type: string;
    title: string;
  };
  geometry: { type: 'Point'; coordinates: [number, number, number] };
}

interface UsgsResponse {
  features: UsgsFeature[];
}

function severityFromMag(mag: number, nearTestSite: boolean): EventSeverity {
  if (nearTestSite && mag >= 4) return 'critical';
  if (mag >= 6) return 'high';
  if (mag >= 5) return 'medium';
  if (mag >= 4) return 'low';
  return 'info';
}

function regionFor(lat: number, lon: number): IntelEvent['region'] {
  if (lon >= 117 && lon <= 124 && lat >= 21 && lat <= 29) return 'taiwan-strait';
  if (lon >= 124 && lon <= 131 && lat >= 33 && lat <= 43) return 'korean-peninsula';
  if (lon >= 129 && lon <= 146 && lat >= 30 && lat <= 46) return 'japan';
  if (lon >= 73 && lon <= 135 && lat >= 18 && lat <= 53) return 'china-mainland';
  return 'other';
}

interface CacheEntry {
  events: IntelEvent[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<IntelEvent[]> | null = null;

async function fetchEarthquakes(): Promise<IntelEvent[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL(USGS);
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('starttime', since);
  // Expanded to cover all East Asia: China + Korea + Japan + Taiwan
  url.searchParams.set('minlatitude', '18');
  url.searchParams.set('maxlatitude', '53');
  url.searchParams.set('minlongitude', '73');
  url.searchParams.set('maxlongitude', '147');
  url.searchParams.set('minmagnitude', '3.5');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'east-vantage/0.2 (research)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = (await res.json()) as UsgsResponse;

  return data.features.map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const distToTestSite = distKm({ lat, lon }, PUNGGYE_RI);
    const nearTestSite = distToTestSite < 50;
    const tags: string[] = [`M${f.properties.mag.toFixed(1)}`];
    if (nearTestSite) tags.push('possible-nuclear-test', `${distToTestSite.toFixed(0)}km from Punggye-ri`);

    return {
      id: `usgs-${f.id}`,
      title: nearTestSite
        ? `M${f.properties.mag.toFixed(1)} near Punggye-ri - possible nuclear test`
        : `M${f.properties.mag.toFixed(1)} earthquake - ${f.properties.place}`,
      summary: f.properties.place,
      category: 'seismic' as const,
      severity: severityFromMag(f.properties.mag, nearTestSite),
      region: regionFor(lat, lon),
      lat,
      lon,
      timestamp: new Date(f.properties.time).toISOString(),
      source: 'USGS',
      sourceUrl: f.properties.url,
      tags,
    };
  });
}

export async function getUsgsEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = fetchEarthquakes().finally(() => {
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

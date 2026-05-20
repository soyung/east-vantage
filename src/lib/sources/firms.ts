import type { EventSeverity, IntelEvent } from '../types';

// NASA FIRMS — Fire Information for Resource Management System.
// Despite the name, it just returns geolocated thermal anomaly points
// from VIIRS (Suomi NPP / NOAA-20) — useful as a tripwire for fires,
// industrial activity, refinery flares, reactor work, etc.
//
// API: https://firms.modaps.eosdis.nasa.gov/api/area/
// Limit: 5,000 transactions per 10 min per MAP_KEY (free, instant signup).

const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

// {west},{south},{east},{north}
const BBOXES: Array<{ name: string; bbox: [number, number, number, number] }> = [
  { name: 'korean-peninsula', bbox: [124, 33, 131, 42] },
  { name: 'taiwan-strait', bbox: [117, 21, 124, 29] },
];

interface FirmsRow {
  lat: number;
  lon: number;
  bright: number;
  scan?: number;
  acqDate: string; // YYYY-MM-DD
  acqTime: string; // HHMM
  satellite: string;
  confidence: string;
  frp: number; // fire radiative power, MW
  daynight: string;
}

function parseCsv(csv: string): FirmsRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iLat = idx('latitude');
  const iLon = idx('longitude');
  const iBright = idx('bright_ti4');
  const iAcqD = idx('acq_date');
  const iAcqT = idx('acq_time');
  const iSat = idx('satellite');
  const iConf = idx('confidence');
  const iFrp = idx('frp');
  const iDn = idx('daynight');

  const rows: FirmsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < header.length) continue;
    rows.push({
      lat: parseFloat(parts[iLat]),
      lon: parseFloat(parts[iLon]),
      bright: parseFloat(parts[iBright]) || 0,
      acqDate: parts[iAcqD],
      acqTime: parts[iAcqT],
      satellite: parts[iSat] ?? 'VIIRS',
      confidence: parts[iConf] ?? '',
      frp: parseFloat(parts[iFrp]) || 0,
      daynight: parts[iDn] ?? 'D',
    });
  }
  return rows;
}

function severityFromFrp(frp: number): EventSeverity {
  if (frp >= 100) return 'high';
  if (frp >= 30) return 'medium';
  if (frp >= 10) return 'low';
  return 'info';
}

function regionFromBbox(name: string): IntelEvent['region'] {
  if (name === 'korean-peninsula') return 'korean-peninsula';
  if (name === 'taiwan-strait') return 'taiwan-strait';
  return 'other';
}

async function fetchOneBbox(
  apiKey: string,
  region: string,
  bbox: [number, number, number, number],
): Promise<IntelEvent[]> {
  const [w, s, e, n] = bbox;
  const url = `${FIRMS_BASE}/${apiKey}/VIIRS_SNPP_NRT/${w},${s},${e},${n}/1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'east-vantage/0.2 (research)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`FIRMS ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const csv = await res.text();
  const rows = parseCsv(csv);

  return rows.map((r) => {
    const ts = `${r.acqDate}T${r.acqTime.padStart(4, '0').slice(0, 2)}:${r.acqTime.padStart(4, '0').slice(2)}:00Z`;
    return {
      id: `firms-${r.acqDate}-${r.acqTime}-${r.lat.toFixed(3)}-${r.lon.toFixed(3)}`,
      title: `Thermal anomaly · FRP ${r.frp.toFixed(1)} MW`,
      summary: `VIIRS ${r.satellite} · confidence ${r.confidence} · ${r.daynight === 'N' ? 'night' : 'day'} pass`,
      category: 'satellite' as const,
      severity: severityFromFrp(r.frp),
      region: regionFromBbox(region),
      lat: r.lat,
      lon: r.lon,
      timestamp: ts,
      source: 'NASA FIRMS',
      sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/',
      tags: ['thermal', `frp:${Math.round(r.frp)}MW`, r.daynight === 'N' ? 'night' : 'day'],
    };
  });
}

interface CacheEntry {
  events: IntelEvent[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<IntelEvent[]> | null = null;

export async function getFirmsEvents(): Promise<IntelEvent[]> {
  const apiKey = process.env.NASA_FIRMS_MAP_KEY;
  if (!apiKey) {
    throw new Error('NASA_FIRMS_MAP_KEY not set');
  }

  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = Promise.all(
      BBOXES.map((b) =>
        fetchOneBbox(apiKey, b.name, b.bbox).catch((err) => {
          console.warn(`[firms] ${b.name} failed:`, err);
          return [] as IntelEvent[];
        }),
      ),
    )
      .then((batches) => batches.flat())
      .finally(() => {
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

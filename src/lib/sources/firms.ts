import type { EventSeverity, EventRegion, IntelEvent } from '../types';

// NASA FIRMS — VIIRS + MODIS thermal-anomaly detections across the
// East Asia theater. Strict filter: confidence='h' AND FRP >= 10 MW.
// This drops virtually all agricultural-burning noise and keeps only
// large industrial flares, structure fires, refinery activity, and
// other strong heat signatures.
//
// API: https://firms.modaps.eosdis.nasa.gov/api/area/
// Limits: 5000 transactions per 10 min per MAP_KEY. Each call is
// (sensor × bbox × day_range). We aggregate ~14 bboxes × 3 sensors
// per refresh; with the 10-min cache we stay well inside the budget.

const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

const SENSORS = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT'] as const;
type Sensor = (typeof SENSORS)[number];

interface Bbox {
  name: string;
  region: EventRegion;
  west: number;
  south: number;
  east: number;
  north: number;
}

// FIRMS area API caps each bbox at 10° × 10°. Larger regions split.
const BBOXES: Bbox[] = [
  // Korean peninsula (DPRK + ROK)
  { name: 'korea',           region: 'korean-peninsula', west: 124, south: 33, east: 131, north: 43 },
  // Taiwan
  { name: 'taiwan',          region: 'taiwan-strait',    west: 117, south: 21, east: 124, north: 29 },
  // Japan (3 splits)
  { name: 'japan-west',      region: 'japan',            west: 129, south: 30, east: 139, north: 38 },
  { name: 'japan-east',      region: 'japan',            west: 137, south: 33, east: 147, north: 41 },
  { name: 'japan-hokkaido',  region: 'japan',            west: 139, south: 41, east: 146, north: 46 },
  // China — east coast
  { name: 'china-coast-s',   region: 'china-mainland',   west: 108, south: 18, east: 118, north: 28 },
  { name: 'china-coast-c',   region: 'china-mainland',   west: 114, south: 26, east: 124, north: 36 },
  { name: 'china-coast-n',   region: 'china-mainland',   west: 114, south: 34, east: 124, north: 43 },
  // China — northeast (Heilongjiang, Jilin near DPRK)
  { name: 'china-ne',        region: 'china-mainland',   west: 118, south: 40, east: 134, north: 50 },
  // China — central / interior
  { name: 'china-central',   region: 'china-mainland',   west: 100, south: 25, east: 114, north: 35 },
  { name: 'china-south',     region: 'china-mainland',   west: 97,  south: 21, east: 108, north: 30 },
  { name: 'china-inner-mong',region: 'china-mainland',   west: 95,  south: 38, east: 115, north: 48 },
  // China — west (Xinjiang, Gansu, Tibet)
  { name: 'china-xinjiang-e',region: 'china-mainland',   west: 85,  south: 35, east: 100, north: 48 },
  { name: 'china-xinjiang-w',region: 'china-mainland',   west: 73,  south: 35, east: 87,  north: 48 },
  { name: 'china-tibet',     region: 'china-mainland',   west: 78,  south: 27, east: 100, north: 37 },
];

interface FirmsRow {
  lat: number;
  lon: number;
  frp: number;
  acqDate: string;
  acqTime: string;
  confidence: string; // 'l' | 'n' | 'h' for VIIRS; numeric for MODIS
  daynight: string;
  sensor: Sensor;
}

// Confidence rules differ between sensors:
//   - VIIRS_SNPP / NOAA20: 'l' | 'n' | 'h'
//   - MODIS: numeric 0-100; >=80 considered high
function isHighConfidence(conf: string, sensor: Sensor): boolean {
  if (sensor.startsWith('VIIRS')) return conf === 'h' || conf === 'high';
  // MODIS numeric
  const n = parseFloat(conf);
  return !isNaN(n) && n >= 80;
}

function parseCsv(csv: string, sensor: Sensor): FirmsRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
  const iLat = header.indexOf('latitude');
  const iLon = header.indexOf('longitude');
  // VIIRS uses bright_ti4/ti5; MODIS uses brightness. We don't display it
  // so any column we have access to is fine — fall back to 0.
  const iAcqD = header.indexOf('acq_date');
  const iAcqT = header.indexOf('acq_time');
  const iConf = header.indexOf('confidence');
  const iFrp = header.indexOf('frp');
  const iDn = header.indexOf('daynight');

  const rows: FirmsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < header.length) continue;
    rows.push({
      lat: parseFloat(parts[iLat]),
      lon: parseFloat(parts[iLon]),
      frp: parseFloat(parts[iFrp]) || 0,
      acqDate: parts[iAcqD],
      acqTime: parts[iAcqT],
      confidence: parts[iConf] ?? '',
      daynight: parts[iDn] ?? 'D',
      sensor,
    });
  }
  return rows;
}

function severityFromFrp(frp: number): EventSeverity {
  if (frp >= 500) return 'critical';
  if (frp >= 100) return 'high';
  if (frp >= 30) return 'medium';
  if (frp >= 10) return 'low';
  return 'info';
}

async function fetchOne(apiKey: string, sensor: Sensor, bbox: Bbox): Promise<FirmsRow[]> {
  const url = `${FIRMS_BASE}/${apiKey}/${sensor}/${bbox.west},${bbox.south},${bbox.east},${bbox.north}/1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'east-vantage/0.3 (research)' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[firms] ${sensor} ${bbox.name} HTTP ${res.status}`);
      return [];
    }
    return parseCsv(await res.text(), sensor);
  } catch (err) {
    console.warn(`[firms] ${sensor} ${bbox.name} fetch failed:`, err);
    return [];
  }
}

function rowsToEvents(rows: FirmsRow[], bbox: Bbox): IntelEvent[] {
  const events: IntelEvent[] = [];
  for (const r of rows) {
    // Strict filter — conf=h AND FRP>=10. Drops ~99% of routine ag/noise.
    if (r.frp < 10) continue;
    if (!isHighConfidence(r.confidence, r.sensor)) continue;

    const time4 = r.acqTime.padStart(4, '0');
    const ts = `${r.acqDate}T${time4.slice(0, 2)}:${time4.slice(2)}:00Z`;
    events.push({
      id: `firms-${r.sensor}-${r.acqDate}-${r.acqTime}-${r.lat.toFixed(3)}-${r.lon.toFixed(3)}`,
      title: `Thermal anomaly · FRP ${r.frp.toFixed(1)} MW (${r.sensor.replace('_NRT', '')})`,
      summary: `${bbox.name} · confidence ${r.confidence} · ${r.daynight === 'N' ? 'night' : 'day'} pass`,
      category: 'satellite',
      severity: severityFromFrp(r.frp),
      region: bbox.region,
      lat: r.lat,
      lon: r.lon,
      timestamp: ts,
      source: 'NASA FIRMS',
      sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/',
      tags: ['thermal', `frp:${Math.round(r.frp)}MW`, `sat:${r.sensor.replace(/_NRT$/, '')}`, r.daynight === 'N' ? 'night' : 'day'],
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

export async function getFirmsEvents(): Promise<IntelEvent[]> {
  const apiKey = process.env.NASA_FIRMS_MAP_KEY;
  if (!apiKey) throw new Error('NASA_FIRMS_MAP_KEY not set');

  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = (async () => {
      // Parallel fetch all (sensor × bbox) combinations.
      const tasks: Promise<IntelEvent[]>[] = [];
      for (const bbox of BBOXES) {
        for (const sensor of SENSORS) {
          tasks.push(fetchOne(apiKey, sensor, bbox).then((rows) => rowsToEvents(rows, bbox)));
        }
      }
      const batches = await Promise.all(tasks);
      // Dedupe across sensors — two satellites can see the same fire.
      // Key by rounded coord + acq_date.
      const seen = new Set<string>();
      const merged: IntelEvent[] = [];
      for (const events of batches) {
        for (const e of events) {
          const key = `${e.timestamp.slice(0, 10)}-${e.lat.toFixed(2)}-${e.lon.toFixed(2)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(e);
        }
      }
      return merged;
    })().finally(() => {
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

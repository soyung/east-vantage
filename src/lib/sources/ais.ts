import type { EventSeverity, IntelEvent } from '../types';

// AISStream.io — free, real-time global AIS feed via WebSocket. Their
// stream is unauthenticated-per-request (you do need a free API key) and
// genuinely free in their stated free tier. Because Vercel serverless
// functions are short-lived, we open a WebSocket, listen for ~5 seconds,
// capture every ship position we see in our East Asia bounding boxes,
// then close. This gives a snapshot, not a continuous stream.
//
// Signup: https://aisstream.io/ → free API key by email. Set
// AISSTREAM_KEY in env. Without the key this source is skipped silently.

const SNAPSHOT_DURATION_MS = 6_000;
const TOTAL_DEADLINE_MS = 12_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

// AISStream bounding boxes are [[sw_lat, sw_lon], [ne_lat, ne_lon]].
// One big East Asia box keeps the message volume manageable in 6 s.
const EAST_ASIA_BBOX: [[number, number], [number, number]] = [
  [18, 100],
  [50, 146],
];

interface AisShip {
  mmsi: number;
  name: string;
  type: number; // AIS ship type code
  lat: number;
  lon: number;
  sog?: number; // speed over ground (knots)
  cog?: number; // course over ground (deg)
  heading?: number;
  ts: number;
}

// Ship-type codes that suggest military / law enforcement / cargo-tanker
// (high-interest for OSINT). 30+ list: most commercial fishing/yachts
// fall outside this and are dropped to avoid noise.
//
// AIS ship type 35 = "Military operations", 55 = "Law enforcement"
// 80–89 = Tankers, 70–79 = Cargo
function isOfInterest(type: number, name: string): boolean {
  if (type === 35 || type === 55) return true; // military / LE
  if (type >= 80 && type <= 89) return true; // tankers
  if (type >= 70 && type <= 79) return true; // cargo
  // Naval/coast-guard names regardless of type code
  if (/CGS|CCG|JCG|ROKN|ROCN|USS|JS\b|CNS\b|PLA/i.test(name)) return true;
  return false;
}

function regionFor(lat: number, lon: number): IntelEvent['region'] {
  if (lon >= 117 && lon <= 124 && lat >= 21 && lat <= 29) return 'taiwan-strait';
  if (lon >= 124 && lon <= 131 && lat >= 33 && lat <= 43) return 'korean-peninsula';
  if (lon >= 129 && lon <= 146 && lat >= 30 && lat <= 46) return 'japan';
  if (lon >= 73 && lon <= 135 && lat >= 18 && lat <= 53) return 'china-mainland';
  return 'other';
}

function severityFor(type: number, name: string): EventSeverity {
  if (type === 35 || /USS|ROKN|ROCN|PLA navy/i.test(name)) return 'high';
  if (type === 55 || /CCG|JCG|CGS/i.test(name)) return 'medium';
  return 'low';
}

function typeLabel(type: number): string {
  if (type === 30) return 'fishing';
  if (type === 35) return 'military';
  if (type === 55) return 'law enforcement';
  if (type >= 70 && type <= 79) return 'cargo';
  if (type >= 80 && type <= 89) return 'tanker';
  if (type >= 60 && type <= 69) return 'passenger';
  return `type ${type}`;
}

async function snapshotAisStream(apiKey: string): Promise<AisShip[]> {
  const ships = new Map<number, AisShip>();
  return new Promise<AisShip[]>((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    const stop = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve([...ships.values()]);
    }, SNAPSHOT_DURATION_MS);
    const deadline = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('AIS snapshot deadline'));
    }, TOTAL_DEADLINE_MS);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [EAST_ASIA_BBOX],
          FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
        }),
      );
    };

    ws.onmessage = (evt) => {
      try {
        const data = typeof evt.data === 'string' ? evt.data : evt.data.toString();
        const m = JSON.parse(data);
        // Two flavors: Position (lat/lon/sog/cog) and Static (name/type)
        if (m.MessageType === 'PositionReport') {
          const r = m.Message?.PositionReport;
          const mmsi = r?.UserID;
          if (!mmsi || typeof r.Latitude !== 'number') return;
          const prev = ships.get(mmsi) ?? {
            mmsi, name: '', type: 0,
            lat: r.Latitude, lon: r.Longitude, ts: Date.now(),
          };
          ships.set(mmsi, {
            ...prev,
            lat: r.Latitude,
            lon: r.Longitude,
            sog: r.Sog,
            cog: r.Cog,
            heading: r.TrueHeading,
            ts: Date.now(),
          });
        } else if (m.MessageType === 'ShipStaticData') {
          const r = m.Message?.ShipStaticData;
          const mmsi = r?.UserID;
          if (!mmsi) return;
          const prev = ships.get(mmsi);
          if (!prev) return; // only update ships we already have a position for
          ships.set(mmsi, {
            ...prev,
            name: (r.Name ?? '').trim(),
            type: r.Type ?? prev.type,
          });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(stop);
      clearTimeout(deadline);
      reject(new Error('AIS WebSocket error'));
    };
  });
}

function shipsToEvents(ships: AisShip[]): IntelEvent[] {
  const events: IntelEvent[] = [];
  for (const s of ships) {
    if (!isOfInterest(s.type, s.name)) continue;
    const region = regionFor(s.lat, s.lon);
    events.push({
      id: `ais-${s.mmsi}`,
      title: `${s.name || `MMSI ${s.mmsi}`} · ${typeLabel(s.type)}`,
      summary: `AIS · ${typeLabel(s.type)}${
        s.sog !== undefined ? ` · ${s.sog.toFixed(1)} kt` : ''
      }${s.cog !== undefined ? ` · course ${Math.round(s.cog)}°` : ''}`,
      category: 'naval',
      severity: severityFor(s.type, s.name),
      region,
      lat: s.lat,
      lon: s.lon,
      timestamp: new Date(s.ts).toISOString(),
      source: 'AISStream',
      sourceUrl: `https://www.vesselfinder.com/vessels?name=&mmsi=${s.mmsi}`,
      tags: [`mmsi:${s.mmsi}`, `type:${s.type}`],
      headingDeg: s.heading ?? s.cog,
      speedKt: s.sog,
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

export async function getAisEvents(): Promise<IntelEvent[]> {
  const apiKey = process.env.AISSTREAM_KEY;
  if (!apiKey) throw new Error('AISSTREAM_KEY not set');

  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = snapshotAisStream(apiKey)
      .then(shipsToEvents)
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

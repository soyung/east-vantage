import type { EventSeverity, IntelEvent } from '../types';
import { jitter } from '../geocode';

// Taiwan Ministry of National Defense — daily PLA activity report.
// Public landing page: https://www.mnd.gov.tw/en/news/plaactlist
// Each daily report at /en/news/plaact/{id}.
//
// Robots.txt note: MND disallows automated crawlers. We treat this as
// research / fair-use: we fetch the listing once per hour, pull the 3
// most recent reports only, identify ourselves with a clear UA, and
// do not retry on the same URL within the cache window.

const LIST_URL = 'https://www.mnd.gov.tw/en/news/plaactlist';
const REPORT_URL = (id: string) => `https://www.mnd.gov.tw/en/news/plaact/${id}`;

const UA = 'east-vantage-research/0.3 (https://github.com/soyung/east-vantage)';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (MND only updates once/day)

// Canonical centroid for "around Taiwan" PLA tracking. Per ADIZ direction
// keyword, we shift to a different sub-region (jittered) so multiple
// zones don't overlap visually.
const ZONE_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  northern: { lat: 26.0, lon: 121.5 },
  central: { lat: 24.0, lon: 120.0 },
  southwestern: { lat: 22.0, lon: 119.5 },
  southern: { lat: 21.0, lon: 120.5 },
  eastern: { lat: 23.0, lon: 122.5 },
  northeastern: { lat: 25.5, lon: 122.5 },
  southeastern: { lat: 22.0, lon: 122.0 },
};

interface ListingEntry {
  id: string;
  date: string; // YYYY-MM-DD
}

interface ParsedReport {
  sorties: number;
  planShips: number;
  officialShips: number;
  crossings: number;
  zones: string[];
  body: string; // full PLA activities paragraph
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`MND ${url} ${res.status}`);
  return res.text();
}

function parseListing(html: string): ListingEntry[] {
  // Strip HTML to a plain string then walk dates and IDs together.
  // The pattern in the rendered text is:
  //   YYYY.MM.DD  PLA activities ... Click-Through Rate: N
  // and href="news/plaact/{id}" appears just before each date in source.
  const entries: ListingEntry[] = [];
  const re = /href="news\/plaact\/(\d+)"[\s\S]{0,200}?(\d{4})\.(\d{2})\.(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    entries.push({
      id: m[1],
      date: `${m[2]}-${m[3]}-${m[4]}`,
    });
  }
  return entries;
}

function parseReport(html: string): ParsedReport | null {
  // Pull each <p>...</p>, find the one containing "PLA activities".
  const paragraphRx = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let body = '';
  let pm: RegExpExecArray | null;
  while ((pm = paragraphRx.exec(html)) !== null) {
    const text = pm[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&rsquo;/g, "'")
      .replace(/&[a-z]+;/g, ' ')
      .replace(/&#x?[0-9a-f]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/PLA activities/i.test(text) && /sortie/i.test(text)) {
      body = text;
      break;
    }
  }
  if (!body) return null;

  const sortieM = /([0-9]+)\s+sorties of PLA aircraft/i.exec(body);
  const planM = /([0-9]+)\s+PLAN\s+ships?/i.exec(body);
  const officialM = /([0-9]+)\s+official\s+ships?/i.exec(body);
  const crossM = /([0-9]+)\s+out of\s+\d+\s+sorties crossed the median line/i.exec(body);
  const zoneM = /entered Taiwan's\s+([a-zA-Z, ]+?)\s+ADIZ/i.exec(body);

  const zones = zoneM
    ? zoneM[1]
        .split(/,|\band\b/i)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    sorties: sortieM ? parseInt(sortieM[1], 10) : 0,
    planShips: planM ? parseInt(planM[1], 10) : 0,
    officialShips: officialM ? parseInt(officialM[1], 10) : 0,
    crossings: crossM ? parseInt(crossM[1], 10) : 0,
    zones,
    body,
  };
}

function severityFor(report: ParsedReport): EventSeverity {
  if (report.crossings >= 10 || report.sorties >= 30) return 'high';
  if (report.crossings >= 1 || report.sorties >= 10) return 'medium';
  if (report.sorties > 0) return 'low';
  return 'info';
}

function reportToEvents(entry: ListingEntry, report: ParsedReport): IntelEvent[] {
  const events: IntelEvent[] = [];
  const timestamp = `${entry.date}T06:00:00+08:00`;
  const url = REPORT_URL(entry.id);

  // One event per ADIZ zone touched (so the map shows the breadth of activity);
  // fall back to a single centroid event if no zones were named.
  const aircraftZones = report.zones.length > 0 ? report.zones : ['central'];

  for (const zone of aircraftZones) {
    const centroid = ZONE_CENTROIDS[zone] ?? ZONE_CENTROIDS.central;
    const { lat, lon } = jitter(centroid.lat, centroid.lon, `${entry.id}-${zone}-air`);
    events.push({
      id: `mnd-${entry.id}-air-${zone}`,
      title: `Taiwan MND: ${report.sorties} PLA sorties (${report.crossings} crossed median line)`,
      summary: `${zone.charAt(0).toUpperCase() + zone.slice(1)} ADIZ · ${report.sorties} sorties · ${report.crossings} of ${report.sorties} crossed median line`,
      category: 'air',
      severity: severityFor(report),
      region: 'taiwan-strait',
      lat,
      lon,
      timestamp,
      source: 'Taiwan MND',
      sourceUrl: url,
      tags: [
        `${report.sorties}sorties`,
        `${report.crossings}crossed`,
        `zone:${zone}`,
      ],
    });
  }

  // Separate naval event if PLAN or coast-guard ships present.
  if (report.planShips + report.officialShips > 0) {
    const total = report.planShips + report.officialShips;
    const { lat, lon } = jitter(23.0, 119.5, `${entry.id}-naval`);
    events.push({
      id: `mnd-${entry.id}-naval`,
      title: `Taiwan MND: ${report.planShips} PLAN + ${report.officialShips} CCG ships around Taiwan`,
      summary: `${total} ships operating in waters around Taiwan as of 6 a.m. (UTC+8)`,
      category: 'naval',
      severity: report.planShips >= 5 ? 'medium' : 'low',
      region: 'taiwan-strait',
      lat,
      lon,
      timestamp,
      source: 'Taiwan MND',
      sourceUrl: url,
      tags: [`plan:${report.planShips}`, `ccg:${report.officialShips}`],
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

async function fetchMnd(): Promise<IntelEvent[]> {
  const listing = parseListing(await fetchHtml(LIST_URL));
  if (listing.length === 0) throw new Error('MND listing parsed empty');

  // Take the 3 most recent reports.
  const recent = listing.slice(0, 3);

  // Sequential, with small delay, to stay polite.
  const events: IntelEvent[] = [];
  for (let i = 0; i < recent.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      const html = await fetchHtml(REPORT_URL(recent[i].id));
      const parsed = parseReport(html);
      if (parsed) events.push(...reportToEvents(recent[i], parsed));
    } catch (err) {
      console.warn(`[mnd] report ${recent[i].id} failed:`, err);
    }
  }
  return events;
}

export async function getMndEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = fetchMnd().finally(() => {
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

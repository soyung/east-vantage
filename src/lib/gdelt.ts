import type { EventCategory, EventSeverity, IntelEvent } from './types';
import { geocode, jitter } from './geocode';

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Single combined query covering Taiwan + Korea, kept under GDELT's ~250-char
// query length limit. One query means one HTTP request — avoids the
// "1 req per 5s" rate limit and keeps us inside Vercel's function timeout.
const QUERY =
  '("taiwan strait" OR "pla aircraft" OR "north korea" OR pyongyang OR yongbyon OR "korean peninsula" OR senkaku) (military OR missile OR launch OR aircraft OR navy OR sanction)';

const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface GdeltArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string; // YYYYMMDDTHHMMSSZ
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltDocResponse {
  articles?: GdeltArticle[];
}

const CATEGORY_RULES: Array<[RegExp, EventCategory]> = [
  [/missile|launch|projectile|icbm|srbm|cruise|hwasong|ballistic/i, 'missile'],
  [/aircraft|fighter|adiz|j-?\d+|jet|airspace|airfield|sortie|incursion|scramble/i, 'air'],
  [/navy|naval|carrier|warship|coast guard|frigate|destroyer|submarine|vessel|ship|fleet/i, 'naval'],
  [/cyber|hack|apt|intrusion|malware|breach|phishing/i, 'cyber'],
  [/satellite|imagery|firms|thermal|reactor|enrichment/i, 'satellite'],
  [/sanction|tariff|export control|trade|economic|semiconductor|chip/i, 'economic'],
  [/summit|meeting|talks|diplomatic|ambassador|envoy|treaty|joint statement/i, 'diplomatic'],
];

function classifyCategory(text: string): EventCategory {
  for (const [rx, cat] of CATEGORY_RULES) if (rx.test(text)) return cat;
  return 'diplomatic';
}

function classifySeverity(text: string): EventSeverity {
  if (/\b(icbm|nuclear test|war|invasion|attack|killed)\b/i.test(text)) return 'critical';
  if (/\b(launch|missile|incursion|scramble|breach|sanction)\b/i.test(text)) return 'high';
  if (/\b(exercise|drill|patrol|protest|warning)\b/i.test(text)) return 'medium';
  if (/\b(meeting|statement|comment|remark)\b/i.test(text)) return 'low';
  return 'info';
}

function parseGdeltDate(s: string): string {
  if (!/^\d{8}T\d{6}Z$/.test(s)) return new Date().toISOString();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
}

function dedupeKey(a: GdeltArticle): string {
  try {
    const u = new URL(a.url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return a.url;
  }
}

function articlesToEvents(articles: GdeltArticle[]): IntelEvent[] {
  const seen = new Set<string>();
  const events: IntelEvent[] = [];
  for (const a of articles) {
    const key = dedupeKey(a);
    if (seen.has(key)) continue;
    seen.add(key);
    const hit = geocode(a.title, a.sourcecountry);
    if (!hit) continue;
    const { lat, lon } = jitter(hit.lat, hit.lon, a.url);
    events.push({
      id: `gdelt-${key}`,
      title: a.title.trim(),
      summary: `${a.domain ?? 'unknown source'} · ${a.sourcecountry ?? '?'}${a.language ? ` · ${a.language}` : ''}`,
      category: classifyCategory(a.title),
      severity: classifySeverity(a.title),
      region: hit.region,
      lat,
      lon,
      timestamp: parseGdeltDate(a.seendate),
      source: 'GDELT 2.0',
      sourceUrl: a.url,
    });
  }
  return events;
}

async function fetchArticles(): Promise<GdeltArticle[]> {
  const url = new URL(GDELT_DOC);
  url.searchParams.set('query', QUERY);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('format', 'JSON');
  url.searchParams.set('maxrecords', '75');
  url.searchParams.set('timespan', '24h');
  url.searchParams.set('sort', 'datedesc');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'east-vantage/0.1 (research)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GDELT ${res.status}: ${body.slice(0, 200)}`);
  }
  const text = await res.text();
  try {
    const data = JSON.parse(text) as GdeltDocResponse;
    return data.articles ?? [];
  } catch {
    throw new Error(`GDELT returned non-JSON: ${text.slice(0, 200)}`);
  }
}

// In-memory cache that survives within a warm serverless container.
// Concurrent invocations to the same container share it, so we don't hammer
// GDELT. Different containers will each fetch once.
interface CacheEntry {
  events: IntelEvent[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<IntelEvent[]> | null = null;

export interface FetchResult {
  events: IntelEvent[];
  fromCache: 'fresh' | 'stale' | 'none';
  error?: string;
}

export async function getEvents(): Promise<FetchResult> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return { events: cache.events, fromCache: 'fresh' };
  }

  // Coalesce concurrent callers in the same container.
  if (!inflight) {
    inflight = fetchArticles()
      .then((articles) => articlesToEvents(articles))
      .finally(() => {
        inflight = null;
      });
  }

  try {
    const events = await inflight;
    if (events.length > 0) {
      cache = { events, at: now };
    }
    return { events, fromCache: 'none' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (cache) {
      // Stale-while-error: better to show old GDELT data than sample.
      return { events: cache.events, fromCache: 'stale', error: message };
    }
    throw err;
  }
}

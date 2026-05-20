import type { EventCategory, EventSeverity, IntelEvent } from './types';
import { geocode, jitter } from './geocode';

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Vercel hobby plan has 10s default function timeout (60s if maxDuration is
// raised). We must stay well inside that — one short retry only.
async function fetchOnce(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

// GDELT DOC query max length is ~250 chars. Split into two narrower queries
// (Taiwan and Korea) and merge — keeps each below the limit and stays specific.
const QUERIES = [
  '("taiwan strait" OR "taiwan adiz" OR "pla aircraft" OR "median line" OR senkaku) (military OR missile OR aircraft OR navy OR incursion)',
  '("north korea" OR pyongyang OR yongbyon OR dprk OR "korean peninsula") (missile OR launch OR icbm OR test OR sanction OR exercise)',
];

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

// Heuristic severity: certain keywords bump it up.
function classifySeverity(text: string): EventSeverity {
  if (/\b(icbm|nuclear test|war|invasion|attack|killed)\b/i.test(text)) return 'critical';
  if (/\b(launch|missile|incursion|scramble|breach|sanction)\b/i.test(text)) return 'high';
  if (/\b(exercise|drill|patrol|protest|warning)\b/i.test(text)) return 'medium';
  if (/\b(meeting|statement|comment|remark)\b/i.test(text)) return 'low';
  return 'info';
}

function parseGdeltDate(s: string): string {
  // "20260520T071500Z" → "2026-05-20T07:15:00Z"
  if (!/^\d{8}T\d{6}Z$/.test(s)) return new Date().toISOString();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
}

function dedupeKey(a: GdeltArticle): string {
  // Strip query string from URL to merge variants of the same article
  try {
    const u = new URL(a.url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return a.url;
  }
}

async function fetchOneQuery(
  query: string,
  timespan: string,
  max: number,
  timeoutMs: number,
): Promise<GdeltArticle[]> {
  const url = new URL(GDELT_DOC);
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('format', 'JSON');
  url.searchParams.set('maxrecords', String(max));
  url.searchParams.set('timespan', timespan);
  url.searchParams.set('sort', 'datedesc');

  const res = await fetchOnce(
    url.toString(),
    { headers: { 'User-Agent': 'east-vantage/0.1 (research)' } },
    timeoutMs,
  );
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

export async function fetchGdeltEvents(opts?: { timespan?: string; max?: number }): Promise<IntelEvent[]> {
  const timespan = opts?.timespan ?? '24h';
  const max = opts?.max ?? 50;

  // Run the two queries with a small delay between them to respect GDELT's
  // "one request per 5 seconds" guidance. Even if the second fails, return
  // the first one's results.
  const errors: string[] = [];
  const allArticles: GdeltArticle[] = [];

  for (let i = 0; i < QUERIES.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 5500));
    try {
      const articles = await fetchOneQuery(QUERIES[i], timespan, max, 7000);
      allArticles.push(...articles);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (allArticles.length === 0) {
    throw new Error(`GDELT returned no articles. ${errors.join(' | ')}`);
  }

  const seen = new Set<string>();
  const events: IntelEvent[] = [];

  for (const a of allArticles) {
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

import type { EventCategory, EventSeverity, IntelEvent } from '../types';
import { geocode, jitter } from '../geocode';

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Tighter query — every clause includes at least one kinetic anchor so we
// don't pull generic op-eds. ~210 chars (under GDELT's 250 limit).
const QUERY =
  '("taiwan strait" OR "pla aircraft" OR "north korea" OR pyongyang OR yongbyon OR senkaku) (missile OR launch OR sortie OR scramble OR incursion OR drill OR exercise OR "median line" OR breach)';

// Title must contain at least one of these tokens or we drop the article.
// This catches the common case where a vague op-ed mentions the region +
// "exercise" / "military" but isn't actually about an incident.
const TITLE_KEYWORD_RX =
  /(missile|launch|aircraft|sortie|scramble|incursion|drill|exercise|breach|crossed|fire|test|naval|vessel|warship|carrier|adiz|median line|warning)/i;

const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface GdeltArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string;
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
  [/aircraft|fighter|adiz|j-?\d+|jet|airspace|airfield|sortie|incursion|scramble|crossed median/i, 'air'],
  [/navy|naval|carrier|warship|coast guard|frigate|destroyer|submarine|vessel|ship|fleet/i, 'naval'],
  [/cyber|hack|apt|intrusion|malware|breach|phishing/i, 'cyber'],
  [/satellite|imagery|firms|thermal|reactor|enrichment|fuel rod/i, 'satellite'],
];

// Returns null when no specific kinetic category matches — we deliberately
// drop those (previously they were silently bucketed as "diplomatic").
function classifyCategory(text: string): EventCategory | null {
  for (const [rx, cat] of CATEGORY_RULES) if (rx.test(text)) return cat;
  return null;
}

function classifySeverity(text: string): EventSeverity {
  if (/\b(icbm|nuclear test|war|invasion|attack|killed)\b/i.test(text)) return 'critical';
  if (/\b(launch|missile|incursion|scramble|breach)\b/i.test(text)) return 'high';
  if (/\b(exercise|drill|patrol|sortie|warning|crossed)\b/i.test(text)) return 'medium';
  return 'low';
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
    if (!TITLE_KEYWORD_RX.test(a.title)) continue;
    const category = classifyCategory(a.title);
    if (!category) continue;

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
      category,
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
    headers: { 'User-Agent': 'east-vantage/0.2 (research)' },
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

interface CacheEntry {
  events: IntelEvent[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<IntelEvent[]> | null = null;

export async function getGdeltEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = fetchArticles()
      .then(articlesToEvents)
      .finally(() => {
        inflight = null;
      });
  }

  try {
    const events = await inflight;
    cache = { events, at: now };
    return events;
  } catch (err) {
    if (cache) return cache.events; // stale-while-error
    throw err;
  }
}

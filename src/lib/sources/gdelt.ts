import { Agent, fetch as undiciFetch } from 'undici';
import type { EventCategory, EventSeverity, IntelEvent } from '../types';
import { geocode, jitter } from '../geocode';

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Node's built-in fetch (undici) defaults to a 10s TCP connect timeout, and
// the path from Vercel SFO to api.gdeltproject.org regularly exceeds that.
// Dedicated dispatcher with longer connect window solves it without
// affecting other fetches.
const gdeltDispatcher = new Agent({
  connect: { timeout: 25_000 },
  bodyTimeout: 25_000,
  headersTimeout: 25_000,
});

// Expanded query — covers all E Asia (Taiwan/Korea/Japan/China) with
// kinetic anchor. GDELT caps query length at ~250 chars; this is ~240.
const QUERY =
  '("taiwan strait" OR "pla aircraft" OR "north korea" OR pyongyang OR yongbyon OR senkaku OR "kadena" OR "jsdf" OR "yokota" OR "jiuquan" OR "xichang" OR plaaf) (missile OR launch OR sortie OR scramble OR incursion OR drill OR "median line" OR breach)';

// Title must contain at least one kinetic keyword. Includes CJK terms so
// that Chinese/Japanese/Korean wire coverage (which dominates East Asia
// reporting) doesn't get silently dropped.
const TITLE_KEYWORD_RX = new RegExp(
  [
    // English
    'missile', 'launch', 'aircraft', 'sortie', 'scramble', 'incursion', 'drill',
    'exercise', 'breach', 'crossed', 'fire', 'test', 'naval', 'vessel',
    'warship', 'carrier', 'adiz', 'median line', 'warning', 'patrol',
    // Chinese (Traditional + Simplified)
    '飛彈', '导弹', '飞弹', '發射', '发射', '戰機', '战机', '軍機', '军机',
    '軍演', '军演', '演習', '演习', '艦', '舰', '航母', '驱逐舰', '驅逐艦',
    '解放軍', '解放军', '海警', '海軍', '海军', '空軍', '空军', '入侵', '越界',
    '中線', '中线', '防空識別', '防空识别', '巡邏', '巡逻', '試射', '试射',
    // Korean
    '미사일', '발사', '항공기', '함정', '훈련', '도발', '영공', '침범',
    '핵실험', '발사체', '전투기', '구축함',
    // Japanese
    'ミサイル', '発射', '戦闘機', '巡視船', '訓練', '領空', '演習', '艦艇',
  ].join('|'),
  'i',
);

const REQUEST_TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 15 * 60 * 1000;
// After a non-rate-limit error (timeout, parse, etc.) wait 2 min.
const FAILURE_COOLDOWN_MS = 2 * 60 * 1000;
// 429 is a normal occurrence on shared egress IPs — wait shorter and don't
// bubble up as a hard error.
const RATELIMIT_COOLDOWN_MS = 90 * 1000;

class GdeltRateLimitError extends Error {
  constructor() {
    super('rate-limited');
    this.name = 'GdeltRateLimitError';
  }
}

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
  [
    /missile|launch|projectile|icbm|srbm|cruise|hwasong|ballistic|飛彈|导弹|飞弹|미사일|발사|ミサイル|発射|試射|试射/i,
    'missile',
  ],
  [
    /aircraft|fighter|adiz|j-?\d+|jet|airspace|airfield|sortie|incursion|scramble|crossed median|戰機|战机|軍機|军机|空軍|空军|防空|항공기|영공|전투기|戦闘機|領空|中線|中线/i,
    'air',
  ],
  [
    /navy|naval|carrier|warship|coast guard|frigate|destroyer|submarine|vessel|ship|fleet|艦|舰|海軍|海军|海警|航母|驱逐舰|驅逐艦|함정|구축함|巡視船|艦艇/i,
    'naval',
  ],
  [/cyber|hack|apt|intrusion|malware|breach|phishing/i, 'cyber'],
  [
    /satellite|imagery|firms|thermal|reactor|enrichment|fuel rod|衛星|卫星|위성|衛星画像/i,
    'satellite',
  ],
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

  const res = await undiciFetch(url.toString(), {
    headers: { 'User-Agent': 'east-vantage/0.2 (research)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    dispatcher: gdeltDispatcher,
  });
  // GDELT sometimes returns 429 in body but 200 in status; check both.
  if (res.status === 429) {
    throw new GdeltRateLimitError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GDELT ${res.status}: ${body.slice(0, 200)}`);
  }
  const text = await res.text();
  // Sometimes GDELT replies 200 with a plain-text "Please limit requests..."
  // body instead of JSON. Detect and treat as 429.
  if (/limit requests to one every/i.test(text)) {
    throw new GdeltRateLimitError();
  }
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
let nextAttemptAfter = 0;

export async function getGdeltEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (now < nextAttemptAfter) {
    if (cache) return cache.events;
    throw new Error('GDELT in cooldown after recent failure');
  }

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
    if (err instanceof GdeltRateLimitError) {
      // Rate limit isn't a real failure of our system. Cool down briefly
      // and report an empty result (grey dot, not red).
      nextAttemptAfter = now + RATELIMIT_COOLDOWN_MS;
      return cache?.events ?? [];
    }
    nextAttemptAfter = now + FAILURE_COOLDOWN_MS;
    if (cache) return cache.events;
    throw err;
  }
}

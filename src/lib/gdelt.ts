import type { EventCategory, EventSeverity, IntelEvent } from './types';
import { geocode, jitter } from './geocode';

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    } catch (err) {
      lastErr = err;
      // Backoff: 1s, 3s
      await new Promise((r) => setTimeout(r, 1000 * (i + 1) * (i + 1)));
    }
  }
  throw lastErr;
}

// East Asia query: keep specific to avoid sports/celebrity false-positives.
// Wrap multi-word phrases in quotes per GDELT DOC syntax.
const QUERY = [
  '"taiwan strait"',
  '"taiwan adiz"',
  '"median line"',
  '"pla aircraft"',
  '"chinese aircraft" taiwan',
  '"chinese coast guard"',
  '"senkaku"',
  '"north korea" (missile OR launch OR icbm OR srbm OR test OR provocation)',
  '"kim jong un"',
  '"yongbyon"',
  '"korean peninsula"',
  '"dprk"',
  '"plan carrier"',
  '"plan navy"',
].join(' OR ');

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

export async function fetchGdeltEvents(opts?: { timespan?: string; max?: number }): Promise<IntelEvent[]> {
  const timespan = opts?.timespan ?? '24h';
  const max = opts?.max ?? 75;

  const url = new URL(GDELT_DOC);
  url.searchParams.set('query', QUERY);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('format', 'JSON');
  url.searchParams.set('maxrecords', String(max));
  url.searchParams.set('timespan', timespan);
  url.searchParams.set('sort', 'datedesc');

  const res = await fetchWithRetry(url.toString(), {
    headers: { 'User-Agent': 'east-vantage/0.1 (research)' },
  });
  if (!res.ok) throw new Error(`GDELT ${res.status}: ${await res.text().catch(() => '')}`);

  // GDELT sometimes returns invalid JSON when query is malformed; guard.
  const text = await res.text();
  let data: GdeltDocResponse;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`GDELT returned non-JSON: ${text.slice(0, 200)}`);
  }
  const articles = data.articles ?? [];

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

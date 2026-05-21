import type { EventCategory, EventSeverity, IntelEvent } from '../types';
import { geocode, jitter } from '../geocode';

// Reddit source. We use the .rss endpoint instead of .json because:
//   - Reddit aggressively rate-limits/blocks data-center IPs on JSON
//     (Vercel iad1 functions tend to hit those limits)
//   - .rss is the older Atom interface and remains generally accessible
//     without OAuth or specialty UA
//   - It carries everything we need: title, link, score (in description),
//     timestamp.

const UA = 'east-vantage/0.3 (research aggregator, contact via repo)';
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

const SUBREDDITS = [
  'CredibleDefense',
  'LessCredibleDefence',
  'aiwar',
  'IndoPacificNews',
  'korea',
  'taiwan',
  'japan_news',
  'China_irl',
];

const REGION_RX =
  /(taiwan|china|chinese|pla\b|plaaf|plan\b|adiz|tsmc|hsinchu|taipei|kaohsiung|north korea|dprk|kim jong|pyongyang|yongbyon|korean peninsula|south korea|seoul|busan|jeju|ieodo|japan|japanese|jsdf|yokota|kadena|misawa|iwakuni|sasebo|okinawa|senkaku|diaoyu|hong kong|beijing|shanghai|guangzhou|xinjiang|tibet|台|中|韓|朝|日|防空|海峡|미사일|북한|대만|중국|훈련|自衛隊)/i;
// Strong-only kinetic anchors (same posture as wires.ts — without an
// LLM gate we can't afford soft keywords).
const KINETIC_RX =
  /(missile|icbm|srbm|ballistic|hwasong|adiz|plaaf|plan navy|warship|aircraft carrier|frigate|destroyer|submarine|nuclear test|airspace (?:violation|incursion)|median line|cyber(?:attack|intrusion|attribution)|j-?\d{1,2}\b|f-?\d{1,2}\b|戰機|战机|軍機|军机|미사일|핵실험)/i;

const NEGATIVE_RX =
  /(working group|diplomat|envoy|summit|talks|cooperation|partnership|trade deal|economic\b|cultural|business owner|visa|immigration|migrant|refugee|tourism|tourist|celebrity|stock|earnings|finance|entertainment|drama|k-pop|sport|olympic|movie|film|festival)/i;

const CATEGORY_RULES: Array<[RegExp, EventCategory]> = [
  [/missile|projectile|icbm|srbm|cruise missile|hwasong|ballistic|launch(?:\s+(?:vehicle|pad|test|complex|of))/i, 'missile'],
  [/pla\s+aircraft|adiz (?:incursion|violation)|airspace (?:violation|incursion)|fighter scramble|crossed median|median line|j-?\d{1,2}\b|f-?\d{1,2}\b|戰機|战机|軍機|军机/i, 'air'],
  [/pla(n|\s+navy)|naval (?:vessel|exercise|drill)|warship|aircraft carrier|frigate|destroyer|submarine|coast guard (?:vessel|incursion)/i, 'naval'],
  [/(?:cyber|hack|apt|malware)(?:\s+(?:attack|intrusion|attribution|breach|campaign))/i, 'cyber'],
  [/satellite (?:imagery|image)|thermal anomaly|reactor (?:activity|test)|enrichment/i, 'satellite'],
];

function classifyCategory(text: string): EventCategory | null {
  for (const [rx, cat] of CATEGORY_RULES) if (rx.test(text)) return cat;
  return null;
}

function classifySeverity(text: string): EventSeverity {
  if (/\b(nuclear test|war|invasion|icbm|killed)\b/i.test(text)) return 'critical';
  if (/\b(launch|missile|incursion|breach|crossed)\b/i.test(text)) return 'high';
  if (/\b(exercise|drill|sortie|deploy|scramble)\b/i.test(text)) return 'medium';
  return 'low';
}

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface RssEntry {
  title: string;
  link: string;
  published: string;
}

function parseAtom(xml: string): RssEntry[] {
  const out: RssEntry[] = [];
  // Atom <entry> blocks
  const entryRx = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRx.exec(xml)) !== null) {
    const body = m[1];
    const title = (/<title[^>]*>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    const linkM = /<link[^>]*href="([^"]+)"/.exec(body);
    const link = linkM ? linkM[1] : '';
    const published = /<published>([^<]+)<\/published>/.exec(body)?.[1] ?? '';
    if (title && link) out.push({ title, link, published });
  }
  return out;
}

interface FetchResult {
  sub: string;
  ok: boolean;
  status: number;
  events: IntelEvent[];
}

async function fetchSubreddit(sub: string): Promise<FetchResult> {
  const url = `https://www.reddit.com/r/${sub}/new/.rss?limit=25`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/atom+xml,application/xml,text/xml,*/*' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(`[reddit] ${sub} network error:`, err);
    return { sub, ok: false, status: 0, events: [] };
  }
  if (!res.ok) {
    return { sub, ok: false, status: res.status, events: [] };
  }
  const xml = await res.text();
  const entries = parseAtom(xml);

  const events: IntelEvent[] = [];
  for (const e of entries) {
    if (NEGATIVE_RX.test(e.title)) continue;
    if (!REGION_RX.test(e.title)) continue;
    if (!KINETIC_RX.test(e.title)) continue;
    const category = classifyCategory(e.title);
    if (!category) continue;
    const hit = geocode(e.title);
    if (!hit) continue;
    const { lat, lon } = jitter(hit.lat, hit.lon, e.link);

    let timestamp = new Date().toISOString();
    if (e.published) {
      const d = new Date(e.published);
      if (!isNaN(d.getTime())) timestamp = d.toISOString();
    }

    events.push({
      id: `reddit-${hashStr(e.link)}`,
      title: e.title.slice(0, 180),
      summary: `r/${sub}`,
      category,
      severity: classifySeverity(e.title),
      region: hit.region,
      lat,
      lon,
      timestamp,
      source: `Reddit/r/${sub}`,
      sourceUrl: e.link,
    });
  }
  return { sub, ok: true, status: 200, events };
}

interface CacheEntry {
  events: IntelEvent[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<IntelEvent[]> | null = null;

export async function getRedditEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = (async () => {
      const all: IntelEvent[] = [];
      const failures: string[] = [];
      for (let i = 0; i < SUBREDDITS.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 800));
        const r = await fetchSubreddit(SUBREDDITS[i]);
        if (!r.ok) failures.push(`${r.sub}:${r.status}`);
        all.push(...r.events);
      }
      // If every subreddit returned a non-OK response we've been blocked
      // — throw so the source status reports ok:false instead of silently 0.
      if (failures.length === SUBREDDITS.length) {
        throw new Error(`reddit all-blocked: ${failures.join(', ')}`);
      }
      return all;
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

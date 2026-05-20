import type { EventCategory, EventSeverity, IntelEvent } from '../types';
import { geocode, jitter } from '../geocode';

// Wire-service RSS feeds. UI is English; sources are intentionally
// multilingual so we get first-line coverage from native outlets.
// Each item is title-filtered then passed through the existing keyword
// classifier. CJK keywords already present in `geocode` + classifier
// rules below.

const UA = 'east-vantage/0.3 (research aggregator)';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

interface FeedSpec {
  name: string;
  url: string;
  lang: 'en' | 'ko' | 'ja' | 'zh';
}

const FEEDS: FeedSpec[] = [
  { name: 'Yonhap', url: 'https://en.yna.co.kr/RSS/news.xml', lang: 'en' },
  { name: 'Yonhap-KR', url: 'https://www.yna.co.kr/rss/politics.xml', lang: 'ko' },
  { name: 'NHK-JP', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', lang: 'ja' },
  { name: 'Japan Times', url: 'https://www.japantimes.co.jp/feed/', lang: 'en' },
  { name: '38 North', url: 'https://www.38north.org/feed/', lang: 'en' },
  { name: 'SCMP', url: 'https://www.scmp.com/rss/91/feed', lang: 'en' },
];

// Region + kinetic gates (CJK-aware)
const REGION_RX =
  /(taiwan|china|chinese|pla\b|plaaf|plan\b|adiz|taipei|kaohsiung|tsmc|north korea|dprk|kim jong|pyongyang|yongbyon|korean peninsula|south korea|seoul|jeju|ieodo|senkaku|diaoyu|okinawa|台|中|韓|朝|日|防空|海峡|미사일|북한|대만|중국|훈련|発射|戦闘機|領空)/i;

const KINETIC_RX =
  /(missile|launch|sortie|incursion|drill|exercise|crossed|breach|warship|carrier|fighter|jet|adiz|scramble|cyber|sanction|test|nuclear|reactor|provocation|airspace|naval|warning|patrol|飛彈|导弹|发射|戰機|战机|軍機|军机|演習|演习|미사일|발사|훈련|침범|ミサイル|発射|戦闘機|演習)/i;

const CATEGORY_RULES: Array<[RegExp, EventCategory]> = [
  [
    /missile|launch|projectile|icbm|srbm|cruise|hwasong|ballistic|飛彈|导弹|미사일|발사|ミサイル|発射/i,
    'missile',
  ],
  [
    /aircraft|fighter|adiz|j-?\d+|jet|airspace|sortie|incursion|scramble|crossed median|戰機|战机|軍機|军机|空軍|空军|防空|항공기|영공|戦闘機|領空/i,
    'air',
  ],
  [
    /navy|naval|carrier|warship|frigate|destroyer|submarine|vessel|ship|fleet|coast guard|艦|舰|海軍|海军|海警|함정|艦艇/i,
    'naval',
  ],
  [/cyber|hack|apt|malware|breach|phishing/i, 'cyber'],
  [/satellite|imagery|thermal|reactor|enrichment/i, 'satellite'],
];

function classifyCategory(text: string): EventCategory | null {
  for (const [rx, cat] of CATEGORY_RULES) if (rx.test(text)) return cat;
  return null;
}

function classifySeverity(text: string): EventSeverity {
  if (/\b(icbm|nuclear test|war|invasion|attack|killed)\b/i.test(text)) return 'critical';
  if (/\b(launch|missile|incursion|scramble|breach|crossed)\b/i.test(text)) return 'high';
  if (/\b(exercise|drill|patrol|sortie|warning)\b/i.test(text)) return 'medium';
  return 'low';
}

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
}

// Minimal RSS parser — handles <item> blocks with title/link/pubDate.
// Avoids pulling in a heavy XML lib for serverless cold-start cost.
function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRx = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRx.exec(xml)) !== null) {
    const body = m[1];
    const title = extractTag(body, 'title') ?? '';
    const link = extractTag(body, 'link') ?? '';
    const pubDate = extractTag(body, 'pubDate') ?? extractTag(body, 'dc:date') ?? '';
    if (title) items.push({ title, link, pubDate });
  }
  return items;
}

function extractTag(body: string, tag: string): string | null {
  // tag could include namespace, e.g. dc:date
  const escaped = tag.replace(/:/g, '\\:');
  const rx = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i');
  const m = rx.exec(body);
  if (!m) return null;
  let v = m[1];
  // Strip CDATA wrapper if present
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(v);
  if (cdata) v = cdata[1];
  return v
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchFeed(feed: FeedSpec): Promise<IntelEvent[]> {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml,text/xml,*/*' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${feed.name} ${res.status}`);
  const xml = await res.text();
  const items = parseRss(xml);

  const out: IntelEvent[] = [];
  for (const it of items) {
    if (!REGION_RX.test(it.title)) continue;
    if (!KINETIC_RX.test(it.title)) continue;
    const category = classifyCategory(it.title);
    if (!category) continue;

    const hit = geocode(it.title);
    if (!hit) continue;
    const { lat, lon } = jitter(hit.lat, hit.lon, it.link);

    let timestamp = new Date().toISOString();
    if (it.pubDate) {
      const d = new Date(it.pubDate);
      if (!isNaN(d.getTime())) timestamp = d.toISOString();
    }

    out.push({
      id: `wire-${feed.name.toLowerCase().replace(/\s+/g, '-')}-${Buffer.from(it.link).toString('base64url').slice(0, 16)}`,
      title: it.title.slice(0, 180),
      summary: `${feed.name} · ${feed.lang.toUpperCase()}`,
      category,
      severity: classifySeverity(it.title),
      region: hit.region,
      lat,
      lon,
      timestamp,
      source: feed.name,
      sourceUrl: it.link,
      tags: [`lang:${feed.lang}`],
    });
  }
  return out;
}

interface CacheEntry {
  events: IntelEvent[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<IntelEvent[]> | null = null;

export async function getWireEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = Promise.all(
      FEEDS.map((f) =>
        fetchFeed(f).catch((err) => {
          console.warn(`[wires] ${f.name} failed:`, err);
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

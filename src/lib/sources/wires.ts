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

// Region + kinetic gates (CJK-aware, full East Asia)
const REGION_RX =
  /(taiwan|china|chinese|pla\b|plaaf|plan\b|adiz|taipei|kaohsiung|tsmc|hsinchu|north korea|dprk|kim jong|pyongyang|yongbyon|sohae|punggye|korean peninsula|south korea|seoul|jeju|ieodo|japan|japanese|jsdf|jasdf|jmsdf|yokota|kadena|misawa|iwakuni|sasebo|yokosuka|okinawa|senkaku|diaoyu|hong kong|beijing|shanghai|guangzhou|xinjiang|tibet|台|中|韓|朝|日|防空|海峡|미사일|북한|대만|중국|훈련|発射|戦闘機|領空|自衛隊)/i;

// Without an LLM gate (user opted out of Anthropic), the regex has to
// be conservative — soft words like bare 'scramble' / 'crossed' / 'fire'
// produce too many false positives ("scramble to leave", "crossed off",
// "fire someone"). Strong-only kinetic anchors:
const KINETIC_RX =
  /(missile|icbm|srbm|ballistic|hwasong|projectile|adiz|plaaf|plan navy|warship|aircraft carrier|frigate|destroyer|submarine|nuclear test|airspace violation|airspace incursion|coast guard incursion|median line|cyber(attack|intrusion|attribution)|飛彈|导弹|戰機|战机|軍機|军机|軍演|军演|空軍|空军|미사일|핵실험|침범|ミサイル|戦闘機|自衛隊|発射(?:実験|演習))/i;

// Topics that produce false positives even when a kinetic word slips in.
// Expanded to drop business / visa / entertainment / sport / lifestyle.
const NEGATIVE_RX =
  /(working group|diplomat|envoy|summit|talks|meeting|cooperation|partnership|trade deal|economic\b|cultural|initiative|launches? (?:working|group|partnership|initiative|talks|meeting|investigation)|business owner|visa|immigration|migrant|refugee|tourism|tourist|celebrity|stock|earnings|finance|entertainment|drama|k-pop|j-pop|sport|olympic|movie|film|festival)/i;

const CATEGORY_RULES: Array<[RegExp, EventCategory]> = [
  [
    /missile|projectile|icbm|srbm|cruise missile|hwasong|ballistic|飛彈|导弹|미사일|ミサイル|launch(?:\s+(?:vehicle|pad|test|complex|of (?:a |the )?(?:missile|icbm|srbm|rocket|satellite)))/i,
    'missile',
  ],
  // Air: require explicit military-aircraft / airspace-violation context.
  // 'scramble' alone is too soft — "scramble to leave Japan" got classified
  // as air category. Now requires modifier.
  [
    /pla\s+aircraft|chinese (?:aircraft|jets?|fighters?)|adiz (?:incursion|violation)|airspace (?:violation|incursion)|fighter scramble|scrambl\w+ (?:fighters?|jets?|aircraft|interception)|crossed median|median line|j-?\d{1,2}\b|f-?\d{1,2}\b|戰機|战机|軍機|军机|空軍|空军|防空識別|防空识别|戦闘機|領空侵犯/i,
    'air',
  ],
  // Naval: require military naval words — bare 'ship' / 'vessel' / 'fleet'
  // would catch cargo / fishing vessels.
  [
    /pla(n|\s+navy)|naval (?:vessel|fleet|exercise|drill|incursion)|warship|aircraft carrier|frigate|destroyer|submarine|coast guard (?:vessel|incursion|intrusion)|海警船|海軍艦|军舰|軍艦|구축함|함정 (?:이동|배치)/i,
    'naval',
  ],
  [
    /(?:cyber|hack|apt|malware)(?:\s+(?:attack|intrusion|attribution|breach|campaign))|phishing campaign/i,
    'cyber',
  ],
  [
    /satellite (?:imagery|image)|thermal anomaly|reactor (?:activity|test|operation)|enrichment|衛星画像/i,
    'satellite',
  ],
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

// djb2 hash, base36-encoded. Stable across runs (no Date.now), short,
// no collisions for URLs sharing a domain prefix (which the previous
// base64-of-prefix scheme suffered from).
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
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

  // Dedupe Yonhap-style revisions: "(LEAD) X" and "X" point to the same story
  const dedupeSeen = new Set<string>();
  const out: IntelEvent[] = [];
  for (const it of items) {
    if (NEGATIVE_RX.test(it.title)) continue;
    if (!REGION_RX.test(it.title)) continue;
    if (!KINETIC_RX.test(it.title)) continue;
    const category = classifyCategory(it.title);
    if (!category) continue;

    const normalized = it.title
      .replace(/^\((?:[0-9]+(?:st|nd|rd|th)?\s+)?(?:LEAD|LD|UPDATE)\)\s*/i, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (dedupeSeen.has(normalized)) continue;
    dedupeSeen.add(normalized);

    const hit = geocode(it.title);
    if (!hit) continue;
    const { lat, lon } = jitter(hit.lat, hit.lon, it.link);

    let timestamp = new Date().toISOString();
    if (it.pubDate) {
      const d = new Date(it.pubDate);
      if (!isNaN(d.getTime())) timestamp = d.toISOString();
    }

    out.push({
      id: `wire-${feed.name.toLowerCase().replace(/\s+/g, '-')}-${hashStr(it.link)}`,
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

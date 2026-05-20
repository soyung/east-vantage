import type { EventCategory, EventSeverity, IntelEvent } from '../types';
import { geocode, jitter } from '../geocode';

// Reddit public JSON endpoints. No auth required for read-only listing
// but a distinct User-Agent is mandatory — generic UAs get 429'd.
//
// Strategy: hit /new.json on a curated set of subreddits, post-filter
// posts by title keyword + minimum engagement (score + comment count)
// so trolls and low-effort posts don't flood the feed.

const UA = 'east-vantage/0.3 (by /u/eastvantage research aggregator)';
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

const SUBREDDITS = [
  'CredibleDefense',
  'LessCredibleDefence',
  'aiwar',
  'IndoPacificNews',
  'korea',
  'taiwan',
];

const REGION_RX =
  /(taiwan|china|chinese|pla\b|plaaf|plan\b|adiz|tsmc|hsinchu|taipei|kaohsiung|north korea|dprk|kim jong|pyongyang|yongbyon|korean peninsula|south korea|seoul|busan|jeju|ieodo|senkaku|diaoyu|okinawa|台|中|韓|朝|日|防空|海峡|미사일|북한|대만|중국|훈련)/i;
const KINETIC_RX =
  /(missile|launch|sortie|incursion|drill|exercise|crossed|breach|warship|carrier|fighter|jet|adiz|scramble|cyber|hack|sanction|invasion|deploy|test|nuclear|reactor|provocation|airspace|naval)/i;

// Reuse the same classification heuristics as the GDELT source.
const CATEGORY_RULES: Array<[RegExp, EventCategory]> = [
  [/missile|launch|projectile|icbm|srbm|cruise|hwasong|ballistic/i, 'missile'],
  [/aircraft|fighter|adiz|j-?\d+|jet|airspace|sortie|incursion|scramble/i, 'air'],
  [/navy|naval|carrier|warship|frigate|destroyer|submarine|vessel|ship|fleet|coast guard/i, 'naval'],
  [/cyber|hack|apt|malware|breach|phishing|intrusion/i, 'cyber'],
  [/satellite|imagery|firms|thermal|reactor|enrichment/i, 'satellite'],
];

function classifyCategory(text: string): EventCategory | null {
  for (const [rx, cat] of CATEGORY_RULES) if (rx.test(text)) return cat;
  return null;
}

function classifySeverity(text: string, score: number): EventSeverity {
  if (/\b(nuclear test|war|invasion|icbm|killed)\b/i.test(text)) return 'critical';
  if (/\b(launch|missile|incursion|breach|crossed)\b/i.test(text)) return 'high';
  if (/\b(exercise|drill|sortie|deploy|scramble)\b/i.test(text)) return 'medium';
  if (score > 100) return 'medium';
  return 'low';
}

interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  url: string;
  score: number;
  num_comments: number;
  created_utc: number;
  selftext?: string;
}

interface RedditListing {
  data: { children: Array<{ data: RedditPost }> };
}

async function fetchSubreddit(sub: string): Promise<IntelEvent[]> {
  const url = `https://www.reddit.com/r/${sub}/new.json?limit=25`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Reddit ${sub} ${res.status}`);
  const data = (await res.json()) as RedditListing;
  const posts = (data.data?.children ?? []).map((c) => c.data);

  const events: IntelEvent[] = [];
  for (const p of posts) {
    const title = p.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    if (!REGION_RX.test(title)) continue;
    if (!KINETIC_RX.test(title)) continue;
    const category = classifyCategory(title);
    if (!category) continue;
    // Engagement floor: must have at least some upvotes OR comments
    if (p.score < 5 && p.num_comments < 3) continue;

    const hit = geocode(title);
    if (!hit) continue;
    const { lat, lon } = jitter(hit.lat, hit.lon, p.id);

    events.push({
      id: `reddit-${p.id}`,
      title: title.slice(0, 180),
      summary: `r/${p.subreddit} · score ${p.score} · ${p.num_comments} comments`,
      category,
      severity: classifySeverity(title, p.score),
      region: hit.region,
      lat,
      lon,
      timestamp: new Date(p.created_utc * 1000).toISOString(),
      source: `Reddit/r/${p.subreddit}`,
      sourceUrl: `https://www.reddit.com${p.permalink}`,
      tags: [`score:${p.score}`, `comments:${p.num_comments}`],
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

export async function getRedditEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = (async () => {
      // Sequential with small delay to be polite to Reddit (per-IP limits)
      const all: IntelEvent[] = [];
      for (let i = 0; i < SUBREDDITS.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 800));
        try {
          const events = await fetchSubreddit(SUBREDDITS[i]);
          all.push(...events);
        } catch (err) {
          console.warn(`[reddit] ${SUBREDDITS[i]} failed:`, err);
        }
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

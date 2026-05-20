import type { MarketCard } from '../types';

// Polymarket Gamma API — unauthenticated. Markets returned include outcomes
// + prices in 0-1 probability space. We filter by tags relevant to East Asia.

const GAMMA = 'https://gamma-api.polymarket.com/markets';
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Two-stage filter — must mention an East Asia security subject AND a
// substantive geopolitical topic. Cuts out the "Will Trump say <word>"
// meme markets that pass a one-word keyword filter.
const REGION_RX = /(taiwan|china|xi jinping|north korea|kim jong un|pyongyang|korean peninsula|south korea|tsmc|pla|dprk|seoul|jeju|senkaku|ieodo|japan|japanese|jsdf|hong kong|beijing|shanghai|tibet)/i;
const TOPIC_RX = /(invade|invasion|attack|war|nuclear|missile|test|launch|sanction|tariff|coup|leader|premier|president|election|fall|collapse|regime|escalation|conflict|incident|airspace|adiz|strait|chip|export control|reunif|annex|crisis|incursion|drill|exercise|ban|deal)/i;
const EXCLUDE_RX = /(trump (say|tweet|post|mention|name|drop|use|wear)|will (he|she|trump|biden|kamala|musk) (say|mention|tweet|post|wear|drop))/i;

interface GammaMarket {
  id: string;
  question?: string;
  slug?: string;
  active?: boolean;
  closed?: boolean;
  endDate?: string;
  volume?: number;
  volumeNum?: number;
  outcomePrices?: string; // JSON string array of "0.42" etc.
  outcomes?: string; // JSON string array
}

interface CacheEntry {
  markets: MarketCard[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<MarketCard[]> | null = null;

async function fetchMarkets(): Promise<MarketCard[]> {
  const url = new URL(GAMMA);
  url.searchParams.set('limit', '200');
  url.searchParams.set('active', 'true');
  url.searchParams.set('closed', 'false');
  url.searchParams.set('order', 'volume24hr');
  url.searchParams.set('ascending', 'false');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'east-vantage/0.2 (research)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Polymarket ${res.status}`);
  const data = (await res.json()) as GammaMarket[];

  const out: MarketCard[] = [];
  for (const m of data) {
    if (!m.question) continue;
    if (EXCLUDE_RX.test(m.question)) continue;
    if (!REGION_RX.test(m.question)) continue;
    if (!TOPIC_RX.test(m.question)) continue;

    let yesPrice = 0;
    try {
      const prices = JSON.parse(m.outcomePrices ?? '[]') as string[];
      yesPrice = parseFloat(prices[0] ?? '0');
    } catch {
      // ignore parse error
    }

    out.push({
      id: `poly-${m.id}`,
      title: m.question,
      url: m.slug ? `https://polymarket.com/event/${m.slug}` : 'https://polymarket.com/',
      source: 'Polymarket',
      yesPrice,
      volume: m.volumeNum ?? m.volume,
      endDate: m.endDate,
    });

    if (out.length >= 6) break;
  }
  return out;
}

export async function getPolymarketMarkets(): Promise<MarketCard[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.markets;

  if (!inflight) {
    inflight = fetchMarkets().finally(() => {
      inflight = null;
    });
  }

  try {
    const markets = await inflight;
    cache = { markets, at: now };
    return markets;
  } catch (err) {
    if (cache) return cache.markets;
    throw err;
  }
}

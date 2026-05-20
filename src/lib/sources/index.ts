import type { IntelEvent, MarketCard, SourceStatus } from '../types';
import { getGdeltEvents } from './gdelt';
import { getFirmsEvents } from './firms';
import { getAdsbEvents } from './adsb';
import { getUsgsEvents } from './usgs';
import { getPolymarketMarkets } from './polymarket';
import { getMndEvents } from './mnd';

export interface MergedResult {
  events: IntelEvent[];
  markets: MarketCard[];
  sources: SourceStatus[];
  fetchedAt: string;
}

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  empty: T,
): Promise<{ value: T; status: SourceStatus }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    const count = Array.isArray(value) ? value.length : 0;
    return {
      value,
      status: { name, ok: true, count, durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return {
      value: empty,
      status: {
        name,
        ok: false,
        count: 0,
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function getAllSources(): Promise<MergedResult> {
  const [gdelt, firms, adsb, usgs, mnd, poly] = await Promise.all([
    timed('GDELT', getGdeltEvents, [] as IntelEvent[]),
    timed('FIRMS', getFirmsEvents, [] as IntelEvent[]),
    timed('ADSB', getAdsbEvents, [] as IntelEvent[]),
    timed('USGS', getUsgsEvents, [] as IntelEvent[]),
    timed('MND', getMndEvents, [] as IntelEvent[]),
    timed('POLY', getPolymarketMarkets, [] as MarketCard[]),
  ]);

  const allEvents = [
    ...gdelt.value,
    ...firms.value,
    ...adsb.value,
    ...usgs.value,
    ...mnd.value,
  ];
  allEvents.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

  return {
    events: allEvents,
    markets: poly.value,
    sources: [gdelt.status, firms.status, adsb.status, usgs.status, mnd.status, poly.status],
    fetchedAt: new Date().toISOString(),
  };
}

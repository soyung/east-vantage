import type { IntelEvent, MarketCard, SourceStatus } from '../types';
import { getGdeltEvents } from './gdelt';
import { getFirmsEvents } from './firms';
import { getAdsbEvents } from './adsb';
import { getUsgsEvents } from './usgs';
// import { getPolymarketMarkets } from './polymarket'; // disabled — UI clutter, low signal
import { getMndEvents } from './mnd';
import { getRedditEvents } from './reddit';
import { getWireEvents } from './wires';
import { getTelegramEvents } from './telegram';
import { getAisEvents } from './ais';
import { classifyEvents } from './_classifier';

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
  const [gdelt, firms, adsb, usgs, mnd, reddit, wires, telegram, ais] = await Promise.all([
    timed('GDELT', getGdeltEvents, [] as IntelEvent[]),
    timed('FIRMS', getFirmsEvents, [] as IntelEvent[]),
    timed('ADSB', getAdsbEvents, [] as IntelEvent[]),
    timed('USGS', getUsgsEvents, [] as IntelEvent[]),
    timed('MND', getMndEvents, [] as IntelEvent[]),
    timed('RDDT', getRedditEvents, [] as IntelEvent[]),
    timed('WIRE', getWireEvents, [] as IntelEvent[]),
    timed('TGRM', getTelegramEvents, [] as IntelEvent[]),
    timed('AIS', getAisEvents, [] as IntelEvent[]),
    // timed('POLY', getPolymarketMarkets, [] as MarketCard[]), // disabled
  ]);

  // Trusted (structured / sensor) sources skip the LLM classifier.
  // Free-text sources go through the gate so opinion / commemoration
  // / diplomatic noise gets dropped.
  const trusted = [
    ...firms.value, ...adsb.value, ...usgs.value, ...mnd.value, ...ais.value,
  ];
  const freeText = [...gdelt.value, ...reddit.value, ...wires.value, ...telegram.value];

  const classified = await classifyEvents(freeText);
  const allEvents = [...trusted, ...classified];
  allEvents.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

  return {
    events: allEvents,
    markets: [] as MarketCard[], // Polymarket disabled — see import above
    sources: [
      gdelt.status,
      firms.status,
      adsb.status,
      usgs.status,
      mnd.status,
      reddit.status,
      wires.status,
      telegram.status,
      ais.status,
      // poly.status, // disabled
    ],
    fetchedAt: new Date().toISOString(),
  };
}

export type EventCategory =
  | 'air'
  | 'naval'
  | 'missile'
  | 'cyber'
  | 'satellite'
  | 'seismic'
  | 'diplomatic'
  | 'economic';

export type EventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type EventRegion =
  | 'taiwan-strait'
  | 'korean-peninsula'
  | 'japan'
  | 'china-mainland'
  | 'other';

export interface IntelEvent {
  id: string;
  title: string;
  summary: string;
  category: EventCategory;
  severity: EventSeverity;
  region: EventRegion;
  lat: number;
  lon: number;
  timestamp: string;
  source: string;
  sourceUrl?: string;
  tags?: string[];
  // Movement metadata (mostly ADSB). Track is a sequence of [lon, lat]
  // points from oldest → newest including the current position; the
  // globe draws a fading polyline between them so aircraft trajectories
  // are visible at a glance.
  track?: Array<[number, number]>;
  headingDeg?: number;
  altitudeFt?: number;
  speedKt?: number;
}

export interface AdizZone {
  id: string;
  name: string;
  shortName: string;
  color: [number, number, number, number];
  polygon: Array<[number, number]>;
}

export interface MarketCard {
  id: string;
  title: string;
  url: string;
  source: string;
  yesPrice: number; // 0–1
  volume?: number; // in USD or native units
  endDate?: string;
}

export interface SourceStatus {
  name: string;
  ok: boolean;
  count: number;
  durationMs: number;
  error?: string;
}

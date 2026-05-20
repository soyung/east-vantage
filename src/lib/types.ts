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

export type EventRegion = 'taiwan-strait' | 'korean-peninsula' | 'other';

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

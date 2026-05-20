// Simple keyword → coordinate geocoder for Phase 1.
// Order matters: more specific keywords first.
// Replace with GKG / LLM-based geocoding in a later phase.

export interface GeocodeHit {
  lat: number;
  lon: number;
  region: 'taiwan-strait' | 'korean-peninsula' | 'other';
  source: 'keyword' | 'country-fallback';
}

interface KeywordRule {
  pattern: RegExp;
  lat: number;
  lon: number;
  region: GeocodeHit['region'];
}

const RULES: KeywordRule[] = [
  // Korean peninsula — specific
  { pattern: /yongbyon|영변/i, lat: 39.79, lon: 125.76, region: 'korean-peninsula' },
  { pattern: /pyongyang|평양/i, lat: 39.02, lon: 125.75, region: 'korean-peninsula' },
  { pattern: /nlla?|north(ern)? limit line|북방한계선/i, lat: 37.7, lon: 124.9, region: 'korean-peninsula' },
  { pattern: /dmz|판문점|panmunjom/i, lat: 37.95, lon: 126.68, region: 'korean-peninsula' },
  { pattern: /sea of japan|동해|east sea(?! china)/i, lat: 39.5, lon: 130.5, region: 'korean-peninsula' },
  { pattern: /jeju|제주|ieodo|이어도/i, lat: 33.4, lon: 126.5, region: 'korean-peninsula' },
  { pattern: /seoul|서울/i, lat: 37.57, lon: 126.98, region: 'korean-peninsula' },
  { pattern: /busan|부산/i, lat: 35.18, lon: 129.08, region: 'korean-peninsula' },
  { pattern: /dprk|north korea|북한|조선/i, lat: 39.5, lon: 126.0, region: 'korean-peninsula' },
  { pattern: /korean peninsula|한반도/i, lat: 38.0, lon: 127.5, region: 'korean-peninsula' },
  { pattern: /south korea|rok\b|대한민국|한국군/i, lat: 36.5, lon: 127.8, region: 'korean-peninsula' },

  // Taiwan strait — specific
  { pattern: /taipei|台北|타이베이/i, lat: 25.04, lon: 121.56, region: 'taiwan-strait' },
  { pattern: /kaohsiung|高雄/i, lat: 22.63, lon: 120.30, region: 'taiwan-strait' },
  { pattern: /hsinchu|新竹|tsmc/i, lat: 24.81, lon: 120.97, region: 'taiwan-strait' },
  { pattern: /bashi channel|巴士海峽/i, lat: 21.0, lon: 121.0, region: 'taiwan-strait' },
  { pattern: /pratas|dongsha|東沙/i, lat: 20.7, lon: 116.7, region: 'taiwan-strait' },
  { pattern: /taiwan strait|台海|台湾海峡|대만해협/i, lat: 24.0, lon: 119.5, region: 'taiwan-strait' },
  { pattern: /taiwan adiz|adiz/i, lat: 22.5, lon: 119.0, region: 'taiwan-strait' },
  { pattern: /median line|海峽中線/i, lat: 25.0, lon: 120.0, region: 'taiwan-strait' },
  { pattern: /taiwan|台灣|台湾|대만/i, lat: 23.7, lon: 120.96, region: 'taiwan-strait' },
  { pattern: /plaaf|pla air force/i, lat: 23.0, lon: 119.0, region: 'taiwan-strait' },
  { pattern: /plan\b|china navy|china coast guard|ccg\b/i, lat: 24.5, lon: 119.5, region: 'taiwan-strait' },

  // Adjacent — east china sea / japan ECS
  { pattern: /senkaku|diaoyu|尖閣|釣魚/i, lat: 25.74, lon: 123.47, region: 'other' },
  { pattern: /okinawa|沖縄/i, lat: 26.34, lon: 127.94, region: 'other' },
];

const COUNTRY_FALLBACK: Record<string, GeocodeHit> = {
  Taiwan: { lat: 23.7, lon: 120.96, region: 'taiwan-strait', source: 'country-fallback' },
  China: { lat: 24.0, lon: 119.5, region: 'taiwan-strait', source: 'country-fallback' },
  'South Korea': { lat: 36.5, lon: 127.8, region: 'korean-peninsula', source: 'country-fallback' },
  'North Korea': { lat: 39.5, lon: 126.0, region: 'korean-peninsula', source: 'country-fallback' },
  Japan: { lat: 25.74, lon: 123.47, region: 'other', source: 'country-fallback' },
};

export function geocode(text: string, sourceCountry?: string): GeocodeHit | null {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { lat: rule.lat, lon: rule.lon, region: rule.region, source: 'keyword' };
    }
  }
  if (sourceCountry && COUNTRY_FALLBACK[sourceCountry]) {
    return COUNTRY_FALLBACK[sourceCountry];
  }
  return null;
}

// Add small deterministic jitter so multiple events at the same canonical
// point don't stack into a single overlapping pin.
export function jitter(lat: number, lon: number, seed: string): { lat: number; lon: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const dx = (((h & 0xffff) / 0xffff) - 0.5) * 0.4; // ±0.2°
  const dy = ((((h >> 16) & 0xffff) / 0xffff) - 0.5) * 0.4;
  return { lat: lat + dy, lon: lon + dx };
}

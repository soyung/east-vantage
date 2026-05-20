// Simple keyword → coordinate geocoder. Order matters: more specific
// keywords first so e.g. "Yongbyon" hits the reactor coord before the
// generic "DPRK" centroid.

import type { EventRegion } from './types';

export interface GeocodeHit {
  lat: number;
  lon: number;
  region: EventRegion;
  source: 'keyword' | 'country-fallback';
}

interface KeywordRule {
  pattern: RegExp;
  lat: number;
  lon: number;
  region: EventRegion;
}

const RULES: KeywordRule[] = [
  // ─── Korean peninsula ──────────────────────────────────────────────
  { pattern: /yongbyon|영변/i, lat: 39.79, lon: 125.76, region: 'korean-peninsula' },
  { pattern: /sohae|tongchang-ri|동창리|소해/i, lat: 39.66, lon: 124.71, region: 'korean-peninsula' },
  { pattern: /punggye-?ri|풍계리/i, lat: 41.28, lon: 129.08, region: 'korean-peninsula' },
  { pattern: /pyongyang|평양/i, lat: 39.02, lon: 125.75, region: 'korean-peninsula' },
  { pattern: /wonsan|원산/i, lat: 39.15, lon: 127.44, region: 'korean-peninsula' },
  { pattern: /sinpo|신포/i, lat: 40.03, lon: 128.18, region: 'korean-peninsula' },
  { pattern: /nlla?|north(ern)? limit line|북방한계선/i, lat: 37.7, lon: 124.9, region: 'korean-peninsula' },
  { pattern: /dmz|판문점|panmunjom/i, lat: 37.95, lon: 126.68, region: 'korean-peninsula' },
  { pattern: /sea of japan|동해|east sea(?! china)/i, lat: 39.5, lon: 130.5, region: 'korean-peninsula' },
  { pattern: /jeju|제주|ieodo|이어도/i, lat: 33.4, lon: 126.5, region: 'korean-peninsula' },
  { pattern: /seoul|서울/i, lat: 37.57, lon: 126.98, region: 'korean-peninsula' },
  { pattern: /busan|부산/i, lat: 35.18, lon: 129.08, region: 'korean-peninsula' },
  { pattern: /camp humphreys|평택/i, lat: 36.96, lon: 127.03, region: 'korean-peninsula' },
  { pattern: /osan air base|오산/i, lat: 37.09, lon: 127.03, region: 'korean-peninsula' },
  { pattern: /kunsan|군산/i, lat: 35.90, lon: 126.62, region: 'korean-peninsula' },
  { pattern: /dprk|north korea|북한|조선/i, lat: 39.5, lon: 126.0, region: 'korean-peninsula' },
  { pattern: /korean peninsula|한반도/i, lat: 38.0, lon: 127.5, region: 'korean-peninsula' },
  { pattern: /south korea|rok\b|대한민국|한국군/i, lat: 36.5, lon: 127.8, region: 'korean-peninsula' },

  // ─── Taiwan + adjacent ─────────────────────────────────────────────
  { pattern: /taipei|台北|타이베이/i, lat: 25.04, lon: 121.56, region: 'taiwan-strait' },
  { pattern: /kaohsiung|高雄/i, lat: 22.63, lon: 120.30, region: 'taiwan-strait' },
  { pattern: /hsinchu|新竹|tsmc/i, lat: 24.81, lon: 120.97, region: 'taiwan-strait' },
  { pattern: /bashi channel|巴士海峽/i, lat: 21.0, lon: 121.0, region: 'taiwan-strait' },
  { pattern: /pratas|dongsha|東沙/i, lat: 20.7, lon: 116.7, region: 'taiwan-strait' },
  { pattern: /taiwan strait|台海|台湾海峡|대만해협/i, lat: 24.0, lon: 119.5, region: 'taiwan-strait' },
  { pattern: /taiwan adiz|adiz/i, lat: 22.5, lon: 119.0, region: 'taiwan-strait' },
  { pattern: /median line|海峽中線/i, lat: 25.0, lon: 120.0, region: 'taiwan-strait' },
  { pattern: /taiwan|台灣|台湾|대만/i, lat: 23.7, lon: 120.96, region: 'taiwan-strait' },

  // ─── Japan ─────────────────────────────────────────────────────────
  { pattern: /senkaku|diaoyu|尖閣|釣魚/i, lat: 25.74, lon: 123.47, region: 'japan' },
  { pattern: /yokota|横田/i, lat: 35.75, lon: 139.35, region: 'japan' },
  { pattern: /misawa|三沢/i, lat: 40.70, lon: 141.37, region: 'japan' },
  { pattern: /iwakuni|岩国/i, lat: 34.14, lon: 132.24, region: 'japan' },
  { pattern: /sasebo|佐世保/i, lat: 33.16, lon: 129.71, region: 'japan' },
  { pattern: /kadena|嘉手納/i, lat: 26.36, lon: 127.77, region: 'japan' },
  { pattern: /yokosuka|横須賀/i, lat: 35.28, lon: 139.67, region: 'japan' },
  { pattern: /naha|那覇/i, lat: 26.21, lon: 127.69, region: 'japan' },
  { pattern: /okinawa|沖縄/i, lat: 26.34, lon: 127.94, region: 'japan' },
  { pattern: /tokyo|東京/i, lat: 35.68, lon: 139.69, region: 'japan' },
  { pattern: /osaka|大阪/i, lat: 34.69, lon: 135.50, region: 'japan' },
  { pattern: /hokkaido|北海道/i, lat: 43.06, lon: 141.35, region: 'japan' },
  { pattern: /kyushu|九州/i, lat: 33.0, lon: 130.5, region: 'japan' },
  { pattern: /jsdf|jasdf|jmsdf|japan(ese)? (self-)?defense/i, lat: 36.0, lon: 139.0, region: 'japan' },
  { pattern: /japan|日本/i, lat: 36.0, lon: 138.0, region: 'japan' },

  // ─── China mainland — specific facilities ──────────────────────────
  { pattern: /jiuquan|酒泉/i, lat: 40.96, lon: 100.29, region: 'china-mainland' },
  { pattern: /xichang|西昌/i, lat: 28.25, lon: 102.03, region: 'china-mainland' },
  { pattern: /wenchang|文昌/i, lat: 19.61, lon: 110.95, region: 'china-mainland' },
  { pattern: /taiyuan|太原/i, lat: 38.85, lon: 111.61, region: 'china-mainland' },
  { pattern: /lop nur|罗布泊/i, lat: 40.37, lon: 88.32, region: 'china-mainland' },
  { pattern: /yulin (submarine|naval)|榆林/i, lat: 18.22, lon: 109.69, region: 'china-mainland' },
  { pattern: /sanya|三亚/i, lat: 18.25, lon: 109.51, region: 'china-mainland' },
  { pattern: /qingdao|青岛/i, lat: 36.07, lon: 120.38, region: 'china-mainland' },
  { pattern: /ningbo|宁波/i, lat: 29.87, lon: 121.55, region: 'china-mainland' },
  { pattern: /xiamen|厦门/i, lat: 24.48, lon: 118.09, region: 'china-mainland' },
  { pattern: /fuzhou|福州/i, lat: 26.07, lon: 119.30, region: 'china-mainland' },

  // China cities / regions
  { pattern: /beijing|北京/i, lat: 39.91, lon: 116.40, region: 'china-mainland' },
  { pattern: /shanghai|上海/i, lat: 31.23, lon: 121.47, region: 'china-mainland' },
  { pattern: /guangzhou|广州/i, lat: 23.13, lon: 113.27, region: 'china-mainland' },
  { pattern: /hong kong|香港|홍콩/i, lat: 22.32, lon: 114.17, region: 'china-mainland' },
  { pattern: /chengdu|成都/i, lat: 30.57, lon: 104.07, region: 'china-mainland' },
  { pattern: /wuhan|武汉/i, lat: 30.59, lon: 114.31, region: 'china-mainland' },
  { pattern: /shenzhen|深圳/i, lat: 22.54, lon: 114.06, region: 'china-mainland' },
  { pattern: /hainan|海南/i, lat: 19.20, lon: 109.74, region: 'china-mainland' },
  { pattern: /fujian|福建/i, lat: 26.0, lon: 119.0, region: 'china-mainland' },
  { pattern: /xinjiang|新疆/i, lat: 41.0, lon: 85.0, region: 'china-mainland' },
  { pattern: /tibet|xizang|西藏/i, lat: 31.0, lon: 88.0, region: 'china-mainland' },

  // PLA commands and generic
  { pattern: /plaaf|pla air force/i, lat: 23.0, lon: 119.0, region: 'china-mainland' },
  { pattern: /plan\b|china navy|china coast guard|ccg\b/i, lat: 24.5, lon: 119.5, region: 'china-mainland' },
  { pattern: /eastern theater command/i, lat: 32.0, lon: 119.0, region: 'china-mainland' },
  { pattern: /southern theater command/i, lat: 23.0, lon: 113.0, region: 'china-mainland' },
  { pattern: /northern theater command/i, lat: 41.8, lon: 123.4, region: 'china-mainland' },
  { pattern: /western theater command/i, lat: 30.6, lon: 104.0, region: 'china-mainland' },
  { pattern: /central theater command/i, lat: 34.8, lon: 113.6, region: 'china-mainland' },
  { pattern: /china|中国|중국/i, lat: 35.0, lon: 105.0, region: 'china-mainland' },
];

const COUNTRY_FALLBACK: Record<string, GeocodeHit> = {
  Taiwan: { lat: 23.7, lon: 120.96, region: 'taiwan-strait', source: 'country-fallback' },
  China: { lat: 35.0, lon: 105.0, region: 'china-mainland', source: 'country-fallback' },
  'South Korea': { lat: 36.5, lon: 127.8, region: 'korean-peninsula', source: 'country-fallback' },
  'North Korea': { lat: 39.5, lon: 126.0, region: 'korean-peninsula', source: 'country-fallback' },
  Japan: { lat: 36.0, lon: 138.0, region: 'japan', source: 'country-fallback' },
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

// Deterministic small jitter so events at the same canonical coord don't
// stack into one overlapping pin.
export function jitter(lat: number, lon: number, seed: string): { lat: number; lon: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const dx = (((h & 0xffff) / 0xffff) - 0.5) * 0.4; // ±0.2°
  const dy = ((((h >> 16) & 0xffff) / 0xffff) - 0.5) * 0.4;
  return { lat: lat + dy, lon: lon + dx };
}

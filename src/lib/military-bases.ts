// Curated list of major military installations + missile/space facilities
// across East Asia. Rendered as a static background layer on the globe
// (not as events) — always visible, hover for the base name + operator.
//
// Coordinates from Wikipedia / open sources. Approximate; for visualization
// only, not analytical positioning.

export type Operator = 'US' | 'ROK' | 'PLA' | 'JSDF' | 'ROCAF' | 'DPRK';

export interface MilitaryBase {
  id: string;
  name: string;
  operator: Operator;
  kind: 'air' | 'naval' | 'army' | 'missile' | 'space' | 'nuclear' | 'joint';
  lat: number;
  lon: number;
}

export const BASES: MilitaryBase[] = [
  // ─── US bases in East Asia ────────────────────────────────────────
  { id: 'us-kadena',       name: 'Kadena AB',          operator: 'US',   kind: 'air',     lat: 26.36, lon: 127.77 },
  { id: 'us-yokota',       name: 'Yokota AB',          operator: 'US',   kind: 'air',     lat: 35.75, lon: 139.35 },
  { id: 'us-misawa',       name: 'Misawa AB',          operator: 'US',   kind: 'air',     lat: 40.70, lon: 141.37 },
  { id: 'us-iwakuni',      name: 'MCAS Iwakuni',       operator: 'US',   kind: 'air',     lat: 34.14, lon: 132.24 },
  { id: 'us-sasebo',       name: 'NB Sasebo',          operator: 'US',   kind: 'naval',   lat: 33.16, lon: 129.71 },
  { id: 'us-yokosuka',     name: 'NB Yokosuka',        operator: 'US',   kind: 'naval',   lat: 35.28, lon: 139.67 },
  { id: 'us-humphreys',    name: 'Camp Humphreys',     operator: 'US',   kind: 'army',    lat: 36.96, lon: 127.03 },
  { id: 'us-osan',         name: 'Osan AB',            operator: 'US',   kind: 'air',     lat: 37.09, lon: 127.03 },
  { id: 'us-kunsan',       name: 'Kunsan AB',          operator: 'US',   kind: 'air',     lat: 35.90, lon: 126.62 },
  { id: 'us-futenma',      name: 'MCAS Futenma',       operator: 'US',   kind: 'air',     lat: 26.27, lon: 127.76 },
  { id: 'us-andersen',     name: 'Andersen AFB Guam',  operator: 'US',   kind: 'air',     lat: 13.58, lon: 144.93 },

  // ─── JSDF (Japan Self-Defense Forces) ─────────────────────────────
  { id: 'jp-naha',         name: 'JASDF Naha',         operator: 'JSDF', kind: 'air',     lat: 26.21, lon: 127.69 },
  { id: 'jp-komatsu',      name: 'JASDF Komatsu',      operator: 'JSDF', kind: 'air',     lat: 36.39, lon: 136.41 },
  { id: 'jp-chitose',      name: 'JASDF Chitose',      operator: 'JSDF', kind: 'air',     lat: 42.79, lon: 141.67 },
  { id: 'jp-hyakuri',      name: 'JASDF Hyakuri',      operator: 'JSDF', kind: 'air',     lat: 36.18, lon: 140.41 },
  { id: 'jp-yokosuka-jmsdf',name:'JMSDF Yokosuka',     operator: 'JSDF', kind: 'naval',   lat: 35.29, lon: 139.66 },
  { id: 'jp-sasebo-jmsdf', name: 'JMSDF Sasebo',       operator: 'JSDF', kind: 'naval',   lat: 33.16, lon: 129.72 },

  // ─── ROK (Republic of Korea) ──────────────────────────────────────
  { id: 'rok-seongnam',    name: 'ROKAF Seoul AB',     operator: 'ROK',  kind: 'air',     lat: 37.45, lon: 127.11 },
  { id: 'rok-daegu',       name: 'ROKAF Daegu',        operator: 'ROK',  kind: 'air',     lat: 35.89, lon: 128.66 },
  { id: 'rok-jinhae',      name: 'ROKN Jinhae',        operator: 'ROK',  kind: 'naval',   lat: 35.14, lon: 128.65 },
  { id: 'rok-busan',       name: 'ROKN Busan',         operator: 'ROK',  kind: 'naval',   lat: 35.10, lon: 129.04 },

  // ─── ROCAF (Taiwan) ───────────────────────────────────────────────
  { id: 'tw-hsinchu',      name: 'ROCAF Hsinchu',      operator: 'ROCAF', kind: 'air',    lat: 24.82, lon: 120.94 },
  { id: 'tw-chiayi',       name: 'ROCAF Chiayi',       operator: 'ROCAF', kind: 'air',    lat: 23.46, lon: 120.39 },
  { id: 'tw-hualien',      name: 'ROCAF Hualien',      operator: 'ROCAF', kind: 'air',    lat: 24.02, lon: 121.62 },
  { id: 'tw-taitung',      name: 'ROCAF Taitung',      operator: 'ROCAF', kind: 'air',    lat: 22.75, lon: 121.10 },
  { id: 'tw-zuoying',      name: 'ROCN Zuoying',       operator: 'ROCAF', kind: 'naval',  lat: 22.65, lon: 120.27 },

  // ─── PLA (People's Liberation Army) ──────────────────────────────
  // Eastern Theater (Taiwan-facing)
  { id: 'pla-fuzhou',      name: 'PLAAF Fuzhou',       operator: 'PLA',  kind: 'air',     lat: 26.00, lon: 119.66 },
  { id: 'pla-longtian',    name: 'PLAAF Longtian',     operator: 'PLA',  kind: 'air',     lat: 25.65, lon: 119.78 },
  { id: 'pla-xiamen',      name: 'PLAAF Xiamen',       operator: 'PLA',  kind: 'air',     lat: 24.54, lon: 118.13 },
  { id: 'pla-ningbo',      name: 'PLAN Ningbo (Donghai HQ)', operator: 'PLA', kind: 'naval', lat: 29.93, lon: 121.62 },
  // Southern Theater
  { id: 'pla-yulin',       name: 'PLAN Yulin (submarine)', operator: 'PLA', kind: 'naval', lat: 18.22, lon: 109.69 },
  { id: 'pla-sanya',       name: 'PLAN Sanya',         operator: 'PLA',  kind: 'naval',   lat: 18.25, lon: 109.51 },
  // Northern Theater
  { id: 'pla-qingdao',     name: 'PLAN Qingdao (HQ)',  operator: 'PLA',  kind: 'naval',   lat: 36.07, lon: 120.38 },
  { id: 'pla-dalian',      name: 'PLAN Dalian',        operator: 'PLA',  kind: 'naval',   lat: 38.92, lon: 121.65 },
  // Missile / space
  { id: 'pla-jiuquan',     name: 'Jiuquan Satellite Launch Center', operator: 'PLA', kind: 'space',   lat: 40.96, lon: 100.29 },
  { id: 'pla-xichang',     name: 'Xichang Satellite Launch Center', operator: 'PLA', kind: 'space',   lat: 28.25, lon: 102.03 },
  { id: 'pla-wenchang',    name: 'Wenchang Spacecraft Launch Site', operator: 'PLA', kind: 'space',   lat: 19.61, lon: 110.95 },
  { id: 'pla-taiyuan',     name: 'Taiyuan Satellite Launch Center', operator: 'PLA', kind: 'space',   lat: 38.85, lon: 111.61 },
  { id: 'pla-lop-nur',     name: 'Lop Nur (nuclear test site)',     operator: 'PLA', kind: 'nuclear', lat: 40.37, lon: 88.32 },

  // ─── DPRK ─────────────────────────────────────────────────────────
  { id: 'kp-yongbyon',     name: 'Yongbyon Nuclear Research Center', operator: 'DPRK', kind: 'nuclear', lat: 39.79, lon: 125.76 },
  { id: 'kp-sohae',        name: 'Sohae Launch Center (Tongchang-ri)', operator: 'DPRK', kind: 'space', lat: 39.66, lon: 124.71 },
  { id: 'kp-punggye-ri',   name: 'Punggye-ri Nuclear Test Site',     operator: 'DPRK', kind: 'nuclear', lat: 41.28, lon: 129.08 },
  { id: 'kp-sinpo',        name: 'Sinpo Naval Shipyard (SLBM)',      operator: 'DPRK', kind: 'naval',   lat: 40.03, lon: 128.18 },
  { id: 'kp-wonsan',       name: 'Wonsan (frequent SRBM test site)', operator: 'DPRK', kind: 'missile', lat: 39.15, lon: 127.44 },
];

// Emoji per (operator, kind). Operator color via small ring will go on
// the map; this picks the icon character.
export function emojiFor(kind: MilitaryBase['kind']): string {
  switch (kind) {
    case 'air':     return '✈';
    case 'naval':   return '⚓';
    case 'army':    return '🪖';
    case 'missile': return '🚀';
    case 'space':   return '🛰';
    case 'nuclear': return '☢';
    case 'joint':   return '🎖';
    default:        return '⬢';
  }
}

// CSS color per operator (used for label outline / text color tint).
export const OPERATOR_COLOR: Record<Operator, string> = {
  US:    '#3b82f6', // blue
  ROK:   '#06b6d4', // cyan
  JSDF:  '#f43f5e', // rose
  ROCAF: '#eab308', // yellow
  PLA:   '#dc2626', // red
  DPRK:  '#a855f7', // purple
};

import type { AdizZone } from './types';

// NOTE: These polygons are rough simplifications for visualization only.
// Replace with authoritative GeoJSON before treating as analytically valid.
export const ZONES: AdizZone[] = [
  {
    id: 'taiwan-adiz',
    name: 'Taiwan Air Defense Identification Zone',
    shortName: 'Taiwan ADIZ',
    color: [255, 60, 60, 60],
    polygon: [
      [117.5, 29.0],
      [123.0, 29.0],
      [123.0, 21.0],
      [117.5, 21.0],
      [117.5, 29.0],
    ],
  },
  {
    id: 'kadiz',
    name: 'Korea Air Defense Identification Zone',
    shortName: 'KADIZ',
    color: [80, 140, 255, 60],
    polygon: [
      [124.0, 39.0],
      [133.0, 39.0],
      [133.0, 32.1],
      [124.0, 32.1],
      [124.0, 39.0],
    ],
  },
  {
    id: 'taiwan-strait-median',
    name: 'Taiwan Strait Median Line (approx.)',
    shortName: 'Median Line',
    color: [255, 200, 80, 100],
    polygon: [
      [119.5, 26.5],
      [120.5, 26.5],
      [121.0, 23.5],
      [120.0, 23.5],
      [119.5, 26.5],
    ],
  },
];

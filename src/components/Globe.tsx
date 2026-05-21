'use client';

import dynamic from 'next/dynamic';
import type { IntelEvent } from '@/lib/types';

if (typeof window !== 'undefined') {
  // Cesium needs to know where its static assets are served from.
  // These were copied into public/cesium by scripts/copy-cesium-assets.mjs.
  (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/cesium';
}

const CesiumGlobe = dynamic(() => import('./CesiumGlobe'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#05070d] text-sm text-zinc-500">
      Initializing globe…
    </div>
  ),
});

interface Props {
  events: IntelEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  aircraftTrace?: { eventId: string; points: Array<[number, number]> } | null;
}

export default function Globe(props: Props) {
  return <CesiumGlobe {...props} />;
}

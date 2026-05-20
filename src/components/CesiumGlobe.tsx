'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntelEvent } from '@/lib/types';

// We deliberately do NOT `import 'cesium'`. The npm package's source modules
// contain syntax that some modern bundlers re-emit in a way that breaks under
// strict-mode parsing. Instead we load the prebuilt IIFE script at runtime
// and use the resulting global. Cesium static files are copied into
// /public/cesium by scripts/copy-cesium-assets.mjs.

type CesiumNS = typeof import('cesium');

declare global {
  interface Window {
    Cesium?: CesiumNS;
    CESIUM_BASE_URL?: string;
    __cesiumLoadingPromise?: Promise<CesiumNS>;
  }
}

const SEVERITY_HEX: Record<string, string> = {
  info: '#a1a1aa',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#dc2626',
};

function loadCesium(): Promise<CesiumNS> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (window.__cesiumLoadingPromise) return window.__cesiumLoadingPromise;

  window.CESIUM_BASE_URL = '/cesium';

  const cssId = 'cesium-widgets-css';
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = '/cesium/Widgets/widgets.css';
    document.head.appendChild(link);
  }

  window.__cesiumLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/cesium/Cesium.js';
    script.async = true;
    script.onload = () => {
      if (window.Cesium) resolve(window.Cesium);
      else reject(new Error('Cesium loaded but window.Cesium is undefined'));
    };
    script.onerror = () => reject(new Error('Failed to load /cesium/Cesium.js'));
    document.head.appendChild(script);
  });

  return window.__cesiumLoadingPromise;
}

interface CesiumGlobeProps {
  events: IntelEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function CesiumGlobe({ events, selectedId, onSelect }: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<InstanceType<CesiumNS['Viewer']> | null>(null);
  const CesiumRef = useRef<CesiumNS | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadCesium()
      .then((Cesium) => {
        if (cancelled || !containerRef.current) return;
        CesiumRef.current = Cesium;

        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (token) Cesium.Ion.defaultAccessToken = token;

        const viewer = new Cesium.Viewer(containerRef.current, {
          timeline: false,
          animation: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          homeButton: false,
          geocoder: false,
          sceneModePicker: false,
          infoBox: false,
          selectionIndicator: false,
          fullscreenButton: false,
        });

        viewer.scene.globe.enableLighting = false;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#05070d');
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b1220');

        const credit = viewer.creditDisplay.container as HTMLElement;
        if (credit) {
          credit.style.color = '#71717a';
          credit.style.fontSize = '10px';
        }

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(125, 28, 6_500_000),
          duration: 0,
        });

        // ADIZ overlay polygons are intentionally not rendered here. They
        // looked like crude rectangles. When real GeoJSON boundaries land,
        // re-enable by iterating ZONES (kept in src/lib/zones.ts).

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: { position: { x: number; y: number } }) => {
          const picked = viewer.scene.pick(click.position as never);
          if (picked && picked.id && typeof picked.id.id === 'string') {
            onSelectRef.current(picked.id.id as string);
            return;
          }
          onSelectRef.current(null);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        viewerRef.current = viewer;
        setReady(true);
      })
      .catch((err) => {
        console.error('[CesiumGlobe] init failed:', err);
      });

    return () => {
      cancelled = true;
      try {
        viewerRef.current?.destroy();
      } catch {
        // ignore
      }
      viewerRef.current = null;
    };
  }, []);

  // Sync event entities. removeAll is safe since ADIZ zones are not rendered;
  // when zones come back, switch to tracked-IDs deletion.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium) return;

    viewer.entities.removeAll();

    // Defensive dedupe: if any source ever produces colliding IDs, the
    // first wins. Without this, Cesium throws DeveloperError on the
    // duplicate add and tears down the globe.
    const seen = new Set<string>();
    for (const evt of events) {
      if (seen.has(evt.id)) continue;
      seen.add(evt.id);
      const isSel = evt.id === selectedId;
      const color = Cesium.Color.fromCssColorString(SEVERITY_HEX[evt.severity] ?? '#ffffff');
      viewer.entities.add({
        id: evt.id,
        position: Cesium.Cartesian3.fromDegrees(evt.lon, evt.lat),
        point: {
          pixelSize: isSel ? 20 : 11,
          color,
          outlineColor: isSel
            ? Cesium.Color.fromCssColorString('#fbbf24')
            : Cesium.Color.WHITE,
          outlineWidth: isSel ? 4 : 1.5,
        },
        label: isSel
          ? {
              text: evt.title.length > 60 ? evt.title.slice(0, 57) + '...' : evt.title,
              font: '13px sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -28),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              showBackground: true,
              backgroundColor: Cesium.Color.fromCssColorString('#0a0a0acc'),
              backgroundPadding: new Cesium.Cartesian2(8, 6),
            }
          : undefined,
      });
    }
  }, [events, selectedId, ready]);

  // Fly camera to the selected event so a click on a tiny dot reveals
  // where you actually are.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium || !selectedId) return;
    const evt = events.find((e) => e.id === selectedId);
    if (!evt) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(evt.lon, evt.lat, 900_000),
      duration: 1.0,
    });
  }, [selectedId, events, ready]);

  return <div ref={containerRef} className="h-full w-full" />;
}

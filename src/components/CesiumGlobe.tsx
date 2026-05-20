'use client';

import { useEffect, useRef } from 'react';
import {
  Viewer as ResiumViewer,
  Entity,
  PolygonGraphics,
  PointGraphics,
  LabelGraphics,
  CameraFlyTo,
} from 'resium';
import {
  Cartesian3,
  Color,
  Ion,
  LabelStyle,
  VerticalOrigin,
  HeightReference,
  Cartesian2,
  type Viewer,
} from 'cesium';

import 'cesium/Build/Cesium/Widgets/widgets.css';

import type { IntelEvent } from '@/lib/types';
import { ZONES } from '@/lib/zones';

const TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
if (TOKEN) {
  Ion.defaultAccessToken = TOKEN;
}

const SEVERITY_TO_CESIUM_COLOR: Record<string, Color> = {
  info: Color.fromCssColorString('#a1a1aa'),
  low: Color.fromCssColorString('#10b981'),
  medium: Color.fromCssColorString('#f59e0b'),
  high: Color.fromCssColorString('#f97316'),
  critical: Color.fromCssColorString('#dc2626'),
};

interface CesiumGlobeProps {
  events: IntelEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function CesiumGlobe({ events, selectedId, onSelect }: CesiumGlobeProps) {
  const viewerRef = useRef<{ cesiumElement?: Viewer }>(null);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    viewer.scene.globe.enableLighting = false;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }
    viewer.scene.backgroundColor = Color.fromCssColorString('#05070d');
    viewer.scene.globe.baseColor = Color.fromCssColorString('#0b1220');
    // hide default credits chrome a bit
    const creditContainer = viewer.creditDisplay.container as HTMLElement;
    if (creditContainer) {
      creditContainer.style.color = '#71717a';
      creditContainer.style.fontSize = '10px';
    }
  }, []);

  return (
    <ResiumViewer
      ref={viewerRef}
      full={false}
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      navigationHelpButton={false}
      homeButton={false}
      geocoder={false}
      sceneModePicker={false}
      infoBox={false}
      selectionIndicator={false}
      fullscreenButton={false}
      style={{ width: '100%', height: '100%' }}
    >
      <CameraFlyTo
        once
        duration={0}
        destination={Cartesian3.fromDegrees(125, 28, 6_500_000)}
      />

      {ZONES.map((zone) => (
        <Entity key={zone.id} name={zone.name}>
          <PolygonGraphics
            hierarchy={Cartesian3.fromDegreesArray(zone.polygon.flat())}
            material={Color.fromBytes(...zone.color)}
            outline
            outlineColor={Color.fromBytes(zone.color[0], zone.color[1], zone.color[2], 200)}
            height={0}
          />
        </Entity>
      ))}

      {events.map((evt) => {
        const isSelected = evt.id === selectedId;
        const color = SEVERITY_TO_CESIUM_COLOR[evt.severity] ?? Color.WHITE;
        return (
          <Entity
            key={evt.id}
            position={Cartesian3.fromDegrees(evt.lon, evt.lat)}
            onClick={() => onSelect(evt.id)}
          >
            <PointGraphics
              pixelSize={isSelected ? 18 : 12}
              color={color}
              outlineColor={Color.WHITE}
              outlineWidth={isSelected ? 3 : 1.5}
              heightReference={HeightReference.CLAMP_TO_GROUND}
            />
            {isSelected && (
              <LabelGraphics
                text={evt.title}
                font="13px sans-serif"
                fillColor={Color.WHITE}
                outlineColor={Color.BLACK}
                outlineWidth={2}
                style={LabelStyle.FILL_AND_OUTLINE}
                pixelOffset={new Cartesian2(0, -22)}
                verticalOrigin={VerticalOrigin.BOTTOM}
                showBackground
                backgroundColor={Color.fromCssColorString('#0a0a0acc')}
                backgroundPadding={new Cartesian2(8, 6)}
              />
            )}
          </Entity>
        );
      })}
    </ResiumViewer>
  );
}

import * as Cesium from "cesium";
import { useEffect, useRef } from "react";
import { buildEpcBandStyle } from "../shared/styling/epcBandStyle";

interface Props {
  bandByOsmId: Record<string, string>;
  onSelectBuilding: (osmId: string) => void;
}

// Renders Newcastle's Cesium OSM Buildings tileset, styled by EPC band.
// Requires a Cesium ion access token — see README for setup.
export function CesiumMap({ bandByOsmId, onSelectBuilding }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (viewerRef.current) return;

    Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      baseLayerPicker: false,
      timeline: false,
      animation: false,
    });
    viewerRef.current = viewer;

    // Cesium OSM Buildings + world terrain has a known, occasionally-reported
    // upstream timing issue: picking can force a model-matrix update on a
    // tile that hasn't finished loading, throwing inside Cesium's own render
    // loop (see community.cesium.com — "Cannot read property latitude of
    // undefined... using createOsmBuildings"). Cesium's default behaviour is
    // to permanently stop rendering when this happens. Since it's transient
    // (tied to a tile's loading state, not a real data problem), we resume
    // rendering rather than leaving the viewer dead after one bad frame.
    viewer.scene.renderError.addEventListener(() => {
      viewer.useDefaultRenderLoop = true;
    });

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-1.6178, 54.9783, 1200), // Newcastle city centre
    });

    Cesium.createOsmBuildingsAsync().then((tileset) => {
      if (viewer.isDestroyed()) return;
      viewer.scene.primitives.add(tileset);
      tileset.style = new Cesium.Cesium3DTileStyle(buildEpcBandStyle(bandByOsmId));
    });

    viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
      if (viewer.isDestroyed()) return;
      try {
        const picked = viewer.scene.pick(movement.position);
        if (picked?.getProperty) {
          onSelectBuilding(String(picked.getProperty("elementId")));
        }
      } catch {
        // Swallow pick-time errors from the same tile-loading race described above.
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
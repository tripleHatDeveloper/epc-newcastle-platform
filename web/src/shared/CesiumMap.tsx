import * as Cesium from "cesium";
import { useEffect, useRef } from "react";

const FALLBACK_COLOR = "#D3D1C7";

interface Props {
  // Keyed by OSM feature elementId, value is whatever category the color
  // map groups buildings by (EPC band for the public viewer, validation
  // status for the admin console) — this component itself is agnostic.
  dataByOsmId: Record<string, string>;
  colorMap: Record<string, string>;
  onSelectBuilding: (osmId: string) => void;
}

// Renders Newcastle's Cesium OSM Buildings tileset, colored per-feature by
// whatever category colorMap maps dataByOsmId's values to. Shared between
// the public viewer (colored by EPC band) and the admin console (colored
// by validation status) rather than duplicated, since the viewer
// setup/lifecycle is identical — only the coloring differs.
//
// Colors are applied by directly setting each Cesium3DTileFeature's .color
// as tiles become visible (Cesium's own documented pattern — see
// Cesium3DTileset#tileVisible in their reference docs), NOT via a
// Cesium3DTileStyle built from per-building conditions. That earlier
// approach worked at small scale but is fundamentally the wrong tool once
// there are tens of thousands of buildings: it means building one
// condition per matched building into a single expression string, and
// Cesium's expression parser is a recursive-descent parser over that
// OR-chain — confirmed directly, at real scale (54,466 matched buildings),
// this overflowed the JS call stack and crashed the whole map. Per-feature
// coloring has no such limit: it's a plain object lookup per feature, and
// only touches features as they're actually rendered, not all of them at
// once.
//
// Requires a Cesium ion access token — see README for setup.
export function CesiumMap({ dataByOsmId, colorMap, onSelectBuilding }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const tilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);

  // Keep the latest data/colorMap/onSelectBuilding in refs so the setup
  // effect below — which must only run once, see its own comment — always
  // reads current values rather than whatever was passed in on the very
  // first render. Missing this for onSelectBuilding was a real bug found
  // earlier: the click handler kept calling the first render's callback
  // forever, which in the public viewer closed over an empty initial
  // `buildings` array (captured before the first data fetch had even
  // resolved) — so clicking any building, at any time, silently matched
  // nothing.
  const dataByOsmIdRef = useRef(dataByOsmId);
  const colorMapRef = useRef(colorMap);
  const onSelectBuildingRef = useRef(onSelectBuilding);
  dataByOsmIdRef.current = dataByOsmId;
  colorMapRef.current = colorMap;
  onSelectBuildingRef.current = onSelectBuilding;

  useEffect(() => {
    if (!containerRef.current) return;

    // React (in development) deliberately mounts effects twice to surface
    // exactly the kind of bug this guards against: without it, a second
    // effect run would create a second Cesium viewer on the same DOM node,
    // and an in-flight async callback from the first viewer (building load,
    // or a click handler) could still fire after that first viewer was
    // destroyed, crashing on `.scene` being undefined.
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

    // Colors every feature in a tile according to the current data/colorMap
    // refs. Cesium's tileVisible event fires once per visible tile on
    // EVERY rendered frame, not just when a tile first appears — since the
    // viewer renders continuously by default, this alone keeps colors in
    // sync with filter changes within about one frame, with no separate
    // "re-color already-visible tiles" step needed.
    function colorizeTile(tile: Cesium.Cesium3DTile) {
      const content = tile.content;
      const featuresLength = content?.featuresLength;
      if (featuresLength === undefined) return;

      for (let i = 0; i < featuresLength; i++) {
        const feature = content.getFeature(i);
        const elementId = String(feature.getProperty("elementId"));
        const category = dataByOsmIdRef.current[elementId];
        const hex = category ? colorMapRef.current[category] : FALLBACK_COLOR;
        feature.color = Cesium.Color.fromCssColorString(hex);
      }
    }

    Cesium.createOsmBuildingsAsync().then((tileset) => {
      if (viewer.isDestroyed()) return; // viewer may be gone before this resolves
      viewer.scene.primitives.add(tileset);
      tilesetRef.current = tileset;
      tileset.tileVisible.addEventListener(colorizeTile);
    });

    viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
      if (viewer.isDestroyed()) return;
      try {
        const picked = viewer.scene.pick(movement.position);
        // Cesium OSM Buildings features carry `elementId` (unique within
        // `elementType`), not a generic "id" property.
        if (picked?.getProperty) {
          onSelectBuildingRef.current(String(picked.getProperty("elementId")));
        }
      } catch {
        // Swallow pick-time errors from the same tile-loading race described
        // above — a failed pick on a mid-load tile shouldn't crash the app.
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      tilesetRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

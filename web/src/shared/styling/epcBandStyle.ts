// Standard EPC green-to-red band colors, matching the legend used across
// both the public viewer and the admin console map view.
//
// This file used to also export a function building a Cesium3DTileStyle
// expression from these colors, matching each building's OSM elementId via
// a big chain of equality conditions. That approach worked at small scale
// but does not scale to a real city's worth of buildings: at 54,466 real
// matched buildings, the resulting expression string overflowed Cesium's
// expression parser's recursion depth (a genuine "Maximum call stack size
// exceeded" crash, confirmed directly). Coloring is now done per-feature
// in CesiumMap.tsx itself (Cesium's own documented pattern for this exact
// scenario — see Cesium3DTileset#tileVisible), using these colors directly
// as a plain lookup map rather than building any expression at all.
export const EPC_BAND_COLORS: Record<string, string> = {
  A: "#173404",
  B: "#3B6D11",
  C: "#639922",
  D: "#EF9F27",
  E: "#BA7517",
  F: "#D85A30",
  G: "#A32D2D",
};

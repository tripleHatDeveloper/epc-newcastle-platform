// Colors for each validation status, matching the pill colors used
// throughout the admin console (styles.css: .status-*).
//
// See epcBandStyle.ts for why this no longer also builds a
// Cesium3DTileStyle expression — that approach doesn't scale to a real
// city's worth of buildings (confirmed: it crashed at 54,466 real matched
// buildings). Coloring is now done per-feature in CesiumMap.tsx directly,
// using this color map as a plain lookup.
export const STATUS_COLORS: Record<string, string> = {
  unverified: "#A06A00",
  verified: "#2F6B1F",
  flagged: "#A3312D",
  reported: "#2F5D3A",
  superseded: "#6B6B63",
};

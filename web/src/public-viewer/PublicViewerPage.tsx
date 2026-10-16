import { useEffect, useRef, useState } from "react";
import { getBuilding, getBuildings } from "../api/client";
import { ColorLegend } from "../shared/ColorLegend";
import { CesiumMap } from "../shared/CesiumMap";
import { pickRepresentativeByOsmId } from "../shared/pickRepresentativeByOsmId";
import { EPC_BAND_COLORS } from "../shared/styling/epcBandStyle";
import { BuildingDetail } from "./BuildingDetail";
import { exportBuildingsToExcel } from "./exportToExcel";
import { FilterPanel, type Filters } from "./FilterPanel";
import { ReportIssueForm } from "./ReportIssueForm";

// Worst band first — when several database records share one building on
// the map (confirmed against real data: one apartment block had 128), the
// map colors and click behavior both consistently reflect the worst
// performer in that building, which is the most useful thing to surface
// on a platform about energy performance.
const BAND_PRIORITY = ["G", "F", "E", "D", "C", "B", "A"];

export function PublicViewerPage() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Guards against out-of-order responses: if filters change quickly (e.g.
  // picking a property type, then switching straight back to "All types"),
  // two requests can be in flight at once, and there's no guarantee they
  // resolve in the order they were sent. Without this, whichever response
  // happens to arrive last wins — even if it was actually fired first —
  // and a stale, filtered-out result can silently overwrite a fresher one.
  const latestRequestId = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    getBuildings({}).then((result) => {
      if (requestId === latestRequestId.current) setBuildings(result);
    });
  }, []);

  // Clicking anywhere outside the open detail panel closes it, so exploring
  // the map doesn't require manually dismissing it each time. Clicks on the
  // map itself are deliberately excluded here — those are handled entirely
  // by CesiumMap's own picking logic (selecting a different building, or
  // clicking empty space), so this listener only needs to catch clicks
  // elsewhere on the page (the filter panel, header, background, etc.).
  useEffect(() => {
    if (!selected) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (detailRef.current?.contains(target)) return;
      if (mapContainerRef.current?.contains(target)) return;
      setSelected(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected]);

  function handleFilterChange(filters: Filters) {
    const requestId = ++latestRequestId.current;
    getBuildings(filters as any).then((result) => {
      if (requestId === latestRequestId.current) setBuildings(result);
    });
  }

  async function handleSelectBuilding(osmId: string) {
    const match = representativeByOsmId[osmId];
    if (!match) return;
    const detail = await getBuilding(match.uprn);
    setSelected(detail);
  }

  const representativeByOsmId = pickRepresentativeByOsmId(
    buildings,
    (b) => b.epc_band,
    BAND_PRIORITY
  );
  const bandByOsmId = Object.fromEntries(
    Object.entries(representativeByOsmId).map(([id, b]) => [id, b.epc_band])
  );

  return (
    <div className="public-viewer">
      <header>
        <a href="/admin/login" className="admin-sign-in-link">
          Admin sign in
        </a>
      </header>

      <div className="viewer-layout">
        <div className="filter-column">
          <FilterPanel onChange={handleFilterChange} />

          <button
            className="export-button"
            onClick={() => exportBuildingsToExcel(buildings)}
            disabled={buildings.length === 0}
          >
            Export {buildings.length} building{buildings.length === 1 ? "" : "s"} to Excel
          </button>
        </div>

        <div className="map-and-detail">
          <div className="map-container" ref={mapContainerRef}>
            <CesiumMap
              dataByOsmId={bandByOsmId}
              colorMap={EPC_BAND_COLORS}
              onSelectBuilding={handleSelectBuilding}
            />
          </div>

          <ColorLegend
            items={Object.entries(EPC_BAND_COLORS).map(([band, color]) => ({
              label: band,
              color,
            }))}
          />

          <div className="map-footer">
            <button className="footer-report-link" onClick={() => setShowFeedback((v) => !v)}>
              Report an issue
            </button>
            {showFeedback && <ReportIssueForm />}
          </div>

          {selected && (
            <div ref={detailRef}>
              <BuildingDetail building={selected} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

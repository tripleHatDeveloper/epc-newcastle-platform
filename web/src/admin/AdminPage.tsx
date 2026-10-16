import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminBuildings, getBuilding } from "../api/client";
import { ColorLegend } from "../shared/ColorLegend";
import { CesiumMap } from "../shared/CesiumMap";
import { pickRepresentativeByOsmId } from "../shared/pickRepresentativeByOsmId";
import { STATUS_COLORS } from "../shared/styling/statusStyle";
import { BuildingTable } from "./BuildingTable";
import { Queue } from "./Queue";
import { ReviewPanel } from "./ReviewPanel";

// Statuses needing attention first — when several database records share
// one building on the map (the same real issue found on the public
// viewer: one apartment block had 128 separate records), the map color
// and click behavior both consistently surface whichever unit most needs
// an admin's attention, rather than an arbitrary one.
const STATUS_PRIORITY = ["flagged", "reported", "unverified", "verified", "superseded"];

export function AdminPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const navigate = useNavigate();

  function signOut() {
    localStorage.removeItem("epc_token");
    navigate("/admin/login");
  }

  function refresh() {
    getAdminBuildings(status).then(setBuildings);
  }

  useEffect(refresh, [status]);

  async function selectBuilding(uprn: number) {
    const detail = await getBuilding(uprn);
    setSelected(detail);
  }

  async function handleSelectBuildingOnMap(osmId: string) {
    const match = representativeByOsmId[osmId];
    if (!match) return;
    await selectBuilding(match.uprn);
  }

  const representativeByOsmId = pickRepresentativeByOsmId(
    buildings,
    (b) => b.status,
    STATUS_PRIORITY
  );
  const statusByOsmId = Object.fromEntries(
    Object.entries(representativeByOsmId).map(([id, b]) => [id, b.status])
  );

  return (
    <div className="admin-page-wrapper">
      <header className="admin-header">
        <Link to="/" className="admin-header-link">
          View public site
        </Link>
        <button className="admin-header-link" onClick={signOut}>
          Sign out
        </button>
      </header>

      <div className="admin-page">
        <Queue activeStatus={status} onSelectStatus={setStatus} />

        <div className="admin-main">
          <div className="view-toggle">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
              List
            </button>
            <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
              Map
            </button>
          </div>

          <div className="admin-content">
            {view === "list" ? (
              <BuildingTable buildings={buildings} onSelect={selectBuilding} />
            ) : (
              <div className="admin-map-and-legend">
                <div className="admin-map-container">
                  <CesiumMap
                    dataByOsmId={statusByOsmId}
                    colorMap={STATUS_COLORS}
                    onSelectBuilding={handleSelectBuildingOnMap}
                  />
                </div>

                <ColorLegend
                  items={Object.entries(STATUS_COLORS).map(([status, color]) => ({
                    label: status.charAt(0).toUpperCase() + status.slice(1),
                    color,
                  }))}
                />
              </div>
            )}

            {selected && <ReviewPanel building={selected} onUpdated={refresh} />}
          </div>
        </div>
      </div>
    </div>
  );
}

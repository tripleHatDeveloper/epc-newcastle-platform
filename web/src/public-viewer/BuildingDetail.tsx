import { useState } from "react";
import { EpcBuddyChat } from "./EpcBuddyChat";
import { ReportIssueForm } from "./ReportIssueForm";

interface Building {
  uprn: number;
  address: string;
  property_type: string;
  floor_area_sqm: number | null;
  epc_band: string;
  recommendations: { measure: string; payback_category: string }[];
}

interface Props {
  building: Building;
}

// Only one of EPC buddy / the report form is shown at a time — showing
// both independently made it hard to see either one clearly once both were
// open, since they'd stack on top of each other in the same panel.
type OpenPanel = "buddy" | "report" | null;

export function BuildingDetail({ building }: Props) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);

  function toggle(panel: OpenPanel) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  return (
    <div className="building-detail">
      <div className="building-detail-header">
        <p className="building-address">{building.address}</p>
        <span className={`band-pill band-${building.epc_band}`}>Band {building.epc_band}</span>
      </div>

      <table>
        <tbody>
          <tr>
            <td>Property type</td>
            <td>{building.property_type}</td>
          </tr>
          <tr>
            <td>Floor area</td>
            {/* Domestic EPC records don't include floor area by design (the
                domestic register's search endpoint doesn't return it, and
                it isn't part of the domestic filtering criteria) — shown
                explicitly rather than leaving a blank space before "sqm". */}
            <td>
              {building.floor_area_sqm != null ? `${building.floor_area_sqm} sqm` : "Not available"}
            </td>
          </tr>
          <tr>
            <td>Recommended works</td>
            <td>
              {building.recommendations.length
                ? building.recommendations.map((r) => r.measure).join(", ")
                : "None reported"}
            </td>
          </tr>
        </tbody>
      </table>

      <button onClick={() => toggle("buddy")}>Ask EPC buddy</button>
      <button onClick={() => toggle("report")}>Report an issue with this data</button>

      {openPanel === "buddy" && <EpcBuddyChat uprn={building.uprn} address={building.address} />}
      {openPanel === "report" && <ReportIssueForm uprn={building.uprn} label={building.address} />}
    </div>
  );
}

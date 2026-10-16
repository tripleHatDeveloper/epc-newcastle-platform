import * as XLSX from "xlsx";

export interface ExportableBuilding {
  uprn: number;
  address: string;
  zone?: string;
  property_type: string;
  floor_area_sqm: number | null;
  epc_band: string;
  lat?: number;
  lng?: number;
}

// Pure — maps the currently filtered buildings to readable column names,
// independently testable without needing a real browser download to occur.
export function buildingsToExportRows(buildings: ExportableBuilding[]) {
  return buildings.map((b) => ({
    UPRN: b.uprn,
    Address: b.address,
    Zone: b.zone ?? "",
    "Property type": b.property_type,
    "Floor area (sqm)": b.floor_area_sqm ?? "",
    "EPC band": b.epc_band,
    Latitude: b.lat ?? "",
    Longitude: b.lng ?? "",
  }));
}

export function exportBuildingsToExcel(
  buildings: ExportableBuilding[],
  filename = "newcastle-epc-buildings.xlsx"
) {
  const rows = buildingsToExportRows(buildings);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Buildings");
  XLSX.writeFile(workbook, filename);
}

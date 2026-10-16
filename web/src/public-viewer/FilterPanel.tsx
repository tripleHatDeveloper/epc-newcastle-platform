import { useState } from "react";

export interface Filters {
  zone?: string;
  band?: string; // single letter ("F") or comma-separated subset ("A,D,E")
  propertyType?: string;
  minFloorArea?: number;
  issuedAfter?: string; // ISO date (YYYY-MM-DD)
}

interface Props {
  onChange: (filters: Filters) => void;
}

const ALL_BANDS = ["A", "B", "C", "D", "E", "F", "G"];
export type IssuedUnit = "days" | "months" | "years";

// Pure and exported so it's independently testable with a fixed reference
// date, rather than depending on the real current date in a test.
export function computeIssuedAfter(
  value: number,
  unit: IssuedUnit,
  referenceDate: Date = new Date()
): string | undefined {
  if (!value || value <= 0) return undefined;

  const date = new Date(referenceDate);
  if (unit === "days") date.setDate(date.getDate() - value);
  if (unit === "months") date.setMonth(date.getMonth() - value);
  if (unit === "years") date.setFullYear(date.getFullYear() - value);

  return date.toISOString().slice(0, 10);
}

export function FilterPanel({ onChange }: Props) {
  const [floorArea, setFloorArea] = useState(1000); // visual default only
  // Floor area only applies to a small minority of buildings — only
  // non-domestic properties that already passed the ETL's own floor-area
  // filter carry a real value at all (domestic buildings never do). With
  // no way to switch it back off once touched, this filter used to leave
  // the vast majority of buildings permanently hidden the moment someone
  // moved the slider even once, with no way back short of reloading the
  // page. This checkbox makes "on" an explicit, reversible choice rather
  // than an accidental one-way trip.
  const [floorAreaEnabled, setFloorAreaEnabled] = useState(false);
  const [selectedBands, setSelectedBands] = useState<string[]>([]); // empty = "All"
  const [issuedValue, setIssuedValue] = useState<number | "">("");
  const [issuedUnit, setIssuedUnit] = useState<IssuedUnit>("years");
  // Starts empty — NOT { minFloorArea: 1000 } — so that changing zone/band/
  // property type alone never silently includes a floor area constraint the
  // user never actually set. That was a real bug: every filter change
  // merged from this base state, so touching any other control quietly
  // applied floor_area_sqm >= 1000 too, wiping out most real buildings
  // (mostly well under 1000 sqm) the moment any filter was touched at all.
  const [filters, setFilters] = useState<Filters>({});

  function update(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    onChange(merged);
  }

  function selectAllBands() {
    setSelectedBands([]);
    update({ band: undefined });
  }

  function toggleBand(band: string) {
    const next = selectedBands.includes(band)
      ? selectedBands.filter((b) => b !== band)
      : [...selectedBands, band];
    setSelectedBands(next);
    // Unticking the last individual band falls back to "All" automatically,
    // rather than leaving the panel in a state where nothing at all is lit up.
    update({ band: next.length ? next.join(",") : undefined });
  }

  function toggleFloorAreaEnabled(enabled: boolean) {
    setFloorAreaEnabled(enabled);
    // A value of 0 means no constraint at all, same as unticking the box —
    // matches the same "0 collapses to no constraint" pattern already used
    // for the issued-date filter, and avoids ever sending minFloorArea=0,
    // which would otherwise silently exclude every building with no floor
    // area recorded (confirmed as a real bug: NULL >= 0 is not true in SQL).
    update({ minFloorArea: enabled && floorArea > 0 ? floorArea : undefined });
  }

  function updateFloorArea(value: number) {
    setFloorArea(value);
    if (floorAreaEnabled) update({ minFloorArea: value > 0 ? value : undefined });
  }

  function updateIssued(value: number | "", unit: IssuedUnit) {
    setIssuedValue(value);
    setIssuedUnit(unit);
    // Treat 0 the same as blank ("Any time") rather than as its own distinct,
    // ambiguous state — a value of 0 doesn't mean anything meaningful as a
    // lookback window, so it collapses to "no constraint" just like empty.
    const effective = value === "" || value <= 0 ? undefined : computeIssuedAfter(value, unit);
    update({ issuedAfter: effective });
  }

  return (
    <div className="filter-panel">
      <h2>Filters</h2>

      <label>Zone</label>
      <select onChange={(e) => update({ zone: e.target.value || undefined })}>
        <option value="">All zones</option>
        <option value="City centre">City centre</option>
        <option value="Ouseburn">Ouseburn</option>
      </select>

      <label>EPC band</label>
      <div className="band-chips">
        <button
          type="button"
          className={`chip ${selectedBands.length === 0 ? "active" : ""}`}
          onClick={selectAllBands}
        >
          All
        </button>
        {ALL_BANDS.map((band) => (
          <button
            key={band}
            type="button"
            className={`chip ${selectedBands.includes(band) ? "active" : ""}`}
            onClick={() => toggleBand(band)}
          >
            {band}
          </button>
        ))}
      </div>

      <label>Property type</label>
      <select onChange={(e) => update({ propertyType: e.target.value || undefined })}>
        <option value="">All types</option>
        <option value="Offices">Offices</option>
        <option value="Retail">Retail</option>
      </select>

      <label className="checkbox-label floor-area-toggle">
        <input
          type="checkbox"
          checked={floorAreaEnabled}
          onChange={(e) => toggleFloorAreaEnabled(e.target.checked)}
        />
        Filter by floor area
      </label>
      <p className="filter-hint">Only some non-domestic buildings have floor area recorded.</p>
      <input
        type="range"
        min={0}
        max={5000}
        step={50}
        value={floorArea}
        disabled={!floorAreaEnabled}
        onChange={(e) => updateFloorArea(Number(e.target.value))}
      />
      <input
        type="number"
        min={0}
        max={5000}
        step={50}
        value={floorArea}
        disabled={!floorAreaEnabled}
        onChange={(e) => updateFloorArea(Number(e.target.value))}
      />

      <label>EPC issued within the last</label>
      <div className="issued-filter">
        <input
          type="number"
          min={1}
          placeholder="Any time"
          value={issuedValue}
          onChange={(e) => {
            const raw = e.target.value;
            updateIssued(raw === "" ? "" : Number(raw), issuedUnit);
          }}
        />
        <select
          value={issuedUnit}
          onChange={(e) => updateIssued(issuedValue, e.target.value as IssuedUnit)}
        >
          <option value="days">Days</option>
          <option value="months">Months</option>
          <option value="years">Years</option>
        </select>
      </div>
    </div>
  );
}

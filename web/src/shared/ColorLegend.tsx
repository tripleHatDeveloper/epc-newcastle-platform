interface Props {
  items: { label: string; color: string }[];
}

// Shown directly under a CesiumMap, so whatever coloring scheme that map
// uses (EPC band on the public viewer, validation status on the admin
// console) is always explained right where it's needed — especially
// useful once several colors can appear at once (e.g. "All bands"
// selected, or several statuses present in the admin queue).
export function ColorLegend({ items }: Props) {
  return (
    <div className="color-legend">
      {items.map(({ label, color }) => (
        <span key={label} className="legend-item">
          <span className="legend-swatch" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

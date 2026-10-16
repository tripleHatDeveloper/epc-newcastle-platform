// Multiple database records can map to the exact same building on the
// map — confirmed against real data, where a single large apartment block
// had over 100 separately-registered EPC records all sharing one OSM
// building outline. Without a deterministic rule, whichever record
// happened to be built into the color lookup last could differ from
// whichever one a plain array .find() happened to return first — meaning
// the color shown on the map for a building and the data shown after
// clicking it could silently disagree. This groups records by
// osm_feature_id and picks ONE consistent "representative" record per
// building, by a caller-supplied priority order, so both the map's color
// and the click handler always agree on the same record.
export function pickRepresentativeByOsmId<T extends { osm_feature_id: string | number | null }>(
  items: T[],
  priorityKey: (item: T) => string,
  priorityOrder: string[] // index 0 = highest priority (shown/colored first)
): Record<string, T> {
  const result: Record<string, T> = {};

  function rank(item: T): number {
    const index = priorityOrder.indexOf(priorityKey(item));
    return index === -1 ? priorityOrder.length : index; // unknown values sort last
  }

  for (const item of items) {
    if (item.osm_feature_id == null) continue;
    const key = String(item.osm_feature_id);
    const existing = result[key];
    if (!existing || rank(item) < rank(existing)) {
      result[key] = item;
    }
  }

  return result;
}

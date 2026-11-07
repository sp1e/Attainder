// The last year the event catalog has researched: the highest endYear among
// coverage ranges whose status is not "unresearched", or null when none is.
export function researchEndYear(coverage) {
  const ranges = Array.isArray(coverage?.ranges) ? coverage.ranges : [];
  const years = ranges
    .filter((range) => range && range.status !== "unresearched" && Number.isFinite(range.endYear))
    .map((range) => range.endYear);
  return years.length ? Math.max(...years) : null;
}

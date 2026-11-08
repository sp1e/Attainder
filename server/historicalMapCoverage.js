// What a historical package draws on its map beyond the playable courts. It lives apart from
// historicalCoverage.js, which imports historicalStartSummary.js, so the summary can use it
// without an import cycle.
const list = (value) => (Array.isArray(value) ? value : []);

// Map-only polities in package order, and the review features whose control is withheld,
// which the map draws without an owner. `h` is data.world.historicalScenario.
export const mapCoverage = (h) => {
  const playable = new Set(list(h?.playablePolityIds));
  return {
    mapOnly: list(h?.polities).filter(p => !playable.has(p?.id))
      .map(p => ({ id: p.id, nameSv: typeof p?.nameSv === "string" ? p.nameSv : p?.id })),
    unownedFeatureCount: list(h?.regionReview).filter(e => e?.boundaryDecision === "withheld-control").length,
  };
};

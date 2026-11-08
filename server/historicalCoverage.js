// What each shipped historical package covers, read from its built scenario data: the playable
// polities, the polities drawn on the map without a court, the reviewed map features and the
// sources. Pure functions over parsed data; callers read the files, so tests can pass fixtures.
import { mapCoverage } from "./historicalMapCoverage.js";
import { regionForPolity } from "./historicalStartSummary.js";

// The court dossier beside each package that has one, under server/seed/historical/courts/.
// Egypt has none. A dossier entry explains why a map-only polity has no court.
export const DOSSIER_FILES = Object.freeze({
  "charlemagne-800": "ad800-courts.json",
  "john-1200": "ad1200-courts.json",
  "world-1500": "ad1500-courts.json",
});

const list = (value) => (Array.isArray(value) ? value : []);
const nameOf = (polity) => (typeof polity?.nameSv === "string" ? polity.nameSv : polity?.id);

// The start summary needs mapCoverage too, and this file imports from it, so mapCoverage lives in
// its own module; it stays exported here for the report and the check script.
export { mapCoverage };

// { [value]: count } with the keys sorted, so the report reads the same on every run.
const countBy = (entries, key) => {
  const counts = {};
  for (const entry of entries) counts[entry?.[key]] = (counts[entry?.[key]] ?? 0) + 1;
  return Object.fromEntries(Object.keys(counts).sort().map(k => [k, counts[k]]));
};

const playableEntry = (h, id) => {
  const polity = list(h.polities).find(p => p?.id === id);
  const seat = list(h.settlements).find(s => s?.polityId === id);
  return {
    id, nameSv: nameOf(polity) ?? id, kind: polity?.kind ?? "state", regionId: regionForPolity(id),
    seatSv: seat?.nameSv ?? null, sourceCount: list(polity?.sourceIds).length,
  };
};

const mapOnlyEntry = (h, dossier, id) => {
  const polity = list(h.polities).find(p => p?.id === id);
  const entry = list(dossier?.polities).find(p => p?.polityId === id);
  return {
    id, nameSv: nameOf(polity), kind: polity?.kind ?? "state",
    dossierStatus: entry?.status ?? null, blockedReason: entry?.blockedReason ?? null,
  };
};

// The coverage of one package. `data` is the package's scenario data and `dossier` its parsed
// court dossier, or null when the package has none.
export const packageCoverage = ({ data, dossier = null }) => {
  const h = data?.world?.historicalScenario ?? {};
  const review = list(h.regionReview);
  return {
    contentId: h.contentId ?? null,
    contentVersion: h.contentVersion ?? null,
    date: data?.game?.gameDate ?? null,
    eraLabelSv: h.eraLabelSv ?? null,
    playable: list(h.playablePolityIds).map(id => playableEntry(h, id)),
    mapOnly: mapCoverage(h).mapOnly.map(p => mapOnlyEntry(h, dossier, p.id)),
    features: { total: review.length, byBoundary: countBy(review, "boundaryDecision"), byClassification: countBy(review, "classification") },
    sourceCount: Object.keys(h.sources ?? {}).length,
    areas: list(h.coverage).map(c => ({ area: c?.area, status: c?.status })),
  };
};

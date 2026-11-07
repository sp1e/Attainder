// The small record the start card reads for one historical scenario, built from the stored
// scenario data. Both library stores keep it in the scenario meta, so the card never has to load
// and validate a whole package to show a start. The structural checks here cover only what the
// card shows; the full validatePlayableScenario still runs when the player starts a campaign.
//
// Regions group the picker by geography, eras by the start year. Region ids for the playable
// polities live in seed/historical/polity-regions.json, checked by scripts/check-polity-regions.mjs.
import polityRegions from "./seed/historical/polity-regions.json" with { type: "json" };
import { parseGameDate } from "./gameDates.js";

// 2: each polity carries its court's start text (contextSv). A summary of another schema is rebuilt.
export const HISTORICAL_SUMMARY_SCHEMA = 2;

export const HISTORICAL_REGIONS = Object.freeze([
  Object.freeze({ id: "europe", labelSv: "Europa" }),
  Object.freeze({ id: "mena", labelSv: "Mellanöstern och Nordafrika" }),
  Object.freeze({ id: "sub-saharan-africa", labelSv: "Afrika söder om Sahara" }),
  Object.freeze({ id: "central-asia", labelSv: "Centralasien" }),
  Object.freeze({ id: "south-asia", labelSv: "Sydasien" }),
  Object.freeze({ id: "east-asia", labelSv: "Östasien" }),
  Object.freeze({ id: "southeast-asia", labelSv: "Sydostasien" }),
  Object.freeze({ id: "americas", labelSv: "Amerika" }),
  Object.freeze({ id: "oceania", labelSv: "Oceanien" }),
  Object.freeze({ id: "other", labelSv: "Övriga" }),
]);

// Signed calendar years as game dates write them: -1201 is 1201 BC and there is no year zero,
// so the bounds read the same as the era table in the design.
export const HISTORICAL_ERAS = Object.freeze([
  Object.freeze({ id: "bronze-age", labelSv: "Bronsålder", fromYear: -3300, toYear: -1201 }),
  Object.freeze({ id: "antiquity", labelSv: "Antiken", fromYear: -1200, toYear: 500 }),
  Object.freeze({ id: "early-middle-ages", labelSv: "Tidig medeltid", fromYear: 501, toYear: 1000 }),
  Object.freeze({ id: "high-middle-ages", labelSv: "Högmedeltid", fromYear: 1001, toYear: 1300 }),
  Object.freeze({ id: "late-middle-ages", labelSv: "Senmedeltid", fromYear: 1301, toYear: 1530 }),
]);

// { id, labelSv } of the era holding the date's year; a year outside every era takes the
// nearest one. Null when the date cannot be read.
export const historicalEraFor = (date) => {
  const year = parseGameDate(date)?.year;
  if (year === undefined) return null;
  const first = HISTORICAL_ERAS[0], last = HISTORICAL_ERAS[HISTORICAL_ERAS.length - 1];
  const era = year < first.fromYear ? first : year > last.toYear ? last
    : HISTORICAL_ERAS.find(e => year >= e.fromYear && year <= e.toYear);
  return { id: era.id, labelSv: era.labelSv };
};

const REGION_IDS = new Set(HISTORICAL_REGIONS.map(r => r.id));

export const regionForPolity = (polityId) => {
  const regionId = Object.hasOwn(polityRegions, polityId) ? polityRegions[polityId] : null;
  return REGION_IDS.has(regionId) ? regionId : "other";
};

// Lower case, no diacritics, single spaces: "  Östasien " and "ostasien" match.
export const foldSearchText = (text) => String(text ?? "")
  .normalize("NFD").replace(/\p{M}+/gu, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

const text = (value) => (typeof value === "string" ? value : null);

// One playable polity as the card shows it, or null when its court fails a check the card needs.
const polityEntry = (scenario, polityId) => {
  const polity = Array.isArray(scenario.polities) ? scenario.polities.find(p => p?.id === polityId) : null;
  const court = scenario.courtSeeds?.[polityId];
  if (!polity || !court || !Array.isArray(court.people) || !Array.isArray(court.families)) return null;
  const ruler = court.people.find(person => person?.id === court.rulerId);
  if (!ruler || court.families.length === 0) return null;
  return {
    id: polityId,
    nameSv: text(polity.nameSv) ?? polityId,
    regionId: regionForPolity(polityId),
    ruler: { name: text(ruler.name) ?? ruler.id, originLabelSv: text(ruler.originLabelSv) },
    // Null when the court has none; the card then shows the package's contextSv.
    contextSv: text(court.contextSv),
    families: court.families.map(family => ({ id: family?.id, name: text(family?.name) ?? family?.id })),
  };
};

// The historicalStart field of a library catalog entry, read from the scenario's summary: the
// start's date and content id for any historical scenario that is not a restore-only copy. The
// library bar lists a broken start too, so the player can open or delete it; the start card reads
// offersHistoricalStart, which leaves a summary without polities off.
export const historicalStartFromSummary = (summary, meta) =>
  summary && summary.notHistorical !== true && meta?.restoreOnly !== true
    ? { date: summary.date, contentId: summary.contentId } : null;

// Null for a scenario that is not historical. A historical scenario whose card data is broken
// gives { schema, sourceStamp, invalid: true, date, contentId } and is left off the card; this never throws.
export const historicalStartSummary = ({ meta, data, sourceStamp = null }) => {
  const scenario = data?.world?.historicalScenario;
  if (scenario?.kind !== "historical") return null;
  const date = data?.game?.gameDate;
  const invalid = { schema: HISTORICAL_SUMMARY_SCHEMA, sourceStamp, invalid: true, date: text(date), contentId: text(scenario.contentId) };
  const era = historicalEraFor(date);
  const ids = scenario.playablePolityIds;
  if (!era || !Array.isArray(ids) || ids.length === 0) return invalid;
  const polities = ids.map(id => polityEntry(scenario, id));
  if (polities.some(polity => polity === null)) return invalid;
  return {
    schema: HISTORICAL_SUMMARY_SCHEMA, sourceStamp,
    contentId: text(scenario.contentId), contentVersion: text(scenario.contentVersion),
    name: text(meta?.name), date, eraLabelSv: text(scenario.eraLabelSv), eraId: era.id,
    contextSv: text(scenario.contextSv), coverageNoteSv: text(scenario.coverageNoteSv),
    calendarNoteSv: text(scenario.calendarNoteSv),
    polities,
  };
};

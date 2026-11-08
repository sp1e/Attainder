// The public inventory of world cultures that Codex publishes as
// server/seed/historical/coverage/inventory.json: a privacy-cleared derivative, one row per
// retained culture. This module checks the contract in the Phase 6 design (section G2) and works
// out each row's shipped status against the built packages. Pure functions; callers read the file
// and pass `packages` as a Map of content id to data.world.historicalScenario.
import polityRegions from "./seed/historical/polity-regions.json" with { type: "json" };
import { HISTORICAL_REGIONS } from "./historicalStartSummary.js";
import { SHIPPED_HISTORICAL_PACKAGES } from "./historicalStarts.js";

export const INVENTORY_SCHEMA = "attainder-public-inventory-v1";
// The C4 vocabulary plus `pending` for rows not yet adjudicated.
export const RESEARCH_STATUSES = Object.freeze(["playable-candidate", "map-only", "needs-engine-kind", "no-source", "pending"]);
export const SHIPPED_STATUSES = Object.freeze(["playable", "on-map", ...RESEARCH_STATUSES]);

// Any key outside these lists is an error, so a private field cannot slip into the public file.
const TOP_KEYS = new Set(["schema", "preparedOn", "rows", "withheldRowCount"]);
const ROW_KEYS = ["id", "nameSv", "regionId", "startId", "polityId", "featureIndex", "researchStatus", "sourceUrl"];
const ROW_KEY_SET = new Set(ROW_KEYS);
const ROW_ID = /^[a-z0-9-]+\/[a-z0-9-]+$/;
const REGION_IDS = HISTORICAL_REGIONS.map(r => r.id).filter(id => id !== "other");
const NO_START = "no start";

const list = (value) => (Array.isArray(value) ? value : []);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const reviewEntry = (h, index) => list(h?.regionReview).find(e => e?.sourceIndex === index);
const hasPolity = (h, id) => list(h?.polities).some(p => p?.id === id);

// A YYYY-MM-DD string that names a real calendar day; Date rolls 2026-02-30 over to March.
const isCalendarDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isHttpsUrl = (value) => typeof value === "string" && URL.canParse(value) && new URL(value).protocol === "https:";

const topLevelErrors = (inventory) => {
  const errors = Object.keys(inventory).filter(k => !TOP_KEYS.has(k)).map(k => `inventory: ${k} is not a known top-level key`);
  if (inventory.schema !== INVENTORY_SCHEMA) errors.push(`inventory: schema must be ${INVENTORY_SCHEMA}`);
  if (!isCalendarDate(inventory.preparedOn)) errors.push("inventory: preparedOn must be a real YYYY-MM-DD date");
  if (!Array.isArray(inventory.rows)) errors.push("inventory: rows must be an array");
  if (Object.hasOwn(inventory, "withheldRowCount") && !(Number.isInteger(inventory.withheldRowCount) && inventory.withheldRowCount >= 0)) {
    errors.push("inventory: withheldRowCount must be a non-negative integer");
  }
  return errors;
};

// The start the row points at, or undefined when startId is null or names no loaded package.
const startOf = (row, packages) => (SHIPPED_HISTORICAL_PACKAGES.includes(row.startId) ? packages.get(row.startId) : undefined);

const startErrors = (row, packages) => {
  if (row.startId === null || startOf(row, packages)) return [];
  if (SHIPPED_HISTORICAL_PACKAGES.includes(row.startId)) return [`startId ${row.startId} has no package data to check against`];
  return [`startId ${JSON.stringify(row.startId)} is not a shipped start`];
};

// polityId and featureIndex point into the start's package; with an unknown start only the
// startId error is reported.
const referenceErrors = (row, packages) => {
  const errors = [];
  const h = startOf(row, packages);
  const known = row.startId === null || h;
  if (row.polityId !== null && row.startId === null) errors.push("polityId requires a startId");
  else if (row.polityId !== null && known && !hasPolity(h, row.polityId)) errors.push(`polityId ${JSON.stringify(row.polityId)} is not a polity in ${row.startId}`);
  if (row.featureIndex !== null && row.startId === null) errors.push("featureIndex requires a startId");
  else if (row.featureIndex !== null && known && !reviewEntry(h, row.featureIndex)) errors.push(`featureIndex ${JSON.stringify(row.featureIndex)} is not a regionReview sourceIndex in ${row.startId}`);
  return errors;
};

const regionErrors = (row) => {
  if (!REGION_IDS.includes(row.regionId)) return [`regionId ${JSON.stringify(row.regionId)} is not a region other than other`];
  if (typeof row.polityId === "string" && Object.hasOwn(polityRegions, row.polityId) && polityRegions[row.polityId] !== row.regionId) {
    return [`regionId ${row.regionId} differs from ${polityRegions[row.polityId]} in polity-regions.json for ${row.polityId}`];
  }
  return [];
};

const valueErrors = (row) => {
  const errors = [];
  if (typeof row.id !== "string" || !ROW_ID.test(row.id)) errors.push("id must match region/name in lowercase letters, digits and hyphens");
  if (typeof row.nameSv !== "string" || row.nameSv.trim() === "") errors.push("nameSv must be a non-empty string");
  if (!RESEARCH_STATUSES.includes(row.researchStatus)) errors.push(`researchStatus ${JSON.stringify(row.researchStatus)} is not a research status`);
  if (row.sourceUrl !== null && !isHttpsUrl(row.sourceUrl)) errors.push("sourceUrl must be null or an https:// URL");
  else if (row.sourceUrl !== null && row.researchStatus === "no-source") errors.push("sourceUrl must be null on a no-source row");
  if (row.polityId !== null && typeof row.polityId !== "string") errors.push("polityId must be null or a string");
  if (row.featureIndex !== null && !Number.isInteger(row.featureIndex)) errors.push("featureIndex must be null or an integer");
  return errors;
};

// Errors for one row, each prefixed with the row id so a long file reads row by row.
const rowErrors = (row, index, packages) => {
  const label = isObject(row) && typeof row.id === "string" ? row.id : `rows[${index}]`;
  if (!isObject(row)) return [`${label}: row must be an object`];
  const keyErrors = [
    ...Object.keys(row).filter(k => !ROW_KEY_SET.has(k)).map(k => `${k} is not a known row key`),
    ...ROW_KEYS.filter(k => !Object.hasOwn(row, k)).map(k => `${k} is missing`),
  ];
  const errors = [...keyErrors, ...valueErrors(row), ...regionErrors(row), ...startErrors(row, packages), ...referenceErrors(row, packages)];
  return errors.map(e => `${label}: ${e}`);
};

const duplicateErrors = (rows) => {
  const seen = new Set();
  const errors = [];
  for (const row of rows) {
    if (!isObject(row) || typeof row.id !== "string") continue;
    if (seen.has(row.id)) errors.push(`${row.id}: id is a duplicate`);
    seen.add(row.id);
  }
  return errors;
};

export const validatePublicInventory = (inventory, packages) => {
  if (!isObject(inventory)) return { ok: false, errors: ["inventory: must be an object with schema, preparedOn and rows"] };
  const rows = list(inventory.rows);
  const errors = [...topLevelErrors(inventory), ...duplicateErrors(rows), ...rows.flatMap((row, i) => rowErrors(row, i, packages))];
  return { ok: errors.length === 0, errors };
};

// First match wins. A withheld feature is drawn as `Okänd historisk kontroll`, not as a polity,
// so a row pointing at one falls through to its research status.
export const shippedStatus = (row, packages) => {
  const h = startOf(row, packages);
  if (row.polityId !== null && list(h?.playablePolityIds).includes(row.polityId)) return "playable";
  if (row.polityId !== null && hasPolity(h, row.polityId)) return "on-map";
  const feature = row.featureIndex === null ? undefined : reviewEntry(h, row.featureIndex);
  if (feature && feature.boundaryDecision !== "withheld-control") return "on-map";
  return row.researchStatus;
};

// Shipped status counts by start (shipped order, then rows without a start) and by region
// (HISTORICAL_REGIONS order without `other`). Every key and status is present, zero included.
// Expects an inventory that validatePublicInventory accepted.
export const inventoryTables = (inventory, packages) => {
  const zero = () => Object.fromEntries(SHIPPED_STATUSES.map(s => [s, 0]));
  const byStart = new Map([...SHIPPED_HISTORICAL_PACKAGES, NO_START].map(key => [key, zero()]));
  const byRegion = new Map(REGION_IDS.map(key => [key, zero()]));
  for (const row of list(inventory?.rows)) {
    const status = shippedStatus(row, packages);
    byStart.get(row.startId === null ? NO_START : row.startId)[status] += 1;
    byRegion.get(row.regionId)[status] += 1;
  }
  const table = (counts) => [...counts].map(([key, value]) => ({ key, counts: value }));
  return { byStart: table(byStart), byRegion: table(byRegion) };
};

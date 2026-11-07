// Checks server/seed/historical/polity-regions.json against the shipped historical packages.
// Every playable polity of a shipped package needs a known region other than "other", and every
// polity the file names must be playable in some shipped package.
//
// Run: node scripts/check-polity-regions.mjs --check
// Exits 0 when the file matches the packages and 1 with the problems listed otherwise.
// It is separate from build-historical-scenarios.mjs so the frozen package builder stays untouched.
import { readFileSync } from "node:fs";
import { HISTORICAL_BOOKMARKS } from "../server/historicalStarts.js";
import { HISTORICAL_REGIONS } from "../server/historicalStartSummary.js";

// John installs as scenario `default` and is not a bookmark, but ships as a package all the same.
const PACKAGE_IDS = [...HISTORICAL_BOOKMARKS.map(entry => entry.id), "john-1200"];
const historicalDir = new URL("../server/seed/historical/", import.meta.url);
const readJson = (relative) => JSON.parse(readFileSync(new URL(relative, historicalDir), "utf8"));

const playablePolities = () => new Map(PACKAGE_IDS.map(id => {
  const scenario = readJson(`${id}/scenario.json`).data?.world?.historicalScenario;
  return [id, Array.isArray(scenario?.playablePolityIds) ? scenario.playablePolityIds : []];
}));

const findProblems = (regions, playable) => {
  const known = new Set(HISTORICAL_REGIONS.map(region => region.id).filter(id => id !== "other"));
  const problems = [];
  for (const [packageId, polityIds] of playable) {
    if (polityIds.length === 0) problems.push(`${packageId}: no playable polities found`);
    for (const polityId of polityIds) {
      const regionId = Object.hasOwn(regions, polityId) ? regions[polityId] : undefined;
      if (!known.has(regionId)) problems.push(`${packageId}: playable polity ${polityId} has region ${JSON.stringify(regionId ?? null)}`);
    }
  }
  const shipped = new Set([...playable.values()].flat());
  for (const polityId of Object.keys(regions)) {
    if (!shipped.has(polityId)) problems.push(`polity-regions.json names ${polityId}, which no shipped package lists as playable`);
  }
  return problems;
};

if (!process.argv.includes("--check")) {
  console.error("Usage: node scripts/check-polity-regions.mjs --check");
  process.exit(2);
}
const problems = findProblems(readJson("polity-regions.json"), playablePolities());
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log(`polity-regions.json covers every playable polity of ${PACKAGE_IDS.join(", ")}.`);

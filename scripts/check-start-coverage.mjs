// Reads the shipped historical packages, their court dossiers and the public inventory, then
// writes (or with --check, compares) docs/coverage/start-coverage.md.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOSSIER_FILES, packageCoverage } from "../server/historicalCoverage.js";
import { renderStartCoverageReport, sameReport } from "../server/historicalCoverageReport.js";
import { inventoryTables, validatePublicInventory } from "../server/historicalInventory.js";
import { SHIPPED_HISTORICAL_PACKAGES } from "../server/historicalStarts.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HISTORICAL = path.join(ROOT, "server/seed/historical");
const INVENTORY = path.join(HISTORICAL, "coverage/inventory.json");
const REPORT = path.join(ROOT, "docs/coverage/start-coverage.md");
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
// The file's text, or null when it does not exist; any other read error is real and propagates.
const readIfPresent = (file) => fs.readFile(file, "utf8").catch((error) => (error.code === "ENOENT" ? null : Promise.reject(error)));

const readPackage = async (id) => ({
  data: (await readJson(path.join(HISTORICAL, id, "scenario.json"))).data,
  dossier: DOSSIER_FILES[id] ? await readJson(path.join(HISTORICAL, "courts", DOSSIER_FILES[id])) : null,
});

// The render input for the inventory section, or null while Codex has not published the file.
const readInventory = async (packages, inventoryPath) => {
  const text = await readIfPresent(inventoryPath);
  if (text === null) return null;
  let inventory;
  try {
    inventory = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (error) {
    throw new Error(`Public inventory is not valid JSON: ${error.message}`);
  }
  const result = validatePublicInventory(inventory, packages);
  if (!result.ok) throw new Error(`Public inventory is invalid:\n${result.errors.join("\n")}`);
  const { byStart, byRegion } = inventoryTables(inventory, packages);
  return { preparedOn: inventory.preparedOn, rowCount: inventory.rows.length, withheldRowCount: inventory.withheldRowCount ?? null, byStart, byRegion };
};

// The paths default to the repo files; tests pass temp paths so they never touch the real ones.
export async function checkStartCoverage({ check = false, inventoryPath = INVENTORY, reportPath = REPORT } = {}) {
  const read = await Promise.all(SHIPPED_HISTORICAL_PACKAGES.map(readPackage));
  const packages = new Map(SHIPPED_HISTORICAL_PACKAGES.map((id, i) => [id, read[i].data?.world?.historicalScenario]));
  const inventory = await readInventory(packages, inventoryPath);
  const report = renderStartCoverageReport({ coverages: read.map(packageCoverage), inventory });
  if (check) {
    const committed = await readIfPresent(reportPath);
    if (committed === null || !sameReport(committed, report)) throw new Error("Start coverage report differs from the committed file");
  } else {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, report, "utf8");
  }
  return { starts: read.length, inventoryRows: inventory?.rowCount ?? null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await checkStartCoverage({ check: process.argv.includes("--check") })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

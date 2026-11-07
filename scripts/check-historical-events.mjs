// Validates the historical event catalog and coverage index, then writes (or with
// --check, compares) docs/research/historical-events-coverage.md.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderCoverageReport, validateCoverage, validateEventCatalog } from "../server/historicalEventValidation.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVENTS_DIR = path.join(ROOT, "server/seed/historical/events");
const REPORT = path.join(ROOT, "docs/research/historical-events-coverage.md");
const lf = (text) => text.replace(/\r\n/g, "\n");
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(EVENTS_DIR, file), "utf8"));

export async function checkHistoricalEvents({ check = false } = {}) {
  const catalog = await readJson("catalog.json");
  const coverage = await readJson("coverage.json");
  const errors = [];
  for (const result of [validateEventCatalog(catalog), validateCoverage(coverage, catalog)]) {
    if (!result.ok) errors.push(...result.errors);
  }
  if (errors.length) throw new Error(`Historical event data is invalid:\n${errors.join("\n")}`);
  const report = renderCoverageReport(coverage, catalog);
  if (check) {
    const committed = await fs.readFile(REPORT, "utf8").catch(() => null);
    if (committed === null || lf(committed) !== report) throw new Error("Historical events report differs from the committed file");
  } else {
    await fs.mkdir(path.dirname(REPORT), { recursive: true });
    await fs.writeFile(REPORT, report, "utf8");
  }
  return { events: catalog.events.length, sources: catalog.sources.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await checkHistoricalEvents({ check: process.argv.includes("--check") })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

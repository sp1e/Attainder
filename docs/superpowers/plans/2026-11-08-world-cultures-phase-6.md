# World cultures Phase 6: coverage per start — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish coverage per historical start: a generated developer report from the packages, the dossiers and a Codex-published inventory derivative, plus one Swedish line per start on the start card.

**Architecture:** Pure functions in `server/historicalCoverage.js` (package coverage), `server/historicalInventory.js` (inventory contract) and `server/historicalCoverageReport.js` (Markdown). `scripts/check-start-coverage.mjs` reads files, renders and writes or compares `docs/coverage/start-coverage.md`; a server test runs it in check mode. The start summary rises to schema 4 with `mapCoverage`, which the card prints.

**Tech Stack:** Node 22 ESM, `node:test`, React (card), esbuild-compiled card tests.

**Spec:** `docs/superpowers/specs/2026-11-08-world-cultures-phase-6-design.md`

## Global Constraints

- No package bytes change. `node scripts/{build-historical-scenarios,check-historical-events,check-polity-regions,sync-default-scenario}.mjs --check` all exit 0 after every task.
- Never edit Codex files: `server/seed/historical/courts/`, `*-review.json`, `name-pools/`, `events/`, `sources/`, `docs/research/`, `docs/development/RESEARCH-STATUS.md`. `server/seed/historical/coverage/inventory.json` is Codex's; tests use in-memory fixtures and the repository ships no such file.
- No `random(state)` call; `rulesVersion` and `contentVersion` unchanged.
- Functions under about 50 lines, files under about 800.
- Repository text in English; player text in Swedish with å, ä and ö.
- Tests run serially: `node --test --test-concurrency=1 --test-reporter=tap <files>`. Run `node scripts/seed-web-defaults.mjs` before the full suite.
- Stage files by name. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push after each commit.

## Review Focus

1. A package without `regionReview` (or an empty one): `mapCoverage` gives `unownedFeatureCount: 0`, the card leaves the last sentence out, the report prints zero counts. Test in Task 1 and Task 4.
2. An inventory row or top level with an extra key (a private field slipping through): validation error naming the key. Test in Task 2.
3. A committed report checked out with CRLF on Windows: `--check` passes after LF normalisation. Test in Task 3 (render, convert to CRLF, compare through the same helper).
4. A row pointing at a `withheld-control` feature: shipped status falls through to `researchStatus`, never `on-map`. Test in Task 2.
5. Swedish names (`Västra Xia`, `Chimú`) survive report rendering byte for byte (UTF-8 write and read). Covered by Task 3's check-mode test on the real packages.

---

### Task 1: Package coverage

**Files:**
- Modify: `server/historicalStarts.js` (after `HISTORICAL_START_ORDER`, line 17)
- Modify: `scripts/check-polity-regions.mjs:12` (use the new export)
- Create: `server/historicalCoverage.js`
- Test: `server/historicalCoverage.test.js`

**Interfaces:**
- Produces: `SHIPPED_HISTORICAL_PACKAGES` (frozen array `["egypt-3000bc", "charlemagne-800", "world-1500", "john-1200"]`, built as bookmarks + `"john-1200"`).
- Produces: `DOSSIER_FILES` (frozen object `{ "charlemagne-800": "ad800-courts.json", "john-1200": "ad1200-courts.json", "world-1500": "ad1500-courts.json" }`).
- Produces: `mapCoverage(h) -> { mapOnly: Array<{ id, nameSv }>, unownedFeatureCount: number }` where `h` is `data.world.historicalScenario`. `mapOnly` = `h.polities` not in `h.playablePolityIds`, in package order; `nameSv` falls back to the id. Count = `regionReview` entries with `boundaryDecision === "withheld-control"`; missing array gives 0.
- Produces: `packageCoverage({ data, dossier = null }) -> { contentId, contentVersion, date, eraLabelSv, playable, mapOnly, features, sourceCount, areas }`:
  - `playable`: `[{ id, nameSv, kind, regionId, seatSv, sourceCount }]` in `playablePolityIds` order; `kind` defaults to `"state"`; `regionId` from `regionForPolity` (`server/historicalStartSummary.js:52`); `seatSv` = `nameSv` of the first `h.settlements[]` with matching `polityId`, else `null`; `sourceCount` = `polity.sourceIds.length` (0 when absent).
  - `mapOnly`: `[{ id, nameSv, kind, dossierStatus, blockedReason }]`; the last two from the dossier polity with `polityId === id`, else `null`.
  - `features`: `{ total, byBoundary: { [decision]: n }, byClassification: { [classification]: n } }`, keys sorted.
  - `sourceCount`: `Object.keys(h.sources ?? {}).length`.
  - `areas`: `[{ area, status }]` from `h.coverage ?? []`.

- [ ] **Step 1: Write the failing tests** in `server/historicalCoverage.test.js`:
  - `the shipped package list is the bookmarks plus John`: `deepEqual(SHIPPED_HISTORICAL_PACKAGES, ["egypt-3000bc", "charlemagne-800", "world-1500", "john-1200"])`.
  - `package coverage pins the shipped counts`: read each `server/seed/historical/<id>/scenario.json` and its dossier via `DOSSIER_FILES`; assert playable lengths 1/10/4/2, mapOnly ids `[]/[]/["western-xia","chimu"]/[]`, `features.byBoundary["withheld-control"]` 137/214/280/289, `sourceCount` 57/112/68/32 (Egypt, 800, 1200, 1500).
  - `map-only polities carry the dossier status and reason`: John's `western-xia` and `chimu` have `dossierStatus: "blocked"` and a non-empty `blockedReason`; `nameSv` `Västra Xia` and `Chimú`.
  - `a playable polity carries its seat and region`: John's `johns-realms` has `seatSv: "Windsor"`, `regionId: "europe"`.
  - `map coverage without review data counts zero`: `mapCoverage({ polities: [{ id: "a" }], playablePolityIds: ["a"] })` deep-equals `{ mapOnly: [], unownedFeatureCount: 0 }`; with a non-playable `{ id: "b" }` and no `nameSv`, `mapOnly` is `[{ id: "b", nameSv: "b" }]`.
- [ ] **Step 2: Run** `node --test --test-concurrency=1 --test-reporter=tap server/historicalCoverage.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the export in `historicalStarts.js`, the module, and switch `check-polity-regions.mjs` to `SHIPPED_HISTORICAL_PACKAGES` (its output line keeps listing the ids).
- [ ] **Step 4: Run** the test file, `server/historicalStartSummary.test.js` and `node scripts/check-polity-regions.mjs --check`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `feat(coverage): package coverage per historical start`.

### Task 2: Inventory contract

**Files:**
- Create: `server/historicalInventory.js`
- Test: `server/historicalInventory.test.js`

**Interfaces:**
- Consumes: `SHIPPED_HISTORICAL_PACKAGES` (Task 1), `HISTORICAL_REGIONS` (`server/historicalStartSummary.js:16`), `server/seed/historical/polity-regions.json`.
- Produces: `INVENTORY_SCHEMA = "attainder-public-inventory-v1"`, `RESEARCH_STATUSES = ["playable-candidate", "map-only", "needs-engine-kind", "no-source", "pending"]`, `SHIPPED_STATUSES = ["playable", "on-map", ...RESEARCH_STATUSES]`.
- Produces: `validatePublicInventory(inventory, packages) -> { ok: boolean, errors: string[] }`. `packages` is a `Map<contentId, h>`. Every rule in the spec's "Inventory contract" section; each error string starts with the row id (or `inventory` for the top level) and names the field.
- Produces: `shippedStatus(row, packages) -> string`, the spec's three rules in order.
- Produces: `inventoryTables(inventory, packages) -> { byStart: Array<{ key, counts }>, byRegion: Array<{ key, counts }> }`. `counts` has every `SHIPPED_STATUSES` key (0 when none). `byStart` keys follow `SHIPPED_HISTORICAL_PACKAGES` order and end with `"no start"`; `byRegion` keys follow `HISTORICAL_REGIONS` order without `other`. Keys with no rows are kept.

- [ ] **Step 1: Write the failing tests.** Build `packages` as a small in-memory Map: `charlemagne-800` with polities `carolingian-realm` (playable) and `old-realm` (not playable), `regionReview` with `sourceIndex` 5 (`accepted-world-scale-approximation`) and 9 (`withheld-control`). Tests:
  - `a valid inventory with every shipped status validates`: rows reaching `playable` (polityId `carolingian-realm`, regionId `europe`), `on-map` by polity (`old-realm`), `on-map` by feature 5, and one row per research status with `startId: null`; `ok === true`, `shippedStatus` values as named.
  - `a row on a withheld feature takes its research status`: featureIndex 9, `researchStatus: "pending"` gives `"pending"`.
  - `each field rule fails with its error`: one table-driven test, one case per rule: bad id shape, duplicate id, empty nameSv, regionId `other`, regionId mismatching `polity-regions.json` (`carolingian-realm` with `east-asia`), unknown startId, polityId unknown in the package, polityId with null startId, featureIndex absent from `regionReview`, featureIndex with null startId, unknown researchStatus, `http://` sourceUrl, `no-source` with a sourceUrl, an extra row key `privateNote`, an extra top-level key `inventoryCommit`, wrong `schema`, `preparedOn` `2026-13-01`, `rows` not an array, `withheldRowCount` `-1`. Each asserts `ok === false` and an error matching the field name.
  - `an empty row list is valid`: `{ schema, preparedOn: "2026-11-09", rows: [] }` gives `ok === true`.
  - `the tables count every status per start and region`: assert the `byStart` key order ends with `"no start"` and the counts for the valid fixture.
- [ ] **Step 2: Run** `node --test --test-concurrency=1 --test-reporter=tap server/historicalInventory.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `server/historicalInventory.js`. Read `polity-regions.json` with an import attribute as `historicalStartSummary.js:8` does; cross-check only when `Object.hasOwn(regions, polityId)`.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(coverage): public inventory contract and shipped status`.

### Task 3: Report and check script

**Files:**
- Create: `server/historicalCoverageReport.js`
- Create: `scripts/check-start-coverage.mjs`
- Create (generated): `docs/coverage/start-coverage.md`
- Test: `server/historicalCoverageReport.test.js`

**Interfaces:**
- Consumes: `packageCoverage`, `DOSSIER_FILES`, `SHIPPED_HISTORICAL_PACKAGES` (Task 1); `validatePublicInventory`, `inventoryTables`, `SHIPPED_STATUSES` (Task 2).
- Produces: `renderStartCoverageReport({ coverages, inventory }) -> string` (LF line endings, trailing newline). `coverages` is an array of `packageCoverage` results in `SHIPPED_HISTORICAL_PACKAGES` order. `inventory` is `null` or `{ preparedOn, rowCount, withheldRowCount, byStart, byRegion }`.
- Produces: `checkStartCoverage({ check = false } = {}) -> Promise<{ starts: number, inventoryRows: number | null }>` in the script, guarded by `process.argv[1]` as `scripts/check-historical-events.mjs:35` is. Inventory path `server/seed/historical/coverage/inventory.json`; a missing file gives `inventory: null`; an invalid one throws with every error. Drift in check mode throws `Start coverage report differs from the committed file`.
- Produces: `sameReport(committed, rendered) -> boolean` exported from the report module (LF-normalises `committed`).

Report text pinned by the spec section "Report (G3)". The first line is `# Coverage per start`, the second `Generated by scripts/check-start-coverage.mjs. Do not edit by hand.` With no inventory the inventory section reads: `The public inventory derivative \`server/seed/historical/coverage/inventory.json\` is not published yet. The request to Codex is in \`docs/development/CODEX-HANDOVER.md\`.` With an inventory it states `preparedOn`, the row count and, when present, `withheldRowCount`.

- [ ] **Step 1: Write the failing tests:**
  - `the report lists every start with its counts`: render from the real packages with `inventory: null`; assert the summary table has four rows, contains `Västra Xia` and `Chimú`, the withheld counts 137/214/280/289, and the not-published sentence.
  - `the report renders the inventory tables`: render with a hand-built `inventory` object; assert `preparedOn`, every `SHIPPED_STATUSES` column header and the `no start` row appear.
  - `the report is stable`: two renders are equal.
  - `a CRLF copy of the report still matches`: `sameReport(rendered.replace(/\n/g, "\r\n"), rendered) === true`, and a one-character change gives `false`.
  - `the committed start coverage report matches the packages`: `await checkStartCoverage({ check: true })` resolves to `{ starts: 4, inventoryRows: null }`.
- [ ] **Step 2: Run** `node --test --test-concurrency=1 --test-reporter=tap server/historicalCoverageReport.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the module and script, then run `node scripts/check-start-coverage.mjs` once to write `docs/coverage/start-coverage.md`. Read the file back and check the Swedish letters.
- [ ] **Step 4: Run** the test file and `node scripts/check-start-coverage.mjs --check`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** the three new files and the generated report: `feat(coverage): generated start coverage report`.

### Task 4: Summary schema 4 and the start card

**Files:**
- Modify: `server/historicalStartSummary.js:12-14,95-115`
- Modify: `src/runtime/historicalStartOptions.js:7-20,31-40`
- Modify: `src/Game/DynastyStartCard.jsx:70`
- Test: `server/historicalStartSummary.test.js`, `server/historicalSummaryStore.test.js`, `src/runtime/web/libraryStore.test.js`, `src/runtime/historicalStartOptions.test.js`, `src/Game/DynastyStartCard.test.js`

**Interfaces:**
- Consumes: `mapCoverage(h)` (Task 1).
- Produces: `HISTORICAL_SUMMARY_SCHEMA = 4`, comment line `4: each summary carries mapCoverage.`; valid summaries gain `mapCoverage` after `calendarNoteSv`. Invalid summaries keep their current shape.
- Produces: `option.mapCoverage` `{ mapOnly: [{ id, nameSv }], unownedFeatureCount }` from both `historicalStartOption` and `historicalStartOptionFromSummary` (a copy, not the summary's object).
- Produces: `coverageLineSv(option) -> string` exported from `src/runtime/historicalStartOptions.js`, the card's paragraph. Exact copy: `Spelbara riken i starten: <n>.` then ` På kartan utan spelbart hov: <names joined by ", ">.` when `mapOnly` is non-empty, then ` Kartområden utan granskad ägare: <count>.` when the count is above 0. `<n>` is `option.polities.length`.

- [ ] **Step 1: Update and add tests:**
  - Every `schema: 3` / `.schema, 3` assertion in the five test files becomes 4.
  - `historicalStartSummary.test.js`: `the John summary carries its map-only polities` asserts `mapCoverage` deep-equals `{ mapOnly: [{ id: "western-xia", nameSv: "Västra Xia" }, { id: "chimu", nameSv: "Chimú" }], unownedFeatureCount: 280 }`; Charlemagne gives `{ mapOnly: [], unownedFeatureCount: 214 }`.
  - `historicalSummaryStore.test.js`: `a summary stored under schema 3 is built again with map coverage`, copying the schema-2 test at line 151: set `schema = 3`, delete `mapCoverage`, assert the rebuilt entry has schema 4 and `mapCoverage.unownedFeatureCount === 214`, one world read, and the cached summary has `mapCoverage`.
  - `src/runtime/web/libraryStore.test.js`: the same schema-3 case beside the schema-2 one at line 743.
  - `historicalStartOptions.test.js`: `coverageLineSv` cases: John text `Spelbara riken i starten: 4. På kartan utan spelbart hov: Västra Xia, Chimú. Kartområden utan granskad ägare: 280.`; Charlemagne `Spelbara riken i starten: 10. Kartområden utan granskad ägare: 214.`; an option with one polity, no map-only and count 0 gives `Spelbara riken i starten: 1.`. Also both option builders expose equal `mapCoverage` for the John package.
  - `DynastyStartCard.test.js`: with `shippedOptions()`, selecting John shows the John text inside the `Källor och osäkerhet` details; selecting Charlemagne shows its text and no `På kartan utan spelbart hov`.
- [ ] **Step 2: Run** the five test files. Expected: FAIL on the new and changed assertions.
- [ ] **Step 3: Implement** the schema bump, `mapCoverage` in the summary and both option builders, `coverageLineSv`, and `<p>{coverageLineSv(selected)}</p>` after `<p>{selected.coverage}</p>` in the card.
- [ ] **Step 4: Run** the five test files, then `node scripts/seed-web-defaults.mjs` and the full serial suite `node --test --test-concurrency=1 --test-reporter=tap "server/**/*.test.js" "src/**/*.test.js"`. Expected: PASS (0 fail).
- [ ] **Step 5: Commit** `feat(coverage): start card shows what each start covers`.

### Task 5: Documentation and the Codex request

**Files:**
- Modify: `docs/development/CODEX-HANDOVER.md` (requests table after line 11)
- Modify: `docs/development/CONTINUE-HERE.md` (current checkpoint section)
- Modify: `docs/superpowers/specs/2026-11-07-world-cultures-design.md:35` (Phase 6 row: first slice built, programme ongoing)
- Modify: `docs/play-scripts/historical-foundation.md` (new `## Coverage per start` section with rows C-1 John card text, C-2 Charlemagne card text, C-3 console errors, each with an empty result column)

**Interfaces:** none.

- [ ] **Step 1:** Add the request row from the spec's section G5 to the CODEX-HANDOVER requests table, with the contract summarised and a pointer to the spec section "Inventory contract".
- [ ] **Step 2:** Add a Phase 6 paragraph to CONTINUE-HERE: the new modules, the script, the report path, schema 4, and that the inventory section waits for Codex.
- [ ] **Step 3:** Run `python ~/.claude/hooks/svenska-guard.py --svep --allt` and `node scripts/check-start-coverage.mjs --check`. Expected: no Swedish-letter findings, exit 0.
- [ ] **Step 4: Commit** `docs: Phase 6 coverage per start and the Codex inventory request`.

# World cultures Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A searchable start picker grouped by region and era, fed by per-scenario summaries in the library catalog, with per-start web files, saves that keep only the chosen court and a ranked prompt polity list.

**Architecture:** One shared pure module builds a start summary from stored scenario data. The web store writes it with every scenario meta; the desktop store caches it in the meta under a file stamp. The start card reads summaries only. The web seed script emits one module per package. `prepareHistoricalCampaignStart` narrows the saved courts, and `buildWorldSummary` ranks polities with the existing focus ranking.

**Tech Stack:** Node ESM, React 19, Vite, `node:test`, IndexedDB (fake-indexeddb in tests), Playwright for the browser run.

**Spec:** `docs/superpowers/specs/2026-11-07-world-cultures-phase-2-design.md` (parent: `docs/superpowers/specs/2026-11-07-world-cultures-design.md`).

## Global Constraints

- Released package bytes stay unchanged: `node scripts/build-historical-scenarios.mjs --check` exits 0, and `scripts/build-historical-scenarios.mjs` is not edited (its hash is frozen for Charlemagne 1.1.0).
- Do not edit Codex's research files: `server/seed/historical/courts/`, `name-pools/`, `ad800-review.json`, `ad1200-review.json`, `ad1500-review.json`, `bc3000-review.json`, `events/catalog.json`, `sources/`.
- Existing campaigns load and play unchanged. Migrations are additive.
- No change to the order of `random(state)` draws; reads draw no randomness; replay never calls the model.
- Every generated web file stays under 25 MiB.
- Game text is Swedish with å, ä and ö; repository docs are English. Region labels, in this order: Europa, Mellanöstern och Nordafrika, Afrika söder om Sahara, Centralasien, Sydasien, Östasien, Sydostasien, Amerika, Oceanien, then Övriga.
- Era rule: Bronsålder −3300 to −1201, Antiken −1200 to 500, Tidig medeltid 501 to 1000, Högmedeltid 1001 to 1300, Senmedeltid 1301 to 1530 (astronomical years, no year zero in labels; a year outside the range takes the nearest era).
- Functions under about 50 lines; the working copy is CRLF (edit with the Edit tool or Python binary writes, never `sed -i`).
- Run tests serially: `node --test --test-concurrency=1 <files>`. Run `node scripts/seed-web-defaults.mjs` before any `src/runtime/web/*.test.js`. Run `server/payloadUpdate.test.js` alone if it is ever needed.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage files by name.

## Review Focus

1. **Two copies of one start** (the shipped install plus a copy under another id): both appear on the card, and starting the copy creates the campaign from the copy. Test in Task 4.
2. **Search with Swedish letters and stray whitespace:** "kyrko", "KYRKO" and "Kyrkostaten " find Kyrkostaten; a query typed with or without å, ä and ö matches the same rows; a blank query shows every row. Test in Task 5.
3. **A stored start whose court is broken** (ruler missing from people): the catalog read does not throw, the start is left off the card and the other starts still show. Tests in Tasks 2 and 3.
4. **An edited desktop scenario** whose `game.json` date changed without a meta write: the next catalog read shows the new date. Test in Task 2.
5. **A non-primary polity start** (Kyrkostaten): the save keeps only the papal court, `playablePolityIds` is `['papal-states']`, and the campaign plays a year. Test in Task 6.

---

### Task 1: Shared start summary, regions and eras

**Files:**
- Create: `server/historicalStartSummary.js`
- Create: `server/seed/historical/polity-regions.json`
- Create: `scripts/check-polity-regions.mjs`
- Test: `server/historicalStartSummary.test.js`
- Modify: `package.json` (add the check to the existing `check`-style script list if one exists; otherwise leave scripts alone)

**Interfaces:**
- Produces, all exported from `server/historicalStartSummary.js`:
  - `HISTORICAL_SUMMARY_SCHEMA = 1`
  - `HISTORICAL_REGIONS`: frozen array of `{ id, labelSv }` in the Global Constraints order with ids `europe`, `mena`, `sub-saharan-africa`, `central-asia`, `south-asia`, `east-asia`, `southeast-asia`, `americas`, `oceania`, `other`.
  - `HISTORICAL_ERAS`: frozen array of `{ id, labelSv, fromYear, toYear }` with ids `bronze-age`, `antiquity`, `early-middle-ages`, `high-middle-ages`, `late-middle-ages`.
  - `historicalEraFor(date: string) -> { id, labelSv }` (date like `-3000-01-01` or `0800-12-25`).
  - `regionForPolity(polityId: string) -> string` (region id from `polity-regions.json`, `other` when absent).
  - `foldSearchText(text: string) -> string` (lower case, diacritics removed with NFD, whitespace collapsed and trimmed).
  - `historicalStartSummary({ meta, data, sourceStamp = null }) -> summary | null` where `null` means the scenario is not historical (`data.world.historicalScenario?.kind !== 'historical'`), and summary is the spec's shape with `schema: 1`, or `{ schema: 1, sourceStamp, invalid: true }`. `contentVersion` comes from `historicalScenario.contentVersion` (null when absent). `name` is `meta.name`, `date` is `data.game.gameDate`.

- [ ] **Step 1: Write the failing tests** in `server/historicalStartSummary.test.js`:
  - `historicalEraFor('-3000-01-01').id === 'bronze-age'`, `('-1200-01-01')` → `antiquity`, `('0500-12-31')` → `antiquity`, `('0800-12-25')` → `early-middle-ages`, `('1200-05-27')` → `high-middle-ages`, `('1530-12-31')` → `late-middle-ages`, `('1600-01-01')` → `late-middle-ages`.
  - `foldSearchText('  Östasien  ') === 'ostasien'`, `foldSearchText('KYRKOSTATEN') === 'kyrkostaten'`.
  - `regionForPolity('papal-states') === 'europe'`, `('egypt-early-dynastic') === 'mena'`, `('nowhere') === 'other'`.
  - On the shipped `server/seed/historical/charlemagne-800/scenario.json` (read with `readFileSync`), the summary has `eraId: 'early-middle-ages'`, `contentVersion: '1.1.0'`, polities `['carolingian-realm','papal-states']` in that order, Kyrkostaten's ruler name `Leo III`, every polity `regionId: 'europe'`, every polity at least one family.
  - Deleting `courtSeeds['papal-states'].rulerId`'s person from `people` in a clone gives `{ invalid: true }`; a world with no `historicalScenario` gives `null`.

- [ ] **Step 2: Run** `node --test --test-concurrency=1 server/historicalStartSummary.test.js`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `server/historicalStartSummary.js` and `server/seed/historical/polity-regions.json` (`{ "egypt-early-dynastic": "mena", "carolingian-realm": "europe", "papal-states": "europe", "johns-realms": "europe" }`). Load the JSON with `readFileSync` + `new URL(..., import.meta.url)` only if the web build can bundle it; otherwise use a JSON import with the import attribute the repo already uses, so the web bundle includes it (check how other server modules imported by `src/` load JSON).

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: Write `scripts/check-polity-regions.mjs`** with `--check`: for every package in `HISTORICAL_BOOKMARKS` plus `john-1200`, every `playablePolityIds` entry must have a region id in `HISTORICAL_REGIONS` (not `other`), and every key in `polity-regions.json` must be a playable polity of some shipped package. Prints the problems and exits 1 on any. Add a test in the same test file that runs it with `execFileSync(process.execPath, ['scripts/check-polity-regions.mjs','--check'])` and expects exit 0.

- [ ] **Step 6: Run** the test file and `node scripts/check-polity-regions.mjs --check`. Expected: PASS and exit 0.

- [ ] **Step 7: Commit** `Add shared historical start summaries with regions and eras`.

### Task 2: Desktop store caches summaries

**Files:**
- Modify: `server/libraryStore.js` (`buildScenarioCatalogEntry` near line 1899; `writeScenarioMeta` near line 824 is the write helper to reuse)
- Test: `server/historicalSummaryStore.test.js` (new; follow the store setup of `server/historicalStarts.test.js`)

**Interfaces:**
- Consumes: `historicalStartSummary`, `HISTORICAL_SUMMARY_SCHEMA` (Task 1).
- Produces: every scenario entry from `GET /api/scenarios` and `GET /api/library` carries `historicalSummary` (summary, `{invalid:true}` record, or `null`), and `historicalStart` is derived from it (`{ date, contentId }` when the summary is valid and the scenario is not `restoreOnly`, else `null`).

- [ ] **Step 1: Write the failing tests:**
  - After store setup the catalog entry for `charlemagne-800` has `historicalSummary.polities.map(p=>p.id)` equal to `['carolingian-realm','papal-states']`, and `default` (John) has `eraId: 'high-middle-ages'`.
  - A second catalog read does not call the summary builder again (spy by wrapping: count `readFileSync` of the scenario's `world.json`, or expose a test counter; choose the least intrusive and say which in the report).
  - Rewriting the scenario's `game.json` with a new `gameDate` (directly on disk, no meta write) makes the next catalog read show the new date (Review Focus 4).
  - A meta written by the old code (no `historicalSummary`) gains one after one catalog read, and its `updatedAt` is unchanged.
  - A stored historical scenario whose papal ruler is removed from the court's people: the catalog read succeeds, that entry has `historicalSummary.invalid === true` and `historicalStart === null`, and other entries are intact (Review Focus 3).

- [ ] **Step 2: Run** the new test file. Expected: FAIL.

- [ ] **Step 3: Implement** a helper `scenarioHistoricalSummary(scenarioId, meta)` in `server/libraryStore.js`: build `sourceStamp` as `"<worldSize>:<worldMtimeMs>:<gameSize>:<gameMtimeMs>"` from `statSync`; return the cached summary when `meta.historicalSummary?.schema === HISTORICAL_SUMMARY_SCHEMA` and its `sourceStamp` matches (`null` summaries are cached as `{ schema, sourceStamp, notHistorical: true }`); otherwise read world and game, build, write back with `writeScenarioMeta(id, { historicalSummary }, { touch: false })`, and return it. A failed write back logs a warning and still returns the summary. `buildScenarioCatalogEntry` uses it and stops reading `world.json` itself.

- [ ] **Step 4: Run** the new tests plus `server/historicalStarts.test.js server/gameCatalog.test.js server/historicalPreparation.test.js`. Expected: PASS.

- [ ] **Step 5: Commit** `Cache historical start summaries in desktop scenario metas`.

### Task 3: Web store projects summaries

**Files:**
- Modify: `src/runtime/web/libraryStore.js` (`projectScenarioMeta` line 67, `reconcileMeta` line 222, catalog assembly near line 259)
- Test: `src/runtime/web/libraryStore.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces: web catalog scenario entries carry `historicalSummary` with the same shape as Task 2, and `historicalStart` derived the same way.

- [ ] **Step 1: Write the failing tests:**
  - After seeding, the Charlemagne entry's `historicalSummary.polities` ids are `['carolingian-realm','papal-states']`.
  - A scenario meta written without `historicalSummary` (put it straight into the meta store) gains one after one catalog read, and the record store is read once for it.
  - A scenario record whose papal ruler is removed: catalog read succeeds, `historicalSummary.invalid === true`, `historicalStart === null` (Review Focus 3).

- [ ] **Step 2: Run** `node scripts/seed-web-defaults.mjs` then `node --test --test-concurrency=1 src/runtime/web/libraryStore.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement:** `projectScenarioMeta` adds `historicalSummary: historicalStartSummary({ meta: record.meta, data: record.json })` (with `sourceStamp: null`); `reconcileMeta` re-projects a scenario meta whose `historicalSummary` is `undefined` or has an older `schema` (only for the scenario store; pass a predicate so the game store is unaffected); the catalog derives `historicalStart` from the summary.

- [ ] **Step 4: Run** the web store tests plus `src/runtime/web/historicalDefaults.test.js src/runtime/web/saveMove.test.js`. Expected: PASS.

- [ ] **Step 5: Commit** `Project historical start summaries in the web library`.

### Task 4: Start options from summaries

**Files:**
- Modify: `src/runtime/historicalStartOptions.js`, `src/runtime/startDynastyCampaign.js`
- Test: `src/runtime/historicalStartOptions.test.js`, `src/runtime/startDynastyCampaign.test.js` (create if absent; mock `./library.js` the way `src/Game/DynastyStartCard.test.js` mocks modules)

**Interfaces:**
- Consumes: catalog `historicalSummary` (Tasks 2 and 3).
- Produces:
  - `historicalStartOptionFromSummary(scenarioId: string, summary) -> option` with the existing option shape (`scenarioId, name, date, label, context, coverage, calendarNote, polities[{ id, name, ruler, families }]`) plus `eraId` and, per polity, `regionId`.
  - `loadHistoricalStartOptions() -> Promise<option[]>`: catalog scenarios with a valid summary and not `restoreOnly`, through `orderHistoricalStarts`. No `loadScenarioDetails` or `downloadScenarioJsonAsset` calls.
  - `startDynastyCampaign({ option, mode, polityId, familyId, difficulty, characterDifficulty, seed })`: uses `option` when given; without it, falls back to `loadHistoricalStartOptions()` and `scenarioId` as today.
  - `historicalStartOption(details, regions, cities)` is removed if nothing else uses it after this task; otherwise kept.

- [ ] **Step 1: Write the failing tests:**
  - With a mocked catalog of three summaries, `loadHistoricalStartOptions()` returns three options and the mocked `loadScenarioDetails` and `downloadScenarioJsonAsset` were called 0 times.
  - An entry with `historicalSummary.invalid` and one with `restoreOnly` are left out.
  - Two catalog entries with the same summary under ids `charlemagne-800` and `charlemagne-800-copy` give two options; `startDynastyCampaign({ option: <copy option>, polityId: 'papal-states', mode: 'realm' })` calls `createGame` with `scenarioId: 'charlemagne-800-copy'` and name `Kyrkostaten, 800 e.Kr. · Riket`, and does not call `loadHistoricalStartOptions`' catalog read again (Review Focus 1).

- [ ] **Step 2: Run** the two test files. Expected: FAIL.

- [ ] **Step 3: Implement** the interfaces above.

- [ ] **Step 4: Run** the two files plus `src/runtime/historicalPlayables.test.js src/Game/DynastyStartCard.test.js`. Expected: PASS (update `DynastyStartCard.test.js` mocks only where the loader's signature changed).

- [ ] **Step 5: Commit** `Build historical start options from library summaries`.

### Task 5: Searchable picker

**Files:**
- Create: `src/runtime/historicalStartPicker.js` (pure grouping and filtering)
- Create: `src/Game/HistoricalStartPicker.jsx`
- Modify: `src/Game/DynastyStartCard.jsx` (replace the `historical-bookmark` and `historical-polity` selects; pass `option` to `onStart`/`startDynastyCampaign`), `src/Game/dynastyStart.css`
- Test: `src/runtime/historicalStartPicker.test.js`, `src/Game/DynastyStartCard.test.js`

**Interfaces:**
- Consumes: options from Task 4; `HISTORICAL_REGIONS`, `HISTORICAL_ERAS`, `historicalEraFor`, `foldSearchText` from Task 1.
- Produces:
  - `historicalStartRows(options) -> row[]`, one row per playable polity: `{ key: '<scenarioId>/<polityId>', scenarioId, polityId, polityName, eraLabelSv, eraId, regionId, rulerName, rulerOrigin, date, searchText }`.
  - `groupHistoricalStartRows(rows, query) -> [{ regionId, labelSv, eras: [{ eraId, labelSv, rows }] }]`: filters rows whose `searchText` (folded polity name, start name, era label and ruler name) contains the folded query; regions in `HISTORICAL_REGIONS` order, eras in `HISTORICAL_ERAS` order, rows by date then polity name with `localeCompare(…, 'sv')`; empty groups dropped.
  - `<HistoricalStartPicker options value onChange disabled />` where `value` and the `onChange` argument are `{ scenarioId, polityId }`.

- [ ] **Step 1: Write the failing tests** in `src/runtime/historicalStartPicker.test.js` with options built from the three shipped summaries:
  - A blank query (`''` and `'   '`) gives Europa (Tidig medeltid: Karls rike, Kyrkostaten; Högmedeltid: Johns riken) then Mellanöstern och Nordafrika (Bronsålder: Egypt's polity). Use the polity names from the summaries, not hard-coded guesses, for the Egypt and John names.
  - `'leo'` leaves only Kyrkostaten; `'kyrko'`, `'KYRKO'` and `'Kyrkostaten '` find Kyrkostaten (Review Focus 2).
  - A row whose polity has no region entry lands under Övriga, last.
  - `'zzz'` gives `[]`.

- [ ] **Step 2: Write the failing card tests** in `src/Game/DynastyStartCard.test.js`: the card renders a search field labelled `Sök rike, härskare eller tid`; region headings render as headings; typing `leo` leaves one radio row; an empty match shows `Inga starter matchar sökningen.`; choosing Kyrkostaten and clicking start calls `onStart` with `scenarioId: 'charlemagne-800'`, `polityId: 'papal-states'` and the matching `option`; the default selection is the first row of the first start in `HISTORICAL_START_ORDER`.

- [ ] **Step 3: Run** both test files. Expected: FAIL.

- [ ] **Step 4: Implement** the module, the component (radio group with roving `tabIndex` and arrow keys, as the card's mode radio group does) and the card change. Family select, mode, seed and difficulty stay. Row text: `<polityName> · <eraLabelSv>`, ruler line `<rulerName> · <rulerOrigin>` under it.

- [ ] **Step 5: Run** both test files and `src/runtime/historicalPlayables.test.js`. Expected: PASS.

- [ ] **Step 6: Commit** `Replace the start selects with a searchable picker grouped by region and era`.

### Task 6: Saves keep the chosen court

**Files:**
- Modify: `server/historicalPreparation.js` (`prepareHistoricalCampaignStart`, lines 65–109)
- Test: `server/historicalPreparation.test.js`, and one runtime test in `src/runtime/historicalCountryRuntime.test.js` or `src/runtime/characterRuntime.test.js` (the one that already advances a historical campaign a year)

**Interfaces:**
- Produces: a prepared campaign world where `historicalScenario.playablePolityIds` is `[polityId]` and `historicalScenario.courtSeeds` has only the `polityId` key; `polities` and all other fields unchanged.

- [ ] **Step 1: Write the failing tests:**
  - Preparing Charlemagne for `papal-states` in realm mode and in family mode gives `playablePolityIds` `['papal-states']`, `Object.keys(courtSeeds)` `['papal-states']`, `polities.length` 10, and the prepared world passes `validateHistoricalScenario` (Review Focus 5).
  - Preparing for `carolingian-realm` keeps only that court.
  - A save prepared with the old behaviour (clone the prepared world and restore both courts and both playable ids) loads and advances one year without error, and so does a narrowed one (use the existing year-advance helper of the chosen runtime test file).

- [ ] **Step 2: Run** the test files. Expected: the narrowing tests FAIL; the old-save test passes already.

- [ ] **Step 3: Implement** a small helper `narrowToChosenCourt(historicalScenario, polityId)` returning a new object, called after the character system is built and before `projectPreparedCharacterWorld`. Check that the second `validatePlayableScenario` call in the function still runs on the unnarrowed scenario or accepts the narrowed one; keep whichever order passes the existing tests.

- [ ] **Step 4: Run** the files plus `src/runtime/historicalPlayables.test.js server/characterGameBundle.test.js server/historicalGameOnlyZip.test.js`. Expected: PASS.

- [ ] **Step 5: Commit** `Keep only the chosen court in new historical campaigns`.

### Task 7: Per-start web files

**Files:**
- Modify: `scripts/seed-web-defaults.mjs` (line 141 area), `src/runtime/web/libraryStore.js` (`shippedStartBundle`, line 1477)
- Create (generated, git-ignored like the current file; check `.gitignore`): `src/runtime/web/generated/historical/<packageId>.js` and `src/runtime/web/generated/historical/index.js`
- Test: `src/runtime/web/historicalDefaults.test.js`, `server/characterGameBundle.test.js` (its `historicalBookmarks.js` stub)

**Interfaces:**
- Produces: `index.js` exports `const HISTORICAL_BUNDLE_LOADERS = { '<packageId>': () => import('./<packageId>.js') }` for every `HISTORICAL_BOOKMARKS` entry; each package module `export default <bundle>`. `shippedStartBundle(id)` awaits only `HISTORICAL_BUNDLE_LOADERS[id]()` and throws a clear error for an unknown id.

- [ ] **Step 1: Write the failing tests** in `historicalDefaults.test.js`: after the seed script, `generated/historical/index.js` lists exactly the `HISTORICAL_BOOKMARKS` ids; each package file exists and is under 25 MiB; `generated/historicalBookmarks.js` does not exist; installing all starts in the fake IndexedDB still works and creates a game per start (existing assertions).

- [ ] **Step 2: Run** the seed script and the test. Expected: FAIL.

- [ ] **Step 3: Implement** the seed output (delete the old `historicalBookmarks.js` when the script runs) and the loader; update the stub in `server/characterGameBundle.test.js`.

- [ ] **Step 4: Run** the seed script, `historicalDefaults.test.js`, `libraryStore.test.js`, `server/characterGameBundle.test.js`, then `npm run build:web` and list `dist-web/assets` to confirm one chunk per package. Expected: PASS, and one chunk file per package id. Record the chunk names and sizes in the report.

- [ ] **Step 5: Commit** `Emit one web module per shipped historical start`.

### Task 8: Ranked prompt polity list

**Files:**
- Modify: `src/Game/AI/promptContext.js` (`buildWorldSummary`, the polity summary near line 1540)
- Test: `src/Game/AI/promptPolityList.test.js` (new)

**Interfaces:**
- Consumes: `selectFocusPowers` from `src/Game/AI/regionFocus.js` (or the existing `rankFocusPowers` in `promptContext.js`, whichever already returns polity codes in rank order).
- Produces: `rankedPolitySummary(world, context) -> string` (exported for the test), used by `buildWorldSummary` in place of the current inline list.

- [ ] **Step 1: Write the failing tests:** a world with 20 `polityOverrides` where the player is the 20th in insertion order and two others are in pending actions: the player's line comes first, the two focus polities next, then 13 more full lines (16 total), then one line starting `Other polities:` naming the remaining 4. With 60 polities the names line holds 40 names and ends with `+4 more`. With 0 polities the text is `No dynamic polity overrides are currently recorded.`. With 10 polities and no focus the lines keep insertion order.

- [ ] **Step 2: Run** the test. Expected: FAIL.

- [ ] **Step 3: Implement** `rankedPolitySummary`, keeping each full line's current format.

- [ ] **Step 4: Run** the new test plus `src/Game/AI/jumpPromptCraft.test.js src/Game/AI/historicalPromptWiring.test.js src/Game/AI/promptLayout.test.js src/Game/AI/promptDedupe.test.js`. Expected: PASS. If a prompt snapshot changes only in polity order, update it and say so in the report.

- [ ] **Step 5: Commit** `Rank the prompt polity list by relevance`.

### Task 9: Verification and documentation

**Files:**
- Modify: `docs/development/CONTINUE-HERE.md`, `docs/development/DEVELOPMENT-BACKLOG.md` (new row: lazy installation of shipped starts, to revisit when shipped packages pass ten; new row: `componentLicenses` weight in saves; row 11: `readdirSync` after rename sits outside the try in `server/libraryStore.js` temp cleanup), `docs/play-scripts/historical-foundation.md` (new section "Searchable picker")

- [ ] **Step 1: Run** the full suite serially (`npm test` or the repo's serial command used in Phase 1), `npm run build`, `node scripts/build-historical-scenarios.mjs --check`, `node scripts/check-historical-events.mjs --check`, `node scripts/check-polity-regions.mjs --check`. Expected: 0 failures, every check exit 0. Lint: no new errors in touched files.
- [ ] **Step 2: Browser run** with Playwright: the server on port 4167 with an isolated `OH_DATA_DIR` in the scratchpad, and `npx vite --mode web --port 5199` with `/api/local-models/status` stubbed. On each: the card shows Europa and Mellanöstern och Nordafrika, typing `leo` leaves Kyrkostaten, starting it in realm mode shows Leo III in Rome, and the console shows no new errors. Record results in the play script.
- [ ] **Step 3: Update the docs** listed above.
- [ ] **Step 4: Commit** `Record world-cultures Phase 2 state and browser run`.

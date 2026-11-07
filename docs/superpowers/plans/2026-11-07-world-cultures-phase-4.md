# World cultures Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the built-in package `world-1500` (1.0.0, bookmark `1500-12-31`) with Aztekriket and Inkariket playable, both courts built from Codex's AD 1500 dossier.

**Architecture:** `dossier-courts.mjs` learns the AD 1500 dossier's shapes without changing older imports. `authoredScenario` accepts a dossier primary polity. The builder gets a `world-1500` package record with an AD 1500 review reader, pinned map, coverage and quarantine rows. Registration adds the start to both library stores and the region table.

**Tech Stack:** Node ESM, `node:test`, React (start card), Playwright for the browser check.

**Spec:** `docs/superpowers/specs/2026-11-07-world-cultures-phase-4-design.md`

## Global Constraints

- Never edit Codex's files: `server/seed/historical/courts/`, `name-pools/`, `events/`, `sources/`, and research fields of `ad1500-review.json`.
- Egypt 1.0.0, Charlemagne 1.2.0, John 1.1.0 and `server/seed/default` keep their bytes; `node scripts/build-historical-scenarios.mjs --check` proves it.
- Game text is Swedish with å, ä and ö; no dash as a clause separator, no "inte X, utan Y". Repository docs are English.
- Generated people: name ends ` (genererad)`, label `Genererad person`.
- Succession law: `primogeniture` or `merit` only.
- Files under `server/seed/historical/` are LF (`-text`); write them with binary Python or the Write tool, never `sed -i`.
- Functions under about 50 lines; `random(state)` call order unchanged; reads draw no randomness.
- Tests: `node --test --test-concurrency=1 <files>`. Run `node scripts/seed-web-defaults.mjs` before web tests and `node scripts/fetch-map-assets.mjs --ensure` before `npm run build`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage files by name. Do not push; the controller pushes.

## Review Focus

1. **Older packages drift.** Any importer change that touches AD 800 or AD 1200 output. Task 1 pins `build-historical-scenarios.mjs --check` after the importer change.
2. **A dossier primary with no polity text.** `namePlayables` and the card read `polities[0].nameSv`; Task 2 and Task 3 test that Aztekriket's record carries the review mapping's sources and note.
3. **A leaderless religion in play.** An Aztec campaign must play a year with `leaderId: null`. Task 4 plays a year from an Aztec start.
4. **Upgrade of an existing library.** A library without `world-1500` gains it once; a deleted copy stays deleted. Task 4 tests both stores.
5. **Generated names that match documented people.** Task 2 asserts no generated name contains a word from any dossier person's or withheld entry's name.

---

### Task 1: Importer reads the AD 1500 dossier

**Files:**
- Modify: `server/seed/historical/dossier-courts.mjs` (`ENGINE_LIMIT_TEXT_SV` :5-12, `sourcesFor` :148, `coverageLines` :161, `courtFor` :169-180, `dossierCourt` :185)
- Test: `server/seed/historical/dossier-courts.test.js`

**Interfaces:**
- Produces: `dossierCourt({ dossier, polityId, bookmarkYear, successionLaw, courtierNames, courtierBornAt, religionLeader })` where `religionLeader` is optional; `null` gives the religion `leaderId: null`, absent keeps today's rule (`religion.leaderPersonId ?? 'generated-courtier-3'`).

- [ ] **Step 1: Write the failing tests** in `dossier-courts.test.js`, reading `courts/ad1500-courts.json`:
  - `an AD 1500 dossier source with an object chronology imports its asWorded text`: build `aztec-empire` (law `merit`, three placeholder courtier names, born 1458/1462/1467); `built.sources['b2-aztec-met-chronology'].chronology` equals that source's `chronology.asWorded` in the dossier.
  - `collective-rule has a Swedish game-rule sentence`: `ENGINE_LIMIT_TEXT_SV['collective-rule'] === 'Spelet har ett ensamt härskarämbete. Råd och delat styre visas inte som egna ämbeten.'`, and the Aztec `coverageLinesSv` include it.
  - `the polity's engineLimitNotesSv joins the coverage lines`: the Aztec `coverageLinesSv` include the dossier's `engineLimitNotesSv` string.
  - `religionLeader null leaves the religion without a leader`: with `religionLeader: null`, `built.court.religions[0].leaderId === null`; the Inca court without the option has `leaderId === 'generated-courtier-3'`.
  - Both AD 1500 courts pass `validateHistoricalCourt` (as the existing ready-court test does).
- [ ] **Step 2: Run** `node --test --test-concurrency=1 server/seed/historical/dossier-courts.test.js`. Expected: the new tests FAIL (the Aztec build throws on `collective-rule` or the object chronology).
- [ ] **Step 3: Implement** the four changes: object chronology → `asWorded` (a string is unchanged); the `collective-rule` sentence; `engineLimitNotesSv` appended after the existing note fields in `coverageLines`; the `religionLeader` option threaded to `courtFor`.
- [ ] **Step 4: Run** the test file (PASS), then `node scripts/build-historical-scenarios.mjs --check` (exit 0: older packages unchanged).
- [ ] **Step 5: Commit** `Read the AD 1500 court dossier`.

### Task 2: A dossier primary and the `world-1500` authored entry

**Files:**
- Modify: `server/seed/historical/authored-scenarios.mjs` (`AUTHORED_PACKAGES` :163-236, `dossierPlayable` helper, `authoredScenario` :274-290)
- Test: create `server/world1500Scenario.test.js` (pattern: `server/johnScenario.test.js`)

**Interfaces:**
- Consumes: Task 1's `religionLeader` option.
- Produces: `authoredScenario('world-1500', { dossier })` returns `playablePolityIds` `['aztec-empire','inca-empire']`, `courtSeeds` for both, `settlements` `[tenochtitlan, cuzco]`, `polities[0]` `{ id: 'aztec-empire', nameSv: 'Aztekriket', ... }` whose `sourceIds` and `noteSv` Task 3 overwrites from the review mapping.
- A package entry with a dossier primary carries `dossier: { courtierNames, courtierBornAt, religionLeader? }`, `successionLaw`, and `polity: { nameSv, extra: {} }`; it has no `seat` or `court`.

- [ ] **Step 1: Write the failing tests** in `server/world1500Scenario.test.js` against `authoredScenario('world-1500', { dossier })`:
  - order and laws: `playablePolityIds` deep-equals `['aztec-empire','inca-empire']`; Aztec `successionLaw` `merit`, Inca `primogeniture`.
  - rulers and titles: Aztec ruler `ahuitzotl` holds office `ruler` named `Huey tlatoani`; Inca ruler `huayna-capac` named `Sapa inka`; `huascar` is in Huayna Capac's family.
  - religion: Aztec `religions[0].leaderId === null`; Inca `leaderId === 'generated-courtier-3'`.
  - courtiers: Aztec names `['Itztli (genererad)','Cuetzpalin (genererad)','Mazatl (genererad)']` born `1458-01-01`, `1462-01-01`, `1467-01-01`; Inca `['Kuntur Rimaq (genererad)','Qori Puma (genererad)','Rumi Sunqu (genererad)']` born `1456-01-01`, `1461-01-01`, `1466-01-01`.
  - no generated name shares a word (case-insensitive, length ≥ 4) with any `people[].nameSv` or `peopleWithheld[].who` in the AD 1500 dossier.
  - both court seeds pass `validateHistoricalCourt`.
  - `bookmarkDate` `1500-12-31`, `eraLabelSv` `1500 e.Kr.`, `contentVersion` `1.0.0`.
- [ ] **Step 2: Run** the file. Expected: FAIL `Unknown historical scenario: world-1500`.
- [ ] **Step 3: Implement** the dossier primary in `authoredScenario` (the primary's seat and court come from `dossierPlayableCourt` when `a.dossier` is set) and the `world-1500` entry: sources `hbm` and `naturalEarth` naming the `world_1500` map and AD 1500 (own records, not the shared ones), `contextSv` and `coverageNotePrefixSv` as name functions with the spec's wording (prefix: of 291 shapes, 2 accepted as approximate areas; Ming and the Ottoman Empire have no accepted shape and are not playable; `<n> riken är spelbara.`), `coverageBaseNoteSv` from Charlemagne, the Inca entry as a dossier extra.
- [ ] **Step 4: Run** the file (PASS) and `dossier-courts.test.js` (PASS).
- [ ] **Step 5: Commit** `Author the AD 1500 package with a dossier primary`.

### Task 3: Build the `world-1500` package

**Files:**
- Modify: `scripts/build-historical-scenarios.mjs` (`SOURCE_HASHES` :53, `PACKAGE_RECORDS` :69-130, `polityMappings` :165-175, new AD 1500 review-source reader)
- Generated: `server/seed/historical/world-1500/*`, `server/seed/historical/releases.json`, `server/seed/historical/released-provenance.json`
- Test: `server/world1500Scenario.test.js`

**Interfaces:**
- Consumes: Task 2's `authoredScenario('world-1500', { dossier })`.
- Produces: the built package files under `server/seed/historical/world-1500/` in the same four-file shape as `john-1200/`; `releases.json` rows for `world-1500` and the `world_1500` source.

- [ ] **Step 1: Write the failing tests** (read the built `world-1500/scenario.json` like `johnScenario.test.js` does):
  - `h.polities.map(p => p.id)` starts `['aztec-empire','inca-empire']`; Aztekriket's `sourceIds` start with `hbm` and contain `regional-met-aztec-reign-1486-1502` and no Getty id; its `noteSv` equals review mapping 80's `noteSv`.
  - regions `hbm-ad1500-80` owner `aztec-empire`, `hbm-ad1500-83` owner `inca-empire`; the features 77, 193, 223 carry `geometryStatus` `quarantined-unresolved`, `quarantined-invalid-source-geometry`, `quarantined-invalid-source-geometry`, and 290 carries `quarantined-rejected-for-1500`.
  - sources `regional-met-aztec-autonomy-west.chronology === 'Overview period; no exact day'`; a review source without `uncertainty` gets `The review records no separate uncertainty for this source.`; no `regional-ming-seat-unesco` or `regional-ottoman-modon` source (uncited).
  - the six coverage rows equal the spec's table (area, status, `regional-`-prefixed source ids except `hbm`/`naturalEarth`, `noteSv`).
  - `contextSv === 'Nyårsafton 1500. Spelbara riken: Aztekriket och Inkariket. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.'`
  - both Getty seat records are in `citySourceIds` and the ODC-By notice.
  - `releases.json` has the `hbm-world_1500.geojson` source with sha256 `d01ffc9b80629787f13d2b1c2f881f005bc0164433548e30f5c058ddee0bfc7b`; Egypt, Charlemagne and John rows deep-equal their `git show HEAD:` versions.
- [ ] **Step 2: Run** the file. Expected: FAIL (no built package).
- [ ] **Step 3: Implement** the pin, the reader (spec "Reader fallbacks"), the record (spec coverage table and quarantine statuses; `coreIndex: 80`; `mapMappings` drops Getty ids; the builder sets `h.polities[0].sourceIds` and `noteSv` from the core mapping for a dossier primary), then run `node scripts/build-historical-scenarios.mjs`, freeze the new `released-provenance.json` entry as the earlier packages are frozen, and rerun with `--check`.
- [ ] **Step 4: Run** the file and `server/historicalProvenance.test.js`, `server/johnScenario.test.js`, `server/historicalScenarios.test.js` (PASS); `--check` exit 0.
- [ ] **Step 5: Commit** `Build the AD 1500 package`.

### Task 4: Install, list and play the start

**Files:**
- Modify: `server/historicalStarts.js` (`HISTORICAL_BOOKMARKS` :11, `HISTORICAL_START_ORDER` :16), `server/seed/historical/polity-regions.json`, web defaults generated by `scripts/seed-web-defaults.mjs`
- Modify tests that lock counts or lists: `server/historicalStarts.test.js`, `src/runtime/web/historicalDefaults.test.js`, `src/runtime/web/libraryStore.test.js`, `server/historicalSummaryStore.test.js`, `server/builtInScenarioSeed.test.js`, `server/seed/historical/dossier-courts.test.js`, `src/Game/DynastyStartCard.test.js` where they list starts or rows
- Test: `server/world1500Scenario.test.js`

**Interfaces:**
- Produces: `HISTORICAL_BOOKMARKS` entry `{ id: "world-1500", marker: "historical-bookmarks-world-1500", contentVersion: "1.0.0" }`; `HISTORICAL_START_ORDER` `["charlemagne-800","default","egypt-3000bc","world-1500"]`.

- [ ] **Step 1: Write the failing tests:**
  - a desktop library read installs `world-1500` once beside the three starts; a second read adds nothing; a library where the player deleted it keeps it deleted (both stores; follow the existing Charlemagne install tests).
  - the start summary lists Aztekriket and Inkariket under region `americas`.
  - prepared starts reach `aztec-empire` and `inca-empire` in realm and family mode on the server and the web store (follow `johnScenario.test.js` "a prepared start reaches France"); the Aztec realm start plays one year without error.
  - Inca realm start: ruler Huayna Capac, heir Huáscar.
- [ ] **Step 2: Run** them. Expected: FAIL (start not registered).
- [ ] **Step 3: Implement** the registration, the two `polity-regions.json` rows (`americas`), run `node scripts/seed-web-defaults.mjs`, and update the count-locked tests (15 → 17 playables, three → four shipped starts).
- [ ] **Step 4: Run** the changed test files, `node scripts/check-polity-regions.mjs --check`, `node scripts/sync-default-scenario.mjs --check` (all PASS).
- [ ] **Step 5: Commit** `Install the AD 1500 start`.

### Task 5: Docs, full suite, build and browser check

**Files:**
- Modify: `docs/development/CONTINUE-HERE.md`, `docs/development/DEVELOPMENT-BACKLOG.md`, `docs/development/CODEX-HANDOVER.md`, `docs/play-scripts/historical-foundation.md` (section "AD 1500 start, Phase 4")

- [ ] **Step 1:** Full suite `node --test --test-concurrency=1` (0 fail); `npm run build`; the four `--check` scripts; eslint on changed files.
- [ ] **Step 2:** Playwright against `PORT=4167` with `OH_DATA_DIR` in the scratchpad and against `npx vite --mode web --port 5199`: the card shows 1500 under Amerika; Aztekriket starts with Ahuitzotl at Tenochtitlan, Inkariket with Huayna Capac at Cusco; 0 console errors.
- [ ] **Step 3:** Update the docs with the evidence; run `python ~/.claude/hooks/svenska-guard.py --svep --allt`.
- [ ] **Step 4: Commit** `Document the AD 1500 start`.

# World cultures Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one historical package offer several playable polities, enforce the generated-person label and the engine's start-time refusals in the validator, move the start range to AD 1530, and prove the pipeline by making the Papal States playable at AD 800.

**Architecture:** Authored packages gain `extraPlayables`; the builder maps, seats and validates every playable polity. The validator absorbs the checks `scenarioSeed.js` makes at start time. Shipped starts carry a content version, and the library replaces an older installed copy in place. Tests that named the three starts by hand iterate the catalog.

**Tech Stack:** Node ESM, `node:test`, React 18 (JSX), the existing build at `scripts/build-historical-scenarios.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-07-world-cultures-design.md`.

## Global Constraints

- `egypt-3000bc` and `john-1200` keep their exact bytes. `node scripts/build-historical-scenarios.mjs --check` proves it after every task that touches the builder or authored data.
- Charlemagne's outputs change only in Task 5 and only by the Papal States additions and the content version.
- Existing saves load unchanged. `rulesVersion`, the engine `CONTENT_VERSION` and `EXTENSIONS_VERSION` do not change. Migrations are additive.
- The engine decides, the model narrates. All randomness comes from stored streams; the order of `random(state)` in `annualStep` does not change. Reads and presentations draw no randomness. Replay never calls the model.
- Do not present invented coordinates, borders, rulers or dates as researched history. Generated people carry `originLabelSv: 'Genererad person'` and a name ending in ` (genererad)`.
- Player text is Swedish with å, ä and ö. Docs are English. Functions stay under about 50 lines.
- Preserve AGPL, GPL and CC BY notices and upstream attribution.
- Run the suite serially: `node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"`.
- Codex owns research files (`docs/development/CODEX-RESEARCH-BRIEF.md` section 2). Do not edit `server/seed/historical/courts/`, `name-pools/`, `ad1500-review.json` or `events/catalog.json`.

## Rulings

Ruling: freeze Charlemagne's current provenance in `released-provenance.json` before any builder edit — its manifest hashes the live builder and authored file, so every edit would change its bytes — a stale generator hash in its manifest, fixed by a rebuild.

Ruling: the Papal States become playable at AD 800 with Leo III documented — `ad800-review.json` already sources him, Rome and the shape — remove the `extraPlayables` entry to undo.

Ruling: Leo III's court uses `successionLaw: 'merit'` — the engine's closest analogue to election — a later phase adds an elective law.

Ruling: the validator imports `ARCHETYPES`, `TRAITS` and `SKILL_LABELS` from `server/characters/content.js` — that module has no imports, so no cycle, and a copy would drift — the validator depends on engine content.

Ruling: an installed shipped start whose stored `historicalScenario.contentVersion` is older than the shipped one is replaced in place on the next library read; a deleted start stays deleted — the marker system otherwise freezes old content — a player's hand edit of a shipped start is overwritten on upgrade.

Ruling: `RESEARCH_END_YEAR` in `HistoricalRecordView.jsx` stays 1200 — it states event research coverage, which has not moved — none until research passes 1200.

## Review Focus

1. A generated person with any label other than `Genererad person` is refused; Egypt, John and Charlemagne still validate.
2. Every refusal `validateEngineSeed` makes is also a validator refusal, so the start card can never offer a start that fails on click.
3. Egypt and John bytes are unchanged; Charlemagne changes only as stated.
4. Both AD 800 polities start in realm and family mode, on server and web, and the Papal States court seeds merit succession.
5. The upgrade path never resurrects a deleted start and never touches a running campaign.

---

### Task 1: Freeze Charlemagne provenance

**Files:**
- Modify: `server/seed/historical/released-provenance.json`
- Test: `server/historicalProvenance.test.js`, `node scripts/build-historical-scenarios.mjs --check`

- [ ] **Step 1:** Read the current `charlemagne-800/manifest.json` and copy its `generator`, `sourceFiles` and `authoredInputs` into a `charlemagne-800` entry of `released-provenance.json`, in the shape the Egypt and John entries use.
- [ ] **Step 2:** Add a test in `server/historicalProvenance.test.js` that each id in `HISTORICAL_BOOKMARKS` plus `john-1200` has a released-provenance entry whose `generator`, `sourceFiles` and `authoredInputs` deep-equal its built manifest.
- [ ] **Step 3:** Run the test and `--check`. Expected: PASS and exit 0, no output file changed.
- [ ] **Step 4:** Make a harmless whitespace edit to a comment in `scripts/build-historical-scenarios.mjs`, run `--check`, confirm it still passes, and revert the edit.
- [ ] **Step 5:** Commit: `Freeze the Charlemagne release provenance`.

### Task 2: Validator rules for labels, engine refusals and succession

**Files:**
- Modify: `server/historicalScenarios.js`
- Test: `server/historicalScenarios.test.js`

**Interfaces:**
- `validateHistoricalCourt` and `validateHistoricalScenario` return `invalidCourt` for each new refusal. No new failure codes.

Tests first. Each case starts from a valid court cloned from the built Charlemagne package (or the existing fixture helper in the test file) and changes one thing:

1. a generated person with `originLabelSv: 'Kung'` → `invalidCourt`;
2. a documented person whose label does not start with `Dokumenterad person` → `invalidCourt`;
3. a person id `person-7` → `invalidCourt`;
4. a person with two spouse ids → `invalidCourt`;
5. a person with `sex: 'other'` → `invalidCourt`;
6. mechanics with an unknown trait, an unknown archetype, or a negative skill → `invalidCourt`;
7. a parent cycle (A parent of B, B parent of A) → `invalidCourt`;
8. an office with id `steward` → `invalidCourt`;
9. an entity id with a space or `__proto__` in people, families, religions, offices or cities → `invalidCourt`;
10. `successionLaw: 'tanistry'` → `invalidCourt`; `'merit'` and `'primogeniture'` and absent → valid;
11. Egypt, John and Charlemagne packages still validate.

- [ ] **Step 1:** Write the tests. Run them. Expected: cases 1–10 FAIL where the validator accepts today.
- [ ] **Step 2:** Implement in `server/historicalScenarios.js` as small helpers (`validLabel`, `validEngineShape`) called from the court check. Import the three tables from `./characters/content.js`. Keep `validateEngineSeed` in `scenarioSeed.js` as defence in depth.
- [ ] **Step 3:** Run `node --test server/historicalScenarios.test.js src/runtime/historicalScenarios.test.js src/runtime/characters/scenarioSeed.test.js`. Expected: PASS.
- [ ] **Step 4:** Commit: `Refuse unlabelled generated people and engine-incompatible courts in the validator`.

### Task 3: Seed the court's succession law

**Files:**
- Modify: `server/characters/scenarioSeed.js`
- Test: `src/runtime/characters/scenarioSeed.test.js`

- [ ] **Step 1:** Test: a court with `successionLaw: 'merit'` yields `state.realm.successionLaw === 'merit'`; a court without it yields `'primogeniture'`; the seeded state draws the same rng values as before for an unchanged court (compare `rngState` and the log with a court that omits the field).
- [ ] **Step 2:** Implement: after `createCharacterState`, set `state.realm.successionLaw = court.successionLaw ?? 'primogeniture'`. Also refuse in `validateEngineSeed` any other value.
- [ ] **Step 3:** Run the scenario seed tests. Expected: PASS.
- [ ] **Step 4:** Commit: `Seed the authored succession law`.

### Task 4: Move the start range to AD 1530

**Files:**
- Modify: `server/historicalStarts.js` (lines 3–4), `src/Game/DynastyStartCard.jsx` (heading), `server/seed/historical/events/coverage.json`, `docs/research/historical-events-coverage.md` (regenerated)
- Test: `src/runtime/historicalStarts.test.js`, `server/historicalStarts.test.js`, `server/historicalEvents.test.js`, `src/runtime/web/libraryStore.test.js`, `src/runtime/historicalScenarios.test.js`, `server/historicalPreparation.test.js`

- [ ] **Step 1:** Update tests first: the range is `{ minYear: -3300, maxYear: 1530 }`; the refusal reads `Välj ett giltigt startdatum mellan 3300 f.Kr. och 1530 e.Kr.`; `1530-12-31` is accepted and `1531-01-01` refused. Every test that used a year in 1201–1530 as "past the limit" moves to 1531. Event fixtures that end at 1200 extend to 1530. Run; expected FAIL.
- [ ] **Step 2:** Change the constant, the refusal text and the card heading (`3300 F.KR.–1530 E.KR.`, matching the current casing). Add the coverage range `{ "startYear": 1201, "endYear": 1530, "status": "unresearched", "note": "Annual research has not started in this catalog." }` and run `node scripts/check-historical-events.mjs`.
- [ ] **Step 3:** Run the listed tests and `node scripts/check-historical-events.mjs --check`. Expected: PASS.
- [ ] **Step 4:** Update the docs that state the range as current: `README.md`, `docs/development/CONTINUE-HERE.md`, `docs/development/DEVELOPMENT-BACKLOG.md`, `docs/play-scripts/historical-foundation.md`, `docs/development/CODEX-HANDOVER.md`. Leave dated plans as records.
- [ ] **Step 5:** Commit: `Allow new campaigns to start up to AD 1530`.

### Task 5: Several playable polities per package, and the Papal States

**Files:**
- Modify: `server/seed/historical/authored-scenarios.mjs`, `scripts/build-historical-scenarios.mjs`, `server/seed/historical/charlemagne-800/*` (rebuilt), `server/seed/historical/releases.json` (rebuilt), `docs/research/historical-scenarios.md`
- Test: `server/historicalScenarios.test.js`, `server/historicalProvenance.test.js`, `src/runtime/characters/scenarioSeed.test.js`

**Interfaces:**
- `AUTHORED_PACKAGES[id].extraPlayables?: Array<{ polityId, seat, court, successionLaw? }>`. `seat` uses the same fields as the primary seat. `court` is a court spec for `court()`, extended with `rulerOfficeName`, `partnerId: null`, `household` and `annotatePeople`.
- `court()` accepts `familyId` and `familyName` for the ruling family id (default `royal-house`) so two courts never share family ids that mean different houses, and returns `successionLaw` when the spec sets it.
- `authoredScenario(contentId)` emits polities, settlements and `courtSeeds` for the primary and every extra playable; `playablePolityIds` is primary first. A seat already listed in `otherSettlements` (Rome) is not emitted twice.

Papal States content, all from `ad800-review.json` (`church`, `settlements`, `mapMappings` index 222) and its `sources`:

- Polity `papal-states`, name `Kyrkostaten`, seat `rome`.
- Ruler `leo-iii`, `Leo III`, documented, office name `Påve`, identity claim sourced to `ce-leo3`, `rfa-801-coronation`, `ce-papal-states` with the role `Biskop av Rom sedan 795.` Birth: generated game value `0750-01-01` with the note `Ingen källa ger födelseår. Den första januari 750 är ett spelvärde.` Kinship: generated, no parents.
- No spouse, no household. Three generated courtiers on the existing pattern with names ending in ` (genererad)`. Ruling family id `leo-household`, name `Leos hushåll`, with a generated family claim.
- Religion `latin-church`, `Den latinska kyrkan`, leader `leo-iii`, identity claim sourced to `ce-leo3` and `rfa-801-coronation`.
- `successionLaw: 'merit'`. Office claim sourced to `ce-leo3` (elected 26 December 795).
- Charlemagne `contentVersion` becomes `1.1.0`; its `coverageNotePrefixSv` and `contextSv` mention that Kyrkostaten is playable.

Builder:
- `polityMappings` maps every playable polity to its reviewed feature (the extra playable's feature comes from the review's `mapMappings`); remove the hard-coded `playablePolityIds[0]` except for the primary `coreIndex`.
- `citiesFor` sets `seat: true` for every playable polity's seat settlement.
- The bundle name and `game.country` stay on the primary polity; validation runs for every playable id.

- [ ] **Step 1:** Tests first: the Charlemagne package lists `['carolingian-realm','papal-states']` as playable; `validateHistoricalScenario` passes for both ids; `createHistoricalCharacterSystem` starts `papal-states` in realm mode with ruler `leo-iii`, `realm.successionLaw === 'merit'`, and in family mode; Leo's `originLabelSv` starts with `Dokumenterad person`; every generated person in every package has the generated label. Run; expected FAIL.
- [ ] **Step 2:** Implement authoring and builder changes. Run `node scripts/build-historical-scenarios.mjs`, then `--check`. Expected: Egypt and John unchanged (compare `git diff --stat`), Charlemagne rebuilt.
- [ ] **Step 3:** Run the tests. Expected: PASS.
- [ ] **Step 4:** Add a "Papal States at AD 800" paragraph to `docs/research/historical-scenarios.md`: sources used, what is generated, the merit-succession ruling.
- [ ] **Step 5:** Commit: `Make the Papal States playable at AD 800`.

### Task 6: Upgrade installed shipped starts

**Files:**
- Modify: `server/historicalStarts.js` (`HISTORICAL_BOOKMARKS` gains `contentVersion`), `server/libraryStore.js` (`ensureScenarioStore`), `src/runtime/web/libraryStore.js` (the bookmark install loop), `scripts/seed-web-defaults.mjs` if it reads the bookmark list
- Test: `server/historicalStarts.test.js`, a server library store test, `src/runtime/web/libraryStore.test.js`

**Interfaces:**
- `HISTORICAL_BOOKMARKS` entries: `{ id, marker, contentVersion }`. `egypt-3000bc` is `1.0.0`, `charlemagne-800` is `1.1.0`. A test asserts each entry's `contentVersion` equals the built package's `world.historicalScenario.contentVersion`.
- A pure helper `shippedStartNeedsUpgrade(storedBundle, entry)`: true when the stored bundle's `historicalScenario.contentId === entry.id` and its `contentVersion` compares lower (semantic version, numeric parts).

- [ ] **Step 1:** Tests first, server and web: (a) installed 1.0.0 with marker present → replaced by 1.1.0 on read, selection and order unchanged; (b) marker present and id absent from the manifest (deleted) → stays absent; (c) installed 1.1.0 → untouched, no write; (d) a campaign started from 1.0.0 keeps its own scenario data byte for byte; (e) a stored bundle under the id whose `contentId` differs (player import) → untouched. Run; expected FAIL.
- [ ] **Step 2:** Implement the helper in `server/historicalStarts.js` and call it from both stores after the marker check. Validate the shipped bundle before replacing, as install does.
- [ ] **Step 3:** Run the store tests and `npm run build`. Expected: PASS.
- [ ] **Step 4:** Commit: `Upgrade installed shipped starts to their new content version`.

### Task 7: Catalog-driven tests

**Files:**
- Modify: `src/Game/Characters/characterModelCalls.test.js`, `src/Game/Characters/CharactersPanel.test.js`, `src/runtime/characterRuntime.test.js`, `src/runtime/characterWorld.gate.test.js`, `src/Game/Map/vnext/historicalPolarGlobe.test.js`, `src/Game/Map/vnext/historicalPolarMercator.test.js` (each where it lists the start ids by hand)
- Create: `src/runtime/historicalPlayables.test.js`

- [ ] **Step 1:** Replace each hand-written list of start ids with one derived from `HISTORICAL_BOOKMARKS` plus `default`, keeping each test's assertion.
- [ ] **Step 2:** Create `historicalPlayables.test.js`: for every shipped package and every id in its `playablePolityIds`, `validateHistoricalScenario` passes and `createHistoricalCharacterSystem` starts in realm and family mode with a ruler whose office holder is the court's `rulerId`.
- [ ] **Step 3:** Run the changed tests. Expected: PASS.
- [ ] **Step 4:** Commit: `Drive historical start tests from the catalog`.

### Task 8: Verify and hand over

- [ ] **Step 1:** Run the full suite serially, `npm run lint`, `npm run build`, `node scripts/build-historical-scenarios.mjs --check`, `node scripts/check-historical-events.mjs --check`.
- [ ] **Step 2:** Browser check against the local server: the start card at AD 800 offers both polities; start Kyrkostaten in realm mode and confirm Leo III, Rome and merit succession; start a family campaign; confirm the heading reads 1530. Repeat the Kyrkostaten start in the web build.
- [ ] **Step 3:** Update `docs/development/CONTINUE-HERE.md`, `docs/development/CODEX-HANDOVER.md` and `docs/development/DEVELOPMENT-BACKLOG.md` with the state and next phase.
- [ ] **Step 4:** Commit, push, open the PR, merge when `test` is green, verify the remote `main`.

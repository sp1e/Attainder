# World cultures Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eleven `ready` dossier polities playable: eight in Charlemagne 1.2.0 (AD 800) and three in John 1.1.0 (AD 1200, scenario `default`).

**Architecture:** A pure module, `server/seed/historical/dossier-courts.mjs`, turns a dossier polity into the court, seat, sources and coverage text the builder already emits for hand-authored polities. Each court carries its own start text, which the summary, card and campaign narrowing read. Both packages are rebuilt with fresh provenance; John's `server/seed/default` copy is generated and checked by a script.

**Tech Stack:** Node 24 ESM, `node --test`, React 19 (start card), Vite web build.

**Spec:** `docs/superpowers/specs/2026-11-07-world-cultures-phase-3-design.md`

## Global Constraints

- Codex owns `server/seed/historical/courts/`, `name-pools/`, `events/`, `sources/`: never edit them.
- Egypt's package bytes and its three `releases.json` entries stay identical.
- The engine accepts one spouse per person, laws `primogeniture` or `merit`, offices `ruler`, `general`, `chancellor`, `priest`, `spymaster`.
- Generated people: `originLabelSv: 'Genererad person'`, name ends ` (genererad)`. Documented people: label `Dokumenterad person; spelvärden är genererade`.
- Game text Swedish with å, ä, ö; docs English. Functions under about 50 lines. Working copy CRLF except files git stores as LF.
- Never change the order of `random(state)` draws; reads draw no randomness; migrations are additive.
- Tests: `node --test --test-concurrency=1 <files>`; run `node scripts/seed-web-defaults.mjs` before web tests and `node scripts/fetch-map-assets.mjs --ensure` before `npm run build`.

## Review Focus

1. An old Charlemagne 1.1.0 or John 1.0.0 campaign after the upgrade: it must load, restore from its companion and play a year (Tasks 3 and 4).
2. A court whose ruler is a child (Silla): the regent must be the dossier uncle Kim Eon-seung, in both modes (Task 1 unit test, Task 3 start test).
3. A female ruler (Eirene): realm start keeps her as ruler with office name `Kejsarinna`; family mode follows a generated house (Task 3).
4. A dossier person with a spouse but no kinship entry for the marriage (Ingeborg): the claim falls back to `uncertain` identity sources and the validator accepts it (Task 1).
5. A player switching polity on the card: the text below the list changes with the chosen polity, and the campaign's prompt context names that polity's ruler (Task 2).

---

### Task 1: Dossier court builder

**Files:**
- Create: `server/seed/historical/dossier-courts.mjs`
- Test: `server/seed/historical/dossier-courts.test.js`

**Interfaces:**
- Produces:
  - `dossierPolity(dossier, polityId) -> object` (throws `dossier polity <id> is not ready` unless `status === 'ready'`).
  - `dossierCourt({ dossier, polityId, bookmarkYear, successionLaw, courtierNames, courtierBornAt }) -> { seat, court, sources, contextSv, contextSourceIds, coverageLinesSv }`, where `court` has the shape `court()` in `authored-scenarios.mjs` returns (people, families, offices, religion, rulerId, seatId, successionLaw, cities), `seat` the shape of `settlement()`, and `sources` a map of source id to a record that passes `validSources`.
  - `ENGINE_LIMIT_TEXT_SV: Readonly<Record<string,string>>` keyed by every `engineLimits` id in the two dossiers (`female-ruler-succession`, `eunuch-status`, `regency`, `elective-rule`, `no-sourced-household`, `multiple-spouses`).

- [ ] **Step 1: Write the failing tests** in `dossier-courts.test.js`, reading the real dossiers:
  - `tang-empire`: ruler `dezong`, office `ruler` named `Kejsare`; `li-song` in the ruler's family with `legalParentIds ['dezong']`; three generated courtiers with names ending ` (genererad)` and label `Genererad person`.
  - `byzantine-empire`: ruler `eirene-of-athens` is `female`, office name `Kejsarinna`; `tarasios` and `aetios` each in their own family named `Tarasioss hushåll`/`Aetioss hushåll` (genitive by appending `s`, as the spec's `<namn>s hushåll`) whose family claim is `generated`; religion leader `tarasios`.
  - `silla`: `kim-eon-seung` is in Aejang's family (kinship relation to the ruler).
  - `france-capetian`: `louis-viii` and `blanche-castile` in Philip II's family with reciprocal `spouseIds`; Ingeborg's `spouseIds` claim is `uncertain` with her identity sources when no kinship entry names the marriage, otherwise the kinship entry's status.
  - For all 11 ready polities: `validateHistoricalCourt` (import from `server/historicalScenarios.js`) accepts the court together with the returned sources; every cited source id exists in `sources`; `seat.regionId === 'hbm-ad<year>-' + sourceFeatureIndexes[0]`.
  - `dossierPolity` throws for `western-xia` and `chimu`.
  - `ENGINE_LIMIT_TEXT_SV` has a non-empty Swedish string for every `engineLimits` id found in both dossiers (computed in the test from the files).
- [ ] **Step 2:** Run `node --test server/seed/historical/dossier-courts.test.js`; expect failures (module missing).
- [ ] **Step 3: Implement** following the spec's "Dossier court builder" rules (claims, families by parentage, marriage or kinship to the ruler, transitive; sources reader that writes `review: { status: 'checked', checkedBy, checkedOn }` from the dossier `review` block; `coverageLinesSv` = dossier `successionNoteSv`, `engineLimitNoteSv`, `engineRepresentationNoteSv` where present, then one `ENGINE_LIMIT_TEXT_SV` line per limit id). Offices: ruler on the ruler, `general`/`chancellor`/`priest` on courtiers 1–3, matching `court()`. Use `court()`'s mechanics block for every person.
- [ ] **Step 4:** Run the test file; expect all pass. Run `node scripts/build-historical-scenarios.mjs --check`; expect exit 0 (nothing imports the module yet).
- [ ] **Step 5: Commit** `Add dossier court builder`.

### Task 2: Start text per polity

**Files:**
- Modify: `server/historicalScenarios.js` (court validation), `server/historicalStartSummary.js`, `src/runtime/historicalStartOptions.js`, `src/Game/DynastyStartCard.jsx`, `server/historicalPreparation.js` (`narrowToChosenCourt`)
- Test: `server/historicalStartSummary.test.js`, `src/runtime/historicalStartOptions.test.js`, `src/Game/DynastyStartCard.test.js`, `server/historicalPreparation.test.js`, `server/historicalScenarios.test.js`, both summary store tests

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `courtSeeds[polityId].contextSv` (string, ≤ 600 chars, optional) and `contextSourceIds` (string[] of `h.sources` ids); summary polity entries gain `contextSv`; option polities gain `context`; `HISTORICAL_SUMMARY_SCHEMA === 2`.

- [ ] **Step 1: Write failing tests:** validator refuses a court `contextSv` of 601 characters and an unknown `contextSourceIds` id, accepts a valid one; summary polity carries `contextSv` and schema is `2`; a stored schema-1 summary is rebuilt on both stores; the card shows the chosen polity's `context` and falls back to the start's when absent, and changes when another row is chosen; `narrowToChosenCourt` sets `world.historicalScenario.contextSv` and `world.startingTimelineText` to the court text when present and leaves them unchanged otherwise.
- [ ] **Step 2:** Run those files; expect the new tests to fail.
- [ ] **Step 3: Implement.** Keep package `contextSv` as the fallback everywhere.
- [ ] **Step 4:** Run the files plus `src/runtime/web/libraryStore.test.js` and `src/runtime/historicalPlayables.test.js`; expect pass.
- [ ] **Step 5: Commit** `Carry start text per playable polity`.

### Task 3: Charlemagne 1.2.0

**Files:**
- Modify: `server/seed/historical/authored-scenarios.mjs`, `scripts/build-historical-scenarios.mjs`, `server/seed/historical/ad800-review.json` (Benevento `nameSv` only), `server/seed/historical/released-provenance.json`, `server/historicalStarts.js` (bookmark `contentVersion: "1.2.0"`), `server/seed/historical/polity-regions.json`
- Regenerated: `server/seed/historical/charlemagne-800/*`, `server/seed/historical/releases.json`
- Test: pinned tests listed below, `server/historicalStarts.test.js` (1.1.0 → 1.2.0 upgrade), a new old-save test

**Interfaces:**
- Consumes: `dossierCourt` (Task 1); court `contextSv` (Task 2).

Values:
- `extraPlayables` order after Kyrkostaten: tang-empire, abbasid-caliphate, byzantine-empire, silla, emirate-of-cordoba, aghlabid-emirate, kingdom-of-asturias, duchy-of-benevento.
- Laws: tang-empire, silla, emirate-of-cordoba, aghlabid-emirate `primogeniture`; abbasid-caliphate, byzantine-empire, kingdom-of-asturias, duchy-of-benevento `merit`.
- Courtier names: three per polity, culture-appropriate for AD 800, each ending ` (genererad)`, born 20–45 years before 800 and after Kim Eon-seung's 760 for Silla.
- Karls rike `contextSv`: `Påven Leo III kröner Karl till kejsare i Rom på juldagen. Karl stannar där hela vintern. Karls rike har Aachen som spelsäte. Karls hustru Liutgard dog samma år. I spelet har Karls hov ingen kejsarinna.`
- Kyrkostaten `contextSv`: `Påven Leo III kröner Karl till kejsare i Rom på juldagen. Kyrkostaten har Rom som spelsäte. Leo III valdes till påve i december 795.`
- Package `contextSv`, built from the package: `Juldagen år 800. Spelbara riken: <names joined with ", " and " och " before the last>. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.`
- `ROME_800.noteSv`: the proposed text in `docs/development/RESEARCH-STATUS.md` line 72, verbatim.
- `polity-regions.json`: tang-empire and silla `east-asia`; abbasid-caliphate and aghlabid-emirate `mena`; emirate-of-cordoba, kingdom-of-asturias, duchy-of-benevento, byzantine-empire `europe`.

- [ ] **Step 1: Write failing tests:** the package lists the ten polities in the order above with the laws above; Eirene's office name is `Kejsarinna`; a Silla realm start has regent `kim-eon-seung`; a Byzantine family start follows a generated house; the bookmark names `1.2.0` and an installed 1.1.0 copy upgrades in place; a campaign created from the shipped 1.1.0 bundle (build it from git: `git show <base>:server/seed/historical/charlemagne-800/scenario.json`, or keep a fixture under `server/fixtures/`) loads, restores from its companion and plays one year after the upgrade.
- [ ] **Step 2:** Run them; expect failures.
- [ ] **Step 3: Implement** the authored entries, the builder's dossier reader (add `dossier-courts.mjs` and `courts/ad800-courts.json` to the hashed authored inputs; add every new seat's Getty id to `citySourceIds` and `gettyNotice`), the Benevento rename and the Rome note. Rebuild without the charlemagne provenance entry, copy the new manifest's `generator`, `sourceFiles` and `authoredInputs` into `released-provenance.json`, rebuild, run `--check`.
- [ ] **Step 4: Update pinned tests** (`server/historicalScenarios.test.js`, `server/historicalStartSummary.test.js`, `server/historicalSummaryStore.test.js`, `server/historicalPreparation.test.js`, `server/historicalProvenance.test.js`, `src/runtime/characters/scenarioSeed.test.js`, `src/runtime/characterRuntime.test.js`, `src/runtime/web/libraryStore.test.js`, `src/runtime/historicalStartPicker.test.js`, `src/Game/DynastyStartCard.test.js`) to the new lists. Do not loosen an assertion to make it pass; replace two-polity lists with the ten-polity list.
- [ ] **Step 5: Verify:** `node scripts/build-historical-scenarios.mjs --check`, `node scripts/check-polity-regions.mjs --check`, `git diff --exit-code server/seed/historical/egypt-3000bc` and the egypt rows of `releases.json` unchanged; `node scripts/seed-web-defaults.mjs`; the test files above plus `src/runtime/historicalPlayables.test.js` pass.
- [ ] **Step 6: Commit** `Release Charlemagne 1.2.0 with eight reviewed courts`.

### Task 4: John 1.1.0 and the default scenario

**Files:**
- Create: `scripts/sync-default-scenario.mjs`, `scripts/sync-default-scenario.test.js` (or a test in `server/`)
- Modify: `server/seed/historical/authored-scenarios.mjs`, `scripts/build-historical-scenarios.mjs` (John record: `citySourceIds`, `gettyTransformation`, `gettyNotice`, dossier reader for `courts/ad1200-courts.json`), `server/seed/historical/ad1200-review.json` (`sources.khmer`, `sources.chimu.scopedClaim`), `released-provenance.json`, `polity-regions.json`, `server/historicalPreparation.js` (`validateCompanion`) only if the old-save test needs it
- Regenerated: `server/seed/historical/john-1200/*`, `server/seed/default/*`, `releases.json`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: `node scripts/sync-default-scenario.mjs` writes `server/seed/default/{world.json,game.json,scenario.json,cities.geojson,regions.geojson}` from the John package with `builtInMap: "historical-john-1200-v1"` and `builtInRevision: 2`; `--check` exits 1 and names the first differing file.

Values:
- `extraPlayables` order: khmer-angkor, almohad, france-capetian. Laws: france-capetian `primogeniture`; khmer-angkor and almohad `merit`.
- Johns riken `contextSv`: John's current package text, moved to the court.
- Package `contextSv`: `Nyårsafton 1200. Spelbara riken: <names as in Task 3>. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.`
- `polity-regions.json`: khmer-angkor `southeast-asia`, almohad `mena`, france-capetian `europe`.
- Khmer and Chimú corrections: one merged sentence each, from `RESEARCH-STATUS.md` and the dossier `reviewCorrections`, adding no fact they do not name.

- [ ] **Step 1: Write failing tests:** the John package lists four polities in that order; `sync-default-scenario.mjs --check` passes on the committed files and fails after a one-byte edit to a temp copy; a library holding John with `builtInRevision: 1` refreshes to the new content and keeps the `builtInMap`; a John 1.0.0 campaign (from git history or a fixture) loads, restores from its companion and plays one year after the upgrade on server and web.
- [ ] **Step 2:** Run; expect failures.
- [ ] **Step 3: Implement**, rebuild John with refreshed provenance as in Task 3, run the sync script. If the old-save restore fails with `wrongEdition` only because the revision rose, accept an older `builtInRevision` for the same `builtInMap` in `validateCompanion` (spec ruling) and keep the refusal for a different map.
- [ ] **Step 4: Verify:** all four `--check` scripts exit 0; egypt unchanged; pinned tests updated as in Task 3 Step 4 for John; `historicalPlayables.test.js` covers 15 polities.
- [ ] **Step 5: Commit** `Release John 1.1.0 with Khmer, Almohad and French courts`.

### Task 5: Research range label

**Files:** Modify `src/Game/Characters/HistoricalRecordView.jsx`; test beside it (create `src/Game/Characters/historicalRecordRange.test.js` with a pure helper in a new `src/runtime/historicalResearchRange.js` if the JSX has none).

- [ ] **Step 1: Failing test:** `researchEndYear(coverage)` returns the highest `toYear` among ranges whose `status` is not `unresearched` (999 with today's `server/seed/historical/events/coverage.json`), and `null` when none is researched.
- [ ] **Step 2–4:** Implement, use it in place of `RESEARCH_END_YEAR = 1200`, and make the label `Forskningen sträcker sig till år <N>.` read the computed year. Run the test and `src/Game` tests that cover the view.
- [ ] **Step 5: Commit** `Read the research range from the event coverage`.

### Task 6: Verification and documents

- [ ] Full serial suite (`node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js" "scripts/**/*.test.js"`), `npm run build`, the four `--check` scripts, eslint on changed files.
- [ ] Playwright on the server (port 4167, isolated `OH_DATA_DIR` in the scratchpad) and the web (`vite --mode web`, port 5199, status API stubbed): the card shows Östasien, Sydostasien, Mellanöstern och Nordafrika and Europa; starting Tangriket shows Dezong in Chang'an and the Tang text; starting Frankrike shows Filip II August in Paris. Read both consoles.
- [ ] Update `docs/development/CONTINUE-HERE.md` (Phase 3 section with evidence), `docs/development/DEVELOPMENT-BACKLOG.md` (row 6 state; row 8 and row 10 done if the rebuild shipped them), `docs/play-scripts/historical-foundation.md` (Phase 3 run), `docs/development/CODEX-HANDOVER.md` (one line), and run `python ~/.claude/hooks/svenska-guard.py --svep --allt`.
- [ ] Commit `Record world-cultures Phase 3 state and browser run`.

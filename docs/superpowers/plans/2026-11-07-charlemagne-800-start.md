# Charlemagne AD 800 start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sourced campaign start for Charlemagne's realm on 25 December 800, so a medieval campaign has 401 researched years ahead of it.

**Architecture:** Generalize the two-package scenario build into a list of packages, prove the existing packages stay byte-identical, then add `charlemagne-800` as a third package from the pinned Historical Basemaps `world_800` source. The start flow reads the new package through the existing scenario path.

**Tech Stack:** Node ESM, `polygon-clipping`, GeoJSON, the existing build at `scripts/build-historical-scenarios.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-05-historical-world-direction.md`. Pattern: `docs/research/historical-scenarios.md`.

## Global Constraints

- Keep the pinned Historical Basemaps commit `4b5039e50d8d2464b065bd76ad6086cd4597108d`.
- Use primary or institutional sources. Keep provenance with the content. A source supports only the claim beside it.
- Do not present invented coordinates, borders, rulers or dates as researched history. Distinguish generated people from documented people.
- Unreviewed land stays `Okänd historisk kontroll`.
- `egypt-3000bc` and `john-1200` keep their exact bytes. `node scripts/build-historical-scenarios.mjs --check` proves it.
- Existing saves load unchanged. `rulesVersion`, `contentVersion` of the rules and `EXTENSIONS_VERSION` do not change.
- Preserve GPL and CC BY component notices and AGPL notices.
- Player text is Swedish with å, ä and ö. Docs are English.

## Rulings

Ruling: the start date is `0800-12-25`, the imperial coronation, with `world_800` as the map — the date is well documented, upstream publishes a snapshot for that year, and research covers 800 through 1200 — a different date changes one authored constant and its tests.

Ruling: the content ID is `charlemagne-800`, the polity ID `carolingian-realm`, the name `Karls rike (karolingiska riket)` — it follows the `Johns riken` form and claims no uniform administration — a rename touches the package only.

Ruling: the seat is Aachen, with Getty's coordinate, and the package says Charles was in Rome on the chosen day — the game needs a seat, and the John package set this pattern — the location note carries the difference.

Ruling: John stays offered and Charlemagne becomes the default medieval start — John's saves and browser evidence stay valid and the player gets the longer campaign by default — one line in the catalog order if the owner prefers otherwise.

Ruling: only the people the sources support get `documented`, and everyone else stays generated — the spec forbids invented biography — the court may hold fewer documented names than a player expects.

## Review Focus

1. Features 151 and 221 both carry the Carolingian name: both must map to one polity, one seat and one owner.
2. A second build on a clean checkout gives identical bytes on Windows and Linux.
3. A family start offers a generated or documented non-ruling house and never the ruler's own representative by mistake.
4. A person's birth date and kinship without a source claim is refused by `validateHistoricalScenario`.
5. Year 800's real events do not contradict the court shown at the start, for example a dead spouse shown as living.

---

### Task 1: Generalize the build without changing a byte

**Files:**
- Modify: `scripts/build-historical-scenarios.mjs`, `server/seed/historical/authored-scenarios.mjs`
- Test: existing `server/historicalProvenance.test.js` and the `--check` run

**Interfaces:**
- Produces: `SCENARIO_PACKAGES`, an ordered array of `{ key, contentId, sourceFile, reviewFile, authored() }`, and `authoredScenario(contentId)`. The `ancient` flag goes away.

- [ ] **Step 1: Run** `node scripts/build-historical-scenarios.mjs --check`. Expected: exit 0, the baseline.
- [ ] **Step 2: Replace** the `ancient` boolean with package records. Egypt-only transforms and John-only composite notes become fields on their records.
- [ ] **Step 3: Run** `node scripts/build-historical-scenarios.mjs --check` and `node --test server/historicalProvenance.test.js src/runtime/characters/scenarioSeed.test.js`. Expected: exit 0, PASS, no output file changed.
- [ ] **Step 4: Commit:** `git commit -m "Build historical scenarios from a list of packages"`.

### Task 2: Research the AD 800 package

**Files:**
- Create: `server/seed/historical/ad800-review.json`
- Modify: `docs/research/historical-scenarios.md`

Review all 225 upstream features in the shape of `ad1200-review.json`, with a recorded status and evidence for each. Research Charles, his sons Charles, Pepin and Louis, the household at the bookmark, Aachen, and the Latin church context. Record every date's source chronology.

- [ ] **Step 1: Copy** `server/seed/historical/sources/` conventions for the new source file `hbm-world_800.geojson` from the pinned commit, and record its hash.
- [ ] **Step 2: Draft** feature decisions and person claims with title, institution, URL, locator and uncertainty.
- [ ] **Step 3: Check independently:** a fresh reviewer with no draft context opens each cited source. Unconfirmed claims become `uncertain`, `generated` or withheld.
- [ ] **Step 4: Commit:** `git commit -m "Research the AD 800 scenario sources"`.

### Task 3: Build the package

**Files:**
- Modify: `server/seed/historical/authored-scenarios.mjs`, `scripts/build-historical-scenarios.mjs`, `server/seed/historical/releases.json`
- Create: `server/seed/historical/charlemagne-800/{scenario.json,manifest.json,regions.geojson,cities.geojson}` (generated)
- Test: `server/historicalScenarios.test.js`, `server/historicalProvenance.test.js`

**Interfaces:**
- Consumes: Task 1 `SCENARIO_PACKAGES`, Task 2 review.
- Produces: `validateHistoricalScenario` success for `{ date: '0800-12-25', polityId: 'carolingian-realm' }`.

- [ ] **Step 1: Write the failing tests:** the package validates; features 151 and 221 share owner `carolingian-realm`; regression points Aachen and Rome fall inside their reviewed owners, and Constantinople, Córdoba and Baghdad do not fall inside `carolingian-realm`; each documented person has source IDs.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Author** the package and run `node scripts/build-historical-scenarios.mjs`.
- [ ] **Step 4: Run** `--check`, then the tests. Expected: exit 0, PASS, Egypt and John bytes unchanged.
- [ ] **Step 5: Commit:** `git commit -m "Add the Charlemagne AD 800 scenario package"`.

### Task 4: Offer the start, and verify it

**Files:**
- Modify: the start catalog found by following `server/historicalScenarios.js` and `server/historicalPreparation.js`; `docs/play-scripts/historical-foundation.md`; `docs/development/CONTINUE-HERE.md`; `README.md` if it lists the starts
- Test: start-flow tests next to the catalog

- [ ] **Step 1: Write the failing tests:** the catalog offers three starts on both adapters, with `charlemagne-800` as the default; the start date passes every new-game guard; an existing John save loads unchanged.
- [ ] **Step 2: Implement,** then run the focused tests. Expected: PASS.
- [ ] **Step 3: Run** the full serial suite and the build. Expected: 0 fail, exit 0.
- [ ] **Step 4: Verify in a browser** on both adapters: the start card, map at Aachen, a household command, a reload and one turn. Record results in the play script.
- [ ] **Step 5: Commit,** PR, merge on green `test`.

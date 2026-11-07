# World cultures Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give polity records a validated `kind`, add an `elective` succession law that crowns a generated outsider when nobody at court qualifies, and move Kyrkostaten, Asturien, Almohaderna, Aztekriket and Inkariket to it in new package releases.

**Architecture:** `content.js` gains the kind and law tables; both validators and the engine seed check them. A new module `server/characters/election.js` ranks elective candidates and creates the elected outsider; `server/characters/realmKind.js` migrates and presents `realm.kind`. `index.js` changes only at its hook points. The builder writes `kind: 'state'` on the three bumped packages, which ship with frozen provenance, patch fixtures for every older release and a regenerated `server/seed/default`.

**Tech Stack:** Node ESM, `node:test`, React (start card, characters panel), Playwright for the browser check.

**Spec:** `docs/superpowers/specs/2026-11-07-world-cultures-phase-5-design.md`

## Global Constraints

- No new and no reordered `random(state)` draws anywhere; the election draws nothing. `EXTENSIONS_VERSION` stays 3 (no new stream).
- `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. Migrations are additive `ensure*` functions that draw nothing and spend nothing.
- Egypt package bytes and its four `releases.json` rows stay unchanged.
- Codex-owned paths are read-only: `server/seed/historical/courts/`, `name-pools/`, `events/`, `sources/`, and the research fields of `*-review.json`.
- Functions under about 50 lines, files under about 800. `index.js` (1,043 lines) changes only at hook points.
- Game text is Swedish with å, ä and ö; no dash as a clause separator, no "inte X, utan Y". Repository docs are English.
- Files under `server/seed/historical/` are LF; other files CRLF. Write with the Write/Edit tools or binary Python, never `sed -i`.
- Generated people: name ends ` (genererad)`, `originLabelSv: 'Genererad person'`.
- New modules under `server/characters/` import only from `server/characters/` and `server/gameDates.js` (the installed-layout test in `server/sharedCharacters.test.js` copies only those), and each gets a one-line `export *` wrapper under `src/runtime/characters/`.
- Tests: `node --test --test-concurrency=1 --test-reporter=tap <files>`. Checks: `node scripts/build-historical-scenarios.mjs --check`, `node scripts/check-historical-events.mjs --check`, `node scripts/check-polity-regions.mjs --check`, `node scripts/sync-default-scenario.mjs --check`. Run `node scripts/seed-web-defaults.mjs` before web tests and `node scripts/fetch-map-assets.mjs --ensure` before `npm run build`.
- Commits stage files by name and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push; the controller pushes.

## Rulings and measured baseline

The spec leaves these to the builder, or the code forced them.

1. **Married-in persons (deviation).** The spec moves the old ruler's spouse out of the kin group. Araua Ocllo has no `spouseIds` link: the AD 1500 dossier records her marriage as uncertain kinship only (`courts/ad1500-courts.json`, "därför skapas ingen spouseIds-länk"). The kin group therefore excludes the old ruler's spouse **and every other legal parent of the old ruler's legal children**. Both stand in the second group. Without the co-parent rule, Araua Ocllo and an adult Huáscar tie on merit and she wins on id order (`araua-ocllo` < `huascar`).
2. **Inca heir at the bookmark.** Measured on `7b8f62ea` (merit order, which equals the elective second group when the kin group is empty): at 1500-12-31 the merit list is `araua-ocllo, generated-courtier-1, generated-courtier-2, generated-courtier-3`; her house's +10 throne support ranks her first. Huáscar is 9. Controller ruling after this measurement (spec amended): the ruling family's minors form a second group, ranked by age after its adults and before everyone else, and rule under the existing regency. At the bookmark the elected successor is therefore Huáscar, and Araua Ocllo stands in the outside group.
3. **Elected outsider details the spec leaves open:** sex of the dead ruler (`'male'` if absent); culture and religion of the dead ruler; family id `family-<n>` and person id `person-<n>` from `++state.sequence` (person first); family fields as `seedCourt` writes them (`color '#8b7961'`, `treasury 110`, `estates 2`, `influence 45`, `grievance 0`); `wealth 30`, `loyalty 60`, `health 100`, `goal { type: 'security' }`. The count `<n>` in the names is 1 plus the number of `state.offices.ruler.history` entries whose `reason` is `Valet föll på en person utanför hovet`, so it needs no new saved field.
4. **Forecast status** stays `'no-successor'` when the elective list is empty; `electionFromOutside: true` and a new `authority` sentence mark the election.
5. **Kind in packages:** the builder sets `kind ??= 'state'` on every polity record of a package record that carries `polityKinds: true` (Charlemagne, John, world-1500). Egypt has no flag and keeps its bytes.
6. **Task split (deviation from the suggested six):** the two existing patch fixtures stop rebuilding the moment Task 4 changes the packages, so Task 4 regenerates them and moves the old-save tests' target versions. Every task then ends with a green suite. Task 5 adds only the three new fixtures and their tests. John has no `HISTORICAL_BOOKMARKS` entry; `BUILT_IN_REVISION` 3 is its bump.
7. **Release commits:** Charlemagne 1.2.0 and John 1.1.0 shipped in `47fa170f` (Phase 3, PR #30; Phase 4 `02aea551` kept their bytes); world-1500 1.0.0 shipped in `02aea551`; Charlemagne 1.1.0 and John 1.0.0 in `2128ee11`.
8. Kyrkostaten's baseline: it ends between 813 and 838 on the eight seeds (`CONTINUE-HERE.md`). Task 6 puts its 100-year test in `courtBalance.test.js` to reuse `SEEDS`.

## Review Focus

1. **A save written before Phase 5.** No `realm.kind`, law `merit` or `primogeniture`: it loads with `kind 'state'`, keeps its law and plays a year. Task 2 (unit) and Task 5 (stripped campaign save) test it.
2. **The whole court dies at one boundary.** A plague year that kills the ruler and every adult in one `kill` call creates exactly one electee. Task 2 tests it.
3. **An electee dies with nobody at court.** The next election creates `Vald härskare 2 (genererad)` in `Valt hus 2 (genererat)`. Task 2 tests it.
4. **Reading the forecast creates nobody.** `getSuccessionForecast` on an empty elective court leaves `state.sequence`, `people` and `families` unchanged. Task 2 tests it.
5. **A package with an unknown or `non-state` playable polity.** The start card must leave it off without throwing, as the validators refuse it. Task 3 tests the summary.

---

### Task 1: Polity kinds and the elective law in content and both validators

**Files:**
- Modify: `server/characters/content.js` (`SUCCESSION_LAWS` :91, new tables beside it)
- Modify: `server/historicalScenarios.js` (`validateHistoricalCourt` polity check :156, `validateHistoricalScenario` polity check :181 and playable check :185)
- Modify: `server/characters/scenarioSeed.js` (`validateEngineSeed` :10-39 and its call :93)
- Test: `server/historicalScenarios.test.js`, `src/runtime/characters/scenarioSeed.test.js`

**Interfaces:**
- Produces in `content.js`: `POLITY_KINDS = Object.freeze(['state','city-state','confederation','chiefdom','non-state'])`; `POLITY_KIND_LABELS_SV = Object.freeze({ state: 'stat', 'city-state': 'stadsstat', confederation: 'förbund', chiefdom: 'hövdingadöme', 'non-state': 'statslöst samhälle' })`; `SUCCESSION_LAWS = Object.freeze(['primogeniture','merit','elective'])` (this order is the reform cycle); `SUCCESSION_LAW_LABELS_SV = Object.freeze({ primogeniture: 'förstfödslorätt', merit: 'förtjänst', elective: 'val' })`.
- Produces in `historicalScenarios.js`: `export const validPolityKind = p => p.kind === undefined || POLITY_KINDS.includes(p.kind)` and `export const playablePolityKind = p => validPolityKind(p) && p.kind !== 'non-state'`.
- `validateEngineSeed(court, familyId, polity)` refuses when `!playablePolityKind(polity)`.

- [ ] **Step 1: Write the failing tests** in `server/historicalScenarios.test.js`:
  - Add `['successionLaw elective',c => { c.successionLaw = 'elective'; }]` to `ACCEPTED`; `tanistry` stays in `REFUSED`.
  - A helper `probePolity = mutate => { const input = loadPackage(); mutate(input.h.polities.find(p => p.id === POLITY)); return bothResults(input); }`.
  - `both validators accept each polity kind`: for each of `state`, `city-state`, `confederation`, `chiefdom`, both results `ok === true`.
  - `both validators refuse an unknown polity kind`: kind `'empire'` and kind `null` give `[validate → 'invalidPolities', validateHistoricalCourt → 'invalidPolity']`.
  - `both validators refuse a playable non-state polity`: kind `'non-state'` gives `'invalidPolity'` from both.
  - `a non-playable polity of kind non-state is accepted`: set `kind: 'non-state'` on a polity record outside `playablePolityIds` (add one with `id: 'probe-people'`, `nameSv: 'Prov'`, a package source id, `boundary: 'approximate'`); `validate(input).ok === true`.
  - In `src/runtime/characters/scenarioSeed.test.js`: `createHistoricalCharacterSystem` with the chosen polity's `kind: 'non-state'` throws `Det historiska hovets uppgifter kan inte användas av karaktärssystemet.`; with `kind: 'chiefdom'` it starts; with court `successionLaw: 'elective'` it starts and `state.realm.successionLaw === 'elective'`.
- [ ] **Step 2: Run** `node --test --test-concurrency=1 --test-reporter=tap server/historicalScenarios.test.js src/runtime/characters/scenarioSeed.test.js`. Expected: the new tests FAIL (`elective` refused, kinds unchecked).
- [ ] **Step 3: Implement** the four tables, the two predicates, the checks (unknown kind on any record → `invalidPolities`; non-state or unknown kind on a playable id → `invalidPolity`; `validateHistoricalCourt` checks the chosen polity with `playablePolityKind` → `invalidPolity`), and the third `validateEngineSeed` argument (`polity` from :94, moved above the call).
- [ ] **Step 4: Run** the two files (PASS), then `node scripts/build-historical-scenarios.mjs --check` (exit 0: no package changes yet).
- [ ] **Step 5: Commit** `Validate polity kinds and accept the elective law`.

### Task 2: The election engine

**Files:**
- Create: `server/characters/election.js`, `server/characters/realmKind.js`, `src/runtime/characters/election.js`, `src/runtime/characters/realmKind.js` (one-line `export *` wrappers)
- Modify: `server/characters/index.js` (`rulerCandidates` :107, `getSuccessionForecast` :125-170, `killPeople` crown line :284, `createCharacterState` realm literal :291, `normalizeCharacterSystem` :380, command `succession_law` :756, `getCharacterPresentation` :959 `realm` key and `succession.lawLabel`)
- Modify: `server/characters/governance.js:58`, `server/characters/scenarioSeed.js:99`, `server/characters/content.js:41` (legislator description) and a new `SUCCESSION_LAW_RULES_SV` table beside `SUCCESSION_LAW_LABELS_SV`
- Test: create `src/runtime/characters/election.test.js`; modify `server/sharedCharacters.test.js` (digest baselines :13-17), `src/runtime/characters/scenarioSeed.test.js` (:124, :171 heir-claim suffix), `src/runtime/characters/successionForecast.test.js`

**Interfaces:**
- Consumes: Task 1's `SUCCESSION_LAWS`, `SUCCESSION_LAW_LABELS_SV`, `POLITY_KINDS`, `POLITY_KIND_LABELS_SV`.
- Produces in `election.js`:
  - `electiveCandidates(state, oldRuler, people, score) -> Person[]`: `people` is the living, non-excluded list `rulerCandidates` already built; `score(person) -> number` is the merit score. Group 1: adults (`isAdultCharacter`) with `familyId === oldRuler?.familyId`, minus `marriedIn(state, oldRuler)`, sorted by score descending, ties `a.id.localeCompare(b.id)`. Group 2: minors of that family minus `marriedIn`, eldest first (`bornAt` ascending, ties by id). Group 3: every other adult, married-in persons included, sorted as group 1. Minors outside group 2 never qualify.
  - `marriedIn(state, oldRuler) -> Set<string>`: `oldRuler.spouseId` plus every id in `legalParentIds` of a living or dead person whose `legalParentIds` include `oldRuler.id`, minus `oldRuler.id`.
  - `ELECTION_REASON_SV = 'Valet föll på en person utanför hovet'`.
  - `electOutsider(state, oldRuler) -> Person`: writes one person and one family (Ruling 3), no events and no draws. Name `Vald härskare <n> (genererad)`, family `Valt hus <n> (genererat)`, `bornAt = formatGameDate({ year: shiftGameYear(gameDateYear(state.date), -40), month: 1, day: 1 })`, archetype `steward`, traits `['dutiful']`, every `SKILL_LABELS` key 5, `originLabelSv: 'Genererad person'`, `healthConditions: []`, `ensurePortraitIdentity`. With `state.historicalOrigin`: `identityOrigin: 'generated'` and `historicalOrigin: publicPersonOrigin(...)` with generated claims `identity`, `bornAt`, `kinship`, `mechanics`, note `Personen valdes i simuleringen när hovet saknade behöriga vuxna.`
  - `nextSuccessionLaw(law) -> string`: the next entry of `SUCCESSION_LAWS`, wrapping; an unknown law gives `'primogeniture'`.
- Produces in `realmKind.js`: `ensureRealmKind(state)` (sets `realm.kind = 'state'` only when absent), `validateRealmKind(state)` (throws `Sparfilens rikestyp är okänd.` when not in `POLITY_KINDS`), `presentRealm(state) -> { kind, kindLabelSv, successionLaw, successionLawLabelSv }`.
- Produces: forecast field `electionFromOutside: boolean`; presentation key `realm` (from `presentRealm`).

- [ ] **Step 1: Write the failing tests** in `src/runtime/characters/election.test.js`. Start Inkariket from `server/seed/historical/world-1500/scenario.json` and Kyrkostaten from `charlemagne-800/scenario.json` with `createHistoricalCharacterSystem`, after setting `courtSeeds[polityId].successionLaw` in a cloned package (the packages still ship the old laws; Task 1 lets both validators accept `elective`, and the opening claims then follow the law). Kill with `actionHooks(state).kill(ids, [], 'Prov')`, which vacates offices and reconciles claims.
  - `elective ranking puts adult kin first, kin minors second and married-in persons with outsiders last`: Inca state with `state.date = '1510-01-01'` (Huáscar 19); `getSuccessionForecast(state).expectedRuler.id === 'huascar'`; the presentation's `succession.candidates.map(c => c.id)` deep-equals `['huascar','araua-ocllo','generated-courtier-1','generated-courtier-2','generated-courtier-3']`. At `1500-12-31` the same list is identical (Huáscar from group 2). A probe court with one adult kinsman and one kin minor lists the adult first; a minor of an outside family never appears.
  - `Huayna Capac's successor is not Araua Ocllo once Huáscar is adult`: same state, kill `huayna-capac`; `offices.ruler.holderId === 'huascar'`.
  - `at the bookmark the elected Inca successor is Huáscar under a regency`: Inca state at `1500-12-31`; forecast `expectedRuler.id === 'huascar'`; `realm.legalHeirId === 'huascar'`; kill `huayna-capac`: `offices.ruler.holderId === 'huascar'` and `offices.ruler.regentId` is a living adult (Ruling 2).
  - `a death with no adult creates one generated electee and keeps the realm`: Kyrkostaten; kill `generated-courtier-1..3` and `leo-iii` in one call; exactly one new person, named `Vald härskare 1 (genererad)`, `originLabelSv === 'Genererad person'`, `identityOrigin === 'generated'`, age 40, `skills` all 5, family name `Valt hus 1 (genererat)` with `headId` the electee; `offices.ruler.holderId` is that person; `realm.alive === true`; `status.ended === false`; the last ruler history entry's `reason === 'Valet föll på en person utanför hovet'`; the log has one `succession` event titled `Vald härskare 1 (genererad) tillträder`.
  - `a second election numbers the house 2`: continue, kill the electee; the new holder is `Vald härskare 2 (genererad)` in `Valt hus 2 (genererat)`.
  - `primogeniture and merit still end the realm`: the same all-dead kill under each law leaves `holderId === null`, `realm.alive === false`, `status.ended === true`, and no new person.
  - `the forecast reports an election from outside and creates nobody`: Kyrkostaten after killing `generated-courtier-1..3`; `JSON.stringify(state)` equal before and after `getSuccessionForecast`; `electionFromOutside === true`; `status === 'no-successor'`; `authority === 'Ingen vuxen vid hovet är behörig. Valet faller på en genererad person utanför hovet.'`; `realm.legalHeirId === null`. Under `merit` the same kill gives `electionFromOutside === false`.
  - `abdication with an empty elective court still refuses`: the same state; `executeCharacterCommand` of `abdicate` returns `ok: false` with `Det finns ingen giltig efterträdare.` and no new person.
  - `the legislator cycles three laws`: `nextSuccessionLaw` maps `primogeniture → merit → elective → primogeniture` and `'tanistry' → 'primogeniture'`; on a Kyrkostaten start (law `merit`) with `leo-iii.archetype = 'legislator'`, three `succession_law` commands leave `elective`, then `primogeniture`, then `merit`; `ARCHETYPES.legislator.description === 'Byt tronföljd i ordningen förstfödslorätt, förtjänst och val. Familjerna reagerar.'`.
  - `the heir claim names the law in Swedish`: active `heir` claims end `enligt val` under elective; update `scenarioSeed.test.js:124` and `:171` to `enligt förtjänst`.
  - `the election draws nothing`: Kyrkostaten seed 7 advanced 12 months once under `merit` and once under `elective`, with `leo-iii` alive at the end of both; equal `rngState`, equal `JSON.stringify(people)`.
  - `realm kind`: a fictional `createCharacterSystem()` has `realm.kind === 'state'`; a historical start whose polity record has `kind: 'chiefdom'` has `realm.kind === 'chiefdom'`; a saved state with `realm.kind` deleted loads through `normalizeCharacterSystem` with `'state'` and the same `rngState`; `realm.kind = 'empire'` throws `Sparfilens rikestyp är okänd.`.
  - `the presentation shows kind and law`: Kyrkostaten under elective: `view.realm` deep-equals `{ kind: 'state', kindLabelSv: 'stat', successionLaw: 'elective', successionLawLabelSv: 'val' }`; `view.succession.lawLabel === 'Val efter förmåga, först bland vuxna i härskarens hus och sedan vid hovet'`.
- [ ] **Step 2: Run** `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/election.test.js src/runtime/characters/scenarioSeed.test.js`. Expected: FAIL (`Cannot find module .../election.js`).
- [ ] **Step 3: Implement.** In `index.js` factor the merit expression into `meritScore(state, p, excludedIds)` used by both branches of `rulerCandidates`, and return `electiveCandidates(...)` for `elective`. In `killPeople`: when `selectDeathSuccessor` returns null and the law is `elective`, `crown(state, electOutsider(state, oldRuler), events, ELECTION_REASON_SV, 55, oldRuler.id === oldLawfulId)`. Forecast: `electionFromOutside = Boolean(available && !incoming && law === 'elective')` and the authority sentence above. Realm literal gains `kind: 'state'`; `scenarioSeed.js:99` sets `state.realm.kind = polity.kind ?? 'state'`; `normalizeCharacterSystem` calls `ensureRealmKind` beside `ensureGovernance` at :380 and `validateRealmKind` after it. `succession_law` uses `nextSuccessionLaw`. `governance.js:58` prints `SUCCESSION_LAW_LABELS_SV[law] ?? law`. `SUCCESSION_LAW_RULES_SV = { primogeniture: 'Äldsta erkända barn, därefter familjen och rådet', merit: 'Rådets meriterade utnämning', elective: 'Val efter förmåga, först bland vuxna i härskarens hus och sedan vid hovet' }` feeds `lawLabel`.
- [ ] **Step 4: Run** the two files (PASS). Then run `server/sharedCharacters.test.js`: the Hadara digests change (new `realm.kind`, Swedish heir-claim text). Replace only the `initial` and `year` digest literals with the printed values; the `rngState` literals `104729`, `2206754125`, `321`, `2318062802` must stay and pass. Run `src/runtime/characters/*.test.js` and `server/sharedCharacters.test.js` (PASS).
- [ ] **Step 5: Commit** `Add elective succession and the realm kind`.

### Task 3: Kind on the start card and the law in Ämbeten & arv

**Files:**
- Modify: `server/historicalStartSummary.js` (`HISTORICAL_SUMMARY_SCHEMA` :12, `polityEntry` :63-79)
- Modify: `src/runtime/historicalStartOptions.js` (`historicalStartOption` :7-19, `historicalStartOptionFromSummary` :31-39)
- Modify: `src/runtime/historicalStartPicker.js` (`startRow` :18-27), `src/Game/HistoricalStartPicker.jsx` (`StartRow` :20-26)
- Modify: `src/Game/Characters/CharactersPanel.jsx` (`OfficesView` section :343)
- Test: `server/historicalStartSummary.test.js`, `src/runtime/historicalStartPicker.test.js`, `src/Game/DynastyStartCard.test.js`, `src/Game/Characters/CharactersPanel.test.js`

**Interfaces:**
- Consumes: `POLITY_KIND_LABELS_SV` and `playablePolityKind(polity)` (Task 1); `view.realm.successionLawLabelSv` (Task 2).
- Produces: summary polity entry `{ id, nameSv, kind, regionId, ruler, contextSv, families }`, `HISTORICAL_SUMMARY_SCHEMA = 3`; option polity `kind`; picker row `kindLabelSv` (`''` for `state`).

- [ ] **Step 1: Write the failing tests:**
  - summary: `HISTORICAL_SUMMARY_SCHEMA === 3`; the built Charlemagne summary gives `kind: 'state'` for every polity; a scenario with a playable polity of `kind: 'confederation'` gives that kind; kind `'empire'` or `'non-state'` on a playable polity gives `invalid: true` and does not throw.
  - picker: a row from an option polity `{ kind: 'city-state' }` has `kindLabelSv === 'stadsstat'`, and `groupHistoricalStartRows(rows, 'stadsstat')` finds it; a `state` row has `kindLabelSv === ''`.
  - card: the rendered row of a `city-state` polity reads `<polity> · 800 e.Kr. · stadsstat`; the Kyrkostaten row still reads `Kyrkostaten · 800 e.Kr.`.
  - panel: add `OfficesView` to the transform's export list; rendering it with Kyrkostaten's presentation under `elective` gives text containing `Tronföljd: val`; under `merit` `Tronföljd: förtjänst`. A legacy presentation without `realm` renders without that line.
  - library stores: a cached summary of schema 2 is rebuilt (follow the existing schema test in `server/historicalSummaryStore.test.js` and the web `reconcileMeta` test in `src/runtime/web/libraryStore.test.js`).
- [ ] **Step 2: Run** the five test files. Expected: FAIL (schema 2, no kind).
- [ ] **Step 3: Implement.** `polityEntry` returns null when `!playablePolityKind(polity)` and adds `kind: polity.kind ?? 'state'`. Both option builders carry `kind`. `startRow` sets `kindLabelSv` from `POLITY_KIND_LABELS_SV` for kinds other than `state` and appends it to `searchText`. `StartRow` appends ` · ${row.kindLabelSv}` when present. `OfficesView` adds `<p className="char-succession-law">Tronföljd: <strong>{view.realm.successionLawLabelSv}</strong></p>` under the `Succession och familjens framtid` heading when `view.realm` exists.
- [ ] **Step 4: Run** the five files and `node scripts/seed-web-defaults.mjs`, then `src/runtime/web/libraryStore.test.js` (PASS).
- [ ] **Step 5: Commit** `Show the polity kind and the succession order`.

### Task 4: Five courts elect, three packages release

**Files:**
- Modify: `server/seed/historical/authored-scenarios.mjs` (`PAPAL_STATES_800` :119, Asturias :146, Almohad :152, `AZTEC_1500`/`INCA_1500` :168-169, John `contentVersion` :193 → `'1.2.0'`, Charlemagne :217 → `'1.3.0'`, world-1500 entry :251 gains `contentVersion: '1.1.0'`)
- Modify: `server/seed/historical/dossier-courts.mjs:9` (`ENGINE_LIMIT_TEXT_SV['elective-rule']`)
- Modify: `scripts/build-historical-scenarios.mjs` (`PACKAGE_RECORDS` :114, :135, :157 gain `polityKinds: true`; `buildPackage` after `namePlayables(h)` :346)
- Modify: `server/historicalStarts.js:13-14`, `scripts/sync-default-scenario.mjs:17` (`BUILT_IN_REVISION = 3`)
- Generated: `server/seed/historical/{charlemagne-800,john-1200,world-1500}/*`, `releases.json`, `released-provenance.json`, `server/seed/default/*`, `server/fixtures/charlemagne-800-1.1.0.patch.json`, `server/fixtures/john-1200-1.0.0.patch.json`
- Test: `server/world1500Scenario.test.js`, `server/johnScenario.test.js`, `server/historicalScenarios.test.js`, `server/historicalPreparation.test.js`, `server/historicalProvenance.test.js`, `server/historicalStarts.test.js`, `server/syncDefaultScenario.test.js`, `server/seed/historical/dossier-courts.test.js`, `src/runtime/characters/scenarioSeed.test.js`, and the target versions in `server/charlemagneOldSave.test.js`, `server/johnOldSave.test.js`, `src/runtime/web/johnDefaultRefresh.test.js`, `src/runtime/web/libraryStore.test.js:667-670`, `server/builtInScenarioSeed.test.js` where it reads the shipped seed

**Interfaces:**
- Consumes: Task 1 validators, Task 2 engine.
- Produces: Charlemagne 1.3.0, John 1.2.0, world-1500 1.1.0; `HISTORICAL_BOOKMARKS` Charlemagne `'1.3.0'`, world-1500 `'1.1.0'`; `server/seed/default/world.json` `builtInRevision: 3`.

- [ ] **Step 1: Write the failing tests:**
  - laws: `courtSeeds[id].successionLaw === 'elective'` for `papal-states`, `kingdom-of-asturias` (Charlemagne), `almohad` (John), `aztec-empire`, `inca-empire` (world-1500); every other court keeps its law (update the tables at `historicalScenarios.test.js:33-36,513-514`, `johnScenario.test.js:23-25`, `historicalPreparation.test.js:37-40`, `world1500Scenario.test.js:46`).
  - kind: every `h.polities` record of the three packages has `kind === 'state'`; Egypt's records have no `kind`.
  - text: `ENGINE_LIMIT_TEXT_SV['elective-rule'] === 'Spelets valordning väljer först bland vuxna i härskarens hus och sedan bland hovets övriga vuxna, efter förmåga. Finns ingen behörig väljs en genererad person utanför hovet. Valet återger inte rådets eller väljarnas egen ordning.'`, and the four `elective-rule` courts' `mechanics.noteSv` contain it.
  - versions: `contentVersion` and manifest `contentVersion` `1.3.0`, `1.2.0`, `1.1.0`; `HISTORICAL_BOOKMARKS` deep-equals `[['egypt-3000bc','1.0.0'],['charlemagne-800','1.3.0'],['world-1500','1.1.0']]`; `historicalProvenance.test.js:62` `'1.3.0'`; `syncDefaultScenario.test.js` revision `3`, version `'1.2.0'`.
  - `scenarioSeed.test.js`: the five courts' heir claims end `enligt val`.
  - old-save tests: upgrade targets move to Charlemagne `1.3.0`, John `1.2.0` at revision `3`.
- [ ] **Step 2: Run** the test files. Expected: FAIL on laws, kind, versions.
- [ ] **Step 3: Implement** the laws, versions, engine-limit text, `polityKinds` flag and `if (pkg.polityKinds) for (const polity of h.polities) polity.kind ??= 'state';`.
- [ ] **Step 4: Rebuild and freeze:** delete the three bumped entries from `released-provenance.json`; run `node scripts/build-historical-scenarios.mjs`; copy `generator`, `sourceFiles` and `authoredInputs` from each new `manifest.json` into `released-provenance.json`; rerun the build, then `--check` (exit 0). Run `node scripts/sync-default-scenario.mjs`, then `node scripts/write-release-patch.mjs 2128ee11 charlemagne-800 1.1.0` and `node scripts/write-release-patch.mjs 2128ee11 john-1200 1.0.0`, then `node scripts/seed-web-defaults.mjs`.
- [ ] **Step 5: Pin the release rows** in `world1500Scenario.test.js:199-226`: `RELEASED_ROWS` keeps the four Egypt rows as literals and takes the eight John and Charlemagne rows from the new `releases.json`; add the four `world-1500` rows; the test reads every row's file and checks bytes and sha256. Update the comment to name Egypt 1.0.0, John 1.2.0, Charlemagne 1.3.0 and world-1500 1.1.0. Confirm Egypt: `git diff --exit-code HEAD -- server/seed/historical/egypt-3000bc` and the four Egypt rows equal `git show HEAD:server/seed/historical/releases.json`.
- [ ] **Step 6: Run** every test file listed above, `server/historicalStartSummary.test.js`, `src/runtime/historicalPlayables.test.js`, `server/sharedCharacters.test.js`, and the four `--check` scripts (all PASS).
- [ ] **Step 7: Commit** `Release five elective courts`.

### Task 5: Fixtures for every older release

**Files:**
- Generated: `server/fixtures/charlemagne-800-1.2.0.patch.json`, `server/fixtures/john-1200-1.1.0.patch.json`, `server/fixtures/world-1500-1.0.0.patch.json`
- Modify: `server/fixtures/releaseFixtures.js` (:32-36)
- Test: `server/charlemagneOldSave.test.js`, `server/johnOldSave.test.js`, `server/historicalStarts.test.js`, `src/runtime/web/johnDefaultRefresh.test.js`; create `server/world1500OldSave.test.js` (pattern: `charlemagneOldSave.test.js`)

**Interfaces:**
- Consumes: Task 4's packages.
- Produces: `charlemagneRelease120()`, `johnRelease110()`, `world1500Release100()` beside the existing two.

- [ ] **Step 1: Write the patches:** `node scripts/write-release-patch.mjs 47fa170f charlemagne-800 1.2.0`, `node scripts/write-release-patch.mjs 47fa170f john-1200 1.1.0`, `node scripts/write-release-patch.mjs 02aea551 world-1500 1.0.0`; add the three exports with a comment naming the commit.
- [ ] **Step 2: Write the tests:**
  - `charlemagneOldSave.test.js`: run the existing flow once per release (`1.1.0` and `1.2.0`, each upgrading to `1.3.0`). For 1.2.0 the campaigns are `['papal-states','realm']` and `['kingdom-of-asturias','family']`; the loaded Kyrkostaten campaign keeps `realm.successionLaw === 'merit'`. A copy of its saved world with `characterSystem.realm.kind` deleted restores and plays a year with `realm.kind === 'state'`.
  - `johnOldSave.test.js` and `johnDefaultRefresh.test.js`: run the existing flow for John 1.0.0 at revision 1 and John 1.1.0 at revision 2, each refreshing to `1.2.0` at revision 3; the Almohad campaign of 1.1.0 keeps `merit`.
  - `historicalStarts.test.js`: an installed Charlemagne 1.2.0 copy and an installed world-1500 1.0.0 copy are each replaced in place by the shipped release on the next read (follow the 1.1.0 test at :340).
  - `world1500OldSave.test.js`: campaigns `['inca-empire','realm']` and `['aztec-empire','family']` started on world-1500 1.0.0 load, restore from both companions and play a year after the 1.1.0 upgrade; the Inca campaign keeps `primogeniture`.
- [ ] **Step 3: Run** the five test files (PASS; they exercise the existing upgrade code). If one fails, the fault is in Task 4's packages or bookmarks; fix it there.
- [ ] **Step 4: Commit** `Keep every older release restorable`.

### Task 6: Kyrkostaten survives a century; docs, suite, build and browser check

**Files:**
- Test: `src/runtime/characters/courtBalance.test.js`
- Modify: `docs/development/CONTINUE-HERE.md` (new Phase 5 section; replace the known-limit paragraph at :31), `docs/development/DEVELOPMENT-BACKLOG.md` (rows 6 and 7), `docs/development/CODEX-HANDOVER.md` (engine-limit text, laws, `realm.kind`), `src/runtime/characters/CONTRACT.md` (sections `Lawful succession and regency`, `Read-only succession forecast`, `Historical initialization`), `docs/play-scripts/historical-foundation.md` (section `Elective succession, Phase 5` before `Closure`)

- [ ] **Step 1: Write the test** `Kyrkostaten stays alive for a century under an elected ruler on every seed` in `courtBalance.test.js`: for each of `SEEDS`, start `papal-states` in realm mode from the built Charlemagne package with `createHistoricalCharacterSystem({ ..., seed })` and advance 12 months 100 times with `advanceCharacters`. Assert at `0900-12-25`: `status.ended === false`, `realm.alive === true`, `leo-iii` and `generated-courtier-1..3` all have `diedAt`, the ruler's name matches `/^Vald härskare \d+ \(genererad\)$/` with `originLabelSv === 'Genererad person'`, and the ruler history holds at least one `Valet föll på en person utanför hovet` entry.
- [ ] **Step 2: Run** `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/courtBalance.test.js` (PASS; the ten-year tests unchanged).
- [ ] **Step 3: Full checks:** `node --test --test-concurrency=1 --test-reporter=tap "server/**/*.test.js" "src/**/*.test.js"` (0 fail); the four `--check` scripts; `node scripts/fetch-map-assets.mjs --ensure` then `npm run build`; eslint on the changed files.
- [ ] **Step 4: Browser check** with Playwright, server `node server/server.js` on `PORT=4167` with a fresh `OH_DATA_DIR` in the scratchpad, web `npx vite --mode web --port 5199` after `node scripts/seed-web-defaults.mjs`. On both adapters:
  - the card rows read `Kyrkostaten · 800 e.Kr.` and `Inkariket · 1500 e.Kr.` with no kind label;
  - Kyrkostaten in realm mode: `Ämbeten & arv` shows `Tronföljd: val`;
  - Inkariket in realm mode: `Ämbeten & arv` shows `Tronföljd: val` and Huáscar as legal heir (Ruling 2);
  - an installed library from before the upgrade lists Charlemagne 1.3.0 after one read;
  - 0 console errors.
- [ ] **Step 5: Docs:** record the evidence (commit, test counts, the seed range of the first election on Kyrkostaten, the browser rows) in the files above; mark backlog row 7 done for elective succession with births still open. Run `python ~/.claude/hooks/svenska-guard.py --svep --allt`.
- [ ] **Step 6: Commit** `Document elective succession`.

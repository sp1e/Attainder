# Development checkpoint: Phase 3 of the AI game master

Updated on 11 November 2026.

## Historical foundation checkpoint

Task 6 and final documentation review are accepted with the limits in the [play script](../play-scripts/historical-foundation.md). Final review approved publication subject to current-head CI; [PR #13](https://github.com/sp1e/Attainder/pull/13) tracks merge state. Merge does not deploy the game. The globe-render and clean-Linux fixture fixes passed scoped review and were pushed at `2066a55`. [CI run 42102593161](https://github.com/sp1e/Attainder/actions/runs/42102593161) passed: 4,656 total, 4,654 passed, 0 failed, 0 skipped and 2 TODO, in 127,190.421065 ms; the build passed in 24.97 seconds. The last full local lint measurement reported 18 errors and 71 warnings; the final globe-fix files passed targeted lint without diagnostics. The separate annual 4,500-year research and turn-end popup remain pending.

## Historical year events

The popup after a closed calendar year and the chronicle segment `I verklighetens historia` are built on `feature/historical-events`. The segment lists the closed years of a historical campaign, newest first, from the same catalog as the popup. The popup link `Visa alla i krönikan` opens it. The catalog ships empty until the research round, so no popup appears yet. The full suite ran 4,724 tests at `03da98e9` with one failure, the Windows EPERM in `server/payloadUpdate.test.js`, which passes 17 of 17 alone, and the build exited 0. The run after the final fix wave and the research round are the open items.

## Charlemagne AD 800 start

[PR #15](https://github.com/sp1e/Attainder/pull/15) merged the Charlemagne start as `0192a1e9`. It offers the package as a third start on both adapters, and the start card preselects it. The scenario `default` still holds John, so `HISTORICAL_START_ORDER` sets the default and existing John saves stay bound. Each shipped start has its own install marker in `HISTORICAL_BOOKMARKS`. The character panel shows `Överlevnad osäker` from `claims.survival` and `Företrädare vid hovet` on historical religions, and seeded religions keep their public claims, so the panel names Leo III without a person for him. The full serial suite on `efe9f11` ran 4,815 tests: 4,812 passed, 0 failed, 1 skipped and 2 TODO. The build and `build-historical-scenarios.mjs --check` exited 0. The browser run on 7 November 2026 is recorded in the [play script](../play-scripts/historical-foundation.md). Both adapters have now run the start card, the map at Aachen, a household command, a reload and one real year turn.

## Every culture playable: Phase 1

The owner decided on 7 November 2026 that every culture of the world in the period must be playable, and moved the upper start year to AD 1530. The design is `docs/superpowers/specs/2026-11-07-world-cultures-design.md` and the Phase 1 plan is `docs/superpowers/plans/2026-11-07-world-cultures-phase-1.md`. Codex does the research under `docs/development/CODEX-RESEARCH-BRIEF.md`, and Claude writes the code.

[PR #22](https://github.com/sp1e/Attainder/pull/22) merged Phase 1 to `main` as `bfaf00c1`:

- New campaigns start from 3300 BC through AD 1530. The chronicle note `Forskningen sträcker sig till år 1200.` stays until research reaches further.
- A package can list several playable polities. Charlemagne 1.1.0 adds Kyrkostaten, with Leo III as the documented pope in Rome and merit succession. A Kyrkostaten campaign is named `Kyrkostaten, 800 e.Kr. · Riket`.
- The validator refuses every court the start-time seed refuses, a generated person without the label `Genererad person`, and any succession law other than primogeniture or merit.
- A library read upgrades an installed shipped start with an older content version. A deleted start stays deleted. The desktop store writes the versioned world file last, so an interrupted upgrade runs again on the next read.
- Tests that cover every start read the list from `HISTORICAL_BOOKMARKS` plus `default`. `src/runtime/historicalPlayables.test.js` starts every playable polity in realm and family mode.

Evidence at `018c823c`: the full serial suite ran 4,913 tests, with 4,910 passed, 0 failed, 1 skipped and 2 TODO. The build, `build-historical-scenarios.mjs --check` and `check-historical-events.mjs --check` exited 0. Lint reported 18 errors and 71 warnings, all in 40 files this branch does not touch. The browser run is recorded in the [play script](../play-scripts/historical-foundation.md).

Known limit, updated with court renewal: the Kyrkostaten court opens with four men aged 42 to 50 and no women. Under merit succession the realm ended between 813 and 838 on eight seeds. Since Charlemagne 1.3.0 the court elects a generated outsider when it dies out (see Phase 5 below). Charlemagne's court keeps primogeniture and ended between 856 and 868 for the same cause. [Court renewal](#court-renewal) now brings generated newcomers to a thin court and generated spouses to unmarried generated adults, and both courts live to 900 with children born at court.

## Every culture playable: Phase 2

The design is `docs/superpowers/specs/2026-11-07-world-cultures-phase-2-design.md` and the plan is `docs/superpowers/plans/2026-11-07-world-cultures-phase-2.md`. Phase 2 is built on `feature/world-cultures-phase-2`:

- The start card lists every playable polity under nine world regions and five eras, with a search field `Sök rike, härskare eller tid` that ignores case and diacritics. Region ids come from `server/seed/historical/polity-regions.json`, checked by `node scripts/check-polity-regions.mjs --check`.
- Both library stores keep a `historicalSummary` in each historical scenario's meta. The card reads the catalog only and fetches no scenario details or GeoJSON. The desktop store recomputes a summary when the size or modification time of `world.json` or `game.json` changes; the web store projects it on every `putScenario` and migrates older installs in `reconcileMeta`. A start whose court fails the structural checks stays off the card. The full validator still runs at Start.
- The web build writes one module per shipped package under `src/runtime/web/generated/historical/`, with an `index.js` of dynamic imports. `build:web` emitted `egypt-3000bc` at 3,825,944 bytes and `charlemagne-800` at 4,439,240 bytes.
- A new campaign's save keeps only the chosen polity's court. Older saves with every court load unchanged.
- The model prompt ranks polities with `selectFocusPowers`. The first 16 keep their full line, then `Other polities:` names up to 40 more and ends with `+N more`.
- The browser run found the session summary showing `papal-states` when a campaign started within 15 seconds of the menu. `src/runtime/polityNamesRefresh.js` now reloads the name cache when a code is missing, at most once a second.

Evidence at `8176bf1b`: the full serial suite ran 4,956 tests, with 4,953 passed, 0 failed, 1 skipped and 2 TODO, in 276 seconds. The build and the three `--check` scripts exited 0, and eslint reported no errors in the changed files. After the name-cache fix at `9d8605de`, the `src/runtime` tests ran 2,568 of 2,568. The browser run is recorded in the [play script](../play-scripts/historical-foundation.md). Next: Phase 3, the reviewed courts of AD 800 and AD 1200.

## Every culture playable: Phase 3

The design is `docs/superpowers/specs/2026-11-07-world-cultures-phase-3-design.md` and the plan is `docs/superpowers/plans/2026-11-07-world-cultures-phase-3.md`. Phase 3 is built on `feature/world-cultures-phase-3`:

- `server/seed/historical/dossier-courts.mjs` builds a court, seat, sources and coverage lines from a `ready` polity in Codex's court dossiers. Western Xia and Chimú stay blocked.
- Charlemagne 1.2.0 has ten playable polities: Karls rike, Kyrkostaten, Tangriket, Abbasidiska kalifatet, Bysantinska riket, Silla, Emiratet Córdoba, Aghlabidiska emiratet, Kungariket Asturien and Furstendömet Benevento. Rome carries Codex's reviewed note.
- John 1.1.0 has four: Johns riken, Khmerriket, Almohaderna and Frankrike. `node scripts/sync-default-scenario.mjs` writes `server/seed/default` from the John package with `builtInRevision` 2; `--check` fails on drift and runs in the suite through `server/syncDefaultScenario.test.js`.
- Each court carries its own `contextSv`. The card, the campaign record and the model briefing describe the chosen polity. `HISTORICAL_SUMMARY_SCHEMA` is 2.
- A campaign saved under Charlemagne 1.1.0 or John 1.0.0 restores against the new release. The companion check accepts a later `builtInRevision` for the same `builtInMap`. `server/fixtures/*.patch.json` rebuild the old releases byte for byte; rerun `scripts/write-release-patch.mjs` after any rebuild of those packages.
- Both library stores read the clock once when they stamp a built-in scenario and treat stamps under one second apart as unedited, so an untouched default no longer reads as edited.
- The character view reads the end of research from `server/seed/historical/events/coverage.json` (year 1199 after Codex's AD 1000–1199 research).

Evidence at `7ccef350`: the full serial suite ran 5,029 tests, with 5,026 passed, 0 failed, 1 skipped and 2 TODO, in 445 seconds. The build and the four `--check` scripts exited 0, and eslint reported no errors in the changed files. Egypt's package and its release rows are byte-identical. The browser run is recorded in the [play script](../play-scripts/historical-foundation.md). Next: Phase 4, the AD 1500 package (Aztec and Inca courts).

## Every culture playable: Phase 4

The design is `docs/superpowers/specs/2026-11-07-world-cultures-phase-4-design.md` and the plan is `docs/superpowers/plans/2026-11-07-world-cultures-phase-4.md`. Phase 4 is built on `feature/world-cultures-phase-4`:

- A new built-in package, `world-1500` 1.0.0 (bookmark `1500-12-31`, map `world_1500` pinned), offers Aztekriket and Inkariket. Both courts come from Codex's `courts/ad1500-courts.json`; the primary polity can now be a dossier polity.
- Aztekriket: Ahuitzotl as `Huey tlatoani`, Cuauhtémoc, merit succession, and a temple cult with no leader on the bookmark because the dossier names nobody for the temple office. The generated priest takes the leadership at the first mandate refresh. Inkariket: Huayna Capac as `Sapa inka`, Huáscar and Araua Ocllo, primogeniture.
- The importer reads object chronologies, the `collective-rule` engine limit and `engineLimitNotesSv`. Charlemagne 1.2.0, John 1.1.0 and Egypt keep their bytes; `server/world1500Scenario.test.js` pins their twelve release rows by size and sha256.
- Ming and the Ottoman Empire stay off the card: the AD 1500 review keeps Ming 77 quarantined and rejects Ottoman 290 for 1500. The coverage rows say so.
- `HISTORICAL_BOOKMARKS` installs the start with marker `historical-bookmarks-world-1500`; the card lists both polities under `AMERIKA`, era `Senmedeltid`. Charlemagne stays the default start.

Evidence at `670af54d`: the full serial suite ran 5,082 tests, with 5,077 passed, 2 failed, 1 skipped and 2 TODO. Both failures are `scripts/test-local-model-*.mjs`, which call this machine's Codex CLI (`config.toml` line 9 and the rejected `--ignore-user-config` flag); `npm test` does not run them. The build and the four `--check` scripts exited 0. The browser run is recorded in the [play script](../play-scripts/historical-foundation.md). Next: Phase 5, engine depth (polity kinds, elective succession, culture name pools).

## Every culture playable: Phase 5

The design is `docs/superpowers/specs/2026-11-07-world-cultures-phase-5-design.md` and the plan is `docs/superpowers/plans/2026-11-07-world-cultures-phase-5.md`. Phase 4 merged as `02aea551` in PR #34. Phase 5 is built on `feature/world-cultures-phase-5`:

- A package polity may carry `kind`: `state`, `city-state`, `confederation`, `chiefdom` or `non-state`, with `state` when absent. Both validators refuse other values and a playable `non-state` polity. A campaign stores the kind as `realm.kind`, and `ensureRealmKind` gives older saves `state`. The card shows a Swedish kind label after the era for every kind except `state`; `HISTORICAL_SUMMARY_SCHEMA` is 3.
- `SUCCESSION_LAWS` is `primogeniture`, `merit`, `elective`, and the legislator's reform cycles the three. Under `elective` the engine ranks adults of the old ruler's house by merit, then the house's minors by age, then the other adults by merit. The old ruler's own children count as the house whatever their family; the old ruler's spouse and co-parents stand with the other adults, and a child the ruler adopted makes nobody a co-parent. With nobody left, `electOutsider` crowns `Vald härskare <n> (genererad)` of `Valt hus <n> (genererat)`, aged 40, and draws no randomness. The forecast reports `electionFromOutside`, names `En genererad person utanför hovet väljs.` as the successor and creates nobody. `claimHistory` gets no `legal_succession` entry from a dead ruler to himself. `Ämbeten & arv` shows `Tronföljd: <label>`.
- Kyrkostaten, Kungariket Asturien, Almohaderna, Aztekriket and Inkariket elect their ruler in Charlemagne 1.3.0, John 1.2.0 and world-1500 1.1.0. `server/seed/default` follows John 1.2.0 with `builtInRevision` 3. At the world-1500 bookmark the election after Huayna Capac goes to Huáscar under a regency. Egypt keeps its package bytes and release rows.
- `server/fixtures/` holds patches for Charlemagne 1.1.0 and 1.2.0, John 1.0.0 and 1.1.0 and world-1500 1.0.0, so campaigns saved under every earlier release restore.
- On the eight seeds of `src/runtime/characters/courtBalance.test.js`, Kyrkostaten plays 100 years from the built package. The last of the four opening courtiers dies and the first outsider is elected between 817 and 836. On 25 December 900 every seed has an elected ruler, three to five elections behind it and a living realm.

The century test landed in `9aba7bbc`. The final review's fixes followed in `d619c2cd` (engine, panel and law label) and `ec131a83` (the corrected `elective-rule` text, rebuilt into the three unreleased packages). Evidence at `ec131a83`: the full serial suite ran 5,127 tests, with 5,124 passed, 0 failed, 1 skipped and 2 TODO, in 470 seconds. The build and the four `--check` scripts exited 0, and eslint reported no errors in the changed files. The browser run at `9aba7bbc` predates these fixes. The rebuilt packages differ from that run in the `mechanics.noteSv` of the four dossier courts and the recorded `dossier-courts.mjs` hash. The new law label and the forecast's election line have unit tests and no browser rerun. The browser run is recorded in the [play script](../play-scripts/historical-foundation.md). Name pools and several spouses per person remain open.

## Court renewal

The design is `docs/superpowers/specs/2026-11-08-court-renewal-design.md` and the plan is `docs/superpowers/plans/2026-11-08-court-renewal.md`. Court renewal is built on `feature/court-renewal`:

- `courtRenewalStep` in `server/characters/renewal.js` runs once a year on historical states, in `annualStep` after `courtAnnualStep`. Hadara states never run it.
- Court adults are living persons aged 18 or more whose family is not in exile. With fewer than 6 court adults the step brings one newcomer a year, `Hovman <m> (genererad)` or `Hovdam <m> (genererad)`, aged 25, as head of a new house `Hovhus <k> (genererat)`. The chronicle logs the event type `arrival` with the title `Ny person vid hovet`.
- While the court has fewer than 12 court adults, each living generated person aged 18 to 35 with no living spouse and no partner at court gets one draw, unless the person is the active representative or holds the ruler or priest office. Below 0.25 a generated spouse `Gemål <g> (genererad)` joins the person's family. Births then follow from the existing birth step.
- The step draws only from a new stream, `state.lineageRngState`, which only historical states carry. The main stream keeps its order of draws, and the Hadara digests and pinned streams are unchanged. A historical run parts from a run of the code before court renewal after the first newcomer or generated marriage, because the new people take part in the main-stream steps that follow. The spec accepts this.
- Historical courts have a birth cap. `birthsClosed` in `renewal.js` is true when a historical state holds `COURT_BIRTH_CAP` (48) or more living people of any family and age. The birth loop of `annualStep` checks it before each mother and stops there, so a closed court spends no draws on further mothers. Hadara states never close and keep every draw.

On the eight seeds of `src/runtime/characters/courtBalance.test.js`, both courts play 100 years in realm mode from the built package. Karls rike is alive on 25 December 900 on every seed. Its first newcomer arrives between 838 and 848, and in 900 it has 10 to 17 court adults; 16 to 28 children were born during the century. Kyrkostaten gets its first newcomer in 801 on every seed, and in 900 it has 12 to 29 court adults; 21 to 57 children were born during the century. The Phase 5 century figures above were measured before court renewal. The century tests report the same figures with the birth cap.

Without the cap, Kyrkostaten grew without bound after its first century. On seed 777 it held 899 living people in 1200, in an 18.3 MB save, at about 275 ms per year; on seed 314159 it held 592 in 1100 and 2,691 in 1200, in a 49.8 MB save. With the cap, seed 777 holds 48 living people in 1100 and 43 in 1200, in a 5.0 MB save at about 45 ms per year, and seed 314159 holds 40 in 1100 and 17 in 1200, in a 4.3 MB save. Over 300 years on the eight seeds, the most living people at any century mark fell from 592 to 48 in Kyrkostaten and from 125 to 47 in Karls rike. Dead people stay in the save, so its size grows by 0.3 to 0.7 MB per 50 years. The test `Kyrkostaten stays bounded over three centuries` in `courtBalance.test.js` plays seeds 777 and 314159 to 1100 and allows at most 60 living people.

Evidence at `95830a88` with the century tests of the commit that adds this section: the full serial suite ran 5,156 tests, with 5,153 passed, 0 failed, 1 skipped and 2 TODO, in 447 seconds. The build and the four `--check` scripts exited 0, and eslint reported no errors in the changed files. After the birth cap (`d862da77`), the full serial suite ran 5,160 tests, with 5,157 passed, 0 failed, 1 skipped and 2 TODO, in 451 seconds, and the four `--check` scripts exited 0. The browser run is recorded in the [play script](../play-scripts/historical-foundation.md).

## Coverage per start

The design is `docs/superpowers/specs/2026-11-08-world-cultures-phase-6-design.md` and the plan is `docs/superpowers/plans/2026-11-08-world-cultures-phase-6.md`. Phase 6 is built on `feature/world-cultures-phase-6`:

- `server/historicalCoverage.js` computes coverage per package: playable polities with region, seat and source count; map-only polities with the dossier's status and blocked reason; review features by boundary decision and classification; package sources; continent areas. `server/historicalMapCoverage.js` holds `mapCoverage`, which the summary and the card use; it has no imports, so the summary module can use it without a cycle.
- `server/historicalInventory.js` validates the public inventory derivative `server/seed/historical/coverage/inventory.json` (schema `attainder-public-inventory-v1`) and gives each row a shipped status: `playable`, `on-map`, or the row's own research status. Codex owns the file and has not published it; the request is in `docs/development/CODEX-HANDOVER.md`.
- `scripts/check-start-coverage.mjs` writes `docs/coverage/start-coverage.md`, and with `--check` compares it. `server/historicalCoverageReport.test.js` runs the check, so `npm test` and CI fail when the report drifts from the packages, the dossiers or the inventory. Whoever changes an input regenerates the report in the same commit.
- `HISTORICAL_SUMMARY_SCHEMA` is 4: each summary carries `mapCoverage`. The `Källor och osäkerhet` block of the start card shows `Spelbara riken i starten: 4. På kartan utan spelbart hov: Västra Xia, Chimú. Kartområden utan granskad ägare: 280.` for John and `Spelbara riken i starten: 10. Kartområden utan granskad ägare: 214.` for Charlemagne.

Today's counts: playable 1, 10, 4 and 2 (Egypt, AD 800, AD 1200, AD 1500), map-only only Västra Xia and Chimú at AD 1200, and 137, 214, 280 and 289 review features withheld from ownership. The report gives counts and no percentage, because the coverage unit and the historical denominator are not defined yet.

Evidence at `a9a599b8`: the full serial suite ran 5,186 tests, with 5,183 passed, 0 failed, 1 skipped and 2 TODO. The four `--check` scripts and `node scripts/check-start-coverage.mjs --check` exited 0. At `dc08c497`, `npm run build` passed and the browser run on both adapters showed the expected lines with 0 console errors; it is recorded in the [play script](../play-scripts/historical-foundation.md).

## Character features, 8 and 9 November

The owner approved ten character features on 8 November 2026. Each has a spec under `docs/superpowers/specs/` and is merged to `main`:

- Shared memories carry favor or grievance in conversations: `2026-11-08-memory-valence-design.md`, PR #68, `16f7f402`.
- Watches stop a longer advance: `2026-11-08-watches-design.md`, PR #69, `da2d76ce`.
- A disloyal councillor flatters the odds: `2026-11-08-flattering-advisor-design.md`, PR #70, `7b05d452`.
- The reign card shows the way to a nickname: `2026-11-08-nickname-path-design.md`, PR #71, `0daa5849`.
- Friends and rivals form at court: `2026-11-08-friends-and-rivals-design.md`, PR #73, `3daf12a4`.
- Grudges pass to the children: `2026-11-09-inherited-grudges-design.md`, PR #76, `c80e1b4d`.
- Children of an affair: `2026-11-09-illegitimate-children-design.md`, PR #79, `a6ad8182`.
- The physician's prognosis and the deathbed: `2026-11-09-deathbed-design.md`, PR #82, `f8b76b63`.
- The electors vote under the elective law: `2026-11-09-elector-votes-design.md`, PR #83, `412e8a20`.
- Old settled stories fade: `2026-11-09-story-fade-design.md`, PR #85, `2f034ece`.

None of them raises `rulesVersion`. The deathbed and the story fade were run for 200 and 300 years against `main` and kept the same people, deaths, rulers and random streams. Two rules came out of this work: a story or log entry that NPCs see takes its id from its own content, never from `state.sequence`, and a timing comparison counts only when `main` and the branch run back to back.

## Several spouses

The spec is `docs/superpowers/specs/2026-11-09-several-spouses-design.md`, PR #127, `520312ca`.

- An authored court may give a person two or more reciprocal spouses. `spouseId` keeps the first; the optional `otherSpouseIds` keeps the rest in authored order and exists only on such people, so saves and shipped starts are unchanged.
- `server/characters/marriage.js` exports `spouseIdsOf`, `isMarried` and `hasLivingSpouse`. Mourning, kinship, the marry command and its form, matchmaking, court renewal, succession partners and `marriedIn` read every spouse. Births and affairs read `spouseId` only.
- The Swedish note for the `multiple-spouses` engine limit in `server/seed/historical/dossier-courts.mjs` still says the game allows one spouse, because `releases.json` pins John 1.2.0's bytes. Change it with the next John release. Codex decides whether Agnes of Merania enters `france-capetian` and whether the limit stays.
- The demo and Charlemagne gave the same people, deaths, rulers and random streams over 300 years on `main` and on the branch.

## A tutor who corrects a trait

Phase 4, moment 5 of `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`. The spec is `docs/superpowers/specs/2026-11-09-tutor-trait-correction-design.md`, PR #164, `7f5a0751`.

- `server/characters/tutoring.js` holds the rule. When the mentor holds a trait whose opposite (`OPPOSITE_TRAITS`) the child has, the adulthood step's existing draw replaces that trait in place below `CORRECTION_CHANCE` (0.6). Without an opposite the old rule applies: below 0.4 the traits become `[own first, mentor first]`.
- The adulthood step still makes one `random(state)` call, only while the mentor lives. The educate event names the prospect and the adulthood event names a correction that took.
- No NPC calls `educate`; a newborn's mentor is its mother. The demo and Charlemagne seeds 777 and 321 gave the same random streams, sequence and health values over 300 years on `main` and on the branch.
- Moments 10, 8, 9 and 6 follow below. Phase 4 is complete.

## A handover card for a new reign

Phase 4, moment 10. The spec is `docs/superpowers/specs/2026-11-09-reign-handover-design.md`, PR #166, `b0130272`.

- `server/characters/handover.js` exports `reignHandover(state, hooks)` and `HANDOVER_MONTHS` (12). It reads only `offices.ruler.history` and `state.reign`, and the court panel (`CourtSections.jsx`) shows the card "Ett nytt styre" for the first twelve months of a reign.
- There is no card at the campaign start, when the nearest earlier holder is the sitting ruler (a dissolution), when the last history entry is not dated `reign.startedAt` (old saves), or when nothing differs.
- Every written person in the Charlemagne court has the same generated values (steward, dutiful, 5,6,5,5,4,4), so an abdication at the start shows no card. Over 150 years of seed 777 all 22 later pairs of rulers differ. Codex owns the court seeds.

## A ruler's illegitimate child claims the throne

Phase 4, moment 8. The spec is `docs/superpowers/specs/2026-11-10-bastard-claimant-design.md`, PR #167, `6e3b3ca5`.

- `server/characters/bastardClaims.js` finds royal bastards: living subjects of an exposed `illegitimate_child` secret whose biological father appears in `offices.ruler.history`, the sitting ruler left out. `claimantFor` puts the eldest free adult one first.
- The yearly step gives each adult royal bastard −20 "Förnekad arvsrätt" for 20 years towards the sitting ruler, one cause per ruler and none towards its own father. The ultimatum names the claimant "X, oäkta barn till Y".
- The module draws nothing. Over 300 years of five seeds 11 of 72 children of an affair had a father who ruled, and NPC play exposed none, so a run matches `main` until the player, blackmail or a deathbed confession exposes one.

## A large house loses a rival branch

Phase 4, moment 9. The spec is `docs/superpowers/specs/2026-11-10-cadet-branch-design.md`, PR #169, `05e98580`.

- `server/characters/cadetBranches.js` runs after court renewal on historical campaigns only. A house of 10 living members loses the line of its eldest free adult born into it, outside the head's line and below no living collateral parent, when at least 5 stay behind. One split a year.
- The branch (founder, descendants, a spouse of the house) founds "`<founder>`s gren av `<root house>`" with its share of silver, influence and estates. Both heads get −25 "Husets splittring" for 30 years.
- No draws. Hadara's 300-year state hash matches `main` for seeds 321, 777 and 2; Charlemagne seeds 777, 321 and 5 split 6, 7 and 8 times in 300 years.

## A dead ruler's house is divided among the children

Phase 4, moment 6. The spec is `docs/superpowers/specs/2026-11-10-partition-design.md`, PR #171, `c5726147`.

- A fourth law, `partition` ("delat arv"), ends the legislator's cycle. The crown passes by primogeniture.
- When a ruler dies and a legal child takes the throne, up to three younger free adult children in the ruler's house found houses with their lines (`foundHouse`, shared with cadet branches). Each takes an equal share, rounded down, of silver, influence and estates; the heir's house keeps the remainder. Heir and founders get −30 "Delat arv" for 20 years.
- The game holds one realm, so the house is divided, not the land. Dividing the map waits for phase 6 (foreign realms).
- No draws. Hadara's 300-year state hash matches `main`; Charlemagne under partition for 300 years (seeds 777, 321, 5) divided 3, 4 and 3 times, and the realm survived.

## The heir challenges a rival to a duel

Phase 5, moment 23. The spec is `docs/superpowers/specs/2026-11-10-duel-design.md`, PR #173, `9b0708dc`. Moments 20, 21 and 22 remain.

- `server/characters/duels.js` adds the court story `duel_challenge` on historical campaigns. The heir, an adult of the player's family, challenges the person outside the house they hate most (opinion −25 or a rival bond), at most once in five years.
- The ruler lets the heir fight, sends a better fighter of the family for 15 silver, or forbids it (+20 stress, −20 towards the ruler). An unanswered challenge goes ahead. The loser dies (25 %) or takes an injury.
- A hash of the story id settles the fight; no stream draws. Hadara's 300-year hash matches `main`; Charlemagne seeds 777, 321 and 5 saw 3, 2 and 5 duels in 300 years.

## A choice from ten years earlier comes back

Phase 5, moment 22. The spec is `docs/superpowers/specs/2026-11-10-decision-echo-design.md`, PR #175, `02620e69`. Moments 20 and 21 remain.

- `server/characters/echoes.js` adds the court story `decision_echo` on historical campaigns. A directed-story or chain decision of the player's house that moved someone's opinion by 5 or more comes back in its eleventh year, when the original opinion cause has just expired.
- The witness remembers, or the witness's eldest adult child when the witness has died. A kind memory can be welcomed or cashed in for influence; a harsh one can be paid off, apologised for or left standing as a grudge.
- At most one echo in three years. No draws: Hadara's 300-year hash matches `main`; Charlemagne seeds 777, 321 and 5 saw 16, 23 and 6 echoes in 300 years.
- `court.js` rows may give `expiryFor(story)` when the default choice depends on the story.

## A feast where someone seduces, quarrels or poisons

Phase 5, moment 20. The spec is `docs/superpowers/specs/2026-11-10-feast-outcomes-design.md`, PR #177, `fd866841`.

- `server/characters/feastOutcomes.js` runs at the end of `hold_feast` on historical campaigns, dated the feast's first day. The host and the active representative take no part.
- A married guest who dislikes the living spouse is seduced by the guest of the other sex they like most: an `affair` secret, a `lover` bond and +20 "Gästabudets natt". `paternity.js` names the seducer when a child of the affair is born.
- The two guests of different houses who like each other least quarrel: −15 "Grälet på gästabudet" each way and 10 stress.
- A guest outside the player's family who hates another guest at −40 or lower poisons them half the time. The victim dies in 3 cases of 10; the poisoner is caught in 4 of 10, and the crime is otherwise left for `investigate`.
- Every roll is `hashRoll` of the occasion id. No stream moves.

## Plague reaches the capital

Phase 5, moment 21. The spec is `docs/superpowers/specs/2026-11-10-plague-design.md`, PR #178, `fec3ff22`. Phase 5 is complete.

- `server/characters/plague.js` adds the court story `plague_outbreak` on historical campaigns. An outbreak starts when a yearly `hashRoll` of the plot stream state rolls below 0.04, at most once in 180 months.
- The representative closes the gates (20 silver, infection 0.10), orders prayer (5 silver, 0.25, +3 legitimacy) or flees (free; the player's family is spared, everyone else 0.30, −5 legitimacy). No answer means 0.30 for everyone.
- An infected person dies in 4 cases of 10; deaths go through `hooks.kill`, so succession runs as for any death.

## A wonder lifts prestige for generations

Phase 6, moment 25. The spec is `docs/superpowers/specs/2026-11-10-wonders-design.md`, PR #179, `476dfd68`.

- `build_wonder` costs 100 silver and one order and opens a public project of 120 months: a cathedral, a palace or a library, each built once, at most three.
- A finished wonder gives 15 prestige. Each standing wonder lifts the prestige floor by 20 through `prestigeStep(state, lift)`, so it pays one legitimacy a year for the rest of the campaign.

## Foreign realms beside the court

Phase 6 foundation. The spec is `docs/superpowers/specs/2026-11-10-foreign-realms-design.md`, PR #180, `7cc4c5b6`. Moments 7, 26 and 27 build on it.

- `createHistoricalCharacterSystem` seeds `state.foreignRealms` before `narrowToChosenCourt` drops the other court seeds: the eight nearest courts of the package, with ruler, documented family, seat and distance. A realm within 2,500 km is a neighbor.
- Each year the foreign families age, marry, have children and die by `hashRoll`; a dead ruler's crown passes by the realm's law. A realm holds at most 16 people after the yearly step.
- `memories` and `foreignOpinion(state, realmId)` hold what each realm thinks of the player's. The court tab lists the neighbors. Hadara has no field.

## A marriage alliance that brings the ally's war

Phase 6, moment 7. The spec is `docs/superpowers/specs/2026-11-10-marriage-alliance-design.md`, PR #181, `e08bdb12`.

- `foreign_marriage` (30 silver, one order) marries an unmarried adult of the player's family to an unmarried foreign adult of a neighbor. The partner moves to court as a generated adult, and the realm records `alliance` with +20 "Giftermål" for 30 years.
- An ally calls the player to war in 15 % of years, at most once in five. Joining costs 40 silver and rolls one battle; refusing, or no answer in six months, ends the alliance and leaves "Svek i kriget" at −40 for 30 years.

## A fabricated claim pressed by war

Phase 6, moment 26. The spec is `docs/superpowers/specs/2026-11-10-fabricated-claim-design.md`, PR #182, `473e1e0e`.

- `fabricate_claim` (40 silver, 24 months) forges a claim on a neighbor's border land; the neighbor exposes it in 25 % of cases. `press_claim` was already taken by throne claims, hence the name.
- `declare_war` (60 silver) fights one battle a year. Score +2 wins a border land worth 10 silver a year, −2 loses 50 silver in reparations, and five battles end in a stalemate. `make_peace` ends a war as a stalemate.

## An envoy to a ruler who remembers

Phase 6, moment 27. The spec is `docs/superpowers/specs/2026-11-10-envoys-design.md`. Part one, the engine, is PR #183, `93a7b78a`; part two, the view and the model calls, is PR #184 (`54716d1f`). Moment 24 remains.

- `server/characters/envoys.js` adds `envoy_request`, which only the conversation step may send (`origin: "converse"`). The player asks for reconciliation (base 35) or, during a war, for peace (base 30), once a year per realm.
- Each live memory of the realm is a row of the odds worth its amount divided by 4, held together to −20…20. A gift of 20 to 60 silver adds up to 15 and is paid only on acceptance. A gift or a cited favour the realm owes lets the model's argument score add up to 10; citing a grievance costs 5. The chance is held to 5…95.
- `EnvoyView.jsx` opens under each neighbor in the offices view. `extractEnvoyRequest` reads the player's message into a request; the engine shows the odds and rolls; `replyAsRuler` answers in character about the fixed outcome. The model never sets odds.
- The flow has tests with a stubbed model. It has not been played in a browser with a live model.

## Border tribes to bribe, hire or crush

Phase 6, moment 24. The spec is `docs/superpowers/specs/2026-11-10-border-tribes-design.md`, PR #186, `8104a120`.

- `server/characters/tribes.js` seeds `state.tribes` from `historicalScenario.tribes`: the six nearest within 2,500 km of the seat. No shipped package carries tribes yet, so every start seeds an empty list; section 13 of the research brief asks Codex for the data.
- A restless tribe raids in 10 % of years for 15 silver and 2 legitimacy. `bribe_tribe` (20 silver) buys five years of peace, `hire_tribe` (30 silver) three years and +0.1 to the chance of a battle, and `crush_tribe` (50 silver) one campaign a year that keeps a beaten tribe away for 30 years.

## A ruler reforms or founds a faith

Phase 7, moment 18. The spec is `docs/superpowers/specs/2026-11-11-faith-reform-design.md`, PR #187, `962bd0b4`.

- `reform_faith` (60 silver, one order) takes `mode` `reform` or `found`. The new faith gets support 30 and a `founding` record, and is named "<old> (reformerad)" or "<given name>s lära".
- The ruler's house converts. Each other house with a living head follows at 0.5 or 0.25, moved ±0.2 by the head's view of the ruler, by `hashRoll`. Houses that stay hold "Reformen" −10 or "Kätteri vid hovet" −20 for 20 years. A faith founded in the campaign holds the next reform for 30 years.
- Browser run on 11 November 2026 at `5d66f613` (web adapter, Claude selected, 1440 × 900, light theme, Karls rike at seed 104729): "Grunda en ny tro" logged "Karls lära grundas" with 2 houses following and 1 staying. The religion list showed Karls lära with support +50 and "Grundad 800", and Den latinska kyrkan at +40. Both survived a reload. No model call was made.

## The priests call a holy war

Phase 7, moment 19. The spec is `docs/superpowers/specs/2026-11-11-holy-war-design.md`, PR #188, `60d11366`.

- Each foreign realm carries `faith` from its court seed. `otherFaith` holds when the ruler's faith broke from the neighbor's in the campaign, or when both name a different `tradition`. No package names a tradition yet; section 13 of the research brief asks Codex for one per court religion.
- At most once in ten years (`state.lastHolyWarCall`), the priest or the faith's leader calls in 15 % of years. Going to war (60 silver) starts the border war at once; refusing or silence costs the caller's goodwill (−20) and 10 faith support.
- The builder copies a court religion's `tradition` into the package, and the package validator accepts only the eleven ids of section 13 (PR #190, `5d66f613`). The court dossiers name none yet, so a rebuild after Codex adds the field is what turns on the tradition test.
- In the same browser run, the neighbor list showed each realm's faith ("tro: Den latinska kyrkan"). After Karls lära was founded, Kyrkostaten read "(annan tro)" and no other neighbor did, before and after a reload. A priests' call needs yearly turns with the model and was not played.

## Branch state

Phase 3 tasks 1 to 10 are on `main`. PR #9 squash-merged them as `9a780f7` on 5 November 2026, ahead of schedule because the weekly token limit was nearly spent. `phase-3/court-and-power` keeps the individual commits. Each task passed its own review. The whole-branch review found two reproduced issues; both now have reviewed fixes. The final follow-up review of `08d3518..55283dc` approved the branch with no new Critical, Important or Minor findings. The required test/build check passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295). [PR #12](https://github.com/sp1e/Attainder/pull/12) merged the fixes, and the remote `main` commit was verified as `6f4f7c0de84ea58010e5ea597ff0325f572ea4eb`. The retained remote branch `fix/phase-3-review` ends at `55283dc`; its tested production code remains `cfa225238c5065441e4642481ab507629e498e73`. Nobody has run the Phase 3 play script; the owner deferred the Hadara script behind the historical foundation.

- Phase 3, engine: `reign.js`, `court.js`, `council.js`, `dread.js`, `nicknames.js`, `breakdowns.js`, `familyDemands.js`, `factions.js`.
- Phase 3, model boundary: `buildCharacterPromptContext` adds `court: view.court` and one rule paragraph.
- Phase 3, panel: `CourtSections.jsx`, with the reign card, `Rådet`, `Krav från familjerna` and `Faktioner`.
- Tuned constants: `DISCONTENT_THRESHOLD` 15, demand base chance 34. On eight seeds over ten years every system fires, and an ultimatum fires on seven.
- Phase 3 limitations: a forced abdication does not end a realm campaign; a player can infer an NPC's ambition from traits; `general.loyalty` stays in `militaryReadiness`; an NPC accession wipes a family head's `lostOrders`; a ruler keeps a council seat after accession; no opening ruler has a sibling, so the spec's "ruler's brother" appears once Mira reigns with Neri alive.

Phases 0, 1 and 2 are on `main`. PR #4 squash-merged Phase 2 as `ef0ab7c` on 3 November 2026, and `phase-2/intrigue` keeps its 28 individual commits. Development moved to the owner's private desktop on 4 November 2026. Campaign saves from the earlier computer stayed there.

- Design: `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`. Plans: `docs/superpowers/plans/`, with `2026-10-31-phase-2-intrigue.md` for this phase.
- Phase 0 (event chains): save-validation fixes in `validateEventChains`, rollback and journal tests, and `eventChainIntegration.test.js`.
- Phase 1: the action catalog with `Påverka` and `Undergräv`, labelled odds with skill-based precision, two-roll resolution into five tiers, multi-month schemes, on-demand court staff, the `realm_effect` and `npc_intent` gate, the low-effort `interpret` and `narrate` calls, and the `Handla själv` card. Details are in `docs/play-scripts/phase-1.md` and the contract.
- Phase 2, engine: extensions version 2 with the plot stream `state.plotRngState` and the vacant `Spionmästare` office (`extensions.js`); secrets, grips and crimes (`secrets.js`, `crimes.js`); feasts (`occasions.js`); five more contested actions, `Förgifta`, `Snoka`, `Utpressa`, `Sprida rykte` and `Fängsla` (`actionCatalog.js`, `actionOdds.js`, `actionResolution.js`); prisoners, ransom offers and revolt preparations (`prisoners.js`); rumors heard by the spymaster (`rumors.js`); yearly NPC plots, feuds and affairs, and the `plot_uncovered` decision (`npcPlots.js`); court conversations (`conversation.js`).
- Phase 2, model boundary: the `extract_conversation_request` and `reply_as_character` calls, the `converse_request` command that only `submitConversationRequest` can send, and the Phase 2 facts in the year prompt (`characterModelCalls.js`, `characterWorld.js`). Rumor truth and an estimate's true values never reach a prompt.
- Phase 2, panel: the `Intriger` tab (`IntrigueView.jsx`), `Samtala` and the conversation card (`ConversationView.jsx`), the feast card in `Överblick`, and the prisoner and plot decisions in `Beslut`.
- The contract for all of this is `src/runtime/characters/CONTRACT.md`. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`; `state.extensionsVersion` is 2, and a version 1 save migrates additively on load. Old campaigns load as `Normal`.
- The yearly auto-fill of vacant offices skips `Spionmästare`. Filling it would shift the main random stream and change existing dynasty tests, so the ruler appoints it. A realm run by NPCs has no spymaster.
- Command sequence: on-demand court staff, secrets, hooks, occasions, prisoners, rumors and conversations take ids from `state.sequence`, so the text-sorted person order can differ from a pre-Phase 1 run of the same save. Replay uses stored patches, so no saved campaign changes. Numeric sorts would change `annualStep` randomness order and are left for a `rulesVersion` bump.

## Verification

- Historical foundation Task 4 local checks on 5 November 2026, accepted through `5e3f515`: 253 targeted tests passed with zero failures in 12,187.8953 ms; production build passed in 31.51 seconds with the inherited Babel large-file note and chunk-size advisory. The final run includes the self-review follow-up that removed two additional future-history prescriptions and one associated writing sentence from the historical jump path. The validated hidden-faction fixture also passed its 27-test context suite after its final fixture correction. Captures cover 16 interactive requests and 12 assembled historical jump prompts plus 12 legacy controls. The complete suite and browser acceptance were not rerun for Task 4.
- Historical foundation Task 3 checks on 5 November 2026, accepted through `808361e`: focused engine/runtime/calendar/policy/schema/package suite 1,386 pass; full serial suite 4,584 tests, 4,581 pass, 0 fail, 1 skipped, 2 todo in 115,930.7581 ms. Production build passed in 31.50 seconds with the inherited Babel large-file note and chunk-size advisory. Targeted ESLint reported no diagnostics. The installed-layout test imports the real schema/factory without `src/` and constructs both authored courts. All six original Hadara full-state hashes remain unchanged. These checks do not include historical start UI or browser acceptance, which remain Tasks 5–6.

- Phase 3 follow-up publication on 5 November 2026: final branch review `08d3518..55283dc` approved, with no new Critical, Important or Minor findings; required test/build CI passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295); [PR #12](https://github.com/sp1e/Attainder/pull/12) merged; remote `main` verified as `6f4f7c0de84ea58010e5ea597ff0325f572ea4eb`. The local production-code measurements below remain unchanged.
- Phase 3 review follow-up on 5 November 2026, tested code `cfa225238c5065441e4642481ab507629e498e73`: full serial suite 4,410 tests, 4,407 pass, 0 fail, 1 skipped, 2 todo, in 111,035.0005 ms. Build passed in 33.08 seconds with the inherited chunk-size warning. Full lint: 18 errors and 71 warnings, unchanged; targeted replay ESLint: no diagnostics. The scoped re-review approved the interleaved-date fix with no open Critical or Important findings. These checks do not include the deferred Phase 3 browser script or the Phase 0 visual check.
- Earlier follow-up measurements: annual accounting at `e5358ac` passed 51 focused tests and 24 complete-state parity scenarios; full serial suite 4,404 total, 4,401 pass, 0 fail, 1 skipped, 2 todo; build passed in 36.77 seconds. Legacy replay at `063fa87` passed 185 focused tests; full serial suite 4,409 total, 4,406 pass, 0 fail, 1 skipped, 2 todo, in 113,742.2782 ms; build passed in 31.57 seconds. Its first review then found an intervening model event's date synchronization missing from compatibility replay. Fix `cfa2252` passed the new regression and all 186 focused tests before the final suite above.
- Phase 3 on 5 November 2026: `npm test` at `1698e61` ran 4,370 pass, 0 fail. The runtime suite at `62c7bd4` ran 2,280 of 2,280. Panel tests at `054d46a` ran 106 of 106. CI `test` passed on PR #9.
- Phase 0 gaps on 4 November 2026, branch `test/phase-0-gaps`: 93 tests cover participant and mandate changes during a chain (50), JSON saves between two `advanceCharacters` calls (6), more than 1,000 newer memories (5), and immutable historical roles with story and source uniqueness (32). The last group found a real bug: `validateEventChains` loaded forged saves with swapped roles, rewritten role families, renamed source keys, rewritten city references, repeated steps, step actors outside the cast, deleted chains and spare chain memories. `eventChains.js` now rejects each of them. Full suite after merging main: 3,934 tests, 3,931 pass, 0 fail, 1 skipped, 2 todo.
- Codex on 4 November 2026: a local Codex 0.166.0 answered through `generateWithLocalModel` in plain text in 8 seconds and with a schema in 5 seconds, using the existing ChatGPT login. The global Codex 0.117.0 on this computer stays as it is, and the game shows `Behöver uppdateras` for it. A full model year through Codex has not run.
- Phase 2 review on 4 November 2026, branch `fix/phase-2-review`: an independent reviewer reported nine findings against main, and I confirmed all nine in the code. The fixes hide a collapsed plan from a target who never saw it, lift the spymaster's discovery cap only when his bonus is above 0, tell the reply prompt when a speaker has nothing to tell, refuse a hook an active scheme holds, keep prisoners out of new directed stories and event chains, refuse saves with a held prisoner on the throne or in an office, move an open ransom demand to the new captor, stop an actor reusing a secret that already gave a hook, and require 20 silver before an offer grounds an argument. Against main, 24 prisoner-free campaigns over 960 campaign years kept every saved stream and the whole state. The 32 saved states in this checkout that have a prisoner list load on both engines. Serial suite: 3,841 tests, 3,838 pass, 0 fail, 1 skipped, 2 todo, in 102 seconds. `npm run lint`: 18 errors and 71 warnings, unchanged. Still open: a directed story or chain that is already open stays open when its actor goes to prison later.
- After the play scripts and their fixes on 4 November 2026: 3,821 tests, 3,818 pass, 0 fail, 1 skipped, 2 todo, in 96 seconds. `npm run lint`: 18 errors and 71 warnings, unchanged. `npm run build`: exit code 0.
- Fresh clone on 4 November 2026, Node 24, with the Claude Code detection fix: 3,812 tests, 3,809 pass, 0 fail, 1 skipped, 2 todo, in 91 seconds. `npm run lint`: 18 errors and 71 warnings, unchanged. `npm run build`: exit code 0.
- Live smoke check on the same day: Claude Code read `Jag försöker vinna Namars stöd med gåvor och smicker` in one model call, and the game showed the odds card for `Påverka` against Namar. I cancelled the action, so nothing resolved. The browser console showed no errors once the map files were in place. This check covers one card of Part 3 in the Phase 1 play script.
- Full serial suite on 3 November 2026 at commit `ce1e63e`, after the final review fixes: 3,811 tests, 3,808 pass, 0 fail, 1 skipped, 2 todo, in 172 seconds. Phase 1 ended at 3,543 tests, so Phase 2 added 268. `server/payloadUpdate.test.js` can fail on Windows with an `EPERM` rename; it passed in this run.
- `npm run lint`: 18 errors and 71 warnings, the same as `origin/main`. Phase 2 adds no lint finding. An earlier run showed 20 errors, because the name `useHook` in `secrets.js` made the React hooks rule fire in `actionResolution.js` and `conversation.js`; both files now import it as `consumeHook`.
- `npm run build`: exit code 0.

## Play scripts

Both scripts ran against Claude Code on 4 November 2026, driven through a browser. Every part passed.

**Phase 1**

| Part | Result | Notes |
|---|---|---|
| 1, 2 | Pass | |
| 3 | Pass | `Påverka` against Namar av Hadara. Success `osäker`, secrecy `osäker`. The model read the text in 4.4 seconds. |
| 4 | Pass | Tier `Misslyckat och avslöjat`, story `Arels ord faller till marken`. |
| 5 | Pass | The script said the game stays open after a reload. A reload returns to the main menu, so the script now says to click `Current`. |
| 6 | Pass | `Undergräv` against Dara Namar at `osannolik`. The target found out, so the chronicle shows `Undergräv: planen avslöjades`. The model year took 118 seconds. |
| 7 | Pass | |
| 8 | Pass | After `Clear list` an English modal about Gemini opened. Dynasty campaigns no longer show it. |
| 9 | Pass | The pre-Phase 1 save from `728eaec` loaded as `Normal`, and a model year ran in 125 seconds. The old build needed two local patches to reach Claude and to finish its year: the Claude detection and the `sold` guard below. |

**Phase 2**

| Part | Result | Notes |
|---|---|---|
| 1 to 3 | Pass | |
| 4 | Pass | Poison against Tarek Arel: success `osäker`, secrecy `osäker`. `Gästabudet ger tillträde: +` and `Hemlighållning: många vittnen på gästabudet: −` showed in both the free-text and the menu card. |
| 5 | Pass | Tier `Förgifta: misslyckat i det tysta`. Tarek lived. The model year took 182 seconds. |
| 6 | Pass | The spymaster heard `Sammansvärjning: Sera Arel`, named culprit Danel Safra, reliability `trolig`. A rumor about Talia Namar succeeded and shows `Påstådd aktör: okänd`. |
| 7 | Pass | A support request with 20 silver at `osäker` ended in `Sera Arel avvisar förfrågan.` The reply agreed with the note, and the repeat was refused. Focus landed on the person's heading, because a decided request hides `Samtala`. |
| 8 | Pass | `Fängsla` against Kelan Namar: success `jämn`, secrecy `mycket låg`, tier `Lyckat men avslöjat`. |
| 9 | Pass | The offer `Lösen för Kelan Namar` came after one year. `Ta emot lösen` freed the prisoner. |
| 10 | Pass | `Personen finns inte i spelet: Zorbas.` |
| 11 | Pass | On `Svår` a rumor came after one year and `Komplott avslöjad: Kelan Namar` after two. `Behåll kunskapen som grepp` gave `Grepp över Kelan Namar`, `Styrka: starkt`. |
| 12 | Pass | |

The play scripts reached four of the five tiers. `Det slog tillbaka` did not come up, and unit tests cover it.

**Bugs the scripts found, all fixed**

- A Claude Code installed through npm was reported as missing, because the bridge looked for `claude.exe` only in `~/.local/bin` and on `PATH`.
- `LEGAL_TRANSFER_LANGUAGE` matched the Swedish word `sold` (a soldier's pay). A character campaign treats its final attempt as strict, so the whole year was lost after 158 seconds. The check now needs `sold to`.
- Codex older than the flags the bridge sends read `Inloggad och tillgänglig` and then failed on every call. Codex 0.117.0 lacks `--ignore-user-config`; 0.166.0 has it. The status now reads `Behöver uppdateras` with the update command. A real Codex call has not run on this computer.
- `Planen avgörs 1/4 300 f.Kr..` had two periods, `Statskassan förändras med 30.1 silver.` used a decimal point, and the skill list showed `prowess` in English.
- A failed year showed the model call's English error. The panel now shows a Swedish sentence and logs the original.
- The panel header still read `Open Historia · Dynastier`.

## Traditions and name pools release

Charlemagne 1.4.0, John 1.3.0, Egypt 1.1.0 and world-1500 1.2.0 read three research side files: `courts/faith-traditions.json` gives every court religion its `tradition` (Aztekriket `mesoamerican`, Inkariket `andean`), `courts/border-tribes.json` gives Charlemagne seven, John three and world-1500 two border tribes with Swedish names and their sources, and `name-pools/frankish-saint-germain-823-829.json` names the children and staff of Karls rike. The research session sends changes to these files to Claude, who ships them in a rebuild. The release patches in `server/fixtures/` cover every shipped version, and a patch op may drop a key the release lacked.

## Next step

Claude writes the code. Since 11 November 2026 a separate Claude research session does the work `docs/development/CODEX-RESEARCH-BRIEF.md` assigned to Codex, in its own worktrees and pull requests. Current priorities are in `docs/development/DEVELOPMENT-BACKLOG.md`; the earlier queue is in `docs/development/CODEX-HANDOVER.md`.

The owner changed the setting on 5 November: use the real world and historical polities, with new starts from the Bronze Age through about AD 1200 and no modern starts. `docs/superpowers/specs/2026-11-05-historical-world-direction.md` supersedes the fictional Hadara default. The Phase 3 follow-up is merged. Follow `docs/superpowers/plans/2026-11-05-historical-campaign-foundation.md`. Tasks 1–2 are accepted through `6397177`: pure start policy and sourced Egypt/AD 1200 packages. Task 3 is accepted through `808361e`. Its mechanical shared-engine relocation was published as `d9633af`; historical construction uses that same engine. Tasks 4–5 are accepted through `1addf27`: historical prompt context and combined guards/defaults/UI have passed their task reviews. Task 6 and final documentation review are accepted with documented limits; current-head CI is required before merge. The annual research and popup are the next separate milestone.

The owner also requested year-by-year historical research for approximately 3300 BC through AD 1200 and a turn-end popup showing the real events of the current year alongside dynamic campaign events. The backlog records the research scope, source/date uncertainty, coverage gaps and game acceptance criteria. A private research pilot and independent checking have begun. There are no release-approved event records, no reviewed whole year and no implemented popup.

## Phase 3 review rulings

- Annual reporting counts actual base receipts plus the chancellor's paid delta, including treasury clamps and rounding. Loyalty drift and court ordering stay unchanged. The existing year event retains its ID, position and public shape; the one-decimal aggregate reveals no separate numerical service or loyalty field. Other story/plot payments retain their own events. This fixes the unexplained chancellor residual without changing payment outcomes.
- Legacy replay reconstructs stored outcomes before migrating checkpoints. Normalization validates and retains raw legacy full-checkpoint payloads. Compatibility handling follows the adapter after each event's date synchronization and host reconciliation, including model events without character operations. Current-version checkpoints and authorized commands end that handling. Current-version reign mismatches, revision mismatches and invalid source/gate metadata still fail validation. No new random draw, model call, persistent provenance or version bump is involved. An unsupported legacy shape needs a separate compatibility regression.

## Known Phase 2 limitations

- A player can infer that a rumor is fabricated. A rumor about `Otrohet` or `Oäkta börd` can only come from `Sprida rykte`, and one without a claimant is shown as `osäker`.

## Still open

The Phase 0 panel check passed on 9 November 2026 in the web build at Karls rike, AD 800: a private choice (`Återhämta dig`, paid from the family purse) in the light theme at 1 400 px and a public choice (`Ändra skattepolitik` to `Hög`, paid from the treasury) in the dark theme at 390 px. After each reload the campaign kept the choice, its event and the theme. The check found two header faults at 390 px, both fixed: the 42 px civic mark overflowed its 30 px box into the eyebrow text, and the close button's `×` glyph sat 9 px below the middle of its circle. The close button now draws its cross as an SVG icon; pinned by `src/Game/Characters/panelHeader.test.js`.

Claude ran the play scripts through a browser. A person has not played them yet.

Two rules hold for every change. A normal read, validation or presentation call never chooses a branch, spends money or draws randomness. Model output never performs the player's decision: it reaches the save only through a command, and replay never calls the model.

The reference implementation for chains is in `src/runtime/characters/eventChains.js`, with data in `eventChainContent.js` and host integration in `src/runtime/characterWorld.js`. `docs/design/event-chains.md` records the current contract and limits.

Use existing Claude Code/Codex CLI logins. Do not publish credentials, private campaign state or machine-specific QA reports. Install dependencies with `npm ci`, fetch the map files with `node scripts/fetch-map-assets.mjs --ensure` and build with `npm run build`; generated dependencies, map files and bundles are reproducible and intentionally ignored. Preserve upstream AGPL attribution. Public documentation is English; current game text and the historical research report are Swedish.

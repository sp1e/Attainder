# Development backlog

Updated 8 November 2026. The owner's current requests take precedence over the earlier fictional-world design. This file records planned work; it does not claim implementation or research completion.

| Order | Work | State |
| --- | --- | --- |
| 1 | Merge the reviewed Phase 3 fixes. | Complete: [PR #12](https://github.com/sp1e/Attainder/pull/12) merged; final review `08d3518..55283dc` approved with no new Critical, Important or Minor findings; required test/build CI passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295); remote `main` verified as `6f4f7c0`. Retained remote branch `fix/phase-3-review`: `55283dc`. |
| 2 | Replace the playable fictional world and modern default with real-world historical campaign starts, from the Bronze Age through about AD 1200; offer no modern starts. | Tasks 1–5 accepted through `1addf27`, including guards, defaults and UI. Task 6 and final documentation review are accepted with documented limits. Final review approved publication subject to current-head CI; PR #13 tracks merge state. The Charlemagne AD 800 start is on `feature/charlemagne-800` as the default start; its browser run is recorded in the play script, with the server map and the web turn open. |
| 3 | Research historical events year by year and add an end-turn historical-events popup. | Popup, per-device watermark and the chronicle record `I verklighetens historia` are built and read an approved catalog. The catalog ships empty, so no popup appears yet. The research round and the full 4,830-year research requirement remain open. |
| 4 | Continue family/succession, life/events, diplomacy/war and religion phases against the historical setting. | Replan after the historical foundation. |
| 5 | Widen the date guards for three-digit years. | Three-digit years skip the four-digit guards at `src/Game/AI/gameplay.js:1354, 14615, 14620`; widening them needs a form that does not read `March 3, 200 soldiers` as a date. |
| 6 | Make every culture of the world in the period playable, and move the upper start year from AD 1200 to AD 1530 (owner, 7 November 2026). | Phase 1 merged in PR #22: several playable polities per package, Kyrkostaten at AD 800, validator rules for generated people and start-time refusals, the 1530 range, upgrades of installed shipped starts and catalog-driven tests. Phase 2 merged in PR #27: the searchable picker by region and era, start summaries in library meta, one web module per package, saves with the chosen court only and a ranked prompt polity list. Phase 3 merged in PR #30: the eleven `ready` court dossiers of AD 800 and AD 1200 are playable in Charlemagne 1.2.0 and John 1.1.0. Phase 4 merged in PR #34: the new package `world-1500` with Aztekriket and Inkariket. Phase 5 built on `feature/world-cultures-phase-5`: `polity.kind` with `realm.kind`, the `elective` succession law and five elective courts in Charlemagne 1.3.0, John 1.2.0 and world-1500 1.1.0. Phase 6's first slice merged in PR #46: `docs/coverage/start-coverage.md`, generated and checked in CI, and summary schema 4 with each start's map coverage on the card; its inventory section waits for Codex's public derivative. Later phases follow `docs/superpowers/specs/2026-11-07-world-cultures-design.md`. Codex researches under `docs/development/CODEX-RESEARCH-BRIEF.md`. |
| 7 | Let courts renew themselves: an elective law that brings in a new ruler when no heir exists, and courts with people who can marry and have children. | Complete; merged to main through the court renewal PR: world-cultures Phase 5 added the elective law, and court renewal brings a generated newcomer to a court with fewer than 6 adults and generated spouses while it has fewer than 12. A birth cap stops births at a historical court with 48 or more living people. On all eight seeds of `courtBalance.test.js` Karls rike is alive on 25 December 900, and its first newcomer arrives between 838 and 848. Kyrkostaten has 12 to 29 court adults in 900. Children are born at both courts on every seed. Over 300 years Kyrkostaten on seed 777 holds 48 living people in 1100, against 219 without the cap. |
| 8 | Guard `citiesFor` in `scripts/build-historical-scenarios.mjs` against a playable polity without a court, so the validator reports `invalidCourt` instead of a TypeError. | Complete: `citiesFor` skips a polity without a court, pinned by a test in `server/historicalProvenance.test.js`. |
| 9 | Keep a fresh desktop install that stops between the world file and the manifest from leaving a scenario folder outside the manifest. | Found in the Task 6 re-review. It predates the world-cultures branch. |
| 10 | Release Charlemagne 1.2.0 with a Rome settlement note (`ROME_800`) and an AD 800 `contextSv` that hold for both Karls rike and Kyrkostaten. Both say `spelsätet är Aachen` today. | Complete in world-cultures Phase 3: Charlemagne 1.2.0 carries Codex's Rome note and one start text per polity. |
| 11 | Install shipped starts on demand instead of at first boot. | Revisit when more than ten packages ship. Both stores install every shipped start at first boot today (world-cultures Phase 2 non-goal). |
| 12 | Shrink `componentLicenses` in saves, about 1 MB per campaign. | The licence texts carry attribution, so removal needs its own design. |
| 13 | Move the `readdirSync` after the rename in the temp-file cleanup of `server/libraryStore.js` inside its `try`. | Minor from the world-cultures Phase 1 final review. |
| 14 | Parse John's world once per catalog build in `syncBuiltInScenarioSeedDate`; it parses it twice. | Predates world-cultures Phase 2. |
| 15 | Run the full `validatePlayableScenario` when a start summary is rebuilt and store `invalid: true` on failure, then raise `HISTORICAL_SUMMARY_SCHEMA` to 5. World-cultures Phase 6 used 4 for map coverage, Phase 5 used 3 for the polity kind, and Phase 3 used 2 for the per-polity start text. The card checks only structure today, so a start with no map feature for a polity, a date outside the range or a copy written under an older validator appears and fails at Start with the Swedish refusal. | Phase 2 final review M2. Take up when edited and imported starts become common. |
| 16 | Add `ctimeMs` or a hash of `game.json` to the desktop summary stamp, and pass the raw meta through `buildScenarioCatalogEntry` instead of reading it up to three times. | Phase 2 final review M4 and M6. A same-size edit within one timestamp tick on FAT32 or a network share keeps the old summary. |
| 17 | Stub `generated/historical/index.js` and the package modules in `src/runtime/web/libraryStore.test.js`. The test reads the generated files from disk, and `seed-web-defaults.mjs` removes and recreates that folder, so a parallel `npm test` on a clean checkout can race. | Predates Phase 2 (the file fails 23 of 23 at `bfaf00c1` without generated files). In Phase 3 a parallel run also failed `hubFiles.test.js` this way; the serial suite passes. |
| 18 | Align `settlements[0].noteSv` in `server/seed/historical/ad800-review.json` with the Rome note the package ships. The builder reads the authored text, so players see the new note; the review file still holds the old one. | Claude owns the edit (RESEARCH-STATUS.md, Rome ruling). It changes a hashed input, so it waits for the next Charlemagne rebuild. Found in the Phase 3 Task 3 review. |
| 19 | Show each dossier court's coverage lines on the start card. They reach the character origin and the opening log today, not the card. | Phase 3 Task 3 review. |
| 20 | Regenerate `server/fixtures/charlemagne-800-1.1.0.patch.json` and `john-1200-1.0.0.patch.json` with `scripts/write-release-patch.mjs` after any rebuild of those packages; their sha guard fails the old-save tests until then. | Standing maintenance step since Phase 3. |
| 21 | Ask before a shipped-start upgrade or a built-in refresh replaces an installed copy the player edited. `shippedStartNeedsUpgrade` replaces an edited Charlemagne 1.1.0 copy, and the `default` refresh rewrites `scenario.json` meta, play count included. | Predates Phase 3; Phase 3 releases are the first to trigger it for players. Found in the Phase 3 final review. |

## Historical events at turn end

The owner requested deep research into notable events for each year from approximately 3300 BC through AD 1530, and a turn-ending experience like Total War: alongside dynamically generated events, show a popup describing which real historical event or events occurred in the campaign's current year.

### Research deliverable

- Cover all 4,830 calendar years from 3300 BC through AD 1530, the start range since 7 November 2026, with no year zero, in an explicit coverage index.
- Research worldwide political changes, wars, migrations, religious and cultural developments, discoveries, technology and major natural events. Select events for historical significance and record the selection rationale.
- Store each event's stable ID, Swedish title and summary, year or date range, geography, category, importance and source references. Preserve the original dating, calendar convention and uncertainty.
- Prefer primary evidence and institutional or scholarly sources. Record source titles, URLs and precise locators; check competing chronologies rather than choosing an exact year without evidence.
- Distinguish exact-year events from approximate dates, ranges and disputed dates. Do not spread one approximate event across several years as though each entry were independently attested.
- Track researched years with no securely dated event, years with incomplete coverage and source conflicts. A gap in the dataset does not mean that nothing happened in that year. Do not invent an event to fill a row.
- Review the source material and dating before marking a period complete. Publish the data, provenance and remaining coverage gaps with each researched milestone.

### Game deliverable

- At turn completion, look up the current campaign year and show one or more matching historical events, in addition to the game's dynamic events.
- Identify the material as real-world historical reference, for example `I verklighetens historia`, so players can distinguish it from their campaign's alternate outcomes.
- Show the event's date certainty and provide source details. Do not present an archaeological date range as a fact tied to one precise year.
- Use the researched dataset for lookup; no extra model call or live research request is needed at turn end. Missing evidence must not cause the model to invent a historical popup.
- Preserve deterministic simulation, saves and stored replay. Historical reference cards must not force the campaign to repeat a real death, war or succession that contradicts its state.
- Define notification deduplication, reload/replay behavior and multi-year turns in the written implementation plan. Test the BC/AD boundary, approximate dates, empty coverage, multiple events in a year and repeated loading of a completed turn.
- Provide a browsable history record so dismissed reference cards remain accessible. Built: the chronicle segment `I verklighetens historia`, reached from the popup link or the chronicle tab.

### Acceptance evidence

The research needs an audited coverage report for the requested years. The feature needs engine/data tests and a browser run that ends a turn, displays the current year's sourced historical popup beside dynamic events, reloads the campaign and replays without another model call or duplicate notification.

## Related documents

- `docs/superpowers/specs/2026-11-05-historical-world-direction.md`: current setting and start-date authority.
- `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`: character and AI systems, subject to the newer setting direction.
- `docs/development/CONTINUE-HERE.md`: measured progress and the next implementation step.

# Historical campaign foundation: browser play script

Status: **Task 6 and final documentation review accepted with the limits below**. [PR #13](https://github.com/sp1e/Attainder/pull/13) tracks merge state; its current head must pass CI before merge. Merge does not deploy the game. Record the build commit, browser, adapter, viewport, theme, fixture and actual result for each run. A build or automated test does not establish browser or gameplay acceptance. Use disposable data and public-source synthetic saves; preserve untouched inputs and keep saves, screenshots, request extracts and provider sessions out of published documentation.

## Observations to date

- On `a03bb30`, the server Egypt realm campaign started at `-3000-01-01`. The ruler and household were labeled generated. A public tax change and a household rest survived separate reloads; treasury moved from 240 to 230 and action points from 4 to 2. A Codex turn reached `-2999-01-01`. After a reload exposed the intervention control, stopping at the first turn event retained the earlier commands and closed at `-3000-02-18`. The retained event and same-date character state matched an independent replay check. This run preceded the later language and intervention fixes; it is not a post-fix full-row pass.
- On `a03bb30`, the web John realm campaign started at `1200-12-31`, accepted a public tax change and household rest across reloads, and completed a Codex turn at `1201-12-31`. One rejected model attempt preceded the successful attempt. On `b5fa697`, a later export included four snapshots; a paired import and UI intervention retained the two earlier commands and the first turn event, ending at `1201-02-18`. The same-session daily and bridge counts stayed at three across that replay. An independent same-date character-state check matched the saved result; it did not establish complete world equality.
- On `b5fa697`, server John and web Egypt realm campaigns each completed a real Codex turn, from `1200-12-31` to `1201-12-31` and from `-3000-01-01` to `-2999-01-01` respectively. Visible prompts requested Swedish and supplied the corresponding historical date, polity and coverage; their map-ownership blocks listed six historical polities for John and Egypt alone for Egypt. Narration appeared in Swedish. `Intervene here` was available immediately after each turn, without reloading.
- The server John and web Egypt interventions retained the first turn event and closed on `1201-02-18` and `-3000-02-18` respectively. In each case the two earlier player events and retained event matched the full-turn prefix, as did the independently reconstructed same-date character state and RNG. Complete world equality was not established. The server daily count stayed at four through replay and reload; the web bridge's same-session before/after records were identical at four. These observations cover the measured intervals and channels.
- On `b5fa697`, server family starts selected the generated nonroyal house and its representative: Senu in Egypt and Robert in John. A household rest changed the family treasury from 110 to 100 and action points from four to three; realm treasury remained 240. The identity and result survived reload. The panel offered no tax control to these representatives. Web Egypt and John family starts also selected Senu and Robert, submitted rest and survived reload; each family treasury moved from 110 to 100, action points from four to three and realm treasury stayed 240. Neither representative had a tax control. These web checks used a requested 390 × 844 viewport with inner width 391. The Egypt start card appeared light while its character panel initially used the separate system-dark setting; the panel light toggle produced a readable view. The John panel was dark.
- At a requested 390 × 844 viewport (inner width 391), the server John realm panel used the light theme. A public balanced-tax choice moved realm treasury from 230 to 220 and action points from two to one; a household rest then moved family treasury from 100 to 90 and action points from one to zero. Each survived a separate reload. Captured states and events support the resource sequence; the viewport and interactions are browser observations. The complete panel matrix is recorded below.
- On both adapters, a restored disposable campaign advanced from `-0001-12-31` to `0001-01-01` and retained the latter date after `Current` reload; each daily request count reached five. An independent server-side check matched the full saved character state to a same-date pure-engine advance and preserved all 24 person identities. The web character panel also showed 1 January AD 1; an independent web character-state export comparison was not performed. This checks the generic calendar boundary, not annual historical-event coverage.
- A web modern-game copy export retained all seven original game-data members, the `2016-01-01` dates and no historical character state. The export added empty optional objects, used a different local scenario ID and contained no snapshots. Embedded region, city and color data matched as parsed JSON; this does not prove raw-byte identity or replay preservation.
- On `b5fa697`, the web Egypt realm panel at narrow width and in dark mode accepted balanced tax and household rest, each followed by reload. Realm treasury moved from 230 to 220, family treasury from 100 to 90 and action points from two to zero. This is interaction evidence for that condition.
- A server Hadara restore and copy retained the original 24-person character system and all other captured world fields except the expected owner-schema migration from version 2 to 4. Restored and copied game data matched each other. A web paired Hadara restore, copy and reload showed Arel aged 54 at `-0300-01-01`. A separate game-only import required its companion before resume and clone; the clone reopened after reload with the same visible identity and date. A full web saved-data comparison remains open.
- Eleven isolated server new-start requests returned HTTP 400 with Swedish refusals for invalid dates or options. Catalogs, activation and 91 saved-file hashes remained unchanged. The null-date case tested an explicit null; an omitted date inherits the scenario date. Asset checks remain automated evidence rather than a live API result.
- On the server, a modern game-only ZIP imported on `b5fa697` with its map unresolved and the active Egypt campaign unchanged. A wrong companion was refused with 44 saved-file hashes unchanged. The matching companion restored as a separate restore-only scenario; the saved game remained at `2016-01-01` with no historical character state. A UI clone retained the captured game data. Parsed companion geometry, cities and colors matched the restored assets; scenario metadata and local IDs differed.
- On `b5fa697`, both adapters imported and cloned a paired modern ZIP whose game lacks `startDate`; the UI showed the saved 2016 date. Captured server restore and copy data retained the absent field. Both adapters also opened detached game-only imports and refused a same-ID companion with empty regions. The server's game catalog and 208 saved-file hashes stayed unchanged after refusal; the web observation is UI evidence, with separate automated no-write coverage. The matching detached companion then activated the 2016 campaign on each adapter, and each clone reopened after reload. The no-start-date clones also reopened after reload on both adapters. Independent server comparisons matched restored and copied game data to their fixtures and matched companion map assets as parsed JSON; the web checks for these variants are UI observations.
- At narrow width, the web Egypt and John character panels and their source notes were observed in both light and dark themes. The selector and provenance checks were recorded separately for both themes and widths.
- Place search showed Memphis at 29.85, 31.25 and Windsor at 51.48, -0.60, matching the authored coordinates at displayed precision. The search flight targets zoom 7; the UI has no numeric zoom readout. Both bookmarks were inspected across the continents, including Oceania, the Pacific date-line area, flat and globe views. Egyptian owned and unresolved regions were selectable, and the unresolved land south of the cropped core showed the unknown-control note. No obvious modern stock-country or city overlay appeared in the inspected views. The three specific Nubian sample points were not individually verified in the UI.

All 16 adapter, bookmark, viewport and theme panel conditions were inspected without an observed readability or overlap blocker. Start-card selectors and provenance were observed in both themes on both adapters at desktop and narrow widths. A shared error dialog was inspected on desktop server and narrow web; commands and reloads were exercised on all four realm combinations and in representative narrow light and dark conditions. On `7b62791`, the flat Antarctic map showed persistent triangular gaps on two basemaps. The Mercator presentation repair passed scoped review and was pushed as `39448ec`; subsequent server and web flat views showed continuous polar land, but a server globe view still showed large triangular gaps. On `2066a55`, the large white globe wedges were no longer visible. A straight Antarctic shading seam and a small blue gap near the pole remain; their cause is uncertain and they are deferred visual minors.

Known map limits: the Antarctic globe retains the seam and small blue gap described above. At the close Windsor view, a polity label became oversized and clipped; this remains a visual minor for final review. Some physical basemaps contain baked-in modern metadata, which may show through translucent fills. The inspected views did not establish a modern-label leak, and they do not prove every basemap and zoom free of one.

The two original model turns exposed English narration despite Swedish campaign selection, and intervention was unavailable until reload. The web export also omitted snapshots, and a game-only ZIP was refused. Fix 2 addressed these findings and passed scoped review. The later opposite-era turns and interventions exercised the language and immediate-control fixes. The John web request also needed a retry after a war-control validation refusal; that observation remains for final review.

## Setup and evidence

1. Record the accepted commit and build identifiers. Start separate, empty server-backed and web/IndexedDB libraries, with distinct origins and data stores. Verify the web game and scenario writes remain in IndexedDB and do not create file-backed games in any local model bridge's data directory.
2. Open each library, dismiss analytics if offered, and use the real Codex connection. Record public readiness and model selection; do not capture credentials. Record game IDs, scenario IDs, selected and active IDs after bootstrap. Confirm the relevant request and diagnostic recording is enabled on each isolated origin.
3. For each real turn, record request counters and their scope, date and telemetry record IDs before the turn, after completion, after reload and after the actual stored-prefix replay. Correlate provider attempts with task/attempt IDs, prompt context and engine validation. Record failures and retries separately: one turn may make multiple requests, and HTTP completion alone does not establish model success. If a reset, restart, eviction, missing telemetry or unrelated request makes the interval ambiguous, leave the zero-request result open. Keep only minimal fixture-specific evidence.
4. Source-defined controls below are starting points, not observed results. Confirm labels and availability in the running build. Record each result as observed, failed, blocked or still open, with evidence and any defect reference. A failed or unavailable step stays open. For a defect, reproduce it, add a failing regression, fix and review it, then repeat affected checks.

## Start matrix

Use a separate named campaign for each row and record the viewport and theme. The four realm rows also require the real model turn and map sweep below. The four family rows require the selected family, representative, household action, authority boundary and reload checks. Use a nonroyal family where offered.

| ID | Adapter | Bookmark | Mode | Status |
| --- | --- | --- | --- | --- |
| S-E-R | Server | Egypt, circa 3000 BC | Realm | Start, commands and reload observed; turn/replay on `a03bb30`; map sweep observed |
| S-J-R | Server | John, AD 1200 | Realm | Start, commands, turn and prefix replay observed on `b5fa697`; map sweep observed |
| S-E-F | Server | Egypt, circa 3000 BC | Family | Observed: nonroyal identity, rest and reload on `b5fa697` |
| S-J-F | Server | John, AD 1200 | Family | Observed: nonroyal identity, rest and reload on `b5fa697` |
| W-E-R | Web | Egypt, circa 3000 BC | Realm | Start, commands, turn and prefix replay observed on `b5fa697`; map sweep observed |
| W-J-R | Web | John, AD 1200 | Realm | Start, commands and turn on `a03bb30`; imported prefix replay on `b5fa697`; map sweep observed |
| W-E-F | Web | Egypt, circa 3000 BC | Family | Observed: nonroyal identity, rest and reload on `b5fa697` |
| W-J-F | Web | John, AD 1200 | Family | Observed: nonroyal identity, rest and reload on `b5fa697` |

### Selection and creation

- Before starting, switch Egypt → John → Egypt. Check that the displayed date, polity, context and court preview change together, and expand `Källor och osäkerhet`. Confirm that modern and Hadara campaigns are not offered as new starts. Record uncertainty and source labels as displayed.
- The source defines the search field `Sök rike, härskare eller tid` (`#historical-search`) over a radio group of start rows grouped by region and era (each row carries `data-start-key="<scenarioId>/<polityId>"`), the `Kampanjens identitet` radio group (`Följ riket` / `Följ familjen`), and, in family mode, `Familj` (`#historical-family`). Check the selected labels and identities, including a generated nonroyal household where used. Submit with `Starta som riket` or `Starta som familjen` after the provider is ready.
- Record start and current game dates and character dates, controlled polity, ruler, family, representative, seat and origin labels. Egypt starts at `-3000-01-01`, polity `egypt-early-dynastic`; John starts at `1200-12-31`, polity `johns-realms`. Check that generated people are identified as generated and documented identities are distinguished. Isabella's approximate birth year gives age 12 at this bookmark; do not require an adult-only action from her.

### Map and court

- Compare the approximate seat markers and clicked region/owner with Memphis/Ineb-Hedj `[31.25, 29.85]`, `hbm-bc3000-19`, and Windsor `[-0.6, 51.4833]`, `hbm-ad1200-275`. These markers do not establish an exact early palace or the royal couple's presence on the selected day.
- Pan Africa, Asia, Europe, the Americas and Oceania, recording representative owned and unresolved land. Inspect the antimeridian and both available projections. Zoom beyond 6.5, click owned and unresolved regions, and compare rendered geometry, highlight, label and owner. Check for modern subdivisions, country names, flags and city or tile ghosts, including after reload.
- Check that unknown control is not presented as empty or uninhabited land. Egypt's coverage note must identify the developer-selected, cropped approximate core, uncertain southern control and lack of an attested exact frontier. The unresolved south was selected below the cropped core. The exact Buhen, Semna and Soleb sample coordinates were not individually checked in the UI; those extra point checks remain unperformed.

### Commands and persistence

Submit one enabled household command, and in realm campaigns one enabled public court command. Record actor, target, before/after resources or state, engine outcome and Swedish feedback. Prefer tested rest and taxation paths when available; a refusal does not count as a successful submission. Reload, open the campaign through `Current`, and verify map, court, identity and outcomes. For family mode, also observe whether a public action agrees with the selected actor's authority.

## Real turns and replay

| ID | Adapter / bookmark | Real Codex turn | Reload | Stored-prefix replay |
| --- | --- | --- | --- | --- |
| S-E-R | Server / Egypt | Observed on `a03bb30` | Observed after commands and replay | Observed on `a03bb30` after reload |
| S-J-R | Server / John | Observed on `b5fa697` | Observed | Observed immediately on `b5fa697` |
| W-E-R | Web / Egypt | Observed on `b5fa697` | Observed | Observed immediately on `b5fa697` |
| W-J-R | Web / John | Observed on `a03bb30` | Commands reloaded on `a03bb30` | Observed on `b5fa697` after importing the exported turn |

For each row, advance a real model-driven turn. Inspect the relevant request and validation evidence for the selected historical date, polity, visible court and coverage, and guidance that events after the start can diverge. Confirm the engine resolves proposals, starting facts remain intact, and a particular narrative is not required. Record stored event/patch identifiers and a state fingerprint. John must be able to continue into AD 1201; if the real turn does not cross, use an isolated running-save fixture for the boundary.

Reload and open `Current`; compare date, stored result and request evidence. **Reload establishes persistence only.** To exercise the actual stored-prefix replay, open `Events` after a suitable completed turn, reveal at least one event while leaving at least one unrevealed, then choose `Intervene here` → `Stop here`. This control requires an eligible newest rollback snapshot, more than one journal event, an undo point, no active load/skip and no category filter. Confirm the retained events, resulting state and closing date, and compare request evidence across the replay interval. The retained prefix must reproduce its stored outcome without a new model request. There is no general full-turn replay button; undo and reopening history alone do not establish this result. If no eligible turn is available, leave replay pending and arrange a real isolated turn or separately validated full snapshot fixture.

## Boundary and invalid-ingress checks

| Check | Server | Web |
| --- | --- | --- |
| Saved campaign crosses 1 BC to AD 1 without year zero | Observed and character state independently checked on `b5fa697` | Observed and reloaded on `b5fa697`; full character-state export comparison not performed |
| Running campaign crosses AD 1200 to 1201 | Observed on `b5fa697` | Observed on `a03bb30` |
| Exact BC intervention pair, additional check | Helper tested; UI transaction not exercised | Helper tested; UI transaction not exercised |
| Invalid new-start and asset ingress, UI and direct route/store | Observed: 11 invalid POSTs and representative UI refusal; handler asset checks | Observed: representative UI refusal and handler no-write checks |

The disposable BC/AD crossing was observed on both adapters. An independent complete character-state comparison was performed on server; the additional web full-state export comparison was not performed and is beyond the specified UI boundary check. The exact `-0300-12-31` and `-0299-01-02` intervention pair is an additional check beyond the foundation acceptance: automated tests cover chronological ordering and truncation, but no UI rollback transaction for that pair was exercised. Actual stored-prefix replay was observed on both adapters at other dates, including the `-3000-02-18` Egypt prefix. A standalone journal is helper input, not a complete UI rollback snapshot.

After explicit bootstrap, snapshot campaign/scenario IDs, selection, activation and relevant stored data. Exercise before `-3300`, after AD 1530 for **new starts**, year zero, malformed date suffix, an explicitly null date, unequal start/current dates and mismatching patch; also invalid polity, family, mode and missing or malformed required assets. Use the finished adapter contracts for direct requests and available UI/import paths. Record actual refusal text and verify no changed campaign, replacement asset or activation. An omitted start date inherits the scenario date. Saved or running campaigns beyond AD 1530 must remain loadable and playable. A displayed error alone does not prove no writes.

## Legacy restoration, resume and copy

| Case | Server | Web |
| --- | --- | --- |
| Modern original default ID collision | Observed: game-only, companion, clone and data comparison | Observed: copy and parsed map data; fixture has no snapshots |
| Modern detached missing companion | Observed: restore, clone and reload; game data and parsed map checked | Observed: restore, clone and reload; UI evidence |
| Modern legacy save without startDate | Observed: paired import, clone and reload; game data checked | Observed: paired import, clone and reload; UI evidence |
| Hadara saved cast and map | Observed: restore, copy, cast and parsed map checked | Observed: game-only and paired restore/copy/reload in UI; full data comparison not performed |
| Wrong or conflicting companion refused | Observed: wrong companion and same-ID empty-map refusal; no-write evidence | Observed: same-ID empty-map refusal in UI; no-write covered by handler tests |
| Paired ZIP import and new export | Observed: paired modern import and copy | Observed: John turn export/import with snapshots and prefix replay on `b5fa697` |

Use disposable modern and Hadara game/companion pairs, retaining untouched copies. Import a game-only ZIP via `Games` → `Import game`; it remains unverified and unresolved until a validated companion is restored. Do not infer a match from a stock or built-in scenario ID. Select `Play` on the imported game, then use the missing-scenario dialog's `Välj scenariofil och spela` for the matching JSON or ZIP companion. Verify restoration and activation only after validation. Exercise paired ZIP import separately.

Resume and clone each relevant restored campaign via its card's `More for <game name>` → `Clone`. Compare original and copied game/character dates, people and state, events, snapshots and available replay outcomes. Check scenario identity before and after: local `scenarioId`, sender identity `importedOriginalScenarioId` where present, `importedScenarioUnbound`, missing status and available edition evidence. Test an incorrect ID and a same-ID conflicting map without changing the target or active campaign. The modern fixture has no saved character system; use Hadara to check existing-person preservation. Check that no historical reseed occurred.

Export via the game's `Export` action and inspect the ZIP and warnings. Available built-in and hub maps are included subject to the size limit; an absent map must be reported. Compare map bytes/hashes where available, while distinguishing locally measured hashes from identity evidence actually present in an old format. Legacy bundles do not necessarily provide a signed map digest. Scenario-file selection accepts JSON or ZIP; game UI import/export uses ZIP.

## Theme and viewport matrix

The table records panel observations. All 16 cells were inspected on the recorded builds; this does not assert that every possible error or action was repeated in each cell.

| Adapter | Bookmark | Desktop light | Desktop dark | Narrow light | Narrow dark |
| --- | --- | --- | --- | --- | --- |
| Server | Egypt realm | Observed | Observed | Observed | Observed |
| Server | John realm | Observed | Observed | Observed | Observed |
| Web | Egypt realm | Observed | Observed | Observed | Observed |
| Web | John realm | Observed | Observed | Observed | Observed |

Desktop was 1280 × 720; narrow was requested at 390 × 844 with an observed inner width of 391. Start-card selectors and provenance were inspected in both themes and widths on each adapter. The shared refusal dialog was inspected on desktop server and narrow web. Public and household submissions followed by reload were observed for each realm adapter/bookmark, plus representative narrow light and dark interactions. No extra pair of submissions or separate error dialog is required in every matrix cell. This matrix does not replace the longer Phase 3 play script.

## Charlemagne start, AD 800

The third start is the default: the card preselects it, and John and Egypt stay offered. The scenario `default` still holds John, so existing John saves stay bound to it. Catalog order sets the default in `HISTORICAL_START_ORDER`.

| ID | Adapter | Start card | Map at Aachen | Household command | Reload | One turn |
| --- | --- | --- | --- | --- | --- | --- |
| S-K-R | Server | Observed 2026-11-07 | Observed 2026-11-07 | Observed 2026-11-07: gift | Observed 2026-11-07 | Observed 2026-11-07: real local Claude, one year |
| W-K-R | Web | Observed 2026-11-07 | Observed 2026-11-07 | Observed 2026-11-07: gift | Observed 2026-11-07 | Observed 2026-11-07: real local Claude, one year |

Web run: `npm run dev:web` with the model status stubbed. The start card preselected `800 e.Kr. · Karls rike (karolingiska riket), 800 e.Kr.` among 3 starts. The court showed Karl aged 57 with the title Kejsare, 13 living people and the heir Karl den yngre. `Överlevnad osäker` showed in person detail. A gift gave `En relation stärks`, and a reload kept the campaign and the gift event. The map showed Aachen, Rome and polities.

Web turn on `efe9f11`: the bridge only answers its own origin, so a loopback host in the test run served the web build and `/api/local-models` from one origin, with the campaign in IndexedDB. One real year turn with local Claude took about 4.5 minutes and gave 11 events, the first dated 10/2 801 e.Kr. After a reload and `Current`, the header read `0801-12-25` and the panel kept the turn. The events name no dead court member. The only later date is `Senast 25/12 802 e.Kr.` on two pending decisions. While the panel stayed open after the turn, the header still read `0800-12-25`, and on that run it showed the polity ID `carolingian-realm` until the reload.

Server map on `efe9f11`: the map shows Aachen, Rom, `Karls rike (karolingiska riket)` and its neighbours with 0 console errors.

Server run: `http://localhost:3000` with an isolated `OH_DATA_DIR` and the real local Claude through `claude-cli`. Start, gift and reload worked. One real year turn took about 5.5 minutes and gave 11 events, the first dated 2/3 801 e.Kr., and the date 25/12 801 e.Kr. survived a reload. The console showed 0 errors. The events name no dead court member and no year after 801. `GET /api/scenarios/<id>/assets/stats` returns 404 for both `charlemagne-800` and `john-1200`, which predates this branch.


- Start card: `Startdatum och scenario` opens on `800 e.Kr. · Karls rike (karolingiska riket), 800 e.Kr.`, and `Rike` shows `Karls rike (karolingiska riket)`. A start records date `0800-12-25` and polity `carolingian-realm`.
- Map: the seat marker is Aachen at `[6.1053, 50.7708]`, an approximate Getty placement. Karl stands in Rome on the bookmark date, and the map keeps the game seat at Aachen.
- Court: Berta, Gisela, Teoderada, Hiltrud and Ruodhaid each carry the tag `Överlevnad osäker` on their person card, and the tag title shows the package note. Karl and his sons carry no such tag.
- Religion: under `Familjer`, `Religiösa samfund`, the Latin Church shows `Företrädare vid hovet` with Rikulf (genererad), and the caption above it names Leo III. A John campaign started on this build shows the same label with its own representative. An older saved campaign shows the label and no caption.
- Turn: the web cell stays open for a run against a local provider.

An upgraded library gains the start once, keeps a selected scenario other than John, because `default` reads as no choice, and keeps a deleted start deleted. Each start has its own marker for this: `historical-bookmarks-charlemagne-800.json` on the server and the key of that name in the web store.

## Kyrkostaten start, AD 800

Run on `018c823c` with Playwright Chromium on 7 November 2026. Server: `node server/server.js` on port 4167 with an isolated `OH_DATA_DIR` and local Claude selected. Web: `vite --mode web` on port 5199 with `/api/local-models/status` stubbed.

| ID | Adapter | Start card | Realm start | Family start | Reload |
| --- | --- | --- | --- | --- | --- |
| S-P | Server | Observed | Observed: Leo III, 50, office `Påve`, Rome; legal heir Sergius (genererad) | Observed: Hovhus 1 (genererat), representative Sergius (genererad), 44 | Not run |
| W-P | Web | Observed | Observed: Leo III, 50, Rome | Observed: Leos hushåll, representative Leo III | Observed: the realm campaign stayed in the library |

The heading reads `HISTORISKA DYNASTIER · 3300 F.KR.–1530 E.KR.`, and the AD 800 start lists Karls rike and Kyrkostaten. The campaigns are named `Kyrkostaten, 800 e.Kr. · Riket` and `Kyrkostaten, 800 e.Kr. · Familjen`. The server console showed 0 errors. The web console showed one 500 from `/api/local-models/generate`, because the vite server has no model bridge. No model turn was run. The upgrade of an installed Charlemagne 1.0.0 start has automated coverage only.

## Searchable picker

Run on `8176bf1b` and `9d8605de` with Playwright Chromium on 7 November 2026, with the same server and web setup as the Kyrkostaten run.

| ID | Adapter | Grouping | Search `leo` | Realm start | Save |
| --- | --- | --- | --- | --- | --- |
| P-S | Server | Observed | Observed: Kyrkostaten only | Observed: Leo III, 50, Rome | Observed: `playablePolityIds` and `courtSeeds` hold `papal-states` only |
| P-W | Web | Observed | Observed: Kyrkostaten only | Observed: Leo III, 50, Rome | Not inspected |

The card shows `EUROPA` with `Tidig medeltid` (Karls rike, Kyrkostaten) and `Högmedeltid` (Johns riken), then `MELLANÖSTERN OCH NORDAFRIKA` with `Bronsålder` (Egypten). On the web, the first boot imported `generated/historical/index.js`, `egypt-3000bc.js` and `charlemagne-800.js` to install the shipped starts. Both consoles showed 0 errors and the existing hillshade warning.

On `8176bf1b` the web session summary read `Riket / papal-states` after a start within 15 seconds of the menu, because the polity-name cache still held John's world. On `9d8605de` the same flow read `Riket / Kyrkostaten` 3 seconds after the click. No model turn was run.

## Reviewed courts, Phase 3

Run on `7ccef350` with Playwright Chromium on 7 November 2026, with the same server and web setup as the Kyrkostaten run and a fresh `OH_DATA_DIR`.

| ID | Adapter | Card | Tangriket realm start | Frankrike start | Save |
| --- | --- | --- | --- | --- | --- |
| R-S | Server | Observed: 15 polities | Observed: Dezong, 58, header `Riket / Tangriket / 0800-12-25` | Observed in family mode: Hovhus 1 (genererat), representative Hugues de Montfort (genererad), 43 | Observed: `playablePolityIds` and `courtSeeds` hold `tang-empire` only; `contextSv` and `startingTimelineText` open with the Tang text |
| R-W | Web | Observed: 15 polities | Observed: Dezong, 58, `Riket / Tangriket / 0800-12-25` | Observed in realm mode: Filip II August, 35, `Riket / Frankrike / 1200-12-31` | Not inspected |

The card groups the polities under `EUROPA`, `MELLANÖSTERN OCH NORDAFRIKA`, `ÖSTASIEN` and `SYDOSTASIEN`. Choosing Tangriket shows `Kejsar Dezong regerar över Tangriket sedan 779.` and the rest of the Tang text; choosing Frankrike shows `Filip II regerar sedan 1180 och har sitt hov i Paris.` and the rest of the French text. The web library came from the Phase 2 run on the same origin, so the web run also exercised the upgrade from Charlemagne 1.1.0 and John revision 1. Both consoles showed 0 errors and the existing hillshade warning. No model turn was run.

## Closure

The controller accepted Task 6 with the documented limits, and final documentation review approved publication subject to current-head CI. CI passed at `2066a55`; the PR tracks the current head and merge state. Preserve source attribution and licenses, and exclude private material from publication. The annual 3300 BC–AD 1530 historical-reference research and turn-end popup remain a separate pending milestone.

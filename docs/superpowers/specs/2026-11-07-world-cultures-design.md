# World cultures design

Date: 7 November 2026. Authority: the owner's decisions of 7 November, recorded in `2026-11-05-historical-world-direction.md` under "Owner decisions on 7 November 2026". Evidence: the engine map and culture inventory in the private workspace repository (`reports/world-cultures-inventory/`, 939 cultures across 8 of 9 regions; North Africa and the Middle East still missing, East and South Asia not yet source-checked).

## Binding requirements

1. Every culture of the world inside the supported period must become playable, including Maya, Aztec, Inca, China and the Middle East.
2. New campaigns may start from 3300 BC through AD 1530, inclusive, with no year zero.
3. The research rules stay: polity, territory and seat need sources; a ruler without a source at the start date is a generated person with the Swedish generated label.
4. Existing campaigns keep loading unchanged. Egypt, John and Charlemagne keep their released bytes unless a ruling below says otherwise.

## What the engine supports today

The engine map measured these limits on the current packages:

- A package may list several playable polities, and the runtime starts any of them that has a full court and seat. A probe that cloned Charles's court onto the Papal States started without errors.
- The authoring pipeline writes exactly one playable polity, one seat and one court (`authored-scenarios.mjs` `authoredScenario`, builder lines that read `playablePolityIds[0]` and `pkg.seatId`).
- The validator checks every listed playable polity, so a polity listed without a court breaks the whole package.
- The validator only checks that `originLabelSv` is text. A generated ruler labelled "Kung" passes.
- `scenarioSeed.js` refuses some courts at start time (extra ruler offices, unknown office ids, more than one spouse, `person-<n>` ids) that the validator accepts. The start card then offers a start that fails on click.
- Courts need one ruler, one spouse at most, primogeniture or merit succession, and land. Maya city-states, steppe confederations and stateless peoples need engine work before they can start.
- The start card uses two flat selects. Every package is fetched and validated up front, and the web build inlines all packages in one chunk. These costs grow linearly with each start.

## Delivery phases

"Every culture playable" is a content programme with no fixed end. The code work is bounded. The phases below deliver the code first and then add content in batches, each batch shipping as its own PR.

| Phase | Delivers | New playable polities |
|---|---|---|
| 1. Multi-polity pipeline | N polities, seats and courts per package; generated-label rule; start-time refusals moved into the validator; range to 1530; catalog-driven tests; shipped-start upgrades | Papal States at AD 800 |
| 2. Picker and loading | Searchable picker grouped by region; catalog summary instead of per-start fetches; per-start web files; saves that keep only the chosen court; relevance-ranked prompt polity list | none |
| 3. Reviewed polities | Courts for polities whose shapes are already reviewed: Tang, Abbasid, Byzantine, Silla, Córdoba, Aghlabid, Asturias, Benevento (AD 800); Western Xia, Khmer, Almohad, Capetian France, Chimú (AD 1200) | about 13 |
| 4. AD 1500 start | New package from `world_1500`: Aztec, Inca, Ming, Ottoman and others with reviewed shapes | 4 or more |
| 5. Engine depth | Polity kinds, rule without a sole ruler, more succession laws, several spouses, culture-based name pools, authored geometry input | Maya city-states, a steppe confederation |
| 6. Coverage programme | More starts per era and region, driven by the inventory; a published coverage table per start | ongoing |

## Phase 1 design

### Authored packages with several polities

`AUTHORED_PACKAGES[contentId]` keeps its current fields for the primary polity and gains an optional `extraPlayables` list. Each entry carries its own polity id, seat, court spec and optional succession law. `authoredScenario` emits the primary polity first, then each extra polity, its seat settlement and its court. The order of `playablePolityIds` is primary first, then the authored order.

The builder stops reading `playablePolityIds[0]` and `pkg.seatId` as the only polity and seat:

- `polityMappings` maps every playable polity to its reviewed feature. The primary polity keeps `pkg.coreIndex`; an extra playable names its feature index.
- `citiesFor` marks every playable polity's seat as `seat: true`.
- The bundle name and `game.country` keep the primary polity, so the default start is unchanged.

### Charlemagne provenance freeze

Ruling: freeze the current Charlemagne generator, source-file and authored-input hashes into `released-provenance.json` before touching the builder, and give the package contentVersion `1.1.0` when the Papal States court lands. Charlemagne has no frozen provenance today, so any builder edit changes its manifest. If wrong, the Charlemagne manifest records a stale generator hash; rebuilding with live hashes fixes it.

### Papal States as the proof polity

Ruling: Phase 1 makes the Papal States playable at AD 800 with Leo III as a documented ruler. The review file `ad800-review.json` already holds the church record for Leo III (`ce-leo3`, `osborne-rome`, `adelson-baker`, `rfa-800-rome`, `rfa-801-coronation`, `rfa-801-aftermath`, `ce-papal-states`), the Rome settlement and the reviewed Papal States shape. No new research is needed. If wrong, the extra playable entry can be removed and the package rebuilt.

- Ruler: Leo III, documented, office title "Påve". Birth date is a generated game value; the election date 26 December 795 sits in the identity claim.
- Succession: merit, the engine's closest analogue to election. Ruling: courts may set `successionLaw` to `primogeniture` or `merit`; the validator refuses other values. If wrong, a later phase adds an elective law.
- Household: generated courtiers on the existing pattern. No spouse. The religion is the Latin church with Leo III as leader.
- Seat: Rome, already sourced by the Getty record and the review evidence.

### Validator rules

`validateHistoricalCourt` gains three rules:

1. A person with `identityOrigin: 'generated'` must have `originLabelSv === 'Genererad person'`. A documented person's label must start with `Dokumenterad person`.
2. Every refusal in `validateEngineSeed` (`scenarioSeed.js`) runs in the validator too: safe ids for every entity kind, family existence, no `person-<n>` ids, non-empty names, at most one spouse, valid sex values, valid mechanics, no parent cycles, and office ids limited to the engine's council roles. The start-time check stays as defence in depth.
3. `successionLaw`, when present, is `primogeniture` or `merit`.

Ruling: the validator imports the engine's archetype, trait and skill tables from `server/characters/content.js`. Duplicating them would let the two lists drift. If wrong, the validator gains a dependency on the character content module, which a later split can invert.

### Start range

`HISTORICAL_START_RANGE.maxYear` becomes 1530 and the Swedish refusal names 1530. The start card heading follows. `coverage.json` gains a range for 1201–1530 with status `unresearched`. `RESEARCH_END_YEAR` in `HistoricalRecordView.jsx` stays at 1200 until event research reaches further. Tests that used 1201 as the first refused year switch to 1531.

### Shipped-start upgrades

An installed shipped start does not update today; its marker blocks reinstallation. Ruling: each `HISTORICAL_BOOKMARKS` entry carries the shipped `contentVersion`. On library read, a shipped start whose stored bundle has an older `historicalScenario.contentVersion` is replaced in place. A start the player deleted stays deleted, and campaigns keep their own copies. If wrong, players keep the old package until they reinstall it.

### Catalog-driven tests

The test files that list the three start ids by hand iterate over `HISTORICAL_BOOKMARKS` and the default scenario instead. Each multi-polity package gets a test that every listed polity validates and starts in realm and family mode.

## Later-phase notes

- Phase 2 replaces the selects with a searchable list grouped by region and era. Each start ships a small summary record in the catalog; the full package loads only when the player picks it.
- Phase 3 courts use generated rulers unless the review file already documents the ruler. Each polity needs a Getty seat record and a religion claim.
- Phase 4 pins `world_1500` in `SOURCE_HASHES`. Pinning changes no released package once Charlemagne is frozen.
- Phase 5 adds `polity.kind` (`state`, `city-state`, `confederation`, `chiefdom`, `non-state`) and the engine rules each kind needs. Maya and stateless starts wait for it.
- Phase 6 publishes coverage per start: which inventory cultures are playable, which are on the map without a court, and which lack a source.

## Acceptance for Phase 1

- `node scripts/build-historical-scenarios.mjs --check` passes. Egypt and John keep their bytes; Charlemagne's changes are limited to the Papal States additions and its contentVersion.
- The start card at AD 800 lists Karls rike and Kyrkostaten. Both start in realm and family mode on server and web.
- A generated person with any other label fails validation, and so does each start-time refusal.
- A start dated 1530-12-31 passes the range check and 1531-01-01 is refused.
- An installed Charlemagne 1.0.0 start upgrades to 1.1.0 on the next library read; a deleted one stays deleted.
- The full test suite and `npm run build` pass.

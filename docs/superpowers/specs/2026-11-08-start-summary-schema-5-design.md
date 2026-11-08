# Start summary schema 5: court mechanics note and full validation

Date: 8 November 2026. Owner mandate: continue development without pause, decide by rulings. Backlog rows 15 and 19.

## Problem

- **Row 19.** Each dossier court's coverage lines (succession note, engine limits) sit in `court.mechanics.noteSv`. They reach the character origin and the opening log. The start card never shows them, so a player picks a court without reading what the game simplifies there.
- **Row 15.** The start card reads the summary that `historicalStartSummary` builds with structural checks only. A start whose map lacks a playable polity, whose date lies outside the package range, or whose copy passed an older validator appears on the card and fails at Start with the Swedish refusal.

## Rulings

1. **Mechanics note in the summary.** Each summary polity gains `mechanicsNoteSv`: `court.mechanics.noteSv` when it is a string, otherwise null. The validator already requires the note on every court, so every shipped polity carries one. Non-dossier courts carry the generic sentence on resources and succession.
2. **Option and card.** `historicalStartOptionFromSummary` and `historicalStartOption` map the field to `polity.mechanicsNote` (null when absent). The card's "Källor och osäkerhet" shows the chosen polity's note after the package coverage note and the coverage line. A null note adds no paragraph.
3. **Full validation on rebuild.** Both stores run `validatePlayableScenario` when they build a summary that passed the structural checks. A failure gives the existing invalid shape `{ schema, sourceStamp, invalid: true, date, contentId }`, so the library bar still lists the start and the card leaves it off. A cached summary is not validated again until its stamp changes.
4. **Inputs.** The check uses the scenario's own `game.json`, `world.json`, regions and cities, the same inputs Start uses. Desktop reads `regionsGeojson` and `citiesGeojson` from the scenario's upload folder, only on a cache miss. The web store reads the record's own `geojson`. A web record without regions of its own whose world bears a `builtInMap` stamp keeps the structural result: the projection is synchronous and the bundled map is fetched. The web default (John 1200, stamp `historical-john-1200-v1`) is such a record: its regions ship as a separate asset of the web build. `build-historical-scenarios --check` validates that package, and every edit of it runs `validatePlayableScenario` before the write. Cost if wrong: a stamped web copy written under an older validator shows and fails at Start, as today.
5. **No meta in the check.** The check passes no meta. `historicalStartFromSummary` already leaves restore-only copies off by reading the current meta on every catalog build, and a cached summary keyed on the world and game stamp must not record a meta flag.
6. **Polity.** `validatePlayableScenario` checks every playable court and the default polity (`game.country`). Start with another listed polity adds only the check that the polity is playable, which the summary's polity list already holds.
7. **Schema.** `HISTORICAL_SUMMARY_SCHEMA` becomes 5. A summary of schema 4 is rebuilt on both stores.
8. **Placement.** A new module `server/historicalSummaryCheck.js` exports `checkedHistoricalStartSummary({ meta, data, sourceStamp, loadMap })`. `loadMap()` gives `{ regions, cities }` and runs only for a start that passed the structural checks, so a scenario that is not historical never reads or parses its map (review finding: Modern Day maps run to about 55 MB). It keeps `historicalStartSummary.js` free of the character system, which the coverage and inventory scripts import.
9. **Desktop stamp.** The desktop summary stamp adds the size and modification time of `regions.geojson` and `cities.geojson`, so a replaced map file rebuilds the summary. A stat costs no parse.
10. No package bytes change. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.

## Tests

- Summary: each polity of the AD 1500 package carries its court's `mechanics.noteSv`; a court without a string note gives null.
- Option from summary and option from package both carry `mechanicsNote`.
- Desktop store: a schema 4 summary is rebuilt with `mechanicsNoteSv`; a start whose regions file lacks a playable polity's feature reads `invalid: true`, and the other starts stay.
- Web store: the same two cases.
- Card: "Källor och osäkerhet" shows the chosen polity's note and changes with the polity.

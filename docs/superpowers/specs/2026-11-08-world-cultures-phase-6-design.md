# World cultures, Phase 6: coverage per start

Status: approved under the owner's standing mandate (2026-11-04, renewed 2026-11-08: "forts dev UTAN paus, du har mitt fulla mandat att merga etc"). Parent design: `docs/superpowers/specs/2026-11-07-world-cultures-design.md`, phase table row 6 and the later-phase note "Phase 6 publishes coverage per start: which inventory cultures are playable, which are on the map without a court, and which lack a source."

## Intent

The owner wants every culture between 3300 BC and AD 1530 to become playable. Nobody can see today how far the game is from that goal. Four shipped packages hold 17 playable polities, 2 map-only polities and about 920 map features without a reviewed owner, and the culture inventory of 1,011 rows sits in Codex's private workspace with no link to the packages.

Phase 6 makes the distance visible in two places:

1. A generated, committed report per start, `docs/coverage/start-coverage.md`, that a developer, Codex or the owner reads to choose the next start or court.
2. One line per start on the start card, so a player sees what the start covers before choosing it.

The report also reads a public inventory derivative that Codex publishes. Until Codex publishes it, the report says so and counts only what the packages hold.

## Goals

- **G1. Package coverage per start,** computed from the built `scenario.json` and the court dossiers: playable polities, map-only polities with the dossier's blocked reason, review features by boundary decision and classification, sources in the package, and the per-continent `coverage[]` rows.
- **G2. A public inventory contract** that Codex fills: the file `server/seed/historical/coverage/inventory.json` with schema `attainder-public-inventory-v1` (section "Inventory contract"). Claude's code validates it and computes each row's shipped status against the packages.
- **G3. A generated report** with a `--check` mode that the test suite runs, so CI fails when the committed report drifts from the packages, the dossiers or the inventory file.
- **G4. Start card line.** The summary schema rises from 3 to 4 and carries `mapCoverage`. The card's `Källor och osäkerhet` block shows the counts in Swedish.
- **G5. A request to Codex** in `docs/development/CODEX-HANDOVER.md` for the derivative, with the contract.

## Non-goals

- No new start, no new playable polity, no package rebuild. Package bytes do not change.
- No percentage. C4 (Codex, private) states that the coverage unit, the historical denominator and the nested-entity rules are not defined. The report gives raw counts until Codex defines them.
- No change to Codex-owned files: `courts/`, `*-review.json`, `name-pools/`, `events/`, `sources/`, `docs/research/`, `RESEARCH-STATUS.md`, the private workspace. Claude reads the dossiers; it never writes them.
- No reading of the private workspace by code or tests. CI cannot reach it, and AGENTS.md forbids publishing private reports.

## Anti-goals

- The report must never claim a culture is covered when no package or inventory row says so. A row with an unknown polity id is a validation error, not a guess.
- The card must not show English research text. Dossier blocked reasons stay in the English developer report.
- Nothing private enters the repository: no inventory row copied by hand, no private commit hash, no machine path.

## Constraints

- Packages: `egypt-3000bc`, `charlemagne-800`, `john-1200`, `world-1500`. John is no bookmark (`server/historicalStarts.js:11`); enumerate `HISTORICAL_BOOKMARKS` plus `john-1200`, as `scripts/check-polity-regions.mjs:12` does. Ruling: export that list once as `SHIPPED_HISTORICAL_PACKAGES` from `server/historicalStarts.js` and use it in both scripts.
- Dossiers: `server/seed/historical/courts/ad800-courts.json`, `ad1200-courts.json`, `ad1500-courts.json`. The files carry no package id, so the coverage code holds a constant map to `charlemagne-800`, `john-1200`, `world-1500`. Egypt has none. A dossier polity's id field is `polityId`.
- Summary schema 4 is rebuilt by both library stores through the existing schema check (`server/libraryStore.js:1922`, `src/runtime/web/libraryStore.js:84`); no migration is needed.
- `rulesVersion` and `contentVersion` stay as they are; no `random(state)` call is added.
- Functions stay under about 50 lines, files under about 800. Repository documents in English, player text in Swedish with å, ä and ö.
- The report is LF-normalised and compared byte for byte, as `scripts/check-historical-events.mjs` does.

## Package coverage (G1)

For each package, from `data.world.historicalScenario` (`h`):

| Field | Source |
|---|---|
| contentId, contentVersion, date, eraLabelSv | `h.contentId`, `h.contentVersion`, `data.game.gameDate`, `h.eraLabelSv` |
| playable | `h.playablePolityIds`, each with `nameSv`, `kind` (absent = `state`), region from `polity-regions.json`, seat (`nameSv` of the first `h.settlements[]` entry whose `polityId` matches, `null` when none), count of the polity's `sourceIds` |
| map-only | every `h.polities[]` record whose id is not in `h.playablePolityIds`, with `nameSv`, `kind`, and the dossier entry's `status` and `blockedReason` when the package's dossier has the id |
| review features | `h.regionReview[]`: total, counts by `boundaryDecision`, counts by `classification` |
| sources | `Object.keys(h.sources).length` |
| areas | `h.coverage[]`: `area`, `status` |

Current values, to pin in tests: playable 1 / 10 / 4 / 2 (Egypt, 800, 1200, 1500); map-only 0 / 0 / 2 / 0, the two being `western-xia` and `chimu`; `withheld-control` 137 / 214 / 280 / 289; sources 57 / 112 / 68 / 32.

## Inventory contract (G2)

Codex owns `server/seed/historical/coverage/inventory.json`. Claude never writes it; tests use fixtures.

```json
{
  "schema": "attainder-public-inventory-v1",
  "preparedOn": "2026-11-09",
  "rows": [
    {
      "id": "europe/frankish-realm",
      "nameSv": "Frankerriket",
      "regionId": "europe",
      "startId": "charlemagne-800",
      "polityId": "carolingian-realm",
      "featureIndex": null,
      "researchStatus": "playable-candidate",
      "sourceUrl": "https://example.org/source"
    }
  ]
}
```

Field rules, each a validation error when broken:

- Top level: `schema` equal to `attainder-public-inventory-v1`, `preparedOn` a valid `YYYY-MM-DD` date (printed in the report), `rows` an array (empty is valid), and the optional `withheldRowCount` (section G5). Nothing else.

- `id`: unique, matches `^[a-z0-9-]+/[a-z0-9-]+$`, stable across inventory edits (Codex's responsibility; the code only checks uniqueness and shape).
- `nameSv`: non-empty string.
- `regionId`: one of `HISTORICAL_REGIONS` ids other than `other` (`server/historicalStartSummary.js:16`). When `polityId` has an entry in `polity-regions.json`, `regionId` must equal it; a polity without one (`western-xia`, `chimu`) is not cross-checked.
- `startId`: a shipped package id or `null`.
- `polityId`: `null`, or the id of a polity record in the `startId` package. Requires a non-null `startId`.
- `featureIndex`: `null`, or a `sourceIndex` present in the `startId` package's `regionReview`. Requires a non-null `startId`.
- `researchStatus`: one of `playable-candidate`, `map-only`, `needs-engine-kind`, `no-source`, `pending` (the C4 vocabulary plus `pending` for unadjudicated rows).
- `sourceUrl`: `null` or an `https://` URL. A `no-source` row must have `null`.
- Unknown top-level keys or row keys are errors, so a private field cannot slip through unnoticed.
- Ruling (final review): each row links to one start. When a culture appears in several shipped starts, `startId` names the start where it has a playable polity; otherwise the earliest start whose map shows it as an owned polity or a review feature; otherwise `null`. `polityId` is filled when that start has a polity record for the culture, else `featureIndex` when a review feature in that start shows it, else both stay `null`. A later schema version may allow several starts per row.

Shipped status, computed by Claude's code, first match wins:

1. `playable`: `polityId` is in the start's `playablePolityIds`.
2. `on-map`: `polityId` is a non-playable polity record, or `featureIndex` names a review feature whose `boundaryDecision` is not `withheld-control`. Ruling: a row pointing at a withheld feature is not on the map as a polity, since the map labels that shape `Okänd historisk kontroll`; it falls through to rule 3.
3. Otherwise the row's `researchStatus`.

A file that fails validation makes the script exit 1 with every error listed. A missing file is valid: the report says the derivative is not published.

## Report (G3)

`scripts/check-start-coverage.mjs`, exporting `checkStartCoverage({ check })` and guarded like `scripts/check-historical-events.mjs`. Without `--check` it writes `docs/coverage/start-coverage.md`; with `--check` it compares and throws on drift. A test in the server suite calls `checkStartCoverage({ check: true })`, so `npm test` and CI catch drift.

Report layout (English, generated header "Generated by scripts/check-start-coverage.mjs. Do not edit by hand."):

1. Summary table: one row per package in `SHIPPED_HISTORICAL_PACKAGES` order: start, date, contentVersion, playable, map-only, review features, withheld-control, sources.
2. One section per start: playable table (id, Swedish name, kind, region, seat, sources), map-only table (id, Swedish name, kind, dossier status, blocked reason), review-feature counts by boundary decision and by classification, continent areas.
3. Inventory: if the derivative is absent, one sentence naming the file and the request in `CODEX-HANDOVER.md`. If present, a table of shipped status by start (columns `playable`, `on-map`, `playable-candidate`, `map-only`, `needs-engine-kind`, `no-source`, `pending`, rows per start plus `no start`) and a table of the same statuses by region.

Counts only, no percentages. Rows within tables sort by id, so the output is stable.

Ruling: whoever changes an input regenerates the report in the same commit. Codex adding or editing `inventory.json` runs `node scripts/check-start-coverage.mjs` and commits the regenerated report with it, as Codex already does for `docs/research/historical-events-coverage.md`. The report is generated output; running the script is not editing a Claude file.

## Start card (G4)

`HISTORICAL_SUMMARY_SCHEMA` becomes 4 (comment: "4: each summary carries mapCoverage"). `historicalStartSummary` adds:

```js
mapCoverage: { mapOnly: [{ id, nameSv }], unownedFeatureCount }
```

`mapOnly` follows the package's polity order; `unownedFeatureCount` counts `regionReview` entries with `boundaryDecision === "withheld-control"`. A missing `regionReview` gives 0. Both `historicalStartOption` and `historicalStartOptionFromSummary` expose it as `option.mapCoverage` with the same shape.

The `Källor och osäkerhet` block of `src/Game/DynastyStartCard.jsx:70` gains one paragraph after the coverage note:

- `Spelbara riken i starten: 4. På kartan utan spelbart hov: Västra Xia, Chimú. Kartområden utan granskad ägare: 280.`
- With no map-only polity the middle sentence is left out: `Spelbara riken i starten: 10. Kartområden utan granskad ägare: 214.`
- With `unownedFeatureCount` 0 the last sentence is left out.
- The count of playable polities is `option.polities.length`.

Ruling: the card counts what the package holds and nothing from the inventory. The inventory derivative is a development artifact and may change between releases without a package bump; a player-visible number from it would change the card without a content version.

## Request to Codex (G5)

Add a row to the requests table in `docs/development/CODEX-HANDOVER.md` (the table under "Requests from Claude"): file `server/seed/historical/coverage/inventory.json` (new), request: publish the privacy-cleared derivative, run `node scripts/check-start-coverage.mjs` and commit the regenerated `docs/coverage/start-coverage.md` in the same PR, of the 1,011-row inventory in schema `attainder-public-inventory-v1` as this spec defines it, one row per retained inventory culture, the 400 `supported:false` rows included with `researchStatus: "no-source"` if their names may be published, otherwise left out and counted in a `withheldRowCount` field. Ruling: `withheldRowCount` (non-negative integer, optional) is the one extra top-level key the validator accepts, so the report can state how many rows are not shown.

## Acceptance

- `node scripts/check-start-coverage.mjs --check` exits 0 on the committed report, and the four existing `--check` scripts still exit 0 with unchanged package bytes.
- A fixture inventory with one row of each shipped status validates; each field rule above has a failing fixture with its error.
- The test pins the current values listed under "Package coverage".
- The John card shows `På kartan utan spelbart hov: Västra Xia, Chimú.`; the Charlemagne card shows no such sentence; both show the unowned-feature count. Checked on server (4167) and web (5199).
- A cached schema-3 summary is rebuilt on the next library read on both stores.
- Full serial suite and `npm run build` pass.

## Left to the builder

- Module split between computation and rendering, as long as both stay testable without the CLI.
- Markdown table formatting details.
- Where the card test lives, following the existing `DynastyStartCard.test.js` pattern.

# World cultures Phase 2 design: picker and loading

Date: 7 November 2026. Parent design: `2026-11-07-world-cultures-design.md` (Phase 2 row and "Later-phase notes"). The owner asked Claude to continue development without pausing and to decide open questions itself, so every choice below marked "Claude's call" is a ruling, not an owner decision. Evidence: the code map in the SDD workspace (`.superpowers/sdd/phase-2-code-map.md`, git-ignored), summarised where it matters.

## Intent

Phase 3 adds about 13 playable polities and Phase 4 adds a new AD 1500 package. The start card, the web build and the saves were built for three starts. This phase removes the costs that grow with each start before the content arrives, and gives the player a list they can search once it holds dozens of polities.

## Goals

1. **Searchable picker.** The start card lists every playable polity of every start, grouped by world region and then by era, with a search field.
2. **Start summaries.** The card reads a small summary record per historical start from the library catalog. It no longer downloads and validates every package when it opens, and the Start click no longer reloads every option.
3. **Per-start web files.** The web build emits one module per shipped package, loaded only when that package is installed or upgraded.
4. **Saves keep the chosen court.** A new campaign stores only the chosen polity's court.
5. **Ranked prompt polity list.** The model prompt lists polities by relevance, with a visible note for the ones it leaves out.

## Non-goals

- New playable polities or new packages. Content is Phases 3 and 4.
- Lazy installation of shipped starts. Both stores still install every shipped start at first boot and upgrade older versions, as today. After the first boot a marker check skips them. The backlog gets a row for lazy installation, to revisit when the shipped package count passes ten.
- Shrinking `componentLicenses` (about 1 MB per save). The licence texts carry attribution, and removing them needs its own design.
- Changes to released package bytes. Egypt 1.0.0, John 1.0.0 and Charlemagne 1.1.0 keep their bytes, and `build-historical-scenarios.mjs` is not edited, so its frozen generator hash stays valid.

## Anti-goals

- A picker that offers a start which then fails on click. Every catalog entry must come from a package that passes `validatePlayableScenario`, and `--check` must fail when the catalog and the packages disagree.
- Any change to existing campaigns. Saves made before this phase load and play unchanged.
- Any change to the order of `random(state)` draws, or a read that draws randomness.

## Constraints

- Server (`server/libraryStore.js`) and web (`src/runtime/web/libraryStore.js`) stores change together and keep their shared tests green.
- The generated web output must keep every file under 25 MiB (Cloudflare Pages limit).
- Game text is Swedish with å, ä and ö; repository docs are English.
- Codex owns the research files listed in `CODEX-RESEARCH-BRIEF.md` §2. Region assignments are geography metadata for the picker, owned by Claude, in a new file outside that list.
- Functions stay under about 50 lines; the working copy is CRLF.

## Design

### Regions and eras (Claude's call)

The picker groups by nine world regions, matching the nine regions of the culture inventory. The Swedish labels and their order:

1. Europa
2. Mellanöstern och Nordafrika
3. Afrika söder om Sahara
4. Centralasien
5. Sydasien
6. Östasien
7. Sydostasien
8. Amerika
9. Oceanien

A new file, `server/seed/historical/polity-regions.json`, maps every playable polity id of every shipped package to one region id. Today: `egypt-early-dynastic` → Mellanöstern och Nordafrika; `carolingian-realm`, `papal-states`, `johns-realms` → Europa. A polity that spans regions gets the region of its seat.

Eras come from the start date by a fixed rule in code, so nobody authors them:

| Era (Swedish label) | Years |
|---|---|
| Bronsålder | 3300 BC – 1201 BC |
| Antiken | 1200 BC – AD 500 |
| Tidig medeltid | AD 501 – 1000 |
| Högmedeltid | AD 1001 – 1300 |
| Senmedeltid | AD 1301 – 1530 |

### Start summaries (Claude's call, after the builder check)

Each store keeps a summary of every historical scenario in that scenario's library meta, next to the existing `historicalStart` field, and returns it in the library catalog. The card reads summaries only. This covers shipped starts, imported starts, copies under another id and edited scenarios on one path, so the card always describes the data `createGame` will use.

```
historicalSummary: { schema: 1, sourceStamp, contentId, contentVersion, name, date, eraLabelSv, eraId,
  contextSv, coverageNoteSv, calendarNoteSv,
  polities: [{ id, nameSv, regionId, ruler: { name, originLabelSv }, families: [{ id, name }] }] }
```

One shared pure function, `historicalStartSummary({ meta, data })`, builds it from the stored scenario. It runs the structural checks the card depends on: every playable polity is listed in `polities`, has a court, its ruler is among the court's people, and the court has at least one family. When a check fails, the summary is `{ schema: 1, sourceStamp, invalid: true }` and the start is left off the card. The full `validatePlayableScenario` still runs when the player clicks Start, as today. Every store path that writes a historical scenario already runs it before writing.

- **Web:** every scenario write goes through `putScenario`, which projects the meta from the record. `projectScenarioMeta` adds `historicalSummary`, so every write refreshes it. `reconcileMeta` also re-projects a meta whose `historicalSummary` is missing or has an older `schema`, which migrates existing installs once.
- **Desktop:** the server has several write paths and the world and game files can change without a meta write. The server therefore caches the summary in the scenario meta with a `sourceStamp` built from the size and modification time of the scenario's `world.json` and `game.json`. `buildScenarioCatalogEntry` stats the two files and recomputes the summary only when the stamp differs, the summary is missing, or its `schema` is older, then writes it back without touching `updatedAt`. This covers every write path and migrates existing installs on the first catalog read.

`historicalStart` on the server catalog entry comes from the meta as well, so `buildScenarioCatalogEntry` stops parsing each 1.3 MB `world.json` on every library request.

Region ids come from `server/seed/historical/polity-regions.json`. A polity with no entry gets the region id `other`, shown under the heading "Övriga". A new check, `node scripts/check-polity-regions.mjs --check`, fails when a playable polity of a shipped package has no region or when the file names a polity that no shipped package lists. It is a separate script so the frozen package builder stays untouched.

`HISTORICAL_BOOKMARKS` stays the list of shipped starts to install and upgrade; this phase does not change what gets installed.

### Start card

`loadHistoricalStartOptions` builds options from the library catalog: every scenario with a valid `historicalSummary` that is not `restoreOnly`. It fetches no scenario details or GeoJSON. `startDynastyCampaign` receives the chosen option from the card and no longer calls `loadHistoricalStartOptions` again. `createGame` still validates the chosen start through `prepareHistoricalCampaignStart`, which refuses an invalid start with the existing Swedish message.

The card replaces the two selects with:

- a search field (label "Sök rike, härskare eller tid") that filters on polity name, start name, era label and ruler name, ignoring case and diacritics;
- a list grouped by region heading, then era subheading, ordered by date then polity name; each row reads `<polity> · <eraLabelSv>` with the ruler line under it;
- one selected row at a time, as a radio group with keyboard support; the first row of `HISTORICAL_START_ORDER` stays the default selection;
- an empty-state line "Inga starter matchar sökningen." when the filter hides everything.

Family select, mode, seed and difficulty stay as they are. Claude's call: the list shows every row with no paging; with about 20 rows after Phase 3 the region headings keep it scannable.

### Per-start web files

`scripts/seed-web-defaults.mjs` writes one module per shipped package, `src/runtime/web/generated/historical/<packageId>.js`, and an index module mapping package id to a dynamic `import()` of that file. `shippedStartBundle(id)` in the web store imports only the requested module. The single `historicalBookmarks.js` goes away. `historicalDefaults.test.js` changes its size guard to apply to each file, and checks that the index lists every bookmark.

### Saves keep the chosen court

`prepareHistoricalCampaignStart` narrows the prepared world after it builds the character system: `historicalScenario.playablePolityIds` becomes `[polityId]` and `historicalScenario.courtSeeds` keeps only that polity's court. Both change together, so `validateHistoricalScenario` and `initializeCampaignCharacters` still accept the save. `polities`, `sources`, `regionReview`, `settlements` and the rest stay whole, because `countryList.js` and the map read them. Saves made earlier keep every court and load unchanged.

### Ranked prompt polity list

`buildWorldSummary` in `src/Game/AI/promptContext.js` orders `polityOverrides` by the existing focus ranking (`selectFocusPowers` in `regionFocus.js`: the player, powers in pending actions, belligerents, chat partners, recent events, claimants, then size), with remaining polities in their current order. The first 16 keep their full line. The rest follow as one line of names, "Other polities: …", capped at 40 names, then "+N more" when anything is still left out. With today's packages (1, 10 and 6 polities) the only change is the order.

## Acceptance

- `node scripts/check-polity-regions.mjs --check`, `node scripts/build-historical-scenarios.mjs --check` and `node scripts/check-historical-events.mjs --check` pass; package bytes are unchanged.
- The start card opens without requesting any scenario details or GeoJSON (asserted in a test on the option loader). It lists Europa with Karls rike, Kyrkostaten and Johns riken, and Mellanöstern och Nordafrika with Egypt. Typing "leo" leaves only Kyrkostaten.
- A library holding a pre-Phase-2 install with no summary shows the same starts after one catalog read, on both stores. An edited copy of a start shows its edited date, and a stored start whose court is broken is left off the card.
- Every playable polity still starts in realm and family mode on server and web (`historicalPlayables.test.js`).
- A new Charlemagne campaign's save holds one court; an older save with both courts still loads and plays a year.
- The web build has one generated module per package, each under 25 MiB, and no `historicalBookmarks.js`.
- A prompt for a world with more than 16 polities lists the player first and ends the overflow with the names line and "+N more".
- The full test suite and `npm run build` pass. A Playwright run on server and web picks Kyrkostaten through the search field and starts it.

## Left to the builder

- Component structure of the new list, styling within the existing card styles, and exact keyboard handling (arrow keys within the radio group is enough).
- Where the era rule and diacritic folding live, as long as server and web share one implementation.
- How the web index module is generated, as long as each package is its own chunk in the Vite output.

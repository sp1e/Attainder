# World cultures Phase 3 design: reviewed polities

Date: 7 November 2026. Parent design: `2026-11-07-world-cultures-design.md` (Phase 3 row and "Later-phase notes"). The owner asked Claude to continue without pausing and to decide open questions itself, so every choice marked "Ruling" is Claude's call. Evidence: a read-only code map of the builder, validator and dossiers (git-ignored SDD workspace), summarised where it matters.

## Intent

Codex has published reviewed court dossiers for AD 800 and AD 1200 (`server/seed/historical/courts/ad800-courts.json`, `ad1200-courts.json`). Eleven polities are marked `ready`. This phase turns them into playable courts in the two existing packages, so the start card offers 15 polities instead of 4.

## Goals

1. **AD 800 (Charlemagne 1.2.0):** Tangriket, Abbasidiska kalifatet, Bysantinska riket, Silla, Emiratet Córdoba, Aghlabidiska emiratet, Kungariket Asturien and Furstendömet Benevento become playable beside Karls rike and Kyrkostaten.
2. **AD 1200 (John 1.1.0, scenario `default`):** Khmerriket, Almohaderna and Frankrike become playable beside Johns riken.
3. **Courts from dossiers.** The builder reads the dossier people, kinship, spouses, seat, religion and sources directly. Nobody retypes a dossier.
4. **Start text per polity.** The card, the campaign context and the model prompt describe the chosen polity, not the package's first polity.
5. **The two research corrections Claude owns:** the Rome note and shared AD 800 context from `RESEARCH-STATUS.md` ("Rome and shared AD 800 context"), the Benevento rename in `ad800-review.json`, and the Khmer and Chimú source corrections in `ad1200-review.json`.

## Non-goals

- Western Xia and Chimú. Their dossiers are `blocked`; they stay on the map without a court.
- The AD 1500 package (Phase 4) and culture name pools, elective succession, several spouses, eunuch status and polity kinds (Phase 5).
- Full validation in the start summary (backlog row 15).

## Anti-goals

- Any change to existing campaigns. Charlemagne 1.1.0 and John 1.0.0 saves load, restore and play a year unchanged.
- Any change to Egypt's package bytes.
- A start the card offers that fails on click. Every new polity must start in realm and family mode on server and web.
- Text that states more than the dossier sources. Every documented person, title, seat and religion claim carries the dossier's claim status and source ids.

## Constraints

- Codex owns `courts/`, `name-pools/`, `events/` and `sources/`; Claude does not edit them. Claude owns `authored-scenarios.mjs`, the builder, the review files, `released-provenance.json` and the built packages.
- Released packages change only through a version bump with refreshed provenance. Editing the builder changes the live generator hash, so the Charlemagne and John provenance entries are refreshed in the same change.
- The engine accepts one spouse per person, `primogeniture` or `merit`, offices `ruler/general/chancellor/priest/spymaster`, and generated people labelled `Genererad person` with names ending ` (genererad)`.
- Game text is Swedish with å, ä and ö; repository docs are English. Functions stay under about 50 lines.

## Design

### Dossier court builder

A new module, `server/seed/historical/dossier-courts.mjs`, turns one dossier polity into the same court shape `court()` produces today. It is listed among the builder's authored inputs, so its hash enters the manifests.

- **People:** every dossier person becomes a documented person with the dossier `id`, `nameSv`, `sex`, `birth.gameValue`, `legalParentIds` and `spouseIds`, and the label `Dokumenterad person; spelvärden är genererade`. Ruling on claims, to satisfy `validCourt` (`server/historicalScenarios.js`): `identity` is `sourced` with the dossier identity sources and `roleSv` as its note; `bornAt` takes the dossier birth status, sources and note; `legalParentIds` and `spouseIds` each take the dossier `kinship` entry that names that relation, and fall back to the person's identity sources with status `uncertain` when no entry does; `kinship` merges all entries (every source id, the weakest status, the notes joined); `mechanics` stays `generated`, as in `court()`.
- **Families:** the ruler's family holds the ruler and every person linked to the ruler by parentage, marriage or a dossier `kinship` relation to the ruler, transitively (Louis VIII and Blanche of Castile join Philip II's family; Silla's uncle Kim Eon-seung joins Aejang's, so the engine picks him as regent). A documented person outside that set (Tarasios, Aetios) gets an own household family named `<namn>s hushåll`. Ruling: the dossier does not source those households, so their families carry a generated claim.
- **Ruler:** the dossier `isRuler` person holds office `ruler` with the dossier's `rulerTitleSv` as the office name. The ruler's sex comes from the dossier, so Eirene rules as `Kejsarinna`.
- **Generated courtiers:** three per polity, on the existing pattern (offices general, chancellor, priest; generated houses). Ruling: Claude chooses culture-appropriate names from the period and suffixes them ` (genererad)`; their birth years fall 20–45 years before the bookmark. The names live in `authored-scenarios.mjs` beside each polity's entry.
- **Religion:** the dossier religion record; `leaderPersonId` names the leader when set, otherwise the generated priest leads.
- **Seat:** the dossier seat, with `regionId` `hbm-ad<year>-<feature>` from `sourceFeatureIndexes[0]` and `placement: 'inside'`. The build still checks the point against the polygon.
- **Sources:** the builder imports only the dossier sources that a ready polity cites, into that package's `h.sources`. The dossier source records have no `review` field; the reader writes one from the dossier's `review` block (checker and date). Egypt shares no source object with these packages. Every new seat's Getty record joins the package's `citySourceIds` and its ODC-By `gettyNotice`.
- **Provenance inputs:** `dossier-courts.mjs` and the two `courts/*.json` files join the builder's hashed authored inputs, so a dossier edit changes the manifest.
- **Polity coverage text:** each new polity's coverage line holds the dossier's own Swedish notes (`successionNoteSv`, `engineLimitNoteSv`, `engineRepresentationNoteSv` where present). Ruling: for each `engineLimits` id, one fixed Swedish sentence from a table in `dossier-courts.mjs` says what the game simplifies (for example `regency`: a grown relative governs until the ruler comes of age). These sentences describe game rules, not history, so they need no source.

Charlemagne's Karls rike and Kyrkostaten keep their hand-authored courts. The new builder covers new polities only.

### Succession laws (Ruling)

Eight ready dossiers say `none-fits`. The engine has two laws. Claude rules per polity:

| Polity | Law | Reason |
|---|---|---|
| Tangriket, Silla, Frankrike | primogeniture | The dossier gives primogeniture. |
| Emiratet Córdoba, Aghlabidiska emiratet | primogeniture | The court holds the ruler's documented son, who succeeded in history. |
| Abbasidiska kalifatet | merit | Primogeniture would make al-Ma'mun heir; Harun designated al-Amin, so neither law fits and merit keeps the choice open. |
| Bysantinska riket, Kungariket Asturien, Furstendömet Benevento, Khmerriket, Almohaderna | merit | No documented heir in the court, or the dossier lists elective rule. Merit lets the realm continue through a courtier. |

If a ruling is wrong, the cost is a different heir in play; the polity's coverage text names the historical practice.

### Start text per polity

Each playable polity carries its own `contextSv` and `contextSourceIds` in `courtSeeds[polityId]`: the dossier text for new polities. Ruling: Claude splits the reviewed shared AD 800 text in `RESEARCH-STATUS.md` into one text for Karls rike (coronation, winter in Rome, Aachen as seat, Liutgard's death, no empress at court) and one for Kyrkostaten (coronation, Rome as seat, Leo III's election in 795), reusing its sentences and sources; Johns riken keeps John's current text. The package `contextSv` and coverage prefix become neutral statements of the bookmark day and the playable polities, with the count and names taken from the package so they cannot drift.

- `historicalStartSummary` adds `contextSv` per polity; `HISTORICAL_SUMMARY_SCHEMA` becomes 2, so both stores rebuild every summary once.
- The card shows the chosen polity's text and falls back to the package text.
- `narrowToChosenCourt` sets the campaign's `contextSv` and `startingTimelineText` from the chosen polity, so the prompt and the campaign record describe the polity played.
- The validator accepts an optional per-polity `contextSv` of at most 600 characters whose source ids exist in `h.sources`.

### Regions

`polity-regions.json` gains: Tangriket and Silla → `east-asia`; Abbasidiska kalifatet, Aghlabidiska emiratet and Almohaderna → `mena`; Emiratet Córdoba, Kungariket Asturien, Furstendömet Benevento, Bysantinska riket and Frankrike → `europe`; Khmerriket → `southeast-asia`. A polity takes the region of its seat.

### Releases

- **Charlemagne 1.2.0:** ten playable polities, primary first, then Kyrkostaten, then the dossier order. `HISTORICAL_BOOKMARKS` names 1.2.0, so installed copies upgrade in place on the next library read, as in Phase 1.
- **John 1.1.0:** four playable polities. John is the `default` scenario. Installed copies refresh through `builtInRevision`, which goes from 1 to 2; the `builtInMap` stamp stays, so existing campaigns keep their binding. A new script, `node scripts/sync-default-scenario.mjs --check`, fails when `server/seed/default/*` differs from the John package, replacing today's hand copy.
- Old saves: a John 1.0.0 campaign and a Charlemagne 1.1.0 campaign must restore and play a year after the upgrade. Ruling: if the companion check (`validateCompanion`, `wrongEdition`) refuses a save whose regions hash is unchanged only because `builtInRevision` rose, the check accepts the older revision for that same `builtInMap`. Refusing old saves is an anti-goal.
- Provenance: both packages get fresh `released-provenance.json` entries from the rebuilt manifests. Egypt's entry stays.

### Review-file corrections

- `ad800-review.json`: `mapMappings` Benevento `nameSv` becomes `Furstendömet Benevento`.
- `ad1200-review.json`: `sources.khmer` and `sources.chimu.scopedClaim` follow the corrections in `RESEARCH-STATUS.md` and the dossier `reviewCorrections`. Ruling: Claude writes the merged sentence (the Met wording plus Getty's competing 1181–about 1218 endpoints), changing no fact the proposals do not name.
- `ROME_800.noteSv` takes the proposed text from `RESEARCH-STATUS.md`.
- `src/Game/Characters/HistoricalRecordView.jsx`: `RESEARCH_END_YEAR` and its range label follow the highest researched year in `events/coverage.json`, as `RESEARCH-STATUS.md` asks.

## Acceptance

- `build-historical-scenarios.mjs --check`, `check-historical-events.mjs --check`, `check-polity-regions.mjs --check` and `sync-default-scenario.mjs --check` pass. Egypt's three `releases.json` entries are unchanged.
- `historicalPlayables.test.js` starts all 15 playable polities in realm and family mode on both stores. Silla starts with a regency for its 12-year-old king. Eirene starts as ruler with office name `Kejsarinna`.
- A Charlemagne 1.1.0 save and a John 1.0.0 save load, restore and play a year after the upgrade.
- The card lists Östasien (Tangriket, Silla), Sydostasien (Khmerriket), Mellanöstern och Nordafrika and Europa rows, and shows the chosen polity's text. A Tang campaign's prompt context names Dezong, not Karl.
- The full suite and `npm run build` pass. A Playwright run on server and web starts Tangriket and Frankrike and shows their rulers and seats.

## Left to the builder

- Function split inside `dossier-courts.mjs` and the order of new tests.
- The exact Swedish wording of coverage lines built from dossier notes, as long as it repeats the dossier's own sentences.
- The three courtier names per polity.

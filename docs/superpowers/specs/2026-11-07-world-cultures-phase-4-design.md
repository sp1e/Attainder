# World cultures Phase 4 design: the AD 1500 start

Date: 7 November 2026. Parent design: `2026-11-07-world-cultures-design.md` (Phase 4 row and "Later-phase notes"). The owner asked Claude to continue without pausing and to decide open questions itself, so every choice marked "Ruling" is Claude's call. Evidence: a read-only code map of the builder, runtime and the AD 1500 research files (git-ignored SDD workspace), summarised where it matters.

## Intent

Codex has published the AD 1500 map review (`server/seed/historical/ad1500-review.json`, B1) and the AD 1500 court dossier (`server/seed/historical/courts/ad1500-courts.json`, B2). Two polities have accepted shapes and research-ready courts: the Aztec Empire (feature 80) and the Inca Empire (feature 83). This phase ships a new built-in package, `world-1500`, so the start card offers a third era and the first playable courts in the Americas.

## Goals

1. **A new package `world-1500`** (version 1.0.0, bookmark `1500-12-31`, era label `1500 e.Kr.`) built from the pinned `world_1500` map, with Aztekriket and Inkariket playable.
2. **Courts from the dossier, primary included.** Both courts come from `ad1500-courts.json` through `dossier-courts.mjs`. Nobody retypes a dossier.
3. **The importer reads the AD 1500 dossier as published:** object chronologies, the `collective-rule` engine limit and the polity's `engineLimitNotesSv`.
4. **The package installs beside the existing starts** on server and web, and the card lists it under Amerika.

## Non-goals

- Ming and the Ottoman Empire. B1 keeps Ming 77 unresolved and quarantined and rejects Ottoman 290 for 1500; they get no court until Codex supplies reviewed geometry.
- Culture name pools, elective succession, collective rule and polity kinds (Phase 5).
- Any edit to Codex's files: `courts/`, `name-pools/`, `events/`, `sources/` and the research fields of `ad1500-review.json`.

## Anti-goals

- Any byte change to the Egypt, Charlemagne 1.2.0 or John 1.1.0 packages, their `releases.json` rows or `server/seed/default`.
- A start the card offers that fails on click. Both new polities start in realm and family mode on server and web.
- Text that states more than the dossier sources. The Aztec dossier forbids building a household from the documented rulers' names; generated people carry ` (genererad)` and `Genererad person`.
- A generated person named after a documented historical person of either polity.

## Constraints

- Released packages change only through a version bump with refreshed provenance. A new package gets its `released-provenance.json` entry from its first build, frozen in the same change.
- The engine accepts one spouse per person, `primogeniture` or `merit`, offices `ruler/general/chancellor/priest/spymaster`.
- Game text is Swedish with å, ä and ö; repository docs are English. Functions stay under about 50 lines. Files under `server/seed/historical/` are LF.

## Design

### Package record

`AUTHORED_PACKAGES['world-1500']` and a matching `PACKAGE_RECORDS` entry in `scripts/build-historical-scenarios.mjs`.

- **Primary polity from a dossier (Ruling).** `authoredScenario` today builds the primary polity with the hand-authored `court()`. It gains a dossier primary: when the package entry carries `dossier: { courtierNames, courtierBornAt }` and `successionLaw`, the primary seat, polity and court come from `dossierPlayableCourt` exactly as an extra playable's do. Aztekriket is primary because it comes first in the dossier; Inkariket is a dossier extra. Cost if wrong: the order of the card's rows, nothing else. The primary's polity record (`nameSv`, `sourceIds`, `noteSv`) comes from the review's first map mapping (feature 80) in the builder, with `hbm` first and the Getty id dropped; `compositeNote` is null.
- **Map:** `hbm-world_1500.geojson` joins `SOURCE_HASHES` with sha256 `d01ffc9b80629787f13d2b1c2f881f005bc0164433548e30f5c058ddee0bfc7b`, the value the review and dossier cite. Features 80 and 83 map to `aztec-empire` and `inca-empire` from `mapMappings`; their status comes from `allFeatures` (`accept-as-approximate-polity`, uncertain). The record quarantines four features, following the John 1200 record: each takes the review's `polygonPoliticalStatus` where it has one (77 `quarantined-unresolved`, 193 and 223 `quarantined-invalid-source-geometry`), and 290 takes `quarantined-rejected-for-1500` from its `reject-for1500` status.
- **Review sources:** a new reader for the AD 1500 review file. Its sources carry `originalChronology` as an object and no `sourceDateWording`; the reader writes the chronology string from `originalChronology.asWorded`. The Getty ids in `mapMappings` (`getty-tenochtitlan-7668941`, `getty-cuzco-7005819`) are filtered inside the AD 1500 mapping function, because the seats cite their own Getty records.
- **Reader fallbacks (Ruling):** `chronology` is `originalChronology.asWorded`, or `originalChronology.precision` when `asWorded` is null (three sources). `uncertainty` is the source's `uncertainty`, or `The review records no separate uncertainty for this source.` when absent. `review` is written from the source's `independentReview` record. The reader imports only the review sources the package cites: the two mappings, the coverage rows and the quarantine rows. Ming and Ottoman sources the coverage rows do not cite stay out.
- **Package sources:** `world-1500` gets its own `hbm` record naming the `world_1500` map and the AD 1500 year, and its own Natural Earth record, because the shared records name 3000 BC and AD 1200. The dossier sources a ready polity cites are imported as in Phase 3; both Getty seat records join `citySourceIds` and the ODC-By `gettyNotice`.
- **Package text:** `contextSv` is `Nyårsafton 1500. Spelbara riken: <namn>. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.` with the names taken from the package. `coverageNotePrefixSv` states the counts from the review file: of 291 shapes, 2 are accepted as approximate areas; Ming and the Ottoman Empire have no accepted shape and are not playable; then `<n> riken är spelbara.` `coverageBaseNoteSv` reuses the AD 800 sentence about the generalised coastline and unknown control.
- **Coverage rows (Ruling).** Each row cites only sources whose scoped claims carry its text. Ids are written here without the `regional-` prefix the builder adds.

| Area | Status | Sources | noteSv |
|---|---|---|---|
| Africa | unresolved | hbm, naturalEarth | Granskningen av år 1500 har ingen källa för Afrika. Formerna saknar godkänd ägare och kontrollen är okänd. |
| Asia | unresolved | palace-hongzhi-range, ming-empire-diversity, ming-korea-border-song | Hongzhi regerar i Mingriket år 1500, men Mingrikets form står i karantän: källorna löser inte en överlappande kontroll eller utbredningen i sydväst och nordväst. Övriga former saknar godkänd ägare. |
| Europe | unresolved | ottoman-bayezid, ottoman-rhodes, ottoman-kos, ottoman-santorini, ottoman-crimea | Osmanska rikets form avvisas för år 1500 eftersom den omfattar öar som källorna ger osmanskt styre först senare, som Rhodos och Kos 1522 och Santorini 1537. Krimkhanatets form är olöst. Övriga former saknar godkänd ägare. |
| Americas | partial | met-aztec-autonomy-west, smith-1990-aztec-provinces, nmai-inka-expansion-map, parssinen-southern-limits-614 | Aztekriket och Inkariket visas ungefärligt. Tlaxcala låg självständigt inom Aztekrikets form, och Inkarikets östra kant saknar belagd gräns. Övriga samhällens kontroll är okänd. |
| Oceania | unresolved | hbm, naturalEarth | Granskningen av år 1500 har ingen källa för Oceanien, och kontrollen är okänd. |
| Antarctica | | | `ANTARCTICA_COVERAGE`, shared. |

### Importer changes in `dossier-courts.mjs`

- **Chronology (Ruling):** a dossier source whose `chronology` is an object contributes `chronology.asWorded`. A string chronology is unchanged, so the AD 800 and AD 1200 imports keep their bytes.
- **Engine limits:** `ENGINE_LIMIT_TEXT_SV` gains `collective-rule`: `Spelet har ett ensamt härskarämbete. Råd och delat styre visas inte som egna ämbeten.` It describes a game rule and needs no source.
- **Engine limit notes:** the coverage line appends the polity's `engineLimitNotesSv` when present, after `engineLimitNoteSv` and `engineRepresentationNoteSv`. Only the AD 1500 dossier has the field, so the older imports keep their bytes.
- **Religion leader (Ruling):** the religion claim stays `religion.claimSv` only, as in Phase 3; appending the dossier's religion notes would change the AD 800 and AD 1200 bytes. The Aztec dossier note says no person holds a temple-leader office on the bookmark, so the Aztec dossier entry in `authored-scenarios.mjs` carries `religionLeader: null` and the court's religion gets `leaderId: null` (the validator allows it; `eventChains.js` skips a missing priest). The generated courtier still holds the court office `priest`. The Inca religion keeps the generated priest as leader, as Phase 3 does where a dossier names nobody. Cost if wrong: one religion event chain that never fires in an Aztec campaign.
- **Seat note:** the Inca seat's `rulerOnBookmark` is uncertain; the seat claim note keeps the dossier `noteSv` (a Getty place marker, no palace coordinate).

The acceptance check proves Charlemagne 1.2.0 and John 1.1.0 rebuild byte for byte after these changes.

### Succession laws (Ruling)

| Polity | Law | Reason |
|---|---|---|
| Aztekriket | merit | The dossier maps Aztec succession to `merit` (uncertain). Ahuitzotl's historical successor was not his son in the court. |
| Inkariket | primogeniture | The dossier says `none-fits`. The court holds Huáscar, Huayna Capac's documented son, who succeeded in history; the Phase 3 rule for Córdoba and the Aghlabids applies. |

Huáscar (game birth 1491) and Cuauhtémoc (game birth 1497) are minors at the bookmark. The coverage text carries the dossier's `successionNoteSv`, so the player reads the historical practice the law simplifies.

### Generated courtiers (Ruling)

The dossiers hold no built name pool (`namePoolStatus: proposed-unbuilt`). Each court gets three generated courtiers (general, chancellor, priest) named with Nahuatl or Quechua common nouns, each suffixed ` (genererad)`, none matching a person named in the dossier, its withheld entries or the review file. The names live beside the polity's entry in `authored-scenarios.mjs`; Codex's future name pools replace them in Phase 5.

| Polity | Names | Born |
|---|---|---|
| aztec-empire | Itztli, Cuetzpalin, Mazatl | 1458, 1462, 1467 |
| inca-empire | Kuntur Rimaq, Qori Puma, Rumi Sunqu | 1456, 1461, 1466 |

### Registration

- `HISTORICAL_BOOKMARKS` gains `{ id: "world-1500", marker: "historical-bookmarks-world-1500", contentVersion: "1.0.0" }`; `HISTORICAL_START_ORDER` appends `world-1500`, so Charlemagne stays the default start.
- `polity-regions.json` maps both polities to `americas` (label `Amerika`). 1500 falls in the existing era `late-middle-ages`.
- `seed-web-defaults.mjs` writes the web chunk for the new bookmark through its existing per-bookmark loop.
- Count-locked tests move from 15 to 17 playables and from three to four packages.

## Acceptance

- `build-historical-scenarios.mjs --check`, `check-historical-events.mjs --check`, `check-polity-regions.mjs --check` and `sync-default-scenario.mjs --check` pass. Egypt, Charlemagne and John keep their package bytes and `releases.json` rows; `releases.json` gains the `world-1500` rows and the `world_1500` source.
- `released-provenance.json` holds a frozen `world-1500` entry, and `historicalProvenance.test.js` passes.
- `historicalPlayables.test.js` starts all 17 playable polities in realm and family mode on both stores. Inkariket starts with Huayna Capac as `Sapa inka` and Huáscar as heir; Aztekriket starts with Ahuitzotl as `Huey tlatoani`.
- An installed library without `world-1500` gains it on the next read; a library where the player deleted it keeps it deleted.
- The full suite and `npm run build` pass. A Playwright run on server and web shows the start under Amerika, starts Aztekriket and Inkariket, and shows their rulers and seats with 0 console errors.

## Left to the builder

- Function split for the dossier primary and the AD 1500 review reader.
- The exact Swedish wording of the coverage prefix, as long as its counts come from the review file.
- Test order and placement.

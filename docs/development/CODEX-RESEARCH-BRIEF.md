# Codex research brief: world cultures and year events

Written by Claude on 7 November 2026 at `main` = `5e5d220f`, on the owner's instruction: Codex does all historical research for Attainder, and Claude writes all code. This brief replaces the work queue in `CODEX-HANDOVER.md` for as long as the split lasts. Read it to the end before you start.

**Owner correction, 9 November 2026:** Write new research in English only. The earlier Swedish authoring and bilingual delivery rules below no longer apply to new research batches. Publish approved English event data using the [English research format](../research/world-cultures/english-events/README.md); the existing runtime still requires Swedish fields, so Claude must provide compatible import and rendering. Keep research approval separate from runtime availability and preserve existing published records. Continue successive batches without waiting for owner confirmation after each PR.

## 1. Read first

1. `AGENTS.md`. Its rules outrank this brief.
2. `HANDOVER.local.md` in the repository root, on the owner's desktop only. It names the local paths: the private workspace repository with the culture inventory, the writing rules (`stop-slop`) and the Swedish encoding recipes. Read both skill files it lists before you write a sentence.
3. `docs/superpowers/specs/2026-11-05-historical-world-direction.md`, including "Owner decisions on 7 November 2026".
4. `docs/superpowers/specs/2026-11-07-world-cultures-design.md`: the phases your research feeds.
5. `docs/research/historical-scenarios.md`: how the Egypt, John and Charlemagne starts were researched. The Charlemagne section is the quality bar.
6. `server/seed/historical/ad800-review.json` and `ad1200-review.json`: the review-file format you will copy for AD 1500.
7. `docs/development/DEVELOPMENT-BACKLOG.md`, section "Historical events at turn end", and `server/historicalEventValidation.js`: the year-event requirements and the validator your catalog must pass.

## 2. The split

| Owner | Scope |
|---|---|
| Codex | Sources, review files, court dossiers, the culture inventory, name pools, year events, research notes, the research status file |
| Claude | Every `.js`, `.mjs`, `.jsx` and test file, the builder, `authored-scenarios.mjs`, built packages, `released-provenance.json`, `releases.json`, `package.json`, CI |

Claude is building Phase 1 of the world-cultures design on the branch `feature/world-cultures` at the same time as you research. You never touch Claude's files, and Claude never touches yours. The only shared file is `server/seed/historical/events/coverage.json` (section 9.5).

### Files you may create or change

- `server/seed/historical/courts/` (new folder): court dossiers, section 6.
- `server/seed/historical/ad1500-review.json` (new): the AD 1500 map review, section 7.
- `server/seed/historical/sources/hbm-world_1500.geojson` (new): the pinned upstream file, byte for byte.
- `server/seed/historical/name-pools/` (new folder): attested name pools, section 8.3.
- `server/seed/historical/events/catalog.json` and `coverage.json`: year events, section 9.
- `docs/research/historical-events-coverage.md`: regenerate it with the script; never edit it by hand.
- `docs/research/world-cultures/` (new folder): research notes, one Markdown file per topic.
- `docs/development/RESEARCH-STATUS.md` (new): your running status for Claude, section 11.
- The private workspace repository named in `HANDOVER.local.md`: the culture inventory, section 8.1.

### Files you never change

Everything else. That includes `ad800-review.json`, `ad1200-review.json`, `bc3000-review.json`, `authored-scenarios.mjs`, `scripts/`, `server/*.js`, `src/`, every test, the built package folders (`egypt-3000bc/`, `john-1200/`, `charlemagne-800/`), `released-provenance.json` and `releases.json`. When you find an error in a file you may not change, record it as a correction in your dossier or note (field `reviewCorrections`, section 6.4) and list it in `RESEARCH-STATUS.md`. Claude applies it.

## 3. Mandate

The owner's standing instruction from 4 November applies: continue without pausing and without asking until the work is done or your tokens run out. The owner leaves the computer running, so a question stops work for hours.

- Decide, record the decision, and keep going. Use the form `Ruling: <what> — <why> — <what it costs if wrong>` in `RESEARCH-STATUS.md` and in the PR text.
- Stop and leave a note in `RESEARCH-STATUS.md` for four things only: an irreversible or destructive operation, a security-sensitive action, a merge conflict you cannot resolve by the rule in section 10, and a task so unclear that every path is a guess.
- Never invent a fact to complete a record. An empty field with a reason beats a plausible guess. Section 4 is the core of this brief.

## 4. Research rules

These rules come from the owner and from three earlier review rounds that caught real errors. They hold for every workstream.

### 4.1 Sources

1. **Open every source you cite, in this session, and read the passage.** Never cite a URL, page, title or locator from memory. If the page does not load, the source does not exist for this batch.
2. **Use primary sources and institutional or scholarly sources.** Good: editions of chronicles and annals, museum and university pages, national heritage bodies, peer-reviewed articles, scholarly reference works (Oxford reference works, Cambridge histories, Encyclopaedia Iranica, Encyclopaedia of Islam, the Catholic Encyclopedia for church offices with its date noted), Getty TGN for coordinates. Wikipedia, blogs, game wikis, AI summaries and uncited popular sites are never a source. You may use them to find a real source, then cite that source.
3. **A source supports only the claim beside it.** Write one `scopedClaim` per source record that states what that passage supports, in English. If a source gives the ruler but not the date, it supports the ruler only.
4. **Give a precise locator:** chapter, page, paragraph, section heading, table row or year entry. "The whole book" is not a locator.
5. **Record the source's own chronology.** Keep the original wording of each date in an `asWorded` field (Latin church calendar, regnal year, hijri year, Chinese era name, Maya Long Count). Convert to the game calendar only when a cited source gives the conversion, and name that source.
6. **Check competing chronologies.** Where sources disagree, cite both, set the claim to `uncertain`, and explain the disagreement in Swedish in the note.
7. **Copyright.** Summarize in your own words. Never paste source prose beyond a phrase of under 15 words in quotation marks. Never copy maps, images or polygons from a copyrighted source. The license field for reference-only sources reads `Reference only; no source prose or images redistributed`.
8. **Paywalls.** You may cite the public abstract or front matter if it supports the claim. Write the locator so the reader knows you saw only that part.
9. **Retrieval date.** Every source record carries `retrievedAt` (or `retrievedOn` in the event catalog) as the ISO date you opened it.

### 4.2 Claim statuses

Every claim about a person, place or date has one status:

| Status | Meaning |
|---|---|
| `sourced` | A cited source states it, for the bookmark date or a span that contains it |
| `uncertain` | Sources point to it but disagree, give only an approximation, or need inference you state |
| `generated` | A game value with no historical claim. It needs a Swedish note saying so and no sources |

A documented person's identity must be `sourced`. Birth dates are often `uncertain`: give the game value (`YYYY-01-01` unless a source gives more) and explain it.

### 4.3 People

1. **Documented** people are those a source names and places in the relation you claim, alive on the bookmark date. Their label is `Dokumenterad person; spelvärden är genererade`.
2. **Alive on the bookmark date** needs evidence: a death after the date, an act after the date, or an explicit statement. If you only know the person lived "around" then, mark survival `uncertain` and explain. The Charlemagne review shows how (`DAUGHTER_SURVIVAL_SV` in `authored-scenarios.mjs`).
3. **Generated** people stand in where sources name nobody. A generated ruler is allowed only when no source names the ruler on the bookmark date. Record the searches that found nothing. Never put a generated ruler where a source names a real one.
4. A generated person's Swedish name ends in ` (genererad)` and uses a name from an attested name pool for that culture (section 8.3). Their label is exactly `Genererad person`.
5. **Withhold** people you cannot place on the date. List them in `peopleWithheld` with the reason and the sources, as `ad800-review.json` does.
6. Record what the engine cannot hold yet instead of bending the facts: several wives, co-rulers, elected or rotating rule, councils. Use the `engineLimits` field (section 6.3). Claude decides how the game represents it.

### 4.4 Places and maps

1. **Seats** take their coordinates from Getty TGN (`https://www.getty.edu/vow/TGNFullDisplay?...&subjectid=<id>`). Copy the decimal coordinates as `[longitude, latitude]` and the record URL. Getty data is ODC-By-1.0.
2. **The seat must lie inside the polity's accepted polygon.** Test it with a point-in-polygon check in a scratch script outside the repository. If it lies outside, say so and propose a different seat or a correction.
3. **Map polygons come only from Historical Basemaps** at the pinned commit `4b5039e50d8d2464b065bd76ad6086cd4597108d`. An accepted row approves a polygon as an approximate gameplay region, never a frontier. Follow `meaningOfAccept` in `ad800-review.json` word for word.
4. Unreviewed land stays unresolved and renders as `Okänd historisk kontroll`. A cultural label on the upstream map does not prove a state.

### 4.5 Independent check

Before a batch is final, a reviewer with no access to your draft reasoning checks it:

1. Start a fresh Codex session with `codex exec "<prompt>"`. Give it only the claims, the source records and their URLs, and tell it to open each URL (with `curl` or a fetch script; `codex exec` has no `--search` flag, and the cited URLs are all it needs) and return `confirmed`, `corrected: <what>` or `unsupported` per claim.
2. Apply the result. An `unsupported` claim becomes `uncertain`, `generated` or withheld. Never keep it as `sourced`.
3. Record the check in the batch: who checked (`Codex independent check`), the date, how many claims were checked, confirmed, corrected and dropped. Events record it in `review.reviewedBy` and `review.reviewedOn`.

The earlier rounds found that about one claim in ten needed correction after this step. Expect that rate and treat a clean result with suspicion.

### 4.6 Writing

- Player-facing text (`*Sv` fields) is Swedish with å, ä and ö. Developer text and Markdown notes in this repository are English.
- Use established Swedish forms of names where they exist (Karl den store, Harun ar-Rashid, Konstantinopel). Otherwise use the scholarly transliteration your source uses, and keep it consistent across files.
- Follow the `stop-slop` rules from `HANDOVER.local.md`: no "not X but Y" constructions, no dashes as clause breaks, no adverbs that carry no fact, no dramatic fragments, no inanimate subjects doing human things. A heading that carries a number does not repeat it in the body.
- Read back every file you write and check that å, ä and ö survived (the encoding skill has the check). Run the sweep command from `HANDOVER.local.md` before each commit.

## 5. Workstreams and order

Work in this order. Each numbered batch is one branch and one PR.

| # | Workstream | Batches | Unblocks |
|---|---|---|---|
| A | Courts for polities with reviewed shapes at AD 800 and AD 1200 | A1: AD 800 (8 polities); A2: AD 1200 (5 polities) | Claude's Phase 3 |
| B | The AD 1500 start: map review, seats and courts | B1: map review; B2: courts | Claude's Phase 4 |
| C | Finish the culture inventory and propose a start portfolio | C1: North Africa and the Middle East; C2: source-check East and South Asia; C3: corrections and completeness; C4: coverage matrix and start portfolio | Phase 6 planning |
| D | Research for engine depth | D1: name pools; D2: Maya; D3: steppe and other collective rule | Claude's Phase 5 |
| E | Year events, 3300 BC to AD 1530 | One century per PR, order in section 9.4 | The chronicle and the turn-end popup, already shipped with an empty catalog |

When A and B are done, alternate: one C or D batch, then two E batches. E has no end; keep going until your tokens run out.

## 6. Workstream A: court dossiers for AD 800 and AD 1200

### 6.1 Scope

These polities already have an accepted shape. Use exactly these polity ids; they are `approvedOwnerPolityId` in the review files.

| File | Bookmark | Polities |
|---|---|---|
| `courts/ad800-courts.json` | `0800-12-25` | `tang-empire`, `abbasid-caliphate`, `byzantine-empire`, `silla`, `emirate-of-cordoba`, `aghlabid-emirate`, `kingdom-of-asturias`, `duchy-of-benevento` |
| `courts/ad1200-courts.json` | `1200-12-31` | `western-xia`, `khmer-angkor`, `almohad`, `france-capetian`, `chimu` |

`carolingian-realm` and `papal-states` are out of scope: Claude builds them from the existing review file. For each polity, find out who ruled on the bookmark date, who belonged to the ruling household, where the court sat, and which religious institution the ruler stood in.

### 6.2 What to research per polity

1. **Ruler on the bookmark date**, with the start and end of the reign. Watch for successions within the bookmark year; the ruler on the exact day counts.
2. **The ruler's title in Swedish**, as the game will show it on the office (Kejsare, Kalif, Kung, Emir, Hertig, Kejsarinna).
3. **Household on the bookmark date:** spouse or spouses, children alive on that date, and other kin the sources place at court. Keep each relation sourced.
4. **Seat:** the settlement, its Getty TGN record, and whether the ruler was there on the date.
5. **Religion:** the institution, its head on the date if sourced, and one sentence on the ruler's relation to it.
6. **Succession practice** in one Swedish sentence, and which engine law fits best: `primogeniture` (eldest recognized child, then family, then council) or `merit` (council choice by ability). Write `none-fits` with a reason when neither does.
7. **A one-paragraph Swedish context** for the start card and the model prompt (maximum 600 characters): what happened to this polity around the date, with every claim sourced in the dossier.

### 6.3 Dossier format

Values in angle brackets are placeholders, never data. One JSON file per bookmark, UTF-8 without BOM, two-space indent, LF line endings in the committed blob (the checkout converts to CRLF; that is fine).

```json
{
  "schema": "attainder-court-dossiers-v1",
  "bookmark": "0800-12-25",
  "reviewFile": "ad800-review.json",
  "calendarHandling": "Sources keep their own chronology; this file converts no day unless a cited source does.",
  "sources": {
    "<source-id>": {
      "title": "...", "institution": "...", "url": "https://...", "locator": "...",
      "scopedClaim": "What this passage supports, in English.",
      "chronology": "The source's own dating of the claim.",
      "uncertainty": "What the source leaves open.",
      "license": "Reference only; no source prose or images redistributed",
      "retrievedAt": "2026-11-08"
    }
  },
  "polities": [
    {
      "polityId": "tang-empire",
      "nameSv": "Tangriket",
      "sourceFeatureIndexes": [45],
      "status": "ready",
      "blockedReason": null,
      "rulerTitleSv": "<Kejsare>",
      "successionLaw": "primogeniture",
      "successionNoteSv": "...",
      "engineLimits": [],
      "contextSv": "...",
      "contextSourceIds": ["..."],
      "seat": {
        "settlementId": "<settlement-id>",
        "nameSv": "<Swedish name>",
        "coordinates": ["<longitude>", "<latitude>"],
        "gettyTgnId": "<TGN subject id>",
        "coordinateRecordUrl": "https://www.getty.edu/vow/TGNFullDisplay?...",
        "insideAcceptedPolygon": true,
        "sourceIds": ["<getty-source-id>", "..."],
        "noteSv": "Ungefärlig ortsmarkör från Getty. ...",
        "rulerOnBookmark": { "placeSv": "...", "status": "sourced", "sourceIds": ["..."] }
      },
      "religion": {
        "id": "<religion-id>",
        "nameSv": "...",
        "claimSv": "...",
        "sourceIds": ["..."],
        "leaderPersonId": null
      },
      "people": [
        {
          "id": "<person-id>",
          "nameSv": "...",
          "identityOrigin": "documented",
          "originLabelSv": "Dokumenterad person; spelvärden är genererade",
          "roleSv": "...",
          "sex": "male",
          "isRuler": true,
          "identity": { "status": "sourced", "sourceIds": ["..."] },
          "birth": { "asWorded": "...", "status": "uncertain", "gameValue": "<YYYY-MM-DD>", "noteSv": "...", "sourceIds": ["..."] },
          "aliveOnBookmark": { "status": "sourced", "noteSv": "...", "sourceIds": ["..."] },
          "legalParentIds": [],
          "spouseIds": [],
          "kinship": [ { "relation": "son", "ofPersonId": null, "ofSv": "...", "status": "sourced", "sourceIds": ["..."] } ],
          "uncertaintySv": "..."
        }
      ],
      "peopleWithheld": [ { "who": "...", "reason": "...", "sourceIds": ["..."] } ],
      "namePoolId": "<pool-id>",
      "searchLog": ["What you searched for and did not find, one line each."],
      "reviewCorrections": [],
      "review": { "status": "checked", "checkedBy": "Codex independent check", "checkedOn": "2026-11-08", "claimsChecked": 0, "confirmed": 0, "corrected": 0, "dropped": 0 }
    }
  ]
}
```

### 6.4 Field rules

- **Ids** match `^[a-z0-9][a-z0-9-]{0,80}$`. Never `person-<number>`; the engine reserves that form. Ids are unique within a polity. Use a readable form of the name (`harun-ar-rashid`).
- `status` is `ready` or `blocked`. A blocked polity names the reason in `blockedReason` (for example no seat inside the polygon, or no source for the polity on the date).
- `rulerTitleSv`, `nameSv`, `roleSv`, `contextSv`, every `noteSv` and `uncertaintySv` are Swedish.
- Exactly one person has `isRuler: true`. A generated ruler is allowed under section 4.3.
- `spouseIds` and `legalParentIds` name people inside the same polity's list, and spouse links are reciprocal. Relations to people outside the list go in `kinship` with `ofPersonId: null` and `ofSv`.
- `engineLimits` uses these codes: `multiple-spouses`, `co-rulers`, `elective-rule`, `collective-rule`, `female-ruler-succession`, `regency`, `no-sourced-household`. Add a new code only with a ruling.
- `birth.gameValue` is a valid game date `YYYY-MM-DD` (BC as `-YYYY-MM-DD`, no year zero). Use `YYYY-01-01` unless a source gives month and day.
- `reviewCorrections` lists errors you found in a file you may not change: `{ "file": "ad800-review.json", "path": "mapMappings[3].noteSv", "problem": "...", "proposal": "...", "sourceIds": ["..."] }`.
- Every id in any `sourceIds` exists in `sources`. Every source is cited at least once.

### 6.5 Done when

All 13 polities are `ready` or `blocked` with a reason, the independent check ran, a scratch JSON validator you wrote confirms the rules in 6.4, and the PR merged.

## 7. Workstream B: the AD 1500 start

### 7.1 B1: map review

1. Download `geojson/world_1500.geojson` from `https://raw.githubusercontent.com/aourednik/historical-basemaps/4b5039e50d8d2464b065bd76ad6086cd4597108d/geojson/world_1500.geojson`. Save it unchanged as `server/seed/historical/sources/hbm-world_1500.geojson` and record its SHA-256.
2. Pick the bookmark date. It must fall on or before AD 1530, and the Aztec, Inca, Ming and Ottoman rulers on that day must each be sourced. Record the choice as a ruling with its sources. A known Christian-calendar event date makes a better bookmark than 1 January, as `0800-12-25` did.
3. Write `server/seed/historical/ad1500-review.json` with every key of `ad800-review.json` in the same order: `schema` (`attainder-ad1500-regional-source-status-v1`), `status`, `sourceMapCommit`, `sourceFile`, `sourceSha256`, `meaningOfAccept`, `default`, `calendar`, `allFeatures`, `counts`, `sources`, `replacementCandidates`, `sourceBasedGeometryRegression`, `notComplete`, `mapMappings`, `geometryQuarantine`, `people`, `peopleWithheld`, `seat`, `settlements`. `church` is optional.
4. Give every upstream feature one row in `allFeatures`, in source order, with `sourceFeatureIndex`, `sourceName`, `sourceCandidateRegionId` (`hbm-ad1500-f<4-digit index>`), `statusScope`, `status`, `certainty`, `supportedPolityLabel`, `sourceEvidenceIds`, `polygonPoliticalStatus`, `approvedOwnerPolityId` and `notes`. Statuses: `accept-as-approximate-polity`, `cultural-or-nonstate`, `reject-for1500`, `unresolved`. `counts` must equal the tally.
5. Accept a feature only when a cited source supports the polity on the bookmark date and its rough extent. Each accepted row gets a `mapMappings` entry with `index`, `polityId`, `nameSv`, `sourceIds` and a Swedish `noteSv` that states what the polygon does not show, as the AD 800 notes do (for example the share of the shape no source supports).
6. Priority: Aztec Empire, Inca Empire, Ming, Ottoman Empire first; then every other named state you can source on the date. Leave the rest `unresolved` with a reason. A shape you do not reach is `unresolved`, never accepted by default.
7. Record in `notComplete` what you did not finish.

### 7.2 B2: courts and seats

Write `courts/ad1500-courts.json` in the dossier format of section 6.3 for every polity accepted in B1, starting with the four named ones. Fill `seat`, `settlements` and `people` in the review file only if you need them for a primary polity; the dossier is the main record. The Maya features stay out of B2; they belong to D2.

## 8. Workstreams C and D

### 8.1 C: finish the culture inventory

The inventory lives in the private workspace repository (`reports/world-cultures-inventory/`, read its `README.md`). It holds 939 cultures in 8 of 9 regions. Keep its JSON format (`cultures` and `check` per region file).

- **C1.** Write `north-africa-middle-east.json` with the same fields as the other region files. The README lists the cultures that must appear at least: Egypt in each period, Sumer, Akkad, Babylon, Assyria, Elam, the Hittites, Mitanni, Phoenicia, Israel and Judah, Carthage, Persia, Parthia, the Sasanians, the caliphates, Saba, Himyar, Nabataea, Palmyra, the Fatimids, the Ayyubids and the Seljuks. Then add what your sources show beyond them.
- **C2.** Source-check `east-asia.json` and `south-asia.json` in the way the other regions were checked: each entry gets `confirmed`, a correction, or `unsupported`, stored under `check`.
- **C3.** Apply every correction in every region into `cultures`, mark unsupported entries `"supported": false` with the reason, remove duplicates, and move misfiled entries. Write the result back and update the README table.
- **C4.** Build `coverage-matrix.json`: one row per culture with the map versions in `hbm-names-bc3000-1530.json` whose feature names match it, the best candidate start year, the political form (`state`, `city-state`, `confederation`, `chiefdom`, `non-state`), whether a ruler is likely to be sourced, and a status: `playable-candidate`, `map-only`, `needs-engine-kind` or `no-source`. Then write `docs/research/world-cultures/start-portfolio.md` in this repository: a ranked list of up to 12 new start dates, each tied to an upstream map version, with the cultures each start would make playable and the share of the inventory the whole portfolio covers. The 30 map versions available are `bc3000`, `bc2000`, `bc1500`, `bc1000`, `bc700`, `bc500`, `bc400`, `bc323`, `bc300`, `bc200`, `bc100`, `bc1`, `100` through `1000` in hundreds, `1100`, `1200`, `1279`, `1300`, `1400`, `1492`, `1500` and `1530`.

The workspace repository is private and holds draft lists; commit and push there with the same identity checks as here. Nothing from it enters this public repository except the portfolio note, which cites public sources only.

### 8.2 D2 and D3: political forms the engine lacks

For each case write a note under `docs/research/world-cultures/` that answers, with sources: how power was held on a candidate bookmark date, who held it, how it passed on, how marriage and kin worked at the top, and which settlement served as a seat.

- **D2, Maya.** Candidate dates AD 800 and AD 1500. Name the city-states your sources support on each date, with their rulers where named (Tikal, Calakmul, Copán, Palenque and others at 800; Mayapán's successors at 1500). Record which have a Getty TGN record. Upstream Historical Basemaps has a single "Maya city-states" polygon; record what openly licensed source could give a city-state its own area, or propose a seat point with a developer-drawn radius and say which sources would justify the radius.
- **D3, collective and steppe rule.** At least: one steppe confederation (for example the Uyghur Khaganate at 800), one council or elective polity, and one people the sources describe without a central ruler. For each, write which `engineLimits` codes apply.

### 8.3 D1: name pools

Generated people need names that belong to their culture. Today the engine draws from a 20-name fictional pool, which also shows in Charlemagne's court.

Write one file per culture and period under `server/seed/historical/name-pools/<pool-id>.json`:

```json
{
  "schema": "attainder-name-pool-v1",
  "id": "tang-chinese",
  "cultureSv": "Kinesiska under Tang",
  "period": { "startYear": 618, "endYear": 907 },
  "sources": { "<id>": { "title": "...", "institution": "...", "url": "...", "locator": "...", "scopedClaim": "...", "license": "...", "retrievedAt": "2026-11-08" } },
  "male": [ { "nameSv": "...", "sourceIds": ["..."] } ],
  "female": [ { "nameSv": "...", "sourceIds": ["..."] } ],
  "familyNames": [ { "nameSv": "...", "sourceIds": ["..."] } ],
  "namingNoteSv": "How names were formed, in one or two Swedish sentences.",
  "excluded": "Names left out because they belong to rulers or famous people, which a generated person must not borrow."
}
```

Aim for at least 20 male and 20 female attested personal names per pool. Leave out rulers' and famous people's names so a generated courtier is never mistaken for one. Priority: one pool for each polity in workstreams A and B, then the Frankish pool Charlemagne's court needs, then Egypt c. 3000 BC and John's England.

## 9. Workstream E: year events

### 9.1 What the game does with them

At each turn end the game shows the real events of every calendar year the turn closed, under `I verklighetens historia`, at most 12 per popup, sorted by importance. The chronicle lists them all. The catalog is empty today, so players see `Inga godkända händelser ännu`.

### 9.2 Event format

`catalog.json` holds `{ "schemaVersion": 1, "sources": [...], "events": [...] }`. The validator in `server/historicalEventValidation.js` is the contract. Run it; do not reason about it from memory.

```json
{
  "id": "ev-0800-karl-krons-till-kejsare",
  "date": { "kind": "exact", "startYear": 800, "endYear": 800, "displaySv": "25 december 800" },
  "titleSv": "Leo III kröner Karl till kejsare i Rom",
  "summarySv": "Två till fyra meningar på svenska.",
  "geographySv": "Rom, Italien",
  "category": "politics",
  "importance": 3,
  "sourceIds": ["rfa-801-coronation"],
  "selectionNote": "English: why this event earns a place in this year.",
  "review": { "status": "approved", "reviewedBy": "Codex independent check", "reviewedOn": "2026-11-08" }
}
```

- Source records: `{ id, title, institution, url, locator, retrievedOn, originalChronology, reuseTerms }`, all filled. Every source is cited by at least one event.
- `date.kind`: `exact` (one year; `startYear` equals `endYear`), `approximate` (one year, as a best estimate), `range` (more than one year) or `disputed` (sources disagree; give the span of the competing dates). Years are integers, negative for BC, never 0. `displaySv` shows the date as a reader should see it (`cirka 2560 f.Kr.`, `1206–1207`, `omtvistat: 1179 eller 1180`).
- `category`: `politics`, `war`, `migration`, `religion`, `culture`, `discovery`, `technology` or `nature`.
- `importance`: 3 for a turning point of world or continental reach, 2 for a major regional event, 1 for a notable event.
- **Id form:** `ev-<year>-<swedish-slug>` with the start year zero-padded to four digits, and `ev-bc<year>-<slug>` for BC (`ev-bc0480-slaget-vid-salamis`).
- One approximate event is one record. Never spread it across years as if each year were attested.

### 9.3 Coverage index

`coverage.json` partitions every year from 3300 BC to the current maximum start year, with no gaps and no overlaps. Statuses:

| Status | Use it when |
|---|---|
| `reviewed` | You searched the span across all regions and checked the events |
| `partial` | You found events but know of regions or kinds you did not search |
| `no-secure-event` | You searched and found no securely dated event; the span holds no events |
| `unresearched` | Not started; the span holds no events |

Split a range when you research part of it. The `note` says what you searched and what is missing. A gap in the catalog never means that nothing happened.

### 9.4 Order and size

One century per PR, in this order:

1. AD 800 to 1200, the years the default Charlemagne start plays through.
2. AD 1201 to 1530, only once `HISTORICAL_START_RANGE.maxYear` on `main` reads 1530 (Claude's Phase 1). Check `server/historicalStarts.js` before you start; until then the validator refuses those years.
3. 3100 BC to 2600 BC, the years the Egypt start plays through.
4. Then outward from those blocks until the range is covered.

Per century: aim for 30 to 120 events. Cover every region where sources exist: Africa, the Americas, East Asia, South Asia, Southeast Asia and Oceania, the steppe and Central Asia, the Middle East and North Africa, and Europe. A century with nine European events and none elsewhere is a defect; state any imbalance you could not fix in the range note. Prefer events that a ruler or court of the time could have heard of or felt.

### 9.5 Commands and the shared file

```sh
node scripts/check-historical-events.mjs
node scripts/check-historical-events.mjs --check
node --test --test-concurrency=1 server/historicalEvents.test.js
```

The first command validates and regenerates `docs/research/historical-events-coverage.md`. The second must pass before you commit.

Claude's Phase 1 adds a `1201` to `1530` range to `coverage.json`. Merge `origin/main` into your branch before each PR. If `coverage.json` conflicts, keep main's new ranges and your researched ranges, then rerun the check.

## 10. Git and PR flow

Work in your own worktree so you never share a checkout with Claude:

```sh
git fetch origin
git worktree add ../attainder-research -b research/a1-ad800-courts origin/main
```

Name branches `research/<batch>-<topic>` (`research/e-0800s-events`). For each batch:

1. Merge `origin/main` into the branch before you start and again before the PR.
2. Check the identity: `gh api user --jq .login` and `git var GIT_AUTHOR_IDENT` both name `sp1e`. On this desktop the only account is `sp1e`; do not switch accounts.
3. Read `git diff --cached` for keys, tokens, passwords and local paths before each commit.
4. Commit, push the branch at once (`git push origin HEAD:refs/heads/<branch>`; the repository uses `push.default=upstream`), and verify with `git ls-remote origin <branch>`.
5. Open the PR with `gh pr create -R sp1e/Attainder`. The body lists the files, the counts (polities, people, sources, events, claims checked, corrected, dropped), every ruling, and what Claude must wire.
6. Wait for the `test` check. When it is green and you have read the diff, merge with `gh pr merge <n> -R sp1e/Attainder --squash`. Never `--admin`. Auto-merge is off.
7. Verify `gh api repos/sp1e/Attainder/commits/main --jq .sha`, then update `RESEARCH-STATUS.md` on the next branch.

A conflict in a file outside your list in section 2 means you touched a file you should not. Revert your change to that file and record the finding as a correction instead.

## 11. Reporting to Claude

Keep `docs/development/RESEARCH-STATUS.md` current. Claude reads it first when it picks up your work.

```markdown
# Research status

Updated by Codex on <date> at main = <sha>.

| Batch | State | PR | Files | Counts | Waiting for Claude |
|---|---|---|---|---|---|

## Rulings
## Corrections for files Codex may not change
## Blocked items
## Next batch
```

Write it in English, under the same writing rules.

## 12. Do not

- Edit code, tests, built packages or the existing review files.
- Cite a source you did not open in this session.
- Fill a field with a guess. Use `uncertain`, `generated`, `withheld` or `blocked` and say why.
- Copy polygons, images or more than a short quoted phrase from a copyrighted source.
- Publish machine-specific paths, campaign saves, session data or the private inventory in this repository.
- Run `git clean -fdx`, force-push `main`, switch the GitHub account, or delete `.superpowers/sdd/`.
- Add Claude attribution lines to your commits.

## 13. Open requests from Claude

- **Rome at AD 800, for Charlemagne 1.2.0.** Two Swedish texts in the Charlemagne package say `spelsätet är Aachen`. Kyrkostaten has been playable at AD 800 since 1.1.0, with Rome as its seat, so both read wrong in that start:
  - The Rome settlement note is the `noteSv` literal in `ROME_800` (`server/seed/historical/authored-scenarios.mjs`, line 71). The builder copies it into the package. It never reads `settlements[0].noteSv` in `ad800-review.json`.
  - The AD 800 context is `contextSv` (`authored-scenarios.mjs`, line 185). The start card shows it for both polities, and the narrator receives it as the campaign context.

  Propose sourced Swedish wording for both texts that holds for Karls rike and for Kyrkostaten. Keep the sources `ROME_800` cites, or name sources you opened in this session. Record both texts and their sources under `## Corrections for files Codex may not change` in `RESEARCH-STATUS.md`. You may also bring `settlements[0].noteSv` in `ad800-review.json` in line with the new Rome note. That one field is an exception to section 2; the rest of the file stays Claude's.

  Claude then changes `ROME_800` and `contextSv` and releases Charlemagne 1.2.0. Charlemagne's provenance is frozen at 1.1.0, so the release needs a new frozen record in `released-provenance.json` and `contentVersion` `1.2.0` in `HISTORICAL_BOOKMARKS` as well as a rebuild. Installed 1.1.0 copies then upgrade on the next library read.

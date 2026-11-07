# World cultures Phase 5 design: polity kinds and elective succession

Date: 7 November 2026. Parent design: `2026-11-07-world-cultures-design.md` ("Later-phase notes", Phase 5 row). The owner asked Claude to continue without pausing and to decide open questions itself, so every choice marked "Ruling" is Claude's call. Evidence: a read-only code map of the engine, validators, saves and Codex's research (git-ignored scratch), summarised where it matters.

## Intent

Two engine gaps block the next cultures and shorten the current ones.

1. Polities have no kind. The parent design gives Phase 5 a `polity.kind` (`state`, `city-state`, `confederation`, `chiefdom`, `non-state`); Maya and stateless starts wait for it.
2. The engine has two succession laws, `primogeniture` and `merit`. Four dossier polities carry the `elective-rule` engine limit (Asturias, the Almohads, the Aztecs, the Incas), and the Papal States elect their ruler. Under either law a realm ends when its last adult dies. Kyrkostaten's court holds four men and no women, so it has no births and ends between 813 and 838 on every tested seed (`CONTINUE-HERE.md`, `DEVELOPMENT-BACKLOG.md` row 7).

This phase adds the kind field and an `elective` law that keeps an elective realm alive by electing a generated successor when nobody at court qualifies.

## Goals

1. **`polity.kind`** on package polity records, validated, carried into the campaign as `realm.kind`, and shown on the start card for kinds other than `state`.
2. **`elective` succession law** in the engine, the validators and the legislator's reform.
3. **Five courts move to `elective`:** Kyrkostaten, Kungariket Asturien, Almohaderna, Aztekriket and Inkariket. Their packages ship as new versions with refreshed provenance.

## Non-goals

- Name pools. `server/seed/historical/name-pools/` does not exist; all 15 dossier polities record `namePoolStatus: proposed-unbuilt`. The importer keeps the hand-typed courtier names until Codex publishes pools.
- More than one spouse per person. Only France carries `multiple-spouses`, and the change touches about twelve engine sites. Later phase.
- Collective rule and councils as offices. Codex's steppe and Maya research (`d3-steppe-collective-rule.md`, `d2-maya-ad1500.md`) approves no representation. The single ruler office stays.
- Households with wives and children for generated courtiers, and any fix for primogeniture realms that die out (Charlemagne ends 856–868). Backlog.
- A playable city-state, confederation, chiefdom or non-state polity. This phase ships the field; the first such court comes with Codex's Maya work.

## Anti-goals

- Any byte change to the Egypt package or its `releases.json` rows.
- A new `random(state)` draw, or a reordered one, anywhere in `annualStep`. The election draws nothing.
- A save that stops loading. Old campaigns keep their law; `realm.kind` is filled by an additive migration.
- Generated people without ` (genererad)` and `Genererad person`.

## Constraints

- Released packages change only through a version bump with refreshed provenance and patch fixtures for the old release (`scripts/write-release-patch.mjs`, Phase 3 pattern), so campaigns saved under the old release restore.
- `rulesVersion` and `contentVersion` stay `hadara-1.0.0`; migrations are additive `ensure*` functions that draw no randomness.
- `validateHistoricalCourt` / `validateHistoricalScenario` (`server/historicalScenarios.js`) and `validateEngineSeed` (`server/characters/scenarioSeed.js`) change in lockstep.
- Codex's files stay untouched: `courts/`, `name-pools/`, `events/`, `sources/`, research fields of `*-review.json`.
- Functions under about 50 lines; new engine logic in its own module with hook points in `server/characters/index.js`. Game text Swedish with å, ä and ö; repository docs English. Files under `server/seed/historical/` are LF.

## Design

### Polity kind

- **Values:** `POLITY_KINDS = ['state', 'city-state', 'confederation', 'chiefdom', 'non-state']`, exported from `server/characters/content.js` beside `SUCCESSION_LAWS`. Swedish labels: `stat`, `stadsstat`, `förbund`, `hövdingadöme`, `statslöst samhälle`.
- **Package field (Ruling):** `kind` is optional on a polity record; absent means `state`. The validators refuse any other value, and refuse a `non-state` polity in `playablePolityIds` (a stateless society has no realm to rule; its start needs a family-only mode a later phase designs). The Egypt package keeps its bytes because the field stays absent there. The rebuilt packages write `kind: 'state'` on every polity record they emit, so the field is explicit wherever a package changes. Cost if wrong: a later phase rewrites the default.
- **Engine:** `createHistoricalCharacterSystem` sets `state.realm.kind` from the chosen polity (`'state'` when absent). An additive `ensureRealmKind` fills `'state'` in saves without it. A fictional (non-historical) start gets `'state'`.
- **Rules per kind (Ruling):** this phase gives a kind one engine rule, the playable refusal for `non-state`. City-state, confederation and chiefdom play as a state until a court of that kind exists and its research says what differs. Cost if wrong: the Maya phase adds rules on top; nothing here needs undoing.
- **Start card:** `HISTORICAL_SUMMARY_SCHEMA` becomes 3 and `polityEntry` gains `kind`. The card row shows the Swedish label after the era for every kind except `state`. Stale summaries rebuild through the existing schema check in both library stores.
- **Presentation:** `publicHistoricalOrigin` stays as it is. The court presentation gains `realm.kind`, `realm.kindLabelSv`, `realm.successionLaw` and `realm.successionLawLabelSv` (`förstfödslorätt`, `förtjänst`, `val`). The `Ämbeten & arv` view shows the order as `Tronföljd: <label>`; no view shows the law today.

### Elective succession

- **Law value:** `SUCCESSION_LAWS` becomes `['primogeniture', 'merit', 'elective']`. Both validators accept it.
- **Candidates (Ruling):** under `elective`, `rulerCandidates` returns three groups: living adults of the old ruler's family, then living minors of that family by age (eldest first), then living adults of every other family. The old ruler's spouse and every other legal parent of the old ruler's children leave the first two groups and stand in the third. Amended after the final review: the old ruler's legal children (`legalParentIds` includes the old ruler) join the first two groups whatever their `familyId`, adults in the first and minors in the second, because a child takes the mother's family and would otherwise rank as an outsider; the co-parent rule still moves the other parent to the third group. A child the old ruler adopted (the `adoption` memory names the ruler as adopter) makes nobody a co-parent, so a brother whose son the ruler adopts stays in the first group. The adult groups are ranked by the merit score the engine already uses (`diplomacy + stewardship + familySupport / 10`, ties by id). Minors outside the ruling family never qualify; a minor of the ruling family rules under the engine's existing regency, as a minor heir does under primogeniture. Huayna Capac himself acceded young under a regent. Kin first follows the Aztec and Inca dossiers, which keep the election inside the ruling lineage; the merit score stands in for the electors' judgement. The spouse belongs to the house by marriage, not by lineage, so the spouse does not stand first: without this rule Araua Ocllo, Huayna Capac's wife, would succeed him. The dossier records her marriage as kinship without a spouse link, which is why the co-parent rule is needed. At the bookmark the rule elects Huáscar, aged 9, under a regency. Cost if wrong: one ranking function.
- **Elected outsider (Ruling):** when the list is empty on a ruler's death, the engine creates one generated adult and crowns that person. No randomness: the id comes from the engine's existing sequence counter; the person is 40 at accession (born 1 January, 40 years before the current date), archetype `steward`, trait `dutiful`, every skill 5, religion of the dead ruler, in a new family. Swedish text: the person is named `Vald härskare <n> (genererad)` and the family `Valt hus <n> (genererat)`, where `<n>` counts elected outsiders in this campaign from 1; `originLabelSv` is `Genererad person`; the succession event reason is `Valet föll på en person utanför hovet`. Historical starts mark the person `identityOrigin: 'generated'` with generated claims, as `newChild` does. Under `primogeniture` and `merit` an empty list still ends the realm. Cost if wrong: one module.
- **Forecast and claims:** `getSuccessionForecast` reports an empty elective list as an election from outside the court (`electionFromOutside: true`) and creates nobody. `refreshLegalClaims` leaves `legalHeirId` null in that case and, after the final review, writes a `legal_succession` entry only when the lawful ruler changes to another person. The forecast's successor column then reads `En genererad person utanför hovet väljs.` The heir claim reason maps law ids to Swedish (`förstfödslorätt`, `förtjänst`, `val`) instead of printing the id.
- **Abdication:** unchanged. With no candidate it refuses as today.
- **Legislator reform:** `succession_law` cycles `primogeniture → merit → elective → primogeniture`, with the current cost and reactions. The legislator's Swedish description names all three orders.
- **Engine-limit text:** `ENGINE_LIMIT_TEXT_SV['elective-rule']` becomes `Spelets valordning väljer först bland vuxna i härskarens hus efter förmåga, sedan bland husets barn efter ålder och sist bland hovets övriga vuxna efter förmåga. Ett barn styr genom en förmyndare. Finns ingen behörig väljs en genererad person utanför hovet. Valet återger inte rådets eller väljarnas egen ordning.` The succession panel's law label (`SUCCESSION_LAW_RULES_SV.elective`) reads `Val efter förmåga bland vuxna i härskarens hus, därefter husets barn efter ålder och sist hovets övriga vuxna`. Amended after the final review: the first text left out the house's minors, who rank between the two adult groups.

### Courts and packages

| Polity | Package | Law before | Law after |
|---|---|---|---|
| Kyrkostaten | charlemagne-800 | merit | elective |
| Kungariket Asturien | charlemagne-800 | merit | elective |
| Almohaderna | john-1200 | merit | elective |
| Aztekriket | world-1500 | merit | elective |
| Inkariket | world-1500 | primogeniture | elective |

Ruling: the four `elective-rule` polities move because the dossiers name election as the practice the old mapping simplified; Kyrkostaten moves because the papacy is elective and its court has no births. The Inca court keeps Huáscar, who stands first at the bookmark as the only member of Huayna Capac's lineage. Cost if wrong: one law per court entry.

| Package | Version before | Version after |
|---|---|---|
| charlemagne-800 | 1.2.0 | 1.3.0 |
| john-1200 | 1.1.0 | 1.2.0 (and `server/seed/default` regenerated by `sync-default-scenario.mjs`, `builtInRevision` 3) |
| world-1500 | 1.0.0 | 1.1.0 |
| egypt-3000bc | unchanged | unchanged |

Each bumped package gets a new frozen `released-provenance.json` entry, refreshed `releases.json` rows and a `HISTORICAL_BOOKMARKS` version bump, so installed libraries upgrade on next read.

**Old-release fixtures (Ruling):** every upgrade path keeps working. `server/fixtures/` stores each old release as a patch against the package shipped today and checks the rebuild's sha256 (`server/fixtures/releaseFixtures.js`, `scripts/write-release-patch.mjs`), so changing the packages breaks the two existing fixtures. The plan regenerates `charlemagne-800-1.1.0` and `john-1200-1.0.0` against the new packages and adds `charlemagne-800-1.2.0`, `john-1200-1.1.0` and `world-1500-1.0.0`, cut from the commits on `main` that shipped them (Phase 4 merged as `02aea551`). The old-save tests (`charlemagneOldSave.test.js`, `johnOldSave.test.js`, `historicalStarts.test.js`, `src/runtime/web/johnDefaultRefresh.test.js`) cover every fixture. Cost if wrong: one task of fixture work.

**Locked rows:** `server/world1500Scenario.test.js` locks 12 release rows by size and sha256: 4 Egypt, 4 John and 4 Charlemagne. The 8 John and Charlemagne rows move to the new values; the 4 Egypt rows stay. The test gains the 4 `world-1500` rows at their new values.

## Acceptance

- `build-historical-scenarios.mjs --check`, `check-historical-events.mjs --check`, `check-polity-regions.mjs --check` and `sync-default-scenario.mjs --check` pass. Egypt keeps its package bytes and `releases.json` rows.
- Validator tests: `kind` accepts the five values and refuses others; a playable `non-state` polity is refused; `elective` is accepted; both validators agree.
- Engine tests: elective ranking (kin adults by merit, then kin minors by age, then others by merit, with the old ruler's spouse and co-parents in the last group and minors outside the ruling family excluded); after Huayna Capac's death at the world-1500 bookmark the successor is Huáscar under a regency, not Araua Ocllo; a death with no adult creates exactly one generated electee and keeps `realm.alive`; primogeniture and merit still end the realm in the same case; the forecast reports `electionFromOutside` and creates nobody; the reform cycles three laws; no `random(state)` draw count changes for a seeded year (compare `rngState` after `annualStep` on a court with and without the change where no ruler dies).
- Kyrkostaten plays 100 game years on the eight seeds in `src/runtime/characters/courtBalance.test.js` and stays alive with a generated elected ruler after the court dies out.
- Campaigns saved under Charlemagne 1.1.0 and 1.2.0, John 1.0.0 and 1.1.0 and world-1500 1.0.0 restore, and an old save without `realm.kind` loads with `state`.
- The full serial suite and `npm run build` pass. A Playwright run on server and web starts Kyrkostaten and Inkariket, shows `val` as the order in the succession view, and shows 0 console errors.

## Left to the builder

- Module split for the election (`server/characters/election.js` suggested) and how the hooks reach it.
- Where the Swedish kind label sits in the card row, within the existing row layout.
- Test placement.

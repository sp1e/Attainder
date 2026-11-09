# Several spouses per person

Date: 9 November 2026. Phase 5 item of the world-cultures plan.

## Intent

The engine stores one spouse per person (`spouseId`). The seed and the validator refuse an authored person with more than one entry in `spouseIds`. The AD 1200 dossier therefore marks `france-capetian` with the engine limit `multiple-spouses` and leaves Agnes of Merania out of the court. This change lets an authored court give a person two or more reciprocal spouses, and makes every rule that asks "is this person married, and to whom?" see all of them.

## Goals

- Seed authored courts whose people list two or more reciprocal spouses.
- Mourning, kinship, matchmaking, the marry command, court renewal, succession and elections count every spouse.
- The person panel lists every spouse.
- Existing saves, the Hadara demo and every shipped start produce the same state and the same numbers as before.

## Non-goals

- No new plural marriages in play. The marry command, matchmaking and court renewal marry only people without a living spouse, as today.
- No change to births. A mother bears children with `spouseId` only.
- No change to affairs (`npcPlots.js`). An NPC judges only the `spouseId` spouse.
- No change to the court data. Codex owns `server/seed/historical/courts/` and decides whether Agnes enters the French court.

## Rulings

1. **Field.** `spouseId` stays and holds the first authored spouse. A new optional field `otherSpouseIds` holds the rest, in authored order. The seed writes the field only when a person has two or more spouses. An absent field means no other spouse. Saves without the field load unchanged, and the Hadara hashes in `server/sharedCharacters.test.js` stay as they are.
2. **Helper.** A new module `server/characters/marriage.js` exports `spouseIdsOf(person)`, `isMarried(a, b)` (either person lists the other) and `hasLivingSpouse(state, person)`. Every reader below uses them.
3. **Validation.** `enginePerson` in `server/historicalScenarios.js` and `validateEngineSeed` in `scenarioSeed.js` drop the one-spouse limit. The validator keeps its uniqueness and reciprocity checks, so a one-sided second spouse is still refused.
4. **Normalization.** `normalizeCharacterSystem` accepts `otherSpouseIds` when it is an array of unique ids that name existing people, excluding the person and `spouseId`. A missing person throws the existing "Ett släktband hänvisar till en saknad person."; any other bad shape throws "En person saknar giltiga egenskaper.".
5. **Partner relations.** The seed creates a `partner` relation for every spouse pair.
6. **Death.** Every living person who lists the deceased as a spouse gets the stress (+15) and the bereavement condition.
7. **Married means any living spouse.** The marry command and its form, matchmaking (`singles`) and court renewal (`hasLivingSpouse`) treat a person with a living other spouse as married.
8. **Kinship, succession, election.** `kin` (index.js), `partnersOf` (succession.js) and `marriedIn` (election.js) count all spouses in both directions.
9. **No promotion.** When the `spouseId` spouse dies, the field keeps the dead spouse, as it does for widows and widowers today. Rulings 6–8 read all spouses, so no rule needs a living `spouseId`.
10. **Remarriage.** The marry command overwrites `spouseId` as today and leaves `otherSpouseIds` as the record of earlier marriages.
11. **Panel.** "Familjeband" shows one "Partner:" line per spouse.
12. **Engine-limit text.** The Swedish note for `multiple-spouses` in `server/seed/historical/dossier-courts.mjs` still says the game allows one spouse. John 1.2.0 is released and `releases.json` pins its bytes, so the note changes with the next John release or when Codex drops the limit.
13. **Versions.** `rulesVersion` and `contentVersion` stay at `hadara-1.0.0`.

## Tests

New file `src/runtime/characters/severalSpouses.test.js`, built on the Charlemagne start with a ruler given two authored wives:

- The seed sets `spouseId`, `otherSpouseIds` and partner relations for both pairs; `normalizeCharacterSystem` returns the same state.
- The validator accepts two reciprocal spouses and refuses a one-sided second spouse.
- The ruler's death gives both wives stress and bereavement; the second wife's death gives the ruler bereavement.
- `marriedIn` and the succession partners include both wives.
- With the first wife dead and the second alive, the marry command refuses the ruler and matchmaking skips him.
- `normalizeCharacterSystem` refuses an `otherSpouseIds` entry naming a missing person.

Parity: `fade-parity.mjs` gives the same numbers on main and on the branch for the demo and Charlemagne.

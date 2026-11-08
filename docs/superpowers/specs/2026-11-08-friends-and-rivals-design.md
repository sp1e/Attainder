# Friends and rivals form at court

Feature idea 8 of the 2026-11-08 proposals. Two adults who hold a strong opinion of each other become friends or rivals in the yearly step. Friendship and rivalry then change a conversation's odds and the choice of NPC feuds.

## What exists

- `state.relations[from:to].bonds` already holds bond types (`partner`, `mentor`), written both ways by `addBond` in `server/characters/index.js`. The presentation lists every relation with bonds under "Personliga förbindelser" in the Personer tab, and the view already labels `friend` "vän" and `rival` "rival". No code writes `friend` or `rival` today.
- `fadeDeadRelations` removes relations between two dead persons, bonds included.
- `state.relationships` (secrets extension) holds `nemesis` records from `dread.js`. This feature leaves it alone.

## Measurement (2026-11-08, Charlemagne AD 800, no player)

Karls rike and Kyrkostaten, seeds 777 and 321, years 0, 10, 30 and 100: no pair of living adults held +60 or −60 in both directions, and the highest mutual positive opinion was +8 (the family base). Opinion causes run one way, mostly towards the ruler or the acting person (gift +15, appointment +15, patronage +12, banishment −40). One direction reached −55 and −60 at Kyrkostaten in year 30. A rule that needs both directions would never fire.

With the rulings below, the same runs form 0 to 2 rivalries per checkpoint and no friendship. A friendship needs a player who gives gifts, appoints or feasts a person until one opinion reaches +50. The Hadara hashes in `server/sharedCharacters.test.js` stay the same: no pair in those runs reaches ±50.

## Rulings

1. **Store.** Friend and rival are bonds in `state.relations`, written both ways (`addBond`) and removed both ways (`dropBond` in `bonds.js`). The Personer tab shows them without new view code, and the existing relation fading bounds them.
2. **Step.** `bondStep(state, hooks)` in `server/characters/bonds.js` runs once a year in the annual step, after `prisonerStep` and before `npcPlotStep`, so a rivalry formed this year can start a feud the same year. It draws no randomness.
3. **Pairs.** Unordered pairs of living adults, in id order. `ab` and `ba` are the two personal opinions; `high = max(ab, ba)`, `low = min(ab, ba)`.
   - A friendship forms when `high >= 50` and `low > -20`.
   - A rivalry forms when `low <= -50` and `high < 20`.
   - A friendship ends when `high < 20` or `low <= -20`; a rivalry ends when `low > -20` or `high >= 20`. The gap between 50 and 20 keeps a bond from flickering.
   - The two conditions exclude each other, so a pair never holds both.
   - A pair with a dead or child member is not read: its bond stays as it was, so a dead friend still shows as a friend.
4. **Conversation.** `buildRows` in `conversation.js` adds the row `Vänskap` +8 when the speaker and the representative hold a friend bond, and `Rivalitet` −8 when they hold a rival bond.
5. **Feuds.** `worstFeud` in `npcPlots.js` ranks a rival pair of different families above every other pair, and a rival pair qualifies even when its mutual opinion is above `FEUD_OPINION`. Among pairs of the same rank the lowest mutual opinion wins, as before.
6. **No log entry.** A bond forms silently; the player reads it in the Personer tab and in the conversation odds.
7. **Saves.** No migration. An old save gets bonds at its next year end. `rulesVersion` and `contentVersion` stay.

## Tests

`src/runtime/characters/bonds.test.js`:
- a pair at +50/0 becomes friends, at +49/0 does not, and at +60/−20 does not;
- a pair at −50/0 becomes rivals, and at −60/+20 does not;
- a friendship at +30 stays, and at +19 ends; a rivalry at −30 stays, and at −19 ends;
- a dead or child member keeps the bond and forms none;
- the step leaves the random streams untouched;
- the conversation rows and the feud choice follow rulings 4 and 5.

# A large house loses a branch that becomes its rival

Date: 10 November 2026. Phase 4, moment 9 of `2026-10-31-ai-game-master-design.md` ("The family grows until a branch breaks away as rivals."). Owner mandate: continue without pause and decide by rulings.

## Problem

A family only gains people. A child takes its mother's family (`newChild` in `server/characters/index.js`), the head is the eldest free member, and nothing ever moves a person to another house. Measured over 300 years: the largest house of a Charlemagne campaign reached 18 and 23 living members (seeds 777 and 321), and a Hadara house reached 131 (seed 321). In a Charlemagne campaign of seed 777, a house of ten or more held a man outside the head's line with a child in the house in 156 of the house-years.

## Rulings

1. **Historical campaigns only.** The step runs when `state.historicalOrigin` is set, as court renewal does (`server/characters/renewal.js`). Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`. Cost if wrong: Hadara's largest houses never split until a later version opts them in.
2. **Size.** A house splits once it has `CADET_SIZE` (10) living members and the branch leaves at least half of that (5) behind.
3. **The founder.** The eldest living adult member who was born into the house (a legal parent belonged to it), is free, is outside the head's line (the head and every legal descendant, traced through the dead), has at least one living legal descendant who leaves with them, and has no living parent in the house outside the head's line (that parent founds the branch, or nobody does). The head, the house's guardian, the ruler and the player's representative never found a branch and never leave with one. Sex does not matter.
4. **Who leaves.** The founder, the founder's living legal descendants in the house and the founder's spouse when the spouse belongs to the house. Imprisoned members and members of the head's line stay, and so do a moved spouse's children of an earlier marriage.
5. **The new house.** Id `family-<sequence>`, as court renewal makes houses. Named "`<founder>`s gren av `<root house>`", with parenthetical notes cut from both names and a number added when the name is taken; a branch of a branch names the root house, without that number (a number that belongs to the root house's own name, as in "Hovhus 6", stays; fixed with moment 6). Same colour, the founder's faith, the founder as head. It takes the branch's share of silver and influence (rounded) and of estates (rounded down, the old house keeps at least one).
6. **Rivalry.** The founder and the old head each get "Husets splittring", −25 for 30 years, towards the other, tied to a memory of the split. A public event says who left with how many kin.
7. **Pace.** One split a year, the first qualifying house in id order. Over 300 years of Charlemagne seeds 777, 321 and 5 this gave 6, 7 and 8 splits, and every save loaded.
8. **No draws, no version change.** The step reads and writes no random stream. It takes one sequence number per split. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. Saves need no migration: the new house has the shape every house has.
9. **What stays with the old house.** Household staff, open demands, cities governed by a moved person and claims stay where they are. `refreshLegalClaims` already marks a claim whose holder changed house as transferred.

## Tests

`src/runtime/characters/cadetBranches.test.js`:

- A sister's line of a ten-member house leaves with her husband and children, takes 40 % of 100 silver, 1 of 3 estates and 20 of 50 influence, and both heads resent each other. The save loads.
- A house of nine, a branch of the head's own line and a spouse who married in found no branch.
- A branch that would leave fewer than five behind does not split, and the founder's child does not split in its place.
- A prisoner and a spouse of another house stay behind, and a house without estates gives none. The save loads.
- A Hadara campaign never splits, and a taken name gets a number.
- 300-year runs: Hadara matches `main`; three Charlemagne seeds split and load (checked by script, outside the suite).

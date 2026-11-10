# A dead ruler's inheritance is divided among the children

Date: 10 November 2026. Phase 4, moment 6 of `2026-10-31-ai-game-master-design.md` ("Partition: the realm is divided among the children"). Owner mandate: continue without pause and decide by rulings.

## Problem

The game holds one realm (`state.realm`), and the Charlemagne start has one city, Aachen. A division of land into several realms or appanages has nothing to divide and no second realm to hold it. What a ruler leaves that can be divided is the house: its silver, estates and influence, and the people who stand in it. Frankish partition gave younger sons a share and a seat of their own and left the brothers as rivals; this moment models that share within the one realm.

## Rulings

1. **The house's inheritance, not the land.** Partition divides the dead ruler's house. The realm, its treasury and its cities stay whole. Dividing the map waits for phase 6 (foreign realms), when a second realm exists to receive a share. Cost if wrong: a player who picks the law expects separate kingdoms and gets rival houses inside one.
2. **A fourth law.** `SUCCESSION_LAWS` becomes `['primogeniture', 'merit', 'elective', 'partition']`, label `delat arv`. The legislator's reform cycles primogeniture → merit → elective → partition → primogeniture. Scenario and court validators read the list, so a court seed may name `partition`.
3. **The throne.** Under `partition` the crown passes as under primogeniture: `rulerCandidates` already falls through to `primogenitureCandidates` for any law other than merit and elective.
4. **When it acts.** Only when a ruler dies (`killPeople`, right after the crown passes) and the new ruler is a legal child of the dead ruler. A grandchild, a sibling or an outsider on the throne divides nothing. An abdication or deposition divides nothing.
5. **Who shares.** Up to `PARTITION_HEIRS` (3) of the dead ruler's living legal children who are adults (18), free, members of the ruler's house and outside the new ruler's line, eldest first, of either sex. The house's guardian and the player's representative never found a house and never leave with one.
6. **What each founder takes.** Each founder leaves with their own line in the house (legal descendants, traced through the dead) and their spouse when the spouse belongs to the house. Prisoners, the heir's line and another founder stay where they are. The founder heads a house named as a cadet branch (`foundHouse` in `cadetBranches.js`): "`<founder>`s gren av `<root house>`".
7. **Shares.** With k founders the inheritance splits into k + 1 equal shares, one for the heir's house. Each founder takes 1/(k + 1) of silver, influence and estates, rounded down, and the heir's house keeps the remainder: never less than a founder's share, so it keeps at least one estate whenever it had one and never falls into debt. The heir's house is the dead ruler's house, which the founders leave; an heir who took the mother's house leaves the remainder there all the same.
8. **Rivalry.** Every pair among the heir and the founders gets "Delat arv", −30 for 20 years, both ways, tied to one memory. A public event "Arvet efter X delas" names the heir, the founders and the new houses.
9. **The line of succession.** A founder leaves the ruler's house and so drops behind the house's own members in the primogeniture order (`primogenitureCandidates` ranks the house before outsiders). Over 300 years of Charlemagne seeds 777, 321 and 5 under partition the realm never ended and every save loaded.
10. **No draws, no version change.** The step reads and writes no random stream and takes one sequence number per new house. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. No NPC changes the law, so Hadara plays byte for byte as on `main` (300-year state hashes for seeds 321, 777 and 2). Saves need no migration.

## A fix to moment 9

A branch of a branch named its root house with any trailing number cut, so a branch of "Annas gren av Hovhus 6" was named after "Hovhus". `rootHouse` now cuts the number only when it marks a taken name, that is when the name without it belongs to another house.

## Tests

`src/runtime/characters/partition.test.js`:

- Karl dies under partition: Karl den yngre takes the throne, Pippin, Ludvig and Rotrud found three houses with 27 silver, 0 estates and 11 influence each; the royal house keeps 29, 2 and 12; Berta, Gisela and the minors stay. The save loads.
- All twelve ordered pairs among the four resent each other for 20 years; a sister who stayed does not.
- Under primogeniture Karl's death leaves the house whole.
- A new ruler who is not the dead ruler's child divides nothing.
- A founder takes a spouse of the house and a son along; a daughter married into another house stays out and the next child takes the third share; the heir's son stays.
- A house of eight estates gives two to each founder and keeps two; a house of two silver and two influence gives none and keeps both.
- A representative who is a founder's son stays in the house.

`election.test.js`, `scenarioSeed.test.js` and `successionLine.test.js` cover the fourth law in the cycle, the frozen list and the forecast. `cadetBranches.test.js` covers the root-house number.

# The electors vote

Feature idea 7 of the 2026-11-08 proposals. In an elective realm the crown no longer falls to the first person in the merit order. The electors vote among the leading candidates, and the player sees how they lean and can win them over.

## Rulings

1. **Electors.** The holders of the three council seats (chancellor, general, spymaster) and the head of every family not in exile. Each must be living, adult and free, and the old ruler never votes. `electorsOf(state, oldRuler)` gives them sorted by id.
2. **The ballot.** `electiveTiers` splits the elective order into its three existing tiers: adults of the old ruler's house by merit, its minors eldest first, and every other adult by merit. The ballot is the first three of the house's adults. A house with only minors passes to the eldest without a vote, as before. With no house left, the first three outsiders stand.
3. **A vote.** Each elector backs the ballot candidate with the highest `merit + 0.2 x opinion`, where merit is the existing `meritScore` and opinion is the elector's personal opinion of the candidate. A tie goes to the earlier candidate on the ballot. A candidate who is an elector backs themself.
4. **The winner.** Most votes wins, and a tie goes to the earlier candidate on the ballot. `rulerCandidates` puts the winner first and leaves everyone else in the elective order. The death transition, abdication and the forecast all read that order, so they cannot disagree.
5. **What the player sees.** The succession forecast under "Om härskaren avlider" lists the ballot at the loyalty reader's precision (`loyaltyPrecision`: the spymaster's effective intrigue, else half the representative's):
   - three: who leads ("leder" or "ligger efter");
   - five: each candidate's votes, as "3 av 5 röster";
   - exact: the votes and each elector's choice.
6. **Winning electors.** No new command. A gift (+15) or `Påverka` (+10 to +25) raises the target's opinion of the representative, and a grudge lowers it. Those causes already move a vote when the representative stands, and the forecast shows the effect.
7. **Determinism.** The vote reads state and draws nothing. It touches no stream and no `state.sequence`. `rulesVersion` stays at `hadara-1.0.0`, as it did when idea 5 changed births.

Out of scope: an explicit pledge of a vote for another candidate, promising an office for a vote (`office_promise`), and electoral bodies that differ by realm (cardinals, nobles' councils). The last needs Codex's research on collective rule.

## Balance (2026-11-09, no player, Kyrkostaten, 200 years)

| Seed | Years with a vote | Years the vote overturns merit | Rulers on main | Rulers with the vote |
| --- | ---: | ---: | ---: | ---: |
| 777 | 187 | 7 | 43 | 43 |
| 321 | 180 | 15 | 50 | 50 |
| 11 | 173 | 8 | 41 | 39 |
| 42 | 195 | 6 | 43 | 43 |

At an opinion weight of 0.1 the vote overturned merit in 2 to 7 years of 200, and a gift moved a candidate by 1.5 points. At 0.2 a gift is worth 3 points, close to the merit gap between neighbours on a ballot, and NPC opinions still leave merit deciding in 92 to 97 % of years.

## Tests

- `src/runtime/characters/electors.test.js`: the elector set, an elector's choice and its tie rule, the three ballot cases, merit deciding and grudges crowning the next candidate at the death itself, the three precisions, and a forecast that draws nothing.
- `src/Game/Characters/CharactersPanel.test.js`: an elective forecast lists the votes, a merit forecast does not.

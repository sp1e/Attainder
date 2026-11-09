# Children of an affair

Feature idea 5 of the 2026-11-08 proposals. A wife with a hidden affair can bear her lover's child. The child keeps the husband as legal father, takes traits and portrait from the lover, and leaves a hidden `illegitimate_child` secret that investigate and blackmail can reach. Once the secret is out, the child's claim to the throne is contested and the husband turns against the wife and the lover.

## Measurement (2026-11-09, no player)

Births while the mother held an unexposed affair secret:

| Run | Births | Under an affair | Affairs | Held by women |
| --- | ---: | ---: | ---: | ---: |
| Karls rike, seed 777, 300 years | 176 | 5 | 11 | 4 |
| Karls rike, seed 321, 300 years | 163 | 39 | 45 | 24 |
| Kyrkostaten, seed 777, 300 years | 219 | 24 | 17 | 11 |
| Kyrkostaten, seed 321, 300 years | 104 | 5 | 12 | 4 |
| Hadara, seed 321, 100 years | 90 | 38 | 35 | 20 |
| Hadara, seed 71, 100 years | 51 | 26 | 21 | 13 |

With a share of one half, a 300-year Charlemagne run gets 2 to 20 children of an affair.

## Rulings

1. **Where.** The birth loop in `annualStep` (`server/characters/index.js`) keeps its main-stream roll. Only when a birth happens does it ask `biologicalFather(state, mother, husband, hooks)` (`server/characters/paternity.js`) who the father is, and passes that person to `newChild`.
2. **When the lover is the father.** The mother is the subject of an unexposed `affair` secret. The paternity draw `u` (`paternityDraw`, an FNV-1a hash of the plot stream's current state, the mother's id and the date) decides: `u < 0.5` gives the lover, anything else the husband. The hash reads the plot stream and never advances it, so every other draw in the campaign stays where it was.
3. **Who the lover is.** The lover of the mother's earlier child of the same affair, while he is still eligible (the second holder of her latest `illegitimate_child` secret created on or after the affair secret). Otherwise the eligible man at index `floor(u / 0.5 × n)` in id order. Eligible: alive, male, adult, not the husband, not in prison, not close kin to the mother (`closeKin`), not the player's active representative. No eligible man gives the husband.
4. **The child.** `biologicalParentIds` names the mother and the lover; `legalParentIds` keeps the mother and the husband, so inheritance, house and the birth log ("Barn till <mor> och <make>.") stay as they are. The second trait comes from the lover. The portrait follows the biological parents, as it already does.
5. **The secret.** `illegitimate_child` with the child as subject, holders `[mother, lover]`, evidence weak, cause the birth memory. Investigate on the child, once adult, can find it, and blackmail can use it.
6. **Contested claim.** Under primogeniture (`primogenitureCandidates`, `server/characters/succession.js`) a person who is the subject of an exposed `illegitimate_child` secret leaves the descendant line and the house's kin and stands after them, ahead of everyone else, by birth. Their own children keep their places. Merit and election are unchanged.
7. **The husband's grudge.** Once a year (`paternityStep`, before `bondStep`), for each exposed `illegitimate_child` secret, the living legal father gets −25 towards the mother and −25 towards the biological father, label "Oäkta barn", cause id `bastard:<secret id>`, for 20 years. The cause id keeps the step from adding the same grudge twice.
8. **Determinism.** No stream moves. `rulesVersion` and `contentVersion` stay. Men's affairs make no children: the engine does not know who the other woman is.

Out of scope: rumors about real illegitimacy (the rumor records stay as they are), a lover's own reaction, and contested claims under merit or election.

## Balance (no player, main against this change)

| Runs | Births, main | Births, change | Marriages, main | Marriages, change | Children of an affair |
| --- | ---: | ---: | ---: | ---: | ---: |
| Karls rike, seeds 11, 22, 33, 44, 55, 66, 88, 99, 300 years | 871 | 869 | 314 | 298 | not counted |
| Karls rike and Kyrkostaten, seeds 11 to 55, 200 years | 681 | 728 | | | 38 |
| Karls rike, seed 777, 300 years | 177 | 108 | 67 | 37 | 9 |
| Karls rike, seed 321, 300 years | 164 | 102 | 63 | 34 | 11 |

Every realm lives in both versions. Seeds 777 and 321 lose a third of their births: in those small courts a lover's children are half-siblings, and `closeKin` reads biological parents, so 48 and 283 pair-years of singles cannot marry who could on main. Across the other eighteen runs births and marriages stay within 7 % of main. No secret is exposed without a player: exposure comes from the player's investigate and blackmail.

## Tests

`src/runtime/characters/paternity.test.js`:
- without an affair, `biologicalFather` returns the husband and moves no stream;
- with an affair and `u < 0.5`, it returns an eligible lover; at `u ≥ 0.5` the husband; no stream moves;
- the husband, close kin, a prisoner, a minor, a woman and the representative are never chosen;
- a second child of the same affair gets the same lover;
- a child of the lover has the lover as biological and the husband as legal father, the lover's trait, the birth log naming the husband, and a secret with holders `[mother, lover]` and the birth memory as cause;
- an exposed secret moves the child behind the house's kin in `primogenitureCandidates`; an unexposed one does not;
- `paternityStep` gives the husband −25 towards the mother and the lover once, and not again the next year.

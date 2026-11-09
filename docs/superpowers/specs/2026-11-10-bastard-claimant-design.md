# A ruler's illegitimate child claims the throne

Date: 10 November 2026. Phase 4, moment 8 of `2026-10-31-ai-game-master-design.md` ("An illegitimate son grows up and claims the throne."). Owner mandate: continue without pause and decide by rulings.

## Problem

Children of an affair exist since PR #79: an `illegitimate_child` secret names the child as subject and holds the mother and the biological father. Once exposed, the legal father bears a grudge. The child itself gains nothing from royal blood. A faction's claimant (`claimantFor` in `server/characters/factions.js`) is the ruler's oldest free adult sibling by legal parents, else the first free adult in line, else the faction leader.

Measured over 300 years (Charlemagne seeds 777 and 321, Hadara seeds 321, 777 and 2): 72 children of an affair, 11 of them fathered by a man who ruled the realm, and none exposed. Exposure happens through the player's own actions, blackmail and a deathbed confession.

## Rulings

1. **A royal bastard.** A person who is the subject of an exposed `illegitimate_child` secret whose biological father (`holderIds[1]`) appears in `state.offices.ruler.history`. The child must be alive and must not be the sitting ruler. Sex does not matter, as with every other claimant.
2. **The claim.** `claimantFor` puts the eldest free adult royal bastard first, before the ruler's siblings. Ties go by id in numeric order, as `compareIds` in `factions.js` does.
3. **The grudge.** The yearly step gives every adult royal bastard an opinion cause "Förnekad arvsrätt" of −20 for 20 years towards the sitting ruler, unless the ruler is the bastard's own father. The cause id `claim:<secret id>:<ruler id>` keeps it to one per ruler. That discontent can bring the bastard into a faction like anyone else.
4. **Showing it.** An ultimatum names the claimant as "X, oäkta barn till Y".
5. **No draws, no version change.** The module reads and writes no random stream. Without an exposure nothing changes, so a run without one matches `main`. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. Saves need no migration.
6. **Module.** `server/characters/bastardClaims.js`, with a shim in `src/runtime/characters/`. The yearly step calls it beside `paternityStep`.

## Tests

`src/runtime/characters/bastardClaims.test.js`:

- An adult exposed child of the former ruler is the claimant over the ruler's sibling. A hidden one, a dead one, a child and one whose father never ruled is not.
- The yearly step gives the grudge once per ruler, and a new ruler gets a new one.
- The sitting ruler's own exposed child claims and bears its father no grudge.
- The ultimatum text names the bastardy (`claimLabel` here; the full story text in `factionUltimatum.test.js`).
- A 300-year run matches `main` (checked by script, outside the suite).

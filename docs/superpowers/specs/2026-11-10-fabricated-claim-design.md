# A fabricated claim on a neighbor's border land, pressed by war

Date: 10 November 2026. Phase 6, moment 26 of `2026-10-31-ai-game-master-design.md` ("The player fabricates a claim on a neighbor's province and goes to war for it."). Builds on `2026-11-10-foreign-realms-design.md` and `2026-11-10-marriage-alliance-design.md`. Owner mandate: continue without pause and decide by rulings.

## Problem

The player can marry into a neighboring house and answer an ally's call, but cannot start a war. The historical packages give each polity one map region, so a neighbor has no provinces to name.

## Rulings

1. **Historical campaigns only.** Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`.
2. **The border land.** The target of a claim is the neighbor's border land, shown as "Gränslandet mot <realm>". It is not a map region, and a conquest does not change the map or `world.wars`. Cost if wrong: the map keeps showing the old border after a won war.
3. **Fabricating the claim.** `fabricate_claim` is a public command: it needs the ruler's or a regent's mandate (`requireRule`) and is reserved under a regency. It costs 40 silver and one order from the state treasury. The payload names `realmId`, a neighbor (2,500 km or less) with no alliance, no claim and no war, and the realm holds fewer than three border lands taken from it. Only one claim is fabricated at a time. The realm records `claim = { since, readyAt, status: 'forging', exposed: false }`, with `readyAt` 24 months later.
4. **Exposure.** In the first yearly step on or after `readyAt` the claim becomes `ready`. With a chance of 25 %, rolled by `hashRoll` of the realm id and the claim's start, the forgery is exposed: the realm keeps the memory "Förfalskat anspråk" worth −30 for 20 years and the player's realm loses 5 prestige. An exposed claim can still be pressed.
5. **Declaring war.** `declare_war` is a public command, reserved under a regency, costing 60 silver and one order. The payload names a realm whose claim is `ready`; the player fights one war at a time. The realm records `war = { since, score: 0, battles: 0 }` and the memory "Krig om gränslandet" worth −30 for 20 years.
6. **Battles.** Each yearly step after the declaration fights one battle per war. The player wins with a chance of 0.3 + military readiness / 200 + 0.1 for each other realm allied with the player, held to 0.2…0.8, rolled by `hashRoll` of the realm id, the war's start and the date. A won battle adds 1 to the score and costs 5 army strength; a lost one subtracts 1 and costs 10.
7. **The end of the war.**
   - *Victory* at score +2: the claim and the war end, the realm's count of lost border lands (`lands`) rises by one, the player's realm gains 20 prestige and 10 legitimacy, and the realm keeps "Förlorat land" worth −50 for 50 years.
   - *Defeat* at score −2: the claim and the war end, the player's realm loses 10 prestige and 10 legitimacy and pays 50 silver in reparations, or what the treasury holds.
   - *Stalemate* after five battles: the claim and the war end and the player's realm loses 5 prestige.
   - *Peace by command:* `make_peace` (public, needs the mandate, allowed under a regency, costs one order and no silver) ends the war and the claim as a stalemate does.
8. **The land pays.** Each border land taken adds 10 silver a year to the realm's annual revenue while the player's realm lives.
9. **Neighbors and allies.** A realm with a claim or a war offers no marriage. A realm allied with the player cannot be the target of a claim.
10. **No draws, no version change.** Every roll is `hashRoll`; nothing draws from a stream. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.
11. **Saves.** A claim names valid dates, a status of `forging` or `ready` and a boolean `exposed`. A war names a valid date, an integer score from −1 to 1, a battle count from 0 to 4 and a ready claim. `lands` is an integer from 0 to 3. A save from before this change has none of these fields and loads unchanged.
12. **Shown to the player.** The neighbors list marks a claim being forged, a ready claim, a war with its score and the border lands taken. The action list offers the three commands with the eligible realms.
13. **Not in scope.** The foreign realm does not retake its land, start wars of its own or answer with an army of its own. Cost if wrong: a defeated neighbor never strikes back except through its memories, which moment 27 reads.

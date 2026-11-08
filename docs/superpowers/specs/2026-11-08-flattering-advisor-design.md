# A disloyal councillor flatters the odds

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings. Idea 9 of `docs/Featureförslag_Attainder_2026-11-08.md`.

## Problem

The council has hidden loyalty (`server/characters/council.js`), and the player reads it only through the spymaster. A disloyal councillor today lowers what the seat yields, but the player never has to doubt what the council tells them. The odds card (`estimateAction` in `server/characters/actionOdds.js`) shows the true band.

## Rulings

1. **Who advises.** When the player rules, the councillor whose area matches the action's main skill presents the odds: intrigue goes to the spymaster, diplomacy to the chancellor and prowess to the general. Other skills, a vacant seat, or a player who does not rule give no advisor. `ctx.advisor(entry)` in `actionContext` (`server/characters/index.js`) supplies the advisor; the NPC context sets it to null. `actionOdds.js` imports nothing from `council.js`, since `council.js` already imports `actionOdds.js`.
2. **Who flatters.** An advisor whose service (`serviceOf`) is below 30 (`opålitlig`) flatters. The odds card names the advisor whenever there is one ("Bedömt av Kansler Barek Eshmun"), so the name alone reveals nothing.
3. **What flattery does.** At the band precisions ('five' and 'three') the shown success band and the shown secrecy band each move one band up, and stop at the top band. At 'exact' the actor knows the craft well enough to see the true numbers, and nothing moves. The modifier rows stay as they are. The rolls use the true odds, so the outcome is the same as with a loyal advisor.
4. **What is recorded.** The estimate carries `flattery: { advisorId, officeId }` only when the player controls the action and a shown band differs from the true one. A resolution opened from such an estimate stores `flattery: { advisorId, officeId, revealed }`, and the action log validator checks that shape. Every other resolution keeps its present shape, so the hashes of runs without flattery stay.
5. **Who sees through it.** At `completeResolution` the flattery is revealed when a living spymaster holds the seat, is not the advisor, and reads loyalty at 'five' or 'exact' (`loyaltyPrecision`). A spymaster cannot reveal their own flattery. A refused order keeps `revealed: false`.
6. **The result card.** `presentResolution` shows the bands the player saw while the flattery is hidden, and the true bands once it is revealed, together with `flattery: { advisorName, officeName, shown: { success, secrecy } }`. The key is absent until then. The outcome card in `ActionBox.jsx` then names each band that moved: "Spionmästaren fann att kansler Barek Eshmun förskönade rådet. Chansen att lyckas var osäker (visad som trolig), chansen att hållas hemlig var osäker (visad som trolig)." A scheme judges its advisor on the due date, when the resolution opens.
7. **No draws.** No `random(state)` call is added. `rulesVersion` and `contentVersion` stay.

## Out of scope

Odds outside `estimateAction` (conversation requests, `chanceFromRows`), flattery by councillors who are only `motvillig`, and any effect on loyalty when the flattery is revealed.

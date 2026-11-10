# A marriage to the neighbor's daughter brings his war

Date: 10 November 2026. Phase 6, moment 7 of `2026-10-31-ai-game-master-design.md` ("A marriage to the neighbor's princess brings an ally whose father drags the player into his war."). Builds on `2026-11-10-foreign-realms-design.md`. Owner mandate: continue without pause and decide by rulings.

## Problem

`state.foreignRealms` gives each historical campaign up to eight neighbors with living ruling families, but the player cannot act on them. Marriages happen only inside the court (`marry`), and no foreign realm can ask anything of the player.

## Rulings

1. **Historical campaigns only.** Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`.
2. **The command.** `foreign_marriage` is a public command: it needs the ruler's or a regent's mandate (`requireRule`) and is reserved under a regency. It costs 30 silver and one order from the state treasury. The payload names `personId`, an unmarried living adult of the controlled family, and `partnerKey`, `<realmId>|<personId>` of a foreign person.
3. **Who can be offered.** A foreign person qualifies when alive, aged 16 or more, of the other sex, never married (no spouse ids, so no children), not the realm's ruler, and from a neighbor (2,500 km or less) that has no alliance with the player and an opinion of −20 or more.
4. **The bride or groom moves to court.** The foreign person leaves the realm's record and enters `state.people` as a generated adult of the spouse's family, with the same name, sex and birth date, the spouse's culture and faith, archetype diplomat and every skill at 5. The origin note says the person married in from that realm. The couple marries as `marry` does: spouse ids, a partner bond, +20 opinion each way and a marriage memory.
5. **The alliance.** The realm records `alliance = { since, personId, spouseId }` and a memory "Giftermål" worth +20 for 30 years. A save must name a married couple at court. The alliance lasts while both spouses live; when one dies it ends in the yearly step and the court log says so.
6. **The call to arms.** Each year an ally with no open call and none in the last five years goes to war with a chance of 15 %, rolled by `hashRoll` of the plot stream state, the date and the realm. The enemy is another realm of the list, chosen by the same kind of hash, or "rikets fiender" when the list has no other realm. No call opens while the controlled family lacks the ruler's or a regent's mandate. The court gets the story `call_to_arms`, answered by the realm's representative within six months.
7. **The answers.**
   - *Join the war:* 40 silver from the state treasury. The battle is won with a chance of 0.3 + military readiness / 200, held to 0.2…0.8, rolled by `hashRoll` of the story id and the stored plot state. A win gives +15 prestige, +5 legitimacy and the ally's memory "Stod vid vår sida" worth +15 for 20 years. A loss gives +5 prestige, −5 legitimacy, −10 army strength and the same memory worth +10.
   - *Refuse:* the alliance ends, the realm loses 10 prestige and the ally keeps the memory "Svek i kriget" worth −40 for 30 years. Moment 27 reads that memory.
   - *No answer within six months* counts as a refusal.
   The story closes without effect when the representative changes, the controlled family changes, the family loses the mandate or the alliance has ended.
8. **No draws, no version change.** Every roll is `hashRoll`; nothing draws from a stream. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.
9. **Shown to the player.** The neighbors list marks an ally. The action list offers the marriage with the eligible foreign persons, labelled with name, age and realm.
10. **Not in scope.** The war has no map effect and does not enter `world.wars`. Cost if wrong: the world model's own narrative may not mention the war.

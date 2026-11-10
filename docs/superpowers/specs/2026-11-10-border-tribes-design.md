# Border tribes that can be bribed, hired or crushed

Date: 10 November 2026. Phase 6, moment 24 of `2026-10-31-ai-game-master-design.md` ("Barbarian tribes on the border can be bribed, hired or crushed."). Builds on `2026-11-10-foreign-realms-design.md` and `2026-11-10-fabricated-claim-design.md`. Owner mandate: continue without pause and decide by rulings.

## Problem

The character engine knows the neighboring courts (`state.foreignRealms`) but no people without a court. The review files list such peoples as `cultural-or-nonstate` rows ("Slavonic tribes", "Magyars") with no game geometry and no Swedish name, and no package carries them. The moment asks for tribes on the border that the player can pay off, take into service or beat.

## Rulings

1. **Historical campaigns only.** Hadara gets no field and plays byte for byte as on `main`.
2. **The data.** The engine reads `historicalScenario.tribes`, a list of `{ id, nameSv, coordinates: [longitude, latitude], sourceIds }`. Codex researches the list (request in section 13 of `docs/development/CODEX-RESEARCH-BRIEF.md`); no shipped package carries it yet, so every shipped start seeds an empty list and plays as before. Copying the list from the review files into the packages is a later builder change with a content release. Cost if wrong: the moment stays dormant until that release.
3. **Seeded at creation.** `createHistoricalCharacterSystem` seeds `state.tribes` beside the foreign realms: the tribes within 2,500 km of the home seat, nearest first, at most six. An entry with a missing id, name or coordinate pair is skipped. Each tribe keeps `{ id, name, distanceKm, paidUntil, hiredUntil, crushedUntil, lastCampaign, lastRaid }`, the four dates `null` at the start. A historical save from before this change normalizes to an empty list.
4. **Raids.** In the yearly court step a tribe that is not paid, hired or crushed raids with a chance of 0.1, rolled by `hashRoll` of the plot stream state, the date and the tribe id. A raid takes 15 silver from the state treasury, or what it holds, and 2 legitimacy (held at 0). The court log says "Räd från <tribe>". The step returns its treasury delta for the year's accounts.
5. **Bribe.** `bribe_tribe` is a public command: it needs the ruler's or a regent's mandate and costs 20 silver and one order from the state treasury. It is allowed under a regency, since tribute defends the realm. The tribe raids no more for five years (`paidUntil`).
6. **Hire.** `hire_tribe` is a public command reserved under a regency, costing 30 silver and one order. The tribe's warriors serve the realm for three years (`hiredUntil`): they do not raid, and each hired tribe adds 0.1 to the chance of winning a battle in a war over a border land, as an ally does (`warChance`).
7. **Crush.** `crush_tribe` is a public command reserved under a regency, costing 50 silver and one order. One campaign per tribe in twelve months (`lastCampaign`). The campaign is won with a chance of 0.3 + military readiness / 200, held to 0.2…0.8, rolled by `hashRoll` of the tribe id and the date.
   - *Won:* the tribe raids no more for 30 years (`crushedUntil`), the realm gains 10 prestige and loses 5 army strength.
   - *Lost:* the realm loses 5 prestige and 10 army strength.
8. **Which tribes a command offers.** Bribe and hire offer a tribe that is not paid, hired or crushed. Crush offers a tribe that is not hired or crushed and has had no campaign in twelve months; a paid tribe can still be crushed.
9. **No draws, no version change.** Every roll is `hashRoll`; nothing moves a random stream. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.
10. **Saves.** `state.tribes` holds at most six entries with unique string ids, a string name, a finite or `null` distance and each date `null` or valid. Anything else fails with "Sparfilens gränsfolk är ogiltiga."
11. **Shown to the player.** The offices view lists the tribes under "Gränsfolk" below the neighbors: name, distance and state ("oroligt", "betalt till 805", "i rikets sold till 803", "slaget till 830"), and the year of the last raid. The action list offers the three commands with the eligible tribes. With no tribes, neither the list nor the commands appear.
12. **Not in scope.** Tribes do not move, grow, settle, convert or found realms, and they never enter `world.wars` or the map. A hired tribe does not fight in an ally's call to arms. Cost if wrong: a later moment adds those links once Codex's data shows which tribes matter.

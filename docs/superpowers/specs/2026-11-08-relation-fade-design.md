# Relations between the dead fade

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings. Third part of backlog 24, after the memory and condition fades.

## Problem

`state.relations` keeps every opinion record (`fromId:toId`, with bonds and opinion causes) after both persons have died. Charlemagne, seed 777: 292 relations (68 399 B) at year 300, and 239 of them join two dead persons. The opinion rules (`getPersonalOpinion`, `opinionReasons`, `chainContext.related`) are asked about the living: electors, regents, conversation partners, court appointments. `adjustEffect` in `actionResolution.js` looks up the relation that an action log opinion effect names.

## Rulings

1. **Which relations fade.** A relation fades when both `fromId` and `toId` are dead or missing from `state.people`, no action log opinion effect names the pair, and no other value in the state names one of its causes' ids.
2. **When.** `advanceCharacters` removes faded relations once per call, after the log cap, `fadeMemories` and `fadeDeadConditions`. No draw is taken, so `rulesVersion` stays. The replay diff records each removed key as a `remove` change.
3. **Kept.** Every relation with a living side, the widow's bond to a dead spouse among them.
4. **What the player loses.** A dead person's panel no longer lists personal connections to other dead persons. Kinship (parents, spouse) comes from the person records and stays.
5. **Out of scope.** Expired opinion causes on living relations, other dead-person fields, `stories`, `appliedCommandIds`.

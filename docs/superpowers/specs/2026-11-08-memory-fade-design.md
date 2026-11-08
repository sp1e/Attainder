# Health memories of the dead fade

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings. First part of backlog 24.

## Problem

`state.memories` grows without bound. Charlemagne, seed 777: 1 403 memories (347 721 B) at year 200 and 2 826 (707 193 B) at year 300, about a third of the state. Health memories (`health_onset`, `health_recovering`, `health_treatment`, `health_resolved`, `health_scars`, `bereavement`) are the largest group. Once every participant has died, nothing reads them: the person keeps the condition in `healthConditions`, conversations need a living speaker and representative, and the story director reads only the newest 1 000 memories.

## Rulings

1. **Which memories fade.** A memory fades when all four hold:
   - its type is one of the six health types above;
   - it lies outside the newest `STORY_MEMORY_WINDOW` (1 000) memories, the window `storyDirector.js` reads;
   - it has at least one participant, and every participant is dead or missing from `state.people`;
   - no other value in the state equals its id (a deep scan of every key except `memories`, plus every field of other memories except their own `id`).
2. **When.** `advanceCharacters` removes faded memories once per call, after the time step and the log cap. The scan must see the capped log: an uncapped log would protect a memory in one long step that monthly steps let fade. Commands and host transitions do not, so a death by command fades at the next time step. No draw is taken, so `rulesVersion` stays.
3. **Parity.** The story director reads `memories.slice(-STORY_MEMORY_WINDOW)`. Fading only removes entries older than that window, and windows only move forward, so the director sees the same memories as before. Conversations and the conversation brief filter on living participants and are unchanged. The presentation keeps every memory of a living person.
4. **What the player loses.** A dead person's panel and the chronicle's memory list no longer show health memories older than the window. The chronicle keeps births, marriages, deaths and successions, and the dead person's health record stays in `healthConditions`.
5. **Patches.** `diffCharacterState` gains the change `{ path, removeAt: [i, …] }` for a list of records with unique string ids where `after` equals `before` minus those indices, followed by new entries. Without it, removing an entry inside the list rewrites every later entry index by index. `patchCharacterData` removes the indices from the highest down, and `normalizeCharacterOps` accepts a strictly ascending list of non-negative integers.
6. **Out of scope.** Other memory types, `stories`, `appliedCommandIds`, compaction of dead persons' fields and relations to the dead (rest of backlog 24).

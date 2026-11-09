# Old settled stories fade

Date: 2026-11-09. Owner mandate: continue without pause and decide by rulings. Fifth part of backlog 24, after the memory, condition, relation and decision fades.

## Problem

`state.stories` keeps every story after it is resolved or closed. Karls rike, seed 777: 379 stories (209 602 B) at year 300. The presentation and the language model prompt show only `open` and `waiting` stories (`getCharacterPresentation`), and `resolve_story` accepts only an open story.

Some rules still read settled stories:

- `breakdownDue` counts a resolved `stress_crisis` of the actor created in the last 60 months (`CRISIS_MEMORY_MONTHS`). `breakdowns.js` also reads crises created on the current date.
- `getDirectedStoryCandidates` skips a cause memory that a resolved `character_event` already used (`usedCauses`). Candidate causes come from the newest 1 000 memories (`STORY_MEMORY_WINDOW`).
- Validation requires every `stepIds` entry of an event chain, every family demand's `storyId`, every faction's `storyId` and every `story_patronage` memory's `storyId` to name an existing story. Each of these names the story's id.
- `story_choice` and `family_demand` memories name their story in `causeId`.

## Rulings

1. **Which stories fade.** A story fades when four conditions hold:
   - its status is `resolved` or `closed`;
   - it was created more than 60 months ago (`CRISIS_MEMORY_MONTHS`);
   - its `causeId` is not among the newest 1 000 memories;
   - no other value in the state names its id (`citedIds`).
2. **When.** `advanceCharacters` calls `fadeAll` in `memoryFade.js` once per call, after the log cap. A command fades nothing. No draw is taken, so `rulesVersion` stays. The replay diff records the removed entries as a `removeAt` change.
3. **Kept.** Open and waiting stories. Event chain steps, family demand and faction ultimatum stories, and resolved character events stay while a record or memory names them.
4. **What the player loses.** Nothing on screen. No view lists settled stories.
5. **Out of scope.** `story_choice` memories, which keep 146 resolved character events at year 300. Event chain records, family demands and factions. `appliedCommandIds`.
6. **Fixpoint.** The fades chain: a faded story can be the last value that names a resolved condition. A single pass leaves that condition until the next call, so a 60-year jump and monthly steps end with different states. `fadeAll` runs the memory, condition, relation and story fades in rounds until a round removes nothing. Each round collects every fade's candidates and walks the state once for the ids they name. A round only removes, so the rounds end. The old exports (`fadeMemories`, `fadeDeadConditions`, `fadeDeadRelations`, `fadeSettledStories`) run one fade with its own walk.

## Measurement (2026-11-09, no player, 300 years)

| Run | Stories on main | Stories with the fade | Bytes on main | Bytes with the fade |
| --- | ---: | ---: | ---: | ---: |
| Karls rike, seed 777 | 379 | 247 | 209 602 | 144 759 |
| Karls rike, seed 321 | 352 | 259 | 199 384 | 151 664 |
| Hadara, seed 321 | 683 | 479 | 368 653 | 261 880 |

All three runs end with the same people, deaths, rulers, `rngState`, `plotRngState`, `healthRngState` and `state.sequence` as main. Timed back to back on one machine, the branch ran 3 to 6 % faster than main: 3 595, 3 443 and 8 691 ms against 3 827, 3 634 and 9 183 ms. The same pair of runs varies by 40 % between sessions, so only paired timings count.

## Tests

`src/runtime/characters/storyFade.test.js`: a time step removes the old settled stories that nothing names and keeps the open, young, cause-held, cited and waiting ones; a command fades nothing; the replay diff removes them by index; a resolved stress crisis inside the crisis memory stays; a resolved condition that only a faded story names fades in the same step. `storyDirector.test.js` keeps a long jump equal to monthly stepping over more than 60 years.

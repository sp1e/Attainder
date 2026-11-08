# Healed conditions of the dead fade

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings. Second part of backlog 24, after `2026-11-08-memory-fade-design.md`.

## Problem

Every dead person keeps the full `healthConditions` list. Charlemagne, seed 777: the 68 dead hold 251 conditions (113 861 B) at year 200, and 214 of them are `resolved`. Nothing reads a resolved condition of a dead person. The health rules iterate living persons, a portrait shows no state for a resolved condition (`conditionVisualState` returns null) and is frozen at death, and the incapacity rules skip the dead.

## Rulings

1. **Which conditions fade.** A condition fades when its owner has died, its stage is `resolved`, and no value in the state outside the condition itself names its id. The scan covers regency `causeConditionIds`, `health_care` stories (`conditionId`), death appearances and log entries.
2. **When.** `advanceCharacters` removes faded conditions once per call, after the log cap and `fadeMemories`. A dead person's resolved condition never gains a new citation, so one long step and many short ones remove the same conditions. No draw is taken, so `rulesVersion` stays. `healthSequence` keeps counting, so no id is reused.
3. **Kept.** Scarred conditions, conditions that were active or recovering at death, and every condition of a living person.
4. **What the player loses.** A dead person's panel no longer lists healed illnesses and griefs under `Hälsa och återhämtning`. Scars and the illness that was ongoing at death stay.
5. **Citation scan.** `fadeMemories` and the condition fade share one scan: a record never cites its own id, and any other string equal to a candidate id protects it.
6. **Out of scope.** Other dead-person fields (`historicalOrigin`, `lastDecision`, `deathAppearance`), relations to the dead, `stories`, `appliedCommandIds`.

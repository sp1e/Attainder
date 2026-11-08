# A dead person's last decision fades

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings. Fourth part of backlog 24, after the memory, condition and relation fades.

## Problem

`aiAnnual` writes `person.lastDecision` (choice, reasons, scores, date) for each adult who acts. The record stays after the person dies. Charlemagne, seed 777: the 143 dead persons carry 40 734 B of `lastDecision` at year 300.

Three places read the field, and none of them reads it for the dead:

- `evaluateCharacterDecision` adds 4 to the previous choice's score. It returns early unless `canExerciseMandate` holds, and `isAdultCharacter` is false once `diedAt` is set.
- `aiAnnual` writes the field for living adults only.
- `getCharacterPresentation` publishes it only for the active representative. `householdRepresentative` and `realmExecutive` return a person who can exercise a mandate, so the representative is alive.

## Rulings

1. **What fades.** `advanceCharacters` sets `lastDecision` to `null` on every person whose `diedAt` is set. The key stays, so the person record keeps the shape the seed and `election.js` give it.
2. **When.** Once per call, after the log cap and the other fades. No draw is taken, so `rulesVersion` stays. The replay diff records one `value: null` change per newly dead person.
3. **What the player loses.** Nothing on screen. The panel shows `lastDecision` only through the representative view.
4. **Out of scope.** `goal` (the dead panel shows its label), `deathAppearance` (the frozen portrait reads it), `skills` and `historicalOrigin` (validation and provenance tags read them), `stories`, `appliedCommandIds`.

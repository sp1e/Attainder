# Character log cap

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings.

## Problem

A character campaign saves its whole engine state (`src/runtime/characters/CONTRACT.md`). The state grows without bound. Measured on Charlemagne 1.3.0, court `carolingian-realm`, seed 777, one `advanceCharacters` call per year:

| Year | State | `log` (entries) | Dead persons |
|---|---|---|---|
| 50 | 255 940 B | 52 424 B (196) | 32 626 B |
| 100 | 578 976 B | 167 079 B (604) | 64 147 B |
| 150 | 1 047 705 B | 342 953 B (1 179) | 118 607 B |
| 200 | 1 643 602 B | 567 152 B (1 900) | 250 920 B |

`state.log` is the largest part, 35 % at year 200. The engine writes it in three places (`logEvent` and `emit` in `health.js`, and the foundation entry in `scenarioSeed.js`). Two places read it. `getCharacterPresentation` returns `state.log.filter((e) => e.public).slice(-120)`. `diffCharacterState` in `src/runtime/characterWorld.js` diffs the whole state, log included, into the replay and rollback patches (`characterOps`). No rule or prompt reads `state.log`; the runtime turns the returned `events` into world events.

## Rulings

1. **Cap.** After an accepted `executeCharacterCommand`, `advanceCharacters` or host transition (`applyRealmDissolution`, `reconcileExternalHosts`), the engine keeps the suffix of `state.log` that starts at the 120th public entry from the end (`keptCharacterLog`). A log with fewer than 120 public entries stays whole; one with exactly 120 loses only the private entries before the first public one. The presentation log stays identical, entry for entry. At year 200 the kept log is 38 284 B.
2. **One constant.** `CHARACTER_LOG_LIMIT = 120` replaces the literal in the presentation, so the cap and the view cannot drift apart.
3. **Private entries.** An entry with `public: false` (a quiet action outcome, `actionResolution.js`) is never read. The cap drops the private entries before the cut and keeps those after it. A log of private entries alone is never cut; the measured run logged 2 private entries in 1 900.
4. **Where.** The cap runs on the success path of these mutating exports only, where each one raises `revision`. `normalizeCharacterSystem` leaves the log as stored, so loading an old save changes nothing until its next accepted command or time step. Refusals, duplicates and no-op steps return the original state as today.
5. **Rules and versions.** No rule reads the log, so outcomes, random draws and `rulesVersion` stay as they are. Event ids come from `state.sequence` and keep counting.
6. **Replay patches.** `diffCharacterState` compared lists index by index, so a log that lost its oldest entries would rewrite each of the 120 kept ones in every patch (review finding). A list whose new version continues the old one after its first `n` entries now diffs as `{ path, drop: n }` followed by the usual append. `patchCharacterData` removes the first `n` entries, and `normalizeCharacterOps` accepts a positive integer `drop`. A patch with `drop` does not load in an older build, which refuses an unknown change.
7. **Out of scope.** `memories`, `stories`, `actionLog`, `appliedCommandIds` and dead persons stay whole. Rules read them: the story director reads the last 1 000 memories, event chains and conversations look up memories and stories by id, `mandateEpisodes.js` reads a dead person's `healthConditions`, and the character panel shows a dead person's health record and last decision. Trimming them needs its own design (backlog).

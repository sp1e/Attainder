# Restore points without the start and the licence texts

Date: 2026-11-09. Owner mandate: continue without pause and decide by rulings. Part of backlog row 12.

## Problem

A campaign keeps up to twelve restore points in `storage/snapshots.json` (desktop) or the game record's `snapshots` (web). Each holds a whole copy of the world before a turn (`captureRollbackSnapshot` in `src/Game/AI/gameplay.js`, `commitCharacterTransaction` in `src/runtime/characterPersistence.js`). On a historical start the world carries two keys that the campaign receives at its start and that no code changes in play:

- `componentLicenses`: the GPL, ODbL and Getty terms of the map components, with the source GeoJSON, about 1 MB.
- `historicalScenario`: the start's sources, chosen court seed, settlements and region review, 235 kB at AD 800 after the start keeps only the chosen court.

Measured on the four shipped starts with the chosen court only, a world is 1 009 282 to 1 451 121 B, and the same world without the two keys is 29 655 to 34 687 B. Twelve restore points carry 11.8 to 17.0 MB of copies.

## Rulings

1. **Which keys.** `STATIC_WORLD_KEYS` in `src/runtime/snapshotWorld.js`: `componentLicenses` and `historicalScenario`. Only `server/historicalPreparation.js` writes either, when a campaign starts.
2. **Storing.** `worldForSnapshot(world)` returns a shallow copy without the keys the world holds and names them in `snapshotOmittedKeys`. Both capture paths call it before cloning, so the large values are never copied.
3. **Restoring.** `worldFromSnapshot(snapshotWorld, liveWorld)` puts the named keys back from the live world, by reference, and drops the marker. A restore point from before this change has no marker and comes back as stored. A live world that lacks a named key makes it throw, before any document is written, so a rollback never writes a campaign without its start or its licences.
4. **Callers.** Every place that turns a restore point into a world takes the keys back from the live world: `rollBackToSnapshot` (the timeline's Undo and Intervene), the cheats menu's roll back, `recoverCharacterTransaction` (it now resolves the world before its first write and publishes the restored world), the reveal's staged world in `time.jsx`, `viewAsSeen` in `gameState.js` and the stats history in `stats.jsx`. The stats history logs a warning and reads the stored world when the live world cannot supply the keys.
5. **Licence terms.** Unchanged for every file that leaves the game. The live world keeps `componentLicenses` in full, so an exported game's `game.json` carries the terms and sources as before, and the zip's `licenses/` entries still come from the installed scenario. Restore points travel in a game zip as `snapshots.json` beside that world, and an import restores them against it.
6. **Out of scope.** The live world's own copy of `componentLicenses` (about 1 MB per campaign). Removing it needs a rebuild from the shipped package by id and hash at every export, and older package versions do not ship. It stays on backlog row 12.

## Tests

`src/runtime/snapshotWorld.test.js` covers storing, restoring, an old restore point, a refusal, and the real `captureRollbackSnapshot` run with its storage stubbed. `src/runtime/characterPersistence.test.js` covers a lean restore point at commit, a failed commit that restores the full world, recovery after an exit, and a recovery that refuses before writing.

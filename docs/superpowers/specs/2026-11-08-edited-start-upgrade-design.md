# Keep an edited start when a shipped upgrade replaces it

Date: 8 November 2026. Owner mandate: continue development without pause, decide by rulings. Backlog row 21.

## Problem

`upgradeShippedStart` replaces an installed copy of a shipped start when the package ships a newer `contentVersion`. Both stores keep the library fields (`withLibraryFields`: createdAt, playCount, countryNameOverrides and the rest) and take everything else from the package. A player who edited the start's world, game or briefing loses those edits without notice. The built-in Modern Day refresh also rewrites `scenario.json` from the seed, so the play count goes back to the seed's value.

## Rulings

1. **Keep a copy, do not ask.** Before an upgrade replaces an edited copy, the store keeps the edited copy as a new scenario, as the built-in refresh already does for an edited Modern Day. A boot-time question would need a dialog before the library loads and blocks the catalog. A kept copy loses nothing. Cost if wrong: one extra library entry, which the player can delete.
2. **Edited means changed content.** At install and at upgrade, the store records `shippedContentFingerprint` in the scenario meta: a hash of `JSON.stringify([world, game])` as stored. At upgrade, a copy whose current fingerprint differs counts as edited. Meta-only changes (name, cover, renamed countries) do not count: the upgrade keeps the library fields, and the name comes from the package. Normalized scenario meta keeps the field, so a rename or an editor apply leaves it in place. The desktop store writes the fingerprint after the whole bundle: a write cut short leaves the meta without one, and the next read replaces the copy again instead of keeping a half-written copy.
3. **Copies without a fingerprint.** A copy at an older version without a recorded fingerprint, installed before this change, counts as unedited, as today. The store cannot tell an edit from an earlier upgrade there, since both moved `updatedAt` past `createdAt`. Cost if wrong: such a copy's edits are lost once, as today. A copy at the current version without a fingerprint (installed before this change, or a write cut short after world.json and before the fingerprint) gets the shipped package's fingerprint on the next read, so an edit the player made before then counts at the next upgrade (review finding).
4. **The kept copy.** Id `<id>-edited`, made unique. The name is `<name> (din ändrade kopia)`, and a hero title gets the same suffix. The meta drops `shippedContentFingerprint`, `historicalSummary` and `hubOrigin`, and `createdAt` and `updatedAt` take the time of the upgrade. The copy goes right after the shipped start in the manifest order. The selection stays. The upgrade looks only at the scenario under the shipped id, so the copy is never upgraded.
5. **Campaigns.** Campaigns whose `scenarioId` is the shipped id move to the kept copy, as the built-in refresh moves them. They were started on the edited content, and each keeps its own world and game.
6. **Fingerprint.** `contentFingerprint(world, game)` in `server/historicalStarts.js`: FNV-1a over the JSON text, written as 16 hex digits, synchronous in both stores. The fingerprint detects edits. It does not authenticate content.
7. **Built-in play count.** The content refresh of the built-in scenario `default` (John 1200) keeps the installed `playCount` when it writes the seed's `scenario.json`, whether or not it kept an edited copy, as an upgraded shipped start keeps its library fields. The timestamps come from the seed, because `builtInMetaEdited` compares them. The kept copy carries the meta it had, play count included.
8. **Map and asset edits.** The fingerprint covers world and game. An edit of only the regions, cities, colours, flags or tags of a shipped start goes undetected, and an upgrade replaces it as today. Desktop map uploads mark the asset provenance in world, which the fingerprint sees.
9. **Crash during the copy.** The desktop store builds the kept copy outside the scenarios folder and moves it in whole, so a crash leaves no half copy in the catalog (review finding).
10. No package bytes change. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.

## Tests

- Desktop and web: an installed start with a fingerprint whose world the player edited is kept as `<id>-edited` with the edited world. Its campaigns move there. The shipped id holds the new release.
- An unedited copy with a fingerprint is replaced in place, with no copy.
- A copy without a fingerprint is replaced in place, as today.
- Install and upgrade both record the fingerprint of what they wrote.
- Desktop and web: the refresh of `default` keeps the play count.

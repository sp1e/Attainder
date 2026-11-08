# Adoption record

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings.

## Problem

Succession tells an adopted child from a child born into the house. A ruler's adoption does not marry the child's parents into the house (`docs/superpowers/specs/2026-11-08-married-in-succession-design.md`). Two rules find adoptions by scanning `state.memories` for `type: 'adoption'` (participants: adopter, child): `adoptedBy` in `election.js` and `adoptionPairs` in `succession.js`. Memories grow without bound (backlog 24), and a later cap on them would change who inherits. Succession should read a record it owns.

## Rulings

1. **Record.** The state holds `adoptions`, a list of `{ adopterId, childId, date }` in the order they happened. The `adopt` command appends one entry beside the memory and the log entry it writes today.
2. **Migration.** `ensureCharacterExtensions` creates `adoptions` when a state lacks it, from the adoption memories in order, each memory's date included. Every save, every new state, every command, time step and host transition passes through it, so `normalizeCharacterSystem` returns the same state twice. A memory without two participants yields no entry. A new state carries `adoptions: []`, so the state digests in `server/sharedCharacters.test.js` change; without that key they equal the old baselines.
3. **Readers.** `adoptedBy` and `adoptionPairs` read `state.adoptions`. Succession candidates and forecasts stay as before for every state, since the migrated record holds the same pairs the memories did.
4. **Validation.** Each entry is a plain object with two ids of persons in the state and a canonical date. A save that breaks this is refused with `Sparfilens adoptioner är ogiltiga.`
5. **Memories stay.** The adoption memory and the log entry remain for the story director and the chronicle. Nothing else changes, so `rulesVersion` stays and no draw moves.
6. **Out of scope.** Capping `memories` itself (backlog 24).

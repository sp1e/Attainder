# Development checkpoint: Phase 0 of the AI game master

Updated on 31 October 2026.

## Branch state

`claude/ai-game-master-design` was cut from `origin/main` at `728eaec` and holds six commits on top of it. The commits are not on `main`.

- `8ab75f8` adds the design in `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`.
- `dd787af` adds the Phase 0 and Phase 1 plans in `docs/superpowers/plans/`.
- `cf0d4f3` closes four save-validation holes in `validateEventChains`. A load now rejects a forged origin-memory cause, a step whose `familyId` differs from its chain, an outcome memory with emptied participants, and an outcome memory whose visibility or `knownBy` list was changed. Regression tests are in `src/runtime/characters/eventChains.test.js`.
- `26dc95e` tests rollback and journal recovery after a failed multi-document save in `src/runtime/characterPersistence.test.js`.
- `3c0004f` and `8fd0e73` add `src/runtime/characters/eventChainIntegration.test.js` with five tests: command payment and replay, exact subannual host interruption, same-date health and chain decisions, whole versus split advances, and insufficient funds.

## Verification at `8fd0e73`

- Full serial suite on 31 October 2026: 3,265 tests, 3,262 pass, 0 fail, 1 skipped, 2 todo, in 142 seconds. The baseline was 3,257 tests with 3,254 passing, so Phase 0 added 8 tests.
- ESLint on `src/runtime/characters` and `src/runtime/characterPersistence.test.js`: no errors.
- `npm run build`: exit code 0.

## Next step

Phase 1 follows `docs/superpowers/plans/2026-10-31-phase-1-foundation.md`. A player types an action in free text, reads the odds and their reasons, confirms, and sees a result that the engine rolled, applied and saved.

## Still open for event chains

Event chains are not yet released. `main` holds the unaccepted checkpoint from merge `728eaec`, and the README does not describe them. Phase 0 did not cover these checks:

1. Participant or mandate changes during a chain.
2. JSON advances.
3. More than 1,000 newer memories.
4. Immutable historical roles and story/source uniqueness.
5. The panel in both themes and narrow layouts, with one submitted public choice and one submitted private choice, each followed by a reload.

After these checks, run an independent quality review, update the README and `docs/design/event-chains.md` with the final evidence, and publish the accepted feature to `main`.

Two rules hold for every change. A normal read, validation or presentation call never chooses a branch, spends money or draws randomness. Model output never performs the player's chain choice.

The reference implementation is in `src/runtime/characters/eventChains.js`, data in `eventChainContent.js`, host integration in `src/runtime/characterWorld.js`, and UI in `src/Game/Characters/CharactersPanel.jsx`. `docs/design/event-chains.md` records the current contract and limits.

Use existing Claude Code/Codex CLI logins. Do not publish credentials, private campaign state or machine-specific QA reports. Install dependencies with `npm ci` and build with `npm run build`; generated dependencies and bundles are reproducible and intentionally ignored. Preserve upstream AGPL attribution. Public documentation is English; current game text and the historical research report are Swedish.

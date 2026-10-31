# Development checkpoint: Phase 1 of the AI game master

Updated on 31 October 2026.

## Branch state

`claude/ai-game-master-design` was cut from `origin/main` at `728eaec`. It holds Phase 0 and Phase 1, and none of its commits are on `main`. `git log 728eaec..HEAD` lists them.

- Design: `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`. Plans: `docs/superpowers/plans/`.
- Phase 0 (event chains): save-validation fixes in `validateEventChains`, rollback and journal tests, and `eventChainIntegration.test.js`.
- Phase 1, engine: the action catalog with `Påverka` and `Undergräv` (`actionCatalog.js`), bounded labelled odds with skill-based precision (`actionOdds.js`), two-roll resolution into five tiers on a separate `actionRngState` stream (`actionResolution.js`), multi-month schemes with monthly discovery checks (`schemes.js`), and on-demand minor court staff (`courtStaff.js`).
- Phase 1, model boundary: the gate for `realm_effect` and `npc_intent` proposals in `characterWorld.js`, and the low-effort `interpret` and `narrate` calls in `src/Game/Characters/characterModelCalls.js`. Both calls use `claude-sonnet-5-5` on the `claude-cli` provider at effort low. The year call keeps the player's model.
- Phase 1, panel: `ActionBox.jsx` (free text, confirmation card with odds, menu fallback, outcome card, scheme list with confirmed abort), the difficulty select on `DynastyStartCard.jsx` and in the scenario picker in `libraryBar.jsx`, and the footer counter `Modellanrop denna session`.
- The contract for all of this is `src/runtime/characters/CONTRACT.md`. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`; the new state is additive and versioned by `state.extensionsVersion = 1`. Old campaigns load as `Normal`.

## Verification at `b848d4a`

- Full serial suite on 31 October 2026: 3,540 tests, 3,537 pass, 0 fail, 1 skipped, 2 todo, in 127 seconds. The Phase 0 checkpoint had 3,265 tests, so Phase 1 added 275.
- `npm run lint`: 18 errors and 71 warnings on this branch, and the same 18 errors and 71 warnings on `origin/main`. Phase 1 adds no lint finding. The `origin/main` count came from an unpacked archive linted with this branch's installed plugins, because the archive has no `node_modules`.
- `npm run build`: exit code 0.

## Next step

Run the manual check in `docs/play-scripts/phase-1.md` against a live model. It covers the parts that unit tests cannot: the model reading a Swedish sentence, the odds card in the real panel, a reload, a scheme resolving in a model year, the menu with no model, and loading a save from before Phase 1. Record pass or fail per part in this file.

After the play script passes, run an independent whole-branch review, then merge to `main`.

## Still open

Event chains and Phase 1 are not yet released. `main` holds the unaccepted checkpoint from merge `728eaec`, and the README describes Phase 1 only on this branch. Phase 0 did not cover these checks:

1. Participant or mandate changes during a chain.
2. JSON advances: an integration test that saves a chain to JSON between two `advanceCharacters` calls.
3. More than 1,000 newer memories through `advanceCharacters`.
4. Immutable historical roles and story/source uniqueness.
5. The panel in both themes and narrow layouts, with one submitted public choice and one submitted private choice, each followed by a reload.

Phase 1 leaves these for later: the `murder` secret stores a crime but its exposure effects arrive with the murder action in Phase 2; only two contested actions exist; the play script has not been run by a person yet.

Two rules hold for every change. A normal read, validation or presentation call never chooses a branch, spends money or draws randomness. Model output never performs the player's decision: it reaches the save only through a command, and replay never calls the model.

The reference implementation for chains is in `src/runtime/characters/eventChains.js`, with data in `eventChainContent.js` and host integration in `src/runtime/characterWorld.js`. `docs/design/event-chains.md` records the current contract and limits.

Use existing Claude Code/Codex CLI logins. Do not publish credentials, private campaign state or machine-specific QA reports. Install dependencies with `npm ci` and build with `npm run build`; generated dependencies and bundles are reproducible and intentionally ignored. Preserve upstream AGPL attribution. Public documentation is English; current game text and the historical research report are Swedish.

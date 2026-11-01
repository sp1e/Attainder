# Development checkpoint: Phase 2 of the AI game master

Updated on 1 November 2026.

## Branch state

`phase-2/intrigue` was cut from `origin/main` at `2d1279a`, which already holds Phase 0 and Phase 1. None of the Phase 2 commits are on `main`. `git log 2d1279a..HEAD` lists them.

- Design: `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`. Plans: `docs/superpowers/plans/`, with `2026-10-31-phase-2-intrigue.md` for this phase.
- Phase 0 (event chains): save-validation fixes in `validateEventChains`, rollback and journal tests, and `eventChainIntegration.test.js`.
- Phase 1: the action catalog with `Påverka` and `Undergräv`, labelled odds with skill-based precision, two-roll resolution into five tiers, multi-month schemes, on-demand court staff, the `realm_effect` and `npc_intent` gate, the low-effort `interpret` and `narrate` calls, and the `Handla själv` card. Details are in `docs/play-scripts/phase-1.md` and the contract.
- Phase 2, engine: extensions version 2 with the plot stream `state.plotRngState` and the vacant `Spionmästare` office (`extensions.js`); secrets, grips and crimes (`secrets.js`, `crimes.js`); feasts (`occasions.js`); five more contested actions, `Förgifta`, `Snoka`, `Utpressa`, `Sprida rykte` and `Fängsla` (`actionCatalog.js`, `actionOdds.js`, `actionResolution.js`); prisoners, ransom offers and revolt preparations (`prisoners.js`); rumors heard by the spymaster (`rumors.js`); yearly NPC plots, feuds and affairs, and the `plot_uncovered` decision (`npcPlots.js`); court conversations (`conversation.js`).
- Phase 2, model boundary: the `extract_conversation_request` and `reply_as_character` calls, the `converse_request` command that only `submitConversationRequest` can send, and the Phase 2 facts in the year prompt (`characterModelCalls.js`, `characterWorld.js`). Rumor truth and an estimate's true values never reach a prompt.
- Phase 2, panel: the `Intriger` tab (`IntrigueView.jsx`), `Samtala` and the conversation card (`ConversationView.jsx`), the feast card in `Överblick`, and the prisoner and plot decisions in `Beslut`.
- The contract for all of this is `src/runtime/characters/CONTRACT.md`. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`; `state.extensionsVersion` is 2, and a version 1 save migrates additively on load. Old campaigns load as `Normal`.
- The yearly auto-fill of vacant offices skips `Spionmästare`. Filling it would shift the main random stream and change existing dynasty tests, so the ruler appoints it. A realm run by NPCs has no spymaster.
- Command sequence: on-demand court staff, secrets, hooks, occasions, prisoners, rumors and conversations take ids from `state.sequence`, so the text-sorted person order can differ from a pre-Phase 1 run of the same save. Replay uses stored patches, so no saved campaign changes. Numeric sorts would change `annualStep` randomness order and are left for a `rulesVersion` bump.

## Verification

- Full serial suite on 1 November 2026: 3,790 tests, 3,787 pass, 0 fail, 1 skipped, 2 todo, in 207 seconds. Phase 1 ended at 3,543 tests, so Phase 2 added 247. A later run of the same command after a rename of one import showed one failure, an `EPERM` rename in `server/payloadUpdate.test.js`, a known Windows flake; that file passed 17 of 17 when run alone.
- `npm run lint`: 18 errors and 71 warnings, the same as `origin/main`. Phase 2 adds no lint finding. An earlier run showed 20 errors, because the name `useHook` in `secrets.js` made the React hooks rule fire in `actionResolution.js` and `conversation.js`; both files now import it as `consumeHook`.
- `npm run build`: exit code 0.

## Next step

Run the manual checks in `docs/play-scripts/phase-1.md` and `docs/play-scripts/phase-2.md` against a live model, and record pass or fail per part in this file. They cover what unit tests cannot: the model reading a Swedish sentence, the odds card with the feast rows, a poisoning that resolves in a model year, a conversation that ends in a roll and an in-character reply, a plot against the ruler, a ransom offer, and the message for a name that is not in the game.

After the play scripts pass, run an independent whole-branch review, then merge to `main`.

## Known Phase 2 limitations

- A player can infer that a rumor is fabricated. A rumor about `Otrohet` or `Oäkta börd` can only come from `Sprida rykte`, and one without a claimant is shown as `osäker`.
- Schemes that NPCs start on their own intent (the model's `npc_intent`) carry no `secretId`, so seeing through one opens no `Komplott avslöjad` decision.
- After a conversation request has been decided, closing the conversation with `Avsluta samtalet` leaves keyboard focus on the page body instead of the `Samtala` button.

## Still open

Event chains, Phase 1 and Phase 2 are not yet released. Phase 0 did not cover these checks:

1. Participant or mandate changes during a chain.
2. JSON advances: an integration test that saves a chain to JSON between two `advanceCharacters` calls.
3. More than 1,000 newer memories through `advanceCharacters`.
4. Immutable historical roles and story/source uniqueness.
5. The panel in both themes and narrow layouts, with one submitted public choice and one submitted private choice, each followed by a reload.

The play scripts have not been run by a person yet.

Two rules hold for every change. A normal read, validation or presentation call never chooses a branch, spends money or draws randomness. Model output never performs the player's decision: it reaches the save only through a command, and replay never calls the model.

The reference implementation for chains is in `src/runtime/characters/eventChains.js`, with data in `eventChainContent.js` and host integration in `src/runtime/characterWorld.js`. `docs/design/event-chains.md` records the current contract and limits.

Use existing Claude Code/Codex CLI logins. Do not publish credentials, private campaign state or machine-specific QA reports. Install dependencies with `npm ci` and build with `npm run build`; generated dependencies and bundles are reproducible and intentionally ignored. Preserve upstream AGPL attribution. Public documentation is English; current game text and the historical research report are Swedish.

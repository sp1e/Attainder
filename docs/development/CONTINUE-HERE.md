# Development checkpoint: Phase 2 of the AI game master

Updated on 4 November 2026.

## Branch state

Phases 0, 1 and 2 are on `main`. PR #4 squash-merged Phase 2 as `ef0ab7c` on 3 November 2026, and `phase-2/intrigue` keeps its 28 individual commits. Development moved to the owner's private desktop on 4 November 2026. Campaign saves from the earlier computer stayed there.

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

- Fresh clone on 4 November 2026, Node 24, with the Claude Code detection fix: 3,812 tests, 3,809 pass, 0 fail, 1 skipped, 2 todo, in 91 seconds. `npm run lint`: 18 errors and 71 warnings, unchanged. `npm run build`: exit code 0.
- Live smoke check on the same day: Claude Code read `Jag försöker vinna Namars stöd med gåvor och smicker` in one model call, and the game showed the odds card for `Påverka` against Namar. I cancelled the action, so nothing resolved. The browser console showed no errors once the map files were in place. This check covers one card of Part 3 in the Phase 1 play script.
- Full serial suite on 3 November 2026 at commit `ce1e63e`, after the final review fixes: 3,811 tests, 3,808 pass, 0 fail, 1 skipped, 2 todo, in 172 seconds. Phase 1 ended at 3,543 tests, so Phase 2 added 268. `server/payloadUpdate.test.js` can fail on Windows with an `EPERM` rename; it passed in this run.
- `npm run lint`: 18 errors and 71 warnings, the same as `origin/main`. Phase 2 adds no lint finding. An earlier run showed 20 errors, because the name `useHook` in `secrets.js` made the React hooks rule fire in `actionResolution.js` and `conversation.js`; both files now import it as `consumeHook`.
- `npm run build`: exit code 0.

## Next step

Run the manual checks in `docs/play-scripts/phase-1.md` and `docs/play-scripts/phase-2.md` against a live model, and record pass or fail per part in this file. They cover what unit tests cannot: the model reading a Swedish sentence, the odds card with the feast rows, a poisoning that resolves in a model year, a conversation that ends in a roll and an in-character reply, a plot against the ruler, a ransom offer, and the message for a name that is not in the game.

Phase 2 reached `main` before these checks ran. After the play scripts pass, run an independent review of Phase 2 as merged, then write the Phase 3 plan (court and power) in `docs/superpowers/plans/`.

## Known Phase 2 limitations

- A player can infer that a rumor is fabricated. A rumor about `Otrohet` or `Oäkta börd` can only come from `Sprida rykte`, and one without a claimant is shown as `osäker`.

## Still open

Event chains, Phase 1 and Phase 2 are not yet played through. Phase 0 did not cover these checks:

1. Participant or mandate changes during a chain.
2. JSON advances: an integration test that saves a chain to JSON between two `advanceCharacters` calls.
3. More than 1,000 newer memories through `advanceCharacters`.
4. Immutable historical roles and story/source uniqueness.
5. The panel in both themes and narrow layouts, with one submitted public choice and one submitted private choice, each followed by a reload.

The play scripts have not been run by a person yet.

Two rules hold for every change. A normal read, validation or presentation call never chooses a branch, spends money or draws randomness. Model output never performs the player's decision: it reaches the save only through a command, and replay never calls the model.

The reference implementation for chains is in `src/runtime/characters/eventChains.js`, with data in `eventChainContent.js` and host integration in `src/runtime/characterWorld.js`. `docs/design/event-chains.md` records the current contract and limits.

Use existing Claude Code/Codex CLI logins. Do not publish credentials, private campaign state or machine-specific QA reports. Install dependencies with `npm ci`, fetch the map files with `node scripts/fetch-map-assets.mjs --ensure` and build with `npm run build`; generated dependencies, map files and bundles are reproducible and intentionally ignored. Preserve upstream AGPL attribution. Public documentation is English; current game text and the historical research report are Swedish.

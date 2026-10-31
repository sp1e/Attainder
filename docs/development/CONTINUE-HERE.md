# Development checkpoint: event chains

Saved on 31 October 2026 at the owner's request to preserve work before the weekly token allowance runs out.

## Published baseline

`main` commit `c49da0450dfa50a0925953f784cc2c03a958fd50` contains the reviewed adult-incapacity integration and the requested `research.html`. The full serial suite passed 3,197 tests, with no failures, one skip and two TODOs. Production build and isolated incapacity browser/persistence checks passed. The research report includes portable links, an archive notice, keyboard theme controls and verified light/dark layouts.

## Work preserved on the checkpoint branch

`codex/event-chains-checkpoint` preserves the next feature before final acceptance. It adds eight original event chains with 32 stages, causal memories, prior-choice flags, scheduled continuation, typed effects, separate family/public payers and a free close option. The character engine, host calendar and model horizon now recognize these chains. The character panel shows the current step, prior decisions, actual decision actors and waiting/completed history.

Current verification: 252 character/core/world tests pass, including eight new lifecycle tests and 44 content checks. The updated panel's 17 render tests and focused lint pass. These are separate from the baseline full-suite result. The event integration has not yet passed independent specification review, adversarial integration/persistence review, a new production build or browser acceptance. Do not describe this checkpoint as the final event release.

An independent review reproduced malformed-save acceptance in `validateEventChains`: changing an origin memory's `causeId` to a nonexistent source, changing a step's `familyId`, emptying outcome-memory participants, or changing its visibility to private can each pass `normalizeCharacterSystem`. Fix these causal/ownership/visibility checks and add regression coverage before final acceptance. The review did not change code. These findings are preserved here because the owner requested synchronization followed by a development pause.

## Resume in this order

1. Verify checkout, HEAD, remotes and working-tree ownership. Preserve any later work. Main owns architecture, engine changes, integration and Git publication. Worker 1 and Worker 2 have bounded UI/content/test/review roles.
2. Finish integration tests for `eventChains.js`: actual command payments and replay, exact subannual host interruption, same-date health/chain decisions, participant or mandate changes, insufficient funds, forged save references, whole/split/JSON advances and more than 1,000 newer memories. Test interrupted multi-document saving and recovery using `characterPersistence.js` without real campaigns.
3. Inspect event save validation, immutable historical roles, story/source uniqueness and calendar ordering. A normal read must not choose a branch, spend money or draw randomness. Model output must never perform the player's chain choice.
4. Run fresh specification review, then independent quality review. Main fixes findings and requests a focused recheck. Test the actual panel in both themes and narrow layouts, including a submitted public and private choice followed by reload.
5. Run the affected tests, full serial suite, lint and production build. Update the README and event contract with the actual final evidence. Only then publish the accepted feature to `main`; keep intermediate checkpoints on the checkpoint branch.

The reference implementation is in `src/runtime/characters/eventChains.js`, data in `eventChainContent.js`, host integration in `src/runtime/characterWorld.js`, and UI in `src/Game/Characters/CharactersPanel.jsx`. `docs/design/event-chains.md` records the current contract and limits.

Use existing Claude Code/Codex CLI logins. Do not publish credentials, private campaign state or machine-specific QA reports. Install dependencies with `npm ci` and build with `npm run build`; generated dependencies and bundles are reproducible and intentionally ignored. Preserve upstream AGPL attribution. Public documentation is English; current game text and the historical research report are Swedish.

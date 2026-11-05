# Phase 3 review follow-up

## Goal

Close the two findings left by the Phase 3 whole-branch review before running the browser play script. The machine-local handover records that review as complete, including an 18-seed, 50-year JSON round-trip probe. Reproduce each finding before changing production code.

**Spec:** `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`, sections 3, 4, 9 and 10; `src/runtime/characters/CONTRACT.md`; the Phase 3 plan's Review Focus.

## Global Constraints

- `rulesVersion` and `contentVersion` stay `'hadara-1.0.0'`. `EXTENSIONS_VERSION` stays `3`.
- All randomness comes from saved streams. Do not change the order of `random(state)` draws in `annualStep`, and never add a draw to `state.rngState`.
- `courtAnnualStep` runs after `npcPlotStep`.
- Whole-year and split-date advances stay identical. Migration, estimates, presentations, prompts and validation draw nothing and spend nothing. Replay never calls the model.
- Hidden values never reach `getCharacterPresentation` or a prompt: `person.loyalty`, faction members outside `knownMemberIds`, and an undiscovered faction's existence. Loyalty readings retain their existing precision limits.
- Player text is Swedish with å, ä and ö. Comments and docs are English. Refusals are one Swedish sentence.
- New systems live in their own modules. Change `index.js` only at relevant hook points. Preserve existing gameplay outcomes and tuned balance unless a reproduced defect requires a change.
- No credentials, account sessions, real campaign saves, private reports or machine-specific paths enter tracked files. Preserve AGPL and upstream notices.
- Use tests first for behavioural fixes. Use author `sp1e` and the existing project commit email. Add no Claude attribution to Codex commits.

## Rulings

- Ruling: use an isolated clone in the current workspace because the app's managed worktree tool rejects the selected source outside this chat's workspace; preserve the original checkout and its local files. If wrong, the owner maintains a second checkout until this work is merged.
- Ruling: treat the machine-local review result as the latest evidence, so address its findings rather than repeat the completed broad review. If wrong, the final review and browser run may uncover another defect.
- Ruling: inspect the existing code before acting on deferred minors; the current main already excludes self and ruler rewards. If wrong, a regression test added during later maintenance will expose the gap.
- Ruling: a ruler-dependent reign mismatch remains invalid in a current-version save; any compatibility fix must handle the legacy replay boundary without weakening validation. If wrong, an older legitimate save needs a separate migration path.

## Review Focus

1. Annual treasury reporting includes the chancellor's contribution without exposing a separate numeric service or loyalty field; no unexplained chancellor residual remains outside the accounting log.
2. The payment still occurs after loyalty drift, once per annual court step, and uses the same treasury clamps and rounding.
3. A pre-Phase-3 timeline that crosses a succession can be viewed and resumed; forged current-version reign/office mismatches remain rejected.
4. Fixes preserve serialized saves, stored replay patches, and all saved random streams.

### Task 1: Account for the chancellor's annual contribution

**Files:** `src/runtime/characters/council.js`, `court.js`, `index.js`, `council.test.js`; add focused accounting tests in an adjacent existing test file if needed.

Reproduce the confirmed finding: `chancellorStep` changes the treasury after the year event reports only base revenue. With stewardship 4 and service equal to loyalty, different loyalty values leave a residual outside the logged revenue. Write a regression test that fails before the fix.

Include the contribution in the year's aggregate accounting, using the actual amount paid after clamping and rounding. Keep it part of the aggregate; expose no standalone contribution, service score or raw loyalty in presentation, the prompt or public events. Preserve the court step's ordering after NPC plots, loyalty drift before yield, deterministic streams, and actual gameplay payments. Preserve the event's existing position if feasible; make any ordering decision explicit in the task report. Avoid a new persisted field just for logging.

Cover positive and negative yields, a vacant seat, and a treasury at its floor. Cover JSON round trip and whole versus split advance for the changed path. Inspect public presentation and prompt fields for an added leakage route. Existing balance assertions retain their meaning.

Run focused council and related court tests during development. Before committing run the full serial suite: `node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"`. Record the RED and GREEN evidence, changed files, test counts and self-review in the task report. Commit only this task's changes, then push through the established process-local GitHub identity, verifying the remote branch SHA. If Git writes require a permission grant, report the exact failing command to the controller so work can proceed without an interactive pause.

### Task 2: Verify legacy replay across succession

**Files:** relevant existing tests under `src/runtime/`, `src/runtime/characters/extensions.js`, `reign.js`, and the replay adapter only if the reproduction requires it.

Reproduce the plausible finding with a synthetic pre-Phase-3 campaign snapshot and stored timeline patches that cross a succession during a partially revealed turn. Follow the actual `viewAsSeen` and character normalization path. Use no personal campaign files. If it fails, write the failing integration regression before fixing the smallest responsible migration/replay boundary. If it does not fail, keep a meaningful passing regression and report the exact setup and result rather than inventing a production fix.

Require old saves to load, preserve the historical ruler when viewing a checkpoint, and allow the current campaign to resume. Keep current-version forged reign/office mismatches rejected. Migration stays additive and idempotent, consumes no random draw, and does not rewrite a stored outcome into a newly rolled one.

Run focused replay and migration tests. Before committing run the full serial suite. Record RED/GREEN evidence if a fix is needed, or the verified non-reproduction when no production change is justified. Commit only task files and push with the established identity; verify the remote branch SHA. Put the full report beside the task brief.

### Task 3: Record the reviewed state and measurements

**Files:** `docs/development/CODEX-HANDOVER.md`, `docs/development/CONTINUE-HERE.md`, `src/runtime/characters/CONTRACT.md` if changed behaviour requires clarification.

Update the handover and checkpoint to reflect the completed Phase 3 review and its reproduced findings, fixes, test counts and remaining browser verification. State the exact tested commit and any unresolved limitation. Keep earlier measured history. Record each ruling needed by Tasks 1 and 2. Do not claim the Phase 3 browser script passed before it runs. Avoid machine-specific paths or private reports.

Use English documentation and the installed editorial rules. This is documentation work; no new tests are needed. Verify the descriptions against the preceding task reports, inspect the diff, commit and push the documentation. The controller then runs the build, compares lint with the inherited baseline, requests the whole-branch review, and opens/merges the PR only after the review and required CI pass. Continue with the browser play script and remaining handover queue after this plan completes.

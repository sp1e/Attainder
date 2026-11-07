# Codex handover

**Research split from 7 November 2026:** Codex does all historical research and Claude writes all code. Read `docs/development/CODEX-RESEARCH-BRIEF.md` first; it replaces the work queue below while the split lasts.

Written by Claude on 5 November 2026 at `main` = `b655e2b`. Codex develops Attainder on the owner's private desktop until the owner's weekly Claude tokens reset. Read this file from top to bottom before you change anything.

**Updated by Claude on 7 November 2026.** The owner decided that every culture of the world within the period becomes playable and that new starts run through **AD 1530**. Phase 1 of `docs/superpowers/specs/2026-11-07-world-cultures-design.md` merged to `main` in PR #22: several playable polities per package, Kyrkostaten at AD 800, validator rules for generated people and start-time refusals, the 1530 range, upgrades of installed shipped starts and catalog-driven tests. Phase 2 merged to `main` in PR #27: a searchable start card by region and era, start summaries in library meta, one web module per package, saves that keep only the chosen court and a ranked prompt polity list. A new playable polity needs a region in `server/seed/historical/polity-regions.json`, or `node scripts/check-polity-regions.mjs --check` fails. `docs/development/CONTINUE-HERE.md` holds the evidence and limits. Phase 3 merged to `main` in PR #30: every `ready` court dossier is playable (ten polities in Charlemagne 1.2.0, four in John 1.1.0), built by `server/seed/historical/dossier-courts.mjs` from the dossier files. A dossier edit changes the hashed authored inputs, so Claude rebuilds and refreshes provenance before it ships. Phase 4 is built on `feature/world-cultures-phase-4`: the package `world-1500` makes the two `ready` AD 1500 courts playable (Aztekriket and Inkariket). Ming and the Ottoman Empire wait for reviewed geometry; a reviewed shape plus a `ready` dossier entry is all Claude needs to add them. Next: Phase 5, engine depth.

Updated by Codex on 5 November 2026: [PR #12](https://github.com/sp1e/Attainder/pull/12) merged the Phase 3 review fixes after the final branch review and required test/build CI passed. The remote `main` commit was verified as `6f4f7c0de84ea58010e5ea597ff0325f572ea4eb`; the retained remote branch `fix/phase-3-review` ends at `55283dc`. The historical campaign foundation was implemented on `codex/historical-campaign-foundation`. Tasks 1–5 are accepted through `1addf27`; Task 5 integrated historical defaults, start guards, save restoration and UI, and its blocking reviews are closed. Task 6 and final documentation review are accepted with documented limits; final review approved publication subject to current-head CI. The [play script](../play-scripts/historical-foundation.md) records observed results and remaining checks. The scoped review accepted the second browser-fix round and the polar-render repairs, most recently at `2066a55`. [PR #13](https://github.com/sp1e/Attainder/pull/13) tracks the branch and its merge state. [CI run 42102593161](https://github.com/sp1e/Attainder/actions/runs/42102593161) passed 4,654 tests, with no failures and two TODOs; the build passed. The current PR head must pass CI before merge. The annual 4,500-year research and turn-end popup remain separate pending work.

**On this computer, read `HANDOVER.local.md` in the repository root next.** Git ignores it. It holds the machine-specific paths this public repository must not contain: where the newer Codex lives, the writing rules, the Swedish character sweep and the cleanup list.

Reading order after that:

1. `AGENTS.md`: repository rules. They outrank this file.
2. `docs/development/CONTINUE-HERE.md`: the checkpoint, with every earlier measurement and play-script result.
3. `src/runtime/characters/CONTRACT.md`: the rules engine contract.
4. `docs/superpowers/specs/2026-11-05-historical-world-direction.md` and `docs/development/DEVELOPMENT-BACKLOG.md`: the owner's current setting, research and gameplay requirements.
5. `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`: character and AI design, subject to the newer setting direction. Section 9 lists the phases, section 10 the constraints, section 12 the calls Claude made for the owner to check, and the end of the spec the 29 moments.
6. `docs/development/phase-3-decisions.md`: every Phase 3 ruling and deferred minor.

## Mandate

The owner said on 4 November 2026: continue development without pausing and without asking, until the game is finished or the tokens run out. The owner turns the screen off and leaves the computer running, so a question stops work for hours.

- Decide, write the decision down, and keep going. A ruling has the form `Ruling: <what> — <why> — <what it costs if wrong>`.
- Merge to `main` when CI is green and you have read the diff. Do not ask first. Push every commit straight after you make it.
- Stop and leave a note in `CONTINUE-HERE.md` for four things only: an irreversible or destructive operation, a security-sensitive action, a merge conflict in handwritten code with two reasonable outcomes, and a plan so broken that every path forward is a guess.
- The mandate changes no security rule, no secret rule and nothing in `AGENTS.md`.
- Never force-push `main`. On your own branch use `--force-with-lease`.

## State of the game

| Phase | Content | State |
|---|---|---|
| 0 | Stable base | Merged. One panel check open (work item 6) |
| 1 | Free-text actions, odds, schemes, model gate | Merged. Play script passed |
| 2 | Intrigue, moments 1 to 4, 28, 29 | Merged. Play script passed |
| 3 | Court and power, moments 11 to 17 | Merged as `9a780f7` (PR #9). Review fixes merged as `6f4f7c0` (PR #12); final branch review and required CI passed. Original browser script deferred |
| 4 | Family and succession, moments 5, 6, 8, 9, 10 | Not started. No plan |
| 5 | Events and life, moments 20 to 23 | Not started. No plan |
| 6 | World, diplomacy and war, moments 7, 24 to 27 | Not started. No plan |
| 7 | Religion, moments 18, 19 | Not started. No plan |

13 of 29 moments are built. Phases 0 and 1 carry no moments of their own.

Latest full local serial measurement, before the polar-render fix, at `7b62791`: 4,647 total, 4,644 pass, 0 fail, 1 skipped and 2 TODO in 228,052.191 ms. Scoped review approved the unresolved-scenario fixes; the commit was pushed and the remote SHA verified. Earlier Task 5 measurements: the full serial suite at `c7c6dbc` ran 4,625 tests, with 4,622 pass, 0 fail, 1 skipped and 2 todo, in 179,246.1685 ms. The final fix at `1addf27` passed 27 focused tests in 53,692.0687 ms and targeted lint. Desktop and web builds passed in 30.69 and 33.32 seconds. The full lint run reported 18 errors and 71 warnings, matching the earlier aggregate; build warnings remain. The generator check and map asset ensure passed. The earlier Phase 3 baseline at `cfa225238c5065441e4642481ab507629e498e73` had 4,410 tests and retained 18 lint errors and 71 warnings in the full lint run. The required test/build check passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295). The deferred browser checks remain open.

Earlier measurements: `npm test` at `1698e61` gave 4,370 pass, 0 fail. The runtime suite at `62c7bd4` gave 2,280 of 2,280. Panel tests at `054d46a` gave 106 of 106. CI `test` passed on PRs #9 and #10.

Phase 3 task 12 was cut short because the token limit was close. Tasks 1 to 10 each passed their own review. The documentation part of tasks 11 and 12 landed in PR #10. Codex completed the review follow-up described below. The original browser run has not happened.

## Work queue

Do these in order.

### 1. Completed: publish the Phase 3 review follow-up

The whole-branch review of `e735a5b..9a780f7` found two reproduced issues. Both have fixes, regressions and approved task reviews. The final follow-up review of `08d3518..55283dc` approved the branch with no new Critical, Important or Minor findings. The required test/build check passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295). [PR #12](https://github.com/sp1e/Attainder/pull/12) merged the fixes, and the remote `main` commit was verified as `6f4f7c0de84ea58010e5ea597ff0325f572ea4eb`. See "Phase 3 review status" below for the rulings and measurements.

Retain these review checks for future changes:

- Hidden information: hidden faction members, unknown secrets, true loyalty beyond the spymaster's precision and rumor truth never reach `getCharacterPresentation` or a prompt.
- Every state a Phase 3 path writes passes `validate*` after a JSON round trip: mid-ultimatum, after a crush, after forced abdication, after dissolution.
- The acting person versus the ruler: regents, guardians, NPC rulers in family mode, incapacity, prisoners, the dead.
- Lifecycle: stories and faction records closed by accession, death, dissolution and abdication; two systems firing on one date.

Reproduce new findings before fixing them and write the failing test first.

### 2. Historical foundation: implementation and review accepted

Follow `docs/superpowers/specs/2026-11-05-historical-world-direction.md`: real geography and historical polities, new starts from 3300 BC through AD 1530, and no modern starts. The written plan `docs/superpowers/plans/2026-11-05-historical-campaign-foundation.md` is prepared. Tasks 1–5 are accepted through `1addf27`. Task 6 and final documentation review are accepted with the limits in the play script. Final review approved publication subject to current-head CI; PR #13 tracks merge state. The six ordered tasks cover: campaign-start policy, historical content, initializer, prompts, combined guards/defaults/UI, then browser evidence. Preserve existing campaigns. Year-by-year research for approximately 3300 BC through AD 1530 and the turn-end historical-reference popup are the next separate pending milestone in `docs/development/DEVELOPMENT-BACKLOG.md`.

### 3. Next: annual historical reference

Write a separate research and implementation plan for the 4,830-year coverage and turn-end reference popup in `docs/development/DEVELOPMENT-BACKLOG.md`. No year is fully reviewed for release, no event is release-approved and the popup is not implemented.

### 4. Deferred: run `docs/play-scripts/phase-3.md` in a browser

The owner moved the historical foundation ahead of this Hadara script. Adapt its setting-dependent fixtures after the new start flow exists. No Phase 3 browser pass is recorded.

It takes about 90 minutes and about 35 model calls. Use the Codex connection in the game, so the run spends no Claude tokens. `HANDOVER.local.md` says how to make the game accept Codex. Fix what the script finds, write the failing test first, and record a result per part in `CONTINUE-HERE.md` in the same table form as Phases 1 and 2. Claude's search of `src/` confirmed 45 labels in the script. Four more are generated strings: `Sera Arel`, `Talia Namar`, `Tjänst: oviss`, `Tjänst: stark`.

Never commit `play-data/` or `reports/`.

### 5. Small corrections

Put these on one branch.

- README's measured status now records the reviewed code measurement; keep it current at later milestones.
- `docs/superpowers/plans/2026-11-04-phase-3-court-and-power.md` line 38 says Tarek Arel is the brother the moment names once Sera Arel reigns. Tarek is Sera's spouse and his `legalParentIds` is empty, so the sibling branch needs Mira and Neri.
- Plan lines 68 and 164 still name the removed status `abandoned`.

### 6. Deferred minors

`docs/development/phase-3-decisions.md` lists them. Some were resolved by later tasks, so check the code before you act. Fix the ones that change behaviour:

- `filledSeats` and `rewardCouncillor`: follow-up inspection found the current code already excludes ruler/self rewards; no new fix was needed.
- `validateFamilyDemands` does not compare `story.actorId` with `family.headId`.
- `reign.js` gives a builder with an overdue aqueduct the refusal `noBuilder`, which misstates the reason.

### 7. The open Phase 0 check

The panel in both themes and narrow layouts, with one submitted public choice and one submitted private choice, each followed by a reload.

### 8. Phase 4, then 5, 6 and 7

For each phase:

1. Write `docs/superpowers/plans/YYYY-MM-DD-phase-N-<name>.md`. Copy the structure of the Phase 3 plan: goal, `Global Constraints`, rulings on what the spec leaves open, a measured balance baseline, `Review Focus`, numbered tasks with exact files, tests, a task for a play script and a task for documentation.
2. Check the plan once against the code: every function it names exists, and tasks that share a file agree.
3. Keep a ledger at `.superpowers/sdd/<plan-file-name>/progress.md`. Its first line names the plan. Log one line per task with base and head commits, each ruling, and each deferred minor. Git ignores the folder. After a context loss, trust the ledger and `git log` over your memory.
4. Work on `phase-N/<name>`. Per task: failing test, code, passing test, commit, push, then review the task's diff against the plan in a fresh context. A separate `codex exec` run works. Fix what it finds before the next task.
5. Before the phase PR: a whole-branch review, the full serial suite, the build, a play script under `docs/play-scripts/phase-N.md`, a browser run of it, and updates to `CONTRACT.md`, `README.md` and `CONTINUE-HERE.md`.

Replan these phases against the historical foundation. Moment 6 splits the realm among three sons, so the Phase 4 plan must specify partition and polity ownership in that model. The earlier Hadara-only partition choice no longer sets the product direction. Phase 3 left these seams for Phase 4: `crown`, `beginReign`, `rulerCandidates`, `claimantFor`, `legalParentIds`. In the existing Hadara test cast Sera has no sibling, Tarek is her spouse, and the sibling route needs Mira to reign with Neri alive and adult.

Phase 6 starts with its own design, per the spec. Phase 5 builds on the minimal feast in `occasions.js`.

## Rules the code depends on

Breaking one of these corrupts saves or replays, and no test may catch it at once.

- The engine decides outcomes. The model narrates and proposes through the gate. No prompt wording changes odds or outcomes, and no new command takes free text.
- All randomness comes from saved streams: `state.rngState`, the action stream and `state.plotRngState`. Never change the order of `random(state)` draws in `annualStep`, and never add a draw to `state.rngState`. NPC rolls use `plotRandom`, player rolls use `actionRandom`.
- Migrations, estimates, presentations, prompts and validation draw nothing and spend nothing.
- Replay never calls the model. Replay uses stored patches.
- Advancing a whole year and split dates give identical state. Every story with a due-date consequence joins `storyDeadlines` in `getNextCharacterTransitionDate`.
- `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. `EXTENSIONS_VERSION` is 3. `ensureCharacterExtensions` migrates additively and idempotently. A new phase raises the number and old saves keep loading.
- Hidden values never sit on a person, because presentation code copies person objects. `ambitionOf` is derived on read and never stored.
- Odds are integers from 5 to 95, and every modifier row has a Swedish `label` and an integer `value`.
- `actionResolution.js`, `npcPlots.js` and `schemes.js` import each other in a cycle. A direct import between these modules can crash on load (`IMPRISONED` in `actionOdds.js:52` hit a temporal dead zone). New modules use `actionHooks` keys or use the exports inside functions only.
- `courtAnnualStep` runs after `npcPlotStep`.
- Yearly auto-fill skips `Spionmästare`; filling it would shift the main stream.
- New systems go in their own modules. `index.js` is huge: touch only hook points. Functions stay under about 50 lines, files under about 800.
- Player text is Swedish with å, ä and ö. Comments and docs are English. A refusal is one Swedish sentence.
- Do not add model calls to a path that replay reads. Interactive calls use low effort.

Phase 3 tuned values: `DISCONTENT_THRESHOLD` 15, family demand base chance 34. `courtBalance.test.js` proves that every system fires on all eight seeds over ten years and that an ultimatum fires on seven. If you shift a stream, that test tells you.

## Module map

All under `src/runtime/characters/` unless noted.

| Area | Files |
|---|---|
| Entry and rules | `index.js`, `extensions.js`, `CONTRACT.md` |
| Actions | `actionCatalog.js`, `actionOdds.js`, `actionResolution.js`, `schemes.js` |
| Event chains | `eventChains.js`, `eventChainContent.js` |
| Intrigue | `secrets.js`, `crimes.js`, `occasions.js`, `prisoners.js`, `rumors.js`, `npcPlots.js`, `conversation.js` |
| Court | `court.js`, `reign.js`, `council.js`, `dread.js`, `nicknames.js`, `breakdowns.js`, `familyDemands.js`, `factions.js` |
| Model boundary | `src/Game/Characters/characterModelCalls.js`, `src/runtime/characterWorld.js`, `server/localModelBridge.js` |
| Panel | `src/Game/Characters/`, with `CourtSections.jsx`, `IntrigueView.jsx`, `ConversationView.jsx` |
| Balance proof | `courtBalance.test.js`, `factionsPresent.test.js` (secrecy) |

## Commands

```sh
npm ci
node scripts/fetch-map-assets.mjs --ensure
npm run build
node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"
npm run lint
node scripts/launch-dynasties.mjs
```

- Run the map fetch before the build; without it the map requests answer 404.
- Always run the suite serially, as CI does. It takes two to three minutes. Parallel runs have failed spuriously. `server/payloadUpdate.test.js` can fail on Windows with an `EPERM` rename; rerun it alone before you treat that as real.
- The game opens at http://127.0.0.1:4167. Decline the analytics dialog with `No, thanks`. After a reload the game returns to the main menu; click `Current`.
- CI runs Node 22, this computer runs Node 24.

## Git and GitHub

- Repository: https://github.com/sp1e/Attainder, public, default branch `main`. Remote `origin`. It is not a GitHub fork. Upstream is https://github.com/Open-Historia/open-historia.
- `main` is protected, also for admins: changes go through a PR and need the status check `test`, with no approvals required. Auto-merge is off. Do not pass `--admin`.
- Flow: branch from `main`, commit, push, `gh pr create`, wait for `test` (about four minutes), `gh pr merge --squash`, then verify the remote commit with `gh api repos/sp1e/Attainder/commits/main --jq .sha`. Keep the branch on GitHub so its individual commits survive.
- Before each push: `git var GIT_AUTHOR_IDENT` must name `sp1e`, and read `git diff --cached` for keys, tokens and passwords.
- `AGENTS.md` tells Codex to leave the global GitHub CLI account alone and set `GH_TOKEN` per command. Follow it.
- Do not add Claude attribution lines to your own commits.
- A push to `main` deploys nothing: the deploy, desktop and Android workflows are disabled. Leave them disabled. Only `Tests` runs.
- The checkout uses `core.autocrlf=true`, so working files are CRLF. Keep line endings when you script an edit.

## Do not

- Run `git clean -fdx`. It deletes `play-data/`, `reports/`, the ledgers under `.superpowers/sdd/`, `HANDOVER.local.md`, `node_modules` and the map files.
- Delete `.superpowers/sdd/2026-11-04-phase-3-court-and-power/`.
- Publish credentials, sessions, saves, private reports or machine-specific paths.
- Remove AGPL notices or upstream attribution.
- Hide a test failure by changing an assertion. A pin of a tuned constant moves with the constant; a balance assertion does not.
- Recreate a specific existing game's names, characters, art or levels. The research report studied genre mechanics only.

## When Claude returns

Leave `CONTINUE-HERE.md` current after every merge: branch state, measurements, next step. Update the state table and the work queue in this file as items close, so Claude can pick up from the repository alone. Name each ruling you made in the PR text.

## Phase 3 review status

The whole-branch review of `e735a5b..9a780f7` completed on 5 November 2026, including an 18-seed, 50-year JSON round-trip probe. It left two reproduced findings. The follow-up plan is `docs/superpowers/plans/2026-11-05-phase-3-review-follow-up.md`.

- Annual accounting, `e5358ac`: include the actual chancellor payment in the existing year's aggregate after loyalty drift and court processing. Preserve payment formulas, event identity/order and saved random streams. Focused tests: 51 of 51; complete-state parity: 24 scenarios. Full serial suite: 4,404 total, 4,401 pass, 0 fail, 1 skipped, 2 todo. Independent task review approved the fix.
- Legacy replay, `063fa87` and `cfa2252`: reconstruct legacy stored patches before migrating checkpoints, retain raw validated legacy checkpoint payloads, and follow the adapter's actual per-event date synchronization and reconciliation. A first review reproduced an interleaved model-date failure; `cfa2252` fixes it and passes scoped re-review with no open Critical or Important findings. Focused tests: 186 of 186. Final full serial suite and build are recorded above. The tested production code remains `cfa225238c5065441e4642481ab507629e498e73`; later documentation commits brought the retained remote branch head to `55283dc`.

Ruling: annual reporting uses actual paid deltas, including treasury clamps and rounding; the existing event keeps its one-decimal sentence and exposes no separate service or loyalty number. This fixes accounting without changing payments; a broader financial ledger would need a separate design.

Ruling: legacy compatibility runs at the replay boundary after each event's calendar and host progress. Current-version reign/office mismatches remain invalid, and source/gate/revision checks remain strict. Replay consumes stored outcomes without extra random draws, model calls or persistent provenance. An unsupported legacy shape needs a separate compatibility case and regression.

The original Phase 3 browser script and Phase 0 panel check remain open. The owner deferred the Hadara script behind the historical campaign foundation. The final follow-up branch review of `08d3518..55283dc` approved the changes with no new Critical, Important or Minor findings. The required test/build check passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295), and [PR #12](https://github.com/sp1e/Attainder/pull/12) merged the fixes as the verified remote `main` commit `6f4f7c0de84ea58010e5ea597ff0325f572ea4eb`.

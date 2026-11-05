# Codex handover

Written by Claude on 5 November 2026 at `main` = `b655e2b`. Codex develops Attainder on the owner's private desktop until the owner's weekly Claude tokens reset. Read this file from top to bottom before you change anything.

**On this computer, read `HANDOVER.local.md` in the repository root next.** Git ignores it. It holds the machine-specific paths this public repository must not contain: where the newer Codex lives, the writing rules, the Swedish character sweep and the cleanup list.

Reading order after that:

1. `AGENTS.md`: repository rules. They outrank this file.
2. `docs/development/CONTINUE-HERE.md`: the checkpoint, with every earlier measurement and play-script result.
3. `src/runtime/characters/CONTRACT.md`: the rules engine contract.
4. `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`: the binding design. Section 9 lists the phases, section 10 the constraints, section 12 the calls Claude made for the owner to check, and the end of the spec the 29 moments.
5. `docs/development/phase-3-decisions.md`: every Phase 3 ruling and deferred minor.

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
| 0 | Stable base | Merged. One panel check open (work item 5) |
| 1 | Free-text actions, odds, schemes, model gate | Merged. Play script passed |
| 2 | Intrigue, moments 1 to 4, 28, 29 | Merged. Play script passed |
| 3 | Court and power, moments 11 to 17 | Merged as `9a780f7` (PR #9). Whole-branch review started, play script not run |
| 4 | Family and succession, moments 5, 6, 8, 9, 10 | Not started. No plan |
| 5 | Events and life, moments 20 to 23 | Not started. No plan |
| 6 | World, diplomacy and war, moments 7, 24 to 27 | Not started. No plan |
| 7 | Religion, moments 18, 19 | Not started. No plan |

13 of 29 moments are built. Phases 0 and 1 carry no moments of their own.

The last measurements: `npm test` at `1698e61` gave 4,370 pass, 0 fail. The runtime suite at `62c7bd4` gave 2,280 of 2,280. Panel tests at `054d46a` gave 106 of 106. CI `test` passed on PRs #9 and #10. `npm run lint` last read 18 errors and 71 warnings, all inherited; do not add to them.

Phase 3 task 12 was cut short because the token limit was close. Tasks 1 to 10 each passed their own review. The documentation part of tasks 11 and 12 landed in PR #10. The final review and the browser run did not happen.

## Work queue

Do these in order.

### 1. Finish the Phase 3 whole-branch review

Review range: `git diff e735a5b 9a780f7`. See "Phase 3 review status" at the end of this file for what has run. Check the code against the five items under `## Review Focus` in `docs/superpowers/plans/2026-11-04-phase-3-court-and-power.md`, then against these:

- Hidden information: hidden faction members, unknown secrets, true loyalty beyond the spymaster's precision and rumor truth never reach `getCharacterPresentation` or a prompt.
- Every state a Phase 3 path writes passes `validate*` after a JSON round trip: mid-ultimatum, after a crush, after forced abdication, after dissolution.
- The acting person versus the ruler: regents, guardians, NPC rulers in family mode, incapacity, prisoners, the dead.
- Lifecycle: stories and faction records closed by accession, death, dissolution and abdication; two systems firing on one date.

Reproduce each finding before you fix it. Write the failing test first. Branch `fix/phase-3-review`.

### 2. Run `docs/play-scripts/phase-3.md` in a browser

It takes about 90 minutes and about 35 model calls. Use the Codex connection in the game, so the run spends no Claude tokens. `HANDOVER.local.md` says how to make the game accept Codex. Fix what the script finds, write the failing test first, and record a result per part in `CONTINUE-HERE.md` in the same table form as Phases 1 and 2. Claude's search of `src/` confirmed 45 labels in the script. Four more are generated strings: `Sera Arel`, `Talia Namar`, `Tjänst: oviss`, `Tjänst: stark`.

Never commit `play-data/` or `reports/`.

### 3. Small corrections

Put these on one branch.

- `README.md`, section `Development status`, still says 3,934 tests from 4 November. Replace it with your own latest measurement.
- `docs/superpowers/plans/2026-11-04-phase-3-court-and-power.md` line 38 says Tarek Arel is the brother the moment names once Sera Arel reigns. Tarek is Sera's spouse and his `legalParentIds` is empty, so the sibling branch needs Mira and Neri.
- Plan lines 68 and 164 still name the removed status `abandoned`.

### 4. Deferred minors

`docs/development/phase-3-decisions.md` lists them. Some were resolved by later tasks, so check the code before you act. Fix the ones that change behaviour:

- `filledSeats` offers the ruler's own seat, which always refuses.
- `rewardCouncillor` compares with the ruler, so a regent in a seat can reward herself. Compare with `activeRepresentative`.
- `validateFamilyDemands` does not compare `story.actorId` with `family.headId`.
- `reign.js` gives a builder with an overdue aqueduct the refusal `noBuilder`, which misstates the reason.

### 5. The open Phase 0 check

The panel in both themes and narrow layouts, with one submitted public choice and one submitted private choice, each followed by a reload.

### 6. Phase 4, then 5, 6 and 7

For each phase:

1. Write `docs/superpowers/plans/YYYY-MM-DD-phase-N-<name>.md`. Copy the structure of the Phase 3 plan: goal, `Global Constraints`, rulings on what the spec leaves open, a measured balance baseline, `Review Focus`, numbered tasks with exact files, tests, a task for a play script and a task for documentation.
2. Check the plan once against the code: every function it names exists, and tasks that share a file agree.
3. Keep a ledger at `.superpowers/sdd/<plan-file-name>/progress.md`. Its first line names the plan. Log one line per task with base and head commits, each ruling, and each deferred minor. Git ignores the folder. After a context loss, trust the ledger and `git log` over your memory.
4. Work on `phase-N/<name>`. Per task: failing test, code, passing test, commit, push, then review the task's diff against the plan in a fresh context. A separate `codex exec` run works. Fix what it finds before the next task.
5. Before the phase PR: a whole-branch review, the full serial suite, the build, a play script under `docs/play-scripts/phase-N.md`, a browser run of it, and updates to `CONTRACT.md`, `README.md` and `CONTINUE-HERE.md`.

Phase 4 needs a decision first. Moment 6 splits the realm among three sons, and Hadara is the only polity until Phase 6 (`src/runtime/dynastyScenario.js:39-41`). Rule on this in the plan: either model a partition inside Hadara as rival holders of provinces, or build the polity layer earlier. Phase 3 left these seams for Phase 4: `crown`, `beginReign`, `rulerCandidates`, `claimantFor`, `legalParentIds`. In the opening cast Sera has no sibling, Tarek is her spouse, and the sibling route needs Mira to reign with Neri alive and adult.

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

Claude started an independent read-only review of `e735a5b..9a780f7` on 5 November 2026. No result is recorded here yet, so treat work item 1 as open and run it yourself.

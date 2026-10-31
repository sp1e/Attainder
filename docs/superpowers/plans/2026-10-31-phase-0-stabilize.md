# Phase 0: Stabilize the Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four known save-validation holes in event chains, add the event-chain integration tests the Phase 1 resolution gate relies on, and bring the contributor notes up to date.

**Architecture:** All engine changes stay inside `validateEventChains` in `src/runtime/characters/eventChains.js`. New tests use isolated fixtures built with `createCharacterSystem` and an injected storage object; no real campaign, browser or model is touched.

**Tech Stack:** Node 24, ES modules, `node:test` with `node:assert/strict`, Vite for the production build.

**Spec:** `docs/superpowers/specs/2026-10-31-ai-game-master-design.md` (section 9, Phase 0).

## Global Constraints

- Work on branch `claude/ai-game-master-design`, which tracks `origin/main` (`728eaec`). Never use local `main`; it still points at upstream `293a3b8`.
- Tests run serially: `node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"`. Baseline on 31 October 2026: 3257 tests, 3254 pass, 0 fail, 1 skip, 2 todo.
- Public documentation is English. Game text and error messages shown to the player are Swedish with å, ä and ö.
- Error messages thrown by save validation follow the existing style: one Swedish sentence, for example `'Händelsekedjans orsak stämmer inte.'`.
- A normal read, validation or presentation call never draws randomness, spends money or chooses a branch.
- Do not commit anything from `../reports/`, `../design/`, `../play-data/` or any campaign save.
- Every commit ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The author must be `sp1e`; check with `git var GIT_AUTHOR_IDENT` before the first commit.

## Review Focus

1. A save edited by hand to point a chain origin at another family's memory: the load fails with a Swedish message and the original file stays untouched (Task 1, test "origin cause must be the recorded source memory").
2. A chain decision on the same date as a health decision: both remain open and neither resolves the other (Task 2, test "health and chain decisions on the same date stay separate").
3. A browser crash between the snapshot write and the last document write: the next read restores the pre-turn state exactly (Task 3, test "a failed rollback leaves a journal that the next read recovers").
4. A chain payment replayed from the stored event on a fresh copy of the world: the treasury is debited once, not twice (Task 2, test "a paid chain choice replays from its stored patch without a second debit").
5. A year advanced in one call or split at the chain's continuation date: identical final state (Task 2, test "whole and split advances through a chain continuation are identical").

---

### Task 1: Close the four save-validation holes

**Files:**
- Modify: `src/runtime/characters/eventChains.js` (`validateEventChains`, currently lines 254-312)
- Test: `src/runtime/characters/eventChains.test.js`

**Interfaces:**
- Consumes: `setup`, `start`, `choose` helpers already in `eventChains.test.js`.
- Produces: `validateEventChains(state)` throws on the four malformed shapes below. Signature unchanged.

The holes, as an independent review reproduced them (`docs/development/CONTINUE-HERE.md`):

| # | Malformed save | Rule to enforce |
|---|---|---|
| 1 | The origin step's `causeId` names a memory that is not the record's source | `originStory.causeId === (record.sourceMemoryId ?? null)` |
| 2 | A step story's `familyId` differs from the record's owner | every step story: `story.familyId === record.ownerFamilyId` |
| 3 | The outcome memory's `participants` were emptied or edited | sorted unique `participants` equal sorted unique `[...Object.values(record.roles at that step), story.decisionActorId]`, dropping null |
| 4 | The outcome memory was made private | outcome memory `knownBy === 'public'` |

Read the record and story shapes in `eventChains.js` before writing the checks. If a field name differs from the table (for example the owner field is called something other than `ownerFamilyId`), use the real name and keep the rule.

- [ ] **Step 1: Write the failing test**

Add one test that extends the existing "forged branch flags" pattern. Each mutation runs on a `structuredClone` of a state where `extra_lessons` was chosen.

```js
test('origin cause, step family and outcome memory are checked on load', () => {
  const state = setup(), story = start(state); choose(state, story, 'extra_lessons');
  const outcome = (s) => s.memories.find((m) => m.id === story.outcomeMemoryId);
  for (const mutate of [
    (s) => { s.stories.find((item) => item.id === story.id).causeId = s.memories[0].id; },
    (s) => { s.stories.find((item) => item.id === story.id).familyId = 'family-namar'; },
    (s) => { outcome(s).participants = []; },
    (s) => { outcome(s).participants = [...outcome(s).participants, 'person-2-0']; },
    (s) => { outcome(s).knownBy = [story.decisionActorId]; },
  ]) { const invalid = structuredClone(state); mutate(invalid); assert.throws(() => validateEventChains(invalid)); }
  validateEventChains(structuredClone(state));
});
```

If `s.memories[0].id` happens to equal the real source memory, pick the first memory whose id differs from `state.eventChains.records[0].sourceMemoryId`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/runtime/characters/eventChains.test.js`
Expected: FAIL on the new test, the other seven pass.

- [ ] **Step 3: Add the four checks to `validateEventChains`**

Throw Swedish errors in the existing style. Keep the checks read-only.

- [ ] **Step 4: Run the chain, character and story tests**

Run: `node --test --test-concurrency=1 src/runtime/characters/*.test.js src/runtime/characterWorld*.test.js`
Expected: all pass. If an existing test fixture fails the new rules, the fixture is malformed; fix the fixture, not the rule, and say so in the commit message.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/characters/eventChains.js src/runtime/characters/eventChains.test.js
git commit -m "Reject forged chain causes, families and outcome memories on load"
```

---

### Task 2: Event-chain integration tests for the gate

**Files:**
- Create: `src/runtime/characters/eventChainIntegration.test.js`
- Modify only if a test exposes a defect: `src/runtime/characters/eventChains.js`, `src/runtime/characters/index.js`, `src/runtime/characterWorld.js`

**Interfaces:**
- Consumes: `createCharacterSystem`, `executeCharacterCommand`, `advanceCharacters` from `./index.js`; `characterTransitionEvents`, `applyCharacterOpsToWorld`, `planCharacterAdvance` from `../characterWorld.js`; `addGameMonths` from `../gameDates.js`.
- Produces: nothing new. These tests pin current behavior that Phase 1 must keep.

Chain choices reach the engine as the `resolve_story` command (`index.js:506`). Read `handleCommand` to confirm the payload keys (`storyId`, `choiceId`) before writing the tests. Build the chain fixture the way `eventChains.test.js` does (`seed: 321`, unrest 0, `person-0-4` mentored by `person-1-1`), then advance with `advanceCharacters` until the `heir_margin` chain opens, instead of calling `scheduleEventChain` directly.

- [ ] **Step 1: Write the failing or pinning tests**

Write these five tests. Each asserts exact values.

1. `a paid chain choice replays from its stored patch without a second debit`: submit `resolve_story` with `extra_lessons` through `executeCharacterCommand`; build events with `characterTransitionEvents(before, result, 'op-1')`; apply `events.at(-1).impacts.characterOps` to `{ characterSystem: before }` with `applyCharacterOpsToWorld(..., { source: 'character-system' })`. Assert the replayed `families['family-arel'].treasury` equals the live one and equals `before - 18`. Apply the same ops a second time and assert the treasury does not change.
2. `the turn stops at a chain continuation inside the year`: after the paid choice, call `planCharacterAdvance({ characterSystem: state }, addGameMonths(state.date, 12), { pauseForCharacterDecisions: true })`. Assert `interruption.type === 'character-story'`, `interruption.date === record.nextAt`, and that no returned event has a date after `interruption.date`.
3. `health and chain decisions on the same date stay separate`: give the chain's decision actor a health condition whose next transition falls on the chain's `nextAt` (use the helpers in `health.test.js` to build it). Advance to that date. Assert one open `health_care` story and one open `event_chain` story exist, then resolve the chain step and assert the health story is still open with an unchanged choice list.
4. `whole and split advances through a chain continuation are identical`: from the same post-choice state, advance 12 months in one `advanceCharacters` call with id `a`, and in two calls split at `record.nextAt` with ids `a1` and `a2`. Compare the two states after deleting `appliedCommandIds` and `revision`. They must be deep-equal.
5. `insufficient family funds leave the chain unchanged under a command`: set the family treasury to 0, submit `resolve_story` with `extra_lessons`. Assert `result.ok === false`, the state is unchanged (`assert.deepEqual`), and the chain record still has one open step.

- [ ] **Step 2: Run the file**

Run: `node --test src/runtime/characters/eventChainIntegration.test.js`
Expected: the tests pin current behavior and pass. A failure means a real defect. Use superpowers:systematic-debugging, fix the engine in the smallest place, and record the defect in the commit message.

- [ ] **Step 3: Run the character tests**

Run: `node --test --test-concurrency=1 src/runtime/characters/*.test.js src/runtime/characterWorld*.test.js`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/runtime/characters/eventChainIntegration.test.js
git commit -m "Pin chain payment replay, interruption, same-date and split-advance behavior"
```

---

### Task 3: Interrupted multi-document save tests

**Files:**
- Modify: `src/runtime/characterPersistence.test.js`
- Modify only if a test exposes a defect: `src/runtime/characterPersistence.js`

**Interfaces:**
- Consumes: `commitCharacterTransaction({ id, base, next, io })`, `recoverCharacterTransaction(world, io)`, and the in-memory `io` fixture already in the test file.
- Produces: nothing new.

The file already covers a successful commit, recovery on reload, a campaign switch and a missing restore point. Add the two missing paths.

- [ ] **Step 1: Write the tests**

1. `a write failure mid-commit rolls the documents back in place`: an `io` whose `write('events', …)` throws once. Assert `commitCharacterTransaction` rejects with that error, and that every stored document (`game`, `world`, `events`, `actions`, `chat`, `colors`) deep-equals `base`, with `world.characterTransaction` absent or null.
2. `a failed rollback leaves a journal that the next read recovers`: an `io` whose `write('events', …)` throws and whose first rollback write also throws. Assert the rejection carries `error.recoveryError`, that the stored world still has `characterTransaction.snapshotId`, and that a later `recoverCharacterTransaction(storedWorld, healthyIo)` restores every document to `base`.

- [ ] **Step 2: Run the file**

Run: `node --test src/runtime/characterPersistence.test.js`
Expected: PASS. A failure is a defect in `characterPersistence.js`; fix it there.

- [ ] **Step 3: Commit**

```bash
git add src/runtime/characterPersistence.test.js
git commit -m "Test rollback and journal recovery after a failed multi-document save"
```

---

### Task 4: Contributor notes, full suite and build

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/development/CONTINUE-HERE.md`

**Interfaces:** none.

- [ ] **Step 1: Update `AGENTS.md`**

Replace the line that keeps the global GitHub CLI account as Simon-HF with:

```markdown
- When Claude runs on the owner's private Claude account, the global GitHub CLI account is `sp1e`. Check `gh api user --jq .login` and `git var GIT_AUTHOR_IDENT` before every push; both must name sp1e.
```

Add one line after the AGPL line:

```markdown
- Build each phase of the design in `docs/superpowers/specs/` from a written plan in `docs/superpowers/plans/`, with tests first and a review of each task.
```

- [ ] **Step 2: Rewrite `docs/development/CONTINUE-HERE.md`**

Keep the title style. State the current branch, that the four validation holes are closed with tests, that the Phase 0 integration tests exist, the new suite totals from Step 3, and that Phase 1 follows `docs/superpowers/plans/2026-10-31-phase-1-foundation.md`. Remove the Main and Worker role notes. Keep the paragraph on dependencies, build and AGPL.

- [ ] **Step 3: Run the full serial suite, lint and build**

Run: `node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"`
Expected: 0 fail. Pass count is 3254 plus the tests this phase added.

Run: `npx eslint src/runtime/characters src/runtime/characterPersistence.test.js`
Expected: no errors.

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/development/CONTINUE-HERE.md
git commit -m "Update contributor notes for the Claude-led phases"
```

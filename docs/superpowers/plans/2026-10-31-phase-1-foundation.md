# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player types an action in free text, reads the odds and their reasons, confirms, and sees a result the engine rolled, applied and saved. The model interprets and narrates; the engine keeps the books.

**Architecture:** New engine modules under `src/runtime/characters/` (extensions, secrets, court staff, action catalog, odds, resolution, schemes) plug into `index.js` through three new commands and the existing `ensure*` / `validate*` pattern. A new client module calls the model twice per action (interpret, narrate) through `callAI`, with a menu fallback. Model proposals in the year call reach state only through the same gate.

**Tech Stack:** Node 24, ES modules, React 18 (JSX), `node:test`, Vite. Local model bridge: Claude Code CLI or Codex CLI through `server/localModelBridge.js`.

**Spec:** `docs/superpowers/specs/2026-10-31-ai-game-master-design.md` (sections 4 to 8, Phase 1 in section 9). Phase 0 (`docs/superpowers/plans/2026-10-31-phase-0-stabilize.md`) must be complete.

## Global Constraints

- `rulesVersion` and `contentVersion` stay `'hadara-1.0.0'`. New state is additive and versioned by `state.extensionsVersion = 1`.
- Engine randomness for actions comes only from `state.actionRngState`, a separate xorshift stream. Never call `random(state)` from `index.js` in the new modules; `state.rngState` must be unchanged by every action, estimate and migration.
- Estimates, presentations, validations and migrations draw no randomness, spend nothing and are pure functions of the state.
- Odds are integers from 5 to 95. Every modifier carries a Swedish `label` and an integer `value`.
- Five tiers, with these exact ids: `clean_success`, `exposed_success`, `quiet_failure`, `exposed_failure`, `backfire`.
- Precision bands, exact copy:
  - five bands: 5–20 `mycket låg`, 21–40 `låg`, 41–60 `jämn`, 61–80 `hög`, 81–95 `mycket hög`;
  - three bands: 5–35 `osannolik`, 36–65 `osäker`, 66–95 `trolig`.
- Precision by the action's main skill: 12 or more gives `exact`, 7 to 11 gives `five`, below 7 gives `three`.
- Difficulty ids `easy`, `normal`, `hard` (labels `Lätt`, `Normal`, `Svår`). Player actor modifier +10 / 0 / −10. NPC actor against the player's representative −10 / 0 / +10. Old campaigns get `normal`.
- Interactive model calls (interpret, narrate): model `claude-sonnet-5-5` on the `claude-cli` provider, effort `low`. The year call keeps the player's model and effort `medium`.
- Player-facing text is Swedish with å, ä and ö. Code comments and public docs are English.
- Replay never calls the model. Every model result enters the save through a command, so its patch replays.
- Do not change `rawStoryChoices`, `annualStep` randomness order, or the existing commands' thresholds and tests.
- Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; author `sp1e`.

## Review Focus

1. **A pre-Phase-1 save** loads, migrates once, plays a year and reloads with identical state. Owner: Task 1, test "a 1.0 save migrates once and replays identically".
2. **A player who names a person who does not exist** gets a Swedish message naming the problem and the menu, never a guessed target. Owner: Task 9, test "an unknown target is reported, not guessed".
3. **The same action confirmed twice** (a double click, a retry after a timeout) charges once and rolls once. Owner: Task 6, test "a repeated command id neither charges nor rolls twice".
4. **A narrate answer with an effect outside the envelope** changes nothing beyond the defaults and still saves the narrative. Owner: Task 6, test "out-of-envelope adjustments are dropped and the narrative is kept".
5. **The model connection is off or fails** while the player acts: the menu lists every catalog action and a contested action resolves without a narrate call. Owner: Task 10, test "with no model the menu offers every catalog action".

---

### Task 1: Character extensions and migration

**Files:**
- Create: `src/runtime/characters/extensions.js`
- Create: `src/runtime/characters/extensions.test.js`
- Modify: `src/runtime/characters/content.js` (`SKILL_LABELS`, `TRAITS`)
- Modify: `src/runtime/characters/index.js` (`createCharacterSystem`, `normalizeCharacterSystem`, `executeCharacterCommand`, `advanceCharacters`, `newChild`)

**Interfaces:**
- Produces:
  - `EXTENSIONS_VERSION = 1`
  - `DIFFICULTIES = { easy: 'Lätt', normal: 'Normal', hard: 'Svår' }`
  - `deriveExtendedSkills(person) -> { intrigue: number, prowess: number }`
  - `ensureCharacterExtensions(state) -> void` (idempotent, mutates)
  - `validateCharacterExtensions(state) -> void` (throws Swedish errors)
  - `actionRandom(state) -> number in [0, 1)` (xorshift on `state.actionRngState`, same algorithm as `random` in `index.js:24`)
  - state fields after ensure: `extensionsVersion: 1`, `difficulty`, `actionRngState` (uint32, never 0), `secrets: []`, `hooks: []`, `relationships: []`, `schemes: []`, `actionLog: []`, `courtStaff: {}`.

- [ ] **Step 1: Write the failing tests** in `extensions.test.js`:
  - `new campaigns carry extensions and keep the main random stream`: `createCharacterSystem({ seed: 321 })` has `extensionsVersion === 1`, `difficulty === 'normal'`, every person has finite `skills.intrigue` and `skills.prowess`, and `rngState` equals the value the same seed produced before this task (capture it with the pre-change code in the test as a literal).
  - `createCharacterSystem({ difficulty: 'hard' })` stores `'hard'`; an unknown value stores `'normal'`.
  - `a 1.0 save migrates once and replays identically`: delete every extension field from a fresh state (and the two new skills from every person), run `normalizeCharacterSystem` twice; the results deep-equal; `rngState` is unchanged; `advanceCharacters(migrated, +12 months, { id: 'y1' })` deep-equals the same call on a JSON round-trip of `migrated`.
  - `derived skills follow archetype and traits`: a `schemer` gets higher `intrigue` than a `scholar` with equal skills; a `commander` gets higher `prowess` than a `steward`; values are integers from 1 to 20.
  - `forged extensions are rejected`: `difficulty = 'god'`, `actionRngState = 0`, `secrets = {}`, a negative `skills.intrigue` each make `normalizeCharacterSystem` throw.
- [ ] **Step 2: Run** `node --test src/runtime/characters/extensions.test.js`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement.**
  - Derivation: `intrigue = clamp(round(2 + diplomacy * 0.4 + learning * 0.2 + archetypeBonus + traitBonus), 1, 20)` with archetype bonus schemer +5, diplomat +2, legislator +1; trait bonus ambitious +1, vengeful +1, dutiful −1, compassionate −1. `prowess = clamp(round(2 + command * 0.6 + archetypeBonus + traitBonus), 1, 20)` with commander +4, guardian +2, builder +1; trait bonus vengeful +1, cautious −1. Children under 18 get half, rounded, minimum 1.
  - `actionRngState` seed: FNV-1a hash of `` `${state.identity.polityId}|${state.startedAt}|actions` ``, `>>> 0 || 1`.
  - `SKILL_LABELS` gains `intrigue: 'Intrig'`, `prowess: 'Kampförmåga'`. The education select then offers them; that is intended.
  - `TRAITS` gains these entries with Swedish names and one-sentence descriptions: `honest` Ärlig, `deceitful` Bedräglig, `trusting` Godtrogen, `paranoid` Misstänksam, `brave` Modig, `craven` Feg, `calm` Lugn, `wrathful` Vredgad, `generous` Generös, `cruel` Grym, `diligent` Flitig, `lazy` Lat, `content` Förnöjsam, `zealous` Nitisk, `cynical` Cynisk, `just` Rättvis, `arbitrary` Godtycklig, `curious` Nyfiken. Export `OPPOSITE_TRAITS` as pairs: honest/deceitful, trusting/paranoid, brave/craven, calm/wrathful, generous/greedy, compassionate/cruel, diligent/lazy, content/ambitious, zealous/cynical, just/arbitrary. Existing people get no new traits in Phase 1.
  - In `normalizeCharacterSystem`, call `ensureCharacterExtensions(state)` right after `ensureGovernance(state)` and before `validateReferences`; call `validateCharacterExtensions(state)` after `validateEventChains`. In `createCharacterSystem`, call ensure after `ensureEventChains` and honor `options.difficulty`. In `executeCharacterCommand` and `advanceCharacters`, call ensure next to `ensureEventChains`. In `newChild`, give the child `intrigue: 1, prowess: 1`.
- [ ] **Step 4: Run** `node --test --test-concurrency=1 src/runtime/characters/*.test.js src/runtime/character*.test.js`. Expected: all pass. A test that compared a whole person's `skills` object needs the two new keys; update only such literals and list them in the commit message.
- [ ] **Step 5: Commit** `git commit -m "Add versioned character extensions: intrigue, prowess, traits and difficulty"`.

---

### Task 2: Secrets, hooks and relationships

**Files:**
- Create: `src/runtime/characters/secrets.js`
- Create: `src/runtime/characters/secrets.test.js`
- Modify: `src/runtime/characters/extensions.js` (call `syncPlotSecrets` in ensure; validate)
- Modify: `src/runtime/characters/index.js` (call `syncPlotSecrets(state)` at the end of `annualStep`)

**Interfaces:**
- Consumes: Task 1 state fields.
- Produces:
  - `SECRET_TYPES = ['murder', 'affair', 'illegitimate_child', 'heresy', 'plot']`
  - `RELATIONSHIP_KINDS = ['friend', 'rival', 'lover', 'nemesis']`
  - `createSecret(state, { type, subjectId, holderIds, evidence, causeId }) -> secret` with `id: 'secret-<n>'` from `++state.sequence`, `evidence` in `'weak' | 'strong'`, `exposed: false`, `createdAt: state.date`.
  - `addSecretHolders(state, secretId, personIds) -> secret`
  - `exposeSecret(state, secretId) -> secret` (sets `exposed: true`, `exposedAt`)
  - `grantHook(state, { ownerId, targetId, strength, causeId }) -> hook` with `id: 'hook-<n>'`, `strength` `'weak' | 'strong'`, `usedAt: null`.
  - `useHook(state, hookId) -> hook` (a weak hook gets `usedAt` and can't be used again; a strong hook stays usable)
  - `activeHooks(state, ownerId, targetId?) -> hook[]`
  - `setRelationship(state, { kind, aId, bId, causeId }) -> relationship` (one per unordered pair and kind)
  - `knownSecrets(state, personId) -> secret[]` (holder or exposed)
  - `syncPlotSecrets(state) -> void`: every memory with `type === 'plot'` and a private `knownBy` array that no secret names as `causeId` becomes a `plot` secret: subject `participants[0]`, holders `knownBy`, evidence `weak`. The memory stays.
  - `validateSecrets(state) -> void`: ids unique and safe; every referenced person exists; types and strengths in their sets; `causeId` names an existing memory or is null.

Crimes (spec section 8): a `murder` secret records a murder or kinslaying, and a `plot` secret against the ruler records treason. Phase 1 stores them; the opinion, legitimacy and punishment effects of exposure arrive with the murder action in Phase 2.

- [ ] **Step 1: Write the failing tests** in `secrets.test.js`, one per behavior: creating and exposing a secret; a weak hook works once and a strong hook twice; `syncPlotSecrets` is idempotent and keeps the memory; a relationship is unique per pair and kind regardless of order; `knownSecrets` hides a secret from a non-holder until it is exposed; `validateSecrets` rejects an unknown type, a missing subject and a duplicate id; a fresh campaign advanced two years with a plotting NPC has one plot secret per private plot memory.
- [ ] **Step 2: Run** `node --test src/runtime/characters/secrets.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `secrets.js` and wire it as listed. Swedish error messages.
- [ ] **Step 4: Run** the character tests. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Add secrets, hooks and relationships with plot-memory migration"`.

---

### Task 3: Court staff

**Files:**
- Create: `src/runtime/characters/courtStaff.js`
- Create: `src/runtime/characters/courtStaff.test.js`
- Modify: `src/runtime/characters/extensions.js` (validate staff)

**Interfaces:**
- Produces:
  - `STAFF_ROLES = { cook: 'Kock', guard_captain: 'Vaktchef', physician: 'Läkare', steward: 'Hovmästare', servant: 'Tjänare' }`
  - `ensureStaff(state, familyId, role) -> staff`: returns the living staff member of that role in that household, or creates one. `id: 'staff-<n>'`, `name` from `NAME_POOL` at index `n % NAME_POOL.length` plus the role label, `familyId`, `role`, `skills` (all six keys, role-based: cook intrigue 4, guard_captain prowess 10, physician learning 10, steward stewardship 9, servant intrigue 3; other skills 3), `traits` from a fixed per-role list (cook `['greedy']`, guard_captain `['brave']`, physician `['diligent']`, steward `['honest']`, servant `['craven']`), `loyalty` 55, `bornAt` 30 years before `state.date`, `diedAt: null`.
  - `staffOf(state, familyId) -> staff[]` (living only)
  - `validateCourtStaff(state) -> void`

Staff live in `state.courtStaff`, never in `state.people`, so succession, marriage, birth, death and annual AI ignore them. Creation draws no randomness.

- [ ] **Step 1: Write the failing tests:** `ensureStaff` returns the same person on a second call; different households get different staff; creation leaves `rngState` and `actionRngState` unchanged; `advanceCharacters` over ten years never touches `courtStaff`; validation rejects a staff member whose `familyId` does not exist.
- [ ] **Step 2: Run** `node --test src/runtime/characters/courtStaff.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Create minor court staff on demand outside the dynastic rules"`.

---

### Task 4: Action catalog

**Files:**
- Create: `src/runtime/characters/actionCatalog.js`
- Create: `src/runtime/characters/actionCatalog.test.js`
- Modify: `src/runtime/characters/index.js` (export `getCatalogActions`)

**Interfaces:**
- Consumes: `getAvailableCharacterActions(state)` from `index.js`.
- Produces:
  - `ACTION_CATALOG` keyed by id. A contested entry has: `id`, `category` (`intrigue`, `diplomacy`, `family`, `court`, `military`, `religion`, `economy`, `personal`), `mode: 'contested'`, `label`, `description`, `actorScope` (`personal`, `household`, `royal`), `target` (`'person'`), `skill` (main skill id), `defenseSkill`, `secrecySkill`, `traitModifiers` (`{ actor: { trait: value }, target: { trait: value } }`), `cost` (`{ orders, silver, wallet: 'family' | 'realm', stressTag }`), `durationMonths` (0 for instant), `baseSuccess`, `baseSecrecy`, `tiers` (one envelope per tier id), `utility` (a short string NPC AI and the director read).
  - Envelope effect kinds: `{ kind: 'opinion', from: 'target' | 'actor', to: 'actor' | 'target', min, max }`, `{ kind: 'influence', family: 'actor' | 'target', min, max }`, `{ kind: 'stress', who: 'actor' | 'target', min, max }`, `{ kind: 'hook', owner, over, strength }`, `{ kind: 'secret', type, subject, holders: [roles] }`, `{ kind: 'memory', visibility: 'public' | 'private', title }`. A ranged effect's default is `Math.round((min + max) / 2)`.
  - Two contested actions in Phase 1:
    - `sway` (Påverka): diplomacy, instant, cost 1 order and 5 silver from the family. Defense diplomacy, secrecy skill diplomacy, base success 50, base secrecy 70. Target traits: paranoid −8, trusting +8. Actor traits: gregarious +6, honest +3. Tiers: clean and exposed success opinion target→actor +10…+25; quiet failure no effect; exposed failure opinion −5…−15; backfire opinion −15…−30 and actor stress +5…+10.
    - `undermine` (Undergräv): intrigue, a scheme of 3 months, cost 1 order and 15 silver from the family. Defense intrigue, secrecy skill intrigue, base success 45, base secrecy 60. Actor traits: deceitful +8, honest −8. Target traits: paranoid −10. Tiers: clean success target family influence −4…−10, private memory, plot secret held by the actor; exposed success the same influence loss plus opinion target→actor −15…−30, public memory, plot secret held by actor and target; quiet failure no effect; exposed failure opinion target→actor −15…−30 and public memory; backfire actor family influence −3…−8, opinion target→actor −20…−40, actor stress +5…+15, weak hook for the target over the actor.
  - `buildCatalogActions(state, commandActions) -> entry[]` in `actionCatalog.js`, and `getCatalogActions(state)` in `index.js`, which calls it with `getAvailableCharacterActions(state)`. Passing the list in keeps `actionCatalog.js` free of imports from `index.js`. The result holds every command action with `catalogId: type, mode: 'command'`, followed by the contested entries the representative may use now, each with `catalogId`, `mode: 'contested'`, `label`, `description`, `fields` (a target select of living adults other than the actor, `silver` number 0–60, and `agentRoles` multi-select of `STAFF_ROLES`, at most 2), and `disabledReason` when the family cannot pay.

- [ ] **Step 1: Write the failing tests:** every contested entry has all five tiers and only known effect kinds; every ranged effect has `min <= max`; `getCatalogActions` returns every type from `getAvailableCharacterActions` once, plus `sway` and `undermine`; a family with 0 silver sees `undermine` with a Swedish `disabledReason`; calling it twice leaves the state deep-equal.
- [ ] **Step 2: Run** `node --test src/runtime/characters/actionCatalog.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add the action catalog over existing commands and two contested actions"`.

---

### Task 5: Odds

**Files:**
- Create: `src/runtime/characters/actionOdds.js`
- Create: `src/runtime/characters/actionOdds.test.js`

**Interfaces:**
- Consumes: `ACTION_CATALOG` (Task 4); `getPersonalOpinion`, `getCharacterAge` from existing modules; `staffOf` (Task 3).
- Produces:
  - `estimateAction(state, intent, ctx) -> { ok: true, actionId, actorId, targetIds, cost, success: { value, modifiers }, secrecy: { value, modifiers }, precision: 'exact' | 'five' | 'three', display: { success, secrecy, modifiers } } | { ok: false, reason }`
  - `intent = { actionId, actorId, targetIds, means: { silver, agentRoles } }`, where `agentRoles` are `STAFF_ROLES` keys. The estimate counts roles; Task 6 creates or finds the staff when the action runs.
  - `ctx = { representativeId, playerControlled: boolean, canOrder(personId) -> boolean, wallet(walletKind) -> number }`, provided by `index.js` so the module never reaches into private helpers. `canOrder` implements the order rule in Task 6 and is true for the representative.
  - `bandFor(value, precision) -> string`

Formula (bounded, one direction per modifier, all integers):

| Modifier | Value |
|---|---|
| Base | entry `baseSuccess` |
| Skill | `clamp((actor[skill] − target[defenseSkill]) × 4, −30, 30)` |
| Actor traits | sum of `traitModifiers.actor` the actor has |
| Target traits | sum of `traitModifiers.target` the target has |
| Opinion (diplomacy only) | `clamp(round(opinion(target→actor) / 5), −15, 15)` |
| Age | actor 65 or older −5 |
| Stress | `−min(10, floor(stress / 20) × 2)` |
| Health | actor health below 50 −5 |
| Silver | `+min(15, floor(silver / 5))` |
| Agents | `+6` each, at most 2 agents |
| Difficulty | per Global Constraints |

Secrecy: `baseSecrecy + clamp((actor[secrecySkill] − target.skills.intrigue) × 3, −24, 24) − 8 × agents + (deceitful ? 8 : 0) − (honest ? 5 : 0)`. Both values clamp to 5–95.

Refusals (`ok: false`, Swedish reason): unknown action; actor dead, a child, or unable to exercise a mandate; `ctx.canOrder(actorId)` false; target missing, dead, or the actor; cost plus silver above `ctx.wallet(entry.cost.wallet)`; an agent role outside `STAFF_ROLES`, a repeated role, or more than 2 roles.

`display`: with `exact`, the numbers and every modifier; with `five` or `three`, the band labels and only the modifiers' labels and signs (`+` or `−`), no numbers.

- [ ] **Step 1: Write the failing tests:** clamping at 5 and 95 with extreme skills; each modifier moves the value in its stated direction (one test per row); `display` hides numbers at `five` and `three` and the band contains the true value for every value from 5 to 95; refusals for each listed reason; the function leaves the state deep-equal and both random streams unchanged.
- [ ] **Step 2: Run** `node --test src/runtime/characters/actionOdds.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Compute bounded, labeled odds with skill-based precision"`.

---

### Task 6: Resolution, tiers, envelopes and orders

**Files:**
- Create: `src/runtime/characters/actionResolution.js`
- Create: `src/runtime/characters/actionResolution.test.js`
- Modify: `src/runtime/characters/index.js` (`handleCommand`, a new `actionHooks(state)`, `getCharacterPresentation`, export `estimateCharacterAction`)

**Interfaces:**
- Consumes: Tasks 1 to 5.
- Produces:
  - Command `attempt_action` with `payload = intent` (Task 5 shape).
  - Command `record_action_narrative` with `payload = { resolutionId, title, narrative, adjustments: [{ effectIndex, value }] }`.
  - `resolveAttempt(state, command, events, hooks) -> resolution`
  - `recordNarrative(state, payload, hooks) -> resolution`
  - `tierFor(successRoll, secrecyRoll, success, secrecy) -> tierId`: success when `successRoll < success`; backfire when failed and `successRoll >= success + 0.9 × (100 − success)`; otherwise exposed when `secrecyRoll >= secrecy`. Rolls are `actionRandom(state) × 100`, success first.
  - `state.actionLog` entry: `{ id: 'resolution-<n>', commandId, actionId, actorId, targetIds, date, estimate: { success, secrecy }, rolls: { success, secrecy }, tier, effects: [applied effects], narrative: null | { title, text }, refused: false }`.
  - `estimateCharacterAction(state, intent)`, exported from `index.js`: builds `ctx` and calls `estimateAction`.
  - `applyTierEffects(state, resolution, entry, hooks) -> appliedEffects[]`, exported from `actionResolution.js` for Task 7.
  - The resolution entry also stores `agentIds`: the staff `ensureStaff` returned for each role in `means.agentRoles`, created when the action runs.
  - `getCharacterPresentation(state)` gains `catalog: getCatalogActions(state)`, `difficulty`, `recentResolutions` (last 10 entries of `actionLog` visible to the player), and `schemes` (active schemes whose actor is in the controlled family).
  - `actionHooks(state)` passes `memory`, `opinionCause`, `logEvent`, `charge`, `activeRepresentative`, `controlledFamily`, `getPersonalOpinion`, `canExerciseMandate`, `adult`, in the style of `chainHooks` (`index.js:341`).

Rules:

1. Instant contested action: validate with `estimateAction`; refuse with its reason. Charge cost with `charge(state, silver + means.silver, { orders, publicFunds: wallet === 'realm', tag: stressTag })`. Roll, pick the tier, apply each effect of the tier's envelope at its default, write the log entry and one `logEvent` with a Swedish title per tier. A `private` memory is known by the actor only; a `public` memory by everyone.
2. Orders (spec 5.8): when `actorId` is not the representative, the actor must be a living adult of the controlled family or a holder of an office while the representative can rule. Before the success roll, draw a refusal roll: `refusal = clamp(40 − loyalty × 0.4 − opinion(actor→representative) × 0.3 + (ambitious ? 10 : 0) − (dutiful ? 15 : 0), 0, 90)`. A refusal costs the order point but no silver, writes `refused: true` and a memory, and applies no tier.
3. Scheme actions (`durationMonths > 0`) hand over to `startScheme` from Task 7 after charging; the roll happens when the scheme completes.
4. `record_action_narrative`: only for an existing resolution with `narrative === null` and not refused. Title at most 120 characters, text at most 1,500. For each adjustment, accept it only when `effectIndex` names a ranged effect of that resolution's tier and `value` is an integer within its range; apply the difference from the default. Drop every other adjustment and count it in `rejectedAdjustments`. The narrative is saved even when all adjustments are dropped.
5. Existing commands in the catalog (`mode: 'command'`) keep their own command types. `attempt_action` with a command-mode id is refused with `'Den här handlingen utförs med sitt vanliga kommando.'`

- [ ] **Step 1: Write the failing tests:**
  - `a contested action charges, rolls once and applies its tier defaults`: fixed `actionRngState`, assert the tier, the treasury and order debit, the opinion change and that `rngState` is unchanged.
  - `each tier is reachable`: drive `actionRngState` values found by a search loop in the test to hit all five tiers for `sway`.
  - `a repeated command id neither charges nor rolls twice`: submit the same command id twice through `executeCharacterCommand`; the second returns `duplicate: true` and the state is unchanged.
  - `out-of-envelope adjustments are dropped and the narrative is kept`.
  - `a narrative can be recorded once`.
  - `an ordered household member can refuse`: a member with loyalty 0 and opinion −100 refuses at a fixed seed; the order point is spent, silver is not.
  - `a dead or missing target is refused before any charge`.
  - `replay of the stored patch reproduces the resolution without rolling`: run the command, build events with `characterTransitionEvents`, apply them with `applyCharacterOpsToWorld` on the base world, compare states.
- [ ] **Step 2: Run** `node --test src/runtime/characters/actionResolution.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Resolve contested actions through two rolls, five tiers and effect envelopes"`.

---

### Task 7: Schemes over time

**Files:**
- Create: `src/runtime/characters/schemes.js`
- Create: `src/runtime/characters/schemes.test.js`
- Modify: `src/runtime/characters/index.js` (`getNextCharacterTransitionDate`, the loop in `advanceCharacters`, `handleCommand`)

**Interfaces:**
- Consumes: Tasks 5 and 6 (`tierFor`, the effect applier from `actionResolution.js`, which Task 6 exports as `applyTierEffects(state, resolution, entry, hooks)`).
- Produces:
  - `startScheme(state, intent, estimate, hooks) -> scheme` with `{ id: 'scheme-<n>', actionId, actorId, targetIds, means, startedAt, dueAt, nextCheckAt, status: 'active', discoveredAt: null, resolutionId: null }`; `nextCheckAt` is `min(dueAt, startedAt + 1 month)`.
  - `getSchemeDates(state) -> date[]` (every active `nextCheckAt`)
  - `advanceSchemes(state, events, hooks) -> void`: for each active scheme with `nextCheckAt <= state.date`, in id order: a discovery check `actionRandom × 100 < clamp(10 + target.intrigue × 2 − actor.intrigue, 3, 40)`. Discovery sets `status: 'discovered'`, the target's opinion of the actor −20 with a memory known by both, and a `logEvent` when the target or actor is the player's representative. Otherwise, at `dueAt`, roll the action with a fresh estimate and record a resolution exactly as Task 6 does; else set `nextCheckAt` one month later, capped at `dueAt`.
  - Commands: `abort_scheme` `{ schemeId }` sets `status: 'aborted'` without a refund; `reinforce_scheme` `{ schemeId, silver }` charges the silver and adds it to `means.silver`.

- [ ] **Step 1: Write the failing tests:** a three-month scheme resolves on its due date; `getNextCharacterTransitionDate` stops at each monthly check; a whole-year advance and a split advance at the check dates give identical state; a discovered scheme never resolves; abort stops it without a refund; reinforce raises the success estimate at resolution; a scheme whose target dies closes as `failed` with no tier.
- [ ] **Step 2: Run** `node --test src/runtime/characters/schemes.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Call `advanceSchemes` in the `advanceCharacters` loop after `refreshRepresentation` and before the annual step.
- [ ] **Step 4: Run** the character tests and `node --test src/runtime/characterWorld*.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Run multi-month schemes with discovery checks on the character calendar"`.

---

### Task 8: Close the bypasses and gate model proposals

**Files:**
- Modify: `src/runtime/gameState.js` (`applyPolityAndTerritoryImpacts` at 4245 and its caller at 4626)
- Modify: `src/runtime/characterWorld.js` (`applyCharacterOpsToWorld`, `prepareCharacterTimeline`, `buildCharacterPromptContext`)
- Modify: `src/runtime/characters/index.js` (commands `realm_effect`, `npc_intent`)
- Modify: `src/runtime/characters/CONTRACT.md`
- Test: `src/runtime/characterWorld.gate.test.js` (create)

**Interfaces:**
- Produces:
  - Command `realm_effect` `{ treasury, legitimacy, armyStrength, reason }`, engine-only. Ranges per command: treasury −80…+40, legitimacy −10…+5, armyStrength −15…+10. Any value outside its range refuses the whole command. Values clamp the realm's fields to their existing bounds.
  - Command `npc_intent` `{ actorId, actionId, targetIds }`, engine-only. The actor must be a living adult who is not the player's representative and not in the controlled family. It runs `attempt_action` rules with `ctx.playerControlled = false`. The cost comes from `state.families[actor.familyId].treasury` and spends no action points; an NPC family that cannot pay refuses the intent. A scheme intent starts a scheme like the player's.
  - Engine-only means: `handleCommand` accepts these two types only when `command.origin === 'gate'`, which only `prepareCharacterTimeline` sets.

Changes:

1. `applyPolityAndTerritoryImpacts` gets `protectedPolityId`. The dissolution loop skips a code where `samePolity(code, protectedPolityId)` and warns `[character realm] refusing to dissolve the character polity "<code>" from a non-engine event.` The caller passes the character polity id when `nextWorld.characterSystem?.realm.alive` and `event.source !== 'character-system'`.
2. `applyCharacterOpsToWorld`: the command branch runs only when `source` is `character-system` or `game-master`; otherwise it skips with `console.warn`.
3. `prepareCharacterTimeline`: model `characterOps` commands of type `realm_effect` (at most 4 per call) and `npc_intent` (at most 3 per call) execute through `executeCharacterWorldCommand` with `id` `` `${event.id}:gate:${index}` ``, `origin: 'gate'` and the current revision. Each accepted one becomes a `character-system` event through `characterTransitionEvents`, so replay applies its patch. Refused ones add one Swedish notice event per model event, listing the refusals. Other command types keep today's "Förslaget kräver ditt beslut" notice.
4. `projectCharacterWorld` stays the only writer of leader, stability, treasury and readiness for the character polity. Add a comment saying so; no behavior change.
5. `buildCharacterPromptContext`: replace the sentence that says characterOps are "NEVER executed automatically" with the new contract: the model may propose `realm_effect` and `npc_intent` with the ranges above; the engine rolls and may refuse; the model never acts for the player's own characters. Include each contested catalog entry's id, label and target rule.
6. `CONTRACT.md`: rewrite the model-proposal rule to match items 1 to 5 and the new commands from Tasks 6 and 7.

- [ ] **Step 1: Write the failing tests** in `characterWorld.gate.test.js`:
  - `a model event cannot dissolve the character polity`: run `applyEventImpactsToWorld` with an `ai` event whose `polityChanges` dissolve the character polity; the realm stays alive and `polityOverrides[code].status` is not `dissolved`.
  - `a stored ai event cannot execute a character command on replay`.
  - `a game-master event still executes a validated command`.
  - `a realm_effect inside its envelope changes the treasury once, also on replay`.
  - `a realm_effect outside its envelope is refused with a visible notice`.
  - `an npc_intent rolls with the NPC's odds and never acts for the player family`.
  - `a player-only command proposal still produces the decision notice`.
- [ ] **Step 2: Run** `node --test src/runtime/characterWorld.gate.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS. Existing tests that asserted "characterOps are never executed" must be updated to the new contract; list each in the commit message.
- [ ] **Step 5: Commit** `git commit -m "Route model proposals through the gate and stop model dissolution of the realm"`.

---

### Task 9: Model calls: per-call model and effort, interpret and narrate

**Files:**
- Modify: `server/localModelBridge.js` (`validateLocalModelRequest`, `localModelArguments`)
- Modify: `server/localModelBridge.test.js`
- Modify: `src/Game/AI/localCliProvider.js`
- Create: `src/Game/AI/modelCallCounter.js`
- Create: `src/Game/Characters/characterModelCalls.js`
- Create: `src/Game/Characters/characterModelCalls.test.js`

**Interfaces:**
- Produces:
  - Bridge request field `effort` in `'low' | 'medium' | 'high'`, default `'medium'`; anything else is refused with `'Ogiltig ansträngningsnivå.'`. Claude args use `--effort <effort>`; Codex args add `-c model_reasoning_effort="<effort>"`.
  - `callLocalCli` sends `effort: options.effort || 'medium'` and calls `recordModelCall(options.callKind || 'year')`. The model is `INTERACTIVE_CLAUDE_MODEL = 'claude-sonnet-5-5'` when `options.interactive === true` and `provider === 'claude-cli'`; otherwise `options.entrySettings?.model || ''`. Codex keeps the player's model, so a Claude model name never reaches the Codex CLI.
  - `modelCallCounter.js`: `recordModelCall(kind)`, `getModelCallCounts() -> { total, byKind }`, `subscribeModelCalls(listener) -> unsubscribe`. Session memory only.
  - `interpretCharacterAction({ text, view, callModel }) -> { ok: true, intent, catalogId, mode, payload, explanation } | { ok: false, reason, fallback: 'menu' }`
  - `narrateCharacterResolution({ resolution, view, callModel }) -> { ok: true, title, narrative, adjustments } | { ok: false, reason }`
  - `callModel` defaults to a wrapper over `callAI` from `src/Game/AI/main.jsx` with `{ tool: { name, description, schema }, languageMode: 'none', interactive: true, effort: 'low', callKind }`. API-key providers ignore `interactive` and `effort` and use their configured model. Read how `runJsonTask` in `src/Game/AI/gameplay.js` passes a tool to `callAI` and reads `toolInput`; use the same shape. Tests inject `callModel`.
  - Interpret schema: `{ status: 'action' | 'no_match' | 'unknown_person', catalogId, actorId, targetIds, silver, agentRoles, payload, explanation, suggestions }`. Narrate schema: `{ title, narrative, adjustments: [{ effectIndex, value }] }`.

Rules:

1. The interpret prompt holds the player's text, the representative, living adults with id, name, family and office, the household's staff, and every catalog entry's id, label, description and fields. It says in English that the model maps text to one catalog entry, sets no odds and invents no person or means.
2. The client validates the answer against `view`: the catalog id exists, every person id exists and is alive, agent roles are `STAFF_ROLES` keys (at most 2), command-mode payload keys match the entry's fields and select values are among its options. `unknown_person` or an invalid id gives `{ ok: false, reason: 'Personen finns inte i spelet: …', fallback: 'menu' }` naming the text the model reported.
3. One corrective retry on a schema or JSON failure, with the validation error in the follow-up message. A second failure returns `{ ok: false, fallback: 'menu' }`.
4. The narrate prompt holds the tier, the applied effects with their indexes and ranges, and the people involved. The model writes Swedish prose of at most 1,500 characters and may not mention numbers that contradict the effects.

- [ ] **Step 1: Write the failing tests:** bridge tests for `effort` in both providers' arguments and the refusal; `callLocalCli` sends `effort`, sends `claude-sonnet-5-5` for an interactive Claude call and the configured model for an interactive Codex call (mock `fetch`); interpret maps a valid answer to an intent; `an unknown target is reported, not guessed`; a wrong select value falls back to the menu; one retry happens and the second failure returns the menu fallback; narrate passes adjustments through untouched (the engine validates them); the counter counts by kind.
- [ ] **Step 2: Run** `node --test server/localModelBridge.test.js src/Game/Characters/characterModelCalls.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add low-effort interpret and narrate calls with per-call model selection"`.

---

### Task 10: Character panel: free text, odds, confirm, menu fallback

**Files:**
- Modify: `src/Game/Characters/CharactersPanel.jsx`
- Modify: `src/Game/Characters/characters.css`
- Modify: `src/Game/Characters/CharactersPanel.test.js`
- Modify: `src/runtime/characterRuntime.js` (export `estimateCharacterActionForView(intent)`: reads the visible state and calls `estimateCharacterAction`; no write)

**Interfaces:**
- Consumes: `view.catalog`, `view.difficulty`, `view.recentResolutions`, `view.schemes` (Task 6); `interpretCharacterAction`, `narrateCharacterResolution` (Task 9); `submitCharacterCommand`, `initializeCampaignCharacters` (existing); `getModelCallCounts`, `subscribeModelCalls` (Task 9).

UI, all copy in Swedish:

1. An action box on the council view, above "Beslut som väntar": a textarea labeled `Vad vill du göra?`, a button `Tolka`, and a link-style button `Välj från listan`.
2. After interpret: a confirmation card with the action label, actor, targets and means, the success and secrecy lines from `display` (numbers or bands), the modifier list, the cost, and two buttons `Genomför` and `Avbryt`. Command-mode actions show their cost and submit their existing command on `Genomför`.
3. On `Genomför` for a contested action: submit `attempt_action`, show the tier with a Swedish heading per tier (`Lyckat i det tysta`, `Lyckat men avslöjat`, `Misslyckat i det tysta`, `Misslyckat och avslöjat`, `Det slog tillbaka`), then call narrate and submit `record_action_narrative`. A failed narrate leaves the default text and a small note `Berättelsen kunde inte skrivas; utfallet gäller.`
4. The menu fallback lists every `view.catalog` entry grouped by category, each with the existing `ActionCard` for command entries and a target, silver and agents form for contested ones, leading to the same confirmation card.
5. A scheme list with each active scheme's action, target, due date and an `Avbryt intrigen` button.
6. The campaign start offers a difficulty select (`Lätt`, `Normal`, `Svår`) passed to `initializeCampaignCharacters({ difficulty })`. The panel header shows `Svårighetsgrad: <label>`.
7. A model-call counter in the panel footer: `Modellanrop denna session: <total>`.

- [ ] **Step 1: Write the failing render tests** in `CharactersPanel.test.js`, following the file's existing render helpers: the action box renders; a stubbed interpret answer shows the confirmation card with bands for a low-skill actor and numbers for a high-skill actor; `with no model the menu offers every catalog action` (stub interpret to fail and assert one entry per `view.catalog` item); the scheme list renders an abort button; the difficulty label renders.
- [ ] **Step 2: Run** `node --test src/Game/Characters/CharactersPanel.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep new components in `CharactersPanel.jsx` beside `ActionCard`, or in `src/Game/Characters/ActionBox.jsx` if the file grows past 60 KB.
- [ ] **Step 4: Run** the panel tests and `npx eslint src/Game/Characters`. Expected: PASS, no lint errors.
- [ ] **Step 5: Commit** `git commit -m "Add free-text actions with odds, confirmation and a menu fallback to the character panel"`.

---

### Task 11: Documentation, full verification and play script

**Files:**
- Modify: `README.md` (one section on free-text actions and odds)
- Modify: `docs/development/CONTINUE-HERE.md`
- Create: `docs/play-scripts/phase-1.md`

**Interfaces:** none.

- [ ] **Step 1: Write the play script** in English, as numbered steps Simon follows in the running game: start a new campaign on `Normal`; type `Jag försöker vinna Namars stöd med gåvor och smicker`; read the odds; confirm; read the tier and the narrative; reload the game and find the result in the chronicle; start `undermine` against a Namar person and advance until it resolves; turn the model connection off and pick an action from the list; load a campaign saved before Phase 1 and advance a year.
- [ ] **Step 2: Update** `README.md` and `CONTINUE-HERE.md` with the actual test totals from Step 3.
- [ ] **Step 3: Run the full verification.**

Run: `node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"`
Expected: 0 fail.

Run: `npm run lint`
Expected: no new errors compared with `origin/main` (compare the error count; report both numbers).

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 4: Commit** `git commit -m "Document Phase 1 and add its play script"`.

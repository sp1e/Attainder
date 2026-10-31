# Phase 2: Intrigue and Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The player can poison a relative at a feast, collect secrets and use them as leverage, imprison a rival and face his family, spread rumors, hear rumors about plots, uncover an NPC plot against the throne, and talk with the court in free text with grounded, capped arguments.

**Architecture:** Phase 1's gate stays the only path to state. Phase 2 adds catalog entries and effect kinds to `actionCatalog.js` and `actionResolution.js`, situational odds rows to `actionOdds.js`, and new engine modules under `src/runtime/characters/` (`occasions.js`, `crimes.js`, `prisoners.js`, `rumors.js`, `npcPlots.js`, `conversation.js`). NPC plots and rumors draw from a third seeded stream. The client gains a conversation call and an intrigue tab.

**Tech Stack:** Node 24, ES modules, React 18 (JSX), `node:test`, Vite. Local model bridge as in Phase 1.

**Spec:** `docs/superpowers/specs/2026-10-31-ai-game-master-design.md` (sections 5, 6.2, 6.4, 8, Phase 2 in section 9, moments 1 to 4, 28 and 29). Phase 1 (`docs/superpowers/plans/2026-10-31-phase-1-foundation.md`) is complete on `main`.

## Global Constraints

- `rulesVersion` and `contentVersion` stay `'hadara-1.0.0'`. `EXTENSIONS_VERSION` becomes `2`. `ensureCharacterExtensions` migrates a version-1 state additively and idempotently.
- Three random streams. `state.rngState` (main) and `state.actionRngState` (actions, rolls, refusals, scheme checks) keep their Phase 1 roles. New `state.plotRngState` (xorshift, never 0) feeds NPC plot choice, rumor hearing and rumor accuracy, and ransom decisions only. Seed: FNV-1a of `` `${state.identity.polityId}|${state.startedAt}|${state.rngState}|plots` ``, `>>> 0 || 1`, filled once by ensure. Export `plotRandom(state)` from `extensions.js`.
- Migration, estimates, presentations, prompt building and validation draw no randomness and spend nothing.
- Odds stay integers from 5 to 95. Every new modifier row has a Swedish `label` and an integer `value`.
- Player-facing text is Swedish with å, ä and ö. Code comments and docs are English.
- Replay never calls the model. Every model result enters state through a command whose patch replays.
- Rumor truth (`truthful`, `sourceId`) and an estimate's true values at band precision never reach the presentation, the year prompt or a model prompt.
- Do not change `rawStoryChoices` branches that exist, the order of `random(state)` draws in `annualStep`, Phase 1 thresholds, or `state.rngState`.
- Interactive model calls (interpret, narrate, converse) use `claude-sonnet-5-5` at effort `low`, through `characterModelCalls.js`.
- NPC plotters come from families other than the controlled family (a ruling on spec moment 3: in realm mode the controlled family's adults act on the player's orders, so a plot from inside it would be the player plotting against himself). Relatives by marriage in other families count.
- Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; author `sp1e <simon.pn@protonmail.com>`.

## Review Focus

1. **A Phase 1 save** (extensions version 1, with active schemes and resolutions) migrates once to version 2, leaves `rngState` and `actionRngState` unchanged, and replays a year identically after a JSON round-trip. Owner: Task 1.
2. **An imprisoned heir becomes ruler** when the ruler dies: the prison record closes as released by succession and the new ruler can act. Owner: Task 5, test "a prisoner who inherits the throne is released".
3. **Rumor truth leaks:** no presentation field, year prompt or conversation prompt carries `truthful` or `sourceId`. Owner: Task 6, test "rumor truth stays in the engine"; Task 9 asserts it for prompts.
4. **A conversation argument that refers to nothing** (a forged memory id, a shared enemy the person likes, a hook that is spent) earns 0, and any model score above 10 counts as 10. Owner: Task 8, test "an argument that refers to nothing earns nothing".
5. **A feast that ends before a poison scheme falls due** still counts for that scheme, and a feast never counts for an action started outside its window. Owner: Task 3, test "the feast modifier follows the scheme's start".

---

### Task 1: Extensions version 2, the plot stream and the spymaster office

**Files:**
- Modify: `src/runtime/characters/extensions.js`
- Modify: `src/runtime/characters/extensions.test.js`
- Modify: `src/runtime/characters/index.js` (`createCharacterSystem` offices; `appoint`/`dismiss` accept the new office)

**Interfaces:**
- Produces:
  - `EXTENSIONS_VERSION = 2`; `plotRandom(state) -> number in [0, 1)`.
  - New container lists in `CONTAINER_LISTS`: `occasions`, `prisoners`, `rumors`, `conversations` (arrays). New fields: `plotRngState` (uint32, never 0).
  - Office `spymaster`: `{ id: 'spymaster', name: 'Spionmästare', kind: 'council', holderId: null, regentId: null, history: [], publicBudget: 0 }`. New campaigns create it vacant; migration adds it vacant when missing.
  - `spymasterOf(state) -> person | null`: the living holder of `spymaster`, else null.
  - Moment 1 seed: `createCharacterSystem` (new campaigns only, not migration) creates one `affair` secret with subject `person-2-2` (Barek Eshmun, the chancellor), holders `['person-2-2']`, evidence `strong`, `causeId: null`. It draws no randomness.

- [ ] **Step 1: Write the failing tests** in `extensions.test.js`:
  - `new campaigns are on extensions version 2 with an empty intrigue ledger`: `createCharacterSystem({ seed: 321 })` has `extensionsVersion === 2`, the four new arrays empty, a nonzero `plotRngState`, a vacant `offices.spymaster`, and exactly one secret: the chancellor's affair.
  - `a version-1 save migrates once`: take a fresh state, delete the four arrays, `plotRngState` and `offices.spymaster`, set `extensionsVersion = 1`; `normalizeCharacterSystem` twice deep-equals once; `rngState` and `actionRngState` are unchanged; `advanceCharacters` 12 months deep-equals the same call on a JSON round-trip.
  - `the ruler can appoint and dismiss a spymaster`: `appoint` with `officeId: 'spymaster'` and `person-0-2` makes `spymasterOf(state).id === 'person-0-2'`; `dismiss` vacates it.
  - `forged version-2 fields are rejected`: `plotRngState = 0`, `prisoners = {}`, `rumors = 'x'` each make `normalizeCharacterSystem` throw.
- [ ] **Step 2: Run** `node --test src/runtime/characters/extensions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Version 1 fields keep their validation. Update any test literal that asserted `extensionsVersion === 1` or the exact office list, and list each in the commit message.
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Move character extensions to version 2 with a plot stream and a spymaster office"`.

---

### Task 2: Crimes, death and new effect kinds

**Files:**
- Create: `src/runtime/characters/crimes.js`
- Create: `src/runtime/characters/crimes.test.js`
- Modify: `src/runtime/characters/actionCatalog.js` (constructors and `EFFECT_KINDS`)
- Modify: `src/runtime/characters/actionResolution.js` (`APPLY`, `EFFECT_CHECKS`)
- Modify: `src/runtime/characters/index.js` (`actionHooks` gains `kill`, `related`, `ruler`, `openStory`)
- Modify: `src/Game/Characters/characterModelCalls.js` (`EFFECT_FIELDS` gains `reason`, `crime`, `topic`)

**Interfaces:**
- Produces:
  - Hooks: `kill(ids, events, reason)` wraps the private `killPeople` with the same `events` array; `related(aId, bId) -> boolean` (spouse, parent, child, sibling, or the same family); `ruler() -> person | null`; `openStory(story) -> story` pushes a story with `id: 'story-<n>'` and `status: 'open'`.
  - Effect kinds and constructors in `actionCatalog.js`:
    - `kill(who, reason)` → `{ kind: 'kill', who, reason }`. Applies `hooks.kill([id], events, reason)`; record `{ kind, personId, reason }`. A dead person is skipped with `applied: false`.
    - `crime(crimeKind, exposed)` → `{ kind: 'crime', crime: 'murder' | 'attempted_murder' | 'treason', exposed }`. Creates a secret (`murder` type for `murder`, `plot` type otherwise) with subject the actor, holders the actor and the resolution's agents' family heads, `evidence: exposed ? 'strong' : 'weak'`, `causeId` the resolution memory. A murder of a related victim records `crime: 'kinslaying'` in the effect record. When `exposed`, call `exposeCrime`. Record `{ kind, crime, secretId, exposed }`.
    - `legitimacy(min, max)` → ranged, applies to `state.realm.legitimacy` within 0..100, only when the actor is the ruler; otherwise `applied: false`.
  - `crimes.js`:
    - `CRIME_LABELS = { murder: 'Mord', kinslaying: 'Släktmord', attempted_murder: 'Mordförsök', treason: 'Förräderi' }`
    - `exposeCrime(state, { secretId, crime, victimId }, events, hooks) -> void`: `exposeSecret`; every living adult of the victim's family gains opinion −30 toward the subject (label `CRIME_LABELS[crime]`); for `kinslaying`, every living adult of the subject's family −15 more; when the subject is the ruler, `realm.legitimacy` −8 (murder, attempted murder) or −12 (kinslaying); when the subject is not the ruler and the ruler is the player's representative, open a `punish_crime` story for the player.
    - Story `punish_crime` choices: `imprison` (imprisons the subject through `imprisonPerson` from Task 5, no roll, legitimacy unchanged because the crime is exposed), `fine` (moves 30 silver or what the subject's family has from the family to `realm.treasury`), `pardon` (legitimacy −2, the subject's opinion of the ruler +15). Add the branch to `rawStoryChoices` and `resolveStory` as a new `story.type`, without editing existing branches. Until Task 5 lands, `imprison` shows `disabledReason: 'Fängelset är inte byggt ännu.'`; Task 5 removes that line.

- [ ] **Step 1: Write the failing tests** in `crimes.test.js`: a `kill` effect kills once and runs succession when the victim is the ruler; a hidden `crime` creates a weak, unexposed secret held by the actor; an exposed murder of `person-1-2` lowers every Namar adult's opinion of the actor by 30; kinslaying of `person-0-3` by `person-0-2` lowers Arel opinions further; a ruler murderer loses 8 legitimacy; `punish_crime` opens for the player and each of its three choices applies its rule; `validateActionLog` rejects a `kill` record without `personId`.
- [ ] **Step 2: Run** `node --test src/runtime/characters/crimes.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add crimes, killing and legitimacy as effect kinds with exposure consequences"`.

---

### Task 3: The feast occasion and situational odds

**Files:**
- Create: `src/runtime/characters/occasions.js`
- Create: `src/runtime/characters/occasions.test.js`
- Modify: `src/runtime/characters/actionOdds.js` (a situational rows hook)
- Modify: `src/runtime/characters/actionResolution.js` and `schemes.js` (store `means.occasionId`)
- Modify: `src/runtime/characters/index.js` (command `hold_feast`, `COMMAND_TYPES`, available actions, `actionContext`, presentation)

**Interfaces:**
- Produces:
  - Command `hold_feast` `{}`, a command-mode catalog entry (label `Håll gästabud`, category `court`). Cost 30 silver from the family wallet, 1 order, stress tag `generous`. Refused when the family has an active feast or held one in the last 12 months (`Familjen höll gästabud för mindre än ett år sedan.`).
  - Occasion `{ id: 'occasion-<n>', kind: 'feast', hostFamilyId, hostId, startedAt, endsAt: startedAt + 1 month, guestIds }`; guests are every living adult of every family that is not imprisoned. Each guest family's head gains opinion +5 of the host (`Bjöds på gästabud`).
  - `activeOccasion(state, familyId, date) -> occasion | null` (`startedAt <= date < endsAt`), `validateOccasions(state)`.
  - `ctx.situation(entry, actor, target, means) -> { success: row[], secrecy: row[], occasionId }` passed by `index.js`; `estimateAction` appends the rows before the clamp. Phase 2 rows:
    - feast: an `intrigue`-category entry whose actor's family hosts an active feast where the target is a guest, or whose `means.occasionId` names that family's feast: success `+15` `Gästabudet ger tillträde`, secrecy `−5` `Hemlighållning: många vittnen på gästabudet`.
  - `estimateAction` returns `occasionId` when the feast row counted. `resolveAttempt` stores it in `means.occasionId` for schemes, so the due-date estimate counts it after the feast ends.
  - Presentation: `occasions` (active ones of the controlled family) with `{ id, kind, label: 'Gästabud', endsAt, guestCount }`.

- [ ] **Step 1: Write the failing tests:** `hold_feast` charges 30 silver and one order and opens a one-month occasion; a second feast within 12 months is refused; `the feast modifier follows the scheme's start` (an `undermine` started during the feast keeps the +15 at its due date two months after the feast; one started the day after the feast ends gets no row); the row never appears for a `diplomacy` action; estimates leave all three streams unchanged.
- [ ] **Step 2: Run** `node --test src/runtime/characters/occasions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Let the player host a feast that gives intrigue actions access"`.

---

### Task 4: Intrigue actions: poison, investigate, blackmail, spread a rumor

**Files:**
- Modify: `src/runtime/characters/actionCatalog.js` (entries, fields)
- Modify: `src/runtime/characters/actionOdds.js` (means, rows, refusals)
- Modify: `src/runtime/characters/actionResolution.js` (`APPLY` for `reveal`, `hook_from_secret`, `rumor`; `useHook` on resolution)
- Modify: `src/runtime/characters/schemes.js` (copy new means)
- Create: `src/runtime/characters/intrigueActions.test.js`

**Interfaces:**
- Consumes: Tasks 2 and 3; `createSecret`, `addSecretHolders`, `grantHook`, `useHook`, `activeHooks`, `knownSecrets` from `secrets.js`.
- Produces:
  - `means = { silver, agentRoles, occasionId?, secretId?, hookId?, topic? }`. `readMeans` accepts the new keys; unknown keys are refused (`REASONS.means`).
  - New odds rows:
    - `Påtryckning genom ett grepp` `+20` when `means.hookId` names an active hook owned by the actor over the target. The resolution calls `useHook` once, whatever the tier.
    - `Bevis: starkt` `+25` or `Bevis: svagt` `+10` when `means.secretId` names an unexposed secret whose subject is the target and whose holders include the actor.
    - `Målet är härskare` `−15` and `Målets livvakter` `−10` when the target holds `ruler` (both) or any office (the second only), for `poison` and `imprison`.
    - `Målets svaga hälsa` `+10` for `poison` when the target's health is below 40.
  - New refusals: `means.secretId` that fails the rule above (`Hemligheten kan inte användas mot den här personen.`); `means.hookId` that fails (`Greppet går inte att använda.`); `blackmail` without `means.secretId` (`Utpressning kräver en hemlighet om målet.`); `spread_rumor` without a valid `topic`.
  - `fields`: `buildCatalogActions` adds, per entry, `{ key: 'secretId', type: 'select' }` (secrets the representative holds about a living adult, labeled with type and subject name) when the entry has `uses: ['secret']`, `{ key: 'hookId', type: 'select' }` (active hooks the representative owns) when `uses` includes `'hook'`, and `{ key: 'topic', type: 'select' }` for `spread_rumor`. Each select has an empty option `Ingen` except a required one.
  - Effect kinds: `reveal(who)` adds the actor as holder of the target's strongest unexposed secret the actor lacks, record `{ kind, secretId | null }`; `hookFromSecret()` grants the actor a hook over the target with the strength of `means.secretId`'s evidence; `rumor(topic)` creates a rumor through Task 6's `createRumor` (until Task 6 lands, a stub that records `{ kind: 'rumor', topic, rumorId: null }`; Task 6 replaces it).
  - Catalog entries (all `mode: 'contested'`, target one living adult other than the actor):

| id | label | category | skill / defense / secrecy | months | cost (orders, silver, tag) | base success / secrecy | uses |
|---|---|---|---|---|---|---|---|
| `poison` | Förgifta | intrigue | intrigue / intrigue / intrigue | 1 | 1, 25, `cruel` | 30 / 50 | hook |
| `investigate` | Snoka | intrigue | intrigue / intrigue / intrigue | 2 | 1, 10, `duty` | 50 / 65 | — |
| `blackmail` | Utpressa | intrigue | intrigue / intrigue / intrigue | 0 | 1, 0, `betrayal` | 35 / 70 | secret |
| `spread_rumor` | Sprida rykte | intrigue | intrigue / intrigue / intrigue | 0 | 1, 10, `betrayal` | 50 / 55 | — |

  Trait modifiers: `poison` actor deceitful +6, cruel +6, compassionate −10, honest −6; target paranoid −12, trusting +6. `investigate` actor curious +5; target paranoid −8. `blackmail` actor deceitful +5, honest −8; target craven +8, brave −8. `spread_rumor` actor deceitful +6, honest −10.

  Tiers:
  - `poison`: clean success `kill('target', 'Sjukdom')`, `crime('murder', false)`, private memory `Giftet verkade`; exposed success `kill('target', 'Förgiftad')`, `crime('murder', true)`; quiet failure target stress +10…+20; exposed failure `crime('attempted_murder', true)`, opinion target→actor −60…−40; backfire `crime('attempted_murder', true)`, a strong hook for the target over the actor, actor stress +10…+20.
  - `investigate`: clean and exposed success `reveal('actor')` (exposed adds opinion target→actor −20…−10); quiet failure nothing; exposed failure opinion −20…−10 and a public memory; backfire the target gains a weak hook over the actor.
  - `blackmail`: clean success `hookFromSecret()`, opinion target→actor −20…−10; exposed success the same plus the secret's exposure (`crime` exposure when it is a crime secret, else `exposeSecret`); quiet failure opinion −15…−5; exposed failure opinion −30…−20 and a public memory; backfire the target gains a weak hook over the actor and actor stress +5…+10.
  - `spread_rumor`: clean success `rumor(topic)` and target family influence −8…−3; exposed success the same plus opinion target→actor −30…−20; quiet failure nothing; exposed failure opinion −30…−20 and actor family influence −5…−2; backfire the same as exposed failure plus actor stress +5…+10.

- [ ] **Step 1: Write the failing tests** in `intrigueActions.test.js`:
  - `a poisoning at a feast reaches all five tiers`: `person-0-2` poisons `person-0-3` (the son-in-law) during a feast; for each tier, a seed found by search gives that tier at the due date; clean and exposed success kill him, exposed tiers expose a crime, and the clean tier records kinslaying in the secret's crime record.
  - each new row moves the odds in its direction; each new refusal; `blackmail` with a strong secret grants a strong hook; a weak hook used in `means.hookId` is spent after one resolution; `investigate` reveals an existing affair secret and returns `secretId: null` when there is none; the menu fields list only secrets and hooks the representative holds.
- [ ] **Step 2: Run** `node --test src/runtime/characters/intrigueActions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add poison, investigate, blackmail and rumor actions with secret and hook leverage"`.

---

### Task 5: Imprisonment and ransom

**Files:**
- Create: `src/runtime/characters/prisoners.js`
- Create: `src/runtime/characters/prisoners.test.js`
- Modify: `src/runtime/characters/actionCatalog.js` (`imprison` entry, `imprison` effect kind)
- Modify: `src/runtime/characters/actionOdds.js` (actor and target rules)
- Modify: `src/runtime/characters/index.js` (commands, `annualStep`, `aiAnnual`, death and succession, presentation)
- Modify: `src/runtime/characters/crimes.js` (enable `punish_crime` → `imprison`)

**Interfaces:**
- Produces:
  - Prisoner `{ id: 'prisoner-<n>', personId, captorFamilyId, since, ransom, status: 'held' | 'released' | 'ransomed' | 'executed' | 'dead', closedAt: null, reason }`. `ransom = 40`.
  - `imprisonPerson(state, personId, captorFamilyId, events, hooks, { lawful }) -> prisoner`: vacates the person's non-ruler offices through the existing vacate path, writes a public event and memory; when `lawful` is false, `realm.legitimacy` −5 and the person's family grievance −8. Lawful means the person is the subject of an exposed crime secret.
  - `isImprisoned(state, personId) -> boolean`.
  - Catalog entry `imprison` (Fängsla): category `court`, prowess / prowess / intrigue, instant, cost 1 order and 10 silver from the `realm` wallet, stress tag `risky`, base success 60, base secrecy 5, `uses: []`. Allowed only when the actor holds `ruler` (refusal `Bara härskaren kan fängsla.`). Tiers: both successes `imprison('target')` and opinion target→actor −30…−15; quiet failure nothing; exposed failure opinion −40…−20; backfire opinion −50…−30, target family grievance −10, actor stress +5…+15.
  - Commands: `release_prisoner { prisonerId }` (opinion of the prisoner and his family head +10), `execute_prisoner { prisonerId }` (`kill` with reason `Avrättad`, stress tag `cruel`, the prisoner's family adults −50 opinion of the ruler, legitimacy −4 unless lawful). Both cost 1 order.
  - Rules: an imprisoned person cannot act (refusal `Personen sitter fängslad.`), is skipped by `aiAnnual` and by NPC plots, and is no feast guest. Death closes the record as `dead`. When an imprisoned person becomes ruler, the record closes as `released` with reason `Ärvde tronen`.
  - Annual ransom step `prisonerStep(state, events, hooks)` at the end of `annualStep`, on `plotRandom`: for each held prisoner of the controlled family, the prisoner's family pays when its treasury covers the ransom and `plotRandom() < 0.6`; it opens story `ransom_offer` with choices `accept` (silver to `realm.treasury`, release, family head opinion +10) and `refuse` (family head opinion −10). Otherwise the family prepares a revolt: family grievance −6, family head opinion of the ruler −15, a public event `<familjenamn> rustar mot kronan`.
  - Presentation `prisoners`: held prisoners of the controlled family with names, since and ransom.

- [ ] **Step 1: Write the failing tests:** imprisoning `person-1-2` vacates the general's office and charges the realm; an unlawful imprisonment costs legitimacy and a lawful one does not; the prisoner cannot be an actor and is skipped by `aiAnnual`; a ransom offer appears at a found `plotRngState` and `accept` adds 40 silver and releases; the revolt branch at another seed; `release_prisoner` and `execute_prisoner`; `a prisoner who inherits the throne is released`; `punish_crime` → `imprison` now works; a year with prisoners advanced whole and split gives identical state.
- [ ] **Step 2: Run** `node --test src/runtime/characters/prisoners.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add imprisonment, ransom offers and family revolt preparations"`.

---

### Task 6: Rumors and the spymaster's reliability

**Files:**
- Create: `src/runtime/characters/rumors.js`
- Create: `src/runtime/characters/rumors.test.js`
- Modify: `src/runtime/characters/schemes.js` (hearing on each monthly check; spymaster bonus to discovery)
- Modify: `src/runtime/characters/actionResolution.js` (replace the Task 4 `rumor` stub)
- Modify: `src/runtime/characters/index.js` (presentation)

**Interfaces:**
- Produces:
  - Rumor `{ id: 'rumor-<n>', date, topic: 'plot' | 'murder' | 'affair' | 'illegitimate', subjectId, claimedActorId: id | null, truthful: boolean, reliability: 'osäker' | 'trolig' | 'säker', sourceKind: 'scheme' | 'action', sourceId, heardByFamilyId }`.
  - `RUMOR_TOPICS = { plot: 'Sammansvärjning', murder: 'Mordplaner', affair: 'Otrohet', illegitimate: 'Oäkta börd' }`.
  - `createRumor(state, fields) -> rumor`; `validateRumors(state)`; `presentRumors(state, familyId)`: the last 20 heard by the family, newest first, without `truthful` and `sourceId`, with names and `topicLabel`.
  - `hearScheme(state, scheme) -> rumor | null`, called on every monthly check of an active scheme whose actor is outside the controlled family and which was not discovered on that check. The listener is the spymaster, else the representative at half intrigue (rounded down). Hear when `plotRandom() × 100 < clamp(5 + intrigue × 2, 5, 50)`. Accuracy `clamp(40 + intrigue × 3, 40, 95)`; truthful when `plotRandom() × 100 < accuracy`; otherwise `claimedActorId` is a living adult outside the actor's and controlled families, picked by `plotRandom` from candidates sorted by id (null when none). Reliability `osäker` below 60, `trolig` below 80, else `säker`. Topic `murder` for `poison`, else `plot`. At most 3 rumors per scheme.
  - `spread_rumor`'s `rumor(topic)` effect creates a truthful-flag-false rumor about the target heard by every family (`heardByFamilyId: '*'`).
  - Discovery bonus: when a scheme's target is in the controlled family and a spymaster exists, the discovery chance adds `floor(spymaster.intrigue / 2)` before its clamp, and the clamp becomes 3..55.

- [ ] **Step 1: Write the failing tests:** at a found seed an NPC scheme against Namar produces a rumor heard by Arel; a spymaster with intrigue 18 gives `säker` and a truthful claim at a seed where intrigue 4 gives a wrong name; `rumor truth stays in the engine` (presentation and `buildCharacterPromptContext` output never contain `truthful` or `sourceId`); a scheme yields at most 3 rumors; the spymaster raises discovery; `spread_rumor` creates a rumor everyone hears; rumor draws leave `rngState` and `actionRngState` unchanged.
- [ ] **Step 2: Run** `node --test src/runtime/characters/rumors.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Let the spymaster hear rumors of schemes with skill-based reliability"`.

---

### Task 7: NPC plots against the player and each other

**Files:**
- Create: `src/runtime/characters/npcPlots.js`
- Create: `src/runtime/characters/npcPlots.test.js`
- Modify: `src/runtime/characters/index.js` (`annualStep`, story branches, presentation)
- Modify: `src/runtime/characters/schemes.js` (plot secret at start, story on discovery)

**Interfaces:**
- Produces:
  - `npcPlotStep(state, events, hooks)`, called in `annualStep` after `aiAnnual` and `prisonerStep`, before `syncPlotSecrets`. Uses only `plotRandom` for choices; the schemes it starts draw from `actionRandom` as any scheme does.
  - Against the player: candidates are living adults outside the controlled family, not imprisoned, not exiled, whose family can pay. Score `−opinion(candidate→ruler) + 15 × ambitious + 15 × vengeful + intrigue`. The best candidate (ties by id) plots when its score is at least 20 and `plotRandom() × 100 < clamp(score / 2, 0, 40) × aggression`, aggression `easy 0.5`, `normal 1`, `hard 1.5`. Action `poison` when the score is at least 60, else `undermine`; target the ruler (or the representative in family mode). At most one active NPC scheme against the controlled family.
  - Between NPCs (moment 29): the pair of adults from two different non-controlled families with the lowest mutual opinion below −10 starts `undermine` when `plotRandom() < 0.2`. At most two such schemes active.
  - Affairs: for each married living adult outside the controlled family whose opinion of the spouse is 0 or lower and who is not the subject of an unexposed `affair` secret, `plotRandom() < 0.08` creates an `affair` secret (subject that person, holder that person, evidence `weak`). This feeds `investigate` and `blackmail`.
  - Each scheme is started through `resolveAttempt` with `npcActionContext`, `means` empty, command id `` `npc-plot:${state.date}:${n}` ``, and a `plot` secret (subject the actor, holder the actor, evidence `weak`) whose id the scheme stores as `secretId`.
  - On discovery of a scheme whose target is in the controlled family: the scheme's secret gains the target and the representative as holders with evidence `strong`, and story `plot_uncovered` opens for the player with choices `imprison` (lawful imprisonment through `imprisonPerson`, disabled when the representative is not the ruler), `expose` (`exposeCrime` as `treason` when the target is the ruler, else `attempted_murder` for `poison` or `exposeSecret` for `undermine`), `hook` (the representative gains a strong hook over the plotter), and `ignore`.
  - Presentation gains nothing new here; rumors and stories carry it.

- [ ] **Step 1: Write the failing tests:** a hostile, ambitious Namar adult with opinion −60 of the ruler starts a `poison` scheme against him at a found seed; a friendly court starts none; difficulty `hard` plots at a seed where `easy` does not; NPC-versus-NPC undermining starts; only one NPC scheme against the player at a time; `the player can uncover an NPC plot` (advance until discovery at found seeds, then each `plot_uncovered` choice applies its rule); a whole year and a split year give identical state; the step leaves `rngState` unchanged.
- [ ] **Step 2: Run** `node --test src/runtime/characters/npcPlots.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Existing tests that advance a year and then assert exact action-stream outcomes may shift because NPC schemes now draw from `actionRandom`; update only such expectations, re-derive seeds by the file's own search helpers, and list each in the commit message.
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Let NPCs plot against the throne and each other, and let the player uncover it"`.

---

### Task 8: Conversation requests in the engine

**Files:**
- Create: `src/runtime/characters/conversation.js`
- Create: `src/runtime/characters/conversation.test.js`
- Modify: `src/runtime/characters/index.js` (command `converse_request`, origin rule, `estimateConversation` export, presentation)
- Modify: `src/runtime/characterRuntime.js` (`estimateConversationForView`, `submitConversationRequest`)

**Interfaces:**
- Produces:
  - `CONVERSATION_REQUESTS = { support: { label: 'Ge sitt stöd', base: 45 }, reveal_secret: { label: 'Avslöja en hemlighet', base: 25 }, pledge: { label: 'Ge ett löfte', base: 30 } }`.
  - `request = { personId, kind, offerSilver, hookId, arguments: [{ kind: 'offer' | 'shared_enemy' | 'shared_memory' | 'hook', refId }], argumentScore }`.
  - `estimateConversation(state, request) -> { ok: true, value, modifiers, precision, display, groundedArguments } | { ok: false, reason }`. Rows: `Grundchans`; opinion of the representative `clamp(round(op / 4), −20, 20)`; loyalty `round((loyalty − 50) / 5)`; offer `min(15, floor(offerSilver / 4))`; greedy +8 with any offer; honest −10 for `reveal_secret`; paranoid −8; trusting +6; hook +20; `Övertygande argument` = `min(10, argumentScore)` when at least one argument is grounded, else no row. Clamp 5..95. Precision by the representative's diplomacy, with Phase 1's thresholds and bands.
  - Grounding: `offer` needs `offerSilver > 0`; `shared_enemy` needs a living person both the speaker and the representative hold at opinion −20 or lower; `shared_memory` needs a memory whose participants include both and that both know; `hook` needs an active hook owned by the representative over the speaker.
  - Who may be asked: living adults of the controlled family and holders of the realm's offices, never the representative, not imprisoned. One request per person per 12 months (`Ni talade om detta nyss. Personen vill inte bli tillfrågad igen än.`).
  - Command `converse_request` accepted only with `origin: 'converse'`. It re-runs `estimateConversation` (the model's score is capped again), draws one `actionRandom` roll, and on acceptance pays the offer from the family wallet (no order point) and applies: `support` opinion of the representative +10 (`Stöd i samtal`); `reveal_secret` adds the representative as holder of the speaker's strongest unexposed secret the representative lacks (none: accepted with `secretId: null`); `pledge` a weak hook for the representative over the speaker. A refusal pays nothing. Both write a memory known by the two and a `state.conversations` entry `{ id: 'conversation-<n>', personId, kind, date, value, roll, accepted, effects }`. A used hook is spent either way.
  - `submitConversationRequest(request)` in `characterRuntime.js` is the only caller that sets `origin: 'converse'`.
  - Presentation: `conversationTargets` (ids allowed now) and `ownHooks` and `knownSecrets` (the representative's, with names and type labels).

- [ ] **Step 1: Write the failing tests:** each row moves the value in its direction; `an argument that refers to nothing earns nothing` (forged memory, a liked "enemy", a spent hook, and a score of 40 counting as 10); each request kind applies its effect on acceptance at a found seed and nothing but the memory on refusal; the player origin is refused; the 12-month rule; a request leaves `rngState` and `plotRngState` unchanged.
- [ ] **Step 2: Run** `node --test src/runtime/characters/conversation.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the character tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Resolve conversation requests with grounded, capped arguments"`.

---

### Task 9: Model calls: conversation, interpret means, prompt context

**Files:**
- Modify: `src/Game/Characters/characterModelCalls.js`
- Modify: `src/Game/Characters/characterModelCalls.test.js`
- Modify: `src/runtime/characterWorld.js` (`buildCharacterPromptContext`)
- Modify: `src/runtime/characterWorld.test.js` or `characterWorld.gate.test.js`

**Interfaces:**
- Produces:
  - `extractConversationRequest({ personId, text, history, view, callModel }) -> { ok: true, request: request | null } | { ok: false, reason }`: tool `extract_conversation_request` with `{ kind: 'none' | 'support' | 'reveal_secret' | 'pledge', offerSilver, hookId, arguments, argumentScore }`. The client drops arguments whose `kind` is unknown and clamps `argumentScore` to 0..10; the engine grounds them.
  - `replyAsCharacter({ personId, text, history, view, outcome, callModel }) -> { ok: true, reply } | { ok: false, reason }`: tool `reply_as_character` `{ reply }`, at most 800 characters. `outcome` is `null` (small talk) or `{ kind, accepted }`; the prompt states the outcome as fixed and forbids a reply that contradicts it.
  - The conversation prompt holds the speaker's name, traits, office, opinion of the representative with reasons, up to 12 memories the speaker knows that involve the speaker or the representative (newest first), the speaker's secrets as type and subject name only, and the representative's hooks over the speaker. `callKind: 'converse'`.
  - Interpret: the schema gains `occasionId`, `secretId`, `hookId`, `topic`; validation checks each against the entry's `fields` options, as for selects.
  - Year prompt: `buildCharacterPromptContext` adds `prisoners`, active `occasions`, and `rumors` (presentation shape), and describes the new contested actions through the existing `contestedActions` list. It never includes `truthful`, `sourceId`, unexposed secrets the player does not hold, or estimate values.

- [ ] **Step 1: Write the failing tests:** extract maps an answer to a request and drops an unknown argument kind; a score of 25 becomes 10; reply is passed the outcome and a reply over 800 characters is rejected and retried once; small talk returns `request: null`; interpret validates `secretId` against the field options and refuses a foreign one; the year prompt carries prisoners and rumors without `truthful` or `sourceId`; the conversation prompt holds no rumor truth and no secret the speaker does not hold.
- [ ] **Step 2: Run** `node --test src/Game/Characters/characterModelCalls.test.js src/runtime/characterWorld*.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add conversation calls and Phase 2 facts to the model prompts"`.

---

### Task 10: Panel: intrigue tab, conversation view, feast, prisoners

**Files:**
- Create: `src/Game/Characters/IntrigueView.jsx`
- Create: `src/Game/Characters/ConversationView.jsx`
- Modify: `src/Game/Characters/CharactersPanel.jsx` (tab, mount points)
- Modify: `src/Game/Characters/ActionBox.jsx` (`ContestedForm` renders the new selects)
- Modify: `src/Game/Characters/characters.css`
- Modify: `src/Game/Characters/CharactersPanel.test.js`

**Interfaces:**
- Consumes: presentation fields from Tasks 3 to 8; `extractConversationRequest`, `replyAsCharacter` (Task 9); `estimateConversationForView`, `submitConversationRequest`, `submitCharacterCommand`.

UI, all copy in Swedish:

1. A tab `Intriger` after `Beslut` with sections `Hemligheter du känner till` (type label, subject, evidence `svagt`/`starkt`, `avslöjad`), `Grepp` (over whom, strength, used), `Fångar` (name, since, ransom, buttons `Frige` and `Avrätta`, the second behind a confirm step `Vill du avrätta <namn>? Det går inte att ångra.`), `Rykten` (date, topic label, claimed actor or `okänd`, reliability), and the scheme list from Phase 1.
2. The council view shows an active feast as `Gästabud pågår till <datum>`. `Håll gästabud` appears through the catalog menu like any command entry.
3. On the `Personer` tab, people in `conversationTargets` get a button `Samtala`. It opens `ConversationView`: the transcript (session memory only), a textarea `Vad säger du?`, a button `Säg det`. Flow: extract; with a request, show a confirmation card with the request label, the odds from `display` (numbers or bands), the offer and buttons `Fråga` and `Avbryt`; on `Fråga` submit, then reply with the outcome; without a request, reply directly. A failed reply keeps the outcome and shows `Svaret kunde inte skrivas; utfallet gäller.` Model text renders as React text.
4. `ContestedForm` renders the `secretId`, `hookId` and `topic` selects from `fields`.

- [ ] **Step 1: Write the failing render tests** with the file's helpers: the tab renders each section from a stub view; `Avrätta` asks for confirmation before submitting; `ConversationView` shows bands for a low-diplomacy representative and numbers for a high one; a refused request renders the refusal and the reply; a failed reply renders the fallback note; the new selects render in the menu form.
- [ ] **Step 2: Run** `node --test src/Game/Characters/CharactersPanel.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the panel tests and `npx eslint src/Game/Characters`. Expected: PASS, no lint errors.
- [ ] **Step 5: Commit** `git commit -m "Add the intrigue tab, court conversations and feast status to the character panel"`.

---

### Task 11: Documentation, full verification and play script

**Files:**
- Modify: `README.md`
- Modify: `docs/development/CONTINUE-HERE.md`
- Modify: `src/runtime/characters/CONTRACT.md` (new commands, origins, streams)
- Create: `docs/play-scripts/phase-2.md`

- [ ] **Step 1: Write the play script** in English, in the Phase 1 script's style (Swedish labels exactly as shown): start a campaign on `Normal`; appoint `Sera Arel` spymaster; hold a feast; type `Jag förgiftar Tarek under gästabudet` and read the odds and the feast row; confirm and follow the scheme to its outcome; open `Intriger` and read secrets and rumors; talk with a household member and ask for support with a grounded argument; advance years on `Svår` until a rumor or a `plot_uncovered` decision appears, and act on it; imprison a rival and answer the ransom offer; type a name that does not exist and read the message.
- [ ] **Step 2: Update** the README, `CONTINUE-HERE.md` and `CONTRACT.md` with the actual totals from Step 3.
- [ ] **Step 3: Run the full verification.**

Run: `node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"`
Expected: 0 fail.

Run: `npm run lint`
Expected: no new errors compared with `origin/main` (report both counts).

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 4: Commit** `git commit -m "Document Phase 2 and add its play script"`.

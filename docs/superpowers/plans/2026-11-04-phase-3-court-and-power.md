# Phase 3: Court and Power Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The ruler earns a nickname, proclaims reign goals that add legitimacy, breaks down under decisions against their nature, governs by fear, answers the great families' demands, faces a hidden faction that can force abdication, and appoints a council whose loyalty decides how well it serves.

**Architecture:** Seven new modules under `src/runtime/characters/` (`reign.js`, `council.js`, `dread.js`, `nicknames.js`, `breakdowns.js`, `familyDemands.js`, `factions.js`) hang off one orchestrator, `court.js`. `index.js` calls `courtAnnualStep` once a year after `npcPlotStep`, dispatches three new story types to `court.js`, and gains two commands. Existing fields carry the moments where they can: `person.stress`, `person.fear`, `person.loyalty`, `family.grievance`, `realm.legitimacy` and `realm.prestige`. The presentation gains one read, `view.court`, built only from what the player knows; `view.people` loses `loyalty`. The model reads `view.court` through the year prompt and gets no new tool or effect kind.

**Tech Stack:** Node 24, ES modules, React 18 (JSX), `node:test`, Vite. Local model bridge as in Phases 1 and 2.

**Spec:** `docs/superpowers/specs/2026-10-31-ai-game-master-design.md` (sections 5.2, 5.4, 5.7, 5.8, 8, 10, Phase 3 in section 9, moments 11 to 17). Phases 0 to 2 are on `main`. Start branch `phase-3/court-and-power` from `main` after the Phase 2 review fixes have merged. This plan cites function names and no line numbers, because those fixes move code.

## Global Constraints

- `rulesVersion` and `contentVersion` stay `'hadara-1.0.0'`. `EXTENSIONS_VERSION` becomes `3`. `ensureCharacterExtensions` migrates a version-1 or version-2 state additively and idempotently.
- All randomness comes from saved streams. Do not change the order of `random(state)` draws in `annualStep`, and never add a draw to `state.rngState`. Demand and faction rolls use `plotRandom`. The one player roll, `crush`, uses `actionRandom`. Nothing is drawn before every other check has passed.
- `courtAnnualStep` runs after `npcPlotStep`, so Phase 2 draws within a year keep their order. Later years see a shifted `plotRngState`. An existing test that crosses two year turns on a searched plot seed may need a new seed; its assertions stay.
- Whole-year and split-date advances stay identical. Every story with a due-date consequence joins `storyDeadlines` in `getNextCharacterTransitionDate`.
- Migration, estimates, presentations, prompts and validation draw nothing and spend nothing. Replay never calls the model.
- Odds stay integers from 5 to 95. Every new modifier row has a Swedish `label` and an integer `value`.
- Player text is Swedish with å, ä and ö. Comments and docs are English. Refusals are one Swedish sentence.
- New systems live in their own modules. `index.js` changes only at the hook points each task names. Functions stay under about 50 lines. Do not change existing `rawStoryChoices` branches or Phase 1 and 2 thresholds.
- `actionResolution.js`, `npcPlots.js` and `schemes.js` import each other in a cycle, so new modules use their exports only inside functions, never at top level.
- Hidden values never reach `getCharacterPresentation` or a prompt: `person.loyalty`, `factions[].memberIds` outside `knownMemberIds`, an undiscovered faction's existence, and `ambitionOf`. New hidden values never sit on a person, because `{ ...copy(p) }` copies every person field into `view.people`.
- The wish-machine anti-goal holds: prompt wording never changes odds or outcomes. No new command takes free text. A nickname comes from the engine table only.
- Normal is the balance baseline. `Lätt` and `Svår` scale demand and faction chances with `AGGRESSION` from `npcPlots.js` (0.5, 1, 1.5).
- Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; author `sp1e <simon.pn@protonmail.com>`.

**Rulings on what the spec leaves open:**

- Section 8's "ambitions" are two things. A ruler's ambitions are the reign goals of moment 12. An NPC's ambition is derived by `ambitionOf` from traits, family and opinion on every read. It is never stored, so no save field can leak or be forged.
- Section 10: `realm.prestige` stays. Deeds raise it, it adds legitimacy once it passes 30, and it decides the nickname `den Store`.
- Section 8's sources of legitimacy: `realm.legitimacy` stays one number with all its writers. `state.reign.sources` counts what accession, goals and prestige added. The rest shows as the row `Styre och händelser`, so the rows always add up.
- Moment 11: a ruler earns one nickname and keeps it. The table has male and female forms, because the engine makes Arel female (`sex: index % 2 === 0`).
- Moment 13: the first crossing of stress 80 opens the existing `stress_crisis`. A second crossing within 60 months, or stress 100, opens `stress_breakdown`. `stress_crisis` alone costs too little to break anyone: `Sök stöd i hushållet` costs 15 silver for −25 stress.
- Moment 14: dread is the mean `person.fear` of living free adults outside the ruler's family, derived and never stored. `banish` keeps its +15.
- Moment 15: demands and factions run only while the player holds the crown (`canRule`). Under an NPC ruler in family mode the existing `coup` stays the only threat. Automatic office filling and `office_promise` keep their reactions; only player appointments and granted demands trigger `seatReaction`.
- Moment 16: the claimant is the ruler's adult free sibling (a shared id in `legalParentIds`, oldest first), else the first adult free person in `rulerCandidates`, else the faction leader. Arel has no sibling in a new campaign, so her first claimant is the heir. Once Sera Arel (28) reigns, Tarek Arel (26) is the brother the moment names.
- The player can lose: an ignored ultimatum, or a failed `crush`, removes the ruler by force, and the new ruler starts at legitimacy 35. A forced abdication does not end the campaign. Realm mode follows the government and family mode follows the family, as `updateStatus` does today. The cost is the ruler, the goals, 15 prestige and 15 family influence, plus prison and 5 more legitimacy when `depose` confines the old ruler.
- A faction waits 24 months into a reign, and one exists at a time. Any accession voids it, because the demand names one ruler. An ultimatum waits while a `coup` story is open.
- Moment 17: chancellor, general and spymaster are the council seats. `Överstepräst` stays outside, because no goal or order reads it. Without a spymaster the player reads loyalty in three bands from half the representative's intrigue. Exact values need a spymaster with intrigue 12 or more who serves well.
- Service below 50 scales the spymaster's intrigue, and service at 50 or more leaves it alone, so Phase 2 numbers hold for the default spymaster.

**Balance baseline, measured 4 November 2026 on the real engine:** twelve seeds with no player action over ten years gave a maximum representative stress of 12 to 30, a lowest family support of 30 to 36, fear 0, and a ruler change by year 10 in 10 of 12 seeds. Seeds from 11 to 110 kill Arel in year 1, because xorshift starts low, so the balance seeds start at 321 and include the default campaign seed 104729. A scratch prototype of the numbers in Tasks 5 to 8 over eight seeds gave demands, a faction, a stress crisis, a breakdown and a nickname in all eight, and an ultimatum in seven.

## Review Focus

1. **A version-2 save in mid-campaign** (open stories, active schemes, prisoners) migrates once, keeps all three random streams, and replays a year identically after a JSON round trip. Owner: Task 1, test "a version-2 save migrates once to version 3 and replays a year identically".
2. **Hidden court facts** stay out of every read path: `view`, the year prompt, the calendar forecast, a conversation's exact odds, `crush` odds and the discovery event's text. Owner: Task 9, test "hidden court facts never reach the presentation or the year prompt"; the odds paths are pinned in Task 2, test "conversation odds never show more than the loyalty precision", and Task 8, test "crush odds never show more than the loyalty precision".
3. **An ignored ultimatum** removes the ruler on its exact date, with identical state for a whole-year advance, a split advance and a JSON round trip between. Owner: Task 8, test "an ignored ultimatum forces abdication on its date, the same for whole and split advances".
4. **The ruler dies with the court in motion** (open ultimatum, open demand, open breakdown, active goals): the next ruler inherits no story, charge or penalty from them. Owner: Task 8, test "a ruler's death voids the faction, the demand, the breakdown and the goals without a penalty".
5. **The claimant changes before the deadline** (dies, goes to prison, or no adult kin exists): the faction picks the next claimant with no draw, or dissolves, and `crown` never receives a dead or imprisoned person. Owner: Task 8, test "the claimant falls through sibling, heir and leader and is replaced before the deadline".

---

### Task 1: Version 3 save, reign record, court step

**Files:**
- Create: `src/runtime/characters/reign.js`, `src/runtime/characters/reign.test.js`
- Create: `src/runtime/characters/court.js`, `src/runtime/characters/court.test.js`
- Modify: `src/runtime/characters/extensions.js`, `src/runtime/characters/extensions.test.js`
- Modify: `src/runtime/characters/index.js` (`charge`, `crown`, `annualStep`, `actionHooks`, `normalizeCharacterSystem`, `getCharacterPresentation`)

**Interfaces:**
- Produces:
  - `EXTENSIONS_VERSION = 3`. `CONTAINER_LISTS` gains `nicknames`, `familyDemands`, `factions`. `ensureCharacterExtensions` turns versions 1 and 2 into 3 and fills `state.reign` with `defaultReign(state)` when it is missing.
  - `state.reign`: `{ rulerId, startedAt, lawful, deeds, goals, sources: { accession, goals, prestige }, lostOrders }`. `deeds` holds integer counts for `DEED_KEYS = ['cruel', 'betrayal', 'generous', 'risky', 'surrender', 'executions', 'breakdowns', 'goalsMet']`. A migrated save gets `startedAt: state.date`, `lawful: true`, `sources.accession: realm.legitimacy`, `lostOrders: 0`.
  - `reign.js`, importing only `gameDates.js`: `defaultReign(state)`; `beginReign(state, person, { lawful, legitimacy })`, which marks active goals `abandoned` and writes a fresh record (`rulerId` null when `person` is null); `recordDeed(state, key)`, a no-op for an unknown key; `reignMonths(state)`; `grantLegitimacy(state, source, amount)`, which clamps to 0..100, adds the applied change to `sources[source]` and returns it, with `source` in `goals`, `prestige`; `addPrestige(state, amount)`, clamped to 0..100; `legitimacySources(state)` returning rows `{ label, value }` labelled `Tronföljd`, `Uppnådda mål`, `Ryktbarhet`, `Styre och händelser`, zero rows left out, summing to the rounded legitimacy; `validateReign(state)`.
  - `court.js`: `courtAnnualStep(state, events, hooks)`, which returns at once when `!state.realm.alive`; `onAccession(state, person, { lawful, legitimacy })`; `presentCourt(state, hooks)` returning `{ reign, legitimacy: { value, sources }, prestige }`; `validateCourt(state)`. Later tasks extend all four and add `COURT_STORY_TYPES`.
  - `actionHooks` gains `crown(person, events, reason, legitimacy, lawful)`, `assignOffice(office, candidate, events, reason)`, `familySupport(family)`, `rulerCandidates()`, `canRule()`, `militaryReadiness()`, `appointReason()` (`royalDecisionReason(state, 'appoint')`).
  - `charge` calls `recordDeed` with its `tag` when the paying actor is `state.reign.rulerId`. `crown` calls `onAccession` last. `annualStep` calls `courtAnnualStep` after `npcPlotStep`. `normalizeCharacterSystem` calls `validateCourt` beside `validatePrisoners`. `getCharacterPresentation` returns `court`.
- `validateReign` sentences follow the `INVALID` style in `prisoners.js`: `Regeringens uppgifter i sparfilen är ogiltiga.` and `Rikets ryktbarhet är ogiltig.` `realm.prestige` must be finite within 0..100.

- [ ] **Step 1: Write the failing tests:** "new campaigns are on extensions version 3 with an empty court ledger"; "a version-2 save migrates once to version 3 and replays a year identically" (Review Focus 1: strip the new fields from a save with an open story, an active scheme and a prisoner, normalize twice and through JSON, assert equal `rngState`, `actionRngState`, `plotRngState`, then equal state after a year); "forged reign records are rejected" (a table of wrong deeds, a negative `lostOrders`, an unknown ruler, prestige 101, source keys that are not numbers); "legitimacy sources add up to the rounded legitimacy", including after a `realm_effect`, which lands in `Styre och händelser`; "crown opens a new reign and abandons active goals"; "charge records a deed only for the reigning ruler"; "the court step leaves rngState and actionRngState alone"; "presentCourt draws nothing and spends nothing". Update the existing version-2 tests in `extensions.test.js` to version 3.
- [ ] **Step 2: Run** `node --test src/runtime/characters/reign.test.js src/runtime/characters/court.test.js src/runtime/characters/extensions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add extensions version 3 with the reign record and the court step"`.

---

### Task 2: Council service and hidden loyalty

**Files:**
- Create: `src/runtime/characters/council.js`, `src/runtime/characters/council.test.js`
- Modify: `src/runtime/characters/index.js` (`getCharacterPresentation` people map, `COMMAND_TYPES`, `PUBLIC_COMMANDS`, `executeCommand` branch, `getAvailableCharacterActions`)
- Modify: `src/runtime/characters/schemes.js` (`spymasterWatch`), `src/runtime/characters/rumors.js` (the listener), `src/runtime/characters/conversation.js` (`presentChance` caller)
- Modify: `src/runtime/characters/court.js`, `src/runtime/characters/characters.test.js` (any read of `view.people[].loyalty`)

**Interfaces:**
- Consumes: `actionHooks` (Task 1), `precisionFor`, `PRECISION_BANDS` (`actionOdds.js`), `spymasterOf` (`extensions.js`).
- Produces in `council.js`:
  - `COUNCIL_SEATS = ['chancellor', 'general', 'spymaster']`.
  - `serviceOf(state, officeId, hooks) -> number | null`: null when vacant, else `clamp(round(loyalty + opinionOfRuler × 0.3 + (dutiful ? 10 : 0) − (ambitious ? 5 : 0)), 0, 100)`.
  - `serviceTier(service)`: `trogen` at 70 or more, `pålitlig` at 50, `motvillig` at 30, `opålitlig` below.
  - `effectiveIntrigue(state, person, hooks)`: floor(`person.skills.intrigue` × factor), factor 1 at service 50 or more, 0.75 at 30 to 49, 0.5 below 30.
  - `readerIntrigue(state, hooks)`: the spymaster's `effectiveIntrigue`, else floor(representative's intrigue / 2).
  - `loyaltyPrecision(state, hooks)`: `precisionFor(readerIntrigue)`.
  - `loyaltyLabel(value, precision)`: at `exact` `` `${value} av 100` ``; at `five` `mycket svag`, `svag`, `jämn`, `stark`, `mycket stark`; at `three` `svag`, `oviss`, `stark`. Band edges come from `PRECISION_BANDS`, with 96 to 100 in the top band, so a band always contains the true value.
  - `capPrecision(a, b)`: the coarser of two precisions.
  - `presentLoyalty(state, person, hooks) -> { label, precision } | null`: null for the representative.
  - `ambitionOf(state, person, hooks)`: first match of `throne` (ambitious, family influence 50 or more, opinion of the ruler 0 or less), `office` (holds no office and is ambitious or has `goal.type === 'office'`), `city` (family head whose family holds fewer cities than another), `wealth` (greedy), `security`. Labels `Tronen`, `Ett ämbete`, `En stad`, `Rikedom`, `Trygghet`.
  - `loyaltyDriftStep(state, hooks)`: for each seat holder, +1 at opinion of the ruler 20 or more, −2 at −20 or less, −1 at family grievance −10 or less; clamp 0..100.
  - `chancellorYield(state, hooks) -> integer`: `clamp(round(skills.stewardship × (service − 50) / 25), −12, 12)`, 0 when vacant. `chancellorStep(state, hooks)` adds it to `realm.treasury`, floor 0, with no event, so no log line reveals the sign.
  - `rewardCouncillor(state, officeId, hooks)`: `reward_councillor` command, `Belöna en rådsmedlem`, 20 silver of realm funds, 1 order, tag `generous`, loyalty +8, field `officeId` (`Ämbete`) listing filled seats. Refusals `Ämbetet är vakant.` and `Rådsmedlemmen belönades nyligen.` (`person.cooldowns.council_reward`, 12 months).
  - `presentCouncil(state, hooks)` -> `{ seats: [{ officeId, name, holderId, holderName, serviceLabel }], ambitions: [{ personId, name, ambitionLabel }] }`. `serviceLabel` applies `loyaltyLabel(clamp(service, 5, 95), loyaltyPrecision)`. `ambitions` is empty at `three` precision and lists other families' heads at `five` or better.
- `view.people[]` gets `loyalty: undefined` and `loyaltyReading: presentLoyalty(...)`. `view.court` gains `council`. `courtAnnualStep` runs `loyaltyDriftStep`, then `chancellorStep`.
- `spymasterWatch` and the rumor listener read `effectiveIntrigue`. The conversation estimate uses `capPrecision(precision, loyaltyPrecision)`: an exact row `Personens lojalitet` would reveal loyalty to a skilled talker, so the cap goes on the whole display.

- [ ] **Step 1: Write the failing tests:** "service follows loyalty, opinion and personality"; "a spymaster below 50 service hears less and sees less" (factor table through `spymasterWatch` and `hearScheme`); "Phase 2 numbers hold at 50 service or more"; "loyalty bands contain the true value" at 20, 21, 35, 36, 40, 41, 60, 61, 65, 66, 80, 81; "the presentation carries no loyalty and reads it at the reader's precision" (no spymaster gives three bands, Sera at intrigue 7 five, intrigue 12 exact, and a spymaster at service 20 drops a band); "conversation odds never show more than the loyalty precision" (diplomacy 14 without a spymaster shows a band and no number); "loyalty drifts with opinion and grievance"; "the chancellor's yield follows service and draws nothing"; "reward_councillor raises loyalty once a year and refuses a vacant seat"; "ambition reaches the view only at five-band precision or better".
- [ ] **Step 2: Run** `node --test src/runtime/characters/council.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Let council loyalty decide service and hide true loyalty behind the spymaster"`.

---

### Task 3: Dread

**Files:**
- Create: `src/runtime/characters/dread.js`, `src/runtime/characters/dread.test.js`
- Modify: `src/runtime/characters/prisoners.js` (`executePrisoner`), `src/runtime/characters/npcPlots.js` (`plotScore`), `src/runtime/characters/actionResolution.js` (`refusalChance`), `src/runtime/characters/index.js` (`actionContext` `situation`), `src/runtime/characters/court.js`

**Interfaces:**
- Consumes: `recordDeed` (Task 1), `setRelationship` (`secrets.js`).
- Produces in `dread.js`:
  - `dreadOf(state, hooks) -> integer`: rounded mean `fear` of living free adults outside the ruler's family, 0 with none.
  - `cowNobles(state, amount, hooks)`: raises `fear` of the same people, clamp 0..100.
  - `onExecution(state, person, noteId, hooks)`: `cowNobles` by 20; the victim's family adults gain 15 more; their family's grievance falls 10; each adult relative with `vengeful` or `brave` becomes `nemesis` of the ruler through `setRelationship` with `causeId: noteId`; `recordDeed('executions')`. `executePrisoner` calls it after `hooks.memory` and before `hooks.kill`, with that memory's id.
  - `dreadRows(target)`: one success row `Rädsla för härskaren`, `min(10, floor(target.fear / 10))`, for `sway`, `blackmail` and `imprison`, none at 0.
  - `dreadYearStep(state, hooks)`: at dread 40 or more, legitimacy −1 and every other family's grievance −1.
  - `presentDread(state, hooks)` -> `{ value, label }`: `Ingen fruktar kronan` below 15, `Adeln är på sin vakt` below 40, else `Adeln lever i skräck`.
- `plotScore` subtracts `fear × (cautious or craven ? 0.4 : 0.15)`, the coefficients of `evaluateCharacterDecision`. `refusalChance` subtracts `fear × 0.2`. `actionContext.situation` appends `dreadRows` to the success rows; `npcActionContext` does not. `view.court` gains `dread`. `courtAnnualStep` runs `dreadYearStep` after `chancellorStep`.

- [ ] **Step 1: Write the failing tests:** "an execution cows every noble and more of the victim's kin"; "an execution makes enemies of vengeful and brave kin"; "dread lowers an NPC's plot score"; "a frightened actor refuses less often"; "the fear row helps sway, blackmail and imprison and only those"; "dread 40 costs legitimacy and goodwill each year"; "no fear changes nothing" (Phase 2 odds and scores are unchanged at fear 0).
- [ ] **Step 2: Run** `node --test src/runtime/characters/dread.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Make executions cow the nobles and make enemies"`.

---

### Task 4: Reign goals, prestige and nicknames

**Files:**
- Modify: `src/runtime/characters/reign.js`, `src/runtime/characters/reign.test.js`
- Create: `src/runtime/characters/nicknames.js`, `src/runtime/characters/nicknames.test.js`
- Modify: `src/runtime/characters/index.js` (`COMMAND_TYPES`, `PUBLIC_COMMANDS`, command branch, `getAvailableCharacterActions`, people map), `src/runtime/characters/court.js`

**Interfaces:**
- Consumes: `serviceOf` (Task 2), `dreadOf` (Task 3), `grantLegitimacy`, `addPrestige`, `recordDeed` (Task 1).
- Produces in `reign.js`:
  - `REIGN_GOALS`, frozen:

| id | label | description | months | legitimacy | met when |
|---|---|---|---|---|---|
| `fill_treasury` | `Fyll statskassan` | `Statskassan ska rymma minst 300 silver och 80 mer än när målet sattes.` | 60 | 6 | `treasury >= max(300, baseline + 80)` |
| `strong_army` | `Stärk hären` | `Arméns styrka ska nå minst 70 och stiga med 15.` | 60 | 6 | `armyStrength >= max(70, baseline + 15)` |
| `reconcile_houses` | `Försona de stora husen` | `Varje annan familj ska ge kronan minst 55 i politiskt stöd.` | 60 | 10 | `familySupport >= 55` for every other family not in exile |
| `lasting_work` | `Lämna ett bestående verk` | `En akademi eller en vattenledning ska stå färdig.` | 72 | 8 | a project of kind `academy` or `aqueduct` is completed with `dueAt` on or after `setAt` |
| `full_council` | `Fyll rådet med trogna` | `Kansler, överbefälhavare och spionmästare ska alla tjäna väl.` | 36 | 5 | `serviceOf` of each seat is 50 or more |
| `cow_nobles` | `Håll adeln i schack` | `Adelns rädsla ska nå minst 30.` | 60 | 6 | `dreadOf >= 30` |

  - Goal record: `{ id: 'goal-<n>', type, baseline, setAt, dueAt, status, closedAt }`, `status` in `active`, `met`, `failed`, `abandoned`. `baseline` is the treasury or army strength when set, else 0.
  - `goalRefusal(state, goalType, hooks) -> string`: `Målet finns inte.`, `Två mål är redan utlysta.`, `Målet har redan prövats under denna regering.`, and for `lasting_work` when the ruler's archetype action is neither `academy` nor `aqueduct` and no such project is active: `Härskaren kan inte bygga ett sådant verk.`
  - `setReignGoal(state, goalType, hooks)`: `set_reign_goal` command, `Sätt ett mål för regeringen`, 0 silver, 1 order, tag `duty`, field `goalType` (`Mål`). In `PUBLIC_COMMANDS`, behind `requireRule`. `MAX_ACTIVE_GOALS = 2`.
  - `goalStep(state, events, hooks)`: in array order. Met: `grantLegitimacy('goals', table value)`, `addPrestige(10)`, `recordDeed('goalsMet')`, ruler stress −10, public event and memory `Regeringsmålet uppnått: <label>`. Past `dueAt`: legitimacy −3, ruler stress +10, public event `Regeringsmålet förfelat: <label>`.
  - `prestigeStep(state)`: `grantLegitimacy('prestige', floor(max(0, prestige − 10) / 20))`, then prestige −1 down to a floor of 10, so a passive campaign keeps exactly today's legitimacy.
  - `presentReign(state, hooks)`: `{ rulerId, rulerName, startedAt, goals: [{ id, type, label, description, dueAt, status, statusLabel }] }`, with `statusLabel` `Pågår`, `Uppnått`, `Förfelat`.
- Produces in `nicknames.js`:
  - `NICKNAMES`, in evaluation order, first match wins: `cruel` (`den Grymme`/`den Grymma`, executions 2 or cruel deeds 4), `great` (`den Store`/`den Stora`, goals met 2 or prestige 40), `treacherous` (`den Lömske`/`den Lömska`, betrayal deeds 4), `generous` (`den Givmilde`/`den Givmilda`, generous deeds 3), `frail` (`den Bräcklige`/`den Bräckliga`, breakdowns 1), `usurper` (`Tronrövaren` for both, `reign.lawful === false`), `quiet` (`den Stillsamme`/`den Stillsamma`, reign of 48 months).
  - `state.nicknames` records `{ personId, nicknameId, earnedAt }`, one per person.
  - `nicknameStep(state, events, hooks)`: runs for an adult ruler without a nickname after 24 reign months, public event and memory `<name> kallas nu <label>`, no draw.
  - `nicknameOf(state, personId) -> label | null`; `validateNicknames(state)` with `Ett tillnamn i sparfilen är ogiltigt.`
- `view.people[]` gains `nickname`. `view.court` gains `reign` from `presentReign`. `courtAnnualStep` order: `goalStep`, `prestigeStep`, `nicknameStep`, placed after `dreadYearStep`.

- [ ] **Step 1: Write the failing tests:** one "met" and one "not met" case per goal row; "a met goal adds its legitimacy once and counts under Uppnådda mål"; "a missed deadline costs legitimacy and stress"; "goal refusals" (each sentence, including a forged `goalType` of `Bli världshärskare`); "a successor inherits no goal and no penalty"; "prestige adds legitimacy from 30 and a passive year changes nothing"; "the nickname follows the table in order"; "the nickname matches the ruler's sex"; "a nickname is earned once and survives the ruler's death"; "forged nickname records are rejected"; "a command payload cannot set a nickname".
- [ ] **Step 2: Run** `node --test src/runtime/characters/reign.test.js src/runtime/characters/nicknames.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add reign goals, prestige and earned nicknames"`.

---

### Task 5: Stress breakdowns

**Files:**
- Create: `src/runtime/characters/breakdowns.js`, `src/runtime/characters/breakdowns.test.js`
- Modify: `src/runtime/characters/index.js` (`stressFor`, the `stress_crisis` line in `annualStep`, `rawStoryChoices`, `resolveStory`, `refreshStories`, `getNextCharacterTransitionDate`), `src/runtime/characters/court.js`
- Modify: `src/runtime/characterWorld.js` (the two story-type lists in the advance loop), `src/runtime/characterWorld.test.js`

**Interfaces:**
- Consumes: `recordDeed`, `addPrestige`, `grantLegitimacy` (Task 1), `cowNobles` (Task 3).
- Produces in `breakdowns.js`:
  - `natureStress(person, tag)`, added to `stressFor`: `cruel` just +8; `betrayal` honest +12, just +6; `risky` craven +12, paranoid +6; `surrender` brave +8. A `cruel` person pays 0 for tag `cruel` and a `deceitful` person 0 for tag `betrayal`. Every other existing value stays.
  - `CRISIS_STRESS = 80`, `BREAKDOWN_STRESS = 100`, `CRISIS_MEMORY_MONTHS = 60`.
  - `breakdownDue(state, actor)`: stress 100 or more, or stress 80 or more with a resolved `stress_crisis` of this actor created within 60 months. A crisis still open does not count, so one year turn cannot open both. The `stress_crisis` line in `annualStep` gains `&& !breakdownDue(state, actor)`.
  - `stressPressureStep(state, hooks)`: on the representative, +4 per demand refused or lapsed in the last 12 months, +6 per faction the player knows of, +4 per goal failed in the last 12 months, +3 at treasury below 20; at most +15 a year. Tasks 6 and 7 add the records it reads. It sums over empty lists until then.
  - `breakdownStep(state, events, hooks)`: opens `stress_breakdown` for the representative when `breakdownDue` and none is open: `actorId`, title `` `${name} bryter samman` ``, `knownBy: 'public'`, `dueAt` +6 months, `deadlineText: 'Utan ett val kostar sammanbrottet 20 hälsa, 8 legitimitet och årets alla handlingar.'`, public event `Sammanbrott vid hovet`.
  - `breakdownChoices(state, story, hooks)`, each `{ id, label, description, cost, stress }`:
    - `withdraw`, `Dra dig undan hovet`: stress −50, `state.actionPoints = 0`, `reign.lostOrders = 2`, legitimacy −4.
    - `rage`, `Släpp lös vreden`: stress −40, `cowNobles(10)`, each other family head's opinion −15, legitimacy −2.
    - `vice`, `Sök tröst i vinet`: stress −35, health −15 (floor 1), family treasury −30 (floor 0).
  - `resolveBreakdown(state, story, choiceId, events, hooks)` and the expiry `collapse`: stress −30, health −20, `actionPoints = 0`, `lostOrders = 2`, legitimacy −8. Every path runs `recordDeed('breakdowns')` and `addPrestige(−5)`.
- Produces in `court.js`: `COURT_STORY_TYPES = ['stress_breakdown', 'family_demand', 'faction_ultimatum']`; `courtStoryChoices(state, story, hooks)`; `resolveCourtStory(state, story, choiceId, events, hooks)`; `refreshCourtStories(state, events, hooks)`, a dispatch table that Tasks 6 and 8 extend.
- `refreshCourtStories` expires a story past `dueAt` by writing `status: 'resolved'`, `choiceId` and `resolvedAt` itself, as `refreshStories` does for `ransom_offer`; `resolveStory` refuses a choice outside the list, so an expiry cannot pass through it. A breakdown whose actor is dead or no longer the representative closes with no cost.
- `rawStoryChoices` and `resolveStory` each gain one branch for `COURT_STORY_TYPES`. `refreshStories` calls `refreshCourtStories`. `storyDeadlines` includes `COURT_STORY_TYPES`. Both story-type lists in `planCharacterAdvance`'s loop include them, so a longer advance stops at a new court story. `courtAnnualStep` applies `lostOrders` (subtract from `actionPoints`, floor 0, then reset), then runs `stressPressureStep` and `breakdownStep` last.

- [ ] **Step 1: Write the failing tests:** "stress values for existing tags and traits are unchanged"; "the new traits add stress and the fitting ones remove it"; "the first crossing of 80 opens stress_crisis and the second a breakdown"; "stress 100 opens a breakdown at once"; each choice's exact cost; "every breakdown costs something" (asserts a lost resource on each path, including expiry); "an unanswered breakdown collapses on its date, the same for whole and split advances"; "lost orders apply at the next year turn"; "a breakdown closes without cost when its actor stops being the representative"; in `characterWorld.test.js`, "a new court story stops a longer advance".
- [ ] **Step 2: Run** `node --test src/runtime/characters/breakdowns.test.js src/runtime/characterWorld.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Turn sustained stress into breakdowns with a real cost"`.

---

### Task 6: Family demands

**Files:**
- Create: `src/runtime/characters/familyDemands.js`, `src/runtime/characters/familyDemands.test.js`
- Modify: `src/runtime/characters/index.js` (`appoint` branch), `src/runtime/characters/npcPlots.js` (export `AGGRESSION`), `src/runtime/characters/court.js`, `src/runtime/characters/breakdowns.js`

**Interfaces:**
- Consumes: `ambitionOf` (Task 2), `actionHooks.assignOffice`, `canRule`, `appointReason` (Task 1), `plotRandom`, the dispatch table (Task 5).
- Produces in `familyDemands.js`:
  - Record: `{ id: 'demand-<n>', familyId, kind: 'city' | 'office', targetId, storyId, openedAt, dueAt, status, closedAt }`, `status` in `open`, `granted`, `compensated`, `refused`, `lapsed`, `void`.
  - `demandStep(state, events, hooks)`: returns unless `hooks.canRule()`. Families in id order, skipping the ruler's and the controlled family, exiled ones, a head who is dead, a minor or in prison, an open demand, and a demand within 24 months. Target check next, with no draw: `city` when the head's `ambitionOf` is `city`, else `office`. City target: lowest `baseRevenue` among cities of other families, then id. Office target: first of `chancellor`, `general`, `priest` the family does not hold. Candidate: the family's free adult with the highest sum of skills, then id. Then chance `clamp((30 + (influence − 45) + (ambitious head ? 10 : 0) − head.fear / 2) × AGGRESSION, 5, 70)` on `plotRandom`. The first success opens one demand and ends the step.
  - Story `family_demand`: title `` `${family.name} kräver ${targetName}` ``, description `` `${head.name} vill se familjen i ${targetName}. De andra husen ser vad du svarar.` ``, `actorId` the head, `knownBy: 'public'`, `dueAt` +12 months, `demandId`, `deadlineText: 'Utan svar räknas kravet som avvisat, och familjen tar det hårdare.'`
  - `demandChoices(state, story, hooks)`: `grant`, `Bevilja kravet` (1 order, disabled by `hooks.appointReason()` or a missing candidate), `compensate`, `Köp tid med silver` (40 silver of realm funds, 1 order), `refuse`, `Avvisa kravet` (1 order).
  - `resolveDemand(state, story, choiceId, events, hooks)`. `grant`: `assignOffice(office, candidate, events, 'Familjen får sin vilja')` (a city uses its `governorOfficeId`), family grievance +8, then `seatReaction` with `force: true`. `compensate`: head opinion −3. `refuse`: grievance −8, head opinion −12, each other family grievance +1. Expiry `lapse`: grievance −10, head opinion −15.
  - `seatReaction(state, family, events, hooks, { force = false } = {})`, "favoring one angers the others": each other non-exiled family that now holds at least 2 fewer seats than `family` (or every one under `force`) loses grievance 4 (6 under `force`) and its head's opinion falls 5 (8 under `force`), cause `` `Gynnande av ${family.name}` ``. The `appoint` command calls it for the candidate's family.
  - `voidOpenDemands(state)`, `presentDemands(state)` -> open demands and the last 6 closed as `{ id, familyName, kindLabel, targetName, statusLabel, dueAt }`, with `kindLabel` `Stad` or `Ämbete`; `validateFamilyDemands(state)` with `Ett krav i sparfilen är ogiltigt.`
- `stressPressureStep` reads `refused` and `lapsed`. `onAccession` calls `voidOpenDemands` and closes their stories. A demand whose head dies or family leaves the realm goes `void`. `view.court` gains `demands`. `courtAnnualStep` runs `demandStep` before `stressPressureStep`.

- [ ] **Step 1: Write the failing tests:** "a family with no valid target draws nothing"; "the head's ambition picks a city or an office"; "granting a city moves it and angers the other houses"; "a player appointment that tilts the seats angers the others and an automatic one does not"; each choice's numbers; "an ignored demand lapses on its date with a heavier penalty"; "demands stop under an NPC ruler"; "the 24-month rule holds"; "Svår opens demands sooner than Lätt at a found seed"; "forged demand records are rejected".
- [ ] **Step 2: Run** `node --test src/runtime/characters/familyDemands.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Let the great families demand cities and offices"`.

---

### Task 7: Factions: discontent, secrecy and discovery

**Files:**
- Create: `src/runtime/characters/factions.js`, `src/runtime/characters/factions.test.js`
- Modify: `src/runtime/characters/court.js`, `src/runtime/characters/breakdowns.js`

**Interfaces:**
- Consumes: `serviceOf`, `readerIntrigue`, `loyaltyPrecision`, `ambitionOf`, `serviceTier` (Task 2), `dreadOf` (Task 3), `reignMonths` (Task 1), `bandFor`, `plotRandom`, `AGGRESSION`.
- Produces in `factions.js`:
  - Record: `{ id: 'faction-<n>', targetRulerId, leaderId, claimantId, memberIds, knownMemberIds, formedAt, status, outcome, quietUntil, ultimatumAt, dueAt, storyId, concessions, closedAt }`. `memberIds` and `knownMemberIds` stay sorted, and every known member is a member. `status` in `active`, `ultimatum`, `appeased`, `closed`. `outcome` in `null`, `dissolved`, `abdicated`, `deposed`, `crushed`, `void`.
  - Constants: `DISCONTENT_THRESHOLD = 16`, `LEAVE_BELOW = 5`, `FOUNDERS = 3`, `FORM_BASE = 40`, `JOIN_CHANCE = 50`, `GRACE_MONTHS = 24`, `ULTIMATUM_STRENGTH = 50`, `MATURITY_PER_YEAR = 6`.
  - `discontentOf(state, person, hooks)`: `−opinionOfRuler × 0.5 + (60 − support) × 0.6 − grievance × 0.5 + (60 − legitimacy) × 0.3`, plus ambitious 10, vengeful 8, `ambitionOf === 'throne'` 8, a council seat at service below 30: 10; minus `fear × (cautious or craven ? 0.6 : 0.3)`; plus `fear × 0.3` for vengeful or brave people at fear 15 or more, because fear makes these people enemies.
  - `claimantFor(state, faction, hooks)`: the chain in the rulings, or null.
  - `factionStrength(state, faction, hooks)`: `clamp(round(8 × members + 10 × (families − 1) + (60 − legitimacy) × 0.5 + (topInfluence − 45) × 0.5 − dread × 0.3 + 6 × fullYearsSinceFormed), 5, 95)`.
  - `factionStep(state, events, hooks)`: returns unless `hooks.canRule()`, the ruler is an adult, and `reignMonths` is 24 or more. With no live faction: eligible people are free adults outside the ruler's family, in families not in exile. With 3 or more at `DISCONTENT_THRESHOLD`, one draw at `clamp((40 + topDiscontent) × AGGRESSION, 5, 90)` forms a faction silently: no event, no memory, no log line. The leader has the highest discontent, then the lowest id. With a live faction: members below `LEAVE_BELOW` leave with no draw, then non-members at the threshold draw `JOIN_CHANCE × AGGRESSION` in id order. Under 2 members the faction closes as `dissolved`.
  - Discovery, in `factionStep`, once a year and only with an undiscovered member: chance `clamp(15 + reader × 5, 15, 70)`, +10 with a `trogen` spymaster, on `plotRandom`. A hit adds the first undiscovered member to `knownMemberIds` and logs event `Spår av en faktion` with text `Din spionmästare har hittat ännu en person i en faktion mot härskaren.` (with no spymaster, `Du har hört talas om ännu en person i en faktion mot härskaren.`). The text names nobody, because a forecast passes event text to the model.
  - `refreshFactions(state, events, hooks)`, no draw, called from `refreshCourtStories`: removes dead and imprisoned members and replaces a dead or imprisoned leader (highest discontent) and claimant (`claimantFor`). Dissolves when no claimant or fewer than 2 members remain.
  - `voidFactions(state)`, `validateFactions(state)` with `En faktion i sparfilen är ogiltig.`
  - `presentFactions(state, hooks)` -> `[{ id, stageLabel, knownMembers: [{ id, name }], claimantName, strengthLabel, memberCount, dueAt }]`. A faction with no known member and no ultimatum is left out. `claimantName` is null until 2 members are known or the ultimatum is out. `strengthLabel` is `bandFor(strength, loyaltyPrecision)`. `memberCount` is null below `exact`. `stageLabel` is `I det fördolda`, `Ultimatum` or `Har backat tills vidare`.
- `onAccession` calls `voidFactions`. `stressPressureStep` counts factions `presentFactions` shows. `view.court` gains `factions`. `courtAnnualStep` runs `factionStep` after `demandStep`.

- [ ] **Step 1: Write the failing tests:** one case per `discontentOf` term; "fear holds cautious nobles back and drives vengeful ones"; "a faction needs three discontented nobles and a reign of 24 months"; "forming a faction logs nothing and leaves no memory"; "an unknown faction is absent from the view"; "a discovered member appears at the reader's precision and the rest stay hidden"; "the discovery event names nobody"; "discovery draws only when a member is hidden"; "members who calm down leave with no draw"; "a member who dies or goes to prison is removed on the same date"; "factions stop under an NPC ruler and under a minor"; "forged faction records are rejected", including a known member who is no member.
- [ ] **Step 2: Run** `node --test src/runtime/characters/factions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Form hidden factions from discontented nobles"`.

---

### Task 8: Factions: ultimatum and forced abdication

**Files:**
- Modify: `src/runtime/characters/factions.js`, `src/runtime/characters/factions.test.js`, `src/runtime/characters/court.js`

**Interfaces:**
- Consumes: `factionStrength`, `claimantFor`, `refreshFactions` (Task 7); `actionHooks.crown`, `assignOffice`, `militaryReadiness` (Task 1); `imprisonPerson`, `imprisonRefusal` (`prisoners.js`); `serviceOf`, `capPrecision`, `loyaltyPrecision` (Task 2); `dreadOf`, `cowNobles` (Task 3); `precisionFor`, `bandFor`, `actionRandom`.
- Produces in `factions.js`:
  - In `factionStep`: an `active` faction past `quietUntil`, at strength 50 or more, with no open `coup` story, opens the ultimatum. Its status becomes `ultimatum`, the leader joins `knownMemberIds`, and story `faction_ultimatum` opens: title `Faktionen kräver abdikation`, description naming the leader, the ruler and the claimant, `actorId` the leader, `knownBy: 'public'`, `dueAt` +6 months, `factionId`, `deadlineText: 'Utan svar tvingar adeln härskaren från tronen när tiden går ut.'`, public event `Adeln ställer ett ultimatum`.
  - `crushOdds(state, faction, hooks) -> { value, precision, rows, display }`: `Grundchans` 50; `Härens beredskap` round((readiness − 55) / 2); `Överbefälhavarens tjänst` +8 at service 70 or more, 0 at 50, −8 at 30, −15 below 30 or vacant; `Rikets legitimitet` round((legitimacy − 50) / 3); `Faktionens styrka` −round((strength − 50) / 2); `Rädsla för härskaren` +min(10, floor(dread / 5)). Rows at 0 are left out. Clamp 5..95. `precision` is `capPrecision(precisionFor(general's command), loyaltyPrecision)`, `three` with no general. `display` follows the `presentChance` rule of `conversation.js`.
  - `ultimatumChoices(state, story, hooks)`:
    - `abdicate`, `` `Abdikera till förmån för ${claimant}` ``: tag `surrender`, 1 order.
    - `concede`, `Ge efter för adeln`: `60 + 40 × concessions` silver of realm funds, 1 order, disabled with `Otillräcklig statskassa.`
    - `crush`, `Slå ned faktionen`: 1 order, tag `risky`, description `` `Chans att lyckas: ${label}` ``, field `odds: display`.
  - `resolveUltimatum(state, story, choiceId, events, hooks)`:
    - `abdicate`: `crown(claimant, events, 'Abdikation under tryck från adeln', max(30, legitimacy − 10), true)`, `addPrestige(−8)`, outcome `abdicated`.
    - `concede`: legitimacy −5, `concessions + 1`, status `appeased`, `quietUntil` +36 months, members stay.
    - `crush`: one `actionRandom` draw against `value`. Success: the leader goes to prison through `imprisonPerson` with `lawful: true`, `cowNobles(15)`, each member's opinion of the ruler −15, legitimacy −3, outcome `crushed`. Failure: `depose` with `confine: true`.
  - `depose(state, faction, events, hooks, { confine })` is the expiry `forced` too. It closes the faction with outcome `deposed`, then `crown(claimant, events, 'Adeln tvingar fram en abdikation', 35, false)`, `addPrestige(−15)`, the old ruler's family influence −15, old ruler stress +30, each member family's grievance +10 and its head's opinion of the new ruler +10, the leader becomes `Kansler` through `assignOffice` unless the leader is the claimant, public event `Adeln tvingar härskaren från tronen`. The old ruler goes to prison through `imprisonPerson` (captor the claimant's family, `lawful: false`, so legitimacy falls to 30) when the families differ or `confine` is true, and only when `imprisonRefusal` returns an empty string. `imprisonPerson` throws for a representative, and a deposed ruler in family mode still heads the player's household.
- `refreshCourtStories` runs `refreshFactions` first, so a replaced claimant is the one who is crowned. An `appeased` faction returns to `active` once `quietUntil` passes. `factionStep` handles that at the year turn.

- [ ] **Step 1: Write the failing tests:** "an ultimatum opens at strength 50 and names the leader and the claimant"; "an ultimatum waits while a coup is open and while the faction is appeased"; "crush odds move with each row, stay integers from 5 to 95, and each row has a Swedish label"; "crush odds never show more than the loyalty precision"; "reading the choices draws nothing"; "abdicate crowns the claimant lawfully"; "concede costs more each time"; "crush draws once from the action stream and leaves plotRngState and rngState alone"; "a failed crush deposes the ruler"; "an ignored ultimatum forces abdication on its date, the same for whole and split advances" (Review Focus 3: also through a JSON round trip); "a forced abdication costs the ruler, the goals, prestige and influence and leaves the campaign running in realm and family mode"; "a deposed ruler goes to prison when the claimant is of another family"; "a deposed ruler who still heads the player's household stays free"; "a ruler's death voids the faction, the demand, the breakdown and the goals without a penalty" (Review Focus 4); "the claimant falls through sibling, heir and leader and is replaced before the deadline" (Review Focus 5, asserts `crown` never gets a dead or imprisoned person).
- [ ] **Step 2: Run** `node --test src/runtime/characters/factions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Let a faction force abdication through a dated ultimatum"`.

---

### Task 9: Model boundary and ten-year balance

**Files:**
- Modify: `src/runtime/characterWorld.js` (`buildCharacterPromptContext`), `src/runtime/characterWorld.test.js`
- Create: `src/runtime/characters/courtBalance.test.js`
- Modify, tuning only: the constants listed below

**Interfaces:**
- Consumes: `view.court` (Tasks 1 to 8).
- Produces: `buildCharacterPromptContext` adds `court: view.court` to its JSON block and one rule paragraph: `Nicknames, reign goals, legitimacy sources, family demands, factions and council service are engine facts. Do not invent, grant, resolve or change them. A faction appears here only as far as the player knows it: do not name other members, do not confirm that a faction exists, and do not state a person's loyalty beyond the label given.`
- `courtBalance.test.js`, `SEEDS = [104729, 321, 777, 1234, 9001, 271828, 314159, 20261104]`, Normal, realm mode. `playYear(state, year)` is the scripted player:
  - Each year with `spymaster` vacant: `appoint` the adult of the controlled family, other than the ruler, with the highest `skills.intrigue`, then the lowest id. At the start that is Sera Arel, at service 70.
  - Year 1: `set_reign_goal` `full_council`, and `reward_councillor` on `general`, which lifts Kelan Namar from service 43 to 51.
  - Each year with a free goal slot and an order left: the next unused of `fill_treasury`, `strong_army`, `reconcile_houses`, `cow_nobles`.
  - Each year with an order left: one contested `spread_rumor` against the first living adult of another family, an act against Arel's and Sera's nature.
  - Year 3 on: `imprison` the first free adult of `family-namar` until one is held, then `execute_prisoner`.
  - Stories: `family_demand` alternates `grant` and `refuse`; `stress_crisis` takes `support`; `stress_breakdown` takes `withdraw`; `faction_ultimatum` takes `concede` when affordable, else stays unanswered; every other story takes its first enabled choice.
- The test proves "one playthrough of ten years on Normal sees each system at least once". For **every** seed, across the campaign: a `state.nicknames` record; a log title starting `Regeringsmålet uppnått`; a `stress_breakdown` story; a yearly `dreadOf` of 15 or more; a `granted` demand; a faction with a known member or an ultimatum; a spymaster with `serviceOf` not null; a year with a non-zero `chancellorYield`. For **at least five of eight** seeds: a `faction_ultimatum` story. For one seed: the final state survives `normalizeCharacterSystem` after a JSON round trip, and a whole-year and a month-by-month replay of the same script end equal. A second run with the spymaster's loyalty forced to 10 has lower `readerIntrigue` than the first, which shows loyalty changing service.
- Tuning: if an assertion fails, adjust only these, within these ranges: `DISCONTENT_THRESHOLD` 14..20, `MATURITY_PER_YEAR` 4..8, `ULTIMATUM_STRENGTH` 45..55, the demand base chance 25..40, each `stressPressureStep` row ±2. Never change the assertions, the seeds or the script. If it still fails at the edge of these ranges, stop and report the failing seed and system.

- [ ] **Step 1: Write the failing tests:** in `characterWorld.test.js`, "hidden court facts never reach the presentation or the year prompt" (Review Focus 2: a faction of four with one known member and a claimant still hidden; a forecast crossing a discovery; assert no `memberIds`, `leaderId`, `"loyalty":`, `ambition` key or discontent value in `JSON.stringify(view)` or the prompt, and the three hidden ids absent from `court`); "the year prompt carries the court as the player knows it"; "a model proposal of set_reign_goal, reward_councillor or a court story stays advisory"; "realm_effect stays inside its envelope and never touches reign sources"; "the same choices give the same outcome whatever the player typed". Then the seven systems test, the ultimatum count, the determinism check and the loyalty comparison in `courtBalance.test.js`.
- [ ] **Step 2: Run** `node --test src/runtime/characterWorld.test.js src/runtime/characters/courtBalance.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the prompt change and the test script, then tune within the ranges.
- [ ] **Step 4: Run** `node --test --test-concurrency=1 "src/runtime/**/*.test.js"`. Expected: PASS. Note the final constants in the commit message.
- [ ] **Step 5: Commit** `git commit -m "Give the model the known court and prove ten-year balance"`.

---

### Task 10: Panel: reign, council, demands and factions

**Files:**
- Create: `src/Game/Characters/CourtSections.jsx`
- Modify: `src/Game/Characters/CharactersPanel.jsx` (`PersonSummary`, `CouncilView`, `PeopleView`, `FamiliesView`, `OfficesView`, `StoryCard`)
- Modify: `src/Game/Characters/IntrigueView.jsx`, `src/Game/Characters/characters.css`, `src/Game/Characters/CharactersPanel.test.js`

**Interfaces:**
- Consumes: `view.court`, `view.people[].nickname`, `view.people[].loyaltyReading`, story `choice.odds`.

UI, all copy in Swedish:

1. `PersonSummary` shows the nickname after the name: `Arel av Hadara den Stora`.
2. `CouncilView`'s leader card gains `ReignCard`: a meter `Fruktan` with `court.dread.label`, `Ryktbarhet` as a number, `details` `Vad bär legitimiteten?` with the source rows, and a list `Regeringsmål` with label, description, due date and status. Empty text: `Inga mål är utlysta.`
3. Every `Meter` labelled `Tjänstelojalitet` (the leader measures in `CharactersPanel.jsx` as well as `PeopleView`) becomes a fact row `Tjänstelojalitet` that shows `loyaltyReading.label`, left out when null. Search the file for the label, because `person.loyalty` no longer reaches the panel.
4. `OfficesView` gains `CouncilSeats`, heading `Rådet`: each seat with holder and `Tjänst: <serviceLabel>`, or `Vakant`; with `ambitions` present, a `details` `Vad spionmästaren tror att de vill`.
5. `FamiliesView` gains `DemandList`, heading `Krav från familjerna`, empty text `Inga krav ligger på bordet.`
6. `IntrigueView` gains `FactionList` before `Rykten`, heading `Faktioner`: stage, `Känd krets:` with names, `Pretendent:` or `okänd`, `Styrka:` and `Medlemmar:` when `memberCount` is a number. Empty text: `Du känner inte till någon faktion.` It never says whether one exists.
7. `StoryCard` shows `choice.odds` under the choice: the label and a `details` `Vad påverkar chansen?` with the rows, numbers at `exact` and signs otherwise.
8. `set_reign_goal` and `reward_councillor` need no new control: `getAvailableCharacterActions` lists them, and `ActionBox.jsx` shows them under `Förvaltning och hushåll` in `Välj från listan`.

- [ ] **Step 1: Write the failing render tests** with the file's helpers: each section from a stub view in both empty and filled form; the loyalty row shows a band and no number at `five`, and is gone for the representative; the faction list shows `okänd` for a hidden claimant and no count below `exact`; the nickname in both sexes; `crush` odds as bands; a choice with `disabledReason` stays disabled.
- [ ] **Step 2: Run** `node --test src/Game/Characters/CharactersPanel.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the panel tests and `npx eslint src/Game/Characters`. Expected: PASS, no lint errors.
- [ ] **Step 5: Commit** `git commit -m "Show the reign, the council, demands and factions in the character panel"`.

---

### Task 11: Phase 3 play script

**Files:**
- Create: `docs/play-scripts/phase-3.md`

- [ ] **Step 1: Write the script** in English, in the style of `docs/play-scripts/phase-2.md`, with Swedish labels exactly as the game shows them, where to click, what to type and what to see. Parts:
  - Part 0, prepare, as in Phase 2. State about 90 minutes and 35 model calls; a model year took 118 to 182 seconds in Phase 2.
  - Part 1, start on `Normal` and open `Ämbeten & arv`: under `Rådet`, `Kansler` reads `Tjänst: stark`, `Överbefälhavare` reads `Tjänst: oviss`, and `Spionmästare` reads `Vakant`.
  - Part 2, appoint `Sera Arel` spymaster with `Utse en ämbetsinnehavare`, as in Phase 2. `Överbefälhavare` now reads `Tjänst: jämn`, one of five bands. Check that `Personer` shows `Tjänstelojalitet` as a word.
  - Part 3, `Välj från listan` > `Förvaltning och hushåll` > `Sätt ett mål för regeringen` with `Fyll rådet med trogna`, then read `Regeringsmål` and `Vad bär legitimiteten?`.
  - Part 4, `Belöna en rådsmedlem` on `Överbefälhavare`. The label stays `jämn`, because 8 points stay inside one band. Try it again and read `Rådsmedlemmen belönades nyligen.` At the next year turn the goal reads `Uppnått`.
  - Part 5, imprison `Talia Namar`, who holds no office, and execute her. Read `Fruktan`, `Rädsla` on a noble, and the opinion of the Namar family.
  - Part 6, advance years with the model until `<family> kräver <target>`, grant one and refuse the next, and read each family's support.
  - Part 7, act against nature with `Sprida rykte` each year until `Ansvaret börjar tära`, then until `<name> bryter samman`. Note the choice and its cost.
  - Part 8, read `Faktioner` in `Intriger`. Before any discovery it reads `Du känner inte till någon faktion.` Note the year of `Spår av en faktion`.
  - Part 9, the ultimatum `Faktionen kräver abdikation`: read `Chans att lyckas:` and the rows, then answer `Ge efter för adeln`.
  - Part 10, a second campaign on `Svår` where the ultimatum goes unanswered: `Adeln tvingar härskaren från tronen` on its date, the campaign keeps running, `Legitimitet` reads 35 (30 if the old ruler went to prison), and `Rike & familjer` shows the new ruler.
  - Part 11, the nickname: `<name> kallas nu <label>` in `Krönikan` and on the person.
  - Part 12, reload and check that all of it is still there.
  - "Report back", as in Phase 2, with the years each system first appeared.
  - For each part that depends on rolls, state how many years to wait and what to write down if it does not come.
- [ ] **Step 2: Check** every label in the script against the source with a search for each quoted Swedish string in `src/`. Expected: every string is found.
- [ ] **Step 3: Commit** `git commit -m "Add the Phase 3 play script"`.

---

### Task 12: Documentation and full verification

**Files:**
- Modify: `src/runtime/characters/CONTRACT.md`
- Modify: `README.md`
- Modify: `docs/development/CONTINUE-HERE.md`

- [ ] **Step 1: Update `CONTRACT.md`:** a section `## Phase 3 state, streams and commands` after the Phase 2 section, covering `extensionsVersion` 3, `state.reign`, `state.nicknames`, `state.familyDemands`, `state.factions`, the commands `set_reign_goal` and `reward_councillor`, the story types, the presentation field `court`, the removal of `people[].loyalty`, which stream each roll uses, and the visibility rules. Extend the commands table, the presentation fields and the sentence on the spymaster's service.
- [ ] **Step 2: Update `README.md`:** a `Court and power` section after the Intrigue section in the same style, a link to the Phase 3 play script, and the status paragraph.
- [ ] **Step 3: Update `CONTINUE-HERE.md`:** branch state, Phase 3 engine, model boundary and panel bullets, the final tuned constants, known limitations (a forced abdication does not end a realm campaign; a player can infer an NPC's ambition from traits), and the next step (Phase 4 plan).
- [ ] **Step 4: Run the full verification.**

Run: `node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"`
Expected: 0 fail. `server/payloadUpdate.test.js` can fail on Windows with an `EPERM` rename; rerun it alone before reporting it.

Run: `npm run lint`
Expected: no new errors compared with `origin/main` (report both counts).

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 5: Write the actual totals** from Step 4 into `README.md` and `CONTINUE-HERE.md`.
- [ ] **Step 6: Commit** `git commit -m "Document Phase 3"`.

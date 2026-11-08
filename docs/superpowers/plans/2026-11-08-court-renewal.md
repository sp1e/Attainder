# Court Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generated adults at historical courts marry and have children, and a thinning court gains generated newcomers, so Karls rike and Kyrkostaten live through AD 800 to 900 with a populated court.

**Architecture:** A new engine module `server/characters/renewal.js` owns a historical-only side stream `lineageRngState`, a counter object `courtRenewal` and a yearly `courtRenewalStep` that runs at the end of `annualStep`. `election.js` gives up its private electee record to one shared generated-adult builder that the new module also uses. `server/characters/index.js` gains only hook calls: three `ensureLineageState` calls, one `validateLineageState` call, one `courtRenewalStep` call and two `actionHooks` entries.

**Tech Stack:** Node 24 ES modules, `node:test` with the TAP reporter, React client views (unchanged), Vite build.

**Spec:** `docs/superpowers/specs/2026-11-08-court-renewal-design.md` (binding, including its "Builder-check rulings" section).

## Global Constraints

- No new or reordered `random(state)` calls; the new step draws only from `lineageRngState`. Hadara digests in `server/sharedCharacters.test.js`, `PRE_CHANGE_RNG` in `src/runtime/characters/extensions.test.js` and all stream-equality tests stay unchanged.
- `rulesVersion`/`contentVersion` stay `hadara-1.0.0`; migrations are additive `ensure*`.
- No package byte change: the four scripts `node scripts/build-historical-scenarios.mjs --check`, `node scripts/check-historical-events.mjs --check`, `node scripts/check-polity-regions.mjs --check`, `node scripts/sync-default-scenario.mjs --check` exit 0. Never edit `server/seed/historical/` (courts, name-pools, events, sources, generators).
- Generated persons carry ` (genererad)` and `Genererad person`; Swedish game text uses å/ä/ö.
- Functions under ~50 lines, files under ~800 lines (`server/characters/index.js` is already over: add only hook calls there).
- Working copy CRLF outside `server/seed/historical/`. No `sed -i`. Check a new file with `file <path>`: it must say `with CRLF line terminators`.
- Tests run only serially: `node --test --test-concurrency=1 --test-reporter=tap <files>`; full suite `node scripts/seed-web-defaults.mjs` then `node --test --test-concurrency=1 --test-reporter=tap "server/**/*.test.js" "src/**/*.test.js"`; `node scripts/fetch-map-assets.mjs --ensure` before `npm run build`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push the branch after each commit.
- Repo docs in English; prose free of em-dash clause separators, "not X but Y" contrasts and adverbs.
- Branch: `feature/court-renewal`, cut from `main` at `06ca9b8e` (Phase 5 squash-merged from `3b449a28`; the engine code is identical).
- Every engine file in `server/characters/` needs a compatibility wrapper in `src/runtime/characters/` with the single line `export * from '../../../server/characters/<name>.js';`. The export-surface test in `server/sharedCharacters.test.js` fails without it.
- `server/characters/renewal.js` imports only from `server/characters/*` and `server/gameDates.js`, never from `server/seed/` or `src/`: the installed desktop layout has no source tree.

## Rulings pinned by this plan

- **Event type `arrival`.** The client renders an unknown log type by its title. `src/Game/Characters/CharactersPanel.jsx:347` (`MemoryList`) prints `memory.title || humanize(memory.type)`, and `ChronicleView` (`:352-354`) feeds it `view.log` unfiltered. `characterTransitionEvents` in `src/runtime/characterWorld.js:282-288` copies `event.title` and only maps `death`, `succession` and `coup` to `major`. No event-type map exists under `src/Game/Characters/`. Outcome: the newcomer event uses type `arrival`.
- **Hooks.** `closeKin`, `addBond`, `logEvent`, `memory` and `activeRepresentative` are private to `index.js`. The step takes them as a third argument, `courtRenewalStep(state, events, hooks)`, called with `actionHooks(state)` like `courtAnnualStep`. `actionHooks` gains `closeKin` and `addBond`.
- **Realm religion.** The engine has no realm religion field. With no living ruler the newcomer takes `Object.keys(state.religions).sort()[0]`; every shipped court seeds exactly one religion.
- **Ended campaigns.** The step returns at once when `state.status.ended` is true, so a realm that ended in this year's deaths stays ended and gains nobody (ruling 6).
- **Ruling 13 confirmed.** `src/runtime/characters/extensions.test.js` and `src/runtime/characterLegacyReplay.test.js` build only Hadara states (`createCharacterSystem`); neither calls `createHistoricalCharacterSystem`. `EXTENSION_FIELDS` needs no new entry.
- **Prototype evidence.** A scratch prototype applied the rulings from outside the engine after each `advanceCharacters` year. On all eight seeds Karls rike lived to 900 (first arrival 838 to 848, 10 to 17 court adults on 25 December 900) and Kyrkostaten held 12 to 27 court adults on 25 December 900 (first arrival 801). Both courts had generated children on every seed. The engine numbers will differ because the real step runs inside `annualStep`.

## Review Focus

- A family-mode historical campaign: the player's family head is the active representative and must never gain a generated spouse or spend a lineage draw. Test in Task 4.
- A realm that ended in this year's deaths: the step adds nobody and the realm stays ended. Test in Task 3.
- No living ruler (family mode after the realm ended, or a vacant ruler office): the newcomer takes the court religion and the step does not throw. Test in Task 3.
- A save that carries only one of `lineageRngState` and `courtRenewal`: ensure fills the missing field and keeps the present one. Test in Task 2.
- Every family in exile: the newcomer house gets 110, 2 and 45, and exiled members do not count toward the floor. Test in Task 3.

---

### Task 1: Shared generated-adult builder

**Files:**
- Modify: `server/characters/election.js:55-89` (`electeeRecord`, `electOutsider`)
- Test: `src/runtime/characters/election.test.js`

**Interfaces:**
- Produces, exported from `server/characters/election.js`:
  - `generatedAdultRecord(state, { id, name, familyId, bornAt, sex, culture, religionId, archetype, skill }) -> person`: every person field in the key order `electeeRecord` writes today (`id, name, familyId, bornAt, diedAt, sex, culture, religionId, originLabelSv, traits, archetype, skills, stress, health, wealth, loyalty, fear, biologicalParentIds, legalParentIds, spouseId, mentorId, education, goal, lastBirthAt, lastDecision, cooldowns, healthConditions`), with `diedAt: null`, `originLabelSv: 'Genererad person'`, `traits: ['dutiful']`, every `SKILL_LABELS` key set to `skill`, `stress 0, health 100, wealth 30, loyalty 60, fear 0`, empty parent lists, `spouseId/mentorId/education: null`, `goal: { type: 'security', since: state.date, progress: 0 }`, `lastBirthAt/lastDecision: null`, `cooldowns: {}`, `healthConditions: []`.
  - `markGeneratedOrigin(state, person, noteSv) -> person`: when `state.historicalOrigin` is set, writes `identityOrigin: 'generated'` and `historicalOrigin` through `publicPersonOrigin` with the four generated claims (`identity`, `bornAt`, `kinship`, `mechanics`), each `{ status: 'generated', noteSv, sourceIds: [] }`, as `electOutsider` does today. Does nothing on a Hadara state.

- [ ] **Step 1: Branch and commit the spec**

Done by the controller: the branch exists and commit `docs: court renewal spec and plan` holds both files. Start at Step 2.

- [ ] **Step 2: Write the failing test** in `src/runtime/characters/election.test.js`

The two digests were captured on `3b449a28` with the code before this task (`sha256(JSON.stringify([person, family]))` after `electOutsider`).

```js
import { createHash } from 'node:crypto';
import { generatedAdultRecord, markGeneratedOrigin } from './election.js'; // add to the existing election.js import

const ELECTEE_DIGESTS = { historical: '42a51e677cf99c74a2b9d210c929de42afe72b111b9fbfe71146e36754eb9d70', hadara: 'f02fccac0a3d487421c28f29d475892d3d07b7cc04f9cb8df51451ddd12fd309' };
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the shared builder writes the electee exactly as before', () => {
  const historical = papal('elective', { seed: 7 }), person = electOutsider(historical, historical.people['leo-iii']);
  assert.equal(sha([person, historical.families[person.familyId]]), ELECTEE_DIGESTS.historical);
  const hadara = createCharacterSystem({ seed: 7 }), other = electOutsider(hadara, hadara.people[hadara.offices.ruler.holderId]);
  assert.equal(sha([other, hadara.families[other.familyId]]), ELECTEE_DIGESTS.hadara);
});

test('the shared builder gives every skill one value and marks only historical people', () => {
  const state = papal();
  const person = generatedAdultRecord(state, { id: 'probe', name: 'Prov (genererad)', familyId: 'leo-household', bornAt: '0775-01-01', sex: 'female', culture: 'Ej belagd', religionId: 'latin-church', archetype: 'diplomat', skill: 4 });
  assert.deepEqual(person.skills, Object.fromEntries(Object.keys(SKILL_LABELS).map(key => [key, 4])));
  assert.equal(person.archetype, 'diplomat');
  assert.equal(person.originLabelSv, 'Genererad person');
  assert.equal(markGeneratedOrigin(state, person, 'Not.').historicalOrigin.claims.identity.noteSv, 'Not.');
  assert.equal(person.identityOrigin, 'generated');
  const hadara = createCharacterSystem({ seed: 7 }), plainPerson = generatedAdultRecord(hadara, { ...person, skill: 5 });
  assert.equal(markGeneratedOrigin(hadara, plainPerson, 'Not.').identityOrigin, undefined);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/election.test.js`
Expected: FAIL, `SyntaxError: The requested module './election.js' does not provide an export named 'generatedAdultRecord'`.

- [ ] **Step 4: Implement `generatedAdultRecord` and `markGeneratedOrigin` in `server/characters/election.js`**

`electeeRecord` becomes a call to `generatedAdultRecord` with `name: \`Vald härskare ${n} (genererad)\``, the 40-year `bornAt`, `sex: oldRuler?.sex || 'male'`, `culture: oldRuler?.culture`, `religionId: oldRuler?.religionId`, `archetype: 'steward'`, `skill: 5`. `electOutsider` calls `markGeneratedOrigin(state, person, ELECTION_NOTE_SV)` in place of its inline block and keeps its order: record, origin, family, `ensurePortraitIdentity`, insert.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/election.test.js server/sharedCharacters.test.js`
Expected: PASS, `# fail 0`.

- [ ] **Step 6: Lint and commit**

Run: `npx eslint server/characters/election.js src/runtime/characters/election.test.js`
Expected: no output, exit 0.

```bash
git add server/characters/election.js src/runtime/characters/election.test.js
git commit -m "refactor(characters): share the generated-adult record builder" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: Lineage stream and renewal counters

**Files:**
- Create: `server/characters/renewal.js`, `src/runtime/characters/renewal.js` (wrapper), `src/runtime/characters/renewal.test.js`
- Modify: `server/characters/index.js:305` (`completeCharacterState`), `:401` (`normalizeCharacterSystem`), `:844` (`advanceCharacters`), plus one import line next to `:32`
- Test: `src/runtime/characters/renewal.test.js`

**Interfaces:**
- Produces, exported from `server/characters/renewal.js`:
  - `ensureLineageState(state) -> state`: only when `state.historicalOrigin` is set. `Object.hasOwn` guard per field. `lineageRngState` is the FNV-1a hash of `` `${state.rngState}:${state.identity.polityId}:lineage-v1` `` (`>>> 0 || 1`), the `seeded` helper pattern of `eventChains.js:34`. `courtRenewal` is `{ newcomers: 0, spouses: 0, houses: k0 }`, with `k0` the highest `<k>` among `state.families` names matching `/^Hovhus (\d+) \(genererat\)$/`, else 0. Draws nothing.
  - `validateLineageState(state) -> void`: on any state, when `lineageRngState` is present it must be an integer 1..0xffffffff, else throw `Släktlinjernas slumptillstånd är ogiltigt.`; when `courtRenewal` is present it must be a plain object whose `newcomers`, `spouses` and `houses` are non-negative integers, else throw `Hovets förnyelseräknare är ogiltiga.`
  - `lineageRandom(state) -> number` in [0, 1): the xorshift of `plotRandom` (`extensions.js:72-75`) on `state.lineageRngState` only.
- `index.js` calls `ensureLineageState(state)` right after `ensureEventChains(state)` in `completeCharacterState` and `advanceCharacters`, and adds `ensureLineageState(state); validateLineageState(state);` right after `ensureEventChains(state); validateEventChains(state);` in `normalizeCharacterSystem`.

- [ ] **Step 1: Write the failing tests** in the new `src/runtime/characters/renewal.test.js`

Shared helpers at the top of the file (Tasks 3 and 4 add to them):

```js
const plain = value => JSON.parse(JSON.stringify(value));
const ok = result => { assert.equal(result.ok, true, result.error); return result.state; };
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const start = (polityId, { seed = 321, mode = 'realm', familyId } = {}) => createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId, mode, familyId, seed });
const papal = options => start('papal-states', options);
const fnv = text => { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0 || 1; };
const oldSave = (state, drop = ['lineageRngState', 'courtRenewal']) => { const saved = plain(state); for (const key of drop) delete saved[key]; return saved; };
```

Tests and their assertions:

```js
test('a Hadara state gains no lineage fields', () => {
  const state = createCharacterSystem({ seed: 321 }), year = ok(advanceCharacters(state, addGameMonths(state.date, 12)));
  for (const s of [state, year, normalizeCharacterSystem(plain(year))]) for (const key of ['lineageRngState', 'courtRenewal']) assert.equal(Object.hasOwn(s, key), false, key);
});
test('a historical state carries the lineage stream and counters', () => {
  const state = papal();
  assert.equal(state.rngState, 321);
  assert.equal(state.lineageRngState, fnv('321:papal-states:lineage-v1'));
  assert.deepEqual(state.courtRenewal, { newcomers: 0, spouses: 0, houses: 3 });
});
test('an old historical save gains the stream from its current main stream and keeps every other field', () => {
  const saved = oldSave(papal()); saved.rngState = 12345;
  const loaded = normalizeCharacterSystem(plain(saved));
  assert.equal(loaded.lineageRngState, fnv('12345:papal-states:lineage-v1'));
  assert.equal(loaded.rngState, 12345);
  const rest = plain(loaded); delete rest.lineageRngState; delete rest.courtRenewal;
  assert.deepEqual(rest, saved);
  assert.deepEqual(normalizeCharacterSystem(plain(loaded)), loaded);
});
test('a save with one lineage field keeps it and gains the other', () => {
  const counters = { newcomers: 2, spouses: 1, houses: 5 };
  const noStream = oldSave(papal(), ['lineageRngState']); noStream.courtRenewal = counters;
  assert.deepEqual(normalizeCharacterSystem(noStream).courtRenewal, counters);
  const state = papal(), noCounters = oldSave(state, ['courtRenewal']);
  const loaded = normalizeCharacterSystem(noCounters);
  assert.equal(loaded.lineageRngState, state.lineageRngState);
  assert.deepEqual(loaded.courtRenewal, { newcomers: 0, spouses: 0, houses: 3 });
});
test('the house counter starts after the highest generated house number', () => {
  const saved = oldSave(papal());
  saved.families['generated-house-2'].name = 'Hovhus 7 (genererat)';
  saved.families['generated-house-3'].name = 'Hovhus 9 (genererad)';
  assert.equal(normalizeCharacterSystem(saved).courtRenewal.houses, 7);
});
test('validation refuses a broken lineage stream or counter on any state', () => {
  for (const value of [0, 2 ** 32, 1.5, '7']) {
    const s = plain(papal()); s.lineageRngState = value;
    assert.throws(() => normalizeCharacterSystem(s), /Släktlinjernas slumptillstånd är ogiltigt/);
  }
  const hadara = plain(createCharacterSystem({ seed: 321 })); hadara.lineageRngState = 0;
  assert.throws(() => normalizeCharacterSystem(hadara), /Släktlinjernas slumptillstånd är ogiltigt/);
  for (const counters of [[], null, { newcomers: -1, spouses: 0, houses: 3 }, { newcomers: 0, spouses: 1.5, houses: 3 }, { newcomers: 0, spouses: 0 }]) {
    const s = plain(papal()); s.courtRenewal = counters;
    assert.throws(() => normalizeCharacterSystem(s), /Hovets förnyelseräknare är ogiltiga/);
  }
});
test('ensure is idempotent and lineageRandom touches only its own stream', () => {
  const state = papal(), before = plain(state);
  ensureLineageState(state); assert.deepEqual(state, before);
  const value = lineageRandom(state);
  assert.ok(value >= 0 && value < 1);
  assert.notEqual(state.lineageRngState, before.lineageRngState);
  assert.deepEqual({ ...state, lineageRngState: before.lineageRngState }, before);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/renewal.test.js`
Expected: FAIL, `Cannot find module` for `./renewal.js`.

- [ ] **Step 3: Implement `ensureLineageState`, `validateLineageState` and `lineageRandom` in `server/characters/renewal.js`; add the wrapper and the four `index.js` hook calls**

- [ ] **Step 4: Run the tests to verify they pass, with the Hadara pins**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/renewal.test.js server/sharedCharacters.test.js src/runtime/characters/extensions.test.js src/runtime/characterLegacyReplay.test.js src/runtime/characters/scenarioSeed.test.js src/runtime/characters/election.test.js server/charlemagneOldSave.test.js server/johnOldSave.test.js server/world1500OldSave.test.js server/characterGameBundle.test.js`
Expected: PASS, `# fail 0`.

- [ ] **Step 5: Lint and commit**

Run: `npx eslint server/characters/renewal.js src/runtime/characters/renewal.js src/runtime/characters/renewal.test.js server/characters/index.js`
Expected: no output, exit 0.

```bash
git add server/characters/renewal.js src/runtime/characters/renewal.js src/runtime/characters/renewal.test.js server/characters/index.js
git commit -m "feat(characters): add the lineage stream and court renewal counters" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Newcomers at a thinning court

**Files:**
- Modify: `server/characters/renewal.js`, `server/characters/index.js:830-832` (one call between `courtAnnualStep` and the `yearEvent.description` line)
- Test: `src/runtime/characters/renewal.test.js`

**Interfaces:**
- Consumes: `generatedAdultRecord`, `markGeneratedOrigin` (Task 1); `lineageRngState`, `courtRenewal`, `lineageRandom` (Task 2); `hooks.logEvent(events, type, title, description, participants)` from `actionHooks`.
- Produces, exported from `server/characters/renewal.js`:
  - `COURT_FLOOR = 6`.
  - `courtAdults(state) -> person[]`: living persons aged 18 or more (`getCharacterAge`) whose family is not exiled, sorted by `a.id.localeCompare(b.id)`.
  - `courtRenewalStep(state, events, hooks) -> void`: returns at once unless `state.historicalOrigin` is set and `state.status.ended` is false. When `courtAdults(state).length < COURT_FLOOR`, adds one newcomer. Task 4 adds the spouse walk after it.
- Newcomer, with `m = ++courtRenewal.newcomers` and `k = ++courtRenewal.houses`:
  - ids `person-${++state.sequence}` then `family-${++state.sequence}`;
  - name `Hovman ${m} (genererad)` and sex `male` for odd `m`, `Hovdam ${m} (genererad)` and `female` for even `m`;
  - `bornAt` 1 January of the year 25 years before `gameDateYear(state.date)` (`shiftGameYear`, `formatGameDate`);
  - archetype `NEWCOMER_ARCHETYPES[(m - 1) % 7]`, where `NEWCOMER_ARCHETYPES = Object.keys(ARCHETYPES).filter(key => key !== 'legislator')` (commander, steward, diplomat, scholar, guardian, schemer, builder); `skill: 5`; culture `Ej belagd`;
  - religion: the living ruler's `religionId`, else `Object.keys(state.religions).sort()[0]`;
  - `markGeneratedOrigin(state, person, 'Spelet skapade personen när hovet behövde fler vuxna.')`, then `ensurePortraitIdentity(person, state.people)`;
  - family `{ id, name: \`Hovhus ${k} (genererat)\`, color: HOUSE_COLORS[(k - 1) % 3], religionId, headId: person.id, guardianId: null, treasury, estates, influence, grievance: 0, exiled: false, hostFamilyId: null, claims: [], cooldowns: {} }` with `HOUSE_COLORS = ['#93594d', '#567b82', '#776c91']` (the palette of `dossier-courts.mjs:127`, copied); treasury, estates and influence each the minimum over non-exiled families before the new one, else 110, 2 and 45;
  - event `hooks.logEvent(events, 'arrival', 'Ny person vid hovet', \`${person.name} kommer till hovet som huvud för ${family.name}.\`, [person.id])`.

- [ ] **Step 1: Write the failing tests** in `src/runtime/characters/renewal.test.js`

New helpers:

```js
const streamWith = accept => { for (let n = 1; ; n++) if (accept(lineageRandom({ lineageRngState: n }))) return n; };
const LOW = streamWith(value => value < 0.25), HIGH = streamWith(value => value >= 0.25);
const afterDraws = (n, count) => { const s = { lineageRngState: n }; for (let i = 0; i < count; i++) lineageRandom(s); return s.lineageRngState; };
const step = (state, stream = HIGH) => { const events = []; state.lineageRngState = stream; courtRenewalStep(state, events, actionHooks(state)); return events; };
const probe = (state, id, overrides = {}) => { state.people[id] = { ...plain(state.people['leo-iii']), id, name: `Prov ${id}`, bornAt: '0750-01-01', spouseId: null, ...overrides }; return state.people[id]; };
const streams = s => [s.rngState, s.actionRngState, s.plotRngState, s.healthRngState, s.storyDirector.rngState, s.eventChains.rngState];
const NEWCOMER_NOTE = 'Spelet skapade personen när hovet behövde fler vuxna.';
```

Tests (`HIGH` keeps Task 4's spouse walk from adding anyone):

- `a court below six adults gains exactly one newcomer a year`: `papal()` has `courtAdults(...).length === 4`; one `step` adds one person; a second `step` adds one more; a third `step` on six court adults adds nobody; `courtRenewal.newcomers` reads 1, 2, 2.
- `a court of six adults gains no newcomer and one of five does`: `papal()` plus probes `p1` and `p2` has 6 court adults; set `state.lineageRngState = HIGH`, take `before = plain(state)`, `step(state)`, then `assert.deepEqual(state, before)`. `papal()` plus `p-adult` (`bornAt: '0782-01-01'`, age 18) and `p-young` (`bornAt: '0783-01-01'`, age 17) has 5 court adults (`p-young` does not count) and gains one newcomer.
- `a newcomer is a 25-year-old generated courtier heading Hovhus 4`:

```js
const state = papal(), seq = state.sequence, events = step(state);
const person = state.people[`person-${seq + 1}`], family = state.families[`family-${seq + 2}`];
assert.equal(person.name, 'Hovman 1 (genererad)'); assert.equal(person.sex, 'male');
assert.equal(person.bornAt, '0775-01-01'); assert.equal(getCharacterAge(person, state.date), 25);
assert.equal(person.archetype, 'commander'); assert.deepEqual(person.traits, ['dutiful']);
assert.deepEqual(person.skills, Object.fromEntries(Object.keys(SKILL_LABELS).map(key => [key, 5])));
assert.equal(person.religionId, 'latin-church'); assert.equal(person.culture, 'Ej belagd');
assert.equal(person.spouseId, null); assert.deepEqual(person.legalParentIds, []);
assert.equal(person.identityOrigin, 'generated'); assert.equal(person.originLabelSv, 'Genererad person');
assert.equal(person.historicalOrigin.claims.identity.noteSv, NEWCOMER_NOTE);
assert.equal(person.portraitIdentityId, person.id);
assert.equal(family.name, 'Hovhus 4 (genererat)'); assert.equal(family.color, '#93594d');
assert.equal(family.headId, person.id); assert.equal(family.religionId, 'latin-church');
assert.deepEqual([family.treasury, family.estates, family.influence], [110, 2, 45]);
assert.deepEqual(state.courtRenewal, { newcomers: 1, spouses: 0, houses: 4 });
assert.equal(events.length, 1);
assert.deepEqual([events[0].type, events[0].title, events[0].description, events[0].participants], ['arrival', 'Ny person vid hovet', 'Hovman 1 (genererad) kommer till hovet som huvud för Hovhus 4 (genererat).', [person.id]]);
assert.deepEqual(state.log.at(-1), events[0]);
```

- `newcomers alternate sex and cycle archetypes and colours`: with `courtRenewal = { newcomers: 7, spouses: 0, houses: 5 }` the newcomer is `Hovdam 8 (genererad)`, `female`, `commander`, in `Hovhus 6 (genererat)` with colour `#776c91`; a second `papal()` stepped twice yields `Hovdam 2 (genererad)`, `steward`, `Hovhus 5 (genererat)`, `#567b82`.
- `a newcomer house takes the smallest treasury, estates and influence`: set `generated-house-1` to 80/3/50, `generated-house-2` to 140/1/60, `leo-household.influence = 30`, `generated-house-3` to `exiled: true` with 5/0/0; assert `courtAdults(state).length === 3` and the new family is 80/1/30.
- `a court with every family in exile gives the newcomer house 110, 2 and 45`: all four families `exiled: true`, treasury 5; assert `courtAdults(state).length === 0`, one newcomer, family 110/2/45.
- `without a living ruler the newcomer takes the court religion`: add `state.religions['aaa-test'] = { id: 'aaa-test', name: 'Prov', support: 50, leaderId: null }`; with Leo ruling the newcomer is `latin-church`; on a second `papal()` with the same religion and `offices.ruler.holderId = null` it is `aaa-test`; on a third with `people['leo-iii'].diedAt = '0800-12-01'` it is `aaa-test`.
- `an ended campaign gains nobody`: `state.status = { ended: true, reason: 'Prov' }` and `state.lineageRngState = HIGH`, then `before = plain(state)`; after `step(state)`, `assert.deepEqual(state, before)` and `events.length === 0`.
- `a Hadara state gains nobody`: `createCharacterSystem({ seed: 321 })`; one `courtRenewalStep(state, events, actionHooks(state))` without touching the stream leaves `JSON.stringify(state)` unchanged.
- `the renewal step leaves offices and every other stream alone`: `const state = papal(), before = plain(state); step(state, LOW);` then `assert.deepEqual(state.offices, before.offices)` and `assert.deepEqual(streams(state), streams(before))`.
- `a year in Kyrkostaten brings Hovman 1 to court`: `ok(advanceCharacters(papal(), '0801-12-25'))` has `courtRenewal.newcomers === 1`, one person named `Hovman 1 (genererad)`, one `arrival` log entry dated `0801-12-25`, and `assert.deepEqual(normalizeCharacterSystem(plain(next)), next)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/renewal.test.js`
Expected: FAIL, `does not provide an export named 'courtRenewalStep'`.

- [ ] **Step 3: Implement `courtAdults` and the newcomer half of `courtRenewalStep` in `server/characters/renewal.js`; add `courtRenewalStep(state, events, actionHooks(state));` to `annualStep` between the `courtAnnualStep` line and the `yearEvent.description` line**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/renewal.test.js src/runtime/characters/election.test.js src/runtime/characters/scenarioSeed.test.js server/sharedCharacters.test.js src/runtime/characters/extensions.test.js server/world1500Scenario.test.js src/runtime/characterWorld.test.js src/runtime/historicalPlayables.test.js`
Expected: PASS, `# fail 0`. `the election draws nothing` stays green because both laws gain the same newcomer.

Then run: `node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="Kyrkostaten" src/runtime/characters/courtBalance.test.js`
Expected: FAIL in `Kyrkostaten stays alive for a century under an elected ruler on every seed`, because newcomers now keep candidates at court. Do not edit that test here; Task 5 rewrites it. If any other historical test fails on a changed count of people, events or ids, report it with its file and assertion before editing it.

- [ ] **Step 5: Lint and commit**

Run: `npx eslint server/characters/renewal.js src/runtime/characters/renewal.test.js server/characters/index.js`
Expected: no output, exit 0.

```bash
git add server/characters/renewal.js src/runtime/characters/renewal.test.js server/characters/index.js
git commit -m "feat(characters): bring generated newcomers to a thinning historical court" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: Generated spouses

**Files:**
- Modify: `server/characters/renewal.js`, `server/characters/index.js:477-489` (two `actionHooks` entries)
- Test: `src/runtime/characters/renewal.test.js`

**Interfaces:**
- Consumes: Task 3's `courtRenewalStep`, `courtAdults`; Task 1's builder; Task 2's `lineageRandom`.
- Produces:
  - `actionHooks(state)` gains `closeKin: (a, b) => closeKin(state, a, b)` and `addBond: (aId, bId, kind) => addBond(state, aId, bId, kind)`; `courtRenewalStep` also uses `hooks.memory(type, title, participants)` and `hooks.activeRepresentative()`.
  - `SPOUSE_CEILING = 12`, exported from `renewal.js`.
- Spouse walk, after the newcomer: list living persons with `identityOrigin === 'generated'` once, sorted by `a.id.localeCompare(b.id)`. For each, stop when `courtAdults(state).length >= SPOUSE_CEILING`. A person qualifies when aged 18 to 35 inclusive, has no living spouse, is not `hooks.activeRepresentative()`, holds no office of kind `ruler` or `priest`, and no partner exists: a living person aged 18 to 39 of the other sex, with no living spouse, other than the active representative and the person, and not `hooks.closeKin(person, partner)`. Only a qualifying person spends one `lineageRandom(state)`; below 0.25 a spouse is created with `g = ++courtRenewal.spouses`:
  - id `person-${++state.sequence}`, name `Gemål ${g} (genererad)`, the other sex, the person's `familyId`, archetype `steward`, `skill: 4`, the person's `religionId` and `culture`;
  - age `Math.max(18, age - 3)` for a wife and `age + 3` for a husband, born 1 January of that many years before the current year;
  - `markGeneratedOrigin(state, spouse, 'Spelet skapade personen som make eller maka.')`, `ensurePortraitIdentity`;
  - both `spouseId`s, `hooks.addBond(person.id, spouse.id, 'partner')`, `hooks.logEvent(events, 'marriage', 'En ny familjeförbindelse', \`${person.name} och ${spouse.name} gifter sig.\`, [person.id, spouse.id])` and `hooks.memory('marriage', 'Äktenskap mellan familjer', [person.id, spouse.id])`, the text of matchmaking at `index.js:818`.

- [ ] **Step 1: Write the failing tests** in `src/runtime/characters/renewal.test.js`

`crowd(state, n)` adds `n` probes (`probe(state, \`crowd-${i}\`)`, men aged 50) so the court reaches the floor and no newcomer arrives. `SPOUSE_NOTE = 'Spelet skapade personen som make eller maka.'`.

- `a generated adult with nobody to marry gains a spouse on a low draw`:

```js
const state = papal(), seq = state.sequence, events = step(state, LOW);
const man = state.people[`person-${seq + 1}`], wife = state.people[`person-${seq + 4}`];
assert.deepEqual(events.map(e => e.type), ['arrival', 'marriage']);
assert.equal(wife.name, 'Gemål 1 (genererad)'); assert.equal(wife.sex, 'female');
assert.equal(wife.bornAt, '0778-01-01'); assert.equal(wife.familyId, man.familyId);
assert.equal(wife.archetype, 'steward'); assert.deepEqual(wife.traits, ['dutiful']);
assert.deepEqual(wife.skills, Object.fromEntries(Object.keys(SKILL_LABELS).map(key => [key, 4])));
assert.equal(wife.religionId, man.religionId); assert.equal(wife.culture, man.culture);
assert.equal(wife.historicalOrigin.claims.identity.noteSv, SPOUSE_NOTE);
assert.equal(man.spouseId, wife.id); assert.equal(wife.spouseId, man.id);
for (const key of [`${man.id}:${wife.id}`, `${wife.id}:${man.id}`]) assert.ok(state.relations[key].bonds.includes('partner'), key);
assert.equal(events[1].title, 'En ny familjeförbindelse');
assert.equal(events[1].description, 'Hovman 1 (genererad) och Gemål 1 (genererad) gifter sig.');
assert.deepEqual(events[1].participants, [man.id, wife.id]);
assert.deepEqual([state.memories.at(-1).type, state.memories.at(-1).title, state.memories.at(-1).participants], ['marriage', 'Äktenskap mellan familjer', [man.id, wife.id]]);
assert.equal(state.families[man.familyId].headId, man.id);
assert.deepEqual(state.courtRenewal, { newcomers: 1, spouses: 1, houses: 4 });
assert.deepEqual(normalizeCharacterSystem(plain(state)), state);
```

- `a high draw creates no spouse and spends one lineage draw`: `step(papal(), HIGH)` leaves no person named `Gemål 1 (genererad)` and `state.lineageRngState === afterDraws(HIGH, 1)`.
- `the renewal step never touches the main or other streams`: `streams` equal before and after `step(papal(), LOW)`.
- `a matchmaking partner at court blocks the generated spouse and its draw`: `crowd(state, 1)`, `generated-courtier-1.bornAt = '0775-01-01'`, `probe(state, 'p-woman', { sex: 'female', bornAt: '0770-01-01' })`; after `step(state, LOW)` the courtier has `spouseId === null` and `state.lineageRngState === LOW`.
- `rulers and priests gain no generated spouse and spend no draw`: family mode keeps the office holder apart from the representative, who is Leo. For `[officeId, personId]` in `[['ruler', 'generated-courtier-1'], ['priest', 'generated-courtier-3']]` on a fresh `papal({ mode: 'family', familyId: 'leo-household' })` with `crowd(state, 2)`, set `offices[officeId].holderId = personId` and the person's `bornAt = '0775-01-01'`; assert `actionHooks(state).activeRepresentative().id === 'leo-iii'`, then after `step(state, LOW)`: `spouseId === null`, `lineageRngState === LOW`.
- `the age window runs from 18 to 35`: each on a fresh `papal()` with `crowd(state, 2)` and `generated-courtier-1` changed, then `step(state, LOW)`:
  - `bornAt: '0764-01-01'` (36): no spouse, `lineageRngState === LOW`;
  - `bornAt: '0765-01-01'` (35): wife born `0768-01-01`;
  - `bornAt: '0782-01-01'` (18): wife born `0782-01-01` (18, the floor);
  - `sex: 'female', bornAt: '0765-01-01'` (35): husband `Gemål 1 (genererad)`, `male`, born `0762-01-01`.
- `the ceiling of twelve court adults stops the walk`: `papal()`, `crowd(state, 7)` (11 court adults), courtiers 1 and 2 born `0775-01-01`; after `step(state, LOW)` exactly one `Gemål` exists, it is `generated-courtier-1`'s spouse, and `lineageRngState === afterDraws(LOW, 1)`. With `crowd(state, 8)` (12 court adults) nobody marries and `lineageRngState === LOW`.
- `the active representative of a family campaign gains no generated spouse`: `papal({ mode: 'family', familyId: 'generated-house-1' })`, `crowd(state, 2)`, `generated-courtier-1.bornAt = '0775-01-01'`; assert `actionHooks(state).activeRepresentative().id === 'generated-courtier-1'`, then after `step(state, LOW)` `spouseId === null` and `lineageRngState === LOW`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/renewal.test.js`
Expected: FAIL in `a generated adult with nobody to marry gains a spouse on a low draw` (events are `['arrival']`).

- [ ] **Step 3: Add the two `actionHooks` entries in `index.js` and implement the spouse walk in `renewal.js`** (split into `qualifiesForSpouse`, `hasPartner`, `addSpouse`, each under 50 lines)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/renewal.test.js src/runtime/characters/election.test.js src/runtime/characters/scenarioSeed.test.js server/sharedCharacters.test.js src/runtime/characters/extensions.test.js src/runtime/characters/characters.test.js server/world1500Scenario.test.js src/runtime/historicalPlayables.test.js`
Expected: PASS, `# fail 0`. The Kyrkostaten century test in `courtBalance.test.js` still fails until Task 5.

- [ ] **Step 5: Lint and commit**

Run: `npx eslint server/characters/renewal.js src/runtime/characters/renewal.test.js server/characters/index.js`
Expected: no output, exit 0.

```bash
git add server/characters/renewal.js src/runtime/characters/renewal.test.js server/characters/index.js
git commit -m "feat(characters): give unmatched generated adults a generated spouse" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 5: Century acceptance, docs and full verification

**Files:**
- Modify: `src/runtime/characters/courtBalance.test.js:8,170-192`
- Modify: `docs/development/CONTINUE-HERE.md` (date line 3, known-limit paragraph at line 31, new section after `## Every culture playable: Phase 5`), `docs/development/DEVELOPMENT-BACKLOG.md:13` (row 7), `src/runtime/characters/CONTRACT.md` (after the stream list at `:170-175`; the `## Historical initialization` section at `:227`), `docs/play-scripts/historical-foundation.md` (new section before `## Closure` at `:228`)

**Interfaces:**
- Consumes: `courtAdults` (Task 3). Imports `compareGameDates` from `../gameDates.js` and `courtAdults` from `./renewal.js`; drops the `ELECTION_REASON_SV` import and `PAPAL_COURT`.

- [ ] **Step 1: Rewrite the century tests**

Replace `papalCentury` with `century(polityId, seed)` (same loop, `polityId` as a parameter). Replace the comment above it with one that says what the two tests now prove. One run per seed and court serves all assertions.

```js
const generatedChildren = state => Object.values(state.people).filter(p => p.identityOrigin === 'generated' && p.biologicalParentIds.length === 2 && compareGameDates(p.bornAt, '0800-12-25') > 0);
const report = (t, seed, state) => t.diagnostic(`${seed}: first arrival ${state.log.find(e => e.type === 'arrival')?.date ?? 'none'}, court adults ${courtAdults(state).length}, generated children ${generatedChildren(state).length}`);

test('Karls rike lives through the century with children at court on every seed', t => {
  for (const seed of SEEDS) {
    const state = century('carolingian-realm', seed);
    assert.equal(state.date, '0900-12-25', `${seed}`);
    assert.equal(state.status.ended, false, `${seed}`);
    assert.equal(state.realm.alive, true, `${seed}`);
    assert.ok(generatedChildren(state).length >= 1, `${seed}: no generated child`);
    report(t, seed, state);
  }
});

test('Kyrkostaten keeps at least four court adults and children at court through the century on every seed', t => {
  for (const seed of SEEDS) {
    const state = century('papal-states', seed);
    // same date, status and realm assertions as above
    assert.ok(courtAdults(state).length >= 4, `${seed}: ${courtAdults(state).length} court adults`);
    assert.ok(generatedChildren(state).length >= 1, `${seed}: no generated child`);
    report(t, seed, state);
  }
});
```

- [ ] **Step 2: Run the century tests**

Run: `node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="century" src/runtime/characters/courtBalance.test.js`
Expected: PASS, `# fail 0`, with 16 `#` diagnostic lines. Keep the diagnostics for Step 4. If any seed fails, stop and report the seed, the failing assertion and the diagnostic line. The floor, ceiling and odds are rulings; do not tune them.

- [ ] **Step 3: Run the whole file**

Run: `node --test --test-concurrency=1 --test-reporter=tap src/runtime/characters/courtBalance.test.js`
Expected: PASS, `# fail 0`. The ten-year Hadara playthrough is unchanged.

- [ ] **Step 4: Update the docs** from the Step 2 diagnostics (ranges over the eight seeds, no invented numbers)

- `docs/development/CONTINUE-HERE.md`: line 3 reads `Updated on 8 November 2026.` Line 31 drops "nobody is born" and says that court renewal brings newcomers and generated spouses, with a link to the new section. New section `## Court renewal` after the Phase 5 section: spec and plan paths, the branch, what the step does (floor 6, ceiling 12, the 0.25 spouse draw, the `lineageRngState` stream, the `arrival` event), the measured ranges, and the Step 7 evidence line.
- `docs/development/DEVELOPMENT-BACKLOG.md` row 7: State becomes `Complete on feature/court-renewal: ...` with Karls rike alive on 25 December 900 on all eight seeds, the first-arrival range at Karls rike, the court-adult range at Kyrkostaten and births at both courts.
- `src/runtime/characters/CONTRACT.md`: after the three-stream list, a paragraph on `state.lineageRngState`, present only on historical states, seeded by ensure as the FNV-1a hash of `` `${rngState}:${polityId}:lineage-v1` ``, drawn by `lineageRandom` in `renewal.js` once per qualifying generated adult in `courtRenewalStep` and by nothing else. In `## Historical initialization`, a paragraph on court renewal: court adults, the floor, the newcomer record and house, the counters in `courtRenewal`, the spouse rules with the ruler and priest exclusions, the claim notes, the `arrival` event, and that offices stay the player's to fill.
- `docs/play-scripts/historical-foundation.md`: section `## Court renewal` before `## Closure` with a check table (R-1 start Karls rike in realm mode, R-2 advance one year, R-3 console 0 errors) and an empty results table with `Server` and `Web` columns for the controller. Add one paragraph that the century has automated coverage only, with the Step 2 ranges.

- [ ] **Step 5: Run the package checks**

Run each: `node scripts/build-historical-scenarios.mjs --check`, `node scripts/check-historical-events.mjs --check`, `node scripts/check-polity-regions.mjs --check`, `node scripts/sync-default-scenario.mjs --check`
Expected: each exits 0. `git status --short server/seed` prints nothing.

- [ ] **Step 6: Lint**

Run: `npx eslint server/characters/renewal.js server/characters/election.js server/characters/index.js src/runtime/characters/renewal.js src/runtime/characters/renewal.test.js src/runtime/characters/election.test.js src/runtime/characters/courtBalance.test.js`
Expected: no output, exit 0.

- [ ] **Step 7: Full suite and build**

Run: `node scripts/seed-web-defaults.mjs` then `node --test --test-concurrency=1 --test-reporter=tap "server/**/*.test.js" "src/**/*.test.js"`
Expected: `# fail 0`. The two failures recorded at `CONTINUE-HERE.md:70` (tests that call this machine's Codex CLI) may recur; name any other failure with its file and assertion.

Run: `node scripts/fetch-map-assets.mjs --ensure` then `npm run build`
Expected: exit 0.

Record the totals (tests, pass, fail, skipped, todo, duration) and the commit in the new `CONTINUE-HERE.md` section.

- [ ] **Step 8: Commit**

```bash
git add src/runtime/characters/courtBalance.test.js docs/development/CONTINUE-HERE.md docs/development/DEVELOPMENT-BACKLOG.md src/runtime/characters/CONTRACT.md docs/play-scripts/historical-foundation.md
git commit -m "test(characters): accept court renewal over a century at both courts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 9: Browser check (controller, not the implementer)**

On the server adapter (`node server/server.js`, port 4167, an isolated `OH_DATA_DIR`) and the web adapter (`vite --mode web`, port 5199, fresh browser storage): start Karls rike, 800 e.Kr., in realm mode; advance one year; open `Krönikan`, segment `Årskrönika`. Expected: the year closes on 25 December 801, the chronicle lists the year's entries, and the console shows 0 errors on both adapters. Fill the results table from Task 5 Step 4, then commit and push it with the same attribution line.

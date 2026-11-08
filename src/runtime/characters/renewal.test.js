import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, advanceCharacters, createCharacterSystem, getCharacterAge, normalizeCharacterSystem } from './index.js';
import { courtAdults, courtRenewalStep, ensureLineageState, lineageRandom } from './renewal.js';
import { SKILL_LABELS } from './content.js';
import { addGameMonths } from '../gameDates.js';

const plain = value => JSON.parse(JSON.stringify(value));
const ok = result => { assert.equal(result.ok, true, result.error); return result.state; };
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const start = (polityId, { seed = 321, mode = 'realm', familyId } = {}) => createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId, mode, familyId, seed });
const papal = options => start('papal-states', options);
const fnv = text => { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0 || 1; };
const oldSave = (state, drop = ['lineageRngState', 'courtRenewal']) => { const saved = plain(state); for (const key of drop) delete saved[key]; return saved; };

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
const streamWith = accept => { for (let n = 1; ; n++) if (accept(lineageRandom({ lineageRngState: n }))) return n; };
const LOW = streamWith(value => value < 0.25), HIGH = streamWith(value => value >= 0.25);
const afterDraws = (n, count) => { const s = { lineageRngState: n }; for (let i = 0; i < count; i++) lineageRandom(s); return s.lineageRngState; };
const step = (state, stream = HIGH) => { const events = []; state.lineageRngState = stream; courtRenewalStep(state, events, actionHooks(state)); return events; };
const probe = (state, id, overrides = {}) => { state.people[id] = { ...plain(state.people['leo-iii']), id, name: `Prov ${id}`, bornAt: '0750-01-01', spouseId: null, ...overrides }; return state.people[id]; };
const streams = s => [s.rngState, s.actionRngState, s.plotRngState, s.healthRngState, s.storyDirector.rngState, s.eventChains.rngState];
const NEWCOMER_NOTE = 'Spelet skapade personen när hovet behövde fler vuxna.';
const newcomerOf = (state, events) => state.people[events.find(event => event.type === 'arrival')?.participants[0]];
const familyOf = (state, person) => state.families[person.familyId];
const headcount = state => Object.keys(state.people).length;
const crowd = (state, n) => { for (let i = 1; i <= n; i++) probe(state, `crowd-${i}`); };
const SPOUSE_NOTE = 'Spelet skapade personen som make eller maka.';
const spouses = state => Object.values(state.people).filter(person => /^Gemål \d+ \(genererad\)$/.test(person.name));

test('a court below six adults gains exactly one newcomer a year', () => {
  const state = papal(), initial = headcount(state);
  assert.equal(courtAdults(state).length, 4);
  step(state); assert.equal(headcount(state), initial + 1); assert.equal(state.courtRenewal.newcomers, 1);
  step(state); assert.equal(headcount(state), initial + 2); assert.equal(state.courtRenewal.newcomers, 2);
  assert.equal(courtAdults(state).length, 6);
  step(state); assert.equal(headcount(state), initial + 2); assert.equal(state.courtRenewal.newcomers, 2);
});
test('a court of six adults gains no newcomer and one of five does', () => {
  const full = papal(); probe(full, 'p1'); probe(full, 'p2');
  assert.equal(courtAdults(full).length, 6);
  full.lineageRngState = HIGH;
  const before = plain(full); step(full);
  assert.deepEqual(full, before);
  const five = papal(); probe(five, 'p-adult', { bornAt: '0782-01-01' }); probe(five, 'p-young', { bornAt: '0783-01-01' });
  assert.equal(getCharacterAge(five.people['p-adult'], five.date), 18); assert.equal(getCharacterAge(five.people['p-young'], five.date), 17);
  assert.equal(courtAdults(five).length, 5);
  const initial = headcount(five); step(five);
  assert.equal(headcount(five), initial + 1); assert.equal(five.courtRenewal.newcomers, 1);
});
test('a newcomer is a 25-year-old generated courtier heading Hovhus 4', () => {
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
});
test('newcomers alternate sex and cycle archetypes and colours', () => {
  const state = papal(); state.courtRenewal = { newcomers: 7, spouses: 0, houses: 5 };
  const eighth = newcomerOf(state, step(state));
  assert.deepEqual([eighth.name, eighth.sex, eighth.archetype], ['Hovdam 8 (genererad)', 'female', 'commander']);
  assert.deepEqual([familyOf(state, eighth).name, familyOf(state, eighth).color], ['Hovhus 6 (genererat)', '#776c91']);
  const twice = papal(); step(twice);
  const second = newcomerOf(twice, step(twice));
  assert.deepEqual([second.name, second.sex, second.archetype], ['Hovdam 2 (genererad)', 'female', 'steward']);
  assert.deepEqual([familyOf(twice, second).name, familyOf(twice, second).color], ['Hovhus 5 (genererat)', '#567b82']);
});
test('a newcomer house takes the smallest treasury, estates and influence', () => {
  const state = papal(), { families } = state;
  Object.assign(families['generated-house-1'], { treasury: 80, estates: 3, influence: 50 });
  Object.assign(families['generated-house-2'], { treasury: 140, estates: 1, influence: 60 });
  families['leo-household'].influence = 30;
  Object.assign(families['generated-house-3'], { exiled: true, treasury: 5, estates: 0, influence: 0 });
  assert.equal(courtAdults(state).length, 3);
  const family = familyOf(state, newcomerOf(state, step(state)));
  assert.deepEqual([family.treasury, family.estates, family.influence], [80, 1, 30]);
});
test('a court with every family in exile gives the newcomer house 110, 2 and 45', () => {
  const state = papal();
  for (const family of Object.values(state.families)) Object.assign(family, { exiled: true, treasury: 5 });
  assert.equal(courtAdults(state).length, 0);
  const initial = headcount(state), events = step(state);
  assert.equal(headcount(state), initial + 1);
  const family = familyOf(state, newcomerOf(state, events));
  assert.deepEqual([family.treasury, family.estates, family.influence], [110, 2, 45]);
});
test('without a living ruler the newcomer takes the court religion', () => {
  const withReligion = () => { const state = papal(); state.religions['aaa-test'] = { id: 'aaa-test', name: 'Prov', support: 50, leaderId: null }; return state; };
  const ruled = withReligion();
  assert.equal(newcomerOf(ruled, step(ruled)).religionId, 'latin-church');
  const vacant = withReligion(); vacant.offices.ruler.holderId = null;
  assert.equal(newcomerOf(vacant, step(vacant)).religionId, 'aaa-test');
  const dead = withReligion(); dead.people['leo-iii'].diedAt = '0800-12-01';
  assert.equal(newcomerOf(dead, step(dead)).religionId, 'aaa-test');
});
test('an ended campaign gains nobody', () => {
  const state = papal(); state.status = { ended: true, reason: 'Prov' }; state.lineageRngState = HIGH;
  const before = plain(state), events = step(state);
  assert.deepEqual(state, before);
  assert.equal(events.length, 0);
});
test('a Hadara state gains nobody', () => {
  const state = createCharacterSystem({ seed: 321 }), before = JSON.stringify(state), events = [];
  courtRenewalStep(state, events, actionHooks(state));
  assert.equal(JSON.stringify(state), before);
  assert.equal(events.length, 0);
});
test('the renewal step leaves offices and every other stream alone', () => {
  const state = papal(), before = plain(state); step(state, LOW);
  assert.deepEqual(state.offices, before.offices);
  assert.deepEqual(streams(state), streams(before));
});
test('a year in Kyrkostaten brings Hovman 1 to court', () => {
  const next = ok(advanceCharacters(papal(), '0801-12-25'));
  assert.equal(next.courtRenewal.newcomers, 1);
  assert.equal(Object.values(next.people).filter(person => person.name === 'Hovman 1 (genererad)').length, 1);
  const arrivals = next.log.filter(event => event.type === 'arrival');
  assert.equal(arrivals.length, 1); assert.equal(arrivals[0].date, '0801-12-25');
  assert.deepEqual(normalizeCharacterSystem(plain(next)), next);
});
test('a generated adult with nobody to marry gains a spouse on a low draw', () => {
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
});
test('a high draw creates no spouse and spends one lineage draw', () => {
  const state = papal(); step(state, HIGH);
  assert.equal(Object.values(state.people).some(person => person.name === 'Gemål 1 (genererad)'), false);
  assert.equal(state.lineageRngState, afterDraws(HIGH, 1));
});
test('the renewal step never touches the main or other streams', () => {
  const state = papal(), before = streams(state); step(state, LOW);
  assert.deepEqual(streams(state), before);
});
test('a matchmaking partner at court blocks the generated spouse and its draw', () => {
  const state = papal(); crowd(state, 1);
  state.people['generated-courtier-1'].bornAt = '0775-01-01';
  probe(state, 'p-woman', { sex: 'female', bornAt: '0770-01-01' });
  step(state, LOW);
  assert.equal(state.people['generated-courtier-1'].spouseId, null);
  assert.equal(state.lineageRngState, LOW);
});
test('rulers and priests gain no generated spouse and spend no draw', () => {
  for (const [officeId, personId] of [['ruler', 'generated-courtier-1'], ['priest', 'generated-courtier-3']]) {
    const state = papal({ mode: 'family', familyId: 'leo-household' }); crowd(state, 2);
    state.offices[officeId].holderId = personId; state.people[personId].bornAt = '0775-01-01';
    assert.equal(actionHooks(state).activeRepresentative().id, 'leo-iii');
    step(state, LOW);
    assert.equal(state.people[personId].spouseId, null, officeId);
    assert.equal(state.lineageRngState, LOW, officeId);
  }
});
test('the age window runs from 18 to 35', () => {
  const run = changes => { const state = papal(); crowd(state, 2); Object.assign(state.people['generated-courtier-1'], changes); step(state, LOW); return state; };
  const spouseOf = state => state.people[state.people['generated-courtier-1'].spouseId];
  const old = run({ bornAt: '0764-01-01' });
  assert.equal(old.people['generated-courtier-1'].spouseId, null); assert.equal(old.lineageRngState, LOW);
  assert.equal(spouseOf(run({ bornAt: '0765-01-01' })).bornAt, '0768-01-01');
  assert.equal(spouseOf(run({ bornAt: '0782-01-01' })).bornAt, '0782-01-01');
  const husband = spouseOf(run({ sex: 'female', bornAt: '0765-01-01' }));
  assert.deepEqual([husband.name, husband.sex, husband.bornAt], ['Gemål 1 (genererad)', 'male', '0762-01-01']);
});
test('the ceiling of twelve court adults stops the walk', () => {
  const court = n => { const state = papal(); crowd(state, n); for (const id of ['generated-courtier-1', 'generated-courtier-2']) state.people[id].bornAt = '0775-01-01'; return state; };
  const eleven = court(7);
  assert.equal(courtAdults(eleven).length, 11);
  step(eleven, LOW);
  assert.equal(spouses(eleven).length, 1);
  assert.equal(spouses(eleven)[0].spouseId, 'generated-courtier-1');
  assert.equal(eleven.lineageRngState, afterDraws(LOW, 1));
  const twelve = court(8);
  assert.equal(courtAdults(twelve).length, 12);
  step(twelve, LOW);
  assert.equal(spouses(twelve).length, 0);
  assert.equal(twelve.lineageRngState, LOW);
});
test('the active representative of a family campaign gains no generated spouse', () => {
  const state = papal({ mode: 'family', familyId: 'generated-house-1' }); crowd(state, 2);
  state.people['generated-courtier-1'].bornAt = '0775-01-01';
  assert.equal(actionHooks(state).activeRepresentative().id, 'generated-courtier-1');
  step(state, LOW);
  assert.equal(state.people['generated-courtier-1'].spouseId, null);
  assert.equal(state.lineageRngState, LOW);
});

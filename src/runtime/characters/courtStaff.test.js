import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { advanceCharacters, createCharacterSystem, getCharacterAge, normalizeCharacterSystem } from './index.js';
import { validateCharacterExtensions } from './extensions.js';
import { NAME_POOL, SKILL_LABELS, TRAITS } from './content.js';
import { STAFF_ROLES, ensureStaff, staffOf, validateCourtStaff } from './courtStaff.js';
// svenska-guard: ok (the words "constructor" and "__proto__" below are JavaScript property names used as forged values, not Swedish)

const plain = (state) => JSON.parse(JSON.stringify(state));
const streams = (state) => [state.rngState, state.actionRngState];
const fresh = () => createCharacterSystem({ seed: 321 });
const msg = (text) => ({ name: 'Error', message: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
// One sentence per failure class, shared by ensureStaff and validateCourtStaff.
const M = {
  id: 'En hovtjänares id är ogiltigt eller stämmer inte med sin nyckel.',
  role: 'Hovtjänstens roll är okänd.',
  family: 'Hovtjänstens hushåll finns inte.',
  name: 'En hovtjänare saknar namn.',
  skills: 'En hovtjänare har ogiltiga färdigheter.',
  traits: 'En hovtjänare har ogiltiga egenskaper.',
  loyalty: 'En hovtjänare har ogiltig lojalitet.',
  date: 'En hovtjänares livsdatum är ogiltiga.',
  dup: 'Ett hushåll har två levande hovtjänare i samma roll.',
  collection: 'Karaktärstilläggens samlingar är ogiltiga.',
};
const SIX = ['command', 'stewardship', 'diplomacy', 'learning', 'intrigue', 'prowess'];
// Expected profile per role: the one skill that stands out, its value, and the fixed trait list. Every other skill is 3.
const PROFILES = {
  cook: ['intrigue', 4, ['greedy']],
  guard_captain: ['prowess', 10, ['brave']],
  physician: ['learning', 10, ['diligent']],
  steward: ['stewardship', 9, ['honest']],
  servant: ['intrigue', 3, ['craven']],
};
const skillsFor = (key, value) => Object.fromEntries(SIX.map((skill) => [skill, skill === key ? value : 3]));

test('the role labels are exactly those of the design', () => {
  assert.deepEqual(STAFF_ROLES, { cook: 'Kock', guard_captain: 'Vaktchef', physician: 'Läkare', steward: 'Hovmästare', servant: 'Tjänare' });
  assert.deepEqual(Object.keys(SKILL_LABELS), SIX, 'the six skill keys of Task 1');
});

test('ensureStaff creates a staff member with the agreed fields and spends only one sequence number', () => {
  const state = fresh(), seq = state.sequence, before = streams(state), people = plain(state.people);
  const cook = ensureStaff(state, 'family-arel', 'cook');
  const n = seq + 1;
  assert.deepEqual(cook, { id: `staff-${n}`, name: `${NAME_POOL[n % NAME_POOL.length]} (Kock)`, familyId: 'family-arel', role: 'cook', skills: skillsFor('intrigue', 4), traits: ['greedy'], loyalty: 55, bornAt: addGameMonths(state.date, -360), diedAt: null });
  assert.equal(state.sequence, n);
  assert.deepEqual(Object.keys(state.courtStaff), [cook.id]);
  assert.equal(state.courtStaff[cook.id], cook, 'stored under its own id');
  assert.deepEqual(state.people, people, 'staff are never people');
  assert.deepEqual(streams(state), before, 'creation draws no randomness');
  validateCharacterExtensions(state);
});

test('creation changes nothing in the state except courtStaff and sequence', () => {
  const state = fresh(), before = plain(state);
  ensureStaff(state, 'family-namar', 'steward');
  ensureStaff(state, 'family-safra', 'servant');
  const after = plain(state);
  assert.equal(after.sequence, before.sequence + 2);
  for (const copy of [before, after]) { delete copy.courtStaff; delete copy.sequence; }
  assert.deepEqual(after, before);
});

test('every role gets its own skills and trait', () => {
  const state = fresh();
  for (const role of Object.keys(STAFF_ROLES)) {
    const [skill, value, traits] = PROFILES[role];
    const staff = ensureStaff(state, 'family-eshmun', role);
    assert.deepEqual(staff.skills, skillsFor(skill, value), role);
    assert.deepEqual(Object.keys(staff.skills), SIX, `${role} has the six keys in order`);
    assert.deepEqual(staff.traits, traits, role);
    for (const trait of staff.traits) assert.ok(Object.hasOwn(TRAITS, trait), `${role} trait ${trait} is a known trait`);
    assert.equal(staff.role, role);
    assert.match(staff.name, new RegExp(`\\(${STAFF_ROLES[role]}\\)$`));
  }
  validateCharacterExtensions(state);
});

test('the name takes the numeric part of the id modulo the name pool', () => {
  const state = fresh();
  state.sequence = 19;
  assert.equal(ensureStaff(state, 'family-arel', 'cook').name, 'Adara (Kock)', 'staff-20 wraps to index 0');
  assert.equal(ensureStaff(state, 'family-arel', 'physician').name, 'Belen (Läkare)', 'staff-21 is index 1');
  state.sequence = 2;
  const steward = ensureStaff(state, 'family-namar', 'steward');
  assert.equal(steward.id, 'staff-3');
  assert.equal(steward.name, 'Dema (Hovmästare)', 'staff-3 is index 3');
  state.sequence = 37;
  assert.equal(ensureStaff(state, 'family-safra', 'servant').name, `${NAME_POOL[18]} (Tjänare)`);
});

test('the staff member is born exactly thirty years before the campaign date, on the game calendar', () => {
  const state = fresh();
  const staff = ensureStaff(state, 'family-arel', 'guard_captain');
  assert.equal(staff.bornAt, addGameMonths(state.date, -360));
  assert.equal(getCharacterAge(staff, state.date), 30);
  assert.equal(staff.diedAt, null);
  const ancient = fresh();
  ancient.date = '-0100-05-01';
  assert.equal(ensureStaff(ancient, 'family-arel', 'cook').bornAt, '-0130-05-01', 'BC years step over the missing year zero');
});

test('a second call returns the same person and spends nothing', () => {
  const state = fresh();
  const first = ensureStaff(state, 'family-arel', 'physician');
  const seq = state.sequence, before = [...streams(state)], snapshot = plain(state);
  assert.equal(ensureStaff(state, 'family-arel', 'physician'), first);
  assert.equal(ensureStaff(state, 'family-arel', 'physician'), first);
  assert.equal(state.sequence, seq);
  assert.deepEqual(streams(state), before);
  assert.deepEqual(plain(state), snapshot);
});

test('different households and different roles get different staff', () => {
  const state = fresh();
  const arelCook = ensureStaff(state, 'family-arel', 'cook'), namarCook = ensureStaff(state, 'family-namar', 'cook'), arelGuard = ensureStaff(state, 'family-arel', 'guard_captain');
  assert.equal(new Set([arelCook.id, namarCook.id, arelGuard.id]).size, 3);
  assert.equal(arelCook.familyId, 'family-arel'); assert.equal(namarCook.familyId, 'family-namar');
  assert.equal(ensureStaff(state, 'family-namar', 'cook'), namarCook);
  assert.deepEqual(staffOf(state, 'family-arel'), [arelCook, arelGuard]);
  assert.deepEqual(staffOf(state, 'family-namar'), [namarCook]);
  assert.deepEqual(staffOf(state, 'family-safra'), []);
  assert.deepEqual(staffOf(state, 'family-nobody'), []);
  assert.deepEqual(staffOf(state, 'constructor'), []);
});

test('staffOf lists living staff only, and a dead holder of a role is replaced', () => {
  const state = fresh();
  const old = ensureStaff(state, 'family-eshmun', 'steward');
  old.diedAt = addGameMonths(state.date, -1);
  assert.deepEqual(staffOf(state, 'family-eshmun'), []);
  validateCourtStaff(state);
  const replacement = ensureStaff(state, 'family-eshmun', 'steward');
  assert.notEqual(replacement.id, old.id);
  assert.equal(replacement.diedAt, null);
  assert.deepEqual(staffOf(state, 'family-eshmun'), [replacement]);
  assert.equal(Object.keys(state.courtStaff).length, 2, 'the dead one stays on record');
  validateCharacterExtensions(state);
});

test('an unknown role or household throws one Swedish sentence and creates nothing', () => {
  const state = fresh(), before = plain(state);
  for (const role of ['jester', 'constructor', '__proto__', 'toString', '', undefined, null, 7, {}, ['cook']]) assert.throws(() => ensureStaff(state, 'family-arel', role), msg(M.role), `role ${String(role)}`);
  for (const familyId of ['family-nobody', 'constructor', '__proto__', 'toString', '', undefined, null, 7, {}, ['family-arel']]) assert.throws(() => ensureStaff(state, familyId, 'cook'), msg(M.family), `family ${String(familyId)}`);
  assert.throws(() => ensureStaff(state, 'family-nobody', 'jester'), msg(M.role), 'the role is checked first');
  assert.deepEqual(plain(state), before, 'sequence and every other field unchanged');
  assert.deepEqual(state.courtStaff, {});
});

test('ensureStaff refuses a state whose staff collection is not a plain object', () => {
  const state = fresh();
  state.courtStaff = [];
  assert.throws(() => ensureStaff(state, 'family-arel', 'cook'), msg(M.collection));
  state.courtStaff = null;
  assert.throws(() => ensureStaff(state, 'family-arel', 'cook'), msg(M.collection));
});

// A valid world with staff in two households to tamper with.
function staffed() {
  const state = fresh();
  ensureStaff(state, 'family-arel', 'cook');
  ensureStaff(state, 'family-namar', 'physician');
  validateCourtStaff(state); validateCharacterExtensions(state);
  return state;
}
const first = (state) => Object.values(state.courtStaff)[0];

test('validation rejects a staff member whose household does not exist', () => {
  const state = staffed();
  first(state).familyId = 'family-nobody';
  assert.throws(() => validateCourtStaff(state), msg(M.family));
  assert.throws(() => validateCharacterExtensions(state), msg(M.family), 'validateCharacterExtensions calls it');
  for (const familyId of ['constructor', undefined, null, 4]) { first(state).familyId = familyId; assert.throws(() => validateCourtStaff(state), msg(M.family), String(familyId)); }
});

test('validation checks every field of every staff member', () => {
  const cases = {
    'key differs from the id': [(s) => { first(s).id = 'staff-999999'; }, M.id],
    'id not of the form staff-n': [(s) => { const staff = first(s); const key = staff.id; delete s.courtStaff[key]; staff.id = 'person-1'; s.courtStaff['person-1'] = staff; }, M.id],
    'id with a leading zero': [(s) => { const staff = first(s); const key = staff.id; delete s.courtStaff[key]; staff.id = `staff-0${key.slice(6)}`; s.courtStaff[staff.id] = staff; }, M.id],
    'id above the sequence': [(s) => { const staff = first(s); delete s.courtStaff[staff.id]; staff.id = `staff-${s.sequence + 1}`; s.courtStaff[staff.id] = staff; }, M.id],
    'id not a string': [(s) => { first(s).id = 5; }, M.id],
    'entry is not an object': [(s) => { s.courtStaff['staff-1'] = null; }, M.id],
    'unknown role': [(s) => { first(s).role = 'jester'; }, M.role],
    'inherited role name': [(s) => { first(s).role = 'constructor'; }, M.role],
    'empty name': [(s) => { first(s).name = ''; }, M.name],
    'name not a string': [(s) => { first(s).name = 12; }, M.name],
    'skills not an object': [(s) => { first(s).skills = [3, 3, 3, 3, 3, 3]; }, M.skills],
    'a skill key missing': [(s) => { delete first(s).skills.prowess; }, M.skills],
    'a skill below 0': [(s) => { first(s).skills.command = -1; }, M.skills],
    'a skill above 20': [(s) => { first(s).skills.learning = 21; }, M.skills],
    'a skill that is not finite': [(s) => { first(s).skills.intrigue = Infinity; }, M.skills],
    'a skill that is NaN': [(s) => { first(s).skills.diplomacy = NaN; }, M.skills],
    'a skill that is a string': [(s) => { first(s).skills.stewardship = '3'; }, M.skills],
    'traits not an array': [(s) => { first(s).traits = 'greedy'; }, M.traits],
    'unknown trait': [(s) => { first(s).traits = ['sneaky']; }, M.traits],
    'inherited trait name': [(s) => { first(s).traits = ['constructor']; }, M.traits],
    'trait that is not a string': [(s) => { first(s).traits = [1]; }, M.traits],
    'loyalty below 0': [(s) => { first(s).loyalty = -1; }, M.loyalty],
    'loyalty above 100': [(s) => { first(s).loyalty = 101; }, M.loyalty],
    'loyalty not finite': [(s) => { first(s).loyalty = NaN; }, M.loyalty],
    'loyalty not a number': [(s) => { first(s).loyalty = '55'; }, M.loyalty],
    'bornAt missing': [(s) => { delete first(s).bornAt; }, M.date],
    'bornAt not a date': [(s) => { first(s).bornAt = 'sommaren 1020'; }, M.date],
    'bornAt not canonical': [(s) => { first(s).bornAt = '980-1-1'; }, M.date],
    'bornAt after the campaign date': [(s) => { first(s).bornAt = addGameMonths(s.date, 1); }, M.date],
    'diedAt undefined': [(s) => { delete first(s).diedAt; }, M.date],
    'diedAt not a date': [(s) => { first(s).diedAt = 'dead'; }, M.date],
    'diedAt before bornAt': [(s) => { first(s).diedAt = addGameMonths(first(s).bornAt, -1); }, M.date],
    'diedAt after the campaign date': [(s) => { first(s).diedAt = addGameMonths(s.date, 1); }, M.date],
  };
  for (const [name, [tamper, expected]] of Object.entries(cases)) {
    const state = staffed();
    tamper(state);
    assert.throws(() => validateCourtStaff(state), msg(expected), name);
    assert.throws(() => validateCharacterExtensions(state), msg(expected), `${name} through validateCharacterExtensions`);
  }
});

test('validation allows one living and any number of dead staff per household and role, but not two living', () => {
  const state = staffed();
  const live = first(state);
  const twin = { ...plain(live), id: `staff-${++state.sequence}` };
  state.courtStaff[twin.id] = twin;
  assert.throws(() => validateCourtStaff(state), msg(M.dup));
  assert.throws(() => validateCharacterExtensions(state), msg(M.dup));
  twin.diedAt = state.date;
  validateCourtStaff(state);
  const other = { ...plain(live), id: `staff-${++state.sequence}`, familyId: 'family-safra' };
  state.courtStaff[other.id] = other;
  validateCourtStaff(state);
  validateCharacterExtensions(state);
});

test('a staff collection that is not a plain object is rejected before anything else', () => {
  const state = staffed();
  state.courtStaff = [];
  assert.throws(() => validateCourtStaff(state), msg(M.collection));
});

test('a saved world with staff comes back from normalizeCharacterSystem unchanged, and a tampered one is refused', () => {
  const state = staffed();
  const restored = normalizeCharacterSystem(plain(state));
  assert.deepEqual(restored.courtStaff, state.courtStaff);
  assert.equal(restored.sequence, state.sequence);
  const broken = plain(state);
  Object.values(broken.courtStaff)[0].familyId = 'family-nobody';
  assert.throws(() => normalizeCharacterSystem(broken), msg(M.family));
});

test('ten years of advancing never touch the staff and change nothing else', () => {
  const start = fresh();
  ensureStaff(start, 'family-arel', 'cook'); ensureStaff(start, 'family-arel', 'physician');
  ensureStaff(start, 'family-namar', 'guard_captain'); ensureStaff(start, 'family-namar', 'servant');
  const staffBefore = plain(start.courtStaff), target = addGameMonths(start.date, 120);
  // The comparison world has the same staff created and then removed. Creation spent the same sequence numbers in both, so every id the run hands out matches and the two runs can be compared field by field. A world that never had staff is not the right comparison: its ids differ, and the engine orders same-day ties by the text of the id.
  const removed = plain(start); removed.courtStaff = {};
  const withStaff = advanceCharacters(start, target, { id: 'ten-years' }), without = advanceCharacters(removed, target, { id: 'ten-years' });
  assert.equal(withStaff.ok, true, withStaff.error); assert.equal(without.ok, true, without.error);
  assert.deepEqual(withStaff.state.courtStaff, staffBefore, 'the staff are byte for byte the same');
  const rest = (state) => { const copy = plain(state); delete copy.courtStaff; return copy; };
  assert.deepEqual(rest(withStaff.state), rest(without.state), 'people, streams, log and every other field match');
  assert.deepEqual(withStaff.events, without.events, 'the annual results match');
  // The run was not empty: ten annual steps, new people and a moved main stream.
  assert.equal(withStaff.state.date, target);
  assert.ok(withStaff.events.length > 0 && withStaff.state.rngState !== start.rngState);
  assert.ok(withStaff.state.sequence > start.sequence);
  for (const id of Object.keys(staffBefore)) {
    assert.equal(Object.hasOwn(withStaff.state.people, id), false, `${id} never became a person`);
    assert.ok(!withStaff.events.some((event) => event.participants.includes(id)), `${id} is in no event`);
  }
  validateCharacterExtensions(withStaff.state);
});

// createCharacterSystem({ seed: 321 }) without staff, advanced 12 and 60 months: the same values extensions.test.js pins. Staff spend sequence numbers, which shifts later person ids and so which person a same-day draw lands on (the engine orders ties by the text of the id), but never how many draws are taken. At 120 months the final value does move with any sequence offset, staff or not, so only these horizons are pinned.
const STAFFLESS_RNG = { after12Months: 2318062802, after60Months: 3162113386 };

test('staff in the world leave the number of draws from the main stream unchanged', () => {
  const state = fresh();
  for (const [family, role] of [['family-arel', 'cook'], ['family-arel', 'physician'], ['family-namar', 'guard_captain'], ['family-namar', 'servant']]) ensureStaff(state, family, role);
  const rngAtStart = state.rngState, actionAtStart = state.actionRngState;
  for (const [months, expected] of [[12, STAFFLESS_RNG.after12Months], [60, STAFFLESS_RNG.after60Months]]) {
    const result = advanceCharacters(state, addGameMonths(state.date, months), { id: `years-${months}` });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.state.rngState, expected);
    assert.equal(result.state.actionRngState, actionAtStart);
    assert.equal(Object.keys(result.state.courtStaff).length, 4);
  }
  assert.equal(state.rngState, rngAtStart, 'the input state is not mutated');
});

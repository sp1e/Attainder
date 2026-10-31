import test from 'node:test';
import assert from 'node:assert/strict';
import { canExerciseMandate, getCharacterAge, getIncapacityCauseIds, isAdultCharacter, selectMandateRegent } from './characterCapacity.js';

const date = '-0300-07-01';
const person = (id = 'principal', familyId = 'own', bornAt = '-0330-01-01') => ({ id, familyId, bornAt, diedAt: null, health: 100, stress: 0, healthConditions: [] });
const condition = (kind, severity = 3, stage = 'active', id = kind) => ({ id, kind, severity, stage, startedAt: '-0300-01-01', stageHistory: [{ stage, date: '-0300-01-01' }] });
const fixture = (people) => ({ date, people: Object.fromEntries(people.map((p) => [p.id, p])), families: { own: { id: 'own', exiled: false }, outside: { id: 'outside', exiled: false } } });

for (const kind of ['smallpox', 'fever', 'injury']) for (const stage of ['active', 'recovering']) {
  test(`severe ${kind} in ${stage} prevents acting without changing adulthood`, () => {
    const subject = person(); subject.healthConditions = [condition(kind, 3, stage)];
    assert.equal(isAdultCharacter(subject, date), true);
    assert.equal(canExerciseMandate(subject, date), false);
    assert.deepEqual(getIncapacityCauseIds(subject, date), [kind]);
  });
}

test('lesser illness, scars, grief and low general health alone do not remove capacity', () => {
  const subject = person(); subject.health = 1; subject.stress = 200;
  subject.healthConditions = [condition('fever', 2), condition('injury', 1), condition('smallpox', 3, 'scarred'), condition('bereavement', 3)];
  assert.equal(canExerciseMandate(subject, date), true);
  assert.deepEqual(getIncapacityCauseIds(subject, date), []);
});

test('capacity follows recorded health boundaries and retains every overlapping cause', () => {
  const subject = person();
  subject.healthConditions = [condition('injury', 3, 'resolved', 'z-injury'), condition('fever', 3, 'resolved', 'a-fever')];
  for (const item of subject.healthConditions) item.stageHistory = [
    { stage: 'active', date: '-0300-01-01' }, { stage: 'recovering', date: '-0300-04-01' }, { stage: 'resolved', date: '-0300-07-01' },
  ];
  const before = structuredClone(subject);
  assert.deepEqual(getIncapacityCauseIds(subject, '-0301-12-01'), []);
  assert.deepEqual(getIncapacityCauseIds(subject, '-0300-06-30'), ['a-fever', 'z-injury']);
  assert.equal(canExerciseMandate(subject, date), true);
  assert.deepEqual(subject, before);
});

test('missing, dead and underage people cannot exercise a mandate', () => {
  const child = person('child', 'own', '-0318-07-02');
  assert.equal(getCharacterAge(child, date), 17);
  assert.equal(canExerciseMandate(child, date), false);
  assert.equal(canExerciseMandate(child, '-0300-07-02'), true);
  assert.equal(canExerciseMandate(null, date), false);
  const dead = person(); dead.diedAt = date; dead.healthConditions = [condition('smallpox')];
  assert.equal(canExerciseMandate(dead, date), false);
  assert.deepEqual(getIncapacityCauseIds(dead, date), []);
});

test('age retains the calendar rule across the BCE/CE boundary', () => {
  const subject = person('adult', 'own', '-0018-07-01');
  assert.equal(getCharacterAge(subject, '0001-06-30'), 17);
  assert.equal(getCharacterAge(subject, '0001-07-01'), 18);
});

test('regent selection prefers a capable relative and is independent of map insertion order', () => {
  const principal = person(); const elder = person('elder', 'own', '-0350-01-01');
  elder.healthConditions = [condition('smallpox')];
  const kin = person('kin'); const outsider = person('outside', 'outside', '-0360-01-01');
  const state = fixture([principal, elder, outsider, kin]); const before = structuredClone(state);
  const args = { principalId: principal.id, scope: 'royal', basis: 'incapacity' };
  assert.equal(selectMandateRegent(state, args), 'kin');
  assert.equal(selectMandateRegent(fixture([kin, outsider, elder, principal]), args), 'kin');
  assert.deepEqual(state, before);
});

test('an exiled household may represent its own family but not gain new royal access', () => {
  const state = fixture([person(), person('kin'), person('outside', 'outside')]);
  state.families.own.exiled = true;
  assert.equal(selectMandateRegent(state, { principalId: 'principal', scope: 'family', basis: 'incapacity' }), 'kin');
  assert.equal(selectMandateRegent(state, { principalId: 'principal', scope: 'royal', basis: 'incapacity' }), 'outside');
  state.families.outside.exiled = true;
  assert.equal(selectMandateRegent(state, { principalId: 'principal', scope: 'royal', basis: 'incapacity' }), null);
  state.people.kin.healthConditions = [condition('fever')];
  assert.equal(selectMandateRegent(state, { principalId: 'principal', scope: 'family', basis: 'incapacity' }), null);
});

test('minority candidate access keeps existing exile rules while excluding illness', () => {
  const state = fixture([person(), person('kin')]); state.families.own.exiled = true;
  const args = { principalId: 'principal', scope: 'royal', basis: 'minority' };
  assert.equal(selectMandateRegent(state, args), 'kin');
  state.people.kin.healthConditions = [condition('injury')];
  assert.equal(selectMandateRegent(state, args), null);
});

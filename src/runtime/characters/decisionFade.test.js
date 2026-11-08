// A dead person's last decision fades: nothing reads it once the person has died.
// Spec: docs/superpowers/specs/2026-11-08-decision-fade-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { diffCharacterState, patchCharacterData } from '../characterWorld.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, normalizeCharacterSystem } from './index.js';

const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const clone = (value) => JSON.parse(JSON.stringify(value));
const DEAD = 'person-1-5', LIVING = 'person-0-1';
const decision = (state) => ({ personId: DEAD, choice: 'recover', reasons: ['Test'], scores: { recover: 5 }, date: state.date });

const withDeadDecision = () => {
  const state = clone(createCharacterSystem());
  Object.assign(state.people[DEAD], { diedAt: state.date, deathReason: 'Test', lastDecision: decision(state) });
  state.people[LIVING].lastDecision = { ...decision(state), personId: LIVING };
  return state;
};

test('a time step clears the last decision of the dead and keeps that of the living', () => {
  const state = withDeadDecision();
  assert.doesNotThrow(() => normalizeCharacterSystem(state));
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  assert.equal(after.people[DEAD].lastDecision, null);
  assert.ok('lastDecision' in after.people[DEAD], 'the key stays on the person record');
  assert.equal(after.people[LIVING].lastDecision?.choice, 'recover');
  assert.doesNotThrow(() => normalizeCharacterSystem(after));
});

test('a command does not clear the last decision of the dead', () => {
  const state = withDeadDecision();
  const after = ok(executeCharacterCommand(state, { id: 'rest', type: 'rest', payload: {}, expectedRevision: state.revision }));
  assert.equal(after.people[DEAD].lastDecision?.choice, 'recover');
});

test('the patch records the cleared decision as a null value', () => {
  const state = withDeadDecision();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  const changes = diffCharacterState(state, after);
  assert.ok(changes.some((change) => change.path.join('.') === `people.${DEAD}.lastDecision` && change.value === null));
  assert.deepEqual(patchCharacterData(state, changes), after);
});

test('a person who dies during a long jump ends it without a last decision', () => {
  const state = clone(createCharacterSystem());
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 12 * 80), { id: 'long' }));
  const dead = Object.values(after.people).filter((person) => person.diedAt);
  assert.ok(dead.length > 0, 'eighty years leave dead persons');
  assert.deepEqual(dead.filter((person) => person.lastDecision != null).map((person) => person.id), []);
});

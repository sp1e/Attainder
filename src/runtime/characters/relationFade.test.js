// Personal relations between two dead persons fade unless the action log can still adjust them.
// Spec: docs/superpowers/specs/2026-11-08-relation-fade-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { diffCharacterState, patchCharacterData } from '../characterWorld.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, fadeDeadRelations, normalizeCharacterSystem } from './index.js';

const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const clone = (value) => JSON.parse(JSON.stringify(value));
const A = 'person-1-5', B = 'person-1-4', C = 'person-2-5', LIVING = 'person-0-1';

const relation = (fromId, toId, causes = []) => ({ fromId, toId, bonds: [], causes });
const cause = (id, causeId) => ({ id, amount: -5, label: 'Test', causeId, startAt: '-0300-01-01', expiresAt: null });

const withDeadRelations = () => {
  const state = clone(createCharacterSystem());
  for (const id of [A, B, C]) Object.assign(state.people[id], { diedAt: state.date, deathReason: 'Test' });
  Object.assign(state.relations, {
    [`${A}:${B}`]: relation(A, B, [cause('opinion-test-1', 'x')]),
    [`${A}:${LIVING}`]: relation(A, LIVING, [cause('opinion-test-2', 'y')]),
    [`${LIVING}:${A}`]: relation(LIVING, A, [cause('opinion-test-3', 'z')]),
    [`${B}:${C}`]: relation(B, C, [cause('opinion-test-4', 'w')]),
  });
  return state;
};

test('a time step removes relations between two dead persons and keeps those with a living side', () => {
  const state = withDeadRelations();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  assert.ok(!after.relations[`${A}:${B}`] && !after.relations[`${B}:${C}`]);
  assert.ok(after.relations[`${A}:${LIVING}`] && after.relations[`${LIVING}:${A}`]);
  assert.doesNotThrow(() => normalizeCharacterSystem(after));
});

test('a relation that an action log opinion effect can still adjust stays', () => {
  const state = withDeadRelations();
  state.actionLog.push({ id: 'resolution-test', effects: [{ kind: 'opinion', fromId: B, toId: C, causeId: 'w' }] });
  fadeDeadRelations(state);
  assert.ok(state.relations[`${B}:${C}`], 'named by an opinion effect');
  assert.ok(!state.relations[`${A}:${B}`]);
});

test('a relation whose cause another value names stays', () => {
  const state = withDeadRelations();
  state.log.push({ id: 'citing-entry', date: state.date, type: 'test', title: 'Orsak', description: '', participants: [], public: true, opinionId: 'opinion-test-4' });
  fadeDeadRelations(state);
  assert.ok(state.relations[`${B}:${C}`]);
});

test('a command does not fade relations', () => {
  const state = withDeadRelations();
  const after = ok(executeCharacterCommand(state, { id: 'rest', type: 'rest', payload: {}, expectedRevision: state.revision }));
  assert.ok(after.relations[`${A}:${B}`]);
});

test('the patch removes faded relations by key', () => {
  const state = withDeadRelations();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  const changes = diffCharacterState(state, after);
  assert.ok(changes.some((change) => change.remove && change.path.join(':') === `relations:${A}:${B}`));
  assert.deepEqual(patchCharacterData(state, changes), after);
});

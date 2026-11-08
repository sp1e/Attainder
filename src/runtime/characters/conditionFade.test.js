// A dead person's resolved conditions fade unless something else in the state names them.
// Spec: docs/superpowers/specs/2026-11-08-condition-fade-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { diffCharacterState, patchCharacterData } from '../characterWorld.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, normalizeCharacterSystem } from './index.js';

const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const clone = (value) => JSON.parse(JSON.stringify(value));
const DEAD = 'person-1-5', LIVING = 'person-0-1', DATE = createCharacterSystem().date;

const condition = (id, kind, stage, extra = {}) => ({ id, kind, stage, severity: 1, startedAt: DATE,
  nextTransitionAt: null, nextExposureAt: null,
  stageHistory: [{ stage: 'active', date: DATE }, ...(stage === 'active' ? [] : [{ stage, date: DATE }])],
  treatment: null, causeId: null, scarRoll: 0.5, outcomeRoll: 0.5, endedAt: stage === 'active' ? undefined : DATE, ...extra });

const withDeadConditions = () => {
  const state = clone(createCharacterSystem());
  Object.assign(state.people[DEAD], { diedAt: state.date, deathReason: 'Test' });
  state.people[DEAD].healthConditions.push(
    condition('keep-scar', 'smallpox', 'scarred'),
    condition('fade-fever', 'fever', 'resolved'),
    condition('fade-grief', 'bereavement', 'resolved', { relatedPersonId: LIVING }),
    condition('keep-fatal', 'fever', 'active', { fatalAt: state.date }),
    condition('keep-cited', 'injury', 'resolved'),
  );
  state.people[LIVING].healthConditions.push(condition('keep-living', 'fever', 'resolved'));
  state.stories.push({ ...clone(state.stories[0]), id: 'citing-story', conditionId: 'keep-cited' });
  return state;
};

const conditionIds = (state, personId) => state.people[personId].healthConditions.map((item) => item.id);

test('a time step removes resolved conditions of the dead and keeps scars, the illness at death and cited ones', () => {
  const state = withDeadConditions();
  assert.doesNotThrow(() => normalizeCharacterSystem(state));
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  assert.deepEqual(conditionIds(after, DEAD), conditionIds(state, DEAD).filter((id) => !id.startsWith('fade-')));
  assert.ok(conditionIds(after, LIVING).includes('keep-living'), 'a living person keeps a resolved condition');
  assert.doesNotThrow(() => normalizeCharacterSystem(after));
});

test('a command does not fade conditions', () => {
  const state = withDeadConditions();
  const after = ok(executeCharacterCommand(state, { id: 'rest', type: 'rest', payload: {}, expectedRevision: state.revision }));
  assert.deepEqual(conditionIds(after, DEAD), conditionIds(state, DEAD));
});

test('the patch removes faded conditions by index', () => {
  const state = withDeadConditions();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  const changes = diffCharacterState(state, after);
  const removal = changes.find((change) => change.path.join('.') === `people.${DEAD}.healthConditions`);
  assert.deepEqual(removal?.removeAt, ['fade-fever', 'fade-grief'].map((id) => conditionIds(state, DEAD).indexOf(id)));
  assert.deepEqual(patchCharacterData(state, changes), after);
});

test('a condition cited only by a log entry that the cap drops fades in the same step', () => {
  const state = withDeadConditions();
  state.log.push({ id: 'old-entry', date: state.date, type: 'test', title: 'Gammal', description: '', participants: [], public: true, conditionId: 'fade-log' });
  for (let index = 0; index < 130; index += 1) state.log.push({ id: `newer-${index}`, date: state.date, type: 'test', title: `${index}`, description: '', participants: [], public: true });
  state.people[DEAD].healthConditions.push(condition('fade-log', 'fever', 'resolved'));
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  assert.ok(!after.log.some((entry) => entry.id === 'old-entry'));
  assert.ok(!conditionIds(after, DEAD).includes('fade-log'));
});

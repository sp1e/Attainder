// Settled stories older than the crisis memory fade unless the state still names them.
// Spec: docs/superpowers/specs/2026-11-09-story-fade-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { diffCharacterState, patchCharacterData } from '../characterWorld.js';
import { CRISIS_MEMORY_MONTHS } from './breakdowns.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, normalizeCharacterSystem } from './index.js';

const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const clone = (value) => JSON.parse(JSON.stringify(value));

// The demo's office promise, copied with each rule's case. Ages count back from the start date.
const withSettledStories = () => {
  const state = clone(createCharacterSystem());
  state.memories.push({ id: 'memory-cause', date: state.date, type: 'office', title: 'Prov', participants: ['person-0-0'], causeId: null, knownBy: 'public', familyIds: ['family-arel'] });
  const base = state.stories[0], causeId = 'memory-cause';
  const story = (id, status, months, extra = {}) => ({ ...clone(base), id, status, createdAt: addGameMonths(state.date, -months),
    dueAt: addGameMonths(state.date, -months + 12), ...(status === 'open' ? {} : { resolvedAt: addGameMonths(state.date, -months + 1) }), ...extra });
  state.stories.unshift(story('story-keep-first', 'open', 0));
  state.stories.push(
    story('story-fade-closed', 'closed', CRISIS_MEMORY_MONTHS + 12),
    story('story-fade-resolved', 'resolved', CRISIS_MEMORY_MONTHS + 12, { causeId: 'memory-gone' }),
    story('story-keep-young', 'closed', CRISIS_MEMORY_MONTHS - 6),
    story('story-keep-cause', 'resolved', CRISIS_MEMORY_MONTHS + 12, { causeId }),
    story('story-keep-cited', 'closed', CRISIS_MEMORY_MONTHS + 12),
    story('story-keep-waiting', 'waiting', CRISIS_MEMORY_MONTHS + 12),
  );
  state.memories.push({ ...clone(state.memories[0]), id: 'memory-cites-story', causeId: 'story-keep-cited' });
  return state;
};

const ids = (state) => state.stories.map((item) => item.id);

test('a time step removes old settled stories that nothing names and keeps the rest', () => {
  const state = withSettledStories();
  assert.doesNotThrow(() => normalizeCharacterSystem(state));
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  for (const id of ['story-fade-closed', 'story-fade-resolved']) assert.ok(!ids(after).includes(id), `${id} fades`);
  for (const id of ['story-keep-first', 'story-keep-young', 'story-keep-cause', 'story-keep-cited', 'story-keep-waiting']) assert.ok(ids(after).includes(id), `${id} stays`);
  assert.doesNotThrow(() => normalizeCharacterSystem(after));
});

test('a command does not fade stories', () => {
  const state = withSettledStories();
  const after = ok(executeCharacterCommand(state, { id: 'rest', type: 'rest', payload: {}, expectedRevision: state.revision }));
  assert.ok(ids(after).includes('story-fade-closed'));
});

test('the patch removes faded stories by index', () => {
  const state = withSettledStories();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  const changes = diffCharacterState(state, after);
  const removal = changes.find((change) => change.path.join('.') === 'stories' && change.removeAt);
  assert.deepEqual(removal?.removeAt, ['story-fade-closed', 'story-fade-resolved'].map((id) => ids(state).indexOf(id)));
  assert.deepEqual(patchCharacterData(state, changes), after);
});

test('a resolved stress crisis inside the crisis memory stays for the breakdown rule', () => {
  const state = withSettledStories();
  state.stories.push({ ...clone(state.stories.find((item) => item.id === 'story-keep-young')), id: 'story-crisis', type: 'stress_crisis', status: 'resolved',
    createdAt: addGameMonths(state.date, -(CRISIS_MEMORY_MONTHS - 1)) });
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  assert.ok(ids(after).includes('story-crisis'));
});

test('a condition that only a faded story names fades in the same step', () => {
  const state = withSettledStories();
  const dead = state.people['person-1-0'];
  dead.diedAt = state.date;
  dead.healthConditions = [{ id: 'condition-held', kind: 'smallpox', stage: 'resolved', severity: 1, startedAt: addGameMonths(state.date, -90), endedAt: addGameMonths(state.date, -80) }];
  state.stories.find((item) => item.id === 'story-fade-closed').conditionId = 'condition-held';
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  assert.ok(!ids(after).includes('story-fade-closed'));
  assert.deepEqual(after.people['person-1-0'].healthConditions, []);
});

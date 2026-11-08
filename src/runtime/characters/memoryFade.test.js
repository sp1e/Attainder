// Health memories whose participants have all died fade once they fall outside the story director's
// window. Spec: docs/superpowers/specs/2026-11-08-memory-fade-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { diffCharacterState, normalizeCharacterOps, patchCharacterData } from '../characterWorld.js';
import {
  FADING_MEMORY_TYPES, STORY_MEMORY_WINDOW, advanceCharacters, createCharacterSystem,
  executeCharacterCommand, normalizeCharacterSystem,
} from './index.js';

const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const clone = (value) => JSON.parse(JSON.stringify(value));
const DEAD = 'person-1-5', LIVING = 'person-0-1';

const memory = (id, type, participants, extra = {}) => ({ id, date: '0001-01-01', type, title: id, participants,
  causeId: null, familyIds: [], knownBy: 'public', ...extra });

// A started demo court with one dead person, old memories that test each rule, then a full window
// of newer memories with a living participant.
const withOldMemories = () => {
  const state = clone(createCharacterSystem());
  Object.assign(state.people[DEAD], { diedAt: state.date, deathReason: 'Test' });
  state.memories.push(
    memory('fade-dead', 'health_onset', [DEAD]),
    memory('fade-missing', 'bereavement', ['ghost', DEAD]),
    memory('keep-living', 'health_resolved', [DEAD, LIVING]),
    memory('keep-type', 'death', [DEAD]),
    memory('keep-cited', 'health_scars', [DEAD]),
    memory('cites', 'birth', [DEAD], { causeId: 'keep-cited' }),
    memory('fade-treatment', 'health_treatment', [DEAD]),
    memory('keep-story', 'health_onset', [DEAD]),
    memory('keep-nobody', 'health_onset', []),
  );
  state.stories.push({ ...clone(state.stories[0] ?? {}), id: 'citing-story', causeId: 'keep-story' });
  for (let index = 0; index < STORY_MEMORY_WINDOW; index += 1) state.memories.push(memory(`window-${index}`, 'test', [LIVING]));
  state.memories.push(memory('window-dead', 'health_recovering', [DEAD]));
  return state;
};

const ids = (state) => state.memories.map((item) => item.id);

test('the fading types are the six health memory types and the window is the director\'s 1 000', () => {
  assert.deepEqual([...FADING_MEMORY_TYPES].sort(),
    ['bereavement', 'health_onset', 'health_recovering', 'health_resolved', 'health_scars', 'health_treatment']);
  assert.equal(STORY_MEMORY_WINDOW, 1000);
});

test('a time step removes old health memories of the dead and keeps every other memory', () => {
  const state = withOldMemories();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  const kept = ids(after);
  for (const id of ['fade-dead', 'fade-missing', 'fade-treatment']) assert.ok(!kept.includes(id), `${id} fades`);
  for (const id of ['keep-living', 'keep-type', 'keep-cited', 'cites', 'keep-story', 'keep-nobody', 'window-dead']) assert.ok(kept.includes(id), `${id} stays`);
  assert.deepEqual(kept.slice(0, ids(state).length - 3), ids(state).filter((id) => !id.startsWith('fade-')),
    'the kept memories stay in order ahead of new ones');
  assert.doesNotThrow(() => normalizeCharacterSystem(after));
});

test('the story director window holds the same memories after fading', () => {
  const state = withOldMemories();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  const known = new Set(ids(state));
  const unfaded = [...ids(state), ...ids(after).filter((id) => !known.has(id))];
  assert.deepEqual(ids(after).slice(-STORY_MEMORY_WINDOW), unfaded.slice(-STORY_MEMORY_WINDOW));
});

test('a state with fewer memories than the window keeps them all', () => {
  const state = clone(createCharacterSystem());
  Object.assign(state.people[DEAD], { diedAt: state.date, deathReason: 'Test' });
  state.memories.push(memory('young', 'health_onset', [DEAD]));
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  assert.ok(ids(after).includes('young'));
});

test('a command does not fade memories', () => {
  const state = withOldMemories();
  const after = ok(executeCharacterCommand(state, { id: 'rest', type: 'rest', payload: {}, expectedRevision: state.revision }));
  for (const id of ['fade-dead', 'fade-missing', 'fade-treatment']) assert.ok(ids(after).includes(id));
});

test('the patch removes faded entries by index instead of rewriting the list', () => {
  const state = withOldMemories();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 1), { id: 'month' }));
  const changes = diffCharacterState(state, after);
  const removal = changes.find((change) => change.path.join('.') === 'memories' && change.removeAt);
  assert.deepEqual(removal?.removeAt, ['fade-dead', 'fade-missing', 'fade-treatment'].map((id) => ids(state).indexOf(id)));
  assert.equal(changes.filter((change) => change.path[0] === 'memories' && change.path.length > 1).length, 0,
    'no kept memory is rewritten');
  assert.deepEqual(patchCharacterData(state, changes), after);
});

test('removal by index also carries edits to kept entries and new entries', () => {
  const before = { list: [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }, { id: 'd', v: 1 }] };
  const after = { list: [{ id: 'a', v: 1 }, { id: 'c', v: 2 }, { id: 'e', v: 1 }] };
  const changes = diffCharacterState(before, after);
  assert.deepEqual(changes, [{ path: ['list'], removeAt: [1, 3] }, { path: ['list', 1, 'v'], value: 2 }, { path: ['list'], append: [{ id: 'e', v: 1 }] }]);
  assert.deepEqual(patchCharacterData(before, changes), after);
});

test('lists that are not reordered id records keep the index diff', () => {
  const swapped = diffCharacterState({ list: [{ id: 'a' }, { id: 'b' }] }, { list: [{ id: 'b' }, { id: 'a' }] });
  assert.ok(swapped.every((change) => !change.removeAt));
  const plain = diffCharacterState({ list: [1, 2, 3] }, { list: [1, 3] });
  assert.ok(plain.every((change) => !change.removeAt));
  const duplicate = diffCharacterState({ list: [{ id: 'a' }, { id: 'a' }, { id: 'b' }] }, { list: [{ id: 'a' }, { id: 'b' }] });
  assert.ok(duplicate.every((change) => !change.removeAt));
});

test('a history patch accepts only an ascending list of distinct indices to remove', () => {
  const op = (removeAt) => [{ id: 'p', kind: 'patch', fromRevision: 1, toRevision: 2, changes: [{ path: ['memories'], removeAt }] }];
  assert.deepEqual(normalizeCharacterOps(op([0, 2, 5]))[0].changes, [{ path: ['memories'], removeAt: [0, 2, 5] }]);
  for (const bad of [[], [2, 1], [1, 1], [-1], [0.5], 'x']) assert.throws(() => normalizeCharacterOps(op(bad)), /ogiltig förändring/);
  assert.throws(() => patchCharacterData({ memories: [{ id: 'a' }] }, [{ path: ['memories'], removeAt: [1] }]), /utanför listan/);
});

test('removal at the front together with removal inside the list round-trips', () => {
  const before = { list: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })) };
  const after = { list: [{ id: 'b' }, { id: 'd' }, { id: 'e' }, { id: 'f' }] };
  const changes = diffCharacterState(before, after);
  assert.deepEqual(changes[0], { path: ['list'], removeAt: [0, 2] });
  assert.deepEqual(patchCharacterData(before, changes), after);
  const frontOnly = diffCharacterState(before, { list: before.list.slice(2) });
  assert.deepEqual(frontOnly, [{ path: ['list'], drop: 2 }]);
});

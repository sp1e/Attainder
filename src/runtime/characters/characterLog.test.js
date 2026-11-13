// The engine keeps the suffix of state.log the presentation can show: from the 120th public entry
// from the end. Spec: docs/superpowers/specs/2026-11-08-character-log-cap-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { diffCharacterState, normalizeCharacterOps, patchCharacterData } from '../characterWorld.js';
import {
  CHARACTER_LOG_LIMIT, advanceCharacters, applyRealmDissolution, createCharacterSystem,
  executeCharacterCommand, getCharacterPresentation, keptCharacterLog, normalizeCharacterSystem,
} from './index.js';

const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const clone = (value) => JSON.parse(JSON.stringify(value));

// A started demo court with `count` earlier entries; every seventh one is private.
const withLongLog = (count = 300) => {
  const state = clone(createCharacterSystem());
  for (let index = 0; index < count; index += 1) {
    state.log.push({ id: `test-event-${index}`, date: state.date, type: 'test', title: `Post ${index}`,
      description: '', participants: [], public: index % 7 !== 3 });
  }
  return state;
};

// What the log would hold without the cap: the entries before the call and the ones it appended.
const uncapped = (before, after) => {
  const known = new Set(before.log.map((entry) => entry.id));
  return [...before.log, ...after.log.filter((entry) => !known.has(entry.id))];
};

const assertCapped = (before, after) => {
  const full = uncapped(before, after);
  const publicAt = full.flatMap((entry, index) => entry.public ? [index] : []);
  const cut = publicAt.at(-CHARACTER_LOG_LIMIT);
  assert.deepEqual(after.log, full.slice(cut), 'the log is the suffix from the 120th public entry');
  assert.equal(after.log.filter((entry) => entry.public).length, CHARACTER_LOG_LIMIT);
  assert.equal(after.log[0].public, true, 'the kept log starts at a public entry');
  // The presentation lists each person of an entry once (#216 left older entries with the same person twice).
  const shown = (entry) => ({ ...entry, participants: [...new Set(entry.participants)] });
  assert.deepEqual(getCharacterPresentation(after).log,
    full.filter((entry) => entry.public).slice(-CHARACTER_LOG_LIMIT).reverse().map(shown), 'the presentation log is unchanged');
};

test('the presentation and the cap share one limit of 120 public entries', () => {
  assert.equal(CHARACTER_LOG_LIMIT, 120);
});

test('a time step keeps the log suffix the presentation shows, private entries after the cut included', () => {
  const state = withLongLog();
  const after = ok(advanceCharacters(state, addGameMonths(state.date, 12), { id: 'year' }));
  assertCapped(state, after);
  assert.ok(after.log.some((entry) => entry.public === false), 'a private entry after the cut stays');
});

test('an accepted command caps the log', () => {
  const state = withLongLog();
  assertCapped(state, ok(executeCharacterCommand(state, { id: 'rest', type: 'rest', payload: {}, expectedRevision: state.revision })));
});

test('a host transition caps the log', () => {
  const state = withLongLog();
  assertCapped(state, ok(applyRealmDissolution(state, { id: 'dissolve', date: state.date, reason: 'Riket faller.', hostCandidates: [] })));
});

test('monthly and yearly steps keep the same capped log', () => {
  const state = withLongLog();
  const whole = ok(advanceCharacters(state, addGameMonths(state.date, 12), { id: 'year' }));
  let split = state;
  for (let month = 1; month <= 12; month += 1) split = ok(advanceCharacters(split, addGameMonths(state.date, month), { id: `month-${month}` }));
  assert.deepEqual(split.log, whole.log);
});

const entries = (flags) => flags.map((isPublic, index) => ({ id: `e-${index}`, public: isPublic }));
const repeat = (count, value) => Array.from({ length: count }, () => value);

test('the cap keeps from the 120th public entry, and a log with fewer public entries stays whole', () => {
  const below = entries([...repeat(3, false), ...repeat(119, true), false]);
  assert.equal(keptCharacterLog(below), below, '119 public entries');
  const exact = entries([...repeat(3, false), ...repeat(120, true), false]);
  assert.deepEqual(keptCharacterLog(exact), exact.slice(3), '120 public entries drop the private ones before them');
  const above = entries([true, false, ...repeat(120, true)]);
  assert.deepEqual(keptCharacterLog(above), above.slice(2), '121 public entries');
  const quiet = entries(repeat(300, false));
  assert.equal(keptCharacterLog(quiet), quiet, 'a log without public entries stays whole');
});

test('the replay diff of a capped step drops the oldest entries instead of rewriting each kept one', () => {
  const before = withLongLog();
  const after = ok(advanceCharacters(before, addGameMonths(before.date, 12), { id: 'year' }));
  const changes = diffCharacterState(before, after);
  const logChanges = changes.filter((change) => change.path[0] === 'log');
  assert.deepEqual(logChanges.map((change) => Object.keys(change).filter((key) => key !== 'path').join()), ['drop', 'append']);
  assert.equal(logChanges[0].drop, uncapped(before, after).length - after.log.length);
  assert.deepEqual(patchCharacterData(before, changes), after, 'the patch rebuilds the capped state');
  const [op] = normalizeCharacterOps([{ id: 'p', kind: 'patch', fromRevision: before.revision, toRevision: after.revision, changes }]);
  assert.deepEqual(op.changes, changes, 'stored patches keep the drop change');
});

test('the replay diff of an ordinary change in a list stays per entry', () => {
  const before = { list: [{ id: 'a', n: 1 }, { id: 'b', n: 1 }] }, after = { list: [{ id: 'a', n: 2 }, { id: 'b', n: 1 }] };
  assert.deepEqual(diffCharacterState(before, after), [{ path: ['list', 0, 'n'], value: 2 }]);
  const shifted = { list: [{ id: 'b', n: 1 }, { id: 'c', n: 1 }] };
  assert.deepEqual(diffCharacterState(before, shifted), [{ path: ['list'], drop: 1 }, { path: ['list'], append: [{ id: 'c', n: 1 }] }]);
});

test('a short log stays whole, and loading or a refused command leaves a long log as stored', () => {
  const short = clone(createCharacterSystem());
  const stepped = ok(advanceCharacters(short, addGameMonths(short.date, 12), { id: 'year' }));
  assert.deepEqual(stepped.log, uncapped(short, stepped));
  const long = withLongLog();
  assert.equal(normalizeCharacterSystem(clone(long)).log.length, long.log.length);
  const refused = executeCharacterCommand(long, { id: 'late', type: 'rest', payload: {}, expectedRevision: long.revision + 1 });
  assert.equal(refused.ok, false);
  assert.equal(refused.state.log.length, long.log.length);
});

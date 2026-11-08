import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { advanceCharacters, createCharacterSystem, normalizeCharacterSystem } from './index.js';
import { ensureLineageState, lineageRandom } from './renewal.js';
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

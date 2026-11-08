// Succession reads adoptions from state.adoptions, not from the memories.
// Spec: docs/superpowers/specs/2026-11-08-adoption-record-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { createCharacterSystem, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const candidateIds = (state) => getCharacterPresentation(state).succession.candidates.map((c) => c.id);
const withoutAdoptionMemories = (state) => ({ ...clone(state), memories: state.memories.filter((m) => m.type !== 'adoption') });

// Huayna Capac adopts his nephew; the nephew's father stays among the kin (election.test.js).
const adoptedNephew = () => {
  const data = JSON.parse(readFileSync(new URL('../../../server/seed/historical/world-1500/scenario.json', import.meta.url), 'utf8')).data;
  let state = createHistoricalCharacterSystem({ historicalScenario: data.world.historicalScenario, date: data.game.startDate, polityId: 'inca-empire', mode: 'realm', seed: 321 });
  state.date = '1510-01-01'; state.nextAnnualDate = '1511-01-01';
  const base = state.people.huascar;
  state.people['probe-brother'] = { ...clone(base), id: 'probe-brother', portraitIdentityId: 'probe-brother', bornAt: '1460-01-01', legalParentIds: [], skills: { ...base.skills, diplomacy: 20, stewardship: 20 } };
  state.people['probe-nephew'] = { ...clone(base), id: 'probe-nephew', portraitIdentityId: 'probe-nephew', bornAt: '1505-01-01', legalParentIds: ['probe-brother'] };
  return ok(executeCharacterCommand(state, { id: 'adopt-nephew', expectedRevision: state.revision, type: 'adopt', payload: { childId: 'probe-nephew' } }));
};

test('a new state starts with an empty adoption record', () => {
  assert.deepEqual(createCharacterSystem().adoptions, []);
});

test('the adopt command records the adopter, the child and the date', () => {
  const state = adoptedNephew();
  assert.deepEqual(state.adoptions, [{ adopterId: 'huayna-capac', childId: 'probe-nephew', date: '1510-01-01' }]);
});

test('succession reads the record, so dropping the adoption memories changes no candidate', () => {
  const state = adoptedNephew();
  assert.deepEqual(candidateIds(state).slice(0, 3), ['probe-brother', 'huascar', 'probe-nephew']);
  assert.deepEqual(candidateIds(withoutAdoptionMemories(state)), candidateIds(state));
  assert.notDeepEqual(candidateIds({ ...clone(state), adoptions: [] }).slice(0, 3), candidateIds(state).slice(0, 3), 'an empty record changes the candidates');
});

test('a save without the record gets it from the adoption memories, and normalizing twice changes nothing', () => {
  const state = adoptedNephew();
  const old = clone(state); delete old.adoptions;
  const loaded = normalizeCharacterSystem(old);
  assert.deepEqual(loaded.adoptions, state.adoptions);
  assert.deepEqual(normalizeCharacterSystem(clone(loaded)), loaded);
  assert.deepEqual(candidateIds(loaded), candidateIds(state));
});

test('a save without adoption memories gets an empty record', () => {
  const old = clone(createCharacterSystem()); delete old.adoptions;
  assert.deepEqual(normalizeCharacterSystem(old).adoptions, []);
});

test('a save with a broken adoption record is refused', () => {
  const state = adoptedNephew();
  for (const adoptions of [{}, [{ adopterId: 'nobody', childId: 'probe-nephew', date: '1510-01-01' }], [{ adopterId: 'huayna-capac', childId: 'probe-nephew', date: 'later' }]]) {
    assert.throws(() => normalizeCharacterSystem({ ...clone(state), adoptions }), /Sparfilens adoptioner är ogiltiga\./);
  }
});

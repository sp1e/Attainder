import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { advanceCharacters, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { marriedIn } from './election.js';
import { hasLivingSpouse, isMarried, spouseIdsOf } from './marriage.js';
import { validateHistoricalCourt } from '../historicalScenarios.js';
import { addGameMonths } from '../gameDates.js';

// Karl at Charlemagne's court, given two authored wives for the test: the courtiers
// generated-courtier-2 (first) and generated-courtier-3 (second).
const KARL = 'karl', FIRST = 'generated-courtier-2', SECOND = 'generated-courtier-3';
const clone = value => JSON.parse(JSON.stringify(value));
const data = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;

function twoWivesScenario({ oneSided = false } = {}) {
  const h = clone(data.world.historicalScenario), court = h.courtSeeds[data.game.country];
  const byId = Object.fromEntries(court.people.map(p => [p.id, p]));
  const karl = byId[KARL];
  karl.spouseIds = [FIRST, SECOND];
  karl.claims.spouseIds = { ...karl.claims.spouseIds, noteSv: 'Testhovets två äktenskap.' };
  for (const id of [FIRST, SECOND]) {
    byId[id].sex = 'female';
    byId[id].spouseIds = oneSided && id === SECOND ? [] : [KARL];
    byId[id].claims.spouseIds = { status: 'generated', noteSv: 'Äktenskapet är genererat för testet.', sourceIds: [] };
  }
  return h;
}
const options = h => ({ historicalScenario: h, date: data.game.startDate, polityId: data.game.country, mode: 'realm', seed: 321 });
const seeded = () => createHistoricalCharacterSystem(options(twoWivesScenario()));
let operation = 0;
const run = (state, type, payload) => executeCharacterCommand(state, { id: `spouses-${++operation}`, expectedRevision: state.revision, type, payload });
function dieNextYear(state, ids) {
  const copy = structuredClone(state);
  for (const id of ids) copy.people[id].health = 0;
  const result = advanceCharacters(copy, addGameMonths(copy.date, 12));
  assert.equal(result.ok, true, result.error);
  return result.state;
}
const grieves = (person, deadId) => person.healthConditions.some(c => c.kind === 'bereavement' && c.relatedPersonId === deadId);

test('the validator accepts two reciprocal spouses and still refuses a one-sided second spouse', () => {
  assert.equal(validateHistoricalCourt(twoWivesScenario(), { date: data.game.startDate, polityId: data.game.country }).ok, true);
  assert.equal(validateHistoricalCourt(twoWivesScenario({ oneSided: true }), { date: data.game.startDate, polityId: data.game.country }).ok, false);
});

test('the seed keeps the first spouse in spouseId, the rest in otherSpouseIds, and links every pair', () => {
  const state = seeded();
  assert.equal(state.people[KARL].spouseId, FIRST);
  assert.deepEqual(state.people[KARL].otherSpouseIds, [SECOND]);
  for (const id of [FIRST, SECOND]) {
    assert.equal(state.people[id].spouseId, KARL);
    assert.equal(Object.hasOwn(state.people[id], 'otherSpouseIds'), false);
    assert.deepEqual(state.relations[`${id}:${KARL}`].bonds, ['partner']);
  }
  assert.deepEqual(state.relations[`${KARL}:${FIRST}`].bonds, ['partner']);
  assert.deepEqual(state.relations[`${KARL}:${SECOND}`].bonds, ['partner']);
  assert.deepEqual(normalizeCharacterSystem(clone(state)), state);
  const presented = getCharacterPresentation(state).people.find(p => p.id === KARL);
  assert.deepEqual(presented.otherSpouseIds, [SECOND]);
});

test('the marriage helpers read every spouse in both directions', () => {
  const state = seeded(), karl = state.people[KARL], second = state.people[SECOND];
  assert.deepEqual(spouseIdsOf(karl), [FIRST, SECOND]);
  assert.deepEqual(spouseIdsOf(second), [KARL]);
  assert.deepEqual(spouseIdsOf({ spouseId: null }), []);
  assert.equal(isMarried(karl, second), true);
  assert.equal(isMarried(second, karl), true);
  assert.equal(isMarried(state.people[FIRST], second), false);
  state.people[FIRST].diedAt = state.date;
  assert.equal(hasLivingSpouse(state, karl), true);
  state.people[SECOND].diedAt = state.date;
  assert.equal(hasLivingSpouse(state, karl), false);
});

test('marriedIn counts every spouse of the old ruler', () => {
  const state = seeded();
  const ids = marriedIn(state, state.people[KARL]);
  assert.equal(ids.has(FIRST), true);
  assert.equal(ids.has(SECOND), true);
});

test('the death of the second wife brings the husband grief', () => {
  const state = dieNextYear(seeded(), [SECOND]);
  assert.ok(state.people[SECOND].diedAt);
  assert.equal(grieves(state.people[KARL], SECOND), true);
});

test('the husband\'s death brings both wives grief', () => {
  const state = dieNextYear(seeded(), [KARL]);
  assert.ok(state.people[KARL].diedAt);
  for (const id of [FIRST, SECOND]) assert.equal(grieves(state.people[id], KARL), true, id);
});

test('a living second wife keeps the husband married after the first wife dies', () => {
  const state = dieNextYear(seeded(), [FIRST]);
  assert.ok(state.people[FIRST].diedAt);
  assert.equal(state.people[SECOND].diedAt, null);
  const marry = getAvailableCharacterActions(state).find(action => action.type === 'marry');
  const field = marry.fields.find(f => f.key === 'personId');
  assert.equal(field.options.some(option => option.value === KARL), false);
  const result = run(state, 'marry', { personId: KARL, partnerId: 'generated-courtier-1' });
  assert.equal(result.ok, false);
  assert.match(result.error, /fria att ingå äktenskap/);
});

test('normalization refuses an other spouse that names a missing person or has a bad shape', () => {
  const missing = seeded();
  missing.people[KARL].otherSpouseIds = ['nobody-here'];
  assert.throws(() => normalizeCharacterSystem(missing), /saknad person/);
  for (const bad of ['generated-courtier-3', [KARL], [FIRST], [SECOND, SECOND]]) {
    const state = seeded();
    state.people[KARL].otherSpouseIds = bad;
    assert.throws(() => normalizeCharacterSystem(state), /giltiga egenskaper/, JSON.stringify(bad));
  }
});

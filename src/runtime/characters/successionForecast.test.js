import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { advanceCharacters, applyRealmDissolution, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, getSuccessionForecast } from './index.js';

const rulerId = 'person-0-0';
function advance(state, date) {
  const result = advanceCharacters(state, date);
  assert.equal(result.ok, true, result.error);
  return result.state;
}
function fatalBoundary() {
  const initial = createCharacterSystem({ seed: 321 });
  initial.healthRngState = 1;
  const state = advance(initial, '-0299-01-01');
  state.people[rulerId].healthConditions[0].outcomeRoll = 0;
  return state;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}

test('forecast is a serializable presentation value with no mutation, random draw or persisted copy', () => {
  const state = freeze(createCharacterSystem());
  const before = JSON.stringify(state);
  const forecast = getSuccessionForecast(state);
  assert.equal(forecast.expectedRuler.id, 'person-0-2');
  assert.equal(forecast.currentExercising.ability.action, 'mobilize');
  assert.equal(forecast.expectedRuler.ability.action, 'concord');
  assert.equal(forecast.abilityChanges, true);
  assert.deepEqual(getCharacterPresentation(state).succession.forecast, forecast);
  assert.deepEqual(JSON.parse(JSON.stringify(forecast)), forecast);
  assert.equal(JSON.stringify(state), before);
  assert.equal(Object.hasOwn(state, 'forecast'), false);
  assert.equal(getSuccessionForecast(null), null);
});

test('a usurper succession preserves the separate lawful claimant and heir', () => {
  const initial = fatalBoundary();
  initial.offices.ruler.holderId = 'person-1-0';
  const dying = initial.people['person-1-0'];
  dying.healthConditions = [{ ...structuredClone(initial.people[rulerId].healthConditions[0]), id: 'usurper-illness' }];
  initial.people[rulerId].healthConditions[0].outcomeRoll = 1;
  const forecast = getSuccessionForecast(initial);
  assert.equal(forecast.actualRuler.id, 'person-1-0');
  assert.equal(forecast.lawfulRuler.id, rulerId);
  assert.equal(forecast.legalHeir.id, 'person-0-2');
  assert.equal(forecast.expectedRuler.id, 'person-1-2');
  assert.equal(forecast.contestedCrown, true);
  const next = advance(initial, '-0299-04-01');
  assert.equal(next.offices.ruler.holderId, forecast.expectedRuler.id);
  assert.equal(next.realm.lawfulRulerId, rulerId);
});

test('lawful succession agrees with the actual dated death pipeline', () => {
  const state = fatalBoundary();
  const forecast = getSuccessionForecast(state);
  const next = advance(state, '-0299-04-01');
  assert.equal(next.offices.ruler.holderId, forecast.expectedRuler.id);
  assert.equal(next.realm.lawfulRulerId, forecast.expectedRuler.id);
});

for (const lawful of [true, false]) test(`merit forecast uses death-time office and personal-support exclusions (lawful=${lawful})`, () => {
  const state = fatalBoundary();
  state.realm.successionLaw = 'merit';
  if (!lawful) state.realm.lawfulRulerId = 'person-1-0';
  for (const person of Object.values(state.people)) { person.skills.diplomacy = 0; person.skills.stewardship = 0; }
  const first = state.people['person-0-2'];
  const second = state.people['person-1-2'];
  first.skills.diplomacy = 10; second.skills.diplomacy = lawful ? 14.4 : 15.6;
  state.offices.chancellor.holderId = rulerId;
  state.offices.priest.holderId = rulerId;
  state.projects.push({ id: 'support', kind: 'sanctuary', title: 'Fördrag', ownerId: rulerId, personal: true, status: 'active', dueAt: '-0290-01-01' });
  const forecast = getSuccessionForecast(state);
  assert.equal(getCharacterPresentation(state).succession.candidates[0].id, first.id);
  assert.equal(forecast.expectedRuler.id, second.id);
  const next = advance(state, '-0299-04-01');
  assert.equal(next.offices.ruler.holderId, forecast.expectedRuler.id);
  assert.equal(next.projects.find((project) => project.id === 'support').status, 'ended');
  assert.equal(next.offices.chancellor.holderId, null);
});

test('minor successor ability is identified without promising immediate exercise or a selected regent', () => {
  const state = createCharacterSystem();
  state.people['person-0-2'].legalParentIds = [];
  state.people['person-0-4'].legalParentIds = [rulerId];
  const forecast = getSuccessionForecast(state);
  assert.equal(forecast.expectedRuler.id, 'person-0-4');
  assert.equal(forecast.requiresRegency, true);
  assert.match(forecast.authority, /barnets egen förmåga kan inte användas direkt/);
  assert.equal(Object.hasOwn(forecast, 'expectedRegentId'), false);
});

test('current regent ability and contested mandate are independent of nominal ruler and family representative', () => {
  const state = createCharacterSystem({ mode: 'family', familyId: 'family-namar' });
  state.offices.ruler.holderId = 'person-0-4';
  state.offices.ruler.regentId = rulerId;
  state.realm.lawfulRulerId = 'person-0-4';
  state.regencies['office:ruler'] = { principalId: 'person-0-4', regentId: rulerId, phase: 'contested' };
  const forecast = getSuccessionForecast(state);
  assert.equal(forecast.currentExercising.id, rulerId);
  assert.equal(forecast.currentUsesRegent, true);
  assert.equal(forecast.contestedRegency, true);
  assert.match(forecast.currentAuthority, /spärrade/);
});

test('project continuity uses the actual donor and family owner, not the nominal ruler', () => {
  const state = createCharacterSystem();
  state.offices.ruler.holderId = 'person-0-4';
  state.offices.ruler.regentId = rulerId;
  state.projects = [
    { id: 'child-effect', kind: 'reform', ownerId: 'person-0-4', personal: true, status: 'active' },
    { id: 'regent-effect', kind: 'mobilize', ownerId: rulerId, personal: true, status: 'active' },
    { id: 'academy', kind: 'academy', ownerId: rulerId, personal: false, status: 'active' },
    { id: 'water', kind: 'aqueduct', ownerId: 'person-0-4', personal: false, status: 'active' },
    { id: 'estate', kind: 'estate', ownerId: rulerId, familyId: 'family-arel', personal: false, status: 'active' },
    { id: 'old-effect', kind: 'reform', ownerId: 'person-0-4', personal: true, status: 'ended' },
  ];
  const { projects } = getSuccessionForecast(state);
  assert.deepEqual(projects.ending.map((p) => p.id), ['child-effect']);
  assert.deepEqual(projects.otherPersonal.map((p) => p.id), ['regent-effect']);
  assert.deepEqual(projects.publicConstruction.map((p) => p.id), ['academy', 'water']);
  assert.equal(projects.familyEstates[0].familyId, 'family-arel');
  assert.equal(projects.familyEstates[0].ownerId, rulerId);
});

test('family mode retains its identity when expected ruler belongs to another family; realm follows the office', () => {
  const state = createCharacterSystem({ mode: 'family' });
  for (const person of Object.values(state.people)) person.legalParentIds = [];
  state.people['person-1-2'].legalParentIds = [rulerId];
  const family = getSuccessionForecast(state);
  assert.equal(family.identity.familyId, 'family-arel');
  assert.equal(family.identity.familyKeepsThrone, false);
  state.identity.mode = 'realm';
  assert.equal(getSuccessionForecast(state).identity.familyId, 'family-namar');
});

test('dissolved, vacant and exhausted populations do not invent a successor', () => {
  const state = createCharacterSystem();
  const result = applyRealmDissolution(state, { id: 'forecast-dissolution', date: state.date });
  assert.equal(result.ok, true, result.error);
  const dissolved = getSuccessionForecast(result.state);
  assert.equal(dissolved.status, 'dissolved');
  assert.equal(dissolved.expectedRuler, null);
  assert.equal(dissolved.currentExercising, null);
  state.offices.ruler.holderId = null;
  assert.equal(getSuccessionForecast(state).status, 'vacant');
  state.offices.ruler.holderId = rulerId;
  for (const person of Object.values(state.people)) if (person.id !== rulerId) person.diedAt = state.date;
  assert.equal(getSuccessionForecast(state).status, 'no-successor');
  assert.equal(getSuccessionForecast(state).expectedRuler, null);
});

test('viewing forecast does not expose stored illness outcomes or predict simultaneous deaths', () => {
  const state = fatalBoundary();
  const heirId = state.realm.legalHeirId;
  state.people[heirId].healthConditions.push({ ...structuredClone(state.people[rulerId].healthConditions[0]), id: 'co-dated-injury', kind: 'injury', nextExposureAt: null });
  const before = JSON.stringify(state);
  const forecast = getSuccessionForecast(state);
  assert.equal(forecast.expectedRuler.id, heirId);
  assert.doesNotMatch(JSON.stringify(forecast), /outcomeRoll|scarRoll|nextTransitionAt|healthRngState/);
  assert.equal(JSON.stringify(state), before);
  const next = advance(state, '-0299-04-01');
  assert.equal(next.people[rulerId].diedAt, next.people[heirId].diedAt);
  assert.notEqual(next.offices.ruler.holderId, heirId);
});

test('actual death with no living successor ends the realm instead of recrowning a dead fallback', () => {
  const state = fatalBoundary();
  for (const person of Object.values(state.people)) if (person.id !== rulerId) person.diedAt = state.date;
  assert.equal(getSuccessionForecast(state).status, 'no-successor');
  const next = advance(state, '-0299-04-01');
  assert.equal(next.offices.ruler.holderId, null);
  assert.equal(next.realm.alive, false);
  assert.equal(next.status.ended, true);
  assert.equal(getSuccessionForecast(next).status, 'dissolved');
});

test('a child who succeeds after all adults die has a title but no exercised ability', () => {
  const state = fatalBoundary();
  const fatal = state.people[rulerId].healthConditions[0];
  for (const person of getCharacterPresentation(state).people) {
    if (person.age >= 18 && person.id !== rulerId) state.people[person.id].healthConditions = [{ ...structuredClone(fatal), id: 'fatal-' + person.id, nextExposureAt: null }];
  }
  const next = advance(state, '-0299-04-01');
  assert.equal(next.offices.ruler.holderId, 'person-0-4');
  assert.equal(next.offices.ruler.regentId, null);
  const forecast = getSuccessionForecast(next);
  assert.equal(forecast.actualRuler.age, 11);
  assert.equal(forecast.currentExercising, null);
  assert.equal(forecast.currentUsesRegent, false);
  assert.match(forecast.currentAuthority, /saknar en myndig företrädare/);
  assert.match(forecast.currentAuthority, /Ingen arketypförmåga kan utövas nu/);
  assert.deepEqual(getCharacterPresentation(next).succession.forecast, forecast);
});

test('normal command and presentation do not persist redundant forecast data', () => {
  const state = createCharacterSystem();
  const result = executeCharacterCommand(state, { id: 'forecast-command', expectedRevision: state.revision, type: 'livelihood', payload: {} });
  assert.equal(result.ok, true, result.error);
  assert.ok(getCharacterPresentation(result.state).succession.forecast);
  assert.equal(Object.hasOwn(result.state, 'succession'), false);
  assert.equal(result.state.date, state.date);
  assert.equal(addGameMonths(state.date, 0), state.date);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths, compareGameDates } from '../gameDates.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, getCharacterWorldEffects, getNextCharacterTransitionDate, normalizeCharacterSystem, PORTRAIT_AGE_GROUPS, PORTRAIT_STATES, resolvePortraitState } from './index.js';
import { ensurePortraitIdentity } from './portraitState.js';

let sequence = 0;
const personId = 'person-0-0';
function advance(state, date) { const result = advanceCharacters(state, date); assert.equal(result.ok, true, result.error); return result.state; }
function command(state, type, payload = {}) { return executeCharacterCommand(state, { id: `health-command-${++sequence}`, expectedRevision: state.revision, type, payload }); }
function outbreak(rng = 1, mode = 'realm') {
  const initial = createCharacterSystem({ seed: 321, mode });
  // A reproducible saved RNG fixture, exercised through the normal yearly
  // simulation. There is deliberately no product command to induce disease.
  initial.healthRngState = rng;
  return advance(initial, addGameMonths(initial.date, 12));
}
function domain(state) { const { revision: _revision, appliedCommandIds: _ids, ...rest } = state; return rest; }
function visualFixture(person, date, key) {
  const subject = structuredClone(person); subject.diedAt = null; delete subject.deathAppearance;
  subject.health = 100; subject.stress = 0; subject.healthConditions = [];
  const family = { exiled: key === 'exiled' };
  if (key === 'frail') subject.health = 25;
  if (key === 'stressed') subject.stress = 90;
  const kinds = { smallpox: ['smallpox', 'active'], 'smallpox-recovering': ['smallpox', 'recovering'], 'smallpox-scars': ['smallpox', 'scarred'], fever: ['fever', 'active'], wounded: ['injury', 'active'], 'injury-recovering': ['injury', 'recovering'], 'injury-scars': ['injury', 'scarred'], grieving: ['bereavement', 'active'] };
  if (kinds[key]) { const [kind, stage] = kinds[key]; subject.healthConditions.push({ id: 'visual-condition', kind, stage, startedAt: date, stageHistory: [{ date, stage }] }); }
  return { subject, family };
}

test('all 24 seed identities resolve all 36 atlas cells without switching people', () => {
  const state = createCharacterSystem();
  assert.equal(PORTRAIT_STATES.length, 12);
  for (const person of Object.values(state.people)) for (const [index, ageGroup] of PORTRAIT_AGE_GROUPS.entries()) {
    const date = addGameMonths(person.bornAt, [10, 26, 75][index] * 12);
    for (const key of PORTRAIT_STATES) {
      const { subject, family } = visualFixture(person, date, key);
      const before = JSON.stringify(subject);
      const view = resolvePortraitState(subject, date, { family });
      assert.equal(view.identityId, person.id); assert.equal(view.fallbackIdentityId, person.id);
      assert.equal(view.ageGroup, ageGroup); assert.equal(view.visualState, key);
      assert.equal(view.variantKey, `${person.id}__${ageGroup}__${key}`);
      assert.equal(view.usesSharedFallback, false);
      assert.equal(JSON.stringify(subject), before, 'resolver must be pure');
      assert.ok(view.variantCandidates.every((candidate) => candidate.startsWith(`${person.id}__${ageGroup}__`)));
    }
  }
});

test('portrait priority keeps concurrent causes and never hides scars behind mood', () => {
  const state = createCharacterSystem();
  const { subject } = visualFixture(state.people[personId], state.date, 'smallpox-scars');
  subject.stress = 100; subject.health = 30;
  subject.healthConditions.push({ id: 'grief', kind: 'bereavement', stage: 'active', startedAt: state.date, stageHistory: [{ date: state.date, stage: 'active' }] });
  const view = resolvePortraitState(subject, state.date, { family: { exiled: true } });
  assert.equal(view.visualState, 'smallpox-scars');
  for (const key of ['smallpox-scars', 'frail', 'stressed', 'grieving', 'exiled']) assert.ok(view.stateKeys.includes(key));
  assert.equal(view.expression, 'grieving'); assert.equal(view.context, 'exiled');
});

test('first yearly smallpox outbreak leaves a real care decision and illness portrait before recovery', () => {
  const state = outbreak();
  const patient = state.people[personId];
  const condition = patient.healthConditions.find((item) => item.kind === 'smallpox');
  assert.equal(condition.stage, 'active');
  assert.equal(condition.startedAt, state.date);
  assert.ok(compareGameDates(condition.nextTransitionAt, state.date) > 0);
  assert.equal(resolvePortraitState(patient, state.date).visualState, 'smallpox');
  const view = getCharacterPresentation(state);
  const story = view.stories.find((item) => item.type === 'health_care' && item.actorId === patient.id);
  assert.equal(story.status, 'open');
  assert.ok(story.choices.some((choice) => choice.id === 'physician' && !choice.disabledReason));
  const beforeSilver = state.families[patient.familyId].treasury;
  const treated = command(state, 'resolve_story', { storyId: story.id, choiceId: 'physician' });
  assert.equal(treated.ok, true, treated.error);
  assert.equal(treated.state.families[patient.familyId].treasury, beforeSilver - 20);
  assert.equal(treated.state.people[patient.id].healthConditions[0].treatment.kind, 'physician');
  assert.equal(treated.state.people[patient.id].healthConditions[0].stage, 'active', 'care does not instantly erase the disease');
  assert.ok(compareGameDates(treated.state.people[patient.id].healthConditions[0].nextTransitionAt, condition.nextTransitionAt) < 0);
});

test('smallpox progresses on exact dates to recovery and persistent scars with memories', () => {
  let state = outbreak();
  const id = state.people[personId].healthConditions[0].id;
  assert.equal(getNextCharacterTransitionDate(state, '-0298-01-01'), '-0299-02-01', 'household exposure is an actual subannual boundary');
  state = advance(state, '-0299-04-01');
  assert.equal(state.people[personId].healthConditions.find((item) => item.id === id).stage, 'recovering');
  assert.equal(resolvePortraitState(state.people[personId], state.date).visualState, 'smallpox-recovering');
  state = advance(state, '-0299-10-01');
  const condition = state.people[personId].healthConditions.find((item) => item.id === id);
  assert.equal(condition.stage, 'scarred'); assert.equal(condition.nextTransitionAt, null);
  assert.equal(resolvePortraitState(state.people[personId], state.date).visualState, 'smallpox-scars');
  assert.ok(state.log.some((event) => event.type === 'health_scars' && event.conditionId === id));
  assert.ok(state.memories.some((memory) => memory.type === 'health_recovering' && memory.participants.includes(personId)));
  const restored = normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(resolvePortraitState(restored.people[personId], restored.date).variantKey, resolvePortraitState(state.people[personId], state.date).variantKey);
});

test('care changes the same saved illness outcome without rerolling the result', () => {
  const initial = outbreak(); const patient = initial.people[personId];
  const result = command(initial, 'provide_care', { personId, conditionId: patient.healthConditions[0].id, care: 'physician' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.healthRngState, initial.healthRngState);
  const untreated = advance(initial, '-0299-10-01');
  const treated = advance(result.state, '-0299-10-01');
  assert.equal(untreated.people[personId].healthConditions[0].stage, 'scarred');
  assert.equal(treated.people[personId].healthConditions[0].stage, 'resolved');
  assert.equal(treated.people[personId].healthConditions[0].scarRoll, initial.people[personId].healthConditions[0].scarRoll);
});

test('annual injury has a real recovery cycle and can be treated with valid costs and rights', () => {
  let state = outbreak(570);
  const condition = state.people[personId].healthConditions[0];
  assert.equal(condition.kind, 'injury');
  assert.equal(resolvePortraitState(state.people[personId], state.date).visualState, 'wounded');
  const result = command(state, 'provide_care', { personId, conditionId: condition.id, care: 'rest' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.families['family-arel'].treasury, state.families['family-arel'].treasury - 5);
  state = advance(result.state, result.state.people[personId].healthConditions[0].nextTransitionAt);
  assert.equal(state.people[personId].healthConditions[0].stage, 'recovering');
  assert.equal(resolvePortraitState(state.people[personId], state.date).visualState, 'injury-recovering');
  state = advance(state, state.people[personId].healthConditions[0].nextTransitionAt);
  assert.ok(['scarred', 'resolved'].includes(state.people[personId].healthConditions[0].stage));
});

test('a sick minor cannot spend inherited personal assets through autonomous adult care', () => {
  const initial = createCharacterSystem({ seed: 321 });
  initial.healthRngState = 22;
  initial.people['person-0-4'].wealth = 100;
  const state = advance(initial, '-0299-01-01');
  const child = state.people['person-0-4'];
  const condition = child.healthConditions.find((entry) => entry.kind === 'fever');
  assert.equal(condition.severity, 2);
  assert.equal(condition.treatment, null);
  assert.equal(child.wealth, 100);
  const treated = command(state, 'provide_care', { personId: child.id, conditionId: condition.id, care: 'physician' });
  assert.equal(treated.ok, true, treated.error);
  assert.equal(treated.state.people[child.id].wealth, 100);
  assert.equal(treated.state.families[child.familyId].treasury, state.families[child.familyId].treasury - 20);
});

test('care refuses nonexistent conditions, another household and duplicate treatment atomically', () => {
  let state = outbreak();
  const before = JSON.stringify(state);
  const absent = command(state, 'provide_care', { personId, conditionId: 'invented', care: 'physician' });
  assert.equal(absent.ok, false); assert.equal(JSON.stringify(state), before);
  const outside = command(state, 'provide_care', { personId: 'person-1-0', conditionId: state.people[personId].healthConditions[0].id, care: 'physician' });
  assert.equal(outside.ok, false); assert.equal(JSON.stringify(state), before);
  const paid = command(state, 'provide_care', { personId, conditionId: state.people[personId].healthConditions[0].id, care: 'rest' });
  assert.equal(paid.ok, true, paid.error); state = paid.state;
  const repeat = command(state, 'provide_care', { personId, conditionId: state.people[personId].healthConditions[0].id, care: 'physician' });
  assert.equal(repeat.ok, false); assert.equal(repeat.state, state);
  assert.equal(command(state, 'set_health_condition', { personId, kind: 'smallpox' }).ok, false);
});

test('hidden outcome rolls and exposure deadlines stay out of public presentation', () => {
  const state = outbreak();
  const view = getCharacterPresentation(state);
  assert.ok(state.people[personId].healthConditions[0].scarRoll >= 0);
  const publicText = JSON.stringify(view);
  for (const key of ['scarRoll', 'outcomeRoll', 'healthRngState', 'nextExposureAt']) assert.equal(publicText.includes(key), false, key);
  assert.equal(view.people.find((person) => person.id === personId).portraitState.visualState, 'smallpox');
});

test('monthwise replay, a long hop and save-resume produce identical disease and portrait states', () => {
  const start = outbreak();
  const whole = advance(start, '-0298-01-01');
  let split = start;
  for (let month = 1; month <= 12; month++) split = advance(split, addGameMonths(start.date, month));
  assert.deepEqual(domain(split), domain(whole));
  const middle = normalizeCharacterSystem(JSON.parse(JSON.stringify(advance(start, '-0299-05-01'))));
  const resumed = advance(middle, '-0298-01-01');
  assert.deepEqual(domain(resumed), domain(whole));
  assert.deepEqual(getCharacterPresentation(resumed).people.map((person) => person.portraitState), getCharacterPresentation(whole).people.map((person) => person.portraitState));
});

test('health clocks and random draws do not change on a read or same-date retry', () => {
  const state = outbreak(); const before = JSON.stringify(state);
  for (let index = 0; index < 4; index++) { getCharacterPresentation(state); getNextCharacterTransitionDate(state, '-0298-01-01'); }
  assert.equal(JSON.stringify(state), before);
  const same = advanceCharacters(state, state.date);
  assert.equal(same.state, state); assert.equal(JSON.stringify(same.state), before);
});

test('household exposure has a dated causal source and prior smallpox prevents reinfection', () => {
  let state = outbreak();
  state.healthRngState = 1;
  state = advance(state, '-0299-02-01');
  const secondary = Object.values(state.people).flatMap((person) => person.healthConditions.map((condition) => ({ person, condition }))).filter(({ condition }) => condition.sourceKind === 'household-exposure');
  assert.ok(secondary.length > 0);
  assert.ok(secondary.length <= 2, 'one infectious source exposes at most two household members at its boundary');
  for (const { person, condition } of secondary) {
    assert.equal(condition.startedAt, '-0299-02-01');
    assert.equal(condition.relatedPersonId, personId);
    assert.equal(condition.causeId, state.people[personId].healthConditions[0].causeId);
    assert.equal(person.familyId, state.people[personId].familyId);
    assert.equal(resolvePortraitState(person, state.date).visualState, 'smallpox');
  }
  state = advance(state, '-0293-01-01');
  for (const person of Object.values(state.people)) assert.ok(person.healthConditions.filter((condition) => condition.kind === 'smallpox').length <= 1);
});

test('same-date illness deaths never crown a co-deceased heir or lose separate death causes', () => {
  let state = outbreak();
  const heirId = state.realm.legalHeirId;
  assert.ok(heirId && heirId !== personId);
  state.people[personId].healthConditions[0].outcomeRoll = 0;
  state.people[heirId].healthConditions.push({ ...structuredClone(state.people[personId].healthConditions[0]), id: 'co-dated-injury', kind: 'injury', nextExposureAt: null });
  state = advance(state, '-0299-04-01');
  assert.equal(state.people[personId].diedAt, state.people[heirId].diedAt);
  assert.equal(state.people[personId].deathReason, 'Smittkoppor');
  assert.equal(state.people[heirId].deathReason, 'Skada');
  assert.ok(state.offices.ruler.history.filter((entry) => entry.date === state.date).every((entry) => entry.personId !== heirId));
  assert.notEqual(state.offices.ruler.holderId, heirId);
  assert.deepEqual(normalizeCharacterSystem(JSON.parse(JSON.stringify(state))), state);
});

test('a July campaign and first care boundary roundtrip exact JSON numbers without negative zero', () => {
  const initial = createCharacterSystem({ seed: 321, date: '-0300-07-01' });
  initial.healthRngState = 1;
  const state = advance(initial, '-0299-07-01');
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test('fatal disease uses ordinary death and inheritance, freezing the actual last appearance', () => {
  let state = outbreak(1, 'family');
  state.people[personId].healthConditions[0].outcomeRoll = 0; // Stored-risk fixture, no production command.
  state = advance(state, '-0299-04-01');
  assert.equal(state.people[personId].diedAt, '-0299-04-01');
  assert.equal(state.people[personId].deathReason, 'Smittkoppor');
  assert.notEqual(state.offices.ruler.holderId, personId);
  assert.equal(state.status.ended, false);
  const remembered = resolvePortraitState(state.people[personId], state.date, { family: state.families['family-arel'] });
  assert.equal(remembered.lifeStatus, 'deceased'); assert.equal(remembered.visualState, 'smallpox');
  state.families['family-arel'].exiled = true;
  assert.deepEqual(resolvePortraitState(state.people[personId], addGameMonths(state.date, 600), { family: state.families['family-arel'] }), remembered);
});

test('bereavement comes from real kin death, lasts two years and leaves its memory', () => {
  let state = createCharacterSystem({ seed: 321 });
  state.people['person-0-2'].health = 0;
  state = advance(state, addGameMonths(state.date, 12));
  const child = state.people['person-0-4'];
  const grief = child.healthConditions.find((condition) => condition.kind === 'bereavement' && condition.relatedPersonId === 'person-0-2');
  assert.ok(grief); assert.equal(grief.stage, 'active');
  assert.ok(resolvePortraitState(child, state.date).stateKeys.includes('grieving'));
  state = advance(state, grief.nextTransitionAt);
  assert.equal(state.people[child.id].healthConditions.find((condition) => condition.id === grief.id).stage, 'resolved');
  assert.ok(state.memories.some((memory) => memory.type === 'bereavement' && memory.participants.includes(child.id)));
});

test('illness changes real governor production and military readiness', () => {
  const state = outbreak();
  const before = getCharacterWorldEffects(state);
  const generalId = state.offices.general.holderId;
  const governor = state.people[state.offices['governor-0'].holderId];
  const illness = structuredClone(state.people[personId].healthConditions[0]);
  state.people[generalId].healthConditions.push({ ...illness, id: 'fixture-general' });
  governor.healthConditions.push({ ...illness, id: 'fixture-governor' });
  const after = getCharacterWorldEffects(state);
  assert.ok(after.militaryReadiness < before.militaryReadiness);
  assert.ok(after.cityEffects[0].productionMultiplier < before.cityEffects[0].productionMultiplier);
});

test('new children lock a shared child-seed illustration across adoption and aging', () => {
  let state = createCharacterSystem({ seed: 321 });
  state = advance(state, addGameMonths(state.date, 12 * 15));
  const child = Object.values(state.people).find((person) => !/^person-\d-\d$/.test(person.id) && !person.diedAt);
  assert.ok(child, 'normal simulation produced a child');
  const locked = child.portraitFallbackIdentityId;
  assert.match(locked, /^person-[0-3]-[45]$/);
  assert.equal(child.portraitIdentityId, child.id);
  child.familyId = 'family-safra'; ensurePortraitIdentity(child, state.people);
  assert.equal(child.portraitFallbackIdentityId, locked);
  for (const age of [10, 26, 75]) {
    const view = resolvePortraitState(child, addGameMonths(child.bornAt, age * 12));
    assert.equal(view.identityId, child.id); assert.equal(view.fallbackIdentityId, locked);
    assert.equal(view.usesSharedFallback, true);
    assert.ok(view.variantCandidates.some((key) => key.startsWith(`${locked}__${view.ageGroup}__`)));
  }
});

test('legacy health defaults are neutral, deterministic and leave source state unchanged', () => {
  const old = createCharacterSystem();
  for (const key of ['healthVersion', 'healthActivatedAt', 'healthRngState', 'healthSequence']) delete old[key];
  for (const person of Object.values(old.people)) { delete person.healthConditions; delete person.portraitIdentityId; delete person.portraitFallbackIdentityId; }
  const before = JSON.stringify(old);
  const a = normalizeCharacterSystem(old), b = normalizeCharacterSystem(old);
  assert.deepEqual(a, b); assert.equal(a.date, old.date); assert.equal(a.rngState, old.rngState);
  assert.ok(Object.values(a.people).every((person) => person.healthConditions.length === 0));
  assert.equal(JSON.stringify(old), before);
});

test('malformed health references reject and stale fallback IDs normalize to a known identity', () => {
  const state = outbreak();
  const invalid = structuredClone(state); invalid.people[personId].healthConditions[0].outcomeRoll = 2;
  assert.throws(() => normalizeCharacterSystem(invalid), /sparade utfall/);
  const badPortrait = structuredClone(state); badPortrait.people[personId].portraitIdentityId = '../../different-person';
  assert.throws(() => normalizeCharacterSystem(badPortrait), /porträttidentitet/);
  const fallback = structuredClone(state); fallback.people[personId].portraitFallbackIdentityId = '../../missing';
  assert.equal(normalizeCharacterSystem(fallback).people[personId].portraitFallbackIdentityId, personId);
});

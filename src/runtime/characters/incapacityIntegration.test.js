import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { advanceCharacters, canCharacterDirectRealm, createCharacterSystem, evaluateCharacterDecision, executeCharacterCommand, getCharacterAge, getCharacterPresentation, getCharacterWorldEffects, normalizeCharacterSystem } from './index.js';
import { getDirectedStoryCandidates } from './storyDirector.js';

let sequence = 0;
function illness(state, personId, kind = 'fever') {
  const condition = { id: `incapacity-fixture-${++sequence}`, kind, severity: 3, stage: 'active', startedAt: state.date,
    nextTransitionAt: addGameMonths(state.date, kind === 'smallpox' ? 3 : kind === 'injury' ? 4 : 1), nextExposureAt: null,
    stageHistory: [{ stage: 'active', date: state.date }], treatment: null, causeId: null, sourceKind: 'calendar', relatedPersonId: null,
    scarRoll: 0.99, outcomeRoll: 0.99, endedAt: null };
  state.people[personId].healthConditions.push(condition);
  return condition;
}
function attempt(state, type, payload = {}) { return executeCharacterCommand(state, { id: `incapacity-command-${++sequence}`, expectedRevision: state.revision, type, payload }); }
function command(state, type, payload = {}) { const result = attempt(state, type, payload); assert.equal(result.ok, true, result.error); return result.state; }
function advance(state, months) { const result = advanceCharacters(state, addGameMonths(state.date, months)); assert.equal(result.ok, true, result.error); return result.state; }
function domain({ revision: _revision, appliedCommandIds: _ids, ...state }) { return state; }

test('legacy activation establishes separate mandates without inventing history or transferring assets', () => {
  const raw = createCharacterSystem({ seed: 321 });
  illness(raw, 'person-0-0');
  delete raw.mandateVersion; delete raw.mandateActivatedAt; delete raw.mandateSequence;
  const before = structuredClone(raw), state = normalizeCharacterSystem(raw);
  assert.deepEqual(raw, before); assert.deepEqual(state.log, raw.log); assert.deepEqual(state.memories, raw.memories);
  assert.equal(state.rngState, raw.rngState); assert.equal(state.healthRngState, raw.healthRngState);
  assert.equal(state.offices.ruler.holderId, 'person-0-0'); assert.equal(state.realm.lawfulRulerId, 'person-0-0');
  assert.equal(state.families['family-arel'].headId, 'person-0-0');
  assert.equal(state.realm.treasury, raw.realm.treasury); assert.equal(state.families['family-arel'].treasury, raw.families['family-arel'].treasury);
  const view = getCharacterPresentation(state);
  assert.equal(view.authority.royal.reason, 'incapacity'); assert.equal(view.authority.household.reason, 'incapacity');
  assert.notEqual(view.authority.royal.representativeId, 'person-0-0');
  assert.deepEqual(normalizeCharacterSystem(state), state);
});

test('subannual recovery restores the principal and the unexpired personal bonus', () => {
  let state = createCharacterSystem({ seed: 321 }); state.people['person-0-0'].archetype = 'commander';
  state = command(state, 'mobilize');
  const project = structuredClone(state.projects.find((p) => p.kind === 'mobilize'));
  const healthyReadiness = getCharacterWorldEffects(state).militaryReadiness;
  illness(state, 'person-0-0'); state = normalizeCharacterSystem(state);
  assert.equal(state.projects.find((p) => p.id === project.id).status, 'active');
  assert.equal(getCharacterPresentation(state).projects.find((p) => p.id === project.id).effectActive, false);
  assert.ok(Math.abs(getCharacterWorldEffects(state).militaryReadiness - (healthyReadiness - 20)) < 1e-9);
  const recovered = advance(state, 3);
  assert.equal(recovered.date, '-0300-04-01'); assert.equal(recovered.offices.ruler.regentId, null);
  assert.equal(recovered.offices.ruler.holderId, 'person-0-0'); assert.equal(canCharacterDirectRealm(recovered), true);
  assert.equal(recovered.projects.find((p) => p.id === project.id).dueAt, project.dueAt);
  assert.equal(getCharacterPresentation(recovered).projects.find((p) => p.id === project.id).effectActive, true);
  assert.equal(getCharacterWorldEffects(recovered).militaryReadiness, healthyReadiness);
  assert.deepEqual(normalizeCharacterSystem(recovered), recovered);
});

test('a world without a capable representative remains playable through the calendar', () => {
  let state = createCharacterSystem({ seed: 321 });
  for (const person of Object.values(state.people)) illness(state, person.id);
  state = normalizeCharacterSystem(state);
  const view = getCharacterPresentation(state);
  assert.equal(view.representative, null); assert.deepEqual(view.actions, []);
  assert.equal(view.authority.royal.representativeId, null); assert.match(view.authority.royal.blockedReason, /Kalendern/);
  assert.equal(state.status.ended, false);
  const before = structuredClone(state), denied = attempt(state, 'tax_policy', { policy: 'harsh' });
  assert.equal(denied.ok, false); assert.deepEqual(state, before); assert.strictEqual(denied.state, state);
  const recovered = advance(state, 3);
  assert.equal(recovered.status.ended, false); assert.equal(canCharacterDirectRealm(recovered), true);
  assert.equal(getCharacterPresentation(recovered).authority.royal.representativeId, 'person-0-0');
});

test('public and household orders use their own actor and leave the other actor unchanged', () => {
  let state = createCharacterSystem({ seed: 321 });
  state.families['family-arel'].headId = 'person-0-2';
  illness(state, 'person-0-0'); state = normalizeCharacterSystem(state);
  const view = getCharacterPresentation(state), royalId = view.authority.royal.representativeId, privateId = view.authority.household.representativeId;
  assert.notEqual(royalId, privateId); assert.equal(privateId, 'person-0-2');
  state.people[privateId].stress = 50; state.people[royalId].stress = 40;
  const silver = state.families['family-arel'].treasury, treasury = state.realm.treasury;
  const rested = command(state, 'rest');
  assert.equal(rested.people[royalId].stress, 40); assert.ok(rested.people[privateId].stress < 50);
  assert.equal(rested.families['family-arel'].treasury, silver - 10); assert.equal(rested.realm.treasury, treasury);
  const restAction = getCharacterPresentation(state).actions.find((action) => action.type === 'rest');
  assert.equal(restAction.actorId, privateId); assert.equal(restAction.payer.id, 'family-arel');
});

test('a replacement regent cannot use the predecessor consent on the first order after illness', () => {
  let state = createCharacterSystem({ seed: 321 });
  illness(state, 'person-0-0', 'smallpox'); state = normalizeCharacterSystem(state);
  const first = state.offices.ruler.regentId;
  state.people[first].traits = ['ambitious']; state.families['family-arel'].influence = 90;
  state = command(state, 'request_regent_consent', { regencyId: 'office:ruler', actionType: 'appoint', approach: 'appeal' });
  const consent = structuredClone(state.regencies['office:ruler'].grants[0]); assert.ok(consent);
  illness(state, first);
  for (const person of Object.values(state.people)) if (person.id !== 'person-0-0') person.traits = ['ambitious'];
  const before = structuredClone(state), denied = attempt(state, 'appoint', { officeId: 'chancellor', personId: 'person-2-2' });
  assert.equal(denied.ok, false); assert.deepEqual(state, before);
  const normalized = normalizeCharacterSystem(state);
  assert.notEqual(normalized.offices.ruler.regentId, first);
  assert.notEqual(normalized.regencies['office:ruler'].termId, consent.termId);
  assert.deepEqual(normalized.regencies['office:ruler'].grants, []);
});

test('incapacity transitions give identical domain state under whole, split and JSON-resumed time', () => {
  let state = createCharacterSystem({ seed: 321 }); illness(state, 'person-0-0', 'smallpox'); state = normalizeCharacterSystem(state);
  const whole = advance(state, 9);
  let split = state;
  for (let month = 0; month < 9; month++) split = normalizeCharacterSystem(JSON.parse(JSON.stringify(advance(split, 1))));
  assert.deepEqual(domain(split), domain(whole));
});

test('a household story records the household decision maker rather than the royal regent', () => {
  let state = createCharacterSystem({ seed: 321 }); state.families['family-arel'].headId = 'person-0-2';
  illness(state, 'person-0-0'); state = normalizeCharacterSystem(state);
  const view = getCharacterPresentation(state), privateId = view.authority.household.representativeId, royalId = view.authority.royal.representativeId;
  state.people[royalId].stress = 65;
  const context = { actor: state.people[privateId], family: state.families['family-arel'], canRule: false, age: (p) => getCharacterAge(p, state.date), stress: () => 0 };
  const candidate = getDirectedStoryCandidates(state, context).find((s) => s.eventType === 'household_tension'); assert.ok(candidate);
  const { weight: _weight, ...details } = candidate;
  const story = { ...details, id: `character-story-${++state.storyDirector.sequence}`, type: 'character_event', status: 'open', createdAt: state.date, dueAt: addGameMonths(state.date, 12), knownBy: 'public' };
  state.stories.push(story);
  const before = state.families['family-arel'].treasury;
  const next = command(state, 'resolve_story', { storyId: story.id, choiceId: 'relieve' });
  const memory = next.memories.find((m) => m.storyId === story.id);
  assert.equal(memory.participants[1], privateId); assert.notEqual(privateId, royalId);
  assert.equal(next.families['family-arel'].treasury, before - 12);
  assert.deepEqual(normalizeCharacterSystem(next), next);
});

test('health story treatment is attributed to the person who can spend household resources', () => {
  let state = createCharacterSystem({ seed: 321 }); state.families['family-arel'].headId = 'person-0-2';
  const condition = illness(state, 'person-0-0'); state = normalizeCharacterSystem(state);
  const privateId = getCharacterPresentation(state).authority.household.representativeId;
  state.stories.push({ id: 'care-by-household', type: 'health_care', actorId: 'person-0-0', familyId: 'family-arel', conditionId: condition.id,
    title: 'Vård', description: 'Hushållet ordnar vård.', createdAt: state.date, dueAt: condition.nextTransitionAt, status: 'open', knownBy: 'public' });
  const next = command(state, 'resolve_story', { storyId: 'care-by-household', choiceId: 'physician' });
  assert.equal(next.people['person-0-0'].healthConditions[0].treatment.byId, privateId);
});

test('the exact birthday during illness preserves the episode and recovery considers handover once', () => {
  let state = createCharacterSystem({ seed: 321 });
  const child = state.people['person-0-4']; child.bornAt = '-0318-04-01';
  state.offices.ruler.holderId = child.id; state.families['family-arel'].headId = child.id; state.realm.lawfulRulerId = child.id;
  illness(state, child.id, 'smallpox'); state = normalizeCharacterSystem(state);
  const record = state.regencies['office:ruler'], episode = record.episodeId, term = record.termId;
  const regent = state.people[record.regentId]; regent.traits = ['ambitious']; regent.loyalty = 20; state.families[regent.familyId].influence = 80;
  const birthday = advance(state, 3);
  assert.equal(birthday.regencies['office:ruler'].episodeId, episode); assert.equal(birthday.regencies['office:ruler'].termId, term);
  assert.equal(birthday.regencies['office:ruler'].phase, 'minority');
  const recovered = advance(birthday, 6);
  assert.equal(recovered.regencies['office:ruler'].phase, 'contested');
  assert.equal(recovered.log.filter((event) => event.type === 'regency_dispute' && event.participants[0] === child.id).length, 2); // Separate family and royal mandates.
  assert.deepEqual(normalizeCharacterSystem(recovered), recovered);
  assert.deepEqual(domain(advance(state, 9)), domain(recovered));
});

test('normalization rejects forged mandate dates and references before changing the caller save', () => {
  let state = createCharacterSystem({ seed: 321 }); illness(state, 'person-0-0'); state = normalizeCharacterSystem(state);
  for (const mutate of [
    (s) => { s.mandateVersion = 2; },
    (s) => { s.regencies['office:ruler'].startedAt = '-0299-01-01'; },
    (s) => { s.regencies['office:ruler'].causeConditionIds = ['missing-condition']; },
  ]) {
    const invalid = structuredClone(state); mutate(invalid); const before = structuredClone(invalid);
    assert.throws(() => normalizeCharacterSystem(invalid)); assert.deepEqual(invalid, before);
  }
});

test('a sanctuary without an executive mandate contributes neither support nor revenue', () => {
  let state = createCharacterSystem({ seed: 321 });
  state.projects.push({ id: 'sanctuary-fixture', kind: 'sanctuary', ownerId: 'person-0-0', personal: true, status: 'active', createdAt: state.date, dueAt: addGameMonths(state.date, 36) });
  for (const person of Object.values(state.people)) illness(state, person.id);
  state = normalizeCharacterSystem(state);
  const without = structuredClone(state); without.projects = [];
  assert.equal(getCharacterPresentation(state).authority.royal.representativeId, null);
  assert.equal(getCharacterPresentation(state).projects[0].effectActive, false);
  assert.deepEqual(getCharacterPresentation(state).religions, getCharacterPresentation(without).religions);
  assert.deepEqual(getCharacterWorldEffects(state), getCharacterWorldEffects(without));
});

test('a severely ill NPC cannot run a personal political agenda across the annual boundary', () => {
  let state = createCharacterSystem({ seed: 321 }); state.date = '-0300-12-01'; state.nextAnnualDate = '-0299-01-01';
  const person = state.people['person-1-0']; person.traits = ['ambitious', 'vengeful']; person.loyalty = 20;
  state.families[person.familyId].influence = 100; state.families[person.familyId].grievance = -40;
  illness(state, person.id); state = normalizeCharacterSystem(state);
  assert.equal(evaluateCharacterDecision(state, person.id).choice, 'wait');
  const next = advance(state, 1);
  assert.equal(next.people[person.id].lastDecision.choice, 'wait');
  assert.equal(next.memories.some((m) => m.type === 'plot' && m.participants[0] === person.id), false);
});

test('a contested claim needs a claimant and an unsupported mandate version fails an advance atomically', () => {
  let state = createCharacterSystem({ seed: 321 }); illness(state, 'person-0-0'); state = normalizeCharacterSystem(state);
  const invalid = structuredClone(state); invalid.regencies['office:ruler'].phase = 'contested'; invalid.regencies['office:ruler'].regentId = null; invalid.offices.ruler.regentId = null;
  assert.throws(() => normalizeCharacterSystem(invalid), /anspråkshavare/);
  state.mandateVersion = 2; const before = structuredClone(state);
  const result = advanceCharacters(state, addGameMonths(state.date, 1));
  assert.equal(result.ok, false); assert.equal(result.state, state); assert.deepEqual(state, before); assert.deepEqual(result.events, []);
});

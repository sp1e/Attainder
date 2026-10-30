import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { advanceCharacters, canCharacterDirectRealm, createCharacterSystem, evaluateCharacterDecision, executeCharacterCommand, getAvailableCharacterActions, getCharacterAge, getCharacterPresentation, getCharacterWorldEffects, getPersonalOpinion, normalizeCharacterSystem } from './index.js';

let operation = 0;
function command(state, type, payload = {}) {
  const result = executeCharacterCommand(state, { id: `test-${++operation}`, expectedRevision: state.revision, type, payload });
  assert.equal(result.ok, true, result.error);
  return result.state;
}
function advance(state, years = 1) {
  const result = advanceCharacters(state, addGameMonths(state.date, years * 12));
  assert.equal(result.ok, true, result.error);
  return result.state;
}
function worldContent(state) { const { revision: _revision, appliedCommandIds: _commands, ...content } = state; return content; }
function forceDeathOnNextYear(state, ids) { const copy = structuredClone(state); for (const id of ids) copy.people[id].health = 0; return advance(copy); }

test('new games preserve both identities, canonical polity and host city IDs', () => {
  for (const mode of ['realm', 'family']) {
    const state = createCharacterSystem({ mode, polityId: 'Hadara', cities: [{ id: 'c1', name: 'Hamnstaden', regionId: 'r1' }] });
    assert.equal(state.identity.mode, mode);
    assert.equal(getCharacterWorldEffects(state).polityId, 'Hadara');
    assert.equal(getCharacterWorldEffects(state).cityEffects[0].regionId, 'r1');
    assert.equal(Object.keys(state.people).length, 24);
    assert.deepEqual(normalizeCharacterSystem(JSON.parse(JSON.stringify(state))), state);
  }
});

test('unknown save versions reject without changing source state', () => {
  const state = createCharacterSystem(); state.schemaVersion = 99;
  const original = JSON.stringify(state);
  assert.throws(() => normalizeCharacterSystem(state), /nyare version/);
  assert.equal(JSON.stringify(state), original);
  const rules = createCharacterSystem(); rules.rulesVersion = 'future';
  assert.throws(() => normalizeCharacterSystem(rules), /regel-/);
});

test('same date does not age people, generate deaths or consume randomness', () => {
  const state = createCharacterSystem();
  assert.equal(advanceCharacters(state, state.date).state, state);
  assert.equal(advanceCharacters(state, '-0301-01-01').ok, false);
  assert.deepEqual(normalizeCharacterSystem(state), state);
});

test('BCE calendar crosses into AD without year zero', () => {
  let state = createCharacterSystem({ date: '-0001-01-01' });
  assert.equal(getCharacterAge(state.people['person-0-4'], state.date), 10);
  state = advanceCharacters(state, '0001-01-01').state;
  assert.equal(getCharacterAge(state.people['person-0-4'], state.date), 11);
  assert.equal(state.nextAnnualDate, '0002-01-01');
});

test('long time jump and split jumps produce equal domain outcomes', () => {
  const initial = createCharacterSystem({ seed: 77 });
  const once = advance(initial, 12);
  let split = initial;
  for (let i = 0; i < 12; i++) split = advance(split);
  assert.deepEqual(worldContent(once), worldContent(split));
});

test('fractional calendar calls do not change annual RNG or economic results', () => {
  const initial = createCharacterSystem({ date: '-0300-03-14', seed: 990 });
  const direct = advanceCharacters(initial, '-0298-03-14').state;
  let split = initial;
  for (let i = 0; i < 8; i++) split = advanceCharacters(split, addGameMonths(split.date, 3)).state;
  assert.deepEqual(worldContent(direct), worldContent(split));
});

test('commands validate revision and are idempotent on retry', () => {
  const state = createCharacterSystem();
  const request = { id: 'unique-gift', expectedRevision: 0, type: 'gift', payload: { targetId: 'person-1-0' } };
  const result = executeCharacterCommand(state, request);
  assert.equal(result.ok, true);
  assert.equal(executeCharacterCommand(result.state, request).state, result.state);
  assert.deepEqual(executeCharacterCommand(result.state, request).events, []);
  const stale = executeCharacterCommand(result.state, { ...request, id: 'second-gift' });
  assert.equal(stale.ok, false);
  assert.equal(stale.state, result.state);
});

test('costs are atomic and an invalid candidate consumes nothing', () => {
  const state = createCharacterSystem();
  const result = executeCharacterCommand(state, { id: 'bad', expectedRevision: 0, type: 'appoint', payload: { officeId: 'general', personId: 'person-0-4' } });
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.equal(state.realm.treasury, 240);
  assert.equal(state.actionPoints, 4);
});

test('temporary abilities expire at leader change while completed infrastructure remains', () => {
  let state = command(createCharacterSystem(), 'mobilize');
  const mobilized = getCharacterWorldEffects(state).militaryReadiness;
  state = command(state, 'abdicate');
  assert.equal(state.offices.ruler.holderId, 'person-0-2');
  assert.ok(getCharacterWorldEffects(state).militaryReadiness < mobilized);
  assert.equal(state.projects.find((p) => p.kind === 'mobilize').status, 'ended');
  assert.equal(getAvailableCharacterActions(state).some((a) => a.type === 'mobilize'), false);
  state.people['person-0-2'].archetype = 'builder';
  state = command(state, 'aqueduct');
  state = advance(state, 2);
  assert.ok(Object.values(state.cities).every((city) => city.infrastructure === 1));
  const completed = state.realm.infrastructure;
  state = command(state, 'abdicate');
  assert.equal(state.realm.infrastructure, completed);
});

test('regent uses an actual adult mandate and transfers it at majority', () => {
  let state = createCharacterSystem();
  state.offices.ruler.holderId = 'person-0-4';
  for (const person of Object.values(state.people)) person.traits = person.traits.filter((trait) => trait !== 'ambitious');
  state = advance(state);
  assert.ok(state.offices.ruler.regentId);
  assert.equal(getCharacterPresentation(state).representative.id, state.offices.ruler.regentId);
  const result = executeCharacterCommand(state, { id: 'regent-abdication', expectedRevision: state.revision, type: 'abdicate' });
  assert.equal(result.ok, false);
  state = advance(state, 7);
  if (!state.people['person-0-4'].diedAt) {
    assert.equal(state.offices.ruler.regentId, null);
    assert.equal(getCharacterPresentation(state).representative.id, 'person-0-4');
  }
});

test('family mode survives losing the throne and cannot spend state funds', () => {
  let state = createCharacterSystem({ mode: 'family' });
  const familyTreasury = state.families['family-arel'].treasury;
  state = command(state, 'abdicate');
  assert.equal(state.identity.familyId, 'family-arel');
  assert.equal(getCharacterPresentation(state).representative.id, 'person-0-0');
  assert.equal(state.families['family-arel'].treasury, familyTreasury);
  const denied = executeCharacterCommand(state, { id: 'illegal-tax', expectedRevision: state.revision, type: 'tax_policy', payload: { policy: 'harsh' } });
  assert.equal(denied.ok, false);
  state = command(state, 'build_estate');
  const estateCount = state.families['family-arel'].estates;
  state = advance(state, 2);
  assert.equal(state.families['family-arel'].estates, estateCount + 1);
});

test('family with no offices has real income, political actions and a way back', () => {
  let state = createCharacterSystem({ mode: 'family', familyId: 'family-namar' });
  for (const office of Object.values(state.offices)) if (state.people[office.holderId]?.familyId === 'family-namar') office.holderId = null;
  const before = state.families['family-namar'].treasury;
  state = command(state, 'livelihood');
  assert.ok(state.families['family-namar'].treasury > before);
  state = command(state, 'build_support', { familyId: 'family-eshmun' });
  state = command(state, 'build_support', { familyId: 'family-safra' });
  state = command(state, 'seek_office', { officeId: 'general' });
  assert.equal(state.offices.general.holderId, 'person-1-0');
});

test('personality changes AI priorities with equal skills and resources', () => {
  const a = createCharacterSystem();
  const id = 'person-2-1';
  a.people[id].traits = ['ambitious'];
  a.people[id].loyalty = 30;
  const b = structuredClone(a); b.people[id].traits = ['cautious'];
  assert.equal(evaluateCharacterDecision(a, id).choice, 'seek_office');
  assert.equal(evaluateCharacterDecision(b, id).choice, 'serve');
  const threatened = structuredClone(a); threatened.people[id].stress = 180; threatened.people[id].health = 40;
  assert.equal(evaluateCharacterDecision(threatened, id).choice, 'recover');
  assert.ok(evaluateCharacterDecision(a, id).reasons.length > 1);
});

test('personal stress is paid once and recovery changes health and future behavior', () => {
  let state = createCharacterSystem(); state.people['person-0-0'].traits = ['compassionate', 'dutiful'];
  const before = state.people['person-0-0'].stress;
  state = command(state, 'dismiss', { officeId: 'general' });
  assert.equal(state.people['person-0-0'].stress - before, 36);
  state = command(state, 'rest');
  assert.equal(state.people['person-0-0'].stress, 6);
});

test('personal opinion is directed, loyalty remains separate, family support has material effects', () => {
  let state = createCharacterSystem();
  const general = state.people['person-1-2'];
  const loyalty = general.loyalty;
  const before = getCharacterWorldEffects(state);
  state = command(state, 'gift', { targetId: general.id });
  assert.ok(getPersonalOpinion(state, general.id, 'person-0-0') > getPersonalOpinion(state, 'person-0-0', general.id));
  assert.equal(state.people[general.id].loyalty, loyalty);
  state.families['family-namar'].grievance = -40;
  const after = getCharacterWorldEffects(state);
  assert.ok(after.militaryReadiness < before.militaryReadiness);
  assert.ok(after.cityEffects.find((c) => c.familyId === 'family-namar').taxIncome < before.cityEffects.find((c) => c.familyId === 'family-namar').taxIncome);
});

test('religious opinion and leader treaties affect support without permanent personal bonuses', () => {
  let state = createCharacterSystem(); state.people['person-0-0'].archetype = 'guardian';
  const base = getCharacterPresentation(state).religions[0].support;
  state = command(state, 'sanctuary');
  assert.equal(getCharacterPresentation(state).religions[0].support, base + 15);
  state = command(state, 'abdicate');
  assert.equal(getCharacterPresentation(state).religions[0].support, base);
});

test('promises cause later claims and memories survive opinion expiry and save roundtrip', () => {
  let state = createCharacterSystem({ seed: 993 });
  state = command(state, 'resolve_story', { storyId: state.stories[0].id, choiceId: 'promise' });
  const promise = state.memories.find((m) => m.type === 'promise');
  assert.ok(promise);
  state = advance(state, 3);
  const due = state.stories.find((s) => s.type === 'promise_due' && s.status === 'open');
  assert.ok(due);
  state = command(state, 'resolve_story', { storyId: due.id, choiceId: 'break' });
  assert.ok(state.memories.some((m) => m.type === 'betrayal' && m.causeId === promise.id));
  state = normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
  state = advance(state, 12);
  assert.ok(state.memories.some((m) => m.id === promise.id));
  assert.ok(state.stories.some((s) => s.type === 'legacy_claim'));
});

test('honoring and breaking the same promise yield distinct offices and family support', () => {
  let base = createCharacterSystem({ seed: 777 });
  base = command(base, 'resolve_story', { storyId: base.stories[0].id, choiceId: 'promise' });
  base = advance(base, 3);
  const story = base.stories.find((s) => s.type === 'promise_due' && s.status === 'open');
  const honor = command(base, 'resolve_story', { storyId: story.id, choiceId: 'honor' });
  const broken = command(base, 'resolve_story', { storyId: story.id, choiceId: 'break' });
  assert.notEqual(honor.offices[story.officeId].holderId, broken.offices[story.officeId].holderId);
  assert.ok(honor.families['family-namar'].grievance > broken.families['family-namar'].grievance);
});

test('hidden plots are filtered and a lawful discovery can reveal them', () => {
  let state = createCharacterSystem(); state.people['person-0-0'].archetype = 'schemer';
  state.memories.push({ id: 'hidden-test', type: 'plot', title: 'En dold plan', date: state.date, participants: ['person-1-0', 'person-0-0'], knownBy: ['person-1-0'] });
  assert.equal(getCharacterPresentation(state).memories.some((m) => m.id === 'hidden-test'), false);
  state = command(state, 'network');
  assert.equal(getCharacterPresentation(state).memories.some((m) => m.id === 'hidden-test'), true);
  const story = state.stories.find((s) => s.type === 'discovery');
  state = command(state, 'resolve_story', { storyId: story.id, choiceId: 'expose' });
  assert.equal(state.memories.find((m) => m.id === 'hidden-test').knownBy, 'public');
});

test('simultaneous deaths never appoint a deceased successor and split private/family property', () => {
  let state = createCharacterSystem({ mode: 'family', seed: 12 });
  state.people['person-0-0'].wealth = 93;
  const estates = state.families['family-arel'].estates;
  state = forceDeathOnNextYear(state, ['person-0-0', 'person-0-2']);
  assert.notEqual(state.offices.ruler.holderId, 'person-0-0');
  assert.notEqual(state.offices.ruler.holderId, 'person-0-2');
  assert.equal(state.people[state.offices.ruler.holderId].diedAt, null);
  assert.equal(state.families['family-arel'].estates, estates);
  assert.ok(Object.values(state.people).some((p) => p.familyId === 'family-arel' && p.wealth >= 93));
  assert.equal(state.identity.familyId, 'family-arel');
});

test('education changes competence and creates a lasting mentor relationship', () => {
  let state = createCharacterSystem({ seed: 2 });
  state = command(state, 'educate', { childId: 'person-0-4', mentorId: 'person-2-0', focus: 'stewardship' });
  const before = state.people['person-0-4'].skills.stewardship;
  state = advance(state, 3);
  assert.ok(state.people['person-0-4'].skills.stewardship > before);
  assert.ok(state.relations['person-0-4:person-2-0'].bonds.includes('mentor'));
  assert.ok(state.memories.some((m) => m.type === 'education'));
});

test('adoption changes legal membership without rewriting biology', () => {
  let state = createCharacterSystem();
  const biology = [...state.people['person-0-4'].biologicalParentIds];
  state = command(state, 'adopt', { childId: 'person-0-4' });
  assert.deepEqual(state.people['person-0-4'].biologicalParentIds, biology);
  assert.ok(state.people['person-0-4'].legalParentIds.includes('person-0-0'));
});

test('exiled family can be unhoused, earn money, find real protection and return', () => {
  let state = createCharacterSystem({ mode: 'family', familyId: 'family-namar' });
  state.families['family-namar'].exiled = true;
  state.families['family-namar'].influence = 10;
  state = command(state, 'seek_patron', { familyId: 'family-eshmun' });
  assert.equal(state.families['family-namar'].hostFamilyId, null);
  const before = state.families['family-namar'].treasury;
  state = command(state, 'livelihood');
  assert.ok(state.families['family-namar'].treasury > before);
  state.families['family-namar'].influence = 75;
  state = command(state, 'seek_patron', { familyId: 'family-eshmun' });
  assert.equal(state.families['family-namar'].hostFamilyId, 'family-eshmun');
  state = command(state, 'return_exile');
  assert.equal(state.families['family-namar'].exiled, false);
});

test('family extinction and realm continuity have different results', () => {
  const start = createCharacterSystem({ seed: 552, mode: 'family', familyId: 'family-namar' });
  const ids = Object.values(start.people).filter((p) => p.familyId === 'family-namar').map((p) => p.id);
  const family = forceDeathOnNextYear(start, ids);
  assert.equal(family.status.ended, true);
  start.identity.mode = 'realm';
  const realm = forceDeathOnNextYear(start, ids);
  assert.equal(realm.status.ended, false);
});

test('portrait lookup remains age appropriate as children mature', () => {
  let state = createCharacterSystem({ seed: 45 });
  const child = getCharacterPresentation(state).people.find((p) => p.id === 'person-0-4');
  assert.equal(child.portraitId, 'person-0-4');
  assert.equal(child.portraitAgeGroup, 'child');
  state = advance(state, 8);
  const adult = getCharacterPresentation(state).people.find((p) => p.id === 'person-0-4');
  if (adult.alive) assert.equal(adult.portraitId, 'fallback-female-adult');
});

test('three generation runs in both modes preserve referential integrity and reproducibility', () => {
  for (const mode of ['realm', 'family']) for (const seed of [1, 71, 9876]) {
    let state = createCharacterSystem({ mode, seed });
    state = command(state, 'resolve_story', { storyId: state.stories[0].id, choiceId: 'promise' });
    const first = advance(state, 65);
    const replay = advance(normalizeCharacterSystem(JSON.parse(JSON.stringify(state))), 65);
    assert.deepEqual(first, replay);
    assert.ok(first.log.some((e) => e.type === 'birth'));
    assert.ok(first.log.some((e) => e.type === 'succession'));
    assert.ok(first.memories.some((m) => m.type === 'promise'));
    for (const office of Object.values(first.offices)) if (office.holderId) assert.equal(first.people[office.holderId].diedAt, null);
    assert.deepEqual(normalizeCharacterSystem(first), first);
  }
});

test('external guardian does not give a child family control of the guardian’s kingdom', () => {
  let state = createCharacterSystem({ mode: 'family', familyId: 'family-namar', seed: 87 });
  state = forceDeathOnNextYear(state, ['person-1-0', 'person-1-1', 'person-1-2', 'person-1-3']);
  assert.equal(state.families['family-namar'].headId, 'person-1-4');
  assert.ok(state.families['family-namar'].guardianId);
  assert.equal(getAvailableCharacterActions(state).some((a) => a.type === 'tax_policy'), false);
  assert.equal(executeCharacterCommand(state, { id: 'foreign-guardian-tax', expectedRevision: state.revision, type: 'tax_policy', payload: { policy: 'harsh' } }).ok, false);
});

test('malformed references and non-finite values are refused before normalization', () => {
  const broken = createCharacterSystem(); broken.people['person-0-0'].legalParentIds = ['missing-person'];
  assert.throws(() => normalizeCharacterSystem(broken), /släktband/);
  const badNumber = createCharacterSystem(); badNumber.people['person-0-0'].skills.command = Infinity;
  assert.throws(() => normalizeCharacterSystem(badNumber), /ogiltigt tal/);
  const futureBoundary = createCharacterSystem(); futureBoundary.nextAnnualDate = futureBoundary.date;
  assert.throws(() => normalizeCharacterSystem(futureBoundary), /kalendergräns/);
});

test('opinion and family support explanations account for visible totals', () => {
  const state = command(createCharacterSystem(), 'gift', { targetId: 'person-1-0' });
  const view = getCharacterPresentation(state);
  const target = view.people.find((p) => p.id === 'person-1-0');
  assert.equal(target.opinionReasons.reduce((sum, reason) => sum + reason.value, 0), target.opinion);
  for (const family of view.families) assert.equal(Math.round(Math.max(0, Math.min(100, family.supportReasons.reduce((sum, reason) => sum + reason.value, 0)))), family.support);
});

test('a family governor can govern the actual city but cannot command a relative’s army', () => {
  let state = createCharacterSystem({ mode: 'family', familyId: 'family-namar' });
  const cityId = state.offices['governor-1'].cityId;
  const before = getCharacterWorldEffects(state).cityEffects.find((city) => city.id === cityId);
  state = command(state, 'exercise_office', { officeId: 'governor-1', policy: 'service' });
  const after = getCharacterWorldEffects(state).cityEffects.find((city) => city.id === cityId);
  assert.ok(after.productionMultiplier > before.productionMultiplier);
  assert.ok(after.unrest < before.unrest);
  assert.equal(state.offices['governor-1'].publicBudget, 20);
  assert.equal(executeCharacterCommand(state, { id: 'relative-army', expectedRevision: state.revision, type: 'exercise_office', payload: { officeId: 'general', policy: 'service' } }).ok, false);
});

test('office patronage transfers bounded public funds and creates political consequences', () => {
  let state = createCharacterSystem({ mode: 'family', familyId: 'family-namar' });
  const before = state.families['family-namar'].treasury;
  const legitimacy = state.realm.legitimacy;
  state = command(state, 'exercise_office', { officeId: 'governor-1', policy: 'patronage' });
  assert.equal(state.families['family-namar'].treasury, before + 8);
  assert.equal(state.realm.legitimacy, legitimacy - 3);
  assert.ok(state.memories.some((memory) => memory.type === 'patronage'));
  assert.equal(executeCharacterCommand(state, { id: 'office-repeat', expectedRevision: state.revision, type: 'exercise_office', payload: { officeId: 'governor-1', policy: 'patronage' } }).ok, false);
});

test('coercion creates fear and its behavioral cost decays with time', () => {
  let state = createCharacterSystem();
  state = command(state, 'banish', { familyId: 'family-namar' });
  assert.equal(state.people['person-2-0'].fear, 15);
  state = advance(state);
  assert.equal(state.people['person-2-0'].fear, 13);
  assert.ok(evaluateCharacterDecision(state, 'person-2-0').reasons.some((reason) => reason.includes('rädsla')));
});

test('all eight archetype abilities execute under the matching mandate and refuse repetition', () => {
  const cases = { commander: 'mobilize', steward: 'reform', diplomat: 'concord', scholar: 'academy', legislator: 'succession_law', guardian: 'sanctuary', schemer: 'network', builder: 'aqueduct' };
  for (const [archetype, ability] of Object.entries(cases)) {
    let state = createCharacterSystem(); state.people['person-0-0'].archetype = archetype;
    const before = state.realm.treasury;
    state = command(state, ability);
    assert.ok(state.realm.treasury < before);
    assert.ok(state.log.some((event) => event.type === 'ability'));
    assert.equal(executeCharacterCommand(state, { id: `repeat-${ability}`, expectedRevision: state.revision, type: ability }).ok, false);
    assert.deepEqual(normalizeCharacterSystem(state), state);
  }
});

test('stress crisis offers a valid free recovery path when cash is exhausted', () => {
  let state = createCharacterSystem(); state.people['person-0-0'].stress = 105; state.families['family-arel'].treasury = 0;
  state = advance(state);
  const story = state.stories.find((item) => item.type === 'stress_crisis' && item.status === 'open');
  assert.ok(story);
  state.families['family-arel'].treasury = 0;
  const before = state.people['person-0-0'].stress;
  const shown = getCharacterPresentation(state).stories.find((item) => item.id === story.id);
  assert.equal(shown.choices.find((choice) => choice.id === 'rest').disabledReason, '');
  state = command(state, 'resolve_story', { storyId: story.id, choiceId: 'rest' });
  assert.equal(state.people['person-0-0'].stress, before - 40);
  assert.equal(state.actionPoints, 0);
});

test('religious leadership is replaced after death without changing collective faith', () => {
  const initial = createCharacterSystem({ seed: 17 });
  const leaderId = initial.religions.dawn.leaderId;
  const state = forceDeathOnNextYear(initial, [leaderId]);
  assert.notEqual(state.religions.dawn.leaderId, leaderId);
  assert.equal(state.people[state.religions.dawn.leaderId].diedAt, null);
  assert.equal(state.religions.dawn.id, 'dawn');
  assert.ok(Object.values(state.people).some((person) => person.religionId === 'dawn'));
});

test('a deceased event participant is replaced by a valid family claimant, not resurrected', () => {
  let state = createCharacterSystem({ seed: 91 });
  state = command(state, 'resolve_story', { storyId: state.stories[0].id, choiceId: 'promise' });
  state = forceDeathOnNextYear(state, ['person-1-2']);
  const waiting = state.stories.find((story) => story.type === 'promise_due');
  assert.notEqual(waiting.actorId, 'person-1-2');
  assert.equal(state.people[waiting.actorId].diedAt, null);
  assert.equal(waiting.originalActorId, 'person-1-2');
});

test('a coup closes if its claimant dies before resolution', () => {
  let state = createCharacterSystem({ seed: 31 });
  state.stories.push({ id: 'fixture-coup', type: 'coup', title: 'Ett anspråk', description: 'Test', actorId: 'person-1-0', targetId: 'person-0-0', familyId: 'family-namar', createdAt: state.date, dueAt: addGameMonths(state.date, 12), status: 'open', knownBy: 'public' });
  state = forceDeathOnNextYear(state, ['person-1-0']);
  assert.equal(state.stories.find((story) => story.id === 'fixture-coup').status, 'closed');
});

test('independent adult relatives form families without compulsory player matchmaking', () => {
  for (const seed of [1, 71, 321, 9876]) {
    const state = advance(createCharacterSystem({ mode: 'family', seed }), 100);
    assert.equal(state.status.ended, false, `Unexpected extinction for seed ${seed}`);
    assert.ok(Object.values(state.people).some((person) => !person.diedAt && person.familyId === state.identity.familyId));
    assert.ok(state.families[state.identity.familyId].headId);
    assert.ok(state.log.some((event) => event.type === 'marriage' && event.participants.some((id) => state.people[id]?.familyId === state.identity.familyId)));
    assert.ok(getAvailableCharacterActions(state).length >= 10);
    assert.ok(getAvailableCharacterActions(state).some((action) => action.type === 'livelihood' && !action.disabledReason));
  }
});

test('host order authorization follows the same mandate after succession', () => {
  let state = createCharacterSystem({ mode: 'family' });
  assert.equal(canCharacterDirectRealm(state), true);
  state = command(state, 'abdicate');
  assert.equal(canCharacterDirectRealm(state), false);
  const realm = command(createCharacterSystem({ mode: 'realm' }), 'abdicate');
  assert.equal(canCharacterDirectRealm(realm), true);
});

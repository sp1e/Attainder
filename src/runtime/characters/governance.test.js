import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { advanceCharacters, applyRealmDissolution, canCharacterDirectRealm, createCharacterSystem, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, getCharacterWorldEffects, normalizeCharacterSystem, reconcileExternalHosts } from './index.js';

let sequence = 0;
function attempt(state, type, payload = {}) { return executeCharacterCommand(state, { id: `governance-${++sequence}`, expectedRevision: state.revision, type, payload }); }
function command(state, type, payload = {}) { const result = attempt(state, type, payload); assert.equal(result.ok, true, result.error); return result.state; }
function advance(state, years = 1) { const result = advanceCharacters(state, addGameMonths(state.date, years * 12)); assert.equal(result.ok, true, result.error); return result.state; }
function coup(mode = 'family') {
  let state = createCharacterSystem({ mode, seed: 321 });
  state.stories.push({ id: 'fixture-seizure', type: 'coup', title: 'Maktövertagande', description: 'En faktisk politisk utmanare', actorId: 'person-1-0', targetId: 'person-0-0', familyId: 'family-namar', createdAt: state.date, dueAt: addGameMonths(state.date, 12), status: 'open', knownBy: 'public' });
  return command(state, 'resolve_story', { storyId: 'fixture-seizure', choiceId: 'yield' });
}
function minority({ age = 10, traits = ['cautious'], loyalty = 30 } = {}) {
  let state = createCharacterSystem({ seed: 321 });
  const principal = state.people['person-0-4'];
  const regent = state.people['person-0-0'];
  principal.bornAt = addGameMonths(state.date, -age * 12);
  principal.health = 100;
  regent.bornAt = addGameMonths(state.date, -30 * 12);
  regent.health = 100; regent.traits = traits; regent.loyalty = loyalty; regent.archetype = 'commander';
  state.offices.ruler.holderId = principal.id; state.offices.ruler.regentId = regent.id;
  state.realm.lawfulRulerId = principal.id;
  state.regencies['office:ruler'] = { id: 'office:ruler', principalId: principal.id, regentId: regent.id, phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
  return command(state, 'livelihood');
}
function dissolved(mode = 'family', hosts = [{ id: 'Kesh', name: 'Kesh' }]) {
  const state = createCharacterSystem({ mode, polityId: 'Hadara', seed: 321 });
  const result = applyRealmDissolution(state, { id: 'host-dissolution', date: state.date, reason: 'Världshosten har verifierat att den sista suveräna regionen har gått förlorad.', hostCandidates: hosts });
  assert.equal(result.ok, true, result.error);
  return result.state;
}

test('a seizure changes office ownership but preserves legal claims and political consequences', () => {
  const state = coup();
  assert.equal(state.offices.ruler.holderId, 'person-1-0');
  assert.equal(state.realm.lawfulRulerId, 'person-0-0');
  assert.equal(state.realm.legalHeirId, 'person-0-2');
  const view = getCharacterPresentation(state);
  assert.equal(view.governance.contestedCrown, true);
  assert.ok(view.governance.claimHistory.some((item) => item.type === 'seizure'));
  assert.ok(view.families.find((family) => family.id === 'family-arel').supportReasons.some((reason) => reason.value === -12 && reason.label.includes('tronanspråk')));
  assert.ok(view.actions.find((action) => action.type === 'press_claim').label.includes('rättsliga'));
  assert.deepEqual(normalizeCharacterSystem(JSON.parse(JSON.stringify(state))), state);
});

test('legal succession, family leadership and actual throne remain distinct after claimant death', () => {
  let state = coup();
  state.people['person-0-0'].health = 0;
  const formerHeir = state.realm.legalHeirId;
  const inheritedWealth = state.people['person-0-0'].wealth;
  const heirWealth = state.people[formerHeir].wealth;
  state = advance(state);
  assert.equal(state.realm.lawfulRulerId, formerHeir);
  assert.equal(state.offices.ruler.holderId, 'person-1-0');
  assert.notEqual(state.families['family-arel'].headId, formerHeir);
  assert.notEqual(state.offices.ruler.holderId, formerHeir);
  assert.notEqual(state.offices.ruler.holderId, state.families['family-arel'].headId);
  assert.ok(state.people[formerHeir].wealth >= heirWealth + inheritedWealth);
  assert.equal(state.people['person-0-0'].wealth, 0);
  assert.equal(state.families['family-arel'].estates, 2);
  assert.ok(state.memories.some((item) => item.type === 'inherited_claim' && item.participants.includes(formerHeir)));
  const deadClaim = state.families['family-arel'].claims.find((item) => item.personId === 'person-0-0' && item.kind === 'lawful-ruler');
  assert.equal(deadClaim.status, 'deceased');
  state.families['family-arel'].influence = 45;
  state.realm.armyStrength = 0; state.realm.legitimacy = 0; state.offices.general.holderId = null;
  state = command(state, 'press_claim');
  assert.equal(state.offices.ruler.holderId, formerHeir);
  assert.notEqual(state.families['family-arel'].headId, formerHeir);
  assert.ok(state.realm.claimHistory.some((item) => item.type === 'restoration'));
  assert.equal(getCharacterPresentation(state).governance.contestedCrown, false);
});

test('actual ruler can recognize the displaced lawful ruler through a valid costly personal choice', () => {
  let state = coup('realm');
  const actual = state.people[state.offices.ruler.holderId];
  const beforeStress = actual.stress;
  state = command(state, 'recognize_claim');
  assert.equal(state.offices.ruler.holderId, 'person-0-0');
  assert.equal(state.realm.lawfulRulerId, 'person-0-0');
  assert.ok(state.people[actual.id].stress > beforeStress);
  assert.equal(state.realm.legitimacy, 65);
});

test('a cautious regent vetoes a risky order atomically and negotiated refusal has a real cost', () => {
  let state = minority();
  const before = JSON.stringify(state);
  const denied = attempt(state, 'mobilize');
  assert.equal(denied.ok, false); assert.match(denied.error, /samtycker inte/);
  assert.equal(JSON.stringify(state), before);
  const silver = state.families['family-arel'].treasury;
  state = command(state, 'request_regent_consent', { regencyId: 'office:ruler', actionType: 'mobilize', approach: 'negotiate' });
  assert.equal(state.families['family-arel'].treasury, silver - 10);
  assert.equal(state.regencies['office:ruler'].grants.length, 0);
  assert.ok(state.memories.some((memory) => memory.type === 'regent_veto'));
  assert.equal(attempt(state, 'request_regent_consent', { regencyId: 'office:ruler', actionType: 'mobilize', approach: 'appeal' }).ok, false);
});

test('council consent is saved, used once by a successful order and expires on the calendar', () => {
  let state = minority();
  state.families['family-arel'].influence = 90;
  state = command(state, 'request_regent_consent', { regencyId: 'office:ruler', actionType: 'mobilize', approach: 'appeal' });
  assert.equal(state.families['family-arel'].influence, 75);
  const granted = normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
  assert.equal(granted.regencies['office:ruler'].grants[0].usedAt, null);
  state = command(granted, 'mobilize');
  assert.equal(state.regencies['office:ruler'].grants[0].usedAt, state.date);
  assert.equal(attempt(state, 'mobilize').ok, false);
  const expired = advance(granted);
  assert.match(attempt(expired, 'mobilize').error, /samtycker inte/);
});

test('ambitious regent contests adulthood, council can fail and pension restores the real mandate', () => {
  let state = minority({ age: 17, traits: ['ambitious'], loyalty: 20 });
  state.families['family-arel'].influence = 80;
  state = advance(state);
  assert.equal(state.regencies['office:ruler'].phase, 'contested');
  assert.equal(canCharacterDirectRealm(state), false);
  assert.equal(state.offices.ruler.regentId, 'person-0-0');
  assert.ok(getAvailableCharacterActions(state).some((action) => action.type === 'resolve_regency'));
  assert.equal(attempt(state, 'tax_policy', { policy: 'harsh' }).ok, false);
  state.people['person-0-4'].skills.diplomacy = 0;
  state.families['family-arel'].influence = 20;
  state = command(state, 'resolve_regency', { regencyId: 'office:ruler', approach: 'council' });
  assert.equal(state.regencies['office:ruler'].phase, 'contested');
  assert.equal(state.families['family-arel'].influence, 0);
  const before = state.families['family-arel'].treasury;
  state = command(state, 'resolve_regency', { regencyId: 'office:ruler', approach: 'pension' });
  assert.equal(state.families['family-arel'].treasury, before - 40);
  assert.equal(state.regencies['office:ruler'].phase, 'ended');
  assert.equal(state.offices.ruler.regentId, null);
  assert.equal(canCharacterDirectRealm(state), true);
  state = command(state, 'tax_policy', { policy: 'harsh' });
  assert.equal(state.realm.taxPolicy, 'harsh');
});

test('dissolution ends realm identity at the actual date and preserves family continuation privately', () => {
  const realm = dissolved('realm');
  assert.equal(realm.status.ended, true);
  assert.equal(canCharacterDirectRealm(realm), false);
  assert.equal(advance(realm, 20).date, realm.date);
  const family = dissolved();
  assert.equal(family.status.ended, false);
  assert.equal(family.identity.polityId, 'Hadara');
  assert.equal(family.identity.familyId, 'family-arel');
  assert.equal(family.families['family-arel'].treasury, 110);
  assert.equal(family.families['family-arel'].estates, 2);
  assert.equal(family.families['family-arel'].hostPolityId, null);
  assert.ok(Object.values(family.offices).every((office) => !office.holderId && !office.regentId && !office.publicBudget));
  assert.equal(getCharacterWorldEffects(family).realmAlive, false);
  assert.equal(getCharacterWorldEffects(family).militaryReadiness, 0);
  assert.equal(getCharacterWorldEffects(family).annualRevenue, 0);
  assert.equal(attempt(family, 'seek_patron', { familyId: 'family-namar' }).ok, false);
  assert.equal(attempt(family, 'return_exile').ok, false);
  assert.equal(attempt(family, 'press_claim').ok, false);
  assert.equal(attempt(family, 'seek_office', { officeId: 'general' }).ok, false);
  assert.equal(attempt(family, 'build_estate').ok, false);
  assert.equal(attempt(family, 'livelihood').ok, true);
  assert.deepEqual(normalizeCharacterSystem(JSON.parse(JSON.stringify(family))), family);
});

test('foreign refuge requires a real candidate and explicit successful reception', () => {
  let state = dissolved();
  const fake = attempt(state, 'seek_refuge', { polityId: 'Invented Empire' });
  assert.equal(fake.ok, false); assert.match(fake.error, /giltiga riken/);
  state = command(state, 'seek_refuge', { polityId: 'Kesh' });
  const family = state.families['family-arel'];
  assert.equal(family.hostPolityId, 'Kesh'); assert.equal(family.treasury, 90);
  assert.ok(family.refugeAcceptedAt);
  assert.equal(canCharacterDirectRealm(state), false);
  assert.match(getCharacterPresentation(state).families.find((item) => item.id === family.id).statusLabel, /Kesh/);
  assert.equal(attempt(state, 'build_estate').ok, true);
  const refusal = dissolved('family', [{ id: 'Hostile', name: 'Fientlig granne', opinion: -100, refugeThreshold: 100, admissionCost: 25 }]);
  const rejected = command(refusal, 'seek_refuge', { polityId: 'Hostile' });
  assert.equal(rejected.families['family-arel'].hostPolityId, null);
  assert.equal(rejected.families['family-arel'].treasury, 85);
  assert.ok(rejected.memories.some((memory) => memory.type === 'refuge_refused'));
});

test('host renaming preserves accepted refuge and actual host loss removes it without a replacement', () => {
  const state = command(dissolved(), 'seek_refuge', { polityId: 'Kesh' });
  const acceptedAt = state.families['family-arel'].refugeAcceptedAt;
  const renamed = reconcileExternalHosts(state, { id: 'rename-host', date: state.date, hostAliases: { Kesh: 'Keshet' }, hostCandidates: [{ id: 'Keshet', name: 'Keshet' }] });
  assert.equal(renamed.ok, true, renamed.error);
  assert.equal(renamed.state.families['family-arel'].hostPolityId, 'Keshet');
  assert.equal(renamed.state.families['family-arel'].refugeAcceptedAt, acceptedAt);
  const unchanged = reconcileExternalHosts(renamed.state, { id: 'context-unchanged', hostCandidates: [{ id: 'Keshet', name: 'Keshet' }] });
  assert.equal(unchanged.state, renamed.state);
  const lost = reconcileExternalHosts(renamed.state, { id: 'host-dies', hostCandidates: [] });
  assert.equal(lost.state.families['family-arel'].hostPolityId, null);
  assert.equal(lost.state.status.ended, false);
  assert.ok(lost.events.some((event) => event.type === 'refuge_lost'));
  assert.equal(attempt(lost.state, 'build_estate').ok, false);
  assert.deepEqual(normalizeCharacterSystem(lost.state), lost.state);
});

test('host transitions are atomic, dated and idempotent and family years remain split invariant after collapse', () => {
  const original = createCharacterSystem({ mode: 'family', polityId: 'Hadara', seed: 321 });
  const wrongDate = applyRealmDissolution(original, { id: 'future-collapse', date: addGameMonths(original.date, 12) });
  assert.equal(wrongDate.ok, false); assert.equal(wrongDate.state, original);
  const fakeAccepted = applyRealmDissolution(original, { id: 'fake-host', hostAccepted: true, hostPolityId: 'Invented' });
  assert.equal(fakeAccepted.ok, false); assert.equal(fakeAccepted.state, original);
  const state = dissolved();
  const retry = applyRealmDissolution(state, { id: 'host-dissolution' });
  assert.equal(retry.duplicate, true); assert.equal(retry.state, state);
  const whole = advance(state, 3); const split = advance(advance(state), 2);
  for (const key of ['people', 'families', 'realm', 'offices', 'memories', 'rngState', 'date']) assert.deepEqual(whole[key], split[key], key);
  assert.ok(Object.values(whole.offices).every((office) => !office.holderId));
});

test('story appointments honor the same regent veto and consume the same consent', () => {
  let state = minority({ traits: ['ambitious'], loyalty: 90 });
  state.stories.push({ id: 'fixture-regent-promise', type: 'promise_due', title: 'Det utlovade ämbetet', description: 'Ett rättsligt giltigt gammalt löfte.', actorId: 'person-1-0', targetId: 'person-0-4', familyId: 'family-namar', officeId: 'general', createdAt: state.date, dueAt: state.date, status: 'open', knownBy: 'public' });
  assert.equal(attempt(state, 'resolve_story', { storyId: 'fixture-regent-promise', choiceId: 'honor' }).ok, false);
  assert.ok(getCharacterPresentation(state).stories.find((story) => story.id === 'fixture-regent-promise').choices.find((choice) => choice.id === 'honor').disabledReason);
  state = command(state, 'request_regent_consent', { regencyId: 'office:ruler', actionType: 'appoint', approach: 'negotiate' });
  state = command(state, 'resolve_story', { storyId: 'fixture-regent-promise', choiceId: 'honor' });
  assert.equal(state.offices.general.holderId, 'person-1-0');
  assert.equal(state.regencies['office:ruler'].grants[0].usedAt, state.date);
});

test('bounded foreign context retains a living accepted host and never mistakes truncation for extinction', () => {
  const state = command(dissolved('family', [{ id: 'Z-host', name: 'Den accepterade värden' }]), 'seek_refuge', { polityId: 'Z-host' });
  const hostCandidates = Array.from({ length: 30 }, (_, index) => ({ id: `A-${index}`, name: `Ny aktör ${index}` }));
  hostCandidates.push({ id: 'Z-host', name: 'Den accepterade värden' });
  const result = reconcileExternalHosts(state, { id: 'expanded-world', hostCandidates });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.externalHosts.length, 24);
  assert.equal(result.state.families['family-arel'].hostPolityId, 'Z-host');
  assert.ok(result.state.externalHosts.some((host) => host.id === 'Z-host'));
  assert.equal(result.events.some((event) => event.type === 'refuge_lost'), false);
});

test('saved legal, regency and host references are validated without mutating malformed input', () => {
  const original = minority();
  const malformed = structuredClone(original);
  malformed.regencies['office:ruler'].principalId = 'missing-person';
  const before = JSON.stringify(malformed);
  assert.throws(() => normalizeCharacterSystem(malformed), /förmyndarmandat/);
  assert.equal(JSON.stringify(malformed), before);
  const badHost = dissolved();
  badHost.families['family-arel'].hostPolityId = 'Invented';
  assert.throws(() => normalizeCharacterSystem(badHost), /registrerad mottagare/);
  const badClaim = createCharacterSystem();
  badClaim.realm.lawfulRulerId = 'missing-person';
  assert.throws(() => normalizeCharacterSystem(badClaim), /rättsligt anspråk/);
});

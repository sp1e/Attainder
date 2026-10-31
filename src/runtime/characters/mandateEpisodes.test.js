import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSystem } from './index.js';
import { attachMandateGrant, ensureMandateEpisodes, grantMatchesMandate, reconcileMandateEpisode, validateMandateEpisodes } from './mandateEpisodes.js';

const key = 'office:ruler';
const sick = (id, kind = 'smallpox') => ({ id, kind, severity: 3, stage: 'active', startedAt: '-0300-01-01', stageHistory: [{ date: '-0300-01-01', stage: 'active' }] });
function fixture() {
  const state = createCharacterSystem({ seed: 321 });
  const principal = state.people[state.offices.ruler.holderId];
  principal.healthConditions = [sick('principal-illness')];
  return { state, principal };
}
const grant = (record) => attachMandateGrant(record, { actionType: 'appoint', grantedAt: '-0300-01-01', expiresAt: '-0299-01-01' });

test('a severe illness establishes representation without transferring ownership or spending', () => {
  const { state, principal } = fixture();
  const before = structuredClone({ people: state.people, families: state.families, offices: state.offices, realm: state.realm, identity: state.identity, rng: state.rngState, healthRng: state.healthRngState });
  const regentId = reconcileMandateEpisode(state, key, principal.id, { silent: true });
  assert.ok(regentId); assert.notEqual(regentId, principal.id);
  assert.equal(state.regencies[key].phase, 'incapacity');
  assert.deepEqual(state.regencies[key].causeConditionIds, ['principal-illness']);
  assert.deepEqual({ people: state.people, families: state.families, offices: state.offices, realm: state.realm, identity: state.identity, rng: state.rngState, healthRng: state.healthRngState }, before);
  validateMandateEpisodes(state);
});

test('overlapping illnesses share one episode until the final condition resolves', () => {
  const { state, principal } = fixture();
  principal.healthConditions.push(sick('second', 'injury'));
  reconcileMandateEpisode(state, key, principal.id, { silent: true });
  const original = structuredClone(state.regencies[key]);
  principal.healthConditions[0].stageHistory.push({ stage: 'resolved', date: '-0300-02-01' }); state.date = '-0300-02-01';
  reconcileMandateEpisode(state, key, principal.id, { silent: true });
  assert.equal(state.regencies[key].episodeId, original.episodeId);
  assert.deepEqual(state.regencies[key].causeConditionIds, ['second']);
  principal.healthConditions[1].stageHistory.push({ stage: 'resolved', date: '-0300-03-01' }); state.date = '-0300-03-01';
  assert.equal(reconcileMandateEpisode(state, key, principal.id, { silent: true }), null);
  assert.equal(state.regencies[key].phase, 'ended');
  principal.healthConditions.push({ ...sick('relapse'), startedAt: state.date, stageHistory: [{ stage: 'active', date: state.date }] });
  reconcileMandateEpisode(state, key, principal.id, { silent: true });
  assert.notEqual(state.regencies[key].episodeId, original.episodeId);
});

test('replacing a sick regent changes the term and invalidates consent without replacing the episode', () => {
  const { state, principal } = fixture();
  const first = reconcileMandateEpisode(state, key, principal.id, { silent: true });
  const record = state.regencies[key], consent = grant(record), episode = record.episodeId;
  record.grants.push(consent); record.requestAfter.appoint = '-0299-01-01';
  state.people[first].healthConditions.push(sick('regent-illness'));
  const second = reconcileMandateEpisode(state, key, principal.id, { silent: true });
  assert.ok(second); assert.notEqual(second, first);
  assert.equal(record.episodeId, episode); assert.deepEqual(record.grants, []); assert.deepEqual(record.requestAfter, {});
  assert.equal(grantMatchesMandate(record, consent), false);
});

test('no capable representative is a saved vacancy, not death or a new succession', () => {
  const { state, principal } = fixture();
  for (const person of Object.values(state.people)) if (person.id !== principal.id) person.healthConditions.push(sick(`sick-${person.id}`));
  assert.equal(reconcileMandateEpisode(state, key, principal.id, { silent: true }), null);
  const before = JSON.stringify(state);
  assert.equal(reconcileMandateEpisode(state, key, principal.id, { silent: true }), null);
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.regencies[key].phase, 'incapacity');
  assert.equal(state.offices.ruler.holderId, principal.id); assert.equal(state.realm.alive, true);
  validateMandateEpisodes(JSON.parse(before));
});

test('a sick principal reaching adulthood keeps the minority episode and its consent until recovery', () => {
  const { state, principal } = fixture(); principal.bornAt = '-0318-07-01';
  const regentId = reconcileMandateEpisode(state, key, principal.id, { silent: true });
  const record = state.regencies[key], consent = grant(record), episode = record.episodeId, term = record.termId;
  record.grants.push(consent);
  const regent = state.people[regentId]; regent.traits = ['ambitious']; regent.loyalty = 20; state.families[regent.familyId].influence = 80;
  state.date = '-0300-07-01'; reconcileMandateEpisode(state, key, principal.id, { silent: true });
  assert.equal(record.phase, 'minority'); assert.equal(record.episodeId, episode); assert.equal(record.termId, term);
  assert.equal(grantMatchesMandate(record, consent), true);
  principal.healthConditions[0].stageHistory.push({ stage: 'resolved', date: '-0300-08-01' }); state.date = '-0300-08-01';
  const events = []; const emit = (_state, list, type) => list.push(type);
  reconcileMandateEpisode(state, key, principal.id, { events, emit });
  reconcileMandateEpisode(state, key, principal.id, { events, emit });
  assert.equal(record.phase, 'contested'); assert.deepEqual(events, ['regency_dispute']);
});

test('principal or claimant illness cannot erase an existing contested handover', () => {
  const { state, principal } = fixture();
  const regentId = reconcileMandateEpisode(state, key, principal.id, { silent: true });
  const record = state.regencies[key]; record.basis = 'minority'; record.phase = 'contested';
  state.people[regentId].healthConditions.push(sick('claimant-illness'));
  reconcileMandateEpisode(state, key, principal.id, { silent: true });
  assert.equal(record.phase, 'contested'); assert.equal(record.regentId, regentId);
});

test('legacy activation binds unchanged minority grants once without fabricating history', () => {
  const { state, principal } = fixture(); principal.healthConditions = []; principal.bornAt = '-0310-01-01';
  const regentId = Object.values(state.people).find((p) => p.id !== principal.id && p.familyId === principal.familyId).id;
  state.offices.ruler.regentId = regentId;
  state.regencies[key] = { id: key, principalId: principal.id, regentId, phase: 'minority', startedAt: state.date,
    grants: [{ actionType: 'appoint', grantedAt: state.date, expiresAt: '-0299-01-01' }], requestAfter: {} };
  delete state.mandateVersion; delete state.mandateActivatedAt; delete state.mandateSequence;
  const history = structuredClone({ log: state.log, memories: state.memories, rng: state.rngState, treasury: state.realm.treasury });
  ensureMandateEpisodes(state); const first = structuredClone(state); ensureMandateEpisodes(state);
  assert.deepEqual(state, first); assert.equal(grantMatchesMandate(state.regencies[key], state.regencies[key].grants[0]), true);
  assert.deepEqual({ log: state.log, memories: state.memories, rng: state.rngState, treasury: state.realm.treasury }, history);
  validateMandateEpisodes(state);
});

test('future versions and broken episode references are rejected', () => {
  const { state, principal } = fixture(); state.mandateVersion = 2;
  const before = structuredClone(state); assert.throws(() => ensureMandateEpisodes(state)); assert.deepEqual(state, before);
  delete state.mandateVersion; reconcileMandateEpisode(state, key, principal.id, { silent: true });
  state.regencies[key].causeConditionIds = ['missing-condition']; assert.throws(() => validateMandateEpisodes(state));
});

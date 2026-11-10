// An envoy to a king who remembers. Spec: docs/superpowers/specs/2026-11-10-envoys-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, estimateEnvoyRequest, executeCharacterCommand, getEnvoyBrief, normalizeCharacterSystem } from './index.js';
import { ENVOY, envoyTargets, memoryRef } from './envoys.js';
import { foreignOpinion } from './foreignRealms.js';
import { hashRoll } from './duels.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const streams = (s) => [s.rngState, s.actionRngState, s.lineageRngState, s.healthRngState];
const CORDOBA = 'emirate-of-cordoba';
const BETRAYAL = { date: '0780-06-01', label: 'Svek i kriget', amount: -40, until: '0810-06-01' };
const HELP = { date: '0790-06-01', label: 'Stod vid vår sida', amount: 15, until: '0810-06-01' };
let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result; };
const send = (state, payload, origin = 'converse') => executeCharacterCommand(state, { id: `envoy-${++counter}`, expectedRevision: state.revision, type: 'envoy_request', payload, origin });
const realmOf = (state, id) => state.foreignRealms.find((realm) => realm.id === id);

// Charlemagne's court; Córdoba remembers a betrayal twenty years back and a war fought side by side.
function court() {
  const state = createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  realmOf(state, CORDOBA).memories.push({ ...BETRAYAL }, { ...HELP });
  return state;
}
// Moves the plot stream's state, which the roll only reads, until the request is accepted (or refused).
function settle(state, request, accept) {
  const value = estimateEnvoyRequest(state, request).value;
  for (state.plotRngState = 1; (hashRoll(`${request.realmId}|${state.date}|${request.kind}|${state.plotRngState}|envoy`) * 100 < value) !== accept; state.plotRngState++);
  return state;
}

test('the king remembers: each live memory is a row of the odds, labelled with its year', () => {
  const state = court();
  const estimate = estimateEnvoyRequest(state, { realmId: CORDOBA, kind: 'reconcile' });
  assert.deepEqual(estimate.modifiers.slice(0, 3).map(({ label, value }) => ({ label, value })), [
    { label: 'Grundchans', value: 35 }, { label: 'Svek i kriget (780)', value: -10 }, { label: 'Stod vid vår sida (790)', value: 4 }]);
  assert.equal(estimate.value, 29);
  realmOf(state, CORDOBA).memories.push({ date: '0795-01-01', label: 'Förlorat land', amount: -60, until: '0845-01-01' });
  const held = estimateEnvoyRequest(state, { realmId: CORDOBA, kind: 'reconcile' });
  assert.ok(held.modifiers.some((row) => row.label === 'Minnena väger högst 20' && row.value === 1));
  assert.equal(held.value, 15);
});

test('arguments count only when grounded: a gift of 20 silver and a memory that favors the player', () => {
  const state = court(), base = estimateEnvoyRequest(state, { realmId: CORDOBA, kind: 'reconcile' }).value;
  const claimed = (args, offerSilver = 0) => estimateEnvoyRequest(state, { realmId: CORDOBA, kind: 'reconcile', offerSilver, arguments: args, argumentScore: 10 }).value;
  assert.equal(claimed([{ kind: 'shared_memory', refId: 'invented|Ett påhittat minne' }]), base, 'an invented memory earns nothing');
  assert.equal(claimed([{ kind: 'shared_memory', refId: memoryRef(HELP) }]), base + 10);
  assert.equal(claimed([{ kind: 'offer' }], 19), base + 4, 'a small gift earns its row, not the arguments');
  assert.equal(claimed([{ kind: 'offer' }], 20), base + 5 + 10);
  assert.equal(claimed([{ kind: 'shared_memory', refId: memoryRef(BETRAYAL) }]), base - ENVOY.grievance, 'reminding the king of the betrayal costs');
});

test('every row has a ceiling: grievances, gifts and the model score', () => {
  const state = court(), cordoba = realmOf(state, CORDOBA);
  const wrongs = [1, 2, 3].map((n) => ({ date: `079${n}-01-01`, label: `Oförrätt ${n}`, amount: -2, until: '0810-01-01' }));
  cordoba.memories.push(...wrongs);
  const odds = (request) => estimateEnvoyRequest(state, { realmId: CORDOBA, kind: 'reconcile', ...request });
  const base = odds({}).value;
  assert.equal(odds({ arguments: wrongs.map((memory) => ({ kind: 'shared_memory', refId: memoryRef(memory) })) }).value, base - ENVOY.grievanceCap);
  assert.equal(odds({ offerSilver: 60 }).value, base + ENVOY.offerCap);
  assert.match(odds({ offerSilver: 61 }).reason, /högst 60/);
  assert.equal(odds({ arguments: [{ kind: 'shared_memory', refId: memoryRef(HELP) }], argumentScore: 50 }).value, base + ENVOY.argumentCap);
  assert.match(odds({ arguments: Array.from({ length: 9 }, () => ({ kind: 'offer' })) }).reason, /Argumenten/);
  cordoba.memories.push({ date: '0799-01-01', label: 'Ett brutet löfte', amount: -30, until: '0810-01-01' }, { date: '0799-02-01', label: 'En gåva', amount: 30, until: '0810-01-01' });
  const rows = Object.fromEntries(odds({}).modifiers.map(({ label, value }) => [label, value]));
  assert.deepEqual([rows['Ett brutet löfte (799)'], rows['En gåva (799)']], [-8, 8], 'grievances and favors round alike');
  state.actionPoints = 0;
  assert.match(odds({}).reason, /handlingar är slut/);
});

test('an accepted reconciliation pays the gift and leaves a memory of twenty years', () => {
  const request = { realmId: CORDOBA, kind: 'reconcile', offerSilver: 20, arguments: [{ kind: 'offer' }], argumentScore: 10 };
  const state = settle(court(), request, true), treasury = state.realm.treasury, opinion = foreignOpinion(state, CORDOBA), before = streams(state);
  const { state: after, events } = ok(send(state, request));
  assert.equal(after.realm.treasury, treasury - 20);
  assert.equal(foreignOpinion(after, CORDOBA), opinion + ENVOY.reconciled.amount);
  assert.deepEqual({ ...realmOf(after, CORDOBA).lastEnvoy, value: 0 }, { date: state.date, kind: 'reconcile', value: 0, accepted: true });
  assert.ok(events.some((event) => event.type === 'envoy'));
  assert.deepEqual(streams(after), before);
  assert.match(send(after, request).error, /nyss/);
  const later = (months) => estimateEnvoyRequest({ ...after, date: addGameMonths(state.date, months) }, request);
  assert.match(later(11).reason, /nyss/);
  assert.equal(later(12).ok, true, 'a year later the realm receives envoys again');
  assert.ok(!envoyTargets(after, actionHooks(after)).some((option) => option.value === CORDOBA));
  normalizeCharacterSystem(plain(after));
});

test('a refusal costs an order and nothing else', () => {
  const request = { realmId: CORDOBA, kind: 'reconcile', offerSilver: 20, arguments: [{ kind: 'offer' }], argumentScore: 10 };
  const state = settle(court(), request, false), treasury = state.realm.treasury, orders = state.actionPoints;
  const after = ok(send(state, request)).state;
  assert.equal(after.realm.treasury, treasury);
  assert.equal(after.actionPoints, orders - 1);
  assert.equal(realmOf(after, CORDOBA).lastEnvoy.accepted, false);
});

test('an accepted peace ends the war without loss of prestige', () => {
  let state = ok(executeCharacterCommand(court(), { id: 'claim-1', expectedRevision: 0, type: 'fabricate_claim', payload: { realmId: CORDOBA } })).state;
  realmOf(state, CORDOBA).claim.status = 'ready';
  state.actionPoints = 3;
  state = ok(executeCharacterCommand(state, { id: 'war-1', expectedRevision: state.revision, type: 'declare_war', payload: { realmId: CORDOBA } })).state;
  const request = { realmId: CORDOBA, kind: 'peace' };
  settle(state, request, true);
  const prestige = state.realm.prestige;
  const after = ok(send(state, request)).state, cordoba = realmOf(after, CORDOBA);
  assert.deepEqual({ claim: cordoba.claim, war: cordoba.war }, { claim: null, war: null });
  assert.equal(after.realm.prestige, prestige);
  assert.ok(cordoba.memories.some((memory) => memory.label === ENVOY.treaty.label));
  assert.match(estimateEnvoyRequest(court(), request).reason, /inte i krig/);
  settle(state, request, false);
  const before = streams(state), refused = ok(send(state, request)).state;
  assert.equal(realmOf(refused, CORDOBA).war.score, realmOf(state, CORDOBA).war.score, 'a refused peace leaves the war running');
  assert.equal(realmOf(refused, CORDOBA).claim.status, 'ready');
  assert.deepEqual(streams(refused), before);
});

test('only the conversation step sends an envoy, and only in historical campaigns', () => {
  assert.match(send(court(), { realmId: CORDOBA, kind: 'reconcile' }, null).error, /samtalssteget/);
  assert.match(estimateEnvoyRequest(court(), { realmId: 'nowhere', kind: 'reconcile' }).reason, /grannrike/);
  assert.match(estimateEnvoyRequest(court(), { realmId: CORDOBA, kind: 'tribute' }).reason, /be om/);
  const hadara = court();
  delete hadara.historicalOrigin;
  assert.match(estimateEnvoyRequest(hadara, { realmId: CORDOBA, kind: 'reconcile' }).reason, /historiska/);
  assert.equal(getEnvoyBrief(hadara, CORDOBA), null);
});

test('the brief tells the model what the king remembers, without odds', () => {
  const brief = getEnvoyBrief(court(), CORDOBA);
  assert.deepEqual(Object.keys(brief).sort(), ['allied', 'atWar', 'claim', 'memories', 'opinion', 'realmId', 'realmName', 'rulerAge', 'rulerName']);
  assert.deepEqual(brief.memories, [
    { refId: memoryRef(BETRAYAL), label: 'Svek i kriget', year: 780, favorable: false },
    { refId: memoryRef(HELP), label: 'Stod vid vår sida', year: 790, favorable: true }]);
});

test('a save without an envoy record loads, and a broken one is refused', () => {
  normalizeCharacterSystem(plain(court()));
  const good = { date: court().date, kind: 'reconcile', value: 30, accepted: true };
  for (const broken of [{ kind: 'tribute' }, { value: 4 }, { value: 96 }, { accepted: 'ja' }, { date: '0800-13-01' }]) {
    const save = plain(court());
    realmOf(save, CORDOBA).lastEnvoy = { ...good, ...broken };
    assert.throws(() => normalizeCharacterSystem(save), /grannriken/, JSON.stringify(broken));
  }
  const undated = plain(court());
  delete realmOf(undated, CORDOBA).memories[0].date;
  assert.throws(() => normalizeCharacterSystem(undated), /grannriken/, 'a memory needs its date');
});

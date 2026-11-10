// Border tribes that can be bribed, hired or crushed. Spec: docs/superpowers/specs/2026-11-10-border-tribes-design.md.
// The tribes below are test fixtures, not researched rows: no shipped package carries tribes yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { CAMPAIGN, TRIBE, campaignChance, crushTargets, dealTargets, seedTribes, tribeStep } from './tribes.js';
import { warChance } from './claims.js';
import { courtAnnualStep } from './court.js';
import { regencyVetoForRecord } from './governance.js';
import { hashRoll } from './duels.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const FIXTURE = [
  { id: 'test-avars', nameSv: 'Testavarer', coordinates: [19.0, 47.0], sourceIds: ['fixture'] },
  { id: 'test-obodrites', nameSv: 'Testobodriter', coordinates: [11.4, 53.9], sourceIds: ['fixture'] },
  { id: 'test-sorbs', nameSv: 'Testsorber', coordinates: [13.5, 51.5], sourceIds: ['fixture'] },
  { id: 'test-far', nameSv: 'Fjärran testfolk', coordinates: [100, 40], sourceIds: ['fixture'] },
  { id: 'test-obodrites', nameSv: 'Dubblett', coordinates: [11.4, 53.9], sourceIds: ['fixture'] },
  { id: 'test-nameless', nameSv: '', coordinates: [7, 51], sourceIds: ['fixture'] },
  { id: 'test-nowhere', nameSv: 'Utan plats', sourceIds: ['fixture'] },
];
const OBODRITES = 'test-obodrites';
let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result; };
const command = (state, type, payload) => executeCharacterCommand(state, { id: `tribe-${++counter}`, expectedRevision: state.revision, type, payload });
const action = (state, type) => getAvailableCharacterActions(state).find((item) => item.type === type);
const tribeOf = (state, id) => state.tribes.find((tribe) => tribe.id === id);
function court(tribes = FIXTURE) {
  const historicalScenario = plain(DATA.world.historicalScenario);
  if (tribes) historicalScenario.tribes = plain(tribes);
  const state = createHistoricalCharacterSystem({ historicalScenario, date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  state.actionPoints = 3;
  return state;
}

test('a shipped start has no tribes and offers no tribe command', () => {
  const state = court(null);
  assert.deepEqual(state.tribes, []);
  assert.deepEqual(getCharacterPresentation(state).tribes, []);
  for (const type of ['bribe_tribe', 'hire_tribe', 'crush_tribe']) assert.equal(action(state, type), undefined, type);
  assert.equal(tribeStep(state, [], actionHooks(state)), 0);
});

test('the tribes within reach of the seat are seeded nearest first, and a broken or distant entry is left out', () => {
  const state = court();
  assert.deepEqual(state.tribes.map((tribe) => [tribe.id, tribe.name]), [[OBODRITES, 'Testobodriter'], ['test-sorbs', 'Testsorber'], ['test-avars', 'Testavarer']]);
  assert.ok(state.tribes.every((tribe) => tribe.distanceKm < 2500 && tribe.paidUntil === null && tribe.lastRaid === null));
  const many = Array.from({ length: 9 }, (_, i) => ({ id: `test-${i}`, nameSv: `Testfolk ${i}`, coordinates: [6.1 + i, 50.8], sourceIds: [] }));
  const h = { ...plain(DATA.world.historicalScenario), tribes: many };
  assert.deepEqual(seedTribes(h, 'carolingian-realm').map((tribe) => tribe.id), ['test-0', 'test-1', 'test-2', 'test-3', 'test-4', 'test-5']);
});

test('a restless tribe raids when its yearly roll falls under a tenth, and a paid one does not', () => {
  const state = court();
  state.realm.treasury = 1000;
  const before = streams(state);
  let raids = 0;
  for (let year = 0; year < 40; year++) {
    state.date = addGameMonths(state.date, 12);
    const expected = state.tribes.filter((tribe) => hashRoll(`${state.plotRngState}|${state.date}|${tribe.id}|raid`) < TRIBE.raid);
    const treasury = state.realm.treasury, events = [];
    assert.equal(tribeStep(state, events, actionHooks(state)), 0 - TRIBE.raidSilver * expected.length);
    assert.equal(state.realm.treasury, treasury - TRIBE.raidSilver * expected.length);
    assert.deepEqual(events.map((event) => event.title), expected.map((tribe) => `Räd från ${tribe.name}`));
    raids += expected.length;
  }
  assert.ok(raids > 0, 'forty years see at least one raid');
  assert.deepEqual(streams(state), before, 'no random stream moves');
  for (const tribe of state.tribes) tribe.paidUntil = addGameMonths(state.date, 600);
  for (let year = 0; year < 20; year++) {
    state.date = addGameMonths(state.date, 12);
    assert.equal(tribeStep(state, [], actionHooks(state)), 0);
  }
});

test('a raid takes only what the treasury holds, and 2 legitimacy held at 0', () => {
  const state = court();
  state.realm.treasury = 4;
  const legitimacy = state.realm.legitimacy;
  for (let year = 0; year < 60 && state.realm.treasury === 4; year++) {
    state.date = addGameMonths(state.date, 12);
    tribeStep(state, [], actionHooks(state));
  }
  assert.equal(state.realm.treasury, 0);
  assert.equal(state.realm.legitimacy, Math.max(0, legitimacy - TRIBE.raidLegitimacy));
  state.realm.legitimacy = 1;
  for (const tribe of state.tribes) tribe.paidUntil = null;
  for (let year = 0; year < 60 && state.realm.legitimacy === 1; year++) {
    state.date = addGameMonths(state.date, 12);
    tribeStep(state, [], actionHooks(state));
  }
  assert.equal(state.realm.legitimacy, 0);
});

test('the court year counts the raids in its treasury delta', () => {
  const state = court();
  state.realm.treasury = 1000;
  let raiders = [];
  while (!raiders.length) {
    state.date = addGameMonths(state.date, 12);
    raiders = state.tribes.filter((tribe) => hashRoll(`${state.plotRngState}|${state.date}|${tribe.id}|raid`) < TRIBE.raid);
  }
  const quiet = plain(state);
  for (const tribe of quiet.tribes) tribe.paidUntil = addGameMonths(quiet.date, 12);
  const raided = courtAnnualStep(state, [], actionHooks(state));
  const calm = courtAnnualStep(quiet, [], actionHooks(quiet));
  assert.equal(Math.round((raided - calm) * 100) / 100, 0 - TRIBE.raidSilver * raiders.length);
});

test('a bribe buys five years without raids, and the tribe can still be crushed', () => {
  const state = court();
  const treasury = state.realm.treasury;
  const after = ok(command(state, 'bribe_tribe', { tribeId: OBODRITES })).state;
  assert.equal(after.realm.treasury, treasury - TRIBE.bribe);
  assert.equal(tribeOf(after, OBODRITES).paidUntil, addGameMonths(state.date, TRIBE.bribeMonths));
  assert.equal(dealTargets(after).some((option) => option.value === OBODRITES), false);
  assert.equal(crushTargets(after).some((option) => option.value === OBODRITES), true);
  assert.match(getCharacterPresentation(after).tribes.find((tribe) => tribe.id === OBODRITES).stateLabel, /^betalt till \d+$/);
  assert.match(command(after, 'bribe_tribe', { tribeId: OBODRITES }).error, /gränsfolk som kan tas emot/);
});

test('a hired tribe serves three years and adds a tenth to the chance of a border war battle', () => {
  const state = court();
  const realm = state.foreignRealms[0];
  const base = warChance(state, realm, 20);
  const after = ok(command(state, 'hire_tribe', { tribeId: OBODRITES })).state;
  assert.equal(tribeOf(after, OBODRITES).hiredUntil, addGameMonths(state.date, TRIBE.hireMonths));
  assert.equal(Math.round((warChance(after, after.foreignRealms[0], 20) - base) * 10) / 10, TRIBE.hireBonus);
  assert.equal(crushTargets(after).some((option) => option.value === OBODRITES), false, 'a hired tribe is not attacked');
  after.date = addGameMonths(after.date, TRIBE.hireMonths);
  assert.equal(warChance(after, after.foreignRealms[0], 20), base, 'the service ends after three years');
});

// The first month from the start whose campaign roll wins (or loses) against the court's readiness.
function campaignMonth(state, tribeId, won) {
  const chance = campaignChance(actionHooks(state).militaryReadiness());
  for (let month = 0; month < 240; month++) {
    const date = addGameMonths(state.date, month);
    if ((hashRoll(`${tribeId}|${date}|crush`) < chance) === won) return date;
  }
  throw new Error('no month found');
}

test('a won campaign keeps the tribe away for thirty years; a lost one costs men and standing', () => {
  for (const won of [true, false]) {
    const state = court();
    state.date = campaignMonth(state, OBODRITES, won);
    const { prestige, armyStrength } = state.realm, before = streams(state);
    const after = ok(command(state, 'crush_tribe', { tribeId: OBODRITES })).state;
    const outcome = won ? CAMPAIGN.won : CAMPAIGN.lost, tribe = tribeOf(after, OBODRITES);
    assert.equal(after.realm.prestige, Math.min(100, Math.max(0, prestige + outcome.prestige)));
    assert.equal(after.realm.armyStrength, Math.min(100, Math.max(0, armyStrength + outcome.army)));
    assert.equal(tribe.crushedUntil, won ? addGameMonths(state.date, 12 * TRIBE.crushYears) : null);
    assert.equal(tribe.lastCampaign, state.date);
    assert.deepEqual(streams(after), before);
    assert.match(command(after, 'crush_tribe', { tribeId: OBODRITES }).error, /gränsfolk som kan tas emot/, 'one campaign a year');
  }
});

test('a contested regency stops hiring and crushing a tribe, but not tribute', () => {
  const state = court();
  const record = { id: 'office:ruler', principalId: state.offices.ruler.holderId, regentId: state.offices.ruler.holderId, phase: 'contested', grants: [] };
  assert.equal(regencyVetoForRecord(state, record, 'bribe_tribe'), '');
  assert.match(regencyVetoForRecord(state, record, 'hire_tribe'), /omstridd/);
  assert.match(regencyVetoForRecord(state, record, 'crush_tribe'), /omstridd/);
});

test('the actions list the tribes they can reach, and Hadara has neither tribes nor commands', () => {
  const state = court();
  assert.deepEqual(action(state, 'bribe_tribe').fields[0].options.map((option) => option.value), [OBODRITES, 'test-sorbs', 'test-avars']);
  for (const tribe of state.tribes) tribe.crushedUntil = addGameMonths(state.date, 12);
  assert.match(action(state, 'crush_tribe').disabledReason, /Inget gränsfolk/);
  const hadara = court();
  delete hadara.historicalOrigin;
  delete hadara.foreignRealms;
  delete hadara.tribes;
  assert.equal(action(hadara, 'bribe_tribe'), undefined);
  assert.equal(command(hadara, 'bribe_tribe', { tribeId: OBODRITES }).ok, false);
});

test('saves: an older historical save gains an empty list, and a broken tribe is refused', () => {
  const old = plain(court());
  delete old.tribes;
  assert.deepEqual(normalizeCharacterSystem(old).tribes, []);
  const state = court();
  assert.deepEqual(normalizeCharacterSystem(plain(state)).tribes, state.tribes);
  const broken = plain(court());
  broken.tribes[0].paidUntil = 'snart';
  assert.throws(() => normalizeCharacterSystem(broken), /gränsfolk/);
  const twice = plain(court());
  twice.tribes[1].id = twice.tribes[0].id;
  assert.throws(() => normalizeCharacterSystem(twice), /gränsfolk/);
  const hadara = plain(court());
  delete hadara.historicalOrigin;
  delete hadara.foreignRealms;
  assert.throws(() => normalizeCharacterSystem(hadara), /gränsfolk/);
});

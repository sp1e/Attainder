// A fabricated claim on a neighbor's border land, pressed by war. Spec: docs/superpowers/specs/2026-11-10-fabricated-claim-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { CLAIM, WAR_ENDS, claimStep, warChance } from './claims.js';
import { foreignPartners } from './alliances.js';
import { foreignOpinion } from './foreignRealms.js';
import { hashRoll } from './duels.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const ASTURIAS = 'kingdom-of-asturias';
let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result; };
const command = (state, type, payload) => executeCharacterCommand(state, { id: `claim-${++counter}`, expectedRevision: state.revision, type, payload });
const realmOf = (state, id) => state.foreignRealms.find((realm) => realm.id === id);
const action = (state, type) => getAvailableCharacterActions(state).find((item) => item.type === type);
const court = () => createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });

// A court whose claim on Asturias is ready, and a fresh year of orders.
function readyClaim() {
  const state = ok(command(court(), 'fabricate_claim', { realmId: ASTURIAS })).state;
  realmOf(state, ASTURIAS).claim.status = 'ready';
  state.actionPoints = 3;
  return state;
}
function atWar() {
  return ok(command(readyClaim(), 'declare_war', { realmId: ASTURIAS })).state;
}
// Fights yearly battles until the war ends; returns the realm.
function fight(state) {
  const realm = realmOf(state, ASTURIAS);
  for (let year = 0; year < CLAIM.battles && realm.war; year++) {
    state.date = addGameMonths(state.date, 12);
    claimStep(state, [], actionHooks(state));
  }
  return realm;
}
// A war whose start date leads to the wanted end: moves the start until a dry run ends that way.
function warEndingIn(end) {
  for (let months = 0; months < 240; months++) {
    const state = atWar();
    realmOf(state, ASTURIAS).war.since = addGameMonths(state.date, -months);
    const trial = plain(state);
    const lands = fight(trial).lands ?? 0;
    const kind = lands ? 'victory' : trial.realm.treasury < state.realm.treasury ? 'defeat' : 'stalemate';
    if (kind === end) return state;
  }
  throw new Error(`no war start found for ${end}`);
}

test('fabricating a claim costs 40 silver, takes two years and blocks a marriage into that house', () => {
  const state = court(), treasury = state.realm.treasury, before = streams(state);
  assert.ok(action(state, 'fabricate_claim').fields[0].options.some((option) => option.value === ASTURIAS));
  assert.equal(action(state, 'declare_war'), undefined);
  const { state: after, events } = ok(command(state, 'fabricate_claim', { realmId: ASTURIAS }));
  assert.equal(after.realm.treasury, treasury - CLAIM.forge);
  assert.deepEqual(realmOf(after, ASTURIAS).claim, { since: state.date, readyAt: addGameMonths(state.date, 24), status: 'forging', exposed: false });
  assert.ok(events.some((event) => event.type === 'claim_forging'));
  assert.deepEqual(streams(after), before);
  assert.equal(getCharacterPresentation(after).foreignRealms.find((realm) => realm.id === ASTURIAS).claim, 'forging');
  assert.ok(!foreignPartners(after).some((option) => option.value.startsWith(ASTURIAS)));
  assert.match(command(after, 'fabricate_claim', { realmId: 'papal-states' }).error, /smids redan/);
  assert.deepEqual(normalizeCharacterSystem(plain(after)).foreignRealms, after.foreignRealms);
});

test('a distant realm, an ally and Hadara are refused', () => {
  const state = court();
  assert.match(command(state, 'fabricate_claim', { realmId: 'tang-empire' }).error, /grannrike utan/);
  realmOf(state, ASTURIAS).alliance = { since: state.date, personId: 'karl', spouseId: 'karl' };
  assert.match(command(state, 'fabricate_claim', { realmId: ASTURIAS }).error, /grannrike utan/);
  const hadara = court();
  delete hadara.historicalOrigin;
  delete hadara.foreignRealms;
  assert.equal(action(hadara, 'fabricate_claim'), undefined);
  assert.equal(command(hadara, 'fabricate_claim', { realmId: ASTURIAS }).ok, false);
});

test('a forged claim ripens after two years, and an exposed forgery costs prestige and goodwill', () => {
  const results = new Set();
  for (let months = 0; results.size < 2 && months < 120; months++) {
    const state = ok(command(court(), 'fabricate_claim', { realmId: ASTURIAS })).state, realm = realmOf(state, ASTURIAS);
    realm.claim.since = addGameMonths(state.date, -months);
    const exposed = hashRoll(`${ASTURIAS}|${realm.claim.since}|exposed`) < CLAIM.exposure, prestige = state.realm.prestige;
    claimStep(state, [], actionHooks(state));
    assert.equal(realm.claim.status, 'forging', 'not before readyAt');
    state.date = realm.claim.readyAt;
    claimStep(state, [], actionHooks(state));
    assert.deepEqual({ status: realm.claim.status, exposed: realm.claim.exposed }, { status: 'ready', exposed });
    assert.equal(foreignOpinion(state, ASTURIAS), exposed ? CLAIM.exposed.amount : 0);
    assert.equal(state.realm.prestige, exposed ? Math.max(0, prestige + CLAIM.exposedPrestige) : prestige);
    results.add(exposed);
  }
  assert.equal(results.size, 2, 'both branches ran');
});

test('declaring war costs 60 silver and goodwill; a victory takes the land, which pays every year', () => {
  const ready = readyClaim(), treasury = ready.realm.treasury;
  assert.ok(action(ready, 'declare_war').fields[0].options.some((option) => option.value === ASTURIAS));
  const state = ok(command(ready, 'declare_war', { realmId: ASTURIAS })).state;
  assert.equal(state.realm.treasury, treasury - CLAIM.war);
  assert.deepEqual(realmOf(state, ASTURIAS).war, { since: ready.date, score: 0, battles: 0 });
  assert.equal(foreignOpinion(state, ASTURIAS), CLAIM.declared.amount);
  assert.match(command(state, 'declare_war', { realmId: ASTURIAS }).error, /redan ett krig/);
  const won = warEndingIn('victory'), prestige = won.realm.prestige, legitimacy = won.realm.legitimacy;
  const realm = fight(won);
  assert.deepEqual({ claim: realm.claim, war: realm.war, lands: realm.lands }, { claim: null, war: null, lands: 1 });
  assert.equal(won.realm.prestige, Math.min(100, prestige + WAR_ENDS.victory.prestige));
  assert.equal(won.realm.legitimacy, Math.min(100, legitimacy + WAR_ENDS.victory.legitimacy));
  assert.equal(foreignOpinion(won, ASTURIAS), CLAIM.declared.amount + WAR_ENDS.victory.memory.amount);
  const kept = won.realm.treasury;
  assert.equal(claimStep(won, [], actionHooks(won)), CLAIM.income);
  assert.equal(won.realm.treasury, kept + CLAIM.income, 'the land pays into the treasury');
  assert.equal(getCharacterPresentation(won).foreignRealms.find((entry) => entry.id === ASTURIAS).lands, 1);
});

test('a defeat costs reparations, and a stalemate ends the war after five battles', () => {
  const lost = warEndingIn('defeat'), treasury = lost.realm.treasury, realm = realmOf(lost, ASTURIAS);
  let delta = 0;
  for (let year = 0; year < CLAIM.battles && realm.war; year++) { lost.date = addGameMonths(lost.date, 12); delta += claimStep(lost, [], actionHooks(lost)); }
  assert.equal(lost.realm.treasury, treasury - WAR_ENDS.defeat.reparations);
  assert.equal(delta, -WAR_ENDS.defeat.reparations, 'the accounts show the reparations');
  assert.equal(realmOf(lost, ASTURIAS).lands ?? 0, 0);
  const tied = warEndingIn('stalemate'), army = tied.realm.armyStrength;
  const events = [];
  for (let year = 0; year < CLAIM.battles; year++) { tied.date = addGameMonths(tied.date, 12); claimStep(tied, events, actionHooks(tied)); }
  assert.equal(events.filter((event) => event.type === 'battle').length, CLAIM.battles);
  assert.equal(realmOf(tied, ASTURIAS).war, null);
  assert.ok(tied.realm.armyStrength < army);
});

test('peace by command ends the war as a stalemate', () => {
  const state = atWar(), prestige = state.realm.prestige;
  assert.ok(action(state, 'make_peace'));
  const after = ok(command(state, 'make_peace', { realmId: ASTURIAS })).state;
  assert.deepEqual({ claim: realmOf(after, ASTURIAS).claim, war: realmOf(after, ASTURIAS).war }, { claim: null, war: null });
  assert.equal(after.realm.prestige, Math.max(0, prestige + WAR_ENDS.stalemate.prestige));
  assert.match(command(after, 'make_peace', { realmId: ASTURIAS }).error, /i krig med/);
});

test('each ally of the player adds a tenth to the chance of a battle', () => {
  const state = atWar(), asturias = realmOf(state, ASTURIAS);
  const base = warChance(state, asturias, 20);
  realmOf(state, 'papal-states').alliance = { since: state.date, personId: 'karl', spouseId: 'karl' };
  assert.equal(Math.round((warChance(state, asturias, 20) - base) * 10) / 10, CLAIM.allyBonus);
  assert.equal(warChance(state, asturias, 400), 0.8);
});

test('a broken claim, war or land count in a save is refused, and an old save loads', () => {
  for (const breakIt of [
    (realm) => { realm.claim.status = 'stolen'; },
    (realm) => { realm.war.score = 2; },
    (realm) => { realm.war.battles = CLAIM.battles; },
    (realm) => { realm.claim.status = 'forging'; },
    (realm) => { realm.lands = CLAIM.lands + 1; },
  ]) {
    const save = plain(atWar());
    breakIt(realmOf(save, ASTURIAS));
    assert.throws(() => normalizeCharacterSystem(save), /grannriken/);
  }
  const taken = plain(atWar()), asturias = realmOf(taken, ASTURIAS);
  Object.assign(asturias, { claim: null, war: null, lands: 1 });
  normalizeCharacterSystem(taken);
  const old = plain(court());
  for (const realm of old.foreignRealms) { delete realm.claim; delete realm.war; delete realm.lands; }
  normalizeCharacterSystem(old);
});

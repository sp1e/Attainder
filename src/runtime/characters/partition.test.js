// Partition: under the law of a divided inheritance, the dead ruler's younger children found houses of their own. Spec: docs/superpowers/specs/2026-11-10-partition-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, normalizeCharacterSystem } from './index.js';
import { PARTITION_GRUDGE, PARTITION_HEIRS, PARTITION_LABEL, PARTITION_YEARS, partitionInheritance } from './partition.js';
import { ensurePortraitIdentity } from './portraitState.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const HOUSE = 'royal-house', HEIR = 'karl-den-yngre', PIPPIN = 'pippin-av-italien', LUDVIG = 'ludvig-av-akvitanien', ROTRUD = 'rotrud';

// Karl's court on Christmas Day 800: nine living children, six of them adults; the house holds 110 silver, 2 estates and 45 influence.
function court(law = 'partition') {
  const state = createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  state.realm.successionLaw = law;
  return state;
}

const add = (state, id, fields) => {
  state.people[id] = ensurePortraitIdentity({ ...plain(state.people[PIPPIN]), id, name: id, spouseId: null, mentorId: null, diedAt: null, biologicalParentIds: [], legalParentIds: [], portraitIdentityId: null, healthConditions: [], ...fields }, state.people);
};
const killKarl = (state) => { const events = []; actionHooks(state).kill(['karl'], events, 'Ett prov'); return events; };
const houseOf = (state, id) => state.families[state.people[id].familyId];
const grudge = (state, fromId, toId) => state.relations[`${fromId}:${toId}`]?.causes.filter((cause) => cause.label === PARTITION_LABEL) ?? [];

test('the eldest child takes the throne and the next three adult children found houses with an equal share', () => {
  const state = court(), before = Object.keys(state.families).length, events = killKarl(state);
  assert.equal(actionHooks(state).ruler().id, HEIR);
  assert.equal(PARTITION_HEIRS, 3);
  assert.equal(Object.keys(state.families).length, before + 3);
  for (const id of [PIPPIN, LUDVIG, ROTRUD]) {
    const house = houseOf(state, id);
    assert.notEqual(house.id, HOUSE);
    assert.equal(house.headId, id);
    assert.deepEqual({ treasury: house.treasury, estates: house.estates, influence: house.influence }, { treasury: 27, estates: 0, influence: 11 });
  }
  assert.equal(houseOf(state, PIPPIN).name, 'Pippin av Italiens gren av Karls hus');
  for (const id of [HEIR, 'berta', 'gisela', 'teoderada']) assert.equal(state.people[id].familyId, HOUSE);
  const royal = state.families[HOUSE];
  assert.deepEqual({ treasury: royal.treasury, estates: royal.estates, influence: royal.influence, headId: royal.headId }, { treasury: 29, estates: 2, influence: 12, headId: HEIR });
  const [event, ...rest] = events.filter((e) => e.type === 'partition');
  assert.equal(rest.length, 0);
  assert.equal(event.title, 'Arvet efter Karl (Karl den store) delas');
  assert.equal(event.description, 'Karl den yngre ärver tronen. Pippin av Italien, Ludvig av Akvitanien och Rotrud delar arvet efter Karl (Karl den store) och grundar egna hus: Pippin av Italiens gren av Karls hus, Ludvig av Akvitaniens gren av Karls hus, Rotruds gren av Karls hus.');
  normalizeCharacterSystem(plain(state));
});

test('every pair among the heir and the founders resents each other for twenty years', () => {
  const state = court();
  killKarl(state);
  const shared = [HEIR, PIPPIN, LUDVIG, ROTRUD];
  for (const a of shared) for (const b of shared) {
    if (a === b) continue;
    const [cause, ...rest] = grudge(state, a, b);
    assert.equal(rest.length, 0, `${a} → ${b}`);
    assert.equal(cause.amount, PARTITION_GRUDGE);
    assert.equal(cause.expiresAt, addGameMonths(state.date, PARTITION_YEARS * 12));
  }
  assert.deepEqual(grudge(state, 'berta', HEIR), []);
});

test('under primogeniture the house stays whole', () => {
  const state = court('primogeniture'), before = Object.keys(state.families).length, events = killKarl(state);
  assert.equal(actionHooks(state).ruler().id, HEIR);
  assert.equal(Object.keys(state.families).length, before);
  assert.equal(events.filter((e) => e.type === 'partition').length, 0);
  assert.equal(state.people[PIPPIN].familyId, HOUSE);
});

test('a ruler who is not the dead ruler\'s child divides nothing', () => {
  const state = court(), karl = state.people.karl, before = Object.keys(state.families).length;
  karl.diedAt = state.date;
  partitionInheritance(state, karl, [], { ...actionHooks(state), ruler: () => state.people['generated-courtier-1'] });
  assert.equal(Object.keys(state.families).length, before);
  assert.equal(state.people[PIPPIN].familyId, HOUSE);
});

test('a founder takes a spouse of the house and children along; a child married out and the heir\'s child stay', () => {
  const state = court(), born = (id, months) => addGameMonths(state.people[id].bornAt, months);
  add(state, 'pippin-wife', { name: 'Pippins hustru', sex: 'female', bornAt: born(PIPPIN, 0), spouseId: PIPPIN, familyId: HOUSE });
  state.people[PIPPIN].spouseId = 'pippin-wife';
  add(state, 'bernhard', { name: 'Bernhard', sex: 'male', bornAt: born(PIPPIN, 240), legalParentIds: [PIPPIN, 'pippin-wife'], biologicalParentIds: [PIPPIN, 'pippin-wife'], familyId: HOUSE });
  add(state, 'heir-son', { name: 'Arvingens son', sex: 'male', bornAt: born(HEIR, 240), legalParentIds: [HEIR], biologicalParentIds: [HEIR], familyId: HOUSE });
  state.people[ROTRUD].familyId = 'generated-house-1';
  killKarl(state);
  const pippins = houseOf(state, PIPPIN);
  for (const id of ['pippin-wife', 'bernhard']) assert.equal(state.people[id].familyId, pippins.id);
  assert.equal(state.people['heir-son'].familyId, HOUSE);
  assert.equal(state.people[ROTRUD].familyId, 'generated-house-1');
  assert.notEqual(houseOf(state, 'berta').id, HOUSE, 'Berta takes the third share in Rotrud\'s place');
  assert.equal(state.people.gisela.familyId, HOUSE);
  normalizeCharacterSystem(plain(state));
});

test('a house with eight estates gives two to each founder and keeps two; two silver leave nobody in debt', () => {
  const state = court();
  Object.assign(state.families[HOUSE], { estates: 8, treasury: 2, influence: 2 });
  killKarl(state);
  for (const id of [PIPPIN, LUDVIG, ROTRUD]) assert.deepEqual([houseOf(state, id).estates, houseOf(state, id).treasury, houseOf(state, id).influence], [2, 0, 0]);
  assert.deepEqual([state.families[HOUSE].estates, state.families[HOUSE].treasury, state.families[HOUSE].influence], [2, 2, 2]);
});

test('a representative who is a founder\'s child stays in the house', () => {
  const state = court();
  add(state, 'bernhard', { name: 'Bernhard', bornAt: addGameMonths(state.people[PIPPIN].bornAt, 240), legalParentIds: [PIPPIN], biologicalParentIds: [PIPPIN], familyId: HOUSE });
  const hooks = { ...actionHooks(state), householdRepresentative: () => state.people.bernhard };
  state.people.karl.diedAt = state.date;
  partitionInheritance(state, state.people.karl, [], { ...hooks, ruler: () => state.people[HEIR] });
  assert.notEqual(state.people[PIPPIN].familyId, HOUSE);
  assert.equal(state.people.bernhard.familyId, HOUSE);
});

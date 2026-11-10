// A wonder gives prestige for generations. Spec: docs/superpowers/specs/2026-11-10-wonders-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { advanceCharacters, executeCharacterCommand, getAvailableCharacterActions, normalizeCharacterSystem } from './index.js';
import { prestigeStep } from './reign.js';
import { WONDER, standingWonders, wonderPrestigeFloor, wonderRefusal } from './wonders.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;

let counter = 0;
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const build = (state, wonderKind) => executeCharacterCommand(state, { id: `wonder-${++counter}`, expectedRevision: state.revision, type: 'build_wonder', payload: { wonderKind } });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result; };
const action = (state) => getAvailableCharacterActions(state).find((item) => item.type === 'build_wonder');
function court() {
  return createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
}
// A completed wonder of `wonderKind`, as the yearly step leaves it.
function standing(state, wonderKind) {
  state.projects.push({ id: `project-fixture-${++counter}`, kind: 'wonder', wonderKind, title: 'Prov', ownerId: 'karl', createdAt: addGameMonths(state.date, -WONDER.months), dueAt: state.date, personal: false, status: 'completed' });
}

test('the ruler starts a cathedral from the state treasury, and only one wonder is built at a time', () => {
  const state = court(), treasury = state.realm.treasury, before = streams(state);
  assert.equal(action(state).disabledReason, '');
  assert.deepEqual(action(state).fields[0].options.map((option) => option.value), ['cathedral', 'palace', 'library']);
  const { state: after, events } = ok(build(state, 'cathedral'));
  assert.equal(after.realm.treasury, treasury - WONDER.cost);
  const project = after.projects.find((item) => item.kind === 'wonder');
  assert.deepEqual({ kind: project.wonderKind, title: project.title, status: project.status, due: project.dueAt, personal: project.personal },
    { kind: 'cathedral', title: 'Rikets katedral', status: 'active', due: addGameMonths(state.date, WONDER.months), personal: false });
  assert.ok(events.some((event) => event.type === 'wonder_started'));
  assert.deepEqual(streams(after), before);
  assert.equal(action(after).disabledReason, 'Ett underverk byggs redan.');
  assert.equal(build(after, 'palace').ok, false);
  normalizeCharacterSystem(plain(after));
});

test('a finished wonder adds prestige at once and holds it above the floor for good', () => {
  let state = ok(build(court(), 'library')).state;
  const prestige = state.realm.prestige;
  const result = ok(advanceCharacters(state, addGameMonths(state.date, WONDER.months + 12), { id: 'decade' }));
  state = result.state;
  assert.equal(standingWonders(state).length, 1);
  assert.ok(result.events.some((event) => event.type === 'project_completed' && event.title === 'Det stora biblioteket står färdigt'));
  assert.ok(state.realm.prestige >= 10 + WONDER.floor, `prestige ${state.realm.prestige} from ${prestige}`);
  const later = ok(advanceCharacters(state, addGameMonths(state.date, 120), { id: 'later' })).state;
  assert.ok(later.realm.prestige >= 10 + WONDER.floor, 'the wonder still holds prestige ten years on');
  normalizeCharacterSystem(plain(later));
});

test('prestige decays to the floor a wonder lifts, and without one as before', () => {
  const state = court();
  state.realm.prestige = 10;
  prestigeStep(state, 0);
  assert.equal(state.realm.prestige, 10);
  prestigeStep(state, WONDER.floor);
  assert.equal(state.realm.prestige, 10 + WONDER.floor);
  state.realm.prestige = 50;
  prestigeStep(state, WONDER.floor);
  assert.equal(state.realm.prestige, 49);
  state.realm.prestige = 100;
  prestigeStep(state, WONDER.floor * WONDER.max);
  assert.equal(state.realm.prestige, 99);
  standing(state, 'cathedral');
  standing(state, 'palace');
  assert.equal(wonderPrestigeFloor(state), 2 * WONDER.floor);
  delete state.historicalOrigin;
  assert.equal(wonderPrestigeFloor(state), 0, 'a Hadara save never lifts the floor');
});

test('prestige held at the lifted floor pays one legitimacy a year', () => {
  const state = court();
  state.realm.prestige = 10 + WONDER.floor;
  state.realm.legitimacy = 50;
  const paid = state.reign.sources.prestige;
  prestigeStep(state, WONDER.floor);
  assert.equal(state.reign.sources.prestige, paid + 1);
  assert.equal(state.realm.legitimacy, 51);
  assert.equal(state.realm.prestige, 10 + WONDER.floor);
});

test('each kind once, three at most, a real kind, and none in Hadara', () => {
  const state = court();
  standing(state, 'cathedral');
  assert.equal(wonderRefusal(state, 'cathedral'), 'Riket har redan byggt detta underverk.');
  assert.equal(wonderRefusal(state, 'temple'), 'Välj ett underverk.');
  assert.equal(wonderRefusal(state, ['palace']), 'Välj ett underverk.', 'a kind sent as an array is refused');
  assert.equal(build(state, ['palace']).ok, false);
  assert.equal(build(state, undefined).ok, false);
  standing(state, 'palace');
  standing(state, 'library');
  assert.equal(action(state).disabledReason, `Riket har redan ${WONDER.max} underverk.`);
  const hadara = court();
  delete hadara.historicalOrigin;
  assert.equal(action(hadara), undefined);
  assert.match(build(hadara, 'cathedral').error, /historiska kampanjer/);
});

test('a treasury short of the cost refuses the wonder', () => {
  const state = court();
  state.realm.treasury = WONDER.cost - 1;
  assert.equal(build(state, 'palace').ok, false);
});

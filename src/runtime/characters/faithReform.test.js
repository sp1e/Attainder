// The ruler reforms the faith or founds a new one, and the priesthood splits. Spec: docs/superpowers/specs/2026-11-11-faith-reform-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { FAITH_MODES, FAITH_REFORM } from './faithReform.js';
import { regencyVetoForRecord } from './governance.js';
import { hashRoll } from './duels.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const OLD = 'latin-church';
let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result; };
const command = (state, type, payload) => executeCharacterCommand(state, { id: `faith-${++counter}`, expectedRevision: state.revision, type, payload });
const run = (state, mode) => ok(command(state, 'reform_faith', { mode })).state;
const action = (state) => getAvailableCharacterActions(state).find((item) => item.type === 'reform_faith');
const founded = (state) => Object.values(state.religions).filter((faith) => faith.founding);
const others = (state) => Object.values(state.families).filter((family) => family.id !== 'royal-house');
function court() {
  const state = createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  state.actionPoints = 3;
  state.realm.treasury = 500;
  return state;
}
const chance = (state, family, mode) => {
  const opinion = actionHooks(state).getPersonalOpinion(family.headId, 'karl');
  return Math.min(0.95, Math.max(0.05, FAITH_MODES[mode].follow + (opinion >= 20 ? 0.2 : opinion < 0 ? -0.2 : 0)));
};

test('a reform costs 60 silver and an order, converts the ruler\'s house, and splits the other houses by their roll', () => {
  let state = court();
  const before = streams(state), heads = Object.fromEntries(others(state).map((family) => [family.id, chance(state, family, 'reform')]));
  const prestige = state.realm.prestige, legitimacy = state.realm.legitimacy;
  state = run(state, 'reform');
  const [faith] = founded(state);
  assert.match(faith.id, /^faith-/);
  assert.equal(faith.name, 'Den latinska kyrkan (reformerad)');
  assert.deepEqual(faith.founding, { date: state.date, mode: 'reform', fromId: OLD, founderId: 'karl' });
  assert.equal(state.realm.treasury, 500 - FAITH_REFORM.cost);
  assert.equal(state.actionPoints, 2);
  assert.equal(state.families['royal-house'].religionId, faith.id);
  assert.ok(Object.values(state.people).filter((person) => person.familyId === 'royal-house' && !person.diedAt).every((person) => person.religionId === faith.id));
  const followed = others(state).filter((family) => hashRoll(`${faith.id}|${family.id}|follow`) < heads[family.id]);
  assert.deepEqual(others(state).filter((family) => family.religionId === faith.id).map((family) => family.id), followed.map((family) => family.id));
  assert.equal(faith.support, Math.min(70, 30 + 10 * followed.length));
  assert.equal(state.religions[OLD].support, 45);
  for (const family of others(state)) {
    const grudge = state.relations[`${family.headId}:karl`]?.causes.find((cause) => cause.causeId === `faith:${faith.id}`);
    if (followed.includes(family)) assert.equal(grudge, undefined, family.id);
    else assert.deepEqual([grudge.label, grudge.amount, grudge.expiresAt], ['Reformen', -10, addGameMonths(state.date, 240)], family.id);
  }
  assert.equal(state.realm.prestige, prestige + 10);
  assert.equal(state.realm.legitimacy, legitimacy - 5);
  assert.equal(state.log.at(-1).title, 'Den latinska kyrkan (reformerad) grundas');
  assert.equal(state.memories.at(-1).type, 'faith_founded');
  assert.deepEqual(streams(state), before, 'no random stream moves');
});

test('a new faith takes the ruler\'s given name, follows less often, and costs more legitimacy', () => {
  let state = court();
  const [liked, disliked] = others(state);
  actionHooks(state).opinionCause(liked.headId, 'karl', 30, 'Test', 'test-liked', 10);
  actionHooks(state).opinionCause(disliked.headId, 'karl', -10, 'Test', 'test-disliked', 10);
  assert.equal(chance(state, liked, 'found'), 0.45);
  assert.equal(chance(state, disliked, 'found'), 0.05);
  const heads = Object.fromEntries(others(state).map((family) => [family.id, chance(state, family, 'found')]));
  const prestige = state.realm.prestige, legitimacy = state.realm.legitimacy;
  state = run(state, 'found');
  const [faith] = founded(state);
  assert.equal(faith.name, 'Karls lära');
  const followed = others(state).filter((family) => hashRoll(`${faith.id}|${family.id}|follow`) < heads[family.id]);
  assert.deepEqual(others(state).filter((family) => family.religionId === faith.id).map((family) => family.id), followed.map((family) => family.id));
  assert.equal(state.religions[OLD].support, 40);
  const stayed = others(state).find((family) => !followed.includes(family));
  if (stayed) assert.equal(state.relations[`${stayed.headId}:karl`].causes.find((cause) => cause.causeId === `faith:${faith.id}`).label, 'Kätteri vid hovet');
  assert.equal(state.realm.prestige, prestige + 15);
  assert.equal(state.realm.legitimacy, legitimacy - 10);
});

test('a taken name gets a numeral, and a name ending in s takes no extra s', () => {
  let state = court();
  state.religions.extra = { id: 'extra', name: 'Karls lära', support: 50, leaderId: null };
  state = run(state, 'found');
  assert.equal(founded(state)[0].name, 'Karls lära II');
  let other = court();
  other.people.karl.name = 'Hans';
  other = run(other, 'found');
  assert.equal(founded(other)[0].name, 'Hans lära');
});

test('a converted leader leaves the old faith, a headless house stays without a grudge, and other faiths keep theirs', () => {
  let state = court();
  const [headless] = others(state);
  state.people[headless.headId].diedAt = state.date;
  const outsider = Object.values(state.people).find((person) => person.familyId === 'royal-house' && person.id !== 'karl' && !person.diedAt);
  state.religions.other = { id: 'other', name: 'Testtron', support: 50, leaderId: null };
  outsider.religionId = 'other';
  state.religions[OLD].leaderId = 'karl';
  state.religions[OLD].support = 5;
  state = run(state, 'found');
  const [faith] = founded(state);
  assert.equal(state.religions[OLD].leaderId, null);
  assert.equal(state.religions[OLD].support, 1);
  assert.equal(state.families[headless.id].religionId, OLD);
  assert.equal(state.relations[`${headless.headId}:karl`]?.causes.find((cause) => cause.causeId === `faith:${faith.id}`), undefined);
  assert.equal(state.people[outsider.id].religionId, 'other');
  const deciding = others(state).filter((family) => family.id !== headless.id);
  const followed = deciding.filter((family) => family.religionId === faith.id).length;
  assert.equal(state.log.at(-1).description, `Karl (Karl den store) bryter med Den latinska kyrkan. ${followed} ${followed === 1 ? 'familj följer' : 'familjer följer'} härskaren och ${deciding.length - followed} stannar i den gamla tron.`);
});

test('the names end without an extra s after x and z, and numerals run past X', () => {
  for (const [name, expected] of [['Max', 'Max lära'], ['Fritz', 'Fritz lära'], ['Otto (Otto I)', 'Ottos lära']]) {
    let state = court();
    state.people.karl.name = name;
    state = run(state, 'found');
    assert.equal(founded(state)[0].name, expected, name);
  }
  let state = court();
  for (const numeral of ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X']) state.religions[`taken${numeral}`.trim().replace(' ', '-')] = { id: `taken${numeral}`.trim().replace(' ', '-'), name: `Karls lära${numeral}`, support: 50, leaderId: null };
  state = run(state, 'found');
  assert.equal(founded(state)[0].name, 'Karls lära 11');
});

test('a faith founded in the campaign holds the next reform for 30 years', () => {
  let state = court();
  state = run(state, 'reform');
  state.actionPoints = 3;
  assert.match(action(state).disabledReason, /30 år gammal/);
  assert.equal(command(state, 'reform_faith', { mode: 'reform' }).ok, false);
  state.date = addGameMonths(state.date, 12 * 30 - 1);
  assert.match(action(state).disabledReason, /30 år gammal/);
  state.date = addGameMonths(state.date, 1);
  assert.equal(action(state).disabledReason, '');
  state = run(state, 'reform');
  assert.equal(founded(state).at(-1).name, 'Den latinska kyrkan (reformerad) (reformerad)');
});

test('the action offers both ways, a bad mode is refused, and Hadara has no reform', () => {
  let state = court();
  assert.deepEqual(action(state).fields[0].options.map((option) => option.value), ['reform', 'found']);
  const bad = command(state, 'reform_faith', { mode: 'heresy' });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /reformera tron eller grunda/);
  const hadara = court();
  delete hadara.historicalOrigin;
  delete hadara.foreignRealms;
  delete hadara.tribes;
  assert.equal(action(hadara), undefined);
  assert.equal(command(hadara, 'reform_faith', { mode: 'reform' }).ok, false);
});

test('a contested regency stops a reform', () => {
  let state = court();
  const record = { id: 'office:ruler', principalId: state.offices.ruler.holderId, regentId: state.offices.ruler.holderId, phase: 'contested', grants: [] };
  assert.match(regencyVetoForRecord(state, record, 'reform_faith'), /omstridd/);
});

test('saves keep the founding, the religion list shows the year, and a broken founding is refused', () => {
  let state = court();
  state = run(state, 'reform');
  const [faith] = founded(state);
  assert.deepEqual(normalizeCharacterSystem(plain(state)).religions[faith.id].founding, faith.founding);
  assert.equal(getCharacterPresentation(state).religions.find((entry) => entry.id === faith.id).foundedYear, 800);
  assert.equal(getCharacterPresentation(state).religions.find((entry) => entry.id === OLD).foundedYear, undefined);
  for (const broken of [null, { ...faith.founding, mode: 'heresy' }, { ...faith.founding, date: 'igår' }, { ...faith.founding, fromId: 7 }]) {
    const save = plain(state);
    save.religions[faith.id].founding = broken;
    assert.throws(() => normalizeCharacterSystem(save), /Sparfilens trosreform är ogiltig/);
  }
});

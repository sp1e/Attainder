// The priests call a holy war against a neighbor of another faith. Spec: docs/superpowers/specs/2026-11-11-holy-war-design.md.
// The traditions below are test fixtures, not researched values: no shipped package names a faith tradition yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { HOLY_WAR, holyWarCaller, holyWarClosedReason, holyWarStep, holyWarTargets } from './holyWar.js';
import { CLAIM } from './claims.js';
import { foreignOpinion, validateForeignRealms } from './foreignRealms.js';
import { otherFaith } from './faithReform.js';
import { regencyVetoForRecord } from './governance.js';
import { hashRoll } from './duels.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const PAPAL = 'papal-states', CORDOBA = 'emirate-of-cordoba', ASTURIAS = 'kingdom-of-asturias', PRIEST = 'karl-den-yngre';
let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result; };
const command = (state, type, payload) => executeCharacterCommand(state, { id: `holy-${++counter}`, expectedRevision: state.revision, type, payload });
const realmOf = (state, id) => state.foreignRealms.find((realm) => realm.id === id);
const story = (state) => state.stories.find((item) => item.type === 'holy_war_call');
const answer = (state, choiceId) => ok(command(state, 'resolve_story', { storyId: story(state).id, choiceId })).state;
const hooks = (state) => actionHooks(state);

function court(traditions = null) {
  const historicalScenario = plain(DATA.world.historicalScenario);
  for (const [polityId, tradition] of Object.entries(traditions ?? {})) historicalScenario.courtSeeds[polityId].religions[0].tradition = tradition;
  const state = createHistoricalCharacterSystem({ historicalScenario, date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  state.actionPoints = 3;
  state.realm.treasury = 500;
  return state;
}
// Karl founds his own faith, and his heir holds the priest office in it: the Papal States keep the faith Karl left.
function heretic() {
  const state = ok(command(court(), 'reform_faith', { mode: 'found' })).state;
  state.offices.priest.holderId = PRIEST;
  return state;
}
// Moves the plot stream's state, which the step only reads, until the priests call this year.
function call(state) {
  state.date = addGameMonths(state.date, 12);
  for (state.plotRngState = 1; hashRoll(`${state.plotRngState}|${state.date}|holy`) >= HOLY_WAR.call; state.plotRngState++);
  holyWarStep(state, [], hooks(state));
  return story(state);
}

test('each neighbor carries the faith of its court, and no package names a tradition yet', () => {
  const state = court();
  assert.deepEqual(realmOf(state, PAPAL).faith, { id: 'latin-church', name: 'Den latinska kyrkan', tradition: null });
  assert.deepEqual(realmOf(state, CORDOBA).faith.id, 'congregational-mosque-unspecified');
  assert.equal(Object.hasOwn(state.religions['latin-church'], 'tradition'), false);
  assert.deepEqual(holyWarTargets(state, hooks(state)), [], 'without a founded faith or traditions, no neighbor counts as another faith');
});

test('another faith: the faith the ruler broke from, or a different tradition', () => {
  const state = heretic();
  const own = state.people.karl.religionId;
  assert.equal(otherFaith(state, own, realmOf(state, PAPAL).faith), true);
  assert.equal(otherFaith(state, own, realmOf(state, ASTURIAS).faith), false);
  assert.equal(otherFaith(state, own, null), false);
  assert.deepEqual(holyWarTargets(state, hooks(state)).map((realm) => realm.id), [PAPAL]);
  const marked = court({ 'carolingian-realm': 'christian', [ASTURIAS]: 'christian', [CORDOBA]: 'islamic' });
  assert.equal(marked.religions['latin-church'].tradition, 'christian');
  assert.deepEqual(holyWarTargets(marked, hooks(marked)).map((realm) => realm.id), [CORDOBA]);
  const founded = ok(command(marked, 'reform_faith', { mode: 'reform' })).state;
  assert.equal(founded.religions[founded.people.karl.religionId].tradition, 'christian', 'a founded faith keeps the tradition it left');
});

test('the priests call when the year\'s roll falls under 0.15, against a target drawn by hashRoll, and not again for ten years', () => {
  const state = heretic(), before = streams(state);
  const opened = call(state);
  assert.equal(opened.realmId, PAPAL);
  assert.equal(opened.callerId, PRIEST);
  assert.equal(opened.title, 'Prästerna kräver heligt krig mot Kyrkostaten');
  assert.equal(opened.dueAt, addGameMonths(state.date, HOLY_WAR.dueMonths));
  assert.equal(state.log.at(-1).type, 'holy_war_call');
  const moved = streams(state); moved[2] = before[2];
  assert.deepEqual(moved, before, 'no stream but the plot state the test set moves');
  assert.equal(state.lastHolyWarCall, opened.createdAt);
  opened.status = 'resolved';
  state.stories = state.stories.filter((item) => item !== opened);
  for (let year = 1; year < HOLY_WAR.quietYears; year++) assert.equal(call(state), undefined, `a faded story keeps the quiet, year ${year}`);
  state.date = addGameMonths(opened.createdAt, 12 * HOLY_WAR.quietYears - 12);
  assert.notEqual(call(state), undefined);
  assert.equal(state.stories.filter((item) => item.type === 'holy_war_call').length, 1);
});

test('no call without a caller, during a war, or in Hadara', () => {
  const quiet = heretic();
  quiet.offices.priest.holderId = 'karl';
  quiet.religions[quiet.people.karl.religionId].leaderId = null;
  assert.equal(holyWarCaller(quiet, hooks(quiet)), null);
  assert.equal(call(quiet), undefined);
  const warring = heretic();
  realmOf(warring, ASTURIAS).claim = { since: warring.date, readyAt: warring.date, status: 'ready', exposed: false };
  realmOf(warring, ASTURIAS).war = { since: warring.date, score: 0, battles: 0 };
  assert.equal(call(warring), undefined);
  const hadara = heretic();
  delete hadara.historicalOrigin;
  assert.equal(call(hadara), undefined);
});

test('the faith leader calls when the priest holds another faith', () => {
  const state = heretic();
  const faith = state.religions[state.people.karl.religionId];
  state.offices.priest.holderId = 'generated-courtier-3';
  state.people['generated-courtier-3'].religionId = 'latin-church';
  faith.leaderId = PRIEST;
  assert.equal(holyWarCaller(state, hooks(state)).id, PRIEST);
});

test('a holy war starts the border war at once, and the priests and the faith stand behind the ruler', () => {
  const state = heretic();
  call(state);
  const faith = state.people.karl.religionId, support = state.religions[faith].support, opinion = foreignOpinion(state, PAPAL), treasury = state.realm.treasury;
  const after = answer(state, 'declare');
  const papal = realmOf(after, PAPAL);
  assert.equal(after.realm.treasury, treasury - CLAIM.war);
  assert.deepEqual(papal.claim, { since: after.date, readyAt: after.date, status: 'ready', exposed: false });
  assert.deepEqual(papal.war, { since: after.date, score: 0, battles: 0 });
  assert.equal(foreignOpinion(after, PAPAL), opinion + CLAIM.declared.amount);
  assert.equal(after.religions[faith].support, support + HOLY_WAR.support);
  const cause = after.relations[`${PRIEST}:karl`].causes.find((item) => item.label === HOLY_WAR.joined.label);
  assert.deepEqual([cause.amount, cause.expiresAt], [15, addGameMonths(after.date, 240)]);
  assert.ok(after.log.some((event) => event.type === 'war_declared' && event.title === 'Heligt krig mot Kyrkostaten'));
  assert.doesNotThrow(() => validateForeignRealms(after), 'the holy war passes save validation');
});

test('a refusal, or silence past the due date, turns the priest and costs the faith support', () => {
  const state = heretic();
  call(state);
  const faith = state.people.karl.religionId;
  state.religions[faith].support = 5;
  const after = answer(state, 'refuse');
  assert.equal(after.religions[faith].support, HOLY_WAR.supportFloor);
  assert.equal(after.relations[`${PRIEST}:karl`].causes.find((item) => item.label === HOLY_WAR.refused.label).amount, -20);
  assert.equal(realmOf(after, PAPAL).war, undefined);
  const silent = heretic();
  call(silent);
  silent.date = story(silent).dueAt;
  const expired = ok(command(silent, 'rest', {})).state;
  assert.equal(story(expired).choiceId, 'refuse');
  const short = heretic();
  call(short);
  short.realm.treasury = 10;
  const choice = getCharacterPresentation(short).stories.find((item) => item.type === 'holy_war_call').choices.find((item) => item.id === 'declare');
  assert.match(choice.disabledReason, /60 silver/);
});

test('the call falls away when the target is allied or the caller dies, and a regency is not a bar', () => {
  const state = heretic();
  const opened = call(state);
  assert.equal(holyWarClosedReason(state, opened, hooks(state)), '');
  realmOf(state, PAPAL).alliance = { since: state.date, personId: 'karl', spouseId: 'karl' };
  assert.match(holyWarClosedReason(state, opened, hooks(state)), /Målet/);
  realmOf(state, PAPAL).alliance = null;
  realmOf(state, PAPAL).claim = { since: state.date, readyAt: addGameMonths(state.date, 24), status: 'forging', exposed: false };
  assert.match(holyWarClosedReason(state, opened, hooks(state)), /Målet/, 'a claim forged on the target');
  realmOf(state, PAPAL).claim = null;
  realmOf(state, ASTURIAS).claim = { since: state.date, readyAt: state.date, status: 'ready', exposed: false };
  realmOf(state, ASTURIAS).war = { since: state.date, score: 0, battles: 0 };
  assert.match(holyWarClosedReason(state, opened, hooks(state)), /annat krig/);
  realmOf(state, ASTURIAS).war = null; realmOf(state, ASTURIAS).claim = null;
  assert.match(holyWarClosedReason(state, { ...opened, familyId: 'other' }, hooks(state)), /Familjen styrs/);
  assert.match(holyWarClosedReason(state, { ...opened, actorId: 'other' }, hooks(state)), /företräder/);
  state.people[PRIEST].diedAt = state.date;
  assert.match(holyWarClosedReason(state, opened, hooks(state)), /Prästen/);
  const record = { id: 'office:ruler', principalId: state.offices.ruler.holderId, regentId: state.offices.ruler.holderId, phase: 'contested', grants: [] };
  assert.equal(regencyVetoForRecord(state, record, 'holy_war_call'), '');
});

test('the neighbor list names each faith and marks another, and a broken faith is refused on load', () => {
  const state = heretic();
  const shown = getCharacterPresentation(state).foreignRealms;
  assert.deepEqual([shown.find((realm) => realm.id === PAPAL).faithName, shown.find((realm) => realm.id === PAPAL).otherFaith], ['Den latinska kyrkan', true]);
  assert.equal(shown.find((realm) => realm.id === ASTURIAS).otherFaith, false);
  const old = plain(state);
  for (const realm of old.foreignRealms) delete realm.faith;
  assert.equal(normalizeCharacterSystem(old).foreignRealms.every((realm) => !Object.hasOwn(realm, 'faith')), true);
  assert.equal(getCharacterPresentation(normalizeCharacterSystem(old)).foreignRealms[0].faithName, null);
  for (const broken of [{ id: 7, name: 'x', tradition: null }, { id: 'x', name: 'x', tradition: 3 }, 'latin-church']) {
    const save = plain(state);
    save.foreignRealms[0].faith = broken;
    assert.throws(() => normalizeCharacterSystem(save), /Sparfilens grannriken är ogiltiga/);
  }
  const late = plain(state);
  late.lastHolyWarCall = 'igår';
  assert.throws(() => normalizeCharacterSystem(late), /Sparfilens heliga krig är ogiltigt/);
  const save = plain(state);
  save.religions['latin-church'].tradition = 5;
  assert.throws(() => normalizeCharacterSystem(save), /Sparfilens trosreform är ogiltig/);
});

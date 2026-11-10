// A marriage to the neighbor's daughter brings his war. Spec: docs/superpowers/specs/2026-11-10-marriage-alliance-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { ALLIANCE, CALL_OUTCOMES, allianceStep, battleChance, callClosedReason, foreignPartners } from './alliances.js';
import { foreignOpinion } from './foreignRealms.js';
import { hashRoll } from './duels.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const CORDOBA = 'emirate-of-cordoba', BRIDE = 'test-bride', KEY = `${CORDOBA}|${BRIDE}`;
let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result; };
const command = (state, type, payload) => executeCharacterCommand(state, { id: `alliance-${++counter}`, expectedRevision: state.revision, type, payload });
const marry = (state, personId = 'karl', partnerKey = KEY) => command(state, 'foreign_marriage', { personId, partnerKey });
const realmOf = (state, id) => state.foreignRealms.find((realm) => realm.id === id);
const action = (state) => getAvailableCharacterActions(state).find((item) => item.type === 'foreign_marriage');

// Charlemagne's court, with an unmarried daughter of al-Hakam I in Córdoba's record.
function court() {
  const state = createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  const cordoba = realmOf(state, CORDOBA);
  cordoba.people[BRIDE] = { id: BRIDE, name: 'Prova bint al-Hakam', sex: 'female', bornAt: '0782-03-01', diedAt: null, parentIds: ['al-hakam-i'], spouseIds: [], origin: 'documented' };
  return state;
}
function allied() {
  return ok(marry(court())).state;
}
// Moves the plot stream's state, which the step only reads, until the ally calls to war this year.
function call(state) {
  for (state.plotRngState = 1; hashRoll(`${state.plotRngState}|${state.date}|war|${CORDOBA}`) >= ALLIANCE.war; state.plotRngState++);
  allianceStep(state, [], actionHooks(state));
  return state.stories.find((story) => story.type === 'call_to_arms');
}
const answer = (state, storyId, choiceId) => ok(command(state, 'resolve_story', { storyId, choiceId })).state;

test('the ruler marries the daughter of a neighbor: she moves to court and the realms ally', () => {
  const state = court(), treasury = state.realm.treasury, before = streams(state);
  assert.equal(action(state).disabledReason, '');
  assert.ok(action(state).fields[1].options.some((option) => option.value === KEY && option.label === 'Prova bint al-Hakam, 18 år (Emiratet Córdoba)'));
  const { state: after, events } = ok(marry(state));
  const karl = after.people.karl, bride = after.people[karl.spouseId];
  assert.deepEqual({ name: bride.name, family: bride.familyId, spouse: bride.spouseId, origin: bride.identityOrigin }, { name: 'Prova bint al-Hakam', family: 'royal-house', spouse: 'karl', origin: 'generated' });
  assert.equal(after.realm.treasury, treasury - ALLIANCE.cost);
  const cordoba = realmOf(after, CORDOBA);
  assert.equal(Object.hasOwn(cordoba.people, BRIDE), false);
  assert.deepEqual(cordoba.alliance, { since: state.date, personId: 'karl', spouseId: bride.id });
  assert.equal(foreignOpinion(after, CORDOBA), ALLIANCE.bond.amount);
  assert.ok(events.some((event) => event.type === 'foreign_marriage'));
  assert.deepEqual(streams(after), before);
  assert.equal(getCharacterPresentation(after).foreignRealms.find((realm) => realm.id === CORDOBA).allied, true);
  assert.ok(!foreignPartners(after).some((option) => option.value.startsWith(CORDOBA)), 'an ally offers no second match');
  assert.deepEqual(normalizeCharacterSystem(plain(after)).foreignRealms, after.foreignRealms);
});

test('a same-sex match, a distant realm, a married person and Hadara are refused', () => {
  const state = court();
  assert.match(marry(state, 'rotrud').error, /olika kön/);
  assert.match(marry(state, 'karl', 'tang-empire|li-song').error, /grannhus/);
  assert.match(marry(state, 'karl', `${CORDOBA}|al-hakam-i`).error, /grannhus/, 'the ruler is not offered');
  assert.match(marry(state, 'nobody').error, /ogift, myndig/);
  const hadara = court();
  delete hadara.historicalOrigin;
  delete hadara.foreignRealms;
  assert.equal(action(hadara), undefined);
  assert.equal(marry(hadara).ok, false);
});

test('an ally calls to war: joining pays and may win, and the ally remembers', () => {
  const state = allied(), story = call(state);
  assert.deepEqual({ realm: story.realmId, actor: story.actorId, status: story.status }, { realm: CORDOBA, actor: 'karl', status: 'open' });
  const chance = battleChance(actionHooks(state).militaryReadiness());
  while (hashRoll(`${story.id}|${story.seed}|battle`) >= chance) story.seed++;
  const prestige = state.realm.prestige, treasury = state.realm.treasury;
  const after = answer(state, story.id, 'join');
  assert.equal(after.realm.treasury, treasury - ALLIANCE.join);
  assert.equal(after.realm.prestige, prestige + CALL_OUTCOMES.win.prestige);
  assert.equal(foreignOpinion(after, CORDOBA), ALLIANCE.bond.amount + CALL_OUTCOMES.win.memory.amount);
  assert.ok(realmOf(after, CORDOBA).alliance, 'the alliance stands');
  allianceStep(after, [], actionHooks(after));
  assert.equal(after.stories.filter((item) => item.type === 'call_to_arms').length, 1, 'no second call within five years');
});

test('a lost war costs the army and legitimacy', () => {
  const state = allied(), story = call(state);
  const chance = battleChance(actionHooks(state).militaryReadiness());
  while (hashRoll(`${story.id}|${story.seed}|battle`) < chance) story.seed++;
  const army = state.realm.armyStrength;
  const after = answer(state, story.id, 'join');
  assert.equal(after.realm.armyStrength, army + CALL_OUTCOMES.loss.army);
  assert.equal(foreignOpinion(after, CORDOBA), ALLIANCE.bond.amount + CALL_OUTCOMES.loss.memory.amount);
});

test('refusing breaks the alliance, and the betrayal is remembered for thirty years', () => {
  const state = allied(), story = call(state), prestige = state.realm.prestige;
  const after = answer(state, story.id, 'refuse');
  const cordoba = realmOf(after, CORDOBA);
  assert.equal(cordoba.alliance, null);
  assert.equal(after.realm.prestige, Math.max(0, prestige + CALL_OUTCOMES.refuse.prestige));
  assert.equal(foreignOpinion(after, CORDOBA), ALLIANCE.bond.amount + CALL_OUTCOMES.refuse.memory.amount);
  assert.ok(cordoba.memories.some((memory) => memory.label === 'Svek i kriget' && memory.until === addGameMonths(after.date, 360)));
  normalizeCharacterSystem(plain(after));
});

test('a death ends the alliance, and an open call then closes without effect', () => {
  const state = allied(), story = call(state);
  const bride = state.people[state.people.karl.spouseId];
  bride.diedAt = state.date;
  const events = [];
  allianceStep(state, events, actionHooks(state));
  assert.equal(realmOf(state, CORDOBA).alliance, null);
  assert.ok(events.some((event) => event.type === 'alliance_ended'));
  assert.match(callClosedReason(state, story, actionHooks(state)), /Alliansen finns inte/);
});

test('a broken alliance in a save is refused', () => {
  const state = plain(allied());
  realmOf(state, CORDOBA).alliance.spouseId = 'nobody';
  assert.throws(() => normalizeCharacterSystem(state), /grannriken/);
  const unmarried = plain(allied());
  realmOf(unmarried, CORDOBA).alliance.spouseId = 'rotrud';
  assert.throws(() => normalizeCharacterSystem(unmarried), /grannriken/, 'the two must be married to each other');
});

test('without the ruler mandate no call opens, and an open call closes', () => {
  const state = allied(), story = call(state), hooks = actionHooks(state);
  const npc = { ...hooks, canRule: () => false };
  assert.match(callClosedReason(state, story, npc), /mandat/);
  state.stories = state.stories.filter((item) => item.id !== story.id);
  allianceStep(state, [], npc);
  assert.equal(state.stories.some((item) => item.type === 'call_to_arms'), false);
});

test('a family with nobody to marry sees why the action is closed', () => {
  const state = court();
  const outsider = Object.values(state.people).find((person) => !person.diedAt && person.familyId !== 'royal-house');
  for (const person of Object.values(state.people)) if (person.familyId === 'royal-house' && !person.spouseId) person.spouseId = outsider.id;
  assert.match(action(state).disabledReason, /ogift, myndig/);
});

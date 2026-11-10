// Plague reaches the capital: quarantine, prayer or flight. Spec: docs/superpowers/specs/2026-11-10-plague-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { refreshCourtStories } from './court.js';
import { PLAGUE_CHANCE, PLAGUE_CHOICES, PLAGUE_TOLL, plagueChoices, plagueClosedReason, plagueRoll, plagueStep, plagueToll } from './plague.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const RULER = 'karl', HOUSE = 'royal-house';

let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const resolve = (state, storyId, choiceId) => ok(executeCharacterCommand(state, { id: `resolve-${++counter}`, expectedRevision: state.revision, type: 'resolve_story', payload: { storyId, choiceId } }));
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const plagues = (state) => state.stories.filter((story) => story.type === 'plague_outbreak');
const living = (state) => Object.values(state.people).filter((person) => !person.diedAt);

function court() {
  return createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
}
// Moves the plot stream's state, which the onset only reads, until the roll meets `wanted`.
function rollWhere(state, wanted) {
  for (state.plotRngState = 1; !wanted(plagueRoll(state)); state.plotRngState++);
}
function outbreak() {
  const state = court();
  rollWhere(state, (roll) => roll < PLAGUE_CHANCE);
  plagueStep(state, [], actionHooks(state));
  return { state, story: plagues(state)[0] };
}

test('the plague reaches the capital on a low roll, once, and draws nothing', () => {
  const state = court(), events = [];
  rollWhere(state, (roll) => roll < PLAGUE_CHANCE);
  const before = streams(state);
  plagueStep(state, events, actionHooks(state));
  const [story, ...rest] = plagues(state);
  assert.equal(rest.length, 0);
  assert.deepEqual({ id: story.id, actor: story.actorId, family: story.familyId, due: story.dueAt, title: story.title },
    { id: `plague-${state.date}`, actor: RULER, family: HOUSE, due: addGameMonths(state.date, 3), title: 'Pesten når huvudstaden' });
  assert.equal(state.memories.find((memory) => memory.id === story.causeId).type, 'plague_outbreak');
  assert.equal(events.filter((event) => event.type === 'plague_outbreak').length, 1);
  plagueStep(state, [], actionHooks(state));
  assert.equal(plagues(state).length, 1, 'one outbreak at a time');
  assert.deepEqual(streams(state), before);
  normalizeCharacterSystem(plain(state));
});

test('no plague on a high roll, in Hadara, or within fifteen years of the last', () => {
  const high = court();
  rollWhere(high, (roll) => roll >= PLAGUE_CHANCE);
  plagueStep(high, [], actionHooks(high));
  assert.equal(plagues(high).length, 0);
  const hadara = court();
  delete hadara.historicalOrigin;
  rollWhere(hadara, (roll) => roll < PLAGUE_CHANCE);
  plagueStep(hadara, [], actionHooks(hadara));
  assert.equal(plagues(hadara).length, 0);
  const { state, story } = outbreak();
  Object.assign(story, { status: 'resolved', createdAt: addGameMonths(state.date, -179) });
  plagueStep(state, [], actionHooks(state));
  assert.equal(plagues(state).length, 1);
  story.createdAt = addGameMonths(state.date, -180);
  plagueStep(state, [], actionHooks(state));
  assert.equal(plagues(state).length, 2);
});

test('closing the gates costs silver, lowers the toll and angers the other houses', () => {
  const { state, story } = outbreak();
  const purse = state.families[HOUSE].treasury, toll = plagueToll(state, story, 'quarantine');
  assert.ok(toll.sick.length <= plagueToll(state, story, 'none').sick.length);
  const after = resolve(state, story.id, 'quarantine');
  assert.equal(after.families[HOUSE].treasury, purse - PLAGUE_CHOICES.quarantine.silver);
  for (const person of toll.dead) assert.equal(after.people[person.id].deathReason, 'Pesten');
  const head = Object.values(after.families).find((family) => family.id !== HOUSE && family.headId && !after.people[family.headId].diedAt);
  assert.ok(head, 'the fixture has another house with a living head');
  assert.equal(after.relations[`${head.headId}:${RULER}`].causes.find((cause) => cause.label === 'Stängda portar').amount, PLAGUE_CHOICES.quarantine.cause.value);
  assert.ok(after.memories.some((memory) => memory.type === 'plague_toll' && memory.causeId === story.causeId));
  normalizeCharacterSystem(plain(after));
});

test('a survivor keeps 1 health at least; a death goes through succession', () => {
  const { state, story } = outbreak();
  // A seed whose toll has both a survivor and a death.
  const split = () => { const { sick, dead } = plagueToll(state, story, 'none'); return { dead, survivor: sick.find((person) => !dead.includes(person)) }; };
  while (!split().dead.length || !split().survivor) story.seed++;
  const { dead, survivor } = split(), deadIds = new Set(dead.map((person) => person.id));
  state.people[survivor.id].health = PLAGUE_TOLL.health - 5;
  const stress = state.people[survivor.id].stress, events = [];
  refreshCourtStories(state, events, actionHooks(state));
  assert.equal(story.status, 'open', 'the story waits until it is due');
  story.dueAt = state.date;
  refreshCourtStories(state, events, actionHooks(state));
  assert.equal(story.choiceId, 'none');
  assert.deepEqual([state.people[survivor.id].health, state.people[survivor.id].stress], [1, Math.min(200, stress + PLAGUE_TOLL.stress)]);
  for (const id of deadIds) assert.equal(state.people[id].deathReason, 'Pesten');
  normalizeCharacterSystem(plain(state));
});

test('the family that flees is spared and pays in legitimacy and goodwill', () => {
  const { state, story } = outbreak();
  const legitimacy = state.realm.legitimacy, own = living(state).filter((person) => person.familyId === HOUSE).map((person) => person.id);
  const toll = plagueToll(state, story, 'flight');
  assert.ok(toll.sick.every((person) => person.familyId !== HOUSE));
  const after = resolve(state, story.id, 'flight');
  assert.ok(own.every((id) => !after.people[id].diedAt));
  assert.equal(after.realm.legitimacy, Math.max(0, legitimacy + PLAGUE_CHOICES.flight.legitimacy));
  const outsider = living(after).find((person) => person.familyId !== HOUSE && after.relations[`${person.id}:${RULER}`]);
  assert.ok(outsider, 'the fixture has a living outsider');
  assert.equal(after.relations[`${outsider.id}:${RULER}`].causes.find((cause) => cause.label === 'Övergav staden').amount, PLAGUE_CHOICES.flight.cause.value);
});

test('a guest the plague takes after a flight holds no grudge, so none passes to an heir', () => {
  const { state, story } = outbreak();
  const victimId = 'generated-courtier-1';
  while (!plagueToll(state, story, 'flight').dead.some((person) => person.id === victimId)) story.seed++;
  const after = resolve(state, story.id, 'flight');
  assert.equal(after.people[victimId].deathReason, 'Pesten');
  const causes = Object.values(after.relations).flatMap((rel) => rel.causes.map((cause) => ({ ...cause, fromId: rel.fromId })));
  assert.ok(!causes.some((cause) => cause.fromId === victimId && cause.label === PLAGUE_CHOICES.flight.cause.label));
  assert.ok(!causes.some((cause) => cause.label.startsWith(`${PLAGUE_CHOICES.flight.cause.label} (ärvt`)));
});

test('the ruler dying of the plague hands on the crown, and prayer still counts for the realm', () => {
  const { state, story } = outbreak();
  while (!plagueToll(state, story, 'prayer').dead.some((person) => person.id === RULER)) story.seed++;
  const after = resolve(state, story.id, 'prayer');
  assert.equal(after.people[RULER].deathReason, 'Pesten');
  assert.notEqual(after.offices.ruler.holderId, RULER);
  assert.ok(after.realm.legitimacy >= PLAGUE_CHOICES.prayer.legitimacy);
  assert.ok(after.memories.some((memory) => memory.type === 'plague_toll' && memory.participants.includes(RULER)));
  normalizeCharacterSystem(plain(after));
});

test('the outbreak closes without effect when the representative changes or the family is lost', () => {
  const { state, story } = outbreak();
  const hooks = actionHooks(state);
  assert.equal(plagueClosedReason(state, story, hooks), '');
  assert.match(plagueClosedReason(state, story, { ...hooks, activeRepresentative: () => state.people['karl-den-yngre'] }), /företräder inte längre/);
  assert.match(plagueClosedReason(state, story, { ...hooks, controlledFamily: () => null }), /styrs inte längre/);
});

test('prayer and the gates need silver; prayer lifts legitimacy and eases the representative', () => {
  const { state, story } = outbreak();
  state.families[HOUSE].treasury = PLAGUE_CHOICES.prayer.silver;
  const reasons = Object.fromEntries(plagueChoices(state, story).map((choice) => [choice.id, choice.disabledReason]));
  assert.deepEqual(reasons, { quarantine: `Det behövs ${PLAGUE_CHOICES.quarantine.silver} silver ur familjens kassa.`, prayer: '', flight: '' });
  const legitimacy = state.realm.legitimacy;
  state.people[RULER].stress = 40;
  const after = resolve(state, story.id, 'prayer');
  assert.equal(after.realm.legitimacy, Math.min(100, legitimacy + PLAGUE_CHOICES.prayer.legitimacy));
  if (!after.people[RULER].diedAt) assert.ok(after.people[RULER].stress <= 40 - PLAGUE_CHOICES.prayer.stress + PLAGUE_TOLL.stress);
});

// A choice from ten years earlier comes back. Spec: docs/superpowers/specs/2026-11-10-decision-echo-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { refreshCourtStories } from './court.js';
import { ECHO_AMENDS_SILVER, ECHO_MIN, echoChoices, echoStep } from './echoes.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const RULER = 'karl', HEIR = 'karl-den-yngre', OUTSIDER = 'generated-courtier-1', HOUSE = 'royal-house';

let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const resolve = (state, storyId, choiceId) => ok(executeCharacterCommand(state, { id: `resolve-${++counter}`, expectedRevision: state.revision, type: 'resolve_story', payload: { storyId, choiceId } }));
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const echoes = (state) => state.stories.filter((story) => story.type === 'decision_echo');
const causeOf = (state, fromId, label) => state.relations[`${fromId}:${RULER}`]?.causes.find((cause) => cause.label === label);

// A decision Karl made `months` ago that moved `witness` by `amount`, as resolveDirectedStory leaves it.
function decided(state, { witness = OUTSIDER, amount = 10, months = 120, type = 'story_choice', decider = RULER } = {}) {
  const id = `memory-fixture-${++counter}`, date = addGameMonths(state.date, -months);
  state.memories.push({ id, date, type, title: 'Templets bön: Skänk silver', participants: [witness, decider], causeId: null, knownBy: 'public', familyIds: [] });
  const key = `${witness}:${decider}`;
  state.relations[key] ??= { fromId: witness, toId: decider, bonds: [], causes: [] };
  state.relations[key].causes.push({ id: `opinion-fixture-${counter}`, amount, label: 'Skänk silver', causeId: id, startAt: date, expiresAt: addGameMonths(date, 120) });
  return id;
}
function court() {
  return createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
}
function echoed(fields = {}) {
  const state = court();
  decided(state, fields);
  echoStep(state, [], actionHooks(state));
  return { state, story: echoes(state)[0] };
}

test('a kind decision from ten years ago comes back once, with the witness, and draws nothing', () => {
  const state = court(), memoryId = decided(state), before = streams(state), events = [];
  echoStep(state, events, actionHooks(state));
  const [story, ...rest] = echoes(state);
  assert.equal(rest.length, 0);
  assert.deepEqual({ id: story.id, tone: story.tone, carrier: story.carrierId, actor: story.actorId, cause: story.causeId, due: story.dueAt },
    { id: `echo-${memoryId}`, tone: 'kind', carrier: OUTSIDER, actor: RULER, cause: memoryId, due: addGameMonths(state.date, 6) });
  assert.equal(story.title, `${state.people[OUTSIDER].name} minns ett beslut från 790`);
  assert.match(story.description, /^För tio år sedan beslutade Karl \(Karl den store\): ”Templets bön: Skänk silver”\./);
  assert.equal(events.filter((event) => event.type === 'decision_echo').length, 1);
  echoStep(state, [], actionHooks(state));
  assert.equal(echoes(state).length, 1, 'one open echo at a time');
  assert.deepEqual(streams(state), before);
  normalizeCharacterSystem(plain(state));
});

test('no echo in Hadara, outside the eleventh year, below the threshold, or for another house\'s decision', () => {
  const none = (fields, edit = () => {}) => { const state = court(); edit(state); decided(state, fields); echoStep(state, [], actionHooks(state)); return echoes(state).length; };
  assert.equal(none({}, (state) => { delete state.historicalOrigin; }), 0);
  assert.equal(none({ months: 119 }), 0);
  assert.equal(none({ months: 132 }), 0);
  assert.equal(none({ months: 131 }), 1);
  assert.equal(none({ amount: ECHO_MIN - 1 }), 0);
  assert.equal(none({ type: 'gift' }), 0);
  assert.equal(none({ amount: -ECHO_MIN }), 1);
  assert.equal(none({ decider: 'generated-courtier-2' }), 0);
  const crowned = court();
  decided(crowned, { witness: RULER, decider: HEIR });
  echoStep(crowned, [], actionHooks(crowned));
  const carrier = crowned.people[echoes(crowned)[0].carrierId];
  assert.ok(carrier.legalParentIds.includes(RULER) && ![RULER, HEIR].includes(carrier.id), 'a child other than the decider carries what the ruler remembers');
});

test('a dead witness passes the memory to the eldest free adult legal child', () => {
  const state = court();
  decided(state);
  actionHooks(state).kill([OUTSIDER], [], 'Prov');
  for (const id of ['generated-courtier-3', 'generated-courtier-2']) state.people[id].legalParentIds = [OUTSIDER];
  echoStep(state, [], actionHooks(state));
  const [story] = echoes(state), witness = state.people[OUTSIDER].name, child = state.people['generated-courtier-2'].name;
  assert.equal(story.carrierId, 'generated-courtier-2');
  assert.ok(story.description.includes(`${witness} är död, men ${child} bär minnet vidare.`));
  normalizeCharacterSystem(plain(state));
});

test('a stronger cause whose witness cannot carry it gives way to the next, and a shielded child to the next child', () => {
  const state = court(), memoryId = decided(state, { amount: 6 });
  state.relations['generated-courtier-3:karl'] = { fromId: 'generated-courtier-3', toId: RULER, bonds: [], causes: [{ id: 'opinion-fixture-dead', amount: 20, label: 'Prov', causeId: memoryId, startAt: state.date, expiresAt: null }] };
  actionHooks(state).kill(['generated-courtier-3'], [], 'Prov');
  echoStep(state, [], actionHooks(state));
  assert.deepEqual(echoes(state).map((story) => story.carrierId), [OUTSIDER]);
  const shielded = court();
  decided(shielded);
  actionHooks(shielded).kill([OUTSIDER], [], 'Prov');
  for (const id of [RULER, 'generated-courtier-2']) shielded.people[id].legalParentIds = [OUTSIDER];
  echoStep(shielded, [], actionHooks(shielded));
  assert.deepEqual(echoes(shielded).map((story) => story.carrierId), ['generated-courtier-2']);
});

test('the strongest decision wins, and the court waits three years after an echo', () => {
  const state = court();
  decided(state, { amount: 6 });
  const strong = decided(state, { witness: HEIR, amount: -12, months: 125 });
  echoStep(state, [], actionHooks(state));
  assert.deepEqual(echoes(state).map((story) => [story.causeId, story.tone]), [[strong, 'harsh']]);
  const after = resolve(state, echoes(state)[0].id, 'stand');
  const later = (months) => { const copy = plain(after); copy.date = addGameMonths(after.date, months); decided(copy); echoStep(copy, [], actionHooks(copy)); return echoes(copy).length; };
  assert.equal(later(35), 1);
  assert.equal(later(36), 2);
});

test('a kind echo is welcomed or cashed in, and an unanswered one is welcomed', () => {
  const { state, story } = echoed();
  assert.deepEqual(echoChoices(state, story, actionHooks(state)).map((choice) => choice.id), ['embrace', 'ask']);
  const influence = state.families[HOUSE].influence;
  const asked = resolve(state, story.id, 'ask');
  assert.equal(asked.families[HOUSE].influence, influence + 8);
  assert.equal(causeOf(asked, OUTSIDER, 'Gentjänsten är utkrävd').amount, -5);
  state.date = story.dueAt;
  refreshCourtStories(state, [], actionHooks(state));
  assert.deepEqual([story.status, story.choiceId], ['resolved', 'embrace']);
  assert.equal(causeOf(state, OUTSIDER, 'Ett minne från tio år sedan').amount, 15);
});

test('a harsh echo can be paid off, apologised for or left standing, which is also its default', () => {
  const { state, story } = echoed({ amount: -10 });
  assert.deepEqual(echoChoices(state, story, actionHooks(state)).map((choice) => choice.id), ['amends', 'apologize', 'stand']);
  state.families[HOUSE].treasury = ECHO_AMENDS_SILVER - 1;
  assert.equal(echoChoices(state, story, actionHooks(state))[0].disabledReason, `Det behövs ${ECHO_AMENDS_SILVER} silver ur familjens kassa.`);
  state.families[HOUSE].treasury = 100;
  const paid = resolve(state, story.id, 'amends');
  assert.equal(paid.families[HOUSE].treasury, 100 - ECHO_AMENDS_SILVER);
  assert.equal(causeOf(paid, OUTSIDER, 'Gottgjort').amount, 20);
  const sorry = resolve(state, story.id, 'apologize');
  assert.equal(sorry.families[HOUSE].influence, state.families[HOUSE].influence - 5);
  state.date = story.dueAt;
  refreshCourtStories(state, [], actionHooks(state));
  assert.deepEqual([story.status, story.choiceId], ['resolved', 'stand']);
  assert.equal(causeOf(state, OUTSIDER, 'Ett gammalt agg').amount, -15);
  normalizeCharacterSystem(plain(state));
});

test('an echo closes without effect when its carrier dies or the player leaves the family that decided', () => {
  const { state, story } = echoed();
  state.people[OUTSIDER].diedAt = state.date;
  refreshCourtStories(state, [], actionHooks(state));
  assert.deepEqual([story.status, story.resolution], ['closed', 'Den som bar minnet kan inte längre föra det vidare.']);
  const other = echoed();
  other.story.familyId = 'generated-house-2';
  refreshCourtStories(other.state, [], actionHooks(other.state));
  assert.deepEqual([other.story.status, other.story.resolution], ['closed', 'Familjen som fattade beslutet styrs inte längre av spelaren.']);
});

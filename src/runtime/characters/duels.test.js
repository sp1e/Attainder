// The heir challenges a rival to a duel. Spec: docs/superpowers/specs/2026-11-10-duel-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { refreshCourtStories } from './court.js';
import { DUEL_CHAMPION_SILVER, DUEL_DEATH, DUEL_HATRED, duelChoices, duelStep, hashRoll, resolveDuel, winChance } from './duels.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const HEIR = 'karl-den-yngre', RIVAL = 'generated-courtier-1', BROTHER = 'pippin-av-italien', HOUSE = 'royal-house';

let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const resolve = (state, storyId, choiceId) => ok(executeCharacterCommand(state, { id: `resolve-${++counter}`, expectedRevision: state.revision, type: 'resolve_story', payload: { storyId, choiceId } }));
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const duels = (state) => state.stories.filter((story) => story.type === 'duel_challenge');
function grudge(state, fromId, toId, amount) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  state.relations[key].causes.push({ id: `fixture-${++counter}`, amount, label: 'Prov', causeId: `fixture-${counter}`, startAt: state.date, expiresAt: null });
}

// Karl's court on Christmas Day 800, where Karl den yngre hates the head of Hovhus 1 at −60.
function court({ hatred = -60 } = {}) {
  const state = createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  grudge(state, HEIR, RIVAL, hatred);
  return state;
}
function challenged(fields = {}) {
  const state = court(fields);
  duelStep(state, [], actionHooks(state));
  return { state, story: duels(state)[0] };
}
// A copy of the story under an id whose hash rolls meet `wanted`, so a test can pick the outcome.
function withRolls(state, story, wanted) {
  for (let n = 0; ; n++) {
    const id = `${story.id}-${n}`;
    if (wanted(hashRoll(`${id}|win`), hashRoll(`${id}|wound`))) { story.id = id; return story; }
  }
}

test('the heir challenges the most hated rival outside the house, once, and draws nothing', () => {
  const state = court(), before = streams(state), events = [];
  duelStep(state, events, actionHooks(state));
  const [story, ...rest] = duels(state);
  assert.equal(rest.length, 0);
  assert.deepEqual({ heir: story.heirId, rival: story.rivalId, actor: story.actorId, status: story.status, due: story.dueAt }, { heir: HEIR, rival: RIVAL, actor: 'karl', status: 'open', due: addGameMonths(state.date, 3) });
  assert.equal(story.title, `Karl den yngre utmanar ${state.people[RIVAL].name} på duell`);
  assert.equal(events.filter((event) => event.type === 'duel_challenge').length, 1);
  duelStep(state, [], actionHooks(state));
  assert.equal(duels(state).length, 1, 'one open duel at a time');
  assert.deepEqual(streams(state), before);
  normalizeCharacterSystem(plain(state));
});

test('no challenge in Hadara, above the hatred threshold, or against a rival of the heir\'s own house', () => {
  const hadara = court();
  delete hadara.historicalOrigin;
  duelStep(hadara, [], actionHooks(hadara));
  assert.equal(duels(hadara).length, 0);
  const mild = court({ hatred: DUEL_HATRED + 1 });
  duelStep(mild, [], actionHooks(mild));
  assert.equal(duels(mild).length, 0);
  const kin = court({ hatred: 0 });
  grudge(kin, HEIR, BROTHER, -80);
  duelStep(kin, [], actionHooks(kin));
  assert.equal(duels(kin).length, 0);
  const own = court();
  duelStep(own, [], { ...actionHooks(own), activeRepresentative: () => own.people[HEIR] });
  assert.equal(duels(own).length, 0, 'an heir who decides for the family is never asked');
});

test('the court waits five years after a challenge before the next', () => {
  const { state: start, story } = challenged(), state = resolve(start, story.id, 'forbid');
  const later = (months) => { const copy = plain(state); copy.date = addGameMonths(state.date, months); duelStep(copy, [], actionHooks(copy)); return duels(copy).length; };
  assert.equal(later(59), 1);
  assert.equal(later(60), 2);
});

test('forbidding the duel stresses the heir and turns the heir against the ruler', () => {
  const { state, story } = challenged(), stress = state.people[HEIR].stress;
  const after = resolve(state, story.id, 'forbid');
  assert.equal(after.people[HEIR].stress, stress + 20);
  const cause = after.relations[`${HEIR}:karl`].causes.find((item) => item.label === 'Förbjuden duell');
  assert.equal(cause.amount, -20);
  const memory = after.memories.find((item) => item.id === cause.causeId);
  assert.deepEqual([memory?.type, memory?.title, memory?.participants], ['duel_forbidden', 'Förbjuden duell', [HEIR, 'karl']], 'the opinion cites a memory of the refusal');
  assert.equal(after.people[RIVAL].diedAt, null);
  assert.equal(duels(after)[0].status, 'resolved');
  const choice = after.log.at(-1);
  assert.equal(choice.type, 'choice');
  assert.deepEqual(choice.participants, [...new Set(choice.participants)], 'the chronicle names each person once');
});

test('the fighter wins by the hashed roll against the prowess chance, and a loser who lives is injured and resentful', () => {
  const { state, story } = challenged(), hooks = actionHooks(state), before = streams(state);
  const heir = state.people[HEIR], rival = state.people[RIVAL];
  withRolls(state, story, (win, wound) => win < winChance(heir, rival) && wound >= DUEL_DEATH);
  const events = [];
  resolveDuel(state, story, 'allow', events, hooks);
  assert.equal(rival.diedAt, null);
  assert.deepEqual(rival.healthConditions.filter((c) => c.kind === 'injury').map((c) => [c.severity, c.stage]), [[2, 'active']]);
  assert.ok(events.some((event) => event.type === 'duel' && event.title === `Karl den yngre besegrar ${rival.name} i en duell`));
  assert.equal(state.relations[`${RIVAL}:${HEIR}`].causes.find((c) => c.label === 'Duellen').amount, -30);
  assert.deepEqual(streams(state), before, 'the fight draws from no stream');
  normalizeCharacterSystem(plain(state));
});

test('a loser who falls dies of the duel, and the heir can be the one who falls', () => {
  const { state, story } = challenged();
  const heir = state.people[HEIR], rival = state.people[RIVAL];
  withRolls(state, story, (win, wound) => win >= winChance(heir, rival) && wound < DUEL_DEATH);
  resolveDuel(state, story, 'allow', [], actionHooks(state));
  assert.equal(heir.diedAt, state.date);
  assert.equal(heir.deathReason, 'Föll i en duell');
  const memory = state.memories.find((item) => item.type === 'duel');
  assert.deepEqual([memory?.title, memory?.participants], [`${rival.name} besegrar Karl den yngre i en duell`, [RIVAL, HEIR]], 'the fight is remembered when the loser falls');
  assert.equal(story.status, 'resolved');
  normalizeCharacterSystem(plain(state));
});

test('a champion needs a better fighter in the family and the silver, and fights in the heir\'s place', () => {
  const { state, story } = challenged();
  for (const person of Object.values(state.people)) if (person.familyId === HOUSE && person.skills) person.skills.prowess = Math.min(person.skills.prowess, 3);
  state.people[HEIR].skills.prowess = 5;
  assert.equal(duelChoices(state, story, actionHooks(state)).find((c) => c.id === 'champion').disabledReason, 'Ingen i familjen strider bättre än arvingen.');
  state.people[BROTHER].skills.prowess = 12;
  state.families[HOUSE].treasury = DUEL_CHAMPION_SILVER - 1;
  assert.equal(duelChoices(state, story, actionHooks(state)).find((c) => c.id === 'champion').disabledReason, `Det behövs ${DUEL_CHAMPION_SILVER} silver ur familjens kassa.`);
  state.families[HOUSE].treasury = 100;
  const pick = duelChoices(state, story, actionHooks(state)).find((c) => c.id === 'champion');
  assert.equal(pick.label, 'Sänd Pippin av Italien som kämpe');
  const events = [];
  resolveDuel(state, story, 'champion', events, actionHooks(state));
  assert.equal(state.families[HOUSE].treasury, 100 - DUEL_CHAMPION_SILVER);
  const fight = events.find((event) => event.type === 'duel');
  assert.ok(fight.participants.includes(BROTHER) && !fight.participants.includes(HEIR));
});

test('an unanswered challenge goes ahead, and a duel whose rival dies closes without a fight', () => {
  const { state, story } = challenged();
  state.date = story.dueAt;
  refreshCourtStories(state, [], actionHooks(state));
  assert.deepEqual([story.status, story.choiceId], ['resolved', 'allow']);
  const other = challenged();
  other.state.people[RIVAL].diedAt = other.state.date;
  refreshCourtStories(other.state, [], actionHooks(other.state));
  assert.equal(other.story.status, 'closed');
  assert.equal(other.story.resolution, 'En av duellanterna kan inte längre strida.');
});

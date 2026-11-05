import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { chancellorYield, readerIntrigue, serviceOf } from './council.js';
import { dreadOf } from './dread.js';
import { spymasterOf } from './extensions.js';
import { isImprisoned } from './prisoners.js';
import { MAX_ACTIVE_GOALS } from './reign.js';

// One playthrough of ten years on Normal sees each court system at least once. playYear is a scripted player: it never looks at a seed and never adapts to a result.
// A step the script cannot take, for want of a target or an order, is simply left out that year. A reign can end on the way, so each step reads the current ruler and family.
// One run per seed serves every assertion, because ten years of a campaign take a while.

const SEEDS = [104729, 321, 777, 1234, 9001, 271828, 314159, 20261104];
const YEARS = 10;
const NAMARS = 'family-namar';
const LATER_GOALS = ['fill_treasury', 'strong_army', 'reconcile_houses', 'cow_nobles'];
const ULTIMATUM_SEEDS = 5;
const DREAD_SEEN = 15;
const LOW_LOYALTY = 10;

const plain = (value) => JSON.parse(JSON.stringify(value));
const content = ({ revision, appliedCommandIds, ...rest }) => rest;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const byIntrigue = (a, b) => b.skills.intrigue - a.skills.intrigue || a.id.localeCompare(b.id, 'en', { numeric: true });

// A refusal changes nothing and the script moves on.
function order(turn, step, type, payload) {
  const result = executeCharacterCommand(turn.state, { id: `balance:${turn.year}:${step}`, expectedRevision: turn.state.revision, type, payload });
  if (result.ok) turn.state = result.state;
}

const livingAdults = (state, hooks) => Object.values(state.people).filter((person) => !person.diedAt && hooks.adult(person));

function fillSpymaster(turn) {
  const { state } = turn, hooks = actionHooks(state);
  if (spymasterOf(state)) return;
  const familyId = hooks.controlledFamily()?.id, rulerId = hooks.ruler()?.id;
  const [person] = livingAdults(state, hooks).filter((item) => item.familyId === familyId && item.id !== rulerId).sort(byIntrigue);
  if (person) order(turn, 'spymaster', 'appoint', { officeId: 'spymaster', personId: person.id });
}

function firstYear(turn) {
  order(turn, 'full-council', 'set_reign_goal', { goalType: 'full_council' });
  order(turn, 'reward', 'reward_councillor', { officeId: 'general' });
}

function nextGoal(turn) {
  const { state } = turn, { goals } = state.reign;
  if (goals.filter((goal) => goal.status === 'active').length >= MAX_ACTIVE_GOALS || state.actionPoints < 1) return;
  const goalType = LATER_GOALS.find((id) => !goals.some((goal) => goal.type === id));
  if (goalType) order(turn, 'goal', 'set_reign_goal', { goalType });
}

function rumor(turn) {
  const { state } = turn, hooks = actionHooks(state);
  const actor = hooks.activeRepresentative(), familyId = hooks.controlledFamily()?.id;
  const target = livingAdults(state, hooks).find((person) => person.familyId !== familyId);
  if (actor && target && state.actionPoints > 0) order(turn, 'rumor', 'attempt_action', { actionId: 'spread_rumor', actorId: actor.id, targetIds: [target.id], means: { topic: 'plot' } });
}

const namarPrisoners = (state, status) => state.prisoners.filter((prisoner) => prisoner.status === status && state.people[prisoner.personId].familyId === NAMARS);

// An arrest can fail, so the script tries again each year until a Namar is held. It executes that one and leaves the family alone.
function jailAndExecute(turn) {
  if (namarPrisoners(turn.state, 'executed').length) return;
  const hooks = actionHooks(turn.state), actor = hooks.activeRepresentative();
  const target = livingAdults(turn.state, hooks).find((person) => person.familyId === NAMARS && !isImprisoned(turn.state, person.id));
  if (!namarPrisoners(turn.state, 'held').length && actor && target) order(turn, 'imprison', 'attempt_action', { actionId: 'imprison', actorId: actor.id, targetIds: [target.id], means: {} });
  const [prisoner] = namarPrisoners(turn.state, 'held');
  if (prisoner) order(turn, 'execute', 'execute_prisoner', { prisonerId: prisoner.id });
}

const enabled = (story) => story.choices.filter((choice) => !choice.disabledReason);
const answered = (state) => state.familyDemands.filter((demand) => demand.status === 'granted' || demand.status === 'refused').length;
const NAMED_CHOICES = Object.freeze({ family_demand: (state) => (answered(state) % 2 ? 'refuse' : 'grant'), stress_crisis: () => 'support', stress_breakdown: () => 'withdraw', faction_ultimatum: () => 'concede' });

// A named choice that is not enabled leaves the story open. An ultimatum the crown cannot pay for runs out that way.
function choiceFor(state, story) {
  const named = NAMED_CHOICES[story.type]?.(state);
  return enabled(story).find((choice) => !named || choice.id === named)?.id ?? null;
}

function answerStories(turn) {
  for (const { id } of getCharacterPresentation(turn.state).stories) {
    const story = getCharacterPresentation(turn.state).stories.find((item) => item.id === id && item.status === 'open');
    const choiceId = story ? choiceFor(turn.state, story) : null;
    if (choiceId) order(turn, id, 'resolve_story', { storyId: id, choiceId });
  }
}

/** The scripted player's year: every step is a command, and the stories come last. */
function playYear(state, year) {
  const turn = { state, year };
  fillSpymaster(turn);
  if (year === 1) firstYear(turn);
  nextGoal(turn);
  rumor(turn);
  if (year >= 3) jailAndExecute(turn);
  answerStories(turn);
  return turn.state;
}

function advanceYear(start, year, monthly) {
  let state = start;
  for (let month = 1; monthly && month < 12; month++) state = ok(advanceCharacters(state, addGameMonths(start.date, month), { id: `balance:${year}:month:${month}` }));
  return ok(advanceCharacters(state, addGameMonths(start.date, 12), { id: `balance:${year}:turn` }));
}

const SYSTEMS = Object.freeze({
  nickname: (state) => state.nicknames.length > 0,
  'reign goal': (state) => state.log.some((item) => item.title.startsWith('Regeringsmålet uppnått')),
  breakdown: (state) => state.stories.some((story) => story.type === 'stress_breakdown'),
  dread: (state, hooks) => dreadOf(state, hooks) >= DREAD_SEEN,
  'granted demand': (state) => state.familyDemands.some((demand) => demand.status === 'granted'),
  faction: (state) => state.factions.some((faction) => faction.knownMemberIds.length > 0 || faction.ultimatumAt !== null),
  spymaster: (state, hooks) => serviceOf(state, 'spymaster', hooks) !== null,
  chancellor: (state, hooks) => chancellorYield(state, hooks) !== 0,
});

function campaign(seed, { monthly = false, spymasterLoyalty = null } = {}) {
  let state = createCharacterSystem({ seed });
  const seen = new Set(), intrigue = [];
  const look = () => {
    const hooks = actionHooks(state);
    for (const [name, fires] of Object.entries(SYSTEMS)) if (fires(state, hooks)) seen.add(name);
    if (state.stories.some((story) => story.type === 'faction_ultimatum')) seen.add('ultimatum');
  };
  for (let year = 1; year <= YEARS && !state.status.ended; year++) {
    state = playYear(state, year);
    if (spymasterLoyalty !== null && spymasterOf(state)) state.people[spymasterOf(state).id].loyalty = spymasterLoyalty;
    look();
    intrigue.push(readerIntrigue(state, actionHooks(state)));
    state = advanceYear(state, year, monthly);
    look();
  }
  return { state, seen, intrigue };
}

const runs = new Map();
function run(seed) {
  if (!runs.has(seed)) runs.set(seed, campaign(seed));
  return runs.get(seed);
}

test('one playthrough of ten years on Normal sees each system at least once', () => {
  assert.deepEqual(SEEDS.flatMap((seed) => Object.keys(SYSTEMS).filter((system) => !run(seed).seen.has(system)).map((system) => `${seed}: ${system}`)), []);
});

test('most seeds see a faction ultimatum within ten years', () => {
  const seeds = SEEDS.filter((seed) => run(seed).seen.has('ultimatum'));
  assert.ok(seeds.length >= ULTIMATUM_SEEDS, `ultimatum in ${seeds.join(', ')}`);
});

test('the final state survives a save, and a whole-year and a month-by-month replay end equal', () => {
  const [seed] = SEEDS, { state } = run(seed);
  assert.deepEqual(normalizeCharacterSystem(plain(state)), state);
  assert.deepEqual(content(campaign(seed, { monthly: true }).state), content(state));
});

test('a spymaster of low loyalty reads worse than the same spymaster at ease', () => {
  const [seed] = SEEDS, [faithful] = run(seed).intrigue, [forced] = campaign(seed, { spymasterLoyalty: LOW_LOYALTY }).intrigue;
  assert.ok(forced < faithful, `${forced} against ${faithful}`);
});

// The physician's prognosis and the deathbed. Spec: docs/superpowers/specs/2026-11-09-deathbed-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, createCharacterSystem, executeCharacterCommand, getPersonalOpinion } from './index.js';
import { ageDeathRisk } from './health.js';
import { ensureStaff } from './courtStaff.js';
import { COURT_STORY_TYPES, refreshCourtStories } from './court.js';
import { deathRisk, deathbedStep, prognosis } from './deathbed.js';

const REP = 'person-0-0';
const HEIR = 'person-0-2';
const GRANDCHILD = 'person-0-5';
const ENEMY = 'person-1-0';
const OWN = 'family-arel';

const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const resolve = (state, storyId, choiceId) => ok(executeCharacterCommand(state, { id: `resolve-${++counter}`, expectedRevision: state.revision, type: 'resolve_story', payload: { storyId, choiceId } }));
const open = (state) => state.stories.filter((story) => story.type === 'deathbed' && story.status === 'open');
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
// The representative at 75 with full health: a yearly risk of 0.12.
function aged(state = base()) { state.people[REP].bornAt = addGameMonths(state.date, -75 * 12); state.people[REP].health = 100; return state; }
function dying() { const state = aged(); deathbedStep(state, [], actionHooks(state)); return { state, story: open(state)[0] }; }
const choice = (state, story, id) => executeCharacterCommand(state, { id: 'peek', expectedRevision: state.revision, type: 'resolve_story', payload: { storyId: story.id, choiceId: id } });
function grudge(state, fromId, toId, amount) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  state.relations[key].causes.push({ id: `fixture-${++counter}`, amount, label: 'Prov', causeId: `fixture-${counter}`, startAt: state.date, expiresAt: null });
}

test('the yearly risk is the age band plus the health term, and an active illness adds its fatal risk', () => {
  assert.equal(ageDeathRisk(75, 100), 0.12);
  assert.equal(ageDeathRisk(30, 60), 0.002 + 40 * 0.0005);
  assert.equal(ageDeathRisk(96, 10), 1 + 90 * 0.0005);
  const state = aged();
  assert.equal(deathRisk(state, state.people[REP]), 0.12);
  state.people[REP].healthConditions.push({ id: 'c-1', kind: 'smallpox', stage: 'active', severity: 2, startedAt: state.date, outcomeRoll: 0.5, scarRoll: 0.5 });
  assert.ok(Math.abs(deathRisk(state, state.people[REP]) - (0.12 + 0.024)) < 1e-12);
  state.people[REP].bornAt = addGameMonths(state.date, -96 * 12);
  assert.equal(deathRisk(state, state.people[REP]), 1);
});

test('the physician sets how exact the prognosis is', () => {
  const state = aged();
  assert.equal(prognosis(state, state.people[REP]), 'påtaglig', 'no physician: three words');
  const physician = ensureStaff(state, OWN, 'physician');
  assert.equal(prognosis(state, state.people[REP]), '10–20 %', 'learning 10: five brackets');
  physician.skills.learning = 12;
  assert.equal(prognosis(state, state.people[REP]), '12 %');
});

test('the deathbed opens for the representative at a risk of 0.12, once, and not again within five years', () => {
  const young = base();
  deathbedStep(young, [], actionHooks(young));
  assert.equal(open(young).length, 0, 'a risk below 0.12');
  const { state, story } = dying();
  assert.deepEqual({ actorId: story.actorId, dueAt: story.dueAt }, { actorId: REP, dueAt: addGameMonths(state.date, 6) });
  assert.match(story.description, /Läkaren bedömer risken att Arel av Hadara dör inom ett år som påtaglig\./);
  deathbedStep(state, [], actionHooks(state));
  assert.equal(open(state).length, 1);
  const rested = resolve(state, story.id, 'rest');
  deathbedStep(rested, [], actionHooks(rested));
  assert.equal(open(rested).length, 0, 'within five years');
  assert.ok(COURT_STORY_TYPES.includes('deathbed'));
});

test('a bequest moves up to 30 of the dying person\'s silver to the youngest living child', () => {
  const { state, story } = dying();
  state.people[GRANDCHILD].legalParentIds = [REP];
  state.people[REP].wealth = 45;
  const after = resolve(state, story.id, 'bequest');
  assert.deepEqual([after.people[REP].wealth, after.people[GRANDCHILD].wealth, after.people[HEIR].wealth], [15, 30, 30]);
  const poor = dying();
  poor.state.people[REP].wealth = 0;
  assert.equal(choice(poor.state, poor.story, 'bequest').error, 'Den egna förmögenheten räcker inte till ett testamente.');
});

test('a reconciliation ends the grudges both ways and turns the enemy towards the children', () => {
  const { state, story } = dying();
  assert.equal(choice(state, story, 'reconcile').error, 'Ingen vid hovet hatar dig nog för en försoning.');
  grudge(state, ENEMY, REP, -40);
  grudge(state, REP, ENEMY, -30);
  const before = getPersonalOpinion(state, ENEMY, HEIR);
  const after = resolve(state, story.id, 'reconcile');
  for (const key of [`${ENEMY}:${REP}`, `${REP}:${ENEMY}`]) assert.ok(after.relations[key].causes.filter((c) => c.amount < 0).every((c) => c.expiresAt === after.date), key);
  assert.equal(getPersonalOpinion(after, ENEMY, HEIR), before + 15);
  assert.ok(after.relations[`${ENEMY}:${HEIR}`].causes.some((c) => c.label === 'Försoning vid dödsbädden' && c.amount === 15));
});

test('a confession exposes the oldest own affair and eases stress', () => {
  const { state, story } = dying();
  assert.equal(choice(state, story, 'confess').error, 'Det finns ingen hemlighet att bekänna.');
  state.secrets.push({ id: 'secret-own', type: 'affair', subjectId: REP, holderIds: [REP], evidence: 'weak', causeId: null, exposed: false, createdAt: state.date });
  state.people[REP].stress = 50;
  const after = resolve(state, story.id, 'confess');
  assert.deepEqual([after.secrets.find((s) => s.id === 'secret-own').exposed, after.people[REP].stress], [true, 20]);
});

test('an unanswered deathbed lapses as rest, and one closes when its person dies', () => {
  const { state, story } = dying();
  state.date = story.dueAt;
  refreshCourtStories(state, [], actionHooks(state));
  assert.deepEqual([story.status, story.choiceId], ['resolved', 'rest']);
  const other = dying();
  other.state.people[REP].diedAt = other.state.date;
  refreshCourtStories(other.state, [], actionHooks(other.state));
  assert.equal(other.story.status, 'closed');
});

test('an unanswered deathbed draws from no random stream and takes no id from state.sequence', () => {
  const state = aged();
  const before = [...streams(state), state.sequence];
  deathbedStep(state, [], actionHooks(state));
  const [story] = open(state);
  state.date = story.dueAt;
  refreshCourtStories(state, [], actionHooks(state));
  assert.equal(story.status, 'resolved');
  assert.deepEqual([...streams(state), state.sequence], before);
  assert.deepEqual(state.log.slice(-2).map((event) => event.id), [`${story.id}-opened`, `${story.id}-expired`]);
});

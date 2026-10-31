import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { createCharacterSystem, getPersonalOpinion } from './index.js';
import { ACTION_CATALOG } from './actionCatalog.js';
import { bandFor, estimateAction, precisionFor } from './actionOdds.js';

const ACTOR = 'person-0-0';
const TARGET = 'person-1-0';
const SWEDISH_REASON = /[åäö]|silver|aktör|mål|agent|handling|order/i;
const FIVE = [[5, 20, 'mycket låg'], [21, 40, 'låg'], [41, 60, 'jämn'], [61, 80, 'hög'], [81, 95, 'mycket hög']];
const THREE = [[5, 35, 'osannolik'], [36, 65, 'osäker'], [66, 95, 'trolig']];
const bandOf = (table, value) => table.find(([low, high]) => value >= low && value <= high)[2];
const ALL_SKILLS = { command: 8, stewardship: 8, diplomacy: 8, learning: 8, intrigue: 8, prowess: 8 };

// A neutral scene: both people have every skill at 8, no traits, no stress, full health, and no opinion of each other, so the odds start at the entry's base values.
function scene(edit = () => {}) {
  const state = createCharacterSystem({ seed: 321 });
  const actor = state.people[ACTOR], target = state.people[TARGET];
  for (const person of [actor, target]) Object.assign(person, { traits: [], stress: 0, health: 100, skills: { ...ALL_SKILLS } });
  edit({ state, actor, target });
  return state;
}
function ctxOf(state, extra = {}) {
  return {
    representativeId: ACTOR,
    playerControlled: true,
    canOrder: (id) => id === ACTOR,
    wallet: (kind) => (kind === 'family' ? state.families['family-arel'].treasury : 0),
    opinion: (from, to) => getPersonalOpinion(state, from, to),
    ...extra,
  };
}
function estimate(state, actionId = 'sway', { means, intent = {}, ctx = {} } = {}) {
  return estimateAction(state, { actionId, actorId: ACTOR, targetIds: [TARGET], means, ...intent }, ctxOf(state, ctx));
}
const rows = (list) => Object.fromEntries(list.map((row) => [row.label, row.value]));
const find = (list, pattern) => list.find((row) => pattern.test(row.label));
const valueOf = (list, pattern) => find(list, pattern)?.value ?? 0;
const sum = (list) => list.reduce((total, row) => total + row.value, 0);
const sentiment = (state, from, to, amount) => {
  state.relations[`${from}:${to}`] = { fromId: from, toId: to, bonds: [], causes: [{ id: 'fixture', amount, label: 'Provvärde', causeId: 'fixture', startAt: state.date, expiresAt: null }] };
};
const illness = (state, personId) => {
  state.people[personId].healthConditions.push({ id: 'odds-fixture', kind: 'fever', severity: 3, stage: 'active', startedAt: state.date, nextTransitionAt: addGameMonths(state.date, 1), nextExposureAt: null, stageHistory: [{ stage: 'active', date: state.date }], treatment: null, causeId: null, sourceKind: 'calendar', relatedPersonId: null, scarRoll: 0.99, outcomeRoll: 0.99, endedAt: null });
};
const deepFreeze = (value) => { if (value && typeof value === 'object') for (const inner of Object.values(value)) deepFreeze(inner); return Object.freeze(value); };

const BASE = /^Grundchans$/;
const SKILL = /^Aktörens .* mot målets /;
const OPINION = /åsikt om aktören/;
const AGE = /höga ålder/;
const STRESS = /stress/;
const HEALTH = /svaga hälsa/;
const SILVER = /Extra silver/;
const AGENTS = /^Anlitade agenter$/;
const DIFFICULTY = /^Svårighetsgrad/;
const S_BASE = /^Hemlighållning: grundnivå$/;
const S_SKILL = /^Hemlighållning: aktörens .* mot målets intrig$/;
const S_AGENTS = /^Hemlighållning: anlitade agenter/;

test('a neutral case gives the base odds and returns the documented shape', () => {
  const state = scene();
  for (const [id, entry] of Object.entries(ACTION_CATALOG)) {
    const result = estimate(state, id);
    assert.equal(result.ok, true);
    assert.deepEqual(Object.keys(result), ['ok', 'actionId', 'actorId', 'targetIds', 'cost', 'success', 'secrecy', 'precision', 'display']);
    assert.equal(result.actionId, id);
    assert.equal(result.actorId, ACTOR);
    assert.deepEqual(result.targetIds, [TARGET]);
    assert.deepEqual(result.cost, { orders: entry.cost.orders, silver: entry.cost.silver, wallet: 'family', stressTag: entry.cost.stressTag });
    assert.deepEqual(result.success, { value: entry.baseSuccess, modifiers: [{ label: 'Grundchans', value: entry.baseSuccess }] });
    assert.deepEqual(result.secrecy, { value: entry.baseSecrecy, modifiers: [{ label: 'Hemlighållning: grundnivå', value: entry.baseSecrecy }] });
    assert.deepEqual(Object.keys(result.display), ['success', 'secrecy', 'modifiers']);
  }
});

test('the cost is the action price plus the extra silver the player commits', () => {
  const result = estimate(scene(), 'undermine', { means: { silver: 20, agentRoles: ['cook'] } });
  assert.deepEqual(result.cost, { orders: 1, silver: 35, wallet: 'family', stressTag: 'risky' });
});

// ---- Success modifiers, one test per row of the formula ----

test('skill: the gap to the target\'s defense moves the odds four per point and caps at 30 either way', () => {
  const at = (mine, theirs, id = 'sway', skill = 'diplomacy') => estimate(scene(({ actor, target }) => { actor.skills[skill] = mine; target.skills[skill] = theirs; }), id);
  assert.equal(valueOf(at(10, 8).success.modifiers, SKILL), 8);
  assert.equal(at(10, 8).success.value, 58);
  assert.equal(valueOf(at(6, 8).success.modifiers, SKILL), -8);
  assert.equal(valueOf(at(8, 11).success.modifiers, SKILL), -12, 'a stronger defender lowers the odds');
  assert.equal(valueOf(at(15, 8).success.modifiers, SKILL), 28);
  assert.equal(valueOf(at(16, 8).success.modifiers, SKILL), 30);
  assert.equal(valueOf(at(20, 0).success.modifiers, SKILL), 30);
  assert.equal(valueOf(at(0, 20).success.modifiers, SKILL), -30);
  assert.equal(find(at(8, 8).success.modifiers, SKILL), undefined, 'a zero modifier is omitted');
  assert.equal(valueOf(at(13, 8, 'undermine', 'intrigue').success.modifiers, SKILL), 20, 'undermine reads intrigue');
});

test('skill: each entry reads its own skill and not the other ones', () => {
  const state = scene(({ actor, target }) => { actor.skills.intrigue = 16; target.skills.intrigue = 4; });
  assert.equal(find(estimate(state, 'sway').success.modifiers, SKILL), undefined, 'a huge intrigue gap does not help a sway');
  assert.equal(valueOf(estimate(state, 'undermine').success.modifiers, SKILL), 30);
});

test('actor traits: each trait the actor has adds its catalog value', () => {
  const sway = (...traits) => estimate(scene(({ actor }) => { actor.traits = traits; })).success.modifiers;
  assert.equal(valueOf(sway('gregarious'), /sällskaplig/), 6);
  assert.equal(valueOf(sway('honest'), /ärlig/), 3);
  const both = sway('gregarious', 'honest');
  assert.deepEqual([valueOf(both, /sällskaplig/), valueOf(both, /ärlig/)], [6, 3]);
  assert.equal(sum(both), 50 + 9);
  assert.equal(sway('brave', 'paranoid', 'trusting').length, 1, 'traits the entry does not list add nothing, and target traits do not count for the actor');
  const undermine = (...traits) => estimate(scene(({ actor }) => { actor.traits = traits; }), 'undermine').success.modifiers;
  assert.equal(valueOf(undermine('deceitful'), /bedräglig/), 8);
  assert.equal(valueOf(undermine('honest'), /ärlig/), -8);
  assert.equal(sum(undermine('deceitful', 'honest')), 45);
  assert.equal(sum(sway('gregarious', 'gregarious')), 56, 'a repeated trait counts once');
});

test('target traits: each trait the target has adds its catalog value', () => {
  const sway = (...traits) => estimate(scene(({ target }) => { target.traits = traits; })).success.modifiers;
  assert.equal(valueOf(sway('paranoid'), /misstänksam/), -8);
  assert.equal(valueOf(sway('trusting'), /godtrogen/), 8);
  assert.equal(sum(sway('paranoid', 'trusting')), 50, 'opposite traits cancel');
  assert.equal(sway('gregarious', 'honest').length, 1, 'actor traits on the target add nothing');
  assert.equal(valueOf(estimate(scene(({ target }) => { target.traits = ['paranoid']; }), 'undermine').success.modifiers, /misstänksam/), -10);
});

test('opinion: the target\'s opinion of the actor moves a diplomacy action one point per five, up to 15', () => {
  const sway = (amount) => estimate(scene(({ state }) => sentiment(state, TARGET, ACTOR, amount)));
  assert.equal(valueOf(sway(40).success.modifiers, OPINION), 8);
  assert.equal(valueOf(sway(-40).success.modifiers, OPINION), -8);
  assert.equal(valueOf(sway(75).success.modifiers, OPINION), 15);
  assert.equal(valueOf(sway(100).success.modifiers, OPINION), 15);
  assert.equal(valueOf(sway(-100).success.modifiers, OPINION), -15);
  assert.equal(valueOf(sway(12).success.modifiers, OPINION), 2, 'rounded to the nearest point');
  assert.equal(valueOf(sway(13).success.modifiers, OPINION), 3);
  assert.equal(valueOf(sway(-13).success.modifiers, OPINION), -3);
  assert.equal(find(sway(2).success.modifiers, OPINION), undefined, 'opinion under three rounds to zero and is omitted');
});

test('opinion: it is read from the target to the actor, and only for diplomacy actions', () => {
  const calls = [];
  const state = scene(({ state: s }) => { sentiment(s, ACTOR, TARGET, 90); sentiment(s, TARGET, ACTOR, 0); });
  const result = estimate(state, 'sway', { ctx: { opinion: (from, to) => { calls.push([from, to]); return getPersonalOpinion(state, from, to); } } });
  assert.deepEqual(calls, [[TARGET, ACTOR]]);
  assert.equal(find(result.success.modifiers, OPINION), undefined, 'the actor\'s own warmth towards the target does not count');
  const intrigue = scene(({ state: s }) => sentiment(s, TARGET, ACTOR, -90));
  assert.equal(ACTION_CATALOG.undermine.category, 'intrigue');
  assert.equal(find(estimate(intrigue, 'undermine').success.modifiers, OPINION), undefined, 'undermine ignores opinion');
  assert.equal(valueOf(estimate(intrigue, 'sway').success.modifiers, OPINION), -15);
});

test('age: an actor of 65 or older loses 5, a younger one loses nothing', () => {
  const aged = (years) => estimate(scene(({ state, actor }) => { actor.bornAt = addGameMonths(state.date, -years * 12); })).success.modifiers;
  assert.equal(find(aged(64), AGE), undefined);
  assert.equal(valueOf(aged(65), AGE), -5);
  assert.equal(valueOf(aged(90), AGE), -5, 'the penalty does not grow');
});

test('stress: two points per 20 stress, at most 10', () => {
  const stressed = (stress) => estimate(scene(({ actor }) => { actor.stress = stress; })).success.modifiers;
  assert.equal(find(stressed(0), STRESS), undefined);
  assert.equal(find(stressed(19), STRESS), undefined);
  assert.equal(valueOf(stressed(20), STRESS), -2);
  assert.equal(valueOf(stressed(59), STRESS), -4);
  assert.equal(valueOf(stressed(60), STRESS), -6);
  assert.equal(valueOf(stressed(99), STRESS), -8);
  assert.equal(valueOf(stressed(100), STRESS), -10);
  assert.equal(valueOf(stressed(200), STRESS), -10);
});

test('health: an actor below 50 health loses 5', () => {
  const unwell = (health) => estimate(scene(({ actor }) => { actor.health = health; })).success.modifiers;
  assert.equal(find(unwell(50), HEALTH), undefined);
  assert.equal(valueOf(unwell(49), HEALTH), -5);
  assert.equal(valueOf(unwell(1), HEALTH), -5);
});

test('silver: one point per 5 extra silver', () => {
  const paid = (silver) => estimate(scene(), 'sway', { means: { silver } }).success.modifiers;
  assert.equal(find(paid(0), SILVER), undefined);
  assert.equal(find(paid(4), SILVER), undefined);
  assert.equal(valueOf(paid(5), SILVER), 1);
  assert.equal(valueOf(paid(29), SILVER), 5);
  assert.equal(valueOf(paid(60), SILVER), 12);
});

test('silver: the price of the action itself buys no extra odds', () => {
  const result = estimate(scene(), 'undermine');
  assert.equal(result.cost.silver, 15);
  assert.equal(find(result.success.modifiers, SILVER), undefined);
});

test('agents: each agent adds 6 to success, so two add 12', () => {
  const hired = (...agentRoles) => estimate(scene(), 'sway', { means: { agentRoles } }).success.modifiers;
  assert.equal(find(hired(), AGENTS), undefined);
  assert.equal(valueOf(hired('cook'), AGENTS), 6);
  assert.equal(valueOf(hired('cook', 'steward'), AGENTS), 12);
});

test('difficulty: the player\'s own actions move +10 on easy, 0 on normal and -10 on hard', () => {
  const diff = (difficulty, ctx = {}) => estimate(scene(({ state }) => { state.difficulty = difficulty; }), 'sway', { ctx });
  assert.equal(valueOf(diff('easy').success.modifiers, DIFFICULTY), 10);
  assert.equal(valueOf(diff('hard').success.modifiers, DIFFICULTY), -10);
  assert.equal(find(diff('normal').success.modifiers, DIFFICULTY), undefined, 'normal is zero and omitted');
  assert.match(find(diff('easy').success.modifiers, DIFFICULTY).label, /Lätt/);
  assert.match(find(diff('hard').success.modifiers, DIFFICULTY).label, /Svår/);
  assert.equal(diff('easy').success.value, 60);
});

test('difficulty: an NPC acting against the player\'s representative moves -10 on easy and +10 on hard', () => {
  const npc = (difficulty) => {
    const state = scene(({ state: s }) => { s.difficulty = difficulty; });
    return estimateAction(state, { actionId: 'sway', actorId: TARGET, targetIds: [ACTOR] }, ctxOf(state, { playerControlled: false, canOrder: () => true }));
  };
  assert.equal(valueOf(npc('easy').success.modifiers, DIFFICULTY), -10);
  assert.equal(valueOf(npc('hard').success.modifiers, DIFFICULTY), 10);
  assert.equal(find(npc('normal').success.modifiers, DIFFICULTY), undefined);
  const mine = estimate(scene(({ state }) => { state.difficulty = 'easy'; })).success.modifiers;
  assert.notEqual(find(npc('easy').success.modifiers, DIFFICULTY).label, find(mine, DIFFICULTY).label, 'the label tells the two cases apart');
  assert.match(find(npc('easy').success.modifiers, DIFFICULTY).label, /Lätt/);
});

test('difficulty: an NPC acting against another NPC gets no modifier, and a player order wins over the target rule', () => {
  const hardState = scene(({ state }) => { state.difficulty = 'hard'; });
  const npcVsNpc = estimateAction(hardState, { actionId: 'sway', actorId: TARGET, targetIds: ['person-2-0'], means: undefined }, ctxOf(hardState, { playerControlled: false, canOrder: () => true }));
  assert.equal(npcVsNpc.ok, true);
  assert.equal(find(npcVsNpc.success.modifiers, DIFFICULTY), undefined);
  // A household member under the player's order who acts against the representative: the player's modifier applies.
  const easyState = scene(({ state }) => { state.difficulty = 'easy'; });
  const ordered = estimateAction(easyState, { actionId: 'sway', actorId: 'person-0-1', targetIds: [ACTOR] }, ctxOf(easyState, { playerControlled: true, canOrder: () => true }));
  assert.equal(ordered.ok, true);
  assert.equal(valueOf(ordered.success.modifiers, DIFFICULTY), 10);
});

test('difficulty never moves the secrecy odds', () => {
  const easy = estimate(scene(({ state }) => { state.difficulty = 'easy'; }));
  assert.equal(easy.secrecy.value, 70);
  assert.equal(easy.secrecy.modifiers.length, 1);
});

test('an unknown saved difficulty counts as normal', () => {
  const result = estimate(scene(({ state }) => { state.difficulty = 'nightmare'; }));
  assert.equal(find(result.success.modifiers, DIFFICULTY), undefined);
  assert.equal(result.success.value, 50);
});

// ---- Secrecy ----

test('secrecy: the actor\'s secrecy skill against the target\'s intrigue moves it three per point, up to 24', () => {
  const sway = (mine, theirs) => estimate(scene(({ actor, target }) => { actor.skills.diplomacy = mine; target.skills.intrigue = theirs; })).secrecy;
  assert.equal(valueOf(sway(10, 8).modifiers, S_SKILL), 6);
  assert.equal(valueOf(sway(8, 12).modifiers, S_SKILL), -12);
  assert.equal(valueOf(sway(16, 8).modifiers, S_SKILL), 24);
  assert.equal(valueOf(sway(20, 0).modifiers, S_SKILL), 24);
  assert.equal(valueOf(sway(0, 20).modifiers, S_SKILL), -24);
  assert.equal(find(sway(8, 8).modifiers, S_SKILL), undefined);
  assert.equal(sway(10, 8).value, 76);
  const undermine = estimate(scene(({ actor, target }) => { actor.skills.intrigue = 12; target.skills.intrigue = 8; }), 'undermine').secrecy;
  assert.equal(valueOf(undermine.modifiers, S_SKILL), 12);
});

test('secrecy: the target\'s own diplomacy is not a secrecy defense, only its intrigue is', () => {
  const result = estimate(scene(({ target }) => { target.skills.diplomacy = 20; }));
  assert.equal(find(result.secrecy.modifiers, S_SKILL), undefined);
});

test('secrecy: each agent costs 8', () => {
  const hired = (...agentRoles) => estimate(scene(), 'sway', { means: { agentRoles } }).secrecy;
  assert.equal(valueOf(hired('cook').modifiers, S_AGENTS), -8);
  assert.equal(valueOf(hired('cook', 'servant').modifiers, S_AGENTS), -16);
  assert.equal(hired('cook', 'servant').value, 54);
});

test('secrecy: a deceitful actor gains 8 and an honest one loses 5', () => {
  const traits = (...list) => estimate(scene(({ actor }) => { actor.traits = list; })).secrecy;
  assert.equal(valueOf(traits('deceitful').modifiers, /bedräglig/), 8);
  assert.equal(traits('deceitful').value, 78);
  assert.equal(valueOf(traits('honest').modifiers, /ärlig/), -5);
  assert.equal(traits('honest').value, 65);
  assert.equal(traits('deceitful', 'honest').value, 73);
  const target = estimate(scene(({ target: t }) => { t.traits = ['deceitful', 'paranoid']; })).secrecy;
  assert.equal(target.modifiers.length, 1, 'the target\'s traits do not touch the secrecy formula');
});

test('secrecy reads none of the success-only modifiers', () => {
  const state = scene(({ state: s, actor, target }) => {
    s.difficulty = 'hard'; actor.stress = 120; actor.health = 10; actor.bornAt = addGameMonths(s.date, -80 * 12); target.traits = ['paranoid']; actor.traits = ['gregarious'];
    sentiment(s, TARGET, ACTOR, -80);
  });
  const result = estimate(state, 'sway', { means: { silver: 40 } });
  assert.equal(result.secrecy.value, 70);
  assert.equal(result.secrecy.modifiers.length, 1);
});

// ---- Bounds ----

test('success clamps at 95 with an extreme actor and shows the cut as a row so the rows add up', () => {
  const state = scene(({ actor, target }) => { actor.skills.diplomacy = 20; target.skills.diplomacy = 0; actor.traits = ['gregarious', 'honest']; target.traits = ['trusting']; });
  const high = estimate(state, 'sway', { means: { silver: 60, agentRoles: ['cook', 'steward'] } });
  assert.equal(high.success.value, 95);
  assert.ok(sum(high.success.modifiers.filter((row) => !/Högsta möjliga/.test(row.label))) > 95);
  assert.equal(sum(high.success.modifiers), 95, 'the rows add up to the shown value');
  assert.match(find(high.success.modifiers, /Högsta möjliga chans/).label, /^Högsta möjliga chans$/);
  assert.ok(find(high.success.modifiers, /Högsta möjliga chans/).value < 0);
});

test('success clamps at 5 with a hopeless actor', () => {
  const state = scene(({ state: s, actor, target }) => {
    actor.skills.intrigue = 0; target.skills.intrigue = 20; actor.traits = ['honest']; target.traits = ['paranoid'];
    actor.stress = 200; actor.health = 5; actor.bornAt = addGameMonths(s.date, -80 * 12); s.difficulty = 'hard';
  });
  const low = estimate(state, 'undermine');
  assert.equal(low.success.value, 5);
  assert.equal(sum(low.success.modifiers), 5);
  assert.ok(find(low.success.modifiers, /Lägsta möjliga chans/).value > 0);
});

test('secrecy clamps at 95 and its rows still add up', () => {
  const high = estimate(scene(({ actor, target }) => { actor.skills.diplomacy = 20; target.skills.intrigue = 0; actor.traits = ['deceitful']; }), 'sway').secrecy;
  assert.equal(high.value, 95);
  assert.equal(sum(high.modifiers), 95);
  assert.ok(find(high.modifiers, /^Hemlighållning: högsta möjliga nivå$/).value < 0);
});

test('the lowest secrecy a Phase 1 entry reaches is 15, so the secrecy floor is never cut', () => {
  // Undermine: 60 base, -24 for the widest skill gap, -16 for two agents, -5 for an honest actor.
  const low = estimate(scene(({ actor, target }) => { actor.skills.intrigue = 0; target.skills.intrigue = 20; actor.traits = ['honest']; }), 'undermine', { means: { agentRoles: ['cook', 'servant'] } }).secrecy;
  assert.equal(low.value, 15);
  assert.equal(sum(low.modifiers), 15);
  assert.equal(find(low.modifiers, /lägsta möjliga nivå/), undefined);
});

test('an unclamped result needs no cut row, and every value is an integer from 5 to 95', () => {
  const result = estimate(scene(), 'sway', { means: { silver: 17, agentRoles: ['cook'] } });
  assert.equal(sum(result.success.modifiers), result.success.value);
  assert.equal(find(result.success.modifiers, /Högsta|Lägsta/), undefined);
  for (const mine of [0, 5, 10, 20]) for (const theirs of [0, 8, 20]) for (const id of Object.keys(ACTION_CATALOG)) {
    const r = estimate(scene(({ actor, target }) => { actor.skills.diplomacy = mine; actor.skills.intrigue = mine; target.skills.diplomacy = theirs; target.skills.intrigue = theirs; }), id, { means: { silver: 60, agentRoles: ['cook', 'steward'] } });
    for (const roll of [r.success, r.secrecy]) {
      assert.ok(Number.isInteger(roll.value) && roll.value >= 5 && roll.value <= 95);
      assert.equal(sum(roll.modifiers), roll.value);
      assert.ok(roll.modifiers.every((row) => Number.isInteger(row.value) && row.value !== 0 && typeof row.label === 'string' && /[a-zåäö]/.test(row.label)));
    }
  }
});

// ---- Precision and display ----

test('precision follows the actor\'s main skill: 12 and up exact, 7 to 11 five bands, below 7 three bands', () => {
  assert.deepEqual([20, 12].map((skill) => precisionFor(skill)), ['exact', 'exact']);
  assert.deepEqual([11, 7].map((skill) => precisionFor(skill)), ['five', 'five']);
  assert.deepEqual([6, 0, -2, undefined, Number.NaN].map((skill) => precisionFor(skill)), ['three', 'three', 'three', 'three', 'three']);
  const at = (skill, id = 'sway') => estimate(scene(({ actor }) => { actor.skills.diplomacy = skill; actor.skills.intrigue = skill; }), id).precision;
  assert.deepEqual([12, 11, 7, 6].map((skill) => at(skill)), ['exact', 'five', 'five', 'three']);
  assert.deepEqual([12, 11, 7, 6].map((skill) => at(skill, 'undermine')), ['exact', 'five', 'five', 'three']);
});

test('precision reads the main skill, not the secrecy skill or the target\'s', () => {
  const state = scene(({ actor, target }) => { actor.skills.diplomacy = 12; actor.skills.intrigue = 2; target.skills.diplomacy = 20; target.skills.intrigue = 20; });
  assert.equal(estimate(state, 'sway').precision, 'exact');
  assert.equal(estimate(state, 'undermine').precision, 'three');
});

test('exact precision shows the numbers and every modifier of both rolls', () => {
  const state = scene(({ actor }) => { actor.skills.diplomacy = 14; actor.traits = ['honest']; actor.stress = 40; });
  const result = estimate(state, 'sway', { means: { silver: 10, agentRoles: ['cook'] } });
  assert.equal(result.precision, 'exact');
  assert.equal(typeof result.display.success, 'number');
  assert.equal(result.display.success, result.success.value);
  assert.equal(result.display.secrecy, result.secrecy.value);
  assert.deepEqual(result.display.modifiers, [...result.success.modifiers, ...result.secrecy.modifiers]);
  assert.ok(result.display.modifiers.every((row) => Object.keys(row).join() === 'label,value'));
});

test('five and three precision show band labels and the sign of each modifier, never a number', () => {
  for (const [skill, precision, table] of [[9, 'five', FIVE], [3, 'three', THREE]]) {
    const state = scene(({ actor }) => { actor.skills.diplomacy = skill; actor.traits = ['honest']; actor.stress = 60; actor.health = 10; });
    const result = estimate(state, 'sway', { means: { silver: 10, agentRoles: ['cook'] } });
    assert.equal(result.precision, precision);
    assert.equal(result.display.success, bandOf(table, result.success.value));
    assert.equal(result.display.secrecy, bandOf(table, result.secrecy.value));
    assert.deepEqual(result.display.modifiers.map((row) => Object.keys(row).join()), result.display.modifiers.map(() => 'label,sign'));
    assert.deepEqual(result.display.modifiers.map((row) => row.label), [...result.success.modifiers, ...result.secrecy.modifiers].map((row) => row.label));
    assert.deepEqual(result.display.modifiers.map((row) => row.sign), [...result.success.modifiers, ...result.secrecy.modifiers].map((row) => (row.value > 0 ? '+' : '−')));
    assert.ok(result.display.modifiers.some((row) => row.sign === '−') && result.display.modifiers.some((row) => row.sign === '+'));
    assert.ok(result.display.modifiers.every((row) => row.sign === '+' || row.sign === '−'), 'the minus is U+2212');
    assert.doesNotMatch(JSON.stringify(result.display), /\d/, `${precision}: no digit anywhere in what the player sees`);
  }
});

test('no label in any case contains a digit, so a hidden number cannot leak through a label', () => {
  const state = scene(({ state: s, actor, target }) => {
    actor.skills.diplomacy = 20; target.skills.diplomacy = 0; actor.traits = ['gregarious', 'honest', 'deceitful']; target.traits = ['paranoid', 'trusting'];
    actor.stress = 100; actor.health = 10; actor.bornAt = addGameMonths(s.date, -70 * 12); s.difficulty = 'hard'; sentiment(s, TARGET, ACTOR, 90);
  });
  for (const id of Object.keys(ACTION_CATALOG)) {
    const result = estimate(state, id, { means: { silver: 60, agentRoles: ['cook', 'steward'] } });
    for (const row of [...result.success.modifiers, ...result.secrecy.modifiers]) assert.doesNotMatch(row.label, /\d/, row.label);
  }
});

test('the band always contains the true value, for every value from 5 to 95 at both band precisions', () => {
  for (let value = 5; value <= 95; value++) {
    assert.equal(bandFor(value, 'five'), bandOf(FIVE, value), `five: ${value}`);
    assert.equal(bandFor(value, 'three'), bandOf(THREE, value), `three: ${value}`);
  }
  assert.deepEqual([...new Set(Array.from({ length: 91 }, (_, i) => bandFor(i + 5, 'five')))], FIVE.map((band) => band[2]));
  assert.deepEqual([...new Set(Array.from({ length: 91 }, (_, i) => bandFor(i + 5, 'three')))], THREE.map((band) => band[2]));
});

test('the band edges and the exact copy match the design', () => {
  assert.deepEqual([5, 20, 21, 40, 41, 60, 61, 80, 81, 95].map((value) => bandFor(value, 'five')), ['mycket låg', 'mycket låg', 'låg', 'låg', 'jämn', 'jämn', 'hög', 'hög', 'mycket hög', 'mycket hög']);
  assert.deepEqual([5, 35, 36, 65, 66, 95].map((value) => bandFor(value, 'three')), ['osannolik', 'osannolik', 'osäker', 'osäker', 'trolig', 'trolig']);
  assert.equal(bandFor(73, 'exact'), '73 %');
});

test('bandFor keeps values outside the odds range inside the outer bands and refuses nonsense', () => {
  assert.equal(bandFor(0, 'five'), 'mycket låg');
  assert.equal(bandFor(120, 'three'), 'trolig');
  assert.throws(() => bandFor(Number.NaN, 'five'), RangeError);
  assert.throws(() => bandFor('50', 'five'), RangeError);
  assert.throws(() => bandFor(50, 'four'), RangeError);
});

test('end to end, the shown band contains the true value of both rolls over a wide spread of cases', () => {
  const seen = new Set();
  for (const [skill, table, precision] of [[9, FIVE, 'five'], [4, THREE, 'three']]) {
    for (const theirs of [0, 4, 8, 12, 16, 20]) for (const silver of [0, 15, 30, 60]) for (const agentRoles of [[], ['cook'], ['cook', 'steward']]) for (const id of Object.keys(ACTION_CATALOG)) {
      const state = scene(({ actor, target }) => { actor.skills.diplomacy = skill; actor.skills.intrigue = skill; target.skills.diplomacy = theirs; target.skills.intrigue = theirs; });
      const result = estimate(state, id, { means: { silver, agentRoles } });
      assert.equal(result.precision, precision);
      assert.equal(result.display.success, bandOf(table, result.success.value));
      assert.equal(result.display.secrecy, bandOf(table, result.secrecy.value));
      seen.add(`${precision}:${result.display.success}`);
    }
  }
  assert.ok(seen.size >= 5, 'the spread reaches several bands');
});

// ---- Refusals ----

function refused(label, result, pattern) {
  assert.equal(result.ok, false, label);
  assert.deepEqual(Object.keys(result), ['ok', 'reason'], `${label}: only ok and reason`);
  assert.equal(typeof result.reason, 'string');
  assert.match(result.reason, SWEDISH_REASON, `${label}: Swedish`);
  assert.ok(result.reason.endsWith('.'), `${label}: a sentence`);
  if (pattern) assert.match(result.reason, pattern, label);
}

test('an unknown action, a command id or an inherited name is refused', () => {
  const state = scene();
  refused('unknown', estimate(state, 'poison'), /okänd|saknar odds/);
  refused('command', estimate(state, 'rest'), /okänd|saknar odds/);
  refused('inherited', estimate(state, 'toString'), /okänd|saknar odds/);
  refused('proto', estimate(state, '__proto__'), /okänd|saknar odds/);
  refused('missing id', estimateAction(state, { actorId: ACTOR, targetIds: [TARGET] }, ctxOf(state)));
  refused('not an intent', estimateAction(state, null, ctxOf(state)));
  refused('string intent', estimateAction(state, 'sway', ctxOf(state)));
});

test('an actor who does not exist, is dead, is a child or cannot exercise a mandate is refused', () => {
  refused('missing', estimate(scene(), 'sway', { intent: { actorId: 'person-9-9' } }), /Aktören finns inte/);
  refused('inherited', estimate(scene(), 'sway', { intent: { actorId: 'toString' } }), /Aktören finns inte/);
  refused('dead', estimate(scene(({ state, actor }) => { actor.diedAt = state.date; })), /död/);
  refused('child', estimate(scene(), 'sway', { intent: { actorId: 'person-0-5' } }), /för ung/);
  refused('incapacitated', estimate(scene(({ state }) => illness(state, ACTOR))), /oförmögen/);
});

test('an actor the player cannot order is refused', () => {
  const state = scene();
  refused('order', estimate(state, 'sway', { ctx: { canOrder: () => false } }), /order/);
  const asked = [];
  estimate(state, 'sway', { ctx: { canOrder: (id) => { asked.push(id); return true; } } });
  assert.deepEqual(asked, [ACTOR]);
});

test('a missing, dead, own, repeated or underage target is refused', () => {
  const state = scene();
  refused('none', estimate(state, 'sway', { intent: { targetIds: [] } }), /exakt ett mål/);
  refused('two', estimate(state, 'sway', { intent: { targetIds: [TARGET, 'person-2-0'] } }), /exakt ett mål/);
  refused('not an array', estimate(state, 'sway', { intent: { targetIds: TARGET } }), /exakt ett mål/);
  refused('missing', estimate(state, 'sway', { intent: { targetIds: ['person-9-9'] } }), /Målet finns inte/);
  refused('inherited', estimate(state, 'sway', { intent: { targetIds: ['hasOwnProperty'] } }), /Målet finns inte/);
  refused('not a string', estimate(state, 'sway', { intent: { targetIds: [7] } }), /Målet finns inte/);
  refused('dead', estimate(scene(({ state: s, target }) => { target.diedAt = s.date; })), /Målpersonen är död/);
  refused('self', estimate(state, 'sway', { intent: { targetIds: [ACTOR] } }), /sitt eget mål/);
  refused('child', estimate(state, 'sway', { intent: { targetIds: ['person-1-5'] } }), /för ung/);
});

test('undermine refuses a target in the actor\'s own family and sway accepts one', () => {
  const state = scene();
  const own = { intent: { targetIds: ['person-0-1'] } };
  refused('same family', estimate(state, 'undermine', own), /samma familj/);
  assert.equal(estimate(state, 'sway', own).ok, true, 'a household member can be swayed');
  assert.equal(estimate(state, 'undermine').ok, true, 'another house can be undermined');
  const other = { intent: { targetIds: ['person-2-0'] } };
  assert.equal(estimate(state, 'undermine', other).ok, true);
});

test('extra silver must be an integer from 0 to 60', () => {
  const state = scene();
  assert.equal(estimate(state, 'sway', { means: { silver: 0 } }).ok, true);
  assert.equal(estimate(state, 'sway', { means: { silver: 60 } }).ok, true);
  for (const silver of [-1, 61, 2.5, '10', null, Number.NaN, Infinity, true]) refused(`silver ${String(silver)}`, estimate(state, 'sway', { means: { silver } }), /heltal från 0 till 60/);
});

test('means must be an object or absent', () => {
  const state = scene();
  for (const means of [undefined, null, {}]) assert.equal(estimate(state, 'sway', { means }).ok, true);
  for (const means of ['lots', 5, [], [{ silver: 5 }]]) refused(`means ${JSON.stringify(means)}`, estimate(state, 'sway', { means }), /Medlen är ogiltiga/);
});

test('agent roles must be known, distinct, at most two and given as a list', () => {
  const state = scene();
  const agents = (agentRoles) => estimate(state, 'sway', { means: { agentRoles } });
  assert.equal(agents(['guard_captain', 'physician']).ok, true);
  refused('unknown', agents(['assassin']), /Okänd agentroll/);
  refused('inherited', agents(['toString']), /Okänd agentroll/);
  refused('not a string', agents([3]), /Okänd agentroll/);
  refused('repeated', agents(['cook', 'cook']), /två gånger/);
  refused('three', agents(['cook', 'steward', 'servant']), /Högst två agenter/);
  refused('not a list', agents('cook'), /lista/);
  refused('object', agents({ 0: 'cook' }), /lista/);
});

test('the silver must be there: price plus extra silver may not exceed the wallet', () => {
  const state = scene(({ state: s }) => { s.families['family-arel'].treasury = 20; });
  assert.equal(estimate(state, 'sway', { means: { silver: 15 } }).ok, true, '5 + 15 = 20 is exactly affordable');
  refused('one over', estimate(state, 'sway', { means: { silver: 16 } }), /Det behövs 21 silver; tillgängligt 20/);
  refused('price alone', estimate(scene(({ state: s }) => { s.families['family-arel'].treasury = 14; }), 'undermine'), /Det behövs 15 silver; tillgängligt 14/);
  assert.equal(estimate(scene(({ state: s }) => { s.families['family-arel'].treasury = 15; }), 'undermine').ok, true);
  const kinds = [];
  estimate(state, 'sway', { ctx: { wallet: (kind) => { kinds.push(kind); return 100; } } });
  assert.deepEqual(kinds, ['family'], 'the wallet kind comes from the catalog entry');
  refused('broken wallet', estimate(state, 'sway', { ctx: { wallet: () => Number.NaN } }), /tillgängligt 0/);
});

test('every kind of refusal has its own Swedish sentence', () => {
  const state = scene();
  const poor = scene(({ state: s }) => { s.families['family-arel'].treasury = 1; });
  const reasons = [
    estimate(state, 'poison'),
    estimateAction(state, null, ctxOf(state)),
    estimate(state, 'sway', { intent: { actorId: 'person-9-9' } }),
    estimate(scene(({ state: s, actor }) => { actor.diedAt = s.date; })),
    estimate(state, 'sway', { intent: { actorId: 'person-0-5' } }),
    estimate(scene(({ state: s }) => illness(s, ACTOR))),
    estimate(state, 'sway', { ctx: { canOrder: () => false } }),
    estimate(state, 'sway', { intent: { targetIds: [] } }),
    estimate(state, 'sway', { intent: { targetIds: ['person-9-9'] } }),
    estimate(scene(({ state: s, target }) => { target.diedAt = s.date; })),
    estimate(state, 'sway', { intent: { targetIds: [ACTOR] } }),
    estimate(state, 'sway', { intent: { targetIds: ['person-1-5'] } }),
    estimate(state, 'undermine', { intent: { targetIds: ['person-0-1'] } }),
    estimate(state, 'sway', { means: 'lots' }),
    estimate(state, 'sway', { means: { silver: 61 } }),
    estimate(state, 'sway', { means: { agentRoles: 'cook' } }),
    estimate(state, 'sway', { means: { agentRoles: ['assassin'] } }),
    estimate(state, 'sway', { means: { agentRoles: ['cook', 'cook'] } }),
    estimate(state, 'sway', { means: { agentRoles: ['cook', 'steward', 'servant'] } }),
    estimate(poor),
  ].map((result) => { assert.equal(result.ok, false); return result.reason; });
  assert.equal(new Set(reasons).size, reasons.length, 'no two refusals share a sentence');
  for (const reason of reasons) assert.match(reason, /^[A-ZÅÄÖ].*\.$/);
});

test('a context without its functions is a programming error and throws', () => {
  const state = scene();
  const intent = { actionId: 'sway', actorId: ACTOR, targetIds: [TARGET] };
  for (const name of ['canOrder', 'wallet', 'opinion']) {
    const ctx = ctxOf(state);
    delete ctx[name];
    assert.throws(() => estimateAction(state, intent, ctx), new RegExp(`ctx\\.${name}`));
  }
  assert.throws(() => estimateAction(state, intent), TypeError);
  assert.throws(() => estimateAction(state, intent, null), TypeError);
});

// ---- Purity ----

test('an estimate leaves the state deep-equal, spends nothing and creates no staff', () => {
  const state = scene(({ state: s }) => sentiment(s, TARGET, ACTOR, 30));
  const before = structuredClone(state);
  const streams = [state.rngState, state.actionRngState, state.sequence];
  const means = { silver: 25, agentRoles: ['cook', 'physician'] };
  for (const id of Object.keys(ACTION_CATALOG)) estimate(state, id, { means });
  estimate(state, 'sway', { means: { silver: 99 } });
  estimate(state, 'poison');
  estimate(state, 'sway', { intent: { actorId: 'person-9-9' } });
  assert.deepEqual(state, before);
  assert.deepEqual([state.rngState, state.actionRngState, state.sequence], streams);
  assert.deepEqual(state.courtStaff, {}, 'agents are counted, not created');
  assert.equal(state.families['family-arel'].treasury, before.families['family-arel'].treasury);
  assert.equal(state.actionPoints, before.actionPoints);
});

test('an estimate works on a deeply frozen state, so it cannot write to it', () => {
  const frozen = deepFreeze(structuredClone(scene()));
  const ctx = ctxOf(frozen);
  const result = estimateAction(frozen, { actionId: 'undermine', actorId: ACTOR, targetIds: [TARGET], means: { silver: 10, agentRoles: ['cook'] } }, ctx);
  assert.equal(result.ok, true);
});

test('the same inputs give the same result, and the result is plain data that aliases nothing', () => {
  const state = scene();
  const means = { silver: 10, agentRoles: ['cook'] };
  const first = estimate(state, 'sway', { means }), second = estimate(state, 'sway', { means });
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  first.cost.silver = 999;
  first.success.modifiers.push({ label: 'x', value: 1 });
  first.targetIds.push('person-9-9');
  assert.equal(ACTION_CATALOG.sway.cost.silver, 5);
  assert.deepEqual(means, { silver: 10, agentRoles: ['cook'] }, 'the intent is not edited');
  assert.equal(estimate(state, 'sway', { means }).cost.silver, 15);
  assert.deepEqual(estimate(state, 'sway', { means }).targetIds, [TARGET]);
});

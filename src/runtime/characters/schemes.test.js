import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths, compareGameDates } from '../gameDates.js';
import { advanceCharacters, createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getCharacterPresentation, getNextCharacterTransitionDate, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { ACTION_CATALOG, MAX_EXTRA_SILVER } from './actionCatalog.js';
import { actionRandom } from './extensions.js';
import { tierFor } from './actionResolution.js';
import { getSchemeDates } from './schemes.js';

const REP = 'person-0-0';
const TARGET = 'person-1-0';
const MEMBER = 'person-0-2';
const OUTSIDER = 'person-2-1';
// An adult of another house whom the player cannot order (the actor of the NPC scheme below).
const RIVAL = 'person-1-1';
const FAMILY = 'family-arel';
const TARGET_FAMILY = 'family-namar';
const COMMAND_MESSAGE = 'Den här handlingen utförs med sitt vanliga kommando.';
const UNKNOWN_SCHEME = 'Planen finns inte bland familjens pågående planer.';
const SILVER_MESSAGE = 'Extra silver måste vara ett positivt heltal.';
const INVALID = /^(Planlistan|En plan)/;
// Representative against TARGET: 10 + 12 × 2 − 4 = 30 percent per check.
const DISCOVERY = 30;
// First draw 31.71: below the refusal chance of a hostile member (70), above that of a loyal one (10).
const LOW_FIRST_DRAW = 2654435761;

const copy = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
const withSeed = (state, seed) => Object.assign(copy(state), { actionRngState: seed });
let counter = 0;
const run = (state, type, payload, id = `command-${++counter}`) => executeCharacterCommand(state, { id, expectedRevision: state.revision, type, payload });
const UNDERMINE = { actionId: 'undermine', actorId: REP, targetIds: [TARGET] };
const attempt = (state, extra = {}, id) => run(state, 'attempt_action', { ...UNDERMINE, ...extra }, id);
function begin(state, extra = {}, id) {
  const result = attempt(state, extra, id);
  assert.equal(result.ok, true, result.error);
  return result.state;
}
function step(state, date) {
  const result = advanceCharacters(state, date);
  assert.equal(result.ok, true, result.error);
  return result;
}
const advance = (state, date) => step(state, date).state;
const schemeOf = (state) => state.schemes.at(-1);
const draws = (seed, count) => { const dice = { actionRngState: seed }; return { values: Array.from({ length: count }, () => actionRandom(dice) * 100), after: dice.actionRngState }; };
const domain = (state) => ({ ...copy(state), revision: 0, appliedCommandIds: [] });
// A seed whose first draws satisfy one check each. Test setup only.
function seedWhere(...checks) {
  for (let k = 1; k < 50000; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    const { values } = draws(seed, checks.length);
    if (checks.every((check, index) => check(values[index]))) return seed;
  }
  throw new Error('No seed for these draws.');
}
// The action stream state whose next draw is `next` / 2^32: one xorshift step (13, 17, 5) undone, so a test can place a roll exactly.
function seedBefore(next) {
  const undoLeft = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y << k)) >>> 0; return y; };
  const undoRight = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y >>> k)) >>> 0; return y; };
  return undoLeft(undoRight(undoLeft(next >>> 0, 5), 17), 13);
}
const START = base().date;
const [M1, M2, M3] = [1, 2, 3].map((months) => addGameMonths(START, months));
const odds = estimateCharacterAction(base(), UNDERMINE);
// Three quiet checks, then a clean success on the due date.
const RESOLVE_SEED = seedWhere((d) => d >= DISCOVERY, (d) => d >= DISCOVERY, (d) => d >= DISCOVERY, (d) => d < odds.success.value, (d) => d < odds.secrecy.value);
const DISCOVER_SEED = seedWhere((d) => d < DISCOVERY);
// A scheme written by hand into a state, as another task's NPC schemes will be.
function plant(state, overrides = {}) {
  const item = {
    id: `scheme-${++state.sequence}`, actionId: 'undermine', actorId: REP, targetIds: [TARGET], means: { silver: 0, agentRoles: [] },
    startedAt: state.date, dueAt: addGameMonths(state.date, 3), nextCheckAt: addGameMonths(state.date, 1),
    status: 'active', discoveredAt: null, resolutionId: null, playerControlled: true, commandId: null, ...overrides,
  };
  state.schemes.push(item);
  return item;
}
function hostileMember(state) {
  state.people[MEMBER].loyalty = 0;
  state.relations[`${MEMBER}:${REP}`] = { fromId: MEMBER, toId: REP, bonds: [], causes: [{ id: 'fixture', amount: -150, label: 'Provvärde', causeId: 'fixture', startAt: state.date, expiresAt: null }] };
  return state;
}

test('a scheme attempt pays at the start, draws nothing and writes an active scheme', () => {
  const state = withSeed(base(), RESOLVE_SEED);
  const before = { treasury: state.families[FAMILY].treasury, orders: state.actionPoints, stress: state.people[REP].stress, sequence: state.sequence };
  const result = attempt(state, {}, 'scheme-start');
  assert.equal(result.ok, true, result.error);
  const after = result.state;
  assert.deepEqual(after.schemes, [{
    id: `scheme-${before.sequence + 1}`, actionId: 'undermine', actorId: REP, targetIds: [TARGET], means: { silver: 0, agentRoles: [] },
    startedAt: START, dueAt: M3, nextCheckAt: M1, status: 'active', discoveredAt: null, resolutionId: null, playerControlled: true, commandId: 'scheme-start',
  }]);
  assert.equal(after.sequence, before.sequence + 1);
  assert.equal(after.families[FAMILY].treasury, before.treasury - ACTION_CATALOG.undermine.cost.silver);
  assert.equal(after.actionPoints, before.orders - 1);
  assert.equal(after.people[REP].stress, before.stress + 4, 'the risky tag costs a non-cautious representative 4 stress');
  assert.equal(after.actionRngState, RESOLVE_SEED, 'no refusal draw for the representative\'s own scheme');
  assert.equal(after.rngState, state.rngState);
  assert.deepEqual(after.actionLog, [], 'nothing is rolled or recorded until the scheme completes');
  assert.deepEqual(getSchemeDates(after), [M1]);
  const listed = getCharacterPresentation(after).schemes;
  assert.deepEqual(listed.map((item) => [item.id, item.actionId, item.actionLabel, item.actorId, item.targetIds, item.status, item.startedAt, item.dueAt]), [[schemeOf(after).id, 'undermine', 'Undergräv', REP, [TARGET], 'active', START, M3]]);
  for (const key of ['means', 'nextCheckAt', 'commandId', 'playerControlled', 'discoveredAt', 'resolutionId']) assert.equal(Object.hasOwn(listed[0], key), false, key);
});

test('the means of a scheme are kept as given and its agents are hired when it runs', () => {
  const state = withSeed(base(), RESOLVE_SEED);
  const started = begin(state, { means: { silver: 10, agentRoles: ['cook'] } });
  assert.deepEqual(schemeOf(started).means, { silver: 10, agentRoles: ['cook'] });
  assert.equal(started.families[FAMILY].treasury, state.families[FAMILY].treasury - 25);
  assert.deepEqual(started.courtStaff, state.courtStaff, 'agents are found or created when the action runs');
  const done = advance(started, M3);
  const resolution = done.actionLog[0];
  assert.equal(resolution.agentIds.length, 1);
  assert.equal(done.courtStaff[resolution.agentIds[0]].role, 'cook');
  assert.equal(done.families[FAMILY].treasury, started.families[FAMILY].treasury, 'nothing more is charged at completion');
});

test('a three-month scheme resolves on its due date and not before', () => {
  const started = begin(withSeed(base(), RESOLVE_SEED), {}, 'resolve-1');
  const month2 = advance(started, M2);
  assert.equal(schemeOf(month2).status, 'active');
  assert.equal(schemeOf(month2).nextCheckAt, M3);
  assert.equal(month2.actionLog.length, 0);
  assert.equal(month2.actionRngState, draws(RESOLVE_SEED, 2).after, 'one discovery draw per monthly check');
  const between = advance(month2, '-0300-03-15');
  assert.deepEqual(between.schemes, month2.schemes, 'a date between checks changes nothing');
  assert.equal(between.actionRngState, month2.actionRngState);
  const influenceBefore = between.families[TARGET_FAMILY].influence;
  const result = step(between, M3);
  const done = result.state, resolution = done.actionLog.at(-1);
  const dice = draws(RESOLVE_SEED, 5);
  assert.equal(schemeOf(done).status, 'resolved');
  assert.equal(schemeOf(done).resolutionId, resolution.id);
  assert.equal(done.actionLog.length, 1);
  assert.equal(resolution.date, M3);
  assert.equal(resolution.actionId, 'undermine');
  assert.equal(resolution.actorId, REP);
  assert.deepEqual(resolution.targetIds, [TARGET]);
  assert.equal(resolution.commandId, 'resolve-1');
  assert.equal(resolution.playerControlled, true);
  assert.equal(resolution.refused, false);
  assert.deepEqual(resolution.rolls, { refusal: null, success: dice.values[3], secrecy: dice.values[4] });
  assert.equal(resolution.tier, tierFor(dice.values[3], dice.values[4], odds.success.value, odds.secrecy.value));
  assert.equal(resolution.tier, 'clean_success');
  assert.deepEqual(resolution.estimate, { success: odds.success.value, secrecy: odds.secrecy.value, refusal: null });
  assert.equal(done.actionRngState, dice.after, 'three discovery draws, then success and secrecy');
  assert.equal(done.rngState, started.rngState);
  assert.equal(done.families[TARGET_FAMILY].influence, influenceBefore - 7, 'the clean-success envelope is applied at its default');
  assert.equal(done.families[FAMILY].treasury, started.families[FAMILY].treasury, 'nothing is charged at completion');
  assert.deepEqual(getSchemeDates(done), []);
  const event = result.events.find((item) => item.type === 'action_resolution');
  assert.equal(event.title, 'Undergräv: lyckat i det tysta');
  assert.equal(event.public, true);
  assert.deepEqual(getCharacterPresentation(done).schemes, [], 'a resolved scheme leaves the active list');
  assert.equal(getCharacterPresentation(done).recentResolutions.at(-1).id, resolution.id);
});

test('getNextCharacterTransitionDate stops at each monthly check and at the due date', () => {
  const started = begin(withSeed(base(), RESOLVE_SEED));
  const target = addGameMonths(START, 12);
  assert.equal(getNextCharacterTransitionDate(base(), M3), M3, 'without a scheme nothing stops before the target');
  const stops = [];
  let walked = started;
  for (let next = getNextCharacterTransitionDate(walked, target); next && stops.length < 4; next = getNextCharacterTransitionDate(walked, target)) {
    stops.push(next);
    walked = advance(walked, next);
  }
  assert.deepEqual(stops.slice(0, 3), [M1, M2, M3]);
  assert.ok(compareGameDates(stops[3], M3) > 0, 'after the due date the scheme adds no more stops');
  assert.deepEqual(getSchemeDates(walked), []);
});

test('a whole-year advance and a split advance at the check dates give identical state', () => {
  const finished = new Set();
  const seeds = [RESOLVE_SEED, DISCOVER_SEED, seedWhere((d) => d >= DISCOVERY, (d) => d < DISCOVERY), seedWhere((d) => d >= DISCOVERY, (d) => d >= DISCOVERY, (d) => d < DISCOVERY), 1234567, 98765];
  for (const seed of seeds) {
    const started = begin(withSeed(base(), seed));
    const target = addGameMonths(START, 12);
    const whole = advance(started, target);
    let split = started;
    for (const date of [M1, '-0300-02-15', M2, M3, '-0300-06-30', target]) split = advance(split, date);
    assert.deepEqual(domain(split), domain(whole), `seed ${seed}`);
    finished.add(schemeOf(whole).status);
  }
  assert.ok(finished.has('resolved') && finished.has('discovered'), `both branches are covered: ${[...finished]}`);
});

test('a discovered scheme costs the actor the target\'s goodwill and never resolves', () => {
  const started = begin(withSeed(base(), DISCOVER_SEED));
  const opinionBefore = getPersonalOpinion(started, TARGET, REP);
  const result = step(started, M1);
  const found = result.state, scheme = schemeOf(found);
  assert.equal(scheme.status, 'discovered');
  assert.equal(scheme.discoveredAt, M1);
  assert.equal(scheme.resolutionId, null);
  assert.equal(found.actionRngState, draws(DISCOVER_SEED, 1).after, 'exactly one discovery draw');
  assert.equal(found.rngState, started.rngState);
  assert.equal(getPersonalOpinion(found, TARGET, REP), opinionBefore - 20);
  const event = result.events.find((item) => item.type === 'scheme_discovered');
  assert.equal(event.title, 'Undergräv: planen avslöjades');
  assert.equal(event.public, true, 'the actor belongs to the controlled family');
  assert.deepEqual(event.participants, [REP, TARGET]);
  assert.doesNotMatch(event.description, /\d/);
  const memory = found.memories.find((item) => item.causeId === event.id);
  assert.equal(memory.type, 'scheme_discovered');
  assert.deepEqual([...memory.knownBy].sort(), [REP, TARGET].sort(), 'known by the actor and the target');
  const cause = found.relations[`${TARGET}:${REP}`].causes.find((item) => item.causeId === memory.id);
  assert.equal(cause.amount, -20);
  assert.deepEqual(getSchemeDates(found), []);
  assert.deepEqual(getCharacterPresentation(found).schemes, []);
  const later = advance(found, addGameMonths(START, 12));
  assert.equal(schemeOf(later).status, 'discovered');
  assert.equal(later.actionLog.length, 0);
  assert.equal(later.actionRngState, found.actionRngState, 'a discovered scheme draws nothing more');
});

test('the discovery chance is 10 plus twice the target\'s intrigue minus the actor\'s, kept between 3 and 40 percent', () => {
  const cases = [{ actor: 4, target: 12, chance: 30 }, { actor: 10, target: 5, chance: 10 }, { actor: 20, target: 0, chance: 3 }, { actor: 0, target: 20, chance: 40 }];
  for (const { actor, target, chance } of cases) {
    const setup = base();
    setup.people[REP].skills.intrigue = actor;
    setup.people[TARGET].skills.intrigue = target;
    const edge = Math.ceil((chance * 2 ** 32) / 100);
    const outcome = (next) => {
      const started = begin(withSeed(setup, seedBefore(next)));
      return schemeOf(advance(started, M1)).status;
    };
    assert.equal(outcome(edge - 1), 'discovered', `just below ${chance} percent`);
    assert.equal(outcome(edge), 'active', `at ${chance} percent`);
  }
});

test('an aborted scheme stops without a refund and draws nothing', () => {
  const started = begin(withSeed(base(), RESOLVE_SEED));
  const result = run(started, 'abort_scheme', { schemeId: schemeOf(started).id });
  assert.equal(result.ok, true, result.error);
  const aborted = result.state;
  assert.equal(schemeOf(aborted).status, 'aborted');
  assert.equal(aborted.families[FAMILY].treasury, started.families[FAMILY].treasury, 'no refund');
  assert.equal(aborted.actionPoints, started.actionPoints);
  assert.equal(aborted.people[REP].stress, started.people[REP].stress);
  assert.equal(aborted.actionRngState, started.actionRngState);
  assert.equal(aborted.rngState, started.rngState);
  assert.deepEqual(getSchemeDates(aborted), []);
  assert.deepEqual(getCharacterPresentation(aborted).schemes, []);
  const later = advance(aborted, addGameMonths(START, 6));
  assert.equal(schemeOf(later).status, 'aborted');
  assert.equal(later.actionLog.length, 0);
  assert.equal(later.actionRngState, started.actionRngState);
  assert.equal(run(aborted, 'abort_scheme', { schemeId: schemeOf(aborted).id }).error, UNKNOWN_SCHEME, 'an aborted scheme cannot be aborted again');
});

test('abort and reinforce accept only an active scheme of the controlled family', () => {
  const started = begin(withSeed(base(), RESOLVE_SEED));
  const planted = copy(started);
  const foreign = plant(planted, { actorId: OUTSIDER, targetIds: [TARGET], playerControlled: false });
  const closed = plant(planted, { status: 'failed' });
  const snapshot = copy(planted);
  for (const type of ['abort_scheme', 'reinforce_scheme']) {
    for (const schemeId of [foreign.id, closed.id, 'scheme-999', 'toString', 7, null]) {
      const result = run(planted, type, { schemeId, silver: 5 });
      assert.equal(result.ok, false, `${type} ${schemeId}`);
      assert.equal(result.error, UNKNOWN_SCHEME, `${type} ${schemeId}`);
      assert.equal(result.state, planted);
    }
    assert.equal(run(planted, type, undefined).error, UNKNOWN_SCHEME);
  }
  assert.deepEqual(planted, snapshot);
});

test('reinforcing a scheme charges the silver, adds it to the means and raises the success estimate at resolution', () => {
  // A representative who is not dutiful would pay 3 stress for a duty-tagged charge.
  const setup = withSeed(base(), RESOLVE_SEED);
  setup.people[REP].traits = ['ambitious'];
  const plain = advance(begin(setup), M3);
  const started = begin(setup);
  const result = run(started, 'reinforce_scheme', { schemeId: schemeOf(started).id, silver: 20 }, 'reinforce-1');
  assert.equal(result.ok, true, result.error);
  const reinforced = result.state;
  assert.equal(schemeOf(reinforced).means.silver, 20);
  assert.equal(reinforced.families[FAMILY].treasury, started.families[FAMILY].treasury - 20);
  assert.equal(reinforced.actionPoints, started.actionPoints, 'a reinforcement spends no order');
  assert.equal(reinforced.people[REP].stress, started.people[REP].stress, 'and carries no stress tag');
  assert.equal(reinforced.actionRngState, started.actionRngState);
  assert.equal(reinforced.rngState, started.rngState);
  const done = advance(reinforced, M3);
  const direct = begin(setup, { means: { silver: 20 } });
  assert.equal(done.actionLog[0].estimate.success, plain.actionLog[0].estimate.success + 4, 'twenty silver is worth four points');
  assert.equal(done.actionLog[0].estimate.success, estimateCharacterAction(direct, { ...UNDERMINE, means: { silver: 20 } }).success.value);
  assert.equal(done.actionLog[0].estimate.secrecy, plain.actionLog[0].estimate.secrecy);
  const again = run(reinforced, 'reinforce_scheme', { schemeId: schemeOf(reinforced).id, silver: 40 });
  assert.equal(again.ok, true, again.error);
  assert.equal(schemeOf(again.state).means.silver, 60);
});

test('a reinforcement must be a positive whole number of silver within the cap and the wallet', () => {
  const started = begin(withSeed(base(), RESOLVE_SEED));
  const id = schemeOf(started).id;
  const reinforce = (state, silver) => run(state, 'reinforce_scheme', { schemeId: id, silver });
  for (const silver of [0, -5, 2.5, '5', null, undefined, NaN, Infinity]) {
    const result = reinforce(started, silver);
    assert.equal(result.ok, false, String(silver));
    assert.equal(result.error, SILVER_MESSAGE, String(silver));
  }
  const capped = reinforce(begin(withSeed(base(), RESOLVE_SEED), { means: { silver: 40 } }), 21);
  assert.equal(capped.ok, false);
  assert.equal(capped.error, `En plan kan få högst ${MAX_EXTRA_SILVER} extra silver sammanlagt.`);
  assert.equal(reinforce(begin(withSeed(base(), RESOLVE_SEED), { means: { silver: 40 } }), 20).ok, true, 'exactly the cap is allowed');
  const poor = copy(started);
  poor.families[FAMILY].treasury = 3;
  const broke = reinforce(poor, 5);
  assert.equal(broke.ok, false);
  assert.equal(broke.error, 'Det behövs 5 silver; tillgängligt 3.');
  assert.equal(broke.state, poor);
});

test('a scheme whose target dies closes as failed with no tier and no draw', () => {
  const started = begin(withSeed(base(), RESOLVE_SEED));
  const month1 = advance(started, M1);
  const wounded = copy(month1);
  wounded.people[TARGET].diedAt = wounded.date;
  const result = step(wounded, M2);
  const failed = result.state;
  assert.equal(schemeOf(failed).status, 'failed');
  assert.equal(schemeOf(failed).resolutionId, null);
  assert.equal(schemeOf(failed).discoveredAt, null);
  assert.equal(failed.actionLog.length, 0, 'no tier, so nothing in the action log');
  assert.equal(failed.actionRngState, draws(RESOLVE_SEED, 1).after, 'only the first check drew; the dead target ends it before the discovery roll');
  assert.equal(failed.rngState, started.rngState);
  assert.deepEqual(getSchemeDates(failed), []);
  const event = result.events.find((item) => item.type === 'scheme_failed');
  assert.equal(event.public, true);
  assert.equal(event.title, 'Undergräv: planen föll samman');
  const later = advance(failed, addGameMonths(START, 12));
  assert.equal(schemeOf(later).status, 'failed');
  assert.equal(later.actionRngState, failed.actionRngState);
});

test('a scheme whose actor dies closes as failed with no draw', () => {
  const seed = seedWhere((d) => d >= 50, (d) => d >= 40, (d) => d >= 40);
  const started = begin(withSeed(base(), seed), { actorId: MEMBER });
  assert.equal(started.actionRngState, draws(seed, 1).after, 'the ordered member\'s refusal draw');
  const dead = copy(started);
  dead.people[MEMBER].diedAt = dead.date;
  const failed = advance(dead, M2);
  assert.equal(schemeOf(failed).status, 'failed');
  assert.equal(failed.actionLog.length, 0);
  assert.equal(failed.actionRngState, started.actionRngState, 'no discovery draw for a dead actor');
});

test('a scheme that can no longer run at its due date closes as failed with no draw', () => {
  const started = begin(withSeed(base(), RESOLVE_SEED));
  const month2 = advance(started, M2);
  const changed = copy(month2);
  changed.people[TARGET].familyId = FAMILY;
  const result = step(changed, M3);
  const failed = result.state;
  assert.equal(schemeOf(failed).status, 'failed');
  assert.equal(schemeOf(failed).resolutionId, null);
  assert.equal(failed.actionLog.length, 0);
  assert.equal(failed.actionRngState, draws(RESOLVE_SEED, 2).after, 'the fresh estimate refuses before any roll at the due date');
  const event = result.events.find((item) => item.type === 'scheme_failed');
  assert.match(event.description, /Målpersonen tillhör samma familj som aktören\./);
});

test('the silver was paid when the scheme started, so an empty treasury does not stop it at the due date', () => {
  const started = begin(withSeed(base(), RESOLVE_SEED), { means: { silver: 30 } });
  const month2 = advance(started, M2);
  const poor = copy(month2);
  poor.families[FAMILY].treasury = 0;
  const done = advance(poor, M3);
  assert.equal(schemeOf(done).status, 'resolved');
  assert.equal(done.actionLog.length, 1);
  assert.equal(done.families[FAMILY].treasury, 0);
});

test('an ordered actor draws the refusal at the start and is never asked again', () => {
  const seed = seedWhere((d) => d >= 50, (d) => d >= 40, (d) => d >= 40, (d) => d >= 40);
  const state = withSeed(base(), seed);
  const started = begin(state, { actorId: MEMBER });
  assert.equal(schemeOf(started).actorId, MEMBER);
  assert.equal(started.actionRngState, draws(seed, 1).after);
  assert.equal(started.families[FAMILY].treasury, state.families[FAMILY].treasury - 15, 'paid at the start');
  assert.equal(started.actionPoints, state.actionPoints - 1);
  assert.equal(started.actionLog.length, 0);
  const done = advance(started, M3);
  const resolution = done.actionLog[0];
  assert.equal(resolution.actorId, MEMBER);
  assert.equal(resolution.estimate.refusal, null, 'no refusal at completion');
  assert.equal(resolution.rolls.refusal, null);
  assert.equal(resolution.refused, false);
  assert.equal(done.actionRngState, draws(seed, 6).after, 'one refusal draw, three discovery draws, then success and secrecy');
});

test('a refused order for a scheme spends the order, creates no scheme and charges no silver', () => {
  const state = hostileMember(withSeed(base(), LOW_FIRST_DRAW));
  const result = attempt(state, { actorId: MEMBER });
  assert.equal(result.ok, true, result.error);
  const after = result.state, entry = after.actionLog.at(-1);
  assert.deepEqual(after.schemes, []);
  assert.equal(entry.refused, true);
  assert.equal(entry.actionId, 'undermine');
  assert.equal(entry.rolls.refusal, draws(LOW_FIRST_DRAW, 1).values[0]);
  assert.equal(after.actionRngState, draws(LOW_FIRST_DRAW, 1).after, 'the refusal draw only');
  assert.equal(after.families[FAMILY].treasury, state.families[FAMILY].treasury);
  assert.equal(after.actionPoints, state.actionPoints - 1);
  assert.equal(after.people[REP].stress, state.people[REP].stress);
  assert.ok(result.events.some((event) => event.type === 'order_refused'));
  assert.equal(after.sequence - state.sequence, 3, 'the resolution, its event and its memory spend one id each, as for an instant action');
  assert.equal(after.rngState, state.rngState);
});

test('schemes run in the numeric order of their ids, not the string order', () => {
  const setup = base();
  for (const id of [TARGET, OUTSIDER]) setup.people[id].skills.intrigue = 20;
  setup.people[REP].skills.intrigue = 0;
  // Planted newest first: scheme-10 sits before scheme-9 in the array and sorts before it as text.
  plant(setup, { id: 'scheme-10', targetIds: [OUTSIDER], nextCheckAt: M1 });
  plant(setup, { id: 'scheme-9', targetIds: [TARGET], nextCheckAt: M1 });
  const seed = seedWhere((d) => d < 40, (d) => d >= 40);
  const result = step(withSeed(setup, seed), M1);
  const byId = Object.fromEntries(result.state.schemes.map((item) => [item.id, item.status]));
  assert.deepEqual(byId, { 'scheme-9': 'discovered', 'scheme-10': 'active' }, 'scheme-9 takes the first draw');
  assert.equal(result.state.actionRngState, draws(seed, 2).after);
});

test('a scheme due on the day of the annual step runs before it', () => {
  const setup = base();
  setup.date = '-0300-10-01';
  const started = begin(withSeed(setup, RESOLVE_SEED));
  assert.equal(schemeOf(started).dueAt, started.nextAnnualDate, 'the due date is the annual date');
  const month2 = advance(started, addGameMonths(setup.date, 2));
  const doomed = copy(month2);
  doomed.people[TARGET].health = 0;
  const done = advance(doomed, started.nextAnnualDate);
  assert.ok(done.people[TARGET].diedAt, 'the annual step buries the target on that day');
  assert.equal(schemeOf(done).status, 'resolved', 'the scheme was rolled while the target still lived');
  assert.equal(done.actionLog.at(-1).targetIds[0], TARGET);
});

test('a check capped at the due date does not run a month past it', () => {
  const setup = base();
  plant(setup, { nextCheckAt: M1, dueAt: '-0300-02-15' });
  const seed = seedWhere((d) => d >= DISCOVERY);
  const month1 = advance(withSeed(setup, seed), M1);
  assert.equal(schemeOf(month1).nextCheckAt, '-0300-02-15');
  assert.equal(schemeOf(month1).status, 'active');
  assert.deepEqual(getSchemeDates(month1), ['-0300-02-15']);
});

test('the monthly dates follow the start date, so a 31st does not drift', () => {
  const setup = base();
  setup.date = '-0300-01-31';
  setup.nextAnnualDate = '-0299-01-31';
  const started = begin(withSeed(setup, RESOLVE_SEED));
  assert.equal(schemeOf(started).nextCheckAt, '-0300-02-28', 'February is short in this year');
  assert.equal(schemeOf(started).dueAt, '-0300-04-30');
  const march = advance(started, '-0300-02-28');
  assert.equal(schemeOf(march).nextCheckAt, '-0300-03-31', 'back on the 31st, not the 29th');
});

test('a discovery the player cannot see stays out of the public log, one aimed at their representative does not', () => {
  const quiet = seedWhere((d) => d < 27);
  const hiddenSetup = withSeed(base(), quiet);
  plant(hiddenSetup, { actorId: OUTSIDER, targetIds: [TARGET], playerControlled: false, nextCheckAt: M1 });
  const hidden = step(hiddenSetup, M1);
  assert.equal(schemeOf(hidden.state).status, 'discovered');
  assert.equal(hidden.events.find((item) => item.type === 'scheme_discovered').public, false);
  assert.equal(getPersonalOpinion(hidden.state, TARGET, OUTSIDER), getPersonalOpinion(hiddenSetup, TARGET, OUTSIDER) - 20);
  assert.equal(getCharacterPresentation(hidden.state).log.some((item) => item.type === 'scheme_discovered'), false);
  const aimedSetup = withSeed(base(), quiet);
  plant(aimedSetup, { actorId: TARGET, targetIds: [REP], playerControlled: false, nextCheckAt: M1 });
  aimedSetup.people[REP].skills.intrigue = 20;
  aimedSetup.people[TARGET].skills.intrigue = 0;
  const aimed = step(aimedSetup, M1);
  assert.equal(schemeOf(aimed.state).status, 'discovered');
  assert.equal(aimed.events.find((item) => item.type === 'scheme_discovered').public, true);
  assert.equal(getCharacterPresentation(aimed.state).log.some((item) => item.type === 'scheme_discovered'), true);
});

test('a scheme by another house resolves without the player\'s orders, wallet or order points', () => {
  const resolveWith = (difficulty) => {
    const setup = withSeed(base(), seedWhere((d) => d >= 40, (d) => d < 100));
    setup.difficulty = difficulty;
    plant(setup, { actorId: RIVAL, targetIds: [REP], playerControlled: false, dueAt: M1, nextCheckAt: M1 });
    return step(setup, M1);
  };
  const normal = resolveWith('normal'), hard = resolveWith('hard');
  const entry = hard.state.actionLog.at(-1);
  assert.equal(schemeOf(hard.state).status, 'resolved');
  assert.equal(schemeOf(hard.state).resolutionId, entry.id);
  assert.equal(entry.playerControlled, false);
  assert.equal(entry.actorId, RIVAL);
  assert.equal(entry.estimate.refusal, null);
  assert.equal(entry.estimate.success, normal.state.actionLog.at(-1).estimate.success + 10, 'on hard the player\'s opponents get +10');
  assert.equal(hard.state.families[FAMILY].treasury, base().families[FAMILY].treasury, 'the player\'s wallet is untouched');
  assert.equal(hard.state.actionPoints, base().actionPoints);
});

test('every scheme step leaves the main random stream alone', () => {
  for (const seed of [RESOLVE_SEED, DISCOVER_SEED]) {
    const start = withSeed(base(), seed);
    const started = begin(start);
    const reinforced = run(started, 'reinforce_scheme', { schemeId: schemeOf(started).id, silver: 5 }).state;
    const aborted = run(reinforced, 'abort_scheme', { schemeId: schemeOf(reinforced).id }).state;
    for (const state of [started, reinforced, aborted, advance(started, M3), advance(reinforced, addGameMonths(START, 6))]) assert.equal(state.rngState, start.rngState);
  }
});

test('abort_scheme and reinforce_scheme are command ids that attempt_action points to', () => {
  const state = base();
  for (const actionId of ['abort_scheme', 'reinforce_scheme']) {
    const result = run(state, 'attempt_action', { actionId, actorId: REP, targetIds: [TARGET] });
    assert.equal(result.ok, false, actionId);
    assert.equal(result.error, COMMAND_MESSAGE, actionId);
  }
});

// A state holding a scheme of every status, for the load checks. The resolved one points at a real action log entry.
function loadable() {
  const resolved = advance(begin(withSeed(base(), RESOLVE_SEED)), M3);
  const state = copy(resolved);
  plant(state, { status: 'active' });
  plant(state, { status: 'discovered', discoveredAt: state.date });
  plant(state, { status: 'aborted' });
  plant(state, { status: 'failed' });
  return state;
}
const reload = (state) => normalizeCharacterSystem(copy(state));

test('an old save without schemes loads unchanged and a state with every scheme status round-trips', () => {
  const old = base();
  assert.deepEqual(old.schemes, []);
  assert.deepEqual(reload(old).schemes, []);
  const dropped = copy(old);
  delete dropped.schemes;
  assert.deepEqual(reload(dropped).schemes, []);
  const state = loadable();
  assert.deepEqual(state.schemes.map((item) => item.status), ['resolved', 'active', 'discovered', 'aborted', 'failed']);
  assert.deepEqual(reload(state).schemes, state.schemes);
  assert.deepEqual(domain(reload(state)), domain(state));
});

test('load validation rejects a scheme with a broken shape, reference, date or outcome', () => {
  const mutations = {
    'not an object': (s) => { s.schemes[1] = null; },
    'array entry': (s) => { s.schemes[1] = []; },
    'id without number': (s) => { s.schemes[1].id = 'scheme-x'; },
    'id zero': (s) => { s.schemes[1].id = 'scheme-0'; },
    'id of another kind': (s) => { s.schemes[1].id = 'plan-5'; },
    'id past the sequence': (s) => { s.schemes[1].id = `scheme-${s.sequence + 1}`; },
    'duplicate id': (s) => { s.schemes[2].id = s.schemes[1].id; },
    'unknown action': (s) => { s.schemes[1].actionId = 'conquer'; },
    'inherited action': (s) => { s.schemes[1].actionId = 'toString'; },
    'missing actor': (s) => { s.schemes[1].actorId = 'person-9-9'; },
    'no targets': (s) => { s.schemes[1].targetIds = []; },
    'targets not a list': (s) => { s.schemes[1].targetIds = TARGET; },
    'missing target': (s) => { s.schemes[1].targetIds = ['person-9-9']; },
    'repeated target': (s) => { s.schemes[1].targetIds = [TARGET, TARGET]; },
    'means missing': (s) => { delete s.schemes[1].means; },
    'means silver fraction': (s) => { s.schemes[1].means.silver = 2.5; },
    'means silver negative': (s) => { s.schemes[1].means.silver = -1; },
    'means roles not a list': (s) => { s.schemes[1].means.agentRoles = 'cook'; },
    'means unknown role': (s) => { s.schemes[1].means.agentRoles = ['king']; },
    'means repeated role': (s) => { s.schemes[1].means.agentRoles = ['cook', 'cook']; },
    'unknown status': (s) => { s.schemes[1].status = 'paused'; },
    'player flag missing': (s) => { delete s.schemes[1].playerControlled; },
    'player flag text': (s) => { s.schemes[1].playerControlled = 'yes'; },
    'command id bad': (s) => { s.schemes[1].commandId = 'has space'; },
    'command id number': (s) => { s.schemes[1].commandId = 4; },
    'start not canonical': (s) => { s.schemes[1].startedAt = '-300-1-1'; },
    'start in the future': (s) => { s.schemes[1].startedAt = addGameMonths(s.date, 1); },
    'due not a date': (s) => { s.schemes[1].dueAt = 'soon'; },
    'due not after start': (s) => { s.schemes[1].dueAt = s.schemes[1].startedAt; },
    'check before start': (s) => { s.schemes[1].nextCheckAt = addGameMonths(s.schemes[1].startedAt, -1); },
    'check after due': (s) => { s.schemes[1].nextCheckAt = addGameMonths(s.schemes[1].dueAt, 1); },
    'discovery date on an active scheme': (s) => { s.schemes[1].discoveredAt = s.date; },
    'discovered without a date': (s) => { s.schemes[2].discoveredAt = null; },
    'discovery date in the future': (s) => { s.schemes[2].discoveredAt = addGameMonths(s.date, 1); },
    'discovery before the start': (s) => { s.schemes[2].discoveredAt = addGameMonths(s.schemes[2].startedAt, -1); },
    'resolution on an active scheme': (s) => { s.schemes[1].resolutionId = s.actionLog[0].id; },
    'resolved without a resolution': (s) => { s.schemes[0].resolutionId = null; },
    'resolution not in the log': (s) => { s.schemes[0].resolutionId = 'resolution-999'; },
    'resolution of another action': (s) => { s.actionLog[0].actionId = 'sway'; },
    'resolution of another actor': (s) => { s.schemes[0].actorId = MEMBER; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const state = loadable();
    mutate(state);
    assert.throws(() => reload(state), { message: INVALID }, name);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getAvailableCharacterActions, getCatalogActions, getCharacterPresentation, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { ACTION_CATALOG, TIER_IDS, effectDefault } from './actionCatalog.js';
import { actionRandom } from './extensions.js';
import { TIER_TITLES, applyTierEffects, completeResolution, recordNarrative, tierFor, validateActionLog } from './actionResolution.js';
import { applyCharacterOpsToWorld, characterTransitionEvents } from '../characterWorld.js';

const REP = 'person-0-0';
const TARGET = 'person-1-0';
const MEMBER = 'person-0-2';
const OUTSIDER = 'person-2-1';
const FAMILY = 'family-arel';
// Action stream seeds for the base scene below (sway by the representative against TARGET: success 46, secrecy 46).
const CLEAN_SEED = 2027808452;
const BACKFIRE_SEED = 3668339987;
// First draw 31.71: below the refusal chance of a hostile member (70), above that of a loyal one (10).
const LOW_FIRST_DRAW = 2654435761;
const COMMAND_MESSAGE = 'Den här handlingen utförs med sitt vanliga kommando.';
const LOG_ERROR = /handlingsloggen/i;

const copy = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
const withSeed = (state, seed) => Object.assign(copy(state), { actionRngState: seed });
let counter = 0;
const run = (state, type, payload, id = `command-${++counter}`) => executeCharacterCommand(state, { id, expectedRevision: state.revision, type, payload });
const swayIntent = (extra = {}) => ({ actionId: 'sway', actorId: REP, targetIds: [TARGET], ...extra });
const attempt = (state, extra = {}, id) => run(state, 'attempt_action', swayIntent(extra), id);
const NARRATE_ONLY = 'Berättelsen kan bara skrivas av berättarsteget.';
const narrateWith = (state, origin, payload, id = `command-${++counter}`) => executeCharacterCommand(state, { id, expectedRevision: state.revision, type: 'record_action_narrative', origin, payload: { title: 'En vänlig gest', narrative: 'Gåvorna togs emot med ett leende.', adjustments: [], ...payload } });
const narrate = (state, payload, id) => narrateWith(state, 'narrate', payload, id);
const draws = (seed, count) => { const dice = { actionRngState: seed }; return { values: Array.from({ length: count }, () => actionRandom(dice) * 100), after: dice.actionRngState }; };
const lastResolution = (result) => result.state.actionLog.at(-1);
function hostileMember(state) {
  state.people[MEMBER].loyalty = 0;
  state.relations[`${MEMBER}:${REP}`] = { fromId: MEMBER, toId: REP, bonds: [], causes: [{ id: 'fixture', amount: -150, label: 'Provvärde', causeId: 'fixture', startAt: state.date, expiresAt: null }] };
  return state;
}
// A seed whose first two draws land on the tier for these odds. Test setup only.
function seedForOdds(successOdds, secrecyOdds, tier) {
  for (let k = 1; k < 5000; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    const [success, secrecy] = draws(seed, 2).values;
    if (tierFor(success, secrecy, successOdds, secrecyOdds) === tier) return seed;
  }
  throw new Error(`No seed for ${tier}.`);
}
function seedFor(state, intent, tier) {
  const estimate = estimateCharacterAction(state, intent);
  return seedForOdds(estimate.success.value, estimate.secrecy.value, tier);
}
// The action stream state whose next draw is `next` / 2^32: one xorshift step (13, 17, 5) undone, so a test can place a roll exactly.
function seedBefore(next) {
  const undoLeft = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y << k)) >>> 0; return y; };
  const undoRight = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y >>> k)) >>> 0; return y; };
  return undoLeft(undoRight(undoLeft(next >>> 0, 5), 17), 13);
}

test('tierFor: success below the odds, backfire in the top tenth of failures, exposure when the secrecy roll reaches the secrecy odds', () => {
  assert.equal(tierFor(45.99, 69.99, 46, 70), 'clean_success');
  assert.equal(tierFor(45.99, 70, 46, 70), 'exposed_success');
  assert.equal(tierFor(46, 10, 46, 70), 'quiet_failure');
  assert.equal(tierFor(94.5, 70, 46, 70), 'exposed_failure');
  assert.equal(tierFor(94.6, 10, 46, 70), 'backfire');
  assert.equal(tierFor(99.99, 99.99, 46, 70), 'backfire');
  assert.equal(tierFor(95, 0, 50, 70), 'backfire');
  assert.equal(tierFor(94.99, 0, 50, 70), 'quiet_failure');
});

test('a contested action charges, rolls once and applies its tier defaults', () => {
  const state = withSeed(base(), CLEAN_SEED);
  const before = { treasury: state.families[FAMILY].treasury, orders: state.actionPoints, opinion: getPersonalOpinion(state, TARGET, REP), rng: state.rngState, stress: state.people[REP].stress, sequence: state.sequence };
  const estimate = estimateCharacterAction(state, swayIntent());
  const result = attempt(state, {}, 'sway-once');
  assert.equal(result.ok, true, result.error);
  const after = result.state, resolution = lastResolution(result);
  const dice = draws(CLEAN_SEED, 2);
  assert.equal(resolution.tier, 'clean_success');
  assert.deepEqual(resolution.rolls, { refusal: null, success: dice.values[0], secrecy: dice.values[1] });
  assert.equal(after.actionRngState, dice.after, 'exactly two draws: success, then secrecy');
  assert.deepEqual(resolution.estimate, { success: estimate.success.value, secrecy: estimate.secrecy.value, refusal: null });
  assert.equal(after.families[FAMILY].treasury, before.treasury - ACTION_CATALOG.sway.cost.silver);
  assert.equal(after.actionPoints, before.orders - 1);
  const swing = effectDefault(ACTION_CATALOG.sway.tiers.clean_success.effects[0]);
  assert.equal(swing, 18);
  assert.equal(getPersonalOpinion(after, TARGET, REP), before.opinion + swing);
  assert.equal(after.rngState, before.rng);
  assert.equal(after.people[REP].stress, before.stress, 'a dutiful actor pays no stress for a duty action');
  assert.deepEqual(resolution.effects, [{ kind: 'opinion', fromId: TARGET, toId: REP, causeId: resolution.memoryId, label: 'Påverka: lyckat i det tysta', value: 18, applied: 18, min: 10, max: 25, default: 18 }]);
  assert.equal(after.actionLog.length, 1);
  assert.equal(resolution.id, `resolution-${before.sequence + 1}`);
  assert.equal(resolution.commandId, 'sway-once');
  assert.equal(resolution.actionId, 'sway');
  assert.equal(resolution.actorId, REP);
  assert.deepEqual(resolution.targetIds, [TARGET]);
  assert.deepEqual(resolution.agentIds, []);
  assert.equal(resolution.date, state.date);
  assert.equal(resolution.narrative, null);
  assert.equal(resolution.refused, false);
  assert.equal(resolution.playerControlled, true);
  assert.equal(resolution.precision, estimate.precision);
  const cause = after.relations[`${TARGET}:${REP}`].causes.find((item) => item.causeId === resolution.memoryId);
  assert.equal(cause.amount, 18);
  const memory = after.memories.find((item) => item.id === resolution.memoryId);
  assert.equal(memory.type, 'action');
  assert.deepEqual(memory.knownBy, [REP], 'a quiet tier is known by the actor only');
  const event = result.events.find((item) => item.type === 'action_resolution');
  assert.equal(event.title, 'Påverka: lyckat i det tysta');
  assert.equal(event.public, true);
  assert.doesNotMatch(event.description, /\d/, 'the chronicle shows no odds');
});

test('each tier is reachable', () => {
  const start = base();
  const seen = new Map();
  for (let k = 1; k <= 500 && seen.size < TIER_IDS.length; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    const result = attempt(withSeed(start, seed));
    assert.equal(result.ok, true, result.error);
    const resolution = lastResolution(result);
    if (!seen.has(resolution.tier)) seen.set(resolution.tier, result);
  }
  assert.deepEqual([...seen.keys()].sort(), [...TIER_IDS].sort());
  const opinionBefore = getPersonalOpinion(start, TARGET, REP);
  for (const [tier, result] of seen) {
    const resolution = lastResolution(result), envelope = ACTION_CATALOG.sway.tiers[tier].effects;
    assert.equal(resolution.effects.length, envelope.length, tier);
    resolution.effects.forEach((applied, index) => {
      assert.equal(applied.kind, envelope[index].kind);
      assert.equal(applied.value, effectDefault(envelope[index]));
      assert.equal(applied.default, effectDefault(envelope[index]));
    });
    const opinion = envelope.find((effect) => effect.kind === 'opinion');
    assert.equal(getPersonalOpinion(result.state, TARGET, REP), opinionBefore + (opinion ? effectDefault(opinion) : 0), tier);
    const stress = envelope.find((effect) => effect.kind === 'stress');
    assert.equal(result.state.people[REP].stress, start.people[REP].stress + (stress ? effectDefault(stress) : 0), tier);
    const memory = result.state.memories.find((item) => item.id === resolution.memoryId);
    assert.equal(memory.knownBy === 'public', ['exposed_success', 'exposed_failure', 'backfire'].includes(tier), tier);
    assert.equal(result.events.find((item) => item.type === 'action_resolution').title, `Påverka: ${TIER_TITLES[tier].toLowerCase()}`);
  }
});

test('a repeated command id neither charges nor rolls twice', () => {
  const first = attempt(withSeed(base(), CLEAN_SEED), {}, 'double-click');
  assert.equal(first.ok, true, first.error);
  const snapshot = copy(first.state);
  const second = executeCharacterCommand(first.state, { id: 'double-click', expectedRevision: first.state.revision, type: 'attempt_action', payload: swayIntent() });
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.state, first.state);
  assert.deepEqual(second.events, []);
  assert.deepEqual(first.state, snapshot);
  assert.equal(second.state.actionLog.length, 1);
  assert.equal(second.state.families[FAMILY].treasury, base().families[FAMILY].treasury - 5);
});

test('a dead or missing target is refused before any charge', () => {
  const dead = withSeed(base(), CLEAN_SEED);
  dead.people[TARGET].diedAt = dead.date;
  const snapshot = copy(dead);
  const refused = attempt(dead);
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'Målpersonen är död.');
  assert.equal(refused.state, dead);
  assert.deepEqual(dead, snapshot);
  const missing = attempt(withSeed(base(), CLEAN_SEED), { targetIds: ['person-9-9'] });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, 'Målet finns inte.');
});

test('a command id is refused with a pointer to its own command, before any charge', () => {
  const state = base();
  const types = getAvailableCharacterActions(state).map((action) => action.type);
  assert.ok(types.includes('rest') && types.includes('appoint'));
  for (const type of types) {
    const result = run(state, 'attempt_action', { actionId: type, actorId: REP, targetIds: [TARGET] });
    assert.equal(result.ok, false, type);
    assert.equal(result.error, COMMAND_MESSAGE, type);
    assert.equal(result.state, state);
  }
  assert.equal(run(state, 'attempt_action', { actionId: 'toString', actorId: REP, targetIds: [TARGET] }).error, 'Handlingen är okänd eller saknar odds.');
});

test('a scheme attempt that fails validation is refused before anything is rolled, paid or created', () => {
  const state = withSeed(base(), CLEAN_SEED);
  const snapshot = copy(state);
  const result = run(state, 'attempt_action', { actionId: 'undermine', actorId: REP, targetIds: [MEMBER], means: { agentRoles: ['cook'] } });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Målpersonen tillhör samma familj som aktören.');
  assert.equal(result.state, state);
  assert.deepEqual(state, snapshot);
});

test('an ordered household member can refuse', () => {
  const state = hostileMember(withSeed(base(), LOW_FIRST_DRAW));
  assert.equal(getPersonalOpinion(state, MEMBER, REP), -100);
  const before = { treasury: state.families[FAMILY].treasury, orders: state.actionPoints, stress: state.people[REP].stress, opinion: getPersonalOpinion(state, TARGET, MEMBER), staff: copy(state.courtStaff) };
  const result = attempt(state, { actorId: MEMBER, means: { silver: 10, agentRoles: ['cook'] } });
  assert.equal(result.ok, true, result.error);
  const resolution = lastResolution(result), dice = draws(LOW_FIRST_DRAW, 1);
  assert.equal(resolution.refused, true);
  assert.equal(resolution.estimate.refusal, 70);
  assert.deepEqual(resolution.rolls, { refusal: dice.values[0], success: null, secrecy: null });
  assert.ok(resolution.rolls.refusal < 70);
  assert.equal(result.state.actionRngState, dice.after, 'a refusal draws once and rolls no tier');
  assert.equal(resolution.tier, null);
  assert.deepEqual(resolution.effects, []);
  assert.deepEqual(resolution.agentIds, []);
  assert.equal(result.state.actionPoints, before.orders - 1, 'the order point is spent');
  assert.equal(result.state.families[FAMILY].treasury, before.treasury, 'no silver is spent');
  assert.equal(result.state.people[REP].stress, before.stress, 'a refused order costs the representative no stress');
  assert.equal(getPersonalOpinion(result.state, TARGET, MEMBER), before.opinion);
  assert.deepEqual(result.state.courtStaff, before.staff, 'no agent is hired for an action that never runs');
  const memory = result.state.memories.find((item) => item.id === resolution.memoryId);
  assert.equal(memory.type, 'order_refused');
  assert.deepEqual(memory.knownBy, [MEMBER, REP]);
  assert.equal(result.events.find((item) => item.type === 'order_refused').title, 'Påverka: ordern vägrades');
});

test('a loyal ordered member draws the refusal roll first, then success and secrecy', () => {
  const state = withSeed(base(), LOW_FIRST_DRAW);
  const estimate = estimateCharacterAction(state, swayIntent({ actorId: MEMBER }));
  assert.equal(estimate.ok, true, estimate.reason);
  const result = attempt(state, { actorId: MEMBER });
  assert.equal(result.ok, true, result.error);
  const resolution = lastResolution(result), dice = draws(LOW_FIRST_DRAW, 3);
  assert.equal(resolution.refused, false);
  assert.equal(resolution.estimate.refusal, 10);
  assert.deepEqual(resolution.rolls, { refusal: dice.values[0], success: dice.values[1], secrecy: dice.values[2] });
  assert.equal(resolution.tier, tierFor(dice.values[1], dice.values[2], estimate.success.value, estimate.secrecy.value));
  assert.equal(result.state.actionRngState, dice.after);
  assert.equal(result.state.families[FAMILY].treasury, state.families[FAMILY].treasury - 5);
});

test('a refusal roll equal to the refusal chance obeys the order', () => {
  const state = withSeed(base(), seedBefore(0x40000000));
  assert.equal(draws(state.actionRngState, 1).values[0], 25, 'the first draw is exactly 25');
  state.people[MEMBER].loyalty = 0;
  state.relations[`${MEMBER}:${REP}`] = { fromId: MEMBER, toId: REP, bonds: [], causes: [{ id: 'fixture', amount: 42, label: 'Provvärde', causeId: 'fixture', startAt: state.date, expiresAt: null }] };
  assert.equal(getPersonalOpinion(state, MEMBER, REP), 50);
  const result = attempt(state, { actorId: MEMBER });
  assert.equal(result.ok, true, result.error);
  const resolution = lastResolution(result);
  assert.deepEqual([resolution.estimate.refusal, resolution.rolls.refusal, resolution.refused], [25, 25, false]);
  assert.ok(TIER_IDS.includes(resolution.tier));
  assert.equal(result.state.actionRngState, draws(state.actionRngState, 3).after);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(result.state)));
  const forged = copy(result.state);
  Object.assign(forged.actionLog.at(-1), { refused: true, tier: null, effects: [], agentIds: [], rolls: { refusal: 25, success: null, secrecy: null } });
  assert.throws(() => normalizeCharacterSystem(forged), LOG_ERROR, 'a roll equal to the chance cannot be stored as a refusal');
});

test('in realm mode the ruler gives the orders: a ruler who is not the family head acts without a refusal draw', () => {
  const state = withSeed(base(), LOW_FIRST_DRAW);
  state.offices.ruler.holderId = MEMBER;
  const view = getCharacterPresentation(state);
  assert.equal(view.mode, 'realm');
  assert.equal(view.representative.id, MEMBER, 'the active representative is the ruler');
  assert.equal(state.families[FAMILY].headId, REP, 'the household representative is the family head');
  const result = attempt(state, { actorId: MEMBER });
  assert.equal(result.ok, true, result.error);
  const resolution = lastResolution(result), dice = draws(LOW_FIRST_DRAW, 2);
  assert.deepEqual([resolution.refused, resolution.estimate.refusal, resolution.rolls.refusal], [false, null, null]);
  assert.deepEqual([resolution.rolls.success, resolution.rolls.secrecy], dice.values);
  assert.equal(result.state.actionRngState, dice.after, 'exactly the two rolls');
  assert.equal(result.state.families[FAMILY].treasury, state.families[FAMILY].treasury - 5, 'the household still pays');
  const head = attempt(state, { actorId: REP });
  assert.equal(head.ok, true, head.error);
  assert.equal(typeof lastResolution(head).estimate.refusal, 'number', 'the family head takes the ruler\'s order like any other member');
});

test('only the representative, household adults and office holders under a ruling representative can be ordered', () => {
  const realm = base();
  assert.equal(estimateCharacterAction(realm, swayIntent({ actorId: OUTSIDER })).reason, 'Aktören står inte under din order.');
  assert.equal(estimateCharacterAction(realm, swayIntent({ actorId: 'person-2-2' })).ok, true, 'the chancellor serves a ruling representative');
  assert.equal(run(realm, 'attempt_action', swayIntent({ actorId: OUTSIDER })).error, 'Aktören står inte under din order.');
  const family = createCharacterSystem({ seed: 321, mode: 'family', familyId: 'family-eshmun' });
  assert.equal(estimateCharacterAction(family, { actionId: 'sway', actorId: 'person-1-2', targetIds: [REP] }).reason, 'Aktören står inte under din order.', 'the general does not serve a family that does not rule');
  assert.equal(estimateCharacterAction(family, { actionId: 'sway', actorId: 'person-2-1', targetIds: [REP] }).ok, true);
});

test('an estimate through the engine context is pure and reads the family wallet', () => {
  const state = base();
  const snapshot = copy(state);
  const estimate = estimateCharacterAction(state, swayIntent({ means: { silver: 60 } }));
  assert.equal(estimate.ok, true);
  assert.equal(estimate.cost.silver, 65);
  assert.deepEqual(state, snapshot);
  state.families[FAMILY].treasury = 64;
  assert.equal(estimateCharacterAction(state, swayIntent({ means: { silver: 60 } })).reason, 'Det behövs 65 silver; tillgängligt 64.');
});

test('agents are created when the action runs and reused by the next action', () => {
  const first = attempt(withSeed(base(), CLEAN_SEED), { means: { silver: 10, agentRoles: ['cook', 'guard_captain'] } });
  assert.equal(first.ok, true, first.error);
  const resolution = lastResolution(first);
  assert.equal(resolution.agentIds.length, 2);
  assert.deepEqual(resolution.agentIds.map((id) => first.state.courtStaff[id].role), ['cook', 'guard_captain']);
  assert.ok(resolution.agentIds.every((id) => first.state.courtStaff[id].familyId === FAMILY));
  assert.equal(first.state.families[FAMILY].treasury, base().families[FAMILY].treasury - 15);
  const second = attempt(first.state, { means: { agentRoles: ['cook'] } });
  assert.equal(second.ok, true, second.error);
  assert.deepEqual(lastResolution(second).agentIds, [resolution.agentIds[0]]);
});

test('out-of-envelope adjustments are dropped and the narrative is kept', () => {
  const acted = attempt(withSeed(base(), BACKFIRE_SEED));
  const resolution = lastResolution(acted);
  assert.equal(resolution.tier, 'backfire');
  assert.deepEqual(resolution.effects.map((effect) => [effect.kind, effect.value, effect.min, effect.max]), [['opinion', -22, -30, -15], ['stress', 8, 5, 10]]);
  const opinion = getPersonalOpinion(acted.state, TARGET, REP), stress = acted.state.people[REP].stress;
  const result = narrate(acted.state, { resolutionId: resolution.id, adjustments: [
    { effectIndex: 1, value: 10 },
    { effectIndex: 0, value: -50 },
    { effectIndex: 0, value: -20.5 },
    { effectIndex: 2, value: 0 },
    { effectIndex: 1, value: 6 },
    { effectIndex: '0', value: -16 },
    'junk',
    null,
  ] });
  assert.equal(result.ok, true, result.error);
  const saved = lastResolution(result);
  assert.deepEqual(saved.narrative, { title: 'En vänlig gest', text: 'Gåvorna togs emot med ett leende.' });
  assert.equal(saved.rejectedAdjustments, 7);
  assert.equal(saved.effects[1].value, 10);
  assert.equal(saved.effects[1].default, 8);
  assert.equal(saved.effects[0].value, -22);
  assert.equal(result.state.people[REP].stress, stress + 2);
  assert.equal(getPersonalOpinion(result.state, TARGET, REP), opinion);
  assert.equal(result.state.actionRngState, acted.state.actionRngState, 'a narrative never rolls');
  const event = result.events.find((item) => item.type === 'action_narrative');
  assert.equal(event.title, 'En vänlig gest');
  assert.equal(event.description, 'Gåvorna togs emot med ett leende.');
  const dropped = narrate(attempt(withSeed(base(), BACKFIRE_SEED)).state, { resolutionId: resolution.id, adjustments: [{ effectIndex: 0, value: 99 }] });
  assert.equal(dropped.ok, true, dropped.error);
  assert.equal(lastResolution(dropped).rejectedAdjustments, 1);
  assert.equal(lastResolution(dropped).narrative.title, 'En vänlig gest');
});

test('an adjustment inside the envelope moves the field from where the effect found it and never past a bound', () => {
  // [stress before, change the backfire's +8 took, stress after the adjustment to +5, change the +5 took]
  for (const [before, applied, adjusted, appliedAfter] of [[195, 5, 200, 5], [200, 0, 200, 0], [100, 8, 105, 5]]) {
    const start = withSeed(base(), BACKFIRE_SEED);
    start.people[REP].stress = before;
    const acted = attempt(start);
    const resolution = lastResolution(acted);
    assert.equal(resolution.tier, 'backfire', `stress ${before}`);
    assert.equal(acted.state.people[REP].stress, Math.min(200, before + 8), 'stress stops at 200');
    assert.deepEqual([resolution.effects[1].value, resolution.effects[1].applied], [8, applied], `stress ${before}`);
    const opinion = getPersonalOpinion(acted.state, TARGET, REP);
    const result = narrate(acted.state, { resolutionId: resolution.id, adjustments: [{ effectIndex: 0, value: -30 }, { effectIndex: 1, value: 5 }] });
    assert.equal(result.ok, true, result.error);
    const saved = lastResolution(result);
    assert.equal(saved.rejectedAdjustments, 0);
    assert.equal(getPersonalOpinion(result.state, TARGET, REP), opinion - 8);
    assert.equal(result.state.relations[`${TARGET}:${REP}`].causes.find((item) => item.causeId === resolution.memoryId).amount, -30);
    assert.equal(result.state.people[REP].stress, adjusted, `a smaller backfire never lowers stress below ${before}`);
    assert.ok(result.state.people[REP].stress >= before);
    assert.deepEqual(saved.effects.map((effect) => [effect.value, effect.applied]), [[-30, -30], [5, appliedAfter]]);
    assert.doesNotThrow(() => normalizeCharacterSystem(copy(result.state)));
  }
});

// A hand-built undermine resolution with its tier's effects applied, appended to the action log so a narrative can adjust it.
function undermineResolution(state, tier) {
  const hooks = testHooks(state);
  const anchor = hooks.memory('action', 'Provminne', [REP, TARGET], { knownBy: [REP] });
  const resolution = { id: `resolution-${++state.sequence}`, commandId: null, actionId: 'undermine', actorId: REP, targetIds: [TARGET], date: state.date,
    estimate: { success: 45, secrecy: 60, refusal: null }, rolls: { refusal: null, success: ROLLS_FOR[tier][0], secrecy: ROLLS_FOR[tier][1] }, tier,
    effects: [], narrative: null, refused: false, agentIds: [], playerControlled: true, precision: 'three', memoryId: anchor.id };
  resolution.effects = applyTierEffects(state, resolution, ACTION_CATALOG.undermine, hooks);
  state.actionLog.push(resolution);
  return resolution;
}
const influenceAfter = (state, resolution, value) => {
  const result = narrate(state, { resolutionId: resolution.id, adjustments: [{ effectIndex: 0, value }] });
  assert.equal(result.ok, true, result.error);
  assert.equal(lastResolution(result).rejectedAdjustments, 0);
  const effect = lastResolution(result).effects[0];
  return { influence: result.state.families[effect.familyId].influence, effect };
};

test('influence at 0: an undermine adjustment never raises the target family above where the effect found it', () => {
  for (const [before, applied] of [[0, 0], [3, -3]]) {
    const state = base();
    state.families['family-namar'].influence = before;
    const resolution = undermineResolution(state, 'clean_success');
    assert.deepEqual([resolution.effects[0].kind, resolution.effects[0].familyId, resolution.effects[0].value, resolution.effects[0].applied], ['influence', 'family-namar', -7, applied]);
    assert.equal(state.families['family-namar'].influence, 0);
    for (const value of [-10, -4]) {
      const { influence, effect } = influenceAfter(state, resolution, value);
      assert.equal(influence, 0, `influence ${before}, adjusted to ${value}`);
      assert.deepEqual([effect.value, effect.applied], [value, applied]);
    }
  }
});

test('influence at 100 and beyond: an undermine adjustment moves the field down from where the effect found it and never pulls it back', () => {
  for (const before of [100, 110]) {
    const state = base();
    state.families[FAMILY].influence = before;
    const resolution = undermineResolution(state, 'backfire');
    assert.deepEqual([resolution.effects[0].kind, resolution.effects[0].familyId, resolution.effects[0].value, resolution.effects[0].applied], ['influence', FAMILY, -5, -5]);
    assert.equal(state.families[FAMILY].influence, before - 5, 'a family the engine left above 100 is not pulled back to 100');
    for (const value of [-8, -3]) {
      const { influence, effect } = influenceAfter(state, resolution, value);
      assert.equal(influence, before + value, `influence ${before}, adjusted to ${value}`);
      assert.ok(influence < before);
      assert.deepEqual([effect.value, effect.applied], [value, value]);
    }
  }
});

test('stress that fell between the attempt and its narrative stays at 0 or above, and the adjustment moves it only its own way', () => {
  // Stress 2, backfire +8 gives 10; a rest brings it to 0 before the narrative. [adjusted value, stress after, change the value took]
  for (const [value, stress, applied] of [[5, 0, 0], [10, 2, 2]]) {
    const start = withSeed(base(), BACKFIRE_SEED);
    start.people[REP].stress = 2;
    const acted = attempt(start);
    const resolution = lastResolution(acted);
    assert.equal(resolution.tier, 'backfire');
    assert.deepEqual([acted.state.people[REP].stress, resolution.effects[1].value, resolution.effects[1].applied], [10, 8, 8]);
    acted.state.people[REP].stress = 0;
    const result = narrate(acted.state, { resolutionId: resolution.id, adjustments: [{ effectIndex: 1, value }] });
    assert.equal(result.ok, true, result.error);
    assert.equal(lastResolution(result).rejectedAdjustments, 0);
    assert.equal(result.state.people[REP].stress, stress, `adjusted to ${value}`);
    assert.deepEqual([lastResolution(result).effects[1].value, lastResolution(result).effects[1].applied], [value, applied]);
    assert.doesNotThrow(() => normalizeCharacterSystem(copy(result.state)), `adjusted to ${value}`);
  }
});

test('influence that rose between the attempt and its narrative stays at 100 or below, and the adjustment moves it only its own way', () => {
  // Influence 100, backfire -5 gives 95; the family regains 5 before the narrative. [adjusted value, influence after, change the value took]
  for (const [value, influence, applied] of [[-3, 100, 0], [-8, 97, -3]]) {
    const state = base();
    state.families[FAMILY].influence = 100;
    const resolution = undermineResolution(state, 'backfire');
    assert.deepEqual([state.families[FAMILY].influence, resolution.effects[0].applied], [95, -5]);
    state.families[FAMILY].influence = 100;
    const after = influenceAfter(state, resolution, value);
    assert.deepEqual([after.influence, after.effect.value, after.effect.applied], [influence, value, applied], `adjusted to ${value}`);
  }
});

test('a narrative can be recorded once', () => {
  const acted = attempt(withSeed(base(), CLEAN_SEED));
  const resolutionId = lastResolution(acted).id;
  const first = narrate(acted.state, { resolutionId });
  assert.equal(first.ok, true, first.error);
  const second = narrate(first.state, { resolutionId, title: 'En andra version' });
  assert.equal(second.ok, false);
  assert.equal(second.error, 'Utfallet har redan en berättelse.');
  assert.equal(second.state, first.state);
  assert.equal(narrate(acted.state, { resolutionId: 'resolution-99999' }).error, 'Utfallet finns inte.');
  assert.equal(narrate(acted.state, { resolutionId, title: 'x'.repeat(121) }).error, 'Rubriken måste vara en text på 1 till 120 tecken.');
  assert.equal(narrate(acted.state, { resolutionId, title: '   ' }).error, 'Rubriken måste vara en text på 1 till 120 tecken.');
  assert.equal(narrate(acted.state, { resolutionId, narrative: 'x'.repeat(1501) }).error, 'Berättelsen måste vara en text på 1 till 1 500 tecken.');
  assert.equal(narrate(acted.state, { resolutionId, narrative: 42 }).error, 'Berättelsen måste vara en text på 1 till 1 500 tecken.');
  assert.equal(narrate(acted.state, { resolutionId, title: 'x'.repeat(120), narrative: 'y'.repeat(1500) }).ok, true);
  const refused = attempt(hostileMember(withSeed(base(), LOW_FIRST_DRAW)), { actorId: MEMBER });
  assert.equal(narrate(refused.state, { resolutionId: lastResolution(refused).id }).error, 'En vägrad order har inget utfall att berätta om.');
});

const testHooks = (state) => ({
  memory: (type, title, participants, options = {}) => {
    const item = { id: `memory-${++state.sequence}`, date: state.date, type, title, participants, causeId: options.causeId ?? null, knownBy: options.knownBy ?? 'public', familyIds: [], ...options };
    state.memories.push(item);
    return item;
  },
  opinionCause: (fromId, toId, amount, label, causeId) => {
    const key = `${fromId}:${toId}`;
    state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
    state.relations[key].causes.push({ id: `opinion-${++state.sequence}`, amount, label, causeId, startAt: state.date, expiresAt: null });
  },
});
// Rolls that land on each tier for an estimate of 45 / 60, so a hand-built entry is consistent with its tier.
const ROLLS_FOR = { clean_success: [10, 10], exposed_success: [10, 70], quiet_failure: [50, 10], exposed_failure: [50, 70], backfire: [99, 10] };

test('applyTierEffects applies every undermine envelope at its defaults, and the result validates', () => {
  const entry = ACTION_CATALOG.undermine;
  for (const tier of TIER_IDS) {
    const state = base();
    const hooks = testHooks(state);
    const anchor = hooks.memory('action', 'Provminne', [REP, TARGET], { knownBy: [REP] });
    const influence = { actor: state.families[FAMILY].influence, target: state.families['family-namar'].influence };
    const resolution = { id: `resolution-${++state.sequence}`, commandId: null, actionId: 'undermine', actorId: REP, targetIds: [TARGET], date: state.date,
      estimate: { success: 45, secrecy: 60, refusal: null }, rolls: { refusal: null, success: ROLLS_FOR[tier][0], secrecy: ROLLS_FOR[tier][1] }, tier,
      effects: [], narrative: null, refused: false, agentIds: [], playerControlled: true, precision: 'three', memoryId: anchor.id };
    assert.equal(tierFor(resolution.rolls.success, resolution.rolls.secrecy, 45, 60), tier);
    resolution.effects = applyTierEffects(state, resolution, entry, hooks);
    const envelope = entry.tiers[tier].effects;
    assert.deepEqual(resolution.effects.map((effect) => effect.kind), envelope.map((effect) => effect.kind), tier);
    for (const [index, effect] of envelope.entries()) {
      const applied = resolution.effects[index];
      if (effect.kind === 'influence') {
        assert.equal(applied.familyId, effect.family === 'actor' ? FAMILY : 'family-namar');
        assert.equal(state.families[applied.familyId].influence, influence[effect.family] + effectDefault(effect));
      }
      if (effect.kind === 'opinion') assert.equal(getPersonalOpinion(state, TARGET, REP), effectDefault(effect));
      if (effect.kind === 'memory') {
        const memory = state.memories.find((item) => item.id === applied.memoryId);
        assert.equal(memory.title, effect.title);
        assert.deepEqual(memory.knownBy, effect.visibility === 'private' ? [REP] : 'public');
        assert.equal(memory.causeId, anchor.id);
      }
      if (effect.kind === 'secret') {
        const secret = state.secrets.find((item) => item.id === applied.secretId);
        assert.equal(secret.type, 'plot');
        assert.equal(secret.subjectId, REP);
        assert.deepEqual(secret.holderIds, effect.holders.map((role) => (role === 'actor' ? REP : TARGET)));
        assert.equal(secret.causeId, anchor.id);
      }
      if (effect.kind === 'hook') {
        const hook = state.hooks.find((item) => item.id === applied.hookId);
        assert.deepEqual([hook.ownerId, hook.targetId, hook.strength, hook.causeId], [TARGET, REP, 'weak', anchor.id]);
      }
    }
    state.actionLog.push(resolution);
    assert.doesNotThrow(() => validateActionLog(state), tier);
    assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)), tier);
  }
});

test('no tier of the catalog names the same opinion pair twice, so one cause per pair and resolution suffices', () => {
  for (const entry of Object.values(ACTION_CATALOG)) for (const tier of TIER_IDS) {
    const pairs = entry.tiers[tier].effects.filter((effect) => effect.kind === 'opinion').map((effect) => `${effect.from}>${effect.to}`);
    assert.equal(new Set(pairs).size, pairs.length, `${entry.id} ${tier}`);
  }
});

function playedState() {
  let state = withSeed(base(), CLEAN_SEED);
  const steps = [
    (s) => attempt(s, { means: { silver: 5, agentRoles: ['steward'] } }),
    (s) => narrate(s, { resolutionId: s.actionLog.at(-1).id, adjustments: [{ effectIndex: 0, value: 25 }, { effectIndex: 0, value: 99 }] }),
    (s) => attempt(hostileMember(Object.assign(copy(s), { actionRngState: LOW_FIRST_DRAW })), { actorId: MEMBER }),
    (s) => attempt(Object.assign(copy(s), { actionRngState: BACKFIRE_SEED })),
    (s) => attempt(s, { actorId: 'person-0-3', targetIds: ['person-2-0'] }),
  ];
  for (const step of steps) { const result = step(state); assert.equal(result.ok, true, result.error); state = result.state; }
  return state;
}

test('a log produced by play validates after several actions and a JSON round trip', () => {
  const state = playedState();
  assert.equal(state.actionLog.length, 4);
  assert.ok(state.actionLog.some((entry) => entry.refused));
  assert.ok(state.actionLog.some((entry) => entry.narrative));
  const restored = normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.actionLog, state.actionLog);
  assert.deepEqual(restored, state);
});

test('an entry written before effects recorded their applied change still loads and adjusts by its value', () => {
  const state = playedState();
  for (const entry of state.actionLog) for (const effect of entry.effects) delete effect.applied;
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)));
  const acted = attempt(withSeed(base(), BACKFIRE_SEED));
  const old = copy(acted.state);
  for (const effect of old.actionLog.at(-1).effects) delete effect.applied;
  const result = narrate(old, { resolutionId: old.actionLog.at(-1).id, adjustments: [{ effectIndex: 1, value: 6 }] });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.people[REP].stress, acted.state.people[REP].stress - 2);
  assert.deepEqual([lastResolution(result).effects[1].value, lastResolution(result).effects[1].applied], [6, 6]);
});

test('a forged action log entry is rejected on load', () => {
  const state = playedState();
  const success = state.actionLog.findIndex((entry) => !entry.refused && entry.narrative);
  const refused = state.actionLog.findIndex((entry) => entry.refused);
  const forgeries = {
    'id beyond the sequence': (s) => { s.actionLog[success].id = `resolution-${s.sequence + 1}`; },
    'id in another format': (s) => { s.actionLog[success].id = 'resolution-007'; },
    'duplicate id': (s) => { s.actionLog[refused].id = s.actionLog[success].id; },
    'unknown action': (s) => { s.actionLog[success].actionId = 'poison'; },
    'inherited action name': (s) => { s.actionLog[success].actionId = 'toString'; },
    'unknown tier': (s) => { s.actionLog[success].tier = 'triumph'; },
    'tier the rolls do not give': (s) => { s.actionLog[success].tier = 'backfire'; },
    'missing actor': (s) => { s.actionLog[success].actorId = 'person-9-9'; },
    'missing target': (s) => { s.actionLog[success].targetIds = ['person-9-9']; },
    'missing agent': (s) => { s.actionLog[success].agentIds = ['staff-99999']; },
    'missing memory': (s) => { s.actionLog[success].memoryId = 'memory-99999'; },
    'roll as text': (s) => { s.actionLog[success].rolls.success = '12'; },
    'roll out of range': (s) => { s.actionLog[success].rolls.secrecy = 100; },
    'odds out of range': (s) => { s.actionLog[success].estimate.success = 99; },
    'future date': (s) => { s.actionLog[success].date = '0100-01-01'; },
    'narrative title too long': (s) => { s.actionLog[success].narrative.title = 'x'.repeat(121); },
    'narrative text too long': (s) => { s.actionLog[success].narrative.text = 'x'.repeat(1501); },
    'narrative with another shape': (s) => { s.actionLog[success].narrative = 'En berättelse'; },
    'unknown effect kind': (s) => { s.actionLog[success].effects[0].kind = 'gold'; },
    'effect value outside its range': (s) => { s.actionLog[success].effects[0].value = 26; },
    'applied change beyond its value': (s) => { s.actionLog[success].effects[0].applied = s.actionLog[success].effects[0].value + 1; },
    'applied change with the opposite sign': (s) => { s.actionLog[success].effects[0].applied = -s.actionLog[success].effects[0].value; },
    'applied change that is not a number': (s) => { s.actionLog[success].effects[0].applied = '25'; },
    'effect on a missing person': (s) => { s.actionLog[success].effects[0].fromId = 'person-9-9'; },
    'refused entry with a tier': (s) => { s.actionLog[refused].tier = 'clean_success'; },
    'refused entry above its refusal chance': (s) => { s.actionLog[refused].rolls.refusal = 80; },
    'refused entry with effects': (s) => { s.actionLog[refused].effects = copy(s.actionLog[success].effects); },
    'narrative on a refused entry': (s) => { s.actionLog[refused].narrative = { title: 'Ja', text: 'Nej' }; },
    'rejected count without a narrative': (s) => { s.actionLog[refused].rejectedAdjustments = 0; },
    'entry that is not an object': (s) => { s.actionLog.push('resolution'); },
  };
  for (const [name, forge] of Object.entries(forgeries)) {
    const forged = copy(state);
    forge(forged);
    assert.throws(() => normalizeCharacterSystem(forged), LOG_ERROR, name);
  }
});

test('the presentation carries the catalog, the difficulty, visible recent resolutions and the family schemes', () => {
  const played = playedState();
  const view = getCharacterPresentation(played);
  assert.deepEqual(view.catalog, getCatalogActions(played));
  assert.deepEqual(view.difficulty, { id: 'normal', label: 'Normal' });
  assert.deepEqual(getCharacterPresentation(createCharacterSystem({ seed: 321, difficulty: 'hard' })).difficulty, { id: 'hard', label: 'Svår' });
  assert.deepEqual(view.recentResolutions.map((entry) => entry.id), played.actionLog.map((entry) => entry.id));
  const own = view.recentResolutions[0];
  assert.equal(own.actionLabel, 'Påverka');
  assert.equal(own.actorName, played.people[REP].name);
  assert.deepEqual(own.targetNames, [played.people[TARGET].name]);
  assert.equal(own.tierLabel, TIER_TITLES[own.tier]);
  assert.equal(own.precision, undefined);
  assert.equal(own.rolls, undefined, 'the dice would bound the hidden odds');
  assert.deepEqual(own.odds, { success: 'osäker', secrecy: 'osäker' }, 'three-band precision shows bands, never numbers');
  assert.equal(view.recentResolutions.find((entry) => entry.refused).tierLabel, 'Ordern vägrades');

  const state = copy(played);
  const template = state.actionLog[0];
  const npc = (tier, id) => ({ ...copy(template), id, commandId: null, actorId: OUTSIDER, playerControlled: false, tier });
  state.actionLog.push(npc('clean_success', 'resolution-hidden-1'), npc('quiet_failure', 'resolution-hidden-2'), npc('exposed_failure', 'resolution-shown'));
  const mixed = getCharacterPresentation(state).recentResolutions;
  assert.ok(!mixed.some((entry) => entry.id.startsWith('resolution-hidden')), 'quiet tiers by others stay hidden');
  const exposed = mixed.find((entry) => entry.id === 'resolution-shown');
  assert.equal(exposed.odds, null, 'the odds of another family are not shown');
  for (let i = 0; i < 12; i++) state.actionLog.push({ ...copy(template), id: `resolution-extra-${i}` });
  const recent = getCharacterPresentation(state).recentResolutions;
  assert.equal(recent.length, 10);
  assert.equal(recent.at(-1).id, 'resolution-extra-11');

  state.schemes = [
    { id: 'scheme-1', actionId: 'undermine', actorId: MEMBER, targetIds: [TARGET], status: 'active', playerControlled: true },
    { id: 'scheme-2', actionId: 'undermine', actorId: OUTSIDER, targetIds: [REP], status: 'active' },
    { id: 'scheme-3', actionId: 'undermine', actorId: REP, targetIds: [TARGET], status: 'aborted' },
  ];
  const schemes = getCharacterPresentation(state).schemes;
  assert.deepEqual(schemes.map((scheme) => scheme.id), ['scheme-1']);
  assert.equal(schemes[0].actionLabel, 'Undergräv');
  assert.deepEqual(schemes[0].targetNames, [state.people[TARGET].name]);
});

// Test hooks with the engine's logEvent semantics (public unless the extra says otherwise) and the base scene's household as the player's.
const engineHooks = (state) => ({
  ...testHooks(state),
  logEvent: (events, type, title, description, participants = [], extra = {}) => {
    const event = { id: `event-${++state.sequence}`, date: state.date, type, title, description, participants: participants.filter(Boolean), public: true, ...extra };
    state.log.push(event); events.push(event); return event;
  },
  controlledFamily: () => state.families[FAMILY], householdRepresentative: () => state.people[REP], activeRepresentative: () => state.people[REP],
});

// A sway the player did not order (playerControlled false), rolled to `tier` and narrated, and where the player and the world can see it.
function unorderedSway(actorId, tier) {
  const before = withSeed(base(), seedForOdds(45, 60, tier));
  const state = copy(before), events = [], hooks = engineHooks(state);
  const resolution = { id: `resolution-${++state.sequence}`, commandId: null, actionId: 'sway', actorId, targetIds: [TARGET], agentIds: [], date: state.date,
    playerControlled: false, precision: 'three', memoryId: null, estimate: { success: 45, secrecy: 60, refusal: null }, rolls: { refusal: null, success: null, secrecy: null },
    tier: null, effects: [], narrative: null, refused: false };
  completeResolution(state, resolution, ACTION_CATALOG.sway, events, hooks);
  assert.equal(resolution.tier, tier);
  recordNarrative(state, { resolutionId: resolution.id, title: 'Ett samtal i trädgården', narrative: 'Ingen utanför huset fick veta något.' }, hooks, events);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)), tier);
  const view = getCharacterPresentation(state);
  const world = characterTransitionEvents(before, { ok: true, state, events }, `npc-${actorId}-${tier}`);
  return {
    events: events.map((event) => [event.type, event.public]),
    log: view.log.some((event) => events.some((own) => own.id === event.id)),
    recentResolutions: view.recentResolutions.some((entry) => entry.id === resolution.id),
    memory: view.memories.some((memory) => memory.id === resolution.memoryId),
    world: world.some((event) => events.some((own) => own.title === event.title)),
  };
}

test('a resolution of another family reaches the log and the world only when its tier exposed it', () => {
  for (const [tier, shown] of [['quiet_failure', false], ['clean_success', false], ['exposed_failure', true]]) {
    assert.deepEqual(unorderedSway(OUTSIDER, tier), { events: [['action_resolution', shown], ['action_narrative', shown]], log: shown, recentResolutions: shown, memory: shown, world: shown }, tier);
  }
});

test('a quiet resolution by a member of the controlled family stays visible to the player though the player did not order it', () => {
  const seen = unorderedSway(MEMBER, 'quiet_failure');
  assert.deepEqual(seen.events, [['action_resolution', true], ['action_narrative', true]]);
  assert.deepEqual([seen.log, seen.recentResolutions, seen.world], [true, true, true]);
});

test('replay of the stored patch reproduces the resolution without rolling', () => {
  const before = withSeed(base(), seedFor(base(), swayIntent(), 'exposed_failure'));
  const result = attempt(before);
  assert.equal(result.ok, true, result.error);
  assert.equal(lastResolution(result).tier, 'exposed_failure');
  const events = characterTransitionEvents(before, result, 'attempt-replay');
  const ops = events.at(-1).impacts.characterOps;
  assert.equal(ops.length, 1);
  assert.equal(ops[0].kind, 'patch');
  const replay = applyCharacterOpsToWorld({ characterSystem: before }, ops, { source: 'character-system' });
  assert.deepEqual(replay.characterSystem, result.state);
  // A base with another action stream proves the replay applies the stored result: rolling again would land elsewhere.
  const reseeded = Object.assign(copy(before), { actionRngState: CLEAN_SEED });
  assert.notEqual(lastResolution(attempt(reseeded)).tier, 'exposed_failure');
  const stored = applyCharacterOpsToWorld({ characterSystem: reseeded }, ops, { source: 'character-system' });
  assert.deepEqual(stored.characterSystem, result.state);
  assert.deepEqual(stored.characterSystem.actionLog.at(-1).rolls, lastResolution(result).rolls);
});

test('only the narrate step may record an action narrative', () => {
  const acted = attempt(withSeed(base(), CLEAN_SEED));
  const resolutionId = lastResolution(acted).id;
  for (const origin of ['player', 'gate', undefined]) {
    const result = narrateWith(acted.state, origin, { resolutionId });
    assert.equal(result.ok, false);
    assert.equal(result.error, NARRATE_ONLY);
    assert.deepEqual(result.state, acted.state);
    assert.equal(result.state.actionLog.at(-1).narrative, null);
  }
  assert.equal(narrateWith(acted.state, 'narrate', { resolutionId }).ok, true);
});

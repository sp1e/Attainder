import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { RUMOR_TOPICS as CATALOG_TOPICS } from './actionCatalog.js';
import { tierFor } from './actionResolution.js';
import { isAdultCharacter } from './characterCapacity.js';
import { buildCharacterPromptContext } from '../characterWorld.js';
import { actionHooks, advanceCharacters, createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { actionRandom, plotRandom } from './extensions.js';
import { imprisonPerson } from './prisoners.js';
import { RUMOR_TOPICS, createRumor, hearScheme, presentRumors, validateRumors } from './rumors.js';

const REP = 'person-0-0';
const SERA = 'person-0-2';
const NAMAR = 'person-1-0';
const BAREK = 'person-2-2';
const ARELS = 'family-arel';
const ESHMUNS = 'family-eshmun';
const INVALID = /(Ryktena|Ett rykte)/;

const copy = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
const run = (state, type, payload) => executeCharacterCommand(state, { id: `command-${++counter}`, expectedRevision: state.revision, type, payload });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const advance = (state, date) => { const result = advanceCharacters(state, date); assert.equal(result.ok, true, result.error); return result.state; };
const withSeed = (state, seed) => Object.assign(copy(state), { actionRngState: seed });
const withPlot = (state, seed) => Object.assign(copy(state), { plotRngState: seed });
const START = base().date;
const MONTH = addGameMonths(START, 1);

const plotDraws = (seed, count) => { const dice = { plotRngState: seed }; return Array.from({ length: count }, () => plotRandom(dice) * 100); };
const actionDraws = (seed, count) => { const dice = { actionRngState: seed }; return Array.from({ length: count }, () => actionRandom(dice) * 100); };
// Seeds whose first draws satisfy one check; test setup only.
function seedFor(draw, count, check) {
  for (let k = 1; k < 400000; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    if (check(draw(seed, count))) return seed;
  }
  throw new Error('No seed for these draws.');
}
const plotSeedWhere = (count, check) => seedFor(plotDraws, count, check);
const actionSeedWhere = (count, check) => seedFor(actionDraws, count, check);
// The action stream state whose next draw is `next` / 2^32: one xorshift step undone.
function seedBefore(next) {
  const undoLeft = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y << k)) >>> 0; return y; };
  const undoRight = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y >>> k)) >>> 0; return y; };
  return undoLeft(undoRight(undoLeft(next >>> 0, 5), 17), 13);
}

// An NPC scheme written by hand into a state, as Task 7 will write them.
function plant(state, overrides = {}) {
  const item = {
    id: `scheme-${++state.sequence}`, actionId: 'undermine', actorId: BAREK, targetIds: [NAMAR], means: { silver: 0, agentRoles: [] },
    startedAt: state.date, dueAt: addGameMonths(state.date, 12), nextCheckAt: addGameMonths(state.date, 1),
    status: 'active', discoveredAt: null, resolutionId: null, playerControlled: false, commandId: null, ...overrides,
  };
  state.schemes.push(item);
  return item;
}
// A state with a spymaster of the given intrigue (Sera) and an NPC plot of Barek against Namar.
function watched(intrigue = 18, overrides = {}) {
  const state = base();
  state.offices.spymaster.holderId = SERA;
  state.people[SERA].skills.intrigue = intrigue;
  const scheme = plant(state, overrides);
  return { state, scheme };
}
const hear = (state, scheme) => hearScheme(state, scheme, actionHooks(state));
// Chance to hear and accuracy for a listener of this intrigue (Task 6 brief).
const hearChance = (intrigue) => Math.max(5, Math.min(50, 5 + intrigue * 2));
const accuracyOf = (intrigue) => Math.max(40, Math.min(95, 40 + intrigue * 3));
// The false-name candidates as the brief words them: living adults outside the actor's and the controlled family, never the target, sorted by id.
function candidates(state, scheme) {
  const actorFamily = state.people[scheme.actorId].familyId;
  return Object.values(state.people)
    .filter((p) => isAdultCharacter(p, state.date) && p.familyId !== actorFamily && p.familyId !== ARELS && p.id !== scheme.targetIds[0])
    .map((p) => p.id).sort();
}

test('the topic table of rumors.js is the one of the action catalog', () => {
  assert.equal(RUMOR_TOPICS, CATALOG_TOPICS);
  assert.deepEqual(RUMOR_TOPICS, { plot: 'Sammansvärjning', murder: 'Mordplaner', affair: 'Otrohet', illegitimate: 'Oäkta börd' });
});

test('an NPC scheme against Namar produces a rumor that the spymaster brings to Arel', () => {
  const seed = plotSeedWhere(2, ([heard, accurate]) => heard < hearChance(18) && accurate < accuracyOf(18));
  const { state, scheme } = watched(18);
  state.actionRngState = actionSeedWhere(1, ([d]) => d >= 40);
  const after = advance(withPlot(state, seed), MONTH);
  assert.equal(after.rumors.length, 1);
  assert.deepEqual(after.rumors[0], {
    id: after.rumors[0].id, date: MONTH, topic: 'plot', subjectId: NAMAR, claimedActorId: BAREK, truthful: true, reliability: 'säker',
    sourceKind: 'scheme', sourceId: scheme.id, heardByFamilyId: ARELS,
  });
  assert.match(after.rumors[0].id, /^rumor-[1-9]\d*$/);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(after)));
  const [shown] = getCharacterPresentation(after).rumors;
  assert.deepEqual(shown, { id: after.rumors[0].id, date: MONTH, topic: 'plot', topicLabel: 'Sammansvärjning', subjectId: NAMAR, subjectName: 'Namar av Hadara', claimedActorId: BAREK, claimedActorName: 'Barek Eshmun', reliability: 'säker' });
});

test('a poison scheme is a murder rumor and any other scheme a plot rumor', () => {
  const seed = plotSeedWhere(1, ([heard]) => heard < 5);
  for (const [actionId, topic] of [['poison', 'murder'], ['undermine', 'plot'], ['sway', 'plot']]) {
    const { state, scheme } = watched(10, { actionId });
    assert.equal(hear(withPlot(state, seed), scheme).topic, topic, actionId);
  }
});

test('a spymaster of intrigue 18 is certain and right where one of intrigue 4 gives a wrong name', () => {
  // Both hear (first draw below 13); the second draw is below 94 but not below 52, and the third picks the false name.
  const seed = plotSeedWhere(3, ([heard, accurate]) => heard < hearChance(4) && accurate >= accuracyOf(4) && accurate < accuracyOf(18));
  const sharp = watched(18), dull = watched(4);
  const right = hear(withPlot(sharp.state, seed), sharp.scheme);
  assert.equal(right.reliability, 'säker');
  assert.equal(right.truthful, true);
  assert.equal(right.claimedActorId, BAREK);
  const wrong = hear(withPlot(dull.state, seed), dull.scheme);
  assert.equal(wrong.reliability, 'osäker');
  assert.equal(wrong.truthful, false);
  const names = candidates(dull.state, dull.scheme);
  assert.ok(names.length > 3);
  assert.equal(wrong.claimedActorId, names[Math.floor(plotDraws(seed, 3)[2] / 100 * names.length)]);
  assert.notEqual(wrong.claimedActorId, BAREK);
  assert.notEqual(dull.state.people[wrong.claimedActorId].familyId, ESHMUNS);
  assert.notEqual(dull.state.people[wrong.claimedActorId].familyId, ARELS);
});

test('reliability follows the accuracy: below 60 uncertain, below 80 likely, otherwise certain', () => {
  const cases = [[0, 'osäker'], [6, 'osäker'], [7, 'trolig'], [13, 'trolig'], [14, 'säker'], [20, 'säker']];
  const seed = plotSeedWhere(1, ([heard]) => heard < 5);
  for (const [intrigue, reliability] of cases) {
    const { state, scheme } = watched(intrigue);
    assert.equal(hear(withPlot(state, seed), scheme).reliability, reliability, `intrigue ${intrigue}`);
  }
});

test('the hearing chance is 5 plus twice the listener intrigue, kept between 5 and 50 percent', () => {
  for (const [intrigue, chance] of [[0, 5], [10, 25], [18, 41], [20, 45], [30, 50]]) {
    const { state, scheme } = watched(10);
    state.people[SERA].skills.intrigue = intrigue;
    const below = plotSeedWhere(1, ([d]) => d < chance && d > chance - 0.5);
    const above = plotSeedWhere(1, ([d]) => d >= chance && d < chance + 0.5);
    assert.ok(hear(withPlot(state, below), scheme), `just below ${chance}`);
    assert.equal(hear(withPlot(state, above), scheme), null, `at ${chance}`);
  }
});

test('without a spymaster the representative listens at half intrigue, rounded down', () => {
  const heardBy = (state, scheme, seed) => hear(withPlot(state, seed), scheme);
  // The representative has intrigue 15: half is 7, so the chance is 19 and the accuracy 61 (likely).
  const seed = plotSeedWhere(2, ([heard, accurate]) => heard < 19 && accurate >= 60 && accurate < 61.5);
  const rep = base();
  rep.people[REP].skills.intrigue = 15;
  const scheme = plant(rep);
  const rumor = heardBy(rep, scheme, seed);
  assert.equal(rumor.reliability, 'trolig');
  assert.equal(rumor.heardByFamilyId, ARELS);
  // A first draw between 19 and 35 would be heard by a spymaster of intrigue 15 but not by the representative.
  const between = plotSeedWhere(1, ([d]) => d >= 19 && d < 34);
  assert.equal(heardBy(rep, scheme, between), null);
  const { state: spy, scheme: spyScheme } = watched(15);
  assert.ok(heardBy(spy, spyScheme, between));
});

test('an imprisoned spymaster is replaced by the representative, and with no listener nothing is heard', () => {
  const { state, scheme } = watched(18);
  const seed = plotSeedWhere(1, ([d]) => d < 5);
  imprisonPerson(state, SERA, ARELS, [], actionHooks(state), { lawful: true });
  assert.equal(state.offices.spymaster.holderId, null, 'imprisonment vacates the office');
  // The representative listens instead.
  const rumor = hear(withPlot(state, seed), scheme);
  assert.ok(rumor);
  const rep = withPlot(state, seed);
  rep.people[REP].diedAt = rep.date;
  assert.equal(hearScheme(rep, scheme, { ...actionHooks(rep), activeRepresentative: () => null }), null);
  assert.equal(rep.plotRngState, seed, 'no listener, no draw');
});

test('a scheme of the controlled family, an inactive scheme and a missed hearing leave no rumor', () => {
  const seed = plotSeedWhere(1, ([d]) => d < 5);
  const own = watched(18, { actorId: SERA, targetIds: [NAMAR], playerControlled: true });
  const ownState = withPlot(own.state, seed);
  assert.equal(hear(ownState, own.scheme), null);
  assert.equal(ownState.plotRngState, seed, 'no draw for the family\'s own plan');
  const done = watched(18, { status: 'aborted' });
  assert.equal(hear(withPlot(done.state, seed), done.scheme), null);
  const missed = watched(10);
  const miss = plotSeedWhere(1, ([d]) => d >= 50);
  const stateMiss = withPlot(missed.state, miss);
  assert.equal(hear(stateMiss, missed.scheme), null);
  assert.deepEqual(stateMiss.rumors, []);
  assert.notEqual(stateMiss.plotRngState, miss, 'exactly one draw');
  assert.equal(stateMiss.plotRngState, plotRngAfter(miss, 1));
});
function plotRngAfter(seed, count) { const dice = { plotRngState: seed }; for (let i = 0; i < count; i++) plotRandom(dice); return dice.plotRngState; }

test('a scheme found on the check leaves no rumor', () => {
  const { state, scheme } = watched(18);
  state.people[NAMAR].skills.intrigue = 20;
  state.people[BAREK].skills.intrigue = 0;
  const plotSeed = plotSeedWhere(1, ([d]) => d < 5);
  const found = advance(withPlot(withSeed(state, actionSeedWhere(1, ([d]) => d < 3)), plotSeed), MONTH);
  assert.equal(found.schemes.find((item) => item.id === scheme.id).status, 'discovered');
  assert.deepEqual(found.rumors, []);
  assert.equal(found.plotRngState, plotSeed, 'no hearing draw after a discovery');
});

test('a scheme yields at most three rumors', () => {
  const { state, scheme } = watched(18);
  const seed = plotSeedWhere(2, ([heard, accurate]) => heard < 5 && accurate < 40);
  const made = [];
  for (let i = 0; i < 5; i++) {
    state.plotRngState = seed;
    made.push(hear(state, scheme));
  }
  assert.deepEqual(made.map(Boolean), [true, true, true, false, false]);
  assert.equal(state.rumors.length, 3);
  assert.equal(state.plotRngState, seed, 'a full scheme draws nothing');
  assert.equal(new Set(state.rumors.map((item) => item.id)).size, 3);
  const other = plant(state);
  state.plotRngState = seed;
  assert.ok(hear(state, other), 'another scheme has its own three');
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)));
});

test('the false name is a living adult, outside both families, not in prison and not dead', () => {
  const { state, scheme } = watched(0);
  const seed = plotSeedWhere(3, ([heard, accurate]) => heard < 5 && accurate >= 40);
  const before = candidates(state, scheme);
  const jailed = before[0], dead = before[1];
  imprisonPerson(state, jailed, ARELS, [], actionHooks(state), { lawful: true });
  state.people[dead].diedAt = state.date;
  const left = before.filter((id) => id !== jailed && id !== dead);
  const rumor = hear(withPlot(state, seed), scheme);
  assert.equal(rumor.truthful, false);
  assert.equal(rumor.claimedActorId, left[Math.floor(plotDraws(seed, 3)[2] / 100 * left.length)]);
  assert.ok(![jailed, dead, BAREK, NAMAR].includes(rumor.claimedActorId));
});

test('a false name is null when nobody qualifies and then draws nothing more', () => {
  const { state, scheme } = watched(0);
  for (const person of Object.values(state.people)) if (person.familyId !== ARELS && person.familyId !== ESHMUNS) person.diedAt = state.date;
  state.people[NAMAR].diedAt = null;
  const seed = plotSeedWhere(3, ([heard, accurate]) => heard < 5 && accurate >= 40);
  const probe = withPlot(state, seed);
  const rumor = hear(probe, scheme);
  assert.equal(rumor.claimedActorId, null);
  assert.equal(rumor.truthful, false);
  assert.equal(probe.plotRngState, plotRngAfter(seed, 2));
});

test('rumor draws leave the main and the action streams untouched', () => {
  const { state, scheme } = watched(18);
  const seed = plotSeedWhere(3, ([heard, accurate]) => heard < 5 && accurate >= 60);
  const probe = withPlot(state, seed);
  const [main, action] = [probe.rngState, probe.actionRngState];
  assert.ok(hear(probe, scheme));
  assert.equal(probe.rngState, main);
  assert.equal(probe.actionRngState, action);
  assert.notEqual(probe.plotRngState, seed);
  // Through the calendar: the check draws one action roll for discovery, and the rumor draws change nothing there.
  const quiet = actionSeedWhere(1, ([d]) => d >= 40);
  const first = advance(withPlot(withSeed(state, quiet), plotSeedWhere(2, ([a, b]) => a < 5 && b < 95)), MONTH);
  const miss = advance(withPlot(withSeed(state, quiet), plotSeedWhere(1, ([a]) => a >= 50)), MONTH);
  assert.equal(first.rumors.length, 1);
  assert.equal(miss.rumors.length, 0);
  assert.equal(first.actionRngState, miss.actionRngState, 'hearing or not, the same single discovery draw');
  assert.equal(first.rngState, miss.rngState);
  assert.equal(first.actionRngState, plotRngAfterAction(quiet));
});
function plotRngAfterAction(seed) { const dice = { actionRngState: seed }; actionRandom(dice); return dice.actionRngState; }

test('the spymaster raises the discovery chance of a plan against the controlled family', () => {
  const stage = (spymaster, { actorIntrigue = 5, targetIntrigue = 5, targetId = SERA } = {}) => {
    const state = base();
    if (spymaster != null) { state.offices.spymaster.holderId = REP; state.people[REP].skills.intrigue = spymaster; }
    state.people[BAREK].skills.intrigue = actorIntrigue;
    state.people[targetId].skills.intrigue = targetIntrigue;
    plant(state, { targetIds: [targetId] });
    return state;
  };
  const status = (state, next) => advance(withSeed(state, seedBefore(next)), MONTH).schemes.at(-1).status;
  const edge = (chance) => Math.ceil((chance * 2 ** 32) / 100);
  // 10 + 5 × 2 − 5 = 15 percent; a spymaster of intrigue 12 adds 6.
  assert.equal(status(stage(null), edge(15) - 1), 'discovered');
  assert.equal(status(stage(null), edge(15)), 'active');
  assert.equal(status(stage(12), edge(21) - 1), 'discovered');
  assert.equal(status(stage(12), edge(21)), 'active');
  assert.equal(status(stage(13), edge(21) - 1), 'discovered', 'rounded down: 13 adds 6');
  assert.equal(status(stage(13), edge(22)), 'active');
  // The clamp rises from 40 to 55: 10 + 20 × 2 − 0 = 50, plus 10 is 60.
  const strong = { actorIntrigue: 0, targetIntrigue: 20 };
  assert.equal(status(stage(null, strong), edge(40) - 1), 'discovered');
  assert.equal(status(stage(null, strong), edge(40)), 'active');
  assert.equal(status(stage(20, strong), edge(55) - 1), 'discovered');
  assert.equal(status(stage(20, strong), edge(55)), 'active');
  // A plan against another house gets no bonus: 15 percent with or without the spymaster.
  const elsewhere = { targetId: NAMAR };
  assert.equal(status(stage(12, elsewhere), edge(15) - 1), 'discovered');
  assert.equal(status(stage(12, elsewhere), edge(15)), 'active');
});

test('a discovery check still draws exactly once from the action stream', () => {
  const state = base();
  state.offices.spymaster.holderId = REP;
  plant(state, { targetIds: [SERA] });
  const seed = actionSeedWhere(1, ([d]) => d >= 60);
  const after = advance(withSeed(state, seed), MONTH);
  assert.equal(after.actionRngState, plotRngAfterAction(seed));
});

test('spread_rumor creates a rumor about the target that every family hears', () => {
  const state = base();
  const intent = { actionId: 'spread_rumor', actorId: REP, targetIds: [NAMAR], means: { topic: 'affair' } };
  const est = estimateCharacterAction(state, intent);
  assert.equal(est.ok, true, est.reason);
  const seed = actionSeedWhere(2, ([success, secrecy]) => tierFor(success, secrecy, est.success.value, est.secrecy.value) === 'clean_success');
  const after = ok(run(withSeed(state, seed), 'attempt_action', intent));
  const entry = after.actionLog.at(-1);
  assert.equal(after.rumors.length, 1);
  const [rumor] = after.rumors;
  assert.deepEqual(rumor, { id: rumor.id, date: after.date, topic: 'affair', subjectId: NAMAR, claimedActorId: null, truthful: false, reliability: 'osäker', sourceKind: 'action', sourceId: entry.id, heardByFamilyId: '*' });
  assert.deepEqual(entry.effects[0], { kind: 'rumor', topic: 'affair', rumorId: rumor.id });
  assert.equal(after.plotRngState, state.plotRngState, 'creating the rumor draws nothing');
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(after)));
  for (const familyId of [ARELS, 'family-namar', ESHMUNS, 'family-safra']) assert.equal(presentRumors(after, familyId).map((item) => item.id).join(), rumor.id, familyId);
  assert.deepEqual(presentRumors(after, null), []);
  assert.equal(presentRumors(after, ARELS)[0].topicLabel, 'Otrohet');
  // A failure plants no rumor.
  const failed = actionSeedWhere(2, ([success, secrecy]) => tierFor(success, secrecy, est.success.value, est.secrecy.value) === 'exposed_failure');
  assert.equal(ok(run(withSeed(state, failed), 'attempt_action', intent)).rumors.length, 0);
});

test('rumor truth stays in the engine', () => {
  const { state, scheme } = watched(18);
  const seed = plotSeedWhere(2, ([heard, accurate]) => heard < hearChance(18) && accurate < accuracyOf(18));
  state.actionRngState = actionSeedWhere(1, ([d]) => d >= 40);
  const after = advance(withPlot(state, seed), MONTH);
  assert.equal(after.rumors.length, 1);
  const shown = presentRumors(after, ARELS);
  assert.equal(shown.length, 1);
  for (const item of shown) {
    assert.equal(Object.hasOwn(item, 'truthful'), false);
    assert.equal(Object.hasOwn(item, 'sourceId'), false);
    assert.equal(Object.hasOwn(item, 'sourceKind'), false, 'the source would tell a made-up rumor from a heard one');
    assert.equal(Object.hasOwn(item, 'heardByFamilyId'), false);
  }
  const view = JSON.stringify(getCharacterPresentation(after));
  const prompt = buildCharacterPromptContext(after);
  for (const text of [view, prompt, JSON.stringify(shown)]) {
    assert.doesNotMatch(text, /"truthful"/);
    assert.doesNotMatch(text, /"sourceId"/);
  }
  assert.equal(JSON.stringify(shown).includes(scheme.id), false, 'the scheme id is not leaked through a rumor');
});

test('the presentation keeps the last twenty rumors heard by the family, newest first', () => {
  const state = base();
  const hooks = { fields: (n, heardByFamilyId) => ({ topic: 'plot', subjectId: NAMAR, claimedActorId: null, truthful: false, reliability: 'osäker', sourceKind: 'scheme', sourceId: `scheme-${n}`, heardByFamilyId }) };
  for (let n = 1; n <= 25; n++) createRumor(state, hooks.fields(n, n % 5 === 0 ? 'family-namar' : ARELS));
  createRumor(state, hooks.fields(99, '*'));
  const shown = presentRumors(state, ARELS);
  assert.equal(shown.length, 20);
  const ids = shown.map((item) => Number(item.id.slice(6)));
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a));
  assert.equal(shown[0].id, state.rumors.at(-1).id, 'the everyone-rumor is the newest');
  assert.equal(presentRumors(state, 'family-namar').length, 6);
  assert.equal(presentRumors(state, 'family-unknown').length, 1, 'only the rumor everyone hears');
});

test('createRumor writes the id and the date and refuses a malformed rumor', () => {
  const state = base();
  const fields = { topic: 'murder', subjectId: NAMAR, claimedActorId: BAREK, truthful: true, reliability: 'trolig', sourceKind: 'scheme', sourceId: 'scheme-1', heardByFamilyId: ARELS };
  const sequence = state.sequence;
  const rumor = createRumor(state, fields);
  assert.equal(rumor.id, `rumor-${sequence + 1}`);
  assert.equal(state.sequence, sequence + 1);
  assert.equal(rumor.date, state.date);
  assert.deepEqual(state.rumors, [rumor]);
  for (const bad of [{ topic: 'weather' }, { reliability: 'visst' }, { sourceKind: 'dream' }, { truthful: 'yes' }, { subjectId: 5 }, { heardByFamilyId: null }]) {
    assert.throws(() => createRumor(state, { ...fields, ...bad }), INVALID, JSON.stringify(bad));
  }
  assert.equal(state.rumors.length, 1);
});

test('the rumor list validates on load and refuses forged records', () => {
  const { state, scheme } = watched(18);
  const seed = plotSeedWhere(2, ([heard, accurate]) => heard < 5 && accurate < 40);
  state.plotRngState = seed;
  hear(state, scheme);
  state.plotRngState = seed;
  hear(state, scheme);
  assert.equal(state.rumors.length, 2);
  assert.doesNotThrow(() => validateRumors(state));
  const forged = (change) => { const result = copy(state); change(result.rumors, result); return result; };
  const cases = {
    'an entry that is no object': (r) => { r[0] = null; },
    'an array as entry': (r) => { r[0] = []; },
    'an id of another kind': (r) => { r[0].id = 'plan-5'; },
    'an id past the sequence': (r, s) => { r[0].id = `rumor-${s.sequence + 1}`; },
    'a duplicate id': (r) => { r[1].id = r[0].id; },
    'an unknown topic': (r) => { r[0].topic = 'weather'; },
    'an inherited topic': (r) => { r[0].topic = 'toString'; },
    'a date that is not canonical': (r) => { r[0].date = '2026-1-1'; },
    'a date in the future': (r, s) => { r[0].date = addGameMonths(s.date, 1); },
    'a missing subject': (r) => { r[0].subjectId = 'person-9-9'; },
    'a missing claimed actor': (r) => { r[0].claimedActorId = 'person-9-9'; },
    'a truth flag that is no boolean': (r) => { r[0].truthful = 1; },
    'an unknown reliability': (r) => { r[0].reliability = 'visst'; },
    'an unknown source kind': (r) => { r[0].sourceKind = 'dream'; },
    'a source scheme that is missing': (r) => { r[0].sourceId = 'scheme-99999'; },
    'a truthful rumor naming someone else': (r) => { r[0].truthful = true; r[0].claimedActorId = NAMAR; },
    'a false rumor naming the real actor': (r) => { r[0].truthful = false; r[0].claimedActorId = BAREK; },
    'a scheme rumor about the wrong subject': (r) => { r[0].subjectId = SERA; },
    'a scheme rumor on the wrong topic': (r) => { r[0].topic = 'murder'; },
    'a scheme rumor older than its scheme': (r) => { r[0].date = addGameMonths(START, -1); },
    'a rumor of a plan the player ordered': (r, s) => { s.schemes.find((item) => item.id === r[0].sourceId).playerControlled = true; },
    'a family that does not exist': (r) => { r[0].heardByFamilyId = 'family-nowhere'; },
    'an action rumor whose entry is missing': (r) => { r[0].sourceKind = 'action'; r[0].sourceId = 'resolution-99999'; },
    'an unknown key': (r) => { r[0].extra = 1; },
    'a missing key': (r) => { delete r[0].reliability; },
    'more than three for one scheme': (r) => { for (const n of [1, 2]) r.push({ ...r[0], id: `rumor-${n}` }); },
  };
  for (const [name, change] of Object.entries(cases)) assert.throws(() => normalizeCharacterSystem(forged(change)), INVALID, name);
});

test('an action rumor must match its action log entry', () => {
  const state = base();
  const intent = { actionId: 'spread_rumor', actorId: REP, targetIds: [NAMAR], means: { topic: 'plot' } };
  const est = estimateCharacterAction(state, intent);
  const seed = actionSeedWhere(2, ([success, secrecy]) => tierFor(success, secrecy, est.success.value, est.secrecy.value) === 'clean_success');
  const after = ok(run(withSeed(state, seed), 'attempt_action', intent));
  const forged = (change) => { const result = copy(after); change(result); return result; };
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(after)));
  assert.throws(() => normalizeCharacterSystem(forged((s) => { s.rumors[0].subjectId = SERA; })), INVALID, 'wrong subject');
  assert.throws(() => normalizeCharacterSystem(forged((s) => { s.rumors[0].truthful = true; })), INVALID, 'a made-up rumor is false');
  assert.throws(() => normalizeCharacterSystem(forged((s) => { s.rumors[0].claimedActorId = BAREK; })), INVALID, 'no claimed actor');
  assert.throws(() => normalizeCharacterSystem(forged((s) => { s.rumors[0].heardByFamilyId = ARELS; })), INVALID, 'everyone hears it');
  assert.throws(() => normalizeCharacterSystem(forged((s) => { s.rumors[0].topic = 'affair'; })), /handlingsloggen/i, 'topic of the effect');
  // The log side: the effect must name a rumor that exists.
  assert.throws(() => normalizeCharacterSystem(forged((s) => { s.actionLog.at(-1).effects[0].rumorId = 'rumor-99999'; })), /handlingsloggen/i);
  assert.throws(() => normalizeCharacterSystem(forged((s) => { s.actionLog.at(-1).effects[0].rumorId = null; })), /handlingsloggen/i);
  assert.throws(() => normalizeCharacterSystem(forged((s) => { s.rumors = []; })), /handlingsloggen/i);
});

test('an old save without rumors loads with an empty list', () => {
  const old = base();
  delete old.rumors;
  const loaded = normalizeCharacterSystem(copy(old));
  assert.deepEqual(loaded.rumors, []);
  assert.deepEqual(presentRumors(loaded, ARELS), []);
  assert.deepEqual(getCharacterPresentation(loaded).rumors, []);
});

test('the player never hears rumors of a plan he ordered, even through an office holder of another house', () => {
  const state = base();
  state.offices.spymaster.holderId = SERA;
  state.people[SERA].skills.intrigue = 18;
  assert.equal(state.offices.chancellor.holderId, BAREK, 'the chancellor is of house Eshmun');
  const order = { actionId: 'undermine', actorId: BAREK, targetIds: [NAMAR] };
  // The order is obeyed (the first action draw is far above any refusal chance) and the monthly discovery draw is far above the chance.
  const started = ok(run(withSeed(state, actionSeedWhere(2, ([a, b]) => a >= 99 && b >= 99)), 'attempt_action', order));
  const scheme = started.schemes.at(-1);
  assert.deepEqual([scheme.actorId, scheme.playerControlled, scheme.status], [BAREK, true, 'active']);
  const plotSeed = plotSeedWhere(2, ([heard, accurate]) => heard < 5 && accurate < 40);
  const after = advance(withPlot(started, plotSeed), MONTH);
  assert.equal(after.schemes.find((item) => item.id === scheme.id).status, 'active', 'the plan went through its check');
  assert.deepEqual(after.rumors, []);
  assert.equal(after.plotRngState, plotSeed, 'no hearing draw for the own plan of the player');
  assert.equal(hear(withPlot(started, plotSeed), scheme), null);
});

test('a spymaster does not listen to his own plan and gives it no discovery bonus', () => {
  const stage = () => {
    const { state, scheme } = watched(18);
    state.offices.spymaster.holderId = BAREK;
    state.people[BAREK].skills.intrigue = 18;
    return { state, scheme };
  };
  // The representative (intrigue 4, half 2) hears with 9 percent; the spymaster of intrigue 18 would hear with 41.
  const between = plotSeedWhere(1, ([d]) => d >= 15 && d < 30);
  const own = stage();
  const probe = withPlot(own.state, between);
  assert.equal(hear(probe, own.scheme), null);
  assert.equal(probe.plotRngState, plotRngAfter(between, 1), 'the representative drew once');
  const small = plotSeedWhere(2, ([heard, accurate]) => heard < 9 && accurate < 60);
  const rumor = hear(withPlot(own.state, small), own.scheme);
  assert.equal(rumor.reliability, 'osäker', 'accuracy 46 is that of the representative');
  const other = watched(18);
  assert.ok(hear(withPlot(other.state, between), other.scheme), 'another spymaster of 18 does hear it');
  // The bonus: Barek (intrigue 18) against Sera (17): 10 + 34 − 18 = 26 percent, and 35 with a bonus of 9.
  const setup = stage().state;
  setup.people[SERA].skills.intrigue = 17;
  setup.schemes.at(-1).targetIds = [SERA];
  const edge = Math.ceil((26 * 2 ** 32) / 100);
  const status = (next) => advance(withSeed(setup, seedBefore(next)), MONTH).schemes.at(-1).status;
  assert.equal(status(edge - 1), 'discovered');
  assert.equal(status(edge), 'active', 'no bonus from the plotter himself');
});

test('a whole advance equals the same months in single steps with a save in between', () => {
  const dom = (state) => ({ ...copy(state), revision: 0, appliedCommandIds: [] });
  let rumors = 0;
  for (const k of [1, 2, 3, 4, 5, 6]) {
    const state = base();
    state.offices.spymaster.holderId = SERA;
    state.people[SERA].skills.intrigue = 18;
    for (const [actorId, targetId, actionId] of [[BAREK, NAMAR, 'undermine'], ['person-1-1', REP, 'poison'], ['person-3-0', 'person-2-0', 'sway']]) {
      plant(state, { actorId, targetIds: [targetId], actionId, dueAt: addGameMonths(state.date, 10) });
    }
    imprisonPerson(state, 'person-2-0', ARELS, [], actionHooks(state), { lawful: true });
    state.plotRngState = Math.imul(k, 2654435761) >>> 0 || 1;
    state.actionRngState = Math.imul(k + 99, 2246822519) >>> 0 || 1;
    const start = normalizeCharacterSystem(copy(state));
    const whole = advance(copy(start), addGameMonths(start.date, 14));
    let split = copy(start);
    for (let m = 1; m <= 14; m++) split = normalizeCharacterSystem(copy(advance(split, addGameMonths(start.date, m))));
    assert.deepEqual(dom(split), dom(whole), `seed ${k}`);
    rumors += whole.rumors.length;
  }
  assert.ok(rumors > 0, 'the comparison covered real rumors');
});

test('the action log and the rumor list must agree on who planted which rumor', () => {
  let state = base();
  for (const topic of ['plot', 'affair']) {
    const intent = { actionId: 'spread_rumor', actorId: REP, targetIds: [NAMAR], means: { topic } };
    const est = estimateCharacterAction(state, intent);
    assert.equal(est.ok, true, est.reason);
    const seed = actionSeedWhere(2, ([success, secrecy]) => tierFor(success, secrecy, est.success.value, est.secrecy.value) === 'clean_success');
    state = ok(run(withSeed(state, seed), 'attempt_action', intent));
  }
  state.offices.spymaster.holderId = SERA;
  const scheme = plant(state);
  state.plotRngState = plotSeedWhere(2, ([heard, accurate]) => heard < 5 && accurate < 40);
  const heard = hear(state, scheme);
  assert.ok(heard);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)));
  const [first, second] = state.actionLog.slice(-2);
  const forged = (change) => { const result = copy(state); change(result.actionLog.at(-2), result.actionLog.at(-1), result); return result; };
  const cases = {
    'an entry naming the rumor of another entry': (a, b) => { a.effects[0].rumorId = b.effects[0].rumorId; },
    'an entry naming a rumor heard of a scheme': (a) => { a.effects[0].rumorId = heard.id; },
    'the same rumor claimed twice in one entry': (a) => { a.effects.push({ ...a.effects[0] }); },
    'a swap of the two rumors': (a, b) => { [a.effects[0].rumorId, b.effects[0].rumorId] = [b.effects[0].rumorId, a.effects[0].rumorId]; },
  };
  assert.notEqual(first.effects[0].rumorId, second.effects[0].rumorId);
  for (const [name, change] of Object.entries(cases)) assert.throws(() => normalizeCharacterSystem(forged(change)), /handlingsloggen/i, name);
});

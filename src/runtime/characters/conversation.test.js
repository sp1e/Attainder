import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { PRECISION_BANDS } from './actionOdds.js';
import { CONVERSATION_REQUESTS, CONVERSATION_MONTHS, RECENT_REFUSAL } from './conversation.js';
import { actionHooks, createCharacterSystem, estimateConversation, executeCharacterCommand, getCharacterPresentation, getConversationBrief, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { actionRandom } from './extensions.js';
import { imprisonPerson } from './prisoners.js';
import { createSecret, exposeSecret, grantHook } from './secrets.js';

const REP = 'person-0-0';
const SERA = 'person-0-2';
const MIRA = 'person-0-4';
const NAMAR = 'person-1-0';
const TALIA = 'person-1-3';
const BAREK = 'person-2-2';
const ESHMUN = 'person-2-0';
const ARELS = 'family-arel';

const copy = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
// The only way into the engine for a conversation: the same origin submitConversationRequest sets.
const send = (state, request, origin) => executeCharacterCommand(state, { id: `converse-${++counter}`, expectedRevision: state.revision, type: 'converse_request', payload: request, origin });
const converse = (state, request) => send(state, request, 'converse');
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const ask = (overrides = {}) => ({ personId: NAMAR, kind: 'support', offerSilver: 0, hookId: null, arguments: [], argumentScore: 0, ...overrides });
const withAction = (state, seed) => Object.assign(copy(state), { actionRngState: seed });
// The action stream state whose next draw is `next` / 2^32: one xorshift step undone (as in rumors.test.js).
function seedBefore(next) {
  const undoLeft = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y << k)) >>> 0; return y; };
  const undoRight = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y >>> k)) >>> 0; return y; };
  return undoLeft(undoRight(undoLeft(next >>> 0, 5), 17), 13);
}
const ACCEPT = seedBefore(Math.floor(0.01 * 2 ** 32));
const REFUSE = seedBefore(Math.floor(0.99 * 2 ** 32));

// A neutral conversation partner: no traits, loyalty 50, opinion 0, so only the base row remains.
function plain(overrides = {}) {
  const state = base();
  Object.assign(state.people[NAMAR], { traits: [], loyalty: 50, ...overrides });
  return state;
}
const setOpinion = (state, fromId, toId, amount) => actionHooks(state).opinionCause(fromId, toId, amount, 'Prov', `test-${++counter}`, 10);
const estimate = (state, request) => { const result = estimateConversation(state, request); assert.equal(result.ok, true, result.reason); return result; };
const row = (result, label) => result.modifiers.find((item) => item.label === label);
const rowSum = (result) => result.modifiers.reduce((total, item) => total + item.value, 0);

test('the request kinds carry the values of the brief', () => {
  assert.deepEqual(CONVERSATION_REQUESTS, {
    support: { label: 'Ge sitt stöd', base: 45 },
    reveal_secret: { label: 'Avslöja en hemlighet', base: 25 },
    pledge: { label: 'Ge ett löfte', base: 30 },
  });
  assert.equal(CONVERSATION_MONTHS, 12);
});

test('a neutral partner gives only the base chance of the kind, and the rows add up to the value', () => {
  for (const [kind, { base: chance }] of Object.entries(CONVERSATION_REQUESTS)) {
    const result = estimate(plain(), ask({ kind }));
    assert.equal(result.value, chance, kind);
    assert.deepEqual(result.modifiers, [{ label: 'Grundchans', value: chance }], kind);
  }
});

test('opinion, loyalty, offer, traits and hook each move the chance in their own direction', () => {
  const baseline = estimate(plain(), ask()).value;
  const shifted = (state, request = ask()) => estimate(state, request).value - baseline;

  const liked = plain(); setOpinion(liked, NAMAR, REP, 40);
  assert.equal(shifted(liked), 10, 'opinion 40 / 4');
  const loved = plain(); setOpinion(loved, NAMAR, REP, 100);
  assert.equal(shifted(loved), 20, 'opinion row stops at +20');
  const hated = plain(); setOpinion(hated, NAMAR, REP, -100);
  assert.equal(shifted(hated), -20, 'opinion row stops at −20');
  const faint = plain(); setOpinion(faint, NAMAR, REP, 6);
  assert.equal(shifted(faint), 2, 'round(6 / 4)');

  assert.equal(shifted(plain({ loyalty: 100 })), 10, 'loyalty 100');
  assert.equal(shifted(plain({ loyalty: 0 })), -10, 'loyalty 0');
  assert.equal(shifted(plain({ loyalty: 68 })), 4, 'round(18 / 5)');

  assert.equal(shifted(plain(), ask({ offerSilver: 20 })), 5, 'floor(20 / 4)');
  assert.equal(shifted(plain(), ask({ offerSilver: 7 })), 1, 'floor(7 / 4)');
  assert.equal(shifted(plain(), ask({ offerSilver: 110 })), 15, 'offer row stops at +15');
  assert.equal(shifted(plain({ traits: ['greedy'] }), ask({ offerSilver: 20 })), 5 + 8, 'greedy +8 with an offer');
  assert.equal(shifted(plain({ traits: ['greedy'] })), 0, 'greedy without an offer');
  assert.equal(shifted(plain({ traits: ['greedy'] }), ask({ offerSilver: 3 })), 8, 'any offer, even one worth no points');

  assert.equal(estimate(plain({ traits: ['honest'] }), ask({ kind: 'reveal_secret' })).value, 25 - 10, 'honest −10 for a secret');
  assert.equal(estimate(plain({ traits: ['honest'] }), ask({ kind: 'support' })).value, baseline, 'honest changes nothing for support');
  assert.equal(estimate(plain({ traits: ['honest'] }), ask({ kind: 'pledge' })).value, 30, 'honest changes nothing for a pledge');
  assert.equal(shifted(plain({ traits: ['paranoid'] })), -8);
  assert.equal(shifted(plain({ traits: ['trusting'] })), 6);

  const hooked = plain(); const hook = grantHook(hooked, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  assert.equal(shifted(hooked, ask({ hookId: hook.id })), 20, 'hook +20');
});

test('every row has a Swedish label and an integer value, and they sum to the value', () => {
  const state = plain({ traits: ['greedy', 'trusting'], loyalty: 80 });
  setOpinion(state, NAMAR, REP, 30);
  const hook = grantHook(state, { ownerId: REP, targetId: NAMAR });
  const result = estimate(state, ask({ offerSilver: 30, hookId: hook.id, arguments: [{ kind: 'offer', refId: null }], argumentScore: 6 }));
  assert.ok(result.modifiers.length >= 7);
  for (const item of result.modifiers) {
    assert.match(item.label, /^[A-ZÅÄÖ]/);
    assert.ok(Number.isInteger(item.value) && item.value !== 0, item.label);
  }
  assert.equal(rowSum(result), result.value);
  assert.equal(row(result, 'Övertygande argument').value, 6);
});

test('the value is cut to 5 and 95, and the cut is a row of its own', () => {
  const high = plain({ loyalty: 100, traits: ['trusting'] }); setOpinion(high, NAMAR, REP, 100);
  const hook = grantHook(high, { ownerId: REP, targetId: NAMAR });
  const top = estimate(high, ask({ offerSilver: 100, hookId: hook.id, arguments: [{ kind: 'offer', refId: null }], argumentScore: 10 }));
  assert.equal(top.value, 95);
  assert.equal(rowSum(top), 95);
  const low = plain({ loyalty: 0, traits: ['paranoid', 'honest'] }); setOpinion(low, NAMAR, REP, -100);
  const bottom = estimate(low, ask({ kind: 'reveal_secret' }));
  assert.equal(bottom.value, 5);
  assert.equal(rowSum(bottom), 5);
});

test('an argument that refers to nothing earns nothing', () => {
  const state = plain();
  const baseline = estimate(state, ask({ argumentScore: 40 })).value;
  assert.equal(baseline, 45, 'a score without any argument counts for nothing');
  const forged = [
    { kind: 'offer', refId: null },                                    // no silver offered
    { kind: 'shared_memory', refId: 'memory-9999' },                   // a memory that does not exist
    { kind: 'shared_enemy', refId: BAREK },                            // an enemy nobody holds
    { kind: 'hook', refId: 'hook-9999' },                              // a hook that does not exist
    { kind: 'shared_enemy', refId: 'person-9-9' },
  ];
  for (const argument of forged) {
    const result = estimate(state, ask({ arguments: [argument], argumentScore: 40 }));
    assert.equal(result.value, baseline, JSON.stringify(argument));
    assert.deepEqual(result.groundedArguments, [], JSON.stringify(argument));
    assert.equal(row(result, 'Övertygande argument'), undefined);
  }
  const everything = estimate(state, ask({ arguments: forged, argumentScore: 40 }));
  assert.equal(everything.value, baseline);
});

test('a memory counts only when both people took part and both know it', () => {
  const state = plain();
  const hooks = actionHooks(state);
  const shared = hooks.memory('gift', 'En gåva', [REP, NAMAR], { knownBy: [REP, NAMAR] });
  const secret = hooks.memory('plot', 'En hemlig plan', [REP, NAMAR], { knownBy: [REP] });
  const other = hooks.memory('gift', 'En annan gåva', [REP, BAREK], { knownBy: [REP, BAREK] });
  const open = hooks.memory('feast', 'Ett gästabud', [REP, NAMAR]);
  const score = (refId) => estimate(state, ask({ arguments: [{ kind: 'shared_memory', refId }], argumentScore: 7 }));
  assert.equal(score(shared.id).value, 45 + 7);
  assert.deepEqual(score(shared.id).groundedArguments, [{ kind: 'shared_memory', refId: shared.id }]);
  assert.equal(score(secret.id).value, 45, 'only the representative knows it');
  assert.equal(score(other.id).value, 45, 'the speaker was not there');
  assert.equal(score(open.id).value, 45 + 7, 'a public memory is known by both');
});

test('a shared enemy is a living person both hold at opinion −20 or lower', () => {
  const state = plain();
  const score = (refId) => estimate(state, ask({ arguments: [{ kind: 'shared_enemy', refId }], argumentScore: 5 })).value;
  setOpinion(state, REP, BAREK, -20);
  assert.equal(score(BAREK), 45, 'only the representative dislikes him');
  setOpinion(state, NAMAR, BAREK, -19);
  assert.equal(score(BAREK), 45, 'the speaker at −19 is not enough');
  setOpinion(state, NAMAR, BAREK, -1);
  assert.equal(score(BAREK), 50, 'together −20');
  assert.equal(score(REP), 45, 'the representative is nobody\'s shared enemy');
  assert.equal(score(NAMAR), 45, 'neither is the speaker');
  const dead = copy(state); dead.people[BAREK].diedAt = dead.date;
  assert.equal(estimate(dead, ask({ arguments: [{ kind: 'shared_enemy', refId: BAREK }], argumentScore: 5 })).value, 45, 'a dead enemy');
});

test('a hook argument needs a hook the representative holds over the speaker', () => {
  const state = plain();
  const own = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'strong' });
  const wrongWay = grantHook(state, { ownerId: NAMAR, targetId: REP });
  const wrongTarget = grantHook(state, { ownerId: REP, targetId: BAREK });
  const spent = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  spent.usedAt = state.date;
  const withHook = (hookId, refId = hookId) => estimateConversation(state, ask({ hookId, arguments: [{ kind: 'hook', refId }], argumentScore: 4 }));
  const good = withHook(own.id);
  assert.equal(good.ok, true);
  assert.equal(good.value, 45 + 20 + 4);
  for (const bad of [wrongWay, wrongTarget, spent]) {
    const result = withHook(bad.id);
    assert.equal(result.ok, false, bad.id);
    assert.match(result.reason, /övertag/i);
  }
  assert.equal(estimateConversation(state, ask({ hookId: 'hook-9999' })).ok, false);
  // The argument may name the hook, but a hook that was not offered as the lever earns no row.
  const argumentOnly = estimate(state, ask({ arguments: [{ kind: 'hook', refId: own.id }], argumentScore: 4 }));
  assert.equal(argumentOnly.value, 45, 'the hook argument needs hookId to be grounded');
  assert.deepEqual(argumentOnly.groundedArguments, []);
});

test('the model\'s score is capped again at 10 and counts only with a grounded argument', () => {
  const state = plain();
  const grounded = { kind: 'offer', refId: null };
  assert.equal(estimate(state, ask({ offerSilver: 10, arguments: [grounded], argumentScore: 40 })).value, 45 + 2 + 10);
  assert.equal(estimate(state, ask({ offerSilver: 10, arguments: [grounded], argumentScore: 10 })).value, 45 + 2 + 10);
  assert.equal(estimate(state, ask({ offerSilver: 10, arguments: [grounded], argumentScore: 3 })).value, 45 + 2 + 3);
  assert.equal(estimate(state, ask({ offerSilver: 10, arguments: [], argumentScore: 9 })).value, 45 + 2);
});

test('a malformed request is refused with a reason', () => {
  const state = plain();
  const refusals = {
    'a score with a fraction': ask({ argumentScore: 2.5 }),
    'a negative score': ask({ argumentScore: -1 }),
    'a score that is text': ask({ argumentScore: '7' }),
    'an offer with a fraction': ask({ offerSilver: 2.5 }),
    'a negative offer': ask({ offerSilver: -5 }),
    'an unknown kind': ask({ kind: 'bribe' }),
    'an inherited kind': ask({ kind: 'toString' }),
    'an unknown argument kind': ask({ arguments: [{ kind: 'threat', refId: null }] }),
    'arguments that are not a list': ask({ arguments: 'offer' }),
    'no person': ask({ personId: undefined }),
    'an unknown person': ask({ personId: 'person-9-9' }),
    'an offer the family cannot pay': ask({ offerSilver: 1000 }),
  };
  for (const [name, request] of Object.entries(refusals)) {
    const result = estimateConversation(state, request);
    assert.equal(result.ok, false, name);
    assert.ok(typeof result.reason === 'string' && result.reason.length > 0, name);
  }
  assert.equal(estimateConversation(state, null).ok, false);
  assert.equal(estimateConversation(state, 'support').ok, false);
});

test('only adults of the family and office holders may be asked, never the representative or a prisoner', () => {
  const state = base();
  const allowed = (personId) => estimateConversation(state, ask({ personId })).ok;
  assert.equal(allowed(SERA), true, 'an adult of the family');
  assert.equal(allowed(NAMAR), true, 'a governor of another family');
  assert.equal(allowed(BAREK), true, 'the chancellor of another family');
  assert.equal(allowed(REP), false, 'the representative');
  assert.equal(allowed(MIRA), false, 'a child of the family');
  assert.equal(allowed(TALIA), false, 'an adult of another family without an office');
  const dead = copy(state); dead.people[BAREK].diedAt = dead.date;
  assert.equal(estimateConversation(dead, ask({ personId: BAREK })).ok, false, 'a dead office holder');
  const jailed = copy(state);
  imprisonPerson(jailed, SERA, ARELS, [], actionHooks(jailed), { lawful: true });
  const result = estimateConversation(jailed, ask({ personId: SERA }));
  assert.equal(result.ok, false);
  assert.match(result.reason, /fängslad/);
  const spymaster = copy(state); spymaster.offices.spymaster.holderId = TALIA;
  assert.equal(estimateConversation(spymaster, ask({ personId: TALIA })).ok, true, 'the spymaster is an office holder');
});

test('the precision follows the representative\'s diplomacy with Phase 1\'s bands', () => {
  const at = (diplomacy) => { const state = plain(); state.people[REP].skills.diplomacy = diplomacy; setOpinion(state, NAMAR, REP, 20); return estimate(state, ask({ offerSilver: 12 })); };
  const exact = at(12);
  assert.equal(exact.precision, 'exact');
  assert.equal(exact.display.chance, exact.value);
  assert.deepEqual(exact.display.modifiers, exact.modifiers);
  const five = at(7);
  assert.equal(five.precision, 'five');
  assert.equal(typeof five.display.chance, 'string');
  assert.ok(PRECISION_BANDS.five.some((band) => band.label === five.display.chance));
  const three = at(6);
  assert.equal(three.precision, 'three');
  assert.ok(PRECISION_BANDS.three.some((band) => band.label === three.display.chance));
  for (const view of [five, three]) {
    assert.ok(view.display.modifiers.every((item) => Object.keys(item).sort().join() === 'label,sign' && ['+', '−'].includes(item.sign)));
    assert.ok(!JSON.stringify(view.display).match(/\d/), 'a band display carries no number');
  }
});

test('a band display leaves the cut row out', () => {
  const state = plain({ loyalty: 100, traits: ['trusting'] }); setOpinion(state, NAMAR, REP, 100);
  const result = estimate(state, ask({ offerSilver: 100 }));
  assert.equal(result.value, 95);
  assert.ok(result.modifiers.length > result.display.modifiers.length, 'the cut row is in the true rows only');
});

test('an estimate draws nothing and edits nothing', () => {
  const state = plain();
  const before = JSON.stringify(state);
  estimate(state, ask({ offerSilver: 20, arguments: [{ kind: 'offer', refId: null }], argumentScore: 5 }));
  assert.equal(JSON.stringify(state), before);
});

test('the player\'s own command and an unmarked one are refused', () => {
  const state = plain();
  for (const origin of ['player', 'gate', 'narrate', undefined]) {
    const result = send(state, ask(), origin);
    assert.equal(result.ok, false, String(origin));
    assert.equal(result.error, 'Samtalsförfrågningar kan bara göras i samtalssteget.');
    assert.equal(result.state, state);
  }
  const accepted = converse(state, ask());
  assert.equal(accepted.ok, true, accepted.error);
});

test('attempt_action does not accept a conversation id', () => {
  const state = plain();
  const result = executeCharacterCommand(state, { id: 'attempt-conversation', expectedRevision: state.revision, type: 'attempt_action', payload: { actionId: 'converse_request', actorId: REP, targetIds: [NAMAR], means: { silver: 0, agentRoles: [] } } });
  assert.equal(result.ok, false);
});

test('a request draws exactly one action roll and leaves the other streams alone', () => {
  const state = withAction(plain(), 987654321);
  const result = ok(converse(state, ask()));
  const dice = { actionRngState: 987654321 }; actionRandom(dice);
  assert.equal(result.actionRngState, dice.actionRngState);
  assert.equal(result.rngState, state.rngState);
  assert.equal(result.plotRngState, state.plotRngState);
  const refused = ok(converse(withAction(plain(), REFUSE), ask({ kind: 'pledge' })));
  assert.equal(refused.rngState, state.rngState);
  assert.equal(refused.plotRngState, state.plotRngState);
  // A refused request draws nothing.
  const bad = converse(state, ask({ argumentScore: -1 }));
  assert.equal(bad.ok, false);
  assert.equal(bad.state.actionRngState, state.actionRngState);
});

test('an accepted support request pays the offer, adds opinion and records the talk', () => {
  const state = withAction(plain(), ACCEPT);
  const hook = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  const request = ask({ offerSilver: 20, hookId: hook.id, arguments: [{ kind: 'offer', refId: null }], argumentScore: 4 });
  const expected = estimate(state, request);
  const before = getPersonalOpinion(state, NAMAR, REP);
  const done = ok(converse(state, request));
  assert.equal(done.families[ARELS].treasury, state.families[ARELS].treasury - 20);
  assert.equal(done.actionPoints, state.actionPoints, 'no order point');
  assert.equal(getPersonalOpinion(done, NAMAR, REP), before + 10);
  const cause = done.relations[`${NAMAR}:${REP}`].causes.find((item) => item.label === 'Stöd i samtal');
  assert.equal(cause.amount, 10);
  const [entry] = done.conversations;
  assert.match(entry.id, /^conversation-[1-9]\d*$/);
  assert.deepEqual(Object.keys(entry).sort(), ['accepted', 'date', 'effects', 'id', 'kind', 'personId', 'roll', 'value']);
  assert.deepEqual([entry.personId, entry.kind, entry.date, entry.value, entry.accepted], [NAMAR, 'support', state.date, expected.value, true]);
  assert.ok(entry.roll >= 0 && entry.roll < 100 && entry.roll < entry.value);
  const memory = done.memories.find((item) => item.type === 'conversation');
  assert.deepEqual([...memory.participants].sort(), [REP, NAMAR].sort());
  assert.deepEqual([...memory.knownBy].sort(), [REP, NAMAR].sort());
  assert.ok(entry.effects.some((effect) => effect.kind === 'memory' && effect.memoryId === memory.id));
  assert.deepEqual(entry.effects.filter((effect) => effect.kind === 'silver'), [{ kind: 'silver', amount: 20 }]);
  assert.equal(done.hooks.find((item) => item.id === hook.id).usedAt, state.date, 'a weak hook is spent');
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));
});

test('a refused request writes only the memory and spends only a hook', () => {
  for (const kind of Object.keys(CONVERSATION_REQUESTS)) {
    const state = withAction(plain(), REFUSE);
    createSecret(state, { type: 'affair', subjectId: NAMAR, holderIds: [NAMAR], evidence: 'strong' });
    const hook = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
    const strong = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'strong' });
    const before = copy(state);
    const done = ok(converse(state, ask({ kind, offerSilver: 40, hookId: hook.id })));
    const [entry] = done.conversations;
    assert.equal(entry.accepted, false, kind);
    assert.equal(done.families[ARELS].treasury, before.families[ARELS].treasury, 'a refusal pays nothing');
    assert.equal(done.actionPoints, before.actionPoints);
    assert.equal(getPersonalOpinion(done, NAMAR, REP), getPersonalOpinion(before, NAMAR, REP), kind);
    assert.deepEqual(done.secrets, before.secrets, kind);
    assert.equal(done.hooks.length, before.hooks.length, 'no hook is granted');
    assert.equal(done.hooks.find((item) => item.id === hook.id).usedAt, state.date, 'the used hook is spent either way');
    assert.equal(done.hooks.find((item) => item.id === strong.id).usedAt, null);
    assert.deepEqual(entry.effects.map((effect) => effect.kind).sort(), ['hook_spent', 'memory'], kind);
    assert.equal(done.memories.length, before.memories.length + 1);
    assert.ok(done.memories.at(-1).knownBy.includes(REP) && done.memories.at(-1).knownBy.includes(NAMAR));
    assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));
  }
});

test('a strong hook is not spent by use', () => {
  const state = withAction(plain(), ACCEPT);
  const strong = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'strong' });
  const done = ok(converse(state, ask({ hookId: strong.id })));
  assert.equal(done.hooks.find((item) => item.id === strong.id).usedAt, null);
});

test('a hook the representative does not hold over the speaker makes the command fail', () => {
  const state = withAction(plain(), ACCEPT);
  const wrong = grantHook(state, { ownerId: REP, targetId: BAREK });
  const result = converse(state, ask({ hookId: wrong.id }));
  assert.equal(result.ok, false);
  assert.match(result.error, /övertag/i);
  assert.equal(result.state, state);
});

test('an accepted reveal gives the representative the speaker\'s strongest unexposed secret he lacks', () => {
  const state = withAction(plain(), ACCEPT);
  const weak = createSecret(state, { type: 'affair', subjectId: BAREK, holderIds: [NAMAR], evidence: 'weak' });
  const strongLow = createSecret(state, { type: 'heresy', subjectId: BAREK, holderIds: [NAMAR], evidence: 'strong' });
  const strongHigh = createSecret(state, { type: 'murder', subjectId: ESHMUN, holderIds: [NAMAR], evidence: 'strong' });
  const known = createSecret(state, { type: 'plot', subjectId: BAREK, holderIds: [NAMAR, REP], evidence: 'strong' });
  const out = createSecret(state, { type: 'affair', subjectId: ESHMUN, holderIds: [NAMAR], evidence: 'strong' });
  exposeSecret(state, out.id);
  const unheld = createSecret(state, { type: 'affair', subjectId: ESHMUN, holderIds: [BAREK], evidence: 'strong' });
  const done = ok(converse(state, ask({ kind: 'reveal_secret' })));
  assert.deepEqual(done.secrets.find((item) => item.id === strongLow.id).holderIds, [NAMAR, REP], 'strong before weak, the lower id among equals');
  for (const item of [weak, strongHigh, known, out, unheld]) assert.deepEqual(done.secrets.find((entry) => entry.id === item.id).holderIds, state.secrets.find((entry) => entry.id === item.id).holderIds, item.id);
  const reveal = done.conversations[0].effects.find((effect) => effect.kind === 'secret');
  assert.deepEqual(reveal, { kind: 'secret', secretId: strongLow.id });
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));
  // The next best follows when the first is taken.
  const again = withAction(done, ACCEPT); again.conversations = [];
  const second = ok(converse(again, ask({ kind: 'reveal_secret' })));
  assert.deepEqual(second.secrets.find((item) => item.id === strongHigh.id).holderIds, [NAMAR, REP]);
});

test('equal secrets are ordered by id, whatever the order of the list', () => {
  const state = withAction(plain(), ACCEPT);
  const low = createSecret(state, { type: 'heresy', subjectId: BAREK, holderIds: [NAMAR], evidence: 'strong' });
  const high = createSecret(state, { type: 'murder', subjectId: ESHMUN, holderIds: [NAMAR], evidence: 'strong' });
  state.secrets.reverse();
  const done = ok(converse(state, ask({ kind: 'reveal_secret' })));
  assert.deepEqual(done.secrets.find((item) => item.id === low.id).holderIds, [NAMAR, REP]);
  assert.deepEqual(done.secrets.find((item) => item.id === high.id).holderIds, [NAMAR]);
});

test('a revealed secret opens the memory it came from to the representative', () => {
  const state = withAction(plain(), ACCEPT);
  const cause = actionHooks(state).memory('plot', 'En hemlig plan', [NAMAR, BAREK], { knownBy: [NAMAR] });
  createSecret(state, { type: 'plot', subjectId: BAREK, holderIds: [NAMAR], evidence: 'weak', causeId: cause.id });
  const done = ok(converse(state, ask({ kind: 'reveal_secret' })));
  assert.deepEqual(done.memories.find((item) => item.id === cause.id).knownBy, [NAMAR, REP]);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));
});

test('with no secret to give, a reveal is accepted with a null secretId', () => {
  const state = withAction(plain(), ACCEPT);
  const done = ok(converse(state, ask({ kind: 'reveal_secret' })));
  assert.equal(done.conversations[0].accepted, true);
  assert.deepEqual(done.conversations[0].effects.find((effect) => effect.kind === 'secret'), { kind: 'secret', secretId: null });
  assert.deepEqual(done.secrets, state.secrets);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));
});

test('an accepted pledge gives the representative a weak hook over the speaker', () => {
  const state = withAction(plain(), ACCEPT);
  const done = ok(converse(state, ask({ kind: 'pledge' })));
  assert.equal(done.hooks.length, state.hooks.length + 1);
  const hook = done.hooks.at(-1);
  assert.deepEqual([hook.ownerId, hook.targetId, hook.strength, hook.usedAt], [REP, NAMAR, 'weak', null]);
  const memory = done.memories.find((item) => item.type === 'conversation');
  assert.equal(hook.causeId, memory.id);
  assert.deepEqual(done.conversations[0].effects.find((effect) => effect.kind === 'hook'), { kind: 'hook', hookId: hook.id });
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));
});

test('a person is asked once in twelve months, accepted or refused', () => {
  for (const seed of [ACCEPT, REFUSE]) {
    const first = ok(converse(withAction(plain(), seed), ask()));
    const again = estimateConversation(first, ask());
    assert.equal(again.ok, false);
    assert.equal(again.reason, RECENT_REFUSAL);
    assert.equal(RECENT_REFUSAL, 'Ni talade om detta nyss. Personen vill inte bli tillfrågad igen än.');
    assert.equal(converse(first, ask()).ok, false);
    assert.equal(estimateConversation(first, ask({ kind: 'pledge' })).reason, RECENT_REFUSAL, 'any kind');
    assert.equal(estimateConversation(first, ask({ personId: BAREK })).ok, true, 'someone else is unaffected');
    const aged = (months) => { const copyOf = copy(first); copyOf.conversations[0].date = addGameMonths(first.date, -months); return copyOf; };
    assert.equal(estimateConversation(aged(11), ask()).ok, false, 'eleven months ago');
    assert.equal(estimateConversation(aged(12), ask()).ok, true, 'twelve months ago');
  }
});

test('a request is answered by presentation lists of names and labels only', () => {
  const state = base();
  state.people[BAREK].traits = [];
  createSecret(state, { type: 'murder', subjectId: BAREK, holderIds: [REP] });
  createSecret(state, { type: 'affair', subjectId: NAMAR, holderIds: [NAMAR, BAREK] });
  const shown = createSecret(state, { type: 'heresy', subjectId: SERA, holderIds: [REP] });
  const open = createSecret(state, { type: 'plot', subjectId: BAREK, holderIds: [NAMAR] }); exposeSecret(state, open.id);
  grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'strong' });
  grantHook(state, { ownerId: NAMAR, targetId: REP });
  const spent = grantHook(state, { ownerId: REP, targetId: BAREK }); spent.usedAt = state.date;
  const view = getCharacterPresentation(state);
  const ids = view.conversationTargets.map((item) => item.id);
  assert.ok(ids.includes(SERA) && ids.includes(NAMAR) && ids.includes(BAREK));
  assert.ok(!ids.includes(REP) && !ids.includes(MIRA) && !ids.includes(TALIA));
  assert.deepEqual(view.conversationTargets.find((item) => item.id === NAMAR), { id: NAMAR, name: state.people[NAMAR].name, familyName: state.families[state.people[NAMAR].familyId].name });
  assert.deepEqual(view.ownHooks.map((item) => item.targetId), [NAMAR], 'only the representative\'s own, unspent hooks');
  assert.deepEqual(view.ownHooks[0], { id: view.ownHooks[0].id, targetId: NAMAR, targetName: state.people[NAMAR].name, strength: 'strong', strengthLabel: 'starkt' });
  const labels = view.knownSecrets.map((item) => item.typeLabel).sort();
  assert.deepEqual(labels, ['Komplott', 'Kätteri', 'Mord'], 'the secrets the representative holds, plus those already out');
  assert.ok(!labels.includes('Otrohet'), 'a secret others hold stays hidden');
  const first = view.knownSecrets.find((item) => item.id === shown.id);
  assert.deepEqual(first, { id: shown.id, type: 'heresy', typeLabel: 'Kätteri', subjectId: SERA, subjectName: state.people[SERA].name, evidence: 'weak', evidenceLabel: 'svagt', exposed: false });
  assert.ok(!JSON.stringify(view.knownSecrets).includes('holderIds'));
  const jailed = copy(state);
  imprisonPerson(jailed, SERA, ARELS, [], actionHooks(jailed), { lawful: true });
  assert.ok(!getCharacterPresentation(jailed).conversationTargets.some((item) => item.id === SERA));
  const after = ok(converse(withAction(state, ACCEPT), ask({ personId: SERA })));
  assert.ok(!getCharacterPresentation(after).conversationTargets.some((item) => item.id === SERA), 'asked within the year');
});

test('a saved conversation is checked on load', () => {
  const done = ok(converse(withAction(plain(), ACCEPT), ask({ kind: 'pledge', offerSilver: 8 })));
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));
  const forged = (change) => { const state = copy(done); change(state, state.conversations[0]); return state; };
  const cases = {
    'a bad id': (s, e) => { e.id = 'conversation-x'; },
    'an id beyond the sequence': (s, e) => { e.id = `conversation-${s.sequence + 5}`; },
    'a duplicate id': (s, e) => { s.conversations.push(copy(e)); },
    'an unknown kind': (s, e) => { e.kind = 'bribe'; },
    'an unknown person': (s, e) => { e.personId = 'person-9-9'; },
    'a future date': (s, e) => { e.date = addGameMonths(s.date, 1); },
    'a value outside the bounds': (s, e) => { e.value = 99; },
    'a roll outside 0 to 100': (s, e) => { e.roll = 120; },
    'an accepted flag that contradicts the roll': (s, e) => { e.accepted = !e.accepted; },
    'effects that are not a list': (s, e) => { e.effects = {}; },
    'an unknown effect': (s, e) => { e.effects.push({ kind: 'teleport' }); },
    'a missing memory': (s, e) => { e.effects = e.effects.filter((effect) => effect.kind !== 'memory'); },
    'a memory that does not exist': (s, e) => { e.effects.find((effect) => effect.kind === 'memory').memoryId = 'memory-9999'; },
    'a pledge without its hook': (s, e) => { e.effects = e.effects.filter((effect) => effect.kind !== 'hook'); },
    'a hook that does not exist': (s, e) => { e.effects.find((effect) => effect.kind === 'hook').hookId = 'hook-9999'; },
    'an outcome of another kind': (s, e) => { e.effects = e.effects.filter((effect) => effect.kind !== 'hook'); e.effects.push({ kind: 'opinion', fromId: e.personId, toId: REP, amount: 10 }); },
    'an extra field': (s, e) => { e.note = 'x'; },
  };
  for (const [name, change] of Object.entries(cases)) assert.throws(() => normalizeCharacterSystem(forged(change)), /(samtal|Samtal)/, name);
  const refused = ok(converse(withAction(plain(), REFUSE), ask()));
  const bad = copy(refused); bad.conversations[0].effects.push({ kind: 'opinion', fromId: NAMAR, toId: REP, amount: 10 });
  assert.throws(() => normalizeCharacterSystem(bad), /(samtal|Samtal)/, 'a refusal carries no outcome');
  const notList = copy(done); notList.conversations = {};
  assert.throws(() => normalizeCharacterSystem(notList));
});

test('a save without the conversation list gets an empty one on load', () => {
  const state = copy(base());
  delete state.conversations;
  assert.deepEqual(normalizeCharacterSystem(state).conversations, []);
});

// Fix round 1.
test('only a hook that was really spent is recorded as spent', () => {
  for (const strength of ['weak', 'strong']) {
    const state = withAction(plain(), ACCEPT);
    const hook = grantHook(state, { ownerId: REP, targetId: NAMAR, strength });
    const done = ok(converse(state, ask({ hookId: hook.id })));
    const spent = done.conversations[0].effects.filter((effect) => effect.kind === 'hook_spent');
    assert.deepEqual(spent, strength === 'weak' ? [{ kind: 'hook_spent', hookId: hook.id }] : [], strength);
    assert.equal(done.hooks.find((item) => item.id === hook.id).usedAt, strength === 'weak' ? state.date : null, strength);
    assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)), strength);
    // The same holds when the request is refused.
    const refused = ok(converse(withAction(state, REFUSE), ask({ hookId: hook.id })));
    assert.equal(refused.conversations[0].effects.some((effect) => effect.kind === 'hook_spent'), strength === 'weak', strength);
  }
  const state = withAction(plain(), ACCEPT);
  const strong = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'strong' });
  const done = ok(converse(state, ask({ hookId: strong.id })));
  const forged = copy(done); forged.conversations[0].effects.push({ kind: 'hook_spent', hookId: strong.id });
  assert.throws(() => normalizeCharacterSystem(forged), /samtal/i, 'a strong hook cannot be recorded as spent');
  const unspent = copy(done); unspent.conversations[0].effects.push({ kind: 'hook_spent', hookId: grantHook(unspent, { ownerId: REP, targetId: BAREK, strength: 'weak' }).id });
  assert.throws(() => normalizeCharacterSystem(unspent), /samtal/i, 'a weak hook that is not spent');
});

test('paying an offer costs the representative no stress', () => {
  const state = withAction(plain(), ACCEPT);
  state.people[REP].traits = [];
  const done = ok(converse(state, ask({ offerSilver: 20 })));
  assert.equal(done.families[ARELS].treasury, state.families[ARELS].treasury - 20);
  assert.equal(done.people[REP].stress, state.people[REP].stress);
});

test('an offer is refused up front when the household cannot pay it', () => {
  const state = plain();
  state.families[ARELS].headId = SERA;
  state.people[SERA].diedAt = state.date;
  const refused = estimateConversation(state, ask({ offerSilver: 10 }));
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'Familjen saknar en handlingsförmögen företrädare som kan betala gåvan.');
  assert.equal(estimateConversation(state, ask({ offerSilver: 0 })).ok, true, 'a talk without silver needs no payer');
  const command = converse(withAction(state, ACCEPT), ask({ offerSilver: 10 }));
  assert.equal(command.ok, false);
  assert.equal(command.state.actionRngState, ACCEPT, 'nothing is drawn');
});

test('the estimate returns the normalized offer and hook, and the command uses them', () => {
  const state = withAction(plain(), ACCEPT);
  const bare = estimate(state, { personId: NAMAR, kind: 'support' });
  assert.deepEqual([bare.offerSilver, bare.hookId], [0, null]);
  const hook = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  const named = estimate(state, { personId: NAMAR, kind: 'support', offerSilver: 8, hookId: hook.id });
  assert.deepEqual([named.offerSilver, named.hookId], [8, hook.id]);
  const done = ok(converse(state, { personId: NAMAR, kind: 'support', hookId: undefined }));
  assert.equal(done.conversations[0].accepted, true);
});

test('the chronicle reads naturally and an empty reveal says so', () => {
  const rep = base().people[REP].name, name = base().people[NAMAR].name;
  const titles = (seed, kind, prepare = () => {}) => { const state = withAction(plain(), seed); prepare(state); const done = ok(converse(state, ask({ kind }))); return { title: done.log.at(-1).title, text: done.log.at(-1).description, memory: done.memories.at(-1).title }; };
  assert.deepEqual(titles(ACCEPT, 'support'), { title: `${name} ger sitt stöd`, text: `${rep} bad ${name} om stöd och fick ja.`, memory: `${name} ger sitt stöd` });
  assert.equal(titles(ACCEPT, 'pledge').title, `${name} ger ett löfte`);
  assert.equal(titles(REFUSE, 'pledge').text, `${rep} bad ${name} om ett löfte men fick nej.`);
  assert.equal(titles(REFUSE, 'reveal_secret').title, `${name} avvisar förfrågan`);
  const empty = titles(ACCEPT, 'reveal_secret');
  assert.equal(empty.title, `${name} har inget att berätta`);
  assert.equal(empty.text, `${rep} bad ${name} att berätta en hemlighet, men ${name} hade inget att berätta.`);
  const told = titles(ACCEPT, 'reveal_secret', (state) => createSecret(state, { type: 'affair', subjectId: BAREK, holderIds: [NAMAR] }));
  assert.equal(told.title, `${name} anförtror sig`);
  assert.equal(told.text, `${rep} bad ${name} att berätta en hemlighet och fick ja.`);
});

// --- Final fix round ---

test('the brief holds the memories the representative can see and only the secrets both hold', () => {
  const state = base();
  const hooks = actionHooks(state);
  // The yearly decision of an office holder outside the family: a private memory with the ruler as participant, and a plot secret only he holds.
  const plot = hooks.memory('plot', 'Barek Eshmun bygger en hemlig opposition', [BAREK, REP], { knownBy: [BAREK] });
  const plotSecret = createSecret(state, { type: 'plot', subjectId: BAREK, holderIds: [BAREK], causeId: plot.id });
  const shared = hooks.memory('talk', 'Ett samtal i rådet', [BAREK, REP], { knownBy: [BAREK, REP] });
  const seen = hooks.memory('talk', 'En offentlig strid', [BAREK, NAMAR], { knownBy: 'public' });
  createSecret(state, { type: 'heresy', subjectId: SERA, holderIds: [BAREK, REP] });
  const brief = getConversationBrief(state, BAREK);
  const ids = brief.memories.map((memory) => memory.id);
  assert.ok(!ids.includes(plot.id), 'a memory only the speaker knows stays out');
  assert.ok(ids.includes(shared.id) && ids.includes(seen.id), 'memories the representative can see stay in');
  assert.deepEqual(brief.secrets, [{ typeLabel: 'Kätteri', subjectName: state.people[SERA].name }], 'only the secret both hold; the plot and the opening affair secret stay out');
  assert.equal(state.secrets.some((secret) => secret.id === plotSecret.id), true);
});

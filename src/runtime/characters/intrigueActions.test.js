import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { ACTION_CATALOG, EFFECT_KINDS, RUMOR_TOPICS, TIER_IDS, effectDefault, hookFromSecret, reveal, rumor, usesOf } from './actionCatalog.js';
import { GUARDED_ACTIONS, REASONS, estimateAction } from './actionOdds.js';
import { applyTierEffects, refusalChance, tierFor, validateActionLog } from './actionResolution.js';
import { crimeOfSecret } from './crimes.js';
import { actionHooks, advanceCharacters, createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getCatalogActions, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { actionRandom } from './extensions.js';
import { addSecretHolders, createSecret, grantHook, useHook } from './secrets.js';

const REP = 'person-0-0';
const SERA = 'person-0-2';
const TAREK = 'person-0-3';
const NAMAR = 'person-1-0';
const DARA = 'person-1-1';
const KELAN = 'person-1-2';
const BAREK = 'person-2-2';
const FAMILY = 'family-arel';
const AFFAIR = (state) => state.secrets.find((secret) => secret.type === 'affair' && secret.subjectId === BAREK);
const LOW_FIRST_DRAW = 2654435761;
const MESSAGES = {
  secret: 'Hemligheten kan inte användas mot den här personen.',
  hook: 'Greppet går inte att använda.',
  blackmail: 'Utpressning kräver en hemlighet om målet.',
};

const copy = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
const run = (state, type, payload) => executeCharacterCommand(state, { id: `command-${++counter}`, expectedRevision: state.revision, type, payload });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const feast = (state) => ok(run(state, 'hold_feast', {}));
const advance = (state, date) => { const result = advanceCharacters(state, date); assert.equal(result.ok, true, result.error); return result.state; };
const withSeed = (state, seed) => Object.assign(copy(state), { actionRngState: seed });
const draws = (seed, count) => { const dice = { actionRngState: seed }; return Array.from({ length: count }, () => actionRandom(dice) * 100); };
const row = (rows, label) => rows.find((item) => item.label === label);
const kinds = (id, tier) => ACTION_CATALOG[id].tiers[tier].effects.map((effect) => effect.kind);
const attempt = (state, intent) => run(state, 'attempt_action', intent);
const estimate = (state, intent) => estimateCharacterAction(state, intent);

// A seed whose first draws satisfy one check each; the check gets the whole list of draws. Test setup only.
function seedWhere(count, check) {
  for (let k = 1; k < 200000; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    if (check(draws(seed, count))) return seed;
  }
  throw new Error('No seed for these draws.');
}
// The roll pair after `lead` quiet draws (each at least 40, which no discovery chance reaches) lands on the tier for these odds.
function seedForTier(lead, est, tier) {
  return seedWhere(lead + 2, (values) => values.slice(0, lead).every((d) => d >= 40) && tierFor(values[lead], values[lead + 1], est.success.value, est.secrecy.value) === tier);
}
const intent = (actionId, actorId, targetId, means) => ({ actionId, actorId, targetIds: [targetId], ...(means ? { means } : {}) });
const POISON = intent('poison', SERA, TAREK);

// The feast period, then Sera poisons Tarek. The refusal draw comes first, then the discovery check on the due date, then the two rolls.
function poisoned(tier) {
  const state = feast(base());
  const chance = refusalChance(state.people[SERA], getPersonalOpinion(state, SERA, REP));
  const est = estimate(state, POISON);
  assert.equal(est.ok, true, est.reason);
  assert.ok(est.occasionId, 'the feast gives access');
  const seed = seedWhere(4, ([refusal, discovery, success, secrecy]) => refusal >= chance && discovery >= 40 && tierFor(success, secrecy, est.success.value, est.secrecy.value) === tier);
  const started = ok(attempt(withSeed(state, seed), POISON));
  const scheme = started.schemes.at(-1);
  assert.equal(scheme.status, 'active');
  assert.equal(scheme.means.occasionId, state.occasions[0].id);
  const done = advance(started, scheme.dueAt);
  const entry = done.actionLog.at(-1);
  return { before: state, done, entry, est };
}

test('the four intrigue actions carry the catalog values of the brief', () => {
  const intrigue = ['poison', 'investigate', 'blackmail', 'spread_rumor'];
  assert.deepEqual(Object.keys(ACTION_CATALOG).filter((id) => intrigue.includes(id)), intrigue, 'in this order');
  const table = {
    poison: ['Förgifta', 1, 1, 25, 'cruel', 30, 50, ['hook']],
    investigate: ['Snoka', 2, 1, 10, 'duty', 50, 65, []],
    blackmail: ['Utpressa', 0, 1, 0, 'betrayal', 35, 70, ['secret']],
    spread_rumor: ['Sprida rykte', 0, 1, 10, 'betrayal', 50, 55, ['topic']],
  };
  for (const [id, [label, months, orders, silver, tag, success, secrecy, uses]] of Object.entries(table)) {
    const entry = ACTION_CATALOG[id];
    assert.deepEqual([entry.label, entry.mode, entry.category, entry.skill, entry.defenseSkill, entry.secrecySkill], [label, 'contested', 'intrigue', 'intrigue', 'intrigue', 'intrigue'], id);
    assert.deepEqual([entry.durationMonths, entry.cost.orders, entry.cost.silver, entry.cost.stressTag, entry.cost.wallet, entry.baseSuccess, entry.baseSecrecy], [months, orders, silver, tag, 'family', success, secrecy], id);
    assert.deepEqual(usesOf(entry), uses, id);
    assert.match(entry.description, /[åäö]|[a-z]/i);
  }
  assert.deepEqual(ACTION_CATALOG.poison.traitModifiers, { actor: { deceitful: 6, cruel: 6, compassionate: -10, honest: -6 }, target: { paranoid: -12, trusting: 6 } });
  assert.deepEqual(ACTION_CATALOG.investigate.traitModifiers, { actor: { curious: 5 }, target: { paranoid: -8 } });
  assert.deepEqual(ACTION_CATALOG.blackmail.traitModifiers, { actor: { deceitful: 5, honest: -8 }, target: { craven: 8, brave: -8 } });
  assert.deepEqual(ACTION_CATALOG.spread_rumor.traitModifiers, { actor: { deceitful: 6, honest: -10 }, target: {} });
  assert.deepEqual(ACTION_CATALOG.blackmail.requires, ['secret']);
  assert.deepEqual(ACTION_CATALOG.spread_rumor.requires, ['topic']);
});

test('the tiers of the four actions list the effects of the brief', () => {
  const expected = {
    poison: [['kill', 'crime', 'memory'], ['kill', 'crime'], ['stress'], ['crime', 'opinion'], ['crime', 'hook', 'stress']],
    investigate: [['reveal'], ['reveal', 'opinion'], [], ['opinion', 'memory'], ['hook']],
    blackmail: [['hook_from_secret', 'opinion'], ['hook_from_secret', 'opinion'], ['opinion'], ['opinion', 'memory'], ['hook', 'stress']],
    spread_rumor: [['rumor', 'influence'], ['rumor', 'influence', 'opinion'], [], ['opinion', 'influence'], ['opinion', 'influence', 'stress']],
  };
  for (const [id, perTier] of Object.entries(expected)) TIER_IDS.forEach((tier, index) => assert.deepEqual(kinds(id, tier), perTier[index], `${id}.${tier}`));
  const range = (id, tier, kind) => { const effect = ACTION_CATALOG[id].tiers[tier].effects.find((item) => item.kind === kind); return [effect.min, effect.max]; };
  assert.deepEqual(range('poison', 'quiet_failure', 'stress'), [10, 20]);
  assert.deepEqual(range('poison', 'exposed_failure', 'opinion'), [-60, -40]);
  assert.deepEqual(range('poison', 'backfire', 'stress'), [10, 20]);
  assert.deepEqual(range('investigate', 'exposed_success', 'opinion'), [-20, -10]);
  assert.deepEqual(range('blackmail', 'clean_success', 'opinion'), [-20, -10]);
  assert.deepEqual(range('blackmail', 'quiet_failure', 'opinion'), [-15, -5]);
  assert.deepEqual(range('blackmail', 'exposed_failure', 'opinion'), [-30, -20]);
  assert.deepEqual(range('blackmail', 'backfire', 'stress'), [5, 10]);
  assert.deepEqual(range('spread_rumor', 'clean_success', 'influence'), [-8, -3]);
  assert.deepEqual(range('spread_rumor', 'exposed_failure', 'influence'), [-5, -2]);
  const kill = (tier) => ACTION_CATALOG.poison.tiers[tier].effects[0];
  assert.deepEqual([kill('clean_success').reason, kill('exposed_success').reason], ['Sjukdom', 'Förgiftad']);
  assert.deepEqual(ACTION_CATALOG.poison.tiers.backfire.effects[1], { kind: 'hook', owner: 'target', over: 'actor', strength: 'strong' });
  assert.deepEqual(ACTION_CATALOG.investigate.tiers.backfire.effects[0], { kind: 'hook', owner: 'target', over: 'actor', strength: 'weak' });
  assert.equal(ACTION_CATALOG.poison.tiers.clean_success.effects[2].title, 'Giftet verkade');
  const added = ['reveal', 'hook_from_secret', 'rumor'];
  assert.deepEqual(EFFECT_KINDS.filter((kind) => added.includes(kind)), added, 'in this order');
  assert.deepEqual([reveal('actor'), hookFromSecret(), hookFromSecret(true), rumor()], [{ kind: 'reveal', who: 'actor' }, { kind: 'hook_from_secret', exposed: false }, { kind: 'hook_from_secret', exposed: true }, { kind: 'rumor' }]);
  assert.deepEqual(Object.keys(RUMOR_TOPICS), ['plot', 'murder', 'affair', 'illegitimate']);
});

test('a poisoning at a feast reaches all five tiers', () => {
  const results = Object.fromEntries(TIER_IDS.map((tier) => [tier, poisoned(tier)]));
  for (const tier of TIER_IDS) {
    const { done, entry, before } = results[tier];
    assert.equal(entry.tier, tier);
    assert.equal(entry.actorId, SERA);
    assert.deepEqual(entry.targetIds, [TAREK]);
    assert.equal(done.schemes.at(-1).status, 'resolved');
    assert.equal(entry.estimate.success, results[tier].est.success.value, 'the due-date estimate keeps the feast access');
    assert.equal(entry.estimate.refusal, null, 'the order was obeyed at the start');
    assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)), tier);
    assert.equal(before.people[TAREK].diedAt ?? null, null);
  }
  const clean = results.clean_success;
  assert.ok(clean.done.people[TAREK].diedAt, 'Tarek is dead');
  assert.equal(clean.done.people[TAREK].deathReason, 'Sjukdom');
  const crimeRecord = (entry) => entry.effects.find((effect) => effect.kind === 'crime');
  assert.deepEqual([crimeRecord(clean.entry).crime, crimeRecord(clean.entry).exposed], ['kinslaying', false], 'poisoning a son-in-law is kinslaying');
  const secret = clean.done.secrets.find((item) => item.id === crimeRecord(clean.entry).secretId);
  assert.equal(secret.exposed, false);
  assert.deepEqual(secret.holderIds, [SERA]);
  assert.equal(secret.type, 'murder');
  assert.deepEqual(crimeOfSecret(clean.done, secret.id), { crime: 'kinslaying', victimId: TAREK });
  assert.ok(clean.entry.effects.some((effect) => effect.kind === 'memory' && effect.title === 'Giftet verkade' && effect.visibility === 'private'));

  const exposed = results.exposed_success;
  assert.equal(exposed.done.people[TAREK].deathReason, 'Förgiftad');
  assert.equal(crimeRecord(exposed.entry).exposed, true);
  assert.equal(exposed.done.secrets.find((item) => item.id === crimeRecord(exposed.entry).secretId).exposed, true);
  assert.ok(exposed.done.log.some((event) => event.type === 'crime_exposed'), 'the exposure is chronicled');

  const quiet = results.quiet_failure;
  assert.equal(quiet.done.people[TAREK].diedAt ?? null, null);
  assert.equal(quiet.done.people[TAREK].stress, quiet.before.people[TAREK].stress + effectDefault(ACTION_CATALOG.poison.tiers.quiet_failure.effects[0]));
  assert.equal(quiet.entry.effects.some((effect) => effect.kind === 'crime'), false);

  const failure = results.exposed_failure;
  assert.equal(failure.done.people[TAREK].diedAt ?? null, null);
  assert.deepEqual([crimeRecord(failure.entry).crime, crimeRecord(failure.entry).exposed], ['attempted_murder', true]);
  assert.equal(failure.done.secrets.find((item) => item.id === crimeRecord(failure.entry).secretId).exposed, true);
  const opinionEffect = failure.entry.effects.find((effect) => effect.kind === 'opinion');
  assert.deepEqual([opinionEffect.fromId, opinionEffect.toId, opinionEffect.value], [TAREK, SERA, -50]);

  const backfire = results.backfire;
  assert.equal(backfire.done.people[TAREK].diedAt ?? null, null);
  assert.deepEqual([crimeRecord(backfire.entry).crime, crimeRecord(backfire.entry).exposed], ['attempted_murder', true]);
  assert.equal(backfire.done.secrets.find((item) => item.id === crimeRecord(backfire.entry).secretId).exposed, true);
  const hook = backfire.done.hooks.find((item) => item.ownerId === TAREK && item.targetId === SERA);
  assert.equal(hook.strength, 'strong');
  assert.equal(backfire.done.people[SERA].stress, backfire.before.people[SERA].stress + 15);
});

test('a murder crime secret created by a poisoning feeds blackmail exposure through crimeOfSecret', () => {
  const { done, entry } = poisoned('clean_success');
  const secretId = entry.effects.find((effect) => effect.kind === 'crime').secretId;
  const state = addSecretHolders(done, secretId, [REP]) && done;
  const blackmail = intent('blackmail', REP, SERA, { secretId });
  const est = estimate(state, blackmail);
  assert.equal(est.ok, true, est.reason);
  const seed = seedForTier(0, est, 'exposed_success');
  const after = ok(attempt(withSeed(state, seed), blackmail));
  const resolution = after.actionLog.at(-1);
  assert.equal(resolution.tier, 'exposed_success');
  assert.equal(after.secrets.find((secret) => secret.id === secretId).exposed, true);
  assert.ok(after.log.some((event) => event.type === 'crime_exposed'), 'a crime secret is exposed as a crime');
  assert.ok(Object.values(after.relations).some((relation) => relation.causes.some((cause) => cause.label === 'Släktmord')), 'the kinslaying opinion consequences ran');
  const hookEffect = resolution.effects.find((effect) => effect.kind === 'hook_from_secret');
  assert.deepEqual([hookEffect.exposed, hookEffect.strength, hookEffect.secretId], [true, 'weak', secretId]);
  assert.doesNotThrow(() => validateActionLog(after));
});

test('crimeOfSecret is null for a secret that no recorded crime created', () => {
  const state = base();
  assert.equal(crimeOfSecret(state, AFFAIR(state).id), null);
  assert.equal(crimeOfSecret(state, 'secret-9999'), null);
  const plain = createSecret(state, { type: 'heresy', subjectId: KELAN, holderIds: [KELAN], evidence: 'weak', causeId: null });
  assert.equal(crimeOfSecret(state, plain.id), null);
});

test('a grip adds 20 to a poisoning, and the rows for evidence, rulers, bodyguards and weak health move the odds', () => {
  const state = base();
  const plain = estimate(state, intent('poison', REP, TAREK));
  const hook = grantHook(state, { ownerId: REP, targetId: TAREK, strength: 'weak' });
  const gripped = estimate(state, intent('poison', REP, TAREK, { hookId: hook.id }));
  assert.equal(gripped.ok, true, gripped.reason);
  assert.equal(gripped.success.value, plain.success.value + 20);
  assert.equal(row(gripped.success.modifiers, 'Påtryckning genom ett grepp').value, 20);
  assert.equal(row(plain.success.modifiers, 'Påtryckning genom ett grepp'), undefined);
  assert.equal(gripped.secrecy.value, plain.secrecy.value, 'a grip changes the success only');
  assert.ok(gripped.display.modifiers.some((item) => item.label === 'Påtryckning genom ett grepp'));

  const strong = addSecretHolders(state, AFFAIR(state).id, [REP]) && AFFAIR(state);
  const weak = createSecret(state, { type: 'heresy', subjectId: BAREK, holderIds: [REP], evidence: 'weak', causeId: null });
  const strongOdds = estimate(state, intent('blackmail', REP, BAREK, { secretId: strong.id }));
  const weakOdds = estimate(state, intent('blackmail', REP, BAREK, { secretId: weak.id }));
  assert.equal(row(strongOdds.success.modifiers, 'Bevis: starkt').value, 25);
  assert.equal(row(weakOdds.success.modifiers, 'Bevis: svagt').value, 10);
  assert.equal(strongOdds.success.value - weakOdds.success.value, 15);

  const npc = (actorId, targetId) => estimateAction(state, intent('poison', actorId, targetId), actionHooks(state).npcEstimateContext(actorId));
  const ruler = npc(DARA, REP);
  assert.equal(ruler.ok, true, ruler.reason);
  assert.equal(row(ruler.success.modifiers, 'Målet är härskare').value, -15);
  assert.equal(row(ruler.success.modifiers, 'Målets livvakter').value, -10);
  const official = npc(DARA, SERA);
  assert.equal(row(official.success.modifiers, 'Målet är härskare'), undefined);
  assert.equal(row(official.success.modifiers, 'Målets livvakter').value, -10, 'Sera governs a city');
  const commoner = npc(DARA, TAREK);
  assert.equal(row(commoner.success.modifiers, 'Målets livvakter'), undefined);
  assert.equal(row(commoner.success.modifiers, 'Målet är härskare'), undefined);
  assert.ok(GUARDED_ACTIONS.includes('poison'));

  const frail = copy(state);
  frail.people[TAREK].health = 39;
  assert.equal(row(estimate(frail, intent('poison', REP, TAREK)).success.modifiers, 'Målets svaga hälsa').value, 10);
  frail.people[TAREK].health = 40;
  assert.equal(row(estimate(frail, intent('poison', REP, TAREK)).success.modifiers, 'Målets svaga hälsa'), undefined);
  frail.people[TAREK].health = 10;
  assert.equal(row(estimate(frail, intent('investigate', REP, TAREK)).success.modifiers, 'Målets svaga hälsa'), undefined, 'only poison reads the health');
});

test('the new refusals', () => {
  const state = base();
  const secret = AFFAIR(state);
  const reason = (actionId, actorId, targetId, means) => { const est = estimate(state, intent(actionId, actorId, targetId, means)); assert.equal(est.ok, false, `${actionId} ${JSON.stringify(means)}`); return est.reason; };
  assert.equal(reason('blackmail', REP, BAREK), MESSAGES.blackmail);
  assert.equal(reason('blackmail', REP, BAREK, {}), MESSAGES.blackmail);
  assert.equal(reason('blackmail', REP, BAREK, { secretId: secret.id }), MESSAGES.secret, 'the actor does not hold it');
  const held = copy(state);
  addSecretHolders(held, secret.id, [REP]);
  const heldReason = (actionId, actorId, targetId, means) => { const est = estimate(held, intent(actionId, actorId, targetId, means)); assert.equal(est.ok, false); return est.reason; };
  assert.equal(estimate(held, intent('blackmail', REP, BAREK, { secretId: secret.id })).ok, true);
  assert.equal(heldReason('blackmail', REP, KELAN, { secretId: secret.id }), MESSAGES.secret, 'its subject is not the target');
  assert.equal(heldReason('blackmail', REP, BAREK, { secretId: 'secret-99999' }), MESSAGES.secret);
  const exposed = copy(held);
  AFFAIR(exposed).exposed = true;
  AFFAIR(exposed).exposedAt = exposed.date;
  assert.equal(estimateCharacterAction(exposed, intent('blackmail', REP, BAREK, { secretId: secret.id })).reason, MESSAGES.secret, 'an exposed secret is no leverage');
  assert.equal(heldReason('poison', REP, BAREK, { secretId: secret.id }), REASONS.means, 'poison takes no secret');
  assert.equal(heldReason('blackmail', REP, BAREK, { secretId: 7 }), REASONS.means);

  const mine = grantHook(held, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  const foreign = grantHook(held, { ownerId: KELAN, targetId: NAMAR, strength: 'strong' });
  const elsewhere = grantHook(held, { ownerId: REP, targetId: KELAN, strength: 'strong' });
  const spent = grantHook(held, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  useHook(held, spent.id);
  assert.equal(estimate(held, intent('poison', REP, NAMAR, { hookId: mine.id })).ok, true);
  for (const id of [foreign.id, elsewhere.id, spent.id, 'hook-99999']) assert.equal(heldReason('poison', REP, NAMAR, { hookId: id }), MESSAGES.hook, id);
  assert.equal(heldReason('sway', REP, NAMAR, { hookId: mine.id }), REASONS.means, 'sway takes no grip');
  assert.equal(heldReason('poison', REP, NAMAR, { hookId: 3 }), REASONS.means);
  // A hook is usable only while its owner (the actor) and its subject (the target) live, and a dead actor or target is refused before the hook is read. So no hook-specific refusal exists for a dead party; the person refusals come first.
  const dead = copy(held);
  dead.people[NAMAR].diedAt = dead.date;
  assert.equal(estimateCharacterAction(dead, intent('poison', REP, NAMAR, { hookId: mine.id })).reason, REASONS.targetDead);
  const gone = copy(held);
  gone.people[REP].diedAt = gone.date;
  assert.equal(estimateCharacterAction(gone, intent('poison', REP, NAMAR, { hookId: mine.id })).reason, REASONS.actorDead);

  assert.equal(reason('spread_rumor', REP, NAMAR), REASONS.topic);
  assert.equal(reason('spread_rumor', REP, NAMAR, { topic: 'weather' }), REASONS.topic);
  assert.equal(reason('spread_rumor', REP, NAMAR, { topic: 4 }), REASONS.means);
  assert.equal(reason('sway', REP, NAMAR, { topic: 'plot' }), REASONS.means);
  assert.equal(reason('poison', REP, NAMAR, { color: 'red' }), REASONS.means, 'unknown keys are refused');
  for (const topic of Object.keys(RUMOR_TOPICS)) assert.equal(estimate(state, intent('spread_rumor', REP, NAMAR, { topic })).ok, true, topic);
});

test('blackmail with a strong secret grants a strong hook, a weak one grants a weak hook', () => {
  for (const [evidence, strength] of [['strong', 'strong'], ['weak', 'weak']]) {
    const state = base();
    const secret = AFFAIR(state);
    secret.evidence = evidence;
    addSecretHolders(state, secret.id, [REP]);
    const blackmail = intent('blackmail', REP, BAREK, { secretId: secret.id });
    const est = estimate(state, blackmail);
    const after = ok(attempt(withSeed(state, seedForTier(0, est, 'clean_success')), blackmail));
    const entry = after.actionLog.at(-1);
    assert.equal(entry.tier, 'clean_success');
    const record = entry.effects.find((effect) => effect.kind === 'hook_from_secret');
    assert.deepEqual([record.strength, record.secretId, record.exposed], [strength, secret.id, false]);
    const hook = after.hooks.find((item) => item.id === record.hookId);
    assert.deepEqual([hook.ownerId, hook.targetId, hook.strength, hook.usedAt], [REP, BAREK, strength, null]);
    assert.equal(after.secrets.find((item) => item.id === secret.id).exposed, false, 'a quiet success keeps the secret');
    assert.equal(after.families[FAMILY].treasury, state.families[FAMILY].treasury, 'blackmail costs no silver');
    assert.ok(getPersonalOpinion(after, BAREK, REP) < getPersonalOpinion(state, BAREK, REP));
    assert.doesNotThrow(() => normalizeCharacterSystem(copy(after)));
  }
});

test('blackmail on a non-crime secret exposes the secret on an exposed success and holds a hook on the exposed failure backfire', () => {
  const state = base();
  const secret = AFFAIR(state);
  addSecretHolders(state, secret.id, [REP]);
  const blackmail = intent('blackmail', REP, BAREK, { secretId: secret.id });
  const est = estimate(state, blackmail);
  const loud = ok(attempt(withSeed(state, seedForTier(0, est, 'exposed_success')), blackmail));
  assert.equal(AFFAIR(loud).exposed, true);
  assert.equal(loud.log.some((event) => event.type === 'crime_exposed'), false, 'an affair is no crime');
  assert.equal(loud.hooks.some((hook) => hook.ownerId === REP && hook.targetId === BAREK), true);
  const backfire = ok(attempt(withSeed(state, seedForTier(0, est, 'backfire')), blackmail));
  const hook = backfire.hooks.find((item) => item.ownerId === BAREK && item.targetId === REP);
  assert.equal(hook.strength, 'weak');
  assert.equal(backfire.people[REP].stress > state.people[REP].stress, true);
  assert.equal(backfire.hooks.some((item) => item.ownerId === REP && item.targetId === BAREK), false);
});

test('a weak grip is spent when the scheme resolves, a strong grip stays', () => {
  const quiet = seedWhere(3, ([discovery]) => discovery >= 40);
  const state = base();
  const weak = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  const strong = grantHook(state, { ownerId: REP, targetId: KELAN, strength: 'strong' });
  const weakStart = ok(attempt(withSeed(state, quiet), intent('poison', REP, NAMAR, { hookId: weak.id })));
  const scheme = weakStart.schemes.at(-1);
  assert.equal(scheme.means.hookId, weak.id, 'the scheme keeps the grip');
  assert.equal(weakStart.hooks.find((hook) => hook.id === weak.id).usedAt, null, 'not spent at the start');
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(weakStart)));
  const done = advance(weakStart, scheme.dueAt);
  assert.equal(done.hooks.find((hook) => hook.id === weak.id).usedAt, scheme.dueAt);
  assert.equal(done.actionLog.at(-1).hookId, weak.id);
  assert.equal(estimate(done, intent('poison', REP, NAMAR, { hookId: weak.id })).reason, MESSAGES.hook);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));

  const strongStart = ok(attempt(withSeed(state, quiet), intent('poison', REP, KELAN, { hookId: strong.id })));
  const strongDone = advance(strongStart, strongStart.schemes.at(-1).dueAt);
  assert.equal(strongDone.actionLog.at(-1).hookId, strong.id, 'the use is recorded');
  assert.equal(strongDone.hooks.find((hook) => hook.id === strong.id).usedAt, null);
  assert.equal(estimate(strongDone, intent('poison', REP, KELAN, { hookId: strong.id })).ok, true);
});

test('the grip is spent whatever the tier', () => {
  for (const tier of TIER_IDS) {
    const state = base();
    const hook = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
    const poison = intent('poison', REP, NAMAR, { hookId: hook.id });
    const est = estimate(state, poison);
    const started = ok(attempt(withSeed(state, seedForTier(1, est, tier)), poison));
    const done = advance(started, started.schemes.at(-1).dueAt);
    assert.equal(done.actionLog.at(-1).tier, tier);
    assert.equal(done.hooks.find((item) => item.id === hook.id).usedAt, done.date, tier);
  }
});

test('a refused order spends no grip and a grip spent before the due date collapses the scheme', () => {
  const state = base();
  state.people[SERA].loyalty = 0;
  state.relations[`${SERA}:${REP}`] = { fromId: SERA, toId: REP, bonds: [], causes: [{ id: 'fixture', amount: -150, label: 'Provvärde', causeId: 'fixture', startAt: state.date, expiresAt: null }] };
  const hook = grantHook(state, { ownerId: SERA, targetId: NAMAR, strength: 'weak' });
  const refused = ok(attempt(withSeed(state, LOW_FIRST_DRAW), intent('poison', SERA, NAMAR, { hookId: hook.id })));
  assert.equal(refused.actionLog.at(-1).refused, true);
  assert.equal(refused.schemes.length, 0);
  assert.equal(refused.hooks.find((item) => item.id === hook.id).usedAt, null);

  const quiet = seedWhere(2, ([discovery]) => discovery >= 40);
  const own = base();
  const spendable = grantHook(own, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  const started = ok(attempt(withSeed(own, quiet), intent('poison', REP, NAMAR, { hookId: spendable.id })));
  const stolen = copy(started);
  useHook(stolen, spendable.id);
  const after = advance(stolen, stolen.schemes.at(-1).dueAt);
  assert.equal(after.schemes.at(-1).status, 'failed');
  assert.equal(after.actionLog.length, 0);
});

test('investigate reveals an existing affair and returns no secret when there is none', () => {
  const state = base();
  const investigate = intent('investigate', REP, BAREK);
  const est = estimate(state, investigate);
  assert.equal(est.ok, true, est.reason);
  const seed = seedWhere(4, ([a, b, success, secrecy]) => a >= 40 && b >= 40 && tierFor(success, secrecy, est.success.value, est.secrecy.value) === 'clean_success');
  const started = ok(attempt(withSeed(state, seed), investigate));
  const scheme = started.schemes.at(-1);
  assert.equal(scheme.dueAt, addGameMonths(state.date, 2));
  assert.deepEqual(AFFAIR(started).holderIds, [BAREK], 'nothing is learned before the due date');
  const done = advance(started, scheme.dueAt);
  const entry = done.actionLog.at(-1);
  assert.equal(entry.tier, 'clean_success');
  assert.deepEqual(entry.effects, [{ kind: 'reveal', secretId: AFFAIR(state).id }]);
  assert.deepEqual(AFFAIR(done).holderIds, [BAREK, REP]);
  assert.equal(AFFAIR(done).exposed, false);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(done)));

  const empty = copy(state);
  empty.secrets = empty.secrets.filter((secret) => secret.subjectId !== BAREK);
  const none = estimate(empty, investigate);
  const emptySeed = seedWhere(4, ([a, b, success, secrecy]) => a >= 40 && b >= 40 && tierFor(success, secrecy, none.success.value, none.secrecy.value) === 'clean_success');
  const emptyStart = ok(attempt(withSeed(empty, emptySeed), investigate));
  const emptyDone = advance(emptyStart, emptyStart.schemes.at(-1).dueAt);
  assert.deepEqual(emptyDone.actionLog.at(-1).effects, [{ kind: 'reveal', secretId: null }]);
});

test('reveal takes the strongest unexposed secret the actor lacks and skips exposed ones and ones the actor knows', () => {
  const state = base();
  const hooks = actionHooks(state);
  const anchor = hooks.memory('action', 'Provminne', [REP, BAREK], { knownBy: [REP] });
  const resolution = { actorId: REP, targetIds: [BAREK], memoryId: anchor.id, tier: 'clean_success' };
  const entry = { label: 'Prov', tiers: { clean_success: { effects: [reveal('actor')] } } };
  AFFAIR(state).evidence = 'weak';
  const weak = createSecret(state, { type: 'heresy', subjectId: BAREK, holderIds: [BAREK], evidence: 'weak', causeId: null });
  const known = createSecret(state, { type: 'plot', subjectId: BAREK, holderIds: [BAREK, REP], evidence: 'strong', causeId: null });
  const out = createSecret(state, { type: 'murder', subjectId: BAREK, holderIds: [BAREK], evidence: 'strong', causeId: null });
  out.exposed = true; out.exposedAt = state.date;
  const other = createSecret(state, { type: 'heresy', subjectId: KELAN, holderIds: [KELAN], evidence: 'strong', causeId: null });
  const late = createSecret(state, { type: 'illegitimate_child', subjectId: BAREK, holderIds: [BAREK], evidence: 'strong', causeId: null });
  const learned = () => applyTierEffects(state, resolution, entry, hooks, []);
  assert.deepEqual(learned(), [{ kind: 'reveal', secretId: late.id }], 'a strong secret beats earlier weak ones');
  assert.deepEqual(learned(), [{ kind: 'reveal', secretId: AFFAIR(state).id }], 'the earlier weak secret comes next');
  assert.deepEqual(learned(), [{ kind: 'reveal', secretId: weak.id }]);
  assert.deepEqual(learned(), [{ kind: 'reveal', secretId: null }], 'exposed secrets and ones the actor holds are skipped');
  assert.deepEqual(state.secrets.find((item) => item.id === known.id).holderIds, [BAREK, REP]);
  assert.deepEqual(state.secrets.find((item) => item.id === out.id).holderIds, [BAREK]);
  assert.deepEqual(state.secrets.find((item) => item.id === other.id).holderIds, [KELAN]);
});

test('spread_rumor needs a topic and records the rumor it plants with the topic', () => {
  const state = base();
  const rumorIntent = intent('spread_rumor', REP, NAMAR, { topic: 'affair' });
  const est = estimate(state, rumorIntent);
  assert.equal(est.ok, true, est.reason);
  assert.equal(est.cost.silver, 10);
  const after = ok(attempt(withSeed(state, seedForTier(0, est, 'clean_success')), rumorIntent));
  const entry = after.actionLog.at(-1);
  assert.equal(entry.tier, 'clean_success');
  assert.deepEqual(entry.effects[0], { kind: 'rumor', topic: 'affair', rumorId: after.rumors[0].id });
  const influence = entry.effects[1];
  assert.equal(influence.kind, 'influence');
  assert.equal(influence.familyId, 'family-namar');
  assert.equal(influence.value, effectDefault(ACTION_CATALOG.spread_rumor.tiers.clean_success.effects[1]));
  assert.equal(after.families['family-namar'].influence, state.families['family-namar'].influence + influence.applied);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(after)));
  const loud = ok(attempt(withSeed(state, seedForTier(0, est, 'exposed_success')), rumorIntent));
  assert.ok(getPersonalOpinion(loud, NAMAR, REP) < getPersonalOpinion(state, NAMAR, REP));
  const failed = ok(attempt(withSeed(state, seedForTier(0, est, 'exposed_failure')), rumorIntent));
  assert.equal(failed.families[FAMILY].influence < state.families[FAMILY].influence, true);
  assert.equal(failed.actionLog.at(-1).effects.some((effect) => effect.kind === 'rumor'), false);
});

test('the menu lists only the secrets and grips the representative holds', () => {
  const state = base();
  addSecretHolders(state, AFFAIR(state).id, [REP]);
  const heresy = createSecret(state, { type: 'heresy', subjectId: KELAN, holderIds: [REP], evidence: 'weak', causeId: null });
  const unheld = createSecret(state, { type: 'plot', subjectId: DARA, holderIds: [DARA], evidence: 'weak', causeId: null });
  const exposed = createSecret(state, { type: 'plot', subjectId: NAMAR, holderIds: [REP], evidence: 'weak', causeId: null });
  exposed.exposed = true; exposed.exposedAt = state.date;
  const dead = createSecret(state, { type: 'plot', subjectId: TAREK, holderIds: [REP], evidence: 'weak', causeId: null });
  state.people[TAREK].diedAt = state.date;
  const mine = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'strong' });
  const spent = grantHook(state, { ownerId: REP, targetId: KELAN, strength: 'weak' });
  useHook(state, spent.id);
  const foreign = grantHook(state, { ownerId: KELAN, targetId: NAMAR, strength: 'weak' });
  const list = getCatalogActions(state);
  const find = (id) => list.find((entry) => entry.catalogId === id);

  const secrets = find('blackmail').fields.find((field) => field.key === 'secretId');
  assert.equal(secrets.type, 'select');
  assert.deepEqual(secrets.options.map((option) => option.value).sort(), [AFFAIR(state).id, heresy.id].sort());
  assert.ok(!secrets.options.some((option) => [unheld.id, exposed.id, dead.id].includes(option.value)));
  assert.equal(secrets.options.some((option) => option.value === ''), false, 'blackmail requires a secret, so there is no empty option');
  const label = secrets.options.find((option) => option.value === AFFAIR(state).id).label;
  assert.match(label, /Otrohet/);
  assert.match(label, new RegExp(state.people[BAREK].name));

  const grips = find('poison').fields.find((field) => field.key === 'hookId');
  assert.deepEqual(grips.options[0], { value: '', label: 'Ingen' });
  assert.deepEqual(grips.options.slice(1).map((option) => option.value), [mine.id]);
  assert.ok(!grips.options.some((option) => [spent.id, foreign.id].includes(option.value)));

  const topic = find('spread_rumor').fields.find((field) => field.key === 'topic');
  assert.deepEqual(topic.options.map((option) => option.value), ['plot', 'murder', 'affair', 'illegitimate']);
  assert.equal(topic.options.some((option) => option.value === ''), false);
  assert.deepEqual(topic.options.map((option) => option.label), Object.values(RUMOR_TOPICS));

  assert.deepEqual(find('investigate').fields.map((field) => field.key), ['targetId', 'silver', 'agentRoles']);
  assert.deepEqual(find('blackmail').fields.map((field) => field.key), ['targetId', 'silver', 'agentRoles', 'secretId']);
  assert.deepEqual(find('poison').fields.map((field) => field.key), ['targetId', 'silver', 'agentRoles', 'hookId']);
  assert.deepEqual(find('spread_rumor').fields.map((field) => field.key), ['targetId', 'silver', 'agentRoles', 'topic']);
  assert.deepEqual(find('sway').fields.map((field) => field.key), ['targetId', 'silver', 'agentRoles']);
  assert.equal(find('poison').disabledReason, '');
});

test('schemes keep secretId, hookId and topic and validation refuses malformed ones', () => {
  const state = base();
  const hook = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'strong' });
  const started = ok(attempt(withSeed(state, seedWhere(1, ([d]) => d >= 40)), intent('poison', REP, NAMAR, { hookId: hook.id })));
  const scheme = started.schemes.at(-1);
  assert.deepEqual(Object.keys(scheme.means).sort(), ['agentRoles', 'hookId', 'silver']);
  const bad = (change) => { const copyState = copy(started); change(copyState.schemes.at(-1).means); return copyState; };
  assert.throws(() => normalizeCharacterSystem(bad((means) => { means.hookId = 7; })), /En plans medel/);
  assert.throws(() => normalizeCharacterSystem(bad((means) => { means.secretId = ['x']; })), /En plans medel/);
  assert.throws(() => normalizeCharacterSystem(bad((means) => { means.topic = {}; })), /En plans medel/);
  assert.throws(() => normalizeCharacterSystem(bad((means) => { means.hookId = 'bad id!'; })), /En plans medel/);
  assert.doesNotThrow(() => normalizeCharacterSystem(bad((means) => { means.secretId = 'secret-1'; means.topic = 'plot'; })));
});

test('estimates draw no randomness and leave the state unchanged', () => {
  const state = base();
  addSecretHolders(state, AFFAIR(state).id, [REP]);
  const hook = grantHook(state, { ownerId: REP, targetId: NAMAR, strength: 'weak' });
  const snapshot = JSON.stringify(state);
  const streams = [state.rngState, state.actionRngState, state.plotRngState];
  estimate(state, intent('poison', REP, NAMAR, { hookId: hook.id }));
  estimate(state, intent('blackmail', REP, BAREK, { secretId: AFFAIR(state).id }));
  estimate(state, intent('spread_rumor', REP, NAMAR, { topic: 'plot' }));
  estimate(state, intent('investigate', REP, NAMAR));
  getCatalogActions(state);
  assert.deepEqual([state.rngState, state.actionRngState, state.plotRngState], streams);
  assert.equal(JSON.stringify(state), snapshot);
});

test('the action log validation refuses forged records of the new effect kinds', () => {
  let state = base();
  addSecretHolders(state, AFFAIR(state).id, [REP]);
  for (const next of [intent('blackmail', REP, BAREK, { secretId: AFFAIR(state).id }), intent('spread_rumor', REP, NAMAR, { topic: 'plot' })]) {
    state = ok(attempt(withSeed(state, seedForTier(0, estimate(state, next), 'clean_success')), next));
  }
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)));
  const [blackmail, rumorEntry] = state.actionLog;
  const forged = (change) => { const result = copy(state); change(result.actionLog[0], result.actionLog[1]); return result; };
  const effectOf = (entry, kind) => entry.effects.find((effect) => effect.kind === kind);
  const cases = {
    'a hook_from_secret on a missing hook': (a) => { effectOf(a, 'hook_from_secret').hookId = 'hook-99999'; },
    'a hook_from_secret on a missing secret': (a) => { effectOf(a, 'hook_from_secret').secretId = 'secret-99999'; },
    'a hook_from_secret with an unknown strength': (a) => { effectOf(a, 'hook_from_secret').strength = 'mighty'; },
    'a hook_from_secret whose exposure is no boolean': (a) => { effectOf(a, 'hook_from_secret').exposed = 'yes'; },
    'a rumor on an unknown topic': (a, b) => { effectOf(b, 'rumor').topic = 'weather'; },
    'a rumor with a rumor id that is no text': (a, b) => { effectOf(b, 'rumor').rumorId = 5; },
    'a reveal of a missing secret': (a) => { a.effects.push({ kind: 'reveal', secretId: 'secret-99999' }); },
    'a hook used that does not exist': (a) => { a.hookId = 'hook-99999'; },
  };
  assert.equal(blackmail.actionId, 'blackmail');
  assert.equal(rumorEntry.actionId, 'spread_rumor');
  for (const [name, change] of Object.entries(cases)) assert.throws(() => normalizeCharacterSystem(forged(change)), /handlingsloggen/i, name);
  const revealed = forged((a) => { a.effects.push({ kind: 'reveal', secretId: null }, { kind: 'reveal', secretId: AFFAIR(state).id }); });
  assert.doesNotThrow(() => normalizeCharacterSystem(revealed));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { ACTION_CATALOG, EFFECT_KINDS, TIER_IDS, crime, imprison, kill } from './actionCatalog.js';
import { GUARDED_ACTIONS, REASONS, estimateAction } from './actionOdds.js';
import { applyTierEffects, refusalChance, tierFor, validateActionLog } from './actionResolution.js';
import { actionHooks, advanceCharacters, createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getCatalogActions, getCharacterPresentation, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { actionRandom, plotRandom } from './extensions.js';
import { createSecret, exposeSecret } from './secrets.js';
import { IMPRISONED, RANSOM, closePrisoner, heldPrisoners, imprisonPerson, isImprisoned, presentPrisoners, prisonerOf, prisonerStep } from './prisoners.js';

const REP = 'person-0-0';
const SERA = 'person-0-2';
const KELAN = 'person-1-2';
const NAMAR = 'person-1-0';
const BAREK = 'person-2-2';
const ARELS = 'family-arel';
const NAMARS = 'family-namar';
const NAMAR_ADULTS = ['person-1-0', 'person-1-1', 'person-1-3'];
const RULER_ONLY = 'Bara härskaren kan fängsla.';

const copy = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
const run = (state, type, payload) => executeCharacterCommand(state, { id: `command-${++counter}`, expectedRevision: state.revision, type, payload });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const advance = (state, date) => { const result = advanceCharacters(state, date); assert.equal(result.ok, true, result.error); return result.state; };
const withSeed = (state, seed) => Object.assign(copy(state), { actionRngState: seed });
const withPlotSeed = (state, seed) => Object.assign(copy(state), { plotRngState: seed });
const worldContent = (state) => { const { revision: _revision, appliedCommandIds: _commands, ...content } = state; return content; };
const row = (rows, label) => rows.find((item) => item.label === label);
const causeOf = (state, fromId, toId, label) => state.relations[`${fromId}:${toId}`]?.causes.find((cause) => cause.label === label);

// Takes a person prisoner straight through the engine's hooks, the way a punish_crime or a plot would.
function seize(state, personId, options) {
  return imprisonPerson(state, personId, ARELS, [], actionHooks(state), options);
}

// Writes a complete action log entry with the given effects applied, the way a resolved action leaves it, so the state still validates.
function record(state, actorId, targetId, effects) {
  const hooks = actionHooks(state);
  const anchor = hooks.memory('action', 'Provminne', [actorId, targetId], { knownBy: [actorId] });
  const resolution = { id: `resolution-${++state.sequence}`, commandId: null, actionId: 'imprison', actorId, targetIds: [targetId], agentIds: [], date: state.date, playerControlled: false, precision: 'exact', memoryId: anchor.id,
    estimate: { success: 50, secrecy: 50, refusal: null }, rolls: { refusal: null, success: 10, secrecy: 10 }, tier: 'clean_success', effects: [], narrative: null, refused: false };
  resolution.effects = applyTierEffects(state, resolution, { label: 'Prov', tiers: { clean_success: { effects } } }, hooks, []);
  state.actionLog.push(resolution);
  return resolution;
}
// A conviction: an exposed secret that the action log records as a crime (an attempted murder by this person), which is what makes an arrest lawful.
function convict(state, personId) {
  const resolution = record(state, personId, BAREK, [crime('attempted_murder', false)]);
  exposeSecret(state, resolution.effects[0].secretId);
  return state;
}

const draws = (seed, count) => { const dice = { actionRngState: seed }; return Array.from({ length: count }, () => actionRandom(dice) * 100); };
function seedWhere(count, check) {
  for (let k = 1; k < 200000; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    if (check(draws(seed, count))) return seed;
  }
  throw new Error('No seed for these draws.');
}
function plotSeedWhere(check) {
  for (let k = 1; k < 200000; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    if (check(plotRandom({ plotRngState: seed }))) return seed;
  }
  throw new Error('No plot seed.');
}
const IMPRISON = (targetId = KELAN) => ({ actionId: 'imprison', actorId: REP, targetIds: [targetId] });

// The ruler imprisons Kelan; the roll pair (no refusal draw: the ruler gives his own order) lands on the tier.
function imprisoned(tier, prepare = (state) => state) {
  const state = prepare(base());
  const est = estimateCharacterAction(state, IMPRISON());
  assert.equal(est.ok, true, est.reason);
  const seed = seedWhere(2, ([success, secrecy]) => tierFor(success, secrecy, est.success.value, est.secrecy.value) === tier);
  const done = ok(run(withSeed(state, seed), 'attempt_action', IMPRISON()));
  return { before: state, done, entry: done.actionLog.at(-1), est };
}

test('the imprison entry carries the catalog values of the brief', () => {
  const entry = ACTION_CATALOG.imprison;
  assert.deepEqual(Object.keys(ACTION_CATALOG).at(-1), 'imprison');
  assert.deepEqual([entry.label, entry.category, entry.mode, entry.skill, entry.defenseSkill, entry.secrecySkill], ['Fängsla', 'court', 'contested', 'prowess', 'prowess', 'intrigue']);
  assert.deepEqual(entry.cost, { orders: 1, silver: 10, wallet: 'realm', stressTag: 'risky' });
  assert.deepEqual([entry.durationMonths, entry.baseSuccess, entry.baseSecrecy, entry.uses], [0, 60, 5, []]);
  assert.deepEqual(entry.actorOffice, { id: 'ruler', reason: RULER_ONLY });
  assert.ok(EFFECT_KINDS.includes('imprison') && EFFECT_KINDS.includes('grievance'));
  const kinds = (tier) => entry.tiers[tier].effects.map((effect) => effect.kind);
  assert.deepEqual(TIER_IDS.map(kinds), [['imprison', 'opinion'], ['imprison', 'opinion'], [], ['opinion'], ['opinion', 'grievance', 'stress']]);
  const range = (tier, kind) => { const effect = entry.tiers[tier].effects.find((item) => item.kind === kind); return [effect.min, effect.max]; };
  assert.deepEqual(range('clean_success', 'opinion'), [-30, -15]);
  assert.deepEqual(range('exposed_success', 'opinion'), [-30, -15]);
  assert.deepEqual(range('exposed_failure', 'opinion'), [-40, -20]);
  assert.deepEqual(range('backfire', 'opinion'), [-50, -30]);
  assert.deepEqual(range('backfire', 'stress'), [5, 15]);
  assert.deepEqual(entry.tiers.backfire.effects[1], { kind: 'grievance', family: 'target', amount: -10 });
  assert.deepEqual(entry.tiers.clean_success.effects[0], { kind: 'imprison', who: 'target' });
});

test('imprisoning the general vacates his office and charges the realm', () => {
  const { before, done, entry } = imprisoned('clean_success');
  assert.equal(before.offices.general.holderId, KELAN);
  assert.equal(done.offices.general.holderId, null);
  assert.equal(done.realm.treasury, before.realm.treasury - 10);
  assert.equal(done.families[ARELS].treasury, before.families[ARELS].treasury);
  assert.equal(done.actionPoints, before.actionPoints - 1);
  assert.equal(entry.actionId, 'imprison');
  const [record] = done.prisoners;
  assert.deepEqual(record, { id: record.id, personId: KELAN, captorFamilyId: ARELS, since: done.date, ransom: RANSOM, status: 'held', closedAt: null, reason: null });
  assert.match(record.id, /^prisoner-[1-9]\d*$/);
  assert.equal(isImprisoned(done, KELAN), true);
  assert.deepEqual(entry.effects[0], { kind: 'imprison', personId: KELAN, prisonerId: record.id });
  const opinion = entry.effects[1];
  assert.equal(opinion.kind, 'opinion');
  assert.ok(opinion.value >= -30 && opinion.value <= -15);
  assert.equal(getPersonalOpinion(done, KELAN, REP) <= getPersonalOpinion(before, KELAN, REP) + opinion.value, true);
  validateActionLog(done);
  assert.deepEqual(normalizeCharacterSystem(copy(done)).prisoners, done.prisoners);
  assert.ok(done.log.some((event) => event.type === 'imprisonment' && event.public === true && event.title === 'Kelan Namar fängslas'));
});

test('an unlawful imprisonment costs legitimacy and grievance, a lawful one does not', () => {
  const { before, done } = imprisoned('exposed_success');
  assert.equal(done.realm.legitimacy, before.realm.legitimacy - 5);
  // 8 for the lost office (the vacate path) and 8 more for the unlawful act.
  assert.equal(done.families[NAMARS].grievance, before.families[NAMARS].grievance - 16);
  const lawful = imprisoned('exposed_success', (state) => convict(state, KELAN));
  assert.equal(lawful.done.realm.legitimacy, lawful.before.realm.legitimacy);
  assert.equal(lawful.done.families[NAMARS].grievance, lawful.before.families[NAMARS].grievance - 8);
  assert.equal(isImprisoned(lawful.done, KELAN), true);
  normalizeCharacterSystem(copy(lawful.done));
});

test('an exposed opposition plot secret does not make an arrest lawful', () => {
  for (const [label, prepare] of Object.entries({
    'an exposed plot secret from undermine': (state) => { const secret = createSecret(state, { type: 'plot', subjectId: KELAN, holderIds: [KELAN], evidence: 'strong' }); exposeSecret(state, secret.id); return state; },
    'an exposed murder secret no action log records as a crime': (state) => { const secret = createSecret(state, { type: 'murder', subjectId: KELAN, holderIds: [KELAN], evidence: 'strong' }); exposeSecret(state, secret.id); return state; },
    'a recorded crime that is still hidden': (state) => { record(state, KELAN, BAREK, [crime('attempted_murder', false)]); return state; },
  })) {
    const { before, done } = imprisoned('exposed_success', prepare);
    assert.equal(done.realm.legitimacy, before.realm.legitimacy - 5, label);
    assert.equal(done.families[NAMARS].grievance, before.families[NAMARS].grievance - 16, label);
  }
});

test('the other tiers: nothing, an opinion hit, or a backfire that costs the ruler', () => {
  const quiet = imprisoned('quiet_failure');
  assert.equal(isImprisoned(quiet.done, KELAN), false);
  assert.deepEqual(quiet.done.prisoners, []);
  assert.equal(quiet.done.realm.treasury, quiet.before.realm.treasury - 10);
  assert.deepEqual(quiet.entry.effects, []);
  const exposed = imprisoned('exposed_failure');
  assert.equal(isImprisoned(exposed.done, KELAN), false);
  assert.ok(exposed.entry.effects[0].value >= -40 && exposed.entry.effects[0].value <= -20);
  const backfire = imprisoned('backfire');
  assert.equal(isImprisoned(backfire.done, KELAN), false);
  assert.equal(backfire.done.families[NAMARS].grievance, backfire.before.families[NAMARS].grievance - 10);
  assert.equal(backfire.entry.effects[1].kind, 'grievance');
  assert.deepEqual(backfire.entry.effects[1], { kind: 'grievance', familyId: NAMARS, amount: -10, applied: -10 });
  assert.ok(backfire.done.people[REP].stress >= backfire.before.people[REP].stress + 5);
  for (const result of [quiet, exposed, backfire]) validateActionLog(normalizeCharacterSystem(copy(result.done)));
});

test('only the ruler can imprison, and only from the realm wallet', () => {
  const state = base();
  const refused = estimateCharacterAction(state, { actionId: 'imprison', actorId: SERA, targetIds: [KELAN] });
  assert.deepEqual([refused.ok, refused.reason], [false, RULER_ONLY]);
  const poor = copy(state);
  poor.realm.treasury = 5;
  poor.families[ARELS].treasury = 500;
  assert.equal(estimateCharacterAction(poor, IMPRISON()).reason, 'Det behövs 10 silver; tillgängligt 5.');
  const family = copy(state);
  family.families[ARELS].treasury = 0;
  assert.equal(estimateCharacterAction(family, IMPRISON()).ok, true, 'the family wallet does not pay');
  const entryOf = (s) => getCatalogActions(s).find((action) => action.catalogId === 'imprison');
  assert.equal(entryOf(state).disabledReason, '');
  assert.equal(entryOf(poor).disabledReason, 'Det behövs 10 silver; tillgängligt 5.');
  assert.equal(entryOf(family).disabledReason, '');
  const dissolved = copy(state);
  dissolved.realm.alive = false;
  assert.notEqual(entryOf(dissolved).disabledReason, '');
  assert.deepEqual(entryOf(state).fields.map((field) => field.key), ['targetId', 'silver', 'agentRoles']);
});

test('the guard rows apply to imprison', () => {
  assert.ok(GUARDED_ACTIONS.includes('poison') && GUARDED_ACTIONS.includes('imprison'));
  const state = base();
  const guarded = estimateCharacterAction(state, IMPRISON(KELAN));
  assert.equal(row(guarded.success.modifiers, 'Målets livvakter').value, -10);
  assert.equal(row(guarded.success.modifiers, 'Målet är härskare'), undefined);
  const free = estimateCharacterAction(state, IMPRISON('person-1-3'));
  assert.equal(row(free.success.modifiers, 'Målets livvakter'), undefined);
  assert.equal(row(free.success.modifiers, 'Målets svaga hälsa'), undefined, 'the frail row is for poison only');
  assert.equal(guarded.success.modifiers[0].value, 60);
  assert.equal(guarded.secrecy.modifiers[0].value, 5);
});

test('a prisoner cannot act and cannot be taken twice', () => {
  const state = base();
  seize(state, SERA);
  const act = estimateCharacterAction(state, { actionId: 'sway', actorId: SERA, targetIds: [KELAN] });
  assert.deepEqual([act.ok, act.reason], [false, IMPRISONED]);
  assert.equal(REASONS.imprisoned, IMPRISONED);
  const again = estimateCharacterAction(state, IMPRISON(SERA));
  assert.deepEqual([again.ok, again.reason], [false, IMPRISONED]);
  assert.throws(() => seize(state, SERA), new RegExp(IMPRISONED));
  assert.throws(() => seize(state, 'person-nobody'), /lever inte eller saknas/);
  const catalog = getCatalogActions(state).find((action) => action.catalogId === 'imprison');
  assert.equal(catalog.fields[0].options.some((option) => option.value === SERA), false, 'the menu leaves prisoners out');
});

test('an imprisoned person is skipped by aiAnnual and is no feast guest', () => {
  const state = base();
  seize(state, KELAN);
  const free = Object.values(state.people).find((person) => person.id === NAMAR);
  assert.equal(free.lastDecision, null);
  const next = advance(state, state.nextAnnualDate);
  assert.equal(next.people[KELAN].lastDecision, null, 'the prisoner takes no yearly decision');
  assert.equal(next.people[NAMAR].lastDecision.date, next.date);
  const fest = ok(run(state, 'hold_feast', {}));
  assert.equal(fest.occasions[0].guestIds.includes(KELAN), false);
  assert.equal(fest.occasions[0].guestIds.includes(NAMAR), true);
  const spare = ok(run(base(), 'hold_feast', {}));
  assert.equal(spare.occasions[0].guestIds.includes(KELAN), true);
});

test('death closes the record as dead; the prisoner list shows only the held', () => {
  const state = base();
  const record = seize(state, KELAN);
  assert.deepEqual(presentPrisoners(state, ARELS), [{ id: record.id, personId: KELAN, name: 'Kelan Namar', familyId: NAMARS, familyName: 'Namar', since: state.date, ransom: RANSOM }]);
  assert.deepEqual(getCharacterPresentation(state).prisoners, presentPrisoners(state, ARELS));
  assert.deepEqual(presentPrisoners(state, NAMARS), []);
  actionHooks(state).kill([KELAN], [], 'Sjukdom');
  assert.equal(record.status, 'dead');
  assert.equal(record.closedAt, state.date);
  assert.equal(record.reason, 'Sjukdom');
  assert.equal(isImprisoned(state, KELAN), false);
  assert.deepEqual(getCharacterPresentation(state).prisoners, []);
  assert.equal(closePrisoner(state, KELAN, 'released', 'x'), null, 'a closed record stays closed');
  normalizeCharacterSystem(copy(state));
});

test('a prisoner who inherits the throne is released', () => {
  const state = base();
  assert.equal(state.realm.legalHeirId, SERA);
  const record = seize(state, SERA);
  assert.equal(state.offices['governor-0'].holderId, null);
  actionHooks(state).kill([REP], [], 'Sjukdom');
  assert.equal(state.offices.ruler.holderId, SERA);
  assert.equal(record.status, 'released');
  assert.equal(record.reason, 'Ärvde tronen');
  assert.equal(record.closedAt, state.date);
  assert.equal(isImprisoned(state, SERA), false);
  const probe = estimateAction(state, { actionId: 'sway', actorId: SERA, targetIds: [KELAN] }, actionHooks(state).estimateContext());
  assert.equal(probe.ok, true, probe.reason);
  normalizeCharacterSystem(copy(state));
});

// The crown passes to Namar when every Arel dies; the prisoners then belong to Namar.
function crownToNamar() {
  const state = base();
  const records = { barek: seize(state, BAREK), safra: seize(state, 'person-3-2'), kelan: seize(state, KELAN), heir: seize(state, NAMAR) };
  actionHooks(state).kill(Object.values(state.people).filter((person) => person.familyId === ARELS).map((person) => person.id), [], 'Sjukdom');
  return { state, records };
}

test('prisoners belong to the crown: they pass to the new ruling family, and his own kin go free', () => {
  const { state, records } = crownToNamar();
  assert.equal(state.offices.ruler.holderId, NAMAR);
  assert.deepEqual([records.heir.status, records.heir.reason], ['released', 'Ärvde tronen']);
  assert.deepEqual([records.kelan.status, records.kelan.reason, records.kelan.closedAt], ['released', 'Hans ätt tog tronen', state.date]);
  assert.equal(isImprisoned(state, KELAN), false);
  for (const held of [records.barek, records.safra]) assert.deepEqual([held.status, held.captorFamilyId], ['held', NAMARS]);
  assert.deepEqual(presentPrisoners(state, NAMARS).map((item) => item.personId).sort(), [BAREK, 'person-3-2']);
  assert.deepEqual(presentPrisoners(state, ARELS), []);
  assert.ok(state.log.some((event) => event.type === 'prisoner_released' && /Hans ätt tog tronen/.test(event.description)));
  assert.deepEqual(getCharacterPresentation(state).prisoners, presentPrisoners(state, NAMARS));
  normalizeCharacterSystem(copy(state));
});

test('the new ruling family can release, execute and ransom what the crown holds', () => {
  const { state, records } = crownToNamar();
  const released = ok(run(state, 'release_prisoner', { prisonerId: records.barek.id }));
  assert.equal(released.prisoners.find((item) => item.id === records.barek.id).status, 'released');
  assert.equal(released.actionPoints, state.actionPoints - 1);
  const executed = ok(run(released, 'execute_prisoner', { prisonerId: records.safra.id }));
  assert.equal(executed.prisoners.find((item) => item.id === records.safra.id).status, 'executed');
  assert.equal(executed.people['person-3-2'].deathReason, 'Avrättad');
  assert.equal(run(state, 'release_prisoner', { prisonerId: records.kelan.id }).ok, false, 'a released record is closed');
  const held = copy(state);
  held.plotRngState = OFFER;
  held.families['family-eshmun'].treasury = 100;
  const next = advance(held, held.nextAnnualDate);
  assert.equal(next.status.ended, false);
  const offer = next.stories.find((item) => item.type === 'ransom_offer');
  assert.ok(offer, 'prisonerStep works for the new ruling family');
  assert.deepEqual([offer.prisonerId, offer.familyId], [records.barek.id, 'family-eshmun']);
  normalizeCharacterSystem(copy(executed));
});

test('the same family on the throne again moves nothing', () => {
  const state = base();
  const record = seize(state, KELAN);
  actionHooks(state).kill([REP], [], 'Sjukdom');
  assert.equal(state.offices.ruler.holderId, SERA);
  assert.deepEqual([record.status, record.captorFamilyId], ['held', ARELS]);
});

test('an imprison effect on a target who is already imprisoned or dead records applied false', () => {
  const state = base();
  seize(state, SERA);
  const second = record(state, REP, SERA, [imprison('target')]);
  assert.deepEqual(second.effects, [{ kind: 'imprison', personId: SERA, applied: false }]);
  assert.equal(state.prisoners.length, 1, 'no second record');
  actionHooks(state).kill([KELAN], [], 'Sjukdom');
  const dead = record(state, REP, KELAN, [imprison('target')]);
  assert.deepEqual(dead.effects, [{ kind: 'imprison', personId: KELAN, applied: false }]);
  assert.equal(state.prisoners.length, 1);
  const fresh = record(state, REP, NAMAR, [imprison('target')]);
  assert.equal(fresh.effects[0].prisonerId, state.prisoners.at(-1).id);
  assert.equal(isImprisoned(state, NAMAR), true);
  normalizeCharacterSystem(copy(state));
  const forged = copy(state);
  forged.actionLog.find((entry) => entry.id === second.id).effects[0].prisonerId = 'prisoner-1';
  assert.throws(() => normalizeCharacterSystem(forged), /handlingsloggen/i);
});

test('the log validation refuses forged grievance records', () => {
  const { done } = imprisoned('backfire');
  const entry = done.actionLog.at(-1);
  const index = entry.effects.findIndex((effect) => effect.kind === 'grievance');
  assert.deepEqual(entry.effects[index], { kind: 'grievance', familyId: NAMARS, amount: -10, applied: -10 });
  normalizeCharacterSystem(copy(done));
  const half = copy(done);
  half.actionLog.at(-1).effects[index].applied = -4;
  normalizeCharacterSystem(half);
  const cases = {
    'an extra key': (effect) => { effect.value = -10; },
    'a missing applied': (effect) => { delete effect.applied; },
    'a fractional amount': (effect) => { effect.amount = -9.5; },
    'a fractional applied': (effect) => { effect.applied = -9.5; },
    'applied beyond the amount': (effect) => { effect.applied = -12; },
    'applied against the amount': (effect) => { effect.applied = 3; },
    'a text amount': (effect) => { effect.amount = '-10'; },
    'an unknown family': (effect) => { effect.familyId = 'family-nobody'; },
    'an inherited family key': (effect) => { effect.familyId = 'toString'; },
  };
  for (const [label, change] of Object.entries(cases)) {
    const forged = copy(done);
    change(forged.actionLog.at(-1).effects[index]);
    assert.throws(() => normalizeCharacterSystem(forged), /handlingsloggen/i, label);
  }
});

test('release_prisoner frees him and improves the opinion of him and his head', () => {
  const state = base();
  const record = seize(state, KELAN);
  const result = run(state, 'release_prisoner', { prisonerId: record.id });
  const done = ok(result);
  assert.equal(done.actionPoints, state.actionPoints - 1);
  assert.equal(done.realm.treasury, state.realm.treasury);
  assert.equal(done.prisoners[0].status, 'released');
  assert.equal(done.prisoners[0].closedAt, done.date);
  assert.equal(causeOf(done, KELAN, REP, 'Frigiven ur fängelset').amount, 10);
  assert.equal(causeOf(done, NAMAR, REP, 'Frigiven ur fängelset').amount, 10);
  assert.equal(isImprisoned(done, KELAN), false);
  assert.equal(done.people[KELAN].diedAt, null);
  assert.equal(run(done, 'release_prisoner', { prisonerId: record.id }).ok, false, 'a closed record cannot be released again');
  assert.equal(run(state, 'release_prisoner', { prisonerId: 'prisoner-999' }).error, 'Fången finns inte bland dem du håller.');
  assert.equal(run(state, 'release_prisoner', {}).ok, false);
  normalizeCharacterSystem(copy(done));
});

test('execute_prisoner kills him, turns his family against the ruler and costs legitimacy unless lawful', () => {
  const state = base();
  const record = seize(state, KELAN);
  const done = ok(run(state, 'execute_prisoner', { prisonerId: record.id }));
  assert.equal(done.actionPoints, state.actionPoints - 1);
  assert.equal(done.people[KELAN].diedAt, done.date);
  assert.equal(done.people[KELAN].deathReason, 'Avrättad');
  assert.equal(done.prisoners[0].status, 'executed');
  assert.equal(done.prisoners[0].reason, 'Avrättad');
  for (const id of NAMAR_ADULTS) assert.equal(causeOf(done, id, REP, 'Avrättad släkting').amount, -50, id);
  assert.equal(state.realm.legitimacy, 60, 'the unlawful imprisonment cost 5');
  assert.equal(done.realm.legitimacy, state.realm.legitimacy - 4, 'the execution of an unconvicted prisoner costs 4');
  assert.ok(done.people[REP].stress > state.people[REP].stress, 'cruelty stress');
  const lawfulBase = convict(base(), KELAN);
  const lawfulRecord = seize(lawfulBase, KELAN);
  const lawful = ok(run(lawfulBase, 'execute_prisoner', { prisonerId: lawfulRecord.id }));
  assert.equal(lawful.realm.legitimacy, lawfulBase.realm.legitimacy);
  assert.equal(lawful.prisoners[0].status, 'executed');
  normalizeCharacterSystem(copy(done));
  normalizeCharacterSystem(copy(lawful));
});

// Kelan is held; the Namar treasury covers the ransom (or does not); the plot stream decides.
function heldYear({ treasury = 100, plotSeed }) {
  const state = base();
  seize(state, KELAN);
  state.families[NAMARS].treasury = treasury;
  if (plotSeed) state.plotRngState = plotSeed;
  return state;
}
const OFFER = plotSeedWhere((value) => value < 0.6);
const NO_OFFER = plotSeedWhere((value) => value >= 0.6);

test('a ransom offer appears at a found plot seed; accept pays 40 silver and releases', () => {
  const state = heldYear({ plotSeed: OFFER });
  const next = advance(state, state.nextAnnualDate);
  assert.equal(next.prisoners[0].status, 'held');
  const story = next.stories.find((item) => item.type === 'ransom_offer');
  assert.ok(story, 'the offer is open');
  assert.equal(story.status, 'open');
  assert.equal(story.prisonerId, next.prisoners[0].id);
  assert.equal(story.familyId, NAMARS);
  assert.notEqual(next.plotRngState, OFFER, 'the plot stream was drawn');
  const view = getCharacterPresentation(next).stories.find((item) => item.id === story.id);
  assert.deepEqual(view.choices.map((choice) => choice.id), ['accept', 'refuse']);
  for (const choice of view.choices) assert.deepEqual(Object.keys(choice).sort(), ['cost', 'description', 'disabledReason', 'id', 'label', 'stress']);
  assert.deepEqual(view.choices.map((choice) => choice.disabledReason), ['', '']);
  const done = ok(run(next, 'resolve_story', { storyId: story.id, choiceId: 'accept' }));
  assert.equal(done.realm.treasury, next.realm.treasury + RANSOM);
  assert.equal(done.families[NAMARS].treasury, next.families[NAMARS].treasury - RANSOM);
  assert.equal(done.prisoners[0].status, 'ransomed');
  assert.equal(done.prisoners[0].reason, 'Lösen betald');
  assert.equal(isImprisoned(done, KELAN), false);
  assert.equal(causeOf(done, NAMAR, REP, 'Lösen mottogs').amount, 10);
  assert.equal(done.stories.find((item) => item.id === story.id).status, 'resolved');
  normalizeCharacterSystem(copy(done));
});

test('refusing the ransom keeps him and sours the head; the offer is not repeated while open', () => {
  const state = heldYear({ plotSeed: OFFER });
  const next = advance(state, state.nextAnnualDate);
  const story = next.stories.find((item) => item.type === 'ransom_offer');
  const done = ok(run(next, 'resolve_story', { storyId: story.id, choiceId: 'refuse' }));
  assert.equal(done.prisoners[0].status, 'held');
  assert.equal(done.realm.treasury, next.realm.treasury);
  assert.equal(causeOf(done, NAMAR, REP, 'Lösen avvisades').amount, -10);
  assert.equal(done.stories.find((item) => item.id === story.id).status, 'resolved');
});

test('an open offer is not offered again and draws nothing', () => {
  const state = heldYear({ plotSeed: OFFER });
  const open = advance(state, state.nextAnnualDate);
  const stream = open.plotRngState, events = [];
  prisonerStep(open, events, actionHooks(open));
  assert.equal(open.stories.filter((item) => item.type === 'ransom_offer').length, 1);
  assert.equal(open.plotRngState, stream);
  assert.deepEqual(events, []);
});

test('an unanswered offer lapses at its due date without touching opinion, and the family decides again', () => {
  const state = heldYear({ plotSeed: OFFER });
  const open = advance(state, state.nextAnnualDate);
  const story = open.stories.find((item) => item.type === 'ransom_offer');
  assert.equal(story.dueAt, open.nextAnnualDate);
  const midway = advance(open, addGameMonths(open.date, 6));
  assert.equal(midway.stories.find((item) => item.id === story.id).status, 'open', 'still open before the due date');
  const result = advanceCharacters(open, open.nextAnnualDate);
  assert.equal(result.ok, true, result.error);
  const later = result.state;
  const lapsed = later.stories.find((item) => item.id === story.id);
  assert.equal(lapsed.status, 'closed');
  assert.equal(lapsed.resolvedAt, later.date);
  assert.match(lapsed.resolution, /förföll utan svar/);
  assert.equal(causeOf(later, NAMAR, REP, 'Lösen avvisades'), undefined, 'a lapsed offer changes no opinion');
  assert.equal(later.prisoners[0].status, 'held');
  assert.notEqual(later.plotRngState, open.plotRngState, 'the family decided again the same year');
  const decided = later.stories.some((item) => item.type === 'ransom_offer' && item.id !== story.id && item.status === 'open') || causeOf(later, NAMAR, REP, 'Släkting i fångenskap') !== undefined;
  assert.equal(decided, true, 'a new offer or a revolt');
});

test('prisonerStep does nothing once the campaign has ended', () => {
  const state = heldYear({ plotSeed: NO_OFFER });
  const control = copy(state);
  const ended = copy(state);
  ended.status = { ended: true, reason: 'Riket saknar en giltig fortsättning.' };
  const events = [];
  prisonerStep(ended, events, actionHooks(ended));
  assert.deepEqual(events, []);
  assert.equal(ended.plotRngState, NO_OFFER);
  assert.equal(ended.families[NAMARS].grievance, state.families[NAMARS].grievance);
  assert.deepEqual(ended.stories, state.stories);
  const live = [];
  prisonerStep(control, live, actionHooks(control));
  assert.equal(live.length > 0 && control.plotRngState !== NO_OFFER, true, 'the same state acts while the campaign runs');
});

test('the offer closes when the prisoner is no longer held', () => {
  const state = heldYear({ plotSeed: OFFER });
  const next = advance(state, state.nextAnnualDate);
  const freed = ok(run(next, 'release_prisoner', { prisonerId: next.prisoners[0].id }));
  const story = freed.stories.find((item) => item.type === 'ransom_offer');
  assert.equal(story.status, 'closed');
  assert.match(story.resolution, /inte längre/);
});

test('the revolt branch: family grievance, head opinion and a public event', () => {
  const state = heldYear({ plotSeed: NO_OFFER });
  const result = advanceCharacters(state, state.nextAnnualDate);
  assert.equal(result.ok, true, result.error);
  const next = result.state;
  assert.equal(next.stories.some((item) => item.type === 'ransom_offer'), false);
  assert.equal(causeOf(next, NAMAR, REP, 'Släkting i fångenskap').amount, -15);
  const event = result.events.find((item) => item.title === 'Namar rustar mot kronan');
  assert.ok(event && event.public === true);
  assert.equal(next.prisoners[0].status, 'held');
  assert.notEqual(next.plotRngState, NO_OFFER, 'the draw was made');
  const twin = advance(base(), base().nextAnnualDate);
  assert.equal(next.families[NAMARS].grievance < twin.families[NAMARS].grievance, true);
});

test('a family that cannot pay prepares a revolt without a draw', () => {
  const state = heldYear({ treasury: 10, plotSeed: OFFER });
  const next = advance(state, state.nextAnnualDate);
  assert.equal(next.stories.some((item) => item.type === 'ransom_offer'), false);
  assert.equal(next.plotRngState, OFFER, 'no draw when the treasury cannot cover the ransom');
  assert.equal(causeOf(next, NAMAR, REP, 'Släkting i fångenskap').amount, -15);
});

test('the yearly prisoner step leaves the main and action streams alone', () => {
  const held = heldYear({ plotSeed: OFFER });
  const free = copy(held);
  free.prisoners = [];
  free.offices.general.holderId = KELAN;
  const a = advance(held, held.nextAnnualDate), b = advance(free, free.nextAnnualDate);
  assert.equal(a.rngState, b.rngState);
  assert.equal(a.actionRngState, b.actionRngState);
  assert.notEqual(a.plotRngState, b.plotRngState);
});

test('a prisoner held by his own family is neither ransomed nor avenged', () => {
  const state = base();
  seize(state, SERA);
  state.plotRngState = OFFER;
  const next = advance(state, state.nextAnnualDate);
  assert.equal(next.plotRngState, OFFER);
  assert.equal(next.stories.some((item) => item.type === 'ransom_offer'), false);
});

test('a year with prisoners advanced whole and split gives identical state', () => {
  for (const plotSeed of [OFFER, NO_OFFER]) {
    const state = heldYear({ plotSeed });
    const target = addGameMonths(state.nextAnnualDate, 2);
    const whole = advance(state, target);
    let split = state;
    for (let month = 1; month <= 14; month++) split = advance(split, addGameMonths(state.date, month));
    assert.equal(split.date, target);
    assert.deepEqual(worldContent(split), worldContent(whole));
    const midway = advance(advance(state, addGameMonths(state.nextAnnualDate, -1)), target);
    assert.deepEqual(worldContent(midway), worldContent(whole));
  }
});

// A crime exposed by another person's hand opens punish_crime for the ruler.
function openCase() {
  const state = base();
  const hooks = actionHooks(state);
  const anchor = hooks.memory('action', 'Provminne', [KELAN, BAREK], { knownBy: [KELAN] });
  const entry = { label: 'Prov', tiers: { clean_success: { effects: [kill('target', 'Mördad'), crime('murder', true)] } } };
  applyTierEffects(state, { actorId: KELAN, targetIds: [BAREK], memoryId: anchor.id, tier: 'clean_success' }, entry, hooks, []);
  return state;
}
const caseOf = (state) => state.stories.find((story) => story.type === 'punish_crime');

test('punish_crime imprison now imprisons the subject lawfully', () => {
  const state = openCase();
  const story = caseOf(state);
  const view = getCharacterPresentation(state).stories.find((item) => item.id === story.id);
  assert.equal(view.choices[0].id, 'imprison');
  assert.equal(view.choices[0].disabledReason, '');
  const done = ok(run(state, 'resolve_story', { storyId: story.id, choiceId: 'imprison' }));
  assert.equal(isImprisoned(done, KELAN), true);
  assert.equal(done.realm.legitimacy, state.realm.legitimacy, 'the crime is exposed, so the imprisonment is lawful');
  assert.equal(done.offices.general.holderId, null);
  assert.equal(done.prisoners[0].captorFamilyId, ARELS);
  assert.equal(done.stories.find((item) => item.id === story.id).status, 'resolved');
  normalizeCharacterSystem(copy(done));
});

test('an open punish_crime closes when its subject is imprisoned by another path', () => {
  const state = openCase();
  const story = caseOf(state);
  assert.equal(story.status, 'open');
  seize(state, KELAN);
  const done = ok(run(state, 'rest', {}));
  const closed = done.stories.find((item) => item.id === story.id);
  assert.equal(closed.status, 'closed');
  assert.match(closed.resolution, /fängslad/);
});

test('an imprisoned actor\'s running scheme collapses at the next check', () => {
  const state = base();
  const intent = { actionId: 'undermine', actorId: SERA, targetIds: [KELAN] };
  const chance = refusalChance(state.people[SERA], getPersonalOpinion(state, SERA, REP));
  const seed = seedWhere(1, ([refusal]) => refusal >= chance);
  const started = ok(run(withSeed(state, seed), 'attempt_action', intent));
  const scheme = started.schemes.at(-1);
  assert.equal(scheme.status, 'active');
  seize(started, SERA);
  const stream = started.actionRngState;
  const done = advance(started, scheme.nextCheckAt);
  assert.equal(done.schemes.at(-1).status, 'failed');
  assert.equal(done.actionRngState, stream, 'the scheme collapses before any draw');
  assert.ok(done.log.some((event) => event.type === 'scheme_failed' && /fängslad/.test(event.description)));
});

test('an imprisoned person cannot be appointed to an office', () => {
  const state = base();
  seize(state, KELAN);
  const result = run(state, 'appoint', { officeId: 'general', personId: KELAN });
  assert.equal(result.ok, false);
  assert.equal(result.error, IMPRISONED);
});

test('validation: the full prisoner shape', () => {
  const held = base();
  const record = seize(held, KELAN);
  const closed = copy(held);
  closePrisoner(closed, KELAN, 'released', 'Frigiven av härskaren');
  const cases = {
    'not a list': (s) => { s.prisoners = {}; },
    'a string entry': (s) => { s.prisoners = ['x']; },
    'bad id': (s) => { s.prisoners[0].id = 'prisoner-x'; },
    'id beyond the sequence': (s) => { s.prisoners[0].id = 'prisoner-99999'; },
    'duplicate id': (s) => { s.prisoners.push(copy(s.prisoners[0])); },
    'unknown person': (s) => { s.prisoners[0].personId = 'person-nobody'; },
    'inherited person key': (s) => { s.prisoners[0].personId = 'toString'; },
    'unknown family': (s) => { s.prisoners[0].captorFamilyId = 'family-nobody'; },
    'bad since': (s) => { s.prisoners[0].since = 'igår'; },
    'since in the future': (s) => { s.prisoners[0].since = '0100-01-01'; },
    'bad ransom': (s) => { s.prisoners[0].ransom = -1; },
    'unknown status': (s) => { s.prisoners[0].status = 'lost'; },
    'held with a closing date': (s) => { s.prisoners[0].closedAt = s.date; },
    'held with a reason': (s) => { s.prisoners[0].reason = 'x'; },
    'held but dead': (s) => { s.people[KELAN].diedAt = s.date; s.people[KELAN].deathReason = 'x'; },
    'the same person held twice': (s) => { s.sequence += 1; s.prisoners.push({ ...copy(s.prisoners[0]), id: `prisoner-${s.sequence}` }); },
  };
  for (const [label, mutate] of Object.entries(cases)) {
    const bad = copy(held);
    mutate(bad);
    assert.throws(() => normalizeCharacterSystem(bad), Error, label);
  }
  const closedCases = {
    'closed without a date': (s) => { s.prisoners[0].closedAt = null; },
    'closed before it began': (s) => { s.prisoners[0].closedAt = '-0400-01-01'; },
    'closed without a reason': (s) => { s.prisoners[0].reason = null; },
    'closed with an empty reason': (s) => { s.prisoners[0].reason = ' '; },
  };
  for (const [label, mutate] of Object.entries(closedCases)) {
    const bad = copy(closed);
    mutate(bad);
    assert.throws(() => normalizeCharacterSystem(bad), Error, label);
  }
  assert.deepEqual(normalizeCharacterSystem(copy(closed)).prisoners[0].status, 'released');
  assert.equal(normalizeCharacterSystem(copy(held)).prisoners[0].id, record.id);
  assert.deepEqual(heldPrisoners(held, ARELS).map((item) => item.id), [record.id]);
  assert.equal(prisonerOf(held, KELAN).id, record.id);
});

test('estimates, presentations and validation draw nothing for prisoners', () => {
  const state = base();
  seize(state, KELAN);
  const before = JSON.stringify(state);
  estimateCharacterAction(state, IMPRISON('person-1-3'));
  getCharacterPresentation(state);
  getCatalogActions(state);
  normalizeCharacterSystem(copy(state));
  assert.equal(JSON.stringify(state), before);
});

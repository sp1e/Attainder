import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameDays, addGameMonths } from '../gameDates.js';
import { ADULT_AGE } from './content.js';
import { estimateAction } from './actionOdds.js';
import { actionHooks, advanceCharacters, createCharacterSystem, getCharacterAge, estimateCharacterAction, executeCharacterCommand, getCatalogActions, getCharacterPresentation, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { actionRandom } from './extensions.js';
import { activeOccasion } from './occasions.js';

const REP = 'person-0-0';
const TARGET = 'person-1-0';
const FAMILY = 'family-arel';
const REFUSED = 'Familjen höll gästabud för mindre än ett år sedan.';
const SUCCESS_ROW = 'Gästabudet ger tillträde';
const SECRECY_ROW = 'Hemlighållning: många vittnen på gästabudet';
const UNDERMINE = { actionId: 'undermine', actorId: REP, targetIds: [TARGET] };
const SWAY = { actionId: 'sway', actorId: REP, targetIds: [TARGET] };

const copy = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
const run = (state, type, payload, id = `command-${++counter}`) => executeCharacterCommand(state, { id, expectedRevision: state.revision, type, payload });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const feast = (state) => ok(run(state, 'hold_feast', {}));
const advance = (state, date) => { const result = advanceCharacters(state, date); assert.equal(result.ok, true, result.error); return result.state; };
const streams = (state) => [state.rngState, state.actionRngState, state.plotRngState];
const draws = (seed, count) => { const dice = { actionRngState: seed }; return Array.from({ length: count }, () => actionRandom(dice) * 100); };
// A seed whose first draws satisfy one check each. Test setup only.
function seedWhere(...checks) {
  for (let k = 1; k < 50000; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    const values = draws(seed, checks.length);
    if (checks.every((check, index) => check(values[index]))) return seed;
  }
  throw new Error('No seed for these draws.');
}
const row = (rows, label) => rows.find((item) => item.label === label);
// Three quiet discovery checks (the chance never passes 40), then a clean success: both rolls fall under any odds above 5.
const QUIET_SEED = seedWhere((d) => d >= 40, (d) => d >= 40, (d) => d >= 40, (d) => d < 5, (d) => d < 5);

test('hold_feast charges 30 silver and one order and opens a one-month occasion with every living adult as a guest', () => {
  const state = base();
  const before = { silver: state.families[FAMILY].treasury, orders: state.actionPoints };
  const after = feast(state);
  assert.equal(after.families[FAMILY].treasury, before.silver - 30);
  assert.equal(after.actionPoints, before.orders - 1);
  assert.equal(after.occasions.length, 1);
  const [occasion] = after.occasions;
  assert.match(occasion.id, /^occasion-\d+$/);
  assert.deepEqual([occasion.kind, occasion.hostFamilyId, occasion.hostId, occasion.startedAt, occasion.endsAt], ['feast', FAMILY, REP, state.date, addGameMonths(state.date, 1)]);
  const adults = Object.values(after.people).filter((person) => !person.diedAt && getCharacterAge(person, after.date) >= ADULT_AGE).map((person) => person.id);
  assert.ok(adults.includes(TARGET) && adults.some((id) => id !== TARGET && id !== REP));
  assert.deepEqual([...occasion.guestIds].sort(), adults.sort());
  assert.deepEqual(Object.keys(occasion).sort(), ['endsAt', 'guestIds', 'hostFamilyId', 'hostId', 'id', 'kind', 'startedAt']);
  assert.equal(activeOccasion(after, FAMILY, after.date).id, occasion.id);
  assert.equal(activeOccasion(after, 'family-namar', after.date), null);
  assert.equal(activeOccasion(after, FAMILY, occasion.endsAt), null, 'the occasion ends on endsAt');
});

test('hold_feast raises the opinion of each guest family head of the host by 5', () => {
  const state = base();
  const heads = Object.values(state.families).map((family) => family.headId).filter((id) => id !== REP);
  const before = heads.map((id) => getPersonalOpinion(state, id, REP));
  const after = feast(state);
  heads.forEach((id, index) => assert.equal(getPersonalOpinion(after, id, REP), before[index] + 5, id));
  const hostSide = Object.values(after.relations).filter((relation) => after.people[relation.fromId].familyId === FAMILY);
  assert.ok(hostSide.every((relation) => relation.causes.every((item) => item.label !== 'Bjöds på gästabud')), 'the host family is not courted');
  const cause = after.relations[`${TARGET}:${REP}`].causes.find((item) => item.label === 'Bjöds på gästabud');
  assert.equal(cause.amount, 5);
});

test('a second feast is refused for twelve months and allowed after them', () => {
  const state = feast(base());
  const refused = run(state, 'hold_feast', {});
  assert.equal(refused.ok, false);
  assert.equal(refused.error, REFUSED);
  const eleven = copy(state);
  eleven.date = addGameMonths(state.date, 11);
  eleven.actionPoints = 4;
  assert.equal(run(eleven, 'hold_feast', {}).error, REFUSED);
  const twelve = copy(state);
  twelve.date = addGameMonths(state.date, 12);
  twelve.actionPoints = 4;
  assert.equal(ok(run(twelve, 'hold_feast', {})).occasions.length, 2);
});

test('the catalog lists hold_feast as a court command with its cost and the refusal once a feast was held', () => {
  const state = base();
  const entry = getCatalogActions(state).find((item) => item.catalogId === 'hold_feast');
  assert.deepEqual([entry.mode, entry.label, entry.category, entry.disabledReason], ['command', 'Håll gästabud', 'court', '']);
  assert.match(entry.cost, /30 silver/);
  assert.match(entry.cost, /1 handling/);
  const after = feast(state);
  assert.equal(getCatalogActions(after).find((item) => item.catalogId === 'hold_feast').disabledReason, REFUSED);
  const poor = copy(state);
  poor.families[FAMILY].treasury = 10;
  assert.equal(run(poor, 'hold_feast', {}).ok, false);
});

test('the presentation lists the controlled family\'s active feasts only', () => {
  const state = feast(base());
  const [occasion] = state.occasions;
  assert.deepEqual(getCharacterPresentation(state).occasions, [{ id: occasion.id, kind: 'feast', label: 'Gästabud', endsAt: occasion.endsAt, guestCount: occasion.guestIds.length }]);
  assert.deepEqual(getCharacterPresentation(base()).occasions, []);
  const later = copy(state);
  later.date = occasion.endsAt;
  assert.deepEqual(getCharacterPresentation(later).occasions, []);
});

test('an intrigue estimate during the feast gains 15 success and loses 5 secrecy, with rows and the occasion id', () => {
  const plain = estimateCharacterAction(base(), UNDERMINE);
  const state = feast(base());
  const held = estimateCharacterAction(state, UNDERMINE);
  assert.equal(held.ok, true, held.reason);
  assert.equal(held.occasionId, state.occasions[0].id);
  assert.equal(held.success.value, plain.success.value + 15);
  assert.equal(held.secrecy.value, plain.secrecy.value - 5);
  assert.equal(row(held.success.modifiers, SUCCESS_ROW).value, 15);
  assert.equal(row(held.secrecy.modifiers, SECRECY_ROW).value, -5);
  assert.equal(plain.occasionId, undefined);
  assert.ok(held.display.modifiers.some((item) => item.label === SUCCESS_ROW));
});

test('the feast row never appears for a diplomacy action, for a guest outside the list or outside the feast', () => {
  const state = feast(base());
  const sway = estimateCharacterAction(state, SWAY);
  assert.equal(sway.occasionId, undefined);
  assert.equal(row(sway.success.modifiers, SUCCESS_ROW), undefined);
  assert.equal(row(sway.secrecy.modifiers, SECRECY_ROW), undefined);
  const stranger = copy(state);
  stranger.occasions[0].guestIds = stranger.occasions[0].guestIds.filter((id) => id !== TARGET);
  assert.equal(estimateCharacterAction(stranger, UNDERMINE).occasionId, undefined);
  const over = copy(state);
  over.date = state.occasions[0].endsAt;
  assert.equal(estimateCharacterAction(over, UNDERMINE).occasionId, undefined);
});

test('estimates leave all three random streams and the state unchanged', () => {
  const state = feast(base());
  const snapshot = JSON.stringify(state);
  const rngs = streams(state);
  estimateCharacterAction(state, UNDERMINE);
  estimateCharacterAction(state, SWAY);
  getCharacterPresentation(state);
  getCatalogActions(state);
  assert.deepEqual(streams(state), rngs);
  assert.equal(JSON.stringify(state), snapshot);
});

test('a player cannot claim a feast through means.occasionId', () => {
  const state = feast(base());
  const id = state.occasions[0].id;
  const over = copy(state);
  over.date = state.occasions[0].endsAt;
  const claimed = estimateCharacterAction(over, { ...UNDERMINE, means: { occasionId: id } });
  assert.equal(claimed.ok, true, claimed.reason);
  assert.equal(claimed.occasionId, undefined);
  assert.equal(estimateCharacterAction(over, { ...UNDERMINE, means: { occasionId: 7 } }).ok, false);
  const started = ok(run(over, 'attempt_action', { ...UNDERMINE, means: { occasionId: id } }));
  assert.equal(Object.hasOwn(started.schemes.at(-1).means, 'occasionId'), false);
});

test('the feast modifier follows the scheme\'s start', () => {
  const during = feast(base());
  const endsAt = during.occasions[0].endsAt;
  const duringStart = ok(run({ ...copy(during), actionRngState: QUIET_SEED }, 'attempt_action', UNDERMINE));
  const scheme = duringStart.schemes.at(-1);
  assert.equal(scheme.means.occasionId, during.occasions[0].id);
  assert.ok(scheme.dueAt > endsAt, 'the scheme comes due after the feast ended');
  const resolvedA = advance(duringStart, scheme.dueAt);
  const entryA = resolvedA.actionLog.at(-1);
  assert.equal(entryA.tier, 'clean_success');
  const plainA = estimateCharacterAction(resolvedA, UNDERMINE).success.value;
  assert.equal(entryA.estimate.success, plainA + 15, 'the due-date estimate keeps the +15');

  const after = advance(during, addGameDays(endsAt, 1));
  assert.equal(activeOccasion(after, FAMILY, after.date), null);
  const afterStart = ok(run({ ...copy(after), actionRngState: QUIET_SEED }, 'attempt_action', UNDERMINE));
  const late = afterStart.schemes.at(-1);
  assert.equal(Object.hasOwn(late.means, 'occasionId'), false);
  const resolvedB = advance(afterStart, late.dueAt);
  const entryB = resolvedB.actionLog.at(-1);
  assert.equal(entryB.tier, 'clean_success');
  assert.equal(entryB.estimate.success, estimateCharacterAction(resolvedB, UNDERMINE).success.value, 'no feast row at the due date');
});

test('a state with a feast and a scheme that carries it survives a save round trip', () => {
  const started = ok(run({ ...copy(feast(base())), actionRngState: QUIET_SEED }, 'attempt_action', UNDERMINE));
  const again = normalizeCharacterSystem(copy(started));
  assert.deepEqual(again.occasions, started.occasions);
  assert.equal(again.schemes.at(-1).means.occasionId, started.occasions[0].id);
});

test('validateOccasions refuses corrupt occasions on load', () => {
  const good = feast(base());
  const broken = (change) => { const state = copy(good); change(state.occasions[0], state); return state; };
  const cases = {
    'a duplicate id': (o, s) => s.occasions.push(copy(o)),
    'an id beyond the sequence': (o) => { o.id = 'occasion-99999'; },
    'an unknown kind': (o) => { o.kind = 'wedding'; },
    'an unknown host family': (o) => { o.hostFamilyId = 'family-nowhere'; },
    'a host from another family': (o) => { o.hostId = 'person-1-0'; },
    'a bad date': (o) => { o.startedAt = 'igår'; },
    'an end that is not a month later': (o) => { o.endsAt = addGameMonths(o.startedAt, 2); },
    'a start in the future': (o, s) => { o.startedAt = addGameMonths(s.date, 1); o.endsAt = addGameMonths(s.date, 2); },
    'an unknown guest': (o) => { o.guestIds.push('person-9-9'); },
    'a repeated guest': (o) => { o.guestIds.push(o.guestIds[0]); },
    'guests that are no list': (o) => { o.guestIds = 'alla'; },
  };
  for (const [name, change] of Object.entries(cases)) assert.throws(() => normalizeCharacterSystem(broken(change)), /tillfälle/i, name);
  const notList = copy(good);
  notList.occasions = {};
  // validateCharacterExtensions already refuses a ledger that is no list, before validateOccasions runs.
  assert.throws(() => normalizeCharacterSystem(notList), /samlingar/i);
});

test('validateSchemes accepts an occasion id in the means and refuses a malformed one', () => {
  const started = ok(run({ ...copy(feast(base())), actionRngState: QUIET_SEED }, 'attempt_action', UNDERMINE));
  const bad = copy(started);
  bad.schemes.at(-1).means.occasionId = 'not-an-occasion';
  assert.throws(() => normalizeCharacterSystem(bad), /En plans medel/);
  const numeric = copy(started);
  numeric.schemes.at(-1).means.occasionId = 4;
  assert.throws(() => normalizeCharacterSystem(numeric), /En plans medel/);
});

test('a scheme started before any feast gets no feast row when a later feast covers its due date', () => {
  const start = ok(run({ ...copy(base()), actionRngState: QUIET_SEED }, 'attempt_action', UNDERMINE));
  const scheme = start.schemes.at(-1);
  assert.equal(Object.hasOwn(scheme.means, 'occasionId'), false);
  // A feast that begins half a month before the due date and so runs over it.
  const hosting = feast(advance(start, addGameDays(addGameMonths(start.date, 2), 15)));
  assert.ok(activeOccasion(hosting, FAMILY, scheme.dueAt), 'the feast covers the due date');
  const resolved = advance(hosting, scheme.dueAt);
  const entry = resolved.actionLog.at(-1);
  assert.equal(entry.tier, 'clean_success');
  const live = estimateCharacterAction(resolved, UNDERMINE);
  assert.ok(live.occasionId, 'a fresh attempt on the due date does get the feast row');
  assert.equal(entry.estimate.success, live.success.value - 15, "the scheme's own estimate has none");
});

test('an actor whose family does not host the feast gains no feast row in an NPC context', () => {
  const plain = base();
  const state = feast(base());
  const intent = { actionId: 'undermine', actorId: 'person-1-1', targetIds: [REP] };
  const withFeast = estimateAction(state, intent, actionHooks(state).npcEstimateContext('person-1-1'));
  const without = estimateAction(plain, intent, actionHooks(plain).npcEstimateContext('person-1-1'));
  assert.equal(withFeast.ok, true, withFeast.reason);
  assert.equal(withFeast.occasionId, undefined);
  assert.equal(withFeast.success.value, without.success.value);
  assert.equal(withFeast.secrecy.value, without.secrecy.value);
});

test('a stored occasion id counts only for an actor of the family that hosted it', () => {
  const state = feast(base());
  const id = state.occasions[0].id;
  const later = copy(state);
  later.date = state.occasions[0].endsAt;
  const due = (actorId, context) => estimateAction(later, { actionId: 'undermine', actorId, targetIds: [actorId === REP ? TARGET : REP], means: { occasionId: id } }, { ...context, scheduled: true });
  const host = due(REP, actionHooks(later).estimateContext());
  assert.equal(host.occasionId, id, "the host family's actor keeps the feast");
  const stranger = due('person-1-1', actionHooks(later).npcEstimateContext('person-1-1'));
  assert.equal(stranger.ok, true, stranger.reason);
  assert.equal(stranger.occasionId, undefined);
});

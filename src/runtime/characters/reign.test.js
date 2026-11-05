import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, applyRealmDissolution, createCharacterSystem, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { DEED_KEYS, MAX_ACTIVE_GOALS, REIGN_GOALS, addPrestige, defaultReign, goalRefusal, goalStep, grantLegitimacy, legitimacySources, presentReign, prestigeStep, recordDeed, reignMonths, setReignGoal, validateReign } from './reign.js';
import { serviceOf } from './council.js';
import { dreadOf } from './dread.js';

const RULER = 'person-0-0';
const HEIR = 'person-0-2';
const CHILD = 'person-0-4';
const SPYMASTER = 'person-0-1';
const NAMARS = 'family-namar';
const ARELS = 'family-arel';
const NO_DEEDS = Object.fromEntries(DEED_KEYS.map((key) => [key, 0]));

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => createCharacterSystem({ seed: 321, ...options });
let counter = 0;
const run = (state, type, payload = {}, origin) => executeCharacterCommand(state, { id: `command-${++counter}`, expectedRevision: state.revision, type, payload, origin });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const year = (state) => ok(advanceCharacters(state, addGameMonths(state.date, 12), { id: `year-${++counter}` }));
const total = (rows) => rows.reduce((sum, row) => sum + row.value, 0);
const dissolve = (state) => ok(applyRealmDissolution(state, { id: `dissolution-${++counter}`, date: state.date, reason: 'Ett prov.', hostCandidates: [] }));

test('DEED_KEYS lists every deed the reign counts', () => {
  assert.deepEqual([...DEED_KEYS], ['cruel', 'betrayal', 'generous', 'risky', 'surrender', 'executions', 'breakdowns', 'goalsMet']);
  assert.ok(Object.isFrozen(DEED_KEYS));
});

test('defaultReign describes the sitting ruler as of today', () => {
  const state = base();
  state.date = '-0290-06-15';
  state.realm.legitimacy = 72.5;
  assert.deepEqual(defaultReign(state), { rulerId: RULER, startedAt: '-0290-06-15', lawful: true, deeds: NO_DEEDS, goals: [], sources: { accession: 72.5, goals: 0, prestige: 0 }, lostOrders: 0 });
  state.offices.ruler.holderId = null;
  assert.equal(defaultReign(state).rulerId, null);
});

test('forged reign records are rejected', () => {
  const REIGN = /^Regeringens uppgifter i sparfilen är ogiltiga\.$/, PRESTIGE = /^Rikets ryktbarhet är ogiltig\.$/;
  const forgeries = {
    'null record': [(s) => { s.reign = null; }, REIGN],
    'list as record': [(s) => { s.reign = []; }, REIGN],
    'unknown ruler': [(s) => { s.reign.rulerId = 'person-9-9'; }, REIGN],
    'a ruler who does not hold the throne': [(s) => { s.reign.rulerId = HEIR; }, REIGN],
    'no ruler while the throne is held': [(s) => { s.reign.rulerId = null; }, REIGN],
    'a ruler while the throne stands empty': [(s) => { s.offices.ruler.holderId = null; }, REIGN],
    'prototype key as ruler': [(s) => { s.reign.rulerId = 'constructor'; }, REIGN],
    'number as ruler': [(s) => { s.reign.rulerId = 7; }, REIGN],
    'missing ruler': [(s) => { delete s.reign.rulerId; }, REIGN],
    'date that is not canonical': [(s) => { s.reign.startedAt = '-300-1-1'; }, REIGN],
    'number as date': [(s) => { s.reign.startedAt = 300; }, REIGN],
    'reign starting after today': [(s) => { s.reign.startedAt = addGameMonths(s.date, 1); }, REIGN],
    'text as lawful': [(s) => { s.reign.lawful = 'ja'; }, REIGN],
    'list as deeds': [(s) => { s.reign.deeds = []; }, REIGN],
    'null deeds': [(s) => { s.reign.deeds = null; }, REIGN],
    'a deed missing': [(s) => { delete s.reign.deeds.cruel; }, REIGN],
    'an unknown deed': [(s) => { s.reign.deeds.heroic = 1; }, REIGN],
    'a negative deed': [(s) => { s.reign.deeds.generous = -1; }, REIGN],
    'a fractional deed': [(s) => { s.reign.deeds.risky = 1.5; }, REIGN],
    'text as a deed': [(s) => { s.reign.deeds.betrayal = '2'; }, REIGN],
    'object as goals': [(s) => { s.reign.goals = {}; }, REIGN],
    'a goal that is no record': [(s) => { s.reign.goals = [null]; }, REIGN],
    'null sources': [(s) => { s.reign.sources = null; }, REIGN],
    'text as a source': [(s) => { s.reign.sources.accession = '65'; }, REIGN],
    'null as a source': [(s) => { s.reign.sources.goals = null; }, REIGN],
    'a source missing': [(s) => { delete s.reign.sources.prestige; }, REIGN],
    'an unknown source': [(s) => { s.reign.sources.bribes = 5; }, REIGN],
    'negative lost orders': [(s) => { s.reign.lostOrders = -1; }, REIGN],
    'fractional lost orders': [(s) => { s.reign.lostOrders = 0.5; }, REIGN],
    'text as lost orders': [(s) => { s.reign.lostOrders = '2'; }, REIGN],
    'prestige 101': [(s) => { s.realm.prestige = 101; }, PRESTIGE],
    'negative prestige': [(s) => { s.realm.prestige = -1; }, PRESTIGE],
    'text as prestige': [(s) => { s.realm.prestige = '10'; }, PRESTIGE],
    'missing prestige': [(s) => { delete s.realm.prestige; }, PRESTIGE],
  };
  for (const [name, [forge, message]] of Object.entries(forgeries)) {
    const raw = plain(base()); forge(raw);
    assert.throws(() => normalizeCharacterSystem(raw), { name: 'Error', message }, name);
  }
  // JSON has no NaN or Infinity, so these reach only a direct call.
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const state = base();
    state.reign.sources.goals = value;
    assert.throws(() => validateReign(state), { name: 'Error', message: REIGN });
    const prestige = base();
    prestige.realm.prestige = value;
    assert.throws(() => validateReign(prestige), { name: 'Error', message: PRESTIGE });
  }
});

test('a reign without a ruler and prestige at either end of its range are accepted', () => {
  const none = plain(base());
  none.reign.rulerId = null;
  none.offices.ruler.holderId = null;
  validateReign(none);
  for (const prestige of [0, 100, 37.5]) {
    const raw = plain(base());
    raw.realm.prestige = prestige;
    assert.equal(normalizeCharacterSystem(raw).realm.prestige, prestige);
  }
});

test('legitimacy sources add up to the rounded legitimacy', () => {
  const state = base();
  assert.deepEqual(legitimacySources(state), [{ label: 'Tronföljd', value: 65 }]);
  grantLegitimacy(state, 'goals', 6);
  grantLegitimacy(state, 'prestige', 2);
  assert.deepEqual(legitimacySources(state), [{ label: 'Tronföljd', value: 65 }, { label: 'Uppnådda mål', value: 6 }, { label: 'Ryktbarhet', value: 2 }]);
  assert.equal(total(legitimacySources(state)), 73);
  // A realm_effect moves legitimacy past the ledger, so the difference lands in the last row.
  const after = ok(run(state, 'realm_effect', { legitimacy: -5, reason: 'Ett prov.' }, 'gate'));
  assert.equal(after.realm.legitimacy, 68);
  assert.deepEqual(legitimacySources(after), [{ label: 'Tronföljd', value: 65 }, { label: 'Uppnådda mål', value: 6 }, { label: 'Ryktbarhet', value: 2 }, { label: 'Styre och händelser', value: -5 }]);
  // A year adds half a point, so the sum follows the rounded value and every row stays an integer.
  const later = year(after);
  assert.equal(later.realm.legitimacy, 68.5);
  assert.equal(total(legitimacySources(later)), 69);
  assert.deepEqual(legitimacySources(later).at(-1), { label: 'Styre och händelser', value: -4 });
  // Fractional ledger values round on their own and the last row settles the difference.
  for (const [legitimacy, accession, goals, prestige] of [[55.5, 55, 0.5, 0], [64.5, 65.5, 0.4, -0.4], [0, 0, 0, 0], [100, 55.5, 30.5, 14.5], [12.5, 12.5, 0, 0]]) {
    const custom = base();
    custom.realm.legitimacy = legitimacy;
    custom.reign.sources = { accession, goals, prestige };
    const rows = legitimacySources(custom);
    assert.equal(total(rows), Math.round(legitimacy), String(legitimacy));
    for (const row of rows) { assert.ok(Number.isInteger(row.value), row.label); assert.notEqual(row.value, 0, row.label); }
  }
});

test('grantLegitimacy books only the change it applied, and only for goals and prestige', () => {
  const state = base();
  state.realm.legitimacy = 98;
  assert.equal(grantLegitimacy(state, 'goals', 6), 2);
  assert.equal(state.realm.legitimacy, 100);
  assert.equal(state.reign.sources.goals, 2);
  assert.equal(grantLegitimacy(state, 'prestige', 3), 0);
  assert.equal(state.reign.sources.prestige, 0);
  state.realm.legitimacy = 1;
  assert.equal(grantLegitimacy(state, 'prestige', -4), -1);
  assert.equal(state.realm.legitimacy, 0);
  assert.equal(state.reign.sources.prestige, -1);
  const before = plain(state);
  for (const source of ['accession', 'bribes', '__proto__', undefined]) assert.equal(grantLegitimacy(state, source, 5), 0, String(source));
  assert.deepEqual(plain(state), before);
});

test('addPrestige stays within 0 to 100', () => {
  const state = base();
  addPrestige(state, 15);
  assert.equal(state.realm.prestige, 25);
  addPrestige(state, 200);
  assert.equal(state.realm.prestige, 100);
  addPrestige(state, -500);
  assert.equal(state.realm.prestige, 0);
});

test('recordDeed counts a known deed and ignores anything else', () => {
  const state = base();
  recordDeed(state, 'executions'); recordDeed(state, 'executions'); recordDeed(state, 'goalsMet');
  assert.deepEqual(state.reign.deeds, { ...NO_DEEDS, executions: 2, goalsMet: 1 });
  const before = plain(state.reign.deeds);
  for (const key of ['duty', 'heroic', '__proto__', 'constructor', undefined, 7]) recordDeed(state, key);
  assert.deepEqual(state.reign.deeds, before);
  assert.deepEqual(Object.keys(state.reign.deeds), DEED_KEYS);
});

test('reignMonths counts whole months on the game calendar', () => {
  const at = (startedAt, date) => reignMonths({ date, reign: { startedAt } });
  assert.equal(at('-0300-01-01', '-0300-01-01'), 0);
  assert.equal(at('-0300-01-15', '-0300-02-14'), 0);
  assert.equal(at('-0300-01-15', '-0300-02-15'), 1);
  assert.equal(at('-0300-01-01', '-0298-01-01'), 24);
  assert.equal(at('-0300-03-20', '-0298-03-19'), 23);
  // The calendar has no year zero.
  assert.equal(at('-0001-12-01', '0001-01-01'), 1);
  assert.equal(at('-0002-01-01', '0002-01-01'), 36);
  // addGameMonths lands a month's end on the shorter month, and the count agrees with it.
  assert.equal(addGameMonths('-0300-01-31', 1), '-0300-02-28');
  assert.equal(at('-0300-01-31', '-0300-02-28'), 1);
  assert.equal(at('-0300-01-31', '-0300-02-27'), 0);
});

test('crown opens a new reign with no goals', () => {
  const state = base(), hooks = actionHooks(state);
  recordDeed(state, 'cruel'); grantLegitimacy(state, 'goals', 6); state.reign.lostOrders = 2;
  const active = { id: 'goal-1', type: 'fill_treasury', status: 'active', closedAt: null };
  const met = { id: 'goal-2', type: 'strong_army', status: 'met', closedAt: '-0301-01-01' };
  state.reign.goals.push(active, met);
  hooks.crown(state.people[HEIR], [], 'Ett prov', 40, false);
  assert.deepEqual(met, { id: 'goal-2', type: 'strong_army', status: 'met', closedAt: '-0301-01-01' });
  assert.deepEqual(state.reign, { rulerId: HEIR, startedAt: state.date, lawful: false, deeds: NO_DEEDS, goals: [], sources: { accession: 40, goals: 0, prestige: 0 }, lostOrders: 0 });
  assert.equal(state.realm.legitimacy, 40);
  assert.deepEqual(legitimacySources(state), [{ label: 'Tronföljd', value: 40 }]);
  validateReign(state);
});

test('crown keeps its defaults through the hook, and a crown without a person leaves a reign without a ruler', () => {
  const state = base(), hooks = actionHooks(state);
  hooks.crown(state.people[HEIR], [], 'Ett prov');
  assert.equal(state.reign.lawful, true);
  assert.equal(state.reign.sources.accession, 55);
  hooks.crown(null, [], 'Ett prov');
  assert.equal(state.realm.alive, false);
  assert.equal(state.reign.rulerId, null);
  validateReign(state);
});

test('a ruler who dies is followed by a new reign on the date of the death', () => {
  const state = plain(base());
  state.people[RULER].health = 0;
  const after = year(state);
  assert.ok(after.people[RULER].diedAt);
  const successor = after.offices.ruler.holderId;
  assert.notEqual(successor, RULER);
  assert.equal(after.reign.rulerId, successor);
  assert.equal(after.reign.startedAt, after.people[RULER].diedAt);
  assert.equal(after.reign.lawful, true);
  assert.equal(after.reign.sources.accession, 55);
  assert.equal(reignMonths(after), 0);
  assert.deepEqual(plain(normalizeCharacterSystem(plain(after))).reign, after.reign);
});

test('dissolution closes the reign without moving legitimacy', () => {
  for (const mode of ['realm', 'family']) {
    const state = base({ mode });
    recordDeed(state, 'cruel'); grantLegitimacy(state, 'goals', 6); state.reign.lawful = false;
    state.reign.goals.push({ id: 'goal-1', type: 'fill_treasury', status: 'active', closedAt: null });
    const after = dissolve(state);
    assert.equal(after.offices.ruler.holderId, null, mode);
    assert.deepEqual(after.reign, { rulerId: null, startedAt: state.date, lawful: false, deeds: NO_DEEDS, goals: [], sources: { accession: 71, goals: 0, prestige: 0 }, lostOrders: 0 }, mode);
    assert.equal(after.realm.legitimacy, 71, mode);
    assert.equal(total(legitimacySources(after)), 71, mode);
    assert.deepEqual(normalizeCharacterSystem(plain(after)), after, mode);
  }
});

test('the former ruler of a dissolved realm records no deed as head of the family', () => {
  const after = dissolve(base({ mode: 'family' }));
  assert.equal(after.families['family-arel'].headId, RULER);
  actionHooks(after).charge(0, { orders: 0, tag: 'generous' });
  assert.deepEqual(after.reign.deeds, NO_DEEDS);
  const view = getCharacterPresentation(after);
  assert.equal(view.ruler, null);
  assert.equal(view.court.reign.rulerId, null);
  // The family plays on, and the closed reign stays closed through a year.
  const later = year(after);
  assert.equal(later.reign.rulerId, null);
  assert.deepEqual(later.reign.deeds, NO_DEEDS);
  assert.deepEqual(normalizeCharacterSystem(plain(later)), later);
});

test('charge records a deed only for the reigning ruler', () => {
  const state = base();
  const feasted = ok(run(state, 'hold_feast'));
  assert.deepEqual(feasted.reign.deeds, { ...NO_DEEDS, generous: 1 });
  // `rest` pays with the tag duty, which is no deed.
  assert.deepEqual(ok(run(feasted, 'rest')).reign.deeds, feasted.reign.deeds);
  // Another family's head pays out of the same engine path, and the crown's record stays as it was.
  const family = base({ mode: 'family', familyId: NAMARS });
  assert.notEqual(family.families[NAMARS].headId, family.reign.rulerId);
  const outsider = ok(run(family, 'hold_feast'));
  assert.equal(outsider.families[NAMARS].treasury, family.families[NAMARS].treasury - 30);
  assert.deepEqual(outsider.reign.deeds, NO_DEEDS);
  // Every tag a paid action carries, through the hook that actions use.
  const tagged = base(), hooks = actionHooks(tagged);
  for (const tag of ['cruel', 'betrayal', 'generous', 'risky', 'surrender', 'duty']) hooks.charge(0, { orders: 0, tag });
  assert.deepEqual(tagged.reign.deeds, { ...NO_DEEDS, cruel: 1, betrayal: 1, generous: 1, risky: 1, surrender: 1 });
  // A charge that fails records nothing.
  const broke = base(); broke.actionPoints = 0;
  assert.throws(() => actionHooks(broke).charge(0, { orders: 1, tag: 'cruel' }));
  assert.deepEqual(broke.reign.deeds, NO_DEEDS);
});

// Goals. The arrangements below sit one step either side of each row's condition.
const treasury = (value) => (state) => { state.realm.treasury = value; };
const army = (value) => (state) => { state.realm.armyStrength = value; };
const grievance = (familyId, value) => (state) => { state.families[familyId].grievance = value; };
const everyHouse = (value) => (state) => { for (const family of Object.values(state.families)) family.grievance = value; };
const combine = (...steps) => (state) => { for (const arrange of steps) arrange(state); };
const project = (state, fields) => state.projects.push({ id: `project-test-${++counter}`, kind: 'aqueduct', title: 'Ett prov', ownerId: RULER, createdAt: state.date, dueAt: state.date, personal: false, status: 'completed', ...fields });
const builder = (state) => { state.people[RULER].archetype = 'builder'; };
const fear = (value) => (state) => { for (const person of Object.values(state.people)) if (person.familyId !== ARELS) person.fear = value; };
// Iset fills the spymaster's seat. The three councillors lose their traits, so loyalty alone moves their service.
const council = (service, last = service) => (state) => {
  state.offices.spymaster.holderId = SPYMASTER;
  const holders = [state.offices.chancellor, state.offices.general, state.offices.spymaster].map((office) => state.people[office.holderId]);
  const hooks = actionHooks(state);
  for (const person of holders) { person.traits = []; person.loyalty = 50; }
  const seats = ['chancellor', 'general', 'spymaster'];
  holders.forEach((person, index) => { person.loyalty += (index === 2 ? last : service) - serviceOf(state, seats[index], hooks); });
};

// [goal, what the check turns on, arranged before setting, reached, not reached, legitimacy it pays, months it runs]
const GOAL_CASES = [
  ['fill_treasury', 'the floor of 300', treasury(100), treasury(300), treasury(299), 6, 60],
  ['fill_treasury', '80 above the baseline', treasury(260), treasury(340), treasury(339), 6, 60],
  ['strong_army', 'the floor of 70', army(40), army(70), army(69), 6, 60],
  ['strong_army', '15 above the baseline', army(65), army(80), army(79), 6, 60],
  ['reconcile_houses', 'every other house at 55', null, everyHouse(40), combine(everyHouse(40), grievance(NAMARS, -40)), 10, 60],
  ['reconcile_houses', 'a house in exile does not count', null, combine(everyHouse(40), grievance(NAMARS, -40), (state) => { state.families[NAMARS].exiled = true; }), combine(everyHouse(40), grievance('family-safra', -40), (state) => { state.families[NAMARS].exiled = true; }), 10, 60],
  ['reconcile_houses', "the ruler's own house does not count", null, combine(everyHouse(40), grievance(ARELS, -40)), everyHouse(-40), 10, 60],
  ['lasting_work', 'a finished aqueduct', builder, (state) => project(state, {}), (state) => project(state, { status: 'active' }), 8, 72],
  ['lasting_work', 'a finished academy', builder, (state) => project(state, { kind: 'academy' }), (state) => project(state, { kind: 'estate' }), 8, 72],
  ['lasting_work', 'finished before the goal was set', builder, (state) => project(state, {}), (state) => project(state, { dueAt: addGameMonths(state.date, -1) }), 8, 72],
  ['full_council', 'each seat serving at 50', null, council(50), council(50, 49), 5, 36],
  ['full_council', 'a vacant seat', null, council(50), combine(council(50), (state) => { state.offices.spymaster.holderId = null; }), 5, 36],
  ['cow_nobles', 'dread of 30', null, fear(30), fear(29), 6, 60],
];

const setGoal = (state, goalType) => ok(run(state, 'set_reign_goal', { goalType }));
const check = (state) => { const events = []; goalStep(state, events, actionHooks(state)); return events; };

for (const [type, reason, before, reached, unreached, legitimacy, months] of GOAL_CASES) {
  test(`${type} is met: ${reason}`, () => {
    const state = base();
    before?.(state);
    const after = setGoal(state, type), { legitimacy: start } = after.realm;
    reached(after);
    const [event] = check(after);
    const [goal] = after.reign.goals;
    assert.equal(goal.status, 'met');
    assert.equal(goal.closedAt, after.date);
    assert.equal(goal.dueAt, addGameMonths(goal.setAt, months));
    assert.equal(after.realm.legitimacy, start + legitimacy);
    assert.match(event.title, /^Regeringsmålet uppnått: /);
  });

  test(`${type} is not met: ${reason}`, () => {
    const state = base();
    before?.(state);
    const after = setGoal(state, type), { legitimacy: start } = after.realm;
    unreached(after);
    assert.deepEqual(check(after), []);
    assert.equal(after.reign.goals[0].status, 'active');
    assert.equal(after.reign.goals[0].closedAt, null);
    assert.equal(after.realm.legitimacy, start);
  });
}

test('the council and dread arrangements reach the numbers the goals read', () => {
  const state = base(), hooks = actionHooks(state);
  council(50, 49)(state);
  assert.deepEqual(['chancellor', 'general', 'spymaster'].map((id) => serviceOf(state, id, hooks)), [50, 50, 49]);
  fear(30)(state);
  assert.equal(dreadOf(state, hooks), 30);
});

test('a met goal adds its legitimacy once and counts under Uppnådda mål', () => {
  const state = setGoal(base(), 'fill_treasury');
  state.realm.treasury = 400;
  state.people[RULER].stress = 25;
  const events = check(state);
  assert.equal(state.realm.legitimacy, 71);
  assert.deepEqual(legitimacySources(state), [{ label: 'Tronföljd', value: 65 }, { label: 'Uppnådda mål', value: 6 }]);
  assert.equal(state.reign.sources.goals, 6);
  assert.equal(state.realm.prestige, 20);
  assert.equal(state.reign.deeds.goalsMet, 1);
  assert.equal(state.people[RULER].stress, 15);
  assert.deepEqual(events.map((event) => [event.title, event.public]), [['Regeringsmålet uppnått: Fyll statskassan', true]]);
  assert.deepEqual(state.memories.filter((item) => item.title === 'Regeringsmålet uppnått: Fyll statskassan').map((item) => item.participants), [[RULER]]);
  const before = plain(state);
  assert.deepEqual(check(state), []);
  assert.deepEqual(plain(state), before, 'a second check pays nothing');
  // A legitimacy near its ceiling books only what it applied.
  const full = setGoal(base(), 'fill_treasury');
  full.realm.treasury = 400; full.realm.legitimacy = 97;
  check(full);
  assert.equal(full.realm.legitimacy, 100);
  assert.equal(full.reign.sources.goals, 3);
});

test('a missed deadline costs legitimacy and stress', () => {
  const state = setGoal(base(), 'strong_army');
  state.people[RULER].stress = 20;
  const [{ dueAt }] = state.reign.goals;
  state.date = dueAt;
  assert.deepEqual(check(state), [], 'the deadline day itself still counts');
  assert.equal(state.reign.goals[0].status, 'active');
  state.date = addGameMonths(dueAt, 1);
  const events = check(state);
  assert.equal(state.reign.goals[0].status, 'failed');
  assert.equal(state.reign.goals[0].closedAt, state.date);
  assert.equal(state.realm.legitimacy, 62);
  assert.equal(state.people[RULER].stress, 30);
  assert.deepEqual(events.map((event) => [event.title, event.public]), [['Regeringsmålet förfelat: Stärk hären', true]]);
  // The loss sits outside the goal ledger, and a miss pays no prestige and counts no deed.
  assert.deepEqual(legitimacySources(state), [{ label: 'Tronföljd', value: 65 }, { label: 'Styre och händelser', value: -3 }]);
  assert.equal(state.realm.prestige, 10);
  assert.equal(state.reign.deeds.goalsMet, 0);
  const before = plain(state);
  assert.deepEqual(check(state), []);
  assert.deepEqual(plain(state), before, 'a miss costs once');
  // Legitimacy stops at 0.
  const broke = setGoal(base(), 'strong_army');
  broke.realm.legitimacy = 2;
  broke.date = addGameMonths(broke.reign.goals[0].dueAt, 1);
  check(broke);
  assert.equal(broke.realm.legitimacy, 0);
});

test('a goal that holds at the first check past its deadline is met, because the check runs once a year', () => {
  const state = setGoal(base(), 'strong_army');
  state.realm.armyStrength = 90;
  state.date = addGameMonths(state.reign.goals[0].dueAt, 1);
  check(state);
  assert.equal(state.reign.goals[0].status, 'met');
  assert.equal(state.realm.legitimacy, 71);
});

test('goals close in the order they were set, and stress stays within its bounds', () => {
  const state = setGoal(setGoal(base(), 'strong_army'), 'fill_treasury');
  state.realm.armyStrength = 90; state.realm.treasury = 400; state.people[RULER].stress = 5;
  assert.deepEqual(check(state).map((event) => event.title), ['Regeringsmålet uppnått: Stärk hären', 'Regeringsmålet uppnått: Fyll statskassan']);
  assert.equal(state.people[RULER].stress, 0);
  const worn = setGoal(base(), 'strong_army');
  worn.people[RULER].stress = 195;
  worn.date = addGameMonths(worn.reign.goals[0].dueAt, 1);
  check(worn);
  assert.equal(worn.people[RULER].stress, 200);
});

test('set_reign_goal takes one order and no silver and writes the record', () => {
  const state = base();
  state.people[RULER].traits = [];
  const after = setGoal(state, 'strong_army');
  assert.equal(after.actionPoints, state.actionPoints - 1);
  assert.equal(after.realm.treasury, state.realm.treasury);
  assert.equal(after.people[RULER].stress, 3, 'the tag is duty');
  assert.deepEqual(after.reign.deeds, NO_DEEDS);
  assert.deepEqual(after.reign.goals, [{ id: `goal-${after.sequence}`, type: 'strong_army', baseline: 55, setAt: state.date, dueAt: '-0295-01-01', status: 'active', closedAt: null }]);
  assert.equal(setGoal(base(), 'fill_treasury').reign.goals[0].baseline, 240);
  assert.equal(setGoal(base(), 'cow_nobles').reign.goals[0].baseline, 0);
  // The id is the engine's, and the loaded record keeps it.
  assert.deepEqual(normalizeCharacterSystem(plain(after)).reign.goals, after.reign.goals);
});

test('set_reign_goal needs an order and the mandate', () => {
  const tired = base();
  tired.actionPoints = 0;
  const spent = run(tired, 'set_reign_goal', { goalType: 'strong_army' });
  assert.equal(spent.ok, false);
  assert.match(spent.error, /^Årets handlingsutrymme är slut/);
  const outsider = base({ mode: 'family', familyId: NAMARS });
  assert.equal(run(outsider, 'set_reign_goal', { goalType: 'strong_army' }).error, 'Beslutet kräver härskarens eller regentens mandat.');
  assert.equal(getAvailableCharacterActions(outsider).some((item) => item.type === 'set_reign_goal'), false);
});

test('goal refusals', () => {
  const refusal = (state, goalType) => goalRefusal(state, goalType, actionHooks(state));
  const fresh = base();
  assert.equal(refusal(fresh, 'strong_army'), '');
  for (const forged of ['Bli världshärskare', '', undefined, null, 7, '__proto__', 'constructor', ['strong_army'], { id: 'strong_army' }]) {
    assert.equal(refusal(fresh, forged), 'Målet finns inte.', String(forged));
    assert.equal(run(fresh, 'set_reign_goal', { goalType: forged }).error, 'Målet finns inte.', String(forged));
    assert.throws(() => setReignGoal(fresh, forged, actionHooks(fresh)), { message: 'Målet finns inte.' });
  }
  assert.equal(run(fresh, 'set_reign_goal').error, 'Målet finns inte.');
  // Two goals fill the slots, and the first one back frees a slot.
  assert.equal(MAX_ACTIVE_GOALS, 2);
  const two = setGoal(setGoal(fresh, 'strong_army'), 'fill_treasury');
  assert.equal(run(two, 'set_reign_goal', { goalType: 'cow_nobles' }).error, 'Två mål är redan utlysta.');
  assert.equal(refusal(two, 'strong_army'), 'Två mål är redan utlysta.', 'the full list speaks first');
  two.realm.armyStrength = 90;
  check(two);
  assert.equal(refusal(two, 'cow_nobles'), '');
  // A goal is tried once a reign, whether it stands, was met or was missed.
  const REPEAT = 'Målet har redan prövats under denna regering.';
  assert.equal(refusal(two, 'strong_army'), REPEAT, 'met');
  assert.equal(run(two, 'set_reign_goal', { goalType: 'fill_treasury' }).error, REPEAT, 'active');
  const missed = setGoal(base(), 'strong_army');
  missed.date = addGameMonths(missed.reign.goals[0].dueAt, 1);
  check(missed);
  assert.equal(refusal(missed, 'strong_army'), REPEAT, 'failed');
});

test('lasting_work needs a ruler who can build, or a work already under way', () => {
  const NO_BUILDER = 'Härskaren kan inte bygga ett sådant verk.';
  const refusal = (state) => goalRefusal(state, 'lasting_work', actionHooks(state));
  const state = base();
  assert.equal(state.people[RULER].archetype, 'commander');
  assert.equal(refusal(state), NO_BUILDER);
  assert.equal(run(state, 'set_reign_goal', { goalType: 'lasting_work' }).error, NO_BUILDER);
  for (const archetype of ['scholar', 'builder']) {
    const able = base();
    able.people[RULER].archetype = archetype;
    assert.equal(refusal(able), '', archetype);
  }
  for (const [kind, status, answer] of [['aqueduct', 'active', ''], ['academy', 'active', ''], ['aqueduct', 'completed', NO_BUILDER], ['estate', 'active', NO_BUILDER]]) {
    const inherited = base();
    project(inherited, { kind, status });
    assert.equal(refusal(inherited), answer, `${kind} ${status}`);
  }
});

test('a successor inherits no goal and no penalty', () => {
  const state = setGoal(setGoal(base(), 'strong_army'), 'fill_treasury');
  state.people[RULER].stress = 20; state.people[HEIR].stress = 20;
  actionHooks(state).crown(state.people[HEIR], [], 'Ett prov');
  assert.deepEqual(state.reign.goals, []);
  assert.equal(state.realm.legitimacy, 55);
  assert.equal(state.realm.prestige, 10);
  state.date = addGameMonths(state.date, 120);
  assert.deepEqual(check(state), []);
  assert.equal(state.realm.legitimacy, 55);
  assert.equal(state.people[RULER].stress, 20);
  assert.equal(state.people[HEIR].stress, 20);
  // The new ruler can try the same goal again.
  assert.equal(goalRefusal(state, 'strong_army', actionHooks(state)), '');
});

// A child on the throne and the old ruler as her regent, as in dread.test.js. The reign is the child's, as crown leaves it.
function regency(regentId = RULER) {
  const state = plain(base());
  Object.assign(state.offices.ruler, { holderId: CHILD, regentId });
  state.reign.rulerId = CHILD;
  state.realm.lawfulRulerId = CHILD;
  state.regencies['office:ruler'] = { id: 'office:ruler', principalId: CHILD, regentId, phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
  state.stories = [];
  delete state.mandateVersion; delete state.mandateActivatedAt; delete state.mandateSequence;
  return normalizeCharacterSystem(state);
}

test("a goal set by a regent stays the ruler's", () => {
  const met = setGoal(regency(), 'strong_army');
  assert.equal(met.reign.rulerId, CHILD);
  met.realm.armyStrength = 90;
  met.people[CHILD].stress = 20; met.people[RULER].stress = 20;
  check(met);
  assert.equal(met.people[CHILD].stress, 10);
  assert.equal(met.people[RULER].stress, 20);
  assert.equal(met.reign.deeds.goalsMet, 1);
  assert.deepEqual(met.memories.at(-1).participants, [CHILD]);
  const missed = setGoal(regency(), 'strong_army');
  missed.people[CHILD].stress = 20; missed.people[RULER].stress = 20;
  missed.date = addGameMonths(missed.reign.goals[0].dueAt, 1);
  check(missed);
  assert.equal(missed.people[CHILD].stress, 30);
  assert.equal(missed.people[RULER].stress, 20);
});

test('a regent from another house sets the goal for the realm', () => {
  const REGENT = 'person-1-0';
  const state = regency(REGENT);
  state.people[REGENT].traits = [];
  assert.equal(getAvailableCharacterActions(state).find((item) => item.type === 'set_reign_goal').actorId, REGENT);
  assert.equal(actionHooks(state).isCommandAction('set_reign_goal'), true);
  const after = setGoal(state, 'strong_army');
  assert.equal(after.people[REGENT].stress, state.people[REGENT].stress + 3, "the order is the regent's");
  assert.equal(after.people[RULER].stress, state.people[RULER].stress, "the head of the ruler's house spent nothing");
});

test('a house reconciles at exactly 55', () => {
  const state = setGoal(base(), 'reconcile_houses');
  goalStep(state, [], { ...actionHooks(state), familySupport: () => 54.9 });
  assert.equal(state.reign.goals[0].status, 'active');
  goalStep(state, [], { ...actionHooks(state), familySupport: () => 55 });
  assert.equal(state.reign.goals[0].status, 'met');
});

test('prestige adds legitimacy from 30 and a passive year changes nothing', () => {
  // [prestige, legitimacy gained, prestige after]
  for (const [prestige, gain, after] of [[10, 0, 10], [29, 0, 28], [30, 1, 29], [49, 1, 48], [50, 2, 49], [100, 4, 99], [10.5, 0, 10], [9, 0, 9], [0, 0, 0]]) {
    const state = base();
    state.realm.prestige = prestige;
    prestigeStep(state);
    assert.equal(state.realm.legitimacy, 65 + gain, String(prestige));
    assert.equal(state.reign.sources.prestige, gain, String(prestige));
    assert.equal(state.realm.prestige, after, String(prestige));
  }
  const famous = base();
  famous.realm.prestige = 50;
  prestigeStep(famous);
  assert.deepEqual(legitimacySources(famous), [{ label: 'Tronföljd', value: 65 }, { label: 'Ryktbarhet', value: 2 }]);
  // A campaign with no deeds keeps today's legitimacy: half a point a year and nothing from prestige.
  const passive = year(base());
  assert.equal(passive.realm.legitimacy, 65.5);
  assert.equal(passive.realm.prestige, 10);
  assert.equal(passive.reign.sources.prestige, 0);
});

test('presentReign shows the goals in Swedish and leaves out the bookkeeping', () => {
  const state = setGoal(setGoal(base(), 'strong_army'), 'fill_treasury');
  state.realm.armyStrength = 90;
  check(state);
  const missed = setGoal(state, 'cow_nobles');
  missed.date = addGameMonths(missed.date, 61);
  missed.realm.treasury = 0;
  check(missed);
  const [met, failed, late] = missed.reign.goals;
  const open = setGoal(base(), 'full_council');
  const before = plain(missed);
  assert.deepEqual(presentReign(missed, actionHooks(missed)), {
    rulerId: RULER, rulerName: 'Arel av Hadara', startedAt: '-0300-01-01',
    goals: [
      { id: met.id, type: 'strong_army', label: 'Stärk hären', description: 'Arméns styrka ska nå minst 70 och stiga med 15.', dueAt: '-0295-01-01', status: 'met', statusLabel: 'Uppnått' },
      { id: failed.id, type: 'fill_treasury', label: 'Fyll statskassan', description: 'Statskassan ska rymma minst 300 silver och 80 mer än när målet sattes.', dueAt: '-0295-01-01', status: 'failed', statusLabel: 'Förfelat' },
      { id: late.id, type: 'cow_nobles', label: 'Håll adeln i schack', description: 'Adelns rädsla ska nå minst 30.', dueAt: '-0295-01-01', status: 'failed', statusLabel: 'Förfelat' },
    ],
  });
  assert.deepEqual(plain(missed), before, 'reading changes nothing');
  assert.deepEqual(presentReign(open, actionHooks(open)).goals.map(({ label, description, statusLabel }) => [label, description, statusLabel]), [['Fyll rådet med trogna', 'Kansler, överbefälhavare och spionmästare ska alla tjäna väl.', 'Pågår']]);
  assert.deepEqual(getCharacterPresentation(open).court.reign, presentReign(open, actionHooks(open)));
  // A dissolved realm has nobody to name.
  const gone = dissolve(base());
  assert.deepEqual(presentReign(gone, actionHooks(gone)), { rulerId: null, rulerName: null, startedAt: gone.date, goals: [] });
});

test('the reign goal table holds every row with its Swedish text', () => {
  assert.deepEqual(REIGN_GOALS.map(({ id, label, description }) => [id, label, description]), [
    ['fill_treasury', 'Fyll statskassan', 'Statskassan ska rymma minst 300 silver och 80 mer än när målet sattes.'],
    ['strong_army', 'Stärk hären', 'Arméns styrka ska nå minst 70 och stiga med 15.'],
    ['reconcile_houses', 'Försona de stora husen', 'Varje annan familj ska ge kronan minst 55 i politiskt stöd.'],
    ['lasting_work', 'Lämna ett bestående verk', 'En akademi eller en vattenledning ska stå färdig.'],
    ['full_council', 'Fyll rådet med trogna', 'Kansler, överbefälhavare och spionmästare ska alla tjäna väl.'],
    ['cow_nobles', 'Håll adeln i schack', 'Adelns rädsla ska nå minst 30.'],
  ]);
  assert.ok(Object.isFrozen(REIGN_GOALS));
  assert.ok(REIGN_GOALS.every((goal) => Object.isFrozen(goal)));
});

test('the menu offers what the command accepts', () => {
  const action = (state) => getAvailableCharacterActions(state).find((item) => item.type === 'set_reign_goal');
  const offered = (state) => action(state).fields[0].options.map((option) => option.value);
  const state = base(), first = action(state);
  assert.equal(first.label, 'Sätt ett mål för regeringen');
  assert.equal(first.cost, '0 silver ur statskassan · 1 handling');
  assert.equal(first.disabledReason, '');
  assert.deepEqual(first.fields.map(({ key, label }) => [key, label]), [['goalType', 'Mål']]);
  assert.deepEqual(first.fields[0].options[0], { value: 'fill_treasury', label: 'Fyll statskassan' });
  // Arel commands armies and cannot build, so lasting_work stays off the list.
  assert.deepEqual(offered(state), ['fill_treasury', 'strong_army', 'reconcile_houses', 'full_council', 'cow_nobles']);
  const one = setGoal(state, 'strong_army');
  assert.deepEqual(offered(one), ['fill_treasury', 'reconcile_houses', 'full_council', 'cow_nobles']);
  const two = setGoal(one, 'fill_treasury');
  assert.equal(action(two).disabledReason, 'Två mål är redan utlysta.');
  assert.deepEqual(offered(two), []);
  // Every goal tried: the reason is the refusal, and no empty list speaks instead.
  const spent = base();
  spent.reign.goals = ['fill_treasury', 'strong_army', 'reconcile_houses', 'full_council', 'cow_nobles'].map((type, index) => ({ id: `goal-${index + 1}`, type, baseline: 0, setAt: spent.date, dueAt: spent.date, status: 'met', closedAt: spent.date }));
  assert.equal(action(spent).disabledReason, 'Målet har redan prövats under denna regering.');
});

test('forged goal records are rejected', () => {
  const REIGN = /^Regeringens uppgifter i sparfilen är ogiltiga\.$/;
  const closed = (goal, state) => { goal.status = 'met'; goal.closedAt = state.date; };
  const forgeries = {
    'an id without a number': (goal) => { goal.id = 'goal-x'; },
    'an id of another ledger': (goal) => { goal.id = 'prisoner-1'; },
    'a number as id': (goal) => { goal.id = 1; },
    'a list as id': (goal) => { goal.id = [goal.id]; },
    'an id beyond the sequence': (goal, state) => { goal.id = `goal-${state.sequence + 1}`; },
    'an unknown type': (goal) => { goal.type = 'Bli världshärskare'; },
    'a prototype key as type': (goal) => { goal.type = 'constructor'; },
    'text as baseline': (goal) => { goal.baseline = '55'; },
    'null as baseline': (goal) => { goal.baseline = null; },
    'a date that is not canonical': (goal) => { goal.setAt = '-300-1-1'; },
    'set before the reign': (goal) => { goal.setAt = '-0301-01-01'; goal.dueAt = '-0296-01-01'; },
    'set after today': (goal, state) => { goal.setAt = addGameMonths(state.date, 1); goal.dueAt = addGameMonths(goal.setAt, 60); },
    'a deadline moved': (goal) => { goal.dueAt = addGameMonths(goal.dueAt, 12); },
    'the status the engine dropped': (goal) => { goal.status = 'abandoned'; goal.closedAt = goal.setAt; },
    'an unknown status': (goal) => { goal.status = 'won'; },
    'a list as status': (goal) => { goal.status = ['met']; goal.closedAt = goal.setAt; },
    'an open goal with a closing date': (goal) => { goal.closedAt = goal.setAt; },
    'a closed goal with no closing date': (goal) => { goal.status = 'met'; },
    'closed after today': (goal, state) => { closed(goal, state); goal.closedAt = addGameMonths(state.date, 1); },
    'closed before it was set': (goal, state) => { state.date = addGameMonths(state.date, 12); state.nextAnnualDate = addGameMonths(state.date, 12); goal.setAt = addGameMonths(state.date, -6); goal.dueAt = addGameMonths(goal.setAt, 60); goal.status = 'met'; goal.closedAt = addGameMonths(state.date, -12); },
    'a field missing': (goal) => { delete goal.baseline; },
    'an invented field': (goal) => { goal.legitimacy = 100; },
    'two goals of one type': (goal, state) => { state.reign.goals.push({ ...goal, id: 'goal-1', status: 'met', closedAt: goal.setAt }); },
    'one id twice': (goal, state) => { state.reign.goals.push({ ...goal, type: 'fill_treasury', dueAt: goal.dueAt }); },
    'three active goals': (goal, state) => { state.reign.goals.push({ ...goal, id: 'goal-1', type: 'fill_treasury' }, { ...goal, id: 'goal-2', type: 'cow_nobles' }); },
    'goals with no ruler': (goal, state) => { state.reign.rulerId = null; state.offices.ruler.holderId = null; },
  };
  for (const [name, forge] of Object.entries(forgeries)) {
    const raw = plain(setGoal(base(), 'strong_army'));
    raw.sequence = Math.max(raw.sequence, 5);
    forge(raw.reign.goals[0], raw);
    assert.throws(() => normalizeCharacterSystem(raw), { name: 'Error', message: REIGN }, name);
  }
  // Each status the engine writes loads.
  const met = setGoal(base(), 'strong_army');
  met.realm.armyStrength = 90;
  check(met);
  assert.deepEqual(normalizeCharacterSystem(plain(met)).reign.goals, met.reign.goals);
  const missed = setGoal(base(), 'strong_army');
  missed.date = addGameMonths(missed.reign.goals[0].dueAt, 1);
  missed.nextAnnualDate = addGameMonths(missed.date, 12);
  check(missed);
  assert.deepEqual(normalizeCharacterSystem(plain(missed)).reign.goals, missed.reign.goals);
});

test('a save that never had a reign takes its ruler from the office, also when the office names nobody', () => {
  const filled = plain(base());
  delete filled.reign;
  filled.extensionsVersion = 2;
  assert.equal(normalizeCharacterSystem(filled).reign.rulerId, RULER);
  // defaultReign reads a missing holder as null, and the rule that follows must read it the same way.
  const empty = plain(dissolve(base()));
  delete empty.reign;
  delete empty.offices.ruler.holderId;
  empty.extensionsVersion = 2;
  assert.equal(normalizeCharacterSystem(empty).reign.rulerId, null);
});

test('a reign that ended and a throne that passed on both load', () => {
  // Abdication goes through crown, and dissolution closes the reign itself, so record and office stay in step.
  const state = base();
  const abdicated = ok(run(state, 'abdicate'));
  assert.equal(abdicated.reign.rulerId, abdicated.offices.ruler.holderId);
  assert.equal(abdicated.reign.rulerId, HEIR);
  normalizeCharacterSystem(plain(abdicated));
  const gone = dissolve(abdicated);
  assert.equal(gone.reign.rulerId, null);
  assert.equal(gone.offices.ruler.holderId, null);
  normalizeCharacterSystem(plain(gone));
});

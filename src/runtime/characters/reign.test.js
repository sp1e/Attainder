import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, createCharacterSystem, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { DEED_KEYS, addPrestige, defaultReign, grantLegitimacy, legitimacySources, recordDeed, reignMonths, validateReign } from './reign.js';

const RULER = 'person-0-0';
const HEIR = 'person-0-2';
const NAMARS = 'family-namar';
const NO_DEEDS = Object.fromEntries(DEED_KEYS.map((key) => [key, 0]));

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => createCharacterSystem({ seed: 321, ...options });
let counter = 0;
const run = (state, type, payload = {}, origin) => executeCharacterCommand(state, { id: `command-${++counter}`, expectedRevision: state.revision, type, payload, origin });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const year = (state) => ok(advanceCharacters(state, addGameMonths(state.date, 12), { id: `year-${++counter}` }));
const total = (rows) => rows.reduce((sum, row) => sum + row.value, 0);

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

test('crown opens a new reign and abandons active goals', () => {
  const state = base(), hooks = actionHooks(state);
  recordDeed(state, 'cruel'); grantLegitimacy(state, 'goals', 6); state.reign.lostOrders = 2;
  const active = { id: 'goal-1', type: 'fill_treasury', status: 'active', closedAt: null };
  const met = { id: 'goal-2', type: 'strong_army', status: 'met', closedAt: '-0301-01-01' };
  state.reign.goals.push(active, met);
  hooks.crown(state.people[HEIR], [], 'Ett prov', 40, false);
  assert.equal(active.status, 'abandoned');
  assert.equal(active.closedAt, state.date);
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

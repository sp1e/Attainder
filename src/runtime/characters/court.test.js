import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, createCharacterSystem, canCharacterDirectRealm, getCharacterPresentation, getCharacterWorldEffects, normalizeCharacterSystem } from './index.js';
import { presentCouncil } from './council.js';
import { courtAnnualStep, onAccession, presentCourt, validateCourt } from './court.js';

const HEIR = 'person-0-2';
const KELAN = 'person-1-2';
const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => createCharacterSystem({ seed: 321, ...options });

test('the court step leaves rngState and actionRngState alone', () => {
  const fresh = base(), seasoned = advanceCharacters(fresh, addGameMonths(fresh.date, 60), { id: 'five-years' });
  assert.equal(seasoned.ok, true, seasoned.error);
  for (const state of [fresh, seasoned.state]) {
    const { rngState, actionRngState } = state;
    courtAnnualStep(state, [], actionHooks(state));
    assert.equal(state.rngState, rngState);
    assert.equal(state.actionRngState, actionRngState);
  }
});

test('the court step stops at once in a dissolved realm', () => {
  const state = plain(base());
  state.realm.alive = false;
  const before = plain(state), events = [];
  courtAnnualStep(state, events, actionHooks(state));
  assert.deepEqual(state, before);
  assert.deepEqual(events, []);
});

test('onAccession writes the new reign', () => {
  const state = base();
  onAccession(state, state.people[HEIR], { lawful: false, legitimacy: 35 });
  assert.equal(state.reign.rulerId, HEIR);
  assert.equal(state.reign.lawful, false);
  assert.equal(state.reign.sources.accession, 35);
  onAccession(state, null, { lawful: true, legitimacy: 55 });
  assert.equal(state.reign.rulerId, null);
});

test('validateCourt refuses what validateReign refuses, and loading goes through it', () => {
  const state = base();
  validateCourt(state);
  state.reign.lostOrders = -1;
  assert.throws(() => validateCourt(state), { name: 'Error', message: /^Regeringens uppgifter i sparfilen är ogiltiga\.$/ });
  assert.throws(() => normalizeCharacterSystem(plain(state)), { name: 'Error', message: /^Regeringens uppgifter i sparfilen är ogiltiga\.$/ });
});

test('presentCourt draws nothing and spends nothing', () => {
  const state = base(), before = plain(state);
  const court = presentCourt(state, actionHooks(state));
  assert.deepEqual(court, {
    reign: { rulerId: 'person-0-0', startedAt: state.date, lawful: true },
    legitimacy: { value: 65, sources: [{ label: 'Tronföljd', value: 65 }] },
    prestige: 10,
    council: presentCouncil(state, actionHooks(state)),
    dread: { value: 0, label: 'Ingen fruktar kronan' },
  });
  assert.deepEqual(plain(state), before);
  const view = getCharacterPresentation(state);
  assert.deepEqual(view.court, court);
  assert.deepEqual(plain(state), before);
  // Changing what was presented reaches nothing in the state.
  court.reign.rulerId = 'x'; court.legitimacy.sources[0].value = 0;
  assert.deepEqual(plain(state), before);
  // The presented value follows the rounded legitimacy, as the rows do.
  state.realm.legitimacy = 65.5;
  assert.equal(presentCourt(state, actionHooks(state)).legitimacy.value, 66);
});

test('the court hooks answer from the engine', () => {
  const state = base(), hooks = actionHooks(state), view = getCharacterPresentation(state);
  assert.equal(hooks.canRule(), canCharacterDirectRealm(state));
  assert.equal(hooks.canRule(), true);
  assert.equal(hooks.militaryReadiness(), getCharacterWorldEffects(state).militaryReadiness);
  assert.equal(hooks.appointReason(), '');
  assert.equal(hooks.rulerCandidates()[0].id, HEIR);
  assert.equal(Math.round(hooks.familySupport(state.families['family-namar'])), view.families.find((family) => family.id === 'family-namar').support);
  assert.equal(actionHooks(base({ mode: 'family', familyId: 'family-namar' })).canRule(), false);
  // A realm with nobody who can act refuses the appointment with the engine's own sentence.
  const empty = base(); empty.realm.alive = false;
  assert.match(actionHooks(empty).appointReason(), /^Riket saknar en behörig vuxen företrädare./);
  hooks.assignOffice(state.offices.general, null, [], 'Ett prov');
  assert.equal(state.offices.general.holderId, null);
  assert.equal(state.offices.general.history.at(-1).reason, 'Ett prov');
  hooks.assignOffice(state.offices.general, state.people[KELAN], [], 'Tillbaka');
  assert.equal(state.offices.general.holderId, KELAN);
});

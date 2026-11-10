// Who inherits when the heir died first: the heir's children take the heir's place, and persons
// who married into the house stand with the outsiders. The demo court is Arel (ruler), his wife
// Iset, their daughter Sera, her husband Tarek and their children Mira (10) and Neri (6), all of
// family-arel. Spec: docs/superpowers/specs/2026-11-08-married-in-succession-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSystem, getCharacterPresentation, getSuccessionForecast } from './index.js';

const ARELS_HOUSE = ['person-0-0', 'person-0-1', 'person-0-2', 'person-0-3', 'person-0-4', 'person-0-5'];
const [, ISET, SERA, TAREK, MIRA, NERI] = ARELS_HOUSE;
const OLDEST_OUTSIDER = 'person-1-0';
const candidates = state => getCharacterPresentation(state).succession.candidates.map(c => c.id);
const court = (law, { dead = [] } = {}) => {
  const state = createCharacterSystem();
  state.realm.successionLaw = law;
  for (const id of dead) state.people[id].diedAt = state.date;
  return state;
};
const child = (state, id, bornAt, legalParentIds) => {
  state.people[id] = { ...structuredClone(state.people[NERI]), id, bornAt, legalParentIds, spouseId: null };
  return id;
};

test('with every heir alive the daughter inherits under all four laws', () => {
  for (const law of ['primogeniture', 'merit', 'elective', 'partition']) assert.equal(getSuccessionForecast(court(law)).expectedRuler.id, SERA, law);
});

test("under primogeniture the dead daughter's children inherit before the widow and the widower", () => {
  const state = court('primogeniture', { dead: [SERA] });
  assert.equal(getSuccessionForecast(state).expectedRuler.id, MIRA);
  const ids = candidates(state);
  assert.deepEqual(ids.slice(0, 2), [MIRA, NERI]);
  assert.ok(ids.indexOf(ISET) > ids.indexOf(OLDEST_OUTSIDER), 'the widow stands with the outsiders, after an older outsider');
  // The presentation lists eight candidates; the widower, younger than every outside adult shown, falls past them.
  assert.ok(!ids.includes(TAREK) || ids.indexOf(TAREK) > ids.indexOf(OLDEST_OUTSIDER), 'the widower stands with the outsiders');
});

test('under the elective law the house minors precede the married-in adults', () => {
  const state = court('elective', { dead: [SERA] });
  assert.equal(getSuccessionForecast(state).expectedRuler.id, MIRA);
  const ids = candidates(state);
  assert.deepEqual(ids.slice(0, 2), [MIRA, NERI]);
  assert.ok(ids.indexOf(ISET) > 1 && ids.indexOf(TAREK) > 1);
});

test('with the line extinct a married-in widow is one adult among the outsiders by age', () => {
  const state = court('primogeniture', { dead: [SERA, MIRA, NERI] });
  assert.equal(getSuccessionForecast(state).expectedRuler.id, OLDEST_OUTSIDER);
});

test('the primogeniture line runs depth first: a dead eldest child\'s line precedes a living younger child', () => {
  const state = court('primogeniture');
  const son = child(state, 'probe-son', '-0320-01-01', ['person-0-0', ISET]);
  const grandson = child(state, 'probe-grandson', '-0302-01-01', [son]);
  assert.deepEqual(candidates(state).slice(0, 5), [SERA, MIRA, NERI, son, grandson]);
  state.people[SERA].diedAt = state.date;
  assert.deepEqual(candidates(state).slice(0, 4), [MIRA, NERI, son, grandson]);
});

// Grudges pass to the children. Spec: docs/superpowers/specs/2026-11-09-inherited-grudges-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, createCharacterSystem } from './index.js';

const REP = 'person-0-0';
const NAMAR = 'person-1-0';
const KELAN = 'person-1-2';
const EREN = 'person-1-4';
const LYSA = 'person-1-5';
const BAREK = 'person-2-2';

const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
function grudge(state, fromId, toId, amount, { label = 'Avböj bidraget', expiresAt = null } = {}) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  const causeId = `fixture-${++counter}`;
  state.relations[key].causes.push({ id: `fixture-cause-${counter}`, amount, label, causeId, startAt: state.date, expiresAt });
  return causeId;
}
const causesOf = (state, fromId, toId) => state.relations[`${fromId}:${toId}`]?.causes || [];
const kill = (state, id) => { actionHooks(state).kill([id], [], 'Prov'); return state; };

test('a grudge passes at half strength to each adult child, with its cause and a ten-year expiry', () => {
  const state = base();
  const causeId = grudge(state, NAMAR, REP, -20);
  kill(state, NAMAR);
  assert.deepEqual(causesOf(state, KELAN, REP).map(({ amount, label, causeId: id, startAt, expiresAt }) => ({ amount, label, id, startAt, expiresAt })),
    [{ amount: -10, label: 'Avböj bidraget (ärvt från Namar av Hadara)', id: causeId, startAt: state.date, expiresAt: addGameMonths(state.date, 120) }]);
  assert.deepEqual(causesOf(state, EREN, REP), [], 'a minor child inherits nothing');
});

test('only a negative, active grudge of size 10 or more passes', () => {
  const state = base();
  grudge(state, NAMAR, REP, -10);
  grudge(state, NAMAR, REP, -9);
  grudge(state, NAMAR, REP, 15);
  grudge(state, NAMAR, REP, -40, { expiresAt: addGameMonths(state.date, -1) });
  kill(state, NAMAR);
  assert.deepEqual(causesOf(state, KELAN, REP).map((cause) => cause.amount), [-5]);
});

test('a dead target, or a child who is the target, gets nothing', () => {
  const state = base();
  grudge(state, NAMAR, BAREK, -30);
  grudge(state, NAMAR, KELAN, -30);
  state.people[BAREK].diedAt = state.date;
  kill(state, NAMAR);
  assert.deepEqual(causesOf(state, KELAN, BAREK), []);
  assert.deepEqual(causesOf(state, KELAN, KELAN), []);
  const together = base();
  grudge(together, NAMAR, BAREK, -30);
  actionHooks(together).kill([NAMAR, BAREK], [], 'Prov');
  assert.deepEqual(causesOf(together, KELAN, BAREK), [], 'a target who dies at the same boundary');
});

test('a grudge reaches the grandchildren at a quarter, with one inherited suffix', () => {
  const state = base();
  state.people[EREN].bornAt = '-0320-01-01';
  state.people[LYSA].bornAt = '-0321-01-01';
  grudge(state, NAMAR, REP, -20);
  kill(state, NAMAR);
  kill(state, KELAN);
  for (const id of [EREN, LYSA]) {
    assert.deepEqual(causesOf(state, id, REP).map(({ amount, label }) => ({ amount, label })), [{ amount: -5, label: 'Avböj bidraget (ärvt från Kelan Namar)' }]);
  }
});

test('a child who already holds the cause gets no second copy', () => {
  const state = base();
  const causeId = grudge(state, NAMAR, REP, -20);
  state.relations[`${KELAN}:${REP}`] = { fromId: KELAN, toId: REP, bonds: [], causes: [{ id: 'own', amount: -12, label: 'Eget agg', causeId, startAt: state.date, expiresAt: null }] };
  kill(state, NAMAR);
  assert.deepEqual(causesOf(state, KELAN, REP).map((cause) => cause.id), ['own']);
});

test('the inheritance draws from no random stream', () => {
  const state = base();
  grudge(state, NAMAR, REP, -20);
  const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState];
  const withoutGrudge = kill(base(), NAMAR), withGrudge = kill(state, NAMAR);
  assert.deepEqual(streams(withGrudge), streams(withoutGrudge));
});

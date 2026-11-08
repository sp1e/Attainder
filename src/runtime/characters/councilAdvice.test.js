// A disloyal councillor flatters the odds the player sees. Spec: docs/superpowers/specs/2026-11-08-flattering-advisor-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHooks, createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getCharacterPresentation } from './index.js';
import { bandFor, flatteredBand } from './actionOdds.js';
import { advisorFor, flatteryRevealed } from './council.js';

const REP = 'person-0-0';
const TARGET = 'person-1-0';
const CHANCELLOR = 'person-2-2';
const SERA = 'person-0-2';
const SEED = 2027808452;

let counter = 0;
const sway = (extra = {}) => ({ actionId: 'sway', actorId: REP, targetIds: [TARGET], ...extra });
const run = (state, payload) => executeCharacterCommand(state, { id: `advice-${++counter}`, expectedRevision: state.revision, type: 'attempt_action', payload });
const setRulerOpinion = (state, id, target) => {
  const hooks = actionHooks(state);
  hooks.opinionCause(id, REP, target - hooks.getPersonalOpinion(id, REP), 'Prov', `advice-${++counter}`, 10);
};
// Seats a person with no traits and opinion 0 of the ruler, so service equals loyalty.
function seat(state, officeId, id, { loyalty, intrigue = null }) {
  state.offices[officeId].holderId = id;
  Object.assign(state.people[id], { traits: [], loyalty });
  if (intrigue !== null) state.people[id].skills.intrigue = intrigue;
  setRulerOpinion(state, id, 0);
}
function scene({ chancellor = 10, spymaster = null } = {}) {
  const state = createCharacterSystem({ seed: 321 });
  state.actionRngState = SEED;
  seat(state, 'chancellor', CHANCELLOR, { loyalty: chancellor });
  if (spymaster) seat(state, 'spymaster', SERA, spymaster);
  return state;
}

test('a band moves one step up and stops at the top band', () => {
  assert.equal(flatteredBand(46, 'three'), 'trolig');
  assert.equal(flatteredBand(90, 'three'), 'trolig');
  assert.equal(flatteredBand(10, 'five'), 'låg');
  assert.equal(flatteredBand(95, 'five'), 'mycket hög');
  assert.throws(() => flatteredBand(46, 'exact'), RangeError);
});

test('the advisor is the councillor of the action skill, and service below 30 flatters', () => {
  const state = scene();
  const hooks = actionHooks(state);
  assert.deepEqual(advisorFor(state, 'diplomacy', hooks), { personId: CHANCELLOR, name: state.people[CHANCELLOR].name, officeId: 'chancellor', officeName: 'Kansler', flatters: true });
  assert.equal(advisorFor(state, 'stewardship', hooks), null);
  assert.equal(advisorFor(state, 'intrigue', hooks), null, 'the spymaster seat is vacant');
  seat(state, 'chancellor', CHANCELLOR, { loyalty: 30 });
  assert.equal(advisorFor(state, 'diplomacy', actionHooks(state)).flatters, false);
});

test('a flattering chancellor shows both bands one step up and keeps the true odds', () => {
  const flattered = estimateCharacterAction(scene(), sway());
  const honest = estimateCharacterAction(scene({ chancellor: 80 }), sway());
  assert.equal(flattered.precision, 'three');
  assert.equal(flattered.success.value, honest.success.value);
  assert.equal(flattered.secrecy.value, honest.secrecy.value);
  assert.equal(honest.display.success, bandFor(honest.success.value, 'three'));
  assert.equal(flattered.display.success, flatteredBand(flattered.success.value, 'three'));
  assert.equal(flattered.display.secrecy, flatteredBand(flattered.secrecy.value, 'three'));
  assert.notEqual(flattered.display.success, honest.display.success);
  assert.deepEqual(flattered.display.modifiers, honest.display.modifiers);
  assert.deepEqual(flattered.display.advisor, { name: 'Barek Eshmun', officeName: 'Kansler' });
  assert.deepEqual(honest.display.advisor, flattered.display.advisor, 'the card names the advisor either way');
  assert.deepEqual(flattered.flattery, { advisorId: CHANCELLOR, officeId: 'chancellor' });
  assert.equal(honest.flattery, undefined);
});

test('an actor who reads exact odds sees through the flattery, and a vacant seat gives no advisor', () => {
  const skilled = scene();
  skilled.people[REP].skills.diplomacy = 14;
  const exact = estimateCharacterAction(skilled, sway());
  assert.equal(exact.precision, 'exact');
  assert.equal(exact.display.success, exact.success.value);
  assert.equal(exact.flattery, undefined);
  const vacant = scene();
  vacant.offices.chancellor.holderId = null;
  const alone = estimateCharacterAction(vacant, sway());
  assert.equal(alone.display.advisor, undefined);
  assert.equal(alone.flattery, undefined);
});

test('the rolls and the tier are the same as with a loyal advisor', () => {
  const flattered = run(scene(), sway()).state.actionLog.at(-1);
  const honest = run(scene({ chancellor: 80 }), sway()).state.actionLog.at(-1);
  assert.deepEqual(flattered.rolls, honest.rolls);
  assert.equal(flattered.tier, honest.tier);
  assert.deepEqual(flattered.estimate, honest.estimate);
  assert.equal(Object.hasOwn(honest, 'flattery'), false);
});

test('a skilled spymaster reveals the flattery on the result card', () => {
  const result = run(scene({ spymaster: { loyalty: 80, intrigue: 12 } }), sway());
  const entry = result.state.actionLog.at(-1);
  assert.deepEqual(entry.flattery, { advisorId: CHANCELLOR, officeId: 'chancellor', revealed: true });
  const shown = getCharacterPresentation(result.state).recentResolutions.at(-1);
  assert.equal(shown.odds.success, bandFor(entry.estimate.success, 'three'));
  assert.deepEqual(shown.flattery, { advisorName: 'Barek Eshmun', officeName: 'Kansler',
    shown: { success: flatteredBand(entry.estimate.success, 'three'), secrecy: flatteredBand(entry.estimate.secrecy, 'three') } });
});

test('without a skilled spymaster the card keeps the flattered bands', () => {
  for (const spymaster of [null, { loyalty: 80, intrigue: 3 }]) {
    const result = run(scene({ spymaster }), sway());
    const entry = result.state.actionLog.at(-1);
    assert.deepEqual(entry.flattery, { advisorId: CHANCELLOR, officeId: 'chancellor', revealed: false });
    const shown = getCharacterPresentation(result.state).recentResolutions.at(-1);
    assert.equal(shown.odds.success, flatteredBand(entry.estimate.success, 'three'));
    assert.equal(shown.flattery, undefined);
  }
});

test('a spymaster cannot reveal their own flattery', () => {
  const state = scene({ spymaster: { loyalty: 10, intrigue: 14 } });
  const hooks = actionHooks(state);
  assert.equal(flatteryRevealed(state, SERA, hooks), false);
  assert.equal(flatteryRevealed(state, CHANCELLOR, hooks), true);
});

// Friends and rivals form at court. Spec: docs/superpowers/specs/2026-11-08-friends-and-rivals-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, createCharacterSystem, estimateConversation } from './index.js';
import { BOND_ROWS, bondStep } from './bonds.js';
import { npcPlotStep } from './npcPlots.js';

const REP = 'person-0-0';
const NAMAR = 'person-1-0';
const BAREK = 'person-2-2';
const DANEL = 'person-3-2';
const ARELS = 'family-arel';

const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
// Replaces every opinion cause from one person to another with a single lasting one.
function setOpinion(state, fromId, toId, amount) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  state.relations[key].causes = [{ id: `fixture-${++counter}`, amount, label: 'Provvärde', causeId: `fixture-${counter}`, startAt: state.date, expiresAt: null }];
}
const pair = (state, ab, ba) => { setOpinion(state, BAREK, DANEL, ab); setOpinion(state, DANEL, BAREK, ba); return state; };
const bondsOf = (state) => [state.relations[`${BAREK}:${DANEL}`]?.bonds || [], state.relations[`${DANEL}:${BAREK}`]?.bonds || []];
const step = (state) => { bondStep(state, actionHooks(state)); return state; };
const both = (kinds) => [kinds, kinds];

test('a friendship forms at +50 one way while the other way stays above -20', () => {
  assert.deepEqual(bondsOf(step(pair(base(), 50, 0))), both(['friend']));
  assert.deepEqual(bondsOf(step(pair(base(), 0, 72))), both(['friend']));
  assert.deepEqual(bondsOf(step(pair(base(), 49, 0))), both([]));
  assert.deepEqual(bondsOf(step(pair(base(), 60, -20))), both([]));
});

test('a rivalry forms at -50 one way while the other way stays below +20', () => {
  assert.deepEqual(bondsOf(step(pair(base(), -50, 0))), both(['rival']));
  assert.deepEqual(bondsOf(step(pair(base(), 19, -80))), both(['rival']));
  assert.deepEqual(bondsOf(step(pair(base(), -60, 20))), both([]));
});

test('a bond holds until the opinion crosses 20 and leaves other bonds in place', () => {
  const friends = step(pair(base(), 60, 0));
  actionHooks(friends).addBond(BAREK, DANEL, 'mentor');
  assert.deepEqual(bondsOf(step(pair(friends, 30, 0))), both(['friend', 'mentor']));
  assert.deepEqual(bondsOf(step(pair(friends, 19, 0))), both(['mentor']));
  const cooled = step(pair(base(), 60, 0));
  assert.deepEqual(bondsOf(step(pair(cooled, 60, -20))), both([]));
  const rivals = step(pair(base(), -60, 0));
  assert.deepEqual(bondsOf(step(pair(rivals, -30, 0))), both(['rival']));
  assert.deepEqual(bondsOf(step(pair(rivals, -19, 0))), both([]));
  const reconciled = step(pair(base(), -60, 0));
  assert.deepEqual(bondsOf(step(pair(reconciled, -60, 20))), both([]));
});

test('a dead or child member keeps the bond it has and forms none', () => {
  const mourned = step(pair(base(), 60, 0));
  mourned.people[DANEL].diedAt = mourned.date;
  assert.deepEqual(bondsOf(step(pair(mourned, 0, 0))), both(['friend']));
  const young = pair(base(), 80, 80);
  young.people[DANEL].bornAt = addGameMonths(young.date, -60);
  assert.deepEqual(bondsOf(step(young)), both([]));
});

test('the step draws from no random stream', () => {
  const state = pair(base(), 60, 0);
  const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState];
  const before = streams(state);
  step(state);
  assert.deepEqual(streams(state), before);
});

test('the year end forms the bond', () => {
  const state = pair(base(), 70, 10);
  const result = advanceCharacters(state, state.nextAnnualDate, { id: 'bonds:year' });
  assert.equal(result.ok, true, result.error);
  assert.ok(result.state.relations[`${BAREK}:${DANEL}`].bonds.includes('friend'));
});

test('a friend or rival bond with the representative adds its conversation row', () => {
  assert.deepEqual(BOND_ROWS, { friend: { label: 'Vänskap', value: 8 }, rival: { label: 'Rivalitet', value: -8 } });
  const ask = { personId: NAMAR, kind: 'support', offerSilver: 0, hookId: null, arguments: [], argumentScore: 0 };
  const rowOf = (state, label) => estimateConversation(state, ask).modifiers.find((row) => row.label === label);
  const plain = base();
  assert.equal(rowOf(plain, 'Vänskap'), undefined);
  const friendly = base();
  actionHooks(friendly).addBond(NAMAR, REP, 'friend');
  assert.deepEqual(rowOf(friendly, 'Vänskap'), { label: 'Vänskap', value: 8 });
  const hostile = base();
  actionHooks(hostile).addBond(NAMAR, REP, 'rival');
  assert.deepEqual(rowOf(hostile, 'Rivalitet'), { label: 'Rivalitet', value: -8 });
});

test('a rival pair of two families comes first in the choice of a feud', () => {
  const state = base();
  for (const person of Object.values(state.people)) if (person.familyId !== ARELS) setOpinion(state, person.id, REP, 60);
  setOpinion(state, BAREK, DANEL, -80);
  setOpinion(state, DANEL, BAREK, -80);
  setOpinion(state, 'person-2-3', 'person-3-3', -5);
  setOpinion(state, 'person-3-3', 'person-2-3', 0);
  actionHooks(state).addBond('person-2-3', 'person-3-3', 'rival');
  state.plotRngState = 1; // the first plot draw falls below the feud chance
  npcPlotStep(state, [], actionHooks(state));
  const feud = state.schemes.find((scheme) => !scheme.playerControlled);
  assert.deepEqual([feud.actorId, feud.targetIds[0]], ['person-2-3', 'person-3-3']);
});

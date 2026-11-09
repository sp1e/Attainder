// A ruler's illegitimate child claims the throne. Spec: docs/superpowers/specs/2026-11-10-bastard-claimant-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHooks, createCharacterSystem, executeCharacterCommand } from './index.js';
import { BASTARD_CLAIM_GRUDGE, BASTARD_CLAIM_LABEL, bastardClaimStep, claimLabel, royalBastards } from './bastardClaims.js';
import { claimantFor } from './factions.js';
import { createSecret, exposeSecret } from './secrets.js';

const SIRE = 'person-0-0', RULER = 'person-0-2', CHILD = 'person-1-2', MOTHER = 'person-1-0', COMMONER = 'person-3-2';

// Seed 2 after an abdication: person-0-0 has ruled and person-0-2 rules now.
function court({ sire = SIRE, exposed = true } = {}) {
  const start = createCharacterSystem({ seed: 2 });
  const { state } = executeCharacterCommand(start, { id: 'abdicate', expectedRevision: start.revision, type: 'abdicate', payload: {} });
  const secret = createSecret(state, { type: 'illegitimate_child', subjectId: CHILD, holderIds: [MOTHER, sire], evidence: 'weak' });
  if (exposed) exposeSecret(state, secret.id);
  return { state, secret, hooks: actionHooks(state) };
}

const claimant = (state, hooks) => claimantFor(state, { leaderId: COMMONER }, hooks).id;
const causesOf = (state, fromId, toId) => state.relations[`${fromId}:${toId}`]?.causes.filter((cause) => cause.label === BASTARD_CLAIM_LABEL) ?? [];

test('an exposed adult child of a former ruler claims before anyone else', () => {
  const { state, hooks } = court();
  assert.deepEqual(royalBastards(state).map((row) => [row.child.id, row.sire.id]), [[CHILD, SIRE]]);
  assert.equal(claimant(state, hooks), CHILD);
  const hidden = court({ exposed: false });
  assert.notEqual(claimant(hidden.state, hidden.hooks), CHILD);
});

test('a hidden, dead, young or commoner-sired child makes no claim', () => {
  const hidden = court({ exposed: false });
  assert.deepEqual(royalBastards(hidden.state), []);
  const commoner = court({ sire: COMMONER });
  assert.deepEqual(royalBastards(commoner.state), []);
  const young = court();
  young.state.people[CHILD].bornAt = young.state.date;
  assert.notEqual(claimant(young.state, young.hooks), CHILD);
  const dead = court();
  dead.state.people[CHILD].diedAt = dead.state.date;
  assert.deepEqual(royalBastards(dead.state), []);
});

test('the yearly step gives the grudge once per ruler', () => {
  const { state, secret, hooks } = court();
  const rulerId = state.offices.ruler.holderId;
  bastardClaimStep(state, hooks);
  bastardClaimStep(state, hooks);
  const [cause, ...rest] = causesOf(state, CHILD, rulerId);
  assert.equal(rest.length, 0);
  assert.equal(cause.amount, BASTARD_CLAIM_GRUDGE);
  assert.equal(cause.causeId, `claim:${secret.id}:${rulerId}`);
  state.offices.ruler.holderId = SIRE;
  bastardClaimStep(state, actionHooks(state));
  assert.equal(causesOf(state, CHILD, SIRE).length, 0, 'no grudge against the own father');
  state.offices.ruler.holderId = COMMONER;
  bastardClaimStep(state, actionHooks(state));
  assert.equal(causesOf(state, CHILD, COMMONER).length, 1);
});

test('the sitting ruler\'s own exposed child claims and bears the father no grudge', () => {
  const { state, hooks } = court({ sire: RULER });
  assert.equal(state.offices.ruler.holderId, RULER);
  assert.equal(claimant(state, hooks), CHILD);
  bastardClaimStep(state, hooks);
  assert.equal(causesOf(state, CHILD, RULER).length, 0);
});

test('the claim names the bastardy', () => {
  const { state } = court();
  const child = state.people[CHILD], sire = state.people[SIRE];
  assert.equal(claimLabel(state, child), `${child.name}, oäkta barn till ${sire.name}`);
  assert.equal(claimLabel(state, sire), sire.name);
});

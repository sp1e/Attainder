// Children of an affair. Spec: docs/superpowers/specs/2026-11-09-illegitimate-children-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHooks, bearChild, createCharacterSystem } from './index.js';
import { exposeSecret } from './secrets.js';
import { imprisonPerson } from './prisoners.js';
import { primogenitureCandidates } from './succession.js';
import { biologicalFather, eligibleLovers, paternityDraw, paternityStep } from './paternity.js';

const MOTHER = 'person-2-2';
const HUSBAND = 'person-2-3';
const LOVERS = ['person-0-1', 'person-0-3', 'person-1-1', 'person-1-3', 'person-3-1', 'person-3-3'];

const base = () => createCharacterSystem({ seed: 321 });
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState];
// Sets the plot stream's state so that the paternity draw for the mother passes `accept`.
function steer(state, accept) {
  const peek = () => paternityDraw(state, state.people[MOTHER]);
  for (let seed = 1; seed < 10000; seed++) { state.plotRngState = seed; if (accept(peek())) return peek(); }
  throw new Error('no seed');
}
const childOf = (state, motherId) => Object.values(state.people).filter((p) => p.legalParentIds.includes(motherId)).sort((a, b) => a.id.localeCompare(b.id)).at(-1);

test('without an affair the husband is the father and no stream moves', () => {
  const state = base();
  const before = streams(state);
  assert.equal(biologicalFather(state, state.people['person-0-2'], state.people['person-0-3'], actionHooks(state)).id, 'person-0-3');
  assert.deepEqual(streams(state), before);
});

test('an affair gives the lover from a paternity draw below one half, else the husband, and moves no stream', () => {
  const state = base();
  const u = steer(state, (value) => value < 0.5);
  const before = streams(state);
  const father = biologicalFather(state, state.people[MOTHER], state.people[HUSBAND], actionHooks(state));
  assert.equal(father.id, LOVERS[Math.floor((u / 0.5) * LOVERS.length)]);
  assert.deepEqual(streams(state), before);
  steer(state, (value) => value >= 0.5);
  assert.equal(biologicalFather(state, state.people[MOTHER], state.people[HUSBAND], actionHooks(state)).id, HUSBAND);
});

test('the husband, kin, a prisoner, a minor, a woman and the representative are never lovers', () => {
  const state = base();
  const hooks = actionHooks(state);
  assert.deepEqual(eligibleLovers(state, state.people[MOTHER], state.people[HUSBAND], hooks).map((p) => p.id), LOVERS);
  imprisonPerson(state, 'person-1-1', 'family-arel', [], hooks);
  const asRepresentative = { ...hooks, activeRepresentative: () => state.people['person-3-3'] };
  assert.deepEqual(eligibleLovers(state, state.people[MOTHER], state.people[HUSBAND], asRepresentative).map((p) => p.id), ['person-0-1', 'person-0-3', 'person-1-3', 'person-3-1']);
});

test("the lover's child keeps the husband as legal father and leaves a secret held by mother and lover", () => {
  const state = base();
  const u = steer(state, (value) => value < 0.5);
  const lover = LOVERS[Math.floor((u / 0.5) * LOVERS.length)];
  bearChild(state, state.people[MOTHER], state.people[HUSBAND], []);
  const child = childOf(state, MOTHER);
  assert.deepEqual(child.biologicalParentIds, [MOTHER, lover]);
  assert.deepEqual(child.legalParentIds, [MOTHER, HUSBAND]);
  assert.equal(child.traits.at(-1), state.people[lover].traits[0]);
  assert.equal(state.log.find((entry) => entry.participants?.[0] === child.id && entry.type === 'birth').description, `Barn till ${state.people[MOTHER].name} och ${state.people[HUSBAND].name}.`);
  const birth = state.memories.find((m) => m.type === 'birth' && m.participants[0] === child.id);
  const secret = state.secrets.find((s) => s.type === 'illegitimate_child' && s.subjectId === child.id);
  assert.deepEqual({ holderIds: secret.holderIds, evidence: secret.evidence, causeId: secret.causeId, exposed: secret.exposed }, { holderIds: [MOTHER, lover], evidence: 'weak', causeId: birth.id, exposed: false });
});

test('a second child of the same affair has the same lover', () => {
  const state = base();
  const first = LOVERS[Math.floor((steer(state, (value) => value < 0.5) / 0.5) * LOVERS.length)];
  bearChild(state, state.people[MOTHER], state.people[HUSBAND], []);
  steer(state, (value) => value < 0.5 && LOVERS[Math.floor((value / 0.5) * LOVERS.length)] !== first);
  bearChild(state, state.people[MOTHER], state.people[HUSBAND], []);
  assert.deepEqual(childOf(state, MOTHER).biologicalParentIds, [MOTHER, first]);
});

test('an exposed secret puts the child behind the house kin under primogeniture', () => {
  const state = base();
  steer(state, (value) => value < 0.5);
  bearChild(state, state.people[MOTHER], state.people[HUSBAND], []);
  const child = childOf(state, MOTHER);
  const people = Object.values(state.people).filter((p) => !p.diedAt && p.id !== MOTHER);
  const order = () => primogenitureCandidates(state, state.people[MOTHER], people, () => true).map((p) => p.id);
  const before = order();
  assert.ok(before.slice(0, before.indexOf(child.id) + 1).every((id) => state.people[id].legalParentIds.includes(MOTHER)), 'the hidden child stands in the line');
  exposeSecret(state, state.secrets.find((s) => s.subjectId === child.id).id);
  const after = order(), at = after.indexOf(child.id);
  assert.ok(at > before.indexOf(child.id));
  assert.ok(after.slice(0, at).every((id) => state.people[id].familyId === 'family-eshmun'), 'only the house stands ahead');
  assert.deepEqual(after.filter((id) => id !== child.id), before.filter((id) => id !== child.id));
});

test('the husband turns against wife and lover once the secret is out, and only once', () => {
  const state = base();
  const lover = LOVERS[Math.floor((steer(state, (value) => value < 0.5) / 0.5) * LOVERS.length)];
  bearChild(state, state.people[MOTHER], state.people[HUSBAND], []);
  const secret = state.secrets.find((s) => s.type === 'illegitimate_child');
  paternityStep(state, actionHooks(state));
  assert.equal((state.relations[`${HUSBAND}:${MOTHER}`]?.causes ?? []).filter((c) => c.label === 'Oäkta barn').length, 0, 'a hidden secret changes nothing');
  exposeSecret(state, secret.id);
  paternityStep(state, actionHooks(state));
  paternityStep(state, actionHooks(state));
  for (const target of [MOTHER, lover]) {
    assert.deepEqual(state.relations[`${HUSBAND}:${target}`].causes.filter((c) => c.label === 'Oäkta barn').map(({ amount, causeId }) => ({ amount, causeId })), [{ amount: -25, causeId: `bastard:${secret.id}` }]);
  }
});

// A shared memory weighs by what it records: a favor helps, a grievance counts against the speaker's goodwill.
// Spec: docs/superpowers/specs/2026-11-08-memory-valence-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMORY_VALENCE } from './conversation.js';
import { actionHooks, createCharacterSystem, estimateConversation } from './index.js';

const REP = 'person-0-0', NAMAR = 'person-1-0';
const ask = (args, score = 7) => ({ personId: NAMAR, kind: 'support', offerSilver: 0, hookId: null, arguments: args, argumentScore: score });
const plain = () => {
  const state = createCharacterSystem({ seed: 321 });
  Object.assign(state.people[NAMAR], { traits: [], loyalty: 50 });
  return state;
};
const estimate = (state, request) => { const result = estimateConversation(state, request); assert.equal(result.ok, true, result.reason); return result; };
const row = (result, label) => result.modifiers.find((item) => item.label === label)?.value;
const cite = (...memories) => memories.map((memory) => ({ kind: 'shared_memory', refId: memory.id }));

test('the valence table sorts favors and grievances', () => {
  assert.deepEqual(MEMORY_VALENCE.favor, ['gift', 'appointment', 'education', 'patronage', 'story_patronage', 'promise_kept', 'adoption']);
  assert.deepEqual(MEMORY_VALENCE.grievance, ['betrayal', 'insult', 'dismissal', 'imprisonment', 'crime', 'scheme_discovered', 'plot', 'refuge_lost', 'story_fracture']);
});

test('a shared favor grounds the argument and adds its own row', () => {
  const state = plain();
  const gift = actionHooks(state).memory('gift', 'En gåva', [REP, NAMAR], { knownBy: [REP, NAMAR] });
  const result = estimate(state, ask(cite(gift)));
  assert.deepEqual(result.groundedArguments, cite(gift));
  assert.equal(row(result, 'En tjänst att minnas'), 5);
  assert.equal(result.value, 45 + 7 + 5);
});

test('a shared grievance grounds nothing and counts against the request', () => {
  const state = plain();
  const hooks = actionHooks(state);
  const betrayal = hooks.memory('betrayal', 'Ett brutet löfte', [REP, NAMAR], { knownBy: [REP, NAMAR] });
  const insult = hooks.memory('insult', 'En förolämpning', [REP, NAMAR], { knownBy: [REP, NAMAR] });
  const dismissal = hooks.memory('dismissal', 'Ett avsked', [REP, NAMAR], { knownBy: [REP, NAMAR] });
  const one = estimate(state, ask(cite(betrayal)));
  assert.deepEqual(one.groundedArguments, []);
  assert.equal(row(one, 'Övertygande argument'), undefined);
  assert.equal(row(one, 'Personen minns ett agg'), -5);
  assert.equal(one.value, 45 - 5);
  assert.equal(row(estimate(state, ask(cite(betrayal, insult, dismissal))), 'Personen minns ett agg'), -10, 'at most −10');
  assert.equal(row(estimate(state, ask(cite(betrayal, betrayal))), 'Personen minns ett agg'), -5, 'one memory counts once');
});

test('a grievance the speaker does not share or know costs nothing', () => {
  const state = plain();
  const hooks = actionHooks(state);
  const unknown = hooks.memory('betrayal', 'Ett brutet löfte', [REP, NAMAR], { knownBy: [REP] });
  const other = hooks.memory('betrayal', 'Ett annat svek', [REP, 'person-2-2'], { knownBy: [REP, 'person-2-2'] });
  assert.equal(estimate(state, ask(cite(unknown, other))).value, 45);
});

test('a neutral memory grounds the argument without a favor row', () => {
  const state = plain();
  const marriage = actionHooks(state).memory('marriage', 'Ett bröllop', [REP, NAMAR], { knownBy: [REP, NAMAR] });
  const result = estimate(state, ask(cite(marriage)));
  assert.equal(result.value, 45 + 7);
  assert.equal(row(result, 'En tjänst att minnas'), undefined);
});

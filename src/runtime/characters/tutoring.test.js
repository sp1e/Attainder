// A tutor whose trait opposes the child's may replace it at adulthood.
// Spec: docs/superpowers/specs/2026-11-09-tutor-trait-correction-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand } from './index.js';
import { CORRECTION_CHANCE, traitCorrection, traitsAtAdulthood } from './tutoring.js';

const CHILD = 'person-0-4';
const MENTOR = 'person-2-0';
const person = (traits) => ({ traits });

test('the correction is the first mentor trait whose opposite the child holds', () => {
  assert.deepEqual(traitCorrection(person(['cruel', 'lazy']), person(['diligent', 'compassionate'])), { from: 'lazy', to: 'diligent' });
  assert.deepEqual(traitCorrection(person(['cruel', 'lazy']), person(['brave', 'compassionate'])), { from: 'cruel', to: 'compassionate' });
  assert.equal(traitCorrection(person(['cruel', 'lazy']), person(['brave', 'calm'])), null);
  assert.equal(traitCorrection(person(['cruel']), person([])), null);
  assert.equal(CORRECTION_CHANCE, 0.6);
});

test('a correction replaces the opposed trait in its place when the draw is below 0.6', () => {
  const child = person(['cruel', 'lazy']), mentor = person(['compassionate', 'greedy']);
  assert.deepEqual(traitsAtAdulthood(child, mentor, 0.5), { traits: ['compassionate', 'lazy'], corrected: { from: 'cruel', to: 'compassionate' } });
  assert.deepEqual(traitsAtAdulthood(child, mentor, 0.1), { traits: ['compassionate', 'lazy'], corrected: { from: 'cruel', to: 'compassionate' } });
  assert.deepEqual(traitsAtAdulthood(person(['cruel', 'compassionate']), mentor, 0.1).traits, ['compassionate'], 'no trait twice');
  assert.equal(traitsAtAdulthood(child, mentor, 0.6), null);
  assert.equal(traitsAtAdulthood(child, mentor, 0.9), null);
});

test('without an opposite the old rule holds: below 0.4 the mentor adds a first trait', () => {
  const child = person(['dutiful', 'ambitious']), mentor = person(['greedy', 'cautious']);
  assert.deepEqual(traitsAtAdulthood(child, mentor, 0.3), { traits: ['dutiful', 'greedy'], corrected: null });
  assert.deepEqual(traitsAtAdulthood(person(['greedy', 'calm']), mentor, 0.3), { traits: ['greedy'], corrected: null });
  assert.equal(traitsAtAdulthood(child, mentor, 0.5), null);
});

function educatedRun(mentorTraits) {
  const state = createCharacterSystem({ seed: 2 });
  state.people[CHILD].traits = ['cruel', 'lazy'];
  state.people[MENTOR].traits = mentorTraits;
  const taught = executeCharacterCommand(state, { id: 'teach', expectedRevision: state.revision, type: 'educate', payload: { childId: CHILD, mentorId: MENTOR, focus: 'learning' } });
  assert.equal(taught.ok, true, taught.error);
  const result = advanceCharacters(taught.state, addGameMonths(taught.state.date, 8 * 12));
  assert.equal(result.ok, true, result.error);
  return { taught, state: result.state };
}

test('the educate event names the prospect of a correction', () => {
  const { taught } = educatedRun(['compassionate', 'greedy']);
  const event = taught.events.find((entry) => entry.title === 'Nästa generation formas');
  assert.match(event.description, /Läraren är medkännande: vid myndigheten byter .+ draget Grym mot Medkännande med 60 % chans\./);
  const plain = educatedRun(['brave', 'calm']).taught.events.find((entry) => entry.title === 'Nästa generation formas');
  assert.doesNotMatch(plain.description, /chans/);
});

test('through the yearly step the correction follows the same draw and draws nothing extra', () => {
  const corrected = educatedRun(['compassionate', 'greedy']).state;
  const control = educatedRun(['brave', 'calm']).state;
  assert.equal(corrected.rngState, control.rngState, 'the main stream advances the same in both runs');
  // Seed 2 draws between 0.4 and 0.6 here: the control keeps its traits and the correction takes.
  assert.deepEqual(control.people[CHILD].traits, ['cruel', 'lazy']);
  assert.deepEqual(corrected.people[CHILD].traits, ['compassionate', 'lazy']);
  const log = corrected.log.find((entry) => entry.type === 'adulthood' && entry.participants?.includes(CHILD));
  assert.match(log.description, /har lagt bort draget Grym och är nu medkännande\./);
});

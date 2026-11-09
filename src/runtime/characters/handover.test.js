// The handover to a new ruler. Spec: docs/superpowers/specs/2026-11-09-reign-handover-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { createCharacterSystem, executeCharacterCommand, getCharacterPresentation } from './index.js';
import { HANDOVER_MONTHS, reignHandover } from './handover.js';

const hooksFor = (state) => ({ ruler: () => state.people[state.offices.ruler.holderId] ?? null });

function abdicated() {
  const start = createCharacterSystem({ seed: 2 });
  const result = executeCharacterCommand(start, { id: 'abdicate', expectedRevision: start.revision, type: 'abdicate', payload: {} });
  assert.equal(result.ok, true, result.error);
  return result.state;
}

test('an abdication hands over from the commander to the diplomat', () => {
  const state = abdicated();
  assert.deepEqual(reignHandover(state, hooksFor(state)), {
    rulerName: 'Sera Arel',
    predecessorName: 'Arel av Hadara',
    monthsLeft: 12,
    archetype: { from: { name: 'Fältherren', ability: 'Samordnad mobilisering' }, to: { name: 'Diplomaten', ability: 'Försoningsråd' } },
    traitsGone: ['Plikttrogen', 'Ambitiös'],
    traitsNew: ['Medkännande', 'Sällskaplig'],
    skills: [{ label: 'Diplomati', from: 4, to: 8 }, { label: 'Intrig', from: 4, to: 7 }, { label: 'Befäl', from: 4, to: 6 }],
  });
  assert.equal(HANDOVER_MONTHS, 12);
});

test('no handover at the campaign start, without a ruler or after the first year', () => {
  const start = createCharacterSystem({ seed: 2 });
  assert.equal(reignHandover(start, hooksFor(start)), null);
  const state = abdicated();
  assert.equal(reignHandover(state, { ruler: () => null }), null);
  state.date = addGameMonths(state.reign.startedAt, 11);
  assert.equal(reignHandover(state, hooksFor(state)).monthsLeft, 1);
  state.date = addGameMonths(state.reign.startedAt, 12);
  assert.equal(reignHandover(state, hooksFor(state)), null);
});

test('a vacancy between the two rulers is skipped and a matching ruler gives nothing', () => {
  const state = abdicated();
  const history = state.offices.ruler.history;
  history.splice(history.length - 1, 0, { personId: null, date: state.date, reason: 'Interregnum' });
  assert.equal(reignHandover(state, hooksFor(state)).predecessorName, 'Arel av Hadara');
  const rulerId = state.reign.rulerId;
  history.splice(history.length - 1, 0, { personId: rulerId, date: state.date, reason: 'Ämbetet upphör när riket upplöses.' });
  assert.equal(reignHandover(state, hooksFor(state)), null, 'the ruler held the throne just before');
  history.splice(history.length - 2, 1);
  const startedAt = state.reign.startedAt;
  state.reign.startedAt = state.date = addGameMonths(startedAt, 2);
  assert.equal(reignHandover(state, hooksFor(state)), null, 'an old save dated its reign record to the day it loaded');
  state.reign.startedAt = state.date = startedAt;
  const before = state.people[history[0].personId], now = state.people[state.reign.rulerId];
  Object.assign(before, { archetype: now.archetype, traits: [...now.traits], skills: { ...now.skills, prowess: now.skills.prowess + 1 } });
  assert.equal(reignHandover(state, hooksFor(state)), null);
});

test('the presentation carries the handover', () => {
  const view = getCharacterPresentation(abdicated());
  assert.equal(view.handover.predecessorName, 'Arel av Hadara');
  assert.equal(getCharacterPresentation(createCharacterSystem({ seed: 2 })).handover, null);
});

// The player sees how close the ruler is to each nickname. Spec: docs/superpowers/specs/2026-11-08-nickname-path-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, createCharacterSystem, getCharacterPresentation } from './index.js';
import { NICKNAMES, nicknameProgress } from './nicknames.js';
import { buildCharacterPromptContext } from '../characterWorld.js';

const RULER = 'person-0-0'; // female
const seasoned = (months) => { const state = createCharacterSystem({ seed: 321 }); state.date = addGameMonths(state.date, months); state.nextAnnualDate = addGameMonths(state.date, 12); return state; };
const progress = (state) => nicknameProgress(state, actionHooks(state));
const rowOf = (path, id) => path.rows.find((row) => row.id === id);

test('every row lists its counts and earns exactly when one count reaches its threshold', () => {
  const thresholds = Object.fromEntries(NICKNAMES.map((row) => [row.id, row.counts.map((count) => [count.label, count.threshold])]));
  assert.deepEqual(thresholds, {
    cruel: [['avrättningar', 2], ['grymma gärningar', 4]],
    great: [['uppnådda regeringsmål', 2], ['ryktbarhet', 40]],
    treacherous: [['svek', 4]],
    generous: [['generösa gärningar', 3]],
    frail: [['sammanbrott', 1]],
    usurper: [['olaglig tronbestigning', 1]],
    quiet: [['månader på tronen', 48]],
  });
  const deeds = { executions: 0, cruel: 0, goalsMet: 0, betrayal: 0, generous: 2, breakdowns: 0 };
  const generous = NICKNAMES.find((row) => row.id === 'generous');
  assert.equal(generous.earned({ deeds, prestige: 0, lawful: true, months: 0 }), false);
  assert.equal(generous.earned({ deeds: { ...deeds, generous: 3 }, prestige: 0, lawful: true, months: 0 }), true);
  assert.equal(NICKNAMES.find((row) => row.id === 'usurper').earned({ deeds, prestige: 0, lawful: false, months: 0 }), true);
});

test('the path counts the reign, names the winner in table order and reads nothing it writes', () => {
  const state = seasoned(30);
  Object.assign(state.reign.deeds, { generous: 2, executions: 2 });
  state.realm.prestige = 39.6;
  const before = JSON.stringify(state);
  const path = progress(state);
  assert.equal(JSON.stringify(state), before);
  assert.equal(path.rulerName, state.people[RULER].name);
  assert.equal(path.adult, true);
  assert.equal(path.monthsLeft, 0);
  assert.equal(path.winnerId, 'cruel');
  assert.deepEqual(rowOf(path, 'generous'), { id: 'generous', label: 'den Givmilda', order: 4,
    counts: [{ label: 'generösa gärningar', value: 2, threshold: 3, binary: false }], share: 2 / 3, earned: false });
  assert.equal(rowOf(path, 'great').counts[1].value, 39, 'prestige rounds down below the threshold');
  assert.equal(rowOf(path, 'great').earned, false);
  assert.equal(rowOf(path, 'usurper').counts[0].binary, true);
  assert.equal(rowOf(path, 'quiet').share, 30 / 48);
  assert.equal(rowOf(path, 'cruel').share, 1);
});

test('a young reign shows the months left, and a named ruler or no ruler shows no path', () => {
  const young = seasoned(10);
  assert.equal(progress(young).monthsLeft, 14);
  assert.equal(progress(young).winnerId, null);
  const named = seasoned(30);
  named.nicknames.push({ personId: RULER, nicknameId: 'quiet', earnedAt: named.date });
  assert.equal(progress(named), null);
  const empty = seasoned(30);
  empty.offices.ruler.holderId = null;
  assert.equal(progress(empty), null);
});

test('a child on the throne gets a path marked as not adult', () => {
  const state = seasoned(30);
  state.people[RULER].bornAt = addGameMonths(state.date, -60);
  const path = progress(state);
  assert.equal(path.adult, false);
  assert.equal(path.rulerName, state.people[RULER].name);
});

test('the presentation carries the path and the model prompt does not', () => {
  const state = seasoned(30);
  state.reign.deeds.generous = 2;
  assert.equal(getCharacterPresentation(state).nicknamePath.rows.length, NICKNAMES.length);
  assert.doesNotMatch(buildCharacterPromptContext(state, {}), /nicknamePath|generösa gärningar/);
});

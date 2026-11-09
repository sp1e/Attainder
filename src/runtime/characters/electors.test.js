// The electors' vote for an elective crown. Spec: docs/superpowers/specs/2026-11-09-elector-votes-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { advanceCharacters, createCharacterSystem, getSuccessionForecast } from './index.js';
import { electorChoice, electorsOf, tallyElection } from './electors.js';

const RULER = 'person-0-0';
const SERA = 'person-0-2';
const ELDER = 'person-0-4';
const YOUNGER = 'person-0-5';
const ELECTORS = ['person-1-0', 'person-1-2', 'person-2-0', 'person-2-2', 'person-3-0'];

// Hadara under the elective law. With `grown`, Sera's two children are adults, so the house has three adults on the ballot.
function court({ grown = false } = {}) {
  const state = createCharacterSystem({ seed: 321 });
  state.realm.successionLaw = 'elective';
  if (grown) for (const id of [ELDER, YOUNGER]) state.people[id].bornAt = addGameMonths(state.date, -20 * 12);
  return state;
}
function grudge(state, fromId, toId, amount) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  state.relations[key].causes.push({ id: `fixture-${fromId}`, amount, label: 'Prov', causeId: `fixture-${fromId}-${toId}`, startAt: state.date, expiresAt: null });
}
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState, s.sequence];

test('the electors are the council and the heads of the houses at home, never the old ruler', () => {
  const state = court();
  assert.deepEqual(electorsOf(state, state.people[RULER]).map((p) => p.id), ELECTORS);
  state.families['family-safra'].exiled = true;
  state.people['person-1-2'].bornAt = addGameMonths(state.date, -10 * 12);
  assert.deepEqual(electorsOf(state, state.people[RULER]).map((p) => p.id), ['person-1-0', 'person-2-0', 'person-2-2']);
});

test('an elector backs merit plus a fifth of opinion, the earlier on a tie, and a candidate backs themself', () => {
  const ballot = [{ id: 'a' }, { id: 'b' }];
  const score = (c) => (c.id === 'a' ? 10 : 12);
  assert.equal(electorChoice({ id: 'x' }, ballot, score, () => 0), 'b');
  assert.equal(electorChoice({ id: 'x' }, ballot, score, (from, to) => (to === 'a' ? 10 : 0)), 'a', 'a tie of 12 goes to the earlier');
  assert.equal(electorChoice({ id: 'a' }, ballot, score, () => 0), 'a');
});

test('the house adults stand; a house of minors passes without a vote; with the house gone the outsiders stand', () => {
  const state = court(), ruler = state.people[RULER], people = (ids) => ids.map((id) => state.people[id]);
  const score = () => 0, opinion = () => 0;
  const kin = tallyElection(state, ruler, { adults: people([SERA]), minors: people([ELDER]), others: people(['person-1-0']) }, score, opinion);
  assert.deepEqual([kin.ballot.map((c) => c.id), kin.winnerId, kin.votes.length], [[SERA], SERA, 5]);
  const minors = tallyElection(state, ruler, { adults: [], minors: people([ELDER]), others: people(['person-1-0']) }, score, opinion);
  assert.deepEqual([minors.ballot, minors.winnerId, minors.votes], [[], null, []]);
  const outsiders = tallyElection(state, ruler, { adults: [], minors: [], others: people(['person-1-0', 'person-2-0', 'person-3-0', 'person-1-2']) }, score, opinion);
  assert.deepEqual([outsiders.ballot.map((c) => c.id), outsiders.winnerId], [['person-1-0', 'person-2-0', 'person-3-0'], 'person-1-0']);
});

test('a tie in votes goes to the earlier candidate, and a candidate who is an elector votes for themself', () => {
  const state = court(), ruler = state.people[RULER], people = (ids) => ids.map((id) => state.people[id]);
  // person-1-0 and person-2-0 stand and back themselves; the other three electors split two to one by opinion.
  const opinion = (from, to) => ((from === 'person-3-0' || from === 'person-1-2') === (to === 'person-2-0') ? 50 : 0);
  const tally = tallyElection(state, ruler, { adults: people(['person-1-0', 'person-2-0']), minors: [], others: [] }, () => 0, opinion);
  assert.deepEqual(tally.ballot, [{ id: 'person-1-0', votes: 2 }, { id: 'person-2-0', votes: 3 }]);
  assert.equal(tally.winnerId, 'person-2-0');
  const even = tallyElection(state, ruler, { adults: people(['person-1-0', 'person-2-0']), minors: [], others: [] }, () => 0, (from, to) => (from === 'person-1-2' && to === 'person-2-0' ? 50 : 0));
  assert.deepEqual([even.ballot.map((c) => c.votes), even.winnerId], [[3, 2], 'person-1-0']);
  const tied = tallyElection({ ...state, families: {}, offices: { ...state.offices, chancellor: { holderId: null }, general: { holderId: 'person-1-0' }, spymaster: { holderId: 'person-2-0' } } }, ruler, { adults: people(['person-1-0', 'person-2-0']), minors: [], others: [] }, () => 0, () => 0);
  assert.deepEqual([tied.ballot.map((c) => c.votes), tied.winnerId], [[1, 1], 'person-1-0']);
});

test('the electors follow merit, and turning them against the favourite crowns the next', () => {
  const state = court({ grown: true });
  const forecast = getSuccessionForecast(state);
  assert.deepEqual(forecast.election.candidates.map((c) => [c.id, c.votesLabel]), [[YOUNGER, 'leder'], [SERA, 'ligger efter'], [ELDER, 'ligger efter']]);
  assert.equal(forecast.expectedRuler.id, YOUNGER);
  for (const id of ELECTORS) grudge(state, id, YOUNGER, -30);
  assert.equal(getSuccessionForecast(state).expectedRuler.id, SERA);
  state.people[RULER].health = 0;
  const after = advanceCharacters(state, addGameMonths(state.date, 12), { id: 'elector-death' }).state;
  assert.equal(after.offices.ruler.holderId, SERA);
});

test('the reader sees who leads at three bands, the votes at five and every elector at exact', () => {
  const state = court({ grown: true });
  const election = (intrigue) => { state.people[RULER].skills.intrigue = intrigue; return getSuccessionForecast(state).election; };
  assert.deepEqual([election(0).precision, election(0).electors], ['three', []]);
  const five = election(14);
  assert.deepEqual([five.precision, five.candidates[0].votesLabel, five.electors], ['five', '5 av 5 röster', []]);
  const exact = election(24);
  assert.equal(exact.precision, 'exact');
  assert.deepEqual(exact.electors.map((e) => [e.id, e.candidateName]), ELECTORS.map((id) => [id, state.people[YOUNGER].name]));
});

test('the forecast of a vote draws nothing and takes no id', () => {
  const state = court({ grown: true });
  const before = streams(state);
  getSuccessionForecast(state);
  assert.deepEqual(streams(state), before);
  assert.equal(getSuccessionForecast(court()).election.candidates.length, 1, 'one house adult stands alone');
  state.realm.successionLaw = 'primogeniture';
  assert.equal(getSuccessionForecast(state).election, null);
});

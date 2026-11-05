import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { NICKNAMES, nicknameOf, nicknameStep, validateNicknames } from './nicknames.js';

const RULER = 'person-0-0'; // Arel av Hadara, female
const HEIR = 'person-0-2'; // Sera Arel, female
const TAREK = 'person-0-3'; // male
const CHILD = 'person-0-4'; // ten years old at the start

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => createCharacterSystem({ seed: 321, ...options });
let counter = 0;
const run = (state, type, payload = {}, origin) => executeCharacterCommand(state, { id: `nickname-command-${++counter}`, expectedRevision: state.revision, type, payload, origin });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
// A campaign `months` into the first reign. Only the date moves, so nothing but the step under test can write.
const seasoned = (months, options) => { const state = base(options); state.date = addGameMonths(state.date, months); state.nextAnnualDate = addGameMonths(state.date, 12); return state; };
const step = (state, events = []) => { nicknameStep(state, events, actionHooks(state)); return events; };
const earned = (state) => state.nicknames[0]?.nicknameId ?? null;
const view = (state, id) => getCharacterPresentation(state).people.find((person) => person.id === id);

test('the nickname follows the table in order', () => {
  const everything = (state) => {
    Object.assign(state.reign.deeds, { executions: 2, cruel: 4, goalsMet: 2, betrayal: 4, generous: 3, breakdowns: 1 });
    state.realm.prestige = 40;
    state.reign.lawful = false;
  };
  // Each row takes the winner of the row above one step below its threshold, so the next row wins.
  const fallback = [
    ['cruel', () => {}],
    ['great', (state) => { state.reign.deeds.executions = 1; state.reign.deeds.cruel = 3; }],
    ['treacherous', (state) => { state.reign.deeds.goalsMet = 1; state.realm.prestige = 39; }],
    ['generous', (state) => { state.reign.deeds.betrayal = 3; }],
    ['frail', (state) => { state.reign.deeds.generous = 2; }],
    ['usurper', (state) => { state.reign.deeds.breakdowns = 0; }],
    ['quiet', (state) => { state.reign.lawful = true; }],
  ];
  const state = seasoned(48);
  everything(state);
  for (const [id, lower] of fallback) {
    lower(state);
    state.nicknames = [];
    step(state);
    assert.equal(earned(state), id);
  }
  // With every row one step short, 47 months earn nothing.
  const short = seasoned(47);
  everything(short);
  for (const [, lower] of fallback) lower(short);
  step(short);
  assert.equal(earned(short), null);
});

test('either condition of a row is enough', () => {
  const rows = [
    ['cruel', (state) => { state.reign.deeds.executions = 2; }],
    ['cruel', (state) => { state.reign.deeds.cruel = 4; }],
    ['great', (state) => { state.reign.deeds.goalsMet = 2; }],
    ['great', (state) => { state.realm.prestige = 40; }],
  ];
  for (const [id, arrange] of rows) {
    const state = seasoned(24);
    arrange(state);
    step(state);
    assert.equal(earned(state), id);
  }
});

test('a nickname waits for 24 reign months and for an adult on the throne', () => {
  const early = seasoned(23);
  early.reign.lawful = false;
  assert.deepEqual(step(early), []);
  assert.deepEqual(early.nicknames, []);
  const due = seasoned(24);
  due.reign.lawful = false;
  assert.equal(step(due).length, 1);
  assert.equal(earned(due), 'usurper');
  // The months count from the accession, not from the start of the campaign.
  const heir = seasoned(36), hooks = actionHooks(heir);
  hooks.crown(heir.people[HEIR], [], 'Ett prov', 40, false);
  assert.deepEqual(step(heir), []);
  heir.date = addGameMonths(heir.date, 24);
  step(heir);
  assert.deepEqual(heir.nicknames, [{ personId: HEIR, nicknameId: 'usurper', earnedAt: heir.date }]);
  // A child can reign for years and earns no name before she comes of age.
  const child = base();
  actionHooks(child).crown(child.people[CHILD], [], 'Ett prov', 40, false);
  child.date = addGameMonths(child.date, 24);
  assert.deepEqual(step(child), []);
  assert.deepEqual(child.nicknames, []);
});

test("the nickname matches the ruler's sex", () => {
  const forms = {
    cruel: ['den Grymma', 'den Grymme'],
    great: ['den Stora', 'den Store'],
    treacherous: ['den Lömska', 'den Lömske'],
    generous: ['den Givmilda', 'den Givmilde'],
    frail: ['den Bräckliga', 'den Bräcklige'],
    usurper: ['Tronrövaren', 'Tronrövaren'],
    quiet: ['den Stillsamma', 'den Stillsamme'],
  };
  assert.deepEqual(NICKNAMES.map((row) => row.id), Object.keys(forms));
  for (const [id, [female, male]] of Object.entries(forms)) {
    const state = base();
    state.nicknames.push({ personId: RULER, nicknameId: id, earnedAt: state.date }, { personId: TAREK, nicknameId: id, earnedAt: state.date });
    assert.equal(nicknameOf(state, RULER), female, id);
    assert.equal(nicknameOf(state, TAREK), male, id);
  }
  // The chronicle uses the same form.
  const queen = seasoned(24);
  queen.reign.deeds.cruel = 4;
  assert.equal(step(queen)[0].title, 'Arel av Hadara kallas nu den Grymma');
  const king = base();
  actionHooks(king).crown(king.people[TAREK], [], 'Ett prov', 55, true);
  king.reign.deeds.cruel = 4;
  king.date = addGameMonths(king.date, 24);
  assert.equal(step(king)[0].title, 'Tarek Arel kallas nu den Grymme');
});

test('a nickname is earned once and survives the ruler\'s death', () => {
  const state = seasoned(24), hooks = actionHooks(state);
  state.reign.deeds.generous = 3;
  const [event, ...rest] = step(state);
  assert.deepEqual(rest, []);
  assert.equal(event.public, true);
  assert.deepEqual(event.participants, [RULER]);
  assert.ok(state.log.some((entry) => entry.id === event.id), 'the chronicle keeps the event');
  const note = state.memories.find((item) => item.title === 'Arel av Hadara kallas nu den Givmilda');
  assert.ok(note, 'the realm remembers the name');
  assert.deepEqual(note.participants, [RULER]);
  assert.deepEqual(state.nicknames, [{ personId: RULER, nicknameId: 'generous', earnedAt: state.date }]);
  // Worse deeds later change nothing, and the step stays silent.
  state.reign.deeds.executions = 9;
  state.date = addGameMonths(state.date, 12);
  assert.deepEqual(step(state), []);
  assert.equal(state.nicknames.length, 1);
  assert.equal(nicknameOf(state, RULER), 'den Givmilda');
  hooks.kill([RULER], [], 'Ett prov');
  assert.ok(state.people[RULER].diedAt);
  assert.equal(nicknameOf(state, RULER), 'den Givmilda');
  assert.equal(view(state, RULER).nickname, 'den Givmilda');
  // The successor starts with no name of her own.
  const successor = state.reign.rulerId;
  assert.notEqual(successor, RULER);
  assert.equal(nicknameOf(state, successor), null);
  assert.equal(view(state, successor).nickname, null);
});

test('a ruler who returns to the throne keeps the name she earned', () => {
  const state = seasoned(24), hooks = actionHooks(state);
  state.reign.deeds.generous = 3;
  step(state);
  hooks.crown(state.people[HEIR], [], 'Ett prov');
  hooks.crown(state.people[RULER], [], 'Ett prov', 40, false);
  state.date = addGameMonths(state.date, 24);
  assert.deepEqual(step(state), []);
  assert.equal(nicknameOf(state, RULER), 'den Givmilda');
});

test('nothing is drawn, and a person without a nickname reads null', () => {
  const state = seasoned(24);
  state.reign.lawful = false;
  const { rngState, actionRngState, plotRngState } = state;
  step(state);
  assert.deepEqual([state.rngState, state.actionRngState, state.plotRngState], [rngState, actionRngState, plotRngState]);
  assert.equal(nicknameOf(state, HEIR), null);
  assert.equal(nicknameOf(state, 'person-9-9'), null);
});

test('forged nickname records are rejected', () => {
  const MESSAGE = /^Ett tillnamn i sparfilen är ogiltigt\.$/;
  const record = (state) => ({ personId: RULER, nicknameId: 'great', earnedAt: state.date });
  const forgeries = {
    'null as record': () => [null],
    'list as record': () => [[]],
    'text as record': () => ['den Store'],
    'unknown person': (r) => [{ ...r, personId: 'person-9-9' }],
    'prototype key as person': (r) => [{ ...r, personId: 'constructor' }],
    'number as person': (r) => [{ ...r, personId: 7 }],
    'list as person': (r) => [{ ...r, personId: [r.personId] }],
    'a nickname the table does not hold': (r) => [{ ...r, nicknameId: 'immortal' }],
    'a label as nickname id': (r) => [{ ...r, nicknameId: 'den Store' }],
    'prototype key as nickname': (r) => [{ ...r, nicknameId: 'constructor' }],
    'null as nickname': (r) => [{ ...r, nicknameId: null }],
    'date that is not canonical': (r) => [{ ...r, earnedAt: '-300-1-1' }],
    'number as date': (r) => [{ ...r, earnedAt: 300 }],
    'date after today': (r) => [{ ...r, earnedAt: addGameMonths(r.earnedAt, 1) }],
    'a person field missing': ({ nicknameId, earnedAt }) => [{ nicknameId, earnedAt }],
    'a date field missing': ({ personId, nicknameId }) => [{ personId, nicknameId }],
    'an invented label': (r) => [{ ...r, label: 'den Odödlige' }],
    'two names for one person': (r) => [r, { ...r, nicknameId: 'quiet' }],
  };
  for (const [name, forge] of Object.entries(forgeries)) {
    const raw = plain(base());
    raw.nicknames = forge(record(raw));
    assert.throws(() => normalizeCharacterSystem(raw), { name: 'Error', message: MESSAGE }, name);
    assert.throws(() => validateNicknames(raw), { name: 'Error', message: MESSAGE }, name);
  }
});

test('a save with honest nicknames loads, also for the dead', () => {
  const state = seasoned(24);
  state.reign.lawful = false;
  step(state);
  actionHooks(state).kill([RULER], [], 'Ett prov');
  const loaded = normalizeCharacterSystem(plain(state));
  assert.deepEqual(loaded.nicknames, [{ personId: RULER, nicknameId: 'usurper', earnedAt: state.date }]);
  assert.equal(nicknameOf(loaded, RULER), 'Tronrövaren');
});

test('a command payload cannot set a nickname', () => {
  const state = base();
  const forged = { nickname: 'den Store', nicknameId: 'great', personId: RULER, nicknames: [{ personId: RULER, nicknameId: 'great', earnedAt: state.date }] };
  const goal = ok(run(state, 'set_reign_goal', { goalType: 'strong_army', ...forged }));
  assert.deepEqual(goal.nicknames, []);
  assert.equal(view(goal, RULER).nickname, null);
  const effect = ok(run(state, 'realm_effect', { legitimacy: 1, reason: 'Ett prov.', ...forged }, 'gate'));
  assert.deepEqual(effect.nicknames, []);
  for (const type of ['set_nickname', 'grant_nickname', 'nickname']) {
    const refused = run(state, type, forged);
    assert.equal(refused.ok, false, type);
    assert.equal(refused.error, 'Okänd karaktärshandling.', type);
  }
});

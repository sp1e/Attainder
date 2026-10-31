import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { createCharacterSystem, getCharacterPresentation, canCharacterDirectRealm } from './index.js';
import { ensureEventChains, validateEventChains, scheduleEventChain, refreshEventChains, eventChainChoices, resolveEventChain, getEventChainDates, presentEventChain } from './eventChains.js';

function setup() {
  const state = createCharacterSystem({ seed: 321 }); ensureEventChains(state);
  for (const city of Object.values(state.cities)) city.unrest = 0;
  state.people['person-0-4'].mentorId = 'person-1-1';
  return state;
}
function context(state) {
  return { opinion: () => 0, related: () => false, forScope: (scope) => {
    const view = getCharacterPresentation(state);
    const id = scope === 'public' ? view.authority.royal.representativeId : view.authority.household.representativeId;
    return { actor: state.people[id], family: state.families[view.identity.familyId], canRule: canCharacterDirectRealm(state), stress: () => 0 };
  } };
}
function hooks(state) {
  return { emit: () => {}, memory: (type, title, participants, options) => {
    const m = { id: `chain-test-memory-${++state.sequence}`, type, title, participants, date: state.date, knownBy: 'public', ...options };
    state.memories.push(m); return m;
  }, opinion: (from, to, amount, title, causeId) => {
    const key = `${from}:${to}`; state.relations[key] ||= { fromId: from, toId: to, bonds: [], causes: [] };
    state.relations[key].causes.push({ amount, title, causeId });
  }, spend: (amount, pub) => {
    const c = context(state).forScope(pub ? 'public' : 'family'); const wallet = pub ? state.realm : c.family;
    assert.ok(c.actor); assert.ok(wallet.treasury >= amount); wallet.treasury -= amount; return c.actor;
  } };
}
function start(state) { const story = scheduleEventChain(state, [], context(state), hooks(state)); assert.ok(story); assert.equal(state.eventChains.records[0].templateId, 'heir_margin'); return story; }
function choose(state, story, id) { resolveEventChain(state, story, id, [], context(state), hooks(state)); validateEventChains(state); }
function progress(state, date) { state.date = date; refreshEventChains(state, [], context(state), hooks(state)); validateEventChains(state); return state.stories.filter((s) => s.type === 'event_chain').at(-1); }

test('chain activation is neutral, saved, and does not consume existing random streams', () => {
  const raw = createCharacterSystem({ seed: 321 }); delete raw.eventChains; const before = structuredClone(raw);
  ensureEventChains(raw); validateEventChains(raw);
  const { eventChains, ...unchanged } = raw;
  assert.deepEqual(unchanged, before); assert.equal(eventChains.records.length, 0);
  const copy = structuredClone(raw); ensureEventChains(raw); assert.deepEqual(raw, copy);
  raw.eventChains.version = 2; assert.throws(() => validateEventChains(raw));
});

test('a paid choice has one causal memory and a distinct dated continuation', () => {
  const state = setup(), first = start(state), before = state.families['family-arel'].treasury, publicBefore = state.realm.treasury;
  choose(state, first, 'extra_lessons');
  assert.equal(state.families['family-arel'].treasury, before - 18); assert.equal(state.realm.treasury, publicBefore);
  const due = addGameMonths(state.date, 3); assert.deepEqual(getEventChainDates(state), [due]);
  const after = structuredClone(state); assert.throws(() => choose(state, first, 'extra_lessons')); assert.deepEqual(state, after);
  const next = progress(state, due); assert.notEqual(next.id, first.id); assert.equal(next.chainId, first.chainId);
  assert.equal(next.causeId, first.outcomeMemoryId); assert.match(next.description, /extra lektionerna/);
  assert.equal(presentEventChain(state, next).previousChoices.length, 1);
});

test('unaffordable choices leave costs, memories and scheduled work untouched', () => {
  const state = setup(), story = start(state); state.families['family-arel'].treasury = 0;
  const before = structuredClone(state);
  assert.match(eventChainChoices(state, story, context(state))[0].disabledReason, /medel/);
  assert.throws(() => choose(state, story, 'extra_lessons')); assert.deepEqual(state, before);
  choose(state, story, 'close'); assert.equal(state.eventChains.records[0].status, 'closed'); assert.equal(state.families['family-arel'].treasury, 0);
});

test('a new household decision maker cannot rewrite the previous participants or decision', () => {
  const state = setup(), first = start(state); choose(state, first, 'hear_question');
  const original = structuredClone(state.memories.find((m) => m.id === first.outcomeMemoryId));
  state.families['family-arel'].headId = 'person-0-2';
  const next = progress(state, state.eventChains.records[0].nextAt);
  choose(state, next, 'support_child');
  assert.equal(next.decisionActorId, 'person-0-2'); assert.equal(first.decisionActorId, 'person-0-0');
  assert.deepEqual(state.memories.find((m) => m.id === first.outcomeMemoryId), original);
});

test('causality survives newer memories and JSON resume without a new random draw', () => {
  const state = setup(), first = start(state); choose(state, first, 'extra_lessons');
  for (let n = 0; n < 1001; n++) state.memories.push({ id: `later-${n}`, type: 'note', date: state.date, title: 'Senare anteckning', participants: [], knownBy: 'public' });
  const saved = JSON.parse(JSON.stringify(state)), rng = state.eventChains.rngState;
  const a = progress(state, state.eventChains.records[0].nextAt), b = progress(saved, saved.eventChains.records[0].nextAt);
  assert.deepEqual(a, b); assert.deepEqual(state, saved); assert.equal(state.eventChains.rngState, rng);
  assert.ok(state.memories.some((m) => m.id === a.causeId));
  const snapshot = structuredClone(state); eventChainChoices(state, a, context(state)); presentEventChain(state, a); validateEventChains(state); assert.deepEqual(state, snapshot);
});

test('participant death closes the pending continuation without choosing for an heir', () => {
  const state = setup(), first = start(state); choose(state, first, 'extra_lessons');
  state.people['person-0-4'].diedAt = state.date;
  const before = state.families['family-arel'].treasury; progress(state, addGameMonths(state.date, 1));
  assert.equal(state.eventChains.records[0].status, 'closed'); assert.equal(state.eventChains.records[0].stepIds.length, 1);
  assert.equal(state.families['family-arel'].treasury, before); assert.equal(first.choiceId, 'extra_lessons');
  assert.equal(state.eventChains.records[0].roles.child, 'person-0-4');
});

test('deadline expiration closes an unanswered chain without a hidden choice or debit', () => {
  const state = setup(), first = start(state), money = state.families['family-arel'].treasury, memories = state.memories.length;
  progress(state, first.dueAt);
  assert.equal(first.status, 'closed'); assert.equal(first.choiceId, undefined); assert.equal(state.memories.length, memories);
  assert.equal(state.families['family-arel'].treasury, money); assert.equal(state.eventChains.records[0].status, 'closed');
});

test('forged branch flags, broken causes and a missing cast are rejected on load', () => {
  const state = setup(), story = start(state); choose(state, story, 'extra_lessons');
  for (const mutate of [
    (s) => { s.eventChains.records[0].flags.opening = 'heard'; },
    (s) => { s.stories.find((item) => item.id === story.id).causeId = 'missing'; },
    (s) => { delete s.eventChains.records[0].roles.mentor; },
    (s) => { s.eventChains.records[0].nextAt = addGameMonths(s.date, 1); },
  ]) { const invalid = structuredClone(state); mutate(invalid); assert.throws(() => validateEventChains(invalid)); }
});

test('origin cause, step family and outcome memory are checked on load', () => {
  const state = setup(), story = start(state); choose(state, story, 'extra_lessons');
  const record = state.eventChains.records[0];
  const stranger = state.memories.find((m) => m.id !== record.sourceMemoryId && m.id !== record.originMemoryId);
  assert.ok(stranger, 'the fixture needs a memory that is neither the source nor the origin');
  const outcome = (s) => s.memories.find((m) => m.id === story.outcomeMemoryId);
  for (const [label, mutate, message] of [
    ['step cause points at an unrelated memory', (s) => { s.stories.find((item) => item.id === story.id).causeId = stranger.id; }, /stegordning eller tidpunkt är ogiltig/],
    ['origin memory cause differs from the chain source', (s) => { s.memories.find((m) => m.id === record.originMemoryId).causeId = stranger.id; }, /ursprungsminne pekar på en annan orsak/],
    ['step family differs from the chain owner', (s) => { s.stories.find((item) => item.id === story.id).familyId = 'family-namar'; }, /tillhör inte kedjans ägarfamilj/],
    ['outcome participants were emptied', (s) => { outcome(s).participants = []; }, /minne har fel deltagare/],
    ['outcome participants gained an outsider', (s) => { outcome(s).participants = [...outcome(s).participants, 'person-2-0']; }, /minne har fel deltagare/],
    ['outcome participants repeat a cast member', (s) => { outcome(s).participants = [...outcome(s).participants, outcome(s).participants[0]]; }, /samma deltagare mer än en gång/],
    ['outcome memory was made private', (s) => { outcome(s).knownBy = [story.decisionActorId]; }, /minne är inte offentligt/],
  ]) { const invalid = structuredClone(state); mutate(invalid); assert.throws(() => validateEventChains(invalid), { name: 'Error', message }, label); }
  validateEventChains(structuredClone(state));
});

test('a family letter origin must name its patronage memory as cause', () => {
  // family_letter is the only template with a source memory, so only it reaches a non-null origin cause.
  const state = createCharacterSystem({ seed: 321 }); ensureEventChains(state);
  for (const city of Object.values(state.cities)) city.unrest = 0;
  assert.equal(state.families['family-arel'].headId, 'person-0-0');
  state.people['person-0-1'].diedAt = state.date;
  state.memories.push({ id: 'memory-patronage', type: 'story_patronage', title: 'Templets beskydd', participants: ['person-0-1', 'person-0-2'],
    date: state.date, causeId: null, knownBy: 'public' });
  // heir_margin is a candidate too (person-0-4 keeps the default mentor). The seeded draw picks the letter; the next assertion pins it.
  assert.ok(scheduleEventChain(state, [], context(state), hooks(state)));
  const record = state.eventChains.records[0];
  assert.equal(record.templateId, 'family_letter');
  assert.equal(record.sourceMemoryId, 'memory-patronage');
  assert.equal(state.memories.find((m) => m.id === record.originMemoryId).causeId, 'memory-patronage');
  validateEventChains(state);
  for (const [label, cause] of [['no cause', null], ['the origin itself', record.originMemoryId], ['a missing memory', 'memory-missing']]) {
    const invalid = structuredClone(state);
    invalid.memories.find((m) => m.id === record.originMemoryId).causeId = cause;
    assert.throws(() => validateEventChains(invalid), { name: 'Error', message: /ursprungsminne/ }, label);
  }
});

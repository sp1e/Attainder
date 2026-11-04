import test from 'node:test';
import assert from 'node:assert/strict';
import { setRuntimeAssetEndpoints } from '../assets.js';
import { commitCharacterCampaign } from '../characterRuntime.js';
import { applyCharacterOpsToWorld } from '../characterWorld.js';
import { addGameMonths } from '../gameDates.js';
import { normalizeWorldState } from '../gameState.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { ensureEventChains, resolveEventChain } from './eventChains.js';

// docs/design/event-chains.md: actual historical roles remain bound across steps,
// the same source cannot start a second chain, and each step is a separate story.
// The forgeries go through normalizeCharacterSystem, the load path every stored world takes.
const FAMILY = 'family-arel';
let sequence = 0;
const load = (state) => normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
function advance(state, date, id) {
  const result = advanceCharacters(state, date, { id: `history-${id}-${++sequence}` });
  assert.equal(result.ok, true, result.error);
  return result.state;
}
function send(state, type, payload) {
  const result = executeCharacterCommand(state, { id: `history-command-${++sequence}`, type, expectedRevision: state.revision, payload });
  assert.equal(result.ok, true, result.error);
  return result.state;
}
const answer = (state, storyId, choiceId) => send(state, 'resolve_story', { storyId, choiceId });
const story = (state, id) => state.stories.find((item) => item.id === id);
const memory = (state, id) => state.memories.find((item) => item.id === id);
// Calm cities and a single mentor: the first anniversary can only cast this chain.
function heirChain() {
  const initial = createCharacterSystem({ seed: 321 }); ensureEventChains(initial);
  for (const city of Object.values(initial.cities)) city.unrest = 0;
  for (const person of Object.values(initial.people)) person.mentorId = null;
  initial.people['person-0-4'].mentorId = 'person-1-1';
  const state = advance(initial, addGameMonths(initial.date, 12), 'open');
  assert.equal(state.eventChains.records[0].templateId, 'heir_margin');
  return state;
}
// chain-1 has one decided step and an open one. chain-2 was cast at the next anniversary.
function twoChains() {
  const answered = structuredClone(answer(heirChain(), 'chain-1-step-1', 'hear_question'));
  answered.cities.hadara.unrest = 40;
  const state = advance(answered, addGameMonths(answered.date, 12), 'second');
  assert.deepEqual(state.eventChains.records.map((record) => [record.templateId, record.status]), [['heir_margin', 'open'], ['temple_steps', 'open']]);
  return state;
}
const swapRoles = (state) => { const { roles } = state.eventChains.records[0]; [roles.child, roles.mentor] = [roles.mentor, roles.child]; };
const dropChain = (state, index) => {
  const [record] = state.eventChains.records.splice(index, 1);
  state.stories = state.stories.filter((item) => !record.stepIds.includes(item.id));
  return record;
};

const ORIGIN = /Kedjans ursprung saknas/, IDENTITY = /ogiltig identitet eller historik/, CAST = /rollbesättning är ogiltig/, PERSON = /saknar sin historiska person/;
const FAMILIES = /bytt sin historiska familj/, SOURCE = /källa stämmer inte/, REPEATED_STEP = /förekommer mer än en gång/, ACTOR = /utanför rollbesättningen/, MEMORIES = /kedjeminne saknar sin kedja/, MISSING = /saknas i historiken/;
const FORGERIES = [
  ['two roles swapped', swapRoles, ORIGIN],
  ['two roles swapped with their families', (state) => {
    swapRoles(state);
    const { roleFamilies } = state.eventChains.records[0];
    [roleFamilies.child, roleFamilies.mentor] = [roleFamilies.mentor, roleFamilies.child];
  }, ORIGIN],
  ['a role given to a stranger', (state) => { state.eventChains.records[0].roles.mentor = 'person-2-1'; }, ORIGIN],
  ['a role and the origin memory rewritten together', (state) => {
    const record = state.eventChains.records[1];
    record.roles.religiousLeader = 'person-2-0';
    memory(state, record.originMemoryId).participants = [record.roles.governor, 'person-2-0'];
  }, SOURCE],
  ['a role dropped', (state) => { delete state.eventChains.records[0].roles.mentor; }, CAST],
  ['a role invented', (state) => { state.eventChains.records[0].roles.witness = 'person-2-1'; }, CAST],
  ['one person in two roles', (state) => { const { roles } = state.eventChains.records[0]; roles.mentor = roles.child; }, CAST],
  ['a role naming a missing person', (state) => { state.eventChains.records[0].roles.mentor = 'person-missing'; }, PERSON],
  ['a role family removed', (state) => { delete state.eventChains.records[0].roleFamilies.mentor; }, PERSON],
  ['a role family rewritten', (state) => { state.eventChains.records[0].roleFamilies.mentor = 'family-safra'; }, FAMILIES],
  ['the families of two roles swapped', (state) => {
    const { roleFamilies } = state.eventChains.records[0];
    [roleFamilies.child, roleFamilies.mentor] = [roleFamilies.mentor, roleFamilies.child];
  }, FAMILIES],
  ['a source key renamed with its origin memory', (state) => {
    const record = state.eventChains.records[0];
    record.sourceKey = `education:person-0-4:person-1-1:again`;
    memory(state, record.originMemoryId).sourceKey = record.sourceKey;
  }, SOURCE],
  ['an institution rewritten', (state) => { state.eventChains.records[1].refs.cityId = 'narim'; }, SOURCE],
  ['a second chain on a spent source', (state) => {
    const [first, second] = state.eventChains.records;
    second.sourceKey = first.sourceKey;
    memory(state, second.originMemoryId).sourceKey = first.sourceKey;
  }, IDENTITY],
  ['a chain deleted with its steps', (state) => { dropChain(state, 0); }, MISSING],
  ['a chain deleted with its steps and memories', (state) => {
    const record = dropChain(state, 1);
    state.memories = state.memories.filter((item) => item.id !== record.originMemoryId);
  }, MISSING],
  ['a step story repeated', (state) => { state.stories.push({ ...story(state, 'chain-1-step-2') }); }, REPEATED_STEP],
  ['a step id taken by another story', (state) => { state.stories.push({ ...story(state, 'chain-1-step-2'), type: 'legacy_claim' }); }, REPEATED_STEP],
  ['a step without a chain', (state) => { state.stories.push({ ...story(state, 'chain-1-step-2'), id: 'chain-3-step-1', chainId: 'chain-3' }); }, /saknar kedja/],
  ['a step claimed by a second chain', (state) => { state.eventChains.records[1].stepIds.push('chain-1-step-2'); }, /stegordning eller tidpunkt/],
  ['a step actor outside the cast', (state) => { story(state, 'chain-1-step-2').actorId = 'person-2-1'; }, ACTOR],
  ['a second origin memory', (state) => { const { originMemoryId } = state.eventChains.records[0]; state.memories.push({ ...memory(state, originMemoryId), id: 'memory-forged' }); }, MEMORIES],
  ['an origin memory without a chain', (state) => { const { originMemoryId } = state.eventChains.records[0]; state.memories.push({ ...memory(state, originMemoryId), id: 'memory-forged', chainId: 'chain-9' }); }, MEMORIES],
  ['a second choice memory', (state) => { const { outcomeMemoryId } = story(state, 'chain-1-step-1'); state.memories.push({ ...memory(state, outcomeMemoryId), id: 'memory-forged' }); }, MEMORIES],
];

test('the forgery fixture loads unchanged before any edit', () => {
  const state = twoChains();
  assert.deepEqual(load(state), state);
});

for (const [label, forge, message] of FORGERIES) {
  test(`a save with ${label} does not load`, () => {
    const forged = twoChains();
    forge(forged);
    assert.throws(() => load(forged), { name: 'Error', message });
  });
}

test('a chain keeps its cast, source and earlier history while the decision maker changes', () => {
  const opened = heirChain();
  const bound = ({ eventChains: { records: [record] } }) => {
    const { id, templateId, ownerFamilyId, roles, roleFamilies, refs, sourceKey, sourceMemoryId, originMemoryId, createdAt } = record;
    return { id, templateId, ownerFamilyId, roles, roleFamilies, refs, sourceKey, sourceMemoryId, originMemoryId, createdAt };
  };
  let state = opened;
  for (const choiceId of ['hear_question', 'support_child', 'recognize_effort', 'thank_child']) {
    const before = state, answered = load(answer(before, before.eventChains.records[0].stepIds.at(-1), choiceId));
    const decided = answered.eventChains.records[0].stepIds.map((id) => story(answered, id));
    if (choiceId === 'recognize_effort') answered.people['person-0-0'].health = 0;
    state = answered.eventChains.records[0].nextAt ? load(advance(answered, answered.eventChains.records[0].nextAt, 'walk')) : answered;
    assert.deepEqual(bound(state), bound(opened), choiceId);
    assert.deepEqual(decided.map((item) => story(state, item.id)), decided, `${choiceId}: decided steps stay as they were`);
    assert.deepEqual(state.memories.slice(0, before.memories.length), before.memories, `${choiceId}: memories are only appended`);
  }
  const { stepIds, status } = state.eventChains.records[0];
  assert.equal(status, 'resolved');
  assert.deepEqual(stepIds.map((id) => story(state, id).decisionActorId), ['person-0-0', 'person-0-0', 'person-0-0', 'person-0-1']);
  assert.equal(new Set(stepIds).size, 4);
});

test('a spent source stays spent past the cooldown while a new source starts', () => {
  const closed = answer(heirChain(), 'chain-1-step-1', 'close');
  const anniversary = addGameMonths(closed.date, 60);
  const sources = (state) => state.eventChains.records.filter((record) => record.templateId === 'heir_margin').map((record) => record.sourceKey);
  assert.deepEqual(sources(advance(closed, anniversary, 'same-source')), ['education:person-0-4:person-1-1']);
  const newMentor = send(closed, 'educate', { childId: 'person-0-4', mentorId: 'person-3-1', focus: 'diplomacy' });
  assert.deepEqual(sources(advance(newMentor, anniversary, 'new-source')), ['education:person-0-4:person-1-1', 'education:person-0-4:person-3-1']);
});

test('a decided step cannot be decided again', () => {
  // resolve_story refuses a decided story first, so only a direct call reaches this guard.
  const state = answer(heirChain(), 'chain-1-step-1', 'hear_question');
  assert.throws(() => resolveEventChain(state, story(state, 'chain-1-step-1'), 'extra_lessons', [], {}, {}), /redan avgjort/);
});

test('the store refuses a stored patch that rewrites a chain', () => {
  const state = twoChains(), world = normalizeWorldState({ characterSystem: load(state) });
  const { child, mentor } = state.eventChains.records[0].roles;
  const roles = ['eventChains', 'records', 0, 'roles'];
  const patch = { id: 'forged-patch', kind: 'patch', fromRevision: state.revision, toRevision: state.revision + 1, changes: [
    { path: ['revision'], value: state.revision + 1 }, { path: [...roles, 'child'], value: mentor }, { path: [...roles, 'mentor'], value: child }] };
  assert.throws(() => applyCharacterOpsToWorld(world, [patch], { source: 'character-system' }), ORIGIN);
});

test('the store refuses a stored checkpoint that rewrites a chain', () => {
  const state = twoChains(), world = normalizeWorldState({ characterSystem: load(state) });
  const forged = structuredClone(state); swapRoles(forged); forged.revision += 1;
  const checkpoint = { id: 'forged-checkpoint', kind: 'checkpoint', fromRevision: state.revision, state: forged };
  assert.throws(() => applyCharacterOpsToWorld(world, [checkpoint], { source: 'character-system' }), ORIGIN);
});

test('a stored world with a rewritten chain does not load', () => {
  const forged = twoChains(); swapRoles(forged);
  assert.throws(() => normalizeWorldState({ characterSystem: forged }), ORIGIN);
});

test('a rewritten chain stops the campaign commit before any write', async () => {
  const originalFetch = globalThis.fetch, writes = [];
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'PUT') writes.push(String(url));
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  setRuntimeAssetEndpoints({ token: 'event-chain-history' });
  try {
    const forged = twoChains(); swapRoles(forged);
    const base = { game: { country: 'Hadara', gameDate: '-0299-01-01', round: 1 }, world: {}, events: [], actions: [], chat: [], colors: {} };
    const next = { ...base, game: { ...base.game, gameDate: '-0298-01-01', round: 2 }, world: { characterSystem: forged } };
    await assert.rejects(commitCharacterCampaign({ id: 'model-turn:2:-0298-01-01', base, next }), ORIGIN);
    assert.deepEqual(writes, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

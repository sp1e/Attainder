import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { validateCharacterExtensions } from './extensions.js';
import { RELATIONSHIP_KINDS, SECRET_TYPES, activeHooks, addSecretHolders, createSecret, exposeSecret, grantHook, knownSecrets, plotSecretFor, setRelationship, syncPlotSecrets, useHook, validateSecrets } from './secrets.js';
// svenska-guard: ok (the word "constructor" below is a JavaScript property name used as a forged value, not Swedish)

// Captured at f0d6ea3, before annualStep called syncPlotSecrets: the plotting campaign below after 24 months.
const PRE_CHANGE_PLOT_RUN = { rngState: 1348504830, sequence: 45, plotMemories: 4 };
const plain = (state) => JSON.parse(JSON.stringify(state));
const streams = (state) => [state.rngState, state.actionRngState];
const fresh = () => createCharacterSystem({ seed: 321 });
const plotMemory = (state, id, participants, knownBy) => { const memory = { id, date: state.date, type: 'plot', title: 'En dold plan', participants, knownBy, causeId: null, familyIds: [] }; state.memories.push(memory); return memory; };
const msg = (text) => ({ name: 'Error', message: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
// One sentence per failure class, shared by the create functions and by validateSecrets.
const M = {
  secret: { id: 'En hemlighet har ogiltigt eller dubblerat id.', kind: 'En hemlighet har ogiltig typ eller bevisnivå.', person: 'En hemlighet hänvisar till en saknad eller dubblerad person.', cause: 'En hemlighet hänvisar till ett saknat orsaksminne.', date: 'En hemlighets tidpunkter eller avslöjandestatus är ogiltiga.' },
  hook: { id: 'Ett övertag har ogiltigt eller dubblerat id.', kind: 'Ett övertag har ogiltig styrka.', person: 'Ett övertag hänvisar till en saknad person.', pair: 'Ett övertag måste gälla två olika personer.', cause: 'Ett övertag hänvisar till ett saknat orsaksminne.', date: 'Ett övertags tidpunkter är ogiltiga.' },
  relationship: { id: 'En relation har ogiltigt eller dubblerat id.', kind: 'En relation har ogiltigt slag.', person: 'En relation hänvisar till en saknad person.', pair: 'En relation måste gälla två olika personer.', cause: 'En relation hänvisar till ett saknat orsaksminne.', date: 'En relations tidpunkt är ogiltig.', dup: 'Två relationer av samma slag gäller samma par.' },
};
// The campaign used by the end-to-end tests: three ambitious, vengeful nobles whose families are strong and unhappy, and a schemer on the throne who can run the network command.
function plottingCampaign() {
  const state = fresh();
  state.people['person-0-0'].archetype = 'schemer';
  for (const id of ['person-1-0', 'person-2-0', 'person-3-0']) { const person = state.people[id]; person.traits = ['ambitious', 'vengeful']; person.loyalty = 20; state.families[person.familyId].influence = 100; state.families[person.familyId].grievance = -40; }
  return state;
}
const twoYears = () => { const start = plottingCampaign(), result = advanceCharacters(start, addGameMonths(start.date, 24), { id: 'two-years' }); assert.equal(result.ok, true, result.error); return { start, state: result.state }; };

test('the type and kind sets are exactly those of the design', () => {
  assert.deepEqual([...SECRET_TYPES], ['murder', 'affair', 'illegitimate_child', 'heresy', 'plot']);
  assert.deepEqual([...RELATIONSHIP_KINDS], ['friend', 'rival', 'lover', 'nemesis']);
});

test('a secret is created with the agreed fields, stored once and exposed on demand', () => {
  const state = fresh(), seq = state.sequence, before = streams(state);
  plotMemory(state, 'memory-seed', ['person-1-0', 'person-0-0'], 'public');
  const secret = createSecret(state, { type: 'affair', subjectId: 'person-0-2', holderIds: ['person-1-0', 'person-1-0', 'person-2-0'], evidence: 'strong', causeId: 'memory-seed' });
  assert.deepEqual(secret, { id: `secret-${seq + 1}`, type: 'affair', subjectId: 'person-0-2', holderIds: ['person-1-0', 'person-2-0'], evidence: 'strong', causeId: 'memory-seed', exposed: false, createdAt: state.date });
  assert.equal(state.sequence, seq + 1);
  assert.equal(state.secrets.length, 1); assert.equal(state.secrets[0], secret);
  const second = createSecret(state, { type: 'heresy', subjectId: 'person-3-0', holderIds: [], evidence: 'weak', causeId: null });
  assert.equal(second.id, `secret-${seq + 2}`);
  state.date = addGameMonths(state.date, 6);
  assert.equal(exposeSecret(state, secret.id), secret);
  assert.equal(secret.exposed, true); assert.equal(secret.exposedAt, state.date);
  const exposedOn = state.date; state.date = addGameMonths(state.date, 6);
  assert.equal(exposeSecret(state, secret.id).exposedAt, exposedOn, 'exposing twice keeps the first date');
  assert.equal(second.exposed, false); assert.equal('exposedAt' in second, false);
  assert.deepEqual(streams(state), before);
  validateCharacterExtensions(state);
});

test('createSecret refuses bad input and then spends nothing', () => {
  const state = fresh(), seq = state.sequence, before = plain(state);
  const make = (patch) => () => createSecret(state, { type: 'murder', subjectId: 'person-0-0', holderIds: ['person-1-0'], evidence: 'weak', causeId: null, ...patch });
  assert.throws(make({ type: 'theft' }), msg(M.secret.kind));
  assert.throws(make({ type: 'constructor' }), msg(M.secret.kind));
  assert.throws(make({ evidence: 'certain' }), msg(M.secret.kind));
  assert.throws(make({ subjectId: 'person-nobody' }), msg(M.secret.person));
  assert.throws(make({ subjectId: 'constructor' }), msg(M.secret.person));
  assert.throws(make({ holderIds: ['person-1-0', 'person-nobody'] }), msg(M.secret.person));
  assert.throws(make({ holderIds: 'person-1-0' }), msg(M.secret.person));
  assert.throws(make({ causeId: 'memory-missing' }), msg(M.secret.cause));
  assert.equal(state.sequence, seq); assert.deepEqual(state, before);
  // Evidence defaults to weak, holders to nobody and the cause to none.
  const bare = createSecret(state, { type: 'murder', subjectId: 'person-0-0' });
  assert.deepEqual([bare.evidence, bare.holderIds, bare.causeId], ['weak', [], null]);
});

test('addSecretHolders unions in order, ignores repeats and refuses unknown ids', () => {
  const state = fresh(), secret = createSecret(state, { type: 'heresy', subjectId: 'person-3-0', holderIds: ['person-3-0'], evidence: 'weak' });
  assert.equal(addSecretHolders(state, secret.id, ['person-1-0', 'person-3-0', 'person-1-0', 'person-2-0']), secret);
  assert.deepEqual(secret.holderIds, ['person-3-0', 'person-1-0', 'person-2-0']);
  const before = plain(state);
  assert.throws(() => addSecretHolders(state, 'secret-999', ['person-1-0']), { name: 'Error', message: 'Hemligheten finns inte.' });
  assert.throws(() => addSecretHolders(state, secret.id, ['person-0-1', 'person-nobody']), msg(M.secret.person));
  assert.throws(() => addSecretHolders(state, secret.id, 'person-0-1'), msg(M.secret.person));
  assert.deepEqual(state, before, 'a refused call changes nothing');
  assert.throws(() => exposeSecret(state, 'secret-999'), { name: 'Error', message: 'Hemligheten finns inte.' });
});

test('a weak hook works once and a strong hook keeps working', () => {
  const state = fresh(), seq = state.sequence, before = streams(state);
  const weak = grantHook(state, { ownerId: 'person-1-0', targetId: 'person-0-0', strength: 'weak', causeId: null });
  const strong = grantHook(state, { ownerId: 'person-1-0', targetId: 'person-2-0', strength: 'strong', causeId: null });
  assert.deepEqual(weak, { id: `hook-${seq + 1}`, ownerId: 'person-1-0', targetId: 'person-0-0', strength: 'weak', causeId: null, createdAt: state.date, usedAt: null });
  assert.equal(strong.id, `hook-${seq + 2}`); assert.equal(state.sequence, seq + 2);
  assert.deepEqual(state.hooks, [weak, strong]);
  state.date = addGameMonths(state.date, 3);
  assert.equal(useHook(state, weak.id), weak); assert.equal(weak.usedAt, state.date);
  assert.throws(() => useHook(state, weak.id), { name: 'Error', message: 'Övertaget är redan använt.' });
  // Three direct calls: a loop around useHook trips the React hooks lint rule on the name.
  assert.equal(useHook(state, strong.id), strong); assert.equal(useHook(state, strong.id), strong); assert.equal(useHook(state, strong.id), strong);
  assert.equal(strong.usedAt, null);
  assert.deepEqual(activeHooks(state, 'person-1-0').map((h) => h.id), [strong.id]);
  assert.deepEqual(streams(state), before);
  validateCharacterExtensions(state);
});

test('hooks refuse unknown ids, dead holders and bad input', () => {
  const state = fresh(), seq = state.sequence;
  const hook = grantHook(state, { ownerId: 'person-1-0', targetId: 'person-0-0', strength: 'strong' });
  assert.throws(() => useHook(state, 'hook-999'), { name: 'Error', message: 'Övertaget finns inte.' });
  const target = state.people['person-0-0']; target.diedAt = state.date;
  assert.throws(() => useHook(state, hook.id), { name: 'Error', message: 'Övertagets ägare eller mål lever inte längre.' });
  assert.deepEqual(activeHooks(state, 'person-1-0'), []);
  target.diedAt = null; state.people['person-1-0'].diedAt = state.date;
  assert.throws(() => useHook(state, hook.id), { name: 'Error', message: 'Övertagets ägare eller mål lever inte längre.' });
  state.people['person-1-0'].diedAt = null;
  assert.equal(useHook(state, hook.id), hook);
  const make = (patch) => () => grantHook(state, { ownerId: 'person-1-0', targetId: 'person-2-0', strength: 'weak', causeId: null, ...patch });
  assert.throws(make({ strength: 'mighty' }), msg(M.hook.kind));
  assert.throws(make({ strength: 'constructor' }), msg(M.hook.kind));
  assert.throws(make({ ownerId: 'person-nobody' }), msg(M.hook.person));
  assert.throws(make({ targetId: 'constructor' }), msg(M.hook.person));
  assert.throws(make({ targetId: 'person-1-0' }), msg(M.hook.pair));
  assert.throws(make({ causeId: 'memory-missing' }), msg(M.hook.cause));
  assert.equal(state.sequence, seq + 1, 'only the first grant spent an id');
  assert.equal(grantHook(state, { ownerId: 'person-1-0', targetId: 'person-2-0' }).strength, 'weak', 'strength defaults to weak');
});

test('activeHooks filters by owner, target and use', () => {
  const state = fresh();
  const a = grantHook(state, { ownerId: 'person-1-0', targetId: 'person-0-0', strength: 'weak' });
  const b = grantHook(state, { ownerId: 'person-1-0', targetId: 'person-2-0', strength: 'weak' });
  const c = grantHook(state, { ownerId: 'person-2-0', targetId: 'person-0-0', strength: 'strong' });
  assert.deepEqual(activeHooks(state, 'person-1-0').map((h) => h.id), [a.id, b.id]);
  assert.deepEqual(activeHooks(state, 'person-1-0', 'person-2-0').map((h) => h.id), [b.id]);
  assert.deepEqual(activeHooks(state, 'person-2-0', 'person-0-0').map((h) => h.id), [c.id]);
  assert.deepEqual(activeHooks(state, 'person-0-0'), []);
  useHook(state, a.id);
  assert.deepEqual(activeHooks(state, 'person-1-0').map((h) => h.id), [b.id]);
});

test('a relationship is unique per unordered pair and kind', () => {
  const state = fresh(), seq = state.sequence, before = streams(state);
  plotMemory(state, 'memory-a', ['person-1-0', 'person-0-0'], 'public'); plotMemory(state, 'memory-b', ['person-1-0', 'person-0-0'], 'public');
  const friend = setRelationship(state, { kind: 'friend', aId: 'person-1-0', bId: 'person-2-0', causeId: null });
  assert.deepEqual(friend, { id: `relationship-${seq + 1}`, kind: 'friend', aId: 'person-1-0', bId: 'person-2-0', causeId: null, createdAt: state.date });
  assert.equal(setRelationship(state, { kind: 'friend', aId: 'person-2-0', bId: 'person-1-0', causeId: null }), friend, 'reversed order finds the same record');
  assert.equal(setRelationship(state, { kind: 'friend', aId: 'person-1-0', bId: 'person-2-0' }), friend);
  assert.equal(state.relationships.length, 1); assert.equal(state.sequence, seq + 1);
  assert.equal(setRelationship(state, { kind: 'friend', aId: 'person-2-0', bId: 'person-1-0', causeId: 'memory-a' }), friend);
  assert.equal(friend.causeId, 'memory-a', 'a non-null cause is written');
  setRelationship(state, { kind: 'friend', aId: 'person-1-0', bId: 'person-2-0', causeId: null });
  assert.equal(friend.causeId, 'memory-a', 'a null cause never erases one');
  assert.throws(() => setRelationship(state, { kind: 'friend', aId: 'person-1-0', bId: 'person-2-0', causeId: 'memory-missing' }), msg(M.relationship.cause));
  assert.equal(friend.causeId, 'memory-a');
  const rival = setRelationship(state, { kind: 'rival', aId: 'person-1-0', bId: 'person-2-0', causeId: 'memory-b' });
  assert.notEqual(rival, friend); assert.equal(state.relationships.length, 2);
  const other = setRelationship(state, { kind: 'friend', aId: 'person-1-0', bId: 'person-3-0' });
  assert.notEqual(other, friend); assert.equal(state.relationships.length, 3);
  for (const kind of RELATIONSHIP_KINDS) setRelationship(state, { kind, aId: 'person-0-1', bId: 'person-0-2' });
  assert.equal(state.relationships.length, 3 + RELATIONSHIP_KINDS.length);
  assert.deepEqual(streams(state), before);
  validateCharacterExtensions(state);
});

test('relationships refuse a pair of one, unknown kinds, unknown people and unknown causes', () => {
  const state = fresh(), seq = state.sequence;
  const make = (patch) => () => setRelationship(state, { kind: 'friend', aId: 'person-1-0', bId: 'person-2-0', causeId: null, ...patch });
  assert.throws(make({ bId: 'person-1-0' }), msg(M.relationship.pair));
  assert.throws(make({ kind: 'ally' }), msg(M.relationship.kind));
  assert.throws(make({ kind: 'constructor' }), msg(M.relationship.kind));
  assert.throws(make({ aId: 'person-nobody' }), msg(M.relationship.person));
  assert.throws(make({ bId: 'constructor' }), msg(M.relationship.person));
  assert.throws(make({ causeId: 'memory-missing' }), msg(M.relationship.cause));
  assert.equal(state.sequence, seq); assert.deepEqual(state.relationships, []);
});

test('knownSecrets hides a secret from a non-holder until it is exposed', () => {
  const state = fresh();
  const secret = createSecret(state, { type: 'illegitimate_child', subjectId: 'person-0-2', holderIds: ['person-1-0'], evidence: 'weak' });
  const other = createSecret(state, { type: 'heresy', subjectId: 'person-3-0', holderIds: ['person-2-0'], evidence: 'strong' });
  assert.deepEqual(knownSecrets(state, 'person-1-0'), [secret]);
  assert.deepEqual(knownSecrets(state, 'person-2-0'), [other]);
  assert.deepEqual(knownSecrets(state, 'person-0-2'), [], 'being the subject does not make you a holder');
  assert.deepEqual(knownSecrets(state, 'person-3-3'), []);
  exposeSecret(state, secret.id);
  assert.deepEqual(knownSecrets(state, 'person-3-3'), [secret]);
  assert.deepEqual(knownSecrets(state, 'person-2-0'), [secret, other]);
  addSecretHolders(state, other.id, ['person-3-3']);
  assert.deepEqual(knownSecrets(state, 'person-3-3'), [secret, other]);
});

test('syncPlotSecrets turns each private plot memory into one plot secret, keeps the memory and is idempotent', () => {
  const state = fresh(), seq = state.sequence, before = streams(state);
  const b = plotMemory(state, 'memory-b', ['person-2-0', 'person-0-0'], ['person-2-0', 'person-3-0']);
  const a = plotMemory(state, 'memory-a', ['person-1-0', 'person-0-0'], ['person-1-0']);
  plotMemory(state, 'memory-public', ['person-3-0', 'person-0-0'], 'public');
  state.memories.push({ id: 'memory-other', date: state.date, type: 'betrayal', title: 'Svek', participants: ['person-1-0', 'person-0-0'], knownBy: ['person-1-0'], causeId: null, familyIds: [] });
  const memories = plain(state.memories);
  syncPlotSecrets(state);
  assert.deepEqual(state.memories, memories, 'the memories stay exactly as they were');
  assert.equal(state.secrets.length, 2);
  assert.deepEqual(state.secrets.map((s) => s.causeId), ['memory-b', 'memory-a'], 'ids follow memory array order');
  assert.deepEqual(state.secrets.map((s) => s.id), [`secret-${seq + 1}`, `secret-${seq + 2}`]);
  assert.deepEqual(state.secrets[0], { id: `secret-${seq + 1}`, type: 'plot', subjectId: 'person-2-0', holderIds: ['person-2-0', 'person-3-0'], evidence: 'weak', causeId: 'memory-b', exposed: false, createdAt: state.date });
  assert.deepEqual(state.secrets[1].holderIds, a.knownBy); assert.notEqual(state.secrets[0].holderIds, b.knownBy, 'holders are a copy, not the memory array');
  assert.equal(plotSecretFor(state, 'memory-a'), state.secrets[1]); assert.equal(plotSecretFor(state, 'memory-public'), null);
  assert.equal(state.sequence, seq + 2);
  assert.deepEqual(streams(state), before, 'no randomness is drawn');
  const synced = plain(state);
  syncPlotSecrets(state); syncPlotSecrets(state);
  assert.deepEqual(state, synced, 'a second run changes nothing, not even the sequence');
});

test('syncPlotSecrets unions late knowers into the existing secret and leaves foreign secrets alone', () => {
  const state = fresh();
  const memory = plotMemory(state, 'memory-a', ['person-1-0', 'person-0-0'], ['person-1-0']);
  syncPlotSecrets(state);
  const secret = state.secrets[0];
  memory.knownBy.push('person-3-3');
  syncPlotSecrets(state);
  assert.deepEqual(secret.holderIds, ['person-1-0', 'person-3-3']); assert.equal(state.secrets.length, 1);
  // A secret of another type that already names a plot memory as its cause blocks a second secret and receives no holders.
  const claimed = plotMemory(state, 'memory-c', ['person-2-0', 'person-0-0'], ['person-2-0', 'person-2-1']);
  const murder = createSecret(state, { type: 'murder', subjectId: 'person-2-0', holderIds: ['person-2-0'], evidence: 'strong', causeId: claimed.id });
  syncPlotSecrets(state);
  assert.equal(state.secrets.length, 2); assert.deepEqual(murder.holderIds, ['person-2-0']);
  assert.equal(plotSecretFor(state, 'memory-c'), null, 'plotSecretFor only returns plot secrets');
  // A plot memory whose subject does not exist is a broken save, and the sentence says so.
  plotMemory(state, 'memory-broken', ['person-nobody', 'person-0-0'], ['person-nobody']);
  assert.throws(() => syncPlotSecrets(state), msg(M.secret.person));
});

test('validateSecrets rejects forged secrets, hooks and relationships', () => {
  const base = fresh();
  plotMemory(base, 'memory-seed', ['person-1-0', 'person-0-0'], 'public');
  createSecret(base, { type: 'affair', subjectId: 'person-0-2', holderIds: ['person-1-0', 'person-2-0'], evidence: 'strong', causeId: 'memory-seed' });
  grantHook(base, { ownerId: 'person-1-0', targetId: 'person-0-0', strength: 'weak', causeId: 'memory-seed' });
  setRelationship(base, { kind: 'rival', aId: 'person-1-0', bId: 'person-2-0', causeId: 'memory-seed' });
  validateSecrets(base); validateCharacterExtensions(base);
  const future = '-0100-01-01';
  const forgeries = {
    'unknown secret type': [(s) => { s.secrets[0].type = 'theft'; }, M.secret.kind],
    'prototype key as secret type': [(s) => { s.secrets[0].type = 'constructor'; }, M.secret.kind],
    'unknown evidence': [(s) => { s.secrets[0].evidence = 'rumour'; }, M.secret.kind],
    'missing subject': [(s) => { s.secrets[0].subjectId = 'person-nobody'; }, M.secret.person],
    'missing holder': [(s) => { s.secrets[0].holderIds.push('person-nobody'); }, M.secret.person],
    'repeated holder': [(s) => { s.secrets[0].holderIds.push('person-1-0'); }, M.secret.person],
    'holders as text': [(s) => { s.secrets[0].holderIds = 'person-1-0'; }, M.secret.person],
    'missing cause memory': [(s) => { s.secrets[0].causeId = 'memory-missing'; }, M.secret.cause],
    'undefined cause': [(s) => { delete s.secrets[0].causeId; }, M.secret.cause],
    'duplicate secret id': [(s) => { s.secrets.push({ ...s.secrets[0] }); }, M.secret.id],
    'unsafe secret id': [(s) => { s.secrets[0].id = 'secret 1; drop'; }, M.secret.id],
    'secret that is not an object': [(s) => { s.secrets.push(7); }, M.secret.id],
    'exposed without a date': [(s) => { s.secrets[0].exposed = true; }, M.secret.date],
    'exposure date on a hidden secret': [(s) => { s.secrets[0].exposedAt = s.date; }, M.secret.date],
    'exposure in the future': [(s) => { s.secrets[0].exposed = true; s.secrets[0].exposedAt = future; }, M.secret.date],
    'exposed as text': [(s) => { s.secrets[0].exposed = 'yes'; }, M.secret.date],
    'secret created in the future': [(s) => { s.secrets[0].createdAt = future; }, M.secret.date],
    'secret without a creation date': [(s) => { delete s.secrets[0].createdAt; }, M.secret.date],
    'unknown hook strength': [(s) => { s.hooks[0].strength = 'mighty'; }, M.hook.kind],
    'missing hook owner': [(s) => { s.hooks[0].ownerId = 'person-nobody'; }, M.hook.person],
    'missing hook target': [(s) => { s.hooks[0].targetId = 'constructor'; }, M.hook.person],
    'hook on oneself': [(s) => { s.hooks[0].targetId = s.hooks[0].ownerId; }, M.hook.pair],
    'missing hook cause': [(s) => { s.hooks[0].causeId = 'memory-missing'; }, M.hook.cause],
    'duplicate hook id': [(s) => { s.hooks.push({ ...s.hooks[0] }); }, M.hook.id],
    'hook used in the future': [(s) => { s.hooks[0].usedAt = future; }, M.hook.date],
    'hook with a garbage use date': [(s) => { s.hooks[0].usedAt = 'sometime'; }, M.hook.date],
    'hook that was never dated': [(s) => { s.hooks[0].createdAt = null; }, M.hook.date],
    'unknown relationship kind': [(s) => { s.relationships[0].kind = 'ally'; }, M.relationship.kind],
    'missing relationship person': [(s) => { s.relationships[0].bId = 'person-nobody'; }, M.relationship.person],
    'relationship with oneself': [(s) => { s.relationships[0].bId = s.relationships[0].aId; }, M.relationship.pair],
    'missing relationship cause': [(s) => { s.relationships[0].causeId = 'memory-missing'; }, M.relationship.cause],
    'duplicate relationship id': [(s) => { s.relationships.push({ ...s.relationships[0], kind: 'friend' }); }, M.relationship.id],
    'same pair and kind twice, reversed': [(s) => { s.relationships.push({ ...s.relationships[0], id: 'relationship-900', aId: s.relationships[0].bId, bId: s.relationships[0].aId }); }, M.relationship.dup],
    'relationship created in the future': [(s) => { s.relationships[0].createdAt = future; }, M.relationship.date],
  };
  for (const [name, [forge, message]] of Object.entries(forgeries)) {
    const forged = plain(base); forge(forged);
    assert.throws(() => validateSecrets(forged), msg(message), name);
    assert.throws(() => validateCharacterExtensions(forged), msg(message), `${name} (via validateCharacterExtensions)`);
    assert.throws(() => normalizeCharacterSystem(forged), msg(message), `${name} (via normalizeCharacterSystem)`);
  }
  // The same pair with a different kind is fine.
  const fine = plain(base); fine.relationships.push({ ...fine.relationships[0], id: 'relationship-901', kind: 'friend' });
  validateSecrets(fine);
  const lists = plain(base); lists.secrets = {};
  assert.throws(() => validateSecrets(lists), msg('Karaktärstilläggens samlingar är ogiltiga.'));
});

test('a campaign advanced two years with plotting nobles has one plot secret per private plot memory', () => {
  const { start, state } = twoYears();
  const plots = state.memories.filter((m) => m.type === 'plot' && Array.isArray(m.knownBy));
  // Premise: the setup really produces private plots, in both annual steps.
  assert.equal(plots.length, PRE_CHANGE_PLOT_RUN.plotMemories);
  assert.deepEqual(new Set(plots.map((m) => m.date)).size, 2, 'plots from the first and from the second annual step');
  assert.equal(state.secrets.length, plots.length);
  for (const memory of plots) {
    const named = state.secrets.filter((s) => s.causeId === memory.id);
    assert.equal(named.length, 1, memory.id);
    assert.deepEqual(named[0], { id: named[0].id, type: 'plot', subjectId: memory.participants[0], holderIds: memory.knownBy, evidence: 'weak', causeId: memory.id, exposed: false, createdAt: memory.date });
  }
  assert.deepEqual(state.secrets.map((s) => s.causeId), plots.map((m) => m.id), 'secret order follows memory order');
  const numbers = state.secrets.map((s) => Number(s.id.slice('secret-'.length)));
  assert.deepEqual([...numbers].sort((x, y) => x - y), numbers); assert.equal(new Set(numbers).size, numbers.length);
  // Sync draws nothing: the main stream matches the run without it, the action stream never moved, and only the ids were spent.
  assert.equal(state.rngState, PRE_CHANGE_PLOT_RUN.rngState);
  assert.equal(state.actionRngState, start.actionRngState);
  assert.equal(state.sequence, PRE_CHANGE_PLOT_RUN.sequence + plots.length);
  validateCharacterExtensions(state);
  assert.deepEqual(normalizeCharacterSystem(plain(state)), state, 'normalizing an engine state changes nothing');
  const again = advanceCharacters(start, addGameMonths(start.date, 24), { id: 'two-years' });
  assert.deepEqual(again.state, state, 'the run is deterministic');
});

test('the network command adds its discoverer to the plot secret and normalizing afterwards changes nothing', () => {
  const { state } = twoYears();
  const run = (current, type, payload, id) => { const result = executeCharacterCommand(current, { id, expectedRevision: current.revision, type, payload }); assert.equal(result.ok, true, result.error); return result.state; };
  const secretsBefore = plain(state.secrets);
  const found = run(state, 'network', {}, 'net-1');
  const story = found.stories.find((s) => s.type === 'discovery');
  assert.ok(story, 'premise: the network command discovers a plot');
  const memory = found.memories.find((m) => m.id === story.causeId), secret = plotSecretFor(found, memory.id);
  assert.ok(memory.knownBy.includes('person-0-0'));
  assert.ok(secret.holderIds.includes('person-0-0'), 'the discoverer is a holder of the plot secret');
  assert.deepEqual(secret.holderIds, memory.knownBy);
  assert.equal(secret.exposed, false);
  assert.deepEqual(found.secrets.filter((s) => s.id !== secret.id), secretsBefore.filter((s) => s.id !== secret.id), 'the other secrets are untouched');
  assert.deepEqual(knownSecrets(found, 'person-0-0').map((s) => s.id), [secret.id]);
  assert.equal(found.rngState, state.rngState); assert.equal(found.actionRngState, state.actionRngState);
  assert.deepEqual(normalizeCharacterSystem(plain(found)), found);
  // The lawful exposure makes the memory public; the secret follows.
  const exposed = run(found, 'resolve_story', { storyId: story.id, choiceId: 'expose' }, 'expose-1');
  assert.equal(exposed.memories.find((m) => m.id === memory.id).knownBy, 'public');
  const after = plotSecretFor(exposed, memory.id);
  assert.equal(after.exposed, true); assert.equal(after.exposedAt, exposed.date);
  assert.ok(knownSecrets(exposed, 'person-3-3').some((s) => s.id === after.id));
  assert.deepEqual(normalizeCharacterSystem(plain(exposed)), exposed);
});

test('an old save without secrets gets them on load, and a secret that lags its memory catches up', () => {
  const { state } = twoYears();
  const old = plain(state); delete old.secrets;
  const migrated = normalizeCharacterSystem(old), plots = migrated.memories.filter((m) => m.type === 'plot');
  assert.equal(migrated.secrets.length, plots.length);
  assert.deepEqual(migrated.secrets.map((s) => s.id), plots.map((_, i) => `secret-${state.sequence + 1 + i}`));
  for (const memory of plots) assert.deepEqual(plotSecretFor(migrated, memory.id).holderIds, memory.knownBy);
  assert.equal(migrated.sequence, state.sequence + plots.length);
  assert.deepEqual(streams(migrated), streams(state));
  assert.deepEqual(normalizeCharacterSystem(plain(migrated)), migrated, 'loading the migrated save again changes nothing');
  // A commands and time steps on the old save migrate it the same way.
  const viaAdvance = advanceCharacters(old, addGameMonths(old.date, 12), { id: 'old-year' });
  assert.equal(viaAdvance.ok, true, viaAdvance.error);
  assert.ok(viaAdvance.state.memories.filter((m) => m.type === 'plot').every((m) => plotSecretFor(viaAdvance.state, m.id)));
  // Safety net: the memory knows a person the secret does not.
  const lagging = plain(state); lagging.memories.find((m) => m.type === 'plot').knownBy.push('person-3-3');
  const caught = normalizeCharacterSystem(lagging);
  assert.equal(caught.secrets.length, state.secrets.length); assert.equal(caught.sequence, state.sequence);
  assert.ok(caught.secrets[0].holderIds.includes('person-3-3'));
});

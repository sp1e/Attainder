import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths, compareGameDates } from '../gameDates.js';
import { advanceCharacters, applyRealmDissolution, canCharacterDirectRealm, createCharacterSystem, executeCharacterCommand,
  getCharacterAge, getCharacterPresentation, getPersonalOpinion, normalizeCharacterSystem, reconcileExternalHosts } from './index.js';
import { CHARACTER_EVENT_TYPES, getDirectedStoryCandidates, scheduleDirectedStory } from './storyDirector.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
function context(state) {
  const view = getCharacterPresentation(state);
  return { actor: state.people[view.representative?.id], family: state.families[view.identity.familyId],
    canRule: canCharacterDirectRealm(state), age: (person) => getCharacterAge(person, state.date), stress: () => 0 };
}
function fresh(options = {}) {
  const state = createCharacterSystem({ mode: 'family', seed: 477, ...options });
  state.people['person-0-2'].stress = 65;
  for (const city of Object.values(state.cities)) city.unrest = 30;
  return state;
}
function candidates(state, type) { return getDirectedStoryCandidates(state, context(state)).filter((s) => s.eventType === type); }
function open(state, type, extra = {}) {
  const candidate = candidates(state, type)[0];
  assert.ok(candidate, `fixture needs eligible ${type}`);
  const { weight: _weight, ...details } = candidate;
  const story = { ...details, id: `character-story-${++state.storyDirector.sequence}`, type: 'character_event',
    status: 'open', createdAt: state.date, dueAt: addGameMonths(state.date, 12), knownBy: 'public', ...extra };
  state.stories.push(story);
  return story;
}
let sequence = 0;
function choose(state, story, choiceId, extra = {}) {
  return executeCharacterCommand(state, { id: `story-test-${++sequence}`, expectedRevision: state.revision,
    type: 'resolve_story', payload: { storyId: story.id, choiceId }, ...extra });
}
function success(result) { assert.equal(result.ok, true, result.error); return result.state; }
function advance(state, months) { return success(advanceCharacters(state, addGameMonths(state.date, months))); }
function stripCommands(state) { const { revision: _revision, appliedCommandIds: _ids, ...rest } = state; return rest; }
function act(state, type, payload) {
  return success(executeCharacterCommand(state, { id: `story-host-${++sequence}`, expectedRevision: state.revision, type, payload }));
}
function priorPatronage(state, title) {
  const original = open(state, 'temple_petition');
  Object.assign(state, success(choose(state, original, 'donate')));
  const source = state.stories.find((s) => s.id === original.id);
  const memory = state.memories.find((m) => m.id === source.outcomeMemoryId);
  const past = addGameMonths(state.date, -48);
  source.createdAt = past; source.resolvedAt = past; source.dueAt = addGameMonths(past, 12);
  memory.date = past; memory.title = title;
  return memory;
}

test('patronage memory rejects missing people, families and causal references without inventing deceased beneficiaries', () => {
  const original = fresh();
  const supported = success(choose(original, open(original, 'temple_petition'), 'donate'));
  assert.deepEqual(normalizeCharacterSystem(clone(supported)), supported);
  for (const mutate of [
    (m) => { m.beneficiaryId = 'person-missing'; m.participants[0] = 'person-missing'; },
    (m) => { m.participants.push('person-missing'); },
    (m) => { m.participants = null; },
    (m) => { m.beneficiaryFamilyId = 'family-missing'; },
    (m) => { m.sponsorFamilyId = 'family-missing'; },
    (m) => { m.causeId = 'story-missing'; },
    (m) => { m.storyId = 'story-missing'; },
    (m) => { m.beneficiaryId = 'person-1-0'; },
  ]) {
    const state = clone(supported);
    mutate(state.memories.find((m) => m.type === 'story_patronage'));
    const before = clone(state);
    assert.throws(() => normalizeCharacterSystem(state), /ogiltigt/);
    assert.deepEqual(state, before);
  }
  const missing = clone(supported);
  const memory = missing.memories.find((m) => m.type === 'story_patronage');
  memory.beneficiaryId = 'person-missing';
  missing.date = addGameMonths(missing.date, 36);
  assert.equal(candidates(missing, 'returned_favor').length, 0, 'a missing person is not a deceased family member');
});

test('honoring an actual office promise immediately closes a matching governor audit without extra expenses', () => {
  let state = fresh();
  const promise = state.stories.find((s) => s.type === 'office_promise');
  state = success(choose(state, promise, 'promise'));
  state = advance(state, 36);
  const due = state.stories.find((s) => s.type === 'promise_due' && s.status === 'open');
  assert.ok(due);
  state.storyDirector.cooldowns = {};
  state.cities[state.offices[due.officeId].cityId].unrest = 30;
  for (const story of state.stories.filter((s) => s.type === 'character_event' && s.status === 'open')) {
    story.status = 'closed'; story.resolvedAt = state.date;
  }
  const candidate = candidates(state, 'governor_audit').find((s) => s.officeId === due.officeId);
  assert.ok(candidate);
  const audit = open(state, 'governor_audit', candidate);
  state = normalizeCharacterSystem(clone(state));
  const before = clone(state);
  const result = choose(state, due, 'honor');
  const final = success(result);
  assert.equal(final.offices[due.officeId].holderId, due.actorId);
  assert.notEqual(before.offices[due.officeId].holderId, due.actorId);
  assert.equal(final.stories.find((s) => s.id === audit.id).status, 'closed');
  assert.equal(final.stories.find((s) => s.id === audit.id).resolvedAt, final.date);
  assert.equal(final.realm.treasury, before.realm.treasury - 10);
  for (const family of Object.values(final.families)) assert.equal(family.treasury, before.families[family.id].treasury);
  assert.ok(!final.memories.some((m) => m.storyId === audit.id));
  assert.ok(result.events.some((event) => event.type === 'story_closed' && event.participants.includes(audit.actorId)));
  assert.ok(!getCharacterPresentation(final).stories.some((s) => s.id === audit.id));
  assert.deepEqual(normalizeCharacterSystem(clone(final)), final);
});

test('automatic expiry resolves simultaneous deadlines exactly once without recursive refresh or spending', () => {
  const state = fresh();
  const stories = [open(state, 'household_tension'), open(state, 'temple_petition')];
  state.nextAnnualDate = addGameMonths(state.date, 18);
  const final = advance(state, 13);
  for (const story of stories) {
    const resolved = final.stories.find((s) => s.id === story.id);
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.choiceId, 'ignore');
    assert.equal(resolved.automatic, true);
    assert.equal(resolved.resolvedAt, story.dueAt);
    assert.equal(final.memories.filter((m) => m.storyId === story.id).length, 1);
  }
  assert.equal(final.realm.treasury, state.realm.treasury);
  assert.equal(final.families[state.identity.familyId].treasury, state.families[state.identity.familyId].treasury);
  assert.deepEqual(normalizeCharacterSystem(clone(final)), final);
});

test('scheduler permits at most one draw in a calendar year even across different dates', () => {
  const state = fresh();
  const first = scheduleDirectedStory(state, [], context(state), () => {});
  assert.ok(first);
  const rng = state.storyDirector.rngState;
  state.date = addGameMonths(state.date, 6);
  assert.equal(scheduleDirectedStory(state, [], context(state), () => {}), null);
  assert.equal(state.storyDirector.rngState, rng);
});

test('migration defaults only an absent director and does not draw or invent history', () => {
  const state = fresh();
  delete state.storyDirector;
  const before = clone(state);
  const restored = normalizeCharacterSystem(state);
  assert.deepEqual(state, before);
  assert.deepEqual(restored.memories, before.memories);
  assert.deepEqual(restored.stories, before.stories);
  assert.equal(restored.rngState, before.rngState);
  assert.deepEqual(normalizeCharacterSystem(clone(restored)), restored);
  state.storyDirector = null;
  assert.throws(() => normalizeCharacterSystem(state), /ogiltigt/);
});

test('saved events reject future creation, missing faith, bad source references and future director versions', () => {
  const original = fresh();
  const story = open(original, 'temple_petition');
  for (const mutate of [
    (s) => { s.storyDirector.version = 2; },
    (s) => { s.storyDirector.rngState = 0; },
    (s) => { s.stories.at(-1).createdAt = addGameMonths(s.date, 1); },
    (s) => { delete s.stories.at(-1).religionId; },
    (s) => { s.stories.at(-1).causeId = 'memory-missing'; },
    (s) => { s.stories.at(-1).dueAt = addGameMonths(story.dueAt, 1); },
    (s) => { s.stories.at(-1).createdAt = addGameMonths(s.date, -24); s.stories.at(-1).dueAt = addGameMonths(s.date, -12); },
    (s) => { s.storyDirector.lastScheduledAt = addGameMonths(s.date, 1); },
    (s) => { s.storyDirector.cooldowns['person:missing-person'] = s.date; },
  ]) {
    const state = clone(original); mutate(state);
    const before = clone(state);
    assert.throws(() => normalizeCharacterSystem(state));
    assert.deepEqual(state, before, 'rejection preserves original save');
  }
});

test('exile requires a live real host when scheduled and when the player accepts', () => {
  const state = fresh();
  const family = state.families[state.identity.familyId];
  family.exiled = true; family.hostFamilyId = 'family-missing';
  assert.equal(candidates(state, 'exile_help').length, 0);
  family.hostFamilyId = 'family-namar';
  assert.ok(candidates(state, 'exile_help').length);
  const story = open(state, 'exile_help');
  family.hostFamilyId = null;
  const before = clone(state);
  assert.equal(choose(state, story, 'network').ok, false);
  assert.deepEqual(state, before);
  family.hostPolityId = 'gone-polity';
  assert.equal(candidates(state, 'exile_help').length, 0);
});

test('an actual family patron change closes the old exile offer before any network expense', () => {
  let state = fresh();
  state.families['family-arel'].exiled = true;
  state = act(state, 'seek_patron', { familyId: 'family-namar' });
  assert.equal(state.families['family-arel'].hostFamilyId, 'family-namar');
  const story = open(state, 'exile_help');
  const original = normalizeCharacterSystem(clone(state));
  const switched = act(original, 'seek_patron', { familyId: 'family-eshmun' });
  assert.equal(switched.families['family-arel'].hostFamilyId, 'family-eshmun');
  assert.equal(switched.stories.find((s) => s.id === story.id).status, 'closed');
  assert.equal(story.hostKind, 'family');
  assert.equal(story.hostId, 'family-namar');
  assert.equal(switched.families['family-arel'].treasury, original.families['family-arel'].treasury - 10, 'only the patron negotiation costs silver');
  assert.equal(switched.realm.treasury, original.realm.treasury);
  const before = clone(switched);
  assert.equal(choose(switched, story, 'network').ok, false);
  assert.deepEqual(switched, before);
  assert.ok(!switched.memories.some((m) => m.storyId === story.id));
  assert.deepEqual(normalizeCharacterSystem(clone(switched)), switched);
});

test('external exile offers capture their real accepted polity and close on host change or loss with loadable history', () => {
  let state = success(applyRealmDissolution(fresh(), { id: 'story-host-dissolution',
    hostCandidates: [{ id: 'Kesh', name: 'Kesh' }, { id: 'Keshet', name: 'Keshet' }] }));
  state = act(state, 'seek_refuge', { polityId: 'Kesh' });
  const story = open(state, 'exile_help');
  assert.equal(story.hostKind, 'polity');
  assert.equal(story.hostId, 'Kesh');
  state = normalizeCharacterSystem(clone(state));
  const funded = success(choose(state, story, 'network'));
  assert.equal(funded.families['family-arel'].treasury, state.families['family-arel'].treasury - 10);
  const switched = act(state, 'seek_refuge', { polityId: 'Keshet' });
  assert.equal(switched.stories.find((s) => s.id === story.id).status, 'closed');
  assert.equal(choose(switched, story, 'network').ok, false);
  assert.deepEqual(normalizeCharacterSystem(clone(switched)), switched);
  for (const original of [state, funded]) {
    const lost = success(reconcileExternalHosts(original, { id: `story-host-lost-${original.revision}`, hostCandidates: [] }));
    assert.equal(lost.externalHosts.length, 0);
    assert.equal(lost.stories.find((s) => s.id === story.id).status, original === funded ? 'resolved' : 'closed');
    assert.equal(lost.stories.find((s) => s.id === story.id).hostId, 'Kesh', 'historical source does not infer a replacement');
    assert.equal(candidates(lost, 'exile_help').length, 0);
    assert.deepEqual(normalizeCharacterSystem(clone(lost)), lost);
  }
});

test('open exile stories reject absent, malformed and nonexistent captured hosts', () => {
  let state = fresh();
  state.families['family-arel'].exiled = true;
  state = act(state, 'seek_patron', { familyId: 'family-namar' });
  open(state, 'exile_help');
  for (const mutate of [
    (s) => { delete s.hostKind; },
    (s) => { delete s.hostId; },
    (s) => { s.hostKind = 'invented'; },
    (s) => { s.hostId = 'family-missing'; },
    (s) => { s.hostKind = 'polity'; s.hostId = 'Invented Empire'; },
  ]) {
    const broken = clone(state); mutate(broken.stories.at(-1));
    assert.throws(() => normalizeCharacterSystem(broken), /ogiltiga/);
  }
});

test('temple petition expires when its actual religious leader changes', () => {
  const state = fresh();
  const story = open(state, 'temple_petition');
  state.religions[story.religionId].leaderId = 'person-0-2';
  assert.equal(choose(state, story, 'donate').ok, false);
  const later = advance(state, 1);
  assert.equal(later.stories.find((s) => s.id === story.id).status, 'closed');
});

test('a deadline applies the documented free fallback and its personality stress', () => {
  const state = fresh();
  const story = open(state, 'temple_petition');
  // A subannual due date is not a valid save, but the normal deadline can fall
  // between annual boundaries after loading a campaign with another anniversary.
  state.nextAnnualDate = addGameMonths(state.date, 18);
  state.people[story.targetId].traits = ['greedy'];
  const before = clone(state);
  const final = advance(state, 12);
  const resolved = final.stories.find((s) => s.id === story.id);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.choiceId, 'ignore');
  assert.equal(resolved.automatic, true);
  assert.equal(resolved.resolvedAt, story.dueAt);
  assert.equal(final.realm.treasury, before.realm.treasury);
  assert.equal(final.families[story.playerFamilyId].treasury, before.families[story.playerFamilyId].treasury);
  const explicit = success(choose(before, story, 'ignore'));
  assert.equal(final.people[story.targetId].stress, explicit.people[story.targetId].stress);
  assert.ok(final.memories.some((m) => m.id === resolved.outcomeMemoryId && m.storyId === story.id));
});

test('subannual transition calendar includes a story deadline before the jump target', () => {
  const state = fresh();
  const story = open(state, 'household_tension');
  state.nextAnnualDate = addGameMonths(state.date, 18);
  const final = advance(state, 13);
  const resolved = final.stories.find((s) => s.id === story.id);
  assert.equal(resolved.resolvedAt, story.dueAt);
});

test('resolved causal offers cannot be reopened to claim the same service twice', () => {
  const state = fresh();
  priorPatronage(state, 'Hjälp i hushållet');
  const story = open(state, 'returned_favor');
  story.status = 'resolved'; story.resolvedAt = state.date; story.choiceId = 'ignore';
  assert.equal(candidates(state, 'returned_favor').length, 0);
});

test('public choice rechecks governor mandate and rolls back every wallet on failure', () => {
  const state = fresh();
  const story = open(state, 'governor_audit');
  state.offices[story.officeId].holderId = story.actorId === 'person-0-2' ? 'person-1-2' : 'person-0-2';
  const before = clone(state);
  assert.equal(choose(state, story, 'repair').ok, false);
  assert.deepEqual(state, before);
});

test('selection is deterministic through JSON reloads, seed-sensitive and independent of life and health RNG', () => {
  const selected = new Set();
  for (let seed = 1; seed <= 24; seed++) {
    const state = fresh({ seed });
    const restored = normalizeCharacterSystem(clone(state));
    const life = state.rngState; const health = state.healthRngState;
    const one = scheduleDirectedStory(state, [], context(state), () => {});
    const two = scheduleDirectedStory(restored, [], context(restored), () => {});
    assert.deepEqual(one, two);
    assert.deepEqual(state.storyDirector, restored.storyDirector);
    assert.equal(state.rngState, life);
    assert.equal(state.healthRngState, health);
    selected.add(`${one.eventType}:${one.actorId}`);
  }
  assert.ok(selected.size >= 4, `seeds selected only ${selected.size} casts`);
});

test('template cooldown lasts 36 months, participant cooldown 24 months, and open events are capped', () => {
  const state = fresh();
  const story = scheduleDirectedStory(state, [], context(state), () => {});
  assert.equal(state.storyDirector.cooldowns[`template:${story.eventType}`], addGameMonths(state.date, 36));
  assert.equal(state.storyDirector.cooldowns[`person:${story.actorId}`], addGameMonths(state.date, 24));
  state.date = addGameMonths(state.date, 12);
  assert.ok(!getDirectedStoryCandidates(state, context(state)).some((s) => s.actorId === story.actorId || s.eventType === story.eventType));
  const second = scheduleDirectedStory(state, [], context(state), () => {});
  assert.ok(second);
  state.date = addGameMonths(state.date, 12);
  const rng = state.storyDirector.rngState;
  assert.equal(scheduleDirectedStory(state, [], context(state), () => {}), null);
  assert.equal(state.storyDirector.rngState, rng);
  assert.ok(getDirectedStoryCandidates(state, context(state)).some((s) => s.actorId === story.actorId && s.eventType !== story.eventType));
  state.date = addGameMonths(state.date, 12);
  assert.ok(candidates(state, story.eventType).some((s) => s.actorId === story.actorId));
});

test('personality, stress, actual offices, city unrest and religion determine eligible casts', () => {
  const state = fresh();
  assert.ok(candidates(state, 'household_tension').some((s) => s.actorId === 'person-0-2'));
  state.people['person-0-2'].stress = 0;
  assert.ok(!candidates(state, 'household_tension').some((s) => s.actorId === 'person-0-2'));
  const student = candidates(state, 'promising_student')[0];
  state.people[student.targetId].traits = ['curious'];
  const curious = candidates(state, 'promising_student').find((s) => s.actorId === student.actorId).weight;
  state.people[student.targetId].traits = ['greedy'];
  assert.ok(curious > candidates(state, 'promising_student').find((s) => s.actorId === student.actorId).weight);
  for (const city of Object.values(state.cities)) city.unrest = 0;
  assert.equal(candidates(state, 'governor_audit').length, 0);
  for (const religion of Object.values(state.religions)) religion.support = 100;
  assert.equal(candidates(state, 'temple_petition').length, 0);
  state.people[student.targetId].traits = ['zealous'];
  assert.ok(candidates(state, 'temple_petition').length);
  state.identity.familyId = 'family-namar';
  state.people['person-1-0'].stress = 0;
  assert.equal(candidates(state, 'governor_audit').length, 0);
  assert.equal(candidates(state, 'veteran_petition').length, 0);
});

test('every template exposes an enabled free fallback with a named effect and persists its causal outcome', () => {
  for (const type of CHARACTER_EVENT_TYPES) {
    const state = fresh();
    if (type === 'exile_help') { state.families['family-arel'].exiled = true; state.families['family-arel'].hostFamilyId = 'family-namar'; }
    if (type === 'returned_favor') priorPatronage(state, 'Ett tidigare möte');
    if (type === 'reconciliation') {
      state.memories.push({ id: 'source-fixture', type: 'insult',
        title: 'Ett tidigare möte', date: addGameMonths(state.date, -48), knownBy: 'public',
        participants: ['person-0-0', 'person-1-0'], beneficiaryId: 'person-1-0',
        beneficiaryFamilyId: 'family-namar', sponsorFamilyId: 'family-arel' });
    }
    const story = open(state, type);
    const visible = getCharacterPresentation(state).stories.find((s) => s.id === story.id);
    const fallback = visible.choices.find((choice) => choice.id === 'ignore');
    assert.equal(fallback.disabledReason, '', type);
    assert.equal(fallback.cost, '0 silver', type);
    assert.ok(visible.fallbackDescription.includes(fallback.label), type);
    assert.ok(visible.triggerDescription, type);
    if (story.causeId) assert.equal(visible.causeTitle, 'Ett tidigare möte');
    const final = success(choose(state, story, 'ignore'));
    const resolved = final.stories.find((s) => s.id === story.id);
    const memory = final.memories.find((m) => m.id === resolved.outcomeMemoryId);
    assert.equal(memory.storyId, story.id);
    assert.equal(memory.causeId, story.causeId || story.id);
    assert.deepEqual(normalizeCharacterSystem(clone(final)), final);
  }
});

test('personal support spends only family funds, applies personality stress, and names its opinion cause', () => {
  const state = fresh();
  state.people['person-0-0'].traits = ['greedy'];
  const story = open(state, 'household_tension');
  const actor = state.people[story.actorId]; const ruler = state.people[story.targetId];
  const view = getCharacterPresentation(state).stories.find((s) => s.id === story.id);
  assert.equal(view.choices.find((c) => c.id === 'relieve').stress, '14');
  const final = success(choose(state, story, 'relieve', { actorId: 'person-1-0' }));
  assert.equal(final.families['family-arel'].treasury, state.families['family-arel'].treasury - 12);
  assert.equal(final.realm.treasury, state.realm.treasury);
  assert.equal(final.people[actor.id].stress, actor.stress - 20);
  assert.equal(final.people[ruler.id].stress, ruler.stress + 14);
  assert.equal(getPersonalOpinion(final, actor.id, ruler.id), getPersonalOpinion(state, actor.id, ruler.id) + 10);
  const outcome = final.stories.find((s) => s.id === story.id).outcomeMemoryId;
  assert.equal(final.memories.find((m) => m.id === outcome).type, 'story_patronage');
  assert.ok(final.relations[`${actor.id}:${ruler.id}`].causes.some((cause) => cause.causeId === outcome));
  assert.deepEqual(state.people[ruler.id].traits, ['greedy'], 'input is immutable');
  const poor = clone(state); poor.families['family-arel'].treasury = 11;
  const rejected = choose(poor, story, 'relieve');
  assert.equal(rejected.ok, false);
  assert.equal(rejected.state, poor);
  assert.deepEqual(rejected.events, []);
});

test('public repairs spend only the state wallet and lose authority after the player family loses office', () => {
  const state = fresh();
  const story = open(state, 'governor_audit');
  const final = success(choose(state, story, 'repair'));
  assert.equal(final.realm.treasury, state.realm.treasury - 25);
  assert.equal(final.families['family-arel'].treasury, state.families['family-arel'].treasury);
  assert.equal(final.cities[story.cityId].unrest, state.cities[story.cityId].unrest - 12);
  assert.equal(final.cities[story.cityId].infrastructure, state.cities[story.cityId].infrastructure + 1);
  const lost = clone(state); lost.offices.ruler.holderId = 'person-1-0';
  assert.equal(canCharacterDirectRealm(lost), false);
  assert.ok(getCharacterPresentation(lost).stories.find((s) => s.id === story.id).choices.every((c) => c.disabledReason));
  assert.equal(choose(lost, story, 'repair').ok, false);
  const closed = advance(lost, 1).stories.find((s) => s.id === story.id);
  assert.equal(closed.status, 'closed');
});

test('dead participants, changed households and adult students close without charging funds', () => {
  for (const reason of ['dead', 'household', 'adult']) {
    const state = fresh();
    const story = open(state, reason === 'adult' ? 'promising_student' : 'household_tension');
    const person = state.people[story.actorId];
    if (reason === 'dead') person.diedAt = state.date;
    if (reason === 'household') person.familyId = 'family-namar';
    if (reason === 'adult') person.bornAt = addGameMonths(state.date, -18 * 12);
    const final = advance(state, 1);
    assert.equal(final.stories.find((s) => s.id === story.id).status, 'closed', reason);
    assert.equal(final.families['family-arel'].treasury, state.families['family-arel'].treasury, reason);
    assert.equal(final.realm.treasury, state.realm.treasury, reason);
    assert.ok(!final.memories.some((m) => m.storyId === story.id), reason);
  }
});

test('a harsh household demand causes a reconciliation opportunity and a resolved cause cannot recur', () => {
  const state = fresh();
  const story = open(state, 'household_tension');
  const fractured = success(choose(state, story, 'demand'));
  const causeId = fractured.stories.find((s) => s.id === story.id).outcomeMemoryId;
  assert.ok(candidates(fractured, 'reconciliation').some((s) => s.causeId === causeId && s.actorId === story.actorId));
  const repair = open(fractured, 'reconciliation');
  const reconciled = success(choose(fractured, repair, 'reconcile'));
  assert.ok(reconciled.memories.some((m) => m.storyId === repair.id && m.causeId === causeId));
  assert.ok(reconciled.memories.some((m) => m.id === causeId), 'reconciliation preserves old memory');
  assert.ok(!candidates(reconciled, 'reconciliation').some((s) => s.causeId === causeId));
});

test('patronage returns after three years through actual family heads and silver debits the giver', () => {
  const state = fresh();
  const supported = success(choose(state, open(state, 'temple_petition'), 'donate'));
  const source = supported.memories.find((m) => m.type === 'story_patronage');
  assert.equal(candidates(supported, 'returned_favor').length, 0);
  supported.date = addGameMonths(supported.date, 36);
  assert.ok(candidates(supported, 'returned_favor').some((s) => s.actorId === source.beneficiaryId));
  const donorFamily = supported.families[source.beneficiaryFamilyId];
  supported.people[source.beneficiaryId].diedAt = supported.date;
  donorFamily.headId = Object.values(supported.people).find((p) => p.familyId === donorFamily.id && !p.diedAt && getCharacterAge(p, supported.date) >= 18).id;
  supported.people[source.participants[1]].diedAt = supported.date;
  supported.families['family-arel'].headId = 'person-0-2';
  const offer = open(supported, 'returned_favor');
  assert.equal(offer.actorId, donorFamily.headId);
  assert.equal(offer.targetId, 'person-0-2');
  supported.people[offer.actorId].wealth = 11;
  assert.equal(choose(supported, offer, 'silver').ok, false);
  supported.people[offer.actorId].wealth = 30;
  const paid = success(choose(supported, offer, 'silver'));
  assert.equal(paid.people[offer.actorId].wealth, 18);
  assert.equal(paid.families['family-arel'].treasury, supported.families['family-arel'].treasury + 12);
  assert.equal(paid.realm.treasury, supported.realm.treasury);
  assert.ok(!candidates(paid, 'returned_favor').some((s) => s.causeId === source.id));
});

test('presentation exposes only director version and visible source titles', () => {
  const state = fresh();
  const view = getCharacterPresentation(state);
  assert.equal(view.versions.stories, 1);
  assert.equal(view.storyDirector, undefined);
  assert.equal(JSON.stringify(view).includes('rngState'), false);
});

test('all described choice effects change the named participant, institution or resource owner', () => {
  const cases = [
    ['household_tension', 'demand', 0, false, -10, (s, before, story) => {
      assert.equal(s.people[story.actorId].stress, before.people[story.actorId].stress + 10);
      assert.equal(s.families[story.playerFamilyId].influence, before.families[story.playerFamilyId].influence + 3);
    }],
    ['household_tension', 'ignore', 0, false, -3, (s, before, story) => assert.equal(s.people[story.actorId].stress, before.people[story.actorId].stress + 5)],
    ['promising_student', 'teach', 18, false, 10, (s, before, story) => assert.equal(s.people[story.actorId].skills.learning, before.people[story.actorId].skills.learning + 1)],
    ['promising_student', 'ignore', 0, false, -3],
    ['temple_petition', 'donate', 20, false, 12, (s, before, story) => assert.equal(s.religions[story.religionId].support, before.religions[story.religionId].support + 5)],
    ['temple_petition', 'ignore', 0, false, -8],
    ['governor_audit', 'censure', 0, true, -15, (s, before, story) => {
      assert.equal(s.cities[story.cityId].unrest, before.cities[story.cityId].unrest - 4);
      assert.equal(s.families[story.familyId].grievance, before.families[story.familyId].grievance - 4);
    }],
    ['governor_audit', 'ignore', 0, false, 0, (s, before, story) => assert.equal(s.cities[story.cityId].unrest, before.cities[story.cityId].unrest + 4)],
    ['veteran_petition', 'pay', 22, true, 10, (s, before) => assert.equal(s.realm.armyStrength, before.realm.armyStrength + 5)],
    ['veteran_petition', 'drill', 0, true, -8, (s, before, story) => {
      assert.equal(s.realm.armyStrength, before.realm.armyStrength + 2);
      assert.equal(s.people[story.actorId].stress, before.people[story.actorId].stress + 8);
    }],
    ['veteran_petition', 'ignore', 0, false, -5, (s, before) => assert.equal(s.realm.armyStrength, before.realm.armyStrength - 2)],
    ['reconciliation', 'reconcile', 15, false, 18, (s, before, story) => assert.equal(s.families[story.familyId].grievance, before.families[story.familyId].grievance + 4)],
    ['reconciliation', 'ignore', 0, false, -5],
    ['exile_help', 'network', 10, false, 8, (s, before, story) => assert.equal(s.families[story.playerFamilyId].influence, before.families[story.playerFamilyId].influence + 5)],
    ['exile_help', 'ignore', 0, false, 0, (s, before, story) => assert.equal(s.families[story.playerFamilyId].influence, before.families[story.playerFamilyId].influence - 2)],
    ['returned_favor', 'endorse', 0, false, 5, (s, before, story) => assert.equal(s.families[story.playerFamilyId].influence, before.families[story.playerFamilyId].influence + 6)],
    ['returned_favor', 'ignore', 0, false, 4],
  ];
  for (const [type, choiceId, amount, publicFunds, opinion, verify] of cases) {
    const state = fresh();
    if (type === 'exile_help') { state.families['family-arel'].exiled = true; state.families['family-arel'].hostFamilyId = 'family-namar'; }
    if (type === 'returned_favor') priorPatronage(state, 'Familjernas möte');
    if (type === 'reconciliation') state.memories.push({ id: 'effect-source', type: 'insult',
      title: 'Familjernas möte', date: addGameMonths(state.date, -48), knownBy: 'public', participants: ['person-0-0', 'person-1-0'],
      beneficiaryId: 'person-1-0', beneficiaryFamilyId: 'family-namar', sponsorFamilyId: 'family-arel' });
    const story = open(state, type);
    const final = success(choose(state, story, choiceId));
    assert.equal(final.realm.treasury, state.realm.treasury - (publicFunds ? amount : 0), `${type}:${choiceId} state wallet`);
    assert.equal(final.families[story.playerFamilyId].treasury, state.families[story.playerFamilyId].treasury - (publicFunds ? 0 : amount), `${type}:${choiceId} family wallet`);
    assert.equal(getPersonalOpinion(final, story.actorId, story.targetId), getPersonalOpinion(state, story.actorId, story.targetId) + opinion, `${type}:${choiceId} opinion`);
    verify?.(final, state, story);
    const outcome = final.stories.find((s) => s.id === story.id).outcomeMemoryId;
    assert.ok(final.memories.some((m) => m.id === outcome && m.storyId === story.id), `${type}:${choiceId} memory`);
    if (opinion) assert.ok(final.relations[`${story.actorId}:${story.targetId}`].causes.some((cause) => cause.causeId === outcome), `${type}:${choiceId} cause`);
  }
});

test('a long jump equals monthly stepping and JSON reloads over more than sixty years', () => {
  const initial = fresh({ seed: 77 });
  const once = advance(initial, 65 * 12);
  assert.ok(compareGameDates(once.date, addGameMonths(initial.date, 60 * 12)) > 0, 'the dynasty actually survives beyond sixty years');
  let split = initial;
  for (let month = 0; month < 65 * 12 && !split.status.ended; month++) {
    split = advance(normalizeCharacterSystem(clone(split)), 1);
    assert.ok(split.stories.filter((s) => s.type === 'character_event' && s.status === 'open').length <= 2);
    assert.ok(Object.values(split.families).every((f) => f.treasury >= 0));
    assert.ok(Object.values(split.people).every((p) => p.wealth >= 0));
    assert.ok(split.realm.treasury >= 0);
    for (const story of split.stories.filter((s) => s.type === 'character_event')) {
      assert.ok(split.people[story.actorId] && split.people[story.targetId]);
      if (story.status === 'open') assert.ok(compareGameDates(story.dueAt, split.date) > 0);
    }
  }
  assert.deepEqual(stripCommands(once), stripCommands(split));
  assert.deepEqual(normalizeCharacterSystem(clone(once)), once);
});

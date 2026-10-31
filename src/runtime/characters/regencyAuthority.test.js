import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { attachMandateGrant } from './mandateEpisodes.js';
import { advanceCharacters, canCharacterDirectRealm, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, getNextCharacterTransitionDate, normalizeCharacterSystem } from './index.js';

let sequence = 0;
const attempt = (state, type, payload = {}) => executeCharacterCommand(state, { id: `authority-${++sequence}`, expectedRevision: state.revision, type, payload });
function command(state, type, payload) { const result = attempt(state, type, payload); assert.equal(result.ok, true, result.error); return result.state; }
function minority(mode = 'realm', familyId = 'family-arel', traits = ['ambitious']) {
  const state = createCharacterSystem({ seed: 321, mode, familyId });
  const principal = state.people['person-0-4'], regent = state.people['person-0-0'];
  principal.traits = ['dutiful']; regent.traits = traits; regent.loyalty = 90;
  state.offices.ruler.holderId = principal.id; state.offices.ruler.regentId = regent.id;
  state.realm.lawfulRulerId = principal.id;
  state.regencies['office:ruler'] = { id: 'office:ruler', principalId: principal.id, regentId: regent.id, phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
  state.offices.chancellor.holderId = null;
  state.stories = [];
  // This fixture enters through the legacy-save activation path.
  delete state.mandateVersion; delete state.mandateActivatedAt; delete state.mandateSequence;
  return normalizeCharacterSystem(state);
}
function promise(state, type = 'promise_due', officeId = 'chancellor') {
  const story = { id: `promise-${++sequence}`, type, title: 'Ett ämbetslöfte', description: 'Familjen inväntar besked.', actorId: 'person-1-2', targetId: state.offices.ruler.holderId, familyId: 'family-namar', officeId, createdAt: state.date, dueAt: state.date, status: 'open', knownBy: 'public' };
  state.stories.push(story); return story.id;
}
function grant(state, type = 'appoint', mandate = 'office:ruler') {
  const record = state.regencies[mandate];
  record.grants.push(attachMandateGrant(record, { actionType: type, grantedAt: state.date, expiresAt: addGameMonths(state.date, 24), usedAt: null, approach: 'negotiate' }));
}

for (const mode of ['realm', 'family']) test(`annual NPC appointments do not compete with the player's royal regent in ${mode} mode`, () => {
  const state = minority(mode);
  const result = advanceCharacters(state, state.nextAnnualDate);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.offices.ruler.regentId, 'person-0-0');
  assert.equal(result.state.offices.chancellor.holderId, null);
});

test('royal veto and a negotiated single-use consent apply in both campaign modes', () => {
  for (const mode of ['realm', 'family']) {
    let state = minority(mode);
    const before = JSON.stringify(state);
    const denied = attempt(state, 'appoint', { officeId: 'chancellor', personId: 'person-2-2' });
    assert.equal(denied.ok, false); assert.match(denied.error, /samtycker/); assert.equal(JSON.stringify(state), before);
    state = command(state, 'request_regent_consent', { regencyId: 'office:ruler', actionType: 'appoint', approach: 'negotiate' });
    const granted = JSON.stringify(state);
    const invalid = attempt(state, 'appoint', { officeId: 'ruler', personId: 'person-2-2' });
    assert.equal(invalid.ok, false); assert.equal(JSON.stringify(invalid.state), granted);
    state = command(state, 'appoint', { officeId: 'chancellor', personId: 'person-2-2' });
    assert.equal(state.regencies['office:ruler'].grants[0].usedAt, state.date);
    assert.equal(attempt(state, 'appoint', { officeId: 'general', personId: 'person-2-2' }).ok, false);
  }
});

test('NPC annual appointments obey the royal veto and consume one grant for one vacancy', () => {
  const state = minority('family', 'family-namar');
  state.offices.general.holderId = null;
  const denied = advanceCharacters(state, state.nextAnnualDate);
  assert.equal(denied.state.offices.chancellor.holderId, null);
  assert.equal(denied.state.offices.general.holderId, null);
  grant(state);
  const allowed = advanceCharacters(state, state.nextAnnualDate);
  assert.equal([allowed.state.offices.general, allowed.state.offices.chancellor].filter((o) => o.holderId).length, 1);
  assert.equal(allowed.state.regencies['office:ruler'].grants[0].usedAt, state.nextAnnualDate);
});

for (const type of ['promise_due', 'legacy_claim']) for (const choiceId of ['observe', 'advocate']) {
  test(`${type}/${choiceId} uses the adult executive and applies the royal appointment veto`, () => {
    const state = minority('family', 'family-namar', ['dutiful', 'ambitious']);
    const id = promise(state, type);
    const before = JSON.stringify(state);
    const denied = attempt(state, 'resolve_story', { storyId: id, choiceId });
    assert.equal(denied.ok, false); assert.match(denied.error, /samtycker/);
    assert.equal(JSON.stringify(denied.state), before);
    grant(state);
    const familySilver = state.families['family-namar'].treasury;
    const allowed = command(state, 'resolve_story', { storyId: id, choiceId });
    assert.equal(allowed.offices.chancellor.holderId, 'person-1-2');
    assert.equal(allowed.realm.treasury, state.realm.treasury - 10);
    assert.equal(allowed.families['family-namar'].treasury, familySilver - (choiceId === 'advocate' ? 10 : 0));
    assert.equal(allowed.regencies['office:ruler'].grants[0].usedAt, state.date);
  });
}

test('the child personality cannot make an NPC regent promise or honor an office', () => {
  for (const type of ['office_promise', 'promise_due', 'legacy_claim']) {
    const state = minority('family', 'family-namar', ['greedy']);
    const id = promise(state, type);
    const next = command(state, 'resolve_story', { storyId: id, choiceId: 'observe' });
    assert.equal(next.offices.chancellor.holderId, null);
    assert.equal(next.stories.some((s) => s.id !== id && s.type === 'promise_due'), false);
    assert.equal(next.realm.treasury, state.realm.treasury);
  }
});

test('an NPC regent can promise an office regardless of the child personality', () => {
  const state = minority('family', 'family-namar', ['dutiful']);
  state.people['person-0-4'].traits = ['greedy'];
  const id = promise(state, 'office_promise');
  const next = command(state, 'resolve_story', { storyId: id, choiceId: 'observe' });
  assert.ok(next.stories.some((s) => s.id !== id && s.type === 'promise_due' && s.status === 'waiting'));
});

test('contested authority defers a valid story without payment or automatic closure', () => {
  const state = minority('family', 'family-namar');
  state.people['person-0-4'].bornAt = addGameMonths(state.date, -18 * 12);
  state.regencies['office:ruler'].phase = 'contested';
  const id = promise(state);
  state.stories[0].createdAt = addGameMonths(state.date, -36);
  assert.equal(canCharacterDirectRealm(state), false);
  const before = JSON.stringify(state);
  assert.equal(attempt(state, 'resolve_story', { storyId: id, choiceId: 'advocate' }).ok, false);
  assert.equal(JSON.stringify(state), before);
  const choices = getCharacterPresentation(state).stories.find((s) => s.id === id).choices;
  assert.ok(choices.some((c) => c.id === 'defer' && !c.disabledReason));
  const result = advanceCharacters(state, state.nextAnnualDate);
  assert.equal(result.state.offices.chancellor.holderId, null);
  assert.equal(result.state.stories.find((s) => s.id === id).status, 'waiting');
});

test('a separate family guardian gains no royal mandate', () => {
  const state = minority('family', 'family-namar');
  const family = state.families['family-namar'];
  family.headId = 'person-1-4'; family.guardianId = 'person-0-0';
  state.regencies['family:family-namar'] = { ...structuredClone(state.regencies['office:ruler']), id: 'family:family-namar', principalId: family.headId };
  assert.equal(canCharacterDirectRealm(state), false);
  assert.equal(attempt(state, 'appoint', { officeId: 'chancellor', personId: 'person-2-2' }).ok, false);
});

test('split guardians keep family and royal vetoes separate without granting state control', () => {
  let state = minority('family');
  const family = state.families['family-arel'];
  family.headId = 'person-0-4'; family.guardianId = 'person-0-1';
  state.people[family.guardianId].traits = ['greedy'];
  state.regencies['family:family-arel'] = { ...structuredClone(state.regencies['office:ruler']), id: 'family:family-arel', regentId: family.guardianId };
  const view = getCharacterPresentation(state);
  assert.deepEqual(view.governance.regencies.map((r) => r.id).sort(), ['family:family-arel', 'office:ruler']);
  assert.equal(canCharacterDirectRealm(state), false);
  assert.match(attempt(state, 'build_estate').error, /samtycker/);
  assert.equal(attempt(state, 'appoint', { officeId: 'chancellor', personId: 'person-2-2' }).ok, false);
  grant(state, 'build_estate', 'family:family-arel');
  grant(state);
  state = command(state, 'build_estate');
  assert.equal(state.regencies['family:family-arel'].grants[0].usedAt, state.date);
  assert.equal(state.regencies['office:ruler'].grants[0].usedAt, null);
  assert.equal(canCharacterDirectRealm(state), false);
});

test('an external royal regent keeps the same state rights and veto in their own family campaign', () => {
  for (const mode of ['realm', 'family']) {
    const state = minority(mode, 'family-namar');
    state.offices.ruler.regentId = 'person-1-0';
    state.regencies['office:ruler'].regentId = 'person-1-0';
    state.people['person-1-0'].traits = ['ambitious'];
    assert.equal(canCharacterDirectRealm(state), true);
    assert.match(attempt(state, 'appoint', { officeId: 'chancellor', personId: 'person-2-2' }).error, /samtycker/);
    const result = advanceCharacters(state, state.nextAnnualDate);
    assert.equal(result.state.offices.chancellor.holderId, null);
  }
});

test('NPC promise validation rolls back invalid candidates, offices and unaffordable advocacy', () => {
  for (const invalid of ['office', 'exiled', 'money']) {
    const state = minority('family', 'family-namar', ['dutiful']);
    const id = promise(state);
    if (invalid === 'office') state.stories[0].officeId = 'ruler';
    if (invalid === 'exiled') state.families['family-namar'].exiled = true;
    if (invalid === 'money') state.families['family-namar'].treasury = 0;
    grant(state);
    const before = JSON.stringify(state);
    const result = attempt(state, 'resolve_story', { storyId: id, choiceId: 'advocate' });
    assert.equal(result.ok, false, invalid);
    assert.equal(JSON.stringify(result.state), before);
  }
});

test('missing executive offers free deferral and never charges for an unsupported decision', () => {
  const state = minority('family', 'family-namar');
  // A vacancy is reconciled before commands; genuinely leave no eligible adult.
  for (const person of Object.values(state.people)) person.bornAt = addGameMonths(state.date, -10 * 12);
  state.offices.ruler.regentId = null;
  delete state.regencies['office:ruler'];
  const id = promise(state, 'office_promise');
  const before = JSON.stringify(state);
  assert.equal(attempt(state, 'resolve_story', { storyId: id, choiceId: 'support' }).ok, false);
  assert.equal(JSON.stringify(state), before);
  const next = command(state, 'resolve_story', { storyId: id, choiceId: 'defer' });
  assert.equal(next.realm.treasury, state.realm.treasury);
  assert.equal(next.families['family-namar'].treasury, state.families['family-namar'].treasury);
  assert.equal(next.stories.find((s) => s.id === id).status, 'waiting');
});

test('NPC office promises respect veto before support costs and leave consent for the actual appointment', () => {
  const state = minority('family', 'family-namar', ['dutiful', 'ambitious']);
  const id = promise(state, 'office_promise');
  assert.equal(attempt(state, 'resolve_story', { storyId: id, choiceId: 'support' }).ok, false);
  grant(state);
  const next = command(state, 'resolve_story', { storyId: id, choiceId: 'support' });
  assert.equal(next.families['family-namar'].treasury, state.families['family-namar'].treasury - 10);
  assert.equal(next.regencies['office:ruler'].grants[0].usedAt, null);
  assert.equal(next.offices.chancellor.holderId, null);
});

test('expired NPC appointment consent cannot be used by observation or by the annual AI', () => {
  const state = minority('family', 'family-namar', ['dutiful', 'ambitious']);
  grant(state); state.regencies['office:ruler'].grants[0].expiresAt = state.date;
  const id = promise(state);
  assert.equal(attempt(state, 'resolve_story', { storyId: id, choiceId: 'observe' }).ok, false);
  const next = advanceCharacters(state, state.nextAnnualDate).state;
  assert.equal(next.offices.chancellor.holderId, null);
  assert.equal(next.regencies['office:ruler'].grants[0].usedAt, null);
});

test('contested royal mandates block the regent family as well as the nominal ruler', () => {
  const state = minority('family');
  state.people['person-0-4'].bornAt = addGameMonths(state.date, -18 * 12);
  state.regencies['office:ruler'].phase = 'contested';
  assert.equal(canCharacterDirectRealm(state), false);
  assert.equal(attempt(state, 'tax_policy', { policy: 'harsh' }).ok, false);
  const next = command(state, 'resolve_regency', { regencyId: 'office:ruler', approach: 'pension' });
  assert.equal(next.offices.ruler.regentId, null);
  assert.equal(canCharacterDirectRealm(next), false);
});

test('regency decisions survive JSON resume and keep split calendar outcomes deterministic', () => {
  const state = minority('family', 'family-namar', ['ambitious']);
  grant(state);
  const target = addGameMonths(state.date, 24);
  const whole = advanceCharacters(state, target).state;
  let split = normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
  for (let month = 1; month <= 24; month++) split = normalizeCharacterSystem(JSON.parse(JSON.stringify(advanceCharacters(split, addGameMonths(state.date, month)).state)));
  const domain = (s) => { const copy = structuredClone(s); delete copy.revision; delete copy.appliedCommandIds; return copy; };
  assert.deepEqual(domain(split), domain(whole));
});

test('NPC appointment ranking follows the regent opinion instead of the child opinion', () => {
  const state = minority('family', 'family-namar', ['dutiful']);
  for (const person of Object.values(state.people)) person.skills.stewardship = 0;
  for (const id of ['person-2-2', 'person-3-2']) state.people[id].skills.stewardship = 20;
  for (const [fromId, toId] of [['person-0-0', 'person-2-2'], ['person-0-4', 'person-3-2']]) {
    state.relations[`${fromId}:${toId}`] = { fromId, toId, bonds: [], causes: [{ id: `ranking:${fromId}`, causeId: 'fixture-ranking', amount: 90, startAt: state.date, expiresAt: null }] };
  }
  const result = advanceCharacters(state, state.nextAnnualDate);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.offices.chancellor.holderId, 'person-2-2');
});

test('two royal consents are not consumed by one story appointment', () => {
  const state = minority('family', 'family-namar', ['dutiful', 'ambitious']);
  grant(state); grant(state);
  const id = promise(state);
  const next = command(state, 'resolve_story', { storyId: id, choiceId: 'observe' });
  assert.deepEqual(next.regencies['office:ruler'].grants.map((g) => g.usedAt), [state.date, null]);
  const retry = executeCharacterCommand(next, { id: next.appliedCommandIds.at(-1), expectedRevision: state.revision, type: 'resolve_story', payload: { storyId: id, choiceId: 'observe' } });
  assert.equal(retry.duplicate, true);
  assert.deepEqual(retry.state, next);
});

for (const type of ['office_promise', 'promise_due', 'legacy_claim']) test(`${type} reopens on its exact midyear deferral deadline with deterministic replay`, () => {
  let state = minority('family', 'family-namar', ['dutiful', 'ambitious']);
  state = advanceCharacters(state, addGameMonths(state.date, 6)).state;
  const id = promise(state, type);
  state.stories.find((s) => s.id === id).createdAt = addGameMonths(state.date, -36);
  state = command(state, 'resolve_story', { storyId: id, choiceId: 'defer' });
  const deadline = state.stories.find((s) => s.id === id).dueAt;
  const before = advanceCharacters(state, addGameMonths(deadline, -1)).state;
  assert.equal(before.stories.find((s) => s.id === id).status, 'waiting');
  assert.equal(getNextCharacterTransitionDate(before, addGameMonths(deadline, 1)), deadline);
  const reopened = advanceCharacters(before, deadline);
  assert.equal(reopened.state.stories.find((s) => s.id === id).status, 'open');
  assert.ok(getCharacterPresentation(reopened.state).stories.find((s) => s.id === id).choices.length);
  assert.equal(reopened.events.filter((e) => e.type === 'story' && e.title === 'Ett ämbetslöfte').length, 1);
  const retry = advanceCharacters(reopened.state, deadline);
  assert.equal(retry.duplicate, true); assert.deepEqual(retry.events, []);
  const target = addGameMonths(deadline, 6);
  const whole = advanceCharacters(state, target).state;
  let split = normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
  for (let month = 1; month <= 18; month++) split = normalizeCharacterSystem(JSON.parse(JSON.stringify(advanceCharacters(split, addGameMonths(state.date, month)).state)));
  const domain = (s) => { const copy = structuredClone(s); delete copy.revision; delete copy.appliedCommandIds; return copy; };
  assert.deepEqual(domain(split), domain(whole));
  assert.equal(whole.stories.find((s) => s.id === id).status, 'open');
});

test('an old deferred promise reopens at an annual boundary without expiring in the same update', () => {
  let state = minority();
  const id = promise(state);
  state.stories[0].createdAt = addGameMonths(state.date, -36);
  state = command(state, 'resolve_story', { storyId: id, choiceId: 'defer' });
  const result = advanceCharacters(state, state.nextAnnualDate);
  assert.equal(result.state.stories.find((s) => s.id === id).status, 'open');
  assert.equal(result.events.filter((e) => e.type === 'story_deferred').length, 0);
});

for (const type of ['office_promise', 'promise_due', 'legacy_claim']) test(`${type} validates optional reopening dates without mutating rejected saves`, () => {
  const state = minority();
  promise(state, type);
  state.stories[0].createdAt = addGameMonths(state.date, -36);
  state.stories[0].reopenedAt = state.date;
  assert.deepEqual(normalizeCharacterSystem(JSON.parse(JSON.stringify(state))), state);
  for (const invalid of ['not-a-date', true, false, null, 123, {}, [], '', '-300-01-01', ' -0300-01-01', addGameMonths(state.date, 1), addGameMonths(state.stories[0].createdAt, -1)]) {
    const malformed = structuredClone(state); malformed.stories[0].reopenedAt = invalid;
    const before = JSON.stringify(malformed);
    assert.throws(() => normalizeCharacterSystem(malformed), /återöppningsdatum/, JSON.stringify(invalid));
    assert.equal(JSON.stringify(malformed), before);
  }
  const beforeDue = structuredClone(state); beforeDue.stories[0].dueAt = addGameMonths(state.date, 1);
  assert.throws(() => normalizeCharacterSystem(beforeDue), /återöppningsdatum/);
  const invalidDue = structuredClone(state); invalidDue.stories[0].dueAt = true;
  assert.throws(() => normalizeCharacterSystem(invalidDue), /återöppningsdatum/);
  const invalidCreation = structuredClone(state); invalidCreation.stories[0].createdAt = 'not-a-date';
  assert.throws(() => normalizeCharacterSystem(invalidCreation), /återöppningsdatum/);
  const deferredAgain = structuredClone(state);
  deferredAgain.stories[0].status = 'waiting'; deferredAgain.stories[0].dueAt = addGameMonths(state.date, 12);
  assert.deepEqual(normalizeCharacterSystem(JSON.parse(JSON.stringify(deferredAgain))), deferredAgain);
  const closedBeforeDeadline = structuredClone(deferredAgain);
  closedBeforeDeadline.stories[0].status = 'closed'; closedBeforeDeadline.stories[0].resolvedAt = state.date;
  assert.deepEqual(normalizeCharacterSystem(JSON.parse(JSON.stringify(closedBeforeDeadline))), closedBeforeDeadline);
  deferredAgain.stories[0].dueAt = state.date;
  assert.throws(() => normalizeCharacterSystem(deferredAgain), /återöppningsdatum/);
});

test('legacy office stories without reopenedAt retain normal automatic expiry', () => {
  const state = minority();
  const id = promise(state, 'office_promise');
  state.stories[0].createdAt = addGameMonths(state.date, -36);
  const normalized = normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
  assert.equal(Object.hasOwn(normalized.stories[0], 'reopenedAt'), false);
  const next = advanceCharacters(normalized, normalized.nextAnnualDate);
  assert.equal(next.state.stories.find((s) => s.id === id).status, 'resolved');
});

for (const choiceId of ['promise', 'observe', 'support']) test(`a later ${choiceId} creates a new promise without inheriting the parent reopening date`, () => {
  let state = choiceId === 'promise' ? minority() : minority('family', 'family-namar', ['dutiful']);
  const id = promise(state, 'office_promise');
  state.stories[0].createdAt = addGameMonths(state.date, -36);
  state.stories[0].reopenedAt = state.date;
  state = normalizeCharacterSystem(state);
  state = advanceCharacters(state, addGameMonths(state.date, 3)).state;
  const next = command(state, 'resolve_story', { storyId: id, choiceId });
  const child = next.stories.find((s) => s.id !== id && s.type === 'promise_due');
  assert.ok(child);
  assert.equal(child.createdAt, state.date);
  assert.equal(child.status, 'waiting');
  assert.equal(Object.hasOwn(child, 'reopenedAt'), false);
  assert.deepEqual(normalizeCharacterSystem(JSON.parse(JSON.stringify(next))), next);
  assert.equal(next.stories.find((s) => s.id === id).reopenedAt, addGameMonths(state.date, -3));
});

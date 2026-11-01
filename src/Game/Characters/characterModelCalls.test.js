import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHooks, createCharacterSystem, estimateCharacterAction, estimateConversation, getCharacterPresentation, getConversationBrief } from '../../runtime/characters/index.js';
import { createRumor } from '../../runtime/characters/rumors.js';
import { createSecret, grantHook } from '../../runtime/characters/secrets.js';
import { getModelCallCounts, recordModelCall, subscribeModelCalls } from '../AI/modelCallCounter.js';
import { extractConversationRequest, interpretCharacterAction, narrateCharacterResolution, replyAsCharacter } from './characterModelCalls.js';

const REP = 'person-0-0';
const TARGET = 'person-1-0';
const view = () => getCharacterPresentation(createCharacterSystem({ seed: 321 }));

// A callModel that answers from a queue and records every request it receives.
function fakeModel(...answers) {
  const calls = [];
  const callModel = async (request) => {
    calls.push(request);
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return typeof answer === 'string' ? { rawText: answer, toolInput: null } : { rawText: '', toolInput: answer };
  };
  return { callModel, calls };
}
const swayAnswer = (extra = {}) => ({ status: 'action', catalogId: 'sway', actorId: REP, targetIds: [TARGET], silver: 10, agentRoles: ['cook'], payload: {}, explanation: 'Spelaren vill vinna personens gunst.', suggestions: [], ...extra });

test('interpret maps a valid answer to an attempt_action intent', async () => {
  const { callModel, calls } = fakeModel(swayAnswer());
  const result = await interpretCharacterAction({ text: 'Jag vill smickra Arel-sonen', view: view(), callModel });
  assert.equal(result.ok, true);
  assert.equal(result.catalogId, 'sway');
  assert.equal(result.mode, 'contested');
  assert.deepEqual(result.payload, { actionId: 'sway', actorId: REP, targetIds: [TARGET], means: { silver: 10, agentRoles: ['cook'] } });
  assert.deepEqual(result.intent, { type: 'attempt_action', payload: result.payload });
  assert.equal(result.explanation, 'Spelaren vill vinna personens gunst.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].callKind, 'interpret');
  assert.equal(calls[0].tool.name, 'interpret_character_action');
});

test('interpret defaults the actor to the representative and the means to nothing', async () => {
  const { callModel } = fakeModel(swayAnswer({ actorId: undefined, silver: undefined, agentRoles: undefined }));
  const result = await interpretCharacterAction({ text: 'smickra', view: view(), callModel });
  assert.deepEqual(result.payload, { actionId: 'sway', actorId: REP, targetIds: [TARGET], means: { silver: 0, agentRoles: [] } });
});

test('interpret reads a JSON text answer when the provider sends no tool input', async () => {
  const { callModel } = fakeModel('```json\n' + JSON.stringify(swayAnswer()) + '\n```');
  assert.equal((await interpretCharacterAction({ text: 'smickra', view: view(), callModel })).ok, true);
});

test('interpret maps a command entry and checks its payload keys against the fields', async () => {
  const v = view();
  const entry = v.catalog.find((item) => item.mode === 'command' && item.fields?.some((field) => field.options?.length));
  assert.ok(entry, 'fixture needs a command with a select field');
  const field = entry.fields.find((item) => item.options?.length);
  const good = { status: 'action', catalogId: entry.catalogId, targetIds: [], payload: { [field.key]: field.options[0].value }, explanation: 'ok', suggestions: [] };
  const ok = await interpretCharacterAction({ text: entry.label, view: v, callModel: fakeModel(good).callModel });
  assert.equal(ok.ok, true);
  assert.equal(ok.mode, 'command');
  assert.deepEqual(ok.intent, { type: entry.catalogId, payload: good.payload });
  const stray = { ...good, payload: { ...good.payload, invented: 1 } };
  const refused = await interpretCharacterAction({ text: entry.label, view: v, callModel: fakeModel(stray, stray).callModel });
  assert.deepEqual([refused.ok, refused.fallback], [false, 'menu']);
});

test('an unknown target is reported, not guessed', async () => {
  const { callModel, calls } = fakeModel({ status: 'unknown_person', catalogId: 'sway', targetIds: [], personText: 'Lord Valdemar', explanation: 'Okänd person.', suggestions: [] });
  const result = await interpretCharacterAction({ text: 'Smickra Lord Valdemar', view: view(), callModel });
  assert.deepEqual(result, { ok: false, reason: 'Personen finns inte i spelet: Lord Valdemar.', fallback: 'menu' });
  assert.equal(calls.length, 1, 'no retry for a person the model could not find');
  const invented = fakeModel(swayAnswer({ targetIds: ['person-9-9'], personText: 'Valdemar' }));
  const second = await interpretCharacterAction({ text: 'Smickra Valdemar', view: view(), callModel: invented.callModel });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'Personen finns inte i spelet: Valdemar.');
  assert.equal(invented.calls.length, 1);
});

test('a dead person is not a valid target', async () => {
  const state = createCharacterSystem({ seed: 321 });
  state.people[TARGET].diedAt = state.date;
  const { callModel } = fakeModel(swayAnswer());
  const result = await interpretCharacterAction({ text: 'smickra', view: getCharacterPresentation(state), callModel });
  assert.equal(result.ok, false);
  assert.match(result.reason, /^Personen finns inte i spelet/);
});

test('no_match falls back to the menu with the suggestions of the model', async () => {
  const { callModel } = fakeModel({ status: 'no_match', catalogId: '', targetIds: [], explanation: 'Ingen handling passar.', suggestions: ['sway'] });
  const result = await interpretCharacterAction({ text: 'flyg till månen', view: view(), callModel });
  assert.equal(result.ok, false);
  assert.equal(result.fallback, 'menu');
  assert.deepEqual(result.suggestions, ['sway']);
});

test('a wrong select value falls back to the menu', async () => {
  const twice = (answer) => fakeModel(answer, answer).callModel;
  const noTarget = await interpretCharacterAction({ text: 'smickra', view: view(), callModel: twice(swayAnswer({ targetIds: [] })) });
  assert.deepEqual([noTarget.ok, noTarget.fallback], [false, 'menu']);
  for (const extra of [{ agentRoles: ['wizard'] }, { agentRoles: ['cook', 'physician', 'steward'] }, { catalogId: 'assassinate' }, { silver: 9999 }, { silver: 2.5 }]) {
    const result = await interpretCharacterAction({ text: 'smickra', view: view(), callModel: twice(swayAnswer(extra)) });
    assert.deepEqual([result.ok, result.fallback], [false, 'menu'], JSON.stringify(extra));
  }
});

test('interpret retries once with the validation error and then falls back', async () => {
  const retried = fakeModel(swayAnswer({ agentRoles: ['wizard'] }), swayAnswer());
  const result = await interpretCharacterAction({ text: 'smickra', view: view(), callModel: retried.callModel });
  assert.equal(result.ok, true);
  assert.equal(retried.calls.length, 2);
  assert.equal(retried.calls[1].history.length, 3);
  const followUp = retried.calls[1].history.at(-1);
  assert.equal(followUp.role, 'user');
  assert.match(followUp.parts[0].text, /wizard/);
  const twice = fakeModel('not json at all', '{broken');
  const failed = await interpretCharacterAction({ text: 'smickra', view: view(), callModel: twice.callModel });
  assert.equal(failed.ok, false);
  assert.equal(failed.fallback, 'menu');
  assert.equal(twice.calls.length, 2, 'exactly one retry');
});

test('a failing model call falls back to the menu without a retry', async () => {
  const { callModel, calls } = fakeModel(new Error('fetch failed'));
  const result = await interpretCharacterAction({ text: 'smickra', view: view(), callModel });
  // The transport's own message is for the log; the player gets one Swedish sentence.
  assert.deepEqual([result.ok, result.fallback, result.reason, result.detail], [false, 'menu', 'Texten kunde inte tolkas. Välj en handling i listan.', 'fetch failed']);
  assert.equal(calls.length, 1);
});

test('a schema failure after the retry gives the player a Swedish sentence and keeps the validator text as detail', async () => {
  const wrong = { status: 'action', catalogId: 'no-such-action' };
  const { callModel, calls } = fakeModel(wrong, wrong);
  const result = await interpretCharacterAction({ text: 'smickra', view: view(), callModel });
  assert.equal(calls.length, 2);
  assert.equal(result.reason, 'Texten kunde inte tolkas. Välj en handling i listan.');
  assert.match(result.detail, /no-such-action/);
});

test('the interpret prompt holds people, staff and catalog but no odds', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const { callModel, calls } = fakeModel(swayAnswer());
  await interpretCharacterAction({ text: 'Smickra Arel', view: getCharacterPresentation(state), callModel });
  const prompt = `${calls[0].systemPrompt}\n${calls[0].history[0].parts[0].text}`;
  assert.match(prompt, /Smickra Arel/);
  assert.ok(prompt.includes(REP) && prompt.includes(TARGET));
  assert.ok(prompt.includes('"catalogId":"sway"'));
  assert.match(prompt, /sets no odds/);
  assert.match(prompt, /invents no person or means/);
  for (const forbidden of ['baseSuccess', 'baseSecrecy', 'traitModifiers', 'defenseSkill', 'secrecySkill', 'estimate']) {
    assert.ok(!prompt.includes(forbidden), `prompt leaks ${forbidden}`);
  }
});

test('the interpret prompt lists the household staff', async () => {
  const state = createCharacterSystem({ seed: 321 });
  state.courtStaff['staff-90'] = { id: 'staff-90', name: 'Olle (Kock)', familyId: state.identity.familyId, role: 'cook', diedAt: null };
  const { callModel, calls } = fakeModel(swayAnswer());
  await interpretCharacterAction({ text: 'smickra', view: getCharacterPresentation(state), callModel });
  assert.ok(calls[0].history[0].parts[0].text.includes('Olle (Kock)'));
});

const resolution = () => ({
  id: 'resolution-3', actionLabel: 'Påverka', actorName: 'Arel Ett', targetNames: ['Bran Ett'], agentNames: ['Kock'], date: '1000-03-04',
  tier: 'exposed_success', tierLabel: 'Lyckad men avslöjad',
  odds: { success: 'hög', secrecy: 'låg' }, estimate: { success: { value: 71 }, secrecy: { value: 33 } },
  effects: [
    { kind: 'opinion', fromId: TARGET, toId: REP, min: 10, max: 25, default: 18, value: 18, applied: 18, label: 'Gunst' },
    { kind: 'memory', visibility: 'public', title: 'En gåva' },
  ],
});

test('narrate passes adjustments through untouched', async () => {
  const answer = { title: 'En gåva tas emot', narrative: 'Gåvan togs emot inför hela hovet.', adjustments: [{ effectIndex: 0, value: 22 }, { effectIndex: 7, value: 999 }] };
  const { callModel, calls } = fakeModel(answer);
  const result = await narrateCharacterResolution({ resolution: resolution(), view: view(), callModel });
  assert.deepEqual(result, { ok: true, title: answer.title, narrative: answer.narrative, adjustments: answer.adjustments });
  assert.equal(calls[0].callKind, 'narrate');
});

test('the narrate prompt holds tier, indexed effects with ranges and people, never the odds', async () => {
  const { callModel, calls } = fakeModel({ title: 'T', narrative: 'N', adjustments: [] });
  await narrateCharacterResolution({ resolution: resolution(), view: view(), callModel });
  const prompt = `${calls[0].systemPrompt}\n${calls[0].history[0].parts[0].text}`;
  assert.ok(prompt.includes('exposed_success'));
  assert.ok(prompt.includes('"effectIndex":0') && prompt.includes('"min":10') && prompt.includes('"max":25'));
  assert.ok(prompt.includes('Arel Ett') && prompt.includes('Bran Ett'));
  assert.match(prompt, /Swedish/);
  assert.match(prompt, /1500/);
  for (const forbidden of ['71', '33', 'estimate', 'odds', 'secrecy', 'hög', 'låg']) assert.ok(!prompt.includes(forbidden), `prompt leaks ${forbidden}`);
});

test('the narrate prompt carries the reason, crime and topic of the new effect kinds', async () => {
  const { callModel, calls } = fakeModel({ title: 'T', narrative: 'N', adjustments: [] });
  const subject = { ...resolution(), effects: [{ kind: 'kill', personId: TARGET, reason: 'Förgiftad' }, { kind: 'crime', crime: 'kinslaying', secretId: 'secret-9', exposed: true }, { kind: 'rumor', topic: 'Ett hemligt giftmord' }] };
  await narrateCharacterResolution({ resolution: subject, view: view(), callModel });
  const prompt = calls[0].history[0].parts[0].text;
  for (const text of ['"reason":"Förgiftad"', '"crime":"kinslaying"', '"topic":"Ett hemligt giftmord"']) assert.ok(prompt.includes(text), `prompt lacks ${text}`);
});

test('narrate retries once on a malformed answer, then reports failure', async () => {
  const good = { title: 'T', narrative: 'N', adjustments: [] };
  const retried = fakeModel({ title: '', narrative: 'N', adjustments: [] }, good);
  assert.equal((await narrateCharacterResolution({ resolution: resolution(), view: view(), callModel: retried.callModel })).ok, true);
  assert.equal(retried.calls.length, 2);
  const long = { title: 'T', narrative: 'x'.repeat(1501), adjustments: [] };
  const failed = fakeModel(long, long);
  const result = await narrateCharacterResolution({ resolution: resolution(), view: view(), callModel: failed.callModel });
  assert.equal(result.ok, false);
  assert.equal(typeof result.reason, 'string');
  assert.equal(failed.calls.length, 2);
});

test('the call counter counts by kind and notifies subscribers', () => {
  const before = getModelCallCounts();
  const seen = [];
  const unsubscribe = subscribeModelCalls((counts) => seen.push(counts.total));
  recordModelCall('narrate');
  recordModelCall('narrate');
  recordModelCall('interpret');
  unsubscribe();
  recordModelCall('narrate');
  const after = getModelCallCounts();
  assert.equal(after.total - before.total, 4);
  assert.equal((after.byKind.narrate || 0) - (before.byKind.narrate || 0), 3);
  assert.equal((after.byKind.interpret || 0) - (before.byKind.interpret || 0), 1);
  assert.equal(seen.length, 3);
});

const taxAnswer = (payload) => ({ status: 'action', catalogId: 'tax_policy', targetIds: [], payload, explanation: 'Ändra skattepolitiken.', suggestions: [] });

test('a command select value outside its options falls back to the menu', async () => {
  const bad = taxAnswer({ policy: 'ruinous' });
  const { callModel, calls } = fakeModel(bad, bad);
  const result = await interpretCharacterAction({ text: 'skatten', view: view(), callModel });
  assert.deepEqual([result.ok, result.fallback], [false, 'menu']);
  assert.equal(calls.length, 2);
  assert.match(calls[1].history.at(-1).parts[0].text, /policy/);
  const good = await interpretCharacterAction({ text: 'skatten', view: view(), callModel: fakeModel(taxAnswer({ policy: 'gentle' })).callModel });
  assert.equal(good.ok, true);
});

test('every field of a command entry is required', async () => {
  const missing = fakeModel(taxAnswer({}), taxAnswer({}));
  const result = await interpretCharacterAction({ text: 'skatten', view: view(), callModel: missing.callModel });
  assert.deepEqual([result.ok, result.fallback], [false, 'menu']);
  assert.equal(missing.calls.length, 2);
  const retried = fakeModel(taxAnswer({}), taxAnswer({ policy: 'harsh' }));
  assert.equal((await interpretCharacterAction({ text: 'skatten', view: view(), callModel: retried.callModel })).ok, true);
  assert.match(retried.calls[1].history.at(-1).parts[0].text, /policy/);
});

test('a person field naming someone who is not in the game is an unknown person, with no retry', async () => {
  const gift = (targetId, personText) => ({ status: 'action', catalogId: 'gift', targetIds: [], payload: { targetId }, personText, explanation: 'Ge en gåva.', suggestions: [] });
  const unknown = fakeModel(gift('person-9-9', 'Valdemar'));
  assert.deepEqual(await interpretCharacterAction({ text: 'gåva till Valdemar', view: view(), callModel: unknown.callModel }),
    { ok: false, reason: 'Personen finns inte i spelet: Valdemar.', fallback: 'menu' });
  assert.equal(unknown.calls.length, 1);
  const state = createCharacterSystem({ seed: 321 });
  state.people['person-0-1'].diedAt = state.date;
  const dead = fakeModel(gift('person-0-1', 'Iset'));
  const deadResult = await interpretCharacterAction({ text: 'gåva till Iset', view: getCharacterPresentation(state), callModel: dead.callModel });
  assert.equal(deadResult.reason, 'Personen finns inte i spelet: Iset.');
  assert.equal(dead.calls.length, 1);
  const ok = await interpretCharacterAction({ text: 'gåva', view: view(), callModel: fakeModel(gift('person-0-1', '')).callModel });
  assert.equal(ok.ok, true);
});

test('a child may fill a person field that asks for a child', async () => {
  const educate = { status: 'action', catalogId: 'educate', targetIds: [], payload: { childId: 'person-0-4', mentorId: 'person-0-1', focus: 'command' }, explanation: 'Utbilda barnet.', suggestions: [] };
  const result = await interpretCharacterAction({ text: 'utbilda barnet', view: view(), callModel: fakeModel(educate).callModel });
  assert.equal(result.ok, true);
});

test('a command entry ignores targetIds, so a child listed there does not make an unknown person', async () => {
  const educate = { status: 'action', catalogId: 'educate', targetIds: ['person-0-4'], payload: { childId: 'person-0-4', mentorId: 'person-0-1', focus: 'command' }, explanation: 'Utbilda barnet.', suggestions: [] };
  const result = await interpretCharacterAction({ text: 'utbilda barnet', view: view(), callModel: fakeModel(educate).callModel });
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, { childId: 'person-0-4', mentorId: 'person-0-1', focus: 'command' });
  const badActor = await interpretCharacterAction({ text: 'utbilda barnet', view: view(), callModel: fakeModel({ ...educate, actorId: 'person-9-9' }).callModel });
  assert.equal(badActor.reason, 'Personen finns inte i spelet.');
});

test('the unknown-person reason names the reported person text, and is bare when empty', async () => {
  const answer = (personText) => ({ status: 'unknown_person', catalogId: 'sway', targetIds: [], personText, explanation: 'Förklaring som inte ska visas.', suggestions: [] });
  const named = await interpretCharacterAction({ text: 'x', view: view(), callModel: fakeModel(answer('Lord Valdemar')).callModel });
  assert.equal(named.reason, 'Personen finns inte i spelet: Lord Valdemar.');
  for (const empty of ['', '   ', undefined]) {
    const bare = await interpretCharacterAction({ text: 'x', view: view(), callModel: fakeModel(answer(empty)).callModel });
    assert.equal(bare.reason, 'Personen finns inte i spelet.');
  }
  const { callModel, calls } = fakeModel(answer('x'));
  await interpretCharacterAction({ text: 'x', view: view(), callModel });
  assert.match(calls[0].systemPrompt, /personText/);
});

test('duplicate agent roles are refused', async () => {
  const dup = swayAnswer({ agentRoles: ['cook', 'cook'] });
  const { callModel, calls } = fakeModel(dup, dup);
  const result = await interpretCharacterAction({ text: 'smickra', view: view(), callModel });
  assert.equal(result.ok, false);
  assert.equal(calls.length, 2);
});

test('a target outside the options of the entry is refused with a retry', async () => {
  const self = swayAnswer({ targetIds: [REP] });
  const { callModel, calls } = fakeModel(self, self);
  const result = await interpretCharacterAction({ text: 'smickra mig själv', view: view(), callModel });
  assert.deepEqual([result.ok, result.fallback], [false, 'menu']);
  assert.equal(calls.length, 2);
});

test('the prompt lists only living adults, and children and the dead are unknown persons', async () => {
  const state = createCharacterSystem({ seed: 321 });
  state.people['person-1-1'].diedAt = state.date;
  const v = getCharacterPresentation(state);
  const { callModel, calls } = fakeModel(swayAnswer({ targetIds: ['person-1-4'] }));
  const child = await interpretCharacterAction({ text: 'smickra barnet', view: v, callModel });
  assert.equal(child.ok, false);
  assert.equal(calls.length, 1);
  const people = JSON.parse(calls[0].history[0].parts[0].text).people.map((person) => person.id);
  assert.ok(people.includes(REP) && people.includes(TARGET));
  assert.ok(!people.includes('person-1-1'), 'the dead are not listed');
  assert.ok(!people.includes('person-0-4') && !people.includes('person-1-4'), 'children are not listed');
});

test('the actor named by the model is honoured', async () => {
  const { callModel } = fakeModel(swayAnswer({ actorId: 'person-0-1' }));
  const result = await interpretCharacterAction({ text: 'smickra', view: view(), callModel });
  assert.equal(result.ok, true);
  assert.equal(result.payload.actorId, 'person-0-1');
});

test('a disabled catalog entry returns its reason without a retry', async () => {
  const answer = { status: 'action', catalogId: 'marry', targetIds: [], payload: {}, explanation: 'Gifta bort.', suggestions: [] };
  const { callModel, calls } = fakeModel(answer);
  const result = await interpretCharacterAction({ text: 'gifta', view: view(), callModel });
  assert.deepEqual(result, { ok: false, reason: 'Ingen behörig deltagare finns.', fallback: 'menu' });
  assert.equal(calls.length, 1);
});

test('a plain string answer is carried into the retry history', async () => {
  const { callModel, calls } = fakeModel('not json at all', swayAnswer());
  await interpretCharacterAction({ text: 'smickra', view: view(), callModel });
  assert.equal(calls[1].history[1].role, 'model');
  assert.equal(calls[1].history[1].parts[0].text, 'not json at all');
});

// --- Phase 2: leverage means in interpret ---------------------------------------------------------

// A state where the representative holds a hidden secret about Namar and a weak hook over him.
function leveraged() {
  const state = createCharacterSystem({ seed: 321 });
  const secret = createSecret(state, { type: 'affair', subjectId: TARGET, holderIds: [REP], evidence: 'weak' });
  const hook = grantHook(state, { ownerId: REP, targetId: TARGET, strength: 'weak' });
  return { state, secret, hook };
}
const blackmailAnswer = (extra = {}) => ({ status: 'action', catalogId: 'blackmail', actorId: REP, targetIds: [TARGET], silver: 0, agentRoles: [], payload: {}, explanation: 'Utpressa.', suggestions: [], ...extra });

test('interpret passes secretId, hookId and topic through when each is one of the field options', async () => {
  const { state, secret, hook } = leveraged();
  const v = getCharacterPresentation(state);
  const blackmail = await interpretCharacterAction({ text: 'utpressa Namar', view: v, callModel: fakeModel(blackmailAnswer({ secretId: secret.id })).callModel });
  assert.equal(blackmail.ok, true, blackmail.reason);
  assert.deepEqual(blackmail.payload.means, { silver: 0, agentRoles: [], secretId: secret.id });
  // The interpreted payload is what the engine's own estimate accepts.
  const estimated = estimateCharacterAction(state, blackmail.intent.payload);
  assert.equal(estimated.ok, true, estimated.reason);
  const poison = await interpretCharacterAction({ text: 'förgifta Namar', view: v, callModel: fakeModel(swayAnswer({ catalogId: 'poison', hookId: hook.id })).callModel });
  assert.equal(poison.ok, true, poison.reason);
  assert.deepEqual(poison.payload.means, { silver: 10, agentRoles: ['cook'], hookId: hook.id });
  const rumor = await interpretCharacterAction({ text: 'sprid ett rykte', view: v, callModel: fakeModel(swayAnswer({ catalogId: 'spread_rumor', topic: 'affair' })).callModel });
  assert.equal(rumor.ok, true, rumor.reason);
  assert.equal(rumor.payload.means.topic, 'affair');
  const plain = await interpretCharacterAction({ text: 'smickra', view: v, callModel: fakeModel(swayAnswer({ secretId: '', hookId: '', topic: '' })).callModel });
  assert.deepEqual(plain.payload.means, { silver: 10, agentRoles: ['cook'] }, 'empty strings add nothing');
});

test('interpret refuses a secret, hook or topic outside the field options, or one the entry does not use', async () => {
  const { state, secret, hook } = leveraged();
  const foreign = createSecret(state, { type: 'murder', subjectId: 'person-2-2', holderIds: ['person-1-0'] });
  const v = getCharacterPresentation(state);
  const cases = [
    ['a secret the representative does not hold', blackmailAnswer({ secretId: foreign.id })],
    ['an invented secret', blackmailAnswer({ secretId: 'secret-999' })],
    ['blackmail without its required secret', blackmailAnswer()],
    ['a hook on an entry without hooks', swayAnswer({ hookId: hook.id })],
    ['a secret on an entry without secrets', swayAnswer({ secretId: secret.id })],
    ['an unknown hook', swayAnswer({ catalogId: 'poison', hookId: 'hook-999' })],
    ['an unknown topic', swayAnswer({ catalogId: 'spread_rumor', topic: 'weather' })],
  ];
  for (const [name, answer] of cases) {
    const { callModel, calls } = fakeModel(answer, answer);
    const result = await interpretCharacterAction({ text: 'x', view: v, callModel });
    assert.deepEqual([result.ok, result.fallback], [false, 'menu'], name);
    assert.equal(calls.length, 2, `${name}: one corrective retry`);
  }
});

test('the interpret schema offers secretId, hookId and topic but not occasionId', async () => {
  const { callModel, calls } = fakeModel(swayAnswer());
  await interpretCharacterAction({ text: 'smickra', view: view(), callModel });
  const properties = calls[0].tool.schema.properties;
  for (const key of ['secretId', 'hookId', 'topic']) assert.ok(properties[key], key);
  assert.equal(Object.hasOwn(properties, 'occasionId'), false);
});

// --- Phase 2: conversation -------------------------------------------------------------------------

const SERA = 'person-0-2';
const BAREK = 'person-2-2';
const askAnswer = (extra = {}) => ({ kind: 'support', offerSilver: 0, hookId: '', arguments: [], argumentScore: 0, ...extra });
const talkView = (state, personId = TARGET) => ({ ...getCharacterPresentation(state), conversationBrief: getConversationBrief(state, personId) });
const promptOf = (call) => `${call.systemPrompt}\n${call.history[0].parts[0].text}`;

test('extract maps an answer to a request, drops an unknown argument kind and clamps the score', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const answer = askAnswer({ kind: 'pledge', offerSilver: 12, arguments: [{ kind: 'offer', refId: '' }, { kind: 'flattery', refId: 'x' }, { kind: 'shared_enemy', refId: BAREK }], argumentScore: 25 });
  const { callModel, calls } = fakeModel(answer);
  const result = await extractConversationRequest({ personId: TARGET, text: 'Jag lovar dig tolv silver om du står med mig.', history: [], view: talkView(state), callModel });
  assert.deepEqual(result, { ok: true, request: { personId: TARGET, kind: 'pledge', offerSilver: 12, hookId: null,
    arguments: [{ kind: 'offer', refId: null }, { kind: 'shared_enemy', refId: BAREK }], argumentScore: 10 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].callKind, 'converse');
  assert.equal(calls[0].tool.name, 'extract_conversation_request');
});

test('small talk gives no request', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const { callModel } = fakeModel(askAnswer({ kind: 'none' }));
  assert.deepEqual(await extractConversationRequest({ personId: TARGET, text: 'Hur står det till?', history: [], view: talkView(state), callModel }), { ok: true, request: null });
});

test('every sanitised request passes the shape check of the conversation estimate', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const hostile = [
    askAnswer({ offerSilver: -5 }), askAnswer({ offerSilver: 'mycket' }), askAnswer({ offerSilver: 2.5 }), askAnswer({ offerSilver: null }),
    askAnswer({ hookId: 7 }), askAnswer({ hookId: {} }), askAnswer({ hookId: '' }),
    askAnswer({ argumentScore: 'hög' }), askAnswer({ argumentScore: -3 }), askAnswer({ argumentScore: 4.6 }), askAnswer({ argumentScore: Infinity }),
    askAnswer({ arguments: 'inga' }), askAnswer({ arguments: [null, 5, 'x', { kind: 'offer', refId: 42 }, { kind: 'shared_memory', refId: { id: 'x' } }, { kind: 'hook' }] }),
    askAnswer({ arguments: Array.from({ length: 12 }, () => ({ kind: 'offer', refId: null })) }),
  ];
  for (const answer of hostile) {
    const result = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: talkView(state), callModel: fakeModel(answer).callModel });
    assert.equal(result.ok, true, JSON.stringify(answer));
    const { request } = result;
    assert.ok(Number.isInteger(request.offerSilver) && request.offerSilver >= 0);
    assert.ok(request.hookId === null || typeof request.hookId === 'string');
    assert.ok(Number.isInteger(request.argumentScore) && request.argumentScore >= 0 && request.argumentScore <= 10);
    assert.ok(request.arguments.length <= 8);
    for (const item of request.arguments) assert.ok(['offer', 'shared_enemy', 'shared_memory', 'hook'].includes(item.kind) && (item.refId === null || typeof item.refId === 'string'));
    const estimated = estimateConversation(state, request);
    assert.equal(estimated.ok, true, `${JSON.stringify(answer)} -> ${estimated.reason}`);
  }
  const capped = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: talkView(state), callModel: fakeModel(hostile.at(-1)).callModel });
  assert.equal(capped.request.arguments.length, 8);
  const rounded = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: talkView(state), callModel: fakeModel(askAnswer({ argumentScore: 4.6 })).callModel });
  assert.equal(rounded.request.argumentScore, 5);
});

test('extract retries once on an unknown kind, then reports failure with a Swedish sentence', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const retried = fakeModel(askAnswer({ kind: 'beg' }), askAnswer());
  assert.equal((await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: talkView(state), callModel: retried.callModel })).ok, true);
  assert.equal(retried.calls.length, 2);
  assert.match(retried.calls[1].history.at(-1).parts[0].text, /beg/);
  const failing = fakeModel(askAnswer({ kind: 'beg' }), 'not json');
  const failed = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: talkView(state), callModel: failing.callModel });
  assert.equal(failed.ok, false);
  assert.match(failed.reason, /^Samtalet kunde inte tolkas/);
  assert.equal(failing.calls.length, 2);
  const down = fakeModel(new Error('fetch failed'));
  const gone = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: talkView(state), callModel: down.callModel });
  assert.deepEqual([gone.ok, gone.detail, down.calls.length], [false, 'fetch failed', 1]);
});

test('extract refuses a person who is not in the game without asking the model', async () => {
  const { callModel, calls } = fakeModel(askAnswer());
  const result = await extractConversationRequest({ personId: 'person-9-9', text: 'x', history: [], view: view(), callModel });
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});

test('reply is passed the outcome as a fixed fact', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const accepted = fakeModel({ reply: 'Du har mitt stöd.' });
  const result = await replyAsCharacter({ personId: TARGET, text: 'Stöd mig.', history: [], view: talkView(state), outcome: { kind: 'support', accepted: true }, callModel: accepted.callModel });
  assert.deepEqual(result, { ok: true, reply: 'Du har mitt stöd.' });
  assert.equal(accepted.calls[0].callKind, 'converse');
  assert.equal(accepted.calls[0].tool.name, 'reply_as_character');
  const prompt = promptOf(accepted.calls[0]);
  assert.match(prompt, /"outcome":\{"kind":"support","accepted":true\}/);
  assert.match(prompt, /fixed/);
  assert.match(prompt, /contradict/);
  const refused = fakeModel({ reply: 'Nej.' });
  await replyAsCharacter({ personId: TARGET, text: 'Stöd mig.', history: [], view: talkView(state), outcome: { kind: 'pledge', accepted: false }, callModel: refused.callModel });
  assert.match(promptOf(refused.calls[0]), /"outcome":\{"kind":"pledge","accepted":false\}/);
  const talk = fakeModel({ reply: 'Väl.' });
  await replyAsCharacter({ personId: TARGET, text: 'Hej.', history: [], view: talkView(state), outcome: null, callModel: talk.callModel });
  assert.match(promptOf(talk.calls[0]), /"outcome":null/);
  assert.match(promptOf(talk.calls[0]), /no request/i);
});

test('a reply over 800 characters is rejected and retried once, then reported as a failure', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const long = { reply: 'x'.repeat(801) };
  const retried = fakeModel(long, { reply: 'x'.repeat(800) });
  const ok = await replyAsCharacter({ personId: TARGET, text: 'Hej.', history: [], view: talkView(state), outcome: null, callModel: retried.callModel });
  assert.deepEqual([ok.ok, ok.reply.length, retried.calls.length], [true, 800, 2]);
  assert.match(retried.calls[1].history.at(-1).parts[0].text, /800/);
  const failing = fakeModel(long, long);
  const failed = await replyAsCharacter({ personId: TARGET, text: 'Hej.', history: [], view: talkView(state), outcome: null, callModel: failing.callModel });
  assert.deepEqual([failed.ok, typeof failed.reason, failing.calls.length], [false, 'string', 2]);
  const empty = fakeModel({ reply: '  ' }, { reply: '' });
  assert.equal((await replyAsCharacter({ personId: TARGET, text: 'Hej.', history: [], view: talkView(state), outcome: null, callModel: empty.callModel })).ok, false);
});

test('the conversation prompt holds the speaker, the opinion with reasons, memories, held secrets as labels and the hooks over him', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const hooks = actionHooks(state);
  hooks.opinionCause(TARGET, REP, 12, 'Hjälp i nöden', 'cause-test', 10);
  const held = createSecret(state, { type: 'affair', subjectId: BAREK, holderIds: [TARGET] });
  const lacking = createSecret(state, { type: 'murder', subjectId: SERA, holderIds: [BAREK] });
  const other = createSecret(state, { type: 'heresy', subjectId: 'person-1-2', holderIds: [BAREK] });
  const hook = grantHook(state, { ownerId: REP, targetId: TARGET, strength: 'strong' });
  grantHook(state, { ownerId: REP, targetId: BAREK, strength: 'weak' });
  for (let n = 1; n <= 14; n++) hooks.memory('talk', `Minne nr ${n}.`, [REP, TARGET], { knownBy: [REP, TARGET] });
  hooks.memory('talk', 'Okänt för Namar', [REP, SERA], { knownBy: [REP, SERA] });
  hooks.memory('talk', 'Främlingars sak', [SERA, BAREK], { knownBy: 'public' });
  createRumor(state, { topic: 'plot', subjectId: TARGET, claimedActorId: null, truthful: true, reliability: 'säker', sourceKind: 'scheme', sourceId: 'scheme-77', heardByFamilyId: 'family-arel' });
  const { callModel, calls } = fakeModel({ reply: 'Ja.' }, askAnswer());
  await replyAsCharacter({ personId: TARGET, text: 'Hej.', history: [], view: talkView(state), outcome: null, callModel });
  await extractConversationRequest({ personId: TARGET, text: 'Hej.', history: [], view: talkView(state), callModel });
  for (const call of calls) {
    const prompt = promptOf(call);
    assert.ok(prompt.includes(state.people[TARGET].name));
    assert.ok(prompt.includes('Hjälp i nöden'), 'opinion reason');
    assert.ok(!prompt.includes('Mord') && !prompt.includes('Kätteri'), 'secrets the speaker does not hold are absent');
    for (const id of [held.id, lacking.id, other.id]) assert.ok(!prompt.includes(`"${id}"`), `no secret id ${id}`);
    assert.ok(!/holderIds|evidence|"truthful"|"sourceId"|rumor/i.test(prompt));
    assert.ok(prompt.includes('Minne nr 14.') && prompt.includes('Minne nr 3.') && !prompt.includes('Minne nr 2.') && !prompt.includes('Minne nr 1.'), 'twelve memories');
    assert.ok(prompt.indexOf('Minne nr 14.') < prompt.indexOf('Minne nr 13.'), 'newest first');
    assert.ok(!prompt.includes('Okänt för Namar') && !prompt.includes('Främlingars sak'), 'memories the speaker does not know or that involve neither');
    assert.ok(/starkt/.test(prompt), 'the hook over him');
  }
  assert.ok(promptOf(calls[0]).includes('Otrohet') && promptOf(calls[0]).includes(state.people[BAREK].name), 'the reply prompt shows a held secret as type and subject name');
  assert.ok(!promptOf(calls[1]).includes('Otrohet') && !promptOf(calls[1]).includes('"secrets"'), 'the extract prompt does not use the speaker\'s secrets');
  assert.ok(promptOf(calls[1]).includes(hook.id), 'the extract prompt names the hook id so the request can use it');
  assert.ok(!promptOf(calls[0]).includes(hook.id), 'the reply prompt needs no ids');
});

test('the brief is read from the engine and lists no secret the speaker lacks', () => {
  const state = createCharacterSystem({ seed: 321 });
  createSecret(state, { type: 'murder', subjectId: SERA, holderIds: [BAREK] });
  const brief = getConversationBrief(state, TARGET);
  assert.deepEqual(brief.secrets, []);
  assert.equal(brief.personId, TARGET);
  assert.equal(getConversationBrief(state, 'person-9-9'), null);
});

// --- Fix round 1 ---------------------------------------------------------------------------------------

test('the reply prompt forbids disclosing secrets and private memories in every outcome', async () => {
  const state = createCharacterSystem({ seed: 321 });
  for (const outcome of [null, { kind: 'reveal_secret', accepted: true }, { kind: 'reveal_secret', accepted: false }, { kind: 'support', accepted: true }]) {
    const { callModel, calls } = fakeModel({ reply: 'Ja.' });
    await replyAsCharacter({ personId: TARGET, text: 'Berätta.', history: [], view: talkView(state), outcome, callModel });
    const system = calls[0].systemPrompt;
    assert.match(system, /never disclose the type or the subject of any secret/);
    assert.match(system, /never recount a memory the player .* took no part in/);
    assert.match(system, /Only the game decides what is confided/);
    assert.equal(JSON.parse(calls[0].history[0].parts[0].text).player, state.people[REP].name, 'the prompt names the player so a memory can be judged');
  }
});

test('extract refuses a hookId the speaker does not offer, and a hook argument that names another hook', async () => {
  const { state, hook } = leveraged();
  const v = talkView(state);
  const other = grantHook(state, { ownerId: REP, targetId: BAREK, strength: 'weak' });
  const twice = (answer) => fakeModel(answer, answer);
  for (const answer of [askAnswer({ hookId: 'hook-999' }), askAnswer({ hookId: other.id }), askAnswer({ hookId: hook.id, arguments: [{ kind: 'hook', refId: other.id }] })]) {
    const { callModel, calls } = twice(answer);
    const result = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: talkView(state), callModel });
    assert.equal(result.ok, false, JSON.stringify(answer));
    assert.equal(calls.length, 2, 'one corrective retry');
    assert.match(calls[1].history.at(-1).parts[0].text, /hook/);
  }
  const retried = fakeModel(askAnswer({ hookId: 'hook-999' }), askAnswer({ hookId: hook.id, arguments: [{ kind: 'hook', refId: hook.id }, { kind: 'hook', refId: null }] }));
  const ok = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: v, callModel: retried.callModel });
  assert.deepEqual([ok.ok, ok.request.hookId, retried.calls.length], [true, hook.id, 2]);
  const noHooks = createCharacterSystem({ seed: 321 });
  const invented = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: talkView(noHooks), callModel: twice(askAnswer({ hookId: 'hook-1' })).callModel });
  assert.equal(invented.ok, false, 'a real brief with no hooks lists none, so any hook id is invented');
});

test('without a brief the hook id is dropped, since no hook can be checked', async () => {
  const { state, hook } = leveraged();
  const { callModel, calls } = fakeModel(askAnswer({ hookId: hook.id }));
  const result = await extractConversationRequest({ personId: TARGET, text: 'x', history: [], view: getCharacterPresentation(state), callModel });
  assert.deepEqual([result.ok, result.request.hookId, calls.length], [true, null, 1]);
});

test('a brief for another person is refused in Swedish, without a model call', async () => {
  const state = createCharacterSystem({ seed: 321 });
  const wrong = talkView(state, BAREK);
  for (const call of [extractConversationRequest, replyAsCharacter]) {
    const { callModel, calls } = fakeModel(askAnswer(), { reply: 'x' });
    const result = await call({ personId: TARGET, text: 'x', history: [], view: wrong, outcome: null, callModel });
    assert.deepEqual([result.ok, result.reason], [false, 'Samtalsunderlaget hör till en annan person.']);
    assert.equal(calls.length, 0);
  }
});

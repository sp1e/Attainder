import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSystem, getCharacterPresentation } from '../../runtime/characters/index.js';
import { getModelCallCounts, recordModelCall, subscribeModelCalls } from '../AI/modelCallCounter.js';
import { interpretCharacterAction, narrateCharacterResolution } from './characterModelCalls.js';

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
  for (const extra of [{ agentRoles: ['wizard'] }, { agentRoles: ['cook', 'physician', 'steward'] }, { catalogId: 'poison' }, { silver: 9999 }, { silver: 2.5 }]) {
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
  const { callModel, calls } = fakeModel(new Error('Modellen svarar inte.'));
  const result = await interpretCharacterAction({ text: 'smickra', view: view(), callModel });
  assert.deepEqual([result.ok, result.fallback, result.reason], [false, 'menu', 'Modellen svarar inte.']);
  assert.equal(calls.length, 1);
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

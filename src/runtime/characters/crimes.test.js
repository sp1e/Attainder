import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHooks, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { EFFECT_KINDS, crime, kill, legitimacy } from './actionCatalog.js';
import { applyTierEffects, recordNarrative, validateActionLog } from './actionResolution.js';
import { CRIME_LABELS, exposeCrime } from './crimes.js';

const RULER = 'person-0-0';
const SERA = 'person-0-2';
const TAREK = 'person-0-3';
const KELAN = 'person-1-2';
const BAREK = 'person-2-2';
const NAMAR_ADULTS = ['person-1-0', 'person-1-1', 'person-1-3'];
const PRISON_MISSING = 'Fängelset är inte byggt ännu.';

const copy = (value) => JSON.parse(JSON.stringify(value));
const fresh = () => createCharacterSystem({ seed: 321 });
let counter = 0;
const run = (state, type, payload) => executeCharacterCommand(state, { id: `command-${++counter}`, expectedRevision: state.revision, type, payload });

// Applies a list of effects as one tier of a made-up action, with the anchor memory a real resolution would have written first.
function apply(state, effects, actorId, targetId, events = []) {
  const hooks = actionHooks(state);
  const anchor = hooks.memory('action', 'Provminne', [actorId, targetId], { knownBy: [actorId] });
  const resolution = { actorId, targetIds: [targetId], memoryId: anchor.id, tier: 'clean_success' };
  const entry = { label: 'Prov', tiers: { clean_success: { effects } } };
  return { applied: applyTierEffects(state, resolution, entry, hooks, events), anchor, hooks, resolution, entry };
}
const opinionOf = (state, fromIds, toId) => fromIds.map((id) => getPersonalOpinion(state, id, toId));
const drop = (before, after) => after.map((value, index) => value - before[index]);
const storyOf = (state) => state.stories.find((story) => story.type === 'punish_crime');

test('the new effect kinds are listed and the constructors build plain data', () => {
  assert.deepEqual(EFFECT_KINDS.slice(-3), ['kill', 'crime', 'legitimacy']);
  assert.deepEqual(kill('target', 'Mördad'), { kind: 'kill', who: 'target', reason: 'Mördad' });
  assert.deepEqual(crime('murder', true), { kind: 'crime', crime: 'murder', exposed: true });
  assert.deepEqual(legitimacy(-10, -4), { kind: 'legitimacy', min: -10, max: -4 });
  assert.deepEqual(CRIME_LABELS, { murder: 'Mord', kinslaying: 'Släktmord', attempted_murder: 'Mordförsök', treason: 'Förräderi' });
});

test('the new action hooks: ruler, related and openStory', () => {
  const state = fresh();
  const hooks = actionHooks(state);
  assert.equal(hooks.ruler().id, RULER);
  assert.equal(hooks.related(SERA, TAREK), true, 'spouses');
  assert.equal(hooks.related('person-0-1', SERA), true, 'parent and child');
  assert.equal(hooks.related('person-0-4', 'person-0-5'), true, 'siblings');
  assert.equal(hooks.related(SERA, 'person-0-5'), true, 'same family');
  assert.equal(hooks.related(SERA, KELAN), false, 'strangers of different families');
  assert.equal(hooks.related(SERA, SERA), false, 'nobody is their own kin');
  const before = state.sequence;
  const story = hooks.openStory({ type: 'punish_crime', title: 'T', actorId: SERA, status: 'closed' });
  assert.equal(story.id, `story-${before + 1}`);
  assert.equal(story.status, 'open');
  assert.equal(state.stories.at(-1), story);
  state.realm.alive = false; state.offices.ruler.holderId = null;
  assert.equal(actionHooks(state).ruler(), null);
});

test('a kill effect kills once, and succession runs when the victim is the ruler', () => {
  const state = fresh();
  const events = [];
  const { applied } = apply(state, [kill('target', 'Mördad')], KELAN, RULER, events);
  assert.deepEqual(applied, [{ kind: 'kill', personId: RULER, reason: 'Mördad' }]);
  assert.equal(state.people[RULER].diedAt, state.date);
  assert.equal(state.people[RULER].deathReason, 'Mördad');
  assert.notEqual(state.offices.ruler.holderId, RULER);
  assert.ok(state.offices.ruler.holderId, 'someone inherits the crown');
  assert.ok(events.some((event) => event.type === 'death'), 'the death is chronicled in the command events');
  const heir = state.offices.ruler.holderId;
  const second = apply(state, [kill('target', 'Mördad')], KELAN, RULER, events);
  assert.deepEqual(second.applied, [{ kind: 'kill', personId: RULER, reason: 'Mördad', applied: false }]);
  assert.equal(state.offices.ruler.holderId, heir, 'a dead person is not killed twice');
  assert.equal(events.filter((event) => event.type === 'death').length, 1);
});

test('a hidden crime creates a weak, unexposed secret held by the actor alone', () => {
  const state = fresh();
  const before = opinionOf(state, NAMAR_ADULTS, SERA);
  const { applied, anchor } = apply(state, [crime('murder', false)], SERA, KELAN);
  const secret = state.secrets.at(-1);
  assert.deepEqual(applied, [{ kind: 'crime', crime: 'murder', secretId: secret.id, exposed: false }]);
  assert.equal(secret.type, 'murder');
  assert.equal(secret.subjectId, SERA);
  assert.deepEqual(secret.holderIds, [SERA]);
  assert.equal(secret.evidence, 'weak');
  assert.equal(secret.exposed, false);
  assert.equal(secret.causeId, anchor.id);
  assert.deepEqual(opinionOf(state, NAMAR_ADULTS, SERA), before, 'nobody learns of a hidden crime');
  assert.equal(state.stories.some((story) => story.type === 'punish_crime'), false);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)));
});

test('an attempted murder and treason are plot secrets', () => {
  const state = fresh();
  const attempt = apply(state, [crime('attempted_murder', false)], SERA, KELAN).applied[0];
  const treason = apply(state, [crime('treason', false)], SERA, RULER).applied[0];
  assert.deepEqual([attempt.crime, treason.crime], ['attempted_murder', 'treason']);
  assert.deepEqual(state.secrets.slice(-2).map((secret) => secret.type), ['plot', 'plot']);
});

test('an exposed murder costs the actor 30 opinion with every adult of the victim\'s family', () => {
  const state = fresh();
  const events = [];
  const before = opinionOf(state, NAMAR_ADULTS, SERA);
  const arel = opinionOf(state, [RULER, 'person-0-1'], SERA);
  const { applied, anchor } = apply(state, [kill('target', 'Mördad'), crime('murder', true)], SERA, KELAN, events);
  const secret = state.secrets.at(-1);
  assert.deepEqual(applied[1], { kind: 'crime', crime: 'murder', secretId: secret.id, exposed: true });
  assert.equal(secret.evidence, 'strong');
  assert.equal(secret.exposed, true);
  assert.deepEqual(drop(before, opinionOf(state, NAMAR_ADULTS, SERA)), [-30, -30, -30]);
  assert.deepEqual(opinionOf(state, [RULER, 'person-0-1'], SERA), arel, 'the actor\'s own family is not touched by an ordinary murder');
  const cause = state.relations[`person-1-0:${SERA}`].causes.at(-1);
  assert.equal(cause.label, 'Mord');
  assert.equal(cause.amount, -30);
  assert.notEqual(cause.causeId, anchor.id, 'the exposure has its own cause so the action\'s own opinion effects do not collide with it');
  assert.ok(events.some((event) => event.type === 'crime_exposed'));
  assert.equal(state.people[KELAN].diedAt, state.date);
});

test('kinslaying costs the actor\'s own family a further 15 and is recorded as kinslaying', () => {
  const state = fresh();
  const before = opinionOf(state, [RULER, 'person-0-1'], SERA);
  const { applied } = apply(state, [kill('target', 'Mördad'), crime('murder', true)], SERA, TAREK);
  assert.equal(applied[1].crime, 'kinslaying');
  assert.equal(state.secrets.at(-1).type, 'murder');
  assert.deepEqual(drop(before, opinionOf(state, [RULER, 'person-0-1'], SERA)), [-45, -45], 'the victim\'s family and the killer\'s family are the same');
  const labels = state.relations[`${RULER}:${SERA}`].causes.map((cause) => cause.label);
  assert.deepEqual(labels.slice(-2), ['Släktmord', 'Släktmord']);
});

test('kinslaying across families: the victim family loses 30, the killer family 15', () => {
  const state = fresh();
  // Kelan Namar is married to Sera Arel, so killing her is kinslaying although the families differ.
  state.people[KELAN].spouseId = SERA; state.people[SERA].spouseId = KELAN;
  const namar = opinionOf(state, ['person-1-0', 'person-1-1', 'person-1-3'], KELAN);
  const arel = opinionOf(state, [RULER, 'person-0-1', TAREK], KELAN);
  const { applied } = apply(state, [kill('target', 'Mördad'), crime('murder', true)], KELAN, SERA);
  assert.equal(applied[1].crime, 'kinslaying');
  assert.deepEqual(drop(arel, opinionOf(state, [RULER, 'person-0-1', TAREK], KELAN)), [-30, -30, -30]);
  assert.deepEqual(drop(namar, opinionOf(state, ['person-1-0', 'person-1-1', 'person-1-3'], KELAN)), [-15, -15, -15]);
});

test('a ruler who is exposed as a murderer loses 8 legitimacy, a kinslayer 12', () => {
  const murder = fresh();
  apply(murder, [crime('murder', true)], RULER, KELAN);
  assert.equal(murder.realm.legitimacy, 57);
  const attempt = fresh();
  apply(attempt, [crime('attempted_murder', true)], RULER, KELAN);
  assert.equal(attempt.realm.legitimacy, 57);
  const kin = fresh();
  apply(kin, [crime('murder', true)], RULER, TAREK);
  assert.equal(kin.realm.legitimacy, 53);
  const hidden = fresh();
  apply(hidden, [crime('murder', false)], RULER, KELAN);
  assert.equal(hidden.realm.legitimacy, 65, 'a hidden crime costs nothing');
  const other = fresh();
  apply(other, [crime('murder', true)], SERA, KELAN);
  assert.equal(other.realm.legitimacy, 65, 'only the ruler\'s own crime weighs on the crown');
  assert.equal(storyOf(murder), undefined, 'the ruler is not judged by himself');
  const floor = fresh();
  floor.realm.legitimacy = 5;
  apply(floor, [crime('murder', true)], RULER, KELAN);
  assert.equal(floor.realm.legitimacy, 0);
});

test('exposing the same crime twice charges it once', () => {
  const state = fresh();
  const { applied, hooks } = apply(state, [crime('murder', true)], SERA, KELAN);
  const before = opinionOf(state, NAMAR_ADULTS, SERA);
  const stories = state.stories.length;
  exposeCrime(state, { secretId: applied[0].secretId, crime: 'murder', victimId: KELAN }, [], hooks);
  assert.deepEqual(opinionOf(state, NAMAR_ADULTS, SERA), before);
  assert.equal(state.stories.length, stories);
});

test('an exposed crime by another person opens punish_crime for the player when the ruler is his representative', () => {
  const state = fresh();
  apply(state, [kill('target', 'Mördad'), crime('murder', true)], KELAN, BAREK);
  const story = storyOf(state);
  assert.equal(story.status, 'open');
  assert.equal(story.actorId, KELAN);
  assert.equal(story.targetId, BAREK);
  assert.equal(story.familyId, 'family-namar');
  assert.deepEqual(story.knownBy, [RULER]);
  assert.match(story.title, /Mord/);
  const view = getCharacterPresentation(state).stories.find((item) => item.id === story.id);
  assert.ok(view, 'the player sees it');
  assert.deepEqual(view.choices.map((choice) => choice.id), ['imprison', 'fine', 'pardon']);
  assert.equal(view.choices[0].disabledReason, PRISON_MISSING);
  assert.equal(view.choices[1].disabledReason, '');
  assert.equal(view.choices[2].disabledReason, '');
  for (const choice of view.choices) assert.deepEqual(Object.keys(choice).sort(), ['cost', 'description', 'disabledReason', 'id', 'label', 'stress']);
});

test('no punish_crime opens when the ruler is not the player\'s representative, or when the ruler is the criminal', () => {
  const family = createCharacterSystem({ seed: 321, mode: 'family', familyId: 'family-namar' });
  apply(family, [crime('murder', true)], 'person-2-2', 'person-3-2');
  assert.equal(storyOf(family), undefined);
  const ruling = fresh();
  apply(ruling, [crime('murder', true)], RULER, KELAN);
  assert.equal(storyOf(ruling), undefined);
});

function openCase() {
  const state = fresh();
  apply(state, [kill('target', 'Mördad'), crime('murder', true)], KELAN, BAREK);
  return state;
}

test('punish_crime: imprison is refused until the prison exists', () => {
  const state = openCase();
  const result = run(state, 'resolve_story', { storyId: storyOf(state).id, choiceId: 'imprison' });
  assert.equal(result.ok, false);
  assert.equal(result.error, PRISON_MISSING);
});

test('punish_crime: a fine moves 30 silver from the family to the treasury', () => {
  const state = openCase();
  const family = state.families['family-namar'].treasury, realm = state.realm.treasury;
  const result = run(state, 'resolve_story', { storyId: storyOf(state).id, choiceId: 'fine' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.families['family-namar'].treasury, family - 30);
  assert.equal(result.state.realm.treasury, realm + 30);
  assert.equal(result.state.realm.legitimacy, state.realm.legitimacy);
  assert.equal(storyOf(result.state).status, 'resolved');
  assert.equal(storyOf(result.state).choiceId, 'fine');
});

test('punish_crime: a poor family pays what it has', () => {
  const state = openCase();
  state.families['family-namar'].treasury = 12.5;
  const realm = state.realm.treasury;
  const result = run(state, 'resolve_story', { storyId: storyOf(state).id, choiceId: 'fine' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.families['family-namar'].treasury, 0);
  assert.equal(result.state.realm.treasury, realm + 12.5);
});

test('punish_crime: a pardon costs 2 legitimacy and wins the criminal\'s goodwill (+15)', () => {
  const state = openCase();
  const goodwill = getPersonalOpinion(state, KELAN, RULER);
  const result = run(state, 'resolve_story', { storyId: storyOf(state).id, choiceId: 'pardon' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.realm.legitimacy, state.realm.legitimacy - 2);
  assert.equal(getPersonalOpinion(result.state, KELAN, RULER), goodwill + 15);
  assert.equal(result.state.families['family-namar'].treasury, state.families['family-namar'].treasury);
  assert.equal(storyOf(result.state).status, 'resolved');
});

test('punish_crime closes when the criminal dies, and cannot be resolved twice', () => {
  const state = openCase();
  const once = run(state, 'resolve_story', { storyId: storyOf(state).id, choiceId: 'fine' });
  const again = run(once.state, 'resolve_story', { storyId: storyOf(once.state).id, choiceId: 'pardon' });
  assert.equal(again.ok, false);
  const dying = openCase();
  actionHooks(dying).kill([KELAN], [], 'Sjukdom');
  const next = run(dying, 'rest', {});
  assert.equal(next.ok, true, next.error);
  assert.equal(storyOf(next.state).status, 'closed');
});

// A valid action log entry whose effects come from a made-up tier, so the log validator and the narrative see the new kinds.
function loggedResolution(state, effects, actorId = SERA, targetId = KELAN) {
  const { applied, anchor } = apply(state, effects, actorId, targetId);
  const resolution = { id: `resolution-${++state.sequence}`, commandId: null, actionId: 'sway', actorId, targetIds: [targetId], date: state.date,
    estimate: { success: 45, secrecy: 60, refusal: null }, rolls: { refusal: null, success: 10, secrecy: 10 }, tier: 'clean_success',
    effects: applied, narrative: null, refused: false, agentIds: [], playerControlled: true, precision: 'three', memoryId: anchor.id };
  state.actionLog.push(resolution);
  return resolution;
}

test('validateActionLog accepts the new records and rejects forged ones', () => {
  const state = fresh();
  const logged = loggedResolution(state, [kill('target', 'Mördad'), crime('murder', false), legitimacy(-10, -4)]);
  assert.doesNotThrow(() => validateActionLog(state));
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)));
  const forgeries = {
    'kill without personId': (effects) => { delete effects[0].personId; },
    'kill of a missing person': (effects) => { effects[0].personId = 'person-nobody'; },
    'kill without a reason': (effects) => { delete effects[0].reason; },
    'crime of an unknown kind': (effects) => { effects[1].crime = 'jaywalking'; },
    'crime without a secret': (effects) => { effects[1].secretId = 'secret-missing'; },
    'crime exposed flag not boolean': (effects) => { effects[1].exposed = 'yes'; },
    'legitimacy outside its range': (effects) => { effects[2].value = 500; },
  };
  for (const [name, forge] of Object.entries(forgeries)) {
    const forged = copy(state);
    forge(forged.actionLog.at(-1).effects);
    assert.throws(() => validateActionLog(forged), /handlingsloggen/i, name);
  }
  assert.ok(logged.effects.length === 3);
});

test('a legitimacy effect moves the ruler\'s legitimacy inside 0..100, and not for anyone else', () => {
  const state = fresh();
  const { applied } = apply(state, [legitimacy(-10, -4)], RULER, KELAN);
  assert.deepEqual(applied, [{ kind: 'legitimacy', value: -7, applied: -7, min: -10, max: -4, default: -7 }]);
  assert.equal(state.realm.legitimacy, 58);
  const low = fresh(); low.realm.legitimacy = 3;
  assert.equal(apply(low, [legitimacy(-10, -4)], RULER, KELAN).applied[0].applied, -3);
  assert.equal(low.realm.legitimacy, 0);
  const high = fresh(); high.realm.legitimacy = 98;
  assert.equal(apply(high, [legitimacy(4, 10)], RULER, KELAN).applied[0].applied, 2);
  assert.equal(high.realm.legitimacy, 100);
  const other = fresh();
  assert.deepEqual(apply(other, [legitimacy(-10, -4)], SERA, KELAN).applied, [{ kind: 'legitimacy', applied: false }]);
  assert.equal(other.realm.legitimacy, 65);
  assert.doesNotThrow(() => { const s = fresh(); loggedResolution(s, [legitimacy(-10, -4)], SERA, KELAN); validateActionLog(s); });
});

test('a narrative can move a legitimacy effect inside its envelope', () => {
  const state = fresh();
  const logged = loggedResolution(state, [legitimacy(-10, -4)], RULER, KELAN);
  recordNarrative(state, { resolutionId: logged.id, title: 'Hovet viskar', narrative: 'Tronen skakas.', adjustments: [{ effectIndex: 0, value: -10 }] }, actionHooks(state), []);
  assert.equal(state.realm.legitimacy, 55);
  assert.equal(logged.effects[0].value, -10);
  assert.equal(logged.rejectedAdjustments, 0);
});

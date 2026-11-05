import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, getNextCharacterTransitionDate, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { BREAKDOWN_STRESS, CRISIS_MEMORY_MONTHS, CRISIS_STRESS, breakdownChoices, breakdownDue, breakdownStep, natureStress, resolveBreakdown, stressPressureStep } from './breakdowns.js';
import { COURT_STORY_TYPES, courtAnnualStep, courtStoryChoices, refreshCourtStories } from './court.js';

const REP = 'person-0-0';
const HEIR = 'person-0-2';
const NOBLE = 'person-1-1';
const HEAD = 'person-1-0';
const CHILD = 'person-0-4';
const NAMARS = 'family-namar';
const OWN = 'family-arel';

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => createCharacterSystem({ seed: 321, ...options });
let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const year = (state) => ok(advanceCharacters(state, addGameMonths(state.date, 12), { id: `year-${++counter}` }));
const resolve = (state, storyId, choiceId) => ok(executeCharacterCommand(state, { id: `resolve-${++counter}`, expectedRevision: state.revision, type: 'resolve_story', payload: { storyId, choiceId } }));
const storiesOf = (state, type) => state.stories.filter((story) => story.type === type);
const openOf = (state, type) => storiesOf(state, type).filter((story) => story.status === 'open');
const rngOf = ({ rngState, actionRngState, plotRngState }) => ({ rngState, actionRngState, plotRngState });

// The representative's breakdown stands open, six months from its due date and twelve from the year turn. High stress draws illness at a real year turn, so the step runs alone here and the costs stay exact.
function broken(options) {
  const state = base(options), hooks = actionHooks(state), person = hooks.activeRepresentative();
  person.stress = 120;
  breakdownStep(state, [], hooks);
  return { state, story: openOf(state, 'stress_breakdown')[0], personId: person.id };
}

// The head of another house breaks down under an NPC ruler. hooks.canRule() is false, so she speaks for no realm.
const underNpc = () => broken({ mode: 'family', familyId: NAMARS });

// A child on the throne and the old ruler as her regent, as in reign.test.js. The reign is the child's, as crown leaves it.
function regency() {
  const state = plain(base());
  Object.assign(state.offices.ruler, { holderId: CHILD, regentId: REP });
  state.reign.rulerId = CHILD;
  state.realm.lawfulRulerId = CHILD;
  state.regencies['office:ruler'] = { id: 'office:ruler', principalId: CHILD, regentId: REP, phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
  state.stories = [];
  delete state.mandateVersion; delete state.mandateActivatedAt; delete state.mandateSequence;
  return normalizeCharacterSystem(state);
}

// What a path through a breakdown can cost, for the representative of `state`.
function ledger(state, personId = REP) {
  const person = state.people[personId], family = actionHooks(state).controlledFamily();
  return { stress: person.stress, health: person.health, orders: state.actionPoints, lostOrders: state.reign.lostOrders, legitimacy: state.realm.legitimacy, prestige: state.realm.prestige, deeds: state.reign.deeds.breakdowns, silver: family.treasury };
}

// One goal record that failed `monthsAgo` before the state's date.
const failedGoal = (state, type, monthsAgo = 0) => ({ id: `goal-${++counter}`, type, baseline: 0, setAt: state.startedAt, dueAt: state.date, status: 'failed', closedAt: addGameMonths(state.date, -monthsAgo) });

// The real cost of a tag, read from the stress `charge` adds.
function stressOf(traits, tag) {
  const state = base(), person = state.people[REP];
  Object.assign(person, { traits, stress: 0 });
  actionHooks(state).charge(0, { orders: 0, tag });
  return person.stress;
}

test('stress values for existing tags and traits are unchanged', () => {
  const rows = [
    [[], { cruel: 7, betrayal: 8, generous: 0, risky: 4, surrender: 6, duty: 3 }],
    [['compassionate'], { cruel: 28, betrayal: 18 }],
    [['dutiful'], { cruel: 15, betrayal: 28, duty: 0 }],
    [['compassionate', 'dutiful'], { cruel: 36, betrayal: 38 }],
    [['greedy'], { generous: 14 }],
    [['cautious'], { risky: 18 }],
    [['ambitious'], { surrender: 24 }],
  ];
  for (const [traits, costs] of rows) for (const [tag, cost] of Object.entries(costs)) assert.equal(stressOf(traits, tag), cost, `${traits} ${tag}`);
});

test('the new traits add stress and the fitting ones remove it', () => {
  const rows = [
    [['just'], 'cruel', 15], [['honest'], 'betrayal', 20], [['just'], 'betrayal', 14], [['honest', 'just'], 'betrayal', 26],
    [['craven'], 'risky', 16], [['paranoid'], 'risky', 10], [['craven', 'paranoid'], 'risky', 22], [['brave'], 'surrender', 14],
    [['cruel'], 'cruel', 0], [['deceitful'], 'betrayal', 0], [['cruel', 'dutiful'], 'cruel', 0], [['deceitful', 'dutiful'], 'betrayal', 0], [['cruel', 'just'], 'cruel', 0],
    [['cruel'], 'betrayal', 8], [['deceitful'], 'cruel', 7], [['brave'], 'risky', 4], [['just'], 'duty', 3],
  ];
  for (const [traits, tag, cost] of rows) assert.equal(stressOf(traits, tag), cost, `${traits} ${tag}`);
});

test('natureStress reads a missing person as no nature, because a story can stand without a representative', () => {
  assert.equal(natureStress(null, 'cruel'), 0);
  assert.equal(natureStress({ traits: ['just'] }, 'cruel'), 8);
  assert.equal(natureStress({ traits: ['just'] }, 'unknown'), 0);
});

test('the first crossing of 80 opens stress_crisis and the second a breakdown', () => {
  const start = base();
  start.people[REP].stress = 90;
  const first = year(start);
  assert.equal(openOf(first, 'stress_crisis').length, 1);
  assert.equal(storiesOf(first, 'stress_breakdown').length, 0);
  const rested = resolve(first, openOf(first, 'stress_crisis')[0].id, 'rest');
  rested.people[REP].stress = 90;
  const second = year(rested);
  assert.equal(openOf(second, 'stress_breakdown').length, 1);
  assert.equal(storiesOf(second, 'stress_crisis').length, 1, 'no second crisis opens beside the breakdown');
});

test('stress 100 opens a breakdown at once', () => {
  const start = base();
  start.people[REP].stress = 103;
  const state = year(start);
  assert.equal(openOf(state, 'stress_breakdown').length, 1);
  assert.equal(storiesOf(state, 'stress_crisis').length, 0);
});

test('a crisis still open is no first crossing, so the next year turn opens nothing new', () => {
  const start = base();
  start.people[REP].stress = 90;
  const first = year(start);
  first.people[REP].stress = 90;
  const second = year(first);
  assert.equal(storiesOf(second, 'stress_breakdown').length, 0);
  assert.equal(storiesOf(second, 'stress_crisis').length, 1);
});

test('one year turn cannot open both, also when the pressure carries stress past 100', () => {
  const start = base();
  start.people[REP].stress = 96;
  start.realm.treasury = 0;
  start.reign.goals = ['fill_treasury', 'strong_army', 'full_council'].map((type) => ({ ...failedGoal(start, type), closedAt: addGameMonths(start.date, 6) }));
  const first = year(start);
  assert.ok(first.people[REP].stress >= BREAKDOWN_STRESS, `stress ${first.people[REP].stress}`);
  assert.equal(openOf(first, 'stress_crisis').length, 1);
  assert.equal(storiesOf(first, 'stress_breakdown').length, 0);
  assert.equal(openOf(year(first), 'stress_breakdown').length, 1, 'the next year turn opens it');
});

test('breakdownDue follows the two thresholds and the 60 months', () => {
  assert.deepEqual([CRISIS_STRESS, BREAKDOWN_STRESS, CRISIS_MEMORY_MONTHS], [80, 100, 60]);
  const state = base(), actor = state.people[REP];
  const crisis = (createdAt, status, actorId = REP) => ({ id: `story-${++counter}`, type: 'stress_crisis', actorId, createdAt, dueAt: createdAt, status, knownBy: [actorId] });
  actor.stress = 99;
  assert.equal(breakdownDue(state, actor), false);
  actor.stress = 100;
  assert.equal(breakdownDue(state, actor), true);
  const cases = [
    [79, 'resolved', -60, REP, false], [80, 'resolved', -60, REP, true], [80, 'resolved', -61, REP, false],
    [80, 'open', 0, REP, false], [80, 'closed', 0, REP, false], [80, 'resolved', 0, HEIR, false],
  ];
  for (const [stress, status, months, actorId, due] of cases) {
    actor.stress = stress;
    state.stories = [crisis(addGameMonths(state.date, months), status, actorId)];
    assert.equal(breakdownDue(state, actor), due, `${stress} ${status} ${months} ${actorId}`);
  }
});

test('a breakdown opens as the public story and event the court reads', () => {
  const { state, story } = broken();
  assert.equal(story.title, `${state.people[REP].name} bryter samman`);
  assert.equal(story.actorId, REP);
  assert.equal(story.knownBy, 'public');
  assert.equal(story.createdAt, state.date);
  assert.equal(story.dueAt, addGameMonths(state.date, 6));
  assert.equal(story.deadlineText, 'Utan ett val kostar sammanbrottet 20 hälsa, 8 legitimitet och årets alla handlingar.');
  const entry = state.log.find((item) => item.title === 'Sammanbrott vid hovet');
  assert.equal(entry.public, true);
  assert.deepEqual(entry.participants, [REP]);
  const shown = getCharacterPresentation(state).stories.find((item) => item.id === story.id);
  assert.deepEqual(shown.choices.map(({ id, label, stress, disabledReason }) => [id, label, stress, disabledReason]), [
    ['withdraw', 'Dra dig undan hovet', '−50', ''], ['rage', 'Släpp lös vreden', '−40', ''], ['vice', 'Sök tröst i vinet', '−35', ''],
  ]);
  assert.ok(shown.choices.every((choice) => choice.description && choice.cost));
  assert.equal(shown.deadlineText, story.deadlineText);
  assert.ok(normalizeCharacterSystem(plain(state)));
});

test('only one breakdown stands open at a time', () => {
  const { state } = broken();
  breakdownStep(state, [], actionHooks(state));
  assert.equal(openOf(state, 'stress_breakdown').length, 1);
});

test('withdraw takes 50 stress, the orders of this year and two of the next, and 4 legitimacy', () => {
  const { state, story } = broken(), before = ledger(state);
  const after = ledger(resolve(state, story.id, 'withdraw'));
  assert.deepEqual(after, { ...before, stress: before.stress - 50, orders: 0, lostOrders: 2, legitimacy: before.legitimacy - 4, prestige: before.prestige - 5, deeds: 1 });
});

test('rage takes 40 stress and 2 legitimacy, cows the nobles and sours the other heads', () => {
  const { state, story } = broken(), before = ledger(state);
  const heads = ['person-1-0', 'person-2-0', 'person-3-0'], opinions = heads.map((head) => getPersonalOpinion(state, head, REP));
  const fear = state.people[NOBLE].fear;
  const after = resolve(state, story.id, 'rage');
  assert.deepEqual(ledger(after), { ...before, stress: before.stress - 40, legitimacy: before.legitimacy - 2, prestige: before.prestige - 5, deeds: 1 });
  assert.equal(after.people[NOBLE].fear, fear + 10);
  assert.deepEqual(heads.map((head) => getPersonalOpinion(after, head, REP)), opinions.map((opinion) => opinion - 15));
});

test('rage passes over a dead head and a family in exile', () => {
  const { state, story } = broken(), dead = 'person-2-0', exiled = 'person-3-0';
  state.people[dead].diedAt = state.date;
  state.families['family-safra'].exiled = true;
  resolveBreakdown(state, story, 'rage', [], actionHooks(state));
  assert.equal(state.relations[`${dead}:${REP}`]?.causes?.length ?? 0, 0);
  assert.equal(state.relations[`${exiled}:${REP}`]?.causes?.length ?? 0, 0);
  assert.equal(state.relations[`person-1-0:${REP}`].causes.filter((cause) => cause.amount === -15).length, 1);
});

test('a second rage hurts as much as the first', () => {
  const { state, story } = broken(), opinion = getPersonalOpinion(state, 'person-1-0', REP);
  const hooks = actionHooks(state);
  resolveBreakdown(state, story, 'rage', [], hooks);
  resolveBreakdown(state, { ...story, id: 'story-later' }, 'rage', [], hooks);
  assert.equal(getPersonalOpinion(state, 'person-1-0', REP), opinion - 30);
});

test('vice takes 35 stress, 15 health and 30 silver of the family, with floors at 1 and 0', () => {
  const { state, story } = broken();
  state.people[REP].health = 60;
  const before = ledger(state), after = ledger(resolve(state, story.id, 'vice'));
  assert.deepEqual(after, { ...before, stress: before.stress - 35, health: 45, silver: before.silver - 30, prestige: before.prestige - 5, deeds: 1 });
  const poor = broken();
  poor.state.people[REP].health = 10;
  actionHooks(poor.state).controlledFamily().treasury = 12;
  const spent = ledger(resolve(poor.state, poor.story.id, 'vice'));
  assert.equal(spent.health, 1);
  assert.equal(spent.silver, 0);
});

test('an unanswered breakdown collapses on its date, the same for whole and split advances', () => {
  const { state, story } = broken(), before = ledger(state);
  const target = addGameMonths(state.date, 9);
  const whole = ok(advanceCharacters(state, target, { id: 'whole' }));
  let split = state;
  for (let month = 1; month <= 9; month++) split = ok(advanceCharacters(split, addGameMonths(state.date, month), { id: `month-${month}` }));
  const [record] = storiesOf(whole, 'stress_breakdown');
  assert.equal(record.status, 'resolved');
  assert.equal(record.choiceId, 'collapse');
  assert.equal(record.resolvedAt, story.dueAt);
  assert.deepEqual(ledger(whole), { ...before, stress: before.stress - 30, health: before.health - 20, orders: 0, lostOrders: 2, legitimacy: before.legitimacy - 8, prestige: before.prestige - 5, deeds: 1 });
  const content = ({ revision, appliedCommandIds, ...rest }) => rest;
  assert.deepEqual(content(split), content(whole));
});

test('the due date of an open breakdown is a step of the calendar', () => {
  const { state, story } = broken();
  assert.equal(getNextCharacterTransitionDate(state, addGameMonths(state.date, 9)), story.dueAt);
  const answered = resolve(state, story.id, 'withdraw');
  assert.notEqual(getNextCharacterTransitionDate(answered, addGameMonths(state.date, 9)), story.dueAt);
});

test('the collapse keeps its floors', () => {
  const { state, story } = broken();
  state.people[REP].health = 15;
  state.realm.legitimacy = 3;
  const after = ok(advanceCharacters(state, story.dueAt, { id: 'collapse' }));
  assert.equal(after.people[REP].health, 1);
  assert.equal(after.realm.legitimacy, 0);
});

test('every breakdown costs something', () => {
  const costs = (before, after) => ({ prestige: before.prestige - after.prestige, resource: [before.health - after.health, before.silver - after.silver, before.legitimacy - after.legitimacy, before.orders - after.orders].filter((lost) => lost > 0).length });
  for (const choiceId of ['withdraw', 'rage', 'vice']) {
    const { state, story } = broken(), before = ledger(state), after = ledger(resolve(state, story.id, choiceId));
    const { prestige, resource } = costs(before, after);
    assert.equal(prestige, 5, choiceId);
    assert.ok(resource > 0, choiceId);
    assert.equal(after.deeds, 1, choiceId);
  }
  const { state, story } = broken(), before = ledger(state), after = ledger(ok(advanceCharacters(state, story.dueAt, { id: 'collapse' })));
  const { prestige, resource } = costs(before, after);
  assert.equal(prestige, 5, 'collapse');
  assert.ok(resource > 0, 'collapse');
  assert.equal(after.deeds, 1, 'collapse');
});

test('lost orders apply at the next year turn', () => {
  const { state, story } = broken();
  const answered = resolve(state, story.id, 'withdraw');
  assert.equal(answered.actionPoints, 0);
  const next = year(answered);
  assert.equal(next.actionPoints, 2);
  assert.equal(next.reign.lostOrders, 0);
  assert.equal(year(next).actionPoints, 4);
});

test('lost orders stop at zero', () => {
  const state = base();
  Object.assign(state.reign, { lostOrders: 2 });
  state.actionPoints = 1;
  courtAnnualStep(state, [], actionHooks(state));
  assert.equal(state.actionPoints, 0);
  assert.equal(state.reign.lostOrders, 0);
});

test('a breakdown closes without cost when its actor stops being the representative', () => {
  const dead = broken();
  const dying = dead.state, costBefore = { prestige: dying.realm.prestige, silver: dying.families[OWN].treasury };
  actionHooks(dying).kill([REP], [], 'Ett prov');
  const buried = ok(advanceCharacters(dying, addGameMonths(dying.date, 1), { id: 'after-death' }));
  const [lost] = storiesOf(buried, 'stress_breakdown');
  assert.equal(lost.status, 'closed');
  assert.equal(lost.resolution, 'Personens liv har avslutats.');
  assert.equal(lost.choiceId, undefined);
  assert.equal(buried.reign.lostOrders, 0);
  assert.deepEqual({ prestige: buried.realm.prestige, deeds: buried.reign.deeds.breakdowns }, { prestige: costBefore.prestige, deeds: 0 });

  const { state, story } = broken(), events = [];
  const hooks = actionHooks(state);
  hooks.crown(state.people[HEIR], events, 'Ett prov', 55, true);
  const before = ledger(state);
  refreshCourtStories(state, events, actionHooks(state));
  assert.equal(story.status, 'closed');
  assert.equal(story.resolvedAt, state.date);
  assert.equal(story.resolution, 'Personen företräder inte längre familjen eller riket.');
  assert.deepEqual(ledger(state), before);
  assert.ok(events.some((event) => event.type === 'story_closed' && event.title === story.title));
});

test('a family head under an NPC ruler pays for each path and charges the realm nothing, and it is no deed of the ruler', () => {
  const paths = { withdraw: { stress: -50, orders: 0, lostOrders: 2 }, rage: { stress: -40 }, vice: { stress: -35, health: -15, silver: -30 } };
  for (const [choiceId, change] of Object.entries(paths)) {
    const { state, story, personId } = underNpc();
    assert.equal(personId, HEAD);
    assert.notEqual(state.offices.ruler.holderId, personId);
    state.people[HEAD].health = 60;
    const before = ledger(state, HEAD), after = ledger(resolve(state, story.id, choiceId), HEAD);
    const expected = { ...before, stress: before.stress + change.stress, health: before.health + (change.health ?? 0), silver: before.silver + (change.silver ?? 0) };
    if ('orders' in change) Object.assign(expected, { orders: change.orders, lostOrders: change.lostOrders });
    assert.deepEqual(after, expected, choiceId);
  }
});

test('a family head\'s collapse under an NPC ruler costs health and orders, and the realm nothing', () => {
  const { state, story } = underNpc(), before = ledger(state, HEAD);
  const after = ok(advanceCharacters(state, story.dueAt, { id: 'collapse' }));
  assert.deepEqual(ledger(after, HEAD), { ...before, stress: before.stress - 30, health: before.health - 20, orders: 0, lostOrders: 2 });
  assert.equal(after.log.find((item) => item.type === 'story_expired' && item.title === story.title).description, 'Ingen valde i tid. Sammanbrottet kostade 20 hälsa, årets handlingar och 2 handlingar nästa år.');
});

test('rage under an NPC ruler cows nobody and still sours the other heads', () => {
  const { state, story } = underNpc();
  const heads = ['person-0-0', 'person-2-0', 'person-3-0'], opinions = heads.map((head) => getPersonalOpinion(state, head, HEAD));
  const after = resolve(state, story.id, 'rage');
  for (const person of Object.values(after.people)) assert.equal(person.fear, state.people[person.id].fear, person.id);
  assert.deepEqual(heads.map((head) => getPersonalOpinion(after, head, HEAD)), opinions.map((opinion) => opinion - 15));
});

test('every path costs a family head under an NPC ruler something', () => {
  const heads = ['person-0-0', 'person-2-0', 'person-3-0'];
  const opinionOfHeads = (state) => heads.reduce((sum, head) => sum + getPersonalOpinion(state, head, HEAD), 0);
  const lost = (state, later) => {
    const before = ledger(state, HEAD), after = ledger(later, HEAD);
    return [before.health - after.health, before.silver - after.silver, before.orders - after.orders, opinionOfHeads(state) - opinionOfHeads(later)].filter((value) => value > 0).length;
  };
  for (const choiceId of ['withdraw', 'rage', 'vice']) {
    const { state, story } = underNpc();
    assert.ok(lost(state, resolve(state, story.id, choiceId)) > 0, choiceId);
  }
  const { state, story } = underNpc();
  assert.ok(lost(state, ok(advanceCharacters(state, story.dueAt, { id: 'collapse' }))) > 0, 'collapse');
});

test('the texts of a breakdown under an NPC ruler name only what the path charges', () => {
  const { state, story } = underNpc();
  assert.equal(story.deadlineText, 'Utan ett val kostar sammanbrottet 20 hälsa och årets alla handlingar.');
  const shown = getCharacterPresentation(state).stories.find((item) => item.id === story.id);
  assert.equal(shown.deadlineText, story.deadlineText);
  assert.deepEqual(shown.choices.map(({ id, cost }) => [id, cost]), [
    ['withdraw', 'Årets handlingar och 2 handlingar nästa år'],
    ['rage', '15 i åsikt hos de andra familjernas huvudmän'],
    ['vice', '15 hälsa och 30 familjesilver'],
  ]);
  const rage = shown.choices.find((choice) => choice.id === 'rage');
  assert.equal(rage.description, 'Minska stress med 40. De andra familjernas huvudmän tycker 15 sämre om dig.');
  for (const text of shown.choices.flatMap(({ description, cost }) => [description, cost])) assert.doesNotMatch(text, /legitimitet|ryktbarhet|skräm/, text);
});

test('a family head who holds the crown and a regent both speak for the realm', () => {
  const crowned = broken({ mode: 'family', familyId: OWN });
  assert.equal(actionHooks(crowned.state).canRule(), true);
  assert.equal(crowned.story.deadlineText, 'Utan ett val kostar sammanbrottet 20 hälsa, 8 legitimitet och årets alla handlingar.');
  const before = ledger(crowned.state), after = ledger(resolve(crowned.state, crowned.story.id, 'rage'));
  assert.deepEqual(after, { ...before, stress: before.stress - 40, legitimacy: before.legitimacy - 2, prestige: before.prestige - 5, deeds: 1 });

  const state = regency(), hooks = actionHooks(state);
  assert.equal(hooks.activeRepresentative().id, REP);
  assert.equal(hooks.canRule(), true);
  state.people[REP].stress = 120;
  breakdownStep(state, [], hooks);
  const [story] = openOf(state, 'stress_breakdown'), reigning = ledger(state);
  assert.equal(story.deadlineText, 'Utan ett val kostar sammanbrottet 20 hälsa, 8 legitimitet och årets alla handlingar.');
  assert.deepEqual(ledger(resolve(state, story.id, 'withdraw')), { ...reigning, stress: reigning.stress - 50, orders: 0, lostOrders: 2, legitimacy: reigning.legitimacy - 4, prestige: reigning.prestige - 5 }, 'the deed stays the ruler\'s, and a regent is not the ruler');
});

test('the choices, the pressure and the opening draw nothing', () => {
  const { state, story } = broken(), rng = rngOf(state), before = plain(state);
  assert.deepEqual(breakdownChoices(state, story, actionHooks(state)).map((choice) => choice.id), ['withdraw', 'rage', 'vice']);
  assert.deepEqual(courtStoryChoices(state, story, actionHooks(state)), breakdownChoices(state, story, actionHooks(state)));
  assert.deepEqual(plain(state), before);
  stressPressureStep(state, actionHooks(state));
  breakdownStep(state, [], actionHooks(state));
  assert.deepEqual(rngOf(state), rng);
});

test('the court story list names the three types, and a choice outside the list is refused', () => {
  assert.deepEqual(COURT_STORY_TYPES, ['stress_breakdown', 'family_demand', 'faction_ultimatum']);
  const { state, story } = broken();
  const result = executeCharacterCommand(state, { id: 'refused-collapse', expectedRevision: state.revision, type: 'resolve_story', payload: { storyId: story.id, choiceId: 'collapse' } });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Valet är inte giltigt.');
});

// Only a faction the player has found weighs on the representative.
const knownFaction = (state) => ({ id: 'faction-1', targetRulerId: REP, leaderId: NOBLE, claimantId: HEIR, memberIds: [NOBLE, 'person-1-2'], knownMemberIds: [NOBLE], formedAt: state.date, status: 'active', outcome: null, quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null });

test('stressPressureStep sums over empty lists until demands and factions exist', () => {
  for (const change of [() => {}, (state) => { delete state.familyDemands; delete state.factions; }]) {
    const state = base();
    change(state);
    state.people[REP].stress = 10;
    stressPressureStep(state, actionHooks(state));
    assert.equal(state.people[REP].stress, 10);
  }
});

test('the pressure counts a failed goal once and a low treasury below 20', () => {
  const pressure = (prepare) => {
    const state = base();
    state.people[REP].stress = 10;
    prepare(state);
    stressPressureStep(state, actionHooks(state));
    return state.people[REP].stress - 10;
  };
  assert.equal(pressure((state) => { state.reign.goals = [failedGoal(state, 'fill_treasury')]; }), 4);
  assert.equal(pressure((state) => { state.reign.goals = [failedGoal(state, 'fill_treasury', 11)]; }), 4);
  assert.equal(pressure((state) => { state.reign.goals = [failedGoal(state, 'fill_treasury', 12)]; }), 0, 'goals close on year turns, so 12 months back is last year');
  assert.equal(pressure((state) => { state.reign.goals = [{ ...failedGoal(state, 'fill_treasury'), status: 'met' }]; }), 0);
  assert.equal(pressure((state) => { state.realm.treasury = 19; }), 3);
  assert.equal(pressure((state) => { state.realm.treasury = 20; }), 0);
});

test('the pressure reads refused and lapsed demands and the known factions, at most 15 a year', () => {
  const closed = (state, status, monthsAgo = 0) => ({ status, closedAt: addGameMonths(state.date, -monthsAgo) });
  const pressure = (prepare) => {
    const state = base();
    state.people[REP].stress = 10;
    prepare(state);
    stressPressureStep(state, actionHooks(state));
    return state.people[REP].stress - 10;
  };
  assert.equal(pressure((state) => { state.familyDemands = [closed(state, 'refused'), closed(state, 'lapsed'), closed(state, 'granted')]; }), 8);
  assert.equal(pressure((state) => { state.familyDemands = [closed(state, 'lapsed', 12)]; }), 0, 'a lapse counted on the turn it closed');
  assert.equal(pressure((state) => { state.familyDemands = [closed(state, 'refused', 12)]; }), 4, 'the player refused after that turn, so this turn is the first to count it');
  assert.equal(pressure((state) => { state.familyDemands = [closed(state, 'refused', 13)]; }), 0);
  assert.equal(pressure((state) => { state.factions = [knownFaction(state)]; }), 6);
  assert.equal(pressure((state) => {
    state.familyDemands = [closed(state, 'refused')];
    state.factions = [knownFaction(state)];
    state.reign.goals = [failedGoal(state, 'fill_treasury'), failedGoal(state, 'strong_army')];
    state.realm.treasury = 0;
  }), 15);
});

test('the pressure falls on the representative, also when she is a family head and not the ruler', () => {
  const state = base({ mode: 'family', familyId: NAMARS });
  state.families[NAMARS].treasury = 19;
  const { stress } = state.people[HEAD], rulerStress = state.people[REP].stress;
  stressPressureStep(state, actionHooks(state));
  assert.equal(state.people[HEAD].stress, stress + 3);
  assert.equal(state.people[REP].stress, rulerStress);
});

test('under an NPC ruler the low treasury is the family\'s own, and the realm\'s weighs nothing', () => {
  const pressure = (prepare) => {
    const state = base({ mode: 'family', familyId: NAMARS });
    state.people[HEAD].stress = 10;
    prepare(state);
    stressPressureStep(state, actionHooks(state));
    return state.people[HEAD].stress - 10;
  };
  assert.equal(pressure((state) => { state.realm.treasury = 0; }), 0);
  assert.equal(pressure((state) => { state.families[NAMARS].treasury = 19; }), 3);
  assert.equal(pressure((state) => { state.families[NAMARS].treasury = 20; }), 0);
});

test('a regent feels the realm\'s treasury, not the family\'s', () => {
  const pressure = (prepare) => {
    const state = regency();
    state.people[REP].stress = 10;
    prepare(state);
    stressPressureStep(state, actionHooks(state));
    return state.people[REP].stress - 10;
  };
  assert.equal(pressure((state) => { state.realm.treasury = 19; }), 3);
  assert.equal(pressure((state) => { state.families[OWN].treasury = 0; }), 0);
});

test('the year turn takes the lost orders first and ends with the pressure and then the breakdown', () => {
  const state = base(), events = [];
  state.reign.goals = [failedGoal(state, 'fill_treasury')];
  state.reign.lostOrders = 2;
  state.people[REP].stress = 97;
  courtAnnualStep(state, events, actionHooks(state));
  assert.equal(state.actionPoints, 2);
  assert.equal(state.people[REP].stress, 101);
  assert.equal(openOf(state, 'stress_breakdown').length, 1);
  assert.ok(events.some((event) => event.title === 'Sammanbrott vid hovet'));
});

test('a dissolved realm takes no pressure and opens no breakdown', () => {
  const state = plain(base());
  state.realm.alive = false;
  state.people[REP].stress = 120;
  state.reign.lostOrders = 2;
  const before = plain(state);
  courtAnnualStep(state, [], actionHooks(state));
  assert.deepEqual(state, before);
});

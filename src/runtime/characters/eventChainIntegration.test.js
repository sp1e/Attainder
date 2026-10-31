import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths, compareGameDates } from '../gameDates.js';
import { applyCharacterOpsToWorld, characterTransitionEvents, planCharacterAdvance } from '../characterWorld.js';
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, getNextCharacterTransitionDate } from './index.js';
import { ensureEventChains, validateEventChains } from './eventChains.js';

// These tests drive the heir_margin chain only through public engine entry
// points: advanceCharacters opens it, resolve_story answers it, and the host
// adapter in characterWorld.js stores and replays what happened. They pin the
// behavior the AI game master has to keep.
const FAMILY = 'family-arel';
let sequence = 0;

function advance(state, date, id) {
  const result = advanceCharacters(state, date, { id });
  assert.equal(result.ok, true, result.error);
  validateEventChains(result.state);
  return result.state;
}
function resolve(state, storyId, choiceId) {
  return executeCharacterCommand(state, { id: `chain-integration-${++sequence}`, type: 'resolve_story',
    expectedRevision: state.revision, payload: { storyId, choiceId } });
}
function answer(state, storyId, choiceId) {
  const result = resolve(state, storyId, choiceId);
  assert.equal(result.ok, true, result.error);
  validateEventChains(result.state);
  return result;
}
// Same cast as eventChains.test.js (seed 321, calm cities, person-0-4 mentored
// by person-1-1), then one real year of simulation. At this seed the annual
// step opens the heir_margin chain on the first anniversary. healthRng is a
// saved health RNG fixture, as in health.test.js: 10 gives person-0-0 a
// moderate smallpox case that does not take the household head out of office.
// To replace a seed that no longer does: loop healthRng through openChain, print
// person-0-0's healthConditions (kind, severity, nextTransitionAt), and keep one
// with smallpox of severity 1 or 2 and an open health_care story.
function openChain({ healthRng = null } = {}) {
  const initial = createCharacterSystem({ seed: 321 }); ensureEventChains(initial);
  for (const city of Object.values(initial.cities)) city.unrest = 0;
  initial.people['person-0-4'].mentorId = 'person-1-1';
  if (healthRng) initial.healthRngState = healthRng;
  const state = advance(initial, addGameMonths(initial.date, 12), 'open-chain');
  const story = state.stories.find((item) => item.type === 'event_chain' && item.status === 'open');
  assert.ok(story, 'the first annual step opens a chain');
  assert.equal(state.eventChains.records.length, 1);
  assert.equal(state.eventChains.records[0].templateId, 'heir_margin');
  assert.equal(story.stageId, 'margin');
  return { state, story };
}
function afterPaidChoice(options) {
  const { state: before, story } = openChain(options);
  const result = answer(before, story.id, 'extra_lessons');
  return { before, story, state: result.state, result, record: result.state.eventChains.records[0] };
}
const openStories = (state, type) => state.stories.filter((item) => item.type === type && item.status === 'open');
// Two calendars for the continuation tests. In the default fixture a fever
// resolves on the continuation date, so the engine would stop there even without
// the chain. Health RNG 547 leaves one injury whose phase ends a month later:
// the chain's own date is then the only calendar boundary at nextAt. The
// chainOnly flag makes continuation() assert that premise instead of trusting
// the seed. To replace a seed that fails it: loop healthRng through
// afterPaidChoice, print every person's healthConditions, and keep one that has
// only injuries (or nothing); fever and smallpox phases land on the 3-month mark.
const CALENDARS = [
  { label: 'default health fixture', options: {} },
  { label: 'chain as the only dated event', options: { healthRng: 547 }, chainOnly: true },
];

// Proves the chain is the only reason the calendar stops at record.nextAt. It
// checks the conditions' own dates, then walks the calendar with the chain
// closed: a fever's second phase is created later, so a field check on the
// post-choice state alone would miss a phase that ends on nextAt.
function assertChainIsOnlyBoundary(state, record, label, seed) {
  const advice = `Health RNG ${seed} no longer leaves the chain as the only dated event at ${record.nextAt}; pick a new seed (see CALENDARS).`;
  for (const person of Object.values(state.people)) for (const condition of person.healthConditions) {
    assert.notEqual(condition.nextTransitionAt, record.nextAt, `${label}: ${person.id} ${condition.kind} ends a phase on nextAt. ${advice}`);
    assert.notEqual(condition.nextExposureAt, record.nextAt, `${label}: ${person.id} ${condition.kind} exposes on nextAt. ${advice}`);
  }
  const probe = structuredClone(state);
  const chain = probe.eventChains.records.find((item) => item.id === record.id);
  Object.assign(chain, { status: 'closed', closedAt: probe.date, nextAt: null, nextStageId: null });
  const end = addGameMonths(probe.date, 12);
  let walked = probe;
  let next = getNextCharacterTransitionDate(walked, end);
  while (next && compareGameDates(next, record.nextAt) < 0) {
    const step = advanceCharacters(walked, next, { id: `probe-${next}` });
    assert.equal(step.ok, true, step.error);
    walked = step.state;
    next = getNextCharacterTransitionDate(walked, end);
  }
  assert.notEqual(next, record.nextAt, `${label}: another calendar boundary falls on nextAt once the chain is closed. ${advice}`);
}
// A paid-choice fixture for one calendar, with its premise checked.
function continuation({ label, options, chainOnly = false }) {
  const fixture = afterPaidChoice(options);
  if (chainOnly) assertChainIsOnlyBoundary(fixture.state, fixture.record, label, options.healthRng);
  return fixture;
}

const domain = (state) => { const { revision: _revision, appliedCommandIds: _ids, ...rest } = state; return rest; };

test('a paid chain choice replays from its stored patch without a second debit', () => {
  const { before, result, state: live } = afterPaidChoice();
  const treasury = before.families[FAMILY].treasury;
  assert.equal(live.families[FAMILY].treasury, treasury - 18);

  const events = characterTransitionEvents(before, result, 'op-1');
  const ops = events.at(-1).impacts.characterOps;
  assert.equal(ops.length, 1);
  assert.equal(ops[0].kind, 'patch');
  assert.equal(ops[0].fromRevision, before.revision);
  assert.equal(ops[0].toRevision, live.revision);

  const replayed = applyCharacterOpsToWorld({ characterSystem: before }, ops, { source: 'character-system' });
  assert.equal(replayed.characterSystem.families[FAMILY].treasury, live.families[FAMILY].treasury);
  assert.equal(replayed.characterSystem.families[FAMILY].treasury, treasury - 18);
  assert.equal(replayed.characterSystem.revision, live.revision);
  assert.deepEqual(replayed.characterSystem.eventChains, live.eventChains);

  const again = applyCharacterOpsToWorld(replayed, ops, { source: 'character-system' });
  assert.equal(again.characterSystem.families[FAMILY].treasury, treasury - 18);
  assert.equal(again.characterSystem.revision, live.revision);
  assert.deepEqual(again.characterSystem, replayed.characterSystem);
});

test('the turn stops at a chain continuation inside the year', () => {
  for (const calendar of CALENDARS) {
    const { label } = calendar;
    const { state, record, story } = continuation(calendar);
    const first = state.stories.find((item) => item.id === story.id);
    assert.equal(first.status, 'resolved', label);
    assert.equal(record.status, 'waiting', label);
    assert.equal(record.nextAt, addGameMonths(state.date, 3), label);
    const target = addGameMonths(state.date, 12);
    assert.equal(compareGameDates(record.nextAt, target) < 0, true, `${label}: the continuation falls inside the requested year`);

    const plan = planCharacterAdvance({ characterSystem: state }, target, { pauseForCharacterDecisions: true });
    assert.equal(plan.interruption.type, 'character-story', label);
    assert.equal(plan.interruption.date, record.nextAt, label);
    assert.equal(plan.interruption.requestedDate, target, label);
    assert.deepEqual(plan.interruption.storyIds, [`${record.id}-step-2`], label);
    assert.equal(plan.state.date, record.nextAt, label);
    assert.ok(plan.events.length > 0, label);
    assert.equal(plan.events.every((event) => compareGameDates(event.date, plan.interruption.date) <= 0), true, label);
    assert.equal(plan.events.at(-1).date, plan.interruption.date, label);

    const next = plan.state.stories.find((item) => item.id === plan.interruption.storyIds[0]);
    assert.equal(next.type, 'event_chain', label);
    assert.equal(next.status, 'open', label);
    assert.equal(next.causeId, first.outcomeMemoryId, label);

    // The stored events alone must rebuild the state the turn stopped in.
    const rebuilt = plan.events.reduce((world, event) => applyCharacterOpsToWorld(world, event.impacts.characterOps ?? [], { source: 'character-system' }),
      { characterSystem: state });
    assert.deepEqual(rebuilt.characterSystem, plan.state, label);
  }
});

test('health and chain decisions on the same date stay separate', () => {
  const { state: opened, story } = openChain({ healthRng: 10 });
  const patient = opened.people['person-0-0'];
  const illness = patient.healthConditions.find((item) => item.kind === 'smallpox');
  assert.ok(illness, 'health RNG 10 should give person-0-0 smallpox; pick a new seed (see openChain)');
  assert.equal(illness.stage, 'active');
  assert.equal(openStories(opened, 'health_care').length, 1);
  assert.equal(openStories(opened, 'health_care')[0].actorId, patient.id);

  const paid = answer(opened, story.id, 'extra_lessons').state;
  const record = paid.eventChains.records[0];
  assert.equal(paid.stories.find((item) => item.id === story.id).decisionActorId, patient.id, 'the sick household head still decides the chain step');
  assert.equal(paid.people[patient.id].healthConditions.find((item) => item.id === illness.id).nextTransitionAt, record.nextAt,
    'the illness phase and the chain continuation fall on one date');
  assert.equal(record.nextAt, addGameMonths(opened.date, 3));

  const sameDate = advance(paid, record.nextAt, 'to-same-date');
  assert.equal(sameDate.date, record.nextAt);
  const careBefore = openStories(sameDate, 'health_care');
  const chainBefore = openStories(sameDate, 'event_chain');
  assert.equal(careBefore.length, 1);
  assert.equal(chainBefore.length, 1);
  assert.equal(chainBefore[0].id, `${record.id}-step-2`);
  assert.equal(sameDate.people[patient.id].healthConditions.find((item) => item.id === illness.id).stage, 'recovering');

  const careChoices = (state) => getCharacterPresentation(state).stories.find((item) => item.id === careBefore[0].id).choices;
  const choicesBefore = careChoices(sameDate);
  assert.deepEqual(choicesBefore.map((choice) => choice.id), ['physician', 'rest', 'watch']);

  const after = answer(sameDate, chainBefore[0].id, 'support_child').state;
  assert.equal(after.stories.find((item) => item.id === chainBefore[0].id).status, 'resolved');
  const careAfter = after.stories.find((item) => item.id === careBefore[0].id);
  assert.equal(careAfter.status, 'open');
  assert.deepEqual(careAfter, careBefore[0]);
  assert.deepEqual(careChoices(after), choicesBefore);
  assert.equal(after.people[patient.id].healthConditions.find((item) => item.id === illness.id).treatment, null);
  assert.equal(after.families[FAMILY].treasury, sameDate.families[FAMILY].treasury, 'a free chain choice leaves the care money alone');
  assert.equal(openStories(after, 'health_care').length, 1);
});

test('whole and split advances through a chain continuation are identical', () => {
  for (const calendar of CALENDARS) {
    const { label } = calendar;
    const { state, record } = continuation(calendar);
    const target = addGameMonths(state.date, 12);
    assert.equal(compareGameDates(record.nextAt, target) < 0, true, label);
    const whole = advance(state, target, 'a');
    const middle = advance(state, record.nextAt, 'a1');
    const split = advance(middle, target, 'a2');
    assert.equal(middle.date, record.nextAt, label);
    assert.equal(openStories(middle, 'event_chain').length, 1, `${label}: the continuation is open at the split point`);
    assert.equal(whole.date, target, label);
    assert.deepEqual(domain(split), domain(whole), label);
    assert.equal(whole.eventChains.records[0].stepIds.length, 2, label);
    assert.equal(whole.stories.find((item) => item.id === `${record.id}-step-2`).createdAt, record.nextAt, label);
  }
});

test('insufficient family funds leave the chain unchanged under a command', () => {
  const { state: opened, story } = openChain();
  opened.families[FAMILY].treasury = 0;
  const snapshot = structuredClone(opened);

  const result = resolve(opened, story.id, 'extra_lessons');
  assert.equal(result.ok, false);
  assert.match(result.error, /medel/);
  assert.deepEqual(opened, snapshot);
  assert.deepEqual(result.state, snapshot);
  assert.equal(result.state.families[FAMILY].treasury, 0);
  assert.equal(result.state.appliedCommandIds.length, snapshot.appliedCommandIds.length);

  const record = result.state.eventChains.records[0];
  assert.equal(record.status, 'open');
  assert.equal(record.stepIds.length, 1);
  assert.equal(result.state.stories.find((item) => item.id === record.stepIds[0]).status, 'open');
  assert.equal(result.state.memories.some((memory) => memory.type === 'chain_choice'), false);
  validateEventChains(result.state);
});

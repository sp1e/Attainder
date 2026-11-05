import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths, compareGameDates } from '../gameDates.js';
import { normalizeWorldState } from '../gameState.js';
import { applyCharacterOpsToWorld, characterTransitionEvents, planCharacterAdvance } from '../characterWorld.js';
import { advanceCharacters, applyRealmDissolution, createCharacterSystem, executeCharacterCommand, getCharacterAge, getCharacterPresentation, getNextCharacterTransitionDate, normalizeCharacterSystem } from './index.js';
import { ensureEventChains, validateEventChains } from './eventChains.js';
import { getDirectedStoryCandidates } from './storyDirector.js';

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
// The plot stream is found: on it no house makes a demand in the two years these
// tests cross. A lapsed demand costs 15 of the head's opinion, and below -10 he can
// open a second chain, whose draw is no continuation. To replace it: loop
// plotRngState through walkChain and keep one that leaves familyDemands empty on
// both CALENDARS.
const QUIET_PLOT_STREAM = 123821063;
function openChain({ healthRng = null } = {}) {
  const initial = createCharacterSystem({ seed: 321 }); ensureEventChains(initial);
  for (const city of Object.values(initial.cities)) city.unrest = 0;
  initial.people['person-0-4'].mentorId = 'person-1-1';
  if (healthRng) initial.healthRngState = healthRng;
  initial.plotRngState = QUIET_PLOT_STREAM;
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

// ---- Changes during a chain ----
// docs/design/event-chains.md: a lost binding closes the chain with a reason and
// the old decisions remain; a new authorized decision maker may take a later
// choice without replacing the earlier one in history. These tests make the
// change through a command or the calendar wherever the engine has a path for it.
const reload = (state) => normalizeCharacterSystem(JSON.parse(JSON.stringify(state)));
const command = (state, type, payload = {}) => {
  const result = executeCharacterCommand(state, { id: `chain-integration-${++sequence}`, type, expectedRevision: state.revision, payload });
  assert.equal(result.ok, true, result.error);
  return result.state;
};
const months = (state, count) => advance(state, addGameMonths(state.date, count), `chain-months-${++sequence}`);
const chainStories = (state) => state.stories.filter((item) => item.type === 'event_chain');
const memoriesOf = (state, type) => state.memories.filter((memory) => memory.type === type);
// Same shape as the fixture in incapacityIntegration.test.js: severity 3 removes
// the person from every mandate, and the rolls keep the person alive.
function illness(state, personId, kind = 'fever') {
  const length = { smallpox: 3, injury: 4, fever: 1 }[kind];
  state.people[personId].healthConditions.push({ id: `chain-illness-${++sequence}`, kind, severity: 3, stage: 'active', startedAt: state.date,
    nextTransitionAt: addGameMonths(state.date, length), nextExposureAt: null, stageHistory: [{ stage: 'active', date: state.date }], treatment: null,
    causeId: null, sourceKind: 'calendar', relatedPersonId: null, scarRoll: 0.99, outcomeRoll: 0.99, endedAt: null });
}
// A world where nothing can start a chain until `prepare` makes one template
// eligible. The first anniversary then casts it. `prepare` may return a later state.
function openTemplate(templateId, prepare, options = {}) {
  const initial = createCharacterSystem({ seed: 321, ...options }); ensureEventChains(initial);
  for (const city of Object.values(initial.cities)) city.unrest = 0;
  for (const person of Object.values(initial.people)) person.mentorId = null;
  const anniversary = addGameMonths(initial.date, 12);
  const state = advance(prepare(initial) ?? initial, anniversary, `open-${templateId}`);
  const record = state.eventChains.records[0];
  assert.equal(record?.templateId, templateId, `the anniversary casts ${templateId}`);
  return state;
}
const relate = (state, fromId, toId, amount) => {
  state.relations[`${fromId}:${toId}`] = { fromId, toId, bonds: [], causes: [{ id: `chain-relation-${++sequence}`, amount, label: 'Fixtur', causeId: `chain-relation-${sequence}`, startAt: state.date, expiresAt: null }] };
};
const sickRuler = (state) => {
  const late = advance(state, addGameMonths(state.date, 11), 'to-illness');
  illness(late, 'person-0-0', 'fever');
  late.people['person-0-2'].stress = 40;
  relate(late, 'person-0-2', 'person-0-0', 5);
  return late;
};
const WORLDS = {
  heir: () => openTemplate('heir_margin', (state) => { state.people['person-0-4'].mentorId = 'person-1-1'; }),
  sick: () => openTemplate('sickroom_seal', sickRuler),
  returned: () => openTemplate('returned_seal', (state) => { illness(state, 'person-0-0'); }),
  temple: () => openTemplate('temple_steps', (state) => { state.cities.hadara.unrest = 40; }),
  familyTemple: () => openTemplate('temple_steps', (state) => { state.cities.hadara.unrest = 40; }, { mode: 'family', familyId: 'family-arel' }),
  veteran: () => openTemplate('veterans_honor', (state) => { state.offices.general.history.push({ personId: 'person-0-3', date: '-0301-01-01', reason: 'Fixtur' }); }),
  rival: () => openTemplate('rival_office_grievance', (state) => { relate(state, 'person-1-0', 'person-0-0', -40); }),
  exile: () => openTemplate('exile_contacts', (state) => {
    Object.assign(state.families['family-safra'], { exiled: true, hostFamilyId: 'family-namar', influence: 80 });
    relate(state, 'person-3-2', 'person-1-0', 5);
  }, { mode: 'family', familyId: 'family-safra' }),
};
// No command reaches these states, so a stored world stands in for one.
const edited = (edit) => (state) => { const next = structuredClone(state); edit(next); return next; };
const sickened = (personId, kind) => edited((state) => { illness(state, personId, kind); });
const dissolved = (state) => {
  const result = applyRealmDissolution(state, { id: `chain-dissolved-${++sequence}`, date: state.date, reason: 'Fixtur' });
  assert.equal(result.ok, true, result.error);
  return result.state;
};
const OFFICE_CHANGED = 'Det berörda ämbetet har bytt innehavare.';
const EPISODE_CHANGED = 'Sjukdomens regentperiod har förändrats eller avslutats.';
const NO_MANDATE = 'Den återvändande härskaren utövar inte längre sitt mandat.';
const HOST_CHANGED = 'Familjens accepterade beskyddare har förändrats.';
// Label, world, an active choice for the waiting variant, the change, the promised reason.
const LOST_BINDINGS = [
  ['A new mentor', WORLDS.heir, 'hear_question', (state) => command(state, 'educate', { childId: 'person-0-4', mentorId: 'person-2-1', focus: 'diplomacy' }), 'Utbildningsförhållandet har förändrats.'],
  ['A dismissed governor', WORLDS.temple, 'family_donation', (state) => command(state, 'dismiss', { officeId: 'governor-0' }), OFFICE_CHANGED],
  ['A replaced governor', WORLDS.temple, 'family_donation', (state) => command(state, 'appoint', { officeId: 'governor-0', personId: 'person-0-3' }), OFFICE_CHANGED],
  ['A new high priest', WORLDS.temple, 'family_donation', (state) => command(state, 'appoint', { officeId: 'priest', personId: 'person-0-3' }), 'Samfundet har bytt företrädare.'],
  ['A new general', WORLDS.veteran, 'family_rest', (state) => command(state, 'appoint', { officeId: 'general', personId: 'person-2-1' }), OFFICE_CHANGED],
  ['A banished rival family', WORLDS.rival, 'private_reception', (state) => command(state, 'banish', { familyId: 'family-namar' }), 'Den berörda familjen har gått i exil.'],
  ['A return from exile', WORLDS.exile, 'prepare_letter', (state) => command(state, 'return_exile'), HOST_CHANGED],
  ['A new protector', WORLDS.exile, 'prepare_letter', (state) => command(state, 'seek_patron', { familyId: 'family-arel' }), HOST_CHANGED],
  ['A family no longer exiled', WORLDS.exile, 'prepare_letter', edited((state) => { state.families['family-safra'].exiled = false; }), HOST_CHANGED],
  ['An exiled protector', WORLDS.exile, 'prepare_letter', edited((state) => { state.families['family-namar'].exiled = true; }), HOST_CHANGED],
  ['A new head of the protecting family', WORLDS.exile, 'prepare_letter', edited((state) => { state.families['family-namar'].headId = 'person-1-1'; }), HOST_CHANGED],
  ['A dissolved realm in a family campaign', WORLDS.familyTemple, 'family_donation', dissolved, OFFICE_CHANGED],
  ['A dissolved realm in a realm campaign', WORLDS.temple, 'family_donation', dissolved, 'Kedjan tillhör en tidigare spelarfamilj.'],
  ['A regency replaced under the same regent', WORLDS.sick, 'carry_message', edited((state) => { state.regencies['office:ruler'].episodeId = 'episode-other'; }), EPISODE_CHANGED],
  ['A regent who falls ill', WORLDS.sick, 'carry_message', sickened('person-0-1', 'smallpox'), EPISODE_CHANGED],
  ['A ruler who recovers', WORLDS.sick, 'carry_message', (state) => advance(state, addGameMonths(state.date, 2), 'to-recovery'), EPISODE_CHANGED],
  ['A ruler who relapses', WORLDS.returned, 'private_gift', sickened('person-0-0', 'smallpox'), NO_MANDATE],
  ['An abdicating ruler', WORLDS.returned, 'private_gift', (state) => command(state, 'abdicate'), NO_MANDATE],
];

const decidedSteps = (state) => chainStories(state).filter((item) => item.status === 'resolved');
function assertLostBinding(label, before, after, reason) {
  const earlier = before.eventChains.records[0], record = after.eventChains.records[0];
  assert.equal(record.status, 'closed', label);
  assert.equal(record.reason, reason, label);
  assert.equal(record.nextAt, null, label);
  assert.equal(record.nextStageId, null, label);
  for (const key of ['roles', 'roleFamilies', 'refs', 'sourceKey', 'originMemoryId', 'flags']) assert.deepEqual(record[key], earlier[key], `${label}: ${key}`);
  assert.deepEqual(decidedSteps(after), decidedSteps(before), `${label}: the old decisions remain`);
  assert.equal(memoriesOf(after, 'chain_choice').length, memoriesOf(before, 'chain_choice').length, `${label}: nobody chose`);
  const last = after.stories.find((item) => item.id === record.stepIds.at(-1));
  assert.notEqual(last.status, 'open', label);
  if (last.status === 'closed') {
    assert.equal(last.resolution, reason, label);
    assert.equal(last.choiceId, undefined, label);
    assert.equal(last.decisionActorId, undefined, label);
  }
  assert.deepEqual(reload(after), after, `${label}: the closed chain loads unchanged`);
}

for (const [label, world, choiceId, change, reason] of LOST_BINDINGS) {
  test(`${label} closes an open chain step`, () => {
    const before = world();
    assertLostBinding(label, before, months(change(before), 1), reason);
  });
  test(`${label} closes a chain that waits for its next step`, () => {
    const opened = world();
    const before = answer(opened, opened.eventChains.records[0].stepIds[0], choiceId).state;
    assert.equal(before.eventChains.records[0].status, 'waiting', label);
    assertLostBinding(label, before, months(change(before), 1), reason);
  });
}

const openStep = (state) => {
  const story = openStories(state, 'event_chain');
  assert.equal(story.length, 1, 'exactly one chain step is open');
  return story[0];
};
const outcomeOf = (state, story) => state.memories.find((memory) => memory.id === state.stories.find((item) => item.id === story.id).outcomeMemoryId);
const choicesOf = (state, story) => getCharacterPresentation(state).stories.find((item) => item.id === story.id).choices;
const fatal = (state, personId) => { const next = structuredClone(state); next.people[personId].health = 0; return next; };
// Ten months after the cast, so the anniversary falls before the three-month continuation.
function heirChainBeforeAnniversary(mentorId = 'person-1-1') {
  const opened = months(openTemplate('heir_margin', (state) => { state.people['person-0-4'].mentorId = mentorId; }), 10);
  const first = openStep(opened);
  return { opened, first, paid: answer(opened, first.id, 'extra_lessons').state };
}

test('a mentor who dies in the annual step closes the waiting chain without a choice', () => {
  const { paid } = heirChainBeforeAnniversary();
  const after = months(fatal(paid, 'person-1-1'), 3);
  assert.equal(after.people['person-1-1'].diedAt, '-0298-01-01');
  assert.equal(after.eventChains.records[0].closedAt, '-0298-01-01');
  assertLostBinding('dead mentor', paid, after, 'En av kedjans deltagare har avlidit.');
});

test('a death on the deadline closes the step for the death, not for the silence', () => {
  const opened = WORLDS.heir();
  const after = months(fatal(opened, 'person-1-1'), 12);
  assert.equal(after.people['person-1-1'].diedAt, opened.stories.find((item) => item.type === 'event_chain').dueAt);
  assertLostBinding('dead mentor on the deadline', opened, after, 'En av kedjans deltagare har avlidit.');
});

test('a child who comes of age closes the chain on the birthday', () => {
  const world = () => openTemplate('heir_margin', (state) => { state.people['person-0-4'].mentorId = 'person-1-1'; state.people['person-0-4'].bornAt = '-0317-03-01'; });
  const opened = world();
  const paid = answer(opened, openStep(opened).id, 'hear_question').state;
  assert.equal(paid.eventChains.records[0].nextAt, '-0299-04-01');
  const after = months(paid, 3);
  assert.equal(after.eventChains.records[0].closedAt, '-0299-03-01');
  assertLostBinding('adult child', paid, after, 'Utbildningsförhållandet har förändrats.');
});

test('a bound person moved to another family closes the chain', () => {
  // No command moves a chain participant: adoption takes only a child of another family. This edits the person directly.
  const opened = WORLDS.heir();
  const moved = structuredClone(opened);
  moved.people['person-1-1'].familyId = 'family-eshmun';
  assertLostBinding('moved mentor', opened, months(moved, 1), 'En bunden deltagare har lämnat sin familj.');
});

test('a new household head takes the next step and the first decision stays with the old head', () => {
  const { first, paid } = heirChainBeforeAnniversary();
  const decided = outcomeOf(paid, first), record = paid.eventChains.records[0];
  const after = months(fatal(paid, 'person-0-0'), 3);
  assert.equal(after.people['person-0-0'].diedAt, '-0298-01-01');
  assert.equal(after.families[FAMILY].headId, 'person-0-1');
  assert.equal(after.eventChains.records[0].status, 'open', 'the household head is not a bound role');
  const second = openStep(after);
  assert.equal(second.causeId, decided.id);

  const silver = after.families[FAMILY].treasury;
  const finished = answer(after, second.id, 'relieve_mentor').state;
  assert.equal(finished.families[FAMILY].treasury, silver - 8);
  assert.equal(finished.stories.find((item) => item.id === second.id).decisionActorId, 'person-0-1');
  assert.equal(finished.stories.find((item) => item.id === first.id).decisionActorId, 'person-0-0');
  assert.deepEqual(outcomeOf(finished, first), decided, 'the earlier memory keeps its decision maker');
  assert.deepEqual(outcomeOf(finished, second).participants.toSorted(), ['person-0-1', 'person-0-4', 'person-1-1']);
  assert.deepEqual(finished.eventChains.records[0].roles, record.roles);
  assert.deepEqual(reload(finished), finished);
});

test('a guardian answers for a sick household head, who takes the last step back', () => {
  const { state, record } = afterPaidChoice();
  const sick = structuredClone(state); illness(sick, 'person-0-0', 'smallpox');
  const walk = (current, choiceId) => {
    const story = current.stories.find((item) => item.id === current.eventChains.records[0].stepIds.at(-1));
    const decided = answer(current, story.id, choiceId).state;
    return { state: decided, actor: decided.stories.find((item) => item.id === story.id).decisionActorId };
  };
  const second = walk(advance(sick, record.nextAt, 'guardian-second'), 'support_child');
  assert.equal(second.actor, 'person-0-1');
  assert.equal(second.state.people['person-0-0'].healthConditions.at(-1).stage, 'recovering');
  const third = walk(advance(second.state, second.state.eventChains.records[0].nextAt, 'guardian-third'), 'recognize_effort');
  assert.equal(third.actor, 'person-0-1');
  const last = walk(advance(third.state, third.state.eventChains.records[0].nextAt, 'guardian-last'), 'thank_child');
  assert.equal(last.actor, 'person-0-0', 'the recovered head decides again');
  assert.equal(last.state.eventChains.records[0].status, 'resolved');
  assert.deepEqual(chainStories(last.state).filter((item) => item.chainId === record.id).map((item) => item.decisionActorId), ['person-0-0', 'person-0-1', 'person-0-1', 'person-0-0']);
  assert.deepEqual(reload(last.state), last.state);
});

test('a head who is also the mentor appears once in memory and cannot thank himself', () => {
  const { paid } = heirChainBeforeAnniversary('person-0-1');
  let state = months(fatal(paid, 'person-0-0'), 3);
  assert.equal(state.families[FAMILY].headId, 'person-0-1');
  for (const choiceId of ['support_child', 'recognize_effort']) {
    const story = openStep(state);
    state = answer(state, story.id, choiceId).state;
    assert.deepEqual(outcomeOf(state, story).participants.toSorted(), ['person-0-1', 'person-0-4']);
    state = advance(state, state.eventChains.records[0].nextAt, `self-${choiceId}`);
  }
  const last = openStep(state);
  const byId = Object.fromEntries(choicesOf(state, last).map((choice) => [choice.id, choice]));
  assert.equal(byId.thank_mentor.disabledReason, 'Detta val kräver en annan person som mottagare.');
  assert.equal(byId.thank_child.disabledReason, '');
  assert.deepEqual(reload(state), state);
});

test('a regent pays a public chain choice and enters history as its decision maker', () => {
  const opened = WORLDS.temple();
  const sick = structuredClone(opened); illness(sick, 'person-0-0', 'smallpox');
  const ruling = months(sick, 1);
  assert.equal(ruling.offices.ruler.regentId, 'person-0-1');
  assert.equal(ruling.offices.ruler.holderId, 'person-0-0');
  const story = openStep(ruling), treasury = ruling.realm.treasury, silver = ruling.families[FAMILY].treasury;
  assert.equal(choicesOf(ruling, story).find((choice) => choice.id === 'city_improvement').actorId, 'person-0-1');
  const paid = answer(ruling, story.id, 'city_improvement').state;
  assert.equal(paid.realm.treasury, treasury - 25);
  assert.equal(paid.families[FAMILY].treasury, silver);
  assert.equal(paid.stories.find((item) => item.id === story.id).decisionActorId, 'person-0-1');
  assert.deepEqual(reload(paid), paid);
});

test('after an abdication the new ruler pays public choices and the old head pays family choices', () => {
  const abdicated = command(WORLDS.veteran(), 'abdicate');
  assert.equal(abdicated.offices.ruler.holderId, 'person-0-2');
  assert.equal(abdicated.families[FAMILY].headId, 'person-0-0');
  const story = openStep(abdicated), treasury = abdicated.realm.treasury;
  assert.deepEqual(Object.fromEntries(choicesOf(abdicated, story).map((choice) => [choice.id, choice.actorId])),
    { public_provision: 'person-0-2', family_rest: 'person-0-0', close: null });
  const paid = answer(abdicated, story.id, 'public_provision').state;
  assert.equal(paid.realm.treasury, Math.round((treasury - 10) * 100) / 100);
  assert.equal(outcomeOf(paid, story).decisionActorId, 'person-0-2');
});

// The merit law crowns the best administrator, so an abdication can leave the family.
const meritTemple = (mode) => openTemplate('temple_steps', (state) => {
  state.cities.hadara.unrest = 40;
  state.realm.successionLaw = 'merit';
  state.people['person-1-2'].skills.diplomacy = 20;
  state.people['person-1-2'].skills.stewardship = 20;
}, { mode });

test('a family campaign that loses the crown keeps the chain and only its public choices fall', () => {
  const opened = meritTemple('family');
  const crownless = command(opened, 'abdicate');
  assert.equal(crownless.offices.ruler.holderId, 'person-1-2');
  const story = openStep(crownless);
  const after = months(crownless, 1);
  assert.equal(after.eventChains.records[0].status, 'open');
  const byId = Object.fromEntries(choicesOf(after, story).map((choice) => [choice.id, choice]));
  assert.equal(byId.city_improvement.disabledReason, 'Kräver härskarmandat.');
  assert.equal(byId.family_donation.disabledReason, '');
  const refused = resolve(after, story.id, 'city_improvement');
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'Kräver härskarmandat.');
  assert.strictEqual(refused.state, after);
  const treasury = after.realm.treasury;
  const paid = answer(after, story.id, 'family_donation').state;
  assert.equal(paid.realm.treasury, treasury);
  assert.equal(paid.stories.find((item) => item.id === story.id).decisionActorId, 'person-0-0');
});

test('a realm campaign closes the old ruling family\'s chain when the crown leaves it', () => {
  const opened = meritTemple('realm');
  const crownless = command(opened, 'abdicate');
  assert.equal(crownless.people[crownless.offices.ruler.holderId].familyId, 'family-namar');
  assertLostBinding('crown left', opened, months(crownless, 1), 'Kedjan tillhör en tidigare spelarfamilj.');
});

test('a command that breaks a binding closes the chain on its own date', () => {
  const opened = WORLDS.heir(), story = openStep(opened);
  const changed = command(opened, 'educate', { childId: 'person-0-4', mentorId: 'person-2-1', focus: 'diplomacy' });
  assert.equal(changed.date, opened.date);
  assert.equal(changed.eventChains.records[0].closedAt, opened.date);
  assertLostBinding('same date', opened, changed, 'Utbildningsförhållandet har förändrats.');
  const refused = resolve(changed, story.id, 'close');
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'Berättelsen är inte tillgänglig.');
});

test('a save that lost a binding offers only the free close until the next advance', () => {
  // Every engine path closes the chain at once, so only a stored state can reach this window.
  const opened = WORLDS.heir(), story = openStep(opened);
  const edited = structuredClone(opened);
  edited.people['person-0-4'].mentorId = 'person-2-1';
  const stale = reload(edited), snapshot = structuredClone(stale);
  const reason = 'Utbildningsförhållandet har förändrats.';
  assert.deepEqual(choicesOf(stale, story).map((choice) => [choice.id, choice.disabledReason]), [['extra_lessons', reason], ['hear_question', reason], ['close', '']]);
  assert.deepEqual(stale, snapshot, 'a read changes nothing');
  const refused = resolve(stale, story.id, 'hear_question');
  assert.equal(refused.ok, false);
  assert.equal(refused.error, reason);
  assert.strictEqual(refused.state, stale);
  const closed = answer(stale, story.id, 'close').state;
  assert.equal(closed.eventChains.records[0].status, 'closed');
  assert.equal(closed.eventChains.records[0].reason, 'Spelaren avslutade kedjan.');
  assert.equal(closed.families[FAMILY].treasury, stale.families[FAMILY].treasury);
  assert.deepEqual(reload(closed), closed);
});

test('with nobody able to act every paid choice is refused and the free close still works', () => {
  const opened = WORLDS.heir(), story = openStep(opened);
  const sick = structuredClone(opened);
  for (const person of Object.values(sick.people)) if (!person.diedAt) illness(sick, person.id);
  const blocked = reload(sick);
  const reason = 'En handlingsförmögen företrädare saknas.';
  assert.deepEqual(choicesOf(blocked, story).map((choice) => [choice.id, choice.disabledReason, choice.actorId]),
    [['extra_lessons', reason, null], ['hear_question', reason, null], ['close', '', null]]);
  const refused = resolve(blocked, story.id, 'hear_question');
  assert.equal(refused.ok, false);
  assert.equal(refused.error, reason);
  const closed = answer(blocked, story.id, 'close').state;
  assert.equal(closed.stories.find((item) => item.id === story.id).decisionActorId, null);
  assert.equal(closed.families[FAMILY].treasury, blocked.families[FAMILY].treasury);
  assert.deepEqual(reload(closed), closed);
});

// ---- JSON saves between advances ----
// `reload` is what a campaign gets back from a save file. Whole-state equality
// covers every random stream, the revision and the applied command ids.
function walkChain(start, save) {
  let state = save(start);
  const saves = [state];
  const keep = (next) => { state = save(next); saves.push(state); };
  for (const [index, choiceId] of ['support_child', 'recognize_effort', 'thank_child'].entries()) {
    const nextAt = state.eventChains.records[0].nextAt;
    keep(advance(state, addGameMonths(nextAt, -1), `walk-${index}-before`));
    keep(advance(state, nextAt, `walk-${index}-step`));
    const result = executeCharacterCommand(state, { id: `walk-${index}-answer`, type: 'resolve_story', expectedRevision: state.revision,
      payload: { storyId: state.eventChains.records[0].stepIds.at(-1), choiceId } });
    assert.equal(result.ok, true, result.error);
    keep(result.state);
  }
  return saves;
}

test('a chain saved to JSON between two advances continues as if it never left memory', () => {
  for (const calendar of CALENDARS) {
    const { label } = calendar;
    const { state, record } = continuation(calendar);
    const target = addGameMonths(state.date, 12);
    const unsaved = advance(state, record.nextAt, 'first');
    const saved = reload(unsaved);
    assert.deepEqual(saved, unsaved, `${label}: loading changes nothing`);
    assert.equal(openStories(saved, 'event_chain').length, 1, `${label}: the saved chain has an open step`);
    assert.deepEqual(advance(saved, target, 'second'), advance(unsaved, target, 'second'), label);
  }
});

test('a waiting chain saved to JSON opens its step on the saved date', () => {
  for (const calendar of CALENDARS) {
    const { label } = calendar;
    const { state, record } = continuation(calendar);
    const saved = reload(advance(state, addGameMonths(record.nextAt, -1), 'first'));
    assert.equal(saved.eventChains.records[0].status, 'waiting', label);
    assert.equal(saved.eventChains.records[0].nextAt, record.nextAt, label);
    assert.equal(getNextCharacterTransitionDate(saved, addGameMonths(record.nextAt, 6)), record.nextAt, label);
    const resumed = advance(saved, addGameMonths(record.nextAt, 6), 'second');
    const step = resumed.stories.find((item) => item.id === `${record.id}-step-2`);
    assert.equal(step.createdAt, record.nextAt, label);
    assert.equal(step.status, 'open', label);
  }
});

test('a chain saved to JSON after every call walks all four stages unchanged', () => {
  for (const calendar of CALENDARS) {
    const { label } = calendar;
    const { state, record } = continuation(calendar);
    const unsaved = walkChain(state, (next) => next);
    const saved = walkChain(state, reload);
    assert.equal(saved.length, unsaved.length, label);
    for (const [index, snapshot] of saved.entries()) assert.deepEqual(snapshot, unsaved[index], `${label}: save ${index}`);
    const finished = saved.at(-1).eventChains.records[0];
    assert.equal(finished.id, record.id, label);
    assert.equal(finished.status, 'resolved', label);
    assert.equal(finished.stepIds.length, 4, label);
    assert.deepEqual(finished.flags, { opening: 'lessons', support: 'child_time', work: 'presented', ending: 'child' }, label);
    assert.equal(saved.at(-1).eventChains.rngState, state.eventChains.rngState, `${label}: continuations draw nothing`);
  }
});

test('a repeated advance after a JSON load adds nothing', () => {
  const { state, record } = afterPaidChoice();
  const first = advanceCharacters(state, record.nextAt, { id: 'repeat' });
  assert.equal(first.ok, true, first.error);
  const loaded = reload(first.state);
  for (const date of [record.nextAt, addGameMonths(record.nextAt, 3)]) {
    const repeated = advanceCharacters(loaded, date, { id: 'repeat' });
    assert.equal(repeated.duplicate, true);
    assert.deepEqual(repeated.events, []);
    assert.strictEqual(repeated.state, loaded);
  }
  assert.equal(chainStories(loaded).length, 2);
});

test('a decided step stays decided after a JSON load', () => {
  const { state, story } = afterPaidChoice();
  const loaded = reload(state), silver = loaded.families[FAMILY].treasury;
  const again = resolve(loaded, story.id, 'hear_question');
  assert.equal(again.ok, false);
  assert.equal(again.error, 'Berättelsen är inte tillgänglig.');
  assert.strictEqual(again.state, loaded);
  assert.equal(again.state.families[FAMILY].treasury, silver);
});

const POLITY = { hadara: { name: 'Hadara', status: 'active' } };
const load = (world) => normalizeWorldState(JSON.parse(JSON.stringify(world)));
const replay = (world, events) => events.reduce((next, event) => applyCharacterOpsToWorld(next, event.impacts.characterOps ?? [], { source: 'character-system' }), world);

test('stored events replayed onto a world loaded from JSON rebuild the chain', () => {
  const { state, record } = afterPaidChoice();
  const start = load({ characterSystem: state, polityOverrides: POLITY });
  const target = addGameMonths(record.nextAt, 6);
  const first = planCharacterAdvance(start, record.nextAt, { id: 'first' });
  const second = planCharacterAdvance(load({ ...start, characterSystem: first.state }), target, { id: 'second' });
  assert.equal(second.state.date, target);
  assert.equal(second.state.eventChains.records[0].stepIds.length, 2);
  const stored = JSON.parse(JSON.stringify([...first.events, ...second.events]));
  const rebuilt = replay(start, stored);
  assert.deepEqual(rebuilt.characterSystem, second.state);
  assert.deepEqual(replay(rebuilt, stored).characterSystem, second.state);
});

// ---- More than 1,000 newer memories ----
// docs/design/event-chains.md: the active chain never depends on the rolling
// recent-memory window. storyDirector.js reads the last 1,000 memories, so 1,001
// newer ones push everything a chain refers to out of that window.
function withNewerMemories(state, count = 1001) {
  const next = structuredClone(state);
  for (let index = 0; index < count; index++) {
    next.memories.push({ id: `newer-${++sequence}`, date: state.date, type: 'note', title: 'Senare anteckning', participants: [], causeId: null, knownBy: 'public', familyIds: [] });
  }
  return next;
}
const withoutNewer = (state) => ({ ...state, memories: state.memories.filter((memory) => memory.type !== 'note') });
const inRecentWindow = (state, id) => state.memories.slice(-1000).some((memory) => memory.id === id);
const BENEFICIARY = 'person-0-2';
// A real patronage memory: a household tension relieved through the command path.
function patronage(state) {
  state.people[BENEFICIARY].stress = 65;
  const context = { actor: state.people['person-0-0'], family: state.families[FAMILY], canRule: true, age: (person) => getCharacterAge(person, state.date), stress: () => 0 };
  const { weight: _weight, ...details } = getDirectedStoryCandidates(state, context).find((story) => story.eventType === 'household_tension');
  const story = { ...details, id: `character-story-${++state.storyDirector.sequence}`, type: 'character_event', status: 'open', createdAt: state.date, dueAt: addGameMonths(state.date, 12), knownBy: 'public' };
  state.stories.push(story);
  return command(state, 'resolve_story', { storyId: story.id, choiceId: 'relieve' });
}
// The head who gave the patronage dies at the anniversary that casts the letter.
const letterChain = () => openTemplate('family_letter', (state) => withNewerMemories(fatal(patronage(state), 'person-0-0')));

test('a continuation behind 1,001 newer memories matches a world without them', () => {
  for (const calendar of CALENDARS) {
    const { label } = calendar;
    const { state, record } = continuation(calendar);
    const outcomeId = state.stories.find((item) => item.id === record.stepIds[0]).outcomeMemoryId;
    const newer = advance(withNewerMemories(state), record.nextAt, 'continue');
    assert.deepEqual(withoutNewer(newer), advance(state, record.nextAt, 'continue'), label);
    assert.equal(newer.stories.find((item) => item.id === `${record.id}-step-2`).causeId, outcomeId, label);
    assert.equal(inRecentWindow(newer, outcomeId), false, `${label}: the cause lies outside the window`);
    assert.equal(inRecentWindow(newer, record.originMemoryId), false, `${label}: the origin lies outside the window`);
  }
});

test('all four stages match a world without 1,001 newer memories before every save', () => {
  for (const calendar of CALENDARS) {
    const { label } = calendar;
    const { state } = continuation(calendar);
    const plain = walkChain(state, (next) => next);
    const newer = walkChain(state, (next) => reload(withNewerMemories(next)));
    assert.equal(newer.length, plain.length, label);
    for (const [index, snapshot] of newer.entries()) assert.deepEqual(withoutNewer(snapshot), plain[index], `${label}: save ${index}`);
    const last = newer.at(-1), [, ...steps] = last.eventChains.records[0].stepIds.map((id) => last.stories.find((item) => item.id === id));
    assert.equal(steps.length, 3, label);
    for (const story of steps) {
      assert.equal(last.memories.find((memory) => memory.id === story.causeId).type, 'chain_choice', label);
      assert.equal(inRecentWindow(last, story.causeId), false, label);
    }
  }
});

test('a stored patch keeps every chain memory behind 1,001 newer ones', () => {
  const { state, record } = afterPaidChoice();
  const world = load({ characterSystem: withNewerMemories(state), polityOverrides: POLITY });
  const plan = planCharacterAdvance(world, record.nextAt, { id: 'newer-patch' });
  assert.equal(plan.state.eventChains.records[0].stepIds.length, 2);
  assert.deepEqual(replay(world, JSON.parse(JSON.stringify(plan.events))).characterSystem, plan.state);
});

test('a family letter starts from a patronage memory behind 1,001 newer ones', () => {
  const state = letterChain(), record = state.eventChains.records[0], source = state.memories.find((memory) => memory.id === record.sourceMemoryId);
  assert.equal(source.type, 'story_patronage');
  assert.equal(inRecentWindow(state, source.id), false);
  assert.deepEqual(record.roles, { deceased: 'person-0-0', participant: BENEFICIARY });
  assert.equal(state.memories.find((memory) => memory.id === record.originMemoryId).causeId, source.id);
  const presented = getCharacterPresentation(state).stories.find((item) => item.id === record.stepIds[0]);
  assert.equal(presented.causeTitle, source.title);
  assert.deepEqual(reload(state), state);
});

test('a family letter behind newer memories does not start again from its spent source', () => {
  const opened = letterChain(), record = opened.eventChains.records[0];
  const closed = structuredClone(answer(opened, record.stepIds[0], 'close').state);
  assert.equal(closed.eventChains.records[0].status, 'closed');
  // With the cooldown gone, only the spent source stands in the way of a new letter.
  delete closed.eventChains.cooldowns.family_letter;
  const later = months(withNewerMemories(closed), 12);
  assert.deepEqual(later.eventChains.records.map((item) => item.id), [record.id]);
});

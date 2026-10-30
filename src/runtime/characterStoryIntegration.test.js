import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCharacters, createCharacterSystem, getCharacterPresentation } from './characters/index.js';
import { addGameMonths, compareGameDates } from './gameDates.js';
import { normalizeWorldState, applyEventImpactsToWorld } from './gameState.js';
import { assertCharacterTurnHorizon, buildCharacterPromptContext, planCharacterAdvance,
  planCharacterTurnHorizon, prepareCharacterTimeline } from './characterWorld.js';

function rollingWorld({ healthRngState } = {}) {
  const initial = createCharacterSystem({ mode: 'family', polityId: 'Hadara', date: '-0300-01-01', seed: 477 });
  if (healthRngState) initial.healthRngState = healthRngState;
  const state = advanceCharacters(initial, '-0300-07-01', { id: 'fixture-midsummer' }).state;
  return normalizeWorldState({ characterSystem: state, polityOverrides: { Hadara: { name: 'Hadara', status: 'active' } } });
}

test('new recurring decision stops a long turn before its deadline with matching pre-model forecast and replay', () => {
  const world = rollingWorld();
  const original = structuredClone(world);
  const requested = addGameMonths(world.characterSystem.date, 36);
  const horizon = planCharacterTurnHorizon(world, requested);
  assert.equal(horizon.targetDate, '-0299-01-01');
  assert.equal(horizon.interruption.type, 'character-story');
  assert.equal(horizon.interruption.requestedDate, requested);
  const forecast = JSON.parse(buildCharacterPromptContext(world.characterSystem, { targetDate: requested }).split('\n').at(-1));
  assert.equal(forecast.targetDate, horizon.targetDate);
  assert.deepEqual(forecast.interruption, horizon.interruption);
  assert.ok(forecast.developments.every((event) => compareGameDates(event.date, horizon.targetDate) <= 0));
  let final; let metadata;
  const events = prepareCharacterTimeline(world, [
    { id: 'before-decision', date: '-0300-12-15', title: 'Vinterhandel', source: 'ai', impacts: {} },
    { id: 'beyond-stop', date: '-0299-04-01', title: 'Senare förhandlingar', source: 'ai', impacts: {} },
  ], requested, { pauseForHealthDecisions: true, pauseForCharacterDecisions: true,
    applyHostEvent: (current, event) => applyEventImpactsToWorld({ world: current, events: [event] }),
    onComplete: (state, details) => { final = state; metadata = details; } });
  assert.equal(final.date, horizon.targetDate);
  assert.deepEqual(metadata.interruption, horizon.interruption);
  assert.ok(!events.some((event) => event.id === 'beyond-stop'));
  assert.ok(events.every((event) => compareGameDates(event.date, final.date) <= 0));
  for (const id of horizon.interruption.storyIds) {
    const story = final.stories.find((s) => s.id === id);
    assert.equal(story.status, 'open');
    assert.ok(compareGameDates(story.dueAt, final.date) > 0);
    assert.ok(getCharacterPresentation(final).stories.find((s) => s.id === id).choices.some((c) => !c.disabledReason));
  }
  assert.deepEqual(final.storyDirector, planCharacterAdvance(world, horizon.targetDate).state.storyDirector);
  const replay = applyEventImpactsToWorld({ world, events }).world;
  assert.deepEqual(replay.characterSystem, final);
  assert.deepEqual(applyEventImpactsToWorld({ world: replay, events }).world.characterSystem, final);
  assert.deepEqual(normalizeWorldState(JSON.parse(JSON.stringify(replay))).characterSystem, final);
  assert.deepEqual(world, original, 'forecast and planning preserve live state');
  assert.throws(() => assertCharacterTurnHorizon(final, requested, metadata.interruption), /inte sparats/);
  assert.throws(() => assertCharacterTurnHorizon(final, requested, metadata.interruption), /flyttade beslutet/);
  assert.doesNotThrow(() => assertCharacterTurnHorizon(final, horizon.targetDate, metadata.interruption));
  const next = planCharacterTurnHorizon({ characterSystem: final }, addGameMonths(final.date, 1));
  assert.equal(next.interruption, null, 'an existing unanswered story does not trap time');
});

test('health decision has interruption priority when both decision types open at the same boundary', () => {
  const world = rollingWorld({ healthRngState: 1 });
  const horizon = planCharacterTurnHorizon(world, addGameMonths(world.characterSystem.date, 18));
  assert.equal(horizon.interruption.type, 'health-care');
  const atStop = planCharacterAdvance(world, horizon.targetDate).state;
  assert.ok(atStop.stories.some((s) => s.type === 'character_event' && s.status === 'open'));
  assert.ok(atStop.stories.some((s) => s.type === 'health_care' && s.status === 'open'));
});

test('model proposals cannot execute a real recurring player choice or spend a wallet', () => {
  const initial = rollingWorld();
  const state = planCharacterAdvance(initial, '-0299-01-01').state;
  const world = normalizeWorldState({ ...initial, characterSystem: state });
  const story = getCharacterPresentation(state).stories.find((s) => s.type === 'character_event');
  const choice = story.choices.find((c) => !c.disabledReason && c.id !== 'ignore');
  assert.ok(choice);
  const command = { id: 'invented-player-authorization', kind: 'command', type: 'resolve_story',
    payloadJson: JSON.stringify({ storyId: story.id, choiceId: choice.id }) };
  const events = prepareCharacterTimeline(world, [{ id: 'model-spending', date: state.date, title: 'Ett förslag',
    source: 'ai', impacts: { actionIds: [command.id], characterOps: [command] } }], state.date);
  const final = applyEventImpactsToWorld({ world, events }).world.characterSystem;
  assert.equal(final.stories.find((s) => s.id === story.id).status, 'open');
  assert.equal(final.realm.treasury, state.realm.treasury);
  assert.equal(final.families[state.identity.familyId].treasury, state.families[state.identity.familyId].treasury);
  assert.ok(!final.appliedCommandIds.includes(command.id));
  const prompt = buildCharacterPromptContext(state);
  assert.equal(prompt.includes('"storyDirector"'), false);
  assert.equal(prompt.includes('"rngState"'), false);
  assert.match(prompt, /advisory proposals only/);
});

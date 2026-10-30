import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterSystem, getCharacterPresentation } from "./characters/index.js";
import { addGameDays } from "./gameDates.js";
import { applyEventImpactsToWorld, normalizeWorldState } from "./gameState.js";
import { assertCharacterModelGeneration, executeCharacterWorldCommand, getCharacterEventBudget,
  planCharacterAdvance, prepareCharacterTimeline } from "./characterWorld.js";

const date = "-0300-01-01";
const start = (mode = "realm") => normalizeWorldState({
  characterSystem: createCharacterSystem({ date, polityId: "Hadara", mode, seed: 41 }),
  polityOverrides: { Hadara: { name: "Hadara", status: "active" } },
});

test("32 model dates do not create 32 administration cards; replay preserves the entire year", () => {
  const world = start();
  const modelEvents = Array.from({ length: 32 }, (_, index) => ({ id: `world-${index}`,
    source: "ai", date: addGameDays(date, (index + 1) * 10), title: `Världshändelse ${index + 1}`, impacts: {} }));
  let final;
  const planned = prepareCharacterTimeline(world, modelEvents, "-0299-01-01", {
    applyHostEvent: (current, event) => applyEventImpactsToWorld({ world: current, events: [event] }),
    onComplete: (state) => { final = state; },
  });
  assert.equal(planned.filter((event) => event.source === "ai").length, 32);
  assert.ok(planned.filter((event) => event.title === "Rikets förvaltning").length <= 1);
  const replay = applyEventImpactsToWorld({ world, events: planned }).world;
  assert.deepEqual(replay.characterSystem, final);
  assert.deepEqual(applyEventImpactsToWorld({ world: replay, events: planned }).world.characterSystem, final);
  const annual = planCharacterAdvance(world, "-0299-01-01").state;
  assert.equal(final.date, annual.date);
  assert.equal(final.rngState, annual.rngState);
  assert.deepEqual(final.realm, annual.realm);
  assert.deepEqual(final.people, annual.people);
  assert.deepEqual(final.families, annual.families);
  const firstVisible = applyEventImpactsToWorld({ world, events: planned.slice(0, 1) }).world;
  assert.equal(firstVisible.characterSystem.date, modelEvents[0].date);
  assert.equal(firstVisible.characterSystem.realm.treasury, world.characterSystem.realm.treasury,
    "revealing an early model event must not expose the year's income");
});

test("the model cannot execute a valid player story decision by inventing an action ID", () => {
  for (const mode of ["realm", "family"]) {
    const world = start(mode);
    const story = getCharacterPresentation(world.characterSystem).stories.find((entry) => entry.choices?.length);
    assert.ok(story);
    const command = { id: "invented-player-authorization", type: "resolve_story",
      expectedRevision: world.characterSystem.revision,
      payload: { storyId: story.id, choiceId: story.choices[0].id } };
    const explicitPlayerDecision = executeCharacterWorldCommand(world, command);
    assert.equal(explicitPlayerDecision.ok, true, explicitPlayerDecision.error);
    assert.notDeepEqual(explicitPlayerDecision.state, world.characterSystem);
    const planned = prepareCharacterTimeline(world, [{ id: "model-spends-for-player", date, title: "Ett förslag",
      impacts: { actionIds: [command.id], characterOps: [{ ...command, kind: "command" }] } }], date);
    const after = applyEventImpactsToWorld({ world, events: planned }).world;
    assert.deepEqual(after.characterSystem, world.characterSystem);
    assert.ok(planned.some((event) => event.title === "Förslaget kräver ditt beslut"));
  }
});

test("character model failure or missing provenance cannot authorize a simulated year", () => {
  const world = start();
  const before = JSON.stringify(world);
  for (const generation of [undefined, { source: "fallback", fallbackReason: "Claude timed out after 300 seconds" },
    { source: "ai", fallbackReason: "Response failed validation" }, { source: "batch" }]) {
    assert.throws(() => assertCharacterModelGeneration(world, generation), /avbröts utan att flytta tiden/);
    assert.equal(JSON.stringify(world), before);
  }
  assert.throws(() => assertCharacterModelGeneration(world,
    { source: "fallback", fallbackReason: "Claude timed out after 300 seconds" }), /300 seconds/);
  assert.doesNotThrow(() => assertCharacterModelGeneration(world, { source: "ai", fallbackReason: "" }));
  assert.doesNotThrow(() => assertCharacterModelGeneration({}, { source: "fallback" }));
});

test("character jump budgets fit one year and remain bounded for a long jump", () => {
  assert.equal(getCharacterEventBudget(date, "-0299-01-01"), 8);
  assert.equal(getCharacterEventBudget(date, "-0290-01-01"), 24);
  assert.equal(getCharacterEventBudget("2024-01-01", "2025-01-01"), 8);
});

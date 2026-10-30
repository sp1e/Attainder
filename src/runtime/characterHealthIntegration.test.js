import test from "node:test";
import assert from "node:assert/strict";
import { advanceCharacters, createCharacterSystem, getCharacterPresentation } from "./characters/index.js";
import { addGameMonths, compareGameDates } from "./gameDates.js";
import { normalizeWorldState, applyEventImpactsToWorld } from "./gameState.js";
import { assertCharacterModelGeneration, assertCharacterTurnHorizon, buildCharacterPromptContext,
  planCharacterAdvance, planCharacterTurnHorizon, prepareCharacterTimeline } from "./characterWorld.js";
import { commitCharacterTransaction } from "./characterPersistence.js";
import { setRuntimeAssetEndpoints } from "./assets.js";
import { readVisibleCharacterState, submitCharacterCommand, advanceCharacterYear } from "./characterRuntime.js";

const DATE = "-0300-01-01";
const PERSON = "person-0-2";
const CONDITION = "condition-fixture-smallpox";
const appearance = (state) => getCharacterPresentation(state).people.find((person) => person.id === PERSON).portraitState;
function sickWorld() {
  const state = createCharacterSystem({ mode: "family", polityId: "Hadara", date: DATE, seed: 321 });
  state.healthSequence = Math.max(state.healthSequence, 1);
  state.people[PERSON].health = 65;
  state.people[PERSON].healthConditions.push({ id: CONDITION, kind: "smallpox", stage: "active", severity: 2,
    startedAt: DATE, nextTransitionAt: addGameMonths(DATE, 1), stageHistory: [{ stage: "active", date: DATE }],
    treatment: null, causeId: state.log[0].id, sourceKind: "fixture", relatedPersonId: null,
    scarRoll: 0.01, outcomeRoll: 0.99, endedAt: null });
  return normalizeWorldState({ characterSystem: state, polityOverrides: { Hadara: { name: "Hadara", status: "active" } } });
}

function rollingYearWorld() {
  const initial = createCharacterSystem({ mode: "family", polityId: "Hadara", date: DATE, seed: 321 });
  initial.healthRngState = 1;
  return normalizeWorldState({ characterSystem: advanceCharacters(initial, addGameMonths(DATE, 6), { id: "fixture-midsummer" }).state,
    polityOverrides: { Hadara: { name: "Hadara", status: "active" } } });
}

test("health fields and portrait identity survive normalization; presentation does not disclose future rolls", () => {
  const world = sickWorld();
  const restored = normalizeWorldState(JSON.parse(JSON.stringify(world)));
  assert.deepEqual(restored.characterSystem, world.characterSystem);
  assert.deepEqual(appearance(restored.characterSystem), appearance(world.characterSystem));
  assert.equal(appearance(restored.characterSystem).visualState, "smallpox");
  const visible = getCharacterPresentation(restored.characterSystem).people.find((person) => person.id === PERSON);
  assert.equal(visible.healthConditions[0].scarRoll, undefined);
  assert.equal(visible.healthConditions[0].outcomeRoll, undefined);
  assert.equal(visible.healthConditions[0].nextTransitionAt, undefined);
  const prompt = buildCharacterPromptContext(restored.characterSystem);
  assert.equal(prompt.includes('"scarRoll"'), false);
  assert.equal(prompt.includes('"outcomeRoll"'), false);
  assert.match(prompt, /do not invent an infection/);
});

test("health phase checkpoints reveal illness, recovery and scars on their real dates without future leakage", () => {
  const world = sickWorld();
  const recoveryDate = addGameMonths(DATE, 1);
  const scarDate = addGameMonths(DATE, 7);
  const target = addGameMonths(DATE, 8);
  let final;
  const events = prepareCharacterTimeline(world, [{ id: "before-recovery", source: "ai", date: "-0300-01-15", title: "Vinterrådet", impacts: {} },
    { id: "during-recovery", source: "ai", date: "-0300-04-15", title: "Våren i Hadara", impacts: {} }], target,
  { applyHostEvent: (current, event) => applyEventImpactsToWorld({ world: current, events: [event] }), onComplete: (state) => { final = state; } });
  let seen = world;
  const observed = [];
  for (const event of events) {
    seen = applyEventImpactsToWorld({ world: seen, events: [event] }).world;
    const view = appearance(seen.characterSystem);
    observed.push({ eventDate: event.date, stateDate: seen.characterSystem.date, visualState: view.visualState });
    if (event.id === "before-recovery") assert.equal(view.visualState, "smallpox");
    if (event.id === "during-recovery") assert.equal(view.visualState, "smallpox-recovering");
    if (event.impacts.characterOps?.length) assert.equal(seen.characterSystem.date, event.date, "a phase card cannot carry a future checkpoint");
  }
  assert.ok(observed.some((entry) => entry.stateDate === recoveryDate && entry.visualState === "smallpox-recovering"));
  assert.ok(observed.some((entry) => entry.stateDate === scarDate && entry.visualState === "smallpox-scars"));
  assert.equal(appearance(final).visualState, "smallpox-scars");
  assert.deepEqual(seen.characterSystem, final);
  assert.deepEqual(applyEventImpactsToWorld({ world: seen, events }).world.characterSystem, final);
  assert.deepEqual(normalizeWorldState(JSON.parse(JSON.stringify(seen))).characterSystem, final);
  const forecast = buildCharacterPromptContext(world.characterSystem, { targetDate: target });
  assert.ok(forecast.includes(recoveryDate));
  assert.ok(forecast.includes(scarDate));
  assert.equal(appearance(world.characterSystem).visualState, "smallpox", "forecasting must not mutate live illness");
});

test("a rolling model year stops at a newly opened care decision, with matching forecast and no later outcomes", () => {
  const world = rollingYearWorld();
  const requested = addGameMonths(world.characterSystem.date, 12);
  const expectedStop = addGameMonths(DATE, 12);
  const horizon = planCharacterTurnHorizon(world, requested);
  assert.equal(horizon.targetDate, expectedStop);
  assert.equal(horizon.interruption.type, "health-care");
  assert.equal(horizon.interruption.requestedDate, requested);
  let final;
  let metadata;
  const events = prepareCharacterTimeline(world, [
    { id: "before-illness", date: "-0300-12-15", title: "Vinterhandel", source: "ai", impacts: {} },
    { id: "never-happened", date: "-0299-05-01", title: "Senare fälttåg", source: "ai", impacts: {} },
  ], requested, { pauseForHealthDecisions: true,
    applyHostEvent: (current, event) => applyEventImpactsToWorld({ world: current, events: [event] }),
    onComplete: (state, details) => { final = state; metadata = details; } });
  assert.equal(final.date, expectedStop);
  assert.equal(metadata.interruption.date, horizon.targetDate);
  assert.equal(events.some((event) => event.id === "never-happened"), false);
  assert.ok(events.every((event) => compareGameDates(event.date, expectedStop) <= 0));
  assert.equal(final.stories.find((story) => story.id === metadata.interruption.storyIds[0]).status, "open");
  assert.equal(getCharacterPresentation(final).people.find((person) => person.id === "person-0-0").portraitState.visualState, "smallpox");
  const nextHorizon = planCharacterTurnHorizon({ characterSystem: final }, addGameMonths(expectedStop, 1));
  assert.equal(nextHorizon.targetDate, addGameMonths(expectedStop, 1));
  assert.equal(nextHorizon.interruption, null, "an existing unanswered decision must not repeatedly stop time at the same date");
  const uncut = planCharacterAdvance(world, requested);
  assert.notEqual(uncut.state.people["person-0-0"].healthConditions[0].stage, "active");
  const atStop = planCharacterAdvance(world, expectedStop).state;
  assert.equal(final.realm.treasury, atStop.realm.treasury);
  assert.equal(final.healthRngState, atStop.healthRngState);
  const forecast = JSON.parse(buildCharacterPromptContext(world.characterSystem, { targetDate: requested }).split("\n").at(-1));
  assert.equal(forecast.targetDate, expectedStop);
  assert.deepEqual(forecast.interruption.storyIds, metadata.interruption.storyIds);
  assert.ok(forecast.developments.every((event) => compareGameDates(event.date, expectedStop) <= 0));
  const replay = applyEventImpactsToWorld({ world, events }).world;
  assert.deepEqual(replay.characterSystem, final);
  assert.deepEqual(applyEventImpactsToWorld({ world: replay, events }).world.characterSystem, final);
  assert.deepEqual(normalizeWorldState(JSON.parse(JSON.stringify(replay))).characterSystem, final);
  assert.equal(world.characterSystem.people["person-0-0"].healthConditions.length, 0);
  assert.throws(() => assertCharacterTurnHorizon(final, requested, metadata.interruption), /inte sparats/);
  assert.doesNotThrow(() => assertCharacterTurnHorizon(final, expectedStop, metadata.interruption));
  assert.throws(() => assertCharacterModelGeneration(world, { source: "fallback", fallbackReason: "invalid illness response" }), /invalid illness response/);
  assert.throws(() => assertCharacterModelGeneration(world, { source: "ai", fallbackReason: "JSON validation failed" }), /JSON validation failed/);
});

test("a care-stopped turn saves one dated snapshot and restores the complete pre-turn bundle on failure", async () => {
  const world = rollingYearWorld();
  const requested = addGameMonths(world.characterSystem.date, 12);
  const turn = planCharacterAdvance(world, requested, { pauseForHealthDecisions: true });
  assert.ok(turn.interruption);
  const base = { world, game: { gameDate: world.characterSystem.date, round: 1 }, events: [], actions: [], chat: [], colors: {} };
  const next = { ...structuredClone(base), game: { ...base.game, gameDate: turn.state.date, round: 2 }, events: turn.events,
    world: applyEventImpactsToWorld({ world, events: turn.events }).world };
  const data = structuredClone(base);
  let snapshots = [];
  let failOnce = true;
  const io = { assertCurrent: async () => {}, readSnapshots: async () => snapshots,
    writeSnapshots: async (value) => { snapshots = structuredClone(value); },
    write: async (key, value) => {
      if (key === "events" && failOnce) { failOnce = false; throw new Error("health-stop-write-failed"); }
      data[key] = structuredClone(value);
    }, publish: async () => {} };
  await assert.rejects(commitCharacterTransaction({ id: "care-stop-failure", base, next, io }), /health-stop-write-failed/);
  assert.deepEqual(data, base);
  assert.equal(snapshots[0].state.game.gameDate, base.game.gameDate);
  assert.deepEqual(snapshots[0].state.world.characterSystem, base.world.characterSystem);
  await commitCharacterTransaction({ id: "care-stop-success", base, next, io });
  assert.deepEqual(data.world.characterSystem, turn.state);
  assert.equal(data.game.gameDate, turn.interruption.date);
  assert.ok(data.events.every((event) => compareGameDates(event.date, data.game.gameDate) <= 0));
  assert.ok(data.world.characterSystem.stories.some((story) => story.type === "health_care" && story.status === "open"));
});

test("runtime care, failed save recovery, load and calendar recovery retain conditions and select the right portrait", async () => {
  const originalFetch = globalThis.fetch;
  const data = { world: sickWorld(), game: { country: "Hadara", gameDate: DATE, startDate: DATE, round: 1 },
    actions: [], events: [], chat: [], colors: {}, snapshots: [] };
  let failEvents = false;
  globalThis.fetch = async (url, options = {}) => {
    const key = new URL(String(url), "http://health-runtime.test").pathname.split("/").at(-1);
    if (options.method === "PUT") {
      if (key === "events" && failEvents) { failEvents = false; return new Response("failure", { status: 503 }); }
      data[key] = JSON.parse(options.body);
    }
    return new Response(JSON.stringify(data[key] ?? {}), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  setRuntimeAssetEndpoints({ token: "character-health-integration" });
  try {
    const first = await readVisibleCharacterState({ force: true });
    assert.equal(appearance(first).visualState, "smallpox");
    const proposed = prepareCharacterTimeline(data.world, [{ id: "unauthorized-care", date: DATE, title: "Ett råd", impacts: {
      characterOps: [{ id: "model-care", kind: "command", type: "provide_care", payload: { personId: PERSON, conditionId: CONDITION, care: "physician" } }],
    } }], DATE);
    assert.deepEqual(applyEventImpactsToWorld({ world: data.world, events: proposed }).world.characterSystem, first,
      "a model cannot spend family money on treatment");
    const care = await submitCharacterCommand({ id: "player-care", expectedRevision: first.revision, type: "provide_care",
      payload: { personId: PERSON, conditionId: CONDITION, care: "physician" } });
    assert.equal(care.ok, true, care.error);
    const loaded = await readVisibleCharacterState({ force: true });
    assert.deepEqual(loaded, care.state);
    assert.equal(loaded.people[PERSON].healthConditions[0].treatment.kind, "physician");
    assert.equal(appearance(loaded).visualState, "smallpox");
    assert.deepEqual(data.snapshots[0].state.world.characterSystem, first);
    const beforeFailure = JSON.stringify({ world: data.world, game: data.game, events: data.events });
    failEvents = true;
    const failed = await advanceCharacterYear();
    assert.equal(failed.ok, false);
    assert.equal(JSON.stringify({ world: data.world, game: data.game, events: data.events }), beforeFailure);
    const recovered = await advanceCharacterYear();
    assert.equal(recovered.ok, true, recovered.error);
    const after = await readVisibleCharacterState({ force: true });
    assert.deepEqual(after, recovered.state);
    assert.equal(after.people[PERSON].healthConditions.find((condition) => condition.id === CONDITION).stage, "scarred");
    assert.equal(appearance(after).visualState, "smallpox-scars");
    assert.equal(after.people[PERSON].portraitIdentityId, first.people[PERSON].portraitIdentityId);
    assert.equal(after.people[PERSON].portraitFallbackIdentityId, first.people[PERSON].portraitFallbackIdentityId);
    assert.equal(after.healthRngState, recovered.state.healthRngState);
  } finally { globalThis.fetch = originalFetch; }
});

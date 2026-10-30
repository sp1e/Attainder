import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterSystem, getCharacterPresentation } from "./characters/index.js";
import { applyEventImpactsToWorld, normalizeEvents, normalizeWorldState, viewAsSeen } from "./gameState.js";
import { buildCharacterPromptContext, characterTransitionEvents, normalizeCharacterOps, planCharacterAdvance, prepareCharacterTimeline, projectCharacterWorld } from "./characterWorld.js";

const start = () => normalizeWorldState({
  characterSystem: createCharacterSystem({ polityId: "Hadara", polityName: "Hadara", date: "-0300-01-01", seed: 17 }),
  polityOverrides: { Hadara: { code: "Hadara", name: "Hadara" } },
  units: [{ id: "army", ownerCode: "Hadara", name: "Gränsarmén", lng: 36, lat: 35, strength: 90 }],
});

test("canonical character state and projections survive normalizer and JSON round trip", () => {
  const world = start();
  const restored = normalizeWorldState(JSON.parse(JSON.stringify(world)));
  assert.deepEqual(restored.characterSystem, world.characterSystem);
  assert.deepEqual(restored.characterEconomy, world.characterEconomy);
  assert.deepEqual(restored.units, world.units);
  assert.equal(restored.countryStats.Hadara.leader, getCharacterPresentation(world.characterSystem).ruler.name);
});

test("repeated projection does not compound military or production modifiers", () => {
  const world = start();
  const city = Object.values(world.characterSystem.cities)[0];
  world.markers = [{ id: city.id, kind: "city", name: city.name, ownerCode: "Hadara", lng: 36, lat: 35, note: "" }];
  const projected = projectCharacterWorld(world);
  let repeated = projected;
  for (let i = 0; i < 10; i++) repeated = projectCharacterWorld(repeated);
  assert.deepEqual(repeated.units, projected.units);
  assert.deepEqual(repeated.countryStats, projected.countryStats);
  assert.deepEqual(repeated.markers, projected.markers);
  assert.equal((repeated.markers[0].note.match(/Familjepolitik/g) ?? []).length, 1);
});

test("a normal model stat patch cannot invent a different character ruler", () => {
  const world = start();
  world.countryStats.Hadara.leader = "Invented stranger";
  assert.notEqual(normalizeWorldState(world).countryStats.Hadara.leader, "Invented stranger");
});

test("a validated polity rename keeps character and family identity bound to the same realm", () => {
  const world = start();
  const renamed = applyEventImpactsToWorld({ world, events: [{ id: "rename", date: world.characterSystem.date,
    title: "Riket antar ett nytt namn", impacts: { polityChanges: [{ code: "Hadara", name: "Nya Hadara" }] } }] }).world;
  assert.equal(renamed.characterSystem.identity.polityId, "Nya Hadara");
  assert.equal(renamed.characterSystem.realm.id, "Nya Hadara");
  assert.deepEqual(renamed.characterSystem.people, world.characterSystem.people);
  assert.equal(renamed.characterSystem.identity.familyId, world.characterSystem.identity.familyId);
  assert.equal(renamed.countryStats.Hadara, undefined);
  assert.ok(renamed.countryStats["Nya Hadara"].leader);
});

test("calendar transitions persist through event normalization and replay exactly once", () => {
  const world = start();
  const transition = planCharacterAdvance(world, "-0299-01-01");
  const events = normalizeEvents(transition.events);
  assert.ok(events.some((event) => event.impacts.characterOps.length));
  const once = applyEventImpactsToWorld({ world, events }).world;
  const twice = applyEventImpactsToWorld({ world: once, events }).world;
  assert.deepEqual(once.characterSystem, transition.state);
  assert.deepEqual(twice.characterSystem, once.characterSystem);
  assert.deepEqual(twice.units, once.units);
  const encoded = events.at(-1).impacts.characterOps[0];
  const full = { id: encoded.id, kind: "checkpoint", fromRevision: world.characterSystem.revision, state: transition.state };
  assert.ok(JSON.stringify(encoded).length <= JSON.stringify(full).length, "a burst of changes must not cost more than a full checkpoint");
});

test("compact patches restore appended, removed and truncated fields", () => {
  const world = start();
  world.characterSystem.appliedCommandIds = ["first", "removed"];
  world.characterSystem.temporaryDiagnostic = true;
  const after = JSON.parse(JSON.stringify(world.characterSystem));
  after.appliedCommandIds = ["first"];
  delete after.temporaryDiagnostic;
  after.revision++;
  const events = characterTransitionEvents(world.characterSystem, { ok: true, state: after, events: [] }, "patch-test");
  const replay = applyEventImpactsToWorld({ world, events }).world;
  assert.deepEqual(replay.characterSystem, after);
  assert.throws(() => normalizeCharacterOps([{ id: "bad", kind: "patch", fromRevision: 0, toRevision: 1,
    changes: [{ path: ["__proto__", "polluted"], value: true }] }]), /ogiltig/);
});

test("same-date interactive events do not advance a life or consume randomness", () => {
  const world = start();
  const events = prepareCharacterTimeline(world, [{ id: "conversation", date: world.characterSystem.date,
    title: "Ett samtal", source: "ai", impacts: {} }], world.characterSystem.date);
  const after = applyEventImpactsToWorld({ world, events }).world;
  assert.deepEqual(after.characterSystem, world.characterSystem);
});

test("model-provided checkpoints are discarded, while invalid commands are visibly refused", () => {
  const world = start();
  const forged = JSON.parse(JSON.stringify(world.characterSystem));
  forged.revision += 10;
  const events = prepareCharacterTimeline(world, [{ id: "bad-model", date: world.characterSystem.date,
    title: "Förslag", source: "character-system", impacts: { characterOps: [
      { id: "forged", kind: "checkpoint", fromRevision: 0, state: forged },
      { id: "bad-command", kind: "command", type: "invent_heir", payload: {} },
    ] } }], world.characterSystem.date);
  const after = applyEventImpactsToWorld({ world, events }).world;
  assert.deepEqual(after.characterSystem, world.characterSystem);
  assert.ok(events.some((event) => event.title === "Förslaget kräver ditt beslut"));
});

test("model proposals outside the turn cannot execute against a different date", () => {
  const world = start();
  for (const date of ["-0301-01-01", "-0298-01-01"]) {
    assert.throws(() => prepareCharacterTimeline(world, [{ id: "outside", date,
      title: "Förslag", impacts: {} }], "-0299-01-01"), /utanför/);
  }
  assert.throws(() => prepareCharacterTimeline(world, [], "-0301-01-01"), /slutdatum/);
});

test("a family without government mandate cannot execute a player-linked legacy state order", () => {
  const world = start();
  world.characterSystem.identity.mode = "family";
  world.characterSystem.identity.familyId = Object.keys(world.characterSystem.families).find((id) => id !== world.characterSystem.identity.familyId);
  const unitOps = [{ op: "move", id: "army", lng: 37, lat: 36 }];
  const events = prepareCharacterTimeline(world, [{ id: "player-order", date: world.characterSystem.date,
    title: "Spelaren befaller armén", impacts: { actionIds: ["planned-1"], unitOps } }], world.characterSystem.date);
  assert.match(events[0].title, /saknar mandat/);
  assert.deepEqual(events[0].impacts.unitOps, []);
  const autonomous = prepareCharacterTimeline(world, [{ id: "world-order", date: world.characterSystem.date,
    title: "Rikets egen ledning agerar", impacts: { unitOps } }], world.characterSystem.date);
  assert.deepEqual(autonomous[0].impacts.unitOps, unitOps, "independent world simulation is not confused with a player's state order");
});

test("a multi-year timeline and annual replay reach the same character world", () => {
  const world = start();
  const all = planCharacterAdvance(world, "-0297-01-01", { id: "year" });
  let annual = world;
  for (const year of ["-0299-01-01", "-0298-01-01", "-0297-01-01"]) {
    const planned = planCharacterAdvance(annual, year, { id: "year" });
    annual = applyEventImpactsToWorld({ world: annual, events: planned.events }).world;
  }
  assert.deepEqual(all.state, annual.characterSystem);
});

test("missing reveal snapshot hides character state instead of exposing future deaths", async () => {
  const world = start();
  world.simulationHistory = [{ fromDate: "-0300-01-01", toDate: "-0299-01-01", eventIds: ["hidden"] }];
  const seen = await viewAsSeen({ world, events: [{ id: "hidden", date: "-0299-01-01", title: "Future" }],
    chats: [], game: { gameDate: "-0299-01-01" } }, { unseen: new Set(["hidden"]) });
  assert.equal(seen.world.characterSystem, null);
  assert.equal(seen.world.characterViewUnavailable, true);
  assert.equal(seen.world.countryStats.Hadara, undefined, "leader/stat projections must not leak the hidden character state");
  assert.equal(seen.game.gameDate, "-0300-01-01");
});

test("prompt context includes available commands and stable character IDs", () => {
  const world = start();
  const context = buildCharacterPromptContext(world.characterSystem);
  const view = getCharacterPresentation(world.characterSystem);
  assert.ok(context.includes(view.ruler.id));
  assert.ok(context.includes("NEVER executed automatically"));
  assert.ok(context.includes(view.stories[0].id));
  assert.ok(context.includes(view.actions[0].type));
  const original = JSON.stringify(world.characterSystem);
  const forecast = buildCharacterPromptContext(world.characterSystem, { targetDate: "-0299-01-01" });
  assert.ok(forecast.includes("Calendar forecast"));
  assert.ok(forecast.includes("-0299-01-01"));
  assert.equal(JSON.stringify(world.characterSystem), original, "a model forecast never mutates the campaign or draws live randomness");
  assert.equal(context.includes("Calendar forecast"), false, "ordinary conversations see no future forecast");
});

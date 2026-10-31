import test from "node:test";
import assert from "node:assert/strict";
import { setRuntimeAssetEndpoints } from "./assets.js";
import { getCharacterPresentation } from "./characters/index.js";
import { initializeCampaignCharacters, advanceCharacterYear, submitCharacterCommand,
  readVisibleCharacterState, getCharacterRuntimeStatus, revealLatestCharacterTurn,
  commitCharacterCampaign } from "./characterRuntime.js";

test("runtime campaign start, command, date, shared save and failed-write recovery use the same world", async () => {
  const originalFetch = globalThis.fetch;
  const data = {
    world: { units: [{ id: "army", name: "Armén", ownerCode: "Hadara", lng: 36, lat: 35, strength: 90 }] },
    game: { country: "Hadara", gameDate: "-0300-01-01", startDate: "-0300-01-01", round: 1 },
    events: [], actions: [], chat: [], colors: { Hadara: "#789abc" }, snapshots: [],
  };
  let failNextEventWrite = false;
  globalThis.fetch = async (url, options = {}) => {
    const key = new URL(String(url), "http://runtime.test").pathname.split("/").at(-1);
    if (options.method === "PUT") {
      if (key === "events" && failNextEventWrite) {
        failNextEventWrite = false;
        return new Response("failure", { status: 503 });
      }
      data[key] = JSON.parse(options.body);
    }
    return new Response(JSON.stringify(data[key] ?? {}), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  setRuntimeAssetEndpoints({ token: "characters-runtime-test" });
  try {
    const init = await initializeCampaignCharacters({ mode: "family", seed: 41 });
    assert.equal(init.ok, true, init.error);
    assert.equal(data.world.characterSystem.identity.mode, "family");
    assert.equal(data.world.countryStats.Hadara.leader, getCharacterPresentation(init.state).ruler.name);
    assert.ok(data.events.some((event) => event.impacts.characterOps.length));
    const before = data.world.characterSystem;
    const year = await advanceCharacterYear();
    assert.equal(year.ok, true, year.error);
    assert.equal(data.game.gameDate, "-0299-01-01");
    assert.equal(data.world.characterSystem.date, data.game.gameDate);
    assert.equal(data.world.characterSystem.identity.familyId, before.identity.familyId);
    assert.deepEqual(await readVisibleCharacterState({ force: true }), data.world.characterSystem);
    assert.ok(data.world.simulationHistory[0].eventIds.length);
    assert.equal(data.snapshots[0].state.game.gameDate, "-0300-01-01");
    const beforeReveal = JSON.stringify(data);
    const revealed = await revealLatestCharacterTurn();
    assert.equal(revealed.ok, true, revealed.error);
    assert.deepEqual(revealed.state, year.state);
    assert.deepEqual(revealed.events.map((event) => event.id), year.events.map((event) => event.id));
    assert.equal(JSON.stringify(data), beforeReveal, "revealing a turn must not generate or rewrite it");

    const view = getCharacterPresentation(year.state);
    const action = view.actions.find((entry) => !entry.disabledReason);
    assert.ok(action);
    const payload = Object.fromEntries((action.fields ?? []).map((field) => [field.key, field.options?.[0]?.value]));
    const stale = await submitCharacterCommand({ id: "stale", expectedRevision: before.revision,
      type: action.type, payload });
    assert.equal(stale.ok, false);
    const current = await submitCharacterCommand({ id: "current", expectedRevision: year.state.revision,
      type: action.type, payload });
    assert.equal(current.ok, true, current.error);
    const once = JSON.stringify(data.world.characterSystem);
    const repeated = await submitCharacterCommand({ id: "current", expectedRevision: year.state.revision,
      type: action.type, payload });
    assert.equal(repeated.ok, true, repeated.error);
    assert.equal(JSON.stringify(data.world.characterSystem), once);

    const preFailure = JSON.parse(JSON.stringify({ world: data.world, events: data.events, game: data.game }));
    failNextEventWrite = true;
    const failed = await advanceCharacterYear();
    assert.equal(failed.ok, false);
    assert.deepEqual({ world: data.world, events: data.events, game: data.game }, preFailure);
    assert.equal(getCharacterRuntimeStatus().busy, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a committed turn with an invalid character world is rejected before any write", async () => {
  const originalFetch = globalThis.fetch;
  const puts = [];
  globalThis.fetch = async (url, options = {}) => {
    const key = new URL(String(url), "http://runtime.test").pathname.split("/").at(-1);
    if (options.method === "PUT") puts.push(key);
    return new Response(key === "snapshots" ? "[]" : "{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  setRuntimeAssetEndpoints({ token: "characters-runtime-invalid-world" });
  try {
    const base = { game: { country: "Hadara", gameDate: "-0300-01-01", round: 1 },
      world: {}, events: [], actions: [], chat: [], colors: {} };
    // The model-turn path edits the world after its last normalization.
    const next = { ...base, game: { ...base.game, gameDate: "-0299-01-01", round: 2 },
      world: { characterSystem: { schemaVersion: 99 } } };
    await assert.rejects(commitCharacterCampaign({ id: "model-turn:2:-0299-01-01", base, next }), /nyare version/);
    assert.deepEqual(puts, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

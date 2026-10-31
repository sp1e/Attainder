import test from "node:test";
import assert from "node:assert/strict";
import { setRuntimeAssetEndpoints } from "./assets.js";
import { estimateCharacterAction, getCharacterPresentation } from "./characters/index.js";
import { initializeCampaignCharacters, advanceCharacterYear, submitCharacterCommand,
  readVisibleCharacterState, getCharacterRuntimeStatus, revealLatestCharacterTurn,
  commitCharacterCampaign, recordCharacterNarrative, estimateCharacterActionForView } from "./characterRuntime.js";

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

test("a narrative is recorded only through recordCharacterNarrative, never through a player command", async () => {
  const originalFetch = globalThis.fetch;
  const data = {
    world: { units: [] },
    game: { country: "Hadara", gameDate: "-0300-01-01", startDate: "-0300-01-01", round: 1 },
    events: [], actions: [], chat: [], colors: { Hadara: "#789abc" }, snapshots: [],
  };
  globalThis.fetch = async (url, options = {}) => {
    const key = new URL(String(url), "http://runtime.test").pathname.split("/").at(-1);
    if (options.method === "PUT") data[key] = JSON.parse(options.body);
    return new Response(JSON.stringify(data[key] ?? {}), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  setRuntimeAssetEndpoints({ token: "characters-narrative-test" });
  try {
    const init = await initializeCampaignCharacters({ mode: "family", seed: 41 });
    assert.equal(init.ok, true, init.error);
    const view = getCharacterPresentation(init.state);
    const sway = view.catalog.find((entry) => entry.catalogId === "sway");
    const attempt = await submitCharacterCommand({ id: "narrative-attempt", expectedRevision: init.state.revision, type: "attempt_action",
      payload: { actionId: "sway", actorId: view.representative.id, targetIds: [sway.fields[0].options[0].value], means: { silver: 0, agentRoles: [] } } });
    assert.equal(attempt.ok, true, attempt.error);
    const resolution = attempt.state.actionLog.at(-1);
    assert.equal(resolution.narrative, null);
    const payload = { resolutionId: resolution.id, title: "En vänlig gest", narrative: "Gåvorna togs emot med ett leende.", adjustments: [] };
    const refused = await submitCharacterCommand({ id: "narrative-player", expectedRevision: attempt.state.revision, type: "record_action_narrative", payload });
    assert.equal(refused.ok, false);
    assert.equal(refused.error, "Berättelsen kan bara skrivas av berättarsteget.");
    assert.equal(data.world.characterSystem.actionLog.at(-1).narrative, null);
    const recorded = await recordCharacterNarrative(payload);
    assert.equal(recorded.ok, true, recorded.error);
    assert.equal(data.world.characterSystem.actionLog.at(-1).narrative.title, "En vänlig gest");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("estimateCharacterActionForView gives the odds of the visible state and writes nothing", async () => {
  const originalFetch = globalThis.fetch;
  const data = {
    world: { units: [] },
    game: { country: "Hadara", gameDate: "-0300-01-01", startDate: "-0300-01-01", round: 1 },
    events: [], actions: [], chat: [], colors: { Hadara: "#789abc" }, snapshots: [],
  };
  let writes = 0;
  globalThis.fetch = async (url, options = {}) => {
    const key = new URL(String(url), "http://runtime.test").pathname.split("/").at(-1);
    if (options.method === "PUT") { writes += 1; data[key] = JSON.parse(options.body); }
    return new Response(JSON.stringify(data[key] ?? {}), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  setRuntimeAssetEndpoints({ token: "characters-estimate-test" });
  try {
    const init = await initializeCampaignCharacters({ mode: "family", seed: 41, difficulty: "hard" });
    assert.equal(init.ok, true, init.error);
    const view = getCharacterPresentation(init.state);
    assert.deepEqual(view.difficulty, { id: "hard", label: "Svår" });
    const sway = view.catalog.find((entry) => entry.catalogId === "sway");
    const intent = { actionId: "sway", actorId: view.representative.id, targetIds: [sway.fields[0].options[0].value], means: { silver: 0, agentRoles: [] } };
    const before = JSON.stringify(data);
    const writesBefore = writes;
    const estimate = await estimateCharacterActionForView(intent);
    assert.equal(estimate.ok, true, estimate.reason);
    // The estimate names the revision it was made on, so a confirmation can be refused once the world has moved.
    assert.deepEqual(estimate, { ...estimateCharacterAction(data.world.characterSystem, intent), revision: data.world.characterSystem.revision });
    assert.ok(estimate.success.modifiers.some((row) => row.label === "Svårighetsgrad: Svår" && row.value === -10));
    assert.equal(writes, writesBefore);
    assert.equal(JSON.stringify(data), before);
    const refused = await estimateCharacterActionForView({ ...intent, actionId: "gift" });
    assert.equal(refused.ok, false);
    assert.equal(typeof refused.reason, "string");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

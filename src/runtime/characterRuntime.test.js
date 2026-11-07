import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSON_URLS, readJson, setRuntimeAssetEndpoints } from "./assets.js";
import { createCharacterSystem, estimateCharacterAction, estimateConversation, getCharacterPresentation } from "./characters/index.js";
import { initializeCampaignCharacters, advanceCharacterYear, submitCharacterCommand,
  readVisibleCharacterState, getCharacterRuntimeStatus, revealLatestCharacterTurn,
  commitCharacterCampaign, recordCharacterNarrative, estimateCharacterActionForView,
  estimateConversationForView, submitConversationRequest, getConversationViewForModel } from "./characterRuntime.js";

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

test("a conversation is held only through submitConversationRequest, never through a player command", async () => {
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
  setRuntimeAssetEndpoints({ token: "characters-conversation-test" });
  try {
    const init = await initializeCampaignCharacters({ mode: "family", seed: 41 });
    assert.equal(init.ok, true, init.error);
    const view = getCharacterPresentation(init.state);
    assert.ok(view.conversationTargets.length > 0);
    const request = { personId: view.conversationTargets[0].id, kind: "support", offerSilver: 0, hookId: null, arguments: [], argumentScore: 0 };
    // The estimate reads the visible state, writes nothing and names its revision.
    const writesBefore = writes;
    const estimate = await estimateConversationForView(request);
    assert.equal(estimate.ok, true, estimate.reason);
    assert.deepEqual(estimate, { ...estimateConversation(data.world.characterSystem, request), revision: data.world.characterSystem.revision });
    assert.equal(writes, writesBefore);
    assert.equal((await estimateConversationForView({ ...request, kind: "bribe" })).ok, false);
    // The model view carries the engine's brief on the person and writes nothing.
    const modelView = await getConversationViewForModel(request.personId);
    assert.equal(modelView.conversationBrief.personId, request.personId);
    assert.equal(writes, writesBefore);
    // A player command with the same payload is refused and nothing is written.
    const refused = await submitCharacterCommand({ id: "converse-player", expectedRevision: init.state.revision, type: "converse_request", payload: request });
    assert.equal(refused.ok, false);
    assert.equal(refused.error, "Samtalsförfrågningar kan bara göras i samtalssteget.");
    assert.equal(data.world.characterSystem.conversations.length, 0);
    // The conversation step is accepted and the exchange is stored.
    const held = await submitConversationRequest(request, { expectedRevision: estimate.revision });
    assert.equal(held.ok, true, held.error);
    assert.equal(data.world.characterSystem.conversations.length, 1);
    assert.equal(data.world.characterSystem.conversations[0].personId, request.personId);
    // The estimate's revision is honoured: a stale one is refused.
    const stale = await submitConversationRequest({ ...request, personId: view.conversationTargets[1].id }, { expectedRevision: estimate.revision });
    assert.equal(stale.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("origin converse is set in exactly one place in the source", () => {
  const roots = [".", "../Game"].map((path) => fileURLToPath(new URL(path, import.meta.url)).replace(/[\\/]$/, ""));
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== "node_modules") walk(path); continue; }
      if (!/\.(js|jsx|mjs)$/.test(entry.name) || /\.test\./.test(entry.name)) continue;
      const hits = readFileSync(path, "utf8").match(/origin\s*[:=]\s*["']converse["']/g);
      if (hits) found.push([entry.name, hits.length]);
    }
  };
  roots.forEach(walk);
  assert.deepEqual(found, [["characterRuntime.js", 1]]);
});

for (const bookmark of ['egypt-3000bc', 'john-1200', 'charlemagne-800']) test(`historical initialization opts in to ${bookmark}, preserves existing people and fails before writes`, async () => {
  const originalFetch = globalThis.fetch;
  const base = new URL(`../../server/seed/historical/${bookmark}/`, import.meta.url);
  const authored = JSON.parse(readFileSync(new URL('scenario.json', base), 'utf8')).data;
  const regions = JSON.parse(readFileSync(new URL('regions.geojson', base), 'utf8'));
  const data = { ...authored, regionsGeojson: regions, events: [], actions: [], chat: [], colors: {}, snapshots: [] };
  const puts = [];
  globalThis.fetch = async (url, options = {}) => {
    const key = new URL(String(url), 'http://runtime.test').pathname.split('/').at(-1);
    if (options.method === 'PUT') { puts.push(key); data[key] = JSON.parse(options.body); }
    return new Response(JSON.stringify(data[key] ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  setRuntimeAssetEndpoints({ token: `historical-runtime-${bookmark}` });
  try {
    assert.deepEqual(await readJson(JSON_URLS.regionsGeojson, { force: true }), regions);
    const initialized = await initializeCampaignCharacters({ seed: 321 });
    assert.equal(initialized.ok, true, initialized.error);
    assert.equal(initialized.state.historicalOrigin.contentId, bookmark);
    assert.equal(initialized.state.identity.polityId, authored.game.country);
    const saved = JSON.parse(JSON.stringify(data.world.characterSystem));
    // Existing records win even when the stored authored package is now unusable.
    data.world.historicalScenario.courtSeeds = {};
    puts.length = 0;
    const resumed = await initializeCampaignCharacters({ seed: 999 });
    assert.equal(resumed.ok, true, resumed.error);
    assert.deepEqual(resumed.state, saved);
    assert.deepEqual(puts, []);
    delete data.world.characterSystem;
    const refused = await initializeCampaignCharacters();
    assert.equal(refused.ok, false);
    assert.match(refused.error, /historiska/);
    assert.deepEqual(puts, []);
    assert.equal(data.world.characterSystem, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test('existing modern character save loads unchanged without a historical start-range check', async () => {
  const originalFetch = globalThis.fetch;
  const state = createCharacterSystem({ date: '2026-11-05', seed: 41 });
  const data = { game: { country: 'hadara', gameDate: state.date, startDate: state.date }, world: { characterSystem: state }, events: [], actions: [], chat: [] };
  const puts = [];
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'PUT') puts.push(url);
    const key = new URL(String(url), 'http://runtime.test').pathname.split('/').at(-1);
    return new Response(JSON.stringify(data[key] ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  setRuntimeAssetEndpoints({ token: 'modern-save-compatibility' });
  try {
    const result = await initializeCampaignCharacters({ seed: 999 });
    assert.equal(result.ok, true, result.error);
    assert.deepEqual(result.state, state);
    assert.deepEqual(puts, []);
  } finally { globalThis.fetch = originalFetch; }
});

test('historical initialization refuses the reserved generated-person namespace before any write', async () => {
  const originalFetch = globalThis.fetch;
  const base = new URL('../../server/seed/historical/egypt-3000bc/', import.meta.url);
  const data = JSON.parse(readFileSync(new URL('scenario.json', base), 'utf8')).data;
  data.regionsGeojson = JSON.parse(readFileSync(new URL('regions.geojson', base), 'utf8'));
  Object.assign(data, { events: [], actions: [], chat: [], colors: {}, snapshots: [] });
  const court = data.world.historicalScenario.courtSeeds['egypt-early-dynastic'];
  const remap = id => id === 'generated-courtier-3' ? 'person-4' : id;
  for (const person of court.people) {
    person.id = remap(person.id);
    person.legalParentIds = person.legalParentIds.map(remap);
    person.spouseIds = person.spouseIds.map(remap);
  }
  for (const family of court.families) family.headId = remap(family.headId);
  for (const religion of court.religions) religion.leaderId = remap(religion.leaderId);
  for (const office of court.offices) office.holderId = remap(office.holderId);
  const before = JSON.parse(JSON.stringify(data)), puts = [];
  globalThis.fetch = async (url, options = {}) => {
    const key = new URL(String(url), 'http://runtime.test').pathname.split('/').at(-1);
    if (options.method === 'PUT') puts.push(key);
    return new Response(JSON.stringify(data[key] ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  setRuntimeAssetEndpoints({ token: 'historical-reserved-person-id' });
  try {
    const result = await initializeCampaignCharacters({ seed: 1 });
    assert.equal(result.ok, false);
    assert.match(result.error, /Det historiska hovets uppgifter.*\./);
    assert.deepEqual(puts, []);
    assert.deepEqual(data, before);
  } finally { globalThis.fetch = originalFetch; }
});

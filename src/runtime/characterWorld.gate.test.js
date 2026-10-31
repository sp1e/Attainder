import test from "node:test";
import assert from "node:assert/strict";
import { advanceCharacters, createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getCatalogActions, getPersonalOpinion } from "./characters/index.js";
import { estimateAction } from "./characters/actionOdds.js";
import { ACTION_CATALOG } from "./characters/actionCatalog.js";
import { resolveScheme } from "./characters/actionResolution.js";
import { applyEventImpactsToWorld, normalizeWorldState } from "./gameState.js";
import { buildCharacterPromptContext, prepareCharacterTimeline } from "./characterWorld.js";
import { addGameMonths } from "./gameDates.js";

// REP rules the realm and heads the player's family; NPC heads another family.
const REP = "person-0-0";
const OWN_MEMBER = "person-0-2";
const NPC = "person-1-0";
const NPC_FAMILY = "family-namar";
const PLAYER_FAMILY = "family-arel";
const DATE = "-0300-01-01";
const REFUSED_TITLE = "Modellens förslag avvisades";
const DECISION_TITLE = "Förslaget kräver ditt beslut";

const copy = (value) => JSON.parse(JSON.stringify(value));
const start = (options = {}, world = {}) => normalizeWorldState({
  characterSystem: createCharacterSystem({ polityId: "Hadara", polityName: "Hadara", date: DATE, seed: 17, ...options }),
  polityOverrides: { Hadara: { code: "Hadara", name: "Hadara" } },
  ...world,
});
const command = (id, type, payload) => ({ id, kind: "command", type, payload });
const modelEvent = (characterOps, extra = {}) => ({ id: "model-1", date: DATE, title: "Modellens år", source: "ai", impacts: { characterOps }, ...extra });
// Plans one model turn ending on the start date and returns its events and the engine's final state.
function plan(world, events) {
  let state = null;
  const output = prepareCharacterTimeline(world, events, DATE, { onComplete: (final) => { state = final; } });
  return { events: output, state };
}
const replay = (world, events) => applyEventImpactsToWorld({ world, events }).world;
const notices = (events) => events.filter((event) => event.title === REFUSED_TITLE);

test("a model event cannot dissolve the character polity", () => {
  const world = start();
  const after = replay(world, [{ id: "dissolve", date: DATE, title: "Riket upplöses", source: "ai",
    impacts: { polityChanges: [{ code: "Hadara", operation: "dissolve" }] } }]);
  assert.equal(after.characterSystem.realm.alive, true);
  assert.notEqual(after.polityOverrides.Hadara?.status, "dissolved");
});

test("a bare model dissolve is refused, an annexation that settles the realm's last region in the same event dissolves it", () => {
  const territory = { polityOverrides: { Hadara: { code: "Hadara", name: "Hadara" }, Qedar: { code: "Qedar", name: "Qedar", status: "active" } },
    regionOwnershipOverrides: { "HAD.1": "Hadara", "QED.1": "Qedar" } };
  const bare = replay(start({}, territory), [{ id: "bare", date: DATE, title: "Riket upplöses", source: "ai",
    impacts: { regionTransfers: [], polityChanges: [{ code: "Hadara", operation: "dissolve" }] } }]);
  assert.equal(bare.characterSystem.realm.alive, true);
  assert.notEqual(bare.polityOverrides.Hadara?.status, "dissolved");
  const annexed = replay(start({}, territory), [{ id: "annex", date: DATE, title: "Hadara upphör", source: "ai",
    impacts: { regionTransfers: [{ regionId: "HAD.1", fromCode: "Hadara", toCode: "Qedar" }], polityChanges: [{ code: "Hadara", operation: "dissolve" }] } }]);
  assert.equal(annexed.polityOverrides.Hadara.status, "dissolved");
  assert.equal(annexed.characterSystem.realm.alive, false);
});

test("a stored ai event cannot execute a character command on replay", () => {
  const world = start();
  const rest = { ...command("stored-rest", "rest", {}), expectedRevision: world.characterSystem.revision };
  const after = replay(world, [{ id: "stored-ai", date: DATE, title: "Vila", source: "ai", impacts: { characterOps: [rest] } }]);
  assert.deepEqual(after.characterSystem, world.characterSystem);
});

test("a game-master event still executes a validated command", () => {
  const world = start();
  const rest = { ...command("gm-rest", "rest", {}), expectedRevision: world.characterSystem.revision };
  const after = replay(world, [{ id: "gm", date: DATE, title: "Spelledaren", source: "game-master", impacts: { characterOps: [rest] } }]);
  assert.ok(after.characterSystem.appliedCommandIds.includes("gm-rest"));
  assert.equal(after.characterSystem.actionPoints, world.characterSystem.actionPoints - 1);
});

test("a realm_effect inside its envelope changes the treasury once, also on replay", () => {
  const world = start();
  const before = world.characterSystem;
  const effect = command("model-effect", "realm_effect", { treasury: 30, legitimacy: -5, armyStrength: 4, reason: "Ett silverfynd i bergen fyller kassan." });
  const planned = plan(world, [modelEvent([effect])]);
  assert.equal(planned.state.realm.treasury, before.realm.treasury + 30);
  assert.equal(planned.state.realm.legitimacy, before.realm.legitimacy - 5);
  assert.equal(planned.state.realm.armyStrength, before.realm.armyStrength + 4);
  assert.equal(planned.state.rngState, before.rngState);
  assert.ok(planned.state.appliedCommandIds.includes("model-1:gate:0"));
  assert.deepEqual(planned.events.find((event) => event.id === "model-1").impacts.characterOps, [], "the model event itself carries no command");
  assert.equal(notices(planned.events).length, 0);
  const once = replay(world, planned.events);
  assert.deepEqual(once.characterSystem, planned.state);
  assert.equal(once.characterSystem.realm.treasury, before.realm.treasury + 30);
  assert.deepEqual(replay(once, planned.events).characterSystem, once.characterSystem);
});

test("realm_effect values clamp the realm's fields to their bounds", () => {
  const world = start();
  world.characterSystem.realm.treasury = 50;
  world.characterSystem.realm.legitimacy = 98;
  const planned = plan(world, [modelEvent([command("clamp", "realm_effect", { treasury: -80, legitimacy: 5, reason: "Ett dyrt krig och en segerfest." })])]);
  assert.equal(planned.state.realm.treasury, 0);
  assert.equal(planned.state.realm.legitimacy, 100);
});

test("a realm_effect outside its envelope is refused with a visible notice", () => {
  const world = start();
  const reason = "En förklaring.";
  const bad = [
    { treasury: 41, reason }, { treasury: -81, reason }, { legitimacy: 6, reason }, { legitimacy: -11, reason },
    { armyStrength: 11, reason }, { armyStrength: -16, reason }, { treasury: 1.5, reason }, { treasury: 0, reason },
    { treasury: 10 }, { treasury: 10, reason: "" }, { treasury: 10, reason: "x".repeat(201) },
  ];
  const planned = plan(world, [modelEvent(bad.map((payload, index) => command(`bad-${index}`, "realm_effect", payload)))]);
  assert.deepEqual(planned.state, world.characterSystem);
  const notice = notices(planned.events);
  assert.equal(notice.length, 1, "one notice per model event");
  assert.equal(notice[0].source, "character-system");
  assert.ok(notice[0].description.length > 0);
  assert.deepEqual(replay(world, planned.events).characterSystem, world.characterSystem);
});

test("realm_effect and npc_intent are refused outside the gate", () => {
  const world = start();
  for (const [type, payload] of [["realm_effect", { treasury: 10, reason: "Försök." }], ["npc_intent", { actorId: NPC, actionId: "sway", targetIds: [REP] }]]) {
    const result = executeCharacterCommand(world.characterSystem, { id: `player-${type}`, expectedRevision: world.characterSystem.revision, type, payload });
    assert.equal(result.ok, false);
    assert.match(result.error, /[a-zåäö]\.$/i);
  }
});

test("an npc_intent rolls with the NPC's odds and never acts for the player family", () => {
  const world = start({ difficulty: "hard" });
  const before = world.characterSystem;
  const intent = { actorId: NPC, actionId: "sway", targetIds: [REP] };
  const expected = estimateAction(before, intent, { representativeId: REP, activeRepresentativeId: REP, playerControlled: false,
    canOrder: () => true, wallet: () => before.families[NPC_FAMILY].treasury, opinion: (from, to) => getPersonalOpinion(before, from, to) });
  assert.equal(expected.ok, true);
  assert.ok(expected.success.modifiers.some((row) => row.label.includes("(mot dig)") && row.value === 10));
  const planned = plan(world, [modelEvent([
    command("npc", "npc_intent", intent),
    command("own", "npc_intent", { actorId: OWN_MEMBER, actionId: "sway", targetIds: [NPC] }),
    command("rep", "npc_intent", { actorId: REP, actionId: "sway", targetIds: [NPC] }),
  ])]);
  const state = planned.state;
  assert.equal(state.actionLog.length, 1);
  const entry = state.actionLog[0];
  assert.equal(entry.actorId, NPC);
  assert.equal(entry.playerControlled, false);
  assert.equal(entry.estimate.success, expected.success.value);
  assert.equal(entry.estimate.secrecy, expected.secrecy.value);
  assert.equal(entry.estimate.refusal, null);
  assert.equal(state.families[NPC_FAMILY].treasury, before.families[NPC_FAMILY].treasury - expected.cost.silver, "the NPC family pays");
  assert.equal(state.families[PLAYER_FAMILY].treasury, before.families[PLAYER_FAMILY].treasury);
  assert.equal(state.actionPoints, before.actionPoints, "no action points are spent");
  assert.equal(state.people[REP].stress, before.people[REP].stress);
  assert.equal(state.rngState, before.rngState);
  const notice = notices(planned.events);
  assert.equal(notice.length, 1);
  assert.equal((notice[0].description.match(/egen handling/gi) ?? []).length, 2, "both refusals are listed");
  assert.deepEqual(replay(world, planned.events).characterSystem, state);
});

test("an NPC family that cannot pay refuses the intent before any draw", () => {
  const world = start();
  world.characterSystem.families[NPC_FAMILY].treasury = 0;
  const planned = plan(world, [modelEvent([command("poor", "npc_intent", { actorId: NPC, actionId: "sway", targetIds: [REP] })])]);
  assert.deepEqual(planned.state, world.characterSystem, "nothing drawn, nothing paid");
  assert.equal(notices(planned.events).length, 1);
});

test("an NPC scheme intent starts a scheme paid by the NPC family and resolves at its due date", () => {
  const world = start();
  const before = world.characterSystem;
  const planned = plan(world, [modelEvent([command("plot", "npc_intent", { actorId: NPC, actionId: "undermine", targetIds: [REP] })])]);
  const scheme = planned.state.schemes.at(-1);
  assert.equal(scheme.actorId, NPC);
  assert.equal(scheme.playerControlled, false);
  assert.equal(planned.state.families[NPC_FAMILY].treasury, before.families[NPC_FAMILY].treasury - ACTION_CATALOG.undermine.cost.silver);
  assert.equal(planned.state.actionPoints, before.actionPoints);
  const done = advanceCharacters(planned.state, addGameMonths(DATE, ACTION_CATALOG.undermine.durationMonths));
  assert.equal(done.ok, true, done.error);
  assert.notEqual(done.state.schemes.at(-1).status, "active");
  assert.equal(done.state.rngState, advanceCharacters(before, addGameMonths(DATE, ACTION_CATALOG.undermine.durationMonths)).state.rngState);
});

test("an NPC scheme hires its agents from the actor's family at the due date", () => {
  const state = copy(start().characterSystem);
  state.schemes.push({ id: `scheme-${++state.sequence}`, actionId: "undermine", actorId: NPC, targetIds: [REP], means: { silver: 0, agentRoles: ["cook"] },
    startedAt: DATE, dueAt: addGameMonths(DATE, 1), nextCheckAt: addGameMonths(DATE, 1), status: "active", discoveredAt: null, resolutionId: null, playerControlled: false, commandId: null });
  const result = advanceCharacters(state, addGameMonths(DATE, 1));
  assert.equal(result.ok, true, result.error);
  for (const entry of result.state.actionLog) for (const id of entry.agentIds) assert.equal(result.state.courtStaff[id].familyId, NPC_FAMILY);
});

test("agents fall back to the actor's family when there is no controlled family", () => {
  const state = copy(start().characterSystem);
  const intent = { actionId: "sway", actorId: REP, targetIds: [NPC] };
  const estimate = estimateCharacterAction(state, intent);
  assert.equal(estimate.ok, true, estimate.reason);
  const hooks = {
    memory: (type, title, participants, options = {}) => { const item = { id: `memory-${++state.sequence}`, date: state.date, type, title, participants, causeId: null, knownBy: "public", familyIds: [], ...options }; state.memories.push(item); return item; },
    opinionCause: () => {},
    logEvent: (events, type, title, description, participants = [], extra = {}) => { const event = { id: `event-${++state.sequence}`, date: state.date, type, title, description, participants, public: true, ...extra }; state.log.push(event); events.push(event); return event; },
    controlledFamily: () => null, householdRepresentative: () => null, activeRepresentative: () => null,
  };
  const scheme = { actionId: "sway", commandId: null, playerControlled: true, means: { silver: 0, agentRoles: ["cook"] } };
  const entry = resolveScheme(state, scheme, estimate, [], hooks);
  assert.equal(entry.agentIds.length, 1);
  assert.equal(state.courtStaff[entry.agentIds[0]].familyId, PLAYER_FAMILY);
});

test("a player-only command proposal still produces the decision notice", () => {
  const world = start();
  const planned = plan(world, [modelEvent([command("model-rest", "rest", {})])]);
  assert.ok(planned.events.some((event) => event.title === DECISION_TITLE));
  assert.deepEqual(planned.state, world.characterSystem);
});

test("the catalog evaluates contested actions for the active representative, also when the ruler is not the family head", () => {
  const state = copy(start().characterSystem);
  state.offices.ruler.holderId = OWN_MEMBER;
  const sway = getCatalogActions(state).find((action) => action.catalogId === "sway");
  const targets = sway.fields.find((field) => field.key === "targetId").options.map((option) => option.value);
  assert.equal(targets.includes(OWN_MEMBER), false, "the ruler acts and is not a target");
  assert.ok(targets.includes(REP), "the family head is a possible target");
});

test("the prompt describes the gate commands and the contested catalog", () => {
  const context = buildCharacterPromptContext(start().characterSystem);
  for (const text of ["realm_effect", "npc_intent", "-80", "+40", "-15", "+10", "sway", "undermine", ACTION_CATALOG.sway.label]) assert.ok(context.includes(text), text);
});

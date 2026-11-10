import { JSON_URLS, readJson, writeJson } from "./assets.js";
import { getLibraryState } from "./library.js";
import { assertCampaignUnchanged } from "./campaignGuard.js";
import { addGameMonths, diffGameDays } from "./gameDates.js";
import { primeRuntimeValue } from "./runtimeStore.js";
import {
  applyEventImpactsToWorld, normalizeEvents, normalizeGameData, normalizeWorldState,
  readGameStateBundle, readWorldState, viewAsSeen,
} from "./gameState.js";
import { beginSimulation, endSimulation, isSimulationBusy } from "../Game/AI/simulationStatus.js";
import { unseenEvents, latestTurnEventIds } from "./unseenEvents.js";
import { createCharacterSystem, estimateCharacterAction, estimateConversation, estimateEnvoyRequest, getCharacterPresentation, getConversationBrief, getEnvoyBrief } from "./characters/index.js";
import { characterTransitionEvents, executeCharacterWorldCommand, planCharacterAdvance } from "./characterWorld.js";
import { readCharacterWatches } from "./characterWatchSettings.js";
import { commitCharacterTransaction, recoverCharacterTransaction } from "./characterPersistence.js";
import { createHistoricalCharacterSystem } from "./characters/scenarioSeed.js";
import { validateHistoricalScenario } from "./historicalScenarios.js";

let localBusy = false;
const campaignId = () => String(getLibraryState()?.activeGameId ?? "");
const idFor = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const failure = (error) => ({ ok: false, state: null, events: [], error: error?.message || String(error) });

const storageFor = (startedIn) => ({
  // Throws on an invalid character system and leaves its input untouched. The
  // commit writes `next.world` as given: every read normalizes it again.
  validate: (state) => { normalizeWorldState(state.world); },
  assertCurrent: async () => assertCampaignUnchanged(startedIn, campaignId(), "karaktärsbeslut"),
  readSnapshots: async () => {
    const value = await readJson(JSON_URLS.snapshots, { defaultValue: [], force: true, clone: false });
    return Array.isArray(value) ? value : [];
  },
  writeSnapshots: (value) => writeJson(JSON_URLS.snapshots, value, { cacheClone: false, echo: false }),
  write: (key, value, options = {}) => writeJson(JSON_URLS[key], value, { pretty: true, ...options }),
  publish: async (state) => {
    for (const [key, value] of Object.entries({ game: state.game, world: state.world,
      events: state.events, actions: state.actions, chat: state.chat })) {
      if (value !== undefined) primeRuntimeValue(key, value);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("oh:game-updated", { detail: { game: state.game } }));
      window.dispatchEvent(new CustomEvent("oh:characters-updated"));
    }
  },
});

export const getCharacterRuntimeStatus = () => ({ busy: localBusy || isSimulationBusy() });

export const readVisibleCharacterState = async ({ force = false } = {}) => {
  const startedIn = campaignId();
  let bundle = await readGameStateBundle({ force });
  if (bundle.world.characterTransaction && !localBusy && !isSimulationBusy()) {
    await recoverCharacterTransaction(bundle.world, storageFor(startedIn));
    bundle = await readGameStateBundle({ force: true });
  }
  assertCampaignUnchanged(startedIn, campaignId(), "karaktärsvisning");
  return (await viewAsSeen(bundle)).world?.characterSystem ?? null;
};

// Odds for one contested intent on the state the player sees. Read-only: no randomness, no spending, no write.
// Only the result's `display` is for the player; the true values stay for the engine. `revision` names the state
// the odds belong to, so the roll can be sent with it and refused once the world has moved.
export const estimateCharacterActionForView = async (intent) => {
  const state = await readVisibleCharacterState();
  if (!state) return { ok: false, reason: "Kampanjen saknar karaktärssystem." };
  return { ...estimateCharacterAction(state, intent), revision: state.revision };
};

// Odds for one conversation request on the state the player sees. Read-only like the action estimate above:
// only `display` is for the player, and `revision` names the state the odds belong to.
export const estimateConversationForView = async (request) => {
  const state = await readVisibleCharacterState();
  if (!state) return { ok: false, reason: "Kampanjen saknar karaktärssystem." };
  return { ...estimateConversation(state, request), revision: state.revision };
};

// The presentation plus the engine's brief on one person, as the conversation model calls read it (extractConversationRequest, replyAsCharacter).
// Read-only; the brief holds the speaker's secrets as labels, so it goes to the model and never into a stored or displayed view.
export const getConversationViewForModel = async (personId) => {
  const state = await readVisibleCharacterState();
  if (!state) return null;
  return { ...getCharacterPresentation(state), conversationBrief: getConversationBrief(state, personId) };
};

// Odds for one envoy to a foreign realm on the state the player sees. Read-only like the estimates above.
export const estimateEnvoyForView = async (request) => {
  const state = await readVisibleCharacterState();
  if (!state) return { ok: false, reason: "Kampanjen saknar karaktärssystem." };
  return { ...estimateEnvoyRequest(state, request), revision: state.revision };
};

// The presentation plus the engine's brief on one foreign ruler, as the envoy model calls read it (extractEnvoyRequest, replyAsRuler). Read-only.
export const getEnvoyViewForModel = async (realmId) => {
  const state = await readVisibleCharacterState();
  if (!state) return null;
  return { ...getCharacterPresentation(state), envoyBrief: getEnvoyBrief(state, realmId) };
};

// Shared by local decisions and the connected model's completed turn. The
// caller already holds the simulation lock; this commits a complete bundle.
export const commitCharacterCampaign = ({ id, base, next, startedIn = campaignId() }) =>
  commitCharacterTransaction({ id, base, next, io: storageFor(startedIn) });

const withCharacterMutation = async (work) => {
  if (localBusy || isSimulationBusy()) return failure("En tur eller ett annat beslut pågår redan.");
  localBusy = true;
  beginSimulation();
  const startedIn = campaignId();
  const run = async () => {
    try {
      let bundle = await readGameStateBundle({ force: true });
      if (bundle.world.characterTransaction) {
        await recoverCharacterTransaction(bundle.world, storageFor(startedIn));
        bundle = await readGameStateBundle({ force: true });
      }
      if (unseenEvents.unseenFor(bundle.world).size) throw new Error("Läs färdigt den senaste turens händelser före ett nytt beslut.");
      const transition = await work(bundle);
      if (!transition.ok) return transition;
      if (!transition.events.length) return transition;
      assertCampaignUnchanged(startedIn, campaignId(), "karaktärsbeslut");
      const live = await readWorldState({ force: true });
      if ((live.characterSystem?.revision ?? -1) !== (bundle.world.characterSystem?.revision ?? -1)) {
        throw new Error("Världen har ändrats. Läs det nya läget och försök igen.");
      }
      const colors = await readJson(JSON_URLS.colors, { defaultValue: {}, force: true });
      const events = normalizeEvents(transition.events);
      const date = transition.state.date;
      const nextGame = normalizeGameData({ ...bundle.game, gameDate: date,
        round: date === bundle.game.gameDate ? bundle.game.round : Number(bundle.game.round || 1) + 1 });
      const merge = applyEventImpactsToWorld({ world: bundle.world, colors, events,
        motion: { originDate: bundle.game.gameDate, round: nextGame.round, tick: 0 } });
      const turn = { round: nextGame.round, fromDate: bundle.game.gameDate,
        toDate: date, date, mode: "character", summary: events.at(-1).title,
        eventIds: events.map((event) => event.id) };
      const nextWorld = normalizeWorldState({ ...merge.world,
        simulationHistory: [turn, ...(bundle.world.simulationHistory ?? [])].slice(0, 120),
        lastJumpSummary: turn.summary, lastJumpMode: "character", lastJumpTargetDate: date });
      const next = { game: nextGame, world: nextWorld, events: [...bundle.events, ...events],
        actions: bundle.actions, chat: bundle.chats, colors: merge.colors };
      await commitCharacterCampaign({ id: transition.operationId, startedIn,
        base: { game: bundle.game, world: bundle.world, events: bundle.events,
          actions: bundle.actions, chat: bundle.chats, colors }, next });
      return { ok: true, state: nextWorld.characterSystem, events, interruption: transition.interruption ?? null, error: "" };
    } catch (error) { return failure(error); }
  };
  try {
    return globalThis.navigator?.locks?.request
      ? await navigator.locks.request(`open-historia-characters:${startedIn}`, run)
      : await run();
  } finally {
    localBusy = false;
    endSimulation();
  }
};

export const initializeCampaignCharacters = (options = {}) => withCharacterMutation(async (bundle) => {
  if (bundle.world.characterSystem) return { ok: true, state: bundle.world.characterSystem, events: [], error: "" };
  const operationId = idFor("characters-init");
  let state;
  if (bundle.world.historicalScenario != null) {
    const date = bundle.game.gameDate || bundle.game.startDate, polityId = bundle.game.country;
    if ((options.date !== undefined && options.date !== date) || (options.polityId !== undefined && options.polityId !== polityId)) {
      throw new Error("Det historiska hovets datum och rike måste stämma med kampanjen.");
    }
    const regions = await readJson(JSON_URLS.regionsGeojson, { defaultValue: null, force: true });
    const checked = validateHistoricalScenario({ game: bundle.game, world: bundle.world, regions,
      assetManifest: bundle.world.historicalScenario.assetManifest }, { date, polityId });
    if (!checked.ok) throw new Error(checked.error);
    state = createHistoricalCharacterSystem({ historicalScenario: bundle.world.historicalScenario, date, polityId,
      mode: options.mode, familyId: options.familyId, seed: options.seed, difficulty: options.difficulty ?? bundle.game.difficulty });
  } else {
    state = createCharacterSystem({ date: bundle.game.gameDate || bundle.game.startDate,
      polityId: bundle.game.country, polityName: bundle.game.country, ...options });
  }
  const result = { ok: true, state, events: [], error: "" };
  return { ...result, operationId, events: characterTransitionEvents(null, result, operationId) };
});

export const submitCharacterCommand = (command = {}) => withCharacterMutation(async (bundle) => {
  if (!bundle.world.characterSystem) return failure("Kampanjen saknar karaktärssystem.");
  const operationId = command.id || idFor("character-choice");
  // A player command never carries the gate origin, so realm_effect and npc_intent are refused here.
  const result = executeCharacterWorldCommand(bundle.world, { ...command, id: operationId, origin: "player" });
  return result.ok ? { ...result, operationId,
    events: characterTransitionEvents(bundle.world.characterSystem, result, operationId) } : result;
});

// The narrate step's only entry: the one caller that sets origin "narrate", which record_action_narrative requires.
export const recordCharacterNarrative = (payload = {}) => withCharacterMutation(async (bundle) => {
  if (!bundle.world.characterSystem) return failure("Kampanjen saknar karaktärssystem.");
  const operationId = idFor("character-narrative");
  const result = executeCharacterWorldCommand(bundle.world, { id: operationId, type: "record_action_narrative", payload,
    expectedRevision: bundle.world.characterSystem.revision, origin: "narrate" });
  return result.ok ? { ...result, operationId,
    events: characterTransitionEvents(bundle.world.characterSystem, result, operationId) } : result;
});

// The conversation step's only entry: the one place that sets origin "converse", which converse_request and envoy_request require.
// `expectedRevision` is the revision the estimate was made on; without it the current revision is used.
const submitConverseCommand = (type, prefix, request, { id, expectedRevision } = {}) => withCharacterMutation(async (bundle) => {
  if (!bundle.world.characterSystem) return failure("Kampanjen saknar karaktärssystem.");
  const operationId = id || idFor(prefix);
  const result = executeCharacterWorldCommand(bundle.world, { id: operationId, type, payload: request,
    expectedRevision: expectedRevision ?? bundle.world.characterSystem.revision, origin: "converse" });
  return result.ok ? { ...result, operationId,
    events: characterTransitionEvents(bundle.world.characterSystem, result, operationId) } : result;
});
export const submitConversationRequest = (request = {}, options = {}) => submitConverseCommand("converse_request", "character-conversation", request, options);
// An envoy to a foreign ruler (envoys spec) goes through the same step: its words were read from the player's text.
export const submitEnvoyRequest = (request = {}, options = {}) => submitConverseCommand("envoy_request", "character-envoy", request, options);

// Explicit deterministic progression for tests and development. The normal
// campaign button uses the connected model below.
export const advanceCharacterYear = () => withCharacterMutation(async (bundle) => {
  if (!bundle.world.characterSystem) return failure("Kampanjen saknar karaktärssystem.");
  if (bundle.world.characterSystem.status?.ended) return failure(bundle.world.characterSystem.status.reason || "Kampanjen är avslutad.");
  const operationId = idFor("character-year");
  const result = planCharacterAdvance(bundle.world, addGameMonths(bundle.world.characterSystem.date, 12), {
    id: operationId, pauseForHealthDecisions: true, pauseForCharacterDecisions: true, watches: readCharacterWatches(campaignId()) });
  return { ok: true, ...result, operationId, error: "" };
});

export const advanceCharacterYearWithModel = async () => {
  if (localBusy || isSimulationBusy()) return failure("En tur pågår redan.");
  localBusy = true;
  try {
    const startedIn = campaignId();
    let bundle = await readGameStateBundle({ force: true });
    if (bundle.world.characterTransaction) {
      await recoverCharacterTransaction(bundle.world, storageFor(startedIn));
      bundle = await readGameStateBundle({ force: true });
    }
    if (!bundle.world.characterSystem) return failure("Kampanjen saknar karaktärssystem.");
    if (bundle.world.characterSystem.status?.ended) return failure(bundle.world.characterSystem.status.reason || "Kampanjen är avslutad.");
    if (unseenEvents.unseenFor(bundle.world).size) return failure("Läs färdigt den senaste turens händelser först.");
    const target = addGameMonths(bundle.game.gameDate, 12);
    const days = diffGameDays(bundle.game.gameDate, target);
    const { simulateTimelineJump } = await import("../Game/AI/gameplayLazy.js");
    if (isSimulationBusy()) return failure("En annan tur har startat. Vänta tills den är klar.");
    const turn = await simulateTimelineJump({ days, mode: "jump" });
    assertCampaignUnchanged(startedIn, campaignId(), "modellgenererad tur");
    const next = await readGameStateBundle({ force: true });
    const ids = latestTurnEventIds(next.world);
    // This panel shows the completed yearly record together. The timeline's
    // own advance controls retain their ordinary event-by-event reveal.
    unseenEvents.markSeenThrough(ids, ids.length);
    return { ok: true, state: next.world.characterSystem,
      events: next.events.filter((event) => ids.includes(event.id)), interruption: turn.interruption ?? null, error: "" };
  } catch (error) { return failure(error); }
  finally { localBusy = false; }
};

export const revealLatestCharacterTurn = async () => {
  if (localBusy || isSimulationBusy()) return failure("En tur pågår redan.");
  localBusy = true;
  try {
    const startedIn = campaignId();
    let bundle = await readGameStateBundle({ force: true });
    if (bundle.world.characterTransaction) {
      await recoverCharacterTransaction(bundle.world, storageFor(startedIn));
      bundle = await readGameStateBundle({ force: true });
    }
    assertCampaignUnchanged(startedIn, campaignId(), "visning av senaste turen");
    if (!bundle.world.characterSystem) return failure("Kampanjen saknar karaktärssystem.");
    const ids = latestTurnEventIds(bundle.world);
    unseenEvents.markSeenThrough(ids, ids.length);
    return { ok: true, state: bundle.world.characterSystem,
      events: bundle.events.filter((event) => ids.includes(event.id)), error: "" };
  } catch (error) { return failure(error); }
  finally { localBusy = false; }
};

// Character rules are authoritative; this adapter connects their results to the
// existing world, timeline and map. It has no I/O and is also used for replay.
import {
  advanceCharacters,
  applyRealmDissolution,
  canCharacterDirectRealm,
  executeCharacterCommand,
  getCharacterWorldEffects,
  getCharacterPresentation,
  getNextCharacterTransitionDate,
  normalizeCharacterSystem,
  reconcileExternalHosts,
} from "./characters/index.js";
import { ACTION_CATALOG } from "./characters/actionCatalog.js";
import { compareGameDates, diffGameDays, normalizeGameDate } from "./gameDates.js";
import { buildOwnerAliasMap, createOwnerResolver } from "./ownerNames.js";

const copy = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const forbiddenPath = new Set(["__proto__", "constructor", "prototype"]);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// An exile destination must already exist in the host's polity registry. A
// proposal or a family name is not evidence that a foreign state exists.
export const getExternalCharacterHosts = (world) => {
  const resolve = createOwnerResolver(buildOwnerAliasMap(world.polityOverrides));
  const origin = resolve(world.characterSystem?.identity.polityId);
  const candidates = new Map();
  for (const [key, entry] of Object.entries(world.polityOverrides ?? {})) {
    const id = resolve(key);
    if (!id || id === origin || ["dissolved", "dormant"].includes(entry.status)) continue;
    candidates.set(id, { id, name: entry.name || id, opinion: 0, refugeThreshold: 55, admissionCost: 20 });
  }
  return [...candidates.values()].sort((a, b) => a.id.localeCompare(b.id));
};

export const assertCharacterModelGeneration = (world, generation) => {
  if (!world?.characterSystem || (generation?.source === "ai" && !String(generation.fallbackReason ?? "").trim())) return;
  const reason = generation?.fallbackReason || "Modellen returnerade inget användbart, validerat svar.";
  throw new Error(`Modellåret avbröts utan att flytta tiden eller ändra karaktärerna. ${reason}`);
};

export const executeCharacterWorldCommand = (world, command) => {
  const state = world.characterSystem;
  if (command.type === "seek_refuge" && !state?.appliedCommandIds?.includes(command.id)
    && !getExternalCharacterHosts(world).some((host) => host.id === command.payload?.polityId)) {
    return { ok: false, state, events: [], error: "Det valda värdriket finns inte längre som ett aktivt rike i världen." };
  }
  return executeCharacterCommand(state, command);
};

const stableHostKey = (value) => {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return (hash >>> 0).toString(36);
};

// Only accepted host state can end a realm. Merely proposing dissolution or
// occupying all its land leaves the legal state and its offices intact.
export const reconcileCharacterPolity = (world, event) => {
  if (!world.characterSystem) return { world, events: [] };
  let next = projectCharacterWorld(world);
  let state = next.characterSystem;
  const origin = state.identity.polityId;
  const dissolved = next.polityOverrides?.[origin]?.status === "dissolved";
  if (state.realm.alive && !dissolved) return { world: next, events: [] };
  const events = [];
  const hostCandidates = getExternalCharacterHosts(next);
  const resolve = createOwnerResolver(buildOwnerAliasMap(next.polityOverrides));
  const hostAliases = Object.fromEntries(Object.values(state.families)
    .filter((family) => family.hostPolityId)
    .map((family) => [family.hostPolityId, resolve(family.hostPolityId)]));
  let result;
  let operationId;
  if (state.realm.alive) {
    const date = normalizeGameDate(event.date) || state.date;
    if (compareGameDates(date, state.date) < 0) throw new Error("Rikets upplösning ligger före karaktärernas aktuella datum.");
    const calendar = planCharacterAdvance(next, date);
    state = calendar.state;
    next = { ...next, characterSystem: state };
    events.push(...calendar.events.map((entry) => ({ ...entry, impacts: {} })));
    // Event IDs are allocated after planning. Identity/date remain stable in
    // the final log, during staged reveal, and on same-event retries.
    operationId = `character-dissolution:${stableHostKey(origin)}:${state.date}`;
    result = applyRealmDissolution(state, { id: operationId, date: state.date,
      reason: event.description || event.title || "Statsbildningen har upphört.", hostCandidates });
  } else {
    operationId = `character-host-context:${stableHostKey(origin)}:${state.date}:${state.revision}`;
    result = reconcileExternalHosts(state, { id: operationId, date: state.date, hostCandidates, hostAliases });
  }
  if (!result.ok) throw new Error(result.error || "Rikets upplösning kunde inte behandlas.");
  events.push(...characterTransitionEvents(state, result, operationId)
    .map((entry) => ({ ...entry, impacts: {} })));
  return { world: projectCharacterWorld({ ...next, characterSystem: result.state }), events };
};

// Append-only memories/logs are cheap deltas. Replacing a whole state on every
// event made a century of history recur inside every rollback copy.
export const diffCharacterState = (before, after, path = [], output = []) => {
  if (JSON.stringify(before) === JSON.stringify(after)) return output;
  if (Array.isArray(before) && Array.isArray(after)) {
    for (let i = 0; i < Math.min(before.length, after.length); i++) diffCharacterState(before[i], after[i], [...path, i], output);
    if (after.length < before.length) output.push({ path, truncate: after.length });
    if (after.length > before.length) output.push({ path, append: copy(after.slice(before.length)) });
  } else if (record(before) && record(after)) {
    for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) output.push({ path: [...path, key], remove: true });
    for (const key of Object.keys(after)) diffCharacterState(before[key], after[key], [...path, key], output);
  } else output.push({ path, value: copy(after) });
  return output;
};

const applyStatePatch = (state, changes) => {
  const next = copy(state);
  for (const change of changes) {
    let holder = next;
    for (const key of change.path.slice(0, -1)) {
      if (!holder || typeof holder !== "object" || !Object.hasOwn(holder, key)) throw new Error("Karaktärshistoriken pekar på ett saknat fält.");
      holder = holder[key];
    }
    const key = change.path.at(-1);
    if (!holder || typeof holder !== "object") throw new Error("Karaktärshistorikens fält är ogiltigt.");
    if (change.remove) delete holder[key];
    else if (Object.hasOwn(change, "truncate")) {
      if (!Array.isArray(holder[key])) throw new Error("Karaktärshistoriken förväntade en lista.");
      holder[key].length = change.truncate;
    } else if (change.append) {
      if (!Array.isArray(holder[key])) throw new Error("Karaktärshistoriken förväntade en lista.");
      holder[key].push(...copy(change.append));
    } else holder[key] = copy(change.value);
  }
  return normalizeCharacterSystem(next);
};

export const normalizeCharacterOps = (value) => (Array.isArray(value) ? value : [])
  .filter((op) => op && typeof op === "object" && typeof op.id === "string" && op.id.length <= 240)
  .flatMap((op) => {
    if (op.kind === "patch") {
      if (!Number.isInteger(op.fromRevision) || !Number.isInteger(op.toRevision)
        || op.toRevision <= op.fromRevision || !Array.isArray(op.changes) || op.changes.length > 50000) return [];
      const changes = op.changes.filter((change) => Array.isArray(change?.path) && change.path.length > 0
        && change.path.length < 20 && change.path.every((part) => (typeof part === "string" || Number.isInteger(part)) && !forbiddenPath.has(String(part)))
        && (Object.hasOwn(change, "value") || change.remove === true || Array.isArray(change.append)
          || (Number.isInteger(change.truncate) && change.truncate >= 0)));
      if (changes.length !== op.changes.length) throw new Error("Karaktärshistoriken innehåller en ogiltig förändring.");
      return [{ id: op.id, kind: "patch", ...(op.gate === true ? { gate: true } : {}),
        fromRevision: op.fromRevision, toRevision: op.toRevision, changes: copy(changes) }];
    }
    if (op.kind === "checkpoint") {
      // Checkpoints are emitted by the local reducer, never accepted from model
      // output. Preserve them exactly for export, rollback and staged reveal.
      const state = normalizeCharacterSystem(op.state);
      return state && Number.isInteger(op.fromRevision)
        ? [{ id: op.id, kind: "checkpoint", fromRevision: op.fromRevision, state }]
        : [];
    }
    if (op.kind === "command" && typeof op.type === "string") {
      let payload = op.payload;
      if (!payload && typeof op.payloadJson === "string" && op.payloadJson.length < 8000) {
        try { payload = JSON.parse(op.payloadJson); } catch { return []; }
      }
      return [{ id: op.id, kind: "command", type: op.type,
        expectedRevision: Number(op.expectedRevision),
        payload: payload && typeof payload === "object" && !Array.isArray(payload) ? copy(payload) : {} }];
    }
    return [];
  });

// The only writer of the character polity's leader, stability, treasury and
// military readiness in the host world. Model polityChanges.stats for these
// fields are overwritten here; a model changes them only through the gate
// command realm_effect (prepareCharacterTimeline).
export const projectCharacterWorld = (world) => {
  if (!world?.characterSystem) return world;
  const state = normalizeCharacterSystem(world.characterSystem);
  // Open Historia keys polities by their current owner name. Follow its
  // validated alias migration while retaining every person/family identity.
  const owner = createOwnerResolver(buildOwnerAliasMap(world.polityOverrides))(state.identity.polityId);
  if (owner && owner !== state.identity.polityId) {
    state.identity.polityId = owner;
    state.realm.id = owner;
    state.realm.name = owner;
  }
  const effect = getCharacterWorldEffects(state);
  const polity = effect.polityId;
  if (state.realm.alive === false || world.polityOverrides?.[polity]?.status === "dissolved") {
    const countryStats = { ...(world.countryStats ?? {}) };
    if (world.polityOverrides?.[polity]?.status === "dissolved") delete countryStats[polity];
    const cityIds = new Set(Object.values(state.cities).map((city) => city.id));
    const markers = (world.markers ?? []).map((marker) => cityIds.has(marker.id)
      ? { ...marker, note: String(marker.note ?? "").split(/\n?\[Familjepolitik\]/)[0] } : marker);
    return { ...world, characterSystem: state, characterEconomy: effect, countryStats, markers,
      characterWorldBindings: { units: {}, revision: state.revision } };
  }
  const previous = world.characterWorldBindings ?? { units: {} };
  const bindings = { units: {}, revision: effect.revision };
  const currentSheet = world.countryStats?.[polity] ?? {};
  // Absolute values, not repeated bonuses. Custom figures retain their units
  // (talents and production) instead of pretending ancient output is modern GDP.
  const countryStats = {
    ...(world.countryStats ?? {}),
    [polity]: {
      ...currentSheet,
      leader: effect.leaderName,
      stability: clamp(effect.legitimacy, 0, 100),
      customStats: {
        ...(currentSheet.customStats ?? {}),
        treasury: effect.treasury,
        annualRevenue: effect.annualRevenue,
        production: Math.round(effect.productionMultiplier * 100),
        militaryReadiness: effect.militaryReadiness,
        orders: effect.orders,
      },
    },
  };
  const units = (world.units ?? []).map((unit) => {
    if (String(unit.ownerCode).toLowerCase() !== String(polity).toLowerCase()) return unit;
    const stored = previous.units?.[unit.id];
    const base = stored && Number(unit.strength) === stored.projected
      ? stored.base : Number(unit.strength) || 100;
    const projected = Math.round(clamp(base * clamp(effect.militaryReadiness, 0, 100) / 100, 1, 100));
    bindings.units[unit.id] = { base, projected };
    return { ...unit, strength: projected };
  });
  const cities = effect.cityEffects ?? [];
  const markers = (world.markers ?? []).map((marker) => {
    const city = cities.find((entry) => entry.id === marker.id || (entry.regionId && entry.regionId === marker.regionId));
    if (!city) return marker;
    const baseNote = String(marker.note ?? "").split(/\n?\[Familjepolitik\]/)[0];
    return { ...marker, note: `${baseNote}\n[Familjepolitik] Produktion ${Math.round(city.productionMultiplier * 100)} %, skatt ${city.taxIncome}, oro ${Math.round(city.unrest)} %.`.trim() };
  });
  return { ...world, characterSystem: state, characterWorldBindings: bindings,
    characterEconomy: effect, countryStats, units, markers };
};

// Commands stored in an event run only for the engine's own events and the
// Game Master console. A stored model ("ai") event never executes one, also on
// replay: model proposals reach the state only through prepareCharacterTimeline.
// The one patch a model event may carry is the gate's quiet patch, which
// prepareCharacterTimeline writes there after emptying the model's own
// characterOps (the model's schema allows only commands).
const COMMAND_SOURCES = new Set(["character-system", "game-master"]);

export const applyCharacterOpsToWorld = (world, operations, { source = "" } = {}) => {
  let next = world;
  for (const op of normalizeCharacterOps(operations)) {
    if (op.kind === "patch") {
      if (source !== "character-system" && op.gate !== true) continue;
      // A gate patch belongs to a character system; a world without one has nothing to patch.
      if (op.gate === true && !next.characterSystem) continue;
      const revision = next.characterSystem?.revision ?? -1;
      if (revision >= op.toRevision) continue;
      if (revision !== op.fromRevision) throw new Error("Karaktärshändelsen bygger på en annan världsversion.");
      const state = applyStatePatch(next.characterSystem, op.changes);
      if (state.revision !== op.toRevision) throw new Error("Karaktärshistorikens revision stämmer inte.");
      next = { ...next, characterSystem: state };
    } else if (op.kind === "checkpoint") {
      if (source !== "character-system") continue;
      const revision = next.characterSystem?.revision ?? -1;
      if (revision >= op.state.revision) continue;
      if (revision !== op.fromRevision) throw new Error("Karaktärshändelsen bygger på en annan världsversion.");
      next = { ...next, characterSystem: op.state };
    } else if (!COMMAND_SOURCES.has(source)) {
      console.warn(`[character gate] skipped command "${op.type}" from a "${source || "unknown"}" event.`);
    } else if (next.characterSystem) {
      const result = executeCharacterWorldCommand(next, op);
      if (result.ok) next = { ...next, characterSystem: result.state };
    }
  }
  return projectCharacterWorld(next);
};

export const characterTransitionEvents = (before, result, operationId) => {
  if (!result.ok) throw new Error(result.error || "Karaktärsbeslutet kunde inte genomföras.");
  if (before && JSON.stringify(before) === JSON.stringify(result.state)) return [];
  const events = (result.events ?? []).filter((event) => event.public !== false).map((event, index) => ({
    id: `${operationId}:${index}`, date: event.date || result.state.date,
    title: event.title || "Familjerna och riket", description: event.description || "",
    source: "character-system", kind: "world", tags: ["Politics"],
    importance: ["death", "succession", "coup"].includes(event.type) ? "major" : "minor",
    playerRelated: true, impacts: {},
  }));
  if (!events.length) events.push({ id: `${operationId}:0`, date: result.state.date,
    title: before ? "Rikets förvaltning" : "En ny dynastisk kampanj",
    description: before ? "Förvaltningen och familjernas tillstånd har uppdaterats." : "Personer, familjer och ämbeten har tagit plats i världen.",
    source: "character-system", kind: "world", tags: ["Politics"], playerRelated: true, impacts: {} });
  // One annual/decision transition is atomic. Its preceding narrative cards do
  // not reveal a later checkpoint; all outcomes become visible at the last card.
  const checkpoint = { id: operationId, kind: "checkpoint", fromRevision: before?.revision ?? -1, state: result.state };
  const patch = before ? { id: operationId, kind: "patch", fromRevision: before.revision,
    toRevision: result.state.revision, changes: diffCharacterState(before, result.state) } : null;
  // An unusually large initial relationship expansion can be smaller as one
  // checkpoint than hundreds of individual paths. Choose the compact encoding.
  events.at(-1).impacts.characterOps = [patch && JSON.stringify(patch).length < JSON.stringify(checkpoint).length ? patch : checkpoint];
  return events;
};

export const planCharacterAdvance = (world, targetDate, { id = "character-calendar", quietDateSync = false,
  pauseForHealthDecisions = false, pauseForCharacterDecisions = false, requestedDate = targetDate } = {}) => {
  if (!world?.characterSystem) return { state: null, events: [] };
  let state = normalizeCharacterSystem(world.characterSystem);
  const target = normalizeGameDate(targetDate);
  if (!target) throw new Error("Ogiltigt speldatum.");
  if (state.status?.ended || compareGameDates(target, state.date) <= 0) return { state, events: [] };
  if (diffGameDays(state.date, target) > 366 * 500) throw new Error("Dela upp tidshopp som är längre än 500 år.");
  const events = [];
  const knownCare = new Set(state.stories.filter((story) => story.type === "health_care").map((story) => story.id));
  const knownStories = new Set(state.stories.filter((story) => ["character_event", "event_chain"].includes(story.type)).map((story) => story.id));
  let checkpointBase = state;
  let steps = 0;
  while (compareGameDates(state.date, target) < 0) {
    if (++steps > 100000) throw new Error("Dela upp långa tidshopp med många karaktärshändelser.");
    const boundary = getNextCharacterTransitionDate(state, target);
    if (!boundary) throw new Error("Karaktärskalendern saknar nästa giltiga datum.");
    const operationId = `${id}:${boundary}`;
    const result = advanceCharacters(state, boundary, { id: operationId });
    const annualBoundary = state.nextAnnualDate && compareGameDates(result.state.date, state.nextAnnualDate) >= 0;
    // Health phases have their own dates. Emit their state at that date; fold
    // silent boundaries into the next real event instead of adding routine
    // cards or attaching a later recovery to an earlier illness card.
    if ((!quietDateSync && boundary === target) || annualBoundary || result.events?.some((entry) => entry.public !== false)) {
      events.push(...characterTransitionEvents(checkpointBase, result, operationId));
      checkpointBase = result.state;
    }
    if (result.state.date === state.date) throw new Error(result.error || "Kalendern kunde inte gå framåt.");
    state = result.state;
    if (state.status?.ended) break;
    const storyIds = state.stories.filter((story) => story.type === "health_care" && story.status === "open"
      && !knownCare.has(story.id)).map((story) => story.id);
    if (pauseForHealthDecisions && storyIds.length && compareGameDates(state.date, requestedDate) < 0) {
      return { state, events, interruption: { type: "health-care", date: state.date, storyIds,
        requestedDate: normalizeGameDate(requestedDate),
        message: "Turen stannade tidigare eftersom en ny sjukdom kräver ditt vårdbeslut. Välj vård i Rike & familjer innan du fortsätter." } };
    }
    const newStories = state.stories.filter((story) => ["character_event", "event_chain"].includes(story.type) && story.status === "open"
      && !knownStories.has(story.id)).map((story) => story.id);
    if (pauseForCharacterDecisions && newStories.length && compareGameDates(state.date, requestedDate) < 0) {
      return { state, events, interruption: { type: "character-story", date: state.date, storyIds: newStories,
        requestedDate: normalizeGameDate(requestedDate),
        message: "Turen stannade vid en ny karaktärshändelse. Välj hur du vill agera under Beslut i Rike & familjer innan du fortsätter." } };
    }
  }
  return { state, events };
};

// Resolve the playable horizon before asking a model. Its summary, ledger,
// outreach and auxiliary review must all describe this same shorter period.
export const planCharacterTurnHorizon = (world, targetDate) => {
  const calendar = planCharacterAdvance(world, targetDate, { pauseForHealthDecisions: true, pauseForCharacterDecisions: true });
  return { targetDate: calendar.state?.date || targetDate, interruption: calendar.interruption ?? null };
};

export const assertCharacterTurnHorizon = (state, modelStopDate, interruption) => {
  if (interruption && compareGameDates(state.date, modelStopDate) < 0) {
    throw new Error("Världshändelserna flyttade beslutet till ett tidigare datum. Modellsvaret omfattar tiden efter beslutet och har inte sparats. Försök med ett kortare tidshopp.");
  }
};

// A model event itself carries a deterministic date-only clock step. Applying
// and replaying that event use the same calendar IDs; no extra visible card or
// model-authored character checkpoint is required. Annual changes retain their
// explicit character events and are already applied before the model event.
export const synchronizeCharacterEventDate = (world, event) => {
  if (!world.characterSystem || event.source === "character-system" || !event.date
    || compareGameDates(event.date, world.characterSystem.date) <= 0) return { world, events: [] };
  const result = planCharacterAdvance(world, event.date, { quietDateSync: true });
  return { world: { ...world, characterSystem: result.state }, events: result.events };
};

export const getCharacterEventBudget = (fromDate, targetDate) => {
  const days = Math.max(1, diffGameDays(fromDate, targetDate) || 1);
  return Math.min(24, Math.max(8, Math.ceil(days / 366) * 8));
};

// Model proposals the engine runs itself, with their caps per model turn.
const GATE_LIMITS = Object.freeze({ realm_effect: 4, npc_intent: 3 });
const GATE_LABELS = Object.freeze({ realm_effect: "Förändring av rikets läge", npc_intent: "Egen handling av en annan familjs person" });
// An npc_intent refusal names no actor, action or amount: its reason could reveal another family's plans.
const NPC_INTENT_REFUSAL = "Ett förslag om en annan familjs handling avvisades.";

// Runs one model event's gate proposals with origin "gate". `turn` holds the
// counts and proposal ids of the whole model turn. An accepted result with a
// public event becomes a character-system card carrying its patch, so replay
// applies the result and never rolls again. A quiet result (an NPC tier the
// player may not see, a silent scheme start) adds no card: it folds into the
// next card of this event or into its last one. When the event has no card,
// the quiet patch rides on the model event itself (carrierOps), marked gate.
// Refusals become one visible notice.
const runGateProposals = (world, event, date, proposals, turn) => {
  let current = world;
  let base = world.characterSystem;
  let last = null;
  const events = [];
  const refusals = [];
  proposals.forEach((op, index) => {
    const label = GATE_LABELS[op.type];
    turn.counts[op.type] = (turn.counts[op.type] ?? 0) + 1;
    if (turn.counts[op.type] > GATE_LIMITS[op.type]) {
      refusals.push(`${label}: gränsen på ${GATE_LIMITS[op.type]} sådana förslag per tur är nådd.`);
      return;
    }
    if (turn.ids.has(op.id)) {
      refusals.push(`${label}: samma förslag fanns redan i turen.`);
      return;
    }
    turn.ids.add(op.id);
    const before = current.characterSystem;
    // The date and revision keep the id unique across turns, whatever id the model gave.
    const id = `${event.id}:gate:${date}:r${before.revision}:${index}`;
    const result = executeCharacterWorldCommand(current, { id, type: op.type, payload: op.payload, origin: "gate", expectedRevision: before.revision });
    if (!result.ok) {
      refusals.push(op.type === "npc_intent" ? NPC_INTENT_REFUSAL : `${label}: ${result.error}`);
      return;
    }
    if (result.duplicate) {
      refusals.push(`${label}: förslaget har redan prövats.`);
      return;
    }
    current = { ...current, characterSystem: result.state };
    if (result.events?.some((entry) => entry.public !== false)) {
      last = { start: events.length, base, result, id };
      events.push(...characterTransitionEvents(base, result, id));
      base = result.state;
    }
  });
  const carrierOps = [];
  if (base !== current.characterSystem) {
    const from = world.characterSystem;
    if (last) {
      events.splice(last.start, Infinity, ...characterTransitionEvents(last.base, { ...last.result, state: current.characterSystem }, last.id));
    } else {
      carrierOps.push({ id: `${event.id}:gate-quiet:${date}:r${from.revision}`, kind: "patch", gate: true,
        fromRevision: from.revision, toRevision: current.characterSystem.revision, changes: diffCharacterState(from, current.characterSystem) });
    }
  }
  if (refusals.length) {
    events.push({ id: `${event.id}:gate-refusals:${date}:r${current.characterSystem.revision}`, date, source: "character-system", kind: "world", tags: ["Politics"], playerRelated: true,
      title: "Modellens förslag avvisades",
      description: `Motorn prövade modellens förslag och avvisade ${refusals.length === 1 ? "ett" : refusals.length}. ${refusals.join(" ")}`,
      impacts: {} });
  }
  return { world: current, events, carrierOps };
};

// Convert model proposals into validated, reproducible transitions. No model
// supplied checkpoint, identity, death or resource balance is authoritative.
export const prepareCharacterTimeline = (world, events, targetDate, { applyHostEvent, onComplete,
  pauseForHealthDecisions = false, pauseForCharacterDecisions = false } = {}) => {
  if (!world?.characterSystem) return events;
  let current = world;
  const stop = normalizeGameDate(targetDate || world.characterSystem.date);
  if (!stop || compareGameDates(stop, world.characterSystem.date) < 0) {
    throw new Error("Modellens slutdatum ligger före karaktärsvärldens nuvarande datum.");
  }
  const output = [];
  const turn = { counts: {}, ids: new Set() };
  for (const event of [...events].sort((a, b) => compareGameDates(a.date, b.date))) {
    if (current.characterSystem.status?.ended) break;
    const eventDate = normalizeGameDate(event.date) || current.characterSystem.date;
    if (compareGameDates(eventDate, current.characterSystem.date) < 0 || compareGameDates(eventDate, stop) > 0) {
      throw new Error("En modellhändelse ligger utanför den aktuella turens datum. Inga karaktärsföljder har sparats.");
    }
    const calendar = planCharacterAdvance(current, eventDate, { quietDateSync: true,
      pauseForHealthDecisions, pauseForCharacterDecisions, requestedDate: stop });
    output.push(...calendar.events);
    current = { ...current, characterSystem: calendar.state };
    if (calendar.interruption) {
      onComplete?.(calendar.state, { interruption: calendar.interruption });
      return output;
    }
    if (current.characterSystem.status?.ended) break;
    const proposals = normalizeCharacterOps((event.impacts?.characterOps ?? []).filter((op) => op?.kind === "command"));
    const effects = { ...event.impacts, characterOps: [] };
    const stateOrderFields = ["unitOps", "polityChanges", "regionTransfers", "regionControlOps",
      "regionClaims", "groupOps", "markerOps", "projectOps", "spyOps"];
    const refusedStateOrder = !canCharacterDirectRealm(current.characterSystem)
      && (effects.actionIds?.length ?? 0) > 0
      && stateOrderFields.some((field) => (effects[field]?.length ?? 0) > 0);
    if (refusedStateOrder) for (const field of stateOrderFields) effects[field] = [];
    const hostEvent = { ...event, source: event.source === "character-system" ? "ai" : event.source,
      ...(refusedStateOrder ? { title: "Familjen saknar mandat för statsordern",
        description: "Förslaget kunde inte verkställas: familjens företrädare har inte härskarens eller regentens mandat. Familjens egna politiska handlingar prövas enligt sina regler." } : {}),
      impacts: effects };
    const hostIndex = output.push(hostEvent) - 1;
    // The host validates territorial settlement and polity lifecycle before
    // later character proposals. This same operation runs on timeline replay.
    if (applyHostEvent) {
      const applied = applyHostEvent(current, hostEvent);
      current = applied.world;
      output.push(...(applied.characterEvents ?? []));
    }
    if (current.characterSystem.status?.ended) break;
    const gated = runGateProposals(current, event, eventDate, proposals.filter((op) => Object.hasOwn(GATE_LIMITS, op.type)), turn);
    current = gated.world;
    // Replay applies an event's characterOps after its other impacts, the same
    // point where the gate ran here.
    if (gated.carrierOps.length) output[hostIndex] = { ...hostEvent, impacts: { ...hostEvent.impacts, characterOps: gated.carrierOps } };
    output.push(...gated.events);
    if (current.characterSystem.status?.ended) break;
    if (proposals.some((op) => !Object.hasOwn(GATE_LIMITS, op.type))) {
      output.push({ id: `${event.id}:character-proposals`, date: eventDate,
        source: "character-system", kind: "world", tags: ["Politics"], playerRelated: true,
        title: "Förslaget kräver ditt beslut",
        description: "Modellens förslag har inte genomförts. Välj motsvarande handling i Rike & familjer för att använda familjens eller rikets resurser. Modellen får inte fatta spelarens personliga beslut.",
        impacts: {} });
    }
  }
  const tail = planCharacterAdvance(current, stop, { pauseForHealthDecisions, pauseForCharacterDecisions });
  output.push(...tail.events);
  onComplete?.(tail.state, { interruption: tail.interruption ?? null });
  return output;
};

export const buildCharacterPromptContext = (state, { targetDate = "" } = {}) => {
  if (!state) return "";
  const view = getCharacterPresentation(state);
  const blocks = [
    "[Character simulation — authoritative rules]",
    "This campaign has persistent people, families, offices, memories and succession. The local rule engine controls life, death, ownership, stress and resources. Do not invent a ruler, heir, death, office transfer or character balance in prose or polityChanges.stats.leader.",
    "Health conditions, recovery, lasting scars and portrait appearance are also canonical engine facts. Describe the actual dated health events supplied in the calendar forecast and their wider consequences; do not invent an infection, injury, cure, scar or health score. Medical care remains a player choice in the character panel. There is no free-form health mutation or model-executed care action. Appearance reflects the condition's current phase, not its later outcome.",
    "The player chooses and executes personal political actions directly in the character panel before a simulation turn. Do not spend the player's treasury or family wealth, resolve their stories, marry their representative, change their offices or issue their character commands. The model never acts for the player's own characters.",
    "impacts.characterOps may carry two engine-gated proposals. The engine validates each one, rolls where the rules roll, and may refuse it; a refusal is shown to the player. (1) realm_effect payload {treasury, legitimacy, armyStrength, reason}: integer changes, each optional, at least one non-zero, within treasury -80…+40, legitimacy -10…+5, armyStrength -15…+10. A value outside its range refuses the whole proposal; the realm's fields stop at their bounds. reason is a Swedish sentence of at most 200 characters. At most 4 per turn. (2) npc_intent payload {actorId, actionId, targetIds}: a living adult who is neither the player's representative nor a member of the player's family attempts one contested catalog action listed below, with the engine's odds for that NPC. The NPC's own family pays; targets may include the player's people. At most 3 per turn. Give each proposal an id that is unique within the turn; the engine refuses a repeated id across the whole turn.",
    "All other command types in impacts.characterOps are advisory proposals only and are NEVER executed automatically, even with a claimed player action ID. Keep them out normally; describe such an action as a proposal awaiting the player's decision. Calendar progression itself handles autonomous NPC characters, births, death and succession.",
    "The player's polity ends only through an event that settles its mapped territory: it held a region before the event and holds none after it. A bare dissolve of that polity is refused.",
    "Realm mode follows the government. Family mode follows its own family, which has no right to issue state orders after losing the governing role. Independent relatives do not confer direct state control. Unknown facts are unavailable.",
    "A dissolved realm has no government or public revenue. Its family may continue as a household without commanding a conqueror. Foreign refuge is possible only through a currently existing candidate and an accepted seek_refuge action; do not invent a host state, an automatic welcome or a replacement heir. Loss of territorial control alone is not dissolution: use the host's explicit polity lifecycle and settle sovereignty first.",
    JSON.stringify({ date: view.date, mode: view.mode, playerCanDirectRealm: canCharacterDirectRealm(state), ruler: view.ruler,
      realmExists: state.realm.alive, status: state.status, externalHosts: state.externalHosts,
      representative: view.representative, economy: view.economy, succession: view.succession,
      families: view.families, offices: view.offices, people: view.people,
      actions: view.actions, stories: view.stories, memories: view.memories?.slice(-16),
      contestedActions: Object.values(ACTION_CATALOG).map((entry) => ({ id: entry.id, label: entry.label, durationMonths: entry.durationMonths,
        target: `exactly one living adult other than the actor${entry.targetFamily === "other" ? ", outside the actor's family" : ""}` })) }),
  ];
  if (targetDate && compareGameDates(targetDate, state.date) > 0) {
    blocks.push("[Character campaign timeline pacing]",
      `Aim for 4–8 meaningful AI world events per year, with an absolute maximum of ${getCharacterEventBudget(state.date, targetDate)} AI events in this entire jump. Combine routine administration into a concise period summary. Do not create filler meetings, monthly accounting or repeated implementation updates. The character engine supplies its own life events and annual economic results; do not duplicate them or invent character mutations to meet a quota. Fewer events are appropriate when less happened.`);
    const forecast = planCharacterAdvance({ characterSystem: state }, targetDate, { pauseForHealthDecisions: true, pauseForCharacterDecisions: true });
    const outcome = getCharacterWorldEffects(forecast.state);
    blocks.push("[Calendar forecast for this simulation request only]",
      "The deterministic engine will supply these dated character developments. Do not duplicate them or invent contradictory deaths/heirs. They are conditional on no intervening character command; proposals that change the conditions are resolved by the engine after this response. Describe wider world consequences, and describe proposed family actions as proposals. This forecast is not player-visible advance knowledge.",
      "A newly opened health-care or recurring character decision ends the playable period at its date. Do not narrate or apply anything after that stop: the player must be able to decide before later outcomes. The engine selects recurring events from current roles, personality and causal memories; do not invent or resolve them.",
      JSON.stringify({ targetDate: forecast.state.date, requestedDate: targetDate,
        interruption: forecast.interruption ?? null, leaderAtEnd: outcome.leaderName,
        developments: forecast.events.map(({ date, title, description }) => ({ date, title, description })) }));
  }
  return blocks.join("\n");
};

import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { ACTION_CATALOG, MAX_EXTRA_SILVER } from './actionCatalog.js';
import { estimateAction } from './actionOdds.js';
import { resolutionVisible, resolveScheme } from './actionResolution.js';
import { STAFF_ROLES } from './courtStaff.js';
import { actionRandom } from './extensions.js';

// Schemes: contested actions that take months. A scheme is paid and ordered when it starts, checked for discovery once a month, and rolled like any other action when its due date comes (actionResolution.js records that resolution).
// Randomness comes only from actionRandom (state.actionRngState): one draw per discovery check, then the two rolls of the resolution. The main stream state.rngState is never touched.
// actionResolution.js imports startScheme from here and this file imports from it, so nothing at the top level of either file may use the other's exports; they are only used inside functions.

// Each check the target may see through the plan: chance = clamp(10 + target intrigue × 2 − actor intrigue, 3, 40) percent.
const DISCOVERY = Object.freeze({ base: 10, perIntrigue: 2, min: 3, max: 40 });
const DISCOVERY_OPINION = -20;
const SCHEME_STATUSES = Object.freeze(['active', 'discovered', 'aborted', 'failed', 'resolved']);
// charge() prices stress per tag and gives 0 for a tag it does not know, so a reinforcement adds no stress.
const REINFORCE_TAG = 'scheme_reinforce';
// The price was paid when the scheme started, so the wallet must not be able to refuse the estimate at the due date. estimateAction reads a non-finite wallet as 0, hence a finite ceiling.
const PAID = Number.MAX_SAFE_INTEGER;

const MESSAGES = Object.freeze({
  unknown: 'Planen finns inte bland familjens pågående planer.',
  silver: 'Extra silver måste vara ett positivt heltal.',
  cap: `En plan kan få högst ${MAX_EXTRA_SILVER} extra silver sammanlagt.`,
  dead: 'Utföraren eller målet har dött, så planen kunde aldrig fullföljas.',
  stopped: 'Planen kunde inte genomföras.',
});
const INVALID = Object.freeze({
  list: 'Planlistan är ogiltig.',
  entry: 'En plan i planlistan är ogiltig.',
  id: 'En plan har ett ogiltigt eller dubblerat id.',
  action: 'En plan hänvisar till en okänd handling.',
  person: 'En plan hänvisar till en saknad person.',
  means: 'En plans medel är ogiltiga.',
  date: 'En plan har ett ogiltigt datum.',
  discovery: 'En plans avslöjande stämmer inte med dess status.',
  outcome: 'En plans utfall stämmer inte med handlingsloggen.',
});

const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const ownKey = (map, key) => typeof key === 'string' && plainObject(map) && Object.hasOwn(map, key);
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const personOf = (state, id) => (ownKey(state.people, id) ? state.people[id] : null);
const alive = (person) => Boolean(person) && !person.diedAt;
const earlier = (a, b) => (compareGameDates(a, b) <= 0 ? a : b);
const intrigueOf = (person) => finite(person.skills?.intrigue);
const isActive = (scheme) => plainObject(scheme) && scheme.status === 'active';
// Ids are `scheme-<n>` with n from state.sequence, so the number is the creation order. As text, scheme-10 would sort before scheme-9.
const numberOf = (id) => Number(/^scheme-([1-9]\d*)$/.exec(id)?.[1] ?? Number.NaN);

/**
 * Writes the scheme that a validated, paid and (if ordered) obeyed attempt starts, and returns it. `estimate` is the ok result of estimateAction, `intent` the attempt's payload. The first check comes a month after the start or on the due date, whichever is earlier. Draws no randomness and charges nothing: the caller pays through payForAction.
 * `playerControlled` comes from the engine's context in `hooks`; `commandId` is the command that started the scheme.
 */
export function startScheme(state, intent, estimate, hooks, commandId = null) {
  const startedAt = state.date;
  const dueAt = addGameMonths(startedAt, ACTION_CATALOG[estimate.actionId].durationMonths);
  const means = plainObject(intent?.means) ? intent.means : {};
  const scheme = {
    id: `scheme-${++state.sequence}`, actionId: estimate.actionId, actorId: estimate.actorId, targetIds: [...estimate.targetIds],
    means: { silver: means.silver ?? 0, agentRoles: [...(means.agentRoles ?? [])] },
    startedAt, dueAt, nextCheckAt: earlier(dueAt, addGameMonths(startedAt, 1)),
    status: 'active', discoveredAt: null, resolutionId: null,
    playerControlled: hooks.estimateContext().playerControlled === true, commandId,
  };
  state.schemes.push(scheme);
  return scheme;
}

/** The next check date of every active scheme, for the character calendar. */
export function getSchemeDates(state) {
  return (Array.isArray(state.schemes) ? state.schemes : []).filter(isActive).map((scheme) => scheme.nextCheckAt);
}

// The check after this one, counted in whole months from the start so a scheme begun on the 31st does not drift to the 28th, and never past the due date.
function followingCheck(scheme) {
  let months = 1, next = addGameMonths(scheme.startedAt, months);
  while (compareGameDates(next, scheme.nextCheckAt) <= 0) next = addGameMonths(scheme.startedAt, ++months);
  return earlier(next, scheme.dueAt);
}

// A scheme belongs to the player's side when the player ordered or owns it, or its target is the person they play through. Only then may its events reach the player.
function playerSide(state, scheme, hooks) {
  const representatives = [hooks.householdRepresentative()?.id, hooks.activeRepresentative()?.id];
  // resolutionVisible reads playerControlled and the actor's family, which a scheme carries like an action log entry.
  return resolutionVisible(state, scheme, hooks.controlledFamily()?.id ?? null) || representatives.includes(scheme.targetIds[0]);
}

// The odds as they stand on the due date for the same actor, target and means. The silver was paid at the start. An NPC scheme uses the NPC context of npc_intent (index.js), which orders only its own actor: the NPC rules were checked when the intent was accepted, and the plan stays the NPC's own even if its family later comes under the player.
function dueEstimate(state, scheme, hooks) {
  const own = scheme.playerControlled === true;
  const ctx = own ? hooks.estimateContext() : hooks.npcEstimateContext(scheme.actorId);
  const intent = { actionId: scheme.actionId, actorId: scheme.actorId, targetIds: scheme.targetIds, means: scheme.means };
  return estimateAction(state, intent, { ...ctx, wallet: () => PAID });
}

function collapse(state, scheme, reason, events, hooks) {
  scheme.status = 'failed';
  const name = (id) => personOf(state, id)?.name ?? id;
  hooks.logEvent(events, 'scheme_failed', `${ACTION_CATALOG[scheme.actionId].label}: planen föll samman`, `${reason} Utförare: ${name(scheme.actorId)}. Mål: ${scheme.targetIds.map(name).join(', ')}.`, [scheme.actorId, ...scheme.targetIds], { public: playerSide(state, scheme, hooks) });
}

function discover(state, scheme, actor, target, events, hooks) {
  scheme.status = 'discovered';
  scheme.discoveredAt = state.date;
  const event = hooks.logEvent(events, 'scheme_discovered', `${ACTION_CATALOG[scheme.actionId].label}: planen avslöjades`, `${target.name} har kommit på att ${actor.name} ligger bakom planen.`, [actor.id, target.id], { public: playerSide(state, scheme, hooks) });
  const knownBy = [actor.id, target.id];
  const memory = hooks.memory('scheme_discovered', event.title, knownBy, { causeId: event.id, knownBy, schemeId: scheme.id });
  hooks.opinionCause(target.id, actor.id, DISCOVERY_OPINION, 'Avslöjad intrig', memory.id);
}

// One monthly check. A dead actor or target ends the scheme before anything is drawn. On the due date the odds are estimated afresh and a scheme that can no longer run fails before any draw; otherwise the discovery roll comes first and, when the plan holds, the action is rolled and recorded like an instant one.
function checkScheme(state, scheme, events, hooks) {
  const actor = personOf(state, scheme.actorId), target = personOf(state, scheme.targetIds[0]);
  if (![actor, ...scheme.targetIds.map((id) => personOf(state, id))].every(alive)) return collapse(state, scheme, MESSAGES.dead, events, hooks);
  const due = compareGameDates(scheme.dueAt, state.date) <= 0;
  const estimate = due ? dueEstimate(state, scheme, hooks) : null;
  if (estimate && !estimate.ok) return collapse(state, scheme, `${MESSAGES.stopped} ${estimate.reason}`, events, hooks);
  const chance = clamp(DISCOVERY.base + intrigueOf(target) * DISCOVERY.perIntrigue - intrigueOf(actor), DISCOVERY.min, DISCOVERY.max);
  if (actionRandom(state) * 100 < chance) return discover(state, scheme, actor, target, events, hooks);
  if (!due) {
    scheme.nextCheckAt = followingCheck(scheme);
    return;
  }
  scheme.resolutionId = resolveScheme(state, scheme, estimate, events, hooks).id;
  scheme.status = 'resolved';
}

/** Runs every active scheme whose next check has come, oldest scheme first, and closes or moves it on. Called once per calendar step, after the day's deaths and before the annual step. */
export function advanceSchemes(state, events, hooks) {
  const reached = (scheme) => isActive(scheme) && compareGameDates(scheme.nextCheckAt, state.date) <= 0;
  for (const scheme of state.schemes.filter(reached).sort((a, b) => numberOf(a.id) - numberOf(b.id))) {
    while (isActive(scheme) && reached(scheme)) checkScheme(state, scheme, events, hooks);
  }
}

// Abort and reinforce are for the controlled family's own active schemes that the player started. Any other id gets the same refusal, so the player cannot probe for other houses' plans.
function ownActiveScheme(state, payload, hooks) {
  const id = plainObject(payload) ? payload.schemeId : null, familyId = hooks.controlledFamily()?.id ?? null;
  const scheme = typeof id === 'string' ? state.schemes.find((item) => item.id === id) : null;
  if (!isActive(scheme) || scheme.playerControlled !== true || familyId == null || personOf(state, scheme.actorId)?.familyId !== familyId) throw new Error(MESSAGES.unknown);
  return scheme;
}

/** Runs the command abort_scheme: payload { schemeId }. The scheme stops for good; its silver and order are not refunded. Draws no randomness. */
export function abortScheme(state, payload, hooks) {
  const scheme = ownActiveScheme(state, payload, hooks);
  scheme.status = 'aborted';
  return scheme;
}

/** Runs the command reinforce_scheme: payload { schemeId, silver }. Charges the silver to the wallet that paid for the start, with no order point and no stress, and adds it to the scheme's means, which the odds read when the scheme is rolled. Draws no randomness. */
export function reinforceScheme(state, payload, hooks) {
  const scheme = ownActiveScheme(state, payload, hooks), { silver } = payload;
  if (!Number.isInteger(silver) || silver < 1) throw new Error(MESSAGES.silver);
  if (scheme.means.silver + silver > MAX_EXTRA_SILVER) throw new Error(MESSAGES.cap);
  hooks.charge(silver, { orders: 0, publicFunds: ACTION_CATALOG[scheme.actionId].cost.wallet === 'realm', tag: REINFORCE_TAG });
  scheme.means.silver += silver;
  return scheme;
}

// Load-time validation of state.schemes, in the style of validateActionLog: shape and references, not catalog ranges, so a later balance change cannot invalidate old saves.
const fail = (message) => { throw new Error(message); };
const safeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_:.-]{1,160}$/.test(id);
const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;

function checkIdentity(state, scheme, ids) {
  const number = numberOf(scheme.id);
  if (!Number.isInteger(number) || number > state.sequence || ids.has(scheme.id)) fail(INVALID.id);
  if (!ownKey(ACTION_CATALOG, scheme.actionId)) fail(INVALID.action);
  const people = [scheme.actorId, ...(Array.isArray(scheme.targetIds) ? scheme.targetIds : [])];
  if (!Array.isArray(scheme.targetIds) || scheme.targetIds.length < 1 || new Set(scheme.targetIds).size !== scheme.targetIds.length || !people.every((id) => personOf(state, id))) fail(INVALID.person);
  if (!SCHEME_STATUSES.includes(scheme.status) || typeof scheme.playerControlled !== 'boolean' || (scheme.commandId !== null && !safeId(scheme.commandId))) fail(INVALID.entry);
}

function checkMeans(scheme) {
  const { means } = scheme;
  if (!plainObject(means) || !Number.isInteger(means.silver) || means.silver < 0 || !Array.isArray(means.agentRoles)) fail(INVALID.means);
  if (!means.agentRoles.every((role) => ownKey(STAFF_ROLES, role)) || new Set(means.agentRoles).size !== means.agentRoles.length) fail(INVALID.means);
}

function checkDates(state, scheme) {
  const { startedAt, dueAt, nextCheckAt } = scheme;
  if (![startedAt, dueAt, nextCheckAt].every(canonical) || compareGameDates(startedAt, state.date) > 0) fail(INVALID.date);
  if (compareGameDates(startedAt, dueAt) >= 0 || compareGameDates(nextCheckAt, startedAt) < 0 || compareGameDates(nextCheckAt, dueAt) > 0) fail(INVALID.date);
}

// A discovery date exists exactly for a discovered scheme; a resolution exists exactly for a resolved one and is an action log entry for the same action and actor.
function checkOutcome(state, scheme) {
  const { discoveredAt, resolutionId } = scheme;
  if (scheme.status === 'discovered' ? !(canonical(discoveredAt) && compareGameDates(discoveredAt, scheme.startedAt) >= 0 && compareGameDates(discoveredAt, state.date) <= 0) : discoveredAt !== null) fail(INVALID.discovery);
  if (scheme.status !== 'resolved') {
    if (resolutionId !== null) fail(INVALID.outcome);
    return;
  }
  const entry = state.actionLog.find((item) => item.id === resolutionId);
  if (!entry || entry.actionId !== scheme.actionId || entry.actorId !== scheme.actorId) fail(INVALID.outcome);
}

/** Validates state.schemes on load: ids `scheme-<n>` unique and within state.sequence, a known action, existing people, valid means, canonical dates in order, a discovery date only on a discovered scheme and a resolution only on a resolved one. Throws a Swedish sentence about the scheme list. Call after validateActionLog. */
export function validateSchemes(state) {
  if (!Array.isArray(state.schemes)) fail(INVALID.list);
  const ids = new Set();
  for (const scheme of state.schemes) {
    if (!plainObject(scheme)) fail(INVALID.entry);
    checkIdentity(state, scheme, ids);
    checkMeans(scheme);
    checkDates(state, scheme);
    checkOutcome(state, scheme);
    ids.add(scheme.id);
  }
}

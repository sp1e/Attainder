import { compareGameDates, normalizeGameDate } from '../gameDates.js';
import { ACTION_CATALOG, TIER_IDS, effectDefault } from './actionCatalog.js';
import { ODDS_MAX, ODDS_MIN, bandFor, estimateAction } from './actionOdds.js';
import { ensureStaff } from './courtStaff.js';
import { actionRandom } from './extensions.js';
import { HOOK_STRENGTHS, SECRET_TYPES, createSecret, grantHook } from './secrets.js';
import { startScheme } from './schemes.js';

// Resolution of contested actions. The engine decides: an attempt is validated by estimateAction, paid, rolled twice on the action stream (success, then secrecy) and lands on one of five tiers whose effect envelope is applied at its defaults. A later narrative may move a ranged effect inside its envelope and never outside it.
// Randomness comes only from actionRandom (state.actionRngState). The main stream state.rngState is never touched here.
// `hooks` are built by index.js (actionHooks), so this module never reaches into the engine's private helpers.

export const TIER_TITLES = Object.freeze({
  clean_success: 'Lyckat i det tysta',
  exposed_success: 'Lyckat men avslöjat',
  quiet_failure: 'Misslyckat i det tysta',
  exposed_failure: 'Misslyckat och avslöjat',
  backfire: 'Det slog tillbaka',
});
export const REFUSED_TITLE = 'Ordern vägrades';
// Tiers the world learns about. Their anchor memory is public, and such an action by another family reaches the player's list.
const PUBLIC_TIERS = new Set(['exposed_success', 'exposed_failure', 'backfire']);
// Spec 5.8: refusal = clamp(40 − loyalty × 0.4 − opinion(actor → representative) × 0.3 + 10 if ambitious − 15 if dutiful, 0, 90), rounded to an integer.
const REFUSAL = Object.freeze({ base: 40, loyalty: 0.4, opinion: 0.3, ambitious: 10, dutiful: 15, max: 90 });
// A failed roll in the top tenth of the failure range backfires.
const BACKFIRE_SHARE = 0.9;
const TITLE_MAX = 120, TEXT_MAX = 1500;
const INFLUENCE_MAX = 100, STRESS_MAX = 200;
const RECENT_LIMIT = 10;
const PRECISIONS = new Set(['exact', 'five', 'three']);
// charge() prices stress per tag (stressFor in index.js) and gives 0 for a tag it does not know. A refused order passes this tag, so the representative pays no stress for an order that never ran.
const REFUSED_TAG = 'order_refused';
const SCHEME_FIELDS = Object.freeze(['startedAt', 'completesAt', 'dueAt']);

const MESSAGES = Object.freeze({
  command: 'Den här handlingen utförs med sitt vanliga kommando.',
  missing: 'Utfallet finns inte.',
  refused: 'En vägrad order har inget utfall att berätta om.',
  told: 'Utfallet har redan en berättelse.',
  title: `Rubriken måste vara en text på 1 till ${TITLE_MAX} tecken.`,
  text: 'Berättelsen måste vara en text på 1 till 1 500 tecken.',
});
const LOG = Object.freeze({
  list: 'Handlingsloggen är ogiltig.',
  entry: 'En post i handlingsloggen är ogiltig.',
  id: 'Handlingsloggen har ett ogiltigt eller dubblerat id.',
  action: 'Handlingsloggen hänvisar till en okänd handling.',
  person: 'Handlingsloggen hänvisar till en saknad person eller agent.',
  memory: 'Handlingsloggen hänvisar till ett saknat minne.',
  date: 'Handlingsloggen har ett ogiltigt datum.',
  odds: 'Handlingsloggen har ogiltiga odds eller tärningsslag.',
  refusal: 'Handlingsloggens vägran stämmer inte med tärningsslagen.',
  tier: 'Handlingsloggens utfall stämmer inte med tärningsslagen.',
  effect: 'Handlingsloggen har en ogiltig effekt.',
  narrative: 'Handlingsloggens berättelse är ogiltig.',
});

const copy = (value) => JSON.parse(JSON.stringify(value));
const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hasTrait = (person, trait) => Array.isArray(person?.traits) && person.traits.includes(trait);
const ownKey = (map, key) => typeof key === 'string' && plainObject(map) && Object.hasOwn(map, key);
const personOf = (state, id) => (ownKey(state.people, id) ? state.people[id] : null);
const unique = (ids) => [...new Set(ids.filter(Boolean))];
const roll = (state) => actionRandom(state) * 100;
const outcomeTitle = (entry, tier) => `${entry.label}: ${TIER_TITLES[tier].toLowerCase()}`;
const ranged = (effect) => Number.isFinite(effect?.min) && Number.isFinite(effect?.max);

/** The tier two rolls give against the odds: success when successRoll < success; a failure backfires when successRoll >= success + 0.9 × (100 − success); otherwise the attempt is exposed when secrecyRoll >= secrecy. */
export function tierFor(successRoll, secrecyRoll, success, secrecy) {
  const exposed = secrecyRoll >= secrecy;
  if (successRoll < success) return exposed ? 'exposed_success' : 'clean_success';
  if (successRoll >= success + BACKFIRE_SHARE * (100 - success)) return 'backfire';
  return exposed ? 'exposed_failure' : 'quiet_failure';
}

/** The chance, an integer from 0 to 90, that an ordered actor refuses the representative (spec 5.8). */
export function refusalChance(actor, opinionOfRepresentative) {
  const raw = REFUSAL.base - finite(actor?.loyalty) * REFUSAL.loyalty - finite(opinionOfRepresentative) * REFUSAL.opinion
    + (hasTrait(actor, 'ambitious') ? REFUSAL.ambitious : 0) - (hasTrait(actor, 'dutiful') ? REFUSAL.dutiful : 0);
  return Math.round(clamp(raw, 0, REFUSAL.max));
}

// The people of the player's household who learn about a quiet outcome: the actor, the representative who gave the order and the representative the player sees through.
const playerWitnesses = (resolution, hooks) => unique([resolution.actorId, hooks.householdRepresentative()?.id, hooks.activeRepresentative()?.id]);
// The logEvent extra for a resolution's events. One the player may not see (resolutionVisible) is logged with public: false, which keeps it out of the presentation log and the world event stream (characterWorld.js).
const playerEvent = (state, resolution, hooks) => ({ public: resolutionVisible(state, resolution, hooks.controlledFamily()?.id ?? null) });

/**
 * Pays for an action, once. A player action is paid by the controlled household (or the realm, for a realm wallet) through charge(), which also spends the order points and adds the payer's stress for the action's tag. estimate.cost.silver already holds the catalog cost plus means.silver. A refused order spends its order points, no silver and no stress.
 * An NPC action (resolution.playerControlled false) is paid from the actor family's own treasury, with no order points and no player stress. Its estimate already refused an NPC that cannot pay, before any draw; the check here only guards the seam.
 */
export function payForAction(state, resolution, estimate, hooks) {
  const { cost } = estimate;
  if (resolution.playerControlled === false) {
    const family = state.families[state.people[estimate.actorId].familyId];
    if (cost.wallet !== 'family' || !family || family.treasury < cost.silver) throw new Error(`Det behövs ${cost.silver} silver; tillgängligt ${Math.floor(family?.treasury ?? 0)}.`);
    family.treasury = Math.round((family.treasury - cost.silver) * 100) / 100;
    return state.people[estimate.actorId];
  }
  return hooks.charge(resolution.refused ? 0 : cost.silver, { orders: cost.orders, publicFunds: cost.wallet === 'realm', tag: resolution.refused ? REFUSED_TAG : cost.stressTag });
}

// The single place where a scheme (durationMonths > 0) starts. An ordered actor draws the refusal first, exactly as for an instant action; a refused order is recorded like any refusal and starts nothing. Otherwise the start is paid once, here, and the scheme is written. The roll comes later: schemes.js calls resolveScheme on the due date, with no second refusal draw, since the order was obeyed.
function beginScheme(state, command, entry, estimate, events, hooks, ctx) {
  const playerControlled = ctx.playerControlled === true;
  const order = drawOrder(state, estimate.actorId, playerControlled, ctx);
  if (order?.refused) {
    const resolution = recordOrder(openResolution(state, command, estimate, ctx), order);
    return refuseOrder(state, resolution, entry, estimate, events, hooks);
  }
  payForAction(state, { refused: false, playerControlled }, estimate, hooks);
  return startScheme(state, command.payload, estimate, hooks, command.id ?? null);
}

function openResolution(state, command, estimate, ctx) {
  return {
    id: `resolution-${++state.sequence}`, commandId: command?.id ?? null, actionId: estimate.actionId, actorId: estimate.actorId, targetIds: [...estimate.targetIds],
    agentIds: [], date: state.date, playerControlled: ctx.playerControlled === true, precision: estimate.precision, memoryId: null,
    estimate: { success: estimate.success.value, secrecy: estimate.secrecy.value, refusal: null },
    rolls: { refusal: null, success: null, secrecy: null }, tier: null, effects: [], narrative: null, refused: false,
  };
}

// Orders exist only for the player and come from the active representative, the person the player acts through. Any other actor draws the refusal roll first, before the success roll; nobody refuses their own order. Returns the chance and the roll, or null when nobody gave an order and nothing was drawn.
function drawOrder(state, actorId, playerControlled, ctx) {
  const giverId = ctx.activeRepresentativeId ?? ctx.representativeId;
  if (!playerControlled || actorId === giverId) return null;
  const chance = refusalChance(state.people[actorId], ctx.opinion(actorId, giverId));
  const drawn = roll(state);
  return { chance, roll: drawn, refused: drawn < chance };
}

function recordOrder(resolution, order) {
  resolution.estimate.refusal = order.chance;
  resolution.rolls.refusal = order.roll;
  return resolution;
}

function drawRefusal(state, resolution, ctx) {
  const order = drawOrder(state, resolution.actorId, resolution.playerControlled, ctx);
  if (!order) return false;
  recordOrder(resolution, order);
  return order.refused;
}

function refuseOrder(state, resolution, entry, estimate, events, hooks) {
  resolution.refused = true;
  payForAction(state, resolution, estimate, hooks);
  const actor = state.people[resolution.actorId], witnesses = playerWitnesses(resolution, hooks);
  const event = hooks.logEvent(events, 'order_refused', `${entry.label}: ${REFUSED_TITLE.toLowerCase()}`, `${actor.name} vägrade att utföra ordern. Ordern är förbrukad, men inget silver betalades.`, witnesses, playerEvent(state, resolution, hooks));
  resolution.memoryId = hooks.memory('order_refused', `${actor.name} vägrade en order`, witnesses, { causeId: event.id, knownBy: witnesses, resolutionId: resolution.id }).id;
  state.actionLog.push(resolution);
  return resolution;
}

// Agents work for the household that pays. They are found or created only when the action runs. An NPC hires from its own family; so does a player action when there is no controlled family at that moment (a scheme's due date), which would otherwise stop the calendar.
function hireAgents(state, resolution, means, hooks) {
  const roles = Array.isArray(means?.agentRoles) ? means.agentRoles : [];
  const familyId = (resolution.playerControlled ? hooks.controlledFamily()?.id : null) ?? state.people[resolution.actorId].familyId;
  return roles.map((role) => ensureStaff(state, familyId, role).id);
}

function describeAttempt(state, resolution) {
  const names = (ids, lookup) => ids.map((id) => lookup[id]?.name || id).join(', ');
  const agents = resolution.agentIds.length ? ` Agenter: ${names(resolution.agentIds, state.courtStaff)}.` : '';
  return `Utförare: ${names([resolution.actorId], state.people)}. Mål: ${names(resolution.targetIds, state.people)}.${agents}`;
}

/** Rolls success, then secrecy, picks the tier, writes one chronicle event and the anchor memory, applies the tier's envelope at its defaults and appends the entry to state.actionLog. Used by resolveAttempt and, on a scheme's due date, by resolveScheme. */
export function completeResolution(state, resolution, entry, events, hooks) {
  resolution.rolls.success = roll(state);
  resolution.rolls.secrecy = roll(state);
  resolution.tier = tierFor(resolution.rolls.success, resolution.rolls.secrecy, resolution.estimate.success, resolution.estimate.secrecy);
  const participants = [resolution.actorId, ...resolution.targetIds];
  const event = hooks.logEvent(events, 'action_resolution', outcomeTitle(entry, resolution.tier), describeAttempt(state, resolution), participants, playerEvent(state, resolution, hooks));
  const knownBy = PUBLIC_TIERS.has(resolution.tier) ? 'public' : resolution.playerControlled ? playerWitnesses(resolution, hooks) : [resolution.actorId];
  resolution.memoryId = hooks.memory('action', event.title, participants, { causeId: event.id, knownBy, resolutionId: resolution.id }).id;
  resolution.effects = applyTierEffects(state, resolution, entry, hooks);
  state.actionLog.push(resolution);
  return resolution;
}

function refuseCommandIds(intent, hooks) {
  const id = plainObject(intent) ? intent.actionId : null;
  if (typeof id === 'string' && !Object.hasOwn(ACTION_CATALOG, id) && hooks.isCommandAction(id)) throw new Error(MESSAGES.command);
}

/**
 * Opens and completes the resolution of a scheme on its due date. `estimate` is the fresh ok estimate for that day. The order was obeyed and the price paid when the scheme started, so there is no refusal draw and no charge here. The scheme carries the command id and the playerControlled flag that openResolution reads. Agents are found or created now, when the action runs. Returns the action log entry.
 */
export function resolveScheme(state, scheme, estimate, events, hooks) {
  const resolution = openResolution(state, { id: scheme.commandId }, estimate, scheme);
  resolution.agentIds = hireAgents(state, resolution, scheme.means, hooks);
  return completeResolution(state, resolution, ACTION_CATALOG[scheme.actionId], events, hooks);
}

/** Runs the command attempt_action (payload = intent). Throws a Swedish sentence when the attempt is refused before any charge. Returns the resolution entry it appended to state.actionLog, or, for an action that takes months, the scheme it started. */
export function resolveAttempt(state, command, events, hooks) {
  const intent = command?.payload;
  refuseCommandIds(intent, hooks);
  const ctx = hooks.estimateContext();
  const estimate = estimateAction(state, intent, ctx);
  if (!estimate.ok) throw new Error(estimate.reason);
  const entry = ACTION_CATALOG[estimate.actionId];
  if (entry.durationMonths > 0) return beginScheme(state, command, entry, estimate, events, hooks, ctx);
  const resolution = openResolution(state, command, estimate, ctx);
  if (drawRefusal(state, resolution, ctx)) return refuseOrder(state, resolution, entry, estimate, events, hooks);
  payForAction(state, resolution, estimate, hooks);
  resolution.agentIds = hireAgents(state, resolution, intent.means, hooks);
  return completeResolution(state, resolution, entry, events, hooks);
}

/**
 * Moves a bounded field (influence 0..100, stress 0..200) by `value` and returns the new field and the change actually made. The field moves only in the direction of the value's sign and stops at the bound, so `applied` lies between 0 and `value`. A field the engine left beyond a bound (influence can pass 100 or drop below 0 elsewhere) is never pulled back by an effect that points the other way.
 */
function shiftField(base, value, max) {
  const target = base + value;
  const next = value >= 0 ? Math.max(base, Math.min(max, target)) : Math.min(base, Math.max(0, target));
  return { next, applied: next === target ? value : next - base };
}

// Effect appliers. Role words ('actor', 'target') resolve to the actor and the first target. A ranged effect records `value` (the envelope value chosen, the default until a narrative moves it), `applied` (the change the field actually took) and its envelope.
const rangedRecord = (effect) => { const value = effectDefault(effect); return { value, applied: value, min: effect.min, max: effect.max, default: value }; };
const FIELDS = Object.freeze({
  influence: { holder: (state, effect) => state.families[effect.familyId], key: 'influence', max: INFLUENCE_MAX },
  stress: { holder: (state, effect) => state.people[effect.personId], key: 'stress', max: STRESS_MAX },
});
// Applies a bounded effect to its field from `base` (the field without this effect) and records the change it took.
function settleField(state, record, base) {
  const field = FIELDS[record.kind], holder = field.holder(state, record);
  const { next, applied } = shiftField(base, record.value, field.max);
  holder[field.key] = next;
  record.applied = applied;
  return record;
}
const APPLY = Object.freeze({
  opinion(state, effect, { roles, label, causeId, hooks }) {
    const record = { kind: 'opinion', fromId: roles[effect.from], toId: roles[effect.to], causeId, label, ...rangedRecord(effect) };
    hooks.opinionCause(record.fromId, record.toId, record.value, label, causeId);
    return record;
  },
  influence(state, effect, { roles }) {
    const record = { kind: 'influence', familyId: state.people[roles[effect.family]].familyId, ...rangedRecord(effect) };
    return settleField(state, record, state.families[record.familyId].influence);
  },
  stress(state, effect, { roles }) {
    const record = { kind: 'stress', personId: roles[effect.who], ...rangedRecord(effect) };
    return settleField(state, record, state.people[record.personId].stress);
  },
  hook(state, effect, { roles, causeId }) {
    const hook = grantHook(state, { ownerId: roles[effect.owner], targetId: roles[effect.over], strength: effect.strength, causeId });
    return { kind: 'hook', ownerId: hook.ownerId, targetId: hook.targetId, strength: hook.strength, hookId: hook.id };
  },
  secret(state, effect, { roles, causeId }) {
    const secret = createSecret(state, { type: effect.type, subjectId: roles[effect.subject], holderIds: effect.holders.map((role) => roles[role]), evidence: 'weak', causeId });
    return { kind: 'secret', type: secret.type, subjectId: secret.subjectId, holderIds: [...secret.holderIds], secretId: secret.id };
  },
  memory(state, effect, { roles, causeId, hooks }) {
    const knownBy = effect.visibility === 'private' ? [roles.actor] : 'public';
    const item = hooks.memory('action', effect.title, [roles.actor, roles.target], { causeId, knownBy });
    return { kind: 'memory', visibility: effect.visibility, title: effect.title, memoryId: item.id };
  },
});

/** Applies every effect of the resolution's tier at its default and returns the applied effects. Opinions go through hooks.opinionCause with the anchor memory (resolution.memoryId) as cause; memories through hooks.memory. Exported for Task 7. */
export function applyTierEffects(state, resolution, entry, hooks) {
  const context = { roles: { actor: resolution.actorId, target: resolution.targetIds[0] }, label: outcomeTitle(entry, resolution.tier), causeId: resolution.memoryId, hooks };
  return entry.tiers[resolution.tier].effects.map((effect) => APPLY[effect.kind](state, effect, context));
}

function boundedText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= 1 && text.length <= max ? text : null;
}

// An adjustment counts only when it names a ranged effect of this resolution once and gives an integer inside that effect's range.
function adjustableEffect(resolution, item, used) {
  if (!plainObject(item) || !Number.isInteger(item.effectIndex) || used.has(item.effectIndex)) return null;
  const effect = resolution.effects[item.effectIndex];
  if (!plainObject(effect) || !ranged(effect)) return null;
  return Number.isInteger(item.value) && item.value >= effect.min && item.value <= effect.max ? effect : null;
}

// The change an effect made. Entries written before `applied` existed count their value as applied.
const appliedOf = (effect) => (Object.hasOwn(effect, 'applied') ? effect.applied : effect.value);

/**
 * The field without this effect: the current field minus the change the effect made. The field can move between the attempt and its narrative (a rest lowers stress, the year changes influence), which can put that difference beyond a bound. On each side where the current field is inside its range, the base stays inside it too. On a side where the engine left the field beyond the bound, the raw base stands, as shiftField left it.
 * Limit: when the effect itself brought the field into the range (influence 105, −10 gives 95), this case looks the same as a field that moved later. A milder value then leaves the field where it is (95, not 100).
 */
function adjustmentBase(current, applied, max) {
  const raw = current - applied;
  const floored = current >= 0 ? Math.max(0, raw) : raw;
  return current <= max ? Math.min(max, floored) : floored;
}

// Takes back the change the effect made, applies the chosen value from there and stops at the bound again. The field then moves only in the direction of the adjustment (value − applied) and at most by that much, so a milder effect never pushes the field further and a stronger one never pulls it back. An opinion cause is never cut at write time (getPersonalOpinion caps the sum), so its applied change is its amount.
function adjustEffect(state, effect, value) {
  if (effect.kind === 'opinion') {
    const cause = state.relations[`${effect.fromId}:${effect.toId}`]?.causes?.find((item) => item.causeId === effect.causeId);
    if (!cause) return false;
    cause.amount += value - appliedOf(effect);
    Object.assign(effect, { value, applied: value });
    return true;
  }
  if (!Object.hasOwn(FIELDS, effect.kind)) return false;
  const field = FIELDS[effect.kind], holder = field.holder(state, effect);
  if (!holder) return false;
  const current = holder[field.key], before = appliedOf(effect), delta = value - before;
  const base = adjustmentBase(current, before, field.max);
  const next = clamp(shiftField(base, value, field.max).next, Math.min(current, current + delta), Math.max(current, current + delta));
  holder[field.key] = next;
  Object.assign(effect, { value, applied: next === base + value ? value : next - base });
  return true;
}

function applyAdjustments(state, resolution, adjustments) {
  const list = adjustments == null ? [] : Array.isArray(adjustments) ? adjustments : [adjustments];
  const used = new Set();
  let rejected = 0;
  for (const item of list) {
    const effect = adjustableEffect(resolution, item, used);
    if (effect && adjustEffect(state, effect, item.value)) used.add(item.effectIndex);
    else rejected += 1;
  }
  return rejected;
}

/**
 * Runs the command record_action_narrative: payload { resolutionId, title, narrative, adjustments: [{ effectIndex, value }] }. Only for an existing, unrefused resolution without a narrative. Accepted adjustments move ranged effects inside their envelope; every other adjustment is dropped and counted in rejectedAdjustments. The narrative is kept even when every adjustment is dropped. Draws no randomness.
 * `events` receives one chronicle event with the narrative; index.js passes the command's event list.
 */
export function recordNarrative(state, payload, hooks, events = []) {
  const request = plainObject(payload) ? payload : {};
  const resolution = typeof request.resolutionId === 'string' ? state.actionLog.find((entry) => plainObject(entry) && entry.id === request.resolutionId) : null;
  if (!resolution) throw new Error(MESSAGES.missing);
  if (resolution.refused) throw new Error(MESSAGES.refused);
  if (resolution.narrative !== null) throw new Error(MESSAGES.told);
  const title = boundedText(request.title, TITLE_MAX);
  if (!title) throw new Error(MESSAGES.title);
  const text = boundedText(request.narrative, TEXT_MAX);
  if (!text) throw new Error(MESSAGES.text);
  resolution.rejectedAdjustments = applyAdjustments(state, resolution, request.adjustments);
  resolution.narrative = { title, text };
  hooks.logEvent(events, 'action_narrative', title, text, [resolution.actorId, ...resolution.targetIds], playerEvent(state, resolution, hooks));
  return resolution;
}

// Load-time validation of state.actionLog. It checks shape and references, not catalog ranges, so a later balance change cannot invalidate old saves.
const idSet = (list) => new Set((Array.isArray(list) ? list : []).map((item) => item?.id).filter((id) => typeof id === 'string'));
const safeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_:.-]{1,160}$/.test(id);
const odds = (value) => Number.isInteger(value) && value >= ODDS_MIN && value <= ODDS_MAX;
const die = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 100;
const canonicalPast = (date, limit) => typeof date === 'string' && normalizeGameDate(date) === date && compareGameDates(date, limit) <= 0;
const isPerson = (state, id) => Boolean(personOf(state, id));
const fail = (message) => { throw new Error(message); };

function checkIdentity(state, entry, known) {
  const match = typeof entry.id === 'string' ? /^resolution-([1-9]\d*)$/.exec(entry.id) : null;
  if (!match || Number(match[1]) > state.sequence) fail(LOG.id);
  if (entry.commandId !== null && !safeId(entry.commandId)) fail(LOG.entry);
  if (!ownKey(ACTION_CATALOG, entry.actionId)) fail(LOG.action);
  const people = Array.isArray(entry.targetIds) && entry.targetIds.length > 0 ? [entry.actorId, ...entry.targetIds] : [null];
  if (!people.every((id) => isPerson(state, id)) || new Set(entry.targetIds).size !== entry.targetIds.length) fail(LOG.person);
  if (!Array.isArray(entry.agentIds) || !entry.agentIds.every((id) => ownKey(state.courtStaff, id)) || new Set(entry.agentIds).size !== entry.agentIds.length) fail(LOG.person);
  if (!canonicalPast(entry.date, state.date)) fail(LOG.date);
  if (typeof entry.playerControlled !== 'boolean' || typeof entry.refused !== 'boolean' || !PRECISIONS.has(entry.precision)) fail(LOG.entry);
  if (!known.memories.has(entry.memoryId)) fail(LOG.memory);
}

// The refusal draw exists exactly when estimate.refusal is set; the entry is refused exactly when that draw fell below the chance. An entry that ran carries two rolls and the tier they give.
function checkDice(entry) {
  const { estimate, rolls } = entry;
  if (!plainObject(estimate) || !plainObject(rolls) || !odds(estimate.success) || !odds(estimate.secrecy)) fail(LOG.odds);
  const ordered = estimate.refusal !== null;
  if (ordered ? !(Number.isInteger(estimate.refusal) && estimate.refusal >= 0 && estimate.refusal <= REFUSAL.max && die(rolls.refusal)) : rolls.refusal !== null) fail(LOG.odds);
  const refused = ordered && rolls.refusal < estimate.refusal;
  if (entry.refused !== refused) fail(LOG.refusal);
  if (refused) {
    if (rolls.success !== null || rolls.secrecy !== null || entry.tier !== null || entry.agentIds.length || entry.narrative !== null || !Array.isArray(entry.effects) || entry.effects.length) fail(LOG.refusal);
    return;
  }
  if (!die(rolls.success) || !die(rolls.secrecy)) fail(LOG.odds);
  if (!TIER_IDS.includes(entry.tier) || tierFor(rolls.success, rolls.secrecy, estimate.success, estimate.secrecy) !== entry.tier) fail(LOG.tier);
}

// `applied` lies between 0 and `value`: a bound can shorten the change but never reverse or extend it. An entry without `applied` predates the field and counts its value as applied.
const validApplied = (effect) => {
  if (!Object.hasOwn(effect, 'applied')) return true;
  const { applied, value } = effect;
  return typeof applied === 'number' && Number.isFinite(applied) && (value >= 0 ? applied >= 0 && applied <= value : applied <= 0 && applied >= value);
};
const validRange = (effect) => [effect.min, effect.max, effect.default, effect.value].every(Number.isInteger)
  && effect.min <= effect.default && effect.default <= effect.max && effect.min <= effect.value && effect.value <= effect.max && validApplied(effect);
const EFFECT_CHECKS = Object.freeze({
  opinion: (state, effect) => isPerson(state, effect.fromId) && isPerson(state, effect.toId) && typeof effect.causeId === 'string' && typeof effect.label === 'string' && validRange(effect),
  influence: (state, effect) => ownKey(state.families, effect.familyId) && validRange(effect),
  stress: (state, effect) => isPerson(state, effect.personId) && validRange(effect),
  hook: (state, effect, known) => known.hooks.has(effect.hookId) && isPerson(state, effect.ownerId) && isPerson(state, effect.targetId) && HOOK_STRENGTHS.includes(effect.strength),
  secret: (state, effect, known) => known.secrets.has(effect.secretId) && SECRET_TYPES.includes(effect.type) && isPerson(state, effect.subjectId) && Array.isArray(effect.holderIds) && effect.holderIds.every((id) => isPerson(state, id)),
  memory: (state, effect, known) => known.memories.has(effect.memoryId) && ['private', 'public'].includes(effect.visibility) && typeof effect.title === 'string',
});

function checkEffects(state, entry, known) {
  if (!Array.isArray(entry.effects)) fail(LOG.effect);
  for (const effect of entry.effects) if (!plainObject(effect) || !ownKey(EFFECT_CHECKS, effect.kind) || !EFFECT_CHECKS[effect.kind](state, effect, known)) fail(LOG.effect);
}

function checkNarrative(entry) {
  const told = entry.narrative !== null;
  if (told && !(plainObject(entry.narrative) && boundedText(entry.narrative.title, TITLE_MAX) === entry.narrative.title && boundedText(entry.narrative.text, TEXT_MAX) === entry.narrative.text)) fail(LOG.narrative);
  const counted = Object.hasOwn(entry, 'rejectedAdjustments');
  if (told !== counted || (counted && !(Number.isInteger(entry.rejectedAdjustments) && entry.rejectedAdjustments >= 0))) fail(LOG.narrative);
}

/** Validates state.actionLog on load: ids `resolution-<n>` unique and within state.sequence, known actions and tiers, existing people, agents, memories, hooks and secrets, finite odds and rolls consistent with the refusal and the tier, ranged effects inside their stored ranges, and narratives within their limits. Throws a Swedish sentence naming the action log. */
export function validateActionLog(state) {
  if (!Array.isArray(state.actionLog)) fail(LOG.list);
  const known = { memories: idSet(state.memories), hooks: idSet(state.hooks), secrets: idSet(state.secrets) };
  const ids = new Set();
  for (const entry of state.actionLog) {
    if (!plainObject(entry)) fail(LOG.entry);
    checkIdentity(state, entry, known);
    checkDice(entry);
    checkEffects(state, entry, known);
    checkNarrative(entry);
    if (ids.has(entry.id)) fail(LOG.id);
    ids.add(entry.id);
  }
}

const actorFamilyId = (state, entry) => personOf(state, entry.actorId)?.familyId ?? null;
const ownEntry = (state, entry, familyId) => entry.playerControlled === true || (familyId != null && actorFamilyId(state, entry) === familyId);

/** Whether the player may see an entry: their own actions (ordered by the player, or by a member of the controlled family) and every action whose tier exposed it. */
export function resolutionVisible(state, entry, familyId) {
  return plainObject(entry) && (ownEntry(state, entry, familyId) || PUBLIC_TIERS.has(entry.tier));
}

// What the player reads about one resolution. Odds appear only for the player's own attempts and only as bandFor gives them at the stored precision: bands at 'five' and 'three', never the stored numbers. Rolls are never shown, since they would bound the hidden odds.
function presentResolution(state, entry, familyId) {
  const own = ownEntry(state, entry, familyId);
  const name = (lookup, id) => lookup?.[id]?.name || id;
  return {
    id: entry.id, actionId: entry.actionId, actionLabel: ownKey(ACTION_CATALOG, entry.actionId) ? ACTION_CATALOG[entry.actionId].label : entry.actionId,
    actorId: entry.actorId, actorName: name(state.people, entry.actorId), targetIds: [...entry.targetIds], targetNames: entry.targetIds.map((id) => name(state.people, id)),
    agentNames: own ? entry.agentIds.map((id) => name(state.courtStaff, id)) : [], date: entry.date, tier: entry.tier,
    tierLabel: entry.refused ? REFUSED_TITLE : TIER_TITLES[entry.tier] || '', refused: entry.refused,
    odds: entry.playerControlled === true ? { success: bandFor(entry.estimate.success, entry.precision), secrecy: bandFor(entry.estimate.secrecy, entry.precision) } : null,
    effects: own ? copy(entry.effects) : [], narrative: entry.narrative ? { ...entry.narrative } : null,
  };
}

/** The last ten action log entries the player may see, oldest first. */
export function presentResolutions(state, familyId) {
  return (state.actionLog || []).filter((entry) => resolutionVisible(state, entry, familyId)).slice(-RECENT_LIMIT).map((entry) => presentResolution(state, entry, familyId));
}

/** Active schemes the player started whose actor belongs to the controlled family (an NPC scheme stays hidden even if its actor later joins the family). Only named fields are passed on, so a scheme's stored odds never reach the player. */
export function presentSchemes(state, familyId) {
  if (familyId == null || !Array.isArray(state.schemes)) return [];
  return state.schemes.filter((scheme) => plainObject(scheme) && scheme.status === 'active' && scheme.playerControlled === true && actorFamilyId(state, scheme) === familyId).map((scheme) => {
    const targetIds = Array.isArray(scheme.targetIds) ? [...scheme.targetIds] : [];
    const dates = Object.fromEntries(SCHEME_FIELDS.filter((key) => typeof scheme[key] === 'string').map((key) => [key, scheme[key]]));
    return { id: scheme.id, actionId: scheme.actionId, actionLabel: ownKey(ACTION_CATALOG, scheme.actionId) ? ACTION_CATALOG[scheme.actionId].label : scheme.actionId,
      actorId: scheme.actorId, actorName: state.people[scheme.actorId].name, targetIds, targetNames: targetIds.map((id) => personOf(state, id)?.name || id), status: scheme.status, ...dates };
  });
}

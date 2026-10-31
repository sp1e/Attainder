import { normalizeGameDate, compareGameDates } from '../gameDates.js';
import { RUMOR_TOPICS } from './actionCatalog.js';
import { isAdultCharacter } from './characterCapacity.js';
import { plotRandom, spymasterOf } from './extensions.js';
import { isImprisoned } from './prisoners.js';

// Rumors: what the controlled family hears. A record is { id: 'rumor-<n>', date, topic, subjectId, claimedActorId, truthful, reliability, sourceKind, sourceId, heardByFamilyId } and lives in state.rumors.
// Two sources: a scheme of another house that the spymaster (else the representative) picks up on a monthly check, and a spread_rumor action, which every family hears and which is never true.
// Hearing, accuracy and the false-name pick draw only from the plot stream (plotRandom). Presentation and validation draw nothing, and `truthful` and `sourceId` never leave the engine.
// The topic table is the catalog's (a player picks it as means.topic). This file imports prisoners.js but not schemes.js or actionResolution.js, which import it.

export { RUMOR_TOPICS };
export const RUMOR_RELIABILITY = Object.freeze(['osäker', 'trolig', 'säker']);
export const RUMOR_SOURCES = Object.freeze(['scheme', 'action']);
export const EVERYONE = '*';
export const MAX_PER_SCHEME = 3;
export const PRESENTED = 20;
// Chance to hear a plan on one check = clamp(5 + listener intrigue × 2, 5, 50) percent; accuracy = clamp(40 + intrigue × 3, 40, 95) percent.
const HEARING = Object.freeze({ base: 5, perIntrigue: 2, min: 5, max: 50 });
const ACCURACY = Object.freeze({ base: 40, perIntrigue: 3, min: 40, max: 95 });
// Accuracy below this many percent is uncertain, below the next likely, otherwise certain.
const UNCERTAIN_BELOW = 60;
const LIKELY_BELOW = 80;
// A made-up rumor (spread_rumor) is always passed on as hearsay.
const HEARSAY = 'osäker';
const KEYS = Object.freeze(['id', 'date', 'topic', 'subjectId', 'claimedActorId', 'truthful', 'reliability', 'sourceKind', 'sourceId', 'heardByFamilyId']);
// Fields the caller gives createRumor; the id and the date are written there.
const FIELDS = KEYS.filter((key) => key !== 'id' && key !== 'date');

const INVALID = Object.freeze({
  list: 'Ryktena i sparfilen är ogiltiga.',
  entry: 'Ett rykte i sparfilen är ogiltigt.',
  id: 'Ett rykte har ett ogiltigt eller dubblerat id.',
  person: 'Ett rykte hänvisar till en saknad person eller familj.',
  date: 'Ett rykte har ett ogiltigt datum.',
  source: 'Ett rykte stämmer inte med sin källa.',
  scheme: 'Ryktena hör inte ihop med planerna: en plan har högst tre rykten.',
});

const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const ownKey = (map, key) => typeof key === 'string' && plainObject(map) && Object.hasOwn(map, key);
const list = (state) => (Array.isArray(state.rumors) ? state.rumors : []);
const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const personOf = (state, id) => (ownKey(state.people, id) ? state.people[id] : null);
// Ids are `rumor-<n>` with n from state.sequence, like schemes and prisoners.
const numberOf = (id) => Number(/^rumor-([1-9]\d*)$/.exec(id)?.[1] ?? Number.NaN);
const fail = (message) => { throw new Error(message); };

const reliabilityFor = (accuracy) => (accuracy < UNCERTAIN_BELOW ? RUMOR_RELIABILITY[0] : accuracy < LIKELY_BELOW ? RUMOR_RELIABILITY[1] : RUMOR_RELIABILITY[2]);
const topicOf = (scheme) => (scheme.actionId === 'poison' ? 'murder' : 'plot');
const schemeRumors = (state, schemeId) => list(state).filter((item) => item.sourceKind === 'scheme' && item.sourceId === schemeId);

function checkFields(fields) {
  const shaped = plainObject(fields) && FIELDS.every((key) => Object.hasOwn(fields, key));
  const text = (value) => typeof value === 'string' && value.length > 0;
  const valid = shaped && ownKey(RUMOR_TOPICS, fields.topic) && text(fields.subjectId) && (fields.claimedActorId === null || text(fields.claimedActorId)) && typeof fields.truthful === 'boolean'
    && RUMOR_RELIABILITY.includes(fields.reliability) && RUMOR_SOURCES.includes(fields.sourceKind) && text(fields.sourceId) && text(fields.heardByFamilyId);
  if (!valid) fail(INVALID.entry);
}

/**
 * Writes a rumor into state.rumors and returns it. `fields` are topic, subjectId, claimedActorId (an id or null), truthful, reliability, sourceKind, sourceId and heardByFamilyId (a family id or '*' for every family). The id is `rumor-<n>` from state.sequence and the date is today. Throws a Swedish sentence when a field has the wrong type or value; references are checked by validateRumors on load, since an action's log entry is written after its effects. Draws no randomness.
 */
export function createRumor(state, fields) {
  checkFields(fields);
  if (!Array.isArray(state.rumors)) state.rumors = [];
  const rumor = { id: `rumor-${++state.sequence}`, date: state.date, ...Object.fromEntries(FIELDS.map((key) => [key, fields[key]])) };
  state.rumors.push(rumor);
  return rumor;
}

// The one who listens: the spymaster at full intrigue, else the representative at half, rounded down. Nobody in prison listens (the office falls vacant on imprisonment, but the check is cheap).
function listenerOf(state, hooks) {
  const spymaster = spymasterOf(state);
  if (spymaster && !isImprisoned(state, spymaster.id)) return { person: spymaster, intrigue: finite(spymaster.skills?.intrigue) };
  const representative = hooks.activeRepresentative();
  if (!representative || representative.diedAt || isImprisoned(state, representative.id)) return null;
  return { person: representative, intrigue: Math.floor(finite(representative.skills?.intrigue) / 2) };
}

// A living adult outside the actor's and the controlled family, never the target and never a prisoner, in id order.
function falseNameCandidates(state, scheme, actor, family) {
  return Object.values(state.people)
    .filter((person) => isAdultCharacter(person, state.date) && person.familyId !== actor.familyId && person.familyId !== family.id && person.id !== scheme.targetIds[0] && !isImprisoned(state, person.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function pickFalseName(state, scheme, actor, family) {
  const candidates = falseNameCandidates(state, scheme, actor, family);
  return candidates.length ? candidates[Math.floor(plotRandom(state) * candidates.length)].id : null;
}

/**
 * Whether the controlled family hears of an active scheme of another house on this monthly check, and if so what. Returns the new rumor or null. The caller has already seen that the plan was not discovered on this check, and it must not call for a plan that the controlled family itself runs (the actor's family is checked here too).
 * One draw decides the hearing (nothing is drawn when nobody listens or the scheme already has three rumors); a second decides whether the account is true; a third picks the wrong name when it is not, and none is drawn when no one qualifies. All come from plotRandom.
 * `hooks` need controlledFamily and activeRepresentative (actionHooks in index.js). Called from schemes.js on every check, so schemes that Task 7 adds for NPCs are heard automatically.
 */
export function hearScheme(state, scheme, hooks) {
  const family = hooks.controlledFamily(), actor = personOf(state, scheme?.actorId);
  if (!family || !actor || actor.familyId === family.id || scheme.status !== 'active') return null;
  if (schemeRumors(state, scheme.id).length >= MAX_PER_SCHEME) return null;
  const listener = listenerOf(state, hooks);
  if (!listener) return null;
  const chance = clamp(HEARING.base + listener.intrigue * HEARING.perIntrigue, HEARING.min, HEARING.max);
  if (plotRandom(state) * 100 >= chance) return null;
  const accuracy = clamp(ACCURACY.base + listener.intrigue * ACCURACY.perIntrigue, ACCURACY.min, ACCURACY.max);
  const truthful = plotRandom(state) * 100 < accuracy;
  return createRumor(state, {
    topic: topicOf(scheme), subjectId: scheme.targetIds[0], claimedActorId: truthful ? actor.id : pickFalseName(state, scheme, actor, family),
    truthful, reliability: reliabilityFor(accuracy), sourceKind: 'scheme', sourceId: scheme.id, heardByFamilyId: family.id,
  });
}

/** The rumor the effect `rumor` of a spread_rumor action plants: about the target, no named culprit, never true, heard by every family. `sourceId` is the action's resolution id. */
export function spreadRumor(state, { topic, subjectId, resolutionId }) {
  return createRumor(state, { topic, subjectId, claimedActorId: null, truthful: false, reliability: HEARSAY, sourceKind: 'action', sourceId: resolutionId, heardByFamilyId: EVERYONE });
}

/** The last twenty rumors the family heard (its own and those everyone hears), newest first, with names and a topic label. `truthful`, `sourceId`, the source kind and the hearer are left out: they would tell a made-up rumor from a heard one. */
export function presentRumors(state, familyId) {
  if (familyId == null) return [];
  const name = (id) => (id == null ? null : personOf(state, id)?.name ?? id);
  return list(state).filter((item) => item.heardByFamilyId === familyId || item.heardByFamilyId === EVERYONE).slice(-PRESENTED).reverse().map((item) => ({
    id: item.id, date: item.date, topic: item.topic, topicLabel: RUMOR_TOPICS[item.topic], subjectId: item.subjectId, subjectName: name(item.subjectId),
    claimedActorId: item.claimedActorId, claimedActorName: name(item.claimedActorId), reliability: item.reliability,
  }));
}

function checkIdentity(state, item, ids) {
  if (!plainObject(item) || Object.keys(item).length !== KEYS.length || !KEYS.every((key) => Object.hasOwn(item, key))) fail(INVALID.entry);
  const number = numberOf(item.id);
  if (!Number.isInteger(number) || number > state.sequence || ids.has(item.id)) fail(INVALID.id);
  if (!ownKey(RUMOR_TOPICS, item.topic) || typeof item.truthful !== 'boolean' || !RUMOR_RELIABILITY.includes(item.reliability) || !RUMOR_SOURCES.includes(item.sourceKind)) fail(INVALID.entry);
  if (!personOf(state, item.subjectId) || (item.claimedActorId !== null && !personOf(state, item.claimedActorId))) fail(INVALID.person);
  if (item.heardByFamilyId !== EVERYONE && !ownKey(state.families, item.heardByFamilyId)) fail(INVALID.person);
  if (!canonical(item.date) || compareGameDates(item.date, state.date) > 0) fail(INVALID.date);
}

// A scheme rumor: about the scheme's target, on murder or plot, with the true actor named exactly when it is true, and heard by a family.
function checkSchemeSource(state, item) {
  const scheme = Array.isArray(state.schemes) ? state.schemes.find((candidate) => candidate?.id === item.sourceId) : null;
  if (!scheme || item.subjectId !== scheme.targetIds?.[0] || !['plot', 'murder'].includes(item.topic) || item.heardByFamilyId === EVERYONE) fail(INVALID.source);
  if (item.truthful ? item.claimedActorId !== scheme.actorId : item.claimedActorId === scheme.actorId) fail(INVALID.source);
}

// An action rumor: made up (never true, no culprit), heard by everyone, about the action's target, and named by a rumor effect of that log entry with the same topic.
function checkActionSource(state, item) {
  const entry = Array.isArray(state.actionLog) ? state.actionLog.find((candidate) => candidate?.id === item.sourceId) : null;
  const effect = Array.isArray(entry?.effects) ? entry.effects.find((candidate) => candidate?.kind === 'rumor' && candidate.rumorId === item.id) : null;
  if (!entry || !effect || effect.topic !== item.topic || item.subjectId !== entry.targetIds?.[0]) fail(INVALID.source);
  if (item.truthful || item.claimedActorId !== null || item.heardByFamilyId !== EVERYONE) fail(INVALID.source);
}

/** Validates state.rumors on load: ids `rumor-<n>` unique and within state.sequence, a known topic, reliability and source kind, existing people and family (or '*'), a canonical date not after today, and a source that matches: a scheme rumor names its actor exactly when it is true and a scheme has at most three; an action rumor is false, names nobody, is heard by everyone and is named by a rumor effect of its log entry. Throws a Swedish sentence about the rumors. Call after validateActionLog and validateSchemes. */
export function validateRumors(state) {
  if (!Array.isArray(state.rumors)) fail(INVALID.list);
  const ids = new Set(), perScheme = new Map();
  for (const item of state.rumors) {
    checkIdentity(state, item, ids);
    ids.add(item.id);
    if (item.sourceKind === 'action') {
      checkActionSource(state, item);
      continue;
    }
    checkSchemeSource(state, item);
    perScheme.set(item.sourceId, (perScheme.get(item.sourceId) ?? 0) + 1);
    if (perScheme.get(item.sourceId) > MAX_PER_SCHEME) fail(INVALID.scheme);
  }
}

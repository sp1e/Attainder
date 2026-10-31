import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { isAdultCharacter } from './characterCapacity.js';
import { isImprisoned } from './prisoners.js';

// Occasions: dated gatherings that change the odds of other actions. Phase 2 has one kind, the feast the player holds with the command hold_feast. An occasion is { id: 'occasion-<n>', kind, hostFamilyId, hostId, startedAt, endsAt, guestIds } and lives in state.occasions.
// Nothing here draws randomness. The odds side (feastRows) is pure; holdFeast is the only writer and runs inside a command.

export const OCCASION_KINDS = Object.freeze(['feast']);
export const FEAST = Object.freeze({ silver: 30, orders: 1, tag: 'generous', months: 1, cooldownMonths: 12, opinion: 5, opinionYears: 3 });
// Rows an intrigue action gains from a feast, in the shape of the odds rows in actionOdds.js.
export const FEAST_ROWS = Object.freeze({ success: Object.freeze({ label: 'Gästabudet ger tillträde', value: 15 }), secrecy: Object.freeze({ label: 'Hemlighållning: många vittnen på gästabudet', value: -5 }) });
const LABELS = Object.freeze({ feast: 'Gästabud' });

const MESSAGES = Object.freeze({
  recent: 'Familjen höll gästabud för mindre än ett år sedan.',
  noFamily: 'Ingen behörig resursägare finns.',
});
const INVALID = Object.freeze({
  list: 'Tillfällena i sparfilen är ogiltiga.',
  entry: 'Ett tillfälle i sparfilen är ogiltigt.',
  id: 'Ett tillfälle har ett ogiltigt eller dubblerat id.',
  family: 'Ett tillfälle hänvisar till en saknad familj eller värd.',
  date: 'Ett tillfälle har ogiltiga datum.',
  guests: 'Ett tillfälle har en ogiltig gästlista.',
});

const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const ownKey = (map, key) => typeof key === 'string' && plainObject(map) && Object.hasOwn(map, key);
const list = (state) => (Array.isArray(state.occasions) ? state.occasions : []);
const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;
// Ids are `occasion-<n>` with n from state.sequence, like schemes and resolutions.
const numberOf = (id) => Number(/^occasion-([1-9]\d*)$/.exec(id)?.[1] ?? Number.NaN);

/** Whether the occasion runs on `date`: startedAt <= date < endsAt. */
const running = (occasion, date) => compareGameDates(occasion.startedAt, date) <= 0 && compareGameDates(date, occasion.endsAt) < 0;

/** The feast `familyId` hosts on `date` (default: the state's date), else null. */
export function activeOccasion(state, familyId, date = state.date) {
  return list(state).find((occasion) => occasion.hostFamilyId === familyId && occasion.kind === 'feast' && running(occasion, date)) ?? null;
}

/** The refusal a new feast meets, or '': the family hosts one now or held one in the last twelve months. */
export function feastRefusal(state, familyId) {
  const recent = list(state).some((occasion) => occasion.hostFamilyId === familyId && occasion.kind === 'feast' && compareGameDates(addGameMonths(occasion.startedAt, FEAST.cooldownMonths), state.date) > 0);
  return recent ? MESSAGES.recent : '';
}

// Guests: every living adult of every family who is not in prison.
const guestsOf = (state) => Object.values(state.people).filter((person) => !person.diedAt && isAdultCharacter(person, state.date) && !isImprisoned(state, person.id)).map((person) => person.id);

/**
 * Runs the command hold_feast: refuses a second feast within twelve months, charges 30 silver and one order to the controlled family, opens a one-month feast occasion and lets each guest family's head think better of the host. Returns the occasion. Draws no randomness.
 * `hooks` are the engine's (actionHooks in index.js).
 */
export function holdFeast(state, events, hooks) {
  const family = hooks.controlledFamily();
  if (!family) throw new Error(MESSAGES.noFamily);
  const refusal = feastRefusal(state, family.id);
  if (refusal) throw new Error(refusal);
  const host = hooks.charge(FEAST.silver, { orders: FEAST.orders, tag: FEAST.tag });
  const occasion = {
    id: `occasion-${++state.sequence}`, kind: 'feast', hostFamilyId: family.id, hostId: host.id,
    startedAt: state.date, endsAt: addGameMonths(state.date, FEAST.months), guestIds: guestsOf(state),
  };
  state.occasions.push(occasion);
  const event = hooks.logEvent(events, 'feast', `${family.name} håller gästabud`, `${host.name} bjuder släkter och gäster till ett gästabud som varar en månad.`, [host.id]);
  const memory = hooks.memory('feast', event.title, [host.id], { causeId: event.id });
  const guestFamilies = new Set(occasion.guestIds.map((id) => state.people[id].familyId));
  guestFamilies.delete(family.id); // the host's own family is not courted
  for (const familyId of guestFamilies) {
    const head = state.people[state.families[familyId].headId];
    if (head && !head.diedAt) hooks.opinionCause(head.id, host.id, FEAST.opinion, 'Bjöds på gästabud', memory.id, FEAST.opinionYears);
  }
  return occasion;
}

/**
 * The situational rows the odds take from occasions (ctx.situation in actionOdds.js): { success: row[], secrecy: row[], occasionId }.
 * An intrigue-category action gains the feast rows when the actor's family hosts a feast that runs now and the target is on its guest list. On a scheme's due date (`means.scheduled`) only the feast the scheme stored in `means.occasionId` counts, and only if the actor's family hosted it; the feast running that day is never looked at. Otherwise the rows are empty and occasionId is null.
 */
export function feastRows(state, entry, actor, target, means) {
  const none = { success: [], secrecy: [], occasionId: null };
  if (entry.category !== 'intrigue') return none;
  const occasion = means?.scheduled === true ? storedFeast(state, actor, means.occasionId) : guestFeast(state, actor, target);
  return occasion ? { success: [{ ...FEAST_ROWS.success }], secrecy: [{ ...FEAST_ROWS.secrecy }], occasionId: occasion.id } : none;
}

function storedFeast(state, actor, id) {
  const named = typeof id === 'string' ? list(state).find((occasion) => occasion.id === id) : null;
  return named?.kind === 'feast' && named.hostFamilyId === actor.familyId ? named : null;
}

function guestFeast(state, actor, target) {
  const feast = activeOccasion(state, actor.familyId);
  return feast && feast.guestIds.includes(target.id) ? feast : null;
}

/** The occasions the controlled family hosts today, for the presentation. */
export function presentOccasions(state, familyId) {
  return list(state).filter((occasion) => occasion.hostFamilyId === familyId && running(occasion, state.date))
    .map((occasion) => ({ id: occasion.id, kind: occasion.kind, label: LABELS[occasion.kind] ?? occasion.kind, endsAt: occasion.endsAt, guestCount: occasion.guestIds.length }));
}

const fail = (message) => { throw new Error(message); };

function checkOccasion(state, occasion, ids) {
  if (!plainObject(occasion)) fail(INVALID.entry);
  const number = numberOf(occasion.id);
  if (!Number.isInteger(number) || number > state.sequence || ids.has(occasion.id)) fail(INVALID.id);
  if (!OCCASION_KINDS.includes(occasion.kind)) fail(INVALID.entry);
  const host = ownKey(state.people, occasion.hostId) ? state.people[occasion.hostId] : null;
  if (!ownKey(state.families, occasion.hostFamilyId) || !host || host.familyId !== occasion.hostFamilyId) fail(INVALID.family);
  const { startedAt, endsAt } = occasion;
  if (![startedAt, endsAt].every(canonical) || compareGameDates(startedAt, state.date) > 0 || endsAt !== addGameMonths(startedAt, FEAST.months)) fail(INVALID.date);
  const guests = occasion.guestIds;
  if (!Array.isArray(guests) || new Set(guests).size !== guests.length || !guests.every((id) => ownKey(state.people, id))) fail(INVALID.guests);
}

/** Validates state.occasions on load: unique ids `occasion-<n>` within state.sequence, a known kind, an existing host family and host from it, canonical dates with the end one month after the start and no start in the future, and a duplicate-free guest list of existing people. Throws a Swedish sentence about the occasions. */
export function validateOccasions(state) {
  if (!Array.isArray(state.occasions)) fail(INVALID.list);
  const ids = new Set();
  for (const occasion of state.occasions) {
    checkOccasion(state, occasion, ids);
    ids.add(occasion.id);
  }
}

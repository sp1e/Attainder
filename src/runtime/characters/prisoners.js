import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { crimeOfSecret } from './crimes.js';
import { plotRandom } from './extensions.js';

// Prisoners: persons the ruler holds. A record is { id: 'prisoner-<n>', personId, captorFamilyId, since, ransom, status, closedAt, reason } and lives in state.prisoners. While `status` is 'held' the person cannot act, holds no office and is no feast guest; every other status closes the record with a date and a reason.
// The yearly ransom step draws only from the plot stream (plotRandom). Nothing else here draws randomness.
// `hooks` are the engine's (actionHooks in index.js), so this module never reaches into private helpers.

export const RANSOM = 40;
export const PRISONER_STATUSES = Object.freeze(['held', 'released', 'ransomed', 'executed', 'dead']);
export const IMPRISONED = 'Personen sitter fängslad.';
// The family of a prisoner offers the ransom with this chance, when its treasury covers it.
const PAY_CHANCE = 0.6;
// What an unlawful imprisonment, an execution and each ransom outcome cost or give.
const UNLAWFUL_LEGITIMACY = -5;
const UNLAWFUL_GRIEVANCE = -8;
const EXECUTION_LEGITIMACY = -4;
const EXECUTION_OPINION = -50;
const RELEASE_OPINION = 10;
const ACCEPT_OPINION = 10;
const REFUSE_OPINION = -10;
const REVOLT_GRIEVANCE = -6;
const REVOLT_OPINION = -15;
const OFFER_MONTHS = 12;
const REASON_MAX = 200;
const NO_MANDATE = 'Kräver härskarmandat.';

const MESSAGES = Object.freeze({
  person: 'Personen lever inte eller saknas.',
  ruler: 'Härskaren kan inte fängslas.',
  representative: 'Den som företräder familjen eller riket kan inte fängslas.',
  family: 'Fängslande familj saknas.',
  unknown: 'Fången finns inte bland dem du håller.',
  cannotPay: 'Familjen kan inte längre betala lösen.',
  gone: 'Fången sitter inte längre fängslad.',
  cannotAfford: 'Familjekassan räcker inte till lösen.',
});
const INVALID = Object.freeze({
  list: 'Fångarna i sparfilen är ogiltiga.',
  entry: 'En fånge i sparfilen är ogiltig.',
  id: 'En fånge har ett ogiltigt eller dubblerat id.',
  person: 'En fånge hänvisar till en saknad person eller familj.',
  date: 'En fånge har ogiltiga datum.',
  status: 'En fånges status stämmer inte med dess avslut.',
});

const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const ownKey = (map, key) => typeof key === 'string' && plainObject(map) && Object.hasOwn(map, key);
const list = (state) => (Array.isArray(state.prisoners) ? state.prisoners : []);
const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;
const rounded = (value) => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// Ids are `prisoner-<n>` with n from state.sequence, like schemes and occasions.
const numberOf = (id) => Number(/^prisoner-([1-9]\d*)$/.exec(id)?.[1] ?? Number.NaN);

/** The open record of a held person, else null. */
export function prisonerOf(state, personId) {
  return list(state).find((record) => record.status === 'held' && record.personId === personId) ?? null;
}

/** Whether the person sits in prison. An imprisoned person cannot act. */
export function isImprisoned(state, personId) {
  return prisonerOf(state, personId) !== null;
}

/** The held records a family keeps (captor), in the order they were taken. */
export function heldPrisoners(state, captorFamilyId) {
  return list(state).filter((record) => record.status === 'held' && record.captorFamilyId === captorFamilyId);
}

const heldById = (state, id) => list(state).find((record) => record.id === id && record.status === 'held') ?? null;

/** Whether an imprisonment of this person is lawful: the person is the subject of an exposed secret that records a crime (crimeOfSecret), or the criminal of a 'crime' memory that exposeCrime wrote. An exposed opposition plot secret (undermine, a yearly plot) records no crime and does not count. */
export function isLawfulSubject(state, personId) {
  const convicted = (Array.isArray(state.secrets) ? state.secrets : []).some((secret) => secret.subjectId === personId && secret.exposed === true && crimeOfSecret(state, secret.id) !== null);
  // exposeCrime writes a 'crime' memory whose first participant is the criminal (the second is the victim). That covers a plot exposed as treason or attempted murder, whose secret has no action log entry for crimeOfSecret to read.
  return convicted || (Array.isArray(state.memories) ? state.memories : []).some((memory) => memory.type === 'crime' && memory.participants?.[0] === personId);
}

/** Why this person can never be imprisoned, or '': the ruler, and the person the player acts through (the active or the household representative), so the crown and the household always keep someone who can act. `hooks` need ruler, activeRepresentative and householdRepresentative. */
export function imprisonRefusal(personId, hooks) {
  if (hooks.ruler()?.id === personId) return MESSAGES.ruler;
  return [hooks.activeRepresentative?.(), hooks.householdRepresentative?.()].some((person) => person?.id === personId) ? MESSAGES.representative : '';
}

/**
 * Puts a living person in prison and returns the record. It refuses the ruler and the representatives (imprisonRefusal). The person's non-ruler offices fall vacant through the engine's own vacate path, and a public event and a memory record it. An unlawful imprisonment (not the subject of an exposed crime secret unless `lawful` says so) costs the realm 5 legitimacy and the person's family 8 grievance. Draws no randomness.
 * `hooks` need logEvent, memory, vacate, ruler, activeRepresentative and householdRepresentative.
 */
export function imprisonPerson(state, personId, captorFamilyId, events, hooks, { lawful = isLawfulSubject(state, personId) } = {}) {
  const person = ownKey(state.people, personId) ? state.people[personId] : null;
  if (!person || person.diedAt) throw new Error(MESSAGES.person);
  if (isImprisoned(state, personId)) throw new Error(IMPRISONED);
  const refusal = imprisonRefusal(personId, hooks);
  if (refusal) throw new Error(refusal);
  if (!ownKey(state.families, captorFamilyId)) throw new Error(MESSAGES.family);
  const record = { id: `prisoner-${++state.sequence}`, personId, captorFamilyId, since: state.date, ransom: RANSOM, status: 'held', closedAt: null, reason: null };
  state.prisoners.push(record);
  const ruler = hooks.ruler();
  const event = hooks.logEvent(events, 'imprisonment', `${person.name} fängslas`, `${person.name} sätts i fängelse${lawful ? ' efter ett avslöjat brott' : ' utan dom'}.`, [person.id, ruler?.id]);
  hooks.memory('imprisonment', event.title, [person.id, ruler?.id], { causeId: event.id });
  for (const office of Object.values(state.offices)) if (office.holderId === person.id && office.kind !== 'ruler') hooks.vacate(office, events, 'Fängslad');
  if (!lawful) {
    state.realm.legitimacy = clamp(state.realm.legitimacy + UNLAWFUL_LEGITIMACY, 0, 100);
    const family = state.families[person.familyId];
    family.grievance = clamp(family.grievance + UNLAWFUL_GRIEVANCE, -40, 40);
  }
  return record;
}

/** Closes the held record of a person with a status and a reason, and returns it; null when the person is not held. A record is closed once. */
export function closePrisoner(state, personId, status, reason) {
  const record = prisonerOf(state, personId);
  if (!record) return null;
  Object.assign(record, { status, closedAt: state.date, reason });
  return record;
}

// The record a command names, held by the controlled family. Any other id gets the same refusal.
function ownRecord(state, payload, hooks) {
  const id = plainObject(payload) ? payload.prisonerId : null;
  const record = typeof id === 'string' ? heldById(state, id) : null;
  if (!record || record.captorFamilyId !== hooks.controlledFamily()?.id) throw new Error(MESSAGES.unknown);
  return record;
}

const livingAdults = (state, hooks, familyId, exceptId) => Object.values(state.people).filter((person) => person.familyId === familyId && !person.diedAt && person.id !== exceptId && hooks.adult(person));

/** Runs the command release_prisoner: payload { prisonerId }. Costs one order (realm treasury, no silver). The prisoner and the head of his family think better of the ruler (+10). Draws no randomness. */
export function releasePrisoner(state, payload, events, hooks) {
  const record = ownRecord(state, payload, hooks);
  hooks.charge(0, { orders: 1, publicFunds: true, tag: 'duty' });
  const person = state.people[record.personId], ruler = hooks.ruler();
  closePrisoner(state, person.id, 'released', 'Frigiven av härskaren');
  const event = hooks.logEvent(events, 'prisoner_released', `${person.name} friges`, `${person.name} släpps ur fängelset.`, [person.id, ruler?.id]);
  const note = hooks.memory('prisoner_released', event.title, [person.id, ruler?.id], { causeId: event.id });
  const head = state.families[person.familyId]?.headId;
  if (ruler) for (const id of new Set([person.id, head])) if (id && !state.people[id]?.diedAt) hooks.opinionCause(id, ruler.id, RELEASE_OPINION, 'Frigiven ur fängelset', note.id);
  return record;
}

/** Runs the command execute_prisoner: payload { prisonerId }. Costs one order and the cruelty stress. The prisoner dies ('Avrättad'), every living adult of his family loses 50 opinion of the ruler, and an execution that is not lawful costs 4 legitimacy. Draws no randomness. */
export function executePrisoner(state, payload, events, hooks) {
  const record = ownRecord(state, payload, hooks);
  hooks.charge(0, { orders: 1, publicFunds: true, tag: 'cruel' });
  const person = state.people[record.personId], ruler = hooks.ruler(), lawful = isLawfulSubject(state, person.id);
  closePrisoner(state, person.id, 'executed', 'Avrättad');
  const event = hooks.logEvent(events, 'execution', `${person.name} avrättas`, `${person.name} avrättas i fängelset.`, [person.id, ruler?.id]);
  const note = hooks.memory('execution', event.title, [person.id, ruler?.id], { causeId: event.id });
  if (ruler) for (const kin of livingAdults(state, hooks, person.familyId, person.id)) hooks.opinionCause(kin.id, ruler.id, EXECUTION_OPINION, 'Avrättad släkting', note.id);
  if (!lawful) state.realm.legitimacy = clamp(state.realm.legitimacy + EXECUTION_LEGITIMACY, 0, 100);
  hooks.kill([person.id], events, 'Avrättad');
  return record;
}

/**
 * The prisoners belong to the crown. When `newFamilyId` takes the throne, every held record of another captor moves to that family; a prisoner of the new ruling family itself is released instead (reason 'Hans ätt tog tronen'). The person who is crowned is closed by the caller as 'Ärvde tronen'. Draws no randomness. `hooks` need logEvent.
 */
export function passCrown(state, newFamilyId, events, hooks) {
  for (const record of list(state).filter((item) => item.status === 'held' && item.captorFamilyId !== newFamilyId)) {
    const person = state.people[record.personId];
    if (person.familyId !== newFamilyId) {
      record.captorFamilyId = newFamilyId;
      continue;
    }
    closePrisoner(state, person.id, 'released', 'Hans ätt tog tronen');
    hooks.logEvent(events, 'prisoner_released', `${person.name} friges`, 'Hans ätt tog tronen. Fängelset öppnas för honom.', [person.id]);
  }
}

const openOffer = (state, record) => state.stories.some((story) => story.type === 'ransom_offer' && story.status === 'open' && story.prisonerId === record.id);

function offerRansom(state, record, hooks) {
  const person = state.people[record.personId], family = state.families[person.familyId], ruler = hooks.ruler();
  hooks.openStory({ type: 'ransom_offer', title: `Lösen för ${person.name}`, description: `${family.name} erbjuder ${record.ransom} silver för att ${person.name} ska friges.`,
    actorId: person.id, targetId: ruler.id, familyId: family.id, prisonerId: record.id, createdAt: state.date, dueAt: addGameMonths(state.date, OFFER_MONTHS), knownBy: 'public' });
}

// The captor's silver: a crown captor is paid into the realm treasury, any other captor into its family treasury.
const payee = (state, record, hooks) => (hooks.ruler()?.familyId === record.captorFamilyId ? state.realm : state.families[record.captorFamilyId]);

// A captor other than the controlled family demands a ransom for a prisoner of the controlled family. The story names the captor in familyId, which tells ransomChoices that the player pays.
function demandRansom(state, record, hooks) {
  const person = state.people[record.personId], captor = state.families[record.captorFamilyId];
  hooks.openStory({ type: 'ransom_offer', title: `Lösen för ${person.name}`, description: `${captor.name} kräver ${record.ransom} silver för att ${person.name} ska friges.`,
    actorId: person.id, targetId: captor.headId, familyId: captor.id, prisonerId: record.id, createdAt: state.date, dueAt: addGameMonths(state.date, OFFER_MONTHS), knownBy: 'public' });
}

// Moves the ransom from the prisoner's family to the captor and closes the record as ransomed, with a public event and a memory.
function payRansom(state, record, events, hooks) {
  const person = state.people[record.personId], family = state.families[person.familyId], captor = state.families[record.captorFamilyId];
  const wallet = payee(state, record, hooks);
  family.treasury = rounded(family.treasury - record.ransom);
  wallet.treasury = rounded(wallet.treasury + record.ransom);
  closePrisoner(state, person.id, 'ransomed', 'Lösen betald');
  const event = hooks.logEvent(events, 'prisoner_ransomed', `${person.name} löses ut`, `${family.name} betalar ${record.ransom} silver till ${captor.name} och ${person.name} friges.`, [person.id, captor.headId]);
  hooks.memory('ransom_accepted', event.title, [person.id, captor.headId], { causeId: event.id });
}

function prepareRevolt(state, record, events, hooks) {
  const person = state.people[record.personId], family = state.families[person.familyId], ruler = hooks.ruler();
  family.grievance = clamp(family.grievance + REVOLT_GRIEVANCE, -40, 40);
  const event = hooks.logEvent(events, 'revolt_prepared', `${family.name} rustar mot kronan`, `${family.name} finner sig inte i att ${person.name} sitter fängslad.`, [person.id, ruler.id]);
  const note = hooks.memory('revolt_prepared', event.title, [person.id, ruler.id], { causeId: event.id });
  const head = state.people[family.headId];
  if (head && !head.diedAt) hooks.opinionCause(head.id, ruler.id, REVOLT_OPINION, 'Släkting i fångenskap', note.id);
}

/**
 * The yearly step for the prisoners, in annualStep after aiAnnual and before npcPlotStep. It does nothing once the campaign has ended. A prisoner held by his own family is left alone, and so is a record with an open offer.
 * Prisoners the controlled family holds (needs a ruler): when his family's treasury covers the ransom and plotRandom() < 0.6, a ransom_offer story opens; otherwise the family prepares a revolt (grievance −6, the head's opinion of the ruler −15, a public event). The draw happens only when the treasury covers the ransom.
 * Prisoners another family holds (in family mode the crown can pass to an NPC family): one plotRandom() draw per record and year. Below 0.6 the captor demands a ransom from the controlled family when the prisoner is its kin (a ransom_offer the player can pay), and otherwise frees him when his family's treasury covers the ransom (payRansom).
 */
export function prisonerStep(state, events, hooks) {
  if (state.status?.ended) return;
  const controlled = hooks.controlledFamily(), ruler = hooks.ruler();
  if (controlled && ruler) {
    for (const record of heldPrisoners(state, controlled.id)) {
      const family = state.families[state.people[record.personId].familyId];
      if (family.id === controlled.id || openOffer(state, record)) continue;
      if (family.treasury >= record.ransom && plotRandom(state) < PAY_CHANCE) offerRansom(state, record, hooks);
      else prepareRevolt(state, record, events, hooks);
    }
  }
  for (const record of list(state).filter((item) => item.status === 'held' && item.captorFamilyId !== controlled?.id)) {
    const family = state.families[state.people[record.personId].familyId];
    if (family.id === record.captorFamilyId || openOffer(state, record)) continue;
    const pays = plotRandom(state) < PAY_CHANCE;
    if (family.id === controlled?.id) { if (pays) demandRansom(state, record, hooks); }
    else if (pays && family.treasury >= record.ransom) payRansom(state, record, events, hooks);
  }
}

// A ransom_offer whose familyId names the captor (demandRansom) is paid by the player's family, not offered to the crown.
const demanded = (state, story, record) => Boolean(record) && story.familyId === record.captorFamilyId && state.people[record.personId]?.familyId !== record.captorFamilyId;

/** The two answers to a ransom offer. `context.controller` tells whether the player holds the mandate. A demand from another captor (demandRansom) is paid from the prisoner's family treasury and needs no mandate, so a family whose head sits in prison can still buy him free. */
export function ransomChoices(state, story, { controller }) {
  const record = heldById(state, story.prisonerId);
  if (demanded(state, story, record)) {
    const person = state.people[record.personId], family = state.families[person.familyId], captor = state.families[record.captorFamilyId];
    return [
      { id: 'accept', label: 'Betala lösen', description: `${family.name} betalar ${record.ransom} silver till ${captor.name} och ${person.name} friges.`, cost: `${record.ransom} familjesilver`, stress: '0',
        disabledReason: family.treasury >= record.ransom ? '' : MESSAGES.cannotAfford },
      { id: 'refuse', label: 'Avstå', description: `${person.name} sitter kvar i fängelset.`, cost: '0 silver', stress: '0', disabledReason: '' },
    ];
  }
  const person = state.people[story.actorId], family = state.families[story.familyId];
  const mandate = controller ? '' : NO_MANDATE;
  const ransom = record?.ransom ?? RANSOM;
  return [
    { id: 'accept', label: 'Ta emot lösen', description: `${family?.name ?? 'Familjen'} betalar ${ransom} silver till statskassan och ${person?.name ?? 'fången'} friges. Familjens huvudman minns nåden (åsikt om dig +${ACCEPT_OPINION}).`, cost: '0 silver', stress: '0',
      disabledReason: mandate || (family && family.treasury >= ransom ? '' : MESSAGES.cannotPay) },
    { id: 'refuse', label: 'Avvisa erbjudandet', description: `${person?.name ?? 'Fången'} sitter kvar. Familjens huvudman tar det illa (åsikt om dig ${REFUSE_OPINION}).`, cost: '0 silver', stress: '0', disabledReason: mandate },
  ];
}

/** Applies the chosen answer to a ransom_offer story. `accept`: the family pays the ransom into the realm treasury, the prisoner is ransomed and his family head thinks better of the ruler; `refuse`: the prisoner stays and the head thinks worse. */
export function resolveRansom(state, story, choiceId, hooks, events = []) {
  const record = heldById(state, story.prisonerId);
  if (!record) throw new Error(MESSAGES.gone);
  if (demanded(state, story, record)) {
    if (choiceId !== 'accept') return;
    if (state.families[state.people[record.personId].familyId].treasury < record.ransom) throw new Error(MESSAGES.cannotAfford);
    payRansom(state, record, events, hooks);
    return;
  }
  const person = state.people[record.personId], family = state.families[person.familyId], ruler = hooks.ruler();
  const head = state.people[family.headId];
  const opinion = (amount, label, note) => { if (ruler && head && !head.diedAt) hooks.opinionCause(head.id, ruler.id, amount, label, note.id); };
  if (choiceId === 'accept') {
    if (family.treasury < record.ransom) throw new Error(MESSAGES.cannotPay);
    family.treasury = rounded(family.treasury - record.ransom);
    state.realm.treasury = rounded(state.realm.treasury + record.ransom);
    closePrisoner(state, person.id, 'ransomed', 'Lösen betald');
    const event = hooks.logEvent(events, 'prisoner_ransomed', `${person.name} löses ut`, `${family.name} betalar ${record.ransom} silver och ${person.name} friges.`, [person.id, ruler?.id]);
    opinion(ACCEPT_OPINION, 'Lösen mottogs', hooks.memory('ransom_accepted', event.title, [person.id, ruler?.id], { causeId: event.id }));
  } else if (choiceId === 'refuse') {
    opinion(REFUSE_OPINION, 'Lösen avvisades', hooks.memory('ransom_refused', 'Lösenerbjudandet avvisades', [person.id, ruler?.id]));
  }
}

/** The held prisoners of the controlled family, as the player reads them. */
export function presentPrisoners(state, familyId) {
  if (familyId == null) return [];
  return heldPrisoners(state, familyId).map((record) => {
    const person = state.people[record.personId];
    return { id: record.id, personId: person.id, name: person.name, familyId: person.familyId, familyName: state.families[person.familyId]?.name ?? '', since: record.since, ransom: record.ransom };
  });
}

const fail = (message) => { throw new Error(message); };

function checkRecord(state, record, ids) {
  if (!plainObject(record)) fail(INVALID.entry);
  const number = numberOf(record.id);
  if (!Number.isInteger(number) || number > state.sequence || ids.has(record.id)) fail(INVALID.id);
  if (!ownKey(state.people, record.personId) || !ownKey(state.families, record.captorFamilyId)) fail(INVALID.person);
  if (!canonical(record.since) || compareGameDates(record.since, state.date) > 0) fail(INVALID.date);
  if (!Number.isFinite(record.ransom) || record.ransom < 0) fail(INVALID.entry);
  if (!PRISONER_STATUSES.includes(record.status)) fail(INVALID.status);
  if (record.status === 'held') {
    if (record.closedAt !== null || record.reason !== null || state.people[record.personId].diedAt) fail(INVALID.status);
    return;
  }
  const closed = canonical(record.closedAt) && compareGameDates(record.closedAt, record.since) >= 0 && compareGameDates(record.closedAt, state.date) <= 0;
  if (!closed) fail(INVALID.date);
  if (typeof record.reason !== 'string' || !record.reason.trim() || record.reason.length > REASON_MAX) fail(INVALID.status);
}

/** Validates state.prisoners on load: ids `prisoner-<n>` unique and within state.sequence, existing person and family, canonical dates, a known status, an open record without closing date and reason and with a living person, a closed record with both, and at most one held record per person. Throws a Swedish sentence about the prisoners. */
export function validatePrisoners(state) {
  if (!Array.isArray(state.prisoners)) fail(INVALID.list);
  const ids = new Set(), held = new Set();
  for (const record of state.prisoners) {
    checkRecord(state, record, ids);
    ids.add(record.id);
    if (record.status === 'held') {
      if (held.has(record.personId)) fail(INVALID.status);
      held.add(record.personId);
    }
  }
}

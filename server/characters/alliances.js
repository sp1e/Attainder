import { addGameMonths, compareGameDates } from '../gameDates.js';
import { getCharacterAge } from './characterCapacity.js';
import { hashRoll } from './duels.js';
import { generatedAdultRecord, markGeneratedOrigin } from './election.js';
import { FOREIGN, foreignOpinion } from './foreignRealms.js';
import { hasLivingSpouse } from './marriage.js';
import { ensurePortraitIdentity } from './portraitState.js';
import { addPrestige } from './reign.js';

// A marriage to the neighbor's daughter brings his war (spec docs/superpowers/specs/2026-11-10-marriage-alliance-design.md). Historical campaigns only.
// Every roll is hashRoll of text; nothing here moves a random stream.
export const ALLIANCE = Object.freeze({ cost: 30, minOpinion: -20, war: 0.15, quietYears: 5, dueMonths: 6, join: 40,
  bond: Object.freeze({ label: 'Giftermål', amount: 20, years: 30 }) });
export const CALL_OUTCOMES = Object.freeze({
  win: Object.freeze({ prestige: 15, legitimacy: 5, army: 0, memory: Object.freeze({ label: 'Stod vid vår sida', amount: 15, years: 20 }) }),
  loss: Object.freeze({ prestige: 5, legitimacy: -5, army: -10, memory: Object.freeze({ label: 'Stod vid vår sida', amount: 10, years: 20 }) }),
  refuse: Object.freeze({ prestige: -10, legitimacy: 0, army: 0, memory: Object.freeze({ label: 'Svek i kriget', amount: -40, years: 30 }) }),
});
/** Nobody answering the ally in time counts as a refusal. */
export const CALL_EXPIRY = Object.freeze({ choiceId: 'refuse', text: 'Inget svar nådde den allierade i tid. Den allierade räknar det som ett svek.' });
const REFUSALS = Object.freeze({ hadara: 'Allianser genom giftermål finns bara i historiska kampanjer.', none: 'Inget grannhus har en ogift person att erbjuda.',
  person: 'Välj en ogift, myndig person i din familj.', partner: 'Välj en ogift person i ett grannhus.', sex: 'Paret måste vara av olika kön.' });
const CLOSED = Object.freeze({ mandate: 'Familjen har inte längre härskarens mandat.', replaced: 'Den som skulle svara företräder inte längre riket.', family: 'Familjen styrs inte längre av spelaren.', ended: 'Alliansen finns inte längre.' });
const clamp = (n) => Math.min(100, Math.max(0, n));

/** Adds a dated memory to a foreign realm. */
export function rememberAbroad(state, realm, { label, amount, years }) {
  realm.memories.push({ date: state.date, label, amount, until: addGameMonths(state.date, 12 * years) });
}

const neighbor = (state, realm) => realm.distanceKm != null && realm.distanceKm <= FOREIGN.neighborKm && !realm.alliance && foreignOpinion(state, realm.id) >= ALLIANCE.minOpinion;
const offered = (state, realm, person) => !person.diedAt && !person.spouseIds.length && person.id !== realm.rulerId && getCharacterAge(person, state.date) >= 16;

/** The foreign persons the player can marry into the court, as select options `{ value: '<realmId>|<personId>', label }`. Reads only. */
export function foreignPartners(state) {
  if (!state.historicalOrigin) return [];
  return state.foreignRealms.filter((realm) => neighbor(state, realm)).flatMap((realm) => Object.values(realm.people).filter((person) => offered(state, realm, person))
    .map((person) => ({ value: `${realm.id}|${person.id}`, label: `${person.name}, ${getCharacterAge(person, state.date)} år (${realm.name})` })));
}

/** The unmarried living adults of the controlled family. Reads only. */
export const marriageableKin = (state, hooks) => Object.values(state.people)
  .filter((person) => !person.diedAt && person.familyId === hooks.controlledFamily()?.id && hooks.adult(person) && !hasLivingSpouse(state, person))
  .sort((a, b) => a.id.localeCompare(b.id));

/** Why no foreign marriage can be offered now, or ''. Reads only. */
export function foreignMarriageRefusal(state, hooks) {
  if (!state.historicalOrigin) return REFUSALS.hadara;
  if (!marriageableKin(state, hooks).length) return REFUSALS.person;
  return foreignPartners(state).length ? '' : REFUSALS.none;
}

function partnerOf(state, partnerKey) {
  const [realmId, personId] = typeof partnerKey === 'string' ? partnerKey.split('|') : [];
  const realm = state.foreignRealms?.find((entry) => entry.id === realmId);
  const person = realm && Object.hasOwn(realm.people, personId) ? realm.people[personId] : null;
  if (!realm || !person || !neighbor(state, realm) || !offered(state, realm, person)) throw new Error(REFUSALS.partner);
  return { realm, person };
}

// The foreign person leaves the realm's record and enters the court as a generated adult of the spouse's family.
function bringToCourt(state, realm, foreign, spouse, id) {
  const record = generatedAdultRecord(state, { id, name: foreign.name, familyId: spouse.familyId, bornAt: foreign.bornAt, sex: foreign.sex,
    culture: spouse.culture, religionId: spouse.religionId, archetype: 'diplomat', skill: 5 });
  markGeneratedOrigin(state, record, `Ingift från ${realm.name}. Spelvärdena är genererade.`);
  ensurePortraitIdentity(record, state.people);
  delete realm.people[foreign.id];
  state.people[id] = record;
  return record;
}

/** Runs the command foreign_marriage after requireRule. `id` is the new court person's id. */
export function arrangeForeignMarriage(state, { personId, partnerKey }, actor, id, events, hooks) {
  if (!state.historicalOrigin) throw new Error(REFUSALS.hadara);
  const spouse = Object.hasOwn(state.people, personId) ? state.people[personId] : null;
  if (!marriageableKin(state, hooks).some((person) => person.id === spouse?.id)) throw new Error(REFUSALS.person);
  const { realm, person: foreign } = partnerOf(state, partnerKey);
  if (foreign.sex === spouse.sex) throw new Error(REFUSALS.sex);
  hooks.charge(ALLIANCE.cost, { publicFunds: true });
  const partner = bringToCourt(state, realm, foreign, spouse, id);
  spouse.spouseId = partner.id; partner.spouseId = spouse.id;
  hooks.addBond(spouse.id, partner.id, 'partner');
  const note = hooks.memory('marriage', `Ett äktenskap med ${realm.name}`, [spouse.id, partner.id]);
  hooks.opinionCause(spouse.id, partner.id, 20, 'Äktenskap', note.id, 0);
  hooks.opinionCause(partner.id, spouse.id, 20, 'Äktenskap', note.id, 0);
  realm.alliance = { since: state.date, personId: spouse.id, spouseId: partner.id };
  rememberAbroad(state, realm, ALLIANCE.bond);
  hooks.logEvent(events, 'foreign_marriage', `${spouse.name} gifter sig med ${partner.name}`, `Äktenskapet binder riket till ${realm.name}. ${actor.name} har slutit en allians.`, [spouse.id, partner.id]);
}

const callOpen = (state, realm) => state.stories.some((story) => story.type === 'call_to_arms' && story.realmId === realm.id
  && (story.status === 'open' || compareGameDates(addGameMonths(story.createdAt, 12 * ALLIANCE.quietYears), state.date) > 0));

function enemyOf(state, realm) {
  const others = state.foreignRealms.filter((entry) => entry.id !== realm.id);
  if (!others.length) return 'rikets fiender';
  return others[Math.floor(hashRoll(`${state.plotRngState}|${state.date}|enemy|${realm.id}`) * others.length)].name;
}

function callToArms(state, realm, events, hooks) {
  const actor = hooks.activeRepresentative(), family = hooks.controlledFamily(), ruler = realm.people[realm.rulerId];
  if (!actor || !family || !hooks.canRule() || callOpen(state, realm) || hashRoll(`${state.plotRngState}|${state.date}|war|${realm.id}`) >= ALLIANCE.war) return;
  const enemy = enemyOf(state, realm), title = `${realm.name} kallar till krig`;
  const event = hooks.logEvent(events, 'call_to_arms', title, `${ruler.name} går i krig mot ${enemy} och väntar sig att det allierade riket ställer upp.`, [actor.id]);
  state.stories.push({ id: `call-${realm.id}-${state.date}`, type: 'call_to_arms', status: 'open', title, causeId: event.id,
    description: `${ruler.name} kräver hjälp mot ${enemy}. Att vägra bryter alliansen, och ${realm.name} glömmer inte ett svek.`,
    realmId: realm.id, enemyName: enemy, seed: state.plotRngState, familyId: family.id, actorId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, ALLIANCE.dueMonths), knownBy: 'public' });
}

/** In courtAnnualStep: an alliance ends when a spouse dies; a living one may call the player to war. */
export function allianceStep(state, events, hooks) {
  if (!state.historicalOrigin) return;
  for (const realm of state.foreignRealms) {
    if (!realm.alliance) continue;
    const { personId, spouseId } = realm.alliance;
    if (state.people[personId]?.diedAt || state.people[spouseId]?.diedAt || !state.people[personId] || !state.people[spouseId]) {
      realm.alliance = null;
      hooks.logEvent(events, 'alliance_ended', `Alliansen med ${realm.name} upphör`, 'Äktenskapet som band rikena är över genom ett dödsfall.', []);
    } else callToArms(state, realm, events, hooks);
  }
}

/** The chance to win the ally's war, held to 0.2..0.8. Reads only. */
export const battleChance = (readiness) => Math.min(0.8, Math.max(0.2, 0.3 + readiness / 200));

/** The two answers to a call to arms. Reads only. */
export function callChoices(state, story, hooks) {
  const short = !hooks.canRule() ? 'Kräver härskarmandat.' : state.realm.treasury < ALLIANCE.join ? `Det behövs ${ALLIANCE.join} silver ur statskassan.` : '';
  const percent = Math.round(battleChance(hooks.militaryReadiness()) * 100);
  return [
    { id: 'join', label: 'Gå med i kriget', description: `Hären marscherar. Chansen att vinna är ${percent} procent; vinst ger ryktbarhet och legitimitet.`, cost: `${ALLIANCE.join} silver`, stress: '0', disabledReason: short },
    { id: 'refuse', label: 'Vägra', description: 'Riket håller sig utanför. Alliansen bryts, och den allierade minns sveket i trettio år.', cost: '0 silver', stress: '0', disabledReason: '' },
  ];
}

/** Applies a choice resolveStory has already checked, or the expiry. */
export function resolveCall(state, story, choiceId, events, hooks) {
  Object.assign(story, { status: 'resolved', choiceId, resolvedAt: state.date });
  const realm = state.foreignRealms.find((entry) => entry.id === story.realmId);
  let outcome = CALL_OUTCOMES.refuse;
  if (choiceId === 'join') {
    state.realm.treasury -= ALLIANCE.join;
    outcome = hashRoll(`${story.id}|${story.seed}|battle`) < battleChance(hooks.militaryReadiness()) ? CALL_OUTCOMES.win : CALL_OUTCOMES.loss;
  } else realm.alliance = null;
  addPrestige(state, outcome.prestige);
  state.realm.legitimacy = clamp(state.realm.legitimacy + outcome.legitimacy);
  state.realm.armyStrength = clamp(state.realm.armyStrength + outcome.army);
  rememberAbroad(state, realm, outcome.memory);
  const text = outcome === CALL_OUTCOMES.win ? `Kriget mot ${story.enemyName} vinns.` : outcome === CALL_OUTCOMES.loss ? `Kriget mot ${story.enemyName} går förlorat.` : `${realm.name} får gå i krig ensamt.`;
  hooks.logEvent(events, 'call_answered', choiceId === 'join' ? `Riket går i krig vid ${realm.name}s sida` : `Riket sviker ${realm.name}`, text, [story.actorId]);
}

/** Why an open call no longer stands, or '' while it does. Such a story closes with no effect. */
export function callClosedReason(state, story, hooks) {
  if (!state.foreignRealms?.find((entry) => entry.id === story.realmId)?.alliance) return CLOSED.ended;
  if (hooks.controlledFamily()?.id !== story.familyId) return CLOSED.family;
  if (!hooks.canRule()) return CLOSED.mandate;
  return hooks.activeRepresentative()?.id === story.actorId ? '' : CLOSED.replaced;
}

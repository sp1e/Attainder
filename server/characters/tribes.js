import { addGameMonths, compareGameDates, gameDateYear, normalizeGameDate } from '../gameDates.js';
import { hashRoll } from './duels.js';
import { FOREIGN, distanceKm } from './foreignRealms.js';
import { addPrestige } from './reign.js';

// Border tribes that can be bribed, hired or crushed (spec docs/superpowers/specs/2026-11-10-border-tribes-design.md). Historical campaigns only.
// The tribes come from historicalScenario.tribes, which no shipped package carries yet. Every roll is hashRoll of text; nothing moves a random stream.
export const TRIBE = Object.freeze({ tribes: 6, raid: 0.1, raidSilver: 15, raidLegitimacy: 2, bribe: 20, bribeMonths: 60, hire: 30, hireMonths: 36, hireBonus: 0.1,
  crush: 50, crushYears: 30, campaignMonths: 12 });
export const CAMPAIGN = Object.freeze({
  won: Object.freeze({ prestige: 10, army: -5 }),
  lost: Object.freeze({ prestige: -5, army: -10 }),
});
const REFUSALS = Object.freeze({ hadara: 'Gränsfolk finns bara i historiska kampanjer.', none: 'Inget gränsfolk kan väljas just nu.', tribe: 'Välj ett gränsfolk som kan tas emot.' });
const DATE_FIELDS = Object.freeze(['paidUntil', 'hiredUntil', 'crushedUntil', 'lastCampaign', 'lastRaid']);
const clamp = (n) => Math.min(100, Math.max(0, n));
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const point = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const after = (state, until) => until !== null && compareGameDates(until, state.date) > 0;

/** The tribes within reach of the home seat, nearest first, as state.tribes. Reads only; an entry without id, name or point is skipped. */
export function seedTribes(h, polityId) {
  const homeCourt = h.courtSeeds?.[polityId];
  const home = h.settlements?.find((entry) => entry.id === homeCourt?.seatId);
  if (!home || !Array.isArray(h.tribes)) return [];
  const seen = new Set();
  return h.tribes.filter((tribe) => plain(tribe) && typeof tribe.id === 'string' && tribe.id && typeof tribe.nameSv === 'string' && tribe.nameSv && point(tribe.coordinates)
    && !seen.has(tribe.id) && seen.add(tribe.id))
    .map((tribe) => ({ id: tribe.id, name: tribe.nameSv, distanceKm: distanceKm(home.coordinates, tribe.coordinates), ...Object.fromEntries(DATE_FIELDS.map((field) => [field, null])) }))
    .filter((tribe) => tribe.distanceKm <= FOREIGN.neighborKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id)).slice(0, TRIBE.tribes);
}

const paid = (state, tribe) => after(state, tribe.paidUntil);
const hired = (state, tribe) => after(state, tribe.hiredUntil);
const crushed = (state, tribe) => after(state, tribe.crushedUntil);
const restless = (state, tribe) => !paid(state, tribe) && !hired(state, tribe) && !crushed(state, tribe);
const campaignable = (state, tribe) => !hired(state, tribe) && !crushed(state, tribe)
  && (tribe.lastCampaign === null || compareGameDates(addGameMonths(tribe.lastCampaign, TRIBE.campaignMonths), state.date) <= 0);
const options = (state, test) => (state.historicalOrigin ? (state.tribes ?? []).filter((tribe) => test(state, tribe)).map((tribe) => ({ value: tribe.id, label: tribe.name })) : []);

/** The tribes a bribe or a hire can reach, as `{ value, label }`. Reads only. */
export const dealTargets = (state) => options(state, restless);
/** The tribes a campaign can strike. Reads only. */
export const crushTargets = (state) => options(state, campaignable);
/** Whether the campaign has any tribe to offer the command at all. Reads only. */
export const hasTribes = (state) => Boolean(state.historicalOrigin && state.tribes?.length);

function tribeFor(state, tribeId, test) {
  if (!state.historicalOrigin) throw new Error(REFUSALS.hadara);
  const tribe = typeof tribeId === 'string' ? state.tribes?.find((entry) => entry.id === tribeId) : undefined;
  if (!tribe || !test(state, tribe)) throw new Error(REFUSALS.tribe);
  return tribe;
}

/** Runs the command bribe_tribe after requireRule. */
export function bribeTribe(state, { tribeId }, actor, events, hooks) {
  const tribe = tribeFor(state, tribeId, restless);
  hooks.charge(TRIBE.bribe, { publicFunds: true, tag: 'generous' });
  tribe.paidUntil = addGameMonths(state.date, TRIBE.bribeMonths);
  hooks.logEvent(events, 'tribe_bribed', `${tribe.name} tar emot tribut`, `${actor.name} sänder ${TRIBE.bribe} silver. ${tribe.name} lovar att hålla sig borta från gränsen i ${TRIBE.bribeMonths / 12} år.`, [actor.id]);
}

/** Runs the command hire_tribe after requireRule. */
export function hireTribe(state, { tribeId }, actor, events, hooks) {
  const tribe = tribeFor(state, tribeId, restless);
  hooks.charge(TRIBE.hire, { publicFunds: true, tag: 'risky' });
  tribe.hiredUntil = addGameMonths(state.date, TRIBE.hireMonths);
  hooks.logEvent(events, 'tribe_hired', `${tribe.name} går i rikets sold`, `${actor.name} betalar ${TRIBE.hire} silver. Krigarna strider för riket i ${TRIBE.hireMonths / 12} år.`, [actor.id]);
}

/** The chance that a campaign against a tribe is won, held to 0.2..0.8. Reads only. */
export const campaignChance = (readiness) => Math.min(0.8, Math.max(0.2, 0.3 + readiness / 200));

/** Runs the command crush_tribe after requireRule: one campaign, settled at once. */
export function crushTribe(state, { tribeId }, actor, events, hooks) {
  const tribe = tribeFor(state, tribeId, campaignable);
  // Readiness is read before the charge, whose stress would otherwise lower it when the ruler is also the general.
  const chance = campaignChance(hooks.militaryReadiness());
  hooks.charge(TRIBE.crush, { publicFunds: true, tag: 'risky' });
  tribe.lastCampaign = state.date;
  const won = hashRoll(`${tribe.id}|${state.date}|crush`) < chance;
  const outcome = won ? CAMPAIGN.won : CAMPAIGN.lost;
  if (won) tribe.crushedUntil = addGameMonths(state.date, 12 * TRIBE.crushYears);
  addPrestige(state, outcome.prestige);
  state.realm.armyStrength = clamp(state.realm.armyStrength + outcome.army);
  hooks.logEvent(events, 'tribe_campaign', won ? `${tribe.name} slås tillbaka` : `Fälttåget mot ${tribe.name} misslyckas`,
    won ? `${actor.name} leder hären över gränsen. ${tribe.name} håller sig borta i ${TRIBE.crushYears} år.` : `${actor.name} förlorar män och anseende. ${tribe.name} finns kvar vid gränsen.`, [actor.id]);
}

/** Hired tribes, each worth one ally's bonus in a war over a border land (warChance). Reads only. */
export const hiredTribes = (state) => (state.tribes ?? []).filter((tribe) => hired(state, tribe)).length;

/** In courtAnnualStep: each restless tribe may raid. Returns the treasury delta for the year's accounts. */
export function tribeStep(state, events, hooks) {
  if (!state.historicalOrigin || !state.tribes?.length) return 0;
  const before = state.realm.treasury;
  for (const tribe of state.tribes) {
    if (!restless(state, tribe) || hashRoll(`${state.plotRngState}|${state.date}|${tribe.id}|raid`) >= TRIBE.raid) continue;
    const loss = Math.min(Math.max(0, state.realm.treasury), TRIBE.raidSilver);
    state.realm.treasury -= loss;
    state.realm.legitimacy = clamp(state.realm.legitimacy - TRIBE.raidLegitimacy);
    tribe.lastRaid = state.date;
    hooks.logEvent(events, 'tribe_raid', `Räd från ${tribe.name}`, `${tribe.name} plundrar gränsbygden. Riket förlorar ${loss} silver och anseende.`, []);
  }
  return Math.round((state.realm.treasury - before) * 100) / 100;
}

function tribeState(state, tribe) {
  if (hired(state, tribe)) return `i rikets sold till ${gameDateYear(tribe.hiredUntil)}`;
  if (crushed(state, tribe)) return `slaget till ${gameDateYear(tribe.crushedUntil)}`;
  if (paid(state, tribe)) return `betalt till ${gameDateYear(tribe.paidUntil)}`;
  return 'oroligt';
}

/** The tribes as the offices view shows them. Reads only. */
export const presentTribes = (state) => (state.historicalOrigin ? (state.tribes ?? []).map((tribe) => ({ id: tribe.id, name: tribe.name, distanceKm: tribe.distanceKm,
  stateLabel: tribeState(state, tribe), lastRaidYear: tribe.lastRaid ? gameDateYear(tribe.lastRaid) : null })) : []);

/** Saves from before border tribes: an empty list in historical campaigns, nothing in Hadara. */
export function ensureTribes(state) {
  if (state.historicalOrigin && !Object.hasOwn(state, 'tribes')) state.tribes = [];
}

const validTribe = (tribe) => plain(tribe) && typeof tribe.id === 'string' && tribe.id !== '' && typeof tribe.name === 'string'
  && (tribe.distanceKm === null || Number.isFinite(tribe.distanceKm)) && DATE_FIELDS.every((field) => tribe[field] === null || normalizeGameDate(tribe[field]) === tribe[field]);

export function validateTribes(state) {
  if (!Object.hasOwn(state, 'tribes')) return;
  const { tribes } = state;
  if (!state.historicalOrigin || !Array.isArray(tribes) || tribes.length > TRIBE.tribes || !tribes.every(validTribe) || new Set(tribes.map((tribe) => tribe.id)).size !== tribes.length) {
    throw new Error('Sparfilens gränsfolk är ogiltiga.');
  }
}

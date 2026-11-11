import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { rememberAbroad } from './alliances.js';
import { hashRoll } from './duels.js';
import { FOREIGN } from './foreignRealms.js';
import { addPrestige } from './reign.js';
import { TRIBE, hiredTribes } from './tribes.js';

// A fabricated claim on a neighbor's border land, pressed by war (spec docs/superpowers/specs/2026-11-10-fabricated-claim-design.md). Historical campaigns only.
// Every roll is hashRoll of text; nothing here moves a random stream, and the map does not change.
export const CLAIM = Object.freeze({ forge: 40, months: 24, exposure: 0.25, exposedPrestige: -5, war: 60, lands: 3, income: 10, decisive: 2, battles: 5, allyBonus: 0.1,
  exposed: Object.freeze({ label: 'Förfalskat anspråk', amount: -30, years: 20 }),
  declared: Object.freeze({ label: 'Krig om gränslandet', amount: -30, years: 20 }) });
export const WAR_ENDS = Object.freeze({
  victory: Object.freeze({ prestige: 20, legitimacy: 10, reparations: 0, memory: Object.freeze({ label: 'Förlorat land', amount: -50, years: 50 }) }),
  defeat: Object.freeze({ prestige: -10, legitimacy: -10, reparations: 50, memory: null }),
  stalemate: Object.freeze({ prestige: -5, legitimacy: 0, reparations: 0, memory: null }),
});
const BATTLE_ARMY = Object.freeze({ won: -5, lost: -10 });
const REFUSALS = Object.freeze({ hadara: 'Anspråk och krig finns bara i historiska kampanjer.', forging: 'Ett anspråk smids redan.', target: 'Välj ett grannrike utan allians, anspråk eller krig.',
  none: 'Inget grannrike kan bli mål för ett anspråk.', press: 'Välj ett rike där anspråket är färdigt.', war: 'Riket för redan ett krig.', peace: 'Välj ett rike som riket är i krig med.' });
const clamp = (n) => Math.min(100, Math.max(0, n));
const lands = (realm) => realm.lands ?? 0;
const realmOf = (state, realmId) => (typeof realmId === 'string' ? state.foreignRealms?.find((realm) => realm.id === realmId) : undefined);
/** The border land's name in the court log and the panel. */
export const borderLand = (realm) => `Gränslandet mot ${realm.name}`;

/** A neighbor that a claim or a holy war can strike. Reads only. */
export const targetable = (realm) => realm.distanceKm != null && realm.distanceKm <= FOREIGN.neighborKm && !realm.alliance && !realm.claim && !realm.war && lands(realm) < CLAIM.lands;
/** Whether the player's realm fights any war. Reads only. */
export const atWar = (state) => state.foreignRealms.some((realm) => realm.war);

/** The realms a claim can be fabricated on, as `{ value, label }`. Reads only. */
export const claimTargets = (state) => (state.historicalOrigin ? state.foreignRealms.filter(targetable).map((realm) => ({ value: realm.id, label: realm.name })) : []);
/** The realms with a ready claim, while no war runs. Reads only. */
export const pressTargets = (state) => (state.historicalOrigin && !atWar(state) ? state.foreignRealms.filter((realm) => realm.claim?.status === 'ready').map((realm) => ({ value: realm.id, label: realm.name })) : []);
/** The realms at war with the player. Reads only. */
export const peaceTargets = (state) => (state.historicalOrigin ? state.foreignRealms.filter((realm) => realm.war).map((realm) => ({ value: realm.id, label: realm.name })) : []);

/** Why no claim can be fabricated now, or ''. Reads only. */
export function claimRefusal(state) {
  if (!state.historicalOrigin) return REFUSALS.hadara;
  if (state.foreignRealms.some((realm) => realm.claim?.status === 'forging')) return REFUSALS.forging;
  return claimTargets(state).length ? '' : REFUSALS.none;
}

/** Runs the command fabricate_claim after requireRule. */
export function fabricateClaim(state, { realmId }, actor, events, hooks) {
  const refusal = claimRefusal(state);
  if (refusal) throw new Error(refusal);
  const realm = realmOf(state, realmId);
  if (!realm || !targetable(realm)) throw new Error(REFUSALS.target);
  hooks.charge(CLAIM.forge, { publicFunds: true, tag: 'risky' });
  realm.claim = { since: state.date, readyAt: addGameMonths(state.date, CLAIM.months), status: 'forging', exposed: false };
  hooks.logEvent(events, 'claim_forging', `Ett anspråk på ${borderLand(realm)} smids`, `${actor.name} låter skrivare leta fram gamla arvsrätter. Anspråket är klart om ${CLAIM.months / 12} år.`, [actor.id]);
}

/** Runs the command declare_war after requireRule. */
export function declareWar(state, { realmId }, actor, events, hooks) {
  if (!state.historicalOrigin) throw new Error(REFUSALS.hadara);
  if (atWar(state)) throw new Error(REFUSALS.war);
  const realm = realmOf(state, realmId);
  if (realm?.claim?.status !== 'ready') throw new Error(REFUSALS.press);
  hooks.charge(CLAIM.war, { publicFunds: true, tag: 'risky' });
  realm.war = { since: state.date, score: 0, battles: 0 };
  rememberAbroad(state, realm, CLAIM.declared);
  hooks.logEvent(events, 'war_declared', `Krig mot ${realm.name}`, `${actor.name} gör anspråk på ${borderLand(realm)} och för hären över gränsen.`, [actor.id]);
}

/** The claim and the war end; the outcome falls on the player's realm, and the foreign realm keeps the outcome's memory. */
export function endWar(state, realm, outcome, events, hooks, text) {
  if (outcome === WAR_ENDS.victory) realm.lands = lands(realm) + 1;
  realm.claim = null; realm.war = null;
  addPrestige(state, outcome.prestige);
  state.realm.legitimacy = clamp(state.realm.legitimacy + outcome.legitimacy);
  state.realm.treasury -= Math.min(Math.max(0, state.realm.treasury), outcome.reparations);
  if (outcome.memory) rememberAbroad(state, realm, outcome.memory);
  hooks.logEvent(events, 'war_ended', `Kriget mot ${realm.name} är över`, text, []);
}

/** Runs the command make_peace after requireRule: a stalemate. */
export function makePeace(state, { realmId }, actor, events, hooks) {
  if (!state.historicalOrigin) throw new Error(REFUSALS.hadara);
  const realm = realmOf(state, realmId);
  if (!realm?.war) throw new Error(REFUSALS.peace);
  hooks.charge(0, { publicFunds: true, tag: 'surrender' });
  endWar(state, realm, WAR_ENDS.stalemate, events, hooks, `${actor.name} sluter fred. ${borderLand(realm)} stannar hos ${realm.name}.`);
}

/** The chance to win a battle, held to 0.2..0.8: allied realms and hired border tribes (tribes spec) each add their bonus. Reads only. */
export function warChance(state, realm, readiness) {
  const allies = state.foreignRealms.filter((entry) => entry.id !== realm.id && entry.alliance).length;
  return Math.min(0.8, Math.max(0.2, 0.3 + readiness / 200 + CLAIM.allyBonus * allies + TRIBE.hireBonus * hiredTribes(state)));
}

function ripen(state, realm, events, hooks) {
  const { claim } = realm;
  if (claim.status !== 'forging' || compareGameDates(claim.readyAt, state.date) > 0) return;
  claim.status = 'ready';
  claim.exposed = hashRoll(`${realm.id}|${claim.since}|exposed`) < CLAIM.exposure;
  if (claim.exposed) { rememberAbroad(state, realm, CLAIM.exposed); addPrestige(state, CLAIM.exposedPrestige); }
  hooks.logEvent(events, 'claim_ready', `Anspråket på ${borderLand(realm)} är klart`,
    claim.exposed ? `Förfalskningen har avslöjats, och ${realm.name} vet om den.` : 'Ingen har genomskådat förfalskningen.', []);
}

function battle(state, realm, events, hooks) {
  const { war } = realm;
  if (compareGameDates(war.since, state.date) >= 0) return;
  const won = hashRoll(`${realm.id}|${war.since}|${state.date}|battle`) < warChance(state, realm, hooks.militaryReadiness());
  war.score += won ? 1 : -1;
  war.battles += 1;
  state.realm.armyStrength = clamp(state.realm.armyStrength + (won ? BATTLE_ARMY.won : BATTLE_ARMY.lost));
  hooks.logEvent(events, 'battle', won ? `Seger mot ${realm.name}` : `Nederlag mot ${realm.name}`, `Ställningen i kriget om ${borderLand(realm)} är ${war.score > 0 ? '+' : ''}${war.score}.`, []);
  if (war.score >= CLAIM.decisive) endWar(state, realm, WAR_ENDS.victory, events, hooks, `${borderLand(realm)} tillhör nu riket och ger ${CLAIM.income} silver om året.`);
  else if (war.score <= -CLAIM.decisive) endWar(state, realm, WAR_ENDS.defeat, events, hooks, `Riket betalar ${WAR_ENDS.defeat.reparations} silver i skadestånd.`);
  else if (war.battles >= CLAIM.battles) endWar(state, realm, WAR_ENDS.stalemate, events, hooks, 'Ingen sida orkar längre. Gränsen ligger kvar.');
}

/** In courtAnnualStep: a forged claim ripens, a war fights its battle and the border lands taken pay into the treasury. Returns the treasury delta for the year's accounts. */
export function claimStep(state, events, hooks) {
  if (!state.historicalOrigin) return 0;
  const before = state.realm.treasury;
  for (const realm of state.foreignRealms) {
    if (realm.claim) ripen(state, realm, events, hooks);
    if (realm.war) battle(state, realm, events, hooks);
  }
  state.realm.treasury += CLAIM.income * state.foreignRealms.reduce((sum, realm) => sum + lands(realm), 0);
  return Math.round((state.realm.treasury - before) * 100) / 100;
}

/** The claim, war and land fields of a realm row in the panel. Reads only. */
export const presentClaim = (realm) => ({ claim: realm.claim?.status ?? null, war: realm.war ? { score: realm.war.score } : null, lands: lands(realm) });

const date = (value) => normalizeGameDate(value) === value;
/** A save's claim, war and land fields on one realm; each may be absent. */
export function validClaimFields(realm) {
  const { claim, war } = realm;
  const claimOk = claim == null || (claim !== null && typeof claim === 'object' && date(claim.since) && date(claim.readyAt) && ['forging', 'ready'].includes(claim.status) && typeof claim.exposed === 'boolean');
  const warOk = war == null || (typeof war === 'object' && date(war.since) && Number.isInteger(war.score) && Math.abs(war.score) < CLAIM.decisive
    && Number.isInteger(war.battles) && war.battles >= 0 && war.battles < CLAIM.battles && claim?.status === 'ready');
  return claimOk && warOk && (realm.lands === undefined || (Number.isInteger(realm.lands) && realm.lands >= 0 && realm.lands <= CLAIM.lands));
}

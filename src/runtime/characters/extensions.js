import { ADULT_AGE } from './content.js';
import { getCharacterAge } from './characterCapacity.js';
import { validateCourtStaff } from './courtStaff.js';
import { defaultReign } from './reign.js';
import { syncPlotSecrets, validateSecrets } from './secrets.js';

export const EXTENSIONS_VERSION = 3;
export const DIFFICULTIES = Object.freeze({ easy: 'Lätt', normal: 'Normal', hard: 'Svår' });
export const DEFAULT_DIFFICULTY = 'normal';
const CONTAINER_LISTS = ['secrets', 'hooks', 'relationships', 'schemes', 'actionLog', 'occasions', 'prisoners', 'rumors', 'conversations', 'nicknames', 'familyDemands', 'factions'];
// Version 2 adds the spymaster office. Vacant until the ruler appoints; kind 'council' keeps it out of the governor, general, chancellor and priest effects.
const spymasterOffice = () => ({ id: 'spymaster', name: 'Spionmästare', kind: 'council', holderId: null, regentId: null, history: [], publicBudget: 0 });
const validStream = (value) => Number.isInteger(value) && value >= 1 && value <= 0xffffffff;
const SKILL_MAX = 20;
const INTRIGUE_ARCHETYPES = { schemer: 5, diplomat: 2, legislator: 1 };
const INTRIGUE_TRAITS = { ambitious: 1, vengeful: 1, dutiful: -1, compassionate: -1 };
const PROWESS_ARCHETYPES = { commander: 4, guardian: 2, builder: 1 };
const PROWESS_TRAITS = { vengeful: 1, cautious: -1 };
const bonus = (table, key) => Object.hasOwn(table, key) ? table[key] : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const seeded = (text) => { let n = 2166136261; for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619); return n >>> 0 || 1; };

/** Unknown or non-string difficulty ids fall back to normal. */
export const normalizeDifficulty = (value) => typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value) ? value : DEFAULT_DIFFICULTY;

/** Pure formula for the two skills added in extensions version 1. A date lets children under 18 get half; without one the person counts as an adult. */
export function deriveExtendedSkills(person, date = null) {
  const skills = person?.skills || {}, traits = new Set(Array.isArray(person?.traits) ? person.traits : []);
  const skill = (key) => Number.isFinite(skills[key]) ? skills[key] : 0;
  const traitBonus = (table) => [...traits].reduce((sum, trait) => sum + bonus(table, trait), 0);
  const intrigue = clamp(Math.round(2 + skill('diplomacy') * 0.4 + skill('learning') * 0.2 + bonus(INTRIGUE_ARCHETYPES, person?.archetype) + traitBonus(INTRIGUE_TRAITS)), 1, SKILL_MAX);
  const prowess = clamp(Math.round(2 + skill('command') * 0.6 + bonus(PROWESS_ARCHETYPES, person?.archetype) + traitBonus(PROWESS_TRAITS)), 1, SKILL_MAX);
  const child = date != null && getCharacterAge(person, person?.diedAt || date) < ADULT_AGE;
  return child ? { intrigue: Math.max(1, Math.round(intrigue / 2)), prowess: Math.max(1, Math.round(prowess / 2)) } : { intrigue, prowess };
}

/** Idempotent migration from a save without extensions. Fills only missing fields, never overwrites, and draws from no random stream. Version 2 adds the plot stream (seeded like the action stream, with the suffix `plots`), four empty ledgers and a vacant spymaster office. Version 3 adds three empty court ledgers and the reign record, counted from the save's own date. Private plot memories become plot secrets (syncPlotSecrets); that spends state.sequence for the new ids but no randomness. The action stream is seeded per campaign: polity, start date and the main stream's value at the moment it is first filled (the seed at creation, the save's current value on migration). */
export function ensureCharacterExtensions(state) {
  if (!Object.hasOwn(state, 'extensionsVersion')) state.extensionsVersion = EXTENSIONS_VERSION;
  if (!Object.hasOwn(state, 'difficulty')) state.difficulty = DEFAULT_DIFFICULTY;
  if (!Object.hasOwn(state, 'actionRngState')) state.actionRngState = seeded(`${state.identity?.polityId}|${state.startedAt}|${state.rngState}|actions`);
  if (!Object.hasOwn(state, 'plotRngState')) state.plotRngState = seeded(`${state.identity?.polityId}|${state.startedAt}|${state.rngState}|plots`);
  for (const key of CONTAINER_LISTS) if (!Object.hasOwn(state, key)) state[key] = [];
  if (!Object.hasOwn(state, 'courtStaff')) state.courtStaff = {};
  if (plainObject(state.offices) && !Object.hasOwn(state.offices, 'spymaster')) state.offices.spymaster = spymasterOffice();
  if (!Object.hasOwn(state, 'reign')) state.reign = defaultReign(state);
  if (state.extensionsVersion === 1 || state.extensionsVersion === 2) state.extensionsVersion = EXTENSIONS_VERSION; // any other version is left for validation to refuse
  for (const person of Object.values(state.people || {})) {
    if (!plainObject(person) || !plainObject(person.skills)) continue;
    const missing = ['intrigue', 'prowess'].filter((key) => !Object.hasOwn(person.skills, key));
    if (!missing.length) continue;
    const derived = deriveExtendedSkills(person, state.date);
    for (const key of missing) person.skills[key] = derived[key];
  }
  syncPlotSecrets(state);
}

export function validateCharacterExtensions(state) {
  if (state.extensionsVersion !== EXTENSIONS_VERSION) throw new Error('Karaktärstilläggens version stöds inte.');
  if (typeof state.difficulty !== 'string' || !Object.hasOwn(DIFFICULTIES, state.difficulty)) throw new Error('Sparfilens svårighetsgrad är ogiltig.');
  if (!validStream(state.actionRngState)) throw new Error('Handlingarnas slumptillstånd är ogiltigt.');
  if (!validStream(state.plotRngState)) throw new Error('Intrigens slumptillstånd är ogiltigt.');
  if (CONTAINER_LISTS.some((key) => !Array.isArray(state[key])) || !plainObject(state.courtStaff)) throw new Error('Karaktärstilläggens samlingar är ogiltiga.');
  for (const person of Object.values(state.people || {})) {
    if (['intrigue', 'prowess'].some((key) => !Number.isFinite(person?.skills?.[key]) || person.skills[key] < 0 || person.skills[key] > SKILL_MAX)) throw new Error('En person har ogiltig intrig eller kampförmåga.');
  }
  validateSecrets(state);
  validateCourtStaff(state);
}

/** Separate xorshift stream for actions. Same algorithm as random() in index.js but it only ever touches state.actionRngState. */
export function actionRandom(state) { let n = state.actionRngState | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; state.actionRngState = n >>> 0 || 1; return state.actionRngState / 4294967296; }

/** Separate xorshift stream for plots. Same algorithm as actionRandom but it only ever touches state.plotRngState. */
export function plotRandom(state) { let n = state.plotRngState | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; state.plotRngState = n >>> 0 || 1; return state.plotRngState / 4294967296; }

/** The living holder of the spymaster office, else null. */
export function spymasterOf(state) { const person = state.people?.[state.offices?.spymaster?.holderId]; return person && !person.diedAt ? person : null; }

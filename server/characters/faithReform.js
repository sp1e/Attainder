import { addGameMonths, compareGameDates, gameDateYear, normalizeGameDate } from '../gameDates.js';
import { hashRoll } from './duels.js';
import { addPrestige } from './reign.js';

// The ruler reforms the faith or founds a new one, and the priesthood splits (spec docs/superpowers/specs/2026-11-11-faith-reform-design.md).
// Historical campaigns only. Every roll is hashRoll of text; nothing moves a random stream.
export const FAITH_REFORM = Object.freeze({ cost: 60, waitYears: 30, support: 30, perFamily: 10, supportCap: 70, liked: 20, likedBonus: 0.2, opinionYears: 20 });
export const FAITH_MODES = Object.freeze({
  reform: Object.freeze({ label: 'Reformera tron', follow: 0.5, oldSupport: -10, prestige: 10, legitimacy: -5, grudge: Object.freeze({ label: 'Reformen', value: -10 }) }),
  found: Object.freeze({ label: 'Grunda en ny tro', follow: 0.25, oldSupport: -15, prestige: 15, legitimacy: -10, grudge: Object.freeze({ label: 'Kätteri vid hovet', value: -20 }) }),
});
const REASONS = Object.freeze({ hadara: 'Trosreformer finns bara i historiska kampanjer.', ruler: 'Riket saknar en vuxen härskare.', faith: 'Härskarens tro finns inte bland samfunden.',
  wait: `En tro grundad i kampanjen måste vara ${FAITH_REFORM.waitYears} år gammal innan nästa reform.`, mode: 'Välj att reformera tron eller grunda en ny.' });
const clamp = (n) => Math.min(100, Math.max(0, n));
// religiousSupport reads a support of 0 as unset (50), so a split holds the old faith at 1.
const SUPPORT_FLOOR = 1;
const living = (person) => person && !person.diedAt;

/** Why the faith cannot be reformed now, or ''. Reads only. */
export function faithReformRefusal(state, hooks) {
  if (!state.historicalOrigin) return REASONS.hadara;
  const ruler = hooks.ruler();
  if (!living(ruler) || !hooks.adult(ruler)) return REASONS.ruler;
  if (!state.religions[ruler.religionId]) return REASONS.faith;
  const recent = Object.values(state.religions).some((faith) => faith.founding && compareGameDates(addGameMonths(faith.founding.date, 12 * FAITH_REFORM.waitYears), state.date) > 0);
  return recent ? REASONS.wait : '';
}

function faithName(state, mode, ruler, old) {
  const given = ruler.name.split(' (')[0];
  const base = mode === 'reform' ? `${old.name} (reformerad)` : `${given}${/[sxz]$/i.test(given) ? '' : 's'} lära`;
  const taken = new Set(Object.values(state.religions).map((faith) => faith.name));
  if (!taken.has(base)) return base;
  const numerals = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  for (let n = 0; ; n++) if (!taken.has(`${base} ${numerals[n] ?? n + 2}`)) return `${base} ${numerals[n] ?? n + 2}`;
}

// A family follows the ruler as a whole, by its head's view of the ruler.
function follows(faithId, family, ruler, mode, hooks) {
  const opinion = hooks.getPersonalOpinion(family.headId, ruler.id);
  const shift = opinion >= FAITH_REFORM.liked ? FAITH_REFORM.likedBonus : opinion < 0 ? -FAITH_REFORM.likedBonus : 0;
  const chance = Math.min(0.95, Math.max(0.05, FAITH_MODES[mode].follow + shift));
  return hashRoll(`${faithId}|${family.id}|follow`) < chance;
}

function convert(state, family, fromId, toId) {
  family.religionId = toId;
  for (const person of Object.values(state.people)) if (person.familyId === family.id && living(person) && person.religionId === fromId) person.religionId = toId;
}

/** Runs the command reform_faith after requireRule: the new faith gets id `faithId`. */
export function reformFaith(state, { mode }, _actor, faithId, events, hooks) {
  if (!Object.hasOwn(FAITH_MODES, mode)) throw new Error(REASONS.mode);
  const refusal = faithReformRefusal(state, hooks);
  if (refusal) throw new Error(refusal);
  hooks.charge(FAITH_REFORM.cost, { publicFunds: true, tag: 'risky' });
  const ruler = hooks.ruler(), fromId = ruler.religionId, old = state.religions[fromId], rules = FAITH_MODES[mode];
  const faith = { id: faithId, name: faithName(state, mode, ruler, old), support: FAITH_REFORM.support, leaderId: null, founding: { date: state.date, mode, fromId, founderId: ruler.id },
    ...(typeof old.tradition === 'string' ? { tradition: old.tradition } : {}) };
  state.religions[faithId] = faith;
  ruler.religionId = faithId;
  if (state.families[ruler.familyId]) convert(state, state.families[ruler.familyId], fromId, faithId);
  const others = Object.values(state.families).filter((family) => family.id !== ruler.familyId && family.religionId === fromId && living(state.people[family.headId]));
  const followed = others.filter((family) => follows(faithId, family, ruler, mode, hooks));
  const stayed = others.filter((family) => !followed.includes(family));
  for (const family of followed) convert(state, family, fromId, faithId);
  for (const family of stayed) hooks.opinionCause(family.headId, ruler.id, rules.grudge.value, rules.grudge.label, `faith:${faithId}`, FAITH_REFORM.opinionYears);
  faith.support = Math.min(FAITH_REFORM.supportCap, FAITH_REFORM.support + FAITH_REFORM.perFamily * followed.length);
  old.support = Math.max(SUPPORT_FLOOR, clamp(old.support + rules.oldSupport));
  if (state.people[old.leaderId]?.religionId !== fromId) old.leaderId = null;
  addPrestige(state, rules.prestige);
  state.realm.legitimacy = clamp(state.realm.legitimacy + rules.legitimacy);
  const event = hooks.logEvent(events, 'faith_founded', `${faith.name} grundas`,
    `${ruler.name} bryter med ${old.name}. ${followed.length} ${followed.length === 1 ? 'familj följer' : 'familjer följer'} härskaren och ${stayed.length} stannar i den gamla tron.`, [ruler.id]);
  hooks.memory('faith_founded', `${faith.name} grundas`, [ruler.id], { causeId: event?.id ?? null });
}

/** The founded year of a faith for the religion list, or null. Reads only. */
export const foundedYear = (faith) => (faith.founding ? gameDateYear(faith.founding.date) : null);

/** Whether a neighbor's faith stands against the faith `faithId` (holy-war spec): one it broke from, or another named tradition. Reads only. */
export function otherFaith(state, faithId, foreign) {
  const own = state.religions[faithId];
  if (!own || !foreign || foreign.id === faithId) return false;
  const left = new Set();
  for (let faith = own; faith?.founding && !left.has(faith.founding.fromId); faith = state.religions[faith.founding.fromId]) left.add(faith.founding.fromId);
  return left.has(foreign.id) || (typeof own.tradition === 'string' && typeof foreign.tradition === 'string' && own.tradition !== foreign.tradition);
}

/** A save's founding record and tradition on each religion; both are absent on seeded faiths without them. */
export function validateFaithFoundings(state) {
  for (const faith of Object.values(state.religions)) {
    if (faith.tradition !== undefined && typeof faith.tradition !== 'string') throw new Error('Sparfilens trosreform är ogiltig.');
    const { founding } = faith;
    if (founding === undefined) continue;
    const ok = founding !== null && typeof founding === 'object' && normalizeGameDate(founding.date) === founding.date && Object.hasOwn(FAITH_MODES, founding.mode)
      && typeof founding.fromId === 'string' && typeof founding.founderId === 'string';
    if (!ok) throw new Error('Sparfilens trosreform är ogiltig.');
  }
}

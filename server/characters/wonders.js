import { addGameMonths } from '../gameDates.js';
import { addPrestige } from './reign.js';

// A wonder gives prestige for generations (spec docs/superpowers/specs/2026-11-10-wonders-design.md). Historical campaigns only.
// A wonder is a public project of kind 'wonder'; a completed one stands for the rest of the campaign, whoever rules. Nothing here draws from a random stream.
export const WONDER_KINDS = Object.freeze({
  cathedral: Object.freeze({ label: 'Katedral', title: 'Rikets katedral' }),
  palace: Object.freeze({ label: 'Palats', title: 'Det kungliga palatset' }),
  library: Object.freeze({ label: 'Bibliotek', title: 'Det stora biblioteket' }),
});
export const WONDER = Object.freeze({ cost: 100, months: 120, prestige: 15, floor: 20, max: 3 });
const REFUSALS = Object.freeze({
  hadara: 'Underverk byggs bara i historiska kampanjer.',
  building: 'Ett underverk byggs redan.',
  full: `Riket har redan ${WONDER.max} underverk.`,
  kind: 'Välj ett underverk.',
  built: 'Riket har redan byggt detta underverk.',
});

const wonders = (state) => state.projects.filter((project) => project.kind === 'wonder');
/** The completed wonders, in the order they were finished. */
export const standingWonders = (state) => wonders(state).filter((project) => project.status === 'completed');
/** How far the completed wonders lift the floor that prestige decays to. 0 outside historical campaigns. */
export const wonderPrestigeFloor = (state) => (state.historicalOrigin ? WONDER.floor * standingWonders(state).length : 0);

/** Why no wonder can be started now, or '' when one can. With `wonderKind`, also why that kind cannot. Reads only. */
export function wonderRefusal(state, wonderKind) {
  if (!state.historicalOrigin) return REFUSALS.hadara;
  if (wonders(state).some((project) => project.status === 'active')) return REFUSALS.building;
  if (standingWonders(state).length >= WONDER.max) return REFUSALS.full;
  if (wonderKind === undefined) return '';
  if (typeof wonderKind !== 'string' || !Object.hasOwn(WONDER_KINDS, wonderKind)) return REFUSALS.kind;
  return standingWonders(state).some((project) => project.wonderKind === wonderKind) ? REFUSALS.built : '';
}

/** Runs the command build_wonder after requireRule: charges the state treasury and opens a ten-year public project with id `id`. */
export function startWonder(state, wonderKind, actor, id, events, hooks) {
  const refusal = wonderRefusal(state, wonderKind ?? null);
  if (refusal) throw new Error(refusal);
  hooks.charge(WONDER.cost, { publicFunds: true });
  const { title } = WONDER_KINDS[wonderKind];
  state.projects.push({ id, kind: 'wonder', wonderKind, title, ownerId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, WONDER.months), personal: false, status: 'active' });
  hooks.logEvent(events, 'wonder_started', `${title} börjar byggas`, `${actor.name} lägger grunden. Bygget tar ${WONDER.months / 12} år och fortsätter under kommande härskare.`, [actor.id]);
}

/** When a wonder's project completes: the realm gains its prestige at once. Its lasting effect is wonderPrestigeFloor. */
export function completeWonder(state) {
  addPrestige(state, WONDER.prestige);
}


import { chancellorStep, loyaltyDriftStep, presentCouncil } from './council.js';
import { dreadYearStep, presentDread } from './dread.js';
import { beginReign, legitimacySources, validateReign } from './reign.js';

// The court: one orchestrator for what happens around the throne. These four entry points keep the systems of Phase 3 out of the long functions in index.js.
// `hooks` are the engine's (actionHooks in index.js). actionResolution.js, npcPlots.js and schemes.js import each other in a cycle, so their exports are used only inside functions here.

/** Runs once a year, after npcPlotStep, so the draws of the earlier systems keep their order within the year. It stops at once in a dissolved realm. */
export function courtAnnualStep(state, events, hooks) {
  if (!state.realm.alive) return;
  loyaltyDriftStep(state, hooks);
  chancellorStep(state, hooks);
  dreadYearStep(state, hooks);
}

/** Every change of reign ends here: called last by crown, and by applyRealmDissolution with `person` null. */
export function onAccession(state, person, { lawful, legitimacy }) {
  beginReign(state, person, { lawful, legitimacy });
}

/** The court as the player sees it. Reads only: draws nothing and spends nothing. */
export function presentCourt(state, hooks) {
  const { rulerId, startedAt, lawful } = state.reign;
  return { reign: { rulerId, startedAt, lawful }, legitimacy: { value: Math.round(state.realm.legitimacy), sources: legitimacySources(state) }, prestige: state.realm.prestige, council: presentCouncil(state, hooks), dread: presentDread(state, hooks) };
}

/** Refuses forged court records. Called beside validatePrisoners when a save loads. */
export function validateCourt(state) {
  validateReign(state);
}

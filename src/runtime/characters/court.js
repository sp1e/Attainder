import { compareGameDates } from '../gameDates.js';
import { BREAKDOWN_EXPIRY, breakdownChoices, breakdownClosedReason, breakdownStep, lostOrdersStep, resolveBreakdown, stressPressureStep } from './breakdowns.js';
import { chancellorStep, loyaltyDriftStep, presentCouncil } from './council.js';
import { dreadYearStep, presentDread } from './dread.js';
import { DEMAND_EXPIRY, demandChoices, demandClosedReason, demandStep, presentDemands, resolveDemand, validateFamilyDemands, voidDemand, voidOpenDemands } from './familyDemands.js';
import { factionStep, presentFactions, refreshFactions, validateFactions, voidFactions } from './factions.js';
import { nicknameStep, validateNicknames } from './nicknames.js';
import { beginReign, goalStep, legitimacySources, presentReign, prestigeStep, validateReign } from './reign.js';

// The court: one orchestrator for what happens around the throne. These entry points keep the systems of Phase 3 out of the long functions in index.js.
// `hooks` are the engine's (actionHooks in index.js). actionResolution.js, npcPlots.js and schemes.js import each other in a cycle, so their exports are used only inside functions here.

export const COURT_STORY_TYPES = Object.freeze(['stress_breakdown', 'family_demand', 'faction_ultimatum']);

// One row per court story that exists. Task 8 adds `faction_ultimatum`.
// `expiry` is what a story past its due date resolves to; `closedReason` gives the text of a story that fell away, or ''; `onClose` is what such a story leaves behind.
const COURT_STORIES = Object.freeze({
  stress_breakdown: Object.freeze({ choices: breakdownChoices, resolve: resolveBreakdown, expiry: BREAKDOWN_EXPIRY, closedReason: breakdownClosedReason }),
  family_demand: Object.freeze({ choices: demandChoices, resolve: resolveDemand, expiry: DEMAND_EXPIRY, closedReason: demandClosedReason, onClose: voidDemand }),
});

/** Runs once a year, after npcPlotStep, so the draws of the earlier systems keep their order within the year. It stops at once in a dissolved realm. */
export function courtAnnualStep(state, events, hooks) {
  if (!state.realm.alive) return;
  lostOrdersStep(state);
  loyaltyDriftStep(state, hooks);
  chancellorStep(state, hooks);
  dreadYearStep(state, hooks);
  goalStep(state, events, hooks);
  prestigeStep(state);
  nicknameStep(state, events, hooks);
  demandStep(state, events, hooks);
  factionStep(state, events, hooks);
  stressPressureStep(state, hooks);
  breakdownStep(state, events, hooks);
}

/** The choices of a court story, for rawStoryChoices. Reads only. */
export function courtStoryChoices(state, story, hooks) {
  return COURT_STORIES[story.type]?.choices(state, story, hooks) ?? [];
}

/** Applies a choice resolveStory has already checked. resolveStory closes the story. */
export function resolveCourtStory(state, story, choiceId, events, hooks) {
  COURT_STORIES[story.type]?.resolve(state, story, choiceId, events, hooks);
}

// An expiry writes the outcome itself: resolveStory refuses a choice outside the list, and the expiry is one.
function expireStory(state, story, row, events, hooks) {
  const { choiceId, text } = row.expiry;
  row.resolve(state, story, choiceId, events, hooks);
  Object.assign(story, { status: 'resolved', choiceId, resolvedAt: state.date });
  hooks.logEvent(events, 'story_expired', story.title, text, [story.actorId]);
}

function closeStory(state, story, row, resolution, events, hooks) {
  Object.assign(story, { status: 'closed', resolvedAt: state.date, resolution });
  row.onClose?.(state, story);
  hooks.logEvent(events, 'story_closed', story.title, resolution, [story.actorId]);
}

/** Takes the gone out of the live faction, then closes a court story that fell away and expires one past its due date. Called last by refreshStories. */
export function refreshCourtStories(state, events, hooks) {
  refreshFactions(state, events, hooks);
  for (const story of state.stories.filter((item) => item.status === 'open' && Object.hasOwn(COURT_STORIES, item.type))) {
    const row = COURT_STORIES[story.type], resolution = row.closedReason(state, story, hooks);
    if (resolution) closeStory(state, story, row, resolution, events, hooks);
    else if (compareGameDates(story.dueAt, state.date) <= 0) expireStory(state, story, row, events, hooks);
  }
}

/** Every change of reign ends here: called last by crown, and by applyRealmDissolution with `person` null. */
export function onAccession(state, person, { lawful, legitimacy }) {
  beginReign(state, person, { lawful, legitimacy });
  voidOpenDemands(state);
  voidFactions(state);
}

/** The court as the player sees it. Reads only: draws nothing and spends nothing. */
export function presentCourt(state, hooks) {
  return { reign: presentReign(state, hooks), legitimacy: { value: Math.round(state.realm.legitimacy), sources: legitimacySources(state) }, prestige: state.realm.prestige, council: presentCouncil(state, hooks), dread: presentDread(state, hooks), demands: presentDemands(state), factions: presentFactions(state, hooks) };
}

/** Refuses forged court records. Called beside validatePrisoners when a save loads. */
export function validateCourt(state) {
  validateReign(state);
  validateNicknames(state);
  validateFamilyDemands(state);
  validateFactions(state);
}

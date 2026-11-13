import { compareGameDates } from '../gameDates.js';
import { BREAKDOWN_EXPIRY, breakdownChoices, breakdownClosedReason, breakdownDeadlineText, breakdownExpiryText, breakdownStep, lostOrdersStep, resolveBreakdown, stressPressureStep } from './breakdowns.js';
import { chancellorStep, loyaltyDriftStep, presentCouncil } from './council.js';
import { DEATHBED_EXPIRY, deathbedChoices, deathbedClosedReason, deathbedLog, deathbedStep, resolveDeathbed } from './deathbed.js';
import { dreadYearStep, presentDread } from './dread.js';
import { DUEL_EXPIRY, duelChoices, duelClosedReason, duelStep, resolveDuel } from './duels.js';
import { ECHO_EXPIRY, echoChoices, echoClosedReason, echoExpiry, echoStep, resolveEcho } from './echoes.js';
import { DEMAND_EXPIRY, demandChoices, demandClosedReason, demandStep, presentDemands, resolveDemand, validateFamilyDemands, voidDemand, voidOpenDemands } from './familyDemands.js';
import { ULTIMATUM_EXPIRY, factionStep, presentFactions, refreshFactions, resolveUltimatum, ultimatumChoices, ultimatumClosedReason, validateFactions, voidFactions } from './factions.js';
import { nicknameStep, validateNicknames } from './nicknames.js';
import { PLAGUE_EXPIRY, plagueChoices, plagueClosedReason, plagueStep, resolvePlague } from './plague.js';
import { beginReign, goalStep, legitimacySources, presentReign, prestigeStep, validateReign } from './reign.js';
import { wonderPrestigeFloor } from './wonders.js';
import { foreignRealmStep } from './foreignRealms.js';
import { CALL_EXPIRY, allianceStep, callChoices, callClosedReason, resolveCall } from './alliances.js';
import { claimStep } from './claims.js';
import { tribeStep } from './tribes.js';
import { HOLY_WAR_EXPIRY, holyWarChoices, holyWarClosedReason, holyWarStep, resolveHolyWar } from './holyWar.js';

// The court: one orchestrator for what happens around the throne. These entry points keep the systems of Phase 3 out of the long functions in index.js.
// `hooks` are the engine's (actionHooks in index.js). actionResolution.js, npcPlots.js and schemes.js import each other in a cycle, so their exports are used only inside functions here.

export const COURT_STORY_TYPES = Object.freeze(['stress_breakdown', 'family_demand', 'faction_ultimatum', 'deathbed', 'duel_challenge', 'decision_echo', 'plague_outbreak', 'call_to_arms', 'holy_war_call']);

// One row per court story.
// `expiry` is what a story past its due date resolves to, and `expiryFor` gives it per story where it depends on the story, and `expiryText` replaces its log line where the cost depends on who is acting, as `deadlineText` replaces its caption; `closedReason` gives the text of a story that fell away, or ''; `onClose` is what such a story leaves behind; `log` writes the row's own log lines under ids of its own.
const COURT_STORIES = Object.freeze({
  stress_breakdown: Object.freeze({ choices: breakdownChoices, resolve: resolveBreakdown, expiry: BREAKDOWN_EXPIRY, expiryText: breakdownExpiryText, deadlineText: breakdownDeadlineText, closedReason: breakdownClosedReason }),
  family_demand: Object.freeze({ choices: demandChoices, resolve: resolveDemand, expiry: DEMAND_EXPIRY, closedReason: demandClosedReason, onClose: voidDemand }),
  faction_ultimatum: Object.freeze({ choices: ultimatumChoices, resolve: resolveUltimatum, expiry: ULTIMATUM_EXPIRY, closedReason: ultimatumClosedReason }),
  deathbed: Object.freeze({ choices: deathbedChoices, resolve: resolveDeathbed, expiry: DEATHBED_EXPIRY, closedReason: deathbedClosedReason, log: deathbedLog }),
  duel_challenge: Object.freeze({ choices: duelChoices, resolve: resolveDuel, expiry: DUEL_EXPIRY, closedReason: duelClosedReason }),
  decision_echo: Object.freeze({ choices: echoChoices, resolve: resolveEcho, expiry: ECHO_EXPIRY, expiryFor: echoExpiry, closedReason: echoClosedReason }),
  plague_outbreak: Object.freeze({ choices: plagueChoices, resolve: resolvePlague, expiry: PLAGUE_EXPIRY, closedReason: plagueClosedReason }),
  call_to_arms: Object.freeze({ choices: callChoices, resolve: resolveCall, expiry: CALL_EXPIRY, closedReason: callClosedReason }),
  holy_war_call: Object.freeze({ choices: holyWarChoices, resolve: resolveHolyWar, expiry: HOLY_WAR_EXPIRY, closedReason: holyWarClosedReason }),
});

/** Runs after npcPlotStep and returns the paid chancellor delta for annual accounting. A dissolved realm pays 0. */
export function courtAnnualStep(state, events, hooks) {
  // A breakdown's lost orders are the player's, so they fall due also after the realm has ended.
  lostOrdersStep(state);
  // The neighbors live on after the player's realm falls.
  if (!state.realm.alive) { foreignRealmStep(state, events, hooks); return 0; }
  loyaltyDriftStep(state, hooks);
  const contribution = chancellorStep(state, hooks);
  dreadYearStep(state, hooks);
  goalStep(state, events, hooks);
  prestigeStep(state, wonderPrestigeFloor(state));
  nicknameStep(state, events, hooks);
  demandStep(state, events, hooks);
  factionStep(state, events, hooks);
  stressPressureStep(state, hooks);
  breakdownStep(state, events, hooks);
  deathbedStep(state, events, hooks);
  duelStep(state, events, hooks);
  echoStep(state, events, hooks);
  plagueStep(state, events, hooks);
  foreignRealmStep(state, events, hooks);
  allianceStep(state, events, hooks);
  holyWarStep(state, events, hooks);
  return contribution + claimStep(state, events, hooks) + tribeStep(state, events, hooks);
}

/** The choices of a court story, for rawStoryChoices. Reads only. */
export function courtStoryChoices(state, story, hooks) {
  return COURT_STORIES[story.type]?.choices(state, story, hooks) ?? [];
}

/** The caption of an open court story: the live one where the row has it, the story's own elsewhere. Reads only. */
export function courtDeadlineText(story, hooks) {
  return COURT_STORIES[story.type]?.deadlineText?.(hooks) ?? story.deadlineText;
}

/** Applies a choice resolveStory has already checked. resolveStory closes the story. */
export function resolveCourtStory(state, story, choiceId, events, hooks) {
  COURT_STORIES[story.type]?.resolve(state, story, choiceId, events, hooks);
}

// An expiry writes the outcome itself: resolveStory refuses a choice outside the list, and the expiry is one.
function expireStory(state, story, row, events, hooks) {
  const { choiceId, text } = row.expiryFor?.(story) ?? row.expiry;
  row.resolve(state, story, choiceId, events, hooks);
  Object.assign(story, { status: 'resolved', choiceId, resolvedAt: state.date });
  storyLog(state, story, row, 'expired', events, hooks, row.expiryText?.(hooks) ?? text);
}

// A row with `log` keeps state.sequence, and with it every later person and event id, where it was.
function storyLog(state, story, row, kind, events, hooks, text) {
  if (row.log) row.log(state, events, `${story.id}-${kind}`, `story_${kind}`, story.title, text, [story.actorId]);
  else hooks.logEvent(events, `story_${kind}`, story.title, text, [story.actorId]);
}

function closeStory(state, story, row, resolution, events, hooks) {
  Object.assign(story, { status: 'closed', resolvedAt: state.date, resolution });
  row.onClose?.(state, story);
  storyLog(state, story, row, 'closed', events, hooks, resolution);
}

/** Takes the gone out of the live faction, then closes a court story that fell away and expires one past its due date. Called last by refreshStories. */
export function refreshCourtStories(state, events, hooks) {
  refreshFactions(state, events, hooks);
  for (const story of state.stories.filter((item) => item.status === 'open' && Object.hasOwn(COURT_STORIES, item.type))) {
    // A forced abdication earlier in this loop has voided what the old reign left open.
    if (story.status !== 'open') continue;
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

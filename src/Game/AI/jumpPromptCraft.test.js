/*! Open Historia — what the jump is told about history, orders, the world and writing © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Run: node --test src/Game/AI/jumpPromptCraft.test.js
//
// Runs without node_modules.
//
// The two jump templates were rewritten on 2026-09-26 into one brief: real
// history as the default, more events, the rules once each, the live records
// rendered into the template at ${JUMP_LIVE_STATE}, and the prompt ending on how
// an event is written. These hold that shape: which passages both templates
// carry and where, which of them an author can edit, which rules came through
// the rewrite on purpose, and what must never come back.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import defaultPrompts from "./defaultPrompts.json" with { type: "json" };
import { PROMPT_GUIDANCE, locateSegment } from "./promptGuidance.js";
import { STATIC_PROMPT_KEYS } from "./promptLayout.js";
import { renderTemplateCached } from './promptLayout.js';
import { resolveHelperValues } from './promptContext.js';
import { collapseRepeatedWorldContext } from './promptDedupe.js';
import { resolveTemplateVariableDemand } from './contextDiagnostics.js';
import * as historyBoundary from './futureHistoryBoundary.js';
import { buildCharacterPromptContext, buildHistoricalPromptContext, getCharacterEventBudget } from '../../runtime/characterWorld.js';
import { createHistoricalCharacterSystem } from '../../runtime/characters/scenarioSeed.js';
import { advanceCharacters, getCharacterPresentation } from '../../runtime/characters/index.js';
import { normalizeWorldState, viewAsSeen } from '../../runtime/gameState.js';

const JUMP_TASKS = ["jumpForward", "autoJumpForward"];
const EDITABLE = {
  role: "[Your Role]",
  history: "[Real History Is the Default]",
  agency: "[Player Agency — critical]",
  orders: "[What an Order Can Do]",
  scope: "[What to Simulate]",
  reactions: "[The World Answers Back]",
  quality: "[How to Write an Event]",
};
const TECHNICAL = "[What Is True Now]";
const LIVE_STATE = "${JUMP_LIVE_STATE}";

const template = (task) => defaultPrompts.tasks[task];
const gameplaySource = readFileSync(new URL("./gameplay.js", import.meta.url), "utf8");

// Execute both production assembly functions with the loaded catalog, real
// render/context/history helpers and stubbed unrelated live services. This
// captures assembled request text without importing the JSX app or a provider.
const assembledJump = (catalog, data) => {
  const deps = {
    loadPromptCatalog: async () => catalog,
    STAT_INDEX_CONTEXT_TASKS: new Set(), JUMP_TASK_KEYS: new Set(JUMP_TASKS),
    PLAYER_GOAL_TASKS: new Set(), GM_REMINDER_TASKS: new Set(),
    normalizeArray: v => Array.isArray(v) ? v : [], normalizeString: v => String(v ?? '').trim(),
    resolveTemplateVariableDemand, resolveHelperValues, renderTemplateCached, collapseRepeatedWorldContext,
    buildRealHistoryDirective: historyBoundary.buildRealHistoryDirective,
    historicalJumpTemplate: historyBoundary.historicalJumpTemplate,
    readWorldState: async () => data.world, readGameData: async () => data.game, normalizeWorldState,
    isActiveFeatureEnabled: () => false, JUMP_LIVE_STATE_BANNER: '[Live records]', JUMP_LEVERS: '',
    buildJumpGroupsBlock: () => '', buildWarLedgerDirective: () => '', buildDiplomaticLedgerDirective: () => '',
    describeWarsWithoutFormations: () => '', describeTravelPace: () => '', buildJumpProjectsDirective: () => '',
    describeReportsForPrompt: () => '', playerGoalBlock: async () => '', getActiveWorldDirection: () => null,
    buildWorldDirectionDirective: () => '', computeSimulatedDays: () => 30, jumpDifficultyDirective: () => '',
    gmRemindersBlock: async () => '',
  };
  const start = gameplaySource.indexOf('const buildJumpLiveState =');
  const end = gameplaySource.indexOf('// Who is shown the reminders.', start);
  assert.ok(start >= 0 && end > start);
  return new Function(...Object.keys(deps), `${gameplaySource.slice(start, end)}\nreturn buildTaskSystemPrompt;`)(...Object.values(deps));
};

test('template variables derive historical mode from the visible snapshot, never the raw future world', async () => {
  const data = JSON.parse(readFileSync(new URL('../../../server/seed/historical/john-1200/scenario.json', import.meta.url), 'utf8')).data;
  const state = createHistoricalCharacterSystem({ historicalScenario: data.world.historicalScenario, date: data.game.startDate, polityId: data.game.country, seed: 321 });
  const deps = { perfNow: () => 0, normalizeString: v => String(v ?? '').trim(), normalizeArray: v => Array.isArray(v) ? v : [],
    lookupFunctionsEnabled: () => false, buildPromptContext: async () => ({}), buildGroupsContext: async () => '',
    viewAsSeen: bundle => viewAsSeen(bundle, { unseen: new Set(bundle.events.map(e => e.id)) }),
    buildCharacterPromptContext, buildHistoricalPromptContext, getCharacterPresentation, getCharacterEventBudget,
    isContextDiagnosticsEnabled: () => false,
  };
  const start = gameplaySource.indexOf('const buildTemplateVariables =');
  const end = gameplaySource.indexOf('// Give the AI real time:', start);
  const build = new Function(...Object.keys(deps), `${gameplaySource.slice(start, end)}\nreturn buildTemplateVariables;`)(...Object.values(deps));
  const bundle = { ...data, world: { ...data.world, characterSystem: state }, events: [], chats: [] };
  const before = JSON.stringify(bundle);
  const current = await build(bundle, { requiredKeys: [], taskKey: 'jumpForward', targetDate: '1201-09-01' });
  assert.equal(current.historicalContext.currentDate, state.date);
  assert.equal(current.historicalContext.bookmarkDate, state.historicalOrigin.bookmarkDate);
  assert.equal(JSON.stringify(bundle), before);
  bundle.world.simulationHistory = [{ fromDate: state.date, toDate: '1201-09-01', eventIds: ['unseen'] }];
  bundle.events = [{ id: 'unseen', date: '1201-09-01', title: 'Future' }];
  bundle.game.gameDate = '1201-09-01';
  const hidden = await build(bundle, { requiredKeys: [], taskKey: 'jumpForward', targetDate: '1202-01-01' });
  assert.equal(hidden.historicalContext, undefined);
  assert.equal(hidden.characterContext, '');
});

for (const id of ['egypt-3000bc', 'john-1200']) test(`${id}: assembled jump requests replace future-history prescriptions in loaded and frozen templates`, async () => {
  const data = JSON.parse(readFileSync(new URL(`../../../server/seed/historical/${id}/scenario.json`, import.meta.url), 'utf8')).data;
  let state = createHistoricalCharacterSystem({ historicalScenario: data.world.historicalScenario, date: data.game.startDate, polityId: data.game.country, seed: 321 });
  if (id === 'john-1200') state = advanceCharacters(state, '1201-09-01', { id: 'progress' }).state;
  data.world.characterSystem = state;
  data.game.gameDate = state.date;
  const historicalContext = buildHistoricalPromptContext(getCharacterPresentation(state));
  const variables = { historicalContext, characterContext: buildCharacterPromptContext(state), playerPolity: state.realm.name,
    simulationRules: data.world.simulationRules, startingTimelineText: data.world.startingTimelineText };
  for (const task of JUMP_TASKS) {
    for (const variant of ['loaded', 'edited', 'missing']) {
      const catalog = structuredClone(defaultPrompts);
      if (variant === 'edited') catalog.tasks[task] = catalog.tasks[task].replace(section(catalog.tasks[task], EDITABLE.history), '[Real History Is the Default]\nAUTHOR_MANDATORY_FUTURE\n');
      if (variant === 'missing') catalog.tasks[task] = catalog.tasks[task].replace(section(catalog.tasks[task], EDITABLE.history), '');
      catalog.tasks[task] += '\n[Author appendix]\nKEEP_AUTHOR_INSTRUCTION';
      const captured = await assembledJump(catalog, data)(task, { variables, reminders: false });
      assert.match(captured.systemPrompt, /alternate outcomes/);
      assert.match(captured.systemPrompt, /KEEP_AUTHOR_INSTRUCTION/);
      assert.match(captured.systemPrompt, /local rule engine controls/);
      assert.ok(captured.systemPrompt.includes(state.date));
      assert.ok(captured.systemPrompt.includes(data.game.startDate));
      assert.ok(captured.systemPrompt.includes(state.realm.name));
      assert.doesNotMatch(captured.systemPrompt, /AUTHOR_MANDATORY_FUTURE|elections are held on their dates and won by the people who won them|The game diverges only where the game has diverged|the real events of this period happen|Real historical events that nobody in this game has prevented still happen|Real history and the world before round 1: the default|A real historical event keeps its real details|Hadara|Modern Day/);
      if (id === 'egypt-3000bc') assert.match(captured.systemPrompt, /utvecklarna.*beskurit/);
      // Same frozen/custom catalog without historical character context follows
      // its exact original history section and the legacy live directive.
      const legacy = await assembledJump(catalog, data)(task, { variables: {}, reminders: false });
      assert.equal(legacy.promptTemplate, catalog.tasks[task]);
      assert.match(legacy.systemPrompt, /the real events of this period happen/);
      if (variant === 'edited') assert.match(legacy.systemPrompt, /AUTHOR_MANDATORY_FUTURE/);
    }
  }
});
const once = (text, needle) => text.split(needle).length - 1 === 1;
const section = (text, header) => {
  const at = text.indexOf(header);
  const end = text.indexOf("\n[", at + 1);
  return text.slice(at, end < 0 ? text.length : end);
};

test("both jump templates carry every passage, once each", () => {
  for (const task of JUMP_TASKS) {
    for (const header of [...Object.values(EDITABLE), TECHNICAL, "[The Map]", "[Polities]", "[Units and Structures]", "[Diplomacy]", "[Output]", LIVE_STATE]) {
      assert.ok(once(template(task), header), `${task}: ${header}`);
    }
  }
});

test("the brief comes first, the records after it, and the writing brief last", () => {
  for (const task of JUMP_TASKS) {
    const text = template(task);
    const at = (needle) => text.indexOf(needle);
    // Who the player is, what they can do, then what the world does.
    assert.ok(at(EDITABLE.role) < at(EDITABLE.history), task);
    assert.ok(at(EDITABLE.history) < at(EDITABLE.agency), task);
    assert.ok(at(EDITABLE.agency) < at(EDITABLE.orders), task);
    assert.ok(at(EDITABLE.orders) < at(EDITABLE.scope), task);
    assert.ok(at(EDITABLE.scope) < at(EDITABLE.reactions), task);
    // The lore, then how much it counts for, then the scenario's own rules.
    assert.ok(at("[The World Before Round 1]") < at(TECHNICAL), task);
    assert.ok(at(TECHNICAL) < at("[Extra Simulation Rules for This Preset]"), task);
    // The game's details, the live records, the output, and the writing brief.
    assert.ok(at("[Event History of This Game]") < at(LIVE_STATE), task);
    assert.ok(at(LIVE_STATE) < at("[Output]"), task);
    assert.ok(at("[Output]") < at(EDITABLE.quality), task);
    // Nothing follows the writing brief but its own example.
    assert.equal(text.lastIndexOf("\n["), at(EDITABLE.quality) - 1, `${task}: a section follows the writing brief`);
  }
});

test("the guidance passages are editable, on both tasks, under the same ids", () => {
  for (const task of JUMP_TASKS) {
    const segments = PROMPT_GUIDANCE.tasks[task];
    for (const [id, header] of Object.entries(EDITABLE)) {
      const segment = segments.find((entry) => entry.id === id);
      assert.ok(segment, `${task} has no "${id}" segment`);
      assert.ok(segment.start.startsWith(header), `${task}.${id} starts at ${JSON.stringify(segment.start)}`);
      const located = locateSegment(template(task), segment);
      assert.ok(located && located.end > located.start, `${task}.${id} is not located`);
    }
    // The live records are the engine's: no author passage may cover them.
    const live = template(task).indexOf(LIVE_STATE);
    for (const segment of segments) {
      const located = locateSegment(template(task), segment);
      assert.ok(live < located.start || live >= located.end, `${task}.${segment.id} covers the live records`);
    }
  }
});

test("the order of authority is not something a scenario can edit away", () => {
  for (const task of JUMP_TASKS) {
    const text = template(task);
    const at = text.indexOf(TECHNICAL);
    for (const segment of PROMPT_GUIDANCE.tasks[task]) {
      const located = locateSegment(text, segment);
      assert.ok(located, `${task}.${segment.id}`);
      assert.ok(at < located.start || at >= located.end, `${task}.${segment.id} covers ${TECHNICAL}`);
    }
    const passage = section(text, TECHNICAL);
    assert.match(passage, /current map/);
    assert.match(passage, /never evidence of who holds what today/);
    assert.match(passage, /because it was one when the game began/);
  }
});

test("everything before the game's details costs the prompt cache nothing", () => {
  const placeholder = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  for (const task of JUMP_TASKS) {
    const text = template(task);
    let firstDynamic = text.length;
    for (const match of text.matchAll(placeholder)) {
      if (!STATIC_PROMPT_KEYS.has(match[1])) { firstDynamic = match.index; break; }
    }
    for (const header of [EDITABLE.role, EDITABLE.history, EDITABLE.agency, EDITABLE.orders, EDITABLE.scope, EDITABLE.reactions, TECHNICAL, "[The Map]", "[Units and Structures]"]) {
      const at = text.indexOf(header);
      assert.ok(at + section(text, header).length <= firstDynamic, `${task}: ${header} reaches past the cacheable prefix`);
    }
  }
});

// A game set in our history follows it: the real events of the period happen,
// unless this game has changed their causes. Until 2026-09-26 the jump was told
// the opposite at call time (the Counterfactual Knowledge Boundary), and a skip
// could not hold a month's real elections, coups or crises.
test("real history is the default, and the game departs from it where it has changed things", () => {
  for (const task of JUMP_TASKS) {
    const passage = section(template(task), EDITABLE.history);
    assert.match(passage, /In a game set in our history, the world follows real history/);
    assert.match(passage, /elections are held on their dates and won by the people who won them/);
    assert.match(passage, /The game diverges only where the game has diverged/);
    assert.match(passage, /do not replay a real event whose causes this game has removed/);
    assert.match(passage, /In an alternate-history game/);
    assert.match(passage, /of their own accord where their interests point that way/);
    assert.ok(!template(task).includes("MEMORY IS NOT EVIDENCE"), task);
  }
  assert.match(gameplaySource, /buildRealHistoryDirective\(/);
});

// The world used to answer and never ask. These rules came through the rewrite
// on purpose: without them a campaign ran for years with nobody wanting anything
// from the player (2026-09-20).
test("the world is told it may move first, and that both sides of a fight fight", () => {
  for (const task of JUMP_TASKS) {
    const passage = section(template(task), EDITABLE.reactions);
    assert.ok(once(passage, "THE PRESSURE DOES NOT HAVE TO START WITH THE PLAYER"), `${task}: initiative`);
    assert.ok(once(passage, "WHEN THERE IS A FIGHT, BOTH SIDES FIGHT"), `${task}: both sides`);
    assert.match(passage, /Other powers' forces are on the map too/);
  }
});

test("the ban is on inventing a rivalry, not on hostility", () => {
  for (const task of JUMP_TASKS) {
    const text = template(task);
    assert.ok(once(text, "What is forbidden is INVENTING A RIVALRY"), `${task}: the ban names itself`);
    assert.ok(text.includes("covers every pair of polities on the map"), `${task}: it is not about the player`);
    assert.ok(text.includes("never been a rule against writing the hostility"), `${task}: and says what it is not`);
  }
});

// The title is the headline; the description is the article under it. The
// descriptions used to restate their headlines in 25-50 words, under rules that
// forbade commentary; the owner asked for the story instead (2026-09-26).
test("an event is a headline and the story under it, with no word cap", () => {
  for (const task of JUMP_TASKS) {
    const brief = template(task).slice(template(task).indexOf(EDITABLE.quality));
    assert.match(brief, /The title is the headline of a news article/);
    assert.match(brief, /The description is the article under that headline\. It tells the story of what happened/);
    assert.match(brief, /it never just says the headline again in more words/);
    assert.match(brief, /A minor event is at least a full paragraph/);
    assert.match(brief, /A description that tells the story:/);
    for (const gone of ["25–50", "25-50", "words strictly", "[Event Voice]", "Report, do not judge", "[Flags]"]) {
      assert.ok(!template(task).includes(gone), `${task}: ${gone} is back`);
    }
  }
});

test("a jump asks for as many events as the period holds, not two to four a month", () => {
  const scope = section(template("jumpForward"), EDITABLE.scope);
  assert.match(scope, /Write as many distinct, newsworthy events as the period really holds/);
  assert.ok(!template("jumpForward").includes("2 to 4 events per month"));
});

// The live records are rendered into the template, so the template decides where
// they sit; the request itself ends on the writing reminder.
test("the live records go into the template, and the request ends on the writing reminder", () => {
  assert.equal(defaultPrompts.helpers.JUMP_LIVE_STATE, "${jumpLiveState}");
  assert.match(gameplaySource, /jumpLiveState: await buildJumpLiveState\(/);
  assert.match(gameplaySource, /buildScriptedEventsInstruction\(scriptedBeats\), WRITING_REMINDER\]/);
  for (const gone of ["[Native World Director — authoritative", "[Diplomatic Consequence Bridge]", "[Actions You Can Take]", "[Counterfactual Knowledge Boundary"]) {
    assert.ok(!gameplaySource.includes(gone), `${gone} is appended again`);
  }
});

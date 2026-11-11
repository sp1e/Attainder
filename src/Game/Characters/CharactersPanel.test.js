import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { actionHooks, applyRealmDissolution, createCharacterSystem, estimateCharacterAction, estimateConversation, estimateEnvoyRequest, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, getEnvoyBrief } from "../../runtime/characters/index.js";
import { createHistoricalCharacterSystem } from "../../runtime/characters/scenarioSeed.js";
import { REASONS as ODDS_REASONS } from "../../runtime/characters/actionOdds.js";
import * as realDates from "../../runtime/gameDates.js";
import { CONVERSATION_REQUESTS } from "../../runtime/characters/conversation.js";
import { ENVOY_REQUESTS } from "../../runtime/characters/envoys.js";
import * as realCounter from "../AI/modelCallCounter.js";
import { createSecret, grantHook } from "../../runtime/characters/secrets.js";
import { SHIPPED_START_FOLDERS } from "../../runtime/testing/shippedHistoricalStarts.js";
import { interpretCharacterAction } from "./characterModelCalls.js";
import * as playerTextModule from "./playerText.js";
import { buttonNamed, createHookDriver, findAll, settle, textOf } from "../testing/hookDriver.js";

// Render the real JSX with supplied presentation data. Runtime and portrait
// loading are stubs; these checks do not exercise the core or a browser.
const source = readFileSync(new URL("./CharactersPanel.jsx", import.meta.url), "utf8");
const compiled = transformSync(`${source}\nexport { ChronicleView, CouncilView, FamiliesView, PeopleView, GovernanceSummary, OfficesView, ActionCard, StoryCard, ChainHistory };`, {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;
const compileFile = (name) => transformSync(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"), {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;
const actionBoxCompiled = compileFile("ActionBox.jsx");
const courtCompiled = compileFile("CourtSections.jsx");
const intrigueCompiled = compileFile("IntrigueView.jsx");
const conversationCompiled = compileFile("ConversationView.jsx");
const envoyCompiled = compileFile("EnvoyView.jsx");

function runModule(code, modules, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id) => {
    assert.ok(id in modules, `Unexpected import: ${id}`);
    return modules[id];
  }, crypto: globalThis.crypto, console, ...globals });
  return module.exports;
}

// The action box module with its runtime and model calls stubbed; `stubs` replaces any of them.
function loadActionBox(stubs = {}) {
  const modules = {
    react: stubs.react || { ...React, useEffect: () => {}, useCallback: (fn) => fn, useMemo: (fn) => fn(), useRef: (value) => ({ current: value }),
      useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}] },
    "../../runtime/gameDates.js": { parseGameDate: () => null },
    "../../runtime/characters/index.js": { getCharacterPresentation: (state) => state },
    "../../runtime/characterRuntime.js": {
      // Stubs for every runtime call; a test replaces the ones it watches.
      estimateCharacterActionForView: async () => ({ ok: false, reason: "Ingen uppskattning." }),
      recordCharacterNarrative: async () => ({ ok: true }),
      submitCharacterCommand: async () => ({ ok: true, events: [] }),
      ...stubs.runtime,
    },
    "./characterModelCalls.js": {
      interpretCharacterAction: async () => ({ ok: false, reason: "Ingen modell är ansluten.", fallback: "menu" }),
      narrateCharacterResolution: async () => ({ ok: false, reason: "Ingen modell är ansluten." }),
      ...stubs.model,
    },
    "./playerText.js": playerTextModule,
  };
  return runModule(actionBoxCompiled, modules);
}

// The conversation calls every module that renders a conversation reaches for; a test replaces the ones it watches.
const conversationRuntime = (overrides = {}) => ({
  estimateConversationForView: async () => ({ ok: false, reason: "Ingen uppskattning." }),
  getConversationViewForModel: async () => null,
  submitConversationRequest: async () => ({ ok: true, state: { conversations: [] }, events: [] }),
  estimateEnvoyForView: async () => ({ ok: false, reason: "Ingen uppskattning." }),
  getEnvoyViewForModel: async () => null,
  submitEnvoyRequest: async () => ({ ok: true, state: { foreignRealms: [] }, events: [] }),
  ...overrides,
});
const conversationModel = (overrides = {}) => ({
  extractConversationRequest: async () => ({ ok: false, reason: "Ingen modell är ansluten." }),
  replyAsCharacter: async () => ({ ok: false, reason: "Ingen modell är ansluten." }),
  extractEnvoyRequest: async () => ({ ok: false, reason: "Ingen modell är ansluten." }),
  replyAsRuler: async () => ({ ok: false, reason: "Ingen modell är ansluten." }),
  ...overrides,
});

function loadPanel(view, { busy = false, theme = "light", panelState = true, tab = "council", modelCalls = 0, counter = null, react = null, runtime = {}, model = {}, globals = {}, dates = null } = {}) {
  let stateIndex = 0;
  const calls = [];
  const modules = {
    react: react || { ...React, useEffect: () => {}, useCallback: (fn) => fn,
      useMemo: (fn) => fn(), useRef: (value) => ({ current: value }),
      useState: (initial) => {
        const index = stateIndex++;
        const value = panelState && index === 0 ? view : panelState && index === 1 ? true : panelState && index === 2 ? tab : panelState && index === 4 ? busy : typeof initial === "function" ? initial() : initial;
        return [value, () => {}];
      } },
    "../../runtime/useRuntimeState.js": { useRuntimeState: () => null },
    "../../runtime/gameDates.js": dates || { parseGameDate: () => null, compareGameDates: () => 0 },
    "../../runtime/characters/index.js": { getCharacterPresentation: (state) => state },
    "../../runtime/characterRuntime.js": {
      advanceCharacterYearWithModel: async () => { calls.push("advance"); return {}; },
      readVisibleCharacterState: async () => view,
      estimateCharacterActionForView: async () => ({ ok: false, reason: "Ingen uppskattning." }),
      recordCharacterNarrative: async () => ({ ok: true }),
      submitCharacterCommand: async () => ({ ok: true, events: [] }),
      ...conversationRuntime(),
      ...runtime,
    },
    "../../runtime/characters/conversation.js": { CONVERSATION_REQUESTS },
    "../../runtime/characters/envoys.js": { ENVOY_REQUESTS },
    "../AI/modelCallCounter.js": counter || { getModelCallCounts: () => ({ total: modelCalls, byKind: {} }), subscribeModelCalls: () => () => {} },
    "./characterModelCalls.js": {
      interpretCharacterAction: async () => ({ ok: false, reason: "Ingen modell är ansluten.", fallback: "menu" }),
      narrateCharacterResolution: async () => ({ ok: false, reason: "Ingen modell är ansluten." }),
      ...conversationModel(model),
    },
    "./playerText.js": playerTextModule,
    "./characters.css": {},
    "./HistoricalRecordView.jsx": { default: () => React.createElement("p", null, "HISTORISK POST"), holdFocus: () => {}, useChronicleRequest: () => {}, __esModule: true },
    "./LocalModelConnect.jsx": { default: () => null, __esModule: true },
    "./CharacterWatchToggles.jsx": { default: () => null, __esModule: true },
    "./Portrait.jsx": { default: ({ person }) => React.createElement("span", { "data-portrait-person": person.id }), __esModule: true },
  };
  modules["./ActionBox.jsx"] = runModule(actionBoxCompiled, modules);
  modules["./CourtSections.jsx"] = runModule(courtCompiled, modules);
  modules["./IntrigueView.jsx"] = runModule(intrigueCompiled, modules);
  modules["./ConversationView.jsx"] = runModule(conversationCompiled, modules);
  modules["./EnvoyView.jsx"] = runModule(envoyCompiled, modules);
  const exports = runModule(compiled, modules, { window: { matchMedia: () => ({ matches: theme === "dark" }) }, localStorage: { getItem: () => "system" }, ...globals });
  return { ...exports, IntrigueView: modules["./IntrigueView.jsx"].default, ConversationView: modules["./ConversationView.jsx"].default,
    EnvoyView: modules["./EnvoyView.jsx"].default, ForeignRealms: modules["./CourtSections.jsx"].ForeignRealms, BorderTribes: modules["./CourtSections.jsx"].BorderTribes, calls };
}

const principal = { id: "ruler", name: "Astrid", age: 42, alive: true, stress: 19 };
const royalRegent = { id: "royal-regent", name: "Bertil", age: 39, alive: true, stress: 27 };
const familyHead = { id: "head", name: "Cecilia", age: 35, alive: true };
const familyRegent = { id: "guardian", name: "Dag", age: 29, alive: true };
const baseView = () => ({
  mode: "realm", ruler: principal, representative: royalRegent,
  people: [principal, royalRegent, familyHead, familyRegent],
  families: [], stories: [], actions: [], economy: {}, status: { ended: false },
  authority: {
    royal: { principalId: principal.id, representativeId: royalRegent.id, reason: "incapacity", blockedReason: "", playerCanExercise: true },
    household: { principalId: familyHead.id, representativeId: familyRegent.id, reason: "minority", blockedReason: "", playerCanExercise: true },
  },
});
// CouncilView takes the view as a prop; panel state would otherwise feed the first child hooks.
const council = (view, options = {}) => {
  const { CouncilView } = loadPanel(view, { panelState: false, ...options });
  return renderToStaticMarkup(React.createElement(CouncilView, { view, pending: [], setTab: () => {}, selectPerson: () => {} }));
};

test("royal and household mandates retain their own principal and representative portraits", () => {
  const html = council(baseView());
  const royal = html.slice(html.indexOf('aria-label="Rikets mandat"'), html.indexOf('aria-label="Familjens mandat"'));
  const household = html.slice(html.indexOf('aria-label="Familjens mandat"'));
  for (const id of [principal.id, royalRegent.id]) assert.ok(royal.includes(`data-portrait-person="${id}"`));
  for (const id of [familyHead.id, familyRegent.id]) assert.ok(household.includes(`data-portrait-person="${id}"`));
  assert.doesNotMatch(royal, /data-portrait-person="guardian"/);
  assert.match(html, /allvarlig sjukdom eller skada/);
  assert.match(html, /Förmyndarskap under omyndighet/);
});

test("missing representative keeps the living principal and blocked reason without invented stress or person link", () => {
  const view = baseView();
  view.representative = null;
  view.authority.royal.representativeId = null;
  view.authority.royal.blockedReason = "Ingen frisk regent finns.";
  view.authority.royal.playerCanExercise = false;
  const html = council(view);
  assert.match(html, /data-portrait-person="ruler"/);
  assert.match(html, /Ingen frisk regent finns/);
  assert.doesNotMatch(html, /Lär känna|aria-label="Stress|Avliden|successionsfrågan/);
});

test("legacy presentation renders without authority, including an explicit null representative", () => {
  const view = baseView();
  delete view.authority;
  assert.match(council(view), /Lär känna Bertil/);
  view.representative = null;
  const html = council(view);
  assert.match(html, /Ingen behörig företrädare/);
  assert.doesNotMatch(html, /Lär känna|data-portrait-person="ruler"|aria-label="Stress/);
});

test("incapacity without a regent is not described as contested succession", () => {
  const view = baseView();
  delete view.authority;
  view.governance = { actualRulerName: "Astrid", regencies: [{ id: "r", phase: "incapacity", principalName: "Astrid", regentName: null }] };
  const { GovernanceSummary } = loadPanel(view);
  const html = renderToStaticMarkup(React.createElement(GovernanceSummary, { view }));
  assert.match(html, /Ingen behörig regent finns för Astrid/);
  assert.doesNotMatch(html, /Omstridd överlämning|förvaltar makten för/);
});

test("household mandate remains visible when governance has no ruler summary", () => {
  const view = baseView();
  const { GovernanceSummary } = loadPanel(view);
  assert.match(renderToStaticMarkup(React.createElement(GovernanceSummary, { view })), /Familjens mandat/);
});

function elements(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(elements)];
}

test("every tab renders the real view of a realm campaign ended by dissolution", () => {
  const state = createCharacterSystem({ mode: "realm", polityId: "Hadara", seed: 321 });
  const view = getCharacterPresentation(applyRealmDissolution(state, { id: "annexed", date: state.date, reason: "Riket annekterades.", hostCandidates: [] }).state);
  for (const tab of ["council", "people", "families", "offices", "decisions", "intrigue", "chronicle"]) {
    const html = renderToStaticMarkup(loadPanel(view, { tab }).default({ open: true, onClose: () => {} }));
    assert.match(html, /Kampanjen är avslutad/, tab);
  }
  assert.match(renderToStaticMarkup(loadPanel(view).default({ open: true, onClose: () => {} })), /Riket har upplösts\./);
});

test("a blocked mandate leaves the time button enabled and wired to advance", async () => {
  const view = baseView();
  view.representative = null;
  for (const mandate of Object.values(view.authority)) {
    mandate.representativeId = null;
    mandate.playerCanExercise = false;
    mandate.blockedReason = "Ingen frisk företrädare finns.";
  }
  const panel = loadPanel(view);
  const tree = panel.default({ open: true, onClose: () => {} });
  const button = elements(tree).find((element) => element.props?.className === "char-button char-button--advance");
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  assert.deepEqual(panel.calls, ["advance"]);
});

test("time button remains disabled during work or after campaign end", () => {
  for (const [busy, ended] of [[true, false], [false, true]]) {
    const view = baseView();
    view.status.ended = ended;
    const panel = loadPanel(view, { busy });
    const button = elements(panel.default({ open: true, onClose: () => {} })).find((element) => element.props?.className === "char-button char-button--advance");
    assert.equal(button.props.disabled, true);
  }
});

test("both theme variants render the same separate mandate identities", () => {
  for (const theme of ["light", "dark"]) {
    const panel = loadPanel(baseView(), { theme });
    const html = renderToStaticMarkup(panel.default({ open: true, onClose: () => {} }));
    assert.ok(html.includes(`data-char-theme="${theme}"`));
    for (const person of [principal, royalRegent, familyHead, familyRegent]) assert.ok(html.includes(`data-portrait-person="${person.id}"`));
  }
});

test("each action names its supplied actor without choosing one from the payer", () => {
  const { ActionCard } = loadPanel(baseView(), { panelState: false });
  const actions = [
    { type: "appoint", label: "Utnämn", actorId: royalRegent.id, actorName: royalRegent.name, payer: { kind: "realm", id: "realm" }, cost: "15 silver ur statskassan" },
    { type: "educate", label: "Utbilda", actorId: familyRegent.id, actorName: familyRegent.name, payer: { kind: "family", id: "family" }, cost: "15 familjesilver" },
  ];
  const html = renderToStaticMarkup(React.createElement("div", null, actions.map((action) => React.createElement(ActionCard, { key: action.type, action }))));
  assert.match(html, /Utförs av: Bertil/);
  assert.match(html, /Utförs av: Dag/);
  assert.match(html, /15 silver ur statskassan/);
  assert.match(html, /15 familjesilver/);
});

test("blocked actor is explicit, while legacy actions do not invent an actor", () => {
  const { ActionCard } = loadPanel(baseView(), { panelState: false });
  const blocked = renderToStaticMarkup(React.createElement(ActionCard, { action: { type: "educate", label: "Utbilda", actorName: null, actorId: null, disabledReason: "Hushållet saknar ombud." } }));
  assert.match(blocked, /Ingen behörig aktör/);
  assert.match(blocked, /Hushållet saknar ombud/);
  assert.match(blocked, /disabled=""/);
  const legacy = renderToStaticMarkup(React.createElement(ActionCard, { action: { type: "educate", label: "Utbilda" } }));
  assert.doesNotMatch(legacy, /Utförs av|Ingen behörig aktör|disabled=""/);
});

test("inactive project effect preserves active project status and its original deadline", () => {
  const view = baseView();
  view.projects = [{ id: "reform", title: "Personlig reform", personal: true, status: "active", dueAt: "0200-12-01", effectActive: false, effectReason: "Ägaren saknar exekutivt mandat." }];
  const before = JSON.stringify(view.projects);
  const html = council(view);
  assert.match(html, /Projekt: Pågår/);
  assert.match(html, /Effekten är inaktiv/);
  assert.match(html, /Ägaren saknar exekutivt mandat/);
  assert.match(html, /Slutdatum: 0200-12-01/);
  assert.doesNotMatch(html, /Effekten är aktiv|Gäller till|Den upphör om ledaren/);
  assert.equal(JSON.stringify(view.projects), before);
});

test("project effect status is taken only from the presentation, with a legacy fallback", () => {
  const view = baseView();
  view.representative = null;
  view.projects = [{ id: "reform", title: "Personlig reform", personal: true, status: "active", effectActive: true, effectReason: "" }];
  assert.match(council(view), /Effekten är aktiv/);
  delete view.projects[0].effectActive;
  const html = council(view);
  assert.match(html, /Projekt: Pågår/);
  assert.doesNotMatch(html, /Effekten är aktiv|Effekten är inaktiv/);
});

const chainStory = () => ({
  id: "step-2", type: "event_chain", chainId: "chain-1", chainTitle: "Sigillet utanför sjukrummet", stepNumber: 2,
  status: "open", title: "Vem får frågorna?", description: "Hushållet väntar på ett besked.", dueAt: "0200-06-01",
  deadlineText: "När svarstiden löper ut avslutas ärendet utan val eller betalning.", nextAt: null,
  previousChoices: [{ title: "Listan vid dörren", choice: "Bekosta hjälp", date: "0200-03-01", actorName: "Dag" }],
  choices: [
    { id: "public", label: "Framför frågorna", description: "Regenten tar emot dem.", actorName: "Bertil", actorId: royalRegent.id, scope: "public", cost: "3 silver ur statskassan · 0 handlingar" },
    { id: "family", label: "Samla familjen", description: "Hushållet betalar för mötet.", actorName: "Dag", actorId: familyRegent.id, scope: "family", cost: "5 familjesilver · 0 handlingar" },
    { id: "close", label: "Avsluta uppföljningen", description: "Inget nytt åtagande.", actorName: null, actorId: null, scope: "none", cost: "0 silver · 0 handlingar" },
  ],
});

test("chain story shows its title, step, previous decision actor/date and explicit expiry text", () => {
  const { StoryCard } = loadPanel(baseView(), { panelState: false });
  const story = chainStory();
  story.fallbackDescription = "Äldre reservtext som inte ska ersätta kedjans tidsgräns.";
  const html = renderToStaticMarkup(React.createElement(StoryCard, { story }));
  assert.match(html, /Sigillet utanför sjukrummet · Steg 2/);
  assert.match(html, /<details[^>]*><summary>Tidigare val \(1\)<\/summary><ol/);
  assert.match(html, /Listan vid dörren/);
  assert.match(html, /Val: Bekosta hjälp/);
  assert.match(html, /0200-03-01 · Utfört av: Dag/);
  assert.match(html, /Senast 0200-06-01/);
  assert.match(html, /avslutas ärendet utan val eller betalning/);
  assert.doesNotMatch(html, /Äldre reservtext|Nästa uppföljning/);
});

test("chain choices name their own actors and preserve purse text while free close has no actor warning", () => {
  const { StoryCard } = loadPanel(baseView(), { panelState: false });
  const story = chainStory();
  const calls = [];
  const tree = StoryCard({ story, onCommand: (...args) => calls.push(args), busy: false });
  const buttons = elements(tree).filter((element) => element.type === "button");
  assert.equal(buttons.length, 3);
  const markup = buttons.map((button) => renderToStaticMarkup(button));
  assert.match(markup[0], /Utförs av: Bertil/);
  assert.match(markup[0], /3 silver ur statskassan · 0 handlingar/);
  assert.match(markup[1], /Utförs av: Dag/);
  assert.match(markup[1], /5 familjesilver · 0 handlingar/);
  assert.doesNotMatch(markup[2], /Utförs av|Ingen behörig aktör|disabled=/);
  buttons[2].props.onClick();
  assert.equal(calls[0][0], "resolve_story");
  assert.equal(calls[0][1].storyId, "step-2");
  assert.equal(calls[0][1].choiceId, "close");
});

test("missing scoped actor remains blocked, while legacy story choices retain their original rendering", () => {
  const { StoryCard } = loadPanel(baseView(), { panelState: false });
  const story = chainStory();
  story.choices[0] = { ...story.choices[0], actorName: null, actorId: null, disabledReason: "Kungligt ombud saknas." };
  const html = renderToStaticMarkup(React.createElement(StoryCard, { story }));
  assert.equal((html.match(/Ingen behörig aktör/g) || []).length, 1);
  assert.match(html, /Kungligt ombud saknas/);
  assert.equal((html.match(/disabled=""/g) || []).length, 1);
  const legacy = renderToStaticMarkup(React.createElement(StoryCard, { story: {
    id: "old", title: "Ett äldre ärende", description: "Vanlig berättelse", fallbackDescription: "Ingen ny åtgärd.",
    choices: [{ id: "keep", label: "Behåll", cost: "0 silver" }],
  } }));
  assert.match(legacy, /Ett beslut väntar/);
  assert.match(legacy, /Om du avstår till tidsgränsen: Ingen ny åtgärd/);
  assert.doesNotMatch(legacy, /Tidigare val|Steg|Ingen behörig aktör|Utförs av/);
});

test("waiting and completed chain history uses core labels and has no playable choices", () => {
  const { ChainHistory } = loadPanel(baseView(), { panelState: false });
  const chains = [
    { id: "waiting", title: "Ett framtida samtal", status: "waiting", statusLabel: "Inväntar uppföljning", nextAt: "0200-09-01", reason: "Besöket är planerat.", steps: chainStory().previousChoices, choices: chainStory().choices },
    { id: "done", title: "Det avslutade brevet", status: "resolved", statusLabel: "Avslutad", nextAt: null, reason: "Familjen avstod.", steps: [{ title: "Sista brevet", choice: "Avsluta", date: "0200-04-01", actorName: null }] },
  ];
  const html = renderToStaticMarkup(React.createElement(ChainHistory, { chains }));
  assert.equal((html.match(/<details/g) || []).length, 2);
  assert.equal((html.match(/<summary>/g) || []).length, 2);
  assert.match(html, /Inväntar uppföljning/);
  assert.match(html, /Nästa uppföljning: 0200-09-01/);
  assert.match(html, /Familjen avstod/);
  assert.match(html, /Val: Avsluta/);
  assert.doesNotMatch(html, /<button|resolve_story|Ingen behörig aktör|waiting|resolved/);
  assert.equal(renderToStaticMarkup(React.createElement(ChainHistory, {})), "");
});

test("Decisions includes chain history in both themes and excludes waiting stories from playable cards", () => {
  for (const theme of ["light", "dark"]) {
    const view = baseView();
    view.stories = [chainStory(), { ...chainStory(), id: "future", status: "waiting", title: "Inte ett spelbart steg", choices: [{ id: "future-choice", label: "Får inte visas som val" }] }];
    view.chainHistory = [{ id: "chain-2", title: "En väntande kedja", status: "waiting", statusLabel: "Väntar", nextAt: "0201-01-01", steps: [] }];
    const panel = loadPanel(view, { tab: "decisions", theme });
    const html = renderToStaticMarkup(panel.default({ open: true, onClose: () => {} }));
    assert.ok(html.includes(`data-char-theme="${theme}"`));
    assert.match(html, /Sigillet utanför sjukrummet/);
    assert.match(html, /Händelsekedjornas historik/);
    assert.match(html, /En väntande kedja/);
    assert.doesNotMatch(html, /Inte ett spelbart steg|Får inte visas som val/);
  }
  const legacy = loadPanel(baseView(), { tab: "decisions" });
  const html = renderToStaticMarkup(legacy.default({ open: true, onClose: () => {} }));
  assert.match(html, /Ärenden och handlingar/);
  assert.doesNotMatch(html, /Händelsekedjornas historik/);
});

// A real family campaign from the engine, so the catalog, staff and odds are the ones the player meets. `spymaster` seats one who reads loyalty exactly, so the diplomacy alone sets the precision of the odds.
function engineCampaign(diplomacy, { spymaster = false } = {}) {
  const state = createCharacterSystem({ mode: "family", seed: 41 });
  const representativeId = getCharacterPresentation(state).representative.id;
  if (diplomacy !== undefined) state.people[representativeId].skills.diplomacy = diplomacy;
  if (spymaster) {
    const reader = state.people["person-1-3"];
    state.offices.spymaster.holderId = reader.id;
    reader.loyalty = 80;
    reader.skills.intrigue = 12;
  }
  return { state, view: getCharacterPresentation(state) };
}
const swayAnswer = (view) => ({ ok: true, mode: "contested", catalogId: "sway", explanation: "Du vill vinna Isets gunst.",
  payload: { actionId: "sway", actorId: view.representative.id, targetIds: [view.catalog.find((entry) => entry.catalogId === "sway").fields[0].options[0].value], means: { silver: 10, agentRoles: ["cook"] } } });

test("the council shows the free-text action box above the pending decisions", () => {
  const { view } = engineCampaign();
  const { CouncilView } = loadPanel(view, { panelState: false });
  const pending = [{ id: "story-1", title: "Ett ärende", description: "Något väntar.", choices: [] }];
  const html = renderToStaticMarkup(React.createElement(CouncilView, { view, pending, setTab: () => {}, selectPerson: () => {} }));
  assert.match(html, /<textarea[^>]*id="char-action-text"/);
  assert.match(html, /<label[^>]*for="char-action-text"[^>]*>Vad vill du göra\?<\/label>/);
  assert.match(html, />Tolka</);
  assert.match(html, /class="char-text-button"[^>]*>Välj från listan</);
  assert.ok(html.indexOf("Vad vill du göra?") < html.indexOf('aria-label="Beslut som väntar"'));
});

test("a stubbed interpret answer shows the confirmation card with bands for a low-skill actor and numbers for a high-skill actor", async () => {
  const box = loadActionBox();
  for (const [diplomacy, expectNumbers] of [[3, false], [9, false], [14, true]]) {
    const { state, view } = engineCampaign(diplomacy);
    const step = await box.prepareInterpretedAction({ text: "Jag smickrar Iset", view,
      interpret: async () => swayAnswer(view), estimate: async (intent) => estimateCharacterAction(state, intent) });
    assert.equal(step.kind, "confirm", step.reason);
    const html = renderToStaticMarkup(React.createElement(box.ConfirmationCard, { proposal: step.proposal, view, onConfirm: () => {}, onCancel: () => {} }));
    const estimate = step.proposal.estimate;
    assert.match(html, /Påverka/);
    assert.match(html, new RegExp(`Utförs av: ${view.representative.name}`));
    assert.match(html, /Mål: Iset Arel/);
    assert.match(html, /Extra silver: 10/);
    assert.match(html, /Agenter: Kock/);
    assert.match(html, /15 silver ur familjekassan · 1 handling/);
    assert.match(html, />Genomför</);
    assert.match(html, />Avbryt</);
    assert.match(html, /Grundchans/);
    if (expectNumbers) {
      assert.equal(estimate.precision, "exact");
      assert.match(html, new RegExp(`Chans att lyckas: ${estimate.display.success} %`));
      assert.match(html, new RegExp(`Chans att hållas hemlig: ${estimate.display.secrecy} %`));
      assert.match(html, /Grundchans: \+50/);
    } else {
      assert.notEqual(estimate.precision, "exact");
      assert.match(html, new RegExp(`Chans att lyckas: ${estimate.display.success}<`));
      assert.match(html, new RegExp(`Chans att hållas hemlig: ${estimate.display.secrecy}<`));
      assert.doesNotMatch(html, /\d\s?%/, "a band precision must not show a percentage");
      assert.doesNotMatch(html, new RegExp(`\\b(${estimate.success.value}|${estimate.secrecy.value})\\b`), "the true odds must not reach the markup");
      assert.doesNotMatch(html, /Högsta möjliga chans|Lägsta möjliga chans/);
    }
  }
});

test("a command entry from interpret shows its display cost and the chosen field values", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const gift = view.catalog.find((entry) => entry.catalogId === "gift");
  const target = gift.fields[0].options[1];
  const step = await box.prepareInterpretedAction({ text: "Ge en gåva", view,
    interpret: async () => ({ ok: true, mode: "command", catalogId: "gift", payload: { targetId: target.value }, intent: { type: "gift", payload: { targetId: target.value } } }),
    estimate: async () => assert.fail("a command entry has no odds") });
  assert.equal(step.kind, "confirm");
  const html = renderToStaticMarkup(React.createElement(box.ConfirmationCard, { proposal: step.proposal, view, onConfirm: () => {}, onCancel: () => {} }));
  assert.ok(html.includes(gift.cost));
  assert.ok(html.includes(`Mottagare: ${target.label}`));
  assert.doesNotMatch(html, /Chans att lyckas/);
});

const INTERPRET_FAILED = "Texten kunde inte tolkas. Välj en handling i listan.";
// Runs `work` with console.warn captured, so a test can check what went to the log instead of the player.
async function withWarnings(work) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.map((arg) => arg instanceof Error ? arg.message : typeof arg === "string" ? arg : JSON.stringify(arg)).join(" "));
  try { return { result: await work(), warnings }; } finally { console.warn = original; }
}

test("with no model the menu offers every catalog action", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const { result: step, warnings } = await withWarnings(() => box.prepareInterpretedAction({ text: "Jag smickrar Iset", view,
    interpret: ({ text, view: seen }) => interpretCharacterAction({ text, view: seen, callModel: async () => { throw new Error("fetch failed"); } }),
    estimate: async () => assert.fail("no estimate without an answer") }));
  assert.deepEqual({ ...step }, { kind: "menu", reason: INTERPRET_FAILED });
  assert.ok(warnings.some((line) => line.includes("fetch failed")), "the transport error goes to the log");
  const panel = loadPanel(view);
  const html = renderToStaticMarkup(React.createElement(box.ActionMenu, { view, reason: step.reason, CommandCard: panel.ActionCard, onPropose: () => {} }));
  const listed = [...html.matchAll(/data-catalog-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(listed.sort(), view.catalog.map((entry) => entry.catalogId).sort());
  assert.match(html, /Texten kunde inte tolkas\. Välj en handling i listan\./);
  assert.doesNotMatch(html, /fetch failed/);
  assert.match(html, />Intrig</);
  assert.match(html, />Diplomati</);
  // A disabled entry stays listed, with its reason.
  assert.match(html, /Ingen behörig deltagare finns\./);
});

test("a contested menu entry asks for target, silver and at most two agents", () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const sway = view.catalog.find((entry) => entry.catalogId === "sway");
  const html = renderToStaticMarkup(React.createElement(box.ContestedForm, { entry: sway, view, onPropose: () => {} }));
  assert.match(html, /<select[^>]*>.*Iset Arel/);
  assert.match(html, /type="number"[^>]*min="0"[^>]*max="60"/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 5);
  assert.match(html, /Högst 2 agenter/);
  const disabled = renderToStaticMarkup(React.createElement(box.ContestedForm, { entry: { ...sway, disabledReason: "Årets handlingsutrymme är slut. För tiden framåt." }, view, onPropose: () => {} }));
  assert.match(disabled, /Årets handlingsutrymme är slut/);
  assert.match(disabled, /<button[^>]*disabled=""[^>]*>Visa chansen/);
});

test("a contested attempt is narrated and saved through recordCharacterNarrative only", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const proposal = { mode: "contested", catalogId: "sway", entry: view.catalog.find((entry) => entry.catalogId === "sway"), payload: swayAnswer(view).payload };
  const resolution = { id: "resolution-9", tier: "clean_success", tierLabel: "Lyckat i det tysta", refused: false, actionLabel: "Påverka", effects: [] };
  const submitted = [], recorded = [], order = [];
  const outcome = await box.executeProposal({ proposal, view: { ...view, recentResolutions: [] },
    submit: async (type) => { submitted.push(type); return { ok: true, state: { recentResolutions: [resolution], schemes: [] }, events: [{ title: "Påverka: lyckat i det tysta", description: "Standardtext." }, { title: "Rikets förvaltning", description: "En senare uppdatering." }] }; },
    narrate: async () => { order.push("narrate"); return { ok: true, title: "<b>Ett leende</b>", narrative: "Iset log.", adjustments: [{ effectIndex: 0, value: 12 }] }; },
    recordNarrative: async (payload) => { recorded.push(payload); return { ok: true }; },
    present: (state) => state, onProgress: (interim) => order.push(`${interim.heading} | ${interim.text} | ${interim.pending}`) });
  assert.deepEqual(order, ["Lyckat i det tysta | Standardtext. | Modellen skriver berättelsen…", "narrate"], "the tier shows before the model writes, with the outcome event's own text");
  assert.deepEqual(submitted, ["attempt_action"]);
  assert.deepEqual(JSON.parse(JSON.stringify(recorded)), [{ resolutionId: "resolution-9", title: "<b>Ett leende</b>", narrative: "Iset log.", adjustments: [{ effectIndex: 0, value: 12 }] }]);
  assert.equal(outcome.heading, "Lyckat i det tysta");
  const html = renderToStaticMarkup(React.createElement(box.OutcomeCard, { outcome }));
  assert.match(html, /&lt;b&gt;Ett leende&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>/);
  assert.doesNotMatch(html, /Berättelsen kunde inte skrivas/);
});

test("each tier has its own Swedish heading and a failed narrate keeps the default text", async () => {
  const box = loadActionBox();
  assert.deepEqual({ ...box.TIER_HEADINGS }, { clean_success: "Lyckat i det tysta", exposed_success: "Lyckat men avslöjat",
    quiet_failure: "Misslyckat i det tysta", exposed_failure: "Misslyckat och avslöjat", backfire: "Det slog tillbaka" });
  const { view } = engineCampaign();
  const proposal = { mode: "contested", catalogId: "sway", entry: view.catalog.find((entry) => entry.catalogId === "sway"), payload: swayAnswer(view).payload };
  let recorded = 0;
  const outcome = await box.executeProposal({ proposal, view: { ...view, recentResolutions: [{ id: "resolution-1" }] },
    submit: async () => ({ ok: true, state: { recentResolutions: [{ id: "resolution-1" }, { id: "resolution-2", tier: "backfire", refused: false, effects: [] }], schemes: [] }, events: [{ title: "Påverka: det slog tillbaka", description: "Iset genomskådade försöket." }] }),
    narrate: async () => ({ ok: false, reason: "Modellanropet misslyckades." }),
    recordNarrative: async () => { recorded += 1; return { ok: true }; },
    present: (state) => state });
  assert.equal(recorded, 0);
  assert.equal(outcome.heading, "Det slog tillbaka");
  const html = renderToStaticMarkup(React.createElement(box.OutcomeCard, { outcome }));
  assert.match(html, /Iset genomskådade försöket\./);
  assert.match(html, /Berättelsen kunde inte skrivas; utfallet gäller\./);
});

test("the odds card names its advisor, and the outcome card tells what the spymaster found", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const entry = view.catalog.find((item) => item.catalogId === "sway");
  const estimate = { display: { success: "trolig", secrecy: "trolig", modifiers: [], advisor: { name: "Barek Eshmun", officeName: "Kansler" } } };
  const proposal = { mode: "contested", catalogId: "sway", entry, payload: swayAnswer(view).payload, estimate };
  const card = renderToStaticMarkup(React.createElement(box.ConfirmationCard, { proposal, view, onConfirm: () => {}, onCancel: () => {} }));
  assert.match(card, /Bedömt av: Kansler Barek Eshmun/);
  const flattered = { id: "resolution-2", tier: "quiet_failure", refused: false, effects: [], odds: { success: "osäker", secrecy: "osäker" },
    flattery: { advisorName: "Barek Eshmun", officeName: "Kansler", shown: { success: "trolig", secrecy: "trolig" } } };
  const outcome = await box.executeProposal({ proposal, view: { ...view, recentResolutions: [] },
    submit: async () => ({ ok: true, state: { recentResolutions: [flattered], schemes: [] }, events: [{ title: "Påverka: misslyckat i det tysta", description: "Inget hände." }] }),
    narrate: async () => ({ ok: false, reason: "Modellanropet misslyckades." }), recordNarrative: async () => assert.fail(), present: (state) => state });
  const html = renderToStaticMarkup(React.createElement(box.OutcomeCard, { outcome }));
  assert.match(html, /Spionmästaren fann att kansler Barek Eshmun förskönade rådet\. Chansen att lyckas var osäker \(visad som trolig\), chansen att hållas hemlig var osäker \(visad som trolig\)\./);
  const oneBand = { ...flattered, odds: { success: "osäker", secrecy: "trolig" } };
  const single = await box.executeProposal({ proposal, view: { ...view, recentResolutions: [] },
    submit: async () => ({ ok: true, state: { recentResolutions: [oneBand], schemes: [] }, events: [] }),
    narrate: async () => ({ ok: false, reason: "Modellanropet misslyckades." }), recordNarrative: async () => assert.fail(), present: (state) => state });
  assert.equal(single.revealed, "Spionmästaren fann att kansler Barek Eshmun förskönade rådet. Chansen att lyckas var osäker (visad som trolig).");
});

test("a command proposal submits its own command and calls no model", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const submitted = [];
  const outcome = await box.executeProposal({ proposal: { mode: "command", catalogId: "gift", entry: view.catalog.find((entry) => entry.catalogId === "gift"), payload: { targetId: "person-0-2" } }, view,
    submit: async (type, payload) => { submitted.push([type, payload]); return { ok: true, events: [{ title: "En gåva", description: "Gåvan togs emot." }] }; },
    narrate: async () => assert.fail("a command is not narrated"), recordNarrative: async () => assert.fail("a command has no narrative"), present: (state) => state });
  assert.deepEqual(submitted, [["gift", { targetId: "person-0-2" }]]);
  assert.equal(outcome.ok, true);
});

test("the scheme list shows action, target and due date, and asks before it aborts", async () => {
  const driver = createHookDriver();
  const box = loadActionBox({ react: driver.react });
  const aborted = [];
  let emptied = 0;
  const props = { schemes: [
    { id: "scheme-4", actionLabel: "Undergräv", actorName: "Iset Arel", targetNames: ["Kamos Ptah"], dueAt: "-0299-04-01" },
    { id: "scheme-5", actionLabel: "Sprid rykten", actorName: "Iset Arel", targetNames: ["Nebet"], dueAt: "-0299-07-01" },
  ], onAbort: async (id) => { aborted.push(id); return { ok: true }; }, onEmpty: () => { emptied += 1; }, busy: false };
  const draw = () => driver.render(React.createElement(box.SchemeList, props));
  let tree = draw();
  const html = textOf(tree);
  assert.match(html, /Undergräv/);
  assert.match(html, /Mål: Kamos Ptah/);
  assert.match(html, /Avgörs: -0299-04-01/);
  const first = () => findAll(tree, (node) => node.type === "li" && textOf(node).includes("Undergräv"))[0];
  buttonNamed(first(), "Avbryt intrigen").props.onClick();
  tree = draw();
  assert.deepEqual(aborted, [], "the first click only asks");
  assert.match(textOf(first()), /Vill du avbryta intrigen\? Silver och handling som redan lagts kommer inte tillbaka\./);
  assert.equal(textOf(driver.focused.at(-1)), "Behåll intrigen");
  buttonNamed(first(), "Behåll intrigen").props.onClick();
  tree = draw();
  assert.equal(driver.focused.at(-1), buttonNamed(first(), "Avbryt intrigen"), "focus returns to the scheme the player kept");
  buttonNamed(first(), "Avbryt intrigen").props.onClick();
  tree = draw();
  buttonNamed(first(), "Ja, avbryt intrigen").props.onClick();
  assert.deepEqual(aborted, ["scheme-4"]);
  props.busy = true; tree = draw();
  await settle();
  props.busy = false; props.schemes = props.schemes.slice(1); tree = draw();
  assert.equal(driver.focused.at(-1), buttonNamed(tree, "Avbryt intrigen"), "focus moves to the next scheme");
  buttonNamed(tree, "Avbryt intrigen").props.onClick(); tree = draw();
  buttonNamed(tree, "Ja, avbryt intrigen").props.onClick();
  await settle();
  props.schemes = []; tree = draw();
  assert.equal(tree, null);
  assert.equal(emptied, 1, "with no scheme left, the panel chooses where focus goes");
});

// The action box under the hook driver, with the panel's lock imitated: busy while the work runs.
function mountBox({ view, runtime = {}, model = {}, CommandCard = null }) {
  const driver = createHookDriver();
  const box = loadActionBox({ react: driver.react, runtime, model });
  const props = { view, busy: false, CommandCard };
  let tree;
  const draw = () => (tree = driver.render(React.createElement(box.default, props)));
  props.runAction = async (work) => {
    props.busy = true; draw();
    try { return await work(); } finally { props.busy = false; }
  };
  draw();
  const act = async (action) => { await action(); await settle(); return draw(); };
  return { box, props, driver, draw, act, get tree() { return tree; } };
}
const formOf = (tree, className) => findAll(tree, (node) => node.type === "form" && node.props.className === className)[0];
const typeAndInterpret = (mounted, text) => mounted.act(async () => {
  findAll(mounted.tree, (node) => node.type === "textarea")[0].props.onChange({ target: { value: text } });
  mounted.draw();
  formOf(mounted.tree, "char-action-text").props.onSubmit({ preventDefault() {} });
});
const swayResolution = (overrides = {}) => ({ id: "resolution-9", tier: "clean_success", tierLabel: "Lyckat i det tysta", refused: false, actionLabel: "Påverka", effects: [], ...overrides });

test("the action box saves the story through recordCharacterNarrative and rolls on the revision its odds came from", async () => {
  const { state, view } = engineCampaign();
  const submitted = [], recorded = [], estimated = [];
  const mounted = mountBox({ view,
    model: { interpretCharacterAction: async () => swayAnswer(view),
      narrateCharacterResolution: async () => ({ ok: true, title: "Ett leende", narrative: "Iset log.", adjustments: [] }) },
    runtime: {
      estimateCharacterActionForView: async (intent) => { estimated.push(intent); return { ...estimateCharacterAction(state, intent), revision: view.revision + 1 }; },
      submitCharacterCommand: async (command) => { submitted.push(command); return { ok: true, state: { recentResolutions: [swayResolution()], schemes: [] }, events: [{ title: "Påverka: lyckat i det tysta", description: "Standardtext." }] }; },
      recordCharacterNarrative: async (payload) => { recorded.push(payload); return { ok: true }; },
    } });
  await typeAndInterpret(mounted, "Jag smickrar Iset");
  assert.equal(estimated.length, 1);
  await mounted.act(() => buttonNamed(mounted.tree, "Genomför").props.onClick());
  assert.deepEqual(submitted.map((command) => [command.type, command.expectedRevision]), [["attempt_action", view.revision + 1]],
    "the roll is made on the revision the odds came from, and the story is never sent as a player command");
  assert.deepEqual(JSON.parse(JSON.stringify(recorded)), [{ resolutionId: "resolution-9", title: "Ett leende", narrative: "Iset log.", adjustments: [] }]);
  assert.match(textOf(mounted.tree), /Lyckat i det tysta/);
  assert.match(textOf(mounted.tree), /Ett leende/);
});

test("a refused story, a narrate that throws and a refused order never show a model story as saved", async () => {
  const { state, view } = engineCampaign();
  const cases = [
    ["refused", { narrate: async () => ({ ok: true, title: "Modellens titel", narrative: "Modellens text." }), record: async () => ({ ok: false, error: "Berättelsen kan bara skrivas av berättarsteget." }) }],
    ["throws", { narrate: async () => { throw new Error("socket hang up"); }, record: async () => assert.fail("nothing to save") }],
  ];
  for (const [name, { narrate, record }] of cases) {
    const mounted = mountBox({ view, model: { interpretCharacterAction: async () => swayAnswer(view), narrateCharacterResolution: narrate },
      runtime: { estimateCharacterActionForView: async (intent) => ({ ...estimateCharacterAction(state, intent), revision: view.revision }),
        submitCharacterCommand: async () => ({ ok: true, state: { recentResolutions: [swayResolution({ tier: "exposed_failure" })], schemes: [] }, events: [{ title: "Påverka: misslyckat och avslöjat", description: "Iset såg igenom det." }] }),
        recordCharacterNarrative: record } });
    await withWarnings(async () => {
      await typeAndInterpret(mounted, "Jag smickrar Iset");
      await mounted.act(() => buttonNamed(mounted.tree, "Genomför").props.onClick());
    });
    const text = textOf(mounted.tree);
    assert.match(text, /Misslyckat och avslöjat/, name);
    assert.match(text, /Iset såg igenom det\./, name);
    assert.match(text, /Berättelsen kunde inte skrivas; utfallet gäller\./, name);
    assert.doesNotMatch(text, /Modellens/, name);
  }
  let narrated = 0;
  const refusedOrder = mountBox({ view, model: { interpretCharacterAction: async () => swayAnswer(view), narrateCharacterResolution: async () => { narrated += 1; return { ok: false }; } },
    runtime: { estimateCharacterActionForView: async (intent) => ({ ...estimateCharacterAction(state, intent), revision: view.revision }),
      submitCharacterCommand: async () => ({ ok: true, state: { recentResolutions: [swayResolution({ refused: true, tier: null, tierLabel: "Ordern vägrades" })], schemes: [] }, events: [{ title: "Påverka: ordern vägrades", description: "Iset vägrade lyda." }] }) } });
  await typeAndInterpret(refusedOrder, "Jag smickrar Iset");
  await refusedOrder.act(() => buttonNamed(refusedOrder.tree, "Genomför").props.onClick());
  assert.match(textOf(refusedOrder.tree), /Ordern vägrades/);
  assert.match(textOf(refusedOrder.tree), /Iset vägrade lyda\./);
  assert.equal(narrated, 0, "a refused order is not narrated");
});

test("a scheme start shows that the plan has begun and when it is decided", async () => {
  const { state, view } = engineCampaign();
  const undermine = view.catalog.find((entry) => entry.catalogId === "undermine");
  const answer = { ok: true, mode: "contested", catalogId: "undermine", explanation: "", payload: { actionId: "undermine", actorId: view.representative.id, targetIds: [undermine.fields[0].options[0].value], means: { silver: 0, agentRoles: [] } } };
  const mounted = mountBox({ view, model: { interpretCharacterAction: async () => answer, narrateCharacterResolution: async () => assert.fail("a scheme start is not narrated") },
    runtime: { estimateCharacterActionForView: async (intent) => ({ ...estimateCharacterAction(state, intent), revision: view.revision }),
      submitCharacterCommand: async () => ({ ok: true, state: { recentResolutions: [], schemes: [{ id: "scheme-1", actionLabel: "Undergräv", targetNames: ["Namar av Hadara"], dueAt: "-0300-04-01" }] }, events: [] }) } });
  await typeAndInterpret(mounted, "Undergräv Namar");
  await mounted.act(() => buttonNamed(mounted.tree, "Genomför").props.onClick());
  const text = textOf(mounted.tree);
  assert.match(text, /Intrigen har inletts/);
  assert.match(text, /Undergräv: Namar av Hadara/);
  assert.match(text, /Planen avgörs -0300-04-01\. Du kan avbryta den under Pågående intriger\./);
});

test("odds that the world has moved past are never rolled", async () => {
  const { state, view } = engineCampaign();
  let current = view.revision;
  const submitted = [];
  const engineSubmit = async (command) => {
    submitted.push(command);
    // The engine's own rule: a command for another revision is refused.
    if (command.expectedRevision !== current) return { ok: false, state: null, events: [], error: "Världen har ändrats. Läs det senaste läget och försök igen." };
    return { ok: true, state: { recentResolutions: [swayResolution()], schemes: [] }, events: [] };
  };
  let estimates = 0;
  const mounted = mountBox({ view, model: { interpretCharacterAction: async () => swayAnswer(view), narrateCharacterResolution: async () => ({ ok: false }) },
    runtime: { estimateCharacterActionForView: async (intent) => { estimates += 1; return { ...estimateCharacterAction(state, intent), revision: current }; }, submitCharacterCommand: engineSubmit } });
  await typeAndInterpret(mounted, "Jag smickrar Iset");
  // A year passes while the card is open; the panel reads the new revision.
  current += 1;
  mounted.props.view = { ...view, revision: current };
  mounted.draw();
  assert.equal(findAll(mounted.tree, (node) => node.type === "button" && textOf(node) === "Genomför").length, 0, "no roll on the old odds");
  assert.match(textOf(mounted.tree), /Läget har ändrats sedan chansen beräknades\. Beräkna chansen igen innan du bestämmer dig\./);
  await mounted.act(() => buttonNamed(mounted.tree, "Beräkna chansen igen").props.onClick());
  assert.equal(estimates, 2);
  assert.ok(buttonNamed(mounted.tree, "Genomför"));
  // The world moves again before the panel has read it: the engine refuses the stale revision.
  current += 1;
  await withWarnings(() => mounted.act(() => buttonNamed(mounted.tree, "Genomför").props.onClick()));
  assert.deepEqual(submitted.map((command) => command.expectedRevision), [view.revision + 1]);
  assert.match(textOf(mounted.tree), /Världen har ändrats\. Läs det senaste läget och försök igen\./);
  assert.doesNotMatch(textOf(mounted.tree), /Lyckat/);
});

test("an engine refusal reaches the player, an internal error becomes a Swedish sentence", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const proposal = { mode: "command", catalogId: "gift", entry: view.catalog.find((entry) => entry.catalogId === "gift"), payload: { targetId: "person-0-2" }, revision: view.revision };
  const run = (error) => withWarnings(() => box.executeProposal({ proposal, view, submit: async () => ({ ok: false, error }), narrate: async () => assert.fail(), recordNarrative: async () => assert.fail(), present: (state) => state }));
  const refused = await run("Familjekassan räcker inte till gåvan.");
  assert.equal(refused.result.text, "Familjekassan räcker inte till gåvan.");
  for (const internal of ["fetch failed", "Request failed with status 503.", "Unexpected token < in JSON at position 0", "NetworkError when attempting to fetch resource."]) {
    const { result, warnings } = await run(internal);
    assert.equal(result.text, "Handlingen kunde inte sparas. Försök igen om en stund.", internal);
    assert.ok(warnings.some((line) => line.includes(internal)), `${internal} goes to the log`);
  }
});

test("a schema failure from the model shows the Swedish sentence; a no-match explanation is shown as written", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const wrong = { toolInput: { status: "action", catalogId: "no-such-action" }, rawText: "" };
  const { result: step, warnings } = await withWarnings(() => box.prepareInterpretedAction({ text: "Jag smickrar Iset", view,
    interpret: ({ text, view: seen }) => interpretCharacterAction({ text, view: seen, callModel: async () => wrong }), estimate: async () => assert.fail() }));
  assert.equal(step.reason, INTERPRET_FAILED);
  assert.ok(warnings.some((line) => line.includes("no-such-action")));
  const html = renderToStaticMarkup(React.createElement(box.ActionMenu, { view, reason: step.reason, onPropose: () => {} }));
  assert.doesNotMatch(html, /catalogId|no-such-action/);
  const noMatch = await box.prepareInterpretedAction({ text: "Jag flyger till månen", view,
    interpret: ({ text, view: seen }) => interpretCharacterAction({ text, view: seen, callModel: async () => ({ toolInput: { status: "no_match", explanation: "Ingen handling låter dig flyga.", suggestions: [] } }) }), estimate: async () => assert.fail() });
  assert.equal(noMatch.reason, "Ingen handling låter dig flyga.");
});

test("an English reason without the model's origin and an explanation that is no sentence never reach the player", async () => {
  const box = loadActionBox();
  const { state, view } = engineCampaign();
  const { result: noMatch, warnings } = await withWarnings(() => box.prepareInterpretedAction({ text: "Jag flyger till månen", view,
    interpret: async () => ({ ok: false, reason: "The model failed to match the text", fallback: "menu" }), estimate: async () => assert.fail() }));
  assert.equal(noMatch.reason, INTERPRET_FAILED);
  assert.ok(warnings.some((line) => line.includes("failed to match")));
  const { result: step } = await withWarnings(() => box.prepareInterpretedAction({ text: "Jag smickrar Iset", view,
    interpret: async () => ({ ...swayAnswer(view), explanation: "The request was parsed with an error" }), estimate: async (intent) => estimateCharacterAction(state, intent) }));
  assert.equal(step.kind, "confirm");
  assert.equal(step.proposal.explanation, "");
  const html = renderToStaticMarkup(React.createElement(box.ConfirmationCard, { proposal: step.proposal, view, onConfirm: () => {}, onCancel: () => {} }));
  assert.doesNotMatch(html, /parsed with an error/);
  const kept = await box.prepareInterpretedAction({ text: "Jag smickrar Iset", view,
    interpret: async () => ({ ...swayAnswer(view), explanation: "Du vinner Isets gunst." }), estimate: async (intent) => estimateCharacterAction(state, intent) });
  assert.equal(kept.proposal.explanation, "Du vinner Isets gunst.");
});

test("the menu form sends the representative, the chosen target, silver and at most two agents", async () => {
  const { state, view } = engineCampaign();
  const estimated = [];
  const mounted = mountBox({ view, runtime: { estimateCharacterActionForView: async (intent) => { estimated.push(intent); return { ...estimateCharacterAction(state, intent), revision: view.revision }; } } });
  await mounted.act(() => buttonNamed(mounted.tree, "Välj från listan").props.onClick());
  const sway = view.catalog.find((entry) => entry.catalogId === "sway");
  const item = () => findAll(mounted.tree, (node) => node.type === "li" && node.props["data-catalog-id"] === "sway")[0];
  const target = sway.fields[0].options.at(-1).value;
  findAll(item(), (node) => node.type === "select")[0].props.onChange({ target: { value: target } }); mounted.draw();
  findAll(item(), (node) => node.type === "input" && node.props.type === "number")[0].props.onChange({ target: { value: "12" } }); mounted.draw();
  const boxes = () => findAll(item(), (node) => node.type === "input" && node.props.type === "checkbox");
  boxes()[0].props.onChange(); mounted.draw();
  boxes()[1].props.onChange(); mounted.draw();
  assert.deepEqual(boxes().map((input) => Boolean(input.props.disabled)), [false, false, true, true, true], "the third agent is locked");
  boxes()[2].props.onChange(); mounted.draw();
  await mounted.act(() => formOf(item(), "char-contested-form").props.onSubmit({ preventDefault() {} }));
  const roles = sway.fields.find((field) => field.key === "agentRoles").options.slice(0, 2).map((option) => option.value);
  assert.deepEqual(JSON.parse(JSON.stringify(estimated)), [{ actionId: "sway", actorId: view.representative.id, targetIds: [target], means: { silver: 12, agentRoles: roles } }]);
  assert.match(textOf(mounted.tree), /Chans att lyckas/);
});

test("a contested entry outside the known categories is listed under Övrigt", () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const sway = view.catalog.find((entry) => entry.catalogId === "sway");
  const odd = { ...view, catalog: [...view.catalog, { ...sway, catalogId: "omen", label: "Tyd ett omen", category: "mystery" }] };
  const html = renderToStaticMarkup(React.createElement(box.ActionMenu, { view: odd, onPropose: () => {} }));
  assert.ok(html.includes(">Övrigt<"));
  assert.match(html.slice(html.indexOf(">Övrigt<")), /data-catalog-id="omen"/);
});

test("after each step focus lands on what the player needs next, not on the panel header", async () => {
  const { state, view } = engineCampaign();
  const mounted = mountBox({ view, model: { interpretCharacterAction: async () => swayAnswer(view), narrateCharacterResolution: async () => ({ ok: false }) },
    runtime: { estimateCharacterActionForView: async (intent) => ({ ...estimateCharacterAction(state, intent), revision: view.revision }),
      submitCharacterCommand: async () => ({ ok: true, state: { recentResolutions: [swayResolution()], schemes: [] }, events: [{ title: "Påverka: lyckat i det tysta", description: "Standardtext." }] }) } });
  assert.equal(mounted.driver.focused.length, 0, "mounting takes no focus");
  await typeAndInterpret(mounted, "Jag smickrar Iset");
  assert.deepEqual([mounted.driver.focused.at(-1).type, textOf(mounted.driver.focused.at(-1))], ["h4", "Påverka"]);
  await mounted.act(() => buttonNamed(mounted.tree, "Avbryt").props.onClick());
  assert.equal(mounted.driver.focused.at(-1).type, "textarea");
  await typeAndInterpret(mounted, "Jag smickrar Iset");
  await withWarnings(() => mounted.act(() => buttonNamed(mounted.tree, "Genomför").props.onClick()));
  assert.deepEqual([mounted.driver.focused.at(-1).type, textOf(mounted.driver.focused.at(-1))], ["h4", "Lyckat i det tysta"]);
  await mounted.act(() => buttonNamed(mounted.tree, "Välj från listan").props.onClick());
  assert.equal(mounted.driver.focused.at(-1).props["aria-label"], "Alla handlingar");
});

test("the panel header shows the difficulty and the footer counts model calls", () => {
  const view = baseView();
  view.difficulty = { id: "hard", label: "Svår" };
  const html = renderToStaticMarkup(loadPanel(view, { modelCalls: 3 }).default({ open: true, onClose: () => {} }));
  assert.match(html, /Svårighetsgrad: Svår/);
  assert.match(html, /Modellanrop denna session: 3/);
  assert.match(html, /Attainder · Dynastier/);
  assert.doesNotMatch(html, /Open Historia/);
});

test("every odds reason from the engine reaches the player unchanged, å, ä and ö included", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  assert.equal(ODDS_REASONS.actorIncapacitated, "Aktören är oförmögen att utöva ett mandat just nu.");
  const proposal = { mode: "command", catalogId: "gift", entry: view.catalog.find((entry) => entry.catalogId === "gift"), payload: { targetId: "person-0-2" }, revision: view.revision };
  for (const reason of Object.values(ODDS_REASONS)) {
    const { result: outcome, warnings } = await withWarnings(() => box.executeProposal({ proposal, view, submit: async () => ({ ok: false, error: reason }),
      narrate: async () => assert.fail(), recordNarrative: async () => assert.fail(), present: (state) => state }));
    assert.equal(outcome.text, reason, "a refused attempt shows the engine's sentence");
    const step = await box.prepareInterpretedAction({ text: "Jag smickrar Iset", view, interpret: async () => swayAnswer(view), estimate: async () => ({ ok: false, reason }) });
    assert.equal(step.reason, reason, "a refused estimate shows the engine's sentence");
    assert.deepEqual(warnings, [], `${reason} is not treated as an internal error`);
  }
  const { result: transport } = await withWarnings(() => box.executeProposal({ proposal, view, submit: async () => ({ ok: false, error: "Failed to fetch the response." }),
    narrate: async () => assert.fail(), recordNarrative: async () => assert.fail(), present: (state) => state }));
  assert.equal(transport.text, "Handlingen kunde inte sparas. Försök igen om en stund.", "an English transport message is still kept from the player");
});

test("when the odds go stale while focus is in the card, focus moves to Beräkna chansen igen", async () => {
  const { state, view } = engineCampaign();
  const mount = () => mountBox({ view, model: { interpretCharacterAction: async () => swayAnswer(view) },
    runtime: { estimateCharacterActionForView: async (intent) => ({ ...estimateCharacterAction(state, intent), revision: view.revision }) } });
  const card = (tree) => findAll(tree, (node) => node.type === "section" && node.props["aria-label"] === "Bekräfta handlingen")[0];
  const inside = mount();
  await typeAndInterpret(inside, "Jag smickrar Iset");
  card(inside.tree).props.onFocus({});
  inside.props.view = { ...view, revision: view.revision + 1 };
  inside.draw();
  assert.equal(inside.driver.focused.at(-1), buttonNamed(inside.tree, "Beräkna chansen igen"));
  // Focus the player has already moved elsewhere stays where it is.
  const outside = mount();
  await typeAndInterpret(outside, "Jag smickrar Iset");
  card(outside.tree).props.onFocus({});
  card(outside.tree).props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: { tag: "textarea" } });
  const before = outside.driver.focused.length;
  outside.props.view = { ...view, revision: view.revision + 1 };
  outside.draw();
  assert.equal(outside.driver.focused.length, before);
  assert.ok(buttonNamed(outside.tree, "Beräkna chansen igen"));
});

test("a refused abort keeps the scheme, shows why and keeps focus on the scheme's own button", async () => {
  const schemes = [
    { id: "scheme-4", actionLabel: "Undergräv", actorName: "Iset Arel", targetNames: ["Kamos Ptah"], dueAt: "-0299-04-01" },
    { id: "scheme-5", actionLabel: "Sprid rykten", actorName: "Iset Arel", targetNames: ["Nebet"], dueAt: "-0299-07-01" },
  ];
  const cases = [
    ["refused", async () => ({ ok: false, error: "Intrigen kan inte längre avbrytas." }), "Intrigen kan inte längre avbrytas."],
    ["internal", async () => ({ ok: false, error: "fetch failed" }), "Intrigen kunde inte avbrytas. Försök igen om en stund."],
    ["throws", async () => { throw new Error("socket hang up"); }, "Intrigen kunde inte avbrytas. Försök igen om en stund."],
  ];
  for (const [name, onAbort, shown] of cases) {
    const driver = createHookDriver();
    const box = loadActionBox({ react: driver.react });
    let emptied = 0;
    const props = { schemes, onAbort, onEmpty: () => { emptied += 1; }, busy: false };
    let tree = driver.render(React.createElement(box.SchemeList, props));
    const first = () => findAll(tree, (node) => node.type === "li" && textOf(node).includes("Undergräv"))[0];
    buttonNamed(first(), "Avbryt intrigen").props.onClick();
    tree = driver.render(React.createElement(box.SchemeList, props));
    await withWarnings(async () => { buttonNamed(first(), "Ja, avbryt intrigen").props.onClick(); await settle(); });
    tree = driver.render(React.createElement(box.SchemeList, props));
    const own = buttonNamed(first(), "Avbryt intrigen");
    assert.equal(driver.focused.at(-1), own, `${name}: focus stays on the scheme that remains`);
    const refusal = findAll(first(), (node) => node.props?.id === own.props["aria-describedby"])[0];
    assert.equal(textOf(refusal), shown, name);
    assert.equal(emptied, 0, name);
  }
});

test("in the panel a refused abort leaves the scheme with its refusal and focus on its own button", async () => {
  const driver = createHookDriver();
  const view = { ...engineCampaign().view, schemes: [{ id: "scheme-4", actionLabel: "Undergräv", actorName: "Iset Arel", targetNames: ["Kamos Ptah"], dueAt: "-0299-04-01" }] };
  const submitted = [];
  const { default: Panel } = loadPanel(view, { react: driver.react, globals: {
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }, document: { activeElement: null } },
  runtime: { submitCharacterCommand: async (command) => { submitted.push(command); return { ok: false, state: null, events: [], error: "Intrigen kan inte längre avbrytas." }; } } });
  const draw = () => driver.render(React.createElement(Panel, { open: true, onClose: () => {} }));
  let tree = draw();
  await settle();
  tree = draw();
  const scheme = () => findAll(tree, (node) => node.type === "li" && node.props.className === "char-card char-scheme")[0];
  buttonNamed(scheme(), "Avbryt intrigen").props.onClick();
  tree = draw();
  buttonNamed(scheme(), "Ja, avbryt intrigen").props.onClick();
  await settle();
  tree = draw();
  assert.deepEqual(submitted.map((command) => [command.type, command.payload.schemeId]), [["abort_scheme", "scheme-4"]]);
  assert.match(textOf(scheme()), /Intrigen kan inte längre avbrytas\./);
  assert.equal(driver.focused.at(-1), buttonNamed(scheme(), "Avbryt intrigen"));
  const banner = findAll(tree, (node) => node.props?.role === "alert");
  assert.equal(banner.length, 0, "the refusal shows once, under the scheme, not in the panel banner");
});

// --- Phase 2: the intrigue tab, the feast, prisoners and the means selects ---

const intrigueView = () => ({
  ...baseView(),
  knownSecrets: [
    { id: "secret-1", type: "murder", typeLabel: "Mord", subjectId: "p-namar", subjectName: "Namar av Hadara", evidence: "strong", evidenceLabel: "starkt", exposed: false },
    { id: "secret-2", type: "heresy", typeLabel: "Kätteri", subjectId: "p-sera", subjectName: "Sera Arel", evidence: "weak", evidenceLabel: "svagt", exposed: true },
  ],
  ownHooks: [{ id: "hook-1", targetId: "p-namar", targetName: "Namar av Hadara", strength: "strong", strengthLabel: "starkt" },
    { id: "hook-2", targetId: "p-barek", targetName: "Barek Eshmun", strength: "weak", strengthLabel: "svagt" }],
  prisoners: [{ id: "prisoner-1", personId: "p-kamos", name: "Kamos Ptah", familyId: "f-ptah", familyName: "Ptah", since: "0200-03-01", ransom: 25 },
    { id: "prisoner-2", personId: "p-nebet", name: "Nebet", familyId: "f-ptah", familyName: "Ptah", since: "0200-05-01", ransom: 40 }],
  rumors: [
    { id: "rumor-1", date: "0200-05-02", topic: "murder", topicLabel: "Mord", subjectId: "p-sera", subjectName: "Sera Arel", claimedActorId: null, claimedActorName: null, reliability: "trolig" },
    { id: "rumor-2", date: "0200-04-11", topic: "plot", topicLabel: "Komplott", subjectId: "p-barek", subjectName: "Barek Eshmun", claimedActorId: "p-kelan", claimedActorName: "Kelan Namar", reliability: "osäker" },
  ],
  schemes: [{ id: "scheme-4", actionLabel: "Undergräv", actorName: "Iset Arel", targetNames: ["Kamos Ptah"], dueAt: "0200-09-01" }],
  // The engine lists both entries while prisoners are held; their disabledReason decides the prisoner buttons.
  actions: [{ type: "release_prisoner", label: "Frige en fånge", disabledReason: "", fields: [] }, { type: "execute_prisoner", label: "Avrätta en fånge", disabledReason: "", fields: [] }],
});

test("the Intriger tab follows Beslut and shows secrets, hooks, prisoners, rumors and schemes", () => {
  const html = renderToStaticMarkup(loadPanel(intrigueView(), { tab: "intrigue" }).default({ open: true, onClose: () => {} }));
  assert.match(html, /Beslut<\/button><button[^>]*>Intriger</);
  const section = (name) => html.slice(html.indexOf(`aria-label="${name}"`));
  const between = (name, next) => { const from = section(name); return from.slice(0, from.indexOf(`aria-label="${next}"`)); };
  for (const name of ["Hemligheter du känner till", "Grepp", "Fångar", "Rykten", "Pågående intriger"]) assert.ok(html.includes(`aria-label="${name}"`), name);
  const secrets = between("Hemligheter du känner till", "Grepp");
  assert.match(secrets, /Mord/);
  assert.match(secrets, /Namar av Hadara/);
  assert.match(secrets, /Bevis: starkt/);
  assert.match(secrets, /Bevis: svagt/);
  assert.equal((secrets.match(/avslöjad/g) || []).length, 1, "only the exposed secret is marked");
  const hooks = between("Grepp", "Fångar");
  assert.match(hooks, /Namar av Hadara/);
  assert.match(hooks, /Styrka: starkt/);
  assert.match(hooks, /Styrka: svagt/);
  const prisoners = between("Fångar", "Rykten");
  assert.match(prisoners, /Kamos Ptah/);
  assert.match(prisoners, /Fånge sedan 0200-03-01/);
  assert.match(prisoners, /Lösensumma: 25 silver/);
  assert.equal((prisoners.match(/>Frige</g) || []).length, 2);
  assert.equal((prisoners.match(/>Avrätta</g) || []).length, 2);
  const rumors = between("Rykten", "Pågående intriger");
  assert.match(rumors, /0200-05-02/);
  assert.match(rumors, /Mord/);
  assert.match(rumors, /Påstådd aktör: okänd/);
  assert.match(rumors, /Påstådd aktör: Kelan Namar/);
  assert.match(rumors, /Tillförlitlighet: trolig/);
  assert.match(rumors, /Tillförlitlighet: osäker/);
  assert.match(section("Pågående intriger"), /Undergräv/);
});

test("an Intriger tab without secrets, hooks, prisoners or rumors says so instead of staying blank", () => {
  const html = renderToStaticMarkup(loadPanel(baseView(), { tab: "intrigue" }).default({ open: true, onClose: () => {} }));
  assert.match(html, /Du känner inga hemligheter ännu\./);
  assert.match(html, /Du har inga grepp över någon\./);
  assert.match(html, /Inga fångar hålls just nu\./);
  assert.match(html, /Du har inte hört några rykten\./);
});

// The intrigue tab under the hook driver.
function mountIntrigue({ view = intrigueView(), onCommand = async () => ({ ok: true }), onEmpty = () => {} } = {}) {
  const driver = createHookDriver();
  const panel = loadPanel(view, { react: driver.react });
  const props = { view, busy: false, onCommand, onEmpty };
  let tree;
  const draw = () => (tree = driver.render(React.createElement(panel.IntrigueView, props)));
  draw();
  return { props, driver, draw, get tree() { return tree; } };
}
const prisonerItem = (tree, name) => findAll(tree, (node) => node.type === "li" && node.props.className === "char-card char-prisoner" && textOf(node).includes(name))[0];

test("Avrätta asks first, names the prisoner and submits only on the second button", () => {
  const sent = [];
  const mounted = mountIntrigue({ onCommand: async (type, payload) => { sent.push([type, payload]); return { ok: true }; } });
  buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Avrätta").props.onClick();
  mounted.draw();
  assert.deepEqual(sent, [], "the first click only asks");
  assert.match(textOf(prisonerItem(mounted.tree, "Kamos Ptah")), /Vill du avrätta Kamos Ptah\? Det går inte att ångra\./);
  assert.equal(textOf(mounted.driver.focused.at(-1)), "Behåll fången", "focus follows the question");
  buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Behåll fången").props.onClick();
  mounted.draw();
  assert.deepEqual(sent, []);
  assert.equal(mounted.driver.focused.at(-1), buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Avrätta"), "focus returns to the prisoner the player kept");
  buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Avrätta").props.onClick();
  mounted.draw();
  buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Ja, avrätta").props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [["execute_prisoner", { prisonerId: "prisoner-1" }]]);
});

test("Frige submits release_prisoner without a question and a refusal stays under the prisoner", async () => {
  const sent = [];
  let answer = { ok: false, error: "Fången är redan frigiven." };
  const mounted = mountIntrigue({ onCommand: async (type, payload) => { sent.push([type, payload]); return answer; } });
  buttonNamed(prisonerItem(mounted.tree, "Nebet"), "Frige").props.onClick();
  await settle();
  mounted.draw();
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [["release_prisoner", { prisonerId: "prisoner-2" }]]);
  assert.match(textOf(prisonerItem(mounted.tree, "Nebet")), /Fången är redan frigiven\./);
  assert.equal(mounted.driver.focused.at(-1), buttonNamed(prisonerItem(mounted.tree, "Nebet"), "Frige"), "focus stays on the control that was refused");
  answer = { ok: false, error: "fetch failed" };
  buttonNamed(prisonerItem(mounted.tree, "Nebet"), "Frige").props.onClick();
  await withWarnings(settle);
  mounted.draw();
  assert.match(textOf(prisonerItem(mounted.tree, "Nebet")), /Handlingen kunde inte genomföras\. Försök igen om en stund\./);
  assert.doesNotMatch(textOf(prisonerItem(mounted.tree, "Nebet")), /fetch failed/);
});

test("the last prisoner released hands focus to the tab heading", async () => {
  let emptied = 0;
  const view = { ...intrigueView(), prisoners: [intrigueView().prisoners[0]] };
  const mounted = mountIntrigue({ view, onEmpty: () => { emptied += 1; } });
  buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Frige").props.onClick();
  await settle();
  mounted.props.view = { ...view, prisoners: [] };
  mounted.draw();
  assert.equal(emptied, 1);
});

test("in the panel a refused execution shows once under the prisoner, not in the banner", async () => {
  const driver = createHookDriver();
  const submitted = [];
  const { default: Panel } = loadPanel(intrigueView(), { react: driver.react, globals: {
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }, document: { activeElement: null } },
  runtime: { submitCharacterCommand: async (command) => { submitted.push(command); return { ok: false, state: null, events: [], error: "Fången kan inte avrättas just nu." }; } } });
  const draw = () => driver.render(React.createElement(Panel, { open: true, onClose: () => {} }));
  let tree = draw();
  await settle();
  tree = draw();
  buttonNamed(findAll(tree, (node) => node.type === "nav")[0], "Intriger").props.onClick();
  tree = draw();
  buttonNamed(prisonerItem(tree, "Kamos Ptah"), "Avrätta").props.onClick();
  tree = draw();
  buttonNamed(prisonerItem(tree, "Kamos Ptah"), "Ja, avrätta").props.onClick();
  await settle();
  tree = draw();
  assert.deepEqual(submitted.map((command) => [command.type, command.payload.prisonerId]), [["execute_prisoner", "prisoner-1"]]);
  assert.match(textOf(prisonerItem(tree, "Kamos Ptah")), /Fången kan inte avrättas just nu\./);
  assert.equal(findAll(tree, (node) => node.props?.role === "alert").length, 0);
});

test("the council shows a running feast with its end date, and nothing without one", () => {
  const view = baseView();
  assert.doesNotMatch(council(view), /Gästabud pågår/);
  view.occasions = [{ id: "occasion-3", kind: "feast", label: "Gästabud", endsAt: "0200-07-01", guestCount: 14 }];
  const html = council(view);
  assert.match(html, /Gästabud pågår till 0200-07-01/);
  assert.match(html, /14 gäster/);
});

test("Håll gästabud is offered through the catalog menu like any command entry", () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const panel = loadPanel(view);
  const html = renderToStaticMarkup(React.createElement(box.ActionMenu, { view, CommandCard: panel.ActionCard, onPropose: () => {} }));
  assert.match(html, /data-catalog-id="hold_feast"/);
  assert.match(html.slice(html.indexOf('data-catalog-id="hold_feast"')), /Håll gästabud/);
});

// A family campaign where the representative holds a secret and a hook, so the menu form has something to choose from.
function campaignWithLeverage() {
  const { state } = engineCampaign();
  const representativeId = getCharacterPresentation(state).representative.id;
  const secret = createSecret(state, { type: "murder", subjectId: "person-1-0", holderIds: [representativeId], evidence: "strong" });
  const hook = grantHook(state, { ownerId: representativeId, targetId: "person-1-0", strength: "strong" });
  return { state, secret, hook, view: getCharacterPresentation(state) };
}
const entryOf = (view, id) => view.catalog.find((entry) => entry.catalogId === id);
const selectFor = (tree, label) => findAll(tree, (node) => node.type === "label" && textOf(node).startsWith(label)).map((node) => findAll(node, (inner) => inner.type === "select")[0]).find(Boolean);
function mountForm(entry, view, { onPropose = () => {} } = {}) {
  const driver = createHookDriver();
  const box = loadActionBox({ react: driver.react });
  const props = { entry, view, onPropose, busy: false };
  let tree;
  const draw = () => (tree = driver.render(React.createElement(box.ContestedForm, props)));
  draw();
  return { driver, draw, get tree() { return tree; } };
}
const submitForm = (mounted) => formOf(mounted.tree, "char-contested-form").props.onSubmit({ preventDefault() {} });
const submitButton = (mounted) => findAll(mounted.tree, (node) => node.type === "button" && textOf(node) === "Visa chansen")[0];

test("the blackmail form offers the secrets about the chosen target and sends the chosen secret as a means", () => {
  const { view, secret } = campaignWithLeverage();
  const proposals = [];
  const mounted = mountForm(entryOf(view, "blackmail"), view, { onPropose: (entry, payload) => proposals.push(payload) });
  assert.ok(selectFor(mounted.tree, "Hemlighet"), "the secret select is rendered from the entry's fields");
  // The first target has no secret about them: nothing to send, and the form says why.
  assert.notEqual(selectFor(mounted.tree, "Mål").props.value, "person-1-0");
  assert.match(textOf(mounted.tree), /Du känner ingen hemlighet om /);
  assert.equal(submitButton(mounted).props.disabled, true);
  selectFor(mounted.tree, "Mål").props.onChange({ target: { value: "person-1-0" } });
  mounted.draw();
  const options = findAll(selectFor(mounted.tree, "Hemlighet"), (node) => node.type === "option");
  assert.deepEqual(options.map((option) => option.props.value), [secret.id]);
  assert.match(textOf(options[0]), /Mord: Namar av Hadara/);
  assert.equal(submitButton(mounted).props.disabled, false);
  submitForm(mounted);
  assert.equal(proposals.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(proposals[0].means)), { silver: 0, agentRoles: [], secretId: secret.id });
  assert.deepEqual(JSON.parse(JSON.stringify(proposals[0].targetIds)), ["person-1-0"]);
});

test("a required select with nothing to choose disables the form with a Swedish reason", () => {
  const { view } = engineCampaign();
  const proposals = [];
  const mounted = mountForm(entryOf(view, "blackmail"), view, { onPropose: (...args) => proposals.push(args) });
  assert.match(textOf(mounted.tree), /Du känner ingen hemlighet som går att använda\./);
  assert.equal(submitButton(mounted).props.disabled, true);
  assert.equal(selectFor(mounted.tree, "Hemlighet").props.disabled, true);
  submitForm(mounted);
  assert.deepEqual(proposals, [], "an offer the engine always refuses is never sent");
});

test("an optional hook select starts on Ingen and an empty choice is omitted from the means", () => {
  const { view, hook } = campaignWithLeverage();
  const proposals = [];
  const mounted = mountForm(entryOf(view, "poison"), view, { onPropose: (entry, payload) => proposals.push(payload) });
  const hookSelect = () => selectFor(mounted.tree, "Grepp");
  selectFor(mounted.tree, "Mål").props.onChange({ target: { value: "person-1-0" } });
  mounted.draw();
  assert.deepEqual(findAll(hookSelect(), (node) => node.type === "option").map((option) => textOf(option)), ["Ingen", "Starkt grepp över Namar av Hadara"]);
  assert.equal(hookSelect().props.value, "");
  submitForm(mounted);
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(proposals[0].means))).sort(), ["agentRoles", "silver"], "no hookId: '' is sent");
  hookSelect().props.onChange({ target: { value: hook.id } });
  mounted.draw();
  submitForm(mounted);
  assert.equal(proposals[1].means.hookId, hook.id);
  hookSelect().props.onChange({ target: { value: "" } });
  mounted.draw();
  submitForm(mounted);
  assert.equal(Object.hasOwn(proposals[2].means, "hookId"), false);
});

test("the rumor form sends the chosen topic and only entries with the field show a select", () => {
  const { view } = engineCampaign();
  const proposals = [];
  const topics = entryOf(view, "spread_rumor").fields.find((field) => field.key === "topic").options;
  const mounted = mountForm(entryOf(view, "spread_rumor"), view, { onPropose: (entry, payload) => proposals.push(payload) });
  const topicSelect = () => selectFor(mounted.tree, "Ämne");
  assert.equal(findAll(topicSelect(), (node) => node.type === "option").length, topics.length);
  topicSelect().props.onChange({ target: { value: topics[2].value } });
  mounted.draw();
  submitForm(mounted);
  assert.equal(proposals[0].means.topic, topics[2].value);
  assert.equal(Object.hasOwn(proposals[0].means, "secretId"), false);
  const sway = mountForm(entryOf(view, "sway"), view);
  for (const label of ["Ämne", "Hemlighet", "Grepp"]) assert.equal(selectFor(sway.tree, label), undefined, label);
});

test("the confirmation card names the means and the estimate and the command receive them unchanged", async () => {
  const box = loadActionBox();
  const { state, view, secret } = campaignWithLeverage();
  const payload = { actionId: "blackmail", actorId: view.representative.id, targetIds: ["person-1-0"], means: { silver: 0, agentRoles: [], secretId: secret.id } };
  const estimated = [];
  const step = await box.prepareInterpretedAction({ text: "Utpressa Namar", view,
    interpret: async () => ({ ok: true, mode: "contested", catalogId: "blackmail", explanation: "", payload }),
    estimate: async (intent) => { estimated.push(intent); return estimateCharacterAction(state, intent); } });
  assert.equal(step.kind, "confirm", step.reason);
  assert.equal(estimated[0].means.secretId, secret.id);
  const html = renderToStaticMarkup(React.createElement(box.ConfirmationCard, { proposal: step.proposal, view, onConfirm: () => {}, onCancel: () => {} }));
  assert.match(html, /Hemlighet: Mord: Namar av Hadara/);
  const submitted = [];
  await box.executeProposal({ proposal: step.proposal, view, submit: async (type, body) => { submitted.push([type, body]); return { ok: true, state: { recentResolutions: [], schemes: [] }, events: [] }; },
    narrate: async () => assert.fail(), recordNarrative: async () => assert.fail(), present: (value) => value });
  assert.equal(submitted[0][1].means.secretId, secret.id);
});

// --- Court conversations ---

// The conversation view under the hook driver with the engine's real estimate behind it. `turns` lives in the test, as it does in the panel.
function mountTalk({ diplomacy, runtime = {}, model = {}, person = null, spymaster = false } = {}) {
  const { state, view } = engineCampaign(diplomacy, { spymaster });
  const speaker = person ?? view.conversationTargets.find((target) => target.id === "person-0-2");
  const driver = createHookDriver();
  const panel = loadPanel(view, { react: driver.react, model, runtime: conversationRuntime({
    getConversationViewForModel: async (id) => ({ ...view, conversationBrief: { personId: id } }),
    estimateConversationForView: async (request) => ({ ...estimateConversation(state, request), revision: state.revision }),
    ...runtime }) });
  const props = { person: speaker, view, turns: [], busy: false, onClose: () => {} };
  props.setTurns = (update) => { props.turns = typeof update === "function" ? update(props.turns) : update; };
  let tree;
  const draw = () => (tree = driver.render(React.createElement(panel.ConversationView, props)));
  props.runAction = async (work) => {
    props.busy = true; draw();
    try { return await work(); } finally { props.busy = false; }
  };
  draw();
  const act = async (action) => { await action(); await settle(); return draw(); };
  const say = (text) => act(async () => {
    findAll(tree, (node) => node.type === "textarea")[0].props.onChange({ target: { value: text } });
    draw();
    formOf(tree, "char-talk-form").props.onSubmit({ preventDefault() {} });
  });
  return { state, view, speaker, driver, props, draw, act, say, get tree() { return tree; } };
}
const supportRequest = (personId = "person-0-2") => ({ personId, kind: "support", offerSilver: 0, hookId: null, arguments: [], argumentScore: 0 });
const decided = (accepted, extra = {}) => ({ id: "conversation-9", personId: "person-0-2", kind: "support", date: "0200-01-01", value: 63, roll: accepted ? 12.5 : 80.5, accepted, effects: [], ...extra });
const answerWith = (entry) => async () => ({ ok: true, state: { conversations: [entry] }, events: [] });
const askSupport = () => ({ extractConversationRequest: async () => ({ ok: true, request: supportRequest() }) });
const requestCard = (tree) => findAll(tree, (node) => node.type === "section" && node.props["aria-label"] === "Bekräfta förfrågan")[0];

test("the conversation view asks Vad säger du? and shows bands for a low-diplomacy representative, numbers for a high one", async () => {
  for (const [diplomacy, exact] of [[3, false], [14, true]]) {
    const mounted = mountTalk({ diplomacy, model: askSupport(), spymaster: true });
    assert.match(textOf(mounted.tree), /Vad säger du\?/);
    assert.ok(buttonNamed(mounted.tree, "Säg det"));
    await mounted.say("Kan jag räkna med ditt stöd?");
    const card = requestCard(mounted.tree);
    assert.ok(card, "a request opens the confirmation card");
    const shown = textOf(card);
    const estimate = estimateConversation(mounted.state, supportRequest());
    assert.equal(estimate.precision === "exact", exact);
    assert.match(shown, /Ge sitt stöd/);
    assert.match(shown, /Sera Arel/);
    assert.match(shown, /Vad påverkar chansen\?/);
    assert.ok(buttonNamed(card, "Fråga") && buttonNamed(card, "Avbryt"));
    if (exact) {
      assert.match(shown, new RegExp(`Chans att få ja: ${estimate.display.chance} %`));
      assert.match(shown, /Grundchans: \+45/);
    } else {
      assert.match(shown, new RegExp(`Chans att få ja: ${estimate.display.chance}`));
      assert.doesNotMatch(shown, /\d\s?%/, "a band precision shows no percentage");
      assert.doesNotMatch(shown, new RegExp(`\\b${estimate.value}\\b`), "the true value does not reach the card");
      assert.doesNotMatch(shown, /Grundchans: \+\d/, "band rows carry a sign only");
    }
  }
});

test("a refusal by the dice shows the refusal and the character's reply, and the reply is told the outcome", async () => {
  const replies = [];
  const mounted = mountTalk({ diplomacy: 14,
    model: { ...askSupport(), replyAsCharacter: async (call) => { replies.push(call); return { ok: true, reply: "Nej, det kan jag inte lova." }; } },
    runtime: { submitConversationRequest: answerWith(decided(false)) } });
  await mounted.say("Kan jag räkna med ditt stöd?");
  await mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick());
  const shown = textOf(mounted.tree);
  assert.match(shown, /Sera Arel avvisar förfrågan\./);
  assert.match(shown, /Nej, det kan jag inte lova\./);
  assert.deepEqual(JSON.parse(JSON.stringify(replies[0].outcome)), { kind: "support", accepted: false });
  assert.doesNotMatch(shown, /63|12\.5|80\.5/, "neither the true chance nor the roll is shown");
  assert.equal(mounted.props.turns.filter((turn) => turn.from === "player").length, 1);
});

test("an accepted request submits the engine's request on the estimate's revision and the reply gets the accepted outcome", async () => {
  const submitted = [], replies = [];
  const mounted = mountTalk({ diplomacy: 14,
    model: { ...askSupport(), replyAsCharacter: async (call) => { replies.push(call); return { ok: true, reply: "Du har mitt stöd." }; } },
    runtime: { submitConversationRequest: async (request, options) => { submitted.push([request, options]); return answerWith(decided(true))(); } } });
  await mounted.say("Kan jag räkna med ditt stöd?");
  await mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick());
  assert.deepEqual(JSON.parse(JSON.stringify(submitted)), [[supportRequest(), { expectedRevision: mounted.state.revision }]]);
  assert.deepEqual(JSON.parse(JSON.stringify(replies[0].outcome)), { kind: "support", accepted: true });
  assert.match(textOf(mounted.tree), /Sera Arel ger sitt stöd\./);
  assert.match(textOf(mounted.tree), /Du har mitt stöd\./);
  assert.equal(replies[0].text, "Kan jag räkna med ditt stöd?");
  assert.deepEqual(replies[0].history, [], "the first turn has no earlier turns");
});

test("every model call is preceded by a fresh view with the speaker's brief", async () => {
  const order = [];
  const mounted = mountTalk({ diplomacy: 14,
    runtime: { getConversationViewForModel: async (id) => { order.push(`view:${id}`); return { ...engineCampaign().view, conversationBrief: { personId: id } }; }, submitConversationRequest: answerWith(decided(true)) },
    model: { extractConversationRequest: async (call) => { order.push(`extract:${call.view.conversationBrief.personId}`); return { ok: true, request: supportRequest() }; },
      replyAsCharacter: async (call) => { order.push(`reply:${call.view.conversationBrief.personId}`); return { ok: true, reply: "Ja." }; } } });
  await mounted.say("Stöd mig.");
  await mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick());
  assert.deepEqual(order, ["view:person-0-2", "extract:person-0-2", "view:person-0-2", "reply:person-0-2"]);
});

test("small talk is answered directly: no odds, no submit, an outcome of null", async () => {
  const replies = [];
  const mounted = mountTalk({
    model: { extractConversationRequest: async () => ({ ok: true, request: null }), replyAsCharacter: async (call) => { replies.push(call); return { ok: true, reply: "Vädret är milt." }; } },
    runtime: { estimateConversationForView: async () => assert.fail("no estimate without a request"), submitConversationRequest: async () => assert.fail("nothing to submit") } });
  await mounted.say("Hur står det till?");
  assert.equal(replies[0].outcome, null);
  assert.match(textOf(mounted.tree), /Hur står det till\?/);
  assert.match(textOf(mounted.tree), /Vädret är milt\./);
  assert.equal(requestCard(mounted.tree), undefined);
});

test("a failed reply keeps the outcome and says that the outcome stands", async () => {
  for (const reply of [async () => ({ ok: false, reason: "Personen kunde inte svara just nu. Försök igen." }), async () => { throw new Error("socket hang up"); }]) {
    const mounted = mountTalk({ diplomacy: 14, model: { ...askSupport(), replyAsCharacter: reply },
      runtime: { submitConversationRequest: answerWith(decided(true)) } });
    await mounted.say("Stöd mig.");
    await withWarnings(() => mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick()));
    const shown = textOf(mounted.tree);
    assert.match(shown, /Sera Arel ger sitt stöd\./, "the outcome stays");
    assert.match(shown, /Svaret kunde inte skrivas; utfallet gäller\./);
    assert.doesNotMatch(shown, /socket hang up/);
  }
});

test("an engine refusal shows its reason alone: no reply, no player turn, the text is kept", async () => {
  let replied = 0;
  const mounted = mountTalk({ diplomacy: 14,
    model: { ...askSupport(), replyAsCharacter: async () => { replied += 1; return { ok: true, reply: "?" }; } },
    runtime: { submitConversationRequest: async () => ({ ok: false, error: "Världen har ändrats. Läs det senaste läget och försök igen." }) } });
  await mounted.say("Stöd mig.");
  await mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick());
  assert.match(textOf(mounted.tree), /Världen har ändrats\. Läs det senaste läget och försök igen\./);
  assert.equal(replied, 0, "the person has decided nothing, so nobody answers as if they had");
  assert.deepEqual(mounted.props.turns, []);
  assert.equal(findAll(mounted.tree, (node) => node.type === "textarea")[0].props.value, "Stöd mig.");
  const internal = mountTalk({ diplomacy: 14, model: askSupport(), runtime: { submitConversationRequest: async () => ({ ok: false, error: "fetch failed" }) } });
  await internal.say("Stöd mig.");
  await withWarnings(() => internal.act(() => buttonNamed(internal.tree, "Fråga").props.onClick()));
  assert.match(textOf(internal.tree), /Förfrågan kunde inte sparas\. Försök igen om en stund\./);
  assert.doesNotMatch(textOf(internal.tree), /fetch failed/);
});

test("a refused estimate and a failed extraction show a Swedish reason and open no card", async () => {
  const refused = mountTalk({ diplomacy: 14, model: askSupport(),
    runtime: { estimateConversationForView: async () => ({ ok: false, reason: "Ni talade om detta nyss. Personen vill inte bli tillfrågad igen än." }) } });
  await refused.say("Stöd mig.");
  assert.match(textOf(refused.tree), /Ni talade om detta nyss\./);
  assert.equal(requestCard(refused.tree), undefined);
  const failed = mountTalk({ model: { extractConversationRequest: async () => ({ ok: false, reason: "Samtalet kunde inte tolkas. Försök formulera dig på nytt.", detail: "The answer was not a JSON object." }) } });
  const { warnings } = await withWarnings(() => failed.say("Stöd mig."));
  assert.match(textOf(failed.tree), /Samtalet kunde inte tolkas\./);
  assert.doesNotMatch(textOf(failed.tree), /JSON object/);
  assert.ok(warnings.some((line) => line.includes("JSON object")), "the technical detail goes to the log");
});

test("an accepted reveal with nothing to tell says so, and an offer shows what it cost", async () => {
  const request = { ...supportRequest(), kind: "reveal_secret", offerSilver: 12 }, replies = [];
  const mounted = mountTalk({ diplomacy: 14,
    model: { extractConversationRequest: async () => ({ ok: true, request }), replyAsCharacter: async (call) => { replies.push(call); return { ok: true, reply: "Jag har inget att säga." }; } },
    runtime: { submitConversationRequest: answerWith(decided(true, { kind: "reveal_secret", effects: [{ kind: "silver", amount: 12 }, { kind: "memory", memoryId: "memory-3" }, { kind: "secret", secretId: null }] })) } });
  await mounted.say("Berätta något åt mig, jag betalar.");
  assert.match(textOf(requestCard(mounted.tree)), /Erbjuden gåva: 12 silver/);
  await mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick());
  assert.match(textOf(mounted.tree), /Sera Arel hade inget att berätta\./);
  assert.match(textOf(mounted.tree), /12 silver betalades ur familjekassan\./);
  assert.deepEqual(JSON.parse(JSON.stringify(replies[0].outcome)), { kind: "reveal_secret", accepted: true, nothingToTell: true }, "the reply hears what the ledger says");
});

test("an accepted reveal that confides a secret gives the reply the plain outcome", async () => {
  const request = { ...supportRequest(), kind: "reveal_secret" }, replies = [];
  const mounted = mountTalk({ diplomacy: 14,
    model: { extractConversationRequest: async () => ({ ok: true, request }), replyAsCharacter: async (call) => { replies.push(call); return { ok: true, reply: "Lyssna noga." }; } },
    runtime: { submitConversationRequest: answerWith(decided(true, { kind: "reveal_secret", effects: [{ kind: "memory", memoryId: "memory-3" }, { kind: "secret", secretId: "secret-4" }] })) } });
  await mounted.say("Berätta något åt mig.");
  await mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick());
  assert.deepEqual(JSON.parse(JSON.stringify(replies[0].outcome)), { kind: "reveal_secret", accepted: true });
});

test("focus follows the conversation: the field on opening, the card on a request, the field again on Avbryt", async () => {
  const mounted = mountTalk({ diplomacy: 14, model: askSupport() });
  assert.equal(mounted.driver.focused.at(-1).type, "textarea", "opening the conversation puts the cursor in the field");
  await mounted.say("Stöd mig.");
  assert.deepEqual([mounted.driver.focused.at(-1).type, textOf(mounted.driver.focused.at(-1))], ["h4", "Ge sitt stöd"]);
  await mounted.act(() => buttonNamed(mounted.tree, "Avbryt").props.onClick());
  assert.equal(mounted.driver.focused.at(-1).type, "textarea");
  assert.equal(findAll(mounted.tree, (node) => node.type === "textarea")[0].props.value, "Stöd mig.", "the text stays for another try");
});

test("model text is rendered as text and the transcript is never stored", () => {
  const { ConversationView } = loadPanel(baseView());
  const html = renderToStaticMarkup(React.createElement(ConversationView, {
    person: { id: "person-0-2", name: "Sera Arel" }, view: baseView(), busy: false, onClose: () => {}, setTurns: () => {},
    turns: [{ from: "player", text: "Hej <b>du</b>" }, { from: "speaker", text: "<img src=x onerror=alert(1)>" }, { from: "note", text: "<script>x</script>" }] }));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img|<script|<b>/);
  for (const file of ["ConversationView.jsx", "IntrigueView.jsx", "CharactersPanel.jsx", "ActionBox.jsx", "CourtSections.jsx"]) {
    assert.doesNotMatch(readFileSync(new URL(`./${file}`, import.meta.url), "utf8"), /dangerouslySetInnerHTML/, file);
  }
  assert.doesNotMatch(readFileSync(new URL("./ConversationView.jsx", import.meta.url), "utf8"), /localStorage|sessionStorage|indexedDB/, "the transcript is session memory only");
});

test("a request answered by the real engine is read from the newest conversation entry", async () => {
  const { state, view } = engineCampaign(14);
  const replies = [];
  const real = (request, { expectedRevision }) => executeCharacterCommand(state, { id: "converse-ui-1", expectedRevision, type: "converse_request", payload: request, origin: "converse" });
  const mounted = mountTalk({ diplomacy: 14,
    model: { ...askSupport(), replyAsCharacter: async (call) => { replies.push(call); return { ok: true, reply: "Svar." }; } },
    runtime: { submitConversationRequest: async (request, options) => real(request, options) } });
  assert.equal(mounted.state.revision, state.revision);
  await mounted.say("Stöd mig.");
  await mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick());
  const entry = real(supportRequest(), { expectedRevision: view.revision }).state.conversations.at(-1);
  assert.equal(replies[0].outcome.accepted, entry.accepted, "the reply is told what the engine decided");
  assert.match(textOf(mounted.tree), entry.accepted ? /Sera Arel ger sitt stöd\./ : /Sera Arel avvisar förfrågan\./);
});

test("a date ending in f.Kr. closes its sentence with one period", () => {
  const { endSentence } = loadActionBox();
  assert.equal(endSentence("Planen avgörs 1/2 300 f.Kr."), "Planen avgörs 1/2 300 f.Kr.");
  assert.equal(endSentence("Planen avgörs -0300-04-01"), "Planen avgörs -0300-04-01.");
});

test("a year that fails shows a Swedish sentence, never the model call's English error", async () => {
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const driver = createHookDriver();
    const view = engineCampaign().view;
    const english = 'AI task "jumpForward" failed: Your events describe a legal territorial settlement but the payload contains ZERO impacts.regionTransfers.';
    const { default: Panel } = loadPanel(view, { react: driver.react, globals: {
      window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }, document: { activeElement: null } },
    runtime: { advanceCharacterYearWithModel: async () => ({ ok: false, error: english }) } });
    const draw = () => driver.render(React.createElement(Panel, { open: true, onClose: () => {} }));
    let tree = draw();
    await settle();
    tree = draw();
    await findAll(tree, (node) => node.props?.className === "char-button char-button--advance")[0].props.onClick();
    await settle();
    tree = draw();
    const banner = findAll(tree, (node) => node.props?.role === "alert").map(textOf).join(" ");
    assert.match(banner, /Modellen kunde inte skriva året\. Försök igen\./);
    assert.doesNotMatch(banner, /jumpForward|impacts\.regionTransfers/);
    assert.ok(warnings.some((line) => line.includes("jumpForward")), "the English text goes to the log");
  } finally { console.warn = realWarn; }
});

// --- Personer tab ---

function mountPeople({ selectedId, view = engineCampaign().view } = {}) {
  const driver = createHookDriver();
  const panel = loadPanel(view, { react: driver.react });
  const props = { view, selectedId, selectPerson: () => {}, busy: false, talks: {}, setTalk: () => () => {} };
  let tree;
  const draw = () => (tree = driver.render(React.createElement(panel.PeopleView, props)));
  draw();
  return { driver, props, draw, get tree() { return tree; } };
}
const talkButtons = (tree) => findAll(tree, (node) => node.type === "button" && textOf(node) === "Samtala");

// The real seeded court through the real presentation: what getCharacterPresentation
// hands the panel for a campaign started from the package.
function seededView(id) {
  const { data } = JSON.parse(readFileSync(new URL(`../../../server/seed/historical/${id}/scenario.json`, import.meta.url), "utf8"));
  return getCharacterPresentation(createHistoricalCharacterSystem({ historicalScenario: data.world.historicalScenario, date: data.game.startDate, polityId: data.game.country, seed: 321 }));
}
const survivalTags = (tree) => findAll(tree, (node) => node.type === "span" && textOf(node) === "Överlevnad osäker");
const families = (view) => {
  const { FamiliesView } = loadPanel(view, { panelState: false });
  return renderToStaticMarkup(React.createElement(FamiliesView, { view }));
};

test("the real Charlemagne court tags each person whose survival is uncertain, with the claim as the title", () => {
  const view = seededView("charlemagne-800");
  const uncertain = view.people.filter((person) => person.historicalOrigin?.claims?.survival?.status === "uncertain");
  assert.deepEqual(uncertain.map((person) => person.id), ["berta", "gisela", "teoderada", "hiltrud", "ruodhaid"]);
  for (const person of uncertain) {
    const tags = survivalTags(mountPeople({ selectedId: person.id, view }).tree);
    assert.equal(tags.length, 1, person.id);
    assert.equal(tags[0].props.title, person.historicalOrigin.claims.survival.noteSv);
  }
  for (const id of ["karl", "rotrud", "generated-courtier-1"]) assert.equal(survivalTags(mountPeople({ selectedId: id, view }).tree).length, 0, id);
});

const provenanceTags = (tree) => findAll(tree, (node) => node.type === "span" && /^(Födelsedatum osäkert|Genererat födelsedatum|Dokumenterad person.*|Genererad person)$/.test(textOf(node)));

test("the real Charlemagne court shows where a birth date comes from, and the origin of each person", () => {
  const view = seededView("charlemagne-800");
  const tagsOf = (id) => provenanceTags(mountPeople({ selectedId: id, view }).tree);
  const label = "Dokumenterad person; spelvärden är genererade";
  const person = (id) => view.people.find((candidate) => candidate.id === id);
  const karl = tagsOf("karl"), rotrud = tagsOf("rotrud");
  assert.deepEqual(karl.map(textOf), [label, "Födelsedatum osäkert"]);
  assert.equal(karl[1].props.title, person("karl").historicalOrigin.claims.bornAt.noteSv);
  assert.deepEqual(rotrud.map(textOf), [label, "Genererat födelsedatum"]);
  assert.equal(rotrud[1].props.title, person("rotrud").historicalOrigin.claims.bornAt.noteSv);
});

test("a sourced birth date shows no birth tag, and a claim without a note gets no title", () => {
  const view = seededView("charlemagne-800");
  const withBorn = (bornAt) => ({ ...view, people: view.people.map((person) => person.id === "rotrud" ? { ...person, historicalOrigin: { ...person.historicalOrigin, claims: { ...person.historicalOrigin.claims, bornAt } } } : person) });
  assert.deepEqual(provenanceTags(mountPeople({ selectedId: "rotrud", view: withBorn({ status: "sourced", noteSv: "Belagd.", sourceIds: ["a"] }) }).tree).map(textOf), ["Dokumenterad person; spelvärden är genererade"]);
  const [, birth] = provenanceTags(mountPeople({ selectedId: "rotrud", view: withBorn({ status: "uncertain", sourceIds: ["a"] }) }).tree);
  assert.equal(textOf(birth), "Födelsedatum osäkert");
  assert.equal(birth.props.title, undefined);
});

test("a court member whose name says generated gets no doubled label, and a non-historical court shows nothing new", () => {
  for (const id of SHIPPED_START_FOLDERS) {
    const view = seededView(id);
    const generated = view.people.filter((person) => / \(genererad\)$/.test(person.name));
    assert.ok(generated.length >= 3, id);
    for (const person of generated) assert.deepEqual(provenanceTags(mountPeople({ selectedId: person.id, view }).tree).map(textOf), [], person.id);
  }
  const hadara = engineCampaign().view;
  for (const person of hadara.people) assert.deepEqual(provenanceTags(mountPeople({ selectedId: person.id, view: hadara }).tree).map(textOf), [], person.id);
});

// Ämbeten & arv as plain text, so a line split by markup reads as one.
const officesText = (view) => {
  const { OfficesView } = loadPanel(view, { panelState: false });
  return renderToStaticMarkup(React.createElement(OfficesView, { view, setTab: () => {} })).replace(/<[^>]+>/g, "");
};
// Kyrkostaten's court from the Charlemagne package under the given succession law.
const papalView = (law, deadIds = []) => {
  const { data } = JSON.parse(readFileSync(new URL("../../../server/seed/historical/charlemagne-800/scenario.json", import.meta.url), "utf8"));
  const state = createHistoricalCharacterSystem({ historicalScenario: data.world.historicalScenario, date: data.game.startDate, polityId: "papal-states", seed: 321 });
  state.realm.successionLaw = law;
  if (deadIds.length) actionHooks(state).kill(deadIds, [], "Prov");
  return getCharacterPresentation(state);
};

test("Ämbeten & arv names the succession order, and a presentation without a realm shows no such line", () => {
  assert.match(officesText(papalView("elective")), /Tronföljd: val/);
  assert.match(officesText(papalView("merit")), /Tronföljd: förtjänst/);
  const legacy = papalView("merit");
  delete legacy.realm;
  assert.doesNotMatch(officesText(legacy), /Tronföljd:/);
});

test("the forecast announces the election from outside in place of an empty successor", () => {
  const text = officesText(papalView("elective", ["generated-courtier-1", "generated-courtier-2", "generated-courtier-3"]));
  assert.match(text, /Väntad faktisk efterträdareEn genererad person utanför hovet väljs\./);
  assert.doesNotMatch(text, /Ingen levande innehavare/);
  assert.match(text, /Valet faller på en genererad person utanför hovet\./);
});

test("an elective forecast lists the electors' votes", () => {
  const text = officesText(papalView("elective"));
  assert.match(text, /Elektorernas röster/);
  assert.match(text, /Sergius \(genererad\) · leder/);
  assert.match(text, /Med bättre underrättelser syns hur många röster var och en har\./);
  assert.doesNotMatch(officesText(papalView("merit")), /Elektorernas röster/);
});

test("a person who has died in the campaign loses the survival tag", () => {
  const view = seededView("charlemagne-800");
  const dead = { ...view, people: view.people.map((person) => person.id === "berta" ? { ...person, alive: false, diedAt: "0805-01-01" } : person) };
  assert.equal(survivalTags(mountPeople({ selectedId: "berta", view: dead }).tree).length, 0);
});

test("John, Egypt and a non-historical court show no survival tag", () => {
  for (const view of [seededView("john-1200"), seededView("egypt-3000bc"), engineCampaign().view]) {
    for (const person of view.people) assert.equal(survivalTags(mountPeople({ selectedId: person.id, view }).tree).length, 0, person.id);
  }
});

test("a historical religion names the representative at court and shows its sourced claim, with no added person", () => {
  const view = seededView("charlemagne-800");
  const html = families(view);
  assert.match(html, /Företrädare vid hovet <strong>Rikulf \(genererad\)<\/strong>/);
  assert.doesNotMatch(html, /Ledare/);
  assert.match(html, /Leo III, biskop av Rom sedan 795, krönte Karl/);
  assert.equal(view.people.some((person) => /Leo/.test(person.name)), false);
  const john = families(seededView("john-1200"));
  assert.match(john, /Företrädare vid hovet <strong>William \(genererad\)<\/strong>/);
  assert.match(john, /Kunglig kröning vid Westminster/);
  assert.match(families(seededView("egypt-3000bc")), /Företrädare vid hovet/);
});

test("a faith founded in the campaign shows its year, and a seeded faith shows none", () => {
  const view = seededView("charlemagne-800");
  assert.doesNotMatch(families(view), /Grundad/);
  const founded = { id: "faith-1", name: "Karls lära", support: 40, leaderId: null, foundedYear: 812 };
  assert.match(families({ ...view, religions: [...view.religions, founded] }), /<h4>Karls lära<\/h4>.*Grundad <strong>812<\/strong>/s);
});

test("a saved historical campaign without religion claims keeps the label and shows no claim", () => {
  const view = seededView("john-1200");
  const old = { ...view, religions: view.religions.map(({ historicalOrigin, ...religion }) => religion) };
  const html = families(old);
  assert.match(html, /Företrädare vid hovet/);
  assert.doesNotMatch(html, /Kunglig kröning vid Westminster/);
});

test("a non-historical game keeps the religion leader label and no claim line", () => {
  const { view } = engineCampaign();
  const html = families(view);
  assert.ok(view.religions.length);
  assert.match(html, /Ledare <strong>/);
  assert.doesNotMatch(html, /Företrädare vid hovet/);
  assert.equal(families({ ...view, religions: view.religions.map(({ historicalOrigin, ...religion }) => religion) }), html);
});

test("a person's skills carry Swedish labels, prowess included", () => {
  const text = textOf(mountPeople({ selectedId: "person-0-2" }).tree);
  assert.match(text, /Kampförmåga/);
  assert.doesNotMatch(text, /prowess/i);
});

test("only people in conversationTargets get a Samtala button, and it opens the conversation view", () => {
  const talkable = mountPeople({ selectedId: "person-0-2" });
  assert.equal(talkButtons(talkable.tree).length, 1);
  assert.equal(findAll(talkable.tree, (node) => node.type === "textarea" && node.props.id === "char-talk-text").length, 0);
  talkButtons(talkable.tree)[0].props.onClick();
  talkable.draw();
  assert.equal(findAll(talkable.tree, (node) => node.type === "textarea" && node.props.id === "char-talk-text").length, 1);
  assert.ok(buttonNamed(talkable.tree, "Säg det"));
  assert.equal(talkButtons(mountPeople({ selectedId: "person-0-0" }).tree).length, 0, "the representative does not talk to themselves");
  const none = { ...engineCampaign().view, conversationTargets: [] };
  assert.equal(talkButtons(mountPeople({ selectedId: "person-0-2", view: none }).tree).length, 0);
});

test("the footer rises when a conversation call is recorded through the real counter", () => {
  const driver = createHookDriver();
  const { default: Panel } = loadPanel(baseView(), { react: driver.react, counter: realCounter, globals: {
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }, document: { activeElement: null } } });
  const draw = () => driver.render(React.createElement(Panel, { open: true, onClose: () => {} }));
  const before = realCounter.getModelCallCounts();
  const footer = (tree) => textOf(findAll(tree, (node) => node.type === "footer")[0]);
  assert.match(footer(draw()), new RegExp(`Modellanrop denna session: ${before.total}(?!\\d)`));
  realCounter.recordModelCall("converse");
  const after = realCounter.getModelCallCounts();
  assert.equal(after.total, before.total + 1);
  assert.equal(after.byKind.converse, (before.byKind.converse || 0) + 1);
  assert.match(footer(draw()), new RegExp(`Modellanrop denna session: ${before.total + 1}(?!\\d)`));
});

// --- Fix round 1 ---

test("a hook over another person is not offered, and the list follows the chosen target", () => {
  const { state, view, hook } = campaignWithLeverage();
  const other = grantHook(state, { ownerId: view.representative.id, targetId: "person-2-0", strength: "weak" });
  const fresh = getCharacterPresentation(state);
  const proposals = [];
  const mounted = mountForm(entryOf(fresh, "poison"), fresh, { onPropose: (entry, payload) => proposals.push(payload) });
  const values = () => findAll(selectFor(mounted.tree, "Grepp"), (node) => node.type === "option").map((option) => option.props.value);
  const first = selectFor(mounted.tree, "Mål").props.value;
  assert.deepEqual(values(), [""].concat(first === "person-2-0" ? [other.id] : []), "only a hook over the chosen target (or Ingen)");
  selectFor(mounted.tree, "Mål").props.onChange({ target: { value: "person-1-0" } });
  mounted.draw();
  assert.deepEqual(values(), ["", hook.id]);
  assert.ok(!values().includes(other.id));
  selectFor(mounted.tree, "Grepp").props.onChange({ target: { value: hook.id } });
  mounted.draw();
  selectFor(mounted.tree, "Mål").props.onChange({ target: { value: "person-2-0" } });
  mounted.draw();
  assert.equal(selectFor(mounted.tree, "Grepp").props.value, "", "a chosen hook that no longer fits falls back to Ingen");
  submitForm(mounted);
  assert.equal(Object.hasOwn(proposals[0].means, "hookId"), false);
});

test("a reply failure in the request flow logs its detail", async () => {
  const mounted = mountTalk({ diplomacy: 14,
    model: { ...askSupport(), replyAsCharacter: async () => ({ ok: false, reason: "Personen kunde inte svara just nu. Försök igen.", detail: "The answer was not a JSON object." }) },
    runtime: { submitConversationRequest: answerWith(decided(true)) } });
  await mounted.say("Stöd mig.");
  const { warnings } = await withWarnings(() => mounted.act(() => buttonNamed(mounted.tree, "Fråga").props.onClick()));
  assert.ok(warnings.some((line) => line.includes("JSON object")));
  assert.match(textOf(mounted.tree), /Svaret kunde inte skrivas; utfallet gäller\./);
});

test("closing a conversation moves focus to that person's Samtala button", () => {
  const mounted = mountPeople({ selectedId: "person-0-2" });
  talkButtons(mounted.tree)[0].props.onClick();
  mounted.draw();
  const before = mounted.driver.focused.length;
  buttonNamed(mounted.tree, "Avsluta samtalet").props.onClick();
  mounted.draw();
  assert.ok(mounted.driver.focused.length > before);
  assert.equal(mounted.driver.focused.at(-1), talkButtons(mounted.tree)[0]);
});

test("an open confirmation card holds the clock: Nästa år med modellen is disabled until it is answered", async () => {
  const driver = createHookDriver();
  const { state, view } = engineCampaign(14);
  const { default: Panel } = loadPanel(view, { react: driver.react, globals: {
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }, document: { activeElement: null } },
  model: { extractConversationRequest: async () => ({ ok: true, request: supportRequest() }) },
  runtime: conversationRuntime({ getConversationViewForModel: async (id) => ({ ...view, conversationBrief: { personId: id } }),
    estimateConversationForView: async (request) => ({ ...estimateConversation(state, request), revision: state.revision }) }) });
  const draw = () => driver.render(React.createElement(Panel, { open: true, onClose: () => {} }));
  const advance = (tree) => findAll(tree, (node) => node.type === "button" && node.props.className === "char-button char-button--advance")[0];
  let tree = draw();
  await settle();
  tree = draw();
  buttonNamed(findAll(tree, (node) => node.type === "nav")[0], "Personer").props.onClick();
  tree = draw();
  findAll(tree, (node) => node.type === "button" && String(node.props.className).startsWith("char-person-row") && textOf(node).includes("Sera Arel"))[0].props.onClick();
  tree = draw();
  talkButtons(tree)[0].props.onClick();
  tree = draw();
  assert.equal(advance(tree).props.disabled, false);
  findAll(tree, (node) => node.type === "textarea" && node.props.id === "char-talk-text")[0].props.onChange({ target: { value: "Stöd mig." } });
  tree = draw();
  formOf(tree, "char-talk-form").props.onSubmit({ preventDefault() {} });
  await settle();
  tree = draw();
  tree = draw();
  assert.ok(requestCard(tree), "the card is open");
  assert.equal(advance(tree).props.disabled, true);
  buttonNamed(requestCard(tree), "Avbryt").props.onClick();
  tree = draw();
  tree = draw();
  assert.equal(advance(tree).props.disabled, false);
});

test("a double click on Frige or Ja, avrätta is ignored, not recorded as a refusal", async () => {
  let calls = 0;
  const mounted = mountIntrigue({ onCommand: async () => { calls += 1; return undefined; } });
  const refusals = (name) => findAll(prisonerItem(mounted.tree, name), (node) => node.props?.className === "char-reason").length;
  buttonNamed(prisonerItem(mounted.tree, "Nebet"), "Frige").props.onClick();
  await settle();
  mounted.draw();
  assert.equal(calls, 1);
  assert.equal(refusals("Nebet"), 0);
  buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Avrätta").props.onClick();
  mounted.draw();
  buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Ja, avrätta").props.onClick();
  await settle();
  mounted.draw();
  assert.equal(refusals("Kamos Ptah"), 0);
  assert.match(textOf(prisonerItem(mounted.tree, "Kamos Ptah")), /Vill du avrätta Kamos Ptah\?/, "the question stays for the click that is being handled");
});

test("a double click on Ja, avbryt intrigen is ignored, not recorded as a refusal", async () => {
  const driver = createHookDriver();
  const box = loadActionBox({ react: driver.react });
  const props = { schemes: [{ id: "scheme-4", actionLabel: "Undergräv", actorName: "Iset Arel", targetNames: ["Kamos Ptah"], dueAt: "-0299-04-01" }], onAbort: async () => undefined, busy: false };
  let tree = driver.render(React.createElement(box.SchemeList, props));
  buttonNamed(tree, "Avbryt intrigen").props.onClick();
  tree = driver.render(React.createElement(box.SchemeList, props));
  buttonNamed(tree, "Ja, avbryt intrigen").props.onClick();
  await settle();
  tree = driver.render(React.createElement(box.SchemeList, props));
  assert.equal(findAll(tree, (node) => node.props?.className === "char-reason").length, 0);
  assert.ok(buttonNamed(tree, "Ja, avbryt intrigen"), "the question is still there for the click being handled");
});

test("after a successful release, focus moves to the next prisoner's first button", async () => {
  const view = intrigueView();
  const mounted = mountIntrigue({ view });
  buttonNamed(prisonerItem(mounted.tree, "Kamos Ptah"), "Frige").props.onClick();
  await settle();
  mounted.props.view = { ...view, prisoners: view.prisoners.slice(1) };
  mounted.draw();
  assert.equal(mounted.driver.focused.at(-1), buttonNamed(prisonerItem(mounted.tree, "Nebet"), "Frige"));
});

// M1: the prisoner buttons follow the engine's release_prisoner and execute_prisoner entries.
test("Frige and Avrätta are disabled with the engine's reason shown before the prisoners", () => {
  const blocked = (reasons) => ({ ...intrigueView(), actions: intrigueView().actions.map((action) => ({ ...action, disabledReason: reasons[action.type] ?? "" })) });
  const mounted = mountIntrigue({ view: blocked({ release_prisoner: "Kräver härskarmandat.", execute_prisoner: "Kräver härskarmandat." }) });
  const section = findAll(mounted.tree, (node) => node.type === "section" && node.props["aria-label"] === "Fångar")[0];
  const reasons = findAll(section, (node) => node.type === "p" && node.props.className === "char-reason");
  assert.deepEqual(reasons.map(textOf), ["Kräver härskarmandat."], "one reason, shown once before the list");
  for (const name of ["Kamos Ptah", "Nebet"]) {
    for (const label of ["Frige", "Avrätta"]) {
      const button = buttonNamed(prisonerItem(mounted.tree, name), label);
      assert.equal(button.props.disabled, true, `${label} for ${name}`);
      assert.equal(button.props["aria-describedby"], reasons[0].props.id);
    }
  }
  const executeOnly = mountIntrigue({ view: blocked({ execute_prisoner: "Regenten har inte samtyckt till avrättningar." }) });
  assert.equal(buttonNamed(prisonerItem(executeOnly.tree, "Nebet"), "Frige").props.disabled, false);
  assert.equal(buttonNamed(prisonerItem(executeOnly.tree, "Nebet"), "Avrätta").props.disabled, true);
  assert.match(textOf(findAll(executeOnly.tree, (node) => node.type === "section" && node.props["aria-label"] === "Fångar")[0]), /Avrätta: Regenten har inte samtyckt till avrättningar\./);
  const none = mountIntrigue({ view: { ...intrigueView(), actions: [] } });
  assert.equal(buttonNamed(prisonerItem(none.tree, "Nebet"), "Frige").props.disabled, true, "no entry means no decision can be made");
});

// After a decided request the person leaves conversationTargets, so no Samtala button comes back; focus goes to the person's heading.
test("closing a conversation with someone who can no longer be asked moves focus to the person's heading", () => {
  const mounted = mountPeople({ selectedId: "person-0-2" });
  talkButtons(mounted.tree)[0].props.onClick();
  mounted.draw();
  mounted.props.view = { ...mounted.props.view, conversationTargets: (mounted.props.view.conversationTargets || []).filter((target) => target.id !== "person-0-2") };
  mounted.draw();
  buttonNamed(mounted.tree, "Avsluta samtalet").props.onClick();
  mounted.draw();
  assert.equal(talkButtons(mounted.tree).length, 0, "no Samtala button comes back");
  const heading = mounted.driver.focused.at(-1);
  assert.equal(heading?.type, "h3");
  assert.equal(heading.props.tabIndex, -1);
  assert.equal(textOf(heading), "Sera Arel");
});

// --- Phase 3: the reign, the council, demands and factions ---

const courtView = () => ({
  ...baseView(),
  court: {
    reign: { rulerId: "ruler", rulerName: "Astrid", startedAt: "0200-01-01", goals: [
      { id: "goal-1", type: "fill_treasury", label: "Fyll statskassan", description: "Statskassan ska rymma minst 300 silver.", dueAt: "0205-01-01", status: "active", statusLabel: "Pågår" },
      { id: "goal-2", type: "strong_army", label: "Stärk hären", description: "Arméns styrka ska nå minst 70.", dueAt: "0204-06-01", status: "met", statusLabel: "Uppnått" },
    ] },
    legitimacy: { value: 58, sources: [{ label: "Tronföljd", value: 62 }, { label: "Styre och händelser", value: -4 }] },
    prestige: 37,
    council: {
      seats: [
        { officeId: "chancellor", name: "Kansler", holderId: "head", holderName: "Cecilia", serviceLabel: "stark" },
        { officeId: "general", name: "Överbefälhavare", holderId: null, holderName: "Vakant", serviceLabel: null },
      ],
      ambitions: [{ personId: "guardian", name: "Dag", ambitionLabel: "En stad" }],
    },
    dread: { value: 22, label: "Adeln är på sin vakt" },
    demands: [
      { id: "demand-1", familyName: "Ptah", kindLabel: "Stad", targetName: "Kition", statusLabel: "Obesvarat", dueAt: "0201-01-01" },
      { id: "demand-2", familyName: "Eshmun", kindLabel: "Ämbete", targetName: "Kansler", statusLabel: "Avvisat", dueAt: "0199-01-01" },
    ],
    factions: [
      { id: "faction-1", stageLabel: "I det fördolda", knownMembers: [{ id: "head", name: "Cecilia" }], claimantName: null, strengthLabel: "låg", memberCount: null, dueAt: null },
      { id: "faction-2", stageLabel: "Ultimatum", knownMembers: [{ id: "head", name: "Cecilia" }, { id: "guardian", name: "Dag" }], claimantName: "Bertil", strengthLabel: "50 %", memberCount: 4, dueAt: "0201-03-01" },
    ],
  },
});
const emptyCourt = () => {
  const view = courtView();
  view.court = { ...view.court, reign: { ...view.court.reign, goals: [] }, legitimacy: { value: 0, sources: [] }, council: { seats: view.court.council.seats, ambitions: [] }, demands: [], factions: [] };
  return view;
};
const onTab = (view, tab, options = {}) => renderToStaticMarkup(loadPanel(view, { tab, ...options }).default({ open: true, onClose: () => {} }));
const sectionOf = (html, name) => { const from = html.slice(html.indexOf(`aria-label="${name}"`)); return from.slice(0, from.indexOf("</section>")); };

test("the leader card shows dread, prestige, the sources of legitimacy and the reign's goals", () => {
  const html = council(courtView());
  assert.match(html, /role="meter" aria-label="Fruktan"[^>]*aria-valuenow="22"/);
  assert.match(html, /Adeln är på sin vakt/);
  assert.match(html, /Ryktbarhet<\/span><strong>37</);
  assert.match(html, /<summary>Vad bär legitimiteten\?<\/summary>/);
  assert.match(html, /Tronföljd: \+62/);
  assert.match(html, /Styre och händelser: −4/);
  assert.match(html, /<h4>Regeringsmål<\/h4>/);
  for (const text of ["Fyll statskassan", "Statskassan ska rymma minst 300 silver.", "0205-01-01", "Pågår", "Stärk hären", "0204-06-01", "Uppnått"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Inga mål är utlysta\./);
  assert.ok(html.indexOf("Fruktan") > html.indexOf("char-leader-card"), "the reign sits in the leader card");
  assert.ok(html.indexOf("Fruktan") < html.indexOf("Rikets tillstånd"), "the reign sits in the leader card");
});

test("the way to a nickname lists the three closest rows in table order and names the coming name", () => {
  const row = (id, label, order, counts, share, earned = false) => ({ id, label, order, counts, share, earned });
  const count = (label, value, threshold, binary = false) => ({ label, value, threshold, binary });
  const nicknamePath = { rulerName: "Astrid", adult: true, monthsLeft: 0, winnerId: "cruel", rows: [
    row("cruel", "den Grymma", 1, [count("avrättningar", 2, 2), count("grymma gärningar", 0, 4)], 1, true),
    row("great", "den Stora", 2, [count("uppnådda regeringsmål", 0, 2), count("ryktbarhet", 10, 40)], 0.25),
    row("treacherous", "den Lömska", 3, [count("svek", 0, 4)], 0),
    row("generous", "den Givmilda", 4, [count("generösa gärningar", 2, 3)], 2 / 3),
    row("usurper", "Tronrövaren", 6, [count("olaglig tronbestigning", 0, 1, true)], 0),
    row("quiet", "den Stillsamma", 7, [count("månader på tronen", 30, 48)], 30 / 48),
  ] };
  const html = council({ ...courtView(), nicknamePath });
  assert.match(html, /<h4>Vägen till ett tillnamn<\/h4>/);
  assert.match(html, /<li class="is-earned"><strong>den Grymma<\/strong><span>avrättningar 2 av 2 eller grymma gärningar 0 av 4<\/span><\/li>/);
  assert.ok(html.indexOf("den Grymma") < html.indexOf("den Givmilda") && html.indexOf("den Givmilda") < html.indexOf("den Stillsamma"), "table order");
  assert.doesNotMatch(html, /den Stora|den Lömska|Tronrövaren/);
  assert.match(html, /Vid nästa årsskifte kallas Astrid den Grymma\. Uppfylls flera vinner det som står först\./);
  const young = council({ ...courtView(), nicknamePath: { ...nicknamePath, monthsLeft: 14, winnerId: null } });
  assert.match(young, /14 månader återstår\./);
  const child = council({ ...courtView(), nicknamePath: { ...nicknamePath, adult: false } });
  assert.match(child, /Ett barn på tronen får inget tillnamn förrän i vuxen ålder\./);
  assert.doesNotMatch(council(courtView()), /Vägen till ett tillnamn/);
});

test("the reign card names what changed with the new ruler during the first year", () => {
  const handover = { rulerName: "Sera", predecessorName: "Arel", monthsLeft: 12,
    archetype: { from: { name: "Fältherren", ability: "Samordnad mobilisering" }, to: { name: "Diplomaten", ability: "Försoningsråd" } },
    traitsGone: ["Plikttrogen", "Ambitiös"], traitsNew: ["Medkännande"], skills: [{ label: "Diplomati", from: 4, to: 8 }] };
  const html = council({ ...courtView(), handover });
  assert.match(html, /<h4>Ett nytt styre<\/h4><p>Sera efterträder Arel\.<\/p>/);
  assert.match(html, /<li>Förmågan Samordnad mobilisering \(Fältherren\) ersätts av Försoningsråd \(Diplomaten\)\.<\/li>/);
  assert.match(html, /<li>Drag som försvinner: Plikttrogen, Ambitiös\.<\/li><li>Nya drag: Medkännande\.<\/li><li>Diplomati: 4 → 8<\/li>/);
  assert.match(html, /Den förra regeringens mål gäller inte längre\. Rutan visas i 12 månader till\./);
  assert.ok(html.indexOf("Ett nytt styre") < html.indexOf("Regeringsmål"), "above the goals");
  const plain = council({ ...courtView(), handover: { ...handover, archetype: null, traitsGone: [], traitsNew: [] } });
  assert.doesNotMatch(plain, /Förmågan|Drag som försvinner|Nya drag/);
  assert.match(council({ ...courtView(), handover: { ...handover, monthsLeft: 1 } }), /Rutan visas i 1 månad till\./);
  assert.doesNotMatch(council(courtView()), /Ett nytt styre/);
});

// The sections fed by the real presenters, so a renamed field leaves these tests red. The goal, demand and faction are the
// saved records the engine writes; `known` sets how many of the faction's members the player has found.
function courtCampaign({ spymaster = true, known = 1 } = {}) {
  const { state } = engineCampaign(undefined, { spymaster });
  const [, otherFamily] = Object.values(state.families);
  const memberIds = Object.values(state.people).filter((person) => person.familyId === otherFamily.id && !person.diedAt).map((person) => person.id).sort().slice(0, 3);
  const dueAt = realDates.addGameMonths(state.date, 60);
  state.reign.goals.push({ id: "goal-1", type: "fill_treasury", baseline: 0, setAt: state.date, dueAt, status: "active", closedAt: null });
  state.familyDemands.push({ id: "demand-1", familyId: otherFamily.id, kind: "office", targetId: "chancellor", status: "open", openedAt: state.date, dueAt, storyId: null, closedAt: null });
  state.factions.push({ id: "faction-1", targetRulerId: state.reign.rulerId, leaderId: memberIds[0], claimantId: memberIds[1], memberIds, knownMemberIds: memberIds.slice(0, known), formedAt: state.date, status: "active", outcome: null, quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null });
  return { state, view: getCharacterPresentation(state), otherFamily, memberIds };
}

test("the reign and Rådet render from the real court", () => {
  const { view } = courtCampaign();
  const leader = council(view);
  assert.match(leader, /role="meter" aria-label="Fruktan"/);
  assert.match(leader, /Ingen fruktar kronan/);
  assert.match(leader, /Ryktbarhet<\/span><strong>\d/);
  assert.match(leader, /Vad bär legitimiteten\?/);
  assert.match(leader, /Tronföljd: \+\d/);
  assert.match(leader, /Fyll statskassan/);
  assert.match(leader, /Statskassan ska rymma minst 300 silver/);
  assert.match(leader, /Pågår/);
  const seats = sectionOf(onTab(view, "offices"), "Rådet");
  assert.deepEqual(view.court.council.seats.map((seat) => seat.officeId), ["chancellor", "general", "spymaster"]);
  for (const name of ["Kansler", "Spionmästare"]) assert.ok(seats.includes(name), name);
  assert.match(seats, /Tjänst: [^<]+</);
  assert.ok(seats.includes(view.people.find((person) => person.id === "person-1-3").name), "the spymaster's name");
});

test("a goal's due date reads as a date through the real gameDates module", () => {
  const { view } = courtCampaign();
  assert.equal(view.court.reign.goals[0].dueAt, "-0295-01-01");
  assert.match(council(view, { dates: realDates }), /1\/1 295 f\.Kr\. · Pågår/);
});

test("Krav and Faktioner render from the real presenters", () => {
  const { view, otherFamily, memberIds } = courtCampaign();
  const demands = sectionOf(onTab(view, "families"), "Krav från familjerna");
  assert.ok(demands.includes(otherFamily.name), otherFamily.name);
  assert.match(demands, /Ämbete: Kansler/);
  assert.match(demands, /Obesvarat/);
  const name = (id) => view.people.find((person) => person.id === id).name;
  const faction = sectionOf(onTab(view, "intrigue"), "Faktioner");
  assert.match(faction, /I det fördolda/);
  assert.ok(faction.includes(`Känd krets: ${name(memberIds[0])}<`), "one known member");
  assert.match(faction, /Pretendent: okänd/);
  assert.match(faction, /Styrka: \d+ %</);
  assert.match(faction, /Medlemmar: 3/);
});

test("in the real presenters a second known member names the claimant, and no spymaster hides the count", () => {
  const named = courtCampaign({ known: 2 });
  const name = named.view.people.find((person) => person.id === named.memberIds[1]).name;
  assert.ok(sectionOf(onTab(named.view, "intrigue"), "Faktioner").includes(`Pretendent: ${name}`));
  const blind = sectionOf(onTab(courtCampaign({ spymaster: false }).view, "intrigue"), "Faktioner");
  assert.match(blind, /Styrka: [a-zåäö ]+</, "a band, no number");
  assert.doesNotMatch(blind, /Medlemmar/);
});

test("the dread meter carries its label as the accessible value", () => {
  assert.match(council(courtView()), /aria-label="Fruktan"[^>]*aria-valuetext="Adeln är på sin vakt"/);
  assert.doesNotMatch(council(courtView()), /aria-label="Legitimitet"[^>]*aria-valuetext/);
});

test("a reign with no goals says so, and no sources leave out the question", () => {
  const html = council(emptyCourt());
  assert.match(html, /Inga mål är utlysta\./);
  assert.doesNotMatch(html, /Vad bär legitimiteten/);
  assert.match(html, /aria-label="Fruktan"/);
});

test("a view with no court shows no reign and no council", () => {
  assert.doesNotMatch(council(baseView()), /Fruktan|Regeringsmål/);
  assert.doesNotMatch(onTab(baseView(), "offices"), /aria-label="Rådet"/);
});

test("the nickname follows the name in both sexes, and a person without one keeps the plain name", () => {
  const titled = (nickname) => {
    const view = baseView();
    delete view.authority;
    view.representative = { ...royalRegent, name: "Arel av Hadara", nickname };
    return council(view);
  };
  assert.match(titled("den Stora"), /<h3>Arel av Hadara den Stora<\/h3>/);
  assert.match(titled("den Store"), /<h3>Arel av Hadara den Store<\/h3>/);
  assert.match(titled(null), /<h3>Arel av Hadara<\/h3>/);
});

test("the engine's nickname reaches the summary in the form of the person's sex", () => {
  const { state } = engineCampaign();
  const living = Object.values(state.people).filter((person) => !person.diedAt);
  const woman = living.find((person) => person.sex === "female"), man = living.find((person) => person.sex === "male");
  state.nicknames.push({ personId: woman.id, nicknameId: "great", earnedAt: state.date }, { personId: man.id, nicknameId: "great", earnedAt: state.date });
  const view = getCharacterPresentation(state);
  const heading = (id) => textOf(findAll(mountPeople({ selectedId: id, view }).tree, (node) => node.type === "h3" && node.props.tabIndex === -1)[0]);
  assert.equal(heading(woman.id), `${woman.name} den Stora`);
  assert.equal(heading(man.id), `${man.name} den Store`);
});

test("service loyalty is a fact row with the reading, never a meter or a number", () => {
  const { view } = engineCampaign();
  const person = view.people.find((candidate) => candidate.id === "person-0-2");
  person.loyaltyReading = { label: "stark", precision: "five" };
  const { tree } = mountPeople({ selectedId: person.id, view });
  const facts = findAll(tree, (node) => node.type === "dl")[0];
  const row = findAll(facts, (node) => node.type === "div" && textOf(node).startsWith("Tjänstelojalitet"))[0];
  assert.equal(textOf(row), "Tjänstelojalitetstark");
  assert.equal(findAll(tree, (node) => node.props?.["aria-label"] === "Tjänstelojalitet").length, 0, "no meter is left");
});

test("the representative reads no loyalty of herself, in the real view as well", () => {
  const { view } = engineCampaign();
  assert.equal(view.representative.loyaltyReading, null);
  assert.doesNotMatch(textOf(mountPeople({ selectedId: view.representative.id, view }).tree), /Tjänstelojalitet/);
  const other = view.people.find((person) => person.loyaltyReading);
  assert.match(textOf(mountPeople({ selectedId: other.id, view }).tree), new RegExp(`Tjänstelojalitet${other.loyaltyReading.label}`));
});

test("Rådet lists each seat with its holder and service, or Vakant, and the spymaster's guesses", () => {
  const html = sectionOf(onTab(courtView(), "offices"), "Rådet");
  assert.match(html, /<h3>Rådet<\/h3>/);
  assert.match(html, /Kansler/);
  assert.match(html, /Cecilia/);
  assert.match(html, /Tjänst: stark/);
  assert.match(html, /Överbefälhavare/);
  assert.match(html, /Vakant/);
  assert.equal((html.match(/Tjänst:/g) || []).length, 1, "a vacant seat shows no service");
  assert.match(html, /<summary>Vad spionmästaren tror att de vill<\/summary>/);
  assert.match(html, /Dag: En stad/);
});

test("without ambitions Rådet leaves the spymaster's guesses out", () => {
  const html = sectionOf(onTab(emptyCourt(), "offices"), "Rådet");
  assert.match(html, /Kansler/);
  assert.doesNotMatch(html, /Vad spionmästaren tror/);
});

test("Krav från familjerna lists family, kind, target, status and date, or says the table is empty", () => {
  const html = sectionOf(onTab(courtView(), "families"), "Krav från familjerna");
  assert.match(html, /<h3>Krav från familjerna<\/h3>/);
  for (const text of ["Ptah", "Stad: Kition", "Obesvarat", "0201-01-01", "Eshmun", "Ämbete: Kansler", "Avvisat", "0199-01-01"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Inga krav ligger på bordet\./);
  assert.match(sectionOf(onTab(emptyCourt(), "families"), "Krav från familjerna"), /Inga krav ligger på bordet\./);
});

test("Faktioner comes before Rykten and shows what is known, okänd for a hidden claimant and no count below exact", () => {
  const whole = onTab(courtView(), "intrigue");
  assert.ok(whole.indexOf('aria-label="Faktioner"') > 0 && whole.indexOf('aria-label="Faktioner"') < whole.indexOf('aria-label="Rykten"'));
  const html = sectionOf(whole, "Faktioner");
  const [hidden, shown] = html.split("<li").slice(1);
  assert.match(hidden, /I det fördolda/);
  assert.match(hidden, /Känd krets: Cecilia</);
  assert.match(hidden, /Pretendent: okänd/);
  assert.match(hidden, /Styrka: låg/);
  assert.doesNotMatch(hidden, /Medlemmar/);
  assert.match(shown, /Ultimatum/);
  assert.match(shown, /Känd krets: Cecilia, Dag</);
  assert.match(shown, /Pretendent: Bertil/);
  assert.match(shown, /Medlemmar: 4/);
  assert.doesNotMatch(html, /Du känner inte till någon faktion/);
});

test("an empty faction list says only that the player knows of none", () => {
  const html = sectionOf(onTab(emptyCourt(), "intrigue"), "Faktioner");
  assert.deepEqual(html.replace(/^[^>]*>/, "").replace(/<[^>]+>/g, "\n").split("\n").filter(Boolean), ["Faktioner", "Du känner inte till någon faktion."]);
});

const ultimatumStory = (crush = {}) => ({
  id: "story-9", type: "faction_ultimatum", title: "Adeln ställer krav", description: "Faktionen har trätt fram.", createdAt: "0200-01-01", dueAt: "0201-01-01", status: "open",
  choices: [
    { id: "concede", label: "Ge efter för adeln", description: "Adeln väntar.", cost: "40 silver", stress: "4", disabledReason: "" },
    { id: "crush", label: "Slå ned faktionen", description: "Chans att lyckas: hög", cost: "1 handling", stress: "8", disabledReason: "",
      odds: { chance: "hög", modifiers: [{ label: "Härens beredskap", sign: "+" }, { label: "Faktionens styrka", sign: "−" }] }, ...crush },
  ],
});
const storyHtml = (story) => renderToStaticMarkup(React.createElement(loadPanel(baseView(), { panelState: false }).StoryCard, { story, onCommand: () => {}, busy: false }));
const oddsBlock = (html) => { const from = html.slice(html.indexOf('class="char-choice-odds"')); return from.slice(0, from.indexOf("</details>")); };
const choiceButtons = (html) => [...html.matchAll(/<button[\s\S]*?<\/button>/g)].map((match) => match[0]);

test("a band shows the crush's label and signs, with no number", () => {
  const block = oddsBlock(storyHtml(ultimatumStory()));
  assert.match(block, /Chans att lyckas: hög/);
  assert.match(block, /<summary>Vad påverkar chansen\?<\/summary>/);
  assert.match(block, /Härens beredskap: \+</);
  assert.match(block, /Faktionens styrka: −</);
  assert.doesNotMatch(block, /\d/);
});

test("exact odds show numbers on the chance and on every row", () => {
  const block = oddsBlock(storyHtml(ultimatumStory({ odds: { chance: 62, modifiers: [{ label: "Grundchans", value: 40 }, { label: "Faktionens styrka", value: -6 }] } })));
  assert.match(block, /Chans att lyckas: 62 %/);
  assert.match(block, /Grundchans: \+40/);
  assert.match(block, /Faktionens styrka: −6/);
});

test("the odds sit under the choice, outside its button, and only under a choice that has odds", () => {
  const html = storyHtml(ultimatumStory());
  const buttons = choiceButtons(html);
  assert.equal(buttons.length, 2);
  for (const button of buttons) assert.doesNotMatch(button, /<details|Vad påverkar chansen/);
  assert.equal((html.match(/char-choice-odds/g) || []).length, 1);
});

test("the odds block is grouped under the name of its own button, and a choice without odds gets no group", () => {
  const html = storyHtml(ultimatumStory());
  assert.match(html, /<div class="char-choice-slot" role="group" aria-labelledby="char-choice-story-9-crush"><button type="button" id="char-choice-story-9-crush"/);
  assert.equal((html.match(/role="group"/g) || []).length, 1);
});

test("a choice with odds shows its chance once, and a choice without odds keeps its description", () => {
  const html = storyHtml(ultimatumStory());
  assert.equal((html.match(/Chans att lyckas/g) || []).length, 1);
  assert.ok(html.indexOf("Chans att lyckas") > html.indexOf('class="char-choice-odds"'), "the one line is the odds block's");
  const [concede, crush] = choiceButtons(html);
  assert.match(concede, /Adeln väntar\./);
  assert.match(crush, /Slå ned faktionen/);
  assert.doesNotMatch(crush, /Chans att lyckas/);
});

test("a choice with a disabledReason stays disabled and still explains its chance", () => {
  const html = storyHtml(ultimatumStory({ disabledReason: "Ingen kan besluta just nu." }));
  const crush = choiceButtons(html).find((button) => button.includes("Slå ned faktionen"));
  assert.match(crush, /^<button[^>]*disabled=""/);
  assert.match(crush, /Ingen kan besluta just nu\./);
  assert.match(oddsBlock(html), /Vad påverkar chansen/);
});

test("set_reign_goal and reward_councillor reach the player through the menu's Förvaltning och hushåll", () => {
  const state = createCharacterSystem({ mode: "realm", seed: 41 });
  const types = getAvailableCharacterActions(state).map((action) => action.type);
  assert.ok(types.includes("set_reign_goal") && types.includes("reward_councillor"));
  const view = getCharacterPresentation(state);
  const html = renderToStaticMarkup(React.createElement(loadActionBox().ActionMenu, { view, CommandCard: loadPanel(view).ActionCard, onPropose: () => {} }));
  const start = html.indexOf(">Förvaltning och hushåll<");
  assert.ok(start > 0);
  const group = html.slice(start, html.indexOf('class="char-action-group"', start));
  for (const id of ["set_reign_goal", "reward_councillor"]) assert.ok(group.includes(`data-catalog-id="${id}"`), id);
});

test("the real-history segment shows for a historical campaign and opens the record; a Hadara campaign has none", () => {
  const { ChronicleView } = loadPanel(baseView());
  const render = (props) => renderToStaticMarkup(React.createElement(ChronicleView, { view: baseView(), filter: "memories", setFilter: () => {}, ...props }));
  assert.match(render({ historical: true }), /I verklighetens historia/);
  assert.doesNotMatch(render({ historical: false }), /I verklighetens historia/);
  assert.doesNotMatch(render({ historical: true }), /HISTORISK POST/);
  const open = render({ historical: true, filter: "history" });
  assert.match(open, /HISTORISK POST/);
  assert.match(open, /aria-pressed="true">I verklighetens historia/);
  assert.doesNotMatch(render({ historical: false, filter: "history" }), /HISTORISK POST/);
});

// --- Envoys ---

const CHARLEMAGNE = JSON.parse(readFileSync(new URL("../../../server/seed/historical/charlemagne-800/scenario.json", import.meta.url), "utf8")).data;
const CORDOBA = "emirate-of-cordoba";
const reconcileRequest = { realmId: CORDOBA, kind: "reconcile", offerSilver: 20, arguments: [{ kind: "offer", refId: null }], argumentScore: 6 };

// The envoy view under the hook driver, with the engine's real estimate and brief for Charlemagne's court; Córdoba remembers a betrayal.
function mountEnvoy({ runtime = {}, model = {} } = {}) {
  const state = createHistoricalCharacterSystem({ historicalScenario: JSON.parse(JSON.stringify(CHARLEMAGNE.world.historicalScenario)), date: CHARLEMAGNE.game.startDate, polityId: "carolingian-realm", mode: "realm", seed: 777 });
  state.foreignRealms.find((realm) => realm.id === CORDOBA).memories.push({ date: "0780-06-01", label: "Svek i kriget", amount: -40, until: "0810-06-01" });
  const view = getCharacterPresentation(state);
  const realm = view.foreignRealms.find((entry) => entry.id === CORDOBA);
  const driver = createHookDriver();
  const panel = loadPanel(view, { react: driver.react, model, runtime: conversationRuntime({
    getEnvoyViewForModel: async (id) => ({ ...view, envoyBrief: getEnvoyBrief(state, id) }),
    estimateEnvoyForView: async (request) => ({ ...estimateEnvoyRequest(state, request), revision: state.revision }),
    ...runtime }) });
  const props = { realm, busy: false, onClose: () => {} };
  let tree;
  const draw = () => (tree = driver.render(React.createElement(panel.EnvoyView, props)));
  props.runAction = async (work) => {
    props.busy = true; draw();
    try { return await work(); } finally { props.busy = false; }
  };
  draw();
  const act = async (action) => { await action(); await settle(); return draw(); };
  const say = (text) => act(async () => {
    findAll(tree, (node) => node.type === "textarea")[0].props.onChange({ target: { value: text } });
    draw();
    formOf(tree, "char-talk-form").props.onSubmit({ preventDefault() {} });
  });
  return { state, realm, act, say, draw, get tree() { return tree; } };
}
// The engine itself behind the submit, so the view reads the record from the state shape the command really returns.
const engineEnvoy = (mounted, roll) => async (request, { expectedRevision }) => {
  mounted.state.plotRngState = roll;
  return executeCharacterCommand(mounted.state, { id: `envoy-${roll}`, type: "envoy_request", payload: request, expectedRevision, origin: "converse" });
};
const envoyDecided = (state, accepted) => async () => ({ ok: true, state: { date: state.date, foreignRealms: [{ id: CORDOBA, lastEnvoy: { date: state.date, kind: "reconcile", value: 40, accepted } }] }, events: [] });
const envoyCard = (tree) => findAll(tree, (node) => node.type === "section" && node.props["aria-label"] === "Bekräfta sändebudet")[0];

test("an envoy's card shows what the ruler remembers, and the ruler answers an outcome already fixed", async () => {
  const submitted = [], replies = [];
  let mounted;
  mounted = mountEnvoy({
    model: { extractEnvoyRequest: async () => ({ ok: true, request: reconcileRequest }), replyAsRuler: async (call) => { replies.push(call); return { ok: true, reply: "Låt det gamla vara glömt." }; } },
    runtime: { submitEnvoyRequest: async (request, options) => { submitted.push([request, options]); return envoyDecided(mounted.state, true)(); } } });
  assert.match(textOf(mounted.tree), /Vad ska sändebudet säga\?/);
  await mounted.say("Låt oss lägga det gamla bakom oss. Jag sänder 20 silver.");
  const shown = textOf(envoyCard(mounted.tree));
  assert.match(shown, /Be om försoning/);
  assert.match(shown, /Svek i kriget \(780\)/);
  assert.match(shown, /20 silver ur statskassan, betalas bara vid ja/);
  assert.match(shown, /kostar en order/);
  await mounted.act(() => buttonNamed(mounted.tree, "Skicka").props.onClick());
  assert.deepEqual(JSON.parse(JSON.stringify(submitted)), [[reconcileRequest, { expectedRevision: mounted.state.revision }]]);
  assert.deepEqual(JSON.parse(JSON.stringify(replies[0].outcome)), { kind: "reconcile", accepted: true });
  const after = textOf(mounted.tree);
  assert.match(after, new RegExp(`${mounted.realm.rulerName} går med på försoning\\.`));
  assert.match(after, /20 silver betalades ur statskassan\./);
  assert.match(after, /Låt det gamla vara glömt\./);
});

test("a refused envoy pays nothing, and a message that asks for nothing is answered without a roll", async () => {
  let mounted;
  mounted = mountEnvoy({
    model: { extractEnvoyRequest: async () => ({ ok: true, request: reconcileRequest }), replyAsRuler: async () => ({ ok: true, reply: "Nej." }) },
    runtime: { submitEnvoyRequest: async () => envoyDecided(mounted.state, false)() } });
  await mounted.say("Försoning?");
  await mounted.act(() => buttonNamed(mounted.tree, "Skicka").props.onClick());
  assert.match(textOf(mounted.tree), /avvisar sändebudet\. Nästa sändebud kan gå om ett år\./);
  assert.doesNotMatch(textOf(mounted.tree), /betalades/);
  const replies = [];
  const greeted = mountEnvoy({
    model: { extractEnvoyRequest: async () => ({ ok: true, request: null }), replyAsRuler: async (call) => { replies.push(call); return { ok: true, reply: "Var hälsad." }; } },
    runtime: { submitEnvoyRequest: async () => assert.fail("a greeting sends no envoy") } });
  await greeted.say("Hälsningar från Aachen.");
  assert.equal(replies[0].outcome, null);
  assert.match(textOf(greeted.tree), /Var hälsad\./);
  assert.equal(envoyCard(greeted.tree), undefined);
});

test("the view reads the engine's own record of the envoy, accepted or refused", async () => {
  for (const roll of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const replies = [];
    let mounted;
    mounted = mountEnvoy({
      model: { extractEnvoyRequest: async () => ({ ok: true, request: reconcileRequest }), replyAsRuler: async (call) => { replies.push(call); return { ok: true, reply: "Så får det bli." }; } },
      runtime: { submitEnvoyRequest: (...args) => engineEnvoy(mounted, roll)(...args) } });
    await mounted.say("Försoning, och 20 silver.");
    await mounted.act(() => buttonNamed(mounted.tree, "Skicka").props.onClick());
    assert.equal(replies.length, 1, "the ruler answers once the record is found");
    const accepted = replies[0].outcome.accepted;
    assert.match(textOf(mounted.tree), accepted ? /går med på försoning/ : /avvisar sändebudet/);
    assert.doesNotMatch(textOf(mounted.tree), /Läs utfallet i krönikan/);
  }
});

test("the envoy cannot be closed while it rides", async () => {
  let release;
  const mounted = mountEnvoy({ model: { extractEnvoyRequest: async () => ({ ok: true, request: reconcileRequest }) },
    runtime: { submitEnvoyRequest: () => new Promise((resolve) => { release = resolve; }) } });
  await mounted.say("Försoning?");
  assert.equal(buttonNamed(mounted.tree, "Stäng").props.disabled, false);
  const riding = mounted.act(() => buttonNamed(mounted.tree, "Skicka").props.onClick());
  await settle();
  assert.equal(buttonNamed(mounted.draw(), "Stäng").props.disabled, true);
  release({ ok: false, error: "Världen har ändrats." });
  await riding;
  assert.match(textOf(mounted.tree), /Världen har ändrats\./);
  assert.equal(buttonNamed(mounted.tree, "Stäng").props.disabled, false);
});

test("a neighbor names its faith and marks another faith, and an older save shows none", () => {
  const driver = createHookDriver();
  const { ForeignRealms } = loadPanel({}, { react: driver.react });
  const base = { rulerName: "Leo III", rulerAge: 50, heirName: null, seatName: "Rom", distanceKm: 1100, neighbor: true, allied: false, opinion: 0, claim: null, war: null, lands: 0, envoyReason: "" };
  const realms = [{ ...base, id: "papal", name: "Kyrkostaten", faithName: "Den latinska kyrkan", otherFaith: true }, { ...base, id: "asturias", name: "Asturien", faithName: "Kyrkan i Asturien", otherFaith: false }, { ...base, id: "old", name: "Gammalt rike", faithName: null, otherFaith: false }];
  const shown = textOf(driver.render(React.createElement(ForeignRealms, { realms })));
  assert.match(shown, /hållning 0 · tro: Den latinska kyrkan \(annan tro\)/);
  assert.match(shown, /tro: Kyrkan i Asturien(?! \(annan)/);
  assert.equal((shown.match(/tro:/g) ?? []).length, 2);
});

test("each neighbor offers an envoy, and a closed one says why", () => {
  const driver = createHookDriver();
  const { ForeignRealms } = loadPanel({}, { react: driver.react });
  const base = { rulerName: "Alfons", rulerAge: 40, heirName: null, seatName: "Oviedo", distanceKm: 900, neighbor: true, allied: false, opinion: 0, claim: null, war: null, lands: 0 };
  const realms = [{ ...base, id: "asturias", name: "Asturien", envoyReason: "" }, { ...base, id: "cordoba", name: "Córdoba", envoyReason: "Ett sändebud var där nyss. Riket tar inte emot ett nytt förrän om ett år." }];
  const opened = [];
  const tree = driver.render(React.createElement(ForeignRealms, { realms, onEnvoy: (id) => opened.push(id), renderEnvoy: () => React.createElement("p", null, "SÄNDEBUD") }));
  const buttons = findAll(tree, (node) => node.type === "button" && /Skicka sändebud/.test(node.props["aria-label"] ?? ""));
  assert.deepEqual(buttons.map((button) => [button.props["aria-label"], button.props.disabled]), [["Skicka sändebud till Asturien", false], ["Skicka sändebud till Córdoba", true]]);
  assert.match(textOf(tree), /Ett sändebud var där nyss/);
  buttons[0].props.onClick();
  assert.deepEqual(opened, ["asturias"]);
  const open = driver.render(React.createElement(ForeignRealms, { realms, openId: "asturias", onEnvoy: () => {}, renderEnvoy: () => React.createElement("p", null, "SÄNDEBUD") }));
  assert.match(textOf(open), /SÄNDEBUD/);
  assert.equal(findAll(open, (node) => node.type === "button").length, 1, "the open realm shows its envoy instead of the button");
  assert.equal(findAll(driver.render(React.createElement(ForeignRealms, { realms })), (node) => node.type === "button").length, 0, "without onEnvoy the list only reads");
  const busy = driver.render(React.createElement(ForeignRealms, { realms, busy: true, onEnvoy: () => {} }));
  assert.ok(findAll(busy, (node) => node.type === "button").every((button) => button.props.disabled), "a busy panel sends no envoy");
});

test("the border tribes show distance, state and the last raid, and no list appears without tribes", () => {
  const driver = createHookDriver();
  const { BorderTribes } = loadPanel({}, { react: driver.react });
  const tribes = [{ id: "a", name: "Testobodriter", distanceKm: 451, stateLabel: "oroligt", lastRaidYear: 803 }, { id: "b", name: "Testsorber", distanceKm: null, stateLabel: "betalt till 805", lastRaidYear: null }];
  const shown = textOf(driver.render(React.createElement(BorderTribes, { tribes })));
  assert.match(shown, /Gränsfolk/);
  assert.match(shown, /Testobodriter451 km · oroligt · senaste räd 803/);
  assert.match(shown, /Testsorberokänt avstånd · betalt till 805/);
  assert.equal(driver.render(React.createElement(BorderTribes, { tribes: [] })), null);
});

// --- Two languages: the model's own text and the translator's markers --------------------------------------------

test("a model's English refusal and explanation reach the player as written, marked as the model's text", async () => {
  const box = loadActionBox();
  const { state, view } = engineCampaign();
  const noMatch = await box.prepareInterpretedAction({ text: "I fly to the moon", view,
    interpret: ({ text, view: seen }) => interpretCharacterAction({ text, view: seen, language: "English", callModel: async () => ({ toolInput: { status: "no_match", explanation: "The council refuses to back the plan.", suggestions: [] } }) }), estimate: async () => assert.fail() });
  assert.deepEqual([noMatch.kind, noMatch.reason, noMatch.reasonFromModel], ["menu", "The council refuses to back the plan.", true]);
  const menu = renderToStaticMarkup(React.createElement(box.ActionMenu, { view, reason: noMatch.reason, reasonFromModel: noMatch.reasonFromModel, onPropose: () => {} }));
  assert.match(menu, /<p class="char-reason" role="status" data-no-translate="">The council refuses to back the plan\.<\/p>/);
  const step = await box.prepareInterpretedAction({ text: "I flatter Iset", view,
    interpret: async () => ({ ...swayAnswer(view), explanation: "You want to win the favour of Iset." }), estimate: async (intent) => estimateCharacterAction(state, intent) });
  assert.equal(step.proposal.explanation, "You want to win the favour of Iset.");
  const card = renderToStaticMarkup(React.createElement(box.ConfirmationCard, { proposal: step.proposal, view, onConfirm: () => {}, onCancel: () => {} }));
  assert.match(card, /<p class="char-caption" data-no-translate="true">You want to win the favour of Iset\.<\/p>/);
});

test("a reason with the model's origin that is no sentence gives the Swedish sentence, and the game's own reason is not marked", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  for (const broken of ["Failed to fetch", "Line one.\nLine two.", `${"a".repeat(300)}.`]) {
    const { result, warnings } = await withWarnings(() => box.prepareInterpretedAction({ text: "x", view,
      interpret: async () => ({ ok: false, reason: broken, origin: "model", fallback: "menu" }), estimate: async () => assert.fail() }));
    assert.deepEqual([result.kind, result.reason, result.reasonFromModel], ["menu", INTERPRET_FAILED, undefined], broken.slice(0, 20));
    assert.equal(warnings.length, 1, "what was kept back goes to the log");
  }
  const html = renderToStaticMarkup(React.createElement(box.ActionMenu, { view, reason: INTERPRET_FAILED, onPropose: () => {} }));
  assert.match(html, /<p class="char-reason" role="status">Texten kunde inte tolkas/);
  assert.doesNotMatch(html, /data-no-translate/);
});

test("a narrated outcome is marked as the model's text; the engine's default text is not", async () => {
  const box = loadActionBox();
  const { view } = engineCampaign();
  const proposal = { mode: "contested", catalogId: "sway", entry: view.catalog.find((entry) => entry.catalogId === "sway"), payload: swayAnswer(view).payload };
  const resolution = { id: "resolution-9", tier: "clean_success", tierLabel: "Lyckat i det tysta", refused: false, actionLabel: "Påverka", effects: [] };
  const run = (narrate, recordNarrative) => box.executeProposal({ proposal, view: { ...view, recentResolutions: [] }, narrate, recordNarrative, present: (state) => state,
    submit: async () => ({ ok: true, state: { recentResolutions: [resolution], schemes: [] }, events: [{ title: "Påverka: lyckat i det tysta", description: "Standardtext." }] }) });
  const story = async () => ({ ok: true, title: "A smile", narrative: "Iset smiled.\n\nThe court saw nothing.", adjustments: [] });
  const told = await run(story, async () => ({ ok: true }));
  assert.equal(told.narrated, true);
  const narrated = renderToStaticMarkup(React.createElement(box.OutcomeCard, { outcome: { ...told, revealed: "Spionmästaren fann något." } }));
  assert.match(narrated, /<strong class="char-outcome-title" data-no-translate="">A smile<\/strong>/);
  assert.match(narrated, /<p data-no-translate="">Iset smiled\.<\/p><p data-no-translate="">The court saw nothing\.<\/p>/);
  assert.match(narrated, /<p class="char-caption">Spionmästaren fann något\.<\/p>/);
  assert.equal((narrated.match(/data-no-translate/g) || []).length, 3, "the heading and the game's own notes stay unmarked");
  const untold = [await run(async () => ({ ok: false, reason: "Modellanropet misslyckades." }), async () => assert.fail()),
    (await withWarnings(() => run(story, async () => ({ ok: false, error: "Berättelsen kan bara skrivas av berättarsteget." })))).result];
  for (const outcome of untold) {
    assert.equal(outcome.narrated, undefined);
    assert.equal(outcome.text, "Standardtext.");
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(box.OutcomeCard, { outcome })), /data-no-translate/);
  }
});

test("what the player said and what the model answered are marked as written; the game's notes are not", async () => {
  const { ConversationView } = loadPanel(baseView());
  const turns = [{ from: "player", text: "Stöd mig." }, { from: "note", text: "Sera Arel ger sitt stöd." }, { from: "speaker", text: "You have my support." }];
  const html = renderToStaticMarkup(React.createElement(ConversationView, { person: { id: "person-0-2", name: "Sera Arel" }, busy: false, setTurns: () => {}, turns }));
  assert.match(html, /<strong>Du<\/strong><p data-no-translate="true">Stöd mig\.<\/p>/);
  assert.match(html, /<strong>Sera Arel<\/strong><p data-no-translate="true">You have my support\.<\/p>/);
  assert.match(html, /<li class="char-talk-note">Sera Arel ger sitt stöd\.<\/li>/);
  assert.equal((html.match(/data-no-translate/g) || []).length, 2);
  const envoy = mountEnvoy({ model: { extractEnvoyRequest: async () => ({ ok: true, request: null }), replyAsRuler: async () => ({ ok: true, reply: "We have nothing to discuss." }) } });
  await envoy.say("Hälsningar från hovet.");
  const asWritten = findAll(envoy.tree, (node) => node.props?.["data-no-translate"] === true);
  assert.deepEqual(asWritten.map((node) => [node.type, textOf(node)]), [["p", "Hälsningar från hovet."], ["p", "We have nothing to discuss."]]);
});

test("a narrated action in the chronicle is marked as the model's text; the engine's entries are not", () => {
  const { ChronicleView } = loadPanel(baseView());
  const log = [{ id: "event-2", date: "-0300-02-01", type: "action_narrative", title: "A smile", description: "Iset smiled." },
    { id: "event-1", date: "-0300-02-01", type: "action_resolution", title: "Påverka: lyckat i det tysta", description: "Iset lyssnade." },
    { id: "event-0", date: "-0300-01-01", type: "realm_effect", title: "Rikets läge förändras", description: "Skörden slog fel. Förändring: Statskassa -10." }];
  const html = renderToStaticMarkup(React.createElement(ChronicleView, { view: { ...baseView(), log, memories: [] }, filter: "log", setFilter: () => {} }));
  assert.match(html, /<strong data-no-translate="">A smile<\/strong><p data-no-translate="">Iset smiled\.<\/p>/);
  assert.match(html, /<strong>Påverka: lyckat i det tysta<\/strong><p>Iset lyssnade\.<\/p>/);
  assert.match(html, /<strong>Rikets läge förändras<\/strong><p>Skörden slog fel\. Förändring: Statskassa -10\.<\/p>/);
  assert.equal((html.match(/data-no-translate/g) || []).length, 2);
});

test("the roots of the Swedish-native views carry data-native-text, and no panel view leaves its root through a portal", () => {
  const read = (file) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
  assert.match(read("CharactersPanel.jsx"), /return <div className="char-backdrop" data-char-theme=\{theme\} data-native-text /);
  assert.match(read("HistoricalYearNotice.jsx"), /return <div className="char-backdrop hist-backdrop" data-char-theme=\{theme\} data-native-text>/);
  assert.match(read("HistoricalRecordView.jsx"), /return <div className="hist-record" data-native-text>/);
  for (const file of ["CharactersPanel.jsx", "ActionBox.jsx", "ConversationView.jsx", "EnvoyView.jsx", "IntrigueView.jsx", "CourtSections.jsx", "LocalModelConnect.jsx",
    "CharacterWatchToggles.jsx", "HistoricalYearNotice.jsx", "HistoricalRecordView.jsx", "HistoricalEventCard.jsx", "Portrait.jsx"]) {
    assert.doesNotMatch(read(file), /createPortal/, file);
  }
  const { default: Panel } = loadPanel(baseView(), { globals: { window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }, document: { activeElement: null } } });
  assert.match(renderToStaticMarkup(React.createElement(Panel, { open: true, onClose: () => {} })), /^<div class="char-backdrop" data-char-theme="light" data-native-text="true">/);
});

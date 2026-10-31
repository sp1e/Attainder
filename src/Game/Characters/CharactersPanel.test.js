import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { createCharacterSystem, estimateCharacterAction, getCharacterPresentation } from "../../runtime/characters/index.js";
import { interpretCharacterAction } from "./characterModelCalls.js";
import { buttonNamed, createHookDriver, findAll, settle, textOf } from "../testing/hookDriver.js";

// Render the real JSX with supplied presentation data. Runtime and portrait
// loading are stubs; these checks do not exercise the core or a browser.
const source = readFileSync(new URL("./CharactersPanel.jsx", import.meta.url), "utf8");
const compiled = transformSync(`${source}\nexport { CouncilView, GovernanceSummary, ActionCard, StoryCard, ChainHistory };`, {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;
const actionBoxCompiled = transformSync(readFileSync(new URL("./ActionBox.jsx", import.meta.url), "utf8"), {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;

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
  };
  return runModule(actionBoxCompiled, modules);
}

function loadPanel(view, { busy = false, theme = "light", panelState = true, tab = "council", modelCalls = 0 } = {}) {
  let stateIndex = 0;
  const calls = [];
  const modules = {
    react: { ...React, useEffect: () => {}, useCallback: (fn) => fn,
      useMemo: (fn) => fn(), useRef: (value) => ({ current: value }),
      useState: (initial) => {
        const index = stateIndex++;
        const value = panelState && index === 0 ? view : panelState && index === 1 ? true : panelState && index === 2 ? tab : panelState && index === 4 ? busy : typeof initial === "function" ? initial() : initial;
        return [value, () => {}];
      } },
    "../../runtime/useRuntimeState.js": { useRuntimeState: () => null },
    "../../runtime/gameDates.js": { parseGameDate: () => null, compareGameDates: () => 0 },
    "../../runtime/characters/index.js": { getCharacterPresentation: (state) => state },
    "../../runtime/characterRuntime.js": {
      advanceCharacterYearWithModel: async () => { calls.push("advance"); return {}; },
      readVisibleCharacterState: async () => view,
      estimateCharacterActionForView: async () => ({ ok: false, reason: "Ingen uppskattning." }),
      recordCharacterNarrative: async () => ({ ok: true }),
      submitCharacterCommand: async () => ({ ok: true, events: [] }),
    },
    "../AI/modelCallCounter.js": { getModelCallCounts: () => ({ total: modelCalls, byKind: {} }), subscribeModelCalls: () => () => {} },
    "./characterModelCalls.js": {
      interpretCharacterAction: async () => ({ ok: false, reason: "Ingen modell är ansluten.", fallback: "menu" }),
      narrateCharacterResolution: async () => ({ ok: false, reason: "Ingen modell är ansluten." }),
    },
    "./characters.css": {},
    "./LocalModelConnect.jsx": { default: () => null, __esModule: true },
    "./Portrait.jsx": { default: ({ person }) => React.createElement("span", { "data-portrait-person": person.id }), __esModule: true },
  };
  modules["./ActionBox.jsx"] = runModule(actionBoxCompiled, modules);
  const exports = runModule(compiled, modules, { window: { matchMedia: () => ({ matches: theme === "dark" }) }, localStorage: { getItem: () => "system" } });
  return { ...exports, calls };
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
const council = (view) => {
  const { CouncilView } = loadPanel(view, { panelState: false });
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

// A real family campaign from the engine, so the catalog, staff and odds are the ones the player meets.
function engineCampaign(diplomacy) {
  const state = createCharacterSystem({ mode: "family", seed: 41 });
  const representativeId = getCharacterPresentation(state).representative.id;
  if (diplomacy !== undefined) state.people[representativeId].skills.diplomacy = diplomacy;
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
  ], onAbort: (id) => aborted.push(id), onEmpty: () => { emptied += 1; }, busy: false };
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
  props.busy = false; props.schemes = props.schemes.slice(1); tree = draw();
  assert.equal(driver.focused.at(-1), buttonNamed(tree, "Avbryt intrigen"), "focus moves to the next scheme");
  buttonNamed(tree, "Avbryt intrigen").props.onClick(); tree = draw();
  buttonNamed(tree, "Ja, avbryt intrigen").props.onClick();
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
});

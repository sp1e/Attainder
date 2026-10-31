import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";

// Render the real JSX with supplied presentation data. Runtime and portrait
// loading are stubs; these checks do not exercise the core or a browser.
const source = readFileSync(new URL("./CharactersPanel.jsx", import.meta.url), "utf8");
const compiled = transformSync(`${source}\nexport { CouncilView, GovernanceSummary, ActionCard };`, {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;

function loadPanel(view, { busy = false, theme = "light", panelState = true } = {}) {
  let stateIndex = 0;
  const calls = [];
  const modules = {
    react: { ...React, useEffect: () => {}, useCallback: (fn) => fn,
      useMemo: (fn) => fn(), useRef: (value) => ({ current: value }),
      useState: (initial) => {
        const index = stateIndex++;
        const value = panelState && index === 0 ? view : panelState && index === 1 ? true : panelState && index === 4 ? busy : typeof initial === "function" ? initial() : initial;
        return [value, () => {}];
      } },
    "../../runtime/useRuntimeState.js": { useRuntimeState: () => null },
    "../../runtime/gameDates.js": { parseGameDate: () => null, compareGameDates: () => 0 },
    "../../runtime/characters/index.js": { getCharacterPresentation: (state) => state },
    "../../runtime/characterRuntime.js": {
      advanceCharacterYearWithModel: async () => { calls.push("advance"); return {}; },
      readVisibleCharacterState: async () => view,
    },
    "./characters.css": {},
    "./LocalModelConnect.jsx": { default: () => null, __esModule: true },
    "./Portrait.jsx": { default: ({ person }) => React.createElement("span", { "data-portrait-person": person.id }), __esModule: true },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id) => {
    assert.ok(id in modules, `Unexpected import: ${id}`);
    return modules[id];
  }, window: { matchMedia: () => ({ matches: theme === "dark" }) }, localStorage: { getItem: () => "system" } });
  return { ...module.exports, calls };
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
const council = (view) => {
  const { CouncilView } = loadPanel(view);
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

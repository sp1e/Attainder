import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import * as characters from "../runtime/characters/index.js";
import * as campaignSeed from "../runtime/campaignSeed.js";
import * as dynastyScenario from "../runtime/dynastyScenario.js";
import { buttonNamed, createHookDriver, findAll, settle } from "./testing/hookDriver.js";

// Render the real start card with its runtime imports stubbed. State setters are no-ops, so each check reads the first render.
const compiled = transformSync(readFileSync(new URL("./DynastyStartCard.jsx", import.meta.url), "utf8"), {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;

function loadCard({ react, startDynastyCampaign } = {}) {
  const started = [];
  const modules = {
    react: react || { ...React, useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}] },
    "./Characters/LocalModelConnect.jsx": { default: () => null, __esModule: true },
    "../runtime/startDynastyCampaign.js": { startDynastyCampaign: startDynastyCampaign || (async (options) => { started.push(options); }) },
    "./AI/providerConfig.js": { isFallbackListConfigured: () => true },
    "./dynastyStart.css": {},
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id) => {
    assert.ok(id in modules, `Unexpected import: ${id}`);
    return modules[id];
  }, React, localStorage: { getItem: () => null } });
  return { Card: module.exports.default, started, exports: module.exports };
}
const loadCardModule = () => loadCard();

function elements(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(elements)];
}

test("the campaign start offers Lätt, Normal and Svår with Normal chosen", () => {
  const { Card } = loadCard();
  const html = renderToStaticMarkup(React.createElement(Card, {}));
  assert.match(html, /<label for="dynasty-difficulty">Svårighetsgrad<\/label>/);
  const options = [...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(options, [["easy", "Lätt"], ["normal", "Normal"], ["hard", "Svår"]]);
  assert.match(html, /<option value="normal" selected="">Normal<\/option>/);
});

test("starting a campaign passes the chosen difficulty on as the character difficulty", async () => {
  const { Card, started } = loadCard();
  const fromCard = [];
  const tree = Card({ onStart: async (options) => { fromCard.push(options); } });
  const play = elements(tree).find((element) => element.props?.className === "dynasty-start-play");
  await play.props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(fromCard)), [{ mode: "realm", seed: "", difficulty: "normal" }]);
  const direct = loadCard();
  const button = elements(direct.Card({})).find((element) => element.props?.className === "dynasty-start-play");
  await button.props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(direct.started)), [{ mode: "realm", seed: "", characterDifficulty: "normal" }]);
});

// The real campaign start with the library stubbed: the created world is captured instead of saved.
function loadStartCampaign() {
  const saved = [];
  const code = transformSync(readFileSync(new URL("../runtime/startDynastyCampaign.js", import.meta.url), "utf8"), { loader: "js", format: "cjs" }).code;
  const modules = {
    "./library.js": {
      ensureLibraryCatalog: async () => ({ scenarios: [{ id: dynastyScenario.DYNASTY_SCENARIO_ID }] }),
      importScenarioBundle: async () => assert.fail("the scenario is already in the catalog"),
      createGame: async () => ({ game: { id: "game-1" }, data: { game: { gameDate: dynastyScenario.DYNASTY_DATE }, world: {} } }),
      saveGame: async (id, patch) => { saved.push(patch); },
      activateGame: async () => {},
    },
    "./characters/index.js": characters, "./campaignSeed.js": campaignSeed, "./dynastyScenario.js": dynastyScenario,
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id) => {
    assert.ok(id in modules, `Unexpected import: ${id}`);
    return modules[id];
  }, localStorage: { setItem: () => {} }, window: { dispatchEvent: () => {} }, CustomEvent: class { constructor(type) { this.type = type; } } });
  return { startDynastyCampaign: module.exports.startDynastyCampaign, saved };
}

test("a campaign started with Svår on the card gets the hard difficulty in its character state", async () => {
  const driver = createHookDriver();
  const { startDynastyCampaign, saved } = loadStartCampaign();
  const { Card } = loadCard({ react: driver.react, startDynastyCampaign });
  let tree = driver.render(React.createElement(Card, {}));
  const select = findAll(tree, (node) => node.type === "select" && node.props.id === "dynasty-difficulty")[0];
  select.props.onChange({ target: { value: "hard" } });
  tree = driver.render(React.createElement(Card, {}));
  await buttonNamed(tree, "Starta som riket Hadara").props.onClick();
  await settle();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].world.characterSystem.difficulty, "hard");
  assert.equal(characters.getCharacterPresentation(saved[0].world.characterSystem).difficulty.label, "Svår");
});

test("both dynasty starts in the library bar forward the chosen character difficulty", () => {
  const source = readFileSync(new URL("./GameUI/libraryBar.jsx", import.meta.url), "utf8");
  // The start card hands its choice to the library bar, which passes it on.
  assert.ok(/startDynastyFromCard = async \(\{ mode, seed, difficulty \}\)/.test(source), "libraryBar.jsx lacks the expected line");
  assert.ok(/startDynastyCampaign\(\{ mode, seed, characterDifficulty: difficulty \}\)/.test(source), "libraryBar.jsx lacks the expected line");
  // The scenario picker offers the same three choices and passes its own state on.
  assert.ok(/startDynastyCampaign\(\{ mode: dynastyMode, scenarioId: scenario\.id, difficulty, characterDifficulty: dynastyDifficulty \}\)/.test(source), "libraryBar.jsx lacks the expected line");
  assert.ok(/<select id="dynasty-picker-difficulty" value=\{dynastyDifficulty\} onChange=\{\(event\) => setDynastyDifficulty\(event\.target\.value\)\}/.test(source), "libraryBar.jsx lacks the expected line");
  assert.ok(/DYNASTY_DIFFICULTIES\.map\(/.test(source), "libraryBar.jsx lacks the expected line");
  assert.ok(/import DynastyStartCard, \{ DYNASTY_DIFFICULTIES \} from "\.\.\/DynastyStartCard\.jsx";/.test(source), "libraryBar.jsx lacks the expected line");
});

test("the start card exports the three difficulty choices the scenario picker shares", () => {
  const { exports } = loadCardModule();
  assert.deepEqual(JSON.parse(JSON.stringify(exports.DYNASTY_DIFFICULTIES)), [["easy", "Lätt"], ["normal", "Normal"], ["hard", "Svår"]]);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";

// Render the real start card with its runtime imports stubbed. State setters are no-ops, so each check reads the first render.
const compiled = transformSync(readFileSync(new URL("./DynastyStartCard.jsx", import.meta.url), "utf8"), {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;

function loadCard() {
  const started = [];
  const modules = {
    react: { ...React, useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}] },
    "./Characters/LocalModelConnect.jsx": { default: () => null, __esModule: true },
    "../runtime/startDynastyCampaign.js": { startDynastyCampaign: async (options) => { started.push(options); } },
    "./AI/providerConfig.js": { isFallbackListConfigured: () => true },
    "./dynastyStart.css": {},
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id) => {
    assert.ok(id in modules, `Unexpected import: ${id}`);
    return modules[id];
  }, React, localStorage: { getItem: () => null } });
  return { Card: module.exports.default, started };
}

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

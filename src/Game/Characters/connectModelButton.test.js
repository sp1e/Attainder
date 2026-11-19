// Run: node --test src/Game/Characters/connectModelButton.test.js
// The panel header's model button names the model the game uses once one is chosen on this computer.
// Found on 19 November 2026 in new campaigns of the other starts: with Claude chosen on the start card the
// button still read "Connect a model".
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";

const read = (file) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
const compiled = transformSync(read("LocalModelConnect.jsx"), { loader: "jsx", format: "cjs", jsx: "transform" }).code;

// The module with the fallback list it reads; `listeners` collects what it subscribes to on the window.
function load(fallbackList, listeners = {}) {
  const module = { exports: {} };
  const modules = {
    react: React,
    "../AI/providerConfig.js": { applyQuickAiSetup: () => ({}), getResolvedFallbackList: () => fallbackList },
    "./characters.css": {},
  };
  const window = { addEventListener: (name, listener) => { listeners[name] = listener; }, removeEventListener: (name) => { delete listeners[name]; } };
  vm.runInNewContext(compiled, { module, exports: module.exports, console, window, fetch: async () => ({ ok: false }), AbortController, setTimeout, clearTimeout,
    require: (id) => { assert.ok(id in modules, `Unexpected import: ${id}`); return modules[id]; } });
  return module.exports;
}
const button = (fallbackList, props = {}) => renderToStaticMarkup(React.createElement(load(fallbackList).ConnectModelButton, { open: false, onToggle: () => {}, ...props }));

test("with no model chosen the button offers to connect one", () => {
  assert.equal(button([]), '<button type="button" class="char-button char-connect-model" aria-expanded="false">Anslut modell</button>');
});

test("with Claude or Codex chosen the button names it, and the name is not read through the dictionary", () => {
  assert.equal(button([{ provider: "claude-cli" }]), '<button type="button" class="char-button char-connect-model" aria-expanded="false">Modell: <span data-no-translate="true">Claude</span></button>');
  assert.match(button([{ provider: "codex-cli" }, { provider: "claude-cli" }], { open: true }), /aria-expanded="true">Modell: <span data-no-translate="true">Codex<\/span>/);
});

test("a provider the panel does not connect leaves the offer as it was", () => {
  assert.match(button([{ provider: "gemini" }]), />Anslut modell<\/button>$/);
  assert.match(button([{}]), />Anslut modell<\/button>$/);
});

test("the button and the connection list read the same choice, and follow a change of it", () => {
  const source = read("LocalModelConnect.jsx");
  assert.match(source, /export function useSelectedProvider\(\)/);
  assert.equal(source.match(/useSelectedProvider\(\)/g).length, 3, "declared once, used by the list and by the button");
  assert.equal(source.match(/"ai:fallback-changed"/g).length, 2, "one subscription and its removal");
  const panel = read("CharactersPanel.jsx");
  assert.match(panel, /<ConnectModelButton open=\{modelConnectOpen\} onToggle=\{\(\) => setModelConnectOpen\(\(current\) => !current\)\} \/>/);
  assert.doesNotMatch(panel, />Anslut modell</);
});

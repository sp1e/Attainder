// A scenario that says it has no stats.json is not asked for one.
// Backlog row 26 (docs/development/DEVELOPMENT-BACKLOG.md): every court year asked the Charlemagne scenario for
// `assets/stats` twice and got 404, which the browser writes to the console as an error.
//
// statsSheet.js imports the asset store and the library, which need a browser; the module is loaded with stand-ins,
// as DynastyStartCard.test.js loads its card.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import * as definitions from "./statIndexDefinitions.js";

const source = transformSync(readFileSync(new URL("./statsSheet.js", import.meta.url), "utf8"), { loader: "js", format: "cjs" }).code;
const load = ({ scenario, download = async () => null, runtimeJson = null }) => {
  const asked = [];
  const read = [];
  const modules = {
    "./assets.js": { JSON_URLS: { stats: "/api/runtime/json/stats" }, readJson: async (url) => { read.push(url); return runtimeJson; } },
    "./library.js": {
      downloadScenarioJsonAsset: async (id, key) => { asked.push([id, key]); return download(id, key); },
      getLibraryState: () => ({ runtimeScenario: scenario }),
    },
    "./statIndexDefinitions.js": definitions,
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: (id) => { assert.ok(id in modules, `Unexpected import: ${id}`); return modules[id]; } });
  return { sheet: module.exports, asked, read };
};
const standard = definitions.normalizeStatSheetDefinition(null);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("a scenario without a stats.json gives the standard sheet and no request", async () => {
  const { sheet, asked, read } = load({ scenario: { id: "charlemagne-800", assetStatus: { cover: false, colors: true, stats: false } } });
  assert.deepEqual(plain(await sheet.loadStatSheetDefinition()), plain(standard));
  assert.deepEqual(asked, [], "nothing is asked of the server, so nothing answers 404");
  assert.deepEqual(read, [], "and a game's own stale copy is not read in its place");
});

test("a scenario that has a stats.json is asked for it, and a failed read is still an error", async () => {
  const raw = { sections: [{ title: "Realm", rows: [{ key: "grain", label: "Grain", kind: "index" }] }] };
  const present = load({ scenario: { id: "edited", name: "Edited", assetStatus: { stats: true } }, download: async () => raw });
  assert.deepEqual(plain(await present.sheet.loadStatSheetDefinition()), plain(definitions.normalizeStatSheetDefinition(raw)));
  assert.deepEqual(present.asked, [["edited", "stats"]]);
  const failed = load({ scenario: { id: "edited", name: "Edited", assetStatus: { stats: true } } });
  await assert.rejects(() => failed.sheet.loadStatSheetDefinition(), /Could not load the Stats definition for scenario "Edited"/);
});

test("a scenario whose catalog entry says nothing about its files is asked, as before", async () => {
  for (const assetStatus of [undefined, null, {}]) {
    const { sheet, asked } = load({ scenario: { id: "older", assetStatus } });
    assert.deepEqual(plain(await sheet.loadStatSheetDefinition()), plain(standard));
    assert.deepEqual(asked, [["older", "stats"]], JSON.stringify(assetStatus));
  }
});

test("without a linked scenario the game's own definition is read", async () => {
  for (const scenario of [null, { id: "gone", missing: true, assetStatus: { stats: false } }]) {
    const { sheet, asked, read } = load({ scenario });
    assert.deepEqual(plain(await sheet.loadStatSheetDefinition()), plain(standard));
    assert.deepEqual(asked, []);
    assert.deepEqual(read, ["/api/runtime/json/stats"]);
  }
});

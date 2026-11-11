// Run: node --test src/runtime/nativePack.test.js
//
// The native pack is three files merged into one object: code text over package
// text over the research pairs. These pin the order, what counts as no
// translation, and that a file which fails to load costs only its own entries.

import test from "node:test";
import assert from "node:assert/strict";

import { NATIVE_PACK_PATHS, loadNativePack, mergeNativePack } from "./nativePack.js";

test("code text wins over package text, which wins over a research pair", () => {
  const merged = mergeNativePack({
    code: { Sändebud: "Envoy", Hov: "Court" },
    packages: { Sändebud: "Messenger", Hov: "Household", Rom: "City of Rome" },
    historical: { Sändebud: "Emissary", Rom: "Rome", Aten: "Athens" },
  });
  assert.deepEqual(merged, { Sändebud: "Envoy", Hov: "Court", Rom: "City of Rome", Aten: "Athens" });
});

test("a value that is not text, or is empty, hides nothing", () => {
  const merged = mergeNativePack({
    code: { Rom: "", Aten: "   ", Kairo: 7, Paris: null, Pavia: ["Pavia"], Aachen: { en: "Aachen" } },
    packages: { Rom: "City of Rome", Kairo: "Cairo" },
    historical: { Rom: "Rome", Aten: "Athens", Paris: "Paris", Pavia: "Pavia", Aachen: "Aix" },
  });
  assert.deepEqual(merged, { Rom: "City of Rome", Aten: "Athens", Kairo: "Cairo", Paris: "Paris", Pavia: "Pavia", Aachen: "Aix" });
});

test("a missing or malformed layer is an empty one", () => {
  assert.deepEqual(mergeNativePack(), {});
  assert.deepEqual(mergeNativePack({ historical: { Rom: "Rome" } }), { Rom: "Rome" });
  assert.deepEqual(mergeNativePack({ code: null, packages: ["Rom"], historical: "Rom" }), {});
  const layers = { code: { Rom: "Rome" }, packages: {}, historical: {} };
  assert.notEqual(mergeNativePack(layers), layers.code, "the result is a new object");
});

test("the three files are fetched together and merged", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const requested = [];
  const files = {
    [NATIVE_PACK_PATHS.code]: { Sändebud: "Envoy" },
    [NATIVE_PACK_PATHS.packages]: { Sändebud: "Messenger", Aachen: "Aachen" },
    [NATIVE_PACK_PATHS.historical]: { Rom: "Rome", Aachen: "Aix" },
  };
  const fetchJson = (path) => {
    requested.push(path);
    return new Promise((resolve) => setTimeout(() => resolve(files[path]), 1));
  };
  const pending = loadNativePack(fetchJson);
  assert.deepEqual(requested, ["/lang/attainder/en.json", "/lang/attainder/packages-en.json", "/lang/attainder/historical-en.json"], "all three are asked for before any answers");
  assert.deepEqual(await pending, { Sändebud: "Envoy", Aachen: "Aachen", Rom: "Rome" });
  assert.equal(warn.mock.callCount(), 0);
});

test("a file that fails to load is warned about once, by path, and the rest still loads", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const fetchJson = async (path) => {
    if (path === NATIVE_PACK_PATHS.packages) throw new Error("404");
    if (path === NATIVE_PACK_PATHS.code) return ["not", "an", "object"];
    return { Rom: "Rome" };
  };
  assert.deepEqual(await loadNativePack(fetchJson), { Rom: "Rome" });
  const messages = warn.mock.calls.map((call) => String(call.arguments[0]));
  assert.equal(messages.length, 2, "one warning for each file that gave nothing");
  assert.ok(messages.some((message) => message.includes(NATIVE_PACK_PATHS.packages) && message.includes("404")));
  assert.ok(messages.some((message) => message.includes(NATIVE_PACK_PATHS.code)));
});

test("with every file failing the pack is empty, not an error", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const pack = await loadNativePack(() => Promise.reject(new Error("offline")));
  assert.deepEqual(pack, {});
  assert.equal(warn.mock.callCount(), 3);
});

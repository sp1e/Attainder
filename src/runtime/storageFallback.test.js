// A stand-in for the browser's storage when it is blocked (backlog row 31).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createVolatileStorage, installStorageFallback, storageIsVolatile } from "./storageFallback.js";
import { createMemoryStorage } from "../Game/AI/requestBudget.js";

const refuse = () => { throw new Error("storage is blocked"); };
const blocked = () => ({ getItem: refuse, setItem: refuse, removeItem: refuse });

test("a storage that cannot be written is replaced by one kept in memory", () => {
  // The three ways a browser blocks it: the methods throw, the property itself throws, or it is not there.
  const methods = { localStorage: blocked(), sessionStorage: blocked() };
  assert.deepEqual(installStorageFallback(methods), ["localStorage", "sessionStorage"]);
  const property = {};
  Object.defineProperty(property, "localStorage", { get: refuse, configurable: true });
  Object.defineProperty(property, "sessionStorage", { get: refuse, configurable: true });
  assert.deepEqual(installStorageFallback(property), ["localStorage", "sessionStorage"]);
  const absent = {};
  assert.deepEqual(installStorageFallback(absent), ["localStorage", "sessionStorage"]);
  for (const target of [methods, property, absent]) {
    target.localStorage.setItem("Globe", "true");
    assert.equal(target.localStorage.getItem("Globe"), "true");
    assert.equal(target.localStorage.ohVolatile, true);
    assert.notEqual(target.localStorage, target.sessionStorage, "each its own");
  }
});

test("a storage that works is left as it is", () => {
  const local = createMemoryStorage({ ui_language: "sv" });
  const target = { localStorage: local, sessionStorage: blocked() };
  assert.deepEqual(installStorageFallback(target), ["sessionStorage"]);
  assert.equal(target.localStorage, local);
  assert.equal(target.localStorage.getItem("ui_language"), "sv");
  assert.equal(target.localStorage.getItem("oh:storage-probe"), null, "the probe leaves nothing behind");
});

test("the stand-in behaves as a storage does", () => {
  const storage = createVolatileStorage();
  assert.equal(storage.getItem("a"), null);
  storage.setItem("a", 1);
  storage.setItem("b", "two");
  assert.equal(storage.getItem("a"), "1", "values are strings");
  assert.equal(storage.length, 2);
  assert.deepEqual([storage.key(0), storage.key(1), storage.key(2)], ["a", "b", null]);
  storage.removeItem("a");
  assert.equal(storage.length, 1);
  storage.clear();
  assert.equal(storage.length, 0);
  assert.deepEqual(Object.keys(storage).includes("ohVolatile"), false, "the mark is not a stored key");
});

test("a reader can ask whether what it stores outlives a reload", () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    globalThis.localStorage = createVolatileStorage();
    assert.equal(storageIsVolatile(), true);
    globalThis.localStorage = createMemoryStorage({});
    assert.equal(storageIsVolatile(), false);
    Object.defineProperty(globalThis, "localStorage", { get: refuse, configurable: true });
    assert.equal(storageIsVolatile(), false, "a storage that throws is not the stand-in");
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else delete globalThis.localStorage;
  }
});

test("the stand-in is installed before anything else of the game is loaded", () => {
  const entry = fs.readFileSync(new URL("../main.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const imports = entry.split("\n").filter((line) => line.startsWith("import "));
  assert.equal(imports[0], 'import "./runtime/storageFallback.js";', "imports are evaluated in order, and other modules read storage as they load");
});

// Spec: docs/superpowers/specs/2026-11-08-watches-design.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readCharacterWatches, writeCharacterWatches } from "./characterWatchSettings.js";

const withStorage = (storage, run) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
  try { run(); } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
};

const memoryStorage = () => {
  const items = new Map();
  return { getItem: (key) => (items.has(key) ? items.get(key) : null), setItem: (key, value) => items.set(key, String(value)), items };
};

test("each campaign keeps its own watches", () => withStorage(memoryStorage(), () => {
  assert.deepEqual(writeCharacterWatches("c1", ["ransom_offer", "bogus", "family_stress"]), ["family_stress", "ransom_offer"]);
  writeCharacterWatches("c2", ["child_adult"]);
  assert.deepEqual(readCharacterWatches("c1"), ["family_stress", "ransom_offer"]);
  assert.deepEqual(readCharacterWatches("c2"), ["child_adult"]);
  assert.deepEqual(readCharacterWatches("c3"), []);
  assert.deepEqual(readCharacterWatches(""), []);
}));

test("unreadable or missing storage turns every watch off", () => {
  const storage = memoryStorage();
  storage.items.set("attainder-character-watches:c1", "{not json");
  const warn = console.warn;
  console.warn = () => {};
  try {
    withStorage(storage, () => assert.deepEqual(readCharacterWatches("c1"), []));
    withStorage(undefined, () => {
      assert.deepEqual(readCharacterWatches("c1"), []);
      assert.deepEqual(writeCharacterWatches("c1", ["child_adult"]), ["child_adult"]);
    });
  } finally { console.warn = warn; }
});

import test from "node:test";
import assert from "node:assert/strict";
import { commitCharacterTransaction, recoverCharacterTransaction } from "./characterPersistence.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const base = {
  game: { gameDate: "-0300-01-01", round: 1 },
  world: { characterSystem: { revision: 0 }, treasury: 30 },
  events: [{ id: "old" }], actions: [], chat: [], colors: { Hadara: "#abcdef" },
};
const next = { ...clone(base), game: { gameDate: "-0299-01-01", round: 2 },
  world: { characterSystem: { revision: 1 }, treasury: 50 }, events: [{ id: "new" }] };

const storage = ({ failKey = "", persistentFailure = false, switchAt = "" } = {}) => {
  const data = clone(base);
  const trace = [];
  let snapshots = [];
  let failed = false;
  let switched = false;
  return {
    data, trace,
    get snapshots() { return snapshots; },
    io: {
      assertCurrent: async () => { if (switched) throw new Error("campaign changed"); },
      readSnapshots: async () => snapshots,
      writeSnapshots: async (value) => { snapshots = clone(value); trace.push("snapshots"); },
      write: async (key, value) => {
        trace.push(key);
        if (key === failKey && (!failed || persistentFailure)) { failed = true; throw new Error(`failed:${key}`); }
        data[key] = clone(value);
        if (key === switchAt) switched = true;
      },
      publish: async () => trace.push("publish"),
    },
  };
};

test("successful commit journals before assets and removes journal only at completion", async () => {
  const store = storage();
  await commitCharacterTransaction({ id: "one", base, next, io: store.io });
  assert.deepEqual(store.trace.slice(0, 3), ["snapshots", "world", "actions"]);
  assert.deepEqual(store.data, { ...next, world: { ...next.world, characterTransaction: null } });
  assert.deepEqual(store.snapshots[0].state, base);
});

for (const key of ["actions", "events", "game", "colors", "chat"]) {
  test(`failure writing ${key} restores the whole pre-turn bundle`, async () => {
    const store = storage({ failKey: key });
    await assert.rejects(commitCharacterTransaction({ id: key, base, next, io: store.io }), /failed:/);
    assert.deepEqual(store.data, base);
    assert.deepEqual(store.snapshots[0].state, base);
  });
}

test("an interrupted process can recover from its persisted journal on reload", async () => {
  const store = storage({ failKey: "game", persistentFailure: true });
  await assert.rejects(commitCharacterTransaction({ id: "crash", base, next, io: store.io }), /failed:game/);
  assert.equal(store.data.world.characterTransaction.snapshotId, "character-snapshot:crash");
  const freshIO = { ...store.io, write: async (key, value) => { store.data[key] = clone(value); } };
  await recoverCharacterTransaction(store.data.world, freshIO);
  assert.deepEqual(store.data, base);
});

test("switching campaigns stops subsequent writes and does not restore into the other campaign", async () => {
  const store = storage({ switchAt: "events" });
  await assert.rejects(commitCharacterTransaction({ id: "switch", base, next, io: store.io }), /campaign changed/);
  assert.equal(store.trace.includes("game"), false);
  assert.ok(store.data.world.characterTransaction);
  assert.deepEqual(store.data.game, base.game);
});

test("a missing restore point preserves the journal and fails clearly", async () => {
  const store = storage();
  await assert.rejects(recoverCharacterTransaction({ characterTransaction: { snapshotId: "missing" } }, store.io), /återställningspunkt/);
  assert.deepEqual(store.trace, []);
});

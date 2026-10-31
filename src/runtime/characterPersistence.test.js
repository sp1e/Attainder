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

const storage = ({ failKey = "", persistentFailure = false, switchAt = "", failFirstRollbackWrite = false } = {}) => {
  const data = clone(base);
  const trace = [];
  let snapshots = [];
  let failed = false;
  let rollbackFailed = false;
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
        // The write right after the injected failure is the first rollback write.
        if (failed && failFirstRollbackWrite && !rollbackFailed) { rollbackFailed = true; throw new Error(`rollback failed:${key}`); }
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

// The turn's action log lands before events, so these tests start with a document
// that the rollback must undo after the events write fails.
const nextWithAction = { ...next, actions: [{ id: "act-1" }] };

test("a write failure mid-commit rolls the documents back in place", async () => {
  const store = storage({ failKey: "events" });
  await assert.rejects(
    commitCharacterTransaction({ id: "mid", base, next: nextWithAction, io: store.io }),
    (error) => error.message === "failed:events" && error.recoveryError === undefined,
  );
  assert.deepEqual(store.trace, ["snapshots", "world", "actions", "events", "actions", "events", "game", "colors", "chat", "world", "publish"]);
  for (const key of ["game", "world", "events", "actions", "chat", "colors"]) {
    assert.deepEqual(store.data[key], base[key], key);
  }
  assert.equal(store.data.world.characterTransaction ?? null, null);
});

test("a failed rollback leaves a journal that the next read recovers", async () => {
  const store = storage({ failKey: "events", failFirstRollbackWrite: true });
  await assert.rejects(
    commitCharacterTransaction({ id: "partial", base, next: nextWithAction, io: store.io }),
    (error) => error.message === "failed:events" && error.recoveryError?.message === "rollback failed:actions",
  );
  // The rollback stopped before it reached the world, so the journal and the half-written turn remain.
  assert.deepEqual(store.trace, ["snapshots", "world", "actions", "events", "actions"]);
  assert.equal(store.data.world.characterTransaction.snapshotId, "character-snapshot:partial");
  assert.deepEqual(store.data.actions, nextWithAction.actions);

  const storedWorld = clone(store.data.world);
  const healthyIO = { ...store.io, write: async (key, value) => { store.data[key] = clone(value); } };
  assert.equal(await recoverCharacterTransaction(storedWorld, healthyIO), true);
  for (const key of ["game", "world", "events", "actions", "chat", "colors"]) {
    assert.deepEqual(store.data[key], base[key], key);
  }
  assert.equal(store.data.world.characterTransaction ?? null, null);
});

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

test("a publish failure after the final write keeps the committed turn", async (t) => {
  const store = storage();
  const logged = t.mock.method(console, "error", () => {});
  const io = { ...store.io, publish: async () => { store.trace.push("publish"); throw new Error("publish failed"); } };
  const result = await commitCharacterTransaction({ id: "turn-7", base, next, io });
  assert.equal(result, next);
  // One pass through the documents and no rollback writes after the publish.
  assert.deepEqual(store.trace, ["snapshots", "world", "actions", "events", "game", "colors", "chat", "world", "publish"]);
  assert.deepEqual(store.data, { ...next, world: { ...next.world, characterTransaction: null } });
  assert.equal(logged.mock.callCount(), 1);
  const [message, error] = logged.mock.calls[0].arguments;
  assert.match(message, /turn-7/);
  assert.equal(error.message, "publish failed");
});

test("an invalid next world is rejected before any write", async () => {
  const store = storage();
  let validated = null;
  const io = { ...store.io, validate: (state) => { validated = state; throw new Error("Världen är ogiltig."); } };
  await assert.rejects(commitCharacterTransaction({ id: "invalid", base, next, io }), /Världen är ogiltig/);
  assert.equal(validated, next);
  // No snapshot, no journal and no document write.
  assert.deepEqual(store.trace, []);
  assert.deepEqual(store.snapshots, []);
  assert.deepEqual(store.data, base);
});

test("a missing restore point preserves the journal and fails clearly", async () => {
  const store = storage();
  await assert.rejects(recoverCharacterTransaction({ characterTransaction: { snapshotId: "missing" } }, store.io), /återställningspunkt/);
  assert.deepEqual(store.trace, []);
});

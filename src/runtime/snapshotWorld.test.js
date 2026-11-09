import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OMITTED_KEYS_FIELD, STATIC_WORLD_KEYS, worldForSnapshot, worldFromSnapshot } from "./snapshotWorld.js";

const live = {
  treasury: 50,
  componentLicenses: [{ id: "historical-basemaps", licenseText: "GPL", sourceFiles: [{ fileName: "world_800.geojson", text: "{}" }] }],
  historicalScenario: { kind: "historical", contentId: "charlemagne-800", sources: [{ id: "s1" }] },
};

test("the static keys are the licence texts and the start", () => {
  assert.deepEqual(STATIC_WORLD_KEYS, ["componentLicenses", "historicalScenario"]);
});

test("a restore point leaves out the static keys and names them", () => {
  const lean = worldForSnapshot(live);
  assert.equal(lean.componentLicenses, undefined);
  assert.equal(lean.historicalScenario, undefined);
  assert.deepEqual(lean[OMITTED_KEYS_FIELD], ["componentLicenses", "historicalScenario"]);
  assert.equal(lean.treasury, 50);
  assert.ok(live.componentLicenses && live.historicalScenario, "the live world keeps both keys");
});

test("a world without static keys is stored as it is", () => {
  const plain = { treasury: 3 };
  assert.equal(worldForSnapshot(plain), plain);
  assert.equal(worldForSnapshot(null), null);
});

test("only the keys the world held are named", () => {
  const lean = worldForSnapshot({ treasury: 1, componentLicenses: [] });
  assert.deepEqual(lean[OMITTED_KEYS_FIELD], ["componentLicenses"]);
});

test("restoring takes the left-out keys from the live world and drops the marker", () => {
  const stored = JSON.parse(JSON.stringify(worldForSnapshot({ ...live, treasury: 30 })));
  const restored = worldFromSnapshot(stored, live);
  assert.equal(restored.treasury, 30);
  assert.equal(restored.componentLicenses, live.componentLicenses);
  assert.equal(restored.historicalScenario, live.historicalScenario);
  assert.equal(restored[OMITTED_KEYS_FIELD], undefined);
  assert.deepEqual(restored, { ...live, treasury: 30 });
});

test("a restore point from before the change comes back as stored", () => {
  const old = { treasury: 30, componentLicenses: [{ id: "old" }] };
  assert.equal(worldFromSnapshot(old, live), old);
});

test("restoring refuses when the live world lacks a left-out key", () => {
  const stored = worldForSnapshot(live);
  assert.throws(() => worldFromSnapshot(stored, { treasury: 1 }), /saknar componentLicenses/);
  assert.throws(() => worldFromSnapshot(stored, null), /saknar componentLicenses/);
});

test("a marker naming an unknown key restores nothing for it", () => {
  const restored = worldFromSnapshot({ treasury: 1, [OMITTED_KEYS_FIELD]: ["treasury", "other"] }, { other: 5 });
  assert.deepEqual(restored, { treasury: 1 });
});

// The real capture in gameplay.js, run with its storage stubbed.
test("a captured restore point holds the world without the static keys", async () => {
  const gameplay = readFileSync(new URL("../Game/AI/gameplay.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const from = gameplay.indexOf("const captureRollbackSnapshot = async");
  const to = gameplay.indexOf("// Restore points, newest first", from);
  assert.ok(from >= 0 && to > from);
  let written = null;
  const deps = { readJson: async () => [], writeJson: async (url, value) => { written = value; }, JSON_URLS: { snapshots: "snapshots" },
    cloneValue: structuredClone, worldForSnapshot, MAX_ROLLBACK_SNAPSHOTS: 12, window: undefined, Event: class {}, console };
  const capture = new Function(...Object.keys(deps), `${gameplay.slice(from, to)}\nreturn captureRollbackSnapshot;`)(...Object.values(deps));
  await capture({ round: 3, fromDate: "0800-01-01", toDate: "0801-01-01", game: { round: 3 }, world: live, events: [], actions: [], chat: [], colors: {} });
  const world = written[0].state.world;
  assert.equal(world.componentLicenses, undefined);
  assert.equal(world.historicalScenario, undefined);
  assert.deepEqual(worldFromSnapshot(world, live), live);
});

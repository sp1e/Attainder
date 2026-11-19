// A historical polity keeps its name when an event updates it.
// Spec: docs/superpowers/specs/2026-11-19-historical-polity-names-design.md.
//
// An authored historical package keys a polity by a stable id (`byzantine-empire`) and names it apart
// (`Bysantinska riket`). Upstream, a country IS its name, and an update wrote the key back as the name: after
// five model-written years five of ten realms were labelled by their ids, on the map and in every list.
import test from "node:test";
import assert from "node:assert/strict";
import { applyEventImpactsToWorld, normalizeWorldState } from "./gameState.js";

const POLITIES = [
  { id: "byzantine-empire", nameSv: "Bysantinska riket" },
  { id: "abbasid-caliphate", nameSv: "Abbasidiska kalifatet" },
  { id: "silla", nameSv: "Silla" },
];
const override = (code, name) => ({ aliases: [], code, color: "", name, note: "" });
const historicalWorld = (names = {}) => ({
  historicalScenario: { kind: "historical", polities: POLITIES },
  polityOverrides: Object.fromEntries(POLITIES.map(({ id, nameSv }) => [id, override(id, names[id] ?? nameSv)])),
  regionOwnershipOverrides: { "region-1": "byzantine-empire", "region-2": "abbasid-caliphate" },
});
const event = (impacts) => ({ date: "0803-07-19", title: "Test", description: "test", impacts });
const update = (code, fields = {}) => ({ operation: "update", code, name: "", aliases: [], color: "", note: "", ...fields });
const names = (world) => Object.fromEntries(Object.entries(world.polityOverrides).map(([key, polity]) => [key, polity.name]));

test("an update that names the polity by its id keeps the polity's name", () => {
  const { world } = applyEventImpactsToWorld({
    world: historicalWorld(),
    events: [event({ polityChanges: [update("byzantine-empire", { note: "Nikephoros survives the revolt." })] })],
  });
  assert.deepEqual(names(world), { "byzantine-empire": "Bysantinska riket", "abbasid-caliphate": "Abbasidiska kalifatet", silla: "Silla" });
  assert.equal(world.polityOverrides["byzantine-empire"].note, "Nikephoros survives the revolt.", "the update itself is applied");
});

test("an update that names the polity by its name keeps the key and the name", () => {
  const { world } = applyEventImpactsToWorld({
    world: historicalWorld(),
    events: [event({ polityChanges: [update("Abbasidiska kalifatet", { note: "The Barmakids fall." })] })],
  });
  assert.deepEqual(names(world), { "byzantine-empire": "Bysantinska riket", "abbasid-caliphate": "Abbasidiska kalifatet", silla: "Silla" });
  assert.equal(world.regionOwnershipOverrides["region-2"], "abbasid-caliphate");
});

test("a name the polity was given apart from the scenario's is kept too", () => {
  const { world } = applyEventImpactsToWorld({
    world: historicalWorld({ silla: "Unified Silla" }),
    events: [event({ polityChanges: [update("silla", { note: "A quiet year." })] })],
  });
  assert.equal(world.polityOverrides.silla.name, "Unified Silla");
});

test("a save whose labels were overwritten by the ids reads the scenario's names again", () => {
  const world = normalizeWorldState(historicalWorld({ "byzantine-empire": "byzantine-empire", "abbasid-caliphate": "abbasid-caliphate" }));
  assert.deepEqual(names(world), { "byzantine-empire": "Bysantinska riket", "abbasid-caliphate": "Abbasidiska kalifatet", silla: "Silla" });
  // Only the overwritten label is repaired: another name stands.
  assert.equal(normalizeWorldState(historicalWorld({ silla: "Unified Silla" })).polityOverrides.silla.name, "Unified Silla");
});

test("outside a historical package a country is still its name", () => {
  const { world } = applyEventImpactsToWorld({
    world: { polityOverrides: { Germany: override("Germany", "Germany") }, regionOwnershipOverrides: { "DEU.1_1": "Germany" } },
    events: [event({ polityChanges: [update("Germany", { note: "A quiet year." })] })],
  });
  assert.equal(world.polityOverrides.Germany.name, "Germany");
  const stock = normalizeWorldState({ polityOverrides: { "byzantine-empire": override("byzantine-empire", "byzantine-empire") } });
  assert.equal(stock.polityOverrides["byzantine-empire"].name, "byzantine-empire", "no scenario, no repair");
});

test("the map's store makes the same repair, and leaves an unharmed world as the object it was", async () => {
  const { withHistoricalPolityNames } = await import("./historicalPolityNames.js");
  const fs = await import("node:fs");
  const harmed = historicalWorld({ "byzantine-empire": "byzantine-empire" });
  const repaired = withHistoricalPolityNames(harmed.polityOverrides, harmed);
  assert.equal(repaired["byzantine-empire"].name, "Bysantinska riket");
  assert.equal(repaired.silla, harmed.polityOverrides.silla, "an entry that needs nothing is the same object");
  assert.equal(harmed.polityOverrides["byzantine-empire"].name, "byzantine-empire", "the raw world is not written to");
  const sound = historicalWorld();
  assert.equal(withHistoricalPolityNames(sound.polityOverrides, sound), sound.polityOverrides, "the store compares references");
  const stock = { polityOverrides: { Germany: override("Germany", "Germany") } };
  assert.equal(withHistoricalPolityNames(stock.polityOverrides, stock), stock.polityOverrides);
  assert.equal(withHistoricalPolityNames(undefined, sound), undefined);
  // The store reads the raw world (useWorldState.js), not normalizeWorldState.
  const store = fs.readFileSync(new URL("../Game/Map/useWorldState.js", import.meta.url), "utf8");
  assert.match(store, /withHistoricalPolityNames\(state\?\.polityOverrides \?\? EMPTY_OBJECT, state\)/);
});

// Backlog row 30: a rename keeps a historical polity's key.
const keysAndOwners = (world) => [Object.keys(world.polityOverrides), world.regionOwnershipOverrides];

test("an update that repeats the polity's own name renames nothing", () => {
  for (const name of ["Bysantinska riket", "bysantinska riket", "byzantine-empire"]) {
    const { world } = applyEventImpactsToWorld({
      world: historicalWorld(),
      events: [event({ polityChanges: [update("byzantine-empire", { name, note: "A quiet year." })] })],
    });
    assert.deepEqual(keysAndOwners(world), [["byzantine-empire", "abbasid-caliphate", "silla"], { "region-1": "byzantine-empire", "region-2": "abbasid-caliphate" }], name);
    assert.equal(world.polityOverrides["byzantine-empire"].name, "Bysantinska riket", name);
    assert.equal(world.polityOverrides["byzantine-empire"].formerNames, undefined, name);
  }
});

test("a rename changes the label and keeps the key, and both names still find the polity", () => {
  const { world } = applyEventImpactsToWorld({
    world: historicalWorld(),
    events: [
      event({ polityChanges: [update("Bysantinska riket", { name: "Basileia" })] }),
      event({ polityChanges: [update("Basileia", { note: "Under its new name." })] }),
      event({ regionTransfers: [{ regionId: "region-2", toCode: "Bysantinska riket" }] }),
    ],
  });
  assert.deepEqual(Object.keys(world.polityOverrides), ["byzantine-empire", "abbasid-caliphate", "silla"]);
  const renamed = world.polityOverrides["byzantine-empire"];
  assert.equal(renamed.name, "Basileia");
  assert.equal(renamed.code, "byzantine-empire");
  assert.deepEqual(renamed.formerNames, ["Bysantinska riket"]);
  assert.ok(renamed.aliases.includes("Bysantinska riket"));
  assert.equal(renamed.note, "Under its new name.", "the new name finds the polity");
  assert.deepEqual(world.regionOwnershipOverrides, { "region-1": "byzantine-empire", "region-2": "byzantine-empire" }, "and so does the old one");
  // The repair on read leaves a given name alone.
  assert.equal(normalizeWorldState(world).polityOverrides["byzantine-empire"].name, "Basileia");
});

test("a rename to another realm's name is refused", () => {
  for (const name of ["Abbasidiska kalifatet", "abbasid-caliphate", "SILLA"]) {
    const { world } = applyEventImpactsToWorld({
      world: historicalWorld(),
      events: [event({ polityChanges: [update("byzantine-empire", { name })] })],
    });
    assert.deepEqual(names(world), { "byzantine-empire": "Bysantinska riket", "abbasid-caliphate": "Abbasidiska kalifatet", silla: "Silla" }, name);
    assert.deepEqual(world.regionOwnershipOverrides, { "region-1": "byzantine-empire", "region-2": "abbasid-caliphate" }, name);
  }
});

// Found by the review of the rename: the owner resolver was not rebuilt after a label rename, and the test above
// hid it by placing a polity change between the rename and the old name's next use.
test("the old name finds the polity in the very next event, and in the rename's own", () => {
  const next = applyEventImpactsToWorld({
    world: historicalWorld(),
    events: [
      event({ polityChanges: [update("Bysantinska riket", { name: "Basileia" })] }),
      event({ regionTransfers: [{ regionId: "region-2", toCode: "Bysantinska riket" }] }),
    ],
  }).world;
  assert.deepEqual(Object.keys(next.polityOverrides), ["byzantine-empire", "abbasid-caliphate", "silla"], "no second polity under the old name");
  assert.equal(next.regionOwnershipOverrides["region-2"], "byzantine-empire");

  const same = applyEventImpactsToWorld({
    world: historicalWorld(),
    events: [event({
      polityChanges: [update("byzantine-empire", { name: "Basileia" })],
      regionTransfers: [{ regionId: "region-2", toCode: "Bysantinska riket" }],
    })],
  }).world;
  assert.deepEqual(Object.keys(same.polityOverrides), ["byzantine-empire", "abbasid-caliphate", "silla"]);
  assert.equal(same.regionOwnershipOverrides["region-2"], "byzantine-empire");
  assert.equal(same.polityOverrides["byzantine-empire"].name, "Basileia");
});

test("a scenario's polity without a record of its own is renamed by label too", async () => {
  const { renameHistoricalPolity } = await import("./historicalPolityNames.js");
  const world = historicalWorld();
  delete world.polityOverrides.silla;
  const renamed = renameHistoricalPolity(world, "silla", "Gyerim");
  assert.equal(renamed.outcome, "renamed");
  assert.deepEqual([renamed.polityOverrides.silla.name, renamed.polityOverrides.silla.code, renamed.polityOverrides.silla.formerNames], ["Gyerim", "silla", ["Silla"]]);
  assert.equal(renameHistoricalPolity(world, "silla", "silla").outcome, "same");
  assert.equal(renameHistoricalPolity(world, "rebels", "Free Company"), null, "not the scenario's: renamed the upstream way");
  assert.equal(renameHistoricalPolity({ polityOverrides: { Germany: {} } }, "Germany", "Third Reich"), null);
});

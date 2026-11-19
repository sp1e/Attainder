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

// One colour per realm of a historical start.
// Spec: docs/superpowers/specs/2026-11-19-realm-colours-design.md (backlog row 27).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILDER_REALM_COLOURS, EXTRA_REALM_COLOURS, withDistinctPolityColors } from "./historicalPolityColors.js";
import { normalizeWorldState } from "./gameState.js";

const packageWorld = (folder) => JSON.parse(fs.readFileSync(new URL(`../../server/seed/historical/${folder}/scenario.json`, import.meta.url), "utf8")).data.world;
const colours = (overrides) => Object.fromEntries(Object.entries(overrides).map(([id, polity]) => [id, polity.color]));
const world = (pairs) => ({
  historicalScenario: { kind: "historical", polities: pairs.map(([id]) => ({ id, nameSv: id })) },
  polityOverrides: Object.fromEntries(pairs.map(([id, color]) => [id, { aliases: [], code: id, color, name: id, note: "" }])),
});

test("the builder's palette is the one the packages were built with", () => {
  const builder = fs.readFileSync(new URL("../../scripts/build-historical-scenarios.mjs", import.meta.url), "utf8");
  assert.ok(builder.includes(`[${BUILDER_REALM_COLOURS.map((colour) => `'${colour}'`).join(",")}][i % 6]`), "the six colours and their order");
  const all = [...BUILDER_REALM_COLOURS, ...EXTRA_REALM_COLOURS];
  assert.equal(new Set(all).size, all.length, "no extra colour repeats another");
  for (const colour of all) assert.match(colour, /^#[0-9a-f]{6}$/);
});

test("Charlemagne's ten realms get ten colours, and the first holder of each keeps its own", () => {
  const shipped = packageWorld("charlemagne-800");
  const before = colours(shipped.polityOverrides);
  assert.equal(new Set(Object.values(before)).size, 6, "ten realms in six colours as shipped");
  const after = colours(withDistinctPolityColors(shipped.polityOverrides, shipped));
  assert.equal(Object.keys(after).length, 10);
  assert.equal(new Set(Object.values(after)).size, 10);
  const ids = shipped.historicalScenario.polities.map((polity) => polity.id);
  for (const id of ids.slice(0, 6)) assert.equal(after[id], before[id], id);
  assert.deepEqual(ids.slice(6).map((id) => after[id]), EXTRA_REALM_COLOURS.slice(0, 4), "in the scenario's order");
  // The two pairs that border each other on the map.
  assert.notEqual(after["duchy-of-benevento"], after["papal-states"]);
  assert.notEqual(after["kingdom-of-asturias"], after["byzantine-empire"]);
  assert.equal(shipped.polityOverrides["papal-states"].color, before["papal-states"], "the world it was given is not written to");
});

test("a start whose realms already differ comes back as the object it was", () => {
  for (const folder of ["egypt-3000bc", "john-1200", "world-1500"]) {
    const shipped = packageWorld(folder);
    assert.equal(withDistinctPolityColors(shipped.polityOverrides, shipped), shipped.polityOverrides, folder);
  }
  const repaired = packageWorld("charlemagne-800");
  const once = withDistinctPolityColors(repaired.polityOverrides, repaired);
  assert.equal(withDistinctPolityColors(once, { ...repaired, polityOverrides: once }), once, "a repaired save needs nothing more");
});

test("only the builder's shared colours are replaced", () => {
  // A colour someone chose stands, shared or not.
  const chosen = world([["a", "#123456"], ["b", "#123456"], ["c", "#c49b53"], ["d", "#C49B53 "]]);
  assert.deepEqual(colours(withDistinctPolityColors(chosen.polityOverrides, chosen)), { a: "#123456", b: "#123456", c: "#c49b53", d: "#b9728c" });
  // An extra colour a realm already holds is not handed out again.
  const taken = world([["a", "#c49b53"], ["b", "#b9728c"], ["c", "#c49b53"]]);
  assert.equal(withDistinctPolityColors(taken.polityOverrides, taken).c.color, "#c57f45");
  // A polity the scenario does not list (one the model founded) is left alone and does not count.
  const founded = world([["a", "#c49b53"]]);
  founded.polityOverrides.rebels = { code: "rebels", color: "#c49b53", name: "Rebels" };
  assert.equal(withDistinctPolityColors(founded.polityOverrides, founded), founded.polityOverrides);
  // Outside a historical package nothing is touched.
  const stock = { polityOverrides: { Germany: { color: "#c49b53" }, France: { color: "#c49b53" } } };
  assert.equal(withDistinctPolityColors(stock.polityOverrides, stock), stock.polityOverrides);
  assert.equal(withDistinctPolityColors(undefined, chosen), undefined);
});

test("both readers of the world make the repair", () => {
  const shipped = packageWorld("charlemagne-800");
  const normalized = normalizeWorldState(shipped);
  assert.equal(new Set(Object.values(colours(normalized.polityOverrides))).size, 10);
  assert.equal(normalized.polityOverrides["papal-states"].color, EXTRA_REALM_COLOURS[3]);
  const store = fs.readFileSync(new URL("../Game/Map/useWorldState.js", import.meta.url), "utf8");
  assert.match(store, /withDistinctPolityColors\(withHistoricalPolityNames\(state\?\.polityOverrides \?\? EMPTY_OBJECT, state\), state\)/);
});

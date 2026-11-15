// Rulers at their seats. Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 6.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { foreignRulerPerson, medallionOf, seatRulers, seatsOf } from "./seatRulers.js";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const city = (id, owner, coordinates, extra = {}) => ({
  type: "Feature",
  properties: { id, name: id, owner, seat: true, ...extra },
  geometry: { type: "Point", coordinates },
});
const CITIES = {
  type: "FeatureCollection",
  features: [
    city("Aachen", "carolingian-realm", [6.1053, 50.7708]),
    city("Rom", "papal-states", [12.4833, 41.9]),
    city("Konstantinopel", "byzantine-empire", [28.9578, 41.011]),
    city("Ravenna", "carolingian-realm", [12.2, 44.4]),
    city("Pavia", "carolingian-realm", [9.15, 45.18], { seat: false }),
    city("Nowhere", "", [1, 1]),
    city("Chang'an", "tang-empire", [108.9286, 34.2583]),
    { type: "Feature", properties: { id: "x", name: "x", owner: "silla", seat: true }, geometry: null },
    city("Bad", "silla", [Number.NaN, 3]),
  ],
};
const RULER = { id: "person-1-3", name: "Karl", sex: "male", familyId: "f1", portraitState: { identityId: "person-1-3", ageGroup: "adult", visualState: "healthy" } };
const VIEW = {
  identity: { realmName: "Karls rike" },
  ruler: RULER,
  foreignRealms: [
    { id: "byzantine-empire", name: "Bysantinska riket", rulerId: "pbe-eirene", rulerName: "Irene", rulerAge: 50, rulerSex: "female" },
    { id: "papal-states", name: "Kyrkostaten", rulerId: "leo-iii", rulerName: "Leo III", rulerAge: 62, rulerSex: "male" },
  ],
};

test("a seat is a city the package marks as one, with a realm and a point, and a realm has one", () => {
  assert.deepEqual(seatsOf(CITIES), [
    { polityId: "carolingian-realm", cityName: "Aachen", longitude: 6.1053, latitude: 50.7708 },
    { polityId: "papal-states", cityName: "Rom", longitude: 12.4833, latitude: 41.9 },
    { polityId: "byzantine-empire", cityName: "Konstantinopel", longitude: 28.9578, latitude: 41.011 },
    { polityId: "tang-empire", cityName: "Chang'an", longitude: 108.9286, latitude: 34.2583 },
  ]);
  assert.deepEqual(seatsOf(null), []);
  assert.deepEqual(seatsOf({ features: "no" }), []);
});

test("the player's realm shows its own ruler, last so it is drawn over the others", () => {
  const rulers = seatRulers({ cities: CITIES, view: VIEW, playerPolity: "carolingian-realm" });
  assert.deepEqual(rulers.map((entry) => entry.polityId), ["papal-states", "byzantine-empire", "carolingian-realm"]);
  const own = rulers.at(-1);
  assert.equal(own.own, true);
  assert.equal(own.person, RULER);
  assert.deepEqual([own.rulerName, own.realmName, own.cityName], ["Karl", "Karls rike", "Aachen"]);
  assert.deepEqual([own.longitude, own.latitude], [6.1053, 50.7708]);
});

test("a foreign realm shows its ruler when the court keeps it, and a realm it does not keep shows nobody", () => {
  const rulers = seatRulers({ cities: CITIES, view: VIEW, playerPolity: "carolingian-realm" });
  assert.equal(rulers.some((entry) => entry.polityId === "tang-empire"), false, "no court kept, no medallion");
  const pope = rulers.find((entry) => entry.polityId === "papal-states");
  assert.equal(pope.own, false);
  assert.deepEqual([pope.rulerName, pope.realmName, pope.cityName], ["Leo III", "Kyrkostaten", "Rom"]);
  assert.equal(pope.person.name, "Leo III");
});

test("without a court, a ruler or cities there is nothing to show, and no error", () => {
  assert.deepEqual(seatRulers({ cities: CITIES, view: null, playerPolity: "carolingian-realm" }), []);
  assert.deepEqual(seatRulers({ cities: null, view: VIEW, playerPolity: "carolingian-realm" }), []);
  assert.deepEqual(seatRulers(), []);
  const noRuler = seatRulers({ cities: CITIES, view: { ...VIEW, ruler: null }, playerPolity: "carolingian-realm" });
  assert.deepEqual(noRuler.map((entry) => entry.polityId), ["papal-states", "byzantine-empire"], "an empty throne has no face");
  const watching = seatRulers({ cities: CITIES, view: VIEW, playerPolity: "" });
  assert.equal(watching.some((entry) => entry.own), false);
});

test("a foreign ruler takes a shared portrait of the right sex, the same one every time, at the ruler's age", () => {
  const irene = foreignRulerPerson(VIEW.foreignRealms[0]), leo = foreignRulerPerson(VIEW.foreignRealms[1]);
  assert.deepEqual([irene.id, irene.name, irene.sex, irene.age], ["pbe-eirene", "Irene", "female", 50]);
  assert.match(irene.portraitState.fallbackIdentityId, /^person-\d-4$/, "the shared portraits of women end in 4");
  assert.match(leo.portraitState.fallbackIdentityId, /^person-\d-5$/, "and of men in 5");
  assert.equal(irene.portraitState.ageGroup, "adult");
  assert.equal(leo.portraitState.ageGroup, "elder");
  assert.equal(foreignRulerPerson({ ...VIEW.foreignRealms[1], rulerAge: 12 }).portraitState.ageGroup, "child");
  assert.deepEqual(foreignRulerPerson(VIEW.foreignRealms[0]), irene, "the same ruler, the same face");
  const unknown = foreignRulerPerson({ id: "x", name: "X", rulerName: "Aejang" });
  assert.deepEqual(unknown, { name: "Aejang" }, "a save from before the ruler's id was presented shows initials");
  for (const rulerSex of [undefined, null, "", "unknown"]) {
    assert.deepEqual(foreignRulerPerson({ ...VIEW.foreignRealms[0], rulerSex }), { name: "Irene" }, `sex ${rulerSex}: no guess at a face`);
  }
  assert.equal(foreignRulerPerson({ ...VIEW.foreignRealms[1], rulerAge: 0 }).portraitState.ageGroup, "child");
});

test("a medallion is the person's portrait, or initials when there is none", () => {
  const own = medallionOf(RULER);
  assert.ok(["image", "atlas"].includes(own.kind));
  assert.match(own.src, /^\/dynasties\/portraits\//);
  const shared = medallionOf(foreignRulerPerson(VIEW.foreignRealms[1]));
  assert.ok(["image", "atlas"].includes(shared.kind));
  if (shared.kind === "atlas") assert.ok(shared.rect.width > 0 && shared.rect.height > 0 && shared.width > 0);
  assert.deepEqual(medallionOf({ name: "Aejang" }, (text) => text), { kind: "initials", text: "A" });
  assert.deepEqual(medallionOf(null, (text) => text), { kind: "initials", text: "?" });
  // A shared portrait is a child's picture with variants by age. Without the variant an elder would be drawn as a child.
  const childOnly = { people: [{ id: "person-0-5", ageGroup: "child" }] };
  const elder = { name: "Aejang", portraitState: { identityId: "leo", fallbackIdentityId: "person-0-5", ageGroup: "elder", visualState: "healthy" } };
  assert.deepEqual(medallionOf(elder, (text) => text, { atlases: {}, originals: childOnly }), { kind: "initials", text: "A" }, "no picture of the wrong age");
  const child = { ...elder, portraitState: { ...elder.portraitState, ageGroup: "child" } };
  assert.equal(medallionOf(child, (text) => text, { atlases: {}, originals: childOnly }).kind, "image");
});

test("the engine presents a foreign ruler's id and sex, and the map draws the medallions in a historical campaign", () => {
  const engine = fs.readFileSync(new URL("../../../server/characters/foreignRealms.js", import.meta.url), "utf8");
  assert.match(engine, /rulerId: ruler\.id, rulerSex: ruler\.sex,/);
  const world = read("./World.jsx"), component = read("./SeatRulers.jsx"), reader = read("../../runtime/useCourtView.js");
  assert.match(world, /\{historical && <SeatRulers \/>\}/);
  assert.match(component, /useCourtView\(activeGameId\)/);
  assert.match(reader, /await import\("\.\/characterRuntime\.js"\)/, "the character engine is imported on demand");
  assert.doesNotMatch(reader, /^import .*characterRuntime/m);
  assert.match(component, /originalEvent\?\.stopPropagation\(\)/, "a press does not reach the map");
  assert.match(component, /new CustomEvent\("oh:open-characters"\)/);
  assert.match(component, /"oh:cities-updated"/);
  assert.doesNotMatch(component, /oh:characters-updated/, "the court's revision already says when the court moved");
  assert.match(reader, /if \(!hasCourt \|\| transactionPending\) return undefined;/, "the map never starts a recovery");
  assert.match(reader, /\[activeGameId, hasCourt, revision, seen, transactionPending\]/, "another campaign reads again");
  assert.match(component, /setAttribute\("role", "presentation"\)/);
  assert.match(component, /addEventListener\("dblclick", stop\)/);
  assert.match(component, /aria-label=\{label\}/);
});

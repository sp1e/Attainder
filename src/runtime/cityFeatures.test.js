// The map's labels for a package's cities are read through the native book.
// Spec: docs/superpowers/specs/2026-11-18-english-first-design.md (ruling 3).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cityFeaturesAsRead, cityLabelOverrides, cityNameReadings, normalizeCustomCityFeatureCollection } from "./cityFeatures.js";

const point = (city, extra = {}) => ({ type: "Feature", geometry: { type: "Point", coordinates: [10, 50] }, properties: { city, ...extra } });
const book = { Rom: "Rome", Konstantinopel: "Constantinople", "Raqqa och Rafiqa": "Raqqa and Rafiqa", Aachen: "Aachen" };
const read = (text) => book[text] ?? text;
const stored = () => normalizeCustomCityFeatureCollection({ features: [point("Rom"), point("Aachen"), point("Konstantinopel", { tier: 3 }), point("Raqqa och Rafiqa")] });

test("a city's reading is listed under its stored name, only where the reading differs", () => {
  assert.deepEqual(cityNameReadings(stored(), read), { rom: "Rome", konstantinopel: "Constantinople", "raqqa och rafiqa": "Raqqa and Rafiqa" });
  assert.deepEqual(cityNameReadings(stored(), (text) => text), {}, "Swedish reads the stored names");
  assert.deepEqual(cityNameReadings(null, read), {});
  assert.deepEqual(cityNameReadings({ features: [null, {}, point("")] }, read), {});
  // A book that answers nothing leaves the name as it is stored.
  assert.deepEqual(cityNameReadings(stored(), () => ""), {});
  assert.deepEqual(cityNameReadings(stored(), () => undefined), {});
});

test("a rename wins over a reading, whichever of the two names it was made under", () => {
  const readings = cityNameReadings(stored(), read);
  assert.deepEqual(cityLabelOverrides(readings, {}), readings);
  assert.deepEqual(cityLabelOverrides(readings), readings);
  // The engine keys a rename by the lowercased name the model wrote.
  assert.equal(cityLabelOverrides(readings, { konstantinopel: "Miklagard" }).konstantinopel, "Miklagard");
  const underReading = cityLabelOverrides(readings, { constantinople: "Miklagard" });
  assert.equal(underReading.konstantinopel, "Miklagard", "a model that read Constantinople renamed the same city");
  assert.equal(underReading.rom, "Rome");
  assert.deepEqual(cityLabelOverrides({}, { aachen: "Aix" }), { aachen: "Aix" });
});

test("the place search gets the cities under the names the player reads", () => {
  const collection = stored();
  const asRead = cityFeaturesAsRead(collection, cityNameReadings(collection, read));
  assert.deepEqual(asRead.features.map((feature) => feature.properties.city), ["Rome", "Aachen", "Constantinople", "Raqqa and Rafiqa"]);
  assert.deepEqual(asRead.features.map((feature) => feature.properties.name), ["Rome", "Aachen", "Constantinople", "Raqqa and Rafiqa"]);
  assert.equal(asRead.features[2].properties._ohTier, 3, "everything but the name is kept");
  assert.deepEqual(asRead.features[2].geometry, collection.features[2].geometry);
  assert.equal(collection.features[0].properties.city, "Rom", "the stored collection is not changed");
  assert.equal(cityFeaturesAsRead(collection, {}), collection, "nothing to read: the same collection");
});

test("every city of a shipped package has an English reading in the shipped books", () => {
  const lang = new URL("../../public/lang/attainder/", import.meta.url);
  const books = ["en.json", "packages-en.json", "historical-en.json"].map((name) => JSON.parse(fs.readFileSync(new URL(name, lang), "utf8")));
  const historical = new URL("../../server/seed/historical/", import.meta.url);
  const missing = [];
  let cities = 0;
  for (const entry of fs.readdirSync(historical, { withFileTypes: true })) {
    const file = new URL(`${entry.name}/cities.geojson`, historical);
    if (!entry.isDirectory() || !fs.existsSync(file)) continue;
    for (const feature of JSON.parse(fs.readFileSync(file, "utf8")).features) {
      const name = String(feature.properties.city ?? feature.properties.name ?? "").trim();
      cities += 1;
      if (!books.some((entries) => typeof entries[name] === "string" && entries[name].trim())) missing.push(`${entry.name}: ${name}`);
    }
  }
  assert.ok(cities >= 17, "the packages' cities were found");
  assert.deepEqual(missing, []);
});

test("the city layer draws the readings under the renames and hands them to the place search", () => {
  const source = fs.readFileSync(new URL("../Game/Map/Cities.jsx", import.meta.url), "utf8");
  assert.match(source, /cityNameReadings\(customData, \(text\) => readNative\(text, updates\)\)/);
  assert.match(source, /cityLabelExpr\(cityLabelOverrides\(readings, cityRenames\)\)/);
  assert.match(source, /publishCustomCityIndex\(customCityFeatureCount\(customData\) > 0 \? cityFeaturesAsRead\(customData, readings\) : null\)/);
});

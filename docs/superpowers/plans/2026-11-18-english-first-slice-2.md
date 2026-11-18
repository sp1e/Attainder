# English First, Slice 2: The Map's Names. Implementation Plan

**Goal:** In English, the map's labels and the place search show a package's cities under their English names.

**Architecture:** A package stores its cities under Swedish names (`server/seed/historical/<package>/cities.geojson`), and every one of the 17 already has an English reading in the shipped books. The city layer asks the native book for each stored name and puts the readings into the label's match expression, under the AI renames. The stored name stays the key (`world.cityRenames`, `world.cityPopulations`). The place search gets a copy of the collection under the read names.

**Spec:** `docs/superpowers/specs/2026-11-18-english-first-design.md` (ruling 3).

## Global Constraints

- No package file changes: the names are read, not rewritten.
- In Swedish nothing changes: no reading differs, the label expression and the search rows are what they were.
- A name is read with `readNative(text, updates)`, so the build's React Compiler draws it again when the book arrives.

## Review Focus

- The book arrives after the layer is drawn: the labels change when `i18n:updated` is announced.
- An AI rename made under the English name (`constantinople`) reaches the city stored as `Konstantinopel`.
- A book that answers nothing, or the same text, for a name: the stored name stands.
- A scenario without custom cities (stock tiles): nothing is read and nothing is published.
- A package city without an English reading: a test over the shipped packages and books fails.

## Task 1: Readings

**Files:**
- Modify: `src/runtime/cityFeatures.js`
- Test: `src/runtime/cityFeatures.test.js` (new)

**Interfaces:**
- Produces:
  - `cityNameReadings(collection, read: (text) => string): { [lowercasedStoredName]: reading }`
  - `cityLabelOverrides(readings, renames = {}): { [lowercasedName]: label }`
  - `cityFeaturesAsRead(collection, readings): FeatureCollection` (the same object when `readings` is empty)

- [ ] Tests: the three functions on `Rom`, `Aachen`, `Konstantinopel`, `Raqqa och Rafiqa`; a rename under either name; the search copy leaves the stored collection untouched; every shipped package city has a reading in `en.json`, `packages-en.json` or `historical-en.json`.
- [ ] Run `node --test src/runtime/cityFeatures.test.js`: fails on the missing exports.
- [ ] Implement the three functions.

## Task 2: The city layer

**Files:**
- Modify: `src/Game/Map/Cities.jsx`
- Test: `src/runtime/cityFeatures.test.js` (a source test of the three call sites)

- [ ] `readings = cityNameReadings(customData, (text) => readNative(text, updates))`, `label = cityLabelExpr(cityLabelOverrides(readings, cityRenames))`.
- [ ] The place search is published from an effect on `customData` and `readings`: `cityFeaturesAsRead(customData, readings)`, or `null` for an empty collection.

## Task 3: Checks

- [ ] eslint on the three files, `npm run build`, the full suite alone.
- [ ] Browser, production build, the Charlemagne test campaign in English: the label reads `Constantinople`; the place search finds `Constantinople` as a city in the world.

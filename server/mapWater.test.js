// The painted water of a historical campaign's map. Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 4.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MODERN_LAKES, OUTPUT_DIR, SOURCES, buildLakes, buildSea, buildWaterFiles, sha256,
} from "../scripts/build-map-water.mjs";

const repoFile = (relative) => new URL(`../${relative}`, import.meta.url);
const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const feature = (properties, coordinates) => ({ type: "Feature", properties, geometry: { type: "Polygon", coordinates } });

const inRing = ([x, y], points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inPolygon = (point, polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole));
const polygonsOf = (geometry) => (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : []);
const kindOf = (collection, kind) => collection.features.find((entry) => entry.properties.kind === kind);
// Twice the signed area of a closed line: positive when counter-clockwise.
const turning = (line) => line.slice(1).reduce((sum, point, index) => sum + (line[index][0] * point[1] - point[0] * line[index][1]), 0);
const covers = (collection, point) => collection.features.some((entry) => polygonsOf(entry.geometry).some((polygon) => inPolygon(point, polygon)));

test("the sea is the world box with the land taken out", () => {
  const sea = buildSea({ type: "FeatureCollection", features: [feature({}, [ring(0, 0, 10, 10)])] });
  assert.deepEqual(sea.features.map((entry) => [entry.properties.kind, entry.geometry.type]), [["sea", "MultiPolygon"], ["coast", "MultiLineString"]]);
  const coast = kindOf(sea, "coast").geometry.coordinates;
  assert.equal(coast.length, 1, "the island's shore, and nothing of the world box");
  assert.equal(coast[0].length, 5);
  assert.ok(turning(coast[0]) < 0, "clockwise round the land: the water is on the left");
  assert.equal(covers(sea, [5, 5]), false, "the land is a hole in the sea");
  assert.equal(covers(sea, [20, 20]), true);
  assert.equal(covers(sea, [-179, 84]), true, "the box reaches the edge of the Mercator map");
  assert.equal(covers(buildSea({ features: [] }), [0, 0]), true, "no land, all sea");
});

test("a reservoir and a lake a dam made are left out, and a lake keeps only its name", () => {
  const square = [ring(0, 0, 1.23456, 1)];
  const lakes = buildLakes({
    features: [
      feature({ featurecla: "Lake", name: "Lake Geneva", scalerank: 1, name_sv: "Genèvesjön" }, square),
      feature({ featurecla: "Reservoir", name: "Lake Volta" }, square),
      feature({ featurecla: "Lake", name: "Cabonga Reservoir" }, square),
      feature({ featurecla: "Lake", name: "Lake Tharthar" }, square),
      feature({ featurecla: "Alkaline Lake", name: null }, square),
      { type: "Feature", properties: { featurecla: "Lake", name: "A point" }, geometry: { type: "Point", coordinates: [0, 0] } },
    ],
  });
  assert.deepEqual(lakes.features.map((entry) => entry.properties), [{ name: "Lake Geneva" }, { name: "" }]);
  assert.deepEqual(lakes.features[0].geometry.coordinates[0][1], [1.235, 0], "three decimals");
  assert.ok(MODERN_LAKES.includes("Lake Nasser") && MODERN_LAKES.includes("Salton Sea"));
  assert.equal(MODERN_LAKES.length, 8);
});

const built = buildWaterFiles();

test("the water files on disk are what the pinned sources give", () => {
  for (const [name, text] of Object.entries(built)) {
    assert.equal(readFileSync(repoFile(`${OUTPUT_DIR}/${name}`), "utf8"), text, `${OUTPUT_DIR}/${name}: run node scripts/build-map-water.mjs`);
  }
  const manifest = JSON.parse(built["water.json"]);
  assert.equal(manifest.files["sea.geojson"].sha256, sha256(built["sea.geojson"]));
  assert.equal(manifest.files["lakes.geojson"].sha256, sha256(built["lakes.geojson"]));
  assert.deepEqual(manifest.sources, SOURCES);
});

test("the lakes' source has a record that names its bytes", () => {
  const record = JSON.parse(readFileSync(repoFile("server/seed/historical/sources/lakes-source.json"), "utf8"));
  const bytes = readFileSync(repoFile(SOURCES.lakes.file));
  assert.equal(record.sha256, SOURCES.lakes.sha256);
  assert.equal(sha256(bytes), record.sha256);
  assert.equal(bytes.length, record.bytes);
  assert.match(record.url, /natural-earth-vector\/.+\/geojson\/ne_50m_lakes\.geojson$/);
});

test("open water is sea, a capital inland is not, and the lakes are the old ones", () => {
  const sea = JSON.parse(built["sea.geojson"]), lakes = JSON.parse(built["lakes.geojson"]);
  assert.equal(covers(sea, [-30, 40]), true, "the mid-Atlantic");
  assert.equal(covers(sea, [18, 35]), true, "the Mediterranean south of Italy");
  assert.equal(covers(sea, [2.35, 48.85]), false, "Paris");
  assert.equal(covers(sea, [6.08, 50.77]), false, "Aachen");
  const onEdge = ([x, y]) => Math.abs(x) === 180 || Math.abs(y) === 85;
  const coast = kindOf(sea, "coast").geometry.coordinates;
  assert.ok(coast.length > 1000, "every island has a shore");
  assert.equal(coast.filter((line) => line.slice(1).some((point, index) => onEdge(point) && onEdge(line[index]))).length, 0, "no line along the edge of the world");
  const names = new Set(lakes.features.map((entry) => entry.properties.name));
  for (const name of ["Lake Geneva", "Vänern", "Lake Victoria", "Lake Baikal"]) assert.ok(names.has(name), name);
  for (const name of ["Lake Volta", "Lake Mead", "Lake Nasser", "Rybinsk Reservoir", "Lago Gatun"]) assert.equal(names.has(name), false, name);
  assert.equal(lakes.features.length, 352);
  assert.ok(lakes.features.every((entry) => Object.keys(entry.properties).join() === "name"));
  assert.equal(covers(lakes, [6.5, 46.45]), true, "Lake Geneva is where it is");
});

test("a shore that crosses the edge of the world is one line where the ring began in open coast", () => {
  // The land reaches the top of the box, so the sea's ring runs along the box edge between the land's two sides.
  const sea = buildSea({ type: "FeatureCollection", features: [feature({}, [ring(-10, 60, 10, 90)])] });
  const coast = kindOf(sea, "coast").geometry.coordinates;
  const onEdge = ([x, y]) => Math.abs(x) === 180 || Math.abs(y) === 85;
  assert.equal(coast.length, 1, "the shore is not cut at the ring's first vertex");
  assert.equal(coast[0].length, 4, "down one side, along the south shore, up the other");
  assert.ok(onEdge(coast[0][0]) && onEdge(coast[0].at(-1)), "it begins and ends where it meets the edge");
  assert.equal(coast[0].slice(1).some((point, index) => onEdge(point) && onEdge(coast[0][index])), false);
});

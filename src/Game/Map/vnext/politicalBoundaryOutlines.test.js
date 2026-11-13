/*! Open Historia — realm outline tests for the political boundary state © 2026 Open Historia contributors, AGPL-3.0-or-later (see LICENSE). */
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPoliticalBoundaryTopology,
  createPoliticalBoundaryState,
  politicalBoundaryStateCollection,
  stitchDirectedSegments,
  updatePoliticalBoundaryState,
} from "./politicalBoundaryTopology.js";

const OPTIONS = { precision: 1000, matchTolerance: 1 };

// Counter-clockwise, as RFC 7946 asks of an exterior ring.
const ringOf = (x0, x1, y0 = 0, y1 = 1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const square = (id, owner, x0, x1, y0 = 0, y1 = 1) => ({
  type: "Feature",
  properties: { id, owner },
  geometry: { type: "Polygon", coordinates: [ringOf(x0, x1, y0, y1)] },
});
const collection = (...features) => ({ type: "FeatureCollection", features });

const stateOf = (regions, overrides = {}, options = { outlines: true }) => {
  const topology = buildPoliticalBoundaryTopology(regions, OPTIONS);
  return createPoliticalBoundaryState(topology, overrides, options);
};
const featuresOf = (state) => politicalBoundaryStateCollection(state).features;
const pick = (features, className, owner) => features.find(
  (feature) => feature.properties.class === className && feature.properties.owner0 === owner,
);
const segmentsOf = (feature) => (feature?.geometry?.coordinates ?? []).flatMap(
  (line) => line.slice(1).map((point, index) => [line[index], point]),
);
// Twice the signed area of the lines taken as one ring: positive when counter-clockwise.
const turning = (feature) => segmentsOf(feature).reduce((sum, [a, b]) => sum + (a[0] * b[1] - b[0] * a[1]), 0);
const onMeridian = (feature, x) => segmentsOf(feature).filter(([a, b]) => a[0] === x && b[0] === x);

// Where a point lies off the edge a → b of the topology: 1 to the right, -1 to the left.
const sideOfPoint = (topology, edge, [px, py]) => {
  const ax = topology.pointX[topology.a[edge]], ay = topology.pointY[topology.a[edge]];
  const bx = topology.pointX[topology.b[edge]], by = topology.pointY[topology.b[edge]];
  const cross = (bx - ax) * (py * OPTIONS.precision - ay) - (by - ay) * (px * OPTIONS.precision - ax);
  return cross < 0 ? 1 : -1;
};

test("the topology records which side of each edge its first region lies on, whatever the winding", () => {
  const counter = buildPoliticalBoundaryTopology(collection(square("a", "A", 0, 1)), OPTIONS);
  const clockwise = buildPoliticalBoundaryTopology(collection({
    ...square("a", "A", 0, 1),
    geometry: { type: "Polygon", coordinates: [[...ringOf(0, 1)].reverse()] },
  }), OPTIONS);
  for (const topology of [counter, clockwise]) {
    assert.equal(topology.side1.length, topology.a.length);
    assert.equal(topology.a.length, 4);
    for (let edge = 0; edge < topology.a.length; edge += 1) {
      assert.equal(topology.side1[edge], sideOfPoint(topology, edge, [0.5, 0.5]), `edge ${edge}`);
    }
  }
});

test("a hole's edges have the region on the side away from the hole", () => {
  for (const hole of [[...ringOf(1, 2, 1, 2)].reverse(), ringOf(1, 2, 1, 2)]) {
    const topology = buildPoliticalBoundaryTopology(collection({
      type: "Feature",
      properties: { id: "a", owner: "A" },
      geometry: { type: "Polygon", coordinates: [ringOf(0, 3, 0, 3), hole] },
    }), OPTIONS);
    let holeEdges = 0;
    for (let edge = 0; edge < topology.a.length; edge += 1) {
      const xs = [topology.pointX[topology.a[edge]], topology.pointX[topology.b[edge]]];
      const ys = [topology.pointY[topology.a[edge]], topology.pointY[topology.b[edge]]];
      const inner = [...xs, ...ys].every((value) => value === 1000 || value === 2000);
      if (!inner) continue;
      holeEdges += 1;
      assert.equal(topology.side1[edge], -sideOfPoint(topology, edge, [1.5, 1.5]), `hole edge ${edge}`);
    }
    assert.equal(holeEdges, 4);
  }
});

test("directed stitching joins head to tail and never turns a segment round", () => {
  const joined = stitchDirectedSegments([
    { a: [1000, 0], b: [1000, 1000] },
    { a: [0, 0], b: [1000, 0] },
  ], 1000);
  assert.deepEqual(joined, [[[0, 0], [1, 0], [1, 1]]]);

  const facing = stitchDirectedSegments([
    { a: [0, 0], b: [1000, 0] },
    { a: [2000, 0], b: [1000, 0] },
  ], 1000);
  assert.deepEqual(facing, [[[0, 0], [1, 0]], [[2, 0], [1, 0]]]);
});

test("a realm alone gets one closed frontier with the realm on its right", () => {
  const features = featuresOf(stateOf(collection(square("a", "", 0, 1), square("b", "B", 1, 2), square("c", "", 2, 3))));
  assert.deepEqual(features.map((feature) => feature.properties.class), ["polity-frontier"]);
  const frontier = pick(features, "polity-frontier", "B");
  assert.equal(frontier.geometry.type, "MultiLineString");
  assert.equal(frontier.geometry.coordinates.length, 1, "one chain");
  const [line] = frontier.geometry.coordinates;
  assert.equal(line.length, 5);
  assert.deepEqual(line[0], line.at(-1), "closed");
  assert.ok(turning(frontier) < 0, "clockwise in lng/lat: the realm is on the right of travel");
  assert.deepEqual(frontier.properties.ownerList, ["B"]);
  assert.equal(frontier.properties.owners, "B");
  assert.match(String(frontier.id), /^polity-outline:/);
});

test("two realms side by side each get their side of the shared border, and the border itself is unchanged", () => {
  const regions = collection(square("a", "A", 0, 1), square("b", "B", 1, 2));
  const plain = featuresOf(stateOf(regions, {}, {}));
  const features = featuresOf(stateOf(regions));

  assert.deepEqual(plain.map((feature) => feature.properties.class), ["polity-boundary"]);
  assert.deepEqual(features.filter((feature) => feature.properties.class === "polity-boundary"), plain);
  assert.equal(features.length, 5);

  // A lies west of the meridian x = 1, so with A on the right the line runs south.
  assert.deepEqual(pick(features, "polity-side", "A").geometry.coordinates, [[[1, 1], [1, 0]]]);
  assert.deepEqual(pick(features, "polity-side", "B").geometry.coordinates, [[[1, 0], [1, 1]]]);
  for (const owner of ["A", "B"]) {
    const frontier = pick(features, "polity-frontier", owner);
    assert.equal(segmentsOf(frontier).length, 3);
    assert.equal(onMeridian(frontier, 1).length, 0, "the shared edge is not a frontier");
    assert.ok(turning(frontier) + turning(pick(features, "polity-side", owner)) < 0);
  }
  assert.equal(new Set(features.map((feature) => String(feature.id))).size, features.length, "ids are unique");
});

test("state made without outlines carries none", () => {
  const regions = collection(square("a", "A", 0, 1), square("b", "", 1, 2));
  assert.deepEqual(featuresOf(stateOf(regions, {}, {})), []);
  const topology = buildPoliticalBoundaryTopology(regions, OPTIONS);
  assert.deepEqual(featuresOf(createPoliticalBoundaryState(topology, {})), []);
});

test("an ownership change moves the frontier in the same patch", () => {
  const state = stateOf(collection(square("a", "A", 0, 1), square("b", "", 1, 2), square("c", "C", 2, 3)));
  assert.equal(onMeridian(pick(featuresOf(state), "polity-frontier", "A"), 1).length, 1);

  const grown = updatePoliticalBoundaryState(state, { b: "A" }, ["b"]);
  const after = featuresOf(state);
  const frontier = pick(after, "polity-frontier", "A");
  assert.equal(onMeridian(frontier, 1).length, 0, "the old edge is inside the realm now");
  assert.equal(onMeridian(frontier, 2).length, 0, "the edge against C is a border, not a frontier");
  assert.deepEqual(pick(after, "polity-side", "A").geometry.coordinates, [[[2, 1], [2, 0]]]);
  assert.deepEqual(pick(after, "polity-side", "C").geometry.coordinates, [[[2, 0], [2, 1]]]);
  assert.ok(after.some((feature) => feature.properties.owners === "A | C"));
  const upserted = grown.patch.upsert.map((feature) => String(feature.id));
  assert.ok(upserted.includes(String(frontier.id)));
  assert.ok(upserted.includes(String(pick(after, "polity-side", "C").id)));
});

test("a realm that loses its last region has its outline removed", () => {
  const state = stateOf(collection(square("a", "A", 0, 1), square("b", "", 1, 2)));
  const frontierId = String(pick(featuresOf(state), "polity-frontier", "A").id);
  const gone = updatePoliticalBoundaryState(state, { a: "" }, ["a"]);
  assert.deepEqual(featuresOf(state), []);
  assert.ok(gone.patch.removeIds.includes(frontierId));
});

// The right-hand square has one more vertex on the shared edge, as two regions simplified apart do.
const mismatched = (owner) => ({
  type: "Feature",
  properties: { id: "b", owner },
  geometry: { type: "Polygon", coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0.5], [1, 0]]] },
});

test("two regions of one realm that touch without shared vertices have no line between them", () => {
  const state = stateOf(collection(square("a", "A", 0, 1), mismatched("A")));
  assert.ok(state.topology.recoveredA.length > 0, "the overlap was recovered");
  assert.equal(state.topology.recoveredEdge1.length, state.topology.recoveredA.length);
  const features = featuresOf(state);
  assert.deepEqual(features.map((feature) => feature.properties.class), ["polity-frontier"]);
  assert.equal(onMeridian(features[0], 1).length, 0);
});

test("two realms that touch without shared vertices get sides, and a change of owner reaches the neighbour's edge", () => {
  const state = stateOf(collection(square("a", "A", 0, 1), mismatched("B")));
  const features = featuresOf(state);
  assert.equal(onMeridian(pick(features, "polity-frontier", "A"), 1).length, 0);
  assert.equal(onMeridian(pick(features, "polity-side", "A"), 1).length, 1);
  assert.equal(onMeridian(pick(features, "polity-side", "B"), 1).length, 2);

  updatePoliticalBoundaryState(state, { b: "" }, ["b"]);
  const after = featuresOf(state);
  assert.equal(pick(after, "polity-side", "A"), undefined);
  assert.equal(onMeridian(pick(after, "polity-frontier", "A"), 1).length, 1, "A's edge is a frontier once B is gone");
});

test("an edge two parts of one region share is inside the realm and gets no line", () => {
  const state = stateOf(collection({
    type: "Feature",
    properties: { id: "a", owner: "A" },
    geometry: { type: "MultiPolygon", coordinates: [[ringOf(0, 1)], [ringOf(1, 2)]] },
  }));
  const features = featuresOf(state);
  assert.deepEqual(features.map((feature) => feature.properties.class), ["polity-frontier"]);
  assert.equal(onMeridian(features[0], 1).length, 0);
  assert.equal(segmentsOf(features[0]).length, 6);
  assert.ok(turning(features[0]) < 0);
});

test("a ring with no area has no side, so it gets no outline", () => {
  const features = featuresOf(stateOf(collection({
    type: "Feature",
    properties: { id: "a", owner: "A" },
    geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [2, 0], [0, 0]]] },
  })));
  assert.deepEqual(features, []);
});

test("an edge three regions lie on counts every realm beyond it", () => {
  // c lies exactly over the unowned b, so the meridian x = 1 carries a, b and c.
  const state = stateOf(collection(square("a", "A", 0, 1), square("b", "", 1, 2), square("c", "C", 1, 2)));
  const features = featuresOf(state);
  assert.equal(onMeridian(pick(features, "polity-side", "A"), 1).length, 1, "A meets C there, though C's region is the third");
  assert.equal(onMeridian(pick(features, "polity-frontier", "A"), 1).length, 0);
});

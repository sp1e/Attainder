/*! Open Historia — worker-owned political boundary topology © 2026 Open Historia contributors, AGPL-3.0-or-later (see LICENSE). */
import { toCountryName } from "../../../runtime/ownerNames.js";

const DEFAULT_PRECISION = 2e5;
const DEFAULT_MATCH_TOLERANCE = 500;
const DEFAULT_MATCH_GRID_SIZE = 0.25;
const MAX_NUMERIC_KEY_PRECISION = 370000;
const POINT_ID_SPAN = 2 ** 26;
const EMPTY_FEATURE_COLLECTION = Object.freeze({ type: "FeatureCollection", features: [] });

const polygonsOf = (geometry) => {
  if (geometry?.type === "Polygon") return [geometry.coordinates];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates;
  return [];
};

const pointKey = (point) => `${point[0]},${point[1]}`;
const comparePoints = (left, right) => left[0] !== right[0] ? left[0] - right[0] : left[1] - right[1];
const edgeKey = (left, right) => comparePoints(left, right) <= 0
  ? `${pointKey(left)}|${pointKey(right)}`
  : `${pointKey(right)}|${pointKey(left)}`;
const coordinateOf = (point, precision) => [point[0] / precision, point[1] / precision];

// MapLibre updateData requires globally unique feature IDs. A short 32-bit
// hash is stable but not collision-free, which could make one unrelated
// frontier overwrite another. Owner-group keys are already small, so keep the
// exact key in a length-prefixed deterministic ID instead of probabilistic hash.
const stableId = (prefix, value) => {
  const text = String(value ?? "");
  return `${prefix}:${text.length}:${text}`;
};

const overlappingRun = (ax, ay, bx, by, cx, cy, dx, dy, tolerance) => {
  const ex = bx - ax;
  const ey = by - ay;
  const lengthSquared = ex * ex + ey * ey;
  if (lengthSquared <= tolerance * tolerance) return null;
  const length = Math.sqrt(lengthSquared);
  const distanceFromLine = (x, y) => Math.abs(ex * (y - ay) - ey * (x - ax)) / length;
  if (distanceFromLine(cx, cy) > tolerance || distanceFromLine(dx, dy) > tolerance) return null;
  const project = (x, y) => ((x - ax) * ex + (y - ay) * ey) / lengthSquared;
  const rightA = project(cx, cy);
  const rightB = project(dx, dy);
  const start = Math.max(0, Math.min(rightA, rightB));
  const end = Math.min(1, Math.max(rightA, rightB));
  if ((end - start) * length <= tolerance) return null;
  const at = (position) => [Math.round(ax + ex * position), Math.round(ay + ey * position)];
  return { a: at(start), b: at(end) };
};

// Exported for the group-area outline (groupAreas.js), which walks the same
// edges for a different question.
export const stitchSegments = (segments, precision) => {
  const touching = new Map();
  const addTouch = (key, index) => {
    const entries = touching.get(key);
    if (entries) entries.push(index);
    else touching.set(key, [index]);
  };
  for (let index = 0; index < segments.length; index += 1) {
    addTouch(pointKey(segments[index].a), index);
    addTouch(pointKey(segments[index].b), index);
  }
  const visited = new Uint8Array(segments.length);
  const chains = [];
  const walk = (startIndex, startKey) => {
    const line = [];
    let segmentIndex = startIndex;
    let currentKey = startKey;
    while (segmentIndex !== undefined && !visited[segmentIndex]) {
      const segment = segments[segmentIndex];
      visited[segmentIndex] = 1;
      const aKey = pointKey(segment.a);
      const from = aKey === currentKey ? segment.a : segment.b;
      const to = aKey === currentKey ? segment.b : segment.a;
      if (!line.length) line.push(coordinateOf(from, precision));
      line.push(coordinateOf(to, precision));
      currentKey = pointKey(to);
      const candidates = (touching.get(currentKey) ?? []).filter((index) => !visited[index]);
      segmentIndex = candidates.length === 1 ? candidates[0] : undefined;
    }
    if (line.length >= 2) chains.push(line);
  };
  for (let index = 0; index < segments.length; index += 1) {
    if (visited[index]) continue;
    const segment = segments[index];
    const aKey = pointKey(segment.a);
    const bKey = pointKey(segment.b);
    const aDegree = touching.get(aKey)?.length ?? 0;
    const bDegree = touching.get(bKey)?.length ?? 0;
    if (aDegree !== 2 || bDegree !== 2) walk(index, aDegree !== 2 ? aKey : bKey);
  }
  for (let index = 0; index < segments.length; index += 1) {
    if (!visited[index]) walk(index, pointKey(segments[index].a));
  }
  return chains;
};

/**
 * Join directed segments head to tail. No segment is ever turned round, so a
 * chain keeps whatever lies to the right of its segments on its right: a realm's
 * outline is drawn inside the realm through `line-offset`.
 */
export const stitchDirectedSegments = (segments, precision) => {
  const leaving = new Map();
  const arrivals = new Map();
  for (let index = 0; index < segments.length; index += 1) {
    const from = pointKey(segments[index].a);
    const to = pointKey(segments[index].b);
    const entries = leaving.get(from);
    if (entries) entries.push(index);
    else leaving.set(from, [index]);
    arrivals.set(to, (arrivals.get(to) ?? 0) + 1);
  }
  const visited = new Uint8Array(segments.length);
  const chains = [];
  const walk = (startIndex) => {
    const line = [coordinateOf(segments[startIndex].a, precision)];
    let index = startIndex;
    while (index !== undefined && !visited[index]) {
      visited[index] = 1;
      line.push(coordinateOf(segments[index].b, precision));
      const next = (leaving.get(pointKey(segments[index].b)) ?? []).filter((candidate) => !visited[candidate]);
      index = next.length === 1 ? next[0] : undefined;
    }
    chains.push(line);
  };
  // Open chains from their heads, then from junctions, and closed rings last.
  const startsAt = (index, test) => !visited[index] && test(pointKey(segments[index].a));
  const passes = [
    (key) => !arrivals.has(key),
    (key) => arrivals.get(key) !== 1 || leaving.get(key).length !== 1,
    () => true,
  ];
  for (const test of passes) {
    for (let index = 0; index < segments.length; index += 1) {
      if (startsAt(index, test)) walk(index);
    }
  }
  return chains;
};

// Twice the signed area of a ring in lng/lat: positive when counter-clockwise.
const ringTurning = (ring) => {
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const from = ring[index];
    const to = ring[(index + 1) % ring.length];
    sum += Number(from?.[0]) * Number(to?.[1]) - Number(to?.[0]) * Number(from?.[1]);
  }
  return Number.isFinite(sum) ? sum : 0;
};

/**
 * Build geometry-only frontier topology once per authored map. Ownership is
 * deliberately absent from this index so later political changes can be
 * classified without re-reading millions of polygon vertices.
 */
export const buildPoliticalBoundaryTopology = (
  regions,
  {
    precision = DEFAULT_PRECISION,
    matchTolerance = DEFAULT_MATCH_TOLERANCE,
    matchGridSize = DEFAULT_MATCH_GRID_SIZE,
  } = {},
) => {
  const features = Array.isArray(regions?.features) ? regions.features : [];
  const regionIds = [];
  const baseOwners = [];
  const X_OFFSET = 180 * precision;
  const Y_OFFSET = 90 * precision;
  const Y_SPAN = 180 * precision + 1;
  const numericKeys = precision <= MAX_NUMERIC_KEY_PRECISION;
  const pointKeyOf = (x, y) => numericKeys ? (x + X_OFFSET) * Y_SPAN + (y + Y_OFFSET) : `${x},${y}`;

  const pointIds = new Map();
  const pointX = [];
  const pointY = [];
  const internPoint = (coordinate) => {
    const lng = Number(coordinate?.[0]);
    const lat = Number(coordinate?.[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return -1;
    const x = Math.max(-X_OFFSET, Math.min(X_OFFSET, Math.round(lng * precision)));
    const y = Math.max(-Y_OFFSET, Math.min(Y_OFFSET, Math.round(lat * precision)));
    const key = pointKeyOf(x, y);
    const existing = pointIds.get(key);
    if (existing !== undefined) return existing;
    const id = pointX.length;
    pointIds.set(key, id);
    pointX.push(x);
    pointY.push(y);
    return id;
  };

  const edgeIds = new Map();
  const a = [];
  const b = [];
  const region1 = [];
  const region2 = [];
  // 1 when region1 lies to the right of a -> b, -1 when to the left, 0 when it has no one side: a ring without
  // area, or an edge two parts of the same region share. Geometry only: a realm's outline is drawn inside the
  // realm, and this says which side that is.
  const side1 = [];
  const extra = new Map();
  let skippedFeatureCount = 0;

  for (let featureIndex = 0; featureIndex < features.length; featureIndex += 1) {
    const feature = features[featureIndex];
    const props = feature?.properties ?? {};
    regionIds[featureIndex] = String(props.id ?? props.GID_1 ?? feature?.id ?? featureIndex);
    baseOwners[featureIndex] = toCountryName(props.owner ?? "");
    const polygons = polygonsOf(feature?.geometry);
    if (!polygons.length) {
      skippedFeatureCount += 1;
      continue;
    }
    for (const polygon of polygons) {
      for (let ringIndex = 0; ringIndex < (polygon?.length ?? 0); ringIndex += 1) {
        const ring = polygon[ringIndex];
        if (!Array.isArray(ring) || ring.length < 2) continue;
        // Walking an exterior ring counter-clockwise, or a hole clockwise, keeps the region on the left.
        const turning = ringTurning(ring);
        const regionOnLeft = (turning > 0) === (ringIndex === 0);
        let previous = internPoint(ring[0]);
        for (let vertex = 1; vertex < ring.length; vertex += 1) {
          const current = internPoint(ring[vertex]);
          if (previous < 0 || current < 0 || previous === current) {
            previous = current;
            continue;
          }
          const lo = Math.min(previous, current);
          const hi = Math.max(previous, current);
          const key = lo * POINT_ID_SPAN + hi;
          const existing = edgeIds.get(key);
          if (existing === undefined) {
            edgeIds.set(key, a.length);
            a.push(lo);
            b.push(hi);
            region1.push(featureIndex);
            region2.push(-1);
            side1.push(turning === 0 ? 0 : (previous === lo) !== regionOnLeft ? 1 : -1);
          } else if (region1[existing] === featureIndex) {
            side1[existing] = 0;
          } else if (region2[existing] !== featureIndex) {
            if (region2[existing] === -1) region2[existing] = featureIndex;
            else {
              const more = extra.get(existing);
              if (more) more.add(featureIndex);
              else extra.set(existing, new Set([featureIndex]));
            }
          }
          previous = current;
        }
      }
    }
  }

  // Recover shared frontiers whose independently simplified sides do not use
  // identical vertices. This is geometry-only: keep same-owner adjacencies too,
  // because a future ownership change can turn one into a political frontier.
  const candidates = [];
  for (let edge = 0; edge < a.length; edge += 1) {
    if (region2[edge] === -1 && !extra.has(edge)) candidates.push(edge);
  }
  const gridSize = Math.max(matchTolerance * 4, Math.round(matchGridSize * precision));
  const MAX_CELLS_PER_SEGMENT = 2048;
  const CELL_OFFSET = 4096;
  const CELL_SPAN = 8192;
  const count = candidates.length;
  const minXs = new Int32Array(count);
  const maxXs = new Int32Array(count);
  const minYs = new Int32Array(count);
  const maxYs = new Int32Array(count);
  const usable = new Uint8Array(count);
  const grid = new Map();

  for (let slot = 0; slot < count; slot += 1) {
    const edge = candidates[slot];
    const ax = pointX[a[edge]];
    const ay = pointY[a[edge]];
    const bx = pointX[b[edge]];
    const by = pointY[b[edge]];
    const minX = Math.floor((Math.min(ax, bx) - matchTolerance) / gridSize);
    const maxX = Math.floor((Math.max(ax, bx) + matchTolerance) / gridSize);
    const minY = Math.floor((Math.min(ay, by) - matchTolerance) / gridSize);
    const maxY = Math.floor((Math.max(ay, by) + matchTolerance) / gridSize);
    if ((maxX - minX + 1) * (maxY - minY + 1) > MAX_CELLS_PER_SEGMENT) continue;
    minXs[slot] = minX; maxXs[slot] = maxX; minYs[slot] = minY; maxYs[slot] = maxY; usable[slot] = 1;
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = (x + CELL_OFFSET) * CELL_SPAN + (y + CELL_OFFSET);
        const entries = grid.get(key);
        if (entries) entries.push(slot);
        else grid.set(key, [slot]);
      }
    }
  }

  const recoveredA = [];
  const recoveredB = [];
  const recoveredRegion1 = [];
  const recoveredRegion2 = [];
  const recoveredEdge1 = [];
  const recoveredEdge2 = [];
  const recoveredSeen = new Set();
  for (const [key, entries] of grid) {
    if (entries.length < 2) continue;
    const cellX = Math.floor(key / CELL_SPAN) - CELL_OFFSET;
    const cellY = (key % CELL_SPAN) - CELL_OFFSET;
    for (let i = 0; i < entries.length; i += 1) {
      const slot = entries[i];
      const edge = candidates[slot];
      const firstRegion = region1[edge];
      const ax = pointX[a[edge]];
      const ay = pointY[a[edge]];
      const bx = pointX[b[edge]];
      const by = pointY[b[edge]];
      for (let j = i + 1; j < entries.length; j += 1) {
        const otherSlot = entries[j];
        const other = candidates[otherSlot];
        const secondRegion = region1[other];
        if (firstRegion === secondRegion || !usable[slot] || !usable[otherSlot]) continue;
        if (Math.max(minXs[slot], minXs[otherSlot]) !== cellX) continue;
        if (Math.max(minYs[slot], minYs[otherSlot]) !== cellY) continue;
        const overlap = overlappingRun(
          ax, ay, bx, by,
          pointX[a[other]], pointY[a[other]], pointX[b[other]], pointY[b[other]],
          matchTolerance,
        );
        if (!overlap) continue;
        const pairKey = `${Math.min(firstRegion, secondRegion)}:${Math.max(firstRegion, secondRegion)}:${edgeKey(overlap.a, overlap.b)}`;
        if (recoveredSeen.has(pairKey)) continue;
        recoveredSeen.add(pairKey);
        recoveredA.push(overlap.a);
        recoveredB.push(overlap.b);
        recoveredRegion1.push(firstRegion);
        recoveredRegion2.push(secondRegion);
        recoveredEdge1.push(edge);
        recoveredEdge2.push(other);
      }
    }
  }

  const regionIndexById = new Map(regionIds.map((id, index) => [String(id), index]));

  return {
    precision,
    regionIds,
    regionIndexById,
    baseOwners,
    pointX,
    pointY,
    a,
    b,
    region1,
    region2,
    side1: Int8Array.from(side1),
    extra,
    recoveredA,
    recoveredB,
    recoveredRegion1,
    recoveredRegion2,
    recoveredEdge1,
    recoveredEdge2,
    stats: {
      regionCount: features.length,
      edgeCount: a.length,
      recoveredTopologySegmentCount: recoveredA.length,
      skippedFeatureCount,
    },
  };
};

export const derivePolityBoundariesFromTopology = (
  topology,
  ownershipOverrides = {},
  { affectedOwners = null } = {},
) => {
  if (!topology?.regionIds?.length) return { data: EMPTY_FEATURE_COLLECTION, stats: { boundaryGroupCount: 0 } };
  const affected = affectedOwners && [...affectedOwners].length
    ? new Set([...affectedOwners].map((owner) => toCountryName(owner)).filter(Boolean))
    : null;
  const ownerCache = new Array(topology.regionIds.length);
  const ownerForRegion = (regionIndex) => {
    if (regionIndex < 0) return "";
    if (ownerCache[regionIndex] !== undefined) return ownerCache[regionIndex];
    const id = topology.regionIds[regionIndex];
    const owner = toCountryName(ownershipOverrides?.[id] ?? topology.baseOwners[regionIndex] ?? "");
    ownerCache[regionIndex] = owner;
    return owner;
  };

  const byOwnerGroup = new Map();
  let boundarySegmentCount = 0;
  const addBoundary = (regionIndexes, pointA, pointB) => {
    if (!pointA || !pointB || (pointA[0] === pointB[0] && pointA[1] === pointB[1])) return;
    const owners = [...new Set(regionIndexes.map(ownerForRegion).filter(Boolean))].sort();
    if (owners.length < 2) return;
    if (affected && !owners.some((owner) => affected.has(owner))) return;
    const key = owners.join("\u001f");
    let group = byOwnerGroup.get(key);
    if (!group) {
      group = { owners, segments: [], seen: new Set() };
      byOwnerGroup.set(key, group);
    }
    const uniqueKey = edgeKey(pointA, pointB);
    if (group.seen.has(uniqueKey)) return;
    group.seen.add(uniqueKey);
    group.segments.push({ a: pointA, b: pointB });
    boundarySegmentCount += 1;
  };

  for (let edge = 0; edge < topology.a.length; edge += 1) {
    const second = topology.region2[edge];
    const extra = topology.extra.get(edge);
    if (second === -1 && !extra) continue;
    const regions = [topology.region1[edge]];
    if (second !== -1) regions.push(second);
    if (extra) regions.push(...extra);
    addBoundary(
      regions,
      [topology.pointX[topology.a[edge]], topology.pointY[topology.a[edge]]],
      [topology.pointX[topology.b[edge]], topology.pointY[topology.b[edge]]],
    );
  }
  for (let index = 0; index < topology.recoveredA.length; index += 1) {
    addBoundary(
      [topology.recoveredRegion1[index], topology.recoveredRegion2[index]],
      topology.recoveredA[index],
      topology.recoveredB[index],
    );
  }

  let boundaryChainCount = 0;
  const features = [];
  const ordered = [...byOwnerGroup.entries()].sort(([left], [right]) => left.localeCompare(right));
  for (const [ownerKey, group] of ordered) {
    const coordinates = stitchSegments(group.segments, topology.precision);
    boundaryChainCount += coordinates.length;
    features.push({
      type: "Feature",
      id: stableId("polity-boundary", ownerKey),
      properties: {
        class: "polity-boundary",
        ownerKey,
        owners: group.owners.join(" | "),
        ownerList: group.owners,
        owner0: group.owners[0] ?? "",
        owner1: group.owners[1] ?? "",
        owner2: group.owners[2] ?? "",
        owner3: group.owners[3] ?? "",
      },
      geometry: { type: "MultiLineString", coordinates },
    });
  }
  return {
    data: { type: "FeatureCollection", features },
    stats: {
      regionCount: topology.regionIds.length,
      edgeCount: topology.a.length,
      boundarySegmentCount,
      boundaryChainCount,
      boundaryGroupCount: features.length,
      recoveredBoundarySegmentCount: topology.recoveredA.length,
      skippedFeatureCount: topology.stats?.skippedFeatureCount ?? 0,
    },
  };
};

export const boundaryFeatureTouchesOwner = (feature, owners) => {
  const wanted = owners instanceof Set ? owners : new Set([...owners ?? []].map((value) => toCountryName(value)));
  const names = String(feature?.properties?.owners ?? "").split(" | ").map(toCountryName).filter(Boolean);
  return names.some((name) => wanted.has(name));
};


const segmentOwners = (segment, topology, ownershipOverrides = {}) => {
  const owners = [];
  const seen = new Set();
  for (const regionIndex of segment.regionIndexes ?? []) {
    if (regionIndex == null || regionIndex < 0) continue;
    const id = topology.regionIds[regionIndex];
    const owner = toCountryName(ownershipOverrides?.[id] ?? topology.baseOwners[regionIndex] ?? "");
    if (!owner || seen.has(owner)) continue;
    seen.add(owner);
    owners.push(owner);
  }
  owners.sort();
  return owners;
};

const boundaryFeatureForGroup = (ownerKey, group, precision) => {
  if (!group?.segments?.size) return null;
  const owners = ownerKey.split("\u001f").filter(Boolean);
  const coordinates = stitchSegments([...group.segments.values()], precision);
  if (!coordinates.length) return null;
  return {
    type: "Feature",
    id: stableId("polity-boundary", ownerKey),
    properties: {
      class: "polity-boundary",
      ownerKey,
      owners: owners.join(" | "),
      ownerList: owners,
      owner0: owners[0] ?? "",
      owner1: owners[1] ?? "",
      owner2: owners[2] ?? "",
      owner3: owners[3] ?? "",
    },
    geometry: { type: "MultiLineString", coordinates },
  };
};

// A realm's outline. A key names one feature: the kind of edge and the realm it bounds.
const OUTLINE_KEY_PREFIX = "\u001e";
const outlineKey = (kind, owner) => `${OUTLINE_KEY_PREFIX}${kind}\u001f${owner}`;

const ownerOfRegion = (topology, ownershipOverrides, regionIndex) => {
  const id = topology.regionIds[regionIndex];
  return toCountryName(ownershipOverrides?.[id] ?? topology.baseOwners[regionIndex] ?? "");
};

/**
 * The realms one base edge bounds, each with the edge directed so that realm is
 * on its right. An edge is a `frontier` when no realm lies beyond it and a
 * `side` when another does. A recovered overlap gives nothing: the two base
 * edges it came from carry the outline. Nor does an edge without a side.
 */
const outlineEntriesForSegment = (segment, topology, ownershipOverrides) => {
  if (!segment.side) return [];
  const ownerOf = (regionIndex) => ownerOfRegion(topology, ownershipOverrides, regionIndex);
  // The side is known for the first region; a second lies across the edge. Any further region (regions laid over
  // each other) counts as a neighbour of both and gets no line of its own.
  const [first, second = -1, ...rest] = segment.regionIndexes;
  const firstOwner = ownerOf(first);
  const restOwners = rest.map(ownerOf);
  const beyond = second >= 0 ? [ownerOf(second), ...restOwners] : (segment.matched ?? []).map(ownerOf);
  const entries = [];
  const add = (owner, others, ownerOnRight) => {
    if (!owner || others.includes(owner)) return;
    entries.push({
      key: outlineKey(others.some(Boolean) ? "side" : "frontier", owner),
      a: ownerOnRight ? segment.a : segment.b,
      b: ownerOnRight ? segment.b : segment.a,
    });
  };
  add(firstOwner, beyond, segment.side > 0);
  if (second >= 0) add(ownerOf(second), [firstOwner, ...restOwners], segment.side < 0);
  return entries;
};

const outlineFeatureForGroup = (key, segments, precision) => {
  if (!segments?.size) return null;
  const [kind, owner] = key.slice(OUTLINE_KEY_PREFIX.length).split("\u001f");
  const coordinates = stitchDirectedSegments([...segments.values()], precision);
  if (!coordinates.length) return null;
  return {
    type: "Feature",
    id: stableId("polity-outline", `${kind}\u001f${owner}`),
    properties: {
      class: kind === "side" ? "polity-side" : "polity-frontier",
      ownerKey: owner,
      owners: owner,
      ownerList: [owner],
      owner0: owner,
      owner1: "",
      owner2: "",
      owner3: "",
    },
    geometry: { type: "MultiLineString", coordinates },
  };
};

const sameOutlineEntries = (left, right) => left.length === right.length
  && left.every((entry, index) => entry.key === right[index].key && entry.a === right[index].a && entry.b === right[index].b);

// File one segment under the realms it bounds now; `changedKeys` collects the outline features to rebuild.
const fileSegmentOutline = (state, segment, ownershipOverrides, changedKeys = null) => {
  const previous = state.segmentOutline.get(segment.id) ?? [];
  const next = outlineEntriesForSegment(segment, state.topology, ownershipOverrides);
  if (sameOutlineEntries(previous, next)) return;
  for (const entry of previous) {
    state.outlineGroups.get(entry.key)?.delete(segment.id);
    changedKeys?.add(entry.key);
  }
  for (const entry of next) {
    let group = state.outlineGroups.get(entry.key);
    if (!group) {
      group = new Map();
      state.outlineGroups.set(entry.key, group);
    }
    group.set(segment.id, { a: entry.a, b: entry.b });
    changedKeys?.add(entry.key);
  }
  if (next.length) state.segmentOutline.set(segment.id, next);
  else state.segmentOutline.delete(segment.id);
};

// Replace, or drop, the published feature of one group and record it in the patch.
const publishGroupFeature = (state, key, feature, removeIds, upsert) => {
  const oldFeature = state.features.get(key);
  if (!feature) {
    state.features.delete(key);
    if (oldFeature?.id != null) removeIds.push(String(oldFeature.id));
    return;
  }
  state.features.set(key, feature);
  upsert.push(feature);
};

// The regions each single-region edge overlaps without sharing its vertices.
const matchedRegionsByEdge = (topology) => {
  const matched = new Map();
  const add = (edge, region) => {
    if (!Number.isInteger(edge)) return;
    const regions = matched.get(edge);
    if (regions) regions.push(region);
    else matched.set(edge, [region]);
  };
  for (let index = 0; index < (topology?.recoveredA?.length ?? 0); index += 1) {
    add(topology.recoveredEdge1?.[index], topology.recoveredRegion2[index]);
    add(topology.recoveredEdge2?.[index], topology.recoveredRegion1[index]);
  }
  return matched;
};

const buildTopologySegments = (topology, { outlines = false } = {}) => {
  const segments = new Map();
  const regionToSegments = Array.from({ length: topology?.regionIds?.length ?? 0 }, () => []);
  // With outlines an edge of one region is a segment too: it may be a realm's edge against nobody.
  const matchedByEdge = outlines ? matchedRegionsByEdge(topology) : null;
  const register = (id, regionIndexes, aPoint, bPoint, edge = -1) => {
    const indexes = [...new Set((regionIndexes ?? []).filter((value) => Number.isInteger(value) && value >= 0))];
    if (indexes.length < (outlines && edge >= 0 ? 1 : 2)) return;
    const segment = { id, regionIndexes: indexes, a: aPoint, b: bPoint };
    const watched = [...indexes];
    if (outlines && edge >= 0) {
      segment.side = topology.side1?.[edge] ?? 0;
      const matched = indexes.length === 1 ? matchedByEdge.get(edge) : null;
      if (matched) {
        segment.matched = [...new Set(matched)].filter((regionIndex) => regionIndex !== indexes[0]);
        watched.push(...segment.matched);
      }
    }
    segments.set(id, segment);
    for (const regionIndex of watched) regionToSegments[regionIndex]?.push(id);
  };

  for (let edge = 0; edge < (topology?.a?.length ?? 0); edge += 1) {
    const second = topology.region2[edge];
    const more = topology.extra.get(edge);
    if (second === -1 && !more && !outlines) continue;
    const regionIndexes = [topology.region1[edge]];
    if (second !== -1) regionIndexes.push(second);
    if (more) regionIndexes.push(...more);
    register(
      `e:${edge}`,
      regionIndexes,
      [topology.pointX[topology.a[edge]], topology.pointY[topology.a[edge]]],
      [topology.pointX[topology.b[edge]], topology.pointY[topology.b[edge]]],
      edge,
    );
  }

  for (let index = 0; index < (topology?.recoveredA?.length ?? 0); index += 1) {
    register(
      `r:${index}`,
      [topology.recoveredRegion1[index], topology.recoveredRegion2[index]],
      topology.recoveredA[index],
      topology.recoveredB[index],
    );
  }

  return { segments, regionToSegments };
};

/**
 * Mutable worker-local boundary state. Geometry topology is immutable; only the
 * owner classification of existing frontier segments changes between political
 * revisions. Runtime updates therefore touch segments incident to changed
 * regions instead of rescanning the entire authored map.
 *
 * With `outlines` the state also keeps each realm's outline: the edges with the
 * realm on one side only, as `polity-frontier` and `polity-side` features whose
 * lines run with the realm on the right. A historical campaign asks for them.
 */
export const createPoliticalBoundaryState = (topology, ownershipOverrides = {}, { outlines = false } = {}) => {
  const { segments, regionToSegments } = buildTopologySegments(topology, { outlines });
  const groups = new Map();
  const segmentGroupKey = new Map();
  const features = new Map();

  const addToGroup = (key, segment) => {
    let group = groups.get(key);
    if (!group) {
      group = { segments: new Map() };
      groups.set(key, group);
    }
    group.segments.set(segment.id, { a: segment.a, b: segment.b });
  };

  for (const segment of segments.values()) {
    const owners = segmentOwners(segment, topology, ownershipOverrides);
    if (owners.length < 2) continue;
    const key = owners.join("\u001f");
    segmentGroupKey.set(segment.id, key);
    addToGroup(key, segment);
  }

  for (const [key, group] of groups) {
    const feature = boundaryFeatureForGroup(key, group, topology.precision);
    if (feature) features.set(key, feature);
  }

  const state = {
    topology,
    segments,
    regionToSegments,
    groups,
    segmentGroupKey,
    features,
    outlines: Boolean(outlines),
    outlineGroups: new Map(),
    segmentOutline: new Map(),
  };
  if (state.outlines) {
    for (const segment of segments.values()) fileSegmentOutline(state, segment, ownershipOverrides);
    for (const [key, group] of state.outlineGroups) {
      const feature = outlineFeatureForGroup(key, group, topology.precision);
      if (feature) features.set(key, feature);
    }
  }
  return state;
};

export const politicalBoundaryStateCollection = (state) => ({
  type: "FeatureCollection",
  features: [...(state?.features?.values?.() ?? [])],
});

export const affectedOwnersForRegionChanges = (
  topology,
  previousOwnershipOverrides = {},
  nextOwnershipOverrides = {},
  changedRegionIds = [],
) => {
  const owners = new Set();
  for (const rawId of changedRegionIds ?? []) {
    const id = String(rawId ?? "");
    const index = topology?.regionIndexById?.get(id);
    const baseOwner = index == null ? "" : topology.baseOwners[index];
    const before = toCountryName(previousOwnershipOverrides?.[id] ?? baseOwner ?? "");
    const after = toCountryName(nextOwnershipOverrides?.[id] ?? baseOwner ?? "");
    if (before) owners.add(before);
    if (after) owners.add(after);
  }
  return [...owners];
};

export const updatePoliticalBoundaryState = (
  state,
  ownershipOverrides = {},
  changedRegionIds = [],
) => {
  if (!state?.topology || !state?.segments) {
    return { patch: { removeIds: [], upsert: [] }, stats: { changedSegmentCount: 0, changedGroupCount: 0 } };
  }

  const segmentIds = new Set();
  for (const rawId of changedRegionIds ?? []) {
    const regionIndex = state.topology.regionIndexById?.get(String(rawId ?? ""));
    if (regionIndex == null) continue;
    for (const segmentId of state.regionToSegments[regionIndex] ?? []) segmentIds.add(segmentId);
  }

  const changedGroups = new Set();
  const changedOutlines = new Set();
  for (const segmentId of segmentIds) {
    const segment = state.segments.get(segmentId);
    if (!segment) continue;
    if (state.outlines) fileSegmentOutline(state, segment, ownershipOverrides, changedOutlines);
    const previousKey = state.segmentGroupKey.get(segmentId) ?? "";
    const owners = segmentOwners(segment, state.topology, ownershipOverrides);
    const nextKey = owners.length >= 2 ? owners.join("\u001f") : "";
    if (previousKey === nextKey) continue;

    if (previousKey) {
      const oldGroup = state.groups.get(previousKey);
      oldGroup?.segments?.delete(segmentId);
      changedGroups.add(previousKey);
    }
    if (nextKey) {
      let nextGroup = state.groups.get(nextKey);
      if (!nextGroup) {
        nextGroup = { segments: new Map() };
        state.groups.set(nextKey, nextGroup);
      }
      nextGroup.segments.set(segmentId, { a: segment.a, b: segment.b });
      state.segmentGroupKey.set(segmentId, nextKey);
      changedGroups.add(nextKey);
    } else {
      state.segmentGroupKey.delete(segmentId);
    }
  }

  const removeIds = [];
  const upsert = [];
  for (const key of changedGroups) {
    const group = state.groups.get(key);
    if (!group?.segments?.size) state.groups.delete(key);
    publishGroupFeature(state, key, boundaryFeatureForGroup(key, group, state.topology.precision), removeIds, upsert);
  }
  for (const key of changedOutlines) {
    const group = state.outlineGroups.get(key);
    if (!group?.size) state.outlineGroups.delete(key);
    publishGroupFeature(state, key, outlineFeatureForGroup(key, group, state.topology.precision), removeIds, upsert);
  }

  return {
    patch: { removeIds, upsert },
    stats: {
      changedSegmentCount: segmentIds.size,
      changedGroupCount: changedGroups.size,
      changedOutlineCount: changedOutlines.size,
      boundaryGroupCount: state.features.size,
    },
  };
};

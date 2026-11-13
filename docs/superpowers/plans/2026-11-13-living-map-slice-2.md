# Living map, slice 2: implementation plan

**Goal:** In a historical campaign every realm has an outline: a band of its colour inside its edge, a dark line where no realm lies beyond, and a heavier edge for the player's realm.

**Spec:** `docs/superpowers/specs/2026-11-13-living-map-design.md`, "Slice 2: a realm has an edge".

**Architecture:** The cartography worker already keeps a boundary state that turns region edges into line features and patches them when ownership changes. With `outlines` on, the same state also files each edge under the one realm it bounds, directed with the realm on its right. The features travel in the patch the borders already use, into the source the borders already use. `Nations.jsx` mounts three line layers on that source; their paint is built in `historicalCartography.js`.

## Global constraints

- A scenario that is not historical gets the same boundary features and the same layers as before.
- No new Swedish or English player text.
- `visibleBoundaryFilter` keeps its name and its use (`politicalCartographyArchitecture.test.js`).
- `createPoliticalBoundaryState(topology, overrides)` and `updatePoliticalBoundaryState(state, overrides, ids)` keep working with two and three arguments.
- A feature id stays unique in the source: outline ids start with `polity-outline:`.

## Task 1: topology facts

**Files:** `src/Game/Map/vnext/politicalBoundaryTopology.js`, `politicalBoundaryTopology.test.js`.

`buildPoliticalBoundaryTopology` also returns:

- `side1: Int8Array`, one per edge: `1` when `region1` lies to the right of `a → b`, `-1` when to the left. From the ring's signed area and whether it is an exterior ring or a hole.
- `recoveredEdge1`, `recoveredEdge2`: the two edge indexes each recovered overlap came from.

Tests: a counter-clockwise square has its region on the left of each edge as walked, so `side1` matches the direction stored; the same square clockwise gives the opposite; a hole flips again.

## Task 2: outlines in the boundary state

**Files:** the same two.

- `stitchDirectedSegments(segments, precision): number[][][]` joins `{ a, b }` segments head to tail and never reverses one.
- `createPoliticalBoundaryState(topology, overrides, { outlines = false } = {})`. With `outlines`, single-region edges become segments too, and each base edge is filed under the realm it bounds:
  - one region, owned, and no recovered neighbour with the same owner: that owner; `frontier` unless a recovered neighbour has another owner, then `side`;
  - two regions with different owners or one unowned: each owner gets it; `side` when the other is owned, `frontier` when not;
  - recovered overlaps give no outline (their base edges do).
- Feature: `id` `polity-outline:…`, `class` `polity-frontier` or `polity-side`, `ownerKey`, `owners`, `owner0` the realm, `ownerList` `[realm]`, `owner1..3` empty, geometry a `MultiLineString` with the realm on the right.
- `updatePoliticalBoundaryState` re-files the segments of the changed regions and returns outline upserts and removals in the same patch.

Tests: a realm alone on a grid gets one closed frontier with the realm on its right (signed area of the ring is negative in lng/lat); two realms side by side each get a `side` for the shared edge, in opposite directions, and the border feature is unchanged; land between them unowned turns the sides into frontiers; without `outlines` the collection equals the one before; an ownership change moves the frontier and the patch removes the feature of a realm that lost everything; two regions of one owner that overlap without shared vertices give no line between them.

## Task 3: the worker and the map

**Files:** `src/Game/Map/vnext/polityBoundariesWorker.js`, `src/Game/Map/Nations.jsx`, `src/Game/Map/historicalCartography.js` (+ test), `src/Game/Map/mapLayerOrder.js` (+ test).

- Worker: `initialize` reads `message.outlines`; all three `createPoliticalBoundaryState` calls pass it; a changed flag drops the cached state.
- `Nations.jsx`: `outlines: historical` in the `initialize` message and `historical` in that effect's dependencies; `boundaryLineFilter` (the border layers skip `polity-side` in a historical campaign); the three layers, mounted when `historical && customFlag`.
- `historicalCartography.js`: `OUTLINE_BAND_LAYER_ID = "polity-outline-band"`, `OUTLINE_LIGHT_LAYER_ID = "polity-outline-light"`, `OWN_EDGE_LAYER_ID = "polity-own-edge"`, `OUTLINE_CLASS_FILTER`, `BOUNDARY_LINE_CLASS_FILTER`, `buildRealmColorExpression(pairs, fallback)`, `buildOutlineBandPaint(color, visible)`, `buildOutlineLightPaint(color, visible)`, `buildOwnEdgePaint(visible)`, `ownEdgeFilter(owner)`.
- Layer order: `relief-over-fills`, `polity-outline-band`, `polity-outline-light`, `polity-boundaries-shadow`, `polity-boundaries`, `polity-own-edge`.

Tests: the paint builders (positive offset, widths rising with zoom, zero opacity when not visible), the colour expression (a `match` on `owner0`; the bare fallback with no realms), the filters, the layer order, and source tests for the wiring.

## Task 4: evidence

Targeted tests, the build, the full suite, and a browser run on the Charlemagne campaign at the world view and close in, with the console read.

## Review focus

- A realm whose two regions touch without shared vertices: no line between them.
- A region changes owner during play: the old realm's frontier closes behind it, the new one's opens, in one patch.
- A realm that loses its last region: its outline features are removed from the source.
- A scenario that is not historical: the same features and layers as before.
- The player has no realm yet (menu, observer): no heavier edge and no error.

## Review outcome

An independent review of the first build found three things, fixed in the same change:

- An edge that two parts of one region share (a MultiPolygon whose parts touch) was taken for the realm's edge and drew a band through the realm. Such an edge now has no side (`side1` 0) and no outline, and so has a ring without area.
- An edge with three or more regions on it looked only at the first two. Every further region now counts as a neighbour.
- An outline layer mounted after the border source landed on top of the stack. The band and the rim take `beforeId`, and an effect restores the order when the outline mounts.

Left as it is: a single-region edge that overlaps a neighbour for part of its length is classed whole, as `side` or as interior. The overlaps are short (the match tolerance), and splitting the edge would change the topology the borders share.

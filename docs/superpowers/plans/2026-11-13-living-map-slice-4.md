# Living map, slice 4: implementation plan

**Goal:** In a historical campaign the sea and the lakes are painted: one sea colour deepened by depth, pale shallows along the coast, lakes with a shore.

**Spec:** `docs/superpowers/specs/2026-11-13-living-map-design.md`, "Slice 4: painted water".

**Architecture:** A build script turns Natural Earth's land and lakes into two GeoJSON files under `public/map/`, with a manifest of hashes. The paint is built in `historicalCartography.js`. A small component inside `<Map>` mounts three sources and six layers when the map on screen is the historical default.

## Global constraints

- A scenario that is not historical, a basemap the player picked, a scenario with a map of its own and a map without a network get the same sources and layers as before.
- No new player text.
- The two data files are generated: `node scripts/build-map-water.mjs --check` passes, and a test runs the same comparison.
- Natural Earth is in the public domain; the lakes' source has a record like the land's (`lakes-source.json`: url, sha256, bytes, retrieved).

## Task 1: the data

**Files:** `scripts/build-map-water.mjs`, `server/seed/historical/sources/ne_50m_lakes.geojson`, `server/seed/historical/sources/lakes-source.json`, `public/map/{sea.geojson,lakes.geojson,water.json}`, `server/mapWater.test.js`, `.gitattributes`.

- `buildSea(land): FeatureCollection`: one feature, a `MultiPolygon`: the box -180..180 by -85..85 less the land, coordinates rounded to three decimals.
- `buildLakes(lakes): FeatureCollection`: every polygon feature that is not modern, with `properties: { name }` only.
- `MODERN_LAKES`: the eight names of the spec.
- `buildWaterFiles(): { "sea.geojson", "lakes.geojson", "water.json" }` as text, from the pinned sources; a wrong source hash throws.

Tests: a square of land in the box leaves a sea with that square as a hole; a reservoir by class, one by name and one of the eight are left out and a plain lake is kept with only its name; the files on disk equal `buildWaterFiles()`; the mid-Atlantic is sea and Paris is not; Lake Geneva, Vänern and Lake Victoria are lakes and Lake Volta, Lake Mead and Lake Nasser are not.

## Task 2: the paint

**Files:** `src/Game/Map/historicalCartography.js` (+ test), `src/Game/Map/mapLayerOrder.js` (+ test).

- `WATER_SEA_URL = "/map/sea.geojson"`, `WATER_LAKES_URL = "/map/lakes.geojson"`
- `WATER_SOURCE_IDS = { sea, lakes, depth }`, `WATER_DEPTH_SOURCE` (a `raster-dem` of the elevation tiles)
- `WATER_LAYER_IDS = { sea: "water-sea", depth: "water-depth", shallows: "water-shallows", lakes: "water-lakes", lakeShore: "water-lake-shore", shore: "water-shore" }`, `WATER_LAYER_ORDER` (those six, bottom to top)
- `WATER_OPACITY_STOPS = [[6.5, 1], [8, 0.6], [10, 0]]`, `waterOpacity(scale = 1)`: a top-level zoom interpolation
- `buildSeaPaint()`, `buildSeaDepthPaint()`, `buildShallowsPaint()`, `buildLakePaint()`, `buildLakeShorePaint()`, `buildShorePaint()`
- Layer order: `relief-over-fills`, the six water layers, `polity-outline-band`.

Tests: the ids and urls; every paint's opacity falls to 0 at zoom 10; the depth ramp is clear at -60 m and above and darkens with depth; the shallows are offset into the sea (the sea's rings have the water on their right, so a positive offset); the order.

## Task 3: the map

**Files:** create `src/Game/Map/HistoricalWater.jsx`; `src/Game/Map/World.jsx` mounts it inside `<Map>` when `historicalDefaultInUse`.

`HistoricalWater` renders the three sources and six layers, each layer with `beforeId` the first of `polity-outline-band` and `polity-boundaries-shadow` that exists, and restores the layer order once after it mounts and once at the map's next `idle`.

Source tests in `historicalCartography.test.js`.

## Task 4: evidence

Targeted tests, `--check`, the build, the full suite, and a browser run on the Charlemagne campaign: the world view, the Mediterranean, a lake country (the Alps or Sweden), a close view past zoom 10, and the console.

## Review focus

- The water mounts before the regions' fills: the fills must still end up under it and the borders over it.
- A click on the sea and a click on a coastal region behave as before.
- The player picks a basemap in Settings, or the network drops: the water unmounts with the remount of the map.
- The map is leaned: the sea lies flat enough and its layers drape with the ground.
- A scenario that is not historical: no water sources, no water layers.

## Review outcome

An independent review of the first build found no blocking defect; every `queryRenderedFeatures` call names its layers, so the water cannot take a click. Two things in the build script were fixed in the same change:

- The guard that runs the script compared the argument's path with the module's real path. Through a link, or with another case in the drive letter, the script would do nothing and exit 0, and `--check` would pass without checking. It now compares real paths.
- The sea's outer ring was cut at its first vertex as well as where it leaves the box edge, which left a seam in the shallows at one point. A ring's last run and its first are now one line.

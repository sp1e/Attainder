# Living map, slice 5: implementation plan

**Goal:** In a historical campaign snow lies above a line that depends on the latitude and on the game's date.

**Spec:** `docs/superpowers/specs/2026-11-13-living-map-design.md`, "Slice 5: snow by the date".

**Architecture:** `snowLine.js` holds the model (pure functions), the tile rewrite (a pure function over pixel bytes) and the tile loader of the `ohsnow://` protocol, which fetches an elevation tile and rewrites it through a canvas. `mapLibreSetup.js` registers the protocol. `SeasonalSnow.jsx`, inside `<Map>`, mounts a `raster-dem` source whose tile template carries the day, and one `color-relief` layer.

## Global constraints

- A scenario that is not historical, a picked basemap, a scenario with a map of its own and a map without a network get no snow source, layer or tile request.
- No new player text.
- The model's tables are data: a test pins the values the spec names.

## Task 1: the model

**Files:** create `src/Game/Map/snowLine.js`, `src/Game/Map/snowLine.test.js`.

- `dayOfYear(text): number | null`: the day (1 to 365) of `YYYY-MM-DD`, with or without a leading minus for a year before the era; `null` for anything else. 29 February is day 60.
- `winterShare(day, latitude): number`: 0 to 1; 1 on 15 January north of the equator and on 16 July south of it.
- `permanentSnowLine(latitude)`, `winterSnowLine(latitude)`, `snowLineMetres(latitude, day)`: metres; symmetric in the latitude's sign except for the season.
- `SNOW_DAY_STEP = 5`, `snowDayBucket(day): number`: the first day of the day's five-day step; a `null` day gives day 1.
- `tileRowLatitudes(z, y, rows): Float64Array`: the latitude of the middle of each pixel row of a Web Mercator tile.
- `rewriteTerrarium(pixels, width, height, lineForRow): pixels`: in place; each pixel becomes its height above its row's line, in the same encoding; a pixel at or below sea level becomes `SEA_DEPTH_BELOW_LINE = -2000`.
- `SNOW_PROTOCOL = "ohsnow"`, `snowTileTemplate(day): string`, `parseSnowTileUrl(url): { day, z, x, y } | null`.
- `snowTileLoader(params, abortController): Promise<{ data: ArrayBuffer }>`.

Tests: each of the above except the loader; 46 degrees north gives 700 m in midwinter and 2,900 m in midsummer; the equator gives the same line all year; 60 degrees north is below sea level in midwinter; the south is the north half a year later.

## Task 2: the paint and the order

**Files:** `src/Game/Map/historicalCartography.js` (+ test), `src/Game/Map/mapLayerOrder.js`.

- `SNOW_LAYER_ID = "seasonal-snow"`, `SNOW_SOURCE_ID = "seasonal-snow-source"`, `buildSnowSource(day)` (a `raster-dem` whose tiles are `snowTileTemplate(day)`), `buildSnowPaint()` (clear at and below the line, 0.55 at 350 m above it, 0.92 at 900 m).
- `seasonal-snow` is the first id of `MAP_LAYER_ORDER`.

## Task 3: the map

**Files:** `src/Game/Map/mapLibreSetup.js` (`ensureSnowProtocol`), create `src/Game/Map/SeasonalSnow.jsx`, `src/Game/Map/World.jsx` (mounts it when `historicalDefaultInUse`).

`SeasonalSnow` reads the game's date (`subscribeUnits`, `getGameDate`), and renders the source and the layer with `beforeId` the first existing layer of the order above it. It restores the layer order once after it mounts and at the map's next `idle`.

## Task 4: evidence

Targeted tests, the build, the full suite, and a browser run on the Charlemagne campaign at 25 December: the world view, the Alps, Scandinavia, the Sahara and Ethiopia (no snow), and the console.

## Review focus

- An elevation tile that fails to load, or a request that is aborted: no unhandled rejection, no broken map.
- A browser whose canvas changes pixel values (colour management): the rewrite must read the bytes it was given.
- The date changes during play: the tiles are fetched again only when the five-day step changes.
- A date the game cannot parse: snow as on 1 January, no error.
- The sea and the lakes close in, where the paint is gone: not white.

## Review outcome

An independent review of the first build found these, fixed in the same change:

- A tile the elevation server does not have was thrown as a plain error, which MapLibre reports as a map error. The error now carries the HTTP status, and MapLibre skips a 404 without a word.
- Some browsers add noise to what a canvas reads back, against fingerprinting. One step of the red byte is 256 m, so the snow would be speckled. The loader and the component now test the canvas once and leave the snow out when it does not give back its bytes.
- The loader went on decoding and encoding a tile whose request was already aborted, and did not release its bitmap and canvas when a step threw.

Noted and left: when the date changes twice within the time a tile takes to load, a tile of the older day can arrive last and stay until the next change; a turn takes minutes, a tile a fraction of a second. The snow thins from zoom 7 and is gone at zoom 9: its tiles stop at level 7, and the holes it has where the land lies at sea level show as blocks closer in.

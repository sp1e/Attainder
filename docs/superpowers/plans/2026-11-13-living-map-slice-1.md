# Living map, slice 1: implementation plan

**Goal:** A historical campaign draws satellite land with realm colour as a thin wash and relief over it.

**Spec:** `docs/superpowers/specs/2026-11-13-living-map-design.md`

**Architecture:** One pure module holds the constants and expression builders. `World.jsx` picks the fallback basemap and post-processes the style; `Nations.jsx` picks the fill colour, the fill opacity and mounts the relief layer. `buildWorldStyle` and `buildPoliticalFillOpacity` keep their signatures, because source tests pin them.

## Global constraints

- Non-historical scenarios produce the same style and the same paint as before.
- No new Swedish or English player text.
- `buildWorldStyle(effectiveBasemap, …, terrainEnabled, !online,)` keeps its call shape (`src/runtime/networkStatus.test.js`).
- `const buildPoliticalFillOpacity = (hiddenExpression = null) => [` and the `transitionAwareFillOpacity` call with the literal `["boolean", …"ownershipTransitionHidden"` stay (`politicalCartographyArchitecture.test.js`).

## Task 1: the module

**Files:** create `src/Game/Map/historicalCartography.js`, `src/Game/Map/historicalCartography.test.js`.

**Produces:**
- `HISTORICAL_BASEMAP_ID = "imagery"`, `HISTORICAL_BASEMAP_MAX_ZOOM = 9`
- `fallbackBasemapId(historical: boolean): string` → `"imagery"` or `DEFAULT_BASEMAP_ID`
- `applyHistoricalBasemap(style): style` → a new style whose `satellite` source has `maxzoom <= 9` and whose two raster layers carry `HISTORICAL_SATELLITE_PAINT`; a style without a `satellite` source comes back as the same object; the input is never changed
- `UNOWNED_HISTORICAL_FILL = "rgba(0, 0, 0, 0)"`, `HISTORICAL_FILL_COLOR` (the coalesce of `CUSTOM_FILL_COLOR` with a transparent last term)
- `HISTORICAL_FILL_OPACITY_STOPS`, `buildHistoricalFillOpacity(hiddenExpression = null)`
- `RELIEF_OVER_FILLS_LAYER_ID = "relief-over-fills"`, `RELIEF_OVER_FILLS_SOURCE_ID = "relief-over-fills-source"`, `RELIEF_OVER_FILLS_SOURCE`, `RELIEF_OVER_FILLS_PAINT`

Tests: each value above; the opacity ramp has `["zoom"]` as the direct input of a top-level `interpolate`, falls with zoom, is 0.5 at most, and wraps each stop in `["case", hidden, 0, value]` when given a hidden expression; the relief exaggeration is 0 at zoom 2.5.

## Task 2: layer order

**Files:** `src/Game/Map/mapLayerOrder.js`, `mapLayerOrder.test.js`.

`relief-over-fills` sits after `group-areas-tint` and before `polity-boundaries-shadow`. Test: above every political fill, below both border layers.

## Task 3: the basemap

**Files:** `src/Game/Map/useWorldState.js` (`useWorldBackground` also returns `historical`), `src/Game/Map/World.jsx`.

`fallbackId: fallbackBasemapId(historical)`; the style memo returns `applyHistoricalBasemap(style)` when the campaign is historical, the effective basemap is the historical default, neither the scenario nor the player chose it, and the browser is online. Source test in `historicalCartography.test.js`.

## Task 4: fills and relief

**Files:** `src/Game/Map/Nations.jsx`.

- The four custom fill layers take `historical ? HISTORICAL_FILL_COLOR : CUSTOM_FILL_COLOR`.
- The ownership feature-state gives an unowned region `UNOWNED_HISTORICAL_FILL` in a historical campaign.
- `transitionAwareFillOpacity` returns `buildHistoricalFillOpacity(hidden)` when historical.
- A `Source` and a hillshade `Layer` for the relief, mounted when `historical && customFlag && online`, with `beforeId` `polity-boundaries-shadow`.

Source tests in `historicalCartography.test.js`.

## Task 5: evidence

Targeted tests, the build, the full suite, and a browser run on the Charlemagne campaign before and after at zoom 3.6 and zoom 6.

## Review outcome

The review of the first build found four things, all fixed in the same change: the sweep and the flood still used the stock opacity and a grey from-colour; the map's key did not carry the historical grade; the relief could mount under the fills when nothing reordered the layers; and the relief was mounted on a scenario with a map of its own. `polityTextScenarioLifecycle.test.js` also pins the shape of the `transitionAwareFillOpacity` memo, which the first build broke.

## Review focus

- A historical campaign offline: no relief source, the bundled relief basemap, unowned land transparent over it.
- A historical campaign where the player picked `ocean` in Settings: his basemap, uncapped, with the thin wash and the relief.
- An ownership change during play (a region gains or loses its owner): the fill appears or clears without a reload.
- A non-historical scenario: byte-identical style and paint.
- Old saves: nothing stored changes.

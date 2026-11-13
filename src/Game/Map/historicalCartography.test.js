// The look of a historical campaign's map. Spec: docs/superpowers/specs/2026-11-13-living-map-design.md.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULT_BASEMAP_ID, isBuiltinBasemapId } from "../../runtime/assets.js";
import {
  HISTORICAL_BASEMAP_ID, HISTORICAL_BASEMAP_MAX_ZOOM, HISTORICAL_FILL_COLOR, HISTORICAL_FILL_OPACITY_STOPS, HISTORICAL_SATELLITE_PAINT,
  RELIEF_OVER_FILLS_LAYER_ID, RELIEF_OVER_FILLS_PAINT, RELIEF_OVER_FILLS_SOURCE, RELIEF_OVER_FILLS_SOURCE_ID, UNOWNED_HISTORICAL_FILL,
  HISTORICAL_FILL_OPACITY, applyHistoricalBasemap, buildHistoricalFillOpacity, fallbackBasemapId, historicalFillOpacityAtZoom, opaqueTransitionColors, usesHistoricalDefault,
} from "./historicalCartography.js";
import {
  BOUNDARY_LINE_CLASS_FILTER, OUTLINE_BAND_LAYER_ID, OUTLINE_CLASS_FILTER, OUTLINE_FALLBACK_COLOR, OUTLINE_LIGHT_LAYER_ID, OWN_EDGE_LAYER_ID,
  buildOutlineBandPaint, buildOutlineLightPaint, buildOwnEdgePaint, buildRealmColorExpression, ownEdgeFilter,
} from "./historicalCartography.js";
import {
  HISTORICAL_MAX_PITCH, HISTORICAL_REST_PITCH, HISTORICAL_TERRAIN_EXAGGERATION, STOCK_TERRAIN_EXAGGERATION,
  cameraHandlers, cameraMayLean, cameraOffRest, restPitch, terrainExaggeration,
} from "./historicalCartography.js";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");

test("a historical campaign falls back to satellite imagery, and any other scenario to the default", () => {
  assert.equal(HISTORICAL_BASEMAP_ID, "imagery");
  assert.ok(isBuiltinBasemapId(HISTORICAL_BASEMAP_ID));
  assert.equal(fallbackBasemapId(true), "imagery");
  assert.equal(fallbackBasemapId(false), DEFAULT_BASEMAP_ID);
  assert.equal(fallbackBasemapId(undefined), DEFAULT_BASEMAP_ID);
});

const stockStyle = () => ({
  version: 8,
  sources: { "satellite-lowres": { type: "raster", maxzoom: 2 }, satellite: { type: "raster", maxzoom: 19 } },
  layers: [
    { id: "strategy-map-base", type: "background", paint: { "background-color": "#0b1017" } },
    { id: "satellite-lowres-layer", type: "raster", source: "satellite-lowres", paint: { "raster-brightness-max": 0.72 } },
    { id: "satellite-layer", type: "raster", source: "satellite", paint: { "raster-brightness-max": 0.72 } },
    { id: "hills", type: "hillshade", source: "terrain-source", paint: { "hillshade-exaggeration": 0.1 } },
  ],
});

test("the historical basemap stops before modern detail and takes its own grade", () => {
  const before = stockStyle(), frozen = JSON.stringify(before);
  const after = applyHistoricalBasemap(before);
  assert.equal(JSON.stringify(before), frozen, "the input style is left as it was");
  assert.equal(HISTORICAL_BASEMAP_MAX_ZOOM, 9);
  assert.equal(after.sources.satellite.maxzoom, 9);
  assert.equal(after.sources["satellite-lowres"].maxzoom, 2, "a source already below the cap keeps its depth");
  for (const id of ["satellite-lowres-layer", "satellite-layer"]) assert.deepEqual(after.layers.find((layer) => layer.id === id).paint, HISTORICAL_SATELLITE_PAINT);
  assert.deepEqual(after.layers.find((layer) => layer.id === "strategy-map-base"), before.layers[0]);
  assert.deepEqual(after.layers.find((layer) => layer.id === "hills"), before.layers[3]);
  assert.ok(HISTORICAL_SATELLITE_PAINT["raster-brightness-max"] > 0.72, "the land is brighter than under the dark interface grade");
});

test("a style without the satellite source comes back untouched", () => {
  const offline = { version: 8, sources: { "offline-relief": { type: "raster" } }, layers: [{ id: "offline-relief-layer", type: "raster", source: "offline-relief" }] };
  assert.equal(applyHistoricalBasemap(offline), offline);
  assert.equal(applyHistoricalBasemap(null), null);
});

test("unowned land has no fill, and the colour falls back to nothing", () => {
  assert.equal(UNOWNED_HISTORICAL_FILL, "rgba(0, 0, 0, 0)");
  assert.deepEqual(HISTORICAL_FILL_COLOR, ["coalesce", ["feature-state", "fillColor"], ["get", "ownerColor"], ["get", "_fillColor"], UNOWNED_HISTORICAL_FILL]);
});

test("a realm's fill thins as the camera comes closer, with zoom at the top level", () => {
  const plain = buildHistoricalFillOpacity();
  assert.deepEqual(plain.slice(0, 3), ["interpolate", ["linear"], ["zoom"]]);
  const pairs = [];
  for (let index = 3; index < plain.length; index += 2) pairs.push([plain[index], plain[index + 1]]);
  assert.deepEqual(pairs, HISTORICAL_FILL_OPACITY_STOPS.map(([zoom, opacity]) => [zoom, opacity]));
  for (let index = 1; index < pairs.length; index += 1) {
    assert.ok(pairs[index][0] > pairs[index - 1][0], "zoom stops rise");
    assert.ok(pairs[index][1] <= pairs[index - 1][1], "opacity never grows with zoom");
  }
  assert.ok(pairs.every(([, opacity]) => opacity > 0 && opacity <= 0.5));
  assert.ok(pairs.find(([zoom]) => zoom === 8)[1] <= 0.22, "close in, the land carries the map");
  const hidden = ["boolean", ["feature-state", "ownershipTransitionHidden"], false];
  const aware = buildHistoricalFillOpacity(hidden);
  assert.deepEqual(aware.slice(0, 3), ["interpolate", ["linear"], ["zoom"]]);
  assert.deepEqual(aware[4], ["case", hidden, 0, HISTORICAL_FILL_OPACITY_STOPS[0][1]]);
});

test("the relief over the fills has a source of its own and fades in after the world view", () => {
  assert.equal(RELIEF_OVER_FILLS_LAYER_ID, "relief-over-fills");
  assert.notEqual(RELIEF_OVER_FILLS_SOURCE_ID, "terrain-source", "MapLibre wants the hillshade and the 3D terrain on separate sources");
  assert.equal(RELIEF_OVER_FILLS_SOURCE.type, "raster-dem");
  assert.equal(RELIEF_OVER_FILLS_SOURCE.encoding, "terrarium");
  const ramp = RELIEF_OVER_FILLS_PAINT["hillshade-exaggeration"];
  assert.deepEqual(ramp.slice(0, 3), ["interpolate", ["linear"], ["zoom"]]);
  assert.deepEqual(ramp.slice(3, 5), [2.5, 0], "no veil over the whole world");
  assert.ok(ramp.at(-1) > 0.3 && ramp.at(-1) <= 0.7);
});

test("the map components use the historical look only for a historical campaign", () => {
  const world = read("./World.jsx"), nations = read("./Nations.jsx"), state = read("./useWorldState.js");
  assert.match(state, /historical: Boolean\(current\?\.historical\)/, "the background hook says whether the campaign is historical");
  assert.match(world, /fallbackId: fallbackBasemapId\(historical\)/);
  assert.match(state, /known: Boolean\(current\)/);
  assert.match(world, /const mapMayMount = worldBackgroundKnown \|\| worldWaitOver;/, "the first map waits for the world, so it is not replaced while it is created");
  assert.match(world, /\{mapMayMount && \(\s*<Map\s+key=\{mapInstanceKey\}/);
  assert.match(world, /historicalDefaultInUse \? applyHistoricalBasemap\(/);
  assert.match(world, /const historicalDefaultInUse = usesHistoricalDefault\(\{ historical, online, playerPick: validBasemapOverride, scenarioBasemap: worldBasemap \}\)/);
  assert.match(world, /historicalDefaultInUse \? "builtin-historical" : "builtin"/, "the grade is part of the map's key, so it never changes on a live map");
  assert.match(nations, /const customFillColor = historical \? HISTORICAL_FILL_COLOR : CUSTOM_FILL_COLOR/);
  assert.equal(nations.match(/"fill-color": customFillColor/g)?.length, 4, "the four custom fill layers share the colour");
  assert.match(nations, /owner \|\| !historical \? ownerColorCss\(owner\) : UNOWNED_HISTORICAL_FILL/);
  assert.match(nations, /\? \(historical\s+\? buildHistoricalFillOpacity\(\["boolean", \["feature-state", "ownershipTransitionHidden"\], false\]\)\s+: buildPoliticalFillOpacity\(/);
  assert.match(nations, /\{historical && customFlag && online && !scenarioBackground && \(\s*<Source\s+id=\{RELIEF_OVER_FILLS_SOURCE_ID\}/);
  assert.ok(nations.indexOf("id={RELIEF_OVER_FILLS_SOURCE_ID}") > nations.indexOf("<GroupAreaLayers"), "the relief mounts after the fills and the group tint");
  assert.ok(nations.indexOf("id={RELIEF_OVER_FILLS_SOURCE_ID}") < nations.indexOf('id="polity-boundaries-source"'), "and before the borders");
  assert.match(nations, /fromColor: ownershipFillCss\(feature\?\.properties\?\.fromOwner\),\s+toColor: ownershipFillCss\(feature\?\.properties\?\.toOwner\)/);
  assert.match(nations, /"ownership-transition-sweep-fill", "fill-opacity", historical \? HISTORICAL_FILL_OPACITY : POLITICAL_FILL_OPACITY/);
  assert.match(nations, /\.\.\.\(historical \? \{ opacityAtZoom: historicalFillOpacityAtZoom \} : \{\}\)/);
  const flood = read("./vnext/ownershipFloodCustomLayer.js");
  assert.match(flood, /opacityAtZoom = politicalFillOpacityAtZoom,/, "the flood keeps the stock opacity unless told otherwise");
  assert.match(flood, /const opacity = opacityAtZoom\(this\._map\?\.getZoom\?\.\(\)\);/);
  assert.match(nations, /id=\{RELIEF_OVER_FILLS_LAYER_ID\}\s+type="hillshade"/);
});

test("only an unchosen, online historical map takes the historical default", () => {
  assert.equal(usesHistoricalDefault({ historical: true, online: true }), true);
  assert.equal(usesHistoricalDefault({ historical: false, online: true }), false, "another scenario keeps the stock look");
  assert.equal(usesHistoricalDefault({ historical: true, online: false }), false, "offline the bundled relief is drawn");
  assert.equal(usesHistoricalDefault({ historical: true, online: true, playerPick: "ocean" }), false, "the player's pick is drawn as picked");
  assert.equal(usesHistoricalDefault({ historical: true, online: true, playerPick: "imagery" }), false, "also when he picked satellite himself");
  assert.equal(usesHistoricalDefault({ historical: true, online: true, scenarioBasemap: "ocean-dark" }), false, "a scenario's own basemap stands");
  assert.equal(usesHistoricalDefault({ historical: true, online: true, scenarioBasemap: "no-such-basemap" }), true, "an unknown id is no choice");
  assert.equal(usesHistoricalDefault(), false);
});

test("the opacity as a number follows the same ramp as the expression", () => {
  assert.deepEqual(HISTORICAL_FILL_OPACITY, buildHistoricalFillOpacity());
  for (const [zoom, opacity] of HISTORICAL_FILL_OPACITY_STOPS) assert.equal(historicalFillOpacityAtZoom(zoom), opacity);
  assert.equal(historicalFillOpacityAtZoom(0), 0.5, "below the first stop");
  assert.equal(historicalFillOpacityAtZoom(20), 0.14, "above the last stop");
  assert.ok(Math.abs(historicalFillOpacityAtZoom(5.75) - 0.32) < 1e-9, "halfway between zoom 5 and 6.5");
  assert.equal(historicalFillOpacityAtZoom(undefined), 0.5);
});

test("an ownership change with an unowned side borrows the other side's colour where nothing cannot be drawn", () => {
  const realm = "rgb(196, 155, 83)";
  assert.deepEqual(opaqueTransitionColors(UNOWNED_HISTORICAL_FILL, realm), { from: realm, to: realm }, "a realm arriving on unclaimed land");
  assert.deepEqual(opaqueTransitionColors(realm, UNOWNED_HISTORICAL_FILL), { from: realm, to: realm }, "a realm leaving it");
  assert.deepEqual(opaqueTransitionColors(realm, "rgb(1, 2, 3)"), { from: realm, to: "rgb(1, 2, 3)" }, "two realms keep their colours");
  assert.deepEqual(opaqueTransitionColors(UNOWNED_HISTORICAL_FILL, UNOWNED_HISTORICAL_FILL), { from: UNOWNED_HISTORICAL_FILL, to: UNOWNED_HISTORICAL_FILL });
  assert.deepEqual(opaqueTransitionColors("rgba(1, 2, 3, 0.5)", realm), { from: "rgba(1, 2, 3, 0.5)", to: realm }, "a half-transparent colour is a colour");
  assert.deepEqual(opaqueTransitionColors(undefined, realm), { from: "", to: realm });
});

// Slice 2: a realm has an edge.
const zoomStops = (expression) => {
  assert.equal(expression[0], "interpolate");
  assert.deepEqual(expression[2], ["zoom"], "zoom is the direct input of a top-level interpolate");
  const stops = [];
  for (let index = 3; index < expression.length; index += 2) stops.push([expression[index], expression[index + 1]]);
  return stops;
};
const rising = (stops) => stops.every(([zoom, value], index) => index === 0 || (zoom > stops[index - 1][0] && value > stops[index - 1][1]));

test("the outline layers read a realm's two outline classes, and the border lines skip a realm's side", () => {
  assert.equal(OUTLINE_BAND_LAYER_ID, "polity-outline-band");
  assert.equal(OUTLINE_LIGHT_LAYER_ID, "polity-outline-light");
  assert.equal(OWN_EDGE_LAYER_ID, "polity-own-edge");
  assert.deepEqual(OUTLINE_CLASS_FILTER, ["in", ["get", "class"], ["literal", ["polity-frontier", "polity-side"]]]);
  assert.deepEqual(BOUNDARY_LINE_CLASS_FILTER, ["!=", ["get", "class"], "polity-side"]);
});

test("a realm's colour is looked up by the outline's owner, and no realm at all is a plain colour", () => {
  assert.deepEqual(
    buildRealmColorExpression([["carolingian-realm", "rgb(1, 2, 3)"], ["papal-states", "rgb(4, 5, 6)"]], "rgb(9, 9, 9)"),
    ["match", ["get", "owner0"], "carolingian-realm", "rgb(1, 2, 3)", "papal-states", "rgb(4, 5, 6)", "rgb(9, 9, 9)"],
  );
  assert.equal(buildRealmColorExpression([], "rgb(9, 9, 9)"), "rgb(9, 9, 9)");
  assert.equal(buildRealmColorExpression(undefined), OUTLINE_FALLBACK_COLOR);
  assert.deepEqual(
    buildRealmColorExpression([["a", "rgb(1, 1, 1)"], ["", "rgb(2, 2, 2)"], ["a", "rgb(3, 3, 3)"]], "x"),
    ["match", ["get", "owner0"], "a", "rgb(1, 1, 1)", "x"],
    "an empty owner and a repeated one are left out: a match label must be unique",
  );
});

test("the band lies inside the realm: a positive offset about half its width, wider as the camera comes closer", () => {
  const paint = buildOutlineBandPaint("rgb(1, 2, 3)", true);
  assert.equal(paint["line-color"], "rgb(1, 2, 3)");
  const width = zoomStops(paint["line-width"]), offset = zoomStops(paint["line-offset"]), blur = zoomStops(paint["line-blur"]);
  assert.ok(rising(width) && rising(offset) && rising(blur));
  for (const [index, [zoom, value]] of offset.entries()) {
    assert.equal(zoom, width[index][0]);
    assert.ok(value > 0, "positive is the right of the line, where the realm is");
    assert.ok(value >= width[index][1] * 0.35 && value <= width[index][1] * 0.5, "the band's outer rim stays at the edge");
  }
  assert.ok(paint["line-opacity"] > 0 && paint["line-opacity"] <= 0.7);
  assert.equal(buildOutlineBandPaint("rgb(1, 2, 3)", false)["line-opacity"], 0);
});

test("the thin rim is the realm's colour just inside the edge", () => {
  const paint = buildOutlineLightPaint("rgb(1, 2, 3)", true);
  assert.equal(paint["line-color"], "rgb(1, 2, 3)");
  const width = zoomStops(paint["line-width"]), offset = zoomStops(paint["line-offset"]);
  assert.ok(rising(width) && rising(offset));
  assert.ok(width.at(-1)[1] <= 2);
  assert.ok(offset.every(([, value]) => value > 0));
  assert.equal(buildOutlineLightPaint("rgb(1, 2, 3)", false)["line-opacity"], 0);
});

test("the player's realm has a heavier edge than a border", () => {
  const paint = buildOwnEdgePaint(true);
  const width = zoomStops(paint["line-width"]);
  assert.ok(rising(width));
  // The stock border line is 0.92 px at zoom 3 and 1.72 at zoom 9 (Nations.jsx).
  assert.ok(width.find(([zoom]) => zoom === 3)[1] >= 0.92 * 2);
  assert.ok(width.find(([zoom]) => zoom === 9)[1] >= 1.72 * 2);
  assert.equal(buildOwnEdgePaint(false)["line-opacity"], 0);
  assert.deepEqual(ownEdgeFilter("carolingian-realm"), ["all", OUTLINE_CLASS_FILTER, ["==", ["get", "owner0"], "carolingian-realm"]]);
  assert.deepEqual(ownEdgeFilter(""), ["==", ["get", "class"], "polity-no-realm"], "no realm, no edge");
  assert.deepEqual(ownEdgeFilter(undefined), ownEdgeFilter(""));
});

test("the map asks for outlines only in a historical campaign and draws them on the border source", () => {
  const nations = read("./Nations.jsx"), worker = read("./vnext/polityBoundariesWorker.js");
  assert.match(nations, /type: "initialize",[\s\S]{0,400}outlines: historical,/);
  assert.match(worker, /createPoliticalBoundaryState\(cachedTopology, ownershipOverrides, \{ outlines: boundaryOutlines \}\)/);
  assert.doesNotMatch(worker, /createPoliticalBoundaryState\(cachedTopology, [A-Za-z]+\)/, "every state is made with the flag");
  assert.match(worker, /boundaryOutlines = Boolean\(message\.outlines\)/);

  const source = nations.slice(nations.indexOf('<Source id="polity-boundaries-source"'));
  const block = source.slice(0, source.indexOf("</Source>"));
  const at = (text) => {
    const index = block.indexOf(text);
    assert.ok(index >= 0, `${text} is in the border source`);
    return index;
  };
  assert.ok(at("id={OUTLINE_BAND_LAYER_ID}") < at("id={OUTLINE_LIGHT_LAYER_ID}"));
  assert.ok(at("id={OUTLINE_LIGHT_LAYER_ID}") < at('id="polity-boundaries-shadow"'));
  assert.ok(at('id="polity-boundaries"') < at("id={OWN_EDGE_LAYER_ID}"));
  assert.equal(block.split("filter={boundaryLineFilter}").length - 1, 2, "both border lines skip a realm's side");
  assert.match(nations, /historical \? \["all", BOUNDARY_LINE_CLASS_FILTER, visibleBoundaryFilter\] : visibleBoundaryFilter/);
  assert.match(block, /\{historical && customFlag && \(/);
  assert.match(nations, /toCountryName\(playerCode\)/);
});

test("an outline layer mounted late is put back in its place in the stack", () => {
  const nations = read("./Nations.jsx");
  const source = nations.slice(nations.indexOf('<Source id="polity-boundaries-source"'));
  const block = source.slice(0, source.indexOf("</Source>"));
  for (const id of ["OUTLINE_BAND_LAYER_ID", "OUTLINE_LIGHT_LAYER_ID"]) {
    const layer = block.slice(block.indexOf(`id={${id}}`));
    assert.match(layer.slice(0, layer.indexOf("/>")), /beforeId=\{map\?\.getLayer\?\.\("polity-boundaries-shadow"\) \? "polity-boundaries-shadow" : undefined\}/);
  }
  assert.match(nations, /if \(!historical \|\| !customFlag\) return undefined;[\s\S]{0,400}getLayer\(OWN_EDGE_LAYER_ID\)\) enforceMapLayerOrder\(mapInstance\);/);
});

// Slice 3: the camera leans.
test("the camera may lean in a historical campaign on the flat map, and nowhere else", () => {
  assert.equal(cameraMayLean({ historical: true, globe: false }), true);
  assert.equal(cameraMayLean({ historical: true, globe: true }), false);
  assert.equal(cameraMayLean({ historical: false, globe: false }), false);
  assert.equal(cameraMayLean(), false);
});

test("without lean the map keeps the three stock handler props, and with it the pitch has a ceiling", () => {
  assert.deepEqual(cameraHandlers(false), { dragRotate: false, touchPitch: false, pitchWithRotate: false });
  assert.deepEqual(cameraHandlers(true), { dragRotate: true, touchPitch: true, pitchWithRotate: true, maxPitch: 55 });
  assert.equal(HISTORICAL_MAX_PITCH, 55);
});

test("a leaning campaign rests at 42 degrees and raises the ground 8 times, not 15", () => {
  assert.equal(HISTORICAL_REST_PITCH, 42);
  assert.ok(HISTORICAL_REST_PITCH < HISTORICAL_MAX_PITCH);
  assert.equal(restPitch(true), 42);
  assert.equal(restPitch(false), 0);
  assert.equal(STOCK_TERRAIN_EXAGGERATION, 15);
  assert.equal(HISTORICAL_TERRAIN_EXAGGERATION, 8);
  assert.equal(terrainExaggeration(true), 8);
  assert.equal(terrainExaggeration(false), 15);
  assert.equal(terrainExaggeration(undefined), 15);
});

test("the camera is off its rest when it is turned from north or its pitch is not the resting one", () => {
  assert.equal(cameraOffRest({ bearing: 0, pitch: 42 }, 42), false);
  assert.equal(cameraOffRest({ bearing: 0.4, pitch: 42.8 }, 42), false);
  assert.equal(cameraOffRest({ bearing: 359.8, pitch: 42 }, 42), false, "a hair west of north is north");
  assert.equal(cameraOffRest({ bearing: -0.3, pitch: 41.2 }, 42), false);
  assert.equal(cameraOffRest({ bearing: 12, pitch: 42 }, 42), true);
  assert.equal(cameraOffRest({ bearing: -170, pitch: 42 }, 42), true);
  assert.equal(cameraOffRest({ bearing: 0, pitch: 0 }, 42), true);
  assert.equal(cameraOffRest({ bearing: 0, pitch: 0 }, 0), false);
  assert.equal(cameraOffRest({}, 0), false);
  assert.equal(cameraOffRest(undefined, 42), true, "no camera read is not the resting view of a leaning map");
});

test("the map takes its handlers, its terrain and its opening pitch from the rules", () => {
  const world = read("./World.jsx"), nations = read("./Nations.jsx"), compass = read("./CameraCompass.jsx");
  assert.match(world, /const lean = cameraMayLean\(\{ historical, globe: isGlobe \}\);/);
  assert.match(world, /\{\.\.\.cameraHandlers\(lean\)\}/);
  assert.doesNotMatch(world, /dragRotate=\{false\}/);
  assert.match(world, /exaggeration: terrainExaggeration\(historical\),/);
  assert.match(world, /\{lean && <CameraCompass rest=\{restPitch\(lean\)\} \/>\}/);
  assert.match(world, /layCameraFlat\(/);
  assert.equal(nations.split("pitch: openingPitch").length - 1, 2, "both opening framings");
  assert.match(nations, /const openingPitch = restPitch\(cameraMayLean\(\{ historical, globe: isGlobe \}\)\);/);
  assert.doesNotMatch(nations, /bearing: 0,?\s+pitch: 0/);
  assert.match(compass, /aria-label="Reset"/);
  assert.match(compass, /easeTo\(\{ bearing: 0, pitch: rest, duration: 500 \}\)/);
  assert.match(compass, /cameraOffRest\(/);
});

test("whether the camera may lean is part of the map's key, and the compass waits for the camera to move", () => {
  const world = read("./World.jsx"), compass = read("./CameraCompass.jsx");
  assert.match(world, /const basemapRenderKey = lean \? `\$\{stockRenderKey\}:lean` : stockRenderKey;/);
  assert.ok(world.indexOf("const lean = cameraMayLean(") < world.indexOf("const stockRenderKey = buildBasemapRenderKey("), "lean is known before the key");
  assert.match(compass, /instance\.on\("move", read\);/);
  assert.doesNotMatch(compass, /\n\s+read\(\);/, "no reading at mount: the opening framing has not run yet");
});

// The look of a historical campaign's map: the land itself shows, a realm is a wash of colour over it, and relief reads
// through the colour. Spec: docs/superpowers/specs/2026-11-13-living-map-design.md. Other scenarios keep the stock look.
import { DEFAULT_BASEMAP_ID, TERRAIN_TILE_TEMPLATE, isBuiltinBasemapId } from "../../runtime/assets.js";

export const HISTORICAL_BASEMAP_ID = "imagery";
// Deeper imagery shows motorways and airports. Past this level MapLibre stretches the last one.
export const HISTORICAL_BASEMAP_MAX_ZOOM = 9;

/** The basemap of a scenario that names none and whose player picked none. */
export const fallbackBasemapId = (historical) => (historical ? HISTORICAL_BASEMAP_ID : DEFAULT_BASEMAP_ID);

/**
 * Whether the map on screen is the historical default. A basemap the player picked, or one the scenario names, is drawn as
 * chosen, and without a network the bundled relief is drawn instead.
 */
export const usesHistoricalDefault = ({ historical = false, online = true, playerPick = "", scenarioBasemap = "" } = {}) => (
  Boolean(historical && online && !playerPick && !isBuiltinBasemapId(scenarioBasemap))
);

// Brighter and quieter than the stock satellite grade, which is tuned to sit under opaque political colour.
export const HISTORICAL_SATELLITE_PAINT = Object.freeze({
  "raster-resampling": "linear",
  "raster-fade-duration": 0,
  "raster-saturation": -0.24,
  "raster-contrast": 0.1,
  "raster-brightness-min": 0.05,
  "raster-brightness-max": 0.9,
});

const SATELLITE_LAYER_IDS = new Set(["satellite-lowres-layer", "satellite-layer"]);

/** The stock raster style with the historical grade and depth. A style without the satellite source is returned as it is. */
export function applyHistoricalBasemap(style) {
  if (!style?.sources?.satellite) return style;
  const sources = { ...style.sources };
  for (const id of ["satellite-lowres", "satellite"]) {
    const source = sources[id];
    if (source && Number(source.maxzoom) > HISTORICAL_BASEMAP_MAX_ZOOM) sources[id] = { ...source, maxzoom: HISTORICAL_BASEMAP_MAX_ZOOM };
  }
  const layers = style.layers.map((layer) => (SATELLITE_LAYER_IDS.has(layer.id) ? { ...layer, paint: HISTORICAL_SATELLITE_PAINT } : layer));
  return { ...style, sources, layers };
}

// Land nobody is known to rule has no fill. The region stays in the source, so it can still be clicked.
export const UNOWNED_HISTORICAL_FILL = "rgba(0, 0, 0, 0)";
export const HISTORICAL_FILL_COLOR = ["coalesce", ["feature-state", "fillColor"], ["get", "ownerColor"], ["get", "_fillColor"], UNOWNED_HISTORICAL_FILL];

// Far out the map is political; close in the land carries it and the borders hold the realm together.
export const HISTORICAL_FILL_OPACITY_STOPS = Object.freeze([
  [1.5, 0.5],
  [3.75, 0.42],
  [5.0, 0.36],
  [6.5, 0.28],
  [8.0, 0.2],
  [10.0, 0.16],
  [14.0, 0.14],
]);

/** MapLibre wants ["zoom"] as the direct input of the top-level interpolate, so a hidden region is decided inside each stop. */
export const buildHistoricalFillOpacity = (hiddenExpression = null) => [
  "interpolate", ["linear"], ["zoom"],
  ...HISTORICAL_FILL_OPACITY_STOPS.flatMap(([zoom, opacity]) => [zoom, hiddenExpression ? ["case", hiddenExpression, 0, opacity] : opacity]),
];

export const HISTORICAL_FILL_OPACITY = buildHistoricalFillOpacity();

/** The ramp above as a number, for a layer that draws itself (the ownership flood). */
export function historicalFillOpacityAtZoom(zoom) {
  const stops = HISTORICAL_FILL_OPACITY_STOPS, z = Number(zoom) || 0;
  if (z <= stops[0][0]) return stops[0][1];
  for (let index = 1; index < stops.length; index += 1) {
    const [z0, a0] = stops[index - 1], [z1, a1] = stops[index];
    if (z <= z1) return a0 + ((a1 - a0) * (z - z0)) / (z1 - z0);
  }
  return stops.at(-1)[1];
}

const TRANSPARENT_CSS = /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*0(?:\.0+)?\s*\)$/i;
/**
 * The two colours of an ownership change for a layer that cannot draw nothing. A side with no fill (unowned land in a
 * historical campaign) takes the other side's colour, so the change is the realm's own colour arriving or leaving.
 */
export function opaqueTransitionColors(fromColor, toColor) {
  const from = String(fromColor ?? ""), to = String(toColor ?? "");
  const none = (value) => TRANSPARENT_CSS.test(value.trim());
  return { from: none(from) && !none(to) ? to : from, to: none(to) && !none(from) ? from : to };
}

// Relief drawn over the fills and under the borders, so mountains read through a realm's colour.
export const RELIEF_OVER_FILLS_LAYER_ID = "relief-over-fills";
export const RELIEF_OVER_FILLS_SOURCE_ID = "relief-over-fills-source";
export const RELIEF_OVER_FILLS_SOURCE = Object.freeze({ type: "raster-dem", tiles: [TERRAIN_TILE_TEMPLATE], encoding: "terrarium", tileSize: 256, maxzoom: 7 });
// A hillshade at whole-world zoom lays a rectangular veil over the map, so it starts at nothing and fades in.
export const RELIEF_OVER_FILLS_PAINT = Object.freeze({
  "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 2.5, 0, 4, 0.42, 8, 0.58],
  "hillshade-shadow-color": "#1a1410",
  // Half-strength light: the elevation tiles carry the sea floor too, and full light reads as ice on open water.
  "hillshade-highlight-color": "rgba(255, 244, 214, 0.5)",
  "hillshade-accent-color": "#3b2a1c",
  "hillshade-illumination-direction": 315,
});

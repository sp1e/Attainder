// Snow by the date: where the snow line lies on a day of the year at a latitude, and the elevation tiles rewritten as
// height above that line, so a `color-relief` layer (which reads elevation and nothing else) can draw the snow.
// Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 5.
import { TERRAIN_TILE_TEMPLATE } from "../../runtime/assets.js";

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DAYS_IN_YEAR = 365;

/** The day of the year, 1 to 365, of a game date (`0800-12-25`, `-3000-01-01`). A leap day counts as 1 March. */
export function dayOfYear(text) {
  const match = /^-?\d{1,6}-(\d{2})-(\d{2})/.exec(String(text ?? ""));
  if (!match) return null;
  const month = Number(match[1]), day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
  return Math.min(DAYS_IN_YEAR, DAYS_BEFORE_MONTH[month - 1] + day);
}

// Winter is deepest in mid-January in the north and half a year later in the south.
const NORTHERN_MIDWINTER_DAY = 15;

/** How much of winter a day has at a latitude: 1 at midwinter, 0 at midsummer. */
export function winterShare(day, latitude) {
  const midwinter = latitude < 0 ? NORTHERN_MIDWINTER_DAY + DAYS_IN_YEAR / 2 : NORTHERN_MIDWINTER_DAY;
  return 0.5 * (1 + Math.cos((2 * Math.PI * (day - midwinter)) / DAYS_IN_YEAR));
}

// [degrees from the equator, metres]. The line that lasts the summer: high over the dry subtropics, 2,900 m at the
// Alps, at sea level near 78 degrees.
const PERMANENT_LINE = [[0, 4900], [20, 5200], [30, 4900], [38, 3900], [46, 2900], [55, 1900], [62, 1300], [70, 600], [78, 0], [90, 0]];
// The line at midwinter: the tropics have no winter, the Alps are white from 700 m, and from 57 degrees the line is
// below sea level, so the lowlands are white.
const MIDWINTER_LINE = [[0, 4900], [20, 5200], [28, 3800], [35, 2100], [40, 1300], [46, 700], [52, 200], [57, -300], [90, -300]];

const readTable = (table, latitude) => {
  const distance = Math.min(90, Math.abs(Number(latitude) || 0));
  for (let index = 1; index < table.length; index += 1) {
    const [toDegrees, toMetres] = table[index];
    if (distance <= toDegrees) {
      const [fromDegrees, fromMetres] = table[index - 1];
      return fromMetres + ((toMetres - fromMetres) * (distance - fromDegrees)) / (toDegrees - fromDegrees);
    }
  }
  return table.at(-1)[1];
};

export const permanentSnowLine = (latitude) => readTable(PERMANENT_LINE, latitude);
export const winterSnowLine = (latitude) => readTable(MIDWINTER_LINE, latitude);

/** The height of the snow line, in metres, at a latitude on a day of the year. */
export function snowLineMetres(latitude, day) {
  const permanent = permanentSnowLine(latitude);
  return permanent + (winterSnowLine(latitude) - permanent) * winterShare(day, latitude);
}

// The tiles are fetched again when the date moves to another step, not on every day.
export const SNOW_DAY_STEP = 5;
export const snowDayBucket = (day) => (Number.isFinite(day) ? 1 + Math.floor((Math.max(1, day) - 1) / SNOW_DAY_STEP) * SNOW_DAY_STEP : 1);

export const SNOW_PROTOCOL = "ohsnow";
export const snowTileTemplate = (day) => `${SNOW_PROTOCOL}://${day}/{z}/{x}/{y}`;

// Day 0 names the tile of the whole year, which the season's sweep draws from (winterNeeded below).
export const YEAR_TILE_DAY = 0;

export function parseSnowTileUrl(url) {
  const match = /^ohsnow:\/\/(\d{1,3})\/(\d+)\/(\d+)\/(\d+)$/.exec(String(url ?? ""));
  if (!match) return null;
  const [day, z, x, y] = match.slice(1).map(Number);
  return day >= YEAR_TILE_DAY && day <= 366 ? { day, z, x, y } : null;
}

/** The latitude of the middle of each pixel row of a Web Mercator tile, north to south. */
export function tileRowLatitudes(z, y, rows) {
  const latitudes = new Float64Array(rows);
  for (let row = 0; row < rows; row += 1) {
    const offset = Math.PI * (1 - (2 * (y + (row + 0.5) / rows)) / 2 ** z);
    latitudes[row] = (Math.atan(Math.sinh(offset)) * 180) / Math.PI;
  }
  return latitudes;
}

// A pixel at or below sea level is water (or a shore below the sea): it is written this far under the line.
export const SEA_DEPTH_BELOW_LINE = -2000;
const TERRARIUM_OFFSET = 32768;

/**
 * Rewrite terrarium pixels (RGBA bytes; red * 256 + green + blue / 256 - 32768 metres) in place, so that each holds
 * its height above the snow line of its row instead of its height above the sea.
 */
export function rewriteTerrarium(pixels, width, height, lineForRow) {
  for (let row = 0; row < height; row += 1) {
    const line = lineForRow[row];
    for (let column = 0; column < width; column += 1) {
      const at = (row * width + column) * 4;
      const metres = pixels[at] * 256 + pixels[at + 1] + pixels[at + 2] / 256 - TERRARIUM_OFFSET;
      const above = metres <= 0 ? SEA_DEPTH_BELOW_LINE : metres - line;
      const value = Math.max(0, Math.min(65535, above + TERRARIUM_OFFSET));
      const whole = Math.floor(value);
      pixels[at] = whole >> 8;
      pixels[at + 1] = whole & 255;
      pixels[at + 2] = Math.min(255, Math.round((value - whole) * 256));
      pixels[at + 3] = 255;
    }
  }
  return pixels;
}

// The season's sweep (docs/superpowers/specs/2026-11-19-season-sweep-design.md). A tile of the whole year holds,
// for each pixel, how much winter the place needs before snow lies on it: at or below 0 it is always white, 1 is
// the midwinter line, above 1 it is never white. Snow lies where that is under the day's winterShare, which is
// snowLineMetres rearranged; the season is then a value of the layer's paint, and no tile is fetched to move it.
export const WINTER_NEEDED_MIN = -2.5;
export const WINTER_NEEDED_MAX = 3;
// The south has its winter half a year from the north's: its pixels are written mirrored, and the ramp has an
// arm for each. Between the arms everything is clear, so the row where the hemispheres meet draws no line.
export const SOUTH_MIRROR = 10;
// Units of the elevation channel per share of winter.
export const WINTER_SHARE_SCALE = 1000;

const clampNeeded = (value) => Math.max(WINTER_NEEDED_MIN, Math.min(WINTER_NEEDED_MAX, value));

/** How much winter a height at a latitude needs before snow lies on it. The sea never has snow. */
export function winterNeeded(metres, latitude) {
  if (!(metres > 0)) return WINTER_NEEDED_MAX;
  const permanent = permanentSnowLine(latitude);
  const span = permanent - winterSnowLine(latitude);
  // The tropics have one line all year.
  if (span < 1) return metres >= permanent ? WINTER_NEEDED_MIN : WINTER_NEEDED_MAX;
  return clampNeeded((permanent - metres) / span);
}

/** What a pixel of the year's tile holds, in the elevation channel's units. */
export const yearSnowValue = (metres, latitude) => {
  const needed = winterNeeded(metres, latitude);
  return WINTER_SHARE_SCALE * (latitude < 0 ? SOUTH_MIRROR - needed : needed);
};

/** Rewrite terrarium pixels in place as the year's tile; `latitudes` has one latitude per pixel row. */
export function rewriteTerrariumYear(pixels, width, height, latitudes) {
  for (let row = 0; row < height; row += 1) {
    const latitude = latitudes[row];
    for (let column = 0; column < width; column += 1) {
      const at = (row * width + column) * 4;
      const metres = pixels[at] * 256 + pixels[at + 1] + pixels[at + 2] / 256 - TERRARIUM_OFFSET;
      const value = Math.max(0, Math.min(65535, yearSnowValue(metres, latitude) + TERRARIUM_OFFSET));
      const whole = Math.floor(value);
      pixels[at] = whole >> 8;
      pixels[at + 1] = whole & 255;
      pixels[at + 2] = Math.min(255, Math.round((value - whole) * 256));
      pixels[at + 3] = 255;
    }
  }
  return pixels;
}

const canvasOf = (width, height) => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") return Object.assign(document.createElement("canvas"), { width, height });
  return null;
};

let exactCanvas = null;
/**
 * Whether a canvas gives back the bytes it was given. Some browsers add noise to what a canvas reads back, against
 * fingerprinting; one step of the red byte is 256 m, so there the snow is left out.
 */
export function canvasReadsExactly() {
  if (exactCanvas !== null) return exactCanvas;
  exactCanvas = false;
  try {
    const context = canvasOf(4, 4)?.getContext("2d", { willReadFrequently: true });
    if (!context) return exactCanvas;
    const given = context.createImageData(4, 4);
    for (let index = 0; index < given.data.length; index += 1) given.data[index] = index % 4 === 3 ? 255 : (index * 37 + 11) % 256;
    context.putImageData(given, 0, 0);
    const read = context.getImageData(0, 0, 4, 4).data;
    exactCanvas = read.every((value, index) => value === given.data[index]);
  } catch (error) {
    console.warn("[map] snow: the canvas cannot be read, so there is no snow:", error);
  }
  return exactCanvas;
}

/** An error MapLibre reads as a tile that does not exist: it skips the tile and raises no error event. */
export const tileHttpError = (tile, status) => Object.assign(new Error(`Elevation tile ${tile.z}/${tile.x}/${tile.y}: HTTP ${status}`), { status });

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw Object.assign(new Error("Snow tile request aborted"), { name: "AbortError" });
};

/**
 * The tile loader of the `ohsnow://` protocol: one elevation tile, rewritten as height above the snow line of the
 * day its URL names. A tile the server does not have, and any tile where the canvas cannot be trusted, is a missing
 * tile to MapLibre; any other failure rejects, and MapLibre leaves that tile empty.
 */
export async function snowTileLoader(params, abortController) {
  const tile = parseSnowTileUrl(params?.url);
  if (!tile) throw new Error(`Bad snow tile URL: ${params?.url}`);
  if (!canvasReadsExactly()) throw tileHttpError(tile, 404);
  const signal = abortController?.signal;
  const source = TERRAIN_TILE_TEMPLATE.replace("{z}", tile.z).replace("{x}", tile.x).replace("{y}", tile.y);
  const response = await fetch(source, { signal });
  if (!response.ok) throw tileHttpError(tile, response.status);
  const bytes = await response.blob();
  throwIfAborted(signal);
  // The bytes are heights, not colours: no colour management and no premultiplying.
  const bitmap = await createImageBitmap(bytes, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const { width, height } = bitmap;
  const canvas = canvasOf(width, height);
  try {
    throwIfAborted(signal);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error(`Snow tile ${tile.z}/${tile.x}/${tile.y}: no 2d canvas context`);
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, width, height);
    const latitudes = tileRowLatitudes(tile.z, tile.y, height);
    if (tile.day === YEAR_TILE_DAY) rewriteTerrariumYear(image.data, width, height, latitudes);
    else rewriteTerrarium(image.data, width, height, Float64Array.from(latitudes, (latitude) => snowLineMetres(latitude, tile.day)));
    context.putImageData(image, 0, 0);
    const blob = canvas.convertToBlob
      ? await canvas.convertToBlob({ type: "image/png" })
      : await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return { data: await blob.arrayBuffer() };
  } finally {
    bitmap.close?.();
    // Give the canvas's memory back at once.
    canvas.width = 0;
    canvas.height = 0;
  }
}

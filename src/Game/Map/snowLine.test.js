// Snow by the date. Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 5.
import test from "node:test";
import assert from "node:assert/strict";
import {
  SEA_DEPTH_BELOW_LINE, SNOW_DAY_STEP, SNOW_PROTOCOL, canvasReadsExactly, dayOfYear, parseSnowTileUrl, permanentSnowLine, rewriteTerrarium,
  snowDayBucket, snowLineMetres, snowTileLoader, snowTileTemplate, tileHttpError, tileRowLatitudes, winterShare, winterSnowLine,
} from "./snowLine.js";

const MIDWINTER = 15, MIDSUMMER = 197;
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ""} ${actual} is not within ${tolerance} of ${expected}`);

test("a game date gives its day of the year, before the era too", () => {
  assert.equal(dayOfYear("0800-12-25"), 359);
  assert.equal(dayOfYear("1200-12-31"), 365);
  assert.equal(dayOfYear("-3000-01-01"), 1);
  assert.equal(dayOfYear("1500-03-01"), 60);
  assert.equal(dayOfYear("1200-02-29"), 60, "a leap day counts as 1 March");
  assert.equal(dayOfYear("0802-07-16"), 197);
  for (const bad of ["", null, undefined, "802", "0802-13-01", "0802-00-10", "0802-04-31", "soon"]) assert.equal(dayOfYear(bad), null, String(bad));
});

test("winter is whole in mid-January in the north and in mid-July in the south", () => {
  near(winterShare(MIDWINTER, 50), 1, 1e-9);
  near(winterShare(MIDSUMMER, 50), 0, 1e-3);
  near(winterShare(MIDSUMMER, -50), 1, 1e-3);
  near(winterShare(MIDWINTER, -50), 0, 1e-3);
  assert.ok(winterShare(359, 50) > 0.95, "Christmas is deep winter");
  assert.ok(winterShare(105, 50) > 0.4 && winterShare(105, 50) < 0.6, "mid-April is half way");
  for (let day = 1; day <= 365; day += 13) assert.ok(winterShare(day, 10) >= 0 && winterShare(day, 10) <= 1);
});

test("the snow line is the draft's at the Alps: 700 m in midwinter, 2,900 m in midsummer", () => {
  assert.equal(winterSnowLine(46), 700);
  assert.equal(permanentSnowLine(46), 2900);
  near(snowLineMetres(46, MIDWINTER), 700, 1);
  near(snowLineMetres(46, MIDSUMMER), 2900, 3);
  near(snowLineMetres(-46, MIDSUMMER), 700, 3, "the south has its winter in July");
  assert.equal(permanentSnowLine(-46), permanentSnowLine(46));
});

test("the tropics have one line all year, and the north is white to the sea in midwinter", () => {
  for (const latitude of [0, 9, -15, 19]) {
    assert.equal(winterSnowLine(latitude), permanentSnowLine(latitude), `latitude ${latitude}`);
    assert.ok(permanentSnowLine(latitude) >= 4800);
    near(snowLineMetres(latitude, MIDWINTER), snowLineMetres(latitude, MIDSUMMER), 1e-6);
  }
  assert.ok(snowLineMetres(60, MIDWINTER) < 0, "below sea level: the lowlands are white");
  assert.ok(snowLineMetres(60, MIDSUMMER) > 1000);
  assert.ok(snowLineMetres(33, MIDWINTER) > 2000, "the Atlas keeps its snow high");
  assert.equal(permanentSnowLine(85), 0);
  let previous = Infinity;
  for (let latitude = 20; latitude <= 90; latitude += 1) {
    assert.ok(permanentSnowLine(latitude) <= previous && winterSnowLine(latitude) <= permanentSnowLine(latitude), `latitude ${latitude}`);
    previous = permanentSnowLine(latitude);
  }
});

test("the date moves the tiles in steps of five days", () => {
  assert.equal(SNOW_DAY_STEP, 5);
  assert.deepEqual([1, 5, 6, 359, 365].map(snowDayBucket), [1, 1, 6, 356, 361]);
  assert.equal(snowDayBucket(null), 1);
  assert.equal(snowDayBucket(Number.NaN), 1);
  assert.equal(SNOW_PROTOCOL, "ohsnow");
  assert.equal(snowTileTemplate(356), "ohsnow://356/{z}/{x}/{y}");
  assert.deepEqual(parseSnowTileUrl("ohsnow://356/5/17/11"), { day: 356, z: 5, x: 17, y: 11 });
  for (const bad of ["ohsnow://356/5/17", "ohbase://356/5/17/11", "ohsnow://x/5/17/11", "ohsnow://999/5/17/11", ""]) assert.equal(parseSnowTileUrl(bad), null, bad);
});

test("a tile's rows have the latitudes of Web Mercator", () => {
  const world = tileRowLatitudes(0, 0, 2);
  near(world[0], 66.51, 0.01, "the middle of the upper half");
  near(world[1], -66.51, 0.01);
  const north = tileRowLatitudes(1, 0, 256);
  near(north[0], 85.02, 0.03, "just under the top");
  near(north[255], 0.352, 0.001, "half a row over the equator");
  assert.ok(north.every((latitude, index) => index === 0 || latitude < north[index - 1]), "southward");
});

// One terrarium pixel: red * 256 + green + blue / 256 - 32768 metres.
const encode = (metres) => {
  const value = metres + 32768;
  return [Math.floor(value / 256), Math.floor(value) % 256, Math.round((value - Math.floor(value)) * 256) % 256, 255];
};
const decode = (pixels, index) => pixels[index * 4] * 256 + pixels[index * 4 + 1] + pixels[index * 4 + 2] / 256 - 32768;

test("a tile is rewritten as height above each row's snow line, and the sea as far below it", () => {
  // Two rows of two pixels: the upper row's line is 700 m, the lower row's 2,900 m.
  const pixels = new Uint8ClampedArray([...encode(1000), ...encode(0), ...encode(3500.5), ...encode(-250)]);
  const result = rewriteTerrarium(pixels, 2, 2, Float64Array.from([700, 2900]));
  assert.equal(result, pixels, "in place");
  assert.equal(decode(pixels, 0), 300);
  assert.equal(decode(pixels, 1), SEA_DEPTH_BELOW_LINE, "sea level is not land");
  assert.equal(decode(pixels, 2), 600.5);
  assert.equal(decode(pixels, 3), SEA_DEPTH_BELOW_LINE);
  assert.equal(SEA_DEPTH_BELOW_LINE, -2000);
  assert.deepEqual([pixels[3], pixels[7], pixels[11], pixels[15]], [255, 255, 255, 255], "opaque");

  const lowland = new Uint8ClampedArray(encode(40));
  rewriteTerrarium(lowland, 1, 1, Float64Array.from([-300]));
  assert.equal(decode(lowland, 0), 340, "a line below sea level whitens the lowland");
});

test("a missing elevation tile is a missing tile to MapLibre, not an error", async () => {
  const error = tileHttpError({ z: 7, x: 3, y: 9 }, 404);
  assert.ok(error instanceof Error);
  assert.equal(error.status, 404, "MapLibre skips a tile whose error carries status 404");
  assert.match(error.message, /7\/3\/9/);
  await assert.rejects(snowTileLoader({ url: "ohsnow://nope" }), /Bad snow tile URL/);
});

test("without a canvas that gives back the bytes it was given there is no snow", async () => {
  // Node has no canvas. A browser that adds noise to what a canvas reads back (fingerprint protection) is the same
  // case: a red byte off by one is 256 m.
  assert.equal(canvasReadsExactly(), false);
  const fetched = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { fetched.push(url); return { ok: false, status: 500 }; };
  try {
    await assert.rejects(snowTileLoader({ url: "ohsnow://356/5/17/11" }), (error) => error.status === 404);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(fetched, [], "the elevation tile is not even fetched");
});

// The seasons sweep across the map when the game's date moves.
// Spec: docs/superpowers/specs/2026-11-19-season-sweep-design.md (backlog row 28).
import test from "node:test";
import assert from "node:assert/strict";
import {
  SOUTH_MIRROR, WINTER_NEEDED_MAX, WINTER_NEEDED_MIN, WINTER_SHARE_SCALE, YEAR_TILE_DAY,
  parseSnowTileUrl, rewriteTerrariumYear, snowLineMetres, snowTileTemplate, winterNeeded, winterShare, yearSnowValue,
} from "./snowLine.js";
import {
  SNOW_LAYER_ID, SNOW_OPACITY_STOPS, SNOW_OPACITY_TRANSITION, SNOW_SWEEP_LAYER_ID, SNOW_SWEEP_SOURCE_ID,
  buildSnowOpacity, buildSnowPaint, buildSnowSweepColor, buildSnowSweepPaint, buildSnowSweepSource,
} from "./historicalCartography.js";
import { MAP_LAYER_ORDER } from "./mapLayerOrder.js";
import fs from "node:fs";
import { MAP_COVER_SELECTOR, SWEEP_FADE_MS, SWEEP_MIN_DAYS, SWEEP_MIN_MS, SWEEP_MS_PER_YEAR, daysBetween, sweepClock, sweepFrame, sweepPlan } from "./snowSweep.js";

// The ramp as MapLibre reads it: its stops, and the alpha at a value of the elevation channel.
const stopsOf = (expression) => {
  assert.deepEqual(expression.slice(0, 3), ["interpolate", ["linear"], ["elevation"]]);
  const stops = [];
  for (let index = 3; index < expression.length; index += 2) stops.push([expression[index], Number(/, ([\d.]+)\)$/.exec(expression[index + 1])[1])]);
  return stops;
};
const alphaAt = (stops, value) => {
  if (value <= stops[0][0]) return stops[0][1];
  for (let index = 1; index < stops.length; index += 1) {
    const [to, toAlpha] = stops[index];
    if (value <= to) {
      const [from, fromAlpha] = stops[index - 1];
      return fromAlpha + ((toAlpha - fromAlpha) * (value - from)) / (to - from);
    }
  }
  return stops.at(-1)[1];
};

test("the sweep's edge of the snow is the snow line's own, on every day and in both hemispheres", () => {
  let compared = 0;
  for (const latitude of [-78, -55, -46, -33, -12, 0, 12, 24, 30, 38, 46, 52, 57, 62, 70, 80]) {
    for (const day of [1, 15, 46, 105, 150, 197, 240, 288, 330, 360]) {
      const stops = stopsOf(buildSnowSweepColor(winterShare(day, 1)));
      const line = snowLineMetres(latitude, day);
      for (const metres of [1, 150, 600, 1100, 1900, 2800, 3600, 4400, 5300, 6800]) {
        // Away from the edge itself, where a metre of rounding decides.
        if (Math.abs(metres - line) < 5) continue;
        const drawn = alphaAt(stops, yearSnowValue(metres, latitude)) > 0;
        assert.equal(drawn, metres > line, `latitude ${latitude}, day ${day}, ${metres} m, line ${Math.round(line)} m`);
        compared += 1;
      }
    }
  }
  assert.ok(compared > 1500, "the grid was walked");
});

test("how much winter a place needs: always white, the midwinter line, never, the sea and the tropics", () => {
  assert.equal(winterNeeded(2900, 46), 0, "the permanent line at the Alps");
  assert.equal(winterNeeded(700, 46), 1, "their midwinter line");
  assert.equal(winterNeeded(1800, 46), 0.5);
  assert.equal(winterNeeded(9000, 46), WINTER_NEEDED_MIN, "clamped");
  assert.equal(winterNeeded(0, 70), WINTER_NEEDED_MAX, "the sea has no snow");
  assert.equal(winterNeeded(-40, 70), WINTER_NEEDED_MAX);
  // One line all year: above it always, below it never.
  assert.equal(winterNeeded(5400, 10), WINTER_NEEDED_MIN);
  assert.equal(winterNeeded(3000, 10), WINTER_NEEDED_MAX);
  // The south is written mirrored.
  assert.equal(yearSnowValue(1800, 46), 0.5 * WINTER_SHARE_SCALE);
  assert.equal(yearSnowValue(1800, -46), (SOUTH_MIRROR - 0.5) * WINTER_SHARE_SCALE);
});

test("the ramp's stops ascend for every share of winter, and the two arms never meet", () => {
  for (let step = 0; step <= 100; step += 1) {
    const stops = stopsOf(buildSnowSweepColor(step / 100));
    for (let index = 1; index < stops.length; index += 1) assert.ok(stops[index][0] > stops[index - 1][0], `share ${step / 100}, stop ${index}`);
    assert.equal(stops.length, 8);
    // Clear between the arms: from the north's never to the south's never.
    assert.equal(alphaAt(stops, WINTER_NEEDED_MAX * WINTER_SHARE_SCALE), 0);
    assert.equal(alphaAt(stops, (SOUTH_MIRROR - WINTER_NEEDED_MAX) * WINTER_SHARE_SCALE), 0);
    assert.equal(alphaAt(stops, (SOUTH_MIRROR / 2) * WINTER_SHARE_SCALE), 0);
  }
  // A share outside 0 to 1 is read as the nearest end.
  assert.deepEqual(buildSnowSweepColor(7), buildSnowSweepColor(1));
  assert.deepEqual(buildSnowSweepColor(Number.NaN), buildSnowSweepColor(0));
});

test("the year's tile is written from the heights and the rows' latitudes", () => {
  const terrarium = (metres) => { const value = metres + 32768; return [Math.floor(value) >> 8, Math.floor(value) & 255, Math.round((value % 1) * 256), 255]; };
  const read = (pixels, at) => pixels[at * 4] * 256 + pixels[at * 4 + 1] + pixels[at * 4 + 2] / 256 - 32768;
  const pixels = Uint8ClampedArray.from([...terrarium(1800), ...terrarium(0), ...terrarium(1800), ...terrarium(9000)]);
  rewriteTerrariumYear(pixels, 2, 2, [46, -46]);
  assert.equal(read(pixels, 0), 500);
  assert.equal(read(pixels, 1), WINTER_NEEDED_MAX * WINTER_SHARE_SCALE);
  assert.equal(read(pixels, 2), (SOUTH_MIRROR - 0.5) * WINTER_SHARE_SCALE);
  assert.equal(read(pixels, 3), (SOUTH_MIRROR - WINTER_NEEDED_MIN) * WINTER_SHARE_SCALE);
  assert.equal(pixels[3], 255);
  assert.equal(YEAR_TILE_DAY, 0);
  assert.deepEqual(parseSnowTileUrl(snowTileTemplate(YEAR_TILE_DAY).replace("{z}/{x}/{y}", "5/17/11")), { day: 0, z: 5, x: 17, y: 11 });
});

test("the sweep's layer lies with the resting snow and waits clear", () => {
  assert.equal(SNOW_SWEEP_LAYER_ID, "seasonal-snow-sweep");
  assert.equal(SNOW_SWEEP_SOURCE_ID, "seasonal-snow-sweep-source");
  assert.deepEqual(MAP_LAYER_ORDER.slice(0, 2), [SNOW_LAYER_ID, SNOW_SWEEP_LAYER_ID]);
  assert.deepEqual(buildSnowSweepSource(), { type: "raster-dem", tiles: ["ohsnow://0/{z}/{x}/{y}"], encoding: "terrarium", tileSize: 256, maxzoom: 7 });
  const waiting = buildSnowSweepPaint();
  assert.deepEqual(waiting["color-relief-opacity"], buildSnowOpacity(0));
  assert.deepEqual(waiting["color-relief-color"], buildSnowSweepColor(1));
  // Neither layer eases its opacity on its own: the sweep sets it on every frame (MapLibre's default is 300 ms).
  assert.deepEqual(SNOW_OPACITY_TRANSITION, { duration: 0, delay: 0 });
  assert.equal(waiting["color-relief-opacity-transition"], SNOW_OPACITY_TRANSITION);
  assert.equal(buildSnowPaint()["color-relief-opacity-transition"], SNOW_OPACITY_TRANSITION);
  // The resting layer's ramp and opacity are what they were.
  assert.deepEqual(buildSnowPaint()["color-relief-opacity"], buildSnowOpacity(1));
  const stops = (expression) => expression.filter((entry) => typeof entry === "number");
  assert.deepEqual(stops(buildSnowOpacity(1)), SNOW_OPACITY_STOPS.flat());
  assert.deepEqual(stops(buildSnowOpacity(0.5)), SNOW_OPACITY_STOPS.map(([zoom, opacity]) => [zoom, opacity * 0.5]).flat());
  assert.deepEqual(buildSnowOpacity(9), buildSnowOpacity(1));
});

test("a move of the date is swept when it goes forward by twenty days or more", () => {
  assert.equal(daysBetween("0806-12-25", "0807-12-25"), 365);
  assert.equal(daysBetween("0806-12-25", "0807-01-14"), 20);
  assert.equal(daysBetween("-0001-12-25", "0001-01-04"), 375, "across the era the years are counted as written");
  assert.equal(daysBetween("0806-12-25", "garbled"), null);
  assert.equal(SWEEP_MIN_DAYS, 20);
  for (const [from, to] of [["0806-12-25", "0806-12-25"], ["0806-12-25", "0807-01-13"], ["0807-12-25", "0806-12-25"], ["", "0807-12-25"], ["0806-12-25", null]]) {
    assert.equal(sweepPlan(from, to), null, `${from} to ${to}`);
  }
  assert.deepEqual(sweepPlan("0806-12-25", "0807-12-25"), { fromDay: 359, shownDays: 365, runMs: SWEEP_MS_PER_YEAR, totalMs: SWEEP_MS_PER_YEAR + 2 * SWEEP_FADE_MS });
  // A short move takes its share of the year's four seconds, never under the least.
  assert.equal(sweepPlan("0806-12-25", "0807-06-25").runMs, Math.round((182 / 365) * SWEEP_MS_PER_YEAR));
  assert.equal(sweepPlan("0806-12-25", "0807-01-14").runMs, SWEEP_MIN_MS);
  // More than a year: one year and the remainder, so the sweep ends on the new date's day.
  const long = sweepPlan("0806-12-25", "0809-03-25");
  assert.equal(long.shownDays, 365 + 90);
  assert.equal((long.fromDay + long.shownDays) % 365, 84, "25 March");
});

test("a sweep fades in on the old date, runs through the year and fades out on the new", () => {
  const plan = sweepPlan("0806-12-25", "0807-12-25");
  const first = sweepFrame(plan, 0);
  assert.deepEqual([first.sweepOpacity, first.restOpacity, first.restCovered, first.done], [0, 1, false, false]);
  assert.equal(first.northWinter, winterShare(359, 1), "the old date's winter");
  const covered = sweepFrame(plan, SWEEP_FADE_MS);
  assert.deepEqual([covered.sweepOpacity, covered.restOpacity, covered.restCovered], [1, 0, true]);
  assert.equal(covered.northWinter, winterShare(359, 1), "the season has not moved while the layers changed places");
  const middle = sweepFrame(plan, SWEEP_FADE_MS + plan.runMs / 2);
  // Half a year from Christmas is late June; the model's midsummer is mid-July.
  assert.ok(middle.northWinter < 0.05, "summer in the north at the middle of a year from Christmas");
  assert.equal(middle.sweepOpacity, 1);
  const arrived = sweepFrame(plan, SWEEP_FADE_MS + plan.runMs);
  assert.ok(Math.abs(arrived.northWinter - winterShare(359, 1)) < 1e-9, "winter again");
  assert.deepEqual([arrived.sweepOpacity, arrived.done], [1, false]);
  const last = sweepFrame(plan, plan.totalMs);
  assert.deepEqual([last.sweepOpacity, last.restOpacity, last.done], [0, 1, true]);
  assert.equal(sweepFrame(plan, plan.totalMs + 5000).done, true);
  // The days go one way, from the old date's to the new date's, and ease at both ends.
  const days = Array.from({ length: 41 }, (_, step) => sweepFrame(plan, SWEEP_FADE_MS + (plan.runMs * step) / 40).day);
  assert.equal(days[0], 359);
  assert.equal(days.at(-1), 359 + 365);
  for (let step = 1; step < days.length; step += 1) assert.ok(days[step] > days[step - 1], `step ${step}`);
  assert.ok(days[1] - days[0] < days[20] - days[19], "slower at the start than in the middle");
  assert.ok(days[40] - days[39] < days[20] - days[19], "and at the end");
  assert.equal(sweepFrame(plan, -50).sweepOpacity, 0);
  assert.equal(sweepFrame(plan, "x").sweepOpacity, 0);
});

test("the sweep waits while the real-history notice lies over the map", () => {
  assert.equal(sweepClock(0, 16, false), 16);
  assert.equal(sweepClock(700, 16, true), 700, "covered: the clock stands");
  assert.equal(sweepClock(700, 16, false), 716, "and goes on from where it stood");
  assert.equal(sweepClock(700, -5, false), 700);
  // The notice's ground is what covers the map, and the snow asks for it by that name.
  const notice = fs.readFileSync(new URL("../Characters/HistoricalYearNotice.jsx", import.meta.url), "utf8");
  assert.equal(MAP_COVER_SELECTOR, ".hist-backdrop");
  assert.match(notice, /className="char-backdrop hist-backdrop"/);
  const snow = fs.readFileSync(new URL("./SeasonalSnow.jsx", import.meta.url), "utf8");
  assert.match(snow, /sweepClock\(elapsed, now - \(last \?\? now\), Boolean\(document\.querySelector\(MAP_COVER_SELECTOR\)\)\)/);
  assert.match(snow, /wantsStillness\(\) \? null : sweepPlan\(from, gameDate\)/, "a reader who asks for reduced motion gets no sweep");
});

// Snow by the date on a historical campaign's map: a colour ramp over the elevation tiles rewritten as height above
// the snow line of the game's date (snowLine.js). It lies on the photograph and under every other layer the game adds.
// Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 5.
//
// When the date moves forward the seasons sweep across the map (snowSweep.js,
// docs/superpowers/specs/2026-11-19-season-sweep-design.md): a second layer, whose season is a paint value, fades in
// over the resting snow, runs through the days between, and fades out over the resting snow of the new date.
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import {
  SNOW_LAYER_ID, SNOW_SOURCE_ID, SNOW_SWEEP_LAYER_ID, SNOW_SWEEP_SOURCE_ID,
  buildSnowOpacity, buildSnowPaint, buildSnowSource, buildSnowSweepColor, buildSnowSweepPaint, buildSnowSweepSource,
} from "./historicalCartography.js";
import { MAP_LAYER_ORDER, enforceMapLayerOrder } from "./mapLayerOrder.js";
import { ensureSnowProtocol } from "./mapLibreSetup.js";
import { canvasReadsExactly, dayOfYear, snowDayBucket } from "./snowLine.js";
import { MAP_COVER_SELECTOR, sweepClock, sweepFrame, sweepPlan } from "./snowSweep.js";
import { getGameDate, subscribeUnits } from "./unitsController.js";

ensureSnowProtocol();
const SNOW_PAINT = buildSnowPaint();
const SWEEP_PAINT = buildSnowSweepPaint();
const SWEEP_SOURCE = buildSnowSweepSource();
const SNOW_LAYERS = [SNOW_LAYER_ID, SNOW_SWEEP_LAYER_ID];
const LAYERS_ABOVE = MAP_LAYER_ORDER.filter((id) => !SNOW_LAYERS.includes(id));

const wantsStillness = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const SeasonalSnow = () => {
  const { current: map } = useMap();
  const gameDate = useSyncExternalStore(subscribeUnits, getGameDate);
  // The date the resting snow shows. It follows the game's date at once, except while a sweep covers it.
  const [restDate, setRestDate] = useState(gameDate);
  const shownDate = useRef(gameDate);
  // A date that cannot be read gives the first step of the year.
  const day = snowDayBucket(dayOfYear(restDate));
  const source = useMemo(() => buildSnowSource(day), [day]);

  // The snow may mount after the regions' fills. MapLibre puts a late layer on top, so the stack is put back in
  // order (mapLayerOrder.js) once the snow is there and again when the map has settled.
  useEffect(() => {
    const instance = map?.getMap ? map.getMap() : map;
    if (!instance?.once) return undefined;
    const restore = () => {
      if (instance.style && instance.getLayer(SNOW_LAYER_ID)) enforceMapLayerOrder(instance);
    };
    const frame = requestAnimationFrame(restore);
    instance.once("idle", restore);
    return () => {
      cancelAnimationFrame(frame);
      instance.off("idle", restore);
    };
  }, [map]);

  // The date moved: sweep the seasons from the date that was shown to the new one, or go there at once.
  useEffect(() => {
    const from = shownDate.current;
    shownDate.current = gameDate;
    const instance = map?.getMap ? map.getMap() : map;
    const plan = wantsStillness() ? null : sweepPlan(from, gameDate);
    // Between a WebGL context loss and its restore MapLibre has no style, and getLayer throws.
    const drawn = () => Boolean(instance?.style && instance.getLayer(SNOW_LAYER_ID) && instance.getLayer(SNOW_SWEEP_LAYER_ID));
    if (!plan || !drawn()) {
      // No sweep: the resting snow goes to the new date with the next frame.
      const direct = requestAnimationFrame(() => setRestDate(gameDate));
      return () => cancelAnimationFrame(direct);
    }
    const paint = (frame) => {
      if (!drawn()) return;
      instance.setPaintProperty(SNOW_SWEEP_LAYER_ID, "color-relief-color", buildSnowSweepColor(frame.northWinter));
      instance.setPaintProperty(SNOW_SWEEP_LAYER_ID, "color-relief-opacity", buildSnowOpacity(frame.sweepOpacity));
      instance.setPaintProperty(SNOW_LAYER_ID, "color-relief-opacity", buildSnowOpacity(frame.restOpacity));
    };
    const rest = () => paint({ northWinter: 1, sweepOpacity: 0, restOpacity: 1 });
    let request = 0;
    let last = null;
    let elapsed = 0;
    let covered = false;
    const step = (now) => {
      // The sweep waits while the real-history notice lies over the map.
      elapsed = sweepClock(elapsed, now - (last ?? now), Boolean(document.querySelector(MAP_COVER_SELECTOR)));
      last = now;
      const frame = sweepFrame(plan, elapsed);
      paint(frame);
      // The resting snow moves to the new date while the sweep covers it.
      if (frame.restCovered && !covered) {
        covered = true;
        setRestDate(gameDate);
      }
      if (frame.done) rest();
      else request = requestAnimationFrame(step);
    };
    request = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(request);
      rest();
      setRestDate(gameDate);
    };
  }, [gameDate, map]);

  // A browser that adds noise to what a canvas reads back cannot rewrite the tiles: no snow there.
  if (!canvasReadsExactly()) return null;

  // Between a WebGL context loss and its restore MapLibre has no style, and getLayer throws.
  const hasLayer = (id) => Boolean(map?.getMap?.()?.style && map.getLayer(id));
  const beforeId = LAYERS_ABOVE.find(hasLayer);

  return (
    <>
      <Source id={SNOW_SOURCE_ID} {...source}>
        <Layer id={SNOW_LAYER_ID} type="color-relief" beforeId={beforeId} paint={SNOW_PAINT} />
      </Source>
      <Source id={SNOW_SWEEP_SOURCE_ID} {...SWEEP_SOURCE}>
        <Layer id={SNOW_SWEEP_LAYER_ID} type="color-relief" beforeId={beforeId} paint={SWEEP_PAINT} />
      </Source>
    </>
  );
};

export default SeasonalSnow;

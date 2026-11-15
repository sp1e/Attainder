// Snow by the date on a historical campaign's map: a colour ramp over the elevation tiles rewritten as height above
// the snow line of the game's date (snowLine.js). It lies on the photograph and under every other layer the game adds.
// Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 5.
import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import { SNOW_LAYER_ID, SNOW_SOURCE_ID, buildSnowPaint, buildSnowSource } from "./historicalCartography.js";
import { MAP_LAYER_ORDER, enforceMapLayerOrder } from "./mapLayerOrder.js";
import { ensureSnowProtocol } from "./mapLibreSetup.js";
import { canvasReadsExactly, dayOfYear, snowDayBucket } from "./snowLine.js";
import { getGameDate, subscribeUnits } from "./unitsController.js";

ensureSnowProtocol();
const SNOW_PAINT = buildSnowPaint();
const LAYERS_ABOVE = MAP_LAYER_ORDER.filter((id) => id !== SNOW_LAYER_ID);

const SeasonalSnow = () => {
  const { current: map } = useMap();
  const gameDate = useSyncExternalStore(subscribeUnits, getGameDate);
  // A date that cannot be read gives the first step of the year.
  const day = snowDayBucket(dayOfYear(gameDate));
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

  // A browser that adds noise to what a canvas reads back cannot rewrite the tiles: no snow there.
  if (!canvasReadsExactly()) return null;

  // Between a WebGL context loss and its restore MapLibre has no style, and getLayer throws.
  const hasLayer = (id) => Boolean(map?.getMap?.()?.style && map.getLayer(id));
  const beforeId = LAYERS_ABOVE.find(hasLayer);

  return (
    <Source id={SNOW_SOURCE_ID} {...source}>
      <Layer id={SNOW_LAYER_ID} type="color-relief" beforeId={beforeId} paint={SNOW_PAINT} />
    </Source>
  );
};

export default SeasonalSnow;

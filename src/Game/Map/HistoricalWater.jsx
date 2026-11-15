// The painted water of a historical campaign's map: the sea, deepened by the sea floor, pale shallows along the coast,
// and the lakes. The data is built from Natural Earth by scripts/build-map-water.mjs; the paint is in
// historicalCartography.js. Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 4.
import React, { useEffect } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import { enforceMapLayerOrder } from "./mapLayerOrder.js";
import {
  OUTLINE_BAND_LAYER_ID,
  WATER_COAST_FILTER,
  WATER_DEPTH_SOURCE,
  WATER_LAKES_URL,
  WATER_LAYER_IDS,
  WATER_SEA_FILTER,
  WATER_SEA_URL,
  WATER_SOURCE_IDS,
  buildLakePaint,
  buildLakeShorePaint,
  buildSeaDepthPaint,
  buildSeaPaint,
  buildShallowsPaint,
  buildShorePaint,
} from "./historicalCartography.js";

const LINE_LAYOUT = { "line-cap": "round", "line-join": "round" };
// The water lies under every outline and border; these are the lowest of them, when they are mounted.
const LAYERS_ABOVE = [OUTLINE_BAND_LAYER_ID, "polity-boundaries-shadow"];

const HistoricalWater = () => {
  const { current: map } = useMap();

  // The water may mount before the regions' fills or after the borders. MapLibre puts a late layer on top, so the
  // stack is put back in order (mapLayerOrder.js) once the water is there and again when the map has settled.
  useEffect(() => {
    const instance = map?.getMap ? map.getMap() : map;
    if (!instance?.once) return undefined;
    const restore = () => {
      if (instance.style && instance.getLayer(WATER_LAYER_IDS.sea)) enforceMapLayerOrder(instance);
    };
    const frame = requestAnimationFrame(restore);
    instance.once("idle", restore);
    return () => {
      cancelAnimationFrame(frame);
      instance.off("idle", restore);
    };
  }, [map]);

  // Between a WebGL context loss and its restore MapLibre has no style, and getLayer throws.
  const hasLayer = (id) => Boolean(map?.getMap?.()?.style && map.getLayer(id));
  const beforeId = LAYERS_ABOVE.find(hasLayer);

  // The sources stand first and the layers after them in paint order, bottom to top: each is added under the same
  // layer above, so it lands over the one added before it.
  return (
    <>
      <Source id={WATER_SOURCE_IDS.sea} type="geojson" data={WATER_SEA_URL} />
      <Source id={WATER_SOURCE_IDS.depth} {...WATER_DEPTH_SOURCE} />
      <Source id={WATER_SOURCE_IDS.lakes} type="geojson" data={WATER_LAKES_URL} />
      <Layer id={WATER_LAYER_IDS.sea} type="fill" source={WATER_SOURCE_IDS.sea} filter={WATER_SEA_FILTER} beforeId={beforeId} paint={buildSeaPaint()} />
      <Layer id={WATER_LAYER_IDS.depth} type="color-relief" source={WATER_SOURCE_IDS.depth} beforeId={beforeId} paint={buildSeaDepthPaint()} />
      <Layer
        id={WATER_LAYER_IDS.shallows}
        type="line"
        source={WATER_SOURCE_IDS.sea}
        filter={WATER_COAST_FILTER}
        beforeId={beforeId}
        layout={LINE_LAYOUT}
        paint={buildShallowsPaint()}
      />
      <Layer id={WATER_LAYER_IDS.lakes} type="fill" source={WATER_SOURCE_IDS.lakes} beforeId={beforeId} paint={buildLakePaint()} />
      <Layer
        id={WATER_LAYER_IDS.lakeShore}
        type="line"
        source={WATER_SOURCE_IDS.lakes}
        beforeId={beforeId}
        layout={LINE_LAYOUT}
        paint={buildLakeShorePaint()}
      />
      <Layer
        id={WATER_LAYER_IDS.shore}
        type="line"
        source={WATER_SOURCE_IDS.sea}
        filter={WATER_COAST_FILTER}
        beforeId={beforeId}
        layout={LINE_LAYOUT}
        paint={buildShorePaint()}
      />
    </>
  );
};

export default HistoricalWater;

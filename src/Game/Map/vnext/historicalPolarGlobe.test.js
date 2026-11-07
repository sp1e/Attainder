/*! Open Historia - installed globe tessellation regression, AGPL-3.0-or-later (see LICENSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import geojsonvt from '@maplibre/geojson-vt';
import Point from '@mapbox/point-geometry';
import { classifyRings } from '@maplibre/maplibre-gl-style-spec';
import clipping from 'polygon-clipping';
import { buildRegionRenderRepair } from './regionRenderRepair.js';
import { SHIPPED_START_FOLDERS } from '../../../runtime/testing/shippedHistoricalStarts.js';

// Execute the installed renderer's subdivision and pole-extension implementation,
// not a test-local approximation of its globe triangulation.
const bundle = await build({
  stdin: {
    contents: "export { subdividePolygon, SOUTH_POLE_Y } from 'maplibre-gl/src/render/subdivision.ts';",
    resolveDir: fileURLToPath(new URL('../../../../', import.meta.url)),
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { subdividePolygon, SOUTH_POLE_Y } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const LIMIT = 85.0511287798066;
const BAND = [[[-180, -LIMIT], [180, -LIMIT], [180, LIMIT], [-180, LIMIT], [-180, -LIMIT]]];
const canonical = { z: 2, x: 2, y: 3 };

function globeTriangles(feature) {
  const tile = geojsonvt({ type: 'FeatureCollection', features: [feature] }, {
    maxZoom: 18, tolerance: 0.016, extent: 8192, buffer: 2048,
  }).getTile(canonical.z, canonical.x, canonical.y);
  return (tile?.features ?? []).flatMap(f => classifyRings(
    f.geometry.map(ring => ring.map(([x, y]) => new Point(x, y))), 500,
  ).flatMap(polygon => {
    // VerticalPerspectiveProjection uses max(128 / 2^z, 2) for fills.
    const mesh = subdividePolygon(polygon, canonical, 32);
    const triangles = [];
    for (let i = 0; i < mesh.indicesTriangles.length; i += 3) {
      triangles.push(mesh.indicesTriangles.slice(i, i + 3).map(n => mesh.verticesFlattened.slice(2 * n, 2 * n + 2)));
    }
    return triangles;
  }));
}

function contains(triangles, [x, y]) {
  return triangles.some(([a, b, c]) => {
    const cross = (u, v) => (v[0] - u[0]) * (y - u[1]) - (v[1] - u[1]) * (x - u[0]);
    const p = cross(a, b), q = cross(b, c), r = cross(c, a);
    return (p >= 0 && q >= 0 && r >= 0) || (p <= 0 && q <= 0 && r <= 0);
  });
}

for (const bookmark of SHIPPED_START_FOLDERS) {
  test(`${bookmark} globe tessellation retains Antarctic land and generates the south polar cap`, async () => {
    const data = JSON.parse(readFileSync(new URL(`../../../../server/seed/historical/${bookmark}/regions.geojson`, import.meta.url), 'utf8'));
    const original = data.features.find(f => f.properties.id === 'physical-1378');
    assert.ok(original);
    const before = JSON.stringify(original);
    const expected = globeTriangles({ ...original, geometry: {
      type: 'MultiPolygon', coordinates: clipping.intersection(original.geometry.coordinates, BAND),
    } });
    const repair = await buildRegionRenderRepair({ type: 'FeatureCollection', features: [original] }, { projection: 'globe' });
    const rendered = repair.data.features.find(f => f.properties.id === original.properties.id) ?? original;
    const triangles = globeTriangles(rendered);
    const actualLand = triangles.filter(t => t.every(p => p[1] !== SOUTH_POLE_Y));
    const expectedLand = expected.filter(t => t.every(p => p[1] !== SOUTH_POLE_Y));
    let land = 0, missing = 0;
    for (let y = 64; y < 8192; y += 128) for (let x = 64; x < 8192; x += 128) {
      if (contains(expectedLand, [x, y])) {
        land++;
        if (!contains(actualLand, [x, y])) missing++;
      }
    }
    assert.ok(land > 500);
    assert.ok(missing / land < 0.01, `${missing}/${land} expected land samples missing after installed globe subdivision`);
    const pole = triangles.filter(t => t.some(p => p[1] === SOUTH_POLE_Y));
    assert.ok(pole.length > 0, 'renderer extends the boundary to its special South Pole vertices');
    for (let x = 64; x < 8192; x += 128) {
      assert.ok(contains(pole, [x, 16384]), `polar fan covers longitude sample ${x}`);
    }
    assert.deepEqual(rendered.properties, original.properties);
    assert.equal(JSON.stringify(original), before);
  });
}

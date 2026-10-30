import test from 'node:test';
import assert from 'node:assert/strict';
import inside from '@turf/boolean-point-in-polygon';
import { DYNASTY_CITIES, createDynastyMap, createDynastyWorld, createDynastyScenarioBundle } from './dynastyScenario.js';
import { normalizeWorldState } from './gameState.js';

test('scenario cities and armies occupy their declared provinces', () => {
  const regions = createDynastyMap().features;
  for (const city of DYNASTY_CITIES) {
    const region = regions.find(feature => feature.id === city.regionId);
    assert.ok(region, city.name);
    assert.ok(inside([city.lng,city.lat],region), `${city.name} is inside ${city.regionId}`);
  }
  assert.equal(new Set(regions.map(f=>f.id)).size,12);
});

test('both campaign identities survive ordinary world normalization', () => {
  for (const mode of ['realm','family']) {
    const world = normalizeWorldState(createDynastyWorld({mode}));
    assert.equal(world.characterSystem.identity.mode,mode);
    assert.equal(Object.keys(world.characterSystem.people).length,24);
    assert.equal(Object.keys(world.characterSystem.cities).length,4);
    assert.equal(world.units.length,2);
  }
});

test('portable scenario contains its complete original map and date', () => {
  const bundle = createDynastyScenarioBundle();
  assert.equal(bundle.schema,'open-historia-scenario-bundle/2');
  assert.equal(bundle.data.game.gameDate,'-0300-01-01');
  assert.equal(bundle.assets.regionsGeojson.data.features.length,12);
  assert.equal(bundle.assets.citiesGeojson.data.features.length,4);
  assert.equal(bundle.data.world.background.kind,'vector');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareHistoricalCampaignStart, validatePlayableScenario, validateSavedGameBundle, validateCompanion } from './historicalPreparation.js';

const read = id => JSON.parse(readFileSync(new URL(`./seed/historical/${id}/scenario.json`, import.meta.url), 'utf8'));
const candidate = bundle => ({ data: bundle.data, meta: bundle.scenario, regions: bundle.assets.regionsGeojson.data, cities: bundle.assets.citiesGeojson.data });
for (const id of ['egypt-3000bc', 'john-1200']) test(`${id} prepares one complete detached court`, () => {
  const scenario = candidate(read(id)), before = structuredClone(scenario);
  const result = prepareHistoricalCampaignStart({ request: {}, scenario });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.world.characterSystem.date, scenario.data.game.gameDate);
  assert.equal(result.data.world.characterSystem.startedAt, scenario.data.game.gameDate);
  assert.equal(result.data.world.characterSystem.identity.polityId, scenario.data.game.country);
  assert.deepEqual(scenario, before);
});
test('raw dates, conflicting options, missing sources and actual assets fail before preparation', () => {
  const scenario = candidate(read('john-1200'));
  for (const gamePatch of [{ gameDate: null }, { startDate: '1200-12-31junk' }, { gameDate: '1201-01-01' }, { country: 'France' }]) {
    assert.equal(prepareHistoricalCampaignStart({ request: { gamePatch }, scenario }).ok, false);
  }
  assert.equal(prepareHistoricalCampaignStart({ request: { seedGameId: 'missing' }, scenario }).ok, false);
  assert.equal(prepareHistoricalCampaignStart({ request: { historicalStart: { date: '1200-12-31', polityId: 'johns-realms', difficulty: 'hard' }, gamePatch: { difficulty: 'easy' } }, scenario }).ok, false);
  scenario.cities.features[0].geometry.coordinates = [0,0];
  assert.equal(validatePlayableScenario(scenario).ok, false);
});
test('a historical snapshot seed discards inherited people and runtime history', () => {
  const scenario=candidate(read('john-1200'));
  scenario.data.world.characterSystem={people:{sentinel:{id:'sentinel'}}};
  scenario.data.world.simulationHistory=[{id:'old'}];
  scenario.data.events=[{id:'old-event'}];
  const result=prepareHistoricalCampaignStart({request:{},scenario});
  assert.equal(result.ok,true,result.error);
  assert.equal(result.data.world.characterSystem.people.sentinel,undefined);
  assert.equal(result.data.world.simulationHistory,undefined);
  assert.deepEqual(result.data.events,[]);
});
test('actual legacy saves allow modern current dates and absent world but reject hollow envelopes', () => {
  const schema = 'open-historia-game-bundle/1';
  assert.equal(validateSavedGameBundle({ schema, data: { game: { gameDate: '2032-11-15' } } }).ok, true);
  for (const data of [{}, { game: {} }, { game: { country: 'A' } }, { game: { gameDate: null, startDate: '2032-11-15' } }, { game: { gameDate: '2032-11-15' }, world: [] }]) {
    assert.equal(validateSavedGameBundle({ schema, data }).ok, false);
  }
});
test('companion identity and recorded hub edition bind without requiring a ZIP hub stamp', () => {
  const companion=read('john-1200');
  const origin={postId:42,bundleUrl:'https://example.invalid/old.zip',release:'https://example.invalid/old-release.zip'};
  const saved={schema:'open-historia-game-bundle/1',scenarioRef:{scenarioId:companion.scenario.id,hubOrigin:origin},data:{game:{gameDate:'2032-11-15'}}};
  assert.equal(validateCompanion(saved,companion).ok,true,'hashless ZIP carries matching original ID');
  for (const changed of [
    {...companion,scenario:{...companion.scenario,id:'wrong'}},
    {...companion,hubOrigin:{...origin,postId:43}},
    {...companion,hubOrigin:{...origin,bundleUrl:'https://example.invalid/new.zip'}},
    {...companion,hubOrigin:{...origin,release:'https://example.invalid/new-release.zip'}},
  ]) assert.equal(validateCompanion(saved,changed).ok,false);
  const withHash=structuredClone(saved);
  withHash.data.world={assetProvenance:{regionsGeojson:{hashScope:'authored-release',sha256:'f'.repeat(64)}}};
  assert.equal(validateCompanion(withHash,companion).ok,false,'different recorded authored releases cannot bind');
  withHash.data.world.assetProvenance.regionsGeojson={...companion.data.world.assetProvenance.regionsGeojson,currentAssetStatus:'modified'};
  assert.equal(validateCompanion(withHash,companion).ok,true,'a release digest remains a release digest even when current assets are modified');
  const descriptorOnly=structuredClone(companion);
  delete descriptorOnly.data.world.assetProvenance;
  descriptorOnly.assets.regionsGeojson.provenance={...companion.data.world.assetProvenance.regionsGeojson,sha256:'e'.repeat(64)};
  assert.equal(validateCompanion(withHash,descriptorOnly).ok,false,'descriptor-only release evidence must also match');
  assert.equal(validateCompanion({schema:saved.schema,data:{}},companion).ok,false);
});

test('a matching companion without usable map geometry is refused', () => {
  const companion=read('john-1200');
  const saved={schema:'open-historia-game-bundle/1',scenarioRef:{scenarioId:companion.scenario.id},data:{game:{gameDate:'2032-11-15'}}};
  for (const map of [undefined,{mode:'embedded',data:{type:'FeatureCollection',features:[]}},{mode:'embedded',data:'not-base64',encoding:'base64'}]) {
    const candidate=structuredClone(companion);
    if (map === undefined) delete candidate.assets.regionsGeojson; else candidate.assets.regionsGeojson=map;
    assert.equal(validateCompanion(saved,candidate).ok,false);
  }
  for (const bad of [null,{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:'broken'}},
    {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[0,91],[1,0],[0,1],[0,91]]]}},
    {type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates:[[[[0,0],[1,0],[0,1],[0,0]]],[[[0,0],[1,0],[0,1]]]]}}]) {
    const mixed=structuredClone(companion); mixed.assets.regionsGeojson.data.features.push(bad);
    assert.equal(validateCompanion(saved,mixed).ok,false);
  }
  const absent=structuredClone(companion); delete absent.assets.regionsGeojson;
  const modified=structuredClone(saved); modified.data.world={assetProvenance:{regionsGeojson:{currentAssetStatus:'modified'}}};
  assert.equal(validateCompanion(modified,absent,{fallbackRegions:companion.assets.regionsGeojson.data}).ok,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { historicalAssetManifest, prepareHistoricalCampaignStart, validatePlayableScenario, validateRawStartFields, validateSavedGameBundle, validateCompanion } from './historicalPreparation.js';
import { validateHistoricalStartDate, validateHistoricalStartDates } from './historicalStarts.js';
import { validateHistoricalScenario } from './historicalScenarios.js';
import { createHistoricalCharacterSystem } from './characters/scenarioSeed.js';
import { SHIPPED_START_FOLDERS } from '../src/runtime/testing/shippedHistoricalStarts.js';

const read = id => JSON.parse(readFileSync(new URL(`./seed/historical/${id}/scenario.json`, import.meta.url), 'utf8'));
const candidate = bundle => ({ data: bundle.data, meta: bundle.scenario, regions: bundle.assets.regionsGeojson.data, cities: bundle.assets.citiesGeojson.data });
for (const id of SHIPPED_START_FOLDERS) test(`${id} prepares one complete detached court`, () => {
  const scenario = candidate(read(id)), before = structuredClone(scenario);
  const result = prepareHistoricalCampaignStart({ request: {}, scenario });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.world.characterSystem.date, scenario.data.game.gameDate);
  assert.equal(result.data.world.characterSystem.startedAt, scenario.data.game.gameDate);
  assert.equal(result.data.world.characterSystem.identity.polityId, scenario.data.game.country);
  assert.deepEqual(scenario, before);
});
test('the Charlemagne date passes every new-game guard', () => {
  const scenario = candidate(read('charlemagne-800')), date = '0800-12-25', polityId = 'carolingian-realm';
  assert.deepEqual(validateHistoricalStartDate(date), { ok: true, date, year: 800 });
  assert.deepEqual(validateHistoricalStartDates(scenario.data.game), { ok: true, startDate: date, gameDate: date });
  assert.equal(validateRawStartFields(scenario.data.game, { startDate: date, gameDate: date }, { date }).ok, true);
  assert.equal(validatePlayableScenario(scenario).ok, true);
  const request = { historicalStart: { date, polityId, mode: 'family', seed: 7, difficulty: 'hard' }, gamePatch: { country: polityId, difficulty: 'hard', language: 'Swedish' } };
  const result = prepareHistoricalCampaignStart({ request, scenario });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual([result.data.game.startDate, result.data.game.gameDate, result.data.game.characterMode], [date, date, 'family']);
  assert.equal(result.data.world.characterSystem.identity.polityId, polityId);
  for (const other of ['0800-12-24', '0801-01-01']) {
    assert.equal(prepareHistoricalCampaignStart({ request: { ...request, historicalStart: { ...request.historicalStart, date: other } }, scenario }).ok, false, other);
  }
});
test('each AD 800 polity starts in realm and family mode with its own ruler and succession law', () => {
  const scenario = candidate(read('charlemagne-800')), before = structuredClone(scenario), h = scenario.data.world.historicalScenario;
  const started = {};
  for (const polityId of h.playablePolityIds) for (const mode of ['realm', 'family']) {
    const request = { historicalStart: { date: '0800-12-25', polityId, mode, seed: 7, difficulty: 'normal' }, gamePatch: { country: polityId, difficulty: 'standard', language: 'Swedish' } };
    const result = prepareHistoricalCampaignStart({ request, scenario });
    assert.equal(result.ok, true, `${polityId} ${mode}: ${result.error}`);
    const { identity, realm } = result.data.world.characterSystem;
    assert.deepEqual([result.data.game.country, result.data.game.characterMode, identity.polityId, identity.mode], [polityId, mode, polityId, mode]);
    assert.equal(realm.lawfulRulerId, h.courtSeeds[polityId].rulerId, `${polityId} ${mode}`);
    started[`${polityId} ${mode}`] = [realm.lawfulRulerId, realm.successionLaw];
  }
  assert.deepEqual(started, {
    'carolingian-realm realm': ['karl', 'primogeniture'], 'carolingian-realm family': ['karl', 'primogeniture'],
    'papal-states realm': ['leo-iii', 'merit'], 'papal-states family': ['leo-iii', 'merit'],
  });
  assert.deepEqual(scenario, before);
});
test('a new Charlemagne campaign keeps only the chosen court and still validates', () => {
  const scenario = candidate(read('charlemagne-800')), before = structuredClone(scenario), h = scenario.data.world.historicalScenario;
  const date = '0800-12-25';
  for (const polityId of ['papal-states', 'carolingian-realm']) for (const mode of ['realm', 'family']) {
    const label = `${polityId} ${mode}`;
    const request = { historicalStart: { date, polityId, mode, seed: 7, difficulty: 'normal' }, gamePatch: { country: polityId, difficulty: 'standard', language: 'Swedish' } };
    const result = prepareHistoricalCampaignStart({ request, scenario });
    assert.equal(result.ok, true, `${label}: ${result.error}`);
    const saved = result.data.world.historicalScenario;
    assert.deepEqual(saved.playablePolityIds, [polityId], label);
    assert.deepEqual(Object.keys(saved.courtSeeds), [polityId], label);
    assert.deepEqual(saved.courtSeeds[polityId], h.courtSeeds[polityId], label);
    assert.equal(saved.polities.length, 10, label);
    assert.deepEqual({ ...saved, playablePolityIds: h.playablePolityIds, courtSeeds: h.courtSeeds }, h, `${label}: other fields stay whole`);
    assert.deepEqual(result.data.world.characterSystem,
      createHistoricalCharacterSystem({ historicalScenario: h, date, polityId, mode, seed: 7, difficulty: 'normal' }), `${label}: same draws as the full scenario`);
    const checked = validateHistoricalScenario({ game: result.data.game, world: result.data.world, regions: scenario.regions,
      assetManifest: historicalAssetManifest(result.data.world) }, { date, polityId });
    assert.equal(checked.ok, true, `${label}: ${checked.error}`);
  }
  assert.deepEqual(scenario, before);
});
test('a court start text becomes the campaign text and the world briefing; without one both stay', () => {
  const scenario = candidate(read('charlemagne-800')), h = scenario.data.world.historicalScenario, date = '0800-12-25';
  const papalText = 'Leo III styr Kyrkostaten från Rom.';
  h.courtSeeds['papal-states'].contextSv = papalText;
  h.courtSeeds['papal-states'].contextSourceIds = Object.keys(h.sources).slice(0, 1);
  const before = structuredClone(scenario);
  const prepare = polityId => prepareHistoricalCampaignStart({ scenario, request: {
    historicalStart: { date, polityId, mode: 'realm', seed: 7, difficulty: 'normal' }, gamePatch: { country: polityId, difficulty: 'standard', language: 'Swedish' } } });
  const papal = prepare('papal-states');
  assert.equal(papal.ok, true, papal.error);
  assert.equal(papal.data.world.historicalScenario.contextSv, papalText);
  assert.equal(papal.data.world.startingTimelineText, [papalText, h.calendarNoteSv, h.coverageNoteSv].join('\n'));
  const checked = validateHistoricalScenario({ game: papal.data.game, world: papal.data.world, regions: scenario.regions,
    assetManifest: historicalAssetManifest(papal.data.world) }, { date, polityId: 'papal-states' });
  assert.equal(checked.ok, true, checked.error);
  const karl = prepare('carolingian-realm');
  assert.equal(karl.ok, true, karl.error);
  assert.equal(karl.data.world.historicalScenario.contextSv, h.contextSv);
  assert.equal(karl.data.world.startingTimelineText, scenario.data.world.startingTimelineText);
  assert.deepEqual(scenario, before);
});
test('raw dates, conflicting options, missing sources and actual assets fail before preparation', () => {
  const scenario = candidate(read('john-1200'));
  for (const gamePatch of [{ gameDate: null }, { startDate: '1200-12-31junk' }, { gameDate: '1531-01-01' }, { country: 'France' }]) {
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

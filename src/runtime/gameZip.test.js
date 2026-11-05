import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const source=text=>`data:text/javascript,${encodeURIComponent(text)}`;
registerHooks({resolve(specifier,context,next){
  if (String(context.parentURL).endsWith('/runtime/gameZip.js')) {
    if (specifier === './library.js') return {url:source(`export const exportGameBundle=async()=>structuredClone(globalThis.__zipFixture.game); export const readGameSnapshotsText=async()=>''; export const exportScenarioBundle=async()=>{globalThis.__zipFixture.fetches++;return structuredClone(globalThis.__zipFixture.scenario);};`),shortCircuit:true};
    if (specifier === './debugLog.js') return {url:source(`export const buildSettingsReport=async()=>'';`),shortCircuit:true};
  }
  return next(specifier,context);
}});
const {buildGameZipBlob,readGameZip}=await import('./gameZip.js');
const regions={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'x'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]};
const setup=ref=>{globalThis.__zipFixture={game:{schema:'open-historia-game-bundle/1',data:{game:{gameDate:'1200-01-01'}},scenarioRef:ref},scenario:{schema:'open-historia-scenario-bundle/2',scenario:{id:'default'},data:{game:{},world:{}},assets:{regionsGeojson:{mode:'embedded',data:regions}}},fetches:0};};
test('built-in and hub-linked maps accompany newly exported games',async()=>{
  for(const ref of [{scenarioId:'default',builtIn:true,scenarioBytes:1024},{scenarioId:'default',hubOrigin:{postId:1},scenarioBytes:1024}]) {
    setup(ref);const result=await buildGameZipBlob('game',{confirmCarryingScenario:()=>assert.fail('known map exports do not require a new confirmation')}); assert.equal(result.carriesScenario,true); assert.equal(globalThis.__zipFixture.fetches,1);
    const decoded=await readGameZip(await result.blob.arrayBuffer()); assert.deepEqual(decoded.scenarioBundle.assets.regionsGeojson.data,regions);
  }
});
test('oversize and missing maps are omitted without fetching a scenario',async()=>{
  setup({scenarioId:'default',builtIn:true,scenarioBytes:33*1024*1024}); let result=await buildGameZipBlob('game');
  assert.equal(globalThis.__zipFixture.fetches,0); assert.ok(result.oversizeScenario); assert.equal(result.carriesScenario,false);
  setup({scenarioId:'unknown',missing:true}); result=await buildGameZipBlob('game');
  assert.equal(globalThis.__zipFixture.fetches,0); assert.ok(result.omittedScenario); assert.equal(result.carriesScenario,false);
  setup({scenarioId:'default',scenarioBytes:1024}); globalThis.__zipFixture.scenario.assets.regionsGeojson={mode:'default'};
  result=await buildGameZipBlob('game'); assert.equal(result.carriesScenario,false); assert.equal(result.omittedScenario.reason,'invalidMap');
  setup({scenarioId:'default',scenarioBytes:1024}); globalThis.__zipFixture.scenario.scenario.id='other';
  result=await buildGameZipBlob('game'); assert.equal(result.carriesScenario,false); assert.equal(result.omittedScenario.reason,'invalidMap');
});

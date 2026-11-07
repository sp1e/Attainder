import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installFakeIndexedDb } from './fakeIndexedDb.js';

test('fresh web store starts the three shipped historical bookmarks with their courts', async () => {
  execFileSync(process.execPath,[fileURLToPath(new URL('../../../scripts/seed-web-defaults.mjs',import.meta.url))]);
  const fake=installFakeIndexedDb();
  const originalFetch=globalThis.fetch;
  let store;
  globalThis.fetch=async input => {
    const url=String(input);
    if (url.startsWith('file:')) return new Response(await readFile(new URL(url)));
    if (url.startsWith('/api/')) {
      const [,resource,...segments]=url.split('/').filter(Boolean);
      const handler=resource==='games' ? store?.handleGames : resource==='scenarios' ? store?.handleScenarios : null;
      if (handler) return handler({method:'GET',segments,query:new URLSearchParams()});
      return new Response('Unavailable',{status:503});
    }
    return originalFetch(input);
  };
  try {
    store=await import('./libraryStore.js');
    await store.ensureSeeded();
    const call=async(method,segments,body)=>{
      const response=await store.handleGames({method,segments,body,query:new URLSearchParams()});
      const data=await response.json(); assert.ok(response.ok,JSON.stringify(data)); return data;
    };
    const library=async()=>(await store.handleLibrary({method:'GET'})).json();
    const starts=async()=>(await library()).scenarios.filter(s=>s.historicalStart).map(s=>[s.id,s.historicalStart.contentId,s.historicalStart.date]);
    const offered=[['default','john-1200','1200-12-31'],['egypt-3000bc','egypt-3000bc','-3000-01-01'],['charlemagne-800','charlemagne-800','0800-12-25']];
    assert.deepEqual(await starts(),offered);
    assert.equal((await library()).selectedScenarioId,'charlemagne-800');
    const generated=new URL('./generated/historicalBookmarks.js',import.meta.url);
    const {default:bookmarks}=await import(generated);
    assert.deepEqual(bookmarks.map(b=>b.scenario.id),['egypt-3000bc','charlemagne-800']);
    assert.ok(statSync(generated).size < 25*1024*1024,'Cloudflare Pages refuses a file over 25 MiB');
    const games={};
    for (const [request,date] of [[{},'1200-12-31'],[{scenarioId:'egypt-3000bc'},'-3000-01-01'],[{scenarioId:'charlemagne-800'},'0800-12-25']]) {
      const made=await call('POST',[],request);
      games[request.scenarioId ?? 'john']=made.game.id;
      assert.equal(made.data.game.startDate,date); assert.equal(made.data.game.gameDate,date);
      assert.equal(made.data.world.characterSystem.date,date); assert.equal(made.data.world.characterSystem.startedAt,date);
      assert.equal(made.data.world.characterSystem.identity.polityId,made.data.game.country);
      const loaded=await call('GET',[made.game.id]); assert.deepEqual(loaded.data.world.characterSystem,made.data.world.characterSystem);
      if (!request.scenarioId) {
        assert.ok((await call('GET',[made.game.id,'export'])).scenarioRef.scenarioBytes > 100000,'bundled regions count toward the ZIP limit');
        const {buildGameZipBlob,readGameZip}=await import('../gameZip.js');
        const zip=await buildGameZipBlob(made.game.id); assert.equal(zip.carriesScenario,true);
        const decoded=await readGameZip(await zip.blob.arrayBuffer());
        assert.ok(decoded.scenarioBundle.assets.regionsGeojson.data.features.length > 0);
        const root=mkdtempSync(path.join(os.tmpdir(),'attainder-web-zip-'));
        const previous=process.env.OH_DATA_DIR; process.env.OH_DATA_DIR=root;
        try {
          const desktop=await import('../../../server/libraryStore.js');
          const restored=desktop.restoreGameBundle({bundle:decoded.bundle,scenarioBundle:decoded.scenarioBundle});
          assert.deepEqual(restored.data.world.characterSystem,made.data.world.characterSystem);
        } finally { if (previous===undefined) delete process.env.OH_DATA_DIR; else process.env.OH_DATA_DIR=previous; rmSync(root,{recursive:true,force:true}); }
      }
    }
    const {idbDelete,idbPut,kvGet,STORES}=await import('./idb.js');
    // An install from before this start: the Egypt marker stands, Charlemagne is absent.
    const remove=async id=>assert.ok((await store.handleScenarios({method:'DELETE',segments:[id],query:new URLSearchParams()})).ok);
    await call('DELETE',[games['charlemagne-800']]);
    await remove('charlemagne-800'); await idbDelete(STORES.kv,'historical-bookmarks-charlemagne-800');
    assert.deepEqual(await starts(),offered.slice(0,2));
    assert.equal(await kvGet('historical-bookmarks-v1',false),true);
    const johnBefore=await call('GET',[games.john]);
    await store.ensureSeeded();
    assert.deepEqual(await starts(),offered,'the upgrade adds Charlemagne once and leaves Egypt installed');
    assert.equal((await library()).selectedScenarioId,'charlemagne-800');
    const johnAfter=await call('GET',[games.john]);
    assert.equal(johnAfter.game.scenarioId,'default'); assert.deepEqual(johnAfter.data,johnBefore.data);
    // A second tab or an interrupted install: the scenario stands and its marker is unset.
    await idbDelete(STORES.kv,'historical-bookmarks-charlemagne-800');
    await store.ensureSeeded();
    assert.deepEqual(await starts(),offered,'an installed start gains no second copy');
    assert.equal((await library()).scenarios.some(s=>s.id==='charlemagne-800-2'),false);
    assert.equal(await kvGet('historical-bookmarks-charlemagne-800',false),true);
    // A deleted start stays deleted: the marker, not the scenario, records the installation.
    await remove('charlemagne-800'); await store.ensureSeeded();
    assert.deepEqual(await starts(),offered.slice(0,2));
    // Upgrade an existing web install whose geometry used the previous bundled map.
    fake.clear();
    const oldWorld={builtInMap:'modern-day-world-2026-10-v1',ownerSchema:4,regionOwnershipOverrides:{legacy:'Old'},characterSystem:{people:{a:{name:'A'}}}};
    await idbPut(STORES.scenarios,{id:'default',meta:{id:'default',name:'Modern Day',createdAt:'2026-01-01',updatedAt:'2026-01-01'},json:{world:oldWorld,game:{country:'Old',gameDate:'2016-01-01'}},geojson:{}});
    await idbPut(STORES.games,{id:'old',meta:{id:'old',name:'Old',scenarioId:'default'},json:{game:{country:'Old',gameDate:'2032-11-15'},world:oldWorld,events:[{patch:{n:1}}]}});
    await idbPut(STORES.kv,{key:'seeded',value:true});
    await idbPut(STORES.kv,{key:'game-manifest',value:{activeGameId:'old',order:['old']}});
    await store.ensureSeeded();
    const old=await call('GET',['old']);
    assert.notEqual(old.game.scenarioId,'default'); assert.deepEqual(old.data.world,oldWorld); assert.deepEqual(old.data.events,[{patch:{n:1}}]);
    const response=await store.handleRuntimeJson({method:'GET',segments:['json','regionsGeojson']});
    assert.ok(response.ok);
    const geometry=await response.json();
    const expected=JSON.parse(await readFile(new URL('../../../server/seed/earlier/modern-day-world-2026-10-v1.geojson',import.meta.url),'utf8'));
    assert.deepEqual(geometry,expected);
    const saved={schema:'open-historia-game-bundle/1',scenarioRef:{scenarioId:'legacy-map'},data:{game:{gameDate:'2032-11-15'},world:{builtInMap:'modern-day-world-2026-10-v1'}}};
    const companion={schema:'open-historia-scenario-bundle/2',scenario:{id:'legacy-map'},data:{game:{},world:{builtInMap:'modern-day-world-2026-10-v1'}},assets:{}};
    const restored=await call('POST',['restore'],{bundle:saved,scenarioBundle:companion});
    const mapReply=await store.handleScenarios({method:'GET',segments:[restored.game.scenarioId,'assets','regionsGeojson'],query:new URLSearchParams()});
    assert.ok(mapReply.ok); assert.deepEqual(await mapReply.json(),expected);
    assert.equal((await call('GET',[])).activeGameId,'old');
  } finally { globalThis.fetch=originalFetch; }
});

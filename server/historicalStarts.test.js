import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('server prepares both historical courts and refuses invalid requests without writes', () => {
  const root = mkdtempSync(path.join(os.tmpdir(),'attainder-historical-'));
  try {
    execFileSync(process.execPath, ['--input-type=module','-e', `
      import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
      import * as store from ${JSON.stringify(new URL('./libraryStore.js',import.meta.url).href)};
      assert.throws(()=>store.createGame({gamePatch:{gameDate:null}}));
      assert.deepEqual(fs.readdirSync(path.join(process.env.OH_DATA_DIR,'games')),[],'rejected first request creates no campaign');
      store.ensureGameStore();
      const snapshot = () => { const out={}; const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else out[q]=fs.readFileSync(q).toString('base64');}};walk(process.env.OH_DATA_DIR);return out; };
      { const before=snapshot(); assert.throws(()=>store.writeRuntimeJsonAsset('game',{gameDate:'2016-01-01'})); assert.deepEqual(snapshot(),before); }
      for (const request of [
        {gamePatch:{gameDate:'2016-01-01'}},{gamePatch:{gameDate:'-3301-01-01'}},{gamePatch:{startDate:'0000-01-01'}},
        {gamePatch:{startDate:'1200-12-30'}},{gamePatch:{gameDate:'1200-12-31junk'}},{gamePatch:null},
        {seedGameId:'missing'},{scenarioId:'missing'},{historicalStart:null},{gamePatch:{startDate:null}},
        {historicalStart:{date:'1200-12-30'}},{historicalStart:{polityId:'unknown'}},
        {historicalStart:{mode:'bad'}},{historicalStart:{seed:0}},{historicalStart:{difficulty:'hard'},gamePatch:{difficulty:'easy'}}
      ]) {
        const before=snapshot(); assert.throws(()=>store.createGame(request)); assert.deepEqual(snapshot(),before);
      }
      const world=store.getScenarioDetails('default').data.world;
      { const before=snapshot(); assert.throws(()=>store.createScenario({worldPatch:{polityOverrides:{...world.polityOverrides,modern:{name:'Modern'}}}})); assert.deepEqual(snapshot(),before); }
      const authored=JSON.parse(fs.readFileSync(${JSON.stringify(fileURLToPath(new URL('./seed/historical/john-1200/scenario.json',import.meta.url)))},'utf8'));
      const ownExport=store.exportScenarioBundle('default');
      assert.equal(ownExport.assets.cover.contentType,'image/jpeg');
      assert.ok(store.importScenarioBundle(ownExport,{setSelected:false}).scenario.id);
      const invalidBundle=structuredClone(authored); invalidBundle.data.game.gameDate=null;
      const invalidScenarioCover=structuredClone(authored); invalidScenarioCover.assets.cover={mode:'embedded',encoding:'base64',data:'@@@'};
      const forged=structuredClone(authored); forged.data.game.startDate=forged.data.game.gameDate='2016-01-01'; forged.restoreOnly=true; forged.skipValidation=true;
      for (const run of [()=>store.createScenario({gamePatch:{gameDate:null}}),()=>store.updateScenario('default',{gamePatch:{startDate:'1201-01-01'}}),
        ()=>store.importScenarioBundle(invalidBundle),()=>store.importScenarioBundle(invalidScenarioCover),()=>store.importScenarioBundle(forged),()=>store.updateScenarioFromBundle('default',invalidBundle)]) {
        const before=snapshot(); assert.throws(run); assert.deepEqual(snapshot(),before);
      }
      const { buildPromptContext } = await import(${JSON.stringify(new URL('../src/Game/AI/promptContext.js',import.meta.url).href)});
      const { renderTemplateCached } = await import(${JSON.stringify(new URL('../src/Game/AI/promptLayout.js',import.meta.url).href)});
      const prompts=JSON.parse(fs.readFileSync(${JSON.stringify(fileURLToPath(new URL('../src/Game/AI/defaultPrompts.json',import.meta.url)))},'utf8'));
      const checkLanguage = async (created, expected) => {
        assert.equal(created.data.game.language,expected); assert.equal(created.data.world.language,expected);
        const context=await buildPromptContext(created.data,{requiredKeys:['language']}); assert.equal(context.language,expected);
        assert.ok(renderTemplateCached(prompts.tasks.jumpForward,context).text.includes('Write everything the player reads in '+expected));
      };
      const a=store.createGame({gamePatch:{language:'Swedish'}}); assert.equal(a.data.game.gameDate,'1200-12-31'); assert.equal(a.data.world.characterSystem.date,'1200-12-31');
      await checkLanguage(a,'Swedish'); await checkLanguage(store.createGame({}),'Svenska'); await checkLanguage(store.createGame({gamePatch:{language:'French'}}),'French');
      const b=store.createGame({scenarioId:'egypt-3000bc'}); assert.equal(b.data.world.characterSystem.date,'-3000-01-01');
      const snapshotScenario=store.createScenario({name:'Snapshot seed'});
      store.updateScenario(snapshotScenario.scenario.id,{worldPatch:{characterSystem:{people:{sentinel:{id:'sentinel'}}},simulationHistory:[{id:'old'}]},storage:{events:[{id:'old'}]}});
      const fresh=store.createGame({scenarioId:snapshotScenario.scenario.id});
      assert.equal(fresh.data.world.characterSystem.people.sentinel,undefined); assert.equal(fresh.data.world.simulationHistory,undefined); assert.deepEqual(fresh.data.events,[]);
      const synthetic=JSON.parse(fs.readFileSync(${JSON.stringify(fileURLToPath(new URL('./seed/historical/egypt-3000bc/scenario.json',import.meta.url)))},'utf8'));
      synthetic.scenario.id='synthetic-boundary'; synthetic.scenario.name='TEST ONLY: synthetic lower boundary';
      synthetic.data.game.startDate=synthetic.data.game.gameDate='-3300-01-01';
      synthetic.data.world.historicalScenario.bookmarkDate='-3300-01-01';
      for (const court of Object.values(synthetic.data.world.historicalScenario.courtSeeds)) for (const person of court.people) if (person.bornAt) person.bornAt=person.bornAt.replace(/^-([0-9]{4})/,(_,year)=>'-'+String(Number(year)+300).padStart(4,'0'));
      const bound=store.importScenarioBundle(synthetic); const earliest=store.createGame({scenarioId:bound.scenario.id});
      assert.equal(earliest.data.world.characterSystem.date,'-3300-01-01');
      for (const request of [{seedGameId:a.game.id,gamePatch:{difficulty:'hard'}},{seedGameId:a.game.id,historicalStart:{mode:'realm'}}]) {
        const before=snapshot(); assert.throws(()=>store.createGame(request)); assert.deepEqual(snapshot(),before);
      }
      store.setActiveGame(a.game.id);
      for (const run of [()=>store.updateScenario('default',{gamePatch:{gameDate:null}}),()=>store.removeScenarioAsset('default','citiesGeojson'),()=>store.importGameBundle({schema:'open-historia-game-bundle/1',data:{}})]) {
        const before=snapshot(); assert.throws(run); assert.deepEqual(snapshot(),before);
      }
      { const before=snapshot(); assert.throws(()=>store.writeRuntimeJsonAsset('citiesGeojson',{type:'FeatureCollection',features:[]})); assert.deepEqual(snapshot(),before); }
      const legacy={schema:'open-historia-game-bundle/1',game:{name:'Legacy'},scenarioRef:{scenarioId:'default'},data:{game:{gameDate:'2032-11-15',language:'French'},world:{language:'German',characterSystem:{people:{a:{name:'A'}}}},events:[{patch:{value:7}}]}};
      const companion=JSON.parse(fs.readFileSync(${JSON.stringify(fileURLToPath(new URL('./seed/historical/john-1200/scenario.json',import.meta.url)))},'utf8')); companion.scenario.id='default';
      const hashSave=structuredClone(legacy); hashSave.data.world.assetProvenance={regionsGeojson:{hashScope:'authored-release',sha256:'f'.repeat(64)}};
      const hashWaiting=store.importGameBundle(hashSave);
      { const before=snapshot(); assert.throws(()=>store.restoreGameBundle({bundle:hashSave,scenarioBundle:companion})); assert.throws(()=>store.restoreScenarioForGame(hashWaiting.game.id,companion)); assert.deepEqual(snapshot(),before); }
      fs.mkdirSync(path.join(process.env.OH_DATA_DIR,'games','hollow'),{recursive:true});
      fs.writeFileSync(path.join(process.env.OH_DATA_DIR,'games','hollow','game-instance.json'),JSON.stringify({id:'hollow',scenarioId:'default'}));
      fs.writeFileSync(path.join(process.env.OH_DATA_DIR,'games','hollow','game.json'),'{}');
      { const before=snapshot(); assert.throws(()=>store.restoreScenarioForGame('hollow',companion)); assert.deepEqual(snapshot(),before); }
      for (const data of [{},{game:{}},{game:{country:'Testland'}},{game:{gameDate:null,startDate:'2032-11-15'}}]) {
        const before=snapshot(); assert.throws(()=>store.importGameBundle({schema:legacy.schema,data})); assert.throws(()=>store.restoreGameBundle({bundle:{schema:legacy.schema,data},scenarioBundle:companion})); assert.deepEqual(snapshot(),before);
      }
      const wrong=structuredClone(companion); wrong.scenario.id='wrong';
      { const before=snapshot(); assert.throws(()=>store.restoreGameBundle({bundle:legacy,scenarioBundle:wrong})); assert.deepEqual(snapshot(),before); }
      const restored=store.restoreGameBundle({bundle:legacy,scenarioBundle:companion});
      assert.notEqual(restored.game.scenarioId,'default'); assert.deepEqual(restored.data.world,legacy.data.world); assert.deepEqual(restored.data.events,legacy.data.events);
      { const before=snapshot(); assert.throws(()=>store.createGame({scenarioId:restored.game.scenarioId})); assert.deepEqual(snapshot(),before); }
      const omitted=store.importGameBundle({schema:legacy.schema,data:{game:{gameDate:'2032-11-15'}}});
      assert.deepEqual(omitted.data.world,{}); assert.deepEqual(store.exportGameBundle(omitted.game.id).data.world,{});
      assert.equal(omitted.game.scenarioMissing,true,'an unstamped old default must not acquire the new historical map');
      const oldDefault=store.importGameBundle(legacy);
      assert.equal(oldDefault.game.scenarioMissing,true);
      const sameStamp=structuredClone(legacy); sameStamp.data.world.builtInMap='historical-john-1200-v1';
      sameStamp.data.world.assetProvenance={regionsGeojson:{currentAssetStatus:'modified'}};
      assert.equal(store.importGameBundle(sameStamp).game.scenarioMissing,true,'a retained built-in marker does not establish current map identity');
      const oldCopy=store.createGame({seedGameId:oldDefault.game.id});
      assert.equal(oldCopy.game.scenarioMissing,true); assert.equal(store.exportGameBundle(oldCopy.game.id).scenarioRef.scenarioId,'default');
      const associated=store.restoreScenarioForGame(oldCopy.game.id,companion);
      assert.notEqual(associated.game.scenarioId,'default'); assert.deepEqual(associated.data.world,legacy.data.world);
      const missing=store.importGameBundle({...legacy,scenarioRef:{scenarioId:'long-gone'}});
      const copy=store.createGame({seedGameId:missing.game.id});
      assert.equal(copy.game.scenarioMissing,true); assert.equal(store.exportGameBundle(copy.game.id).scenarioRef.scenarioId,'long-gone'); assert.deepEqual(copy.data.world,legacy.data.world); assert.deepEqual(copy.data.events,legacy.data.events);
      const arriving=structuredClone(authored); arriving.scenario.id='long-gone'; store.importScenarioBundle(arriving,{setSelected:false});
      assert.equal(store.getGameDetails(missing.game.id).game.scenarioMissing,true,'later original-ID installation must not bind the old game');
      const collision=store.importGameBundle({...legacy,scenarioRef:{scenarioId:'egypt-3000bc'}});
      assert.equal(collision.game.scenarioMissing,true,'same non-default ID alone does not prove map identity');
      assert.equal(store.exportGameBundle(collision.game.id).scenarioRef.scenarioId,'egypt-3000bc');
      const placeholder=structuredClone(authored); placeholder.scenario.id=collision.game.scenarioId;
      store.importScenarioBundle(placeholder,{setSelected:false});
      assert.equal(store.getGameDetails(collision.game.id).game.scenarioMissing,true,'later placeholder collision must stay unresolved');
      assert.equal(store.exportGameBundle(collision.game.id).scenarioRef.scenarioId,'egypt-3000bc');
      store.setActiveGame(collision.game.id);
      const beforeRead=store.getGameDetails(collision.game.id).data.world;
      assert.deepEqual(store.readRuntimeJsonAsset('regionsGeojson').data,{type:'FeatureCollection',features:[]});
      assert.throws(()=>store.resolveRuntimeBinaryAsset('regions'));
      assert.deepEqual(store.getGameDetails(collision.game.id).data.world,beforeRead);
      store.setActiveGame(a.game.id);
      const missingMap=structuredClone(authored); missingMap.scenario.id='long-gone'; delete missingMap.assets.regionsGeojson;
      const invalidMap=structuredClone(missingMap); invalidMap.assets.regionsGeojson={mode:'embedded',data:{type:'FeatureCollection',features:[]}};
      const invalidEncoded=structuredClone(missingMap); invalidEncoded.assets.regionsGeojson={mode:'embedded',encoding:'base64',data:'@@@'};
      const invalidCover=structuredClone(authored); invalidCover.scenario.id='long-gone'; invalidCover.assets.cover={mode:'embedded',data:'@@@',encoding:'base64',contentType:'application/octet-stream'};
      const mixedNull=structuredClone(authored); mixedNull.scenario.id='long-gone'; mixedNull.assets.regionsGeojson.data.features.push(null);
      const mixedBroken=structuredClone(authored); mixedBroken.scenario.id='long-gone'; mixedBroken.assets.regionsGeojson.data.features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:'broken'}});
      for (const map of [missingMap,invalidMap,invalidEncoded,invalidCover,mixedNull,mixedBroken]) {
        const before=snapshot(); const rejected=run=>{try { run(); return false; } catch { return true; }};
        const combinedRejected=rejected(()=>store.restoreGameBundle({bundle:{...legacy,scenarioRef:{scenarioId:'long-gone'}},scenarioBundle:map}));
        const existingRejected=rejected(()=>store.restoreScenarioForGame(missing.game.id,map));
        assert.deepEqual([combinedRejected,existingRejected],[true,true]); assert.deepEqual(snapshot(),before);
      }
      const stamped=structuredClone(missingMap); stamped.data.world={builtInMap:'modern-day-world-2026-10-v1'};
      const stampedSave={...legacy,scenarioRef:{scenarioId:'long-gone'},data:{...legacy.data,world:{...legacy.data.world,builtInMap:'modern-day-world-2026-10-v1'}}};
      const registryRestore=store.restoreGameBundle({bundle:stampedSave,scenarioBundle:stamped});
      assert.ok(store.getScenarioDetails(registryRestore.game.scenarioId).assetStatus.regionsGeojson);
      assert.equal(store.exportScenarioBundle(registryRestore.game.scenarioId).assets.regionsGeojson.data.features.length,3662);
      const waiting=store.importGameBundle(stampedSave); const linked=store.restoreScenarioForGame(waiting.game.id,stamped);
      assert.ok(store.getScenarioDetails(linked.game.scenarioId).assetStatus.regionsGeojson);
      const conflicting=structuredClone(stamped); conflicting.assets.regionsGeojson={mode:'embedded',data:{type:'FeatureCollection',features:[]}};
      const waitingConflict=store.importGameBundle(stampedSave);
      { const before=snapshot(); assert.throws(()=>store.restoreGameBundle({bundle:stampedSave,scenarioBundle:conflicting})); assert.throws(()=>store.restoreScenarioForGame(waitingConflict.game.id,conflicting)); assert.deepEqual(snapshot(),before); }
      const missingEdited=structuredClone(stamped); missingEdited.data.world.assetProvenance={regionsGeojson:{currentAssetStatus:'modified'}};
      { const before=snapshot(); assert.throws(()=>store.restoreGameBundle({bundle:stampedSave,scenarioBundle:missingEdited})); assert.throws(()=>store.restoreScenarioForGame(waitingConflict.game.id,missingEdited)); assert.deepEqual(snapshot(),before); }
      const unknown=structuredClone(stamped); unknown.data.world.builtInMap='unknown-map';
      const unknownSave={...stampedSave,data:{...stampedSave.data,world:{...stampedSave.data.world,builtInMap:'unknown-map'}}};
      const unknownWaiting=store.importGameBundle(unknownSave);
      { const before=snapshot(); assert.throws(()=>store.restoreGameBundle({bundle:unknownSave,scenarioBundle:unknown})); assert.throws(()=>store.restoreScenarioForGame(unknownWaiting.game.id,unknown)); assert.deepEqual(snapshot(),before); }
      const encoded=structuredClone(authored); encoded.scenario.id='long-gone'; encoded.assets.regionsGeojson.data=Buffer.from(JSON.stringify(encoded.assets.regionsGeojson.data)).toString('base64'); encoded.assets.regionsGeojson.encoding='base64';
      assert.ok(store.restoreGameBundle({bundle:{...legacy,scenarioRef:{scenarioId:'long-gone'}},scenarioBundle:encoded}).game.id);
      assert.equal(store.getGameCatalog().activeGameId,a.game.id);
    `], { env: { ...process.env, OH_DATA_DIR: root }, stdio: 'pipe', encoding: 'utf8' });
  } finally { rmSync(root,{recursive:true,force:true}); }
  assert.ok(true);
});

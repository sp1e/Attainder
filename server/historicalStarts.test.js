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
      const invalidBundle=structuredClone(authored); invalidBundle.data.game.gameDate=null;
      const forged=structuredClone(authored); forged.data.game.startDate=forged.data.game.gameDate='2016-01-01'; forged.restoreOnly=true; forged.skipValidation=true;
      for (const run of [()=>store.createScenario({gamePatch:{gameDate:null}}),()=>store.updateScenario('default',{gamePatch:{startDate:'1201-01-01'}}),
        ()=>store.importScenarioBundle(invalidBundle),()=>store.importScenarioBundle(forged),()=>store.updateScenarioFromBundle('default',invalidBundle)]) {
        const before=snapshot(); assert.throws(run); assert.deepEqual(snapshot(),before);
      }
      const a=store.createGame({}); assert.equal(a.data.game.gameDate,'1200-12-31'); assert.equal(a.data.world.characterSystem.date,'1200-12-31');
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
      const legacy={schema:'open-historia-game-bundle/1',game:{name:'Legacy'},scenarioRef:{scenarioId:'default'},data:{game:{gameDate:'2032-11-15'},world:{characterSystem:{people:{a:{name:'A'}}}},events:[{patch:{value:7}}]}};
      const companion=JSON.parse(fs.readFileSync(${JSON.stringify(fileURLToPath(new URL('./seed/historical/john-1200/scenario.json',import.meta.url)))},'utf8')); companion.scenario.id='default';
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
      const oldCopy=store.createGame({seedGameId:oldDefault.game.id});
      assert.equal(oldCopy.game.scenarioMissing,true); assert.equal(store.exportGameBundle(oldCopy.game.id).scenarioRef.scenarioId,'default');
      const associated=store.restoreScenarioForGame(oldCopy.game.id,companion);
      assert.notEqual(associated.game.scenarioId,'default'); assert.deepEqual(associated.data.world,legacy.data.world);
      const missing=store.importGameBundle({...legacy,scenarioRef:{scenarioId:'long-gone'}});
      const copy=store.createGame({seedGameId:missing.game.id});
      assert.equal(copy.game.scenarioId,'long-gone'); assert.deepEqual(copy.data.world,legacy.data.world); assert.deepEqual(copy.data.events,legacy.data.events);
    `], { env: { ...process.env, OH_DATA_DIR: root }, stdio: 'pipe', encoding: 'utf8' });
  } finally { rmSync(root,{recursive:true,force:true}); }
  assert.ok(true);
});

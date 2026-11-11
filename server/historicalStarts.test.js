import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORICAL_BOOKMARKS, contentFingerprint, shippedStartEdited, shippedStartNeedsUpgrade } from './historicalStarts.js';
import { charlemagneRelease110, charlemagneRelease120, charlemagneRelease130, egyptRelease100, world1500Release100, world1500Release110 } from './fixtures/releaseFixtures.js';

test('each shipped start names the content version its built package carries', () => {
  assert.deepEqual(HISTORICAL_BOOKMARKS.map(({ id, contentVersion }) => [id,contentVersion]),[['egypt-3000bc','1.1.0'],['charlemagne-800','1.4.0'],['world-1500','1.2.0']]);
  for (const { id, contentVersion } of HISTORICAL_BOOKMARKS) {
    const built = JSON.parse(readFileSync(new URL(`./seed/historical/${id}/scenario.json`,import.meta.url),'utf8'));
    const manifest = JSON.parse(readFileSync(new URL(`./seed/historical/${id}/manifest.json`,import.meta.url),'utf8'));
    assert.equal(built.data.world.historicalScenario.contentId,id);
    assert.equal(built.data.world.historicalScenario.contentVersion,contentVersion,id);
    assert.equal(manifest.contentVersion,contentVersion,id);
  }
});

test('only an older copy of the same shipped start needs an upgrade', () => {
  const entry = { id: 'charlemagne-800', marker: 'historical-bookmarks-charlemagne-800', contentVersion: '1.10.0' };
  const stored = (historicalScenario, meta = {}) => ({ meta, data: { world: { historicalScenario } } });
  const copy = contentVersion => stored({ kind: 'historical', contentId: 'charlemagne-800', contentVersion });
  for (const version of ['1.0.0','1.9.0','1.9','0.99.99']) assert.equal(shippedStartNeedsUpgrade(copy(version),entry),true,version);
  for (const version of ['1.10.0','1.10','1.10.1','1.11.0','2.0.0']) assert.equal(shippedStartNeedsUpgrade(copy(version),entry),false,version);
  for (const version of [undefined,'','v1.0.0','1.0.0-beta','1..0',1]) assert.equal(shippedStartNeedsUpgrade(copy(version),entry),false,`unreadable ${version}`);
  assert.equal(shippedStartNeedsUpgrade(copy('1.0.0'),{ ...entry,contentVersion: 'next' }),false,'an unreadable shipped version replaces nothing');
  assert.equal(shippedStartNeedsUpgrade(stored({ kind: 'historical', contentId: 'player-start', contentVersion: '1.0.0' }),entry),false,'a player import that reuses the id');
  assert.equal(shippedStartNeedsUpgrade(stored(undefined),entry),false,'a scenario without historical content');
  assert.equal(shippedStartNeedsUpgrade({ ...copy('1.0.0'),meta: { restoreOnly: true } },entry),false,'the copy a restored campaign uses');
  for (const bundle of [null,undefined,{},{ data: {} },{ data: { world: null } }]) assert.equal(shippedStartNeedsUpgrade(bundle,entry),false);
});

test('server prepares both historical courts and refuses invalid requests without writes', () => {
  const root = mkdtempSync(path.join(os.tmpdir(),'attainder-historical-'));
  try {
    execFileSync(process.execPath, ['--input-type=module','-e', `
      import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
      import * as store from ${JSON.stringify(new URL('./libraryStore.js',import.meta.url).href)};
      assert.throws(()=>store.createGame({gamePatch:{gameDate:null}}));
      assert.deepEqual(fs.readdirSync(path.join(process.env.OH_DATA_DIR,'games')),[],'rejected first request creates no campaign');
      store.ensureGameStore();
      // A library read stores each scenario's start summary in its meta the first time, so the
      // snapshot reads the library first and a refused request is held to writes of its own.
      const snapshot = () => { store.getLibraryCatalog(); const out={}; const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else out[q]=fs.readFileSync(q).toString('base64');}};walk(process.env.OH_DATA_DIR);return out; };
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
      for (const run of [()=>store.createScenario({gamePatch:{gameDate:null}}),()=>store.updateScenario('default',{gamePatch:{startDate:'1531-01-01'}}),
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

test('an interrupted desktop install finishes in place and never adds a second copy', () => {
  const root = mkdtempSync(path.join(os.tmpdir(),'attainder-historical-'));
  const id = 'charlemagne-800', dir = path.join(root,'scenarios',id), meta = path.join(dir,'scenario.json');
  const marker = path.join(root,'historical-bookmarks-charlemagne-800.json'), manifestPath = path.join(root,'scenario-manifest.json');
  const manifest = () => JSON.parse(readFileSync(manifestPath,'utf8'));
  const boot = () => execFileSync(process.execPath,['--input-type=module','-e',`
    import * as store from ${JSON.stringify(new URL('./libraryStore.js',import.meta.url).href)};
    store.ensureScenarioStore();
    console.log(JSON.stringify(store.getScenarioCatalog().scenarios.map(s=>s.id)));
  `],{ env: { ...process.env,OH_DATA_DIR: root },stdio: 'pipe',encoding: 'utf8' });
  const catalog = () => JSON.parse(boot().trim().split('\n').at(-1));
  try {
    assert.deepEqual(catalog(),['default','egypt-3000bc',id,'world-1500']);
    // Crash after the meta write: the directory is partial and the manifest lacks the id.
    const partial = path.join(dir,'world.json');
    assert.ok(existsSync(partial));
    rmSync(partial); rmSync(marker);
    const before = manifest();
    writeFileSync(manifestPath,JSON.stringify({ ...before,order: before.order.filter(entry => entry !== id),activeScenarioId: 'default',selectedScenarioId: 'default' }));
    assert.deepEqual(catalog().sort(),['charlemagne-800','default','egypt-3000bc','world-1500']);
    assert.ok(manifest().order.includes(id)); assert.ok(existsSync(partial),'the install finishes the partial directory');
    assert.ok(existsSync(marker)); assert.equal(manifest().selectedScenarioId,id);
    // Crash after the manifest write: the scenario is complete and only the marker is absent.
    rmSync(marker);
    const written = readFileSync(meta,'utf8');
    // The finished install appended Charlemagne to the order after the AD 1500 start.
    assert.deepEqual(catalog(),['default','egypt-3000bc','world-1500',id]);
    assert.ok(existsSync(marker)); assert.equal(readFileSync(meta,'utf8'),written,'a complete scenario is left as it stands');
    assert.deepEqual(readdirSync(path.join(root,'scenarios')).sort(),['charlemagne-800','default','egypt-3000bc','world-1500']);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('a desktop library offers four starts with Charlemagne as the default, and the upgrade leaves John saves alone', () => {
  const root = mkdtempSync(path.join(os.tmpdir(),'attainder-historical-'));
  try {
    execFileSync(process.execPath, ['--input-type=module','-e', `
      import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
      import * as store from ${JSON.stringify(new URL('./libraryStore.js',import.meta.url).href)};
      const charlemagneMarker=path.join(process.env.OH_DATA_DIR,'historical-bookmarks-charlemagne-800.json');
      const starts=()=>store.getScenarioCatalog().scenarios.filter(s=>s.historicalStart).map(s=>[s.id,s.historicalStart.contentId,s.historicalStart.date]);
      const offered=[['default','john-1200','1200-12-31'],['egypt-3000bc','egypt-3000bc','-3000-01-01'],['charlemagne-800','charlemagne-800','0800-12-25'],['world-1500','world-1500','1500-12-31']];
      const withoutKarl=offered.filter(([id])=>id!=='charlemagne-800');
      store.ensureScenarioStore();
      assert.deepEqual(starts(),offered);
      assert.equal(store.getScenarioCatalog().selectedScenarioId,'charlemagne-800');
      const john=store.createGame({scenarioId:'default'});
      const savedGame=store.getGameDetails(john.game.id), savedBundle=store.exportGameBundle(john.game.id);
      // An install from before this start: the Egypt marker stands, Charlemagne is absent.
      store.deleteScenario('charlemagne-800'); fs.rmSync(charlemagneMarker);
      assert.deepEqual(starts(),withoutKarl);
      // Selecting a scenario moves it to the front of the stored order, so these compare by id.
      const byId=list=>[...list].sort((a,b)=>a[0].localeCompare(b[0]));
      store.setSelectedScenario('egypt-3000bc');
      store.ensureScenarioStore();
      assert.deepEqual(byId(starts()),byId(offered),'the upgrade adds Charlemagne once and leaves Egypt installed');
      assert.equal(store.getScenarioCatalog().selectedScenarioId,'egypt-3000bc','a choice the player made stands');
      const loaded=store.getGameDetails(john.game.id);
      assert.equal(loaded.game.scenarioId,'default'); assert.deepEqual(loaded.data,savedGame.data);
      assert.deepEqual(store.exportGameBundle(john.game.id).data,savedBundle.data);
      const oldBundle=structuredClone(savedBundle);
      for (const religion of Object.values(oldBundle.data.world.characterSystem.religions)) delete religion.historicalOrigin;
      const imported=store.importGameBundle(oldBundle);
      assert.deepEqual(imported.data.world.characterSystem,oldBundle.data.world.characterSystem,'a save from before the religion claims imports as it was written');
      assert.deepEqual(store.getGameDetails(imported.game.id).data.events,oldBundle.data.events);
      // A deleted start stays deleted: the marker, not the scenario, records the installation.
      store.deleteScenario('charlemagne-800'); store.ensureScenarioStore();
      assert.deepEqual(byId(starts()),byId(withoutKarl));
      fs.rmSync(charlemagneMarker); store.ensureScenarioStore();
      const karl=store.createGame({name:'Karl',scenarioId:'charlemagne-800',setActive:false,
        historicalStart:{date:'0800-12-25',polityId:'carolingian-realm',mode:'realm',seed:7,difficulty:'normal'},
        gamePatch:{country:'carolingian-realm',difficulty:'standard',language:'Swedish'}});
      assert.equal(karl.data.game.startDate,'0800-12-25'); assert.equal(karl.data.world.characterSystem.date,'0800-12-25');
      assert.equal(karl.data.world.characterSystem.identity.polityId,'carolingian-realm');
      assert.deepEqual(store.getGameDetails(karl.game.id).data.world.characterSystem,karl.data.world.characterSystem);
    `], { env: { ...process.env, OH_DATA_DIR: root }, stdio: 'pipe', encoding: 'utf8' });
  } finally { rmSync(root,{recursive:true,force:true}); }
});

const readJson = file => JSON.parse(readFileSync(file,'utf8'));
const editJson = (file,change) => { const value = readJson(file); change(value); writeFileSync(file,JSON.stringify(value,null,2)); };
const hash = text => createHash('sha256').update(text).digest('hex');
const romeIsSeat = file => readJson(file).features.find(f => f.id === 'rome').properties.seat;
// A desktop data folder and the paths into its Charlemagne copy. Each boot is a separate start of the app:
// it runs `body`, then a library read, unless `body` ends the process first.
const desktopLibrary = (id = 'charlemagne-800') => {
  const root = mkdtempSync(path.join(os.tmpdir(),'attainder-historical-')), dir = path.join(root,'scenarios',id);
  const boot = (body = '') => execFileSync(process.execPath,['--input-type=module','-e',`
    import fs from 'node:fs';
    import * as store from ${JSON.stringify(new URL('./libraryStore.js',import.meta.url).href)};
    ${body}
    console.log(JSON.stringify(store.getScenarioCatalog().scenarios.map(s => s.id)));
  `],{ env: { ...process.env,OH_DATA_DIR: root },stdio: 'pipe',encoding: 'utf8' }).trim().split('\n');
  return { root, dir, boot, worldPath: path.join(dir,'world.json'), citiesPath: path.join(dir,'cities.geojson'), metaPath: path.join(dir,'scenario.json') };
};
// The fingerprint a store records for the copy as it now stands on disk.
const fingerprintOnDisk = worldPath => contentFingerprint(readJson(worldPath),readJson(path.join(path.dirname(worldPath),'game.json')));
const restamp = worldPath => editJson(path.join(path.dirname(worldPath),'scenario.json'),meta => { meta.shippedContentFingerprint = fingerprintOnDisk(worldPath); });
// What the 1.0.0 release installed: that version, with Rome not yet a seat, and the fingerprint of what it wrote.
const ageToFirstRelease = ({ worldPath, citiesPath }) => {
  editJson(worldPath,world => { world.historicalScenario.contentVersion = '1.0.0'; });
  editJson(citiesPath,cities => { cities.features.find(f => f.id === 'rome').properties.seat = false; });
  restamp(worldPath);
};
// A release from before the stores recorded a fingerprint.
const dropFingerprint = metaPath => editJson(metaPath,meta => { delete meta.shippedContentFingerprint; });
const editCourtText = worldPath => editJson(worldPath,world => { world.historicalScenario.courtSeeds['papal-states'].contextSv = 'Min egen inledning till påvens hov.'; });

test('a desktop library read replaces an older shipped start in place and leaves deleted starts, player copies and campaigns alone', () => {
  const { root, dir, boot, worldPath, citiesPath, metaPath } = desktopLibrary(), id = 'charlemagne-800', egypt = path.join(root,'scenarios','egypt-3000bc');
  const marker = path.join(root,'historical-bookmarks-charlemagne-800.json'), manifestPath = path.join(root,'scenario-manifest.json');
  // Content hash and modification time of every file under the given paths, so a rewrite with equal bytes still shows.
  const files = (...paths) => Object.fromEntries(paths.flatMap(p => statSync(p).isDirectory() ? readdirSync(p,{recursive:true}).map(name => path.join(p,name)) : [p])
    .filter(file => statSync(file).isFile()).map(file => [file,[statSync(file).mtimeMs,hash(readFileSync(file))]]));
  // A library read stores the start summary in the meta again when world.json changed, so the meta
  // is compared without that cache and every other file as it is.
  const asideSummary = ({ [metaPath]: _meta, ...others }) => { const { historicalSummary: _summary, ...meta } = readJson(metaPath); return { others, meta }; };
  try {
    // An earlier release installed Charlemagne. The player chose Egypt and started a campaign at AD 800.
    const first = boot(`store.ensureScenarioStore(); store.setSelectedScenario('egypt-3000bc');
      console.log(store.createGame({ name: 'Karl', scenarioId: '${id}', setActive: false,
        historicalStart: { date: '0800-12-25', polityId: 'carolingian-realm', mode: 'realm', seed: 7, difficulty: 'normal' },
        gamePatch: { country: 'carolingian-realm', difficulty: 'standard', language: 'Swedish' } }).game.id);`);
    const campaign = path.join(root,'games',first[0]), shipped = readFileSync(worldPath,'utf8'), { createdAt } = readJson(metaPath);
    // That release shipped 1.0.0, so the installed start and the campaign both carry it.
    ageToFirstRelease({ worldPath, citiesPath });
    editJson(path.join(campaign,'world.json'),world => { world.historicalScenario.contentVersion = '1.0.0'; });
    // The player has started this start five times and renamed a country on it.
    editJson(metaPath,meta => { meta.playCount = 5; meta.countryNameOverrides = { 'papal-states': 'Påvens land' }; });
    const manifest = readJson(manifestPath), untouched = files(campaign,egypt);
    assert.equal(manifest.selectedScenarioId,'egypt-3000bc');
    // (a) The next read replaces the old copy where it stands, map files included.
    assert.deepEqual(boot().at(-1),first.at(-1),'the catalog keeps its order');
    assert.equal(readJson(worldPath).historicalScenario.contentVersion,'1.4.0');
    assert.equal(hash(readFileSync(worldPath,'utf8')),hash(shipped),'the installed copy is the shipped 1.4.0');
    assert.equal(romeIsSeat(citiesPath),true,'the shipped city file makes Rome a seat');
    assert.equal(readJson(metaPath).createdAt,createdAt);
    assert.equal(readJson(metaPath).playCount,5,'the play count stays');
    assert.deepEqual(readJson(metaPath).countryNameOverrides,{ 'papal-states': 'Påvens land' },'the renamed country stays');
    assert.equal(readJson(metaPath).name,readJson(fileURLToPath(new URL(`./seed/historical/${id}/scenario.json`,import.meta.url))).scenario.name,'the name comes from the package');
    assert.deepEqual(readJson(manifestPath),manifest,'order and selection stand');
    // (d) The campaign started from 1.0.0 keeps its own data, and Egypt, already current, is not written.
    assert.deepEqual(files(campaign,egypt),untouched);
    assert.equal(readJson(path.join(campaign,'world.json')).historicalScenario.contentVersion,'1.0.0');
    // (c) A current copy is not written at all.
    { const before = files(dir,manifestPath,marker); boot(); assert.deepEqual(files(dir,manifestPath,marker),before); }
    // (e) A scenario under the id that is not this start, and the copy a restored campaign uses, stay as they are.
    for (const [label,change] of [
      ['a player import that reuses the id',() => editJson(worldPath,world => { world.historicalScenario.contentId = 'player-start'; world.historicalScenario.contentVersion = '1.0.0'; })],
      ['a scenario without historical content',() => editJson(worldPath,world => { delete world.historicalScenario; })],
      ['the copy a restored campaign uses',() => { writeFileSync(worldPath,shipped); editJson(worldPath,world => { world.historicalScenario.contentVersion = '1.0.0'; }); editJson(metaPath,meta => { meta.restoreOnly = true; }); }],
    ]) {
      change();
      const before = asideSummary(files(dir)); boot(); assert.deepEqual(asideSummary(files(dir)),before,label);
    }
    // (b) A start the player deleted stays deleted.
    assert.equal(JSON.parse(boot(`store.deleteGame('${first[0]}'); store.deleteScenario('${id}');`).at(-1)).includes(id),false);
    assert.ok(existsSync(marker));
    assert.equal(JSON.parse(boot().at(-1)).includes(id),false,'a deleted start stays deleted');
    assert.equal(existsSync(dir),false); assert.equal(readJson(manifestPath).order.includes(id),false);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('a copy counts as edited only when it carries a fingerprint its content no longer matches', () => {
  const world = { historicalScenario: { contentId: 'charlemagne-800' } }, game = { country: 'carolingian-realm' };
  const meta = { shippedContentFingerprint: contentFingerprint(world,game) };
  assert.match(meta.shippedContentFingerprint,/^[0-9a-f]{16}$/);
  assert.equal(shippedStartEdited({ meta, data: { world, game } }),false,'unedited');
  assert.equal(shippedStartEdited({ meta, data: { world, game: { ...game, country: 'papal-states' } } }),true,'an edited game');
  assert.equal(shippedStartEdited({ meta, data: { world: { ...world, note: 'x' }, game } }),true,'an edited world');
  assert.equal(shippedStartEdited({ meta: {}, data: { world: { ...world, note: 'x' }, game } }),false,'no fingerprint');
  // FNV-1a 64 over the code units of the text, as a BigInt reference computes it.
  const reference = text => {
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < text.length; i += 1) h = ((h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn;
    return h.toString(16).padStart(16,'0');
  };
  for (const [w,g] of [[world,game],[null,null],[{ name: 'Påvens land \u{1F451}' },{}]]) assert.equal(contentFingerprint(w,g),reference(JSON.stringify([w,g])));
});

test('a desktop upgrade keeps an edited start as a copy with its campaigns and replaces the start', () => {
  const { root, dir, boot, worldPath, citiesPath, metaPath } = desktopLibrary(), id = 'charlemagne-800', keptDir = path.join(root,'scenarios',`${id}-edited`);
  const manifestPath = path.join(root,'scenario-manifest.json');
  try {
    const [gameId] = boot(`store.ensureScenarioStore(); store.setSelectedScenario('egypt-3000bc');
      console.log(store.createGame({ name: 'Karl', scenarioId: '${id}', setActive: false,
        historicalStart: { date: '0800-12-25', polityId: 'carolingian-realm', mode: 'realm', seed: 7, difficulty: 'normal' },
        gamePatch: { country: 'carolingian-realm', difficulty: 'standard', language: 'Swedish' } }).game.id);`);
    const shipped = readFileSync(worldPath,'utf8');
    assert.equal(readJson(metaPath).shippedContentFingerprint,fingerprintOnDisk(worldPath),'the install records what it wrote');
    // The player renames the start, which keeps the fingerprint.
    boot(`store.updateScenario('${id}', { name: 'Mitt Karl' });`);
    assert.equal(readJson(metaPath).name,'Mitt Karl');
    assert.equal(readJson(metaPath).shippedContentFingerprint,fingerprintOnDisk(worldPath),'a rename keeps the fingerprint');
    // It was the 1.0.0 install, and the player edited a court's text in it.
    ageToFirstRelease({ worldPath, citiesPath });
    editCourtText(worldPath);
    const edited = readFileSync(worldPath,'utf8'), order = readJson(manifestPath).order;
    const catalog = JSON.parse(boot().at(-1));
    // The edited copy is kept after the start, with its campaign; the start is the shipped 1.4.0.
    const at = order.indexOf(id) + 1;
    assert.deepEqual(catalog,[...order.slice(0,at),`${id}-edited`,...order.slice(at)]);
    assert.equal(readFileSync(path.join(keptDir,'world.json'),'utf8'),edited,'the kept copy holds the edited world');
    assert.equal(romeIsSeat(path.join(keptDir,'cities.geojson')),false,'and the map files it had');
    const keptMeta = readJson(path.join(keptDir,'scenario.json'));
    assert.equal(keptMeta.name,'Mitt Karl (din ändrade kopia)');
    assert.equal(keptMeta.id,`${id}-edited`);
    assert.equal(keptMeta.shippedContentFingerprint,undefined,'the kept copy is the player’s own');
    assert.equal(readJson(path.join(root,'games',gameId,'game-instance.json')).scenarioId,`${id}-edited`,'the campaign goes with the kept copy');
    assert.equal(hash(readFileSync(worldPath,'utf8')),hash(shipped),'the start is the shipped 1.4.0');
    assert.equal(readJson(metaPath).shippedContentFingerprint,fingerprintOnDisk(worldPath),'the upgrade records what it wrote');
    assert.equal(readJson(manifestPath).selectedScenarioId,'egypt-3000bc','the selection stands');
    // The next read writes no world: the start is current and the kept copy is never upgraded.
    const before = statSync(path.join(keptDir,'world.json')).mtimeMs;
    assert.deepEqual(JSON.parse(boot().at(-1)),catalog);
    assert.equal(statSync(path.join(keptDir,'world.json')).mtimeMs,before);
    assert.ok(existsSync(dir));
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('a desktop upgrade replaces an unedited start and a start without a fingerprint in place, with no copy', () => {
  for (const [label,prepare] of [
    ['unedited',() => {}],
    ['no fingerprint',({ metaPath, worldPath }) => { dropFingerprint(metaPath); editCourtText(worldPath); }],
  ]) {
    const library = desktopLibrary(), { root, boot, worldPath, citiesPath } = library;
    try {
      boot('store.ensureScenarioStore();');
      const shipped = readFileSync(worldPath,'utf8');
      ageToFirstRelease({ worldPath, citiesPath });
      prepare(library);
      boot();
      assert.equal(hash(readFileSync(worldPath,'utf8')),hash(shipped),`${label}: the start is the shipped 1.4.0`);
      assert.deepEqual(readdirSync(path.join(root,'scenarios')).filter(name => name.endsWith('-edited')),[],`${label}: no copy`);
    } finally { rmSync(root,{recursive:true,force:true}); }
  }
});

test('a current desktop copy without a fingerprint gets the shipped one, so an edit made before then still counts', () => {
  for (const edited of [false,true]) {
    const { root, boot, worldPath, metaPath } = desktopLibrary();
    try {
      boot('store.ensureScenarioStore();');
      const shippedFingerprint = readJson(metaPath).shippedContentFingerprint;
      // Installed before the stores recorded a fingerprint, or a write cut short before it.
      dropFingerprint(metaPath);
      if (edited) editCourtText(worldPath);
      boot();
      assert.equal(readJson(metaPath).shippedContentFingerprint,shippedFingerprint,`edited ${edited}: the shipped fingerprint`);
      assert.equal(readJson(metaPath).shippedContentFingerprint === fingerprintOnDisk(worldPath),!edited,`edited ${edited}: counts as edited`);
    } finally { rmSync(root,{recursive:true,force:true}); }
  }
});

test('the installed 1.1.0 copy, as that release shipped it, is replaced in place by 1.4.0 with its ten seats', () => {
  const { root, boot, worldPath, citiesPath, metaPath } = desktopLibrary(), release = charlemagneRelease110();
  const seats = file => readJson(file).features.filter(f => f.properties.seat).map(f => f.id);
  try {
    boot('store.ensureScenarioStore();');
    const shipped = readFileSync(worldPath,'utf8'), shippedCities = readFileSync(citiesPath,'utf8'), { createdAt } = readJson(metaPath);
    // The copy that release installed: its world and city files.
    writeFileSync(worldPath,JSON.stringify(release.data.world,null,2));
    writeFileSync(citiesPath,JSON.stringify(release.assets.citiesGeojson.data,null,2));
    dropFingerprint(metaPath);
    assert.equal(readJson(worldPath).historicalScenario.contentVersion,'1.1.0');
    assert.deepEqual(seats(citiesPath),['aachen','rome']);
    boot();
    assert.equal(readJson(worldPath).historicalScenario.contentVersion,'1.4.0');
    assert.equal(hash(readFileSync(worldPath,'utf8')),hash(shipped),'the installed copy is the shipped 1.4.0');
    assert.equal(hash(readFileSync(citiesPath,'utf8')),hash(shippedCities),'the city file is the shipped one');
    assert.deepEqual(seats(citiesPath),['aachen','changan','raqqa','constantinople','gyeongju','cordoba','kairouan','oviedo','benevento','rome']);
    assert.equal(readJson(worldPath).historicalScenario.playablePolityIds.length,10);
    assert.equal(readJson(metaPath).createdAt,createdAt);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('installed Charlemagne 1.2.0 and 1.3.0, Egypt 1.0.0 and world-1500 1.0.0 and 1.1.0 copies are each replaced in place by the shipped release', () => {
  for (const [id,release,from,to] of [['charlemagne-800',charlemagneRelease120(),'1.2.0','1.4.0'],['charlemagne-800',charlemagneRelease130(),'1.3.0','1.4.0'],['egypt-3000bc',egyptRelease100(),'1.0.0','1.1.0'],['world-1500',world1500Release100(),'1.0.0','1.2.0'],['world-1500',world1500Release110(),'1.1.0','1.2.0']]) {
    const { root, boot, worldPath, citiesPath, metaPath } = desktopLibrary(id);
    try {
      boot('store.ensureScenarioStore();');
      const shipped = readFileSync(worldPath,'utf8'), shippedCities = readFileSync(citiesPath,'utf8'), { createdAt } = readJson(metaPath);
      // The copy that release installed: its world and city files.
      writeFileSync(worldPath,JSON.stringify(release.data.world,null,2));
      writeFileSync(citiesPath,JSON.stringify(release.assets.citiesGeojson.data,null,2));
      dropFingerprint(metaPath);
      assert.equal(readJson(worldPath).historicalScenario.contentVersion,from,id);
      assert.notEqual(hash(readFileSync(worldPath,'utf8')),hash(shipped),`${id}: the ${from} world differs from the shipped one`);
      boot();
      assert.equal(readJson(worldPath).historicalScenario.contentVersion,to,id);
      assert.equal(hash(readFileSync(worldPath,'utf8')),hash(shipped),`${id}: the installed copy is the shipped ${to}`);
      assert.equal(hash(readFileSync(citiesPath,'utf8')),hash(shippedCities),`${id}: the city file is the shipped one`);
      assert.equal(readJson(metaPath).createdAt,createdAt,id);
    } finally { rmSync(root,{recursive:true,force:true}); }
  }
});

test('a desktop upgrade cut short before world.json is repeated on the next read', () => {
  // The app dies while writing the city file, or on the rename that would put the new world.json in place.
  // Each case names the fs call, which argument holds the target, how the target ends, Rome's seat after the crash
  // and the temporary world files the crash leaves. A temporary name carries the process id and a counter, so two
  // processes on one data folder never share one; the next write removes those of processes that have ended.
  for (const [fsCall,targetArg,fileEnd,romeAfterCrash,leftover] of [['writeFileSync',0,'cities.geojson',false,0],['renameSync',1,'world.json',true,1]]) {
    const { root, boot, worldPath, citiesPath } = desktopLibrary();
    try {
      boot('store.ensureScenarioStore();');
      const shipped = readFileSync(worldPath,'utf8');
      ageToFirstRelease({ worldPath, citiesPath });
      const crashed = boot(`
        const original = fs.${fsCall};
        fs.${fsCall} = (...args) => { if (String(args[${targetArg}]).endsWith('${fileEnd}')) { console.log('cut short'); process.exit(0); } return original(...args); };
        store.ensureScenarioStore();`);
      assert.deepEqual(crashed,['cut short'],fsCall);
      assert.equal(romeIsSeat(citiesPath),romeAfterCrash,`${fsCall}: Rome's seat right after the crash`);
      assert.equal(readJson(worldPath).historicalScenario.contentVersion,'1.0.0',`${fsCall}: world.json still names the old release`);
      const temporary = readdirSync(path.dirname(worldPath)).filter(name => name.startsWith('world.json.'));
      assert.equal(temporary.length,leftover,`${fsCall}: temporary world files after the crash`);
      for (const name of temporary) assert.match(name,/^world\.json\.[0-9]+\.[0-9]+\.tmp$/,fsCall);
      boot();
      assert.equal(hash(readFileSync(worldPath,'utf8')),hash(shipped),`${fsCall}: the next read finishes at the shipped 1.4.0`);
      assert.equal(romeIsSeat(citiesPath),true,fsCall);
      assert.deepEqual(readdirSync(path.dirname(worldPath)).filter(name => name.startsWith('world.json.')),[],`${fsCall}: no half-written world file is left`);
    } finally { rmSync(root,{recursive:true,force:true}); }
  }
});

test('a cleanup that cannot list the folder after the rename leaves the finished upgrade in place', () => {
  // The rename has already put the new world.json in place. A folder listing that then fails (a
  // locked share, an antivirus scan) only skips the cleanup of leftovers; the write still counts.
  const { root, boot, worldPath, citiesPath } = desktopLibrary();
  try {
    boot('store.ensureScenarioStore();');
    const shipped = readFileSync(worldPath,'utf8');
    ageToFirstRelease({ worldPath, citiesPath });
    const out = boot(`
      const rename = fs.renameSync, list = fs.readdirSync;
      let renamed = false;
      fs.renameSync = (...args) => { const result = rename(...args); if (String(args[1]).endsWith('world.json')) renamed = true; return result; };
      fs.readdirSync = (...args) => { if (renamed) { renamed = false; throw Object.assign(new Error('EACCES: listing refused'),{ code: 'EACCES' }); } return list(...args); };
      store.ensureScenarioStore();`);
    assert.ok(out.at(-1).includes('charlemagne-800'),'the library read after the upgrade still answers');
    assert.equal(hash(readFileSync(worldPath,'utf8')),hash(shipped),'the shipped world.json is in place');
  } finally { rmSync(root,{recursive:true,force:true}); }
});

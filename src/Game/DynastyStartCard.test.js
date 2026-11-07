import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { transformSync } from 'esbuild';
import * as campaignSeed from '../runtime/campaignSeed.js';
import { orderHistoricalStarts } from '../runtime/historicalStartOptions.js';
import { buttonNamed, createHookDriver, findAll, settle } from './testing/hookDriver.js';

const bookmark = { scenarioId:'default', name:'John', date:'1200-12-31', label:'1200 e.Kr.', polities:[{id:'johns-realms',name:'Riket',families:[{id:'plantagenet',name:'Plantagenet'}]}] };
const compile = (file, loader) => transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader,format:'cjs',jsx:'transform'}).code;
function load(file, loader, modules, globals = {}) {
  const module = { exports:{} };
  vm.runInNewContext(compile(file,loader),{module,exports:module.exports,require:id=>{assert.ok(id in modules,`Unexpected import: ${id}`); return modules[id];},React,localStorage:{getItem:()=>null,setItem:()=>{}},...globals});
  return module.exports;
}

test('the start card sends the selected historical bookmark, identity and difficulty', async () => {
  const driver=createHookDriver(), started=[];
  const card=load('./DynastyStartCard.jsx','jsx',{
    react:driver.react, './Characters/LocalModelConnect.jsx':{default:()=>null,__esModule:true},
    '../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>[bookmark],startDynastyCampaign:async o=>started.push(o)},
    './AI/providerConfig.js':{isFallbackListConfigured:()=>true}, './dynastyStart.css':{},
  });
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle(); let tree=render();
  findAll(tree,n=>n.type==='select' && n.props.id==='dynasty-difficulty')[0].props.onChange({target:{value:'hard'}});
  tree=render(); await buttonNamed(tree,'Starta som riket').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(started)),[{mode:'realm',seed:'',difficulty:'hard',scenarioId:'default',date:'1200-12-31',polityId:'johns-realms'}]);
  assert.deepEqual(JSON.parse(JSON.stringify(card.DYNASTY_DIFFICULTIES)),[['easy','Lätt'],['normal','Normal'],['hard','Svår']]);
});

test('orchestrator creates once with the selected historical options before activation', async () => {
  const calls=[];
  const library={ensureLibraryCatalog:async()=>({scenarios:[{id:'default',historicalStart:{}}]}),
    loadScenarioDetails:async()=>({}), downloadScenarioJsonAsset:async()=>({}),
    createGame:async request=>{calls.push(['create',request]);return {game:{id:'game-1'}};},
    activateGame:async id=>calls.push(['activate',id])};
  const mod=load('../runtime/startDynastyCampaign.js','js',{'./library.js':library,'./campaignSeed.js':campaignSeed,'./historicalStartOptions.js':{historicalStartOption:()=>bookmark,orderHistoricalStarts}});
  await mod.startDynastyCampaign({scenarioId:'default',date:bookmark.date,polityId:'johns-realms',mode:'family',familyId:'plantagenet',seed:7,difficulty:'hard'});
  assert.deepEqual(calls.map(c=>c[0]),['create','activate']);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1].historicalStart)),{date:'1200-12-31',polityId:'johns-realms',mode:'family',familyId:'plantagenet',seed:7,difficulty:'hard'});
  assert.equal(calls[0][1].gamePatch.difficulty,'hard'); assert.equal(calls[1][1],'game-1');
});

test('the start card preselects the first start of the ordered catalog', async () => {
  const driver=createHookDriver(), started=[];
  const karl={ scenarioId:'charlemagne-800', name:'Karl', date:'0800-12-25', label:'800 e.Kr.', polities:[{id:'carolingian-realm',name:'Karls rike',families:[{id:'generated-house-1',name:'Hus'}]}] };
  const card=load('./DynastyStartCard.jsx','jsx',{
    react:driver.react, './Characters/LocalModelConnect.jsx':{default:()=>null,__esModule:true},
    '../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>[karl,bookmark],startDynastyCampaign:async o=>started.push(o)},
    './AI/providerConfig.js':{isFallbackListConfigured:()=>true}, './dynastyStart.css':{},
  });
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle(); const tree=render();
  assert.equal(findAll(tree,n=>n.type==='select' && n.props.id==='historical-bookmark')[0].props.value,'charlemagne-800');
  await buttonNamed(tree,'Starta som riket').props.onClick();
  assert.equal(started[0].scenarioId,'charlemagne-800'); assert.equal(started[0].date,'0800-12-25'); assert.equal(started[0].polityId,'carolingian-realm');
});

test('a start with no chosen scenario takes Charlemagne from the three-start catalog', async () => {
  const calls=[];
  const library={ensureLibraryCatalog:async()=>({scenarios:['default','egypt-3000bc','charlemagne-800'].map(id=>({id,historicalStart:{}}))}),
    loadScenarioDetails:async id=>({id}), downloadScenarioJsonAsset:async()=>({}),
    createGame:async request=>{calls.push(request);return {game:{id:'game-1'}};}, activateGame:async()=>{}};
  const historicalStartOption=details=>({scenarioId:details.id,name:details.id,date:'0800-12-25',polities:[{id:`${details.id}-realm`}]});
  const mod=load('../runtime/startDynastyCampaign.js','js',{'./library.js':library,'./campaignSeed.js':campaignSeed,'./historicalStartOptions.js':{historicalStartOption,orderHistoricalStarts}});
  assert.deepEqual([...await mod.loadHistoricalStartOptions()].map(o=>o.scenarioId),['charlemagne-800','default','egypt-3000bc']);
  await mod.startDynastyCampaign({});
  assert.equal(calls[0].scenarioId,'charlemagne-800'); assert.equal(calls[0].historicalStart.polityId,'charlemagne-800-realm');
});

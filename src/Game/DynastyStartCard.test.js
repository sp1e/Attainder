import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { transformSync } from 'esbuild';
import * as campaignSeed from '../runtime/campaignSeed.js';
import { coverageLineSv, historicalCampaignName, historicalStartOptionFromSummary, orderHistoricalStarts } from '../runtime/historicalStartOptions.js';
import * as startPicker from '../runtime/historicalStartPicker.js';
import { historicalStartSummary } from '../../server/historicalStartSummary.js';
import { buttonNamed, createHookDriver, findAll, settle, textOf } from './testing/hookDriver.js';

const bookmark = { scenarioId:'default', name:'John', date:'1200-12-31', label:'1200 e.Kr.', polities:[{id:'johns-realms',name:'Riket',families:[{id:'plantagenet',name:'Plantagenet'}]}] };
const compile = (file, loader) => transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader,format:'cjs',jsx:'transform'}).code;
function load(file, loader, modules, globals = {}) {
  const module = { exports:{} };
  vm.runInNewContext(compile(file,loader),{module,exports:module.exports,require:id=>{assert.ok(id in modules,`Unexpected import: ${id}`); return modules[id];},React,localStorage:{getItem:()=>null,setItem:()=>{}},...globals});
  return module.exports;
}
// The card with its real picker; the other imports are the test's.
const loadCard = (driver, modules) => load('./DynastyStartCard.jsx','jsx',{
  react:driver.react, './Characters/LocalModelConnect.jsx':{default:()=>null,__esModule:true},
  './AI/providerConfig.js':{isFallbackListConfigured:()=>true}, './dynastyStart.css':{},
  './HistoricalStartPicker.jsx':load('./HistoricalStartPicker.jsx','jsx',{react:driver.react,'../runtime/historicalStartPicker.js':startPicker}),
  '../runtime/historicalStartOptions.js':{coverageLineSv},
  ...modules,
});
// The four shipped starts as the option loader returns them; John installs as `default`.
const shippedOptions = () => orderHistoricalStarts(Object.entries({'charlemagne-800':'charlemagne-800',default:'john-1200','egypt-3000bc':'egypt-3000bc','world-1500':'world-1500'}).map(([scenarioId,folder]) => {
  const pkg=JSON.parse(readFileSync(new URL(`../../server/seed/historical/${folder}/scenario.json`,import.meta.url),'utf8'));
  return historicalStartOptionFromSummary(scenarioId,historicalStartSummary({meta:pkg.scenario,data:pkg.data}));
}));
const startRows = tree => findAll(tree,n=>n.props?.role==='radio' && n.props['data-start-key']);
const searchField = tree => findAll(tree,n=>n.type==='input' && n.props.id==='historical-search')[0];

test('the start card sends the selected historical bookmark, identity and difficulty', async () => {
  const driver=createHookDriver(), started=[];
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>[bookmark],startDynastyCampaign:async o=>started.push(o)}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle(); let tree=render();
  findAll(tree,n=>n.type==='select' && n.props.id==='dynasty-difficulty')[0].props.onChange({target:{value:'hard'}});
  tree=render(); await buttonNamed(tree,'Starta som riket').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(started)),[{option:bookmark,mode:'realm',seed:'',difficulty:'hard',scenarioId:'default',date:'1200-12-31',polityId:'johns-realms'}]);
  assert.deepEqual(JSON.parse(JSON.stringify(card.DYNASTY_DIFFICULTIES)),[['easy','Lätt'],['normal','Normal'],['hard','Svår']]);
});

test('the start card heading names the supported start range', async () => {
  const driver=createHookDriver();
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>[bookmark],startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle();
  const heading=findAll(render(),n=>n.props?.className==='dynasty-start-heading');
  assert.equal(heading.length,1); assert.equal(textOf(heading[0].props.children[0]),'HISTORISKA DYNASTIER · 3300 F.KR.–1530 E.KR.');
});

test('orchestrator creates once with the selected historical options before activation', async () => {
  const calls=[];
  const library={ensureLibraryCatalog:async()=>({scenarios:[{id:'default',historicalStart:{}}]}),
    loadScenarioDetails:async()=>({}), downloadScenarioJsonAsset:async()=>({}),
    createGame:async request=>{calls.push(['create',request]);return {game:{id:'game-1'}};},
    activateGame:async id=>calls.push(['activate',id])};
  const mod=load('../runtime/startDynastyCampaign.js','js',{'./library.js':library,'./campaignSeed.js':campaignSeed,'./historicalStartOptions.js':{offersHistoricalStart:()=>true,historicalStartOptionFromSummary:()=>bookmark,orderHistoricalStarts,historicalCampaignName}});
  await mod.startDynastyCampaign({scenarioId:'default',date:bookmark.date,polityId:'johns-realms',mode:'family',familyId:'plantagenet',seed:7,difficulty:'hard'});
  assert.deepEqual(calls.map(c=>c[0]),['create','activate']);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1].historicalStart)),{date:'1200-12-31',polityId:'johns-realms',mode:'family',familyId:'plantagenet',seed:7,difficulty:'hard'});
  assert.equal(calls[0][1].gamePatch.difficulty,'hard'); assert.equal(calls[1][1],'game-1');
});

test('the start card preselects the first start of the ordered catalog', async () => {
  const driver=createHookDriver(), started=[];
  const karl={ scenarioId:'charlemagne-800', name:'Karl', date:'0800-12-25', label:'800 e.Kr.', polities:[{id:'carolingian-realm',name:'Karls rike',families:[{id:'generated-house-1',name:'Hus'}]}] };
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>[karl,bookmark],startDynastyCampaign:async o=>started.push(o)}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle(); const tree=render();
  assert.deepEqual(startRows(tree).filter(r=>r.props['aria-checked']).map(r=>r.props['data-start-key']),['charlemagne-800/carolingian-realm']);
  await buttonNamed(tree,'Starta som riket').props.onClick();
  assert.equal(started[0].scenarioId,'charlemagne-800'); assert.equal(started[0].date,'0800-12-25'); assert.equal(started[0].polityId,'carolingian-realm');
});

test('the start card lists the shipped starts under region headings with a search field', async () => {
  const driver=createHookDriver(), options=shippedOptions();
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>options,startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle(); const tree=render();
  const label=findAll(tree,n=>n.type==='label' && n.props.htmlFor==='historical-search');
  assert.equal(label.length,1); assert.equal(textOf(label[0]),'Sök rike, härskare eller tid'); assert.ok(searchField(tree));
  assert.deepEqual(findAll(tree,n=>n.type==='h2').map(textOf),['Europa','Mellanöstern och Nordafrika','Östasien','Sydostasien','Amerika']);
  assert.deepEqual(findAll(tree,n=>n.type==='h3').map(textOf),['Tidig medeltid','Högmedeltid','Bronsålder','Tidig medeltid','Högmedeltid','Tidig medeltid','Högmedeltid','Senmedeltid']);
  assert.equal(startRows(tree).length,17);
  const papal=startRows(tree).find(r=>r.props['data-start-key']==='charlemagne-800/papal-states');
  assert.equal(textOf(papal.props.children[0]),'Kyrkostaten · 800 e.Kr.');
  assert.ok(textOf(papal.props.children[1]).startsWith('Leo III · '));
  assert.equal(findAll(tree,n=>n.props?.role==='radiogroup' && startRows(n).length).length,1);
});

test('a row names the polity kind after the start, and a state row names none', async () => {
  const driver=createHookDriver(), options=shippedOptions();
  const karl=options.find(o=>o.scenarioId==='charlemagne-800');
  const city={...karl,scenarioId:'city',polities:[{...karl.polities[1],id:'venice',name:'Venedig',kind:'city-state'}]};
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>[...options,city],startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle(); const tree=render();
  const row=key=>startRows(tree).find(r=>r.props['data-start-key']===key);
  assert.equal(textOf(row('city/venice').props.children[0]),'Venedig · 800 e.Kr. · stadsstat');
  assert.equal(textOf(row('charlemagne-800/papal-states').props.children[0]),'Kyrkostaten · 800 e.Kr.');
});

test('typing in the search field filters the rows and shows an empty state', async () => {
  const driver=createHookDriver(), options=shippedOptions();
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>options,startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle(); let tree=render();
  searchField(tree).props.onChange({target:{value:'leo'}}); tree=render();
  assert.deepEqual(startRows(tree).map(r=>r.props['data-start-key']),['charlemagne-800/papal-states']);
  assert.equal(findAll(tree,n=>n.type==='p' && textOf(n)==='Inga starter matchar sökningen.').length,0);
  searchField(tree).props.onChange({target:{value:'zzz'}}); tree=render();
  assert.equal(startRows(tree).length,0);
  assert.equal(findAll(tree,n=>n.type==='p' && textOf(n)==='Inga starter matchar sökningen.').length,1);
});

test('choosing Kyrkostaten starts the papal court from the Charlemagne start', async () => {
  const driver=createHookDriver(), started=[], options=shippedOptions();
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>options,startDynastyCampaign:async()=>{}}});
  const onStart=async o=>started.push(o);
  const render=()=>driver.render(React.createElement(card.default,{onStart}));
  render(); await settle(); let tree=render();
  searchField(tree).props.onChange({target:{value:'Kyrkostaten '}}); tree=render();
  startRows(tree)[0].props.onClick(); tree=render();
  assert.deepEqual(startRows(tree).map(r=>r.props['aria-checked']),[true]);
  await buttonNamed(tree,'Starta som riket').props.onClick();
  const charlemagne=options.find(o=>o.scenarioId==='charlemagne-800');
  assert.equal(started.length,1); assert.equal(started[0].option,charlemagne);
  assert.equal(started[0].scenarioId,'charlemagne-800'); assert.equal(started[0].polityId,'papal-states'); assert.equal(started[0].date,'0800-12-25');
  assert.equal(startRows(render()).length,1,'the search stays after a choice');
});

test('the card shows the chosen polity text and falls back to the start text without one', async () => {
  const driver=createHookDriver(), options=shippedOptions();
  const charlemagne=options.find(o=>o.scenarioId==='charlemagne-800'), john=options.find(o=>o.scenarioId==='default');
  charlemagne.polities.find(p=>p.id==='carolingian-realm').context='Karl övervintrar i Rom.';
  // Every AD 800 court ships a start text; Kyrkostaten loses its own here to show the fallback.
  charlemagne.polities.find(p=>p.id==='papal-states').context=null;
  const byzantium=charlemagne.polities.find(p=>p.id==='byzantine-empire');
  assert.ok(byzantium.context.startsWith('Eirene '));
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>options,startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  const detail=tree=>textOf(findAll(tree,n=>n.props?.className==='dynasty-start-detail')[0]);
  const choose=(tree,key)=>startRows(tree).find(r=>r.props['data-start-key']===key).props.onClick();
  render(); await settle(); let tree=render();
  assert.equal(detail(tree),'Karl övervintrar i Rom.');
  choose(tree,'charlemagne-800/papal-states'); tree=render();
  assert.equal(detail(tree),charlemagne.context,'a polity without text shows the start text');
  choose(tree,'charlemagne-800/byzantine-empire'); tree=render();
  assert.equal(detail(tree),byzantium.context,'a dossier court shows its own text');
  choose(tree,'default/johns-realms'); tree=render();
  const johnsRealms=john.polities.find(p=>p.id==='johns-realms').context;
  assert.ok(johnsRealms.startsWith('Johan av England ') && johnsRealms!==john.context);
  assert.equal(detail(tree),johnsRealms,'the court of Johns riken shows its own text');
  choose(tree,'charlemagne-800/carolingian-realm'); tree=render();
  assert.equal(detail(tree),'Karl övervintrar i Rom.');
});

test('the sources block says what the chosen start covers', async () => {
  const driver=createHookDriver(), options=shippedOptions();
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>options,startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  const sources=tree=>findAll(tree,n=>n.type==='details' && findAll(n,c=>c.type==='summary' && textOf(c)==='Källor och osäkerhet').length)[0];
  const paragraphs=tree=>findAll(sources(tree),n=>n.type==='p').map(textOf);
  render(); await settle(); let tree=render();
  startRows(tree).find(r=>r.props['data-start-key']==='default/johns-realms').props.onClick(); tree=render();
  assert.ok(paragraphs(tree).includes('Spelbara riken i starten: 4. På kartan utan spelbart hov: Västra Xia, Chimú. Kartområden utan granskad ägare: 280.'));
  startRows(tree).find(r=>r.props['data-start-key']==='charlemagne-800/carolingian-realm').props.onClick(); tree=render();
  assert.ok(paragraphs(tree).includes('Spelbara riken i starten: 10. Kartområden utan granskad ägare: 214.'));
  assert.ok(paragraphs(tree).every(text=>!text.includes('På kartan utan spelbart hov')));
});

test('a choice the search hides is named under the list and still starts', async () => {
  const driver=createHookDriver(), started=[], options=shippedOptions();
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>options,startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{onStart:async o=>started.push(o)}));
  render(); await settle(); let tree=render();
  const hiddenLine=()=>findAll(tree,n=>n.type==='p' && textOf(n).startsWith('Vald start:')).map(textOf);
  startRows(tree).find(r=>r.props['data-start-key']==='charlemagne-800/papal-states').props.onClick(); tree=render();
  assert.deepEqual(hiddenLine(),[],'a visible choice needs no line');
  searchField(tree).props.onChange({target:{value:'egypt'}}); tree=render();
  assert.deepEqual(hiddenLine(),['Vald start: Kyrkostaten · 800 e.Kr.']);
  searchField(tree).props.onChange({target:{value:'zzz'}}); tree=render();
  assert.deepEqual(hiddenLine(),['Vald start: Kyrkostaten · 800 e.Kr.']);
  const start=buttonNamed(tree,'Starta som riket'); assert.equal(start.props.disabled,false);
  await start.props.onClick();
  assert.equal(started[0].scenarioId,'charlemagne-800'); assert.equal(started[0].polityId,'papal-states');
  searchField(tree).props.onChange({target:{value:''}}); tree=render();
  assert.deepEqual(hiddenLine(),[]);
});

test('choosing the chosen start again keeps the family picked in family mode', async () => {
  const driver=createHookDriver(), started=[], options=shippedOptions();
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>options,startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{onStart:async o=>started.push(o)}));
  render(); await settle(); let tree=render();
  const families=options[0].polities[0].families.map(f=>f.id);
  assert.ok(families.length>=2); const picked=families[1];
  findAll(tree,n=>n.props?.['data-mode']==='family')[0].props.onClick(); tree=render();
  const familySelect=()=>findAll(tree,n=>n.type==='select' && n.props.id==='historical-family')[0];
  familySelect().props.onChange({target:{value:picked}}); tree=render();
  startRows(tree).find(r=>r.props['aria-checked']).props.onClick(); tree=render();
  assert.equal(familySelect().props.value,picked,'a click on the chosen row');
  searchField(tree).props.onChange({target:{value:'karl den store'}}); tree=render();
  assert.equal(startRows(tree).length,1);
  findAll(tree,n=>n.props?.role==='radiogroup' && startRows(n).length)[0].props.onKeyDown({key:'ArrowDown',preventDefault(){},currentTarget:{querySelector:()=>null}});
  tree=render(); assert.equal(familySelect().props.value,picked,'an arrow key on the only shown row');
  await buttonNamed(tree,'Starta som familjen').props.onClick();
  assert.equal(started[0].polityId,'carolingian-realm'); assert.equal(started[0].familyId,picked);
});

test('arrow keys move the chosen start with a roving tab stop', async () => {
  const driver=createHookDriver(), options=shippedOptions(), focused=[];
  const card=loadCard(driver,{'../runtime/startDynastyCampaign.js':{loadHistoricalStartOptions:async()=>options,startDynastyCampaign:async()=>{}}});
  const render=()=>driver.render(React.createElement(card.default,{}));
  render(); await settle(); let tree=render();
  const group=()=>findAll(tree,n=>n.props?.role==='radiogroup' && startRows(n).length)[0];
  const press=key=>group().props.onKeyDown({key,preventDefault(){},currentTarget:{querySelector:sel=>({focus:()=>focused.push(sel)})}});
  const checked=()=>startRows(tree).filter(r=>r.props['aria-checked']).map(r=>r.props['data-start-key']);
  const tabStops=()=>startRows(tree).filter(r=>r.props.tabIndex===0).map(r=>r.props['data-start-key']);
  assert.deepEqual(tabStops(),checked());
  // Rows follow the list: Europa sorts Bysantinska riket first and Kungariket Asturien after Karls rike; Amerika ends with Inkariket.
  press('ArrowDown'); tree=render(); assert.deepEqual(checked(),['charlemagne-800/kingdom-of-asturias']); assert.deepEqual(tabStops(),checked());
  assert.ok(focused.at(-1).includes('charlemagne-800/kingdom-of-asturias'));
  press('End'); tree=render(); assert.deepEqual(checked(),['world-1500/inca-empire']);
  press('ArrowDown'); tree=render(); assert.deepEqual(checked(),['charlemagne-800/byzantine-empire'],'the last row wraps to the first');
  press('ArrowUp'); tree=render(); assert.deepEqual(checked(),['world-1500/inca-empire']);
  press('Home'); tree=render(); assert.deepEqual(checked(),['charlemagne-800/byzantine-empire']);
  searchField(tree).props.onChange({target:{value:'egypt'}}); tree=render();
  assert.deepEqual(tabStops(),['egypt-3000bc/egypt-early-dynastic'],'a filtered list keeps one tab stop');
});

test('a start with no chosen scenario takes Charlemagne from the four-start catalog', async () => {
  const calls=[];
  const library={ensureLibraryCatalog:async()=>({scenarios:['default','egypt-3000bc','charlemagne-800','world-1500'].map(id=>({id,historicalStart:{}}))}),
    loadScenarioDetails:async id=>({id}), downloadScenarioJsonAsset:async()=>({}),
    createGame:async request=>{calls.push(request);return {game:{id:'game-1'}};}, activateGame:async()=>{}};
  const historicalStartOptionFromSummary=id=>({scenarioId:id,name:id,date:'0800-12-25',polities:[{id:`${id}-realm`}]});
  const mod=load('../runtime/startDynastyCampaign.js','js',{'./library.js':library,'./campaignSeed.js':campaignSeed,'./historicalStartOptions.js':{offersHistoricalStart:()=>true,historicalStartOptionFromSummary,orderHistoricalStarts,historicalCampaignName}});
  assert.deepEqual([...await mod.loadHistoricalStartOptions()].map(o=>o.scenarioId),['charlemagne-800','default','egypt-3000bc','world-1500']);
  await mod.startDynastyCampaign({});
  assert.equal(calls[0].scenarioId,'charlemagne-800'); assert.equal(calls[0].historicalStart.polityId,'charlemagne-800-realm');
});

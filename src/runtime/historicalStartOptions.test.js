import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverageLineSv, historicalCampaignName, historicalStartOption, historicalStartOptionFromSummary, offersHistoricalStart, orderHistoricalStarts, pickerCampaignName } from './historicalStartOptions.js';
import { historicalStartSummary } from '../../server/historicalStartSummary.js';
import { SHIPPED_START_FOLDERS } from './testing/shippedHistoricalStarts.js';
test('visible choices follow real bookmark courts and empty catalogs fail closed', () => {
  for (const id of SHIPPED_START_FOLDERS) {
    const b=JSON.parse(readFileSync(new URL(`../../server/seed/historical/${id}/scenario.json`,import.meta.url),'utf8'));
    const option=historicalStartOption(b,b.assets.regionsGeojson.data,b.assets.citiesGeojson.data);
    assert.equal(option.date,b.data.game.gameDate);
    assert.equal(option.polities[0].id,b.data.game.country);
    assert.ok(option.polities[0].families.length);
    assert.ok(option.polities[0].ruler.originLabelSv);
  }
  assert.throws(()=>historicalStartOption({data:{world:{},game:{}}},null,null));
});
test('the catalog order puts Charlemagne first, then John under his stored id, Egypt, AD 1500 and imported starts', () => {
  const ids=list=>orderHistoricalStarts(list.map(scenarioId=>({scenarioId}))).map(option=>option.scenarioId);
  assert.deepEqual(ids(['default','world-1500','egypt-3000bc','imported','charlemagne-800']),['charlemagne-800','default','egypt-3000bc','world-1500','imported']);
  assert.deepEqual(ids(['imported','egypt-3000bc','default']),['default','egypt-3000bc','imported'],'John leads once a player has deleted Charlemagne');
  assert.deepEqual(ids([]),[]);
});
test('a campaign carries the chosen polity in its name', () => {
  const b=JSON.parse(readFileSync(new URL('../../server/seed/historical/charlemagne-800/scenario.json',import.meta.url),'utf8'));
  const option=historicalStartOption(b,b.assets.regionsGeojson.data,b.assets.citiesGeojson.data);
  assert.equal(historicalCampaignName(option,'carolingian-realm','realm'),'Karls rike (karolingiska riket), 800 e.Kr. · Riket');
  assert.equal(historicalCampaignName(option,'papal-states','realm'),'Kyrkostaten, 800 e.Kr. · Riket');
  assert.equal(historicalCampaignName(option,'papal-states','family'),'Kyrkostaten, 800 e.Kr. · Familjen');
  assert.equal(historicalCampaignName(option,undefined,'realm'),'Karls rike (karolingiska riket), 800 e.Kr. · Riket');
  const imported={name:'Egen start',polities:[{id:'a',name:'A'},{id:'b',name:'B'}]};
  assert.equal(historicalCampaignName(imported,'b','realm'),'B · Egen start · Riket');
});
test('the library bar picker names a campaign after the chosen polity and keeps its Session suffix', () => {
  const b=JSON.parse(readFileSync(new URL('../../server/seed/historical/charlemagne-800/scenario.json',import.meta.url),'utf8'));
  const h=b.data.world.historicalScenario;
  // The options the bar builds for a historical start: its playable polities, primary first.
  const options=h.playablePolityIds.map(id=>({code:id,name:h.polities.find(p=>p.id===id).nameSv,historical:true}));
  assert.equal(pickerCampaignName(b.scenario.name,options,'papal-states'),'Kyrkostaten, 800 e.Kr. Session');
  assert.equal(pickerCampaignName(b.scenario.name,options,'carolingian-realm'),'Karls rike (karolingiska riket), 800 e.Kr. Session');
  assert.equal(pickerCampaignName('Modern Day',[],'SWE'),'Modern Day Session','a scenario that is not historical keeps its own name');
  // The bar passes only the historical options it built, so a modern country list never renames a campaign.
  const bar=readFileSync(new URL('../Game/GameUI/libraryBar.jsx',import.meta.url),'utf8');
  assert.match(bar,/name: pickerCampaignName\(scenario\.name, countryOptions\.filter\(\(option\) => option\.historical\), countryCode\)/);
  assert.match(bar,/nameSv \?\? id,historical:true\}/);
});
test('an option built from the library summary matches the one built from the package', () => {
  for (const id of SHIPPED_START_FOLDERS) {
    const b=JSON.parse(readFileSync(new URL(`../../server/seed/historical/${id}/scenario.json`,import.meta.url),'utf8'));
    const full=historicalStartOption(b,b.assets.regionsGeojson.data,b.assets.citiesGeojson.data);
    const summary=historicalStartSummary({meta:b.scenario,data:b.data});
    const option=historicalStartOptionFromSummary(`${id}-copy`,summary);
    assert.equal(option.scenarioId,`${id}-copy`);
    for (const key of ['name','date','label','context','coverage','calendarNote']) assert.equal(option[key],full[key],`${id} ${key}`);
    assert.equal(option.eraId,summary.eraId);
    assert.deepEqual(option.polities.map(p=>[p.id,p.name,p.ruler.name,p.ruler.originLabelSv,p.families,p.context,p.mechanicsNote]),
      full.polities.map(p=>[p.id,p.name,p.ruler.name,p.ruler.originLabelSv,p.families,p.context,p.mechanicsNote]));
    for (const polity of option.polities) assert.equal(polity.regionId,summary.polities.find(p=>p.id===polity.id).regionId);
  }
  const b=JSON.parse(readFileSync(new URL('../../server/seed/historical/charlemagne-800/scenario.json',import.meta.url),'utf8'));
  const option=historicalStartOptionFromSummary('charlemagne-800',historicalStartSummary({meta:b.scenario,data:b.data}));
  assert.equal(option.eraId,'early-middle-ages');
  assert.deepEqual(option.polities.map(p=>[p.id,p.regionId]),[['carolingian-realm','europe'],['papal-states','europe'],['tang-empire','east-asia'],
    ['abbasid-caliphate','mena'],['byzantine-empire','europe'],['silla','east-asia'],['emirate-of-cordoba','europe'],['aghlabid-emirate','mena'],
    ['kingdom-of-asturias','europe'],['duchy-of-benevento','europe']]);
  assert.equal(historicalCampaignName(option,'papal-states','realm'),'Kyrkostaten, 800 e.Kr. · Riket');
});
test('each option polity carries its court start text, null without one, from the package and the summary alike', () => {
  const b=JSON.parse(readFileSync(new URL('../../server/seed/historical/charlemagne-800/scenario.json',import.meta.url),'utf8'));
  const h=b.data.world.historicalScenario;
  h.courtSeeds['papal-states'].contextSv='Leo III styr Kyrkostaten från Rom.';
  h.courtSeeds['papal-states'].contextSourceIds=Object.keys(h.sources).slice(0,1);
  // Every AD 800 court ships a start text; Karls rike loses its own here to show null.
  delete h.courtSeeds['carolingian-realm'].contextSv;
  delete h.courtSeeds['carolingian-realm'].contextSourceIds;
  const full=historicalStartOption(b,b.assets.regionsGeojson.data,b.assets.citiesGeojson.data);
  const option=historicalStartOptionFromSummary('charlemagne-800',historicalStartSummary({meta:b.scenario,data:b.data}));
  for (const built of [full,option]) {
    assert.equal(built.context,h.contextSv);
    assert.deepEqual(built.polities.map(p=>[p.id,p.context]),[['carolingian-realm',null],['papal-states','Leo III styr Kyrkostaten från Rom.'],
      ...h.playablePolityIds.slice(2).map(id=>[id,h.courtSeeds[id].contextSv])]);
  }
});
test('the card offers a scenario only for a valid summary of the current schema that is not restore-only', () => {
  const b=JSON.parse(readFileSync(new URL('../../server/seed/historical/charlemagne-800/scenario.json',import.meta.url),'utf8'));
  const summary=historicalStartSummary({meta:b.scenario,data:b.data});
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:summary}),true);
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:summary,restoreOnly:true}),false);
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:{schema:1,sourceStamp:null,invalid:true}}),false);
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:{...summary,schema:1}}),false,'a summary from before per-polity start text');
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:{...summary,schema:2}}),false,'a summary from before polity kinds');
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:{...summary,schema:3}}),false,'a summary from before map coverage');
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:{...summary,schema:4}}),false,'a summary from before the mechanics note and the full check');
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:{...summary,schema:6}}),false);
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:{...summary,polities:[]}}),false);
  assert.equal(offersHistoricalStart({id:'a',historicalSummary:null}),false);
  assert.equal(offersHistoricalStart({id:'a'}),false);
});
test('both option builders carry each court\'s mechanics note, null without one', () => {
  const b=JSON.parse(readFileSync(new URL('../../server/seed/historical/world-1500/scenario.json',import.meta.url),'utf8'));
  const h=b.data.world.historicalScenario;
  delete h.courtSeeds['inca-empire'].mechanics.noteSv;
  const option=historicalStartOptionFromSummary('world-1500',historicalStartSummary({meta:b.scenario,data:b.data}));
  assert.deepEqual(option.polities.map(p=>[p.id,p.mechanicsNote]),[['aztec-empire',h.courtSeeds['aztec-empire'].mechanics.noteSv],['inca-empire',null]]);
  h.courtSeeds['inca-empire'].mechanics.noteSv='Spelets regler.';
  const full=historicalStartOption(b,b.assets.regionsGeojson.data,b.assets.citiesGeojson.data);
  assert.deepEqual(full.polities.map(p=>[p.id,p.mechanicsNote]),[['aztec-empire',h.courtSeeds['aztec-empire'].mechanics.noteSv],['inca-empire','Spelets regler.']]);
});
test('both option builders carry the map coverage, a copy of the summary\'s', () => {
  const b=JSON.parse(readFileSync(new URL('../../server/seed/historical/john-1200/scenario.json',import.meta.url),'utf8'));
  const full=historicalStartOption(b,b.assets.regionsGeojson.data,b.assets.citiesGeojson.data);
  const summary=historicalStartSummary({meta:b.scenario,data:b.data});
  const option=historicalStartOptionFromSummary('default',summary);
  assert.deepEqual(option.mapCoverage,full.mapCoverage);
  assert.deepEqual(option.mapCoverage,{mapOnly:[{id:'western-xia',nameSv:'Västra Xia'},{id:'chimu',nameSv:'Chimú'}],unownedFeatureCount:280});
  assert.notEqual(option.mapCoverage,summary.mapCoverage); assert.notEqual(option.mapCoverage.mapOnly,summary.mapCoverage.mapOnly);
  assert.notEqual(option.mapCoverage.mapOnly[0],summary.mapCoverage.mapOnly[0]);
});
test('the coverage line counts the playable polities, names the map-only ones and counts the unowned areas', () => {
  const optionOf=folder=>{
    const b=JSON.parse(readFileSync(new URL(`../../server/seed/historical/${folder}/scenario.json`,import.meta.url),'utf8'));
    return historicalStartOptionFromSummary(folder,historicalStartSummary({meta:b.scenario,data:b.data}));
  };
  assert.equal(coverageLineSv(optionOf('john-1200')),'Spelbara riken i starten: 4. På kartan utan spelbart hov: Västra Xia, Chimú. Kartområden utan granskad ägare: 280.');
  assert.equal(coverageLineSv(optionOf('charlemagne-800')),'Spelbara riken i starten: 10. Kartområden utan granskad ägare: 214.');
  const one={polities:[{id:'a',name:'A'}]};
  assert.equal(coverageLineSv({...one,mapCoverage:{mapOnly:[],unownedFeatureCount:0}}),'Spelbara riken i starten: 1.');
  assert.equal(coverageLineSv(one),'Spelbara riken i starten: 1.','an option from before map coverage');
});

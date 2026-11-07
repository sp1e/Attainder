import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { historicalCampaignName, historicalStartOption, orderHistoricalStarts, pickerCampaignName } from './historicalStartOptions.js';
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
test('the catalog order puts Charlemagne first, then John under his stored id, Egypt and imported starts', () => {
  const ids=list=>orderHistoricalStarts(list.map(scenarioId=>({scenarioId}))).map(option=>option.scenarioId);
  assert.deepEqual(ids(['default','egypt-3000bc','imported','charlemagne-800']),['charlemagne-800','default','egypt-3000bc','imported']);
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

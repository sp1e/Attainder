import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { historicalStartOption, orderHistoricalStarts } from './historicalStartOptions.js';
test('visible choices follow real bookmark courts and empty catalogs fail closed', () => {
  for (const id of ['egypt-3000bc','john-1200','charlemagne-800']) {
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

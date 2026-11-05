import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { historicalStartOption } from './historicalStartOptions.js';
test('visible choices follow real bookmark courts and empty catalogs fail closed', () => {
  for (const id of ['egypt-3000bc','john-1200']) {
    const b=JSON.parse(readFileSync(new URL(`../../server/seed/historical/${id}/scenario.json`,import.meta.url),'utf8'));
    const option=historicalStartOption(b,b.assets.regionsGeojson.data,b.assets.citiesGeojson.data);
    assert.equal(option.date,b.data.game.gameDate);
    assert.equal(option.polities[0].id,b.data.game.country);
    assert.ok(option.polities[0].families.length);
    assert.ok(option.polities[0].ruler.originLabelSv);
  }
  assert.throws(()=>historicalStartOption({data:{world:{},game:{}}},null,null));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCountryNames } from './assets.js';

test('a running historical world includes its renamed and new polities without stock countries', async () => {
  const original=globalThis.fetch;
  const world={historicalScenario:{kind:'historical',polities:[{id:'old',nameSv:'Old'}]},characterSystem:{},polityOverrides:{old:{name:'Renamed'},new:{name:'New realm'}}};
  const requests=[];
  globalThis.fetch=async input=>{requests.push(String(input));return new Response(JSON.stringify(world),{status:200,headers:{'Content-Type':'application/json'}});};
  try {
    assert.deepEqual(await loadCountryNames({force:true}),[{code:'new',name:'New realm'},{code:'old',name:'Renamed'}]);
    assert.equal(requests.length,1,'the stock archive is not consulted');
  }
  finally {globalThis.fetch=original;}
});

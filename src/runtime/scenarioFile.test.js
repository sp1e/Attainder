import test from 'node:test';
import assert from 'node:assert/strict';
import { readScenarioFile, restoreScenarioFileForGame } from './scenarioFile.js';
import { zipBundle } from './bundleZip.js';

test('a missing-map file is decoded and sent to the game-bound restore without trusting its hub stamp', async () => {
  const payload={schema:'open-historia-scenario-bundle/2',scenario:{id:'old'},hubOrigin:{postId:99}};
  const file=new Blob([JSON.stringify(payload)]);
  const calls=[];
  const result=await restoreScenarioFileForGame({file,gameId:'save-1',restore:async (...args)=>{calls.push(args);return 'restored';}});
  assert.equal(result,'restored'); assert.equal(calls[0][0],'save-1');
  assert.deepEqual(calls[0][1],{schema:payload.schema,scenario:payload.scenario});
  assert.equal((await readScenarioFile(file)).scenario.id,'old');
});

test('a zipped scenario is decoded and a zip without scenario.json is rejected', async () => {
  const payload={schema:'open-historia-scenario-bundle/2',scenario:{id:'old'},data:{},assets:{}};
  const zip=await zipBundle({'scenario.json':JSON.stringify(payload)});
  assert.deepEqual(await readScenarioFile(zip),payload);
  await assert.rejects(readScenarioFile(await zipBundle({'other.txt':'x'})),/saknar scenario\.json/);
});

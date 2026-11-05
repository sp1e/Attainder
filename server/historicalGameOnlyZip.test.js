import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('game-only ZIP restores as unresolved without changing active game', () => {
  const root=mkdtempSync(path.join(os.tmpdir(),'historical-zip-'));
  try { execFileSync(process.execPath,['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    import * as store from ${JSON.stringify(new URL('./libraryStore.js',import.meta.url).href)};
    import {zipBundle} from ${JSON.stringify(new URL('../src/runtime/bundleZip.js',import.meta.url).href)};
    import {readGameZip} from ${JSON.stringify(new URL('../src/runtime/gameZip.js',import.meta.url).href)};
    const active=store.createGame({setActive:true});
    const legacy={schema:'open-historia-game-bundle/1',game:{name:'Legacy'},scenarioRef:{scenarioId:'default'},data:{game:{gameDate:'2032-11-15',language:'French'},world:{language:'German'},events:[]}};
    const decoded=await readGameZip(await (await zipBundle({'game.json':JSON.stringify(legacy)})).arrayBuffer());
    const request=JSON.parse(JSON.stringify({bundle:decoded.bundle,scenarioBundle:decoded.scenarioBundle}));
    const restored=store.restoreGameBundle(request);
    assert.equal(restored.game.scenarioMissing,true); assert.equal(store.getGameCatalog().activeGameId,active.game.id);
    assert.equal(restored.data.world.language,'German'); assert.equal(restored.data.game.language,'French');
    assert.throws(()=>store.restoreGameBundle({bundle:legacy,scenarioBundle:null}));
    const bad=await readGameZip(await (await zipBundle({'game.json':JSON.stringify(legacy),'scenario.json':'null'})).arrayBuffer());
    assert.throws(()=>store.restoreGameBundle({bundle:bad.bundle,scenarioBundle:bad.scenarioBundle}));
    await assert.rejects(readGameZip(await (await zipBundle({'game.json':JSON.stringify(legacy),'scenario.json':''})).arrayBuffer()));
  `],{env:{...process.env,OH_DATA_DIR:root},stdio:'pipe'}); }
  finally { rmSync(root,{recursive:true,force:true}); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('desktop store preserves historical source, component terms and geometry through two imports',async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'attainder-provenance-'));
  process.env.OH_DATA_DIR = root;
  try {
    const store = await import('./libraryStore.js');
    const original = JSON.parse(await fs.readFile(new URL('./seed/historical/john-1200/scenario.json',import.meta.url),'utf8'));
    const first = store.importScenarioBundle(original,{ setSelected: false });
    const exported = store.exportScenarioBundle(first.scenario.id);
    const second = store.importScenarioBundle(exported,{ setSelected: false });
    const roundtrip = store.exportScenarioBundle(second.scenario.id);
    for (const b of [exported,roundtrip]) {
      assert.deepEqual(b.componentLicenses,original.componentLicenses);
      assert.deepEqual(b.assets.regionsGeojson.provenance,original.assets.regionsGeojson.provenance);
      assert.deepEqual(b.data.world.historicalScenario,original.data.world.historicalScenario);
      assert.equal(b.license.scope,'authored-content');
      const geometry = b.assets.regionsGeojson.encoding === 'base64' ? JSON.parse(Buffer.from(b.assets.regionsGeojson.data,'base64').toString()) : b.assets.regionsGeojson.data;
      assert.deepEqual(geometry,original.assets.regionsGeojson.data);
    }
  } finally {
    // mkdtemp returns an absolute dedicated test directory; never delete elsewhere.
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('attainder-provenance-'));
    await fs.rm(root,{ recursive: true,force: true });
  }
});

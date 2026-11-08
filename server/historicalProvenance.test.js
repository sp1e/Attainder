import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { HISTORICAL_BOOKMARKS } from './historicalStarts.js';
import { citiesFor } from '../scripts/build-historical-scenarios.mjs';

test('desktop store preserves historical source, component terms and geometry through two imports',async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'attainder-provenance-'));
  process.env.OH_DATA_DIR = root;
  try {
    const store = await import('./libraryStore.js');
    for (const contentId of ['john-1200','charlemagne-800']) {
      const original = JSON.parse(await fs.readFile(new URL(`./seed/historical/${contentId}/scenario.json`,import.meta.url),'utf8'));
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
    }
  } finally {
    // mkdtemp returns an absolute dedicated test directory; never delete elsewhere.
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('attainder-provenance-'));
    await fs.rm(root,{ recursive: true,force: true });
  }
});

const REPO = fileURLToPath(new URL('../',import.meta.url));
const SEED = new URL('./seed/historical/',import.meta.url);
const SOURCE_800 = '9d046cdc4662109c3f803ae46e2c8cba941aa092ec86eccc7823e6cf1554920c';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const seedJson = async name => JSON.parse(await fs.readFile(new URL(name,SEED),'utf8'));

test('every built package and shipped start keeps the build record of its release',async () => {
  const released = await seedJson('released-provenance.json');
  // releases.json lists the outputs of every package the builder makes; --check keeps it current.
  const built = [...new Set((await seedJson('releases.json')).outputs.map(o => o.file.split('/')[0]))];
  // Exactly the built packages: a stale entry for a removed package would freeze nothing and hide the removal.
  assert.deepEqual(Object.keys(released).sort(),[...built].sort());
  for (const contentId of [...HISTORICAL_BOOKMARKS.map(b => b.id),'john-1200']) assert.ok(built.includes(contentId),`${contentId}: shipped but not built`);
  for (const contentId of built) {
    const manifest = await seedJson(`${contentId}/manifest.json`);
    assert.ok(released[contentId],`${contentId}: no released provenance`);
    for (const field of ['generator','sourceFiles','authoredInputs']) assert.deepEqual(released[contentId][field],manifest[field],`${contentId}: ${field}`);
  }
});

test('the 800 package pins world_800',async () => {
  const manifest = await seedJson('charlemagne-800/manifest.json');
  assert.equal(manifest.contentVersion,'1.3.0');
  assert.deepEqual(manifest.authoredInputs.map(i => i.fileName),['authored-scenarios.mjs','ad800-review.json','dossier-courts.mjs','courts/ad800-courts.json']);
  assert.equal(manifest.sourceFiles.find(f => f.fileName === 'hbm-world_800.geojson').sha256,SOURCE_800);
  assert.equal(sha(await fs.readFile(new URL('sources/hbm-world_800.geojson',SEED))),SOURCE_800);
});

test('the 800 package keeps the source, licence and notices of its map',async () => {
  const bundle = await seedJson('charlemagne-800/scenario.json');
  const hbm = bundle.componentLicenses.find(c => c.id === 'historical-basemaps');
  const source = await fs.readFile(new URL('sources/hbm-world_800.geojson',SEED),'utf8');
  assert.equal(hbm.sha256,SOURCE_800);
  assert.match(hbm.sourceUrl,/4b5039e50d8d2464b065bd76ad6086cd4597108d\/geojson\/world_800\.geojson$/);
  assert.equal(hbm.sourceFiles[0].fileName,'world_800.geojson');
  assert.equal(hbm.sourceFiles[0].text,source);
  assert.ok(bundle.componentLicenses.some(c => c.id === 'natural-earth'));
  const getty = bundle.componentLicenses.find(c => c.id === 'getty-tgn');
  assert.equal(getty.license,'ODC-By-1.0');
  assert.doesNotMatch(getty.sourceUrl,/Aachen|Rome/);
  assert.equal(bundle.license.scope,'authored-content');
  const h = bundle.data.world.historicalScenario;
  assert.match(h.sources.hbm.chronology,/800/);
  // Aachen, Rome and the Getty record of each dossier seat, in settlement order.
  const gettyIds = ['aachen','rome','a1-getty-xian','getty-raqqa','a1-getty-constantinople','a1-getty-gyeongju','a1-west-getty-cordoba','getty-kairouan','a1-west-getty-oviedo','a1-west-getty-benevento'];
  for (const id of gettyIds) assert.match(h.sources[id].license,/^ODC-By-1\.0/,id);
  assert.deepEqual(h.assetManifest.assets.find(a => a.id === 'citiesGeojson').sourceIds,gettyIds);
  for (const id of gettyIds) assert.ok(getty.modifications.some(line => line.includes(h.sources[id].url)),id);
  for (const line of hbm.modifications) assert.doesNotMatch(line,/seat markers/);
});

test('the build reads no clock, locale or machine value',async () => {
  for (const file of ['../scripts/build-historical-scenarios.mjs','./seed/historical/authored-scenarios.mjs','./seed/historical/dossier-courts.mjs']) {
    const text = await fs.readFile(new URL(file,import.meta.url),'utf8');
    for (const pattern of [/Date\.now/,/new Date/,/toLocale/,/localeCompare/,/\bIntl\./,/Math\.random/,/process\.platform/,/process\.cwd/,/homedir|hostname\(\)/,/process\.env/])
      assert.ok(!pattern.test(text),`${file}: ${pattern}`);
  }
  const bytes = await fs.readFile(new URL('charlemagne-800/manifest.json',SEED),'utf8');
  assert.ok(!/[A-Za-z]:[\\/](?!\/)|\/home\/|\/Users\//.test(bytes));
});

test('a second build gives identical bytes under another clock zone and locale',async () => {
  const run = promisify(execFile);
  for (const env of [{ TZ: 'UTC',LANG: 'C',LC_ALL: 'C' },{ TZ: 'Pacific/Kiritimati',LANG: 'tr_TR.UTF-8',LC_ALL: 'tr_TR.UTF-8' }]) {
    const { stdout } = await run(process.execPath,['scripts/build-historical-scenarios.mjs','--check'],{ cwd: REPO,env: { ...process.env,...env },maxBuffer: 1 << 20 });
    assert.ok(JSON.parse(stdout).some(p => p.contentId === 'charlemagne-800'),JSON.stringify(env));
  }
});

// Backlog row 8: a playable polity without a court must reach the validator, which reports invalidCourt.
test('the seat list skips a playable polity without a court instead of throwing', () => {
  const settlement = { id: 'aachen', nameSv: 'Aachen', polityId: 'a', coordinates: [6, 50], sourceIds: [], noteSv: '' };
  const h = { playablePolityIds: ['a', 'b'], courtSeeds: { a: { seatId: 'aachen' } }, settlements: [settlement] };
  assert.equal(citiesFor(h).features[0].properties.seat, true);
  assert.equal(citiesFor({ ...h, courtSeeds: undefined }).features[0].properties.seat, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { withScenarioLicense, preserveComponentProvenance } from './scenarioLicense.js';
import { splitBundleFiles, restoreBundleFiles } from './bundleFiles.js';
import { buildSuggestion, buildSuggestionZip, readSuggestionFile } from './scenarioSuggestion.js';
import { zipBundle, unzipBundle } from './bundleZip.js';

const component = { id: 'historical-map', license: 'GPL-3.0-only', licenseText: 'Synthetic licence text', attribution: 'Test publisher', scope: ['regionsGeojson'], sourceUrl: 'https://example.org/source', revision: 'abc', sha256: 'a'.repeat(64), modifications: ['Test conversion'] };
const bundle = () => ({ data: { world: { componentLicenses: [component], assetProvenance: { regionsGeojson: { componentId: component.id, sha256: 'b'.repeat(64) } } } }, assets: { regionsGeojson: { mode: 'embedded', fileName: 'regions.geojson', data: { type: 'FeatureCollection', features: [], padding: 'x'.repeat(70000) } } } });
test('component terms scope authored CC BY and survive JSON and ZIP', async () => {
  const b = withScenarioLicense(bundle());
  assert.equal(b.license.scope, 'authored-content');
  assert.deepEqual(b.componentLicenses, [component]);
  assert.equal(b.assets.regionsGeojson.provenance.componentId, component.id);
  const split = splitBundleFiles(b);
  assert.match(split.files['licenses/historical-map.txt'], /Synthetic licence text/);
  const zip = await unzipBundle(await (await zipBundle({ ...split.files, 'scenario.json': JSON.stringify(split.bundle) })).arrayBuffer());
  const restored = await restoreBundleFiles(JSON.parse(await zip.text('scenario.json')),zip);
  assert.deepEqual(restored,b);
  assert.deepEqual(preserveComponentProvenance({ componentLicenses: [component], data: {}, assets: b.assets }).data.world.componentLicenses,[component]);
});
test('geometry suggestions preserve original terms and modification notices', async () => {
  const suggestion = buildSuggestion({ changes: [{ id: 'change', kind: 'borders', area: 'map', regions: [] }], scenario: { name: 'Test' }, sourceBundle: bundle() });
  const bytes = await buildSuggestionZip(suggestion);
  const zip = await unzipBundle(await bytes.arrayBuffer());
  assert.match(await zip.text('licenses/historical-map.txt'), /Test conversion/);
  const restored = await readSuggestionFile(bytes);
  assert.deepEqual(restored.componentLicenses,[component]);
  assert.deepEqual(restored.assetProvenance,bundle().data.world.assetProvenance);
});

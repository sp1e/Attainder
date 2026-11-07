import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DIR, SYNCED_FILES } from '../scripts/sync-default-scenario.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/sync-default-scenario.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const readDefault = name => JSON.parse(readFileSync(path.join(DEFAULT_DIR, name), 'utf8'));
const johnBundle = () => JSON.parse(readFileSync(new URL('./seed/historical/john-1200/scenario.json', import.meta.url), 'utf8'));

test('the committed default scenario matches the John package', () => {
  const result = run('--check');
  assert.equal(result.status, 0, result.stderr);
});

test('a one-byte edit to a copy of the default scenario fails the check, which names the file and writes nothing', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'attainder-default-sync-'));
  try {
    cpSync(DEFAULT_DIR, dir, { recursive: true });
    const target = path.join(dir, 'game.json'), text = readFileSync(target, 'utf8');
    const edited = text.replace('"Svenska"', '"Svenskb"');
    assert.notEqual(edited, text);
    writeFileSync(target, edited);
    const result = run('--check', '--dir', dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /game\.json differs from the John package/);
    assert.equal(readFileSync(target, 'utf8'), edited, 'the check writes nothing');
    for (const name of SYNCED_FILES.filter(name => name !== 'game.json')) {
      assert.equal(readFileSync(path.join(dir, name), 'utf8'), readFileSync(path.join(DEFAULT_DIR, name), 'utf8'), name);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the default world keeps the John map stamp at revision 3 and carries the package world', () => {
  const world = readDefault('world.json'), bundle = johnBundle();
  assert.equal(world.builtInMap, 'historical-john-1200-v1');
  assert.equal(world.builtInRevision, 3);
  const { builtInMap, builtInRevision, ...rest } = world;
  assert.deepEqual(rest, bundle.data.world);
  assert.equal(world.historicalScenario.contentVersion, '1.2.0');
  assert.deepEqual(readDefault('game.json'), bundle.data.game);
  assert.equal(readDefault('scenario.json').description, world.historicalScenario.contextSv);
  assert.equal(readDefault('cities.geojson').features.length, world.historicalScenario.settlements.length);
});

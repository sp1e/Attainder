import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DIR, SYNCED_FILES } from './sync-default-scenario.mjs';

const SCRIPT = fileURLToPath(new URL('./sync-default-scenario.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

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

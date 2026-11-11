// The builder turns attested name pool files into court name pools. Spec: docs/superpowers/specs/2026-11-11-name-pools-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { courtNamePool, namePoolIds } from './authored-scenarios.mjs';
import { validNamePool } from '../../characters/namePools.js';

const POOLS = new URL('./name-pools/',import.meta.url);
const poolFiles = () => readdirSync(POOLS).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(new URL(name,POOLS),'utf8')));

test('every published pool file becomes a valid court pool with its names in order', () => {
  const files = poolFiles();
  assert.ok(files.length >= 1);
  for (const file of files) {
    const pool = courtNamePool(file);
    assert.equal(validNamePool(pool),true,file.id);
    assert.deepEqual(pool,{ id: file.id,male: file.male.map(entry => entry.nameSv),female: file.female.map(entry => entry.nameSv) });
  }
});

test('a pool file with another schema is refused', () => {
  assert.throws(() => courtNamePool({ schema: 'attainder-name-pool-v0',id: 'x',male: [],female: [] }),/unknown schema/);
  assert.throws(() => courtNamePool(null),/unknown schema/);
});

test('each package names only pool files that exist', () => {
  const ids = new Set(poolFiles().map(file => file.id));
  for (const contentId of ['egypt-3000bc','charlemagne-800','john-1200','world-1500']) {
    for (const id of namePoolIds(contentId)) assert.ok(ids.has(id),`${contentId}: ${id}`);
  }
});

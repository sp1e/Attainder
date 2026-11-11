// A release patch puts back the values an earlier release held and drops the keys it did not have.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { applyReleasePatch } from './releaseFixtures.js';

const sha = text => createHash('sha256').update(text).digest('hex');

test('a patch sets the released values, drops the keys the release lacked and proves the bytes', () => {
  const released = { a: { b: 1, c: [1, 2] }, d: 'x' };
  const current = { a: { b: 2, added: true, c: [1, 2] }, d: 'x', tribes: [] };
  const patch = { contentId: 'demo', contentVersion: '1.0.0', sha256: sha(JSON.stringify(released) + '\n'), ops: [[['a', 'b'], 1], [['a', 'added']], [['tribes']]] };
  assert.deepEqual(applyReleasePatch(current, patch), released);
  assert.equal(current.a.added, true, 'the current bundle is left as it was');
  assert.throws(() => applyReleasePatch(current, { ...patch, ops: [[['a', 'b'], 1]] }), /no longer rebuilds/);
});

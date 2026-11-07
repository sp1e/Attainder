#!/usr/bin/env node
// Writes server/fixtures/<contentId>-<version>.patch.json: the subtrees in which a historical package
// released at <commit> differs from the package shipped today. Needs the git history of <commit>.
// Usage: node scripts/write-release-patch.mjs <commit> <contentId> <version>
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyReleasePatch } from '../server/fixtures/releaseFixtures.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FILE = 'scenario.json';
const sha = text => createHash('sha256').update(text).digest('hex');
const isRecord = value => value !== null && typeof value === 'object';
const sameShape = (a, b) => Array.isArray(a) ? Array.isArray(b) && a.length === b.length
  : isRecord(a) && isRecord(b) && !Array.isArray(b) && Object.keys(a).join('\0') === Object.keys(b).join('\0');

// The smallest set of [path, released value] that turns `current` back into `released`.
function diff(released, current, keys = [], ops = []) {
  if (JSON.stringify(released) === JSON.stringify(current)) return ops;
  if (!sameShape(released, current)) { ops.push([keys, released]); return ops; }
  for (const key of Object.keys(released)) diff(released[key], current[key], [...keys, Array.isArray(released) ? Number(key) : key], ops);
  return ops;
}

const [commit, contentId, contentVersion] = process.argv.slice(2);
if (!commit || !contentId || !contentVersion) throw new Error('usage: write-release-patch.mjs <commit> <contentId> <version>');
const fullCommit = execFileSync('git', ['rev-parse', commit], { cwd: ROOT, encoding: 'utf8' }).trim();
const releasedText = execFileSync('git', ['show', `${fullCommit}:server/seed/historical/${contentId}/${FILE}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const released = JSON.parse(releasedText);
if (released.data.world.historicalScenario.contentVersion !== contentVersion) throw new Error(`${contentId} at ${commit} is not ${contentVersion}`);
const current = JSON.parse(readFileSync(new URL(`../server/seed/historical/${contentId}/${FILE}`, import.meta.url), 'utf8'));
const patch = { contentId, contentVersion, commit: fullCommit, file: FILE, bytes: Buffer.byteLength(releasedText), sha256: sha(releasedText), ops: diff(released, current) };
applyReleasePatch(current, patch);
const out = new URL(`../server/fixtures/${contentId}-${contentVersion}.patch.json`, import.meta.url);
writeFileSync(out, JSON.stringify(patch) + '\n');
console.log(`${fileURLToPath(out)}: ${patch.ops.length} ops`);

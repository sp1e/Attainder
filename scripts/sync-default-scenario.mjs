#!/usr/bin/env node
// Writes the built-in scenario `default` (server/seed/default) from the John package it installs,
// server/seed/historical/john-1200. The library compares the world's builtInMap and builtInRevision
// with an installed copy: the same map with a higher revision refreshes the copy in place and keeps
// the campaigns on it, so a new John release raises the revision and keeps the map stamp.
//
// Run: node scripts/sync-default-scenario.mjs [--check] [--dir <default folder>]
// --check writes nothing; it exits 1 and names the first file that differs from the package.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PACKAGE_DIR = path.join(ROOT, 'server', 'seed', 'historical', 'john-1200');
export const DEFAULT_DIR = path.join(ROOT, 'server', 'seed', 'default');
export const BUILT_IN_MAP = 'historical-john-1200-v1';
export const BUILT_IN_REVISION = 4;
export const SYNCED_FILES = Object.freeze(['world.json', 'game.json', 'scenario.json', 'cities.geojson', 'regions.geojson']);

const line = value => JSON.stringify(value) + '\n';
const packageBundle = () => JSON.parse(readFileSync(path.join(PACKAGE_DIR, 'scenario.json'), 'utf8'));

// The library card of the built-in: the package's bundle name and start text under the id `default`.
const scenarioMeta = (bundle, h) => ({ id: 'default', name: bundle.scenario.name, description: bundle.scenario.description,
  eyebrow: 'HISTORISK KAMPANJ', heroTitle: bundle.scenario.name, heroSubtitle: bundle.scenario.description, subtitle: h.eraLabelSv });

// Each file's bytes as git stores them: one line of JSON and a newline. The bundle embeds the package's
// cities.geojson and regions.geojson, which serialize to the same bytes. Tests pass an earlier release.
export function defaultScenarioFiles(bundle = packageBundle(), revision = BUILT_IN_REVISION) {
  const world = { ...bundle.data.world, builtInMap: BUILT_IN_MAP, builtInRevision: revision };
  return { 'world.json': line(world), 'game.json': line(bundle.data.game), 'scenario.json': line(scenarioMeta(bundle, world.historicalScenario)),
    'cities.geojson': line(bundle.assets.citiesGeojson.data), 'regions.geojson': line(bundle.assets.regionsGeojson.data) };
}

// A Windows checkout with core.autocrlf ends the single line with CRLF; git stores the same LF bytes.
const sameFile = (onDisk, expected) => onDisk === expected || onDisk === expected.replace(/\n$/, '\r\n');

// Returns the first differing file name, or null. Without check, rewrites each differing file and keeps its line ending.
export function syncDefaultScenario({ check = false, dir = DEFAULT_DIR } = {}) {
  const files = defaultScenarioFiles();
  for (const name of SYNCED_FILES) {
    const target = path.join(dir, name);
    const onDisk = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (onDisk !== null && sameFile(onDisk, files[name])) continue;
    if (check) return name;
    writeFileSync(target, onDisk?.endsWith('\r\n') ? files[name].replace(/\n$/, '\r\n') : files[name], 'utf8');
  }
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--dir');
  if (at >= 0 && !args[at + 1]) throw new Error('usage: sync-default-scenario.mjs [--check] [--dir <default folder>]');
  const dir = at >= 0 ? path.resolve(args[at + 1]) : DEFAULT_DIR;
  const check = args.includes('--check');
  const differing = syncDefaultScenario({ check, dir });
  if (check && differing) {
    console.error(`${path.join(dir, differing)} differs from the John package; run node scripts/sync-default-scenario.mjs`);
    process.exit(1);
  }
  console.log(check ? `${dir} matches the John package` : `${dir} written from the John package`);
}

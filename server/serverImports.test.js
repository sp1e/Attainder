// Run: node --test server/serverImports.test.js
//
// The desktop app packages dist/ (the built client) and server/ — never src/
// (package.json "build.files"). A server-side import of ../src/… loads in
// development, where the whole tree is on disk, and fails in the installed
// app: "Cannot find module …/app.asar/src/runtime/coarseGeometry.js imported
// from …/app.asar/server/libraryStore.js" took the beta down at startup.
// Code both sides use lives under server/ and the client imports it from
// there (ownerMigration.js, coarseGeometry.js).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const packaged = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")).build.files;

const modulesIn = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? modulesIn(file) : /\.(js|cjs|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [file] : [];
});
const serverModules = modulesIn(here);

const importsOf = (file) => {
  const text = fs.readFileSync(file, "utf-8");
  const out = [];
  for (const match of text.matchAll(/\b(?:import\s*\(\s*|import\s+|(?:import|export)\b[^;]*?\bfrom\s*)["']([^"']+)["']/g)) out.push(match[1]);
  return out;
};

test("the desktop package ships server/ but not src/", () => {
  assert.ok(packaged.includes("server/**"), "server/** is packaged");
  assert.ok(!packaged.some((entry) => /^src\b/.test(entry)), "src/ is not packaged — the client ships built, in dist/");
});

test("no server module imports from src/, which the installed app does not carry", () => {
  const offenders = [];
  for (const file of serverModules) {
    for (const specifier of importsOf(file)) {
      if (specifier.startsWith(".") && path.resolve(path.dirname(file), specifier).startsWith(path.join(root, "src") + path.sep)) offenders.push(`${path.basename(file)} -> ${specifier}`);
    }
  }
  assert.deepEqual(offenders, [], "move the module under server/ and import it from there on both sides");
});

test("every relative import inside server/ resolves to a file that exists", () => {
  const missing = [];
  for (const file of serverModules) {
    for (const specifier of importsOf(file)) {
      if (!specifier.startsWith(".")) continue;
      const target = path.resolve(path.dirname(file), specifier);
      if (!fs.existsSync(target)) missing.push(`${path.basename(file)} -> ${specifier}`);
    }
  }
  assert.deepEqual(missing, []);
});


test("nested packaging guard detects normalized imports, re-exports, side effects and dynamic imports", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'attainder-import-guard-'));
  try {
    const nested = path.join(fixture, 'server', 'characters');
    fs.mkdirSync(nested, { recursive: true });
    const source = path.join(nested, 'unsafe.mjs');
    fs.writeFileSync(source, `import { bad } from '../../src/static.js';
export * from '../characters/../../src/export.js';
import '../../src/side-effect.js';
const lazy = () => import('../../src/dynamic.js');
import {
  multiline
} from '../../src/multiline.js';
export {
  other
} from '../../src/reexport.js';`);
    assert.deepEqual(modulesIn(path.join(fixture, 'server')), [source]);
    assert.equal(importsOf(source).length, 6);
    assert.equal(importsOf(source).filter(specifier => path.resolve(nested, specifier).startsWith(path.join(fixture, 'src') + path.sep)).length, 6);
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});

// scripts/seed-web-defaults.mjs writes the git-ignored modules under src/runtime/web/generated.
// Several test files run it while others import from that folder in parallel, so a run must
// leave in place every module it produces: it rewrites a file only when its content changes,
// removes only the modules of packages no longer listed, and leaves no temporary file behind.
// These tests point the script at a folder of their own (WEB_SEED_OUT_DIR), so they touch
// nothing the other test files read.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SEED = fileURLToPath(new URL("../../../scripts/seed-web-defaults.mjs", import.meta.url));

const withOutDir = (run) => {
  const dir = mkdtempSync(path.join(tmpdir(), "web-seed-"));
  try { return run(dir, () => execFileSync(process.execPath, [SEED], { env: { ...process.env, WEB_SEED_OUT_DIR: dir } })); }
  finally { rmSync(dir, { recursive: true, force: true }); }
};
const temporaryFiles = (dir) => [dir, path.join(dir, "historical")].flatMap((folder) => readdirSync(folder).filter((name) => name.endsWith(".tmp")));

test("a second seed run leaves the historical index and the default seed untouched", () => withOutDir((dir, runSeed) => {
  runSeed();
  const files = [path.join(dir, "historical", "index.js"), path.join(dir, "defaultScenarioMeta.js")];
  const before = files.map((file) => statSync(file).mtimeMs);
  runSeed();
  assert.deepEqual(files.map((file) => statSync(file).mtimeMs), before);
}));

test("a seed run removes the module of a package it no longer lists and keeps the index", () => withOutDir((dir, runSeed) => {
  runSeed();
  const dropped = path.join(dir, "historical", "dropped-package.js");
  writeFileSync(dropped, "export default null;\n");
  runSeed();
  assert.equal(existsSync(dropped), false);
  assert.ok(existsSync(path.join(dir, "historical", "index.js")));
}));

test("a seed run replaces a stale module that another process keeps reading, and leaves no temporary file", () => withOutDir((dir, runSeed) => {
  runSeed();
  const index = path.join(dir, "historical", "index.js");
  const fresh = readFileSync(index, "utf8");
  writeFileSync(index, "export const HISTORICAL_BUNDLE_LOADERS = {};\n");
  // Windows refuses to rename over a file while another process has it open.
  const reader = spawn(process.execPath, ["-e", `const fs = require("fs"); const end = Date.now() + 4000; while (Date.now() < end) { try { fs.readFileSync(${JSON.stringify(index)}); } catch {} }`]);
  try {
    const start = Date.now();
    while (Date.now() - start < 300) { /* let the reader start */ }
    runSeed();
  } finally { reader.kill(); }
  assert.equal(readFileSync(index, "utf8"), fresh);
  assert.deepEqual(temporaryFiles(dir), []);
}));

test("a seed run removes a temporary file of a run that has ended and keeps one of a running process", () => withOutDir((dir, runSeed) => {
  runSeed();
  const ended = spawnSync(process.execPath, ["-e", ""]).pid;
  const orphan = path.join(dir, `defaultScenario.js.${ended}.tmp`);
  const historicalOrphan = path.join(dir, "historical", `index.js.${ended}.tmp`);
  const running = path.join(dir, `countryNames.js.${process.pid}.tmp`);
  for (const file of [orphan, historicalOrphan, running]) writeFileSync(file, "partial");
  runSeed();
  assert.equal(existsSync(orphan), false);
  assert.equal(existsSync(historicalOrphan), false);
  assert.ok(existsSync(running), "a running process may still rename its file");
}));

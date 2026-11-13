// scripts/seed-web-defaults.mjs writes the git-ignored modules under src/runtime/web/generated.
// Several test files run it while others import from that folder in parallel, so a run must
// leave in place every module it produces: it rewrites a file only when its content changes,
// and removes only the modules of packages no longer listed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SEED = fileURLToPath(new URL("../../../scripts/seed-web-defaults.mjs", import.meta.url));
const HISTORICAL = new URL("./generated/historical/", import.meta.url);
const runSeed = () => execFileSync(process.execPath, [SEED]);

test("a second seed run leaves the historical index and the default seed untouched", () => {
  runSeed();
  const files = [new URL("index.js", HISTORICAL), new URL("./generated/defaultScenarioMeta.js", import.meta.url)];
  const before = files.map((file) => statSync(file).mtimeMs);
  runSeed();
  assert.deepEqual(files.map((file) => statSync(file).mtimeMs), before);
});

test("a seed run removes the module of a package it no longer lists and keeps the index", () => {
  runSeed();
  const dropped = new URL("dropped-package.js", HISTORICAL);
  writeFileSync(dropped, "export default null;\n");
  runSeed();
  assert.equal(existsSync(dropped), false);
  assert.ok(existsSync(new URL("index.js", HISTORICAL)));
});

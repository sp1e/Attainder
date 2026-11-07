import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { researchEndYear } from "./historicalResearchRange.js";

const range = (startYear, endYear, status) => ({ startYear, endYear, status, note: "" });

// Codex extends the coverage file as research lands, so this test checks the shape of the
// answer instead of a fixed year: a researched range ends there and none ends later.
test("the real coverage file ends research at the last researched range", () => {
  const coverage = JSON.parse(readFileSync(new URL("../../server/seed/historical/events/coverage.json", import.meta.url), "utf8"));
  const year = researchEndYear(coverage);
  const researched = coverage.ranges.filter((r) => r.status !== "unresearched");
  assert.ok(researched.some((r) => r.endYear === year));
  assert.ok(researched.every((r) => r.endYear <= year));
});

test("a later researched range wins over earlier ones", () => {
  const coverage = { ranges: [range(-3300, 799, "unresearched"), range(800, 899, "partial"), range(900, 1100, "complete"), range(1101, 1530, "unresearched")] };
  assert.equal(researchEndYear(coverage), 1100);
});

test("the highest end year wins whatever the order of the ranges", () => {
  const coverage = { ranges: [range(900, 999, "partial"), range(800, 899, "partial")] };
  assert.equal(researchEndYear(coverage), 999);
});

test("no researched range gives null", () => {
  assert.equal(researchEndYear({ ranges: [range(-3300, 799, "unresearched"), range(800, 1530, "unresearched")] }), null);
});

test("missing or empty ranges give null", () => {
  assert.equal(researchEndYear({}), null);
  assert.equal(researchEndYear({ ranges: [] }), null);
  assert.equal(researchEndYear(null), null);
  assert.equal(researchEndYear(undefined), null);
});

// Run: node --test src/Game/AI/explicitDates.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { explicitRequestDates, explicitYear } from "./explicitDates.js";

test("named-month dates accept one- to three-digit years at the end of a phrase", () => {
  assert.deepEqual(explicitRequestDates("Crown him on 25 December 800"), ["0800-12-25"]);
  assert.deepEqual(explicitRequestDates("The coronation of December 25, 800."), ["0800-12-25"]);
  assert.deepEqual(explicitRequestDates("Rome, 25 December AD 800 at Saint Peter's"), ["0800-12-25"]);
  assert.deepEqual(explicitRequestDates("on 4 July 76 CE the treaty"), ["0076-07-04"]);
});

test("BC dates are negative in the signed calendar", () => {
  assert.deepEqual(explicitRequestDates("Flood the delta on 15 March 3000 BC"), ["-3000-03-15"]);
  assert.deepEqual(explicitRequestDates("Hannibal leaves on 1 March 218 B.C. with elephants"), ["-0218-03-01"]);
  assert.deepEqual(explicitRequestDates("Siege ends 0218-03-01 BC"), ["-0218-03-01"]);
});

test("a short number followed by a word is no year", () => {
  assert.deepEqual(explicitRequestDates("On March 3, 200 soldiers desert"), []);
  assert.deepEqual(explicitRequestDates("By 3 March 200 men had gathered"), []);
  assert.deepEqual(explicitRequestDates("Muster May 5, 20, 30 men in all"), []);
});

test("four-digit and ISO dates read as before", () => {
  assert.deepEqual(explicitRequestDates("Hold the vote December 25, 2025 in Paris"), ["2025-12-25"]);
  assert.deepEqual(explicitRequestDates("0800-12-25 and 28 June 1914"), ["0800-12-25", "1914-06-28"]);
  assert.deepEqual(explicitRequestDates("nothing dated here"), []);
  assert.deepEqual(explicitRequestDates(""), []);
});

test("explicitYear reads the cutoff year in its usual spellings", () => {
  assert.equal(explicitYear("25 December 800"), 800);
  assert.equal(explicitYear("AD 800"), 800);
  assert.equal(explicitYear("800 CE"), 800);
  assert.equal(explicitYear("Christmas Day 800"), 800);
  assert.equal(explicitYear("0800-12-25"), 800);
  assert.equal(explicitYear("3000 BC"), -3000);
  assert.equal(explicitYear("28 June 1914"), 1914);
  assert.equal(explicitYear("shared history through 1913, diverging 28 June 1914"), 1913);
  assert.equal(explicitYear("history once 28 June 1919"), 1919);
  assert.equal(explicitYear("road 66 then 1914"), 1914);
  assert.equal(explicitYear("Alliance 3 powers until 1914"), 1914);
  assert.equal(explicitYear("through 1913, diverging 28 June 1914 AD"), 1913);
  assert.equal(explicitYear("once 76 CE"), 76);
  assert.equal(explicitYear("12345"), 12345);
  assert.equal(explicitYear("12345-01-01 and 1 2"), 12345);
  assert.equal(explicitYear("1 and 2"), null);
  assert.equal(explicitYear(""), null);
  assert.equal(explicitYear("the coronation"), null);
});

test("gameplay reads both dates through the module", () => {
  const source = readFileSync(new URL("./gameplay.js", import.meta.url), "utf8");
  assert.match(source, /import \{ explicitRequestDates, explicitYear \} from "\.\/explicitDates\.js";/);
  assert.match(source, /export const extractExplicitGameMasterRequestDates = \(requestText\) => explicitRequestDates\(requestText\);/);
  assert.match(source, /const cutoffYear = explicitYear\(cutoff\);/);
  assert.match(source, /Number\.isInteger\(cutoffYear\) && cutoffYear >= 1 && anchorYear > cutoffYear \+ 1/);
});

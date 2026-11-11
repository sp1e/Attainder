import assert from "node:assert/strict";
import test from "node:test";
import { modelText, playerText } from "./playerText.js";

const FALLBACK = "Handlingen kunde inte genomföras.";
const ENGLISH_REFUSAL = "The council refuses to back the plan.";

// Runs `work` with console.warn captured, so a test can read what was kept from the player.
function withWarnings(work) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  try { return { result: work(), warnings }; } finally { console.warn = original; }
}

test("a model's sentence passes in either language", () => {
  const { result, warnings } = withWarnings(() => [ENGLISH_REFUSAL, "Rådet vägrar att stödja planen.", "  Will the court agree?  ", "Aldrig!"].map((text) => modelText(text, FALLBACK)));
  assert.deepEqual(result, [ENGLISH_REFUSAL, "Rådet vägrar att stödja planen.", "Will the court agree?", "Aldrig!"]);
  assert.deepEqual(warnings, []);
});

test("a model text that is no single sentence within its limit gives the fallback and goes to the log", () => {
  const tooLong = `${"a".repeat(300)}.`;
  for (const broken of ["Failed to fetch", "The council refuses.\nIt will not change its mind.", "First line.\r\nSecond line.", tooLong]) {
    const { result, warnings } = withWarnings(() => modelText(broken, FALLBACK));
    assert.equal(result, FALLBACK, broken.slice(0, 30));
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes(broken.trim()), "the log holds what was kept back");
  }
});

test("the length limit is 300 characters unless the field names its own", () => {
  const atLimit = `${"a".repeat(299)}.`;
  assert.equal(modelText(atLimit, FALLBACK), atLimit);
  assert.equal(modelText(ENGLISH_REFUSAL, FALLBACK, ENGLISH_REFUSAL.length), ENGLISH_REFUSAL);
  assert.equal(withWarnings(() => modelText(ENGLISH_REFUSAL, FALLBACK, ENGLISH_REFUSAL.length - 1)).result, FALLBACK);
});

test("nothing to show gives the fallback without a log line", () => {
  for (const empty of ["", "   ", undefined, null, 42, { text: "x" }]) {
    for (const filter of [modelText, playerText]) {
      const { result, warnings } = withWarnings(() => filter(empty, FALLBACK));
      assert.equal(result, FALLBACK);
      assert.deepEqual(warnings, []);
    }
  }
});

test("playerText keeps its rule: a Swedish refusal passes, an English sentence and an internal error do not", () => {
  assert.equal(playerText("Hovet saknar silver.", FALLBACK), "Hovet saknar silver.");
  assert.equal(playerText("Du är oförmögen att handla.", FALLBACK), "Du är oförmögen att handla.", "of inside a Swedish word is no English word");
  for (const internal of [ENGLISH_REFUSAL, "Failed to fetch", "Request failed with status 503.", "Unexpected token < in JSON at position 0", "Hovet saknar silver"]) {
    const { result, warnings } = withWarnings(() => playerText(internal, FALLBACK));
    assert.equal(result, FALLBACK, internal);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes(internal));
  }
});

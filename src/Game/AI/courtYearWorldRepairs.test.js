// A court year is not lost to a name.
// Spec: docs/superpowers/specs/2026-11-16-court-year-world-repairs-design.md.
//
// gameplay.js cannot be loaded under bare node, so these tests read its source, as nameRefs.test.js does.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const gameplay = fs.readFileSync(new URL("./gameplay.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
// The validator is one long function; what these tests look for stands in its first forty thousand characters.
const validatorStart = gameplay.indexOf("export const validateGeneratedWorldChanges");
const validator = validatorStart < 0 ? "" : gameplay.slice(validatorStart, validatorStart + 40000);

test("a court year's world changes are strict only while a retry remains", () => {
  const call = gameplay.slice(gameplay.indexOf("// The war ledger must see the sanitized impacts, so world changes go first."));
  const argumentsOfCall = call.slice(call.indexOf("validateGeneratedWorldChanges(candidate, bundle.world, {"), call.indexOf("if (worldChangeError) return worldChangeError;"));
  assert.match(argumentsOfCall, /strictTransfers: !finalAttempt,/, "the last answer is repaired in place, with or without a court");
  // A court year's last answer drops what the map does not have and adds nothing: the completion of a narrated
  // capture stays off there, unmeasured.
  assert.match(argumentsOfCall, /captureGuard: !\(finalAttempt && Boolean\(bundle\.world\.characterSystem\)\),/);
  assert.match(gameplay, /const strict = Boolean\(bundle\.world\.characterSystem\) \|\| !finalAttempt;/,
    "the year's dates keep the court's rule");
});

test("the contract the call now keeps is the validator's own", () => {
  assert.match(gameplay, /Callers set it on every attempt EXCEPT the\n\/\/ last \(runJsonTask passes finalAttempt to validatePayload\)/);
});

test("the two refusals that cost a court year stand in the strict branch, with a repair beside them", () => {
  assert.ok(validator.length > 1000, "the validator's source was found");
  // An operation on a unit the map does not have: told while strict, dropped otherwise.
  assert.match(validator, /if \(!unitIds\.has\(unitId\)\) \{\s+if \(strict\) return `\$\{operationPath\}\.unitId "\$\{unitId\}" does not name one existing unit\./);
  assert.match(validator, /continue; \/\/ salvage: drop the op aimed at a unit that no longer exists/);
  // The capture heuristic: a nudge on a strict attempt, a completed capture otherwise.
  assert.match(validator, /if \(strict && captureGuard && Array\.isArray\(candidate\?\.events\)\) \{/);
  assert.match(validator, /if \(!strict && captureGuard && !resolvedRegionIdsOnly && Array\.isArray\(candidate\?\.events\)\) \{\s+await completeNarratedCaptures\(/);
});

test("a court year's war ledger is strict only while a retry remains", () => {
  // Measured on 18 November 2026: one year in five was refused because a revolt that "collapses without a battle"
  // read as hard combat with fewer than two combatants. The ledger's own repair keeps the event as narrative and
  // takes only its war link away.
  assert.match(gameplay, /validateSegmentLedgers\(candidate, \{ world: ledgerWorld, strict: !finalAttempt, segmentIndex, receipt: draft \}\)/);
  const ledger = gameplay.slice(gameplay.indexOf("const validateSegmentLedgers = "), gameplay.indexOf("const validateSegmentLedgers = ") + 6000);
  assert.match(ledger, /if \(combatWarRepair\.unresolved\.length && strict\) \{/, "the refusal stands in the strict branch");
  assert.match(ledger, /\? \{ \.\.\.event, warId: "", combatants: \[\] \}/, "the repair keeps the event and removes its war link");
});

test("a court year's consequence check is strict only while a retry remains", () => {
  // The ledger's repair takes an event's war link away, and the link can be the event's only consequence channel
  // (eventCanonicalConsequenceChannels counts warId and warUpdates). A strict check after the repair would refuse
  // the year the repair had just kept.
  const afterLedger = gameplay.slice(gameplay.indexOf("const ledgerError = validateSegmentLedgers(candidate, { world: ledgerWorld, strict: !finalAttempt"));
  const call = afterLedger.slice(afterLedger.indexOf("return validateSegmentStorylines(candidate, {"), afterLedger.indexOf("onAccepted:"));
  assert.match(call, /\n\s+strict: !finalAttempt,\n/);
  const storylines = gameplay.slice(gameplay.indexOf("const validateSegmentStorylines = "), gameplay.indexOf("const validateSegmentStorylines = ") + 4000);
  assert.match(storylines, /const consequenceError = validateWorldEventConsequencePayload\(candidate, \{\s+selectedStorylines: analysis\?\.attentionStorylines,\s+strict,/,
    "the one check that argument governs");
  const director = fs.readFileSync(new URL("./nativeWorldDirector.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const check = director.slice(director.indexOf("export const validateWorldEventConsequencePayload = ("));
  assert.match(check.slice(0, 400), /\) => \{\n {2}if \(!strict\) return "";/, "fail-soft is the check's own first line");
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGameplayPayload, validateGameplayPayload } from "../Game/AI/gameplaySchemas.js";

const command = (id) => ({ id, kind: "command", type: "resolve_story", payloadJson: JSON.stringify({ storyId: "story-1", choiceId: "wait" }) });
const payload = (ops) => ({ clearActions: true, stopDate: "-0299-01-01", summary: "Ett politiskt år.",
  events: [{ id: "year", date: "-0299-01-01", title: "Rådet förhandlar", description: "Ett förslag om familjens krav läggs fram.",
    impacts: { characterOps: ops } }] });

test("all jump schema variants preserve valid character proposals", () => {
  for (const task of ["jumpForward", "autoJumpForward"]) {
    const normalized = normalizeGameplayPayload(task, payload([command("one")]));
    assert.deepEqual(normalized.events[0].impacts.characterOps, [command("one")]);
    assert.deepEqual(validateGameplayPayload(task, normalized), { valid: true, error: "" });
  }
});

test("nested impact wrappers retain both command arrays", () => {
  const value = payload([command("outer")]);
  value.events[0].impacts.impacts = { characterOps: [command("inner")] };
  const normalized = normalizeGameplayPayload("jumpForward", value);
  assert.deepEqual(normalized.events[0].impacts.characterOps.map((op) => op.id), ["inner", "outer"]);
});

test("model schemas reject authoritative checkpoints and arbitrary state fields", () => {
  assert.equal(validateGameplayPayload("jumpForward", payload([{ id: "forged", kind: "checkpoint", state: {} }])).valid, false);
  assert.equal(validateGameplayPayload("jumpForward", payload([{ ...command("bad"), state: {} }])).valid, false);
});

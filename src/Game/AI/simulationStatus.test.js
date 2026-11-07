import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  beginSimulation,
  discardPendingJumpSegment,
  discardPendingProjectsJump,
  endSimulation,
  isChatGenerationLikely,
  setChatGenerationInFlight,
  setPendingJumpSegment,
  setPendingProjectsJump,
  subscribeChatGeneration,
  subscribeSimulationIdle,
} from "./simulationStatus.js";

test("the chat is told when a generation starts and stops, once per change", () => {
  const seen = [];
  const unsubscribe = subscribeChatGeneration((value) => seen.push(value));
  setChatGenerationInFlight(true);
  setChatGenerationInFlight(true);
  assert.equal(isChatGenerationLikely(), true);
  setChatGenerationInFlight(false);
  setChatGenerationInFlight(undefined);
  assert.deepEqual(seen, [true, false]);

  unsubscribe();
  setChatGenerationInFlight(true);
  assert.deepEqual(seen, [true, false]);
  setChatGenerationInFlight(false);
});

test("a listener that throws does not stop the others or the flag", () => {
  const seen = [];
  const dropBroken = subscribeChatGeneration(() => {
    throw new Error("broken listener");
  });
  const dropGood = subscribeChatGeneration((value) => seen.push(value));
  setChatGenerationInFlight(true);
  assert.equal(isChatGenerationLikely(), true);
  assert.deepEqual(seen, [true]);
  setChatGenerationInFlight(false);
  dropBroken();
  dropGood();
});

test("idle listeners fire when the last simulation ends, and a throwing one breaks nothing", () => {
  let calls = 0;
  const dropBroken = subscribeSimulationIdle(() => { throw new Error("broken listener"); });
  const dropGood = subscribeSimulationIdle(() => { calls += 1; });
  beginSimulation();
  beginSimulation();
  endSimulation();
  assert.equal(calls, 0);
  endSimulation();
  assert.equal(calls, 1);
  dropGood();
  beginSimulation();
  endSimulation();
  assert.equal(calls, 1);
  dropBroken();
});

test("idle listeners fire when a discard clears the last busy state", () => {
  let calls = 0;
  const drop = subscribeSimulationIdle(() => { calls += 1; });
  setPendingJumpSegment({ held: true });
  assert.equal(discardPendingJumpSegment(), true);
  assert.equal(calls, 1);
  setPendingProjectsJump({ held: true });
  assert.equal(discardPendingProjectsJump(), true);
  assert.equal(calls, 2);
  // Nothing was held, so nothing became idle.
  assert.equal(discardPendingJumpSegment(), false);
  assert.equal(calls, 2);
  // A discard while a simulation still runs stays quiet; the end of it speaks.
  beginSimulation();
  setPendingJumpSegment({ held: true });
  discardPendingJumpSegment();
  assert.equal(calls, 2);
  endSimulation();
  assert.equal(calls, 3);
  // A held turn that outlives a discard of the other kind keeps the game busy.
  setPendingProjectsJump({ held: true });
  setPendingJumpSegment({ held: true });
  discardPendingJumpSegment();
  assert.equal(calls, 3);
  discardPendingProjectsJump();
  assert.equal(calls, 4);
  drop();
});

test("the chat panel subscribes instead of polling the flag on a timer", () => {
  const chat = fs.readFileSync(new URL("../GameUI/chat.jsx", import.meta.url), "utf8");
  assert.match(chat, /subscribeChatGeneration\(setIsGenerating\)/);
  assert.doesNotMatch(chat, /setInterval\(\(\) => setIsGenerating/);
});

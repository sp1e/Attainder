import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryStorage } from "./unseenEvents.js";
import { createHistoricalYearSeen, HISTORY_SEEN_KEY } from "./historicalYearSeen.js";

const fresh = () => {
  const storage = createMemoryStorage();
  return { storage, seen: createHistoricalYearSeen({ storage }) };
};

test("a new campaign keeps its startDate as the watermark", () => {
  const { seen } = fresh();
  const dates = { startDate: "0800-12-25", gameDate: "0800-12-25" };
  assert.equal(seen.seenThrough("g1", dates), "0800-12-25");
  assert.equal(seen.pendingWindow("g1", dates), null);
});

test("an old save takes gameDate and gets no backlog window", () => {
  const { seen } = fresh();
  const dates = { startDate: "0800-12-25", gameDate: "0950-03-01" };
  assert.equal(seen.seenThrough("g1", dates), "0950-03-01");
  assert.equal(seen.pendingWindow("g1", dates), null);
});

test("a later gameDate gives the window from the watermark", () => {
  const { seen } = fresh();
  seen.seenThrough("g1", { startDate: "0800-12-25", gameDate: "0800-12-25" });
  assert.deepEqual(
    seen.pendingWindow("g1", { startDate: "0800-12-25", gameDate: "0810-01-01" }),
    { from: "0800-12-25", to: "0810-01-01" },
  );
});

test("markSeen moves forward only", () => {
  const { seen, storage } = fresh();
  const dates = { startDate: "0800-12-25", gameDate: "0800-12-25" };
  seen.seenThrough("g1", dates);
  seen.markSeen("g1", "0810-01-01");
  const before = storage.getItem(HISTORY_SEEN_KEY);
  seen.markSeen("g1", "0805-01-01");
  seen.markSeen("g1", "0810-01-01");
  assert.equal(storage.getItem(HISTORY_SEEN_KEY), before);
  assert.equal(seen.seenThrough("g1", dates), "0810-01-01");
});

test("a lower gameDate after an undo gives no window", () => {
  const { seen } = fresh();
  seen.seenThrough("g1", { startDate: "0800-12-25", gameDate: "0800-12-25" });
  seen.markSeen("g1", "0820-01-01");
  assert.equal(seen.pendingWindow("g1", { startDate: "0800-12-25", gameDate: "0815-01-01" }), null);
});

test("two games keep separate marks", () => {
  const { seen } = fresh();
  seen.seenThrough("a", { startDate: "0800-12-25", gameDate: "0800-12-25" });
  seen.seenThrough("b", { startDate: "1066-01-01", gameDate: "1066-01-01" });
  seen.markSeen("a", "0900-01-01");
  assert.equal(seen.seenThrough("a", { startDate: "0800-12-25", gameDate: "0900-01-01" }), "0900-01-01");
  assert.equal(seen.seenThrough("b", { startDate: "1066-01-01", gameDate: "1070-01-01" }), "1066-01-01");
});

test("garbage in storage reads as first-seen", () => {
  for (const garbage of ["not json", "[1,2]", '{"games":"x"}', '{"games":[{"id":"g1","through":"nope"},null]}']) {
    const storage = createMemoryStorage({ [HISTORY_SEEN_KEY]: garbage });
    const seen = createHistoricalYearSeen({ storage });
    const dates = { startDate: "0800-12-25", gameDate: "0900-01-01" };
    assert.equal(seen.seenThrough("g1", dates), "0900-01-01");
    assert.equal(seen.pendingWindow("g1", dates), null);
  }
});

test("empty id or invalid date gives no window and writes nothing", () => {
  const { seen, storage } = fresh();
  assert.equal(seen.pendingWindow("", { startDate: "0800-12-25", gameDate: "0800-12-25" }), null);
  assert.equal(seen.pendingWindow("g1", { startDate: "0800-12-25", gameDate: "soon" }), null);
  seen.markSeen("g1", "soon");
  seen.markSeen("", "0800-12-25");
  assert.equal(storage.getItem(HISTORY_SEEN_KEY), null);
});

test("storage that throws on setItem loses nothing but the mark", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("refused"); } };
  const seen = createHistoricalYearSeen({ storage });
  const dates = { startDate: "0800-12-25", gameDate: "0800-12-25" };
  assert.equal(seen.seenThrough("g1", dates), "0800-12-25");
  seen.markSeen("g1", "0810-01-01");
  seen.markSeen("g1", "0805-01-01");
  assert.equal(seen.seenThrough("g1", dates), "0810-01-01");
  assert.equal(seen.pendingWindow("g1", { ...dates, gameDate: "0810-01-01" }), null);
  assert.deepEqual(
    seen.pendingWindow("g1", { ...dates, gameDate: "0812-01-01" }),
    { from: "0810-01-01", to: "0812-01-01" },
  );
});

test("the 25th game evicts the oldest", () => {
  const { seen, storage } = fresh();
  for (let i = 1; i <= 25; i += 1) {
    seen.seenThrough(`g${i}`, { startDate: "0800-12-25", gameDate: "0800-12-25" });
  }
  const games = JSON.parse(storage.getItem(HISTORY_SEEN_KEY)).games;
  assert.equal(games.length, 24);
  assert.equal(games[0].id, "g2");
  assert.equal(games.at(-1).id, "g25");
  // The evicted game is first-seen again, at its current date.
  assert.equal(seen.seenThrough("g1", { startDate: "0800-12-25", gameDate: "0900-01-01" }), "0900-01-01");
});

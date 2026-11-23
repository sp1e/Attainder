// The court over the map, slice 4: the year line, the year turn and the court bar.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, "Slice 4: the year and the top bar".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { yearLineOf } from "./courtShell.js";
import { createCourtYear } from "./courtYear.js";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const story = (id, dueAt, extra = {}) => ({ id, title: `Ärende ${id}`, status: "open", dueAt, ...extra });
const VIEW = {
  date: "0802-12-25",
  people: [],
  stories: [
    story("ransom", "0803-12-25"),
    story("duel", "0803-03-25"),
    story("demand", "0803-12-25"),
    story("done", "0803-02-01", { status: "resolved" }),
    story("far", "0803-12-26"),
    story("open-ended", ""),
    story("late", "0802-11-01"),
  ],
};
const lineOf = (...stories) => yearLineOf({ date: "0802-12-25", stories });

test("the line is the twelve months ahead of the game's date, a mark for each month", () => {
  const line = yearLineOf(VIEW);
  assert.equal(line.from, "0802-12-25");
  assert.equal(line.to, "0803-12-25");
  assert.equal(line.months.length, 12);
  assert.deepEqual(line.months.map((mark) => mark.month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual([line.months[0].year, line.months.at(-1).year], [803, 803], "January carries the new year");
  assert.ok(line.months.every((mark, index, all) => mark.at > 0 && mark.at < 1 && (index === 0 || mark.at > all[index - 1].at)), "the marks run left to right inside the line");
  assert.equal(Number(line.months[0].at.toFixed(4)), Number((7 / 365).toFixed(4)), "the first of January is seven days in");
});

test("a tick stands at each open matter's deadline, the nearest first, matters of one day together", () => {
  const { ticks, beyond } = yearLineOf(VIEW);
  assert.deepEqual(ticks.map((tick) => tick.dueAt), ["0802-11-01", "0803-03-25", "0803-12-25"]);
  assert.deepEqual(ticks[2].matters, [{ id: "ransom", title: "Ärende ransom" }, { id: "demand", title: "Ärende demand" }]);
  assert.deepEqual(ticks.map((tick) => tick.soon), [true, true, false], "a deadline within three months is soon");
  assert.equal(ticks[0].at, 0, "a deadline already passed stands at the line's start");
  assert.equal(Number(ticks[1].at.toFixed(4)), Number((90 / 365).toFixed(4)));
  assert.equal(ticks[2].at, 1);
  assert.deepEqual(ticks.map((tick) => tick.end), [false, false, true], "a tick near the line's end writes to the left of its mark");
  const gap = 1 - 90 / 365;
  assert.deepEqual(ticks.map((tick) => Number(tick.room.toFixed(4))), [Number((90 / 365).toFixed(4)), Number((gap / 2).toFixed(4)), Number((gap / 2).toFixed(4))],
    "a label has the gap to the next tick, or half of it when the two grow toward each other");
  const lone = lineOf(story("a", "0803-01-25")).ticks[0];
  assert.equal(Number(lone.room.toFixed(4)), Number((1 - 31 / 365).toFixed(4)), "a lone tick has the rest of the line");
  assert.equal(beyond, 2, "a matter due after the twelve months, and one without a deadline, are not on the line");
});

test("deadlines that would be written over each other share one tick", () => {
  const passed = lineOf(story("a", "0802-10-01"), story("b", "0802-12-25"), story("c", "0802-11-15")).ticks;
  assert.equal(passed.length, 1, "every deadline already passed stands at the start, in one tick");
  assert.deepEqual([passed[0].dueAt, passed[0].at, passed[0].matters.map((matter) => matter.id)], ["0802-10-01", 0, ["a", "c", "b"]]);
  const near = lineOf(story("a", "0803-03-25"), story("b", "0803-03-30"), story("c", "0803-04-20", { title: "Senare" })).ticks;
  assert.deepEqual(near.map((tick) => tick.matters.map((matter) => matter.id)), [["a", "b"], ["c"]], "five days apart is one tick, a month apart is two");
  assert.equal(near[0].dueAt, "0803-03-25", "the tick carries the nearest of its deadlines");
  assert.ok(near.every((tick) => tick.room >= 0.03), "each of the two has room to be read");
  const mixed = lineOf(story("a", "0803-12-20"), story("b", "0803-12-25")).ticks;
  assert.deepEqual([mixed.length, mixed[0].soon], [1, false]);
  assert.equal(lineOf(story("a", "0803-01-05"), story("b", "0803-06-01")).ticks[0].soon, true);
});

test("the line follows the calendar before the era, and there is none without a game date", () => {
  const line = yearLineOf({ date: "-0044-03-15", stories: [story("ides", "-0044-06-01")] });
  assert.equal(line.to, "-0043-03-15");
  assert.deepEqual([line.months[0].month, line.months[0].year], [4, -44]);
  assert.deepEqual(line.ticks.map((tick) => tick.matters[0].id), ["ides"]);
  assert.equal(yearLineOf({ stories: [] }), null);
  assert.equal(yearLineOf(null), null);
  assert.deepEqual(yearLineOf({ date: "0802-12-25" }).ticks, []);
});

const settled = () => new Promise((resolve) => setImmediate(resolve));

test("the year turns through the panel's own entry, one turn at a time, and its record is kept", async () => {
  let release;
  const calls = [];
  const year = createCourtYear(async () => ({
    advanceCharacterYearWithModel: () => { calls.push("advance"); return new Promise((resolve) => { release = resolve; }); },
    revealLatestCharacterTurn: async () => { calls.push("reveal"); return { ok: true, events: [{ id: "e1", title: "Sist" }] }; },
  }));
  const seen = [];
  const stop = year.subscribe(() => seen.push(year.read().busy));
  const first = year.advance("karl");
  await settled();
  assert.deepEqual({ ...year.read() }, { campaign: "karl", busy: true, kind: "year", error: "", report: null });
  assert.deepEqual(year.of("papal"), { campaign: null, busy: true, kind: null, error: "", report: null }, "another campaign sees that a turn is being written, and nothing of it");
  assert.equal(year.of("karl"), year.read());
  await year.advance("karl");
  await year.reveal("karl");
  assert.deepEqual(calls, ["advance"], "a second turn while one is written does nothing");
  year.close();
  assert.equal(year.read().busy, true, "nothing closes while the year is written");
  release({ ok: true, state: { revision: 26 }, events: [{ id: "e1", title: "Ett år" }], interruption: { type: "watch", message: "Stopp." } });
  await first;
  assert.deepEqual(year.read(), { campaign: "karl", busy: false, kind: "year", error: "",
    report: { kind: "year", revision: 26, events: [{ id: "e1", title: "Ett år" }], interruption: { type: "watch", message: "Stopp." } } });
  assert.deepEqual(year.of("papal"), { campaign: null, busy: false, kind: null, error: "", report: null });
  assert.deepEqual(seen, [true, false]);
  year.close();
  assert.equal(year.read().report, null);
  await year.reveal("karl");
  assert.deepEqual(year.read().report, { kind: "last", revision: null, events: [{ id: "e1", title: "Sist" }], interruption: null });
  stop();
});

test("a refusal is the engine's sentence, and an internal error is kept from the player", async () => {
  const answers = [
    { ok: false, error: "Läs färdigt den senaste turens händelser först." },
    { ok: false, error: "fetch failed with status 500" },
  ];
  const year = createCourtYear(async () => ({
    advanceCharacterYearWithModel: async () => answers.shift(),
    revealLatestCharacterTurn: async () => { throw new Error("network error"); },
  }));
  const warn = console.warn;
  console.warn = () => {};
  try {
    await year.advance("karl");
    assert.equal(year.read().error, "Läs färdigt den senaste turens händelser först.");
    assert.equal(year.read().report, null);
    await year.advance("karl");
    assert.equal(year.read().error, "Spelet fick ingen kontakt med modellen. Inget har ändrats.", "a model year names its failure");
    await year.reveal("karl");
    assert.equal(year.read().error, "Handlingen kunde inte genomföras.");
    assert.equal(year.read().busy, false);
    year.close();
    assert.equal(year.read().error, "");
  } finally { console.warn = warn; }
  const broken = createCourtYear(async () => { throw new Error("chunk failed to load"); });
  console.warn = () => {};
  try { await broken.advance("karl"); } finally { console.warn = warn; }
  assert.equal(broken.read().error, "Modellen kunde inte skriva året. Försök igen.", "an engine that cannot be loaded is a refusal, not a crash");
});

test("the year stands along the bottom of the map and turns there", () => {
  const shell = read("./CourtShell.jsx"), line = read("./CourtYearLine.jsx"), report = read("./CourtYearReport.jsx"), store = read("./courtYear.js");
  assert.match(store, /createCourtYear\(\(\) => import\("\.\.\/\.\.\/runtime\/characterRuntime\.js"\)\)/, "the engine is loaded on demand");
  assert.match(store, /useSyncExternalStore/);
  assert.match(store, /state\.campaign === campaign \? state : \{ \.\.\.QUIET, busy: state\.busy \}/, "a turn belongs to its campaign");
  assert.match(shell, /const stale = Boolean\(year\.report\) && Number\(view\.revision\) > Number\(year\.report\.revision\);/, "a record the court has moved on from is not shown when the shell comes back");
  assert.match(shell, /querySelector\("#court-report-title"\)\?\.focus\(\)/, "a record that arrives takes focus from the button that asked for it");
  assert.match(shell, /closest\?\.\("\.court-report"\)/, "Escape closes the record focus is in");
  assert.match(line, /era: mark\.year < 0 \? "short" : undefined/, "a year before the era says so");
  assert.match(shell, /useCourtYear\(activeGameId\)/);
  assert.match(shell, /yearLineOf\(view\)/);
  assert.match(shell, /const locked = command\.busy \|\| year\.busy;/, "nothing is answered while the year is written");
  assert.match(line, /disabled=\{locked \|\| ended \|\| held\}/, "the year does not turn while it ended, is written, or a conversation's request is open");
  assert.match(line, /role="status"/);
  assert.match(line, /role="alert"/);
  assert.match(line, /error\.includes\("Läs färdigt"\)/, "the engine's request to read the last turn first has its button");
  assert.match(line, /left: `\$\{\(tick\.at \* 100\)\.toFixed\(2\)\}%`, maxWidth: `\$\{\(tick\.room \* 100\)\.toFixed\(2\)\}%`/);
  for (const text of ["Nästa år med modellen", "Bearbetar…", "Visa senaste turens händelser →", "Modellen arbetar med årets händelser", "Året som kommer"]) assert.ok(line.includes(text), text);
  for (const text of ["Årets händelser", "Händelser fram till beslutet", "Senaste turens händelser", "Tiden stannade vid ett vårdärende", "Tiden stannade vid en bevakning", "Tiden stannade vid en karaktärshändelse", "Stäng"]) assert.ok(report.includes(text), text);
  assert.match(report, /<details/, "an event's text unfolds on a press");
});

test("a court bar replaces the session pill, Exit Game and the standalone button on a desktop", () => {
  const bar = read("./CourtTopBar.jsx"), library = read("../GameUI/libraryBar.jsx"), main = read("../GameUI/main.jsx"), css = read("./courtShell.css");
  assert.match(library, /const LibraryTopBar = \(\{ inGameBar = null \} = \{\}\) => \{/);
  assert.match(library, /inGameBar\(\{ exitToMenu, top: TOP_BAR_OFFSET, left: `calc\(5rem \+ \$\{SAFE_LEFT\}\)` \}\)/);
  assert.match(main, /<LibraryTopBar inGameBar=\{hasCharacters && !isMobile \? courtBar : null\} \/>/);
  assert.match(main, /hasCharacters && !mainMenuOpen && isMobile && <button/, "a phone keeps its own button");
  assert.match(bar, /data-court-button/, "the panel's focus returns to the bar's button");
  assert.match(bar, /aria-expanded=\{courtOpen\}/);
  assert.match(bar, /onClick=\{onExit\}/);
  assert.match(bar, /data-native-text/);
  for (const text of ["Rike & familjer", "Huvudmeny", "FÖLJ RIKET", "FÖLJ FAMILJEN"]) assert.ok(bar.includes(text), text);
  assert.doesNotMatch(css, /\.court-band \{[^}]*margin-left: 11rem/, "the thread starts at the left edge");
});

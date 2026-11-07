# Historical year events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show sourced real-world events for each campaign year that ends, in a popup beside the dynamic events and in a browsable record, from a validated dataset with an audited 4,500-year coverage index.

**Architecture:** A pure module computes which calendar years a date window closes and which catalog events belong to them. The record and the popup both derive from `game.startDate`, `game.gameDate` and the bundled catalog, so nothing enters the save, the replay or a model prompt. A per-device watermark decides what the popup has already shown.

**Tech Stack:** Node test runner, React 18 (JSX), Vite dynamic import for the catalog chunk, plain JSON data, existing `server/gameDates.js` calendar.

**Spec:** `docs/development/DEVELOPMENT-BACKLOG.md` (sections "Historical events at turn end") and `docs/superpowers/specs/2026-11-05-historical-world-direction.md`.

## Global Constraints

- Research range: 3300 BC through AD 1200, 4,500 calendar years, with no year zero. Signed years: `-3300` through `1200`, reusing `HISTORICAL_START_RANGE` from `server/historicalStarts.js`.
- A normal read, validation or presentation call never chooses a branch, spends money or draws randomness. This feature draws nothing from `state.rngState`, the action stream or `state.plotRngState`, and writes nothing to `game`, `world` or `events`.
- No model call and no live research request at turn end. Replay never calls the model. Historical data never enters a model prompt.
- Missing evidence produces no popup. Do not invent an event to fill a year.
- Player text is Swedish with å, ä and ö. Code comments and docs are English. Refusals are one Swedish sentence.
- Label the material `I verklighetens historia`. Show date certainty and source details. Never present an approximate date or range as a fact tied to one precise year.
- The feature applies only to campaigns with `world.historicalScenario`. Hadara and modern saves see no change.
- Calendar arithmetic goes through `server/gameDates.js`: `shiftGameYear`, `compareGameDates`, `parseGameDate`. Never `year + 1`, never string order.
- New systems live in their own modules. Functions under about 50 lines, files under about 800 lines.
- Event text is our own Swedish summary. Copy no source text. Keep source titles, URLs and locators.

## Rulings

Ruling: a campaign reports year Y when the half-open window `[from, to)` contains 31 December of Y — it partitions years, so any chain of adjoining turns of any length reports each year exactly once, across BC/AD, with no stored state — a player who jumps six hours sees nothing until a year closes.

Ruling: a dated event's anchor is `event.startYear`, or the campaign's start year when the event began earlier and was still running — an event with a date span appears once and is never spread across years — a long period surfaces only at its start, which the card's date text explains.

Ruling: the record and the popup derive from dates, and neither enters the save — saves, replay and JSON round trips stay byte-identical — a player cannot annotate the record.

Ruling: the watermark lives in `localStorage`, follows `unseenEvents.js`, moves only forward and moves on dismissal — reading progress is per-player, and a reload before dismissal shows the unread card again — a second device shows nothing for years it never saw, and the record still has them.

Ruling: a first-seen campaign gets a watermark of `startDate` when `gameDate` equals `startDate`, otherwise `gameDate` — no backlog flood on old saves or cleared storage — those years appear only in the record.

Ruling: the popup waits for `isSimulationBusy()` to clear and for the turn's unseen events to reach zero — the player reads the campaign's year first, then the real year — the popup follows the reveal rather than sitting on screen with the first event.

Ruling: the popup lists at most 12 events, by importance then date, with `Visa alla i krönikan` when more exist — a 500-year jump stays readable — the rest stay in the record.

Ruling: the catalog holds approved events only, and an empty catalog is valid — tasks 1 to 5 can merge before any research — the first merge shows `Inga godkända händelser ännu` in the record and no popup.

Ruling: years after AD 1200 have no coverage and show no popup — the research range ends there and a campaign may run past it — John's start at `1200-12-31` reports only year 1200, so the owner asked for a better start and `2026-11-07-charlemagne-800-start.md` adds one at AD 800.

Ruling: research batch 1 waits for the owner's answer on the research pilot. The pilot is on no reachable machine or repository, and redoing it wastes work, so tasks 1 to 5 go ahead without it.

## Review Focus

1. A turn that crosses no 31 December: no popup, the watermark stays, and the next turn reports the year.
2. An undo or Intervene lowers `gameDate`: no repeat notice, and the record shrinks to the current date.
3. The player switches campaign with a popup open: it closes and the watermark moves for neither game.
4. Storage is refused or cleared: the panel runs on memory and shows no backlog after a reload.
5. The catalog chunk fails to load: the turn is unaffected, the watermark stays and the next check retries.

---

### Task 1: Year windows and event lookup

**Files:**
- Create: `server/historicalEvents.js`
- Create: `src/runtime/historicalEvents.js` (one-line re-export, like `src/runtime/historicalScenarios.js`)
- Test: `server/historicalEvents.test.js`

**Interfaces:**
- Consumes: `compareGameDates`, `parseGameDate`, `shiftGameYear`, `formatGameDate` from `server/gameDates.js`.
- Produces:
  - `yearsClosedBetween(from: string, to: string): number[]`, ascending signed years; `[]` for invalid input or `to <= from`.
  - `eventAnchorYear(event, campaignStartYear: number): number | null`.
  - `eventsForYears(catalog, years: number[], campaignStartYear: number): Array<{ year: number, events: Event[] }>`, one row per year with at least one event, each row sorted by `importance` descending and then `id`.
  - `historicalRecord(catalog, startDate: string, gameDate: string)`: `eventsForYears` over `yearsClosedBetween(startDate, gameDate)`, newest year first.
  - `dateCertaintySv(event): string`, returning `Säkert år`, `Ungefärligt datum`, `Tidsspann` or `Omtvistat datum`.
  - `MAX_NOTICE_EVENTS = 12`.

An `Event` is `{ id, titleSv, summarySv, date: { kind: 'exact'|'approximate'|'range'|'disputed', startYear, endYear, displaySv, noteSv? }, geographySv, category, importance: 1|2|3, sourceIds: string[], selectionNote, review: { status: 'approved', reviewedBy, reviewedOn } }`. `category` is one of `politics`, `war`, `migration`, `religion`, `culture`, `discovery`, `technology`, `nature`.

- [ ] **Step 1: Write the failing tests** in `server/historicalEvents.test.js`:

```js
test('a turn reports the year whose last day it contains', () => {
  assert.deepEqual(yearsClosedBetween('-3000-01-01', '-2999-01-01'), [-3000]);
  assert.deepEqual(yearsClosedBetween('1200-12-31', '1201-12-31'), [1200]);
  assert.deepEqual(yearsClosedBetween('1201-01-01', '1201-06-01'), []);
});
test('the window steps over the missing year zero', () => {
  assert.deepEqual(yearsClosedBetween('-0002-06-01', '0002-06-01'), [-2, -1, 1]);
});
test('adjoining turns report each year exactly once', () => {
  const cuts = ['-0005-03-01', '-0004-12-31', '-0002-01-01', '0001-01-01', '0001-12-31', '0003-07-07'];
  const seen = cuts.slice(1).flatMap((to, i) => yearsClosedBetween(cuts[i], to));
  assert.deepEqual(seen, yearsClosedBetween(cuts[0], cuts.at(-1)));
  assert.equal(new Set(seen).size, seen.length);
});
test('a range anchors once, at its start or at the campaign start', () => {
  const range = { date: { kind: 'range', startYear: -3100, endYear: -2686 } };
  assert.equal(eventAnchorYear(range, -3000), -3000);
  assert.equal(eventAnchorYear(range, -3200), -3100);
  assert.equal(eventAnchorYear(range, -2000), null);
});
test('two events in a year sort by importance, then id', () => { /* importance 3 before 1; equal importance by id */ });
test('an empty catalog and an uncovered year return no rows', () => { /* eventsForYears({events:[]},[1500],1200) is [] */ });
test('lookup leaves the catalog unchanged and draws no randomness', () => { /* deep-equal a clone; Math.random replaced by a throwing stub for the call */ });
```

- [ ] **Step 2: Run:** `node --test server/historicalEvents.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the Interfaces block. `yearsClosedBetween` starts at the year of `from` and walks with `shiftGameYear(year, 1)`, keeping year Y when `compareGameDates(from, dec31) <= 0` and `compareGameDates(dec31, to) < 0`. Build `dec31` with `formatGameDate({ year, month: 12, day: 31 })`.
- [ ] **Step 4: Run:** `node --test server/historicalEvents.test.js`. Expected: PASS.
- [ ] **Step 5: Commit:** `git add server/historicalEvents.js server/historicalEvents.test.js src/runtime/historicalEvents.js` then `git commit -m "Compute which historical years a turn closes"`.

### Task 2: Catalog, coverage index and audit

**Files:**
- Modify: `server/historicalEvents.js`, `server/historicalEvents.test.js`
- Create: `server/seed/historical/events/catalog.json`, `server/seed/historical/events/coverage.json`
- Create: `scripts/check-historical-events.mjs`
- Create: `docs/research/historical-events-coverage.md` (generated by the script)
- Create: `src/runtime/historicalEventCatalog.js`

**Interfaces:**
- Consumes: Task 1 exports and `HISTORICAL_START_RANGE`.
- Produces:
  - `validateEventCatalog(catalog): { ok: true } | { ok: false, errors: string[] }`.
  - `validateCoverage(coverage, catalog): { ok: true, totals } | { ok: false, errors: string[] }`, where `totals` maps each status to a year count.
  - `renderCoverageReport(coverage, catalog): string`, deterministic Markdown with no clock.
  - `loadHistoricalEventCatalog(): Promise<catalog>`, a dynamic `import()` of `catalog.json`, memoized on success and cleared on failure.

`catalog.json` starts as `{ "schemaVersion": 1, "sources": [], "events": [] }`. A source is `{ id, title, institution, url, locator, retrievedOn, originalChronology, reuseTerms }`. `coverage.json` starts as `{ "schemaVersion": 1, "ranges": [{ "startYear": -3300, "endYear": 1200, "status": "unresearched", "note": "..." }] }`. Status is one of `unresearched`, `no-secure-event`, `partial`, `reviewed`.

- [ ] **Step 1: Write the failing tests:**

```js
test('the coverage index partitions all 4,500 years', () => {
  const result = validateCoverage(fixtureCoverage, emptyCatalog);
  assert.equal(result.ok, true);
  assert.equal(Object.values(result.totals).reduce((a, b) => a + b), 4500);
});
test('a gap, an overlap or a range holding year zero alone is refused', () => { /* three cases */ });
test('an event is refused for each defect', () => { /* table: year outside the range, startYear 0, start after end, exact kind with start != end, missing source id, source without url or locator, no Swedish title, unknown category, review status other than approved, duplicate id */ });
test('an event inside a range marked no-secure-event is refused', () => { /* contradiction between catalog and coverage */ });
test('the committed catalog and coverage pass', () => { /* readFileSync both seed files through new URL */ });
test('the coverage report is stable', () => { /* two renders are identical; it names the total 4500 */ });
```

- [ ] **Step 2: Run:** `node --test server/historicalEvents.test.js`. Expected: FAIL on the new names.
- [ ] **Step 3: Implement** the validators, the seed files and `renderCoverageReport`. Count years in a range with `astronomicalYear(end) - astronomicalYear(start) + 1`. If `server/historicalEvents.js` passes 400 lines, move the validators to `server/historicalEventValidation.js`.
- [ ] **Step 4: Write** `scripts/check-historical-events.mjs`: no flag writes the report, `--check` compares committed bytes and exits non-zero on any validation error or difference, as `scripts/build-historical-scenarios.mjs --check` does.
- [ ] **Step 5: Run:** `node scripts/check-historical-events.mjs` then `node scripts/check-historical-events.mjs --check` and `node --test server/historicalEvents.test.js`. Expected: exit 0, PASS.
- [ ] **Step 6: Commit:** `git add` the files above, then `git commit -m "Validate the historical event catalog and the 4,500-year coverage index"`.

### Task 3: What the player has seen

**Files:**
- Create: `src/runtime/historicalYearSeen.js`
- Test: `src/runtime/historicalYearSeen.test.js`
- Modify: `src/Game/AI/simulationStatus.js` (add `subscribeSimulationIdle(listener)`, fired from `endSimulation` when no simulation remains)

**Interfaces:**
- Consumes: `createMemoryStorage` from `src/runtime/unseenEvents.js`; `compareGameDates`.
- Produces: `HISTORY_SEEN_KEY = "oh_history_seen_through"` and `createHistoricalYearSeen({ storage })` returning:
  - `seenThrough(gameId, { startDate, gameDate }): string`, which records the first-seen watermark.
  - `pendingWindow(gameId, { startDate, gameDate }): { from, to } | null`, `null` when `gameDate <= seenThrough`.
  - `markSeen(gameId, date): void`, forward only, keeping the 24 most recent games.

- [ ] **Step 1: Write the failing tests:** a new campaign keeps `startDate`; an old save takes `gameDate` and gives no window; a later `gameDate` gives `{ from, to }`; `markSeen` with an earlier date changes nothing; a lower `gameDate` after an undo gives `null`; two games keep separate marks; garbage in storage reads as first-seen; storage that throws on `setItem` loses nothing but the mark; the 25th game evicts the oldest.
- [ ] **Step 2: Run:** `node --test src/runtime/historicalYearSeen.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** with the import-free style and injected storage of `unseenEvents.js`, including the `resolveStorage` fallback.
- [ ] **Step 4: Run:** the same command, plus any `simulationStatus` tests. Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Remember per device which historical years the player has seen"`.

### Task 4: The popup

**Files:**
- Create: `src/Game/Characters/HistoricalYearNotice.jsx`
- Create: `src/Game/Characters/HistoricalEventCard.jsx`
- Test: `src/Game/Characters/HistoricalYearNotice.test.js` (pattern: `CharactersPanel.test.js`, `src/Game/testing/hookDriver.js`)
- Modify: `src/Game/Characters/characters.css`
- Modify: `src/Game/GameUI/main.jsx` (lazy import beside `LazyCharactersPanel`, mounted around line 563)

**Interfaces:**
- Consumes: Tasks 1 to 3; `useRuntimeState`; `unseenEvents`, `UNSEEN_EVENTS_CHANGED`; `isSimulationBusy`, `subscribeSimulationIdle`.
- Produces: default export `HistoricalYearNotice({ gameId, hidden })`; `HistoricalEventCard({ event, sources })`, reused by Task 5.

Mount with `key={activeGame?.id}`, only when `world.historicalScenario` is set, and pass `hidden={mainMenuOpen}`. Use `z-index: 12100` so the dialog sits above `.char-backdrop`. Use `role="dialog"`, `aria-modal`, focus on open and focus return on close, Escape to close, and `data-char-theme` from the same theme key as the panel.

Fixed text: heading `I verklighetens historia`, intro `Det här hände i den verkliga världen. Din kampanj kan ha tagit en annan väg.`, button `Stäng`, overflow `Visa alla i krönikan`. A card shows title, `date.displaySv`, `dateCertaintySv(event)`, `geographySv`, summary, and a `<details>` titled `Källor` listing title, institution, locator and link with `rel="noreferrer"`.

- [ ] **Step 1: Write the failing tests:** renders the label and a source link; an approximate card shows `date.displaySv` and `Ungefärligt datum` and never a bare year heading; no render while `isSimulationBusy()` or unseen events remain; no render for a window with no events, and that window moves the watermark; a reload before dismissal shows the card again; dismissal moves the watermark to `to`, and a remount shows nothing; 13 events show 12 and `Visa alla i krönikan`; a rejected catalog load renders nothing and keeps the watermark; `hidden` renders nothing; rendering performs no model call and leaves the runtime slices unchanged.
- [ ] **Step 2: Run:** `node --test src/Game/Characters/HistoricalYearNotice.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** A `check()` effect runs on `game` changes, on `UNSEEN_EVENTS_CHANGED` and on `subscribeSimulationIdle`. `Visa alla i krönikan` dispatches `window` event `oh:open-history-record`; Task 5 handles it.
- [ ] **Step 4: Run:** the same test, `CharactersPanel.test.js`, and `npx eslint src/Game/Characters/HistoricalYearNotice.jsx src/Game/Characters/HistoricalEventCard.jsx`. Expected: PASS, no new lint findings.
- [ ] **Step 5: Commit:** `git commit -m "Show the real events of a closed year after the turn"`.

### Task 5: The record in Krönikan

**Files:**
- Create: `src/Game/Characters/HistoricalRecordView.jsx`
- Modify: `src/Game/Characters/CharactersPanel.jsx` (`ChronicleView` segment control, and `oh:open-history-record`)
- Test: `src/Game/Characters/HistoricalRecordView.test.js`

**Interfaces:**
- Consumes: `historicalRecord`, `loadHistoricalEventCatalog`, `HistoricalEventCard`.
- Produces: default export `HistoricalRecordView({ startDate, gameDate })`.

Add a segment `I verklighetens historia` to `ChronicleView` for historical campaigns only. The view groups by year, newest first, with a year heading from `formatGameDateReadable`. Empty text: `Inga godkända händelser ännu för de år kampanjen har passerat.` After `gameDate` passes AD 1200, add `Forskningen sträcker sig till år 1200.`

- [ ] **Step 1: Write the failing tests:** events appear by year, newest first; BC years read correctly; an undo with a lower `gameDate` drops later years; the empty text and the AD 1200 note render; a Hadara campaign shows no segment; the `oh:open-history-record` event opens the panel on this segment.
- [ ] **Step 2: Run:** `node --test src/Game/Characters/HistoricalRecordView.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** with the smallest change to `CharactersPanel.jsx`. Put the logic in the new file.
- [ ] **Step 4: Run:** the new test and `src/Game/Characters/CharactersPanel.test.js`. Expected: PASS.
- [ ] **Step 5: Update** `src/runtime/characters/CONTRACT.md`, `docs/research/historical-scenarios.md`, `docs/development/DEVELOPMENT-BACKLOG.md` and `docs/development/CONTINUE-HERE.md` with the new state.
- [ ] **Step 6: Run** the full serial suite and the build: `node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"`, then `npm run build`. Expected: 0 fail, exit 0, and a separate chunk for `catalog.json`.
- [ ] **Step 7: Commit:** `git commit -m "Keep the real history in the chronicle"`. Whole-branch review, PR, merge on green `test`.

### Task 6: Research batch 1 (blocked on the owner's answer on the research pilot)

**Files:**
- Create: `docs/research/historical-events-method.md`
- Modify: `server/seed/historical/events/catalog.json`, `server/seed/historical/events/coverage.json`, `docs/research/historical-events-coverage.md`

Scope: `-3000` through `-2900` (the Egypt start walks forward from here), AD 800 through 900 (the Charlemagne start) and AD 1200 (the John start). If the owner hands over the research pilot, build on it and recheck each record.

- [ ] **Step 1: Write the method:** selection criteria, source order (primary evidence, then institutional and scholarly sources), how competing chronologies are recorded, when a year is `no-secure-event`, and the review gate.
- [ ] **Step 2: Research each year** and draft records. Check competing chronologies and record each locator.
- [ ] **Step 3: Check independently:** a fresh reviewer with no draft context opens every cited source and confirms each claim, date and locator. Unconfirmed records stay out of the catalog.
- [ ] **Step 4: Run:** `node scripts/check-historical-events.mjs` then `--check`. Expected: exit 0.
- [ ] **Step 5: Commit** per reviewed batch, push and merge on green `test`.

### Task 7: Browser acceptance

**Files:**
- Create: `docs/play-scripts/historical-year-events.md`
- Modify: `docs/development/CONTINUE-HERE.md`

- [ ] **Step 1: Write the script** from the backlog's acceptance evidence.
- [ ] **Step 2: Run it** on both adapters with Playwright against `node scripts/launch-dynasties.mjs`: end a turn, see the current year's sourced popup with the dynamic events, dismiss it, reload, replay, and confirm an unchanged model-call count and no second popup. Check the record, both themes and a 390 px viewport.
- [ ] **Step 3: Record** each result as observed, failed, blocked or still open. Fix defects with a failing test first.
- [ ] **Step 4: Commit,** PR, merge on green `test`.

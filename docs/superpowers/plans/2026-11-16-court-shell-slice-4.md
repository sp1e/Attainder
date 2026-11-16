# Court shell, slice 4: implementation plan

**Goal:** The year ahead stands along the bottom of the map with its deadlines, the year turns from there and its record is read there, and a court bar replaces the session pill, "Exit Game" and the standalone "Rike & familjer" button.

**Spec:** `docs/superpowers/specs/2026-11-15-court-shell-design.md`, "Slice 4: the year and the top bar".

**Architecture:** `courtShell.js` gains one pure function for the line. A small store beside the shell runs the year turn through the panel's own entries and keeps its state while the shell is not drawn. Three new components draw the line, the record and the bar. `LibraryTopBar` takes one render prop for the bar that stands in place of its in-game cluster; nothing else upstream changes.

## Global constraints

- The year turns with the panel's own entry and label. The shell never advances time any other way.
- Every label is the panel's own Swedish string where the panel has one. New Swedish text goes through `build-native-catalog` and `check-native-pack`.
- No gradients. Motion respects `prefers-reduced-motion`.
- The upstream date widget, the menu button and the map's bottom buttons keep their places; the line and the bar stay clear of them.

## Task 1: the line

**Files:** `src/Game/Characters/courtShell.js`, new `src/Game/Characters/courtYear.test.js`.

`yearLineOf(view): YearLine | null`, `YearLine = { from, to, months, ticks, beyond }`.

- `from` is `view.date`, `to` is twelve months later (`addGameMonths`); `null` when the view has no game date.
- `months`: the first day of each month after `from` up to `to`, as `{ at, month, year }`, `at` being the share of the span's days (0 to 1).
- `ticks`: the open matters with a deadline up to `to`, grouped by day, the nearest first: `{ dueAt, at, soon, matters: Array<{ id, title }> }`. `soon` is a deadline within 92 days. A deadline already passed stands at 0.
- `beyond`: how many open matters have a deadline after `to` or none.

Tests: a midwinter start (twelve marks, January carries the new year), two matters on one day, a deadline in three months is soon, a passed deadline, a matter a year and a day ahead, an undated matter, a BC date, a view without a date.

## Task 2: the year turn

**Files:** new `src/Game/Characters/courtYear.js`.

`createCourtYear(load): { read, subscribe, advance(campaign), reveal(campaign), close() }`, `load` resolving to the runtime's `{ advanceCharacterYearWithModel, revealLatestCharacterTurn }`. The module exports one instance on the real runtime (imported on demand) and `useCourtYear(campaign)`.

- State: `{ campaign, busy, kind, error, report }`, `kind` being `"year"` or `"last"`, `report = { kind, events, interruption }`.
- One run at a time: a second call while busy does nothing.
- A refusal's text goes through `playerText`, with the panel's fallbacks ("Modellen kunde inte skriva året. Försök igen." for the year, "Handlingen kunde inte genomföras." for the last turn).
- `close()` drops the record and the error; it does nothing while busy.
- `useCourtYear(campaign)` gives a quiet state for any other campaign.

Tests: the busy lock, a written year's record, a refusal, an English error kept from the player, a thrown error, `close`, the campaign's scope.

## Task 3: the line, the record and the lock

**Files:** new `src/Game/Characters/CourtYearLine.jsx`, `CourtYearReport.jsx`; `CourtShell.jsx`, `courtShell.css`.

- `CourtYearLine({ line, year, locked, ended, updates, onOpenMatter, onAdvance, onReveal, onDismiss })`: the months, the ticks (buttons), "Visa senaste turens händelser →", "Nästa år med modellen" ("Bearbetar…" while busy), the working notice (`role="status"`) and a refusal (`role="alert"`, with the reveal button when the engine asks the player to read the last turn first).
- `CourtYearReport({ report, updates, onClose })`: the heading with the count, the reason time stopped, the events (date, title, text on a press), "Stäng".
- `CourtShell`: `useCourtYear(activeGameId)`; choices and actions are locked while a command or the year is written; a tick opens its first matter.
- The line stands between the map's bottom buttons; the record stands in the row between the list and the card.

## Task 4: the court bar

**Files:** new `src/Game/Characters/CourtTopBar.jsx`; `src/Game/GameUI/libraryBar.jsx`, `src/Game/GameUI/main.jsx`, `courtShell.css`.

- `LibraryTopBar({ inGameBar })`: when given, `inGameBar({ exitToMenu, top, left })` is drawn in place of the desktop in-game cluster.
- `CourtTopBar({ top, left, courtOpen, onOpenCourt, onExit })`: the name, the date, the mode, "Rike & familjer" (`data-court-button`, `aria-expanded`) and "Huvudmeny". The buttons are there before the court is read.
- `main.jsx` hands the bar in for a campaign with a court on a desktop and keeps its own "Rike & familjer" button for a phone.
- The band starts at the left edge.

## Task 5: evidence

Targeted tests, the text checks, eslint, the build, the full suite alone, and a browser run on copies of the Charlemagne campaign: the line's ticks against the list's deadlines; a tick opens its matter; "Visa senaste turens händelser" shows the saved turn; "Nästa år med modellen" without a connected model shows the refusal and leaves the date; after a year advanced in the engine the line starts a year later; the bar's name, date, mode and both buttons; focus after the panel closes; 2560 by 1440 and 1600 by 900; English.

## Review focus

- The shell is not drawn when the year's result arrives; the campaign changes while the model writes.
- A command pressed while the year is written, and the year pressed while a command is written.
- Ticks that would overlap (two deadlines days apart), a tick at the line's end, a long title.
- The bar under the date widget in a narrow window; the bar before the court is read.
- Focus: after the record closes, after a tick's press, and the panel's return to `[data-court-button]`.

## Review outcome

An independent review of the first build found no turn started twice or left busy for good, and these, fixed in the same change:

- A turn being written in one campaign silently swallowed "Nästa år med modellen" in another. Every campaign now sees that a turn is being written, and nothing else of it.
- A record left open was shown again after the player had gone on in the panel. It carries the court's revision now, and the shell drops it when it comes back to a court that has moved on.
- Deadlines already passed stood on top of each other at the line's start, and deadlines days apart had no room for a label. Deadlines too near each other to be read apart now share one tick.
- A record that arrived moved no focus, and its place for the working notice was drawn with its text, which a screen reader may pass over. The record takes focus from the button that asked for it, the notice's place is always there, and Escape closes the record.
- A January before the era was written without its era.

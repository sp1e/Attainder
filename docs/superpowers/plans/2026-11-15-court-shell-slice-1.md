# Court shell, slice 1: implementation plan

**Goal:** The court stands over the map: a thread of medallions, the list of what needs the player and six figures, each a way into the court panel.

**Spec:** `docs/superpowers/specs/2026-11-15-court-shell-design.md`, "Slice 1: the court over the map".

**Architecture:** A pure module turns the court's presentation into the thread, the matters and the figures. A hook reads the presentation once per campaign and revision and is shared with the seat medallions. A lazy component draws the three pieces over the map in the draft's look. The panel learns to open at a tab and a person.

## Global constraints

- A campaign without a court, a phone, an open menu and an open panel draw no shell.
- The rules, the engine's state and the prompts do not change.
- Swedish source text, English through the phrase book: six new strings, each in `public/lang/attainder/catalog-sv.json` and `en.json`; `build-native-catalog --check` and `check-native-pack` pass.
- A name in an accessible label is read with `readNative(text, updates)` (the React Compiler keeps a call's result until an argument changes).
- `oh:open-characters` without a detail opens the panel as before.

## Task 1: the court's reader

**Files:** create `src/runtime/useCourtView.js`; `src/Game/Map/SeatRulers.jsx` uses it; `src/Game/Map/seatRulers.test.js` follows the move.

`useCourtView(activeGameId): { hasCourt, view }`. The read of one campaign and revision is shared between callers. It waits while `world.characterTransaction` is set.

## Task 2: the shell's content

**Files:** create `src/Game/Characters/courtShell.js`, `courtShell.test.js`.

- `threadOf(view): { house: Member[], others: Member[] }`, `Member = { person, role, heir, ruler, held }`.
- `mattersOf(view): Array<{ id, title, dueAt, people: person[] }>`: stories whose status is `open`, `pending` or `active`, by `dueAt`.
- `flagsOf(matters): Map<personId, number>`.
- `figuresOf(view): Array<{ key, label, value, unit?, negative? }>` for `treasury`, `revenue`, `orders`, `legitimacy`, `prestige`, `readiness`; the labels are the panel's Swedish strings.

Tests: the order (ruler, candidates, the rest by age, then other houses); the dead left out; the roles; family mode; matters sorted and their people; counts; the six figures and a negative revenue; a view without the parts gives empty results.

## Task 3: the panel opens at a place

**Files:** `src/Game/GameUI/main.jsx`, `src/Game/Characters/CharactersPanel.jsx`.

`main.jsx` keeps `{ seq, tab, personId }` from the event's detail and passes it as `request`. The panel applies a new `seq`: a known tab is selected, a person is selected.

## Task 4: the shell

**Files:** create `src/Game/Characters/CourtShell.jsx`, `courtShell.css`; `main.jsx` mounts it lazily; the two language files.

`CourtShell({ topOffset })` draws `nav.court-thread`, `dl.court-figures` and `aside.court-needs`. A medallion's picture is `medallionOf` of the seat medallions.

## Task 5: evidence

Targeted tests, the text checks, the build, the full suite alone, and the browser run of the spec.

## Review focus

- The thread against the panel's own succession list for the same campaign.
- A matter whose actor or target is not at court: listed, with the faces it has.
- English mode: no Swedish left in the shell, names included.
- A width under 1,500 pixels: the thread scrolls, nothing covers the date widget.
- The panel opened from a medallion, closed, and opened from the button: the button opens it where it was.

## Review outcome

An independent review of the first build found these, fixed in the same change:

- What a player sees of the court leaves out the effects of a turn's events he has not read. Reading them does not move the court's revision, so the shell kept the court of before the turn. The reader now reads again when the unseen events change.
- A place asked for in one campaign was opened again in the next: the request outlived the campaign and the new panel had not seen it. A request now belongs to the campaign it was made in.
- In realm mode the thread took the campaign's first family for the ruling house. After a change of dynasty it would have shown the deposed house. The house is now the ruler's.
- The panel returned focus to the medallion that opened it, which is gone while the panel is open. Focus now goes to the "Rike & familjer" button.
- A count had no name for a screen reader, the thread cut its focus rings, the role text was 9 pixels, the six figures were six buttons to one place, a matter without a deadline came first, and the shell stayed under an open bottom panel.

The first full run also failed two house rules: no surface of the interface is a gradient, and the number of catalog entries the Swedish detector does not recognise is pinned (three of the new words are among them).

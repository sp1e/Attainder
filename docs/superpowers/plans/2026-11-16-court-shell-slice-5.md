# Court shell, slice 5: implementation plan

**Goal:** The left panel shows six areas of the court as lists over the map, and the shell takes the accent of the campaign's start.

**Spec:** `docs/superpowers/specs/2026-11-15-court-shell-design.md`, "Slice 5: the areas and the period accent".

**Architecture:** `courtShell.js` gains one pure function per area and one for the accent; each reads the court's presentation and nothing else. One new file draws the tabs and the five new lists. `CourtShell.jsx` keeps which area is shown, in the record it already keeps for the selection. The accent is two custom properties chosen by an attribute on the shell and on the court bar.

## Global constraints

- An area says what the panel's tab says of the same thing, or less. Its labels are the panel's own Swedish strings where the panel has them.
- An area does not act in this slice: a press selects a person, unfolds a text or opens the panel.
- No gradients. The accent reaches the two heads, the rule under them and the selection ring, and nothing else.
- New Swedish text goes through `build-native-catalog` and `check-native-pack`.

## Task 1: what the areas hold

**Files:** `src/Game/Characters/courtShell.js`, new `src/Game/Characters/courtAreas.test.js`.

- `AREAS`: `[{ key, tab }]` in the order needs, people, houses, seats, intrigue, chronicle; `tab` is the panel's tab for the area (`decisions`, `people`, `families`, `offices`, `intrigue`, `chronicle`).
- `peopleOf(view): Array<{ person, role, self }>`: the thread's members, the house first; `self` marks the player's representative.
- `housesOf(view): Array<{ id, name, headId, headName, support, treasury, influence, own, exiled }>`: by support, the strongest first, a house without a number last; `headId` only for a head who is alive at court; `headName` is empty for a house without a head; `own` marks the player's house.
- `seatsOf(view): { line, offices }`: `line` is the lawful heir and the candidates after, alive, at most five, without the ruler, as `{ id, name, heir }`; `offices` are `{ id, name, holderId, holderName }` with the ruler's office first, `holderId` and `holderName` empty for a vacant office.
- `intrigueOf(view): { schemes, prisoners, hooks, secrets, rumors, empty }`: each list under the presentation's own field names (`actionLabel`, `targetNames`, `dueAt`; `name`, `familyName`, `since`, `ransom`, `personId`; `targetName`, `targetId`, `strengthLabel`; `typeLabel`, `subjectName`, `subjectId`, `evidenceLabel`, `exposed`; `topicLabel`, `subjectName`, `date`, `reliability`); `empty` when all five are.
- `chronicleOf(view): Array<{ year, entries }>`: the log, the latest first, at most 60 entries, under their years; an entry is `{ id, date, title, description, type }`.
- `epochOf(view): "carolingian" | "egypt" | "angevin" | "aztec"` by the start's `historicalOrigin.contentId` (`egypt-3000bc`, `john-1200`, `world-1500`); every other start is `carolingian`.

Tests: each bullet, with a dead head, a house without support, a vacant office, a dead candidate, more than five candidates, an empty intrigue, a log over two years and over the cap, objects in place of arrays, a view without its parts.

## Task 2: the areas

**Files:** new `src/Game/Characters/CourtAreas.jsx`; `CourtShell.jsx`, `courtShell.css`.

- `CourtAreaTabs({ area, count, onArea })`: six buttons with `aria-pressed`, the panel's names, the count of open matters on "Kräver dig".
- `PeopleArea`, `HousesArea`, `SeatsArea`, `IntrigueArea`, `ChronicleArea`: the lists. A person's row and name are buttons that select (`onSelect(id)`); the selected person's row carries `aria-pressed`.
- `CourtShell` keeps `area` in the remembered record. The list of matters is drawn for `needs`; the head's title is the area's name. `openMatter` (a tick) leads to `needs`. Under every area one button opens the panel at the area's tab.
- The left panel is one width for every area and wider only while a matter is open.

## Task 3: the period accent

**Files:** `CourtShell.jsx`, `courtShell.css`.

- `data-court-epoch={epochOf(view)}` on the shell's root.
- `--court-accent` and `--court-accent-2` on the shell: `#5a2449` / `#7c3765`; `[data-court-epoch="egypt"]` `#0f5a63` / `#1b7f86`; `angevin` `#7a1e25` / `#a2303a`; `aztec` `#0d6b62` / `#159182` (DESIGN.md).
- The heads of the list, the record and the card use `--court-accent` with a 1px `--court-accent-2` rule beneath; the selected medallion's ring is `--court-accent-2`.

## Task 4: evidence

Targeted tests, the text checks, eslint, the build, the full suite alone, and a browser run on a copy of the Charlemagne campaign: each area's rows against the panel's tab; a press on a person's row opens the card; the area is there again after a visit to the panel; a tick leads back to "Kräver dig"; the accent's value for the Charlemagne start and, with the attribute set by hand, the three others; 2560 by 1440 and 1600 by 900; English.

## Review focus

- A person selected from an area who then leaves the court; a head or an office holder who is not at court.
- An area with nothing in it; the chronicle of a long campaign.
- Keyboard: the tabs' pressed state, focus after a tab's press, rows as buttons.
- The left panel's height with the longest area at 1600 by 900.
- Text that the English book does not have (a sentence built in a list).

## Review outcome

An independent review of the first build found no crash in the browser run's data and no list shown for the wrong area, and these, fixed in the same change:

- The chronicle put entries without a date first, where they took the latest entries' places under the cap. They come last now, under no year, and an empty date falls back to the day the entry was written.
- An entry of the intrigue that was nothing made the whole shell fail. Such an entry, and one without an id, is left out.
- Escape closed a matter that another area hid, and left the card. A matter is open to the player only while the matters are shown.
- A tick pressed from another area opened its matter and left focus on the tick. The matter's row takes focus when it is drawn.
- A head or a holder at court whom the house or the office did not name was written as vacant. The court names him.
- A name in a list closed the card of the person it named when the card was open. A name opens and never closes.
- The count on "Kräver dig" ran into the name for a screen reader; an answer's notice could stand over another area; the record's head takes the accent too, and ruling 36 says so now.

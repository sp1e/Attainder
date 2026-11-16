# Court shell, slice 6: implementation plan

**Goal:** On a desktop, in a campaign with a court, the panel no longer covers the map: it stands docked as the shell's left column, in the shell's look, with every view it has.

**Spec:** `docs/superpowers/specs/2026-11-15-court-shell-design.md`, "Slice 6: the modal goes".

**Architecture:** `CharactersPanel` takes one prop, `docked`. It changes the panel's outer classes, its role, its keyboard handling and what its strip repeats; no view inside changes. `characters.css` measures its two breakpoints on the panel (container queries) and gains the docked placement and the court theme. `main.jsx` keeps the shell drawn while the panel is docked; `CourtShell` gives up its left list for the panel and publishes where its row begins.

## Global constraints

- A phone, and a campaign without a court, keep the modal exactly as it is.
- No view of the panel is rewritten in this slice; the panel's tests stay green unchanged.
- No gradients. The docked panel's colours are the shell's tokens.

## Task 1: the panel docks

**Files:** `src/Game/Characters/CharactersPanel.jsx`, `characters.css`, new `src/Game/Characters/courtDock.test.js`.

- `CharactersPanel({ ..., docked = false })`.
- Outer element: `char-backdrop char-backdrop--docked` and `data-char-theme="court"` when docked. The section is `role="region"` without `aria-modal` when docked, `role="dialog"` with `aria-modal="true"` otherwise.
- Keyboard when docked: Tab is not trapped; the window's Escape closes the panel only from the page itself (`document.body`); the effect that pulls focus back into the panel does not run.
- The header's theme buttons, and the strip's mode, name, date and "Nästa år med modellen", are not drawn when docked.
- `characters.css`:
  - `.char-backdrop` is a container (`container: char / inline-size`). The rules of `@media (max-width: 950px)` and `(max-width: 680px)` move to `@container char (max-width: 930px)` and `(max-width: 680px)`; only the backdrop's own padding stays in the media queries (a container cannot style itself).
  - `.char-backdrop--docked`: fixed at `left: 0.5rem`, `top: var(--court-row-top, 13.6rem)`, `bottom: 4.5rem`, `width: min(46rem, calc(100vw - 23.5rem))`, `z-index: 9998`, no padding, no ground, no blur.
  - `[data-char-theme="court"]`: the panel's variables from the shell's tokens (`#14100c`, `#1f1913`, `#efe6d2`, `#c4b79c`, `#4a3f31`, `#d4ac3a`, `#e0573a`, `#58a58c`), `color-scheme: dark`, EB Garamond.

## Task 2: the shell beside the panel

**Files:** `src/Game/GameUI/main.jsx`, `src/Game/Characters/CourtShell.jsx`, `courtShell.css`.

- `main.jsx`: the shell is drawn whether or not the panel is open, and gets `panelOpen={isCharactersOpen}`; the panel gets `docked={hasCharacters && !isMobile}`.
- `CourtShell({ ..., panelOpen = false })`: the left list is not drawn while the panel is open; the row leaves the panel's width free (`court-row--docked`), so the record and the card stand to its right.
- `CourtShell` publishes the top of its row as `--court-row-top` on the document's root (a `ResizeObserver` on the band, and the window's resize), and removes it when it goes.
- The shell's Escape leaves a key pressed inside the panel to the panel.

## Task 3: evidence

Targeted tests, the panel's own tests unchanged, eslint, the build, the full suite alone, and a browser run on a copy of the Charlemagne campaign: the docked panel's place against the band and the year line; the map receives a drag beside it; each tab at 46 rem; an answer from the panel's decisions moves the shell's figures; a card selected while the panel is open; "Samtala" from the card opens the conversation in the dock; Escape inside and outside; the year line beside the dock; 2560 by 1440 and 1600 by 900; a phone's width keeps the modal.

## Review focus

- A view of the panel that breaks at 46 rem (a grid that does not collapse, a table that overflows).
- Two places that can send a command at once (the dock and the card), and the year turning while a conversation's confirmation is open.
- Focus: opening, closing, Tab out of the dock and back, Escape in each place.
- The dock under or over the advisor's drawer, the date widget's dropdown, a bottom panel.
- A phone and a campaign without a court: nothing changed.

## Review outcome

An independent review of the first build found the keyboard handling, the roles and the container queries sound, and these, fixed in the same change:

- The dock stayed up under the main menu and beside a bottom panel, where the shell it stands in is not drawn. It is drawn only with the shell, and leaving the game closes the panel.
- A turn's record left open in the shell stayed "the latest" while matters were answered in the dock. It is dropped when the court moves on with the panel open.
- Escape from nowhere on the page closed the card and the dock at once, or one of them by chance. The shell hands the key out: its own things first, the dock last.
- The year could turn from the year line while a conversation's request stood open in the dock, leaving its odds stale. The request holds the year, as it held the panel's own button.
- A press on the dock's box outside the panel's rounded corners closed the panel and kept the press from the map. The dock's box takes no presses.

Known and left: the two breakpoints, measured on the panel, differ from the old window widths by the backdrop's padding in two ranges (a window 951 to 966 pixels wide takes the compact layout, one 681 to 700 pixels wide the phone layout inside a 10 pixel gutter).

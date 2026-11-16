# Court shell, slice 7: implementation plan

**Goal:** In a campaign with a court, on a desktop, the map's own controls stand on the shell's ground.

**Spec:** `docs/superpowers/specs/2026-11-15-court-shell-design.md`, "Slice 7: the map's own controls take the shell's ground".

**Architecture:** The upstream controls read their surfaces from the `--oh-hud-*` custom properties (`src/styles.css`). The court bar sets one attribute on the document's root while it stands; `courtShell.css` gives the properties the shell's values under that attribute. No upstream component changes.

## Global constraints

- No upstream file is edited.
- The main menu, the library and a phone keep the upstream look: the attribute is there only while the court bar is.
- No gradients.

## Task 1: the ground

**Files:** `src/Game/Characters/CourtTopBar.jsx`, `src/Game/Characters/courtShell.css`, new `src/Game/Characters/courtHud.test.js`.

- `CourtTopBar` sets `data-court-hud` on `document.documentElement` in an effect and removes it in the effect's cleanup.
- `:root[data-court-hud]` in `courtShell.css` redefines the properties the controls read for their surfaces, `--oh-hud-bg`, `--oh-hud-bg-strong`, `--oh-hud-border`, `--oh-hud-shadow` and `--oh-hud-shadow-soft`, with the shell's tokens (`#14100c`, `#4a3f31`) and a flat shadow.

Tests: the effect and its cleanup; every redefined property is one `src/styles.css` defines (a renamed upstream property is caught); the values; no gradient.

## Task 2: evidence

Targeted tests, eslint, the build, the full suite alone, and a browser run on a copy of the Charlemagne campaign: the computed ground and border of the menu button, the date widget, the search button and the advisor's button before and after; the date widget's two panels open on the shell's ground and stay readable; the main menu opened from the bar is in the upstream look; 2560 by 1440.

## Review focus

- An upstream surface that becomes unreadable on the ink ground (dark text written for glass, a blue link).
- The attribute left behind after the bar has gone (a campaign without a court opened next, the main menu).
- An upstream property this slice does not redefine and should, or redefines and should not.

## Review outcome

An independent review of the first build found the attribute's lifecycle and the rule's weight sound, and these, settled in the same change:

- The first build also switched the glass blur off. Two controls (the menu button, the advisor's buttons) keep a grey ground of their own in their code and were then a bare half-transparent grey over the map. The blur stays.
- Seven of the properties the first build redefined (the text colours, the amber, the soft ground and the strong border) are read by nothing: every label is a literal colour in the controls' code. They are not redefined, ruling 43 no longer promises vellum text, and a test holds every redefined property to one a control reads.
- The same properties are read by the settings dialog, the statistics, the popups and the chat, which take the shell's rule and shadow too. Ruling 46 says so.

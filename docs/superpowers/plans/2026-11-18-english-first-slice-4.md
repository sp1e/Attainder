# English First, Slice 4: The Walk Through English Mode. Record and Plan

**Goal:** An English install shows no Swedish text on the screens a player meets, checked by looking.

**Spec:** `docs/superpowers/specs/2026-11-18-english-first-design.md` (ruling 4).

## The walk

Run on 18 November 2026 with Playwright Chromium against `node server/server.js`, the production build of `main` after slices 1 and 2, 2560 by 1440, a fresh profile and nothing stored (`ui_language` null, `<html lang="en">`). A script collected every visible text node, and every `aria-label`, `title` and `placeholder`, that has a Swedish letter (å, ä, ö) or one of about fifty common Swedish words; text under `data-no-translate` is left out (a model's own words, a language's own name).

| Screen | Data | Visited | Swedish found |
|---|---|---|---|
| First screen, consent question | empty data directory | 1 | 0 |
| Start card | empty data directory | each of the 17 start rows, with "Sources and uncertainty" and the seed opened | 0 |
| Court shell over the map | the Charlemagne test campaign at 25 December AD 806 | thread, figures, year line, the six areas, the ruler's card, the last year's record | 1 |
| Docked panel | the same campaign | its 7 tabs | 0 beyond the one above |
| Map | the same campaign | city labels and place search (slice 2) | 0 |

The one finding: the title of a place chip under an event, `Show Furstendömet Benevento on the map` (`src/Game/GameUI/time.jsx`, `LinkPill`). The chip's text passes the page translator; its title is an English sentence around a Swedish name, which the translator cannot match.

## Not walked

- A campaign in each of the other three starts, and family mode.
- A conversation, an envoy, a refusal, a duel and a ransom (walked in English on 13 November, PRs #210 to #219).
- The game menu's panels (Options, Tools, Help), the Events and Timeline panels beyond the last year's record, the cheats.
- The help pages in a browser (slice 3 changed their rule; its test runs the page's script against a stand-in).
- The phone layout, the web adapter and Android.
- Text the model writes: it is written in the player's language at the time and is not translated afterwards.

The detector does not see a Swedish sentence without å, ä, ö and without one of its words; `src/runtime/swedishText.test.js` holds the fuller detector the translator uses.

## Task 1: The chip's title

**Files:**
- Modify: `src/Game/GameUI/time.jsx` (`LinkPill`)
- Test: `src/Game/GameUI/eventLinkTitle.test.js` (new, a source test: `time.jsx` cannot be loaded under bare node)

- [ ] Test: the title is built from `readNative(link.label, updates)` with `updates` from `useTranslatorUpdates()`.
- [ ] `LinkPill` becomes a function body with the hook; the chip's markup is unchanged.
- [ ] eslint, `npm run build`, the full suite; browser: the title reads `Show Principality of Benevento on the map`.

# English First, Slice 3: The Help Pages. Implementation Plan

**Goal:** A help page opens in English when no language is stored, with script and without.

**Architecture:** The help pages hold both languages in one file; `<html data-help-lang>` picks the one shown. A script in `<head>` sets it from `wiki_language`, then `ui_language` (`decideHelpLanguage` in `scripts/wiki/helpCatalog.mjs`, whose source text is pasted into every page). The static markup carries a default for a reader without script. Both defaults were Swedish, the game's first language until slice 1.

**Spec:** `docs/superpowers/specs/2026-11-18-english-first-design.md` (ruling 7). Found by the review of slice 1.

## Global Constraints

- A stored choice is kept: `wiki_language` wins, then `ui_language`; `sv` reads Swedish.
- The markup keeps its order (Swedish block first); only the default changes.
- The committed pages under `public/wiki/` are rebuilt with `node scripts/build-wiki.mjs`, never edited by hand.

## Review Focus

- Nothing stored: English. `ui_language = sv`: Swedish. `wiki_language = sv` over `ui_language = en`: Swedish.
- Blocked storage: English, as the game reads there.
- A value neither key ever holds (`de`): English.
- Without script: `<html lang="en" data-help-lang="en">`, the English title, the English search placeholder, `English` pressed in the switch.
- The client script's own reading of the attribute falls to English, not Swedish, for a value it does not know.

## Task 1: The rule and the static default

**Files:**
- Modify: `scripts/wiki/helpCatalog.mjs` (`decideHelpLanguage`, new `HELP_DEFAULT_LANGUAGE = "en"`), `scripts/wiki/clientScript.mjs` (`current()`), `scripts/build-wiki.mjs` (the static title, share title, description, pressed button, search placeholder and label, `<html>` attributes)
- Test: `src/runtime/wikiHelp.test.js`
- Rebuild: `public/wiki/**`

- [ ] Tests first: the decisions above; the head script against a stand-in page; the committed page starts `<html lang="en" data-help-lang="en"` with the English title and `English` pressed.
- [ ] Run `node --test src/runtime/wikiHelp.test.js`: three tests fail.
- [ ] Change the rule and the defaults; `node scripts/build-wiki.mjs`.
- [ ] `node scripts/build-wiki.mjs --check`, `node scripts/check-wiki-freshness.mjs`, the test file, the full suite.

## Task 2: The account

- [ ] `docs/wiki.md` ("Which language shows") and the design (ruling 7).

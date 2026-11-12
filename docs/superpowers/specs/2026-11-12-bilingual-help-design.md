# The help pages in Swedish and English

Date: 12 November 2026. Slice 5 of `2026-11-11-bilingual-runtime-design.md`. Owner mandate: continue without pause and decide by rulings.

## Problem

The game's help is a static wiki. `scripts/build-wiki.mjs` renders the upstream English markdown under `wiki/` into `public/wiki/<slug>/index.html`, and the output is committed. The help adapted to the current historical game exists as data: `public/lang/attainder/help/` holds 32 pages, the navigation and the shell text in Swedish and English (398 reviewed pairs, schema in its `README.md`). The generator does not read it, so the player gets the upstream English help, which describes panels a dynasty campaign does not have, in one language.

## Design

- **One page, both languages.** For each page the catalog has (matched by its route, `/wiki/<slug>/`), the generator renders the catalog's title, description and sections once in Swedish and once in English into the same `index.html`. Each rendering sits in an element with `data-help-lang="sv"` or `"en"` and the matching `lang` attribute, and the stylesheet hides the one that is not chosen. Routes, section ids and anchors are the same in both languages. A page the catalog lacks keeps its upstream markdown and is marked `lang="en"`.
- **The language follows Options.** A short inline script in `<head>` reads `localStorage.wiki_language`, then `localStorage.ui_language`: `en` gives English, anything else Swedish, which is the game's first-language rule (`src/runtime/i18n.js`). It sets `data-help-lang` and `lang` on `<html>` before the first paint. Without script the page reads Swedish.
- **A switch on the page.** Two buttons, labelled from `shell.json`, change the language without a reload, set the document title and store `wiki_language`. The game's own choice is not changed from the wiki.
- **Shell and navigation.** Sidebar sections come from `navigation.json`, page labels from each page's `nav`, shared controls and accessible labels from `shell.json`. The upstream legal notice in `shell.json` and the Open Historia attribution stay on every page.
- **Search.** `public/wiki/search-index.json` carries one entry per page and language (`lang`), and the search box reads the entries of the chosen language. A page without a catalog entry is listed under both.
- **A check.** `node scripts/build-wiki.mjs --check` exits non-zero when the committed `public/wiki/` differs from a fresh build, and a test under `src/runtime/` runs it, so an edit to the catalog cannot leave stale pages.

## Rulings

- **Both languages in one file, not two routes.** A link from the game, a bookmark and the upstream redirects keep working, and the Options choice needs no server. Cost: each page is about twice as large; a search engine reads both languages on one URL.
- **Swedish without script.** It is the game's first language. Cost: a reader without script who wants English sees Swedish.
- **The upstream markdown under `wiki/` stays** as the record of the original help and as the source for pages the catalog lacks. Cost: two sources to keep apart; the generator names which one each page uses.

## Non-goals

New help text. Screenshots in Swedish. A third language. Changing the public site's analytics or structured data beyond the language attribute.

## Acceptance

- `node scripts/build-wiki.mjs --check` exits 0.
- Tests: every page of the catalog's manifest is rendered with both languages and its section ids; the search index has both languages for each such page; the language script picks English for `ui_language = en`, Swedish for an unset or other value, and `wiki_language` wins over both.
- Browser: a help page opened from a game set to English reads English, the switch turns it Swedish without a reload, search finds a Swedish word in Swedish and an English word in English, and the legal notice is present in both.

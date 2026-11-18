# English First, Slice 1: The First Language. Implementation Plan

**Goal:** A device that has stored no language reads English; Swedish is a choice.

**Architecture:** One rule in `src/runtime/i18n.js`. `getStoredLanguage()` returns the stored code, else `INITIAL_LANGUAGE` (`en`) on a device with storage, else `SOURCE_LANGUAGE` (`sv`). Nothing else reads the first language.

**Spec:** `docs/superpowers/specs/2026-11-18-english-first-design.md` (rulings 1, 2, 5).

## Global Constraints

- The source text stays Swedish; no sentence of the court is rewritten.
- A stored choice is kept, on the device and on the server.
- Under bare node (no `localStorage`) the source language is read, so the engine's tests and the build's tools see the text they were written against.

## Review Focus

- Storage that exists and throws (a private window): reads English on every boot, never reloads.
- A server with `sv` and a device with nothing: one reload into Swedish, then none.
- A server with `en` and a device with nothing: no reload, nothing stored.
- A test that installs `globalThis.localStorage` and assumed Swedish with nothing stored.
- Node with a built-in `localStorage` global: the first test asserts there is none on the versions CI runs (22 and 24).

## Task 1: The rule

**Files:**
- Modify: `src/runtime/i18n.js`
- Test: `src/runtime/i18nFirstLanguage.test.js`

**Interfaces:**
- Produces: `INITIAL_LANGUAGE = "en"`, `SOURCE_LANGUAGE = "sv"`, `getStoredLanguage(): string`.

- [ ] Rewrite the tests: no storage reads `sv`; an empty device reads `en`; blocked storage reads `en`; a blank stored value reads `en`; a server with `sv` moves an empty device to Swedish once; a server with `en` changes nothing; the readers (`languageDirective`, `resolveChatLanguage`, `hasShippedPack`) follow `sv` stored, nothing stored and `en` stored.
- [ ] Run `node --test src/runtime/i18nFirstLanguage.test.js`: the new tests fail.
- [ ] Change the two constants and the fallback in `getStoredLanguage`.
- [ ] Run the seven test files that install `globalThis.localStorage`, then the full suite alone.

## Task 1b: The language on the first screen (ruling 6)

**Files:**
- Modify: `src/Game/DynastyStartCard.jsx`, `src/Game/dynastyStart.css`
- Test: `src/Game/DynastyStartCard.test.js`

- [ ] Test: with `getStoredLanguage() === 'en'` the heading holds a button `Svenska` (`lang="sv"`, `data-no-translate`) before the theme switch; a press calls `setStoredLanguage('sv')`, logs the change and reloads once; with `sv` stored the button reads `English`; with any other language it reads `Svenska`.
- [ ] The button takes its name from `LANGUAGES[].native`, so no new literal enters the native catalog.

## Task 2: The repository's account

**Files:**
- Modify: `README.md`, `docs/i18n.md` ("The first language"), `docs/development/CONTINUE-HERE.md` ("Swedish and English"), `docs/superpowers/specs/2026-11-11-bilingual-runtime-design.md` (a note that its first-language rule is reversed).

- [ ] Each names English as the first language and Swedish as the choice.

## Task 3: Checks

- [ ] `node scripts/i18n/build-native-catalog.mjs --check`, `node scripts/i18n/check-native-pack.mjs --check`, `node scripts/i18n/build-package-catalog.mjs --check`, `node scripts/i18n/sweep-engine-text.mjs --check`.
- [ ] `npm run build`, then `npm test`.
- [ ] Browser, production build, a fresh data directory and a fresh profile: the first screen reads English; Options shows English chosen; choosing Swedish stores `sv` and the page reads Swedish after the reload.

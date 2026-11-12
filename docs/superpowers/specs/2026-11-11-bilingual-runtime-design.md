# Swedish and English in the running game

Date: 11 November 2026. Owner requirement of 8 November 2026: the player chooses Swedish or English in Options, and all game text follows that choice (`docs/development/DEVELOPMENT-BACKLOG.md`, "Swedish and English throughout the game"). Owner mandate: continue without pause and decide by rulings. Text contract: `docs/research/world-cultures/bilingual-game-text.md`.

## Problem

The game has two layers of text. The upstream interface is written in English, and `src/runtime/translator.js` swaps it for the player's language at display time from `public/lang/<code>.json`. The character system is written in Swedish: 2,687 literals in 100 source files (measured with Babel on main `9c07d8e5`), 1,836 of them in `server/characters/`. The engine stores finished Swedish sentences in saves (`state.log`, `state.stories`, `state.memories`), and the historical packages and the event catalog hold Swedish display fields.

A player who picks Swedish reads Swedish menus and a Swedish court. A player who picks English reads English menus and a Swedish court, because:

- `startTranslator` returns at once for English (`src/runtime/translator.js:778`);
- nothing reads the delivered translations in `server/seed/historical/locales/en.json` (5,814 entries: all display fields of the 873 events, the court dossiers, the map reviews, 1,011 culture names) or `locales/sv.json` (1,602 Swedish source locators and institutions);
- `startDynastyCampaign.js:29` and `dynastyScenario.js:36,62` stamp every campaign `language: 'Swedish'`;
- every character model call passes `languageMode: 'none'` and its prompt asks for Swedish (`src/Game/Characters/characterModelCalls.js:38,69,145,261,342,478`, `src/runtime/characterWorld.js:618`);
- `playerText` in `src/Game/Characters/ActionBox.jsx:93` rejects any sentence that contains "the", "of", "with" or "that", so an English refusal never reaches the player;
- the Swedish text in code has no English translation yet (Task 3 of `docs/superpowers/plans/2026-11-08-bilingual-game-text.md`, which Codex did not deliver).

## Design

### One mechanism: the phrase book, keyed by the Swedish source

`src/runtime/phraseBook.js` is keyed by the source string and knows nothing about English. A string built around values is a pattern with `{{slot}}` placeholders, and a slot's value is itself looked up. English mode gives the translator a second book, the **native book**, keyed by Swedish:

- `Riket går i krig vid {{name}}s sida` → `The realm goes to war at {{name}}'s side`
- `Sändebud` → `Envoy`

The book translates what the page shows, so it reaches text that an older save already stores, and it never rewrites a save, a rule id, an enum value or a command payload.

The native book has three sources, all static files under `public/lang/attainder/`, which both adapters already serve:

1. **Code text.** `catalog-sv.json` lists every Swedish source string and pattern in code, built and checked by `scripts/i18n/build-native-catalog.mjs`. `en.json` maps each catalog entry to English.
2. **Package text.** `catalog-packages-sv.json` lists every unique `*Sv` display string of the four built packages that sources 1 and 3 do not translate (185 on main `9c07d8e5`: the builders add a period or compose a sentence around dossier values). `scripts/i18n/build-package-catalog.mjs` builds and checks it. `packages-en.json` maps each one to English. A rebuilt package with new text fails the check until the string is translated.
3. **Historical data.** `historical-en.json` holds the Swedish to English pairs of `server/seed/historical/locales/en.json` whose two sides differ, without the sidecar's metadata (about 0.7 MB). `scripts/i18n/build-historical-pairs.mjs` builds and checks it and also writes `historical-sv.json`, the English to Swedish pairs of `locales/sv.json` for source locators and institutions. A Swedish key with two English values stops the build until `scripts/i18n/historical-pair-rulings.json` names the one to keep (six keys today).

`mergeNativePack` (pure, in `src/runtime/nativePack.js`) merges the three: code text wins over package text, which wins over a historical pair. The pack loads only in English mode.

The native book is created with three options that the Swedish text needs and the other books do not get:

- a slot's value is translated with the whole book, patterns included, to a depth of two, so `Spelbara riken: {{list}}` over a composed value still reads English;
- a value that is a comma list of known entries is translated item by item;
- a sentence the book lacks is looked up without its final period, and the period is put back, since `{{x}}.` cannot be a pattern.

### Modes

| Options language | Upstream interface | Swedish-native text |
| --- | --- | --- |
| Swedish (`sv`) | English to Swedish from `public/lang/sv.json`, as today | shown as written; source locators and institutions read from `locales/sv.json` |
| English (`en`) | shown as written | Swedish to English from the native book |
| any other | as today | as today: Swedish, or the model's translation where that language has no pack |

**Native mode.** In English mode the translator runs with the native book only. It reads no localStorage cache, fetches no `/api/lang` pack, queues nothing for the model (`noteUnknown`, `queueContent`, `translateLabel`, `enqueueStrings` and `collectAndTranslate` do nothing) and writes nothing to the server. A string the book lacks stays as it is; when `looksSwedish` says so, it is listed in `window.__ohI18n.missing`, which is how the browser run finds gaps. `looksSwedish` (`src/runtime/swedishText.js`) is true for text with å, ä or ö or with a Swedish function word between non-letters. `isTranslatable` accepts two adjacent letters of any script, so `Mål` and `Hög` count.

**Two tiers.** The roots of the Swedish-native views carry `data-native-text`: the character panel, the start card, the start picker, the year notice and the historical record. Inside them the whole native book applies. Outside them only exact entries and patterns with at least eight literal letters apply, so a weak Swedish pattern such as `{{name}} dog {{date}}` cannot turn the upstream text `Hot dog stand` into `Hot died stand`. A test runs the outside tier over every entry of `public/lang/catalog-en.json` and expects no match.

**Free text.** Containers of text the model or the player wrote carry `data-no-translate` where the component knows the origin: conversation and envoy messages, typed actions, model narration. The start card loses its `data-no-translate` and gets `data-native-text`.

**Swedish mode.** A string that `looksSwedish` is never queued for the model, so the Swedish court and package text is no longer sent off as English content. The Swedish book also takes `historical-sv.json`.

### The first language

An install that has never stored a language starts in Swedish, the language the game is written in. English is stored as an explicit choice, where today English means "nothing stored". `DEFAULT_LANGUAGE` keeps its meaning for the translator: the language of the upstream source. Four functions of `src/runtime/i18n.js` change together:

- `getStoredLanguage` falls back to `INITIAL_LANGUAGE = 'sv'`;
- `writeLocalLanguage` stores every code, `en` included;
- `setStoredLanguage` sends the code it was given;
- `syncLanguageFromServer` treats a server without a stored language as "no opinion" and reports a change only when the value it wrote reads back, so a missing server value or blocked storage cannot reload the page on every boot.

An install whose player picked English in Options has `language: 'en'` on its server and keeps it. An install that never opened the picker reads Swedish from now on.

### The model writes in the chosen language

`characterLanguage()` in `src/runtime/characterLanguage.js` returns `'English'` when Options says English and `'Swedish'` otherwise. Every character prompt takes the language name where it says "Swedish" today (`characterModelCalls.js:38,69,145,261,342,478`, `characterWorld.js:618`), including the tool schema descriptions. Each prompt also says that the campaign data it quotes is Swedish and that the answer is in the chosen language regardless, as `chatLanguageDirective` does for chats, because stored stories, memories and labels go into the prompts in Swedish.

New campaigns stamp `language` from the same function. For a dynasty campaign the simulation prompt context (`src/Game/AI/promptContext.js:1653,1969`) reads the current Options choice before `world.language`, and `callAI` forces the language directive for it in English too, so a restored campaign and a package that says `Svenska` both follow Options. Structured response keys stay canonical.

### Refusals

The engine writes its refusals in Swedish in both modes, and the page translates them. `playerText` therefore keeps its rule for engine and transport messages: a Swedish sentence passes, and an English internal error is kept from the player. Of 108 English error literals in the code that end in punctuation, 102 would pass a filter that only looked for transport words, so the filter stays.

Text the model wrote is a different origin and gets `modelText`: a sentence from a validated structured field passes when it ends in `.`, `!` or `?` and fits the field's length limit, in either language. Each call site that shows a model's `reason` or `explanation` uses `modelText`; where a wrapper returns both kinds, it tags the origin. `DynastyStartCard` shows `failure.message` raw today and passes it through `playerText`.

### Translations are data with a check

`en.json` covers every catalog entry: a test fails when an entry has no translation, when a translation drops or invents a slot, or when it is empty. A name that stays the same in English is listed with the same text on both sides. The build script fails when Swedish text in code is in neither the catalog nor `scripts/i18n/native-catalog-exclusions.json`, so new Swedish text cannot miss the catalog.

A test fails when a built `*Sv` string of a shipped package has no translation in the merged pack.

`scripts/check-locale-sidecars.mjs --check` verifies every `locales/` entry against its source field by `textSha256`. One entry was stale on main `9c07d8e5`: the Rome settlement note of `ad800-review.json`, which Charlemagne 1.4.0 changed. The research session owns the sidecars and corrects it in PR #201.

## Slices

Each slice is one pull request and leaves the game playable.

1. **Catalog.** The extractor, `catalog-sv.json`, the exclusions file and their test.
2. **Runtime.** Three parts with separate files: the data scripts, the phrase book options and `mergeNativePack`; native mode, the tiers and the first-language rule in the translator; the model language, `modelText` and the markers in the views. `en.json` and `packages-en.json` may be partial here, and the coverage tests report the share.
3. **Translations.** `en.json` and `packages-en.json` for both catalogs, written in shards by context and reviewed by a second reader; the coverage tests go to 100 percent.
4. **Browser run.** A new and a restored campaign in each language, a language change in Options, a year-end popup with sources, an action with its outcome and a refusal, and a model-written story. Gaps the run finds go back into the catalog or the pack. The play script and the backlog record the result.
5. **Help and English-only research.** The 32 help pages of `public/lang/attainder/help/` and the 113 events the research wrote in English only. Designed when slices 1 to 4 are in.

## Rulings

- **Display-time translation, not a locale parameter in the engine.** The engine keeps its Swedish sentences. A locale parameter would touch 1,836 literals, change what saves hold and leave every old save in Swedish. Cost if wrong: a sentence assembled from several fragments can miss its pattern and stay Swedish; the browser run lists such text and the fix is a full-sentence variant in the catalog.
- **Swedish is the first language.** Cost if wrong: one click in Options.
- **Languages other than Swedish and English keep Swedish court text.** Chaining Swedish to English to a third language is a later step. Cost: none against today.
- **Text the model already wrote stays in the language it was written in.** A story written in Swedish reads Swedish after a switch to English. Cost: mixed text in a campaign played in both languages.
- **The whole page is scanned in English mode, in two tiers.** Swedish court text also reaches upstream views (the event log, notifications), so marked regions alone would miss it. Outside the marked views only exact entries and strong patterns apply. Cost if wrong: a short Swedish sentence in an upstream view stays Swedish; the browser run lists it and the catalog gets a full-sentence entry.
- **A sentence that mixes engine text and model text is translated as far as its pattern reaches.** `index.js:739` stores `${reason} Förändring: …` with a model-written reason. In an English session the reason is English. Cost: an older Swedish save shows a Swedish reason followed by English.
- **Package text is translated as built strings, not in the builders.** The builders keep writing Swedish, and `packages-en.json` follows the built output. Cost: each release that changes package text needs its new strings translated before the check passes.
- **Translations ship in the repository, written by Claude sessions.** Codex's subscription ended on 11 November 2026. A second reader checks each shard for meaning, numbers, uncertainty and slots.

## Non-goals

A third language for court text. Translating saved state. Translating bibliographic titles, quotations and attested names. A Swedish translation of the English-only research events (slice 5 decides).

## Acceptance

- `node scripts/i18n/build-native-catalog.mjs --check` and `node scripts/check-locale-sidecars.mjs --check` exit 0.
- `node scripts/i18n/build-historical-pairs.mjs --check` and `node scripts/i18n/build-package-catalog.mjs --check` exit 0.
- Tests: the native book translates real engine output (a log title with a genitive name, a refusal, a label inside a pattern slot, a comma list, a sentence with a builder's period); the outside tier matches nothing in `catalog-en.json`; the native-mode policy queues nothing for the model and Swedish mode queues no Swedish text; an unset language reads Swedish, a stored `en` reads English and a server without a language causes no reload; each character prompt names the chosen language, and in English mode no prompt asks for Swedish; `modelText` passes an English refusal and `playerText` stops `Failed to fetch`; every built `*Sv` string and every catalog entry is counted against the pack.
- The browser run of slice 4 in both languages, with no Swedish text left on the visited views in English mode except names, quotations and model text written earlier.

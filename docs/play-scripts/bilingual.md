# Play script: Swedish and English

The player chooses Swedish or English in Options, and the game text follows. Design: `docs/superpowers/specs/2026-11-11-bilingual-runtime-design.md`. How it works: the last sections of `docs/i18n.md`.

## What to do

1. Start the game on an install that has never stored a language. The menus and the start card read Swedish.
2. Open Options, choose English and let the page reload. The start card reads English: realm names, rulers, the difficulty text, the model connection.
3. Start `Charles's realm (Carolingian Empire)` as the realm. Open `Realm & families` and visit each tab.
4. In `Overview`, open `What upholds legitimacy?` and read the path to a nickname.
5. Choose an action from the list, such as `Recover`, confirm it and read the outcome.
6. Press `Next year with the model`. Read the year's events, the notice `In real history` and the two decisions under `Decisions`.
7. Reload the page, open the campaign again from `Games` and check that it still reads English.
8. Choose Swedish in Options. The same campaign reads Swedish, with a decimal comma in its numbers.

In English mode `window.__ohI18n.missing` in the browser console lists every string inside a Swedish-native view that the book could not read. A Swedish sentence there is a gap: add it to the catalog (`node scripts/i18n/build-native-catalog.mjs`) and to `public/lang/attainder/en.json`.

## Browser run, 12 November 2026

Run on `feat/bilingual-runtime` with Playwright Chromium against `node server/server.js` on port 4167, an isolated `OH_DATA_DIR`, the production build and the local Claude sign-in. The language was set the way the Options picker sets it (`ui_language` in localStorage and `PUT /api/ui-settings`), followed by a reload; the picker itself was not clicked.

| Step | Result |
| --- | --- |
| Fresh install | Swedish: `lang="sv"`, pack mode, Swedish menus and start card |
| English, start card | English throughout; `missing` empty; nothing queued for the model |
| English, new realm campaign at AD 800 | Every tab of the panel reads English; action menu with tribes and generated names in English |
| Overview | `25 December AD 800`, `Succession: +65`, `reign goals met 0 of 2 or prestige 10 of 40`, `-18.8`, `56.8 %` |
| Action `Recover` | Confirmation card and outcome in English: `Charles (Charlemagne) recovers. Stress −30, health +5.` |
| `Next year with the model` | The model wrote the year's ten events in English; two decisions with their choices, costs and deadline sentence in English |
| Notice `In real history` for 800 | Titles, dates, date qualifiers and places in English; no Swedish text |
| Reload and reopen from `Games` | The restored campaign reads English |
| Swedish on the same campaign | The panel reads Swedish with `65,5` and `25/12 801 e.Kr.` |

The run found and fixed: a label with its value in one run (`Tronföljd: +65`), a count against its threshold with a label of several words, conditions joined by `eller`, date labels, numbers in the Swedish locale, generated names, sentences set one after another in a choice, and a weak pattern around a value read by another pattern.

Not covered by this run: a click on the Options picker, a refusal, a conversation or an envoy, family mode, the web adapter and Android, the help pages, and languages other than Swedish and English. The model once wrote the polity id `carolingian-realm` in its prose; that comes from the prompt context, not from the translation.

## Help pages, 12 November 2026

Run on `feat/bilingual-help` against the same server and build, on `/wiki/espionage/`.

| Step | Result |
| --- | --- |
| `ui_language = sv` | Swedish page, `lang="sv"`, title `Spionage och avlyssningsrapporter — Guide till Attainder` |
| `ui_language = en` | English page, `lang="en"`, title `Espionage and intercepted reports — Attainder guide` |
| Switch to `Svenska` | Swedish without a reload or a scroll jump; `wiki_language = sv` stored, the game's choice untouched |
| Search | `avlyssning` finds the page in Swedish and nothing in English; `intercept` finds it in English |
| Structure | No duplicated element id; the hidden language takes no space; the upstream legal notice is present |

Not covered: opening the help from the game's own link, a keyboard walk, the view without script, a phone. The visit-count banner on the page is upstream text and stays English.

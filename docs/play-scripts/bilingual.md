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

## Web adapter and family mode, 12 November 2026

Run with Playwright Chromium against `vite --mode web` on port 5199 (campaign in IndexedDB), with `/api/local-models/status` stubbed so that a start is allowed; no model call was made.

| Step | Result |
| --- | --- |
| Fresh profile | Swedish: `lang="sv"`, pack mode |
| Family start, Kyrkostaten AD 800, `Leos hushåll` | Campaign `Kyrkostaten, 800 e.Kr. · Familjen`; the panel reads `FÖLJ FAMILJEN` |
| Options, `Allmänt`, `Gränssnittsspråk` | The picker shows Swedish as chosen; choosing `English` reloads the page into English (`ui_language = en`, native mode) |
| Family campaign in English | Every tab reads English: `FOLLOW THE FAMILY`, `Leo’s household`, `25 December AD 800` |
| Action list | Marriage candidates read `Gisela, aged 20 (Charles’s realm (Carolingian Empire))`; a closed action gives its reason in English (`There is no eligible participant.`) |
| Back to Swedish | Swedish again; the gap list holds no text from the Swedish-native views |

The run found and fixed: a start row read as one year (`AD Byzantine Empire · 800`), a weak pattern around known values of many words (the marriage candidates), and Swedish view text listed as gaps of the Swedish pack.

Known limits seen in this run: the web landing page and the demo notice are upstream English text outside the language pack, and in Swedish one link inside the notice is translated while its sentence is not. In Swedish with a model connected, the upstream translator sends the community hub's English posts to the model once to translate them, as it does for every language other than English. Not covered: Android, a model call on the web adapter, a conversation, an envoy.

## Conversation, envoy and refusal with the model, 12 November 2026

Run on main `2339e247` against `node server/server.js` on port 4167 with the production build and the local Claude sign-in, in English, on the realm campaign of the first run (25 December AD 801). Six model requests.

| Step | Result |
| --- | --- |
| No model connected | `The conversation could not be interpreted. Try putting it another way.`; the internal error stayed in the console |
| Conversation with Charles the Younger | The model read the English message as a request: `Give their support`, `Gift offered: 20 silver from the family treasury`, `Chance of a yes: uncertain` |
| `Ask` | `Charles the Younger refuses the request.` and a reply written by the model in English, marked as written text |
| Envoy to the Papal States | `Ask for reconciliation`, `Chance of a yes: unlikely`; then `Leo III turns the envoy away. The next envoy can go in a year.` and Leo's reply in English |
| Free-text action against a person who does not exist | `The person does not exist in the game: Duke of York.`, and the menu opens with every action |
| Chronicle | The envoy, the conversation, the demand and the year's administration read English |

The run found and fixed: the conversation's chronicle line stayed half Swedish (`Karl … bad Karl den yngre om stöd but the answer was no.`), so the engine now writes who asked whom as one sentence per request, with the same Swedish text as before; the border tribes' state `oroligt` had no entry; an engine sentence kept its decimal comma (`−13,8 silver`).

Not covered: an accepted request, a pledge, a secret revealed, a prisoner, a duel, Android.

## Engine text sweep, 12 November 2026

The browser runs above read the text that happened to be on screen. `node scripts/i18n/sweep-engine-text.mjs --check` plays every shipped start in both modes and Hadara for 30 years under two seeds, without a browser or a model, and reads every string the engine writes with the English book (method: the section "The engine text sweep" of `docs/i18n.md`).

| Run | Strings | Gaps |
| --- | --- | --- |
| 10 years, one seed, before the fixes | 5,850 | 23 |
| 30 years, two seeds, after the first fixes | 19,977 | 19 |
| 30 years, two seeds, final | 19,976 | 0 |

The sweep found and fixed: a one-word name before an illness or a grief (`Gisela: smittkoppor`), a name with a prefix (`al-Hakam I`), the long court note after a realm's name, generated names in a list of the dead, a generated name without its mark (`Kung Meris lära`, `Starkt grepp över Gemål 1 (genererad)`), a pattern that cut a foreign child's name inside its parenthesis (`Dotter (Bysantinska riket, född 808), 16 år …`), the genitive after a record id in a cadet branch's name, and three codes the filter read as text.

Not covered: text a model writes, the upstream views outside the character system, and a branch named after a person, which keeps the Swedish genitive in English (`Gislas branch of …`).

# English first, Swedish as a choice: design

## Why

The owner's instruction of 18 November 2026: the whole game is to read English, English by default, with Swedish as an option.

Since `docs/superpowers/specs/2026-11-11-bilingual-runtime-design.md` the game reads Swedish or English by the Options choice, and a new install starts in Swedish. The court's text is written in Swedish and has an English reading through the native phrase book (`public/lang/attainder/`). Three things stand between that and the instruction:

1. A new install reads Swedish until the player finds the language picker.
2. Some text has no English reading yet, because it never passes the page translator. The first found: the map's own labels for a package's cities (`Rom`, `Konstantinopel`, `Raqqa och Rafiqa` under English headings).
3. The repository's own account says the character interface uses Swedish.

## Goals

- A new install reads English from its first screen.
- Swedish is one choice in the language picker, and everything that reads Swedish today still does when it is chosen.
- In English, no Swedish text is left on the screens a player meets: the start, the picker of starts, the map, the court shell, the docked panel, the year's record, the help pages.

## Non-goals

- The source text stays Swedish. The court's sentences are written once, in Swedish, and read in English through the book; turning the source over is a rewrite of every sentence and every test that quotes one, and it would change nothing a player sees.
- No third language gains a reading of the court's text in this work.
- Saves are not rewritten.

## Rulings

1. **A device that can store a choice and has stored none reads English.** `INITIAL_LANGUAGE` becomes `en`. Where there is no storage at all (the engine under bare node, the build's tools, the tests that render a view without a browser), nothing can be translated and the source is read: Swedish, under its own name, `SOURCE_LANGUAGE`. A device whose storage refuses to be read (a private window) is still a browser and reads English. Cost if wrong: one function.
2. **A player's stored choice is kept.** An install whose player chose Swedish has `sv` stored, on the device and on its server, and keeps it. An install that never opened the picker and read Swedish by default reads English from now on; its picker shows English, and Swedish is one press away.
3. **What the map draws is read through the book.** A package's city names reach the map's labels, the seat portraits and the place search in the player's language. Their English stands in the package book (`public/lang/attainder/packages-en.json`).
4. **English mode is checked by looking.** A browser run on a fresh install walks the start, each of the four starts' cards, the map, the shell's areas and the panel's tabs, and collects every text that reads as Swedish. Each is given its English or a stated reason to stand (a person's name, a model's own words).
5. **The repository says what is true.** `README.md` and `docs/i18n.md` name English as the first language and Swedish as the choice.
6. **Swedish is one press away on the first screen.** The Options picker is reached from the game menu, which a new install does not see until a campaign runs. The start card carries a button beside its theme switch that names the other language in that language (`Svenska` on a device that reads English, `English` on one that reads Swedish), stores the choice as the picker does and reloads. Found by the first browser run of slice 1. Cost if wrong: one button.

## Slices

1. The first language (rulings 1, 2, 5).
2. The map's names (ruling 3).
3. The walk through English mode and what it finds (ruling 4).

## Checks

- `src/runtime/i18nFirstLanguage.test.js` for the first language on a device with storage, with blocked storage and with none.
- The text checks (`build-native-catalog --check`, `check-native-pack`, `build-package-catalog --check`, `sweep-engine-text --check`).
- The full suite and the build.
- The browser walk of ruling 4, on a fresh data directory, with its list of findings.

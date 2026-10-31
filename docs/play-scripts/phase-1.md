# Phase 1 play script

This script walks you through the Phase 1 features in the running game: free-text actions with odds, the five outcome tiers, multi-month schemes, the menu fallback and old saves.

It takes about 30 minutes and uses the model for roughly ten calls. The game interface is Swedish, so button labels appear here exactly as the game shows them.

Each step says where to click, what to type, and what you should see. If a step does not match, stop and note the step number.

## Part 0: Prepare

1. Check the requirements. You need Node.js ^20.19.0 or 22.12.0 and later (the range in `package.json`; the README recommends 24), npm, and Claude Code or Codex installed and logged in on this computer. Model calls count toward that account's usage limits.
2. Open a terminal in the project folder and install and build once.

   ```sh
   npm ci
   npm run build
   ```

   You should see `built in` followed by a time, and no error. Rebuild with `npm run build` after every change to the source.
3. Start the game.

   ```sh
   node scripts/launch-dynasties.mjs
   ```

   On Windows you can double-click `Start-Tides-of-Time.cmd` in the project folder instead. You should see the line `Tides of Time is ready at http://127.0.0.1:4167`, and your browser opens that address. If the browser does not open, open http://127.0.0.1:4167 yourself.
4. Find the start card. At the top of the page, above the list of games, a card with the heading `Vem för du vidare?` appears. If you see a game instead, click `⌂ Exit Game` in the top bar to reach the main menu, where `Games` is one of the tabs.

## Part 1: Connect the model

1. On the start card, find the box titled `Anslut Claude eller Codex` on the right side.
2. Click `Välj Claude` (or `Välj Codex` if you use Codex). If the button is disabled, read the grey status text under the name. `Behöver inloggning` means you must log in to that app on this computer first. Then click `Uppdatera status`.
3. You should see the status `Inloggad och tillgänglig`. After the click you should see the message `Claude är vald. Nästa modellstyrda tur använder din befintliga inloggning.` and the button now reads `Vald`.

## Part 2: Start a campaign on Normal

1. On the start card, leave `Följ riket` selected.
2. Find the `Svårighetsgrad` select under the campaign text. You should see `Normal` chosen. Leave it.
3. Click `Starta som riket Hadara`.
4. You should see the button change to `Kampanjen skapas…`, then the game opens with the panel `Rike & familjer` on top. The strip under the title shows `FÖLJ RIKET`, the date, and `Svårighetsgrad: Normal`.

## Part 3: A free-text action with odds

1. In the panel `Rike & familjer`, open the tab `Överblick` (the first tab).
2. Scroll down to the card `Handla själv`.
3. Click the box under `Vad vill du göra?` and type exactly:

   ```
   Jag försöker vinna Namars stöd med gåvor och smicker
   ```

4. Click `Tolka`.
5. You should see `Modellen tolkar din text…` for a few seconds. Then a card appears with the small heading `Omstridd handling` and the title `Påverka`. Keyboard focus moves to that title.
6. Read the card. It lists `Utförs av:` (your representative), `Mål:` (a person from the Namar family; if the card names someone from another family, note it and go on), `Extra silver:`, `Agenter:` and `Kostnad:`. Two lines follow: `Chans att lyckas:` and `Chans att hållas hemlig:`. Each shows a percentage between 5 % and 95 %, or a word such as `jämn` or `hög`, depending on the skill of the actor.
7. Click `Vad påverkar chansen?`. You should see a list of reasons, each with a label and a signed number such as `+10` or `−5`.
8. Look at the footer of the panel. It reads `Modellanrop denna session:` followed by a number. Note it.

## Part 4: Confirm and read the outcome

1. Click `Genomför`.
2. You should see an `Utfall` card. First it shows one heading and the line `Modellen skriver berättelsen…`. The heading is one of these five, and the game rolled it from the odds you saw:
   - `Lyckat i det tysta`
   - `Lyckat men avslöjat`
   - `Misslyckat i det tysta`
   - `Misslyckat och avslöjat`
   - `Det slog tillbaka`
3. After a few seconds the card shows a story title and one or more paragraphs of Swedish text. Note the title and the heading.
4. Check the footer. `Modellanrop denna session:` has gone up by 2 since Part 3, step 8: one call to read your text, one to write the story.
5. If the card instead shows the line `Berättelsen kunde inte skrivas; utfallet gäller.`, the outcome still counts, and the card shows the game's standard text. Note this and continue.
6. Click `Ny handling`. You should see the text box again, empty.

## Part 5: Find the result after a reload

1. Reload the browser page (press F5).
2. The panel stays closed after a reload. Click `Rike & familjer` at the left of the screen.
3. Open the tab `Krönikan`, then click `Årskrönika`.
4. You should see an entry with the story title you noted in Part 4, step 3, with the date of your action. If you saw the standard text in Part 4, step 5, look for the entry whose title starts with `Påverka:`.
5. Open `Överblick` and check the footer. `Modellanrop denna session:` shows 0 again, because the counter lives only in the open page. The save itself keeps the result.

## Part 6: Start a scheme and let it resolve

1. Open the tab `Personer`. Find a person whose second line starts with `Namar`. Note the name.
2. Open `Överblick`, scroll to `Handla själv`, and click `Välj från listan`.
3. You should see a list of actions with the caption `Välj en handling. Omstridda handlingar visar chansen innan du bestämmer dig.`, a button `Stäng listan`, and group headings such as `Förvaltning och hushåll`, `Intrig` and `Diplomati`. Under `Intrig`, click `Undergräv`.
4. You should see a short description and a form. In the select `Mål`, choose the Namar person you noted. Leave `Extra silver` at 0 and tick no agents.
5. Click `Visa chansen`.
6. You should see a card titled `Undergräv` with the odds, as in Part 3.
7. Click `Genomför`.
8. You should see an `Utfall` card with the heading `Intrigen har inletts`, the title `Undergräv: ` followed by the person's name, and a line that starts `Planen avgörs` with a date three months ahead.
9. Click `Ny handling`. Under the action box, a section `Pågående intriger` now lists the scheme with `Mål:`, `Utförs av:`, `Avgörs:` and the button `Avbryt intrigen`.
10. At the top of the panel, click `Nästa år med modellen`. The button reads `Bearbetar…` while the model writes the year. This is the slowest step of the script.
11. When it finishes, you should see the year's events. If the year stops at a decision or a care case, answer it in the tab `Beslut` and click `Nästa år med modellen` again.
12. The scheme falls due after three months, so it resolves in this year. Open `Krönikan` and `Årskrönika`: you should see an entry for the outcome of `Undergräv`. Return to `Överblick`: the section `Pågående intriger` is gone.

## Part 7: Abort a scheme

1. Repeat Part 6, steps 2 to 9, with another Namar person. If `Visa chansen` is disabled, read the line under the form. It states the reason, for example too little silver.
2. In `Pågående intriger`, click `Avbryt intrigen`.
3. You should see the question `Vill du avbryta intrigen? Silver och handling som redan lagts kommer inte tillbaka.` and two buttons.
4. Click `Behåll intrigen`. The scheme stays and the button `Avbryt intrigen` is back.
5. Click `Avbryt intrigen` again, then `Ja, avbryt intrigen`. You should see the scheme disappear from the list.

## Part 8: Turn the model off and use the menu

1. Close the `Rike & familjer` panel with the `×` button at the top right. Then click the `☰` button at the top left (tooltip `Game menu`) and choose `AI`.
2. Under `Models`, click `Clear list`. A browser dialog asks you to confirm. Click `OK`.
3. You should see the text `No models yet. Add one to let the game write turns and replies.` The list is stored in the browser's saved settings for this game address, so only this browser is affected.
4. Close the settings with the `×` button at the top right of the settings window, then open `Rike & familjer`, tab `Överblick`, card `Handla själv`.
5. Type `Jag försöker vinna Namars stöd med gåvor och smicker` and click `Tolka`.
6. You should see the action list open (caption `Välj en handling. Omstridda handlingar visar chansen innan du bestämmer dig.`), with a line above the caption that says `Texten kunde inte tolkas. Välj en handling i listan.` or another Swedish sentence that explains why the model did not answer. You should not see English error text.
7. Under `Diplomati`, click `Påverka`, choose a target in `Mål`, and click `Visa chansen`. The card appears with the odds, with no model involved.
8. Click `Genomför`. You should see an `Utfall` card with a tier heading and the game's standard text. Because the model is off, the card also shows the line `Berättelsen kunde inte skrivas; utfallet gäller.`
9. To restore the model list, click `Anslut modell` at the top of the panel and repeat Part 1, step 2. Alternatively open the game menu, `AI`, click `Fill…`, tick your connection and enter a model name, as the `Clear list` dialog describes: your connections and keys were kept.

## Part 9: Load a campaign saved before Phase 1

The repository holds no old save, and a save from a real game is private, so you create one with a build from before Phase 1. Saves live in the folder `play-data/` inside the project folder, or in `play-data/` under the folder named by the environment variable `TIDES_DATA_HOME` when you set it. The steps below set it, so that both builds share one folder.

1. Stop the running game. Open `reports/launcher/server-process.json`, in the project folder or, if a file `SPELA.md` sits in the project's parent folder, in that parent folder. Read the number after `"pid"` and run `Stop-Process -Id <number>` in PowerShell. Alternatively free port 4167: run `Get-NetTCPConnection -LocalPort 4167`, then `Stop-Process -Id <OwningProcess>` with the number in the `OwningProcess` column.
2. Choose a folder for the saves, for example `C:\tides-saves`, and set it in the terminal for both runs below. In PowerShell:

   ```powershell
   $env:TIDES_DATA_HOME = "C:\tides-saves"
   ```

3. Make a second copy of the project at the `main` branch, which has none of the Phase 1 changes. Put it in a short path outside OneDrive: the project folder sits in a long OneDrive path, and `npm ci` can fail on long paths there, and OneDrive would sync thousands of `node_modules` files. Run this in the same PowerShell window. It uses your own `origin` address.

   ```powershell
   git -c core.longpaths=true clone --branch main --single-branch --depth 1 (git remote get-url origin) C:\devttainder-main
   cd C:\devttainder-main
   git config core.longpaths true
   npm ci
   npm run build
   node scripts/launch-dynasties.mjs
   ```

   Before the last line, run `git log -1 --format=%h`. It should print the `main` commit. In the Phase 1 project folder, `git rev-parse --short origin/main` prints the commit your last fetch saw (`728eaec` at the time of writing). If `main` has moved since, the two differ and either is fine, as long as the clone has no Phase 1 files: `docs/play-scripts/phase-1.md` must be missing. The last command should print `Tides of Time is ready at http://127.0.0.1:4167`.
4. In the game, connect the model and start a campaign as in Parts 1 and 2. Open `Rike & familjer` and click `Nästa år med modellen` once. Close the browser tab.
5. Stop that game as in step 1. Its process file is now under `C:\tides-saves\reports\launcher\server-process.json`.
6. Run `cd` to your Phase 1 project folder in the same PowerShell window, so that `TIDES_DATA_HOME` is still set, and start the game with `node scripts/launch-dynasties.mjs`.
7. If a game opens, click `⌂ Exit Game` in the top bar. In the main menu, click the `Games` tab. You should see the campaign from the `main` build in the list. Click `Play` on it.
8. Open `Rike & familjer`. You should see `Svårighetsgrad: Normal` in the strip, since old campaigns count as Normal. The card `Handla själv` is present.
9. Click `Nästa år med modellen`. You should see the year's events and no error message.
10. Clean up: stop the game as in step 1, leave the clone with `cd ..`, remove it with `Remove-Item -Recurse -Force C:\devttainder-main`, and delete `C:\tides-saves` if you no longer need it.

## Report back

For each part, write down pass or fail and the step number of the first mismatch. Add the odds you saw in Part 3 and the tier you rolled in Part 4.

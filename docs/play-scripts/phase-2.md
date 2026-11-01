# Phase 2 play script

This script walks you through the Phase 2 features in the running game: the spymaster, feasts, poison and its odds, the `Intriger` tab, court conversations, rumors, plots against you, prisoners and ransom, and the message for a name that is not in the game.

It takes about 60 minutes and uses the model for roughly 25 calls, most of them in the year turns of Part 11. The game interface is Swedish, so button labels appear here exactly as the game shows them.

Each step says where to click, what to type, and what you should see. If a step does not match, stop and note the step number. Chance values and tiers come from random rolls, so your numbers will differ from the examples. The sentences and labels should match.

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

   On Windows you can double-click `Start-Attainder.cmd` in the project folder instead. You should see the line `Attainder is ready at http://127.0.0.1:4167`, and your browser opens that address. If the browser does not open, open http://127.0.0.1:4167 yourself.
4. Find the start card. At the top of the page, above the list of games, a card with the heading `Vem för du vidare?` appears. If you see a game instead, click `⌂ Exit Game` in the top bar to reach the main menu, where `Games` is one of the tabs.
5. Connect the model. On the start card, find the box titled `Anslut Claude eller Codex`, click `Välj Claude` (or `Välj Codex`), and check that the button now reads `Vald`. Part 1 of the [Phase 1 play script](phase-1.md) has the details.

## Part 1: Start a campaign on Normal

1. On the start card, leave `Följ riket` selected.
2. Find the `Svårighetsgrad` select. You should see `Normal` chosen. Leave it.
3. Click `Starta som riket Hadara`.
4. You should see the game open with the panel `Rike & familjer`. The strip under the title shows `FÖLJ RIKET`, the date, and `Svårighetsgrad: Normal`.
5. Open the tab `Ämbeten & arv`. Find the card with the heading `Spionmästare`. It shows the badge `Vakant`. The realm does not fill this office by itself; you appoint it.

## Part 2: Appoint Sera Arel spymaster

1. Open the tab `Överblick` and scroll to the card `Handla själv`. Click `Välj från listan`.
2. Under the group `Förvaltning och hushåll`, open `Utse en ämbetsinnehavare`. The card lists its cost as `15 silver ur statskassan · 1 handling`.
3. In the select `Ämbete`, choose `Spionmästare`. In the select `Kandidat`, choose `Sera Arel`.
4. Click the button `Utse en ämbetsinnehavare` at the bottom of the form. A confirmation card appears with the small heading `Beslut`. Click `Genomför`.
5. You should see an `Utfall` card with the heading `Utse en ämbetsinnehavare`. Click `Ny handling`.
6. Open `Ämbeten & arv`. The card `Spionmästare` now names Sera Arel as holder.

If the card is disabled, the reason shows under the form, for example `Kräver härskarmandat.` Note it and continue; Parts 4 to 7 do not need the spymaster.

## Part 3: Hold a feast

1. In `Överblick`, under `Handla själv`, click `Välj från listan` again. Under `Förvaltning och hushåll`, open `Håll gästabud`. The card lists `30 silver ur familjekassan · 1 handling`.
2. Click `Håll gästabud`, then `Genomför` on the confirmation card.
3. You should see an `Utfall` card with the heading `Håll gästabud` and the title `Arel håller gästabud`. Click `Ny handling`.
4. Scroll up in `Överblick`. A card labelled `Gästabud` shows the heading `Gästabud pågår till` followed by a date one month ahead, and a line such as `16 gäster är inbjudna.` Every living adult who is not in prison is a guest.
5. Open the list again. `Håll gästabud` is now disabled with the reason `Familjen höll gästabud för mindre än ett år sedan.`

## Part 4: Type a poisoning and read the odds

1. In `Handla själv`, click the box under `Vad vill du göra?` and type exactly:

   ```
   Jag förgiftar Tarek under gästabudet
   ```

2. Click `Tolka`. You should see `Modellen tolkar din text…` for a few seconds.
3. A card appears with the small heading `Omstridd handling` and the title `Förgifta`. It lists `Utförs av:` (Arel av Hadara), `Mål:` (Tarek Arel), `Extra silver:` 0, `Agenter:` inga and `Kostnad:` `25 silver ur familjekassan · 1 handling`. If the card names another person as the target, cancel with `Avbryt` and use `Välj från listan` > `Intrig` > `Förgifta` to choose `Tarek Arel` in the select `Mål`.
4. Read the two lines `Chans att lyckas:` and `Chans att hållas hemlig:`. Each shows a percentage between 5 % and 95 % or a word. Arel's intrigue skill decides which: 12 or more gives exact percentages, 7 to 11 gives one of five bands (`mycket låg` to `mycket hög`), and below 7 one of three (`osannolik`, `osäker`, `trolig`).
5. Click `Vad påverkar chansen?`. Find the two feast rows. At exact precision they read `Gästabudet ger tillträde: +15` and `Hemlighållning: många vittnen på gästabudet: −5`. At the band precisions each row shows only a sign, such as `Gästabudet ger tillträde: +`. Other rows you may see are `Grundchans`, `Svårighetsgrad: Normal` and `Målets svaga hälsa` if Tarek is frail.
6. Click `Avbryt`, open `Välj från listan` > `Intrig` > `Förgifta`, choose `Tarek Arel` in `Mål`, click `Visa chansen`, and read the card again. It must show the same feast rows as in step 5, since the target and the feast are the same.

## Part 5: Confirm and follow the scheme to its outcome

1. Type the sentence from Part 4 again, click `Tolka`, then click `Genomför`.
2. You should see an `Utfall` card with the heading `Intrigen har inletts`, the title `Förgifta: Tarek Arel` and a line that starts `Planen avgörs` with a date one month ahead. Click `Ny handling`.
3. Under the action box the section `Pågående intriger` lists `Förgifta` with `Mål: Tarek Arel`, `Utförs av: Arel av Hadara`, `Avgörs:` and the button `Avbryt intrigen`. Leave the scheme running.
4. At the top of the panel, click `Nästa år med modellen`. If the year stops at a decision, answer it in `Beslut` and click again.
5. Open `Krönikan` and `Årskrönika`. Find the entry for the scheme. It is one of these:
   - `Förgifta: lyckat i det tysta`, `Förgifta: lyckat men avslöjat`, `Förgifta: misslyckat i det tysta`, `Förgifta: misslyckat och avslöjat` or `Förgifta: det slog tillbaka`
   - `Förgifta: planen avslöjades`, when Tarek saw through the plan during the month
6. After a success, open `Personer`. Tarek Arel is marked `Avliden`. After `lyckat men avslöjat` the same chronicle also holds an entry titled `Mord avslöjat` (or `Släktmord avslöjat`, when the game counts the victim as kin of the killer). After `misslyckat och avslöjat` or `det slog tillbaka` it holds `Mordförsök avslöjat`. Note what you got.

## Part 6: Read secrets and rumors in the Intriger tab

1. Open the tab `Intriger`. The heading is `Intriger och hemligheter`, followed by a short sentence on what the tab holds.
2. Read the section `Hemligheter du känner till`. Each card shows a type (`Mord`, `Otrohet`, `Oäkta barn`, `Kätteri` or `Komplott`), `Gäller:` with a name and `Bevis:`. After a poisoning that succeeded or was exposed, expect a `Mord` card with `Gäller: Arel av Hadara`, since you are the one who acted. With nothing to show, the section reads `Du känner inga hemligheter ännu.`
3. Read the section `Grepp`. A card reads `Grepp över` followed by a name, with `Styrka: svagt` or `Styrka: starkt`. Otherwise the section reads `Du har inga grepp över någon.`
4. Read the section `Fångar`. It reads `Inga fångar hålls just nu.` Part 8 fills it.
5. Read the section `Rykten`. Each card shows a topic and a name (for example `Mordplaner: Tarek Arel`), a date, `Påstådd aktör:` and `Tillförlitlighet:` with the value `osäker`, `trolig` or `säker`. With no rumor heard, the section reads `Du har inte hört några rykten.`
6. To see a rumor you made yourself, open `Överblick`, `Välj från listan` > `Intrig` > `Sprida rykte`. Choose a target from the Namar family, choose the topic `Otrohet` in `Ämne`, click `Visa chansen`, then `Genomför`. If the tier is a success, return to `Intriger`. The new rumor reads `Otrohet:` followed by the name, `Påstådd aktör: okänd` and `Tillförlitlighet: osäker`. The rumors your spymaster hears about other houses' plans carry a named culprit instead.

## Part 7: Talk with a household member

1. Open the tab `Personer` and click `Sera Arel` in the list. If Sera is not in the list, pick another adult of your family.
2. In the detail panel, click `Samtala`. You should see a card titled `Samtal med Sera Arel` with the text `Ni har inte talats vid ännu. Skriv vad du vill säga till Sera Arel.`, a box labelled `Vad säger du?` and the buttons `Säg det` and `Avsluta samtalet`.
3. Type a line of small talk, for example `God dag, Sera. Hur står det till på hovet?`, and click `Säg det`. You should see `Modellen läser vad du säger…`, then `Sera Arel svarar…`, and a reply in Swedish in the log. No odds card appears, because the line asks for nothing.
4. Type a request with a reason the game can check:

   ```
   Sera, jag behöver ditt stöd i rådet. Jag erbjuder dig 20 silver.
   ```

   Click `Säg det`. The offer is a grounded argument: it names real silver from your family treasury.
5. A card appears with the small heading `Förfrågan till Sera Arel` and the title `Ge sitt stöd`. It lists `Till: Sera Arel` and `Erbjuden gåva: 20 silver ur familjekassan`, then `Chans att få ja:`.
6. Click `Vad påverkar chansen?`. Find `Grundchans`, `Erbjuden gåva` and, when the model credited your reason, `Övertygande argument`. Other rows may be `Personens åsikt om dig` and `Personens lojalitet`.
7. Click `Fråga`. You should see `Du ställer din fråga…`, then one of two notes in the log: `Sera Arel ger sitt stöd.` followed by `20 silver betalades ur familjekassan.`, or `Sera Arel avvisar förfrågan.` Sera then answers in character. An answer that contradicts the note is a bug; note it. If the reply cannot be written you see `Svaret kunde inte skrivas; utfallet gäller.`
8. Type another request to Sera, for example `Sera, jag ber dig om ditt stöd en gång till.`, and click `Säg det`. A line that asks for nothing does not trigger the check. Within twelve months of the first one, you should see `Ni talade om detta nyss. Personen vill inte bli tillfrågad igen än.`
9. Click `Avsluta samtalet`. The conversation card closes. Note where the keyboard focus ends up (it should be the `Samtala` button of the person; a known limit after a decided request is that focus can stay on the page body).
10. Open `Krönikan` and `Årskrönika`. The conversation appears as an entry titled `Sera Arel ger sitt stöd` or `Sera Arel avvisar förfrågan`.

## Part 8: Imprison a rival

Do this in the same campaign. If a new year has begun, you have four orders again.

1. In `Överblick`, `Välj från listan` > `Hovet` > `Fängsla`. The card lists `10 silver ur statskassan · 1 handling`. If the reason `Bara härskaren kan fängsla.` shows, your representative is not the ruler; note it and skip to Part 10.
2. In `Mål`, choose `Kelan Namar`. Click `Visa chansen` and read the card. `Chans att hållas hemlig:` is low, since an arrest is public.
3. Click `Genomför`. The `Utfall` card shows a tier heading. After `Lyckat i det tysta` or `Lyckat men avslöjat`, Kelan Namar sits in prison. After a failure, repeat with the same target in the next year.
4. Open `Intriger`. In the section `Fångar` a card shows the name, `Namar`, `Fånge sedan` with the date and `Lösensumma: 40 silver`, and the buttons `Frige` and `Avrätta`.
5. Click `Avrätta`. You should see `Vill du avrätta Kelan Namar? Det går inte att ångra.` with the buttons `Ja, avrätta` and `Behåll fången`. Click `Behåll fången`. The prisoner stays.
6. Open `Personer` and select Kelan Namar. The offices Kelan held are vacant. Open `Ämbeten & arv` to check.

## Part 9: Answer the ransom offer

1. At the top of the panel, click `Nästa år med modellen`. If the year stops at a decision, answer it and click again.
2. The prisoner's family answers once a year. With a 60 % chance, and only when the family can pay 40 silver, a decision titled `Lösen för Kelan Namar` opens in `Beslut`. Otherwise `Krönikan` shows the entry `Namar rustar mot kronan` and the family's opinion of you falls. If you got the revolt, advance another year until the offer comes, up to three years.
3. Open `Beslut`. The card `Lösen för Kelan Namar` reads `Namar erbjuder 40 silver för att Kelan Namar ska friges.` It has two choices: `Ta emot lösen` and `Avvisa erbjudandet`.
4. Click `Ta emot lösen`. Open `Intriger`: `Fångar` reads `Inga fångar hålls just nu.` and `Krönikan` shows the entry `Kelan Namar löses ut`. If you click `Avvisa erbjudandet` instead, the prisoner stays and the family head's opinion of you falls. Try both in two separate runs if you have time.

## Part 10: A name that is not in the game

1. Open `Överblick`. In `Handla själv`, type exactly:

   ```
   Jag förgiftar Zorbas under gästabudet
   ```

2. Click `Tolka`.
3. You should see the action list open, with the line `Personen finns inte i spelet: Zorbas.` above the caption `Välj en handling. Omstridda handlingar visar chansen innan du bestämmer dig.` No odds card appears, and nothing is spent. The model is not asked a second time.
4. If you see `Texten kunde inte tolkas. Välj en handling i listan.` instead, the model did not report the name as unknown. Note it as a mismatch.
5. Click `Stäng listan`.

## Part 11: Plots against you, on Svår

Difficulty is chosen when a campaign starts, so this part uses a second campaign. People outside your family start plots on their own in the yearly step, and `Svår` raises their chance.

1. Close the `Rike & familjer` panel with the `×` button, click `⌂ Exit Game`, and find the start card again as in Part 0, step 4.
2. Leave `Följ riket` selected. In the select `Svårighetsgrad`, choose `Svår`. Click `Starta som riket Hadara`. The strip shows `Svårighetsgrad: Svår`.
3. Repeat Part 2 to appoint Sera Arel spymaster. The spymaster hears more of the plans against other houses and helps to see through plans against yours.
4. Open any contested action, for example `Välj från listan` > `Diplomati` > `Påverka`, choose a target, click `Visa chansen` and then `Vad påverkar chansen?`. At exact precision the difficulty row reads `Svårighetsgrad: Svår: −10`; at the band precisions it shows `Svårighetsgrad: Svår: −`. Click `Avbryt`.
5. Click `Nästa år med modellen`. After each year, open `Intriger` and look at the section `Rykten`, then open `Beslut`. Answer other decisions as they come. Repeat up to 10 years, until you see either of these:
   - a rumor in `Rykten`, such as `Sammansvärjning:` or `Mordplaner:` followed by a name
   - a decision titled `Komplott avslöjad:` followed by the plotter's name
6. If neither appears after 10 years, write down that no rumor or plot appeared in 10 years and go on to Part 12.
7. For a rumor, read `Påstådd aktör:` and `Tillförlitlighet:`. A rumor marked `osäker` can name the wrong person.
8. For `Komplott avslöjad:`, open the card in `Beslut`. The text reads `<name> ligger bakom en plan (undergräv) mot <name>. Du avgör hur komplotten ska mötas.` (or `förgifta`). It has four choices:
   - `Fängsla komplottmakaren`: the plotter goes to prison by lawful decision. Disabled with a reason unless your representative is the ruler.
   - `Avslöja komplotten`: the plot is made public. A poisoning is charged as a murder attempt (`Mordförsök`) and a plot against the ruler as treason (`Förräderi`).
   - `Behåll kunskapen som grepp`: you gain a strong grip over the plotter.
   - `Låt det vara`: nothing happens.
9. Choose one and check the result. After `Fängsla komplottmakaren`, `Intriger` lists the plotter under `Fångar`. After `Behåll kunskapen som grepp`, the section `Grepp` shows `Grepp över` the plotter with `Styrka: starkt`. After `Avslöja komplotten`, `Krönikan` shows the charge. The decision card disappears from `Beslut` in each case.

## Part 12: Reload

1. Reload the browser page (press F5) and click `Rike & familjer`.
2. Open `Intriger`. The secrets, grips, prisoners and rumors from the previous parts are still there, and `Modellanrop denna session:` in the footer shows 0 again.

## Report back

For each part, write down pass or fail and the step number of the first mismatch. Add the odds and feast rows you saw in Part 4, the tier of the poisoning in Part 5, the result of the support request in Part 7, the number of years it took to see a rumor or a plot in Part 11, and the answer you chose.

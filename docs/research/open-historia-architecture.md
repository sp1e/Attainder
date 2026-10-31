# Open Historia: underlag för ett antikt karaktärssystem

Datum: 2026-10-30. Källversion: `293a3b890142c734addd1dd0d1235995b3a43a6d` från `https://github.com/Open-Historia/open-historia`. Granskningen är statisk och läsande. Den verifierar källkodens struktur, inte hur den installerade betan körs. Ingen spelkod har ändrats och inga modellförfrågningar har skickats.

## Bedömning

Open Historia kan bära ett eget karaktärssystem i sin befintliga världsmodell. Spelet har redan tid, politiska aktörer, händelser, diplomatiska samtal, sparning och återställning. Det granskade källträdet har däremot inte en särskild, sammanhängande modell för individuella personers släktskap, åldrande, egenskaper, lojalitet och arv. Ledaren finns huvudsakligen som text i landets statistik. Ett familje- och hovsystem blir därför en ny simuleringsdel, inte en inställning som behöver aktiveras.

För Simons val, ett antikt rikesbyggarspel med tyngd på Old World, bör designen börja med familjer, utnämningar, utbildning och personliga relationer som påverkar riket. CK3 kan ge djup åt personlighet, stress, arvsanspråk och minnen. Detta är ett designförslag, inte befintligt Open Historia-beteende.

## Observerat i källkoden

| Område | Källevidens | Betydelse |
|---|---|---|
| Teknik | `package.json`: React 19, Vite 7, Electron 44; ES-moduler | Ett nytt UI kan byggas som en React-panel; regelmotorn kan hållas i vanliga JavaScript-moduler. Versionerna avser manifestet, inte installerade beroenden. |
| Licens | `package.json:4` och `LICENSE` | Källan anger AGPL-3.0-or-later. Bevara licens och upphovsrätt; distribution och nätverkstillgänglig modifierad version kräver en egen licensgenomgång före lansering. |
| Spelkalender | `src/runtime/gameState.js:34`, `:3836`; `src/runtime/gameDates.js:1–13`, `:50`, `:115` | `gameDate`, `startDate`, `round`. Datum stöder f.Kr. och saknar år noll. Använd kalenderhjälparna, aldrig lexikografisk jämförelse eller direkt `new Date` på f.Kr.-strängar. |
| Världsmodell | `src/runtime/gameState.js:43`, `:3515`, `:3633–3637` | `world` normaliseras vid läsning och skrivning. `...nextWorld` bevarar extra fält, men nya delsystem bör få uttrycklig validering och migration. |
| Ledare | `src/runtime/countryStats.js:427`, `:481`; `src/Game/AI/gameplay.js:1627`; `src/Game/AI/gameplaySchemas.js:129` | Landets `stats.leader` är ett textfält. AI-instruktionen säger att död/avgång måste skriva efterträdaren där. Ett nytt system måste bestämma vem som har sista ordet om ledarskap. |
| Tidssteg | `src/Game/AI/gameplay.js:7651`, `:7841–7845` | `applySimulationResult` sätter `gameDate` till `result.stopDate` och ökar `round`. Funktionen används också när interaktiva scener avslutas. Ett anrop är alltså inte automatiskt ett år eller ens förfluten tid. |
| Händelseeffekter | `src/Game/AI/gameplay.js:7862–7872`; `src/runtime/gameState.js:4545` | Strukturerade händelseeffekter appliceras på världen. Berättelsetext är inte i sig en säker grund för mutation av karaktärer. |
| Skrivning | `src/Game/AI/gameplay.js:8480–8488`; `src/runtime/gameState.js:3971–3984` | Turresultat skriver handlingar, händelser, speldata, färger och värld. En fristående karaktärsskrivning under pågående tur riskerar att skrivas över. |
| UI | `src/Game/GameUI/main.jsx:218`, `:248`, `:518–543` | Huvud-HUD monterar datum, verktygsfält och paneler. Biblioteksstatus ger aktivt spel. En hov-/familjepanel hör hemma här. |
| UI-prenumeration | `src/runtime/useRuntimeState.js:8`; `src/runtime/runtimeStore.js:254` | Paneler kan prenumerera på en vald del av `world` och `game`, i stället för egen polling av hela JSON-filer. |
| Konkurrerande skrivningar | `src/Game/GameUI/actions.jsx:252–265`, `:280–282` | Befintliga kontroller spärras när simuleringen kör. Karaktärsbeslut behöver samma skydd och kontroll vid själva skrivningen. |
| Sparning | `server/libraryStore.js:2395–2398`; `src/runtime/library.js:490` | Hela `world` kan ersättas eller en `worldPatch` sammanfogas. Felaktig partiell skrivning kan förlora världsfält. |
| Export/import | `server/libraryStore.js:3649–3660`; `src/runtime/library.js:432–440`; `src/runtime/gameZip.js:68–115` | Spelbundlar exporterar tillståndsdokumenten. Ett karaktärsfält i `world` kan följa med, men roundtrip måste testas både för server- och webblagring. |
| Återställning | `src/Game/AI/gameplay.js:8511–8534` | Turens tidigare `world` ingår i rollback-snapshot. Personer och slumpstatus bör ingå i samma snapshot. |
| Gradvis avslöjande | `src/runtime/gameState.js:4082–4104`; `src/Game/AI/gameplay.js:8468–8474` | Spelaren får se en tidsförflyttning händelse för händelse. `viewAsSeen` återskapar den del som redan visats. En karaktärspanel får inte avslöja en framtida död eller efterträdare innan händelsen visas. |

Den negativa sökningen omfattade namn och centrala konstruktioner i `src/runtime` och `src/Game`, samt relevanta datamodeller och turn-kod. Den bevisar inte frånvaro av all berättande användning av familjer eller personer. Någon spelbar dynastimodell identifierades inte i denna avgränsning. Ingen `AGENTS.md` hittades i det klonade källträdet.

## Beslut som behövs före implementation

1. **Vem spelar man?** En stat med en följd av härskare, en familj som kan förlora makten, eller en enskild härskare som går vidare till arvinge? Old World-tyngdpunkten talar för staten som beständig spelidentitet, med en regerande familj och rivaliserande elitfamiljer.
2. **Tidsskala.** Open Historia tillåter varierande tidsförflyttningar. Ett årsbaserat personsystem måste definiera vad som händer vid ett hopp på en dag, tre månader eller femtio år. Födelsedagar, risker och ämbetstid får inte beräknas per UI-klick eller `round`.
3. **Regelauktoritet.** Rekommendationen är att kod avgör identitet, relationer, ålder, död, ämbeten och arv. AI kan föreslå händelser och formulera dialog, men måste använda validerade operationer mot existerande ID:n. Annars kan en genererad text återuppliva en person eller utse en andra härskare.
4. **Historisk förankring.** Ska ett scenario börja med verkliga antika personer och familjer eller originalpersoner? Ange vilka uppgifter som är historiska, genererade eller designade. Undvik att presentera syntetiska stamtavlor som historiska fakta.
5. **Samhällssystem.** Skilj monarki, republik, dynastiskt rike och valbara ämbeten. Ett kungligt primogeniturssystem bör inte styra varje antik stat. Även kvinnors och barns politiska handlingsutrymme behöver ett medvetet designval.
6. **Familjemakt.** Bestäm vilka materiella resurser familjer kontrollerar: städer, jord, armébefäl, prästerskap, ämbeten eller klientnätverk. Lojalitet blir intressant när missnöje kan omsättas i handling och när spelaren kan förstå orsaken.
7. **Synlig information.** Bestäm vad spelaren känner till om andra personers ambition, hemligheter och åsikter. Separera fakta från misstankar samt personens faktiska kunskap från AI-dialogens tillgängliga kontext.
8. **Minsta kompletta spelcykel.** Föreslagen första design: utnämn guvernör, ge en familj makt, hantera rivalens reaktion, utbilda arvinge, låt tiden gå, möt en succession som ändrar rikets förutsättningar. Fastställ först vilka CK3- och Old World-mekanismer som bär denna cykel.

## Föreslagna kontrakt att utreda

Detta är en designriktning, inte kod eller ett fastställt schema:

- Ett versionsmärkt `world.characterSystem` med person-ID:n, familje-ID:n, relationer, ämbeten, händelsejournal, vald efterträdarregel och reproducerbar slumpstatus.
- Ålder från födelsedatum och spelkalender. Döda personer finns kvar i släktträd och minnen men kan inte få nya ämbeten.
- Individuell åsikt om en annan person separerad från familjens förhållande till staten och från ämbetsinnehavarens lojalitet.
- Grundegenskaper, tillfälliga tillstånd och erfarna minnen som separata typer. Alla modifierare behöver källa, varaktighet och en begriplig UI-förklaring.
- Ett eventuellt dynastitidssteg kopplas till den kanoniska tidsförflyttningen och måste ge samma resultat vid retry, återställning och återspelning.
- Personers samhällseffekter kopplas till befintliga land-/stads-/militära system genom explicita operationer. En etikett om att guvernören är skicklig räcker inte som mekanik.

## Testkrav för en senare implementation

| Risk | Test som behövs |
|---|---|
| Ett tidssteg körs två gånger | Samma sparade förtillstånd, slutdatum och slumpfrö ger identiskt resultat; dubbelt applicerat tur-ID ger ingen extra ålder eller effekt. |
| Fel antik kalender | Ett år över f.Kr./e.Kr.-gränsen, skottdag, födelsedag och långa hopp ger rätt ålder. Inget år noll skapas. |
| Fel succession | Levande, behörig efterträdare väljs; minderårig, regent, tronpretendent och ingen arvinge får definierade utfall. |
| Trasigt släktträd | Självförälder, cykel, ogiltiga ID:n och otillåten partnerrelation avvisas; döda släktingar bevaras. |
| Dold framtid läcker | Panel och AI-kontext visar bara personer och förändringar som är kända vid det synliga datumet. |
| Sparning tappar data | Spara, exportera, importera, öppna på nytt och återställ tur bevarar personer, relationer, familjer, ämbeten och slumpstatus. |
| AI motsäger reglerna | Namnbyte, död och succession kan inte kringgå validering via `stats.leader` eller fri händelsetext. |
| Familjeeffekter är kosmetiska | Ett valt ämbete ändrar specificerade värden, familjereaktioner och tillgängliga beslut och visar orsaken. |
| UI förlorar beslut | En pågående Open Historia-tur blockerar eller serialiserar karaktärsbeslut; inga ändringar skrivs över av en äldre världssnapshot. |

Nästa steg är jämförelsen av CK3 och Old World och därefter en designspecifikation. Denna granskning är inte ett godkännande att börja implementera och gör inget anspråk på verifierad körning av den installerade appen.

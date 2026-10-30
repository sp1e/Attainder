# Integrationsplan: dynamiska karaktärer i Open Historia

Granskad 2026-10-30. Underlag: det lokala källträdet `open-historia`, commit `293a3b890142c734addd1dd0d1235995b3a43a6d`, samt rapporten `reports/open-historia-architecture.md`. Källträdet var rent vid kontrollen. Dokumentet beskriver föreslagna ändringar; ingen spelkod har ändrats och inga speltester har körts i denna granskning. Det installerade programmets binär har inte verifierats motsvara denna commit.

Alla sex kravpelare är obligatoriska. Etapperna nedan anger beroenden och byggordning. Ingen etapp gör familjepolitik, personlighetsstyrd AI, minnen eller något annat av kraven valfritt. Spelaren ska välja **rike** eller **familj** vid kampanjstart. Båda spelidentiteterna måste fungera innan hela omfattningen kan godkännas.

## Källkod som styr integrationsvalen

Sökvägarna avser den verifierade källkopian under `[local development path omitted]`.

| Verifierad krok | Vad koden gör | Konsekvens för karaktärssystemet |
|---|---|---|
| `src/runtime/gameState.js:3515`, `:3633` och `:3729` | Normaliserar världen vid läsning och skrivning; inkommande världsfält sprids men särskilda nya fält behöver uttrycklig hantering. | Lägg till en versionerad, uttryckligt validerad `world.characterSystem`. Enbart ett nytt standardfält är otillräckligt för migration och datakvalitet. |
| `src/runtime/gameState.js:2976` | `normalizeEventImpacts` bygger ett objekt med en uttrycklig lista av effektfält. | Nya `characterOps` måste normaliseras här. Annars försvinner de även om AI skickar dem. |
| `src/Game/AI/gameplaySchemas.js:992`, `:1019`, `:1039`, `:1080` | Tidssteg har flera schemavarianter. Händelsen använder ett effektschema och förbjuder okända fält. | Uppdatera kontraktet för generering, validering och lagrad händelse tillsammans. Ett prompttillägg räcker inte. |
| `src/Game/AI/gameplaySchemas.js:129` | AI kan ange `leader` som text i landets statistik. | När karaktärssystemet är aktivt ska detta bli en härledd visning från ämbetesinnehavaren, så att två olika auktoriteter inte kan skapa olika härskare. |
| `src/Game/AI/gameplay.js:7651`, `:7668`, `:7841`, `:12756` | `applySimulationResult` används både för tidshopp och interaktiva händelser; interaktiva resultat kan behålla samma datum medan `round` ökar. | Åldrande, graviditet, avklingning och dödsrisk ska följa datum. Antal anrop eller `round` är inte kalenderår. |
| `src/runtime/gameDates.js:3`, `:24`, `:51`, `:115`, `:123` | Datum stöder f.Kr., saknar år noll och har egna aritmetik- och jämförelsefunktioner. | Återanvänd kalenderhjälparna. Textsortering och direkt parsning av f.Kr.-strängar med JavaScript `Date` får inte styra livsförlopp. |
| `src/Game/AI/gameplay.js:7862`; `src/runtime/gameState.js:4545` | Godkända händelseeffekter appliceras på världen via den gemensamma effektfunktionen. | Anslut karaktärsreducern här, med samma regler för originaltillämpning, återspelning och förhandsvisning. |
| `src/runtime/gameState.js:4082`, `:4097`, `:4100`; `src/Game/AI/gameplay.js:8468` | Under successiv visning återskapas den synliga världen från föregående snapshot och redan visade händelser. | Dödsfall, arv, relationer och framtida minnen måste kunna återspelas i rätt ordning. UI och AI-samtal får inte läsa slutläget i förväg. |
| `src/runtime/gameState.js:4115`, `:4118` | Om snapshot saknas kan den befintliga visningsvägen falla tillbaka till den färdiga världen. | Ny karaktärsvisning behöver ett säkert alternativ vid saknad snapshot. Den får inte avslöja en kommande död eller ännu okänd familjehemlighet. |
| `src/Game/AI/gameplay.js:4569`, `:4581`, `:8466` | Det finns redan skydd för pågående simulering och byte av aktiv kampanj. | Integrera nya kommandon med dessa skydd. Lägg inte en oberoende muterande UI-väg vid sidan av dem. |
| `src/Game/AI/gameplay.js:8480`, `:8488`, `:8515` | Flera tillståndsfiler skrivs separat; rollback-snapshot fångas efter huvudskrivningen och beskrivs som best effort. | En karaktärstransaktion måste hantera delvis misslyckad lagring och få tillräcklig återställningsinformation innan första ändringen. Befintlig flerfilsskrivning är inte bevis för atomisk lagring. |
| `src/runtime/gameState.js:3971`; `server/libraryStore.js:2395` | Klienten skriver normaliserad värld; serverns uppdatering kan ersätta hela världen eller sammanfoga en patch. | En ny panel får inte skriva en gammal kopia av hela världen efter ett tidshopp. Mutationer behöver gemensam kö och kontroll av kampanj samt revision. |
| `server/libraryStore.js:3649`, `:3749`, `:3797`; `src/runtime/web/libraryStore.js:1534`, `:1615` | Server och webblagring har skilda export-/importimplementationer. | Testa migrations- och exportkontrakt i båda lagringsvägarna. Att ett världsfält överlever en vanlig lokal save bevisar inte att import fungerar. |
| `src/runtime/useRuntimeState.js:8`; `src/runtime/runtimeStore.js:254`; `src/Game/GameUI/actions.jsx:258` | UI har selektiva prenumerationer och kontroller för pågående simulering. | Använd samma runtimeflöde för hov, familjer och arv. Prenumeration på rå värld måste kompletteras med vad spelaren får se. |

Rapportens arkitekturbeskrivning stämmer med dessa kontroller. Granskningen är avsiktligt avgränsad till integrationspunkter; den är ingen fullständig revision av hela Open Historia.

## Tillstånd och auktoritet

`world.characterSystem` bör innehålla stabila identiteter för personer, familjer, religiösa samfund, ämbeten, relationsorsaker, minnen och berättelseförlopp. Världsfältets schemaversion, kampanjens regelversion och dokumenterad inspirationskälla är tre skilda saker. En ändrad Old World-regel får inte i sig migrera spelreglerna i en pågående kampanj.

Den beständiga modellen behöver minst följande:

- `schemaVersion` och `rulesetVersion`, samt aktiveringsläge för scenariot.
- Personer med födelsedatum, dödsstatus, egenskaper, färdigheter, mål och stress. Ålder härleds ur datum; den får inte ha ett konkurrerande fristående tickvärde.
- Familjer med tillgångar, rättigheter, medlemmar och överhuvud. Familjens fortsatta maktbas lagras separat från medlemmarnas ämbeten.
- Ämbeten, innehav, behörighetsregler och historik. En person, familj, stat och titel är olika identiteter.
- Relationer med riktning och orsak; personens åsikt, familjens stöd, religiöst stöd och faktisk lydnad ska kunna skilja sig åt.
- Kausala minnen med deltagare, händelseursprung, datum, kännedom och giltighet; berättelseförlopp med rollbindningar, steg och villkor.
- Operationers id, datum och ursprung; aktuell revision, redan tillämpade operationer, deterministiskt slumpfrö/tillstånd och senaste bearbetade datum.
- Kampanjidentitet: valt spelläge, förankrad familj eller stat och eventuell aktiv person. Aktiv ledare och aktuellt rike kan förändras utan att spelaridentiteten skrivs om av misstag.

Spelmotorn avgör vilka övergångar som är tillåtna. AI kan föreslå handlingar och formulera berättelsen utifrån godkända resultat. Ett AI-förslag om mord, utnämning, avsättning eller arv måste passera samma kostnader, kunskapskrav och regler som övriga handlingar. Fri berättelsetext får inte ensam flytta ämbeten, skapa arvingar eller ändra personers existens.

`countryStats[polity].leader` blir en kompatibilitetsprojektion när systemet är aktivt. Import av äldre textledare kräver en avgränsad bootstrapregel: skapa en stabil personreferens en gång, märk osäkra biografiska uppgifter och gissa inte en hel historisk släkt. Scenarier utan karaktärssystem behåller uttryckligen sitt befintliga kontrakt.

## Föreslagna modulgränser

Modulnamnen här är förslag, inte filer som redan finns.

| Modul | Ansvar | Får inte göra |
|---|---|---|
| `characters/model.js` och `migration.js` | Datamodell, referensintegritet och migration mellan namngivna versioner. | Slumpa dödsfall eller skapa nya minnen vid vanlig läsning. |
| `characters/commands.js` | Kommandovalidering, aktörens befogenheter, förväntad revision och idempotensnyckel. | Ge familjeläget statens alla befogenheter efter tronförlust. |
| `characters/reducer.js` | Ren tillämpning av godkända operationer med atomiska domänövergångar. | Göra nätverksanrop, läsa systemklockan eller skriva filer. |
| `characters/calendar.js` | Livsförlopp och tidsgränser med `gameDates` och sparad slump. | Tolka en UI-uppdatering eller en interaktiv dialog som ett passerat år. |
| `characters/personality.js` och `decisions.js` | Tillåtna val, stresskostnad och förklarbar AI-prioritering utifrån personlighet, resurser, hot och mål. | Låta en personlighetsvikt göra en förbjuden handling tillåten. |
| `characters/opinion.js` | Skilda åsikts- och stödkanaler, orsaker och avklingning. | Kopiera en persons åsikt som hela familjens eller religionens samlade inställning. |
| `characters/memory.js` och `stories.js` | Minnesreferenser, deltagarurval, villkor, steg, avbrott och konsekvenser. | Dra in en avliden eller otillgänglig deltagare i en ny levande roll utan uttrycklig regel. |
| `characters/offices.js` och `succession.js` | Tillträde, avsättning, död, familjeledning, förmögenhetsarv och ämbetssuccession som separata övergångar. | Låta alla dessa övergångar automatiskt följa samma arvinge. |
| `characters/worldEffects.js` | Härledda effekter på ekonomi, förvaltning, städer, regioner, enheter och tillgängliga handlingar. | Återapplicera permanenta bonusar vid varje rendering eller läsa den egna bonusen som nytt basvärde. |
| `characters/presentation.js` | Synlighetsfiltrering och förklaringar för UI, rådgivare och AI-prompter. | Lämna ut framtida händelser, okända minnen eller hemliga planer. |
| Adapter mot befintlig simulation och lagring | Översätter händelser till operationer, köar skrivning, kontrollerar revision och bevarar rollback. | Skapa ett andra oberoende speluniversum i en separat webbrutt. |

De rena reglerna kan testas utan en betalande AI-tjänst. Enskilda modulbeslut ska hållas små; `gameplay.js` är integrationspunkt, inte plats för all ny domänlogik.

## Ordning vid en spelhändelse

1. Läs kampanj-id, revision, kalenderläge, spelaridentitet och ett sammanhängande tillstånd. Bestäm aktörens befogenheter och kännedom.
2. Planera livsförloppshändelser fram till det begärda datumet. Använd samma datumgränser och sparade slumputfall vid återförsök. Ett långt hopp måste kunna brytas av en död eller ett avgörande arv mitt i perioden.
3. Validera föreslagna operationer och kontrollera deras orsaker. Ordna dem kronologiskt med en dokumenterad ordning för samtidiga händelser.
4. Tillämpa varje godkänd domänövergång. Ett dödsfall avslutar personbundna förmågor och ämbetsinnehav, skapar relevanta minnen och initierar separata arv-/successionövergångar i samma transaktion. Den nya härskarens påverkan gäller från sitt tillträde, inte retroaktivt över hela hoppet.
5. Beräkna effekter på den befintliga världen från identifierbara källor. En stads bonus ska kunna spåras till exempelvis ämbete, person och familjestöd; samma bonus får inte räknas flera gånger.
6. Skapa daterade händelser med återspelbara `characterOps`, inklusive tysta men nödvändiga kalenderövergångar. Bevara kopplingar mellan operation, minne och offentlig händelse. Berättelsetext beskriver den tillämpade övergången.
7. Kontrollera kampanj och revision igen. Spara med gemensam skrivordning och förberedd återställning. Om basen har ändrats ska kommandot omprövas eller avbrytas tydligt; en gammal världskopia får inte skriva över nyare beslut.
8. Visa händelser genom den befintliga successiva visningen. Återspelning använder samma reducer och färdiga slumputfall. Den konsumerar inte ny slump och får inte orsaka ytterligare lagring eller nya händelser.

Den kvarvarande tidssträckan efter sista berättade händelsen behöver också hanteras. En ledare får inte stanna i fel ålder bara för att inga dramatiska kort genererades. Om ett dolt kanoniskt tillstånd redan ligger efter visningsdatumet måste presentationen ändå kunna beräkna ett sammanhängande, tidigare tillstånd.

## Rikesläge och familjeläge

Rikesläget förankras i statens identitet. Ett dynastibyte ändrar ledarskap och politik men avslutar normalt inte spelarens kontroll över staten. Spelaren måste ändå följa den aktiva ledarens personliga kostnader och institutionernas begränsningar enligt regelverket.

Familjeläget förankras i familjens identitet. Förlorad tron, avsatt guvernör och förlust av territorium är olika situationer. Familjen kan fortsätta genom sina kvarvarande tillgångar, personer, äktenskap, anspråk, inflytande, klienter och lagliga ämbetsvägar. Kommandots rättigheter beräknas från den faktiska positionen; en landlös familj får exempelvis inte utfärda rikets militära order.

Landlös fortsättning kräver verkliga spelhandlingar, kostnader och motparter. En informationsruta om familjens namn efter att alla användbara kontroller försvunnit uppfyller inte kravet. Acceptansen behöver visa att familjen kan förlora härskarmakten, fortsätta fatta meningsfulla beslut och återvinna ett ämbete utan att kampanjen byts till en annan familj.

## Byggordning med slutkrav

| Etapp | Leverans | Godkännandekrav innan nästa beroende byggs |
|---|---|---|
| 1. Kontrakt och sparformat | Stabil identitet, versionsfält, datum, command/operation-format, kampanjval och bootstrap för äldre save. | Gamla save migreras deterministiskt; okända framtida versioner skrivs inte sönder; båda spelaridentiteterna överlever export/import. |
| 2. Gemensam tillämpning och synlighet | Reducer, idempotens, transaktionsgräns, revisionskontroll, reveal och rollback. | Dubbelt retry ger samma värld; återspelning läcker ingen framtid; partiellt skrivfel lämnar ingen blandning av gammal härskare och nytt arv. |
| 3. Ett integrerat generationsskifte | Livsförlopp, personbundna förmågor, arv, ämbetsbyte och verkliga strategiändringar. | Ett daterat dödsfall mitt i ett hopp ändrar möjliga handlingar och effekter från rätt datum, i ordinarie spelvy och save. |
| 4. Personlighet och politiska intressen | Stress, mål, beslutande AI, personliga relationer, familje-/religionsstöd och världseffekter. | Samma kompetens med annan personlighet ger meningsfullt olika beslut; en utnämning påverkar politiken och verklig förvaltning eller militär. |
| 5. Minnen och berättelseförlopp | Minnesorsaker, rollurval, återkommande konsekvenser, konflikter och kunskapsfiltrering. | Ett tidigt val återkommer som en giltig konsekvens senare och kan förklara en relation eller ett AI-beslut. |
| 6. Båda kampanjernas fulla kretslopp | Hov-/familjevy, rådgivare, tydliga valkostnader, dynastibyte i rikesläge och landlös fortsättning i familjeläge. | Båda lägen genomlever generationsskifte och politisk förlust med rätt kontroll. Samtliga sex kravpelare visas tillsammans. |
| 7. Full acceptans och balans | Fler generationsförlopp, lagringsparitet, felprov, prestanda och dokumenterade regelkällor. | Alla krav nedan är uppfyllda; kvarvarande balansval skiljs från tekniska fel och från ännu saknad funktion. |

En fristående prototyp kan avlasta risk i etapp 1–2. Den räknas inte som den integrerade första spelbara leveransen: kartan, tillgängliga order, ekonomin, AI:s beslut, kampanjens sparfiler och de ordinarie händelserna måste påverkas av samma karaktärstillstånd.

## Acceptans som täcker samtliga sex kravpelare

| Kravpelare | Bevis som krävs | Negativt fall som också ska prövas |
|---|---|---|
| 1. Karaktärer ändrar strategi | Två efterföljande härskare ger olika tillåtna handlingar och mätbara världseffekter. Förmågor löper ut vid död/avgång enligt deras källa. | Den döde härskarens förmåga kan inte användas genom en gammal knapp, köad order eller laddad save. |
| 2. Personlighet påverkar AI och spelare | Kontrollerat scenario med lika resurser och färdigheter men olika personlighet ger olika prioritering, begriplig motivering och stresskostnad. | Personlighet får inte kringgå resurskrav, göra självmordsbeslut automatiska eller låta dialogretry ge gratis stresslindring. |
| 3. Person, familj och religion skiljs åt | En guvernör kan personligen gilla härskaren samtidigt som familjen är missnöjd. Förändringar når en verklig stad, region, ekonomi eller enhet genom dokumenterade regler. | Personens död raderar inte familjens tillgångar; personligt plusstöd kopieras inte automatiskt till alla grupper. |
| 4. Minnen får senare konsekvenser | Ett svek sparas med deltagare och orsak; det kan senare ändra en relation, ett giltigt eventval och ett AI-beslut efter omstart/import. | Avliden roll, glömt/ogiltigt minne eller okänd hemlighet får inte användas som om den vore aktuell och känd. |
| 5. Ämbete, familjemakt och arv separeras | Avsätt en guvernör utan att radera familjens makt. Dela ämbetssuccession, familjeledning och egendomsarv. Spela vidare som samma familj efter tronförlust. | Den avsatta personen behåller inte ämbetets orderrätt; familjeläget får inte tyst övergå till den nya härskarens familj. |
| 6. Versioner och källor hanteras | Varje antagen inspirationsregel har källa, datum/version, eventuell DLC-koppling och markerad egen anpassning. Kampanjen kan identifiera sin regelversion. | En gammal regel om guvernörsutnämning får inte införas av misstag; en presentationsfunktion får inte beskrivas som en ny simuleringsmotor. Ny källinformation ändrar inte pågående save utan uttrycklig migration. |

Kravpelare 6 är ett forsknings- och kvalitetskrav. Det behöver inte bli en teknisk kontrollpanel för spelaren. Spelaren behöver däremot kunna förstå vilka spelregler den aktuella kampanjen använder.

## Tekniska testgrindar

Följande är föreslagna testkrav, inte uppmätta resultat:

- **Replay och retry:** identiska startdata, operationer och seed ger identiskt resultat. Samma `operationId` två gånger ger ingen extra effekt. Ett återförsök efter avbruten skrivning skapar varken tvillingar, dubbelt arv eller nya slumpresultat. Laddning och normalisering muterar inte världen.
- **Antik kalender:** åldrande, cooldown och minnesavklingning fungerar över f.Kr.-år, skottår och övergången `-0001-12-31` till `0001-01-01`. Ingen föds eller åldras i ett år noll. Dialog på samma datum ger noll förfluten tid.
- **Tidshopp:** ett långt hopp som passerar flera relevanta datum får samma resultat som motsvarande uppdelning när inputs är lika. En död mitt i perioden delar effekterna före och efter successionen. Denna egenskap måste definieras för slumpdrag och AI-beslut; fria nygenererade berättelser kan inte förväntas vara byteidentiska.
- **Migration och lagring:** äldre save, nuvarande save och okänd framtida version prövas. JSON-rundtur, serverexport/import, webblagring, zip och rollback bevarar identiteter, operationer, minnen, hemligheter och slump. Upprepad migration är idempotent.
- **AI-auktoritet:** ogiltiga personreferenser, omöjliga släktskapsförändringar, förbjuden order, negativ kostnad och direkt ändring av härskarnamn avvisas med begriplig orsak. Godkända operationer och berättelsetext stämmer överens.
- **Successiv visning:** innan dödskortet visas är efterträdaren inte redan härskare i hovet, familjeträdet, statistiken eller rådgivarens prompt. Efter kortet är alla vyer överens. Saknad snapshot och omladdning mitt i visningen måste prövas särskilt.
- **Samtidighet:** en utnämning under pågående generation, byte av kampanj, dubbla klick och försenat AI-svar får inte skriva över en nyare värld. Gör felprov mellan separata filskrivningar och kontrollera återställning.
- **Ägande och modifierare:** upprepade renderingar och omladdningar ökar inte bonusarna. Byte av ämbete tar bort den gamla källans effekt exakt en gång. En annan familjs egendom och en annan stats trupper kan inte styras genom ett namnbyte eller gammal referens.
- **Spelbarhet och kostnad:** förklaringar visar vem som reagerade och varför. UI håller sig användbart med flera generationers döda personer och minnen. Föråldrad kontext gallras för promptstorlek utan att beständig historia eller juridiskt relevanta anspråk går förlorade.

Det finns redan relevanta testsviter att bygga vidare på: `server/gameDates.test.js`, `server/gameplaySchemas.test.js`, `src/runtime/gameState.interactiveEvents.test.js`, `src/runtime/gameState.ledgers.test.js`, `src/runtime/unseenEvents.test.js`, `src/runtime/campaignGuard.test.js`, `src/runtime/web/libraryStore.test.js` och `src/runtime/web/writeQueue.test.js`. Deras existens har verifierats; resultat har inte kontrollerats i denna designgranskning.

När implementation finns bör riktade tester köras per förändrat kontrakt, följt av projektets befintliga test- och byggkommandon inför sammanfogning. Separata lagringsvägar och full generationsväxling i ordinarie UI behöver integrationsprov; enbart gröna reducer-tester visar inte att användarens spel fungerar.

## Bedömning

Open Historia har användbara krokar för världstillstånd, daterade händelser, AI-kontrakt, återspelning och UI. Den stora risken är att karaktärer läggs till som text eller en sidovy medan tidslinjen och kartan fortsätter besluta självständigt. Den föreslagna gränsen är därför ett beständigt regelsystem som matar den befintliga simuleringen, lagringen och presentationen.

Den första integrerade demonstrationen bör vara ett antikt rike där en utnämning förbättrar en provins, missgynnar en familj, skapar ett minne och bidrar till en senare tronkonflikt. Härskarens död ska ändra strategierna. Samma förlopp ska kunna spelas både som riket som får en ny dynasti och som den avsatta familjen som fortsätter genom sina egna resurser och rättigheter. Det ger ett granskbart bevis på hur alla system samverkar, utan att begränsa den slutliga omfattningen till demonstrationen.

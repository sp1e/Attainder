> Archived design input, 31 October 2026. See the current character-capacity and event-chains documents for implemented behavior and remaining acceptance work.

# Implementationsplan: tillfällig vuxenoförmåga

Plan till Main, 2026-10-31. Ingen implementation av vuxenoförmåga har påbörjats.

Utgångspunkt: `adult-incapacity-proposal.md` i samma katalog, inklusive Main-godkända D1–D3. Kodreferenser avser HEAD `0edd4d8e5dbc868346b1a2626eb985069c02ea6d` med den frysta authorityfixen i arbetskopian. Den fixen är ännu under review. Planen måste stämmas av mot dess slutliga commit före start. Reviewfynd i authorityfixen har företräde framför detta arbete.

## Leveransgräns och genomförandeordning

Första leveransen omfattar vuxen familjeledning och härskarämbetet. Behåll befintlig succession, gemensamt ägande och porträttatlas. Lägg inte till en ny konflikt om vuxenregentens avgång. Ändra inte guvernörs- eller generalsämbetets representation; deras befintliga sjukdomseffekter består.

1. Main slutför review, commit och synkning av authorityfixen. Verifiera ny bas och filägarskap. Läs inga verkliga sparfiler.
2. Skriv röda tester för ren hälsofråga, episoder och migration. Implementera dessa moduler utan UI.
3. Skriv gräns- och kommandotester. Anslut kalender, behörighet och ekonomiska aktörer. Testa de befintliga authorityregressionerna efter integrationen.
4. Anslut presentation och UI med syntetiska fixtures. Verifiera ljus/mörk vy, smal bredd, tangentbord och kalender utan frisk företrädare.
5. Frys för kravreview följd av kodreview. Kör fullsuite/build först enligt Mains samordning. Main äger commit och synkning.

## Föreslagna modulgränser

| Modul | Ansvar och avgränsning |
| --- | --- |
| `health.js` | Exportera en ren fråga som returnerar kvalificerande condition-id:n vid ett datum. Ingen mandatmutation eller import från `index.js`. |
| Ny `mandateAuthority.js` | Rena frågor om principal, kunglig/familjeanknuten företrädare, kandidatbehörighet och blockeringsorsak. Flytta authorityfixens rena executive- och mandatval hit i samma förändring som integrationen; behåll publika index-API:er. |
| Ny `mandateEpisodes.js` | Versionsaktivering, episodreferenser, övergångsplanering och validering. Planera först från ett gemensamt tillstånd; applicera sedan. Importera inte `index.js`. |
| `governance.js` | Behåll kungliga anspråk och befintliga vetoregler. Delegera episodövergångar till den nya modulen. Engångssamtycke verifierar mandat, episod och aktuell regent. |
| `index.js` | Anropa sammanhållna hjälpare vid befintliga entrypoints. Behåll orkestrering, vanlig död/succession och transaktionskopiering. Undvik ytterligare långa specialgrenar. |
| `CharactersPanel.jsx` | Visa nominell innehavare, aktuellt ombud och mandatets orsak separat. Hantera frånvarande ombud utan att låtsas att den sjuke kan agera. |
| `CONTRACT.md` och fokuserade tester | Dokumentera versionsgräns, D1–D3 och betalningsrätt. UI-evidens sparas under lokala reports. |

Föreslagna filnamn är implementationsval, inte redan godkända nya produktionsfiler. Main behöver fastställa filägarskapet före start. Flytten av rena funktioner måste bevara authorityfixens tester och publika anrop. Gör inte en samtidig allmän omskrivning av `index.js`.

## 1. Ren tillstånds- och behörighetsfråga

Föreslaget API: `getIncapacityCauses(person, date)` returnerar sorterade condition-id:n för levande vuxnas severity-3 `fever`, `smallpox` eller `injury` i `active` eller `recovering`. Ålder beräknas med befintliga spelkalenderfunktioner. `adult` fortsätter betyda ålder och livsstatus. Severity 1–2, sorg, stress, ärr och ett lågt generellt hälsotal aktiverar inte regeln.

Källor för historiskt stadium ska följa befintlig condition-historik. Frågan får inte dra slump, ändra condition eller skapa mandat. Presentationsanrop får aldrig avancera en sjukdom.

En gemensam `describeMandateAuthority(state, mandateId)` bör returnera minst `principalId`, `representativeId`, `phase`, `episodeId`, `causeConditionIds`, `canExercise` och `blockedReason`. Kungligt och familjens mandat får varsin beskrivning. `representativeId` kan vara null. Frånvaro ska inte tolkas som död eller förlust av riket.

Behåll skillnaden mellan en ren beskrivning av vem som vore behörig och ett sparat, etablerat mandat. En fråga får inte återanvända ett gammalt grant medan beskrivningen redan har valt en ny regent. Normalisering och kommandoentrypoint måste först säkerställa en sammanhängande sparad representation enligt nästa avsnitt.

## 2. Record, episod och D1–D3

Behåll nycklarna `family:<id>` och `office:ruler`. Föreslagen ny fas är `incapacity`. Komplettera record med stabil `episodeId`, `causeConditionIds` och den regent som grants avser. Behåll huvudpersonen som principal. Tillåt uttryckligen ett aktivt oförmågetillstånd med `regentId: null` när ingen kandidat finns, med validerad blockeringsorsak. Befintlig validator måste ändras; dagens active-record kräver levande regent.

Föreslagen episodidentitet är mandat-id, öppningsdatum och en separat monoton authority-räknare. Använd inte gameplay-RNG, hälsans RNG eller eventsekvens. Samma normaliserade data ska alltid få samma identitet. Återinsjuknande efter ett avslut skapar ny episod, även om datumet är detsamma. Överlappande orsaker behåller samma episod medan minst en kvalificerande orsak återstår.

Grants och `requestAfter` binds till episoden och tjänstgörande regent. Regentbyte tömmer deras aktiva verkan även när huvudpersonens sjukdomsepisod fortsätter. Återhämtning avslutar episoden. Spara tidigare orsak i faktisk övergångshistorik/logg när tiden går; migration får inte skapa en sådan historisk händelse.

**D1:** Ett minority-record får inte bytas till incapacity på myndighetsdagen. Om huvudpersonen då är svårt sjuk behåll minority-episoden, grants och cooldowns, så länge regenten är oförändrad. Visa att överlämningen väntar på återhämtning. När personen är vuxen och frisk prövas befintlig ordinarie överlämning/contestation en gång. Regentbyte invalidierar samtycken även under uppskjuten överlämning. Ett redan contested-record förblir contested genom sjukdom och tillfrisknande; sjukdom får inte bli en genväg till fullmakt.

**D2:** Välj kvalificerade vuxna från huvudpersonens familj först och därefter genom deterministisk fallback, med ålder/datum och person-id som stabil ordning. Ny vuxenregent för kungligt mandat måste tillhöra en familj som inte är i exil. Familjens eget exilhushåll får ge familjeregent. Extern familjefallback måste vara en frisk vuxen från en familj som inte är i exil. Uteslut principal och svårt sjuka kandidater före sortering. En kandidat får inte godkännas därför att kandidatens egen regent skulle kunna representera den: pröva den fysiska personen direkt, utan rekursion.

**D3:** Under migration bevaras gamla grants endast för samma oförändrade minority-principal, mandat och regent. Ge dem deterministisk koppling till det bevarade recordet. Flytta dem aldrig till en ny incapacity-episod. Felaktiga referenser avvisas i stället för att omtolkas som samtycke.

**Bedömningspunkt för Main före implementation:** D2 kräver att en redan tjänstgörande svårt sjuk regent ersätts även när principal är minderårig. Det är en snäv ändring av befintlig minority-behörighet. Föreslaget beslut är att tillämpa friskhetskravet på den tjänstgörande personen, men inte retroaktivt avsätta en frisk minority-regent på grund av de nya exilreglerna. En bred omprövning av äldre minority-kandidatregler ingår inte. Föreslå ingen dold migration av deras politiska tillträde.

## 3. Aktivering och första ordern

Föreslagna statefält: `authorityVersion: 1`, `authorityActivatedAt` och `authoritySequence`. Unknown framtida feature-version ska avvisas. Aktivera gamla sparfiler på deras sparade `date`; rekonstruera ingen föregående sjukdomsperiod.

Normalisering ska kopiera indata, etablera hälsodefaults och validera relevanta person-/conditionreferenser före mandataktivering. Därefter fylls feature-defaults och härledd aktuell representation deterministiskt. Spara aktiveringens datum och record utan nya events, memories, kostnader eller förändrad RNG. Kör vanlig referensvalidering igen. Normalisering två gånger ska ge identiskt resultat och lämna originalet orört.

Lita inte på att alla anrop går via laddaren. `executeCharacterCommand`, hostövergångar och kalenderentrypoint behöver samma versions-/representationsförberedelse på sin transaktionskopia före behörighetskontroll. Ett gammalt tillstånd med svårt sjuk vuxen får inte utföra sin första order med gammal fullmakt. Om ordern misslyckas returneras originalet enligt dagens atomiska kontrakt; ingen halv migration får läcka ut. Nästa försök ska ändå göra samma förberedelse och samma kontroll.

Presentations- och hostfrågor som kan få rå äldre state ska använda en normaliserad kopia eller en ren effektiv beskrivning som säkert vägrar stale authority. De får inte ändra anroparens state. Ingen kostnad för ett framtida beslut hör hemma i normaliseringen.

## 4. Kalendergränser och byte av ombud

Nuvarande integrationspunkter i frysta `index.js`: `refreshMandates` omkring rad 145, `annualStep` omkring 541 och `advanceCharacters` omkring 565. `getNextCharacterTransitionDate` tar redan hälsogränser, men behöver dessutom exakt myndighetsdatum för relevant minor-principal. Använd spelkalendern även över BCE/CE; undvik antaganden om 365-dagarsår.

På varje verklig gräns: avancera hälsan, samla och behandla samtidiga dödsfall genom befintlig pipeline, och synkronisera mandat före någon AI, order eller berättelse som kan utöva makt. Vid årsgräns behövs synkronisering igen efter den nya sjukdomsdebuten och före `aiAnnual`. Födelsedatum och läkning på samma datum ska bedömas från det slutliga levande hälsotillståndet. En första övergång får inte logga att en person återtar makt om personen också dör vid samma gräns.

Episodplaneringen ska bedöma båda mandaten från samma snapshot. Applicera planerna efter kandidatvalet så att bearbetningsordningen family/office inte påverkar vem som väljs. De två mandaten får välja samma friska person men ska fortfarande ha skilda grants och avslut.

Om den äldsta familjemedlemmen/regenten blir svårt sjuk väljs nästa kvalificerade person direkt. Ingen representation följer en kedja av andra representationer. Om alla kandidater saknas: `canExercise: false`, representant null, tydligt skäl och oförändrad `status.ended: false` så länge familj/rike i övrigt lever. Tid kan fortfarande gå fram till nästa hälsogräns, där en frisk kandidat eller återhämtad principal kan återställa mandatet.

## 5. Kommandon, ekonomiska aktörer och effekter

Den frysta fixens `realmExecutive`, `royalDecisionReason`, royal-record och engångssamtycke är utgångspunkten. Års-AI och observer/advocate ska använda den nya förmågekontrollen genom samma authoritybeskrivning. En svårt sjuk NPC ska inte själv utföra de beslut som kräver tjänsteförmåga. Behåll möjligheten att kroppen återhämtar sig genom hälsokalendern.

`activeRepresentative` och `charge` använder i dag en enda actor, medan `controlledFamily` bestämmer ägaren separat. Vuxenoförmåga behöver uttrycklig aktör per beslutsscope: kungligt beslut använder kunglig executive, hushållsbeslut använder principalens behöriga familjeföreträdare. En utomstående kunglig regent får inte genom royal-record ensam debitera härskarens familjekassa, ge bort dess egendom eller adoptera för dess räkning. Om samma person också har giltigt familjemandat är det det andra mandatet som ger privat betalningsrätt.

Föreslå en intern `resolveActionAuthority(state, scope)` som returnerar actor och betalningsägare tillsammans. Låt kommandon ange public, household eller personal utan att UI kan välja en annan plånbok. Vårdbeslut för den sjuke använder rätt hushållsmandat. Generisk `rest` påverkar den visade handlande personen, inte automatiskt principalen; presentationen måste namnge vem varje åtgärd gäller. Före varje debit kontrolleras giltigt mandat och betalarens saldo.

Varken crown/holderId, lawfulRulerId, family.headId eller kampanjidentitet byts för sjukdom eller friskförklaring. Ingen arvstransaktion och ingen flytt av personlig/familjens/statens egendom får inträffa. Död ska fortfarande använda normal samlad dödsfalls- och successionspipeline.

För projekt: behåll ownerId, status och dueAt. Använd en ren effektfråga som avgör om den aktuella mandatexecutiven får utöva projektets personliga bonus. Markera inte principalens projekt permanent `ended` vid sjukdom. Vid friskförklaring återkommer bara fortfarande giltiga bonusar; principal och regent får inte ge samma bonus samtidigt. Offentlig byggnation och familjeegendom behåller sina tidplaner. Befintlig `suspendPersonalProjects` avslutar projekt och får därför inte återanvändas som tillfällig sjukdomspaus.

## 6. Presentation och minsta UI-integration

Utöka governancepresentationen med orsak, aktörsscope och blockeringsskäl. Visa ett separat namn/porträtt för principal och regent. `CharactersPanel.jsx:196` har för närvarande bara minority/övrig-fas-text och behöver ett explicit incapacity-fall. Dess fallback omkring rad 126 från representative till ruler får inte visa den sjuke som handlingsförmögen när inget ombud finns.

Handlingslistan ska tåla null-actor innan någon arketyp/skill läses. Visa otillgängliga handlingar med orsaken och behåll relevanta kostnadsfria uppskov. Visa inte dolda sjukdomsutfall eller ett garanterat återhämtningsdatum. För legacyaktivering räcker aktuell text om att någon företräder personen på grund av pågående sjukdom; lägg ingen påhittad historikhändelse i loggen.

Panelens tidsknapp omkring rad 350 är nu spärrad av busy eller ended, inte av mandat. Behåll det. Kontrollera dessutom hostens tidsväg och att kommandospärr inte spiller över till kalendern. Knappen heter för närvarande ”Nästa år med modellen”: QA ska mocka den befintliga modelladaptern lokalt, inte starta en betald modell eller tjänst. Om ytterligare runtime-/UI-filer behövs för säker null-hantering ska Main ge filägarskap före ändring.

Porträtt följer befintlig health-historik: samma principalidentitet under akut sjukdom, återhämtning och kvarstående ärr. Regentens porträtt är dess eget. Endast verklig död fryser dödsutseende.

## Meningsfulla testgrupper

| Grupp | Fall och beviskrav |
| --- | --- |
| Ren fråga | Varje kvalificerande kind/stage, severity 2 som negativt fall, ärr/sorg, död principal, exakt 18-årsgräns. Upprepade frågor muterar inget. |
| Kandidater och D2 | Frisk yngre efter sjuk äldsta; först egen familj; kunglig exilspärr; familjens egen exil tillåten; extern exilfallback nekad. Inga självval eller representationscykler. Separat test för Mains avgränsade minority-beslut. |
| Episode och D1 | Minor blir vuxen under sjukdom; inga nya grants/cooldownreset. Återhämtning prövar normal överlämning en gång. Contested överlever sjukdom. Två samtidiga sjukdomar behåller episoden; återfall skapar ny. |
| Grants och D3 | Samma legacy-minority/regent behåller giltigt grant. Regentbyte, ny incapacity-episod och återfall får inget gammalt samtycke. Misslyckande förbrukar inget; lyckad match exakt ett; utgångsdatum respekteras. |
| Migration och stale order | Normalize två gånger, oförändrat original/RNG/logg/saldon. Första direkta kommando på äldre sjuk state får rätt blockeringsbeslut. Aktiv null-regent roundtrip. Ogiltiga condition-/personreferenser och framtida version avvisas. |
| Gränser | Delårsläkning utan död, årsdebut före AI, myndighetsdag, samma-datum-död och återhämtning. Jämför långt hopp, månadshopp och JSON-resume inklusive episode/grants och ordnad händelselogg. |
| Inget ombud | Både mandates saknar frisk kandidat; ingen otillåten order, ingen game over. Framflyttad tid kan återställa principal. Presentation/åtgärder/host-nullhantering kastar inte. |
| Kontroll och ägande | Rikesläge, egen familj, annan spelarfamilj, extern royal regent och split household guardian. Samma royal veto i relevanta lägen. Ingen oavsiktlig förändring av innehavare, rättsligt anspråk eller ägare. Privat debit kräver eget familjemandat. |
| NPC och berättelser | Alla authorityfixens regressioner återkörs. Sjuk principal kan inte styra NPC-beslut; frisk regent gör det. Observer/advocate/legacy har samma veto och atomiska debit. Gratis uppskov bevarar giltiga ärenden. |
| Projekt | Bonus inaktiv under rätt period, återkommer bara före ursprunglig sluttid. Ingen dubbel bonus, permanent avslut eller förlängd offentlig byggtid. |
| UI och porträtt | Isolerade fixtures i båda teman och smal vy. Tangentbord når tid trots blockerade order. Tydliga två personer, rätt namn på åtgärdens actor, ärr består och ingen falsk dödsmarkering. |

Verifieringsordning: små rena tester först, därefter episod/kommando, sedan befintliga governance-, health-, successionForecast- och characterWorld-regressioner. Riktad lint efter ändring. UI-fixtures sist när presentationen är stabil. Fullsuite/build och båda oberoende reviews samordnas av Main; gröna syntetiska tester är inte verklig sparfils- eller visuell acceptans.

## Återrapportering och startvillkor

Planen är ett lokalt arbetsunderlag. Den skapar inga nya runtimefiler eller testresultat. Main behöver ge startbesked efter current-milestone-commit, ange slutlig bas och filägarskap samt bedöma den snäva minority-ändringen under D2. Vid mandatfixens reviewfynd avbryts detta arbete och den rättningen görs först.

## Beslut efter planleverans

Main godkände den snäva D2-preciseringen 2026-10-31: en redan tjänstgörande minority-regent som själv blir svårt sjuk får ersättas. En frisk redan tillsatt minority-regent ska inte omprövas retroaktivt enligt de nya exilreglerna. Bedömningspunkten ovan är därmed avgjord. Detta är inget startbesked för implementation; authority-milstolpen ska slutföras först.

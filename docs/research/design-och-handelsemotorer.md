# Varifrån kommer dynamiken? Design och händelsemotorer

Researchdatum: 30 oktober 2026. Denna bilaga skiljer utvecklarnas dokumenterade design från våra förslag. Ingen spelimplementation ingår. Den kompletterar bilagorna om CK3, Old World och Open Historias källkod.

## 1. Karaktärernas uppgift i ett strategispel

Soren Johnson beskriver i sin designtext från 2021 ett problem med långvariga 4X-kampanjer: efter den tidiga expansionen blir det egna riket stabilt och spelaren samlar allt fler permanenta fördelar. Levande, dödliga härskare ger en begriplig anledning till att förutsättningarna ändras. En ny utländsk ledare har andra relationer. En ny egen ledare har andra förmågor, medan den avlidnes förmågor försvinner. Spelaren kan förbereda en efterträdare men kontrollerar inte hela livsförloppet. Detta är utvecklarens förklaring av avsikten, inte bevis för att varje kampanj uppnår den. [Soren Johnson, Designer Notes #7: Characters, 7 september 2021](https://www.designer-notes.com/old-world-designer-notes-7-characters/).

**Slutsats för vårt spel:** en karaktär behöver förändra minst ett beslut som spelaren faktiskt fattar. Om en guvernör kan bytas utan att stadens utveckling, familjens makt eller framtida konflikter påverkas har vi ännu bara skapat en personlista. Tillfälliga förmågor bör kunna ändra vilka strategier som är lönsamma under en regeringstid. Dödsfall måste därför kunna få både mänskliga och materiella följder.

Det betyder inte att varje död måste orsaka katastrof. Förberedelser ska löna sig. En planerad succession kan bevara institutionerna, samtidigt som nya personer får andra prioriteringar. Målet bör vara en värld som kräver anpassning och där förändringen går att förstå.

## 2. Old Worlds opinion har en riktning

Johnson beskriver ett opinionssystem där enskilda personers åsikter påverkar organisationer. Familjehuvudets åsikt bidrar till familjens, och religionshuvudets till religionens. Religion kan därefter påverka familjer, stammar och nationer. Flödet går åt ett håll; han berättar att återkoppling till den ursprungliga personen tidigare gav en oändlig beräkningsloop. Familjernas åsikter får materiell betydelse eftersom städer och förband hör till familjer. Missnöje kan därmed påverka underhåll, strid och uppror. Familjeklassernas olika önskemål skapar skillnader mellan familjerna. Detta återger den publicerade designmodellen från 2021, inte en revision av dagens körbara kod. [Designer Notes #8: Opinion, 15 september 2021](https://www.designer-notes.com/old-world-designer-notes-8-opinion/).

**Slutsats för vårt spel:** skilj på fyra frågor:

- Vad tycker personen om härskaren?
- Vad tycker familjen om fördelningen av inflytande och resurser?
- Vilken lojalitet har ämbetsinnehavaren till staten eller ämbetet?
- Vilken makt har personen faktiskt att handla mot oss?

En impopulär härskare behöver inte omedelbart förlora en laglydig tjänstemans lydnad. En vänlig rival kan samtidigt ha ett starkt arvsanspråk. Ett enda värde kallat ”lojalitet” skulle göra dessa situationer svåra att uttrycka.

En senare modell kan låta familjepolitik förändra personers åsikter genom en separat, tidsstämplad händelse. Det är något annat än att låta samma numeriska härledning mata tillbaka till sig själv i en beräkning.

## 3. Händelser väljer en rollbesättning ur världen

I Johnsons beskrivning består en händelse av en utlösare, krav och effekter. Systemet söker giltiga händelser och väljer med hjälp av sannolikhet, vikt och prioritet. Händelsens ”subjects” är konkreta objekt: personer, städer, familjer, lagar eller teknologier. Villkor kan gälla både objekten och relationerna mellan dem. Val kan öppnas av härskarens egenskaper. Berättelser kan därför hänga ihop genom förändringar i tillståndet utan att varje händelse måste peka direkt på nästa. [Designer Notes #9: Events, 30 september 2021](https://www.designer-notes.com/old-world-designer-notes-9-events/).

**Illustration, vår egen och inte ett återgivet Old World-event:** en händelse om en förbigången befälhavare behöver en levande befälhavare, ett vakant eller nyligen tillsatt ämbete och en person som fick fördelen. Om vår sökning bara hittar ”en missnöjd person” kan texten bli motsägelsefull. Personen kan vara ett barn, sakna samband med ämbetet eller redan vara död. Rollbesättningen är därmed en del av spelreglerna.

En möjlig process för vårt spel, ännu bara en designskiss:

1. En relevant förändring inträffar: utnämning, myndighetsålder, dödsfall eller avslutat fälttåg.
2. Systemet söker händelser som får utlösas av förändringen.
3. Varje händelse försöker hitta giltiga deltagare och relationer.
4. Systemet kontrollerar spärrtid, redan pågående berättelser och spelarens händelsebelastning.
5. Ett val bland giltiga kandidater använder dokumenterade vikter och sparad slumpstatus.
6. Spelaren ser beslutet och dess kända följder.
7. Effekterna valideras och genomförs tillsammans.
8. Journal, minnen och följdhändelser uppdateras.

Detta är inte en beskrivning av någon av de kommersiella spelmotorernas fullständiga exekveringsordning. Det är ett förslag grundat i deras dokumenterade mönster.

## 4. Två sannolikheter får inte blandas ihop

Solvers moddningsguide skiljer mellan `iProb`, som avgör om en giltig händelse tas med i kandidatpoolen, och `iWeight`, som påverkar valet ur poolen. Den beskriver också spärrtider för upprepning, inklusive spärrar kopplade till en viss deltagare. Händelsens alternativ hänvisar till separata effekter. Deltagare och effekter måste matchas korrekt; i den beskrivna XML-modellen spelar deras ordning roll. Guiden är skriven av Solver och länkas från Mohawks egen moddningssida. Den är teknisk dokumentation med historiskt värde, inte en verifiering mot den senaste binären. [Old World Event Modding Guide](https://www.weplayciv.com/oldworld/events.html), [Mohawks moddningsresurser](https://mohawkgames.com/modding/).

**Eget räkneexempel:** om två händelser redan finns i samma pool och har vikterna 1 och 3 blir deras relativa chans 25 respektive 75 procent vid ett enda viktat val. Det innebär inte automatiskt att händelse två har 75 procents chans varje år. Utlösare, deltagare, inträdeschans, konkurrerande händelser och spärrar kan hindra den från att ens nå poolen.

För vårt verktyg bör ”varför hände detta?” därför kunna visas stegvis: utlösaren, giltiga deltagare, villkor, spärrar och vikt. Det hjälper både författare och speltestare att upptäcka händelser som aldrig kan inträffa eller som dominerar varje kampanj.

## 5. Mohawks författarverktyg ger viktiga kvalitetskrav

Mohawks länkade Event Browser-dokumentation beskriver förhandsgranskning och tester. Två centrala felklasser är att giltiga deltagare saknas och att en effekt inte kan tillämpas på en deltagare. Förhandsgranskning ersätter inte verklig spelkörning. Dokumentationen anger att en händelses vikt måste sättas; ett tomt värde behandlas där som noll. Det avviker från den äldre moddningsguidens uppgift om standardvikt ett. Skillnaden är en dokumentationskonflikt som måste kontrolleras mot målversionens data och verktyg före implementation eller modding. [Event Browser Documentation](https://docs.google.com/document/d/1sfeC--c9F_mh7Lp1WovTxZScjOGeC0FpvHrGuJpFJ6M/edit).

Deras stilguide föredrar gemensamma egenskaper, relationer, minnen och projekt framför hårt kopplade händelsekedjor. Händelseklasser styr rytmen med bland annat första tillåtna tur och minsta avstånd mellan händelser. Egenskaper kan öppna eller stänga alternativ; tester ska skydda mot oavsiktliga situationer där inga val återstår. Guiden betonar återbruk av befintliga begrepp, så att nytt innehåll ansluter till tidigare innehåll. [Old World Event Style Guide](https://docs.google.com/document/d/1Id2RskytCz3pjwY-yeUIPYsU7qRI-AbV-PcprmxQhaA/edit).

**Konsekvens för vår innehållsproduktion:** tio välanvända personlighetsegenskaper kan ge mer sammanhängande berättelser än femtio egenskaper som bara förekommer i ett event var. Varje egenskap bör granskas utifrån vilka beslut, relationer, AI-prioriteringar och händelser den påverkar. Ett författarverktyg bör visa var den används och vilka kombinationer som saknar innehåll.

Vi bör också skilja på ett permanent minne av att något har hänt och den åsiktsförändring som händelsen orsakar. Förolämpningen kan finnas kvar i personens historia efter att ilskan har avtagit. Om allt raderas när en tillfällig modifierare löper ut försvinner materialet för framtida återkoppling.

## 6. Diplomati kan vara en personbunden process

Johnson beskriver hur Old World flyttade diplomatin från ett fritt bytesbord till uppdrag och händelser. Resurser, tillgänglig ambassadör och tid begränsar försöken. Händelser kan ta hänsyn till krigsläge, relationer och andra världstillstånd. I textens dåvarande modell kan ambassadörens död avbryta processen. Syftet var att undvika att spelaren provar förslag om och om igen tills den bästa affären hittas. Det är en redogörelse för designval, inte ett löfte om att alla diplomatiska problem är lösta. [Designer Notes #10: Diplomacy, 8 oktober 2021](https://www.designer-notes.com/old-world-designer-notes-10-diplomacy/). En senare patch förtydligar undantaget att karaktärer slutför uppdrag om de dör samma tur. Därför ska död inte beskrivas som ett villkorslöst avbrott. [Update #79, 1 december 2021](https://mohawkgames.com/2021/12/01/old-world-update-79/).

**Slutsats för vårt spel:** diplomatiska uppdrag bör ha avsändare, mandat, deltagare, mål och status. Ett erbjudande från en kung ska inte automatiskt överleva hans död oförändrat. Avtal kan däremot ha institutionell varaktighet. Skillnaden mellan personlig vänskap och ett statsfördrag ger utrymme för antik politik utan att varje tronskifte behöver nollställa världen.

## 7. En regeringstid behöver ett mål

Johnsons text om slutvillkor beskriver hur ambitioner blev personliga mål som kan övergå till tidsbegränsade eftermälen hos efterträdaren. Ambitionerna stiger i svårighetsgrad och kopplar dynastins berättelse till ett möjligt segerförlopp. Legitimiteten bidrar både till handlingsutrymme och familjernas inställning. Texten beskriver också varför ett fast antal härskares liv var svårt att använda som matchlängd: livslängderna varierade för mycket. [Designer Notes #11: The End, 14 oktober 2021](https://www.designer-notes.com/old-world-designer-notes-11-the-end/).

**Slutsats för vårt spel:** skilj mellan rikets bestående projekt, härskarens personliga ambition och den spelande människans kampanjmål. De kan överlappa men behöver inte göra det. En byggande härskare kanske vill färdigställa ett bevattningssystem; den krigiska arvingen kan ärva projektet utan att värdera det lika högt. Spelaren måste då väga kontinuitet mot nya möjligheter. Eventuella tidsgränser ska vara synliga och motiverade.

## 8. Vad vi bör låna, anpassa eller avvakta med

Tabellen är vår bedömning för ett antikt spel, inte dokumenterade regler i inspirationsspelen.

| Designfråga | Föreslagen riktning | Skäl och kontrollfråga |
|---|---|---|
| Bestående spelidentitet | Riket består, härskare och regerande familj kan bytas | Passar önskad tyngd på rikesbyggande. Att en familj faller behöver inte automatiskt avsluta kampanjen. |
| Personlighet | Få begripliga, relativt stabila drag | Kan spelaren förutse personens troliga reaktion utan att utfallet blir säkert? |
| Individuell utveckling | Separata lager för utbildning, erfarenhet, tillstånd och minnen | Ett trauma behöver inte slumpa om hela personligheten. |
| Familjer | Intressen, tillgångar och inflytelserika personer | Vilken faktisk makt kan familjen använda när den blir missnöjd? |
| Ämbeten | Behörighet, mandat, kostnad, kompetens och politisk följd | Kan den bästa kandidaten på en egenskap vara ett dåligt val av andra skäl? |
| Arv | Tydliga regler med behörighet och anspråk | En kung, en vald magistrat och ett militärt befäl behöver olika övergångar. |
| Stress | Personlig konflikt mellan drag, plikt och handling | Är det ett rollspelsval eller en återkommande skatt på varje beslut? |
| Händelser | Återbruk av tillstånd, validerade deltagare och kontrollerad rytm | Kan följden återkomma senare utan en hårdkodad lång kedja? |
| Hemligheter | Kunskap per person och källor till misstanke | Vem vet vad, och hur fick personen reda på det? |
| AI | Handlingsförmåga plus personliga preferenser | Har personen resurser, åtkomst och motiv, eller bara en etikett? |
| Gränssnitt | Visa orsak, relation och berörd tillgång tillsammans | Kan spelaren förklara varför staden eller familjen reagerade? |
| Omfattning | Börja med en sammanhängande politisk kedja | Fungerar utnämning → reaktion → minne → följdhändelse → succession över flera liv? |

## 9. En hypotetisk kedja att använda i designgranskningen

Följande är ett originalexempel. Det återger inte något event ur CK3 eller Old World och ska inte läsas som historiska fakta.

En härskare utser en kompetent men illa omtyckt person till guvernör i en spannmålsregion. Den familj som tidigare hade posten förlorar inkomster och inflytande. Dess överhuvud protesterar. Härskaren kan kompensera familjen, ge den ett annat ansvar eller stå fast utan eftergift.

Beslutet registrerar flera skilda följder: stadens förvaltning förändras, familjens materiella ställning ändras och några personer får minnen av beslutet. En yngre släkting ser inte nödvändigtvis saken som familjehuvudet gör. Den nya guvernören kan få stöd av dem som tjänar på reformen och motstånd från dem som betalar för den.

När härskaren dör ska systemet pröva vad som faktiskt ändras: vem ärver makten, vilka mandat består, vilka löften var personliga och vilka personer har nu möjlighet att agera? En gammal protest behöver inte bli uppror. Utfallet kan bli förhandling, obstruktion, samarbete eller en konflikt beroende på resurser och relationer.

Detta exempel prövar om systemet kan skapa en begriplig historia ur flera mekaniker. Att visa fem händelsetexter i bestämd ordning skulle inte vara samma sak.

## 10. Det vi ännu inte vet

- Vi har inte körtestat CK3 eller Old World i denna undersökning och inte granskat deras fullständiga proprietära källkod.
- Utvecklarnas designtexter beskriver avsikt och dåvarande system. Aktuella patchar behövs för dagens detaljer.
- Varken dokumenterad opinionsmodell eller eventformat bevisar att alla relevanta beteenden följer modellen utan undantag.
- Dödlighet, fertilitet, fullständiga AI-vikter, alla modifikatorer och samtliga DLC-kombinationer är inte uttömmande verifierade.
- Event Browser- och Style Guide-dokumenten gick att läsa via Googles offentliga textexport. Dokumentens aktuella revisionsdatum framgick inte i exporten.
- Siffror från 2021 års artiklar bör inte tas som balansvärden för en implementation 2026.

Nästa forskningsnära steg är att välja ett antal observerbara situationer och jämföra dem i kontrollerade spelsessioner: samma karaktär i olika ämbeten, samma val med olika personlighet, ett successionstillfälle och en återkommande minneskedja. Den här leveransen ger underlaget för att välja försöken; den påstår inte att försöken redan har genomförts.

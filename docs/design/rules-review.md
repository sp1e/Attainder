# Regelgranskning: hela karaktärssystemet

Datum: 30 oktober 2026. Underlag till systemdesignen för Simons antika strategispel.

Detta dokument innehåller **egna föreslagna spelregler och acceptansfall**, grundade i den färdiga researchen. Det beskriver inte CK3:s eller Old Worlds exakta kod och är inte en genomförd speltestserie. Simon har beställt samtliga sex pelare. Specifika balansvärden och ännu obesvarade designval är inte automatiskt godkända genom det beslutet.

## Samlad bedömning

De fem spelpelarna behöver ingå i samma modell från början. Den sjätte pelaren styr källspårning och versionshantering. En implementation kan delas upp i arbetssteg, men slutacceptansen behöver omfatta alla pelare tillsammans. Ett separat demonstrationsläge eller en personlista uppfyller inte hela beställningen.

Systemets centrala kedja bör vara: en person får faktisk makt, använder den på ett personligt sätt, påverkar andra personer och organisationer, lämnar bestående minnen och förändrar förutsättningarna för nästa maktskifte. Ålder, död, sparning och spelarens kunskap måste fungera genom hela kedjan.

## R1. Härskare förändrar strategiska möjligheter

**Föreslagna regler**

- Separera personens kompetens, personliga specialförmågor, formella befogenheter och institutionernas bestående förmågor.
- En specialförmåga får en namngiven bärare och en giltighetsregel. Den kan kräva att personen lever, innehar ett visst ämbete och kan utöva det. En regents övertagande måste ha en uttrycklig regel för vilka förmågor som används.
- Skilj mellan att få inleda en handling och vad som händer med en redan påbörjad handling. Varje handlingsslag behöver välja mellan att fortsätta, omprövas, pausas eller avbrytas vid maktskifte. Visa följden innan spelaren binder resurser.
- Ett avslutat bygge består efter byggherrens död. En personlig rabatt eller extra handlingsrätt upphör när dess giltighet upphör. Kvarvarande kunskap eller institutionella reformer kan bestå när deras egna regler medger det.
- Tillsättning, abdikation och avsättning får inte ge obegränsad möjlighet att växla mellan förmågor. De ska kräva giltigt förfarande, tid eller politisk kostnad och kunna möta motstånd.

| Acceptansfall | Förväntat resultat |
|---|---|
| R1-A: två härskare med olika specialisering tar över samma världstillstånd | Minst en faktisk strategisk handling eller avkastningsregel ändras; gränssnittet anger orsaken. |
| R1-B: en härskare dör medan ett personberoende projekt pågår | Projektet följer sin deklarerade övergångsregel; färdiga tillgångar finns kvar. |
| R1-C: härskaren avsätts och återkommer senare | Förmågor aktiveras enligt aktuell status, utan staplade eller dubbla effekter. |
| R1-D: minderårig efterträdare får regent | Spelaren ser vem som ger varje aktiv förmåga och vilken roll som kan fatta respektive beslut. |

## R2. Personlighet påverkar AI och spelarens avvägningar

**Föreslagna regler**

- Personlighet, yrkesskicklighet, personliga mål och tillfälliga tillstånd är skilda lager. Samma kompetens kan därför ge olika beteenden hos två personer.
- Relativt stabila drag påverkar värdering av handlingar, benägenhet att ta risk, sociala reaktioner och relevanta händelsealternativ. Erfarenheter kan förändra personen, men en vanlig årsväxling ska inte slumpa om hela personligheten.
- AI väljer bland handlingar personen har rätt, resurser, tillgång och information att genomföra. Motivet ensamt räcker inte för att starta ett uppror eller påverka ett avlägset ämbete.
- Handlingar som strider mot spelarfigurens personlighet kan ha en förutsägbar personlig kostnad. Kostnaden ska visas före beslutet och skiljas från politikens övriga risker. Hur begreppet stress eller press används bestäms i systemdesignen.
- En AI-person kan avstå från en handling. Beslut behöver väga personlighet mot hotbild, skyldigheter och överlevnad. Ett ambitiöst drag ska inte tvinga fram samma handling i alla lägen.
- Återhämtning kostar något men ska inte ge ett repetitivt knapptryckskrav. Avgång, vård, vila, delegation och socialt stöd kan ha olika följder. Balansen får inte göra självmordsartad stress till den bästa vägen att byta härskare.

| Acceptansfall | Förväntat resultat |
|---|---|
| R2-A: ändra endast personlighetsprofilen i ett kontrollerat utnämningsscenario | AI:s prioriteringsförklaring och minst ett lämpligt val skiljer sig. Alla möjliga världslägen behöver inte ge olika beslut. |
| R2-B: en hämndlysten person saknar resurser och tillgång till målet | Personen kan avvakta, söka hjälp eller välja en genomförbar handling; otillåten handling sker inte. |
| R2-C: spelaren väljer ett personlighetsstridigt alternativ | Den förhandsvisade personliga kostnaden appliceras en gång och journalen förklarar den. |
| R2-D: en grundegenskap förändras genom en viktig erfarenhet | Förändringen har en spårbar orsak och påverkar senare handlingar, utan att skriva om tidigare händelser. |

## R3. Personer, familjer och religioner har olika intressen

**Föreslagna regler**

| Begrepp | Föreslagen betydelse |
|---|---|
| Personlig åsikt | En persons inställning till en bestämd annan person, med förklarande bidrag. |
| Relation | Ett särskilt band: släktskap, vänskap, rivalitet, partnerskap, förmyndarskap eller skyldighet. |
| Tjänstelojalitet | Vilja att följa ett ämbetes och statens regler, även när personen ogillar härskaren. |
| Rädsla | Uppfattad personlig risk med att motsätta sig någon. |
| Legitimitet | Erkännande av en persons eller institutions rätt att utöva en viss makt. |
| Organisationens hållning | Familjens eller religionsorganisationens förhållande till ledningen, en reform eller en kandidat. |
| Faktisk makt | Tillgångar och handlingsmöjligheter: ämbeten, jord, pengar, befäl, anhängare och kontakter. |

- Familjen är en politisk organisation med medlemskap, tillgångar, ledning och intressen. Dess medlemmar kan vara oense. Ett efternamn ersätter varken organisationen eller släktträdet.
- Familjeöverhuvudets åsikt kan bidra till organisationens hållning, men bidragets betydelse ska framgå. Förändringen ska inte nollställa familjens egendom eller intressen.
- Religion omfattar personlig tro, organiserad religiös makt och befolkningens tillhörighet. Dessa behöver inte ändras samtidigt.
- En härledd opinionsberäkning får inte direkt mata tillbaka sitt eget värde. En senare politisk reaktion kan förändra personer genom en separat händelse med egen tid och orsak.
- Missnöje får materiella följder genom definierade kanaler: samarbete, förvaltning, lokalt stöd, befälslydnad och organiserat motstånd. Aktörens resurser och förväntad kostnad avgör vilka följder som är möjliga.

| Acceptansfall | Förväntat resultat |
|---|---|
| R3-A: en laglydig guvernör ogillar härskaren | Personen kan fortsätta fullgöra ämbetet; dålig åsikt leder inte automatiskt till förräderi. |
| R3-B: två släktingar stöder olika tronföljare | Familjeband bevaras och olika politiska ställningstaganden kan visas samtidigt. |
| R3-C: familjeöverhuvudet dör | Ny ledning kan ändra familjens hållning; ämbeten, tillgångar och medlemmars personliga minnen hanteras separat. |
| R3-D: en familj förlorar en stad | Dess maktunderlag och berörda intressen förändras, och spelaren kan följa beräkningen. |
| R3-E: en religionsledare byts | Effekter på personer och organisationer beräknas utan oändlig återkoppling eller dubbelräkning. |

## R4. Minnen skapar framtida konsekvenser

**Föreslagna regler**

- Ett minne hänvisar till en genomförd händelse, dess tid, deltagare och orsak. Perspektiv och kännedom är separata: alla deltagare behöver inte känna till den verkliga gärningspersonen.
- Skilj händelsefaktum från åsiktseffekt och pågående berättelse. En effekt kan avta medan historien består. En släkting kan lära sig om något senare utan att ha bevittnat det.
- Händelser väljer giltiga deltagare ur det aktuella tillståndet. Levande person, relevant relation, ämbete och faktisk åtkomst måste kunna kontrolleras.
- Återanvändbara minnestyper, relationer och mål öppnar följdhändelser. Hårda berättelsekedjor används när den särskilda berättelsen kräver det, med regler för deltagarens död, försvinnande eller maktförlust.
- Opinionsstraff staplas inte obegränsat genom att samma dialog, anställning eller avsked upprepas. Händelser behöver identitet, upprepningsregler och uppgifter om vilka effekter som redan applicerats.
- Gränssnittet visar varför ett gammalt beslut är relevant. Viktiga pågående frågor kan följas mellan händelser utan att varje liten effekt avbryter spelet.

| Acceptansfall | Förväntat resultat |
|---|---|
| R4-A: en person blir förbigången vid utnämning | Ett senare giltigt scenario kan hänvisa till samma beslut och deltagare och ändra val eller stöd. |
| R4-B: en åsiktsmodifierare löper ut | Det ursprungliga minnet kan fortfarande visas och användas av en relevant senare berättelse. |
| R4-C: ett hemligt svek sker | Bara de personer som känner till sveket får använda kunskapen; upptäckt senare skapar ny kunskap med källa. |
| R4-D: en planerad deltagare dör före följdhändelsen | Händelsen avbryts, omprövas eller byter deltagare enligt en författad regel; texten återupplivar ingen. |
| R4-E: samma resultat återspelas efter avbruten skrivning | Minne, politisk effekt och resurstransaktion tillkommer högst en gång. |

## R5. Ämbete, egendom, familjeledning och spelarkontroll följer egna regler

**Föreslagna regler**

- Varje ämbete har behörighet, tillsättningsförfarande, befogenheter, mandat och avsättningsregel. Privat egendom och politiskt medlemskap följer separata regler.
- Ålder, familjeband, adoption, förmyndarskap, pågående anspråk och offentliga löften behöver bestå över byten av ämbete och namn.
- Successionslagen bestämmer behörighet och förfarande. Stöd, förhandling, rädsla och militärmakt kan påverka om utfallet accepteras. Ett lagligt anspråk och faktisk kontroll kan tillhöra olika personer.
- Minderårighet kräver regler för regentens mandat, förmyndarskap, tillfälliga befogenheter och överlämning. Regentens egna familjetillgångar ska inte bli barnets egendom av misstag.
- Utbildning, mentorskap, äktenskap och adoption behöver kunna påverka framtida kandidater och förbindelser. Personer kan byta karriär genom erfarenhet och nya omständigheter.
- Födsel, sjukdom, åldrande och död följer kalendern. Döda personer finns kvar när släktband, minnen, anspråk eller historia behöver dem, men har ingen egen nutida handlingsförmåga.

**Föreslagen övergångsordning:** fastställ händelsen och tidpunkten → avsluta personens egna aktiva befogenheter → registrera vakanser och berörda anspråk → fördela egendom enligt dess regler → utse eller pröva familjeledning → hantera varje ämbetes efterträdare och eventuell regent → ompröva personberoende projekt och relationseffekter → tillämpa kampanjens regel för spelarkontroll → visa konsekvenserna. Juridiska konflikter kan lämna vissa steg olösta, men varje olöst fråga behöver ett tydligt tillstånd.

| Acceptansfall | Förväntat resultat |
|---|---|
| R5-A: en guvernör avsätts | Ämbetet förloras; privat förmögenhet, släktband och familjens fortsatta makt finns kvar enligt sina regler. |
| R5-B: en härskare dör med skilda arvingar till olika tillgångar | Tronen, egendomen, familjeledningen och spelarkontrollen behöver inte gå till samma person. |
| R5-C: ingen behörig efterträdare finns | Det valda styrelseskickets definierade krisförfarande inträder; spelet hittar inte på en ny biologisk släkting. |
| R5-D: den rättsliga arvingen är minderårig och rivalen har arméstöd | Lagligt anspråk, regentskap och faktisk kontroll kan skiljas åt utan två samtidiga innehavare av samma exklusiva ämbete. |
| R5-E: ett långt tidshopp passerar flera livshändelser | Händelserna behandlas i tidsordning och stoppas vid spelbeslut enligt kampanjregeln. Ett UI-anrop är inte ett automatiskt år. |

### Två beslutade kampanjlägen

Simon har valt att spelaren ska välja mellan **riket och familjen vid kampanjstart**. Båda lägena är obligatoriska. Den valda identiteten ska sparas med kampanjen och bestå genom succession, import och återställning. Följande detaljregler är förslag till hur beslutet omsätts i spelet.

| Fråga | Riksläge | Familjeläge |
|---|---|---|
| Bestående identitet | En bestämd politisk statsbildning. | En bestämd politisk familj med egna medlemskapsregler. |
| Dynastibyte på tronen | Spelaren fortsätter med rikets nya ledning. | Familjeidentiteten består även när en annan familj tar tronen. |
| Direkt spelarkontroll | Rikets beslut genom dess aktuella beslutsordning. | Familjens gemensamma beslut genom dess aktiva företrädare samt befogenheterna i ämbeten som företrädaren innehar. |
| Personer med egen vilja | Andra härskare, familjer, ämbetsinnehavare och släktingar. | Även andra vuxna familjemedlemmar; släktskap ger inte obegränsad kontroll över deras ämbeten. |
| Efter förlust av makt | Rikets kvarvarande institutioner styr tillgängliga handlingar. | Hushåll, tillgångar, relationer, utbildning, patronage, anspråk och tillträde till nya ämbeten ger fortsatt spel. |
| Geografisk förflyttning | Flyttad huvudstad behöver inte betyda nytt rike. | Exil behöver inte betyda familjens slut, men tillträde, inkomster och handlingsmöjligheter förändras. |

**Föreslagen kontrollgräns:** spelaren kan fördela gemensamma resurser och ange gemensamma mål. En självständig vuxen släkting kan förhandla, vägra eller bryta med familjen enligt sin personlighet och ställning. Riksbeslut kan kräva råd, stöd eller annat lagligt förfarande. Att spelaren väljer en handling ger inte en person resurser eller befogenheter som saknas.

**Spel efter tronförlust:** familjeläget behöver egna giltiga handlingar även när ingen medlem är härskare eller guvernör. Dessa ska kunna förändra faktisk förmögenhet, kompetens, relationer, stöd och möjligheten att återkomma. Ett hushållsfönster utan följder uppfyller inte kravet. En familj utan ämbete kan däremot inte besluta om statens skatter eller kommendera dess armé.

**Minderårig företrädare:** familjeidentiteten eller riksidentiteten består. En behörig vuxen förvaltar de handlingar som barnet inte kan utföra, med redovisat mandat och egen vilja. När barnet blir myndigt sker en regelstyrd överlämning. Det ska framgå vilka beslut spelaren kan fatta, vilka som kräver regentens stöd och vem som ansvarar för följderna.

**Utslocknande och förlust:** biologisk släktlinje och politisk familj får inte blandas ihop. Adoption, erkända grenar och redan etablerade regler kan hålla familjen vid liv. Ett känt ofött barn med giltigt framtida anspråk kan kräva ett väntetillstånd. Spelet får inte skapa en okänd arvinge för att undvika ett slut. Föreslagen förlustregel för familjeläget är att ingen medlem eller redan giltig fortsättningsmöjlighet återstår. Riksläget avslutas först när den definierade statsbildningen upphör utan en regelmässigt erkänd fortsättning; härskarens familj kan dö ut utan att kampanjen slutar. Dessa precisa slutvillkor behöver beslutas i huvudspecifikationen och visas före kampanjstart.

| Acceptansfall | Förväntat resultat |
|---|---|
| R5-F: starta och återläs en kampanj i vardera läget | Vald identitet, kontrollgräns och relevanta slutvillkor är oförändrade. |
| R5-G: samma dynastibyte spelas i båda lägena | Riksläget följer rikets nya ledning; familjeläget behåller den tidigare familjen och får sina kvarvarande handlingar. |
| R5-H: familjen mister samtliga ämbeten men har egendom och kontakter | En spelbar politisk och ekonomisk handlingskedja finns, inklusive möjlighet att bygga stöd och söka ett ämbete. |
| R5-I: familjeföreträdaren förvisas | Tillträde och lokal makt ändras; kvarvarande giltiga exilhandlingar och möjliga villkor för återkomst framgår. |
| R5-J: en vuxen släkting är guvernör i en annan stat | Familjespelaren kan använda giltiga relationer och förhandlingar men kan inte direkt ändra den andra statens budget. |
| R5-K: en minderårig blir familjeföreträdare eller rikets härskare | Regentens mandat och handlingsgränser fungerar i respektive läge och ändras när myndighetsregeln inträder. |
| R5-L: den sista medlemmen dör, med respektive utan redan giltig fortsättningsmöjlighet | Familjeläget följer rätt väntetillstånd, efterträdande eller slut; riksläget fortsätter om staten består. |
| R5-M: staten upphör men spelarens familj överlever | Familjeläget kan fortsätta enligt exil- eller medlemskapsregler; riksläget följer sin uttryckliga kontinuitets- eller förlustregel. |

## R6. Mekaniker och versioner går att spåra

Varje importerad designidé behöver ett eget krav-ID, inspirationens källa, kontrollerad version eller datum, eventuell DLC-gräns, vår anpassning och tillhörande acceptansfall. Balansvärden i vårt spel ska anges som våra värden, även när de bygger på samma princip.

| Acceptansfall | Förväntat resultat |
|---|---|
| R6-A: en källa beskriver en äldre regel som senare ändrats | Konflikten framgår; den äldre uppgiften framställs inte som aktuell. |
| R6-B: vårt spel ändrar en regel eller ett värde | Ändringen har eget versionsnummer och beskriven betydelse för sparade kampanjer. |
| R6-C: ett krav markeras färdigt | Det finns beteendeevidens för kravet och integrerade följder, inte endast kod eller en skärmbild. |

## Tvärgående risker att täppa till i huvudspecifikationen

| Risk | Regel som behövs |
|---|---|
| Spelaren byter härskare för att kombinera alla förmågor | Klara aktiveringsvillkor, politiska övergångskostnader och regler för pågående handlingar. |
| Spelaren massutnämner släktingar och återkallar poster för gratis uppskattning | Bestående förväntningar, konsekvenser vid indraget löfte och spärr mot upprepad belöning för samma förfarande. |
| AI:n känner hemligheter som ingen upptäckt | Kunskap filtreras per aktör före beslutsvärdering och eventuell textgenerering. |
| En konflikt blir omöjlig att lösa eftersom alla eventval är låsta | Författarvalidering och ett definierat utfall när inga giltiga val återstår. |
| En skicklig härskare gör staten permanent starkare utan mottryck | Personliga förmågor får upphöra; institutionella framsteg består endast när de faktiskt har etablerats. |
| Familjemakt visas som en poäng utan användning | Varje maktkälla kopplas till definierade handlingar och konsekvenser. |
| Spelaren kan inte förstå ett svek | Visa kända orsaker, osäkerheter och tidigare beslut; avslöja inte dolda fakta i förväg. |
| Sparning eller AI-resultat skriver över ett karaktärsbeslut | Samordnad skrivning, giltig förversion och en gemensam regelauktoritet. |
| Framtida dödsfall visas innan Open Historias tidslinje når dit | Personvyn läser samma synliga tidstillstånd som händelsepresentationen. |
| Antikens samhällen blir samma feodala modell med nya namn | Behörighet, ämbeten och succession definieras per avsiktligt valt styrelseskick; historiska påståenden får egna källor. |

## Integrerad slutacceptans

Ett scenario över tre generationer bör innehålla utbildning, en utnämning med familjepolitisk följd, en personlighetsstyrd AI-handling, ett val med personlig kostnad, ett minne som förändrar en senare situation samt ett maktskifte som skiljer mellan ämbete och privat makt. En maktbas ska kunna överleva en enskild persons förlust av ämbetet. Ett senare ledarskap ska ändra minst en faktisk strategisk möjlighet. Scenariot ska genomföras i båda kampanjlägena, inklusive ett dynastibyte och en spelbar period utan tron eller ämbete i familjeläget.

Samma förlopp ska kunna sparas, återläsas, exporteras och återställas utan nya deltagare, dubbla effekter eller läckt framtidskunskap. Slumpmässiga utfall behöver vara reproducerbara från samma dokumenterade starttillstånd. Alternativa val ska ge följder som går att spåra till just dessa val. Tre generationer är ett föreslaget acceptansscenario, inte en begränsning av kampanjens längd.

Underlag: [researchens syntes](../RESEARCH.md), [CK3](../reports/ck3-character-research.md), [Old World](../reports/old-world-character-research.md), [händelsemotorer](../reports/design-och-handelsemotorer.md) och [Open Historias integrationsrisker](../reports/open-historia-architecture.md).

# Människor, familjer och makt i ett antikt rike

Systemdesign · 30 oktober 2026 · version 0.1

**Beslutad omfattning:** samtliga sex punkter som Simon valde från researchen ska ingå. Fem beskriver spelmekanik; den sjätte kräver att källor, versioner och egna designbeslut går att följa. **Vid kampanjstart väljer spelaren mellan att följa riket och att följa familjen.** Båda lägena ingår i slutleveransen.

Detta dokument omsätter beslutet till spelregler och byggbara system. Reglernas utformning är vårt designförslag. Numerisk balans, historiska scenarier och slutligt namn återstår att pröva. En första implementation finns nu med körbara mekaniker för samtliga fem spelpelare. [Implementationsstatus](../reports/IMPLEMENTATION-STATUS.md) skiljer verifierat beteende från kvarvarande krav; specifikationen nedan är fortfarande slutleveransens mål.

## 1. Vad spelaren ska uppleva

En skicklig härskare gör vissa strategier möjliga. Hennes död förändrar både rikets förmågor och människornas ställning. Efterträdaren ärver ett territorium, institutioner och olösta konflikter, men har egna mål, relationer och svagheter. En förbigången familj kan förlora ett ämbete och ändå behålla jord, pengar, klienter och ett trovärdigt anspråk på framtida makt.

Personliga beslut ska märkas på kartan och i ekonomin. En förödmjukad general kan fortsätta tjäna staten men vägra stödja en viss tronföljare. En respekterad religiös ledare kan dämpa oron i familjens städer. Ett löfte om ett ämbete kan ligga bakom en konflikt tjugo år senare. Spelaren ska kunna se de kända orsakerna och ha handlingsalternativ före krisen.

Kampanjen förenar Old Worlds fokus på rikesbyggande med CK3-inspirerad personlighet, relationer och skild maktöverföring. Antikens familjer, råd, prästerskap, arméledningar och ämbeten utgör den politiska miljön.

## 2. Två sätt att fortsätta kampanjen

| Regel | Följ riket | Följ familjen |
|---|---|---|
| Bestående identitet | Det valda riket | Den valda politiska familjen |
| Efter härskarens död | Spelaren styr genom den nya ledningen eller dess regentskap | Spelaren fortsätter genom familjens nya företrädare; denne behöver inte bli härskare |
| Efter en statskupp | Den nya statsledningen blir spelarens ledning | Familjen behåller kontrollen över sina egna tillgångar och tillåtna handlingar |
| Efter förlorad guvernörspost | Riket utser en ny innehavare enligt gällande regler | Den avsatte förlorar ämbetets befogenheter och offentliga medel; familjens egna resurser består |
| När familjen saknar ämbeten | Familjen är en av rikets politiska aktörer | Spelaren kan förvalta egendom, söka patroner och uppdrag, utbilda arvingar, förhandla, ordna familjeband och bygga stöd för återkomst |
| Om en minderårig ärver | Ett regentskap utövar de befogenheter som lagen medger | En förmyndare förvaltar familjen; barnets framtida rättigheter består |
| Möjligt kampanjslut | Riket upphör att existera enligt scenariots regler | Familjen saknar varje giltig fortsättare enligt redan gällande familjeregler |

Valet sparas i kampanjen. Rike, familj, aktuell spelperson och innehavd roll är separata begrepp. Att byta roll ger aldrig automatiskt kontroll över en annan familjs egendom eller en stats armé.

I familjeläget styr spelaren gemensamma familjebeslut genom den aktiva företrädaren och använder de ämbetsbefogenheter företrädaren faktiskt har. Andra vuxna släktingar har egen vilja och kan förhandla, vägra eller bryta med familjen. Ett släktband till en guvernör i ett annat rike ger därför politiska möjligheter, men ingen direkt kontroll över det rikets budget eller armé.

Familjelägets fortsättning måste vara spelbar även utan tron och ämbete: spelaren ska ha ekonomiska och politiska handlingar, risker, tidsåtgång och mål. Återkomst kan ske genom utnämning, succession, förhandling eller organiserad maktkamp. Exil kräver en verklig mottagare och dess villkor. Adoption eller byte av familjegren följer lag och beslut innan en familj annars skulle upphöra; det är inte ett godtyckligt undantag vid ett förlusttillstånd.

Om familjen fördrivs och ingen mottagare ännu accepterar får den läget **skyddslöst hushåll**. Tillgängliga handlingar omfattar att söka en ny beskyddare, förhandla om villkor, sälja tillåtna flyttbara tillgångar eller söka försörjning. Tid och uppehälle fortsätter förbrukas; brist påverkar hälsa, relationer och vilka erbjudanden familjen kan acceptera. Läget avslutas genom faktiskt skydd, återkomst eller kampanjens vanliga fortsättnings- och slutregler. Ingen mottagare innebär därmed ett utsatt spelbart tillstånd med begränsade handlingar.

Under minderårighet eller oförmåga behåller spelaren kampanjidentiteten. Spelaren kan beställa normal förvaltning inom det tillfälliga mandatet. Beslut som lagen reserverar för regenten eller förmyndaren kräver dennes stöd; personen har egna mål och kan ställa villkor. Gränssnittet skiljer därför spelarens tillgängliga beslut från förslag som kräver samtycke. Stress och personliga följder belastar den faktiska beslutsfattaren. Kompetens och aktiva förmågor hämtas från den som utövar den berörda befogenheten, med dess rollvillkor. Myndighet eller återvunnen förmåga utlöser en regelstyrd mandatöverlämning; ett vägrat överlämnande blir en uttrycklig maktkonflikt.

Utformningen av seger föreslås följa identiteten: rikets mål gäller dess utveckling och fortlevnad, familjens mål gäller bestående ställning och åstadkommanden. Exakta segervillkor bestäms med det första scenariot.

## 3. Människans liv och personlighet

Varje person har beständig identitet, födelsedatum, släktband, familjemedlemskap, kultur, tro, kompetenser, personlighetsdrag, erfarenheter, hälsa och livsstatus. Fostran, utbildning, äktenskap, adoption, tjänstgöring, sjukdom, åldrande och död kan förändra möjligheterna under livet. Biologiskt släktskap, juridisk förälder och medlemskap i en politisk familj lagras och visas som skilda relationer.

Kompetens beskriver vad en person kan; personlighet beskriver vad personen föredrar och hur val upplevs. Två lika skickliga guvernörer kan därför prioritera olika. Ambition ökar värdet av ämbeten och erkännande. Försiktighet ökar vikten av överlevnad och säkra utfall. Pliktkänsla kan få en person att fullgöra sitt ämbete trots ogillande av härskaren. Girighet påverkar avvägningen mellan offentligt ansvar och egen vinning.

Drag är relativt stabila men kan förändras genom uppväxt, långvarig belastning och betydande erfarenheter. Förändringen ska ha en orsak. Kompetensutveckling och personlighetsförändring är separata utfall. Spelaren påverkar utbildningen utan att kunna beställa en exakt framtida personlighet.

### Stress och val

Handlingar har personlig betydelse: exempelvis svek, risk, grymhet, generositet och plikt. Personligheten avgör hur mycket belastning ett genomfört val skapar. Motsägande drag vägs tillsammans. Ett ambitiöst och medkännande barnbarn kan både vilja vinna ett ämbete och må dåligt av att röja sin rival ur vägen.

Stress har nivåer som kan ge trötthet, försämrad funktion och krishändelser. Återhämtning kräver tid eller resurser och kan ge egna följder. Belastningen bokförs när handlingen faktiskt sker; ett avbrutet formulär ger ingen stress. I förhandsvisningen visas känd kostnad och osäkerhet. Stressen tillhör personen som fattar eller utför det relevanta beslutet, även i riksläget.

## 4. Härskararketyper som förändrar strategin

Arketypen beskriver ett politiskt arbetssätt och ger särskilda befogenheter eller effektiva verktyg. Personlighet och kompetens förblir egna system. Följande åtta arketyper är en föreslagen innehållsbas att balansera:

| Arketyp | Exempel på särskild möjlighet | Strategisk följd |
|---|---|---|
| Fältherren | Genomföra en samordnad mobilisering | Snabbare kraftsamling kräver försörjning och politiskt stöd |
| Förvaltaren | Samordna flera stadsprojekt som en reform | Investeringar konkurrerar med familjernas lokala intressen |
| Diplomaten | Samla flera parter i en gemensam förhandling | Personliga förbindelser kan öppna vägar till fred eller koalition |
| Läraren | Upprätta ett särskilt utbildningsprogram för nästa generation | Rikets framtida kompetens förbättras på bekostnad av resurser nu |
| Lagstiftaren | Driva en större förändring av ämbets- eller arvsregler | Nya rättigheter skapar både vinnare och förlorare |
| Beskyddaren | Förmedla ett avtal mellan religiösa och politiska grupper | Religiöst stöd kan hjälpa riket men medföra förpliktelser |
| Intrigören | Samordna ett nätverk för politisk påverkan | Information och beroenden får större värde; avslöjanden blir farliga |
| Byggherren | Starta en sammanhängande infrastruktursatsning | Färdiga verk består men ledarens genomförandefördel upphör |

För varje förmåga anger innehållet vem som ger den, i vilken roll den gäller, kostnad, villkor, varaktighet och vad som händer vid död, avsättning eller rollbyte. Tre saker behandlas olika:

1. **Rätt att utföra en handling:** upphör när den behöriga ledaren lämnar rollen.
2. **Aktiv personlig fördel:** upphör vid sin definierade gräns och räknas om exakt en gång.
3. **Redan genomfört resultat:** en byggnad, lag eller fred gäller vidare enligt sina egna regler.

Ett påbörjat projekt får en uttrycklig fortsättningsregel: fortsätter med nya villkor, väntar på ett nytt beslut eller avbryts med beskriven konsekvens. Succession får varken radera färdiga byggnader eller låta den nya ledaren behålla den förres personliga förmågor av misstag.

## 5. Relationer och kollektiv politik

| Begrepp | Vad det betyder | Exempel |
|---|---|---|
| Personlig åsikt | En riktad bedömning av en annan person med synliga kända orsaker | Guvernören är tacksam för räddningen men bitter över en förödmjukelse |
| Relation | Ett bestående band eller en erkänd ställning | Vän, rival, partner, mentor, släkting, patron |
| Tjänstelojalitet | Benägenhet att fullgöra en viss roll och dess åtaganden | En general försvarar riket trots personlig fiendskap med härskaren |
| Familjens politiska stöd | Familjens hållning till en bestämd makthavare, reform eller kandidat | Familjen stöder en ny härskare om dess rättigheter respekteras |
| Religiöst stöd | Institutioners eller religiösa gruppers politiska hållning | En utnämning förbättrar ett prästerskaps stöd men upprör ett annat |
| Rädsla | Bedömd risk för personlig bestraffning | Öppen olydnad undviks men hemliga motåtgärder kan bli mer attraktiva |
| Legitimitet | Hur accepterad en innehavares rätt till ett visst ämbete är | En laglig arvinge har rättsligt stöd men svag praktisk kontroll |
| Makt | Medel att göra något: pengar, ämbeten, klienter, förband och allierade | Missnöje kan omsättas i förhalning, en koalition eller ett uppror |

Familjens hållning beror på intressen, fördelning av tillgångar och ämbeten, rättigheter och inflytelserika medlemmars inställning. Den är mål- och sakfrågespecifik. Ett antal lågt inflytelserika nyfödda ska inte kunna förändra en omröstning lika mycket som familjens etablerade företrädare.

Personlig åsikt, religion och familjeintresse kan bidra till samma politiska utfall. Varje bidrag har ursprung, mål, vikt och varaktighet. Beräkningen använder ett fast ordnat förlopp: personliga bedömningar och institutionella intressen beräknas först, kollektivt stöd därefter, konkreta effekter sist. Samma orsak räknas en gång per avsedd kanal. Återverkan blir en ny händelse vid nästa beslutspunkt, så stödet inte förstärker sig självt inom samma beräkning.

Stöd ska påverka verkliga system: skatteindrivning, produktionsstörningar, rekrytering, förbandens lydnad, reformers genomförande och diplomatins handlingsutrymme. Effekterna kräver en faktisk koppling mellan personen eller gruppen och berörda städer, institutioner eller förband. En impopulär hovman utan makt kan inte automatiskt sänka hela rikets ekonomi.

## 6. Självständiga mål och begriplig AI

Personer kan vilja skydda närstående, skaffa egendom, få ett ämbete, hålla ett löfte, ändra en lag, skydda sin tro, hämnas eller stödja en tronföljare. Mål får startorsak, berörda parter, framsteg, tidsgräns när det behövs och villkor för att överges. Ett långsiktigt mål får överleva flera turer.

AI:n arbetar vid tydliga beslutspunkter. Den bedömer först vilka handlingar personen har kunskap, rättigheter och resurser att utföra. Därefter väger den personlighet, aktuella mål, relationer, stress, risk, kostnad, familjens intressen och politisk situation. Små förändringar ska inte få en flerårig plan att byta riktning varje tur. Vid stora förändringar, exempelvis ett dödsfall eller förlorad armé, omprövas planen direkt.

AI:n får ett begränsat antal politiska handlingar per period. Samma rättigheter, kostnader och giltighetsregler gäller spelare och AI. Svårighetsgrad kan påverka hur långt AI:n planerar eller vilka uttryckligt redovisade fördelar den har. Den får aldrig agera på en hemlighet den inte känner till.

För utveckling krävs en beslutsförklaring: vilka alternativ var giltiga, vilka skäl vägde tyngst och varför valdes handlingen? Spelaren ser bara de delar som den egna sidan känner till. Språkmodellen i Open Historia kan formulera och föreslå handlingar inom reglerna. Personers existens, pengar, död, rättigheter och arv avgörs av den gemensamma regelmodellen.

## 7. Minnen, löften och händelser

Ett minne registrerar vad som inträffade, när, var, vilka som deltog, vad personen vet eller tror, vilken tidigare händelse som orsakade det och vilka beslut som följde. En person kan misstolka ansvar. Sanningen i simulationen och en persons uppfattning hålls därför åtskilda.

Minnet kan finnas kvar när dess känslomässiga effekt bleknat. Ett aktivt löfte, en skuld, en hemlighet, ett pågående projekt och en tidsbegränsad åsiktseffekt har egna livslängder. Försoning kan ändra relationen och avsluta en konflikt utan att radera att sveket inträffade.

Händelser söker deltagare ur den faktiska världen med villkor för livsstatus, roller, relationer, kunskap, tidigare minnen och aktuella intressen. Urvalet sker i skilda steg: giltighet, eventuell chans att bli kandidat, prioritet och vikt bland kandidaterna. Spärrtider kan gälla en person, ett deltagarpar, en familj eller hela riket. Händelser inom samma politiska konflikt delar tillstånd så att nya förlopp kan uppstå ur tidigare val.

Varje visad händelse måste ha minst ett giltigt val. Villkoren kontrolleras igen när valet verkställs. Om en deltagare dör eller ett ämbete byter innehavare innan dess ska händelsen anpassas enligt en definierad regel eller avslutas med förklaring. Ett beslut får inte tillämpas två gånger efter omförsök eller laddning.

Händelsernas rytm ska ge utrymme att spela rikesbyggandet. En tydlig skillnad görs mellan information, frivilligt tillfälle, viktigt beslut och akut kris. Sluttestet ska visa både sammanhängande berättelser över generationer och rimlig mängd avbrott per spelperiod.

## 8. Ämbete, familjemakt och olika arv

Ämbetet har egna befogenheter, krav, mandat, offentliga medel, tillsättningsregler och regler för avsättning. Personen har kompetens, relationer och tillgångar. Familjen har egna resurser, medlemmar, rättigheter, egendom och nätverk. Staten äger sina offentliga resurser.

Ett dödsfall eller maktskifte prövar flera överföringar var för sig:

- Härskarämbetet får en efterträdare enligt gällande succession, inklusive rivaliserande anspråk.
- Andra ämbeten blir vakanta, fortsätter under ställföreträdare eller tillsätts enligt sina regler.
- Den avlidnes personliga egendom och skulder fördelas enligt egendomsarv. Familjens gemensamma egendom och statens egendom behåller sina ägare.
- Familjens ledning utses enligt familjens ordning.
- Förmyndare och regent utses när den behörige är minderårig eller oförmögen.
- Spelarens aktiva företrädare ändras enligt kampanjidentiteten.

Överföringarna utförs som en sammanhängande förändring där mellanlägen inte kan utnyttjas. Listan anger ansvar, inte exekveringsordning. Gällande lag och ett dokumenterat transaktionsförlopp avgör ordningen. Vid flera dödsfall samma datum fastställs de avlidna före val av giltiga efterträdare. En död person kan aldrig bli aktiv ämbetsinnehavare. En avsättning flyttar inga privata tillgångar om inte en separat, tillåten konfiskation faktiskt beslutas.

Personlig vänskap ärvs inte automatiskt. Familjens dokumenterade oförrätter, utfästelser, anspråk och materiella intressen kan däremot bestå. Stödet för den nya ledaren räknas från dennes egna relationer och situation. En stark rättslig ställning behöver inte innebära kontroll över armén; rivalitet och succession blir därmed spelbara konflikter.

## 9. Information som gör systemen spelbara

| Vy | Vad spelaren behöver kunna avgöra |
|---|---|
| Person | Personlighet, kompetens, kända mål, stress, roller, relationer, viktiga minnen och nästa möjliga handling |
| Familj | Medlemmar, ledning, privat egendom, inkomster, inflytande, ämbeten, anspråk och politiska intressen |
| Ämbeten och råd | Befogenheter, behöriga kandidater, aktuella innehavare och varför andra stöder eller motsätter sig en tillsättning |
| Succession | Skillnaden mellan tronföljd, familjeledning och egendomsarv; kända kandidater, regentbehov och risker |
| Stad och armé | Vem som påverkar resursflöden och lydnad samt de kända orsakerna |
| Berättelse och tidslinje | Händelsernas orsakssamband, deltagare, olösta löften och avslutade konflikter |
| Beslutsdialog | Tillåtna alternativ, säkra kostnader, kända konsekvenser, personlig belastning och osäkra utfall |

Tooltippar och detaljvyer visar beräkningens kända delar. Okända uppgifter visas som okända, misstänkta eller hemliga. En stegvis uppspelning av en tur måste visa karaktärerna som de var vid den tidpunkt spelaren nått; framtida dödsfall och avslöjanden får inte synas i förväg.

Alla centrala handlingar ska fungera med tangentbord och få tydlig fokusmarkering. Färg kompletteras med text eller symbol. Ljust och mörkt tema ska fungera genomgående.

## 10. Kontrakt mot Open Historia

Den verifierade källbasen är revision `293a3b890142c734addd1dd0d1235995b3a43a6d`. Den installerade betan är separat identifierad; överensstämmelse mellan dess spelbeteende och revisionen är inte fastställd. Detaljer och källställen finns i [integrationsplanen](integration-plan.md) och [arkitekturstudien](../reports/open-historia-architecture.md).

Karaktärsvärlden föreslås ligga under det auktoritativa världstillståndet med beständiga ID:n. Äldre namnsträngar kan visas för kompatibilitet men får inte skapa en konkurrerande lista över ledare. Tillståndet behöver omfatta personer, familjer, ämbeten, egendom, relationer, minnen, åtaganden, mål, berättelser, kampanjidentitet, simulationstid och versionsinformation.

Regler och innehåll skiljs från det föränderliga kampanjtillståndet. Alla förändringar utförs via validerade kommandon och registrerade effekter. Ett kommando anger avsändare, tid, förväntad världsversion och unik identitet. Kommandon kontrollerar rättigheter och faktiska resurser när de verkställs.

Tid följer spelkalendern. Ett anrop till turupplösningen är inte säkert ett nytt år. Åldrande, födslar, dödsrisker, spärrtider och projekt får inte ticka igen om samma datum behandlas flera gånger. Vid stora tidshopp bearbetas relevanta datumgränser i ordning; årlig risk får inte tillämpas som en engångsrisk för hela hoppet.

Sparning, export, import, återställning och stegvis händelseuppspelning ska bära hela systemet. Slumptillstånd och färdiga beslut sparas så att samma sparfil och kommandon ger samma resultat för samma regelversion. En äldre sparfil migreras uttryckligen. En inkompatibel fil ska ge en begriplig förklaring och behålla originalet.

## 11. Spårbarhet från källa till egen regel

Varje innehållsregel får typ av grund: **användarbeslut**, **egen design**, **dokumenterat förebildsbeteende** eller **osäker tolkning**. Källhänvisningen anger spel, version eller datum, eventuell DLC, källa och vad vi faktiskt har verifierat. Ändrad design får ett eget revisionsnummer och motivering.

En historisk utvecklardagbok kan förklara syftet med en regel även om senare patchar ändrat detaljerna. Old Worlds borttagna Garrison-krav och CK3:s Stories-vy ligger därför i källhistoriken; vårt eget spel får en uttrycklig regel för guvernörsbehörighet respektive berättelsevisning. Versionsgranskningen ska motverka att äldre fakta råkar bli oavsiktliga spelkrav.

Sparschemats version, regelversion och innehållsversion behöver kunna skiljas åt. En balansuppdatering som ändrar stresskostnader är en annan förändring än en migration som delar upp familjeegendom och statskassa. Kampanjer ska inte tyst få nya regler mitt i ett förlopp.

## 12. Sammanhängande provkampanj över tre generationer

Provkampanjen är en konstruerad antik miljö. Den använder flera politiska familjer, städer, ett prästerskap och en armé. Namn och händelser är egna exempel, inte historiska påståenden.

**Första generationen:** härskaren Arel är fältherre. Familjen Namar får befälet över en gränsarmé i utbyte mot ett löfte om ett framtida guvernörsämbete. Ett barn från härskarfamiljen uppfostras av en lärd person från en konkurrerande familj. Kriget ger både territoriella vinster och personliga skulder. Det ursprungliga löftet får deltagare, villkor och ett faktiskt minne.

**Andra generationen:** Arel dör. Sera blir härskare och har en annan arketyp och personlighet. Arels särskilda mobiliseringsförmåga upphör; den erövrade staden består. Sera respekterar sin tidigare mentor men ogillar generalen från Namar. Familjen kräver att löftet uppfylls. Sera kan följa avtalet, förhandla om ersättning eller bryta det med kända kostnader och osäkra politiska följder.

**Tredje generationen:** generalen är död men familjens rättigheter och berättelsen om det brutna eller uppfyllda löftet består. Ett barnbarn söker guvernörsposten. Tidigare behandling påverkar vilka som stöder kandidaten. Familjen kan vinna, förlora ämbetet igen och ändå ha en egen maktbas. En succession med minderårig arvinge prövar familjeledning och regentskap var för sig.

Samma förlopp körs i båda spellägena, med alternativa beslut och andra slumpfrön. I riksläget måste ett dynastibyte ge fortsatt statskontroll. I familjeläget måste en avsättning ge meningsfull fortsatt familjekontroll och en verklig väg tillbaka. För varje följd kontrolleras att den kom från regler, relationer och minnen i kampanjen.

## 13. Vad som räknas som färdigt

Alla krav i [acceptansmatrisen](ACCEPTANS.md) måste ha körbar implementation och dokumenterad verifiering. [Regelgranskningen](rules-review.md) kompletterar med konflikter, kryphål och gränsfall. [Integrationsplanen](integration-plan.md) anger byggordning och kopplingar till källan. [Ordlistan](GLOSSARY.md) håller begreppen konsekventa.

Den första sammanhängande spelbara leveransen ska innehålla en representativ kedja genom samtliga fem spelpelare och båda kampanjidentiteterna. Därefter breddas innehåll och balans till hela den specificerade omfattningen. Ett porträttgalleri, en isolerad demo eller enbart berättande text uppfyller inte acceptanskraven för mekaniker som ska påverka den faktiska världen.

Särskilda osäkerheter att lösa under byggandet är familjelägets ekonomi utan ämbete, AI:ns körkostnad i stora världar, händelsernas mängd och balansen mellan förutsägbarhet och överraskning. Dessa ska mätas i speltest och simulation; angivna regler är ännu inte bevis för att spelet är roligt eller välbalanserat.

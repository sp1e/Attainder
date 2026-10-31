# Crusader Kings III: karaktärer som driver strategi

Researchdatum: **30 oktober 2026**. Avser PC-versionen. Rapporten är ett designunderlag för ett eget antikt imperiespel med Open Historia som möjlig grund. Ingen spelkod har ändrats.

**Huvudslutsats:** CK3:s viktigaste bidrag är att personer har varaktiga egenskaper, egna relationer och en historia som ändrar deras framtida handlingsmöjligheter. Politisk makt beror därför på vem som innehar den, vilka personen är beroende av och vem som kommer efter. För det planerade spelet är denna orsakskedja viktigare än att återskapa CK3:s mängd egenskaper, händelser eller medeltida titlar.

## Underlag och aktualitet

Underlaget består främst av Paradox utvecklardagböcker och versionsanteckningar, ofta återpublicerade i spelets officiella Steam-flöde. Två äldre dagböcker har lästs i communityansvarige Nicou12313:s återpublicering på Reddit; slutsatserna bygger där på dagbokstexten, inte på läsarkommentarer. Dessa används för ursprunglig designavsikt. Senare versionsanteckningar får företräde när system har ändrats.

Den senaste officiella PC-version som verifierats i materialet är **1.20.1.2, publicerad 21 oktober 2026**. [Officiell uppdateringsartikel](https://steamcommunity.com/games/1158310/announcements/detail/701031128264343885) By God Alone och 1.20 Crozier släpptes 30 september. [Utgivningsartikel](https://steamcommunity.com/games/1158310/announcements/detail/684140727200907282) Silk & Silver är annonserat till 17 november och behandlas här som framtida innehåll. Konsolversionernas funktioner har inte kontrollerats. [Officiellt tillkännagivande](https://steamcommunity.com/games/1158310/announcements/detail/701030583835296544)

Flera Paradox-forum och wikisidor nekade åtkomst. Jag har inte granskat CK3:s installerade speldata, källkod eller gjort en egen speltestserie. Exakta aktuella formler, sannolikheter och samtliga DLC-kombinationer är därför inte verifierade. Rapporten skiljer mellan belagda funktioner, utvecklarnas designavsikt och våra egna rekommendationer.

## 1. Vad spelaren egentligen styr

Paradox presenterar CK3 som ett spel där en dynasti fortsätter genom nya spelbara arvingar när en härskare dör. Äktenskap, egenskaper, förmyndare, intriger och relationer hör till samma politiska spel som krig och territorier. Därför är en härskares död en förändring av vilka verktyg och beroenden spelaren har. Den officiella produktbeskrivningen beskriver också ärftliga genetiska egenskaper; det betyder inte att personlighet generellt är biologiskt nedärvd. [Paradox produktbeskrivning](https://www.paradoxinteractive.com/games/crusader-kings-iii/about)

Redan den första utvecklardagboken anger individer som spelets centrum och efterfrågar händelser som är relevanta för den simulerade situationen. Vår tolkning är att berättelsen behöver uppstå ur spelets tillstånd: en rival är intressant därför att rivalen kan påverka arv, ämbete eller krig. [Dev Diary 0, november 2019](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1573047066&feed=steam_community_announcements)

**Konsekvens för vårt spel:** besluta om spelaren följer staten, en släkt eller en person. Old World-liknande imperiebyggande talar för en beständig stat med successiva ledare. Familjens förlust av tronen behöver då ge en ny politisk situation snarare än automatiskt avsluta spelet. Detta är vårt designförslag, inte ett påstående om CK3:s alla spelavslut.

## 2. Egenskaper behöver flera funktioner

En användbar analys skiljer mellan följande lager. Tabellen är vår begreppsmodell; den gör inte anspråk på att återge CK3:s interna datamodell.

| Lager | Vad det beskriver | Varför det behövs i vårt spel |
|---|---|---|
| Identitet och livslopp | Ålder, släktskap, kultur, tillhörighet, död | Kontinuitet, arv och minne |
| Personlighet | Hur en person brukar välja och reagera | Beteende som går att förutse utan att vara mekaniskt |
| Kompetens | Förmåga inom ett arbetsområde | Konsekvenser av utnämningar och utbildning |
| Erfarenhet | Inlärd specialisering och tidigare gärningar | Personer blir värdefulla genom det de gör |
| Hälsa och andra tillstånd | Sjukdom, skada, stress, återhämtning | Förändringar inom ett liv, med tydliga orsaker |
| Sociala omdömen | Vad andra tycker, tror och fruktar | Politisk reaktion på samma handling kan skilja sig |
| Formella roller | Härskare, guvernör, rådgivare, befälhavare | Befogenheter och konkreta effekter på riket |

CK3 utvecklar både stabila egenskaper och egenskaper som förändras genom handling. Den fria Crown-uppdateringen 2025 gjorde befälhavaregenskaper graderade: relevant krigserfarenhet förbättrar dem. Samma uppdatering gav hovämbeten tydligare uppgifter, bättre hantering av vakanser och ett mer användbart gränssnitt. Det ger stöd för att separera medfödd/stabil identitet från förvärvad yrkesskicklighet och själva ämbetet. [Dev Diary 164 och 1.15 Crown](https://store.steampowered.com/news/posts/?appgroupname=crusader+kings+iii&appids=1158310&enddate=1743508710&feed=steam_community_announcements)

Ett tydligt produktionsmisstag finns beskrivet av utvecklarna: Loyal och Disloyal kom sent och användes för lite i innehållet. När Eccentric tillkom planerades dess händelser och villkor tidigare. Egenskapen styr vilken sorts ovanliga händelser som passar personen. Den är gratis, medan visst kopplat innehåll kräver DLC. [Dev Diary 132, 1 augusti 2023](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1691496129&feed=steam_community_announcements)

**Vår rekommendation:** börja med få egenskaper som påverkar flera handlingar. En ambitiös person bör söka större uppdrag, reagera på att bli förbigången och stödja en kandidat som lovar avancemang. En dekorativ etikett med en ensam bonus ger betydligt mindre dynamik.

## 3. Personlighet: AI:s val och spelarens kostnader

Den ursprungliga stressdesignen gör det möjligt att handla mot sin personlighet, men med en kostnad. Handlingar, överarbete och förlust av närstående kan skapa stress. Höga nivåer kan försämra hälsa och fertilitet samt leda till personanpassade sammanbrott. Strategier för att hantera stress ger egna fördelar och nackdelar. Designavsikten är ett avvägningssystem där en taktiskt fördelaktig handling ibland är psykiskt dyr för just denna person. [Dev Diary 31, 16 juni 2020, officiell återpublicering](https://www.reddit.com/r/CrusaderKings/comments/ha32zg/dev_diary_31_stress/)

AI behöver samtidigt välja handlingar som passar karaktären. Dagbok 104 beskriver ekonomiska arketyper som Warlike, Cautious, Builder och Unpredictable. Personlighet, styrelseskick och kultur påverkar prioriteringar, medan hotbild och situation ändrar hur pengarna används. Detta är belagd design för ekonomisk AI, inte en fullständig beskrivning av all AI i dagens spel. [Dev Diary 104, 23 augusti 2022](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1662639233&feed=steam_community_announcements)

Spelledaren förklarade 2024 att AI ska bidra till en trovärdig värld. Exempelvis prioriteras normalt allianser och prestige i äktenskap framför optimering av ärftliga anlag. Utvecklarna måste också ta hänsyn till att hårdare regler kan skada AI mer än spelaren. [Dev Diary 147, 30 april 2024](https://store.steampowered.com/news/posts/?enddate=1714478517&feed=steam_community_announcements)

**Vår slutsats:** använd samma personmodell på båda sidor. AI:s drivkrafter ska påverka vilka alternativ den väljer; spelarens val ska få konsekvenser som passar ledaren. Det är inte belagt här att AI generellt slipper stress, och vi bör inte bygga på det antagandet. Ett antikt spel kan använda begrepp som press, samvetskval eller utmattning om de passar dess ton bättre.

## 4. Relationer, opinion och minnen fyller olika uppgifter

Den fria 1.7 Bastion-uppdateringen införde personliga minnen med händelse, tid och deltagare. De kan avse födslar, dödsfall, slag, succession och barndom. Vissa bleknar; viktiga spelarpersoners minnen sparas mer uthålligt. Minnen kan utlösa innehåll och återanvändas i händelser. Samma uppdatering gjorde skälen bakom vänskap, rivalitet och andra särskilda relationer synliga. En best friend kan därför ha både ett ursprungligt vänskapsskäl och ett senare skäl till att relationen fördjupades. [Dev Diary 105, 30 augusti 2022](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1664452457&feed=steam_community_announcements)

Vår analytiska uppdelning är:

- **Opinion:** personens samlade inställning till en annan person, med redovisade bidrag och varaktigheter.
- **Relation:** ett särskilt band såsom vän, rival, partner, mentor eller släkting.
- **Minne:** vad som hänt, vilka som var där och vilka som känner till det.
- **Politisk hållning:** stöd till en härskare, kandidat, reform eller familjeintresse i en viss fråga.

Dessa bör inte pressas ihop till ett enda lojalitetsvärde. En person kan uppskatta härskaren, motsätta sig hans efterträdare och samtidigt vara skyldig honom en tjänst. Detta är en föreslagen modell för vårt spel.

Friends & Foes utökade relationsinnehållet med händelser och husfejder. Fejder kan skapa konflikter som lever vidare mellan generationer. Detta är separat från den fria infrastrukturen för minnen och relationsorsaker. [Friends & Foes, officiell butikssida](https://store.steampowered.com/app/2114760/Crusader_Kings_III_Friends__Foes/)

**Designkrav:** en framtida karaktärsvy bör kunna svara på ”Varför stöder hon mig?” och ”Vad skulle få henne att byta sida?”. Minnet måste ha en mekanisk användning. En kronika som aldrig påverkar nya beslut blir en sammanfattning, inte en del av simuleringen.

## 5. Släktskap, äktenskap och uppfostran

Genom arv och utbildning kopplar CK3 personliga beslut till långsiktig makt. Förmyndare är ett verktyg för att forma nästa generation, medan egenskaper och livsstilsval påverkar hur karaktärer agerar. Ärftliga anlag är en annan mekanism än social uppfostran. Rapporten verifierar inte genetiska sannolikheter, porträttens DNA-parametrar eller hur alla personlighetsval viktas. [Paradox produktbeskrivning](https://www.paradoxinteractive.com/games/crusader-kings-iii/about)

Wards & Wardens gav betalda fördjupningar i barndoms- och utbildningsinnehåll, bland annat universitetsbesök för vuxna, ammor och fler möjligheter att påverka utvecklingen. Gisslansystemet kom i den samtidiga fria uppdateringen. Därmed bör ”utbildning finns”, ”utökade utbildningshändelser finns” och ”politisk gisslan finns” bedömas var för sig. [Wards & Wardens och 1.10, 22 augusti 2023](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1697037563&feed=steam_community_announcements)

Adoption lades också till gratis. Dagbok 132 beskriver begränsad åtkomst genom personliga villkor, kulturell tradition och spelregler. Det gör juridisk familjetillhörighet till en annan fråga än biologiskt föräldraskap. Källan beskriver den medeltida utformningen; dess begränsningar bör inte automatiskt överföras till antik miljö. [Dev Diary 132](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1691496129&feed=steam_community_announcements)

**Vårt designförslag:** modellera biologiska föräldrar, juridiska föräldrar, partner, hus/familj och förmyndare som skilda band. Ett äktenskap kan ge en diplomatisk överenskommelse och samtidigt få personliga konsekvenser. Beskriv vilka av dessa band som är offentligt kända. Porträtt och åldersuttryck bör presentera livsloppet, medan simuleringen äger ålder, släktskap och hälsa. Arv av utseende ska inte automatiskt betyda arv av moral eller ambition.

## 6. Makten att bli omtyckt, erkänd, fruktad eller åtlydd

CK3:s ursprungliga presentation kopplar dread till ett skräckinjagande rykte som kan få rädda undersåtar att lyda. Det är därför analytiskt skilt från att vara uppskattad. Jag har inte verifierat aktuella trösklar för Intimidated/Terrified och anger inga sådana. [Paradox ursprungliga funktionsbeskrivning](https://www.paradoxinteractive.com/games/crusader-kings-iii/add-ons/crusader-kings-iii-pre-order)

Legitimacy infördes gratis i 1.12.1 och mäter den uppfattade rätten att styra, med olika förväntningar hos vasaller. Utvecklarna skiljer detta från prestige: berömmelse innebär inte automatiskt att man anses vara rätt person på en viss tron. Härkomst, situation och handlingar påverkar legitimiteten; en efterträdare bedöms på nytt. Legends of the Dead tillförde bland annat betalda legender, medan legitimitet och epidemisystemet hör till den fria uppdateringen. [Dev Diary 145](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1709572494&feed=steam_community_announcements), [1.12.1, 4 mars 2024](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1712160251&feed=steam_community_announcements)

Hooks representerar användbara skyldigheter eller hållhakar. Secrets är information som kan exponeras eller användas till utpressning. Det ursprungliga systemet skiljer svaga hållhakar som förbrukas från starkare som kan återanvändas efter väntetid. En hemlighet som redan blivit känd kan förlora sitt utpressningsvärde. Här finns en tydlig kedja: information öppnar en politisk möjlighet, som ändrar vem som kan pressas till samarbete. [Dev Diary 5, 26 november 2019](https://forum.paradoxplaza.com/forum/developer-diary/ck3-dev-diary-5-schemes-secrets-and-hooks.1289167/)

**Vår rekommendation:** skilj åt personlig uppskattning, uppfattad rätt att styra, rädsla och konkreta förpliktelser. Visa också vad personen faktiskt kan vägra. Ett allmänt högt ”inflytande” bör inte köpa varje sorts lydnad utan motpartens intresse, roll och kostnad.

## 7. Intriger har fått större handlingsutrymme

Den fria omarbetningen av schemes i 1.13 ändrade flera delar av den ursprungliga modellen. Dagbok 157 beskriver att det äldre systemet upplevdes som för slumpmässigt. Den nya utformningen ger agentroller, olika prioriteringar mellan framgång, hastighet och sekretess, möjlighet att förbättra läget innan genomförande och risk för att intrigen avslöjas. Agenter kan också skapa egna situationer. Detta innebär att dagbok 5 inte är en aktuell specifikation för själva schemets förlopp. [Dev Diary 157, 17 september 2024](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1728553580&feed=steam_community_announcements), [Dagbok 156 om den fria uppdateringen](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1729598426&feed=steam_community_announcements)

**Vår slutsats:** för det antika spelet är en liten uppsättning politiska projekt mer användbar än en komplett intrigkatalog. Exempel: ordna en utnämning, samla stöd för en arvinge, avslöja förskingring eller avsätta en guvernör. Ett projekt behöver mål, deltagare, löften, tidsförlopp och risk. Spelaren bör kunna påverka förutsättningarna före avgörandet.

## 8. Succession och styrelseskick ändrar personernas betydelse

Den ursprungliga successiondesignen skiljer mellan arvsregler, behörighet och val. Spelaren ska kunna se arvingar och vilka titlar som riskerar att lämna huvudlinjen. Mäktiga vasaller förväntar sig samtidigt politiskt inflytande, vilket skapar ett val mellan kompetenta och politiskt nödvändiga rådgivare. Detta belägger designprinciperna; de exakta arvsandelarna och äldre klanreglerna bör inte användas som en specifikation för 2026. [Dev Diary 17, 10 mars 2020, officiell återpublicering](https://www.reddit.com/r/CrusaderKings/comments/fgdwvn/dev_diary_17_governments_vassal_management_laws/)

Roads to Power är särskilt relevant för vårt projekt. Dess administrativa styre gör familjer till politiska aktörer även när de saknar guvernörsposter. Ett ämbete är ett uppdrag som kan förloras. Familjegodset ger en beständig maktbas; inflytande används för att påverka positioner och kandidater. Familjens samlade ställning påverkar dess möjligheter. Detta skiljer familjens fortlevnad från individens aktuella ämbete. Funktionerna tillhör expansionen. [Dev Diary 148, 11 juni 2024](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1723550372&feed=steam_community_announcements)

CK3:s utvidgningar efter lanseringen innebär dessutom att en analys inte kan stanna vid en feodal monarki från 2020. All Under Heaven utvidgade världen 2025. Denna rapport gör ingen fullständig genomgång av dess regionala ämbets- och successionssystem. [Dev Diary 191, 16 december 2025](https://store.steampowered.com/news/posts/?appgroupname=Crusader+Kings+III&appids=1158310&enddate=1768917706&feed=steam_community_announcements)

**Vårt designförslag:** håll följande frågor separata: vem får ämbetet, vem får familjens tillgångar, vem blir familjeöverhuvud och vem fortsätter spelaren som? En kungatron, en republikansk magistratur och ett tidsbegränsat guvernörsämbete behöver olika regler. Här bör den valda antika kulturens historiska modell styra, med tydliga förenklingar för spelet.

## 9. Händelser behöver relevans, kontinuitet och lagom mycket uppmärksamhet

Den fria Scribe-uppdateringen 1.19, 20 april 2026, gjorde befintliga Story Cycles synliga som Stories i gränssnittet. De kan visa inblandade personer, titlar, framsteg och kopplade val. Detta ska beskrivas som ett sätt att synliggöra och följa pågående berättelser, inte som att CK3 då fick en helt ny berättelsemotor. [1.19 Scribe, officiella versionsanteckningar](https://store.steampowered.com/news/posts/?appgroupname=Crusader+Kings+III&appids=1158310&enddate=1776772711&feed=steam_community_announcements), [Realm Maintenance 2026 del II, 24 mars](https://store.steampowered.com/oldnews/?appgroupname=crusader+kings+iii&appids=1158310&enddate=1775026800&feed=steam_community_announcements&headlines=0)

Uppdateringarna 2026 minskade också störande händelsefrekvens och skärpte vilka personer som räknas som viktiga för spelaren. Alla effekter behöver inte ge en avbrytande notis. Exempelvis fick vissa hemlighets- och affärshändelser tydligare relevansvillkor. Det är ett viktigt designresultat: en stor simulering behöver filtrerad presentation, annars försvinner betydelsefulla personer i händelseflödet. [Officiella 1.19-anteckningar om event och intressefilter](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1779192003&feed=steam_community_announcements)

Åldrandet blev samtidigt mer uttryckligt genom graderade tillstånd för hjärta, skelett, syn och sinne samt en omarbetad Infirm-egenskap. Livsstil och anlag kan spela roll; tillstånden kan förvärras och hanteras. Det ger ett förlopp där rollbyte, vård och successionsplanering kan bli aktuella innan döden. [1.19 Scribe](https://store.steampowered.com/news/posts/?appgroupname=Crusader+Kings+III&appids=1158310&enddate=1776772711&feed=steam_community_announcements)

I den fria 1.20-uppdateringen tillkom Personal Tenets och Spiritual Fulfillment. Personliga trosuppfattningar kan skilja sig från religionens gemensamma lära. Förbjudna övertygelser kan bli hemligheter, och handlingar påverkar hur väl personen lever enligt sin tro. Detta är ytterligare ett lager vid sidan av personlighet och stress, inte något som hela rapportens design förutsätter att vi ska kopiera. [1.20 Crozier, Free Features, 30 september 2026](https://steamcommunity.com/games/1158310/announcements/detail/684140727200907282)

**Vår slutsats:** välj en händelse därför att den passar aktuella människor och konflikter. Spara berättelsens deltagare och orsak. Låt ett begränsat antal frågor ligga öppna över tid. När ett tillstånd ändras bör gränssnittet visa vad som hände och varför; när inget beslut behövs kan en händelse stanna i kronikan.

## 10. Gränsen mellan gratis system och DLC

Tabellen sammanfattar endast funktionerna ovan. Den är ingen komplett köpguide.

| Funktion | Belagd gräns | Källa |
|---|---|---|
| Minnen och synliga relationsorsaker | Gratis 1.7, 2022 | [DD105](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1664452457&feed=steam_community_announcements) |
| Fördjupade relationshändelser och husfejder | Friends & Foes | [Butikssida](https://store.steampowered.com/app/2114760/Crusader_Kings_III_Friends__Foes/) |
| Adoption och Eccentric | Gratis uppdatering 2023; vissa särskilda händelser betalda | [DD132](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1691496129&feed=steam_community_announcements) |
| Gisslan | Gratis 1.10; utökat utbildningsinnehåll i Wards & Wardens | [Utgivningsanteckningar](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1697037563&feed=steam_community_announcements) |
| Legitimitet och epidemier | Gratis 1.12.1; Legends-systemet i Legends of the Dead | [1.12.1](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1712160251&feed=steam_community_announcements) |
| Omarbetade intriger | Gratis 1.13 | [DD156](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1729598426&feed=steam_community_announcements) |
| Administrativt styre, familjegods och guvernörspolitik | Roads to Power | [DD148](https://store.steampowered.com/news/posts/?appids=1158310&enddate=1723550372&feed=steam_community_announcements) |
| Stories-vy och omarbetat åldrande | Gratis 1.19, april 2026 | [Scribe](https://store.steampowered.com/news/posts/?appgroupname=Crusader+Kings+III&appids=1158310&enddate=1776772711&feed=steam_community_announcements) |
| Personal Tenets och Spiritual Fulfillment | Gratis 1.20, september 2026 | [Crozier](https://steamcommunity.com/games/1158310/announcements/detail/684140727200907282) |
| Landless Adventurers som gratis grundfunktion | **Framtida förändring**, annonserad till Silk & Silver; inte levererad vid researchdatumet | [DD203, 16 juni 2026](https://steamcommunity.com/games/1158310/announcements/detail/692011879680181917) |

För Landless Adventurers säger utvecklarna att vissa specialiserade lägerinriktningar och kontrakt kan stanna i Roads to Power. Den slutliga uppdelningen beskrevs ännu som under arbete i dagboken. Vi ska därför inte ange framtida DLC-behörigheter mer exakt än källan gör.

## 11. Egen syntes för ett antikt imperiespel

Följande är förslag för vårt projekt, inte dokumentation av CK3. Förslagen bör vägas mot den separata Old World-analysen före implementation.

### Den centrala spelbara kedjan

En skicklig guvernör förbättrar provinsen. Framgången gör henne politiskt starkare. Hennes familj vill ha ytterligare ett uppdrag. Härskaren utser i stället sin son. Guvernören blir förbigången, vilket sparas som en händelse med deltagare och datum. Hon stödjer nu en alternativ tronföljare. När härskaren insjuknar blir både den gamla utnämningen och den nya alliansen avgörande.

Kedjan kräver ingen stor mängd slumpmässiga dialogrutor. Den kräver att kompetens, befattning, familj, minne, stöd och succession faktiskt påverkar varandra. Spelaren ska kunna se konflikten i förväg och agera innan den blir ett uppror.

### Minsta system som kan bära kedjan

1. **En beständig personidentitet.** Samma person-ID genom titelbyten, namnändringar, sjukdom och död. Döda nyckelpersoner finns kvar i släktträd och minnen.
2. **Ett begränsat antal relevanta personer.** Härskarfamilj, inflytelserika familjeöverhuvuden, ämbetsinnehavare och några externa kontakter får djup. Övriga kan börja enklare.
3. **Familjer med resurser och intressen.** Familjens styrka kommer från faktiska uppdrag, tillgångar och kontakter. Alla familjemedlemmar behöver inte tycka lika.
4. **Ämbeten med både nytta och makt.** En guvernör producerar resultat och får möjligheter. Utnämningar ska kunna vara skickliga, lojala eller politiskt nödvändiga val, med begripliga avvägningar.
5. **Relationer med orsaker.** Aktuellt stöd räknas från personlighet, band, minnen och sakfråga. Åsiktsförändringar visar vilka bidrag som ändrats.
6. **En succession som går att förbereda.** Kandidater, behörighet, stöd och osäkerheter visas före maktskiftet. Döden ska verkställa en redan pågående konflikt, inte skapa en godtycklig ny härskare.
7. **Några återkommande berättelser.** Utnämning, utbildning, förtroendekris, familjekrav och maktskifte räcker för att pröva dynamiken. Varje berättelse kan återkomma med andra personer och utfall.

### Tre informationsnivåer

Offentlig information bör omfatta ämbeten, familjer, kända band och öppna politiska ställningstaganden. Personlig information kan omfatta mer osäkra motiv och ambitioner som upptäcks genom samarbete. Hemlig information omfattar pågående planer och fördolda handlingar. UI måste skilja säker kunskap från misstanke. Ett AI-genererat påstående ska inte automatiskt bli ett nytt sant faktum.

### UI som gör konsekvenserna läsbara

En personvy bör börja med roll, familj, livsfas och det aktuella beslut personen är relevant för. Visa sedan kompetens, centrala egenskaper och förändringar. Relationer bör länka till sina orsaker. En successionvy ska visa alternativ och de stödjare vars beteende kan ändra utfallet. En familjevy ska förklara hur familjens makt uppstod och vilka ämbeten den vill ha.

Händelsealternativ bör visa säkra effekter separat från risker. När exakta odds saknar stabil grund är en tydlig riskklass med förklaring bättre än en påhittad procentsats. En kalender och kronika bör göra det möjligt att återfinna det gamla beslut som en senare konflikt hänvisar till.

### Tidsmodell och Open Historia

Open Historia har variabla datumhopp, en AI som redan får ändra ledartext, heltillståndsskrivningar och stegvis avslöjande av händelser. Det innebär att åldrande, död och succession måste kopplas till passerad tid och validerade tillståndsändringar. Annars kan samma tur åldra en person två gånger, AI:n välja en annan efterträdare eller gränssnittet avslöja en framtida död i förtid. Den exakta källkodsevidensen finns i [arkitekturrapporten](open-historia-architecture.md).

Den rekommenderade ansvarsfördelningen är att regler avgör identitet, behörighet, arv och genomförda effekter. AI kan föreslå dialog, motiv och händelsevarianter inom dessa regler. En tidslinje med stabila deltagare och spårbara effekter bör vara gemensam för simulering, presentation och sparfil.

## 12. Frågor att avgöra före implementation

| Beslut | Varför det ändrar systemet |
|---|---|
| Stat, släkt eller person som spelaridentitet? | Avgör vad maktförlust och död betyder |
| Vilken antik kultur och period först? | Avgör ämbeten, familjer, adoption och legitim succession |
| Hur mycket tid går per normalt beslut? | Avgör generationernas tempo, utbildning och hälsorisker |
| Är familjer ärftliga maktgrupper, politiska partier eller båda? | Avgör om en person kan byta sida utan att byta släkt |
| Hur mycket känner spelaren till? | Avgör hur diplomati, hemligheter och UI fungerar |
| Hur mycket autonomi har en guvernör eller general? | Avgör om kompetenta personer också kan bli farliga |
| Vilka berättelser ska få ta plats? | Avgör relevansfilter och mängden avbrytande beslut |
| Hur fortsätter spelet efter en misslyckad succession? | Avgör om dramatik blir fortsatt spel eller slutpunkt |

Första designprovet bör följa tre generationer i ett litet rike och dokumentera varför varje viktig person fattade sina beslut. Det behöver även pröva samma förlopp efter sparning och återläsning. Det är ett framtida acceptansprov; inget sådant speltest har genomförts i denna researchfas.

## Bedömningens gränser

Rapporten täcker de mekaniska principer som är mest relevanta för önskemålet. Den är inte en uttömmande databas över CK3-egenskaper, AI-vikter, händelseskript, alla styrelseskick eller samtliga DLC. Exakta värden behöver kontrolleras i en bestämd spelversion om de senare ska användas som jämförelse. För ett eget spel bör vi skapa egna namn, texter, balansvärden och händelser kring de valda principerna.

Nästa steg är att sammanföra CK3:s personliga orsaker och långvariga relationer med Old Worlds tätare koppling mellan personer, familjer och imperiets konkreta beslut. En avgränsad design för tid, familjer, ämbeten och succession behöver därefter fastställas innan spelkod påbörjas.

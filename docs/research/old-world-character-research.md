# Old World: karaktärer, makt och generationsskiften

Forskningsunderlag för Simons antika strategispel. Kontrollerat 30 oktober 2026. Ingen spelkod har skrivits i denna deluppgift.

Old Worlds karaktärssystem kopplar enskilda människors liv till rikets ekonomi, förvaltning, diplomati och militär. För att förstå systemet behöver man skilja mellan en persons förmågor, personens relation till härskaren, familjens kollektiva opinion och de rättigheter som följer med ett ämbete. Nedan beskriver jag dokumenterade spelregler. Förslag till det egna spelet markeras som analys.

Underlaget bygger på utvecklarens patchnotiser, publicerade DLC-beskrivningar, den officiella wikin och Steams officiella manual. Jag har inte kört Old World eller granskat dess aktuella speldata. Sannolikheter och gränsvärden som saknar säker versionskontroll ska därför behandlas som dokumentation, inte som testade motorregler.

**Versionskontrollen ändrar flera slutsatser.** Steams manual är version 1.77, daterad 8 september 2026, 275 sidor. Ändå saknar sidan 214 Schemer i två rådgivarroller som augustipatchen tillåter; sidan 57 beskriver en Zealot-förmåga som ändrades i februari. [Officiell manual](https://store.steampowered.com/manual/597180), [update #149](https://mohawkgames.com/2026/08/05/old-world-update-149/), [update #143](https://mohawkgames.com/2026/02/18/old-world-update-143/).

**Personens olika lager fyller olika funktioner.** Wisdom, Charisma, Courage och Discipline får olika effekt beroende på arbetet. En archetype ger särskilda förmågor och yrkesbehörighet. Personlighetsdrag påverkar attribut, relationer och rollernas effekter. Wikin begränsar Strengths och Weaknesses till tre vardera, inte samtliga statusmarkörer till sex. [Characters, Attributes, Archetypes och Traits](https://wiki.hoodedhorse.com/Old_World/Characters).

Den strukturella rollfördelningen omfattar följande:

| Roll | Koppling till resten av spelet |
|---|---|
| Härskare | Nationella effekter och särskilda handlingar från archetype och traits. |
| Make/maka, arvinge, hovpersoner | Dynastisk funktion och attributbaserade bidrag. |
| Guvernör | Stadsavkastning och lokala förmågor. |
| General | Enhetens stridsförmåga och specialregler. |
| Ambassador | Utrikespolitik och relationer. |
| Chancellor | Inrikespolitik, familjer och stadsuppdrag. |
| Spymaster | Underrättelser, hemliga uppdrag och nationella bidrag. |
| Agent | Verksamhet knuten till en främmande stad. |

Rådsroller kräver teknik och rätt archetype. Guvernörer omfattar Builder, Diplomat, Judge, Orator och Scholar; militära alternativ är Commander, Hero, Tactician och Zealot. [Characters, The council och Archetypes](https://wiki.hoodedhorse.com/Old_World/Characters).

**Utbildning ger inflytande över nästa generation, men inte ett helt fritt karaktärsbygge.** Manualens utbildningstabell erbjuder fyra spår. Varje spår ger tre val ur fem möjliga archetypes:

| Utbildning | Attribut | Möjliga archetypes enligt manualen |
|---|---|---|
| Philosophy | Wisdom | Tactician, Zealot, Builder, Judge, Scholar |
| Politics | Charisma | Hero, Diplomat, Judge, Orator, Scholar |
| Tactics | Courage | Commander, Hero, Tactician, Zealot, Schemer |
| Commerce | Discipline | Commander, Builder, Diplomat, Orator, Schemer |

Detta är en urvalsmekanism: utbildningsvalet begränsar kandidaterna men garanterar inte en viss enskild archetype. Manualen beskriver också hur äktenskap kan förbättra relationer med en familj eller främmande stat, med ytterligare politisk betydelse när deras avkomma hamnar i tronföljden. [Manual v1.77, s. 132 och 214](https://store.steampowered.com/manual/597180).

Tutor Child är en separat handling. Wikin anger målåldern 10–17 och att undervisning kan förbättra attribut eller utlösa ett event. Jag har inte verifierat utbildningens exakta startålder eller dagens tutorvikter i aktuella speldata. [Characters, Character actions](https://wiki.hoodedhorse.com/Old_World/Characters).

**Äktenskap förbinder släktens framtid med dagens politik.** Den officiella spelbeskrivningen knyter äktenskap till relationer med rikets familjer och betonar att personer utvecklas, åldras och lämnar plats åt nästa generation. Äktenskap är alltså både familjebildning och ett verktyg för att påverka maktgrupper. [Officiell spelbeskrivning, About This Game](https://store.steampowered.com/app/597180/Old_World/).

Spelarens kontroll har gränser. Utvecklaren Fluffster klargjorde den 8 juli 2024 att arrangerade äktenskap gäller direkta ättlingar, inte exempelvis en brorson som råkar vara arvinge. Det svaret är daterat och har inte kontrollerats genom speltest av oktoberbygget. För vår modell visar det varför släktskap, tronföljdsposition och tillåtna handlingar måste vara separata uppgifter. [Utvecklarsvar på Steam](https://steamcommunity.com/app/597180/discussions/0/4406291873011426570/).

Graviditet och infertilitet är uttryckliga tillstånd: update #110 rättade att infertila personer ändå kunde bli gravida. Samma patch gjorde att Mourning försvinner efter fyra turer. Det belägger tidsbegränsad sorg och fertilitetskontroller, men ingen viss graviditetslängd eller fullständig befruktningsformel. [Update #110, Design och Bug Fixes, 5 juli 2023](https://mohawkgames.com/2023/07/05/old-world-update-110/).

**Födsel och åldrande följer en livscykel, inte bara turklockan.** Sedan update #143 får en karaktär föda högst en gång per år även när spelet använder en annan tidskala än årsvisa turer. Samma patch ändrar sannolikheter vid slumpmässig archetypefördelning: familjeklasser har olika tendenser, och drag som passar guvernörer respektive generaler gör motsvarande yrkesarchetypes mer sannolika. Detta är dokumenterad viktning, inte bevis för en fullständig genetisk arvsmodell. [Update #143, Design](https://mohawkgames.com/2026/02/18/old-world-update-143/).

Spelaren kan välja olika dödlighetsinställningar. I juni 2026 fick den första härskaren 30 turers dödsskydd vid Lengthy Mortality och 10 vid Realistic, jämfört med tidigare 20 oavsett inställning. Utvecklaren flyttade skyddstiden till `mortality.xml`. Sådana skyddsregler gör det missvisande att beskriva all dödlighet som en enkel åldersbaserad tärningskastning. Patchen anger inte hela ålderskurvan eller alla undantag för sjukdom, skada och händelser. [Update #147, 3 juni 2026](https://mohawkgames.com/2026/06/03/old-world-update-147/).

**Arvföljd är en reglerad övergång med politiska följder.** Wikin dokumenterar fem successionslagar:

| Lag | Grundprincip |
|---|---|
| Primogeniture | Äldsta barnet. |
| Ultimogeniture | Yngsta barnet. |
| Lateral | Syskon före barn. |
| Dynastic | Äldsta personen med direkt härstamning från grundaren. |
| Seniority | Äldsta dynastimedlemmen. |

Att utse en arvinge manuellt medför en legitimitetskostnad. Wikin anger spelavslut när härskaren dör utan arvinge. Familjer är samtidigt egna politiska grupper: grundmönstret är fyra tillgängliga familjer, varav tre kan få städer. Första staden blir familjens säte. Stadsfördelning, efterfrågade lyxvaror och familjeklassens intressen påverkar opinionen. Regeln om fyra kandidater har DLC-undantag, särskilt Maurya och Tamilakam. [Nations, Succession och Families](https://wiki.hoodedhorse.com/Old_World/Nations).

Regentskap har egna regler. Sedan update #115 orsakar en regent inte det vanliga legitimitetsbortfallet vid härskarbyte; den rättmätiga arvingen blir automatiskt vald arvinge och regenten får inte ändra detta. En regent som vägrar lämna ifrån sig tronen blir Usurper. Då kan andra i tronföljden betraktas som förbigångna. Detta skiljer tillfällig maktutövning från en vanlig succession. [Update #115, 25 oktober 2023](https://mohawkgames.com/2023/10/25/old-world-update-115/).

AI:n följer inte samma livscykel i alla avseenden. Sedan maj 2026 använder AI-riken nästa vuxna i tronföljden och skapar vid behov en ny karaktär, i stället för att ha barn som härskare. Patch #151 fixar dessutom ett fall där AI:n förlorade genom avsaknad av arvinge. Att mänskliga spelare kan förlora en dynasti bevisar därför inte symmetrisk AI-dödlighet. [Update #146, 6 maj 2026](https://mohawkgames.com/2026/05/06/old-world-update-146/), [update #151, 7 oktober 2026](https://mohawkgames.com/2026/10/07/old-world-update-151/).

**Personlig opinion och familjeopinion måste hållas isär.** Personens inställning till härskaren påverkar uppdragskostnad och effektivitet som general eller guvernör. Familjens opinion påverkar dess städer och enheter samt risken för uppror. Religionens opinion påverkar religiösa städers välmående. Främmande staters och stammars opinion påverkar diplomati och krigsbenägenhet. En familje-, religions- eller nationsledares personliga relation kan därför få följder för hela organisationen. [Opinion](https://wiki.hoodedhorse.com/Old_World/Opinion).

Wikin anger nivåer på en betydligt bredare skala än ett vanligt 0–100-lojalitetsvärde: Friendly från +200, Pleased +100 till +199, Upset −1 till −99, Angry −100 till −199 och Furious från −200 nedåt. Det räcker inte att lagra en enda generell lojalitetssiffra för att återskapa beteendet. Man behöver veta vem som tycker något om vem, vilken organisation personen företräder och vilka effektregler som läser värdet. Sista meningen är en modellslutsats, inte ett påstående om Old Worlds interna klassnamn. [Opinion, nivåtabellen](https://wiki.hoodedhorse.com/Old_World/Opinion).

**Politik måste kunna märkas på kartan.** Generaler tillhör enligt den officiella wikin samma familj som sin enhet, med undantag för nationsledaren. Wikin beskriver även åldersgränser för tillsättning och pension samt risk för skada i strid. Jag använder familjebindningen som belagd struktur men lämnar de exakta ålders- och skadevärdena för verifiering mot speldata. [Units, Generals](https://wiki.hoodedhorse.com/Old_World/Units).

Karriären kan fortsätta efter fälttjänsten: update #125 ger pensionerade generaler ett drag som låter dem bli guvernörer. Samma patch ger härskare och arvinge ett extra utvecklingsval som inte behöver passa det nuvarande arbetet. Därmed kan erfarenhet utveckla både en karriär och framtida valmöjligheter. [Update #125, 26 juni 2024](https://mohawkgames.com/2024/06/26/old-world-update-125/).

Guvernörer behöver sedan maj 2025 inte längre en Garrison. Det är en central korrigering av äldre guider: lokal karaktärsförvaltning är inte längre låst bakom just den byggnaden. Patchen döljer också främmande karaktärers jobb om spelaren saknar relevant sikt eller agent i staden. Information om människor omfattas alltså av underrättelsesystemet. [Update #135, 28 maj 2025](https://mohawkgames.com/2025/05/28/old-world-update-135/).

Städernas utveckling påverkar i sin tur personerna. Wikins kulturtabell anger ökande årlig guvernörserfarenhet med högre kulturnivå. Stad och guvernör utvecklas därmed tillsammans, snarare än att karaktären enbart ger ett statiskt påslag. [Cities, Culture level](https://wiki.hoodedhorse.com/Old_World/Cities).

**Minnen kan ändra vad som går att göra.** Update #148 beskriver uppdrag som blockeras av ett kvarvarande minne och att gränssnittet nu visar antalet turer tills spärren försvinner. Minnen är därför mer än en historiktext eller ett opinionspåslag. Samma uppdatering gör negativa utfall från Influence-uppdrag mindre straffande eller ovanligare. Detta visar både tidsbegränsade relationstillstånd och aktiv balans av politiska risker. [Update #148, 1 juli 2026](https://mohawkgames.com/2026/07/01/old-world-update-148/).

Utvecklarens ursprungliga presentation beskriver hur beslut ger karaktärer nya minnen, egenskaper och relationer som kan aktivera senare händelser. Det stöder en kedja med bestående tillstånd och återkommande aktörer. Det stöder däremot inte att varje händelse kommer från en autonom personagent med egna långsiktiga planer. [Introducing Old World, 14 april 2020, Events](https://mohawkgames.com/2020/04/14/old-world-first-post/).

**Legitimitet kopplar individens prestationer till rikets handlingsutrymme.** Enligt wikin ger varje legitimitetspunkt +1 familjeopinion och +0,1 Orders per tur. En avslutad Ambition ger +10 legitimitet; efter härskarens död blir den en Legacy som normalt måste slutföras inom 20 turer och då ger +5. Event- och ambitionslegitimitet består vid succession, medan tidigare härskares Cognomen-bidrag avtar. Tio slutförda ambitioner inklusive legacies kan ge ambitionsseger när det segervillkoret är aktivt. [Legitimacy](https://wiki.hoodedhorse.com/Old_World/Legitimacy).

Räkneexempel från samma regler: +10 legitimitet innebär +1 Order per tur och +10 familjeopinion före andra modifierare. Att slutföra samma mål som Legacy ger halva det direkta legitimitetsbidraget. Det skapar en tidskonflikt mellan investering i framtiden och att hinna förverkliga den nuvarande härskarens mål. Exemplet är en beräkning av de dokumenterade talen, inte ett kört scenario. [Legitimacy](https://wiki.hoodedhorse.com/Old_World/Legitimacy).

**Religion ger en ytterligare organisatorisk koppling.** Karaktärer och städer har religiös tillhörighet; familjers konversion och religiös opinion påverkar flera delar av riket. Positiv religionsopinion kan förbättra stadslycka och negativ opinion kan ge missnöje. Grundspelets religionsrelationer ska skiljas från DLC-mekaniken Dissent. Wikins äldre grundningskrav bör inte användas som aktuella data: exempelvis ändrades kristendomens och manikeismens teknikkrav i juli 2026. [Religion](https://wiki.hoodedhorse.com/Old_World/Religion), [update #148](https://mohawkgames.com/2026/07/01/old-world-update-148/).

**DLC-delarna utvidgar olika slags konflikter.** De ska vara valbara inspirationskällor, inte oavsiktliga antaganden om grundspelet.

| Tillägg | Relevans för det dynamiska karaktärssystemet |
|---|---|
| The Sacred and The Profane, 16 januari 2023 | Prästerskap med uppdrag, religiösa konflikter, nya drag och händelser. Dissent knyter religiös opposition till lokala oroligheter. [Officiell beskrivning](https://store.steampowered.com/app/2261870/Old_World_The_Sacred_and_The_Profane/). |
| Wonders and Dynasties, 11 januari 2024 | Fler historiska startdynastier, förberedda släktträd, särskilda karaktärsdrag och dynastihändelser. Det ändrar kampanjens utgångsläge och berättelsemöjligheter; det är inte grundsystemets födelse. [Officiell beskrivning](https://store.steampowered.com/app/2587430/Old_World_Wonders_and_Dynasties/). |
| Behind the Throne, 28 maj 2024 | Rising Stars, stress/revelry, makthungriga rådgivare, Grand Vizier och politiska epoker. Vizirens personlighet påverkar stadsstyrningen; maktdelegering kan skapa tronkonkurrenter. [Officiell beskrivning](https://store.steampowered.com/app/2587420/Old_World_Behind_the_Throne/). |
| Empires of the Indus, 30 mars 2026 | Maurya utökar familjeutbudet. Tamilakam låter familjers maktpositioner påverka dominans, nationsledare, huvudstad och nationella fördelar. Det är ett mer direkt system för institutionell maktkamp än familjeopinion ensam. [Officiell beskrivning](https://store.steampowered.com/app/4129630/Old_World_Empires_of_the_Indus/). |

Grand Vizier bör inte beskrivas som en vanlig manuellt tillsatt knapp: sedan juni 2024 uppstår rollen genom händelser. Autonomous Rule har särskild företrädesregel framför viziren. [Update #125](https://mohawkgames.com/2024/06/26/old-world-update-125/). Tamilakams maktskiften fick i juni 2026 erfarenhet och Royal-status för den nya härskaren; kostnaden i rebeller för att motsätta sig skiftet beror på familjesätets kulturnivå. [Update #147](https://mohawkgames.com/2026/06/03/old-world-update-147/).

**Fyra dokumenterade korrigeringar som en rekonstruktion behöver fånga.**

| Äldre förenkling | Kontrollerad ändring | Designkonsekvens |
|---|---|---|
| Schemer har bara agent-/spionmästarjobb. | Även Ambassador och Chancellor sedan augusti 2026. [#149](https://mohawkgames.com/2026/08/05/old-world-update-149/). | Yrkesbehörighet bör vara data med versionshantering. |
| Scholar/Schemer har oförändrade grundattribut. | Grundvärdena byttes i september; även rådsavkastning ändrades. [#150](https://mohawkgames.com/2026/09/09/old-world-update-150/). | Blanda inte en äldre attributtabell med nya roller. |
| Zealot-generalens ledarförmåga är Apply Enlist. | Februari 2026 ersatte den med Heal efter varje dödande slag; mars begränsade ledarens Training-rush till enheter. [#143](https://mohawkgames.com/2026/02/18/old-world-update-143/), [#144](https://mohawkgames.com/2026/03/18/old-world-update-144/). | Förmågor måste prövas med sina måltyper och exekveringsvillkor. |
| Det spelar ingen roll när karaktärer behandlas på turen. | Oktoberpatchen behandlar dem före enheter, fixar duplicerade eventdrag och en sparningsbugg kring usurpation. [#151](https://mohawkgames.com/2026/10/07/old-world-update-151/). | Turordning och sparade övergångstillstånd är del av regelsystemet. |

**Analys för Simons spel: vad behöver vara sammanhängande innan implementation?** Följande är förslag på frågor och kvalitetskrav, inte utlovade funktioner eller en återgivning av Old Worlds kod.

1. Beskriv en person med identitet, livsstadium, familjeband, tro, förmågor, juridisk status och ämbeten. Separera tillfälliga tillstånd från varaktiga drag.
2. Håll personlig relation, familjens opinion och familjens faktiska makt åtskilda. En familj kan vara nöjd och ändå ha resurser att ta makten; en illa omtyckt individ kan vara en skicklig general.
3. Ange vad en utnämning ger och vad den kostar: produktion, möjlighet till uppdrag, institutionell makt, konkurrens om tjänster och reaktioner från förbigångna kandidater.
4. Gör utbildning till förberedelse med begränsad kontroll. Annars blir arvingen en förutsägbar beställning, och generationsskiftet förlorar sin strategiska funktion.
5. Låt minnen ha avsändare, mottagare, orsak, varaktighet och möjliga följdhändelser. En synlig krönika bör kunna förklara varför en relation eller spärr finns.
6. Definiera successionsövergången innan eventkedjor skrivs: dödsfall, lediga ämbeten, arvinge, regent, legitimitet, mål, opinionsmodifierare och effektbortfall måste få en konsekvent ordning.
7. Avgör om AI-riken får samma risker och möjligheter som spelaren. Old World visar att symmetri inte kan förutsättas.
8. Utforma ett begränsat antal orsakskedjor som går att följa genom flera system. Djupet kommer från följderna, inte från antalet egenskapsnamn.

Exempel på en sådan **föreslagen** kedja: en familjemedlem får en rik stad → familjens inflytande växer → en förbigången släkting minns beslutet → ett utbildat barn blir möjlig efterträdare → härskaren dör → tidigare ämbeten och relationer måste värderas på nytt → den regionala maktbasen kan stödja eller utmana successionen. Det egna spelet behöver bestämma vilka steg som är automatiska regler, vilka som är AI-beslut och vilka som kräver ett eventval. Denna kedja är inte verifierad som en färdig Old World-händelse.

**Det som fortfarande saknar belägg för en exakt rekonstruktion:** full dödlighets- och fertilitetskurva, samtliga åldersundantag, regler för biologiskt arv, exakt prioritet mellan samtidiga ämbeten, nuvarande tutorvikter, full succession vid varje kombination av adoption/barn/regent/usurpator, samtliga relations- och minnesavklingningar samt familjeöverhuvudens fullständiga urval. Offentliga patchar visar en del av dessa mekanismer men ersätter inte aktuella datatabeller och reproducerbara spelobservationer.

Nästa forskningssteg är att pröva ett litet antal scenarier i en bestämd Old World-version och DLC-konfiguration: utbildning till vuxenliv, ämbetsbyte och pension, härskarens död med minderårig arvinge, ingen arvinge, familjeöverhuvudets död samt en minnesspärr som löper ut. Då kan dokumenterade samband skiljas från antaganden innan de blir krav på Simons spel.

# Dynamiska karaktärer för ett antikt strategispel

Researchunderlag för Simon · 30 oktober 2026

**Efter researchen har Simon valt samtliga sex kravpelare och båda kampanjlägena: följ riket eller följ familjen.** Beslutet är omsatt i [systemdesignen](design/SYSTEMDESIGN.md), [57 acceptanskrav](design/ACCEPTANS.md), [regelgranskningen](design/rules-review.md), [integrationsplanen](design/integration-plan.md) och [ordlistan](design/GLOSSARY.md). Dessa dokument beskriver föreslagna spelregler och byggordning; karaktärssystemet är ännu inte implementerat. Researchens jämförelser nedan är fortfarande underlag, medan de senare användarbesluten styr omfattningen.

## Slutsats att arbeta vidare från

**Old World är den närmaste förebilden för kopplingen mellan personer och rikesbyggande. CK3 är den viktigaste förebilden för personligt handlingsutrymme, sociala relationer och maktöverföring.** Det är vår designbedömning utifrån källorna, inte ett beslut om att kopiera något av spelen.

Ett dynamiskt karaktärssystem behöver flera samverkande delar: personer som förändras och dör, relationer som påverkar handlingar, materiell makt som gör konflikter betydelsefulla och händelser som använder den redan existerande världen. Spelaren behöver kunna följa varför en person reagerar och hur reaktionen påverkar riket.

För ditt antika spel är den avgörande frågan därför vilka saker människor kan förändra: stadens produktion, fördelningen av jord och ämbeten, arméns lydnad, religiöst stöd, diplomatiska förbindelser och vem som får styra efter ett maktskifte. Porträtt, egenskaper och släktträd gör personerna synliga; reglerna gör dem betydelsefulla.

## Läsordning och leveranser

| Underlag | Innehåll |
|---|---|
| [CK3:s karaktärssystem](reports/ck3-character-research.md) | Personlighet, stress, relationer, minnen, släkt, utbildning, hemligheter, makt och arv. Aktuella uppdateringar och DLC-gränser. |
| [Old Worlds karaktärssystem](reports/old-world-character-research.md) | Livsförlopp, arketyper, ämbeten, familjer, resurser, ambitioner och dokumentationskonflikter. |
| [Design och händelsemotorer](reports/design-och-handelsemotorer.md) | Utvecklarnas designresonemang, händelsernas urval, deltagare, minnen, rytm och konsekvenser för vårt spel. |
| [Open Historias arkitektur](reports/open-historia-architecture.md) | Verifierade integrationspunkter i källkoden och riskerna kring tid, AI, sparning och synliga händelser. |
| [Installerad Open Historia-version](reports/installed-app-status.md) | Identifierad beta, filfingeravtryck och gränsen för vad undersökningen av appaketet verifierade. |
| [Skillgranskning och installation](skill-review/SKILL-REVIEW-SV.md) | 70 installerade skills, SkillSpector-resultat, manuella bedömningar och separat installationsmanifest. Åtta Roblox-skills har utelämnats. |

Det här dokumentet är syntesen. Bilagorna innehåller den detaljerade källförankringen. Dokumenterad regel, historisk designavsikt och vår egen rekommendation ska inte läsas som samma slags påstående.

## Jämförelse: samma beståndsdelar, olika tyngdpunkt

Tabellen sammanfattar vår läsning av källorna. Den ersätter inte bilagornas versions- och DLC-avgränsningar.

| Fråga | CK3:s tyngdpunkt | Old Worlds tyngdpunkt | Konsekvens att pröva för vårt spel |
|---|---|---|---|
| Vem är spelaren? | En person i en dynasti och en politisk ordning | En nation över flera dödliga härskare | Låt riket bestå men låt maktens innehavare förändra spelstilen. |
| Varför betyder personlighet något? | Den påverkar rollspel, sociala val, stress och AI-beteende | Arketyper och egenskaper påverkar roller, förmågor och händelser | Ge samma drag flera sammanhängande effekter. |
| Vad betyder ett dödsfall? | Relationer, anspråk, titlar och spelarkontroll kan förändras | Ledarskap, ämbeten, personliga mål och rikets förmågor förändras | Behandla maktskiftet som flera samtidiga övergångar. |
| Vilken roll har familjen? | Släkt, hus, dynasti och politiska relationer | Elitfamiljer med personer, städer och intressen | Separera släktskap från familjens politiska organisation. |
| Var sitter makten? | Titlar, vasaller, ämbeten, relationer och påtryckningar | Städer, förband, ämbeten, familjestöd och ledarförmågor | En person måste ha medel att genomföra sin ambition. |
| Hur spelar utbildning in? | Den påverkar nästa generations kompetens och möjligheter | Den hjälper forma arvingars kommande roller och arketyp | Gör fostran till en långsiktig investering med osäkerhet. |
| Hur hålls historien samman? | Relationer, minnen och sammanhängande berättelsetillstånd | Delat tillstånd som minnen, traits, relationer och projekt | Låt nya händelser läsa tidigare beslut. |
| Hur uppstår konflikter? | Personliga motiv möter rättigheter, religion och institutioner | Familjeintressen och personliga relationer möter rikets behov | Låt minst två rimliga intressen stå mot varandra. |
| Hur mycket vet spelaren? | Synliga orsaker samsas med hemligheter och intriger | Tydliga effekter och systeminformation, med osäkra händelseutfall | Skilj kända fakta från risk, misstanke och hemlighet. |
| Hur blir det omspelbart? | Andra personer och relationer förändrar samma politiska läge | Nya ledare, rollkombinationer och händelser förändrar samma 4X-val | Byt förutsättningar, inte bara text och namn. |

CK3:s officiella presentation betonar personligheter, dynastisk fortsättning och sociala handlingar. Mohawks spelbeskrivning betonar dödliga ledare, ambitioner och händelser som lämnar minnen och relationer. Tabellen är en jämförande tolkning av dessa inriktningar och de mer detaljerade bilagorna. [Paradox: Crusader Kings III](https://www.paradoxinteractive.com/games/crusader-kings-iii/about), [Mohawk: Old World Gameplay](https://mohawkgames.com/oldworld/gameplay/).

## Sex åtskillnader som bör finnas i designen

**Personlighet och kompetens.** En skicklig förvaltare kan vara girig, en modig befälhavare kan vara lojal och en god diplomat kan vara osäker. Om varje personlighet bara är ett paket kompetensbonusar blir det lätt att rangordna alla personer på en skala. Kompetens bör beskriva vad personen kan; personlighet bör påverka vad personen vill och vilka kompromisser som känns naturliga.

**Åsikt, relation och lojalitet.** Ett numeriskt omdöme, en vänskap och lydnad inför ett ämbete är olika saker. Den som avskyr härskaren kan ändå försvara staten. En släkting kan både älska härskaren och anse sig ha rätt till tronen. Separata representationer gör dessa konflikter möjliga.

**Minne, modifierare och berättelse.** Minnet beskriver en inträffad händelse. Modifieraren beskriver en aktuell effekt. Berättelsetillståndet beskriver något som fortfarande pågår. De bör kunna överleva och upphöra vid olika tidpunkter. Ett löfte kan till exempel vara aktivt även när den ursprungliga tacksamheten har bleknat.

**Släktskap och organisation.** Ett släktträd beskriver familjeband. Ett politiskt hus beskriver medlemskap, ledning, resurser och intressen. Adoption, giftermål och nya grenar behöver kunna förändra dessa på olika sätt. Ett modernt efternamn som enda familjenyckel skulle inte räcka.

**Motiv och handlingsförmåga.** Missnöje gör inte en person kapabel till statskupp. Tillgång till soldater, pengar, allierade, information och ett trovärdigt anspråk behöver påverka handlingsutrymmet. En mindre mäktig rival kan välja att förhala en reform eller sprida ett rykte.

**Spelregel och berättarröst.** Dokumentationen vi har granskat beskriver regelstyrt urval och effekter. Den ger inte stöd för att tillskriva dessa system en generell språkmodell som hittar på regler i realtid. För Open Historia, som redan har AI-genererad simulering, behöver eventuell textgenerering respektera en gemensam modell för identitet, relationer och giltiga handlingar. Detta är vår arkitekturrekommendation, inte ett konstaterande om hur alla delar i inspirationsspelens motorer är implementerade.

## Antikens särskilda designproblem

Vi bör inte utgå från att en medeltida titel- och vasallhierarki passar alla antika samhällen. En monarki, en republik och ett rike där militära befäl avgör successionen behöver olika regler. Det är en historisk designfråga som ännu kräver separat källarbete när vi väljer tid och plats.

Ett gemensamt karaktärssystem kan ändå ha samma grundbegrepp: person, släktband, politisk grupp, ämbete, tillgång, mandat och anspråk. Styrelseskicket bestämmer hur de kombineras. Då kan en vald magistrat lämna sitt ämbete efter mandatperioden utan att försvinna ur politiken, medan en avliden monarks arvtagare kan få både makt och fiender.

Det återstår att välja en konkret historisk eller fiktiv startmiljö. Researchen rekommenderar inte att alla antika samhällen får samma familjeorganisation, religionsmodell eller arvsordning. De spelmekaniska förebilderna räcker inte som historiska källor.

## Vad Open Historia ger oss och vad som måste till

Den granskade källversionen är `293a3b890142c734addd1dd0d1235995b3a43a6d`. Den har tid, världstillstånd, händelser, diplomatiska samtal och sparning. Den avgränsade källgranskningen hittade ingen sammanhängande simulering av personers liv, familjer och arv. Landets ledare finns huvudsakligen som ett textvärde. [Källanalys med fil- och radreferenser](reports/open-historia-architecture.md).

Fyra frågor måste lösas innan implementation:

1. **Tid:** ett anrop som behandlar ett turresultat är inte alltid ett förflutet år. Karaktärer måste åldras utifrån kalendern. Långa tidshopp behöver kunna stanna vid viktiga händelser.
2. **Auktoritet:** både ett nytt system och befintlig AI får inte oberoende bestämma vem som lever eller regerar. Ändringar måste gå genom samma kontroller.
3. **Sparning:** personer, relationer, pågående berättelser och slumpstatus behöver följa samma spar-, export- och återställningsförlopp som resten av världen.
4. **Spelarens kunskap:** Open Historia kan visa ett tidsförlopp stegvis. En karaktärspanel får inte avslöja ett framtida dödsfall innan den relevanta händelsen har visats.

Detta talar för ett avgränsat, versionsmärkt karaktärssystem med tydliga gränser mot AI och världens övriga regler. Exakt datamodell och teknisk lösning är inte beslutade.

## Frågor som nästa designspecifikation behöver besvara

| Beslut | Varför det påverkar resten |
|---|---|
| Kan spelaren fortsätta efter att den regerande dynastin förlorat makten? | Avgör spelidentitet, misslyckande och hur långt maktkamper kan gå. |
| Vilken tidsskala använder kampanjen? | Avgör antalet generationer, händelsetätheten och värdet av utbildning. |
| Vad får familjer kontrollera? | Avgör om missnöje blir politisk friktion eller bara en siffra. |
| Vilka regler är offentliga och vilka uppgifter är hemliga? | Avgör hur spelaren bedömer risk och förstår svek. |
| Vilka handlingar kan en AI-person ta själv? | Avgör om personerna har egna initiativ eller enbart reagerar i events. |
| Hur mycket personlighet kan förändras? | Avgör igenkänning, utveckling och förutsägbarhet. |
| Vilken betydelse har folket utanför elitfamiljerna? | Avgör om riket reduceras till hovpolitik eller får bredare samhällstryck. |
| Hur begränsar vi mängden händelser? | Avgör om spelaren känner personer eller drunknar i notiser. |

Dessa frågor är dokumenterade för nästa steg. De kräver inte att Simon väljer allt nu, och ingen implementation startar på grund av tabellen.

## Forskningsgränser och föreslagna verifieringar

Underlaget bygger på utvecklarnas egna beskrivningar, officiella manualer och patchar, utgivarvärdar för dokumentation samt Open Historias faktiska källkod. Källorna beskriver olika versioner. Bilagorna markerar när en senare patch korrigerar en äldre wiki eller manual.

Vi har inte speltestat CK3 eller Old World, inte verifierat samtliga interna vikter och inte gjort en uttömmande genomgång av varje DLC-kombination. Därför beskriver vi vissa beteenden strukturellt i stället för att uppge osäkra procentsatser. Aktuell dokumentation kan också innehålla äldre regler.

En senare empirisk kontroll bör pröva fyra situationer: samma beslut med olika personligheter, samma ämbete med olika kandidater, samma dynasti före och efter succession samt ett minne som aktiverar en senare händelse. Spara starttillstånd och registrera version, DLC, inställningar och utfall. Först då kan vi skilja en dokumenterad regel från hur en bestämd installation beter sig.

**Arbetsstatus:** research först enligt Simons instruktion. Ingen ny spelkod har skrivits i arbetskopian. Den separata beställningen att granska och installera spelutvecklingsskills är genomförd: 70 installerade, varav 63 `APPROVE` och 7 `CAUTION`. Granskningens omfattning och begränsningar finns i installationsrapporten.

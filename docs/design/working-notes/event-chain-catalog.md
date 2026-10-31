> Archived design input, 31 October 2026. See the current character-capacity and event-chains documents for implemented behavior and remaining acceptance work.

# Händelsebank: åtta kedjor

Designunderlag, 2026-10-31. Original svensk speltext; fyra steg per kedja. Ingen regelimplementation. `{…}` binds till verkliga personer, platser och tidigare val; saknas rollen ska kedjan inte skapas.

## Effektstatus och gemensamma villkor

- **E = befintlig regel**, läst i aktuell arbetskopia. Det betyder att den angivna handlingen finns, inte att en ny kedja får anropa den utan integration. **N = kräver Mains uttryckliga motortillägg**, inklusive nya val, nya effektkombinationer, rollbyten, kedjeminnen och nya belopp.
- **E1:** `src/runtime/characters/storyDirector.js:208–215,238–263`: avlastning 12 familjesilver → stress −20, åsikt +10; extra undervisning 18 → lärdom +1, åsikt +10; tempelgåva 20 → samfundsstöd +5, åsikt +12; stadsförbättring 25 statssilver → oro −12, infrastruktur +1, guvernörsåsikt +8. Befintliga gränser/clamps gäller.
- **E2:** samma källspann: tillrättavisning → oro −4, guvernörsåsikt −15, familjens stödorsak −4; veteranbetalning 22 statssilver → arméstyrka +5, befälhavaråsikt +10; extra tjänst → arméstyrka +2, befälsstress +8, åsikt −8; försoningsgåva 15 familjesilver → åsikt +18, stödorsak +4; exilkontakter 10 → inflytande +5, åsikt +8.
- **E3:** `storyDirector.js:215,255–264`: återgäldad tjänst kan ge 12 silver från givarens **personliga förmögenhet** till mottagarfamiljen, offentligt stöd (+6 familjeinflytande, +5 åsikt), eller eftergift (+4 åsikt). Kräver giltig givare, orsak och tillgångar. Befintliga minnen har deltagare och orsak; ingen allmän ärftlig fordran finns här.
- **E4:** `src/runtime/characters/index.js:315,373,475,501,510,563`: vårdval 20/5/0 familjesilver; vanlig ämbetsutnämning 15 statssilver med mandatkontroll; mentor/fokus 15 familjesilver; beskyddaransökan 10 familjesilver med prövning; årlig utbildning påverkas av verklig mentor. Ingen berättelse får kringgå dessa prövningar.
- **N för alla kedjor:** beständig gren/etapp, tidsfönster, koppling till exakt orsaksminne, engångseffekter, och återvalidering vid återkomst. Föreslagna 3/6/12 månader är designvärden, inte befintliga löften. Ett missat fönster ska stängas eller skjutas upp enligt Main, aldrig stapla flera betalningar.
- Beslutsaktör är den **nu behöriga företrädaren för berört scope**; principal, ärendeperson och betalare är separata roller. Ett kungligt ombud får inte använda principalens familjekassa bara genom sitt kungliga mandat. Gratis betyder 0 silver; ordinarie handlingskostnad kan finnas och måste visas. Ren avskrivning vid ogiltighet kostar inget och kräver inget mandat.
- Vid varje steg: kontrollera liv, mandat, relation, exil, rollinnehav och betalningsförmåga igen. Saknas behörig aktör pausas erbjudandet eller stängs säkert; tiden fortsätter. Ingen kedja orsakar sjukdom/död, tvingar återhämtning eller ändrar arvsordning. Död kommer endast från redan inträffat världstillstånd.

## 1. Sigillet utanför sjukrummet

- **Giltighet/roller:** levande allvarligt sjuk/skadad principal P; faktiskt pågående arbetsoförmågeregentskap med ombud R; en vuxen medlem H i P:s hushåll som redan har en relation till P. R och H kan vara olika personer. Main måste först ha levererat mandatlivscykeln.
- **Aktör/kassa:** hushållets behöriga aktör väljer vård; hushållet betalar. R fattar endast eventuella offentliga beslut. Ingen statlig sjukvårdsnota skapas.
- **Steg 1 — ”{H} har lagt en lista över dagens besök utanför {P}:s dörr. {R} vill få svar före rådet.”** A ”Bekosta avlastning” (E1, endast om H:s vanliga avlastningsvillkor är uppfyllda); B ”Låt hushållet hålla ordinarie rutiner” (0, N: spara valet utan hälsopåverkan). H:s stress och relation ändras bara i A; ingen gren botar P.
- **Steg 2, efter 3 månader:** A återkommer via avlastningsminnet: ”{H} har kunnat föra anteckningar över besöken.” B återkommer om P fortfarande är arbetsoförmögen: ”{H} ber att få veta vilka beslut som redan fattats.” Välj ”Be R redogöra för besluten” eller ”Låt rådet arbeta ostört” (båda 0; N: öppenhetsminne, respektive inget löfte).
- **Steg 3, vid nästa giltiga möte:** efter begärd redogörelse får R välja mellan att dela en offentlig sammanfattning (N: H:s åsikt om R +5) eller avstå (N: H:s åsikt om R −5). Vid arbetsro frågar H i stället hushållets aktör om extra vila för P: använd E4:s tillgängliga vårdval, inklusive gratis avvaktan; redan behandlat tillstånd ger endast en läsbar avslutning.
- **Steg 4 — återkomst:** vid faktisk återhämtning läser P antingen redogörelsen eller hushållets minne av avlastningen. N: engångsminne med valhistoriken, ingen automatisk tacksamhetspoäng. Om tillståndet kvarstår efter 12 månader avslutas just denna kedja som ”Rutinen fortsätter”; mandat och vård fortsätter enligt kärnan.
- **Grenarnas följder:** A kostar hushållspengar och avlastar H; B behåller resurserna. Redogörelsegrenen kan påverka H–R-relationen; arbetsrogrenen kan leda till separat vårdkostnad. Ingen gren ger R äganderätt till hushållet.
- **Säker slutpunkt:** P dör → avsluta som bevarad redogörelse, låt successionen skötas separat. R förlorar mandatet → ingen ny skyldighet läggs på efterträdaren. H dör → bevara faktiska tidigare val men stäng H:s begäran. **N:** hela brev-/redogörelseförloppet och relationseffekten; E1/E4 endast genom ordinarie kontroller.

## 2. Den tomma platsen bredvid rådsbordet

- **Giltighet/roller:** P har faktiskt återfått handlingsförmåga; tidigare vuxenregent R lever; exakt avslutad mandatperiod kan identifieras. R har redan målet inflytande/ämbete eller ett befintligt politiskt intresse, inte en ny slumpad ambition.
- **Aktör/kassa:** åter behörig kunglig aktör för utnämningar; familjens aktör för privat tackgåva. Samma spelare kan sakna det ena mandatet.
- **Steg 1 — ”{R} lämnar tillbaka sigillet men stannar vid den tomma stolen. ’Arbetet jag började behöver någon som följer det.’”** A ”Pröva ett vanligt ämbete åt R” (0 för löftet, N); B ”Tacka och avsluta uppdraget” (0; N: tydligt slut utan ämbetslöfte). Ingen gren förlänger regentskapet.
- **Steg 2, efter 3 månader:** A söker ett verkligt icke-härskarämbete som R är behörig för; erbjud E4-utnämning 15 statssilver eller ”Det finns ingen försvarbar utnämning” (0, N: brutet/avböjt löfte). B återkommer bara om R fortfarande har ett dokumenterat intresse: ”{R} söker stöd i egen familj.” Visa ett politiskt minne, inte ett påhittat uppror.
- **Steg 3, efter ytterligare 6 månader:** utnämnd R med kvarvarande ämbete bedöms mot faktisk stadsoro/roll; en giltig guvernörsgranskning kan använda E1/E2. Utan utnämning kan P:s hushållsaktör erbjuda E2-försoningsgåva 15 eller ”Låt avskedet stå fast” (0; N, ingen ny poäng).
- **Steg 4:** registrera ”fortsatt tjänst”, ”försonat avsked” eller ”avsked utan överenskommelse” med den verkliga rollen och kostnaden. N: minnet kan senare utlösa innehåll, men ger inte ärftlig rätt, veto eller permanenta modifierare.
- **Grenarnas följder:** tjänstegrenen använder statskassa och kan flytta ett faktiskt ämbete; avskedsgrenen behåller förvaltningen och kan använda familjekassa för försoning. Gratis avböjande behåller båda kassorna men lämnar det tidigare löftet synligt.
- **Säker slutpunkt:** återinsjuknande pausar P:s erbjudande; det återöppnar inte gammalt regentskap. R:s död stänger personliga löften. Ämbetsförlust stänger granskning, inte betalda historiska effekter. **N:** återhämtningsutlösare, löftesstatus och uppföljning; ingen extra ”vägran att avgå”-mekanik för vuxenregenten.

## 3. Arvingens första marginalanteckning

- **Giltighet/roller:** barn C, 8 år till före myndighet, i kontrollerad familj och faktiskt registrerad som arvinge; levande vuxen mentor M med befintligt mentorband. Släktskap ger ingen rätt till tronen genom kedjan.
- **Aktör/kassa:** familjens behöriga aktör; familjekassa. Mentor och barn är ärendepersoner, inte automatiskt beslutsaktörer.
- **Steg 1 — ”{C} har skrivit ett annat svar i marginalen. {M} vill veta om undervisningen ska följa barnets fråga eller den gamla planen.”** A ”Bekosta extra studier” (E1: 18 familjesilver, lärdom +1, åsikt +10); B ”Behåll utbildningen” (0, E1:s vanliga avböjande: åsikt −3). Spara vem som undervisade och vilken inriktning som gällde.
- **Steg 2, efter 6 månader:** A: ”{C} ber att få gå vidare med frågan.” B: ”{C} har fortsatt den ordinarie kursen.” Välj ett nytt giltigt mentor-/fokusval genom E4, 15 familjesilver, eller ”Fortsätt med nuvarande mentor” (0, N: ingen extra färdighetspoäng).
- **Steg 3, vid faktisk myndighet:** med oförändrad mentor återkommer barnets gamla fråga som ett tack eller en invändning beroende på sparat studieval; vid mentorbyte återkommer jämförelsen mellan de två undervisningsperioderna. N: olika text/minnen; personlighet och färdigheter beräknas av befintlig utbildning, aldrig av ett manusstyrt vuxenutfall.
- **Steg 4:** endast om det finns ett giltigt patronageminne och den vuxna eleven uppfyller återgäldningsvillkoren erbjuds E3: personliga 12 silver, offentligt stöd eller gratis eftergift. Utan stödminne avslutas kedjan med utbildningshistoriken, utan framtvingad skuld.
- **Grenarnas följder:** extra studier skapar en verklig kostnad/färdighetsförändring och möjlig återgäldning; bibehållen kurs lämnar medlen kvar och saknar denna förpliktelse. Mentorbyte ändrar framtida utbildningskälla, inte arvsordning.
- **Säker slutpunkt:** C:s död avslutar kedjan. M:s död före myndighet erbjuder endast ett nytt vanligt mentorval, aldrig automatisk ersättare. Förlorad arvingestatus ändrar benämningen till ”familjens unga medlem” om familjetillhörigheten består. **N:** fyrastegskoppling, benämningsbyte och exakt mentorhistorik; E3:s giltighet får inte antas enbart av utbildningsminnet.

## 4. Familjen som vill sätta sitt namn på porten

- **Giltighet/roller:** verklig rivalrelation mellan kunglig aktör A och vuxen kandidat K i annan, icke-exilerad familj F; verkligt icke-härskarämbete O som K kan inneha. F:s talare måste vara dess levande huvud/ombud.
- **Aktör/kassa:** kunglig aktör för O; statskassa för utnämning. Privat försoning är en separat familjehandling med familjekassa.
- **Steg 1 — ”{F} pekar på portens ämbetssigill. ’Vår familj tjänar riket, men ingen av oss får svara för den här platsen.’”** A ”Pröva K för O” (0, N: uttryckligt person- och ämbetsbundet löfte); B ”Avslå ämbetskravet” (0, N: avslag utan ekonomisk effekt).
- **Steg 2, efter 3 månader:** A erbjuder vanlig E4-utnämning 15 statssilver, med befintlig innehavare och följder synliga, eller gratis återtagande av löftet. B återkommer med ett försoningserbjudande endast om rivalrelationen kvarstår: E2-gåva 15 familjesilver eller fortsatt avslag 0 (N för det senare valet).
- **Steg 3, efter 6 månader:** om K nu har ett guvernörsämbete och oro ≥15, återkommer F:s löfte genom en vanlig granskning med E1/E2-alternativ. Annat ämbete eller låg oro ger bara ett läsbart tjänsteminne. Utan utnämning: N, F:s talare påminner om avslag/löftesbrott; spelaren får ”Bekräfta beslutet” 0 eller en ny vanlig, fullt prövad ämbetsansökan, utan garanterat bifall.
- **Steg 4:** avsluta med faktisk ämbetsinnehavare, eventuell oro/infrastruktur och relation efter försoningen. Inget osynligt permanent ”rivalfamilj straffar dig”-påslag.
- **Grenarnas följder:** utnämningsgrenen ändrar maktfördelning och kan leda till statlig stadsinvestering; avslagsgrenen lämnar O orört och kan köpa privat försoning. Att betala privat ger aldrig O som motprestation.
- **Säker slutpunkt:** K dör/blir obehörig → löftet stängs; F får inte automatiskt nominera en arvinge. O upphör eller A förlorar mandat → prövningen upphör, historiskt avslag finns kvar. **N:** löfte, påminnelse och grenkoppling; befintliga NPC-ansökningar måste återanvändas med sina egna rättigheter, inte utföras som spelarorder.

## 5. Brunnen vid tempeltrappan

- **Giltighet/roller:** stad S med oro ≥15, nuvarande guvernör G, ett verkligt samfund i S med levande ledare L; G och L är olika personer med dokumenterat motsatt ställningstagande eller negativ relation. Saknas sådan konflikt skapas inte händelsen.
- **Aktör/kassa:** kunglig aktör ansvarar för offentlig förbättring; familjeaktör får ge privat tempelgåva. Ledaren L får inte disponera statskassan.
- **Steg 1 — ”{G} vill laga brunnen som ett stadsarbete. {L} vill att samfundet ska stå som givare. Båda ber dig välja.”** A ”Bekosta stadens förbättring” (E1: 25 statssilver); B ”Ge samfundet en privat gåva” (E1: 20 familjesilver, stärker stöd men lagar **inte** brunnen); C ”Lämna förvaltningen orörd” (E1: 0, oro +4).
- **Steg 2, efter 3 månader:** A återkommer genom den faktiskt höjda infrastrukturen: ”Vem får nämnas vid invigningen?” Välj G eller båda (0; N: namngett erkännandeminne, G/L-åsikter +5 till den som nämns, inget nytt samfundsstöd). B/C återkommer bara om oron fortfarande är ≥15: vanlig stadsgranskning, utan retroaktiv omvandling av privat gåva till bygge.
- **Steg 3, efter 6 månader:** om relationen mellan G och L fortfarande är negativ kan familjens aktör erbjuda befintlig försoning med **en** namngiven part (E2: 15 familjesilver) eller ”Låt deras oenighet bestå” (0, N: ingen ny effekt). Berättelsen lovar inte att en tvåpartsrelation löses av en gåva till bara en person.
- **Steg 4:** läs av aktuell infrastruktur, oro och samfundsstöd; avsluta som stadsarbete, privat donation eller olöst lokal fråga utifrån verkliga val. Inga nya uppror, religionsbyten eller dödsfall.
- **Grenarnas följder:** A ger materiell stadsförbättring; B ger religiöst och personligt stöd men lämnar stadens problem; C sparar pengar med redan definierad oroökning. Gratis erkännande är en politisk följd, inte ytterligare byggbonus.
- **Säker slutpunkt:** G/L dör eller lämnar sin roll → personkonflikten stängs; redan utfört stadsarbete består. Ingen efterträdare ärver den gamles relation. **N:** konfliktfilter, erkännandeeffekt och uppföljningar. Lokal samfundsnärvaro måste ha verkligt stöd i modellen, annars får Main välja annat verifierbart rollvillkor före aktivering.

## 6. Namnet som saknas på soldatlistan

- **Giltighet/roller:** nuvarande general B, arméstyrka <80, vuxen person V med ett faktiskt minne av militär tjänst och verkligt familjeband till B eller hushållet. Utan tjänstminne får en generisk familjemedlem inte kallas veteran.
- **Aktör/kassa:** kunglig aktör; statskassa för ordinarie veteranbetalning. V:s familj betalar inte arméns lön genom berättelsen.
- **Steg 1 — ”{V} känner igen namnen som {B} läser upp. ’Vi tjänade tillsammans. Varför saknas vår insats när ersättningen delas ut?’”** A ”Betala veteranerna” (E2: 22 statssilver); B ”Kräv ytterligare tjänst” (E2: 0, styrka +2 men B får stress +8 och åsikt −8); C ”Avvisa kravet” (befintligt 0-val: arméstyrka −2, B:s åsikt −5).
- **Steg 2, efter 6 månader:** A återkommer med betalningsminnet, inte ett nytt lönekrav: ”{V} ber att insatsen ska nämnas offentligt.” B återkommer med det nya tjänstekravet om B fortfarande är general; C med det tidigare avslaget. Välj ”Nämn V:s dokumenterade insats” eller ”Låt listan stå utan tillägg” (0; N: erkännandeminne respektive avslut utan nytt straff).
- **Steg 3:** vid erkännande får V:s levande familjehuvud ett senare, frivilligt erbjudande att stödja kungliga aktören (N: riktad åsikt +5 om det accepteras; inget köp av hela familjens lojalitet). Vid uteblivet erkännande kan ett redan giltigt försoningsärende erbjudas med E2:s kostnad eller avböjas gratis; ingen automatisk fiendskap skapas.
- **Steg 4:** sammanfatta betalning/tjänst/avslag och offentligt minne separat. A och B:s arméeffekter ska bara appliceras en gång; familjeheder är här ett minne, ingen ny ärftlig hedersmätare.
- **Grenarnas följder:** A använder statsmedel och stärker armén mer; B sparar silver men belastar befälet; C sparar pengar med militär förlust. Erkännande och försoning ändrar den politiska efterhistorien utan att skriva om tjänsten.
- **Säker slutpunkt:** B lämnar ämbetet → inga nya tjänsteorder från B. V dör → offentlig hågkomst kan kvarstå men personliga erbjudanden stängs; ingen släkting tar över lönekravet. **N:** verifierbart tjänstfilter om sådant minnestypstöd saknas, erkännande och uppföljning; ingen ny soldat-/lönemodell antas.

## 7. Gästerna som blev kvar till nästa vinter

- **Giltighet/roller:** exilerad familj F har en faktiskt accepterad värdfamilj H via hostFamilyId; levande hushållsmedlem M och H:s aktuella huvud/ombud. Exil i annat rike utan värdfamilj använder inte denna kedja.
- **Aktör/kassa:** F:s behöriga hushållsaktör och F:s familjekassa. Värdens tillgångar är aldrig valbara som spelarens.
- **Steg 1 — ”{M} har fått en inbjudan till värdfamiljens släktingar. Resan kostar, men den kan ge oss fler som känner vårt namn.”** A ”Bekosta besöken” (E2: 10 familjesilver, inflytande +5, M:s åsikt +8); B ”Spara familjens resurser” (befintligt 0-val: inflytande −2).
- **Steg 2, efter 6 månader med samma accepterade värd:** A: ”Värden frågar vem som introducerade oss.” B: ”Värden undrar om familjen vill delta i umgänget.” Välj ”Tacka värden offentligt” eller ”Håll kontakterna privata” (0; N: offentlig kreditering respektive privat minne, ingen ändrad skyddsstatus).
- **Steg 3, nästa gång en verklig annan icke-exilerad familj blir ett giltigt beskyddaralternativ:** välj vanlig E4-beskyddaransökan (10 familjesilver, ordinarie prövning) eller ”Stanna hos H” (0, N). Efter offentligt tack får ansökan texten ”Ni söker er vidare efter vårt stöd”; efter privat gren handlar samtalet om hushållets framtida hemvist. N: tidigare värdens åsikt −5 endast om ett nytt skydd faktiskt accepteras efter offentligt tack.
- **Steg 4:** registrera kvarvarande värd eller faktiskt accepterad ny värd. Avslagen ansökan ersätter inte det gamla skyddet. Finns ingen ny kandidat inom 12 månader avslutas kedjan hos den nuvarande värden utan extra bonus.
- **Grenarnas följder:** A bygger inflytande mot silver; B bevarar medel. Offentlig kredit kan kosta relation vid verkligt värdbyte, privat kredit ger ingen sådan effekt. Ett nytt hem kräver ansökan, inte bara ett berättelseval.
- **Säker slutpunkt:** F återvänder eller hostFamilyId ändras utanför kedjan → avsluta gammal gästhistoria. Värdhuvudets död stänger den personliga åsiktsföljden; accepterat familjeskydd hanteras separat av kärnan. **N:** tidskoppling, offentligt tack och villkorad relationsföljd; inga garantier om tillträde till värdens ämbeten.

## 8. Brevet i den ärvda kistan

- **Giltighet/roller:** avliden D, levande juridisk efterträdare E som kärnans redan genomförda succession faktiskt identifierat, samt levande tidigare välgörare W; ett äkta, känt patronageminne mellan D och W. Brevet avser en social tjänst, inte en ny ekonomisk skuld. Utan bekräftad efterträdare skapas inget brev.
- **Aktör/kassa:** E:s hushållsaktör får välja familjens frivilliga svar. Personliga pengar kräver ägarens behöriga godkännande; E:s nya roll ger aldrig åtkomst till W:s pengar eller statskassan.
- **Steg 1 — ”Bland {D}:s papper ligger ett tack till {W}. {E} känner igen hjälpen, men brevet innehåller inget löfte från den som nu lever.”** A ”Jag vill föra tacket vidare” (0; N: E/hushållet antar en **ny social avsikt**); B ”Bevara brevet utan att ta över förpliktelsen” (0; N: historiskt minne, inga nya skulder).
- **Steg 2, efter 3 månader:** A återkommer med W:s konkreta önskemål: ”Nämn den gamla hjälpen när familjerna möts.” Välj offentligt tack (0; N: W:s åsikt om E +5) eller frivillig privat försoningsgåva genom giltig E2-handling (15 familjesilver). B återkommer som en familjemedlems fråga: ”Varför svarade vi inte?” Välj ”Läs brevet för familjen” (0, N: endast minne) eller inled nu A:s nya avsikt, utan retroaktivt straff.
- **Steg 3, efter 6 månader:** om W redan har ett giltigt eget återgäldningsminne riktat till den nuvarande aktören kan en separat E3-tjänst återkomma. Annars erbjuder W endast ett samtal om D (0, N: ingen överföring). D:s gamla patronageminne får **inte** byta beneficiaryId till E för att låsa upp pengar.
- **Steg 4:** avsluta med ”frivilligt tack”, ”privat gåva” eller ”bevarat brev”. Gamla personliga skulder och tillgångar påverkas bara av kärnans faktiska arvsregler; ett brev gör ingen skuld betalningsbar och ingen tjänst redan återgäldad.
- **Grenarnas följder:** A kan ge ny relation eller kosta familjesilver; B bevarar resurser och historia utan att binda nästa generation. En eventuell E3-gåva kräver en egen giltig, levande givare och ursprungskoppling, inte arvsretorik.
- **Säker slutpunkt:** W dör → stäng erbjudanden, behåll brevet; ingen automatisk fordran till W:s arvinge. E dör eller lämnar familjen → stäng E:s frivilliga avsikt, kedjan hoppar inte till nästa generation. **N:** bekräftad efterträdarbindning, brevminne och ny social avsikt; ekonomiskt skuldarv är uttryckligen utanför förslaget.

## Mains beslut före aktivering

Godkänn kedjemotor och rollvalidering separat från innehållet. Besluta om N-effekterna ska införas, ersättas med befintliga handlingar eller strykas. Särskilt behöver aktörsspecifika åsikter, offentligt erkännande, historiska mandat/mentorer och juridisk efterträdare tydliga, verifierbara datakällor. Katalogen ger inga produktions- eller balansgodkännanden; UI-filerna är fortsatt frysta.

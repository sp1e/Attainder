> Archived design input, 31 October 2026. See the current character-capacity and event-chains documents for implemented behavior and remaining acceptance work.

# Persistenta händelsekedjor: integrationskrav

Läsande kartläggning 2026-10-31. Main äger motorn och väljer representation,
versionshantering och eventuella schemaändringar. Nedan är åtta observerbara krav,
inte en föreskriven datamodell. Filhänvisningarna avser läst arbetskopia och är
relativa till `open-historia`. Inga tester, tjänster eller verkliga sparfiler har använts.
HEAD vid kartläggningen: `be2f72c6f4c558db42beea315e360b593359adec`.
Arbetskopian innehåller Mains pågående grundsteg; kontrollera radnummer efter integration.

## 1. Ett nytt kedjesteg måste räknas som ett nytt spelarbeslut

**Källa:** `src/runtime/characterWorld.js:289`, `:316`, `:329` och
`src/Game/AI/gameplay.js:14254`. Hosten jämför idag berättelse-id:n som redan
fanns med nytillkomna öppna `character_event`. Ett nytt steg under samma id
upptäcks inte av den kontrollen. Ett steg som öppnas direkt genom ett val kan
också redan finnas när nästa tidsförflyttning börjar.

**Krav/prov:** Välj steg A som öppnar B direkt respektive på datum D mellan
årsskiften. Begär ett längre hopp. B ska vara synligt och spelaren ska få fatta
beslut innan senare kedjeföljder verkställs. Prova både nytt berättelse-id och
fortsättning under samma kedjeidentitet enligt Mains slutliga kontrakt. Samma
datum får inte ge en oändlig pausloop. Ett uttryckligt val att avstå får följa
en dokumenterad tidsgränsregel, men ett vanligt fortsatt tidshopp får inte
tolkas som ett dolt spelarsvar.

## 2. Kedjefortsättning, urgency och cooldown behöver skilda betydelser

**Källa:** `src/runtime/characters/storyDirector.js:117`, `:185`, `:199`, `:267`;
`src/runtime/characters/index.js:574`, `:601`; `src/runtime/characterWorld.js:309`.
Dagens urval sker årsvis, begränsas till två öppna händelser och sätter
36 månaders mallcooldown samt 24 månaders personcooldown. Obesvarat beslut
förfaller till `ignore`. Vård har företräde vid samtidig beslutspaus.

**Krav/prov:** Med två öppna fristående händelser och aktiv person-/mallcooldown,
låt en pågående kedja nå nästa steg mitt under året. Den ska följa Mains valda
regel för fortsättning/konkurrens, inte oavsiktligt vänta till ett nytt årsuttag.
Dokumentera deterministisk prioritet och synlig deadline/följd vid uteblivet svar.
Prova ett akut kedjesteg och vård samma datum: båda ska finnas kvar och inget
automatiskt avgöras bakom vårdpausen. Jämför exakt deadline, dagen före och
split/hel advance. Om motorn behåller automatiskt fallback ska det vara ett
fördefinierat motorutfall, inte ett LLM-val.

## 3. Rollbyte får inte skriva om redan inträffad historia

**Källa:** `src/runtime/characters/storyDirector.js:98`, `:267`.
Nuvarande händelse stängs bland annat när deltagaren dör, spelarföreträdaren
byts, ämbetet får ny innehavare eller exilbeskyddaren försvinner.

**Krav/prov:** Mellan A och B dör en person, en guvernör ersätts eller spelarens
företrädare byts. Varje kedjeroll ska ha ett bestämt beteende: behåll historisk
person, bind framtida steg till behörig efterträdare eller avsluta med orsak.
Visa aktuell handlande person och bevara A:s ursprungliga deltagare/minne.
En ny innehavare får inte ärva personlig skuld, samtycke eller privat ägande
bara genom rollbytet. Prova även sjuk principal/regent mot Mains nya
mandatkontrakt, utan att anta att den gamla ålderskontrollen räcker.

## 4. Kostnad och befogenhet ska omprövas i varje steg

**Källa:** `src/runtime/characters/storyDirector.js:12`, `:220`, `:230`, `:255`;
`src/runtime/characters/index.js:533`.
Nuvarande val skiljer offentlig/familjekassa och kan även flytta en givares
personliga silver. Ett tidigare steg är inte en bestående fullmakt.

**Krav/prov:** Visa B medan spelaren har statligt mandat; förlora mandatet eller
byt hushållsombud före submit. B ska avvisas eller uppdateras enligt aktuella
rättigheter utan kostnad från fel konto. Kör samma kedja i riks-/familjeläge,
med utomstående kunglig regent och separat hushållsombud. Kontrollera exakta
debiteringar/krediteringar för stat, familj och person. Ett uteblivet saldo,
ogiltig mottagare eller spärrat veto ska inte delvis genomföra steget.

## 5. Ett val ger en effekt och en fortsättning, även efter avbrott

**Källa:** `src/runtime/characters/index.js:530`, `:533`;
`src/runtime/characterWorld.js:254`; `src/runtime/characterPersistence.js:6`, `:26`.
Kommandon har idempotens och kopierad state. Browserlagringen använder journal
och återställningspunkt för flera JSON-dokument.

**Krav/prov:** Dubbelklicka ett kostsamt val, upprepa samma kommando-id och försök
välja det avslutade steget med ett nytt id. Exakt en kostnad, ett utfallsminne
och ett nästa steg får uppstå. Injicera skrivfel efter journalen och gör reload:
återställning får inte lämna betalt A utan B eller två B. Gör därefter ett giltigt
nytt försök. Vid samtyckeskrav förbrukas rätt grant en gång, aldrig vid avslag.

## 6. Kausalitet måste överleva långa spel och nya generationer

**Källa:** `src/runtime/characters/storyDirector.js:62`, `:128`, `:165`, `:172`, `:259`.
Urvalet tittar idag på de senaste 1 000 minnena, undviker redan använda orsaker
och låter familjeföreträdare återgälda en avliden mottagares patronage.

**Krav/prov:** Starta A ur ett faktiskt känt minne. Lägg till mer än 1 000 senare
minnen och byt generation innan B blir aktuellt. En redan etablerad kedja får
inte tappa sin orsak för att urvalsfönstret flyttats. Bevara ursprung, deltagare
och utfall som separata historiska fakta. Ett gammalt minne får inte skapa
dubbla kedjor genom reload eller avslut/återöppning. Hemliga minnen får inte bli
synliga för en ny spelarföreträdare utan stöd i befintlig synlighetsregel.

## 7. Kalender och sparfil ska bevara samma kedja utan nya slumpdrag

**Källa:** `src/runtime/characters/storyDirector.js:21`, `:27`, `:192`;
`src/runtime/characterWorld.js:279`; `src/runtime/characters/index.js:589`.
Direktorn har separat sparad RNG. Dagens validator antar enstegshändelser,
tolv månaders deadline och en begränsad statusmängd.

**Krav/prov:** Kör samma syntetiska kedja och samma daterade spelarval med långt
hopp, steg till varje verklig gräns samt JSON-export/laddning mellan stegen.
Jämför stegstatus, rollbindningar, cooldowns, RNG, ekonomiska saldon och daterad
historia; enbart transportrevision/kommando-id får skilja sig där kontraktet
tillåter det. Upprepad visning/normalisering får varken välja gren eller dra
slump. Äldre giltiga enstegshändelser ska bevaras. Trasiga steg-/orsaksreferenser
ska avvisas enligt Mains kontrakt utan mutation av indata. Main avgör hur
validator och versionsgräns representerar detta; ingen schemaändring förutsätts.

## 8. LLM får beskriva läget, aldrig verkställa spelarens kedjeval

**Källa:** `src/runtime/characterWorld.js:334`, `:373`, `:382`, `:403`, `:424`, `:440`;
`src/Game/AI/gameplay.js:7854`, `:7860`.
Motorn kortar redan turhorisonten, rensar modellens characterOps och presenterar
kommandoidéer som förslag. Senare uppkommen tidigare beslutspunkt kan avvisa
ett modellsvar som sträcker sig för långt.

**Krav/prov:** Mata hostadaptern med syntetiska modellsvar som påstår att spelaren
valt B, bifogar ett känt spelar-id eller försöker infoga checkpoint/patch.
Inget val, stegbyte eller privat/statlig betalning får ske på den grunden.
Låt en hosthändelse skapa en tidigare kedjepaus än prognosen: senare utfall får
inte sparas och senare grenutfall får inte presenteras som inträffade. Prognos,
LLM-horisont och committed replay ska stanna på samma tillåtna datum.
Proven behöver ingen riktig modell. UI ska visa det ännu obesvarade valet.

## Leveransgräns

Detta är krav för Mains kommande kontrakt och integration, inte en felrapport
mot det nuvarande enstegssystemet. Innehållsvariation och innehållsbank ägs i
separat uppgift. Kraven bör användas för frysta syntetiska integrationstester
och därefter isolerad browser-QA; den här kartläggningen ger inget test-PASS.

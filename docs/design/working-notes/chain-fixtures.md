> Archived design input, 31 October 2026. See the current character-capacity and event-chains documents for implemented behavior and remaining acceptance work.

# Fem adversariella scenarier för händelsekedjor

2026-10-31. Underlag till Mains frysta integrationskontrakt. Scenarierna bygger på
[de åtta integrationskraven](event-engine-acceptance.md). Detta är testdesign;
inga scenarier har körts och dokumentet ger inget test-PASS.

Main väljer schema, lagringsformat och API. Namnen A/B, R/H och orsak M nedan
beskriver roller och observerbara händelser, inte nya fält. Belopp, datum och
testmallars innehåll är syntetiska testförutsättningar. En implementerad adapter
måste uttrycka dem med det godkända kontraktet innan testerna kan köras.

## Gemensam uppställning

Använd ett isolerat syntetiskt spel med staten på 100 silver, hushåll F på 80,
utomstående hushåll G på 60 och personlig givare D på 25. Beloppen är separata
konton. Alla övriga konton ska vara oförändrade av kedjevalet. Håll vanlig
kalenderekonomi avstängd i testadaptern, eller jämför med en identisk kontrollgren
utan kedjeeffekten och redovisa kedjans exakta differens. Återställ uppställningen
inför varje delprov.

Logga datum, synligt beslut, aktuellt offentligt ombud, hushållsombud, principal,
ägare, kontosaldon, orsaksminne, utfallsminnen och antal fortsättningar. Använd
motorns befintliga identiteter för jämförelsen. Exportera/ladda endast syntetiska
data. Modellpåståenden kan injiceras som teststrängar; ingen verklig modell behövs.

## 1. Nästa steg öppnar mitt under året och stoppar tidshoppet

**Koppling:** krav 1, 2, 7 och 8.

**Start:** På datum -0300-02-01 väljer spelaren A. Testmallen säger att B ska öppna
-0300-07-15. B kostar 10 offentliga silver vid ett uttryckligt ja; A kostar 0.
Principal och behörigt offentligt ombud R förblir samma. Mall-/personcooldown är
aktiva, och två fristående händelser konkurrerar redan om plats. Main måste före
körning ange hur sådana händelser köas/prioriteras mot kedjefortsättning samt B:s
deadline och tillåtna fallback. Testet får inte välja den policyn åt motorn.

**Förlopp:** Begär ett hopp till -0299-01-01. Jämför med separata hopp till dagen
före och fram till -0300-07-15, samt JSON-laddning efter A. Prova också varianten
där A öppnar B direkt på samma datum. Lägg i ett delprov en vårdpaus samma dag
som B; kontrollera båda besluten efter den första pausens hantering. Mata sedan
hostadaptern med ett syntetiskt modellsvar som hävdar att spelaren redan valt B
och betalat, inklusive ett försök att återanvända ett spelar-kommando-id.

**Synligt utfall:** Spelaren får ett obesvarat B vid dess beslutspunkt enligt
Mains köregel, före senare kedjeföljder. Vårdpausen får inte konsumera B. Vid
direkt fortsättning ska nästa steg gå att besvara utan en oändlig pausloop.
Modelltext får inte presentera det obekräftade valet som genomfört. Kontrollera
dessutom dagen före, exakt på och efter den fastställda deadlinen enligt samma
fallbackregel i hel och uppdelad advance.

**Exakta invarianta regler:** Fram till spelarens giltiga ja är saldona
100/80/60/25. Ett giltigt ja ger 90/80/60/25 och ett utfallsminne för B. Vid
modellens injicerade svar är kedjeeffekt, betalning och nya utfallsminnen 0.
R, principal och ägare ändras inte av visning, paus, reload eller val. Hel och
uppdelad advance med samma daterade val ger samma kedjehistorik och RNG-läge.

## 2. Olika personer företräder offentlig och privat kassa

**Koppling:** krav 3, 4 och 5.

**Start:** R tillhör G och har giltigt offentligt mandat för principal P. H är
ett annat giltigt ombud för F. Ingen är contested. Testa två separata varianter
av B: ett offentligt beslut som kostar 10, och ett hushållsbeslut som kostar 12
från F. Kostnadstexterna ska ange rätt konto och aktuell handlande person.

**Förlopp:** Visa B med giltig behörighet. Byt sedan det relevanta ombudet innan
submit och försök skicka det gamla valet. Gör också delprov där R har enbart
offentligt mandat och försöker välja för F, respektive H har enbart F:s mandat
och försöker välja offentligt. Efter uppdaterad vy ska det nya behöriga ombudet
kunna välja. Om kontraktet kräver samtycke används ett giltigt samtycke för just
det aktuella mandatet; ett äldre ombuds samtycke får inte följa med.

**Synligt utfall:** Vyn visar rätt företrädare och betalande konto. Vid ändrad
behörighet får spelaren ett avslag eller en uppdaterad beslutspunkt enligt
kontraktet, utan en gammal framgångsbekräftelse. Ett nytt ombud ska inte beskrivas
som deltagare i redan genomfört A.

**Exakta invarianta regler:** Avslag behåller 100/80/60/25 och skapar 0
utfallsminnen, 0 fortsättningar och 0 förbrukade samtycken. Giltigt offentligt
val ger 90/80/60/25; giltigt privat val i separat återställt prov ger
100/68/60/25. Om båda genomförs i en kombinerad gren är slutvärdet 90/68/60/25.
G:s 60 och D:s 25 får aldrig finansiera dessa val. Principalskap, kroninnehav
och ägande följer sina befintliga system och överförs inte av kedjan.

## 3. En person dör mellan två steg

**Koppling:** krav 3, 4 och 7.

**Start:** A har skett med personen X. I den syntetiska testmallen kräver B
X:s personliga närvaro och skulle kosta 7 från F. För denna mall väljer Main
uttryckligen beteendet att stänga B när X dör. Ett separat delprov använder en
mall vars framtida ämbetsroll i stället får bindas till den behöriga efterträdaren
Y. Där kräver B ett nytt offentligt beslut som kostar 10.

**Förlopp:** Låt X dö efter A men före B. Ladda om före B:s datum. Försök skicka
ett tidigare visat B-val med X som aktör. I ämbetsvarianten gör Y sedan ett nytt
giltigt val. Jämför lång och uppdelad advance över dödsdatumet.

**Synligt utfall:** Den personliga grenen visar att fortsättningen avslutats på
grund av X:s död. Ämbetsgrenen visar Y som aktuell aktör. I båda fallen står X
kvar som den historiska deltagaren i A. Y ärver inte X:s personliga löfte,
samtycke eller skuld genom att tillträda ämbetet.

**Exakta invarianta regler:** Stängning och gammalt submit ger 0 kedjebetalning;
personlig variant stannar på 100/80/60/25. Ämbetsvarianten ger 90/80/60/25 först
när Y:s nya beslut lyckas. Befintlig arvshantering kan ändra ägare, men jämförd
med kontrollgrenen tillför kedjan 0 arvstransaktioner och 0 successioner.
A:s ursprungliga aktör och utfall består; stängningen sker en gång efter reload.

## 4. Orsaken överlever 1 001 nyare minnen och JSON-laddning

**Koppling:** krav 3, 6 och 7.

**Start:** Ett känt orsaksminne M startar A. Testmallen anger ett framtida B som
kan fortsätta för F:s behöriga företrädare i nästa generation. B tar emot exakt
5 personliga silver från givare D till F; D överlever och har 25. Lägg till
1 001 senare, orelaterade minnen efter att kedjan etablerats. Byt generation
enligt befintliga regler innan B blir aktuellt.

**Förlopp:** JSON-exportera/ladda mellan A och B och upprepa laddning samt
visning. Jämför med en gren utan laddning. Prova en offentlig M och en hemlig M
som den nya företrädaren saknar rätt att läsa. Hemlighetsprovet följer befintlig
synlighetspolicy; Main anger före körning om B då ska döljas eller visa en
begränsad förklaring. Återanvändning av M efter avslut får inte starta en
dubbel upplaga av samma etablerade kedja.

**Synligt utfall:** Den tillåtna fortsättningen finns kvar och anger rätt aktuell
företrädare, med A:s ursprungliga deltagare kvar i historiken. Den hemliga
orsakens text avslöjas inte genom kort, förklaring eller minnesvy.

**Exakta invarianta regler:** Före giltigt B är saldona 100/80/60/25; efter B
är de 100/85/60/20. Summan F+D är 105 både före och efter. Visning och reload
ger 0 betalningar, 0 nya kedjor och 0 slumpdrag. Det finns en etablerad
fortsättning från M och ett utfallsminne för det genomförda B. Ingen senare
företrädare får bli retroaktiv deltagare eller givare i A.

## 5. Dubbelt submit och avbruten journalförd sparning

**Koppling:** krav 4, 5 och 7.

**Start:** A väntar på ett giltigt offentligt val som kostar 10 och skapar B.
R är behörig och har, om kontraktet kräver det, ett oanvänt giltigt samtycke för
detta mandat. Alla saldon har startvärdena ovan.

**Förlopp:** Skicka valet två gånger med samma kommandoidentitet, därefter med
en ny identitet mot redan avslutat A. Kör från återställd start även skrivfel
efter journalens skapande, mellan varje faktisk dokumentskrivning och efter
sista dokumentskrivningen före journalstädning. Använd Mains faktiska
persistenskontrakt för felpunkterna. Ladda om genom den normala
återställningsvägen och skicka om det ursprungliga valet. Prova sedan ytterligare
reload. Injicera endast fel i isolerad syntetisk lagring.

**Synligt utfall:** Efter återställning ser spelaren antingen ett ännu obesvarat
A eller ett genomfört A med ett tillgängligt B, enligt journalens återställningsregel.
Vyn får inte visa betalt A utan fortsättning. Ett upprepat submit får inte ge
en ny framgång som antyder att spelaren köpt eller valt en andra gång.

**Exakta invarianta regler:** Varje felpunkt måste återställa exakt ett av två
sammanhängande tillstånd: (a) 100/80/60/25, A obesvarat, 0 B, 0 utfallsminnen
för valet, samtycket oanvänt; eller (b) 90/80/60/25, A genomfört, 1 B,
1 utfallsminne, samtycket förbrukat en gång. Efter ett giltigt återförsök ska
tillstånd (b) gälla. Inget tillstånd får ha 80 i statskassan, dubbla B eller
förbrukat samtycke efter ett avvisat val. R, principal och ägare ändras inte.
Tillåt endast de skillnader i transportrevision/kommandohistorik som Mains
kontrakt uttryckligen medger; ekonomin och kedjehistoriken ska vara identiska.

## Inför körning

Main behöver frysa kö-/deadlinepolicy, de två mallarnas dödsbeteende,
synlighetspolicy, rättighetskontroll och journalens återställningskontrakt.
Testadaptern kan därefter mappa dessa fem scenarier till befintliga API:er.
Detta dokument ändrar inga produktionsfiler och kräver ingen körning mot
pågående kärnintegration.

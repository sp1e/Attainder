> Archived design input, 31 October 2026. See the current character-capacity and event-chains documents for implemented behavior and remaining acceptance work.

# Vuxenoförmåga: prioriterade black-box-acceptansfall

Underlag till Main, 2026-10-31. Fallen är förberedda men inte körda. De bygger på `adult-incapacity-proposal.md`, D1–D3 och den godkända D2-preciseringen i `adult-incapacity-plan.md`. Main äger kärnimplementationen. Detta dokument föreskriver inga moduler, funktioner eller nya produktionsfiler.

Prioriteringen är fall 1–12 i ordning. Alla är acceptanskrav. Använd syntetiska kampanjer med bestämda sjukdomsdatum och utfall. Observera beslut, meddelanden och resursägare via spelets publika gränssnitt samt dess exporterade sparfil. Vid jämförelse av olika kalendersteg får transportmetadata som revisions- och kommando-id skilja sig; spelutfall, ekonomiska saldon och daterad spelhistorik ska stämma. För ekonomi avser ”oförändrat” övergångens egen effekt, med vanlig årsinkomst och uttryckligen valda kostnader redovisade separat.

## 1. Utomstående kunglig regent får inte tillgång till familjens pengar

**Indata:** Vuxen härskare A i familj F blir svårt sjuk. Kunglig regent R tillhör familj G. F har en annan behörig hushållsföreträdare H; R har inget familjemandat för F. Notera privata tillgångar och skulder för A samt saldon/ägare för F, G och statskassan.

**Handling:** Aktivera sjukdomsregentskapet. Försök fatta ett tillåtet statsbeslut genom R och därefter använda R:s kungliga rätt för att ge bort F:s pengar eller adoptera för F. Ordna sedan vård av A genom F:s behöriga hushållsföreträdare.

**Observerbart resultat:** Statsbeslutet belastar endast rätt offentligt konto. Kungligt mandat ensamt tillåter inte familjens betalning eller adoption. Vården belastar F enligt det valda vårdbeslutet och visar rätt handlande person. A behåller krona, rättsligt anspråk och personlig egendom; F behåller familjeägandet och spelidentiteten. R:s familj får inte automatiskt A:s eller F:s resurser.

## 2. Ingen frisk företrädare: spärrade order men spelbar kalender

**Indata:** En svårt sjuk vuxen är både härskare och familjehuvud. Ingen annan levande vuxen är kvalificerad. Sjukdomen har ett bestämt återhämtningsdatum mitt under året.

**Handling:** Öppna person-, mandat- och handlingsvyer. Försök utföra en statsorder och ett hushållsbeslut. För sedan tiden fram till återhämtningsdatumet, även genom tillgänglig tidskontroll i UI.

**Observerbart resultat:** Spelet anger att ombud saknas och varför besluten inte kan utföras. Ingen otillåten kostnad eller falsk företrädare uppstår. Kalendern är användbar och kampanjen avslutas inte enbart för att ombud saknas. På återhämtningsdatumet återfår principalen rätt att agera utan väntan på årsskifte. Vyerna fungerar även utan ett ombud att visa.

## 3. Äldre sparfil: första ordern får inte använda gammal fullmakt

**Indata:** En giltig äldre sparfil saknar den nya funktionens metadata men innehåller en vuxen härskare med pågående severity-3-sjukdom och en möjlig frisk regent. Notera datum, ekonomiska saldon, historik och sparad slumpstatus.

**Handling:** Ladda samma fil två gånger oberoende, visa presentationen upprepade gånger och spara/ladda resultatet. Försök omedelbart fatta en statsorder som den gamla vuxna företrädaren, utan att först flytta tiden. Prova separat en fil med en framtida, ostödd feature-version.

**Observerbart resultat:** Aktuell representation är korrekt redan före första ordern. Ordern följer det nya mandatets rättigheter och veto; ingen gammal vuxenfullmakt passerar. Laddning och visning avancerar inte tiden, drar ingen slump och skapar inga kostnader eller påhittade historiska händelser. Upprepad laddning ger samma aktuella tillstånd. Den ostödda versionen avvisas med begripligt fel utan att originalfilen ändras.

## 4. D3 och engångssamtycke: rätt mandat, rätt regent, rätt episod

**Indata:** A har ett veto-belagt kungligt mandat och ett giltigt samtycke för en utnämning. Det finns också ett separat familjemandat. Förbered dessutom en äldre sparfil med ett oförändrat minority-mandat och ett giltigt oanvänt samtycke.

**Handling:** Ladda minority-filen och använd dess samtycke. I sjukdomsfallet, försök först utnämna en ogiltig kandidat, sedan en giltig kandidat och därefter en andra giltig kandidat. Upprepa det första lyckade kommandot med samma id. Prova separat användning efter utgångsdatum, regentbyte och återhämtning följd av återinsjuknande.

**Observerbart resultat:** Samma oförändrade legacy-minority-mandat behåller sitt giltiga samtycke. Ett misslyckat val förbrukar varken samtycke eller pengar. Ett lyckat val förbrukar exakt ett samtycke från rätt mandat; familjens tillstånd påverkas inte av kunglig konsumtion. Replay med samma id gör inget igen. Andra ordern, utgånget samtycke och återanvändning efter regentbyte eller ny sjukdomsepisod kan inte kringgå vetot. Gamla minority-samtycken följer aldrig med till en ny vuxenoförmågaepisod.

## 5. D1: myndighetsdag under sjukdom skjuter upp överlämningen

**Indata:** En minderårig huvudperson fyller 18 mitt under året medan en kvalificerande svår sjukdom pågår. Den friska regenten har giltiga samtycken och en pågående väntetid för en tidigare förhandling. Förbered två identiska kampanjer: en regent som normalt lämnar över och en som uppfyller befintliga villkor för omstridd överlämning.

**Handling:** För tiden till födelsedagen, sedan till återhämtningsdatumet. Försök omförhandla under kvarvarande väntetid. Visa/spara/ladda på båda datumen och upprepa samma tidssteg.

**Observerbart resultat:** Myndighetsdagen skapar ingen gratis ny episod, nya samtycken eller nollställd väntetid. Behörig representation består medan sjukdomen kräver den. På återhämtningsdatumet prövas den vanliga minority-överlämningen en gång: normal återlämning i första kampanjen och befintlig konflikt i den andra. Visning, laddning och replay upprepar inte prövning eller kostnader. Vuxensjukdom i sig skapar ingen ny konfliktregel.

## 6. Befintlig konflikt får inte försvinna genom sjukdom

**Indata:** En redan vuxen principal och regent har ett contested-mandat från tidigare minority-överlämning. Principal insjuknar svårt och återhämtar sig senare. Regentens mandatkonflikt är ännu olöst.

**Handling:** För tiden genom insjuknande och återhämtning. Försök utföra reserverade statsbeslut under båda tillstånden. Lös därefter konflikten genom en giltig befintlig uppgörelse.

**Observerbart resultat:** Sjukdom och tillfrisknande tar inte bort konflikten eller ger någon av parterna en genväg förbi spärren. En giltig uppgörelse har sin vanliga kostnad och effekt exakt en gång. Övriga separata familjerättigheter och ekonomiska ägare består.

## 7. Samtidig återhämtning, död och myndighetsdag

**Indata:** Härskare A är svårt sjuk och en kvalificerande sjukdom skulle upphöra på datum D. Ett annat redan bestämt sjukdomsutfall gör att A dör på D. A:s första efterträdare B dör också på D. Nästa levande efterträdare C fyller 18 på D. Notera privata tillgångar och rättslig tronföljd före D.

**Handling:** Avancera direkt till D. Jämför med framflyttning som stannar dagen före D och med sparfil/resume. Läs händelserna och försök utföra nästa giltiga statsorder.

**Observerbart resultat:** Ingen av de samtidigt avlidna väljs som ny härskare eller regent. Ingen mellanliggande återlämning gör A handlingsförmögen innan döden behandlas. Den vanliga successionen väljer C om C är rätt behörig kandidat enligt utgångsläget; myndighetsdagen bedöms på D. Arv och dödshändelser verkställs exakt en gång med oförändrade regler för personlig respektive gemensam egendom. Alla tre tidsvägar ger samma slutläge och daterade historia.

## 8. Flera sjukdomar: sista orsaken styr återlämningen

**Indata:** En vuxen har två överlappande kvalificerande sjukdomar med olika slutdatum. Den första går till `scarred`, den andra stannar i `recovering`. Det finns en frisk regent med ett redan beviljat samtycke. Förbered negativa kontrollfall med severity 2, enbart sorg och redan läkta ärr.

**Handling:** För tiden till första och sista slutdatumet, båda mellan årsskiften. Behandla ett av tillstånden om det ändrar förloppet. Visa porträtt och mandat. Låt sedan personen återinsjukna efter full återhämtning och försök återanvända det tidigare samtycket.

**Observerbart resultat:** Första läkningen avslutar inte regentskapet medan den andra orsaken kvarstår och skapar ingen ny episod. Sista läkningen återger förmågan exakt då. Porträttet behåller samma person; ärr kan bestå utan att hålla mandatet aktivt. Återinsjuknandet får inte använda tidigare samtycke. De negativa kontrollfallen aktiverar inte vuxenregentskap.

## 9. D2: sjuk regent ersätts utan kedja, med olika exilregler

**Indata:** Den äldsta regenten R blir svårt sjuk. Familjen har en yngre frisk vuxen S med lindrig sjukdom och en äldre svårt sjuk kandidat T. Kör varianter med kungligt mandat, familjens eget exilhushåll och en extern familjefallback i exil. Kör även ett befintligt minority-mandat med en frisk redan tillsatt regent i exil.

**Handling:** Avancera till R:s insjuknande och granska vem som kan fatta beslut. Prova separat R:s död. Ladda/visa det redan tillsatta friska minority-fallet utan ny sjukdom.

**Observerbart resultat:** S väljs framför T när S är politiskt behörig; lindrig sjukdom utesluter inte S. R ersätts som fysisk företrädare utan att R:s eget ombud bildar en representationskedja. Ny kunglig vuxenregent från exil är inte tillåten. Familjens egen exilmedlem kan företräda sitt hushåll, medan extern exilfallback inte väljs. En frisk redan tillsatt minority-regent avsätts inte retroaktivt för exil. Blir den minority-regenten själv svårt sjuk får den ersättas enligt den godkända preciseringen. Saknas kvalificerad ersättare gäller fall 2.

## 10. Samma kungliga veto över kampanjläge och beslutskanal

**Indata:** Samma principal, regent och veto-belagd utnämning i kopior av kampanjen: rikesläge, familjeläge där familjehuvudet är kunglig regent och en utomstående spelarfamilj som saknar statsmandat. I ytterligare en kopia har principalens familj en separat förmyndare. Det finns ett gammalt `promise_due` eller `legacy_claim` om ett ämbete.

**Handling:** Försök direkt utnämning i behöriga spelarlägen. Låt års-AI:n behandla en vakans och använd `observe` respektive `advocate` från utomstående familj. Upprepa med ett giltigt kungligt samtycke. Låt ett blockerat ärende skjutas upp till ett datum mitt under året.

**Observerbart resultat:** Ingen kanal kringgår samma kungliga veto. Spelarkontrollerad regent konkurrerar inte med en parallell AI-utnämning. Familjeförmyndarskap ensamt ger inte statsmandat. Avslag gör inga otillåtna betalningar; en tillåten åtgärd använder rätt konto och samtycke. Uppskov kostar inget, bevarar ärendet och visar val igen på det exakta datumet utan omedelbart automatiskt avgörande.

## 11. Sjukdom ändrar inte projektägare eller lånar dubbla bonusar

**Indata:** Principal har ett tidsbundet personligt projekt vars ursprungliga sluttid infaller under sjukdomen. Ett annat personligt projekt är fortfarande giltigt efter återhämtning. Regenten har en egen möjlig bonus. Offentlig byggnation och familjens egendomsprojekt pågår samtidigt.

**Handling:** Jämför effekter före sjukdom, under regentskap och vid återhämtning. För tiden förbi det första personliga projektets sluttid. Kontrollera projektägare, slutdatum och offentlig/familjeanknuten färdigställning.

**Observerbart resultat:** Otillgänglig principalbonus är inte aktiv samtidigt som regentens motsvarande effekt. Utgången bonus återuppstår inte och dess sluttid förlängs inte. Bara fortfarande giltiga, behöriga personliga effekter kan återkomma vid friskförklaring. Byggnation, familjeegendom och deras ägare behåller sina tidplaner utan sjukdomsutlöst överföring.

## 12. Långt hopp och återupptagen kampanj ger samma sjukdomsmandat

**Indata:** En syntetisk 60-månaderskampanj innehåller överlappande svår sjukdom, regentbyte, myndighetsdag under sjukdom och senare återinsjuknande. Minst ett samtycke förfaller och ett uppskjutet ämbetsärende återöppnas mellan årsgränser.

**Handling:** Kör från samma startläge som ett långt hopp, i månatliga steg och i månatliga steg med export/laddning efter varje steg. Upprepa ett redan genomfört tidssteg och ett lyckat kommando med samma id. Jämför även efter varje verklig sjukdoms-/mandatgräns där båda körningarna kan observeras.

**Observerbart resultat:** Samma personer utövar samma mandat vid samma datum, med samma kvarvarande eller förbrukade samtycken. Kostnader, ägande, sjukdomsutfall och daterade händelser stämmer mellan vägarna. Ingen extra historik eller slumpförbrukning kommer av laddning, presentation eller replay. Ett upprepat id ger inte ytterligare betalning, arv, mandatbyte eller berättelseåtgärd.

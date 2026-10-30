# Acceptans: hela karaktärssystemet

30 oktober 2026 · 57 krav · samtliga obligatoriska för färdig leverans

**Aktuell status:** en första implementation och beteendetester finns. [Implementationsstatus](../reports/IMPLEMENTATION-STATUS.md) samlar evidens och kvarvarande gränser; [kärnans kravgranskning](../reports/character-core-acceptance.md) följer varje ID nedan. De 57 kraven är fortfarande slutleveransens grind och är inte samlat godkända. Ett godkänt dokument bevisar inte spelbeteende. Varje krav behöver implementationens revision, reproducerbart starttillstånd, utförda handlingar, observerat resultat och hänvisning till test eller spelprotokoll. Kraven gäller den integrerade Open Historia-baserade kampanjen.

Numreringen följer användarens sex punkter, det beslutade kampanjvalet och tvärgående krav. [Systemdesignen](SYSTEMDESIGN.md) definierar det avsedda beteendet. [Regelgranskningen](rules-review.md) innehåller kompletterande gränsfall; dess R-ID:n hänvisar till granskningsfall, medan K-, M-, T- och E-ID:n här är huvudkraven.

## K1. Karaktärer förändrar möjliga strategier

| ID | Krav | Godkännande genom observerat beteende |
|---|---|---|
| K1.01 | Härskararketyper ger skilda möjligheter | I samma strategiska läge ger två olika arketyper minst en olika tillåten handling eller verklig effekt med förklarad orsak. |
| K1.02 | Personlig förmåga upphör vid rätt gräns | Död, abdikation och avsättning prövas var för sig; en inaktuell knapp eller köad order kan inte använda förmågan. |
| K1.03 | Genomförda resultat består enligt sina regler | En färdig byggnad eller antagen lag finns kvar efter ledarbyte, medan personliga fördelar upphör. |
| K1.04 | Pågående projekt har övergångsregler | Projekt som fortsätter, pausas eller avbryts hanteras enligt innehållets uttryckliga regel och förklaras för spelaren. |
| K1.05 | Förmågor kan inte staplas genom ledarbyten | Upprepad avsättning och återkomst ger inga dubbla effekter; varje byte kräver giltigt förfarande och avsedda kostnader. |

## K2. Personlighet styr avvägningar och AI

| ID | Krav | Godkännande genom observerat beteende |
|---|---|---|
| K2.01 | Personlighet är skild från kompetens | Två personer med lika kompetens men olika personlighet väljer olika i minst ett kontrollerat relevant scenario. |
| K2.02 | AI väger personlighet mot situationen | Samma ambitiösa person kan avvakta vid akut hot och agera vid ett gynnsamt tillfälle; förklaringen visar de avgörande skälen. |
| K2.03 | Personlighetsstridiga beslut får personlig kostnad | Känd stresskostnad visas före valet och bokförs en gång när det genomförs. Avbruten dialog och omförsök ger ingen extra kostnad eller återhämtning. |
| K2.04 | Stress påverkar framtida spel | Belastningsnivåer och återhämtning förändrar faktiska möjligheter eller utfall; kostnader och relevanta kriser kan följas. |
| K2.05 | Personer utvecklas med orsak | Uppväxt, utbildning och en betydande erfarenhet kan ändra olika egenskaper; orsaken består i historiken och påverkar senare beteende. |
| K2.06 | AI har mål, begränsningar och kontinuitet | Ett mål består över flera beslutspunkter, omprövas vid en stor förändring och kan bara ge handlingar som personen har rätt, kunskap och resurser till. |

## K3. Personlig åsikt och kollektiv makt skiljs åt

| ID | Krav | Godkännande genom observerat beteende |
|---|---|---|
| K3.01 | Personlig åsikt är riktad och orsakad | A kan tycka om B medan B misstror A; kända bidrag och deras ursprung kan visas separat. |
| K3.02 | Relation och tjänstelojalitet har egna följder | En rival kan fullgöra sitt ämbete. En vän kan motsätta sig en viss succession utan att relationen försvinner. |
| K3.03 | Familjens hållning är en egen politisk bedömning | En medlem gillar ledaren medan familjen motsätter sig en reform av begripliga materiella skäl; olika medlemmar får vara oense. |
| K3.04 | Religion har politiska och personliga kanaler | Personlig tro, religiös ledning och kollektivt stöd kan ändras var för sig och ge spårbara följder. |
| K3.05 | Konflikter påverkar den verkliga världen | Ett definierat stödskifte ändrar minst ett faktiskt flöde i berörd stad och ett faktiskt militärt beteende i ett relevant scenario. Orsakerna kan följas till berörda maktkällor. |
| K3.06 | Beräkningarna undviker självförstärkning | Samma orsak dubbelräknas inte, stödberäkning når ett slut och en maktlös persons missnöje skapar inte obegränsad rikseffekt. |

## K4. Minnen får framtida konsekvenser

| ID | Krav | Godkännande genom observerat beteende |
|---|---|---|
| K4.01 | Minnen har deltagare, tid och orsak | Ett tidigt utnämningsbeslut återfinns med korrekta identiteter och kan förklara en senare relation. |
| K4.02 | Historia består när tillfällig effekt upphör | En åsiktseffekt klingar av utan att händelsen eller ett kvarvarande löfte raderas. |
| K4.03 | Kunskap är skild från sanning | En person reagerar på det den känner till; ett senare avslöjande ändrar kunskap och kan skapa en ny reaktion. |
| K4.04 | Händelser väljer verkliga giltiga deltagare | Urvalet respekterar livsstatus, befogenhet, åtkomst, relationer och tidigare tillstånd. Chans och urvalsvikt kan granskas som olika steg. |
| K4.05 | Händelseval förblir giltiga vid verkställande | En deltagares död mellan presentation och val ger definierad omprövning eller avslut; ingen händelse låser kampanjen med noll möjliga utfall. |
| K4.06 | Upprepning ger avsedd rytm och effekt | Spärrtider för person, par, grupp och värld fungerar; upprepning av samma operation skapar inte nya belöningar eller obegränsade oförrätter. |
| K4.07 | Tidigare val ger alternativa framtider | Från samma startläge ger ett uppfyllt respektive brutet löfte olika senare val, stöd eller AI-prioritering även efter sparning och återläsning. |

## K5. Ämbete, familjemakt och arv följer skilda regler

| ID | Krav | Godkännande genom observerat beteende |
|---|---|---|
| K5.01 | Ämbete ger avgränsade rättigheter | Guvernörens befogenheter och offentliga resurser försvinner vid avsättning; privata tillgångar påverkas bara av separat giltigt beslut. |
| K5.02 | Olika arv kan få olika mottagare | Härskarämbete, familjeledning och personlig egendom går till olika personer i ett giltigt scenario. Familjens gemensamma egendom delas inte av misstag ut som personligt arv. |
| K5.03 | Maktbas överlever förlust av ämbete | En avsatt familj behåller tillämplig egendom, nätverk och anspråk och kan använda dem i senare politik. |
| K5.04 | Rätt och faktisk kontroll kan skilja sig | En erkänd arvinge och en rival med arméstöd hanteras utan dubbla aktiva innehavare av ett exklusivt ämbete. |
| K5.05 | Minderårighet ger fungerande mandat | Regentskap och förmyndarskap har rättigheter, egen aktör och tydlig överlämning vid myndighet eller upphörd oförmåga. |
| K5.06 | Livsförlopp och familjeband består | Födsel, utbildning, adoption, giftermål, åldrande och död fungerar över kalendern utan att släktband eller juridiska roller sammanblandas. |
| K5.07 | Successionskriser får giltiga tillstånd | Samtidiga dödsfall, tom kandidatlista och motstridiga anspråk ger uttryckliga krisförfaranden; ingen död person aktiveras och ingen okänd arvinge uppfinns som genväg. |

## K6. Källor och versioner går att följa

| ID | Krav | Godkännande genom dokumentation och datakontroll |
|---|---|---|
| K6.01 | Förebild och egen design skiljs åt | Varje antagen inspirationsregel pekar på källa, datum eller version, eventuell DLC och vår faktiska anpassning. |
| K6.02 | Motstridiga och äldre uppgifter markeras | Garrison-exemplet och Stories-exemplet kan följas till rätt tolkning; en historisk beskrivning presenteras inte som aktuell regel utan stöd. |
| K6.03 | Kampanjens regler är versionsbundna | Schema-, regel- och innehållsversion kan identifieras; uppdatering ändrar inte tyst en pågående kampanj. |
| K6.04 | Färdigmarkering kräver beteendeevidens | Varje implementerat krav har granskbar evidens och relevant begränsning. Skärmbild, kodförekomst och statisk design hålls isär från speltest. |

## M. Båda kampanjidentiteterna

| ID | Krav | Godkännande genom observerat beteende |
|---|---|---|
| M.01 | Val vid kampanjstart | Spelaren kan välja rike eller familj och läsa kontroll- och slutvillkor före start; valet bevaras i sparfilen. |
| M.02 | Riksläget följer riket | Ett dynastibyte ger kontroll genom rikets nya ledning och dess personliga samt institutionella begränsningar. |
| M.03 | Familjeläget följer familjen | Samma dynastibyte behåller den ursprungliga familjeidentiteten och rätt företrädare. |
| M.04 | Familjen kan spelas utan ämbete | En sammanhängande kedja av ekonomiska och politiska handlingar förändrar verkliga resurser och stöd när alla ämbeten förlorats. |
| M.05 | Återkomst till makten är spelbar | Familjen kan nå ett ämbete genom giltiga handlingar efter perioden utan ämbete; utfall och kostnader kommer ur den vanliga simulationen. |
| M.06 | Släktskap ger ingen obegränsad fjärrkontroll | En vuxen släkting med ämbete i ett annat rike kan förhandla eller vägra; spelaren kan inte direkt ge den statens order via familjevyn. |
| M.07 | Exil har motpart och konsekvenser | Mottagande, åtkomst, tillgångar och återkomstvillkor påverkar faktiska handlingsmöjligheter. Avvisning av alla tillfrågade mottagare leder till ett spelbart skyddslöst hushåll med tids- och resursföljder. |
| M.08 | Minderårig företrädare kan följas | Kampanjidentiteten består; fri förvaltning och beslut som kräver regentens stöd skiljs åt. Personkostnad belastar rätt aktör och myndighet eller återvunnen förmåga ger överlämning eller uttrycklig konflikt. |
| M.09 | Utslocknande följer uttryckliga villkor | Giltig familjegren, adoption och etablerat framtida anspråk prövas enligt reglerna; verkligt upphörande ger rätt slut utan en nyskapad räddningsarvinge. |
| M.10 | Rike och familj kan upphöra var för sig | Rikets fall avslutar riksläget enligt kontinuitetsregeln, medan en överlevande familj kan fortsätta på giltigt sätt; det omvända prövas också. |

## T. Integration, tid och beständighet

| ID | Krav | Godkännande genom tekniskt prov och spelbeteende |
|---|---|---|
| T.01 | En auktoritativ karaktärsvärld | Karta, ekonomi, order, UI, AI och ledarvisning läser samma identiteter och regler. En gammal textledare kan inte skriva över den verkliga innehavaren. |
| T.02 | Kalendern styr livsförloppet | Samma datum behandlat flera gånger ger ingen extra åldring, graviditet eller dödsrisk; f.Kr. och övergång utan år noll fungerar. |
| T.03 | Tidshopp behandlar rätt ordning | Samma daterade handlingar och slump ger samma domänresultat när ett hopp delas upp. Ledarbyte mitt i perioden påverkar rätt del av ekonomin. |
| T.04 | Replay och omförsök är stabila | Samma operation används högst en gång. Visningsreplay varken förbrukar ny slump eller skriver nya minnen, resurser eller arv. |
| T.05 | Synlighet följer tid och kunskap | Stegvis visning och AI-samtal avslöjar inte framtida dödsfall eller okända hemligheter, även när snapshot saknas. |
| T.06 | Sparning och återställning är sammanhängande | Laddning, server-/webbexport, import, zip och rollback bevarar identiteter och historik; simulerat delvis skrivfel lämnar inte blandade tillstånd. |
| T.07 | Migration bevarar original och innebörd | Äldre stödd version migreras deterministiskt; okänd framtida version avvisas begripligt utan att originalet skrivs sönder. |
| T.08 | Samtidighet och byte av kampanj skyddas | Inaktuellt UI-kommando och sent AI-resultat kan inte skriva över en senare värld eller ändra fel kampanj. |
| T.09 | Belastning och begriplighet mäts | Population, familjer, minnen och aktiva berättelser mäts över lång simulation. Tids- och minnesbudget fastställs på avsedd dator, med tangentbordsprov och läsbarhet i båda teman. |

## E. Sammanhängande slutprov

| ID | Krav | Godkännande genom spelprotokoll |
|---|---|---|
| E.01 | Tre generationer i båda lägena | Provkampanjen i systemdesignen visar alla fem spelpelare tillsammans, dynastibyte, skilda arv och familjespel utan ämbete. |
| E.02 | Alternativ handling ändrar förloppet | Uppfyllt respektive brutet löfte och alternativa efterträdare ger olika spårbara konsekvenser i den faktiska världen. Flera slumpfrön används för att upptäcka låsningar. |
| E.03 | Spelaren kan förstå och påverka | Speltestaren kan ange kända orsaker till en central konflikt, hitta minst ett relevant motdrag och skilja säker följd från osäker risk. Balans och upplevd kvalitet redovisas separat från tekniskt godkännande. |

## Spårning till underlag

| Krav | Grund och föreslagen anpassning |
|---|---|
| K1 | [Old World: Characters](https://www.designer-notes.com/old-world-designer-notes-7-characters/) för generationsberoende möjligheter. Våra åtta arketyper och deras handlingar är egna förslag. |
| K2 | [CK3-research](../reports/ck3-character-research.md) för stress, personlighet och AI. Våra vikter, stressnivåer och aktörsregler ska få egna värden och verifieras. |
| K3 | [Old World: Opinion](https://www.designer-notes.com/old-world-designer-notes-8-opinion/) för samband mellan person och grupper. Vår separata tjänstelojalitet och sakfrågebundna stödmodell är egen design. |
| K4 | [Händelsemotorer](../reports/design-och-handelsemotorer.md), [Old World: Events](https://www.designer-notes.com/old-world-designer-notes-9-events/) och CK3:s dokumenterade minnen. Kunskapsmodell, operationers identitet och våra berättelseförlopp får egna kontrakt. |
| K5 | [CK3-research](../reports/ck3-character-research.md) om bland annat administrativa familjer samt [Old World-research](../reports/old-world-character-research.md) om ämbeten och succession. Antika lagar och institutioner definieras per scenario. |
| K6 | Användarens uttryckliga krav samt researchens verifierade versionskonflikter. Spårbarhet är ett kvalitetskrav, inte en särskild poängresurs i spelet. |
| M | Användarbeslut 30 oktober 2026: spelaren väljer riket eller familjen vid kampanjstart. Detaljer om kontroll och slutvillkor är designförslag. |
| T | [Verifierad arkitektur](../reports/open-historia-architecture.md) och [integrationsplan](integration-plan.md). Tekniska kontrakt är föreslagna ändringar på angiven revision. |
| E | Vårt acceptansupplägg. Tre generationer är ett testscenario och begränsar inte kampanjens längd. |

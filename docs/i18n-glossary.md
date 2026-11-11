# Swedish to English glossary for game text

Term choices made for `public/lang/attainder/packages-en.json` (166 strings of the four built scenario packages, 11 November 2026). Translators of the engine text in `public/lang/attainder/en.json` should use the same terms.

The established vocabulary is the research sidecar, `server/seed/historical/locales/en.json`, shipped as `public/lang/attainder/historical-en.json`. Look a name, title or term up there before translating it. This glossary records what the sidecar already settles for recurring terms, what the package text added, and where the sidecar gives two renderings.

Rows marked "recommended" cover terms the package text does not contain. They follow from the choices above them and no translation uses them yet.

## Style rules

- Meaning first. Keep each number, date, alternative, uncertainty marker, attribution and the scope of a claim. A range stays a range. Add no facts and correct no history.
- Plain modern English in sentence case. No em dashes. Match the terseness of the Swedish.
- A label stays a label: `Genererad person` is `Generated person`, without article or period.
- A sentence ends as the Swedish ends. The phrase book puts a missing final period back by itself, so a translation never adds or drops one.
- British spelling, as in the sidecar: generalised, organisation, baptised, centre, per cent.
- Apostrophes: the court and review entries of the sidecar use the typographic apostrophe (202 against 2 straight ones), so package and court text uses `’`: `Charles’s realm`. The event entries of the sidecar mix both forms (278 typographic, 759 straight).
- Text marked as generated or approximate stays marked: `genererad` is `generated`, `ungefärlig` is `approximate`, `spelvärde` is `game value`.
- A compound with `spel-` names something the game invented. Translate it as `game` plus the noun (`game seat`, `game value`, `game group`) so the reader sees the marker each time. In a full sentence `in the game` may read better: `kyrkans spelorganisation är förenklad` is `the church’s organisation in the game is simplified`.
- A proper name that reads the same in English maps to itself (Aachen, Silla, Emishi).
- A builder that repeats a sentence across strings gets one translation of that sentence, used in each string that contains it.

## Game terms

| Swedish | English |
| --- | --- |
| hov, hovet | court, the court. Note: also in compounds, such as `hovämbete` (court office) and `hovfamilj` (court family). |
| rike | realm. Note: the generic and game word (`Spelbara riken` is `Playable realms`, `Karls rike` is `Charles’s realm`). An established polity name takes its conventional English name instead: `Tangriket` is `Tang Empire`, `Kungariket Asturien` is `Kingdom of Asturias`. |
| hus (härskarens hus, husets barn) | house (the ruler’s house, the house’s children). Note: the game’s family unit around a ruler. `Kungahuset` is `the royal house`, as the sidecar has it for Silla. |
| ätt | line (recommended). Note: bloodline and descendants, as in `Hans ätt tog tronen`, `His line took the throne`. Keep `house` for `hus`, so the two Swedish words stay apart. |
| släkt | kin. Note: sidecar: `faderns och moderns släkt` is `paternal and maternal kin`, `den härskande släkten` is `the ruling kin`. |
| släktskap, släktpost, släktled | kinship, kinship record, kinship links |
| familjegrupp | family group |
| hushåll | household |
| härskare | ruler. Note: 70 of 70 sidecar entries. `härskarämbete` is `ruling office`. |
| tronföljd | succession. Note: 10 of 10 sidecar entries. Use `line of succession` only where the Swedish means the ordered list of heirs. |
| arvsföljd | succession (recommended). Note: same English word as `tronföljd`. `Order of inheritance` fits where the text is about property and no throne is involved. |
| tronföljare | successor. Note: sidecar: `utsedde tronföljare` is `designated successor`. |
| arvinge | heir |
| successionslag, arvslag | succession law |
| primogenitur, förstfödslorätt | primogeniture. Note: the sidecar uses one English word for both. |
| äldstebarnsrätt | birthright of the eldest. Note: sidecar rendering, one occurrence. |
| meritval, förtjänstval, duglighetsval | merit-based choice. Note: the sidecar also has `merit-based selection` and `choice based on ability`; quoted sidecar sentences keep their wording. For the succession law in engine text, use `merit` (recommended). |
| val, valordning, väljare | election, election order, electors |
| delat arv | partition (recommended) |
| behörig | eligible |
| regent | regent in engine text, where a regent holds a mandate for a child ruler. Note: in historical prose the Swedish word can also mean the reigning monarch; the sidecar renders `regentbeskrivning` as `description of the ruler`. Check which one the sentence means. |
| förmyndare (of a ruler) | regent. Note: `Ett barn styr genom en förmyndare` is `A child rules through a regent`. The engine limit behind the sentence has the id `regency`. For a family’s `förmyndare`, with no throne involved, use `guardian` (recommended). |
| myndig, myndighetsålder | of age, age of majority |
| hovman, hovmän | courtier, courtiers. Note: also the generic plural for a mixed group. |
| hovdam | court lady (recommended). Note: `lady-in-waiting` names an office the game does not model. |
| ämbete, hovämbete, ämbetsnamn | office, court office, office name |
| hovämbetsman | court official |
| religiös företrädare | religious representative. Note: `företrädare` can also mean predecessor in engine text. |
| råd | council |
| stormän | magnates |
| spelsäte | game seat. Note: sidecar: `Vald som spelsäte` is `Selected as the game seat`. |
| spelvärde | game value |
| spelgrupp, spelabstraktion, spelaggregat | game group, game abstraction, game aggregate |
| genererad person | Generated person. Note: the participle is `generated` wherever it occurs, never `fictional` or `invented`. |
| dokumenterad person | documented person. Note: plural `documented people`. |
| bokmärke | bookmark. Note: the start point of a scenario. |
| bokmärkets dag | the bookmark date |
| startdagen, vid starten | the start date, at the start |
| spelbar | playable |
| Kyrkostaten | Papal States. Note: plural verb in a sentence: `the Papal States have Rome as their game seat`. |
| simuleringen | the simulation |
| mekaniken | the mechanics |

## Evidence and map vocabulary

| Swedish | English |
| --- | --- |
| belagd, belägga | attested, attest. Note: 71 of 93 sidecar entries. |
| källa, källorna | source, the sources |
| underlaget | the source material. Note: the research file behind a court. The indefinite `underlag saknas` is `evidence is lacking`. |
| granskning, granskad | review, reviewed |
| proveniens | provenance |
| påstås inte | is not claimed |
| räknas som osäker | is counted as uncertain |
| form (on the map) | shape. Note: a polygon of the source map. |
| källkartan | the source map |
| område | area. Note: `territory` after a possessor: `Karls områden` is `Charles’s territories`. |
| kärnområde | core area |
| gräns | boundary. Note: sidecar usage for map lines. |
| kant | edge |
| utbredning | extent. Note: `spread` for a people moving over time (`polynesisk utbredning`). |
| okänd kontroll | unknown control |
| okänd historisk kontroll | Unknown historical control |
| godkänd ägare | approved owner |
| avvisas | is rejected |
| står i karantän | is in quarantine |
| olöst | unresolved |
| täckning | coverage |
| ortsmarkör | place marker |
| kulturområde, kulturetikett, kulturpolygon | culture area, culture label, culture polygon |
| likformigt styre | uniform rule |
| besittningar | possessions |
| välde | dominion |
| herravälde | lordship |
| landskap (historiskt) | region. Note: the Swedish means a historical province here, not scenery. |
| nutida, dagens | present-day |

## Kinship and marriage

The builders write `<person>: <relation> <other>.`. The colon and the period stay.

| Swedish | English |
| --- | --- |
| son till, dotter till | son of, daughter of |
| far till, mor till | father of, mother of |
| bror till, syster till | brother of, sister of |
| hustru till, make till, maka till | wife of, husband of, wife of |
| änka efter, änkling efter | widow of, widower of |
| brors- eller systerson till | nephew of. Note: the Swedish spells out both sides because it has no neutral word. `Nephew` leaves the side open in the same way. |
| brors- eller systerdotter till | niece of (recommended) |
| farbror eller morbror till | uncle of. Note: same reasoning. Where a source names the side, the sidecar writes `paternal uncle`. |
| faster eller moster till | aunt of (recommended) |
| make eller maka | spouse |
| frilla, bihustru | concubine. Note: the sidecar uses one English word for both. |
| förslavad | enslaved |
| äktenskap, vigsel | marriage, wedding |
| kungaparet | the royal couple |

## Dates and numbers

| Swedish | English |
| --- | --- |
| 3000 f.Kr. | 3000 BC |
| 800 e.Kr. | AD 800. Note: `AD` goes before the year. |
| Cirka 3000 f.Kr., cirka 1188 | Circa 3000 BC, circa 1188. Note: 125 of the 244 sidecar keys with `cirka` have `circa`; others have `approximately` or `around`. |
| omkring | around. Note: 155 of 159 sidecar keys. |
| år 800 | in 800. Note: `in the year 800` or `for the year 800` where a bare number would be unclear. |
| den 26 december 795, 4 juni 800 | on 26 December 795, on 4 June 800. Note: day, month, year, without ordinal suffix. |
| den första januari 778 | the first of January 778. Note: a date written in words stays in words, so the digits of both languages match. A numeral stays a numeral. |
| 72:a levnadsåret | the 72nd year of his life |
| 800-talet | the ninth century. Note: sidecar usage. Check the wording against the record’s full range of years. |
| 783 (dog 783) | in 783 (died in 783) |
| juldagen, julmässan | Christmas Day, the Christmas Mass |
| nyårsafton | New Year’s Eve |

Hedges, from the sidecar: `troligen` and `sannolikt` are `probably`, `möjligen` is `possibly`, `omtvistad` and `omstridd` are `disputed`, `osäker` is `uncertain`, `ungefärlig` is `approximate`, `enligt` is `according to`.

## Names

Attested personal names keep their form unless the sidecar has an English one. The sidecar forms used in the package text:

| Swedish | English |
| --- | --- |
| Karl, Karl den store | Charles, Charlemagne. Note: the court calls him `Charles (Charlemagne)`; plain `Karl` is `Charles`. |
| Karls rike (karolingiska riket) | Charles’s realm (Carolingian Empire) |
| Ludvig, Pippin puckelryggen | Louis, Pippin the Hunchback |
| Berta, Teoderada, Hiltrud | Bertha, Theodrada, Hiltrude |
| Eirene av Aten, Konstantin VI | Irene of Athens, Constantine VI |
| Harun ar-Rashid | Harun al-Rashid. Note: the court entries have this form (8 entries); the title and summary of one event keep `Harun ar-Rashid`. |
| Kalifen al-Mahdi, Kung Soseong | Caliph al-Mahdi, King Soseong |
| Alfonso II den kyske | Alfonso II the Chaste |
| Filip II August, Ludvig VIII, Blanka av Kastilien | Philip II Augustus, Louis VIII, Blanche of Castile |
| Adèle av Champagne, Eleonora av England | Adela of Champagne, Eleanor of England |
| Johan (av England) | John (of England) |
| Johns riken (angevinskt välde) | John’s realms (Angevin dominion). Note: new in this pack. The sidecar has `Angevinska riket`, `Angevin Empire`, for a different Swedish term. |
| riksannalerna | the Royal Frankish Annals |
| Furste, Kalif, Kung, Emir | Prince, Caliph, King, Emir. Note: office names take a capital when quoted as names. |
| Ineb-Hedj (Memfis) | Ineb-Hedj (Memphis) |
| Mingriket, Osmanska riket, Krimkhanatet | Ming Empire, Ottoman Empire, Crimean Khanate |
| Avarriket | Avar Khaganate. Note: the sidecar has `Avariska khaganatet`, `Avar Khaganate`. |
| Toltekriket, Wari-, Tiwanaku- och Toltekriken | Toltec Empire; the Wari, Tiwanaku and Toltec empires. Note: the sidecar has `Wariimperiet`, `Wari Empire`. |
| Kermarike | Kerma kingdom |
| bulgarerna, uigurerna | the Bulgars, the Uyghurs |
| Bretagne, Akvitanien, Venedig, Milano, Rhodos | Brittany, Aquitaine, Venice, Milan, Rhodes |

Border tribes are map labels and take the plural without article, as the sidecar’s culture names do (`Almohaderna` is `Almohads`):

| Swedish | English |
| --- | --- |
| Bretonerna, Böhmarna, Sorberna | Bretons, Bohemians, Sorbs |
| Obodriterna | Obotrites. Note: sidecar form; the tribe id says `obodrites`. |
| Wilzerna | Wilzi. Note: the form in translations of the Royal Frankish Annals. `Veleti` is the other name in use. |
| Nordalbingiska saxarna | Nordalbingian Saxons |
| Esterna, Litauerna | Estonians, Lithuanians |
| Prussarna | Old Prussians. Note: the sidecar has `Pruser`, `Old Prussians`. The word keeps the Baltic people apart from later Prussia. |
| Chichimekerna, Chiriguanerna | Chichimecs, Chiriguanos |

In a list of playable realms the names keep their label form: `Playable realms: Aztec Empire and Inca Empire.` In a running sentence they take the article: `The Aztec Empire and the Inca Empire are shown approximately.`

## Sidecar renderings that differ

| Swedish | Renderings | Used here |
| --- | --- | --- |
| Harun ar-Rashid | Harun al-Rashid (8 court entries), Harun ar-Rashid (one event, title and summary) | Harun al-Rashid |
| meritval | merit-based selection, merit-based choice | each quoted sentence as the sidecar has it |
| Den 1 januari, 1 januari | The first of January, 1 January | a numeral stays a numeral (`1 January`); a date written in words stays in words |
| cirka | circa, approximately, around, c. | circa |
| apostrophe | `’` in court and review entries, `'` in most event entries | `’` |

## Still open for the engine text

- `ätt`, `hovdam`, `arvsföljd`, `delat arv` and a family’s `förmyndare` have recommended forms above and no translated string yet.
- The office `Religiös företrädare` and the generated family names (`Hovhus 1 (genererat)`, `Karls hus`, `Leos hushåll`) live in code. Their translations in `en.json` should match `religious representative`, `court family`, `house` and `household` here.
- The Swedish genitive after a name ending in s (`Aetios bror`) is `Aetios’s brother` in the sidecar. Follow that form for names ending in s.

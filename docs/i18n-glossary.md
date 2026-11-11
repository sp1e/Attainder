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

## Engine text: terms, grammar and tone

Term choices for the 1,127 short entries of the Swedish source catalog (`public/lang/attainder/catalog-sv.json`): labels, buttons, headings, traits, skills, offices, statuses and option titles. The sentence translators of `public/lang/attainder/en.json` use the same terms. One Swedish game term has one English word in every string. Do not vary a term for style.

The code ids are English (`steward`, `diplomacy`, `dread`). An entry follows its id when the id is good English, and the tables say so where it does not.

### What this settles from "Still open"

| Swedish | English |
| --- | --- |
| delat arv | partition. Note: the succession law and the grudge label `Delat arv`. |
| arvsföljd, successionsordningen | succession, the order of succession |
| förmyndare (of a family) | guardian. Note: `Förmyndare:` is `Guardian:`. `Förmyndarskap` covers both a realm’s regent and a family’s guardian and reads `guardianship`. |
| Religiös företrädare | Religious representative |
| Karls hus, Leos hushåll, Kungahuset | Charles’s house, Leo’s household, The royal house |

`ätt` and `hovdam` do not occur in the short entries. Their recommended forms stand.

### Offices and court staff

| Swedish | English |
| --- | --- |
| Härskare | Ruler |
| Överbefälhavare | Marshal. Note: id `general`. `befälhavaren` in a sentence about this office is `the marshal`. |
| Kansler | Chancellor |
| Spionmästare | Spymaster |
| Överstepräst | High priest |
| Religiös företrädare | Religious representative |
| Kung, Påve | King, Pope |
| guvernör, guvernörsämbete | governor, governorship |
| ämbete, ämbetsinnehavare | office, office holder |
| förvaltningsämbete | administrative office |
| rådsmedlem | councillor |
| innehavare | holder |
| vakant | vacant |
| Hovmästare, Kock, Vaktchef, Läkare, Tjänare | Steward, Cook, Captain of the guard, Physician, Servant. Note: the five court staff roles, hired as `agenter` (agents). |
| läkekunnig | healer. Note: hired care; `läkare` is the staff physician. |
| hovtjänare | court servant (recommended) |

An office name is capitalised as a label and lowercase in a sentence: `the chancellor`.

### Archetypes and their abilities

The Swedish names are definite nouns. The English names keep the article and both capitals.

| Swedish | English |
| --- | --- |
| Fältherren, Samordnad mobilisering | The Commander, Coordinated mobilisation |
| Förvaltaren, Förvaltningsreform | The Steward, Administrative reform |
| Diplomaten, Försoningsråd | The Diplomat, Reconciliation council |
| Läraren, Kunglig akademi | The Scholar, Royal academy. Note: id `scholar`. |
| Lagstiftaren, Successionsreform | The Lawgiver, Succession reform. Note: id `legislator`. |
| Beskyddaren, Helgedomsfördrag | The Protector, Sanctuary treaty. Note: id `guardian`; `guardian` belongs to `förmyndare`. |
| Intrigören, Underrättelsenät | The Schemer, Spy network |
| Byggherren, Vattenledningsprogram | The Builder, Aqueduct programme |
| arketyp, förmåga, arketypförmåga | archetype, ability, archetype ability |

### Skills

| Swedish | English |
| --- | --- |
| Befäl | Command |
| Förvaltning | Stewardship. Note: the skill. In other uses `förvaltning` is `administration`. |
| Diplomati | Diplomacy |
| Lärdom | Learning |
| Intrig | Intrigue |
| Kampförmåga | Prowess |
| Krigskonst | Martial |
| Visdom | Wisdom |
| färdighet | skill (recommended) |

### Values and resources

| Swedish | English |
| --- | --- |
| legitimitet | legitimacy |
| ryktbarhet | prestige. Note: id `prestige`. |
| anseende | standing (recommended). Note: `tribes.js` uses it loosely for a loss of prestige or legitimacy. |
| fruktan | dread. Note: the court’s value, id `dread`. |
| rädsla | fear. Note: a person’s value, id `fear`. |
| stress, belastning | stress. Note: `belastning` is the same value. `Fortsätt under belastning` is `Carry on under strain`. |
| Samlad, Belastad, Kris | Composed, Strained, Crisis. Note: the three stress levels. |
| hälsa | health |
| åsikt | opinion. Note: `åsikt om dig +10` is `opinion of you +10`. |
| stöd, politiskt stöd, religiöst stöd | support, political support, religious support |
| inflytande | influence |
| oförrätt | grievance. Note: a family’s `grievance` value and the bond of the same name. |
| agg | grudge |
| lojalitet, tjänstelojalitet, tjänst | loyalty, service loyalty, service |
| oro | unrest |
| skatt, skattenivå, skattepolitik | tax, tax level, tax policy |
| Låg, Balanserad, Hög | Low, Balanced, High. Note: the tax levels. |
| produktion | production |
| statskassa, statskassan | treasury, the treasury |
| familjekassan, gemensam kassa | the family treasury, shared treasury |
| silver, familjesilver, mynt | silver, family silver, coins |
| årsintäkt | annual revenue |
| egendom (of a family) | estate. Note: `Egendomar` is `Estates`. A person’s `egendom` in silver is `wealth`. |
| försörjning, uppehälle | livelihood, upkeep |
| handling | action. Note: `1 handling` is `1 action`. |
| handlingsutrymme | actions left |
| här, armé | army. Note: `arméns styrka` is `the army’s strength`, `härens beredskap` is `the army’s readiness`. |
| militär beredskap | military readiness |
| underverk, katedral, palats, bibliotek | wonder, cathedral, palace, library |
| bygge | building work |

### Traits

Adjectives, as in Swedish. The engine writes them lowercase after `är`, so each must read as `is <trait>`.

| Swedish | English |
| --- | --- |
| Ambitiös, Förnöjsam | Ambitious, Content |
| Försiktig, Nyfiken | Cautious, Curious |
| Medkännande, Grym | Compassionate, Cruel |
| Plikttrogen, Lojal | Dutiful, Loyal |
| Girig, Generös | Greedy, Generous |
| Hämndlysten, Tålmodig | Vengeful, Patient |
| Sällskaplig, Stolt | Gregarious, Proud |
| From, Nitisk, Cynisk | Devout, Zealous, Cynical |
| Ärlig, Bedräglig | Honest, Deceitful |
| Godtrogen, Misstänksam | Trusting, Paranoid |
| Modig, Feg | Brave, Craven |
| Lugn, Vredgad | Calm, Wrathful |
| Flitig, Lat | Diligent, Lazy |
| Rättvis, Godtycklig | Just, Arbitrary |
| drag, personlighet | trait, personality (recommended) |
| vrede, vredesutbrott | wrath, outburst of wrath |

Nicknames follow a name and start lowercase: `den Store` is `the Great`, `den Grymme` is `the Cruel`, `den Lömske` is `the Treacherous`, `den Givmilde` is `the Generous`, `den Bräcklige` is `the Frail`, `den Stillsamme` is `the Quiet`, `Tronrövaren` is `the Usurper`. The masculine and feminine Swedish forms share one English form. `tillnamn` is `nickname` (recommended).

### People, families and bonds

| Swedish | English |
| --- | --- |
| person, personer | person, people |
| aktör | actor. Note: the person who carries out an action. `Utförs av:` is `Carried out by:`. |
| mål (of an action), målperson | target |
| mål (of a person or a reign) | goal. Note: `Personligt mål`, `Regeringsmål` (reign goals), `Uppnådda mål` (goals met). |
| företrädare | representative. Note: `Handlande företrädare` is `Acting representative`. |
| beslutsaktör | decision-maker (recommended) |
| ombud | proxy (recommended) |
| handlingsförmögen | able to act (recommended) |
| familj, familjemedlem | family, family member |
| familjehuvud, huvudman | family head, head (of the family, of a house) |
| familjeledning | family leadership |
| hus, hushåll, släkt | house, household, kin |
| släkting, anhörig | relative |
| en närstående | someone close |
| barn, vuxen, äldre | child, adult, elderly |
| partner | spouse. Note: the engine’s word for a husband or wife. |
| gemål | consort |
| biologisk förälder, juridisk förälder | biological parent, legal parent |
| oäkta barn, oäkta börd | illegitimate child, illegitimate birth |
| arvinge, efterträdare | heir, successor |
| mentor, utbildning | mentor, education |
| vän, vänskap | friend, friendship |
| rival, rivalitet | rival, rivalry |
| allierad | ally |
| beskyddare, beskydd, skydd | patron, protection, protection. Note: the family that shelters an exiled family. `Under beskydd` is `Under protection`. |
| skyddslöst hushåll | unprotected household |
| förbindelse | tie. Note: `Personliga förbindelser` is `Personal ties`. |
| band | bond. Note: `Familjeband` is `Family ties`. |
| löfte | promise. Note: `Bryt löftet` is `Break the promise`, `Uppfyll löftet` is `Keep the promise`. |
| gåva, gentjänst | gift, favour |
| försoning, gottgöra | reconciliation, make amends |
| minne | memory |
| exil, förvisning, förvisa, fördriva | exile, banishment, banish, drive out |
| fristad, värdfamilj, hemvist | refuge, host family, home. Note: the status label `Hemvist` is `Homeland`. |
| genererad, ej belagd | generated, not attested |

### Succession and government

| Swedish | English |
| --- | --- |
| tronföljd | succession |
| förstfödslorätt, förtjänst, val, delat arv | primogeniture, merit, election, partition. Note: the four law labels, lowercase. |
| elektor | elector |
| tronanspråk | claim to the throne |
| pretendent | claimant |
| rättslig | lawful. Note: `Rättslig arvinge` is `Lawful heir`, `Rättsligt erkänd härskare` is `Lawfully recognised ruler`. `juridisk` is `legal`. |
| faktisk härskare | actual ruler |
| mandat, härskarmandat | mandate, the ruler’s mandate. Note: `Kräver härskarmandat.` is `Requires the ruler’s mandate.` |
| regent, regentskap | regent, regency |
| förmyndarskap, omyndighet | guardianship, minority |
| samtycke | consent |
| överlämning | handover |
| abdikation, abdikera | abdication, abdicate |
| olaglig tronbestigning | unlawful accession |
| interregnum | interregnum |
| styre | rule. Note: the handover heading `Ett nytt styre` is `A new reign`. |
| förvalta makten | hold power |
| rikets ledning | the realm’s leadership |
| statsbildning | polity |
| stat, stadsstat, förbund, hövdingadöme, statslöst samhälle | state, city-state, confederation, chiefdom, stateless society |
| upplösas | dissolve |

### Council and factions

| Swedish | English |
| --- | --- |
| rådet | the council |
| faktion | faction |
| krets | circle. Note: `Känd krets:` is `Known circle:`. |
| I det fördolda, Ultimatum | In the shadows, Ultimatum. Note: faction stages. |
| slå ned | crush. Note: a faction or a border tribe. |
| krav | demand. Note: `Bevilja kravet` is `Grant the demand`, `Avvisa kravet` is `Refuse the demand`. |
| Obesvarat, Beviljat, Avköpt, Avvisat, Förfallet, Bortfallet | Unanswered, Granted, Bought off, Refused, Lapsed, Void |
| utmanare | challenger |
| maktövertagande, kupp | takeover, coup |
| adeln | the nobility (recommended) |
| pålitlig, motvillig, opålitlig | reliable, reluctant, unreliable. Note: `trogen` is `faithful` (recommended). |
| mycket svag, svag, jämn, stark, mycket stark | very weak, weak, even, strong, very strong |

### Schemes, secrets and crimes

| Swedish | English |
| --- | --- |
| Intrig, Intriger (skill, category, tab) | Intrigue |
| intrig (a plan under way) | scheme. Note: `Pågående intriger` is `Ongoing schemes`, `Avbryt intrigen` is `Call off the scheme`. |
| komplott, komplottmakare | plot, plotter |
| sammansvärjning | conspiracy |
| plan | plan |
| Påverka, Undergräv, Förgifta, Snoka, Utpressa, Sprida rykte, Fängsla | Sway, Undermine, Poison, Snoop, Blackmail, Spread a rumour, Imprison. Note: the seven contested actions. |
| omstridd handling | contested action |
| grepp, övertag | hook. Note: two Swedish words for one game object. `Grepp över` is `Hook on`. |
| hemlighet, hemlighållning | secret, secrecy |
| rykte | rumour |
| bevis | evidence |
| avslöja | expose (make public); reveal (tell one person) |
| agenter | agents |
| Mord, Släktmord, Mordförsök, Förräderi | Murder, Kinslaying, Attempted murder, Treason |
| Otrohet, Kätteri | Infidelity, Heresy |
| gärningsperson | perpetrator |
| fånge, fängsla, fängelse, fångenskap | prisoner, imprison, prison, captivity |
| lösen, lösensumma, lösenanbud | ransom, ransom, ransom offer |
| frige, avrätta, benåda, bötfälla | release, execute, pardon, fine |
| avvisa | refuse (a demand); reject (an offer, a ransom, a proposal); turn away (people) |
| avböja | decline |
| chans, grundchans | chance, base chance |
| mycket låg, låg, jämn, hög, mycket hög | very low, low, even, high, very high |
| osäker, trolig, säker | uncertain, likely, certain. Note: `osannolik` is `unlikely` and `oviss` is `uncertain` (recommended). |
| Lyckat men avslöjat, Misslyckat och avslöjat, Det slog tillbaka | Succeeded but exposed, Failed and exposed, It backfired. Note: for the two siblings use `Succeeded quietly` and `Failed quietly` (recommended). |
| utfall | outcome |

### Health

| Swedish | English |
| --- | --- |
| tillstånd | condition |
| Smittkoppor, Febersjukdom, Skada, Sorg | Smallpox, Fever, Injury, Grief |
| skadad | injured |
| svag hälsa | poor health |
| ärr, skadeärr, bestående | scars, injury scars, lasting |
| Pågående, Återhämtning, Avslutat | Ongoing, Recovery, Ended. Note: stages. `Läkt med bestående ärr` is `Healed with lasting scars` (recommended). |
| omvårdnad, vård, vila, avlastning | care, care, rest, relief |
| avliden | deceased. Note: the field label before a date is `Died`. |
| pesten | the plague |
| dödsbädd, testamente, testamentera | deathbed, will, bequeath |
| liten, påtaglig, stor (risk) | small, considerable, great |

### Faith

| Swedish | English |
| --- | --- |
| tro | faith |
| samfund | faith. Note: the same game object as `tro`, seen as an organisation. `samfundsledaren` is `the faith’s leader` (recommended). |
| reformera tron | reform the faith |
| kätteri | heresy |
| präst, prästerskap | priest, priesthood (recommended) |
| heligt krig | holy war |
| helgedom | sanctuary |

### War and diplomacy

| Swedish | English |
| --- | --- |
| grannrike | neighbouring realm |
| gränsfolk | border tribes |
| gränsland | borderland |
| anspråk, smida ett anspråk, förfalskat anspråk | claim, fabricate a claim, forged claim |
| krig, fred, sluta fred | war, peace, make peace |
| be om fred, be om försoning | sue for peace, ask for reconciliation |
| sändebud, budskap | envoy, message |
| allians, giftermål, äktenskap | alliance, marriage, marriage |
| svek | betrayal |
| duell, kämpe, utmaning | duel, champion, challenge |
| gästabud | feast |
| fälttåg | expedition (recommended). Note: `campaign` is the game campaign, `kampanj`. |
| tribut, räd, plundra | tribute, raid, plunder (recommended) |
| seger, nederlag, slag | victory, defeat, battle (recommended) |

### Interface and time

| Swedish | English |
| --- | --- |
| Överblick, Personer, Familjer, Ämbeten & arv, Beslut, Intriger, Krönikan | Overview, People, Families, Offices & succession, Decisions, Intrigue, Chronicle. Note: the tabs. |
| krönika | chronicle. Note: the upstream pack calls its own event record `the record`; the two stay apart. |
| Årskrönika, Minnen | Annals, Memories |
| beslut | decision |
| ärende | matter |
| händelsekedja, uppföljning | event chain, follow-up |
| förfrågan | request |
| samtal | conversation |
| Pågår, Slutfört, Pausat, Avbrutet, Misslyckat | In progress, Completed, Paused, Cancelled, Failed |
| Uppfyllt, Brutet, Oavgjort, Avgjort, Väntar | Fulfilled, Broken, Unresolved, Resolved, Pending |
| Uppnått, Förfelat | Met, Missed. Note: reign goals. |
| okänd, ingen, saknas | unknown, none, none |
| kampanj, kampanjfrö, svårighetsgrad | campaign, campaign seed, difficulty |
| Lätt, Normal, Svår | Easy, Normal, Hard |
| tur | turn. Note: the upstream words are `omgång` (turn) and `runda` (round). |
| modellanrop | model request |
| inloggning | sign-in |
| år, månad | year, month |
| årsskifte | turn of the year (recommended) |
| sedan | since |
| senast {{date}} | by {{date}} (recommended) |
| om ett år, inom ett år, i tre år, om året | in a year, within a year, for three years, a year |
| myndighetsdagen | the day of majority (recommended) |
| Bronsålder, Antiken, Tidig medeltid, Högmedeltid, Senmedeltid | Bronze Age, Antiquity, Early Middle Ages, High Middle Ages, Late Middle Ages |

### Grammar rules

**The genitive on a slot.** `{{name}}s hus` and `{{name}}:s rum` are `{{name}}’s house` and `{{name}}’s room`, with the typographic apostrophe. Write `’s` for every name, since the pattern cannot see a final s. Use `of` only when the slot can hold a long phrase: `under {{hostPolityName}}s accepterade skydd` is `under the accepted protection of {{hostPolityName}}`.

**A slot is translated before the pattern fills it in.** The phrase book looks each slot value up as its own entry. A label arrives in the form `terms.en.json` gives it, so write the words around the slot for that form:

- An archetype name carries its article (`The Commander`). Put no `the` in front of the slot.
- A fallback noun carries its article too: `Familjen` is `The family`, `fången` is `the prisoner`, `Komplottmakaren` is `The plotter`.
- A relation phrase ends in its preposition: `son till` is `son of`, `änka efter` is `widow of`.
- `om stöd`, `att berätta en hemlighet` and `om ett löfte` follow `bad {{name}}`. They read `for support`, `to reveal a secret` and `for a promise`, so the verb is `asked {{name}}`.
- `lyckas` and `hållas hemlig` fill `chansen att {{what}} var …`. They read `succeed` and `stay secret`, so the pattern is `the chance to {{what}} was …`.

**A slot that holds a lowercased label.** The engine lowercases a label when it puts it inside a sentence: traits (`Personen är {{trait}}`), skills (`undervisar {{name}} i {{skill}}`), crimes (`har avslöjats för {{label}}`), health conditions, office names, action labels and outcome titles. Write the sentence so that a bare lowercase English word fits the slot:

- a trait after `is`: `The person is {{trait}}`; after `draget`: `the trait {{trait}}`
- a crime after a preposition: `exposed for {{label}}`
- a condition after `suffering from`, which takes smallpox, fever, injury and grief alike. `has {{condition}}` fails for `injury`.
- a skill as a bare noun: `teaches {{name}} {{skill}}`
- an office after `the`: `the {{office}} {{name}}`

The catalog holds the capitalised label only. Each lowercase form needs its own entry in the catalog and in `en.json`, or the slot stays Swedish.

**Definite forms.** A Swedish definite noun takes `the`: `Riket` is `The realm`, `hovet` is `the court`, `rådet` is `the council`, `härskaren` is `the ruler`, `statskassan` is `the treasury`. Four groups take no article:

- the tab `Krönikan` (`Chronicle`) and the action category `Hovet` (`Court`)
- a value as a mass noun: `legitimiteten sjunker med 4` is `legitimacy falls by 4`; likewise prestige, influence, stress, unrest and dread
- a place name: `Kopparhöjderna` is `Copper Heights`
- a border tribe, as the glossary has it: `Bretonerna` is `Bretons`

**Indefinite and bare nouns.** `Ett nytt äktenskap` is `A new marriage`. A Swedish bare object gets an English article: `Håll gästabud` is `Hold a feast`, `Skicka sändebud` is `Send an envoy`, `Sök försörjning` is `Seek a livelihood`.

**The genitive on a common noun.** In a sentence or a heading: `Rikets ledning` is `The realm’s leadership`, `Familjens företrädare` is `The family’s representative`. A row that explains a number has no leading article: `Aktörens stress` is `Actor’s stress`, `Målets livvakter` is `Target’s bodyguards`, `Rikets legitimitet` is `Realm’s legitimacy`. A fixed compound stays a compound: `Familjens kassa` is `Family treasury`, `Kampanjens identitet` is `Campaign identity`, `Rikets tillstånd` is `State of the realm`.

**Numbers.** A digit stays a digit and a number word stays a word. The minus sign `−` and the plus sign stay where they are: `Personlig åsikt −5.` is `Personal opinion −5.` Keep the space in `5 %`; the engine writes brackets such as `5–10 %` that the phrase book cannot change. Changes read `rises by` (`ökar med`, `stiger med`) and `falls by` (`minskar med`, `sjunker med`). `tappar 8 i stöd` is `loses 8 support`. `tycker 12 sämre om dig` is `thinks 12 worse of you`.

**Costs.** `30 silver ur statskassan` is `30 silver from the treasury`. `ur familjekassan` is `from the family treasury`. `20 familjesilver` is `20 family silver`. `1 handling` is `1 action` and `0 handlingar` is `0 actions`.

**`år` with a number.** An age after a name is `{{age}} years` (`Arel · 34 years`). `{{n}} år gammal` is `{{n}} years old`. `i {{n}} år` is `for {{n}} years`, `om {{n}} år` is `in {{n}} years`, `{{n}} års fred` is `{{n}} years of peace`. The catalog has one entry per variant where the source chooses between singular and plural. Where it has one entry for any number, write the plural. `{{abs}} f.Kr.` is `{{abs}} BC` and `{{abs}} e.Kr.` is `AD {{abs}}`.

**Lists.** The parts of a list joined by ` · ` are entries of their own; keep the separator and translate each part by its entry. `och` is `and` and `eller` is `or`, with no comma before them: `X, Y och Z` is `X, Y and Z`. A colon after a label stays: `Agenter: inga` is `Agents: none`.

**Address.** `du` and `dig` are `you`. `sin` and `sitt` for a person of unknown sex are `their`; `sig själv` is `themselves`.

**Quotation marks.** Swedish `”{{title}}”` is English `“{{title}}”`.

**Capitals.** Sentence case. Skills, traits and offices are lowercase inside a sentence. A label that starts lowercase in Swedish starts lowercase in English.

### Tone

**Log and event titles are in the historical present.** The engine titles its events in the present tense (`{{name}} föds`, `{{name}} avrättas`, `Pesten når huvudstaden`, `Familjen återvänder`), as chronicles and Crusader Kings event titles do. English does the same: `{{name}} is born`, `{{name}} is executed`, `The plague reaches the capital`, `The family returns`. A Swedish present passive in -s is an English present passive, never `was`. `{{name}} gifter sig med {{name2}}` is `{{name}} marries {{name2}}`. A noun title stays a noun title: `Seger mot {{name}}` is `Victory over {{name}}`.

**Memories and opinion reasons keep the Swedish tense.** The engine names a memory in the past (`Kravet avvisades offentligt`, `Löftet omförhandlades`) and an opinion reason as a noun or participle phrase (`Förlorat ämbete`, `Avrättad släkting`, `Bjöds på gästabud`). English follows each: `The demand was refused in public`, `The promise was renegotiated`, `Lost office`, `Executed relative`, `Invited to a feast`. A perfect stays a perfect: `{{name}} har avlidit` is `{{name}} has died`.

**Event descriptions are plain present-tense statements.** `{{name}} och {{name2}} gifter sig.` is `{{name}} and {{name2}} marry.` Add no colour the Swedish lacks.

**A button or an option is an imperative.** `Avböj bidraget` is `Decline the contribution`. `Låt rådet avgöra` is `Let the council decide`.

**A refusal states the missing thing in one sentence.** Write no apology, no `please` and no advice the Swedish lacks. Keep the final period; `playerText` shows the player only text that ends a sentence. The recurring shapes:

| Swedish | English |
| --- | --- |
| X finns inte. | The X does not exist. |
| X saknas. | The X is missing. |
| Ingen X finns. | There is no X. |
| Ogiltig X. / X är ogiltig. | Invalid X. / The X is invalid. |
| Okänd X. | Unknown X. |
| Otillräcklig statskassa. | Not enough in the treasury. |
| Otillräckligt med silver. | Not enough silver. |
| Kräver härskarmandat. | Requires the ruler’s mandate. |
| Välj ett grannrike. | Choose a neighbouring realm. |
| X finns redan. / X gäller redan. | The X already exists. / The X is already in force. |
| Återvänd från exil först. | Return from exile first. |

**Story text is plain and concrete.** The event chains describe a household at work: a list by a door, a letter on a table. Keep the present tense, the short sentences and the objects. Address the player as `you`. Use no archaic English (`thee`, `my liege`) and no modern idiom. The line under an option is rule text: keep each number, each `;` and the order of the effects, as in `The family pays 6 silver and the family’s influence rises by 2.`

**Spelling.** British, as the glossary says: rumour, favour, honour, recognised, mobilisation, programme, neighbouring, councillor.

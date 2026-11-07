# AD 1200 court dossiers

Codex prepared this research batch on 7 November 2026 and published it at main `d8d8abd8`, for the bookmark `1200-12-31`. The [court dossier](../../../server/seed/historical/courts/ad1200-courts.json) covers five polities, eight documented people and 40 source records. It contains no generated person and records 14 withheld entries, including grouped household gaps.

The researchers completed the source review with three research-ready courts: Khmer Angkor, Almohad and France. Western Xia remains blocked because independent readers could not verify its historical seat linkage. Chimú remains blocked for its unresolved ruler and name pool. These two blocked records are completed research outcomes under the brief. The initial checks assessed 103 occurrences: 90 confirmed, one corrected and 12 unsupported. A separate follow-up assessed 13: ten confirmed and three unsupported, all concerning the Xia linkage. The controller preserved both rounds and narrowed the final Xia context. The final controller structural validator and Swedish sweep passed. [PR #20](https://github.com/sp1e/Attainder/pull/20) merged as `d8d8abd83f21cf356de63c2ec65a426129b8470e`; the controller verified remote main. [CI run 42380857461, job 128427973364](https://github.com/sp1e/Attainder/actions/runs/42380857461/job/128427973364) passed with 4,815 tests total, 4,813 passed, zero failed and two TODO. The build completed in 27.75 seconds.

Claude owns the court importer, game code, tests and built scenarios. This publication records research for that work. Codex has changed no game code, test or built package in this batch and claims no gameplay verification or integration.

## Coverage

| Polity | Proposed ruler | Living roster | Seat marker | Research limits |
|---|---|---:|---|---|
| Western Xia | Li Chunyou | 2 | Modern Yinchuan point | Blocked: historical Xingqing linkage independently unverified; includes his mother Luo |
| Khmer Angkor | Jayavarman VII | 1 | Angkor Thom | Conflicting reign endpoints; two named wives withheld for missing bookmark-survival evidence |
| Almohad | Muhammad ibn Yaqub al-Nasir | 1 | Marrakech | Conflicting reign endpoints; Marrakech and Seville court evidence; no dated additional household |
| Capetian France | Philip II | 4 | Paris | Ingeborg's disputed marriage status; Agnes and the children of her union withheld |
| Chimú | Unresolved | 0 | Chan Chan | Blocked: no named ruler placed at the bookmark and no appropriate attested name pool |

The JSON gives source URLs, locators, original chronologies and claim statuses. The researchers opened each cited source during this session. `peopleWithheld` records bounded exclusions; an empty spouse array does not establish celibacy or a complete household. The external kinship fields describe relationships during the person's life and may include deceased or undated relatives.

## Dates, households and institutions

The researchers preserve each source's dating in `asWorded` and in its source record. They make no calendar-day conversion without a cited conversion. Getty city points identify settlement areas; the sources leave each ruler's location on 31 December 1200 uncertain.

January 1 birth dates serve the simulation where the source gives a year or approximation. Luo has a generated `1150-01-01` birth value because the consulted passages provide no birth date. Her documented identity and survival evidence remain separate from that simulation value. Claude must preserve both labels.

For Western Xia, Galambos gives Li Chunyou's reign as 1193–1206. The British Library table starts the Tianqing era in 1194; the researchers retain that era date without treating it as an accession date. The independently read Met entry prints 1032–1227 for Xixia. The authoring researcher reports reading 1038–1227 and the capital Xingqing (Yinchuan) in Shen's Cambridge frontmatter, printed p. xxxv. The independent reviewer could not obtain that table: Python, PowerShell and direct web requests returned 503. The dossier retains Shen only as uncertain author-read attribution, including the unverified 1038 range. The final context contains the confirmed reign, Luo and printing facts and omits the historical seat assertion. Getty verifies the modern Yinchuan point; its record does not establish the medieval capital relation. Western Xia stays blocked, with no invented alternate historical seat. The accessible evidence explains no difference between the submitted dynasty start years.

Jayavarman VII's reign starts in 1181 in the cited institutional records, but the endpoints differ. Getty gives about 1218; the Met regional chronology gives ca. 1243; Met object 36.96.5 gives 1218; the National Museum of Cambodia gives c.1220. The dossier leaves the endpoint uncertain. The public John Carroll University abstract supplies the approximate lifetime; access barriers prevented reading the full article. The Thai Khadi abstract names Jayarajadevi and Indradevi and gives their marriage sequence, but supplies no dated survival to the bookmark. Berkeley's lecture summary supports claims through maternal and paternal kin; the researchers excluded its inconsistent parenthetical kinship example.

For Muhammad al-Nasir, Hazard, Bongianino and Spain's Ministry of Culture give 1199–1213. Larousse gives a 1199–1212 caliphate and death in 1214. Archnet gives 1199–1213 alongside 599–609 AH. The researchers preserve those printed dates without reconciling them through an invented conversion. Larousse's 1179 birth year remains uncertain. The dossier distinguishes the Almohad ruler from the Abbasid al-Nasir in Baghdad. Marrakech serves as one court seat: the Met names courts in Marrakech and Seville, UNESCO calls Marrakech the Almohad capital for 1147–1269, and Archnet describes a move to Seville in 1170.

The initial independent reader could not inspect Hazard or the Ministry definition. The independent follow-up retrieved Hazard's official ANS TEI XML, section `d1e10756`, and inspected the specified ruler, succession and coin-legend paragraphs. The HTTPS route redirects to the publisher's HTTP XML and needs enough read time. PowerShell retrieval with `Accept: text/html` recovered the Ministry's substantive definition with normal certificate validation. The reviewer confirmed the affected historical claims; chronological conflicts and editorial succession mappings retain their uncertain status. The collateral-household gap concerns only the consulted Abd Allah and Idris ruler entries; the researchers make no claim about the whole book.

The researchers also narrowed their reason for withholding al-Nasir's son. Bongianino dates a codex to 599/1203 and connects it with a birth celebration, without giving a separate birth year. Le Tourneau's public JSTOR preview names successor Yusuf al-Mustansir and gives competing ages at his late-1213 accession: at most sixteen or possibly ten, with an explicit warning about the evidence. Those estimates leave birth before the bookmark unresolved. The connection between manuscript R.33's dedicatee Abu Yaqub and the successor's combined name Yusuf al-Mustansir remains an inference. The dossier withholds the son for unresolved chronology; it no longer asserts a proved post-1200 birth. Full chapter access and Le Tourneau's footnote were unavailable. The independent follow-up confirmed this narrowed rationale and its limits after the first check had accepted the earlier inference.

France's roster contains Philip, Ingeborg, Louis and Blanche. Lex and Epistolae document the marriage dispute and the reconciliation in September 1200. The researchers withhold Agnes's active spouse record because the consulted passages leave her later relationship status unresolved. They withhold the children of that union rather than backdating the 1201 legitimation or assuming undated births. Epistolae's Ingeborg biography gives a 1237–38 death in its metadata but describes a 1239 procession; the dossier relies on the earlier relationship evidence and Lex's lifespan instead of that procession.

The religious records describe the rulers' ties to particular institutions or traditions. They confer no universal religious authority. Innocent III remains an external officeholder, with no invented French household membership. The dossier identifies no dated overall religious head for the Western Xia or Khmer entries.

## Chimú source gap

UNESCO discusses social complexity between the ninth and fifteenth centuries and a fifteenth-century apogee. Urban dates Chan Chan's settlement foundation to 900–1000. D'Altroy's public Cambridge summary places the emergence of the power that developed into the Chimú Empire after approximately 1200. These authors discuss different stages; their periods establish neither an exact founding year nor a named ruler on the bookmark.

Campana reproduces a dynastic legend recorded in 1604, with a founder, son and grandson but no absolute reign dates. The researchers withhold Taycanamo/Tacaynamo, Guacricaur and Nañcenpinco. Voláková places Minchangaman's defeat in the 1460s, so the researchers withhold him too. Their exclusion does not assert that no other source could identify an earlier ruler.

The researchers searched Chimú/Quingnam names, dynastic chronology, colonial genealogies, kingship and Chan Chan studies. Zevallos's public repository abstract describes a colonial-manuscript name corpus and mentions Tacaynamo's arrival legend. It supplies no usable ordinary-name list, gender assignments or individual attestations for 1200. The initial independent reviewer corrected the earlier assertion that the abstract named no person. Direct origin access failed; a reader proxy exposed the abstract. The researchers removed the unverified full-text-restriction claim and make no claim to have read the book's full text.

The independent follow-up inspected Urban's article through SciELO HTML after the original publisher PDF proved inaccessible. Urban discusses scarce Quingnam evidence and invented modern building names. His introductory foundation range of 900–1000 cites Moore and Mackey 2008, p. 783; the researchers did not inspect that underlying work. The settlement date does not resolve D'Altroy's later political periodization. The reviewer confirmed the bounded Urban and corrected PUCP claims. The researchers created neither a personal-name pool nor a generated ruler from these materials.

Broad reconstructions of kingship, lunar tradition and split office/estate inheritance do not establish a dated political constitution for 1200. The title, religious relationship and succession assessment remain uncertain. Unknown rulership supplies no basis for a collective-rule label.

## Geometry and attribution

The controller tested all five Getty points with Shapely against valid accepted polygons in the pinned Historical Basemaps GeoJSON. All five points lie inside their respective features: Western Xia 22, Khmer Angkor 217, Almohad 271, France 277 and Chimú 59. The map commit is `4b5039e50d8d2464b065bd76ad6086cd4597108d`; the source-file SHA-256 is `2d6913ecedb38e269e41d249c87874d81e3e8d7351754821f57e627442d91525`. The JSON records this physical check in `geometryCheck`, separate from historical review.

The prior polygon decisions approve approximate gameplay regions. They establish no frontier, uniform control, palace location or exact-day itinerary. Chimú's unresolved court does not reverse its accepted approximate-core map decision.

Coordinate data credit: J. Paul Getty Trust, Getty Research Institute, [Getty Thesaurus of Geographic Names (TGN)](https://www.getty.edu/research-conservation/tools-databases/vocabularies/data-services/), under ODC-By 1.0. Each seat retains its TGN record and source credits. The researchers consolidated three records for the same Getty licensing page under `a2-getty-data-license`; they kept distinct historical publications separate. Other works remain reference-only. Codex redistributes no source images, maps or extended source prose in this batch.

## Rulings for import

- Ruling: complete A2 with three ready courts and two substantively blocked courts. The independent follow-up confirmed ten occurrences and left three Xia linkage occurrences unsupported after repeated 503 responses. Keep the uncertain author-read attribution, narrow the context and block Xia rather than invent a seat. The cost is deferred playability for two polities; the other research can proceed.
- Ruling: permit `people: []` for blocked Chimú alone. The no-invention rule takes precedence over filling the one-ruler template when researchers lack both a dated ruler and an attested name pool. The cost is deferred playability for this court. Research-ready courts still require one ruler.
- Ruling: preserve partial households, withheld people and external kinship. The read passages leave survival, role or relationship gaps. Filling those gaps would invent a dated roster.
- Ruling: retain Luo's generated birth and the uncertain birthdays of documented people. The game needs dates beyond the sources' precision. Losing the labels would misrepresent simulation values as historical birthdays.
- Ruling: use `none-fits` for Western Xia, Khmer Angkor, Almohad and Chimú, with uncertain mapping notes. The cited practices do not establish either available engine law. The cost is that Claude must resolve the mapping before import. France retains an uncertain primogeniture approximation, including its limitation against the game's gender-neutral rule.
- Ruling: preserve the French marriage dispute with the existing `multiple-spouses` limit. The sources describe competing legal relationships, with no claim of a church-approved plural marriage. The cost is an incomplete relationship model until Claude represents the dispute.
- Ruling: retain the Almohad `elective-rule` limit for the cited designation and election precedents. The dossier makes no merit-council claim for 1200. An automatic law would conceal the recorded limitation.
- Ruling: retain conflicting Khmer and Almohad dates and the Marrakech/Seville distinction. The sources disagree or describe more than one court. Choosing a unique endpoint or capital would conceal those limits.
- Ruling: withhold al-Nasir's son for unresolved pre-bookmark birth. A dated manuscript and birth celebration do not establish a separate birth year, while Le Tourneau gives competing accession ages. The cost is a partial household until researchers can resolve the chronology. Keep the R.33 dedicatee's identification with Yusuf al-Mustansir qualified.
- Ruling: retain proposed name-pool identifiers with `namePoolStatus: proposed-unbuilt`. This batch creates no pool asset. Importing those ids as available data would create a missing dependency or fictional replacement.
- Ruling: keep geometry evidence separate from historical notes and review counts. The controller tested actual coordinates and polygon bytes. Treating source review as a geometry check would overstate what the historical passages establish.

## Corrections outside the research edit scope

Codex has left `ad1200-review.json` unchanged. The dossier proposes two corrections for Claude:

- `sources.khmer`: preserve the Met's printed chronology and add the competing Getty, Met object and National Museum endpoints with an uncertainty note. The initial source-only reader confirmed the four historical spans. The controller inspected the repository to confirm the omission, then checked feature 217 and geometry separately. Those technical findings do not change the source-review counts or the prior approximate-polygon decision.
- `sources.chimu.scopedClaim`: restrict UNESCO's broad chronology to social complexity and Chan Chan's capital role. Record the later Cambridge political periodization and unresolved ruler without claiming a continuous dated constitution.

## Review and next work

| Initial review scope | Checked occurrences | Confirmed | Corrected | Unsupported / dossier dropped |
|---|---:|---:|---:|---:|
| Western Xia | 22 | 19 | 0 | 3 |
| Khmer Angkor | 17 | 16 | 0 | 1 |
| Almohad | 15 | 8 | 0 | 7 |
| Capetian France | 36 | 36 | 0 | 0 |
| Chimú | 13 | 11 | 1 | 1 |
| Total | 103 | 90 | 1 | 12 |

These counts describe initial occurrences, including repeated source use. `dropped` maps the first reviewers' unsupported verdicts; later access recovery does not rewrite those counts. One Khmer occurrence combined verified history with repository/polygon assertions that the controller checked separately.

| Follow-up review scope | Checked occurrences | Confirmed | Corrected | Unsupported / dossier dropped |
|---|---:|---:|---:|---:|
| Western Xia | 3 | 0 | 0 | 3 |
| Almohad | 8 | 8 | 0 | 0 |
| Chimú | 2 | 2 | 0 | 0 |
| France and Khmer | 0 | 0 | 0 | 0 |
| Total | 13 | 10 | 0 | 3 |

The follow-up rechecked changed and access-dependent components; it adds no unique-claim total. The reviewer confirmed seven recovered Almohad components, the narrowed birth rationale, Urban's bounded foundation component and the corrected ordinary-name limitation. Three Xia linkage components remained inaccessible. The final dossier removes that linkage from the sourced context, labels the point Yinchuan and retains the historical relationship only as uncertain attribution with a substantive blocker. The controller's separate Khmer technical check remains outside these source-only counts.

The controller completed final structural validation and published the research through merged PR #20. Claude must wire the importer, preserve the statuses and withheld evidence, resolve engine limits and name-pool dependencies, and verify built scenarios and gameplay. Western Xia and Chimú remain unavailable until their substantive blockers have supported resolutions. B1, the AD 1500 map review, is a validated candidate awaiting PR publication. A2 adds no game code or built scenario; repository CI establishes no court integration, gameplay or deployment result.

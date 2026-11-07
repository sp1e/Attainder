# AD 1500 court research: Aztec and Inca

The dossier covers `1500-12-31` for the two polities accepted in B1: Aztec feature 80 and Inca feature 83. It contains five documented identities, seven withheld entries and nineteen retained source records. The two researchers supplied twenty records; the shared Getty licensing page was deduplicated after the separate source audits. Both courts are research-ready after independent source review, correction, a separate scoped follow-up and controller content checks. Game integration remains pending.

[B1 PR #21](https://github.com/sp1e/Attainder/pull/21) merged at `3bc2d7c7edc0888798b4408803f27f9585d4da94`. Its required check passed 4,813 tests with zero failures and two TODOs, and the build completed in 46.30 seconds. Those results concern B1. Ming feature 77 remains unresolved and quarantined; Ottoman feature 290 remains rejected and quarantined. Neither enters this court dossier.

| Court | Documented identities | Seat | Research scope |
|---|---|---|---|
| Aztec Empire | Ahuitzotl; Cuauhtémoc | Tenochtitlan, Getty TGN 7668941 | One ruler and an uncertain-age son; no dated complete household |
| Inca Empire | Huayna Capac; Huáscar; Araua Ocllo | Cusco, Getty TGN 7005819 | One ruler and two relatives with uncertain bookmark placement |

## People, dates and institutions

The Met and INAH place Ahuitzotl's reign in 1486–1502. Cuauhtémoc's birth estimates differ: the Met prints 1495?, while a UNAM interview gives 1497–1499. These explicit pre-bookmark estimates and later life support his uncertain placement. They establish no attendance at his father's court on the day. The dossier withholds Tiyacapantzin as an active household member and retains the conflicting maternal genealogy without choosing a grandfather. See [Met chronology](https://www.metmuseum.org/ja/toah/ht/08/canm.html), [INAH, Templo Mayor](https://lugares.inah.gob.mx/es/node/4463), [UNAM, Cuauhtémoc](https://ciencia.unam.mx/leer/1569/cuauhtemoc-el-ultimo-gran-gobernante-mexica-en-resistencia) and [Castañeda's public genealogical excerpt](https://arqueologiamexicana.mx/node/6984).

Ruling: preserve Ahuitzotl's generated `1450-01-01` birth value and the uncertain January 1 marker for Cuauhtémoc. The sources leave the ruler's birth unknown and the son's date approximate. Treating these values as exact birthdays would invent precision. Vela's differing aqueduct dates and death explanations remain unresolved. The dossier identifies the Templo Mayor cults without assigning a named temple head for the bookmark. See [Vela, Ahuítzotl](https://arqueologiamexicana.mx/node/1016) and [INAH](https://lugares.inah.gob.mx/es/node/4463).

Ruling: retain `merit` as an uncertain Aztec game mapping with `elective-rule`, `collective-rule` and `no-sourced-household`. Townsend uses the term primogeniture while describing restricted dynastic candidates and council approval. Torquemada describes brother succession and suitability. The dossier preserves both descriptions. A game rule that omitted the lineage restriction would misrepresent that evidence. See [Townsend, printed p. 202, PDF page 12](https://web.as.uky.edu/history/faculty/myrup/his206/Townsend%2C%20Richard%20-%20Aztecs%20%28excerpts%29.pdf) and [Torquemada, book II, chapter LXIII, p. 257](https://historicas.unam.mx/publicaciones/publicadigital/monarquia/volumen/01/03Libro_Segundo/miv1128.pdf).

The Inca dossier preserves competing chronologies. Smithsonian gives Huayna Capac's reign as 1493–1527; Bray discusses 1527/1528, and Sarmiento gives 1524 for his death. Bray infers an approximate birth span from the 1447–1448 endpoint to the 1457–1458 endpoint using colonial age accounts. The earlier draft incorrectly described two separate birth windows; the corrected dossier preserves the span. Huayna's `1457-01-01` game birth remains generated. See [Smithsonian, Empire Builders](https://americanindian.si.edu/inkaroad/inkauniverse/cusco/empire-builders.html), [Bray, p. 810](https://repositoriodigital.bnp.gob.pe/bnp/recursos/2/html/el-imperio-inka/810/) and [Sarmiento, Markham translation, pp. 133–146](https://www.yorku.ca/inpar/sarmiento_markham.pdf).

Huáscar's approximate 1491 birth and later life support uncertain placement before the bookmark. Sarmiento names Araua Ocllo as his mother and describes her later life; her placement follows an explicitly uncertain cross-source inference. Her marriage has no date-specific spouse link, and her `1470-01-01` game birth is generated. The dossier keeps Huáscar's competing 1532/1533 death dates visible and asserts no childhood residence. See [VLE, Huáscar](https://www.vle.lt/straipsnis/huaskaras/) and [Sarmiento, chapters LX and LXIX](https://www.yorku.ca/inpar/sarmiento_markham.pdf).

Ruling: keep Atahualpa withheld because the inspected chronologies conflict. VLE gives a birth around 1502, while Sarmiento assigns him 36 years of life at an execution narrated after Huáscar's death in 1533. The latter implies a pre-1500 birth within that narrative. The correction removes the earlier claim that the inspected passages supplied no such evidence. The dossier enters no calculated birth year. Choosing one account as certain would hide the conflict. See [VLE, Atahualpa](https://www.vle.lt/straipsnis/atahualpa/) and [Sarmiento, chapter LXIX, p. 162](https://www.yorku.ca/inpar/sarmiento_markham.pdf).

Ruling: retain Inca succession as `none-fits`, with `elective-rule` flagging the historical question of elite participation. The scholarly article discusses competing models and their colonial sources. This research supplies no verified statement about runtime behavior. The unsupported implementation assertion was removed. The religious-office claim remains uncertain and appoints no named institutional leader for the bookmark. See [Hernández Astete, succession study](https://www.scielo.cl/scielo.php?pid=S0717-73562012000400008&script=sci_arttext), [Smithsonian, A Road for Religion](https://americanindian.si.edu/inkaroad/inkauniverse/inkaroadexpansion/road-religion.html) and [Sarmiento, chapter LVII](https://www.yorku.ca/inpar/sarmiento_markham.pdf).

## Seats and licensing

The controller independently checked both exact Getty points against the actual public pinned GeoJSON, SHA-256 `d01ffc9b80629787f13d2b1c2f881f005bc0164433548e30f5c058ddee0bfc7b`. Both accepted polygons are valid and contain the respective point. These technical checks remain separate from historical source-review counts. The markers establish no palace coordinate or exact-day itinerary. B1's disclosed territorial limitations remain. See [Getty, Tenochtitlan](https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=&nation=&place=&subjectid=7668941), [Getty, Cuzco](https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=&nation=&place=&subjectid=7005819) and [Smithsonian, Cusco](https://americanindian.si.edu/inkaroad/inkauniverse/cusco/cusco-experience.html).

Getty attribution: Getty Research Institute, Getty Thesaurus of Geographic Names, J. Paul Getty Trust, with contributors and sources listed in each record. Vocabulary data uses ODC-By-1.0. The licensing-page prose remains reference-only. The source-ID mapping `b2-inca-getty-license` to `b2-aztec-getty-license` retains the unchanged Aztec page record and both coordinate records' data terms. It changes no review occurrence into an additional confirmation. See [Getty licensing and citation terms](https://www.getty.edu/research-conservation/tools-databases/vocabularies/data-services/).

## Independent review

| Initial frozen packet | Checked | Confirmed | Corrected | Dropped |
|---|---:|---:|---:|---:|
| Aztec | 24 | 24 | 0 | 0 |
| Inca | 30 | 27 | 2 | 1 |
| Total | 54 | 51 | 2 | 1 |

Two fresh `codex exec` sessions received claims and source records without the authors' drafting reasoning. They retrieved every cited URL and inspected the relevant passages, including the scanned PDFs. The controller applied both Inca corrections, removed the unsupported implementation note and preserved Townsend's terminology in the Aztec succession note. A separate source-only follow-up confirmed all three final historical occurrences against five reopened sources. Aztec contributes one follow-up occurrence and Inca two. These repeated occurrences remain separate from the initial 54-claim audit.

The private validator verifies structure, actual point containment and hash-bound review receipts. Its output explicitly distinguishes review-audit verification from final historical-content approval. The controller checked the applied corrections against the actual reports and retained the three fresh follow-up verdicts. Historical source verification and repository compatibility do not establish a working game start.

## Handoff to Claude

Ruling: keep `mexica-nahuatl-1500` and `inca-ad1500` as proposed, unbuilt name-pool IDs. No generated identity or name-pool asset enters this batch. An importer must preserve that distinction or it could create a missing asset dependency.

Claude owns the importer, runtime, tests, builders, built scenarios and gameplay verification. The importer must preserve partial households, uncertain survival, generated birth labels, original chronology and the succession limits. Codex's research-ready state describes the dossier's research status. This batch supplies no integrated playable court.

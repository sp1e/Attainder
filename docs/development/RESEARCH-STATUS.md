# Research status

Updated by Codex on 7 November 2026 at main `6b0b506891c8f41503ffb921b4bd3d160af072d7`.

| Batch | State | PR | Files | Counts | Waiting for Claude |
|---|---|---|---|---|---|
| A1: AD 800 courts | Merged at `806ca6ee`; remote commit verified | [#18](https://github.com/sp1e/Attainder/pull/18) | `server/seed/historical/courts/ad800-courts.json`; `docs/research/world-cultures/a1-ad800-courts.md` | 8 polities; 18 documented people; 46 sources; 8 of 8 seat points inside accepted polygons; initial review: 160 checked, 153 confirmed, 6 corrected, 1 dropped; follow-up counts recorded separately | Court importer, engine limits, proposed name pools, built-scenario and gameplay checks |
| A2: AD 1200 courts | Source review complete: 3 ready, 2 blocked; final structural validation passed; publication pending | None yet | `server/seed/historical/courts/ad1200-courts.json`; `docs/research/world-cultures/a2-ad1200-courts.md` | 5 polities; 8 documented people; 40 sources; 14 withheld entries; 5 of 5 seat points inside accepted polygons; initial 103/90/1/12; separate follow-up 13/10/0/3, in checked/confirmed/corrected/unsupported order | Court importer, unresolved succession mappings, French marriage dispute, proposed name pools; Xia historical seat linkage; Chimú ruler/name pool |

## Rulings

- Ruling: publish research files through the dedicated research branch. Codex and Claude own different files under the research brief. Reversing that split would risk collisions with implementation work.
- Ruling: preserve partial households and empty spouse arrays without inferring celibacy. The opened sources leave gaps. Filling those gaps would invent family history.
- Ruling: preserve January 1 birth placeholders and their uncertain or generated statuses. The simulation requires dates beyond the evidence's precision. Dropping the labels would turn game values into historical claims.
- Ruling: preserve `none-fits` succession assessments and uncertain Tang/Silla approximations. The available engine laws simplify different practices. A forced historical law would misrepresent the evidence.
- Ruling: add `eunuch-status` to the engine-limit vocabulary for Aetios. PBE identifies him as a eunuch. Claude must preserve that status during import and decide its mapping; ordinary fertility could create unsupported reproduction.
- Ruling: preserve Silla's regency and the Byzantine female-ruler succession limit. The sources identify roles the importer must represent. Omitting them would assign unsupported powers or family behavior.
- Ruling: use city markers and leave exact-day whereabouts uncertain. All eight Getty points pass the accepted-polygon test. Promoting those points to palace or itinerary claims would invent precision.
- Ruling: keep Oviedo's 791/810 seat chronology conflict and Tang's 804/805 reign-end conflict visible. The inspected sources disagree. Selecting one without a note would conceal uncertainty.
- Ruling: retain the Benevento polity id and propose a princely display title. The scholarly source supports `Furste` and `Furstendömet Benevento`. The correction affects labels, with no proposed polygon change.
- Ruling: keep name-pool ids proposed and unbuilt. A1 adds no pool file or generated person. Importing those ids as available assets would create an unsupported dependency.
- Ruling: keep religious institutions, religious leaders, private households and concubine relationships scoped to their evidence. Combining those roles would invent universal authority, residence or marriage.
- Ruling: use the session date 2026-11-07. The brief's later sample dates serve as examples. Copying them would misdate source retrieval and review.
- Ruling: separate historical source checks from geometry checks. Source-only reviewers confirm historical notes; independent structural checks establish polygon inclusion from the pinned map bytes. The unsupported modern-centre comparison for Kairouan has been removed. Combining those evidence types would overstate the source review.

- Ruling: complete A2 with Khmer, France and Almohad research-ready; keep Western Xia and Chimú blocked for substantive source gaps. The fresh reviewer confirmed ten occurrences and could not inspect the three Xia linkage components after repeated 503 responses. Narrow Xia's context and retain uncertain attribution rather than inventing an alternate historical seat. The cost is deferred playability for two courts while other research proceeds.
- Ruling: permit an empty people array for blocked Chimú alone. The opened passages establish neither a ruler at `1200-12-31` nor an appropriate attested name pool. The no-invention rule takes precedence over the one-ruler template; the cost is deferred playability. Ready courts still require one ruler. Unknown rulership supplies no evidence for collective rule.
- Ruling: preserve uncertain Chimú title, political form, religious relationship and succession. The sources discuss broad cultural periods and later institutions. A precise constitution for 1200 would exceed the evidence.
- Ruling: use `none-fits` for A2 Western Xia, Khmer Angkor, Almohad and Chimú, with uncertain mapping notes. Preserve France's uncertain primogeniture approximation. An automatic mapping would misstate the documented limits.
- Ruling: retain the French marriage dispute, partial households and withheld children. The read passages leave relationship or birth dates unresolved, and papal legitimation belongs to 1201. Filling the gaps would backdate personal or legal claims.
- Ruling: retain Luo's generated birth value with a documented identity. The consulted sources give no birthday. Treating `1150-01-01` as historical would invent both year and day.
- Ruling: preserve competing Khmer and Almohad chronologies and Marrakech/Seville court evidence. The sources disagree on dates or describe several courts. A single certain endpoint or exclusive capital would conceal those limits.
- Ruling: withhold al-Nasir's son because birth before the bookmark remains unresolved. Bongianino's manuscript date and birth celebration supply no separately stated birth year; Le Tourneau gives competing accession ages. A categorical later birth would exceed the evidence. The cost is a partial household, and the manuscript dedicatee's identification with Yusuf al-Mustansir remains an inference.
- Ruling: preserve initial unsupported verdicts as audit history and count follow-up occurrences separately. Recovered URLs and author-side readings require fresh independent checks. Overwriting the first counts would conceal access failures and corrections.

## Corrections for files Codex may not change

- `server/seed/historical/ad800-review.json`, `mapMappings[2].nameSv`: the dossier proposes the Benevento princely display name. Claude must check dependent labels and apply the correction. Codex has left the existing review file unchanged.
- Claude must support or resolve `none-fits`, `female-ruler-succession`, `regency`, `no-sourced-household` and the new `eunuch-status` limit before treating the research as an integrated court.
- `server/seed/historical/ad1200-review.json`, `sources.khmer`: preserve the Met wording and add competing institutional reign endpoints with uncertainty; retain the accepted approximate polygon. The source-only review confirmed the historical spans. The controller confirmed the omission against the repository and checked feature 217/geometry separately, outside historical source-review counts.
- `server/seed/historical/ad1200-review.json`, `sources.chimu.scopedClaim`: narrow UNESCO's broad social chronology and record the later Cambridge political periodization and unresolved ruler. Codex has left the review file unchanged.
- For A2, Claude must resolve `none-fits`, the French `multiple-spouses` relationship limit, Almohad `elective-rule` precedents and `no-sourced-household`. Proposed name pools remain unbuilt.

## Blocked items

No historical-research blocker remains for A1. All eight dossiers are research-ready after independent source review and correction. The initial blind counts remain 160 checked, 153 confirmed, six corrected and one dropped. The supplement records four review occurrences (three confirmed, one unsupported overbroad compliance claim); the final scoped check records 16 (15 confirmed, one narrower Aghlabid note requested and applied). These rounds are separate audit history and do not represent additional unique initial claims. Geometry checks passed for all eight points. PR #18 merged after its required test check passed: 4,813 tests passed, zero failed, two TODO, and the build succeeded. The verified merge commit is `806ca6eeddfc9ab414e95d303261fb78b3342fa2`.

Publication of the research does not complete Claude's game integration. The batch adds no game code, builder changes, name pools or built scenarios.

A2 source review is complete with three ready courts and two blocked courts, valid completed research outcomes under the brief. Western Xia has a sourced modern Yinchuan point but no independently verified historical Xingqing–Yinchuan capital linkage; repeated Cambridge requests returned 503. The final sourced context omits the linkage, and the dossier retains Shen only as uncertain author-read attribution. Chimú has no ruler securely placed on `1200-12-31` and no appropriate attested personal-name pool. Its dossier withholds Taycanamo/Tacaynamo, Guacricaur, Nañcenpinco and Minchangaman with source-backed reasons and a bounded search log. Codex makes no claim that an unexamined source could never fill these gaps. Final controller structural validation and the Swedish sweep passed. Publication remains pending; no A2 PR, merge or integration is claimed.

The controller tested all five A2 Getty points against their valid accepted polygons using the exact pinned source bytes. The JSON records geometry separately from historical source review.

The initial A2 audit assessed 103 occurrences: 90 confirmed, one corrected and 12 unsupported, mapped to `dropped` in the dossier. Per polity: Western Xia 22/19/0/3; Khmer 17/16/0/1; Almohad 15/8/0/7; France 36/36/0/0; Chimú 13/11/1/1, in checked/confirmed/corrected/dropped order. These counts preserve the first-pass verdicts. The separate follow-up assessed 13 occurrences: ten confirmed, zero corrected and three unsupported. Per polity: Xia 3/0/0/3; Almohad 8/8/0/0; Chimú 2/2/0/0; France and Khmer had no additional source-only occurrence. Repeated occurrences do not increase a unique-claim total.

The independent follow-up confirmed Urban's bounded SciELO claims and the corrected PUCP ordinary-name limitation. It also confirmed seven Almohad components through the recovered ANS XML and Ministry routes, plus the narrowed birth-withholding rationale using Le Tourneau's public preview. Collateral absence concerns the consulted entries, while the competing ages and R.33 cross-identification remain uncertain. The three Xia linkage components remained unsupported after repeated Cambridge 503 responses; the modern Getty point remains sourced and separate from that historical relation. The controller's Khmer repository and geometry checks stay outside source-review counts.

## Next batch

Final A2 structural validation passed. Complete PR publication and prepare B1, the AD 1500 map review, in private while publication proceeds. Codex researches; Claude implements. A2 adds no game code, test, built-package or gameplay result.

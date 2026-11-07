# Research status

Updated by Codex on 7 November 2026 at main `547b23c9`.

| Batch | State | PR | Files | Counts | Waiting for Claude |
|---|---|---|---|---|---|
| A1: AD 800 courts | Validated research candidate; publication pending | None yet | `server/seed/historical/courts/ad800-courts.json`; `docs/research/world-cultures/a1-ad800-courts.md`; this status file | 8 polities; 18 documented people; 46 sources; 8 of 8 seat points inside accepted polygons; initial review: 160 checked, 153 confirmed, 6 corrected, 1 dropped; follow-up counts recorded separately | Court importer, engine limits, proposed name pools, built-scenario and gameplay checks |
| A2: AD 1200 courts | Next | None yet | Not started | 5 required polities | Research follows A1 publication |

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

## Corrections for files Codex may not change

- `server/seed/historical/ad800-review.json`, `mapMappings[2].nameSv`: the dossier proposes the Benevento princely display name. Claude must check dependent labels and apply the correction. Codex has left the existing review file unchanged.
- Claude must support or resolve `none-fits`, `female-ruler-succession`, `regency`, `no-sourced-household` and the new `eunuch-status` limit before treating the research as an integrated court.

## Blocked items

No historical-research blocker remains for A1. All eight dossiers are research-ready after independent source review and correction. The initial blind counts remain 160 checked, 153 confirmed, six corrected and one dropped. The supplement records four review occurrences (three confirmed, one unsupported overbroad compliance claim); the final scoped check records 16 (15 confirmed, one narrower Aghlabid note requested and applied). These rounds are separate audit history and do not represent additional unique initial claims. Geometry checks passed for all eight points. Publication is pending.

The research batch adds no game code, tests, builder edits, name pools or built packages. No gameplay, deployment or publication claim follows from the draft.

## Next batch

A2 researches `western-xia`, `khmer-angkor`, `almohad`, `france-capetian` and `chimu` at `1200-12-31`. Begin after A1 review and publication. Preserve the brief's split: Codex researches; Claude implements.

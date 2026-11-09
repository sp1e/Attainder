# Event research: coverage audit and next passes

Snapshot: 9 November 2026, merged main `a1836eaff59ff36761814b0a0b98571418b0e8b9` ([PR #105](https://github.com/sp1e/Attainder/pull/105)). This audit reads the approved catalog and coverage index. It adds no historical claims or event records.

## What the counts establish

Researchers have approved 869 event records backed by 795 source records. The coverage index partitions all 4,830 years from 3300 BC through AD 1530 into 49 windows, with no year zero. Forty-two windows remain partial, covering 4,130 years. Seven windows, covering 700 years, remain unresearched in the published index. No window has `reviewed` or `no-secure-event` status.

Partial windows contain 85.5% of the calendar years. That percentage measures the reach of initial research, not project completion or complete historical coverage. Researchers still need to investigate gaps within those windows. The catalog contains 490 exact-year records across 413 distinct years; it also contains 121 approximate records, 191 ranges and 67 disputed records. Exact-year records need not specify a day. The remaining years cannot be described as years in which nothing important happened.

The category counts are politics 265, war 226, culture 169, religion 115, technology 47, nature 21, migration 16 and discovery 10. These counts describe author-assigned categories. They do not measure geographic completeness, importance or research quality.

## Counting method

Each event belongs to the window containing its `date.startYear`. A range that extends into another window counts once. Batch-delivery counts can differ from the window counts below when a retained date crosses a batch boundary. The exact-year column counts distinct start years among `date.kind = exact` records in that window. It does not count every year touched by a range. Source records count once across the whole catalog. Researchers should read each coverage note for its stated regional and subject gaps; free-text geography fields do not support a consistent regional score.

| Window | Published status | Events starting here | Distinct exact years |
|---|---|---:|---:|
| 3300-3201 BC | partial | 2 | 0 |
| 3200-3101 BC | partial | 7 | 0 |
| 3100-3001 BC | partial | 6 | 0 |
| 3000-2901 BC | partial | 6 | 0 |
| 2900-2801 BC | partial | 5 | 0 |
| 2800-2701 BC | partial | 9 | 0 |
| 2700-2601 BC | partial | 4 | 0 |
| 2600-2501 BC | unresearched | 0 | 0 |
| 2500-2401 BC | partial | 9 | 0 |
| 2400-2301 BC | partial | 2 | 0 |
| 2300-2201 BC | partial | 3 | 0 |
| 2200-2101 BC | partial | 3 | 0 |
| 2100-2001 BC | partial | 8 | 0 |
| 2000-1901 BC | partial | 16 | 0 |
| 1900-1801 BC | partial | 11 | 0 |
| 1800-1701 BC | partial | 15 | 0 |
| 1700-1601 BC | partial | 6 | 0 |
| 1600-1501 BC | unresearched | 0 | 0 |
| 1500-1401 BC | partial | 7 | 0 |
| 1400-1301 BC | unresearched | 0 | 0 |
| 1300-1201 BC | partial | 8 | 1 |
| 1200-1101 BC | partial | 8 | 1 |
| 1100-1001 BC | partial | 6 | 0 |
| 1000-901 BC | partial | 7 | 0 |
| 900-801 BC | unresearched | 0 | 0 |
| 800-701 BC | partial | 8 | 3 |
| 700-601 BC | partial | 7 | 4 |
| 600-501 BC | unresearched | 0 | 0 |
| 500-401 BC | partial | 32 | 11 |
| 400-301 BC | partial | 30 | 20 |
| 300-201 BC | partial | 31 | 10 |
| 200-101 BC | partial | 35 | 21 |
| 100-1 BC | partial | 27 | 19 |
| AD 1-99 | partial | 26 | 13 |
| AD 100-199 | partial | 27 | 13 |
| AD 200-299 | partial | 17 | 8 |
| AD 300-399 | partial | 29 | 19 |
| AD 400-499 | unresearched | 0 | 0 |
| AD 500-599 | partial | 19 | 10 |
| AD 600-699 | unresearched | 0 | 0 |
| AD 700-799 | partial | 34 | 23 |
| AD 800-899 | partial | 44 | 27 |
| AD 900-999 | partial | 44 | 27 |
| AD 1000-1099 | partial | 45 | 32 |
| AD 1100-1199 | partial | 56 | 30 |
| AD 1200-1299 | partial | 55 | 35 |
| AD 1300-1399 | partial | 62 | 36 |
| AD 1400-1499 | partial | 55 | 32 |
| AD 1500-1530 | partial | 38 | 18 |

## Work queue and boundaries

1. Keep the seven unresearched windows visible: 2600-2501 BC, 1600-1501 BC, 1400-1301 BC, 900-801 BC, 600-501 BC, AD 400-499 and AD 600-699. Private execution records document policy rejections in those workstreams. Their drafts do not establish published coverage. Diagnose each rejected operation before any dependent continuation; do not reconstruct it through a different route.
2. For independent new research, inspect the published coverage notes before choosing leads. The sparsest partial windows are 3300-3201 BC and 2400-2301 BC, with two records each, followed by 2300-2201 BC and 2200-2101 BC, with three each. These are candidates for regional gap research, not numerical filling targets. Source availability and chronology may limit additions.
3. For periods closer to existing playable starts, inspect the AD 200-299 coverage note (17 records) and AD 300-399 note (29 records) for uncovered regions or subjects. Select a distinct question after comparing existing events and prior held leads. Do not assume that another war or succession addresses a geographic gap.
4. Preserve the separate BC0800 and AD0500 supplement discovery material. Execution policy rejected their packaging operations; neither supplement has a frozen candidate, an independent review or approved additions. Continue unrelated work while those operations remain unresolved.
5. Require fresh source access, retained uncertainty, an independent claims check and Swedish/English display text for every new delivery. Advance coverage status only when the evidence meets the research brief. Runtime integration and gameplay verification remain Claude's responsibility.

Ruling: use this snapshot to prioritize missing research without presenting partial coverage as completion. Counting exact dates or spreading long ranges across years would overstate what the sources establish.

See [the research brief](../../development/CODEX-RESEARCH-BRIEF.md), [the generated coverage report](../historical-events-coverage.md) and [the current research status](../../development/RESEARCH-STATUS.md). Recompute this audit after later event deliveries before using its counts as current measurements.

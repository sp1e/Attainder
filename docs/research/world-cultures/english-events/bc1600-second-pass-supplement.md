# 1600–1501 BC: English research supplement, second pass

The [dataset](bc1600-second-pass-supplement.json) contains 2 events and 2 source records: none at importance 3 or 2, and 2 at importance 1. It takes up the four candidates that the [first pass](bc1600-supplement.md) left for a later pass.

| Date | Event | Category | Importance |
|---|---|---|---|
| c. 1600 BC | Villages flourish along the Coatzacoalcos River | culture | 1 |
| c. 1600–1500 BC | Lipari villagers leave the shore for the volcanic heights | migration | 1 |

## Evidence and chronology

Each event cites one Key Events entry of the Metropolitan Museum of Art's Heilbrunn Timeline of Art History, from the pages "Mesoamerica and Central America, 2000–1000 B.C." and "Southern Europe, 2000–1000 B.C.". The first pass cited both pages in its 1400–1301 BC supplement. Each source record names the entry by its date phrase and opening words. The research session read the page text only and examined no images, object records or primary editions.

On 12 November 2026 the live Met pages answered every request, from WebFetch and from curl, with HTTP 429 and a Vercel security checkpoint. The session made no attempt to pass the checkpoint. It read each page from its Internet Archive capture of the same URL: the Mesoamerica page from 22 April 2026 and the Southern Europe page from 23 November 2025. Each source locator names the capture. The captured pages carry the Met's own titles and citation lines. An independent check should compare the entries with the live pages once the checkpoint lifts.

The Met dates both entries with "ca.". The Coatzacoalcos record keeps an approximate date with `noteEn`. The Lipari entry gives a century, so the record keeps the range. The Met spells the phase "Capo-Grazini", and the record keeps that spelling and says so in `noteEn`. The Lipari entry ends with the Ausonian culture about 1300 BC; the record leaves that sentence out.

## Review and withholding

Duplicate checks ran against the runtime catalog (986 events) and every English dataset in this folder, by id and by historical episode. Each candidate has its own Key Events entry, so no entry covers two candidates.

- Coatzacoalcos villages: added as `ev-bc1600-coatzacoalcos-villages-flourish`. The entry is one sentence, but it gives the villages' resources (river resources and fertile soils), so the summary carries more than the title. The catalog's `ev-bc1500-san-lorenzo-olmekiskt-centrum` (1500–900 BC) covers the San Lorenzo centre, a single site, and its range does not include 1600 BC.
- Capo-Grazini phase on Lipari: added as `ev-bc1600-lipari-villages-move-upslope`. No catalog or English record covers the Lipari Islands.

Withheld:

- Villages in the Soconusco (about 1600 BC). The entry is one sentence saying that established villages expand in the Soconusco region of the Pacific coastal plain of Guatemala and Chiapas. A summary could only repeat the title, so the entry is too thin under the withholding rules. The catalog's `ev-bc1900-kakaodryck-i-paso-de-la-amada` (1900–1500 BC) and `ev-bc1650-paso-de-la-amada-ballcourt-built` (1650–1600 BC) already record a Soconusco village in these years.
- Tree-trunk coffin burials (1550–1300 BC). The entry sits on the page "Eastern Europe and Scandinavia, 2000–1000 B.C." (`https://www.metmuseum.org/toah/ht/03/eue`). The live page returned HTTP 429 from the Vercel security checkpoint, and the Internet Archive holds no capture of this URL. The session could not open the entry, so the candidate stays out.

An independent Claude check on 2026-11-12 reopened each archive capture and confirmed both records without corrections.

Ruling: one institutional timeline supports each record, read from an archived capture of the cited page, and each summary stays within its entry. This supplement does not establish complete regional or annual coverage. Compatible English runtime support remains pending; the gameplay catalog, legacy locales and coverage counts remain unchanged.

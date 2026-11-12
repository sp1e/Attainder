# AD 600–699: English research supplement, second pass

The [dataset](ad0600-second-pass-supplement.json) contains 7 events and 7 source records: none at importance 3, 5 at importance 2 and 2 at importance 1. It takes up the candidates that the [first pass](ad0600-supplement.md) left for a later pass.

| Date | Event | Category | Importance |
|---|---|---|---|
| 600 | Prince Shōtoku sends Japan's first official mission to China | politics | 2 |
| c. AD 600 | Slavs move west into Bohemia and Pannonia | migration | 2 |
| c. AD 600 | Tiwanaku begins a major rebuilding of its centre | culture | 1 |
| c. AD 600 | Wari is the capital of an expanding Andean state | politics | 2 |
| 616–628 | Khosrow II takes Egypt from Byzantium | war | 2 |
| 660 | Tang and Silla conquer Baekje | war | 2 |
| c. AD 672–675 | A colossal Vairocana Buddha is made at Longmen | religion | 1 |

## Evidence and chronology

Each event cites one Key Events entry of the Metropolitan Museum of Art's Heilbrunn Timeline of Art History, from the pages "Japan, 500–1000 A.D.", "Eastern Europe and Scandinavia, 500–1000 A.D.", "Central and Southern Andes, 500–1000 A.D.", "Egypt, 500–1000 A.D.", "Korea, 500–1000 A.D." and "China, 500–1000 A.D.". Each source record names the entry by its date phrase and opening words. The research session read the page text only and examined no images, object records or primary editions.

On 12 November 2026 the live Met pages answered every request, from WebFetch and from curl, with HTTP 429 and a Vercel security checkpoint. The session made no attempt to pass the checkpoint. It read each page from its Internet Archive capture of the same URL, dated between 15 February and 10 April 2026, and each source locator names the capture. The captured pages carry the Met's own titles and citation lines. An independent check should compare the entries with the live pages once the checkpoint lifts.

The Met dates four entries with "ca.", and the records keep these as approximate dates or a range with `noteEn`. The Khosrow II entry spans 616–628 and names no single year for the seizure, so the record keeps the range. For the Shōtoku mission the Japan page gives 600 for the first official mission, while the China page dates the arrival of the first Japanese envoy at the Sui court to about 607. The record follows the Japan page and states the difference in `noteEn`. The Longmen entry gives Wu Zetian's reign as 690–705, later than the commission of about 672–675, and the summary keeps both spans as the Met gives them.

## Review and withholding

Duplicate checks ran against the runtime catalog (986 events) and every English dataset in this folder, by id and by historical episode. The catalog's `ev-0593-shotoku-blir-regent` records Shōtoku's regency in 593, a separate act from the 600 mission. The catalog holds earlier Baekje records (384, 475, 538, 553) and the 668 fall of Goguryeo, but no record of the 660 conquest of Baekje. Its only Wari record, `ev-0800-wari-offrar-karl-i-pacheco`, concerns offerings at Pacheco about 800, a different site and date. No catalog or English record covers Tiwanaku, Khosrow II, the Slav migration or Longmen.

Withheld:

- The arrival of Islam in China (about 651). The China page gives one sentence naming Arab traders and diplomats as the agents. A summary could only repeat the title, so the entry is too thin under the withholding rules.
- The Tiwanaku monumental stelae (about 600), including the Bennett Stela. This entry sits beside the construction-programme entry for the same site and date, and the supplement takes one record per site and date. The entry also calls the figures' meaning a possibility.

An independent Claude check on 2026-11-12 reopened each archive capture and confirmed all seven records. It made three corrections: the Shōtoku selection note now repeats the Met's "first official Japanese mission" without claiming that diplomacy opens in 600; the Tiwanaku source claim keeps the entry's "many buildings"; and the Baekje selection note records the invasion and the monarch's capture without saying the kingdom ends.

Ruling: one institutional timeline supports each record, read from an archived capture of the cited page, and each summary stays within its entry. This supplement does not establish complete regional or annual coverage. Compatible English runtime support remains pending; the gameplay catalog, legacy locales and coverage counts remain unchanged.

# Dates with one- to three-digit years

Date: 9 November 2026. Backlog row 5.

## Intent

Two checks in `src/Game/AI/gameplay.js` read a year only when it has four digits.

1. `extractExplicitGameMasterRequestDates` finds the date an administrator names in an Exact Event request. "25 December 800" yields no date, so the check that the event keeps the requested date never runs at the AD 800 start. "15 March 3000 BC" yields AD 3000.
2. `validateNativeEconomicCalibration` reads the year of `historyAuthorityCutoff` to refuse an economic anchor after the shared-history cutoff. A cutoff of "25 December 800" yields no year, so the check is skipped.

The fix must not read "March 3, 200 soldiers" as a date.

## Rulings

1. **Module.** A new module `src/Game/AI/explicitDates.js` holds the parsing. It imports only `src/runtime/gameDates.js`. `extractExplicitGameMasterRequestDates` keeps its name and export and delegates to it.
2. **Named-month dates.** The forms "25 December 800" and "December 25, 800" accept a year of one to four digits, with an optional era word (`AD`, `CE`, `BC`, `BCE`, dotted or not) after the year, or `AD`/`CE` before it.
   - A four-digit year is read as today.
   - A one- to three-digit year counts only when an era word marks it, or when the text ends or a punctuation mark (`.`, `;`, `:`, `!`, `?`, `)`) follows it. A comma does not count, so "May 5, 20, 30 men" and "March 3, 200 soldiers" stay undated.
   - An era word counts only as a whole word: the "ce" in "once" and the "ad" in "road" mark nothing.
   - `BC` and `BCE` make the year negative in the game's signed calendar, where -218 is 218 BC.
3. **ISO dates.** `0800-12-25` is read as today. A trailing era word now counts, so `0218-03-01 BC` is 218 BC.
4. **Cutoff year.** `explicitYear(text)` returns the signed year of the cutoff.
   - It tries, in order: the whole text as a game date, the first standalone four-digit number (today's rule, made negative when `BC` follows it), an era-marked year, and the first named-month or ISO date.
   - If none of those match and the text holds exactly one number, it takes that number.
   - Every text that yields a year today yields the same year, except an era-marked BC year, which now turns negative.
5. **BC cutoffs.** The anchor check applies only when the cutoff year is 1 or later. `anchorYear` must already be 1 or later, so a BC cutoff would refuse every anchor. Today the check reads "3000 BC" as 3000 and refuses nothing that matters, so skipping it changes no outcome.
6. **No version change.** Prompts, schemas and saves stay as they are.

## Tests

`src/Game/AI/explicitDates.test.js`:

- "25 December 800" gives `0800-12-25`, and "December 25, 800." gives the same date.
- "15 March 3000 BC" gives `-3000-03-15`, and "1 March 218 B.C." gives `-0218-03-01`.
- "March 3, 200 soldiers" gives nothing, and "3 March 200 men" gives nothing.
- "December 25, 2025" and "0800-12-25" are read as today.
- `0218-03-01 BC` gives `-0218-03-01`.
- `explicitYear` gives 800 for "25 December 800", "AD 800" and "Christmas Day 800", -3000 for "3000 BC", 1914 for "28 June 1914", and null for "".

A gameplay source test checks that both call sites use the module.

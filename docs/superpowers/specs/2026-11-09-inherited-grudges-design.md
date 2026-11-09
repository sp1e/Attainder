# Grudges pass to the children

Feature idea 6 of the 2026-11-08 proposals. When a person dies, their adult children take over a weaker share of each grudge the parent held against a living person, with the cause kept: the child's opinion reasons read "Avböj bidraget (ärvt från Kelan Namar)".

## Measurement (2026-11-09, Charlemagne AD 800, no player, 200 years)

| Court, seed | Deaths | Holders of a grudge | Negative causes lost | Their sum | Adult children of the holders |
| --- | ---: | ---: | ---: | ---: | ---: |
| Karls rike, 777 | 68 | 24 | 55 | −664 | 39 |
| Karls rike, 321 | 62 | 23 | 47 | −479 | 49 |
| Kyrkostaten, 777 | 100 | 24 | 70 | −767 | 45 |
| Kyrkostaten, 321 | 61 | 25 | 86 | −968 | 41 |

A lost cause averages −11. Most point at the ruler: refused contributions (`Avböj bidraget`), unanswered demands (`Obesvarat krav`), a kinsman in prison. 6 to 22 of the causes per run point at a person who had already died.

## Rulings

1. **Where.** `killPeople` in `server/characters/index.js` is the only place a person dies. After it marks every death at the boundary, it calls `inheritGrudges(state, person, hooks)` (`server/characters/grudges.js`) for each deceased person, before the person's wealth passes on.
2. **What passes.** Every cause the deceased held with a negative amount that is still active on the date of death, towards a target who is alive after the boundary.
3. **Who inherits.** Every living adult whose `legalParentIds` names the deceased. A child does not inherit a grudge against themself.
4. **How much.** Half the amount, rounded towards zero. A half smaller than 5 in size does not pass, so a −40 grudge reaches four generations (−20, −10, −5) and a −9 grudge none.
5. **Cause and label.** The copy keeps the original `causeId`, so `citedIds` keeps protecting the memory behind it, and a child who already holds a cause with that id towards the target gets no second copy (`opinionCause` already skips it). The label is the original's base label followed by `(ärvt från <the deceased's name>)`; an earlier `(ärvt från …)` suffix is replaced, never stacked.
6. **How long.** The copy expires 10 years after the death, whatever the original's expiry.
7. **One-sided.** A grudge against a person who is dead does not pass to that person's children. Feuds between two dead persons' heirs are out of scope. A target or a child who dies at the same boundary as the holder counts as dead, so a grandparent's grudge skips a parent who dies with them.
8. **Determinism.** No random draws; new cause ids come from `state.sequence` in the order deceased → cause (relation key order) → child (id order). `rulesVersion` and `contentVersion` stay.

## Balance (same four runs, 200 years, main against this change)

| Court, seed | NPC schemes, main | NPC schemes, change | Inherited causes at year 100 | Mean adult opinion of the ruler at 200, main / change |
| --- | ---: | ---: | ---: | --- |
| Karls rike, 777 | 7 | 12 | 11 | 2.9 / 6.9 |
| Karls rike, 321 | 6 | 6 | 3 | 3.8 / −0.7 |
| Kyrkostaten, 777 | 13 | 19 | 9 | 7.6 / 7.7 |
| Kyrkostaten, 321 | 5 | 8 | 19 | 1.3 / 3.3 |

Every realm lives through 200 years in both versions. The change raises NPC schemes on three of four runs and leaves the mean opinion of the ruler between −1 and +8, so the court does not lock into lasting hostility. The Hadara hashes stay the same.

## Tests

`src/runtime/characters/grudges.test.js`:
- a −20 grudge passes as −10 to each adult child, with the cause id, the label and a 10-year expiry;
- −10 passes as −5, −9 does not; a positive or expired cause does not;
- a dead target, a child target or a minor child gets nothing;
- a second death passes −10 as −5 to the grandchildren with one `(ärvt från …)` suffix;
- a child already holding the cause id gets no copy;
- no random stream moves.

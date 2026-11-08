# The way to a nickname shows

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings. Idea 3 of `docs/Featureförslag_Attainder_2026-11-08.md`.

## Problem

`NICKNAMES` in `server/characters/nicknames.js` gives a ruler the first row the reign has earned, at the yearly step after 24 months on the throne. The conditions are counts (`executions >= 2`, `generous >= 3`, `months >= 48`), but they sit inside arrow functions, and the player sees none of them. A ruler who does nothing in particular becomes "den Stillsamme" without warning.

## Rulings

1. **Counts as data.** Each row lists its counts as `{ label, read, threshold }`. A row is earned when any count reaches its threshold. `earned` is derived from the counts, so the rule and the view cannot drift apart. The table order and every threshold stay as they are.
2. **Labels.** Swedish count labels: avrättningar, grymma gärningar, uppnådda regeringsmål, ryktbarhet, svek, generösa gärningar, sammanbrott, olaglig tronbestigning, månader på tronen. The usurper count is a yes or no (`binary`), so the view names it without "0 av 1".
3. **Reader.** `nicknameProgress(state, hooks)` reads only. It returns `null` when there is no ruler or the ruler already has a name. Otherwise `{ rulerName, adult, monthsLeft, winnerId, rows }`, where each row is `{ id, label, order, counts: [{ label, value, threshold, binary }], share, earned }`. `value` is rounded down, so a prestige of 39.6 reads 39 and never shows a threshold the rule has not met. `share` is the best count's share of its threshold, at most 1. `winnerId` is the first earned row in table order.
4. **Presentation.** `getCharacterPresentation` adds `nicknamePath`. The language model prompt picks its keys one by one and does not get it.
5. **View.** Överblick, under the reign goals: "Vägen till ett tillnamn". It lists the three rows with the largest share above 0, in table order, each with its counts ("den Givmilda · generösa gärningar 2 av 3"). A note says the name comes at the turn of the year after 24 months on the throne, and that the row listed first wins when several hold. With a winner it names the coming name. Before 24 months it says how many months remain. A child ruler gets a note that names come at adulthood.
6. **No state, no draws.** Nothing is stored. Engine hashes and `rulesVersion` stay.

## Out of scope

New nicknames, new thresholds, and the progress of other people than the ruler.

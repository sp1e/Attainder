# Phase 3 play script

This script walks you through the court: council service, reign goals, dread, family demands, stress breakdowns, hidden factions, the ultimatum, forced abdication and nicknames.

It takes about 90 minutes and uses the model for roughly 35 calls. A model year took 118 to 182 seconds in Phase 2. The game interface is Swedish, so labels appear here exactly as the game shows them.

Each step says where to click and what you should see. If a step does not match, stop and note the step number. Rolled parts state how long to wait and what to write down if nothing comes.

## Part 0: Prepare

Prepare as in Part 0 of `docs/play-scripts/phase-2.md`: `npm ci`, `node scripts/fetch-map-assets.mjs --ensure`, `npm run build`, then start the game. Decline the analytics dialog with `No, thanks`.

## Part 1: The council

1. Start a new campaign on `Normal` and open `Ämbeten & arv`.
2. Under `Rådet`, `Kansler` reads `Tjänst: stark`, `Överbefälhavare` reads `Tjänst: oviss`, and `Spionmästare` reads `Vakant`.

## Part 2: A spymaster sharpens your reading

1. Appoint `Sera Arel` spymaster with `Utse en ämbetsinnehavare`, as in Phase 2.
2. `Överbefälhavare` now reads a narrower band. Write it down.
3. Open `Personer`. `Tjänstelojalitet` shows a word or a band and no exact number, and your own representative has no such row.

## Part 3: A reign goal

1. Open `Välj från listan` > `Förvaltning och hushåll` > `Sätt ett mål för regeringen` and pick `Fyll rådet med trogna`.
2. Read `Regeringsmål` and open `Vad bär legitimiteten?` in the leader card.

## Part 4: Reward a councillor

1. Use `Belöna en rådsmedlem` on `Överbefälhavare`. Write down whether the label moved.
2. Try again. The game refuses with `Rådsmedlemmen belönades nyligen.`
3. Advance to the next year turn and read the goal's status. If service reached the bar, it reads `Uppnått`.

## Part 5: Dread

1. Imprison `Talia Namar`, who holds no office, and execute her.
2. Read `Fruktan` in the leader card, `Rädsla` on a noble, and the opinion of the Namar family.

## Part 6: Family demands

1. Advance years until `<family> kräver <target>` opens. Wait up to five years, then write down that none came.
2. Grant one with `Bevilja kravet`, and answer the next with `Avvisa kravet`.
3. Read each family's support and `Krav från familjerna` in `Rike & familjer`.

## Part 7: Stress

1. Act against your nature with `Sprida rykte` each year until `Ansvaret börjar tära` opens.
2. Continue until `<name> bryter samman` opens. Note your choice and its cost. Wait up to eight years, then write down your stress.

## Part 8: Hidden factions

1. Open `Intriger` and read `Faktioner`. Before any discovery it reads `Du känner inte till någon faktion.`
2. Note the year of `Spår av en faktion`. Wait up to ten years in total. The panel must never hint at a faction before that event.

## Part 9: The ultimatum

1. When `Faktionen kräver abdikation` opens, read `Chans att lyckas:` and open `Vad påverkar chansen?`.
2. Answer `Ge efter för adeln`. The faction reads `Har backat tills vidare`.

## Part 10: Forced abdication

1. Start a second campaign on `Svår` and advance until the ultimatum opens. An ultimatum needs a reign of 24 months and came on seven of eight test seeds within ten years on `Normal`.
2. Leave it unanswered until its date. `Adeln tvingar härskaren från tronen` appears, and the campaign keeps running.
3. `Legitimitet` reads 35, or 30 if the old ruler went to prison. `Rike & familjer` shows the new ruler.

The claimant is an adult sibling if the ruler has one. No ruler in the opening cast does, so under Arel you see the heir, Sera Arel. The sibling case appears once Mira reigns with Neri alive.

## Part 11: Nicknames

Read `Krönikan` for `<name> kallas nu <label>`, then find the same nickname after the person's name. The executions in Part 5 can earn one. Write down if none came in ten years.

## Part 12: Reload

Reload the page, open the current campaign, and check that goals, demands, known factions and nicknames are still there.

## Report back

Write down the year each system first appeared, each step that did not match, and the seed if the game shows one.

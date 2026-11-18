# A court year is not lost to a name: design

## Why

On 16 November 2026 the year was turned twice from the court shell's year line, in a copy of the Charlemagne campaign at 25 December AD 802, with the local Claude. Both years were refused after about three and a half minutes each, with nothing changed:

1. `$.events[5].impacts.unitOps[0].unitId "Army of the Anatolian Themes" does not name one existing unit.`
2. `Your events describe a wartime capture/occupation/control change (e.g. "Alfonso II Consecrates the Church of San Salvador at Oviedo as the Seat of a New Bishopric") but the payload contains ZERO impacts.regionControlOps.`

An earlier year was lost the same way to the word `sold` (`docs/development/CONTINUE-HERE.md`), and that one word was patched.

All three come from `validateGeneratedWorldChanges`. Its own contract says: "Callers set it [`strictTransfers`] on every attempt EXCEPT the last … the final answer must never be rejected into the canned fallback over a name." A campaign with a court breaks that contract: its year's validator is strict on every attempt (`Boolean(bundle.world.characterSystem) || !finalAttempt`), and a court year has no fallback, so the last answer's strict complaint ends the year. The second refusal is a language heuristic the code itself calls a nudge that "can never cost a finished turn".

## Goals

- A court year is not refused because the model's last answer names a unit or a region the map does not have, or because a sentence reads like a capture.
- The court's year stays one transaction: it is written whole or not at all.

## Non-goals

- The other strict checks of a court year (dates, the storylines, the event limit) stay as they are. No year has been seen lost to them. The war ledger was among them until it was measured (ruling 5), and the consequence check followed it (ruling 6).
- No change to a campaign without a court.
- No new retry and no longer wait.

## Rulings

1. **The world's changes follow their validator's contract in a court campaign too**: strict while a retry remains, so the model is told and corrects its own answer; repaired in place on the last answer. The repairs are the validator's own drops: an operation on a unit, a region, a marker, a report, a project or a chat that does not exist or names nobody is left out, and each is written to the receipt the model reads at the top of its next turn. No event is removed. Cost if wrong: two arguments at one call.
2. **The repairs drop operations from the events' impacts and nothing else.** The model's unit, region and control operations are applied to the world; a dropped one is simply not applied. The court's own changes (`characterOps`) are never touched by this validator, and the court's state is still written through one commit that checks its revision, so the year's transaction is as whole as before.
3. **The language heuristics run only while a retry remains**, as their own comment says. That follows from ruling 1: they live in the strict branch.
4. **A court year's last answer gets the drops and nothing added.** In any other campaign the last answer also has a narrated capture completed on the map. A court year's ledgers are still strict on the last answer (non-goal above), and a capture completed there could be the combat they cannot bind to a war, which would lose the year again by another road. So the completion is switched off (`captureGuard`) for a court year's last answer. Cost if wrong: a capture the text states and the model left off the map stays off the map that year.
5. **The war ledger follows the same rule** (added 18 November 2026). Five more years were turned from the year line: four were written (207 to 308 seconds each, 15 to 26 events), and one was refused after 178 seconds because `Bardanes Tourkos's Revolt Against Nikephoros Collapses Without a Battle at Chrysopolis` read as hard combat with fewer than two combatants. The ledger has its own repair for exactly this ("a riot and a bombing read as hard combat to the detector"): the event stays as narrative and loses its war link, and a war record that only such events established goes with it. A court year's last answer now gets that repair. Ruling 4 stands as it is: the last answer adds nothing to the map.
6. **The consequence check follows the ledger** (added 18 November 2026, from the review of ruling 5). The ledger's repair takes an event's war link away, and that link can be the event's only consequence channel; a strict consequence check after the repair would refuse the year with "has no canonical consequence at all". On a court year's last answer the check is fail-soft, as it is in every other campaign. The capture completion of ruling 4 stays off: its reason (strict ledgers) is gone, and no court year has been measured with it on. Cost if wrong: a major event without a recorded consequence stands in a year's record.

## Checks

- A source test holds the call to the contract and the two refusals above to the strict branch.
- The full suite and the build.
- A year turned from the year line with the local model, on a copy of the Charlemagne campaign: the year is written, the date moves, the record stands over the map.

## Known and left

Since ruling 6 only the dates and the storylines' own payload check are strict on a court year's last answer. Not measured: a year whose last answer needed the ledger's repair.

Across both measurements eight years were turned: three refused (a unit's name, a sentence read as a capture, a revolt read as combat), five written. Each of the three refusals now has its repair. The dates and the storylines are still strict on a court year's last answer and have refused no year in the eight.

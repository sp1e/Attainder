# The physician's prognosis and the deathbed

Feature idea 4 of the 2026-11-08 proposals. When the player's representative is likely to die within the year, the court physician says so, and a deathbed story lets the dying person settle one last thing: leave silver to the youngest child, make peace with the worst enemy, or confess a secret.

## Measurement (2026-11-09, no player, 200 years)

| Run | Deaths | From a disease | Aged 60 or more |
| --- | ---: | ---: | ---: |
| Karls rike, seed 777 | 68 | 1 | 35 |
| Karls rike, seed 321 | 62 | 0 | 39 |
| Kyrkostaten, seed 777 | 100 | 4 | 57 |
| Hadara, seed 321 | 171 | 5 | 106 |

A disease kills 0 to 5 people in 200 years, 1 to 4 months after onset. Old age kills about half of everyone. A deathbed tied to a fatal disease alone would almost never appear, so the prognosis reads the whole yearly risk of death.

## Rulings

1. **The risk.** `deathRisk(state, person)` is the chance the person dies within a year: the age risk of `annualStep` (1 from 95, 0.22 from 80, 0.12 from 70, 0.06 from 60, 0.014 from 45, else 0.002) plus `(100 − health) × 0.0005`, plus for each active condition that is not grief the `fatalRisk` that `health.js` would apply under its current care. Capped at 1. `annualStep` and `health.js` call the same two functions, so the numbers cannot drift apart.
2. **The prognosis.** `prognosis(state, person)` gives what the physician says. The skill is the `learning` of the physician on the court staff of the person's family (`staffOf`), with no physician counting as 0. `precisionFor(skill)` from `actionOdds.js` picks the precision:
   - exact: the percentage, as "14 %";
   - five: "under 5 %", "5–10 %", "10–20 %", "20–35 %" or "över 35 %";
   - three: "liten", "påtaglig" or "stor" (up to 10, up to 25, above).
3. **When the deathbed opens.** In `courtAnnualStep`, after the year's deaths: the active representative with a risk of 0.12 or more gets a `deathbed` story, unless one is open or the same person had one in the last 5 years. It is due in 6 months. Its description holds the prognosis sentence: "Läkaren bedömer risken att <namn> dör inom ett år som <band>."
4. **The choices.** Each is disabled with a Swedish reason when it cannot apply.
   - `bequest` "Testamentera silver": up to 30 of the person's own wealth goes to the youngest living legal child. Disabled without a child or with less than 1 silver.
   - `reconcile` "Försonas med <namn>": the living adult with the lowest opinion of the person, when that opinion is −20 or lower. Every active negative cause between the two, both ways, expires today, so none passes on to the children (idea 6). The enemy gets +15 towards each adult legal child, label "Försoning vid dödsbädden", for 10 years.
   - `confess` "Bekänn en hemlighet": the oldest unexposed `affair`, `heresy` or `illegitimate_child` secret that names the person as subject or, for `illegitimate_child`, as first holder (the mother). The secret is exposed and the person loses 30 stress.
   - `rest` "Låt dagarna gå": nothing.
5. **Expiry and closing.** Past due, the story resolves as `rest`. It closes with no effect when the person dies or stops being the active representative.
6. **Stops the year.** `deathbed` joins `COURT_STORY_TYPES`, so a longer advance stops on it like the other decision stories.
7. **Determinism.** No random draws; `rulesVersion` stays.
8. **Ids of its own.** The story id is `deathbed-<person>-<date>`, and its log lines (opened, expired, closed, bequest, confession) carry ids built from it. A deathbed nobody answers takes nothing from `state.sequence`, so every later person, event and memory id stays as main has it.

Out of scope: naming a guardian (regency follows the mandate episodes), bequeathing an estate, and NPC deathbeds.

## Balance (2026-11-09, no player, 200 years)

| Run | Deathbeds | People | Died within a year |
| --- | ---: | ---: | ---: |
| Karls rike, seed 777 | 4 | 4 | 1 |
| Karls rike, seed 321 | 8 | 5 | 3 |
| Kyrkostaten, seed 777 | 8 | 7 | 0 |
| Hadara, seed 321 | 7 | 7 | 0 |

Every prognosis reads "påtaglig": these courts have no physician, so the three words apply. With the story and log ids taken from `state.sequence`, Karls rike seed 321 left main after year 126, because the shifted person ids changed the order of later draws. With ids of its own, all four runs end with the same people, deaths, rulers and `rngState` as main.

## Tests

`src/runtime/characters/deathbed.test.js`: the risk formula and the illness term, the three precisions of the prognosis, opening at 0.12 and the five-year pause, each of the four choices with its refusal, expiry as rest and closing on death, and an unanswered deathbed that moves no random stream and no `state.sequence`.

# The ruler reforms the faith or founds a new one, and the priesthood splits

Date: 11 November 2026. Phase 7, moment 18 of `2026-10-31-ai-game-master-design.md` ("The player founds a new faith or reforms the old one, and the priesthood splits."). Owner mandate: continue without pause and decide by rulings.

## Problem

Each historical court seeds one faith (`court.religions`), and every person and family carries a `religionId`. A family's support for the ruler includes its faith's support (`familySupport`, `(religious support − 50) × 0.2`). The player can only fund a faith (`patronize_faith`); no command changes what anyone believes.

## Rulings

1. **Historical campaigns only.** Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`.
2. **The command.** `reform_faith` is a public command: it needs the ruler's or a regent's mandate (`requireRule`) and is reserved under a regency. It costs 60 silver and one order from the state treasury. The payload names `mode`: `reform` ("Reformera tron") or `found` ("Grunda en ny tro"). `reform` was taken by an archetype action, hence the name.
3. **When it can be done.** The ruler is alive and adult, the ruler's faith is in `state.religions`, and no faith founded in the campaign is younger than 30 years. A ruler whose faith was founded in the campaign can reform it again after 30 years.
4. **The new faith.** A new entry in `state.religions` with id `faith-<sequence>`, support 30, no leader (the yearly step names one), and `founding = { date, mode, fromId, founderId }`. Its name has no free text:
   - *reform:* "<old name> (reformerad)";
   - *found:* "<ruler's name>s lära", without the extra s when the name ends in s, x or z. A byname in parentheses is left out: "Karl (Karl den store)" founds "Karls lära".
   A name already in `state.religions` gets " II", " III" and so on up to " X", then " 11", " 12".
5. **Who follows.** The ruler's family converts: the family's `religionId` and every living member of the old faith. Every other family whose `religionId` is the old faith decides as a whole, by its head: it follows with a chance of 0.5 for a reform and 0.25 for a new faith, +0.2 when the head likes the ruler at 20 or more and −0.2 below 0, held to 0.05…0.95, rolled by `hashRoll` of the new faith's id and the family id. A family that follows converts its `religionId` and its living members of the old faith. Members of other faiths keep theirs. A family without a living head does not decide: it stays in the old faith and holds no grudge.
6. **The split.** Each following family besides the ruler's adds 10 to the new faith's support, up to 70. The old faith loses 10 support for a reform and 15 for a new faith (held at 1, since the support reader takes 0 as unset and reads 50). A leader of the old faith who converted leaves that place; the yearly step names a new one. The head of each family that stays gets an opinion cause towards the ruler: "Reformen" −10 or "Kätteri vid hovet" −20, for 20 years. The realm gains 10 prestige and loses 5 legitimacy for a reform; a new faith gives 15 prestige and costs 10 legitimacy.
7. **The record.** The court log writes "<new name> grundas" with the count of families that followed and stayed, and a public memory `faith_founded` names the ruler.
8. **No draws, no version change.** Every roll is `hashRoll`; nothing moves a random stream. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.
9. **Saves.** `founding` is optional on a religion. When present it names a valid date, a mode of `reform` or `found`, a `fromId` and a `founderId` that are strings. Anything else fails with "Sparfilens trosreform är ogiltig."
10. **Shown to the player.** The action list offers the command with the two modes and gives the reason when it is closed. The religion list shows "grundad <year>" for a founded faith.
11. **Not in scope.** Foreign realms take no notice, the priest office does not change hands by itself, and no NPC reforms a faith. Moment 19 (holy war) gives foreign realms a faith.

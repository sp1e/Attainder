# The priests call a holy war against the neighbor

Date: 11 November 2026. Phase 7, moment 19 of `2026-10-31-ai-game-master-design.md` ("The priests call a holy war against the neighbor."). Owner mandate: continue without pause and decide by rulings.

## Problem

Foreign realms (`state.foreignRealms`, foreign-realms spec) carry no faith, so nothing at court can tell a neighbor of another faith from one of the same. Moment 18 lets the ruler found or reform a faith, which leaves neighbors behind in the old one. A war needs a ready claim (`fabricate_claim`, two years of forgery); the priests have no way to ask for one.

The packages give each court one religion (`court.religions[0]`, `{ id, name, leaderId, claims }`) with a court-specific id: the Carolingian court has `latin-church`, Asturias `asturian-church`, Córdoba `congregational-mosque-unspecified`. An id alone cannot say that Asturias shares the Carolingian faith. No package field names a faith tradition.

## Rulings

1. **Historical campaigns only.** Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`.
2. **A neighbor's faith.** Each foreign realm gets `faith: { id, name, tradition }` from its court seed's first religion, with `tradition` null unless the package names one (ruling 3). A court without a religion gives `faith: null`. A save from before this change keeps realms without the field, and the engine reads a missing `faith` as null.
3. **Faith traditions come from Codex.** A court religion may carry `tradition`, a lowercase id such as `christian`, `islamic` or `buddhist`. The seed copies it onto the court's own religion in `state.religions` and onto the neighbor's `faith`. A faith founded or reformed in the campaign (moment 18) inherits the tradition of the faith it left. No shipped package names a tradition yet; the research brief asks Codex for the field. Until a package release carries it, ruling 4's second test never holds.
4. **Another faith.** A neighbor holds another faith than the ruler when either holds:
   - *heresy:* the neighbor's faith id is one the ruler's faith broke from, following `founding.fromId` back through `state.religions`;
   - *tradition:* both the ruler's faith and the neighbor's faith name a tradition, and the two differ.
   Today only heresy can hold: a Carolingian ruler who founds "Karls lära" stands against the Papal States, which keep `latin-church`.
5. **Who calls.** The priest office holder when adult, alive and of the ruler's faith; otherwise the ruler's faith's leader when adult and alive. Without either, no call comes.
6. **When.** In the yearly court step, when the realm can be ruled (`canRule`), no war runs, no holy-war call is open and none came in the last 10 years (the date of the last call is kept as `state.lastHolyWarCall`, since memory fading removes settled stories after five years), the priests call with a chance of 0.15, rolled by `hashRoll` of the plot stream state, the date and `holy`. The target is drawn among the neighbors that can be targeted (within 2,500 km, no alliance, no claim, no war, fewer than three border lands taken) and hold another faith, by `hashRoll` of the same text and `target`. The court log writes "Prästerna kräver heligt krig mot <realm>" and a court story `holy_war_call` opens for six months.
7. **The answers.**
   - *Gå i heligt krig:* needs the ruler's mandate and 60 silver in the treasury. The war starts at once as a pressed claim does (`declare_war`): the claim is ready and not exposed, the neighbor remembers "Krig om gränslandet" −30 for 20 years, and the yearly battles decide the war. The caller likes the ruler +15 ("Det heliga kriget", 20 years) and the ruler's faith gains 10 support.
   - *Avvisa prästerna:* the caller dislikes the ruler −20 ("Avvisade det heliga kriget", 20 years) and the ruler's faith loses 10 support (held at 1, as in moment 18).
   - *No answer in time* counts as a refusal.
8. **The call falls away** with no effect when the target realm is gone, allied, claimed or at war, when the player's realm is at war with anyone, when the controlled family or the actor changes, when the mandate is lost, or when the caller is dead.
9. **No draws, no version change.** Every roll is `hashRoll`; nothing moves a random stream. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.
10. **Saves.** A realm's `faith` is absent, null, or `{ id, name, tradition }` with string `id` and `name` and `tradition` a string or null. A religion's `tradition` is absent or a string. `lastHolyWarCall` is absent or a valid date, and only in a historical campaign. Anything else fails with "Sparfilens grannriken är ogiltiga.", "Sparfilens trosreform är ogiltig." or "Sparfilens heliga krig är ogiltigt." The story row validates as the other court stories do.
11. **Shown to the player.** The neighbor list shows the neighbor's faith ("Tro: <name>") and marks a neighbor of another faith ("annan tro"). The story uses the generic story card.
12. **Not in scope.** Neighbors do not call holy wars on the player, holy wars give no other reward than a claimed war, and the ruler cannot start a holy war unasked.

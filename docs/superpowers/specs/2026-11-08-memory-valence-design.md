# Memory valence in conversations

Date: 2026-11-08. Owner request: build feature ideas 1 to 9 from `docs/Featureförslag_Attainder_2026-11-08.md`; this is idea 1. Owner mandate: continue without pause and decide by rulings.

## Problem

`grounded` in `server/characters/conversation.js` accepts a `shared_memory` argument for any memory both people took part in and both know. The memory type plays no part, so a player who reminds a noble of a broken promise (`betrayal`) gets the same argument as one who recalls a gift. Gift, appointment and education memories have no rule that reads them.

## Rulings

1. **Valence table.** `MEMORY_VALENCE` sorts memory types:
   - favors: `gift`, `appointment`, `education`, `patronage`, `story_patronage`, `promise_kept`, `adoption`;
   - grievances: `betrayal`, `insult`, `dismissal`, `imprisonment`, `crime`, `scheme_discovered`, `plot`, `refuge_lost`, `story_fracture`;
   - every other type is neutral.
2. **Grievances.** A cited grievance never grounds an argument. Each distinct grievance the player cites, which both took part in and both know, gives −5 on the row `Personen minns ett agg`, at most −10.
3. **Favors.** A grounded favor adds the row `En tjänst att minnas` +5 once, beside the argument score.
4. **Neutral memories** ground the argument as before.
5. **No new draws.** The estimate stays a pure function; resolution still draws one action roll, so `rulesVersion` stays.
6. **Model prompt.** The conversation extraction prompt tells the model that a grievance counts against the player.

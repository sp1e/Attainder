# Tides of Time design: AI game master and living court

Date: 31 October 2026. Written by Claude from an interview with Simon, the owner. Status: draft for Simon's approval.

## 1. Intent

Simon wants Tides of Time to combine three things:

1. Open Historia's AI features, made smarter and more dynamic, with real power over the world.
2. The character and court play of Crusader Kings III.
3. The ruler, family and event play of Old World.

The player types "jag förgiftar min bror under festen" (I poison my brother at the feast). The game decides what happens and the world changes: a death, a succession dispute, revenge years later. The player can also fail. In Simon's words, a player must not be able to prompt anything and always get a good outcome. Rules, algorithms and the difficulty level decide, and they hand the player bad outcomes too.

Codex built the current game on the opposite rule. Its rules engine owns every character outcome, and the model may only narrate and propose. This design keeps Codex's engine as the ledger and gives the model the game master's chair.

## 2. Decisions Simon made

- The AI acts as game master. It resolves free-text actions and changes the world: people die, successions get contested, families take revenge.
- Prompt wording never guarantees success. Rules, odds and difficulty decide, and bad outcomes happen.
- An outcome depends on many parameters: the actor's skills, traits, age, health and stress, the target, their relationship, the situation and the difficulty. The balance between realism and fun draws on CK3 and Old World.
- Scope: all 29 moments in Appendix A.
- Build order: the phases in section 9.
- The AI should be "much more dynamic overall". Simon left the interpretation to Claude (section 6).
- Simon approved the action-resolution proposal in section 5: two odds, five outcome tiers, real costs, the same rules for NPCs, and odds whose precision depends on the actor's skill.
- A good argument in a conversation can change whether a character agrees, within a cap and only when it rests on something that exists in the game (section 6).
- Interactive model calls use Claude Sonnet 5.5 (section 7).
- Simon delegated the remaining design calls to Claude. Section 12 lists them for his review.

## 3. Goals, non-goals and anti-goals

**Goals**

- A player can attempt any plausible action in free text and get a fair result with visible reasons.
- NPCs pursue their own goals with the same actions and odds as the player, including against the player.
- Consequences live in the save and come back: memories, secrets, grudges and claims.
- Each phase ends in a playable build that Simon can try.

**Non-goals for now**

- Multiplayer.
- Historical accuracy beyond flavor. Hadara stays fictional.
- Parity with every CK3 or Old World mechanic. Appendix A defines the scope.
- New portrait artwork. New conditions reuse existing portrait states where they fit, for example poisoned and alive uses the ill state.

**Anti-goals.** The build has failed if any of these happen:

- The game becomes a wish machine. Wording, flattery or claims in the prompt ("he surely dies") change odds or outcomes. The one exception is a grounded argument in a conversation, capped as section 6 describes.
- Narration contradicts the ledger. A dead character speaks, silver appears from nowhere, or a character acts on a secret it cannot know.
- Simon waits so long for an action or a year that he stops playing. Section 7 sets targets.
- A few sessions use up Simon's Claude subscription allowance.
- An existing campaign breaks without a message.

## 4. Core rule: the model decides, the engine keeps the books

Every model output that touches game state passes one gate, the resolution gate. A player action runs through seven steps:

1. **Interpret.** The model maps the player's text to an action intent: an action type from the catalog, the actor, the targets, the method, and the means the player committed (silver, agents, an occasion). The model sets no odds, outcomes or resources.
2. **Validate.** The engine checks that the actor can act (alive, adult, capable, holding the needed authority), that the targets exist, and that the means exist. Does the player have 50 silver? Does the cook exist? The engine drops invalid means and shows the reason.
3. **Estimate.** The engine computes the cost and two probabilities, success and secrecy, from the action's formula (section 5). The player sees the estimate with its modifiers, then confirms or cancels. Cancelling costs nothing.
4. **Roll.** The engine rolls on a seeded stream and picks one of five outcome tiers.
5. **Narrate and propose.** The model narrates the outcome and proposes consequences. Each action type defines an effect envelope per tier: the allowed effect types and their ranges. The engine rejects anything outside the envelope.
6. **Apply and cascade.** The engine applies the effects and then runs its own rules: succession, inheritance, regency, portrait states, memories, opinions and new secrets.
7. **Record.** The engine stores the resolved result as a `character-system` event. Replay applies the stored result and never calls the model again.

The model also acts as director (section 6). It may propose NPC intents and new events, and those proposals pass the same gate, odds and envelopes.

This replaces the rule in `src/runtime/characters/CONTRACT.md` and `docs/design/integration-plan.md` that model `characterOps` never execute. Today `prepareCharacterTimeline` empties them (`src/runtime/characterWorld.js:383`). After Phase 1 they execute through the gate.

Recon found paths that let model output reach state outside the character rules. Phase 1 routes each through the gate or closes it:

- The engine accepts a model `polityChanges.dissolve` and follows it (`src/runtime/characterWorld.js:59-94`).
- The GM console apply path skips `prepareCharacterTimeline` (`src/Game/AI/gameplay.js:15430`).
- The command branch of `applyCharacterOpsToWorld` has no source check (`src/runtime/characterWorld.js:246-249`).
- `projectCharacterWorld` overwrites leader, stability, treasury and readiness after every model event (`src/runtime/characterWorld.js:166-227`). Phase 1 makes the engine the single owner of all four.

**Scope of the gate (Claude's call).** Phase 1 gates every change to character state and to the four numbers the engine owns: the ruler, legitimacy (exported as stability), the state treasury and army readiness. A year-call event that affects them, such as a war that costs silver, proposes the change inside the event's envelope, and the engine applies it. Upstream's world effects (units, regions, new polities, wars) keep their current validation in Phase 1, with one exception: the model can no longer dissolve Hadara. Phase 6 brings war and diplomacy under the catalog. The GM console stays as an editing tool. In campaigns with characters, its changes pass the gate's validation without odds.

## 5. Action resolution

### 5.1 Action catalog

Each action type is a data entry with:

- a category: intrigue, diplomacy, family, court, military, religion, economy or personal;
- who may act: age, capacity, and authority scope (personal, household or royal);
- the cost: action points, silver from a named wallet, and time;
- the duration: instant, or a scheme that runs for months;
- the skills and traits that count, with weights;
- the target's defense: skills, traits, guards and office;
- the success and secrecy formulas;
- five outcome tiers, each with an effect envelope and stress tags;
- a utility hint that NPC AI uses to choose the action.

Adding an action takes a catalog entry and, at most, new effect handlers. Today a new command needs edits in four places in `src/runtime/characters/index.js` (`:503-561`, `:652-698`, `:346-356`, `:393-429`), and a new event chain needs edits in four places in `eventChains.js`. The catalog removes that cost.

Free text and menus reach the same catalog. When an interpret call fails, the player picks the action from the menu. Advancing the year still needs the model, as it does today (`src/Game/AI/gameplay.js:13598`).

**Existing commands (Claude's call).** Phase 1 wraps every existing command as a catalog entry. Administrative commands with a fixed result, such as appoint, dismiss, tax_policy, build_estate and gift, use a certain resolution mode: no roll, today's thresholds and today's tests. Contested actions use the two rolls: intrigue, persuasion, pressing a claim, and any action an opponent resists. Free text reaches both kinds. The annual NPC AI keeps its current decisions and gains catalog actions phase by phase.

When the text fits no specific action, the model picks the generic action of the closest category, for example "intrigue against a person". A generic action uses the category's main skill and a moderate envelope. When no category fits, the game tells the player and suggests catalog actions.

### 5.2 Parameters

The odds formula sums labeled modifiers. Each modifier names its cause, so the player can read why the odds look as they do. Murder by poison as an example:

| Source | Examples |
|---|---|
| Actor | intrigue skill, traits (deceitful raises, honest and craven lower), age, stress, health |
| Target | intrigue skill as defense, paranoid trait, bodyguards, office (a ruler is harder to reach), health (a frail target dies more easily) |
| Relationship | opinion in both directions, kinship, the same household, the servants' loyalty |
| Situation | the occasion (a feast gives access), months of preparation, recruited agents (each raises success and lowers secrecy), silver spent on bribes |
| Difficulty | a campaign setting that shifts player odds and NPC aggression |

Odds stay between 5 % and 95 % for any action the engine allows. The engine refuses some actions outright, for example poisoning someone in another realm without an agent there. The builder picks the formula's shape. It must be bounded and move in one direction per modifier.

### 5.3 Two rolls and five tiers

| Tier | Success roll | Secrecy roll | Poison example |
|---|---|---|---|
| Clean success | passes | passes | The brother dies. The public memory records illness. |
| Exposed success | passes | fails | The brother dies. Some people know, and a murder secret names them as holders. |
| Quiet failure | fails | passes | The brother survives, perhaps ill. Nobody knows. |
| Exposed failure | fails | fails | The brother survives and knows or suspects the player. |
| Backfire | fails badly | either | The wrong person drinks, or an agent confesses. |

A fixed share of failed success rolls becomes a backfire, for example the lowest tenth. The builder calibrates it.

### 5.4 Showing the odds

The player sees the estimate before confirming. The actor's relevant skill sets the precision:

- high skill: exact percentages and the full list of modifiers;
- medium skill: five bands, from very low to very high;
- low skill: three bands, unlikely, uncertain and likely.

The bands always contain the true value. The builder sets the skill thresholds.

### 5.5 Schemes over time

Long actions such as murder, seduction, swaying, befriending and fabricating a claim run as schemes:

- They advance at subannual steps through the existing calendar (`getNextCharacterTransitionDate`, `src/runtime/characters/index.js:642-649`).
- Each step gives the target and the target's spymaster a discovery check.
- The player can add agents or silver while the scheme runs, or abort it.
- A discovered scheme opens an event for the target, whether NPC or player.

### 5.6 Cost and pace

Actions cost action points (four per year today, `index.js:593`), silver from the correct wallet, and stress according to the actor's traits. Story choices stay free in action points. Target pace: two to four meaningful actions per year. The interface may call action points "orders", as Old World does.

The player picks the difficulty at campaign start. The save stores it, and the interface shows it.

### 5.7 The same rules for NPCs

NPC AI chooses catalog actions by utility: personality, goals, opinion, opportunity and risk. NPC decisions run in the engine without model calls. NPC plots against the player use the same odds, and the player's defenses apply: spymaster, paranoid trait and guards.

### 5.8 Who acts (Claude's call)

The player's representative acts by default. The player can also give an order to a person who serves the representative: a council member in an office the representative controls, a member of the household the representative heads, or a recruited agent. That person can refuse, with a chance set by loyalty, opinion and personality. The contract rule that the actor derives from the campaign identity (`src/runtime/characters/CONTRACT.md:7`) still holds, because every order starts from the representative's authority. The heir's duel in moment 23 starts as an order to a household member or as an event.

## 6. What "more dynamic AI" means

This section is Claude's interpretation of Simon's request.

1. **Free-text actions return.** Today `src/Game/GameUI/main.jsx:571` hides the Actions panel when a campaign has characters, and `CharactersPanel` offers only select fields. Phase 1 adds a free-text box to the character panel that feeds the gate in section 4.
2. **Conversations with characters.** The player can talk with any character in free text. The character answers from its personality, its opinion of the player and the memories it holds. An agreement reached in conversation (a marriage pact, a promise, an alliance, a bribe) becomes a catalog action and passes the gate. A character can refuse.

   Simon decided that arguments count, with limits. When the player asks for something, the model extracts the request, the offer and the arguments. It scores an argument only when the argument rests on something the engine can check: a real offer, a shared enemy, a shared memory, a hook. The score moves the acceptance odds by at most 10 percentage points. The engine computes the rest of the odds from opinion, personality, interests, hooks and the value of the offer, then rolls. The model writes the character's reply after the roll, so a character never says yes when the roll said no. Upstream's diplomacy chat (`buildDiplomaticSystemPrompt` in `src/Game/AI/main.jsx:2950`, UI in `src/Game/GameUI/chat.jsx`) is the starting point.
3. **Generated events.** The yearly model call may write new events from the current state. Their choices map to catalog actions or to typed effects inside envelopes. The eight event chains and the eight recurring templates stay as a backbone and as examples for the model.
4. **NPC drama.** NPCs scheme against each other and against the player. The player hears rumors, and the spymaster's skill sets how reliable they are (moment 29). As director, the model may propose extra NPC intents, which pass the gate.
5. **Long memory.** The prompt gets the memories most relevant to the people involved. Today it gets the last 16 (`src/runtime/characterWorld.js:417-446`). A king who was betrayed twenty years ago remembers it (moment 27).

The advisor also gets character context. Its prompt has none today.

## 7. Model budget and wait times

**Today.** A year usually costs one model request. The character block is about 62,000 characters (about 16,000 tokens) inside a prompt of roughly 30,000 tokens. The bridge spawns the Claude CLI with `--effort medium` and a five-minute timeout (`server/localModelBridge.js:74-79`). The output schema travels as prompt text, and the client validates the JSON.

**New calls**

| Call | Trigger | Prompt | Target wait |
|---|---|---|---|
| Interpret | the player submits free text | actor, targets, a subset of the catalog, relevant memories | 20 s or less |
| Narrate | after the roll | outcome tier, envelope, the people involved | 20 s or less |
| Conversation | each message | the speaker's profile and relevant memories | 15 s or less |
| Year | "next year" | today's folded call plus generated events and director proposals | as today |

- Interactive calls use Claude Sonnet 5.5 (`claude-sonnet-5-5`) at low effort with compact prompts. Simon decided this. The year call uses the model the player selects, at medium effort. Today the bridge passes `--model` only when the player has picked one, so it needs a per-call model setting.
- If the CLI offers a schema flag, use it. Otherwise keep the schema in the prompt, validate, and allow one corrective retry, as `runJsonTask` does today.
- The interface shows a model-call counter per session. Version 1 has no hard cap.
- The Codex connection gets the same features. The wait targets apply to the Claude connection.

## 8. Character model extensions

**Today** a person has four skills, `command, stewardship, diplomacy, learning` (`src/runtime/characters/content.js:40`), eight traits, and one archetype. Secrets exist only as a private "plot" memory. Hooks, schemes, factions, a council, nicknames and foreign realms do not exist.

**Phase 1 adds what Phase 2 needs:**

- **Skills:** `intrigue` and `prowess`. Migration derives values for existing people from archetype and traits, with a fixed rule. `command` stays and covers martial skill.
- **Traits:** pairs of opposites, at least honest and deceitful, trusting and paranoid, brave and craven, calm and wrathful, generous and greedy, compassionate and cruel, diligent and lazy, content and ambitious, zealous and cynical, just and arbitrary. Add `curious` and `zealous`, which `storyDirector.js:147,152` already reads but `TRAITS` lacks. The eight existing traits keep their meaning.
- **Relationships:** friend, rival, lover and nemesis, each tied to the memory that caused it.
- **Secrets and hooks:** a secret has a type (murder, affair, illegitimate child, heresy, plot), a subject, holders and the strength of the evidence. A hook gives leverage over a person. A weak hook works once, a strong hook works repeatedly. Secrets, debts and favors create hooks. The private "plot" memory becomes a secret of type plot.
- **Crimes:** murder, kinslaying and treason. Exposure changes opinions and legitimacy and can open punishment events.
- **Minor characters:** court staff such as the cook, the guard captain, the physician, the steward and servants. The engine creates them from role templates when an action needs them, with skills and loyalty. The model can ask for a role, and only the engine creates the person.

**Later phases add** council seats and loyalty, dread, sources of legitimacy, ambitions and nicknames (Phase 3); succession laws including partition, cadet branches and illegitimate claimants (Phase 4); activities such as feasts and duels (Phase 5); foreign realms, alliances, claims and war (Phase 6); faiths and holy war (Phase 7).

## 9. Phases

Each phase ends in a playable build and a short play script Simon can follow to see the new features.

**Phase 0: Stabilize the base.**

- Close the four save-validation holes in `validateEventChains` (`src/runtime/characters/eventChains.js:280-298`) and add regression tests. `docs/development/CONTINUE-HERE.md` describes them.
- Add the event-chain tests the gate will rely on: payments and replay, an interruption partway through a year, health and chain decisions on the same date, and recovery from an interrupted multi-file save. The panel checks in both themes wait for Phase 1, which changes the panel.
- Run the full serial suite and the production build.
- Update `AGENTS.md`. Simon's current rule says Claude on his private account uses the `sp1e` GitHub account globally. Remove the Codex Main and Worker process notes.
- Branch from `origin/main`. Local `main` still points at upstream `293a3b8`.

Done when the suite and build pass, the four holes have regression tests, and the added event-chain tests pass.

**Phase 1: Foundation.** The resolution gate, the catalog, odds, tiers, envelopes, the scheme framework, the free-text box, the extensions in section 8, the interpret and narrate calls, the closed bypasses from section 4, and save migration.

Done when Simon can type an action in a new campaign, read the odds and their modifiers, confirm, and see a result that survives a reload. An old campaign loads and plays on. When the interpret call fails, the menu still offers every catalog action.

**Phase 2: Intrigue and conversation.** Moments 1 to 4, 28 and 29: murder, secrets, hooks and blackmail, imprisonment and ransom, rumors, and NPC plots against the player. Conversations with the player's own court. A minimal occasion: the player can host a feast, which costs silver and gives intrigue actions an access modifier while it lasts. Phase 5 builds full activities on it.

Done when a poisoning at a feast works from start to finish and a test campaign reaches all five tiers, and when an NPC plots against the player and the player can uncover the plot. A new campaign gives Arel no brother, so the test targets a relative who exists, such as his son-in-law. When the player names a person who does not exist, the interpret step says so.

**Phase 3: Court and power.** Moments 11 to 17: nicknames, ambitions and legitimacy, stress breakdowns, dread, family demands, factions that demand abdication, and the council.

**Phase 4: Family and succession.** Moments 5, 6 and 8 to 10: education and guardians, partition, illegitimate children with claims, cadet branches, and heirs whose traits change the strategy.

**Phase 5: Events and life.** Moments 20 to 23: feasts as activities, epidemics with choices, chains that remember decisions from ten years earlier, and duels.

**Phase 6: World, diplomacy and war.** Moments 7 and 24 to 27. Hadara is the only polity today (`src/runtime/dynastyScenario.js:39-41`), while upstream's nation simulation still runs. Claude's call: add two or three neighboring realms with ruling families and smaller courts, plus barbarian tribes. The detailed design happens at the start of the phase.

**Phase 7: Religion.** Moments 18 and 19.

## 10. Constraints

- **License.** The code is AGPL-3.0-or-later. Keep upstream notices.
- **Public repository.** No credentials, real campaign saves, private reports or machine-specific paths.
- **Language.** Documentation in English. Game text in Swedish, with å, ä and ö.
- **Determinism.** Engine randomness comes from seeded, saved streams. Replay never calls the model. Advancing whole years or split dates must give identical state, as `CONTRACT.md:8` requires today.
- **Saves.** `normalizeCharacterSystem` rejects any rules or content version other than `hadara-1.0.0` (`src/runtime/characters/index.js:296-298`). Phase 1 adds a versioned migration from 1.0 to the new rules. The existing pattern is additive `ensure*` functions.
- **Code structure.** `index.js` is 135 KB, with lines longer than 3,000 characters. New systems go in their own modules. Refactor only what the new systems touch.
- **Model transport.** Keep the CLI bridge, which uses the existing Claude Code or Codex login without API keys. Upstream's API-key providers stay available.
- **Tests.** The project uses `node --test`. New rules get their tests first.
- **Unused field.** Nothing reads `realm.prestige` (`index.js:242`). Phase 3 uses it or removes it.

## 11. Left to the builder

- Module layout and names, the shape of the odds formula, every number and the balance.
- Prompt wording and schemas.
- The layout of the action box, the odds display, the conversation view and the scheme tracker.
- How many catalog actions each phase ships beyond the moments it covers.
- Whether the year call narrates low-stakes results instead of a separate narrate call.

## 12. Claude's calls for Simon to check

1. The engine keeps the ledger. The model acts as game master through one gate with effect envelopes.
2. Prompt wording earns no modifiers in actions. Only verified means in the world count. Conversations follow Simon's capped exception.
3. Odds stay within 5–95 %, and the engine refuses actions without access.
4. Odds precision follows the actor's skill, and the bands always contain the true value.
5. NPC decisions run in the engine without model calls. The model adds drama as director through the same gate.
6. Free text and menus reach the same catalog. A failed interpret call falls back to the menu. The year still needs the model.
7. Players can converse with characters, and agreements become catalog actions.
8. The year call generates new events, and the existing templates stay.
9. Two new skills: intrigue and prowess.
10. The engine creates minor court characters on demand.
11. Old campaigns migrate and keep playing.
12. Interactive calls use low effort and compact prompts, with wait targets of 15 to 20 seconds.
13. Phase 0 runs before Phase 1.
14. Phase 6 adds two or three neighboring realms and barbarian tribes.
15. The Codex Main and Worker process ends. Claude builds each phase from a written plan, writes tests first, and reviews each task.
16. The gate covers character state and the four numbers the engine owns. Upstream world effects keep their validation until Phase 6, and the model can no longer dissolve Hadara.
17. Existing administrative commands enter the catalog without rolls and keep their thresholds and tests. Contested actions get the two rolls.
18. The representative acts. People who serve the representative can receive orders and can refuse them.
19. Phase 0 includes the event-chain tests the gate depends on.
20. Phase 2 adds a minimal feast occasion, and its test targets a relative who exists.
21. The Codex connection gets the same features. The wait targets apply to Claude.

## Appendix A: the 29 moments

Simon chose all of these. The phase number is in brackets.

**Intrigue and secrets**

1. The spymaster finds proof that the chancellor has a mistress. Expose him or use the secret to force his vote. [2]
2. A murder plot runs for months with the cook and a bodyguard as agents, until someone warns the victim. [2]
3. The player is the target. A relative wants the throne, and the player gets only clues. [2]
4. The player imprisons a rival. His family demands ransom or prepares a revolt. [2]

**Family and succession**

5. The heir is cruel and lazy. The player chooses a tutor and hopes education corrects it. [4]
6. The ruler dies, and the realm splits among three sons who start fighting. [4]
7. A marriage to the neighbor's princess brings an ally whose father drags the player into his war. [6]
8. An illegitimate son grows up and claims the throne. [4]
9. The family grows until a branch breaks away as rivals. [4]
10. A new ruler with different traits takes over, and the strategy has to change. [4]

**The ruler and power**

11. The ruler earns a nickname such as "the Great" or "the Cruel". [3]
12. The ruler sets goals for the reign, and each goal met adds legitimacy. [3]
13. Decisions against the ruler's nature build stress until a breakdown. [3]
14. The ruler governs by fear. Executions cow the nobles and make enemies. [3]

**Nobles, families and council**

15. The great families want cities and offices. Favoring one angers the others. [3]
16. Discontented nobles form a faction and demand abdication in favor of the ruler's brother. [3]
17. The player appoints chancellor, general and spymaster, and their loyalty decides how well they serve. [3]

**Religion**

18. The player founds a new faith or reforms the old one, and the priesthood splits. [7]
19. The priests call a holy war against the neighbor. [7]

**Events and daily life**

20. A feast where someone seduces, someone quarrels and someone is poisoned. [5]
21. Plague reaches the capital: quarantine, prayer or flight. [5]
22. An event chain remembers a choice from ten years earlier. [5]
23. The heir challenges a rival to a duel. [5]

**World and war**

24. Barbarian tribes on the border can be bribed, hired or crushed. [6]
25. A wonder gives prestige for generations. [6]
26. The player fabricates a claim on a neighbor's province and goes to war for it. [6]

**Only possible with an AI game master**

27. The player negotiates in free text with a king who remembers a betrayal from twenty years ago. [6]
28. The player invents a plan, such as spreading a rumor that the heir is illegitimate, and the game works out the odds. [2]
29. NPCs plot against each other, and the player learns of it through rumors. [2]

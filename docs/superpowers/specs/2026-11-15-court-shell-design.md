# The court over the map: an interface shell

Design for bringing the interface draft's shell into the game. The draft is `docs/design/ui-draft/` on the branch `design/ui-draft`, with its design system in `DESIGN.md` there. The map half of the draft is done (`2026-11-13-living-map-design.md`, slices 1 to 6).

## Why

The owner named four faults of the interface: the map and the court do not hang together, it is unclear what he should do, there is too much text and too many numbers, and time is not felt. Today the court is one panel that covers the map. A player sees the land or the court, never both, and the panel opens on an overview, not on what waits for him.

The draft answers with one view: the court as a line of medallions over the map, what needs the player on the left, the selected person on the right, the year along the bottom. The owner approved that direction and asked for it in the game.

## Goals

- The court is on screen while the map is: who is at court, in what order they stand to the throne, and what waits for the player.
- Each slice ships alone, leaves the game playable, and removes nothing a player needs before its replacement is there.
- Desktop first: the owner plays at 2560 by 1440. A phone keeps the panel it has.

## Non-goals

- No change to the rules, the engine's state, saves or the model's prompts.
- No new art. The medallions use the portraits the court already shows.
- The upstream chrome (menu, title, date widget, search, chat) stays until slice 4 replaces it.

## The slices

1. **The court over the map** (this slice): the thread of medallions, the list of what needs the player, and the realm's six figures. Each is a way into the panel: a press opens it at the person, at the decisions or at the overview.
2. **The person card**: a selected medallion opens a card on the right with the person's skills, opinion and goal, and a way into the panel at that person.
3. **Answer and act in place**: an open matter unfolds in the list with its choices, costs and deadline, and is answered there; the card offers the actions the panel offers for its person.
4. **The year**: the bottom year line with the deadlines, the next-year button and the year turn, and a top bar in place of the upstream chrome.
5. **The areas**: people, families, offices, intrigue and the chronicle as lists in the left panel, and the period accent.
6. **The panel retires**: the conversation, the free-text action, the envoys, the schemes' forms and the general actions come out of the modal panel, and the panel goes.

## Slice 1: the court over the map

Rulings, each with what it costs if wrong:

1. **The thread is the ruling house in the order of succession, then the court houses.** The ruler first, then the engine's own candidates in their order, then the rest of the house by age; after a gap, the people of the other houses at court. The dead are not on it. In family mode the house is the family the player follows. Cost if wrong: one function.
2. **A medallion carries a name, a role and a count.** The role is the ruler's office, "Arvinge" for the lawful heir, "Fånge" for a prisoner, otherwise the office the person holds. The count is the open matters the person is part of, as the one who acts or the one acted on. Cost if wrong: one function.
3. **"Kräver dig" lists the open matters**, the nearest deadline first, each with its title, its deadline and the faces of its people. With nothing open it says so. Cost if wrong: one component.
4. **The six figures are the panel's**: treasury, annual revenue, actions left, legitimacy, prestige and military readiness, with the panel's own labels. They say nothing the panel does not. Why each stands where it does comes in a later slice.
5. **Everything in this slice opens the panel.** A medallion opens it at that person, a matter at the decisions, a figure at the overview. The event `oh:open-characters` carries where to open; without a place the panel opens as before. Cost if wrong: one handler.
6. **The shell reads the court once per revision**, through the reader the seat medallions use, so the two share one read.
7. **The shell is drawn on a desktop when the campaign has a court**, the menu is closed and the panel is closed. The "Rike & familjer" button stays where it is.
8. **The look is the draft's**: ink panels, vellum text, the house's gold for the ruler, minium for a count, EB Garamond and Cinzel, which the game ships. Six new strings ("Kräver dig", "Hovhusen", "Arvinge", "Inget kräver dig just nu." and a count's name, "{{count}} ärende" and "{{count}} ärenden"), each with its English. No surface is a gradient, which is a rule of the house.

## Slice 2: the person card

Rulings, each with what it costs if wrong:

9. **A medallion selects; it no longer opens the panel.** A press opens the person's card, a second press on the same medallion closes it, and Escape closes it. The card's own button opens the panel at the person. Cost if wrong: one handler.
10. **The card shows what the panel's people tab shows of the person**: name, age, house and role; where the person comes from, the archetype and the traits; the six skills; the opinion of the player's representative with its reasons; the stress; the goal. The labels are the panel's.
11. **The card does not act in this slice.** Talking, giving and appointing run inside the panel's own views, with their odds and their confirmation. They come out of the panel together with the answers, in slice 3.
12. **The card stands on the right under the band**, opposite "Kräver dig", so the land between them stays in view.

## Slice 3: answer and act in place

Since slice 2 the shell shows what waits and who is at court, and every answer still needs the panel. This slice brings the answers and the actions that name a person out of it.

Rulings, each with what it costs if wrong:

13. **A matter unfolds where it stands.** A press on a matter in "Kräver dig" opens it in the list: what it is about, its background, what happens when the deadline passes, and its choices. A choice shows what it does, who carries it out, its cost, its stress when it has any, why it cannot be chosen, and its chance when the engine gives one. One matter is open at a time; a second press closes it. Cost if wrong: one component.
14. **A press on a choice answers**, with the panel's own command (`resolve_story`, sent with the revision the list was read at). One press, as in the panel. While an answer is written, every choice and every action of the shell is locked. Cost if wrong: a confirmation step in one component.
15. **The list says what came of it.** After an answer the list carries the panel's own sentence (the choice, and the event that followed) until the player turns to something else, and the matter leaves the list when the court is read again. A refusal stands under the matter in the engine's words.
16. **The card offers the panel's actions that name its person.** An action is on the card when one of its fields lists the person (a prisoner through the prisoner's entry) and it can be done now. The person's field is filled in; the action's other fields are chosen on the card, without the person among them. The actions that name nobody (a feast, a wonder, the taxes) stay in the panel, behind "Ärenden och handlingar" under the list. Cost if wrong: one function.
17. **A conversation stays in the panel in this slice.** It is an exchange of several turns with model calls and its own state. The card's "Samtala" opens the panel at the person with the conversation open. It moves with the areas, in slice 5.
18. **The shell says less than the panel, never more.** It leaves out a chain's earlier steps, the earlier memory and a stress of nothing.
19. **Escape closes what focus is in**, the open matter or the card; with focus in neither, the card first.

## Slice 4: the year and the top bar

Since slice 3 the player answers and acts over the map, and the game's own move, the year, still needs the panel. Nothing over the map says what the year ahead holds.

Rulings, each with what it costs if wrong:

20. **A year line stands along the bottom of the map.** It is the twelve months ahead of the game's date, with a mark for each month and a tick at each open matter's deadline. A tick names its matter, or says how many when several fall on one day; a deadline within three months is in minium. A press on a tick opens its matter in "Kräver dig". Matters due after the twelve months are not on the line. Cost if wrong: one component.
21. **The year turns from the line.** "Nästa år med modellen" is the panel's own move (`advanceCharacterYearWithModel`), with the panel's label, since it calls the model and takes minutes. While the year is written the line says so and every choice and action of the shell is locked; the selection stays free, so the player can read cards meanwhile.
22. **The year's record stands over the map** when the year is written: the panel's heading ("Årets händelser", or "Händelser fram till beslutet" when time stopped), the reason time stopped, and each event with its date and title; an event's text unfolds on a press. "Visa senaste turens händelser" reads the last saved turn the same way, without letting time pass. Cost if wrong: one component.
23. **A year turn outlives the shell.** Its state is kept beside the shell, with the campaign it belongs to: the player may open the panel while the model writes, and the record is there when the shell is drawn again.
24. **The seasons do not sweep at the year turn in this slice.** Every released start opens at midwinter and a year turn ends a year later, so the snow line is the same before and after.
25. **A court bar replaces the session pill and "Exit Game"** in a campaign with a court, on a desktop: the realm's name (the family's in family mode), the date, the mode, "Rike & familjer" and "Huvudmeny". The standalone "Rike & familjer" button goes into the bar, and the thread starts at the left edge.
26. **The date widget stays.** The upstream widget at the top right carries the world's timeline, the shorter jumps, undo and auto-jump. Taking it apart is its own slice: its parts move when the areas do. Cost if wrong: the date is shown twice until then.
27. **A phone keeps the upstream chrome.** The shell is not drawn there (ruling 7).

## Slice 5: the areas and the period accent

Since slice 4 the player answers, acts and turns the year over the map. To see who is at court beyond the thread, how the houses stand, who holds which office, what the player's side knows, or what has happened, the player still opens the modal panel, and the map is gone behind it.

Rulings, each with what it costs if wrong:

28. **The slice is cut in two.** The list of slices gave slice 5 the areas, the panel's retirement and the period accent. The panel also holds what no list can: the conversation, the free-text action with its odds, the envoys, the schemes' forms, the general actions, the chronicle's history, the model's connection. Those come out in slice 6, and the panel goes then. This slice brings out what is read. Cost if wrong: one more slice than the list said.
29. **The left panel has six areas**: "Kräver dig", "Personer", "Familjer", "Ämbeten & arv", "Intriger" and "Krönikan", the panel's own names, chosen at the head of the panel. "Kräver dig" carries the count of open matters. The area is kept with its campaign while the shell is not drawn. A tick of the year line leads to "Kräver dig".
30. **"Personer" is everyone alive at court**, in the thread's order: the face, the name, the house and age, and the opinion of the player's representative. A press selects the person, as a medallion does.
31. **"Familjer" is the houses by support**, the strongest support first: the name, the head, the support, the common treasury and the influence, the panel's own figures. The player's house is marked. A press on a head who is at court selects the person.
32. **"Ämbeten & arv" is the line of succession and the offices**: the lawful heir and the candidates after, then each office with its holder; a vacant office says so in italic. A press on a person selects.
33. **"Intriger" is what the player's side knows and holds**: the running schemes with their targets and the day they are settled, the prisoners, the hooks, the known secrets and the rumours, under the panel's own headings. An empty kind is left out; with nothing at all the area says so. The forms (abort, release, press) stay in the panel in this slice.
34. **"Krönikan" is the year record**, the latest first, under a heading for each year: the date and the title, and the text on a press. It is the log the panel shows, not the memories.
35. **Each area has one button into the panel** at its own tab, for what the list leaves out.
36. **The period accent follows the start.** The heads of the shell's panels (the list, the record and the card), the rule under them and the ring around the selected medallion take the start's accent: Carolingian purple for the year 800 (and for any start without its own), Nile green for Egypt 3000 BC, Angevin red for 1200, turquoise for 1500. Ink, vellum, minium and gold are the same in every start (DESIGN.md, "The Period Accent Rule").

## Checks

- Unit tests for the thread, the matters, the counts and the figures.
- Source tests for the wiring, and the three text checks (`build-native-catalog --check`, `check-native-pack`, the engine sweep).
- The full suite and the build.
- A browser run on the Charlemagne campaign: the thread's order against the panel's succession, the counts against the open decisions, a press on each kind, Swedish and English.

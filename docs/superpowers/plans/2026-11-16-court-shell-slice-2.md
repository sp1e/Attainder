# Court shell, slice 2: implementation plan

**Goal:** A press on a medallion of the thread opens that person's card on the right of the map: who the person is, what the person can do, and how the person stands to the player.

**Spec:** `docs/superpowers/specs/2026-11-15-court-shell-design.md`, "Slice 2: the person card".

**Architecture:** `courtShell.js` gains one pure function that turns the court's presentation and a person's id into the card's content. `CourtShell.jsx` keeps which person is selected; a new component draws the card. Nothing is read that slice 1 does not already read.

## Global constraints

- The card shows what the panel's people tab shows of the person and says nothing else. Its labels are the panel's own Swedish strings where the panel has them.
- The card does not act. One button opens the panel at the person; acting from the shell comes with slice 3, which brings the commands out of the panel.
- A medallion is a toggle: a press selects the person, a second press on the same medallion closes the card. Escape closes it.
- New Swedish text goes through `build-native-catalog` and `check-native-pack`.

## Task 1: the card's content

**Files:** `src/Game/Characters/courtShell.js`, `courtShell.test.js`.

`cardOf(view, personId): Card | null`, `Card = { person, role, ruler, heir, held, tags: string[], skills: Array<{ key, label, value }>, opinion, opinionReasons: Array<{ label, value }>, stress, goalLabel }`.

- `tags`: the origin label when the person has one, the archetype label, then the trait labels.
- `skills`: command, stewardship, diplomacy, learning, intrigue, prowess, in that order, with the panel's labels (`Befäl`, `Förvaltning`, `Diplomati`, `Lärdom`, `Intrig`, `Kampförmåga`); a skill the person lacks is left out.
- `null` for an id that is not a living person of the court.

Tests: the content for an heir; the tags' order; the skills' order and labels; a missing skill; an unknown id and a dead person give `null`; the role is the thread's.

## Task 2: the card

**Files:** create `src/Game/Characters/CourtPersonCard.jsx`; `CourtShell.jsx`, `courtShell.css`.

- `CourtShell` keeps `selectedId`. A medallion's press toggles it and the medallion carries `aria-pressed`. A person who leaves the court (the view changes) closes the card.
- `CourtPersonCard({ card, updates, onClose })`: the head (portrait, name, age, house, role), the tags, the six skills, the opinion with its reasons, the stress, the goal, and two buttons: "Lär känna" opens the panel at the person, "Stäng" closes the card.
- The card stands on the right, under the band, opposite "Kräver dig".

Source tests in `courtShell.test.js`.

## Task 3: evidence

Targeted tests, the text checks, the build, the full suite alone, and a browser run on the Charlemagne campaign: a press on the heir, the card's content against the panel's people tab, a second press, Escape, the button into the panel, a narrow window.

## Review focus

- The card's numbers against the panel's for the same person.
- The selected person dies or leaves the court while the card is open.
- Keyboard: the medallion's pressed state, focus when the card opens and closes, Escape with the panel closed.
- A window where the card and "Kräver dig" would meet.

## Review outcome

An independent review of the first build found no fault that breaks the game, and these, fixed in the same change:

- Closing the card, by its button or by Escape, removed the element that had focus. Focus now returns to the person's medallion.
- Escape in the search box closed the card as well. Escape in a text field is now the field's.
- The advisor's drawer opens over the right edge and covered the card. The card steps aside while the drawer is open.
- The card was forgotten whenever the shell was not drawn, so pressing "Lär känna" and closing the panel lost it. The selection is kept with its campaign.
- Two tags or two reasons that read the same shared a key; a reason without a number showed a dash; a person named "(genererad)" got the origin label the name already gives.

---
name: Attainder interface draft
description: The court as a line of medallions over a living map. A draft the game does not use yet.
colors:
  ink: "#14100c"
  ink-2: "#1f1913"
  ink-3: "#2c241b"
  rule: "#4a3f31"
  vellum: "#efe6d2"
  vellum-2: "#c4b79c"
  vellum-3: "#9a8d75"
  minium: "#e0573a"
  minium-ink: "#1a0a05"
  minium-pale: "#ffd9cc"
  minium-deep: "#3c0e06"
  verdigris: "#58a58c"
  accent: "#5a2449"
  accent-2: "#7c3765"
  metal: "#d4ac3a"
  metal-ink: "#1a1307"
  realm: "#d7a43a"
  egypt-accent: "#0f5a63"
  egypt-accent-2: "#1b7f86"
  egypt-metal: "#e0b548"
  egypt-realm: "#d9a441"
  angevin-accent: "#7a1e25"
  angevin-accent-2: "#a2303a"
  angevin-metal: "#d9b14a"
  angevin-realm: "#c23b3b"
  aztec-accent: "#0d6b62"
  aztec-accent-2: "#159182"
  aztec-metal: "#e3a13a"
  aztec-realm: "#2aa198"
  own-land-light: "#fff3cf"
  map-ground: "#0a2233"
  sea: "#17566a"
  sea-shallows: "#6cc4b8"
  sea-shore: "#d9ecd9"
  border-ink: "#1b130c"
typography:
  display:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1
  headline:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "1.6rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.005em"
  title:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "1.12rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "lining-nums tabular-nums"
  fine:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "0.86rem"
    fontWeight: 400
    lineHeight: 1.35
  figure:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.15
  label:
    fontFamily: "Cinzel, EB Garamond, serif"
    fontSize: "0.74rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.12em"
  label-action:
    fontFamily: "Cinzel, EB Garamond, serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  land-name:
    fontFamily: "Cinzel, EB Garamond, serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.34em"
rounded:
  control: "2px"
  badge: "0.6rem"
  medallion: "50%"
spacing:
  tight: "0.3rem"
  list: "0.5rem"
  section: "0.9rem"
  edge: "1rem"
  bar-height: "3.4rem"
  year-height: "4.1rem"
  needs-width: "23rem"
  card-width: "20.5rem"
components:
  button:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.vellum}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.45rem 0.9rem"
  button-hover:
    backgroundColor: "{colors.ink-3}"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.vellum-3}"
  button-primary:
    backgroundColor: "{colors.metal}"
    textColor: "{colors.metal-ink}"
    typography: "{typography.label-action}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1.4rem"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.vellum-2}"
    rounded: "{rounded.control}"
    padding: "0.45rem 0.9rem"
  button-quiet-hover:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.vellum}"
  button-danger:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.minium-pale}"
    rounded: "{rounded.control}"
    padding: "0.45rem 0.9rem"
  button-danger-hover:
    backgroundColor: "{colors.minium-deep}"
  choice:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.vellum}"
    rounded: "{rounded.control}"
    padding: "0.45rem 0.7rem"
  matter:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.vellum}"
    typography: "{typography.title}"
    padding: "0.55rem 0.8rem"
  matter-open:
    backgroundColor: "{colors.ink-3}"
  panel-head:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.vellum}"
    typography: "{typography.display}"
    padding: "0.9rem 1.1rem 0.8rem"
  medallion:
    backgroundColor: "{colors.ink-3}"
    rounded: "{rounded.medallion}"
    size: "3.5rem"
  medallion-ruler:
    backgroundColor: "{colors.ink-3}"
    rounded: "{rounded.medallion}"
    size: "4.6rem"
  count-badge:
    backgroundColor: "{colors.minium}"
    textColor: "{colors.minium-ink}"
    rounded: "{rounded.badge}"
    height: "1.15rem"
  input:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.vellum}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.65rem"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.vellum-2}"
    padding: "0.5rem 0.75rem"
  tab-current:
    textColor: "{colors.vellum}"
  tag:
    textColor: "{colors.vellum-2}"
    padding: "0.1rem 0.45rem"
---

# Design System: Attainder interface draft

## Overview

**Creative North Star: "The Genealogical Roll"**

This system records a design draft of Attainder's play screen under `docs/design/ui-draft`. The owner has reacted to the draft. The game does not use it yet, and the interface under `src/Game` is an older look that this file does not describe.

The court is drawn as a lineage on the land it rules. A satellite map with relief fills the screen. Over it lie a top bar, a thread of portrait medallions in the order of succession, a panel at the left edge for what needs the player, a panel at the right edge for the selected person or realm, and a strip along the bottom for the six areas and the months ahead. The land between the panels stays visible.

The base is the same for every start: oak-gall ink panels, vellum text, minium for what is urgent and verdigris for what is well. Each start adds a period accent and its own gold. The faces are the game's own, EB Garamond and Cinzel, served from the draft's folder.

**Key Characteristics:**

- One view: map, court, open matters, selection and the year ahead are on screen together.
- Ink panels at the edges, square, with 1px rules. People are round.
- Gold marks the crown, the heir's line and the one primary action.
- Small Cinzel capitals label sections; EB Garamond carries names, text and figures.
- The map is MapLibre GL with Esri imagery, elevation relief, a sea drawn from Natural Earth's land, and a snow line that follows the season.
- Desktop only. The root size scales with the viewport width, so the layout keeps its proportions from a laptop to the owner's 2560×1440 screen.

## Colors

A dark ink ground with warm vellum text, two signal colours, and one accent pair and one gold per start.

### Primary

- **Gold leaf** (`metal`): the ruler's medallion ring, the heir's ring and the solid line that leads to the heir, the role label of the crown, the court's map sign, and the primary button. It also shows where the player's hand is: the focus outline, the current tab's underline, a choice's border on hover, the input's border on focus, the first place in the order of succession, and the month marker during a year turn.
- **Gold-leaf ink** (`metal-ink`): text on gold.

### Secondary

- **Period accent** (`accent`, `accent-2`): the heads of the two side panels, the 1px rule under each head, and the 3px ring around the selected medallion. The default is Carolingian purple vellum on `:root`. Three more pairs sit under `[data-epoch]`: Egyptian faience (`egypt-accent`), Angevin red (`angevin-accent`) and Aztec turquoise (`aztec-accent`). Each start also sets its own gold (`egypt-metal`, `angevin-metal`, `aztec-metal`).
- **Realm dye** (`realm` and the three epoch variants): declared per start for the player's realm on the map. `styles.css` declares it; `app.js` reads it and hands it to the map.

### Tertiary

- **Minium** (`minium`): what is urgent or bad. A deadline that is near, the count badges, a vacant office, a falling figure, a held person's role, the stress meter, the raid marker, the danger button's border.
- **Minium ink, pale and deep** (`minium-ink`, `minium-pale`, `minium-deep`): text on a minium badge, text on a raid marker or danger button, and the dark red ground behind them. These three are literals in the stylesheet with no custom property.
- **Verdigris** (`verdigris`): what is well. A settled matter and a positive opinion.

### Neutral

- **Oak-gall ink** (`ink`, `ink-2`, `ink-3`): `ink` is the panel ground at 95–97 % opacity over the map, and the ground of choices, inputs and skill cells. `ink-2` is the ground of buttons, matter cards and popovers. `ink-3` is hover, the open matter, the selected row and the meter track.
- **Rule** (`rule`): every 1px border and divider, and a spent order pip.
- **Vellum** (`vellum`, `vellum-2`, `vellum-3`): `vellum` is primary text. `vellum-2` is secondary text and labels. `vellum-3` is the faintest text (month names, the generated mark, placeholders), medallion rings and the dashed line of the thread.
- **Own-land light** (`own-land-light`): the player's realm name on the map and the hover wash over a neighbour's land.
- **Map ground and sea** (`map-ground`, `sea`, `sea-shallows`, `sea-shore`, `border-ink`): the page and map background, the sea fill, the blurred band of shallows inside the coast, the shoreline, and the dark edge of every realm border.

### Named Rules

**The Gold Leaf Rule.** Gold marks the crown, the succession and the one primary action, and it shows where the player's hand is. It never fills a panel or a card.

**The Two Signals Rule.** Minium means urgent or bad and verdigris means well. Neither is used for decoration.

**The Period Accent Rule.** The start's period changes the panel heads, the selection ring, the gold and the player's realm dye. Ink, vellum, minium and verdigris are the same in every start.

## Typography

**Display Font:** EB Garamond (with Georgia, serif)
**Body Font:** EB Garamond (with Georgia, serif)
**Label Font:** Cinzel (with EB Garamond, serif)

**Character:** One old-style serif does almost all the work, at weight 400 for text and 600 for names, titles and figures. Cinzel appears small and letterspaced, as inscription. Both are self-hosted variable woff2 files with a Latin and a Latin Extended subset; EB Garamond also ships a 400 italic.

The root size is `clamp(14px, 0.7vw, 20px)`, so every rem below scales with the viewport width. At 2560 px wide, 1rem is 17.92 px.

### Hierarchy

- **Display** (600, 2rem, line-height 1): the title in the head of the left panel.
- **Headline** (600, 1.6rem, line-height 1): the realm's name in the bar. The selected person's name in the card head is 1.55rem/1.1 and the notice title 1.5rem/1.1. An open matter's title is 1.4rem.
- **Title** (600, 1.12rem, line-height 1.2): a matter's title in the list. A choice's name is 1.05rem at the same weight.
- **Body** (400, 1.0625rem, line-height 1.4): running text and rows, with lining tabular numerals everywhere. Text blocks are capped at 38ch in a matter, 42–44ch in fine print and the chronicle, 60ch in the notice.
- **Fine** (400, 0.86rem, line-height 1.35, `vellum-2`): explanations, the description under a choice, small facts.
- **Figure** (600, 1.15rem, line-height 1.15): the six numbers in the bar, each under a 0.8rem caption. Skill cells use 1.3rem.
- **Label** (Cinzel 600, 0.74rem, letter-spacing 0.12em, `vellum-2`): section headings inside panels, cards and popovers, and the caption on the thread.
- **Action label** (Cinzel 700, 1.05rem, letter-spacing 0.06em): the primary button only.
- **Land name** (Cinzel 700, 1rem, letter-spacing 0.34em, uppercase): realm names on the map. `map.js` scales them with the zoom and fades them out near the ground.

### Named Rules

**The Inscription Rule.** Cinzel is for small labels, the primary action and names on the land. Names of people, titles, text and figures are EB Garamond.

**The Italic Is A Caveat Rule.** Italic marks what is uncertain or absent: the generated mark under a medallion, a vacant office, a choice's reason for being unavailable, a placeholder, a border people's name on the map.

## Layout

Every part is absolutely placed over a map that fills the viewport. The page does not scroll; the two panel bodies scroll inside themselves with a thin scrollbar in the rule colour.

- **Bar:** top, 3.4rem high, 1rem side padding, 1.25rem between items, a 1px rule beneath. Menu, realm name and date at the left; six figures 1.6rem apart, undo and the primary button at the right.
- **Scrim:** a 14rem gradient of ink from 97 % opacity at the top to none, under the bar and thread, so the thread reads against the land.
- **Thread:** starts at 3.9rem from the top, 1rem from each side.
- **Left panel:** 23rem wide, from 11.9rem below the top to 5.1rem above the bottom, 1rem from the edge.
- **Right panel:** 20.5rem wide, same vertical extent, 1rem from the edge.
- **Year strip:** bottom, 4.1rem high, with the area tabs at the left, the twelve months in equal columns in the middle (at least 20rem), and the latest chronicle entry at the right.
- **Camera:** `map.js` pads the map camera by 22rem left, 19rem right, 9rem top and 3rem bottom, so the land centres between the panels. The home view is zoom 4.08, pitch 46, bearing −6.

Spacing inside panels uses four steps: 0.3rem between tight items, 0.5rem between list items and as panel padding, 0.9rem between sections, 1rem at the edges.

There are no breakpoints. The draft is desktop only and scales through the root size.

## Elevation & Depth

Depth has two layers: the land, and ink panels above it. The map supplies its own depth through terrain (exaggeration 7), hillshade lit from 315° and a tilted camera. Panels sit above it with a soft, wide, black shadow and a 1px rule. Inside a panel everything is flat; `ink`, `ink-2` and `ink-3` separate surfaces by tone.

### Shadow Vocabulary

- **Panel** (`box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45)`): the two side panels.
- **Popover** (`box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55)`): the reasons popover under a figure.
- **Notice** (`box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6)`): the notice after a year turn.
- **Medallion** (`box-shadow: 0 3px 10px rgba(0, 0, 0, 0.55)`): portraits on the thread.
- **Selection ring** (`box-shadow: 0 0 0 3px var(--accent-2), 0 3px 10px rgba(0, 0, 0, 0.55)`): the selected medallion.
- **Lettering on the land** (`text-shadow: 0 1px 2px #000, 0 0 6px #000`): place names, seat labels and border peoples. Realm names use `0 1px 2px rgba(0, 0, 0, 0.9), 0 0 14px rgba(0, 0, 0, 0.75)`. Map signs use `drop-shadow(0 2px 3px rgba(0, 0, 0, 0.8))`.

### Named Rules

**The Lettering On The Land Rule.** Text on the map has a dark text shadow and no box. The one boxed label is a raid, which is urgent.

## Shapes

People are round and everything else is square. Portraits are circles with a 1–3px ring (50% radius). Panels, matter cards, tags, skill cells, popovers and the notice have no radius. Buttons, choices and the text input soften by 2px. Count badges are pills (radius half their height: 0.6rem on the thread, 0.7rem on the map, 0.5rem in a tab).

Borders are 1px in the rule colour. A dashed border means not in force: a settled matter's card, a held person's ring. The thread's lines carry meaning: dashed 2px `vellum-3` between kin, solid 2px gold to the heir, dotted between the house and the court houses.

Small squares are signs. A 0.55rem square is an order pip. A square turned 45° is a border people on the map (0.5rem) and the row sign in lists (0.6rem), drawn with a 1.5px line.

Map signs are inline SVG on a 24-unit grid with one stroke weight (1.5), ink fill and a vellum line for a seat, a gold line for the court.

## Components

### Buttons

Plain and quiet; one is gold.

- **Shape:** 2px radius, 1px border.
- **Default:** `ink-2` ground, rule border, body type, padding 0.45rem 0.9rem. Hover: `ink-3` ground and a `vellum-3` border over 0.2s. Disabled: transparent ground, `vellum-3` text.
- **Primary:** gold ground and border, gold-leaf ink text in the action label style, padding 0.75rem 1.4rem. Hover brightens by 8 %. One per view: the year turn.
- **Quiet:** no border or ground, `vellum-2` text; hover gives `vellum` text on `ink-2`. Used for the menu and undo.
- **Danger:** minium border, pale minium text; hover fills with deep minium.
- **Focus:** every focusable element takes a 2px gold outline at 2px offset.

### Matter cards and choices

- **Matter:** a 1px rule border on `ink-2`, no radius. One or two overlapping 2.1rem portraits at the left, the title, and the deadline beneath in 0.88rem `vellum-2`. A near deadline is minium at weight 600.
- **Open:** `ink-3` ground, `vellum-3` border, the title at 1.4rem, a paragraph in `vellum-2`, then the choices.
- **Settled:** transparent ground, dashed border, title at weight 400 in `vellum-2`, the outcome in verdigris. A lapsed deadline is `vellum-3`.
- **Choice:** a full-width button on `ink` with a rule border and 2px radius, padding 0.45rem 0.7rem. Name at 1.05rem/600, description at 0.86rem in `vellum-2`, cost at 0.82rem/600. Hover: gold border and a 2px move to the right. Disabled: `vellum-3` text, and the reason in italic.

### Panels

- **Head:** period accent ground with a 1px `accent-2` rule beneath. The left panel's head holds the display title and a count; the right panel's head holds a 4.4rem portrait with a 2px gold ring, the name and one line of facts.
- **Body:** `ink` at 97 % opacity, 1px rule border, the panel shadow.
- **Section heading:** the label style with a 1px rule beneath.
- **Tags:** 0.8rem `vellum-2` text in a 1px rule box, padding 0.1rem 0.45rem. The documented and generated marks are tags.
- **Skills:** a three-column grid of `ink` cells separated by 1px rule lines, each a 1.3rem figure over a 0.8rem caption.
- **Facts:** a two-column list, term in `vellum-2` at the left, value at the right; positive values verdigris, negative minium.
- **Meter:** a 0.35rem `ink-3` track with a minium fill (0.4rem in the wide form).

### Inputs

- **Style:** `ink` ground, 1px rule border, 2px radius, padding 0.5rem 0.65rem, gold caret. Placeholder in italic `vellum-3`.
- **Focus:** the border turns gold; the outline is removed.

### Navigation

- **Area tabs:** text buttons in the year strip, `vellum-2`, padding 0.5rem 0.75rem, with a 2px transparent underline. Hover: `vellum`. Current: `vellum` with a gold underline. A minium pill carries the count of open matters.
- **Rows:** in the other areas, a row is a button of portrait, name over small facts, and sign. Hover: `ink-2`. Selected: `ink-3` with a rule border.
- **Text links:** `vellum-2`, underlined with a 3px offset; hover gives `vellum`.

### The thread (signature)

The house as a drawn line of medallions in the order of succession, ruler first.

- **Medallion:** a 3.5rem round portrait with a 2px `vellum-3` ring in a 4.9rem column. Beneath it the name (0.82rem), the role in Cinzel, and `genererad` in italic `vellum-3` for a generated person.
- **Ruler:** 4.6rem with a 3px gold ring, raised 0.55rem; the role is gold.
- **Heir:** a gold ring and a solid gold line from the ruler.
- **Selected:** a `vellum` ring and a 3px `accent-2` halo.
- **Held:** greyed and darkened, a dashed ring, the role in minium.
- **Hover:** the portrait lifts 2px over 0.25s and the ring turns `vellum`.
- **Count:** a minium pill at the upper right with the number of matters that start in that person.
- The court houses follow after a dotted gap and a Cinzel caption.

### Figures that open

Each figure in the bar is a caption over a number. A figure with reasons has a dotted underline under its caption, turns gold on hover, and opens a 19rem popover on `ink-2` with a `vellum-3` border: a label heading, the rows that make up the number, and fine print for what the game's view lacks.

### The year line and the year turn

Twelve month columns with 1px rules and 0.75rem month names. A deadline is a 1px vertical tick with its date and title; a near one is minium at weight 600; one late in the year is right-aligned.

At a year turn the two panels slide off their edges over 0.9s, a 2px gold marker with a gold glow crosses the months, the date in the bar turns gold, and the map's snow line climbs to summer and returns. With reduced motion the turn is instant and all transitions are off.

### The map (signature)

MapLibre GL, layered from the ground up:

- **Imagery:** Esri World Imagery, desaturated (−0.28) with contrast 0.12 and brightness 0.06–0.9.
- **Snow:** a colour relief keyed to elevation. The snow line is 700 m at 25 December and 3100 m at midsummer; saturation and brightness rise with the season.
- **Realm wash:** each realm's dye as a fill, 0.56 opacity at zoom 3, 0.34 at 4.4 and 0.14 at 6.6. Far out it reads as a political map; close in the land shows through.
- **Realm band:** a wide blurred line in the realm's dye inside each border (10–60 px wide by zoom, 0.75 opacity).
- **Hillshade:** exaggeration 0.62, warm highlight, dark brown shadow, lit from 315°.
- **Borders:** a `border-ink` edge with a thin line in the realm's dye beside it. The player's frontier is heavier (2–5 px) than borders between other realms (0.9–2.4 px).
- **Sea:** the complement of Natural Earth's land as a `sea` fill, a blurred `sea-shallows` band inside the coast, a `sea-shore` line, and a colour relief that darkens the open water with depth.
- **Sky:** a dark sky over a pale warm horizon with fog.
- **On the land:** realm names set along each realm's long axis; seats as a sign or the ruler's portrait over the city's name; the court as a larger gold sign with a minium count; border peoples as a small diamond over an italic name. A raid is a boxed label on deep minium with a diamond that pulses every 2.4s.
- **Camera:** a click on a place flies there in 2200 ms; the return home takes 2000 ms.

The ten realm dyes for the AD 800 start are in `REALM_COLORS` in `map.js`. The player's realm takes the start's realm dye.

## Do's and Don'ts

### Do:

- **Do** keep the land visible between the panels. Panels stay at the edges: 23rem at the left, 20.5rem at the right.
- **Do** start every matter in a person: a portrait on the card and a count on that person's medallion.
- **Do** keep one gold button per view.
- **Do** mark a generated person in italic `vellum-3` under the medallion and as a tag in the card.
- **Do** let a figure open its reasons, with a dotted underline under its caption as the sign.
- **Do** give text on the map a dark text shadow.
- **Do** honour reduced motion: no pulse, no transitions, an instant year turn.

### Don't:

- **Don't** round panels or cards. Circles are for people.
- **Don't** set names, text or figures in Cinzel.
- **Don't** use minium or verdigris for decoration.
- **Don't** let the period accent reach body text, borders or buttons.
- **Don't** add drawn cloud shadows over the map. They were tried as gradients and removed; the relief carries the life.
- **Don't** box a label on the map unless it is urgent.
- **Don't** replace the map with a drawn stand-in. It is the game's own engine with real geometry.

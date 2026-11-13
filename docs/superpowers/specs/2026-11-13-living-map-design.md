# A living map for historical campaigns

Date: 13 November 2026. Owner mandate: continue without pause and decide by rulings.

## Why

The owner judged the map of a historical campaign against Crusader Kings and the Total War campaign maps and found it flat. The interface draft in `docs/design/ui-draft` (branch `design/ui-draft`) shows the look he approved: the land itself is visible, a realm is a wash of colour over it, and relief reads through the colour.

Three things make today's map flat in a historical campaign:

- The default basemap is `ocean`, a bathymetry service whose land carries little.
- A historical package holds about 1,420 regions, and all but a handful have no owner. Each unowned region is filled with `NEUTRAL_LAND_COLOR`, a grey, so the whole known world is grey.
- The political fill is 46 to 84 per cent opaque and grows with zoom, so no terrain shows through a realm.

## Goals

A historical campaign opens on land the player can read as land: coasts, mountains, deserts and forests, with each realm tinted over them.

## Non-goals

- Non-historical scenarios keep today's look.
- No change to scenario packages, saves, region geometry or the ownership rules.
- A painted sea, a seasonal snow line and rulers at their seats come in later slices. Realm outlines are slice 2 and the leaning camera slice 3.

## Slice 1: the land shows

Rulings, each with what it costs if wrong:

1. **Satellite imagery is the default basemap of a historical campaign.** The scenario's own `world.basemap` and the player's pick in Settings still win, in that order after the pick. Cost if wrong: one constant.
2. **The imagery stops at zoom 9 in a historical campaign.** Deeper levels show motorways and airports. Past zoom 9 MapLibre stretches the last level, which is soft and shows no modern detail. This applies only when the historical default is in use; a basemap the player picked is drawn as he picked it. Cost if wrong: one constant.
3. **Unowned land has no fill in a historical campaign.** The region stays in the source with a transparent colour, so clicks and province selection work as before. Cost if wrong: unclaimed land reads as terrain only, and a player may want it marked; a faint hatch can come later.
4. **A realm's fill thins as the camera comes closer**: 0.50 at the world view, 0.36 at zoom 5, 0.20 at zoom 8 and 0.14 from zoom 14. Far out the map is political, close in the land carries it. Cost if wrong: one table.
5. **Relief is drawn over the fills and under the borders**, as a hillshade from the elevation tiles the game already uses, on a source of its own. It fades in from zoom 2.5 to 4, because a hillshade at whole-world zoom veils the map (noted in `World.jsx`). It is not mounted without a network connection. Cost if wrong: one layer to remove.
6. **The first map waits for the world's first word, two seconds at most.** The basemap of a historical campaign differs from the stock one, and the game learns that a campaign is historical a moment after the map component mounts. A map replaced while MapLibre was still creating it logged `Invalid type: 'container' must be a String or HTMLElement`. The browser run logged it on two loads of two without the wait and on neither of two with it. Cost if wrong: the menu's map appears up to two seconds later when the world store never answers.

7. **An ownership change keeps to the thin wash.** The sweep and the flood that animate a change take the historical opacity. A side without a fill is transparent in the sweep; the flood draws itself and cannot draw nothing, so there that side borrows the other side's colour and the realm's colour arrives or leaves at once. Cost if wrong: a change on unclaimed land has no spreading edge.
8. **The historical grade is part of the map's key.** When the default starts or stops applying (the player picks a basemap, the network drops), the map is remounted, as for any basemap change. A style swapped in place drops the layers the component tree added.
9. **A scenario with a map of its own gets no relief.** The elevation tiles are the Earth's.

Everything lives in one small module, `src/Game/Map/historicalCartography.js`, so the look has one place and its numbers have tests.

## Slice 2: a realm has an edge

After slice 1 a realm of the AD 800 package is a wash with no edge: the game draws a border only where two realms meet. The measurement behind this slice, on the four released packages:

| Package | Regions | Owned | Edges between two realms | Realm edges with no realm beyond |
|---|---|---|---|---|
| `charlemagne-800` | 1,426 | 11 | 18 | 2,216 |
| `john-1200` | 1,425 | 6 | 4 | 629 |
| `egypt-3000bc` | 1,421 | 1 | 0 | 30 |
| `world-1500` | 1,422 | 2 | 0 | 216 |

So 99 in 100 of a realm's edge segments had no line at all. The unowned regions of these packages do not share vertices with each other, so the topology cannot tell a coast from land nobody is known to rule. The rule therefore does not try.

Rulings, each with what it costs if wrong:

10. **A realm's outline is every edge with the realm on one side and not on the other.** Where no other realm lies beyond, the edge is a *frontier*; where another realm does, it is the realm's *side* of a shared border. Coast and unclaimed land are both frontier. Cost if wrong: a coast and a land frontier look the same, and a later slice with land data can split them.
11. **The outline is drawn inside the realm.** Each outline segment is stored with the realm on its right, from the winding of the region's ring, so `line-offset` moves the colour inward. A band in the realm's colour, wide and blurred, lies just inside the edge, with a thin line of the same colour at its outer rim. The colour of one realm never spills over a neighbour or the sea. Cost if wrong: a ring whose winding cannot be read (zero area) puts its band on the wrong side of that ring.
12. **A frontier gets the dark line a border already has.** The two existing border layers draw it, so a realm's edge looks the same against a neighbour and against the wild. A realm's side of a shared border is left to the band; the border between the two already has its line.
13. **The player's own realm has a heavier edge**: a darker, wider line around the whole of it, drawn over the borders. The player's realm is the owner named by `game.country`. Cost if wrong: one layer to remove.
14. **Only a historical campaign asks for outlines.** The map tells the cartography worker at `initialize`; other scenarios get the same features, byte for byte, as before.
15. **An ownership change redraws the outline in the same patch as the border.** The outline hides with the border while the change animates, through the same filter.

The topology gains two geometry facts and no ownership: which side of each edge its first region lies on, and which two edges a recovered overlap came from. An edge of a single region that overlaps a region of the same owner is interior and gets no outline.

## Slice 3: the camera leans

The map of a historical campaign was seen from straight above. The game already deforms the ground with the elevation tiles (Settings, 3D terrain, on by default on a desktop), but the camera could not lean, so the mountains never stood up. A run in the browser with the camera leaned by hand showed that every layer the game draws holds: the fills, the outlines, the realm names of the text renderer, cities and units. `fitBounds` and `flyTo`, which the game uses to show an event or a search result, keep the camera's pitch.

Rulings, each with what it costs if wrong:

16. **In a historical campaign on the flat map the camera may lean and turn.** The right mouse button, or Ctrl and a drag, turns and leans it; two fingers lean it on a touch screen. The pitch stops at 55 degrees: steeper, and the horizon fills with far tiles. On the globe the camera stays as it was, because the globe's sun and its idle turning assume a camera that looks straight down. Cost if wrong: one function.
17. **A campaign opens leaned by 42 degrees**, north up, on the framing it already had. Cost if wrong: one constant.
18. **The ground is raised 8 times in a historical campaign**, not 15. Fifteen was chosen for a camera that never leaned; seen from the side it makes needles of the Alps. Cost if wrong: one constant.
19. **A compass brings the view back.** It stands over the search button while the camera is turned or its pitch is not the resting one, its needle shows north, and a press returns to north and to 42 degrees. Its label is the interface string `Reset`, which every language pack already carries, so the slice adds no player text. Cost if wrong: one small component.
20. **When leaning stops being allowed, the camera is laid flat.** A player who switches to the globe would otherwise be left with a view he cannot change.

Not in this slice: the sea floor still rises and falls with the elevation tiles, which shows as a step at the edge of the continental shelf. The painted sea of a later slice covers it.

## Checks

- Unit tests for the module, the layer order and the wiring in `World.jsx` and `Nations.jsx`.
- The full suite and the build.
- A browser run on a historical campaign, before and after, at the world view and close in.

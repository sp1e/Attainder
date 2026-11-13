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
- The tilted camera, realm outlines against unclaimed land, a painted sea, a seasonal snow line and rulers at their seats come in later slices.

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

## Checks

- Unit tests for the module, the layer order and the wiring in `World.jsx` and `Nations.jsx`.
- The full suite and the build.
- A browser run on a historical campaign, before and after, at the world view and close in.

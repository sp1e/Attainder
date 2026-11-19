# The seasons sweep across the map when the date moves: design

## Why

Backlog row 28, left open by slice 5 of `2026-11-13-living-map-design.md`: "a snow line that sweeps through the seasons while a year turns is left for a later slice". Every start opens in midwinter and a court year moves the date a whole year, so the snow stood still: the north was white before the year and white after it, and nothing on the map said that a year had passed.

## What stands in the way

The resting snow is a `color-relief` layer over elevation tiles rewritten as height above the snow line of one day (a five-day step). The day is in the tile's address. Moving the day reloads and rewrites every visible tile, one by one. A sweep made of such steps would repaint the map in patches seventy times a year.

## Goals

- When the game's date moves forward by twenty days or more, the snow line moves through the days in between, smoothly, and comes to rest at the new date.
- The resting snow looks exactly as it does today.
- The south has its winter half a year from the north's, in the sweep as at rest.

## Non-goals

- No change to the snow line's model, its tables or the resting layer's ramp.
- The sweep does not run while the year is being written: the date has not moved yet.
- No sweep on a date that moves backwards (another campaign opened, a restore point).

## Rulings

1. **The sweep has a layer of its own, whose season is a paint value.** Its tiles are rewritten once, for the whole year: each pixel holds how much winter the place needs before snow lies on it, `(permanent line − height) / (permanent line − midwinter line)`. At or below 0 the place is always white, 1 is the midwinter line, above 1 it is never white. Snow lies where that value is under the day's share of winter (`winterShare`), which is the snow line's own rule rearranged, so the edge of the snow is exactly where the resting layer has it on the same day. Moving the season is then one paint property per frame, and no tile is fetched.
2. **The south is written mirrored.** Its winter share is one minus the north's. A southern pixel is written as `10 − value`, and the ramp has a second arm that reads the mirror. Between the two arms everything is clear, so the row where the hemispheres meet cannot draw a line.
3. **How solid the snow is above its edge is approximate in the sweep.** The resting ramp thickens with metres above the line. The sweep's ramp thickens with shares of winter, scaled so that it matches the resting ramp at the Alps (2,200 m between the two lines). Further north the span is shorter and the sweep's snow is more solid than the resting snow. It is seen for the seconds of the sweep only.
4. **The two layers cross-fade.** The sweep fades in over the resting snow on the old date (350 ms), runs, and fades out over the resting snow on the new date. The resting layer changes its day while it is covered. Both layers carry an opacity transition of zero: MapLibre's own is 300 ms, which would draw each fade late (found by the review).
5. **One year takes four seconds**; a shorter move takes its share of that, never under 1.2 seconds, and eases in and out. A move of more than a year sweeps one year and the remainder. A reader who asks for reduced motion gets no sweep.
6. **A browser that cannot rewrite the tiles has no sweep**, as it has no snow (`canvasReadsExactly`).
7. **The sweep waits under the real-history notice.** The notice opens on the same move of the date and lies over the map with a dimmed ground; the first browser run showed the sweep playing behind it. The sweep's clock stands while the notice's ground is on the page and goes on when it is closed. The year's record in the court shell does not cover the map and does not hold it.

## Checks

- `src/Game/Map/snowSweep.test.js`: over a grid of latitudes, heights and days, the sweep's edge agrees with `snowLineMetres`; the south mirrors; the ramp's stops ascend for every share of winter; the plan of a move (too short, backwards, a year, more than a year, across the era); the frames of a sweep from its first to its last.
- The tests of the resting snow, unchanged.
- The full suite and the build.
- Browser, the Charlemagne test campaign: the date is moved a year and the frames between are looked at; the resting picture before and after is the same.

## Seen and not seen

Seen on 19 November 2026, production build, 2560 by 1440: the sweep's layer on the old date beside the resting layer (the same picture to the eye), midsummer (snow left on Iceland's ice, the Norwegian mountains, the Alps and the Caucasus), and a whole sweep driven by the event the game sends when its date moves (`oh:game-updated`): 350 ms in, four seconds through the year, 350 ms out, 65 distinct positions of the edge in 106 samples.

Known and left: a date that moves again while a sweep runs ends that sweep at once and starts the next from the date it was heading for, which shows as a jump; a court year takes minutes, so two moves within five seconds have not been seen. Each frame of a sweep makes MapLibre build a new pair of small ramp textures (about 480 for a year), freed by the browser.

Not seen: a sweep after a year written by the model (the date was moved by sending the game's own event), the south (the view was Europe; the mirror is held by the unit test over a grid of latitudes), a move shorter or longer than a year, and the frame rate on the owner's 169 Hz screen.

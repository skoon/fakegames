# Implementation plan — one arcade

Service manual step 5. Supersedes the step-4 plan (signature mechanics), which
is complete — see [task.md](task.md).

The theme: seven games now share a module, a look and a set of controls, but the
front door still doesn't know they exist and two of them won't run offline.

## The work

| Item | Size | Decision needed? |
| --- | --- | --- |
| Combined leaderboard on the index | M | No |
| Consistent scaling for small screens | M | No — but see below |
| Blurbs that match the games | S | No |
| Vendored Phaser | S | **Yes** — repo size |
| Touch controls | L | **Yes** — worth building at all? |

## Checked before planning

**`localStorage` is shared across `file://` directories.** I tested it: a page
in the repo root writes a key, a page in a subdirectory reads it back. So the
index really can show scores the games saved, without a server. That was the
load-bearing assumption for the leaderboard and it holds.

## 1. Combined leaderboard

The index loads `arcade/scores.js` and reads each game's table through
`Arcade.Scores`. Each cabinet card gains its own best score and initials; below
the cabinets, a combined board lists the top entry per game, ranked.

Games with no score yet show nothing rather than a zero row. Pole Position has a
score now — that was the step-3 gap the countdown closed — so all seven appear.

## 2. Scaling

Tempest is 800×800 and Pole Position 1024×768, both before their HUD. Neither
fits a 13" laptop, which is the actual complaint in the manual.

CSS alone won't do it. The canvas would scale, but every HUD, overlay and score
panel is absolutely positioned in pixels against the container, so they would
drift. So: `Arcade.Shell.fit(selector)` applies a `transform: scale()` to the
whole game container, origin top-centre, recomputed on resize. Canvas and
chrome scale together and nothing needs repositioning.

The two Phaser games already have `Scale.FIT` and skip this entirely.

## 3. Blurbs

Every card's copy is now out of date, and understates most of them. Breakout's
"grab power-ups" — the line the manual called out as a lie in step 1 — has
quietly become true, so that one resolves itself.

## 4. Vendored Phaser

Dig Dug loads 3.60 and Spy Hunter 3.80.1, both from jsdelivr at page load. That
is no offline play, two engine versions, and a third-party outage away from two
dead cabinets.

Plan: download 3.80.1 once to `vendor/phaser.min.js` (~1.1 MB minified) and
point both games at it. **Dig Dug moves from 3.60 to 3.80.1**, so its suite and a
real-browser boot both have to pass before I call it done.

## 5. Touch controls

The shared shell grows an on-screen d-pad and two buttons, shown only under
`@media (pointer: coarse)` so desktop is untouched. They drive `Arcade.Input`
through the `_press`/`_release` seam the tests already use, so no game changes.

This is the largest item and the one I am least sure is worth it. Every one of
these games was designed around a keyboard, several need precision (Tempest's
lane taps, Pole Position's steering), and on-screen controls would be a
compromise everywhere. It is also the only item here that no other item depends
on.

## Testing

Leaderboard and scaling get suites. The blurbs and the vendored library get a
boot check per page. Counterfactual discipline stays: each new behaviour must
fail with the mechanic disabled.

Given the last four phases, I will also render a page rather than trusting green
suites — that has caught three real defects this session that no assertion did.

## Out of scope

Everything still open in the manual's per-cabinet lists: Pole Position's
roadside scenery and fog, Spy Hunter's road curves and enemy archetypes,
Tempest's pulsars and fuseballs, Dig Dug's authored stage layouts, Space
Invaders' attract mode.

## Questions

1. **Vendor Phaser?** It puts ~1.1 MB in the repo and moves Dig Dug up two minor
   versions. I recommend yes — offline play and one engine version were both
   listed as problems. Say no and both games keep the CDN.
2. **Touch controls — build or defer?** I lean defer: it is the biggest item, it
   compromises seven keyboard-designed games, and nothing else needs it. Happy to
   build it if you play on a tablet.
3. **Rename `fakeasteroids/faskeasteroids.html`?** The typo has been in the
   manual since step 1. It is a rename rather than a delete, but it changes a URL,
   so I would rather ask than assume.

---

# Step 6 — the Phaser games are deaf

**Step 5 is paused.** These are blocking: two of the seven cabinets cannot
currently be played at all.

## Root cause (confirmed, not guessed)

Phaser's keyboard manager begins its handler with `if (event.defaultPrevented)
return;`. `arcade/input.js` calls `e.preventDefault()` on every bound key —
arrows, WASD, Space, Shift, Enter — to stop the page scrolling. So every key the
two Phaser games care about is marked handled before Phaser ever sees it.

Isolated on a bare Phaser scene with nothing else loaded:

```
WITH arcade/input.js:   cursors.left.isDown = false, keydown-SPACE never fires
WITHOUT preventDefault: cursors.right.isDown = true
```

This landed in step 3 and has been broken through all of step 4.

## What is actually broken

Wider than the three symptoms reported:

| Game | Symptom |
| --- | --- |
| Dig Dug | Arrow movement dead |
| Dig Dug | Space (pump) dead — the game is unplayable, not just hard |
| Dig Dug | Space to restart after game over dead |
| Spy Hunter | Space to start dead — reported |
| Spy Hunter | Arrow/WASD steering dead |
| Spy Hunter | Space to fire dead |
| Spy Hunter | R to restart dead |

The five canvas games are unaffected: they read `Arcade.Input` directly, which
is the side of the seam that works.

## Why the suites did not catch it

`tests/lib/stubs.js` replaces Phaser wholesale. `addKey()` returns a stub whose
`isDown` is always false, and every suite drives `Arcade.Input._press` directly.
The seam between the shared input module and *real* Phaser was never exercised
by anything. 412 assertions, none of them touching the thing that broke.

## The fix

Move both Phaser games onto `Arcade.Input`, deleting their use of Phaser's
keyboard entirely. That is what step 3 should have done — I explicitly left them
on Phaser's own keyboard and recorded it as "Audio, Scores and the back link
only", which is precisely where the conflict came from.

- Dig Dug: `cursors` and `spaceKey` become `Arcade.Input.held/justPressed`.
- Spy Hunter: `cursors`, `wasd`, `spaceKey` and both `once('keydown-...')`
  handlers become `Arcade.Input`.

## Closing the testing gap

A green suite proved nothing here, so the fix is not done until something would
have caught it. Add a real-browser integration check per Phaser game: load the
actual page with real Phaser, dispatch genuine `KeyboardEvent`s at the window,
and assert the game responds. No stubs on that path.

## Also requested: a Dig Dug start screen

A feature rather than a bug — Dig Dug currently drops you straight into a level
with no title, no controls and no high-score board, which is the only cabinet
that still does. It gets the same treatment as the others: title, PRESS SPACE,
score table, control hints.

## Order

1. Fix the input conflict in both Phaser games.
2. Add the integration checks that would have caught it.
3. Dig Dug start screen.
4. Resume step 5.

---

# Graphics pass 1: Dig Dug becomes a garden

Every cabinet gets a graphics pass, one at a time, starting here. The rule for
all of them: **the gameplay stays exactly the same.** Only the look changes,
plus one layout bug you asked me to fix.

## What is wrong now

- **Tiny.** The playfield is 576x448 at 1:1. `Scale.FIT` does nothing because
  `#game-container` has no size of its own to fit into.
- **Made of primitives.** Every sprite is a few `fillCircle`/`fillRect` calls in
  a 16x16 box. The player never turns to face the way it is moving.
- **Flat ground.** Dirt is one brown, tunnels are plain black, and the gray
  border reads as a wall rather than as ground.

## Theme: garden mole

| Now | Becomes |
| --- | --- |
| Digger | A mole with a miner's lamp. Faces its direction of travel, two-frame dig animation |
| Pooka | A fat pale grub. Inflates as it does now, flushing pinker as it swells |
| Fygar | A red fire ant. Breathes a flickering flame puff |
| Harpoon/pump | A garden hose with a nozzle |
| Rock | A 2x2 boulder drawn as a single 32x32 sprite rather than four tiles |
| Vegetable | A different veg each level: carrot, turnip, mushroom, eggplant, tomato, pumpkin (one per entry in `VEGETABLE_POINTS`) |
| Top wall row | Sky and a strip of grass, with the HUD on it |
| Side and bottom walls | Bedrock |
| Dirt | Four soil bands by depth (topsoil, loam, clay, subsoil) with deterministic pebbles and roots |
| Tunnels | Dark earth, with a shaded rim wherever they meet dirt |

The name stays **Fake DigDug** so the index card still matches.

## How

- **Sprites as pixel maps.** Each sprite is a list of strings plus a palette,
  turned into a texture by one small `pixelTexture()` helper. Same idea as the
  Space Invaders sprites. Sprites stay 16x16 because tile logic is 16px, and
  it is the extra detail and palette that make the difference.
- **Scaling.** `#game-container` fills the window and `Scale.FIT` does the
  rest. `pixelArt` is already on, so pixels stay crisp.
- **Tile drawing.** `drawTile` picks the soil band from the row and adds rim
  shading from the four neighbours, so digging a tile also redraws the tiles
  around it.
- **Feedback.** Visual only, no rule changes: a pop puff and a floating
  `+500` when something dies, a short flash when the mole dies, and the
  flame flickering. The title screen gets the sprites next to their names.

## The bug fix (the one gameplay change)

The two top rocks sit at rows 5-6, directly over the tunnel carved at row 7,
so they fall the moment a level starts. That counts two rocks as landed, and
the veg bonus appears for free every level. Moving them up to rows 4-5 puts
dirt underneath them, the same as the other three rocks.

## Testing

- New suite check: no rock is falling after the first `updateRocks()` of a
  fresh level, and `rocksLanded` is still 0. I will confirm it fails before
  the fix.
- The existing digdug suite plus the real-Phaser e2e suite must stay green.
  `pixelTexture` and the sprite changes go through the same Phaser calls the
  stubs already cover.
- Screenshots of the title screen, play, a pump, and game over, checked by
  eye, because no assertion catches ugly.

## Out of scope

Level layouts, enemy AI, speeds and scoring. Those are all gameplay. The other
six cabinets come after this one, one pass each.

---

# Graphics pass 2: Pole Position. New track and scenery, and the collision fix

The Dig Dug pass above is parked, not dropped. It is still waiting for a go.

Cars stay as they are. The track, the background and the collision code change.

## Collision: measured, not guessed

I placed an AI car at known positions in the real page, recorded where
`renderCar` drew it, and asked the current collision test whether it counted
as a hit. Player's car is drawn at x 402..622, y 628..728.

```
dz 1000 offset .75 -> drawn at x 1101   | current code crashes: false
dz  150 offset .75 -> NOT DRAWN         | current code crashes: true
```

Three faults:

1. **The distance check is measured from the camera, not from the car.** The
   player's car is drawn about 940 to 1320 units ahead of the camera, but the
   check is `playerZ ± 200`, which is the camera's own position. By the time it
   fires, the other car has gone out of the bottom of the view. You hit
   something you cannot see.
2. **The sideways hit zone is about twice as wide as the cars.** `overlap(playerX,
   0.4, car.offset, 0.4, 1.0)` counts a hit anywhere within 0.8 road-widths.
   From what is actually drawn, the player's car is ±0.14 and the AI cars are
   ±0.28, so they only touch within 0.42.
3. **Stale position.** Cars move before the player does, so the check uses the
   player's position from the previous frame. At speed with a long frame, a
   car can also pass straight through between checks.

Fix:

- `PLAYER_Z_OFFSET`: how far ahead of the camera the player's car sits,
  computed from the same projection `render()` uses and the rear edge
  `renderPlayer()` draws at. It is derived rather than a magic number, so it
  stays right if the camera changes.
- Half-widths taken from the drawing code, in road units (`PLAYER_HALF_W`,
  `CAR_HALF_W`), replacing the 0.4/0.4.
- The check runs after both the player and the cars have moved. It is a hit if
  the gap is inside one car-length, or if the gap changed sign during the frame
  (which catches cars that would otherwise tunnel through). Gaps wrap around
  the track length.

Known ceiling: the offset is computed on flat road. On the crest of the one
hill it is a little off. I will note it in the code rather than model it.

Worth knowing, not changing: the AI cars are drawn about twice the width of
the player's car at the same depth. You said the cars look fine, so I will
leave them. The collision will match what is drawn, big AI cars included.

## The look: arcade homage

All of this is in `render()` and the segment colours. No rules change.

- **Sky:** a blue gradient with a few clouds.
- **Mountains:** a snow-capped range and a nearer line of green hills, both
  generated once from a fixed seed. They slide sideways as the road curves
  (each layer at its own rate, for parallax).
- **Haze:** `FOG_DENSITY` is declared but never used. Road, kerb and grass
  colours fade toward a pale haze with distance.
- **Road:** red/white kerbs alternating per rumble strip, two-tone striped
  grass, the lane dashes as now, and a chequered start/finish line. The
  `START` colour set exists already but is unused.
- **Roadside:** billboards, trees and lamp posts placed deterministically
  along the track. They are drawn back-to-front mixed in with the AI cars, so
  a car can pass in front of a billboard. **Decoration only:** in the arcade,
  hitting a billboard crashes you, but that is a rule change. Say if you want
  it and it becomes its own item.

## Testing

- **Collision matches the picture.** Sweep AI cars across a grid of offsets
  and depths near the player. For each one, compare "the drawn boxes overlap"
  with "the game says crash". They must agree, within a few pixels. This is
  the check that describes the bug, so it must fail on the current code first.
- **You hit what you can see.** Drive into a parked car in your lane. The crash
  fires while that car is still on screen.
- **No tunnelling.** A one-second frame at full speed through a parked car
  still crashes.
- Existing poleposition suite stays green.
- Screenshots at the start line, on a curve, on the hill, and in traffic.

## Out of scope

Car art, AI behaviour, scoring, and billboard crashes (see above).

---

# Graphics pass 3: Tempest enemies

The web, the claw and the bullets stay. Only the enemies change, and only in how
they are drawn: lanes, depths, speeds and collisions are untouched.

## What is wrong now

From a frozen frame with enemies placed at depths from 0.1 to 0.95:

- **No perspective.** `drawEnemies` draws every enemy at a fixed size (12, 16
  or 10 px). A flipper at the hub is as big as one at the rim, so depth does
  not read at all.
- **They do not sit in the lane.** Each one is a small shape centred on the lane
  and rotated to its angle. The web is drawn edge to edge, so the enemies float
  inside it rather than being part of it.
- **Flippers teleport.** `enemy.lane = stepLane(...)` changes lane in a single
  frame, with nothing in between. Nothing else animates either.

## The design: the 1981 shapes

Every enemy is drawn in **lane space**. At depth `d` the lane has two edge
points, each interpolated between its rim point and its hub point. The
distance between them is the lane width at that depth. Shapes are defined in
units of that width, so they shrink toward the hub and fill the lane at the rim
for free, on every web shape, open or closed.

| Enemy | Drawing |
| --- | --- |
| Flipper | Red bow-tie whose two tips touch the lane's edges. It lies across the lane, the way the original sits on the web. |
| Tanker | Purple diamond spanning the lane, with a smaller filled diamond inside (its cargo). |
| Spiker | Green spiral, spinning, sized to the lane. |
| Spike | As now: a green line. |

**The flip.** When a flipper changes lane, the logical lane still changes at
once, exactly as now, so collisions and shots behave identically. What changes
is the picture: for the next ~180 ms it is drawn cartwheeling over the rail it
shares with the new lane. It rotates about that rail from the old lane's
orientation into the new one's. Split flippers from a shot tanker get the same
flip out of the tanker's lane.

Animation time comes from `Arcade.Shell.now()`, so a pause freezes a flip
mid-air rather than skipping it.

## How

- `laneEdgesAt(lane, depth)`: the two edge points. A small pure function the
  drawing and the tests both use.
- `drawEnemy(enemy, now)`: lane-space shape plus the flip transform.
  Replaces the per-type blocks in `drawEnemies`.
- Enemies gain an optional `flip: { from, to, startedAt }` field. It is set in
  the two places a lane change happens (the flipper timer and the tanker
  split) and read only by drawing.

## Testing

- **Perspective:** the same enemy measures wider at depth 0 than at depth 1, on
  every web.
- **In the lane:** a flipper's tips land on its lane's two edges, on every web.
  This includes the open ones, where the end lanes are the edge case.
- **Flip is cosmetic:** after a flip starts, `enemy.lane` is already the new
  lane, and bullets hit it there straight away, exactly as now.
- **Flip ends:** after the duration it draws plainly in its new lane. While
  paused it does not advance.
- Existing tempest suite stays green (all 20 suites,
  including the web geometry ones).
- A frozen-frame screenshot like the one above, checked by eye, plus one frame
  caught mid-flip.

## Out of scope

Pulsars and fuseballs (new enemy types are gameplay, and still open in the
service manual), the player's claw, explosions.

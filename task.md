# Task — signature mechanics (step 4)

Executing [implementation_plan.md](implementation_plan.md), risk-ascending order.
Phase 1 only this session; review before anything structural moves.

## Phase 1 — additive mechanics
- [x] Tempest: superzapper (2 charges per level, `fire2`)
- [x] Space Invaders: mystery saucer
- [x] Asteroids: firing UFO (two sizes) + hyperspace
- [x] Dig Dug: rock chains + vegetable bonus
- [x] Suite per feature, written alongside
- [x] Counterfactual: each suite fails with its mechanic disabled
- [x] All pages boot clean; screenshot anything visual

## Later phases (not this session)
- [x] Phase 2 — Tempest web shapes
- [x] Phase 3 — Breakout power-ups (ball -> balls[])
- [x] Phase 4 — Pole Position countdown timer
- [x] Phase 5 — Spy Hunter weapons van

## Decisions taken without asking
- **Mystery saucer scoring: the authentic shot-count formula**, not the random
  table I floated. The 23rd shot and every 15th after is worth 300, otherwise
  50/100/150. Four lines rather than two, and fidelity is the point of this
  project. Trivial to swap back if you would rather it were random.

## Steps 1-3 (complete)
Two blocker bugs fixed, five faults cleared, shared `arcade/` module built and
all seven games retrofitted. 156 assertions passing.

Carried forward: Pole Position still has no high-score table — its result is a
lap time, where lower is better, and `Arcade.Scores` is higher-is-better. The
countdown timer in phase 4 brings a real score with it and closes this.

## Phase 1 done

248 assertions across 8 suites, all passing (up from 156). All seven games plus
the index boot in Chrome with no console errors.

Counterfactual run: disabling the four mechanics in the build copies produced
27 failures — 7 Tempest, 4 Space Invaders, 7 Asteroids, 9 Dig Dug — so every
new suite genuinely tests its mechanic.

**Refactors that came with the features, not scope creep but worth knowing:**
- Tempest gained `destroyEnemy(index)`; bullets and the superzapper both award
  kills through it, so scoring lives in one place. The tanker split stays on the
  bullet path because the superzapper should not be that generous.
- Asteroids gained `loseLife()`. Three death paths (asteroid, saucer ram, saucer
  fire) plus hyperspace misfire had been duplicating respawn logic.
- Dig Dug's `ENEMY_SCORE.rock` is now `{pooka: 0, fygar: 0}`: a crush pays by
  chain length via `crushEnemies()`, not per enemy. The zero row keeps one table
  describing all kill scoring rather than splitting it in two.

## Phase 2 done — Tempest web shapes

295 assertions (up from 248). All pages boot clean.

Seven webs, each 16 lanes so difficulty is unchanged: CIRCLE, SQUARE, CROSS and
STAR are closed; VEE, FLAT and HORSESHOE are open. A web is a list of corners in
normalised space; lanes are sampled evenly along that path and the hub is the
rim scaled toward the centre, which is what gives FLAT and VEE their sense of
receding. Levels cycle through the list.

`stepLane(lane, delta)` replaces the five hand-rolled `% NUM_LANES` wraps
(player movement, flipper lane changes, both halves of a tanker split). On an
open web it clamps instead, so the ends are real corners you can be trapped in.

Counterfactual: forcing open webs to wrap produced 6 failures; pinning every
level to the circle produced 1.

**Caught by looking, not by the tests:** drawing the outline from the sampled
lane points turned the circle into a visible 16-gon and cut the tips off the
star. The outline is now drawn from the web's own corners, with the sampled
points used only for lane boundaries. The assertions all passed both ways — a
contact sheet of the seven webs is what showed it.

## Phases 3 and 4 done

359 assertions (up from 295). All eight pages boot clean.

**Breakout.** `ball` became `balls[]`; a parked ball is `stuck` rather than
gated by `ballActive`, which is gone. A life is only lost when the *last* ball
goes. Five drops fall from broken bricks: wide, multiball, laser, catch, slow.
`breakBlock()` is now the single place a brick dies, shared by ball hits and
laser bolts. Fire launches parked balls if there are any, and only shoots if
there are not.

**Pole Position.** 90 seconds on the clock, +30 for getting round, ending the
race where you stand if it empties. Laps stay the win condition — that is how
the arcade works, the clock ends you early but distance is what wins — so the
results panel from step 2 still means something and now has two endings,
FINISH and TIME UP. Scoring arrived with it: distance as you drive, 1000 a lap,
and leftover seconds paid at 200 each but only if you actually finished. That
closes the high-score gap left open in step 3.

Counterfactuals: disabling the power-ups gave 6 failures, reverting to a single
ball gave 1, stopping the clock gave 9.

**Found by the tests, and real:** the initials prompt is modal and captures keys,
so after a qualifying finish the R that restarts a race was being eaten as an
initial (a run got stored under the name "RPO"). The behaviour is right — enter
your initials, then restart — but several suites were leaving prompts open and
committing them all at once. Suites that are not about high scores now seed the
table so no prompt opens.

## Decisions taken without asking
- **Pole Position: the countdown sits alongside the 3 laps, it does not replace
  them.** I had framed replacing as the authentic option, but on checking, the
  arcade is both: a lap distance to complete and a clock that can end you first.
  So alongside is the more faithful reading, not the compromise.

## Phase 5 done — Spy Hunter weapons van

412 assertions (up from 359). All eight pages boot clean.

The van comes past, settles ahead of you and drops its ramp for nine seconds.
Drive into the back and you come out armed with one of three: oil slick and
smoke screen drop out the back, missiles go forward. Shift deploys. Missiles
punch through more than one car in a shot, which is what makes them different
from the gun rather than just stronger.

The player is now a small state machine — driving / boarding / driving — with
the car hidden and the controls dead in the middle. Nothing else in that file
needed one.

**Deviation from the arcade, forced by the road:** the real van pulls out of a
side road. Ours is a straight scrolling tile with no side roads, so the van
arrives from up the road and holds station instead.

Boarding and the weapon hits are deliberately plain arithmetic rather than
sprite bounds, because the Phaser stub cannot do bounds — that is what made them
testable at all.

Counterfactuals: stopping the ramp opening gave 3 failures, disabling deployment
gave 10, making missiles stop at the first car gave 1.

**Caught by looking again:** the oil slick was near-black on near-black tarmac
and effectively invisible in play. It now has a petrol sheen round the rim. No
assertion would ever have found that.

## Step 4 complete

All eight signature mechanics landed across five phases. 412 assertions, up from
156 at the end of step 3.

## Step 5 — partial (three items answered and done)

- [x] Vendored Phaser: `vendor/phaser.min.js`, 3.80.1, 1.13 MB. Both Phaser
      games point at it; Dig Dug moved up from 3.60. Verified by booting both
      with the network fully blocked.
- [x] Touch controls: **deferred** by decision. No code.
- [x] Renamed `faskeasteroids.html` to `fakeasteroids.html` (git mv), with the
      index link and the test runner's source map updated.

Still open in step 5: combined leaderboard, consistent scaling, blurb rewrite.

**Verification limit worth recording:** Dig Dug's engine upgrade is confirmed
only as far as booting and rendering. Its *controls* cannot be verified while
step 6 is outstanding, because they do not work at all. So "3.60 to 3.80.1 broke
nothing" is currently a claim about startup, not about play.

**Noticed, not actioned:** Breakout still loads Tailwind from a CDN at runtime,
so it is the one cabinet that still needs the network to look right. Same class
of problem as the Phaser CDN, but outside what was asked for.

## Step 6 done — the Phaser games can be played again

Root cause: Phaser's keyboard manager ignores any event whose
`defaultPrevented` is already true, and `arcade/input.js` calls
`preventDefault()` on every bound key. Both Phaser games went deaf the moment
the shared input module landed in step 3, and stayed that way through step 4.

Fix: both games now read `Arcade.Input` and use no Phaser keyboard at all.
`this.cursors`, `this.wasd`, `this.spaceKey` and every
`input.keyboard.once('keydown-...')` are gone; start, restart and pump/fire are
polled in `update()`.

Two further bugs found on the way in:
- Spy Hunter bound **M** itself *and* the shell binds it, so mute toggled twice
  and cancelled out. The shell owns it now; `syncMuteButton()` keeps the label
  honest.
- Spy Hunter's `R` to restart went through the same dead Phaser path.

Dig Dug also gained the start screen that was asked for: title, PRESS SPACE,
score table, control hints. It shows on a fresh game only, not between levels —
both arrive through `scene.restart()`, so `STORE.showTitle` separates them.

### The testing gap is closed

New `tests/integration/` — real Phaser from `vendor/`, real `arcade/` module,
real `KeyboardEvent`s dispatched at the window, no stubs anywhere. `run.ps1`
runs these alongside the stubbed suites.

Counterfactual, on a copy reverted to the Phaser-keyboard code:

```
digdug e2e:    PASS the shared input saw it
               FAIL the player faces left / actually moved left
               FAIL right/down/up/left, FAIL the pump went out
spyhunter e2e: PASS the shared input saw the space
               FAIL the game started
```

That pass-then-fail pair is the exact fingerprint of the bug: the key arrives,
the game never hears it. The old suites could not express that, because they
replace Phaser wholesale.

Also fixed: `run.ps1` treated Chrome's stderr warnings as fatal under
`$ErrorActionPreference='Stop'`. It relaxes that around the native call now.

## Step 5 done

451 assertions across 10 suites (8 stubbed, 2 end-to-end). Every page boots with
the network blocked.

- **Combined leaderboard.** The index reads `arcade:scores:*` through
  `Arcade.Scores`. Each cabinet card shows its own best, and a Hall of Fame
  ranks the top entry per game with unplayed cabinets sinking to the bottom. It
  repaints on `pageshow`, so coming back from a game shows the score you just
  set.
- **Scaling.** `Arcade.Shell.fit(selector)` scales a whole game container about
  its centre and re-measures on resize. Applied to Tempest (800x800), Pole
  Position (1024x768) and Space Invaders. Asteroids is 800x600 and did not need
  it; Breakout already scales through CSS; the Phaser games use Scale.FIT.
- **Blurbs.** All seven rewritten to describe what the games now do.

**A trap worth recording:** `fit()` must never be given `body`. The shell's back
link and pause overlay are `position: fixed` children of body, and a transformed
ancestor makes fixed positioning relative to *it* rather than the viewport,
which silently breaks both. I wrote `fit("body")` for Asteroids first. It now
refuses body and html outright, with a test.

## Still open

- Touch controls — deferred by decision, not done.
- [x] Breakout's Tailwind CDN: gone. The dozen utility classes it used are now
  named classes in the page's own `<style>`, plus the two bits of Tailwind's
  reset it relied on (border-box sizing, zero margins in the overlays).
  Screenshots with the network blocked match the Tailwind version.
- Per-cabinet items from the service manual: Pole Position's roadside scenery
  and fog, Spy Hunter's road curves and enemy archetypes, Tempest's pulsars and
  fuseballs, Dig Dug's authored stage layouts, Space Invaders' attract mode.

## Graphics passes (implementation_plan.md, passes 1-3)

### Pass 1 - Dig Dug garden
- [x] Test: no rock falls at level start (fails first)
- [x] Fix top rock rows
- [x] pixelTexture helper + mole, grub, fire ant, flame, boulder, veg set
- [x] Soil bands, tunnel rims, sky/grass, bedrock
- [x] Mole faces direction + dig frames; hose pump; pop/score feedback
- [x] Container fills window; title screen with sprites
- [x] Suites green, screenshots checked

### Pass 2 - Pole Position
- [x] Tests: collision matches drawing, visible hit, no tunnelling (fail first)
- [x] Collision fix
- [x] Sky, mountains with parallax, haze, kerbs, grass stripes, start line
- [x] Roadside scenery sorted with cars
- [x] Suites green, screenshots checked

### Pass 3 - Tempest enemies
- [x] Tests: perspective, lane fit, flip is cosmetic (fail first)
- [x] laneEdgesAt + lane-space drawing for flipper, tanker, spiker
- [x] Flip animation on lane change and tanker split
- [x] Suites green, screenshots checked

### Graphics passes 1-3 done

All suites green. Verified by screenshot as well as by test: title, play,
game over (Dig Dug); start line, curve, hill, traffic (Pole Position); circle,
star, flat webs and a mid-flip frame (Tempest).

- **Dig Dug** is a garden: pixel-map sprites (mole, grub, fire ant, flame,
  six vegetables), a canvas-texture ground with four soil layers and shaded
  tunnels, boulders as single sprites, a hose, pops and floating scores. The
  window-filling scale fix was `#game-container` having no size.
  Gameplay change, as approved: the top two rocks moved up a row so they no
  longer fall at level start and hand out the veg bonus.
- **Pole Position** collision now matches the pictures: distances from where
  the player's car is drawn rather than the camera, widths from the drawing
  code, checked after everything moves, with a guard against tunnelling. The
  test sweeps cars across the road and compares drawn contact with crashes.
  New backdrop with parallax, haze, kerbs, chequered line, roadside scenery.
- **Tempest** enemies are drawn in lane space with perspective, as the 1981
  shapes, and flippers cartwheel over the rail when they change lanes.

Noticed, not actioned:
- Dig Dug sprites are still 16px against 16px tiles, so they are small on a
  big screen. Drawing them larger would overlap the tunnel walls.
- [x] Pole Position's AI cars were drawn about 2.4x the player's width at the
  same depth. Fixed on request: their scale is now derived from the two
  drawing functions so a car level with the player is exactly as wide.
  Collision widths come from the same drawing, so they shrank with it.
  Scenery has its own scale and is unchanged.
- Test-only: a suite that types "P" as an initial also pauses the game,
  because tests dispatch keys at window. `greenFlag()` now resets the shell.

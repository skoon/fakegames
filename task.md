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
- [ ] Phase 5 — Spy Hunter weapons van

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

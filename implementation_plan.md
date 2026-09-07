# Implementation plan — signature mechanics

Service manual step 4: give each cabinet the one mechanic its original is
remembered for. Supersedes the step-3 plan (shared `arcade/` module), which is
complete — see [task.md](task.md).

## The seven

| Game | Mechanic | Size | Changes the game model? |
| --- | --- | --- | --- |
| Space Invaders | Mystery saucer | M | No — additive |
| Asteroids | Firing UFO + hyperspace | M | No — additive |
| Tempest | Superzapper | S | No — additive |
| Dig Dug | Rock chains + vegetable bonus | M | No — additive |
| Tempest | Web shapes | M | Yes — lane geometry stops being a circle |
| Breakout | Power-ups | M | Yes — one ball becomes many |
| Pole Position | Countdown timer | M | Yes — laps stop being the win condition |
| Spy Hunter | Weapons van | L | Yes — a whole weapon subsystem |

## Ordering: by risk, not by impact

The service manual ordered these by what each adds to its game. I want to invert
that and go by risk instead, because four of the eight are purely additive and
four rewrite something load-bearing. Landing the additive four first means the
shared module and the test rig get exercised across four games before anything
structural moves.

Step 3 is the argument for this: I moved fast, retrofitted Spy Hunter before
writing its suite, and a bad edit boundary silently deleted its start overlay.
The smoke test passed because the crash only fired on SPACE. Front-loading the
low-risk work buys confidence cheaply.

**Phase 1 — additive.** Invaders' saucer, Asteroids' UFO fire and hyperspace,
Tempest's superzapper, Dig Dug's chains and vegetable. Four games, no
restructuring. Suite per feature, written alongside.

**Phase 2 — Tempest web shapes.** `calculateLaneGeometry()` becomes data-driven
over a `WEBS` table. Open webs (a V, a line, a cross) mean the player can no
longer wrap from lane 15 to lane 0, so movement and flipper logic need a
`closed` flag. Self-contained to one game.

**Phase 3 — Breakout power-ups.** The real work is `ball` becoming `balls[]`;
multiball is worthless without it and bolting it on later is worse. Drops fall
from destroyed bricks and are caught with the paddle: wide, multiball, laser,
catch, slow.

**Phase 4 — Pole Position countdown.** Replaces the lap-count win condition.
Brings a score with it, which finally gives this cabinet a high-score table —
the gap I left open in step 3.

**Phase 5 — Spy Hunter weapons van.** The largest single piece. Van entity,
ramp/entry state machine, weapon inventory, rear-fire deployment, HUD.

## Design decisions worth stating

**Mystery saucer.** Spawns on a timer, crosses the top, worth 50/100/150/300.
The arcade's values are famously a deterministic function of your shot count; I
plan to pick randomly from that table rather than reproduce the counter, unless
you want the authentic version.

**Hyperspace and superzapper both want a second button.** `Arcade.Input` already
maps `fire2` to Shift. Both go there, so the whole arcade keeps one convention.

**UFO sizes.** Large saucer fires roughly toward the player (200 pts), small
saucer fires accurately and gets more accurate as your score climbs (1000 pts).

**Rock chains.** 1 enemy 1000, 2 → 2500, 3 → 4000, 4 → 6000. The vegetable
appears at the centre tunnel after the second rock is dropped and times out.
Both fold into the `ENEMY_SCORE`/`killEnemy` path that step 2 established, so
scoring stays owned by one function.

**Power-up drops** are a new entity type with their own collision pass. Effects
are timed except multiball. Laser paddle adds a second projectile array.

**Pole Position's countdown** starts at 90 seconds, and crossing the line adds
time rather than simply counting laps. Running out is a distinct end state from
finishing — GAME OVER versus FINISH, with different results panels.

**Weapons van.** Our road is a straight scrolling tile, with no side roads to
pull out of. So the van enters ahead of the player, matches speed, and opens its
rear ramp; you drive into the rear to collect. That is a deliberate deviation
from the arcade's side-road entry, forced by the road we have.

## Testing

Every feature gets assertions written *with* it, not after. Step 3 proved that
smoke tests catch load failures and nothing else — a screenshot found the bug
they missed. So each phase ends with: suites green, all pages boot clean, and a
screenshot of anything with a visual component.

The counterfactual discipline stays: for each new mechanic, confirm the suite
fails when the mechanic is disabled.

## Risks

- **Breakout's multiball touches every collision branch.** Lives, level
  completion and the launch flow all assume exactly one ball.
- **Open webs break wraparound arithmetic** in three places: player movement,
  flipper lane changes, and tanker splitting.
- **Pole Position's timer interacts with pause.** The shell's `now()` already
  handles this; the lap timer must use it rather than raw `dt` accumulation.
- **Spy Hunter's van is a state machine inside a game that has none.** It needs
  an explicit player state (driving / entering / inside / exiting) that nothing
  else in that file currently has.
- **Scope.** This is eight mechanics across seven games. It is the largest step
  in the manual by some distance.

## Out of scope

Everything in the manual's step 5: combined leaderboard, consistent scaling,
vendored Phaser, touch controls, marquee copy.

## Open questions

1. **How far this session?** All five phases, or land Phase 1 (the four additive
   mechanics) and review before anything structural moves? I recommend the
   latter.
2. **Pole Position:** does the countdown *replace* the 3-lap win condition, or
   sit alongside it (finish 3 laps before the clock runs out)? Alongside is less
   authentic but keeps the results panel from step 2 meaningful.
3. **Mystery saucer scoring:** random from {50,100,150,300}, or the authentic
   shot-count formula where the 23rd shot and every 15th after is worth 300?

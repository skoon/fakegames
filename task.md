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
- [ ] Phase 2 — Tempest web shapes
- [ ] Phase 3 — Breakout power-ups (ball -> balls[])
- [ ] Phase 4 — Pole Position countdown timer
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

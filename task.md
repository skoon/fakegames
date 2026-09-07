# Task — shared `arcade/` module

Executing [implementation_plan.md](implementation_plan.md).
Decisions: all five phases · gamepad deferred · score tables start clean (no migration).

## Phase 1 — build the module
- [x] `arcade/audio.js` — one context, tone, noise, music loop, master mute
- [x] `arcade/input.js` — keyboard actions, held/justPressed, resumes audio on first key
- [x] `arcade/scores.js` — per-game top 5 with initials, shared prompt overlay
- [x] `arcade/shell.js` — back link, P/M/Esc, pause overlay, pause-aware clock
- [x] `arcade/arcade.css` — back link, pause overlay, mute indicator
- [x] `tests/pages/arcade.html` + `tests/suites/arcade.js`

## Phase 2 — pilot: Tempest
- [x] Wire in shell, input, audio, scores
- [x] Move audio-context assertions out of the Tempest suite into the arcade suite
- [x] Suites green

## Phase 3 — remaining canvas games
- [x] Asteroids
- [x] Space Invaders
- [x] Breakout (gains audio it never had)
- [x] Pole Position (pause must not skew the lap timer)

## Phase 4 — Phaser games
- [x] Dig Dug (gains audio it never had)
- [x] Spy Hunter (rewire existing mute + scores; suite written first)

## Phase 5 — tests and cleanup
- [x] `run.ps1` + test pages load `arcade/` alongside game source
- [x] Suite per retrofitted game
- [x] Full run green, all pages boot clean

## Done

All five phases complete. 156 assertions across 7 suites, all passing;
all seven games plus the index load in Chrome with no console errors.

**Deviation from the plan:** Spy Hunter's suite was written *after* its
retrofit, not before as planned. That cost a real bug: a bad edit boundary
dropped its start overlay, and the smoke test missed it because the crash only
happens on SPACE, not on load. A screenshot caught it. The suite now covers it.

**Not done, deliberately:** Pole Position has no high-score table. Its result is
a lap time, where lower is better, and `Arcade.Scores` is built around
higher-is-better. Forcing it in would have made the module lie. It has audio,
input, pause, mute and the back link like everything else.

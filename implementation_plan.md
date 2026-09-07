# Implementation plan — shared `arcade/` module

Service manual step 3. Extract the code all seven games currently reimplement:
audio, input, high scores, pause/mute, and the back-to-arcade shell.

## Why

| Concern | Today |
| --- | --- |
| Web Audio | 6 separate implementations; 2 games silent |
| High scores | 3 formats: top-5 with initials (Spy Hunter), one number (Invaders), nothing (5 games) |
| Mute | Spy Hunter only |
| Pause | No game has one |
| Gamepad | No game has one |
| Back to arcade | Pole Position only; the other six are dead ends |

Two of the three bugs fixed in steps 1–2 were audio-lifecycle bugs written
independently in two different games. One implementation makes that class of
bug unwritable twice.

## Constraints that shape the design

1. **No build step, and it must keep working from `file://`.** ES modules are
   blocked by CORS on `file://`, so the module ships as plain scripts attaching
   to a single `Arcade` global. No bundler, no package.json.
2. **The games are not alike.** Five are raw canvas with everything at module
   scope; two are Phaser scenes. Their loops differ — RAF with internal state
   gating, RAF that halts on game over, and Phaser's `update`. A common *engine*
   would be a rewrite of all seven.
3. **So this is a library, not a framework.** Independent helpers a game opts
   into one at a time. No game is required to adopt all of it, and a
   half-retrofitted game still runs.
4. **The test runner extracts the first bare `<script>` block.** Shared code
   must be included as `<script src="...">`, which extraction already skips.

## Proposed layout

```
arcade/
  arcade.css     shell chrome: back link, pause overlay, scaled canvas wrapper
  audio.js       Arcade.Audio  — one context, tone/noise, music loop, master mute
  input.js       Arcade.Input  — keyboard + gamepad, held & justPressed
  scores.js      Arcade.Scores — per-game top-5 with initials
  shell.js       Arcade.Shell  — back link, P/M/Esc bindings, pause overlay
```

### `Arcade.Audio`

One lazily-created `AudioContext` behind a master gain, resumed on first input.
This is the Tempest bug fixed once, centrally.

```js
Arcade.Audio.tone(freq, { duration, type, volume, slideTo });
Arcade.Audio.noise({ duration, volume, filterFrom, filterTo });  // explosions
Arcade.Audio.mute(true|false);   Arcade.Audio.isMuted();
const music = Arcade.Audio.loop({ notes, tempo, type, volume });
music.setTempo(ms);  music.start();  music.stop();
```

`setTempo` exists because Invaders and Asteroids both ramp their bassline as the
field thins — that is the one genuinely shared music behaviour.

### `Arcade.Input`

Self-polls on its own RAF so retrofitting needs no change to a game's loop.

```js
Arcade.Input.held("left")           // keyboard or gamepad d-pad/stick
Arcade.Input.justPressed("fire")    // replaces the hand-rolled spacePressed flags
Arcade.Input.bind({ fire: ["Space", "KeyZ"], ... })   // optional override
```

Default map: arrows + WASD → directions; Space → `fire`; Shift → `fire2`;
Enter → `start`. Gamepad: left stick + d-pad → directions, A → `fire`,
B → `fire2`, Start → `start`.

### `Arcade.Scores`

Spy Hunter's implementation promoted, generalised over a game key.

```js
Arcade.Scores.top("tempest")            // [{name, score}, ...]
Arcade.Scores.qualifies("tempest", n)   // bool
Arcade.Scores.submit("tempest", "SCK", n)
Arcade.Scores.promptInitials(n, cb)     // shared DOM overlay, optional
```

Data-only by default, because Phaser, canvas and DOM games render differently.
`promptInitials` is an optional shared HTML overlay for the five DOM/canvas
games; the Phaser games can keep drawing their own and just call `submit`.

**Migration:** Invaders' `spaceInvadersHighScore` (a bare number) and Spy
Hunter's `fakespyhunter_highscores` (an array) are read once on first load and
folded into the new per-game format, so nobody loses a score. Old keys are left
in place rather than deleted.

### `Arcade.Shell`

Injects the back link, owns P / M / Esc, and renders the pause overlay.

Pause needs a contract because the loops differ:

- Canvas games: `Arcade.Shell.paused` is checked in the existing state gate —
  a one-line change per game (`if (gameState === "playing" && !Arcade.Shell.paused)`).
- Phaser games: `Arcade.Shell.onPause(cb)` fires, and the game calls
  `scene.scene.pause()` / `resume()`.

## Phasing

**Phase 1 — build the module.** `arcade/` plus a test page and suite covering
score storage and migration, input edge detection, mute gating, and single-context
audio. No game touched.

**Phase 2 — pilot on Tempest.** Chosen because it currently has *no* scores, no
mute, no pause and no back link, so it exercises every part of the module, and
its audio is small enough that a regression is obvious. **Stop here for review**
— if the shape is wrong, one game is cheap to unwind.

**Phase 3 — the four remaining canvas games.** Asteroids, Space Invaders,
Breakout, Pole Position. Breakout gains audio it has never had; Invaders gets
its single-number high score migrated.

**Phase 4 — the two Phaser games.** Dig Dug and Spy Hunter take Audio, Scores
and the back link only. They keep Phaser's scale manager, so they skip
`arcade.css`'s canvas wrapper. Spy Hunter's existing mute button is rewired to
`Arcade.Audio.mute` rather than being removed. Dig Dug gains audio it has never
had.

**Phase 5 — tests and cleanup.** Extend `tests/` to cover each retrofitted game;
update `run.ps1` and the test pages to load `arcade/` alongside game source.

## Risks

- **Spy Hunter regression.** It is the only game with working scores and mute;
  retrofitting means changing code that works today. Mitigation: it goes last,
  and its suite is written before the change.
- **Phaser scale conflict.** `arcade.css` positions a scaled canvas wrapper;
  Phaser manages its own canvas. Mitigation: Phaser games take the CSS for the
  back link only, not the wrapper.
- **Pause is not free.** Games using wall-clock time (Tempest's `Date.now()`
  fire rate, Pole Position's lap timer) will jump on resume unless paused time
  is subtracted. `Arcade.Shell` will expose `pausedMs` and the affected games
  will offset by it.
- **Audio autoplay policy.** The context can only resume after a real gesture.
  `Arcade.Input` already sees the first keypress, so it will resume the context
  centrally — removing another thing each game currently gets slightly wrong.

## Out of scope

Combined leaderboard on the index page, consistent canvas scaling for small
screens, vendored Phaser, and touch controls. Those are service manual step 5.

## Open questions

1. **How far this session?** Phases 1–2 (module + pilot, stop for review), or
   push straight through all five phases?
2. **Gamepad now or later?** It is the one item with no existing behaviour to
   preserve, so it could be deferred without blocking anything else.
3. **Old high scores.** Migrate as described, or start the new tables clean?

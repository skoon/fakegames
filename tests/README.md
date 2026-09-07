# Tests

Headless-browser tests for the arcade. No install step, no package manager —
they drive the games' real source in Chrome (or Edge) and read the results back
out of the page.

## Running

```powershell
powershell -File tests\run.ps1          # everything
powershell -File tests\run.ps1 -Only tempest
```

Exit code is 0 when every suite passes, 1 otherwise.

## Layout

| Path | What it is |
| --- | --- |
| `run.ps1` | Extracts game source, runs each page in headless Chrome, reports |
| `lib/rig.js` | `suite()` / `check()` / `near()` and the result banner |
| `lib/stubs.js` | Stand-ins for Phaser, Web Audio, `localStorage`, `requestAnimationFrame` |
| `pages/<game>.html` | One page per game: rig + stubs + game source + suite |
| `suites/<game>.js` | The assertions for that game |
| `.build/` | Generated. Game source extracted from inline `<script>` blocks |

## Why one page per game

The games are standalone HTML with everything at top level, and they share
names — `score`, `lives`, `player`, `canvas`, `ctx`, `update`, `render`. Loaded
into one page they would collide, and `let`/`const` redeclaration would throw
before a single assertion ran. So each game gets its own page and its own Chrome
run.

## The shared module

Every game now loads `arcade/` (audio, input, scores, shell). Test pages must
load those four scripts too, before the game source - see any page in `pages/`.
`lib/stubs.js` fakes the AudioContext underneath, so `audioBook.contextsCreated`
asserts the module really does keep exactly one.

## Adding a game

1. If its JavaScript is inline, add it to the `$inline` map in `Build-Sources`
   in `run.ps1`. If it has its own `.js`, add a `Copy-Item` line instead.
2. Add `pages/<game>.html` — copy an existing one and swap the `.build` script,
   the suite script, and whatever DOM elements the game looks up on load.
3. Add `suites/<game>.js`.

Watch for element id collisions: the rig reports into `#test-report`
specifically because Pole Position already owns `#results`.

## Writing assertions

```js
suite("digdug: a level can actually be completed", function () {
  const scene = new DigDugScene();
  scene.create();
  check("all enemies can be cleared", scene.enemies.length === 0);
  near("60Hz and 120Hz agree", at120, at60, at60 * 0.02);
});
```

Suites run after `load` (and one tick later), so games that bootstrap from
`window.onload` have finished initialising. A suite that throws is reported as a
failure rather than taking the rest of the run down with it.

Prefer assertions written against observable behaviour over ones that poke at
the fix. The Space Invaders suite groups aliens by x position rather than by the
`col` field the fix added, so it would still catch a regression written a
different way.

## A note on trusting these

A test that passes before and after a fix proves nothing. When adding a suite
for a bug, revert the fix in `.build/` and confirm the suite fails, then restore
it. That is how the Dig Dug and Tempest suites were checked in.

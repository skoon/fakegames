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

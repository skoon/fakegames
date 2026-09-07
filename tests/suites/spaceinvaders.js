/**
 * fakespaceinvaders - who gets to shoot back.
 *
 * Columns are identified by x position rather than by the alien's own `col`
 * field, so this suite describes the behaviour and not the implementation.
 */

function columnXs() {
  return [...new Set(aliens.map((a) => a.x))].sort((a, b) => a - b);
}

function startWave() {
  score = 0;
  lives = 3;
  wave = 1;
  gameState = "playing";
  init();
  SoundManager.stopMusic(); // nothing to listen to headlessly
}

suite("spaceinvaders: return fire comes from the bottom of each column", function () {
  startWave();

  const xs = columnXs();
  check("wave has the expected column count", xs.length === ALIEN_COLS, "got " + xs.length);

  // Punch holes so the bottom of several columns is no longer the bottom row.
  const gapped = [xs[1], xs[3], xs[4]];
  const bottomY = Math.max(...aliens.map((a) => a.y));
  for (const a of aliens) {
    if (gapped.includes(a.x) && a.y >= bottomY - ALIEN_HEIGHT - ALIEN_PADDING) {
      a.alive = false;
    }
  }
  check("holes were punched", aliens.some((a) => !a.alive));

  const offenders = [];
  let fired = 0;

  for (let shot = 0; shot < 300; shot++) {
    alienBolts.length = 0;
    playerBolts.length = 0;
    alienShootTimer = alienShootInterval; // force a shot on this call
    updateBolts();
    if (!alienBolts.length) continue;

    fired++;
    const bolt = alienBolts[0];
    const boltCx = bolt.x + BOLT_WIDTH / 2;

    const shooter = aliens.find(
      (a) =>
        a.alive &&
        Math.abs(a.x + a.width / 2 - boltCx) < 0.001 &&
        Math.abs(a.y + a.height - bolt.y) < 0.001
    );

    if (!shooter) {
      offenders.push("bolt at x=" + boltCx.toFixed(1) + " matches no living alien");
      continue;
    }

    // The whole point: nobody may fire through a squadmate below them.
    const blocked = aliens.some((a) => a.alive && a.x === shooter.x && a.y > shooter.y);
    if (blocked) {
      offenders.push("column x=" + shooter.x + " fired from row " + shooter.row);
    }
  }

  check("aliens actually fired", fired > 50, "only " + fired + " shots");
  check(
    "no alien fires through a squadmate below it",
    offenders.length === 0,
    offenders.length + " bad shots, e.g. " + offenders.slice(0, 2).join(" | ")
  );
});

suite("spaceinvaders: every column can still shoot", function () {
  startWave();

  const seen = new Set();
  for (let shot = 0; shot < 600; shot++) {
    alienBolts.length = 0;
    alienShootTimer = alienShootInterval;
    updateBolts();
    if (alienBolts.length) seen.add(Math.round(alienBolts[0].x));
  }

  check(
    "shots come from all " + ALIEN_COLS + " columns",
    seen.size === ALIEN_COLS,
    "saw " + seen.size + " distinct firing positions"
  );
});

/* ------------------------------------------------------------ mystery saucer */

suite("spaceinvaders: the saucer arrives on a timer and crosses the screen", function () {
  startWave();
  check("no saucer to begin with", saucer === null);

  // Not yet.
  saucerTimer = 3;
  updateSaucer();
  updateSaucer();
  check("still nothing before the timer expires", saucer === null);

  updateSaucer();
  check("saucer appears when the timer runs out", saucer !== null);
  check("it starts off-screen", saucer.x <= 0 || saucer.x >= CANVAS_WIDTH);
  check("it sits above the formation", saucer.y < Math.min(...aliens.map((a) => a.y)));

  // Fly it all the way across.
  const dir = saucer.dir;
  let guard = 2000;
  while (saucer && guard-- > 0) updateSaucer();
  check("it leaves the screen and despawns", saucer === null, "guard left " + guard);
  check("the timer is rearmed", saucerTimer === SAUCER_INTERVAL);
  check("direction was consistent", dir === 1 || dir === -1);
});

suite("spaceinvaders: shooting the saucer scores and clears it", function () {
  startWave();
  saucerTimer = 1;
  updateSaucer();
  check("saucer is up", saucer !== null);

  saucer.x = 400;
  score = 0;
  playerBolts = [
    { x: saucer.x + saucer.width / 2, y: saucer.y + saucer.height / 2, speed: 10 },
  ];
  updateBolts();

  check("saucer is gone", saucer === null);
  check("the bolt was consumed", playerBolts.length === 0, "left " + playerBolts.length);
  check("points were awarded", score > 0, "score " + score);
  check(
    "the award is one of the saucer values",
    [50, 100, 150, 300].indexOf(score) !== -1,
    "score " + score
  );
  check("the value is shown on screen", saucerScoreFlash !== null);
});

suite("spaceinvaders: the saucer value follows the shot count", function () {
  startWave();

  // The 23rd shot is worth 300, and every 15th after it.
  shotCount = 23;
  check("23rd shot pays 300", saucerValue() === 300);
  shotCount = 38;
  check("38th pays 300", saucerValue() === 300);
  shotCount = 53;
  check("53rd pays 300", saucerValue() === 300);

  shotCount = 24;
  check("24th does not", saucerValue() !== 300);
  shotCount = 22;
  check("22nd does not", saucerValue() !== 300);
  shotCount = 0;
  check("nor does the first", saucerValue() !== 300);

  // Everything else comes off the small table.
  for (let i = 0; i < 40; i++) {
    shotCount = 10;
    const v = saucerValue();
    if ([50, 100, 150].indexOf(v) === -1) {
      check("non-bonus values stay on the table", false, "got " + v);
      return;
    }
  }
  check("non-bonus values stay on the table", true);
});

suite("spaceinvaders: firing advances the shot count", function () {
  startWave();
  Arcade.Input.reset();

  const before = shotCount;
  playerBolts = [];
  Arcade.Input._press("Space");
  updatePlayer();
  check("a shot was fired", playerBolts.length === 1);
  check("the counter moved", shotCount === before + 1, "got " + shotCount);
  Arcade.Input._release("Space");
});

suite("spaceinvaders: no saucer once the wave is nearly cleared", function () {
  startWave();
  clearSaucer();

  // Leave only the minimum alive.
  let alive = 0;
  for (const a of aliens) {
    a.alive = alive++ < SAUCER_MIN_ALIENS;
  }

  saucerTimer = 1;
  for (let i = 0; i < 200; i++) updateSaucer();
  check("the saucer stays away", saucer === null);
  check("and the timer is not burned", saucerTimer === 1, "timer " + saucerTimer);
});

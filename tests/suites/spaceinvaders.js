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

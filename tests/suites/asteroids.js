/**
 * fakeasteroids - the saucer that shoots back, and hyperspace.
 */

function clearField() {
  resetGame();
  asteroids.length = 0;
  bullets.length = 0;
  ufoBullets.length = 0;
  ufo.active = false;
}

suite("asteroids: the saucer shoots at the ship", function () {
  clearField();

  ufo.active = true;
  ufo.kind = UFO_SMALL; // the accurate one
  ufo.x = 100;
  ufo.y = 300;
  ufo.fireTimer = 1;
  ship.x = 700;
  ship.y = 300;

  ufoShoot();
  check("a saucer bullet exists", ufoBullets.length === 1, "got " + ufoBullets.length);

  const b = ufoBullets[0];
  check("it starts at the saucer", b.x === 100 && b.y === 300);
  check("it travels toward the ship", b.xv > 0, "xv " + b.xv);
  check(
    "the small saucer aims accurately",
    Math.abs(b.yv) < Math.abs(b.xv) * 0.3,
    "xv " + b.xv + " yv " + b.yv
  );
});

suite("asteroids: the big saucer sprays, the small one aims", function () {
  clearField();
  ship.x = 700;
  ship.y = 300;
  ufo.x = 100;
  ufo.y = 300;
  ufo.active = true;

  function spreadOver(kind) {
    ufo.kind = kind;
    ufoBullets.length = 0;
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      ufoShoot();
      const b = ufoBullets[ufoBullets.length - 1];
      worst = Math.max(worst, Math.abs(Math.atan2(b.yv, b.xv)));
    }
    return worst;
  }

  const bigSpread = spreadOver(UFO_LARGE);
  const smallSpread = spreadOver(UFO_SMALL);

  check("the small saucer is the tighter shot", smallSpread < bigSpread,
        "small " + smallSpread.toFixed(2) + " vs big " + bigSpread.toFixed(2));
  check("and it is genuinely accurate", smallSpread < 0.2, "spread " + smallSpread.toFixed(2));
});

suite("asteroids: saucer fire kills the ship", function () {
  clearField();
  ship.x = 400;
  ship.y = 300;
  ship.blinkNum = 0;
  lives = 3;

  ufoBullets.push({ x: 400, y: 300, xv: 0, yv: 0, life: 90 });
  update();

  check("a life was taken", lives === 2, "lives " + lives);
  check("the bullet was consumed", ufoBullets.length === 0, "left " + ufoBullets.length);
});

suite("asteroids: saucer fire is harmless while respawning", function () {
  clearField();
  ship.x = 400;
  ship.y = 300;
  ship.blinkNum = 60; // invulnerable
  lives = 3;

  ufoBullets.push({ x: 400, y: 300, xv: 0, yv: 0, life: 90 });
  update();

  check("no life lost during invulnerability", lives === 3, "lives " + lives);
});

suite("asteroids: saucer fire expires instead of circling forever", function () {
  clearField();
  ship.x = 10;
  ship.y = 10;
  ship.blinkNum = 600;

  ufoBullets.push({ x: 400, y: 300, xv: 1, yv: 0, life: 3 });
  update();
  update();
  update();
  check("it fizzles out", ufoBullets.length === 0, "left " + ufoBullets.length);
});

suite("asteroids: the two saucers are worth different money", function () {
  check("small is worth more than large", UFO_SMALL.points > UFO_LARGE.points);

  clearField();
  score = 0;
  ufo.active = true;
  ufo.kind = UFO_LARGE;
  killUfo(true);
  check("large pays 200", score === 200, "score " + score);

  score = 0;
  ufo.active = true;
  ufo.kind = UFO_SMALL;
  killUfo(true);
  check("small pays 1000", score === 1000, "score " + score);

  // Ramming it should not pay.
  score = 0;
  ufo.active = true;
  ufo.kind = UFO_SMALL;
  killUfo(false);
  check("ramming pays nothing", score === 0, "score " + score);
});

suite("asteroids: hyperspace relocates the ship and kills its momentum", function () {
  clearField();
  hyperspaceMisfireChance = 0; // never misfire for this one

  ship.x = 400;
  ship.y = 300;
  ship.thrust.x = 5;
  ship.thrust.y = -3;
  lives = 3;

  let moved = false;
  for (let i = 0; i < 20 && !moved; i++) {
    ship.x = 400;
    ship.y = 300;
    hyperspace();
    if (ship.x !== 400 || ship.y !== 300) moved = true;
  }

  check("the ship jumped somewhere else", moved);
  check("momentum was dumped", ship.thrust.x === 0 && ship.thrust.y === 0);
  check("it lands on the field", ship.x >= 0 && ship.x <= canvas.width);
  check("no life lost when it works", lives === 3, "lives " + lives);
  check("it arrives invulnerable", ship.blinkNum > 0, "blink " + ship.blinkNum);
});

suite("asteroids: hyperspace can misfire and cost a life", function () {
  clearField();
  hyperspaceMisfireChance = 1; // always misfire

  lives = 3;
  hyperspace();
  check("a misfire takes a life", lives === 2, "lives " + lives);

  hyperspaceMisfireChance = 0.15; // put it back
});

suite("asteroids: fire2 triggers hyperspace", function () {
  clearField();
  hyperspaceMisfireChance = 0;
  Arcade.Input.reset();

  ship.x = 400;
  ship.y = 300;

  Arcade.Input._press("ShiftLeft");
  readInput();
  const moved = ship.x !== 400 || ship.y !== 300;
  Arcade.Input._release("ShiftLeft");

  check("shift jumped the ship", moved, "at " + ship.x + "," + ship.y);
  hyperspaceMisfireChance = 0.15;
});

suite("asteroids: the small saucer only shows up once you are doing well", function () {
  clearField();

  function sampleKinds(atScore) {
    score = atScore;
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      spawnUfo();
      seen.add(ufo.kind === UFO_SMALL ? "small" : "large");
      ufo.active = false;
    }
    return seen;
  }

  check("no small saucers at zero score", !sampleKinds(0).has("small"));
  check("small saucers appear later on", sampleKinds(UFO_SMALL_FROM_SCORE * 2).has("small"));
});

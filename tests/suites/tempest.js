/**
 * faketempest - frame-rate independence, and the arcade module wiring.
 *
 * Audio-context assertions live in the arcade suite now; Tempest no longer owns
 * a context of its own.
 */

suite("tempest: enemies move by wall-clock time, not by frame count", function () {
  // Two runs covering the same elapsed time at different refresh rates must
  // advance an enemy by the same distance.
  function travelOver(frameMs, frames) {
    startGame();
    enemies.length = 0;
    particles.length = 0;
    spikes.length = 0;
    spawnEnemy();
    const e = enemies[0];
    e.speed = 0.0004;
    const startDepth = e.depth;
    for (let i = 0; i < frames; i++) update(frameMs);
    return startDepth - enemies[0].depth;
  }

  const at60 = travelOver(1000 / 60, 60); // one second at 60Hz
  const at120 = travelOver(1000 / 120, 120); // one second at 120Hz

  check("enemy actually moved", at60 > 0, "travelled " + at60);
  near("60Hz and 120Hz cover the same ground in one second", at120, at60, at60 * 0.02);
});

suite("tempest: bullets travel by wall-clock time too", function () {
  function travelOver(frameMs, frames) {
    startGame();
    enemies.length = 0;
    bullets.length = 0;
    bullets.push({ lane: 0, depth: 0, speed: 0.02 });
    for (let i = 0; i < frames; i++) {
      if (!bullets.length) break;
      update(frameMs);
    }
    return bullets.length ? bullets[0].depth : 1;
  }

  const at60 = travelOver(1000 / 60, 20);
  const at120 = travelOver(1000 / 120, 40);

  check("bullet actually moved", at60 > 0, "depth " + at60);
  near("60Hz and 120Hz bullets reach the same depth", at120, at60, at60 * 0.02);
});

suite("tempest: the game loop uses the real frame timestamp", function () {
  startGame();
  enemies.length = 0;
  spawnEnemy();
  const e = enemies[0];
  e.speed = 0.0004;
  const start = e.depth;

  // Drive two real frames 100ms apart through the actual loop.
  stepFrame(1000);
  stepFrame(1100);

  check(
    "a 100ms gap moves the enemy further than a 16ms one would",
    start - enemies[0].depth > 0.0004 * 50,
    "moved " + (start - enemies[0].depth)
  );
});

suite("tempest: movement and firing come from the shared input", function () {
  startGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

  const startLane = player.lane;
  lastMoveTime = 0;
  Arcade.Input._press("ArrowRight");
  update(16);
  check("right moves a lane", player.lane === (startLane + 1) % NUM_LANES, "lane " + player.lane);

  Arcade.Input._release("ArrowRight");
  Arcade.Input._press("KeyA"); // WASD must work as well as the arrows
  lastMoveTime = 0;
  update(16);
  check("A moves back", player.lane === startLane, "lane " + player.lane);
  Arcade.Input._release("KeyA");

  bullets.length = 0;
  lastFireTime = 0;
  Arcade.Input._press("Space");
  update(16);
  check("fire launches a bullet", bullets.length === 1, "got " + bullets.length);
  Arcade.Input._release("Space");
});

suite("tempest: pausing freezes the game", function () {
  startGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

  enemies.length = 0;
  spawnEnemy();
  const before = enemies[0].depth;

  Arcade.Shell.pause();
  stepFrame(2000);
  stepFrame(2200);
  check("nothing moves while paused", enemies[0].depth === before, "moved to " + enemies[0].depth);

  Arcade.Shell.resume();
  stepFrame(2400);
  check("movement resumes", enemies[0].depth < before);
});

suite("tempest: the pause does not bank up a huge elapsed time", function () {
  startGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

  // Fire rate is wall-clock gated. If the clock ran during a pause, the first
  // frame after resuming would fire instantly no matter how recently we shot.
  lastFireTime = Arcade.Shell.now();

  Arcade.Shell.pause();
  const spinUntil = Date.now() + 30;
  while (Date.now() < spinUntil) {
    /* burn real time */
  }
  Arcade.Shell.resume();

  const elapsed = Arcade.Shell.now() - lastFireTime;
  check(
    "elapsed time excludes the pause",
    elapsed < fireRate,
    elapsed + "ms elapsed across a 30ms pause"
  );
});

suite("tempest: game over records a high score", function () {
  Arcade.Scores.clear("tempest");
  startGame();

  score = 4242;
  lives = 1;

  // Walk an enemy into the player's lane to force the last life away.
  enemies.length = 0;
  spikes.length = 0;
  spawnEnemy();
  enemies[0].type = "flipper"; // a spiker would lay a spike and add a 2nd death
  enemies[0].lane = player.lane;
  enemies[0].depth = 0.04;
  update(16);

  check("game is over", gameState === "gameOver", "state " + gameState);
  check(
    "the score qualified and the prompt is open",
    document.querySelector(".arcade-initials") !== null
  );

  // The shared overlay owns the keyboard while it is up.
  check("input is disabled during initials entry", Arcade.Input.isEnabled() === false);

  for (const key of ["S", "C", "K"]) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true }));
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  const table = Arcade.Scores.top("tempest");
  check("score was stored", table.length === 1 && table[0].score === 4242, JSON.stringify(table));
  check("initials were stored", table.length === 1 && table[0].name === "SCK", JSON.stringify(table));
  check("input is handed back", Arcade.Input.isEnabled() === true);
  check("overlay is gone", document.querySelector(".arcade-initials") === null);
});

suite("tempest: the last life can only end the game once", function () {
  Arcade.Scores.clear("tempest");
  startGame();

  score = 99;
  lives = 1;

  // An enemy at the rim AND a spike in the same lane, in one frame.
  enemies.length = 0;
  spikes.length = 0;
  spawnEnemy();
  enemies[0].lane = player.lane;
  enemies[0].depth = 0.04;
  spikes.push({ lane: player.lane, startDepth: 0.01, endDepth: 1 });

  update(16);

  check("game ended", gameState === "gameOver");
  check(
    "exactly one initials prompt is open",
    document.querySelectorAll(".arcade-initials").length === 1,
    "found " + document.querySelectorAll(".arcade-initials").length
  );

  for (const key of ["O", "N", "E"]) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true }));
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  const table = Arcade.Scores.top("tempest");
  check("the score is recorded once", table.length === 1, JSON.stringify(table));
});

suite("tempest: the superzapper clears the web, then takes one more", function () {
  startGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

  check("starts with two charges", superzapper === 2, "got " + superzapper);

  enemies.length = 0;
  spikes.length = 0;
  for (let i = 0; i < 5; i++) {
    spawnEnemy();
    enemies[i].type = "flipper";
    enemies[i].depth = 0.5 + i * 0.05;
  }
  score = 0;
  enemiesKilledThisLevel = 0;

  // First charge: the whole web.
  Arcade.Input._press("ShiftLeft");
  update(16);
  check("first zap clears every enemy", enemies.length === 0, "left " + enemies.length);
  check("all five were scored", score === 5 * 50, "score " + score);
  check("all five counted toward the level", enemiesKilledThisLevel === 5);
  check("one charge left", superzapper === 1, "got " + superzapper);
  Arcade.Input._release("ShiftLeft");

  // Second charge: exactly one enemy, and it should be the nearest.
  enemies.length = 0;
  for (let i = 0; i < 3; i++) {
    spawnEnemy();
    enemies[i].type = "flipper";
  }
  enemies[0].depth = 0.9;
  enemies[1].depth = 0.2; // closest to the rim
  enemies[2].depth = 0.6;
  const nearest = enemies[1];

  Arcade.Input._press("ShiftLeft");
  update(16);
  check("second zap takes exactly one", enemies.length === 2, "left " + enemies.length);
  check("and it takes the nearest one", enemies.indexOf(nearest) === -1);
  check("no charges left", superzapper === 0, "got " + superzapper);
  Arcade.Input._release("ShiftLeft");

  // Third press: nothing.
  const before = enemies.length;
  Arcade.Input._press("ShiftLeft");
  update(16);
  check("a third press does nothing", enemies.length === before, "left " + enemies.length);
  Arcade.Input._release("ShiftLeft");
});

suite("tempest: the superzapper recharges each level", function () {
  startGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

  superzapper = 0;
  zapDisplay.textContent = 0;

  // Push the level over its kill quota.
  enemiesKilledThisLevel = enemiesPerLevel;
  enemies.length = 0;
  update(16);

  check("level advanced", level === 2, "level " + level);
  check("charges are back", superzapper === 2, "got " + superzapper);
  check("HUD agrees", zapDisplay.textContent === "2", "shows " + zapDisplay.textContent);
});

suite("tempest: zapping an empty web wastes no charge", function () {
  startGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

  enemies.length = 0;
  Arcade.Input._press("ShiftLeft");
  update(16);
  check("charge is untouched with nothing to hit", superzapper === 2, "got " + superzapper);
  Arcade.Input._release("ShiftLeft");
});

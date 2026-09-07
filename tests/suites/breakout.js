/**
 * fakebreakout - shared wiring, and the power-up layer.
 *
 * There is no single `ball` any more: multiball needs a list, so the game keeps
 * `balls[]` and a parked ball is `stuck` rather than gated by a flag.
 */

function firstBall() {
  return balls[0];
}

function freshGame() {
  initGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();
  clearPowerups();
  resetBall();
}

suite("breakout: the paddle answers the shared input", function () {
  freshGame();

  paddle.x = 200;
  Arcade.Input._press("ArrowLeft");
  stepFrame(0);
  check("left moves the paddle left", paddle.x < 200, "x " + paddle.x);
  Arcade.Input._release("ArrowLeft");

  const afterLeft = paddle.x;
  Arcade.Input._press("KeyD"); // WASD alias
  stepFrame(0);
  check("D moves the paddle right", paddle.x > afterLeft, "x " + paddle.x);
  Arcade.Input._release("KeyD");
});

suite("breakout: fire launches the parked ball", function () {
  freshGame();

  check("one ball, parked", balls.length === 1 && firstBall().stuck === true);
  check("nothing in play yet", ballsInPlay() === false);

  Arcade.Input._press("Space");
  stepFrame(0);
  Arcade.Input._release("Space");

  check("it is loose", ballsInPlay() === true);
  check("and it has real velocity", firstBall().dy !== 0, "dy " + firstBall().dy);
});

suite("breakout: pausing freezes play but keeps the loop alive", function () {
  freshGame();

  Arcade.Input._press("Space");
  stepFrame(0);
  Arcade.Input._release("Space");

  const x = firstBall().x;
  const y = firstBall().y;

  Arcade.Shell.pause();
  stepFrame(0);
  check("ball does not move while paused", firstBall().x === x && firstBall().y === y);

  stepFrame(0);
  Arcade.Shell.resume();
  stepFrame(0);
  check("play resumes", firstBall().x !== x || firstBall().y !== y);
});

/* ------------------------------------------------------------- multiball --- */

suite("breakout: a life only goes when the last ball does", function () {
  freshGame();
  lives = 3;

  balls = [makeBall(100, 100, 2, -2, false), makeBall(200, 100, -2, -2, false)];

  // Drop one off the bottom.
  balls[0].y = CANVAS_HEIGHT + 50;
  stepFrame(0);

  check("the lost ball is gone", balls.length === 1, "left " + balls.length);
  check("but the life is not", lives === 3, "lives " + lives);

  // Now lose the survivor too.
  balls[0].y = CANVAS_HEIGHT + 50;
  stepFrame(0);

  check("now the life goes", lives === 2, "lives " + lives);
  check("and a fresh ball is parked", balls.length === 1 && balls[0].stuck === true);
});

suite("breakout: multiball splits what is in play", function () {
  freshGame();
  balls = [makeBall(300, 400, 0, -8, false)];

  applyPowerup("multi");
  check("one ball became three", balls.length === 3, "got " + balls.length);
  check("all of them are loose", balls.every((b) => !b.stuck));
  check(
    "they are heading in different directions",
    new Set(balls.map((b) => Math.round(b.dx * 100))).size > 1,
    balls.map((b) => b.dx.toFixed(1)).join(",")
  );
});

suite("breakout: multiball has a ceiling", function () {
  freshGame();
  balls = [];
  for (let i = 0; i < MAX_BALLS; i++) balls.push(makeBall(100 + i, 300, 1, -8, false));

  applyPowerup("multi");
  check("it will not run away", balls.length <= MAX_BALLS, "got " + balls.length);
});

/* ------------------------------------------------------------- power-ups --- */

suite("breakout: bricks drop power-ups and the paddle catches them", function () {
  freshGame();
  drops = [];

  // The drop is a chance, so give it plenty of attempts.
  for (let i = 0; i < 400 && drops.length === 0; i++) maybeDropPowerup(300, 200);
  check("bricks eventually drop something", drops.length > 0);

  const kinds = new Set();
  for (let i = 0; i < 2000; i++) {
    drops = [];
    maybeDropPowerup(300, 200);
    if (drops.length) kinds.add(drops[0].kind);
  }
  check(
    "every power-up can appear",
    kinds.size === POWERUPS.length,
    "saw " + [...kinds].join(",")
  );

  // Catch one.
  drops = [
    {
      x: paddle.x + paddle.width / 2,
      y: paddle.y - 4,
      kind: "slow",
      label: "S",
      color: "#fff",
    },
  ];
  stepFrame(0);
  check("the drop was caught", drops.length === 0);
  check("and its effect is running", effects.slow > 0, "frames " + effects.slow);
});

suite("breakout: a missed drop falls off the bottom", function () {
  freshGame();
  drops = [
    { x: 20, y: CANVAS_HEIGHT + 5, kind: "slow", label: "S", color: "#fff" },
  ];
  stepFrame(0);
  check("it is discarded", drops.length === 0);
  check("with no effect applied", effects.slow === 0);
});

suite("breakout: wide paddle grows and then goes back", function () {
  freshGame();
  const normal = paddle.width;

  applyPowerup("wide");
  check("the paddle is wider", paddle.width > normal, "width " + paddle.width);
  check(
    "it stays on the board",
    paddle.x >= 0 && paddle.x + paddle.width <= CANVAS_WIDTH
  );

  effects.wide = 1;
  updateEffects();
  check(
    "and it shrinks back when the timer runs out",
    paddle.width === normal,
    "width " + paddle.width
  );
});

suite("breakout: slow actually slows the ball down", function () {
  function distanceOver(slow) {
    freshGame();
    balls = [makeBall(300, 300, 0, -6, false)];
    effects.slow = slow ? EFFECT_FRAMES : 0;
    const before = balls[0].y;
    stepFrame(0);
    return before - balls[0].y;
  }

  const normal = distanceOver(false);
  const slowed = distanceOver(true);
  check("the slowed ball covers less ground", slowed < normal, slowed + " vs " + normal);
  check("but it still moves", slowed > 0, "moved " + slowed);
});

suite("breakout: catch sticks the ball to the paddle", function () {
  freshGame();
  effects.catch = EFFECT_FRAMES;

  // Drop a ball straight onto the paddle.
  balls = [
    makeBall(paddle.x + paddle.width / 2, paddle.y - BALL_RADIUS + 1, 0, 4, false),
  ];
  stepFrame(0);

  check("the ball is held", balls[0].stuck === true);
  check("and it has stopped", balls[0].dx === 0 && balls[0].dy === 0);

  // Fire lets it go again.
  Arcade.Input._press("Space");
  stepFrame(0);
  Arcade.Input._release("Space");
  check("fire releases it", balls[0].stuck === false);
});

suite("breakout: the laser paddle shoots and breaks bricks", function () {
  freshGame();
  effects.laser = EFFECT_FRAMES;
  laserCooldown = 0;
  lasers = [];

  // No parked balls, so fire must shoot rather than launch.
  balls = [makeBall(300, 300, 0, -8, false)];

  Arcade.Input._press("Space");
  stepFrame(0);
  Arcade.Input._release("Space");
  check("two bolts were fired", lasers.length === 2, "got " + lasers.length);

  // Put a brick directly above a bolt and let it climb.
  const target = blocks.find((b) => b.active);
  lasers = [{ x: target.x + target.width / 2, y: target.y + target.height + 2 }];
  const before = score;
  stepFrame(0);

  check("the brick was destroyed", target.active === false);
  check("and it scored", score > before, "score " + score);
  check("the bolt was consumed", lasers.length === 0);
});

suite("breakout: fire launches before it shoots", function () {
  freshGame();
  effects.laser = EFFECT_FRAMES;
  laserCooldown = 0;
  lasers = [];

  // A parked ball takes priority over the guns.
  check("a ball is parked", balls[0].stuck === true);
  Arcade.Input._press("Space");
  stepFrame(0);
  Arcade.Input._release("Space");

  check("the ball launched", balls[0].stuck === false);
  check("and nothing was fired", lasers.length === 0, "got " + lasers.length);
});

suite("breakout: losing a life clears the power-ups", function () {
  freshGame();
  lives = 3;
  applyPowerup("wide");
  applyPowerup("laser");
  drops = [{ x: 10, y: 10, kind: "slow", label: "S", color: "#fff" }];

  balls = [makeBall(100, CANVAS_HEIGHT + 50, 0, 4, false)];
  stepFrame(0);

  check("a life went", lives === 2, "lives " + lives);
  check("effects were cleared", effects.wide === 0 && effects.laser === 0);
  check("the paddle is normal again", paddle.width === PADDLE_WIDTH);
  check("pending drops were swept up", drops.length === 0);
});

/* ---------------------------------------------------------------- scores --- */

suite("breakout: game over records a high score", function () {
  Arcade.Scores.clear("breakout");
  freshGame();

  score = 1234;
  showGameOver(false);

  check(
    "the prompt is open for a qualifying score",
    document.querySelector(".arcade-initials") !== null
  );

  for (const key of ["B", "R", "K"]) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true }));
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  const table = Arcade.Scores.top("breakout");
  check("score stored", table.length === 1 && table[0].score === 1234, JSON.stringify(table));
  check("initials stored", table.length === 1 && table[0].name === "BRK", JSON.stringify(table));
  check(
    "the board is rendered on screen",
    document.querySelector(".high-scores").textContent.indexOf("BRK") !== -1
  );
});

suite("breakout: blocks carry the row their pitch comes from", function () {
  freshGame();
  check("blocks were built", blocks.length > 0);
  check(
    "every block knows its row",
    blocks.every((b) => typeof b.row === "number"),
    "first: " + JSON.stringify(blocks[0])
  );

  const rows = [...new Set(blocks.map((b) => b.row))].sort((a, b) => a - b);
  check("more than one row exists", rows.length > 1, "rows " + rows.join(","));
});

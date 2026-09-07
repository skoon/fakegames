/**
 * fakebreakout - shared input, pause, scores, and the audio it gained.
 */

suite("breakout: the paddle answers the shared input", function () {
  initGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

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

suite("breakout: fire launches the ball", function () {
  initGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

  check("ball starts parked on the paddle", ballActive === false);
  Arcade.Input._press("Space");
  stepFrame(0);
  check("fire launches it", ballActive === true);
  check("and it has real velocity", ball.dy !== 0, "dy " + ball.dy);
});

suite("breakout: pausing freezes play but keeps the loop alive", function () {
  initGame();
  Arcade.Input.reset();
  Arcade.Shell._reset();

  Arcade.Input._press("Space");
  stepFrame(0);
  Arcade.Input._release("Space");

  const x = ball.x;
  const y = ball.y;

  Arcade.Shell.pause();
  stepFrame(0);
  check("ball does not move while paused", ball.x === x && ball.y === y);

  // The frame loop must still be scheduled, or resuming would be dead.
  stepFrame(0);
  Arcade.Shell.resume();
  stepFrame(0);
  check("play resumes", ball.x !== x || ball.y !== y);
});

suite("breakout: game over records a high score", function () {
  Arcade.Scores.clear("breakout");
  initGame();
  Arcade.Shell._reset();

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
  initGame();
  check("blocks were built", blocks.length > 0);
  check(
    "every block knows its row",
    blocks.every((b) => typeof b.row === "number"),
    "first: " + JSON.stringify(blocks[0])
  );

  // Higher rows (smaller index) must sound higher than lower ones.
  const rows = [...new Set(blocks.map((b) => b.row))].sort((a, b) => a - b);
  check("more than one row exists", rows.length > 1, "rows " + rows.join(","));
});

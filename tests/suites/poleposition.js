/**
 * fakepoleposition - end of race and engine-sound lifecycle.
 */

/**
 * Fills the score table so a finish does not open the initials prompt.
 * That prompt is modal and swallows keys - including the R that restarts -
 * so every suite that is not about high scores keeps it out of the way.
 */
function blockHighScore() {
  Arcade.Scores.clear("poleposition");
  for (let i = 0; i < 5; i++) Arcade.Scores.submit("poleposition", "ZZZ", 9999999);
}

/** Starts a race and skips the grid countdown. */
function greenFlag() {
  blockHighScore();
  startGame();
  countdownActive = false;
  raceStarted = true;
  Sound.startEngine();
}

/** Drives the player over the start/finish line once. */
function crossTheLine() {
  playerZ = segments.length * SEGMENT_LENGTH - 100;
  speed = 5000;
  update(1);
}

suite("poleposition: the race can be finished and restarted", function () {
  greenFlag();
  playerLap = TOTAL_LAPS;
  crossTheLine();

  check("race is marked finished", raceFinished === true);
  check(
    "results panel is shown",
    document.getElementById("results").style.display === "flex"
  );
  check(
    "results name the finish",
    document.getElementById("results").innerHTML.indexOf("FINISH") !== -1
  );
  check(
    "results tell the player how to restart",
    document.getElementById("results").innerHTML.indexOf("PRESS R") !== -1
  );
  check("engine is silenced at the finish", Sound.engineOsc === null);

  // The sim must be frozen, not merely hidden.
  const frozenZ = playerZ;
  update(1);
  check("simulation is frozen after the finish", playerZ === frozenZ);

  // R gets you back on the grid.
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  check("R clears the finished state", raceFinished === false);
  check("R resets the lap counter", playerLap === 1);
  check(
    "R hides the results panel",
    document.getElementById("results").style.display === "none"
  );
});

suite("poleposition: the engine stops when it should", function () {
  greenFlag();
  check("engine runs once the race is under way", Sound.engineOsc !== null);

  crash(null);
  check("a crash cuts the engine", Sound.engineOsc === null);

  // Let the wreck clear.
  crashTimer = 0.0001;
  update(1);
  check("crash resolves", isCrashed === false);
  check("engine returns after the wreck clears", Sound.engineOsc !== null);
});

suite("poleposition: starting an engine twice does not stack oscillators", function () {
  greenFlag();
  const first = Sound.engineOsc;
  Sound.startEngine();
  check("second startEngine is a no-op", Sound.engineOsc === first);

  Sound.stopEngine();
  check("stopEngine clears the oscillator", Sound.engineOsc === null);
  check("stopEngine clears the gain node", Sound.engineGain === null);
});

suite("poleposition: lap times are recorded across the race", function () {
  greenFlag();
  playerLap = 1;
  playerLapTimes = [];
  playerBestLap = null;

  gameTime = 42.5;
  crossTheLine();
  check("a completed lap is recorded", playerLapTimes.length === 1, "got " + playerLapTimes.length);
  check("lap counter advanced", playerLap === 2, "lap " + playerLap);
  check("best lap is tracked", playerBestLap !== null);
});

/* -------------------------------------------------------- the race clock --- */

suite("poleposition: the clock runs down while you drive", function () {
  greenFlag();
  check("the race starts with a full clock", raceTime === RACE_START_TIME, "got " + raceTime);

  speed = 5000;
  update(1);
  check("a second off the clock", Math.abs(raceTime - (RACE_START_TIME - 1)) < 0.01, "got " + raceTime);
  check("the HUD shows it", document.getElementById("raceClock").innerText === "89",
        document.getElementById("raceClock").innerText);
});

suite("poleposition: distance pays as you drive", function () {
  greenFlag();
  score = 0;
  speed = 6000;
  update(1);
  check("driving scores", score > 0, "score " + score);

  const after = score;
  speed = 0;
  update(1);
  check("standing still does not", score === after, "score " + score);
});

suite("poleposition: getting round the lap buys more clock", function () {
  greenFlag();
  playerLap = 1;
  raceTime = 20;
  score = 0;

  crossTheLine();

  check("time was extended", raceTime > 20 + LAP_EXTENSION - 2, "got " + raceTime);
  check("the lap paid a bonus", score >= LAP_BONUS, "score " + score);
  check("the race is not over", raceFinished === false);
});

suite("poleposition: running out of time ends the race where you stand", function () {
  greenFlag();
  playerLap = 1;
  raceTime = 0.5;

  update(1);

  check("the race ended", raceFinished === true);
  check("and it ended on the clock, not the line", finishReason === "timeup", finishReason);
  check("the clock does not go negative", raceTime === 0, "got " + raceTime);
  check("the engine stopped", Sound.engineOsc === null);

  const results = document.getElementById("results");
  check("the panel says TIME UP", results.innerHTML.indexOf("TIME UP") !== -1);
  check("and not FINISH", results.innerHTML.indexOf(">FINISH<") === -1);
});

suite("poleposition: finishing pays out the clock, timing out does not", function () {
  // Finish the distance with time to spare.
  greenFlag();
  playerLap = TOTAL_LAPS;
  raceTime = 40;
  score = 0;
  crossTheLine();

  check("that was a finish", finishReason === "finish", finishReason);
  check(
    "leftover time paid out",
    score >= 40 * TIME_BONUS_PER_SEC,
    "score " + Math.floor(score)
  );
  const finishScore = score;

  // Now run the clock out instead.
  greenFlag();
  playerLap = 1;
  raceTime = 0.5;
  score = 0;
  update(1);

  check("that was a timeout", finishReason === "timeup", finishReason);
  check("no time bonus for timing out", score < finishScore, "score " + Math.floor(score));
});

suite("poleposition: the clock warns you when it is nearly gone", function () {
  greenFlag();
  const clock = document.getElementById("raceClock");

  raceTime = LOW_TIME_WARNING + 5;
  updateRaceClock(0);
  check("no warning with time in hand", clock.classList.contains("low") === false);

  raceTime = LOW_TIME_WARNING - 1;
  updateRaceClock(0);
  check("warning when it runs low", clock.classList.contains("low") === true);
});

suite("poleposition: the race only ends once", function () {
  greenFlag();
  playerLap = 1;
  raceTime = 0.1;

  update(1);
  const firstReason = finishReason;
  const firstScore = score;

  update(1);
  update(1);
  check("the reason does not change", finishReason === firstReason);
  check("and the score is not paid twice", score === firstScore, "score " + score);
});

suite("poleposition: a finished race records a high score", function () {
  greenFlag();
  Arcade.Scores.clear("poleposition"); // after greenFlag, which seeds the table
  playerLap = TOTAL_LAPS;
  raceTime = 10;
  score = 0;
  crossTheLine();

  check(
    "the prompt is open",
    document.querySelector(".arcade-initials") !== null
  );

  for (const key of ["P", "O", "L"]) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true }));
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  const table = Arcade.Scores.top("poleposition");
  check("a score was stored", table.length === 1, JSON.stringify(table));
  check("initials stored", table.length === 1 && table[0].name === "POL", JSON.stringify(table));
  check("the board is on the start screen",
        document.getElementById("highScores").textContent.indexOf("POL") !== -1);
});

suite("poleposition: restarting resets the clock and the score", function () {
  greenFlag();
  raceTime = 5;
  score = 9999;
  playerLap = 2;

  startGame();

  check("clock is back to full", raceTime === RACE_START_TIME, "got " + raceTime);
  check("score is cleared", score === 0, "got " + score);
  check("lap counter is back to one", playerLap === 1);
  check("the low warning is cleared",
        document.getElementById("raceClock").classList.contains("low") === false);
});

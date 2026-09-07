/**
 * fakepoleposition - end of race and engine-sound lifecycle.
 */

/** Starts a race and skips the grid countdown. */
function greenFlag() {
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

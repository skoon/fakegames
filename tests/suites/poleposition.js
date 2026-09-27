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

/**
 * Starts a race and skips the grid countdown.
 *
 * Also unpauses: suites dispatch keys straight at window, where the initials
 * prompt cannot stop the shell seeing them, so typing "P" as an initial pauses
 * the game for every suite after it. A real keypress targets the page and is
 * stopped in the capture phase, so this is a test-only leak.
 */
function greenFlag() {
  Arcade.Shell._reset();
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

/* ------------------------------------------------------------ collision --- */

/** Clears traffic and parks one car `dz` ahead of the camera at `offset`. */
function parkCar(dz, offset) {
  for (const seg of segments) seg.cars.length = 0;
  cars.length = 0;
  const car = { offset: offset, z: playerZ + dz, speed: 0, color: "#00FFFF" };
  cars.push(car);
  findSegment(car.z).cars.push(car);
  return car;
}

/** Renders one frame and returns the box renderCar drew for the (only) car. */
function drawnBox() {
  let box = null;
  const real = renderCar;
  renderCar = function (x, y, scale, color, lean) {
    // carBox is where renderCar itself gets the sprite's footprint.
    if (!(y < 0 || y > height || scale <= 0)) box = carBox(x, y, scale);
    real(x, y, scale, color, lean);
  };
  render();
  renderCar = real;
  return box;
}

const PLAYER_BOX = () => ({
  left: width / 2 - PLAYER_SPRITE.halfWidth,
  right: width / 2 + PLAYER_SPRITE.halfWidth,
  topY: height - PLAYER_SPRITE.top,
  rearY: height - PLAYER_SPRITE.bottom,
});

suite("poleposition: you only hit a car you can see", function () {
  greenFlag();
  playerZ = 50 * SEGMENT_LENGTH;
  playerX = 0;

  // A parked car straight ahead, well up the road. Drive into it.
  parkCar(3000, 0);
  let crashedAt = null;
  for (let i = 0; i < 400 && !isCrashed; i++) {
    const box = drawnBox(); // what was on screen going into this frame
    speed = 3000;
    update(1 / 60);
    if (isCrashed) crashedAt = box;
  }

  check("the crash happened", isCrashed === true);
  check("the car was on screen when it hit", crashedAt !== null, "it had already left the bottom of the view");
  const p = PLAYER_BOX();
  check(
    "its back had reached the nose of the player's car",
    crashedAt !== null && crashedAt.rearY >= p.topY - 12,
    crashedAt ? "rear at y " + Math.round(crashedAt.rearY) + ", nose at y " + p.topY : ""
  );
});

suite("poleposition: collision matches what is drawn", function () {
  greenFlag();
  playerZ = 50 * SEGMENT_LENGTH;
  playerX = 0;
  const p = PLAYER_BOX();

  const mismatches = [];
  let touching = 0;
  let clear = 0;

  // Cars from well up the road down to level with the player, across the road.
  for (let seg = 3; seg <= 9; seg++) {
    for (let offset = -1.2; offset <= 1.2001; offset += 0.05) {
      parkCar(seg * SEGMENT_LENGTH + SEGMENT_LENGTH / 2, offset);
      const box = drawnBox();
      if (!box || box.rearY > p.rearY) continue; // only cars at or ahead of the player

      const overlapX = Math.min(box.right, p.right) - Math.max(box.left, p.left);
      const overlapY = box.rearY - p.topY;
      // Too close to the edge to call either way from pixels.
      if (Math.abs(overlapX) < 6 || Math.abs(overlapY) < 6) continue;

      const looksLikeContact = overlapX > 0 && overlapY > 0;
      const gameSaysCrash = collides(cars[0]);
      if (looksLikeContact) touching++;
      else clear++;
      if (looksLikeContact !== gameSaysCrash) {
        mismatches.push(
          "offset " + offset.toFixed(2) + " seg " + seg + ": " +
          (looksLikeContact ? "touching but no crash" : "crash with a gap")
        );
      }
    }
  }

  check("the sweep saw both touching and clear cars", touching > 5 && clear > 5, touching + " touching, " + clear + " clear");
  check(
    "every drawn contact is a crash, and every gap is not",
    mismatches.length === 0,
    mismatches.length + " disagree, e.g. " + mismatches.slice(0, 3).join(" | ")
  );
});

suite("poleposition: a fast frame cannot drive straight through a car", function () {
  greenFlag();
  playerZ = 50 * SEGMENT_LENGTH;
  playerX = 0;
  parkCar(1800, 0);

  // One long frame at top speed: the player ends up well past the car.
  speed = maxSpeed;
  keyFaster = true;
  update(0.5);

  check("it still counts as a crash", isCrashed === true);
});

suite("poleposition: a car in the next lane is not a crash", function () {
  greenFlag();
  playerZ = 50 * SEGMENT_LENGTH;
  playerX = 0;
  // Level with the player, one lane across: close, but clearly not touching.
  parkCar(5 * SEGMENT_LENGTH + SEGMENT_LENGTH / 2, 0.66);
  speed = 0;
  update(1 / 60);
  check("no crash", isCrashed === false);
});

suite("poleposition: an AI car level with the player is drawn the same size", function () {
  greenFlag();
  playerZ = 50 * SEGMENT_LENGTH;
  playerX = 0;

  // Put a car's rear wheels exactly where the player's are, one lane over so
  // it is not a crash, and measure both.
  const car = parkCar(0, 0.9);
  const rear = playerZ + playerRearZ();
  car.z = rear - SEGMENT_LENGTH / 2; // renderCar draws at its segment's middle
  findSegment(car.z).cars.push(car);
  for (const seg of segments) if (seg !== findSegment(car.z)) seg.cars.length = 0;

  const box = drawnBox();
  const p = PLAYER_BOX();
  check("the car was drawn", box !== null);
  const aiWidth = box.right - box.left;
  const playerWidth = p.right - p.left;
  check(
    "same width across the wheels, within a segment's worth of depth",
    Math.abs(aiWidth - playerWidth) / playerWidth < 0.12,
    "AI " + aiWidth.toFixed(0) + "px vs player " + playerWidth.toFixed(0) + "px"
  );
});

/* ----------------------------------------------------------- car sprites --- */

function pixelAt(canvas, x, y) {
  return Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3)).join(",");
}

function rgbOf(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
}

/** Leftmost column in the sprite that holds the helmet colour. */
function helmetLeft(canvas) {
  const want = rgbOf(CAR_COLORS.helmet);
  for (let x = 0; x < CAR_MAP_W; x++)
    for (let y = 0; y < CAR_MAP_H; y++) if (pixelAt(canvas, x, y) === want) return x;
  return -1;
}

suite("poleposition cars: every variant is a 44x20 sprite", function () {
  let bad = null;
  for (const livery of Object.keys(LIVERIES))
    for (const lean of [-1, 0, 1])
      for (const tread of [0, 1])
        for (const brake of [false, true]) {
          const c = carSprite(livery, lean, tread, brake);
          if (c.width !== CAR_MAP_W || c.height !== CAR_MAP_H) bad = livery + " " + lean + " " + c.width + "x" + c.height;
        }
  check("all variants are the same size", bad === null, bad);
  check("and that size is 44x20", CAR_MAP_W === 44 && CAR_MAP_H === 20);
  check("they are cached, not redrawn", carSprite("player", 0, 0, false) === carSprite("player", 0, 0, false));
});

suite("poleposition cars: the car leans the way you steer", function () {
  const straight = helmetLeft(carSprite("player", 0, 0, false));
  check("the helmet is drawn", straight >= 0);
  check("steering left moves the top of the car left", helmetLeft(carSprite("player", -1, 0, false)) < straight);
  check("steering right moves it right", helmetLeft(carSprite("player", 1, 0, false)) > straight);

  greenFlag();
  keyLeft = true; keyRight = false; keySlower = false;
  check("holding left picks the left lean", playerCarFrame().lean === -1);
  keyLeft = false; keyRight = true;
  check("holding right picks the right lean", playerCarFrame().lean === 1);
  keyRight = false;
  check("hands off, it sits straight", playerCarFrame().lean === 0);
});

suite("poleposition cars: brake lights come on only while braking", function () {
  const [lx, ly] = TAIL_LIGHT;
  check("off when not braking", pixelAt(carSprite("player", 0, 0, false), lx, ly) === rgbOf(CAR_COLORS.tailLight));
  check("on when braking", pixelAt(carSprite("player", 0, 0, true), lx, ly) === rgbOf(CAR_COLORS.brakeLight));

  greenFlag();
  keySlower = true;
  check("the player's frame follows the brake key", playerCarFrame().brake === true);
  keySlower = false;
  check("and lets go", playerCarFrame().brake === false);
});

suite("poleposition cars: the tyres roll with distance", function () {
  greenFlag();
  playerZ = 1000;
  const a = playerCarFrame().tread;
  playerZ += TREAD_STEP;
  const b = playerCarFrame().tread;
  check("moving one tread step changes the frame", a !== b);
  check("the two phases look different",
    pixelAt(carSprite("player", 0, 0, false), 2, 8) !== pixelAt(carSprite("player", 0, 1, false), 2, 8) ||
    pixelAt(carSprite("player", 0, 0, false), 2, 9) !== pixelAt(carSprite("player", 0, 1, false), 2, 9));
});

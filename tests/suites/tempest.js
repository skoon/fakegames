/**
 * faketempest - audio context reuse and frame-rate independence.
 */

suite("tempest: one AudioContext for the whole session", function () {
  check(
    "no context built before the first sound",
    audioBook.contextsCreated === 0,
    "got " + audioBook.contextsCreated
  );

  for (let i = 0; i < 500; i++) playSound(440 + i, 0.1, "square");

  check(
    "500 sounds create exactly one AudioContext",
    audioBook.contextsCreated === 1,
    "created " + audioBook.contextsCreated
  );
  check(
    "the shared context is reused, not replaced",
    typeof getAudioContext === "function" && getAudioContext() === getAudioContext()
  );

  // A suspended context must be resumed rather than thrown away.
  getAudioContext().state = "suspended";
  playSound(880, 0.1);
  check(
    "suspended context is resumed, not rebuilt",
    audioBook.contextsCreated === 1 && getAudioContext().state === "running",
    "created " + audioBook.contextsCreated
  );
});

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

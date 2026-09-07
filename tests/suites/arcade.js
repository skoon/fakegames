/**
 * The shared arcade module.
 *
 * These assertions used to live in the Tempest suite, back when Tempest owned
 * its own audio context. The context bug is now the module's to get right.
 */

suite("arcade.Audio: one context for the whole session", function () {
  check(
    "no context until something makes a sound",
    audioBook.contextsCreated === 0,
    "got " + audioBook.contextsCreated
  );

  for (let i = 0; i < 500; i++) Arcade.Audio.tone(440 + i, { duration: 0.05 });

  check(
    "500 tones create exactly one AudioContext",
    audioBook.contextsCreated === 1,
    "created " + audioBook.contextsCreated
  );

  Arcade.Audio.noise({ duration: 0.1 });
  check(
    "noise shares the same context",
    audioBook.contextsCreated === 1,
    "created " + audioBook.contextsCreated
  );

  // A suspended context must be resumed, never replaced.
  Arcade.Audio.context().state = "suspended";
  Arcade.Audio.tone(880);
  check(
    "a suspended context is resumed, not rebuilt",
    audioBook.contextsCreated === 1 && Arcade.Audio.context().state === "running",
    "created " + audioBook.contextsCreated
  );
});

suite("arcade.Audio: mute is a single knob", function () {
  check("starts unmuted", Arcade.Audio.isMuted() === false);
  check("toggle mutes", Arcade.Audio.toggleMute() === true);
  check("reports muted", Arcade.Audio.isMuted() === true);
  check("toggle unmutes", Arcade.Audio.toggleMute() === false);

  Arcade.Audio.mute(true);
  check("explicit mute sticks", Arcade.Audio.isMuted() === true);
  Arcade.Audio.mute(false);
  check("explicit unmute sticks", Arcade.Audio.isMuted() === false);
});

suite("arcade.Audio: music loops can change tempo while running", function () {
  const music = Arcade.Audio.loop({ notes: [110, 130, 110, 98], tempo: 400 });
  check("starts stopped", music.isPlaying() === false);
  music.start();
  check("start runs it", music.isPlaying() === true);
  music.setTempo(120);
  check("still running after a tempo change", music.isPlaying() === true);
  music.stop();
  check("stop halts it", music.isPlaying() === false);
  music.stop();
  check("stopping twice is harmless", music.isPlaying() === false);
});

suite("arcade.Input: held and justPressed", function () {
  Arcade.Input.reset();

  check("nothing held initially", Arcade.Input.held("left") === false);

  Arcade.Input._press("ArrowLeft");
  check("arrow registers as left", Arcade.Input.held("left") === true);
  check("WASD is an alias, not a separate action", Arcade.Input.held("right") === false);

  Arcade.Input._press("KeyD");
  check("KeyD registers as right", Arcade.Input.held("right") === true);

  Arcade.Input._release("ArrowLeft");
  check("release clears held", Arcade.Input.held("left") === false);

  // justPressed consumes, so the second read in the same press is false.
  Arcade.Input.reset();
  Arcade.Input._press("Space");
  check("fire edge is seen once", Arcade.Input.justPressed("fire") === true);
  check("and not twice for one press", Arcade.Input.justPressed("fire") === false);

  // Holding does not re-trigger; releasing and pressing again does.
  Arcade.Input._press("Space");
  check("auto-repeat does not re-fire", Arcade.Input.justPressed("fire") === false);
  Arcade.Input._release("Space");
  Arcade.Input._press("Space");
  check("a fresh press fires again", Arcade.Input.justPressed("fire") === true);
});

suite("arcade.Input: rebinding and disabling", function () {
  Arcade.Input.reset();
  Arcade.Input.bind({ fire: ["KeyZ"] });
  Arcade.Input._press("KeyZ");
  check("rebound key fires", Arcade.Input.justPressed("fire") === true);

  Arcade.Input.reset();
  Arcade.Input._press("Space");
  check("reset restores the default binding", Arcade.Input.justPressed("fire") === true);

  // While an overlay owns the keyboard the game must see nothing.
  Arcade.Input.setEnabled(false);
  Arcade.Input._press("ArrowLeft");
  check("disabled input reports nothing held", Arcade.Input.held("left") === false);
  Arcade.Input.setEnabled(true);
  check("re-enabling does not resurrect stale presses", Arcade.Input.held("left") === false);
});

suite("arcade.Scores: table keeps the best five", function () {
  Arcade.Scores.clear("testgame");
  check("starts empty", Arcade.Scores.top("testgame").length === 0);
  check("best of an empty table is 0", Arcade.Scores.best("testgame") === 0);
  check("format says so", Arcade.Scores.format("testgame") === "NO SCORES YET");

  Arcade.Scores.submit("testgame", "AAA", 100);
  Arcade.Scores.submit("testgame", "BBB", 300);
  Arcade.Scores.submit("testgame", "CCC", 200);

  const table = Arcade.Scores.top("testgame");
  check("three rows stored", table.length === 3, "got " + table.length);
  check("sorted high to low", table[0].score === 300 && table[2].score === 100);
  check("best reports the top row", Arcade.Scores.best("testgame") === 300);

  Arcade.Scores.submit("testgame", "DDD", 50);
  Arcade.Scores.submit("testgame", "EEE", 400);
  Arcade.Scores.submit("testgame", "FFF", 500);

  const full = Arcade.Scores.top("testgame");
  check("table caps at five", full.length === Arcade.Scores.SIZE, "got " + full.length);
  check("the weakest score fell off", full.every((r) => r.score !== 50));
});

suite("arcade.Scores: qualifying", function () {
  Arcade.Scores.clear("qual");
  check("any positive score qualifies while there is room", Arcade.Scores.qualifies("qual", 1));
  check("zero never qualifies", Arcade.Scores.qualifies("qual", 0) === false);
  check("nonsense never qualifies", Arcade.Scores.qualifies("qual", NaN) === false);

  for (let i = 1; i <= 5; i++) Arcade.Scores.submit("qual", "AAA", i * 100);

  check("beating the last row qualifies", Arcade.Scores.qualifies("qual", 150) === true);
  check("tying the last row does not", Arcade.Scores.qualifies("qual", 100) === false);
  check("missing the table does not", Arcade.Scores.qualifies("qual", 50) === false);
});

suite("arcade.Scores: names and isolation", function () {
  Arcade.Scores.clear("names");
  Arcade.Scores.submit("names", "scott", 10);
  check("initials are upper-cased", Arcade.Scores.top("names")[0].name === "SCO");

  Arcade.Scores.submit("names", "", 20);
  check("a missing name falls back", Arcade.Scores.top("names")[0].name === "---");

  Arcade.Scores.clear("gameA");
  Arcade.Scores.clear("gameB");
  Arcade.Scores.submit("gameA", "AAA", 999);
  check("tables do not leak between games", Arcade.Scores.top("gameB").length === 0);
  check("and the original survives", Arcade.Scores.top("gameA").length === 1);
});

suite("arcade.Shell: pause state and the pause-aware clock", function () {
  Arcade.Shell.init({ game: "testgame", back: false });
  Arcade.Shell._reset();

  check("starts unpaused", Arcade.Shell.paused === false);
  Arcade.Shell.pause();
  check("pause takes", Arcade.Shell.paused === true);
  Arcade.Shell.pause();
  check("pausing twice is harmless", Arcade.Shell.paused === true);
  Arcade.Shell.resume();
  check("resume takes", Arcade.Shell.paused === false);
  Arcade.Shell.togglePause();
  check("toggle pauses", Arcade.Shell.paused === true);
  Arcade.Shell.togglePause();
  check("toggle resumes", Arcade.Shell.paused === false);
});

suite("arcade.Shell: the clock stands still while paused", function () {
  Arcade.Shell._reset();

  const before = Arcade.Shell.now();
  Arcade.Shell.pause();

  // Burn real wall-clock time while paused.
  const spinUntil = Date.now() + 25;
  while (Date.now() < spinUntil) {
    /* spin */
  }

  const during = Arcade.Shell.now();
  check(
    "now() does not advance during a pause",
    Math.abs(during - before) <= 2,
    "drifted " + (during - before) + "ms"
  );
  check("paused time is accounted for", Arcade.Shell.pausedTotal() >= 20);

  Arcade.Shell.resume();
  check("clock resumes", Arcade.Shell.now() >= during);
});

suite("arcade.Shell: pause and resume notify the game", function () {
  let paused = 0;
  let resumed = 0;

  // Phaser games need the callback form; re-init to install handlers.
  Arcade.Shell.init({
    game: "testgame",
    back: false,
    onPause: () => paused++,
    onResume: () => resumed++,
  });
  Arcade.Shell._reset();

  Arcade.Shell.pause();
  check("onPause fired", paused === 1, "fired " + paused);
  Arcade.Shell.pause();
  check("no duplicate onPause for a repeat call", paused === 1, "fired " + paused);
  Arcade.Shell.resume();
  check("onResume fired", resumed === 1, "fired " + resumed);
});

suite("arcade.Audio: custom graphs can route through the mute knob", function () {
  const out = Arcade.Audio.output();
  check("output node exists", !!out);
  check("it is stable across calls", Arcade.Audio.output() === out);
  check(
    "asking for output does not spawn another context",
    audioBook.contextsCreated === 1,
    "created " + audioBook.contextsCreated
  );
});

/* ------------------------------------------------------------------ fit --- */

function sizedBox(w, h) {
  const el = document.createElement("div");
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.position = "absolute";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  return el;
}

function scaleOf(el) {
  const m = /scale\(([\d.]+)\)/.exec(el.style.transform || "");
  return m ? parseFloat(m[1]) : null;
}

suite("arcade.Shell.fit: shrinks what is too big, leaves the rest alone", function () {
  const small = sizedBox(50, 50);
  small.id = "fit-small";
  Arcade.Shell.fit("#fit-small");
  check("a small game is not scaled", scaleOf(small) === 1, "scale " + scaleOf(small));

  const huge = sizedBox(window.innerWidth * 4, window.innerHeight * 4);
  huge.id = "fit-huge";
  Arcade.Shell.fit("#fit-huge");
  const s = scaleOf(huge);
  check("an oversized game is scaled down", s !== null && s < 1, "scale " + s);
  check("and not scaled to nothing", s > 0, "scale " + s);
  check("it scales about its centre", huge.style.transformOrigin === "center center");

  small.remove();
  huge.remove();
});

suite("arcade.Shell.fit: refuses to scale the page itself", function () {
  // The back link and pause overlay are position:fixed children of body.
  // Transforming body would reparent them to it and break both.
  check("body is refused", Arcade.Shell.fit("body") === null);
  check("html is refused", Arcade.Shell.fit("html") === null);
  check("body was left untouched", !document.body.style.transform);
});

suite("arcade.Shell.fit: is safe on a selector that matches nothing", function () {
  check("returns null rather than throwing", Arcade.Shell.fit("#nothing-here") === null);
});

suite("arcade.Shell.fit: re-measures instead of compounding", function () {
  const box = sizedBox(window.innerWidth * 3, window.innerHeight * 3);
  box.id = "fit-again";

  const apply = Arcade.Shell.fit("#fit-again");
  const first = scaleOf(box);

  apply();
  apply();
  const third = scaleOf(box);

  check(
    "applying repeatedly gives the same scale",
    Math.abs(third - first) < 0.0001,
    first + " then " + third
  );
  box.remove();
});

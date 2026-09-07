/**
 * fakespyhunter - the retrofit of the one cabinet whose scores and mute
 * already worked. These assert the behaviour survived the move to arcade/.
 */

function freshScene() {
  const scene = new GameScene();
  scene.create();
  return scene;
}

suite("spyhunter: mute runs through the shared knob", function () {
  Arcade.Audio.mute(false);
  const scene = freshScene();

  check("starts unmuted", scene.muted === false);
  check("button says MUTE", scene.muteButton.text !== "UNMUTE");

  scene.toggleMute();
  check("toggling mutes the whole cabinet", Arcade.Audio.isMuted() === true);
  check("scene agrees", scene.muted === true);

  scene.toggleMute();
  check("toggling again unmutes", Arcade.Audio.isMuted() === false);

  // The shared M key can change it behind the scene's back; the label must
  // catch up rather than lie.
  Arcade.Audio.mute(true);
  scene.syncMuteButton();
  check("label follows an external mute", scene.muted === true);
  Arcade.Audio.mute(false);
});

suite("spyhunter: high scores go through Arcade.Scores", function () {
  Arcade.Scores.clear("spyhunter");
  const scene = freshScene();

  scene.score = 7777;
  scene.showGameOver();

  check("game is over", scene.gameOver === true);
  check(
    "the shared prompt is open",
    document.querySelector(".arcade-initials") !== null
  );

  for (const key of ["S", "P", "Y"]) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true }));
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  const table = Arcade.Scores.top("spyhunter");
  check("score stored", table.length === 1 && table[0].score === 7777, JSON.stringify(table));
  check("initials stored", table.length === 1 && table[0].name === "SPY", JSON.stringify(table));
});

suite("spyhunter: a score that misses the table does not prompt", function () {
  Arcade.Scores.clear("spyhunter");
  for (let i = 1; i <= 5; i++) Arcade.Scores.submit("spyhunter", "AAA", i * 10000);

  const scene = freshScene();
  scene.score = 5; // nowhere near the board
  scene.showGameOver();

  check(
    "no prompt for a non-qualifying score",
    document.querySelector(".arcade-initials") === null
  );
  check("the table is untouched", Arcade.Scores.top("spyhunter").length === 5);
});

suite("spyhunter: the shell can suspend the Phaser scene", function () {
  const scene = freshScene();
  Arcade.Shell._reset();

  // create() registers this scene's pause handlers with the shell.
  Arcade.Shell.pause();
  check("scene was paused", scene.scene.paused === true);

  Arcade.Shell.resume();
  check("scene was resumed", scene.scene.paused === false);
});

suite("spyhunter: the start overlay exists and startGame tears it down", function () {
  const scene = freshScene();

  check("game does not run before start", scene.started === false);
  check("overlay was built", !!scene.startOverlay);
  check("title was built", !!scene.startTitle);
  check("hint was built", !!scene.startHint);
  check("score board was built", !!scene.startHighText);

  // This is what SPACE does. It used to throw when the overlay was missing.
  scene.startGame();

  check("game is running", scene.started === true);
  check("overlay was destroyed", scene.startOverlay.destroyed === true);
  check("title was destroyed", scene.startTitle.destroyed === true);
});

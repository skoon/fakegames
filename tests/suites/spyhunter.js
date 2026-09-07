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

/* -------------------------------------------------------- the weapons van --- */

/** A stand-in enemy the hazard and missile maths can find. */
function putEnemy(scene, x, y) {
  const enemy = {
    x: x,
    y: y,
    active: true,
    destroy() {
      this.active = false;
    },
  };
  scene.enemies.add(enemy);
  return enemy;
}

function vanReady(scene) {
  scene.started = true;
  scene.spawnVan();
  scene.van.y = VAN.holdY;
  scene.van.state = "open";
  return scene.van;
}

suite("spyhunter: the van turns up on a timer and opens its ramp", function () {
  const scene = freshScene();
  scene.started = true;

  check("no van to begin with", scene.van === null);
  check("but one is due", scene.nextVan === VAN.firstAt);

  scene.nextVan = 10;
  scene.updateVan(0.02);
  check("it arrives when due", scene.van !== null);
  check("and it starts up the road, off screen", scene.van.y < 0, "y " + scene.van.y);
  check("with the ramp still shut", scene.van.state === "arriving");

  // Let it drive into position.
  let guard = 500;
  while (scene.van.state === "arriving" && guard-- > 0) scene.updateVan(0.05);
  check("it settles into position", scene.van.state === "open", scene.van.state);
  check("holding station ahead of the player", scene.van.y === VAN.holdY, "y " + scene.van.y);
  check("and it tells you what to do", scene.vanHint.text !== "");
});

suite("spyhunter: driving into the ramp boards the van", function () {
  const scene = freshScene();
  const van = vanReady(scene);

  // Line up dead on the ramp.
  scene.carX = van.x;
  scene.carY = scene.vanRearY();
  scene.checkBoarding();

  check("the player is boarding", scene.playerState === "boarding");
  check("the car is hidden", scene.player.visible === false);
  check("the van pulls away", van.state === "leaving");
  check("the prompt is cleared", scene.vanHint.text === "");
});

suite("spyhunter: you have to line up with the ramp", function () {
  const scene = freshScene();
  const van = vanReady(scene);

  // Right height, well off to the side.
  scene.carX = van.x + VAN.entryW;
  scene.carY = scene.vanRearY();
  scene.checkBoarding();
  check("missing sideways does not board", scene.playerState === "driving");

  // Lined up, but nowhere near it.
  scene.carX = van.x;
  scene.carY = scene.vanRearY() + 200;
  scene.checkBoarding();
  check("being too far back does not board", scene.playerState === "driving");
});

suite("spyhunter: the van gives up and leaves if ignored", function () {
  const scene = freshScene();
  const van = vanReady(scene);

  van.openTimer = 10;
  scene.updateVan(0.05);
  check("the ramp comes up", van.state === "leaving", van.state);

  let guard = 500;
  while (scene.van && guard-- > 0) scene.updateVan(0.05);
  check("and it is gone", scene.van === null);
  check("the prompt goes with it", scene.vanHint.text === "");
});

suite("spyhunter: you come out of the van armed", function () {
  const scene = freshScene();
  vanReady(scene);

  scene.carX = scene.van.x;
  scene.carY = scene.vanRearY();
  scene.checkBoarding();

  check("no weapon on the way in", scene.weapon === null);

  scene.boardTimer = 1;
  scene.finishBoarding();

  check("back to driving", scene.playerState === "driving");
  check("the car is visible again", scene.player.visible === true);
  check("armed with something", scene.weapon !== null, "" + scene.weapon);
  check("and it is a real weapon", WEAPON_KEYS.indexOf(scene.weapon) !== -1);
  check("with ammo", scene.weaponAmmo > 0, "ammo " + scene.weaponAmmo);
  check("and a moment of grace", scene.invulnerable === true);
  check(
    "the HUD names it",
    scene.weaponText.text.indexOf(WEAPONS[scene.weapon].name) !== -1
  );
});

suite("spyhunter: every weapon can come out of the van", function () {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const scene = freshScene();
    scene.finishBoarding();
    seen.add(scene.weapon);
  }
  check("all three turn up", seen.size === WEAPON_KEYS.length, "saw " + [...seen].join(","));
});

suite("spyhunter: an oil slick takes out whatever drives over it", function () {
  const scene = freshScene();
  scene.started = true;
  scene.giveWeapon("oil");
  scene.carX = 240;
  scene.carY = 400;

  check("three slicks to drop", scene.weaponAmmo === 3);
  check("deploying works", scene.deployWeapon() === true);
  check("one is on the road", scene.hazards.length === 1);
  check("dropped behind the car", scene.hazards[0].y > scene.carY);
  check("ammo went down", scene.weaponAmmo === 2, "ammo " + scene.weaponAmmo);

  const victim = putEnemy(scene, scene.hazards[0].x, scene.hazards[0].y);
  const before = scene.score || 0;
  scene.updateHazards(0.001);

  check("the enemy is gone", victim.active === false);
  check("and it scored", (scene.score || 0) > before, "score " + scene.score);
});

suite("spyhunter: a smoke screen also eats what is shot at you", function () {
  const scene = freshScene();
  scene.started = true;
  scene.giveWeapon("smoke");
  scene.carX = 240;
  scene.carY = 400;
  scene.deployWeapon();

  const cloud = scene.hazards[0];
  const shot = {
    x: cloud.x,
    y: cloud.y,
    active: true,
    destroy() {
      this.active = false;
    },
  };
  scene.enemyBullets.add(shot);

  scene.updateHazards(0.001);
  check("the incoming shot was swallowed", shot.active === false);
});

suite("spyhunter: hazards scroll away and expire", function () {
  const scene = freshScene();
  scene.started = true;
  scene.giveWeapon("oil");
  scene.carY = 300;
  scene.deployWeapon();

  const startY = scene.hazards[0].y;
  scene.updateHazards(0.1);
  check("it moves down the road with the tarmac", scene.hazards[0].y > startY);

  scene.hazards[0].life = 1;
  scene.updateHazards(0.05);
  check("and it eventually dries up", scene.hazards.length === 0);
});

suite("spyhunter: missiles go forward and punch through", function () {
  const scene = freshScene();
  scene.started = true;
  scene.giveWeapon("missile");
  scene.carX = 240;
  scene.carY = 500;

  check("five missiles", scene.weaponAmmo === 5);
  scene.deployWeapon();
  check("one is away", scene.missiles.length === 1);
  check("fired ahead of the car", scene.missiles[0].y < scene.carY);

  // Two cars stacked up in its path.
  const missile = scene.missiles[0];
  const first = putEnemy(scene, missile.x, missile.y - 5);
  const second = putEnemy(scene, missile.x, missile.y - 12);
  scene.updateMissiles(0.001);

  check("it took the first", first.active === false);
  check("and the second in the same shot", second.active === false);
  check("the missile keeps going", scene.missiles.length === 1);
});

suite("spyhunter: weapons run out", function () {
  const scene = freshScene();
  scene.started = true;
  scene.giveWeapon("oil");

  check("armed", scene.weapon === "oil");
  scene.deployWeapon();
  scene.deployWeapon();
  scene.deployWeapon();

  check("that was the last one", scene.weapon === null);
  check("ammo is empty", scene.weaponAmmo === 0);
  check("and a fourth press does nothing", scene.deployWeapon() === false);
  check("the HUD clears", scene.weaponText.text === "");
});

suite("spyhunter: with nothing aboard, shift does nothing", function () {
  const scene = freshScene();
  scene.started = true;
  check("unarmed", scene.weapon === null);
  check("deploying is refused", scene.deployWeapon() === false);
  check("nothing was dropped", scene.hazards.length === 0 && scene.missiles.length === 0);
});

suite("spyhunter: the controls are dead while inside the van", function () {
  const scene = freshScene();
  scene.started = true;
  vanReady(scene);

  scene.carX = scene.van.x;
  scene.carY = scene.vanRearY();
  scene.checkBoarding();
  check("boarding", scene.playerState === "boarding");

  // Driving input must not move the car while it is out of sight.
  const x = scene.carX;
  scene.cursors.left.isDown = true;
  scene.update(1000, 16);
  scene.cursors.left.isDown = false;

  check("the car did not move", scene.carX === x, "x " + scene.carX);
  check("still boarding", scene.playerState === "boarding");
});

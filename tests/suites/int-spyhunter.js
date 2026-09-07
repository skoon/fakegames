/**
 * Spy Hunter, end to end: real Phaser, real arcade module, real key events.
 *
 * See int-digdug.js for why this exists. Space-to-start is the symptom that was
 * reported; steering and firing were dead for the same reason.
 */

readyWhen(function () {
  return (
    typeof game !== "undefined" &&
    game.scene.getScene("GameScene") &&
    game.scene.getScene("GameScene").player
  );
});

function scene() {
  return game.scene.getScene("GameScene");
}

function keyDown(code, key) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { code: code, key: key, bubbles: true, cancelable: true })
  );
}

function keyUp(code, key) {
  window.dispatchEvent(
    new KeyboardEvent("keyup", { code: code, key: key, bubbles: true, cancelable: true })
  );
}

suite("spyhunter e2e: space starts the game", function () {
  const s = scene();
  check("not started yet", s.started === false);

  s.update(0, 16);
  check("and a frame alone does not start it", s.started === false);

  keyDown("Space", " ");
  check("the shared input saw the space", Arcade.Input.held("fire") === true);
  s.update(0, 16);
  keyUp("Space", " ");

  check("the game started", s.started === true);
  check("the start overlay was torn down", s.startOverlay.active === false || !s.startOverlay.scene);
});

suite("spyhunter e2e: the car steers", function () {
  const s = scene();
  if (!s.started) s.startGame();
  s.playerState = "driving";

  function travel(code, key, axis, wantLess) {
    const before = s[axis];
    keyDown(code, key);
    for (let i = 0; i < 5; i++) s.update(0, 16);
    keyUp(code, key);
    return wantLess ? s[axis] < before : s[axis] > before;
  }

  check("left steers left", travel("ArrowLeft", "ArrowLeft", "carX", true));
  check("right steers right", travel("ArrowRight", "ArrowRight", "carX", false));
  check("up accelerates up the screen", travel("ArrowUp", "ArrowUp", "carY", true));
  check("down drops back", travel("ArrowDown", "ArrowDown", "carY", false));
  check("A steers left too", travel("KeyA", "a", "carX", true));
  check("D steers right too", travel("KeyD", "d", "carX", false));
});

suite("spyhunter e2e: space fires once the game is running", function () {
  const s = scene();
  if (!s.started) s.startGame();
  s.playerState = "driving";
  s.lastFired = -10000;

  const before = s.bullets.getChildren().length;
  keyDown("Space", " ");
  s.update(1000, 16);
  keyUp("Space", " ");

  check("a bullet was fired", s.bullets.getChildren().length > before,
        before + " -> " + s.bullets.getChildren().length);
});

suite("spyhunter e2e: shift deploys a weapon", function () {
  const s = scene();
  if (!s.started) s.startGame();
  s.playerState = "driving";
  s.hazards = [];
  s.giveWeapon("oil");

  keyDown("ShiftLeft", "Shift");
  s.update(2000, 16);
  keyUp("ShiftLeft", "Shift");

  check("a slick hit the road", s.hazards.length === 1, "got " + s.hazards.length);
  check("ammo came off", s.weaponAmmo === 2, "ammo " + s.weaponAmmo);
});

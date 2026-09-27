/**
 * Dig Dug, end to end: real Phaser, real arcade module, real key events.
 *
 * This exists because 412 stubbed assertions did not notice that both Phaser
 * games had gone completely deaf. `arcade/input.js` calls preventDefault on
 * every bound key, and Phaser's keyboard manager ignores any event that has
 * already been default-prevented, so a game reading Phaser's keyboard saw
 * nothing. The stubs replace Phaser wholesale, so that seam was untested.
 *
 * Nothing here is stubbed. Keys are dispatched at the window the way a keyboard
 * dispatches them.
 */

readyWhen(function () {
  return (
    typeof game !== "undefined" &&
    game.scene.getScene("DigDugScene") &&
    game.scene.getScene("DigDugScene").player
  );
});

function scene() {
  return game.scene.getScene("DigDugScene");
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

/**
 * Past the title screen and into a playable level, with transient state
 * cleared. A pump left running by an earlier suite makes handleInput return
 * early, which reads as "the keys do nothing" — so suites must not leak.
 */
function intoPlay() {
  const s = scene();
  if (s.awaitingStart) {
    keyDown("Space", " ");
    s.update(0, 16);
    keyUp("Space", " ");
  }
  s.isPumping = false;
  s.pumpTimer = 0;
  s.respawnTimer = 0;
  return s;
}

suite("digdug e2e: a real key event reaches the game", function () {
  const s = intoPlay();
  check("the title screen is gone", s.awaitingStart === false);

  keyDown("ArrowLeft", "ArrowLeft");
  check("the shared input saw it", Arcade.Input.held("left") === true);

  const startX = s.player.x;
  for (let i = 0; i < 6; i++) s.update(0, 16);
  keyUp("ArrowLeft", "ArrowLeft");

  check("the player faces left", s.player.facing === "left", s.player.facing);
  check("and actually moved left", s.player.x < startX, startX + " -> " + s.player.x);
});

suite("digdug e2e: every direction works", function () {
  const s = intoPlay();

  function travel(code, axis, wantLess) {
    const before = s.player[axis];
    keyDown(code, code);
    for (let i = 0; i < 6; i++) s.update(0, 16);
    keyUp(code, code);
    const after = s.player[axis];
    return wantLess ? after < before : after > before;
  }

  check("right moves right", travel("ArrowRight", "x", false));
  check("down moves down", travel("ArrowDown", "y", false));
  check("up moves up", travel("ArrowUp", "y", true));
  check("left moves left", travel("ArrowLeft", "x", true));
});

suite("digdug e2e: space fires the pump", function () {
  const s = intoPlay();
  s.isPumping = false;

  keyDown("Space", " ");
  s.update(0, 16);
  keyUp("Space", " ");

  check("the pump went out", s.isPumping === true);
});

suite("digdug e2e: WASD works as well as the arrows", function () {
  const s = intoPlay();

  // Start from the spawn tunnel so the result is about the key, not the dirt
  // the earlier suites happened to leave the player standing in.
  s.player.x = 18 * TILE + TILE / 2;
  s.player.y = 2 * TILE + TILE / 2;
  s.player.gridX = 18;
  s.player.gridY = 2;

  const startX = s.player.x;
  keyDown("KeyD", "d");

  // The seam that broke: does the key reach the shared input at all?
  check("KeyD registers as right", Arcade.Input.held("right") === true);

  for (let i = 0; i < 6; i++) s.update(0, 16);
  keyUp("KeyD", "d");

  check("the game read it", s.player.facing === "right", s.player.facing);
  check(
    "D moves right",
    s.player.x > startX,
    startX + " -> " + s.player.x + " at grid " + s.player.gridX + "," + s.player.gridY
  );
});

suite("digdug e2e: the title screen waits for a real space", function () {
  // Rebuild the title state without restarting the whole scene.
  const s = scene();
  s.awaitingStart = true;
  if (!s.titleParts || !s.titleParts.length) s.buildTitleScreen();

  s.update(0, 16);
  check("still waiting with no key pressed", s.awaitingStart === true);

  keyDown("Space", " ");
  s.update(0, 16);
  keyUp("Space", " ");
  check("a real space starts it", s.awaitingStart === false);
});

suite("digdug e2e: the mole faces the way it digs", function () {
  const s = intoPlay();
  s.player.x = 18 * TILE + TILE / 2;
  s.player.y = 2 * TILE + TILE / 2;
  s.player.gridX = 18;
  s.player.gridY = 2;

  keyDown("ArrowLeft", "ArrowLeft");
  const frames = new Set();
  for (let i = 0; i < 16; i++) {
    s.update(0, 16);
    frames.add(s.playerSpr.texture.key);
  }
  keyUp("ArrowLeft", "ArrowLeft");
  check("left mirrors the sprite", s.playerSpr.flipX === true);
  check("and does not rotate it", s.playerSpr.angle === 0, "angle " + s.playerSpr.angle);
  check("digging animates", frames.size === 2, [...frames].join(","));

  keyDown("ArrowDown", "ArrowDown");
  s.update(0, 16);
  keyUp("ArrowDown", "ArrowDown");
  check("down turns it nose-down", s.playerSpr.angle === 90, "angle " + s.playerSpr.angle);
});

suite("digdug e2e: digging repaints the ground", function () {
  const s = intoPlay();
  check("the terrain is a real texture", game.textures.exists("terrain"));

  // A dirt tile nothing else touches, dug out by hand.
  const r = 10, c = 2; // left edge: no suite digs out here
  check("it starts as dirt", s.grid[r][c] === TILE_DIRT);
  const at = () => Array.from(s.terrainCtx.getImageData(c * TILE + 8, r * TILE + 8, 1, 1).data.slice(0, 3));
  const before = at();

  s.grid[r][c] = TILE_EMPTY;
  s.redrawAround(r, c);
  const after = at();
  check("the pixel changed when it was dug", before.join() !== after.join(), before + " -> " + after);
  check("and it is now tunnel dark", after[0] < 60 && after[1] < 60 && after[2] < 60, "" + after);
});

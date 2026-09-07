/**
 * fakedigdug - enemy lifecycle and scoring.
 */

function freshScene() {
  const scene = new DigDugScene();
  scene.create();
  return scene;
}

suite("digdug: killEnemy removes the enemy, not just its sprite", function () {
  const scene = freshScene();
  const startCount = scene.enemies.length;

  check("level starts with enemies", startCount > 0, "got " + startCount);
  check(
    "arrays start in lockstep",
    scene.enemies.length === scene.enemySprs.length,
    scene.enemies.length + " vs " + scene.enemySprs.length
  );

  // Kill from the middle; the arrays must stay aligned around the hole.
  const victim = scene.enemies[1];
  const survivor = scene.enemies[2];
  const survivorSprite = scene.enemySprs[2];
  scene.killEnemy(victim);

  check(
    "enemy removed from the logic array",
    scene.enemies.length === startCount - 1,
    "length " + scene.enemies.length
  );
  check(
    "sprite array shrank with it",
    scene.enemySprs.length === scene.enemies.length,
    scene.enemySprs.length + " vs " + scene.enemies.length
  );
  check("dead enemy is gone from the array", scene.enemies.indexOf(victim) === -1);
  check(
    "surviving enemy still maps to its own sprite",
    scene.enemies[1] === survivor && scene.enemySprs[1] === survivorSprite
  );
});

suite("digdug: a dead enemy stops being dangerous", function () {
  const scene = freshScene();
  const victim = scene.enemies[1];
  scene.killEnemy(victim);

  // Stand the player exactly where the dead enemy was.
  scene.player.x = victim.x;
  scene.player.y = victim.y;
  scene.player.gridX = victim.gridX;
  scene.player.gridY = victim.gridY;

  let died = false;
  scene.playerDie = () => {
    died = true;
  };
  scene.checkCollisions();
  check("killed enemy no longer kills the player", !died);
});

suite("digdug: a level can actually be completed", function () {
  const scene = freshScene();

  let guard = 100;
  while (scene.enemies.length && guard-- > 0) scene.killEnemy(scene.enemies[0]);

  check("all enemies can be cleared", scene.enemies.length === 0);
  scene.checkLevelComplete();
  check("clearing the field completes the level", scene.levelOver === true);
  check("the next level was scheduled", delayedCalls.length > 0);
});

suite("digdug: kills are scored once, by cause", function () {
  const scene = freshScene();
  const pooka = scene.enemies.find((e) => e.type === "pooka");
  const fygar = scene.enemies.find((e) => e.type === "fygar");

  check("level contains both enemy types", !!pooka && !!fygar);

  scene.score = 0;
  scene.killEnemy(pooka);
  check("pumped pooka scores 500", scene.score === 500, "got " + scene.score);

  scene.score = 0;
  scene.killEnemy(fygar);
  check("pumped fygar scores 1000", scene.score === 1000, "got " + scene.score);
});

suite("digdug: a rock kill is not scored twice", function () {
  const scene = freshScene();
  const victim = scene.enemies.find((e) => e.type === "pooka");

  // Drop a rock onto the victim's tile.
  const rock = scene.rocks[0];
  rock.falling = true;
  rock.tiles = [[victim.gridY, victim.gridX]];

  // Keep the player well clear so playerDie doesn't fire first.
  scene.player.x = 1.5 * 16;
  scene.player.y = 1.5 * 16;
  scene.player.gridX = 1;
  scene.player.gridY = 1;

  scene.score = 0;
  scene.checkCollisions();

  check(
    "crushed pooka scores 1000 exactly, not 1500",
    scene.score === 1000,
    "got " + scene.score
  );
  check("crushed enemy was removed", scene.enemies.indexOf(victim) === -1);
});

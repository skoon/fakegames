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

/* --------------------------------------- rock chains and the vegetable bonus */

/** Puts `count` enemies on the tiles a falling rock is about to occupy. */
function stageCrush(scene, count) {
  const rock = scene.rocks[0];
  rock.falling = true;
  rock.landed = false;
  rock.tiles = [];

  for (let i = 0; i < count; i++) {
    const e = scene.enemies[i];
    e.gridY = 10;
    e.gridX = 5 + i;
    rock.tiles.push([e.gridY, e.gridX]);
  }

  // Keep the player well away so playerDie does not fire first.
  scene.player.x = 1.5 * 16;
  scene.player.y = 1.5 * 16;
  scene.player.gridX = 1;
  scene.player.gridY = 1;

  scene.score = 0;
  return rock;
}

suite("digdug: a rock pays by how many it catches at once", function () {
  const scene = freshScene();

  stageCrush(scene, 1);
  scene.checkCollisions();
  check("one enemy is worth 1000", scene.score === 1000, "got " + scene.score);

  const two = freshScene();
  stageCrush(two, 2);
  two.checkCollisions();
  check("two at once is worth 2500, not 2000", two.score === 2500, "got " + two.score);

  const three = freshScene();
  stageCrush(three, 3);
  three.checkCollisions();
  check("three at once is worth 4000", three.score === 4000, "got " + three.score);
});

suite("digdug: crushed enemies are removed, and only counted once", function () {
  const scene = freshScene();
  const before = scene.enemies.length;
  stageCrush(scene, 2);
  scene.checkCollisions();

  check("both were removed", scene.enemies.length === before - 2, "left " + scene.enemies.length);
  check("sprite array kept in step", scene.enemySprs.length === scene.enemies.length);

  // Running the same frame again must not pay twice.
  const after = scene.score;
  scene.checkCollisions();
  check("no double payment", scene.score === after, "got " + scene.score);
});

suite("digdug: chained crushes beat separate ones", function () {
  const chained = freshScene();
  stageCrush(chained, 2);
  chained.checkCollisions();

  const separate = freshScene();
  separate.score = 0;
  for (let i = 0; i < 2; i++) {
    const rock = separate.rocks[i];
    rock.falling = true;
    rock.landed = false;
    const e = separate.enemies[0];
    e.gridY = 10;
    e.gridX = 5;
    rock.tiles = [[10, 5]];
    separate.player.gridX = 1;
    separate.player.gridY = 1;
    separate.player.x = 24;
    separate.player.y = 24;
    separate.checkCollisions();
  }

  check(
    "luring two under one rock pays better",
    chained.score > separate.score,
    chained.score + " vs " + separate.score
  );
});

suite("digdug: the vegetable appears after two rocks land", function () {
  const scene = freshScene();
  check("nothing there to start", scene.vegetable === null);
  check("no rocks landed yet", scene.rocksLanded === 0);

  scene.landRock(scene.rocks[0]);
  check("one rock is not enough", scene.vegetable === null);
  check("but it was counted", scene.rocksLanded === 1);

  scene.landRock(scene.rocks[1]);
  check("two rocks brings the prize", scene.vegetable !== null);
  check("it sits mid-map", scene.vegetable.gridX === Math.floor(COLS / 2));
  check("it is worth something", scene.vegetable.points > 0);

  // A rock that lands twice must not double-count.
  const count = scene.rocksLanded;
  scene.landRock(scene.rocks[1]);
  check("landing the same rock again is ignored", scene.rocksLanded === count);
});

suite("digdug: walking onto the vegetable collects it", function () {
  const scene = freshScene();
  scene.landRock(scene.rocks[0]);
  scene.landRock(scene.rocks[1]);
  check("prize is on the board", scene.vegetable !== null);

  const worth = scene.vegetable.points;
  const sprite = scene.vegetable.sprite;
  scene.score = 0;

  scene.player.gridX = scene.vegetable.gridX;
  scene.player.gridY = scene.vegetable.gridY;
  scene.player.x = scene.vegetable.gridX * 16 + 8;
  scene.player.y = scene.vegetable.gridY * 16 + 8;
  scene.checkCollisions();

  check("points were awarded", scene.score === worth, "got " + scene.score);
  check("it is gone from the board", scene.vegetable === null);
  check("its sprite was destroyed", sprite.destroyed === true);
});

suite("digdug: the vegetable times out if you ignore it", function () {
  const scene = freshScene();
  scene.landRock(scene.rocks[0]);
  scene.landRock(scene.rocks[1]);

  scene.updateVegetable(VEGETABLE_LIFETIME - 1);
  check("still there just before the deadline", scene.vegetable !== null);

  scene.updateVegetable(2);
  check("gone after it", scene.vegetable === null);
});

suite("digdug: the vegetable is worth more on later levels", function () {
  const early = freshScene();
  early.level = 1;
  early.spawnVegetable();
  const earlyWorth = early.vegetable.points;

  const later = freshScene();
  later.level = 5;
  later.spawnVegetable();

  check("later levels pay more", later.vegetable.points > earlyWorth,
        later.vegetable.points + " vs " + earlyWorth);
});

/* ------------------------------------------------------- level layout --- */

suite("digdug: rocks stay put until you dig under them", function () {
  const scene = freshScene();
  const before = scene.rocks.map((r) => JSON.stringify(r.tiles));

  // Plenty of frames for anything unsupported to fall and land.
  for (let i = 0; i < 40; i++) scene.updateRocks(16);

  const moved = scene.rocks.filter((r, i) => JSON.stringify(r.tiles) !== before[i]);
  check("no rock falls on its own at level start", moved.length === 0,
        moved.length + " fell, e.g. from " + (moved[0] ? before[scene.rocks.indexOf(moved[0])] : ""));
  check("so no rock has counted toward the veg bonus", scene.rocksLanded === 0,
        "rocksLanded " + scene.rocksLanded);
  check("and there is no free veg", scene.vegetable === null);
});

/* ---------------------------------------------------------------- art --- */

suite("digdug art: every sprite map is well formed", function () {
  const names = Object.keys(SPRITES);
  check("there are sprite maps", names.length > 0);

  for (const name of names) {
    const art = SPRITES[name];
    const width = art.rows[0].length;
    const ragged = art.rows.findIndex((row) => row.length !== width);
    check(name + " rows are all the same width", ragged === -1, "row " + ragged);

    const unknown = art.rows.join("").split("").filter((ch) => ch !== "." && !(ch in art.palette));
    check(name + " uses only its own palette", unknown.length === 0, "stray: " + unknown.join(""));
  }
});

suite("digdug art: soil gets deeper as you dig down", function () {
  let lastBand = -1;
  let monotone = true;
  const seen = new Set();
  for (let row = 1; row < ROWS - 1; row++) {
    const band = soilBand(row);
    if (band < lastBand) monotone = false;
    lastBand = band;
    seen.add(band);
  }
  check("bands never go back up", monotone);
  check("four distinct layers", seen.size === 4, "saw " + seen.size);
  check("topsoil at the top", soilBand(1) === 0);
  check("subsoil at the bottom", soilBand(ROWS - 2) === 3);
});

suite("digdug art: the veg bonus changes with the level", function () {
  check("one veg per points step", VEG_KINDS.length === VEGETABLE_POINTS.length);
  check("no veg repeats", new Set(VEG_KINDS).size === VEG_KINDS.length);

  const kindAt = (level) => {
    const scene = freshScene();
    scene.level = level;
    scene.spawnVegetable();
    return scene.vegetable.kind;
  };
  check("level 1 is a carrot", kindAt(1) === "carrot", kindAt(1));
  check("level 2 is something else", kindAt(2) !== kindAt(1));
  check("past the list it stays on the last one", kindAt(40) === VEG_KINDS[VEG_KINDS.length - 1]);
});

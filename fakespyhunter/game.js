const GAME_WIDTH = 480;
const GAME_HEIGHT = 720;

const ROAD_SPEED = 250;

const ROAD = { left: 90, right: 390, width: 300, shoulder: 10 };
const LANE_COUNT = 3;
const LANE_WIDTH = ROAD.width / LANE_COUNT;
const TILE_HEIGHT = GAME_HEIGHT; // one screen tall, so the repeat is hard to spot

const CAR = {
  w: 32, h: 52,
  moveSpeed: 260, turnSpeed: 240, margin: 24,
};

const BULLET_SPEED = 600;
const FIRE_RATE = 200;

const ENEMY = {
  w: 32, h: 52,
  minSpeed: 100, maxSpeed: 220,
  spawnInterval: 1800, turnSpeed: 120,
  fireInterval: 2500, bulletSpeed: 350,
  rocketChance: 0.25,
  rocketSpeed: 400,
};

const PLAYER_MAX_HP = 2;
const PLAYER_LIVES = 3;
const INVULN_TIME = 2000;
const RESPAWN_TIME = 3000;

/* ------------------------------------------------------------ weapons van ---
 *
 * The truck that makes this Spy Hunter. In the arcade it pulls out of a side
 * road; our road is a straight scrolling tile with no side roads, so instead it
 * comes past from behind, settles ahead of you and drops its rear ramp. Drive
 * up into the back of it and you come out armed.
 *
 * The player is a small state machine while this happens, which nothing else in
 * this game needs: driving -> boarding -> driving, with the car hidden and the
 * controls dead in the middle state.
 */
const VAN = {
  w: 54,
  h: 108,
  firstAt: 12000, // ms before the first one turns up
  interval: 26000, // ms between the rest
  arriveSpeed: 90, // px/s while it settles into position
  leaveSpeed: 260, // px/s once it has been used or timed out
  holdY: GAME_HEIGHT * 0.32, // where it waits for you
  openFor: 9000, // ms the ramp stays down
  entryW: 40, // how accurately you have to line up with the ramp
  entryH: 26,
};

const BOARDING_TIME = 900; // ms inside the van

// Ammo comes in threes and fives because the rear weapons are the strong ones.
const WEAPONS = {
  oil: { name: 'OIL SLICK', ammo: 3, rear: true },
  smoke: { name: 'SMOKE SCREEN', ammo: 3, rear: true },
  missile: { name: 'MISSILES', ammo: 5, rear: false },
};
const WEAPON_KEYS = Object.keys(WEAPONS);

const HAZARD_LIFE = 6000; // ms an oil slick or smoke cloud lasts
const HAZARD_RADIUS = 26;
const MISSILE_SPEED = 720;
const MISSILE_RADIUS = 22;

/* ------------------------------------------------------------------ art ---
 *
 * Arcade homage: top-down pixel art, built from lists of rectangles so every
 * sprite is a readable table rather than a wall of fill calls.
 *
 * Cars, bullets and rockets collide by sprite bounds (getBounds into
 * RectangleToRectangle), so their texture sizes are their hitboxes. The
 * drawing inside those boxes is free to change; the boxes are not.
 */
const HITBOX = { car: [40, 60], bullet: [8, 8], enemyBullet: [8, 8], rocket: [12, 18] };

/** Draws [x, y, w, h, colour, alpha?] rectangles into a texture. */
function rectTexture(scene, key, size, parts) {
  const g = scene.make.graphics({ add: false });
  for (const [x, y, w, h, color, alpha] of parts) {
    g.fillStyle(color, alpha === undefined ? 1 : alpha);
    g.fillRect(x, y, w, h);
  }
  g.generateTexture(key, size[0], size[1]);
  g.destroy();
}

/**
 * A top-down car in the 40x60 box, nose up. Every car shares this layout;
 * a palette and a few extras make the difference.
 */
function carParts(p) {
  const tyre = p.tyre || 0x1c1c1e;
  return [
    [7, 6, 32, 52, 0x000000, 0.3], // shadow
    [4, 10, 4, 11, tyre], [32, 10, 4, 11, tyre], [4, 38, 4, 12, tyre], [32, 38, 4, 12, tyre],
    [9, 2, 22, 2, p.body], [7, 4, 26, 50, p.body], [9, 54, 22, 2, p.body],
    [7, 4, 2, 50, p.side], [31, 4, 2, 50, p.side],
    [10, 18, 20, 7, p.glass], [11, 19, 6, 2, p.glare],
    [10, 25, 20, 11, p.roof],
    [11, 36, 18, 5, p.glass],
  ].concat(p.extras || [], [
    [9, 2, 5, 2, 0xfff3b0], [26, 2, 5, 2, 0xfff3b0], // headlights
    [9, 54, 5, 2, 0xe8201c], [26, 54, 5, 2, 0xe8201c], // tail lights
  ]);
}

const SPY_CAR = {
  body: 0xf2f4f8, side: 0xc4cad4, glass: 0x243556, glare: 0x6a86b8, roof: 0xf2f4f8,
  extras: [
    [18, 2, 4, 16, 0x2a5bd7], [18, 25, 4, 11, 0x2a5bd7], [18, 41, 4, 13, 0x2a5bd7], // stripe
    [12, 9, 3, 6, 0xbfc6d2], [25, 9, 3, 6, 0xbfc6d2], // bonnet vents
    [7, 50, 26, 3, 0x1c1c1e], // spoiler
  ],
};

// Three enemy looks. Same box, same behaviour - only the paint differs.
const ENEMY_STYLES = {
  enemy: { // black sedan, gold trim
    body: 0x1e1e24, side: 0x0e0e12, glass: 0x3a4a5e, glare: 0x6a7a90, roof: 0x2a2a32,
    extras: [[8, 6, 1, 46, 0xc9a227], [31, 6, 1, 46, 0xc9a227], [13, 2, 14, 2, 0xa8adb5]],
  },
  enemyCoupe: { // maroon coupe, black roof
    body: 0x7a1622, side: 0x4e0e16, glass: 0x2a2a38, glare: 0x5a5a78, roof: 0x141414,
    extras: [[15, 5, 10, 12, 0x8e1c2a], [12, 55, 3, 1, 0x8a8f98], [25, 55, 3, 1, 0x8a8f98]],
  },
  enemyArmored: { // gunmetal, plated, slit windows
    body: 0x4a5058, side: 0x33383e, glass: 0x1a1e22, glare: 0x1a1e22, roof: 0x5a616a, tyre: 0x111113,
    extras: [
      [10, 18, 20, 7, 0x4a5058], [12, 20, 16, 2, 0x1a1e22], // armoured windscreen
      [9, 8, 22, 1, 0x6a717a], [9, 44, 22, 1, 0x6a717a], [9, 30, 22, 1, 0x6a717a],
      [9, 6, 1, 1, 0x9aa0a8], [30, 6, 1, 1, 0x9aa0a8], [9, 50, 1, 1, 0x9aa0a8], [30, 50, 1, 1, 0x9aa0a8],
    ],
  },
};
const ENEMY_LOOKS = Object.keys(ENEMY_STYLES);

function generateCarTextures(scene) {
  rectTexture(scene, 'car', HITBOX.car, carParts(SPY_CAR));
  for (const look of ENEMY_LOOKS) rectTexture(scene, look, HITBOX.car, carParts(ENEMY_STYLES[look]));
  // Lives are shown as little spy cars in the HUD.
  rectTexture(scene, 'lifeIcon', [12, 18], [
    [1, 0, 10, 18, 0xf2f4f8], [0, 3, 1, 4, 0x1c1c1e], [11, 3, 1, 4, 0x1c1c1e],
    [0, 12, 1, 4, 0x1c1c1e], [11, 12, 1, 4, 0x1c1c1e], [2, 5, 8, 3, 0x243556], [5, 0, 2, 5, 0x2a5bd7],
    [5, 8, 2, 10, 0x2a5bd7],
  ]);
}

function generateShotTextures(scene) {
  // Tracers: a soft glow round a hot core.
  rectTexture(scene, 'bullet', HITBOX.bullet, [
    [1, 0, 6, 8, 0xffd21e, 0.35], [2, 1, 4, 6, 0xffe066, 0.8], [3, 0, 2, 8, 0xffffff],
  ]);
  rectTexture(scene, 'enemyBullet', HITBOX.enemyBullet, [
    [1, 0, 6, 8, 0xff3b2a, 0.4], [2, 1, 4, 6, 0xff7a4a, 0.85], [3, 1, 2, 6, 0xffe0c0],
  ]);
  // Nose up; enemyFire flips it to point the way it flies.
  rectTexture(scene, 'rocket', HITBOX.rocket, [
    [3, 14, 6, 4, 0xff6a00, 0.35],
    [4, 2, 4, 10, 0xcfd4dc], [4, 0, 4, 2, 0xe8201c], [5, 0, 2, 1, 0xff8a7a],
    [2, 9, 2, 4, 0x6a717a], [8, 9, 2, 4, 0x6a717a],
    [4, 12, 4, 2, 0x3a3a3e], [4, 14, 4, 2, 0xffcf1a], [5, 16, 2, 2, 0xff6a00],
  ]);
}

/** A fireball: hot white core out to a ragged red rim. And bits of car. */
function generateExplosionTextures(scene) {
  const g = scene.make.graphics({ add: false });
  const bands = [[5, 0xffffff], [8, 0xfff3a0], [11, 0xffcf1a], [13, 0xff6a00], [15, 0xc81e0e]];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16) + (hash(x >> 1, y >> 1) - 0.5) * 3;
      const band = bands.find(([r]) => d < r);
      if (!band) continue;
      g.fillStyle(band[1], 1);
      g.fillRect(x, y, 1, 1);
    }
  }
  g.generateTexture('explosion', 32, 32);
  g.destroy();
  rectTexture(scene, 'debris', [4, 4], [[0, 0, 4, 4, 0x3a3a3e], [1, 1, 2, 2, 0xff8a2a]]);
}

/** Deterministic 0..1 noise for the procedural textures. */
function hash(a, b) {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * The road: mown grass, gravel shoulders, tarmac with grain, patches, cracks
 * and skid marks. One full screen tall so the repeat is hard to spot, and
 * every feature stays clear of the top and bottom edges so it tiles.
 */
function generateRoadTexture(scene) {
  const g = scene.make.graphics({ add: false });
  const H = TILE_HEIGHT;
  const { left, right, width, shoulder } = ROAD;
  const rnd = (i, salt) => hash(i, salt);

  // Grass, mown in stripes.
  g.fillStyle(0x3f8f35);
  g.fillRect(0, 0, GAME_WIDTH, H);
  g.fillStyle(0x378230);
  for (let y = 0; y < H; y += 48) {
    g.fillRect(0, y, left - shoulder, 24);
    g.fillRect(right + shoulder, y, GAME_WIDTH - right - shoulder, 24);
  }
  for (let i = 0; i < 260; i++) {
    const onLeft = i % 2 === 0;
    const x = onLeft ? rnd(i, 1) * (left - shoulder - 2) : right + shoulder + rnd(i, 1) * (GAME_WIDTH - right - shoulder - 2);
    g.fillStyle(rnd(i, 2) < 0.5 ? 0x2f7428 : 0x56a84a);
    g.fillRect(x, rnd(i, 3) * H, 2, 2);
  }

  // Gravel shoulders.
  g.fillStyle(0x8a7a62);
  g.fillRect(left - shoulder, 0, shoulder, H);
  g.fillRect(right, 0, shoulder, H);
  for (let i = 0; i < 160; i++) {
    const x = (i % 2 ? right : left - shoulder) + rnd(i, 4) * (shoulder - 1);
    g.fillStyle(rnd(i, 5) < 0.5 ? 0x6e6050 : 0xa8987e);
    g.fillRect(x, rnd(i, 6) * H, 1 + (i % 2), 1 + ((i >> 1) % 2));
  }

  // Tarmac and its grain.
  g.fillStyle(0x3c3c40);
  g.fillRect(left, 0, width, H);
  for (let i = 0; i < 700; i++) {
    g.fillStyle(rnd(i, 7) < 0.5 ? 0x46464a : 0x323236);
    g.fillRect(left + rnd(i, 8) * width, rnd(i, 9) * H, 1 + (i % 2), 1);
  }

  // Resurfaced patches.
  for (let i = 0; i < 5; i++) {
    const w = 30 + rnd(i, 10) * 50, h = 24 + rnd(i, 11) * 50;
    const x = left + 8 + rnd(i, 12) * (width - w - 16), y = 20 + rnd(i, 13) * (H - h - 40);
    g.fillStyle(0x333337);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x38383c);
    g.fillRect(x, y, w, h);
  }

  // Cracks: short, faint zigzags - long dark ones read as tyre marks.
  g.fillStyle(0x2e2e32);
  for (let i = 0; i < 7; i++) {
    let x = left + 10 + rnd(i, 14) * (width - 20), y = 30 + rnd(i, 15) * (H - 90);
    for (let s = 0; s < 7; s++) {
      g.fillRect(x, y, 1, 3);
      x += rnd(i * 31 + s, 16) < 0.5 ? -1 : 1;
      y += 3;
    }
  }

  // Skid marks: pairs of dark streaks that drift sideways.
  for (let i = 0; i < 3; i++) {
    const x0 = left + 40 + rnd(i, 17) * (width - 100), y0 = 60 + rnd(i, 18) * (H - 220);
    const drift = (rnd(i, 19) - 0.5) * 0.4;
    for (let s = 0; s < 120; s += 2) {
      const x = x0 + drift * s + Math.sin(s / 30) * 3;
      g.fillStyle(0x18181a, 0.45);
      g.fillRect(x, y0 + s, 3, 2);
      g.fillRect(x + 24, y0 + s, 3, 2);
    }
  }

  // Edge lines and lane dashes, spaced to divide the tile evenly.
  g.fillStyle(0xf2f2f2);
  g.fillRect(left, 0, 3, H);
  g.fillRect(right - 3, 0, 3, H);
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const lx = left + lane * LANE_WIDTH;
    for (let y = 0; y < H + 36; y += 36) g.fillRect(lx - 2, y - 30, 4, 20);
  }

  g.generateTexture('road', GAME_WIDTH, H);
  g.destroy();
}

/* ------------------------------------------------------------- scenery --- */

// Roadside dressing, top-down. `half` is half the width, for keeping clear of
// the road; `weight` is how often it turns up.
const SCENERY = {
  tree: { half: 15, weight: 35 },
  pine: { half: 12, weight: 25 },
  bush: { half: 9, weight: 20 },
  house: { half: 23, weight: 10 },
  sign: { half: 5, weight: 5 },
  fence: { half: 3, weight: 5 },
};
const SCENERY_PER_SIDE = 9;
const BRIDGE = { h: 120, gapMin: 1400, gapMax: 2600 };

function generateSceneryTextures(scene) {
  let g = scene.make.graphics({ add: false });
  // Round tree: shadow, canopy, lit side.
  g.fillStyle(0x000000, 0.25); g.fillCircle(18, 18, 12);
  g.fillStyle(0x1f6b2a); g.fillCircle(15, 15, 14);
  g.fillStyle(0x2f8a36); g.fillCircle(13, 13, 10);
  g.fillStyle(0x4cae44); g.fillCircle(10, 10, 4);
  g.generateTexture('tree', 32, 32); g.destroy();

  g = scene.make.graphics({ add: false });
  g.fillStyle(0x000000, 0.25); g.fillCircle(14, 14, 10);
  g.fillStyle(0x17522a); g.fillCircle(12, 12, 11);
  g.fillStyle(0x236b35);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillTriangle(12, 12, 12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11, 12 + Math.cos(a + 0.4) * 7, 12 + Math.sin(a + 0.4) * 7);
  }
  g.fillStyle(0x2f7d3e); g.fillCircle(11, 11, 3);
  g.generateTexture('pine', 26, 26); g.destroy();

  g = scene.make.graphics({ add: false });
  g.fillStyle(0x2a7a2c); g.fillEllipse(6, 8, 12, 10); g.fillEllipse(12, 6, 12, 10);
  g.fillStyle(0x46a040); g.fillEllipse(10, 5, 6, 4);
  g.generateTexture('bush', 18, 14); g.destroy();

  rectTexture(scene, 'house', [46, 40], [
    [4, 4, 42, 36, 0x000000, 0.25],
    [0, 0, 42, 36, 0x8a3a26], [0, 0, 21, 36, 0xa84a32], // roof halves, lit and shaded
    [20, 0, 2, 36, 0x5e2618], // ridge
    [30, 6, 6, 6, 0x5a5a5e], [31, 7, 4, 4, 0x3a3a3e], // chimney
    [0, 34, 42, 2, 0x6e2a1a],
  ]);
  rectTexture(scene, 'sign', [10, 18], [
    [4, 8, 2, 10, 0x8a8f98], [0, 0, 10, 8, 0x1b6b3a], [1, 1, 8, 6, 0xf2f2f2], [2, 3, 6, 2, 0x1b6b3a],
  ]);
  const fence = [];
  for (let y = 0; y < 64; y += 16) fence.push([1, y, 4, 4, 0x6b4526]);
  fence.push([2, 0, 2, 64, 0xa87a4a]);
  rectTexture(scene, 'fence', [6, 64], fence);

  // A river under a concrete bridge: water on the grass either side, the
  // tarmac carried across on a deck with railings.
  const H = BRIDGE.h;
  const parts = [
    [0, 0, GAME_WIDTH, H, 0x2a6fb0],
    [0, 0, GAME_WIDTH, 6, 0xc8b07a], [0, H - 6, GAME_WIDTH, 6, 0xc8b07a], // banks
  ];
  for (let i = 0; i < 40; i++) {
    const x = hash(i, 30) * GAME_WIDTH, y = 10 + hash(i, 31) * (H - 20);
    parts.push([x, y, 8 + hash(i, 32) * 10, 1, 0x5a9ad8]); // ripples
  }
  parts.push(
    [ROAD.left - ROAD.shoulder, 0, ROAD.width + ROAD.shoulder * 2, H, 0x8e8e92], // deck
    [ROAD.left, 0, ROAD.width, H, 0x46464a],
    [ROAD.left - ROAD.shoulder + 2, 0, 5, H, 0xc0c4ca], [ROAD.right + ROAD.shoulder - 7, 0, 5, H, 0xc0c4ca],
    [ROAD.left, 38, ROAD.width, 2, 0x2e2e32], [ROAD.left, 80, ROAD.width, 2, 0x2e2e32] // joints
  );
  for (let y = 4; y < H; y += 16) {
    parts.push([ROAD.left - ROAD.shoulder + 1, y, 7, 3, 0x6a6e76], [ROAD.right + ROAD.shoulder - 8, y, 7, 3, 0x6a6e76]);
  }
  rectTexture(scene, 'bridge', [GAME_WIDTH, H], parts);
}

function pickSceneryKind() {
  const kinds = Object.keys(SCENERY);
  const total = kinds.reduce((sum, k) => sum + SCENERY[k].weight, 0);
  let roll = Math.random() * total;
  for (const k of kinds) {
    roll -= SCENERY[k].weight;
    if (roll <= 0) return k;
  }
  return kinds[kinds.length - 1];
}

/** Picks a new look and a spot on the grass for one side of the road. */
function dressSceneryItem(item) {
  item.kind = pickSceneryKind();
  item.halfWidth = SCENERY[item.kind].half;
  const lo = item.side < 0 ? item.halfWidth + 2 : ROAD.right + ROAD.shoulder + item.halfWidth + 2;
  const hi = item.side < 0 ? ROAD.left - ROAD.shoulder - item.halfWidth - 2 : GAME_WIDTH - item.halfWidth - 2;
  item.x = lo + Math.random() * Math.max(0, hi - lo);
}

/** Shared HUD text style: bold, outlined, readable over grass or tarmac. */
function textStyle(size, color) {
  return {
    fontFamily: 'monospace', fontSize: size + 'px', fontStyle: 'bold',
    color: color, stroke: '#000000', strokeThickness: 3, align: 'center',
  };
}


const GAME_KEY = 'spyhunter';

function noteToFrequency(note) {
  const noteMap = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
    E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
    Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
  };
  const match = note.match(/^([A-G][#b]?)(\d)$/);
  if (!match) return 440;
  const pitch = match[1];
  const octave = parseInt(match[2], 10);
  const semitone = noteMap[pitch];
  const midi = 12 + octave * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const MUSIC_PATTERN = ['F1', 'F1', 'G1', 'F1', 'G#1', 'F1', 'B1', 'A1'];

// The shared module owns the context, the master gain and the loop driver.
const music = Arcade.Audio.loop({
  notes: MUSIC_PATTERN.map(noteToFrequency),
  tempo: 190,
  type: 'square',
  volume: 0.14,
  noteDuration: 0.12,
});

function startAudio(scene) {
  if (scene.audioStarted) return;
  scene.audioStarted = true;
  Arcade.Audio.context();
  music.start();
}

function playSfx(key) {
  switch (key) {
    case 'playerShoot':
      Arcade.Audio.tone(1100, { duration: 0.08, type: 'square', volume: 0.22 });
      break;
    case 'enemyShoot':
      Arcade.Audio.tone(760, { duration: 0.09, type: 'square', volume: 0.18 });
      break;
    case 'enemyRocket':
      Arcade.Audio.tone(520, { duration: 0.18, type: 'triangle', volume: 0.16 });
      Arcade.Audio.tone(300, { duration: 0.18, type: 'sawtooth', volume: 0.12 });
      break;
    case 'vanHorn':
      Arcade.Audio.tone(210, { duration: 0.3, type: 'square', volume: 0.16 });
      Arcade.Audio.tone(158, { duration: 0.3, type: 'square', volume: 0.16 });
      break;
    case 'board':
      [440, 660, 880].forEach((f, i) =>
        Arcade.Audio.tone(f, { duration: 0.12, delay: i * 0.1, type: 'square', volume: 0.2 })
      );
      break;
    case 'oilDrop':
      Arcade.Audio.noise({ duration: 0.25, volume: 0.18, filterFrom: 700, filterTo: 120 });
      break;
    case 'smokeDrop':
      Arcade.Audio.noise({ duration: 0.45, volume: 0.2, filterFrom: 1800, filterTo: 300 });
      break;
    case 'missile':
      Arcade.Audio.tone(300, { slideTo: 1500, duration: 0.3, type: 'sawtooth', volume: 0.2 });
      break;
    case 'collision':
      Arcade.Audio.noise({ duration: 0.12, volume: 0.24, filterFrom: 2000, filterTo: 400 });
      break;
    default:
      break;
  }
}
function generateVanTextures(scene) {
  const w = VAN.w;
  const h = VAN.h;

  // Closed: a white box truck with roof vents and a blue stripe.
  rectTexture(scene, 'van', [w + 4, h + 4], [
    [4, 4, w, h, 0x000000, 0.35],
    [0, 0, w, h, 0xdcdcdc], [3, 3, w - 6, h - 20, 0xf4f4f4],
    [6, 4, w - 12, 14, 0x2a2a2a], [9, 6, w - 18, 6, 0x3a5a8a], // cab and windscreen
    [0, 24, 3, 70, 0x2a5bd7], [w - 3, 24, 3, 70, 0x2a5bd7], // stripes
    [14, 30, 8, 4, 0xb8b8b8], [w - 22, 30, 8, 4, 0xb8b8b8], [14, 60, 8, 4, 0xb8b8b8], [w - 22, 60, 8, 4, 0xb8b8b8],
    [0, 18, 6, 20, 0x1a1a1a], [w - 6, 18, 6, 20, 0x1a1a1a], [0, h - 40, 6, 22, 0x1a1a1a], [w - 6, h - 40, 6, 22, 0x1a1a1a],
    [8, h - 16, w - 16, 14, 0x888888], [w / 2 - 1, h - 16, 2, 14, 0x6a6a6a], // shut rear doors
    [6, h - 4, 8, 4, 0xff3333], [w - 14, h - 4, 8, 4, 0xff3333],
  ]);

  // Open: doors up, lit inside, ramp down with a hazard stripe to aim for.
  const ramp = [];
  for (let i = 0; i < 5; i++) ramp.push([12 + i * 6, h - 4, 3, 4, 0xffd21e], [15 + i * 6, h - 4, 3, 4, 0x1a1a1a]);
  rectTexture(scene, 'vanOpen', [w + 4, h + 4], [
    [4, 4, w, h, 0x000000, 0.35],
    [0, 0, w, h - 14, 0xdcdcdc], [3, 3, w - 6, h - 34, 0xf4f4f4],
    [6, 4, w - 12, 14, 0x2a2a2a], [9, 6, w - 18, 6, 0x3a5a8a],
    [0, 24, 3, 60, 0x2a5bd7], [w - 3, 24, 3, 60, 0x2a5bd7],
    [14, 30, 8, 4, 0xb8b8b8], [w - 22, 30, 8, 4, 0xb8b8b8],
    [0, 18, 6, 20, 0x1a1a1a], [w - 6, 18, 6, 20, 0x1a1a1a],
    [10, h - 30, w - 20, 16, 0xffcc33], [14, h - 26, w - 28, 10, 0xffee99], // the lit interior
    [12, h - 14, w - 24, 14, 0xaaaaaa], ...ramp,
  ]);

  let g;
  // Oil slick. Near-black on near-black tarmac is invisible, so it gets a
  // petrol sheen around the rim to make it read on the road.
  g = scene.make.graphics({ add: false });
  g.fillStyle(0x6f5fa8, 0.85);
  g.fillEllipse(26, 18, 50, 31);
  g.fillStyle(0x0d0d14, 0.95);
  g.fillEllipse(26, 18, 44, 25);
  g.fillStyle(0x3fa9c8, 0.75);
  g.fillEllipse(19, 14, 18, 10);
  g.fillStyle(0xa060c0, 0.6);
  g.fillEllipse(33, 22, 14, 8);
  g.fillStyle(0xd8d8ee, 0.5);
  g.fillEllipse(22, 12, 7, 4);
  g.generateTexture('oil', 52, 36);
  g.destroy();

  // Smoke cloud
  g = scene.make.graphics({ add: false });
  g.fillStyle(0xb8b8c0, 0.75);
  g.fillCircle(18, 22, 15);
  g.fillCircle(34, 18, 17);
  g.fillCircle(28, 32, 13);
  g.fillStyle(0xe4e4ec, 0.6);
  g.fillCircle(24, 20, 10);
  g.generateTexture('smoke', 54, 48);
  g.destroy();

  // Missile
  g = scene.make.graphics({ add: false });
  g.fillStyle(0xdddddd);
  g.fillRect(3, 2, 6, 18);
  g.fillStyle(0xff4422);
  g.fillTriangle(3, 3, 9, 3, 6, 0);
  g.fillStyle(0x666666);
  g.fillRect(0, 12, 3, 7);
  g.fillRect(9, 12, 3, 7);
  g.fillStyle(0xffcc44);
  g.fillRect(4, 20, 4, 5);
  g.generateTexture('missile', 12, 26);
  g.destroy();
}

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    generateRoadTexture(this);
    generateCarTextures(this);
    generateShotTextures(this);
    generateExplosionTextures(this);
    generateSceneryTextures(this);
    generateVanTextures(this);

    this.road = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'road');
    this.road.setOrigin(0, 0);
    this.createScenery();

    // Above the bridge deck and the roadside, level with the traffic.
    this.player = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'car').setDepth(4);
    this.player.setOrigin(0.5, 0.5);

    window.addEventListener('keydown', () => startAudio(this), { once: true });
    
    // Mute state and UI
    this.muted = false;
    this.muteButton = this.add.text(GAME_WIDTH - 8, 38, 'MUTE', {
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#cfd6e0',
      backgroundColor: '#1a1a1e', padding: { x: 5, y: 3 },
    }).setOrigin(1, 0).setDepth(10).setInteractive();
    this.muteButton.on('pointerdown', () => this.toggleMute());
    // M is the shell's, not ours - binding it here too toggled mute twice and
    // cancelled itself out. syncMuteButton() in update keeps the label honest.

    // R restarts; everything else is already in the default map.
    Arcade.Input.bind({ restart: ['KeyR'] });

    this.bullets = this.add.group();
    this.lastFired = 0;

    this.enemies = this.add.group();
    this.nextSpawn = 500;

    this.enemyBullets = this.add.group();

    this.carX = GAME_WIDTH / 2;
    this.carY = GAME_HEIGHT / 2;

    // Van, weapons and the player state machine.
    this.playerState = 'driving';
    this.boardTimer = 0;
    this.van = null;
    this.nextVan = VAN.firstAt;
    this.weapon = null;
    this.weaponAmmo = 0;
    this.hazards = [];
    this.missiles = [];

    this.playerHP = PLAYER_MAX_HP;
    this.playerLives = PLAYER_LIVES;
    this.invulnerable = false;
    this.invulnUntil = 0;
    this.gameOver = false;

    // HUD: a dark bar across the top - score, lives as little cars, hearts.
    this.add.rectangle(GAME_WIDTH / 2, 15, GAME_WIDTH, 30, 0x000000, 0.6).setDepth(9);
    this.scoreText = this.add.text(10, 6, 'SCORE: 0', textStyle(15, '#ffe98a'))
      .setOrigin(0, 0).setDepth(10);
    this.lifeIcons = [];
    for (let i = 0; i < PLAYER_LIVES; i++) {
      this.lifeIcons.push(this.add.sprite(GAME_WIDTH - 14 - i * 18, 15, 'lifeIcon').setDepth(10));
    }
    this.hpText = this.add.text(GAME_WIDTH - 14 - PLAYER_LIVES * 18, 15, '', textStyle(14, '#ff5a5a'))
      .setOrigin(1, 0.5).setDepth(10);

    this.score = 0;

    // Weapon panel, bottom left: icon, name, ammo. Hidden while unarmed.
    this.weaponPanel = this.add.rectangle(122, GAME_HEIGHT - 24, 228, 32, 0x000000, 0.65)
      .setStrokeStyle(1, 0xffcc44).setDepth(9);
    this.weaponIcon = this.add.sprite(26, GAME_HEIGHT - 24, 'oil').setDepth(10);
    this.weaponText = this.add.text(48, GAME_HEIGHT - 24, '', textStyle(13, '#ffcc44'))
      .setOrigin(0, 0.5).setDepth(10);

    this.vanHint = this.add.text(GAME_WIDTH / 2, 64, '', textStyle(14, '#ffe98a'))
      .setOrigin(0.5).setDepth(10);

    this.updateHUD();

    this.started = false;
    this.buildTitleScreen();

    // Start and restart are polled in update() from the shared input.

    // Phaser drives its own loop, so the shell tells the scene to suspend.
    Arcade.Shell.init({
      game: GAME_KEY,
      back: '../index.html',
      onPause: () => this.scene.pause(),
      onResume: () => {
        this.scene.resume();
        this.syncMuteButton();
      },
    });
    this.syncMuteButton();

    // Award 10 points per second while the game is running
    this.scoreEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.started && !this.gameOver) {
          this.score += 10;
          this.updateHUD();
        }
      },
    });
  }

  buildTitleScreen() {
    const mid = GAME_WIDTH / 2;
    const top = GAME_HEIGHT / 2;
    this.startOverlay = this.add.rectangle(mid, top, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.82).setDepth(20);
    this.startTitle = this.add.text(mid, top - 150, 'FAKE SPY HUNTER', textStyle(34, '#ffffff'))
      .setOrigin(0.5).setDepth(21);
    this.startHint = this.add.text(mid, top - 100, 'PRESS SPACE TO START', textStyle(17, '#ffdd55'))
      .setOrigin(0.5).setDepth(21);
    this.startHighText = this.add.text(mid, top - 70, Arcade.Scores.format(GAME_KEY), textStyle(13, '#ffffff'))
      .setOrigin(0.5, 0).setDepth(21);

    // The weapons van's stock, with the real sprites.
    this.startParts = [
      this.add.sprite(mid, top - 230, 'car').setScale(2).setDepth(21),
      this.add.text(mid, top + 60, 'THE WEAPONS VAN CARRIES', textStyle(13, '#9ad0ff')).setOrigin(0.5).setDepth(21),
    ];
    [
      ['oil', 0.6, 'OIL SLICK', 'SPINS OUT CARS BEHIND'],
      ['smoke', 0.55, 'SMOKE SCREEN', 'BLOCKS INCOMING FIRE'],
      ['missile', 1.2, 'MISSILES', 'PUNCH THROUGH TRAFFIC'],
    ].forEach(([key, scale, name, what], i) => {
      const y = top + 96 + i * 36;
      this.startParts.push(
        this.add.sprite(mid - 150, y, key).setScale(scale).setDepth(21),
        this.add.text(mid - 118, y - 7, name, textStyle(13, '#ffcc44')).setOrigin(0, 0.5).setDepth(21),
        this.add.text(mid - 118, y + 8, what, textStyle(11, '#cfd6e0')).setOrigin(0, 0.5).setDepth(21)
      );
    });
    this.startParts.push(
      this.add.text(
        mid, top + 222,
        'ARROWS DRIVE  ·  SPACE FIRE  ·  SHIFT WEAPON\nDRIVE INTO THE BACK OF THE VAN TO ARM UP\n\nP PAUSE  ·  M MUTE  ·  ESC ARCADE',
        textStyle(11, '#9ad07a')
      ).setOrigin(0.5, 0).setDepth(21)
    );
  }

  startGame() {
    this.started = true;
    this.startOverlay.destroy();
    this.startTitle.destroy();
    this.startHint.destroy();
    for (const part of this.startParts) part.destroy();
    if (this.startHighText) this.startHighText.destroy();
    startAudio(this);
  }

  // The button and the shared M key drive the same knob, so the label stays
  // truthful whichever one was used.
  toggleMute() {
    this.muted = Arcade.Audio.toggleMute();
    this.syncMuteButton();
  }

  syncMuteButton() {
    this.muted = Arcade.Audio.isMuted();
    if (this.muteButton) this.muteButton.setText(this.muted ? 'UNMUTE' : 'MUTE');
  }


  update(time, delta) {
    // The shell's M can change mute behind our back, so the label re-syncs here.
    this.syncMuteButton();

    if (!this.started) {
      if (Arcade.Input.justPressed('fire')) this.startGame();
      return;
    }

    if (this.gameOver) {
      // Blocked while the initials overlay owns the keyboard, which is right:
      // enter your initials, then restart.
      if (Arcade.Input.justPressed('restart')) this.scene.restart();
      return;
    }

    const dt = delta / 1000;

    if (this.invulnerable && time > this.invulnUntil) {
      this.invulnerable = false;
      this.player.setAlpha(1);
    }

    if (this.invulnerable) {
      this.player.setAlpha(Math.sin(time * 0.015) > 0 ? 1 : 0.2);
    }

    this.updateVan(dt);
    this.updateHazards(dt);
    this.updateMissiles(dt);

    // Inside the van the car is gone and the controls are dead.
    if (this.playerState === 'boarding') {
      this.road.tilePositionY -= ROAD_SPEED * dt;
      this.scrollScenery(dt);
      this.boardTimer -= delta;
      if (this.boardTimer <= 0) this.finishBoarding();
      return;
    }

    // Shift deploys whatever you came out of the van with.
    if (Arcade.Input.justPressed('fire2')) this.deployWeapon();

    if (Arcade.Input.held('up')) {
      this.carY -= CAR.moveSpeed * dt;
    }
    if (Arcade.Input.held('down')) {
      this.carY += CAR.moveSpeed * dt;
    }
    const yMargin = 80;
    this.carY = Phaser.Math.Clamp(this.carY, yMargin, GAME_HEIGHT - yMargin);

    if (Arcade.Input.held('left')) {
      this.carX -= CAR.turnSpeed * dt;
    }
    if (Arcade.Input.held('right')) {
      this.carX += CAR.turnSpeed * dt;
    }
    this.carX = Phaser.Math.Clamp(
      this.carX, ROAD.left + CAR.margin, ROAD.right - CAR.margin,
    );

    this.road.tilePositionY -= ROAD_SPEED * dt;
    this.scrollScenery(dt);
    this.player.x = this.carX;
    this.player.y = this.carY;

    if (Arcade.Input.held('fire') && time > this.lastFired + FIRE_RATE) {
      const b = this.add.sprite(this.carX, this.carY - CAR.h / 2 - 8, 'bullet');
      b.setDepth(5);
      this.bullets.add(b);
      this.lastFired = time;
      playSfx('playerShoot');
    }

    const bullets = this.bullets.getChildren();
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.active) continue;
      b.y -= BULLET_SPEED * dt;
      if (b.y < -20) b.destroy();
    }

    if (time > this.nextSpawn) {
      this.spawnEnemy();
      this.nextSpawn = time + ENEMY.spawnInterval + Math.random() * 1200;
    }

    const enemies = this.enemies.getChildren();
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.active) continue;

      const dx = this.carX - e.x;
      const turnAmount = ENEMY.turnSpeed * dt;
      if (dx > 2) e.x += turnAmount;
      else if (dx < -2) e.x -= turnAmount;
      e.x = Phaser.Math.Clamp(e.x, ROAD.left + CAR.margin, ROAD.right - CAR.margin);

      e.y += e.getData('vY') * dt;
      if (e.y < -80 || e.y > GAME_HEIGHT + 80) {
        e.destroy();
        continue;
      }

      const lastFire = e.getData('lastFire') || 0;
      if (time > lastFire + ENEMY.fireInterval) {
        this.enemyFire(e, time);
        e.setData('lastFire', time);
      }
    }

    const enemyBullets = this.enemyBullets.getChildren();
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const eb = enemyBullets[i];
      if (!eb.active) continue;
      eb.x += eb.getData('vX') * dt;
      eb.y += eb.getData('vY') * dt;
      if (eb.y < -30 || eb.y > GAME_HEIGHT + 30 || eb.x < -30 || eb.x > GAME_WIDTH + 30) {
        eb.destroy();
      }
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const eb = enemyBullets[i];
      if (!eb.active) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(eb.getBounds(), this.player.getBounds())) {
        const dmg = eb.getData('damage') || 1;
        this.playerHit(dmg);
        eb.destroy();
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.active) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), e.getBounds())) {
        playSfx('collision');
        const dx = this.carX - e.x;
        const dy = this.carY - e.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const nx = dx / len, ny = dy / len;
          const push = 40;
          this.carX += nx * push;
          this.carY += ny * push;
          e.x -= nx * push;
          e.y -= ny * push;
        } else {
          e.y -= 40;
        }
        this.carX = Phaser.Math.Clamp(this.carX, ROAD.left + CAR.margin, ROAD.right - CAR.margin);
        this.carY = Phaser.Math.Clamp(this.carY, 80, GAME_HEIGHT - 80);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.active) continue;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (!e.active) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(b.getBounds(), e.getBounds())) {
          playSfx('collision');
          // award points for destroying an enemy
          this.score = (this.score || 0) + 100;
          this.updateHUD();
          this.explodeAt(e.x, e.y);
          b.destroy();
          e.destroy();
          break;
        }
      }
    }
  }

  /* ---------------------------------------------------------- scenery --- */

  /** Fills both verges and parks a river bridge up the road. */
  createScenery() {
    this.scenery = [];
    for (const side of [-1, 1]) {
      let y = GAME_HEIGHT - 40;
      for (let i = 0; i < SCENERY_PER_SIDE; i++) {
        const item = { side, y };
        dressSceneryItem(item);
        item.sprite = this.add.sprite(item.x, item.y, item.kind).setDepth(2);
        this.scenery.push(item);
        y -= 60 + Math.random() * 70;
      }
    }
    this.bridge = {
      kind: 'bridge', side: 0, x: GAME_WIDTH / 2, halfWidth: GAME_WIDTH / 2,
      y: -BRIDGE.h / 2 - (BRIDGE.gapMin + Math.random() * (BRIDGE.gapMax - BRIDGE.gapMin)),
    };
    this.bridge.sprite = this.add.sprite(this.bridge.x, this.bridge.y, 'bridge').setDepth(1);
    this.scenery.push(this.bridge);
  }

  /** Moves the roadside with the road and recycles what falls off the bottom. */
  scrollScenery(dt) {
    for (const item of this.scenery) {
      item.y += ROAD_SPEED * dt;

      if (item === this.bridge) {
        if (item.y - BRIDGE.h / 2 > GAME_HEIGHT) {
          item.y = -BRIDGE.h / 2 - (BRIDGE.gapMin + Math.random() * (BRIDGE.gapMax - BRIDGE.gapMin));
        }
      } else if (item.y - 40 > GAME_HEIGHT) {
        // Back up the road, above the highest piece on the same side.
        const top = Math.min(...this.scenery.filter((o) => o.side === item.side).map((o) => o.y));
        item.y = top - (60 + Math.random() * 70);
        dressSceneryItem(item);
        item.sprite.setTexture(item.kind);

        // Nothing grows in the river.
        const b = this.bridge;
        if (Math.abs(item.y - b.y) < BRIDGE.h / 2 + 40) item.y = b.y - BRIDGE.h / 2 - 40 - Math.random() * 30;
      }
      item.sprite.setPosition(item.x, item.y);
    }
  }

  /* ------------------------------------------------------------ the van --- */

  spawnVan() {
    if (this.van) return;

    this.van = {
      x: ROAD.left + ROAD.width / 2,
      y: -VAN.h,
      state: 'arriving',
      openTimer: VAN.openFor,
      sprite: this.add.sprite(0, 0, 'van').setOrigin(0.5, 0.5).setDepth(3),
    };
    playSfx('vanHorn');
  }

  /** Where the ramp is: the bottom edge of the van. */
  vanRearY() {
    return this.van ? this.van.y + VAN.h / 2 : 0;
  }

  updateVan(dt) {
    if (!this.van) {
      this.nextVan -= dt * 1000;
      if (this.nextVan <= 0) {
        this.spawnVan();
        this.nextVan = VAN.interval;
      }
      return;
    }

    const van = this.van;

    if (van.state === 'arriving') {
      van.y += VAN.arriveSpeed * dt;
      if (van.y >= VAN.holdY) {
        van.y = VAN.holdY;
        van.state = 'open';
      }
    } else if (van.state === 'open') {
      // It holds station, so it reads as matching your speed.
      van.openTimer -= dt * 1000;
      if (van.openTimer <= 0) van.state = 'leaving';
    } else {
      // Pulls away up the road and is gone.
      van.y -= VAN.leaveSpeed * dt;
      if (van.y < -VAN.h) {
        van.sprite.destroy();
        this.van = null;
        this.vanHint.setText('');
        return;
      }
    }

    van.sprite.setTexture(van.state === 'open' ? 'vanOpen' : 'van');
    van.sprite.setPosition(van.x, van.y);

    this.vanHint.setText(
      van.state === 'open' ? 'DRIVE INTO THE VAN' : ''
    );

    if (van.state === 'open' && this.playerState === 'driving') {
      this.checkBoarding();
    }
  }

  /** Plain arithmetic rather than sprite bounds, so the zone is testable. */
  checkBoarding() {
    const van = this.van;
    const dx = Math.abs(this.carX - van.x);
    const dy = Math.abs(this.carY - this.vanRearY());

    if (dx <= VAN.entryW / 2 && dy <= VAN.entryH / 2) this.boardVan();
  }

  boardVan() {
    this.playerState = 'boarding';
    this.boardTimer = BOARDING_TIME;
    this.player.setVisible(false);
    this.vanHint.setText('');
    playSfx('board');

    if (this.van) this.van.state = 'leaving';
  }

  /** Comes out of the van armed with something. */
  finishBoarding() {
    this.playerState = 'driving';
    this.player.setVisible(true);

    const kind = WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)];
    this.giveWeapon(kind);

    this.carY = Math.min(GAME_HEIGHT - 80, this.carY + 40);
    this.invulnerable = true;
    this.invulnUntil = this.time.now + INVULN_TIME;
  }

  giveWeapon(kind) {
    this.weapon = kind;
    this.weaponAmmo = WEAPONS[kind].ammo;
    this.updateHUD();
  }

  /* -------------------------------------------------------- the weapons --- */

  deployWeapon() {
    if (!this.weapon || this.weaponAmmo <= 0) return false;

    const spec = WEAPONS[this.weapon];

    if (spec.rear) {
      // Dropped out the back, where the traffic behind you will find it.
      this.hazards.push({
        x: this.carX,
        y: this.carY + CAR.h / 2 + 10,
        kind: this.weapon,
        life: HAZARD_LIFE,
        sprite: this.add
          .sprite(this.carX, this.carY + CAR.h / 2 + 10, this.weapon === 'oil' ? 'oil' : 'smoke')
          .setOrigin(0.5, 0.5)
          .setDepth(2),
      });
      playSfx(this.weapon === 'oil' ? 'oilDrop' : 'smokeDrop');
    } else {
      // Missiles go forward and keep going through whatever they hit.
      this.missiles.push({
        x: this.carX,
        y: this.carY - CAR.h / 2 - 10,
        sprite: this.add
          .sprite(this.carX, this.carY - CAR.h / 2 - 10, 'missile')
          .setOrigin(0.5, 0.5)
          .setDepth(5),
      });
      playSfx('missile');
    }

    this.weaponAmmo--;
    if (this.weaponAmmo <= 0) this.weapon = null;
    this.updateHUD();
    return true;
  }

  updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hazard = this.hazards[i];

      // Hazards sit on the road, so they scroll away with it.
      hazard.y += ROAD_SPEED * dt;
      hazard.life -= dt * 1000;
      hazard.sprite.setPosition(hazard.x, hazard.y);

      if (hazard.life <= 0 || hazard.y > GAME_HEIGHT + 60) {
        hazard.sprite.destroy();
        this.hazards.splice(i, 1);
        continue;
      }

      // Anything that drives through it goes off the road.
      const enemies = this.enemies.getChildren();
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (!enemy.active) continue;
        if (Math.hypot(enemy.x - hazard.x, enemy.y - hazard.y) > HAZARD_RADIUS) continue;

        this.score += 150;
        this.explodeAt(enemy.x, enemy.y);
        enemy.destroy();
        playSfx('collision');
      }

      // Smoke also eats whatever is being shot at you.
      if (hazard.kind === 'smoke') {
        const shots = this.enemyBullets.getChildren();
        for (let j = shots.length - 1; j >= 0; j--) {
          const shot = shots[j];
          if (!shot.active) continue;
          if (Math.hypot(shot.x - hazard.x, shot.y - hazard.y) <= HAZARD_RADIUS) {
            shot.destroy();
          }
        }
      }
    }
    this.updateHUD();
  }

  updateMissiles(dt) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i];
      missile.y -= MISSILE_SPEED * dt;
      missile.sprite.setPosition(missile.x, missile.y);

      if (missile.y < -30) {
        missile.sprite.destroy();
        this.missiles.splice(i, 1);
        continue;
      }

      // A missile does not stop at the first car - that is the point of it.
      const enemies = this.enemies.getChildren();
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (!enemy.active) continue;
        if (Math.hypot(enemy.x - missile.x, enemy.y - missile.y) > MISSILE_RADIUS) continue;

        this.score += 200;
        this.explodeAt(enemy.x, enemy.y);
        enemy.destroy();
      }
    }
  }

  spawnEnemy() {
    const fromTop = Math.random() > 0.5;
    const x = ROAD.left + CAR.margin + Math.random() * (ROAD.width - CAR.margin * 2);
    const y = fromTop ? -ENEMY.h : GAME_HEIGHT + ENEMY.h;
    const vY = fromTop
      ? ENEMY.minSpeed + Math.random() * (ENEMY.maxSpeed - ENEMY.minSpeed)
      : -(ENEMY.minSpeed + Math.random() * (ENEMY.maxSpeed - ENEMY.minSpeed));

    // The look is paint only: speed and firing below do not read it.
    const look = ENEMY_LOOKS[Math.floor(Math.random() * ENEMY_LOOKS.length)];
    const e = this.add.sprite(x, y, look);
    e.look = look;
    e.setOrigin(0.5, 0.5);
    e.setData('vY', vY);
    e.setData('lastFire', 0);
    e.setDepth(4);
    this.enemies.add(e);
  }

  enemyFire(enemy, time) {
    const isRocket = Math.random() < ENEMY.rocketChance;
    const tex = isRocket ? 'rocket' : 'enemyBullet';
    const speed = isRocket ? ENEMY.rocketSpeed : ENEMY.bulletSpeed;

    const dx = this.carX - enemy.x;
    const dy = this.carY - enemy.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const vx = (dx / len) * speed;
    const vy = (dy / len) * speed;

    const eb = this.add.sprite(enemy.x, enemy.y, tex);
    eb.setOrigin(0.5, 0.5);
    eb.setData('vX', vx);
    eb.setData('vY', vy);
    eb.setData('damage', isRocket ? 2 : 1);
    if (isRocket) eb.setFlipY(vy > 0);
    eb.setDepth(5);
    this.enemyBullets.add(eb);
    playSfx(isRocket ? 'enemyRocket' : 'enemyShoot');
  }

  playerHit(damage) {
    if (this.invulnerable) return;

    this.playerHP = Math.max(0, this.playerHP - damage);

    if (this.playerHP <= 0) {
      this.playerDie();
    } else {
      this.invulnerable = true;
      this.invulnUntil = this.time.now + INVULN_TIME;
    }
    this.updateHUD();
  }

  playerDie() {
    this.explodeAt(this.carX, this.carY);
    this.player.setVisible(false);

    this.playerLives--;

    if (this.playerLives <= 0) {
      this.showGameOver();
      return;
    }

    this.time.delayedCall(RESPAWN_TIME, () => {
      this.carX = GAME_WIDTH / 2;
      this.carY = GAME_HEIGHT / 2;
      this.playerHP = PLAYER_MAX_HP;
      this.invulnerable = true;
      this.invulnUntil = this.time.now + INVULN_TIME * 1.5;
      this.player.setVisible(true);
      this.player.setAlpha(1);
      this.updateHUD();
    });
  }

  showGameOver() {
    this.gameOver = true;
    this.player.setVisible(false);
    music.stop();

    const mid = GAME_WIDTH / 2;
    this.add.rectangle(mid, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(100);
    this.add.rectangle(mid, GAME_HEIGHT / 2 + 30, 340, 290, 0x05070c, 0.92)
      .setStrokeStyle(2, 0xff4444).setDepth(100);
    this.add.text(mid, GAME_HEIGHT / 2 - 80, 'GAME OVER', textStyle(36, '#ff4444')).setOrigin(0.5).setDepth(101);
    this.add.text(mid, GAME_HEIGHT / 2 - 38, 'SCORE ' + this.score, textStyle(18, '#ffffff')).setOrigin(0.5).setDepth(101);
    this.add.text(mid, GAME_HEIGHT / 2 - 10, 'PRESS R TO RESTART', textStyle(14, '#9ad07a')).setOrigin(0.5).setDepth(101);

    const table = this.add.text(mid, GAME_HEIGHT / 2 + 20, '', textStyle(14, '#ffe98a'))
      .setOrigin(0.5, 0).setDepth(101);

    const showTable = () => table.setText(Arcade.Scores.format(GAME_KEY));

    if (Arcade.Scores.qualifies(GAME_KEY, this.score)) {
      Arcade.Scores.promptInitials(this.score, (initials) => {
        Arcade.Scores.submit(GAME_KEY, initials, this.score);
        showTable();
      });
    }
    showTable();

  }
  updateHUD() {
    this.lifeIcons.forEach((icon, i) => icon.setVisible(i < this.playerLives));
    const hpBar = '♥'.repeat(this.playerHP) + '♡'.repeat(PLAYER_MAX_HP - this.playerHP);
    this.hpText.setText(hpBar);
    if (this.scoreText) this.scoreText.setText(`SCORE: ${this.score || 0}`);
    if (this.weaponText) {
      this.weaponText.setText(
        this.weapon ? `${WEAPONS[this.weapon].name} x${this.weaponAmmo}  [SHIFT]` : ''
      );
      const armed = !!this.weapon;
      this.weaponPanel.setVisible(armed);
      this.weaponIcon.setVisible(armed);
      if (armed) {
        this.weaponIcon.setTexture(this.weapon).setScale(this.weapon === 'missile' ? 0.9 : 0.45);
      }
    }
  }

  explodeAt(x, y) {
    const fire = this.add.sprite(x, y, 'explosion').setDepth(10).setScale(0.4);
    this.tweens.add({
      targets: fire, scale: 1.7, alpha: 0, duration: 420,
      onComplete: () => fire.destroy(),
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const d = 26 + Math.random() * 24;
      const bit = this.add.sprite(x, y, 'debris').setDepth(10).setScale(1.5);
      this.tweens.add({
        targets: bit, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        angle: Math.random() < 0.5 ? -360 : 360, alpha: 0, duration: 520,
        onComplete: () => bit.destroy(),
      });
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: GameScene,
};

const game = new Phaser.Game(config);

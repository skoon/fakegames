const GAME_WIDTH = 480;
const GAME_HEIGHT = 720;

const ROAD_SPEED = 250;

const ROAD = { left: 90, right: 390, width: 300, shoulder: 10 };
const LANE_COUNT = 3;
const LANE_WIDTH = ROAD.width / LANE_COUNT;
const TILE_HEIGHT = 144;

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

function generateRoadTexture(scene) {
  const g = scene.make.graphics({ add: false });
  const { left, right, width, shoulder } = ROAD;

  g.fillStyle(0x2d5a1e);
  g.fillRect(0, 0, GAME_WIDTH, TILE_HEIGHT);
  g.fillStyle(0x255018);
  for (let i = 0; i < 30; i++) {
    g.fillRect(Math.random() * left, Math.random() * TILE_HEIGHT, 4 + Math.random() * 16, 4 + Math.random() * 8);
  }
  for (let i = 0; i < 30; i++) {
    g.fillRect(right + Math.random() * (GAME_WIDTH - right), Math.random() * TILE_HEIGHT, 4 + Math.random() * 16, 4 + Math.random() * 8);
  }

  g.fillStyle(0x5a4a3a);
  g.fillRect(left - shoulder, 0, shoulder, TILE_HEIGHT);
  g.fillRect(right, 0, shoulder, TILE_HEIGHT);
  g.fillStyle(0x4a3a2a);
  for (let i = 0; i < 16; i++) {
    const sx = (i < 8 ? left - shoulder : right) + Math.random() * shoulder;
    g.fillRect(sx, Math.random() * TILE_HEIGHT, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }

  g.fillStyle(0x404040);
  g.fillRect(left, 0, width, TILE_HEIGHT);
  g.fillStyle(0x484848);
  for (let i = 0; i < 40; i++) {
    g.fillRect(left + 4 + Math.random() * (width - 8), Math.random() * TILE_HEIGHT, 2, 2);
  }

  g.fillStyle(0xffffff);
  g.fillRect(left, 0, 3, TILE_HEIGHT);
  g.fillRect(right - 3, 0, 3, TILE_HEIGHT);

  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const lx = left + lane * LANE_WIDTH;
    for (let y = 0; y < TILE_HEIGHT + 36; y += 36) {
      g.fillRect(lx - 2, y - 30, 4, 20);
    }
  }

  g.fillStyle(0xffffff);
  g.fillRect(left, 0, 1, TILE_HEIGHT);
  g.fillRect(right - 1, 0, 1, TILE_HEIGHT);

  g.generateTexture('road', GAME_WIDTH, TILE_HEIGHT);
}

function generateBulletTexture(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff);
  g.fillRect(2, 0, 4, 8);
  g.fillStyle(0xffff88);
  g.fillRect(2, 0, 4, 6);
  g.fillStyle(0xffff44);
  g.fillRect(2, 0, 4, 4);
  g.generateTexture('bullet', 8, 8);
}

function generateEnemyBulletTexture(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xff4444);
  g.fillRect(1, 0, 6, 8);
  g.fillStyle(0xffaa44);
  g.fillRect(2, 1, 4, 5);
  g.fillStyle(0xffff88);
  g.fillRect(3, 2, 2, 3);
  g.generateTexture('enemyBullet', 8, 8);
}

function generateRocketTexture(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x884422);
  g.fillRect(2, 0, 8, 18);
  g.fillStyle(0xcc6633);
  g.fillRect(3, 0, 6, 16);
  g.fillStyle(0xff8844);
  g.fillRect(4, 1, 4, 12);
  g.fillStyle(0xffaa44);
  g.fillRect(4, 14, 4, 4);
  g.fillStyle(0xffff88);
  g.fillRect(5, 15, 2, 3);
  g.generateTexture('rocket', 12, 18);
}
let audioContext = null;
let audioMasterGain = null;

function initAudioContext() {
  if (audioContext) return audioContext;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  audioContext = new AudioCtx();
  // create a master gain so we can mute/unmute cleanly
  try {
    audioMasterGain = audioContext.createGain();
    audioMasterGain.gain.setValueAtTime(1, audioContext.currentTime);
    audioMasterGain.connect(audioContext.destination);
  } catch (e) {
    audioMasterGain = null;
  }
  return audioContext;
}

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

function playTone(frequency, duration = 0.12, type = 'square', volume = 0.16, startOffset = 0) {
  const context = initAudioContext();
  if (!context) return;
  const now = context.currentTime + startOffset;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.setValueAtTime(volume, now + duration * 0.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  if (audioMasterGain) oscillator.connect(gain).connect(audioMasterGain);
  else oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playNoise(duration = 0.12, volume = 0.2) {
  const context = initAudioContext();
  if (!context) return;
  const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  const now = context.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  if (audioMasterGain) source.connect(gain).connect(audioMasterGain);
  else source.connect(gain).connect(context.destination);
  source.start(now);
  source.stop(now + duration + 0.02);
}

const MUSIC_PATTERN = [
   { note: 'F1', dur: 0.12 }, { note: 'F1', dur: 0.12 },
  { note: 'G1', dur: 0.12 }, { note: 'F1', dur: 0.12 },
  { note: 'G#1', dur: 0.12}, 
  { note: 'F1', dur: 0.12 }, { note: 'B1', dur: 0.12 },
  { note: 'A1', dur: 0.12 }, 
];

function startMusic(scene) {
  if (scene.musicEvent || !initAudioContext()) return;
  scene.musicIndex = 0;
  scene.musicEvent = scene.time.addEvent({
    delay: 190,
    loop: true,
    callback: () => {
      const part = MUSIC_PATTERN[scene.musicIndex];
      if (part && part.note) {
        playTone(noteToFrequency(part.note), part.dur, 'square', 0.14);
      }
      scene.musicIndex = (scene.musicIndex + 1) % MUSIC_PATTERN.length;
    },
  });
}

function startAudio(scene) {
  if (scene.audioStarted) return;
  scene.audioStarted = true;
  const context = initAudioContext();
  if (!context) return;
  if (context.state === 'suspended') {
    context.resume().then(() => startMusic(scene)).catch(() => startMusic(scene));
  } else {
    startMusic(scene);
  }
}

function playSfx(key) {
  const context = initAudioContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume();
  switch (key) {
    case 'playerShoot':
      playTone(1100, 0.08, 'square', 0.22);
      break;
    case 'enemyShoot':
      playTone(760, 0.09, 'square', 0.18);
      break;
    case 'enemyRocket':
      playTone(520, 0.18, 'triangle', 0.16);
      playTone(300, 0.18, 'sawtooth', 0.12);
      break;
    case 'collision':
      playNoise(0.12, 0.24);
      break;
    default:
      break;
  }
}
function generateEnemyTexture(scene) {
  const g = scene.make.graphics({ add: false });
  const w = ENEMY.w, h = ENEMY.h;

  g.fillStyle(0x000000, 0.3);
  g.fillRect(2, 2, w + 2, h + 2);
  g.fillStyle(0x000000, 0.2);
  g.fillRect(4, 4, w, h);

  g.fillStyle(0x1a1a1a);
  g.fillRect(0, 7, 7, 10);
  g.fillRect(w - 7, 7, 7, 10);
  g.fillRect(0, h - 17, 7, 10);
  g.fillRect(w - 7, h - 17, 7, 10);

  g.fillStyle(0x444444);
  g.fillRect(1, 8, 5, 8);
  g.fillRect(w - 6, 8, 5, 8);
  g.fillRect(1, h - 16, 5, 8);
  g.fillRect(w - 6, h - 16, 5, 8);

  g.fillStyle(0x1a4466);
  g.fillRect(6, 32, 20, 18);
  g.fillRect(4, 14, 24, 20);
  g.fillRect(7, 2, 18, 14);

  g.fillStyle(0x225577);
  g.fillRect(5, 30, 22, 20);
  g.fillRect(3, 12, 26, 20);
  g.fillRect(6, 1, 20, 14);

  g.fillStyle(0x5588aa);
  g.fillRect(10, 10, 12, 10);
  g.fillStyle(0x3377aa);
  g.fillRect(10, 11, 12, 8);

  g.fillStyle(0x5588aa);
  g.fillRect(10, 34, 12, 8);
  g.fillStyle(0x3377aa);
  g.fillRect(10, 35, 12, 6);

  g.fillStyle(0xffee88);
  g.fillRect(6, 0, 6, 3);
  g.fillRect(w - 12, 0, 6, 3);
  g.fillStyle(0xffffcc);
  g.fillRect(7, 0, 4, 2);
  g.fillRect(w - 11, 0, 4, 2);

  g.fillStyle(0xff3333);
  g.fillRect(7, h - 3, 6, 3);
  g.fillRect(w - 13, h - 3, 6, 3);

  g.fillStyle(0x447799);
  g.fillRect(15, 3, 2, 6);
  g.fillRect(15, 28, 2, 8);

  g.fillStyle(0xcc6600);
  g.fillRect(4, 26, 4, 4);
  g.fillRect(w - 8, 26, 4, 4);

  g.generateTexture('enemy', w + 8, h + 8);
}

function generateExplosionTexture(scene) {
  const g = scene.make.graphics({ add: false });
  const s = 32;
  g.fillStyle(0xff6600);
  g.fillRect(s / 2 - 1, 0, 2, s);
  g.fillRect(0, s / 2 - 1, s, 2);
  g.fillRect(4, 4, s - 8, s - 8);
  g.fillStyle(0xffaa00);
  g.fillRect(s / 2 - 1, 4, 2, s - 8);
  g.fillRect(4, s / 2 - 1, s - 8, 2);
  g.fillStyle(0xffff44);
  g.fillRect(s / 2 - 1, s / 2 - 1, 2, 2);
  g.fillRect(s / 4, s / 4, 2, 2);
  g.fillRect(s * 3 / 4 - 2, s / 4, 2, 2);
  g.fillRect(s / 4, s * 3 / 4 - 2, 2, 2);
  g.fillRect(s * 3 / 4 - 2, s * 3 / 4 - 2, 2, 2);
  g.generateTexture('explosion', s, s);
}

function generateCarTexture(scene) {
  const g = scene.make.graphics({ add: false });
  const w = CAR.w, h = CAR.h;

  g.fillStyle(0x000000, 0.3);
  g.fillRect(2, 2, w + 2, h + 2);
  g.fillStyle(0x000000, 0.2);
  g.fillRect(4, 4, w, h);

  g.fillStyle(0x1a1a1a);
  g.fillRect(0, 7, 7, 10);
  g.fillRect(w - 7, 7, 7, 10);
  g.fillRect(0, h - 17, 7, 10);
  g.fillRect(w - 7, h - 17, 7, 10);

  g.fillStyle(0x444444);
  g.fillRect(1, 8, 5, 8);
  g.fillRect(w - 6, 8, 5, 8);
  g.fillRect(1, h - 16, 5, 8);
  g.fillRect(w - 6, h - 16, 5, 8);

  g.fillStyle(0xcccccc);
  g.fillRect(6, 32, 20, 18);
  g.fillRect(4, 14, 24, 20);
  g.fillRect(7, 2, 18, 14);

  g.fillStyle(0xffffff);
  g.fillRect(5, 30, 22, 20);
  g.fillRect(3, 12, 26, 20);
  g.fillRect(6, 1, 20, 14);

  g.fillStyle(0x5599cc);
  g.fillRect(10, 10, 12, 10);
  g.fillStyle(0x3377aa);
  g.fillRect(10, 11, 12, 8);
  g.fillStyle(0x5599cc);
  g.fillRect(10, 34, 12, 8);
  g.fillStyle(0x3377aa);
  g.fillRect(10, 35, 12, 6);

  g.fillStyle(0xffee88);
  g.fillRect(6, 0, 6, 3);
  g.fillRect(w - 12, 0, 6, 3);
  g.fillStyle(0xffffcc);
  g.fillRect(7, 0, 4, 2);
  g.fillRect(w - 11, 0, 4, 2);

  g.fillStyle(0xff3333);
  g.fillRect(7, h - 3, 6, 3);
  g.fillRect(w - 13, h - 3, 6, 3);
  g.fillStyle(0xff5555);
  g.fillRect(8, h - 3, 4, 2);
  g.fillRect(w - 12, h - 3, 4, 2);

  g.fillStyle(0x333333);
  g.fillRect(15, 3, 2, 6);
  g.fillRect(15, 28, 2, 8);
  g.fillStyle(0xcc2222);
  g.fillRect(4, 26, 4, 4);
  g.fillRect(w - 8, 26, 4, 4);

  g.generateTexture('car', w + 8, h + 8);
}

function makeTextTexture(scene, key, string, size, color) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  c.width = 400;
  c.height = 80;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = `bold ${size}px monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(string, c.width / 2, c.height / 2);
  scene.textures.addCanvas(key, c);
}

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    generateRoadTexture(this);
    generateCarTexture(this);
    generateBulletTexture(this);
    generateEnemyTexture(this);
    generateExplosionTexture(this);
    generateEnemyBulletTexture(this);
    generateRocketTexture(this);
    makeTextTexture(this, 'go_title', 'GAME OVER', 36, '#ff3333');
    makeTextTexture(this, 'go_hint', 'Press R to restart', 16, '#ffffff');

    this.road = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'road');
    this.road.setOrigin(0, 0);

    this.player = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'car');
    this.player.setOrigin(0.5, 0.5);

    this.input.keyboard.once('keydown', () => startAudio(this));
    
    // Mute state and UI
    this.muted = false;
    this.muteButton = this.add.text(GAME_WIDTH - 10, 50, 'MUTE', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', backgroundColor: '#222222', padding: { x: 6, y: 4 },
    }).setOrigin(1, 0).setDepth(10).setInteractive();
    this.muteButton.on('pointerdown', () => this.toggleMute());
    const mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.on('down', () => this.toggleMute());

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.bullets = this.add.group();
    this.lastFired = 0;

    this.enemies = this.add.group();
    this.nextSpawn = 500;

    this.enemyBullets = this.add.group();

    this.carX = GAME_WIDTH / 2;
    this.carY = GAME_HEIGHT / 2;

    this.playerHP = PLAYER_MAX_HP;
    this.playerLives = PLAYER_LIVES;
    this.invulnerable = false;
    this.invulnUntil = 0;
    this.gameOver = false;

    this.livesText = this.add.text(GAME_WIDTH - 10, 10, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
    }).setOrigin(1, 0).setDepth(10);
    this.hpText = this.add.text(GAME_WIDTH - 10, 30, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ff4444',
    }).setOrigin(1, 0).setDepth(10);

    this.score = 0;
    this.scoreText = this.add.text(10, 10, 'SCORE: 0', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffff88',
    }).setOrigin(0, 0).setDepth(10);

    // Load persistent high scores (top 5) and normalize to {name,score}
    let hs = [];
    try {
      const raw = localStorage.getItem('fakespyhunter_highscores');
      if (raw) hs = JSON.parse(raw);
    } catch (e) {
      hs = [];
    }
    this.highScores = Array.isArray(hs) ? hs.map((it) => {
      if (it == null) return { name: '---', score: 0 };
      if (typeof it === 'number') return { name: '---', score: it };
      if (typeof it === 'object' && typeof it.score === 'number') return { name: it.name || '---', score: it.score };
      return { name: '---', score: 0 };
    }) : [];

    this.updateHUD();

    this.started = false;
    this.startOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(20);
    this.startTitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'FAKE SPY HUNTER', {
      fontFamily: 'monospace', fontSize: '32px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(21);
    this.startHint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'PRESS SPACE TO START', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffdd55', align: 'center',
    }).setOrigin(0.5).setDepth(21);

    const hsText = (this.highScores && this.highScores.length)
      ? this.highScores.map((v, i) => `${i + 1}. ${v.name} ${v.score}`).join('\n')
      : 'No high scores';
    this.startHighText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, hsText, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(21);

    this.input.keyboard.once('keydown-SPACE', () => {
      this.startGame();
    });

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

  startGame() {
    this.started = true;
    this.startOverlay.destroy();
    this.startTitle.destroy();
    this.startHint.destroy();
    if (this.startHighText) this.startHighText.destroy();
    startAudio(this);
  }

  toggleMute() {
    this.muted = !this.muted;
    const ctx = initAudioContext();
    if (audioMasterGain && ctx) {
      try {
        audioMasterGain.gain.setValueAtTime(this.muted ? 0.0001 : 1, ctx.currentTime);
      } catch (e) {
        // ignore
      }
    }
    if (this.muteButton) this.muteButton.setText(this.muted ? 'UNMUTE' : 'MUTE');
  }
  

  update(time, delta) {
    if (!this.started || this.gameOver) return;

    const dt = delta / 1000;

    if (this.invulnerable && time > this.invulnUntil) {
      this.invulnerable = false;
      this.player.setAlpha(1);
    }

    if (this.invulnerable) {
      this.player.setAlpha(Math.sin(time * 0.015) > 0 ? 1 : 0.2);
    }

    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.carY -= CAR.moveSpeed * dt;
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.carY += CAR.moveSpeed * dt;
    }
    const yMargin = 80;
    this.carY = Phaser.Math.Clamp(this.carY, yMargin, GAME_HEIGHT - yMargin);

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.carX -= CAR.turnSpeed * dt;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.carX += CAR.turnSpeed * dt;
    }
    this.carX = Phaser.Math.Clamp(
      this.carX, ROAD.left + CAR.margin, ROAD.right - CAR.margin,
    );

    this.road.tilePositionY -= ROAD_SPEED * dt;
    this.player.x = this.carX;
    this.player.y = this.carY;

    if (this.spaceKey.isDown && time > this.lastFired + FIRE_RATE) {
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

  spawnEnemy() {
    const fromTop = Math.random() > 0.5;
    const x = ROAD.left + CAR.margin + Math.random() * (ROAD.width - CAR.margin * 2);
    const y = fromTop ? -ENEMY.h : GAME_HEIGHT + ENEMY.h;
    const vY = fromTop
      ? ENEMY.minSpeed + Math.random() * (ENEMY.maxSpeed - ENEMY.minSpeed)
      : -(ENEMY.minSpeed + Math.random() * (ENEMY.maxSpeed - ENEMY.minSpeed));

    const e = this.add.sprite(x, y, 'enemy');
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

    // Prepare high score list and determine if this is a new top-5
    const prev = Array.isArray(this.highScores) ? this.highScores.slice() : [];
    const playerScore = this.score || 0;
    prev.push({ name: '', score: playerScore });
    prev.sort((a, b) => b.score - a.score);
    const newIndex = prev.findIndex(p => p.name === '' && p.score === playerScore);
    const top = prev.slice(0, 5);
    this.highScores = top;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(100);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'go_title').setDepth(101);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'go_hint').setDepth(101);

    if (newIndex !== -1 && newIndex < 5) {
      // Collect initials for new high score
      this.collectingInitials = true;
      this.initials = '';
      this.initialsText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, 'ENTER INITIALS: ___', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffdd55', align: 'center',
      }).setOrigin(0.5).setDepth(102);

      const handler = (event) => {
        if (!this.collectingInitials) return;
        const key = event.key;
        if (key === 'Backspace') {
          this.initials = this.initials.slice(0, -1);
        } else if (key === 'Enter') {
          if (this.initials.length === 0) return;
          // finalize name and save
          prev[newIndex].name = this.initials.padEnd(3).slice(0, 3);
          const finalTop = prev.slice(0, 5);
          this.highScores = finalTop;
          try { localStorage.setItem('fakespyhunter_highscores', JSON.stringify(finalTop)); } catch (e) { /* ignore */ }
          if (this.initialsText) this.initialsText.destroy();
          const hsText = finalTop.length ? finalTop.map((v, i) => `${i + 1}. ${v.name} ${v.score}`).join('\n') : 'No high scores';
          this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140, hsText, {
            fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', align: 'center',
          }).setOrigin(0.5).setDepth(101);
          this.input.keyboard.once('keydown-R', () => this.scene.restart());
          this.input.keyboard.off('keydown', handler);
          this.collectingInitials = false;
        } else if (/^[a-zA-Z]$/.test(key) && this.initials.length < 3) {
          this.initials += key.toUpperCase();
        }
        if (this.initialsText) this.initialsText.setText(`ENTER INITIALS: ${this.initials.padEnd(3, '_')}`);
      };

      this.input.keyboard.on('keydown', handler);
    } else {
      // Not a new high score - save list and show it
      try { localStorage.setItem('fakespyhunter_highscores', JSON.stringify(top)); } catch (e) { /* ignore */ }
      const hsText = top.length ? top.map((v, i) => `${i + 1}. ${v.name} ${v.score}`).join('\n') : 'No high scores';
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, hsText, {
        fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', align: 'center',
      }).setOrigin(0.5).setDepth(101);
      this.input.keyboard.once('keydown-R', () => {
        this.scene.restart();
      });
    }
  }

  updateHUD() {
    this.livesText.setText(`LIVES: ${this.playerLives}`);
    const hpBar = '♥'.repeat(this.playerHP) + '♡'.repeat(PLAYER_MAX_HP - this.playerHP);
    this.hpText.setText(hpBar);
    if (this.scoreText) this.scoreText.setText(`SCORE: ${this.score || 0}`);
  }

  explodeAt(x, y) {
    const ex = this.add.sprite(x, y, 'explosion');
    ex.setDepth(10);
    ex.setScale(0.5);
    ex.setAlpha(0.9);
    this.tweens.add({
      targets: ex,
      scale: 1.5, alpha: 0,
      duration: 350,
      onComplete: () => ex.destroy(),
    });
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

const TILE = 16;
const COLS = 36;
const ROWS = 28;
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;

const TILE_EMPTY = 0;
const TILE_DIRT = 1;
const TILE_WALL = 2;
const TILE_ROCK = 3;

const PLAYER_SPEED = 90;
const ENEMY_SPEED_BASE = 35;
const ENEMY_PHASE_SPEED = 18;
const PUMP_DURATION = 300;
const STUN_DURATION = 1000;
const PUMPS_TO_KILL = 4;

// Points per kill, keyed by what did the killing.
//
// A crushed enemy scores nothing on its own: a rock pays by how many it caught
// at once, which crushEnemies() awards. That is the whole risk/reward of Dig
// Dug - luring a second monster under the same rock is worth more than two
// separate drops.
const ENEMY_SCORE = {
    pump: { pooka: 500, fygar: 1000 },
    rock: { pooka: 0, fygar: 0 },
};

// Index is how many went under one rock. Four is the practical maximum.
const ROCK_CHAIN_SCORE = [0, 1000, 2500, 4000, 6000];

// The prize that appears mid-tunnel once you have dropped two rocks.
const VEGETABLE_POINTS = [400, 600, 800, 1000, 2000, 3000];
const VEGETABLE_LIFETIME = 10000; // ms on screen
const VEGETABLE_ROCKS_REQUIRED = 2;

const STORE = { score: 0, lives: 3, level: 1, showTitle: true };
const GAME_KEY = 'digdug';

/* ------------------------------------------------------------------ art ---
 *
 * The garden: a mole with a miner's lamp digs through four layers of soil,
 * hosing up grubs and fire ants. Only the look is new - the rules above are
 * untouched, and the enemies keep their `pooka`/`fygar` ids internally.
 *
 * Sprites are pixel maps: one string per row, one character per pixel, '.'
 * for transparent. Every map faces right; the game mirrors or rotates it.
 */
const SPRITES = {
    mole0: {
        palette: {
            K: '#2b1a10', B: '#6e4a32', b: '#9a6e4c', W: '#ffffff', E: '#111111',
            P: '#f2a0a8', H: '#f2b632', h: '#b07a14', Y: '#fff3a0',
        },
        rows: [
            '................',
            '......hhhhh.....',
            '.....hHHHHHhY...',
            '....hHHHHHHHhYY.',
            '....KKKKKKKKKK..',
            '...KBBBBBBBbbbK.',
            '..KBBBBBBBbWEbbK',
            '..KBBBBBBBbbbbbP',
            '.KBBBBBBBBBbbbKP',
            '.KBBBBBBBBBBbK..',
            '.KBBBBBBBBBBBK..',
            '.KBBBBBBBBBBPPP.',
            '..KBBBBBBBBKPP..',
            '...KBBBBBBK.....',
            '...PPK..KPP.....',
            '................',
        ],
    },
    grub: {
        palette: {
            K: '#5a4630', C: '#f3e7c9', c: '#cdb98e', D: '#8b5a2b',
            W: '#ffffff', E: '#111111', p: '#f4a6b0', L: '#6b4a2e',
        },
        rows: [
            '................',
            '................',
            '................',
            '................',
            '.....KKKKK......',
            '...KKCCCCCKKKK..',
            '..KCCcCCcCKDDDK.',
            '.KCCCcCCcCKDWEDK',
            '.KCCCcCCcCKDDpDK',
            '.KcCCcCCcCKDDDDK',
            '..KccccccccKKKK.',
            '...KKKKKKKK.....',
            '....L.L.L.L.....',
            '................',
            '................',
            '................',
        ],
    },
    ant: {
        // Bright, and without a dark outline: it lives on dark tunnel floor.
        palette: {
            R: '#e23a22', r: '#9c1c10', h: '#ff8a6a', W: '#ffffff', E: '#111111',
            M: '#f0c080', L: '#b0442e',
        },
        rows: [
            '................',
            '................',
            '..........L..L..',
            '...........LL...',
            '..........RRRR..',
            '.rrrr....RRRRRR.',
            'rRRRRr...RRWERRM',
            'RRhRRRr.RRRRRRMM',
            'RRRRRRRrRRRRRR..',
            'rRRRRRr.rRRr....',
            '.rrrr..L.L.L....',
            '......L..L..L...',
            '.....L...L...L..',
            '................',
            '................',
            '................',
        ],
    },
    flame0: {
        palette: { r: '#b81a00', O: '#ff6a00', Y: '#ffcf1a', W: '#fff6c8' },
        rows: [
            '................',
            '................',
            '................',
            '................',
            '......rrr.......',
            '....rrOOOr......',
            '..rrOOOYYOr.....',
            'rrOOYYYWWYOr....',
            'rrOOYYYWWYOOr...',
            '..rrOOOYYYOr....',
            '....rrOOOr......',
            '......rrr.......',
            '................',
            '................',
            '................',
            '................',
        ],
    },
    flame1: {
        palette: { r: '#b81a00', O: '#ff6a00', Y: '#ffcf1a', W: '#fff6c8' },
        rows: [
            '................',
            '................',
            '................',
            '........r.......',
            '.....rrrOr......',
            '...rrOOOYOr.....',
            '.rrOOYYYWYOr....',
            'rOOYYYWWWYOOr...',
            '.rrOOYYYWYOr....',
            '...rrOOOYOr.....',
            '.....rrrOr......',
            '........r.......',
            '................',
            '................',
            '................',
            '................',
        ],
    },
    carrot: {
        palette: { K: '#3a2010', O: '#f07a18', o: '#b8520c', G: '#4cc23c', g: '#267a24' },
        rows: [
            '................',
            '......g..g......',
            '.....gGggGg.....',
            '......gGGg......',
            '.....KKKKKK.....',
            '.....KOOOoK.....',
            '.....KOoOOK.....',
            '.....KOOOoK.....',
            '......KOoK......',
            '......KOOK......',
            '......KoOK......',
            '.......KK.......',
            '................',
            '................',
            '................',
            '................',
        ],
    },
    turnip: {
        palette: { K: '#3a2030', W: '#f4f0e6', p: '#a44fbf', G: '#4cc23c', g: '#267a24' },
        rows: [
            '................',
            '......g.g.......',
            '.....gGgGg......',
            '......gGg.......',
            '.....KKKKK......',
            '....KWWWWWK.....',
            '...KpWWWWWWK....',
            '...KppWWWWWK....',
            '...KpppWWWWK....',
            '....KppWWWK.....',
            '.....KKWKK......',
            '.......K........',
            '................',
            '................',
            '................',
            '................',
        ],
    },
    mushroom: {
        palette: { K: '#3a1a10', R: '#e23a2a', W: '#fbf6ea', T: '#e8d8b8', t: '#b89a70' },
        rows: [
            '................',
            '................',
            '.....KKKKKK.....',
            '...KKRRWRRRKK...',
            '..KRRRRRRWRRRK..',
            '..KRWWRRRRRRRK..',
            '.KRRWWRRRWWRRRK.',
            '.KKKKKKKKKKKKKK.',
            '......KTTK......',
            '......KTtK......',
            '......KTtK......',
            '.....KTTTtK.....',
            '.....KKKKKK.....',
            '................',
            '................',
            '................',
        ],
    },
    eggplant: {
        palette: { K: '#24102a', P: '#7a2f8f', p: '#a44fbf', G: '#4cc23c', g: '#267a24' },
        rows: [
            '................',
            '.....gG.........',
            '....gGGg........',
            '....KgGgK.......',
            '...KPPgPPK......',
            '...KPpPPPPK.....',
            '...KPpPPPPPK....',
            '....KPPPPPPPK...',
            '....KPpPPPPPPK..',
            '.....KPPPPPPPK..',
            '......KPPPPPK...',
            '.......KKKKK....',
            '................',
            '................',
            '................',
            '................',
        ],
    },
    tomato: {
        palette: { K: '#3a0e0a', R: '#e23a2a', r: '#a0201a', W: '#ffd0c8', G: '#4cc23c', g: '#267a24' },
        rows: [
            '................',
            '................',
            '.......g........',
            '.....gGgGg......',
            '...KKKgGgKKK....',
            '..KRRRRgRRRRK...',
            '.KRWRRRRRRRRRK..',
            '.KRWRRRRRRRRRK..',
            '.KRRRRRRRRRRrK..',
            '.KRRRRRRRRRrrK..',
            '..KRRRRRRRrrK...',
            '...KKKKKKKKK....',
            '................',
            '................',
            '................',
            '................',
        ],
    },
    pumpkin: {
        palette: { K: '#3a1a06', O: '#f08a1c', o: '#b85e0c', G: '#4cc23c', g: '#267a24' },
        rows: [
            '................',
            '................',
            '.......gg.......',
            '......gg........',
            '...KKKKgKKKK....',
            '..KOOoOOgOoOOK..',
            '.KOOoOOOOOOoOOK.',
            '.KOOoOOOOOOoOOK.',
            '.KOOoOOOOOOoOOK.',
            '.KOOoOOOOOOoOOK.',
            '..KOOoOOOOoOOK..',
            '...KKKKKKKKKK...',
            '................',
            '................',
            '................',
            '................',
        ],
    },
};

// Second dig frame: same mole, claws forward and feet swapped.
SPRITES.mole1 = {
    palette: SPRITES.mole0.palette,
    rows: SPRITES.mole0.rows.slice(0, 11).concat([
        '.KBBBBBBBBBBKPP.',
        '..KBBBBBBBBKPPP.',
        '...KBBBBBBK.....',
        '....PPK.KPP.....',
        '................',
    ]),
};

// One per entry in VEGETABLE_POINTS, cheapest first.
const VEG_KINDS = ['carrot', 'turnip', 'mushroom', 'eggplant', 'tomato', 'pumpkin'];

// Internal enemy ids stay as they were; this is only what they look like.
const ENEMY_TEXTURE = { pooka: 'grub', fygar: 'ant' };

// Soil layers, top to bottom. `until` is the last row in the layer.
const SOIL = [
    { until: 6, base: '#a8743e', dark: '#8a5c2e', light: '#c49058' }, // topsoil
    { until: 13, base: '#8a5a34', dark: '#6c4426', light: '#a47048' }, // loam
    { until: 20, base: '#9a4f2c', dark: '#783b1f', light: '#b8683e' }, // clay
    { until: ROWS, base: '#5e4636', dark: '#483428', light: '#78604c' }, // subsoil
];

const TUNNEL = { floor: '#1e140d', shade: '#120b07', lip: '#33241a' };
const SKY = ['#6ec0ee', '#8ccff2', '#a8dcf6', '#c2e8f8'];
const GRASS = { blade: '#5cc043', base: '#3e9a2e', dark: '#2c7420' };
const BEDROCK = { base: '#3b404b', dark: '#2a2e36', light: '#555c69' };

function soilBand(row) {
    return SOIL.findIndex((band) => row <= band.until);
}

/** Deterministic 0..1 noise, so the ground looks the same every time. */
function hash(x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function toInt(css) {
    return parseInt(css.slice(1), 16);
}

/** Turns a pixel map into a texture. */
function pixelTexture(scene, key, art) {
    const g = scene.make.graphics({ add: false });
    art.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch === '.') continue;
            g.fillStyle(toInt(art.palette[ch]), 1);
            g.fillRect(x, y, 1, 1);
        }
    });
    g.generateTexture(key, art.rows[0].length, art.rows.length);
    g.destroy();
}

/**
 * A boulder, shaded pixel by pixel: an irregular ball lit from the top left,
 * with a dark rim and a couple of cracks. Too big and too round to hand-map.
 */
function boulderTexture(scene) {
    const S = 32;
    const tones = [0x3d3a36, 0x5d5850, 0x807a70, 0xa8a196, 0xcfc8bb];
    const inside = (x, y) => {
        const dx = (x + 0.5 - 16) / 15;
        const dy = (y + 0.5 - 17) / 14;
        const a = Math.atan2(dy, dx);
        const r = 1 + 0.07 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a + 2);
        return dx * dx + dy * dy < r * r;
    };

    const g = scene.make.graphics({ add: false });
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            if (!inside(x, y)) continue;
            const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);

            let color;
            if (edge) {
                color = 0x26231f;
            } else {
                const dx = (x + 0.5 - 16) / 15;
                const dy = (y + 0.5 - 17) / 14;
                const dz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
                const light = -0.5 * dx - 0.6 * dy + 0.62 * dz; // from the top left
                const grain = (hash(x >> 1, y >> 1) - 0.5) * 0.25;
                const level = Math.max(0, Math.min(4, Math.round((light + grain) * 3.2 + 1)));
                color = tones[level];
            }
            g.fillStyle(color, 1);
            g.fillRect(x, y, 1, 1);
        }
    }
    // Cracks.
    g.fillStyle(0x2e2b27, 1);
    [[19, 9], [20, 10], [20, 11], [21, 12], [9, 20], [10, 21], [11, 21], [12, 22]].forEach(([x, y]) =>
        g.fillRect(x, y, 1, 1)
    );
    g.generateTexture('boulder', S, S);
    g.destroy();
}

/** A burst of eight sparks round a bright centre, for pops. */
function popTexture(scene) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xfff6c8, 1);
    g.fillRect(6, 6, 4, 4);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillRect(Math.round(7 + Math.cos(a) * 6), Math.round(7 + Math.sin(a) * 6), 2, 2);
    }
    g.generateTexture('pop', 16, 16);
    g.destroy();
}

/** Shared text style: chunky, with an outline so it reads on sky or rock. */
function textStyle(size, color) {
    return {
        fontSize: size + 'px', fontFamily: 'monospace', fontStyle: 'bold',
        color: color, stroke: '#1a1208', strokeThickness: 3, align: 'center',
    };
}

/** White at rest, flushing pink as the hose fills it. */
function inflateTint(level) {
    const t = Math.max(0, Math.min(1, level));
    const g = Math.round(255 - (255 - 0x9a) * t);
    const b = Math.round(255 - (255 - 0xa8) * t);
    return (0xff << 16) | (g << 8) | b;
}

// Dig Dug shipped silent. These are the beats that most want a sound.
const Sound = {
    dig() {
        Arcade.Audio.tone(90 + Math.random() * 30, { duration: 0.04, type: 'square', volume: 0.06 });
    },
    pump() {
        Arcade.Audio.tone(300, { slideTo: 700, duration: 0.12, type: 'square', volume: 0.16 });
    },
    pop() {
        Arcade.Audio.noise({ duration: 0.22, volume: 0.3, filterFrom: 1600, filterTo: 200 });
    },
    rock() {
        Arcade.Audio.noise({ duration: 0.35, volume: 0.35, filterFrom: 500, filterTo: 60 });
    },
    die() {
        Arcade.Audio.tone(300, { slideTo: 60, duration: 0.7, type: 'sawtooth', volume: 0.3 });
    },
    bonus() {
        [660, 880, 1320].forEach((f, i) =>
            Arcade.Audio.tone(f, { duration: 0.12, delay: i * 0.09, type: 'square', volume: 0.22 })
        );
    },
    clear() {
        [523, 659, 784, 1046].forEach((f, i) =>
            Arcade.Audio.tone(f, { duration: 0.14, delay: i * 0.12, type: 'square', volume: 0.2 })
        );
    },
};

class DigDugScene extends Phaser.Scene {
    constructor() {
        super('DigDugScene');
    }

    create() {
        this.score = STORE.score;
        this.lives = STORE.lives;
        this.level = STORE.level;

        this.generateLevel();
        this.generateTextures();

        // The ground is one canvas texture, repainted a tile at a time as it
        // is dug. A Graphics object would replay every fill ever made, every
        // frame, and grow with each tile dug.
        this.terrain = this.textures.exists('terrain')
            ? this.textures.get('terrain')
            : this.textures.createCanvas('terrain', WIDTH, HEIGHT);
        this.terrainCtx = this.terrain.getContext();
        this.add.image(0, 0, 'terrain').setOrigin(0, 0).setDepth(0);
        this.drawGrid();

        for (const rock of this.rocks) {
            rock.sprite = this.add.sprite(rock.x, rock.y, 'boulder').setDepth(2);
        }

        this.walkClock = 0;
        this.playerSpr = this.add.sprite(this.player.x, this.player.y, 'mole0').setDepth(6);

        this.enemySprs = [];
        for (const e of this.enemies) {
            const s = this.add.sprite(e.x, e.y, ENEMY_TEXTURE[e.type]).setDepth(5);
            s.setOrigin(0.5, 0.5);
            this.enemySprs.push(s);
        }

        this.fires = [];
        this.pumpGfx = this.add.graphics().setDepth(5);

        this.scoreText = this.add.text(8, 1, '', textStyle(12, '#ffffff')).setDepth(10);
        this.livesText = this.add.text(8, HEIGHT - 15, '', textStyle(12, '#f2b632')).setDepth(10);
        this.levelText = this.add.text(WIDTH - 8, 1, '', textStyle(12, '#ffffff')).setOrigin(1, 0).setDepth(10);

        this.isPumping = false;
        this.pumpTimer = 0;
        this.isDead = false;
        this.respawnTimer = 0;
        this.levelOver = false;
        this.paused = false;
        this.rocksLanded = 0;
        this.vegetable = null;

        // The title only shows for a fresh game, not between levels - both
        // arrive here through scene.restart().
        this.awaitingStart = STORE.showTitle;
        if (this.awaitingStart) this.buildTitleScreen();

        this.updateUI();

        // The shell owns the back link, pause and mute; Phaser needs telling.
        Arcade.Shell.init({
            game: GAME_KEY,
            back: '../index.html',
            onPause: () => this.scene.pause(),
            onResume: () => this.scene.resume(),
        });
    }

    /* ---------- title screen ---------- */

    buildTitleScreen() {
        const mid = WIDTH / 2;
        const top = 34;

        // Who's who, with the real sprites beside the points.
        const legend = [
            ['grub', 'GRUB', '500'],
            ['ant', 'FIRE ANT', '1000'],
            ['boulder', 'DROP A ROCK', '1000+'],
        ];
        const legendParts = [];
        legend.forEach(([key, name, pts], i) => {
            const y = top + 206 + i * 24;
            const icon = this.add.sprite(mid - 96, y, key).setDepth(20);
            if (key === 'boulder') icon.setScale(0.6);
            legendParts.push(
                icon,
                this.add.text(mid - 76, y, name, textStyle(12, '#f3e7c9')).setOrigin(0, 0.5).setDepth(20),
                this.add.text(mid + 104, y, pts, textStyle(12, '#f2b632')).setOrigin(1, 0.5).setDepth(20)
            );
        });

        this.titleParts = [
            this.add.rectangle(mid, HEIGHT / 2, WIDTH, HEIGHT, 0x120c08, 0.84).setDepth(19),
            this.add.sprite(mid - 124, top + 24, 'mole0').setScale(3).setDepth(20),
            this.add.text(mid + 22, top + 12, 'FAKE DIGDUG', textStyle(34, '#f2b632')).setOrigin(0.5).setDepth(20),
            this.add.text(mid + 22, top + 42, 'THE GARDEN IS INFESTED', textStyle(12, '#9ad07a')).setOrigin(0.5).setDepth(20),
            this.add.text(mid, top + 84, 'PRESS SPACE TO START', textStyle(15, '#ffffff')).setOrigin(0.5).setDepth(20),
            this.add.text(mid, top + 106, Arcade.Scores.format(GAME_KEY), textStyle(12, '#ffe98a')).setOrigin(0.5, 0).setDepth(20),
            ...legendParts,
            this.add.text(
                mid,
                top + 290,
                'ARROWS DIG  ·  SPACE HOSES THEM UNTIL THEY POP\n\nP PAUSE  ·  M MUTE  ·  ESC ARCADE',
                textStyle(11, '#9ad07a')
            ).setOrigin(0.5, 0).setDepth(20),
        ];
    }

    beginPlay() {
        this.awaitingStart = false;
        STORE.showTitle = false;
        for (const part of this.titleParts) part.destroy();
        this.titleParts = [];
    }

    restartGame() {
        STORE.score = 0;
        STORE.lives = 3;
        STORE.level = 1;
        STORE.showTitle = true;
        this.scene.restart();
    }

    update(_time, delta) {
        // Both of these states are reachable only through the shared input, so
        // they are polled here rather than through Phaser key events.
        if (this.awaitingStart) {
            if (Arcade.Input.justPressed('fire')) this.beginPlay();
            return;
        }

        if (this.isDead) {
            if (Arcade.Input.justPressed('fire')) this.restartGame();
            return;
        }

        if (this.paused) return;

        if (this.respawnTimer > 0) {
            this.respawnTimer -= delta;
            if (this.respawnTimer <= 0) this.respawnPlayer();
            return;
        }

        this.handleInput(delta);
        this.updatePlayer(delta);
        this.updatePlayerSprite(delta);
        this.updateEnemies(delta);
        this.updateFires(delta);
        this.updateRocks(delta);
        this.updateVegetable(delta);
        this.checkCollisions();
        this.updateUI();
        this.checkLevelComplete();
    }

    /* ---------- level generation ---------- */

    generateLevel() {
        this.grid = [];
        for (let r = 0; r < ROWS; r++) {
            this.grid[r] = new Array(COLS).fill(TILE_EMPTY);
        }

        for (let c = 0; c < COLS; c++) {
            this.grid[0][c] = TILE_WALL;
            this.grid[ROWS - 1][c] = TILE_WALL;
        }
        for (let r = 0; r < ROWS; r++) {
            this.grid[r][0] = TILE_WALL;
            this.grid[r][COLS - 1] = TILE_WALL;
        }

        for (let r = 1; r < ROWS - 1; r++) {
            for (let c = 1; c < COLS - 1; c++) {
                this.grid[r][c] = TILE_DIRT;
            }
        }

        const carveH = (row, c1, c2) => {
            for (let c = c1; c <= c2; c++) this.grid[row][c] = TILE_EMPTY;
        };
        const carveV = (col, r1, r2) => {
            for (let r = r1; r <= r2; r++) this.grid[r][col] = TILE_EMPTY;
        };

        carveH(1, 3, COLS - 4);
        carveH(2, 6, COLS - 7);
        carveH(ROWS - 3, 3, COLS - 4);
        carveH(ROWS - 4, 6, COLS - 7);

        const shafts = [5, 12, 19, 26, 33];
        for (const c of shafts) {
            carveV(c, 2, ROWS - 3);
            carveV(c + 1, 2, ROWS - 3);
        }

        const xRows = [7, 13, 20];
        for (const r of xRows) {
            carveH(r, 3, COLS - 4);
            carveH(r + 1, 3, COLS - 4);
        }

        // Every rock needs dirt directly beneath it. At rows 5-6 the top two
        // sat on the tunnel carved at row 7 and fell the moment a level began,
        // which also handed out the veg bonus for free.
        const rockDefs = [
            { r: 4, c: 9, w: 2, h: 2 },
            { r: 4, c: 22, w: 2, h: 2 },
            { r: 14, c: 15, w: 2, h: 2 },
            { r: 21, c: 9, w: 2, h: 2 },
            { r: 21, c: 22, w: 2, h: 2 },
        ];

        for (const rd of rockDefs) {
            for (let dr = 0; dr < rd.h; dr++) {
                for (let dc = 0; dc < rd.w; dc++) {
                    this.grid[rd.r + dr][rd.c + dc] = TILE_ROCK;
                }
            }
        }

        this.rocks = [];
        for (const rd of rockDefs) {
            const tiles = [];
            let sumX = 0, sumY = 0;
            for (let dr = 0; dr < rd.h; dr++) {
                for (let dc = 0; dc < rd.w; dc++) {
                    tiles.push([rd.r + dr, rd.c + dc]);
                    sumX += (rd.c + dc) * TILE + TILE / 2;
                    sumY += (rd.r + dr) * TILE + TILE / 2;
                }
            }
            this.rocks.push({
                tiles,
                x: sumX / tiles.length,
                y: sumY / tiles.length,
                falling: false,
                vy: 0,
            });
        }

        this.player = {
            x: 18 * TILE + TILE / 2,
            y: 2 * TILE + TILE / 2,
            gridX: 18,
            gridY: 2,
            facing: 'down',
            moving: false,
        };

        const epos = [
            [2, 5], [2, 30], [ROWS - 3, 5], [ROWS - 3, 30],
            [7, 16], [20, 16],
        ];
        const numE = Math.min(epos.length, 3 + this.level);
        this.enemies = [];
        for (let i = 0; i < numE; i++) {
            const [r, c] = epos[i];
            const dirs = ['left', 'right', 'up', 'down'];
            const e = {
                x: c * TILE + TILE / 2,
                y: r * TILE + TILE / 2,
                gridX: c,
                gridY: r,
                type: i < 3 ? 'pooka' : 'fygar',
                direction: dirs[i % 4],
                speed: ENEMY_SPEED_BASE + (this.level - 1) * 4,
                hp: PUMPS_TO_KILL,
                phasing: false,
                targetX: c * TILE + TILE / 2,
                targetY: r * TILE + TILE / 2,
                stunned: false,
                stunTimer: 0,
                inflateLevel: 0,
                shrinking: false,
                shrinkTimer: 0,
                currentScale: 1,
            };
            e.fireTimer = e.type === 'fygar' ? 2000 + Math.random() * 3000 : 0;
            this.chooseEnemyTarget(e);
            this.enemies.push(e);
        }
    }

    drawGrid() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) this.paintTile(r, c);
        }
        this.terrain.refresh();
    }

    /** Repaints a tile and its neighbours, whose tunnel rims depend on it. */
    redrawAround(r, c) {
        for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) this.paintTile(rr, cc);
        }
        this.terrain.refresh();
    }

    /** Dirt and the outer walls count as solid for rim shading; rocks do not. */
    isSolid(r, c) {
        const t = this.grid[r]?.[c];
        return t === TILE_DIRT || t === TILE_WALL;
    }

    paintTile(r, c) {
        const ctx = this.terrainCtx;
        const x = c * TILE, y = r * TILE;
        const t = this.grid[r][c];
        const dot = (px, py, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x + px, y + py, w, h);
        };

        if (t === TILE_WALL && r === 0) {
            // Sky over a strip of lawn.
            SKY.forEach((color, i) => dot(0, i * 2, TILE, 2, color));
            dot(0, 8, TILE, 8, GRASS.base);
            dot(0, 14, TILE, 2, GRASS.dark);
            for (let i = 0; i < 6; i++) {
                const bx = Math.floor(hash(c * 7 + i, 3) * TILE);
                const bh = 2 + Math.floor(hash(c, i) * 4);
                dot(bx, 8 - bh, 1, bh, GRASS.blade);
            }
            return;
        }

        if (t === TILE_WALL) {
            // Bedrock: offset blocks with mortar lines and flecks.
            dot(0, 0, TILE, TILE, BEDROCK.base);
            dot(0, 7, TILE, 1, BEDROCK.dark);
            dot(0, 15, TILE, 1, BEDROCK.dark);
            const off = r % 2 ? 4 : 11;
            dot(off, 0, 1, 7, BEDROCK.dark);
            dot((off + 8) % TILE, 8, 1, 7, BEDROCK.dark);
            dot(Math.floor(hash(c, r) * 12) + 2, 2, 2, 1, BEDROCK.light);
            dot(Math.floor(hash(r, c) * 12) + 2, 10, 2, 1, BEDROCK.light);
            return;
        }

        if (t === TILE_DIRT) {
            const band = soilBand(r);
            const soil = SOIL[band];
            dot(0, 0, TILE, TILE, soil.base);
            // Strata line where one layer meets the next.
            if (band > 0 && soilBand(r - 1) !== band) dot(0, 0, TILE, 2, soil.dark);
            for (let i = 0; i < 5; i++) {
                const sx = Math.floor(hash(c * 5 + i, r) * 15);
                const sy = Math.floor(hash(r * 5 + i, c) * 15);
                dot(sx, sy, 2, 1, i < 3 ? soil.dark : soil.light);
            }
            const roll = hash(c + 101, r + 37);
            if (roll < 0.1) {
                // A pebble.
                const px = 3 + Math.floor(hash(c, r + 9) * 8), py = 4 + Math.floor(hash(r, c + 9) * 8);
                dot(px, py, 4, 3, '#6e6a64');
                dot(px, py, 3, 1, '#a09a90');
            } else if (roll < 0.2 && band === 0) {
                // A root, only in the topsoil.
                const rx = 2 + Math.floor(hash(c, r + 5) * 10);
                for (let i = 0; i < 6; i++) dot(rx + (i % 2), 3 + i * 2, 1, 2, '#d8b070');
            }
            return;
        }

        // Tunnel, or the pocket behind a rock sprite.
        dot(0, 0, TILE, TILE, TUNNEL.floor);
        if (this.isSolid(r - 1, c)) dot(0, 0, TILE, 3, TUNNEL.shade); // overhang
        if (this.isSolid(r + 1, c)) dot(0, TILE - 2, TILE, 2, TUNNEL.lip); // floor lip
        if (this.isSolid(r, c - 1)) dot(0, 0, 2, TILE, TUNNEL.shade);
        if (this.isSolid(r, c + 1)) dot(TILE - 2, 0, 2, TILE, TUNNEL.shade);
    }

    /* ---------- textures ---------- */

    generateTextures() {
        for (const key of Object.keys(SPRITES)) pixelTexture(this, key, SPRITES[key]);
        boulderTexture(this);
        popTexture(this);
    }

    /* ---------- input ---------- */

    handleInput(_delta) {
        if (this.isPumping) return;

        // Read the shared input layer, not Phaser's keyboard. Arcade.Input
        // calls preventDefault to stop the page scrolling, and Phaser ignores
        // any event that has already been default-prevented - so a game that
        // reads both gets nothing at all.
        const left = Arcade.Input.held('left');
        const right = Arcade.Input.held('right');
        const up = Arcade.Input.held('up');
        const down = Arcade.Input.held('down');

        if (Arcade.Input.justPressed('fire')) {
            this.startPump();
        }

        if (left) {
            this.player.facing = 'left';
            this.player.moving = true;
            this.player.y = Math.round((this.player.y - TILE / 2) / TILE) * TILE + TILE / 2;
        } else if (right) {
            this.player.facing = 'right';
            this.player.moving = true;
            this.player.y = Math.round((this.player.y - TILE / 2) / TILE) * TILE + TILE / 2;
        } else if (up) {
            this.player.facing = 'up';
            this.player.moving = true;
            this.player.x = Math.round((this.player.x - TILE / 2) / TILE) * TILE + TILE / 2;
        } else if (down) {
            this.player.facing = 'down';
            this.player.moving = true;
            this.player.x = Math.round((this.player.x - TILE / 2) / TILE) * TILE + TILE / 2;
        } else {
            this.player.moving = false;
        }
    }

    startPump() {
        if (this.isPumping) return;
        this.isPumping = true;
        this.pumpTimer = PUMP_DURATION;
        Sound.pump();

        const dir = this.player.facing;
        let endX = this.player.x, endY = this.player.y;
        let dx = 0, dy = 0;
        switch (dir) {
            case 'left': dx = -1; dy = 0; endX -= TILE * 2; break;
            case 'right': dx = 1; dy = 0; endX += TILE * 2; break;
            case 'up': dx = 0; dy = -1; endY -= TILE * 2; break;
            case 'down': dx = 0; dy = 1; endY += TILE * 2; break;
        }

        // A garden hose: dark casing, bright stripe, brass nozzle.
        this.pumpGfx.clear();
        for (const [width, color] of [[5, 0x1d5e1a], [2, 0x5cc043]]) {
            this.pumpGfx.lineStyle(width, color, 1);
            this.pumpGfx.beginPath();
            this.pumpGfx.moveTo(this.player.x, this.player.y);
            this.pumpGfx.lineTo(endX, endY);
            this.pumpGfx.strokePath();
        }
        this.pumpGfx.fillStyle(0xd4a017, 1);
        this.pumpGfx.fillRect(endX - 3, endY - 3, 6, 6);
        this.pumpGfx.fillStyle(0xfff3a0, 1);
        this.pumpGfx.fillRect(endX - 1, endY - 1, 2, 2);

        const pc = this.player.gridX;
        const pr = this.player.gridY;

        for (let dist = 0; dist <= 2; dist++) {
            const tc = pc + dx * dist;
            const tr = pr + dy * dist;
            if (tr < 1 || tr >= ROWS - 1 || tc < 1 || tc >= COLS - 1) continue;

            for (const e of this.enemies) {
                if (e.gridX === tc && e.gridY === tr) {
                    e.hp--;
                    e.stunned = true;
                    e.stunTimer = STUN_DURATION;
                    e.inflateLevel = Math.min(1, e.inflateLevel + 1 / PUMPS_TO_KILL);
                    e.currentScale = 1 + e.inflateLevel * 0.6;
                    e.shrinking = false;
                    e.shrinkTimer = 0;
                    const pushX = e.x + dx * TILE;
                    const pushY = e.y + dy * TILE;
                    const pushC = Math.floor(pushX / TILE);
                    const pushR = Math.floor(pushY / TILE);
                    if (this.grid[pushR]?.[pushC] === TILE_EMPTY) {
                        e.x = pushX;
                        e.y = pushY;
                        e.gridX = pushC;
                        e.gridY = pushR;
                        e.targetX = pushX;
                        e.targetY = pushY;
                    }
                    if (e.hp <= 0) this.killEnemy(e);
                    return;
                }
            }
        }
    }

    killEnemy(e, cause = 'pump') {
        const idx = this.enemies.indexOf(e);
        if (idx === -1) return;
        const points = ENEMY_SCORE[cause][e.type];
        this.score += points;
        this.popAt(e.x, e.y, points);
        Sound.pop();
        this.enemySprs[idx].destroy();
        // Both arrays are indexed in lockstep by updateEnemies, so they splice together.
        this.enemySprs.splice(idx, 1);
        this.enemies.splice(idx, 1);
    }

    /** A burst of sparks, and the points floating up if there were any. */
    popAt(x, y, points) {
        const burst = this.add.sprite(x, y, 'pop').setDepth(8).setScale(0.6);
        this.tweens.add({
            targets: burst, scale: 1.6, alpha: 0, duration: 260,
            onComplete: () => burst.destroy(),
        });
        if (points > 0) this.floatScore(x, y, points);
    }

    floatScore(x, y, points) {
        const label = this.add.text(x, y - 6, '+' + points, textStyle(11, '#ffe98a'))
            .setOrigin(0.5).setDepth(9);
        this.tweens.add({
            targets: label, y: y - 26, alpha: 0, duration: 800,
            onComplete: () => label.destroy(),
        });
    }

    breatheFire(e) {
        let dx = 0, dy = 0;
        switch (e.direction) {
            case 'left': dx = -1; break;
            case 'right': dx = 1; break;
            case 'up': dy = -1; break;
            case 'down': dy = 1; break;
        }
        this.fires.push({
            x: e.x,
            y: e.y,
            dx,
            dy,
            life: 2000,
            sprite: this.add.sprite(e.x, e.y, 'flame0').setOrigin(0.5, 0.5).setDepth(3)
                .setAngle({ right: 0, left: 180, up: -90, down: 90 }[e.direction]),
        });
    }

    updateFires(delta) {
        const speed = 120;
        for (let i = this.fires.length - 1; i >= 0; i--) {
            const f = this.fires[i];
            f.life -= delta;
            if (f.life <= 0) { f.sprite.destroy(); this.fires.splice(i, 1); continue; }
            const move = speed * delta / 1000;
            let nx = f.x + f.dx * move;
            let ny = f.y + f.dy * move;
            if (f.dx !== 0) ny = f.y;
            if (f.dy !== 0) nx = f.x;
            const nc = Math.floor(nx / TILE);
            const nr = Math.floor(ny / TILE);
            if (nr < 1 || nr >= ROWS - 1 || nc < 1 || nc >= COLS - 1) {
                f.sprite.destroy(); this.fires.splice(i, 1); continue;
            }
            if (this.grid[nr][nc] !== TILE_EMPTY) {
                f.sprite.destroy(); this.fires.splice(i, 1); continue;
            }
            const pc = Math.floor(this.player.x / TILE);
            const pr = Math.floor(this.player.y / TILE);
            if (nc === pc && nr === pr && !this.isDead) {
                this.playerDie();
                f.sprite.destroy(); this.fires.splice(i, 1); continue;
            }
            f.x = nx;
            f.y = ny;
            f.sprite.setPosition(f.x, f.y);
            f.sprite.setTexture(Math.floor(f.life / 80) % 2 ? 'flame1' : 'flame0');
        }
    }

    /* ---------- player ---------- */

    updatePlayer(delta) {
        if (this.isPumping) {
            this.pumpTimer -= delta;
            if (this.pumpTimer <= 0) {
                this.isPumping = false;
                this.pumpGfx.clear();
            }
            return;
        }
        if (!this.player.moving) return;

        const spd = PLAYER_SPEED * delta / 1000;
        let dx = 0, dy = 0;
        switch (this.player.facing) {
            case 'left': dx = -spd; break;
            case 'right': dx = spd; break;
            case 'up': dy = -spd; break;
            case 'down': dy = spd; break;
        }

        let nx = this.player.x + dx;
        let ny = this.player.y + dy;
        if (dx !== 0) ny = this.player.y;
        if (dy !== 0) nx = this.player.x;

        const nc = Math.floor(nx / TILE);
        const nr = Math.floor(ny / TILE);

        if (nr < 1 || nr >= ROWS - 1 || nc < 1 || nc >= COLS - 1) return;

        const tile = this.grid[nr][nc];
        if (tile === TILE_EMPTY) {
            this.player.x = nx;
            this.player.y = ny;
        } else if (tile === TILE_DIRT) {
            this.grid[nr][nc] = TILE_EMPTY;
            this.player.x = nx;
            this.player.y = ny;
            this.redrawAround(nr, nc);
            Sound.dig();
        } else if (tile === TILE_ROCK) {
            if (this.player.facing === 'left') this.player.x = (nc + 1) * TILE + TILE / 2;
            else if (this.player.facing === 'right') this.player.x = nc * TILE + TILE / 2;
            else if (this.player.facing === 'up') this.player.y = (nr + 1) * TILE + TILE / 2;
            else if (this.player.facing === 'down') this.player.y = nr * TILE + TILE / 2;
            this.player.moving = false;
            return;
        } else {
            this.player.moving = false;
            return;
        }

        this.player.gridX = Math.floor(this.player.x / TILE);
        this.player.gridY = Math.floor(this.player.y / TILE);
        this.playerSpr.setPosition(this.player.x, this.player.y);
    }

    updatePlayerSprite(delta) {
        const p = this.player;
        if (p.moving && !this.isPumping) this.walkClock += delta;

        const frame = Math.floor(this.walkClock / 110) % 2;
        this.playerSpr.setTexture(frame ? 'mole1' : 'mole0');
        // The map faces right: mirror it for left, turn it for up and down.
        this.playerSpr.setFlipX(p.facing === 'left');
        this.playerSpr.setAngle({ right: 0, left: 0, up: -90, down: 90 }[p.facing]);
    }

    /* ---------- enemies ---------- */

    updateEnemies(delta) {
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];

            if (e.stunned) {
                e.stunTimer -= delta;
                if (e.stunTimer <= 0) {
                    e.stunned = false;
                    if (e.hp > 0 && e.inflateLevel > 0) {
                        e.shrinking = true;
                        e.shrinkTimer = 1000;
                    }
                }
            }

            if (e.shrinking) {
                e.shrinkTimer -= delta;
                const t = Math.max(0, e.shrinkTimer / 1000);
                e.currentScale = 1 + e.inflateLevel * 0.6 * t;
                if (e.shrinkTimer <= 0) {
                    e.shrinking = false;
                    e.inflateLevel = 0;
                    e.currentScale = 1;
                }
            }

            if (e.type === 'fygar' && !e.stunned && !e.shrinking) {
                e.fireTimer -= delta;
                if (e.fireTimer <= 0) {
                    this.breatheFire(e);
                    e.fireTimer = 2000 + Math.random() * 3000;
                }
            }

            if (!e.stunned && !e.shrinking) {
                this.moveEnemy(e, delta);
            }

            if (this.enemySprs[i]) {
                // Remember the last sideways heading, so going up or down
                // does not snap the sprite back to facing right.
                if (e.direction === 'left') e.faceLeft = true;
                else if (e.direction === 'right') e.faceLeft = false;

                this.enemySprs[i].setPosition(e.x, e.y);
                this.enemySprs[i].setAlpha(e.phasing ? 0.5 : 1);
                this.enemySprs[i].setScale(e.currentScale);
                this.enemySprs[i].setFlipX(!!e.faceLeft);
                this.enemySprs[i].setTint(inflateTint(e.inflateLevel));
            }
        }
    }

    moveEnemy(e, delta) {
        const spd = (e.phasing ? ENEMY_PHASE_SPEED : e.speed) * delta / 1000;
        const tdx = e.targetX - e.x;
        const tdy = e.targetY - e.y;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);

        if (dist < 1) {
            e.x = e.targetX;
            e.y = e.targetY;
            this.chooseEnemyTarget(e);
            e.gridX = Math.floor(e.x / TILE);
            e.gridY = Math.floor(e.y / TILE);
            return;
        }

        const step = Math.min(spd, dist);
        e.x += (tdx / dist) * step;
        e.y += (tdy / dist) * step;
        e.gridX = Math.floor(e.x / TILE);
        e.gridY = Math.floor(e.y / TILE);
    }

    chooseEnemyTarget(e) {
        const pc = this.player.gridX;
        const pr = this.player.gridY;
        const ec = e.gridX;
        const er = e.gridY;

        const dirs = ['left', 'right', 'up', 'down'];
        const valid = [];

        for (const d of dirs) {
            const [dc, dr] = this.dirDelta(d);
            const nc = ec + dc;
            const nr = er + dr;
            if (nr < 1 || nr >= ROWS - 1 || nc < 1 || nc >= COLS - 1) continue;
            const t = this.grid[nr][nc];
            if (t === TILE_EMPTY) valid.push(d);
            else if (t === TILE_DIRT && e.type === 'pooka') valid.push(d);
        }

        if (valid.length === 0) return;

        let best = valid[0];
        let bestDist = Infinity;
        for (const d of valid) {
            const [dc, dr] = this.dirDelta(d);
            const nc = ec + dc;
            const nr = er + dr;
            const dd = (nc - pc) ** 2 + (nr - pr) ** 2;
            if (dd < bestDist) { bestDist = dd; best = d; }
        }

        const [dc, dr] = this.dirDelta(best);
        const nc = ec + dc;
        const nr = er + dr;
        e.targetX = nc * TILE + TILE / 2;
        e.targetY = nr * TILE + TILE / 2;
        e.direction = best;

        const t = this.grid[nr][nc];
        e.phasing = (t === TILE_DIRT);
    }

    dirDelta(d) {
        switch (d) {
            case 'left': return [-1, 0];
            case 'right': return [1, 0];
            case 'up': return [0, -1];
            case 'down': return [0, 1];
        }
    }

    /* ---------- rocks ---------- */

    updateRocks(_delta) {
        for (const rock of this.rocks) {
            if (rock.falling) {
                const bottomR = Math.max(...rock.tiles.map(t => t[0]));
                const checkR = bottomR + 1;

                if (checkR >= ROWS - 1) { this.landRock(rock); continue; }

                const cols = rock.tiles.filter(t => t[0] === bottomR).map(t => t[1]);
                const blocked = cols.some(c => {
                    const t = this.grid[checkR][c];
                    return t === TILE_WALL || t === TILE_DIRT || t === TILE_ROCK;
                });

                if (!blocked) {
                    for (const t of rock.tiles) {
                        this.grid[t[0]][t[1]] = TILE_EMPTY;
                        t[0] += 1;
                    }
                    for (const t of rock.tiles) {
                        this.grid[t[0]][t[1]] = TILE_ROCK;
                        this.redrawAround(t[0] - 1, t[1]);
                        this.redrawAround(t[0], t[1]);
                    }
                    rock.y += TILE;
                    if (rock.sprite) rock.sprite.setPosition(rock.x, rock.y);
                } else {
                    this.landRock(rock);
                }
            } else {
                const bottomR = Math.max(...rock.tiles.map(t => t[0]));
                const checkR = bottomR + 1;
                if (checkR >= ROWS - 1) continue;

                const cols = rock.tiles.filter(t => t[0] === bottomR).map(t => t[1]);
                const empty = cols.every(c => this.grid[checkR][c] === TILE_EMPTY);
                if (empty) rock.falling = true;
            }
        }
    }

    /* ---------- collisions ---------- */

    checkCollisions() {
        if (this.isPumping) return;
        const px = this.player.x, py = this.player.y;
        const pc = Math.floor(px / TILE), pr = Math.floor(py / TILE);

        for (const e of this.enemies) {
            if (e.gridX === pc && e.gridY === pr) {
                this.playerDie();
                return;
            }
        }

        for (const rock of this.rocks) {
            if (!rock.falling) continue;
            for (const [rr, rc] of rock.tiles) {
                if (rr === pr && rc === pc) {
                    this.playerDie();
                    return;
                }
            }
            // Collect everyone this rock caught before scoring, so a chain pays
            // as a chain rather than as N separate crushes.
            const victims = [];
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                for (const [rr, rc] of rock.tiles) {
                    if (rr === e.gridY && rc === e.gridX) {
                        victims.push(e);
                        break;
                    }
                }
            }
            this.crushEnemies(victims);
        }

        this.checkVegetable(pc, pr);
    }

    /** A rock has come to rest. Each rock only counts toward the bonus once. */
    landRock(rock) {
        rock.falling = false;
        if (rock.landed) return;

        rock.landed = true;
        this.rocksLanded++;
        Sound.rock();

        if (this.rocksLanded >= VEGETABLE_ROCKS_REQUIRED) this.spawnVegetable();
    }

    crushEnemies(victims) {
        if (!victims.length) return;

        const chain = Math.min(victims.length, ROCK_CHAIN_SCORE.length - 1);
        this.score += ROCK_CHAIN_SCORE[chain];
        this.floatScore(victims[0].x, victims[0].y, ROCK_CHAIN_SCORE[chain]);

        for (const e of victims) this.killEnemy(e, 'rock');
    }

    /* ---------- vegetable bonus ---------- */

    spawnVegetable() {
        if (this.vegetable) return;

        const col = Math.floor(COLS / 2);
        const row = Math.floor(ROWS / 2);
        const kind = VEG_KINDS[Math.min(this.level - 1, VEG_KINDS.length - 1)];
        this.vegetable = {
            kind,
            gridX: col,
            gridY: row,
            points: VEGETABLE_POINTS[Math.min(this.level - 1, VEGETABLE_POINTS.length - 1)],
            timer: VEGETABLE_LIFETIME,
            sprite: this.add
                .sprite(col * TILE + TILE / 2, row * TILE + TILE / 2, kind)
                .setOrigin(0.5, 0.5)
                .setDepth(4),
        };
    }

    updateVegetable(delta) {
        if (!this.vegetable) return;
        this.vegetable.timer -= delta;
        if (this.vegetable.timer <= 0) this.clearVegetable();
    }

    clearVegetable() {
        if (!this.vegetable) return;
        this.vegetable.sprite.destroy();
        this.vegetable = null;
    }

    checkVegetable(pc, pr) {
        if (!this.vegetable) return;
        if (this.vegetable.gridX !== pc || this.vegetable.gridY !== pr) return;

        this.score += this.vegetable.points;
        this.floatScore(
            this.vegetable.gridX * TILE + TILE / 2,
            this.vegetable.gridY * TILE + TILE / 2,
            this.vegetable.points
        );
        Sound.bonus();
        this.clearVegetable();
    }

    playerDie() {
        if (this.respawnTimer > 0) return;
        Sound.die();
        this.lives--;
        this.player.moving = false;
        this.isPumping = false;
        this.pumpGfx.clear();

        if (this.lives <= 0) {
            this.showGameOver();
        } else {
            this.respawnTimer = 1200;
        }
        this.tweens.add({
            targets: this.playerSpr,
            angle: this.playerSpr.angle + 540, scale: 0.2, alpha: 0,
            duration: 700,
        });
    }

    respawnPlayer() {
        this.player.x = 18 * TILE + TILE / 2;
        this.player.y = 2 * TILE + TILE / 2;
        this.player.gridX = 18;
        this.player.gridY = 2;
        this.player.facing = 'down';
        this.player.moving = false;
        this.playerSpr.setPosition(this.player.x, this.player.y);
        this.playerSpr.setAlpha(1).setScale(1).setAngle(90);
        this.respawnTimer = 0;
    }

    showGameOver() {
        this.isDead = true;
        this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 40, 300, 250, 0x120c08, 0.88)
            .setStrokeStyle(2, 0xf2b632).setDepth(19);

        this.add.text(WIDTH / 2, HEIGHT / 2 - 60, 'GAME OVER', textStyle(32, '#e8442a'))
            .setOrigin(0.5).setDepth(20);

        this.add.text(WIDTH / 2, HEIGHT / 2 - 24, 'SCORE ' + this.score, textStyle(16, '#ffffff'))
            .setOrigin(0.5).setDepth(20);

        this.add.text(WIDTH / 2, HEIGHT / 2 + 4, 'PRESS SPACE TO RESTART', textStyle(12, '#9ad07a'))
            .setOrigin(0.5).setDepth(20);

        const table = this.add.text(WIDTH / 2, HEIGHT / 2 + 30, '', textStyle(12, '#ffe98a'))
            .setOrigin(0.5, 0).setDepth(20);

        const showTable = () => table.setText(Arcade.Scores.format(GAME_KEY));

        if (Arcade.Scores.qualifies(GAME_KEY, this.score)) {
            Arcade.Scores.promptInitials(this.score, (initials) => {
                Arcade.Scores.submit(GAME_KEY, initials, this.score);
                showTable();
            });
        }
        showTable();

    }

    checkLevelComplete() {
        if (this.enemies.length === 0 && !this.isDead && !this.levelOver) {
            this.levelOver = true;
            this.paused = true;
            this.clearVegetable();

            Sound.clear();

            this.add.text(WIDTH / 2, HEIGHT / 2, 'GARDEN CLEAR!', textStyle(22, '#9ad07a'))
                .setOrigin(0.5).setDepth(20);

            this.time.delayedCall(2000, () => {
                STORE.score = this.score;
                STORE.lives = this.lives;
                STORE.level = this.level + 1;
                this.scene.restart();
            });
        }
    }

    updateUI() {
        this.scoreText.setText('SCORE: ' + this.score);
        this.livesText.setText('LIVES: ' + this.lives);
        this.levelText.setText('LVL: ' + this.level);
    }
}

const config = {
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: 'game-container',
    backgroundColor: '#000000',
    pixelArt: true,
    scene: [DigDugScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

const game = new Phaser.Game(config);

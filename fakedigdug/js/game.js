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

const DIRT_COLOR = 0x8B6914;
const DIRT_SPECK = 0x7A5E12;
const WALL_COLOR = 0x444444;
const WALL_HILIGHT = 0x666666;
const ROCK_COLOR = 0x999999;
const ROCK_SHADOW = 0x777777;
const ROCK_HILIGHT = 0xAAAAAA;

const STORE = { score: 0, lives: 3, level: 1 };

class DigDugScene extends Phaser.Scene {
    constructor() {
        super('DigDugScene');
    }

    create() {
        this.score = STORE.score;
        this.lives = STORE.lives;
        this.level = STORE.level;

        this.generateLevel();
        this.generatePlayerTexture();
        this.generateEnemyTextures();

        this.gridGfx = this.add.graphics();
        this.drawGrid();

        this.playerSpr = this.add.sprite(this.player.x, this.player.y, 'player');

        this.enemySprs = [];
        for (const e of this.enemies) {
            const s = this.add.sprite(e.x, e.y, e.type);
            s.setOrigin(0.5, 0.5);
            this.enemySprs.push(s);
        }

        this.fires = [];
        this.pumpGfx = this.add.graphics().setDepth(5);

        const ts = { fontSize: '12px', fontFamily: 'monospace', color: '#fff' };
        this.scoreText = this.add.text(8, 4, '', ts);
        this.livesText = this.add.text(8, HEIGHT - 16, '', ts);
        this.levelText = this.add.text(WIDTH - 8, 4, '', ts).setOrigin(1, 0);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.spaceWasDown = false;

        this.isPumping = false;
        this.pumpTimer = 0;
        this.isDead = false;
        this.respawnTimer = 0;
        this.levelOver = false;
        this.paused = false;

        this.updateUI();
    }

    update(_time, delta) {
        if (this.isDead || this.paused) return;

        if (this.respawnTimer > 0) {
            this.respawnTimer -= delta;
            if (this.respawnTimer <= 0) this.respawnPlayer();
            return;
        }

        this.handleInput(delta);
        this.updatePlayer(delta);
        this.updateEnemies(delta);
        this.updateFires(delta);
        this.updateRocks(delta);
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

        const rockDefs = [
            { r: 5, c: 9, w: 2, h: 2 },
            { r: 5, c: 22, w: 2, h: 2 },
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
        this.gridGfx.clear();
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                this.drawTile(r, c);
            }
        }
    }

    drawTile(r, c) {
        const t = this.grid[r][c];
        const x = c * TILE, y = r * TILE;
        this.gridGfx.fillStyle(0x000000, 1);
        this.gridGfx.fillRect(x, y, TILE, TILE);

        if (t === TILE_DIRT) {
            this.gridGfx.fillStyle(DIRT_COLOR, 1);
            this.gridGfx.fillRect(x, y, TILE, TILE);
            this.gridGfx.fillStyle(DIRT_SPECK, 1);
            if ((r + c) % 4 === 0) this.gridGfx.fillRect(x + 4, y + 4, 2, 2);
            if ((r + c) % 5 === 0) this.gridGfx.fillRect(x + 10, y + 10, 2, 2);
        } else if (t === TILE_WALL) {
            this.gridGfx.fillStyle(WALL_COLOR, 1);
            this.gridGfx.fillRect(x, y, TILE, TILE);
            this.gridGfx.fillStyle(WALL_HILIGHT, 1);
            this.gridGfx.fillRect(x, y, TILE, 1);
            this.gridGfx.fillRect(x, y, 1, TILE);
        } else if (t === TILE_ROCK) {
            this.gridGfx.fillStyle(ROCK_COLOR, 1);
            this.gridGfx.fillRect(x, y, TILE, TILE);
            this.gridGfx.fillStyle(ROCK_SHADOW, 1);
            this.gridGfx.fillRect(x + 2, y + 2, 4, 4);
            this.gridGfx.fillRect(x + 10, y + 10, 4, 4);
            this.gridGfx.fillStyle(ROCK_HILIGHT, 1);
            this.gridGfx.fillRect(x, y, TILE, 1);
            this.gridGfx.fillRect(x, y, 1, TILE);
        }
    }

    /* ---------- textures ---------- */

    generatePlayerTexture() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x3355FF);
        g.fillRect(2, 9, 12, 7);
        g.fillStyle(0xFFCC99);
        g.fillRect(3, 1, 10, 8);
        g.fillStyle(0xFF8800);
        g.fillRect(4, 3, 3, 3);
        g.fillRect(9, 3, 3, 3);
        g.lineStyle(1, 0xCC6600);
        g.strokeRect(4, 3, 3, 3);
        g.strokeRect(9, 3, 3, 3);
        g.lineBetween(7, 4, 9, 5);
        g.fillStyle(0xCC9966);
        g.fillRect(4, 0, 8, 2);
        g.generateTexture('player', TILE, TILE);
        g.destroy();
    }

    generateEnemyTextures() {
        let g = this.make.graphics({ add: false });
        g.fillStyle(0xFF0000);
        g.fillCircle(8, 8, 7);
        g.fillStyle(0xFFFFFF);
        g.fillCircle(5, 6, 2);
        g.fillCircle(11, 6, 2);
        g.fillStyle(0x000000);
        g.fillCircle(5, 6, 1);
        g.fillCircle(11, 6, 1);
        g.fillStyle(0xCC0000);
        g.fillTriangle(4, 3, 6, 3, 5, 0);
        g.fillTriangle(10, 3, 12, 3, 11, 0);
        g.fillStyle(0x000000);
        g.fillRect(6, 11, 4, 1);
        g.generateTexture('pooka', TILE, TILE);
        g.destroy();

        g = this.make.graphics({ add: false });
        g.fillStyle(0x00AA00);
        g.fillCircle(8, 8, 7);
        g.fillStyle(0x008800);
        g.fillRect(5, 5, 8, 6);
        g.fillStyle(0xFF6600);
        g.fillCircle(10, 6, 2);
        g.fillStyle(0x000000);
        g.fillCircle(10, 6, 1);
        g.fillStyle(0x00CC00);
        g.fillTriangle(2, 7, 1, 4, 0, 8);
        g.fillTriangle(14, 7, 15, 4, 16, 8);
        g.fillStyle(0xFF0000);
        g.fillRect(12, 7, 3, 2);
        g.generateTexture('fygar', TILE, TILE);
        g.destroy();

        g = this.make.graphics({ add: false });
        g.fillStyle(ROCK_COLOR);
        g.fillRect(0, 0, TILE, TILE);
        g.fillStyle(ROCK_SHADOW);
        g.fillRect(2, 2, 5, 5);
        g.fillRect(10, 9, 4, 4);
        g.generateTexture('rock', TILE, TILE);
        g.destroy();

        g = this.make.graphics({ add: false });
        g.fillStyle(0xFF4400);
        g.fillCircle(8, 8, 6);
        g.fillStyle(0xFFAA00);
        g.fillCircle(8, 7, 4);
        g.fillStyle(0xFFFF00);
        g.fillCircle(8, 6, 2);
        g.generateTexture('fire', TILE, TILE);
        g.destroy();
    }

    /* ---------- input ---------- */

    handleInput(_delta) {
        if (this.isPumping) return;

        const left = this.cursors.left.isDown;
        const right = this.cursors.right.isDown;
        const up = this.cursors.up.isDown;
        const down = this.cursors.down.isDown;

        if (this.spaceKey.isDown && !this.spaceWasDown) {
            this.startPump();
        }
        this.spaceWasDown = this.spaceKey.isDown;

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

        const dir = this.player.facing;
        let endX = this.player.x, endY = this.player.y;
        let dx = 0, dy = 0;
        switch (dir) {
            case 'left': dx = -1; dy = 0; endX -= TILE * 2; break;
            case 'right': dx = 1; dy = 0; endX += TILE * 2; break;
            case 'up': dx = 0; dy = -1; endY -= TILE * 2; break;
            case 'down': dx = 0; dy = 1; endY += TILE * 2; break;
        }

        this.pumpGfx.clear();
        this.pumpGfx.lineStyle(3, 0xCCCCCC, 1);
        this.pumpGfx.beginPath();
        this.pumpGfx.moveTo(this.player.x, this.player.y);
        this.pumpGfx.lineTo(endX, endY);
        this.pumpGfx.strokePath();
        this.pumpGfx.fillStyle(0xCCCCCC, 1);
        this.pumpGfx.fillCircle(endX, endY, 2);

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

    killEnemy(e) {
        const idx = this.enemies.indexOf(e);
        if (idx === -1) return;
        this.score += e.type === 'pooka' ? 500 : 1000;
        this.enemySprs[idx].destroy();
        this.enemySprs.splice(idx, 1);
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
            sprite: this.add.sprite(e.x, e.y, 'fire').setOrigin(0.5, 0.5).setDepth(3),
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
            this.drawTile(nr, nc);
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
                this.enemySprs[i].setPosition(e.x, e.y);
                this.enemySprs[i].setAlpha(e.phasing ? 0.5 : 1);
                this.enemySprs[i].setScale(e.currentScale);
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

                if (checkR >= ROWS - 1) { rock.falling = false; continue; }

                const cols = rock.tiles.filter(t => t[0] === bottomR).map(t => t[1]);
                const blocked = cols.some(c => {
                    const t = this.grid[checkR][c];
                    return t === TILE_WALL || t === TILE_DIRT || t === TILE_ROCK;
                });

                if (!blocked) {
                    for (const t of rock.tiles) {
                        this.grid[t[0]][t[1]] = TILE_EMPTY;
                        this.drawTile(t[0], t[1]);
                        t[0] += 1;
                    }
                    for (const t of rock.tiles) {
                        this.grid[t[0]][t[1]] = TILE_ROCK;
                        this.drawTile(t[0], t[1]);
                    }
                    rock.y += TILE;
                } else {
                    rock.falling = false;
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
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                for (const [rr, rc] of rock.tiles) {
                    if (rr === e.gridY && rc === e.gridX) {
                        this.score += e.type === 'pooka' ? 1000 : 2000;
                        this.killEnemy(e);
                        break;
                    }
                }
            }
        }
    }

    playerDie() {
        if (this.respawnTimer > 0) return;
        this.lives--;
        this.player.moving = false;
        this.isPumping = false;
        this.pumpGfx.clear();

        if (this.lives <= 0) {
            this.showGameOver();
        } else {
            this.respawnTimer = 1200;
            this.playerSpr.setAlpha(0);
        }
    }

    respawnPlayer() {
        this.player.x = 18 * TILE + TILE / 2;
        this.player.y = 2 * TILE + TILE / 2;
        this.player.gridX = 18;
        this.player.gridY = 2;
        this.player.facing = 'down';
        this.player.moving = false;
        this.playerSpr.setPosition(this.player.x, this.player.y);
        this.playerSpr.setAlpha(1);
        this.respawnTimer = 0;
    }

    showGameOver() {
        this.isDead = true;
        this.add.text(WIDTH / 2, HEIGHT / 2 - 24, 'GAME OVER', {
            fontSize: '32px', fontFamily: 'monospace', color: '#ff0000'
        }).setOrigin(0.5).setDepth(20);

        this.add.text(WIDTH / 2, HEIGHT / 2 + 12, 'SCORE: ' + this.score, {
            fontSize: '16px', fontFamily: 'monospace', color: '#ffffff'
        }).setOrigin(0.5).setDepth(20);

        const restartText = this.add.text(WIDTH / 2, HEIGHT / 2 + 44, 'PRESS SPACE TO RESTART', {
            fontSize: '12px', fontFamily: 'monospace', color: '#ffff00'
        }).setOrigin(0.5).setDepth(20);

        this.input.keyboard.once('keydown-SPACE', () => {
            STORE.score = 0;
            STORE.lives = 3;
            STORE.level = 1;
            this.scene.restart();
        });
    }

    checkLevelComplete() {
        if (this.enemies.length === 0 && !this.isDead && !this.levelOver) {
            this.levelOver = true;
            this.paused = true;

            this.add.text(WIDTH / 2, HEIGHT / 2, 'LEVEL CLEAR!', {
                fontSize: '20px', fontFamily: 'monospace', color: '#00ff00'
            }).setOrigin(0.5).setDepth(20);

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

new Phaser.Game(config);

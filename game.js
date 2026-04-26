// ─────────────────────────────────────────────
//  TIMBER DASH — Tree Chopping Simulator
// ─────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;   // 800
const H = canvas.height;  // 480

// ── DOM refs ──────────────────────────────────
const scoreEl   = document.getElementById('score');
const livesEl   = document.getElementById('lives');
const overlay   = document.getElementById('overlay');
const oTitle    = document.getElementById('overlay-title');
const oMsg      = document.getElementById('overlay-msg');
const oBtn      = document.getElementById('overlay-btn');

// ── Game State ────────────────────────────────
let state = 'idle'; // 'idle' | 'playing' | 'dead' | 'gameover'
let score = 0;
let lives = 3;
let frameCount = 0;
let spawnInterval = 90;   // frames between spawns (decreases over time)
let baseSpeed = 2.2;      // px per frame
let entities = [];        // trees + bunnies on the belt

// ── Player axe state ─────────────────────────
const player = {
    x: 110,
    y: 260,
    swinging: false,
    swingFrame: 0,
    swingDuration: 14,
    hitFrame: 7,        // which frame the axe "connects"
    didHitThisSwing: false
};

// ── Conveyor belt geometry ────────────────────
const BELT = {
    x: 0,
    y: 310,
    w: W,
    h: 60,
    stripeWidth: 40,
    offset: 0           // animated scroll offset
};

// ── Pixel art sprite definitions ─────────────
// Each sprite is drawn procedurally with colored rectangles
// Scale unit: 1 block = 8px

const PX = 8; // one pixel block size

function drawTree(x, y, wiggle = 0) {
    const bx = Math.floor(x);
    const by = Math.floor(y + wiggle);

    // Trunk (brown)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(bx + PX*2, by + PX*4, PX*2, PX*5);

    // Shadow under trunk
    ctx.fillStyle = '#5C2E00';
    ctx.fillRect(bx + PX*2, by + PX*8, PX*2, PX);

    // Foliage layers (dark to bright green, Mario-style)
    // Bottom layer
    ctx.fillStyle = '#228B22';
    ctx.fillRect(bx,        by + PX*3, PX*6, PX*2);
    // Mid layer
    ctx.fillStyle = '#2ECC40';
    ctx.fillRect(bx + PX,   by + PX*2, PX*4, PX*2);
    // Top layer
    ctx.fillStyle = '#50fa7b';
    ctx.fillRect(bx + PX*2, by,        PX*2, PX*3);

    // Highlight dots
    ctx.fillStyle = '#a8ff90';
    ctx.fillRect(bx + PX*2, by + PX,   PX,   PX);
    ctx.fillRect(bx + PX,   by + PX*3, PX,   PX);
}

function drawBunny(x, y, hop = 0) {
    const bx = Math.floor(x);
    const by = Math.floor(y + hop);

    // Body (white)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(bx + PX,   by + PX*3, PX*4, PX*4);

    // Head
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + PX*2, by + PX,   PX*3, PX*3);

    // Ears (tall, pink inside)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + PX*2, by - PX,   PX,   PX*3);
    ctx.fillRect(bx + PX*4, by - PX,   PX,   PX*3);
    ctx.fillStyle = '#ffaacc';
    ctx.fillRect(bx + PX*2, by,        PX/2, PX*2);
    ctx.fillRect(bx + PX*4, by,        PX/2, PX*2);

    // Eye (black dot)
    ctx.fillStyle = '#222222';
    ctx.fillRect(bx + PX*4, by + PX*2, PX/2, PX/2);

    // Nose
    ctx.fillStyle = '#ff8888';
    ctx.fillRect(bx + PX*4, by + PX*3, PX/2, PX/2);

    // Tail
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + PX*5, by + PX*4, PX,   PX);

    // Feet
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(bx + PX,   by + PX*6, PX*2, PX);
    ctx.fillRect(bx + PX*3, by + PX*6, PX*2, PX);
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const swing = player.swinging ? player.swingFrame / player.swingDuration : 0;

    // ── Body ──────────────────────────────────
    // Legs (blue overalls)
    ctx.fillStyle = '#2255cc';
    ctx.fillRect(px + PX,   py + PX*5, PX*2, PX*3);
    ctx.fillRect(px + PX*3, py + PX*5, PX*2, PX*3);
    // Boots
    ctx.fillStyle = '#5C2E00';
    ctx.fillRect(px,        py + PX*7, PX*2, PX*2);
    ctx.fillRect(px + PX*3, py + PX*7, PX*2, PX*2);
    // Shirt (red)
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(px + PX,   py + PX*3, PX*4, PX*3);
    // Head
    ctx.fillStyle = '#f5c580';
    ctx.fillRect(px + PX,   py,        PX*4, PX*4);
    // Hat (red)
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(px,        py - PX,   PX*6, PX*2);
    ctx.fillRect(px + PX,   py - PX*2, PX*4, PX);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(px + PX*2, py + PX*2, PX/2, PX/2);
    ctx.fillRect(px + PX*4, py + PX*2, PX/2, PX/2);
    // Moustache
    ctx.fillStyle = '#5C2E00';
    ctx.fillRect(px + PX,   py + PX*3, PX*4, PX/2);

    // ── Axe ──────────────────────────────────
    // Swing arc: arm extends right and down when swinging
    const axeOffsetY = Math.sin(swing * Math.PI) * -28;
    const axeOffsetX = swing < 0.5
        ? swing * 2 * 20          // arm moving forward
        : (1 - (swing - 0.5)*2) * 20; // arm retracting

    const axX = px + PX*5 + axeOffsetX;
    const axY = py + PX*2 + axeOffsetY;

    // Handle (wood)
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(axX,      axY,       PX/2, PX*4);
    // Blade (grey metal)
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(axX + PX/2, axY,     PX*2, PX*2);
    ctx.fillRect(axX + PX/2, axY,     PX*2, PX*2);
    // Blade shine
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(axX + PX,  axY,      PX/2, PX/2);
}

// ── Background scene ──────────────────────────
function drawBackground() {
    // Sky gradient (canvas gradient)
    const sky = ctx.createLinearGradient(0, 0, 0, BELT.y);
    sky.addColorStop(0, '#1a6aff');
    sky.addColorStop(1, '#a0d8ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, BELT.y);

    // Ground below belt
    ctx.fillStyle = '#5a3e1b';
    ctx.fillRect(0, BELT.y + BELT.h, W, H - BELT.y - BELT.h);

    // Grass strip
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, BELT.y + BELT.h, W, PX);
    ctx.fillStyle = '#66bb6a';
    ctx.fillRect(0, BELT.y + BELT.h + PX, W, PX/2);

    // Sun
    ctx.fillStyle = '#f0e040';
    ctx.beginPath();
    ctx.arc(720, 55, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffa0';
    ctx.beginPath();
    ctx.arc(720, 55, 26, 0, Math.PI * 2);
    ctx.fill();

    // Clouds (pixel style)
    drawCloud(80,  60);
    drawCloud(300, 40);
    drawCloud(550, 70);

    // Background trees (decorative, non-interactive)
    ctx.globalAlpha = 0.35;
    drawTree(620, 180);
    drawTree(680, 200);
    drawTree(730, 170);
    ctx.globalAlpha = 1;

    // Platform / chopping block where player stands
    // Wooden platform
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(50, BELT.y - 20, 130, 24);
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(52, BELT.y - 18, 126, 10);
    // Plank lines
    ctx.fillStyle = '#7a3a10';
    for (let lx = 70; lx < 175; lx += 22) {
        ctx.fillRect(lx, BELT.y - 20, 2, 24);
    }
}

function drawCloud(cx, cy) {
    ctx.fillStyle = '#ffffff';
    const blocks = [
        [0, PX, PX*4, PX*2],
        [PX, 0, PX*3, PX],
        [-PX, PX, PX, PX],
        [PX*4, PX, PX, PX],
    ];
    for (const [dx, dy, bw, bh] of blocks) {
        ctx.fillRect(cx + dx, cy + dy, bw, bh);
    }
}

// ── Conveyor belt ─────────────────────────────
function drawBelt() {
    // Belt background
    ctx.fillStyle = '#555566';
    ctx.fillRect(BELT.x, BELT.y, BELT.w, BELT.h);

    // Animated diagonal stripes
    ctx.fillStyle = '#444455';
    const stripeCount = Math.ceil(W / BELT.stripeWidth) + 2;
    for (let i = 0; i < stripeCount; i++) {
        const sx = (i * BELT.stripeWidth * 2 - BELT.offset) % (W + BELT.stripeWidth * 2) - BELT.stripeWidth;
        ctx.beginPath();
        ctx.moveTo(sx, BELT.y);
        ctx.lineTo(sx + BELT.stripeWidth, BELT.y);
        ctx.lineTo(sx + BELT.stripeWidth - BELT.h * 0.6, BELT.y + BELT.h);
        ctx.lineTo(sx - BELT.h * 0.6, BELT.y + BELT.h);
        ctx.closePath();
        ctx.fill();
    }

    // Belt edges (shiny metal rails)
    ctx.fillStyle = '#888899';
    ctx.fillRect(0, BELT.y, W, 6);
    ctx.fillRect(0, BELT.y + BELT.h - 6, W, 6);
    ctx.fillStyle = '#aaaacc';
    ctx.fillRect(0, BELT.y, W, 3);
    ctx.fillRect(0, BELT.y + BELT.h - 3, W, 3);

    // Belt rollers on sides
    drawRoller(20);
    drawRoller(W - 20);
}

function drawRoller(cx) {
    const cy = BELT.y + BELT.h / 2;
    ctx.fillStyle = '#333344';
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#666688';
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#888899';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
}

// ── Entity spawning ───────────────────────────
function spawnEntity() {
    // 25% chance of bunny, 75% tree
    const isBunny = Math.random() < 0.25;
    entities.push({
        type: isBunny ? 'bunny' : 'tree',
        x: W + 60,
        y: BELT.y - (isBunny ? 56 : 64),   // sit on belt
        w: PX * 6,
        h: isBunny ? PX * 7 : PX * 9,
        speed: baseSpeed + (score / 200) * 0.8,   // speed up as score grows
        chopAnim: 0,   // frames of chop flash remaining
        hopTimer: 0
    });
}

// ── Hit detection ─────────────────────────────
// Axe hitbox: right side of player, active on hitFrame
function getAxeHitbox() {
    return {
        x: player.x + PX * 5,
        y: player.y,
        w: PX * 3,
        h: PX * 6
    };
}

function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

function checkHit() {
    if (!player.swinging || player.didHitThisSwing) return;
    if (player.swingFrame !== player.hitFrame) return;

    const

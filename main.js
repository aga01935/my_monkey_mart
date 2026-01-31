/**
 * MONKEY MARKET - CORE GAME ENGINE
 */

// --- 1. CONFIGURATION & STATE ---
const config = {
    playerSpeed: 4,
    playerCarryLimit: 5,
    customerSpawnRate: 3000,
    moneyPickupRange: 40,
    baseItemPrice: 10
};

let gameState = {
    money: 0,
    carrying: [],
    unlockedItems: ['banana'],
    upgrades: {
        speed: 1,
        capacity: 1,
        automation: 0
    },
    isPaused: true,
    lastTime: 0
};

// --- 2. AUDIO SYSTEM (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

function playSynthSound(freq, type, duration, vol = 0.1) {
    if (gameState.isPaused) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(masterGain);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    pick: () => playSynthSound(440, 'sine', 0.1),
    drop: () => playSynthSound(330, 'sine', 0.1),
    cash: () => {
        playSynthSound(880, 'square', 0.05);
        setTimeout(() => playSynthSound(1200, 'square', 0.1), 50);
    },
    upgrade: () => playSynthSound(523, 'sawtooth', 0.3)
};

// --- 3. PROCEDURAL ASSETS (Canvas Sprites) ---
const sprites = {};
function generateSprites() {
    const sCanvas = document.createElement('canvas');
    const ctx = sCanvas.getContext('2d');
    sCanvas.width = 100; sCanvas.height = 100;

    // Monkey Sprite
    ctx.clearRect(0,0,100,100);
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.arc(50, 50, 20, 0, Math.PI*2); ctx.fill(); // Head
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath(); ctx.arc(50, 55, 12, 0, Math.PI*2); ctx.fill(); // Face
    sprites.player = new Image(); sprites.player.src = sCanvas.toDataURL();

    // Banana Sprite
    ctx.clearRect(0,0,100,100);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.ellipse(50, 50, 15, 8, Math.PI/4, 0, Math.PI*2); ctx.fill();
    sprites.banana = new Image(); sprites.banana.src = sCanvas.toDataURL();

    // Customer
    ctx.clearRect(0,0,100,100);
    ctx.fillStyle = '#4834d4';
    ctx.beginPath(); ctx.arc(50, 50, 20, 0, Math.PI*2); ctx.fill();
    sprites.customer = new Image(); sprites.customer.src = sCanvas.toDataURL();
}

// --- 4. GAME OBJECTS ---
class Entity {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
    }
}

class Player extends Entity {
    constructor() {
        super(400, 300, 40, 40);
        this.vx = 0; this.vy = 0;
    }
    update(keys) {
        let moveX = 0; let moveY = 0;
        if (keys['ArrowUp'] || keys['w']) moveY = -1;
        if (keys['ArrowDown'] || keys['s']) moveY = 1;
        if (keys['ArrowLeft'] || keys['a']) moveX = -1;
        if (keys['ArrowRight'] || keys['d']) moveX = 1;

        const speed = config.playerSpeed * (1 + (gameState.upgrades.speed - 1) * 0.2);
        this.x += moveX * speed;
        this.y += moveY * speed;

        // Bounds
        this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.h, this.y));
    }
    draw(ctx) {
        ctx.drawImage(sprites.player, this.x, this.y, this.w, this.h);
        // Draw carried stack
        gameState.carrying.forEach((item, i) => {
            ctx.drawImage(sprites.banana, this.x + 5, this.y - 15 - (i * 10), 30, 15);
        });
    }
}

class Shelf extends Entity {
    constructor(x, y, type) {
        super(x, y, 80, 100);
        this.type = type;
        this.stock = 0;
        this.maxStock = 10;
    }
    draw(ctx) {
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = 'white';
        ctx.fillText(`${this.stock}/${this.maxStock}`, this.x + 25, this.y - 10);
        for(let i=0; i<this.stock; i++) {
            ctx.drawImage(sprites.banana, this.x + 10, this.y + this.h - 20 - (i*8), 60, 15);
        }
    }
}

class Customer extends Entity {
    constructor() {
        super(canvas.width + 50, 400, 40, 40);
        this.targetX = 200;
        this.state = 'entering'; // entering, waiting, leaving
        this.timer = 0;
    }
    update() {
        if (this.state === 'entering') {
            this.x -= 2;
            if (this.x <= this.targetX) this.state = 'waiting';
        } else if (this.state === 'waiting') {
            // Check if shelf nearby has stock
            shelves.forEach(s => {
                if (s.stock > 0 && Math.abs(this.x - s.x) < 100) {
                    s.stock--;
                    this.state = 'leaving';
                    spawnMoney(this.x, this.y);
                    sounds.cash();
                }
            });
        } else if (this.state === 'leaving') {
            this.x += 2;
        }
    }
    draw(ctx) {
        ctx.drawImage(sprites.customer, this.x, this.y, this.w, this.h);
    }
}

// --- 5. INITIALIZATION ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let player, shelves = [], customers = [], coins = [];
const keys = {};

function init() {
    canvas.width = 800;
    canvas.height = 600;
    generateSprites();
    player = new Player();
    shelves.push(new Shelf(150, 200, 'banana'));
    
    // UI Setup
    document.getElementById('start-btn').onclick = startGame;
    document.getElementById('open-shop-btn').onclick = toggleShop;
    document.getElementById('close-shop').onclick = toggleShop;
    
    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);
    
    loadGame();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    audioCtx.resume();
    gameState.isPaused = false;
    document.getElementById('ui-overlay').classList.add('hidden');
}

function spawnMoney(x, y) {
    coins.push({x, y, val: config.baseItemPrice});
}

function toggleShop() {
    const shop = document.getElementById('shop-ui');
    shop.classList.toggle('hidden');
    if (!shop.classList.contains('hidden')) {
        renderShop();
    }
}

function renderShop() {
    const container = document.getElementById('shop-items');
    container.innerHTML = `
        <div class="shop-item">
            <span>Speed (Lvl ${gameState.upgrades.speed})</span>
            <button class="buy-btn" onclick="buyUpgrade('speed')" ${gameState.money < 50 ? 'disabled' : ''}>$50</button>
        </div>
        <div class="shop-item">
            <span>Capacity (Lvl ${gameState.upgrades.capacity})</span>
            <button class="buy-btn" onclick="buyUpgrade('capacity')" ${gameState.money < 75 ? 'disabled' : ''}>$75</button>
        </div>
    `;
}

window.buyUpgrade = (type) => {
    const costs = { speed: 50, capacity: 75 };
    if (gameState.money >= costs[type]) {
        gameState.money -= costs[type];
        gameState.upgrades[type]++;
        sounds.upgrade();
        saveGame();
        renderShop();
        updateHUD();
    }
};

// --- 6. CORE LOOP ---
function gameLoop(now) {
    if (!gameState.isPaused) {
        update();
        draw();
    }
    requestAnimationFrame(gameLoop);
}

function update() {
    player.update(keys);

    // Interaction with Shelves
    shelves.forEach(s => {
        const dist = Math.hypot(player.x - s.x, player.y - s.y);
        if (dist < 60) {
            // Refill shelf
            if (gameState.carrying.length > 0 && s.stock < s.maxStock) {
                gameState.carrying.pop();
                s.stock++;
                sounds.drop();
            } 
            // Harvest if it was a production station (simplified logic)
            else if (gameState.carrying.length < 5 * gameState.upgrades.capacity && s.stock === 0) {
                // In this clone, player picks up from "backroom" (top left)
            }
        }
    });

    // Production logic (Top left area)
    if (player.x < 100 && player.y < 100 && gameState.carrying.length < 5 * gameState.upgrades.capacity) {
        if (Math.random() < 0.05) {
            gameState.carrying.push('banana');
            sounds.pick();
        }
    }

    // Money Collection
    coins = coins.filter(c => {
        const dist = Math.hypot(player.x - c.x, player.y - c.y);
        if (dist < config.moneyPickupRange) {
            gameState.money += c.val;
            updateHUD();
            return false;
        }
        return true;
    });

    // Customer Spawning
    if (Math.random() < 0.005 && customers.length < 3) {
        customers.push(new Customer());
    }
    customers.forEach(c => c.update());
    customers = customers.filter(c => c.x < canvas.width + 100);
}

function draw() {
    ctx.clearRect(0,0,canvas.width, canvas.height);

    // Draw Floor Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    for(let i=0; i<canvas.width; i+=40) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }

    // Draw "Backroom" / Source
    ctx.fillStyle = '#6ab04c';
    ctx.fillRect(0,0,100,100);
    ctx.fillStyle = 'white';
    ctx.fillText("STOCK PILE", 20, 50);

    shelves.forEach(s => s.draw(ctx));
    coins.forEach(c => {
        ctx.fillStyle = 'gold';
        ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI*2); ctx.fill();
    });
    customers.forEach(c => c.draw(ctx));
    player.draw(ctx);
}

function updateHUD() {
    document.getElementById('money-display').innerText = Math.floor(gameState.money);
}

function saveGame() {
    localStorage.setItem('monkeyMartSave', JSON.stringify(gameState));
}

function loadGame() {
    const save = localStorage.getItem('monkeyMartSave');
    if (save) {
        const loaded = JSON.parse(save);
        gameState = { ...gameState, ...loaded };
        updateHUD();
    }
}

// Start the engine
init();
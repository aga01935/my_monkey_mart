/**
 * MONKEY MARKET - PRINCIPAL ENGINEER IMPLEMENTATION
 * Includes: Entity Systems, Pathfinding, Visual Synthesis, and Sound Engine.
 */

// --- 1. GAME CONSTANTS & STATE ---
const TILE_SIZE = 64;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 900;

let state = {
    money: 0,
    player: null,
    entities: [],
    customers: [],
    workers: [],
    shelves: [],
    machines: [],
    drops: [],
    unlockedZones: 1,
    carryLimit: 5,
    speedBonus: 1,
    isPaused: true,
    audioInitialized: false
};

const PRODUCT_TYPES = {
    BANANA: { name: 'Banana', color: '#fbc531', price: 10, growTime: 2000 },
    CORN: { name: 'Corn', color: '#e1b12c', price: 25, growTime: 4000 },
    MILK: { name: 'Milk', color: '#f5f6fa', price: 50, growTime: 6000 }
};

// --- 2. ASSET GENERATOR (High Fidelity Procedural Art) ---
const Sprites = {};
function generateAllSprites() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const createTexture = (w, h, drawFn) => {
        canvas.width = w; canvas.height = h;
        ctx.clearRect(0,0,w,h);
        drawFn(ctx);
        const img = new Image();
        img.src = canvas.toDataURL();
        return img;
    };

    // Monkey Sprite (Head, Ears, Body, Tail)
    Sprites.monkey = createTexture(64, 64, (c) => {
        c.fillStyle = '#8c7e6a';
        c.beginPath(); c.arc(32, 45, 18, 0, Math.PI*2); c.fill(); // Body
        c.beginPath(); c.arc(32, 25, 15, 0, Math.PI*2); c.fill(); // Head
        c.fillStyle = '#f5f6fa';
        c.beginPath(); c.arc(32, 28, 10, 0, Math.PI*2); c.fill(); // Face
        c.fillStyle = '#2f3640';
        c.beginPath(); c.arc(28, 25, 2, 0, Math.PI*2); c.fill(); // Left Eye
        c.beginPath(); c.arc(36, 25, 2, 0, Math.PI*2); c.fill(); // Right Eye
        c.strokeStyle = '#574b90'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(15, 45); c.quadraticCurveTo(5, 50, 10, 60); c.stroke(); // Tail
    });

    // Shelf Sprite
    Sprites.shelf = createTexture(100, 120, (c) => {
        c.fillStyle = '#4b4b4b'; c.fillRect(5, 10, 90, 100); // Back
        c.fillStyle = '#dcdde1'; 
        c.fillRect(5, 40, 90, 10); c.fillRect(5, 75, 90, 10); // Planks
    });

    // Banana Sprite
    Sprites.banana = createTexture(32, 32, (c) => {
        c.fillStyle = '#fbc531';
        c.beginPath(); c.ellipse(16, 16, 12, 6, Math.PI/4, 0, Math.PI*2); c.fill();
    });
}

// --- 3. AUDIO ENGINE ---
const AudioEngine = {
    ctx: null,
    masterGain: null,
    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
    },
    play(freq, type = 'sine', decay = 0.1, vol = 0.1) {
        if (!state.audioInitialized) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + decay);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + decay);
    },
    sfx: {
        collect: () => AudioEngine.play(600, 'triangle', 0.1),
        cash: () => { AudioEngine.play(880, 'square', 0.05); setTimeout(()=>AudioEngine.play(1200, 'square', 0.1), 50); },
        walk: () => AudioEngine.play(150, 'sine', 0.05, 0.02)
    }
};

// --- 4. CORE CLASSES ---
class Player {
    constructor() {
        this.x = WORLD_WIDTH / 2;
        this.y = WORLD_HEIGHT / 2;
        this.w = 48; this.h = 48;
        this.inventory = [];
        this.frame = 0;
        this.dir = 1;
    }

    update(input) {
        let mx = 0, my = 0;
        if (input.w) my = -1; if (input.s) my = 1;
        if (input.a) { mx = -1; this.dir = -1; }
        if (input.d) { mx = 1; this.dir = 1; }

        if (mx !== 0 || my !== 0) {
            const s = 5 * state.speedBonus;
            this.x += mx * s; this.y += my * s;
            this.frame += 0.2;
            if (Math.floor(this.frame) % 5 === 0) AudioEngine.sfx.walk();
        }

        // Constraints
        this.x = Math.max(50, Math.min(WORLD_WIDTH - 50, this.x));
        this.y = Math.max(50, Math.min(WORLD_HEIGHT - 50, this.y));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir === -1) ctx.scale(-1, 1);
        
        // Bounce animation
        const bounce = Math.sin(this.frame) * 3;
        ctx.drawImage(Sprites.monkey, -24, -24 + bounce, 48, 48);
        
        // Render Inventory stack
        this.inventory.forEach((item, i) => {
            ctx.drawImage(Sprites.banana, -16, -40 - (i * 10) + bounce, 32, 32);
        });
        ctx.restore();
    }
}

class Customer {
    constructor() {
        this.x = -50; this.y = WORLD_HEIGHT - 100;
        this.target = null;
        this.state = 'entering'; // entering, shopping, queueing, leaving
        this.patience = 1000;
    }

    update() {
        if (this.state === 'entering') {
            this.x += 2;
            if (this.x > 200) {
                this.state = 'shopping';
                this.target = state.shelves[0];
            }
        } else if (this.state === 'shopping') {
            const dist = Math.hypot(this.x - (this.target.x + 40), this.y - (this.target.y + 100));
            if (dist < 10) {
                if (this.target.stock > 0) {
                    this.target.stock--;
                    this.state = 'leaving';
                    state.drops.push({x: this.x, y: this.y, value: 10, life: 1.0});
                    AudioEngine.sfx.cash();
                }
            } else {
                this.x += (this.target.x + 40 - this.x) * 0.05;
                this.y += (this.target.y + 100 - this.y) * 0.05;
            }
        } else if (this.state === 'leaving') {
            this.x -= 3;
        }
    }

    draw(ctx) {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(Sprites.monkey, this.x - 24, this.y - 24, 48, 48);
        ctx.globalAlpha = 1.0;
    }
}

class Shelf {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.stock = 0; this.maxStock = 10;
    }
    draw(ctx) {
        ctx.drawImage(Sprites.shelf, this.x, this.y, 80, 100);
        for(let i=0; i<this.stock; i++) {
            ctx.drawImage(Sprites.banana, this.x + 24, this.y + 60 - (i * 6), 32, 32);
        }
    }
}

// --- 5. GAME ENGINE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const input = { w: false, a: false, s: false, d: false };

function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    generateAllSprites();
    state.player = new Player();
    state.shelves.push(new Shelf(400, 200, 'BANANA'));
    state.machines.push({ x: 100, y: 100, type: 'BANANA', timer: 0 });

    window.addEventListener('keydown', e => input[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => input[e.key.toLowerCase()] = false);
    
    document.getElementById('start-btn').onclick = () => {
        if (!state.audioInitialized) { AudioEngine.init(); state.audioInitialized = true; }
        state.isPaused = false;
        document.getElementById('overlay').classList.add('hidden');
    };

    requestAnimationFrame(loop);
}

function loop() {
    if (!state.isPaused) {
        update();
        draw();
    }
    requestAnimationFrame(loop);
}

function update() {
    state.player.update(input);

    // Interaction: Machine (Production)
    state.machines.forEach(m => {
        const dist = Math.hypot(state.player.x - (m.x + 50), state.player.y - (m.y + 50));
        if (dist < 60 && state.player.inventory.length < state.carryLimit) {
            m.timer++;
            if (m.timer > 30) {
                state.player.inventory.push(m.type);
                m.timer = 0;
                AudioEngine.sfx.collect();
            }
        }
    });

    // Interaction: Shelf (Stocking)
    state.shelves.forEach(s => {
        const dist = Math.hypot(state.player.x - (s.x + 40), state.player.y - (s.y + 50));
        if (dist < 80 && state.player.inventory.length > 0 && s.stock < s.maxStock) {
            state.player.inventory.pop();
            s.stock++;
        }
    });

    // Customer Spawning
    if (Math.random() < 0.005 && state.customers.length < 5) {
        state.customers.push(new Customer());
    }

    state.customers.forEach(c => c.update());
    state.customers = state.customers.filter(c => c.x > -100);

    // Money collection
    state.drops.forEach((d, i) => {
        const dist = Math.hypot(state.player.x - d.x, state.player.y - d.y);
        if (dist < 50) {
            state.money += d.value;
            state.drops.splice(i, 1);
            document.getElementById('money-count').innerText = state.money;
        }
    });

    document.getElementById('capacity-count').innerText = `${state.player.inventory.length}/${state.carryLimit}`;
}

function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Camera follow
    const camX = -state.player.x + canvas.width / 2;
    const camY = -state.player.y + canvas.height / 2;
    ctx.translate(camX, camY);

    // Floor
    ctx.fillStyle = '#78e08f';
    ctx.fillRect(0,0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.strokeStyle = '#63c276';
    for(let i=0; i<WORLD_WIDTH; i+=TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, WORLD_HEIGHT); ctx.stroke();
    }

    // Entities
    state.machines.forEach(m => {
        ctx.fillStyle = '#3d3d3d'; ctx.fillRect(m.x, m.y, 100, 100);
        ctx.fillStyle = 'white'; ctx.fillText("BANANA TREE", m.x + 10, m.y - 10);
    });
    
    state.shelves.forEach(s => s.draw(ctx));
    state.drops.forEach(d => {
        ctx.fillStyle = '#fbc531';
        ctx.beginPath(); ctx.arc(d.x, d.y, 8, 0, Math.PI*2); ctx.fill();
    });
    
    state.customers.forEach(c => c.draw(ctx));
    state.player.draw(ctx);
}

window.onload = init;

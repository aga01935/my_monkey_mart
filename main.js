/**
 * MONKEY MARKET - ELITE EDITION
 * Systems: Production, Stocking, AI Customers, Economy, and Carry-Stacking.
 */

const CONFIG = {
    PLAYER_SPEED: 4,
    CARRY_LIMIT: 6,
    INTERACT_DIST: 70,
    WORLD_UNIT: 80
};

const state = {
    money: 0,
    isPaused: true,
    input: { x: 0, y: 0 },
    inventory: [], // Stack of items
    objects: [],   // Shelves, Trees, Registers
    customers: [],
    lastTick: 0
};

// --- 1. GAME OBJECTS ---

class MarketObject {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.stock = 0; this.maxStock = 10;
        this.timer = 0;
    }

    update(player) {
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        
        // 1. PRODUCTION (Banana Tree)
        if (this.type === 'tree') {
            this.timer++;
            if (this.timer > 60 && this.stock < this.maxStock) {
                this.stock++;
                this.timer = 0;
            }
            if (dist < CONFIG.INTERACT_DIST && this.stock > 0 && player.inventory.length < CONFIG.CARRY_LIMIT) {
                player.inventory.push('banana');
                this.stock--;
            }
        }

        // 2. SHELF (Stocking)
        if (this.type === 'shelf') {
            if (dist < CONFIG.INTERACT_DIST && player.inventory.length > 0 && this.stock < this.maxStock) {
                player.inventory.pop();
                this.stock++;
            }
        }

        // 3. REGISTER (Selling)
        if (this.type === 'register' && dist < CONFIG.INTERACT_DIST) {
            // Logic handled by Customer update, but register can visual feedback here
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.type === 'tree') {
            ctx.fillStyle = '#44bd32'; // Leaves
            ctx.beginPath(); ctx.arc(0, -20, 30, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fbc531'; // Visible Bananas
            for(let i=0; i<this.stock; i++) ctx.fillRect(-20 + (i*5), -20, 4, 8);
        }

        if (this.type === 'shelf') {
            ctx.fillStyle = '#8c7e6a'; ctx.fillRect(-40, -10, 80, 50); // Base
            ctx.fillStyle = '#fbc531'; // Items on shelf
            for(let i=0; i<this.stock; i++) {
                ctx.fillRect(-30 + (i % 5 * 12), 10 - (Math.floor(i/5) * 10), 10, 6);
            }
        }

        if (this.type === 'register') {
            ctx.fillStyle = '#2f3640'; ctx.fillRect(-30, -20, 60, 40);
            ctx.fillStyle = '#green'; ctx.fillText("$", -5, 5);
        }
        ctx.restore();
    }
}

class Customer {
    constructor() {
        this.x = 0; this.y = window.innerHeight - 50;
        this.state = 'buying'; // buying, leaving
        this.targetShelf = state.objects.find(o => o.type === 'shelf');
    }

    update() {
        if (this.state === 'buying') {
            const dist = Math.hypot(this.x - this.targetShelf.x, this.y - (this.targetShelf.y + 40));
            if (dist < 10) {
                if (this.targetShelf.stock > 0) {
                    this.targetShelf.stock--;
                    state.money += 15;
                    this.state = 'leaving';
                    document.getElementById('money-count').innerText = state.money;
                }
            } else {
                this.x += (this.targetShelf.x - this.x) * 0.02;
                this.y += (this.targetShelf.y + 40 - this.y) * 0.02;
            }
        } else {
            this.x -= 3; // Walk out
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#4834d4';
        ctx.beginPath(); ctx.arc(this.x, this.y, 15, 0, Math.PI*2); ctx.fill();
    }
}

// --- 2. PLAYER ENGINE ---

const player = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    inventory: [],
    angle: 0,
    
    update() {
        this.x += state.input.x * CONFIG.PLAYER_SPEED;
        this.y += state.input.y * CONFIG.PLAYER_SPEED;

        if (state.input.x !== 0 || state.input.y !== 0) {
            this.angle = Math.atan2(state.input.y, state.input.x);
        }
    },

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Carry Stack
        this.inventory.forEach((item, i) => {
            ctx.fillStyle = '#fbc531';
            ctx.fillRect(-15, -40 - (i * 8), 30, 6);
            ctx.strokeStyle = '#e1b12c'; ctx.strokeRect(-15, -40 - (i * 8), 30, 6);
        });

        // Monkey
        ctx.rotate(this.angle);
        ctx.fillStyle = '#8c7e6a';
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f5f6fa';
        ctx.beginPath(); ctx.arc(10, 0, 10, 0, Math.PI*2); ctx.fill(); // Face
        ctx.restore();
    }
};

// --- 3. CORE LOOP & INPUT ---

const Graphics = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    
    init() {
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    render() {
        this.ctx.fillStyle = '#78e08f'; // Grass
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Sort by Y for Depth
        const allEntities = [...state.objects, ...state.customers, player].sort((a, b) => a.y - b.y);
        
        allEntities.forEach(ent => ent.draw(this.ctx));
    }
};

const Input = {
    init() {
        const joyContainer = document.getElementById('joystick-container');
        const joyKnob = document.getElementById('joystick-knob');
        const joyBase = document.getElementById('joystick-base');

        const move = (clientX, clientY) => {
            const rect = joyBase.getBoundingClientRect();
            const dx = clientX - (rect.left + rect.width / 2);
            const dy = clientY - (rect.top + rect.height / 2);
            const dist = Math.sqrt(dx*dx + dy*dy);
            const max = rect.width / 2;
            
            const normalizedX = dx / max;
            const normalizedY = dy / max;
            
            state.input.x = dist > 5 ? Math.min(Math.max(normalizedX, -1), 1) : 0;
            state.input.y = dist > 5 ? Math.min(Math.max(normalizedY, -1), 1) : 0;

            const knobX = state.input.x * max;
            const knobY = state.input.y * max;
            joyKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        };

        window.addEventListener('touchstart', (e) => { 
            if(e.target.closest('#joystick-container')) state.activeTouch = true; 
        }, {passive: false});

        window.addEventListener('touchmove', (e) => {
            if(state.activeTouch) {
                move(e.touches[0].clientX, e.touches[0].clientY);
                e.preventDefault();
            }
        }, {passive: false});

        window.addEventListener('touchend', () => {
            state.activeTouch = false;
            state.input = { x: 0, y: 0 };
            joyKnob.style.transform = `translate(-50%, -50%)`;
        });
    }
};

function tick() {
    if (!state.isPaused) {
        player.update();
        state.objects.forEach(o => o.update(player));
        state.customers.forEach(c => c.update());
        
        if (Math.random() < 0.005) state.customers.push(new Customer());
        
        Graphics.render();
    }
    requestAnimationFrame(tick);
}

// Start Game
document.getElementById('start-btn').onclick = () => {
    state.isPaused = false;
    document.getElementById('overlay').classList.add('hidden');
    
    // Setup initial store
    state.objects.push(new MarketObject(100, 150, 'tree'));
    state.objects.push(new MarketObject(window.innerWidth - 100, 250, 'shelf'));
    state.objects.push(new MarketObject(window.innerWidth / 2, window.innerHeight - 150, 'register'));

    Graphics.init();
    Input.init();
    tick();
};

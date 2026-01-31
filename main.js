/**
 * MONKEY MARKET - PROFESSIONAL CORE ENGINE
 * Features: Responsive Canvas, Virtual Joystick, Procedural Texturing, 
 * Mobile Touch Optimization, and Entity Management.
 */

// --- 1. ENGINE CONFIGURATION ---
const CONFIG = {
    PLAYER_SPEED: 5,
    CARRY_LIMIT_BASE: 5,
    WORLD_UNIT: 64,
    JOYSTICK_THRESHOLD: 0.1
};

const state = {
    money: 0,
    isPaused: true,
    input: { x: 0, y: 0 },
    joystickActive: false,
    entities: [],
    lastTime: 0,
    floorPattern: null
};

// --- 2. CORE CLASSES ---

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 22;
        this.inventory = [];
        this.angle = 0;
        this.walkCycle = 0;
    }

    update() {
        if (Math.abs(state.input.x) < CONFIG.JOYSTICK_THRESHOLD && 
            Math.abs(state.input.y) < CONFIG.JOYSTICK_THRESHOLD) return;

        // Movement Logic
        this.x += state.input.x * CONFIG.PLAYER_SPEED;
        this.y += state.input.y * CONFIG.PLAYER_SPEED;

        // Calculate Angle for Sprite Orientation
        this.angle = Math.atan2(state.input.y, state.input.x);
        this.walkCycle += 0.15;

        // World Bounds
        this.x = Math.max(this.radius, Math.min(window.innerWidth - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(window.innerHeight - this.radius, this.y));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.beginPath();
        ctx.ellipse(0, 20, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Animated Body Bounce
        const bounce = Math.sin(this.walkCycle) * 3;
        
        // Monkey Body (High-Fidelity Shape)
        ctx.rotate(this.angle + Math.PI/2);
        ctx.fillStyle = "#8c7e6a"; // Fur
        ctx.beginPath();
        ctx.arc(0, bounce, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Monkey Face
        ctx.fillStyle = "#f5f6fa"; // Face Skin
        ctx.beginPath();
        ctx.arc(0, bounce - 5, 12, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = "#2f3640";
        ctx.beginPath();
        ctx.arc(-5, bounce - 7, 2, 0, Math.PI * 2);
        ctx.arc(5, bounce - 7, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- 3. INPUT MANAGEMENT (MOBILE & DESKTOP) ---

const InputManager = {
    init() {
        const joyBase = document.getElementById('joystick-base');
        const joyKnob = document.getElementById('joystick-knob');
        const joyContainer = document.getElementById('joystick-container');

        // Show joystick on touch devices
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            joyContainer.style.display = 'block';
        }

        const handleMove = (touchX, touchY) => {
            const rect = joyBase.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            let dx = touchX - centerX;
            let dy = touchY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = rect.width / 2;

            if (dist > maxDist) {
                dx *= maxDist / dist;
                dy *= maxDist / dist;
            }

            state.input.x = dx / maxDist;
            state.input.y = dy / maxDist;
            joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        };

        // Touch Listeners
        joyContainer.addEventListener('touchstart', (e) => {
            state.joystickActive = true;
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
            if (e.cancelable) e.preventDefault();
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (state.joystickActive) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            state.joystickActive = false;
            state.input = { x: 0, y: 0 };
            joyKnob.style.transform = `translate(-50%, -50%)`;
        });

        // Keyboard Fallback
        const keys = {};
        window.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
            updateKeyboardInput();
        });
        window.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
            updateKeyboardInput();
        });

        function updateKeyboardInput() {
            if (state.joystickActive) return;
            state.input.x = (keys['a'] || keys['arrowleft'] ? -1 : 0) + (keys['d'] || keys['arrowright'] ? 1 : 0);
            state.input.y = (keys['w'] || keys['arrowup'] ? -1 : 0) + (keys['s'] || keys['arrowdown'] ? 1 : 0);
        }
    }
};

// --- 4. GRAPHICS ENGINE ---

const Graphics = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    init() {
        window.addEventListener('resize', () => this.resize());
        this.resize();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.createFloorPattern();
    },

    createFloorPattern() {
        const pCanvas = document.createElement('canvas');
        const pCtx = pCanvas.getContext('2d');
        pCanvas.width = 128; pCanvas.height = 128;

        // Grass Base
        pCtx.fillStyle = '#78e08f';
        pCtx.fillRect(0, 0, 128, 128);

        // Texture Details (Blades of grass)
        pCtx.strokeStyle = '#63c276';
        pCtx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * 128;
            const y = Math.random() * 128;
            pCtx.beginPath();
            pCtx.moveTo(x, y);
            pCtx.lineTo(x + 2, y - 5);
            pCtx.stroke();
        }

        state.floorPattern = this.ctx.createPattern(pCanvas, 'repeat');
    },

    render(player) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw Background
        if (state.floorPattern) {
            this.ctx.fillStyle = state.floorPattern;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Grid lines for depth
        this.ctx.strokeStyle = 'rgba(0,0,0,0.03)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += CONFIG.WORLD_UNIT) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += CONFIG.WORLD_UNIT) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke();
        }

        player.draw(this.ctx);
    }
};

// --- 5. MAIN GAME LOOP ---

const player = new Player(window.innerWidth / 2, window.innerHeight / 2);

function tick(timestamp) {
    if (!state.isPaused) {
        player.update();
        Graphics.render(player);
    }
    requestAnimationFrame(tick);
}

// Start Command
document.getElementById('start-btn').onclick = () => {
    state.isPaused = false;
    document.getElementById('overlay').classList.add('hidden');
    
    // Initializing Systems
    Graphics.init();
    InputManager.init();
    
    requestAnimationFrame(tick);
};

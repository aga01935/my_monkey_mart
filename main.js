/**
 * MONKEY MARKET - PRODUCTION BUILD (RESPONSIVE + TOUCH)
 */

const state = {
    money: 0,
    isPaused: true,
    input: { x: 0, y: 0 }, // Normalized -1 to 1
    joystickActive: false,
    canvasScale: 1
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let floorPattern;

// --- 1. RESPONSIVE ENGINE ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Create actual grass/tile texture
    const tempCanvas = document.createElement('canvas');
    const tCtx = tempCanvas.getContext('2d');
    tempCanvas.width = 64; tempCanvas.height = 64;
    tCtx.fillStyle = '#78e08f'; // Base Grass
    tCtx.fillRect(0,0,64,64);
    tCtx.strokeStyle = '#63c276'; // Blade Detail
    tCtx.lineWidth = 2;
    tCtx.beginPath(); tCtx.moveTo(10, 64); tCtx.lineTo(15, 45); tCtx.stroke();
    tCtx.beginPath(); tCtx.moveTo(40, 64); tCtx.lineTo(35, 50); tCtx.stroke();
    
    floorPattern = ctx.createPattern(tempCanvas, 'repeat');
}

window.addEventListener('resize', resize);
resize();

// --- 2. TOUCH & JOYSTICK LOGIC ---
const joyBase = document.getElementById('joystick-base');
const joyKnob = document.getElementById('joystick-knob');
const joyContainer = document.getElementById('joystick-container');

if ('ontouchstart' in window) {
    joyContainer.style.display = 'block';
}

function handleJoystick(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = joyBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = rect.width / 2;

    if (dist > maxDist) {
        dx *= maxDist / dist;
        dy *= maxDist / dist;
    }

    state.input.x = dx / maxDist;
    state.input.y = dy / maxDist;
    
    joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

joyContainer.addEventListener('touchstart', () => state.joystickActive = true);
joyContainer.addEventListener('touchmove', handleJoystick);
joyContainer.addEventListener('touchend', () => {
    state.joystickActive = false;
    state.input = { x: 0, y: 0 };
    joyKnob.style.transform = `translate(-50%, -50%)`;
});

// Keyboard Fallback
window.addEventListener('keydown', e => {
    if(e.key === 'ArrowUp' || e.key === 'w') state.input.y = -1;
    if(e.key === 'ArrowDown' || e.key === 's') state.input.y = 1;
    if(e.key === 'ArrowLeft' || e.key === 'a') state.input.x = -1;
    if(e.key === 'ArrowRight' || e.key === 'd') state.input.x = 1;
});
window.addEventListener('keyup', () => state.input = { x: 0, y: 0 });

// --- 3. UPDATED PLAYER & RENDER ---
class Player {
    constructor() {
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight / 2;
        this.radius = 25;
    }

    update() {
        this.x += state.input.x * 5;
        this.y += state.input.y * 5;
    }

    draw() {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y + 20, 20, 10, 0, 0, Math.PI*2); ctx.fill();
        
        // Simple High-Fidelity Monkey Circle
        ctx.fillStyle = '#8c7e6a';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f5f6fa'; // Face
        ctx.beginPath(); ctx.arc(this.x, this.y - 2, 15, 0, Math.PI*2); ctx.fill();
    }
}

const player = new Player();

function mainLoop() {
    if (!state.isPaused) {
        player.update();
        
        // DRAWING
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply Textured Background
        ctx.fillStyle = floorPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        player.draw();
    }
    requestAnimationFrame(mainLoop);
}

document.getElementById('start-btn').onclick = () => {
    state.isPaused = false;
    document.getElementById('overlay').classList.add('hidden');
    mainLoop();
};

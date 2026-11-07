/* =========================================================================
   ULTRA FIGHTER Z - Moteur complet avec Mode Twitch Chat
   ========================================================================= */
'use strict';

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  W: 1280, H: 720, GROUND_Y: 600,
  GRAVITY: 2200, JUMP_VEL: -900,
  MOVE_SPEED: 320, RUN_SPEED: 480,
  ROUND_TIME: 99, MAX_ENERGY: 100,
  SUPER_COST: 100, COMBO_RESET_TIME: 1.4,
  HIT_STUN: 0.35, BLOCK_STUN: 0.2,
  SUPER_STUN: 1.8, CRIT_CHANCE: 0.18, CRIT_MULT: 1.8
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const lerp = (a, b, t) => a + (b - a) * t;

// ============================================================
// CANVAS & RESIZE
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

function resizeCanvas() {
  const cw = window.innerWidth, ch = window.innerHeight;
  const targetRatio = CONFIG.W / CONFIG.H, winRatio = cw / ch;
  let w, h;
  if (winRatio > targetRatio) { h = ch; w = h * targetRatio; }
  else { w = cw; h = w / targetRatio; }
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.style.left = ((cw - w) / 2) + 'px';
  canvas.style.top = ((ch - h) / 2) + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resScale = Math.min(1, w / CONFIG.W * dpr);
  canvas.width = Math.round(CONFIG.W * resScale);
  canvas.height = Math.round(CONFIG.H * resScale);
  ctx.scale(canvas.width / CONFIG.W, canvas.height / CONFIG.H);
}
window.addEventListener('resize', resizeCanvas);

// ============================================================
// DONNÉES
// ============================================================
const CHARACTERS = [
  { id: 'ryu', name: 'RYU', role: 'SHOTO', colors: { body: '#2a5c8a', skin: '#f0c090', accent: '#ffffff', hair: '#111111', aura: '#00ccff' }, stats: { speed: 1.0, power: 1.0, jump: 1.0 }, super: { name: 'HADOKEN', color: '#00ccff' } },
  { id: 'ken', name: 'KEN', role: 'SHOTO', colors: { body: '#cc2222', skin: '#f5c8a0', accent: '#ffffff', hair: '#ffdd44', aura: '#ff6600' }, stats: { speed: 1.05, power: 1.05, jump: 1.0 }, super: { name: 'FLAMME', color: '#ff6600' } },
  { id: 'chunli', name: 'CHUN-LI', role: 'SPEED', colors: { body: '#2255cc', skin: '#f0c090', accent: '#ffcc00', hair: '#222222', aura: '#ff44cc' }, stats: { speed: 1.25, power: 0.85, jump: 1.15 }, super: { name: 'TORNADE', color: '#ff44cc' } },
  { id: 'scorpion', name: 'SCORPION', role: 'NINJA', colors: { body: '#222222', skin: '#e0b080', accent: '#ffaa00', hair: '#111111', aura: '#ffaa00' }, stats: { speed: 1.1, power: 1.1, jump: 0.95 }, super: { name: 'ENFER', color: '#ffaa00' } }
];

const ARENAS = [
  { id: 'street', name: 'RUE URBAINE', sky: ['#0a0a2e', '#1a1a4e'], ground: '#2a2a3a', accent: '#ff4488', particles: 'rain', stars: 60, buildings: true, meadow: false, rainbow: false, spectators: false },
  { id: 'temple', name: 'TEMPLE JAPONAIS', sky: ['#2a1a0a', '#4a2a1a'], ground: '#3a2a1a', accent: '#ffaa44', particles: 'petals', stars: 0, buildings: false, meadow: false, rainbow: false, spectators: false },
  { id: 'future', name: 'ARÈNE FUTURISTE', sky: ['#0a0020', '#1a0040'], ground: '#1a1a3a', accent: '#00ffff', particles: 'sparks', stars: 100, buildings: true, meadow: false, rainbow: false, spectators: false },
  { id: 'volcano', name: 'ZONE VOLCANIQUE', sky: ['#2a0505', '#4a1010'], ground: '#2a1005', accent: '#ff4400', particles: 'fire', stars: 10, buildings: false, meadow: false, rainbow: false, spectators

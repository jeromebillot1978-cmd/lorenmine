/* =========================================================================
   ULTRA FIGHTER Z - Jeu complet (Moteur, IA, Spectateurs, Prairie)
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
// CANVAS
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
  { id: 'volcano', name: 'ZONE VOLCANIQUE', sky: ['#2a0505', '#4a1010'], ground: '#2a1005', accent: '#ff4400', particles: 'fire', stars: 10, buildings: false, meadow: false, rainbow: false, spectators: false },
  { id: 'meadow', name: 'PRAIRIE FLEURIE', sky: ['#5ba8e0', '#a8d8f0'], ground: '#7acc5a', accent: '#ff88cc', particles: 'petals', stars: 0, buildings: false, meadow: true, rainbow: true, spectators: true }
];

// ============================================================
// PARTICULES
// ============================================================
class Particle {
  constructor(x, y, vx, vy, life, color, size, type) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life; this.color = color;
    this.size = size; this.type = type || 'spark';
    this.grav = (type === 'debris') ? 900 : (type === 'fire' ? -60 : 0);
    this.rot = rand(0, Math.PI * 2); this.rotV = rand(-8, 8);
  }
  update(dt) {
    this.vy += this.grav * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += this.rotV * dt; this.life -= dt;
    if (this.type === 'fire' || this.type === 'smoke') this.size *= (1 - 0.8 * dt);
  }
  draw(c) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    c.globalAlpha = t;
    c.save(); c.translate(this.x, this.y); c.rotate(this.rot);
    if (this.type === 'spark' || this.type === 'electric' || this.type === 'confetti' || this.type === 'petal') {
      c.fillStyle = this.color;
      c.beginPath();
      if (this.type === 'petal') c.ellipse(0, 0, this.size * t, (this.size / 2) * t, 0, 0, Math.PI * 2);
      else c.arc(0, 0, this.size * t, 0, Math.PI * 2);
      c.fill();
    } else if (this.type === 'fire') {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, this.size);
      g.addColorStop(0, '#ffff88'); g.addColorStop(0.4, this.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, this.size, 0, Math.PI * 2); c.fill();
    } else if (this.type === 'smoke') {
      c.globalAlpha = t * 0.5; c.fillStyle = this.color;
      c.beginPath(); c.arc(0, 0, this.size, 0, Math.PI * 2); c.fill();
    } else if (this.type === 'debris') {
      c.fillStyle = this.color; c.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    } else {
      c.fillStyle = this.color; c.beginPath(); c.arc(0, 0, this.size * t, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}

class ParticleSystem {
  constructor() { this.particles = []; this.maxParticles = 700; }
  add(p) { if (this.particles.length >= this.maxParticles) this.particles.shift(); this.particles.push(p); }
  burst(x, y, count, color, speed, type, size) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2); const s = rand(speed * 0.3, speed);
      this.add(new Particle(x + rand(-10, 10), y + rand(-10, 10), Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.8), color, size || rand(2, 6), type || 'spark'));
    }
  }
  explosion(x, y, power) {
    for (let i = 0; i < 40 * power; i++) { const a = rand(0, Math.PI * 2); const s = rand(80, 500) * power; this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.9), i % 2 === 0 ? '#ff4400' : '#ffaa00', rand(4, 12), 'fire')); }
    for (let i = 0; i < 20 * power; i++) { const a = rand(0, Math.PI * 2); const s = rand(30, 200) * power; this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 60, rand(0.5, 1.3), '#333333', rand(8, 22), 'smoke')); }
    for (let i = 0; i < 30 * power; i++) { const a = rand(0, Math.PI * 2); const s = rand(200, 800) * power; this.add(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.5), '#ffee88', rand(2, 5), 'spark')); }
  }
  update(dt) { for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.update(dt); if (p.life <= 0) this.particles.splice(i, 1); } }
  draw(c) { for (const p of this.particles) p.draw(c); c.globalAlpha = 1; c.shadowBlur = 0; }
  clear() { this.particles.length = 0; }
}
const particles = new ParticleSystem();

// ============================================================
// SPECTATEURS (PETITS OURSONS)
// ============================================================
class Spectator {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.baseY = y;
    this.color = color;
    this.state = 'idle'; // idle, dance, jump, run, hide, cheer
    this.timer = rand(0, 2);
    this.vx = 0;
    this.facing = Math.random() > 0.5 ? 1 : -1;
    this.size = rand(0.7, 1.1);
    this.bouncePhase = rand(0, Math.PI * 2);
  }
  update(dt, fighters, arena) {
    this.timer -= dt;
    this.bouncePhase += dt * 5;

    // Réagir aux combats
    let intense = false;
    let ko = false;
    let superAtk = false;
    for (const f of fighters) {
      if (f && (f.state === 'punch' || f.state === 'kick')) intense = true;
      if (f && f.state === 'super') superAtk = true;
      if (f && f.state === 'ko') ko = true;
    }

    if (ko) {
      this.state = 'cheer';
    } else if (superAtk) {
      this.state = 'hide'; // Étonnement / fuite
    } else if (intense) {
      this.state = 'jump';
    } else if (this.timer <= 0) {
      const r = Math.random();
      if (arena.meadow) {
        if (r < 0.4) this.state = 'idle';
        else if (r < 0.7) this.state = 'dance';
        else if (r < 0.9) this.state = 'run';
        else this.state = 'jump';
      } else {
        this.state = 'idle';
      }
      this.timer = rand(1, 4);
      if (this.state === 'run') {
        this.vx = rand(-50, 50);
        this.facing = Math.sign(this.vx) || 1;
      } else {
        this.vx = 0;
      }
    }

    // Animation de mouvement
    if (this.state === 'run' || this.state === 'hide') {
      this.x += this.vx * dt;
      // Limites
      if (this.x < 50 || this.x > CONFIG.W - 50) {
        this.vx *= -1;
        this.facing = Math.sign(this.vx);
      }
    }

    // Saut
    if (this.state === 'jump') {
      this.y = this.baseY - Math.abs(Math.sin(this.bouncePhase * 2)) * 15 * this.size;
    } else if (this.state === 'dance') {
      this.y = this.baseY - Math.abs(Math.sin(this.bouncePhase)) * 10 * this.size;
    } else if (this.state === 'cheer') {
      this.y = this.baseY - Math.abs(Math.sin(this.bouncePhase * 3)) * 25 * this.size;
    } else if (this.state === 'hide') {
      this.y = this.baseY + 10; // Se baisse
    } else {
      this.y = this.baseY;
    }
  }
  draw(c) {
    c.save();
    c.translate(this.x, this.y);
    c.scale(this.size, this.size);
    if (this.facing === -1) c.scale(-1, 1);

    const t = performance.now() / 1000;
    // Ombre
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath();
    c.ellipse(0, 10, 20, 6, 0, 0, Math.PI * 2);
    c.fill();

    // Corps (ourson)
    c.fillStyle = this.color;
    c.beginPath();
    c.ellipse(0, -10, 18, 22, 0, 0, Math.PI * 2);
    c.fill();

    // Ventre clair
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.beginPath();
    c.ellipse(0, -5, 10, 14, 0, 0, Math.PI * 2);
    c.fill();

    // Tête
    c.fillStyle = this.color;
    c.beginPath();
    c.arc(0, -35, 16, 0, Math.PI * 2);
    c.fill();

    // Oreilles
    c.beginPath(); c.arc(-14, -45, 7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(14, -45, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,200,200,0.6)';
    c.beginPath(); c.arc(-14, -45, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(14, -45, 4, 0, Math.PI * 2); c.fill();

    // Yeux
    c.fillStyle = '#000';
    c.beginPath(); c.arc(-6, -36, 2.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(6, -36, 2.5, 0, Math.PI * 2); c.fill();

    // Museau
    c.fillStyle = '#ffcccc';
    c.beginPath(); c.arc(0, -30, 3, 0, Math.PI * 2); c.fill();

    // Bras / jambes
    c.strokeStyle = this.color;
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-12, -15); c.lineTo(-18, -5); c.stroke();
    c.beginPath(); c.moveTo(12, -15); c.lineTo(18, -5); c.stroke();

    // Animation de fleur ou de signe
    if (this.state === 'cheer') {
      c.fillStyle = '#ff88cc';
      c.beginPath(); c.arc(18, -15 + Math.sin(t*10)*5, 5, 0, Math.PI * 2); c.fill();
    } else if (this.state === 'hide') {
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.beginPath(); c.arc(0, -35, 16, 0, Math.PI * 2); c.fill();
    } else if (Math.sin(t + this.bouncePhase) > 0.8) {
      // Fleur ramassée
      c.fillStyle = '#ffaa00';
      c.beginPath(); c.arc(15, -10, 4, 0, Math.PI * 2); c.fill();
    }

    c.restore();
  }
}

// ============================================================
// CAMÉRA
// ============================================================
const camera = {
  x: 0, y: 0, zoom: 1, targetZoom: 1, shake: 0, shakeX: 0, shakeY: 0, slowmo: 0,
  update(dt) {
    this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.pow(0.001, dt));
    if (this.shake > 0) {
      this.shake -= dt * 2.5;
      this.shakeX = rand(-1, 1) * this.shake * 18;
      this.shakeY = rand(-1, 1) * this.shake * 18;
    } else {
      this.shakeX = 0; this.shakeY = 0; this.shake = 0;
    }
    if (this.slowmo > 0) this.slowmo -= dt;
  },
  apply(c) {
    c.save();
    c.translate(CONFIG.W / 2 + this.shakeX, CONFIG.H / 2 + this.shakeY);
    c.scale(this.zoom, this.zoom);
    c.translate(-CONFIG.W / 2, -CONFIG.H / 2);
  },
  restore(c) { c.restore(); },
  reset() { this.zoom = 1; this.targetZoom = 1; this.shake = 0; this.slowmo = 0; }
};

// ============================================================
// FIGHTER
// ============================================================
class Fighter {
  constructor(charData, x, facing, playerIndex) {
    this.char = charData;
    this.playerIndex = playerIndex;
    this.x = x; this.y = CONFIG.GROUND_Y; this.vx = 0; this.vy = 0;
    this.facing = facing; this.width = 55; this.height = 130;
    this.baseColor = charData.colors.body; this.skinColor = charData.colors.skin;
    this.hairColor = charData.colors.hair; this.accentColor = charData.colors.accent;
    this.auraColor = charData.colors.aura;

    this.maxHp = 1000; this.hp = 1000; this.energy = 0;
    this.state = 'idle'; this.stateTime = 0; this.animTime = 0;
    this.onGround = true; this.blocking = false; this.attackCooldown = 0;
    this.hitstun = 0; this.comboHits = 0; this.comboTimer = 0;
    this.superTimer = 0; this.invuln = 0; this.flashHit = 0;
    this.auraPhase = rand(0, Math.PI * 2);
    this.input = { left: false, right: false, jump: false, punch: false, kick: false, block: false, super: false };
    this.prevInput = { jump: false, punch: false, kick: false, super: false };
    this.isAI = false; this.aiTimer = 0; this.aiDifficulty = 'medium';
    this._superHit = false;
  }

  reset(x, facing) {
    this.x = x; this.y = CONFIG.GROUND_Y; this.vx = 0; this.vy = 0; this.facing = facing;
    this.hp = this.maxHp; this.energy = 0; this.state = 'idle'; this.stateTime = 0;
    this.onGround = true; this.blocking = false; this.attackCooldown = 0;
    this.hitstun = 0; this.comboHits = 0; this.comboTimer = 0;
    this.superTimer = 0; this.invuln = 0; this.flashHit = 0; this._superHit = false;
    this.input = { left: false, right: false, jump: false, punch: false, kick: false, block: false, super: false };
    this.prevInput = { jump: false, punch: false, kick: false, super: false };
  }

  get bodyY() { return this.y - this.height; }
  get centerX() { return this.x; }
  get centerY() { return this.y - this.height / 2; }

  getAttackBox() {
    if (this.state === 'punch') {
      return { x: this.x + this.facing * 18, y: this.y - 105, w: 75, h: 40, dmg: 55 * this.char.stats.power, knockback: 180 };
    }
    if (this.state === 'kick') {
      return { x: this.x + this.facing * 22, y: this.y - 80, w: 90, h: 45, dmg: 75 * this.char.stats.power, knockback: 280 };
    }
    return null;
  }

  getHurtBox() { return { x: this.x - this.width / 2, y: this.y - this.height, w: this.width, h: this.height }; }

  intersects(box) {
    const hb = this.getHurtBox();
    return !(box.x + box.w < hb.x || box.x > hb.x + hb.w || box.y + box.h < hb.y || box.y > hb.y + hb.h);
  }

  takeDamage(dmg, knockback, attacker, isCrit) {
    if (this.state === 'ko' || this.invuln > 0) return;
    let finalDmg = dmg;
    if (this.blocking && this.onGround) {
      finalDmg *= 0.18; this.hitstun = Math.max(this.hitstun, CONFIG.BLOCK_STUN);
      this.state = 'block'; this.stateTime = 0; this.vx = -this.facing * knockback * 0.15;
      particles.burst(this.x + this.facing * 20, this.y - 90, 8, '#88ccff', 200, 'spark', 3);
    } else {
      if (isCrit) finalDmg *= CONFIG.CRIT_MULT;
      this.hitstun = Math.max(this.hitstun, CONFIG.HIT_STUN + finalDmg / 400);
      this.state = 'hurt'; this.stateTime = 0;
      this.vx = -this.facing * knockback * 0.5; this.vy = -150; this.onGround = false; this.flashHit = 0.25;
      particles.burst(this.x + this.facing * 15, this.y - 90, isCrit ? 25 : 12, isCrit ? '#ffcc00' : '#ff4444', isCrit ? 500 : 300, 'spark', isCrit ? 5 : 3);
      if (isCrit) { camera.shake = Math.max(camera.shake, 0.6); particles.explosion(this.x, this.y - 90, 0.5); }
    }
    this.hp = Math.max(0, this.hp - finalDmg);
    attacker.energy = Math.min(CONFIG.MAX_ENERGY, attacker.energy + finalDmg * 0.06 + 4);

    if (this.hp <= 0) {
      this.state = 'ko'; this.stateTime = 0;
      this.vx = -this.facing * 350; this.vy = -400; this.onGround = false;
      particles.explosion(this.x, this.y - 80, 1.2); camera.shake = Math.max(camera.shake, 1.0);
    }
  }

  update(dt, opponent) {
    this.animTime += dt;
    this.auraPhase += dt * 3;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.flashHit > 0) this.flashHit -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.comboHits = 0; }

    if (this.isAI && this.state !== 'ko') this.updateAI(dt, opponent);

    if (this.state === 'super') { this.updateSuper(dt, opponent); return; }

    if (this.hitstun > 0) {
      this.hitstun -= dt; this.vx *= 0.9;
      if (this.hitstun <= 0) this.state = this.onGround ? 'idle' : 'jump';
    }

    if (this.state === 'ko') {
      this.vy += CONFIG.GRAVITY * dt; this.y += this.vy * dt; this.x += this.vx * dt; this.vx *= 0.98;
      if (this.y >= CONFIG.GROUND_Y) { this.y = CONFIG.GROUND_Y; this.vy = 0; this.vx *= 0.8; this.onGround = true; }
      return;
    }

    this.blocking = this.input.block && this.onGround && this.state !== 'hurt' && this.state !== 'ko';
    const canMove = (this.state === 'idle' || this.state === 'walk' || this.state === 'run' || this.state === 'jump') && this.hitstun <= 0 && this.state !== 'punch' && this.state !== 'kick' && this.state !== 'block';

    if (canMove) {
      let moveDir = 0;
      if (this.input.left) moveDir -= 1;
      if (this.input.right) moveDir += 1;
      const speed = (this.input.left && this.input.right ? CONFIG.RUN_SPEED : CONFIG.MOVE_SPEED) * this.char.stats.speed;
      if (moveDir !== 0) {
        this.vx = moveDir * speed; this.facing = moveDir > 0 ? 1 : -1;
        if (this.onGround) this.state = (this.input.left && this.input.right) ? 'run' : 'walk';
      } else {
        this.vx *= 0.75; if (this.onGround) this.state = 'idle';
      }
    } else this.vx *= 0.85;

    if (this.input.jump && !this.prevInput.jump && this.onGround && this.hitstun <= 0 && this.state !== 'punch' && this.state !== 'kick' && this.state !== 'ko') {
      this.vy = CONFIG.JUMP_VEL * this.char.stats.jump; this.onGround = false; this.state = 'jump';
      particles.burst(this.x, this.y, 6, '#aaaaaa', 150, 'smoke', 4);
    }

    if (this.input.punch && !this.prevInput.punch && this.attackCooldown <= 0 && this.hitstun <= 0 && this.state !== 'punch' && this.state !== 'kick' && this.state !== 'super' && this.state !== 'ko') {
      this.state = 'punch'; this.stateTime = 0; this.attackCooldown = 0.35;
    }
    if (this.input.kick && !this.prevInput.kick && this.attackCooldown <= 0 && this.hitstun <= 0 && this.state !== 'punch' && this.state !== 'kick' && this.state !== 'super' && this.state !== 'ko') {
      this.state = 'kick'; this.stateTime = 0; this.attackCooldown = 0.45;
    }
    if (this.input.super && !this.prevInput.super && this.energy >= CONFIG.SUPER_COST && this.hitstun <= 0 && this.state !== 'super' && this.state !== 'ko' && this.onGround) {
      this.triggerSuper();
    }

    if (!this.onGround) {
      this.vy += CONFIG.GRAVITY * dt; this.y += this.vy * dt;
      if (this.y >= CONFIG.GROUND_Y) {
        this.y = CONFIG.GROUND_Y; this.vy = 0; this.onGround = true;
        if (this.state === 'jump') this.state = 'idle';
        particles.burst(this.x, this.y, 5, '#aaaaaa', 120, 'smoke', 3);
      }
    }

    this.x += this.vx * dt; this.vx *= 0.92;
    this.x = clamp(this.x, 80, CONFIG.W - 80);

    if (this.state === 'punch' && this.stateTime > 0.25) this.state = this.onGround ? 'idle' : 'jump';
    if (this.state === 'kick' && this.stateTime > 0.35) this.state = this.onGround ? 'idle' : 'jump';
    if (this.state === 'hurt' && this.hitstun <= 0) this.state = this.onGround ? 'idle' : 'jump';

    this.stateTime += dt;
    this.prevInput = { ...this.input };

    if (this.state !== 'super' && this.hp > 0) {
      this.energy = Math.min(CONFIG.MAX_ENERGY, this.energy + 2.5 * dt);
    }
  }

  triggerSuper() {
    this.state = 'super'; this.stateTime = 0; this.superTimer = 0; this.energy = 0;
    this.invuln = CONFIG.SUPER_STUN; this.vx = 0; this._superHit = false;
    particles.burst(this.x, this.y - 60, 30, this.auraColor, 400, 'electric', 4);
    camera.targetZoom = 1.25; camera.shake = 0.4;
    announce('SUPER !', 0.8, this.auraColor);
  }

  updateSuper(dt, opponent) {
    this.superTimer += dt;
    camera.targetZoom = this.superTimer < 1.0 ? 1.3 : 1.0;

    if (Math.random() < 0.5) {
      particles.add(new Particle(this.x + rand(-30, 30), this.y - rand(20, 140), rand(-100, 100), rand(-250, -50), rand(0.2, 0.6), this.auraColor, rand(3, 8), 'electric'));
    }

    if (this.superTimer > 0.7 && !this._superHit) {
      this._superHit = true;
      const dmg = 280 * this.char.stats.power;
      const isCrit = Math.random() < 0.5;
      const superBox = { x: this.x + this.facing * 40 - 150, y: this.y - 200, w: 300, h: 220 };
      
      if (opponent.state !== 'ko' && opponent.intersects(superBox)) {
        opponent.takeDamage(dmg, 500, this, isCrit);
        opponent.hitstun = 1.2;
        this.comboHits += 3; this.comboTimer = CONFIG.COMBO_RESET_TIME;
        showCombo(this.comboHits, this.playerIndex);
      }
      
      const fx = this.x + this.facing * 100;
      const fy = this.y - 90;
      particles.explosion(fx, fy, 1.8);
      particles.burst(fx, fy, 50, this.auraColor, 900, 'spark', 6);
      camera.shake = 1.5; camera.slowmo = 0.5;
      screenFlash('#ffffff', 0.3);
    }

    if (this.superTimer > 1.5) {
      this.state = 'idle'; this.stateTime = 0; this._superHit = false;
      camera.targetZoom = 1.0; this.invuln = 0;
    }
  }

  updateAI(dt, opponent) {
    this.aiTimer -= dt;
    const diff = {
      easy: { react: 0.55, aggro: 0.35, blockChance: 0.25, superChance: 0.002, jumpChance: 0.008 },
      medium: { react: 0.32, aggro: 0.55, blockChance: 0.45, superChance: 0.006, jumpChance: 0.012 },
      hard: { react: 0.18, aggro: 0.72, blockChance: 0.65, superChance: 0.012, jumpChance: 0.018 },
      expert: { react: 0.10, aggro: 0.88, blockChance: 0.82, superChance: 0.022, jumpChance: 0.025 }
    }[this.aiDifficulty];

    if (this.aiTimer <= 0) {
      this.aiTimer = rand(0.1, 0.4) * diff.react * 3;
      this.input.left = false; this.input.right = false; this.input.jump = false;
      this.input.punch = false; this.input.kick = false; this.input.block = false; this.input.super = false;

      const dx = opponent.x - this.x; const adx = Math.abs(dx); const dir = Math.sign(dx);

      if (this.energy >= CONFIG.SUPER_COST && adx < 250 && Math.random() < diff.superChance * 30) {
        this.input.super = true;
      } else if ((opponent.state === 'punch' || opponent.state === 'kick' || opponent.state === 'super') && adx < 200 && Math.random() < diff.blockChance) {
        this.input.block = true;
      } else if (adx < 180 && Math.random() < diff.aggro) {
        if (Math.random() < 0.55) this.input.punch = true; else this.input.kick = true;
        if (dir > 0) this.input.right = true; else this.input.left = true;
      } else if (adx < 200 && Math.random() < diff.jumpChance * 10) {
        this.input.jump = true;
        if (dir > 0) this.input.right = true; else this.input.left = true;
      } else if (adx > 120) {
        if (dir > 0) this.input.right = true; else this.input.left = true;
      } else if (Math.random() < 0.2) {
        if (dir > 0) this.input.left = true; else this.input.right = true;
      }
    }
  }

  draw(c) {
    const t = this.animTime;
    const flash = this.flashHit > 0;
    
    // Aura
    if (this.energy > 50 || this.state === 'super') {
      c.save();
      const int = this.state === 'super' ? 1 : (this.energy / CONFIG.MAX_ENERGY) * 0.6;
      const size = this.state === 'super' ? 1.6 : 1.0;
      for (let i = 0; i < 3; i++) {
        const g = c.createRadialGradient(this.x, this.y - this.height / 2, 0, this.x, this.y - this.height / 2, (90 + Math.sin(t * 6 + i) * 20) * size);
        g.addColorStop(0, `rgba(${this.auraRGBA(0.25 * int)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(this.x, this.y - this.height / 2, (90 + Math.sin(t * 6 + i) * 20) * size, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }

    c.save();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(this.x, CONFIG.GROUND_Y + 4, 45, 10, 0, 0, Math.PI * 2); c.fill();

    let shakeX = 0; if (this.state === 'hurt') shakeX = rand(-4, 4);
    c.translate(this.x + shakeX, this.y);

    const bodyC = flash ? '#ffffff' : this.baseColor;
    const skinC = flash ? '#ffffff' : this.skinColor;

    if (flash) { c.shadowBlur = 30; c.shadowColor = '#ff4444'; }

    // Jambes
    let legOffset = 0;
    if (this.state === 'walk' || this.state === 'run') legOffset = Math.sin(t * 14) * (this.state === 'run' ? 20 : 12);
    if (this.state === 'kick') legOffset = this.facing * 40;

    c.fillStyle = bodyC;
    c.beginPath(); c.moveTo(-10, -45); c.lineTo(-18 + legOffset * 0.5, 0); c.lineTo(-18 + 14 + legOffset * 0.5, 0); c.lineTo(0, -45); c.fill();
    c.beginPath(); c.moveTo(10, -45); c.lineTo(18 + legOffset * 0.5, 0); c.lineTo(18 + 14 + legOffset * 0.5, 0); c.lineTo(0, -45); c.fill();

    // Torse
    c.beginPath(); c.moveTo(-22, -45); c.lineTo(-20, -110); c.lineTo(20, -110); c.lineTo(22, -45); c.closePath(); c.fill();
    c.fillStyle = this.accentColor; c.globalAlpha = 0.7;
    c.fillRect(-15, -100, 30, 8); c.fillRect(-10, -85, 20, 5); c.globalAlpha = 1;

    // Bras
    let armAngle = 0;
    if (this.state === 'block') armAngle = -0.6;
    c.fillStyle = skinC;
    c.save(); c.translate(-18, -100); c.rotate(armAngle * 0.5); c.fillRect(0, -5, 14, 40); c.restore();
    c.save(); c.translate(18, -100); c.rotate(armAngle);
    if (this.state === 'punch') {
      c.fillRect(0, -6, 14 + this.facing * 50, 12);
      c.beginPath(); c.arc(14 + this.facing * 50, 0, 11, 0, Math.PI * 2); c.fill();
    } else c.fillRect(0, -5, 14, 40);
    c.restore();

    // Tête
    c.fillStyle = skinC;
    c.beginPath(); c.arc(0, -125, 18, 0, Math.PI * 2); c.fill();
    c.fillStyle = this.hairColor;
    c.beginPath(); c.arc(0, -130, 18, Math.PI, Math.PI * 2); c.fill();
    if (this.char.id === 'ryu' || this.char.id === 'scorpion') c.fillRect(-18, -133, 36, 8);
    if (this.char.id === 'chunli') {
      c.beginPath(); c.arc(-16, -138, 9, 0, Math.PI * 2); c.arc(16, -138, 9, 0, Math.PI * 2); c.fill();
    }

    // Yeux
    c.fillStyle = flash ? '#ff0000' : '#ffffff';
    c.beginPath(); c.arc(6, -127, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(7 + this.facing * 1.5, -127, 2.5, 0, Math.PI * 2); c.fill();

    // Effets de coups
    if (this.state === 'punch' || this.state === 'kick') {
      const ax = this.x + this.facing * (this.state === 'punch' ? 50 : 70);
      const ay = this.y - (this.state === 'punch' ? 95 : 75);
      const g = c.createRadialGradient(ax - this.x, ay - this.y, 0, ax - this.x, ay - this.y, 45);
      g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(0.5, 'rgba(255,220,100,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(ax - this.x, ay - this.y, 45, 0, Math.PI * 2); c.fill();
    }

    c.restore();

    if (this.blocking) {
      c.save(); c.globalAlpha = 0.3 + Math.sin(t * 8) * 0.15;
      c.strokeStyle = '#00ccff'; c.lineWidth = 4; c.shadowBlur = 15; c.shadowColor = '#00ccff';
      c.beginPath(); c.arc(this.x, this.y - this.height / 2, 65, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
  }

  auraRGBA(alpha) {
    const hex = this.auraColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `${r},${g},${b},${alpha}`;
  }
}

// ============================================================
// DOM & UI
// ============================================================
const dom = {
  p1Health: document.getElementById('p1Health'), p2Health: document.getElementById('p2Health'),
  p1Energy: document.getElementById('p1Energy'), p2Energy: document.getElementById('p2Energy'),
  p1Name: document.getElementById('p1Name'), p2Name: document.getElementById('p2Name'),
  timer: document.getElementById('timer'), roundDisplay: document.getElementById('round-display'),
  comboDisplay: document.getElementById('comboDisplay'), announcement: document.getElementById('announcement'),
  mainMenu: document.getElementById('mainMenu'), charSelect: document.getElementById('charSelect'),
  arenaSelect: document.getElementById('arenaSelect'), difficultySelect: document.getElementById('difficultySelect'),
  creditsMenu: document.getElementById('creditsMenu'), endScreen: document.getElementById('endScreen'),
  charGrid: document.getElementById('charGrid'), arenaGrid: document.getElementById('arenaGrid'),
  p1Pick: document.getElementById('p1Pick'), p2Pick: document.getElementById('p2Pick'),
  endTitle: document.getElementById('endTitle'), endText: document.getElementById('endText'),
  mobileControls: document.getElementById('mobileControls'), controlsHint: document.getElementById('controlsHint')
};

let annTimeout = null;
function announce(text, duration, color) {
  dom.announcement.textContent = text;
  dom.announcement.style.color = color || '#fff';
  dom.announcement.classList.add('show');
  clearTimeout(annTimeout);
  annTimeout = setTimeout(() => dom.announcement.classList.remove('show'), (duration || 1) * 1000);
}

let comboTimer = null;
function showCombo(hits, pIdx) {
  if (hits < 2) return;
  dom.comboDisplay.textContent = `COMBO x${hits}`;
  dom.comboDisplay.style.color = pIdx === 0 ? '#00ccff' : '#ff44cc';
  dom.comboDisplay.classList.add('show');
  clearTimeout(comboTimer);
  comboTimer = setTimeout(() => dom.comboDisplay.classList.remove('show'), 1200);
}

function screenFlash(color, alpha) {
  game.flashColor = color; game.flashAlpha = alpha;
}

// ============================================================
// ÉTAT DU JEU
// ============================================================
const game = {
  state: 'menu', mode: 'solo', difficulty: 'medium',
  selectedChars: [0, 1], selectedArena: 4, // Prairie par défaut
  p1Pick: null, p2Pick: null, pickTurn: 'p1',
  fighters: [null, null], timer: CONFIG.ROUND_TIME, round: 1,
  running: false, lastTime: 0, fightStarted: false, koTriggered: false,
  winner: null, firstHit: true, perfect: true, finisherTriggered: false,
  matchOver: false, endTimer: 0, flashColor: null, flashAlpha: 0
};

let spectators = [];
let butterflies = [];

function setupArenaData() {
  spectators = [];
  butterflies = [];
  const arena = ARENAS[game.selectedArena];
  if (arena && arena.spectators) {
    const colors = ['#ff88cc', '#88ccff', '#ffdd44', '#88ff88', '#cc88ff', '#ffaa44'];
    for (let i = 0; i < 14; i++) {
      spectators.push(new Spectator(rand(80, CONFIG.W - 80), rand(520, 560), colors[i % colors.length]));
    }
  }
  if (arena && arena.meadow) {
    for (let i = 0; i < 8; i++) {
      butterflies.push({ x: rand(0, CONFIG.W), y: rand(200, 400), phase: rand(0, Math.PI*2), speed: rand(0.5, 1.5) });
    }
  }
}

// ============================================================
// MENUS
// ============================================================
function showMenu(name) {
  ['mainMenu', 'charSelect', 'arenaSelect', 'difficultySelect', 'creditsMenu', 'endScreen'].forEach(id => dom[id].classList.add('hidden'));
  if (name) dom[name].classList.remove('hidden');
}

function buildCharSelect() {
  dom.charGrid.innerHTML = '';
  CHARACTERS.forEach((ch, i) => {
    const card = document.createElement('div');
    card.className = 'char-card'; card.dataset.index = i;
    card.innerHTML = `<div class="char-portrait" style="background: radial-gradient(circle at 40% 35%, ${ch.colors.skin}, ${ch.colors.body}); color: ${ch.colors.accent};">${ch.name[0]}</div><div class="char-name">${ch.name}</div><div class="char-role">${ch.role}</div>`;
    card.addEventListener('click', () => pickCharacter(i));
    dom.charGrid.appendChild(card);
  });
  updateCharSelectionUI();
}

function pickCharacter(index) {
  if (game.mode === '2p') {
    if (game.pickTurn === 'p1') { game.p1Pick = index; game.pickTurn = 'p2'; }
    else { game.p2Pick = index; game.pickTurn = 'p1'; }
  } else {
    game.p1Pick = index;
    let aiPick; do { aiPick = randInt(0, CHARACTERS.length - 1); } while (aiPick === index);
    game.p2Pick = aiPick;
  }
  updateCharSelectionUI();
}

function updateCharSelectionUI() {
  const cards = dom.charGrid.querySelectorAll('.char-card');
  cards.forEach((c, i) => {
    c.classList.remove('p1-picked', 'p2-picked', 'both-picked');
    if (game.p1Pick === i && game.p2Pick === i) c.classList.add('both-picked');
    else if (game.p1Pick === i) c.classList.add('p1-picked');
    else if (game.p2Pick === i) c.classList.add('p2-picked');
  });
  dom.p1Pick.textContent = 'J1: ' + (game.p1Pick !== null ? CHARACTERS[game.p1Pick].name : '—');
  dom.p2Pick.textContent = (game.mode === '2p' ? 'J2: ' : 'IA: ') + (game.p2Pick !== null ? CHARACTERS[game.p2Pick].name : '—');
  const btn = document.getElementById('btnConfirmChar');
  btn.disabled = game.p1Pick === null || (game.mode === '2p' && game.p2Pick === null);
  btn.style.opacity = btn.disabled ? 0.4 : 1;
}

function buildArenaSelect() {
  dom.arenaGrid.innerHTML = '';
  ARENAS.forEach((ar, i) => {
    const card = document.createElement('div');
    card.className = 'arena-card'; card.dataset.index = i;
    const preview = document.createElement('div');
    preview.className = 'arena-preview';
    preview.style.background = `linear-gradient(180deg, ${ar.sky[0]}, ${ar.sky[1]})`;
    card.appendChild(preview);
    const label = document.createElement('div');
    label.className = 'arena-label'; label.textContent = ar.name;
    card.appendChild(label);
    card.addEventListener('click', () => {
      game.selectedArena = i;
      dom.arenaGrid.querySelectorAll('.arena-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
    dom.arenaGrid.appendChild(card);
  });
  dom.arenaGrid.querySelector('.arena-card')?.classList.add('selected');
}

function startFight() {
  setupArenaData();
  const p1Char = CHARACTERS[game.p1Pick ?? 0];
  const p2Char = CHARACTERS[game.p2Pick ?? 1];
  game.fighters[0] = new Fighter(p1Char, 350, 1, 0);
  game.fighters[1] = new Fighter(p2Char, CONFIG.W - 350, -1, 1);
  if (game.mode === 'solo') { game.fighters[1].isAI = true; game.fighters[1].aiDifficulty = game.difficulty; }

  game.state = 'fight'; game.timer = CONFIG.ROUND_TIME; game.round = 1;
  game.fightStarted = false; game.koTriggered = false; game.winner = null;
  game.firstHit = true; game.perfect = true; game.finisherTriggered = false; game.matchOver = false;

  particles.clear(); camera.reset();
  dom.p1Name.textContent = p1Char.name; dom.p2Name.textContent = p2Char.name;
  updateHUD(); showMenu(null);
  announce('ROUND 1', 1.2, '#ffcc00');
  dom.mobileControls.classList.remove('hidden');
}

// ============================================================
// INPUTS
// ============================================================
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => keys[e.code] = false);

const touchState = { left: false, right: false, jump: false, punch: false, kick: false, block: false, super: false };
function setupTouchControls() {
  const b = [['mLeft','left'],['mRight','right'],['mJump','jump'],['mPunch','punch'],['mKick','kick'],['mBlock','block'],['mSuper','super']];
  b.forEach(([id, prop]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const s = e => { e.preventDefault(); touchState[prop] = true; el.classList.add('active'); };
    const end = e => { e.preventDefault(); touchState[prop] = false; el.classList.remove('active'); };
    el.addEventListener('touchstart', s, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', s); el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  });
}

function readInputs() {
  if (game.state !== 'fight') return;
  const [p1, p2] = game.fighters;
  if (!p1 || !p2) return;
  p1.input.left = keys['KeyQ'] || touchState.left;
  p1.input.right = keys['KeyD'] || touchState.right;
  p1.input.jump = keys['KeyZ'] || touchState.jump;
  p1.input.punch = keys['KeyE'] || touchState.punch;
  p1.input.kick = keys['KeyR'] || touchState.kick;
  p1.input.block = keys['KeyF'] || touchState.block;
  p1.input.super = keys['KeyA'] || touchState.super;

  if (game.mode === '2p') {
    p2.input.left = keys['ArrowLeft'];
    p2.input.right = keys['ArrowRight'];
    p2.input.jump = keys['ArrowUp'];
    p2.input.punch = keys['Numpad1'];
    p2.input.kick = keys['Numpad2'];
    p2.input.block = keys['Numpad3'];
    p2.input.super = keys['Numpad0'] || keys['NumpadDecimal'];
  }
}

// ============================================================
// COMBAT
// ============================================================
function checkHits() {
  const [p1, p2] = game.fighters;
  if (!p1 || !p2 || p1.state === 'ko' || p2.state === 'ko') return;

  if (p1.attackCooldown > 0.28) {
    const box = p1.getAttackBox();
    if (box && p2.intersects(box) && p2.invuln <= 0) {
      const isCrit = Math.random() < CONFIG.CRIT_CHANCE;
      p2.takeDamage(box.dmg, box.knockback, p1, isCrit);
      p1.comboHits++; p1.comboTimer = CONFIG.COMBO_RESET_TIME; p2.comboHits = 0;
      if (game.firstHit) { announce('FIRST HIT !', 0.8, '#ffcc00'); game.firstHit = false; }
      if (isCrit) { announce('CRITICAL HIT !', 0.6, '#ff4444'); camera.shake = Math.max(camera.shake, 0.7); camera.slowmo = 0.3; }
      if (p1.comboHits >= 2) { showCombo(p1.comboHits, 0); if (p1.comboHits === 3) announce('COMBO x3 !', 0.7, '#ff8800'); }
      p1.vx = -p1.facing * 80;
    }
  }

  if (p2.attackCooldown > 0.28) {
    const box = p2.getAttackBox();
    if (box && p1.intersects(box) && p1.invuln <= 0) {
      const isCrit = Math.random() < CONFIG.CRIT_CHANCE;
      p1.takeDamage(box.dmg, box.knockback, p2, isCrit);
      p2.comboHits++; p2.comboTimer = CONFIG.COMBO_RESET_TIME; p1.comboHits = 0;
      if (game.firstHit) { announce('FIRST HIT !', 0.8, '#ffcc00'); game.firstHit = false; }
      if (isCrit) { announce('CRITICAL HIT !', 0.6, '#ff4444'); camera.shake = Math.max(camera.shake, 0.7); camera.slowmo = 0.3; }
      if (p2.comboHits >= 2) showCombo(p2.comboHits, 1);
      p2.vx = -p2.facing * 80;
    }
  }
}

function triggerKO() {
  game.koTriggered = true; game.state = 'roundEnd'; game.endTimer = 0; game.finisherTriggered = true;
  const w = game.winner;
  if (w) {
    const l = w === game.fighters[0] ? game.fighters[1] : game.fighters[0];
    l.state = 'ko';
    game.perfect = w.hp === w.maxHp;
    announce('K.O.', 2.0, '#ff0000');
    camera.targetZoom = 1.5; camera.shake = 1.2;
    screenFlash('#ffffff', 0.8);
    particles.explosion(l.x, l.y - 80, 2.0);
    if (game.perfect) setTimeout(() => announce('PERFECT !', 1.5, '#ffcc00'), 1000);
  } else announce('DRAW', 2.0, '#888888');
}

// ============================================================
// BOUCLE DE JEU
// ============================================================
function updateHUD() {
  const [p1, p2] = game.fighters;
  if (!p1 || !p2) return;
  dom.p1Health.style.width = (p1.hp / p1.maxHp * 100) + '%';
  dom.p2Health.style.width = (p2.hp / p2.maxHp * 100) + '%';
  dom.p1Energy.style.width = (p1.energy / CONFIG.MAX_ENERGY * 100) + '%';
  dom.p2Energy.style.width = (p2.energy / CONFIG.MAX_ENERGY * 100) + '%';
  dom.timer.textContent = Math.ceil(game.timer);
  dom.timer.style.color = game.timer <= 10 ? '#ff4444' : '#fff';
}

function update(dt) {
  if (game.state === 'fight') {
    if (game.fightStarted && !game.koTriggered && !game.matchOver) {
      game.timer -= dt;
      if (game.timer <= 0) {
        game.timer = 0;
        const [p1, p2] = game.fighters;
        game.winner = p1.hp > p2.hp ? p1 : (p2.hp > p1.hp ? p2 : null);
        triggerKO();
      }
    }
    if (!game.fightStarted) game.fightStarted = true;

    readInputs();
    const [p1, p2] = game.fighters;
    if (p1) p1.update(dt, p2);
    if (p2) p2.update(dt, p1);
    checkHits();
    
    if (!game.koTriggered) {
      if (p1.hp <= 0 || p2.hp <= 0) { game.winner = p1.hp <= 0 ? p2 : p1; triggerKO(); }
    }
    updateHUD();
  }

  if (game.state === 'roundEnd') {
    game.endTimer += dt;
    if (game.endTimer > 2.5 && !game.matchOver) {
      game.matchOver = true;
      const w = game.winner;
      dom.endTitle.textContent = w ? 'VICTOIRE' : 'ÉGALITÉ';
      dom.endTitle.style.color = w ? (w.playerIndex === 0 ? '#00ccff' : '#ff44cc') : '#888888';
      dom.endText.textContent = w ? (w.char.name + ' remporte le combat !' + (game.perfect ? ' — PERFECT !' : '')) : 'Aucun vainqueur.';
      showMenu('endScreen');
      dom.mobileControls.classList.add('hidden');
    }
  }

  // Mise à jour des spectateurs
  if (game.state === 'fight' || game.state === 'roundEnd') {
    const arena = ARENAS[game.selectedArena];
    for (const s of spectators) s.update(dt, game.fighters, arena);
    for (const b of butterflies) {
      b.x += Math.cos(performance.now()/1000 + b.phase) * b.speed * 50 * dt;
      b.y += Math.sin(performance.now()/1000 + b.phase) * b.speed * 30 * dt;
      b.x = (b.x + CONFIG.W) % CONFIG.W;
    }
  }

  particles.update(dt);
  camera.update(dt);
  if (game.flashAlpha > 0) { game.flashAlpha -= dt * 2; if (game.flashAlpha < 0) game.flashAlpha = 0; }
}

// ============================================================
// RENDU
// ============================================================
function renderBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.H);
  g.addColorStop(0, '#000011'); g.addColorStop(1, '#000022');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
}

function renderMenuBackground() {
  const t = performance.now() / 1000;
  ctx.save();
  for (let i = 0; i < 80; i++) {
    const x = (i * 137.5 + t * 20) % CONFIG.W;
    const y = (i * 73.3 + Math.sin(t + i) * 30) % CONFIG.H;
    ctx.globalAlpha = 0.3 + Math.sin(t * 2 + i) * 0.3;
    ctx.fillStyle = i % 3 === 0 ? '#ffcc00' : (i % 3 === 1 ? '#ff4400' : '#00ccff');
    ctx.beginPath(); ctx.arc(x, y, 1.5 + Math.sin(t * 3 + i) * 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function renderArena() {
  const arena = ARENAS[game.selectedArena];
  const t = performance.now() / 1000;

  // Ciel
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.GROUND_Y);
  g.addColorStop(0, arena.sky[0]); g.addColorStop(1, arena.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, CONFIG.W, CONFIG.GROUND_Y);

  // Arc-en-ciel pour la prairie
  if (arena.rainbow) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#4400ff', '#ff00ff'];
    colors.forEach((col, i) => {
      ctx.strokeStyle = col; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(CONFIG.W / 2, CONFIG.GROUND_Y, 400 - i * 12, Math.PI, Math.PI * 2); ctx.stroke();
    });
    ctx.restore();
  }

  // Étoiles
  if (arena.stars > 0) {
    ctx.save();
    for (let i = 0; i < arena.stars; i++) {
      const x = (i * 137.5 + t * 5) % CONFIG.W;
      const y = (i * 73.3) % (CONFIG.GROUND_Y * 0.6);
      ctx.globalAlpha = 0.3 + Math.sin(t * 2 + i) * 0.4;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 1 + Math.sin(t + i) * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Bâtiments
  if (arena.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 12; i++) {
      const bw = 60 + (i * 37) % 70; const bh = 120 + (i * 53) % 200;
      const bx = i * (CONFIG.W / 11) - 30; const by = CONFIG.GROUND_Y - bh;
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  // Sol
  const gg = ctx.createLinearGradient(0, CONFIG.GROUND_Y, 0, CONFIG.H);
  gg.addColorStop(0, arena.ground); gg.addColorStop(1, '#000000');
  ctx.fillStyle = gg; ctx.fillRect(0, CONFIG.GROUND_Y, CONFIG.W, CONFIG.H - CONFIG.GROUND_Y);

  // Herbe pour la prairie
  if (arena.meadow) {
    ctx.strokeStyle = '#3a9a1a'; ctx.lineWidth = 3;
    for (let x = 0; x < CONFIG.W; x += 15) {
      const h = 10 + Math.sin(x * 0.05 + t * 2) * 8;
      ctx.beginPath(); ctx.moveTo(x, CONFIG.GROUND_Y + 10); ctx.lineTo(x + Math.sin(t + x) * 5, CONFIG.GROUND_Y + 10 - h); ctx.stroke();
    }
  }

  // Ligne de sol
  ctx.strokeStyle = arena.accent; ctx.globalAlpha = 0.4; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, CONFIG.GROUND_Y); ctx.lineTo(CONFIG.W, CONFIG.GROUND_Y); ctx.stroke();
  ctx.globalAlpha = 1;

  // Spectateurs
  for (const s of spectators) s.draw(ctx);

  // Papillons
  ctx.save();
  for (const b of butterflies) {
    ctx.save(); ctx.translate(b.x, b.y);
    const flap = Math.sin(performance.now() / 100 + b.phase);
    ctx.fillStyle = 'rgba(255,200,100,0.8)';
    ctx.beginPath(); ctx.ellipse(-6, 0, 6 * Math.abs(flap), 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, 0, 6 * Math.abs(flap), 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function render() {
  renderBackground();

  if (game.state === 'menu' || game.state === 'charSelect' || game.state === 'arenaSelect' || game.state === 'difficultySelect' || game.state === 'creditsMenu') {
    renderMenuBackground();
    return;
  }

  camera.apply(ctx);
  renderArena();
  
  if (game.fighters[0] && game.fighters[1]) {
    const [p1, p2] = game.fighters;
    if (p1.x <= p2.x) { p1.draw(ctx); p2.draw(ctx); }
    else { p2.draw(ctx); p1.draw(ctx); }
  }

  particles.draw(ctx);
  camera.restore(ctx);

  if (game.flashAlpha > 0 && game.flashColor) {
    ctx.save(); ctx.globalAlpha = game.flashAlpha; ctx.fillStyle = game.flashColor;
    ctx.fillRect(0, 0, CONFIG.W, CONFIG.H); ctx.restore();
  }

  // Vignette
  const vg = ctx.createRadialGradient(CONFIG.W / 2, CONFIG.H / 2, CONFIG.H * 0.35, CONFIG.W / 2, CONFIG.H / 2, CONFIG.H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
}

function gameLoop(ts) {
  requestAnimationFrame(gameLoop);
  if (!game.lastTime) game.lastTime = ts;
  let dt = (ts - game.lastTime) / 1000;
  game.lastTime = ts;
  dt = Math.min(dt, 0.05);
  if (camera.slowmo > 0) dt *= 0.25;
  update(dt);
  render();
}

// ============================================================
// ÉVÉNEMENTS MENUS
// ============================================================
function setupMenus() {
  document.getElementById('btnSolo').addEventListener('click', () => { game.mode = 'solo'; game.p1Pick = null; game.p2Pick = null; game.pickTurn = 'p1'; showMenu('difficultySelect'); });
  document.getElementById('btn2P').addEventListener('click', () => { game.mode = '2p'; game.p1Pick = null; game.p2Pick = null; game.pickTurn = 'p1'; showMenu('charSelect'); });
  document.getElementById('btnCredits').addEventListener('click', () => showMenu('creditsMenu'));
  
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => { game.difficulty = btn.dataset.diff; buildCharSelect(); showMenu('charSelect'); });
  });

  document.getElementById('btnBackFromChar').addEventListener('click', () => showMenu(game.mode === 'solo' ? 'difficultySelect' : 'mainMenu'));
  document.getElementById('btnBackFromArena').addEventListener('click', () => showMenu('charSelect'));
  document.getElementById('btnBackFromDiff').addEventListener('click', () => showMenu('mainMenu'));
  document.getElementById('btnBackFromCredits').addEventListener('click', () => showMenu('mainMenu'));

  document.getElementById('btnConfirmChar').addEventListener('click', () => {
    if (game.p1Pick === null || (game.mode === '2p' && game.p2Pick === null)) return;
    buildArenaSelect(); showMenu('arenaSelect');
  });

  document.getElementById('btnStartFight').addEventListener('click', startFight);

  document.getElementById('btnRematch').addEventListener('click', () => { game.state = 'charSelect'; game.p1Pick = null; game.p2Pick = null; game.pickTurn = 'p1'; buildCharSelect(); showMenu('charSelect'); });
  document.getElementById('btnMainMenu').addEventListener('click', () => { game.state = 'menu'; showMenu('mainMenu'); dom.mobileControls.classList.add('hidden'); });
}

// ============================================================
// LANCEMENT
// ============================================================
function init() {
  resizeCanvas();
  buildCharSelect();
  buildArenaSelect();
  setupMenus();
  setupTouchControls();
  // L'arène par défaut (Prairie Fleurie)
  game.selectedArena = 4;
  showMenu('mainMenu');
  requestAnimationFrame(gameLoop);
}

window.addEventListener('load', init);
window.addEventListener('contextmenu', e => e.preventDefault());

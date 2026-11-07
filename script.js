// ============================================================
// LorenMine — Survie avancée
// Blocs, armes, monstres FSM, torches, particules
// ============================================================
'use strict';

// ============================================================
// CONSTANTES
// ============================================================
const BLOCK_SIZE = 1;
const CHUNK_SIZE = 16;
const WORLD_RADIUS = 200;
const TERRAIN_SEED = 1337;
const SAVE_KEY = 'lorenmine_save_v5';
const BASE_WALK_SPEED = 5;
const BASE_FLY_SPEED = 14;
const BASE_JUMP = 8;
const GRAVITY = 25;

// ============================================================
// REGISTRE DES BLOCS (data-driven, textures procédurales)
// ============================================================
const BLOCK_REGISTRY = {
    // Nature
    dirt:        { icon: '🌍', name: 'Terre',        colors: [0x8B5A2B, 0x8B5A2B, 0x9B6A3B, 0x7B4A1B, 0x8B5A2B, 0x8B5A2B], hardness: 1 },
    grass:       { icon: '🌿', name: 'Herbe',        colors: [0x6AB04C, 0x6AB04C, 0x7BC950, 0x8B5A2B, 0x6AB04C, 0x6AB04C], hardness: 1 },
    stone:       { icon: '🪨', name: 'Pierre',       colors: [0x808080, 0x808080, 0x909090, 0x707070, 0x808080, 0x808080], hardness: 2 },
    rock:        { icon: '⛰️', name: 'Roche',        colors: [0x6E6E6E, 0x6E6E6E, 0x7E7E7E, 0x5E5E5E, 0x6E6E6E, 0x6E6E6E], hardness: 3 },
    sand:        { icon: '🏖️', name: 'Sable',        colors: [0xE8D8A0, 0xE8D8A0, 0xF0E0B0, 0xD8C890, 0xE8D8A0, 0xE8D8A0], hardness: 1 },
    gravel:      { icon: '⚪', name: 'Gravier',      colors: [0xA0A0A0, 0xA0A0A0, 0xB0B0B0, 0x909090, 0xA0A0A0, 0xA0A0A0], hardness: 1 },
    clay:        { icon: '🧱', name: 'Argile',       colors: [0xA0908A, 0xA0908A, 0xB0A09A, 0x90807A, 0xA0908A, 0xA0908A], hardness: 1 },
    mud:         { icon: '🟤', name: 'Boue',         colors: [0x5A4A2A, 0x5A4A2A, 0x6A5A3A, 0x4A3A1A, 0x5A4A2A, 0x5A4A2A], hardness: 1 },
    snow:        { icon: '❄️', name: 'Neige',        colors: [0xF0F8FF, 0xF0F8FF, 0xFFFFFF, 0xE0E8EF, 0xF0F8FF, 0xF0F8FF], hardness: 1 },
    ice:         { icon: '🧊', name: 'Glace',        colors: [0xA0D8F0, 0xA0D8F0, 0xB0E8FF, 0x90C8E0, 0xA0D8F0, 0xA0D8F0], hardness: 1, transparent: true },

    // Bois
    oak_wood:    { icon: '🪵', name: 'Chêne',        colors: [0x8B6B3B, 0x8B6B3B, 0x9B7B4B, 0x7B5B2B, 0x8B6B3B, 0x8B6B3B], hardness: 2 },
    pine_wood:   { icon: '🌲', name: 'Sapin',        colors: [0x5A3A1A, 0x5A3A1A, 0x6A4A2A, 0x4A2A0A, 0x5A3A1A, 0x5A3A1A], hardness: 2 },
    birch_wood:  { icon: '🌳', name: 'Bouleau',      colors: [0xD8C8A0, 0xD8C8A0, 0xE8D8B0, 0xC8B890, 0xD8C8A0, 0xD8C8A0], hardness: 2 },
    mahogany_wood:{ icon: '🌴', name: 'Acajou',      colors: [0x7B3B2B, 0x7B3B2B, 0x8B4B3B, 0x6B2B1B, 0x7B3B2B, 0x7B3B2B], hardness: 2 },

    // Minerais
    coal_ore:    { icon: '⬛', name: 'Charbon',      colors: [0x3A3A3A, 0x3A3A3A, 0x4A4A4A, 0x2A2A2A, 0x3A3A3A, 0x3A3A3A], hardness: 3 },
    copper_ore:  { icon: '🟠', name: 'Cuivre',       colors: [0xB87333, 0xB87333, 0xC88343, 0xA86323, 0xB87333, 0xB87333], hardness: 3 },
    iron_ore:    { icon: '⚙️', name: 'Fer',          colors: [0xB0A090, 0xB0A090, 0xC0B0A0, 0xA09080, 0xB0A090, 0xB0A090], hardness: 3 },
    silver_ore:  { icon: '🥈', name: 'Argent',       colors: [0xC0C0C8, 0xC0C0C8, 0xD0D0D8, 0xB0B0B8, 0xC0C0C8, 0xC0C0C8], hardness: 4 },
    gold_ore:    { icon: '🥇', name: 'Or',           colors: [0xFFD700, 0xFFD700, 0xFFE720, 0xEFC700, 0xFFD700, 0xFFD700], hardness: 4 },
    ruby_ore:    { icon: '🔴', name: 'Rubis',        colors: [0xD0102A, 0xD0102A, 0xE0203A, 0xC0001A, 0xD0102A, 0xD0102A], hardness: 5 },
    sapphire_ore:{ icon: '🔵', name: 'Saphir',       colors: [0x1020D0, 0x1020D0, 0x2030E0, 0x0010C0, 0x1020D0, 0x1020D0], hardness: 5 },
    emerald_ore: { icon: '💚', name: 'Émeraude',     colors: [0x10D05A, 0x10D05A, 0x20E06A, 0x00C04A, 0x10D05A, 0x10D05A], hardness: 5 },
    diamond_ore: { icon: '💎', name: 'Diamant',      colors: [0xA0F0FF, 0xA0F0FF, 0xB0FFFF, 0x90E0FF, 0xA0F0FF, 0xA0F0FF], hardness: 6 },
    obsidian:    { icon: '🟣', name: 'Obsidienne',   colors: [0x1A0A2A, 0x1A0A2A, 0x2A1A3A, 0x0A001A, 0x1A0A2A, 0x1A0A2A], hardness: 8 },

    // Construction
    bricks:      { icon: '🧱', name: 'Briques',      colors: [0xA04020, 0xA04020, 0xB05030, 0x903010, 0xA04020, 0xA04020], hardness: 2 },
    glass:       { icon: '🔷', name: 'Verre',        colors: [0xB0E0FF, 0xB0E0FF, 0xC0F0FF, 0xA0D0EF, 0xB0E0FF, 0xB0E0FF], hardness: 1, transparent: true },
    cut_stone:   { icon: '🔲', name: 'Pierre taillée',colors: [0x9A9A9A, 0x9A9A9A, 0xAAAAAA, 0x8A8A8A, 0x9A9A9A, 0x9A9A9A], hardness: 2 },
    planks:      { icon: '🟫', name: 'Planches',     colors: [0xC0A060, 0xC0A060, 0xD0B070, 0xB09050, 0xC0A060, 0xC0A060], hardness: 2 },
    cobble:      { icon: '🧩', name: 'Pavés',        colors: [0x707070, 0x707070, 0x808080, 0x606060, 0x707070, 0x707070], hardness: 2 },
    concrete:    { icon: '⬜', name: 'Béton',         colors: [0xB0B0B0, 0xB0B0B0, 0xC0C0C0, 0xA0A0A0, 0xB0B0B0, 0xB0B0B0], hardness: 2 },

    // Décoration
    leaves:      { icon: '🍃', name: 'Feuilles',     colors: [0x2D5A2D, 0x2D5A2D, 0x3D6A3D, 0x1D4A1D, 0x2D5A2D, 0x2D5A2D], hardness: 1, transparent: true },
    torch:       { icon: '🔥', name: 'Torche',       colors: [0xFFA500, 0xFFA500, 0xFFFF00, 0x8B6B3B, 0xFFA500, 0xFFA500], hardness: 1, emissive: true },
};

const BLOCK_KEYS = Object.keys(BLOCK_REGISTRY);

// ============================================================
// REGISTRE DES ARMES
// ============================================================
const WEAPON_REGISTRY = {
    wood_sword:  { icon: '🗡️', name: 'Épée en bois',    damage: 3, range: 2.5, cooldown: 0.5, durability: 60,  type: 'melee' },
    stone_sword: { icon: '⚔️', name: 'Épée en pierre',  damage: 5, range: 2.7, cooldown: 0.55, durability: 130, type: 'melee' },
    iron_sword:  { icon: '⚔️', name: 'Épée en fer',     damage: 7, range: 3.0, cooldown: 0.6, durability: 250, type: 'melee' },
    gold_sword:  { icon: '✨', name: 'Épée en or',      damage: 6, range: 3.0, cooldown: 0.4, durability: 90,  type: 'melee' },
    diamond_sword:{ icon: '💎', name: 'Épée en diamant',damage: 9, range: 3.2, cooldown: 0.5, durability: 800, type: 'melee' },
    bow:         { icon: '🏹', name: 'Arc',             damage: 5, range: 25, cooldown: 0.9, durability: 200, type: 'ranged' },
    crossbow:    { icon: '🎯', name: 'Arbalète',        damage: 8, range: 30, cooldown: 1.5, durability: 300, type: 'ranged' },
};

// ============================================================
// ÉTAT GLOBAL
// ============================================================
const state = {
    selectedBlock: 'dirt',
    selectedWeapon: 'wood_sword',
    equippedWeapon: { key: 'wood_sword', durability: 60 },
    isFlying: true,
    isInventoryOpen: false,
    isSettingsOpen: false,
    isPointerLocked: false,
    survivalEnabled: true,
    walkSpeed: 5,
    flySpeed: 14,
    renderDistance: 128,
    maxAnimals: 16,
    maxMonsters: 8,
    quality: 'medium',
    shadows: true,
    cycleAuto: true,
    showFPS: true,
    dayTime: 0.25,
    chunks: new Map(),
    loadedChunks: new Set(),
    exploredChunks: new Set(),
    health: 20,
    maxHealth: 20,
    kills: 0,
    coins: 0,
    isDead: false,
    damageCooldown: 0,
    attackCooldown: 0,
    animalCount: 0,
    monsterCount: 0,
    savedModifications: {},
};

// ============================================================
// THREE.JS
// ============================================================
let scene, camera, renderer, clock;
let sunLight, ambientLight, hemiLight;
let shadowMapSize = 1024;

const raycaster = new THREE.Raycaster();
raycaster.far = 8;
const screenCenter = new THREE.Vector2(0, 0);

const player = {
    position: new THREE.Vector3(0.5, 40, 0.5),
    velocity: new THREE.Vector3(),
    targetVel: new THREE.Vector3(),
    onGround: false,
    height: 1.7,
    radius: 0.4,
};

const keys = Object.create(null);
let sharedGeometry;
const materialCache = {};

// Lumières torches (max 3 actives)
const torchLights = [];
const MAX_TORCH_LIGHTS = 3;

// Particules 3D
const particlePool = [];
const MAX_PARTICLES = 80;

// ============================================================
// AUDIO
// ============================================================
let audioCtx = null;
function playSound(freq, duration = 0.08, type = 'sine', vol = 0.03) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = vol;
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

// ============================================================
// UTILITAIRES
// ============================================================
function chunkKey(cx, cz) { return cx + ',' + cz; }
function blockKey(x, y, z) { return x + ',' + y + ',' + z; }
function worldToChunk(x, z) {
    return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
}

// ============================================================
// INIT
// ============================================================
function init() {
    document.addEventListener('click', () => {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
    }, { once: true });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 40, state.renderDistance);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.copy(player.position);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    sharedGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    setupLighting();
    setupUI();
    setupEventListeners();

    if (!loadSave()) {
        player.position.set(0.5, 30, 0.5);
        camera.position.copy(player.position);
    }

    updateModeUI();
    updateSpeedUI();
    updateCycleUI();
    updateShadowsUI();
    updateHealthUI();
    updateTimeUI();
    updateWeaponUI();

    animate();
}

// ============================================================
// ÉCLAIRAGE
// ============================================================
function setupLighting() {
    ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.5);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = shadowMapSize;
    sunLight.shadow.mapSize.height = shadowMapSize;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);
    scene.add(sunLight.target);
}

// ============================================================
// MATÉRIAUX (couleurs uniques par bloc)
// ============================================================
function getMaterial(type) {
    if (materialCache[type]) return materialCache[type];
    const def = BLOCK_REGISTRY[type];
    if (!def) return getMaterial('stone');

    let mat;
    if (def.transparent) {
        mat = new THREE.MeshPhongMaterial({
            color: def.colors[0], transparent: true, opacity: 0.7,
            shininess: 100, specular: 0x99ccff, depthWrite: false
        });
    } else if (def.emissive) {
        mat = new THREE.MeshLambertMaterial({
            color: def.colors[0], emissive: 0x553300, emissiveIntensity: 0.8
        });
    } else if (def.colors.length > 1) {
        const mats = def.colors.map(c => new THREE.MeshLambertMaterial({ color: c }));
        mat = mats;
    } else {
        mat = new THREE.MeshLambertMaterial({ color: def.colors[0] });
    }
    materialCache[type] = mat;
    return mat;
}

// ============================================================
// BRUIT
// ============================================================
function hash2(x, z, seed) {
    let h = (x | 0) * 374761393 + (z | 0) * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, z, seed) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const tl = hash2(xi, zi, seed), tr = hash2(xi + 1, zi, seed);
    const bl = hash2(xi, zi + 1, seed), br = hash2(xi + 1, zi + 1, seed);
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    return (tl * (1 - u) + tr * u) * (1 - v) + (bl * (1 - u) + br * u) * v;
}

function fbm(x, z, seed, octaves = 4) {
    let value = 0, amp = 1, freq = 1, total = 0;
    for (let i = 0; i < octaves; i++) {
        value += valueNoise(x * freq, z * freq, seed + i * 31) * amp;
        total += amp; amp *= 0.5; freq *= 2;
    }
    return value / total;
}

function getBiome(x, z) {
    const b = fbm(x * 0.008, z * 0.008, TERRAIN_SEED + 5000, 3);
    if (b < 0.35) return 'plains';
    if (b < 0.55) return 'forest';
    if (b < 0.75) return 'hills';
    return 'mountains';
}

function getTerrainHeight(x, z) {
    const biome = getBiome(x, z);
    const base = fbm(x * 0.02, z * 0.02, TERRAIN_SEED, 4);
    const detail = fbm(x * 0.08, z * 0.08, TERRAIN_SEED + 200, 3);
    const hillsF = fbm(x * 0.01, z * 0.01, TERRAIN_SEED + 900, 2);
    let h;
    switch (biome) {
        case 'plains':    h = 4 + base * 4 + detail * 1.5; break;
        case 'forest':    h = 5 + base * 6 + detail * 2; break;
        case 'hills':     h = 6 + base * 12 + hillsF * 8 + detail * 2; break;
        case 'mountains': h = 10 + base * 22 + hillsF * 15 + detail * 3; break;
        default:          h = 5 + base * 6;
    }
    return Math.max(1, Math.floor(h));
}

function isWaterAt(x, z, h) {
    const r = fbm(x * 0.015, z * 0.015, TERRAIN_SEED + 777, 3);
    return h <= 3 || (r < 0.32 && h < 6);
}

// ============================================================
// GÉNÉRATION CHUNK
// ============================================================
function generateChunkData(cx, cz) {
    const blocks = {};
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const x = baseX + lx, z = baseZ + lz;
            const h = getTerrainHeight(x, z);
            const water = isWaterAt(x, z, h);

            for (let y = 0; y <= h; y++) {
                let type;
                if (water && y === h) type = 'sand';
                else if (y === h) {
                    if (h > 25) type = 'stone';
                    else if (h < 5) type = 'sand';
                    else type = 'grass';
                } else if (y >= h - 2) type = 'dirt';
                else if (y < 8) type = 'rock';
                else type = 'stone';

                // Minerais : rares, à des profondeurs spécifiques
                if (type === 'stone' || type === 'rock') {
                    const oreRoll = hash2(x + y * 7, z + y * 13, TERRAIN_SEED + 1234);
                    if (y < 5 && oreRoll < 0.004) type = 'diamond_ore';
                    else if (y < 8 && oreRoll < 0.008) type = 'emerald_ore';
                    else if (y < 12 && oreRoll < 0.012) type = 'gold_ore';
                    else if (y < 15 && oreRoll < 0.016) type = 'silver_ore';
                    else if (y < 18 && oreRoll < 0.02) type = 'iron_ore';
                    else if (y < 22 && oreRoll < 0.024) type = 'copper_ore';
                    else if (y < 25 && oreRoll < 0.028) type = 'coal_ore';
                    else if (y < 3 && oreRoll > 0.998) type = 'obsidian';
                }
                blocks[`${lx},${y},${lz}`] = type;
            }

            // Arbres
            if (getBiome(x, z) === 'forest' && !water && h > 4 && h < 30) {
                if (hash2(x, z, TERRAIN_SEED + 9999) < 0.02) {
                    const woodType = hash2(x, z, 42) < 0.5 ? 'oak_wood' : 'birch_wood';
                    addTreeLocal(blocks, lx, h + 1, lz, woodType);
                }
            }
        }
    }

    // Modifications sauvegardées
    if (state.savedModifications) {
        for (const [gk, type] of Object.entries(state.savedModifications)) {
            const [x, y, z] = gk.split(',').map(Number);
            if (x >= baseX && x < baseX + CHUNK_SIZE && z >= baseZ && z < baseZ + CHUNK_SIZE) {
                blocks[`${x - baseX},${y},${z - baseZ}`] = type;
            }
        }
    }
    return blocks;
}

function addTreeLocal(blocks, lx, ly, lz, woodType) {
    const trunkH = 3 + Math.floor(hash2(lx, lz, 42) * 3);
    for (let i = 0; i < trunkH; i++) {
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
            blocks[`${lx},${ly + i},${lz}`] = woodType;
        }
    }
    const topY = ly + trunkH;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            for (let dy = 0; dy <= 1; dy++) {
                if (Math.abs(dx) + Math.abs(dz) + dy <= 3) {
                    const px = lx + dx, py = topY + dy, pz = lz + dz;
                    if (px >= 0 && px < CHUNK_SIZE && pz >= 0 && pz < CHUNK_SIZE) {
                        const k = `${px},${py},${pz}`;
                        if (!blocks[k]) blocks[k] = 'leaves';
                    }
                }
            }
        }
    }
}

// ============================================================
// CHUNKS
// ============================================================
function loadChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (state.loadedChunks.has(key)) return;

    const data = generateChunkData(cx, cz);
    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);

    const meshes = [];
    const blockMap = {};
    const globalBlocks = {};

    const byType = {};
    for (const [lk, type] of Object.entries(data)) {
        if (!byType[type]) byType[type] = [];
        byType[type].push(lk);
    }

    for (const [type, list] of Object.entries(byType)) {
        const material = getMaterial(type);
        const useInstanced = !Array.isArray(material) && typeof THREE.InstancedMesh !== 'undefined'
            && !BLOCK_REGISTRY[type].transparent && !BLOCK_REGISTRY[type].emissive;
        if (useInstanced) {
            const im = new THREE.InstancedMesh(sharedGeometry, material, list.length);
            im.castShadow = state.shadows;
            im.receiveShadow = state.shadows;
            im.userData.blockList = [];
            const dummy = new THREE.Object3D();
            for (let i = 0; i < list.length; i++) {
                const [lx, y, lz] = list[i].split(',').map(Number);
                dummy.position.set(lx, y, lz);
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
                const gx = cx * CHUNK_SIZE + lx;
                const gz = cz * CHUNK_SIZE + lz;
                im.userData.blockList.push({ lx, y, lz, gx, gz, type });
                globalBlocks[blockKey(gx, y, gz)] = type;
            }
            im.instanceMatrix.needsUpdate = true;
            group.add(im);
            meshes.push(im);
            blockMap[type] = { mesh: im, list };
        } else {
            for (const lk of list) {
                const [lx, y, lz] = lk.split(',').map(Number);
                const m = new THREE.Mesh(sharedGeometry, material);
                m.position.set(lx, y, lz);
                m.castShadow = state.shadows;
                m.receiveShadow = state.shadows;
                const gx = cx * CHUNK_SIZE + lx;
                const gz = cz * CHUNK_SIZE + lz;
                m.userData = { gx, y, gz, type };
                group.add(m);
                meshes.push(m);
                blockMap[blockKey(gx, y, gz)] = m;
                globalBlocks[blockKey(gx, y, gz)] = type;
            }
        }
    }

    scene.add(group);
    state.chunks.set(key, {
        cx, cz, group, meshes, blockMap, globalBlocks,
        animals: [], monsters: [], animalCountdown: 5, monsterCountdown: 10,
        loaded: true
    });
    state.loadedChunks.add(key);
    state.exploredChunks.add(key);
}

function unloadChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const chunk = state.chunks.get(key);
    if (!chunk) return;
    chunk.animals.forEach(a => { if (a.group) chunk.group.remove(a.group); });
    chunk.monsters.forEach(m => { if (m.group) chunk.group.remove(m.group); });
    chunk.meshes.forEach(m => { if (m.isInstancedMesh) m.dispose(); });
    scene.remove(chunk.group);
    state.chunks.delete(key);
    state.loadedChunks.delete(key);
}

let lastChunkUpdate = 0;
function updateChunks(delta) {
    lastChunkUpdate += delta;
    if (lastChunkUpdate < 0.15) return;
    lastChunkUpdate = 0;

    const pcx = Math.floor(player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(player.position.z / CHUNK_SIZE);
    const radius = Math.ceil(state.renderDistance / CHUNK_SIZE) + 1;

    let toLoad = 0;
    for (let dx = -radius; dx <= radius && toLoad < 2; dx++) {
        for (let dz = -radius; dz <= radius && toLoad < 2; dz++) {
            const cx = pcx + dx, cz = pcz + dz;
            if (Math.abs(cx) > WORLD_RADIUS / CHUNK_SIZE) continue;
            if (Math.abs(cz) > WORLD_RADIUS / CHUNK_SIZE) continue;
            const key = chunkKey(cx, cz);
            if (!state.loadedChunks.has(key)) {
                const d2 = dx * dx + dz * dz;
                if (d2 <= radius * radius) { loadChunk(cx, cz); toLoad++; }
            }
        }
    }
    const unloadR = radius + 2;
    for (const [key, chunk] of Array.from(state.chunks.entries())) {
        const dx = chunk.cx - pcx, dz = chunk.cz - pcz;
        if (dx * dx + dz * dz > unloadR * unloadR) unloadChunk(chunk.cx, chunk.cz);
    }
}

// ============================================================
// BLOCS
// ============================================================
function getBlockType(gx, y, gz) {
    const [cx, cz] = worldToChunk(gx, gz);
    const chunk = state.chunks.get(chunkKey(cx, cz));
    if (!chunk) return null;
    return chunk.globalBlocks[blockKey(gx, y, gz)] || null;
}

function setBlockGlobal(gx, y, gz, type) {
    const [cx, cz] = worldToChunk(gx, gz);
    const chunk = state.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const gk = blockKey(gx, y, gz);
    if (chunk.globalBlocks[gk]) return false;
    chunk.globalBlocks[gk] = type;

    const lx = gx - cx * CHUNK_SIZE;
    const lz = gz - cz * CHUNK_SIZE;
    const material = getMaterial(type);
    const m = new THREE.Mesh(sharedGeometry, material);
    m.position.set(lx, y, lz);
    m.castShadow = state.shadows;
    m.receiveShadow = state.shadows;
    m.userData = { gx, y, gz, type };
    chunk.group.add(m);
    chunk.meshes.push(m);
    chunk.blockMap[gk] = m;

    // Torche : ajouter lumière
    if (type === 'torch') addTorchLight(gx, y, gz);

    saveWorld();
    return true;
}

function removeBlockGlobal(gx, y, gz) {
    const [cx, cz] = worldToChunk(gx, gz);
    const chunk = state.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const gk = blockKey(gx, y, gz);
    if (!chunk.globalBlocks[gk]) return false;
    const removedType = chunk.globalBlocks[gk];
    delete chunk.globalBlocks[gk];

    const mesh = chunk.blockMap[gk];
    if (mesh) {
        chunk.group.remove(mesh);
        const idx = chunk.meshes.indexOf(mesh);
        if (idx > -1) chunk.meshes.splice(idx, 1);
        delete chunk.blockMap[gk];
    }
    for (const m of chunk.meshes) {
        if (m.isInstancedMesh && m.userData.blockList) {
            const list = m.userData.blockList;
            for (let i = 0; i < list.length; i++) {
                if (list[i].gx === gx && list[i].y === y && list[i].gz === gz) {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(0, -9999, 0);
                    dummy.updateMatrix();
                    m.setMatrixAt(i, dummy.matrix);
                    m.instanceMatrix.needsUpdate = true;
                    list[i].gx = -99999;
                    break;
                }
            }
        }
    }

    if (removedType === 'torch') removeTorchLight(gx, y, gz);
    spawnBlockParticles(gx + 0.5, y + 0.5, gz + 0.5, removedType);
    saveWorld();
    return true;
}

function isSolidAt(wx, wy, wz) {
    const t = getBlockType(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    return t !== null;
}

function collidesAt(pos) {
    const r = player.radius, h = player.height;
    const minX = Math.floor(pos.x - r), maxX = Math.floor(pos.x + r);
    const minY = Math.floor(pos.y - h), maxY = Math.floor(pos.y + 0.1);
    const minZ = Math.floor(pos.z - r), maxZ = Math.floor(pos.z + r);
    for (let bx = minX; bx <= maxX; bx++) {
        for (let by = minY; by <= maxY; by++) {
            for (let bz = minZ; bz <= maxZ; bz++) {
                if (isSolidAt(bx, by, bz)) {
                    if (pos.x + r > bx - 0.5 && pos.x - r < bx + 0.5 &&
                        pos.y > by - 0.5 && pos.y - h < by + 0.5 &&
                        pos.z + r > bz - 0.5 && pos.z - r < bz + 0.5) return true;
                }
            }
        }
    }
    return false;
}

// ============================================================
// TORCHES (gestion limitée des lumières)
// ============================================================
function addTorchLight(x, y, z) {
    if (torchLights.length >= MAX_TORCH_LIGHTS) {
        // Recycler la plus ancienne
        const old = torchLights.shift();
        scene.remove(old);
    }
    const light = new THREE.PointLight(0xFFAA00, 1.2, 8, 2);
    light.position.set(x + 0.5, y + 0.5, z + 0.5);
    light.castShadow = false; // crucial pour la perf
    scene.add(light);
    torchLights.push(light);
}

function removeTorchLight(x, y, z) {
    for (let i = torchLights.length - 1; i >= 0; i--) {
        const l = torchLights[i];
        if (Math.abs(l.position.x - (x + 0.5)) < 0.1 &&
            Math.abs(l.position.y - (y + 0.5)) < 0.1 &&
            Math.abs(l.position.z - (z + 0.5)) < 0.1) {
            scene.remove(l);
            torchLights.splice(i, 1);
        }
    }
}

// ============================================================
// PARTICULES
// ============================================================
function spawnBlockParticles(x, y, z, blockType) {
    const def = BLOCK_REGISTRY[blockType];
    if (!def) return;
    const color = '#' + def.colors[0].toString(16).padStart(6, '0');
    const layer = document.getElementById('particles-layer');
    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.background = color;
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 40;
        p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
        p.style.left = '50%';
        p.style.top = '50%';
        layer.appendChild(p);
        setTimeout(() => p.remove(), 900);
    }
}

// ============================================================
// ANIMAUX (réduits)
// ============================================================
const ANIMAL_TYPES = {
    sheep: { body: 0xF5F5F5, head: 0xE8E8E8, size: 0.7, sound: 600 },
    cow:   { body: 0x6B4423, head: 0x8B5A2B, size: 0.8, sound: 400 },
    pig:   { body: 0xF5A3A3, head: 0xF08080, size: 0.7, sound: 350 },
    chicken:{ body: 0xFFFFFF, head: 0xFFFFAA, size: 0.5, sound: 900 },
};
let animalTemplateCache = {};

function getAnimalTemplate(type) {
    if (animalTemplateCache[type]) return animalTemplateCache[type];
    const t = ANIMAL_TYPES[type];
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(t.size * 1.4, t.size * 0.8, t.size * 0.8),
        new THREE.MeshLambertMaterial({ color: t.body })
    );
    body.castShadow = state.shadows;
    body.position.y = t.size * 0.6;
    group.add(body);
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(t.size * 0.6, t.size * 0.6, t.size * 0.6),
        new THREE.MeshLambertMaterial({ color: t.head })
    );
    head.castShadow = state.shadows;
    head.position.set(t.size * 0.85, t.size * 0.85, 0);
    group.add(head);
    group.visible = false;
    animalTemplateCache[type] = group;
    return group;
}

function spawnAnimalInChunk(chunk) {
    if (state.maxAnimals <= 0 || chunk.animals.length > 6) return;
    const types = Object.keys(ANIMAL_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const lx = Math.floor(Math.random() * CHUNK_SIZE);
    const lz = Math.floor(Math.random() * CHUNK_SIZE);
    const gx = chunk.cx * CHUNK_SIZE + lx;
    const gz = chunk.cz * CHUNK_SIZE + lz;
    let topY = 40;
    while (topY > 0 && !isSolidAt(gx, topY, gz)) topY--;
    if (topY < 2) return;
    const group = getAnimalTemplate(type).clone();
    group.visible = true;
    group.position.set(lx, topY + 1, lz);
    chunk.group.add(group);
    chunk.animals.push({
        group, type, state: 'idle',
        timer: 1 + Math.random() * 3,
        direction: new THREE.Vector3(),
        speed: 1.2, soundTimer: 5 + Math.random() * 10, walkPhase: 0,
    });
}

function updateAnimals(delta) {
    const pcx = Math.floor(player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(player.position.z / CHUNK_SIZE);
    let total = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const chunk = state.chunks.get(chunkKey(pcx + dx, pcz + dz));
            if (!chunk) continue;
            chunk.animalCountdown -= delta;
            if (chunk.animalCountdown <= 0 && total < state.maxAnimals) {
                chunk.animalCountdown = 8 + Math.random() * 15;
                spawnAnimalInChunk(chunk);
            }
            for (const a of chunk.animals) {
                total++;
                if (!a.group) continue;
                a.timer -= delta;
                if (a.timer <= 0) {
                    a.timer = 2 + Math.random() * 4;
                    if (Math.random() < 0.4) { a.state = 'idle'; a.direction.set(0, 0, 0); }
                    else {
                        a.state = 'walk';
                        const ang = Math.random() * Math.PI * 2;
                        a.direction.set(Math.cos(ang), 0, Math.sin(ang));
                    }
                }
                if (a.state === 'walk') {
                    const step = a.speed * delta;
                    const nx = a.group.position.x + a.direction.x * step;
                    const nz = a.group.position.z + a.direction.z * step;
                    const wx = chunk.cx * CHUNK_SIZE + nx;
                    const wz = chunk.cz * CHUNK_SIZE + nz;
                    const wy = Math.floor(a.group.position.y - 0.5);
                    if (!isSolidAt(wx, wy + 1, wz) && isSolidAt(wx, wy, wz)) {
                        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                            a.group.position.x = nx;
                            a.group.position.z = nz;
                            a.walkPhase += delta * 8;
                        } else a.direction.negate();
                    } else a.direction.negate();
                    a.group.rotation.y = Math.atan2(a.direction.x, a.direction.z);
                    a.group.position.y = a.group.position.y + Math.sin(a.walkPhase) * 0.01;
                }
                a.soundTimer -= delta;
                if (a.soundTimer <= 0) {
                    a.soundTimer = 10 + Math.random() * 20;
                    if (Math.random() < 0.5) playSound(ANIMAL_TYPES[a.type].sound, 0.15, 'sine', 0.015);
                }
            }
        }
    }
    state.animalCount = total;
}

// ============================================================
// MONSTRES (FSM complète)
// ============================================================
const MONSTER_TYPES = {
    zombie:  { color: 0x4A7A4A, size: 0.9, hp: 10, damage: 3, speed: 1.5, xp: 2, icon: '🧟', sound: 180, soundType: 'sawtooth' },
    skeleton:{ color: 0xD8D8C8, size: 0.9, hp: 8,  damage: 2, speed: 1.8, xp: 2, icon: '💀', sound: 320, soundType: 'triangle' },
    spider:  { color: 0x222222, size: 0.7, hp: 6,  damage: 2, speed: 2.4, xp: 2, icon: '🕷️', sound: 450, soundType: 'square' },
    wolf:    { color: 0x606060, size: 0.7, hp: 7,  damage: 3, speed: 2.2, xp: 2, icon: '🐺', sound: 260, soundType: 'sawtooth' },
    golem:   { color: 0x707070, size: 1.3, hp: 25, damage: 6, speed: 0.9, xp: 5, icon: '🗿', sound: 120, soundType: 'square' },
};

let monsterTemplateCache = {};

function createMonsterMesh(type) {
    if (monsterTemplateCache[type]) return monsterTemplateCache[type];
    const t = MONSTER_TYPES[type];
    const group = new THREE.Group();

    // Corps
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(t.size * 0.9, t.size * 1.1, t.size * 0.7),
        new THREE.MeshLambertMaterial({ color: t.color, emissive: 0x110000 })
    );
    body.castShadow = state.shadows;
    body.position.y = t.size * 0.9;
    group.add(body);
    group.userData.body = body;

    // Tête
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(t.size * 0.7, t.size * 0.7, t.size * 0.7),
        new THREE.MeshLambertMaterial({ color: t.color })
    );
    head.castShadow = state.shadows;
    head.position.y = t.size * 1.75;
    group.add(head);
    group.userData.head = head;

    // Yeux rouges
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeGeo = new THREE.BoxGeometry(t.size * 0.15, t.size * 0.15, t.size * 0.05);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-t.size * 0.18, t.size * 1.85, t.size * 0.36);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(t.size * 0.18, t.size * 1.85, t.size * 0.36);
    group.add(eyeR);

    // Bras
    const armMat = new THREE.MeshLambertMaterial({ color: t.color });
    const armGeo = new THREE.BoxGeometry(t.size * 0.25, t.size * 0.7, t.size * 0.25);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-t.size * 0.55, t.size * 1.0, 0);
    group.add(armL);
    group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(t.size * 0.55, t.size * 1.0, 0);
    group.add(armR);
    group.userData.armR = armR;

    // Barre de vie (sprite canvas)
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width = 64; hpCanvas.height = 8;
    const hpTex = new THREE.CanvasTexture(hpCanvas);
    const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpTex, depthTest: false }));
    hpSprite.position.y = t.size * 2.5;
    hpSprite.scale.set(1, 0.125, 1);
    group.add(hpSprite);
    group.userData.hpSprite = hpSprite;
    group.userData.hpCanvas = hpCanvas;
    group.userData.hpTex = hpTex;

    group.visible = false;
    monsterTemplateCache[type] = group;
    return group;
}

function updateMonsterHPBar(monster) {
    const canvas = monster.group.userData.hpCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 64, 8);
    const pct = Math.max(0, monster.hp / monster.maxHp);
    ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FF9800' : '#F44336';
    ctx.fillRect(1, 1, 62 * pct, 6);
    monster.group.userData.hpTex.needsUpdate = true;
}

function spawnMonsterInChunk(chunk) {
    if (state.maxMonsters <= 0 || chunk.monsters.length > 4) return;
    const isNight = state.dayTime < 0.25 || state.dayTime > 0.75;
    if (!isNight && Math.random() > 0.25) return;

    const types = Object.keys(MONSTER_TYPES);
    let type = types[Math.floor(Math.random() * types.length)];
    if (!isNight && (type === 'golem')) type = 'zombie';

    const lx = Math.floor(Math.random() * CHUNK_SIZE);
    const lz = Math.floor(Math.random() * CHUNK_SIZE);
    const gx = chunk.cx * CHUNK_SIZE + lx;
    const gz = chunk.cz * CHUNK_SIZE + lz;
    let topY = 40;
    while (topY > 0 && !isSolidAt(gx, topY, gz)) topY--;
    if (topY < 2) return;

    const group = createMonsterMesh(type).clone();
    // Cloner les userData structs
    group.userData = { ...createMonsterMesh(type).userData };
    group.visible = true;
    group.position.set(lx, topY + 1, lz);
    chunk.group.add(group);

    const data = MONSTER_TYPES[type];
    const monster = {
        group, type,
        hp: data.hp, maxHp: data.hp,
        damage: data.damage, speed: data.speed,
        direction: new THREE.Vector3(),
        attackCooldown: 0,
        walkPhase: 0,
        state: 'idle',
        timer: 1 + Math.random() * 2,
        soundTimer: 3 + Math.random() * 6,
        deathTimer: 0,
        hitFlash: 0,
    };
    chunk.monsters.push(monster);
    updateMonsterHPBar(monster);
}

function damagePlayer(amount) {
    if (state.damageCooldown > 0 || state.isDead || !state.survivalEnabled) return;
    state.health = Math.max(0, state.health - amount);
    state.damageCooldown = 0.8;
    showFloatingMessage(`-${amount} ❤️`, 'damage');
    playSound(150, 0.15, 'sawtooth', 0.05);
    updateHealthUI();
    if (state.health <= 0) triggerGameOver();
}

function attackMonster(monster) {
    if (state.attackCooldown > 0) return;
    const w = WEAPON_REGISTRY[state.equippedWeapon.key];
    if (!w) return;
    const dmg = w.damage;
    state.attackCooldown = w.cooldown;

    // Durabilité
    state.equippedWeapon.durability--;
    if (state.equippedWeapon.durability <= 0) {
        showFloatingMessage('Arme cassée !', 'damage');
        // Remplacer par épée en bois de secours
        state.equippedWeapon = { key: 'wood_sword', durability: 30 };
    }
    updateWeaponUI();

    monster.hp -= dmg;
    monster.hitFlash = 0.15;
    updateMonsterHPBar(monster);
    playSound(250, 0.08, 'square', 0.04);
    showFloatingMessage(`-${dmg}`, 'hit');

    // Animation de recul
    const dir = new THREE.Vector3().subVectors(monster.group.position, player.position).normalize();
    monster.group.position.x += dir.x * 0.4;
    monster.group.position.z += dir.z * 0.4;

    if (monster.hp <= 0) killMonster(monster);
}

function killMonster(monster) {
    const data = MONSTER_TYPES[monster.type];
    state.kills++;
    document.getElementById('kills-value').textContent = state.kills;

    const coinsGain = Math.floor(1 + Math.random() * 4) * data.xp;
    state.coins += coinsGain;
    document.getElementById('coins-value').textContent = state.coins;
    showFloatingMessage(`+${coinsGain} 🪙`, 'loot');
    playSound(700, 0.12, 'sine', 0.04);

    // Animation de mort : rotation + chute
    monster.state = 'dead';
    monster.deathTimer = 0.8;
    if (monster.group) {
        monster.group.rotation.z = Math.PI / 4;
    }
}

function updateMonsters(delta) {
    const pcx = Math.floor(player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(player.position.z / CHUNK_SIZE);
    let total = 0;
    const isNight = state.dayTime < 0.25 || state.dayTime > 0.75;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const chunk = state.chunks.get(chunkKey(pcx + dx, pcz + dz));
            if (!chunk) continue;

            chunk.monsterCountdown -= delta;
            if (chunk.monsterCountdown <= 0 && total < state.maxMonsters) {
                chunk.monsterCountdown = (isNight ? 4 : 15) + Math.random() * 10;
                spawnMonsterInChunk(chunk);
            }

            for (let i = chunk.monsters.length - 1; i >= 0; i--) {
                const m = chunk.monsters[i];
                if (!m.group) { chunk.monsters.splice(i, 1); continue; }

                // Mort animée
                if (m.state === 'dead') {
                    m.deathTimer -= delta;
                    m.group.rotation.z += delta * 3;
                    m.group.position.y -= delta * 0.5;
                    if (m.deathTimer <= 0) {
                        chunk.group.remove(m.group);
                        chunk.monsters.splice(i, 1);
                    }
                    continue;
                }

                total++;

                // Flash de dégâts
                if (m.hitFlash > 0) {
                    m.hitFlash -= delta;
                    const bodyMat = m.group.userData.body?.material;
                    if (bodyMat) bodyMat.emissive.setHex(m.hitFlash > 0 ? 0xff0000 : 0x110000);
                }

                const wx = chunk.cx * CHUNK_SIZE + m.group.position.x;
                const wz = chunk.cz * CHUNK_SIZE + m.group.position.z;
                const wy = m.group.position.y;
                const dxp = player.position.x - wx;
                const dzp = player.position.z - wz;
                const dyp = player.position.y - wy;
                const distSq = dxp * dxp + dzp * dzp;
                const detectRange = 14;

                m.attackCooldown -= delta;
                m.timer -= delta;

                if (distSq < detectRange * detectRange && Math.abs(dyp) < 8) {
                    // CHASE
                    m.state = 'chase';
                    const dist = Math.sqrt(distSq);
                    if (dist > 1.3) {
                        const dirX = dxp / dist, dirZ = dzp / dist;
                        const step = m.speed * delta;
                        const nx = m.group.position.x + dirX * step;
                        const nz = m.group.position.z + dirZ * step;
                        const gx = chunk.cx * CHUNK_SIZE + nx;
                        const gz = chunk.cz * CHUNK_SIZE + nz;
                        const gy = Math.floor(m.group.position.y - 0.5);
                        // Évitement : tester bloc devant
                        if (!isSolidAt(gx, gy + 1, gz)) {
                            if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                                m.group.position.x = nx;
                                m.group.position.z = nz;
                            } else {
                                m.group.position.x = Math.max(0.5, Math.min(CHUNK_SIZE - 0.5, nx));
                                m.group.position.z = Math.max(0.5, Math.min(CHUNK_SIZE - 0.5, nz));
                            }
                        }
                        m.group.rotation.y = Math.atan2(dirX, dirZ);
                        m.walkPhase += delta * 8;
                        // Animation des bras
                        if (m.group.userData.armL) m.group.userData.armL.rotation.x = Math.sin(m.walkPhase) * 0.6;
                        if (m.group.userData.armR) m.group.userData.armR.rotation.x = -Math.sin(m.walkPhase) * 0.6;
                    } else {
                        // ATTACK
                        if (m.attackCooldown <= 0) {
                            m.attackCooldown = 1.0;
                            damagePlayer(m.damage);
                            // Animation bras en avant
                            if (m.group.userData.armR) m.group.userData.armR.rotation.x = -1.5;
                        }
                    }
                } else {
                    // IDLE / PATROL
                    if (m.timer <= 0) {
                        m.timer = 2 + Math.random() * 3;
                        if (Math.random() < 0.4) {
                            m.state = 'idle';
                            m.direction.set(0, 0, 0);
                        } else {
                            m.state = 'patrol';
                            const a = Math.random() * Math.PI * 2;
                            m.direction.set(Math.cos(a), 0, Math.sin(a));
                        }
                    }
                    if (m.state === 'patrol') {
                        const step = m.speed * 0.4 * delta;
                        const nx = m.group.position.x + m.direction.x * step;
                        const nz = m.group.position.z + m.direction.z * step;
                        if (nx > 0.5 && nx < CHUNK_SIZE - 0.5 && nz > 0.5 && nz < CHUNK_SIZE - 0.5) {
                            m.group.position.x = nx;
                            m.group.position.z = nz;
                        } else m.direction.negate();
                        m.group.rotation.y = Math.atan2(m.direction.x, m.direction.z);
                    }
                }

                // Sons
                m.soundTimer -= delta;
                if (m.soundTimer <= 0) {
                    m.soundTimer = 5 + Math.random() * 10;
                    if (Math.random() < 0.4) {
                        const d = MONSTER_TYPES[m.type];
                        playSound(d.sound, 0.2, d.soundType, 0.02);
                    }
                }
            }
        }
    }
    state.monsterCount = total;
}

// ============================================================
// INTERFACE
// ============================================================
function setupUI() {
    const hotbar = document.getElementById('hotbar');
    const invGrid = document.getElementById('inventory-grid');

    BLOCK_KEYS.forEach((key, index) => {
        const b = BLOCK_REGISTRY[key];
        // Hotbar : 9 premiers blocs
        if (index < 9) {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot';
            slot.dataset.block = key;
            slot.title = b.name;
            slot.innerHTML = `<span class="num">${index + 1}</span><span class="icon">${b.icon}</span><span>${b.name}</span>`;
            slot.addEventListener('click', (e) => { e.stopPropagation(); selectBlock(key); });
            hotbar.appendChild(slot);
        }

        const islot = document.createElement('div');
        islot.className = 'inventory-slot';
        islot.dataset.block = key;
        islot.dataset.tab = 'blocks';
        islot.innerHTML = `<span class="icon">${b.icon}</span><span>${b.name}</span>`;
        islot.addEventListener('click', (e) => { e.stopPropagation(); selectBlock(key); });
        invGrid.appendChild(islot);
    });

    // Armes dans l'inventaire
    Object.keys(WEAPON_REGISTRY).forEach(key => {
        const w = WEAPON_REGISTRY[key];
        const islot = document.createElement('div');
        islot.className = 'inventory-slot';
        islot.dataset.weapon = key;
        islot.dataset.tab = 'weapons';
        islot.style.display = 'none';
        islot.innerHTML = `<span class="icon">${w.icon}</span><span>${w.name}</span>`;
        islot.addEventListener('click', (e) => {
            e.stopPropagation();
            equipWeapon(key);
        });
        invGrid.appendChild(islot);
    });

    // Tabs
    document.querySelectorAll('.inv-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.querySelectorAll('.inventory-slot').forEach(s => {
                s.style.display = s.dataset.tab === target ? 'flex' : 'none';
            });
        });
    });

    document.getElementById('btn-day').addEventListener('click', () => setTime(0.5));
    document.getElementById('btn-night').addEventListener('click', () => setTime(0.0));
    document.getElementById('btn-cycle').addEventListener('click', toggleCycle);
    document.getElementById('btn-settings').addEventListener('click', toggleSettings);
    document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
    document.getElementById('btn-reset-world').addEventListener('click', resetWorld);
    document.getElementById('btn-restart').addEventListener('click', restartGame);
    document.getElementById('btn-menu').addEventListener('click', restartGame);

    // Sliders
    const bindSlider = (id, valId, prop, onChange) => {
        const slider = document.getElementById(id);
        const span = document.getElementById(valId);
        slider.addEventListener('input', (e) => {
            state[prop] = parseInt(e.target.value);
            span.textContent = state[prop];
            if (onChange) onChange();
            saveSettings();
        });
    };
    bindSlider('speed-walk', 'speed-walk-val', 'walkSpeed', updateSpeedUI);
    bindSlider('speed-fly', 'speed-fly-val', 'flySpeed', updateSpeedUI);
    bindSlider('max-animals', 'max-animals-val', 'maxAnimals');
    bindSlider('max-monsters', 'max-monsters-val', 'maxMonsters');
    bindSlider('render-distance', 'render-distance-val', 'renderDistance', () => {
        scene.fog.far = state.renderDistance;
        camera.far = state.renderDistance * 2;
        camera.updateProjectionMatrix();
    });

    document.getElementById('quality-select').addEventListener('change', (e) => {
        setQuality(e.target.value);
        saveSettings();
    });
    document.getElementById('chk-shadows').addEventListener('change', (e) => {
        state.shadows = e.target.checked;
        applyShadows();
        saveSettings();
    });
    document.getElementById('chk-cycle').addEventListener('change', (e) => {
        state.cycleAuto = e.target.checked;
        updateCycleUI();
        saveSettings();
    });
    document.getElementById('chk-fps').addEventListener('change', (e) => {
        state.showFPS = e.target.checked;
        document.getElementById('fps-counter').style.display = state.showFPS ? 'block' : 'none';
        saveSettings();
    });
    document.getElementById('chk-survival').addEventListener('change', (e) => {
        state.survivalEnabled = e.target.checked;
        saveSettings();
    });
}

function selectBlock(key) {
    if (!BLOCK_REGISTRY[key]) return;
    state.selectedBlock = key;
    updateSelectedBlockUI();
    saveSettings();
    playSound(500, 0.05, 'square', 0.02);
}

function equipWeapon(key) {
    if (!WEAPON_REGISTRY[key]) return;
    const w = WEAPON_REGISTRY[key];
    state.equippedWeapon = { key, durability: w.durability };
    updateWeaponUI();
    saveSettings();
    playSound(600, 0.08, 'triangle', 0.03);
}

function updateSelectedBlockUI() {
    const b = BLOCK_REGISTRY[state.selectedBlock];
    document.getElementById('selected-block-name').textContent = `${b.icon} ${b.name}`;
    document.querySelectorAll('.hotbar-slot').forEach(s => {
        s.classList.toggle('active', s.dataset.block === state.selectedBlock);
    });
    document.querySelectorAll('.inventory-slot').forEach(s => {
        s.classList.toggle('selected', s.dataset.block === state.selectedBlock);
    });
}

function updateWeaponUI() {
    const w = WEAPON_REGISTRY[state.equippedWeapon.key];
    if (!w) return;
    document.getElementById('weapon-icon').textContent = w.icon;
    document.getElementById('weapon-name').textContent = w.name;
    const pct = (state.equippedWeapon.durability / w.durability) * 100;
    document.getElementById('weapon-durability-fill').style.width = pct + '%';
}

function updateModeUI() {
    const el = document.getElementById('mode-indicator');
    el.textContent = state.isFlying ? 'Vol ✈️' : 'Marche 🚶';
    el.style.borderColor = state.isFlying ? '#FFD700' : '#4CAF50';
}

function updateSpeedUI() {
    document.getElementById('speed-value').textContent = state.isFlying ? state.flySpeed : state.walkSpeed;
}

function updateCycleUI() {
    document.getElementById('btn-cycle').classList.toggle('active', state.cycleAuto);
}

function updateShadowsUI() {
    document.getElementById('chk-shadows').checked = state.shadows;
    document.getElementById('chk-cycle').checked = state.cycleAuto;
    document.getElementById('chk-fps').checked = state.showFPS;
    document.getElementById('chk-survival').checked = state.survivalEnabled;
    document.getElementById('quality-select').value = state.quality;
    document.getElementById('speed-walk').value = state.walkSpeed;
    document.getElementById('speed-walk-val').textContent = state.walkSpeed;
    document.getElementById('speed-fly').value = state.flySpeed;
    document.getElementById('speed-fly-val').textContent = state.flySpeed;
    document.getElementById('render-distance').value = state.renderDistance;
    document.getElementById('render-distance-val').textContent = state.renderDistance;
    document.getElementById('max-animals').value = state.maxAnimals;
    document.getElementById('max-animals-val').textContent = state.maxAnimals;
    document.getElementById('max-monsters').value = state.maxMonsters;
    document.getElementById('max-monsters-val').textContent = state.maxMonsters;
    document.getElementById('fps-counter').style.display = state.showFPS ? 'block' : 'none';
}

function updateHealthUI() {
    const pct = (state.health / state.maxHealth) * 100;
    const fill = document.getElementById('health-bar-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('low', pct < 40);
    document.getElementById('health-text').textContent = `❤️ ${Math.ceil(state.health)} / ${state.maxHealth}`;
}

function updateTimeUI() {
    const totalMin = Math.floor(state.dayTime * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    document.getElementById('time-value').textContent =
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function showFloatingMessage(text, cls) {
    const container = document.getElementById('floating-messages');
    const el = document.createElement('div');
    el.className = 'float-msg ' + (cls || '');
    el.textContent = text;
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.random() * 80;
    el.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
    el.style.top = `calc(50% + ${Math.sin(angle) * radius - 40}px)`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

// ============================================================
// MINI-CARTE (inchangée, simplifiée)
// ============================================================
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const MINIMAP_SIZE = 180;
const MINIMAP_RANGE = 96;

function updateMinimap() {
    const ctx = minimapCtx;
    const size = MINIMAP_SIZE;
    const half = size / 2;
    const px = player.position.x;
    const pz = player.position.z;
    const scale = size / (MINIMAP_RANGE * 2);

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, size, size);

    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const cr = Math.ceil(MINIMAP_RANGE / CHUNK_SIZE) + 1;

    for (let dx = -cr; dx <= cr; dx++) {
        for (let dz = -cr; dz <= cr; dz++) {
            const ckey = chunkKey(pcx + dx, pcz + dz);
            if (!state.exploredChunks.has(ckey)) continue;
            const centerX = (pcx + dx) * CHUNK_SIZE + CHUNK_SIZE / 2;
            const centerZ = (pcz + dz) * CHUNK_SIZE + CHUNK_SIZE / 2;
            const sX = half + (centerX - px) * scale;
            const sZ = half + (centerZ - pz) * scale;
            const biome = getBiome(centerX, centerZ);
            let color = '#4a7a3a';
            if (biome === 'forest') color = '#2d5a2d';
            else if (biome === 'hills') color = '#6a6a3a';
            else if (biome === 'mountains') color = '#8a8a8a';
            ctx.fillStyle = color;
            ctx.fillRect(sX - CHUNK_SIZE * scale / 2, sZ - CHUNK_SIZE * scale / 2,
                         CHUNK_SIZE * scale, CHUNK_SIZE * scale);
        }
    }

    // Monstres
    ctx.fillStyle = '#ff3333';
    for (const chunk of state.chunks.values()) {
        for (const m of chunk.monsters) {
            if (!m.group || m.state === 'dead') continue;
            const wx = chunk.cx * CHUNK_SIZE + m.group.position.x;
            const wz = chunk.cz * CHUNK_SIZE + m.group.position.z;
            const sX = half + (wx - px) * scale;
            const sZ = half + (wz - pz) * scale;
            if (sX < 0 || sX > size || sZ < 0 || sZ > size) continue;
            ctx.beginPath();
            ctx.arc(sX, sZ, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Bordure monde
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        half + (-WORLD_RADIUS - px) * scale,
        half + (-WORLD_RADIUS - pz) * scale,
        (WORLD_RADIUS * 2) * scale,
        (WORLD_RADIUS * 2) * scale
    );

    // Joueur
    ctx.save();
    ctx.translate(half, half);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    ctx.rotate(Math.atan2(dir.x, dir.z));
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(-6, 6); ctx.lineTo(6, 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    document.getElementById('minimap-coords').textContent =
        `${Math.round(px)}, ${Math.round(player.position.y)}, ${Math.round(pz)}`;
}

// ============================================================
// GAME OVER
// ============================================================
function triggerGameOver() {
    if (state.isDead) return;
    state.isDead = true;
    document.exitPointerLock();
    document.getElementById('game-over').classList.add('open');
    document.getElementById('game-over-stats').textContent =
        `Monstres éliminés : ${state.kills} · Pièces : ${state.coins}`;
    document.getElementById('overlay').classList.add('active');
}

function restartGame() {
    state.isDead = false;
    state.health = state.maxHealth;
    state.kills = 0;
    state.coins = 0;
    state.damageCooldown = 0;
    document.getElementById('kills-value').textContent = '0';
    document.getElementById('coins-value').textContent = '0';
    document.getElementById('game-over').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
    updateHealthUI();
    let topY = 60;
    while (topY > 0 && !isSolidAt(player.position.x, topY, player.position.z)) topY--;
    player.position.y = Math.max(topY + 3, 30);
    player.velocity.set(0, 0, 0);
    camera.position.copy(player.position);
}

// ============================================================
// TEMPS
// ============================================================
function setTime(t) {
    state.dayTime = ((t % 1) + 1) % 1;
    updateTimeUI();
    saveSettings();
}
function toggleCycle() {
    state.cycleAuto = !state.cycleAuto;
    updateCycleUI();
    saveSettings();
}
function updateDayNight(delta) {
    if (state.cycleAuto) {
        state.dayTime = (state.dayTime + delta / 180) % 1;
        updateTimeUI();
    }
    const angle = (state.dayTime - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(angle);
    const dayFactor = Math.max(0, sunHeight);

    sunLight.position.set(
        player.position.x + Math.cos(angle) * 80,
        player.position.y + sunHeight * 80,
        player.position.z + 30
    );
    sunLight.target.position.set(player.position.x, player.position.y - 5, player.position.z);
    sunLight.target.updateMatrixWorld();

    sunLight.intensity = 0.15 + dayFactor * 1.2;
    sunLight.color.setHSL(0.1, 0.4 * (1 - dayFactor), 0.5 + dayFactor * 0.5);
    ambientLight.intensity = 0.15 + dayFactor * 0.45;
    hemiLight.intensity = 0.2 + dayFactor * 0.4;

    const skyColor = new THREE.Color();
    if (sunHeight > 0.05) skyColor.setHSL(0.58, 0.65, 0.35 + dayFactor * 0.35);
    else if (sunHeight > -0.15) skyColor.setHSL(0.06, 0.55, 0.25);
    else skyColor.setHSL(0.62, 0.5, 0.06);

    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor);
}

// ============================================================
// SAUVEGARDE
// ============================================================
function saveSettings() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
            v: 5,
            settings: {
                walkSpeed: state.walkSpeed, flySpeed: state.flySpeed,
                renderDistance: state.renderDistance, maxAnimals: state.maxAnimals,
                maxMonsters: state.maxMonsters, quality: state.quality,
                shadows: state.shadows, cycleAuto: state.cycleAuto,
                showFPS: state.showFPS, survivalEnabled: state.survivalEnabled,
                dayTime: state.dayTime,
            },
            player: {
                x: player.position.x, y: player.position.y, z: player.position.z,
                isFlying: state.isFlying, selectedBlock: state.selectedBlock,
            },
            equipped: state.equippedWeapon,
            survival: { health: state.health, kills: state.kills, coins: state.coins },
        }));
    } catch (e) {}
}

let saveTimeout = null;
function saveWorld() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveWorldNow, 600);
}
function saveWorldNow() {
    try {
        const mods = {};
        for (const chunk of state.chunks.values()) {
            for (const [gk, type] of Object.entries(chunk.globalBlocks)) mods[gk] = type;
        }
        localStorage.setItem(SAVE_KEY + '_world', JSON.stringify({ v: 5, modifications: mods }));
    } catch (e) {}
}

function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data) return false;

        if (data.settings) {
            const s = data.settings;
            state.walkSpeed = s.walkSpeed ?? 5;
            state.flySpeed = s.flySpeed ?? 14;
            state.renderDistance = s.renderDistance ?? 128;
            state.maxAnimals = s.maxAnimals ?? 16;
            state.maxMonsters = s.maxMonsters ?? 8;
            state.quality = s.quality ?? 'medium';
            state.shadows = s.shadows !== undefined ? s.shadows : true;
            state.cycleAuto = s.cycleAuto !== undefined ? s.cycleAuto : true;
            state.showFPS = s.showFPS !== undefined ? s.showFPS : true;
            state.survivalEnabled = s.survivalEnabled !== undefined ? s.survivalEnabled : true;
            state.dayTime = s.dayTime ?? 0.25;
        }
        if (data.player) {
            player.position.set(data.player.x ?? 0.5, data.player.y ?? 30, data.player.z ?? 0.5);
            camera.position.copy(player.position);
            state.isFlying = !!data.player.isFlying;
            state.selectedBlock = data.player.selectedBlock || 'dirt';
        }
        if (data.equipped) {
            state.equippedWeapon = data.equipped;
        }
        if (data.survival) {
            state.health = data.survival.health ?? 20;
            state.kills = data.survival.kills ?? 0;
            state.coins = data.survival.coins ?? 0;
            document.getElementById('kills-value').textContent = state.kills;
            document.getElementById('coins-value').textContent = state.coins;
        }

        scene.fog.far = state.renderDistance;
        camera.far = state.renderDistance * 2;
        camera.updateProjectionMatrix();
        setQuality(state.quality);
        applyShadows();
        updateSelectedBlockUI();
        updateModeUI();
        updateSpeedUI();
        updateCycleUI();
        updateShadowsUI();
        updateHealthUI();
        updateTimeUI();
        updateWeaponUI();

        try {
            const worldRaw = localStorage.getItem(SAVE_KEY + '_world');
            if (worldRaw) {
                const wd = JSON.parse(worldRaw);
                state.savedModifications = wd.modifications || {};
            }
        } catch (e) { state.savedModifications = {}; }
        return true;
    } catch (e) { return false; }
}

function resetWorld() {
    if (!confirm('Réinitialiser le monde ? Action irréversible.')) return;
    try {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(SAVE_KEY + '_world');
    } catch (e) {}
    state.savedModifications = {};
    for (const chunk of Array.from(state.chunks.values())) unloadChunk(chunk.cx, chunk.cz);
    state.chunks.clear();
    state.loadedChunks.clear();
    state.exploredChunks.clear();
    player.position.set(0.5, 30, 0.5);
    camera.position.copy(player.position);
    state.health = state.maxHealth;
    state.kills = 0;
    state.coins = 0;
    updateHealthUI();
    document.getElementById('kills-value').textContent = '0';
    document.getElementById('coins-value').textContent = '0';
    closeSettings();
    saveSettings();
}

// ============================================================
// QUALITÉ
// ============================================================
function setQuality(q) {
    state.quality = q;
    let scale = 1;
    if (q === 'low') { scale = 0.6; shadowMapSize = 512; state.renderDistance = Math.min(state.renderDistance, 96); }
    else if (q === 'medium') { scale = 1; shadowMapSize = 1024; }
    else { scale = Math.min(window.devicePixelRatio, 2); shadowMapSize = 2048; }
    renderer.setPixelRatio(scale);
    sunLight.shadow.mapSize.width = shadowMapSize;
    sunLight.shadow.mapSize.height = shadowMapSize;
    if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
    renderer.shadowMap.needsUpdate = true;
    document.getElementById('render-distance').value = state.renderDistance;
    document.getElementById('render-distance-val').textContent = state.renderDistance;
    scene.fog.far = state.renderDistance;
    camera.far = state.renderDistance * 2;
    camera.updateProjectionMatrix();
    saveSettings();
}

function applyShadows() {
    renderer.shadowMap.enabled = state.shadows;
    sunLight.castShadow = state.shadows;
    scene.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = state.shadows;
            obj.receiveShadow = state.shadows;
        }
    });
    renderer.shadowMap.needsUpdate = true;
}

// ============================================================
// PANNEAUX
// ============================================================
function toggleInventory(force) {
    const open = force !== undefined ? force : !state.isInventoryOpen;
    state.isInventoryOpen = open;
    document.getElementById('inventory').classList.toggle('open', open);
    const overlay = document.getElementById('overlay');
    if (open) {
        if (state.isSettingsOpen) closeSettings();
        document.exitPointerLock();
        overlay.classList.add('active');
    } else {
        if (!state.isSettingsOpen) overlay.classList.remove('active');
    }
}
function toggleSettings() {
    if (state.isSettingsOpen) { closeSettings(); return; }
    if (state.isInventoryOpen) toggleInventory(false);
    state.isSettingsOpen = true;
    document.getElementById('settings-panel').classList.add('open');
    document.getElementById('overlay').classList.add('active');
    document.exitPointerLock();
    updateShadowsUI();
}
function closeSettings() {
    state.isSettingsOpen = false;
    document.getElementById('settings-panel').classList.remove('open');
    if (!state.isInventoryOpen) document.getElementById('overlay').classList.remove('active');
}

// ============================================================
// ÉVÉNEMENTS
// ============================================================
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('click', () => {
        if (!state.isInventoryOpen && !state.isSettingsOpen && !state.isDead && !state.isPointerLocked) {
            renderer.domElement.requestPointerLock();
        }
    });
    document.addEventListener('pointerlockchange', () => {
        state.isPointerLocked = document.pointerLockElement === renderer.domElement;
    });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => {
        if (state.isInventoryOpen || state.isSettingsOpen) return;
        const dir = Math.sign(e.deltaY);
        if (dir === 0) return;
        let idx = BLOCK_KEYS.indexOf(state.selectedBlock);
        idx = (idx + dir + BLOCK_KEYS.length) % BLOCK_KEYS.length;
        selectBlock(BLOCK_KEYS[idx]);
    }, { passive: true });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
    keys[e.code] = true;
    if (e.code === 'KeyE') {
        if (state.isSettingsOpen) closeSettings();
        else toggleInventory();
        return;
    }
    if (e.code === 'KeyF') {
        state.isFlying = !state.isFlying;
        player.velocity.set(0, 0, 0);
        player.targetVel.set(0, 0, 0);
        updateModeUI();
        updateSpeedUI();
        saveSettings();
        return;
    }
    if (e.code === 'KeyT') {
        // Placer torche devant
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const px = Math.floor(player.position.x + forward.x * 2);
        const py = Math.floor(player.position.y - 0.5);
        const pz = Math.floor(player.position.z + forward.z * 2);
        if (!isSolidAt(px, py, pz) && isSolidAt(px, py - 1, pz)) {
            setBlockGlobal(px, py, pz, 'torch');
        }
        return;
    }
    if (e.code === 'Escape') {
        if (state.isInventoryOpen) toggleInventory(false);
        if (state.isSettingsOpen) closeSettings();
        return;
    }
    if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.slice(5));
        if (num >= 1 && num <= Math.min(9, BLOCK_KEYS.length)) {
            selectBlock(BLOCK_KEYS[num - 1]);
        }
    }
}
function onKeyUp(e) { keys[e.code] = false; }

function onMouseMove(e) {
    if (!state.isPointerLocked || state.isInventoryOpen || state.isSettingsOpen || state.isDead) return;
    const mx = e.movementX || 0;
    const my = e.movementY || 0;
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= mx * 0.0022;
    euler.x -= my * 0.0022;
    euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
    camera.quaternion.setFromEuler(euler);
}

function getNearbyMeshes() {
    const pcx = Math.floor(player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(player.position.z / CHUNK_SIZE);
    const meshes = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const chunk = state.chunks.get(chunkKey(pcx + dx, pcz + dz));
            if (chunk) meshes.push(...chunk.meshes);
        }
    }
    return meshes;
}

function onMouseDown(e) {
    if (!state.isPointerLocked || state.isInventoryOpen || state.isSettingsOpen || state.isDead) return;
    if (e.button !== 0 && e.button !== 2) return;

    // Clic gauche : attaque d'abord
    if (e.button === 0 && state.attackCooldown <= 0) {
        const w = WEAPON_REGISTRY[state.equippedWeapon.key];
        const range = w ? w.range : 3;
        const pcx = Math.floor(player.position.x / CHUNK_SIZE);
        const pcz = Math.floor(player.position.z / CHUNK_SIZE);
        let closest = null, closestDist = range;
        const origin = camera.position;
        const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const chunk = state.chunks.get(chunkKey(pcx + dx, pcz + dz));
                if (!chunk) continue;
                for (const m of chunk.monsters) {
                    if (!m.group || m.state === 'dead') continue;
                    const wx = chunk.cx * CHUNK_SIZE + m.group.position.x;
                    const wz = chunk.cz * CHUNK_SIZE + m.group.position.z;
                    const wy = chunk.group.position.y + m.group.position.y;
                    const ddx = wx - origin.x, ddy = wy - origin.y, ddz = wz - origin.z;
                    const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
                    if (dist < closestDist) {
                        const dirTo = new THREE.Vector3(ddx, ddy, ddz).normalize();
                        if (dirTo.dot(camDir) > 0.6) {
                            closestDist = dist;
                            closest = m;
                        }
                    }
                }
            }
        }
        if (closest) { attackMonster(closest); return; }
    }

    // Raycast blocs
    raycaster.setFromCamera(screenCenter, camera);
    const meshes = getNearbyMeshes();
    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return;
    const hit = intersects[0];
    const mesh = hit.object;
    let gx, gy, gz;
    if (mesh.isInstancedMesh) {
        const instanceId = hit.instanceId;
        if (instanceId === undefined) return;
        const list = mesh.userData.blockList;
        if (!list || !list[instanceId]) return;
        const info = list[instanceId];
        if (info.gx === -99999) return;
        gx = info.gx; gy = info.y; gz = info.gz;
    } else {
        const ud = mesh.userData;
        if (!ud || !ud.type) return;
        gx = ud.gx; gy = ud.y; gz = ud.gz;
    }

    if (e.button === 0) {
        removeBlockGlobal(gx, gy, gz);
        playSound(180, 0.08, 'square', 0.04);
    } else if (e.button === 2) {
        const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
        normal.applyQuaternion(mesh.quaternion);
        const px = gx + Math.round(normal.x);
        const py = gy + Math.round(normal.y);
        const pz = gz + Math.round(normal.z);
        if (isSolidAt(px, py, pz)) return;
        const r = player.radius, h = player.height;
        if (px + 0.5 > player.position.x - r && px - 0.5 < player.position.x + r &&
            py + 0.5 > player.position.y - h && py - 0.5 < player.position.y + 0.1 &&
            pz + 0.5 > player.position.z - r && pz - 0.5 < player.position.z + r) return;
        setBlockGlobal(px, py, pz, state.selectedBlock);
        playSound(320, 0.06, 'triangle', 0.03);
    }
}

// ============================================================
// PHYSIQUE
// ============================================================
let playerUpdateAccum = 0;
const PLAYER_UPDATE_DT = 1 / 60;

function updatePlayer(delta) {
    playerUpdateAccum += delta;
    while (playerUpdateAccum >= PLAYER_UPDATE_DT) {
        stepPlayer(PLAYER_UPDATE_DT);
        playerUpdateAccum -= PLAYER_UPDATE_DT;
    }
    camera.position.copy(player.position);
}

function stepPlayer(dt) {
    const walkSpd = state.walkSpeed;
    const flySpd = state.flySpeed;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    const dir = new THREE.Vector3();
    if (keys['KeyW'] || keys['KeyZ']) dir.add(forward);
    if (keys['KeyS']) dir.sub(forward);
    if (keys['KeyA'] || keys['KeyQ']) dir.sub(right);
    if (keys['KeyD']) dir.add(right);
    if (dir.lengthSq() > 0) dir.normalize();

    const targetSpeed = state.isFlying ? flySpd : walkSpd;
    player.targetVel.x = dir.x * targetSpeed;
    player.targetVel.z = dir.z * targetSpeed;
    const accel = state.isFlying ? 15 : 20;
    player.velocity.x += (player.targetVel.x - player.velocity.x) * Math.min(1, accel * dt);
    player.velocity.z += (player.targetVel.z - player.velocity.z) * Math.min(1, accel * dt);

    if (state.isFlying) {
        const up = (keys['Space'] ? 1 : 0) - ((keys['ShiftLeft'] || keys['ShiftRight']) ? 1 : 0);
        const targetVY = up * flySpd;
        player.velocity.y += (targetVY - player.velocity.y) * Math.min(1, 15 * dt);
    } else {
        player.velocity.y -= GRAVITY * dt;
        if (keys['Space'] && player.onGround) {
            player.velocity.y = BASE_JUMP;
            player.onGround = false;
        }
    }

    const newPos = player.position.clone();
    newPos.x += player.velocity.x * dt;
    if (collidesAt(newPos)) { newPos.x = player.position.x; player.velocity.x = 0; }
    newPos.z += player.velocity.z * dt;
    if (collidesAt(newPos)) { newPos.z = player.position.z; player.velocity.z = 0; }
    newPos.y += player.velocity.y * dt;
    if (collidesAt(newPos)) {
        if (player.velocity.y < 0) {
            player.onGround = true;
            newPos.y = Math.ceil(newPos.y) + 0.001;
            if (collidesAt(newPos)) newPos.y = player.position.y;
        }
        player.velocity.y = 0;
    } else if (player.velocity.y < 0 && !state.isFlying) {
        player.onGround = false;
    }

    if (newPos.y < -20) {
        let sy = 60;
        while (sy > 0 && !isSolidAt(newPos.x, sy, newPos.z)) sy--;
        newPos.y = Math.max(sy + 2, 30);
        player.velocity.set(0, 0, 0);
    }
    player.position.copy(newPos);
}

// ============================================================
// BOUCLE
// ============================================================
let fpsFrames = 0, fpsTime = 0, minimapAccum = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (state.damageCooldown > 0) state.damageCooldown -= delta;
    if (state.attackCooldown > 0) state.attackCooldown -= delta;

    if (!state.isInventoryOpen && !state.isSettingsOpen && !state.isDead) {
        updatePlayer(delta);
    }

    updateChunks(delta);
    updateDayNight(delta);
    updateAnimals(delta);
    updateMonsters(delta);

    minimapAccum += delta;
    if (minimapAccum >= 0.1) {
        minimapAccum = 0;
        updateMinimap();
    }

    fpsFrames++;
    fpsTime += delta;
    if (fpsTime >= 0.5) {
        const fpsDisplay = Math.round(fpsFrames / fpsTime);
        fpsFrames = 0; fpsTime = 0;
        if (state.showFPS) document.getElementById('fps-counter').textContent = 'FPS : ' + fpsDisplay;
        document.getElementById('chunk-counter').textContent = 'Chunks : ' + state.chunks.size;
        document.getElementById('animal-counter').textContent = 'Animaux : ' + state.animalCount;
        document.getElementById('monster-counter').textContent = 'Monstres : ' + state.monsterCount;
    }

    if (state.shadows) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
}

// ============================================================
// LANCEMENT
// ============================================================
init();

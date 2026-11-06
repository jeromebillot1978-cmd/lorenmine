// script.js - Jeu Minecraft-like optimisé + mode survie
'use strict';

// =====================================================
// CONSTANTES GLOBALES
// =====================================================
const BLOCK_SIZE = 1;
const CHUNK_SIZE = 16;
const WORLD_RADIUS = 200;
const TERRAIN_SEED = 1337;
const SAVE_KEY = 'minecraft3d_opt_save';

const BLOCK_TYPES = {
    dirt:  { color: 0x8B5A2B, name: 'Terre', icon: '🌍' },
    grass: { color: 0x6AB04C, topColor: 0x7BC950, name: 'Herbe', icon: '🌿' },
    stone: { color: 0x808080, name: 'Pierre', icon: '🪨' },
    wood:  { color: 0xA0522D, name: 'Bois', icon: '🪵' },
    glass: { color: 0xB0E0FF, name: 'Verre', icon: '🔷', transparent: true }
};
const BLOCK_KEYS = Object.keys(BLOCK_TYPES);

// Vitesses de base
const BASE_WALK_SPEED = 5;
const BASE_FLY_SPEED = 14;
const BASE_JUMP = 8;
const GRAVITY = 25;

// =====================================================
// ÉTAT DU JEU
// =====================================================
const state = {
    selectedBlock: 'dirt',
    isFlying: true,
    isInventoryOpen: false,
    isSettingsOpen: false,
    isPointerLocked: false,

    walkSpeed: 5,
    flySpeed: 14,
    renderDistance: 128,
    maxAnimals: 16,
    maxMonsters: 8,
    quality: 'medium',
    shadows: true,
    cycleAuto: true,
    showFPS: true,
    survivalEnabled: true,

    dayTime: 0.25,
    chunks: new Map(),
    loadedChunks: new Set(),

    // Survie
    health: 20,
    maxHealth: 20,
    kills: 0,
    coins: 0,
    isDead: false,
    damageCooldown: 0,

    // Compteurs
    animalCount: 0,
    monsterCount: 0,

    // Mini-carte
    exploredChunks: new Set(),

    savedModifications: {},
};

// =====================================================
// VARIABLES THREE.JS
// =====================================================
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

// Audio
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

// =====================================================
// UTILITAIRES
// =====================================================
function chunkKey(cx, cz) { return cx + ',' + cz; }
function blockKey(x, y, z) { return x + ',' + y + ',' + z; }
function worldToChunk(x, z) {
    return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
}

// =====================================================
// INIT
// =====================================================
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
    setupSurvivalUI();
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

    animate();
}

// =====================================================
// ÉCLAIRAGE
// =====================================================
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

// =====================================================
// MATÉRIAUX
// =====================================================
function getMaterial(type) {
    if (materialCache[type]) return materialCache[type];
    const b = BLOCK_TYPES[type];
    let mat;
    if (type === 'grass') {
        const side = new THREE.MeshLambertMaterial({ color: b.color });
        const top = new THREE.MeshLambertMaterial({ color: b.topColor });
        mat = [side, side, top, side, side, side];
    } else if (type === 'glass') {
        mat = new THREE.MeshPhongMaterial({
            color: b.color, transparent: true, opacity: 0.6,
            shininess: 100, specular: 0x99ccff, depthWrite: false
        });
    } else {
        mat = new THREE.MeshLambertMaterial({ color: b.color });
    }
    materialCache[type] = mat;
    return mat;
}

// =====================================================
// BRUIT PROCÉDURAL
// =====================================================
function hash2(x, z, seed) {
    let h = (x | 0) * 374761393 + (z | 0) * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, z, seed) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const tl = hash2(xi, zi, seed);
    const tr = hash2(xi + 1, zi, seed);
    const bl = hash2(xi, zi + 1, seed);
    const br = hash2(xi + 1, zi + 1, seed);
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    return (tl * (1 - u) + tr * u) * (1 - v) + (bl * (1 - u) + br * u) * v;
}

function fbm(x, z, seed, octaves = 4) {
    let value = 0, amp = 1, freq = 1, total = 0;
    for (let i = 0; i < octaves; i++) {
        value += valueNoise(x * freq, z * freq, seed + i * 31) * amp;
        total += amp;
        amp *= 0.5;
        freq *= 2;
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
    const hillsFactor = fbm(x * 0.01, z * 0.01, TERRAIN_SEED + 900, 2);

    let height;
    switch (biome) {
        case 'plains': height = 4 + base * 4 + detail * 1.5; break;
        case 'forest': height = 5 + base * 6 + detail * 2; break;
        case 'hills': height = 6 + base * 12 + hillsFactor * 8 + detail * 2; break;
        case 'mountains': height = 10 + base * 22 + hillsFactor * 15 + detail * 3; break;
        default: height = 5 + base * 6;
    }
    return Math.max(1, Math.floor(height));
}

function isWaterAt(x, z, height) {
    const r = fbm(x * 0.015, z * 0.015, TERRAIN_SEED + 777, 3);
    return height <= 3 || (r < 0.32 && height < 6);
}

// =====================================================
// GÉNÉRATION CHUNKS
// =====================================================
function generateChunkData(cx, cz) {
    const blocks = {};
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const x = baseX + lx;
            const z = baseZ + lz;
            const h = getTerrainHeight(x, z);
            const water = isWaterAt(x, z, h);

            for (let y = 0; y <= h; y++) {
                let type;
                if (water && y === h) type = 'stone';
                else if (y === h) type = (h > 25 ? 'stone' : 'grass');
                else if (y >= h - 2) type = 'dirt';
                else type = 'stone';
                blocks[`${lx},${y},${lz}`] = type;
            }

            if (getBiome(x, z) === 'forest' && !water && h > 4 && h < 30) {
                if (hash2(x, z, TERRAIN_SEED + 9999) < 0.02) {
                    addTreeLocal(blocks, lx, h + 1, lz);
                }
            }
        }
    }

    // Appliquer modifications sauvegardées
    if (state.savedModifications) {
        for (const [gk, type] of Object.entries(state.savedModifications)) {
            const [x, y, z] = gk.split(',').map(Number);
            if (x >= baseX && x < baseX + CHUNK_SIZE && z >= baseZ && z < baseZ + CHUNK_SIZE) {
                const lk = `${x - baseX},${y},${z - baseZ}`;
                blocks[lk] = type;
            }
        }
    }
    return blocks;
}

function addTreeLocal(blocks, lx, ly, lz) {
    const trunkH = 3 + Math.floor(hash2(lx, lz, 42) * 3);
    for (let i = 0; i < trunkH; i++) {
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
            blocks[`${lx},${ly + i},${lz}`] = 'wood';
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
                        if (!blocks[k]) blocks[k] = 'grass';
                    }
                }
            }
        }
    }
}

// =====================================================
// CHARGEMENT CHUNKS
// =====================================================
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
        const useInstanced = !Array.isArray(material) && typeof THREE.InstancedMesh !== 'undefined';
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
                const gk = blockKey(gx, y, gz);
                blockMap[gk] = m;
                globalBlocks[gk] = type;
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
const CHUNK_UPDATE_INTERVAL = 0.15;

function updateChunks(delta) {
    lastChunkUpdate += delta;
    if (lastChunkUpdate < CHUNK_UPDATE_INTERVAL) return;
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
                const distSq = dx * dx + dz * dz;
                if (distSq <= radius * radius) {
                    loadChunk(cx, cz);
                    toLoad++;
                }
            }
        }
    }

    const unloadRadius = radius + 2;
    for (const [key, chunk] of Array.from(state.chunks.entries())) {
        const dx = chunk.cx - pcx;
        const dz = chunk.cz - pcz;
        if (dx * dx + dz * dz > unloadRadius * unloadRadius) {
            unloadChunk(chunk.cx, chunk.cz);
        }
    }
}

// =====================================================
// BLOCS
// =====================================================
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
    saveWorld();
    return true;
}

function removeBlockGlobal(gx, y, gz) {
    const [cx, cz] = worldToChunk(gx, gz);
    const chunk = state.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;

    const gk = blockKey(gx, y, gz);
    if (!chunk.globalBlocks[gk]) return false;

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

    saveWorld();
    return true;
}

function isSolidAt(wx, wy, wz) {
    const t = getBlockType(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    return t !== null;
}

function collidesAt(pos) {
    const r = player.radius;
    const h = player.height;
    const minX = Math.floor(pos.x - r);
    const maxX = Math.floor(pos.x + r);
    const minY = Math.floor(pos.y - h);
    const maxY = Math.floor(pos.y + 0.1);
    const minZ = Math.floor(pos.z - r);
    const maxZ = Math.floor(pos.z + r);

    for (let bx = minX; bx <= maxX; bx++) {
        for (let by = minY; by <= maxY; by++) {
            for (let bz = minZ; bz <= maxZ; bz++) {
                if (isSolidAt(bx, by, bz)) {
                    if (pos.x + r > bx - 0.5 && pos.x - r < bx + 0.5 &&
                        pos.y > by - 0.5 && pos.y - h < by + 0.5 &&
                        pos.z + r > bz - 0.5 && pos.z - r < bz + 0.5) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

// =====================================================
// ANIMAUX
// =====================================================
const ANIMAL_TYPES = {
    sheep: { body: 0xF5F5F5, head: 0xE8E8E8, size: 0.7, sound: 600 },
    cow:   { body: 0x6B4423, head: 0x8B5A2B, size: 0.8, sound: 400 },
    pig:   { body: 0xF5A3A3, head: 0xF08080, size: 0.7, sound: 350 },
    chicken: { body: 0xFFFFFF, head: 0xFFFFAA, size: 0.5, sound: 900 }
};

let animalTemplateCache = {};

function getAnimalTemplate(type) {
    if (animalTemplateCache[type]) return animalTemplateCache[type];
    const t = ANIMAL_TYPES[type];
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(t.size * 1.4, t.size * 0.8, t.size * 0.8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: t.body });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = state.shadows;
    body.position.y = t.size * 0.6;
    group.add(body);

    const headGeo = new THREE.BoxGeometry(t.size * 0.6, t.size * 0.6, t.size * 0.6);
    const headMat = new THREE.MeshLambertMaterial({ color: t.head });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = state.shadows;
    head.position.set(t.size * 0.85, t.size * 0.85, 0);
    group.add(head);

    const legGeo = new THREE.BoxGeometry(t.size * 0.2, t.size * 0.5, t.size * 0.2);
    const legMat = new THREE.MeshLambertMaterial({ color: t.head });
    const legPositions = [
        [-t.size * 0.5, t.size * 0.25, -t.size * 0.3],
        [-t.size * 0.5, t.size * 0.25, t.size * 0.3],
        [t.size * 0.5, t.size * 0.25, -t.size * 0.3],
        [t.size * 0.5, t.size * 0.25, t.size * 0.3]
    ];
    legPositions.forEach(p => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(...p);
        leg.castShadow = state.shadows;
        group.add(leg);
    });

    group.visible = false;
    animalTemplateCache[type] = group;
    return group;
}

function spawnAnimalInChunk(chunk) {
    if (state.maxAnimals <= 0) return;
    if (chunk.animals.length > 6) return;

    const types = Object.keys(ANIMAL_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];

    const localX = Math.floor(Math.random() * CHUNK_SIZE);
    const localZ = Math.floor(Math.random() * CHUNK_SIZE);
    const gx = chunk.cx * CHUNK_SIZE + localX;
    const gz = chunk.cz * CHUNK_SIZE + localZ;

    let topY = 40;
    while (topY > 0 && !isSolidAt(gx, topY, gz)) topY--;
    if (topY < 2) return;

    const group = getAnimalTemplate(type).clone();
    group.visible = true;
    group.position.set(localX, topY + 1, localZ);
    chunk.group.add(group);

    chunk.animals.push({
        group, type, state: 'idle',
        timer: 1 + Math.random() * 3,
        direction: new THREE.Vector3(),
        speed: 1.2, soundTimer: 5 + Math.random() * 10,
        walkPhase: 0,
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
                        const angle = Math.random() * Math.PI * 2;
                        a.direction.set(Math.cos(angle), 0, Math.sin(angle));
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

// =====================================================
// MONSTRES
// =====================================================
const MONSTER_TYPES = {
    slime:   { color: 0x66DD66, size: 0.8, hp: 4, damage: 2, speed: 1.8, xp: 1, icon: '🟢' },
    zombie:  { color: 0x558855, size: 0.9, hp: 8, damage: 3, speed: 1.4, xp: 2, icon: '🧟' },
    spider:  { color: 0x333333, size: 0.7, hp: 6, damage: 2, speed: 2.2, xp: 2, icon: '🕷️' },
    golem:   { color: 0x777777, size: 1.2, hp: 15, damage: 5, speed: 1.0, xp: 4, icon: '🗿' }
};

let monsterTemplateCache = {};

function getMonsterTemplate(type) {
    if (monsterTemplateCache[type]) return monsterTemplateCache[type];
    const t = MONSTER_TYPES[type];
    const group = new THREE.Group();

    // Corps
    const bodyGeo = new THREE.BoxGeometry(t.size * 0.9, t.size * 1.1, t.size * 0.7);
    const bodyMat = new THREE.MeshLambertMaterial({ color: t.color, emissive: 0x220000 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = state.shadows;
    body.position.y = t.size * 0.9;
    group.add(body);

    // Tête
    const headGeo = new THREE.BoxGeometry(t.size * 0.7, t.size * 0.7, t.size * 0.7);
    const headMat = new THREE.MeshLambertMaterial({ color: t.color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = state.shadows;
    head.position.y = t.size * 1.75;
    group.add(head);

    // Yeux rouges
    const eyeGeo = new THREE.BoxGeometry(t.size * 0.15, t.size * 0.15, t.size * 0.05);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-t.size * 0.18, t.size * 1.85, t.size * 0.36);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(t.size * 0.18, t.size * 1.85, t.size * 0.36);
    group.add(eyeR);

    // Bras
    const armGeo = new THREE.BoxGeometry(t.size * 0.25, t.size * 0.7, t.size * 0.25);
    const armMat = new THREE.MeshLambertMaterial({ color: t.color });
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-t.size * 0.55, t.size * 1.0, 0);
    group.add(armL);
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(t.size * 0.55, t.size * 1.0, 0);
    group.add(armR);

    group.visible = false;
    monsterTemplateCache[type] = group;
    return group;
}

function spawnMonsterInChunk(chunk) {
    if (state.maxMonsters <= 0) return;
    if (chunk.monsters.length > 5) return;

    // Nuit = plus de monstres
    const isNight = state.dayTime < 0.25 || state.dayTime > 0.75;
    if (!isNight && Math.random() > 0.3) return;

    const types = Object.keys(MONSTER_TYPES);
    // Nuit = variété plus dangereuse
    let type = types[Math.floor(Math.random() * types.length)];
    if (!isNight && (type === 'golem' || type === 'spider')) {
        type = 'slime';
    }

    const localX = Math.floor(Math.random() * CHUNK_SIZE);
    const localZ = Math.floor(Math.random() * CHUNK_SIZE);
    const gx = chunk.cx * CHUNK_SIZE + localX;
    const gz = chunk.cz * CHUNK_SIZE + localZ;

    let topY = 40;
    while (topY > 0 && !isSolidAt(gx, topY, gz)) topY--;
    if (topY < 2) return;

    const group = getMonsterTemplate(type).clone();
    group.visible = true;
    group.position.set(localX, topY + 1, localZ);
    chunk.group.add(group);

    const data = MONSTER_TYPES[type];
    chunk.monsters.push({
        group, type,
        hp: data.hp, maxHp: data.hp,
        damage: data.damage, speed: data.speed,
        direction: new THREE.Vector3(),
        attackCooldown: 0,
        walkPhase: 0,
        state: 'idle',
        timer: 1 + Math.random() * 2,
    });
}

function damagePlayer(amount) {
    if (state.damageCooldown > 0 || state.isDead || !state.survivalEnabled) return;
    state.health = Math.max(0, state.health - amount);
    state.damageCooldown = 0.8;
    showFloatingMessage(`-${amount} ❤️`, 'damage');
    playSound(150, 0.15, 'sawtooth', 0.05);
    updateHealthUI();

    if (state.health <= 0) {
        triggerGameOver();
    }
}

function attackMonster(monster) {
    // Dégâts de base selon le bloc tenu
    let dmg = 3;
    if (state.selectedBlock === 'stone') dmg = 5;
    else if (state.selectedBlock === 'wood') dmg = 4;
    else if (state.selectedBlock === 'glass') dmg = 2;

    monster.hp -= dmg;

    // Effet visuel : flash rouge
    if (monster.group) {
        monster.group.children.forEach(c => {
            if (c.material && c.material.emissive) {
                const old = c.material.emissive.getHex();
                c.material.emissive.setHex(0xff0000);
                setTimeout(() => { if (c.material) c.material.emissive.setHex(old); }, 100);
            }
        });
    }

    playSound(250, 0.08, 'square', 0.04);
    showFloatingMessage(`-${dmg}`, 'hit');

    if (monster.hp <= 0) {
        killMonster(monster);
    }
}

function killMonster(monster) {
    const data = MONSTER_TYPES[monster.type];
    state.kills++;
    document.getElementById('kills-value').textContent = state.kills;

    // Butin
    const coinsGain = Math.floor(1 + Math.random() * 4) * data.xp;
    state.coins += coinsGain;
    document.getElementById('coins-value').textContent = state.coins;
    showFloatingMessage(`+${coinsGain} 🪙`, 'loot');
    playSound(700, 0.12, 'sine', 0.04);

    // Rare loot
    if (Math.random() < 0.15) {
        showFloatingMessage('✨ Objet rare !', 'loot');
        state.coins += 5;
    }

    // Retirer le mesh
    if (monster.group && monster.group.parent) {
        monster.group.parent.remove(monster.group);
    }
    monster.group = null;
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

            // Apparition
            chunk.monsterCountdown -= delta;
            if (chunk.monsterCountdown <= 0 && total < state.maxMonsters) {
                chunk.monsterCountdown = (isNight ? 4 : 12) + Math.random() * 10;
                spawnMonsterInChunk(chunk);
            }

            for (let i = chunk.monsters.length - 1; i >= 0; i--) {
                const m = chunk.monsters[i];
                if (!m.group) {
                    chunk.monsters.splice(i, 1);
                    continue;
                }
                total++;

                // Position monde du monstre
                const wx = chunk.cx * CHUNK_SIZE + m.group.position.x;
                const wz = chunk.cz * CHUNK_SIZE + m.group.position.z;
                const wy = m.group.position.y;

                const dxp = player.position.x - wx;
                const dzp = player.position.z - wz;
                const dyp = player.position.y - wy;
                const distSq = dxp * dxp + dzp * dzp;
                const detectRange = 12;

                m.attackCooldown -= delta;
                m.timer -= delta;

                if (distSq < detectRange * detectRange && Math.abs(dyp) < 8) {
                    // Poursuite
                    const dist = Math.sqrt(distSq);
                    if (dist > 1.2) {
                        const dirX = dxp / dist;
                        const dirZ = dzp / dist;
                        const step = m.speed * delta;
                        const nx = m.group.position.x + dirX * step;
                        const nz = m.group.position.z + dirZ * step;
                        const gx = chunk.cx * CHUNK_SIZE + nx;
                        const gz = chunk.cz * CHUNK_SIZE + nz;
                        const gy = Math.floor(m.group.position.y - 0.5);
                        if (!isSolidAt(gx, gy + 1, gz)) {
                            if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                                m.group.position.x = nx;
                                m.group.position.z = nz;
                            } else {
                                // Transition de chunk : simple téléportation latérale
                                m.group.position.x = Math.max(0.5, Math.min(CHUNK_SIZE - 0.5, nx));
                                m.group.position.z = Math.max(0.5, Math.min(CHUNK_SIZE - 0.5, nz));
                            }
                        }
                        m.group.rotation.y = Math.atan2(dirX, dirZ);
                        m.walkPhase += delta * 6;
                        m.group.position.y += Math.sin(m.walkPhase) * 0.01;
                    } else {
                        // Attaque
                        if (m.attackCooldown <= 0) {
                            m.attackCooldown = 1.0;
                            damagePlayer(m.damage);
                        }
                    }
                    m.state = 'chase';
                } else {
                    // Errance
                    if (m.timer <= 0) {
                        m.timer = 2 + Math.random() * 3;
                        if (Math.random() < 0.5) {
                            m.state = 'idle';
                            m.direction.set(0, 0, 0);
                        } else {
                            m.state = 'walk';
                            const a = Math.random() * Math.PI * 2;
                            m.direction.set(Math.cos(a), 0, Math.sin(a));
                        }
                    }
                    if (m.state === 'walk') {
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
            }
        }
    }
    state.monsterCount = total;
}

// =====================================================
// INTERFACE
// =====================================================
function setupUI() {
    const hotbar = document.getElementById('hotbar');
    const invGrid = document.getElementById('inventory-grid');

    BLOCK_KEYS.forEach((key, index) => {
        const b = BLOCK_TYPES[key];
        const slot = document.createElement('div');
        slot.className = 'hotbar-slot';
        slot.dataset.block = key;
        slot.title = b.name;
        slot.innerHTML = `<span class="num">${index + 1}</span><span class="icon">${b.icon}</span><span>${b.name}</span>`;
        slot.addEventListener('click', (e) => { e.stopPropagation(); selectBlock(key); });
        hotbar.appendChild(slot);

        const islot = document.createElement('div');
        islot.className = 'inventory-slot';
        islot.dataset.block = key;
        islot.innerHTML = `<span class="icon">${b.icon}</span><span>${b.name}</span>`;
        islot.addEventListener('click', (e) => { e.stopPropagation(); selectBlock(key); });
        invGrid.appendChild(islot);
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
    const speedWalk = document.getElementById('speed-walk');
    const speedWalkVal = document.getElementById('speed-walk-val');
    speedWalk.addEventListener('input', (e) => {
        state.walkSpeed = parseInt(e.target.value);
        speedWalkVal.textContent = state.walkSpeed;
        updateSpeedUI();
        saveSettings();
    });

    const speedFly = document.getElementById('speed-fly');
    const speedFlyVal = document.getElementById('speed-fly-val');
    speedFly.addEventListener('input', (e) => {
        state.flySpeed = parseInt(e.target.value);
        speedFlyVal.textContent = state.flySpeed;
        updateSpeedUI();
        saveSettings();
    });

    const renderDist = document.getElementById('render-distance');
    const renderDistVal = document.getElementById('render-distance-val');
    renderDist.addEventListener('input', (e) => {
        state.renderDistance = parseInt(e.target.value);
        renderDistVal.textContent = state.renderDistance;
        scene.fog.far = state.renderDistance;
        camera.far = state.renderDistance * 2;
        camera.updateProjectionMatrix();
        saveSettings();
    });

    const maxAnimals = document.getElementById('max-animals');
    const maxAnimalsVal = document.getElementById('max-animals-val');
    maxAnimals.addEventListener('input', (e) => {
        state.maxAnimals = parseInt(e.target.value);
        maxAnimalsVal.textContent = state.maxAnimals;
        saveSettings();
    });

    const maxMonsters = document.getElementById('max-monsters');
    const maxMonstersVal = document.getElementById('max-monsters-val');
    maxMonsters.addEventListener('input', (e) => {
        state.maxMonsters = parseInt(e.target.value);
        maxMonstersVal.textContent = state.maxMonsters;
        saveSettings();
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

function setupSurvivalUI() {
    // Rien de dynamique ici, les éléments sont dans le HTML
    updateHealthUI();
}

function selectBlock(key) {
    if (!BLOCK_TYPES[key]) return;
    state.selectedBlock = key;
    updateSelectedBlockUI();
    saveSettings();
    playSound(500, 0.05, 'square', 0.02);
}

function updateSelectedBlockUI() {
    const b = BLOCK_TYPES[state.selectedBlock];
    document.getElementById('selected-block-name').textContent = `${b.icon} ${b.name}`;
    document.querySelectorAll('.hotbar-slot').forEach(s => {
        s.classList.toggle('active', s.dataset.block === state.selectedBlock);
    });
    document.querySelectorAll('.inventory-slot').forEach(s => {
        s.classList.toggle('selected', s.dataset.block === state.selectedBlock);
    });
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
    // 0 = minuit, 0.5 = midi
    const totalMin = Math.floor(state.dayTime * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const el = document.getElementById('time-value');
    if (el) el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function showFloatingMessage(text, cls) {
    const container = document.getElementById('floating-messages');
    const el = document.createElement('div');
    el.className = 'float-msg ' + (cls || '');
    el.textContent = text;
    // Position autour du centre
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.random() * 80;
    el.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
    el.style.top = `calc(50% + ${Math.sin(angle) * radius - 40}px)`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

// =====================================================
// MINI-CARTE
// =====================================================
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const MINIMAP_SIZE = 180;
const MINIMAP_RANGE = 96; // blocs affichés

function updateMinimap() {
    const ctx = minimapCtx;
    const size = MINIMAP_SIZE;
    const half = size / 2;
    const px = player.position.x;
    const pz = player.position.z;
    const scale = size / (MINIMAP_RANGE * 2);

    // Fond
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, size, size);

    // Grille de chunks explorés
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const chunkRange = Math.ceil(MINIMAP_RANGE / CHUNK_SIZE) + 1;

    for (let dx = -chunkRange; dx <= chunkRange; dx++) {
        for (let dz = -chunkRange; dz <= chunkRange; dz++) {
            const cx = pcx + dx, cz = pcz + dz;
            const ckey = chunkKey(cx, cz);
            if (!state.exploredChunks.has(ckey)) continue;

            // Distance au joueur
            const centerX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
            const centerZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
            const sX = half + (centerX - px) * scale;
            const sZ = half + (centerZ - pz) * scale;

            // Couleur selon biome
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

    // Arbres (bois) visibles
    ctx.fillStyle = '#8B4513';
    for (let dx = -chunkRange; dx <= chunkRange; dx++) {
        for (let dz = -chunkRange; dz <= chunkRange; dz++) {
            const chunk = state.chunks.get(chunkKey(pcx + dx, pcz + dz));
            if (!chunk) continue;
            // Parcourir rapidement les blocs de bois
            for (const [gk, type] of Object.entries(chunk.globalBlocks)) {
                if (type !== 'wood') continue;
                const [bx, by, bz] = gk.split(',').map(Number);
                const sX = half + (bx - px) * scale;
                const sZ = half + (bz - pz) * scale;
                ctx.fillRect(sX, sZ, 1.5, 1.5);
            }
        }
    }

    // Monstres (rouge)
    ctx.fillStyle = '#ff3333';
    for (const chunk of state.chunks.values()) {
        for (const m of chunk.monsters) {
            if (!m.group) continue;
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

    // Limites du monde
    const worldLimit = WORLD_RADIUS;
    const drawLimit = (wx, wz, sideX, sideZ) => {
        const sX = half + (wx - px) * scale;
        const sZ = half + (wz - pz) * scale;
        // Simple: on dessine les bords si visibles
        if (sX > 0 && sX < size) {
            ctx.fillStyle = 'rgba(255, 60, 60, 0.7)';
            ctx.fillRect(sX - 1, Math.max(0, sZ - 100), 2, 200);
        }
    };
    // Bordure du monde
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        half + (-worldLimit - px) * scale,
        half + (-worldLimit - pz) * scale,
        (worldLimit * 2) * scale,
        (worldLimit * 2) * scale
    );

    // Joueur (flèche jaune)
    ctx.save();
    ctx.translate(half, half);
    // Direction de la caméra
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const angle = Math.atan2(dir.x, dir.z);
    ctx.rotate(angle);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(-6, 6);
    ctx.lineTo(6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Coordonnées
    document.getElementById('minimap-coords').textContent =
        `${Math.round(px)}, ${Math.round(player.position.y)}, ${Math.round(pz)}`;
}

// =====================================================
// GAME OVER
// =====================================================
function triggerGameOver() {
    if (state.isDead) return;
    state.isDead = true;
    document.exitPointerLock();
    const go = document.getElementById('game-over');
    go.classList.add('open');
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

    // Repositionner
    const topY = findGroundY(player.position.x, player.position.z);
    player.position.set(player.position.x, topY + 3, player.position.z);
    player.velocity.set(0, 0, 0);
    camera.position.copy(player.position);
}

function findGroundY(x, z) {
    let y = 60;
    while (y > 0 && !isSolidAt(x, y, z)) y--;
    return Math.max(y, 1);
}

// =====================================================
// TEMPS
// =====================================================
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

// =====================================================
// SAUVEGARDE
// =====================================================
function saveSettings() {
    try {
        const data = {
            v: 4,
            settings: {
                walkSpeed: state.walkSpeed,
                flySpeed: state.flySpeed,
                renderDistance: state.renderDistance,
                maxAnimals: state.maxAnimals,
                maxMonsters: state.maxMonsters,
                quality: state.quality,
                shadows: state.shadows,
                cycleAuto: state.cycleAuto,
                showFPS: state.showFPS,
                survivalEnabled: state.survivalEnabled,
                dayTime: state.dayTime,
            },
            player: {
                x: player.position.x, y: player.position.y, z: player.position.z,
                isFlying: state.isFlying,
                selectedBlock: state.selectedBlock,
            },
            survival: {
                health: state.health,
                kills: state.kills,
                coins: state.coins,
            }
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
}

let saveTimeout = null;
function saveWorld() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveWorldNow, 600);
}

function saveWorldNow() {
    try {
        const modifications = {};
        for (const chunk of state.chunks.values()) {
            for (const [gk, type] of Object.entries(chunk.globalBlocks)) {
                modifications[gk] = type;
            }
        }
        localStorage.setItem(SAVE_KEY + '_world', JSON.stringify({
            v: 4, savedAt: Date.now(), modifications
        }));
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

        try {
            const worldRaw = localStorage.getItem(SAVE_KEY + '_world');
            if (worldRaw) {
                const worldData = JSON.parse(worldRaw);
                state.savedModifications = worldData.modifications || {};
            }
        } catch (e) { state.savedModifications = {}; }

        return true;
    } catch (e) {
        return false;
    }
}

function resetWorld() {
    if (!confirm('Réinitialiser le monde ? Cette action est irréversible.')) return;
    try {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(SAVE_KEY + '_world');
    } catch (e) {}
    state.savedModifications = {};

    for (const chunk of Array.from(state.chunks.values())) {
        unloadChunk(chunk.cx, chunk.cz);
    }
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

// =====================================================
// QUALITÉ
// =====================================================
function setQuality(q) {
    state.quality = q;
    let scale = 1;
    if (q === 'low') {
        scale = 0.6;
        shadowMapSize = 512;
        state.renderDistance = Math.min(state.renderDistance, 96);
    } else if (q === 'medium') {
        scale = 1;
        shadowMapSize = 1024;
    } else if (q === 'high') {
        scale = Math.min(window.devicePixelRatio, 2);
        shadowMapSize = 2048;
    }
    renderer.setPixelRatio(scale);
    sunLight.shadow.mapSize.width = shadowMapSize;
    sunLight.shadow.mapSize.height = shadowMapSize;
    if (sunLight.shadow.map) {
        sunLight.shadow.map.dispose();
        sunLight.shadow.map = null;
    }
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

// =====================================================
// PANNEAUX
// =====================================================
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

// =====================================================
// ÉVÉNEMENTS
// =====================================================
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
    if (e.code === 'Escape') {
        if (state.isInventoryOpen) toggleInventory(false);
        if (state.isSettingsOpen) closeSettings();
        return;
    }
    if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.slice(5));
        if (num >= 1 && num <= BLOCK_KEYS.length) selectBlock(BLOCK_KEYS[num - 1]);
    }
}

function onKeyUp(e) {
    keys[e.code] = false;
}

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

    raycaster.setFromCamera(screenCenter, camera);

    // Priorité 1 : attaque si clic gauche et monstre devant
    if (e.button === 0) {
        const pcx = Math.floor(player.position.x / CHUNK_SIZE);
        const pcz = Math.floor(player.position.z / CHUNK_SIZE);
        let closestMonster = null;
        let closestDist = 3.5; // portée d'attaque
        const origin = camera.position;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const chunk = state.chunks.get(chunkKey(pcx + dx, pcz + dz));
                if (!chunk) continue;
                for (const m of chunk.monsters) {
                    if (!m.group) continue;
                    const wx = chunk.cx * CHUNK_SIZE + m.group.position.x;
                    const wz = chunk.cz * CHUNK_SIZE + m.group.position.z;
                    const wy = chunk.group.position.y + m.group.position.y;
                    const ddx = wx - origin.x;
                    const ddy = wy - origin.y;
                    const ddz = wz - origin.z;
                    const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
                    if (dist < closestDist) {
                        // Vérifier que le monstre est bien devant la caméra
                        const dirTo = new THREE.Vector3(ddx, ddy, ddz).normalize();
                        const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                        if (dirTo.dot(camDir) > 0.7) {
                            closestDist = dist;
                            closestMonster = m;
                        }
                    }
                }
            }
        }

        if (closestMonster) {
            attackMonster(closestMonster);
            return;
        }
    }

    // Sinon : raycast sur les blocs
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

// =====================================================
// PHYSIQUE
// =====================================================
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

// =====================================================
// BOUCLE PRINCIPALE
// =====================================================
let fpsFrames = 0;
let fpsTime = 0;
let minimapAccum = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    // Cooldown dégâts
    if (state.damageCooldown > 0) state.damageCooldown -= delta;

    if (!state.isInventoryOpen && !state.isSettingsOpen && !state.isDead) {
        updatePlayer(delta);
    }

    updateChunks(delta);
    updateDayNight(delta);
    updateAnimals(delta);
    updateMonsters(delta);

    // Mini-carte (10 fps suffisant)
    minimapAccum += delta;
    if (minimapAccum >= 0.1) {
        minimapAccum = 0;
        updateMinimap();
    }

    // FPS
    fpsFrames++;
    fpsTime += delta;
    if (fpsTime >= 0.5) {
        const fpsDisplay = Math.round(fpsFrames / fpsTime);
        fpsFrames = 0;
        fpsTime = 0;
        if (state.showFPS) {
            document.getElementById('fps-counter').textContent = 'FPS : ' + fpsDisplay;
        }
        document.getElementById('chunk-counter').textContent = 'Chunks : ' + state.chunks.size;
        document.getElementById('animal-counter').textContent = 'Animaux : ' + state.animalCount;
        document.getElementById('monster-counter').textContent = 'Monstres : ' + state.monsterCount;
    }

    if (state.shadows) renderer.shadowMap.needsUpdate = true;

    renderer.render(scene, camera);
}

// =====================================================
// LANCEMENT
// =====================================================
init();

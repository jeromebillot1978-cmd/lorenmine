// script.js - Jeu Minecraft 3D - Version améliorée

// =====================================================
// CONSTANTES & ÉTAT GLOBAL
// =====================================================
const BLOCK_SIZE = 1;
const WORLD_SIZE = 60;          // Rayon du monde (donc 121x121)
const CHUNK_SIZE = 16;           // Pour l'optimisation (culling)
const TERRAIN_SEED = 1337;

const BLOCK_TYPES = {
    dirt:  { color: 0x8B5A2B, name: 'Terre', icon: '🌍' },
    grass: { color: 0x4CAF50, topColor: 0x66BB6A, name: 'Herbe', icon: '🌿' },
    stone: { color: 0x808080, name: 'Pierre', icon: '🪨' },
    wood:  { color: 0xA0522D, name: 'Bois', icon: '🪵' },
    glass: { color: 0xADD8E6, name: 'Verre', icon: '🔷', transparent: true }
};

const BLOCK_KEYS = Object.keys(BLOCK_TYPES);

// État du jeu
const state = {
    selectedBlockType: 'dirt',
    isFlying: true,
    isInventoryOpen: false,
    isSettingsOpen: false,
    isPointerLocked: false,
    speedMultiplier: 1.0,
    renderDistance: 100,
    cycleAuto: true,
    dayTime: 0.25,               // 0..1 (0 = minuit, 0.5 = midi)
    world: {},                   // clé "x,y,z" -> mesh
    blockList: [],               // pour raycasting rapide
};

// Vitesses de base
const BASE_WALK_SPEED = 5;
const BASE_FLY_SPEED = 14;
const BASE_JUMP = 8;
const GRAVITY = 25;

// =====================================================
// VARIABLES THREE.JS
// =====================================================
let scene, camera, renderer, clock;
let sunLight, ambientLight, hemiLight;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

// Joueur
const player = {
    position: new THREE.Vector3(0, 20, 0),
    velocity: new THREE.Vector3(),
    onGround: false,
    height: 1.7,
    radius: 0.4,
    targetVelocity: new THREE.Vector3(), // pour accélération
};

// Clavier
const keys = {};

// Geometries et matériaux partagés (optimisation)
let sharedGeometry;
const materialCache = {};

// =====================================================
// INITIALISATION
// =====================================================
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 40, state.renderDistance);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.copy(player.position);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    sharedGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    setupLighting();
    setupUI();
    setupEventListeners();

    // Chargement de la sauvegarde
    const loaded = loadSave();
    if (!loaded) {
        generateTerrain();
    }

    // Position initiale sûre
    if (!loaded) {
        let topY = 20;
        while (topY > 0 && !state.world[`0,${topY},0`]) topY--;
        player.position.set(0.5, topY + 2, 0.5);
        camera.position.copy(player.position);
    }

    updateModeUI();
    updateSpeedUI();
    updateTimeUI();

    animate();
}

// =====================================================
// ÉCLAIRAGE
// =====================================================
function setupLighting() {
    ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.4);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -80;
    sunLight.shadow.camera.right = 80;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    scene.add(sunLight.target);
}

// =====================================================
// UI (création dynamique de l'inventaire & hotbar)
// =====================================================
function setupUI() {
    const hotbar = document.getElementById('hotbar');
    const invGrid = document.getElementById('inventory-grid');

    BLOCK_KEYS.forEach((key, index) => {
        const b = BLOCK_TYPES[key];

        // Hotbar slot
        const slot = document.createElement('div');
        slot.className = 'hotbar-slot';
        slot.dataset.block = key;
        slot.title = `${b.name} (raccourci ${index + 1})`;
        slot.innerHTML = `<span class="icon">${b.icon}</span><span>${b.name}</span>`;
        slot.addEventListener('click', (e) => {
            e.stopPropagation();
            selectBlock(key);
        });
        hotbar.appendChild(slot);

        // Inventory slot
        const islot = document.createElement('div');
        islot.className = 'inventory-slot';
        islot.dataset.block = key;
        islot.innerHTML = `<span class="icon">${b.icon}</span><span>${b.name}</span>`;
        islot.addEventListener('click', (e) => {
            e.stopPropagation();
            selectBlock(key);
        });
        invGrid.appendChild(islot);
    });

    // Boutons
    document.getElementById('btn-day').addEventListener('click', () => setTime(0.5));
    document.getElementById('btn-night').addEventListener('click', () => setTime(0.0));
    document.getElementById('btn-cycle').addEventListener('click', toggleCycle);
    document.getElementById('btn-settings').addEventListener('click', toggleSettings);
    document.getElementById('btn-close-settings').addEventListener('click', () => closeSettings());
    document.getElementById('btn-reset-world').addEventListener('click', resetWorld);

    // Sliders
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-slider-value');
    speedSlider.addEventListener('input', (e) => {
        state.speedMultiplier = parseFloat(e.target.value);
        speedVal.textContent = state.speedMultiplier.toFixed(1) + 'x';
        updateSpeedUI();
        saveSettings();
    });

    const renderSlider = document.getElementById('render-distance');
    const renderVal = document.getElementById('render-distance-value');
    renderSlider.addEventListener('input', (e) => {
        state.renderDistance = parseInt(e.target.value);
        renderVal.textContent = state.renderDistance;
        scene.fog.far = state.renderDistance;
        camera.far = state.renderDistance * 2;
        camera.updateProjectionMatrix();
        saveSettings();
    });

    const chkCycle = document.getElementById('chk-cycle');
    chkCycle.addEventListener('change', (e) => {
        state.cycleAuto = e.target.checked;
        updateCycleButtonUI();
        saveSettings();
    });
}

function selectBlock(key) {
    if (!BLOCK_TYPES[key]) return;
    state.selectedBlockType = key;
    updateSelectedBlockUI();
    saveSettings();
}

function updateSelectedBlockUI() {
    const b = BLOCK_TYPES[state.selectedBlockType];
    document.getElementById('selected-block-name').textContent = `${b.icon} ${b.name}`;

    document.querySelectorAll('.hotbar-slot').forEach(slot => {
        slot.classList.toggle('active', slot.dataset.block === state.selectedBlockType);
    });
    document.querySelectorAll('.inventory-slot').forEach(slot => {
        slot.classList.toggle('selected', slot.dataset.block === state.selectedBlockType);
    });
}

function updateModeUI() {
    const el = document.getElementById('mode-indicator');
    el.textContent = state.isFlying ? 'Mode : Vol ✈️' : 'Mode : Marche 🚶';
    el.style.borderColor = state.isFlying ? '#FFD700' : '#4CAF50';
}

function updateSpeedUI() {
    document.getElementById('speed-value').textContent = state.speedMultiplier.toFixed(1);
}

function updateCycleButtonUI() {
    document.getElementById('btn-cycle').classList.toggle('active', state.cycleAuto);
}

function updateTimeUI() {
    const h = Math.floor(((state.dayTime + 0.25) % 1) * 24);
    const m = Math.floor((((state.dayTime + 0.25) % 1) * 24 - h) * 60);
    // mettre à jour l'indicateur si nécessaire — ici on le garde minimal
    void h; void m;
}

function toggleInventory(force) {
    const inv = document.getElementById('inventory');
    const overlay = document.getElementById('overlay');
    const open = force !== undefined ? force : !state.isInventoryOpen;

    state.isInventoryOpen = open;
    inv.classList.toggle('open', open);

    if (open) {
        if (state.isSettingsOpen) closeSettings();
        document.exitPointerLock();
        overlay.classList.add('active');
    } else {
        if (!state.isSettingsOpen) overlay.classList.remove('active');
    }
}

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('overlay');
    const open = !state.isSettingsOpen;

    if (open) {
        if (state.isInventoryOpen) toggleInventory(false);
        state.isSettingsOpen = true;
        panel.classList.add('open');
        overlay.classList.add('active');
        document.exitPointerLock();

        // Sync UI
        document.getElementById('speed-slider').value = state.speedMultiplier;
        document.getElementById('speed-slider-value').textContent = state.speedMultiplier.toFixed(1) + 'x';
        document.getElementById('render-distance').value = state.renderDistance;
        document.getElementById('render-distance-value').textContent = state.renderDistance;
        document.getElementById('chk-cycle').checked = state.cycleAuto;
    } else {
        closeSettings();
    }
}

function closeSettings() {
    state.isSettingsOpen = false;
    document.getElementById('settings-panel').classList.remove('open');
    if (!state.isInventoryOpen) {
        document.getElementById('overlay').classList.remove('active');
    }
}

// =====================================================
// TEMPS / CYCLE JOUR-NUIT
// =====================================================
function setTime(t) {
    state.dayTime = ((t % 1) + 1) % 1;
    updateTimeUI();
    saveSettings();
}

function toggleCycle() {
    state.cycleAuto = !state.cycleAuto;
    updateCycleButtonUI();
    saveSettings();
}

function updateDayNightCycle(delta) {
    if (state.cycleAuto) {
        // Un jour complet en 180 secondes
        state.dayTime = (state.dayTime + delta / 180) % 1;
    }

    // angle 0.25 = aube, 0.5 = midi, 0.75 = crépuscule, 0 = minuit
    const angle = (state.dayTime - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(angle); // -1..1

    // Position du soleil
    const distance = 80;
    sunLight.position.set(
        Math.cos(angle) * distance,
        sunHeight * distance,
        Math.sin(angle * 0.5) * 30
    );
    sunLight.target.position.set(player.position.x, player.position.y - 5, player.position.z);
    sunLight.target.updateMatrixWorld();

    // Intensité
    const dayFactor = Math.max(0, sunHeight);
    sunLight.intensity = 0.15 + dayFactor * 1.2;
    sunLight.color.setHSL(0.1, 0.4 * (1 - dayFactor), 0.5 + dayFactor * 0.5);

    ambientLight.intensity = 0.15 + dayFactor * 0.45;
    hemiLight.intensity = 0.2 + dayFactor * 0.4;

    // Ciel
    const skyColor = new THREE.Color();
    if (sunHeight > 0.05) {
        // Jour
        skyColor.setHSL(0.58, 0.65, 0.35 + dayFactor * 0.35);
    } else if (sunHeight > -0.15) {
        // Crépuscule / aube (teinte orangée)
        skyColor.setHSL(0.06, 0.55, 0.25);
    } else {
        // Nuit
        skyColor.setHSL(0.62, 0.5, 0.06);
    }
    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor);
}

// =====================================================
// GÉNÉRATION DU TERRAIN (procédurale)
// =====================================================
function hash2(x, z, seed) {
    let h = x * 374761393 + z * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// Bruit de valeur avec interpolation
function valueNoise(x, z, seed) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const tl = hash2(xi, zi, seed);
    const tr = hash2(xi + 1, zi, seed);
    const bl = hash2(xi, zi + 1, seed);
    const br = hash2(xi + 1, zi + 1, seed);
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const top = tl * (1 - u) + tr * u;
    const bot = bl * (1 - u) + br * u;
    return top * (1 - v) + bot * v;
}

function fbm(x, z, seed) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < 4; i++) {
        value += valueNoise(x * frequency, z * frequency, seed + i * 17) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return value / total;
}

function getTerrainHeight(x, z) {
    // Collines douces + bruit fine
    const base = fbm(x * 0.035, z * 0.035, TERRAIN_SEED);
    const detail = fbm(x * 0.12, z * 0.12, TERRAIN_SEED + 999);
    const hill = Math.pow(Math.max(0, fbm(x * 0.012, z * 0.012, TERRAIN_SEED + 555) - 0.3) * 2, 2);

    const height = 3 + base * 8 + detail * 2 + hill * 14;
    return Math.max(1, Math.floor(height));
}

function generateTerrain() {
    // Effacer
    clearWorld();

    const HALF = WORLD_SIZE;

    // Placer le terrain
    for (let x = -HALF; x <= HALF; x++) {
        for (let z = -HALF; z <= HALF; z++) {
            const h = getTerrainHeight(x, z);

            for (let y = 0; y <= h; y++) {
                let type;
                if (y === h) {
                    // Surface : herbe ou pierre si haute altitude
                    type = (h > 18) ? 'stone' : 'grass';
                } else if (y >= h - 2) {
                    type = 'dirt';
                } else {
                    type = 'stone';
                }
                addBlock(x, y, z, type, false);
            }

            // Arbres rares
            if (hash2(x, z, TERRAIN_SEED + 7777) < 0.008) {
                maybePlaceTree(x, h + 1, z);
            }
        }
    }

    // Quelques amas de verre décoratifs
    for (let i = 0; i < 6; i++) {
        const gx = Math.floor(hash2(i, 0, 42) * (HALF * 2) - HALF);
        const gz = Math.floor(hash2(0, i, 42) * (HALF * 2) - HALF);
        const gy = getTerrainHeight(gx, gz) + 1;
        addBlock(gx, gy, gz, 'glass', false);
        addBlock(gx + 1, gy, gz, 'glass', false);
        addBlock(gx, gy + 1, gz, 'glass', false);
    }
}

function maybePlaceTree(x, y, z) {
    const trunkH = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < trunkH; i++) {
        addBlock(x, y + i, z, 'wood', false);
    }
    const topY = y + trunkH;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            for (let dy = 0; dy <= 2; dy++) {
                const d = Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 1);
                if (d <= 3 && !(dx === 0 && dz === 0 && dy < 2)) {
                    const px = x + dx, py = topY + dy - 1, pz = z + dz;
                    if (!state.world[`${px},${py},${pz}`]) {
                        addBlock(px, py, pz, 'grass', false);
                    }
                }
            }
        }
    }
}

// =====================================================
// GESTION DES BLOCS
// =====================================================
function getMaterial(type) {
    if (materialCache[type]) return materialCache[type];

    const b = BLOCK_TYPES[type];
    let mat;

    if (type === 'grass') {
        // Matériau multi-faces : herbe en haut, terre sur les côtés/bas
        const side = new THREE.MeshLambertMaterial({ color: b.color });
        const top = new THREE.MeshLambertMaterial({ color: b.topColor });
        mat = [side, side, top, side, side, side];
    } else if (type === 'glass') {
        mat = new THREE.MeshPhongMaterial({
            color: b.color,
            transparent: true,
            opacity: 0.55,
            shininess: 100,
            specular: 0x99ccff
        });
    } else {
        mat = new THREE.MeshLambertMaterial({ color: b.color });
    }

    materialCache[type] = mat;
    return mat;
}

function addBlock(x, y, z, type, save = true) {
    const key = `${x},${y},${z}`;
    if (state.world[key]) return;

    if (!BLOCK_TYPES[type]) return;

    const mesh = new THREE.Mesh(sharedGeometry, getMaterial(type));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, x, y, z };

    scene.add(mesh);
    state.world[key] = mesh;
    state.blockList.push(mesh);

    if (save) saveWorld();
}

function removeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    const mesh = state.world[key];
    if (!mesh) return false;

    scene.remove(mesh);
    delete state.world[key];

    const idx = state.blockList.indexOf(mesh);
    if (idx > -1) state.blockList.splice(idx, 1);

    saveWorld();
    return true;
}

function clearWorld() {
    state.blockList.forEach(mesh => scene.remove(mesh));
    state.world = {};
    state.blockList = [];
}

// =====================================================
// SAUVEGARDE
// =====================================================
const SAVE_KEY = 'minecraft3d_save_v2';

function saveWorld() {
    saveSettings();
}

function saveSettings() {
    try {
        const blocks = {};
        for (const [key, mesh] of Object.entries(state.world)) {
            blocks[key] = mesh.userData.type;
        }

        const data = {
            version: 2,
            blocks,
            player: {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z,
                isFlying: state.isFlying,
                selectedBlockType: state.selectedBlockType,
            },
            settings: {
                speedMultiplier: state.speedMultiplier,
                renderDistance: state.renderDistance,
                cycleAuto: state.cycleAuto,
                dayTime: state.dayTime,
            }
        };

        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Sauvegarde impossible :', e);
    }
}

function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !data.blocks) return false;

        // Blocs
        clearWorld();
        for (const [key, type] of Object.entries(data.blocks)) {
            const [x, y, z] = key.split(',').map(Number);
            addBlock(x, y, z, type, false);
        }

        // Joueur
        if (data.player) {
            player.position.set(data.player.x, data.player.y, data.player.z);
            camera.position.copy(player.position);
            state.isFlying = !!data.player.isFlying;
            state.selectedBlockType = data.player.selectedBlockType || 'dirt';
        }

        // Paramètres
        if (data.settings) {
            state.speedMultiplier = data.settings.speedMultiplier ?? 1.0;
            state.renderDistance = data.settings.renderDistance ?? 100;
            state.cycleAuto = data.settings.cycleAuto !== undefined ? data.settings.cycleAuto : true;
            state.dayTime = data.settings.dayTime ?? 0.25;
        }

        // Appliquer la distance de rendu
        scene.fog.far = state.renderDistance;
        camera.far = state.renderDistance * 2;
        camera.updateProjectionMatrix();

        updateModeUI();
        updateSpeedUI();
        updateCycleButtonUI();
        updateSelectedBlockUI();
        return true;
    } catch (e) {
        console.warn('Chargement impossible :', e);
        return false;
    }
}

function resetWorld() {
    if (!confirm('Voulez-vous vraiment réinitialiser le monde ? Cette action est irréversible.')) {
        return;
    }
    localStorage.removeItem(SAVE_KEY);
    clearWorld();

    // Régénérer
    generateTerrain();

    // Replacer le joueur au sol
    let topY = 30;
    while (topY > 0 && !state.world[`0,${topY},0`]) topY--;
    player.position.set(0.5, topY + 2, 0.5);
    camera.position.copy(player.position);

    saveSettings();
    closeSettings();
}

// =====================================================
// ÉVÉNEMENTS
// =====================================================
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    renderer.domElement.addEventListener('click', () => {
        if (!state.isInventoryOpen && !state.isSettingsOpen && !state.isPointerLocked) {
            renderer.domElement.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        state.isPointerLocked = document.pointerLockElement === renderer.domElement;
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Molette → changement de bloc
    document.addEventListener('wheel', (e) => {
        if (state.isInventoryOpen || state.isSettingsOpen) return;
        const dir = Math.sign(e.deltaY);
        if (dir === 0) return;
        let idx = BLOCK_KEYS.indexOf(state.selectedBlockType);
        idx = (idx + dir + BLOCK_KEYS.length) % BLOCK_KEYS.length;
        selectBlock(BLOCK_KEYS[idx]);
    }, { passive: true });

    // Touche 1..5 → sélection rapide
    // (géré dans onKeyDown)
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
        updateModeUI();
        saveSettings();
        return;
    }

    if (e.code === 'Escape') {
        if (state.isInventoryOpen) toggleInventory(false);
        if (state.isSettingsOpen) closeSettings();
        return;
    }

    // Touches numériques pour sélection rapide
    if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.slice(5));
        if (num >= 1 && num <= BLOCK_KEYS.length) {
            selectBlock(BLOCK_KEYS[num - 1]);
        }
    }
}

function onKeyUp(e) {
    keys[e.code] = false;
}

function onMouseMove(e) {
    if (!state.isPointerLocked || state.isInventoryOpen || state.isSettingsOpen) return;

    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= movementX * 0.0022;
    euler.x -= movementY * 0.0022;
    euler.x = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, euler.x));
    camera.quaternion.setFromEuler(euler);
}

function onMouseDown(e) {
    if (!state.isPointerLocked || state.isInventoryOpen || state.isSettingsOpen) return;

    raycaster.setFromCamera(mouse, camera);
    raycaster.far = 8;

    const intersects = raycaster.intersectObjects(state.blockList, false);
    if (intersects.length === 0) return;

    const hit = intersects[0];
    const mesh = hit.object;
    const { x, y, z } = mesh.userData;

    if (e.button === 0) {
        // Casser
        removeBlock(x, y, z);
    } else if (e.button === 2) {
        // Placer
        const normal = hit.face.normal.clone();
        normal.applyQuaternion(mesh.quaternion);
        const px = x + Math.round(normal.x);
        const py = y + Math.round(normal.y);
        const pz = z + Math.round(normal.z);

        if (state.world[`${px},${py},${pz}`]) return;

        // Empêcher de se placer dans le joueur
        const dx = px - player.position.x;
        const dy = py - (player.position.y - player.height * 0.5);
        const dz = pz - player.position.z;
        if (dx * dx + dy * dy + dz * dz < 1.4) return;

        addBlock(px, py, pz, state.selectedBlockType, true);
    }
}

// =====================================================
// COLLISIONS & PHYSIQUE
// =====================================================
function collidesAt(pos) {
    const r = player.radius;
    const h = player.height;

    // Vérifier les blocs autour
    const minX = Math.floor(pos.x - r);
    const maxX = Math.floor(pos.x + r);
    const minY = Math.floor(pos.y - h);
    const maxY = Math.floor(pos.y + 0.1);
    const minZ = Math.floor(pos.z - r);
    const maxZ = Math.floor(pos.z + r);

    for (let bx = minX; bx <= maxX; bx++) {
        for (let by = minY; by <= maxY; by++) {
            for (let bz = minZ; bz <= maxZ; bz++) {
                if (state.world[`${bx},${by},${bz}`]) {
                    // Test AABB
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

function updatePlayer(delta) {
    const walkSpeed = BASE_WALK_SPEED * state.speedMultiplier;
    const flySpeed = BASE_FLY_SPEED * state.speedMultiplier;

    // Vecteurs caméra (horizontal)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    // Direction souhaitée
    const dir = new THREE.Vector3();
    if (keys['KeyW'] || keys['KeyZ']) dir.add(forward);
    if (keys['KeyS']) dir.sub(forward);
    if (keys['KeyA'] || keys['KeyQ']) dir.sub(right);
    if (keys['KeyD']) dir.add(right);

    if (dir.lengthSq() > 0) dir.normalize();

    // Vitesse cible
    const targetSpeed = state.isFlying ? flySpeed : walkSpeed;
    player.targetVelocity.set(dir.x * targetSpeed, 0, dir.z * targetSpeed);

    // Accélération progressive (interpolation)
    const accel = state.isFlying ? 12 : 18;
    player.velocity.x += (player.targetVelocity.x - player.velocity.x) * Math.min(1, accel * delta);
    player.velocity.z += (player.targetVelocity.z - player.velocity.z) * Math.min(1, accel * delta);

    // Vertical
    if (state.isFlying) {
        const up = (keys['Space'] ? 1 : 0) - ((keys['ShiftLeft'] || keys['ShiftRight']) ? 1 : 0);
        const targetVY = up * flySpeed;
        player.velocity.y += (targetVY - player.velocity.y) * Math.min(1, 12 * delta);
    } else {
        player.velocity.y -= GRAVITY * delta;
        if (keys['Space'] && player.onGround) {
            player.velocity.y = BASE_JUMP;
            player.onGround = false;
        }
    }

    // Déplacement avec collisions par axe
    const newPos = player.position.clone();

    // X
    newPos.x += player.velocity.x * delta;
    if (collidesAt(newPos)) {
        newPos.x = player.position.x;
        player.velocity.x = 0;
    }

    // Z
    newPos.z += player.velocity.z * delta;
    if (collidesAt(newPos)) {
        newPos.z = player.position.z;
        player.velocity.z = 0;
    }

    // Y
    newPos.y += player.velocity.y * delta;
    if (collidesAt(newPos)) {
        if (player.velocity.y < 0) {
            player.onGround = true;
            // Replacer au sol juste au-dessus
            newPos.y = Math.floor(player.position.y) + 0.0001;
            // Ajustement plus fin :
            const groundY = Math.floor(newPos.y);
            if (collidesAt(new THREE.Vector3(newPos.x, groundY + 0.05, newPos.z))) {
                newPos.y = player.position.y;
            }
        }
        player.velocity.y = 0;
    } else if (player.velocity.y < 0 && !state.isFlying) {
        player.onGround = false;
    }

    // Sécurité : si le joueur tombe sous le monde
    if (newPos.y < -30) {
        newPos.set(0.5, 30, 0.5);
        player.velocity.set(0, 0, 0);
    }

    player.position.copy(newPos);
    camera.position.copy(player.position);
}

// =====================================================
// BOUCLE PRINCIPALE
// =====================================================
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (!state.isInventoryOpen && !state.isSettingsOpen) {
        updatePlayer(delta);
    }

    updateDayNightCycle(delta);

    // Mettre à jour la cible du soleil sur le joueur
    sunLight.target.position.set(player.position.x, player.position.y - 5, player.position.z);
    sunLight.position.set(
        player.position.x + Math.cos((state.dayTime - 0.25) * Math.PI * 2) * 60,
        player.position.y + Math.sin((state.dayTime - 0.25) * Math.PI * 2) * 60,
        player.position.z + 20
    );

    renderer.render(scene, camera);
}

// =====================================================
// DÉMARRAGE
// =====================================================
init();

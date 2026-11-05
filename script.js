// script.js - Jeu Minecraft 3D avec Three.js

// ========== VARIABLES GLOBALES ==========
let scene, camera, renderer, clock;
let world = {}; // Dictionnaire des blocs: clé "x,y,z" -> mesh
let terrainMeshes = []; // Pour le raycasting
let selectedBlockType = 'dirt';
let isFlying = true;
let isInventoryOpen = false;
let isPointerLocked = false;

// Joueur
const player = {
    position: new THREE.Vector3(8, 15, 8),
    velocity: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(),
    speed: 8,
    flySpeed: 15,
    jumpStrength: 8,
    onGround: false,
    height: 1.7,
    radius: 0.4
};

// Contrôles
const keys = {};

// Raycasting pour casser/placer
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); // Centre de l'écran

// Taille d'un bloc
const BLOCK_SIZE = 1;

// Types de blocs avec couleurs et textures
const BLOCK_TYPES = {
    dirt: { color: 0x8B5A2B, name: 'Terre', icon: '🌍' },
    grass: { color: 0x4CAF50, name: 'Herbe', icon: '🌿', topColor: 0x66BB6A },
    stone: { color: 0x808080, name: 'Pierre', icon: '🪨' },
    wood: { color: 0xA0522D, name: 'Bois', icon: '🪵' },
    glass: { color: 0xADD8E6, name: 'Verre', icon: '🔷', transparent: true }
};

// ========== INITIALISATION ==========
function init() {
    // Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Ciel bleu
    scene.fog = new THREE.Fog(0x87CEEB, 50, 100);

    // Caméra
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(player.position);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Horloge
    clock = new THREE.Clock();

    // Éclairage
    setupLighting();

    // Génération procédurale du terrain
    generateTerrain();

    // Récupération de la sauvegarde
    loadWorldFromLocalStorage();

    // Événements
    setupEventListeners();

    // Démarrer la boucle d'animation
    animate();
}

// ========== ÉCLAIRAGE ==========
function setupLighting() {
    // Lumière ambiante
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    // Lumière directionnelle (soleil)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(30, 50, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    scene.add(sunLight);
    scene.userData.sunLight = sunLight;

    // Lumière d'appoint
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
    fillLight.position.set(-20, 10, -20);
    scene.add(fillLight);

    // Stocker pour le cycle jour/nuit
    scene.userData.ambientLight = ambientLight;
}

// ========== GÉNÉRATION PROCÉDURALE DU TERRAIN ==========
function generateTerrain() {
    const size = 24; // Taille du monde
    const heightScale = 3.5;

    // Bruit simple basé sur des sinus
    for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
            // Génération de hauteur procédurale
            let height = Math.floor(
                Math.sin(x * 0.3) * Math.cos(z * 0.3) * heightScale +
                Math.sin(x * 0.15 + z * 0.1) * 2 +
                Math.cos(x * 0.1 - z * 0.2) * 1.5 +
                3
            );
            
            // Assurer une hauteur minimale
            height = Math.max(0, height);

            // Placer les blocs
            for (let y = 0; y <= height; y++) {
                let type;
                if (y === height) {
                    type = 'grass';
                } else if (y >= height - 2) {
                    type = 'dirt';
                } else {
                    type = 'stone';
                }
                addBlock(x, y, z, type, false);
            }
        }
    }

    // Ajouter quelques arbres
    addTrees();

    // Ajouter quelques blocs de verre décoratifs
    addGlassDecorations();
}

function addTrees() {
    const treePositions = [
        [5, 0, 5], [-5, 0, -5], [8, 0, -8], [-8, 0, 8], [0, 0, 10],
        [12, 0, 3], [-12, 0, -3], [3, 0, -12], [-3, 0, 12]
    ];

    treePositions.forEach(([x, _, z]) => {
        // Trouver la hauteur du sol
        let groundY = -1;
        for (let y = 20; y >= 0; y--) {
            if (world[`${x},${y},${z}`]) {
                groundY = y;
                break;
            }
        }
        if (groundY < 0) return;

        // Tronc (bois)
        const trunkHeight = 3 + Math.floor(Math.random() * 2);
        for (let h = 1; h <= trunkHeight; h++) {
            addBlock(x, groundY + h, z, 'wood', false);
        }

        // Feuilles (herbe comme substitut)
        const leafY = groundY + trunkHeight;
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = -1; ly <= 1; ly++) {
                    if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly) <= 3 && 
                        !(lx === 0 && lz === 0 && ly <= 0)) {
                        const px = x + lx;
                        const py = leafY + ly;
                        const pz = z + lz;
                        if (!world[`${px},${py},${pz}`]) {
                            addBlock(px, py, pz, 'grass', false);
                        }
                    }
                }
            }
        }
    });
}

function addGlassDecorations() {
    // Petites structures en verre
    const glassSpots = [[-2, 0, -2], [10, 0, 10]];
    glassSpots.forEach(([x, _, z]) => {
        let groundY = -1;
        for (let y = 20; y >= 0; y--) {
            if (world[`${x},${y},${z}`]) {
                groundY = y;
                break;
            }
        }
        if (groundY >= 0) {
            for (let i = 1; i <= 2; i++) {
                addBlock(x, groundY + i, z, 'glass', false);
            }
        }
    });
}

// ========== AJOUT D'UN BLOC ==========
function addBlock(x, y, z, type, save = true) {
    const key = `${x},${y},${z}`;
    if (world[key]) return; // Le bloc existe déjà

    const blockData = BLOCK_TYPES[type];
    if (!blockData) return;

    // Géométrie
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    
    // Matériau
    let material;
    if (type === 'glass') {
        material = new THREE.MeshPhongMaterial({
            color: blockData.color,
            transparent: true,
            opacity: 0.5,
            shininess: 100,
            emissive: 0x112233
        });
    } else if (type === 'grass') {
        // Herbe: couleur différente en haut
        const materials = [
            new THREE.MeshLambertMaterial({ color: blockData.color }), // right
            new THREE.MeshLambertMaterial({ color: blockData.color }), // left
            new THREE.MeshLambertMaterial({ color: blockData.topColor || blockData.color }), // top
            new THREE.MeshLambertMaterial({ color: blockData.color }), // bottom
            new THREE.MeshLambertMaterial({ color: blockData.color }), // front
            new THREE.MeshLambertMaterial({ color: blockData.color })  // back
        ];
        material = materials;
    } else {
        material = new THREE.MeshLambertMaterial({ 
            color: blockData.color,
            emissive: 0x000000
        });
    }

    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, y, z);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData = { type: type, x: x, y: y, z: z };
    
    scene.add(cube);
    world[key] = cube;
    terrainMeshes.push(cube);

    // Sauvegarde automatique
    if (save) {
        saveWorldToLocalStorage();
    }
}

// ========== SUPPRESSION D'UN BLOC ==========
function removeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    const cube = world[key];
    if (!cube) return false;

    scene.remove(cube);
    cube.geometry.dispose();
    if (Array.isArray(cube.material)) {
        cube.material.forEach(m => m.dispose());
    } else {
        cube.material.dispose();
    }
    
    delete world[key];
    const idx = terrainMeshes.indexOf(cube);
    if (idx > -1) terrainMeshes.splice(idx, 1);
    
    saveWorldToLocalStorage();
    return true;
}

// ========== SAUVEGARDE LOCALSTORAGE ==========
function saveWorldToLocalStorage() {
    const data = {};
    for (const [key, cube] of Object.entries(world)) {
        data[key] = cube.userData.type;
    }
    try {
        localStorage.setItem('minecraft3d_world', JSON.stringify(data));
        localStorage.setItem('minecraft3d_player', JSON.stringify({
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            selectedBlock: selectedBlockType,
            isFlying: isFlying
        }));
    } catch (e) {
        console.warn('Sauvegarde échouée:', e);
    }
}

function loadWorldFromLocalStorage() {
    try {
        const savedWorld = localStorage.getItem('minecraft3d_world');
        if (savedWorld) {
            const data = JSON.parse(savedWorld);
            // Effacer le monde actuel
            terrainMeshes.forEach(cube => {
                scene.remove(cube);
                cube.geometry.dispose();
                if (Array.isArray(cube.material)) {
                    cube.material.forEach(m => m.dispose());
                } else {
                    cube.material.dispose();
                }
            });
            world = {};
            terrainMeshes = [];

            // Recharger
            for (const [key, type] of Object.entries(data)) {
                const [x, y, z] = key.split(',').map(Number);
                addBlock(x, y, z, type, false);
            }
        }

        const savedPlayer = localStorage.getItem('minecraft3d_player');
        if (savedPlayer) {
            const p = JSON.parse(savedPlayer);
            player.position.set(p.x, p.y, p.z);
            selectedBlockType = p.selectedBlock || 'dirt';
            isFlying = p.isFlying !== undefined ? p.isFlying : true;
            updateSelectedBlockUI();
            updateModeIndicator();
        }
    } catch (e) {
        console.warn('Chargement échoué:', e);
    }
}

// ========== ÉVÉNEMENTS ==========
function setupEventListeners() {
    // Redimensionnement
    window.addEventListener('resize', onWindowResize);

    // Clavier
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Souris - verrouillage du pointeur
    renderer.domElement.addEventListener('click', () => {
        if (!isInventoryOpen && !isPointerLocked) {
            renderer.domElement.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
    });

    // Mouvement de la souris
    document.addEventListener('mousemove', onMouseMove);

    // Clics pour casser/placer
    document.addEventListener('mousedown', onMouseDown);

    // Empêcher le menu contextuel
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Inventaire
    document.querySelectorAll('.hotbar-slot, .inventory-slot').forEach(slot => {
        slot.addEventListener('click', (e) => {
            e.stopPropagation();
            const blockType = slot.dataset.block;
            if (blockType) {
                selectedBlockType = blockType;
                updateSelectedBlockUI();
                saveWorldToLocalStorage();
            }
        });
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    keys[event.code] = true;

    // Touche E - Inventaire
    if (event.code === 'KeyE') {
        toggleInventory();
    }

    // Touche F - Mode vol/marche
    if (event.code === 'KeyF') {
        isFlying = !isFlying;
        updateModeIndicator();
        saveWorldToLocalStorage();
    }
}

function onKeyUp(event) {
    keys[event.code] = false;
}

function onMouseMove(event) {
    if (!isPointerLocked || isInventoryOpen) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Rotation de la caméra
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);
}

function onMouseDown(event) {
    if (!isPointerLocked || isInventoryOpen) return;

    // Raycasting depuis le centre de l'écran
    raycaster.setFromCamera(mouse, camera);
    
    // Augmenter la portée du raycast
    raycaster.far = 10;
    const intersects = raycaster.intersectObjects(terrainMeshes);

    if (intersects.length > 0) {
        const hit = intersects[0];
        const block = hit.object;
        const { x, y, z, type } = block.userData;

        if (event.button === 0) {
            // Clic gauche - Casser le bloc
            if (type === 'stone' && !isFlying) {
                // En mode marche, on ne peut pas casser la pierre? Non, on peut tout casser.
            }
            removeBlock(x, y, z);
        } else if (event.button === 2) {
            // Clic droit - Placer un bloc
            // Calculer la position d'placement
            const normal = hit.face.normal.clone();
            // Appliquer la rotation du bloc
            normal.applyQuaternion(block.quaternion);
            
            const placeX = x + Math.round(normal.x);
            const placeY = y + Math.round(normal.y);
            const placeZ = z + Math.round(normal.z);

            // Vérifier qu'il n'y a pas déjà un bloc
            if (!world[`${placeX},${placeY},${placeZ}`]) {
                // Vérifier qu'on ne place pas sur le joueur
                const distToPlayer = Math.sqrt(
                    Math.pow(placeX - player.position.x, 2) +
                    Math.pow(placeY - player.position.y, 2) +
                    Math.pow(placeZ - player.position.z, 2)
                );
                
                // Empêcher de placer un bloc sur soi-même
                if (distToPlayer > 1.2) {
                    addBlock(placeX, placeY, placeZ, selectedBlockType, true);
                }
            }
        }
    }
}

// ========== INTERFACE ==========
function toggleInventory() {
    isInventoryOpen = !isInventoryOpen;
    const inv = document.getElementById('inventory');
    
    if (isInventoryOpen) {
        inv.classList.add('open');
        // Mettre à jour la sélection dans l'inventaire
        document.querySelectorAll('.inventory-slot').forEach(slot => {
            slot.classList.toggle('selected', slot.dataset.block === selectedBlockType);
        });
        document.exitPointerLock();
    } else {
        inv.classList.remove('open');
    }
}

function updateSelectedBlockUI() {
    const blockData = BLOCK_TYPES[selectedBlockType];
    document.getElementById('selected-block-name').textContent = 
        `${blockData.icon} ${blockData.name}`;
    
    // Mettre à jour les slots actifs dans la hotbar
    document.querySelectorAll('.hotbar-slot').forEach(slot => {
        slot.classList.toggle('active', slot.dataset.block === selectedBlockType);
    });

    // Mettre à jour la sélection dans l'inventaire
    document.querySelectorAll('.inventory-slot').forEach(slot => {
        slot.classList.toggle('selected', slot.dataset.block === selectedBlockType);
    });
}

function updateModeIndicator() {
    const el = document.getElementById('mode-indicator');
    el.textContent = isFlying ? 'Mode: Vol ✈️' : 'Mode: Marche 🚶';
    el.style.borderColor = isFlying ? '#FFD700' : '#4CAF50';
}

// ========== COLLISIONS ==========
function checkCollision(position) {
    // Vérifier les collisions avec les blocs autour du joueur
    const r = player.radius;
    const h = player.height;
    
    // Points de test autour du joueur
    const testPoints = [
        [position.x - r, position.y, position.z - r],
        [position.x + r, position.y, position.z - r],
        [position.x - r, position.y, position.z + r],
        [position.x + r, position.y, position.z + r],
        [position.x, position.y + h * 0.5, position.z],
    ];

    for (const [px, py, pz] of testPoints) {
        // Vérifier chaque bloc dans un rayon de 1
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                for (let oz = -1; oz <= 1; oz++) {
                    const bx = Math.round(px) + ox;
                    const by = Math.round(py) + oy;
                    const bz = Math.round(pz) + oz;
                    
                    if (world[`${bx},${by},${bz}`]) {
                        // Collision AABB
                        const blockMinX = bx - 0.5, blockMaxX = bx + 0.5;
                        const blockMinY = by - 0.5, blockMaxY = by + 0.5;
                        const blockMinZ = bz - 0.5, blockMaxZ = bz + 0.5;

                        if (px + r > blockMinX && px - r < blockMaxX &&
                            py + h > blockMinY && py < blockMaxY &&
                            pz + r > blockMinZ && pz - r < blockMaxZ) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

// ========== MISE À JOUR DU JOUEUR ==========
function updatePlayer(delta) {
    // Direction de la caméra
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    
    // Garder le mouvement horizontal
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    // Calculer la vitesse de déplacement
    const speed = isFlying ? player.flySpeed : player.speed;
    const moveVector = new THREE.Vector3();

    if (keys['KeyW'] || keys['KeyZ']) moveVector.add(forward); // ZQSD: Z = avant
    if (keys['KeyS']) moveVector.sub(forward);
    if (keys['KeyA'] || keys['KeyQ']) moveVector.sub(right); // Q = gauche
    if (keys['KeyD']) moveVector.add(right);

    moveVector.normalize().multiplyScalar(speed * delta);

    // Mouvement vertical
    if (isFlying) {
        if (keys['Space']) moveVector.y += speed * delta;
        if (keys['ShiftLeft'] || keys['ShiftRight']) moveVector.y -= speed * delta;
        player.velocity.y = 0;
    } else {
        // Gravité en mode marche
        player.velocity.y -= 25 * delta;
        
        if (keys['Space'] && player.onGround) {
            player.velocity.y = player.jumpStrength;
            player.onGround = false;
        }
    }

    // Appliquer le mouvement horizontal avec collisions
    const newPos = player.position.clone();
    
    // Axe X
    newPos.x += moveVector.x;
    if (checkCollision(newPos)) {
        newPos.x = player.position.x;
    }

    // Axe Z
    newPos.z += moveVector.z;
    if (checkCollision(newPos)) {
        newPos.z = player.position.z;
    }

    // Axe Y
    if (!isFlying) {
        newPos.y += player.velocity.y * delta;
        if (checkCollision(newPos)) {
            if (player.velocity.y < 0) {
                player.onGround = true;
                // Placer le joueur juste au-dessus du bloc
                newPos.y = Math.floor(player.position.y) + 0.5;
            }
            player.velocity.y = 0;
        } else {
            if (player.velocity.y < 0) player.onGround = false;
        }
    } else {
        newPos.y += moveVector.y;
        if (checkCollision(newPos)) {
            newPos.y = player.position.y;
        }
    }

    player.position.copy(newPos);
    camera.position.copy(player.position);
}

// ========== CYCLE JOUR/NUIT ==========
function updateDayNightCycle(time) {
    const sunLight = scene.userData.sunLight;
    const ambientLight = scene.userData.ambientLight;
    if (!sunLight || !ambientLight) return;

    // Cycle sur 120 secondes
    const cycleSpeed = 0.05;
    const angle = time * cycleSpeed;
    
    // Position du soleil (cercle)
    sunLight.position.x = Math.cos(angle) * 50;
    sunLight.position.y = Math.sin(angle) * 50;
    sunLight.position.z = 20;
    
    // Intensité basée sur la hauteur du soleil
    const sunHeight = Math.max(0, Math.sin(angle));
    const intensity = 0.3 + sunHeight * 1.0;
    sunLight.intensity = intensity;
    
    // Couleur du ciel
    const skyColor = new THREE.Color();
    if (sunHeight > 0.3) {
        skyColor.setHSL(0.6, 0.7, 0.5 + sunHeight * 0.3);
    } else {
        skyColor.setHSL(0.6, 0.5, 0.1 + sunHeight * 0.3);
    }
    scene.background = skyColor;
    scene.fog.color = skyColor;
    
    // Lumière ambiante
    ambientLight.intensity = 0.2 + sunHeight * 0.4;
}

// ========== BOUCLE D'ANIMATION ==========
function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsedTime = clock.getElapsedTime();

    // Mise à jour du joueur (sauf si inventaire ouvert)
    if (!isInventoryOpen) {
        updatePlayer(delta);
    }

    // Cycle jour/nuit
    updateDayNightCycle(elapsedTime);

    // Mise à jour des ombres pour les nouveaux blocs
    renderer.render(scene, camera);
}

// ========== DÉMARRAGE ==========
init();

// Mise à jour initiale de l'UI
updateSelectedBlockUI();
updateModeIndicator();

// Charger le monde après initialisation
setTimeout(() => {
    loadWorldFromLocalStorage();
}, 100);

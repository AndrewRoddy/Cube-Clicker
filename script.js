/**
 * =================================
 * 3D Cube Viewer - JavaScript
 * =================================
 * 
 * Interactive 3D cube with mouse/touch controls
 * Built with Three.js
 */

class CubeViewer {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cube = null;
        this.cubes = [];
        this.fragments = [];
        this.isExploding = false;
        
        // Interaction state
        this.mouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.currentRotationX = 0;
        this.currentRotationY = 0;
        this.isDragging = false;
        this.clickCount = 0;
        this.maxScore = 1000000; // 1 million for max saturation
        this.hasWon = false;
        this.scoreMultiplier = 1;
        this.cubeCount = 1;
        this.rebirthLevel = 0;
        
        // Upgrade system
        this.upgrades = {
            explosiveness: { level: 0, baseCost: 10, multiplier: 1.5 },
            fragmentCount: { level: 0, baseCost: 25, multiplier: 1.8 },
            scoreMultiplier: { level: 0, baseCost: 50, multiplier: 2.0 },
            explosionForce: { level: 0, baseCost: 100, multiplier: 2.2 },
            autoClicker: { level: 0, baseCost: 500, multiplier: 3.0 }
        };
        
        // Rebirth upgrades (persist through rebirths)
        this.rebirthUpgrades = {
            doubleCubes: { level: 0, baseCost: 100000, multiplier: 10.0 }
        };
        
        // Auto-clicker timing
        this.lastAutoClick = Date.now();
        
        // Configuration
        this.config = {
            rotationSpeed: 0.01,
            interpolationSpeed: 0.05,
            zoomSpeed: 1.1,
            minZoom: 2,
            maxZoom: 10,
            floatingSpeed: 0.001,
            floatingAmplitude: 0.1,
            explosionForce: 0.3,
            gravity: -0.01,
            fragmentCount: 27, // 3x3x3 grid
            explosionDuration: 1,
            respawnDelay: 1
        };
        
        this.init();
        this.loadGame();
    }
    
    /**
     * Initialize the 3D scene and all components
     */
    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createCubes();
        this.createLighting();
        this.setupEventListeners();
        this.setupRaycaster();
        this.setupStore();
        this.loadGame(); // Load saved data immediately
        this.startAnimation();
        this.startAutoSave();
        
        console.log('3D Cube Viewer initialized successfully');
    }
    
    /**
     * Create the Three.js scene
     */
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = null; // Transparent background
    }
    
    /**
     * Create and configure the camera
     */
    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.z = 5;
    }
    
    /**
     * Create and configure the WebGL renderer
     */
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true 
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Add renderer to DOM
        const container = document.getElementById('container');
        container.appendChild(this.renderer.domElement);
        
        // Hide loading indicator
        const loadingElement = document.querySelector('.loading');
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
    }
    
    /**
     * Create the cube with colored faces
     */
    /**
     * Create the cubes with colored faces
     */
    createCubes() {
        // Clear existing cubes
        this.cubes.forEach(cube => {
            this.scene.remove(cube);
            cube.geometry.dispose();
            cube.material.forEach(material => material.dispose());
        });
        this.cubes = [];
        
        // Create base materials
        this.baseMaterials = [
            new THREE.MeshLambertMaterial({ color: 0x808080 }), // Right - Desaturated
            new THREE.MeshLambertMaterial({ color: 0x808080 }), // Left - Desaturated  
            new THREE.MeshLambertMaterial({ color: 0x808080 }), // Top - Desaturated
            new THREE.MeshLambertMaterial({ color: 0x808080 }), // Bottom - Desaturated
            new THREE.MeshLambertMaterial({ color: 0x808080 }), // Front - Desaturated
            new THREE.MeshLambertMaterial({ color: 0x808080 })  // Back - Desaturated
        ];
        
        // Target orange colors for max saturation
        this.targetColors = [
            0xff922f, // Base orange
            0xe6830a, // Darker orange
            0xffa347, // Lighter orange  
            0xd4700a, // Deep orange
            0xffb366, // Light orange
            0xcc5d0a  // Dark orange
        ];
        
        // Create cubes based on current cube count
        for (let i = 0; i < this.cubeCount; i++) {
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            
            // Clone materials for each cube
            const materials = this.baseMaterials.map(material => material.clone());
            
            const cube = new THREE.Mesh(geometry, materials);
            cube.castShadow = true;
            cube.receiveShadow = true;
            
            // Position cubes in a line if multiple
            if (this.cubeCount > 1) {
                cube.position.x = (i - (this.cubeCount - 1) / 2) * 3;
            }
            
            this.scene.add(cube);
            this.cubes.push(cube);
        }
        
        // Set main cube reference for backward compatibility
        this.cube = this.cubes[0];
    }
    
    /**
     * Create and configure lighting
     */
    createLighting() {
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Directional light for shadows and definition
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        this.scene.add(directionalLight);
        
        // Point light for additional illumination
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-5, -5, 5);
        this.scene.add(pointLight);
    }
    
    /**
     * Set up raycaster for cube click detection
     */
    setupRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }
    
    /**
     * Set up the store system
     */
    setupStore() {
        this.createStoreItems();
        this.setupStoreEventListeners();
    }
    
    /**
     * Create store items HTML
     */
    createStoreItems() {
        const storeItems = document.getElementById('storeItems');
        
        const upgradeConfigs = {
            explosiveness: {
                name: '💥 Explosiveness',
                description: 'Increases explosion force and visual effects',
                effect: '+25% explosion force, +20% score multiplier per level'
            },
            fragmentCount: {
                name: '🧩 Fragment Multiplier',
                description: 'More fragments per explosion for bigger effects',
                effect: '+50% more fragments, +30% score multiplier per level'
            },
            scoreMultiplier: {
                name: '⭐ Score Multiplier',
                description: 'Increases points gained per click',
                effect: '+100% score multiplier per level'
            },
            explosionForce: {
                name: '🚀 Explosion Power',
                description: 'Makes fragments fly further and faster',
                effect: '+50% fragment velocity, +25% score multiplier per level'
            },
            autoClicker: {
                name: '🤖 Auto Clicker',
                description: 'Automatically clicks the cube for you',
                effect: '+1 auto click per second, +50% score multiplier per level'
            }
        };
        
        const rebirthConfigs = {
            doubleCubes: {
                name: '🎲 Double Cubes',
                description: 'REBIRTH: Doubles your cubes but resets progress',
                effect: '2x cube count, resets score and regular upgrades'
            }
        };
        
        // Regular upgrades
        Object.keys(this.upgrades).forEach(upgradeKey => {
            const config = upgradeConfigs[upgradeKey];
            const upgrade = this.upgrades[upgradeKey];
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'store-item';
            itemDiv.innerHTML = `
                <h3>${config.name}</h3>
                <p>${config.description}</p>
                <div class="level">Level: <span id="${upgradeKey}-level">${upgrade.level}</span></div>
                <div class="price">Cost: <span id="${upgradeKey}-cost">${this.getUpgradeCost(upgradeKey).toLocaleString()}</span> points</div>
                <p style="font-size: 14px; color: #888;">${config.effect}</p>
                <button class="buy-button" onclick="cubeViewer.buyUpgrade('${upgradeKey}')">
                    Buy Upgrade
                </button>
            `;
            storeItems.appendChild(itemDiv);
        });
        
        // Rebirth upgrades section
        const rebirthSection = document.createElement('div');
        rebirthSection.className = 'rebirth-section';
        rebirthSection.innerHTML = '<h2 style="color: #ff922f; margin: 20px 0 10px 0;">🔄 Rebirth Upgrades</h2>';
        storeItems.appendChild(rebirthSection);
        
        Object.keys(this.rebirthUpgrades).forEach(upgradeKey => {
            const config = rebirthConfigs[upgradeKey];
            const upgrade = this.rebirthUpgrades[upgradeKey];
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'store-item rebirth-item';
            itemDiv.innerHTML = `
                <h3>${config.name}</h3>
                <p>${config.description}</p>
                <div class="level">Level: <span id="${upgradeKey}-level">${upgrade.level}</span></div>
                <div class="price">Cost: <span id="${upgradeKey}-cost">${this.getRebirthUpgradeCost(upgradeKey).toLocaleString()}</span> points</div>
                <p style="font-size: 14px; color: #888;">${config.effect}</p>
                <button class="buy-button rebirth-button" onclick="cubeViewer.buyRebirthUpgrade('${upgradeKey}')">
                    Rebirth
                </button>
            `;
            storeItems.appendChild(itemDiv);
        });
    }
    
    /**
     * Set up store event listeners
     */
    setupStoreEventListeners() {
        const storeButton = document.getElementById('storeButton');
        const storeModal = document.getElementById('storeModal');
        const closeButton = document.querySelector('.close');
        
        storeButton.addEventListener('click', () => {
            storeModal.style.display = 'block';
            this.updateStoreDisplay();
        });
        
        closeButton.addEventListener('click', () => {
            storeModal.style.display = 'none';
        });
        
        window.addEventListener('click', (event) => {
            if (event.target === storeModal) {
                storeModal.style.display = 'none';
            }
        });
    }
    
    /**
     * Get the cost of an upgrade
     */
    getUpgradeCost(upgradeKey) {
        const upgrade = this.upgrades[upgradeKey];
        return Math.floor(upgrade.baseCost * Math.pow(upgrade.multiplier, upgrade.level));
    }
    
    /**
     * Buy an upgrade
     */
    buyUpgrade(upgradeKey) {
        const cost = this.getUpgradeCost(upgradeKey);
        
        if (this.clickCount >= cost) {
            this.clickCount -= cost;
            this.upgrades[upgradeKey].level++;
            
            // Update display
            this.updateDisplay();
            this.updateStoreDisplay();
            this.updateGameParameters();
            this.saveGame();
            
            console.log(`Bought ${upgradeKey} upgrade! New level: ${this.upgrades[upgradeKey].level}`);
        }
    }
    
    /**
     * Buy rebirth upgrade
     */
    buyRebirthUpgrade(upgradeKey) {
        const cost = this.getRebirthUpgradeCost(upgradeKey);
        
        if (this.clickCount >= cost) {
            // Confirm rebirth
            if (confirm('This will reset your score and regular upgrades but double your cubes. Are you sure?')) {
                this.rebirthUpgrades[upgradeKey].level++;
                this.rebirthLevel++;
                
                // Reset progress
                this.clickCount = 0;
                Object.keys(this.upgrades).forEach(key => {
                    this.upgrades[key].level = 0;
                });
                
                // Double cube count
                this.cubeCount = Math.pow(2, this.rebirthUpgrades.doubleCubes.level);
                
                // Clear fragments and recreate cubes
                this.clearFragments();
                this.createCubes();
                
                // Update display
                this.updateDisplay();
                this.updateStoreDisplay();
                this.updateGameParameters();
                this.saveGame();
                
                console.log(`Rebirth! New cube count: ${this.cubeCount}, Rebirth level: ${this.rebirthLevel}`);
            }
        }
    }
    
    /**
     * Get rebirth upgrade cost
     */
    getRebirthUpgradeCost(upgradeKey) {
        const upgrade = this.rebirthUpgrades[upgradeKey];
        return Math.floor(upgrade.baseCost * Math.pow(upgrade.multiplier, upgrade.level));
    }
    
    /**
     * Update store display
     */
    updateStoreDisplay() {
        Object.keys(this.upgrades).forEach(upgradeKey => {
            const levelSpan = document.getElementById(`${upgradeKey}-level`);
            const costSpan = document.getElementById(`${upgradeKey}-cost`);
            
            if (levelSpan && costSpan) {
                levelSpan.textContent = this.upgrades[upgradeKey].level;
                costSpan.textContent = this.getUpgradeCost(upgradeKey).toLocaleString();
            }
        });
        
        Object.keys(this.rebirthUpgrades).forEach(upgradeKey => {
            const levelSpan = document.getElementById(`${upgradeKey}-level`);
            const costSpan = document.getElementById(`${upgradeKey}-cost`);
            
            if (levelSpan && costSpan) {
                levelSpan.textContent = this.rebirthUpgrades[upgradeKey].level;
                costSpan.textContent = this.getRebirthUpgradeCost(upgradeKey).toLocaleString();
            }
        });
    }
    
    /**
     * Update game parameters based on upgrades
     */
    updateGameParameters() {
        // Calculate total score multiplier from all upgrades
        this.scoreMultiplier = 1 + 
            this.upgrades.scoreMultiplier.level * 1.0 +      // +100% per level
            this.upgrades.explosiveness.level * 0.2 +        // +20% per level
            this.upgrades.fragmentCount.level * 0.3 +        // +30% per level
            this.upgrades.explosionForce.level * 0.25 +      // +25% per level
            this.upgrades.autoClicker.level * 0.5;           // +50% per level
        
        // Update explosion force
        this.config.explosionForce = 0.3 * (1 + this.upgrades.explosiveness.level * 0.25 + this.upgrades.explosionForce.level * 0.5);
        
        // Update fragment count
        this.config.fragmentCount = 27 * (1 + this.upgrades.fragmentCount.level * 0.5);
    }
    
    /**
     * Set up mouse event listeners (removed mobile/touch support)
     */
    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        // Mouse events
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        canvas.addEventListener('wheel', this.onMouseWheel.bind(this), false);
        
        // Window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        
        // Prevent context menu on right click
        canvas.addEventListener('contextmenu', (e) => e.preventDefault(), false);
    }
    
    /**
     * Mouse down event handler
     */
    onMouseDown(event) {
        this.mouseDown = true;
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
        this.isDragging = false;
        this.renderer.domElement.style.cursor = 'grabbing';
    }
    
    /**
     * Mouse move event handler
     */
    onMouseMove(event) {
        if (!this.mouseDown) return;
        
        const deltaX = event.clientX - this.mouseX;
        const deltaY = event.clientY - this.mouseY;
        
        // If mouse moved significantly, it's a drag
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
            this.isDragging = true;
        }
        
        this.targetRotationY += deltaX * this.config.rotationSpeed;
        this.targetRotationX += deltaY * this.config.rotationSpeed;
        
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
    }
    
    /**
     * Mouse up event handler
     */
    onMouseUp(event) {
        // If it wasn't a drag, check for cube click
        if (!this.isDragging) {
            this.checkCubeClick(event);
        }
        
        this.mouseDown = false;
        this.isDragging = false;
        this.renderer.domElement.style.cursor = 'grab';
    }
    
    /**
     * Mouse wheel event handler for zooming
     */
    onMouseWheel(event) {
        event.preventDefault();
        
        const scale = event.deltaY > 0 ? this.config.zoomSpeed : 1 / this.config.zoomSpeed;
        this.camera.position.z *= scale;
        this.camera.position.z = Math.max(
            this.config.minZoom, 
            Math.min(this.config.maxZoom, this.camera.position.z)
        );
    }
    
    /**
     * Check if cube was clicked using raycasting
     */
    checkCubeClick(event) {
        // Don't allow clicking during explosion
        if (this.isExploding) return;
        
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check for intersections with any cube
        const intersects = this.raycaster.intersectObjects(this.cubes);
        
        if (intersects.length > 0) {
            this.incrementCounter();
            
            // Explode all cubes if one is clicked
            this.cubes.forEach(cube => {
                if (cube.visible) {
                    const cubeCenter = cube.position.clone();
                    this.explodeCube(cubeCenter);
                }
            });
        }
    }
    
    /**
     * Increment the click counter and update display
     */
    incrementCounter() {
        this.clickCount += this.scoreMultiplier;
        this.updateSaturation();
        this.updateDisplay();
    }
    
    /**
     * Update cube saturation based on score
     */
    updateSaturation() {
        // Calculate progress (0 to 1)
        const progress = Math.min(this.clickCount / this.maxScore, 1);
        
        // Update each material color
        this.baseMaterials.forEach((material, index) => {
            const targetColor = this.targetColors[index];
            const currentColor = this.interpolateColor(0x808080, targetColor, progress);
            material.color.setHex(currentColor);
        });
        
        // Update existing fragments to match current saturation
        this.updateFragmentColors(progress);
        
        // Check for win condition
        if (this.clickCount >= this.maxScore && !this.hasWon) {
            this.triggerWin();
        }
    }
    
    /**
     * Update colors of existing fragments based on current saturation
     */
    updateFragmentColors(progress) {
        this.fragments.forEach(fragment => {
            // Store original target color if not already stored
            if (!fragment.originalTargetColor) {
                // Assign a random target color that will be consistent for this fragment
                fragment.originalTargetColor = this.targetColors[Math.floor(Math.random() * this.targetColors.length)];
            }
            
            // Update fragment color based on current progress
            const newColor = this.interpolateColor(0x808080, fragment.originalTargetColor, progress);
            fragment.material.color.setHex(newColor);
        });
    }
    
    /**
     * Interpolate between two hex colors
     */
    interpolateColor(color1, color2, factor) {
        // Extract RGB components
        const r1 = (color1 >> 16) & 0xff;
        const g1 = (color1 >> 8) & 0xff;
        const b1 = color1 & 0xff;
        
        const r2 = (color2 >> 16) & 0xff;
        const g2 = (color2 >> 8) & 0xff;
        const b2 = color2 & 0xff;
        
        // Interpolate
        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);
        
        // Combine back to hex
        return (r << 16) | (g << 8) | b;
    }
    
    /**
     * Update the display elements
     */
    updateDisplay() {
        const counterElement = document.getElementById('clickCounter');
        const multiplierDisplay = document.getElementById('multiplierDisplay');
        const progressBar = document.getElementById('fullProgressBar');
        const progressText = document.getElementById('progressText');
        
        if (counterElement) {
            counterElement.textContent = this.clickCount.toLocaleString();
            
            // Add a brief animation effect
            counterElement.style.transform = 'scale(1.2)';
            counterElement.style.color = '#ff922f';
            
            setTimeout(() => {
                counterElement.style.transform = 'scale(1)';
                counterElement.style.color = '';
            }, 150);
        }
        
        if (multiplierDisplay) {
            multiplierDisplay.textContent = `x${this.scoreMultiplier.toFixed(1)} multiplier`;
        }
        
        if (progressBar && progressText) {
            const progress = Math.min(this.clickCount / this.maxScore, 1);
            const percentage = Math.round(progress * 100);
            
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = `${percentage}% saturation`;
        }
    }
    
    /**
     * Trigger win condition
     */
    triggerWin() {
        this.hasWon = true;
        const winMessage = document.getElementById('winMessage');
        if (winMessage) {
            winMessage.style.display = 'block';
        }
        
        // Add some celebration effects
        console.log('🎉 CONGRATULATIONS! You reached maximum saturation! 🎉');
    }
    
    /**
     * Create explosion effect with fragments
     */
    explodeCube(impactPoint) {
        if (this.isExploding) return;
        
        this.isExploding = true;
        this.cube.visible = false;
        
        // Don't clear existing fragments - let them accumulate!
        // this.clearFragments();
        
        // Create fragments
        this.createFragments(impactPoint);
        
        // Schedule cube respawn
        setTimeout(() => {
            this.respawnCube();
        }, this.config.explosionDuration + this.config.respawnDelay);
    }
    
    /**
     * Create cube fragments for explosion effect
     */
    createFragments(impactPoint) {
        const fragmentSize = 0.22; // Smaller fragments
        const cubeSize = 2;
        const baseFragmentsPerSide = 3;
        const fragmentsPerSide = Math.round(baseFragmentsPerSide * (1 + this.upgrades.fragmentCount.level * 0.3));
        
        // Calculate current saturation progress
        const progress = Math.min(this.clickCount / this.maxScore, 1);
        
        for (let x = 0; x < fragmentsPerSide; x++) {
            for (let y = 0; y < fragmentsPerSide; y++) {
                for (let z = 0; z < fragmentsPerSide; z++) {
                    // Create fragment geometry
                    const geometry = new THREE.BoxGeometry(fragmentSize, fragmentSize, fragmentSize);
                    
                    // Use current saturation level for fragments
                    // Pick a random orange target color
                    const randomTargetColor = this.targetColors[Math.floor(Math.random() * this.targetColors.length)];
                    const fragmentColor = this.interpolateColor(0x808080, randomTargetColor, progress);
                    
                    const material = new THREE.MeshLambertMaterial({ 
                        color: fragmentColor
                    });
                    const fragment = new THREE.Mesh(geometry, material);
                    
                    // Store the target color for future saturation updates
                    fragment.originalTargetColor = randomTargetColor;
                    
                    // Position fragment
                    fragment.position.set(
                        (x - 1) * (cubeSize / fragmentsPerSide),
                        (y - 1) * (cubeSize / fragmentsPerSide),
                        (z - 1) * (cubeSize / fragmentsPerSide)
                    );
                    
                    // Add current cube rotation
                    fragment.rotation.copy(this.cube.rotation);
                    
                    // Calculate explosion direction from impact point
                    const direction = new THREE.Vector3();
                    direction.subVectors(fragment.position, impactPoint);
                    direction.normalize();
                    
                    // Add some randomness
                    direction.x += (Math.random() - 0.5) * 0.5;
                    direction.y += (Math.random() - 0.5) * 0.5;
                    direction.z += (Math.random() - 0.5) * 0.5;
                    direction.normalize();
                    
                    // Set initial velocity
                    const force = this.config.explosionForce * (0.8 + Math.random() * 0.4);
                    fragment.velocity = direction.multiplyScalar(force);
                    fragment.velocity.y += Math.random() * 0.1; // Extra upward velocity
                    
                    // Set angular velocity for spinning
                    fragment.angularVelocity = new THREE.Vector3(
                        (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.3
                    );
                    
                    // Add fragment to scene and array
                    this.scene.add(fragment);
                    this.fragments.push(fragment);
                }
            }
        }
    }
    
    /**
     * Update fragment physics
     */
    updateFragments() {
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const fragment = this.fragments[i];
            
            // Apply gravity
            fragment.velocity.y += this.config.gravity;
            
            // Update position
            fragment.position.add(fragment.velocity);
            
            // Update rotation
            fragment.rotation.x += fragment.angularVelocity.x;
            fragment.rotation.y += fragment.angularVelocity.y;
            fragment.rotation.z += fragment.angularVelocity.z;
            
            // Add air resistance
            fragment.velocity.multiplyScalar(0.995);
            fragment.angularVelocity.multiplyScalar(0.995);
            
            // Remove fragments that fall too far
            if (fragment.position.y < -10) {
                this.scene.remove(fragment);
                fragment.geometry.dispose();
                fragment.material.dispose();
                this.fragments.splice(i, 1);
            }
        }
    }
    
    /**
     * Clear all fragments
     */
    clearFragments() {
        this.fragments.forEach(fragment => {
            this.scene.remove(fragment);
            fragment.geometry.dispose();
            fragment.material.dispose();
        });
        this.fragments = [];
    }
    
    /**
     * Respawn the cube after explosion
     */
    respawnCube() {
        // Don't clear fragments - let them stay alive!
        // this.clearFragments();
        
        // Reset cube properties
        this.cube.visible = true;
        this.cube.position.set(0, 0, 0);
        this.cube.scale.set(0.1, 0.1, 0.1); // Start small
        
        // Animate cube growing back
        const startTime = Date.now();
        const growDuration = 500;
        
        const growAnimation = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / growDuration, 1);
            
            // Easing function for smooth growth
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const scale = 0.1 + (0.9 * easeProgress);
            
            this.cube.scale.set(scale, scale, scale);
            
            if (progress < 1) {
                requestAnimationFrame(growAnimation);
            } else {
                this.cube.scale.set(1, 1, 1);
                this.isExploding = false;
            }
        };
        
        growAnimation();
    }
    
    /**
     * Window resize event handler
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Always update fragments (so they keep falling and accumulating)
        if (this.fragments.length > 0) {
            this.updateFragments();
        }
        
        // Only update cube rotation/floating if not exploding
        if (!this.isExploding) {
            // Smooth rotation interpolation
            this.currentRotationX += (this.targetRotationX - this.currentRotationX) * this.config.interpolationSpeed;
            this.currentRotationY += (this.targetRotationY - this.currentRotationY) * this.config.interpolationSpeed;
            
            // Apply rotations to cube
            this.cube.rotation.x = this.currentRotationX;
            this.cube.rotation.y = this.currentRotationY;
            
            // Add subtle floating animation when not being dragged
            if (!this.mouseDown) {
                this.cube.position.y = Math.sin(Date.now() * this.config.floatingSpeed) * this.config.floatingAmplitude;
            }
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Start the animation loop
     */
    startAnimation() {
        this.animate();
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Clear fragments
        this.clearFragments();
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.cube) {
            this.cube.geometry.dispose();
            this.cube.material.forEach(material => material.dispose());
        }
        
        console.log('Cube Clicker');
    }
    
    /**
     * Save game state to cookies
     */
    saveGame() {
        const gameState = {
            clickCount: this.clickCount,
            upgrades: this.upgrades,
            rebirthUpgrades: this.rebirthUpgrades,
            rebirthLevel: this.rebirthLevel,
            cubeCount: this.cubeCount,
            scoreMultiplier: this.scoreMultiplier
        };
        
        this.setCookie('cubeClickerSave', JSON.stringify(gameState), 365);
    }
    
    /**
     * Load game state from cookies
     */
    loadGame() {
        const saveData = this.getCookie('cubeClickerSave');
        if (saveData) {
            try {
                const gameState = JSON.parse(saveData);
                
                this.clickCount = gameState.clickCount || 0;
                this.upgrades = { ...this.upgrades, ...gameState.upgrades };
                this.rebirthUpgrades = { ...this.rebirthUpgrades, ...gameState.rebirthUpgrades };
                this.rebirthLevel = gameState.rebirthLevel || 0;
                this.cubeCount = gameState.cubeCount || 1;
                this.scoreMultiplier = gameState.scoreMultiplier || 1;
                
                // Update displays
                this.updateDisplay();
                this.updateSaturation();
                this.updateStoreDisplay();
                
                console.log('Game loaded successfully - Score:', this.clickCount, 'Multiplier:', this.scoreMultiplier);
            } catch (error) {
                console.error('Error loading save data:', error);
            }
        } else {
            console.log('No save data found, starting fresh');
        }
    }
    
    /**
     * Set a cookie
     */
    setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    }
    
    /**
     * Get a cookie value
     */
    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
    
    /**
     * Start auto-save timer (saves every 10 seconds)
     */
    startAutoSave() {
        // Set up auto-save every 10 seconds
        this.autoSaveInterval = setInterval(() => {
            this.saveGame();
            console.log('Game auto-saved');
        }, 10000); // 10000ms = 10 seconds
        
        console.log('Auto-save started (every 10 seconds)');
    }
}

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Check for WebGL support
    if (!window.WebGLRenderingContext) {
        console.error('WebGL is not supported');
        document.getElementById('container').innerHTML = 
            '<div style="color: white; text-align: center; padding: 50px;">WebGL is not supported in your browser.</div>';
        return;
    }
    
    // Initialize the cube viewer
    try {
        const cubeViewer = new CubeViewer();
        
        
    } catch (error) {
        console.error('Failed to initialize 3D Cube Viewer:', error);
        document.getElementById('container').innerHTML = 
            '<div style="color: white; text-align: center; padding: 50px;">Failed to initialize 3D viewer.</div>';
    }
});

/**
 * Export for module systems
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CubeViewer;
}

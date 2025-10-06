// Website for Anthony.
class MysticalTreeExperience {
	constructor() {
		// Core Three.js objects
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.models = {};
		
		// Systems
		this.windSystem = null;
		this.audioContext = null;
		this.currentAudio = null;
		
		// Interaction optimization
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.interactionBounds = {};
		
		// Drag & Drop state
		this.dragState = {
			isDragging: false,
			draggedModel: null,
			dragStartTime: 0,
			dragThreshold: 300, // ms to hold before drag starts
			dragTimer: null,
			startPosition: { x: 0, y: 0 },
			lastMousePosition: new THREE.Vector2(),
			dragPlane: new THREE.Plane(),
			dragIntersection: new THREE.Vector3()
		};
		
		// iOS specific fixes
		this.lastTouchTime = 0;
		this.touchStartPos = { x: 0, y: 0 };
		
		// Configuration
		this.config = {
			songs: [
				'songs/CaffineMydrug.mp3',
				'songs/RainbowRoad.mp3',
				'songs/SweetScent.mp3',
				'songs/YouSoElegant.mp3'
			],
			particlesPerLayer: window.innerWidth <= 768 ? 15 : 25,
			isMobile: window.innerWidth <= 768,
			isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
			devicePixelRatio: Math.min(window.devicePixelRatio, 2)
		};
		
		// State
		this.state = {
			isMuted: false,
			audioInitialized: false,
			isAnimating: false,
			lastTime: 0,
			frameCount: 0
		};
		
		// DOM cache
		this.dom = {};
		this.cacheDOM();
		
		// Performance monitoring
		this.performance = {
			lastFPSCheck: 0,
			frames: 0,
			fps: 60
		};
		
		// Animation optimization
		this.animationGroups = {
			models: [],
			lights: [],
			effects: []
		};
		
		this.init();
	}

	// Cache frequently used DOM elements
	cacheDOM() {
		this.dom = {
			container: document.getElementById('container'),
			threeContainer: document.getElementById('three-container'),
			loadingScreen: document.getElementById('loading-screen'),
			backgroundImage: document.getElementById('background-image'),
			treeImage: document.getElementById('tree-image'),
			treeFallback: document.getElementById('tree-fallback'),
			muteText: document.getElementById('mute-text'),
			logoImage: document.getElementById('logo-image'),
			nowPlaying: document.getElementById('now-playing'),
			nowPlayingText: document.getElementById('now-playing-text'),
			windLayers: [
				document.getElementById('wind-particles-back'),
				document.getElementById('wind-particles-between-bg'),
				document.getElementById('wind-particles-between-tree'),
				document.getElementById('wind-particles-between-3d'),
				document.getElementById('wind-particles-front')
			]
		};
	}

	async init() {
		try {
			console.log('Initializing optimized experience...');
			this.setupScene();
			this.setupLighting();
			this.setupCamera();
			this.setupRenderer();
			this.setupWindSystem();
			this.setupAudio();
			await this.loadModels();
			this.setupEventListeners();
			this.animate();
			console.log('Initialization complete!');
		} catch (error) {
			console.error('Initialization error:', error);
		} finally {
			this.hideLoadingScreen();
		}
	}

	setupScene() {
		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.Fog(0x8a9ba8, 10, 50);
	}

	setupLighting() {
		// Optimized lighting setup
		const lights = [
			{ type: 'ambient', color: 0x404040, intensity: 0.6 },
			{ type: 'directional', color: 0xffffff, intensity: 0.8, position: [5, 10, 5] }
		];

		lights.forEach(lightConfig => {
			let light;
			if (lightConfig.type === 'ambient') {
				light = new THREE.AmbientLight(lightConfig.color, lightConfig.intensity);
			} else if (lightConfig.type === 'directional') {
				light = new THREE.DirectionalLight(lightConfig.color, lightConfig.intensity);
				if (lightConfig.position) {
					light.position.set(...lightConfig.position);
				}
				light.castShadow = true;
				light.shadow.mapSize.width = 1024;
				light.shadow.mapSize.height = 1024;
			}
			this.scene.add(light);
		});

		// Magical point lights (reduced on mobile)
		const lightCount = this.config.isMobile ? 2 : 4;
		const colors = [0xff69b4, 0x00ffff, 0xffff00, 0xff4500];
		
		for (let i = 0; i < lightCount; i++) {
			const light = new THREE.PointLight(colors[i], 0.3, 10);
			const angle = (i / lightCount) * Math.PI * 2;
			light.position.set(
				Math.cos(angle) * 3,
				2,
				Math.sin(angle) * 3
			);
			light.userData = { index: i, type: 'magical' };
			this.scene.add(light);
			this.animationGroups.lights.push(light);
		}
	}

	setupCamera() {
		this.camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		this.camera.position.set(0, 2, this.config.isMobile ? 12 : 8);
		this.camera.lookAt(0, 0, 0);
	}

	setupRenderer() {
		this.renderer = new THREE.WebGLRenderer({ 
			antialias: !this.config.isMobile,
			alpha: true,
			powerPreference: this.config.isMobile ? "low-power" : "high-performance"
		});
		
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(this.config.devicePixelRatio);
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		
		this.dom.threeContainer.appendChild(this.renderer.domElement);
	}

	setupWindSystem() {
		this.windSystem = {
			strength: 0,
			direction: new THREE.Vector3(1, 0, 0),
			time: 0,
			particles: []
		};

		this.createWindParticles();
		
		const burstInterval = this.config.isMobile ? 8000 : 5000;
		setInterval(() => {
			if (Math.random() > 0.3) {
				this.triggerWindBurst();
			}
		}, burstInterval + Math.random() * 10000);
	}

	createWindParticles() {
		const particlePool = [];
		
		this.dom.windLayers.forEach((container, layerIndex) => {
			if (!container) return;
			
			const fragment = document.createDocumentFragment();
			
			for (let i = 0; i < this.config.particlesPerLayer; i++) {
				const particle = document.createElement('div');
				particle.className = 'wind-particle';
				
				particle.style.left = '-100px';
				particle.style.top = (Math.random() * 100) + '%';
				
				const layerDelay = layerIndex * 3;
				const animationDelay = Math.random() * 18 + layerDelay;
				const baseDuration = 12 + Math.random() * 6;
				
				particle.style.animationDelay = animationDelay + 's';
				particle.style.animationDuration = baseDuration + 's';
				
				particle.dataset.originalDuration = baseDuration;
				particle.dataset.layerIndex = layerIndex;
				
				const opacities = [0.3, 0.4, 0.6, 0.5, 0.8];
				particle.style.opacity = opacities[layerIndex] || 0.6;
				
				fragment.appendChild(particle);
				particlePool.push(particle);
			}
			
			container.appendChild(fragment);
		});
		
		this.windSystem.particles = particlePool;
		console.log(`Created ${particlePool.length} wind particles across ${this.dom.windLayers.length} layers`);
	}

	setupAudio() {
		this.state.audioInitialized = false;
	}

	initAudioContext() {
		if (!this.state.audioInitialized) {
			try {
				this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
				this.state.audioInitialized = true;
				console.log('Audio context initialized');
			} catch (error) {
				console.log('Audio context not available:', error);
			}
		}
	}

	playRandomSong() {
		this.initAudioContext();
		
		if (this.config.songs.length === 0) {
			this.showNowPlaying('test audio');
			this.accelerateParticles();
			return;
		}
		
		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio = null;
		}

		const randomSong = this.config.songs[Math.floor(Math.random() * this.config.songs.length)];
		const filename = randomSong.split('/').pop().replace('.mp3', '');
		
		this.showNowPlaying(filename);
		
		this.currentAudio = new Audio(randomSong);
		this.currentAudio.volume = this.state.isMuted ? 0 : 0.7;
		
		this.currentAudio.addEventListener('error', () => {
			console.log('Audio playback failed');
		});
		
		this.currentAudio.play().catch(error => {
			console.log('Audio playback failed:', error);
		});
		
		this.accelerateParticles();
	}

	showNowPlaying(filename) {
		this.showBottomMessage(`now playing - ${filename}`);
	}

	showBottomMessage(message) {
		this.dom.nowPlayingText.textContent = message;
		this.dom.nowPlaying.classList.add('show');
		
		setTimeout(() => {
			this.dom.nowPlaying.classList.remove('show');
		}, 4000);
	}

	handleLogoClick() {
		const youtubeUrl = null;
		
		if (youtubeUrl) {
			window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
		} else {
			this.showBottomMessage('no video available');
		}
	}

	accelerateParticles() {
		this.windSystem.particles.forEach(particle => {
			particle.classList.add('burst-accelerating');
		});
		
		setTimeout(() => {
			this.windSystem.particles.forEach(particle => {
				particle.classList.remove('burst-accelerating');
				particle.classList.add('burst-decelerating');
				const originalDuration = particle.dataset.originalDuration + 's';
				particle.style.animationDuration = originalDuration;
			});
			
			setTimeout(() => {
				this.windSystem.particles.forEach(particle => {
					particle.classList.remove('burst-decelerating');
				});
			}, 2000);
		}, 1500);
	}

	async loadModels() {
		console.log('Loading 3D models...');
		
		const loader = new THREE.GLTFLoader();
		const uniformColor = 0x6B8CAE;
		
		const socialData = [
			{ 
				pos: { 
					x: this.config.isMobile ? -2.2 : -4, 
					y: this.config.isMobile ? -0.5 : 0, 
					z: 1 
				},
				social: { 
					file: 'instagram.glb', 
					name: 'instagram', 
					url: 'https://www.instagram.com/xxstrawberrybluexx?igsh=bmdiYTc0d2VsMXd4&utm_source=qr', 
					color: uniformColor, 
					originalColor: 0xff1493 
				}
			},
			{ 
				pos: { 
					x: this.config.isMobile ? 2.2 : 4, 
					y: this.config.isMobile ? -0.5 : 0, 
					z: 1 
				},
				social: { 
					file: 'soundcloud.glb', 
					name: 'soundcloud', 
					url: 'https://on.soundcloud.com/P0XoqxLiC3vwkVRFoL', 
					color: uniformColor, 
					originalColor: 0xff4500 
				}
			},
			{ 
				pos: { 
					x: this.config.isMobile ? -1.5 : -2, 
					y: this.config.isMobile ? 5.5 : 4, 
					z: -1 
				},
				social: { 
					file: 'spotify.glb', 
					name: 'spotify', 
					url: 'https://open.spotify.com/artist/39jFmaBeZvj5R1pGaRw7Zo?si=5Dugh0I2RLqynNQEQ7zhkw', 
					color: uniformColor, 
					originalColor: 0x1db954 
				}
			},
			{ 
				pos: { 
					x: this.config.isMobile ? 1.5 : 2, 
					y: this.config.isMobile ? 5.5 : 4, 
					z: -1 
				},
				social: { 
					file: 'random.glb', 
					name: 'random', 
					url: 'random', 
					color: uniformColor, 
					originalColor: 0x9400d3 
				}
			}
		];

		const modelPromises = socialData.map(async (data, index) => {
			try {
				const gltf = await this.loadGLBModel(loader, `models/${data.social.file}`);
				return this.createSocialModel(gltf.scene, data, index);
			} catch (error) {
				console.log(`GLB ${data.social.name} failed, using fallback:`, error.message);
				return this.createSocialModel(this.createFallbackSocialModel(data.social.color, data.social.name), data, index);
			}
		});

		await Promise.all(modelPromises);
		
		console.log('3D models loaded successfully. Total models:', Object.keys(this.models).length);
		this.setupInteractions();
	}

	loadGLBModel(loader, path) {
		return new Promise((resolve, reject) => {
			loader.load(path, resolve, undefined, reject);
		});
	}

	createSocialModel(modelScene, data, index) {
		modelScene.traverse((child) => {
			if (child.isMesh && child.material) {
				const material = child.material;
				material.emissive = new THREE.Color(data.social.color);
				material.emissiveIntensity = 0.15;
				
				if (material.metalness !== undefined) {
					material.metalness = 0.4;
					material.roughness = 0.6;
				}
				
				if (material.color) {
					material.color = new THREE.Color(data.social.color);
					material.color.multiplyScalar(1.2);
				}
			}
		});

		const glowLight = new THREE.PointLight(data.social.originalColor, 0.8, 3);
		modelScene.add(glowLight);
		
		modelScene.position.set(data.pos.x, data.pos.y, data.pos.z);
		modelScene.scale.setScalar(this.config.isMobile ? 0.5 : 0.7);
		
		modelScene.userData = {
			originalPosition: data.pos,
			type: 'social',
			url: data.social.url,
			name: data.social.name,
			index: index,
			targetPosition: new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z),
			currentWindOffset: new THREE.Vector3(0, 0, 0),
			isResetting: false,
			resetStartTime: 0,
			resetDuration: 1.5,
			resetStartPosition: new THREE.Vector3(),
			glowLight: glowLight,
			isDraggable: true,
			dragOffset: new THREE.Vector3(),
			animationCache: {
				lastFloatY: 0,
				lastFloatX: 0,
				lastWindX: 0,
				lastWindY: 0,
				lastWindZ: 0,
				lastTilt: 0
			}
		};
		
		const interactionGeometry = new THREE.SphereGeometry(this.config.isMobile ? 1.5 : 1.0);
		const interactionMaterial = new THREE.MeshBasicMaterial({ 
			transparent: true, 
			opacity: 0,
			visible: false 
		});
		const interactionMesh = new THREE.Mesh(interactionGeometry, interactionMaterial);
		interactionMesh.position.copy(modelScene.position);
		interactionMesh.userData = { 
			type: 'interaction', 
			parentModel: modelScene,
			modelName: data.social.name 
		};
		
		this.scene.add(modelScene);
		this.scene.add(interactionMesh);
		this.models[data.social.name] = modelScene;
		this.animationGroups.models.push(modelScene);
		this.interactionBounds[data.social.name] = interactionMesh;
		
		return modelScene;
	}

	createFallbackSocialModel(color, name) {
		const group = new THREE.Group();
		
		const geometryMap = {
			instagram: () => new THREE.BoxGeometry(1, 1, 0.2),
			soundcloud: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
			spotify: () => new THREE.SphereGeometry(0.6, 16, 16),
			random: () => new THREE.TetrahedronGeometry(0.8),
			default: () => new THREE.BoxGeometry(1, 1, 1)
		};

		const geometry = (geometryMap[name] || geometryMap.default)();
		const material = new THREE.MeshPhysicalMaterial({
			color: color,
			metalness: 0.4,
			roughness: 0.6,
			emissive: color,
			emissiveIntensity: 0.2
		});
		
		const mesh = new THREE.Mesh(geometry, material);
		group.add(mesh);
		
		if (name === 'instagram') {
			const lensGeometry = new THREE.RingGeometry(0.15, 0.25, 16);
			const lensMaterial = new THREE.MeshBasicMaterial({ 
				color: 0xffffff,
				transparent: true,
				opacity: 0.8
			});
			const lens = new THREE.Mesh(lensGeometry, lensMaterial);
			lens.position.z = 0.11;
			group.add(lens);
		}
		
		return group;
	}

	setupInteractions() {
		// Start drag/click detection
		const handlePointerDown = (event) => {
			event.preventDefault();
			
			let clientX, clientY;
			
			if (event.type === 'touchstart') {
				const touch = event.touches[0];
				clientX = touch.clientX;
				clientY = touch.clientY;
				this.touchStartPos.x = clientX;
				this.touchStartPos.y = clientY;
			} else {
				clientX = event.clientX;
				clientY = event.clientY;
			}
			
			this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
			this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
			
			this.dragState.startPosition = { x: clientX, y: clientY };
			this.dragState.lastMousePosition.set(this.mouse.x, this.mouse.y);
			
			// Check if we clicked on a model
			this.raycaster.setFromCamera(this.mouse, this.camera);
			const interactionObjects = Object.values(this.interactionBounds);
			const intersects = this.raycaster.intersectObjects(interactionObjects, true);
			
			if (intersects.length > 0) {
				const clicked = intersects[0].object;
				if (clicked.userData && clicked.userData.type === 'interaction') {
					const model = clicked.userData.parentModel;
					
					// Start drag timer
					this.dragState.dragStartTime = Date.now();
					this.dragState.draggedModel = model;
					
					this.dragState.dragTimer = setTimeout(() => {
						// Long press detected - start dragging
						this.startDrag(model, intersects[0].point);
					}, this.dragState.dragThreshold);
				}
			}
		};

		// Handle movement
		const handlePointerMove = (event) => {
			let clientX, clientY;
			
			if (event.type === 'touchmove') {
				const touch = event.touches[0];
				clientX = touch.clientX;
				clientY = touch.clientY;
			} else {
				clientX = event.clientX;
				clientY = event.clientY;
			}
			
			this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
			this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
			
			// Check if we've moved enough to cancel click (but not drag)
			if (this.dragState.dragTimer && !this.dragState.isDragging) {
				const deltaX = Math.abs(clientX - this.dragState.startPosition.x);
				const deltaY = Math.abs(clientY - this.dragState.startPosition.y);
				
				if (deltaX > 10 || deltaY > 10) {
					clearTimeout(this.dragState.dragTimer);
					this.dragState.dragTimer = null;
					this.dragState.draggedModel = null;
				}
			}
			
			// If dragging, update position
			if (this.dragState.isDragging && this.dragState.draggedModel) {
				this.updateDrag();
			} else {
				// Hover effect when not dragging
				this.updateHover();
			}
		};

		// End drag/click
		const handlePointerUp = (event) => {
			const wasDragging = this.dragState.isDragging;
			
			// Clear drag timer
			if (this.dragState.dragTimer) {
				clearTimeout(this.dragState.dragTimer);
				this.dragState.dragTimer = null;
			}
			
			if (wasDragging) {
				// End drag
				this.endDrag();
			} else if (this.dragState.draggedModel) {
				// Quick click - execute normal action
				let clientX, clientY;
				
				if (event.type === 'touchend') {
					const touch = event.changedTouches[0];
					clientX = touch.clientX;
					clientY = touch.clientY;
					
					const deltaX = Math.abs(clientX - this.touchStartPos.x);
					const deltaY = Math.abs(clientY - this.touchStartPos.y);
					
					// Only trigger if it's a tap (not a swipe)
					if (deltaX < 10 && deltaY < 10) {
						const model = this.dragState.draggedModel;
						this.handleSocialClick(model.userData, model);
					}
				} else {
					const model = this.dragState.draggedModel;
					this.handleSocialClick(model.userData, model);
				}
			}
			
			this.dragState.draggedModel = null;
			this.dragState.isDragging = false;
		};

		// Add event listeners
		this.dom.threeContainer.addEventListener('mousedown', handlePointerDown);
		this.dom.threeContainer.addEventListener('touchstart', handlePointerDown, { passive: false });
		
		window.addEventListener('mousemove', handlePointerMove);
		window.addEventListener('touchmove', handlePointerMove, { passive: false });
		
		window.addEventListener('mouseup', handlePointerUp);
		window.addEventListener('touchend', handlePointerUp, { passive: false });
	}

	startDrag(model, intersectionPoint) {
		this.dragState.isDragging = true;
		document.body.style.cursor = 'grabbing';
		
		// Calculate drag plane (parallel to camera)
		this.dragState.dragPlane.setFromNormalAndCoplanarPoint(
			this.camera.getWorldDirection(this.dragState.dragPlane.normal),
			model.position
		);
		
		// Calculate offset
		model.userData.dragOffset.copy(intersectionPoint).sub(model.position);
	}

	updateDrag() {
		if (!this.dragState.isDragging || !this.dragState.draggedModel) return;
		
		this.raycaster.setFromCamera(this.mouse, this.camera);
		
		// Intersect with drag plane
		if (this.raycaster.ray.intersectPlane(this.dragState.dragPlane, this.dragState.dragIntersection)) {
			const model = this.dragState.draggedModel;
			
			// Update position
			model.position.copy(this.dragState.dragIntersection).sub(model.userData.dragOffset);
			
			// Update interaction bounds
			const interactionMesh = this.interactionBounds[model.userData.name];
			if (interactionMesh) {
				interactionMesh.position.copy(model.position);
			}
			
			// Stop wind animation while dragging
			model.userData.isResetting = false;
		}
	}

	endDrag() {
		if (this.dragState.draggedModel) {
			const model = this.dragState.draggedModel;
			
			// Update original position to current position
			model.userData.originalPosition = {
				x: model.position.x,
				y: model.position.y,
				z: model.position.z
			};
		}
		
		this.dragState.isDragging = false;
		this.dragState.draggedModel = null;
		document.body.style.cursor = 'default';
	}

	updateHover() {
		this.raycaster.setFromCamera(this.mouse, this.camera);
		
		// Reset all models
		this.animationGroups.models.forEach(model => {
			if (model.userData.type === 'social') {
				const baseScale = this.config.isMobile ? 0.5 : 0.7;
				model.scale.setScalar(baseScale);
			}
		});

		// Check for hover
		const interactionObjects = Object.values(this.interactionBounds);
		const intersects = this.raycaster.intersectObjects(interactionObjects, true);

		if (intersects.length > 0) {
			const hovered = intersects[0].object;
			if (hovered.userData && hovered.userData.type === 'interaction') {
				const model = hovered.userData.parentModel;
				const hoverScale = this.config.isMobile ? 0.65 : 0.85;
				model.scale.setScalar(hoverScale);
				document.body.style.cursor = 'pointer';
			}
		} else {
			document.body.style.cursor = 'default';
		}
	}

	findParentWithUserData(object) {
		let current = object;
		while (current) {
			if (current.userData && current.userData.type) {
				return current;
			}
			current = current.parent;
		}
		return null;
	}

	handleSocialClick(userData, model) {
		// Don't trigger if we're in the middle of starting a drag
		if (this.dragState.dragTimer) return;
		
		this.resetModelPosition(model);
		
		if (userData.url === 'random') {
			this.playRandomSong();
		} else {
			window.open(userData.url, '_blank', 'noopener,noreferrer');
			this.createClickEffect(userData.originalPosition);
			this.triggerWindBurst();
		}
	}

	resetModelPosition(model) {
		const userData = model.userData;
		const currentTime = Date.now() * 0.001;
		
		userData.resetStartPosition.copy(model.position);
		userData.resetStartTime = currentTime;
		userData.isResetting = true;
	}

	createClickEffect(position) {
		const geometry = new THREE.RingGeometry(0.1, 0.5, 16);
		const material = new THREE.MeshBasicMaterial({ 
			color: 0xffffff,
			transparent: true,
			opacity: 1
		});
		const ring = new THREE.Mesh(geometry, material);
		ring.position.set(position.x, position.y, position.z);
		this.scene.add(ring);

		const startTime = Date.now();
		const animateRing = () => {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / 1000;
			
			if (progress < 1 && ring.parent) {
				ring.scale.setScalar(1 + progress * 2);
				ring.material.opacity = 1 - progress;
				requestAnimationFrame(animateRing);
			} else {
				if (ring.parent) {
					this.scene.remove(ring);
				}
				geometry.dispose();
				material.dispose();
			}
		};
		animateRing();
	}

	setupEventListeners() {
		let resizeTimeout = null;
		const debouncedResize = () => {
			if (resizeTimeout) clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				this.onWindowResize();
			}, 250);
		};
		
		window.addEventListener('resize', debouncedResize);
		
		// iOS compatible mute button
		const muteHandler = (e) => {
			e.preventDefault();
			this.state.isMuted = !this.state.isMuted;
			this.dom.muteText.textContent = this.state.isMuted ? 'unmute' : 'mute';
			if (this.currentAudio) {
				this.currentAudio.volume = this.state.isMuted ? 0 : 0.7;
			}
		};
		
		this.dom.muteText.addEventListener('click', muteHandler);
		this.dom.muteText.addEventListener('touchend', muteHandler);

		// iOS compatible logo handler
		const logoHandler = (e) => {
			e.preventDefault();
			this.handleLogoClick();
		};
		
		this.dom.logoImage.addEventListener('click', logoHandler);
		this.dom.logoImage.addEventListener('touchend', logoHandler);

		this.dom.logoImage.style.cursor = 'pointer';

		window.addEventListener('keydown', (event) => {
			switch(event.key) {
				case ' ':
					event.preventDefault();
					this.triggerWindBurst();
					break;
				case 'm':
				case 'M':
					this.dom.muteText.click();
					break;
			}
		});
	}

	triggerWindBurst() {
		const currentStrength = this.windSystem.strength;
		const targetStrength = Math.max(currentStrength + 0.8, 1.2);
		
		this.windSystem.direction.set(
			1 + (Math.random() - 0.5) * 0.2,
			(Math.random() - 0.5) * 0.15,
			(Math.random() - 0.5) * 0.2
		).normalize();

		const increaseWind = () => {
			if (this.windSystem.strength < targetStrength) {
				this.windSystem.strength += (targetStrength - this.windSystem.strength) * 0.15;
				requestAnimationFrame(increaseWind);
			}
		};
		increaseWind();
	}

	onWindowResize() {
		this.config.isMobile = window.innerWidth <= 768;
		
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.camera.position.z = this.config.isMobile ? 12 : 8;
		
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		
		Object.values(this.models).forEach(model => {
			const interactionMesh = this.interactionBounds[model.userData.name];
			if (interactionMesh) {
				interactionMesh.position.copy(model.position);
			}
		});
	}

	animate() {
		requestAnimationFrame(() => this.animate());
		
		const time = Date.now() * 0.001;
		const deltaTime = time - this.state.lastTime;
		this.state.lastTime = time;
		this.windSystem.time = time;

		if (this.state.frameCount % 60 === 0) {
			this.performance.frames++;
			if (time - this.performance.lastFPSCheck > 1) {
				this.performance.fps = this.performance.frames;
				this.performance.frames = 0;
				this.performance.lastFPSCheck = time;
			}
		}
		this.state.frameCount++;

		if (this.performance.fps < 30 && this.state.frameCount % 2 === 0) {
			this.renderer.render(this.scene, this.camera);
			return;
		}

		this.windSystem.strength *= 0.999;

		this.animateModelsOptimized(time, deltaTime);

		if (this.state.frameCount % 3 === 0) {
			this.animateLightsOptimized(time, deltaTime);
		}

		if (this.state.frameCount % 4 === 0) {
			this.updateBackgroundInterplay(time);
		}

		this.renderer.render(this.scene, this.camera);
	}

	animateModelsOptimized(time, deltaTime) {
		const windStrength = this.windSystem.strength;
		const windInfluence = windStrength * 0.4;
		const lerpFactor = Math.min(deltaTime * 3, 1);
		
		this.animationGroups.models.forEach((model) => {
			const userData = model.userData;
			const cache = userData.animationCache;
			const originalPos = userData.originalPosition;
			
			if (userData.glowLight && this.state.frameCount % 2 === 0) {
				const pulseFactor = 0.5 + 0.5 * Math.sin(time * 2 + userData.index * 1.2);
				userData.glowLight.intensity = 0.3 + pulseFactor * 0.4;
			}
			
			// Don't animate if being dragged
			if (this.dragState.isDragging && this.dragState.draggedModel === model) {
				return;
			}
			
			if (userData.isResetting) {
				this.handleModelResetOptimized(model, time);
			} else {
				const newFloatY = Math.sin(time * 0.5 + userData.index * 0.8) * 0.05;
				const newFloatX = Math.cos(time * 0.3 + userData.index * 0.6) * 0.015;
				
				const newWindX = Math.sin(time * 1.8 + userData.index * 0.6) * windInfluence;
				const newWindZ = Math.cos(time * 1.3 + userData.index * 0.8) * windInfluence * 0.6;
				const newWindY = Math.sin(time * 2.2 + userData.index * 1.0) * windInfluence * 0.25;
				
				const threshold = 0.001;
				if (Math.abs(newFloatY - cache.lastFloatY) > threshold ||
					Math.abs(newFloatX - cache.lastFloatX) > threshold ||
					Math.abs(newWindX - cache.lastWindX) > threshold ||
					Math.abs(newWindY - cache.lastWindY) > threshold ||
					Math.abs(newWindZ - cache.lastWindZ) > threshold) {
					
					cache.lastFloatY = newFloatY;
					cache.lastFloatX = newFloatX;
					cache.lastWindX = newWindX;
					cache.lastWindY = newWindY;
					cache.lastWindZ = newWindZ;
					
					const targetX = originalPos.x + newFloatX + newWindX;
					const targetY = originalPos.y + newFloatY + newWindY;
					const targetZ = originalPos.z + newWindZ;
					
					model.position.x += (targetX - model.position.x) * lerpFactor;
					model.position.y += (targetY - model.position.y) * lerpFactor;
					model.position.z += (targetZ - model.position.z) * lerpFactor;
					
					const interactionMesh = this.interactionBounds[userData.name];
					if (interactionMesh) {
						interactionMesh.position.copy(model.position);
					}
				}
				
				const baseTilt = Math.sin(time * 0.7 + userData.index) * 0.02;
				const windTilt = windStrength * Math.cos(time * 2.2 + userData.index) * 0.05;
				const targetTiltZ = baseTilt + windTilt;
				
				if (Math.abs(targetTiltZ - cache.lastTilt) > threshold) {
					cache.lastTilt = targetTiltZ;
					model.rotation.z += (targetTiltZ - model.rotation.z) * lerpFactor;
				}
			}
		});
	}

	handleModelResetOptimized(model, time) {
		const userData = model.userData;
		const resetElapsed = time - userData.resetStartTime;
		const resetProgress = Math.min(resetElapsed / userData.resetDuration, 1);
		const easedProgress = 1 - Math.pow(1 - resetProgress, 3);
		
		const originalPos = userData.originalPosition;
		const targetX = userData.resetStartPosition.x + (originalPos.x - userData.resetStartPosition.x) * easedProgress;
		const targetY = userData.resetStartPosition.y + (originalPos.y - userData.resetStartPosition.y) * easedProgress;
		const targetZ = userData.resetStartPosition.z + (originalPos.z - userData.resetStartPosition.z) * easedProgress;
		
		model.position.set(targetX, targetY, targetZ);
		model.rotation.z *= (1 - easedProgress);
		
		const interactionMesh = this.interactionBounds[userData.name];
		if (interactionMesh) {
			interactionMesh.position.copy(model.position);
		}
		
		if (resetProgress >= 1) {
			userData.isResetting = false;
			model.position.set(originalPos.x, originalPos.y, originalPos.z);
			model.rotation.z = 0;
			if (interactionMesh) {
				interactionMesh.position.copy(model.position);
			}
		}
	}

	animateLightsOptimized(time, deltaTime) {
		const lightLerpFactor = Math.min(deltaTime * 1.5, 1);
		
		this.animationGroups.lights.forEach((light) => {
			if (light.isPointLight && light.userData && light.userData.type === 'magical') {
				const angle = time * 0.3 + light.userData.index;
				const targetX = Math.cos(angle) * 2.5;
				const targetZ = Math.sin(angle) * 2.5;
				const targetY = 2 + Math.sin(time * 1.0 + light.userData.index) * 0.2;
				
				light.position.x += (targetX - light.position.x) * lightLerpFactor;
				light.position.z += (targetZ - light.position.z) * lightLerpFactor;
				light.position.y += (targetY - light.position.y) * lightLerpFactor;
			}
		});
	}

	updateBackgroundInterplay(time) {
		if (!this.dom.backgroundImage || !this.dom.treeImage) return;
		
		let totalMovement = 0;
		let averageX = 0;
		let averageY = 0;
		
		this.animationGroups.models.forEach((model) => {
			const userData = model.userData;
			const originalPos = userData.originalPosition;
			
			const deltaX = model.position.x - originalPos.x;
			const deltaY = model.position.y - originalPos.y;
			const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			totalMovement += movement;
			
			averageX += deltaX;
			averageY += deltaY;
		});
		
		const modelCount = this.animationGroups.models.length;
		if (modelCount > 0) {
			averageX /= modelCount;
			averageY /= modelCount;
		}
		
		const parallaxX = averageX * 1.5;
		const parallaxY = averageY * 1.5;
		const windEffect = this.windSystem.strength;
		
		const baseOpacity = 0.2;
		const finalOpacity = Math.min(baseOpacity + totalMovement * 0.08 + windEffect * 0.04, 0.35);
		const finalBrightness = Math.min(0.8 + totalMovement * 0.08, 1.1);
		
		this.dom.backgroundImage.style.transform = `translate(${parallaxX}px, ${parallaxY}px)`;
		this.dom.backgroundImage.style.opacity = finalOpacity;
		this.dom.backgroundImage.style.filter = `blur(2px) brightness(${finalBrightness})`;
		
		this.dom.treeImage.style.transform = `translate(${-parallaxX * 0.2}px, ${-parallaxY * 0.2}px) scale(0.96)`;
		
		if (windEffect > 1) {
			const glowIntensity = Math.min((windEffect - 1) * 0.25, 0.25);
			this.dom.treeImage.style.filter = `drop-shadow(0 0 20px rgba(255, 255, 255, ${glowIntensity + 0.3}))`;
		}
	}

	hideLoadingScreen() {
		setTimeout(() => {
			this.dom.loadingScreen.style.opacity = '0';
			setTimeout(() => {
				this.dom.loadingScreen.style.display = 'none';
				
				setTimeout(() => {
					if (this.dom.backgroundImage) {
						this.dom.backgroundImage.classList.add('fade-in');
					}
				}, 400);
			}, 300);
		}, 400);
	}

	dispose() {
		this.scene.traverse((object) => {
			if (object.geometry) {
				object.geometry.dispose();
			}
			if (object.material) {
				if (Array.isArray(object.material)) {
					object.material.forEach(material => material.dispose());
				} else {
					object.material.dispose();
				}
			}
		});

		if (this.renderer) {
			this.renderer.dispose();
		}

		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio = null;
		}

		window.removeEventListener('resize', this.onWindowResize);
		
		console.log('Experience disposed');
	}
}

document.addEventListener('DOMContentLoaded', () => {
	console.log('Initializing optimized Mystical Tree Experience...');
	window.mysticalExperience = new MysticalTreeExperience();
});

document.addEventListener('visibilitychange', () => {
	if (window.mysticalExperience) {
		if (document.hidden) {
			if (window.mysticalExperience.currentAudio) {
				window.mysticalExperience.currentAudio.pause();
			}
		}
	}
});
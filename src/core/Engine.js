import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ParticlesInstance } from '../effects/Particles.js';

class Engine {
  constructor() {
    this.scene = null;
    this.renderer = null;
    this.labelRenderer = null;
    
    // Post-processing
    this.composer = null;
    this.bloomPass = null;
    this.bloomEnabled = false;

    this.container = null;
    this.clock = new THREE.Clock();
    
    // Callbacks to invoke in frame loop
    this.onUpdateCallbacks = [];
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container element #${containerId} not found.`);
      return;
    }

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Create Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03020b);
    this.scene.fog = new THREE.FogExp2(0x03020b, 0.00012);

    // Initialize Global Particle Systems
    ParticlesInstance.init(this.scene);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Tone mapping for cinematic highlights (Sun bloom looks much better)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // 3. CSS2D Label Renderer
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0px';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.labelRenderer.domElement);

    // 4. Post-processing Bloom Setup
    // Fallback camera for composer setup, will be updated during run
    const dummyCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderPass = new RenderPass(this.scene, dummyCamera);
    
    // UnrealBloomPass parameters: resolution, strength, radius, threshold
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5, // strength
      0.4, // radius
      0.15 // threshold (lower threshold = more glow)
    );

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);

    // 5. Resize Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 6. Start Loop
    this.animate();
  }

  onWindowResize() {
    if (!this.container || !this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
    this.composer.setSize(width, height);
    
    // Cameras will need to update their projection matrix
    this.scene.traverse((obj) => {
      if (obj.isCamera) {
        obj.aspect = width / height;
        obj.updateProjectionMatrix();
      }
    });
  }

  // Set the current camera in the post-processing RenderPass
  setCamera(camera) {
    this.composer.passes[0].camera = camera;
    this.activeCamera = camera;
  }

  setBloomEnabled(enabled) {
    this.bloomEnabled = enabled;
  }

  registerUpdateCallback(callback) {
    this.onUpdateCallbacks.push(callback);
  }

  unregisterUpdateCallback(callback) {
    this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();
    
    // Run update callbacks
    for (let i = 0; i < this.onUpdateCallbacks.length; i++) {
      this.onUpdateCallbacks[i](delta, this.clock.getElapsedTime());
    }

    // Render pass
    if (this.activeCamera) {
      if (this.bloomEnabled) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.activeCamera);
      }
      this.labelRenderer.render(this.scene, this.activeCamera);
    }
  }
}

export const EngineInstance = new Engine();
export { Engine };

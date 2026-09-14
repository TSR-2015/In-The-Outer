import * as THREE from 'three';
import { AssetInstance } from '../managers/AssetLoader.js';

class SolarSystem {
  constructor() {
    this.group = new THREE.Group();
    this.mixer = null;
    this.orbitLines = [];
    this.sunMesh = null;
    this.sunCorona = null;
    this.sunLight = null;
    
    // Kept for coordinate reference if needed
    this.orbitalRadii = {
      mercury: 9.69 * 5.0,
      venus: 12.23 * 5.0,
      earth: 16.11 * 5.0,
      mars: 20.45 * 5.0
    };
  }

  init(scene) {
    // 1. Create starfield and nebulae
    this.createStarfield();
    this.createNebulae();

    // 2. Clear any previous groups to avoid duplication
    while (this.group.children.length > 2) {
      this.group.remove(this.group.children[2]);
    }

    // 3. Add the Solar System GLB model
    const solarSystemModel = AssetInstance.getSolarSystemModel();
    solarSystemModel.name = "solar_system_model";
    
    // Scale up the Solar System model
    solarSystemModel.scale.set(5.0, 5.0, 5.0);

    // Enlarge GLB Sun node inside model if present
    solarSystemModel.traverse((child) => {
      if (child.name && child.name.toLowerCase().includes("sun")) {
        child.scale.set(3.5, 3.5, 3.5);
      }
    });

    this.group.add(solarSystemModel);

    // 4. Setup animation mixer for planetary revolution
    const animations = AssetInstance.getSolarSystemAnimations();
    if (animations && animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(solarSystemModel);
      const action = this.mixer.clipAction(animations[0]);
      action.play();
      this.mixer.timeScale = 0.5; // slow down orbits slightly for cinematic feel
    }

    // 5. Build Suitably Big Glowing 3D Sun & Corona Atmosphere Halo
    this.buildGlowingSun();

    // 6. Central solar point light
    this.sunLight = new THREE.PointLight(0xfff5ea, 3.0, 800, 0.15);
    this.sunLight.castShadow = true;
    this.sunLight.position.set(0, 0, 0);
    this.group.add(this.sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.group.add(ambientLight);

    // 7. Draw dynamic dashed orbit rings for the research satellites with subtle glow
    this.drawSatelliteOrbitRings();

    scene.add(this.group);
  }

  // BUILD SUITABLY BIG GLOWING 3D SUN & CORONA HALO
  buildGlowingSun() {
    const sunGroup = new THREE.Group();
    sunGroup.name = "glowing_sun_group";

    // A. Main Sun Sphere (Radius 12.0 units - Suitably grand and prominent!)
    const sunGeom = new THREE.SphereGeometry(12.0, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24, // Vibrant solar yellow-gold
    });
    this.sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunGroup.add(this.sunMesh);

    // B. Inner Solar Corona Glow Layer (Radius 15.0)
    const innerCoronaGeom = new THREE.SphereGeometry(15.0, 32, 32);
    const innerCoronaMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    const innerCorona = new THREE.Mesh(innerCoronaGeom, innerCoronaMat);
    sunGroup.add(innerCorona);

    // C. Outer Radial Corona Halo Billboard Sprite (Radius 28.0)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.95)'); // Soft solar core yellow
    grad.addColorStop(0.3, 'rgba(245, 158, 11, 0.65)'); // Warm amber glow
    grad.addColorStop(0.6, 'rgba(217, 119, 6, 0.3)');  // Deep orange flare
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const coronaTex = new THREE.CanvasTexture(canvas);

    const coronaGeom = new THREE.PlaneGeometry(60, 60);
    const coronaMat = new THREE.MeshBasicMaterial({
      map: coronaTex,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.sunCorona = new THREE.Mesh(coronaGeom, coronaMat);
    sunGroup.add(this.sunCorona);

    this.group.add(sunGroup);
  }

  drawSatelliteOrbitRings() {
    this.orbitLines = [];
    const drawRing = (radius) => {
      const points = [];
      const segments = 128;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineDashedMaterial({
        color: 0xf59e0b, // glowing warm gold
        dashSize: 1.8,
        gapSize: 2.2,
        transparent: true,
        opacity: 0.22 // subtle glowing opacity (not too bright)
      });
      const ring = new THREE.Line(geom, mat);
      ring.computeLineDistances();
      this.group.add(ring);
      this.orbitLines.push(ring);
    };

    // Draw the three paths: Parker Solar Probe (36), Solar Orbiter (42), and Earth Orbit Satellite (82)
    drawRing(36.0);
    drawRing(42.0);
    drawRing(82.0);
  }

  createStarfield() {
    const starCount = 2000;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 400 + Math.random() * 250;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 8);
    const starTex = new THREE.CanvasTexture(canvas);

    const mat = new THREE.PointsMaterial({
      size: 1.8,
      map: starTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const starfield = new THREE.Points(geom, mat);
    this.group.add(starfield);
  }

  createNebulae() {
    const geom = new THREE.PlaneGeometry(500, 500);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(245, 158, 11, 0.015)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const nebula = new THREE.Mesh(geom, mat);
    nebula.position.set(0, -50, -250);
    this.group.add(nebula);
  }

  update(delta, time) {
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 1. Animated Sun Pulse, Granulation Spin & Corona Glow
    if (this.sunMesh) {
      this.sunMesh.rotation.y = time * 0.06;
      const sunPulse = 1.0 + Math.sin(time * 2.0) * 0.025;
      this.sunMesh.scale.setScalar(sunPulse);
    }

    if (this.sunCorona) {
      // Rotate corona halo slowly
      this.sunCorona.rotation.z = time * 0.03;
      
      // Pulse corona scale & opacity for dynamic glowing animation
      const coronaScale = 1.0 + Math.sin(time * 2.5) * 0.08;
      this.sunCorona.scale.setScalar(coronaScale);
      
      if (this.sunCorona.material) {
        this.sunCorona.material.opacity = 0.75 + Math.sin(time * 3.5) * 0.15;
      }
    }

    if (this.sunLight) {
      this.sunLight.intensity = 2.8 + Math.sin(time * 3.0) * 0.4;
    }

    // 2. Animate subtle moving energy glow on orbital axes lines
    this.orbitLines.forEach((ring) => {
      if (ring.material) {
        ring.material.dashOffset -= delta * 0.4;
      }
    });
  }
}

export const SolarSystemInstance = new SolarSystem();
export { SolarSystem };

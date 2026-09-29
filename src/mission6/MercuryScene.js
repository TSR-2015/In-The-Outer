import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetInstance } from '../managers/AssetLoader.js';

class MercuryScene {
  constructor() {
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.mercuryGroup = null;
    this.mercuryMesh = null;
    this.probeGroup = null;
    this.brokenProbeGroup = null;
    this.navLight = null;

    this.orbitRadius = 28;
    this.orbitAngle = 0;
    this.orbitSpeed = 0.42;

    this.targetMarkers = [];
    this.impactParticles = null;
    this.craterMesh = null;

    this.mode = 'ORBIT'; // ORBIT, DESCENT, IMPACT_RESULT
    this.cameraMode = 'probe'; // probe (chase cam), free, planet
    this.descentProgress = 0;
    this.impactTime = 0;
    this.animationFrameId = null;
  }

  init(containerEl) {
    if (!containerEl) return;
    this.container = containerEl;
    this.container.innerHTML = '';

    const width = (this.container.clientWidth && this.container.clientWidth > 0) ? this.container.clientWidth : window.innerWidth;
    const height = (this.container.clientHeight && this.container.clientHeight > 0) ? this.container.clientHeight : window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020208);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.setCameraMode('probe');

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    sunLight.position.set(100, 30, 80);
    sunLight.castShadow = true;
    this.scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x111122, 0.35);
    this.scene.add(ambientLight);

    // 5. Starfield
    this.createStarfield();

    // 6. Load Mercury GLB
    this.loadMercuryGLB();

    // 7. Orbit ring path
    this.createOrbitRing();

    // 8. Spacecraft Probe
    this.createProbe();

    // 9. Target Markers
    this.createTargetMarkers();

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  loadMercuryGLB() {
    this.mercuryGroup = new THREE.Group();
    this.scene.add(this.mercuryGroup);

    const loader = new GLTFLoader();
    const loadModel = (url, fallback) => {
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(7.0, 7.0, 7.0);
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.roughness = 0.85;
                child.material.metalness = 0.15;
              }
            }
          });
          this.mercuryGroup.add(model);
          this.mercuryMesh = model;
          console.log(`[MercuryScene]: mercury.glb model loaded successfully from ${url}.`);
        },
        undefined,
        (error) => {
          if (fallback) {
            console.warn(`[MercuryScene]: Primary URL ${url} failed, retrying fallback: ${fallback}`);
            loadModel(fallback, null);
            return;
          }
          console.error('[MercuryScene]: Error loading mercury.glb model, using fallback planet mesh:', error);
          this.createFallbackMercury();
        }
      );
    };

    loadModel('/models/mission6/mercury.glb', '/mercury.glb');
  }

  createFallbackMercury() {
    const geometry = new THREE.SphereGeometry(14, 64, 64);
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#656360'; ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = '#3a3836'; ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 256, Math.random() * 15 + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const bumpTex = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshStandardMaterial({
      map: bumpTex, bumpMap: bumpTex, bumpScale: 0.6, roughness: 0.85, metalness: 0.1
    });
    const fallbackMesh = new THREE.Mesh(geometry, material);
    this.mercuryGroup.add(fallbackMesh);
    this.mercuryMesh = fallbackMesh;
  }

  createStarfield() {
    const starsGeo = new THREE.BufferGeometry();
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 450;
      positions[i + 1] = (Math.random() - 0.5) * 450;
      positions[i + 2] = (Math.random() - 0.5) * 450;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xdddddd, size: 0.8 });
    const starfield = new THREE.Points(starsGeo, starsMat);
    this.scene.add(starfield);
  }

  createOrbitRing() {
    const curve = new THREE.EllipseCurve(0, 0, this.orbitRadius, this.orbitRadius, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(120);
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, 0, p.y)));
    const material = new THREE.LineDashedMaterial({
      color: 0x38bdf8, dashSize: 1.2, gapSize: 0.6, opacity: 0.5, transparent: true
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.scene.add(line);
  }

  createProbe() {
    this.probeGroup = new THREE.Group();

    let baseMesh = null;
    try {
      baseMesh = AssetInstance.getSatelliteModel(1);
    } catch (e) {
      baseMesh = null;
    }

    if (baseMesh) {
      this.probeGroup.add(baseMesh);
      this.probeGroup.scale.set(0.35, 0.35, 0.35);
    } else {
      // Procedural MESSENGER Spacecraft
      const bodyGeo = new THREE.BoxGeometry(1.8, 2.2, 1.8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      this.probeGroup.add(body);

      const shieldGeo = new THREE.BoxGeometry(3.2, 3.2, 0.15);
      const shieldMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.set(0, 0, 1.05);
      this.probeGroup.add(shield);

      const wingGeo = new THREE.BoxGeometry(6.5, 0.1, 1.6);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.2 });
      const wings = new THREE.Mesh(wingGeo, wingMat);
      wings.position.set(0, 0, -0.2);
      this.probeGroup.add(wings);

      this.probeGroup.scale.set(0.45, 0.45, 0.45);
    }

    // Beacon Light
    const lightGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.navLight = new THREE.Mesh(lightGeo, lightMat);
    this.navLight.position.set(0, 1.8, 0);
    this.probeGroup.add(this.navLight);

    this.scene.add(this.probeGroup);
  }

  createTargetMarkers() {
    const targetAngles = [0, 1.25, 2.5, 3.75, 5.0];
    targetAngles.forEach((ang, idx) => {
      const geo = new THREE.RingGeometry(0.8, 1.3, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.8
      });
      const ring = new THREE.Mesh(geo, mat);
      const radius = 14.1;
      ring.position.x = Math.cos(ang) * radius;
      ring.position.z = Math.sin(ang) * radius;
      ring.position.y = (idx % 2 === 0 ? 1 : -1) * 3;
      ring.lookAt(0, 0, 0);

      this.mercuryGroup.add(ring);
      this.targetMarkers.push(ring);
    });
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    if (!this.camera) return;
    if (mode === 'free') {
      this.camera.position.set(0, 20, 55);
      this.camera.lookAt(0, 0, 0);
    } else if (mode === 'planet') {
      this.camera.position.set(0, 4, 32);
      this.camera.lookAt(0, 0, 0);
    }
  }

  triggerImpactSequence(onImpactComplete) {
    this.mode = 'DESCENT';
    this.descentProgress = 0;
    this.onImpactComplete = onImpactComplete;
  }

  createBrokenProbe() {
    this.brokenProbeGroup = new THREE.Group();

    const scorchedMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 });
    const brokenWingMat = new THREE.MeshStandardMaterial({ color: 0x001122, roughness: 0.8, metalness: 0.2 });

    const bodyGeo = new THREE.BoxGeometry(1.8, 1.2, 1.8);
    const body = new THREE.Mesh(bodyGeo, scorchedMat);
    body.rotation.set(0.5, 0.3, -0.4);
    this.brokenProbeGroup.add(body);

    const wing1Geo = new THREE.BoxGeometry(3.2, 0.08, 1.5);
    const wing1 = new THREE.Mesh(wing1Geo, brokenWingMat);
    wing1.position.set(-2.2, 0.2, 0.5);
    wing1.rotation.set(-0.8, 0.4, 0.9);
    this.brokenProbeGroup.add(wing1);

    const wing2Geo = new THREE.BoxGeometry(2.8, 0.08, 1.4);
    const wing2 = new THREE.Mesh(wing2Geo, brokenWingMat);
    wing2.position.set(2.0, -0.3, -0.8);
    wing2.rotation.set(0.6, -0.5, -0.7);
    this.brokenProbeGroup.add(wing2);

    for (let i = 0; i < 8; i++) {
      const fragGeo = new THREE.TetrahedronGeometry(0.3 + Math.random() * 0.3);
      const frag = new THREE.Mesh(fragGeo, scorchedMat);
      frag.position.set((Math.random() - 0.5) * 6, -0.2, (Math.random() - 0.5) * 6);
      frag.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.brokenProbeGroup.add(frag);
    }

    this.brokenProbeGroup.position.set(13.8, 1.5, 3.2);
    this.brokenProbeGroup.scale.set(0.45, 0.45, 0.45);
    this.scene.add(this.brokenProbeGroup);
  }

  createImpactEffects() {
    const craterGeo = new THREE.RingGeometry(0.2, 3.5, 32);
    const craterMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    this.craterMesh = new THREE.Mesh(craterGeo, craterMat);
    this.craterMesh.position.set(13.85, 1.4, 3.2);
    this.craterMesh.lookAt(0, 0, 0);
    this.scene.add(this.craterMesh);

    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = 13.85 + (Math.random() - 0.5) * 0.5;
      positions[i + 1] = 1.4 + (Math.random() - 0.5) * 0.5;
      positions[i + 2] = 3.2 + (Math.random() - 0.5) * 0.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0xf59e0b, size: 0.7, transparent: true, opacity: 1 });
    this.impactParticles = new THREE.Points(particleGeo, particleMat);
    this.scene.add(this.impactParticles);
  }

  captureSnapshot(targetWidth = 512, targetHeight = 512) {
    if (!this.renderer || !this.scene || !this.camera) return null;

    this.renderer.render(this.scene, this.camera);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(this.renderer.domElement, 0, 0, targetWidth, targetHeight);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(targetWidth / 2, targetHeight / 2, targetWidth * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(targetWidth * 0.1, targetHeight / 2);
    ctx.lineTo(targetWidth * 0.9, targetHeight / 2);
    ctx.moveTo(targetWidth / 2, targetHeight * 0.1);
    ctx.lineTo(targetWidth / 2, targetHeight * 0.9);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px "Share Tech Mono", monospace';
    ctx.fillText('MISSION 06 // MERCURY EXPLORER', 20, targetHeight - 30);
    ctx.fillText(new Date().toISOString().substring(0, 19).replace('T', ' '), 20, targetHeight - 12);

    return canvas;
  }

  update(delta, time) {
    if (this.mercuryGroup) {
      this.mercuryGroup.rotation.y += delta * 0.05;
    }

    if (this.navLight) {
      this.navLight.visible = (Math.floor(time * 4) % 2 === 0);
    }

    this.targetMarkers.forEach((m, idx) => {
      const s = 1 + Math.sin(time * 3 + idx) * 0.15;
      m.scale.set(s, s, s);
    });

    if (this.mode === 'ORBIT') {
      this.orbitAngle += delta * this.orbitSpeed;
      if (this.probeGroup) {
        const px = Math.cos(this.orbitAngle) * this.orbitRadius;
        const pz = Math.sin(this.orbitAngle) * this.orbitRadius;
        const py = Math.sin(this.orbitAngle * 2) * 2;
        this.probeGroup.position.set(px, py, pz);

        const vx = -Math.sin(this.orbitAngle);
        const vz = Math.cos(this.orbitAngle);
        const lookTarget = new THREE.Vector3(px + vx * 10, py, pz + vz * 10);
        this.probeGroup.lookAt(lookTarget);

        // Smooth chase camera from behind probe
        if (this.cameraMode === 'probe' && this.camera) {
          const camX = px - vx * 12;
          const camZ = pz - vz * 12;
          const camY = py + 4.5;
          this.camera.position.set(camX, camY, camZ);
          this.camera.lookAt(px + vx * 8, py, pz + vz * 8);
        }
      }
    } else if (this.mode === 'DESCENT') {
      this.descentProgress += delta * 0.45;
      if (this.descentProgress > 1) this.descentProgress = 1;

      const targetPos = new THREE.Vector3(13.85, 1.4, 3.2);
      if (this.probeGroup) {
        this.probeGroup.position.lerp(targetPos, this.descentProgress * 0.15);
        this.probeGroup.rotation.x += delta * 5;
        this.probeGroup.rotation.z += delta * 5;
      }

      this.camera.position.lerp(new THREE.Vector3(22, 6, 12), this.descentProgress * 0.1);
      this.camera.lookAt(targetPos);

      if (this.descentProgress >= 0.95 && !this.craterMesh) {
        this.mode = 'IMPACT_RESULT';
        if (this.probeGroup) this.scene.remove(this.probeGroup);
        this.createBrokenProbe();
        this.createImpactEffects();
        if (this.onImpactComplete) this.onImpactComplete();
      }
    } else if (this.mode === 'IMPACT_RESULT') {
      this.impactTime += delta;
      const r = 10;
      this.camera.position.x = 13.85 + Math.cos(this.impactTime * 0.3) * r;
      this.camera.position.z = 3.2 + Math.sin(this.impactTime * 0.3) * r;
      this.camera.position.y = 4.5 + Math.sin(this.impactTime * 0.5) * 1.2;
      this.camera.lookAt(13.85, 1.4, 3.2);

      if (this.impactParticles) {
        this.impactParticles.material.opacity = Math.max(0, 1 - this.impactTime * 0.5);
      }
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = (this.container.clientWidth && this.container.clientWidth > 0) ? this.container.clientWidth : window.innerWidth;
    const height = (this.container.clientHeight && this.container.clientHeight > 0) ? this.container.clientHeight : window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

export const MercurySceneInstance = new MercuryScene();
export { MercuryScene };

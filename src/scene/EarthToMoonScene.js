import * as THREE from 'three';
import gsap from 'gsap';
import { AssetInstance } from '../managers/AssetLoader.js';
import { CameraInstance } from '../camera/CameraManager.js';
import { EarthToMoonMissionInstance } from '../missions/EarthToMoonMission.js';
import { EngineInstance } from '../core/Engine.js';

class EarthToMoonScene {
  constructor() {
    this.group = new THREE.Group();
    
    // 3D Mesh references
    this.earth = null;
    this.moon = null;
    this.station = null; // Procedural Earth Launch Station, Big Green/Brown Land & Trees
    this.rocket = null;  // Procedural Three.js Rocket
    this.booster = null; // Single booster sleeve for separation stage
    this.satellite = null; // Research Satellite GLB model
    
    // Procedural Launch Station elements
    this.launchPadGroup = null;
    this.warningBeacons = [];
    
    // Engine flame & light
    this.flameMesh = null;
    this.flameLight = null;
    
    // Cloud system for atmospheric ascent
    this.cloudGroup = null;
    this.cloudParticles = [];
    
    // Starfield for space phase
    this.starfield = null;
    
    // State & Detachment flags
    this.isRocketDetached = false;
    this.isSatDetached = false;
    this.cutscenePlaying = false;
    this.cutsceneTimer = 0;
    this.cutsceneFinished = false;
    this.stationRemovedFromSpace = false;
    this.missionEndedTriggered = false;
    this.probeSeparationProgress = 0;

    // Explicit Mission 2 Camera Controller state
    this.cameraState = 'LAUNCHPAD_CINEMATIC';
    
    // Reusable temporary vectors for zero-allocation performance
    this._tempRocketWorldPos = new THREE.Vector3();
    this._tempBoosterWorldPos = new THREE.Vector3();
    this._tempSatWorldPos = new THREE.Vector3();
    this._tempCamTarget = new THREE.Vector3();
    this._tempCamPos = new THREE.Vector3();
    this._tempWorldQuat = new THREE.Quaternion();
    
    // Particle emitters
    this.smokeParticles = null;
    this.fireParticles = null;
    this.dustParticles = null;
    
    this.time = 0;
    this.satelliteOffset = new THREE.Vector3(0, 0.45, 0);
  }

  // Single point of truth model scale normalization using Box3 bounding box
  normalizeModelScale(object, targetMaxDimension) {
    if (!object) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scaleFactor = targetMaxDimension / maxDim;
      object.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
  }

  init(parentScene) {
    this.group = new THREE.Group();
    this.group.name = "orbit_elements";

    this.isRocketDetached = false;
    this.isSatDetached = false;
    this.booster = null;
    this.cutscenePlaying = false;
    this.cutsceneTimer = 0;
    this.cutsceneFinished = false;
    this.stationRemovedFromSpace = false;
    this.missionEndedTriggered = false;
    this.warningBeacons = [];
    this.cameraState = 'LAUNCHPAD_CINEMATIC';

    // Start background as atmospheric sky blue for Earth launch
    if (EngineInstance.scene) {
      EngineInstance.scene.fog = null;
      EngineInstance.scene.background = new THREE.Color(0x38bdf8); // Sky blue
    }

    // Mission 2 deliberately uses no Earth/Moon GLB assets. The lunar destination
    // is a procedural Three.js body with a generated albedo and crater relief.
    this.earth = null;
    this.moon = this.createProceduralMoon();
    this.moon.position.set(0, 0, -200.0);
    this.moon.visible = false; // HIDDEN during ground launch scenario!
    this.group.add(this.moon);

    // 3. Big Earth Land & Procedural Launch Station (Green & Brown Land with Trees)
    this.station = new THREE.Group();
    this.station.position.set(0, 0, 0);
    this.buildBigEarthLandAndStation();
    this.group.add(this.station);

    // 4. Procedural High-Quality Space Rocket (Pure Three.js)
    this.rocket = this.buildProceduralRocket();
    this.rocket.position.set(0, 0.45, 0); // Local position standing on pad
    this.rocket.rotation.set(0, 0, 0);
    this.station.add(this.rocket);

    // 5. Rocket Engine Flame & Exhaust Setup
    this.buildRocketEngineFlame();

    // 6. Research Satellite GLB Model Setup (Normalized to 0.4 units, parented as rocket payload)
    this.satellite = AssetInstance.getSatelliteModel(1);
    this.normalizeModelScale(this.satellite, 0.4);
    this.satellite.position.copy(this.satelliteOffset);
    this.satellite.rotation.set(0, 0, 0);
    this.rocket.add(this.satellite);

    // 7. Clouds & Environment Setup
    this.buildAtmosphericClouds();
    this.buildStarfield();
    this.createSmokeEmitter();
    this.createFireEmitter();
    this.createDustEmitter();

    // 8. Lighting Setup
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(40, 60, 40);
    this.group.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.group.add(ambientLight);

    parentScene.add(this.group);
  }

  createProceduralMoon() {
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    let seed = 0x1d872b41;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

    // Layered deterministic noise provides a natural grey lunar regolith base.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        // Broad dark maria plus fine regolith grain give the Moon its recognizable contrast.
        const maria = Math.sin(x * 0.009 + y * 0.004) * 13 + Math.sin(x * 0.018 - y * 0.007) * 9;
        const broad = Math.sin(x * 0.024) * 10 + Math.sin(y * 0.035 + x * 0.011) * 8 + maria;
        const grain = (random() - 0.5) * 30;
        const tone = Math.max(38, Math.min(184, 122 + broad + grain));
        image.data[i] = tone;
        image.data[i + 1] = tone;
        image.data[i + 2] = tone * 0.96;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    // Mostly fine, low-contrast craters with only a few larger basins.
    // This avoids the repeated oversized rings of a toy-like surface.
    for (let c = 0; c < 720; c++) {
      const x = random() * width;
      const y = 24 + random() * (height - 48);
      const r = 0.5 + Math.pow(random(), 4.2) * 28;
      const crater = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.08, x, y, r);
      crater.addColorStop(0, 'rgba(35, 38, 40, 0.42)');
      crater.addColorStop(0.55, 'rgba(78, 80, 80, 0.12)');
      crater.addColorStop(0.76, 'rgba(212, 210, 196, 0.20)');
      crater.addColorStop(1, 'rgba(70, 70, 70, 0)');
      ctx.fillStyle = crater;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.72 + random() * 0.28), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const albedo = new THREE.CanvasTexture(canvas);
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = THREE.RepeatWrapping;
    const material = new THREE.MeshStandardMaterial({
      map: albedo,
      bumpMap: albedo,
      bumpScale: 0.36,
      roughness: 0.98,
      metalness: 0.0
    });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(6.8, 128, 128), material);
    moon.name = 'procedural-lunar-destination';
    moon.castShadow = true;
    moon.receiveShadow = true;

    // A very subtle cool rim gives the silhouette definition without an atmosphere.
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(6.88, 96, 96),
      new THREE.MeshBasicMaterial({ color: 0x9fb8d2, transparent: true, opacity: 0.055, side: THREE.BackSide })
    );
    moon.add(rim);
    return moon;
  }

  // BUILD BIG EARTH LAND & PROCEDURAL LAUNCH STATION (GREEN & BROWN LAND WITH TREES)
  buildBigEarthLandAndStation() {
    this.launchPadGroup = new THREE.Group();

    // Big Sprawling Ground Land Terrain Slab (Radius 80.0 units, green top soil & brown base)
    const landGeom = new THREE.CylinderGeometry(80.0, 85.0, 1.0, 48);
    const landMat = new THREE.MeshStandardMaterial({
      color: 0x15803d, // Rich green grass top
      roughness: 0.8,
      metalness: 0.1
    });
    const landMesh = new THREE.Mesh(landGeom, landMat);
    landMesh.position.set(0, -0.5, 0);
    this.launchPadGroup.add(landMesh);

    // Deep Brown Soil Sub-layer
    const soilGeom = new THREE.CylinderGeometry(85.0, 90.0, 0.6, 48);
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const soilMesh = new THREE.Mesh(soilGeom, soilMat);
    soilMesh.position.set(0, -1.2, 0);
    this.launchPadGroup.add(soilMesh);

    // 45 Low-Poly 3D Trees spread across the big landscape
    const trunkGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const foliageGeom = new THREE.ConeGeometry(0.3, 0.8, 8);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 });

    for (let t = 0; t < 45; t++) {
      const angle = (t / 45) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const radius = 4.0 + (Math.sin(t * 5) * 0.5 + 0.5) * 45.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.set(0, 0.25, 0);
      treeGroup.add(trunk);

      const foliage = new THREE.Mesh(foliageGeom, foliageMat);
      foliage.position.set(0, 0.75, 0);
      treeGroup.add(foliage);

      treeGroup.position.set(x, 0, z);
      treeGroup.scale.setScalar(0.8 + Math.random() * 0.7);
      this.launchPadGroup.add(treeGroup);
    }

    // Concrete Launch Pad Slab (Radius 2.0, height 0.3)
    const padGeom = new THREE.CylinderGeometry(2.0, 2.2, 0.3, 16);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.4
    });
    const padMesh = new THREE.Mesh(padGeom, padMat);
    padMesh.position.set(0, 0.15, 0);
    this.launchPadGroup.add(padMesh);

    // Steel Launch Hold-Down Ring
    const ringGeom = new THREE.TorusGeometry(0.45, 0.04, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(0, 0.31, 0);
    this.launchPadGroup.add(ringMesh);

    // Metallic Launch Support Tower Structure
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.3
    });

    const towerHeight = 3.5;
    for (let i = 0; i < 4; i++) {
      const colGeom = new THREE.CylinderGeometry(0.04, 0.04, towerHeight, 6);
      const colMesh = new THREE.Mesh(colGeom, towerMat);
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      colMesh.position.set(Math.cos(angle) * 0.6 - 0.5, towerHeight / 2 + 0.3, Math.sin(angle) * 0.6);
      this.launchPadGroup.add(colMesh);
    }

    // Structural Cross Bracing Decks
    for (let h = 0.8; h <= towerHeight; h += 0.8) {
      const deckGeom = new THREE.BoxGeometry(0.75, 0.05, 0.75);
      const deckMesh = new THREE.Mesh(deckGeom, towerMat);
      deckMesh.position.set(-0.5, h + 0.3, 0);
      this.launchPadGroup.add(deckMesh);
    }

    // Umbilical Swing Arms (Utility Booms)
    const armGeom = new THREE.BoxGeometry(0.5, 0.05, 0.05);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    
    const arm1 = new THREE.Mesh(armGeom, armMat);
    arm1.position.set(-0.2, 0.9, 0);
    this.launchPadGroup.add(arm1);

    const arm2 = new THREE.Mesh(armGeom, armMat);
    arm2.position.set(-0.2, 1.6, 0);
    this.launchPadGroup.add(arm2);

    // Pulsing Red Emissive Warning Beacons
    const beaconGeom = new THREE.SphereGeometry(0.05, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true });

    const beacon1 = new THREE.Mesh(beaconGeom, beaconMat);
    beacon1.position.set(-0.5, towerHeight + 0.4, -0.3);
    this.launchPadGroup.add(beacon1);
    this.warningBeacons.push(beacon1);

    const beacon2 = new THREE.Mesh(beaconGeom, beaconMat);
    beacon2.position.set(-0.5, towerHeight + 0.4, 0.3);
    this.launchPadGroup.add(beacon2);
    this.warningBeacons.push(beacon2);

    this.station.add(this.launchPadGroup);
  }

  // BUILD PROCEDURAL HIGH-QUALITY SPACE ROCKET (THREE.JS)
  buildProceduralRocket() {
    const rocketGroup = new THREE.Group();

    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });

    // Main Rocket Body Cylinder (Height 1.8, Radius 0.2)
    const bodyGeom = new THREE.CylinderGeometry(0.2, 0.22, 1.8, 20);
    const bodyMesh = new THREE.Mesh(bodyGeom, whiteMat);
    bodyMesh.position.set(0, 0.9, 0);
    rocketGroup.add(bodyMesh);

    // Red Roll Stripe Band
    const stripeGeom = new THREE.CylinderGeometry(0.202, 0.202, 0.2, 20);
    const stripeMesh = new THREE.Mesh(stripeGeom, redMat);
    stripeMesh.position.set(0, 1.4, 0);
    rocketGroup.add(stripeMesh);

    // Conical Nose Cone (Height 0.5, Radius 0.2)
    const noseGeom = new THREE.ConeGeometry(0.2, 0.5, 20);
    const noseMesh = new THREE.Mesh(noseGeom, whiteMat);
    noseMesh.position.set(0, 2.05, 0);
    rocketGroup.add(noseMesh);

    // Twin Side Boosters
    const boosterGeom = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 12);
    const boosterNoseGeom = new THREE.ConeGeometry(0.07, 0.2, 12);

    const leftBooster = new THREE.Mesh(boosterGeom, whiteMat);
    leftBooster.position.set(-0.25, 0.55, 0);
    rocketGroup.add(leftBooster);

    const leftNose = new THREE.Mesh(boosterNoseGeom, redMat);
    leftNose.position.set(-0.25, 1.2, 0);
    rocketGroup.add(leftNose);

    const rightBooster = new THREE.Mesh(boosterGeom, whiteMat);
    rightBooster.position.set(0.25, 0.55, 0);
    rocketGroup.add(rightBooster);

    const rightNose = new THREE.Mesh(boosterNoseGeom, redMat);
    rightNose.position.set(0.25, 1.2, 0);
    rocketGroup.add(rightNose);

    // Base Engine Nozzle
    const nozzleGeom = new THREE.ConeGeometry(0.12, 0.2, 12);
    nozzleGeom.rotateX(Math.PI);
    const nozzleMesh = new THREE.Mesh(nozzleGeom, darkMat);
    nozzleMesh.position.set(0, -0.1, 0);
    rocketGroup.add(nozzleMesh);

    // Aero Stabilization Fins
    const finGeom = new THREE.BoxGeometry(0.03, 0.3, 0.25);
    for (let f = 0; f < 4; f++) {
      const fin = new THREE.Mesh(finGeom, darkMat);
      const angle = (f * Math.PI) / 2;
      fin.position.set(Math.cos(angle) * 0.22, 0.2, Math.sin(angle) * 0.22);
      fin.rotation.y = -angle;
      rocketGroup.add(fin);
    }

    return rocketGroup;
  }

  // ROCKET ENGINE FLAME & EXHAUST GLOW
  buildRocketEngineFlame() {
    const flameGeom = new THREE.ConeGeometry(0.08, 0.4, 12);
    flameGeom.rotateX(Math.PI);
    flameGeom.translate(0, -0.2, 0);

    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      emissive: 0xffaa00,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending
    });

    this.flameMesh = new THREE.Mesh(flameGeom, flameMat);
    this.rocket.add(this.flameMesh);

    this.flameLight = new THREE.PointLight(0xff6600, 0, 5);
    this.flameLight.position.set(0, -0.15, 0);
    this.rocket.add(this.flameLight);
  }

  // THREE.JS ATMOSPHERIC CLOUDS
  buildAtmosphericClouds() {
    this.cloudGroup = new THREE.Group();
    const cloudGeom = new THREE.DodecahedronGeometry(0.6, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      roughness: 1.0
    });

    for (let i = 0; i < 35; i++) {
      const cloud = new THREE.Mesh(cloudGeom, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 16.0,
        4.0 + Math.random() * 18.0,
        (Math.random() - 0.5) * 16.0
      );
      cloud.scale.set(Math.random() * 1.5 + 0.9, Math.random() * 0.5 + 0.4, Math.random() * 1.5 + 0.9);
      this.cloudGroup.add(cloud);
      this.cloudParticles.push(cloud);
    }
    this.group.add(this.cloudGroup);
  }

  // SPACE ENVIRONMENT — 3D STARFIELD
  buildStarfield() {
    const count = 800;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.6,
      transparent: true,
      opacity: 0.8
    });

    this.starfield = new THREE.Points(geom, mat);
    this.group.add(this.starfield);
  }

  createSmokeEmitter() {
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -9999;
      positions[i * 3 + 2] = 0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
      color: 0xcccccc,
      size: 0.15,
      transparent: true,
      opacity: 0.3,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.smokeParticles = new THREE.Points(geom, mat);
    this.group.add(this.smokeParticles);
  }

  createFireEmitter() {
    const count = 30;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -9999;
      positions[i * 3 + 2] = 0;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xff4500,
      size: 0.18,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.fireParticles = new THREE.Points(geom, mat);
    this.group.add(this.fireParticles);
  }

  createDustEmitter() {
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -9999;
      positions[i * 3 + 2] = 0;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x999999,
      size: 0.15,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(geom, mat);
    this.group.add(this.dustParticles);
  }

  emitSmoke(origin, count = 2) {
    if (!this.smokeParticles) return;
    const posAttr = this.smokeParticles.geometry.attributes.position;
    
    for (let k = 0; k < count; k++) {
      let foundIdx = -1;
      for (let i = 0; i < posAttr.count; i++) {
        if (posAttr.getY(i) < -5000) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx === -1) foundIdx = Math.floor(Math.random() * posAttr.count);

      posAttr.setXYZ(
        foundIdx,
        origin.x + (Math.random() - 0.5) * 0.2,
        origin.y + (Math.random() - 0.5) * 0.2,
        origin.z + (Math.random() - 0.5) * 0.2
      );
    }
    posAttr.needsUpdate = true;
  }

  emitFire(origin, count = 3) {
    if (!this.fireParticles) return;
    const posAttr = this.fireParticles.geometry.attributes.position;
    
    for (let k = 0; k < count; k++) {
      let foundIdx = -1;
      for (let i = 0; i < posAttr.count; i++) {
        if (posAttr.getY(i) < -5000) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx === -1) foundIdx = Math.floor(Math.random() * posAttr.count);

      posAttr.setXYZ(
        foundIdx,
        origin.x + (Math.random() - 0.5) * 0.1,
        origin.y,
        origin.z + (Math.random() - 0.5) * 0.1
      );
    }
    posAttr.needsUpdate = true;
  }

  emitDust(origin, count = 3) {
    if (!this.dustParticles) return;
    const posAttr = this.dustParticles.geometry.attributes.position;
    
    for (let k = 0; k < count; k++) {
      let foundIdx = -1;
      for (let i = 0; i < posAttr.count; i++) {
        if (posAttr.getY(i) < -5000) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx === -1) foundIdx = Math.floor(Math.random() * posAttr.count);

      posAttr.setXYZ(
        foundIdx,
        origin.x + (Math.random() - 0.5) * 0.4,
        origin.y + 0.05,
        origin.z + (Math.random() - 0.5) * 0.4
      );
    }
    posAttr.needsUpdate = true;
  }

  updateParticles(delta) {
    if (this.smokeParticles) {
      const posAttr = this.smokeParticles.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        if (posAttr.getY(i) > -5000) {
          posAttr.setY(i, posAttr.getY(i) + delta * 1.5);
          posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * 0.1);
          posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * 0.1);
          
          if (Math.random() < 0.05) {
            posAttr.setY(i, -9999);
          }
        }
      }
      posAttr.needsUpdate = true;
    }

    if (this.fireParticles) {
      const posAttr = this.fireParticles.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        if (posAttr.getY(i) > -5000) {
          posAttr.setY(i, posAttr.getY(i) - delta * 6.0);
          posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * 0.05);
          posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * 0.05);
          
          if (Math.random() < 0.25) {
            posAttr.setY(i, -9999);
          }
        }
      }
      posAttr.needsUpdate = true;
    }

    if (this.dustParticles) {
      const posAttr = this.dustParticles.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        if (posAttr.getY(i) > -5000) {
          posAttr.setY(i, posAttr.getY(i) + delta * 0.2);
          posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * 0.8 * delta);
          posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * 0.8 * delta);
          
          if (Math.random() < 0.15) {
            posAttr.setY(i, -9999);
          }
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  // 2D CARTOON CUTSCENE IMPLEMENTATION (AFTER QUIZ 3)
  play2DCartoonCutscene() {
    if (this.cutscenePlaying) return;
    this.cutscenePlaying = true;
    this.cutsceneTimer = 0;

    const overlay = document.getElementById('cutscene-overlay');
    const canvas = document.getElementById('cutscene-canvas');
    if (!overlay || !canvas) return;

    overlay.classList.remove('hidden');
    overlay.classList.add('active');
    const ctx = canvas.getContext('2d');

    const renderFrame = (t) => {
      if (!this.cutscenePlaying) return;

      this.cutsceneTimer += 0.016;
      const progress = this.cutsceneTimer / 5.0; // 5-second cutscene

      // Clear dark space background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, 800, 450);

      // Draw stylized stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137.5) % 800;
        const sy = (i * 293.1) % 450;
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Draw 2D Earth Horizon line at bottom
      const earthGrad = ctx.createLinearGradient(0, 350, 0, 450);
      earthGrad.addColorStop(0, '#1e3a8a');
      earthGrad.addColorStop(0.5, '#0284c7');
      earthGrad.addColorStop(1, '#030712');
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(400, 800, 500, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric glow arc
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(400, 800, 502, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();

      // Motion / Speed lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      for (let l = 0; l < 8; l++) {
        const lx = (l * 110 + progress * 600) % 800;
        ctx.beginPath();
        ctx.moveTo(lx, 80);
        ctx.lineTo(lx - 40, 80);
        ctx.stroke();
      }

      // Draw 2D Rocket Silhouette
      const rocketX = 320;
      const rocketY = 200;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;

      // Rocket body cone/capsule
      ctx.beginPath();
      ctx.moveTo(rocketX, rocketY - 40);
      ctx.lineTo(rocketX + 15, rocketY + 30);
      ctx.lineTo(rocketX - 15, rocketY + 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // RCS Thruster burst
      if (progress > 0.2 && progress < 0.8) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(rocketX - 22, rocketY, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw 2D Satellite Payload Decoupling
      const satOffset = Math.min(180, (progress - 0.3) * 350);
      if (progress >= 0.3) {
        const satX = rocketX + satOffset;
        const satY = rocketY - satOffset * 0.3;

        // Satellite foil body
        ctx.fillStyle = '#f59e0b'; // Gold foil
        ctx.fillRect(satX - 12, satY - 12, 24, 24);
        ctx.strokeRect(satX - 12, satY - 12, 24, 24);

        // Solar panels unfolding
        const panelLen = Math.min(25, (progress - 0.4) * 150);
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(satX - 12 - panelLen, satY - 4, panelLen, 8);
        ctx.fillRect(satX + 12, satY - 4, panelLen, 8);

        // Trajectory dashed vector line
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(satX, satY);
        ctx.lineTo(satX + 100, satY - 30);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Text Title Card
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#ffffff';
      if (progress < 0.3) {
        ctx.fillText("PHASE I: ORBITAL POSITION STABILIZED", 40, 50);
      } else if (progress < 0.7) {
        ctx.fillText("PHASE II: PAYLOAD BAY DOORS UNLATCHED", 40, 50);
        ctx.fillText(">> SATELLITE DECOUPLING IN PROGRESS", 40, 75);
      } else {
        ctx.fillText("PHASE III: PROBE SEPARATION COMPLETE", 40, 50);
        ctx.fillText(">> ENTERING LUNAR TRANSFER CORRIDOR", 40, 75);
      }

      if (this.cutsceneTimer < 5.0) {
        requestAnimationFrame(renderFrame);
      } else {
        // Cutscene complete
        overlay.classList.remove('active');
        overlay.classList.add('hidden');
        this.cutscenePlaying = false;
        this.cutsceneFinished = true;
      }
    };

    requestAnimationFrame(renderFrame);
  }

  update(delta, time) {
    this.time = time;
    const mission = EarthToMoonMissionInstance;
    const stage = mission.stage;

    // Pulse warning beacons on launch station
    const beaconOpacity = (Math.sin(time * 6) + 1) * 0.5;
    this.warningBeacons.forEach(b => {
      if (b.material) b.material.opacity = beaconOpacity;
    });

    // 1. Slow orbital spin of Earth & Moon when visible in space
    if (this.earth && this.earth.visible) this.earth.rotation.y = time * 0.005;
    if (this.moon && this.moon.visible) this.moon.rotation.y = time * 0.002;

    // 2. Perform 3D animations based on mission stage
    if (stage === 'INTRO' || stage === 'Q1') {
      this.cameraState = 'LAUNCHPAD_CINEMATIC';

      // Keep Earth launch sky blue background & hide space 3D models during ground launch
      if (EngineInstance.scene && EngineInstance.scene.background) {
        EngineInstance.scene.background.setHex(0x38bdf8);
      }
      if (this.earth) this.earth.visible = false;
      if (this.moon) this.moon.visible = false;

      // Engine off
      if (this.flameMesh) this.flameMesh.material.opacity = 0;
      if (this.flameLight) this.flameLight.intensity = 0;

      // Re-attach rocket to station launchpad if restarting or in intro
      if (this.isRocketDetached) {
        this.isRocketDetached = false;
        this.rocket.visible = true;
        this.station.add(this.rocket);
        this.rocket.position.set(0, 0.45, 0);
        this.rocket.rotation.set(0, 0, 0);
      }
      if (this.isSatDetached) {
        this.isSatDetached = false;
        this.rocket.add(this.satellite);
        this.satellite.position.copy(this.satelliteOffset);
        this.satellite.rotation.set(0, 0, 0);
      }
      
      // Ensure launch station & land are in scene during intro
      if (this.stationRemovedFromSpace) {
        this.group.add(this.station);
        this.stationRemovedFromSpace = false;
      }

    } else if (stage === 'LAUNCH') {
      this.cameraState = 'LAUNCH';

      if (this.earth) this.earth.visible = false;
      if (this.moon) this.moon.visible = false;

      // Detach rocket cleanly from station to group space on liftoff
      if (!this.isRocketDetached) {
        this.rocket.getWorldPosition(this._tempRocketWorldPos);
        this.rocket.getWorldQuaternion(this._tempWorldQuat);
        this.group.add(this.rocket);
        this.rocket.position.copy(this._tempRocketWorldPos);
        this.rocket.quaternion.copy(this._tempWorldQuat);
        this.isRocketDetached = true;
      }

      // Animate engine flame
      if (this.flameMesh) {
        this.flameMesh.material.opacity = 0.95;
        this.flameMesh.scale.y = 1.0 + Math.sin(time * 30) * 0.2;
      }
      if (this.flameLight) this.flameLight.intensity = 1.5;

      // Vibration & upward launch motion centered at origin
      const vib = 0.02 * Math.sin(time * 60);
      this.rocket.position.set(vib, 0.45 + mission.altitude * 0.05, vib);
      
      // Emit exhaust fire and smoke
      this.rocket.getWorldPosition(this._tempRocketWorldPos);
      const basePos = this._tempRocketWorldPos.clone();
      basePos.y -= 0.3;
      this.emitFire(basePos, 2);
      this.emitSmoke(basePos, 1);

    } else if (stage === 'ATMOSPHERE') {
      this.cameraState = 'ATMOSPHERIC_ASCENT';

      if (this.earth) this.earth.visible = false;
      if (this.moon) this.moon.visible = false;

      // Pitch rocket towards orbital injection
      const pitch = Math.min(Math.PI / 3, (mission.altitude - 60) * 0.005);
      this.rocket.rotation.z = -pitch;
      
      const t = (mission.altitude - 60) / 90;
      const posX = t * 8.0;
      const posY = 0.45 + mission.altitude * 0.12;
      this.rocket.position.set(posX, posY, 0);
      
      // Move clouds past camera to simulate rapid ascension through sky
      this.cloudParticles.forEach(c => {
        c.position.y -= delta * 15.0;
        if (c.position.y < -10) c.position.y = 55.0;
      });

      // Engine Flame
      if (this.flameMesh) {
        this.flameMesh.material.opacity = 0.9;
        this.flameMesh.scale.y = 1.2 + Math.sin(time * 40) * 0.15;
      }

      this.rocket.getWorldPosition(this._tempRocketWorldPos);
      const exhaustOffset = new THREE.Vector3(0, -0.3, 0).applyEuler(this.rocket.rotation);
      const basePos = this._tempRocketWorldPos.clone().add(exhaustOffset);
      this.emitFire(basePos, 3);
      this.emitSmoke(basePos, 1);

    } else if (stage === 'SEPARATION') {
      this.cameraState = 'PROBE_SEPARATION';

      // Transition background to dark space + reveal 3D Earth & Moon models in deep space!
      if (EngineInstance.scene && EngineInstance.scene.background) {
        EngineInstance.scene.background.setHex(0x030712);
      }
      if (this.earth) this.earth.visible = true;
      if (this.moon) this.moon.visible = true;

      // Cleanly remove launch station & ground land from deep space!
      if (!this.stationRemovedFromSpace) {
        this.group.remove(this.station);
        this.stationRemovedFromSpace = true;
      }

      // Fade out clouds as space is entered
      this.cloudParticles.forEach(c => {
        if (c.material) c.material.opacity = Math.max(0, c.material.opacity - delta * 0.3);
      });

      // Single booster sleeve separation (NO rocket duplication/splitting!)
      if (!this.booster && this.rocket) {
        const boosterSleeveGeom = new THREE.CylinderGeometry(0.24, 0.26, 0.8, 16);
        const boosterSleeveMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 });
        this.booster = new THREE.Mesh(boosterSleeveGeom, boosterSleeveMat);
        this.rocket.getWorldPosition(this._tempRocketWorldPos);
        this.booster.position.copy(this._tempRocketWorldPos).add(new THREE.Vector3(0, -0.4, 0));
        this.group.add(this.booster);
        
        gsap.to(this.rocket.position, {
          y: "+=1.5",
          duration: 1.5,
          ease: "power2.out"
        });
      }

      // The payload becomes an independent probe as soon as space is reached.
      // Preserve its world transform so it never snaps back to the launch station.
      if (!this.isSatDetached && this.satellite) {
        this.satellite.getWorldPosition(this._tempSatWorldPos);
        this.satellite.getWorldQuaternion(this._tempWorldQuat);
        this.group.add(this.satellite);
        this.satellite.position.copy(this._tempSatWorldPos);
        this.satellite.quaternion.copy(this._tempWorldQuat);
        this.isSatDetached = true;
        this.probeSeparationProgress = 0;
      }

      if (this.isSatDetached) {
        this.probeSeparationProgress = Math.min(1, this.probeSeparationProgress + delta / 2.2);
        const eased = 1 - Math.pow(1 - this.probeSeparationProgress, 3);
        // Smoothly drift the probe forward and sideways while the rocket continues away.
        this.satellite.position.copy(this.rocket.position).add(new THREE.Vector3(1.2 * eased, 0.55 + 1.8 * eased, -2.8 * eased));
        this.satellite.lookAt(this.satellite.position.clone().add(new THREE.Vector3(0, 0.1, -8)));
        // The rocket leaves the scene only after the visible detachment is complete.
        if (this.probeSeparationProgress >= 1) {
          this.rocket.visible = false;
          if (this.flameMesh) this.flameMesh.material.opacity = 0;
        }
      }

      if (this.booster) {
        this.booster.position.y -= delta * 3.0;
        this.booster.rotation.x += delta * 0.5;
      }

      this.rocket.getWorldPosition(this._tempRocketWorldPos);
      const exhaustOffset = new THREE.Vector3(0, -0.2, 0).applyEuler(this.rocket.rotation);
      const basePos = this._tempRocketWorldPos.clone().add(exhaustOffset);
      this.emitFire(basePos, 1);

    } else if (stage === 'LEO' || stage === 'Q3') {
      this.cameraState = 'PROBE_FOLLOW';

      // Ensure space background & reveal 3D Earth & Moon models
      if (EngineInstance.scene && EngineInstance.scene.background) {
        EngineInstance.scene.background.setHex(0x030712);
      }
      if (this.earth) this.earth.visible = true;
      if (this.moon) this.moon.visible = true;

      if (!this.stationRemovedFromSpace) {
        this.group.remove(this.station);
        this.stationRemovedFromSpace = true;
      }

      if (this.booster) {
        this.group.remove(this.booster);
        this.booster = null;
      }

      // Rocket and probe now have independent trajectories.
      const angle = time * 0.12;
      const radius = 20.0;
      this.rocket.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      this.rocket.rotation.set(0, -angle - Math.PI/2, 0);
      this.satellite.position.set(Math.cos(angle + 0.16) * 22.0, 1.6, Math.sin(angle + 0.16) * 22.0);
      this.satellite.rotation.set(0, -angle - Math.PI / 2, 0);

      if (this.flameMesh) this.flameMesh.material.opacity = 0.2;

    } else if (stage === 'DEPLOYMENT') {
      this.cameraState = 'PROBE_FOLLOW';

      if (this.earth) this.earth.visible = true;
      if (this.moon) this.moon.visible = true;

      // Trigger 2D Cartoon Cutscene during deployment phase (AFTER QUIZ 3 ENDS)
      if (!this.cutsceneFinished && !this.cutscenePlaying) {
        this.play2DCartoonCutscene();
      }

      // Rocket in Earth orbit
      const angle = time * 0.12;
      const radius = 20.0;
      this.rocket.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      this.rocket.rotation.set(0, -angle - Math.PI/2, 0);

      // The probe separated in the space-transition stage; this is its deployment check.
      if (this.isSatDetached) {
        const deployProgress = (mission.progress - 55) / 10;
        const probeAngle = angle + 0.16 + deployProgress * 0.08;
        this.satellite.position.set(Math.cos(probeAngle) * 22.0, 1.6 + deployProgress, Math.sin(probeAngle) * 22.0);
        this.satellite.rotation.set(0, -probeAngle - Math.PI / 2, 0);
      }

    } else if (stage === 'TLI') {
      this.cameraState = 'PROBE_FOLLOW';

      if (this.earth) this.earth.visible = true;
      if (this.moon) this.moon.visible = true;

      // Probe begins its own trans-lunar injection; rocket is no longer its parent.
      const orbitAngle = time * 0.12;
      this.satellite.position.set(Math.cos(orbitAngle + 0.25) * 24.0, 1.5, Math.sin(orbitAngle + 0.25) * 24.0);
      this.satellite.rotation.set(0, -orbitAngle - Math.PI/2, 0.15 * Math.sin(time));

      // Rocket departs Earth orbit towards Moon (0, 0, -200)
      const t = (mission.progress - 65) / 10;
      const startPos = new THREE.Vector3(this.rocket.position.x, 0, this.rocket.position.z);
      const moonPos = new THREE.Vector3(0, 0, -50.0);
      
      this.rocket.position.lerpVectors(startPos, moonPos, t);
      this.rocket.lookAt(0, 0, -200);
      this.rocket.rotation.x = Math.PI / 2;

      if (this.flameMesh) this.flameMesh.material.opacity = 0.9;

    } else if (stage === 'Q4' || stage === 'TRANSFER') {
      this.cameraState = 'PROBE_FOLLOW';

      if (this.earth) this.earth.visible = true;
      if (this.moon) this.moon.visible = true;

      // Satellite moves towards Moon along deep space transfer path
      const travelPct = (mission.progress - 75) / 10;
      const startPos = new THREE.Vector3(0, 1.5, -28.0);
      const endPos = new THREE.Vector3(0, 1.0, -188.0);
      
      this.satellite.position.lerpVectors(startPos, endPos, travelPct);
      this.satellite.position.x = Math.sin(travelPct * Math.PI) * 12.0;
      this.satellite.lookAt(0, 0, -200);

    } else if (stage === 'APPROACH') {
      this.cameraState = 'PROBE_FOLLOW';

      if (this.earth) this.earth.visible = true;
      if (this.moon) this.moon.visible = true;

      // Insert into a clearly external orbit: Moon radius is 6.8 units,
      // while this orbit stays 11.5 units from its centre.
      const angle = time * 0.18;
      const radius = 11.5;
      const moonCenter = new THREE.Vector3(0, 0, -200.0);
      this.satellite.position.set(
        moonCenter.x + Math.cos(angle) * radius,
        moonCenter.y + Math.sin(angle * 2) * 1.8,
        moonCenter.z + Math.sin(angle) * radius
      );
      this.satellite.rotation.set(0, -angle - Math.PI/2, 0);

    } else if (stage === 'DESCENT' || stage === 'Q5' || stage === 'Q2') {
      this.cameraState = 'PROBE_FOLLOW';

      if (this.earth) this.earth.visible = true;
      if (this.moon) this.moon.visible = true;

      // Keep the probe outside the lunar surface during the final quiz sequence.
      const orbitAngle = time * 0.24;
      const orbitRadius = 10.8;
      this.satellite.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        Math.sin(orbitAngle * 2) * 1.4,
        -200.0 + Math.sin(orbitAngle) * orbitRadius
      );
      this.satellite.rotation.set(0, -orbitAngle - Math.PI / 2, 0);

    } else if (stage === 'TOUCHDOWN' || stage === 'SUCCESS_PAUSE' || stage === 'COMPLETE') {
      this.cameraState = 'PROBE_FOLLOW';

      if (EngineInstance.scene && EngineInstance.scene.background) {
        EngineInstance.scene.background.setHex(0x030712);
      }
      if (this.earth) this.earth.visible = true;
      if (this.moon) this.moon.visible = true;

      // Cleanly remove launch station & ground land from deep space
      if (!this.stationRemovedFromSpace) {
        this.group.remove(this.station);
        this.stationRemovedFromSpace = true;
      }
      if (this.rocket) {
        this.rocket.visible = false;
      }
      if (!this.isSatDetached && this.satellite) {
        this.group.add(this.satellite);
        this.isSatDetached = true;
      }

      // Mission-complete confirmation orbit, safely above the Moon's surface.
      const orbitAngle = time * 0.18;
      const orbitRadius = 10.8;
      this.satellite.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        Math.sin(orbitAngle * 2) * 1.4,
        -200.0 + Math.sin(orbitAngle) * orbitRadius
      );
      this.satellite.rotation.set(0, -orbitAngle - Math.PI / 2, 0);
      
      if (this.flameMesh) this.flameMesh.material.opacity = 0;

    }

    this.updateParticles(delta);

    // 3. Mission 2 Dedicated Camera Controller
    this.updateCamera(delta);
  }

  // MISSION 2 CAMERA CONTROLLER (EXPLICIT STATES & CAMERA ISOLATION)
  updateCamera(delta) {
    if (this.rocket) {
      this.rocket.getWorldPosition(this._tempRocketWorldPos);
    }
    if (this.satellite) {
      this.satellite.getWorldPosition(this._tempSatWorldPos);
    }
    if (this.booster) {
      this.booster.getWorldPosition(this._tempBoosterWorldPos);
    }

    switch (this.cameraState) {
      case 'LAUNCHPAD_CINEMATIC':
        // Locked side-profile atmospheric launch view
        CameraInstance.controls.enabled = false;
        
        this._tempCamTarget.set(0, 0.8, 0);
        this._tempCamPos.set(0, 2.2, 7.5);
        
        CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.05);
        CameraInstance.controls.target.lerp(this._tempCamTarget, 0.05);
        CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
        break;

      case 'LAUNCH':
        // Locked side-profile track during launch
        CameraInstance.controls.enabled = false;

        const shake = 0.02 * Math.sin(this.time * 75);
        this._tempCamPos.copy(this._tempRocketWorldPos).add(new THREE.Vector3(shake, 0.8 + shake, 4.5));

        CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.08);
        CameraInstance.controls.target.lerp(this._tempRocketWorldPos, 0.08);
        CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
        break;

      case 'ATMOSPHERIC_ASCENT':
        // Locked side-profile camera tracking rocket through clouds
        CameraInstance.controls.enabled = false;

        this._tempCamPos.copy(this._tempRocketWorldPos).add(new THREE.Vector3(3.0, 1.0, 5.0));
        
        CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.06);
        CameraInstance.controls.target.lerp(this._tempRocketWorldPos, 0.06);
        CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
        break;

      case 'SPACE_TRANSITION':
        CameraInstance.controls.enabled = false;

        if (this.booster) {
          this._tempCamPos.copy(this._tempBoosterWorldPos).add(new THREE.Vector3(2.5, 0.8, 4.0));
          CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.08);
          CameraInstance.controls.target.lerp(this._tempBoosterWorldPos, 0.08);
        } else {
          this._tempCamPos.copy(this._tempRocketWorldPos).add(new THREE.Vector3(3.0, 1.0, 5.0));
          CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.08);
          CameraInstance.controls.target.lerp(this._tempRocketWorldPos, 0.08);
        }
        CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
        break;

      case 'PLAYER_CONTROLLED_SPACE':
        // FULLY UNLOCKED 3D CAMERA IN SPACE!
        // Enable OrbitControls once when entering space phase so player can freely rotate 360°, pan, and zoom!
        if (!CameraInstance.controls.enabled) {
          CameraInstance.controls.enabled = true;
          CameraInstance.controls.target.copy(this._tempRocketWorldPos);
          CameraInstance.activeCamera.position.copy(this._tempRocketWorldPos).add(new THREE.Vector3(3.5, 1.5, 5.5));
        }
        CameraInstance.controls.update();
        break;

      case 'SATELLITE_DEPLOYMENT':
        CameraInstance.controls.enabled = false;

        this._tempCamTarget.addVectors(this._tempRocketWorldPos, this._tempSatWorldPos).multiplyScalar(0.5);
        this._tempCamPos.copy(this._tempCamTarget).add(new THREE.Vector3(2.0, 0.8, 3.5));
        
        CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.08);
        CameraInstance.controls.target.lerp(this._tempCamTarget, 0.08);
        CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
        break;

      case 'SATELLITE_TRANSFER':
        CameraInstance.controls.enabled = false;

        this._tempCamPos.copy(this._tempSatWorldPos).add(new THREE.Vector3(2.5, 1.0, 4.0));
        
        CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.06);
        CameraInstance.controls.target.lerp(this._tempSatWorldPos, 0.06);
        CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
        break;

      case 'MOON_ORBIT':
        CameraInstance.controls.enabled = false;

        const moonCenter = new THREE.Vector3(0, 0, -200.0);
        this._tempCamPos.copy(this._tempSatWorldPos).add(new THREE.Vector3(3.0, 1.5, 5.0));
        
        CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.06);
        CameraInstance.controls.target.lerp(moonCenter, 0.06);
        CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
        break;

      case 'PROBE_SEPARATION':
      case 'PROBE_FOLLOW':
        // Cinematic third-person probe camera. The Moon remains scenery, never its target.
        CameraInstance.controls.enabled = false;
        this._tempCamPos.copy(this._tempSatWorldPos).add(new THREE.Vector3(3.4, 1.8, 6.2));
        CameraInstance.activeCamera.position.lerp(this._tempCamPos, this.cameraState === 'PROBE_SEPARATION' ? 0.045 : 0.075);
        CameraInstance.controls.target.lerp(this._tempSatWorldPos, this.cameraState === 'PROBE_SEPARATION' ? 0.055 : 0.085);
        CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
        break;
    }
  }
}

export const EarthToMoonSceneInstance = new EarthToMoonScene();
export { EarthToMoonScene };

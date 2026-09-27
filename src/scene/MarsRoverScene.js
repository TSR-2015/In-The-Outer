import * as THREE from 'three';
import gsap from 'gsap';
import { CameraInstance } from '../camera/CameraManager.js';
import { MarsRoverMissionInstance } from '../missions/MarsRoverMission.js';
import { EngineInstance } from '../core/Engine.js';
import { AudioInstance } from '../managers/AudioManager.js';

class MarsRoverScene {
  constructor() {
    this.group = new THREE.Group();

    // Scene Elements
    this.terrainMesh = null;
    this.sampleBeacons = [];
    this.dustParticles = null;
    this.wheelDustParticles = null;
    this.rockInstancedMesh = null;

    // Dual Rovers for Multiplayer (Player 1 and Player 2)
    this.rovers = {
      1: null,
      2: null
    };

    // Dual Perspective Cameras
    this.camera1 = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera2 = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Green Soil Indicator Meshes
    this.greenSoilGroup = null;
    this.greenSoilMeshes = [];

    this.time = 0;

    // Temp reusable vectors
    this._tempPos1 = new THREE.Vector3();
    this._tempCamPos1 = new THREE.Vector3();
    this._tempCamTarget1 = new THREE.Vector3();

    this._tempPos2 = new THREE.Vector3();
    this._tempCamPos2 = new THREE.Vector3();
    this._tempCamTarget2 = new THREE.Vector3();
  }

  init(parentScene) {
    this.group = new THREE.Group();
    this.group.name = "orbit_elements";
    this.sampleBeacons = [];
    this.greenSoilMeshes = [];

    // Atmospheric setup: Mars reddish sky & fog
    if (EngineInstance.scene) {
      EngineInstance.scene.background = new THREE.Color(0xb44c28);
      EngineInstance.scene.fog = new THREE.FogExp2(0xb44c28, 0.007);
    }

    // 1. Lighting Setup
    const sunLight = new THREE.DirectionalLight(0xffecd0, 2.8);
    sunLight.position.set(80, 100, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 300;
    const d = 120;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.group.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xd97746, 0.85);
    this.group.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xdd6b35, 0x3f1f14, 0.6);
    this.group.add(hemiLight);

    // 2. Build Terrain & Regions
    this.buildMarsTerrain();

    // 3. Scatter Instanced Rocks
    this.buildInstancedRocks();

    // 4. Sample Beacons & Research Anomaly
    this.buildSampleBeacons();

    // 5. Build Procedural Rovers for Player 1 and Player 2
    this.rovers[1] = this.buildRoverMesh(1);
    this.rovers[2] = this.buildRoverMesh(2);

    this.group.add(this.rovers[1].group);
    this.group.add(this.rovers[2].group);

    // 6. Build Green Bordered Soil Sampling Indicator Regions
    this.buildGreenSoilZones();

    // 7. Airborne Dust Particles & Wheel Trail Particles
    this.buildAirborneDust();
    this.buildWheelDustEmitter();

    parentScene.add(this.group);

    // Hook split-screen custom rendering
    EngineInstance.setCustomRenderCallback(this.renderSplitScreen.bind(this));
  }

  cleanup() {
    EngineInstance.setCustomRenderCallback(null);
  }

  // PROCEDURAL MARS TERRAIN WITH 4 REGIONS & HEIGHTFIELD
  buildMarsTerrain() {
    const size = 260;
    const segments = 128;
    const geom = new THREE.PlaneGeometry(size, size, segments, segments);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const cBase = new THREE.Color(0xb84b29); // Mars rust red base
    const cDune = new THREE.Color(0xd97441); // Dune orange
    const cCrater = new THREE.Color(0x732918); // Dark crater basalt
    const cResearch = new THREE.Color(0x9e3c20); // Research clay

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);

      let h = Math.sin(x * 0.04) * 2.2 + Math.cos(z * 0.03) * 2.5 + Math.sin(x * 0.08 + z * 0.08) * 0.8;
      h += Math.sin(x * 0.35 + z * 0.21) * 0.35 + Math.cos(x * 0.5 - z * 0.4) * 0.22;

      if (x < -30 && z > 20) {
        h += Math.sin(x * 0.12 - z * 0.08) * 4.5 + Math.cos(z * 0.15) * 2.2;
      }

      const craterDist = Math.sqrt((x - 60) * (x - 60) + (z + 55) * (z + 55));
      if (craterDist < 35) {
        if (craterDist < 25) {
          h -= (25 - craterDist) * 0.35;
        } else {
          h += (35 - craterDist) * 0.4;
        }
      }

      if (x < -40 && z < -40) {
        h += Math.sin(x * 0.1) * 1.5 + Math.cos(z * 0.1) * 1.5;
      }

      posAttr.setY(i, h);

      let finalColor = cBase.clone();
      if (x < -30 && z > 20) {
        finalColor.lerp(cDune, 0.65);
      } else if (craterDist < 35) {
        finalColor.lerp(cCrater, 0.7);
      } else if (x < -40 && z < -40) {
        finalColor.lerp(cResearch, 0.6);
      }

      colors[i * 3] = finalColor.r;
      colors[i * 3 + 1] = finalColor.g;
      colors[i * 3 + 2] = finalColor.b;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.08,
      flatShading: false
    });

    this.terrainMesh = new THREE.Mesh(geom, terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.group.add(this.terrainMesh);
  }

  getTerrainHeight(x, z) {
    let h = Math.sin(x * 0.04) * 2.2 + Math.cos(z * 0.03) * 2.5 + Math.sin(x * 0.08 + z * 0.08) * 0.8;
    h += Math.sin(x * 0.35 + z * 0.21) * 0.35 + Math.cos(x * 0.5 - z * 0.4) * 0.22;

    if (x < -30 && z > 20) {
      h += Math.sin(x * 0.12 - z * 0.08) * 4.5 + Math.cos(z * 0.15) * 2.2;
    }

    const craterDist = Math.sqrt((x - 60) * (x - 60) + (z + 55) * (z + 55));
    if (craterDist < 35) {
      if (craterDist < 25) {
        h -= (25 - craterDist) * 0.35;
      } else {
        h += (35 - craterDist) * 0.4;
      }
    }

    if (x < -40 && z < -40) {
      h += Math.sin(x * 0.1) * 1.5 + Math.cos(z * 0.1) * 1.5;
    }

    return h;
  }

  // INSTANCED BOULDERS & ROCKS
  buildInstancedRocks() {
    const rockCount = 200;
    const baseRockGeom = new THREE.DodecahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x5a2315,
      roughness: 0.95,
      metalness: 0.05
    });

    this.rockInstancedMesh = new THREE.InstancedMesh(baseRockGeom, rockMat, rockCount);
    this.rockInstancedMesh.castShadow = true;
    this.rockInstancedMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    this.rockColliders = [];

    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < rockCount; i++) {
      let rx = (rnd() - 0.5) * 220;
      let rz = (rnd() - 0.5) * 220;

      // Keep starting spawn area clear
      if (Math.abs(rx) < 18 && Math.abs(rz) < 18) {
        rx += 30;
      }

      const ry = this.getTerrainHeight(rx, rz);
      const scaleBase = 0.5 + rnd() * 2.2;
      const scaleX = scaleBase * (0.7 + rnd() * 0.6);
      const scaleY = scaleBase * (0.6 + rnd() * 0.8);
      const scaleZ = scaleBase * (0.7 + rnd() * 0.6);

      dummy.position.set(rx, ry + scaleY * 0.4, rz);
      dummy.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();

      this.rockInstancedMesh.setMatrixAt(i, dummy.matrix);

      if (scaleBase > 1.2) {
        this.rockColliders.push({
          x: rx,
          z: rz,
          radius: Math.max(scaleX, scaleZ) * 1.05
        });
      }
    }

    this.rockInstancedMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.rockInstancedMesh);
  }

  checkRockCollision(x, z, roverRadius = 1.3) {
    if (!this.rockColliders) return false;
    for (let i = 0; i < this.rockColliders.length; i++) {
      const r = this.rockColliders[i];
      const dx = x - r.x;
      const dz = z - r.z;
      const minDist = r.radius + roverRadius;
      if (dx * dx + dz * dz < minDist * minDist) {
        return true;
      }
    }
    return false;
  }

  // SAMPLE BEACONS & ANOMALY
  buildSampleBeacons() {
    const zones = MarsRoverMissionInstance.sampleZones;

    zones.forEach(z => {
      const beacon = new THREE.Group();
      const gy = this.getTerrainHeight(z.x, z.z);
      beacon.position.set(z.x, gy, z.z);

      const beamGeom = new THREE.CylinderGeometry(0.15, 0.15, 20, 8);
      beamGeom.translate(0, 10, 0);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beacon.add(beam);

      const ringGeom = new THREE.RingGeometry(1.5, 2.2, 16);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.y = 0.2;
      beacon.add(ring);

      this.group.add(beacon);
      this.sampleBeacons.push({ group: beacon, beam, ring, zone: z });
    });

    // Research Anomaly
    const anomalyGroup = new THREE.Group();
    const ay = this.getTerrainHeight(-75, -70);
    anomalyGroup.position.set(-75, ay, -70);

    const pyrGeom = new THREE.ConeGeometry(3.5, 7, 4);
    const pyrMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.1
    });
    const pyr = new THREE.Mesh(pyrGeom, pyrMat);
    pyr.position.set(0, 3.5, 0);
    anomalyGroup.add(pyr);
    this.group.add(anomalyGroup);
  }

  // FACTORY TO BUILD PROCEDURAL 6-WHEELED ROVER FOR PLAYER 1 OR 2
  buildRoverMesh(playerNum) {
    const roverGroup = new THREE.Group();
    roverGroup.name = `mars_rover_p${playerNum}`;

    const isP1 = playerNum === 1;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.8 });
    const foilMat = new THREE.MeshStandardMaterial({
      color: isP1 ? 0xf59e0b : 0x0284c7, // Gold foil for P1, Cyan-blue foil for P2
      roughness: 0.4,
      metalness: 0.8
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.4 });
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.2, metalness: 0.9 });
    const accentColor = isP1 ? 0xe11d48 : 0x0284c7;

    // Main Chassis Body
    const chassisGeom = new THREE.BoxGeometry(1.6, 0.6, 2.2);
    const chassisMesh = new THREE.Mesh(chassisGeom, bodyMat);
    chassisMesh.position.set(0, 0.8, 0);
    chassisMesh.castShadow = true;
    roverGroup.add(chassisMesh);

    // Foil Insulation Wrap on Rear Payload
    const foilGeom = new THREE.BoxGeometry(1.4, 0.4, 0.8);
    const foilMesh = new THREE.Mesh(foilGeom, foilMat);
    foilMesh.position.set(0, 1.1, -0.6);
    roverGroup.add(foilMesh);

    // Twin Solar Panel Wings
    const panelGeom = new THREE.BoxGeometry(1.2, 0.04, 1.6);
    const leftSolar = new THREE.Mesh(panelGeom, solarMat);
    leftSolar.position.set(-1.4, 1.15, 0);
    roverGroup.add(leftSolar);

    const rightSolar = new THREE.Mesh(panelGeom, solarMat);
    rightSolar.position.set(1.4, 1.15, 0);
    roverGroup.add(rightSolar);

    // Camera Mast Structure (Front-Center)
    const cameraMast = new THREE.Group();
    const mastPoleGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const mastPole = new THREE.Mesh(mastPoleGeom, darkMat);
    mastPole.position.set(0, 0.6, 0);
    cameraMast.add(mastPole);

    const headGeom = new THREE.BoxGeometry(0.4, 0.2, 0.25);
    const headMesh = new THREE.Mesh(headGeom, bodyMat);
    headMesh.position.set(0, 1.2, 0);
    cameraMast.add(headMesh);

    // Dual Lens Optics
    const lensGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12);
    lensGeom.rotateX(Math.PI / 2);
    const lensMat = new THREE.MeshBasicMaterial({ color: accentColor });

    const lensL = new THREE.Mesh(lensGeom, lensMat);
    lensL.position.set(-0.1, 1.2, 0.12);
    cameraMast.add(lensL);

    const lensR = new THREE.Mesh(lensGeom, lensMat);
    lensR.position.set(0.1, 1.2, 0.12);
    cameraMast.add(lensR);

    cameraMast.position.set(0, 1.1, 0.8);
    roverGroup.add(cameraMast);

    // Dish Antenna
    const dishGeom = new THREE.CylinderGeometry(0.35, 0.05, 0.1, 16);
    dishGeom.rotateX(Math.PI / 4);
    const dishMesh = new THREE.Mesh(dishGeom, darkMat);
    dishMesh.position.set(0.5, 1.4, -0.7);
    roverGroup.add(dishMesh);

    // Identification Flag Marker (P1 / P2)
    const flagPoleGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6);
    const flagPole = new THREE.Mesh(flagPoleGeom, darkMat);
    flagPole.position.set(-0.6, 1.6, -0.9);
    roverGroup.add(flagPole);

    const flagGeom = new THREE.BoxGeometry(0.45, 0.3, 0.02);
    const flagMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const flagMesh = new THREE.Mesh(flagGeom, flagMat);
    flagMesh.position.set(-0.35, 2.3, -0.9);
    roverGroup.add(flagMesh);

    // Articulated Robotic Arm with Glass Test Tube
    const roboticArm = new THREE.Group();
    roboticArm.position.set(0.6, 0.8, 0.9);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), darkMat);
    roboticArm.add(shoulder);

    const armSegment1 = new THREE.Group();
    const seg1Geom = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    seg1Geom.translate(0, 0.3, 0);
    const seg1Mesh = new THREE.Mesh(seg1Geom, bodyMat);
    armSegment1.add(seg1Mesh);
    roboticArm.add(armSegment1);

    const armSegment2 = new THREE.Group();
    armSegment2.position.set(0, 0.6, 0);
    const seg2Geom = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
    seg2Geom.translate(0, 0.25, 0);
    const seg2Mesh = new THREE.Mesh(seg2Geom, darkMat);
    armSegment2.add(seg2Mesh);

    const clawGroup = new THREE.Group();
    clawGroup.position.set(0, 0.5, 0);
    const clawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), foilMat);
    clawGroup.add(clawMesh);

    // Glass test tube
    const testTubeGroup = new THREE.Group();
    testTubeGroup.position.set(0.08, -0.1, 0.08);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.65
    });
    const testTubeGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.35, 16), glassMat);
    testTubeGroup.add(testTubeGlass);

    const capMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    capMesh.position.set(0, 0.18, 0);
    testTubeGroup.add(capMesh);

    const fillGeom = new THREE.CylinderGeometry(0.038, 0.038, 0.28, 12);
    fillGeom.translate(0, -0.12, 0);
    const testTubeFillMesh = new THREE.Mesh(fillGeom, new THREE.MeshStandardMaterial({ color: 0xd97441, roughness: 0.95 }));
    testTubeFillMesh.scale.set(1, 0.001, 1);
    testTubeGroup.add(testTubeFillMesh);

    clawGroup.add(testTubeGroup);
    armSegment2.add(clawGroup);
    armSegment1.add(armSegment2);
    roverGroup.add(roboticArm);

    // 6 Wheels with Suspension Pivots
    const wheelGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 16);
    wheelGeom.rotateZ(Math.PI / 2);

    const wheels = [];
    const frontSteerPivots = [];

    const wheelOffsets = [
      { x: -1.0, y: 0.32, z: 0.9, isSteering: true },
      { x: -1.0, y: 0.32, z: 0.0, isSteering: false },
      { x: -1.0, y: 0.32, z: -0.9, isSteering: true },
      { x: 1.0, y: 0.32, z: 0.9, isSteering: true },
      { x: 1.0, y: 0.32, z: 0.0, isSteering: false },
      { x: 1.0, y: 0.32, z: -0.9, isSteering: true }
    ];

    wheelOffsets.forEach(off => {
      const pivot = new THREE.Group();
      pivot.position.set(off.x, off.y, off.z);

      const wheelMesh = new THREE.Mesh(wheelGeom, tireMat);
      wheelMesh.castShadow = true;
      pivot.add(wheelMesh);

      roverGroup.add(pivot);
      wheels.push(wheelMesh);
      if (off.isSteering) {
        frontSteerPivots.push(pivot);
      }
    });

    return {
      group: roverGroup,
      wheels,
      frontSteerPivots,
      cameraMast,
      roboticArm,
      armSegment1,
      armSegment2,
      clawGroup,
      testTubeGroup,
      testTubeFillMesh,
      isArmAnimating: false
    };
  }

  // GREEN SOIL SAMPLE INDICATORS
  buildGreenSoilZones() {
    this.greenSoilGroup = new THREE.Group();
    const ringGeom = new THREE.RingGeometry(2.5, 3.8, 32);
    ringGeom.rotateX(-Math.PI / 2);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });

    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(ringGeom, ringMat.clone());
      ring.position.set(0, -999, 0);
      this.greenSoilGroup.add(ring);
      this.greenSoilMeshes.push(ring);
    }
    this.group.add(this.greenSoilGroup);
  }

  // AIRBORNE DUST PARTICLES
  buildAirborneDust() {
    const count = 350;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = 1.0 + Math.random() * 25.0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xd97441,
      size: 0.35,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(geom, mat);
    this.group.add(this.dustParticles);
  }

  buildWheelDustEmitter() {
    const count = 80;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -9999;
      positions[i * 3 + 2] = 0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xc85a32,
      size: 0.4,
      transparent: true,
      opacity: 0.5,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.wheelDustParticles = new THREE.Points(geom, mat);
    this.group.add(this.wheelDustParticles);
  }

  emitWheelDust(origin) {
    if (!this.wheelDustParticles) return;
    const posAttr = this.wheelDustParticles.geometry.attributes.position;
    const idx = Math.floor(Math.random() * posAttr.count);
    posAttr.setXYZ(
      idx,
      origin.x + (Math.random() - 0.5) * 0.6,
      origin.y + 0.1,
      origin.z + (Math.random() - 0.5) * 0.6
    );
    posAttr.needsUpdate = true;
  }

  // ANIMATE TEST TUBE SAMPLING FOR GIVEN PLAYER
  animateTestTubeScoop(playerNum, soilColor, onDone) {
    const r = this.rovers[playerNum];
    if (!r || r.isArmAnimating) {
      if (onDone) onDone();
      return;
    }

    r.isArmAnimating = true;
    if (r.testTubeFillMesh) {
      r.testTubeFillMesh.material.color.setHex(soilColor);
    }

    const tl = gsap.timeline({
      onComplete: () => {
        r.isArmAnimating = false;
        if (onDone) onDone();
      }
    });

    // Lower arm -> scoop -> raise arm
    tl.to(r.armSegment1.rotation, { x: 0.85, duration: 0.45, ease: "power2.out" })
      .to(r.armSegment2.rotation, { x: 0.95, duration: 0.45, ease: "power2.out" }, "-=0.2")
      .to(r.testTubeFillMesh.scale, { y: 1.0, duration: 0.35, ease: "power1.inOut" })
      .to(r.armSegment1.rotation, { x: 0.0, duration: 0.5, ease: "power2.inOut" }, "+=0.1")
      .to(r.armSegment2.rotation, { x: 0.0, duration: 0.5, ease: "power2.inOut" }, "-=0.35");
  }

  // UPDATE LOOP (60 FPS)
  update(delta, time) {
    this.time = time;
    const mission = MarsRoverMissionInstance;

    // Update Rover 1 and Rover 2 meshes
    [1, 2].forEach(pNum => {
      const p = mission.players[pNum];
      const r = this.rovers[pNum];
      if (!p || !r) return;

      const rx = p.roverX;
      const rz = p.roverZ;
      const ry = this.getTerrainHeight(rx, rz);

      const facingX = Math.sin(p.roverRotation);
      const facingZ = Math.cos(p.roverRotation);
      const sideX = Math.cos(p.roverRotation);
      const sideZ = -Math.sin(p.roverRotation);

      const frontY = this.getTerrainHeight(rx + facingX * 1.6, rz + facingZ * 1.6);
      const backY = this.getTerrainHeight(rx - facingX * 1.6, rz - facingZ * 1.6);
      const leftY = this.getTerrainHeight(rx + sideX * 0.9, rz + sideZ * 0.9);
      const rightY = this.getTerrainHeight(rx - sideX * 0.9, rz - sideZ * 0.9);

      const pitch = Math.atan2(frontY - backY, 3.2);
      const roll = Math.atan2(leftY - rightY, 1.8);

      r.group.position.set(rx, ry, rz);
      r.group.rotation.y = p.roverRotation;
      r.group.rotation.x = THREE.MathUtils.lerp(r.group.rotation.x || 0, pitch, 0.25);
      r.group.rotation.z = THREE.MathUtils.lerp(r.group.rotation.z || 0, roll, 0.25);

      const bob = Math.sin((time + pNum * 2) * 8.0) * 0.015 * Math.min(1, Math.abs(p.speed) / 3.0 + 0.15);
      r.group.position.y += bob;

      const speedPct = p.speed / 6.5;
      r.wheels.forEach(w => {
        w.rotation.x += speedPct * delta * 12.0;
      });

      const steerAngle = (p.keys.left ? 0.35 : 0) - (p.keys.right ? 0.35 : 0);
      r.frontSteerPivots.forEach(pivot => {
        pivot.rotation.y = steerAngle;
      });

      if (r.cameraMast) {
        r.cameraMast.rotation.y = Math.sin((time + pNum) * 0.5) * 0.08;
      }

      if (Math.abs(p.speed) > 0.5) {
        this.emitWheelDust(r.group.position);
      }
    });

    // Sample Beacons Animation
    this.sampleBeacons.forEach(b => {
      if (b.ring) b.ring.rotation.z = time * 1.5;
      if (b.beam) b.beam.material.opacity = 0.25 + Math.sin(time * 3) * 0.1;
    });

    // Atmospheric Dust
    if (this.dustParticles) {
      const windFactor = THREE.MathUtils.clamp(mission.windSpeed / 20, 0.4, 2.5);
      const gust = 1.0 + Math.sin(time * 0.6) * 0.35;
      const driftSpeed = windFactor * gust;

      const posAttr = this.dustParticles.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let x = posAttr.getX(i) + delta * 1.8 * driftSpeed;
        let y = posAttr.getY(i) + Math.sin(time * 0.4 + posAttr.getX(i) * 0.05) * delta * 0.3;
        let z = posAttr.getZ(i) + delta * 0.8 * driftSpeed;
        if (x > 130) x = -130;
        if (z > 130) z = -130;
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }

    // Update Cameras
    this.updateCameras(delta);
  }

  updateCameras(delta) {
    const mission = MarsRoverMissionInstance;

    // Update Camera 1 for Player 1
    if (this.rovers[1]) {
      this.updateSingleCamera(this.camera1, this.rovers[1].group, mission.players[1]);
    }

    // Update Camera 2 for Player 2
    if (this.rovers[2]) {
      this.updateSingleCamera(this.camera2, this.rovers[2].group, mission.players[2]);
    }
  }

  updateSingleCamera(camera, roverGroup, playerState) {
    if (!roverGroup || !playerState) return;

    const tempPos = new THREE.Vector3();
    const tempCamPos = new THREE.Vector3();
    const tempTarget = new THREE.Vector3();

    roverGroup.getWorldPosition(tempPos);
    const rot = roverGroup.rotation.y;

    if (playerState.inViewfinder) {
      if (playerState.viewfinderMode === 'sky') {
        const mastOffset = new THREE.Vector3(0, 2.3, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        tempCamPos.copy(tempPos).add(mastOffset);
        const lookTarget = new THREE.Vector3(0, 8.0, 15.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        tempTarget.copy(tempPos).add(lookTarget);
      } else {
        const mastOffset = new THREE.Vector3(0, 2.2, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        tempCamPos.copy(tempPos).add(mastOffset);
        const lookTarget = new THREE.Vector3(0, -1.8, 4.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        tempTarget.copy(tempPos).add(lookTarget);
      }
    } else if (playerState.inSamplingMode) {
      const armCamOffset = new THREE.Vector3(0.8, 2.4, 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      tempCamPos.copy(tempPos).add(armCamOffset);
      const lookTarget = new THREE.Vector3(0.0, 0.2, 2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      tempTarget.copy(tempPos).add(lookTarget);
    } else {
      // Normal Third-Person Follow Camera
      const camOffset = new THREE.Vector3(0, 3.8, -8.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      tempCamPos.copy(tempPos).add(camOffset);
      tempTarget.copy(tempPos).add(new THREE.Vector3(0, 1.4, 0));

      const minCamY = this.getTerrainHeight(tempCamPos.x, tempCamPos.z) + 1.8;
      if (tempCamPos.y < minCamY) {
        tempCamPos.y = minCamY;
      }
    }

    camera.position.lerp(tempCamPos, 0.09);
    camera.lookAt(tempTarget);
  }

  // SPLIT SCREEN RENDER PASS HOOK
  renderSplitScreen(renderer, scene) {
    const isSplit = MarsRoverMissionInstance.isSplitScreen;
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (isSplit) {
      // TWO PLAYER SPLIT-SCREEN MODE (Left: P1, Right: P2)
      renderer.setScissorTest(true);
      const halfWidth = Math.floor(width / 2);

      // 1. Left Viewport (Player 1)
      renderer.setViewport(0, 0, halfWidth, height);
      renderer.setScissor(0, 0, halfWidth, height);
      this.camera1.aspect = halfWidth / height;
      this.camera1.updateProjectionMatrix();
      renderer.render(scene, this.camera1);

      // 2. Right Viewport (Player 2)
      renderer.setViewport(halfWidth, 0, width - halfWidth, height);
      renderer.setScissor(halfWidth, 0, width - halfWidth, height);
      this.camera2.aspect = (width - halfWidth) / height;
      this.camera2.updateProjectionMatrix();
      renderer.render(scene, this.camera2);

      renderer.setScissorTest(false);
    } else {
      // ONE PLAYER FULLSCREEN MODE
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      this.camera1.aspect = width / height;
      this.camera1.updateProjectionMatrix();
      renderer.render(scene, this.camera1);
    }
  }
}

export const MarsRoverSceneInstance = new MarsRoverScene();
export { MarsRoverScene };

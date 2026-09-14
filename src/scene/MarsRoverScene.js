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
    this.roverGroup = null;
    this.wheels = [];
    this.frontSteerPivots = [];
    this.roboticArm = null;
    this.armSegment1 = null;
    this.armSegment2 = null;
    this.clawGroup = null;
    this.testTubeGroup = null;
    this.testTubeGlass = null;
    this.testTubeFillMesh = null;
    this.cameraMast = null;
    
    this.sampleBeacons = [];
    this.dustParticles = null;
    this.wheelDustParticles = null;
    this.rockInstancedMesh = null;
    
    // Green Soil Region Indicator Meshes
    this.greenSoilGroup = null;
    this.greenSoilMeshes = [];
    
    this.isArmAnimating = false;
    this.cameraMode = 'follow'; // follow, viewfinder_sky, viewfinder_ground, sampling_arm
    this.time = 0;
    
    // Temp reusable vectors
    this._tempRoverPos = new THREE.Vector3();
    this._tempCamPos = new THREE.Vector3();
    this._tempCamTarget = new THREE.Vector3();
  }

  init(parentScene) {
    this.group = new THREE.Group();
    this.group.name = "orbit_elements";
    this.wheels = [];
    this.frontSteerPivots = [];
    this.sampleBeacons = [];
    this.greenSoilMeshes = [];
    this.isArmAnimating = false;
    this.cameraMode = 'follow';

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

    // 5. Build Procedural 6-Wheeled Mars Rover with Robotic Arm & Glass Test Tube
    this.buildMarsRover();

    // 6. Build Green Bordered Soil Sampling Indicator Regions
    this.buildGreenSoilZones();

    // 7. Airborne Dust Particles & Wheel Trail Particles
    this.buildAirborneDust();
    this.buildWheelDustEmitter();

    parentScene.add(this.group);
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
        finalColor.lerp(cCrater, 0.75);
      } else if (x < -40 && z < -40) {
        finalColor.lerp(cResearch, 0.55);
      }
      finalColor.r += (h * 0.02);

      colors[i * 3] = finalColor.r;
      colors[i * 3 + 1] = finalColor.g;
      colors[i * 3 + 2] = finalColor.b;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(geom, mat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = true;
    this.group.add(this.terrainMesh);
  }

  // Get terrain height Y at coordinate (x, z)
  getTerrainHeight(x, z) {
    let h = Math.sin(x * 0.04) * 2.2 + Math.cos(z * 0.03) * 2.5 + Math.sin(x * 0.08 + z * 0.08) * 0.8;
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

  // SCATTER INSTANCED ROCKS
  buildInstancedRocks() {
    const rockCount = 320;
    const geom = new THREE.DodecahedronGeometry(0.8, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6e2a16,
      roughness: 0.95,
      metalness: 0.1,
      flatShading: true
    });

    this.rockInstancedMesh = new THREE.InstancedMesh(geom, mat, rockCount);
    this.rockInstancedMesh.castShadow = true;
    this.rockInstancedMesh.receiveShadow = true;
    this.rockInstancedMesh.name = "rock_instances";

    const dummy = new THREE.Object3D();
    let seed = 12345;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

    for (let i = 0; i < rockCount; i++) {
      const rx = (rand() - 0.5) * 230;
      const rz = (rand() - 0.5) * 230;

      if (Math.sqrt(rx * rx + rz * rz) < 12) continue;

      const ry = this.getTerrainHeight(rx, rz);
      const scaleX = 0.4 + rand() * 1.8;
      const scaleY = 0.3 + rand() * 1.4;
      const scaleZ = 0.4 + rand() * 1.8;

      dummy.position.set(rx, ry + scaleY * 0.4, rz);
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();

      this.rockInstancedMesh.setMatrixAt(i, dummy.matrix);
    }

    this.rockInstancedMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.rockInstancedMesh);
  }

  // SAMPLE BEACONS & RESEARCH ANOMALY
  buildSampleBeacons() {
    MarsRoverMissionInstance.sampleZones.forEach(zone => {
      const beaconGroup = new THREE.Group();
      const ry = this.getTerrainHeight(zone.x, zone.z);
      beaconGroup.position.set(zone.x, ry, zone.z);

      const ringGeom = new THREE.RingGeometry(1.2, 1.6, 24);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      beaconGroup.add(ring);

      const beamGeom = new THREE.CylinderGeometry(0.1, 0.8, 12, 16);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beam.position.set(0, 6, 0);
      beaconGroup.add(beam);

      this.group.add(beaconGroup);
      this.sampleBeacons.push({ id: zone.id, group: beaconGroup, ring: ring, beam: beam });
    });

    const anomalyGroup = new THREE.Group();
    const ay = this.getTerrainHeight(-75, -70);
    anomalyGroup.position.set(-75, ay, -70);

    const pyrGeom = new THREE.ConeGeometry(4.0, 7.0, 4);
    const pyrMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.9
    });
    const pyr = new THREE.Mesh(pyrGeom, pyrMat);
    pyr.position.set(0, 3.5, 0);
    anomalyGroup.add(pyr);

    this.group.add(anomalyGroup);
  }

  // BUILD PROCEDURAL 6-WHEELED MARS ROVER WITH GLASS TEST TUBE ROBOTIC ARM
  buildMarsRover() {
    this.roverGroup = new THREE.Group();
    this.roverGroup.name = "mars_rover";

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.8 });
    const goldFoilMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.8 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.4 });
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.2, metalness: 0.9 });

    // Main Chassis Body
    const chassisGeom = new THREE.BoxGeometry(1.6, 0.6, 2.2);
    const chassisMesh = new THREE.Mesh(chassisGeom, bodyMat);
    chassisMesh.position.set(0, 0.8, 0);
    chassisMesh.castShadow = true;
    this.roverGroup.add(chassisMesh);

    // Gold Foil Insulation Wrap on Rear Payload
    const foilGeom = new THREE.BoxGeometry(1.4, 0.4, 0.8);
    const foilMesh = new THREE.Mesh(foilGeom, goldFoilMat);
    foilMesh.position.set(0, 1.1, -0.6);
    this.roverGroup.add(foilMesh);

    // Twin Solar Panel Wings
    const panelGeom = new THREE.BoxGeometry(1.2, 0.04, 1.6);
    
    const leftSolar = new THREE.Mesh(panelGeom, solarMat);
    leftSolar.position.set(-1.4, 1.15, 0);
    this.roverGroup.add(leftSolar);

    const rightSolar = new THREE.Mesh(panelGeom, solarMat);
    rightSolar.position.set(1.4, 1.15, 0);
    this.roverGroup.add(rightSolar);

    // Camera Mast Structure (Front-Center)
    this.cameraMast = new THREE.Group();
    const mastPoleGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const mastPole = new THREE.Mesh(mastPoleGeom, darkMat);
    mastPole.position.set(0, 0.6, 0);
    this.cameraMast.add(mastPole);

    const headGeom = new THREE.BoxGeometry(0.4, 0.2, 0.25);
    const headMesh = new THREE.Mesh(headGeom, bodyMat);
    headMesh.position.set(0, 1.2, 0);
    this.cameraMast.add(headMesh);

    // Dual Lens Optics
    const lensGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12);
    lensGeom.rotateX(Math.PI / 2);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const lensL = new THREE.Mesh(lensGeom, lensMat);
    lensL.position.set(-0.1, 1.2, 0.12);
    this.cameraMast.add(lensL);

    const lensR = new THREE.Mesh(lensGeom, lensMat);
    lensR.position.set(0.1, 1.2, 0.12);
    this.cameraMast.add(lensR);

    this.cameraMast.position.set(0, 1.1, 0.8);
    this.roverGroup.add(this.cameraMast);

    // Dish Antenna
    const dishGeom = new THREE.CylinderGeometry(0.35, 0.05, 0.1, 16);
    dishGeom.rotateX(Math.PI / 4);
    const dishMesh = new THREE.Mesh(dishGeom, darkMat);
    dishMesh.position.set(0.5, 1.4, -0.7);
    this.roverGroup.add(dishMesh);

    // Articulated Robotic Arm Assembly with Glass Test Tube (Front-Right Hand)
    this.roboticArm = new THREE.Group();
    this.roboticArm.position.set(0.6, 0.8, 0.9);

    const shoulderGeom = new THREE.SphereGeometry(0.12, 12, 12);
    const shoulder = new THREE.Mesh(shoulderGeom, darkMat);
    this.roboticArm.add(shoulder);

    this.armSegment1 = new THREE.Group();
    const seg1Geom = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    seg1Geom.translate(0, 0.3, 0);
    const seg1Mesh = new THREE.Mesh(seg1Geom, bodyMat);
    this.armSegment1.add(seg1Mesh);
    this.roboticArm.add(this.armSegment1);

    this.armSegment2 = new THREE.Group();
    this.armSegment2.position.set(0, 0.6, 0);
    const seg2Geom = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
    seg2Geom.translate(0, 0.25, 0);
    const seg2Mesh = new THREE.Mesh(seg2Geom, darkMat);
    this.armSegment2.add(seg2Mesh);

    // Gripper / Claw Group
    this.clawGroup = new THREE.Group();
    this.clawGroup.position.set(0, 0.5, 0);

    const clawGeom = new THREE.BoxGeometry(0.16, 0.08, 0.16);
    const clawMesh = new THREE.Mesh(clawGeom, goldFoilMat);
    this.clawGroup.add(clawMesh);

    // GLASS TEST TUBE HELD IN RIGHT HAND GRIPPER
    this.testTubeGroup = new THREE.Group();
    this.testTubeGroup.position.set(0.08, -0.1, 0.08);

    // Outer Glass Cylinder
    const glassGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.35, 16);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.65
    });
    this.testTubeGlass = new THREE.Mesh(glassGeom, glassMat);
    this.testTubeGroup.add(this.testTubeGlass);

    // Rubber Seal Cap on top
    const capGeom = new THREE.CylinderGeometry(0.048, 0.048, 0.06, 12);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const capMesh = new THREE.Mesh(capGeom, capMat);
    capMesh.position.set(0, 0.18, 0);
    this.testTubeGroup.add(capMesh);

    // Inner Regolith Soil Fill Cylinder (starts empty / scale Y = 0)
    const fillGeom = new THREE.CylinderGeometry(0.038, 0.038, 0.28, 12);
    fillGeom.translate(0, -0.12, 0);
    const fillMat = new THREE.MeshStandardMaterial({
      color: 0xd97441,
      roughness: 0.95
    });
    this.testTubeFillMesh = new THREE.Mesh(fillGeom, fillMat);
    this.testTubeFillMesh.scale.set(1, 0.001, 1);
    this.testTubeGroup.add(this.testTubeFillMesh);

    this.clawGroup.add(this.testTubeGroup);
    this.armSegment2.add(this.clawGroup);

    this.armSegment1.add(this.armSegment2);
    this.roverGroup.add(this.roboticArm);

    // 6 Wheels with Suspension Struts
    const wheelGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 16);
    wheelGeom.rotateZ(Math.PI / 2);

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

      const rimGeom = new THREE.CylinderGeometry(0.325, 0.325, 0.05, 8);
      rimGeom.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeom, darkMat);
      pivot.add(rimMesh);

      this.roverGroup.add(pivot);
      this.wheels.push(wheelMesh);

      if (off.isSteering) {
        this.frontSteerPivots.push(pivot);
      }
    });

    this.group.add(this.roverGroup);
  }

  // BUILD 3 GREEN BORDERED SOIL SAMPLING INDICATOR REGIONS ON THE GROUND
  buildGreenSoilZones() {
    this.greenSoilGroup = new THREE.Group();
    this.greenSoilGroup.name = "green_soil_zones";
    this.greenSoilGroup.visible = false;
    this.greenSoilMeshes = [];

    const offsets = [
      { x: -1.4, z: 2.2 },
      { x: 0.0,  z: 2.8 },
      { x: 1.4,  z: 2.2 }
    ];

    offsets.forEach((off, idx) => {
      const zoneGroup = new THREE.Group();

      const ringGeom = new THREE.RingGeometry(0.7, 0.9, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.name = `green_soil_ring_${idx}`;
      ring.userData = { zoneIndex: idx };
      zoneGroup.add(ring);

      const discGeom = new THREE.CircleGeometry(0.7, 32);
      discGeom.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35
      });
      const disc = new THREE.Mesh(discGeom, discMat);
      disc.name = `green_soil_disc_${idx}`;
      disc.userData = { zoneIndex: idx };
      zoneGroup.add(disc);

      const boxGeom = new THREE.CylinderGeometry(0.9, 0.9, 0.4, 16);
      const boxMat = new THREE.MeshBasicMaterial({ visible: false });
      const targetBox = new THREE.Mesh(boxGeom, boxMat);
      targetBox.name = `green_soil_target_${idx}`;
      targetBox.userData = { zoneIndex: idx };
      zoneGroup.add(targetBox);

      this.greenSoilGroup.add(zoneGroup);
      this.greenSoilMeshes.push(targetBox);
    });

    this.group.add(this.greenSoilGroup);
  }

  updateGreenSoilPositions() {
    if (!this.roverGroup || !this.greenSoilGroup) return;

    const rx = this.roverGroup.position.x;
    const ry = this.roverGroup.position.y;
    const rz = this.roverGroup.position.z;
    const rot = this.roverGroup.rotation.y;

    const offsets = [
      { x: -1.2, z: 2.2 },
      { x: 0.0,  z: 2.8 },
      { x: 1.2,  z: 2.2 }
    ];

    offsets.forEach((off, idx) => {
      const child = this.greenSoilGroup.children[idx];
      if (!child) return;

      const vec = new THREE.Vector3(off.x, 0, off.z);
      vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);

      const wx = rx + vec.x;
      const wz = rz + vec.z;
      const wy = this.getTerrainHeight(wx, wz) + 0.05;

      child.position.set(wx, wy, wz);
      child.rotation.y = rot;
    });
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    if (mode === 'sampling_arm') {
      this.greenSoilGroup.visible = true;
      this.updateGreenSoilPositions();
    } else {
      this.greenSoilGroup.visible = false;
    }
  }

  animateTestTubeScoop(zoneIndex, soilColorHex = 0xd97441, onComplete = null) {
    if (this.isArmAnimating || !this.armSegment1 || !this.armSegment2) return;
    this.isArmAnimating = true;

    AudioInstance.playArmMotor();

    if (this.testTubeFillMesh) {
      this.testTubeFillMesh.material.color.setHex(soilColorHex);
    }

    const targetChild = this.greenSoilGroup.children[zoneIndex];
    
    gsap.timeline({
      onComplete: () => {
        this.isArmAnimating = false;
        if (onComplete) onComplete();
      }
    })
    .to(this.armSegment1.rotation, { x: Math.PI / 2.2, y: (zoneIndex - 1) * 0.35, duration: 1.0, ease: "power2.out" })
    .to(this.armSegment2.rotation, { x: -Math.PI / 2.6, duration: 0.8, ease: "power2.out" }, "-=0.4")
    .to(this.testTubeGroup.position, { y: -0.25, duration: 0.5, ease: "power1.inOut" })
    .to(this.testTubeFillMesh.scale, { y: 1.0, duration: 0.8, ease: "power2.out", onStart: () => {
      AudioInstance.playScienceBeep();
      if (targetChild) {
        this.emitWheelDust(targetChild.position);
      }
    }}, "-=0.3")
    .to(this.testTubeGroup.position, { y: -0.1, duration: 0.5, ease: "power1.out" })
    .to(this.armSegment2.rotation, { x: 0, duration: 0.8, ease: "power2.inOut" })
    .to(this.armSegment1.rotation, { x: 0, y: 0, duration: 1.0, ease: "power2.inOut" }, "-=0.5");
  }

  buildAirborneDust() {
    const count = 300;
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
    const count = 60;
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
      origin.x + (Math.random() - 0.5) * 0.6,
      origin.y + 0.1,
      origin.z + (Math.random() - 0.5) * 0.6
    );
    posAttr.needsUpdate = true;
  }

  update(delta, time) {
    this.time = time;
    const mission = MarsRoverMissionInstance;

    const rx = mission.roverX;
    const rz = mission.roverZ;
    const ry = this.getTerrainHeight(rx, rz);

    if (this.roverGroup) {
      this.roverGroup.position.set(rx, ry, rz);
      this.roverGroup.rotation.y = mission.roverRotation;

      const speedPct = mission.speed / 6.5;
      this.wheels.forEach(w => {
        w.rotation.x += speedPct * delta * 12.0;
      });

      const steerAngle = (mission.keys.left ? 0.35 : 0) - (mission.keys.right ? 0.35 : 0);
      this.frontSteerPivots.forEach(p => {
        p.rotation.y = steerAngle;
      });

      if (this.cameraMast) {
        this.cameraMast.rotation.y = Math.sin(time * 0.5) * 0.08;
      }

      if (Math.abs(mission.speed) > 0.5) {
        this.emitWheelDust(this.roverGroup.position);
      }
    }

    if (this.cameraMode === 'sampling_arm') {
      this.updateGreenSoilPositions();
      if (this.greenSoilGroup) {
        this.greenSoilGroup.children.forEach(g => {
          const ring = g.children[0];
          if (ring) ring.material.opacity = 0.6 + Math.sin(time * 6) * 0.3;
        });
      }
    }

    this.sampleBeacons.forEach(b => {
      if (b.ring) b.ring.rotation.z = time * 1.5;
      if (b.beam) b.beam.material.opacity = 0.25 + Math.sin(time * 3) * 0.1;
    });

    if (this.dustParticles) {
      const posAttr = this.dustParticles.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let x = posAttr.getX(i);
        let y = posAttr.getY(i);
        let z = posAttr.getZ(i);

        x += delta * 1.8;
        z += delta * 0.8;
        if (x > 130) x = -130;
        if (z > 130) z = -130;

        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }

    if (this.wheelDustParticles) {
      const posAttr = this.wheelDustParticles.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        if (posAttr.getY(i) > -5000) {
          posAttr.setY(i, posAttr.getY(i) + delta * 0.8);
          if (Math.random() < 0.1) posAttr.setY(i, -9999);
        }
      }
      posAttr.needsUpdate = true;
    }

    this.updateCamera(delta);
  }

  updateCamera(delta) {
    if (!this.roverGroup) return;

    CameraInstance.controls.enabled = false;
    this.roverGroup.getWorldPosition(this._tempRoverPos);
    const rot = this.roverGroup.rotation.y;

    if (this.cameraMode === 'viewfinder_sky') {
      const mastOffset = new THREE.Vector3(0, 2.3, 0.8);
      mastOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      this._tempCamPos.copy(this._tempRoverPos).add(mastOffset);

      const lookTargetOffset = new THREE.Vector3(0, 8.0, 15.0);
      lookTargetOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      this._tempCamTarget.copy(this._tempRoverPos).add(lookTargetOffset);
    } 
    else if (this.cameraMode === 'viewfinder_ground') {
      const mastOffset = new THREE.Vector3(0, 2.2, 0.8);
      mastOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      this._tempCamPos.copy(this._tempRoverPos).add(mastOffset);

      const lookTargetOffset = new THREE.Vector3(0, -1.8, 4.5);
      lookTargetOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      this._tempCamTarget.copy(this._tempRoverPos).add(lookTargetOffset);
    } 
    else if (this.cameraMode === 'sampling_arm') {
      const armCamOffset = new THREE.Vector3(0.8, 2.4, 1.2);
      armCamOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      this._tempCamPos.copy(this._tempRoverPos).add(armCamOffset);

      const lookTargetOffset = new THREE.Vector3(0.0, 0.2, 2.5);
      lookTargetOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      this._tempCamTarget.copy(this._tempRoverPos).add(lookTargetOffset);
    } 
    else {
      const camOffset = new THREE.Vector3(0, 3.8, -8.5);
      camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);

      this._tempCamPos.copy(this._tempRoverPos).add(camOffset);
      this._tempCamTarget.copy(this._tempRoverPos).add(new THREE.Vector3(0, 1.4, 0));

      const minCamY = this.getTerrainHeight(this._tempCamPos.x, this._tempCamPos.z) + 1.8;
      if (this._tempCamPos.y < minCamY) {
        this._tempCamPos.y = minCamY;
      }
    }

    CameraInstance.activeCamera.position.lerp(this._tempCamPos, 0.08);
    CameraInstance.controls.target.lerp(this._tempCamTarget, 0.08);
    CameraInstance.activeCamera.lookAt(CameraInstance.controls.target);
  }
}

export const MarsRoverSceneInstance = new MarsRoverScene();
export { MarsRoverScene };

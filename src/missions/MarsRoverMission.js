import { AudioInstance } from '../managers/AudioManager.js';
import { MarsRoverSceneInstance } from '../scene/MarsRoverScene.js';

class MarsRoverMission {
  constructor() {
    this.stage = 'INTRO'; // INTRO, EXPLORING, PAUSED, COMPLETE, FAILED
    
    // Telemetry & Rover State
    this.roverX = 0;
    this.roverZ = 0;
    this.roverRotation = 0; // Radians
    this.speed = 0;
    this.targetSpeed = 0;
    this.steering = 0;
    this.isBoosting = false;
    this.isBraking = false;
    
    this.battery = 100;
    this.elapsedTime = 0;
    this.score = 0;
    this.currentRegion = 'Rocky Plain';
    
    // Climate Sensor Data
    this.temperature = -63; // °C
    this.windSpeed = 18; // km/h
    this.dustLevel = 'MODERATE';
    this.radiation = 0.42; // mSv/h
    this.humidity = 0.03; // %
    this.terrainType = 'Basaltic Regolith';
    
    // Mode States
    this.inViewfinder = false;
    this.viewfinderMode = 'sky'; // 'sky' or 'ground'
    this.inSamplingMode = false;
    
    // Objectives Progress Tracking
    this.skyPhotoCaptured = false;
    this.groundPhotosCount = 0; // Requires 2 photos in water evidence search region
    this.regolithSoilCollected = false;
    this.hydratedSoilCollected = false;
    
    this.exploredRegions = new Set(['Rocky Plain']);
    this.photosCaptured = [];
    this.samplesCollected = [];
    this.climateScans = new Set(['Rocky Plain']);
    this.reachedResearchZone = false;
    this.discoveriesMade = new Set();
    
    // Audio Timers
    this.windAudioTimer = 0;
    this.driveAudioTimer = 0;
    
    // Controls State
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      boost: false,
      brake: false
    };
    
    this.completionTriggered = false;
    
    // Callbacks
    this.onUIUpdate = null;
    this.onNotification = null;
    this.onPhotoCaptured = null;
    this.onSampleCollected = null;
    this.onDiscovery = null;
    this.onMissionComplete = null;
    this.onToggleDataModal = null;
    
    // Sample Zones Configuration
    this.sampleZones = [
      {
        id: 'SAMPLE_SOIL_01',
        type: 'Martian Regolith Soil',
        region: 'Rocky Plain',
        x: 25, z: 25, radius: 15,
        collected: false,
        temp: '-61°C',
        terrain: 'Rocky Soil Bed'
      },
      {
        id: 'SAMPLE_SAND_02',
        type: 'Atmospheric Sky Climate Survey',
        region: 'Sand Dunes',
        x: -55, z: 45, radius: 25,
        collected: false,
        temp: '-66°C',
        terrain: 'Eolian Sand Ridge'
      },
      {
        id: 'SAMPLE_ROCK_03',
        type: 'Hydrated Clay & Water Evidence',
        region: 'Crater Zone',
        x: 55, z: -50, radius: 25,
        collected: false,
        temp: '-59°C',
        terrain: 'Impact Ejecta Rim'
      },
      {
        id: 'SAMPLE_DUST_04',
        type: 'Subsurface Geothermal Clay',
        region: 'Research Zone',
        x: -75, z: -70, radius: 25,
        collected: false,
        temp: '-54°C',
        terrain: 'Geothermal Hydrothermal Layer'
      }
    ];

    // Discovery Locations
    this.discoveryZones = [
      {
        id: 'DISC_DUST_STORM',
        title: 'Dust Storm Trace Detected',
        desc: 'Microscopic atmospheric swirl leaves iron-oxide patterns on sand ridges.',
        x: -40, z: 30, radius: 14
      },
      {
        id: 'DISC_GEOLOGICAL',
        title: 'Unusual Geological Formation',
        desc: 'Stratified sedimentary layers indicate ancient liquid water flow.',
        x: 40, z: -35, radius: 14
      },
      {
        id: 'DISC_RESEARCH_ANOMALY',
        title: 'High-Value Geothermal Subsurface Anomaly',
        desc: 'Thermal core readings indicate localized subsurface heat plume.',
        x: -75, z: -70, radius: 16
      }
    ];
  }

  startMission() {
    this.stage = 'EXPLORING';
    this.roverX = 0;
    this.roverZ = 0;
    this.roverRotation = 0;
    this.speed = 0;
    this.targetSpeed = 0;
    this.steering = 0;
    this.battery = 100;
    this.elapsedTime = 0;
    this.score = 0;
    this.currentRegion = 'Rocky Plain';
    
    this.inViewfinder = false;
    this.viewfinderMode = 'sky';
    this.inSamplingMode = false;
    
    this.skyPhotoCaptured = false;
    this.groundPhotosCount = 0;
    this.regolithSoilCollected = false;
    this.hydratedSoilCollected = false;
    
    this.exploredRegions = new Set(['Rocky Plain']);
    this.photosCaptured = [];
    this.samplesCollected = [];
    this.climateScans = new Set(['Rocky Plain']);
    this.reachedResearchZone = false;
    this.discoveriesMade = new Set();
    this.completionTriggered = false;
    
    this.sampleZones.forEach(s => s.collected = false);

    this.setupKeyListeners();
  }

  setupKeyListeners() {
    if (this._keyHandlerBound) return;
    this._keyHandlerBound = true;

    window.addEventListener('keydown', (e) => {
      if (this.stage !== 'EXPLORING') return;

      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.boost = true;
      if (code === 'Space') this.keys.brake = true;

      // Single action triggers
      if (code === 'KeyP') {
        this.toggleViewfinder();
      }
      if (code === 'KeyE') {
        this.toggleSamplingMode();
      }
      if (code === 'Enter') {
        if (this.inViewfinder) {
          this.captureViewfinderPhoto();
        }
      }
      if (code === 'Escape') {
        this.exitAllModes();
      }
      if (code === 'KeyM') {
        if (this.onToggleDataModal) this.onToggleDataModal();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.boost = false;
      if (code === 'Space') this.keys.brake = false;
    });
  }

  // TOGGLE CAMERA VIEWFINDER (P key)
  toggleViewfinder() {
    if (this.stage !== 'EXPLORING') return;

    if (this.inViewfinder) {
      this.exitAllModes();
      return;
    }

    this.inSamplingMode = false;
    const armOverlay = document.getElementById('mars-arm-prompt');
    if (armOverlay) armOverlay.classList.add('hidden');

    // Determine mode by region
    if (this.currentRegion === 'Sand Dunes') {
      this.viewfinderMode = 'sky';
    } else if (this.currentRegion === 'Research Zone' || this.currentRegion === 'Crater Zone') {
      this.viewfinderMode = 'ground';
    } else {
      this.viewfinderMode = 'sky';
    }

    this.inViewfinder = true;
    MarsRoverSceneInstance.setCameraMode(this.viewfinderMode === 'sky' ? 'viewfinder_sky' : 'viewfinder_ground');

    const overlay = document.getElementById('mars-camera-viewfinder');
    if (overlay) {
      overlay.classList.remove('hidden');
      
      const modeLabel = document.getElementById('viewfinder-mode-label');
      const promptTitle = document.getElementById('viewfinder-prompt-title');
      const promptSub = document.getElementById('viewfinder-prompt-sub');

      if (this.viewfinderMode === 'sky') {
        if (modeLabel) modeLabel.textContent = "MODE: ATMOSPHERIC SKY CLIMATE SURVEY";
        if (promptTitle) promptTitle.textContent = "PRESS [ENTER] TO CAPTURE SKY CLIMATE PHOTO";
        if (promptSub) promptSub.textContent = "Align camera with Martian sky. Press [ENTER] to capture atmospheric survey photo.";
      } else {
        if (modeLabel) modeLabel.textContent = "MODE: GROUND WATER EVIDENCE SEARCH";
        if (promptTitle) promptTitle.textContent = "PRESS [ENTER] TO CAPTURE GROUND STRATA PHOTO";
        if (promptSub) promptSub.textContent = "Inspect sedimentary clay layers for water evidence. Take 2 photos to verify.";
      }
    }

    AudioInstance.playBeep();
  }

  // CAPTURE PHOTO IN VIEWFINDER (ENTER key)
  captureViewfinderPhoto() {
    if (!this.inViewfinder || this.stage !== 'EXPLORING') return;

    AudioInstance.playCameraShutter();

    // Trigger flash animation
    const flash = document.getElementById('mars-camera-flash');
    if (flash) {
      flash.style.opacity = '0.9';
      setTimeout(() => {
        flash.style.opacity = '0';
      }, 200);
    }

    let photoName = "";
    if (this.viewfinderMode === 'sky') {
      this.skyPhotoCaptured = true;
      photoName = "Atmospheric Sky Climate Photo";
      AudioInstance.playScienceBeep();
      if (this.onNotification) this.onNotification("ATMOSPHERIC SKY CLIMATE PHOTO CAPTURED!", "success");
    } else {
      this.groundPhotosCount += 1;
      AudioInstance.playWaterPing();
      photoName = `Water Evidence Ground Strata Photo #${this.groundPhotosCount}`;
      if (this.onNotification) this.onNotification(`WATER EVIDENCE PHOTO #${this.groundPhotosCount} LOGGED!`, "success");
    }

    const photoData = {
      id: `MARS_IMG_0${this.photosCaptured.length + 1}.PNG`,
      title: photoName,
      region: this.currentRegion,
      temp: `${this.temperature}°C`,
      coords: `${this.roverX.toFixed(1)} E, ${this.roverZ.toFixed(1)} N`,
      timestamp: new Date().toLocaleTimeString()
    };

    this.photosCaptured.push(photoData);
    this.score += 2000;

    if (this.onPhotoCaptured) this.onPhotoCaptured(photoData);

    this.exitAllModes();
    this.checkObjectiveProgress();
  }

  // TOGGLE ROBOTIC ARM TEST TUBE SAMPLING (E key)
  toggleSamplingMode() {
    if (this.stage !== 'EXPLORING') return;

    if (this.inSamplingMode) {
      this.exitAllModes();
      return;
    }

    this.inViewfinder = false;
    const vfOverlay = document.getElementById('mars-camera-viewfinder');
    if (vfOverlay) vfOverlay.classList.add('hidden');

    this.inSamplingMode = true;
    MarsRoverSceneInstance.setCameraMode('sampling_arm');

    const armOverlay = document.getElementById('mars-arm-prompt');
    if (armOverlay) armOverlay.classList.remove('hidden');

    AudioInstance.playArmMotor();
  }

  // COLLECT SAMPLE VIA CURSOR CLICK ON 3D GREEN SOIL REGION
  sampleSoilZone(zoneIndex) {
    if (!this.inSamplingMode || this.stage !== 'EXPLORING') return;

    let sampleType = "Martian Regolith Soil";
    let soilColor = 0xd97441;

    if (this.currentRegion === 'Research Zone' || this.currentRegion === 'Crater Zone') {
      sampleType = "Hydrated Subsurface Clay (Water Evidence)";
      soilColor = 0x38bdf8;
      this.hydratedSoilCollected = true;
    } else {
      sampleType = "Basaltic Regolith Soil";
      soilColor = 0xd97441;
      this.regolithSoilCollected = true;
    }

    MarsRoverSceneInstance.animateTestTubeScoop(zoneIndex, soilColor, () => {
      const sampleData = {
        id: `SAMPLE_0${this.samplesCollected.length + 1}`,
        type: sampleType,
        region: this.currentRegion,
        temp: `${this.temperature}°C`,
        coords: `${this.roverX.toFixed(1)} E, ${this.roverZ.toFixed(1)} N`
      };

      this.samplesCollected.push(sampleData);
      this.score += 2500;

      AudioInstance.playScienceBeep();
      if (this.onSampleCollected) this.onSampleCollected(sampleData);
      if (this.onNotification) this.onNotification(`TEST TUBE SAMPLE COLLECTED: ${sampleType}`, "success");

      this.exitAllModes();
      this.checkObjectiveProgress();
    });
  }

  exitAllModes() {
    this.inViewfinder = false;
    this.inSamplingMode = false;

    MarsRoverSceneInstance.setCameraMode('follow');

    const vfOverlay = document.getElementById('mars-camera-viewfinder');
    if (vfOverlay) vfOverlay.classList.add('hidden');

    const armOverlay = document.getElementById('mars-arm-prompt');
    if (armOverlay) armOverlay.classList.add('hidden');
  }

  update(delta) {
    if (this.stage !== 'EXPLORING') return;

    this.elapsedTime += delta;

    // 1. Driving Physics (Disabled while in Viewfinder or Sampling Arm mode)
    if (!this.inViewfinder && !this.inSamplingMode) {
      const accel = 8.0;
      const decel = 10.0;
      const topSpeed = this.keys.boost ? 11.0 : 6.5;

      let moveDir = 0;
      if (this.keys.forward) moveDir += 1;
      if (this.keys.backward) moveDir -= 1;

      if (this.keys.brake) {
        this.speed = Math.max(0, this.speed - decel * 1.5 * delta);
      } else if (moveDir !== 0) {
        this.targetSpeed = moveDir * topSpeed;
        if (this.speed < this.targetSpeed) {
          this.speed = Math.min(this.targetSpeed, this.speed + accel * delta);
        } else {
          this.speed = Math.max(this.targetSpeed, this.speed - accel * delta);
        }
      } else {
        if (this.speed > 0) {
          this.speed = Math.max(0, this.speed - decel * delta);
        } else if (this.speed < 0) {
          this.speed = Math.min(0, this.speed + decel * delta);
        }
      }

      // Steering
      const turnSpeed = 1.8;
      if (this.keys.left) {
        this.roverRotation += turnSpeed * delta * (this.speed >= 0 ? 1 : -1);
      }
      if (this.keys.right) {
        this.roverRotation -= turnSpeed * delta * (this.speed >= 0 ? 1 : -1);
      }

      // Position Translation
      const moveDist = this.speed * delta;
      this.roverX += Math.sin(this.roverRotation) * moveDist;
      this.roverZ += Math.cos(this.roverRotation) * moveDist;

      this.roverX = Math.max(-110, Math.min(110, this.roverX));
      this.roverZ = Math.max(-110, Math.min(110, this.roverZ));

      // Audio engine pitch
      if (Math.abs(this.speed) > 0.5) {
        this.driveAudioTimer += delta;
        if (this.driveAudioTimer > 0.8) {
          this.driveAudioTimer = 0;
          AudioInstance.playRoverDrive();
        }
      }
    } else {
      this.speed = 0;
    }

    // 2. Wind Gust Audio
    this.windAudioTimer += delta;
    if (this.windAudioTimer > 14.0) {
      this.windAudioTimer = 0;
      AudioInstance.playWindGust();
    }

    // 3. Region Detection & Climate Updates
    this.updateCurrentRegion();

    // 4. Discoveries Check
    this.checkDiscoveries();

    // 5. Battery Simulation
    this.battery = Math.min(100, Math.max(65, 87 + Math.sin(this.elapsedTime * 0.1) * 6));

    if (this.onUIUpdate) {
      this.onUIUpdate();
    }
  }

  updateCurrentRegion() {
    const rx = this.roverX;
    const rz = this.roverZ;

    let region = 'Rocky Plain';
    if (rx < -30 && rz > 20) {
      region = 'Sand Dunes';
    } else if (rx > 30 && rz < -20) {
      region = 'Crater Zone';
    } else if (rx < -40 && rz < -40) {
      region = 'Research Zone';
    }

    if (this.currentRegion !== region) {
      this.currentRegion = region;
      this.exploredRegions.add(region);
      this.climateScans.add(region);
      
      if (region === 'Sand Dunes') {
        this.temperature = -66;
        this.windSpeed = 26;
        this.dustLevel = 'HIGH';
        this.terrainType = 'Iron-Oxide Dunes';
      } else if (region === 'Crater Zone') {
        this.temperature = -59;
        this.windSpeed = 14;
        this.dustLevel = 'LOW';
        this.terrainType = 'Crater Impact Breccia';
      } else if (region === 'Research Zone') {
        this.temperature = -54;
        this.windSpeed = 22;
        this.dustLevel = 'MODERATE';
        this.terrainType = 'Hydrothermal Layer';
        this.reachedResearchZone = true;
      } else {
        this.temperature = -63;
        this.windSpeed = 18;
        this.dustLevel = 'MODERATE';
        this.terrainType = 'Basaltic Regolith';
      }

      AudioInstance.playScienceBeep();
      if (this.onNotification) {
        this.onNotification(`ENTERED REGION: ${region.toUpperCase()} — CLIMATE SCAN COMPLETE`, "info");
      }
      this.checkObjectiveProgress();
    }
  }

  checkDiscoveries() {
    this.discoveryZones.forEach(dz => {
      if (this.discoveriesMade.has(dz.id)) return;

      const dx = this.roverX - dz.x;
      const dzDist = this.roverZ - dz.z;
      const dist = Math.sqrt(dx * dx + dzDist * dzDist);

      if (dist <= dz.radius) {
        this.discoveriesMade.add(dz.id);
        this.score += 3000;
        AudioInstance.playLevelComplete();

        if (this.onDiscovery) {
          this.onDiscovery(dz);
        }
        if (this.onNotification) {
          this.onNotification(`NEW DISCOVERY: ${dz.title.toUpperCase()}`, "success");
        }
        this.checkObjectiveProgress();
      }
    });
  }

  checkObjectiveProgress() {
    const skyDone = this.skyPhotoCaptured || this.photosCaptured.length >= 1;
    const regolithDone = this.regolithSoilCollected || this.samplesCollected.length >= 1;
    const waterPhotosDone = this.groundPhotosCount >= 2;
    const hydratedSoilDone = this.hydratedSoilCollected || this.samplesCollected.length >= 2;

    if (skyDone && regolithDone && waterPhotosDone && hydratedSoilDone && !this.completionTriggered) {
      this.completeMissionNow();
    }
  }

  completeMissionNow() {
    if (this.completionTriggered) return;
    this.completionTriggered = true;
    this.stage = 'COMPLETE';
    this.speed = 0;
    this.exitAllModes();
    AudioInstance.playLevelComplete();
    
    if (this.onMissionComplete) {
      this.onMissionComplete();
    }
  }

  get currentObjective() {
    if (!this.skyPhotoCaptured) return `Region 1 [Sand Dunes]: Open Sky Camera with [P] & press [ENTER] to capture climate photo`;
    if (!this.regolithSoilCollected) return `Region 2 [Rocky Plain]: Deploy Robotic Arm with [E] & click green soil zone to sample regolith`;
    if (this.groundPhotosCount < 2) return `Region 3 [Water Search]: Open Ground Camera with [P] & capture 2 water strata photos (${this.groundPhotosCount}/2)`;
    if (!this.hydratedSoilCollected) return `Region 3 [Water Search]: Deploy Robotic Arm with [E] & scoop hydrated clay soil sample`;
    return `All Mars scientific objectives complete! Concluding expedition...`;
  }

  get progress() {
    let done = 0;
    if (this.skyPhotoCaptured) done += 25;
    if (this.regolithSoilCollected) done += 25;
    if (this.groundPhotosCount >= 2) done += 25;
    else done += (this.groundPhotosCount / 2) * 25;
    if (this.hydratedSoilCollected) done += 25;
    return Math.min(100, Math.floor(done));
  }

  get telemetry() {
    return {
      temp: this.temperature,
      wind: this.windSpeed,
      dust: this.dustLevel,
      battery: this.battery,
      radiation: this.radiation
    };
  }

  get roverPos() {
    return { x: this.roverX, z: this.roverZ };
  }

  get roverSpeed() {
    return this.speed;
  }

  get roverAngle() {
    return this.roverRotation;
  }

  get photos() {
    return this.photosCaptured;
  }

  get samples() {
    return this.samplesCollected;
  }

  get scannedRegions() {
    return this.climateScans;
  }

  get discoveredRegions() {
    return this.exploredRegions;
  }

  get samplePoints() {
    return this.sampleZones;
  }
}

export const MarsRoverMissionInstance = new MarsRoverMission();
export { MarsRoverMission };

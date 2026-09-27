import { AudioInstance } from '../managers/AudioManager.js';
import { MarsRoverSceneInstance } from '../scene/MarsRoverScene.js';

class MarsRoverMission {
  constructor() {
    this.stage = 'INTRO'; // INTRO, EXPLORING, PAUSED, COMPLETE, FAILED
    this.playerCount = 1;
    this.isPaused = false;

    // Independent player states
    this.players = {
      1: this.createPlayerState(1, 0, 0),
      2: this.createPlayerState(2, 8, -6)
    };

    this.completionTriggered = false;
    this.winnerPlayerNumber = null;

    // Climate sensor shared environment
    this.temperature = -63; // °C
    this.windSpeed = 18; // km/h
    this.dustLevel = 'MODERATE';
    this.radiation = 0.42; // mSv/h
    this.elapsedTime = 0;

    // Audio Timers
    this.windAudioTimer = 0;
    this.driveAudioTimer = 0;

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
        collectedBy: new Set(),
        temp: '-61°C',
        terrain: 'Rocky Soil Bed'
      },
      {
        id: 'SAMPLE_SAND_02',
        type: 'Atmospheric Sky Climate Survey',
        region: 'Sand Dunes',
        x: -55, z: 45, radius: 25,
        collectedBy: new Set(),
        temp: '-66°C',
        terrain: 'Eolian Sand Ridge'
      },
      {
        id: 'SAMPLE_ROCK_03',
        type: 'Hydrated Clay & Water Evidence',
        region: 'Crater Zone',
        x: 55, z: -50, radius: 25,
        collectedBy: new Set(),
        temp: '-59°C',
        terrain: 'Impact Ejecta Rim'
      },
      {
        id: 'SAMPLE_DUST_04',
        type: 'Subsurface Geothermal Clay',
        region: 'Research Zone',
        x: -75, z: -70, radius: 25,
        collectedBy: new Set(),
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
        x: -40, z: 30, radius: 14,
        foundBy: new Set()
      },
      {
        id: 'DISC_GEOLOGICAL',
        title: 'Unusual Geological Formation',
        desc: 'Stratified sedimentary layers indicate ancient liquid water flow.',
        x: 40, z: -35, radius: 14,
        foundBy: new Set()
      },
      {
        id: 'DISC_RESEARCH_ANOMALY',
        title: 'High-Value Geothermal Subsurface Anomaly',
        desc: 'Thermal core readings indicate localized subsurface heat plume.',
        x: -75, z: -70, radius: 16,
        foundBy: new Set()
      }
    ];
  }

  createPlayerState(num, initX, initZ) {
    return {
      num,
      name: `PLAYER ${num}`,
      roverX: initX,
      roverZ: initZ,
      roverRotation: 0,
      speed: 0,
      targetSpeed: 0,
      steering: 0,
      isBoosting: false,
      isBraking: false,
      battery: 100,
      score: 0,
      rank: num,
      currentRegion: 'Rocky Plain',

      // Mode states
      inViewfinder: false,
      viewfinderMode: 'sky',
      inSamplingMode: false,
      isCapturing: false,

      // Objectives progress
      skyPhotoCaptured: false,
      groundPhotosCount: 0,
      regolithSoilCollected: false,
      hydratedSoilCollected: false,
      completed: false,
      won: false,

      exploredRegions: new Set(['Rocky Plain']),
      photosCaptured: [],
      samplesCollected: [],
      climateScans: new Set(['Rocky Plain']),

      keys: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        boost: false,
        brake: false
      }
    };
  }

  setMultiplayerPlayers(playerList) {
    if (!playerList || playerList.length === 0) {
      this.playerCount = 1;
      return;
    }

    this.playerCount = playerList.length >= 2 ? 2 : 1;

    playerList.forEach(p => {
      const target = this.players[p.playerNumber];
      if (target) {
        target.name = p.name;
        target.score = p.score || target.score;
        target.rank = p.rank || target.rank;
      }
    });

    console.log(`[MarsRoverMission] Configured for ${this.playerCount} player(s). Split-screen: ${this.isSplitScreen}`);
  }

  get isSplitScreen() {
    return this.playerCount >= 2;
  }

  startMission() {
    this.stage = 'EXPLORING';
    this.elapsedTime = 0;
    this.isPaused = false;
    this.completionTriggered = false;
    this.winnerPlayerNumber = null;

    // Reset player 1
    this.players[1] = this.createPlayerState(1, 0, 0);
    // Reset player 2
    this.players[2] = this.createPlayerState(2, 8, -6);

    // Reset sample zones
    this.sampleZones.forEach(z => z.collectedBy = new Set());
    this.discoveryZones.forEach(d => d.foundBy = new Set());

    this.setupKeyListeners();
  }

  setupKeyListeners() {
    if (this._keyHandlerBound) return;
    this._keyHandlerBound = true;

    // Desktop keyboard acts as controller for Player 1 fallback
    window.addEventListener('keydown', (e) => {
      if (this.stage !== 'EXPLORING') return;
      const p1 = this.players[1];

      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') p1.keys.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') p1.keys.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') p1.keys.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') p1.keys.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        if (!p1.keys.boost) AudioInstance.playBoostSound();
        p1.keys.boost = true;
      }
      if (code === 'Space') {
        if (!p1.keys.brake) AudioInstance.playBrakeSound();
        p1.keys.brake = true;
      }

      // Single action triggers
      if (code === 'KeyP') {
        this.handleRemotePhotoMode(1);
      }
      if (code === 'KeyE') {
        this.handleRemoteSampleMode(1);
      }
      if (code === 'KeyC') {
        if (!p1.inSamplingMode) {
          this.handleRemoteSampleMode(1);
        } else {
          this.handleRemoteCollectSample(1);
        }
      }
      if (code === 'Enter') {
        if (p1.inViewfinder) {
          this.handleRemoteCapturePhoto(1);
        } else if (p1.inSamplingMode) {
          this.handleRemoteCollectSample(1);
        }
      }
      if (code === 'Escape') {
        if (p1.inViewfinder || p1.inSamplingMode) {
          this.handleRemoteExitModes(1);
        } else if (this.onTogglePause) {
          this.onTogglePause();
        }
      }
      if (code === 'KeyM') {
        if (this.onToggleDataModal) this.onToggleDataModal();
      }
    });

    window.addEventListener('keyup', (e) => {
      const p1 = this.players[1];
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') p1.keys.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') p1.keys.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') p1.keys.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') p1.keys.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') p1.keys.boost = false;
      if (code === 'Space') p1.keys.brake = false;
    });
  }

  // =========================================================
  // REMOTE PHONE CONTROLLER DISPATCHERS
  // =========================================================
  handleRemoteMove(playerNum, direction, active) {
    const p = this.players[playerNum];
    if (!p || this.stage !== 'EXPLORING') return;

    if (direction === 'up') p.keys.forward = active;
    if (direction === 'down') p.keys.backward = active;
    if (direction === 'left') p.keys.left = active;
    if (direction === 'right') p.keys.right = active;
    if (direction === 'boost') p.keys.boost = active;
    if (direction === 'brake') p.keys.brake = active;
  }

  handleRemotePhotoMode(playerNum) {
    const p = this.players[playerNum];
    if (!p || this.stage !== 'EXPLORING') return;

    if (p.inViewfinder) {
      this.handleRemoteExitModes(playerNum);
      return;
    }

    p.inSamplingMode = false;
    p.inViewfinder = true;

    // Determine mode by region
    if (p.currentRegion === 'Sand Dunes') {
      p.viewfinderMode = 'sky';
    } else if (p.currentRegion === 'Research Zone' || p.currentRegion === 'Crater Zone') {
      p.viewfinderMode = 'ground';
    } else {
      p.viewfinderMode = 'sky';
    }

    AudioInstance.playViewfinderOpen();
    AudioInstance.playBeep();

    if (this.onUIUpdate) this.onUIUpdate();
  }

  handleRemoteSampleMode(playerNum) {
    const p = this.players[playerNum];
    if (!p || this.stage !== 'EXPLORING') return;

    if (p.inSamplingMode) {
      this.handleRemoteExitModes(playerNum);
      return;
    }

    // Proximity check
    const nearbyZone = this.sampleZones.find(z => {
      if (z.collectedBy.has(playerNum)) return false;
      const dx = p.roverX - z.x;
      const dz = p.roverZ - z.z;
      return Math.sqrt(dx * dx + dz * dz) <= z.radius + 15.0;
    });

    if (!nearbyZone) {
      if (this.onNotification) {
        this.onNotification(`P${playerNum}: NO SAMPLE IN RANGE. DRIVE CLOSER TO BEACON.`, 'info');
      }
      return;
    }

    p.inViewfinder = false;
    p.inSamplingMode = true;
    AudioInstance.playArmMotor();

    if (this.onUIUpdate) this.onUIUpdate();
  }

  handleRemoteCapturePhoto(playerNum) {
    const p = this.players[playerNum];
    if (!p || !p.inViewfinder || p.isCapturing) return;

    p.isCapturing = true;
    AudioInstance.playCameraShutter();

    let photoName = "";
    if (p.viewfinderMode === 'sky') {
      p.skyPhotoCaptured = true;
      photoName = "Atmospheric Sky Climate Photo";
      if (this.onNotification) this.onNotification(`P${playerNum}: ATMOSPHERIC SKY PHOTO LOGGED!`, "success");
    } else {
      p.groundPhotosCount += 1;
      photoName = `Water Evidence Ground Strata Photo #${p.groundPhotosCount}`;
      if (this.onNotification) this.onNotification(`P${playerNum}: WATER STRATA PHOTO #${p.groundPhotosCount} LOGGED!`, "success");
    }

    const photoData = {
      id: `MARS_IMG_P${playerNum}_0${p.photosCaptured.length + 1}.PNG`,
      title: photoName,
      region: p.currentRegion,
      temp: `${this.temperature}°C`,
      coords: `${p.roverX.toFixed(1)} E, ${p.roverZ.toFixed(1)} N`,
      timestamp: new Date().toLocaleTimeString(),
      playerNumber: playerNum
    };

    p.photosCaptured.push(photoData);
    p.score += 2000;
    this.updateRankings();

    if (this.onPhotoCaptured) this.onPhotoCaptured(photoData, playerNum);

    setTimeout(() => {
      AudioInstance[p.viewfinderMode === 'sky' ? 'playScienceBeep' : 'playWaterPing']();
    }, 180);

    setTimeout(() => {
      p.isCapturing = false;
      p.inViewfinder = false;
      this.checkPlayerObjectiveProgress(playerNum);
      if (this.onUIUpdate) this.onUIUpdate();
    }, 700);
  }

  handleRemoteCollectSample(playerNum) {
    const p = this.players[playerNum];
    if (!p || !p.inSamplingMode || p.isCapturing) return;

    // Find nearby sample zone
    const nearbyZone = this.sampleZones.find(z => {
      if (z.collectedBy.has(playerNum)) return false;
      const dx = p.roverX - z.x;
      const dz = p.roverZ - z.z;
      return Math.sqrt(dx * dx + dz * dz) <= z.radius + 15.0;
    });

    if (!nearbyZone) {
      if (this.onNotification) this.onNotification(`P${playerNum}: NO SAMPLE IN RANGE`, "info");
      return;
    }

    p.isCapturing = true;
    nearbyZone.collectedBy.add(playerNum);

    let sampleType = "Martian Regolith Soil";
    let soilColor = 0xd97441;

    if (p.currentRegion === 'Research Zone' || p.currentRegion === 'Crater Zone') {
      sampleType = "Hydrated Subsurface Clay (Water Evidence)";
      soilColor = 0x38bdf8;
      p.hydratedSoilCollected = true;
    } else {
      sampleType = "Basaltic Regolith Soil";
      soilColor = 0xd97441;
      p.regolithSoilCollected = true;
    }

    MarsRoverSceneInstance.animateTestTubeScoop(playerNum, soilColor, () => {
      const sampleData = {
        id: `SAMPLE_P${playerNum}_0${p.samplesCollected.length + 1}`,
        type: sampleType,
        region: p.currentRegion,
        temp: `${this.temperature}°C`,
        coords: `${p.roverX.toFixed(1)} E, ${p.roverZ.toFixed(1)} N`,
        playerNumber: playerNum
      };

      p.samplesCollected.push(sampleData);
      p.score += 2500;
      this.updateRankings();

      AudioInstance.playScienceBeep();
      if (this.onSampleCollected) this.onSampleCollected(sampleData, playerNum);
      if (this.onNotification) this.onNotification(`P${playerNum}: SAMPLE COLLECTED: ${sampleType}`, "success");

      p.isCapturing = false;
      p.inSamplingMode = false;
      this.checkPlayerObjectiveProgress(playerNum);
      if (this.onUIUpdate) this.onUIUpdate();
    });
  }

  handleRemoteExitModes(playerNum) {
    const p = this.players[playerNum];
    if (!p) return;
    p.inViewfinder = false;
    p.inSamplingMode = false;
    if (this.onUIUpdate) this.onUIUpdate();
  }

  updateRankings() {
    if (this.players[2].score > this.players[1].score) {
      this.players[2].rank = 1;
      this.players[1].rank = 2;
    } else {
      this.players[1].rank = 1;
      this.players[2].rank = 2;
    }
  }

  setPaused(val) {
    this.isPaused = !!val;
    console.log(`[MarsRoverMission] Simulation paused: ${this.isPaused}`);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    console.log(`[MarsRoverMission] Simulation paused: ${this.isPaused}`);
    return this.isPaused;
  }

  // =========================================================
  // SIMULATION TICK (UPDATES BOTH ROVERS & CAMERAS)
  // =========================================================
  update(delta) {
    if (this.stage !== 'EXPLORING' || this.isPaused) return;
    this.elapsedTime += delta;

    // Update active players
    const activeCount = this.isSplitScreen ? 2 : 1;
    for (let i = 1; i <= activeCount; i++) {
      this.updatePlayerRover(i, delta);
    }

    // Environmental Wind
    this.windAudioTimer += delta;
    if (this.windAudioTimer > 14.0) {
      this.windAudioTimer = 0;
      AudioInstance.playWindGust();
    }

    if (this.onUIUpdate) {
      this.onUIUpdate();
    }
  }

  updatePlayerRover(playerNum, delta) {
    const p = this.players[playerNum];
    if (!p || p.completed) return;

    if (!p.inViewfinder && !p.inSamplingMode) {
      const accel = 8.0;
      const decel = 10.0;
      const topSpeed = p.keys.boost ? 11.0 : 6.5;

      let moveDir = 0;
      if (p.keys.forward) moveDir += 1;
      if (p.keys.backward) moveDir -= 1;

      if (p.keys.brake) {
        p.speed = Math.max(0, p.speed - decel * 1.5 * delta);
      } else if (moveDir !== 0) {
        p.targetSpeed = moveDir * topSpeed;
        if (p.speed < p.targetSpeed) {
          p.speed = Math.min(p.targetSpeed, p.speed + accel * delta);
        } else {
          p.speed = Math.max(p.targetSpeed, p.speed - accel * delta);
        }
      } else {
        if (p.speed > 0) {
          p.speed = Math.max(0, p.speed - decel * delta);
        } else if (p.speed < 0) {
          p.speed = Math.min(0, p.speed + decel * delta);
        }
      }

      // Steering
      const turnSpeed = 1.8;
      if (p.keys.left) {
        p.roverRotation += turnSpeed * delta * (p.speed >= 0 ? 1 : -1);
      }
      if (p.keys.right) {
        p.roverRotation -= turnSpeed * delta * (p.speed >= 0 ? 1 : -1);
      }

      // Position translation
      const moveDist = p.speed * delta;
      const nextX = p.roverX + Math.sin(p.roverRotation) * moveDist;
      const nextZ = p.roverZ + Math.cos(p.roverRotation) * moveDist;

      const blockedDiagonal = MarsRoverSceneInstance.checkRockCollision(nextX, nextZ);
      const blockedX = blockedDiagonal && MarsRoverSceneInstance.checkRockCollision(nextX, p.roverZ);
      const blockedZ = blockedDiagonal && MarsRoverSceneInstance.checkRockCollision(p.roverX, nextZ);

      if (!blockedDiagonal) {
        p.roverX = nextX;
        p.roverZ = nextZ;
      } else {
        if (!blockedX) p.roverX = nextX;
        if (!blockedZ) p.roverZ = nextZ;
        if (blockedX && blockedZ) p.speed *= 0.3;
      }

      p.roverX = Math.max(-110, Math.min(110, p.roverX));
      p.roverZ = Math.max(-110, Math.min(110, p.roverZ));

      if (playerNum === 1 && Math.abs(p.speed) > 0.5) {
        this.driveAudioTimer += delta;
        if (this.driveAudioTimer > 0.8) {
          this.driveAudioTimer = 0;
          AudioInstance.playRoverDrive();
        }
      }
    } else {
      p.speed = 0;
    }

    this.updatePlayerRegion(playerNum);
    this.checkPlayerDiscoveries(playerNum);

    // Battery simulation
    p.battery = Math.min(100, Math.max(65, 87 + Math.sin((this.elapsedTime + playerNum * 5) * 0.1) * 6));
  }

  updatePlayerRegion(playerNum) {
    const p = this.players[playerNum];
    const rx = p.roverX;
    const rz = p.roverZ;

    let region = 'Rocky Plain';
    if (rx < -30 && rz > 20) {
      region = 'Sand Dunes';
    } else if (rx > 30 && rz < -20) {
      region = 'Crater Zone';
    } else if (rx < -40 && rz < -40) {
      region = 'Research Zone';
    }

    if (p.currentRegion !== region) {
      p.currentRegion = region;
      p.exploredRegions.add(region);
      p.climateScans.add(region);

      if (this.onNotification) {
        this.onNotification(`P${playerNum} ENTERED: ${region.toUpperCase()}`, "info");
      }
    }
  }

  checkPlayerDiscoveries(playerNum) {
    const p = this.players[playerNum];
    this.discoveryZones.forEach(dz => {
      if (dz.foundBy.has(playerNum)) return;

      const dx = p.roverX - dz.x;
      const dzDist = p.roverZ - dz.z;
      const dist = Math.sqrt(dx * dx + dzDist * dzDist);

      if (dist <= dz.radius) {
        dz.foundBy.add(playerNum);
        p.score += 3000;
        this.updateRankings();
        AudioInstance.playDiscoveryFanfare();

        if (this.onDiscovery) {
          this.onDiscovery(dz, playerNum);
        }
        if (this.onNotification) {
          this.onNotification(`P${playerNum} DISCOVERY: ${dz.title.toUpperCase()}`, "success");
        }
        this.checkPlayerObjectiveProgress(playerNum);
      }
    });
  }

  checkPlayerObjectiveProgress(playerNum) {
    const p = this.players[playerNum];
    const skyDone = p.skyPhotoCaptured;
    const regolithDone = p.regolithSoilCollected;
    const waterPhotosDone = p.groundPhotosCount >= 2;
    const hydratedSoilDone = p.hydratedSoilCollected;

    if (skyDone && regolithDone && waterPhotosDone && hydratedSoilDone && !p.completed) {
      p.completed = true;
      p.speed = 0;

      if (!this.winnerPlayerNumber) {
        // First player to finish WINS!
        this.winnerPlayerNumber = playerNum;
        p.won = true;
        AudioInstance.playLevelComplete();

        // If 2-player race, mark other player as lost
        const otherP = this.players[playerNum === 1 ? 2 : 1];
        if (otherP) otherP.won = false;
      }

      if (this.onMissionComplete) {
        this.onMissionComplete(playerNum, this.winnerPlayerNumber);
      }
    }
  }

  getPlayerProgress(num) {
    const p = this.players[num];
    if (!p) return 0;
    let done = 0;
    if (p.skyPhotoCaptured) done += 25;
    if (p.regolithSoilCollected) done += 25;
    if (p.groundPhotosCount >= 2) done += 25;
    else done += (p.groundPhotosCount / 2) * 25;
    if (p.hydratedSoilCollected) done += 25;
    return Math.min(100, Math.floor(done));
  }

  getPlayerObjective(num) {
    const p = this.players[num];
    if (!p) return "";
    if (!p.skyPhotoCaptured) return `Sand Dunes: Open Sky Camera [A] & capture photo [C]`;
    if (!p.regolithSoilCollected) return `Rocky Plain: Deploy Arm [B] & collect regolith [C]`;
    if (p.groundPhotosCount < 2) return `Water Search: Open Ground Camera [A] & take 2 water photos (${p.groundPhotosCount}/2)`;
    if (!p.hydratedSoilCollected) return `Crater Zone: Deploy Arm [B] & scoop hydrated clay [C]`;
    return `Scientific objectives complete! Returning to outpost...`;
  }

  // Backwards-compatible Player 1 telemetry getters
  get roverX() { return this.players[1].roverX; }
  get roverZ() { return this.players[1].roverZ; }
  get roverRotation() { return this.players[1].roverRotation; }
  get speed() { return this.players[1].speed; }
  get score() { return this.players[1].score; }
  get currentRegion() { return this.players[1].currentRegion; }
  get battery() { return this.players[1].battery; }
  get currentObjective() { return this.getPlayerObjective(1); }
  get progress() { return this.getPlayerProgress(1); }
  get photos() { return this.players[1].photosCaptured; }
  get samples() { return this.players[1].samplesCollected; }
  get scannedRegions() { return this.players[1].climateScans; }
  get discoveredRegions() { return this.players[1].exploredRegions; }
  get samplePoints() { return this.sampleZones; }
  get roverSpeed() { return this.players[1].speed; }
  get roverAngle() { return this.players[1].roverRotation; }
  get roverPos() { return { x: this.players[1].roverX, z: this.players[1].roverZ }; }
  get telemetry() {
    return {
      temp: this.temperature,
      wind: this.windSpeed,
      dust: this.dustLevel,
      battery: this.players[1].battery,
      radiation: this.radiation
    };
  }
}

export const MarsRoverMissionInstance = new MarsRoverMission();
export { MarsRoverMission };

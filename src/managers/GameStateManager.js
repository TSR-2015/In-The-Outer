import * as THREE from 'three';
import gsap from 'gsap';
import { EngineInstance } from '../core/Engine.js';
import { CameraInstance } from '../camera/CameraManager.js';
import { SolarSystemInstance } from '../scene/SolarSystem.js';
import { AssetInstance } from './AssetLoader.js';
import { AudioInstance } from './AudioManager.js';
import { MissionInstance } from '../missions/MissionManager.js';
import { SatellitesList } from '../data/SatelliteData.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// New Imports
import { ProgressInstance } from './ProgressManager.js';
import { EarthToMoonMissionInstance } from '../missions/EarthToMoonMission.js';
import { EarthToMoonSceneInstance } from '../scene/EarthToMoonScene.js';
import { MarsRoverMissionInstance } from '../missions/MarsRoverMission.js';
import { MarsRoverSceneInstance } from '../scene/MarsRoverScene.js';

class GameStateManager {
  constructor() {
    this.currentState = 'LOADING'; // LOADING, MENU, PROGRESS, SELECT, ORBIT, EARTH_TO_MOON, MARS_ROVER, COMPLETE
    this.selectedSatelliteIndex = -1;
    this.lastCompletedMission = 1;
    this.orbitSatelliteMesh = null;
    this.selectedSatData = null;
    this.menuSatRef = null;
    this.menuSatRadius = 36.0;
    this.menuSatSpeed = 0.9;
  }

  init() {
    EngineInstance.registerUpdateCallback(this.update.bind(this));
    this.changeState('LOADING');

    AssetInstance.loadAssets(
      (pct, status) => {
        document.getElementById('loading-progress-bar').style.width = `${pct}%`;
        document.getElementById('loading-percent').textContent = `${pct}%`;
        document.getElementById('loading-status').textContent = status;
      },
      () => {
        this.changeState('MENU');
      }
    );
  }

  changeState(newState) {
    this.currentState = newState;
    console.log(`[State Transition]: ${newState}`);

    const screens = document.querySelectorAll('.ui-screen');
    screens.forEach(screen => screen.classList.remove('active'));

    // Toggle HUD visibility
    const emHud = document.getElementById('earth-moon-hud');
    if (emHud) {
      if (newState === 'EARTH_TO_MOON') {
        emHud.classList.remove('hidden');
      } else {
        emHud.classList.add('hidden');
      }
    }

    const marsHud = document.getElementById('mars-hud');
    if (marsHud) {
      if (newState === 'MARS_ROVER') {
        marsHud.classList.remove('hidden');
      } else {
        marsHud.classList.add('hidden');
      }
    }

    this.cleanupStateScene();

    switch (newState) {
      case 'LOADING':
        document.getElementById('loading-screen').classList.add('active');
        break;

      case 'MENU':
        document.getElementById('main-menu').classList.add('active');
        AudioInstance.startAmbientHum();
        this.setupMenuScene();
        break;

      case 'PROGRESS':
        document.getElementById('mission-progress-screen').classList.add('active');
        this.setupMenuScene(); // background orbit scene
        break;

      case 'SELECT':
        document.getElementById('satellite-selection').classList.add('active');
        this.setupMenuScene(); // Keep background scene running
        break;

      case 'ORBIT':
        document.getElementById('mission-dashboard').classList.add('active');
        this.setupOrbitScene();
        break;

      case 'EARTH_TO_MOON':
        this.setupEarthToMoonScene();
        break;

      case 'MARS_ROVER':
        this.setupMarsRoverScene();
        break;

      case 'COMPLETE':
        document.getElementById('mission-complete-screen').classList.add('active');
        this.setupCompleteScene();
        break;
    }

    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  cleanupStateScene() {
    const removeList = [];
    EngineInstance.scene.traverse((obj) => {
      if (obj.name === "menu_elements" || obj.name === "orbit_elements") {
        removeList.push(obj);
      }
    });
    removeList.forEach(obj => EngineInstance.scene.remove(obj));
    this.orbitSatelliteMesh = null;
    this.menuSatRef = null;
  }

  setupMenuScene() {
    let existingMenu = null;
    EngineInstance.scene.traverse((obj) => {
      if (obj.name === "menu_elements") {
        existingMenu = obj;
      }
    });

    if (existingMenu) {
      return;
    }

    const menuGroup = new THREE.Group();
    menuGroup.name = "menu_elements";

    SolarSystemInstance.init(menuGroup);

    const satIndex = this.selectedSatelliteIndex >= 0 ? this.selectedSatelliteIndex : 0;
    const satData = SatellitesList[satIndex];
    
    const sat = AssetInstance.getSatelliteModel(satIndex);
    sat.scale.set(0.4, 0.4, 0.4);
    sat.position.set(satData.orbitRadius, 0, 0);
    menuGroup.add(sat);
    
    this.menuSatRef = sat;
    this.menuSatRadius = satData.orbitRadius;
    this.menuSatSpeed = satData.orbitSpeed;

    EngineInstance.scene.add(menuGroup);

    CameraInstance.cameraPosition.set(0, 45, 120);
    CameraInstance.cameraTarget.set(0, 0, 0);
    CameraInstance.activeCamera.position.copy(CameraInstance.cameraPosition);
    CameraInstance.controls.target.copy(CameraInstance.cameraTarget);
    CameraInstance.setMode('cinematic');
  }

  updateSelectedSatellite(index) {
    this.selectedSatelliteIndex = index;
    const satData = SatellitesList[index];

    let menuGroup = null;
    EngineInstance.scene.traverse((obj) => {
      if (obj.name === "menu_elements") {
        menuGroup = obj;
      }
    });

    if (menuGroup) {
      if (this.menuSatRef) {
        menuGroup.remove(this.menuSatRef);
      }

      const newSat = AssetInstance.getSatelliteModel(index);
      newSat.scale.set(0.4, 0.4, 0.4);
      newSat.position.set(satData.orbitRadius, 0, 0);
      menuGroup.add(newSat);

      this.menuSatRef = newSat;
      this.menuSatRadius = satData.orbitRadius;
      this.menuSatSpeed = satData.orbitSpeed;

      console.log(`[3D Preview]: Replaced satellite with index ${index}. Previous model erased.`);
    }
  }

  setupOrbitScene() {
    this.lastCompletedMission = 1;
    const orbitGroup = new THREE.Group();
    orbitGroup.name = "orbit_elements";

    SolarSystemInstance.init(orbitGroup);

    const satData = SatellitesList[this.selectedSatelliteIndex];
    const satMesh = AssetInstance.getSatelliteModel(this.selectedSatelliteIndex);
    satMesh.scale.set(0.4, 0.4, 0.4);
    satMesh.position.set(satData.orbitRadius, 0, 0);
    orbitGroup.add(satMesh);
    
    this.orbitSatelliteMesh = satMesh;
    this.selectedSatData.mesh = satMesh;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'css2d-label font-mono';
    labelDiv.textContent = this.selectedSatData.name;
    const labelObj = new CSS2DObject(labelDiv);
    labelObj.position.set(0, 1.5, 0);
    satMesh.add(labelObj);

    EngineInstance.scene.add(orbitGroup);

    MissionInstance.setupMission(this.selectedSatData);
    MissionInstance.activeSatellite.mesh = satMesh;
    
    MissionInstance.completeCallback = () => {
      const timerVal = document.getElementById('mission-timer').textContent;
      const scoreVal = document.getElementById('mission-score').textContent;
      
      this.changeState('COMPLETE');

      // Save Heliophysics mission progress
      ProgressInstance.completeMission('mission_1', MissionInstance.score, 3, timerVal);

      document.getElementById('summary-time').textContent = timerVal;
      document.getElementById('summary-score').textContent = scoreVal;
      document.getElementById('summary-images').textContent = `${MissionInstance.activeSatellite.capturedImages.length} / 5`;
      
      document.querySelector('#mission-complete-screen h1').textContent = "DATA TELEMETRY SECURED";
      document.querySelector('#mission-complete-screen .tagline').textContent = "STELLAR EXPEDITION SUCCESSFULLY CONCLUDED";
    };

    CameraInstance.cameraPosition.set(0, 80, 220);
    CameraInstance.cameraTarget.set(0, 0, 0);
    CameraInstance.activeCamera.position.copy(CameraInstance.cameraPosition);
    CameraInstance.controls.target.copy(CameraInstance.cameraTarget);
    CameraInstance.setMode('free');
  }

  setupEarthToMoonScene() {
    this.lastCompletedMission = 2;
    CameraInstance.setMode('custom');
    EarthToMoonSceneInstance.init(EngineInstance.scene);
    EarthToMoonMissionInstance.startMission();
    
    EarthToMoonMissionInstance.onCameraTransition = (mode) => {
      EarthToMoonSceneInstance.cameraMode = mode;
    };

    EarthToMoonMissionInstance.onMissionComplete = () => {
      const minutes = Math.floor(EarthToMoonMissionInstance.elapsedTime / 60);
      const seconds = Math.floor(EarthToMoonMissionInstance.elapsedTime % 60);
      const ms = Math.floor((EarthToMoonMissionInstance.elapsedTime % 1) * 100);
      const doubleDigit = (v) => v < 10 ? `0${v}` : v;
      const timerVal = `${doubleDigit(minutes)}:${doubleDigit(seconds)}.${doubleDigit(ms)}`;
      
      const stars = Math.max(1, 3 - EarthToMoonMissionInstance.wrongAnswersCount);
      ProgressInstance.completeMission('mission_2', EarthToMoonMissionInstance.score, stars, timerVal);

      this.lastCompletedMission = 2;

      // Show the mission complete summary screen first
      document.getElementById('summary-time').textContent = timerVal;
      document.getElementById('summary-score').textContent = EarthToMoonMissionInstance.score;
      const summaryImagesEl = document.getElementById('summary-images');
      if (summaryImagesEl) summaryImagesEl.textContent = '--';

      document.querySelector('#mission-complete-screen h1').textContent = "LUNAR TRANSIT COMPLETE";
      document.querySelector('#mission-complete-screen .tagline').textContent = "EARTH TO MOON MISSION SUCCESSFULLY CONCLUDED";

      this.changeState('COMPLETE');
    };
  }

  setupMarsRoverScene() {
    this.lastCompletedMission = 3;
    CameraInstance.setMode('custom');
    MarsRoverSceneInstance.init(EngineInstance.scene);
    MarsRoverMissionInstance.startMission();

    MarsRoverMissionInstance.onMissionComplete = () => {
      const minutes = Math.floor(MarsRoverMissionInstance.elapsedTime / 60);
      const seconds = Math.floor(MarsRoverMissionInstance.elapsedTime % 60);
      const ms = Math.floor((MarsRoverMissionInstance.elapsedTime % 1) * 100);
      const doubleDigit = (v) => v < 10 ? `0${v}` : v;
      const timerVal = `${doubleDigit(minutes)}:${doubleDigit(seconds)}.${doubleDigit(ms)}`;

      ProgressInstance.completeMission('mission_3', MarsRoverMissionInstance.score, 3, timerVal);

      this.lastCompletedMission = 3;

      // Show the mission complete summary screen first
      document.getElementById('summary-time').textContent = timerVal;
      document.getElementById('summary-score').textContent = MarsRoverMissionInstance.score;
      const summaryImagesEl = document.getElementById('summary-images');
      if (summaryImagesEl) summaryImagesEl.textContent = `${MarsRoverMissionInstance.photos.length} / 3`;

      document.querySelector('#mission-complete-screen h1').textContent = "SURFACE MISSION COMPLETE";
      document.querySelector('#mission-complete-screen .tagline').textContent = "MARS ROVER EXPEDITION SUCCESSFULLY CONCLUDED";

      this.changeState('COMPLETE');
    };
  }

  setupCompleteScene() {
    const completeGroup = new THREE.Group();
    completeGroup.name = "orbit_elements";

    if (this.lastCompletedMission === 3) {
      MarsRoverSceneInstance.init(completeGroup);
      CameraInstance.setMode('custom');
    } else if (this.lastCompletedMission === 2 || this.selectedSatelliteIndex < 0) {
      EarthToMoonSceneInstance.init(completeGroup);
      EarthToMoonSceneInstance.cameraMode = 'touchdown';
      CameraInstance.setMode('custom');
    } else {
      SolarSystemInstance.init(completeGroup);
      const satMesh = AssetInstance.getSatelliteModel(this.selectedSatelliteIndex);
      satMesh.scale.set(0.4, 0.4, 0.4);
      satMesh.position.set(0, 12, -40);
      completeGroup.add(satMesh);
      CameraInstance.setMode('cinematic');
    }

    EngineInstance.scene.add(completeGroup);
  }

  update(delta, time) {
    if (this.currentState === 'MENU' || this.currentState === 'SELECT' || this.currentState === 'PROGRESS') {
      SolarSystemInstance.update(delta, time);
      
      if (this.menuSatRef) {
        const radius = this.menuSatRadius;
        const speed = this.menuSatSpeed;
        const angle = time * speed * 0.15;
        
        this.menuSatRef.position.set(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );
        this.menuSatRef.lookAt(0, 0, 0);
        this.menuSatRef.rotation.y += Math.PI / 2;
        
        const light = this.menuSatRef.getObjectByName("nav_light");
        if (light) {
          light.visible = (Math.floor(time * 3) % 2 === 0);
        }
      }
    } else if (this.currentState === 'ORBIT') {
      SolarSystemInstance.update(delta, time);
      MissionInstance.update(delta);

      if (this.orbitSatelliteMesh) {
        const light = this.orbitSatelliteMesh.getObjectByName("nav_light");
        if (light) {
          light.visible = (Math.floor(time * 3) % 2 === 0);
        }
      }
    } else if (this.currentState === 'EARTH_TO_MOON') {
      EarthToMoonSceneInstance.update(delta, time);
      EarthToMoonMissionInstance.update(delta);
    } else if (this.currentState === 'MARS_ROVER') {
      MarsRoverSceneInstance.update(delta, time);
      MarsRoverMissionInstance.update(delta);
    } else if (this.currentState === 'COMPLETE') {
      if (this.lastCompletedMission === 3) {
        MarsRoverSceneInstance.update(delta, time);
      } else if (this.lastCompletedMission === 2 || this.selectedSatelliteIndex < 0) {
        EarthToMoonSceneInstance.update(delta, time);
      } else {
        SolarSystemInstance.update(delta, time);
      }
    }
  }
}

export const GameStateInstance = new GameStateManager();
export { GameStateManager };

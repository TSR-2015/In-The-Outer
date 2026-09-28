import { SatellitesList } from '../data/SatelliteData.js';
import { GameStateInstance } from '../managers/GameStateManager.js';
import { AudioInstance } from '../managers/AudioManager.js';
import { CameraInstance } from '../camera/CameraManager.js';
import { MissionInstance } from '../missions/MissionManager.js';
import { EngineInstance } from '../core/Engine.js';
import { ProgressInstance } from '../managers/ProgressManager.js';
import { EarthToMoonMissionInstance } from '../missions/EarthToMoonMission.js';
import { MarsRoverMissionInstance } from '../missions/MarsRoverMission.js';
import { MarsRoverSceneInstance } from '../scene/MarsRoverScene.js';
import { TelescopeMissionInstance } from '../missions/TelescopeMission.js';
import { TelescopeVisualsInstance } from '../scene/TelescopeVisuals.js';
import { MultiplayerInstance } from '../network/MultiplayerManager.js';
import { Icons } from './Icons.js';

class UIManager {
  constructor() {
    this.selectedSat = null;
    this.selectedIdx = -1;
    this.viewingFilename = null;

    // Data Capture Timing Slider Minigame properties
    this.sliderPointerPos = 0;
    this.sliderDirection = 1;
    this.sliderSpeed = 50;
    this.targetZoneLeft = 35;
    this.targetZoneWidth = 25;
  }

  init() {
    this.setupMenuListeners();
    this.setupAudioListeners();
    this.setupSatelliteSelection();
    this.setupDashboardListeners();
    this.setupProgressScreenListeners();
    if (typeof this.setupEarthMoonMissionListeners === 'function') {
      this.setupEarthMoonMissionListeners();
    }
    this.setupMarsMissionListeners();

    // Universal Hover Sound for interactive elements
    window.addEventListener('mouseover', (e) => {
      if (e.target && e.target.closest('button, .sat-card, .mission-card, .quiz-option-btn, .cam-btn, .brief-btn')) {
        AudioInstance.playHover();
      }
    });
  }

  // Minimalist Sound Toggle
  setupAudioListeners() {
    const btn = document.getElementById('audio-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
      AudioInstance.init();
      const muted = AudioInstance.toggleMute();
      btn.textContent = muted ? "SOUND: OFF" : "SOUND: ON";
    });
  }

  // Menu Modals & Navigation
  setupMenuListeners() {
    const bindBtn = (id, callback) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          AudioInstance.playClick();
          callback();
        });
      }
    };

    bindBtn('btn-mode-single', () => {
      GameStateInstance.isMultiplayer = false;
      GameStateInstance.changeState('PROGRESS');
    });
    bindBtn('btn-mode-multi', () => {
      GameStateInstance.isMultiplayer = true;
      GameStateInstance.changeState('LOBBY');
      MultiplayerInstance.setControllersView('LOBBY');
    });
    bindBtn('btn-lobby-back', () => {
      MultiplayerInstance.setControllersView('LOBBY');
      GameStateInstance.changeState('LANDING');
    });
    bindBtn('btn-lobby-start', () => {
      MultiplayerInstance.setActivePlayers(2);
      MultiplayerInstance.setControllersView('MISSION_CONTROL', 'MARS_ROVER');
      GameStateInstance.changeState('MARS_ROVER');
    });
    bindBtn('btn-start', () => GameStateInstance.changeState('PROGRESS'));
    bindBtn('btn-howto', () => this.toggleModal('howto-modal', true));
    bindBtn('btn-credits', () => this.toggleModal('credits-modal', true));
    
    // Selector Back
    bindBtn('btn-selection-back', () => GameStateInstance.changeState('PROGRESS'));

    // Complete Screen Navigation & Restart
    bindBtn('btn-complete-missions', () => {
      const satPhotos = document.getElementById('sat-1-photos');
      if (satPhotos) satPhotos.innerHTML = '<div class="photo-placeholder">NO PHOTOS CAPTURED</div>';
      GameStateInstance.changeState('PROGRESS');
    });

    bindBtn('btn-complete-restart', () => {
      const satPhotos = document.getElementById('sat-1-photos');
      if (satPhotos) satPhotos.innerHTML = '<div class="photo-placeholder">NO PHOTOS CAPTURED</div>';
      
      if (GameStateInstance.lastCompletedMission === 3) {
        GameStateInstance.changeState('MARS_ROVER');
      } else if (GameStateInstance.lastCompletedMission === 2) {
        GameStateInstance.changeState('EARTH_TO_MOON');
      } else if (GameStateInstance.selectedSatelliteIndex >= 0) {
        GameStateInstance.changeState('ORBIT');
      } else {
        GameStateInstance.changeState('SELECT');
      }
    });

    // Modal close hooks
    bindBtn('btn-howto-close', () => this.toggleModal('howto-modal', false));
    bindBtn('btn-credits-close', () => this.toggleModal('credits-modal', false));

    // Cosmic parallax background tracking
    this.setupLandingParallax();
  }

  setupLandingParallax() {
    const landing = document.getElementById('landing-page');
    if (!landing) return;
    const layers = landing.querySelectorAll('.parallax-layer');
    const cards = landing.querySelectorAll('.mode-select-btn');
    if (!layers || layers.length === 0) return;

    window.addEventListener('mousemove', (e) => {
      if (!landing.classList.contains('active')) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;

      layers.forEach(layer => {
        const speed = parseFloat(layer.getAttribute('data-speed')) || 0.05;
        const x = -dx * speed * 70;
        const y = -dy * speed * 70;
        layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });

      if (cards && cards.length > 0) {
        cards.forEach(card => {
          const tiltX = -dy * 5;
          const tiltY = dx * 5;
          card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-2px)`;
        });
      }
    }, { passive: true });

    landing.addEventListener('mouseleave', () => {
      layers.forEach(layer => {
        layer.style.transform = 'translate3d(0, 0, 0)';
      });
      if (cards && cards.length > 0) {
        cards.forEach(card => {
          card.style.transform = '';
        });
      }
    });
  }

  toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (modal) {
      if (show) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
        modal.style.display = 'flex';
      } else {
        modal.classList.remove('active');
        modal.classList.add('hidden');
        modal.style.display = '';
      }
    }
  }

  // SINGLE SATELLITE CHOICE (1 of 3)
  setupSatelliteSelection() {
    const grid = document.getElementById('satellite-grid');
    if (!grid) return;

    grid.innerHTML = '';
    this.selectedSat = null;
    this.selectedIdx = -1;

    SatellitesList.forEach((sat, index) => {
      const card = document.createElement('div');
      card.className = 'sat-card';
      card.dataset.id = sat.id;

      card.innerHTML = `
        <div class="sat-card-header">
          <span class="sat-card-name">${sat.name}</span>
          <span class="sat-card-class">${sat.class}</span>
        </div>
        <div class="sat-card-stats">
          <div class="sat-stat-row">
            <span>CAMERA FIELD:</span>
            <span class="val">${sat.camera}</span>
          </div>
          <div class="sat-stat-row">
            <span>HEAT COMPOSITE:</span>
            <span class="val">${sat.heatShield}</span>
          </div>
          <div class="sat-stat-row">
            <span>POWER LOAD:</span>
            <span class="val">${sat.battery}</span>
          </div>
          <div class="sat-stat-row">
            <span>CORE GEAR:</span>
            <span class="val truncate">${sat.instruments}</span>
          </div>
          <div class="sat-stat-row">
            <span>UPLOADS SPEED:</span>
            <span class="val">${sat.transmissionRate} Mbps</span>
          </div>
        </div>
        <div class="sat-card-ability">
          <strong>MODULE:</strong> ${sat.specialAbility}
        </div>
      `;

      card.addEventListener('click', () => {
        AudioInstance.init();
        
        // Toggle selected highlight
        document.querySelectorAll('.sat-card').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        
        this.selectedSat = sat;
        this.selectedIdx = index;
        
        // Update the 3D model in background selection scene immediately
        GameStateInstance.updateSelectedSatellite(index);
        
        // Enable Launch button
        const launchBtn = document.getElementById('btn-launch-sequence');
        if (launchBtn) {
          launchBtn.classList.remove('disabled');
          launchBtn.removeAttribute('disabled');
        }
        
        AudioInstance.playSelectProbe();
      });

      grid.appendChild(card);
    });

    const launchBtn = document.getElementById('btn-launch-sequence');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        if (this.selectedSat) {
          AudioInstance.playClick();
          GameStateInstance.selectedSatelliteIndex = this.selectedIdx;
          GameStateInstance.selectedSatData = JSON.parse(JSON.stringify(this.selectedSat));
          GameStateInstance.changeState('ORBIT');
        }
      });
    }
  }

  startTimingSliderLoop() {
    let lastTime = performance.now();
    const animate = (currentTime) => {
      const delta = (currentTime - lastTime) / 1000.0;
      lastTime = currentTime;

      this.sliderPointerPos += this.sliderDirection * this.sliderSpeed * delta;
      if (this.sliderPointerPos >= 100) {
        this.sliderPointerPos = 100;
        this.sliderDirection = -1;
      } else if (this.sliderPointerPos <= 0) {
        this.sliderPointerPos = 0;
        this.sliderDirection = 1;
      }

      const pointerEl = document.getElementById('timing-pointer');
      if (pointerEl) {
        pointerEl.style.left = `${this.sliderPointerPos}%`;
      }

      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // DASHBOARD EVENTS BINDINGS
  setupDashboardListeners() {
    this.startTimingSliderLoop();

    const handleDataCapture = () => {
      AudioInstance.init();
      const targetRight = this.targetZoneLeft + this.targetZoneWidth;
      const statusEl = document.getElementById('timing-status');

      if (this.sliderPointerPos >= this.targetZoneLeft && this.sliderPointerPos <= targetRight) {
        // HIT! Capture photo & data!
        MissionInstance.capturePhoto();
        AudioInstance.playHit();
        if (statusEl) {
          statusEl.textContent = "SUCCESSFUL DATA & PHOTO CAPTURE!";
          statusEl.style.color = "#15803d";
        }
        // Randomize target zone position for next capture
        this.targetZoneLeft = Math.floor(Math.random() * 45) + 15;
        const targetZoneEl = document.getElementById('timing-target-zone');
        if (targetZoneEl) {
          targetZoneEl.style.left = `${this.targetZoneLeft}%`;
          targetZoneEl.style.width = `${this.targetZoneWidth}%`;
        }
      } else {
        // MISS!
        AudioInstance.playMiss();
        if (statusEl) {
          statusEl.textContent = "TIMING MISSED! ALIGN POINTER WITH GREY ZONE";
          statusEl.style.color = "#dc2626";
        }
      }
    };

    const capBtn = document.getElementById('cmd-capture');
    if (capBtn) {
      capBtn.addEventListener('click', handleDataCapture);
    }

    const capSliderBtn = document.getElementById('cmd-capture-slider');
    if (capSliderBtn) {
      capSliderBtn.addEventListener('click', handleDataCapture);
    }

    // Camera angles
    const bindCam = (id, mode) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          AudioInstance.playClick();
          document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
          el.classList.add('active');
          
          CameraInstance.setMode(mode, GameStateInstance.orbitSatelliteMesh);
        });
      }
    };
    bindCam('cam-free', 'free');
    bindCam('cam-follow', 'follow');
    bindCam('cam-sun', 'sun');

    // Photo viewer modal actions
    const closeViewerBtn = document.getElementById('btn-viewer-close');
    if (closeViewerBtn) {
      closeViewerBtn.addEventListener('click', () => {
        AudioInstance.playClick();
        this.toggleModal('photo-viewer-modal', false);
      });
    }

    const saveViewerBtn = document.getElementById('btn-viewer-save');
    if (saveViewerBtn) {
      saveViewerBtn.addEventListener('click', () => {
        AudioInstance.playClick();
        this.downloadActivePhoto();
      });
    }

    // Wire up Mission instance callbacks
    MissionInstance.uiUpdateCallback = this.updateTelemetryDashboard.bind(this);
    MissionInstance.photoReelCallback = this.appendPhotoThumbnail.bind(this);
    MissionInstance.captureEffectCallback = () => {
      const flash = document.getElementById('solar-capture-flash');
      if (!flash) return;
      flash.classList.remove('active');
      void flash.offsetWidth;
      flash.classList.add('active');
    };
  }

  // RENDER DYNAMIC CANVAS THUMBNAIL IN TOP-RIGHT REEL
  appendPhotoThumbnail(filename, sourceCanvas) {
    const reel = document.getElementById('sat-1-photos');
    if (!reel) return;

    // Remove placeholder
    const placeholder = reel.querySelector('.photo-placeholder');
    if (placeholder) {
      reel.removeChild(placeholder);
    }

    // Create thumbnail canvas
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 72;
    thumbCanvas.height = 72;
    thumbCanvas.className = 'captured-thumbnail';
    thumbCanvas.title = "Click to preview / save";
    
    // Scale and paint source canvas contents onto thumbnail
    const ctx = thumbCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, 72, 72);

    // Bind click to open Viewer Modal
    thumbCanvas.addEventListener('click', () => {
      AudioInstance.playClick();
      this.openPhotoViewer(filename, sourceCanvas);
    });

    reel.appendChild(thumbCanvas);
  }

  // OPEN PHOTO VIEW MODAL
  openPhotoViewer(filename, sourceCanvas) {
    this.viewingFilename = filename;
    this.toggleModal('photo-viewer-modal', true);

    const viewerCanvas = document.getElementById('viewer-canvas');
    const ctx = viewerCanvas.getContext('2d');
    
    // Clear and draw double-res snapshot contents
    ctx.clearRect(0, 0, 400, 400);
    ctx.drawImage(sourceCanvas, 0, 0, 400, 400);

    // Fill metadata labels
    document.getElementById('viewer-filename').textContent = filename;
    document.getElementById('viewer-timestamp').textContent = new Date().toLocaleTimeString();
    const observation = MissionInstance.capturedObservations[filename];
    const observationEl = document.getElementById('viewer-observation-data');
    if (observation && observationEl) {
      observationEl.textContent = `SOLAR OBSERVATION // ${observation.status} // TEMP: ${observation.temperature} K // RADIATION: ${observation.radiation} W/m² // DISTANCE: ${observation.distance} AU // ${observation.activity}`;
    }
  }

  // DOWNLOAD PHOTO (PNG)
  downloadActivePhoto() {
    if (!this.viewingFilename) return;

    const sourceCanvas = MissionInstance.capturedPhotoData[this.viewingFilename];
    if (sourceCanvas) {
      const link = document.createElement('a');
      link.download = this.viewingFilename;
      link.href = sourceCanvas.toDataURL('image/png');
      link.click();
      
      MissionInstance.pushNotification(`DOWNLOAD TRIGGERED FOR ${this.viewingFilename}`, 'info');
    }
  }

  // HUD METRICS AND DATA TICK UPDATING (60 FPS)
  updateTelemetryDashboard() {
    const sat = MissionInstance.activeSatellite;
    if (!sat) return;

    // Left sidebar status panel
    document.getElementById('dashboard-sat-name').textContent = sat.name;
    document.getElementById('stat-orbit-sector').textContent = sat.orbitSector;
    document.getElementById('stat-velocity').textContent = `${sat.speed.toFixed(1)} km/s`;
    document.getElementById('stat-distance').textContent = `${(sat.orbitRadius * 0.003).toFixed(3)} AU`;

    // Indicators values
    document.getElementById('stat-health-val').textContent = `${Math.floor(sat.health)}%`;
    document.getElementById('stat-battery-val').textContent = `${Math.floor(sat.battery)}%`;
    document.getElementById('stat-signal-val').textContent = `${sat.signal}%`;

    // Fills adjustment
    document.getElementById('stat-health-fill').style.width = `${sat.health}%`;
    document.getElementById('stat-battery-fill').style.width = `${sat.battery}%`;
    document.getElementById('stat-signal-fill').style.width = `${sat.signal}%`;

    // Header Clock and Score telemetry
    const minutes = Math.floor(MissionInstance.missionTimer / 60);
    const seconds = Math.floor(MissionInstance.missionTimer % 60);
    const ms = Math.floor((MissionInstance.missionTimer % 1) * 100);
    const doubleDigit = (v) => v < 10 ? `0${v}` : v;
    document.getElementById('mission-timer').textContent = `${doubleDigit(minutes)}:${doubleDigit(seconds)}.${doubleDigit(ms)}`;
    document.getElementById('mission-score').textContent = doubleDigit(Math.floor(MissionInstance.score));

    // Middle Right: Numerical Data values and logs
    if (sat.photoProgress >= 100) {
      document.getElementById('stat-temp-val').textContent = `${sat.temp} K`;
      document.getElementById('stat-wind-val').textContent = `${sat.radiation.toLocaleString()} W/m²`;
    } else {
      document.getElementById('stat-temp-val').textContent = "LOCKED (CAPTURE PHOTOS)";
      document.getElementById('stat-wind-val').textContent = "LOCKED (CAPTURE PHOTOS)";
    }
    document.getElementById('stat-distance-sun').textContent = `${sat.distanceFromSun.toFixed(3)} AU`;
    document.getElementById('stat-solar-activity').textContent = sat.solarActivity;

    // Progress Bar fills
    document.getElementById('objective-1-percent').textContent = `${Math.floor(sat.photoProgress)}%`;
    document.getElementById('objective-1-fill').style.width = `${sat.photoProgress}%`;
    document.getElementById('objective-2-fill').style.width = `${sat.tempProgress}%`;
    document.getElementById('objective-3-fill').style.width = `${sat.windProgress}%`;

    // Grayscale SVG chart
    this.updateSVGTelemetryChart();
  }

  // UPDATE SVG CHART PATHS (Monochrome styling)
  updateSVGTelemetryChart() {
    const width = 300;
    const height = 120;
    
    // Grid generation (once)
    const gridG = document.getElementById('chart-grid');
    if (gridG && gridG.children.length === 0) {
      for (let i = 25; i < width; i += 50) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", i);
        line.setAttribute("y1", 0);
        line.setAttribute("x2", i);
        line.setAttribute("y2", height);
        gridG.appendChild(line);
      }
      for (let i = 20; i < height; i += 30) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", 0);
        line.setAttribute("y1", i);
        line.setAttribute("x2", width);
        line.setAttribute("y2", i);
        gridG.appendChild(line);
      }
    }

    const drawPath = (pathId, dataArray) => {
      const path = document.getElementById(pathId);
      if (!path) return;

      const segments = dataArray.length;
      const step = width / (segments - 1);
      
      let d = "";
      for (let i = 0; i < segments; i++) {
        const x = i * step;
        const y = height - (dataArray[i] / 100) * height;
        d += `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }
      path.setAttribute("d", d);
    };

    drawPath("chart-path-rad", MissionInstance.chartData.rad);
    drawPath("chart-path-mag", MissionInstance.chartData.mag);
    drawPath("chart-path-wind", MissionInstance.chartData.wind);
  }

  // -----------------------------------------
  // MISSION PROGRESS / CARD RENDER SYSTEM
  // -----------------------------------------
  setupProgressScreenListeners() {
    const bindBtn = (id, callback) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          AudioInstance.playClick();
          callback();
        });
      }
    };

    bindBtn('btn-progress-back', () => GameStateInstance.changeState('LANDING'));

    // Register callback hook in GameStateManager
    GameStateInstance.onStateChange = (state) => {
      if (state === 'PROGRESS') {
        this.renderProgressScreen();
      }
    };
  }

  renderProgressScreen() {
    const progressData = ProgressInstance.loadProgress();
    const overallPct = ProgressInstance.getOverallPercent();
    
    // Update overall progress bar
    const progressFill = document.getElementById('overall-progress-fill');
    if (progressFill) progressFill.style.width = `${overallPct}%`;
    const progressText = document.getElementById('overall-progress-text');
    if (progressText) progressText.textContent = `${overallPct}%`;
    
    let completedCount = 0;
    for (let k in progressData) {
      if (progressData[k].completed) completedCount++;
    }
    const completedVal = document.getElementById('completed-missions-val');
    if (completedVal) completedVal.textContent = `${completedCount} / 6`;

    // Populate mission cards
    const cardsList = document.getElementById('mission-cards-list');
    if (!cardsList) return;
    
    cardsList.innerHTML = '';

    const missionNames = {
      mission_1: "Heliophysics Expedition (IN THE OUTER)",
      mission_2: "Earth to Moon Flight Sequence",
      mission_3: "Mars Lander Probe Injection",
      mission_4: "Telescope Observation & Reconstruction",
      mission_5: "Planetary Defense (The Asteroid Decision)",
      mission_6: "MISSION 06 — MERCURY EXPLORER"
    };

    for (let i = 1; i <= 6; i++) {
      const id = `mission_${i}`;
      const m = progressData[id];
      if (!m) continue;

      const card = document.createElement('div');
      card.className = `mission-card ${m.unlocked ? '' : 'locked'}`;
      
      let statusText = `<span class="status-chip locked">${Icons.lock(12)} LOCKED</span>`;
      if (m.completed) {
        statusText = `<span class="status-chip completed">${Icons.check(12)} COMPLETED</span>`;
      } else if (m.unlocked) {
        statusText = `<span class="status-chip unlocked">${Icons.play(10)} UNLOCKED</span>`;
      }

      // Draw star shapes based on score/stars count
      let starsHtml = "";
      if (m.completed) {
        const starCount = m.stars || 3;
        for (let s = 0; s < 3; s++) {
          starsHtml += s < starCount ? Icons.star(14, 'star-gold') : Icons.starOutline(14, 'star-dim');
        }
      } else {
        starsHtml = `${Icons.starOutline(14, 'star-dim')}${Icons.starOutline(14, 'star-dim')}${Icons.starOutline(14, 'star-dim')}`;
      }

      card.innerHTML = `
        <div class="mission-card-header">
          <span class="mission-card-index">MISSION 0${i}</span>
          <span class="mission-card-status font-mono">${statusText}</span>
        </div>
        <div class="mission-card-title font-mono" style="font-weight: 800; margin-bottom: 8px;">
          ${missionNames[id]}
        </div>
        <div class="mission-card-stats-row">
          <span>SCORE: ${m.score} pts</span>
          <span>STARS: ${starsHtml}</span>
          <span>BEST TIME: ${m.bestTime}</span>
        </div>
      `;

      if (m.unlocked) {
        card.addEventListener('click', () => {
          AudioInstance.playClick();
          if (i === 1) {
            GameStateInstance.selectedSatelliteIndex = -1; // reset selection
            GameStateInstance.changeState('SELECT');
          } else if (i === 2) {
            GameStateInstance.selectedSatelliteIndex = -1; // resets probe reference
            GameStateInstance.changeState('EARTH_TO_MOON');
          } else if (i === 3) {
            GameStateInstance.changeState('MARS_ROVER');
          } else if (i === 4) {
            GameStateInstance.changeState('TELESCOPE');
          } else if (i === 5) {
            GameStateInstance.changeState('PLANETARY_DEFENSE');
          } else if (i === 6) {
            GameStateInstance.changeState('MISSION6');
          }
        });
      } else {
        card.addEventListener('click', () => {
          AudioInstance.playScienceBeep();
          alert("Complete the previous mission to unlock this mission.");
        });
      }

      cardsList.appendChild(card);
    }
  }

  // -----------------------------------------
  // EARTH-MOON HUD AND QUIZ CONTROLS
  // -----------------------------------------
  setupEarthMoonMissionListeners() {
    // Map callbacks of the EarthToMoon mission manager
    EarthToMoonMissionInstance.onUIUpdate = () => {
      this.updateEarthMoonHUD();
    };

    EarthToMoonMissionInstance.onQuizTrigger = (q) => {
      this.triggerEarthMoonQuiz(q);
    };

    EarthToMoonMissionInstance.onQuizClose = () => {
      this.toggleModal('earth-moon-quiz-modal', false);
    };

    EarthToMoonMissionInstance.onMissionFailed = (failedData) => {
      this.showQuizFailure(failedData);
    };
  }

  updateEarthMoonHUD() {
    const m = EarthToMoonMissionInstance;
    
    const stageEl = document.getElementById('em-hud-stage');
    if (stageEl) stageEl.textContent = m.stage.toUpperCase();

    const altEl = document.getElementById('em-hud-altitude');
    if (altEl) {
      if (m.stage === 'DESCENT' || m.stage === 'Q5' || m.stage === 'Q2' || m.stage === 'TOUCHDOWN') {
        altEl.textContent = `${Math.ceil(m.countdown)} m`;
      } else {
        altEl.textContent = `${m.altitude.toLocaleString()} km`;
      }
    }

    const velEl = document.getElementById('em-hud-velocity');
    if (velEl) velEl.textContent = `${m.velocity.toFixed(2)} km/s`;

    const fuelEl = document.getElementById('em-hud-fuel');
    if (fuelEl) fuelEl.textContent = `${Math.floor(m.fuel)}%`;

    const fuelFill = document.getElementById('em-hud-fuel-fill');
    if (fuelFill) fuelFill.style.width = `${m.fuel}%`;

    const clockEl = document.getElementById('em-hud-clock');
    if (clockEl) {
      const minutes = Math.floor(m.elapsedTime / 60);
      const seconds = Math.floor(m.elapsedTime % 60);
      const ms = Math.floor((m.elapsedTime % 1) * 100);
      const doubleDigit = (v) => v < 10 ? `0${v}` : v;
      clockEl.textContent = `${doubleDigit(minutes)}:${doubleDigit(seconds)}.${doubleDigit(ms)}`;
    }

    const objEl = document.getElementById('em-hud-objective');
    if (objEl) objEl.textContent = m.objective;

    const progressFill = document.getElementById('em-hud-progress-fill');
    if (progressFill) progressFill.style.width = `${m.progress}%`;

    const progressPct = document.getElementById('em-hud-progress-pct');
    if (progressPct) progressPct.textContent = `${Math.floor(m.progress)}%`;
  }

  triggerEarthMoonQuiz(q) {
    const modal = document.getElementById('earth-moon-quiz-modal');
    if (!modal) return;

    this.toggleModal('earth-moon-quiz-modal', true);

    const questionEl = document.getElementById('em-quiz-question');
    const optionsEl = document.getElementById('em-quiz-options');
    const feedbackEl = document.getElementById('em-quiz-feedback');
    const actionsEl = document.getElementById('em-quiz-actions');

    if (questionEl) questionEl.textContent = q.question;
    if (feedbackEl) feedbackEl.classList.add('hidden');
    if (optionsEl) optionsEl.innerHTML = '';
    if (actionsEl) actionsEl.innerHTML = '';

    let selectedVal = null;

    // Populates choices
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.textContent = `${opt.val}. ${opt.text}`;
      
      btn.addEventListener('click', () => {
        AudioInstance.playClick();
        document.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedVal = opt.val;
        submitBtn.disabled = false;
        submitBtn.classList.remove('disabled');
      });

      optionsEl.appendChild(btn);
    });

    // Create Submit Button
    const submitBtn = document.createElement('button');
    submitBtn.className = 'brief-btn next disabled';
    submitBtn.textContent = "SUBMIT RESPONSE";
    submitBtn.disabled = true;

    submitBtn.addEventListener('click', () => {
      AudioInstance.playClick();
      
      // Disable option buttons from further clicks
      document.querySelectorAll('.quiz-option-btn').forEach(b => {
        b.disabled = true;
        b.style.pointerEvents = 'none';
        b.classList.add('disabled');
      });
      submitBtn.disabled = true;
      submitBtn.classList.add('disabled');

      // Highlight results
      const optionButtons = document.querySelectorAll('.quiz-option-btn');
      q.options.forEach((opt, idx) => {
        const btn = optionButtons[idx];
        if (opt.val === q.correct) {
          btn.classList.add('correct');
        } else if (opt.val === selectedVal) {
          btn.classList.add('wrong');
        }
      });

      // Show explanation
      feedbackEl.classList.remove('hidden');
      if (selectedVal === q.correct) {
        AudioInstance.playQuizCorrect();
        feedbackEl.innerHTML = `<span style="color: #15803d; font-weight: bold;">[CORRECT]</span><br>${q.explanation}`;
        
        if (q.id === 'Q2') {
          // Final question Q2 correct: complete mission immediately and open Missions screen
          this.toggleModal('earth-moon-quiz-modal', false);
          EarthToMoonMissionInstance.handleAnswer(q.id, selectedVal);
        } else {
          // Non-final questions: show Continue button
          const contBtn = document.createElement('button');
          contBtn.className = 'brief-btn next';
          contBtn.textContent = "CONTINUE MISSION";
          contBtn.addEventListener('click', () => {
            AudioInstance.playClick();
            this.toggleModal('earth-moon-quiz-modal', false);
            EarthToMoonMissionInstance.handleAnswer(q.id, selectedVal);
          });
          actionsEl.appendChild(contBtn);
        }
      } else {
        AudioInstance.playQuizWrong();
        feedbackEl.innerHTML = `<span style="color: #b91c1c; font-weight: bold;">[INCORRECT]</span><br>Correct Answer: ${q.correct}. ${q.options.find(o => o.val === q.correct).text}<br><br>${q.explanation}`;
        // Add Fail Continue Button
        const contBtn = document.createElement('button');
        contBtn.className = 'brief-btn next';
        contBtn.textContent = "CONTINUE SEQUENCE";
        contBtn.addEventListener('click', () => {
          AudioInstance.playClick();
          this.toggleModal('earth-moon-quiz-modal', false);
          EarthToMoonMissionInstance.handleAnswer(q.id, selectedVal);
        });
        actionsEl.appendChild(contBtn);
      }
    });

    actionsEl.appendChild(submitBtn);
  }

  showQuizFailure(failedData) {
    const modal = document.getElementById('earth-moon-quiz-modal');
    if (!modal) return;

    this.toggleModal('earth-moon-quiz-modal', true);

    const questionEl = document.getElementById('em-quiz-question');
    const optionsEl = document.getElementById('em-quiz-options');
    const feedbackEl = document.getElementById('em-quiz-feedback');
    const actionsEl = document.getElementById('em-quiz-actions');

    document.getElementById('em-quiz-title').textContent = "MISSION FAILURE";
    
    if (questionEl) questionEl.innerHTML = `<span style="color: #b91c1c; font-weight: 800;">CRITICAL LAUNCH FAILURE DETECTED</span>`;
    if (optionsEl) {
      optionsEl.innerHTML = `
        <div style="font-size: 0.9rem; line-height: 1.4; border: var(--border-thin); padding: 15px; background: #fff;">
          <strong>FAILED QUERY:</strong><br>${failedData.question}<br><br>
          <strong>REQUIRED ANSWER:</strong><br>${failedData.correctText}<br><br>
          <strong>EXPLANATION:</strong><br>${failedData.explanation}
        </div>
      `;
    }
    if (feedbackEl) feedbackEl.classList.add('hidden');
    
    if (actionsEl) {
      actionsEl.innerHTML = '';

      // Retry Button
      const retryBtn = document.createElement('button');
      retryBtn.className = 'brief-btn next';
      retryBtn.textContent = "RETRY MISSION";
      retryBtn.addEventListener('click', () => {
        AudioInstance.playClick();
        this.toggleModal('earth-moon-quiz-modal', false);
        document.getElementById('em-quiz-title').textContent = "MISSION QUESTION CHECKPOINT";
        GameStateInstance.changeState('EARTH_TO_MOON');
      });

      // Quit Button
      const quitBtn = document.createElement('button');
      quitBtn.className = 'brief-btn back';
      quitBtn.textContent = "RETURN TO CONTROL";
      quitBtn.addEventListener('click', () => {
        AudioInstance.playClick();
        this.toggleModal('earth-moon-quiz-modal', false);
        document.getElementById('em-quiz-title').textContent = "MISSION QUESTION CHECKPOINT";
        GameStateInstance.changeState('PROGRESS');
      });

      actionsEl.appendChild(quitBtn);
      actionsEl.appendChild(retryBtn);
    }
  }

  // -----------------------------------------
  // MARS ROVER MISSION (MISSION 03) UI
  // -----------------------------------------
  setupMarsMissionListeners() {
    MarsRoverMissionInstance.onUIUpdate = () => {
      this.updateMarsHUD();
    };

    MarsRoverMissionInstance.onTogglePause = () => this.toggleMarsPause();

    MarsRoverMissionInstance.onToggleDataModal = () => {
      const modal = document.getElementById('mars-data-modal');
      const isVisible = modal && modal.classList.contains('active');
      this.toggleModal('mars-data-modal', !isVisible);
      if (!isVisible) {
        this.populateMarsDataModal();
      }
    };

    MarsRoverMissionInstance.onDiscovery = (disc) => {
      this.showMarsDiscoveryToast(disc);
    };

    const bindBtn = (id, callback) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          try { AudioInstance.playClick(); } catch(e) {}
          callback();
        });
      }
    };

    bindBtn('btn-mars-pause', () => this.toggleMarsPause());
    bindBtn('btn-mars-resume', () => this.toggleMarsPause());
    bindBtn('btn-mars-exit', () => {
      this.toggleModal('mars-pause-modal', false);
      MarsRoverMissionInstance.setPaused(false);
      MarsRoverMissionInstance.stage = 'SETUP';
      if (GameStateInstance.isMultiplayer) {
        GameStateInstance.changeState('LOBBY');
      } else {
        GameStateInstance.changeState('PROGRESS');
      }
    });

    const closeDataBtn = document.getElementById('btn-mars-data-close');
    if (closeDataBtn) {
      closeDataBtn.addEventListener('click', () => {
        AudioInstance.playClick();
        this.toggleModal('mars-data-modal', false);
      });
    }

    const dismissDiscBtn = document.getElementById('btn-discovery-dismiss');
    if (dismissDiscBtn) {
      dismissDiscBtn.addEventListener('click', () => {
        AudioInstance.playClick();
        this.toggleModal('mars-discovery-toast', false);
      });
    }
  }

  toggleMarsPause() {
    const isPaused = MarsRoverMissionInstance.togglePause();
    this.toggleModal('mars-pause-modal', isPaused);
    if (GameStateInstance.isMultiplayer) {
      if (isPaused) MultiplayerInstance.sendPause();
      else MultiplayerInstance.sendResume();
    }
  }

  updateMarsHUD() {
    const m = MarsRoverMissionInstance;
    const isSplit = m.isSplitScreen;

    // 1. UPDATE PLAYER 1 HUD
    const p1 = m.players[1];
    if (p1) {
      const p1Avatar = document.getElementById('p1-avatar');
      if (p1Avatar) p1Avatar.textContent = (p1.name || 'P1').slice(0, 2).toUpperCase();

      const p1Name = document.getElementById('p1-name');
      if (p1Name) p1Name.textContent = p1.name;

      const p1Score = document.getElementById('p1-score');
      if (p1Score) p1Score.textContent = p1.score;

      const p1Rank = document.getElementById('p1-rank');
      if (p1Rank) {
        p1Rank.textContent = p1.rank === 1 ? '1ST PLACE' : '2ND PLACE';
        p1Rank.className = `p-hud-rank-badge ${p1.rank === 1 ? 'rank-1st' : 'rank-2nd'}`;
      }

      const reg1 = document.getElementById('mars-hud-region-p1');
      if (reg1) reg1.textContent = p1.currentRegion.toUpperCase();

      const batt1 = document.getElementById('mars-hud-battery-p1');
      if (batt1) batt1.textContent = `${Math.floor(p1.battery)}%`;

      const spd1 = document.getElementById('mars-hud-speed-p1');
      if (spd1) spd1.textContent = `${p1.speed.toFixed(1)} m/s`;

      const temp1 = document.getElementById('mars-hud-temp-p1');
      if (temp1) temp1.textContent = `${m.temperature}°C`;

      const obj1 = document.getElementById('mars-hud-objective-p1');
      if (obj1) obj1.textContent = m.getPlayerObjective(1);

      const fill1 = document.getElementById('mars-hud-progress-fill-p1');
      if (fill1) fill1.style.width = `${m.getPlayerProgress(1)}%`;

      const modeBadge1 = document.getElementById('p1-mode-badge');
      if (modeBadge1) {
        if (p1.inViewfinder) {
          modeBadge1.classList.remove('hidden');
          modeBadge1.textContent = "PHOTO MODE ACTIVE";
        } else if (p1.inSamplingMode) {
          modeBadge1.classList.remove('hidden');
          modeBadge1.textContent = "SAMPLE MODE ACTIVE";
        } else {
          modeBadge1.classList.add('hidden');
        }
      }

      this.drawSingleMinimap('mars-minimap-canvas-p1', 1);
    }

    // 2. UPDATE PLAYER 2 HUD (IF IN SPLIT-SCREEN)
    const p2 = m.players[2];
    if (isSplit && p2) {
      const p2Avatar = document.getElementById('p2-avatar');
      if (p2Avatar) p2Avatar.textContent = (p2.name || 'P2').slice(0, 2).toUpperCase();

      const p2Name = document.getElementById('p2-name');
      if (p2Name) p2Name.textContent = p2.name;

      const p2Score = document.getElementById('p2-score');
      if (p2Score) p2Score.textContent = p2.score;

      const p2Rank = document.getElementById('p2-rank');
      if (p2Rank) {
        p2Rank.textContent = p2.rank === 1 ? '1ST PLACE' : '2ND PLACE';
        p2Rank.className = `p-hud-rank-badge ${p2.rank === 1 ? 'rank-1st' : 'rank-2nd'}`;
      }

      const reg2 = document.getElementById('mars-hud-region-p2');
      if (reg2) reg2.textContent = p2.currentRegion.toUpperCase();

      const batt2 = document.getElementById('mars-hud-battery-p2');
      if (batt2) batt2.textContent = `${Math.floor(p2.battery)}%`;

      const spd2 = document.getElementById('mars-hud-speed-p2');
      if (spd2) spd2.textContent = `${p2.speed.toFixed(1)} m/s`;

      const temp2 = document.getElementById('mars-hud-temp-p2');
      if (temp2) temp2.textContent = `${m.temperature}°C`;

      const obj2 = document.getElementById('mars-hud-objective-p2');
      if (obj2) obj2.textContent = m.getPlayerObjective(2);

      const fill2 = document.getElementById('mars-hud-progress-fill-p2');
      if (fill2) fill2.style.width = `${m.getPlayerProgress(2)}%`;

      const modeBadge2 = document.getElementById('p2-mode-badge');
      if (modeBadge2) {
        if (p2.inViewfinder) {
          modeBadge2.classList.remove('hidden');
          modeBadge2.textContent = "PHOTO MODE ACTIVE";
        } else if (p2.inSamplingMode) {
          modeBadge2.classList.remove('hidden');
          modeBadge2.textContent = "SAMPLE MODE ACTIVE";
        } else {
          modeBadge2.classList.add('hidden');
        }
      }

      this.drawSingleMinimap('mars-minimap-canvas-p2', 2);
    }
  }

  drawSingleMinimap(canvasId, playerNum) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, width, height);

    const m = MarsRoverMissionInstance;
    const p = m.players[playerNum];
    if (!p) return;

    const centerX = width / 2;
    const centerY = height / 2;

    // Radar Circles
    ctx.strokeStyle = playerNum === 1 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 48, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    const scale = 0.55;
    const worldToCanvas = (wx, wz) => {
      const px = centerX + (wx - p.roverX) * scale;
      const py = centerY + (wz - p.roverZ) * scale;
      return { px, py };
    };

    // Draw sample points
    m.sampleZones.forEach(sp => {
      const { px, py } = worldToCanvas(sp.x, sp.z);
      if (px >= 0 && px <= width && py >= 0 && py <= height) {
        const isCollected = sp.collectedBy.has(playerNum);
        ctx.fillStyle = isCollected ? '#64748b' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, isCollected ? 3 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Anomaly Zone
    const resZone = worldToCanvas(-75, -70);
    if (resZone.px >= 0 && resZone.px <= width && resZone.py >= 0 && resZone.py <= height) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(resZone.px, resZone.py, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Other Player's Rover marker if in range
    const otherNum = playerNum === 1 ? 2 : 1;
    const otherP = m.players[otherNum];
    if (m.isSplitScreen && otherP) {
      const otherPos = worldToCanvas(otherP.roverX, otherP.roverZ);
      if (otherPos.px >= 0 && otherPos.px <= width && otherPos.py >= 0 && otherPos.py <= height) {
        ctx.fillStyle = otherNum === 1 ? '#ef4444' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(otherPos.px, otherPos.py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Player's Own Rover Heading Arrow at Center
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-p.roverRotation);

    ctx.fillStyle = playerNum === 1 ? '#ef4444' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-5, -6);
    ctx.lineTo(0, -3);
    ctx.lineTo(5, -6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  showMarsSplitOutcome(playerNum, won, finalScore) {
    const overlay = document.getElementById(`p${playerNum}-outcome-overlay`);
    const titleEl = document.getElementById(`p${playerNum}-outcome-title`);
    const subEl = document.getElementById(`p${playerNum}-outcome-sub`);
    const scoreEl = document.getElementById(`p${playerNum}-outcome-score-val`);

    if (overlay && subEl && scoreEl) {
      overlay.classList.remove('hidden');
      scoreEl.textContent = finalScore;

      if (won) {
        titleEl.textContent = "MISSION COMPLETE";
        subEl.textContent = "YOU WIN!";
        subEl.className = "outcome-sub win";
      } else {
        titleEl.textContent = "MISSION CONCLUDED";
        subEl.textContent = "YOU LOSE";
        subEl.className = "outcome-sub lose";
      }
    }
  }

  showMarsDiscoveryToast(disc) {
    const titleEl = document.getElementById('discovery-toast-title');
    const descEl = document.getElementById('discovery-toast-desc');
    if (titleEl) titleEl.innerHTML = `${Icons.star(18, 'star-gold')} <span>${disc.title.toUpperCase()}</span>`;
    if (descEl) descEl.innerHTML = `<strong>LOCATION:</strong> ${disc.region.toUpperCase()}<br>${disc.desc}`;

    this.toggleModal('mars-discovery-toast', true);
  }

  populateMarsDataModal() {
    const body = document.getElementById('mars-data-body');
    if (!body) return;

    const m = MarsRoverMissionInstance;
    
    let html = `
      <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
        <h3 style="color: #ef4444; margin-bottom: 6px;">CLIMATE TELEMETRY REPORT</h3>
        <div>CURRENT REGION: <strong>${m.currentRegion.toUpperCase()}</strong></div>
        <div>SURFACE TEMPERATURE: <strong>${m.telemetry.temp}°C</strong></div>
        <div>WIND VELOCITY: <strong>${m.telemetry.wind} km/h</strong></div>
        <div>DUST INTENSITY: <strong>${m.telemetry.dust.toUpperCase()}</strong></div>
        <div>SURFACE RADIATION: <strong>${m.telemetry.radiation.toFixed(2)} mSv/h</strong></div>
        <div>SCANNED REGIONS: <strong>${Array.from(m.discoveredRegions).join(', ').toUpperCase()}</strong></div>
      </div>

      <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
        <h3 style="color: #3b82f6; margin-bottom: 6px;">SCIENTIFIC SAMPLES INVENTORY (${m.samples.length}/3)</h3>
    `;

    if (m.samples.length === 0) {
      html += `<div style="color: #64748b;">No samples collected yet. Approach glowing beacons and press [E].</div>`;
    } else {
      m.samples.forEach(s => {
        html += `
          <div style="background: #f8fafc; border: var(--border-thin); padding: 8px; margin-bottom: 6px;">
            <strong>ID: ${s.id} — ${s.type.toUpperCase()}</strong><br>
            Region: ${s.region} | Temp: ${s.temp} | Coords: ${s.coords}
          </div>
        `;
      });
    }

    html += `
      </div>
      <div>
        <h3 style="color: #10b981; margin-bottom: 6px;">PHOTOGRAPHY LOG (${m.photos.length}/3)</h3>
    `;

    if (m.photos.length === 0) {
      html += `<div style="color: #64748b;">No Mars photos captured yet. Press [P] to capture photos.</div>`;
    } else {
      m.photos.forEach(p => {
        html += `
          <div style="background: #f8fafc; border: var(--border-thin); padding: 8px; margin-bottom: 6px;">
            <strong>FILE: ${p.id}</strong> (${p.timestamp})<br>
            Region: ${p.region} | Temp: ${p.temp} | Coords: ${p.coords}
          </div>
        `;
      });
    }

    html += `</div>`;
    body.innerHTML = html;
  }

  // -----------------------------------------
  // MISSION 4: TELESCOPE & RECONSTRUCTION UI
  // -----------------------------------------
  setupTelescopeUI() {
    const tm = TelescopeMissionInstance;
    tm.resetMission(false);

    const gridEl = document.getElementById('telescope-planet-grid');
    const beginBtn = document.getElementById('btn-tel-begin-obs');
    const backBtn = document.getElementById('btn-tel-back');
    const submitBtn = document.getElementById('btn-tel-submit');
    const continueBtn = document.getElementById('btn-tel-complete-continue');

    // Show planet selection view initially
    this.showTelescopeView('telescope-planet-selection');

    if (backBtn) {
      backBtn.onclick = () => {
        AudioInstance.playClick();
        GameStateInstance.changeState('PROGRESS');
      };
    }

    const restartBtn = document.getElementById('btn-tel-complete-restart');
    if (restartBtn) {
      restartBtn.onclick = () => {
        AudioInstance.playClick();
        this.toggleModal('telescope-complete-modal', false);
        tm.resetMission(true);
        this.setupTelescopeUI();
      };
    }

    if (continueBtn) {
      continueBtn.onclick = () => {
        AudioInstance.playClick();
        this.toggleModal('telescope-complete-modal', false);
        GameStateInstance.changeState('PROGRESS');
      };
    }

    // Render 8 Planet Cards with Real 2D Planet Pictures
    if (gridEl) {
      gridEl.innerHTML = '';
      tm.planets.forEach(planet => {
        const card = document.createElement('div');
        const isCompleted = tm.completedPlanetIds.has(planet.id);
        card.className = `obs-planet-card font-mono ${isCompleted ? 'completed' : ''}`;
        card.dataset.planetId = planet.id;

        const thumbUrl = TelescopeVisualsInstance.getPlanetThumbnail(planet.id);

        card.innerHTML = `
          <div class="planet-thumb-wrapper" style="background: url('${thumbUrl}') center/cover no-repeat;"></div>
          <div class="planet-card-title">${planet.name}</div>
          <div class="planet-card-detail">${planet.detail}</div>
          <div class="planet-card-badge ${isCompleted ? '' : 'hidden'}">${isCompleted ? `${Icons.check(12)} DONE` : Icons.check(12)}</div>
        `;

        card.onclick = () => {
          if (isCompleted) {
            AudioInstance.playScienceBeep();
            return;
          }
          const selected = tm.selectPlanet(planet.id);
          if (selected) {
            // Update UI card selection styling
            const allCards = gridEl.querySelectorAll('.obs-planet-card');
            allCards.forEach(c => {
              if (!c.classList.contains('completed')) {
                c.classList.remove('selected');
                c.classList.add('subdued');
                const b = c.querySelector('.planet-card-badge');
                if (b) b.classList.add('hidden');
              }
            });

            card.classList.remove('subdued');
            card.classList.add('selected');
            const badge = card.querySelector('.planet-card-badge');
            if (badge) badge.classList.remove('hidden');

            if (beginBtn) {
              beginBtn.classList.remove('disabled');
              beginBtn.removeAttribute('disabled');
            }
          }
        };

        gridEl.appendChild(card);
      });
    }

    // BEGIN OBSERVATION CLICK
    if (beginBtn) {
      beginBtn.disabled = true;
      beginBtn.classList.add('disabled');

      beginBtn.onclick = () => {
        if (!tm.selectedPlanet) return;
        AudioInstance.playClick();

        this.showTelescopeView('telescope-observation-view');

        const planetNameEl = document.getElementById('tel-obs-planet-name');
        if (planetNameEl) planetNameEl.textContent = tm.selectedPlanet.name.toUpperCase();

        const viewportImg = document.getElementById('telescope-2d-img');

        // Callbacks for observation steps
        tm.onPhaseChange = (phaseIdx, imgUrl) => {
          const phaseTracker = document.getElementById('tel-obs-phase-tracker');
          const badgeText = document.getElementById('tel-obs-badge-text');

          if (viewportImg) viewportImg.src = imgUrl;
          if (phaseTracker) phaseTracker.textContent = `VIEW ${phaseIdx + 1} / 5`;
          if (badgeText) badgeText.textContent = `OBSERVING ${tm.selectedPlanet.name.toUpperCase()} — PHASE ${phaseIdx + 1} RECORDED`;
        };

        tm.onObservationComplete = () => {
          const badgeText = document.getElementById('tel-obs-badge-text');
          if (badgeText) badgeText.textContent = `OBSERVATION COMPLETE! PREPARING RECONSTRUCTION...`;

          setTimeout(() => {
            this.showTelescopeView('telescope-reconstruction-view');
            this.renderReconstructionBoard();
          }, 1200);
        };

        tm.startObservation(document.getElementById('telescope-2d-img'));
      };
    }

    // CIRCULAR RIGHT-ARROW NEXT PHASE BUTTON CLICK
    const nextPhaseBtn = document.getElementById('btn-tel-next-phase');
    if (nextPhaseBtn) {
      nextPhaseBtn.onclick = () => {
        if (tm.stage === 'OBSERVING') {
          tm.nextPhase();
        }
      };
    }

    // SUBMIT BUTTON CLICK
    if (submitBtn) {
      submitBtn.onclick = () => {
        if (submitBtn.classList.contains('disabled')) return;

        const res = tm.submitVerification();
        const toast = document.getElementById('telescope-toast');
        const toastContent = document.getElementById('telescope-toast-content');

        if (res.success) {
          if (res.isFirstTry) {
            // First-try victory: Full mission complete!
            if (toastContent) {
              toastContent.innerHTML = `
                <div style="color: #22c55e; font-size: 1.2rem; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 6px;">${Icons.check(18)} FIRST-TRY MASTERY ACHIEVED!</div>
                <div style="color: #cbd5e1; font-size: 0.9rem;">You reconstructed ${tm.selectedPlanet.name} perfectly on your first try!</div>
              `;
            }
            if (toast) toast.classList.remove('hidden');

            const compPlanet = document.getElementById('tel-complete-planet');
            if (compPlanet) compPlanet.textContent = `PLANET OBSERVED: ${tm.selectedPlanet.name.toUpperCase()}`;

            setTimeout(() => {
              if (toast) toast.classList.add('hidden');
              this.toggleModal('telescope-complete-modal', true);
            }, 800);
          } else {
            // Multi-try victory on this planet: return to selection screen to pick an uncompleted planet
            if (toastContent) {
              toastContent.innerHTML = `
                <div style="color: #f59e0b; font-size: 1.2rem; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 6px;">${Icons.check(18)} ${res.planetName.toUpperCase()} RECONSTRUCTED</div>
                <div style="color: #cbd5e1; font-size: 0.9rem;">Since this required retries, select a NEW planet to achieve First-Try Mastery!</div>
              `;
            }
            if (toast) toast.classList.remove('hidden');

            setTimeout(() => {
              if (toast) toast.classList.add('hidden');
              this.setupTelescopeUI();
            }, 2500);
          }
        } else {
          if (toastContent) {
            toastContent.innerHTML = `
              <div style="color: #ef4444; font-size: 1.2rem; margin-bottom: 4px;">OBSERVATION MISMATCH</div>
              <div style="color: #cbd5e1; font-size: 0.9rem;">The sequence does not match your recorded observation. Try again!</div>
            `;
          }
          if (toast) toast.classList.remove('hidden');

          // Highlight drop boxes red
          const boxes = document.querySelectorAll('.drop-box');
          boxes.forEach(b => b.classList.add('incorrect'));

          setTimeout(() => {
            if (toast) toast.classList.add('hidden');
            boxes.forEach(b => b.classList.remove('incorrect'));
          }, 2000);
        }
      };
    }
  }

  showTelescopeView(viewId) {
    const views = document.querySelectorAll('.telescope-view');
    views.forEach(v => {
      if (v.id === viewId) {
        v.classList.remove('hidden');
        v.classList.add('active');
      } else {
        v.classList.add('hidden');
        v.classList.remove('active');
      }
    });
  }

  renderReconstructionBoard() {
    const tm = TelescopeMissionInstance;
    const stackEl = document.getElementById('telescope-cards-stack');
    const boxes = document.querySelectorAll('.drop-box');

    // Clear boxes
    boxes.forEach(box => {
      box.classList.remove('occupied', 'drag-over', 'incorrect');
      box.innerHTML = `<span class="box-slot-num">${parseInt(box.dataset.slot) + 1}</span>`;
    });

    // Render ONLY the top card in deck stack
    if (stackEl) {
      stackEl.innerHTML = '';
      if (tm.deckCards.length > 0) {
        const topCardObj = tm.deckCards[0];
        const cardEl = this.createPhaseCardDOM(topCardObj);
        stackEl.appendChild(cardEl);
      } else {
        stackEl.innerHTML = `<div class="cards-stack-empty-msg">ALL CARDS PLACED</div>`;
      }
    }

    this.updateSubmitButtonState();
    this.setupDragAndDrop();
  }

  createPhaseCardDOM(cardObj) {
    const cardEl = document.createElement('div');
    cardEl.className = 'phase-card font-mono';

    // Store reference object on element
    cardEl._cardData = cardObj;

    cardEl.innerHTML = `
      <img class="phase-card-img" src="${cardObj.imgUrl}" alt="${cardObj.planetName}">
      <div class="phase-card-title">${cardObj.planetName}</div>
    `;

    return cardEl;
  }

  setupDragAndDrop() {
    const tm = TelescopeMissionInstance;
    const boxes = document.querySelectorAll('.drop-box');

    let draggedCard = null;
    let dragProxy = null;

    const onPointerDown = (e) => {
      const cardEl = e.target.closest('.phase-card');
      if (!cardEl) return;

      e.preventDefault();
      draggedCard = cardEl;

      // Create floating drag proxy with solitaire card dimensions (135x190)
      dragProxy = cardEl.cloneNode(true);
      dragProxy.classList.add('dragging');
      dragProxy.style.position = 'fixed';
      dragProxy.style.pointerEvents = 'none';
      dragProxy.style.zIndex = '10000';
      dragProxy.style.left = `${e.clientX - 67}px`;
      dragProxy.style.top = `${e.clientY - 95}px`;
      dragProxy.style.transform = 'scale(1.08)';
      document.body.appendChild(dragProxy);

      cardEl.style.opacity = '0.35';
    };

    const onPointerMove = (e) => {
      if (!dragProxy || !draggedCard) return;
      e.preventDefault();

      dragProxy.style.left = `${e.clientX - 67}px`;
      dragProxy.style.top = `${e.clientY - 95}px`;

      // Check drop box under pointer
      const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
      boxes.forEach(b => b.classList.remove('drag-over'));
      if (elemBelow) {
        const dropBox = elemBelow.closest('.drop-box');
        if (dropBox) dropBox.classList.add('drag-over');
      }
    };

    const onPointerUp = (e) => {
      if (!dragProxy || !draggedCard) return;

      const cardObj = draggedCard._cardData;
      const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
      boxes.forEach(b => b.classList.remove('drag-over'));

      let droppedSlotIdx = -1;
      if (elemBelow) {
        const dropBox = elemBelow.closest('.drop-box');
        if (dropBox) {
          droppedSlotIdx = parseInt(dropBox.dataset.slot);
        }
      }

      // Cleanup drag proxy
      if (dragProxy && dragProxy.parentNode) {
        dragProxy.parentNode.removeChild(dragProxy);
      }
      dragProxy = null;
      if (draggedCard) {
        draggedCard.style.opacity = '1';
      }

      if (droppedSlotIdx !== -1) {
        this.handleCardDrop(cardObj, droppedSlotIdx);
      } else {
        // Also support click-to-place: if clicked deck card, place in first empty slot
        const deckIdx = tm.deckCards.indexOf(cardObj);
        if (deckIdx !== -1) {
          const emptySlotIdx = tm.placedSlots.findIndex(s => s === null);
          if (emptySlotIdx !== -1) {
            this.handleCardDrop(cardObj, emptySlotIdx);
          }
        }
      }
      draggedCard = null;
    };

    // Remove old listeners and attach global pointer events
    if (this._telPointerMove) window.removeEventListener('pointermove', this._telPointerMove);
    if (this._telPointerUp) window.removeEventListener('pointerup', this._telPointerUp);

    this._telPointerMove = onPointerMove;
    this._telPointerUp = onPointerUp;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Attach pointerdown to deck cards & placed cards
    document.querySelectorAll('.phase-card').forEach(c => {
      c.onpointerdown = onPointerDown;
    });
  }

  handleCardDrop(cardObj, slotIdx, cardDomEl) {
    const tm = TelescopeMissionInstance;
    const success = tm.placeCardInSlot(cardObj, slotIdx);

    if (success) {
      // Re-render placed slots
      const boxes = document.querySelectorAll('.drop-box');
      boxes.forEach((box, idx) => {
        const slotCard = tm.placedSlots[idx];
        box.innerHTML = '';

        if (slotCard) {
          box.classList.add('occupied');
          const dom = this.createPhaseCardDOM(slotCard);
          box.appendChild(dom);
        } else {
          box.classList.remove('occupied');
          box.innerHTML = `<span class="box-slot-num">${idx + 1}</span>`;
        }
      });

      // Update stack deck (render top card only)
      const stackEl = document.getElementById('telescope-cards-stack');
      if (stackEl) {
        stackEl.innerHTML = '';
        if (tm.deckCards.length > 0) {
          const topCardObj = tm.deckCards[0];
          const dom = this.createPhaseCardDOM(topCardObj);
          stackEl.appendChild(dom);
        } else {
          stackEl.innerHTML = `<div class="cards-stack-empty-msg">ALL CARDS PLACED</div>`;
        }
      }

      this.updateSubmitButtonState();
      this.setupDragAndDrop();
    }
  }

  updateSubmitButtonState() {
    const tm = TelescopeMissionInstance;
    const submitBtn = document.getElementById('btn-tel-submit');
    if (!submitBtn) return;

    // Enable SUBMIT button ONLY when all 5 slots are filled with cards
    const allFilled = tm.placedSlots.every(slot => slot !== null);

    if (allFilled) {
      submitBtn.classList.remove('disabled');
      submitBtn.removeAttribute('disabled');
    } else {
      submitBtn.classList.add('disabled');
      submitBtn.setAttribute('disabled', 'true');
    }
  }
}

export const UIInstance = new UIManager();
export { UIManager };

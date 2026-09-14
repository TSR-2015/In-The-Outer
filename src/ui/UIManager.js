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
    this.setupEarthMoonMissionListeners();
    this.setupMarsMissionListeners();
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
      } else if (GameStateInstance.selectedSatelliteIndex >= 0) {
        GameStateInstance.changeState('SELECT');
      } else {
        GameStateInstance.changeState('EARTH_TO_MOON');
      }
    });

    // Modal close hooks
    bindBtn('btn-howto-close', () => this.toggleModal('howto-modal', false));
    bindBtn('btn-credits-close', () => this.toggleModal('credits-modal', false));
  }

  toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (modal) {
      if (show) {
        modal.classList.add('active');
      } else {
        modal.classList.remove('active');
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
        launchBtn.classList.remove('disabled');
        launchBtn.removeAttribute('disabled');
        
        AudioInstance.playClick();
      });

      grid.appendChild(card);
    });

    const launchBtn = document.getElementById('btn-launch-sequence');
    launchBtn.addEventListener('click', () => {
      if (this.selectedSat) {
        AudioInstance.playClick();
        GameStateInstance.selectedSatelliteIndex = this.selectedIdx;
        GameStateInstance.selectedSatData = JSON.parse(JSON.stringify(this.selectedSat));
        GameStateInstance.changeState('ORBIT');
      }
    });
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
        AudioInstance.playClick();
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
        AudioInstance.playClick();
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
    closeViewerBtn.addEventListener('click', () => {
      AudioInstance.playClick();
      this.toggleModal('photo-viewer-modal', false);
    });

    const saveViewerBtn = document.getElementById('btn-viewer-save');
    saveViewerBtn.addEventListener('click', () => {
      AudioInstance.playClick();
      this.downloadActivePhoto();
    });

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

    bindBtn('btn-progress-back', () => GameStateInstance.changeState('MENU'));

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
    if (completedVal) completedVal.textContent = `${completedCount} / 5`;

    // Populate mission cards
    const cardsList = document.getElementById('mission-cards-list');
    if (!cardsList) return;
    
    cardsList.innerHTML = '';

    const missionNames = {
      mission_1: "Heliophysics Expedition (Solar Sentinel)",
      mission_2: "Earth to Moon Flight Sequence",
      mission_3: "Mars Lander Probe Injection",
      mission_4: "Voyager Deep Space Escape Corridor",
      mission_5: "Europa Ice Core Cryo-Drilling"
    };

    for (let i = 1; i <= 5; i++) {
      const id = `mission_${i}`;
      const m = progressData[id];
      if (!m) continue;

      const card = document.createElement('div');
      card.className = `mission-card ${m.unlocked ? '' : 'locked'}`;
      
      let statusText = "LOCKED";
      if (m.completed) {
        statusText = "✓ COMPLETED";
      } else if (m.unlocked) {
        statusText = "▶ UNLOCKED";
      }

      // Draw star shapes based on score/stars count
      let starsHtml = "";
      if (m.completed) {
        const starCount = m.stars || 3;
        for (let s = 0; s < 3; s++) {
          starsHtml += s < starCount ? "★" : "☆";
        }
      } else {
        starsHtml = "☆☆☆";
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
            GameStateInstance.selectedSatelliteIndex = -1; // resets solar sentinel reference
            GameStateInstance.changeState('EARTH_TO_MOON');
          } else if (i === 3) {
            GameStateInstance.changeState('MARS_ROVER');
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

    // Mouse click listener for green soil zones during robotic arm test tube sampling
    window.addEventListener('click', (e) => {
      if (GameStateInstance.currentState !== 'MARS_ROVER') return;
      if (!MarsRoverMissionInstance.inSamplingMode) return;

      // Ignore UI panel clicks
      if (e.target.closest('#mars-hud') || e.target.closest('.modal') || e.target.closest('#audio-toggle')) {
        return;
      }

      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, CameraInstance.activeCamera);

      const targets = MarsRoverSceneInstance.greenSoilMeshes;
      if (targets && targets.length > 0) {
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length > 0) {
          const hitObj = intersects[0].object;
          const zoneIdx = hitObj.userData && hitObj.userData.zoneIndex !== undefined ? hitObj.userData.zoneIndex : 0;
          MarsRoverMissionInstance.sampleSoilZone(zoneIdx);
        }
      }
    });
  }

  updateMarsHUD() {
    const m = MarsRoverMissionInstance;

    const regEl = document.getElementById('mars-hud-region');
    if (regEl) regEl.textContent = m.currentRegion.toUpperCase();

    const batEl = document.getElementById('mars-hud-battery');
    if (batEl) batEl.textContent = `${Math.floor(m.telemetry.battery)}%`;

    const batFill = document.getElementById('mars-hud-battery-fill');
    if (batFill) batFill.style.width = `${m.telemetry.battery}%`;

    const speedEl = document.getElementById('mars-hud-speed');
    if (speedEl) speedEl.textContent = `${m.roverSpeed.toFixed(1)} m/s`;

    const tempEl = document.getElementById('mars-hud-temp');
    if (tempEl) tempEl.textContent = `${m.telemetry.temp}°C`;

    const windEl = document.getElementById('mars-hud-wind');
    if (windEl) windEl.textContent = `${m.telemetry.wind} km/h`;

    const dustEl = document.getElementById('mars-hud-dust');
    if (dustEl) dustEl.textContent = m.telemetry.dust.toUpperCase();

    const radEl = document.getElementById('mars-hud-rad');
    if (radEl) radEl.textContent = `${m.telemetry.radiation.toFixed(2)} mSv/h`;

    const objEl = document.getElementById('mars-hud-objective');
    if (objEl) objEl.textContent = m.currentObjective;

    const progressFill = document.getElementById('mars-hud-progress-fill');
    if (progressFill) progressFill.style.width = `${m.progress}%`;

    const photoStat = document.getElementById('mars-stat-photos');
    if (photoStat) photoStat.textContent = `${m.photos.length}/3`;

    const sampleStat = document.getElementById('mars-stat-samples');
    if (sampleStat) sampleStat.textContent = `${m.samples.length}/3`;

    const scanStat = document.getElementById('mars-stat-scans');
    if (scanStat) scanStat.textContent = `${m.scannedRegions.size}/3`;

    const regionStat = document.getElementById('mars-stat-regions');
    if (regionStat) regionStat.textContent = `${m.discoveredRegions.size}/4`;

    this.drawMarsMinimap();
  }

  drawMarsMinimap() {
    const canvas = document.getElementById('mars-minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw radar circles
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 1;
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 28, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 56, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    const m = MarsRoverMissionInstance;
    const scale = 0.55; // 1 unit in game = 0.55 px on map

    const worldToCanvas = (wx, wz) => {
      const px = centerX + (wx - m.roverPos.x) * scale;
      const py = centerY + (wz - m.roverPos.z) * scale;
      return { px, py };
    };

    // Draw sample points
    m.samplePoints.forEach(sp => {
      const { px, py } = worldToCanvas(sp.x, sp.z);
      if (px >= 0 && px <= width && py >= 0 && py <= height) {
        ctx.fillStyle = sp.collected ? '#94a3b8' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, sp.collected ? 3 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Research Anomaly Zone
    const resZone = worldToCanvas(-75, -70);
    if (resZone.px >= 0 && resZone.px <= width && resZone.py >= 0 && resZone.py <= height) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(resZone.px, resZone.py, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Rover marker (Center arrow)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(m.roverAngle);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(5, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  showMarsDiscoveryToast(disc) {
    const titleEl = document.getElementById('discovery-toast-title');
    const descEl = document.getElementById('discovery-toast-desc');
    if (titleEl) titleEl.textContent = `★ ${disc.title.toUpperCase()} ★`;
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
}

export const UIInstance = new UIManager();
export { UIManager };

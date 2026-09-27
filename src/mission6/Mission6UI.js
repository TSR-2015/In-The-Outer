import { Mission6StateInstance } from './Mission6State.js';
import { MercurySceneInstance } from './MercuryScene.js';
import { ObservationSystemInstance } from './ObservationSystem.js';
import { AudioInstance } from '../managers/AudioManager.js';
import { GameStateInstance } from '../managers/GameStateManager.js';
import { ProgressInstance } from '../managers/ProgressManager.js';

class Mission6UI {
  constructor() {
    this.isInitialized = false;
    this.toastTimer = null;
  }

  init() {
    if (this.isInitialized) return;

    this.bindButtons();
    this.setupStateCallbacks();
    this.isInitialized = true;
  }

  bindButtons() {
    // Briefing start
    const btnStart = document.getElementById('btn-m6-start-orbit');
    if (btnStart) {
      btnStart.onclick = () => {
        AudioInstance.playClick();
        this.hideElement('mission6-briefing');
        this.showElement('mission6-hud');
        MercurySceneInstance.onWindowResize();
        Mission6StateInstance.startOrbitGameplay();
      };
    }

    // Capture Photo
    const btnPhoto = document.getElementById('btn-m6-capture-photo');
    if (btnPhoto) {
      btnPhoto.onclick = () => {
        AudioInstance.playClick();
        this.handlePhotoCapture();
      };
    }

    // Run Science Scan
    const btnScan = document.getElementById('btn-m6-run-scan');
    if (btnScan) {
      btnScan.onclick = () => {
        AudioInstance.playClick();
        this.handleScienceScan();
      };
    }

    // Camera Mode Controls
    const btnCamProbe = document.getElementById('btn-m6-cam-probe');
    const btnCamFree = document.getElementById('btn-m6-cam-free');
    const btnCamPlanet = document.getElementById('btn-m6-cam-planet');

    if (btnCamProbe) {
      btnCamProbe.onclick = () => {
        AudioInstance.playClick();
        MercurySceneInstance.setCameraMode('probe');
        this.setActiveCamBtn('btn-m6-cam-probe');
      };
    }
    if (btnCamFree) {
      btnCamFree.onclick = () => {
        AudioInstance.playClick();
        MercurySceneInstance.setCameraMode('free');
        this.setActiveCamBtn('btn-m6-cam-free');
      };
    }
    if (btnCamPlanet) {
      btnCamPlanet.onclick = () => {
        AudioInstance.playClick();
        MercurySceneInstance.setCameraMode('planet');
        this.setActiveCamBtn('btn-m6-cam-planet');
      };
    }

    // Telemetry Modal Action (Descent)
    const btnDescent = document.getElementById('btn-m6-trigger-descent');
    if (btnDescent) {
      btnDescent.onclick = () => {
        AudioInstance.playClick();
        this.hideElement('mission6-telemetry-modal');
        Mission6StateInstance.startImpactDescent();
        MercurySceneInstance.triggerImpactSequence(() => {
          Mission6StateInstance.triggerVictory();
        });
      };
    }

    // Victory Modal Buttons
    const btnRestart = document.getElementById('btn-m6-restart');
    if (btnRestart) {
      btnRestart.onclick = () => {
        AudioInstance.playClick();
        this.hideElement('mission6-complete-modal');
        this.hideElement('m6-photo-result-card');
        this.hideElement('m6-scan-result-card');
        ObservationSystemInstance.resetTargets();
        Mission6StateInstance.startMission();
        const container = document.getElementById('mission6-canvas-container');
        if (container) MercurySceneInstance.init(container);
        this.showElement('mission6-briefing');
        this.hideElement('mission6-hud');
      };
    }

    const btnMissionTab = document.getElementById('btn-m6-mission-tab');
    if (btnMissionTab) {
      btnMissionTab.onclick = () => {
        AudioInstance.playClick();
        this.hideElement('mission6-complete-modal');
        GameStateInstance.changeState('PROGRESS');
      };
    }
  }

  setActiveCamBtn(activeId) {
    ['btn-m6-cam-probe', 'btn-m6-cam-free', 'btn-m6-cam-planet'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === activeId) {
          el.classList.add('bg-cyan-500/40', 'border-cyan-400', 'text-cyan-200');
          el.classList.remove('bg-slate-900/60', 'border-cyan-900/50', 'text-slate-400');
        } else {
          el.classList.remove('bg-cyan-500/40', 'border-cyan-400', 'text-cyan-200');
          el.classList.add('bg-slate-900/60', 'border-cyan-900/50', 'text-slate-400');
        }
      }
    });
  }

  setupStateCallbacks() {
    Mission6StateInstance.onUIUpdate = () => {
      this.updateHUD();
    };

    Mission6StateInstance.onNotification = (msg, type) => {
      this.showToast(msg, type);
    };

    Mission6StateInstance.onPhotoResult = (target) => {
      this.renderPhotoCard(target);
    };

    Mission6StateInstance.onScanResult = (target) => {
      this.renderScanCard(target);
    };

    Mission6StateInstance.onTelemetryReady = () => {
      AudioInstance.playSuccess();
      this.hideElement('mission6-hud');
      this.showElement('mission6-telemetry-modal');
    };

    Mission6StateInstance.onMissionComplete = () => {
      AudioInstance.playSuccess();
      const totalSeconds = Math.floor(Mission6StateInstance.elapsedTime);
      const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
      const secs = String(totalSeconds % 60).padStart(2, '0');
      ProgressInstance.completeMission('mission_6', Mission6StateInstance.score, 3, `${mins}:${secs}`);
      this.renderVictoryModal();
    };
  }

  handlePhotoCapture() {
    const probePos = MercurySceneInstance.probeGroup ? MercurySceneInstance.probeGroup.position : null;
    ObservationSystemInstance.update(probePos, MercurySceneInstance.orbitAngle);
    const activeInfo = ObservationSystemInstance.getActiveTarget();

    if (!activeInfo.target) {
      this.showToast('NO TARGET IN ORBITAL FIELD', 'error');
      return;
    }

    if (!activeInfo.isLocked) {
      AudioInstance.playAlarm();
      this.showToast(`ALIGNMENT REQUIRED — Target ${activeInfo.target.name} is ${activeInfo.distanceKm} km away (Lock requires < 480 km)`, 'warning');
      return;
    }

    const success = Mission6StateInstance.recordPhotoCapture(activeInfo.target);
    if (success) {
      AudioInstance.playClick();
      this.triggerFlashEffect();
    }
  }

  handleScienceScan() {
    const probePos = MercurySceneInstance.probeGroup ? MercurySceneInstance.probeGroup.position : null;
    ObservationSystemInstance.update(probePos, MercurySceneInstance.orbitAngle);
    const activeInfo = ObservationSystemInstance.getActiveTarget();

    if (!activeInfo.target) {
      this.showToast('NO TARGET IN ORBITAL FIELD', 'error');
      return;
    }

    if (!activeInfo.isLocked) {
      AudioInstance.playAlarm();
      this.showToast(`ALIGNMENT REQUIRED — Target ${activeInfo.target.name} is ${activeInfo.distanceKm} km away (Lock requires < 480 km)`, 'warning');
      return;
    }

    const success = Mission6StateInstance.recordScienceScan(activeInfo.target);
    if (success) {
      AudioInstance.playBeep();
      this.triggerScanBeamEffect();
    }
  }

  triggerFlashEffect() {
    const flashEl = document.getElementById('m6-shutter-flash');
    if (flashEl) {
      flashEl.classList.remove('opacity-0');
      flashEl.classList.add('opacity-90');
      setTimeout(() => {
        flashEl.classList.remove('opacity-90');
        flashEl.classList.add('opacity-0');
      }, 250);
    }
  }

  triggerScanBeamEffect() {
    const beamEl = document.getElementById('m6-scan-beam-effect');
    if (beamEl) {
      beamEl.classList.remove('hidden');
      beamEl.classList.add('animate-pulse');
      setTimeout(() => {
        beamEl.classList.add('hidden');
        beamEl.classList.remove('animate-pulse');
      }, 1500);
    }
  }

  updateHUD() {
    const photosEl = document.getElementById('m6-photo-count');
    const scienceEl = document.getElementById('m6-science-count');
    const timeEl = document.getElementById('m6-elapsed-time');
    const photosBar = document.getElementById('m6-photo-bar');
    const scienceBar = document.getElementById('m6-science-bar');

    if (photosEl) photosEl.textContent = `${Mission6StateInstance.photosCount} / ${Mission6StateInstance.targetPhotos}`;
    if (scienceEl) scienceEl.textContent = `${Mission6StateInstance.scienceCount} / ${Mission6StateInstance.targetScience}`;

    const totalSeconds = Math.floor(Mission6StateInstance.elapsedTime);
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    if (timeEl) timeEl.textContent = `${mins}:${secs}`;

    if (photosBar) photosBar.style.width = `${(Mission6StateInstance.photosCount / Mission6StateInstance.targetPhotos) * 100}%`;
    if (scienceBar) scienceBar.style.width = `${(Mission6StateInstance.scienceCount / Mission6StateInstance.targetScience) * 100}%`;
  }

  update(delta, time) {
    if (Mission6StateInstance.phase !== 'ORBIT') return;

    const probePos = MercurySceneInstance.probeGroup ? MercurySceneInstance.probeGroup.position : null;
    ObservationSystemInstance.update(probePos, MercurySceneInstance.orbitAngle);
    const activeInfo = ObservationSystemInstance.getActiveTarget();

    const targetNameEl = document.getElementById('m6-target-name');
    const targetCoordsEl = document.getElementById('m6-target-coords');
    const targetDistEl = document.getElementById('m6-target-dist');
    const reticleStatusEl = document.getElementById('m6-reticle-status');
    const reticleBox = document.getElementById('m6-hud-reticle');

    if (activeInfo.target) {
      if (targetNameEl) targetNameEl.textContent = activeInfo.target.name;
      if (targetCoordsEl) targetCoordsEl.textContent = `${activeInfo.target.lat} | ${activeInfo.target.lon}`;
      if (targetDistEl) targetDistEl.textContent = `${activeInfo.distanceKm} KM`;

      if (reticleBox && reticleStatusEl) {
        reticleBox.classList.remove('border-red-500', 'border-yellow-400', 'border-emerald-400', 'shadow-red-500/40', 'shadow-emerald-500/40');
        if (activeInfo.lockState === 'LOCKED') {
          reticleBox.classList.add('border-emerald-400', 'shadow-emerald-500/40');
          reticleStatusEl.textContent = '[ RETICLE LOCKED — READY ]';
          reticleStatusEl.className = 'text-emerald-400 font-bold tracking-widest text-xs animate-pulse';
        } else if (activeInfo.lockState === 'APPROACHING') {
          reticleBox.classList.add('border-yellow-400');
          reticleStatusEl.textContent = '[ APPROACHING LOCK RANGE ]';
          reticleStatusEl.className = 'text-yellow-400 font-bold tracking-widest text-xs';
        } else {
          reticleBox.classList.add('border-red-500', 'shadow-red-500/40');
          reticleStatusEl.textContent = '[ ALIGNMENT REQUIRED ]';
          reticleStatusEl.className = 'text-red-400 font-bold tracking-widest text-xs';
        }
      }
    }
  }

  renderPhotoCard(target) {
    const card = document.getElementById('m6-photo-result-card');
    if (!card) return;

    const imgContainer = document.getElementById('m6-photo-img-container');
    const titleEl = document.getElementById('m6-photo-title');
    const coordsEl = document.getElementById('m6-photo-coords');
    const closeBtn = document.getElementById('m6-photo-close-btn');

    if (titleEl) titleEl.textContent = target.name.toUpperCase();
    if (coordsEl) coordsEl.textContent = `LAT: ${target.lat} | LON: ${target.lon} | TYPE: ${target.type}`;

    if (imgContainer) {
      imgContainer.innerHTML = '';
      const snapCanvas = MercurySceneInstance.captureSnapshot(400, 400);
      if (snapCanvas) {
        snapCanvas.className = 'w-full h-full object-cover rounded border border-cyan-500/30';
        imgContainer.appendChild(snapCanvas);
      }
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        AudioInstance.playClick();
        this.hideElement('m6-photo-result-card');
      };
    }

    this.showElement('m6-photo-result-card');
  }

  renderScanCard(target) {
    const card = document.getElementById('m6-scan-result-card');
    if (!card) return;

    const titleEl = document.getElementById('m6-scan-title');
    const compEl = document.getElementById('m6-scan-composition');
    const fluxEl = document.getElementById('m6-scan-flux');
    const closeBtn = document.getElementById('m6-scan-close-btn');

    if (titleEl) titleEl.textContent = target.name.toUpperCase();
    if (compEl) compEl.textContent = target.composition;
    if (fluxEl) fluxEl.textContent = target.magFlux;

    if (closeBtn) {
      closeBtn.onclick = () => {
        AudioInstance.playClick();
        this.hideElement('m6-scan-result-card');
      };
    }

    this.showElement('m6-scan-result-card');
  }

  renderVictoryModal() {
    this.hideElement('mission6-hud');
    this.showElement('mission6-complete-modal');

    const totalSeconds = Math.floor(Mission6StateInstance.elapsedTime);
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');

    const scoreEl = document.getElementById('m6-final-score');
    const photosEl = document.getElementById('m6-final-photos');
    const scienceEl = document.getElementById('m6-final-science');
    const timeEl = document.getElementById('m6-final-time');

    if (scoreEl) scoreEl.textContent = `${Mission6StateInstance.score} PTS`;
    if (photosEl) photosEl.textContent = `${Mission6StateInstance.photosCount} / ${Mission6StateInstance.targetPhotos}`;
    if (scienceEl) scienceEl.textContent = `${Mission6StateInstance.scienceCount} / ${Mission6StateInstance.targetScience}`;
    if (timeEl) timeEl.textContent = `${mins}:${secs}`;
  }

  showToast(msg, type = 'info') {
    const toast = document.getElementById('m6-notification');
    if (!toast) return;

    toast.textContent = msg;
    toast.className = `fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg text-sm font-mono tracking-wide shadow-xl border backdrop-blur-md transition-all duration-300 ${
      type === 'error' ? 'bg-red-900/90 text-red-200 border-red-500' :
      type === 'warning' ? 'bg-amber-900/90 text-amber-200 border-amber-500' :
      'bg-cyan-950/90 text-cyan-200 border-cyan-500/60'
    }`;

    toast.classList.remove('hidden', 'opacity-0');
    toast.classList.add('opacity-100');

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('opacity-100');
      toast.classList.add('opacity-0');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3800);
  }

  showElement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    if (id.includes('modal') || id.includes('card')) {
      el.style.display = 'flex';
    }
  }

  hideElement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
  }
}

export const Mission6UIInstance = new Mission6UI();
export { Mission6UI };

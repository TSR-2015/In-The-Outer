import * as THREE from 'three';
import { AudioInstance } from '../managers/AudioManager.js';

class MissionManager {
  constructor() {
    this.activeSatellite = null;
    this.score = 0;
    this.missionTimer = 0;
    this.isPaused = false;
    this.isFinished = false;
    
    this.gameSpeed = 2.0;

    // SVG Grayscale Charts Data
    this.chartData = {
      rad: Array(30).fill(40),
      mag: Array(30).fill(30),
      wind: Array(30).fill(50)
    };

    this.uiUpdateCallback = null;
    this.notificationCallback = null;
    this.photoReelCallback = null;
    this.captureEffectCallback = null;
    this.completeCallback = null;

    // Cache of high-res canvas draw data for downloads
    this.capturedPhotoData = {};
    this.capturedObservations = {};
  }

  setupMission(selectedSatData) {
    this.score = 0;
    this.missionTimer = 0;
    this.isPaused = false;
    this.isFinished = false;
    this.capturedPhotoData = {};
    this.capturedObservations = {};

    this.activeSatellite = {
      ...selectedSatData,
      health: 100,
      battery: 100,
      signal: 95,
      temp: 5778, // Effective Kelvin temperature of Sun
      windSpeed: 400, // km/s
      magFlux: 4.2, // Gauss
      distanceFromSun: 0.34, // AU; the observation arc closes in gradually
      radiation: 0.0, // W/m², calculated below from solar distance
      solarActivity: 'QUIET',
      
      // Numerical collection percentages
      photoProgress: 0,
      tempProgress: 0,
      windProgress: 0,
      
      capturedImages: [],
      orbitRadius: selectedSatData.orbitRadius || 48,
      orbitSpeed: selectedSatData.orbitSpeed || 0.45,
      angle: 0,
      mesh: selectedSatData.mesh || null
    };
  }

  // PHOTOGRAPHY SYSTEM (CAPTURER)
  capturePhoto() {
    const sat = this.activeSatellite;
    if (!sat || this.isPaused || this.isFinished) return;

    if (sat.capturedImages.length >= 5) {
      this.pushNotification("IMAGE REEL STORAGE FULL (MAX 5)", "info");
      return;
    }

    const fileIndex = sat.capturedImages.length + 1;
    const filename = `SDO_EUV_BANDPASS_${171 + fileIndex*22}A_IMG_${fileIndex}.PNG`;
    
    // Freeze the observation moment briefly so the capture feels intentional.
    this.isPaused = true;
    if (this.captureEffectCallback) this.captureEffectCallback();
    window.setTimeout(() => { this.isPaused = false; }, 350);

    // Generate a deterministic scientific-style solar observation, not abstract noise.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Black background space
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, 512, 512);

    const observation = this.getObservationSnapshot();
    const grad = ctx.createRadialGradient(235, 225, 8, 256, 256, 200);
    grad.addColorStop(0, '#fffbe6');
    grad.addColorStop(0.52, '#ffd35a');
    grad.addColorStop(0.86, '#ef8d20');
    grad.addColorStop(1, '#8d310b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 200, 0, Math.PI * 2);
    ctx.fill();

    // Granulation cells and a few stable active regions give the disk a solar surface.
    let seed = 73856093 * fileIndex;
    const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    ctx.save();
    ctx.beginPath();
    ctx.arc(256, 256, 198, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 650; i++) {
      const angle = next() * Math.PI * 2;
      const dist = Math.sqrt(next()) * 192;
      const x = 256 + Math.cos(angle) * dist;
      const y = 256 + Math.sin(angle) * dist;
      const radius = 0.8 + next() * 2.8;
      ctx.fillStyle = next() > 0.48 ? 'rgba(255,255,210,0.24)' : 'rgba(122,43,6,0.16)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Believable sunspot groups: dark umbra surrounded by softer penumbra.
    for (let i = 0; i < 3; i++) {
      const angle = next() * Math.PI * 2;
      const dist = 35 + next() * 110;
      const x = 256 + Math.cos(angle) * dist;
      const y = 256 + Math.sin(angle) * dist;
      const r = 6 + next() * 9;
      ctx.fillStyle = 'rgba(95,35,8,0.45)'; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(34,16,7,0.78)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Add HUD overlay telemetry marks onto photo
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`IN THE OUTER // TELEMETRY FRAME ${fileIndex}`, 20, 35);
    ctx.fillText(`FILTER: SDO_EUV_${171 + fileIndex*22}A`, 20, 55);
    ctx.fillText(`OBSERVATION: ${observation.time}`, 20, 75);
    ctx.fillText(`TEMP ${observation.temperature} K  |  RAD ${observation.radiation} W/m²`, 20, 475);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(10, 10, 492, 492);

    // Save canvas data in dictionary cache for the download viewer
    this.capturedPhotoData[filename] = canvas;
    this.capturedObservations[filename] = observation;

    sat.capturedImages.push(filename);
    sat.photoProgress = (sat.capturedImages.length / 5) * 100;
    
    AudioInstance.playScienceBeep();
    this.pushNotification(`CAPTURED SNAPSHOT: ${filename}`, 'info');
    
    this.score += 1200;

    if (this.photoReelCallback) {
      this.photoReelCallback(filename, canvas);
    }
  }

  pushNotification(text, type = 'info') {
    if (this.notificationCallback) {
      this.notificationCallback(text, type);
    }
  }

  // Telemetry update tick
  update(delta) {
    if (this.isPaused || this.isFinished || !this.activeSatellite) return;

    const dt = delta * this.gameSpeed;
    this.missionTimer += delta;

    const sat = this.activeSatellite;

    // 1. Orbital position math
    sat.angle += dt * sat.orbitSpeed * 0.1;
    if (sat.mesh) {
      sat.mesh.position.set(
        Math.cos(sat.angle) * sat.orbitRadius,
        0,
        Math.sin(sat.angle) * sat.orbitRadius
      );
      // Face towards Sun
      sat.mesh.lookAt(0, 0, 0);
      sat.mesh.rotation.y += Math.PI / 2; // correct facing angle offset
    }

    // A controlled observation model: values evolve smoothly as the probe approaches.
    const approach = Math.min(1, this.missionTimer / 150);
    sat.distanceFromSun = 0.34 - approach * 0.09;
    sat.radiation = Math.round(1361 / (sat.distanceFromSun * sat.distanceFromSun));
    sat.temp = Math.round(5772 + approach * 10 + Math.sin(this.missionTimer * 0.12) * 2);
    sat.windSpeed = Math.round(385 + approach * 45 + Math.sin(this.missionTimer * 0.16) * 7);
    sat.magFlux = (3.8 + approach * 0.9 + Math.sin(this.missionTimer * 0.1) * 0.08).toFixed(2);
    sat.solarActivity = sat.magFlux > 4.35 ? 'ACTIVE REGION' : 'QUIET SUN';

    // 3. Sequential progress data accumulation (only collect telemetry after photos are completed)
    if (sat.photoProgress >= 100) {
      if (sat.tempProgress < 100) {
        sat.tempProgress = Math.min(100, sat.tempProgress + dt * 4.0); // fills after photos done
        if (sat.tempProgress >= 100) {
          this.pushNotification("THERMAL PROFILE COMPLETE", "info");
          this.score += 2000;
        }
      }

      if (sat.windProgress < 100) {
        sat.windProgress = Math.min(100, sat.windProgress + dt * 3.0);
        if (sat.windProgress >= 100) {
          this.pushNotification("SOLAR WIND PROFILE COMPLETE", "info");
          this.score += 2000;
        }
      }
    } else {
      sat.tempProgress = 0;
      sat.windProgress = 0;
    }

    // Battery slow draw/recharge
    sat.battery = Math.min(100, Math.max(70, 95 + Math.sin(this.missionTimer) * 5));
    sat.signal = Math.floor(95 + Math.sin(this.missionTimer * 0.2) * 4);

    // 4. Check for success
    if (sat.photoProgress >= 100 && sat.tempProgress >= 100 && sat.windProgress >= 100 && !this.isFinished) {
      this.isFinished = true;
      this.pushNotification("ALL STELLAR TELEMETRIES SECURED!", "info");
      this.score += 5000;
      setTimeout(() => {
        if (this.completeCallback) this.completeCallback();
      }, 1500);
    }

    // 5. Update Charts
    this.updateCharts(dt);

    if (this.uiUpdateCallback) {
      this.uiUpdateCallback();
    }
  }

  updateCharts(dt) {
    const pushVal = (arr, value) => {
      arr.shift();
      arr.push(value);
    };
    const sat = this.activeSatellite;
    if (!sat) return;
    pushVal(this.chartData.rad, Math.min(95, 25 + sat.radiation / 450));
    pushVal(this.chartData.mag, Math.min(95, 20 + Number(sat.magFlux) * 12));
    pushVal(this.chartData.wind, Math.min(95, 20 + sat.windSpeed / 8));
  }

  getObservationSnapshot() {
    const sat = this.activeSatellite;
    return {
      temperature: sat.temp,
      radiation: sat.radiation.toLocaleString(),
      distance: sat.distanceFromSun.toFixed(3),
      activity: sat.solarActivity,
      time: new Date().toLocaleTimeString(),
      status: 'IN THE OUTER // NOMINAL'
    };
  }
}

export const MissionInstance = new MissionManager();
export { MissionManager };

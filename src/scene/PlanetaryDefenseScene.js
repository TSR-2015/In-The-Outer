import { PlanetaryDefenseVisualsInstance } from './PlanetaryDefenseVisuals.js';

class PlanetaryDefenseScene {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.animFrameId = null;

    this.currentSceneData = null;
    this.time = 0;

    // Cinematic Camera Properties
    this.cameraZoom = 1.0;
    this.targetZoom = 1.0;
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.targetOffsetX = 0;
    this.targetOffsetY = 0;

    // Camera Shake
    this.shakeIntensity = 0;

    // Starfield
    this.stars = [];
    this.initStarfield();

    // Kinetic Impact Particle Ejecta
    this.particles = [];

    // Image caches to avoid re-rendering canvases every frame
    this.cachedImages = {};
  }

  initStarfield() {
    this.stars = [];
    for (let i = 0; i < 220; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2.2 + 0.4,
        speed: Math.random() * 0.04 + 0.01,
        alpha: Math.random() * 0.7 + 0.3
      });
    }
  }

  init(containerEl) {
    this.container = containerEl;
    if (!this.container) return;

    this.container.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.container.clientWidth || 1280;
    this.canvas.height = this.container.clientHeight || 720;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    window.addEventListener('resize', this.onResize.bind(this));
    this.startAnimationLoop();
  }

  onResize() {
    if (!this.container || !this.canvas) return;
    this.canvas.width = this.container.clientWidth || 1280;
    this.canvas.height = this.container.clientHeight || 720;
  }

  setSceneData(sceneData) {
    this.currentSceneData = sceneData;
    this.time = 0;

    // Configure camera targets based on the specific scene
    const bgId = sceneData ? sceneData.bgId : 'BG_A_MISSION_CONTROL';
    this.configureCameraForBackground(bgId);

    // If kinetic impact or fragmentation, trigger dynamic camera effects
    if (bgId === 'BG_F_KINETIC_IMPACT' && sceneData.title.includes('EXECUTION')) {
      this.triggerImpactShake();
    } else if (bgId === 'BG_H_FRAGMENTATION') {
      this.triggerFragmentationPullback();
    }
  }

  configureCameraForBackground(bgId) {
    switch (bgId) {
      case 'BG_A_MISSION_CONTROL':
        this.targetZoom = 1.06;
        this.targetOffsetX = 0;
        this.targetOffsetY = -15;
        break;

      case 'BG_B_ASTEROID_TRACKING':
        this.targetZoom = 1.18;
        this.targetOffsetX = 50;
        this.targetOffsetY = 0;
        break;

      case 'BG_C_RECONNAISSANCE':
        this.targetZoom = 1.05;
        this.targetOffsetX = -30;
        this.targetOffsetY = 0;
        break;

      case 'BG_D_ASTEROID_SURFACE':
        this.targetZoom = 1.25;
        this.targetOffsetX = 0;
        this.targetOffsetY = 30;
        break;

      case 'BG_E_INTERNAL_STRUCTURE':
        this.targetZoom = 1.1;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        break;

      case 'BG_F_KINETIC_IMPACT':
        this.targetZoom = 1.2;
        this.targetOffsetX = 40;
        this.targetOffsetY = 0;
        break;

      case 'BG_G_GRAVITY_TRACTOR':
        this.targetZoom = 1.08;
        this.targetOffsetX = -20;
        this.targetOffsetY = 0;
        break;

      case 'BG_H_FRAGMENTATION':
        this.targetZoom = 0.92; // Pull back to show diverging cloud
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        break;

      case 'BG_I_SAMPLE_COLLECTION':
        this.targetZoom = 1.15;
        this.targetOffsetX = 30;
        this.targetOffsetY = -20;
        break;

      case 'BG_J_SAMPLE_ANALYSIS':
        this.targetZoom = 1.05;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        break;

      default:
        this.targetZoom = 1.0;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
    }
  }

  triggerImpactShake() {
    this.shakeIntensity = 22;
    this.particles = [];
    const w = this.canvas ? this.canvas.width : 1280;
    const h = this.canvas ? this.canvas.height : 720;
    const impactX = w * 0.72;
    const impactY = h * 0.38;

    // Generate collision ejecta particles
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      this.particles.push({
        x: impactX,
        y: impactY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 1.5,
        color: Math.random() > 0.4 ? '#f59e0b' : '#ef4444',
        alpha: 1.0
      });
    }
  }

  triggerFragmentationPullback() {
    this.targetZoom = 0.85;
    this.shakeIntensity = 8;
  }

  startAnimationLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const render = () => {
      this.time += 0.016;
      this.updateCamera();
      this.draw();
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  updateCamera() {
    this.cameraZoom += (this.targetZoom - this.cameraZoom) * 0.04;
    this.cameraOffsetX += (this.targetOffsetX - this.cameraOffsetX) * 0.04;
    this.cameraOffsetY += (this.targetOffsetY - this.cameraOffsetY) * 0.04;

    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= 0.9;
      if (this.shakeIntensity < 0.2) this.shakeIntensity = 0;
    }

    // Update Ejecta Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.015;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);

    // Apply Camera Zoom, Offset, and Impact Shake
    this.ctx.save();

    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    this.ctx.translate(w / 2 + this.cameraOffsetX + shakeX, h / 2 + this.cameraOffsetY + shakeY);
    this.ctx.scale(this.cameraZoom, this.cameraZoom);
    this.ctx.translate(-w / 2, -h / 2);

    const bgId = this.currentSceneData ? this.currentSceneData.bgId : 'BG_A_MISSION_CONTROL';

    // Render corresponding Background
    switch (bgId) {
      case 'BG_A_MISSION_CONTROL':
        this.drawBackgroundA_MissionControl(w, h);
        break;

      case 'BG_B_ASTEROID_TRACKING':
        this.drawBackgroundB_AsteroidTracking(w, h);
        break;

      case 'BG_C_RECONNAISSANCE':
        this.drawBackgroundC_Reconnaissance(w, h);
        break;

      case 'BG_D_ASTEROID_SURFACE':
        this.drawBackgroundD_AsteroidSurface(w, h);
        break;

      case 'BG_E_INTERNAL_STRUCTURE':
        this.drawBackgroundE_InternalStructure(w, h);
        break;

      case 'BG_F_KINETIC_IMPACT':
        this.drawBackgroundF_KineticImpact(w, h);
        break;

      case 'BG_G_GRAVITY_TRACTOR':
        this.drawBackgroundG_GravityTractor(w, h);
        break;

      case 'BG_H_FRAGMENTATION':
        this.drawBackgroundH_Fragmentation(w, h);
        break;

      case 'BG_I_SAMPLE_COLLECTION':
        this.drawBackgroundI_SampleCollection(w, h);
        break;

      case 'BG_J_SAMPLE_ANALYSIS':
        this.drawBackgroundJ_SampleAnalysis(w, h);
        break;

      default:
        this.drawBackgroundA_MissionControl(w, h);
    }

    // Render Ejecta Particles if any
    this.drawParticles();

    // Render Mission Control Tactical HUD Frame
    this.drawTacticalHUD(w, h);

    this.ctx.restore();
  }

  // -------------------------------------------------------------
  // BACKGROUND A: PRIMARY MISSION CONTROL
  // -------------------------------------------------------------
  drawBackgroundA_MissionControl(w, h) {
    // Deep dark blue mission control lighting
    const bgGrad = this.ctx.createRadialGradient(w * 0.5, h * 0.35, 20, w * 0.5, h * 0.5, w * 0.7);
    bgGrad.addColorStop(0, '#0c1a36');
    bgGrad.addColorStop(0.6, '#050c1e');
    bgGrad.addColorStop(1, '#02050e');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, w, h);

    // Central Giant Screen Projection (Earth & Approaching Asteroid Trajectory)
    const scrX = w * 0.18;
    const scrY = h * 0.08;
    const scrW = w * 0.64;
    const scrH = h * 0.52;

    this.ctx.fillStyle = '#030816';
    this.ctx.fillRect(scrX, scrY, scrW, scrH);
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(scrX, scrY, scrW, scrH);

    // Projected Earth in central monitor
    const earthX = scrX + scrW * 0.35;
    const earthY = scrY + scrH * 0.55;
    const earthR = scrH * 0.32;
    const eGrad = this.ctx.createRadialGradient(earthX - earthR * 0.3, earthY - earthR * 0.3, 10, earthX, earthY, earthR);
    eGrad.addColorStop(0, '#38bdf8');
    eGrad.addColorStop(0.7, '#1d4ed8');
    eGrad.addColorStop(1, '#0f172a');
    this.ctx.fillStyle = eGrad;
    this.ctx.beginPath();
    this.ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    this.ctx.fill();

    // Projected Red Hazardous Asteroid Trajectory
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.lineWidth = 2.5;
    this.ctx.setLineDash([6, 6]);
    this.ctx.beginPath();
    this.ctx.moveTo(scrX + scrW * 0.85, scrY + scrH * 0.2);
    this.ctx.quadraticCurveTo(scrX + scrW * 0.6, scrY + scrH * 0.45, earthX + earthR * 0.8, earthY - earthR * 0.4);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Asteroid Blip on Main Screen
    const astX = scrX + scrW * 0.85 - (this.time * 8) % 30;
    const astY = scrY + scrH * 0.2 + (this.time * 4) % 15;
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.beginPath();
    this.ctx.arc(astX, astY, 6, 0, Math.PI * 2);
    this.ctx.fill();

    // Mission Control Console Desks & Operators in Foreground
    this.ctx.fillStyle = '#0a1020';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h * 0.72);
    this.ctx.lineTo(w, h * 0.72);
    this.ctx.lineTo(w, h);
    this.ctx.lineTo(0, h);
    this.ctx.fill();

    // Console screens
    for (let x = w * 0.08; x < w * 0.92; x += w * 0.16) {
      this.ctx.fillStyle = '#030814';
      this.ctx.fillRect(x, h * 0.65, w * 0.12, h * 0.12);
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(x, h * 0.65, w * 0.12, h * 0.12);

      // Console UI lines
      this.ctx.fillStyle = '#22c55e';
      this.ctx.fillRect(x + 10, h * 0.68, w * 0.08, 3);
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.fillRect(x + 10, h * 0.71, w * 0.06, 3);
    }
  }

  // -------------------------------------------------------------
  // BACKGROUND B: ASTEROID TRACKING DISPLAY
  // -------------------------------------------------------------
  drawBackgroundB_AsteroidTracking(w, h) {
    this.drawStarfield(w, h);
    this.drawOrbitalCorridor(w, h);

    const astState = this.currentSceneData ? this.currentSceneData.asteroidState : 2;
    this.drawAsteroidAt(w * 0.7, h * 0.42, astState, 340);
  }

  // -------------------------------------------------------------
  // BACKGROUND C: RECONNAISSANCE (ASTRA-1)
  // -------------------------------------------------------------
  drawBackgroundC_Reconnaissance(w, h) {
    this.drawStarfield(w, h);
    this.drawOrbitalCorridor(w, h);

    this.drawAsteroidAt(w * 0.74, h * 0.38, 1, 300);
    this.drawSpacecraftAt(w * 0.44, h * 0.46, 'ASTRA-1', 240);

    // Sensor scan beam toward asteroid
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.44 + 40, h * 0.46 - 20);
    this.ctx.lineTo(w * 0.74 - 50, h * 0.38);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // -------------------------------------------------------------
  // BACKGROUND D: ASTEROID SURFACE
  // -------------------------------------------------------------
  drawBackgroundD_AsteroidSurface(w, h) {
    // Close-up rugged asteroid terrain
    const bgGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#050712');
    bgGrad.addColorStop(0.5, '#1c1917');
    bgGrad.addColorStop(1, '#292524');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, w, h);

    // Uneven rock horizon & boulders
    this.ctx.fillStyle = '#44403c';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h * 0.45);
    for (let x = 0; x <= w; x += 40) {
      const y = h * 0.45 + Math.sin(x * 0.02) * 25 + Math.cos(x * 0.05) * 15;
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(w, h);
    this.ctx.lineTo(0, h);
    this.ctx.fill();

    // Large foreground boulders
    const boulders = [
      { x: w * 0.2, y: h * 0.65, r: 45 },
      { x: w * 0.45, y: h * 0.58, r: 60 },
      { x: w * 0.75, y: h * 0.68, r: 50 },
      { x: w * 0.88, y: h * 0.52, r: 35 }
    ];
    boulders.forEach(b => {
      this.ctx.fillStyle = '#57534e';
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#292524';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    });

    // Topography Mapping Grid Overlay (HUD)
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    this.ctx.lineWidth = 1.5;
    for (let y = h * 0.5; y < h; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(w * 0.1, y);
      this.ctx.lineTo(w * 0.9, y);
      this.ctx.stroke();
    }

    this.ctx.fillStyle = '#22c55e';
    this.ctx.font = '800 13px "Share Tech Mono", monospace';
    this.ctx.fillText('SURFACE TOPOGRAPHY SCAN // WEAK COHESION DETECTED', w * 0.1, h * 0.35);
  }

  // -------------------------------------------------------------
  // BACKGROUND E: INTERNAL STRUCTURE ANALYSIS
  // -------------------------------------------------------------
  drawBackgroundE_InternalStructure(w, h) {
    this.drawStarfield(w, h);
    const graphicUrl = PlanetaryDefenseVisualsInstance.drawInternalDensityGraphic(w, h, this.time);
    const img = new Image();
    img.src = graphicUrl;
    if (img.complete) {
      this.ctx.drawImage(img, 0, 0, w, h);
    }
  }

  // -------------------------------------------------------------
  // BACKGROUND F: KINETIC IMPACT
  // -------------------------------------------------------------
  drawBackgroundF_KineticImpact(w, h) {
    this.drawStarfield(w, h);
    this.drawOrbitalCorridor(w, h);

    const astState = this.currentSceneData ? this.currentSceneData.asteroidState : 2;
    const craftType = this.currentSceneData ? this.currentSceneData.craftType || 'STRIKE-1' : 'STRIKE-1';

    this.drawAsteroidAt(w * 0.72, h * 0.38, astState, 300);

    // Impactor approaching on collision vector
    const dist = Math.max(0, 100 - this.time * 30);
    const craftX = w * 0.72 - dist * 2.2;
    const craftY = h * 0.38 + dist * 1.1;

    this.drawSpacecraftAt(craftX, craftY, craftType, 220);

    // Impact vector dash line
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.lineWidth = 2.5;
    this.ctx.setLineDash([6, 6]);
    this.ctx.beginPath();
    this.ctx.moveTo(craftX, craftY);
    this.ctx.lineTo(w * 0.72, h * 0.38);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // -------------------------------------------------------------
  // BACKGROUND G: GRAVITY TRACTOR
  // -------------------------------------------------------------
  drawBackgroundG_GravityTractor(w, h) {
    this.drawStarfield(w, h);
    this.drawOrbitalCorridor(w, h);

    const astState = this.currentSceneData ? this.currentSceneData.asteroidState : 2;
    this.drawAsteroidAt(w * 0.72, h * 0.4, astState, 300);

    // Gravity Tractor maintaining precise formation lead
    const craftX = w * 0.48 + Math.cos(this.time * 0.8) * 6;
    const craftY = h * 0.44 + Math.sin(this.time * 0.8) * 4;

    this.drawSpacecraftAt(craftX, craftY, 'GRAVITY TRACTOR', 240);

    // Gravitational vector visualization field lines
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    for (let offset = -20; offset <= 20; offset += 10) {
      this.ctx.beginPath();
      this.ctx.moveTo(craftX, craftY + offset);
      this.ctx.lineTo(w * 0.72, h * 0.4 + offset);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);
  }

  // -------------------------------------------------------------
  // BACKGROUND H: FRAGMENTATION
  // -------------------------------------------------------------
  drawBackgroundH_Fragmentation(w, h) {
    this.drawStarfield(w, h);
    this.drawOrbitalCorridor(w, h);

    // Multiple fragmenting pieces diverging
    this.drawAsteroidAt(w * 0.65, h * 0.45, 5, 420);
  }

  // -------------------------------------------------------------
  // BACKGROUND I: SAMPLE COLLECTION (ORBITER-X)
  // -------------------------------------------------------------
  drawBackgroundI_SampleCollection(w, h) {
    this.drawStarfield(w, h);

    // Large asteroid surface on right
    this.drawAsteroidAt(w * 0.75, h * 0.4, 2, 450);

    // ORBITER-X hovering near surface with robotic arm
    const craftX = w * 0.42 + Math.sin(this.time * 1.5) * 5;
    const craftY = h * 0.42;
    this.drawSpacecraftAt(craftX, craftY, 'ORBITER-X', 280);
  }

  // -------------------------------------------------------------
  // BACKGROUND J: SAMPLE ANALYSIS
  // -------------------------------------------------------------
  drawBackgroundJ_SampleAnalysis(w, h) {
    this.drawStarfield(w, h);
    const isCompact = this.currentSceneData && this.currentSceneData.id.includes('SMOOTH');
    const graphicUrl = PlanetaryDefenseVisualsInstance.drawSampleAnalysisGraphic(w, h, isCompact);
    const img = new Image();
    img.src = graphicUrl;
    if (img.complete) {
      this.ctx.drawImage(img, 0, 0, w, h);
    }
  }

  // -------------------------------------------------------------
  // HELPER DRAW FUNCTIONS
  // -------------------------------------------------------------
  drawStarfield(w, h) {
    const bgGrad = this.ctx.createRadialGradient(w * 0.5, h * 0.3, h * 0.1, w * 0.5, h * 0.5, w * 0.8);
    bgGrad.addColorStop(0, '#0c1021');
    bgGrad.addColorStop(0.6, '#050712');
    bgGrad.addColorStop(1, '#02040a');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = '#ffffff';
    this.stars.forEach(s => {
      const sx = (s.x * w + Math.sin(this.time * s.speed) * 8) % w;
      const sy = (s.y * h) % h;
      const alpha = 0.3 + Math.sin(this.time * 2 + s.x * 10) * 0.4;
      this.ctx.globalAlpha = Math.max(0.1, alpha);
      this.ctx.fillRect(sx, sy, s.size, s.size);
    });
    this.ctx.globalAlpha = 1.0;
  }

  drawOrbitalCorridor(w, h) {
    const earthX = w * 0.14;
    const earthY = h * 0.82;
    const earthR = h * 0.36;

    const earthGrad = this.ctx.createRadialGradient(earthX - earthR * 0.3, earthY - earthR * 0.3, earthR * 0.1, earthX, earthY, earthR);
    earthGrad.addColorStop(0, '#60a5fa');
    earthGrad.addColorStop(0.7, '#1e3a8a');
    earthGrad.addColorStop(1, '#0f172a');

    this.ctx.fillStyle = earthGrad;
    this.ctx.beginPath();
    this.ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    this.ctx.fill();

    // Glow
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    this.ctx.lineWidth = 5;
    this.ctx.stroke();

    // Orbital Hazard Arc
    this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 8]);
    this.ctx.beginPath();
    this.ctx.arc(earthX, earthY, earthR * 1.85, -Math.PI * 0.4, 0);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawAsteroidAt(x, y, stateNum, size) {
    const astUrl = PlanetaryDefenseVisualsInstance.drawAsteroidCanvas(stateNum, size, this.time);
    const img = new Image();
    img.src = astUrl;
    if (img.complete) {
      this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    }
  }

  drawSpacecraftAt(x, y, craftType, size) {
    const craftUrl = PlanetaryDefenseVisualsInstance.drawSpacecraftCanvas(craftType, size, this.time);
    const img = new Image();
    img.src = craftUrl;
    if (img.complete) {
      this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    }
  }

  drawParticles() {
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;
  }

  drawTacticalHUD(w, h) {
    // Tactical HUD corner reticles
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.moveTo(25, 55); this.ctx.lineTo(25, 25); this.ctx.lineTo(55, 25);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(w - 55, 25); this.ctx.lineTo(w - 25, 25); this.ctx.lineTo(w - 25, 55);
    this.ctx.stroke();

    // Bottom Live Telemetry Status Bar
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    this.ctx.fillRect(25, h - 50, w - 50, 36);
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(25, h - 50, w - 50, 36);

    this.ctx.fillStyle = '#22c55e';
    this.ctx.font = '800 12px "Share Tech Mono", monospace';
    this.ctx.fillText('PLANETARY DEFENSE COMMAND // ORBITAL INTERCEPT RADAR STREAM', 40, h - 28);

    const title = this.currentSceneData ? this.currentSceneData.subtitle || this.currentSceneData.title : 'MISSION LIVE';
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(title, w - 40, h - 28);
    this.ctx.textAlign = 'left';
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const PlanetaryDefenseSceneInstance = new PlanetaryDefenseScene();
export { PlanetaryDefenseScene };

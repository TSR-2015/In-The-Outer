// 2D Vector & Canvas Visuals Engine for Mission 5: Planetary Defense — The Asteroid Decision
// High fidelity procedural graphic systems for Characters, Spacecraft, Asteroid States, and Scientific Visualizations.

class PlanetaryDefenseVisuals {
  constructor() {
    this.characterColors = {
      ari: { uniform: '#1e3a8a', trim: '#38bdf8', skin: '#f8fafc', hair: '#1e293b' },
      maya: { uniform: '#0f766e', trim: '#2dd4bf', skin: '#fef2f2', hair: '#581c87' },
      leo: { uniform: '#78350f', trim: '#f59e0b', skin: '#fff7ed', hair: '#451a03' },
      mission_control: { uniform: '#1e293b', trim: '#94a3b8', skin: '#f1f5f9', hair: '#334155' }
    };
  }

  // -------------------------------------------------------------
  // 1. CHARACTER PORTRAIT RENDERER WITH 8 EXPRESSIONS & TALK ANIMATION
  // -------------------------------------------------------------
  drawCharacterPortrait(charId, expression = 'neutral', size = 320, isSpeaking = false, animTick = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const normId = charId.toLowerCase();
    const colors = this.characterColors[normId] || this.characterColors.ari;
    const center = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Dynamic speaker backlight glow
    const glowRadius = isSpeaking ? size * 0.49 : size * 0.44;
    const bgGrad = ctx.createRadialGradient(center, center, size * 0.1, center, center, glowRadius);
    bgGrad.addColorStop(0, isSpeaking ? colors.trim + '66' : colors.trim + '22');
    bgGrad.addColorStop(1, 'rgba(10, 15, 30, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Outer HUD border ring
    ctx.strokeStyle = isSpeaking ? colors.trim : colors.trim + '77';
    ctx.lineWidth = isSpeaking ? 4 : 2;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, size * 0.46, 0, Math.PI * 2);
    ctx.clip();

    // Subtle head tilt / breathing offset
    const breathY = isSpeaking ? Math.sin(animTick * 8) * 2 : Math.sin(animTick * 2) * 1;
    const headCenterX = center;
    const headCenterY = center - 15 + breathY;

    if (normId === 'mission_control') {
      // Professional NASA-style Mission Control Console Operator
      this.drawMissionControlAvatar(ctx, center, headCenterY, size, colors, expression, isSpeaking, animTick);
    } else {
      // Standard Specialist Characters (Ari, Maya, Leo)
      // Torso / Suit
      ctx.fillStyle = colors.uniform;
      ctx.beginPath();
      ctx.moveTo(center - 100, size);
      ctx.quadraticCurveTo(center - 85, center + 40, center - 45, center + 30);
      ctx.lineTo(center + 45, center + 30);
      ctx.quadraticCurveTo(center + 85, center + 40, center + 100, size);
      ctx.fill();

      // Uniform Collar & Rank Insignia
      ctx.fillStyle = colors.trim;
      ctx.beginPath();
      ctx.moveTo(center - 45, center + 30);
      ctx.lineTo(center, center + 65);
      ctx.lineTo(center + 45, center + 30);
      ctx.lineTo(center + 30, center + 25);
      ctx.lineTo(center, center + 45);
      ctx.lineTo(center - 30, center + 25);
      ctx.fill();

      // Neck
      ctx.fillStyle = colors.skin;
      ctx.fillRect(center - 22, headCenterY + 25, 44, 30);

      // Head Base
      ctx.beginPath();
      ctx.ellipse(headCenterX, headCenterY, 55, 68, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.beginPath();
      ctx.arc(headCenterX - 55, headCenterY, 12, 0, Math.PI * 2);
      ctx.arc(headCenterX + 55, headCenterY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Character-Specific Hair & Equipment
      ctx.fillStyle = colors.hair;
      if (normId === 'ari') {
        // Commander Ari: Sharp commander side-part with neat contours
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY - 20, 60, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(headCenterX - 58, headCenterY - 15);
        ctx.lineTo(headCenterX - 50, headCenterY + 10);
        ctx.lineTo(headCenterX - 40, headCenterY - 5);
        ctx.fill();
      } else if (normId === 'maya') {
        // Dr. Maya: Elegant scientist updo bun + thin rim glasses
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY - 58, 42, 0, Math.PI * 2); // Updo bun
        ctx.arc(headCenterX, headCenterY - 15, 62, Math.PI * 0.82, Math.PI * 2.18);
        ctx.fill();

        // Technical Smart Glasses
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(headCenterX - 40, headCenterY - 22, 32, 22);
        ctx.strokeRect(headCenterX + 8, headCenterY - 22, 32, 22);
        ctx.beginPath();
        ctx.moveTo(headCenterX - 8, headCenterY - 11);
        ctx.lineTo(headCenterX + 8, headCenterY - 11);
        ctx.stroke();
      } else if (normId === 'leo') {
        // Leo: Short crop hair + technical communication headset
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY - 18, 60, Math.PI * 0.76, Math.PI * 2.24);
        ctx.fill();

        // Flight Communications Headset
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY - 5, 64, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(headCenterX - 70, headCenterY - 18, 14, 24);
        // Headset boom mic
        ctx.beginPath();
        ctx.moveTo(headCenterX - 66, headCenterY);
        ctx.lineTo(headCenterX - 25, headCenterY + 34);
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(headCenterX - 23, headCenterY + 35, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Facial Features (Eyebrows, Eyes, Nose, Mouth)
      this.drawFacialFeatures(ctx, headCenterX, headCenterY, expression, isSpeaking, animTick);
    }

    ctx.restore();
    return canvas.toDataURL('image/png');
  }

  drawMissionControlAvatar(ctx, cx, cy, size, colors, expression, isSpeaking, animTick) {
    // NASA Mission Control Station Officer
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 100, size - 100, 200, 100);
    // Console screens in foreground
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 80, size - 45, 160, 45);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(cx - 80, size - 45, 160, 45);

    // Operator Head
    ctx.fillStyle = colors.skin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 50, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crew Cap / Headset
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 52, cy - 65, 104, 30);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 58, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    this.drawFacialFeatures(ctx, cx, cy, expression, isSpeaking, animTick);
  }

  drawFacialFeatures(ctx, headX, headY, expr, isSpeaking, animTick) {
    const eyeY = headY - 8;
    const mouthY = headY + 32;

    // Eyebrows
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.8;
    ctx.lineCap = 'round';
    ctx.beginPath();

    if (expr === 'concerned' || expr === 'urgent') {
      // Angled up in center
      ctx.moveTo(headX - 35, eyeY - 20); ctx.lineTo(headX - 10, eyeY - 14);
      ctx.moveTo(headX + 10, eyeY - 14); ctx.lineTo(headX + 35, eyeY - 20);
    } else if (expr === 'focused' || expr === 'serious' || expr === 'analytical') {
      // Furrowed down toward center
      ctx.moveTo(headX - 35, eyeY - 14); ctx.lineTo(headX - 10, eyeY - 20);
      ctx.moveTo(headX + 10, eyeY - 20); ctx.lineTo(headX + 35, eyeY - 14);
    } else if (expr === 'thinking') {
      // One raised, one level
      ctx.moveTo(headX - 35, eyeY - 16); ctx.lineTo(headX - 10, eyeY - 16);
      ctx.moveTo(headX + 10, eyeY - 24); ctx.lineTo(headX + 35, eyeY - 18);
    } else if (expr === 'surprised') {
      // High arches
      ctx.moveTo(headX - 35, eyeY - 24); ctx.lineTo(headX - 10, eyeY - 22);
      ctx.moveTo(headX + 10, eyeY - 22); ctx.lineTo(headX + 35, eyeY - 24);
    } else {
      // Neutral / Confident / Relieved
      ctx.moveTo(headX - 35, eyeY - 16); ctx.lineTo(headX - 10, eyeY - 16);
      ctx.moveTo(headX + 10, eyeY - 16); ctx.lineTo(headX + 35, eyeY - 16);
    }
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#0f172a';
    if (expr === 'surprised') {
      ctx.beginPath();
      ctx.arc(headX - 22, eyeY, 9, 0, Math.PI * 2);
      ctx.arc(headX + 22, eyeY, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (expr === 'focused' || expr === 'serious') {
      ctx.beginPath();
      ctx.ellipse(headX - 22, eyeY, 8, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(headX + 22, eyeY, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(headX - 22, eyeY, 7.5, 0, Math.PI * 2);
      ctx.arc(headX + 22, eyeY, 7.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eye catchlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headX - 20, eyeY - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(headX + 24, eyeY - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(headX, headY - 2);
    ctx.lineTo(headX - 3, headY + 12);
    ctx.lineTo(headX + 4, headY + 12);
    ctx.stroke();

    // Animated Mouth (Open/Close with speech)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();

    const mouthOpen = isSpeaking && (Math.floor(animTick * 9) % 2 === 0);

    if (mouthOpen) {
      ctx.fillStyle = '#450a0a';
      ctx.ellipse(headX, mouthY, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      if (expr === 'confident' || expr === 'relieved') {
        ctx.arc(headX, mouthY - 6, 16, 0.1, Math.PI - 0.1);
      } else if (expr === 'concerned' || expr === 'urgent') {
        ctx.arc(headX, mouthY + 14, 16, Math.PI + 0.2, Math.PI * 2 - 0.2);
      } else if (expr === 'surprised') {
        ctx.ellipse(headX, mouthY + 2, 7, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
      } else if (expr === 'serious' || expr === 'focused') {
        ctx.moveTo(headX - 16, mouthY + 2);
        ctx.lineTo(headX + 16, mouthY + 2);
      } else {
        ctx.arc(headX, mouthY - 2, 14, 0.2, Math.PI - 0.2);
      }
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------
  // 2. ASTEROID VISUAL STATES (STATES 1 THROUGH 5)
  // -------------------------------------------------------------
  drawAsteroidCanvas(stateNum = 1, size = 400, animTime = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;

    ctx.clearRect(0, 0, size, size);

    if (stateNum === 1) {
      // STATE 1: UNRESOLVED DEEP SPACE ASTEROID (Radar silhouette & orbital tracking markers)
      const r = size * 0.32;
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.25) {
        const dist = r * (0.88 + Math.sin(a * 4 + animTime * 0.3) * 0.09);
        const x = center + Math.cos(a) * dist;
        const y = center + Math.sin(a) * dist;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Radar Sweep Ring & Target Crosshairs
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(center, center, size * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f59e0b';
      ctx.font = '800 12px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TARGET: UNRESOLVED OBJECT [MAG 19.4]', center, size - 15);

    } else if (stateNum === 2) {
      // STATE 2: RUBBLE-PILE ASTEROID (Loose conglomerate of microgravity boulders)
      const numBoulders = 32;
      for (let i = 0; i < numBoulders; i++) {
        const angle = (i / numBoulders) * Math.PI * 2 + Math.sin(i + animTime * 0.2) * 0.1;
        const dist = (size * 0.13) + (Math.sin(i * 3.7) * 0.15 * size);
        const bx = center + Math.cos(angle) * dist;
        const by = center + Math.sin(angle) * dist;
        const bSize = 15 + (i % 7) * 7;

        ctx.fillStyle = i % 2 === 0 ? '#44403c' : '#78716c';
        ctx.beginPath();
        ctx.arc(bx, by, bSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = '#38bdf8';
      ctx.font = '800 12px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CLASSIFICATION: RUBBLE-PILE AGGREGATE', center, size - 15);

    } else if (stateNum === 3) {
      // STATE 3: SOLID COMPACT MONOLITH (High cohesion, dense rock with craters)
      const r = size * 0.35;
      const grad = ctx.createRadialGradient(center - r * 0.3, center - r * 0.3, r * 0.1, center, center, r);
      grad.addColorStop(0, '#94a3b8');
      grad.addColorStop(0.7, '#475569');
      grad.addColorStop(1, '#0f172a');

      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.2) {
        const dist = r * (0.92 + Math.sin(a * 5) * 0.08);
        const x = center + Math.cos(a) * dist;
        const y = center + Math.sin(a) * dist;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Craters
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      [
        { x: center - 35, y: center - 25, r: 24 },
        { x: center + 45, y: center + 15, r: 30 },
        { x: center - 15, y: center + 45, r: 18 }
      ].forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.fillStyle = '#22c55e';
      ctx.font = '800 12px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STRUCTURE: COHESIVE MONOLITHIC BODY', center, size - 15);

    } else if (stateNum === 4) {
      // STATE 4: FRACTURING / IMPACT STATE (Crack propagation seams)
      this.drawAsteroidCanvasToCtx(ctx, 3, size);

      // Glowing Fracture Fault Lines
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(center - 90, center - 20);
      ctx.lineTo(center + 10, center);
      ctx.lineTo(center + 90, center + 35);
      ctx.moveTo(center - 15, center - 80);
      ctx.lineTo(center + 10, center);
      ctx.lineTo(center - 45, center + 80);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.font = '800 12px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ HIGH STRUCTURAL FRACTURE RISK', center, size - 15);

    } else if (stateNum === 5) {
      // STATE 5: FRAGMENTED (Multiple diverging pieces on ballistic vectors)
      const fragments = [
        { x: center - 95, y: center - 65, r: 35, id: 'A', dx: -45, dy: -30 },
        { x: center + 75, y: center - 85, r: 28, id: 'B', dx: 40, dy: -35 },
        { x: center + 85, y: center + 65, r: 42, id: 'C', dx: 50, dy: 40 },
        { x: center - 75, y: center + 75, r: 24, id: 'D', dx: -35, dy: 45 }
      ];

      fragments.forEach(f => {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Trajectory Velocity Vector
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + f.dx * 0.7, f.y + f.dy * 0.7);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 11px "Share Tech Mono", monospace';
        ctx.fillText(`FRAG-${f.id}`, f.x, f.y - f.r - 5);
      });

      ctx.fillStyle = '#f59e0b';
      ctx.font = '800 12px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TRACKING: MULTIPLE DIVERGING FRAGMENTS', center, size - 15);
    }

    return canvas.toDataURL('image/png');
  }

  drawAsteroidCanvasToCtx(ctx, stateNum, size) {
    const center = size / 2;
    const r = size * 0.35;
    const grad = ctx.createRadialGradient(center - r * 0.3, center - r * 0.3, r * 0.1, center, center, r);
    grad.addColorStop(0, '#94a3b8');
    grad.addColorStop(0.7, '#475569');
    grad.addColorStop(1, '#0f172a');

    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const dist = r * (0.92 + Math.sin(a * 5) * 0.08);
      const x = center + Math.cos(a) * dist;
      const y = center + Math.sin(a) * dist;
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // -------------------------------------------------------------
  // 3. SPACECRAFT FLEET (ASTRA-1, STRIKE-1/2, ORBITER-X, GRAVITY TRACTOR)
  // -------------------------------------------------------------
  drawSpacecraftCanvas(craftType = 'ASTRA-1', size = 300, animTime = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);

    const type = (craftType || 'ASTRA-1').toUpperCase();

    if (type.includes('ASTRA') || type.includes('RECON')) {
      // ASTRA-1: Long-range reconnaissance probe with solar wings and multi-spectral sensor turret
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-120, -18, 80, 36);
      ctx.fillRect(40, -18, 80, 36);
      // Wing Solar Cells
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.5;
      for (let i = -100; i < -40; i += 20) { ctx.beginPath(); ctx.moveTo(i, -18); ctx.lineTo(i, 18); ctx.stroke(); }
      for (let i = 60; i < 120; i += 20) { ctx.beginPath(); ctx.moveTo(i, -18); ctx.lineTo(i, 18); ctx.stroke(); }

      // Core Satellite Bus
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-35, -35, 70, 70);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      ctx.strokeRect(-35, -35, 70, 70);

      // Radar Sounder Turret
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, -42, 22, Math.PI, Math.PI * 2);
      ctx.fill();

      // Scanner Beams
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, -50); ctx.lineTo(-40, -120);
      ctx.moveTo(0, -50); ctx.lineTo(40, -120);
      ctx.stroke();

    } else if (type.includes('STRIKE') || type.includes('IMPACTOR')) {
      // STRIKE-1 / STRIKE-2: Kinetic Impactor with tungsten penetrator and hydrazine thruster
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, -65);
      ctx.lineTo(42, 42);
      ctx.lineTo(-42, 42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Exhaust Thruster Plume
      const plumePulse = 80 + Math.sin(animTime * 15) * 12;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-20, 42);
      ctx.lineTo(0, plumePulse);
      ctx.lineTo(20, 42);
      ctx.fill();

    } else if (type.includes('ORBITER') || type.includes('SAMPLE')) {
      // ORBITER-X: Sample collector with articulated robotic arm & canister
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#14b8a6';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Articulated robotic sampling arm
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 44);
      ctx.lineTo(32, 80);
      ctx.lineTo(15, 105);
      ctx.stroke();

      // Sampling collector head
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(8, 102, 14, 12);

    } else {
      // GRAVITY TRACTOR: Dual ion thruster pods and mutual gravitational lines
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-55, -25, 110, 50);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-55, -25, 110, 50);

      // Ion Engine Exhaust
      ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.fillRect(-48, 25, 22, 45 + Math.sin(animTime * 12) * 6);
      ctx.fillRect(26, 25, 22, 45 + Math.sin(animTime * 12) * 6);

      // Gravitational Vector Lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, -25); ctx.lineTo(-70, -115);
      ctx.moveTo(0, -25); ctx.lineTo(70, -115);
      ctx.stroke();
    }

    ctx.restore();
    return canvas.toDataURL('image/png');
  }

  // -------------------------------------------------------------
  // 4. SCIENTIFIC VISUALIZATION HUD ELEMENTS
  // -------------------------------------------------------------
  drawInternalDensityGraphic(w, h, animTime = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, w, h);

    // Radar Tomography Slice Container
    const cx = w * 0.5;
    const cy = h * 0.48;
    const r = Math.min(w, h) * 0.32;

    // Density gradient contour zones (Scientific low-density pockets)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Density pockets
    const grad1 = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.2, 5, cx - r * 0.3, cy - r * 0.2, r * 0.5);
    grad1.addColorStop(0, '#f59e0b');
    grad1.addColorStop(1, 'transparent');
    ctx.fillStyle = grad1;
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.2, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    const grad2 = ctx.createRadialGradient(cx + r * 0.3, cy + r * 0.2, 5, cx + r * 0.3, cy + r * 0.2, r * 0.45);
    grad2.addColorStop(0, '#38bdf8');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.arc(cx + r * 0.3, cy + r * 0.2, r * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Measurement grid lines and sounding sweep
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = -r; i <= r; i += 30) {
      ctx.beginPath();
      ctx.moveTo(cx + i, cy - r);
      ctx.lineTo(cx + i, cy + r);
      ctx.stroke();
    }

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - r - 20, cy - r - 20, (r + 20) * 2, (r + 20) * 2);

    ctx.fillStyle = '#fef08a';
    ctx.font = '800 13px "Share Tech Mono", monospace';
    ctx.fillText('SUBSURFACE DENSITY TOMOGRAPHY // RADAR SOUNDER', cx - r - 15, cy - r - 28);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillText('BULK DENSITY: 1.32 g/cm³ (46% VOID POROSITY CONFIRMED)', cx - r - 15, cy + r + 36);

    return canvas.toDataURL('image/png');
  }

  drawSampleAnalysisGraphic(w, h, isCompact = true) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.48;

    // Specimen analysis chamber
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(cx - 220, cy - 140, 440, 280);
    ctx.strokeStyle = isCompact ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - 220, cy - 140, 440, 280);

    // Spectrometric Bar Graphs
    const bars = [
      { name: 'SILICATES (SiO₂)', pct: isCompact ? 68 : 34 },
      { name: 'IRON-NICKEL (Fe/Ni)', pct: isCompact ? 54 : 18 },
      { name: 'POROSITY / VOIDS', pct: isCompact ? 14 : 72 },
      { name: 'COHESION STRENGTH', pct: isCompact ? 88 : 12 }
    ];

    ctx.font = '800 12px "Share Tech Mono", monospace';
    bars.forEach((b, idx) => {
      const y = cy - 80 + idx * 48;
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(b.name, cx - 190, y);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 190, y + 8, 380, 16);

      ctx.fillStyle = isCompact ? '#22c55e' : '#f59e0b';
      ctx.fillRect(cx - 190, y + 8, 380 * (b.pct / 100), 16);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(`${b.pct}%`, cx + 190, y);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = isCompact ? '#22c55e' : '#f59e0b';
    ctx.font = '900 14px "Share Tech Mono", monospace';
    ctx.fillText(
      isCompact
        ? '✓ SAMPLE VERIFICATION: COHESIVE MONOLITHIC MATERIAL'
        : '⚠ SAMPLE VERIFICATION: FRAGILE UNCONSOLIDATED REGOLITH',
      cx,
      cy + 120
    );

    return canvas.toDataURL('image/png');
  }
}

export const PlanetaryDefenseVisualsInstance = new PlanetaryDefenseVisuals();
export { PlanetaryDefenseVisuals };

import * as THREE from 'three';

class ParticleSystem {
  constructor() {
    this.systems = {};
    this.group = new THREE.Group();
    this.group.name = "particles_system";
  }

  init(scene) {
    scene.add(this.group);
    
    // Create standard star textures for particle nodes
    this.glowTexture = this.createGlowTexture();
    
    // Initialize the sub-systems
    this.initRocketThrust();
    this.initSolarWind();
    this.initSolarFlares();
    this.initMeteorShower();
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(canvas);
  }

  // 1. Rocket Thrust System (exhaust fire + smoke)
  initRocketThrust() {
    const maxCount = 400;
    const positions = new Float32Array(maxCount * 3);
    const colors = new Float32Array(maxCount * 3);
    const sizes = new Float32Array(maxCount);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 2.0,
      map: this.glowTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geom, mat);
    points.visible = false;
    this.group.add(points);

    // Particle pool array
    const particles = [];
    for (let i = 0; i < maxCount; i++) {
      particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(),
        life: 0,
        maxLife: 0,
        size: 0
      });
    }

    this.systems.rocket = {
      points: points,
      particles: particles,
      maxCount: maxCount,
      geom: geom,
      spawnRate: 15,
      spawnAccumulator: 0
    };
  }

  // 2. Solar Wind System (streams radiating outward from Sun)
  initSolarWind() {
    const maxCount = 800;
    const positions = new Float32Array(maxCount * 3);
    const colors = new Float32Array(maxCount * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.8,
      color: 0x00e5ff,
      map: this.glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.4
    });

    const points = new THREE.Points(geom, mat);
    this.group.add(points);

    const particles = [];
    for (let i = 0; i < maxCount; i++) {
      // Radially outwards
      const direction = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5) * 0.2, // flat disk-like stream
        (Math.random() - 0.5)
      ).normalize();
      
      const speed = 15 + Math.random() * 20;
      const radius = 12 + Math.random() * 80; // start near sun out to sector bounds
      
      const pos = direction.clone().multiplyScalar(radius);

      particles.push({
        pos: pos,
        vel: direction.multiplyScalar(speed),
        maxDist: 150
      });
    }

    this.systems.solarWind = {
      points: points,
      particles: particles,
      geom: geom
    };
  }

  // 3. Solar Flares System (CME explosions)
  initSolarFlares() {
    const maxCount = 200;
    const positions = new Float32Array(maxCount * 3);
    const colors = new Float32Array(maxCount * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 3.5,
      map: this.glowTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geom, mat);
    points.visible = false;
    this.group.add(points);

    const particles = [];
    for (let i = 0; i < maxCount; i++) {
      particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(),
        life: 0,
        maxLife: 0
      });
    }

    this.systems.flare = {
      points: points,
      particles: particles,
      maxCount: maxCount,
      geom: geom
    };
  }

  // 4. Meteor Shower (streaking lines)
  initMeteorShower() {
    const maxCount = 50;
    const positions = new Float32Array(maxCount * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.5,
      color: 0xffaa00,
      map: this.glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.8
    });

    const points = new THREE.Points(geom, mat);
    points.visible = false;
    this.group.add(points);

    const particles = [];
    for (let i = 0; i < maxCount; i++) {
      particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0
      });
    }

    this.systems.meteor = {
      points: points,
      particles: particles,
      maxCount: maxCount,
      geom: geom
    };
  }

  // API TRIGGERS

  // Trigger rocket launch thrust smoke and fire
  triggerRocketThrust(nozzleWorldPositions) {
    const sys = this.systems.rocket;
    sys.points.visible = true;

    // Spawn new particles
    nozzleWorldPositions.forEach(nozzlePos => {
      for (let k = 0; k < 6; k++) {
        const p = sys.particles.find(part => !part.active);
        if (p) {
          p.active = true;
          p.pos.copy(nozzlePos);
          
          // Downward flare velocity with random cone spread
          p.vel.set(
            (Math.random() - 0.5) * 0.8,
            -3.0 - Math.random() * 2.0,
            (Math.random() - 0.5) * 0.8
          );
          
          p.life = 0;
          p.maxLife = 0.5 + Math.random() * 0.5; // lifespan
          p.size = 1.0 + Math.random() * 2.0;

          // Color shifts: core yellow/white to fire orange to smoke grey
          p.color.setHex(0xffaa00);
        }
      }
    });
  }

  stopRocketThrust() {
    if (!this.systems || !this.systems.rocket) return;
    this.systems.rocket.points.visible = false;
    this.systems.rocket.particles.forEach(p => p.active = false);
  }

  // Trigger a massive Coronal Mass Ejection flare from the Sun in a specific direction
  triggerSolarFlare(originDirection) {
    const sys = this.systems.flare;
    sys.points.visible = true;

    const startPos = originDirection.clone().multiplyScalar(12); // Start on Sun surface (radius 12)

    for (let i = 0; i < sys.maxCount; i++) {
      const p = sys.particles[i];
      p.active = true;
      p.pos.copy(startPos);
      
      // Velocity centered around flare direction with high radial expansion
      const spread = 0.45;
      p.vel.copy(originDirection)
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread
        ))
        .normalize()
        .multiplyScalar(18 + Math.random() * 14); // speed

      p.life = 0;
      p.maxLife = 1.2 + Math.random() * 1.5;
      p.color.setRGB(1.0, 0.2 + Math.random() * 0.4, 0.0);
    }
  }

  // Trigger a meteor shower
  triggerMeteorShower() {
    const sys = this.systems.meteor;
    sys.points.visible = true;

    for (let i = 0; i < sys.maxCount; i++) {
      const p = sys.particles[i];
      p.active = true;
      // Start in a box offset from camera view and fly across
      p.pos.set(
        (Math.random() - 0.5) * 150 + 60,
        (Math.random() - 0.5) * 30 + 10,
        (Math.random() - 0.5) * 150 + 60
      );
      p.vel.set(
        -35 - Math.random() * 25,
        -10 - Math.random() * 10,
        -35 - Math.random() * 25
      );
      p.life = 0;
    }
  }

  // UPDATE TICK
  update(delta) {
    // 1. Update Rocket Thrust
    const rSys = this.systems.rocket;
    if (rSys && rSys.points.visible) {
      const positions = rSys.geom.attributes.position.array;
      const colors = rSys.geom.attributes.color.array;
      const sizes = rSys.geom.attributes.size.array;

      for (let i = 0; i < rSys.maxCount; i++) {
        const p = rSys.particles[i];
        if (p.active) {
          p.life += delta;
          if (p.life >= p.maxLife) {
            p.active = false;
            sizes[i] = 0;
            continue;
          }

          // Apply velocity and drag
          p.pos.addScaledVector(p.vel, delta);
          p.vel.multiplyScalar(0.96); // drag

          // Color interpolation (ignition yellow -> red -> dark smoke grey)
          const pct = p.life / p.maxLife;
          if (pct < 0.3) {
            p.color.setRGB(1.0, 0.9, 0.5); // white-hot
          } else if (pct < 0.6) {
            p.color.setRGB(1.0, 0.4, 0.0); // flame orange
          } else {
            p.color.setRGB(0.15, 0.15, 0.15); // ash grey smoke
          }

          positions[i * 3] = p.pos.x;
          positions[i * 3 + 1] = p.pos.y;
          positions[i * 3 + 2] = p.pos.z;

          colors[i * 3] = p.color.r;
          colors[i * 3 + 1] = p.color.g;
          colors[i * 3 + 2] = p.color.b;

          sizes[i] = p.size * (1.0 - pct) * 4.0; // expand smoke then fade size
        } else {
          sizes[i] = 0;
        }
      }
      rSys.geom.attributes.position.needsUpdate = true;
      rSys.geom.attributes.color.needsUpdate = true;
      rSys.geom.attributes.size.needsUpdate = true;
    }

    // 2. Update Solar Wind (always radiating outwards)
    const swSys = this.systems.solarWind;
    if (swSys) {
      const positions = swSys.geom.attributes.position.array;
      for (let i = 0; i < swSys.particles.length; i++) {
        const p = swSys.particles[i];
        p.pos.addScaledVector(p.vel, delta * 0.15);
        
        // Loop particles when they go beyond boundary limit
        const dist = p.pos.length();
        if (dist > p.maxDist) {
          p.pos.copy(p.vel).normalize().multiplyScalar(12); // return to Sun surface
        }

        positions[i * 3] = p.pos.x;
        positions[i * 3 + 1] = p.pos.y;
        positions[i * 3 + 2] = p.pos.z;
      }
      swSys.geom.attributes.position.needsUpdate = true;
    }

    // 3. Update Solar Flares
    const fSys = this.systems.flare;
    if (fSys && fSys.points.visible) {
      const positions = fSys.geom.attributes.position.array;
      const colors = fSys.geom.attributes.color.array;
      let activeCount = 0;

      for (let i = 0; i < fSys.maxCount; i++) {
        const p = fSys.particles[i];
        if (p.active) {
          activeCount++;
          p.life += delta;
          if (p.life >= p.maxLife) {
            p.active = false;
            positions[i * 3] = 9999; // hide particle
            continue;
          }

          p.pos.addScaledVector(p.vel, delta);
          p.vel.multiplyScalar(0.97); // decelerate CME

          positions[i * 3] = p.pos.x;
          positions[i * 3 + 1] = p.pos.y;
          positions[i * 3 + 2] = p.pos.z;

          // Fade colors (orange to dark red)
          const pct = p.life / p.maxLife;
          p.color.setRGB(1.0 - pct * 0.8, 0.4 * (1.0 - pct), 0.0);
          colors[i * 3] = p.color.r;
          colors[i * 3 + 1] = p.color.g;
          colors[i * 3 + 2] = p.color.b;
        } else {
          positions[i * 3] = 9999;
        }
      }
      if (activeCount === 0) {
        fSys.points.visible = false;
      } else {
        fSys.geom.attributes.position.needsUpdate = true;
        fSys.geom.attributes.color.needsUpdate = true;
      }
    }

    // 4. Update Meteor Shower
    const mSys = this.systems.meteor;
    if (mSys && mSys.points.visible) {
      const positions = mSys.geom.attributes.position.array;
      let activeCount = 0;

      for (let i = 0; i < mSys.maxCount; i++) {
        const p = mSys.particles[i];
        if (p.active) {
          activeCount++;
          p.pos.addScaledVector(p.vel, delta);

          positions[i * 3] = p.pos.x;
          positions[i * 3 + 1] = p.pos.y;
          positions[i * 3 + 2] = p.pos.z;

          // Out of screen/lifespan
          if (p.pos.x < -150 || p.pos.z < -150) {
            p.active = false;
          }
        } else {
          positions[i * 3] = 9999;
        }
      }
      if (activeCount === 0) {
        mSys.points.visible = false;
      } else {
        mSys.geom.attributes.position.needsUpdate = true;
      }
    }
  }
}

export const ParticlesInstance = new ParticleSystem();
export { ParticleSystem };

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

class CameraManager {
  constructor() {
    this.activeCamera = null;
    this.controls = null;
    this.mode = 'free'; // 'free', 'follow', 'sun', 'satellite', 'cinematic', 'launch'
    this.activeSatelliteGroup = null; // Group to follow
    
    // For smooth transitions, we track target vectors
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.cameraPosition = new THREE.Vector3(0, 20, 50);
  }

  init(domElement) {
    const width = domElement.clientWidth || window.innerWidth;
    const height = domElement.clientHeight || window.innerHeight;

    // Create main Perspective Camera
    this.activeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    this.activeCamera.position.copy(this.cameraPosition);

    // Initialize OrbitControls
    this.controls = new OrbitControls(this.activeCamera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 600;
    this.controls.minDistance = 3;
    this.controls.enablePan = true; // allow panning in free cam mode
    this.controls.target.copy(this.cameraTarget);
  }

  setMode(mode, targetGroup = null) {
    // Kill any active GSAP tweens on camera and controls target to prevent conflict with OrbitControls
    gsap.killTweensOf(this.activeCamera.position);
    gsap.killTweensOf(this.controls.target);

    this.mode = mode;
    this.activeSatelliteGroup = targetGroup;
    this.controls.enabled = (mode === 'free');

    const duration = 1.8; // seconds for transition

    if (mode === 'free') {
      // Transition back to a general viewing angle of the solar system
      gsap.to(this.activeCamera.position, {
        x: 0,
        y: 90,
        z: 230,
        duration: duration,
        ease: "power2.out",
        onUpdate: () => this.controls.update()
      });
      gsap.to(this.controls.target, {
        x: 0,
        y: 0,
        z: 0,
        duration: duration,
        ease: "power2.out"
      });

    } else if (mode === 'sun') {
      // Lock target to the center (Sun) and zoom in
      gsap.to(this.activeCamera.position, {
        x: 0,
        y: 20,
        z: 60,
        duration: duration,
        ease: "power2.inOut"
      });
      gsap.to(this.controls.target, {
        x: 0,
        y: 0,
        z: 0,
        duration: duration,
        ease: "power2.inOut"
      });

    } else if (mode === 'follow' && targetGroup) {
      // Position behind the probe, facing the Sun
      const satWorldPos = new THREE.Vector3();
      targetGroup.getWorldPosition(satWorldPos);
      
      const toSatDir = satWorldPos.clone().normalize();
      const targetPos = satWorldPos.clone().add(toSatDir.multiplyScalar(15));
      targetPos.y += 5.0; // slightly elevated above the probe
      
      gsap.to(this.activeCamera.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: duration,
        ease: "power2.out"
      });
      gsap.to(this.controls.target, {
        x: 0,
        y: 0,
        z: 0,
        duration: duration,
        ease: "power2.out"
      });

    } else if (mode === 'satellite' && targetGroup) {
      // A side-panning profile tracking shot
      const satWorldPos = new THREE.Vector3();
      targetGroup.getWorldPosition(satWorldPos);
      
      const targetPos = satWorldPos.clone().add(new THREE.Vector3(8, 2, 4));
      
      gsap.to(this.activeCamera.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: duration,
        ease: "power3.out"
      });
      gsap.to(this.controls.target, {
        x: satWorldPos.x,
        y: satWorldPos.y,
        z: satWorldPos.z,
        duration: duration,
        ease: "power3.out"
      });
    } else if (mode === 'custom') {
      // Custom scene controller has exclusive authority over camera position & target
      this.controls.enabled = false;
    }
  }

  // Camera Shake effect
  shake(intensity = 0.5, duration = 1.0) {
    const originalPos = this.activeCamera.position.clone();
    const timeline = gsap.timeline();
    const steps = 10;
    const stepDuration = duration / steps;

    for (let i = 0; i < steps; i++) {
      timeline.to(this.activeCamera.position, {
        x: originalPos.x + (Math.random() - 0.5) * intensity,
        y: originalPos.y + (Math.random() - 0.5) * intensity,
        z: originalPos.z + (Math.random() - 0.5) * intensity,
        duration: stepDuration,
        ease: "none"
      });
    }
    // Return back to original position
    timeline.to(this.activeCamera.position, {
      x: originalPos.x,
      y: originalPos.y,
      z: originalPos.z,
      duration: stepDuration
    });
  }

  // Update loop
  update(delta, time) {
    if (this.mode === 'custom') {
      // Custom mission camera controller (e.g. EarthToMoonScene) has sole authority over activeCamera
      return;
    }
    if (this.mode === 'free') {
      this.controls.update();
    } else if (this.mode === 'follow' && this.activeSatelliteGroup) {
      // View from the back of the probe looking towards the Sun
      const satWorldPos = new THREE.Vector3();
      this.activeSatelliteGroup.getWorldPosition(satWorldPos);
      
      const toSatDir = satWorldPos.clone().normalize();
      const targetCamPos = satWorldPos.clone().add(toSatDir.multiplyScalar(15));
      targetCamPos.y += 5.0; // slightly elevated
      
      this.activeCamera.position.lerp(targetCamPos, 0.1);
      
      // Target is always the Sun's center
      const targetSunPos = new THREE.Vector3(0, 0, 0);
      this.controls.target.lerp(targetSunPos, 0.1);
      this.activeCamera.lookAt(this.controls.target);
    } else if (this.mode === 'satellite' && this.activeSatelliteGroup) {
      // A side-panning profile tracking shot
      const satWorldPos = new THREE.Vector3();
      this.activeSatelliteGroup.getWorldPosition(satWorldPos);
      
      const offset = new THREE.Vector3(8, 1, 4);
      offset.applyQuaternion(this.activeSatelliteGroup.quaternion);

      const targetCamPos = satWorldPos.clone().add(offset);
      this.activeCamera.position.lerp(targetCamPos, 0.1);
      
      this.controls.target.lerp(satWorldPos, 0.1);
      this.activeCamera.lookAt(this.controls.target);
    } else if (this.mode === 'cinematic') {
      // Slow circular flight around the origin
      const radius = 180;
      const speed = 0.05;
      this.activeCamera.position.x = Math.sin(time * speed) * radius;
      this.activeCamera.position.z = Math.cos(time * speed) * radius;
      this.activeCamera.position.y = Math.sin(time * 0.1) * 30 + 40;
      
      this.controls.target.set(0, 0, 0);
      this.activeCamera.lookAt(this.controls.target);
    }
  }
}

export const CameraInstance = new CameraManager();
export { CameraManager };

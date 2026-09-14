import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class AssetLoader {
  constructor() {
    this.models = {};
    this.textures = {};
    this.progress = 0;
  }

  loadAssets(onProgress, onComplete) {
    const loader = new GLTFLoader();
    const assets = [
      { key: 'solar_system', url: '/solar_system.glb' },
      { key: 'parker_solar_probe', url: '/parker_solar_probe.glb' },
      { key: 'satellite', url: '/satellite.glb' },
      { key: 'solar_orbiter', url: '/solar_orbiter.glb' },
      { key: 'station', url: '/Station.glb' },
      { key: 'rocket', url: '/Rocket.glb' }
    ];

    let completed = 0;
    const progressMap = {};

    assets.forEach(asset => {
      progressMap[asset.key] = 0;
    });

    const updateOverallProgress = () => {
      let totalProgress = 0;
      assets.forEach(asset => {
        totalProgress += progressMap[asset.key];
      });
      const overallPercentage = Math.floor(totalProgress / assets.length);
      onProgress(overallPercentage, `LOADING SYSTEM ASSETS: ${overallPercentage}%`);
    };

    assets.forEach(asset => {
      loader.load(
        asset.url,
        (gltf) => {
          this.models[asset.key] = gltf;
          progressMap[asset.key] = 100;
          updateOverallProgress();

          completed++;
          if (completed === assets.length) {
            this.normalizeSatelliteModels();
            setTimeout(() => {
              onComplete();
            }, 300);
          }
        },
        (xhr) => {
          if (xhr.total > 0) {
            const pct = (xhr.loaded / xhr.total) * 100;
            progressMap[asset.key] = pct;
            updateOverallProgress();
          }
        },
        (error) => {
          console.error(`Error loading asset ${asset.key} (${asset.url}):`, error);
          this.models[asset.key] = { scene: new THREE.Group(), animations: [] };
          progressMap[asset.key] = 100;
          updateOverallProgress();

          completed++;
          if (completed === assets.length) {
            setTimeout(() => {
              onComplete();
            }, 300);
          }
        }
      );
    });
  }

  normalizeSatelliteModels() {
    const setModelScale = (scene, scale) => {
      scene.scale.set(scale, scale, scale);
      console.log(`Setting model scale to: ${scale}`);
    };

    if (this.models.parker_solar_probe) {
      setModelScale(this.models.parker_solar_probe.scene, 0.32); // Max dim 6.2 -> 2.0
    }
    if (this.models.satellite) {
      setModelScale(this.models.satellite.scene, 0.117); // Max dim 17.1 -> 2.0
    }
    if (this.models.solar_orbiter) {
      setModelScale(this.models.solar_orbiter.scene, 0.00162); // Max dim 1235.4 -> 2.0
    }
    if (this.models.station) {
      setModelScale(this.models.station.scene, 0.000595); // Max dim 3364 -> 2.0
    }
    if (this.models.rocket) {
      setModelScale(this.models.rocket.scene, 0.0024); // Max height 834 -> 2.0
    }
  }

  getSatelliteModel(index) {
    let gltf;
    if (index === 0) {
      gltf = this.models.parker_solar_probe;
    } else if (index === 1) {
      gltf = this.models.satellite;
    } else if (index === 2) {
      gltf = this.models.solar_orbiter;
    }
    
    if (gltf && gltf.scene) {
      const cloned = gltf.scene.clone();
      cloned.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return cloned;
    }
    
    const geom = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    return new THREE.Mesh(geom, mat);
  }

  getSolarSystemModel() {
    if (this.models.solar_system && this.models.solar_system.scene) {
      const cloned = this.models.solar_system.scene.clone();
      cloned.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          let isOrbit = false;
          let temp = child;
          while (temp) {
            if (temp.name && temp.name.includes(".001")) {
              isOrbit = true;
              break;
            }
            temp = temp.parent;
          }

          if (isOrbit) {
            child.material = new THREE.MeshBasicMaterial({
              color: 0x2288ff,
              transparent: true,
              opacity: 0.16,
              side: THREE.DoubleSide,
              depthWrite: false
            });
            child.castShadow = false;
            child.receiveShadow = false;
          }
        }
      });
      return cloned;
    }
    return new THREE.Group();
  }

  getSolarSystemAnimations() {
    if (this.models.solar_system && this.models.solar_system.animations) {
      return this.models.solar_system.animations;
    }
    return [];
  }

  // Model getters for the Earth to Moon Mission
  getStationModel() {
    if (this.models.station && this.models.station.scene) {
      const cloned = this.models.station.scene.clone();
      cloned.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return cloned;
    }
    return new THREE.Group();
  }

  getRocketModel() {
    if (this.models.rocket && this.models.rocket.scene) {
      const cloned = this.models.rocket.scene.clone();
      cloned.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return cloned;
    }
    return new THREE.Group();
  }

}

export const AssetInstance = new AssetLoader();
export { AssetLoader };

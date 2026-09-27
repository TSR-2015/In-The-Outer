import * as THREE from 'three';

class ObservationSystem {
  constructor() {
    this.resetTargets();
  }

  resetTargets() {
    this.targets = [
      {
        id: 'CRATER_01',
        name: 'Degas Crater',
        type: 'Impact Crater & Ray System',
        lat: '37.4° N',
        lon: '127.0° E',
        angle: 0,
        yOffset: 2.5,
        photoCollected: false,
        dataCollected: false,
        composition: 'Anorthositic Regolith',
        magFlux: '215 nT'
      },
      {
        id: 'PLAINS_02',
        name: 'Borealis Planitia',
        type: 'Smooth Volcanic Plains',
        lat: '73.0° N',
        lon: '79.5° E',
        angle: 1.25,
        yOffset: -3.0,
        photoCollected: false,
        dataCollected: false,
        composition: 'High-Mg Effusive Basalt',
        magFlux: '180 nT'
      },
      {
        id: 'BASIN_03',
        name: 'Rembrandt Basin',
        type: 'High-Contrast Impact Basin',
        lat: '33.2° S',
        lon: '87.6° E',
        angle: 2.5,
        yOffset: 2.0,
        photoCollected: false,
        dataCollected: false,
        composition: 'Iron-Poor Silicates',
        magFlux: '290 nT'
      },
      {
        id: 'RIDGE_04',
        name: 'Discovery Rupes',
        type: 'Lobar Thrust Fault Ridge',
        lat: '56.3° S',
        lon: '38.3° E',
        angle: 3.75,
        yOffset: -2.5,
        photoCollected: false,
        dataCollected: false,
        composition: 'Tectonic Crustal Fault',
        magFlux: '240 nT'
      },
      {
        id: 'CALORIS_05',
        name: 'Caloris Basin',
        type: 'Giant Multi-Ring Impact Basin',
        lat: '30.5° N',
        lon: '189.8° E',
        angle: 5.0,
        yOffset: 3.5,
        photoCollected: false,
        dataCollected: false,
        composition: 'Volatile-Rich Pyroxene',
        magFlux: '310 nT'
      }
    ];

    this.activeTarget = null;
    this.lockState = 'OUT_OF_RANGE'; // OUT_OF_RANGE, APPROACHING, LOCKED
    this.distanceKm = 999;
  }

  update(probePos, probeAngle) {
    if (!probePos) return;

    let closestTarget = null;
    let minDistance = Infinity;

    const radius = 14.1; // Mercury surface radius in scene units

    this.targets.forEach((target) => {
      const tx = Math.cos(target.angle) * radius;
      const tz = Math.sin(target.angle) * radius;
      const ty = target.yOffset;

      const targetPos = new THREE.Vector3(tx, ty, tz);
      const distUnits = probePos.distanceTo(targetPos);
      const distKm = Math.floor(distUnits * 25); // Scale scene units to km

      if (distKm < minDistance) {
        minDistance = distKm;
        closestTarget = target;
      }
    });

    this.activeTarget = closestTarget;
    this.distanceKm = minDistance;

    if (minDistance <= 480) {
      this.lockState = 'LOCKED'; // GREEN
    } else if (minDistance <= 720) {
      this.lockState = 'APPROACHING'; // YELLOW
    } else {
      this.lockState = 'OUT_OF_RANGE'; // RED
    }
  }

  getActiveTarget() {
    return {
      target: this.activeTarget,
      distanceKm: this.distanceKm,
      lockState: this.lockState,
      isLocked: this.lockState === 'LOCKED'
    };
  }
}

export const ObservationSystemInstance = new ObservationSystem();
export { ObservationSystem };

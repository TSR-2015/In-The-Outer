import { AudioInstance } from '../managers/AudioManager.js';
import { ProgressInstance } from '../managers/ProgressManager.js';
import { TelescopeVisualsInstance } from '../scene/TelescopeVisuals.js';

class TelescopeMission {
  constructor() {
    this.stage = 'SELECTION'; // 'SELECTION', 'OBSERVING', 'RECONSTRUCTING', 'VERIFIED'
    this.selectedPlanet = null;
    this.observationPhase = 0; // 0 to 4
    this.observationTimer = null;
    this.phaseDataUrls = [];

    // 5 drop box slots for reconstruction
    this.placedSlots = [null, null, null, null, null]; // array of card objects or null
    this.deckCards = []; // array of card objects in deck stack

    this.score = 0;
    this.elapsedTime = 0;

    // Callbacks for UI updates
    this.onPhaseChange = null;
    this.onObservationComplete = null;
    this.onVerificationResult = null;
    this.onMissionComplete = null;

    // Tracking completed planets and retries for First-Try victory rule
    this.completedPlanetIds = new Set();
    this.failedAttemptsOnCurrentPlanet = 0;

    // 8 Planets Data
    this.planets = [
      {
        id: 'mercury',
        name: 'Mercury',
        detail: 'Closest planet to the Sun with an extreme cratered surface.',
        textureClass: 'planet-tex-mercury'
      },
      {
        id: 'venus',
        name: 'Venus',
        detail: 'Hottest planet enclosed in thick, swirling sulfuric clouds.',
        textureClass: 'planet-tex-venus'
      },
      {
        id: 'earth',
        name: 'Earth',
        detail: 'Our home world featuring blue oceans, continents, and atmosphere.',
        textureClass: 'planet-tex-earth'
      },
      {
        id: 'mars',
        name: 'Mars',
        detail: 'The Red Planet with iron-dust plains, canyons, and polar caps.',
        textureClass: 'planet-tex-mars'
      },
      {
        id: 'jupiter',
        name: 'Jupiter',
        detail: 'Massive gas giant with iconic cloud bands and the Great Red Spot.',
        textureClass: 'planet-tex-jupiter'
      },
      {
        id: 'saturn',
        name: 'Saturn',
        detail: 'Pale golden gas planet surrounded by stunning planetary rings.',
        textureClass: 'planet-tex-saturn'
      },
      {
        id: 'uranus',
        name: 'Uranus',
        detail: 'Icy cyan giant rotating on a unique sideways tilt axis.',
        textureClass: 'planet-tex-uranus'
      },
      {
        id: 'neptune',
        name: 'Neptune',
        detail: 'Deep azure blue ice world with high winds and Great Dark Spot.',
        textureClass: 'planet-tex-neptune'
      }
    ];
  }

  selectPlanet(planetId) {
    if (this.completedPlanetIds.has(planetId)) return null;

    const p = this.planets.find(item => item.id === planetId);
    if (p) {
      this.selectedPlanet = p;
      AudioInstance.playClick();
      return p;
    }
    return null;
  }

  startObservation(viewportContainer) {
    if (!this.selectedPlanet) return;

    this.stage = 'OBSERVING';
    this.observationPhase = 0;
    this.elapsedTime = 0;
    this.failedAttemptsOnCurrentPlanet = 0;

    // Generate 5 realistic 2D phase Data URLs for selected planet
    this.phaseDataUrls = TelescopeVisualsInstance.generatePhaseImages(this.selectedPlanet.id);

    AudioInstance.playArmMotor();
    this.schedulePhaseStep();
  }

  schedulePhaseStep() {
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
    }

    if (this.onPhaseChange) {
      this.onPhaseChange(this.observationPhase, this.phaseDataUrls[this.observationPhase]);
    }

    // After 3.5s per phase, auto-advance to next phase
    this.observationTimer = setTimeout(() => {
      this.nextPhase();
    }, 3500);
  }

  nextPhase() {
    if (this.stage !== 'OBSERVING') return;

    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
      this.observationTimer = null;
    }

    AudioInstance.playScienceBeep();

    if (this.observationPhase < 4) {
      this.observationPhase++;
      this.schedulePhaseStep();
    } else {
      // All 5 phases observed!
      this.stage = 'RECONSTRUCTING';
      this.setupReconstructionCards();
      if (this.onObservationComplete) {
        this.onObservationComplete();
      }
    }
  }

  // Prepare shuffled deck stack of 5 phase cards
  setupReconstructionCards() {
    this.placedSlots = [null, null, null, null, null];

    const cards = [0, 1, 2, 3, 4].map(idx => ({
      originalPhase: idx, // Correct phase index 0..4
      imgUrl: this.phaseDataUrls[idx],
      planetName: this.selectedPlanet.name
    }));

    // Deterministic shuffle so stack is mixed but repeatable
    const shuffled = [...cards];
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * 3 + 1) % (i + 1);
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    // If shuffle by chance produces perfect 0..4 order, swap first two
    if (shuffled.every((c, i) => c.originalPhase === i)) {
      const t = shuffled[0];
      shuffled[0] = shuffled[1];
      shuffled[1] = t;
    }

    this.deckCards = shuffled;
  }

  // Place card into slot
  placeCardInSlot(cardObj, targetSlotIdx) {
    if (targetSlotIdx < 0 || targetSlotIdx > 4) return false;

    // If card was in deck, remove from deck
    const deckIdx = this.deckCards.indexOf(cardObj);
    if (deckIdx !== -1) {
      this.deckCards.splice(deckIdx, 1);
    }

    // If card was already in another slot, clear that slot
    const prevSlotIdx = this.placedSlots.indexOf(cardObj);
    if (prevSlotIdx !== -1) {
      this.placedSlots[prevSlotIdx] = null;
    }

    // Check if target slot is occupied
    const existing = this.placedSlots[targetSlotIdx];
    if (existing && existing !== cardObj) {
      // Reorder / Insert: shift cards right if possible, or swap
      if (prevSlotIdx !== -1) {
        // Swap existing with previous position
        this.placedSlots[prevSlotIdx] = existing;
      } else {
        // Pushing from deck into occupied slot: shift elements to right
        for (let i = 4; i > targetSlotIdx; i--) {
          this.placedSlots[i] = this.placedSlots[i - 1];
        }
      }
    }

    this.placedSlots[targetSlotIdx] = cardObj;
    AudioInstance.playClick();
    return true;
  }

  // Reorder placed cards (drag to insert or swap)
  reorderSlots(fromIdx, toIdx) {
    if (fromIdx === toIdx || fromIdx < 0 || fromIdx > 4 || toIdx < 0 || toIdx > 4) return;
    const card = this.placedSlots[fromIdx];
    if (!card) return;

    this.placedSlots.splice(fromIdx, 1);
    this.placedSlots.splice(toIdx, 0, card);
    AudioInstance.playClick();
  }

  // Verify answer sequence on SUBMIT
  submitVerification() {
    // Ensure all 5 slots are filled
    const isFilled = this.placedSlots.every(slot => slot !== null);
    if (!isFilled) {
      return { success: false, reason: 'INCOMPLETE' };
    }

    // Check exact phase sequence: 0, 1, 2, 3, 4
    const isCorrect = this.placedSlots.every((slot, idx) => slot.originalPhase === idx);

    if (isCorrect) {
      const isFirstTry = (this.failedAttemptsOnCurrentPlanet === 0);
      if (this.selectedPlanet) {
        this.completedPlanetIds.add(this.selectedPlanet.id);
      }

      AudioInstance.playScienceBeep();

      if (isFirstTry) {
        // First try victory: Complete full Mission 4!
        this.stage = 'VERIFIED';
        this.score = 5000;
        const bestTimeStr = `${Math.floor(this.elapsedTime / 60).toString().padStart(2, '0')}:${(this.elapsedTime % 60).toFixed(2).padStart(5, '0')}`;
        ProgressInstance.completeMission('mission_4', this.score, 3, bestTimeStr);

        if (this.onVerificationResult) {
          this.onVerificationResult({ success: true, isFirstTry: true });
        }
        return { success: true, isFirstTry: true };
      } else {
        // Multi-try victory on this planet: record completed planet, but user must select a new planet to try for first-try success!
        if (this.onVerificationResult) {
          this.onVerificationResult({ success: true, isFirstTry: false, planetName: this.selectedPlanet ? this.selectedPlanet.name : '' });
        }
        return { success: true, isFirstTry: false, planetName: this.selectedPlanet ? this.selectedPlanet.name : '' };
      }
    } else {
      this.failedAttemptsOnCurrentPlanet++;
      AudioInstance.playBrakeSound();
      if (this.onVerificationResult) {
        this.onVerificationResult({ success: false });
      }
      return { success: false, reason: 'MISMATCH' };
    }
  }

  resetMission(fullReset = false) {
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
      this.observationTimer = null;
    }
    if (fullReset) {
      this.completedPlanetIds.clear();
    }
    this.stage = 'SELECTION';
    this.selectedPlanet = null;
    this.observationPhase = 0;
    this.placedSlots = [null, null, null, null, null];
    this.deckCards = [];
    this.elapsedTime = 0;
    this.failedAttemptsOnCurrentPlanet = 0;
  }
}

export const TelescopeMissionInstance = new TelescopeMission();
export { TelescopeMission };

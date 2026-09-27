class Mission6State {
  constructor() {
    this.resetState();
  }

  resetState() {
    this.phase = 'INTRO'; // INTRO, BRIEF, ORBIT, TELEMETRY, IMPACT, SUCCESS
    this.photosCount = 0;
    this.targetPhotos = 5;
    this.scienceCount = 0;
    this.targetScience = 5;
    this.elapsedTime = 0;
    this.score = 0;
    this.isActive = false;
    this.isProcessingAnimation = false;

    // Callbacks
    this.onUIUpdate = null;
    this.onNotification = null;
    this.onPhotoResult = null;
    this.onScanResult = null;
    this.onTelemetryReady = null;
    this.onMissionComplete = null;
  }

  startMission() {
    this.resetState();
    this.phase = 'BRIEF';
    this.isActive = true;
    if (this.onUIUpdate) this.onUIUpdate();
  }

  startOrbitGameplay() {
    this.phase = 'ORBIT';
    this.elapsedTime = 0;
    if (this.onNotification) {
      this.onNotification('MERCURY ORBIT ENTERED — APPROACH OBSERVATION ZONES TO SCAN AND CAPTURE', 'info');
    }
    if (this.onUIUpdate) this.onUIUpdate();
  }

  update(delta) {
    if (!this.isActive) return;
    if (this.phase === 'ORBIT') {
      this.elapsedTime += delta;
      if (this.onUIUpdate) this.onUIUpdate();
    }
  }

  recordPhotoCapture(target) {
    if (this.phase !== 'ORBIT' || this.isProcessingAnimation) return false;
    if (target.photoCollected) {
      if (this.onNotification) this.onNotification(`TARGET ALREADY PHOTOGRAPHED: ${target.name}`, 'warning');
      return false;
    }

    this.isProcessingAnimation = true;
    target.photoCollected = true;
    this.photosCount++;
    this.score += 250;

    if (this.onPhotoResult) {
      this.onPhotoResult(target);
    }

    setTimeout(() => {
      this.isProcessingAnimation = false;
      if (this.onUIUpdate) this.onUIUpdate();
      this.checkCompletion();
    }, 1800);

    return true;
  }

  recordScienceScan(target) {
    if (this.phase !== 'ORBIT' || this.isProcessingAnimation) return false;
    if (target.dataCollected) {
      if (this.onNotification) this.onNotification(`TARGET ALREADY SCANNED: ${target.name}`, 'warning');
      return false;
    }

    this.isProcessingAnimation = true;
    target.dataCollected = true;
    this.scienceCount++;
    this.score += 250;

    if (this.onScanResult) {
      this.onScanResult(target);
    }

    setTimeout(() => {
      this.isProcessingAnimation = false;
      if (this.onUIUpdate) this.onUIUpdate();
      this.checkCompletion();
    }, 2000);

    return true;
  }

  checkCompletion() {
    if (this.photosCount >= this.targetPhotos && this.scienceCount >= this.targetScience) {
      this.phase = 'TELEMETRY';
      if (this.onTelemetryReady) {
        this.onTelemetryReady();
      }
    }
  }

  startImpactDescent() {
    this.phase = 'IMPACT';
    if (this.onUIUpdate) this.onUIUpdate();
  }

  triggerVictory() {
    this.phase = 'SUCCESS';
    this.isActive = false;
    if (this.onMissionComplete) {
      this.onMissionComplete();
    }
  }
}

export const Mission6StateInstance = new Mission6State();
export { Mission6State };

class ProgressManager {
  constructor() {
    this.storageKey = 'solar_sentinel_mission_progress';
    this.progress = this.loadProgress();
  }

  loadProgress() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Ensure mission_2 exists (upgrade path if user already has save)
        if (parsed && !parsed.mission_2) {
          parsed.mission_2 = { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: parsed.mission_1?.completed || false };
          parsed.mission_3 = { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: false };
          parsed.mission_4 = { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: false };
          parsed.mission_5 = { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: false };
          this.saveProgressData(parsed);
        }
        return parsed;
      } catch (e) {
        console.error("Error parsing progress from localStorage:", e);
      }
    }
    
    // Initialize default progress
    const defaultProgress = {
      mission_1: { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: true },
      mission_2: { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: false },
      mission_3: { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: false },
      mission_4: { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: false },
      mission_5: { completed: false, score: 0, stars: 0, bestTime: "--", unlocked: false }
    };
    this.saveProgressData(defaultProgress);
    return defaultProgress;
  }

  saveProgressData(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  completeMission(missionId, score, stars, bestTime) {
    const data = this.loadProgress();
    if (data[missionId]) {
      data[missionId].completed = true;
      if (score > data[missionId].score) {
        data[missionId].score = score;
      }
      if (stars > data[missionId].stars) {
        data[missionId].stars = stars;
      }
      if (data[missionId].bestTime === '--' || this.compareTimes(bestTime, data[missionId].bestTime)) {
        data[missionId].bestTime = bestTime;
      }

      // Unlock next mission
      const num = parseInt(missionId.split('_')[1]);
      const nextId = `mission_${num + 1}`;
      if (data[nextId]) {
        data[nextId].unlocked = true;
      }

      this.saveProgressData(data);
      this.progress = data;
    }
  }

  // Returns true if time1 is faster than time2 (format "MM:SS.hh")
  compareTimes(time1, time2) {
    const toMs = (t) => {
      const parts = t.split(':');
      const min = parseInt(parts[0]) || 0;
      const secParts = parts[1] ? parts[1].split('.') : [0, 0];
      const sec = parseInt(secParts[0]) || 0;
      const ms = parseInt(secParts[1]) || 0;
      return min * 60000 + sec * 1000 + ms * 10;
    };
    return toMs(time1) < toMs(time2);
  }

  getOverallPercent() {
    const data = this.loadProgress();
    let completedCount = 0;
    const total = 5;
    for (let i = 1; i <= total; i++) {
      if (data[`mission_${i}`] && data[`mission_${i}`].completed) {
        completedCount++;
      }
    }
    return Math.floor((completedCount / total) * 100);
  }
}

export const ProgressInstance = new ProgressManager();
export { ProgressManager };

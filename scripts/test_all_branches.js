// Automated Branch & Ending Validator for Mission 5: Planetary Defense
import { PlanetaryDefenseMission } from '../src/missions/PlanetaryDefenseMission.js';

const pd = new PlanetaryDefenseMission();

const testCases = [
  { name: 'Path 1 (A1)', choices: ['A', 'A', 'A', 'A'], expectedEnding: 'A1' },
  { name: 'Path 2 (A2)', choices: ['A', 'A', 'A', 'B'], expectedEnding: 'A2' },
  { name: 'Path 3 (A3)', choices: ['A', 'B', 'B', 'A'], expectedEnding: 'A3' },
  { name: 'Path 4 (A4)', choices: ['A', 'B', 'B', 'B'], expectedEnding: 'A4' },
  { name: 'Path 5 (B1)', choices: ['B', 'A'], expectedEnding: 'B1' },
  { name: 'Path 6 (B2)', choices: ['B', 'B', 'A'], expectedEnding: 'B2' },
  { name: 'Path 7 (B3)', choices: ['B', 'B', 'B'], expectedEnding: 'B3' },
  { name: 'Path 8 (C1)', choices: ['C', 'A', 'A'], expectedEnding: 'C1' },
  { name: 'Path 9 (C2)', choices: ['C', 'A', 'B'], expectedEnding: 'C2' },
  { name: 'Path 10 (C3)', choices: ['C', 'B', 'A'], expectedEnding: 'C3' },
  { name: 'Path 11 (C4)', choices: ['C', 'B', 'B'], expectedEnding: 'C4' },
];

let passed = 0;

for (const tc of testCases) {
  pd.startMission();
  let finalEnding = null;
  pd.onEndingReached = (key, data) => {
    finalEnding = key;
  };

  for (const choice of tc.choices) {
    // If current scene auto-transitions before a decision:
    let currentScene = pd.getSceneData(pd.currentSceneId);
    if (currentScene.autoTransitionTo) {
      pd.loadScene(currentScene.autoTransitionTo);
      currentScene = pd.getSceneData(pd.currentSceneId);
    }
    pd.makeDecision(choice);

    let nextScene = pd.getSceneData(pd.currentSceneId);
    if (nextScene.endingTarget) {
      pd.triggerEnding(nextScene.endingTarget);
    } else if (nextScene.autoTransitionTo) {
      pd.loadScene(nextScene.autoTransitionTo);
    }
  }

  if (finalEnding === tc.expectedEnding) {
    console.log(`✓ ${tc.name}: Reached ${finalEnding} successfully`);
    passed++;
  } else {
    console.error(`✗ ${tc.name}: Expected ${tc.expectedEnding}, got ${finalEnding}, at scene ${pd.currentSceneId}`);
  }
}

console.log(`\nResults: ${passed} / ${testCases.length} paths passed.`);
if (passed !== testCases.length) {
  process.exit(1);
}

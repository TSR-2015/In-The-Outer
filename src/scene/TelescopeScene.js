import { TelescopeVisualsInstance } from './TelescopeVisuals.js';

class TelescopeScene {
  init(container) {
    // 2D realistic graphics mode — container handled by DOM elements
  }

  renderPhaseViews(planetId) {
    return TelescopeVisualsInstance.generatePhaseImages(planetId);
  }

  setPhaseIndex(phaseIdx) {
    // Phase index updated via DOM img elements in TelescopeMission
  }

  render() {}
}

export const TelescopeSceneInstance = new TelescopeScene();
export { TelescopeScene };

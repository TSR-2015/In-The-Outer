import './style.css';
import { EngineInstance } from './core/Engine.js';
import { CameraInstance } from './camera/CameraManager.js';
import { UIInstance } from './ui/UIManager.js';
import { GameStateInstance } from './managers/GameStateManager.js';
import { MultiplayerInstance } from './network/MultiplayerManager.js';

// Bootstrapping the IN THE OUTER application
function bootstrap() {
  try {
    // 1. Initialize the Core Three.js Engine with the container mounting point
    EngineInstance.init('canvas-container');

    // 2. Initialize the perspective camera and orbit controls
    CameraInstance.init(EngineInstance.renderer.domElement);

    // 3. Connect active camera to the rendering passes
    EngineInstance.setCamera(CameraInstance.activeCamera);

    // 4. Hook the camera update function into the engine's animation tick callback list
    EngineInstance.registerUpdateCallback((delta, time) => {
      CameraInstance.update(delta, time);
    });

    // 5. Initialize UIManager listeners ( Procurement cards, tab actions, buttons clicks)
    UIInstance.init();

    // 6. Initialize Game State lifecycle machine (triggers Loading progress bar)
    GameStateInstance.init();

    // 7. Initialize Multiplayer AirConsole Network Manager
    MultiplayerInstance.init();

    console.log("IN THE OUTER // CORE INITIALIZED SUCCESSFULLY");
  } catch (error) {
    console.error("Critical error during IN THE OUTER bootstrapping:", error);
  }
}

// Start game when DOM is loaded or immediately if already parsed
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

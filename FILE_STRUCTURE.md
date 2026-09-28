# IN THE OUTER // FILE STRUCTURE & ARCHITECTURAL SITEMAP

This document provides an exhaustive reference of the directory hierarchy, core modules, communication contracts, and architectural layout for **IN THE OUTER**.

---

## 1. Project Directory Tree

```
in-the-outer/
├── index.html                   # Big Screen application entrypoint (TV/PC/Tablet display)
├── controller.html              # Mobile AirConsole handheld controller entrypoint (Phone display)
├── server.js                    # Node.js + Express + WebSocket backend (AirConsole room broker)
├── vite.config.js               # Multi-page Vite configuration with watch filters
├── package.json                 # Project dependencies, build targets, and metadata
├── skills-lock.json             # Agent skills lockfile (Leonxlnx/taste-skill)
├── FILE_STRUCTURE.md            # Comprehensive project architecture & file map
│
├── .agents/                     # Installed AI agent skills & design guidelines
│   └── skills/
│       ├── brandkit/
│       ├── design-taste-frontend/
│       ├── industrial-brutalist-ui/
│       ├── high-end-visual-design/
│       ├── gpt-taste/
│       ├── minimalist-ui/
│       └── ...
│
├── data/                        # Persistent server storage & data records
│   └── users.json               # Player profile database (usernames, stats, preferences)
│
├── public/                      # Static assets served untouched by Vite
│   ├── vite.svg                 # Application favicon
│   └── ...                      # Texture maps, models, and audio samples
│
├── scripts/                     # Verification, linting, and automated test suites
│   ├── test_airconsole.js       # 13 AirConsole architecture & state replication tests
│   ├── test_multiplayer.js      # 17 end-to-end WebSocket multiplayer verification tests
│   └── scan_emojis.js           # Automated scanner enforcing zero-emoji visual constraints
│
└── src/                         # Client-side source code
    ├── main.js                  # Big Screen application bootstrap & lifecycle initializer
    ├── style.css                # Global design system, HUD styling, and animations
    │
    ├── assets/                  # Bundled assets (SVGs, raster icons)
    │   ├── hero.png
    │   ├── javascript.svg
    │   └── vite.svg
    │
    ├── camera/                  # Perspective and cinematic camera control
    │   └── CameraManager.js     # Three.js camera transitions, orbit controls, and follow cams
    │
    ├── controller/              # Mobile handheld controller subsystem
    │   ├── controller.js        # PhoneController state engine, pointer-captured D-Pad, haptics
    │   └── controller.css       # Authentic vertical handheld console layout & CRT/LCD HUD
    │
    ├── core/                    # Engine foundations
    │   └── Engine.js            # Three.js WebGLRenderer, render loop, resize observer
    │
    ├── data/                    # Static simulation datasets
    │   └── SatelliteData.js     # Probe specifications, orbital parameters, and telemetry baselines
    │
    ├── effects/                 # Visual shader & particle pipelines
    │   └── Particles.js         # Cosmic dust, solar wind, and propulsion emitter systems
    │
    ├── managers/                # Global service managers
    │   ├── AssetLoader.js       # Preloader for GLTF/OBJ meshes, cubemaps, and textures
    │   ├── AudioManager.js      # Web Audio synthesizer, procedural hums, thruster audio, SFX
    │   ├── GameStateManager.js  # Finite State Machine (BOOT, LANDING, LOBBY, MISSIONS, PAUSE)
    │   └── ProgressManager.js   # LocalStorage campaign persistence (scores, stars, completion)
    │
    ├── mission6/                # Mission 06 (Mercury Explorer subsystem)
    │   ├── MercuryScene.js      # Hermean terrain, solar irradiance, and high-G flight
    │   ├── Mission6State.js     # Solar flare states and thermal threshold tracking
    │   ├── Mission6UI.js        # Thermal HUD gauges and gravitational slingshot guides
    │   └── ObservationSystem.js # Spectrometric surface anomaly analysis
    │
    ├── missions/                # Core campaign missions (01 - 05)
    │   ├── MissionManager.js    # Mission registry, scoring rules, and objective coordinators
    │   ├── EarthToMoonMission.js# Mission 02: Trans-Lunar Injection & orbital checkpoint quizzes
    │   ├── MarsRoverMission.js  # Mission 03: Planetary surface recon & dual-rover multiplayer race
    │   ├── PlanetaryDefenseMission.js # Mission 05: Asteroid deflection orbital mechanics
    │   └── TelescopeMission.js  # Mission 04: James Webb / Hubble deep-space reconstruction
    │
    ├── network/                 # Client networking subsystem
    │   └── MultiplayerManager.js# AirConsole WebSocket client for Big Screen (room sync, input routing)
    │
    ├── scene/                   # Three.js 3D Environments & Scene Graphs
    │   ├── EarthToMoonScene.js  # Cislunar trajectory, Earth/Moon geometry, Apollo lander
    │   ├── MarsRoverScene.js    # Martian terrain mesh, procedural rocks, twin rovers, dust storms
    │   ├── PlanetaryDefenseScene.js # Asteroid belt, kinetic impactor trajectory
    │   ├── PlanetaryDefenseVisuals.js # Orbital trajectory rings and projection vectors
    │   ├── SolarSystem.js       # Heliocentric planetary orbits and Sun coronal glow
    │   ├── TelescopeScene.js    # Deep space starfield and observation target rigs
    │   └── TelescopeVisuals.js  # FITS spectrum analyzers and spectral reconstruction overlays
    │
    └── ui/                      # 2D Screen Overlays & Interfaces
        ├── Icons.js             # High-contrast geometric SVG iconography system
        ├── PlanetaryDefenseUI.js# Trajectory deflection sliders and delta-V gauges
        └── UIManager.js         # Screen transitions, modal coordinator, 3D mouse parallax
```

---

## 2. Architecture & Role Division (AirConsole Model)

```
                       +----------------------------------+
                       |           SERVER.JS              |
                       |  - Express HTTP Static Server    |
                       |  - WebSocket Room Broker         |
                       |  - State Diff Merging & Auth     |
                       |  - Disconnect Grace Period (60s) |
                       +-----------------+----------------+
                                         |
                     WebSocket (/ws)     |     WebSocket (/ws)
                +------------------------+------------------------+
                |                                                 |
                v                                                 v
+-------------------------------+               +----------------------------------+
|      BIG SCREEN (device_id: 0)|               |   HANDHELD CONTROLLER (PHONE)    |
|   (http://localhost:3000)     |               |   (http://<host>:3000/controller)|
|                               |               |                                  |
| • index.html                  |               | • controller.html                |
| • Three.js 3D Scene Graph     |               | • PhoneController.js             |
| • Full Screen Rendering       |               | • Vertical Console Chassis       |
| • Audio Synthesizer Engine    |               | • Tactile Molded D-Pad           |
| • MultiplayerManager.js       |               | • Action Buttons (A, B, C)       |
| • Displays Room Code & QR     |               | • Replicated Device State Engine |
+-------------------------------+               +----------------------------------+
```

---

## 3. Detailed Component Descriptions

### Root Files
| File | Role |
| :--- | :--- |
| [`index.html`](file:///d:/pr/index.html) | Main Big Screen display rendering the 3D space flight simulation, mission HUDs, campaign selector, and AirConsole lobby. |
| [`controller.html`](file:///d:/pr/controller.html) | Phone controller interface styled as an authentic handheld gaming console with molded D-pad, action cluster, and CRT telemetry screen. |
| [`server.js`](file:///d:/pr/server.js) | Dual HTTP/WebSocket server. Manages 4-character room codes, host authority transfers, replicated state sync, input routing, and 60s disconnect grace periods. |
| [`vite.config.js`](file:///d:/pr/vite.config.js) | Multi-page Vite configuration with build inputs for both `main` and `controller`, with watcher rules ignoring non-frontend directories. |

### Source Directories (`src/`)
| Directory | Role |
| :--- | :--- |
| [`src/controller/`](file:///d:/pr/src/controller) | Client controller code containing `controller.js` (pointer-captured 8-way directional tracker, input streaming, haptic feedback) and `controller.css` (vertical chassis styling). |
| [`src/missions/`](file:///d:/pr/src/missions) | Core mission logic. Contains `MarsRoverMission.js` (multiplayer rover simulation, collision avoidance, scoring, photo/sample modes), `EarthToMoonMission.js`, etc. |
| [`src/network/`](file:///d:/pr/src/network) | `MultiplayerManager.js` connects the Big Screen to `server.js` via WebSocket, updates the live player roster, handles room codes, and routes rover inputs. |
| [`src/scene/`](file:///d:/pr/src/scene) | 3D visual environments built with Three.js (Mars surface terrain, rock colliders, planetary orbiters, spacecraft meshes). |
| [`src/ui/`](file:///d:/pr/src/ui) | `UIManager.js` coordinates screen visibility, interactive 3D mouse parallax on the landing page, modals, and telemetry readouts. `Icons.js` provides crisp SVG icons. |
| [`src/managers/`](file:///d:/pr/src/managers) | Central services including `AudioManager.js` (Web Audio synths and SFX), `GameStateManager.js` (application state machine), and `ProgressManager.js` (campaign progression). |
| [`src/camera/`](file:///d:/pr/src/camera) | `CameraManager.js` manages camera view modes (Free cam, Orbit cam, Follow cam, Viewfinder mode). |
| [`src/core/`](file:///d:/pr/src/core) | `Engine.js` wraps the Three.js `WebGLRenderer` and orchestrates the 60fps render loop. |

---

## 4. Test Suites (`scripts/`)
| Script | Description |
| :--- | :--- |
| [`scripts/test_airconsole.js`](file:///d:/pr/scripts/test_airconsole.js) | Validates all 13 core AirConsole specs: room creation, host election, state diff replication, host-only actions, active player partitioning, input streaming, and host transfer. |
| [`scripts/test_multiplayer.js`](file:///d:/pr/scripts/test_multiplayer.js) | 17 integration tests verifying WebSocket communication, rover movement routing, photo scoring, sample collection rank reversals, and pause synchronization. |
| [`scripts/scan_emojis.js`](file:///d:/pr/scripts/scan_emojis.js) | Enforces the zero-emoji design constraint across all project files. |

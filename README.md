# IN THE OUTER

> **EXPLORE • DISCOVER • LEARN**  
> An interactive aerospace exploration game featuring realistic 3D spaceflight mechanics, real NASA mission telemetry, and an AirConsole-style wireless phone multiplayer system.

---

## Overview

**IN THE OUTER** is a web-based aerospace simulation and space exploration game. Designed for both single-player deep-space campaigns and living-room multiplayer party gaming, it blends scientifically grounded space exploration with high-fidelity 3D graphics, interactive planetary science, and a wireless mobile controller experience.

---

## Key Features

### 1. Six Full-Fidelity Campaign Missions
* **Mission 01 — Satellite Procurement & Solar System Orbit**: Deploy reconnaissance satellites with varying optical apertures and battery capacities.
* **Mission 02 — Earth to Moon Flight Sequence**: Master orbital mechanics, lunar insertion vectors, and gravity-assist trajectories with checkpoint verification.
* **Mission 03 — Mars Rover Expedition & Multiplayer Race**: Navigate hazardous Martian terrain, acquire high-resolution surface panoramas, sample geological core samples, and compete head-to-head in real-time split-screen.
* **Mission 04 — Telescope Observation & Memory Reconstruction**: Observe rotating planetary bodies and reconstruct observed chronological orbital phases.
* **Mission 05 — Planetary Defense (The Asteroid Decision)**: Interactive narrative branching simulation featuring kinetic impactors, gravity tractors, and deflection physics.
* **Mission 06 — NASA MESSENGER // Mercury Explorer**: Historical simulation of NASA's 4,105 polar orbits around Mercury, surface telemetry imaging, and final de-orbit impact.

### 2. AirConsole-Style Wireless Multiplayer System
* **Shared Big Screen**: TV/PC/Monitor displays the 3D game and room connect code with a neomorphic QR code.
* **Smartphones as Wireless Gamepads**: No app download required — players scan the QR code to connect their phone as a tactile game controller.
* **Host Authority**: The first player to connect is designated the **Host / Master**, gaining exclusive remote commands to navigate lobbies, launch missions, and pause gameplay. Automatic host failover promotes the next player if the host disconnects.
* **Custom Device State Synchronization**: Device state is replicated across WebSocket connections, enabling instantaneous re-syncing on network hiccups or browser reloads.
* **Player Profile Persistence**: Automated filesystem user profile and telemetry database (`data/users.json`).

### 3. Professional Game UI Design System
* **Vector Icon System**: Crisp, scalable SVG icon library replacing all emojis across all screens, HUDs, and controllers.
* **Aerospace HUD**: Real-time telemetry pods, optical reticle corners, split-screen HUD dividers, and visual mission objective trackers.
* **Tactile Handheld Controller**: Molded physical D-pad cross with beveled directional chevrons, arcade-grade action buttons (A: Photo, B: Sample, C: Action) with haptic feedback, and dedicated hardware Pause control.

---

## Tech Stack

* **Rendering Engine**: [Three.js](https://threejs.org/) (WebGL 3D graphics, PBR lighting, custom terrain geometry, orbital camera controls)
* **Build Tool**: [Vite](https://vitejs.dev/)
* **Backend & Networking**: Node.js, Express, [ws (WebSocket)](https://github.com/websockets/ws)
* **QR Generation**: [node-qrcode](https://github.com/soldair/node-qrcode)
* **Styling**: Modern CSS3 (CSS Variables, Flexbox/Grid, Neomorphism, Glassmorphism, CSS 3D transforms)

---

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* Modern desktop browser (Chrome, Edge, Firefox, Safari)
* Smartphone with camera / mobile browser on the same Wi-Fi network (for multiplayer)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/TSR-2015/In-The-Outer.git
   cd In-The-Outer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the game server:
   ```bash
   npm start
   ```
   *(Or run `node server.js` directly)*

4. Open the game:
   * **Big Screen (PC / TV)**: Open [http://localhost:3000](http://localhost:3000)
   * **Mobile Controller**: Scan the on-screen QR code or open `http://<your-local-ip>:3000/controller` on your smartphone.

---

## Testing & Verification

Run the automated 17-point multiplayer integration test suite:
```bash
node scripts/test_multiplayer.js
```

Run the AirConsole architecture test suite:
```bash
node scripts/test_airconsole.js
```

Verify build output:
```bash
npm run build
```

---

## Production Deployment Guide

### Option A: All-in-One Deployment (Render / Railway / DigitalOcean / Fly.io)
Deploy the repository as a Node.js web service:
- **Build Command**: `npm run build`
- **Start Command**: `npm start` (runs `node server.js`)
- The server automatically detects the pre-built `dist/` folder in production, serves static assets with high performance, and handles WebSocket connections at `/ws`.

### Option B: Split Frontend + Backend (Vercel + Render)
1. **Backend (Render / Railway)**:
   - Create a Web Service connected to this repository.
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - Set environment variables:
     - `PORT`: (provided automatically by host)
     - `FRONTEND_URL`: `https://your-game.vercel.app`
     - `NODE_ENV`: `production`

2. **Frontend (Vercel)**:
   - Create a new project importing this repository.
   - Framework preset: **Vite**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - Set environment variables:
     - `VITE_WS_URL`: `wss://your-backend.onrender.com/ws`
     - `VITE_FRONTEND_URL`: `https://your-game.vercel.app`
   - Multi-page rewrites are already configured in `vercel.json` (`/controller` -> `controller.html`).

---

## Project Structure

```
In-The-Outer/
├── controller.html          # Mobile handheld gamepad interface
├── index.html               # Main Big Screen entry point & HUDs
├── package.json             # Project dependencies and scripts
├── server.js                # Node.js WebSocket & Express server
├── data/
│   └── users.json           # Persistent player profiles
├── public/
│   ├── audio/               # Voice acting, sfx, and orchestral score
│   └── mercury.glb          # 3D Mercury planet model
├── scripts/
│   ├── test_multiplayer.js  # Automated 17-test verification suite
│   └── scan_emojis.js       # Zero-emoji compliance scanner
└── src/
    ├── camera/              # Three.js camera rigs & orbit controls
    ├── controller/          # Mobile gamepad logic & physical CSS
    ├── core/                # Game loop & Three.js render engine
    ├── managers/            # Audio, GameState, and Progress managers
    ├── missions/            # Mission logic (Missions 01 - 06)
    ├── network/             # WebSocket client & Multiplayer manager
    ├── scene/               # 3D terrain, rovers, celestial bodies
    ├── style.css            # Professional Game UI styling
    └── ui/                  # UI Manager, dialogue HUDs, vector Icons.js
```

---

## License

MIT License. Designed and developed for aerospace science education and high-performance web gaming.

// =========================================================
// IN THE OUTER // BIG SCREEN MULTIPLAYER MANAGER
// Manages Big Screen room lifecycle, player roster,
// Master remote navigation, and input dispatching.
// =========================================================

import QRCode from 'qrcode';
import { GameStateInstance } from '../managers/GameStateManager.js';
import { MarsRoverMissionInstance } from '../missions/MarsRoverMission.js';
import { AudioInstance } from '../managers/AudioManager.js';
import { UIInstance } from '../ui/UIManager.js';
import { Icons } from '../ui/Icons.js';

class MultiplayerManager {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.controllerUrl = null;
    this.players = [];
    this.masterPlayerId = null;

    this.onRoomReady = null;
    this.onPlayersUpdated = null;
  }

  init() {
    this.connectWebSocket();
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[MultiplayerManager] Connected to backend WebSocket.');
      // Request room creation
      this.send({ type: 'ROOM_CREATE' });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[MultiplayerManager] Message parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[MultiplayerManager] WebSocket disconnected. Retrying in 3s...');
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error('[MultiplayerManager] WebSocket error:', err);
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleMessage(msg) {
    const { type, roomId, player, room, action, target } = msg;

    switch (type) {
      case 'ROOM_CREATED': {
        this.roomId = roomId;
        this.controllerUrl = msg.controllerUrl;
        console.log(`[MultiplayerManager] Room Active: Code ${roomId}`);
        this.updateLobbyUI();
        if (this.onRoomReady) this.onRoomReady(roomId, this.controllerUrl);
        break;
      }

      case 'PLAYER_JOINED': {
        console.log(`[MultiplayerManager] Player joined:`, player);
        this.updateRoomState(room);
        try {
          AudioInstance.playBeep();
        } catch (e) {}
        break;
      }

      case 'PLAYER_LEFT': {
        console.log(`[MultiplayerManager] Player left:`, msg.playerId);
        this.updateRoomState(room);
        break;
      }

      case 'MASTER_TRANSFERRED': {
        console.log(`[MultiplayerManager] Master transferred to:`, msg.masterPlayerName);
        this.masterPlayerId = msg.masterPlayerId;
        this.players = msg.players || this.players;
        this.updateLobbyUI();
        break;
      }

      case 'MASTER_NAVIGATE': {
        console.log(`[MultiplayerManager] Executing Master navigation: ${action} -> ${target}`);
        this.executeMasterNavigation(action, target);
        break;
      }

      // Mars Rover inputs from phone controllers
      case 'ROVER_MOVE': {
        MarsRoverMissionInstance.handleRemoteMove(msg.playerNumber, msg.direction, msg.active);
        break;
      }

      case 'PHOTO_MODE_START': {
        MarsRoverMissionInstance.handleRemotePhotoMode(msg.playerNumber);
        break;
      }

      case 'SAMPLE_MODE_START': {
        MarsRoverMissionInstance.handleRemoteSampleMode(msg.playerNumber);
        break;
      }

      case 'CAPTURE_PHOTO': {
        MarsRoverMissionInstance.handleRemoteCapturePhoto(msg.playerNumber);
        break;
      }

      case 'COLLECT_SAMPLE': {
        MarsRoverMissionInstance.handleRemoteCollectSample(msg.playerNumber);
        break;
      }

      case 'EXIT_MODES': {
        MarsRoverMissionInstance.handleRemoteExitModes(msg.playerNumber);
        break;
      }

      case 'GAME_STATE_PAUSE': {
        console.log('[MultiplayerManager] Received simulation pause');
        MarsRoverMissionInstance.setPaused(true);
        UIInstance.toggleModal('mars-pause-modal', true);
        break;
      }

      case 'GAME_STATE_RESUME': {
        console.log('[MultiplayerManager] Received simulation resume');
        MarsRoverMissionInstance.setPaused(false);
        UIInstance.toggleModal('mars-pause-modal', false);
        break;
      }
    }
  }

  updateRoomState(room) {
    if (!room) return;
    this.roomId = room.roomId;
    this.masterPlayerId = room.masterPlayerId;
    this.players = room.players || [];
    this.updateLobbyUI();

    // Notify Mars Rover mission of player count change
    MarsRoverMissionInstance.setMultiplayerPlayers(this.players);

    if (this.onPlayersUpdated) {
      this.onPlayersUpdated(this.players);
    }
  }

  updateLobbyUI() {
    // 1. Room Code Banner
    const codeEl = document.getElementById('lobby-room-code');
    if (codeEl) codeEl.textContent = this.roomId || '----';

    const topRoomBadge = document.getElementById('top-room-badge');
    if (topRoomBadge) {
      topRoomBadge.textContent = `ROOM: ${this.roomId || '----'} | PLAYERS: ${this.players.length}`;
    }

    const joinUrlEl = document.getElementById('lobby-join-url');
    if (joinUrlEl && this.controllerUrl) {
      joinUrlEl.textContent = this.controllerUrl;
      joinUrlEl.href = this.controllerUrl;
    }

    // Render dynamic QR code for seamless phone scanning
    const qrCanvas = document.getElementById('lobby-qr-canvas');
    if (qrCanvas && this.controllerUrl) {
      QRCode.toCanvas(qrCanvas, this.controllerUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) console.warn('[MultiplayerManager] QR rendering error:', err);
      });
    }

    // 2. Players list in lobby
    const rosterEl = document.getElementById('lobby-players-list');
    const waitingText = document.getElementById('lobby-waiting-status');

    if (rosterEl) {
      rosterEl.innerHTML = '';
      if (this.players.length === 0) {
        rosterEl.innerHTML = `
          <div class="lobby-empty-slot">
            <span class="slot-icon">⏳</span>
            <span>WAITING FOR PLAYERS TO CONNECT CONTROLLERS...</span>
          </div>
        `;
      } else {
        this.players.forEach(p => {
          const initials = (p.name || 'PL').slice(0, 2).toUpperCase();
          const card = document.createElement('div');
          card.className = `lobby-player-card ${p.isMaster ? 'master' : ''}`;
          card.innerHTML = `
            <div class="lobby-avatar">${initials}</div>
            <div class="lobby-pinfo">
              <div class="lobby-pname">
                ${p.name}
                ${p.isMaster ? `<span class="badge-master">${Icons.star(12, 'star-gold')} MASTER</span>` : ''}
              </div>
              <div class="lobby-prole">PLAYER 0${p.playerNumber} // ROVER ${p.playerNumber}</div>
            </div>
            <div class="lobby-pstatus ${p.connected ? 'online' : 'offline'}">
              ${p.connected ? `${Icons.circleDot(10)} ONLINE` : `${Icons.circle(10)} OFFLINE`}
            </div>
          `;
          rosterEl.appendChild(card);
        });
      }
    }

    if (waitingText) {
      if (this.players.length === 0) {
        waitingText.textContent = "WAITING FOR PLAYERS...";
      } else {
        const count = this.players.length;
        const masterPlayer = this.players.find(p => p.isMaster);
        const masterName = masterPlayer ? masterPlayer.name : 'MASTER';
        waitingText.textContent = `${count} PLAYER${count > 1 ? 'S' : ''} CONNECTED — WAITING FOR ${masterName} TO START`;
      }
    }
  }

  executeMasterNavigation(action, target) {
    AudioInstance.playTransition();

    switch (action) {
      case 'NAV_HOME':
        GameStateInstance.changeState('MENU');
        break;

      case 'OPEN_MISSIONS':
      case 'START_MISSION':
        GameStateInstance.changeState('PROGRESS');
        break;

      case 'LAUNCH_MARS':
        GameStateInstance.changeState('MARS_ROVER');
        break;

      case 'SELECT_MISSION':
        if (target === 'mission_3' || target === 3) {
          GameStateInstance.changeState('MARS_ROVER');
        } else if (target === 'mission_2' || target === 2) {
          GameStateInstance.changeState('EARTH_TO_MOON');
        } else {
          GameStateInstance.changeState('PROGRESS');
        }
        break;
    }
  }

  broadcastMissionComplete(playerNumber, winnerPlayerNumber) {
    this.send({
      type: 'MISSION_COMPLETE',
      roomId: this.roomId,
      payload: { playerNumber, winnerPlayerNumber }
    });
  }

  broadcastProgress(playerNumber, progress) {
    this.send({
      type: 'PLAYER_PROGRESS',
      roomId: this.roomId,
      payload: { playerNumber, progress }
    });
  }

  sendPause() {
    this.send({
      type: 'GAME_STATE_PAUSE',
      roomId: this.roomId
    });
  }

  sendResume() {
    this.send({
      type: 'GAME_STATE_RESUME',
      roomId: this.roomId
    });
  }
}

export const MultiplayerInstance = new MultiplayerManager();
export { MultiplayerManager };

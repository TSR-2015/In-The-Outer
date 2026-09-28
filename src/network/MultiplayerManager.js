// =========================================================
// IN THE OUTER // BIG SCREEN MULTIPLAYER MANAGER
// Manages Big Screen room lifecycle, replicated state mirror,
// AirConsole Host authority, and controller input dispatch.
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

    // AirConsole Replicated State Mirror
    this.stateMirror = {
      players: {}, // deviceId -> state
      screen: {
        view: 'LANDING',
        activeMission: null,
        isPaused: false,
        activePlayerCount: 2
      },
      room: {}
    };

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

      // AirConsole Replicated State Snapshot
      case 'SYNC_FULL_STATE': {
        if (msg.devices) {
          msg.devices.forEach(d => {
            this.stateMirror.players[d.id] = d.state || {};
          });
        }
        if (msg.screenState) {
          this.stateMirror.screen = msg.screenState;
        }
        this.masterPlayerId = msg.masterPlayerId;
        this.updateLobbyUI();
        break;
      }

      // AirConsole Device State Diff Broadcast
      case 'DEVICE_STATE_CHANGE': {
        const dId = msg.deviceId;
        if (dId) {
          this.stateMirror.players[dId] = {
            ...(this.stateMirror.players[dId] || {}),
            ...msg.state
          };
          // Also sync into this.players array
          const p = this.players.find(x => x.id === dId);
          if (p) {
            p.state = this.stateMirror.players[dId];
            if (msg.state.color) p.color = msg.state.color;
            if (msg.state.playerName) p.name = msg.state.playerName;
          }
          this.updateLobbyUI();
        }
        break;
      }

      case 'ACTIVE_PLAYERS_CHANGED': {
        this.stateMirror.screen.activePlayerCount = msg.activePlayerCount;
        this.players = msg.players || this.players;
        this.updateLobbyUI();
        break;
      }

      case 'PLAYER_JOINED':
      case 'PLAYER_RECONNECTED': {
        console.log(`[MultiplayerManager] Player ${type}:`, player);
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
        console.log(`[MultiplayerManager] Host transferred to:`, msg.masterPlayerName);
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

      case 'ROVER_STOP': {
        MarsRoverMissionInstance.handleRemoteStop(msg.playerNumber);
        break;
      }

      case 'ROVER_MOVE_STATE': {
        MarsRoverMissionInstance.handleRemoteMoveState(msg.playerNumber, msg.keys);
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

    // Mirror each player's state
    this.players.forEach(p => {
      if (p.state) {
        this.stateMirror.players[p.id] = p.state;
      }
    });

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

    // Render dynamic QR code on crisp light backing
    const qrCanvas = document.getElementById('lobby-qr-canvas');
    if (qrCanvas && this.controllerUrl) {
      QRCode.toCanvas(qrCanvas, this.controllerUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#050817',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) console.warn('[MultiplayerManager] QR rendering error:', err);
      });
    }

    // 2. Players list in lobby rendered from Replicated State Mirror
    const rosterEl = document.getElementById('lobby-players-list');
    const waitingText = document.getElementById('lobby-waiting-status');

    if (rosterEl) {
      rosterEl.innerHTML = '';
      if (this.players.length === 0) {
        rosterEl.innerHTML = `
          <div class="lobby-empty-slot">
            <span class="slot-icon">${Icons.timer(20)}</span>
            <span>WAITING FOR PLAYERS TO CONNECT CONTROLLERS...</span>
          </div>
        `;
      } else {
        this.players.forEach(p => {
          const pState = this.stateMirror.players[p.id] || p.state || {};
          const pColor = pState.color || '#00f0ff';
          const initials = (p.name || 'PL').slice(0, 2).toUpperCase();
          const isHost = p.id === this.masterPlayerId || p.isMaster;
          const isReady = !!pState.isReady;
          const isSpectating = pState.role === 'spectator';

          const card = document.createElement('div');
          card.className = `lobby-player-card ${isHost ? 'master' : ''}`;
          card.innerHTML = `
            <div class="lobby-avatar" style="background: radial-gradient(circle at 35% 30%, ${pColor} 0%, #070c20 100%); border-color: ${pColor};">
              ${initials}
            </div>
            <div class="lobby-pinfo">
              <div class="lobby-pname">
                <span style="color: ${pColor}; font-weight: 800;">${p.name}</span>
                ${isHost ? `<span class="badge-master">${Icons.star(12, 'star-gold')} HOST</span>` : ''}
                ${isSpectating ? `<span class="badge-spectator">SPECTATOR</span>` : ''}
              </div>
              <div class="lobby-prole font-mono">
                PLAYER 0${p.playerNumber} // ${isReady ? 'READY' : 'NOT READY'}
              </div>
            </div>
            <div class="lobby-pstatus ${p.connected ? 'online' : 'offline'} font-mono">
              ${p.connected
                ? (isReady ? `${Icons.check(12)} READY` : `${Icons.circleDot(10)} CONNECTED`)
                : `${Icons.circle(10)} RECONNECTING...`
              }
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
        const hostPlayer = this.players.find(p => p.id === this.masterPlayerId || p.isMaster);
        const hostName = hostPlayer ? hostPlayer.name : 'HOST';
        waitingText.textContent = `${count} CONTROLLER${count > 1 ? 'S' : ''} CONNECTED — WAITING FOR ${hostName} TO START`;
      }
    }
  }

  setActivePlayers(count) {
    this.send({
      type: 'SET_ACTIVE_PLAYERS',
      roomId: this.roomId,
      count
    });
  }

  setControllersView(view, missionId = null) {
    this.send({
      type: 'SET_CONTROLLERS_VIEW',
      roomId: this.roomId,
      view,
      missionId
    });
  }

  executeMasterNavigation(action, target) {
    AudioInstance.playTransition();

    switch (action) {
      case 'NAV_HOME':
        GameStateInstance.changeState('MENU');
        this.setControllersView('LOBBY');
        break;

      case 'OPEN_MISSIONS':
      case 'START_MISSION':
        GameStateInstance.changeState('PROGRESS');
        this.setControllersView('LOBBY');
        break;

      case 'LAUNCH_MARS':
        GameStateInstance.changeState('MARS_ROVER');
        this.setControllersView('MISSION_CONTROL', 'MARS_ROVER');
        break;

      case 'SELECT_MISSION':
        if (target === 'mission_3' || target === 3) {
          GameStateInstance.changeState('MARS_ROVER');
          this.setControllersView('MISSION_CONTROL', 'MARS_ROVER');
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

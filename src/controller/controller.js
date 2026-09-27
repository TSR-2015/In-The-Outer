// =========================================================
// IN THE OUTER // AIRCONSOLE-STYLE HANDHELD CONTROLLER CLIENT
// Replicated Device State Engine, ViewManager, and Input Surface.
// Zero 3D rendering on device — pure tactile input deck.
// =========================================================

import { Icons } from '../ui/Icons.js';

class PhoneController {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.playerId = localStorage.getItem('in_the_outer_player_id') || null;
    this.playerName = localStorage.getItem('in_the_outer_player_name') || null;
    this.playerNumber = 1;

    // Replicated Device State (AirConsole Custom Device State)
    this.state = {
      view: 'JOIN', // 'JOIN' | 'LOBBY' | 'MISSION_CONTROL' | 'PAUSED' | 'RESULTS'
      playerName: this.playerName || '',
      color: '#00f0ff',
      isReady: false,
      isHost: false,
      role: 'active', // 'active' | 'spectator'
      connected: false,
      score: 0,
      rank: 1,
      missionMode: 'DRIVE' // 'DRIVE' | 'PHOTO' | 'SAMPLE'
    };

    // Active movement directions set
    this.activeDirections = new Set();
    this.isActionDebouncing = false;

    // DOM Elements Cache
    this.els = {};

    this.init();
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.initFromUrlOrStorage();
  }

  cacheElements() {
    // Top Strip
    this.els.avatar = document.getElementById('player-avatar');
    this.els.playerNameDisplay = document.getElementById('player-name-display');
    this.els.playerHostBadge = document.getElementById('player-host-badge');
    this.els.playerSpectatorBadge = document.getElementById('player-spectator-badge');
    this.els.playerSlotDisplay = document.getElementById('player-slot-display');
    this.els.connectionLed = document.getElementById('connection-led');
    this.els.connectionLabel = document.getElementById('connection-label');
    this.els.roomCodeDisplay = document.getElementById('room-code-display');
    this.els.btnHardwarePause = document.getElementById('btn-hardware-pause');

    // Views
    this.views = {
      JOIN: document.getElementById('view-join'),
      LOBBY: document.getElementById('view-lobby'),
      MISSION_CONTROL: document.getElementById('view-mission'),
      PAUSED: document.getElementById('view-paused'),
      RESULTS: document.getElementById('view-results')
    };

    // View 1: Join
    this.els.authForm = document.getElementById('auth-form');
    this.els.roomcodeInput = document.getElementById('roomcode-input');
    this.els.usernameInput = document.getElementById('username-input');
    this.els.colorSwatches = document.querySelectorAll('.ctrl-color-swatch');
    this.els.btnAuthJoin = document.getElementById('btn-auth-join');
    this.els.authErrorMsg = document.getElementById('auth-error-msg');

    // View 2: Lobby
    this.els.lobbyAvatar = document.getElementById('lobby-user-avatar');
    this.els.lobbyName = document.getElementById('lobby-user-name');
    this.els.lobbyStatusText = document.getElementById('lobby-user-status-text');
    this.els.btnToggleReady = document.getElementById('btn-toggle-ready');
    this.els.readyToggleIcon = document.getElementById('ready-toggle-icon');
    this.els.readyToggleText = document.getElementById('ready-toggle-text');
    this.els.hostControlsBlock = document.getElementById('host-controls-block');
    this.els.nonHostWaitingBlock = document.getElementById('non-host-waiting-block');
    this.els.btnHostLaunchMars = document.getElementById('btn-host-launch-mars');
    this.els.btnHostNavMissions = document.getElementById('btn-host-nav-missions');
    this.els.btnHostNavHome = document.getElementById('btn-host-nav-home');

    // View 3: Mission Control
    this.els.driverGamepadDeck = document.getElementById('driver-gamepad-deck');
    this.els.spectatorDeck = document.getElementById('spectator-deck');
    this.els.modePill = document.getElementById('controller-mode-pill');
    this.els.lcdStatusMsg = document.getElementById('lcd-status-msg');
    this.els.dpadButtons = document.querySelectorAll('.dpad-btn');
    this.els.btnA = document.getElementById('btn-action-a');
    this.els.btnB = document.getElementById('btn-action-b');
    this.els.btnC = document.getElementById('btn-action-c');

    // View 4: Paused
    this.els.hostPauseActions = document.getElementById('host-pause-actions');
    this.els.clientPauseWaiting = document.getElementById('client-pause-waiting');
    this.els.pauseStatusSub = document.getElementById('pause-status-sub');
    this.els.btnPauseResume = document.getElementById('btn-pause-resume');
    this.els.btnPauseExit = document.getElementById('btn-pause-exit');

    // View 5: Results
    this.els.resultHeadline = document.getElementById('result-headline');
    this.els.resultScoreVal = document.getElementById('result-score-val');
    this.els.btnResultReturn = document.getElementById('btn-result-return');
  }

  initFromUrlOrStorage() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && this.els.roomcodeInput) {
      this.els.roomcodeInput.value = roomParam.toUpperCase().trim();
    }

    if (this.playerName && this.els.usernameInput) {
      this.els.usernameInput.value = this.playerName;
    }

    // Auto-reconnect if both credentials exist
    if (roomParam && this.playerName) {
      this.connectToRoom(roomParam.toUpperCase().trim(), this.playerName);
    }
  }

  // =========================================================
  // AIRCONSOLE REPLICATED DEVICE STATE ENGINE
  // =========================================================
  setState(diff) {
    this.state = { ...this.state, ...diff };
    this.renderFromState();

    // Broadcast state diff to server & other devices
    this.send({
      type: 'SET_STATE',
      roomId: this.roomId,
      playerId: this.playerId,
      state: diff
    });
  }

  showView(viewName) {
    if (!this.views[viewName]) {
      console.warn(`[ViewManager] View "${viewName}" not registered.`);
      return;
    }

    Object.keys(this.views).forEach(key => {
      if (this.views[key]) {
        this.views[key].classList.toggle('active', key === viewName);
      }
    });

    // Hardware pause button only available in active mission
    if (this.els.btnHardwarePause) {
      this.els.btnHardwarePause.classList.toggle('hidden', viewName !== 'MISSION_CONTROL');
    }
  }

  renderFromState() {
    const s = this.state;

    // 1. Switch View
    this.showView(s.view);

    // 2. Update Dynamic CSS Theme Color
    document.documentElement.style.setProperty('--player-color', s.color || '#00f0ff');

    // 3. Top Strip Profile
    const initials = (s.playerName || 'PL').slice(0, 2).toUpperCase();
    if (this.els.avatar) this.els.avatar.textContent = initials;
    if (this.els.playerNameDisplay) this.els.playerNameDisplay.textContent = s.playerName || 'PILOT LINK';

    if (this.els.playerHostBadge) {
      this.els.playerHostBadge.classList.toggle('hidden', !s.isHost);
    }
    if (this.els.playerSpectatorBadge) {
      this.els.playerSpectatorBadge.classList.toggle('hidden', s.role !== 'spectator');
    }

    if (this.els.playerSlotDisplay) {
      this.els.playerSlotDisplay.textContent = s.connected
        ? `PLAYER 0${this.playerNumber} // ${s.role.toUpperCase()}`
        : 'DISCONNECTED';
    }

    if (this.els.roomCodeDisplay) {
      this.els.roomCodeDisplay.textContent = this.roomId || '----';
    }

    // 4. View 2: Lobby Updates
    if (this.els.lobbyAvatar) this.els.lobbyAvatar.textContent = initials;
    if (this.els.lobbyName) this.els.lobbyName.textContent = s.playerName || 'PILOT';
    if (this.els.lobbyStatusText) {
      this.els.lobbyStatusText.textContent = s.isHost ? 'ROOM HOST — READY TO LAUNCH' : 'IN LOBBY';
    }

    if (this.els.btnToggleReady) {
      this.els.btnToggleReady.classList.toggle('is-ready', !!s.isReady);
      if (this.els.readyToggleText) {
        this.els.readyToggleText.textContent = s.isReady ? 'READY TO LAUNCH' : 'SET READY';
      }
    }

    // Host vs Non-Host Lobby Controls
    if (this.els.hostControlsBlock) {
      this.els.hostControlsBlock.classList.toggle('hidden', !s.isHost);
    }
    if (this.els.nonHostWaitingBlock) {
      this.els.nonHostWaitingBlock.classList.toggle('hidden', !!s.isHost);
    }

    // 5. View 3: Mission Control (Active Driver vs Spectator)
    const isSpectating = s.role === 'spectator';
    if (this.els.driverGamepadDeck) {
      this.els.driverGamepadDeck.classList.toggle('hidden', isSpectating);
    }
    if (this.els.spectatorDeck) {
      this.els.spectatorDeck.classList.toggle('hidden', !isSpectating);
    }

    if (this.els.modePill) {
      this.els.modePill.className = `controller-mode-pill mode-${(s.missionMode || 'DRIVE').toLowerCase()} font-mono`;
      this.els.modePill.textContent = s.missionMode || 'DRIVE';
    }

    // 6. View 4: Paused
    if (this.els.hostPauseActions) {
      this.els.hostPauseActions.classList.toggle('hidden', !s.isHost);
    }
    if (this.els.clientPauseWaiting) {
      this.els.clientPauseWaiting.classList.toggle('hidden', !!s.isHost);
    }

    // 7. View 5: Results
    if (this.els.resultScoreVal) {
      this.els.resultScoreVal.textContent = s.score || 0;
    }
  }

  // =========================================================
  // WEBSOCKET LINK & DISPATCH
  // =========================================================
  connectToRoom(roomId, playerName) {
    this.roomId = roomId.toUpperCase().trim();
    this.playerName = playerName.toUpperCase().trim();

    this.setConnectionIndicator('CONNECTING');
    if (this.els.authErrorMsg) this.els.authErrorMsg.textContent = 'CONNECTING TO MISSION LINK...';

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[AirConsole Controller] WebSocket connected.');
      this.setConnectionIndicator('ONLINE');

      // Send join request with initial state payload
      this.send({
        type: 'ROOM_JOIN',
        roomId: this.roomId,
        playerId: this.playerId,
        payload: {
          name: this.playerName,
          color: this.state.color
        }
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[AirConsole Controller] Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[AirConsole Controller] WebSocket disconnected. Auto-reconnecting in 2s...');
      this.setConnectionIndicator('OFFLINE');
      this.state.connected = false;
      this.renderFromState();

      // Graceful auto-reconnect
      setTimeout(() => {
        if (this.roomId && this.playerName) {
          this.connectToRoom(this.roomId, this.playerName);
        }
      }, 2000);
    };

    this.ws.onerror = (err) => {
      console.error('[AirConsole Controller] Socket error:', err);
      if (this.els.authErrorMsg) this.els.authErrorMsg.textContent = 'Connection error. Check room code.';
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleMessage(msg) {
    const { type, player, isHost, masterPlayerId, players, payload } = msg;

    switch (type) {
      case 'JOIN_SUCCESS': {
        this.playerId = player.id;
        this.playerName = player.name;
        this.playerNumber = player.playerNumber;

        // Persist session credentials for 60s grace reconnects
        localStorage.setItem('in_the_outer_player_id', this.playerId);
        localStorage.setItem('in_the_outer_player_name', this.playerName);

        const initialView = (player.state && player.state.view) ? player.state.view : 'LOBBY';
        this.state = {
          ...this.state,
          ...(player.state || {}),
          view: initialView,
          playerName: player.name,
          isHost: !!(isHost || player.isMaster),
          connected: true,
          score: player.score || 0,
          rank: player.rank || 1
        };

        this.renderFromState();
        this.vibrate(40);
        break;
      }

      // AirConsole Device State Rehydration
      case 'SYNC_FULL_STATE': {
        console.log('[AirConsole Controller] Full state sync received:', msg);
        if (msg.selfState) {
          this.state = {
            ...this.state,
            ...msg.selfState,
            isHost: msg.masterPlayerId === this.playerId,
            connected: true
          };
          this.renderFromState();
        }
        break;
      }

      case 'DEVICE_STATE_CHANGE': {
        if (msg.deviceId === this.playerId) {
          this.state = { ...this.state, ...msg.state };
          this.renderFromState();
        }
        break;
      }

      case 'CONTROLLERS_VIEW_CHANGED': {
        console.log('[AirConsole Controller] View switched by Screen:', msg.view);
        this.state.view = msg.view;
        this.renderFromState();
        this.vibrate(50);
        break;
      }

      case 'ACTIVE_PLAYERS_CHANGED': {
        const count = msg.activePlayerCount || 2;
        const newRole = this.playerNumber <= count ? 'active' : 'spectator';
        this.state.role = newRole;
        this.renderFromState();
        break;
      }

      case 'MASTER_TRANSFERRED': {
        const amHost = msg.masterPlayerId === this.playerId;
        this.state.isHost = amHost;
        this.renderFromState();
        if (amHost) {
          this.vibrate([40, 60, 40]);
          if (this.els.lcdStatusMsg) {
            this.els.lcdStatusMsg.textContent = 'YOU ARE NOW ROOM HOST';
          }
        }
        break;
      }

      case 'PHOTO_MODE_START': {
        if (msg.playerId === this.playerId) {
          this.state.missionMode = 'PHOTO';
          this.renderFromState();
          this.vibrate(30);
        }
        break;
      }

      case 'SAMPLE_MODE_START': {
        if (msg.playerId === this.playerId) {
          this.state.missionMode = 'SAMPLE';
          this.renderFromState();
          this.vibrate(30);
        }
        break;
      }

      case 'CAPTURE_PHOTO': {
        if (msg.playerId === this.playerId) {
          this.vibrate(80);
          this.state.missionMode = 'DRIVE';
          this.renderFromState();
        }
        break;
      }

      case 'COLLECT_SAMPLE': {
        if (msg.playerId === this.playerId) {
          this.vibrate(100);
          this.state.missionMode = 'DRIVE';
          this.renderFromState();
        }
        break;
      }

      case 'EXIT_MODES': {
        if (msg.playerNumber === this.playerNumber) {
          this.state.missionMode = 'DRIVE';
          this.renderFromState();
        }
        break;
      }

      case 'SCORE_UPDATE': {
        const myData = (players || []).find(p => p.id === this.playerId);
        if (myData) {
          this.state.score = myData.score;
          this.state.rank = myData.rank;
          this.renderFromState();
        }
        break;
      }

      case 'GAME_STATE_PAUSE': {
        this.state.view = 'PAUSED';
        this.renderFromState();
        this.vibrate(40);
        break;
      }

      case 'GAME_STATE_RESUME': {
        this.state.view = 'MISSION_CONTROL';
        this.renderFromState();
        this.vibrate(40);
        break;
      }

      case 'MISSION_COMPLETE': {
        const won = msg.winnerPlayerNumber === this.playerNumber;
        this.state.view = 'RESULTS';
        if (this.els.resultHeadline) {
          this.els.resultHeadline.textContent = won ? 'YOU WIN!' : 'MISSION COMPLETE';
          this.els.resultHeadline.style.color = won ? '#ffc857' : '#f7f9ff';
        }
        this.renderFromState();
        this.vibrate(won ? [100, 50, 100, 50, 150] : [80, 80]);
        break;
      }

      case 'ERROR': {
        if (this.els.authErrorMsg) {
          this.els.authErrorMsg.textContent = msg.message || 'Error occurred';
        }
        if (msg.code === 'ROOM_NOT_FOUND') {
          this.showView('JOIN');
        }
        this.vibrate([40, 40]);
        break;
      }
    }
  }

  setConnectionIndicator(status) {
    if (!this.els.connectionLed || !this.els.connectionLabel) return;
    if (status === 'ONLINE') {
      this.els.connectionLed.style.backgroundColor = '#35d07f';
      this.els.connectionLed.style.boxShadow = '0 0 8px rgba(53, 208, 127, 0.8)';
      this.els.connectionLabel.textContent = 'ONLINE';
      this.els.connectionLabel.style.color = '#35d07f';
    } else if (status === 'CONNECTING') {
      this.els.connectionLed.style.backgroundColor = '#ffc857';
      this.els.connectionLed.style.boxShadow = '0 0 8px rgba(255, 200, 87, 0.8)';
      this.els.connectionLabel.textContent = 'LINKING';
      this.els.connectionLabel.style.color = '#ffc857';
    } else {
      this.els.connectionLed.style.backgroundColor = '#ef4444';
      this.els.connectionLed.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.8)';
      this.els.connectionLabel.textContent = 'OFFLINE';
      this.els.connectionLabel.style.color = '#ef4444';
    }
  }

  vibrate(pattern) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  // =========================================================
  // DOM EVENT LISTENERS
  // =========================================================
  bindEvents() {
    // 1. Join Form & Color Swatches
    if (this.els.authForm) {
      this.els.authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const room = this.els.roomcodeInput.value.toUpperCase().trim();
        const name = this.els.usernameInput.value.trim();

        if (!room || room.length !== 4) {
          if (this.els.authErrorMsg) this.els.authErrorMsg.textContent = 'ENTER 4-CHARACTER ROOM CODE';
          return;
        }
        if (!name) {
          if (this.els.authErrorMsg) this.els.authErrorMsg.textContent = 'ENTER PILOT CODENAME';
          return;
        }

        this.connectToRoom(room, name);
      });
    }

    this.els.colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        this.els.colorSwatches.forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        const color = swatch.dataset.color;
        this.vibrate(20);
        this.setState({ color });
      });
    });

    // 2. Lobby Ready Toggle
    if (this.els.btnToggleReady) {
      this.els.btnToggleReady.addEventListener('click', (e) => {
        e.preventDefault();
        this.vibrate(30);
        this.setState({ isReady: !this.state.isReady });
      });
    }

    // 3. Host Remote Launch Controls
    if (this.els.btnHostLaunchMars) {
      this.els.btnHostLaunchMars.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.state.isHost) return;
        this.vibrate(40);
        this.send({
          type: 'MASTER_NAVIGATE',
          roomId: this.roomId,
          playerId: this.playerId,
          payload: { action: 'LAUNCH_MARS' }
        });
        // Switch all controllers into MISSION_CONTROL view
        this.send({
          type: 'SET_CONTROLLERS_VIEW',
          roomId: this.roomId,
          view: 'MISSION_CONTROL',
          missionId: 'MARS_ROVER'
        });
      });
    }

    if (this.els.btnHostNavMissions) {
      this.els.btnHostNavMissions.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.state.isHost) return;
        this.vibrate(30);
        this.send({
          type: 'MASTER_NAVIGATE',
          roomId: this.roomId,
          playerId: this.playerId,
          payload: { action: 'OPEN_MISSIONS' }
        });
      });
    }

    if (this.els.btnHostNavHome) {
      this.els.btnHostNavHome.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.state.isHost) return;
        this.vibrate(30);
        this.send({
          type: 'MASTER_NAVIGATE',
          roomId: this.roomId,
          playerId: this.playerId,
          payload: { action: 'NAV_HOME' }
        });
      });
    }

    // 4. Hardware Pause Controls (Host only if on controller)
    const handlePauseToggle = (e) => {
      e.preventDefault();
      this.vibrate(30);
      if (!this.state.isHost) {
        if (this.els.lcdStatusMsg) {
          this.els.lcdStatusMsg.textContent = 'ONLY HOST CAN PAUSE MISSION';
        }
        return;
      }
      this.send({
        type: this.state.view === 'PAUSED' ? 'GAME_STATE_RESUME' : 'GAME_STATE_PAUSE',
        roomId: this.roomId,
        playerId: this.playerId
      });
    };

    if (this.els.btnHardwarePause) {
      this.els.btnHardwarePause.addEventListener('touchstart', handlePauseToggle, { passive: false });
      this.els.btnHardwarePause.addEventListener('click', handlePauseToggle);
    }
    if (this.els.btnPauseResume) {
      this.els.btnPauseResume.addEventListener('click', handlePauseToggle);
    }
    if (this.els.btnPauseExit) {
      this.els.btnPauseExit.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.state.isHost) return;
        this.vibrate(30);
        this.send({
          type: 'SET_CONTROLLERS_VIEW',
          roomId: this.roomId,
          view: 'LOBBY'
        });
        this.send({
          type: 'MASTER_NAVIGATE',
          roomId: this.roomId,
          playerId: this.playerId,
          payload: { action: 'OPEN_MISSIONS' }
        });
      });
    }

    // 5. Tactile Gamepad Inputs (D-Pad)
    this.els.dpadButtons.forEach(btn => {
      const dir = btn.dataset.dir;

      const onPress = (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        this.vibrate(20);
        this.activeDirections.add(dir);
        this.sendRoverMove(dir, true);
      };

      const onRelease = (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        this.activeDirections.delete(dir);
        this.sendRoverMove(dir, false);
      };

      btn.addEventListener('touchstart', onPress, { passive: false });
      btn.addEventListener('touchend', onRelease, { passive: false });
      btn.addEventListener('touchcancel', onRelease, { passive: false });
      btn.addEventListener('mousedown', onPress);
      btn.addEventListener('mouseup', onRelease);
      btn.addEventListener('mouseleave', onRelease);
    });

    // 6. Action Button A (Photo Mode Toggle)
    const handleBtnA = (e) => {
      e.preventDefault();
      this.vibrate(25);
      if (this.els.btnA) {
        this.els.btnA.classList.add('pressed');
        setTimeout(() => this.els.btnA.classList.remove('pressed'), 120);
      }

      if (this.state.missionMode === 'PHOTO') {
        this.send({ type: 'EXIT_MODES', roomId: this.roomId, playerId: this.playerId });
        this.state.missionMode = 'DRIVE';
      } else {
        this.send({ type: 'PHOTO_MODE_START', roomId: this.roomId, playerId: this.playerId });
        this.state.missionMode = 'PHOTO';
      }
      this.renderFromState();
    };
    if (this.els.btnA) {
      this.els.btnA.addEventListener('touchstart', handleBtnA, { passive: false });
      this.els.btnA.addEventListener('click', handleBtnA);
    }

    // 7. Action Button B (Sample Mode Toggle)
    const handleBtnB = (e) => {
      e.preventDefault();
      this.vibrate(25);
      if (this.els.btnB) {
        this.els.btnB.classList.add('pressed');
        setTimeout(() => this.els.btnB.classList.remove('pressed'), 120);
      }

      if (this.state.missionMode === 'SAMPLE') {
        this.send({ type: 'EXIT_MODES', roomId: this.roomId, playerId: this.playerId });
        this.state.missionMode = 'DRIVE';
      } else {
        this.send({ type: 'SAMPLE_MODE_START', roomId: this.roomId, playerId: this.playerId });
        this.state.missionMode = 'SAMPLE';
      }
      this.renderFromState();
    };
    if (this.els.btnB) {
      this.els.btnB.addEventListener('touchstart', handleBtnB, { passive: false });
      this.els.btnB.addEventListener('click', handleBtnB);
    }

    // 8. Action Button C (Confirm / Capture / Sample)
    const handleBtnC = (e) => {
      e.preventDefault();
      this.vibrate(35);
      if (this.els.btnC) {
        this.els.btnC.classList.add('pressed');
        setTimeout(() => this.els.btnC.classList.remove('pressed'), 120);
      }

      if (this.isActionDebouncing) return;

      if (this.state.missionMode === 'PHOTO') {
        this.isActionDebouncing = true;
        this.send({ type: 'CAPTURE_PHOTO', roomId: this.roomId, playerId: this.playerId });
        setTimeout(() => { this.isActionDebouncing = false; }, 1000);
      } else if (this.state.missionMode === 'SAMPLE') {
        this.isActionDebouncing = true;
        this.send({ type: 'COLLECT_SAMPLE', roomId: this.roomId, playerId: this.playerId, payload: { inRange: true } });
        setTimeout(() => { this.isActionDebouncing = false; }, 1000);
      } else {
        if (this.els.lcdStatusMsg) {
          this.els.lcdStatusMsg.textContent = 'SCANNING MARTIAN TERRAIN...';
        }
      }
    };
    if (this.els.btnC) {
      this.els.btnC.addEventListener('touchstart', handleBtnC, { passive: false });
      this.els.btnC.addEventListener('click', handleBtnC);
    }

    // 9. Results View Return to Lobby
    if (this.els.btnResultReturn) {
      this.els.btnResultReturn.addEventListener('click', (e) => {
        e.preventDefault();
        this.vibrate(30);
        this.setState({ view: 'LOBBY', isReady: false });
      });
    }
  }

  sendRoverMove(direction, active) {
    this.send({
      type: 'ROVER_MOVE',
      roomId: this.roomId,
      playerId: this.playerId,
      payload: { direction, active }
    });
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new PhoneController();
});

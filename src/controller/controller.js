// =========================================================
// IN THE OUTER // PHYSICAL MISSION CONTROLLER CLIENT
// Handles WebSocket link, touch haptics, physical button states,
// Master remote commands, and real-time telemetry.
// =========================================================

import { Icons } from '../ui/Icons.js';

class PhoneController {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.playerId = localStorage.getItem('in_the_outer_player_id') || localStorage.getItem('solar_player_id') || null;
    this.playerName = localStorage.getItem('in_the_outer_player_name') || localStorage.getItem('solar_player_name') || null;
    this.playerNumber = 1;
    this.isMaster = false;
    this.score = 0;
    this.rank = 1;
    this.isPaused = false;

    // Active Modes
    this.mode = 'DRIVE'; // 'DRIVE', 'PHOTO', 'SAMPLE'
    this.isCapturing = false;

    // Movement tracking
    this.activeDirections = new Set();

    // DOM Elements Cache
    this.els = {};

    this.init();
  }

  init() {
    this.cacheElements();
    this.bindAuthForm();
    this.bindHardwareControls();
    this.bindPauseControls();
    this.bindMasterControls();
    this.initFromUrlOrStorage();
  }

  cacheElements() {
    this.els.authModal = document.getElementById('auth-modal');
    this.els.authForm = document.getElementById('auth-form');
    this.els.usernameInput = document.getElementById('username-input');
    this.els.roomcodeInput = document.getElementById('roomcode-input');
    this.els.authErrorMsg = document.getElementById('auth-error-msg');

    this.els.avatar = document.getElementById('player-avatar');
    this.els.nameDisplay = document.getElementById('player-name-display');
    this.els.numberDisplay = document.getElementById('player-number-display');
    this.els.masterBadge = document.getElementById('player-master-badge');
    this.els.roomCodeDisplay = document.getElementById('room-code-display');
    this.els.connectionLed = document.getElementById('connection-led');
    this.els.connectionLabel = document.getElementById('connection-label');

    this.els.modePill = document.getElementById('controller-mode-pill');
    this.els.btnPause = document.getElementById('btn-controller-pause');
    this.els.pauseOverlay = document.getElementById('controller-pause-overlay');
    this.els.btnResume = document.getElementById('btn-controller-resume');

    this.els.lcdDisplay = document.getElementById('lcd-display');
    this.els.lcdMain = document.getElementById('lcd-main-status');
    this.els.lcdSub = document.getElementById('lcd-sub-status');
    this.els.scoreDisplay = document.getElementById('controller-score');
    this.els.rankDisplay = document.getElementById('controller-rank');

    this.els.wellA = document.getElementById('well-a');
    this.els.wellB = document.getElementById('well-b');
    this.els.wellC = document.getElementById('well-c');
    this.els.btnA = document.getElementById('btn-action-a');
    this.els.btnB = document.getElementById('btn-action-b');
    this.els.btnC = document.getElementById('btn-action-c');

    this.els.masterDock = document.getElementById('master-dock');
    this.els.masterStatus = document.getElementById('master-dock-status');

    this.els.resultModal = document.getElementById('result-modal');
    this.els.resultCard = document.getElementById('result-card');
    this.els.resultTitle = document.getElementById('result-title');
    this.els.resultTrophy = document.getElementById('result-trophy');
    this.els.resultScoreVal = document.getElementById('result-score-val');
    this.els.btnResultDismiss = document.getElementById('btn-result-dismiss');
  }

  initFromUrlOrStorage() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      this.els.roomcodeInput.value = roomParam;
    }

    if (this.playerName) {
      this.els.usernameInput.value = this.playerName;
      // If room is provided, can auto-connect
      if (roomParam) {
        this.connectToRoom(roomParam, this.playerName);
      }
    }
  }

  // =========================================================
  // WEBSOCKET LINK & DISPATCH
  // =========================================================
  connectToRoom(roomId, playerName) {
    this.roomId = roomId;
    this.playerName = playerName.toUpperCase().trim();

    this.setConnectionState('CONNECTING');
    this.els.authErrorMsg.textContent = 'CONNECTING TO MISSION LINK...';

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected to server.');
      this.setConnectionState('ONLINE');

      // Send join request
      this.send({
        type: 'ROOM_JOIN',
        roomId: this.roomId,
        playerId: this.playerId,
        payload: { name: this.playerName }
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[WebSocket] Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[WebSocket] Connection closed.');
      this.setConnectionState('OFFLINE');
    };

    this.ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err);
      this.els.authErrorMsg.textContent = 'Connection error. Check room code.';
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleMessage(msg) {
    const { type, player, isMaster, masterPlayerId, players, payload } = msg;

    switch (type) {
      case 'JOIN_SUCCESS': {
        this.playerId = player.id;
        this.playerName = player.name;
        this.playerNumber = player.playerNumber;
        this.isMaster = isMaster;
        this.score = player.score;
        this.rank = player.rank;

        // Persist credentials
        localStorage.setItem('in_the_outer_player_id', this.playerId);
        localStorage.setItem('in_the_outer_player_name', this.playerName);

        this.updateProfileUI();
        this.els.authModal.classList.add('hidden');
        this.vibrate(50);
        break;
      }

      case 'ERROR': {
        this.els.authErrorMsg.textContent = msg.message || 'Error occurred';
        if (msg.code === 'ROOM_NOT_FOUND') {
          this.els.authModal.classList.remove('hidden');
        }
        break;
      }

      case 'MASTER_TRANSFERRED': {
        if (msg.masterPlayerId === this.playerId) {
          this.isMaster = true;
          this.updateProfileUI();
          this.setLCD('YOU ARE NOW MISSION MASTER', 'Full mission navigation granted.');
          this.vibrate([40, 60, 40]);
        } else {
          this.isMaster = false;
          this.updateProfileUI();
        }
        break;
      }

      case 'SCORE_UPDATE': {
        const myData = (players || []).find(p => p.id === this.playerId);
        if (myData) {
          this.score = myData.score;
          this.rank = myData.rank;
          this.els.scoreDisplay.textContent = this.score;
          this.els.rankDisplay.textContent = this.rank === 1 ? '1ST' : '2ND';
        }
        break;
      }

      case 'PHOTO_MODE_START': {
        if (msg.playerId === this.playerId) {
          this.setMode('PHOTO');
        }
        break;
      }

      case 'SAMPLE_MODE_START': {
        if (msg.playerId === this.playerId) {
          this.setMode('SAMPLE');
        }
        break;
      }

      case 'CAPTURE_PHOTO': {
        if (msg.playerId === this.playerId) {
          this.vibrate(80);
          this.setLCD('PHOTO CAPTURED! +1000 PTS', 'Returning to driving mode...');
          setTimeout(() => this.setMode('DRIVE'), 1400);
        }
        break;
      }

      case 'COLLECT_SAMPLE': {
        if (msg.playerId === this.playerId) {
          this.vibrate(100);
          this.setLCD('SAMPLE COLLECTED! +2000 PTS', 'Scientific canister secured.');
          setTimeout(() => this.setMode('DRIVE'), 1400);
        }
        break;
      }

      case 'NOTIFICATION': {
        this.setLCD(msg.message, '');
        this.vibrate([30, 40]);
        break;
      }

      case 'EXIT_MODES': {
        if (msg.playerNumber === this.playerNumber) {
          this.setMode('DRIVE');
        }
        break;
      }

      case 'MISSION_COMPLETE': {
        const won = msg.winnerPlayerNumber === this.playerNumber;
        this.showResultScreen(won);
        break;
      }

      case 'GAME_STATE_PAUSE': {
        this.setPaused(true);
        this.setLCD('MISSION PAUSED', 'Simulation paused from command console.');
        this.vibrate(50);
        break;
      }

      case 'GAME_STATE_RESUME': {
        this.setPaused(false);
        this.setLCD('MISSION RESUMED', 'Drive and explore Martian terrain.');
        this.vibrate(50);
        break;
      }
    }
  }

  // =========================================================
  // UI UPDATES & PROFILE
  // =========================================================
  updateProfileUI() {
    // Generate circular avatar from first 2 uppercase letters
    const initials = (this.playerName || 'PL').slice(0, 2).toUpperCase();
    if (this.els.avatar) this.els.avatar.textContent = initials;
    if (this.els.nameDisplay) this.els.nameDisplay.textContent = this.playerName;
    if (this.els.numberDisplay) this.els.numberDisplay.textContent = `PLAYER ${this.playerNumber} // ROVER ${this.playerNumber}`;
    if (this.els.roomCodeDisplay) this.els.roomCodeDisplay.textContent = this.roomId;

    if (this.isMaster) {
      if (this.els.masterBadge) this.els.masterBadge.classList.remove('hidden');
      if (this.els.masterDock) {
        this.els.masterDock.classList.remove('locked', 'hidden');
        if (this.els.masterStatus) {
          this.els.masterStatus.textContent = 'ACTIVE';
          this.els.masterStatus.style.color = '#f59e0b';
        }
      }
    } else {
      if (this.els.masterBadge) this.els.masterBadge.classList.add('hidden');
      if (this.els.masterDock) {
        this.els.masterDock.classList.add('locked', 'hidden');
      }
    }
  }

  setConnectionState(status) {
    if (!this.els.connectionLed || !this.els.connectionLabel) return;
    if (status === 'ONLINE') {
      this.els.connectionLed.style.backgroundColor = '#22c55e';
      this.els.connectionLed.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.8)';
      this.els.connectionLabel.textContent = 'ONLINE';
      this.els.connectionLabel.style.color = '#4ade80';
    } else if (status === 'CONNECTING') {
      this.els.connectionLed.style.backgroundColor = '#f59e0b';
      this.els.connectionLed.style.boxShadow = '0 0 8px rgba(245, 158, 11, 0.8)';
      this.els.connectionLabel.textContent = 'LINKING';
      this.els.connectionLabel.style.color = '#fbbf24';
    } else {
      this.els.connectionLed.style.backgroundColor = '#ef4444';
      this.els.connectionLed.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.8)';
      this.els.connectionLabel.textContent = 'OFFLINE';
      this.els.connectionLabel.style.color = '#f87171';
    }
  }

  setMode(newMode) {
    this.mode = newMode;
    if (this.els.lcdDisplay) {
      this.els.lcdDisplay.classList.remove('mode-photo', 'mode-sample');
    }
    if (this.els.wellA) this.els.wellA.classList.remove('btn-active-glow');
    if (this.els.wellB) this.els.wellB.classList.remove('btn-active-glow');
    if (this.els.wellC) this.els.wellC.classList.remove('btn-active-glow');

    if (this.els.modePill) {
      this.els.modePill.className = `controller-mode-pill mode-${newMode.toLowerCase()}`;
      this.els.modePill.textContent = newMode;
    }

    if (newMode === 'PHOTO') {
      if (this.els.lcdDisplay) this.els.lcdDisplay.classList.add('mode-photo');
      if (this.els.wellA) this.els.wellA.classList.add('btn-active-glow');
      if (this.els.wellC) this.els.wellC.classList.add('btn-active-glow');
      this.setLCD('PHOTO MODE ACTIVE', 'Aim rover camera. Press [C] to capture photo.');
    } else if (newMode === 'SAMPLE') {
      if (this.els.lcdDisplay) this.els.lcdDisplay.classList.add('mode-sample');
      if (this.els.wellB) this.els.wellB.classList.add('btn-active-glow');
      if (this.els.wellC) this.els.wellC.classList.add('btn-active-glow');
      this.setLCD('SAMPLE MODE ACTIVE', 'Position rover over beacon. Press [C] to collect.');
    } else {
      this.setLCD('DRIVE MODE READY', 'Use D-Pad to drive rover. Press [A] Photo or [B] Sample.');
    }
  }

  setLCD(mainText, subText) {
    if (this.els.lcdMain) this.els.lcdMain.textContent = mainText;
    if (this.els.lcdSub && subText) this.els.lcdSub.textContent = subText;
  }

  // =========================================================
  // HARDWARE PAUSE CONTROL
  // =========================================================
  bindPauseControls() {
    if (this.els.btnPause) {
      const handlePause = (e) => {
        e.preventDefault();
        this.togglePause();
      };
      this.els.btnPause.addEventListener('touchstart', handlePause, { passive: false });
      this.els.btnPause.addEventListener('click', handlePause);
    }

    if (this.els.btnResume) {
      const handleResume = (e) => {
        e.preventDefault();
        this.togglePause();
      };
      this.els.btnResume.addEventListener('touchstart', handleResume, { passive: false });
      this.els.btnResume.addEventListener('click', handleResume);
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.setPaused(this.isPaused);
    this.vibrate(40);
    this.send({
      type: this.isPaused ? 'GAME_STATE_PAUSE' : 'GAME_STATE_RESUME',
      roomId: this.roomId,
      playerId: this.playerId
    });
  }

  setPaused(paused) {
    this.isPaused = paused;
    if (this.els.pauseOverlay) {
      if (paused) {
        this.els.pauseOverlay.classList.remove('hidden');
      } else {
        this.els.pauseOverlay.classList.add('hidden');
      }
    }
    if (this.els.btnPause) {
      if (paused) {
        this.els.btnPause.classList.add('is-paused');
        this.els.btnPause.innerHTML = `<span class="ctrl-pause-icon">${Icons.play(16)}</span>`;
      } else {
        this.els.btnPause.classList.remove('is-paused');
        this.els.btnPause.innerHTML = `<span class="ctrl-pause-icon">${Icons.pause(16)}</span>`;
      }
    }
  }

  showResultScreen(won) {
    this.els.resultModal.classList.remove('hidden');
    this.els.resultScoreVal.textContent = this.score;

    if (won) {
      this.els.resultCard.classList.remove('lose');
      this.els.resultTitle.textContent = 'YOU WIN!';
      this.els.resultTitle.className = 'result-title win';
      this.els.resultTrophy.innerHTML = Icons.trophy(60);
      this.vibrate([100, 50, 100, 50, 200]);
    } else {
      this.els.resultCard.classList.add('lose');
      this.els.resultTitle.textContent = 'MISSION CONCLUDED';
      this.els.resultTitle.className = 'result-title lose';
      this.els.resultTrophy.innerHTML = Icons.timer(60);
      this.vibrate([100, 100]);
    }
  }

  vibrate(pattern) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Ignored
      }
    }
  }

  // =========================================================
  // HARDWARE BUTTON LISTENERS
  // =========================================================
  bindAuthForm() {
    this.els.authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.els.usernameInput.value.trim();
      const room = this.els.roomcodeInput.value.toUpperCase().trim();

      if (!name) {
        this.els.authErrorMsg.textContent = 'PLEASE ENTER PILOT NAME';
        return;
      }
      if (!room || room.length !== 4) {
        this.els.authErrorMsg.textContent = 'PLEASE ENTER 4-CHARACTER ROOM CODE';
        return;
      }

      this.connectToRoom(room, name);
    });

    if (this.els.btnResultDismiss) {
      this.els.btnResultDismiss.addEventListener('click', () => {
        this.els.resultModal.classList.add('hidden');
      });
    }
  }

  bindHardwareControls() {
    // D-PAD TOUCH & PRESS (Multi-touch support)
    const dpadButtons = document.querySelectorAll('.dpad-btn');
    dpadButtons.forEach(btn => {
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

    // ACTION BUTTON A (PHOTO)
    const handleBtnA = (e) => {
      e.preventDefault();
      this.vibrate(25);
      this.els.btnA.classList.add('pressed');
      setTimeout(() => this.els.btnA.classList.remove('pressed'), 120);

      if (this.mode === 'PHOTO') {
        // Toggle off back to drive
        this.send({ type: 'EXIT_MODES', roomId: this.roomId, playerId: this.playerId });
        this.setMode('DRIVE');
      } else {
        this.send({ type: 'PHOTO_MODE_START', roomId: this.roomId, playerId: this.playerId });
        this.setMode('PHOTO');
      }
    };
    this.els.btnA.addEventListener('touchstart', handleBtnA, { passive: false });
    this.els.btnA.addEventListener('click', handleBtnA);

    // ACTION BUTTON B (SAMPLE)
    const handleBtnB = (e) => {
      e.preventDefault();
      this.vibrate(25);
      this.els.btnB.classList.add('pressed');
      setTimeout(() => this.els.btnB.classList.remove('pressed'), 120);

      if (this.mode === 'SAMPLE') {
        // Toggle off back to drive
        this.send({ type: 'EXIT_MODES', roomId: this.roomId, playerId: this.playerId });
        this.setMode('DRIVE');
      } else {
        this.send({ type: 'SAMPLE_MODE_START', roomId: this.roomId, playerId: this.playerId });
        this.setMode('SAMPLE');
      }
    };
    this.els.btnB.addEventListener('touchstart', handleBtnB, { passive: false });
    this.els.btnB.addEventListener('click', handleBtnB);

    // ACTION BUTTON C (ENTER / ACTION)
    const handleBtnC = (e) => {
      e.preventDefault();
      this.vibrate(35);
      this.els.btnC.classList.add('pressed');
      setTimeout(() => this.els.btnC.classList.remove('pressed'), 120);

      if (this.isCapturing) return; // Debounce

      if (this.mode === 'PHOTO') {
        this.isCapturing = true;
        this.send({ type: 'CAPTURE_PHOTO', roomId: this.roomId, playerId: this.playerId });
        setTimeout(() => { this.isCapturing = false; }, 1000);
      } else if (this.mode === 'SAMPLE') {
        this.isCapturing = true;
        this.send({ type: 'COLLECT_SAMPLE', roomId: this.roomId, playerId: this.playerId, payload: { inRange: true } });
        setTimeout(() => { this.isCapturing = false; }, 1000);
      } else {
        // In drive mode, C acts as horn / scan
        this.setLCD('SCANNING TERRAIN...', 'Align with photo/sample sites.');
        this.vibrate(15);
      }
    };
    this.els.btnC.addEventListener('touchstart', handleBtnC, { passive: false });
    this.els.btnC.addEventListener('click', handleBtnC);
  }

  sendRoverMove(direction, active) {
    this.send({
      type: 'ROVER_MOVE',
      roomId: this.roomId,
      playerId: this.playerId,
      payload: { direction, active }
    });
  }

  // =========================================================
  // MASTER NAVIGATION COMMANDS
  // =========================================================
  bindMasterControls() {
    const bindNavBtn = (id, action, target = null) => {
      const el = document.getElementById(id);
      if (!el) return;

      const trigger = (e) => {
        e.preventDefault();
        if (!this.isMaster) {
          this.vibrate([30, 30]);
          return;
        }
        this.vibrate(30);
        console.log(`[Master Nav] Triggered ${action}`);
        this.send({
          type: 'MASTER_NAVIGATE',
          roomId: this.roomId,
          playerId: this.playerId,
          payload: { action, target }
        });
      };

      el.addEventListener('touchstart', trigger, { passive: false });
      el.addEventListener('click', trigger);
    };

    bindNavBtn('btn-master-home', 'NAV_HOME');
    bindNavBtn('btn-master-missions', 'OPEN_MISSIONS');
    bindNavBtn('btn-master-mars', 'LAUNCH_MARS');
    bindNavBtn('btn-master-start', 'START_MISSION');
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  new PhoneController();
});

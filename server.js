import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
}

// User Storage Helpers
function loadUsers() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.users || [];
  } catch (err) {
    console.error('[Database] Failed to read users.json:', err);
    return [];
  }
}

function saveUser(userData) {
  try {
    const users = loadUsers();
    const existingIndex = users.findIndex(u => u.id === userData.id || (userData.name && u.name.toUpperCase() === userData.name.toUpperCase()));
    
    let savedUser = null;
    if (existingIndex >= 0) {
      users[existingIndex].lastSeen = new Date().toISOString();
      if (userData.name) users[existingIndex].name = userData.name.toUpperCase();
      savedUser = users[existingIndex];
    } else {
      savedUser = {
        id: userData.id || `usr_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
        name: (userData.name || 'PILOT').toUpperCase(),
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };
      users.push(savedUser);
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2));
    return savedUser;
  } catch (err) {
    console.error('[Database] Failed to save user:', err);
    return userData;
  }
}

// In-Memory Room Store
// rooms[roomId] = { roomId, masterPlayerId, currentMission, players: [ { id, name, playerNumber, isMaster, score, rank, completed, connected, ws, socketId } ], bigScreenWs }
const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (rooms[code] && attempts < 100);
  return code;
}

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  app.use(express.json());

  // API endpoints for users
  app.get('/api/users', (req, res) => {
    res.json({ users: loadUsers() });
  });

  app.post('/api/users', (req, res) => {
    const user = saveUser(req.body);
    res.json({ user });
  });

  app.get('/api/server-info', (req, res) => {
    res.json({
      localIp: getLocalIpAddress(),
      port: PORT,
      controllerUrl: `http://${getLocalIpAddress()}:${PORT}/controller`
    });
  });

  // Setup Vite development middleware
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  // Serve controller page
  app.get(['/controller', '/controller.html'], async (req, res, next) => {
    try {
      const controllerPath = path.join(__dirname, 'controller.html');
      if (!fs.existsSync(controllerPath)) {
        return res.status(404).send('controller.html not found');
      }
      let html = fs.readFileSync(controllerPath, 'utf-8');
      html = await vite.transformIndexHtml(req.url, html);
      res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    } catch (e) {
      next(e);
    }
  });

  // Serve big screen index page
  app.get('/', async (req, res, next) => {
    try {
      const indexPath = path.join(__dirname, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');
      html = await vite.transformIndexHtml(req.url, html);
      res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    } catch (e) {
      next(e);
    }
  });

  // Use Vite middlewares for all static modules and assets
  app.use(vite.middlewares);

  // Upgrade HTTP connections to WebSocket
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // WebSocket Connection Handler
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.socketId = `sock_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    ws.roomId = null;
    ws.playerId = null;
    ws.isBigScreen = false;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        handleWebSocketMessage(ws, message);
      } catch (err) {
        console.error('[WebSocket] Invalid JSON message:', err);
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });
  });

  // Heartbeat interval
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  function broadcastToRoom(roomId, message, excludeSocketId = null) {
    const room = rooms[roomId];
    if (!room) return;

    const payloadStr = JSON.stringify(message);

    if (room.bigScreenWs && room.bigScreenWs.readyState === WebSocket.OPEN) {
      if (room.bigScreenWs.socketId !== excludeSocketId) {
        room.bigScreenWs.send(payloadStr);
      }
    }

    room.players.forEach(p => {
      if (p.ws && p.ws.readyState === WebSocket.OPEN && p.ws.socketId !== excludeSocketId) {
        p.ws.send(payloadStr);
      }
    });
  }

  function sendToSocket(ws, message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function handleWebSocketMessage(ws, msg) {
    const { type, roomId, playerId, payload = {} } = msg;

    switch (type) {
      // 1. BIG SCREEN CREATES ROOM
      case 'ROOM_CREATE': {
        const newCode = generateRoomCode();
        rooms[newCode] = {
          roomId: newCode,
          masterPlayerId: null,
          currentMission: 'LOBBY',
          players: [],
          bigScreenWs: ws
        };
        ws.roomId = newCode;
        ws.isBigScreen = true;

        console.log(`[Room Created]: Code ${newCode}`);
        sendToSocket(ws, {
          type: 'ROOM_CREATED',
          roomId: newCode,
          localIp: getLocalIpAddress(),
          controllerUrl: `http://${getLocalIpAddress()}:${PORT}/controller?room=${newCode}`
        });
        break;
      }

      // 2. BIG SCREEN RECONNECTS TO EXISTING ROOM
      case 'ROOM_RECONNECT': {
        if (roomId && rooms[roomId]) {
          rooms[roomId].bigScreenWs = ws;
          ws.roomId = roomId;
          ws.isBigScreen = true;
          sendToSocket(ws, {
            type: 'ROOM_SYNC',
            roomId,
            room: serializeRoom(rooms[roomId])
          });
        }
        break;
      }

      // 3. PHONE REGISTERS USER PROFILE
      case 'PLAYER_REGISTER': {
        const saved = saveUser({ id: payload.id, name: payload.name });
        sendToSocket(ws, {
          type: 'PLAYER_REGISTERED',
          user: saved
        });
        break;
      }

      // 4. PHONE JOINS ROOM
      case 'ROOM_JOIN': {
        const normalizedRoomId = (roomId || '').toUpperCase().trim();
        const targetRoom = rooms[normalizedRoomId];
        if (!targetRoom) {
          sendToSocket(ws, {
            type: 'ERROR',
            code: 'ROOM_NOT_FOUND',
            message: `Room code ${normalizedRoomId} not found. Check the big screen code.`
          });
          return;
        }

        const user = saveUser({ id: playerId, name: payload.name });
        ws.roomId = normalizedRoomId;
        ws.playerId = user.id;

        // Check if player already exists in room (reconnect)
        let player = targetRoom.players.find(p => p.id === user.id);
        if (player) {
          player.connected = true;
          player.ws = ws;
          player.name = user.name;
        } else {
          // Assign player number (1, 2, ...)
          const playerNumber = targetRoom.players.length + 1;
          const isMaster = targetRoom.players.length === 0 || !targetRoom.masterPlayerId;

          player = {
            id: user.id,
            name: user.name,
            playerNumber,
            isMaster,
            score: 0,
            rank: playerNumber,
            completed: false,
            connected: true,
            photoMode: false,
            sampleMode: false,
            ws
          };

          targetRoom.players.push(player);

          if (isMaster) {
            targetRoom.masterPlayerId = user.id;
          }
        }

        console.log(`[Player Joined]: ${user.name} (#${player.playerNumber}) in room ${roomId}. Master: ${player.isMaster}`);

        // Notify joined phone
        sendToSocket(ws, {
          type: 'JOIN_SUCCESS',
          roomId,
          player: serializePlayer(player),
          isMaster: player.isMaster,
          masterPlayerId: targetRoom.masterPlayerId,
          room: serializeRoom(targetRoom)
        });

        // Notify room (Big Screen & other players)
        broadcastToRoom(roomId, {
          type: 'PLAYER_JOINED',
          player: serializePlayer(player),
          room: serializeRoom(targetRoom)
        }, ws.socketId);

        break;
      }

      // 5. MASTER REMOTE NAVIGATION (ONLY MASTER CAN EXECUTE)
      case 'MASTER_NAVIGATE': {
        const room = rooms[roomId];
        if (!room) return;

        if (room.masterPlayerId !== playerId) {
          console.warn(`[Security] Rejected MASTER_NAVIGATE from non-master player ${playerId}`);
          sendToSocket(ws, {
            type: 'ERROR',
            code: 'UNAUTHORIZED_MASTER',
            message: 'Only the Master player can navigate the mission console.'
          });
          return;
        }

        console.log(`[Master Command]: ${payload.action} -> ${payload.target || ''} by ${playerId}`);
        
        // Broadcast navigation command to Big Screen
        broadcastToRoom(roomId, {
          type: 'MASTER_NAVIGATE',
          action: payload.action,
          target: payload.target
        });
        break;
      }

      // 6. ROVER MOVEMENT (MARS MISSION)
      case 'ROVER_MOVE': {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return;

        // Forward input directly to Big Screen
        if (room.bigScreenWs && room.bigScreenWs.readyState === WebSocket.OPEN) {
          sendToSocket(room.bigScreenWs, {
            type: 'ROVER_MOVE',
            playerNumber: player.playerNumber,
            playerId: player.id,
            direction: payload.direction, // 'up', 'down', 'left', 'right', 'boost', 'brake'
            active: payload.active !== false
          });
        }
        break;
      }

      // 7. PHOTO MODE TOGGLE (A BUTTON)
      case 'PHOTO_MODE_START': {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return;

        player.photoMode = true;
        player.sampleMode = false;

        // Broadcast to big screen and back to player
        broadcastToRoom(roomId, {
          type: 'PHOTO_MODE_START',
          playerNumber: player.playerNumber,
          playerId: player.id
        });
        break;
      }

      // 8. SAMPLE MODE TOGGLE (B BUTTON)
      case 'SAMPLE_MODE_START': {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return;

        player.sampleMode = true;
        player.photoMode = false;

        // Broadcast to big screen and back to player
        broadcastToRoom(roomId, {
          type: 'SAMPLE_MODE_START',
          playerNumber: player.playerNumber,
          playerId: player.id
        });
        break;
      }

      // 9. ACTION / CONFIRM (C BUTTON IN PHOTO MODE)
      case 'CAPTURE_PHOTO': {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return;

        const points = 1000;
        player.score += points;
        player.photoMode = false;

        updateRankings(room);

        console.log(`[Photo Captured] Player ${player.name} (+${points}). Total: ${player.score}`);

        broadcastToRoom(roomId, {
          type: 'SCORE_UPDATE',
          playerNumber: player.playerNumber,
          playerId: player.id,
          added: points,
          score: player.score,
          players: room.players.map(serializePlayer)
        });

        broadcastToRoom(roomId, {
          type: 'CAPTURE_PHOTO',
          playerNumber: player.playerNumber,
          playerId: player.id,
          payload: payload
        });
        break;
      }

      // 10. ACTION / CONFIRM (C BUTTON IN SAMPLE MODE)
      case 'COLLECT_SAMPLE': {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return;

        const inRange = payload.inRange !== false;
        if (!inRange) {
          sendToSocket(ws, {
            type: 'NOTIFICATION',
            message: 'NO SAMPLE IN RANGE. DRIVE CLOSER TO A BEACON.',
            level: 'warning'
          });
          return;
        }

        const points = 2000;
        player.score += points;
        player.sampleMode = false;

        updateRankings(room);

        console.log(`[Sample Collected] Player ${player.name} (+${points}). Total: ${player.score}`);

        broadcastToRoom(roomId, {
          type: 'SCORE_UPDATE',
          playerNumber: player.playerNumber,
          playerId: player.id,
          added: points,
          score: player.score,
          players: room.players.map(serializePlayer)
        });

        broadcastToRoom(roomId, {
          type: 'COLLECT_SAMPLE',
          playerNumber: player.playerNumber,
          playerId: player.id,
          zoneId: payload.zoneId
        });
        break;
      }

      // 11. BIG SCREEN REPORTS MISSION OBJECTIVE PROGRESS / FINISH
      case 'PLAYER_PROGRESS': {
        const room = rooms[roomId];
        if (!room) return;

        broadcastToRoom(roomId, {
          type: 'PLAYER_PROGRESS',
          playerNumber: payload.playerNumber,
          progress: payload.progress
        });
        break;
      }

      case 'MISSION_COMPLETE': {
        const room = rooms[roomId];
        if (!room) return;

        const pNum = payload.playerNumber;
        const player = room.players.find(p => p.playerNumber === pNum);
        if (player) {
          player.completed = true;
        }

        // Determine winner / loser if 2-player
        const completedPlayers = room.players.filter(p => p.completed);
        const winner = completedPlayers[0];

        broadcastToRoom(roomId, {
          type: 'MISSION_COMPLETE',
          completedPlayerNumber: pNum,
          winnerPlayerNumber: winner ? winner.playerNumber : pNum,
          players: room.players.map(serializePlayer)
        });
        break;
      }

      // 12. EXIT MODES (RETURN TO DRIVE)
      case 'EXIT_MODES': {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (player) {
          player.photoMode = false;
          player.sampleMode = false;
        }

        broadcastToRoom(roomId, {
          type: 'EXIT_MODES',
          playerNumber: player ? player.playerNumber : payload.playerNumber
        });
        break;
      }

      // 13. PAUSE / RESUME SIMULATION
      case 'GAME_STATE_PAUSE': {
        const room = rooms[roomId];
        if (!room) return;
        console.log(`[Simulation Paused] in room ${roomId}`);
        broadcastToRoom(roomId, {
          type: 'GAME_STATE_PAUSE',
          pausedBy: playerId || 'BIG_SCREEN'
        });
        break;
      }

      case 'GAME_STATE_RESUME': {
        const room = rooms[roomId];
        if (!room) return;
        console.log(`[Simulation Resumed] in room ${roomId}`);
        broadcastToRoom(roomId, {
          type: 'GAME_STATE_RESUME'
        });
        break;
      }

      default:
        console.log(`[WebSocket] Unhandled message type: ${type}`);
    }
  }

  function updateRankings(room) {
    if (!room || !room.players) return;
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      p.rank = idx + 1;
    });
  }

  function handleDisconnect(ws) {
    const roomId = ws.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];

    if (ws.isBigScreen) {
      console.log(`[Big Screen Disconnected] from room ${roomId}`);
      room.bigScreenWs = null;
      return;
    }

    const player = room.players.find(p => p.id === ws.playerId);
    if (player) {
      player.connected = false;
      console.log(`[Player Disconnected] ${player.name} from room ${roomId}`);

      // If Master disconnected, transfer Master to next active player
      if (player.isMaster) {
        player.isMaster = false;
        const nextMaster = room.players.find(p => p.connected && p.id !== player.id);
        if (nextMaster) {
          nextMaster.isMaster = true;
          room.masterPlayerId = nextMaster.id;
          console.log(`[Master Transferred] to ${nextMaster.name}`);

          broadcastToRoom(roomId, {
            type: 'MASTER_TRANSFERRED',
            masterPlayerId: nextMaster.id,
            masterPlayerName: nextMaster.name,
            masterPlayerNumber: nextMaster.playerNumber,
            players: room.players.map(serializePlayer)
          });
        } else {
          room.masterPlayerId = null;
        }
      }

      broadcastToRoom(roomId, {
        type: 'PLAYER_LEFT',
        playerId: player.id,
        playerNumber: player.playerNumber,
        room: serializeRoom(room)
      });
    }
  }

  function serializePlayer(p) {
    return {
      id: p.id,
      name: p.name,
      playerNumber: p.playerNumber,
      isMaster: p.isMaster,
      score: p.score,
      rank: p.rank,
      completed: p.completed,
      connected: p.connected,
      photoMode: p.photoMode,
      sampleMode: p.sampleMode
    };
  }

  function serializeRoom(room) {
    return {
      roomId: room.roomId,
      masterPlayerId: room.masterPlayerId,
      currentMission: room.currentMission,
      players: room.players.map(serializePlayer)
    };
  }

  server.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIpAddress();
    console.log(`\n======================================================`);
    console.log(`  IN THE OUTER // AIRCONSOLE MULTIPLAYER SYSTEM`);
    console.log(`  Big Screen: http://localhost:${PORT}`);
    console.log(`  Phone Controller: http://${localIp}:${PORT}/controller`);
    console.log(`  WebSocket Endpoint: ws://<host>:${PORT}/ws`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('[Server] Fatal startup error:', err);
});

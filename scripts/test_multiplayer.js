// Automated test for AirConsole multiplayer server & WebSocket protocol
import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

const WS_URL = 'ws://localhost:3000/ws';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== STARTING AIRCONSOLE MULTIPLAYER SYSTEM VERIFICATION ===\n');

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      testPassed++;
    } else {
      console.error(`[FAIL] ${message}`);
      testFailed++;
    }
  }

  // TEST 1: Big Screen connects and creates room
  console.log('--- TEST 1: Big Screen Room Creation ---');
  const bigScreenWs = new WebSocket(WS_URL);
  let roomCode = null;

  await new Promise((resolve) => {
    bigScreenWs.on('open', () => {
      bigScreenWs.send(JSON.stringify({ type: 'ROOM_CREATE' }));
    });
    bigScreenWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ROOM_CREATED') {
        roomCode = msg.roomId;
        const isAlphanumeric = /^[A-Z0-9]{4}$/.test(roomCode);
        assert(isAlphanumeric, `Received 4-character uppercase alphanumeric room code: ${roomCode}`);
        resolve();
      }
    });
  });

  // TEST 2: First Phone joins room as Player 1 (Master)
  console.log('\n--- TEST 2: First Phone Joins as Master (JEEVAN) ---');
  const phone1Ws = new WebSocket(WS_URL);
  let phone1Data = null;

  await new Promise((resolve) => {
    phone1Ws.on('open', () => {
      phone1Ws.send(JSON.stringify({
        type: 'ROOM_JOIN',
        roomId: roomCode,
        playerId: null,
        payload: { name: 'JEEVAN' }
      }));
    });
    phone1Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'JOIN_SUCCESS') {
        phone1Data = msg.player;
        assert(msg.isMaster === true, 'Player 1 is assigned as MASTER');
        assert(phone1Data.name === 'JEEVAN', 'Player 1 name is JEEVAN');
        assert(phone1Data.playerNumber === 1, 'Assigned as Player Number 1');
        resolve();
      }
    });
  });

  // Verify users.json persisted
  const usersDb = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  const jeevanUser = usersDb.users.find(u => u.name === 'JEEVAN');
  assert(!!jeevanUser, 'User profile "JEEVAN" successfully saved to data/users.json');

  // TEST 3: Second Phone joins room as Player 2 (Normal player)
  console.log('\n--- TEST 3: Second Phone Joins (ARUN) ---');
  const phone2Ws = new WebSocket(WS_URL);
  let phone2Data = null;

  await new Promise((resolve) => {
    phone2Ws.on('open', () => {
      phone2Ws.send(JSON.stringify({
        type: 'ROOM_JOIN',
        roomId: roomCode,
        playerId: null,
        payload: { name: 'ARUN' }
      }));
    });
    phone2Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'JOIN_SUCCESS') {
        phone2Data = msg.player;
        assert(msg.isMaster === false, 'Player 2 is NOT Master');
        assert(phone2Data.name === 'ARUN', 'Player 2 name is ARUN');
        assert(phone2Data.playerNumber === 2, 'Assigned as Player Number 2');
        resolve();
      }
    });
  });

  // TEST 4: Player 2 attempts Master Navigation (MUST BE REJECTED)
  console.log('\n--- TEST 4: Player 2 Master Navigation Rejection ---');
  let rejected = false;
  await new Promise((resolve) => {
    phone2Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ERROR' && msg.code === 'UNAUTHORIZED_MASTER') {
        rejected = true;
        resolve();
      }
    });
    phone2Ws.send(JSON.stringify({
      type: 'MASTER_NAVIGATE',
      roomId: roomCode,
      playerId: phone2Data.id,
      payload: { action: 'LAUNCH_MARS' }
    }));
    setTimeout(resolve, 500);
  });
  assert(rejected, 'Server rejected unauthorized Master navigation from Player 2');

  // TEST 5: Master navigates (MUST BE BROADCAST TO BIG SCREEN)
  console.log('\n--- TEST 5: Master Navigation Accepted & Broadcast ---');
  let bigScreenNavReceived = false;
  await new Promise((resolve) => {
    bigScreenWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'MASTER_NAVIGATE' && msg.action === 'LAUNCH_MARS') {
        bigScreenNavReceived = true;
        resolve();
      }
    });
    phone1Ws.send(JSON.stringify({
      type: 'MASTER_NAVIGATE',
      roomId: roomCode,
      playerId: phone1Data.id,
      payload: { action: 'LAUNCH_MARS' }
    }));
    setTimeout(resolve, 500);
  });
  assert(bigScreenNavReceived, 'Big Screen received MASTER_NAVIGATE: LAUNCH_MARS');

  // TEST 6: Rover Movement via D-Pad
  console.log('\n--- TEST 6: Rover Movement Input Routing ---');
  let roverMoveReceived = false;
  await new Promise((resolve) => {
    bigScreenWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ROVER_MOVE' && msg.playerNumber === 1 && msg.direction === 'up') {
        roverMoveReceived = true;
        resolve();
      }
    });
    phone1Ws.send(JSON.stringify({
      type: 'ROVER_MOVE',
      roomId: roomCode,
      playerId: phone1Data.id,
      payload: { direction: 'up', active: true }
    }));
    setTimeout(resolve, 500);
  });
  assert(roverMoveReceived, 'Big Screen received ROVER_MOVE up for Player 1');

  // TEST 7: Photo Capture and Score
  console.log('\n--- TEST 7: Button A & C Photo Capture Scoring ---');
  let photoScoreUpdated = false;
  await new Promise((resolve) => {
    phone1Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'SCORE_UPDATE' && msg.playerNumber === 1 && msg.score >= 1000) {
        photoScoreUpdated = true;
        resolve();
      }
    });
    phone1Ws.send(JSON.stringify({
      type: 'CAPTURE_PHOTO',
      roomId: roomCode,
      playerId: phone1Data.id,
      payload: {}
    }));
    setTimeout(resolve, 500);
  });
  assert(photoScoreUpdated, 'Player 1 Photo captured and +1000 score update received');

  // TEST 8: Player 2 Scores More Points (Dynamic Rank Switch)
  console.log('\n--- TEST 8: Sample Collection & Dynamic Rank Reversal ---');
  let player2Rank1 = false;
  await new Promise((resolve) => {
    phone2Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'SCORE_UPDATE' && msg.playerNumber === 2) {
        const p2 = msg.players.find(p => p.playerNumber === 2);
        const p1 = msg.players.find(p => p.playerNumber === 1);
        if (p2 && p1 && p2.score > p1.score && p2.rank === 1 && p1.rank === 2) {
          player2Rank1 = true;
          resolve();
        }
      }
    });
    // Sample gives +2000, overtaking Player 1's 1000
    phone2Ws.send(JSON.stringify({
      type: 'COLLECT_SAMPLE',
      roomId: roomCode,
      playerId: phone2Data.id,
      payload: { inRange: true }
    }));
    setTimeout(resolve, 500);
  });
  assert(player2Rank1, 'Player 2 score (2000) overtook Player 1 (1000) -> Player 2 is dynamically 1ST PLACE');

  // TEST 9: Master Disconnect & Master Transfer
  console.log('\n--- TEST 9: Master Transfer on Disconnect ---');
  let masterTransferred = false;
  await new Promise((resolve) => {
    phone2Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'MASTER_TRANSFERRED' && msg.masterPlayerId === phone2Data.id) {
        masterTransferred = true;
        resolve();
      }
    });
    phone1Ws.close();
    setTimeout(resolve, 600);
  });
  assert(masterTransferred, 'When Player 1 disconnected, Master was safely transferred to Player 2');

  // TEST 10: Pause & Resume Broadcast
  console.log('\n--- TEST 10: Simulation Pause & Resume Broadcast ---');
  let pauseReceivedOnPhone = false;
  let resumeReceivedOnPhone = false;
  await new Promise((resolve) => {
    phone2Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'GAME_STATE_PAUSE') {
        pauseReceivedOnPhone = true;
      }
      if (msg.type === 'GAME_STATE_RESUME') {
        resumeReceivedOnPhone = true;
        resolve();
      }
    });

    // Big screen triggers pause
    bigScreenWs.send(JSON.stringify({
      type: 'GAME_STATE_PAUSE',
      roomId: roomCode
    }));

    setTimeout(() => {
      // Big screen triggers resume
      bigScreenWs.send(JSON.stringify({
        type: 'GAME_STATE_RESUME',
        roomId: roomCode
      }));
    }, 200);

    setTimeout(resolve, 800);
  });
  assert(pauseReceivedOnPhone, 'Phone received GAME_STATE_PAUSE broadcast');
  assert(resumeReceivedOnPhone, 'Phone received GAME_STATE_RESUME broadcast');

  // TEST 11: Case-Insensitive Room Code Join
  console.log('\n--- TEST 11: Case-Insensitive Room Join ---');
  const phone3Ws = new WebSocket(WS_URL);
  let phone3Joined = false;
  await new Promise((resolve) => {
    phone3Ws.on('open', () => {
      phone3Ws.send(JSON.stringify({
        type: 'ROOM_JOIN',
        roomId: roomCode.toLowerCase(), // join with lowercase code
        playerId: null,
        payload: { name: 'CADET' }
      }));
    });
    phone3Ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'JOIN_SUCCESS') {
        phone3Joined = true;
        resolve();
      }
    });
    setTimeout(resolve, 600);
  });
  assert(phone3Joined, `Phone joined successfully using lowercase room code: ${roomCode.toLowerCase()}`);

  // Cleanup
  phone3Ws.close();
  bigScreenWs.close();
  phone2Ws.close();

  console.log(`\n=== RESULTS: ${testPassed} PASSED, ${testFailed} FAILED ===\n`);
  if (testFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('[Test Error]', err);
  process.exit(1);
});

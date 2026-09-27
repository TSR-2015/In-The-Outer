// =========================================================
// IN THE OUTER // AIRCONSOLE MULTIPLAYER TEST SUITE
// Tests 2-channel transport, replicated device state,
// Host authority, active vs spectator, 60s grace reconnection.
// =========================================================

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3000/ws';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createSocket() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws, predicate, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for message predicate after ${timeout}ms`));
    }, timeout);

    const listener = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off('message', listener);
          resolve(msg);
        }
      } catch (e) {}
    };

    ws.on('message', listener);
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  RUNNING AIRCONSOLE ARCHITECTURE & STATE TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // TEST 1: Big Screen Creates Room
    const screenWs = await createSocket();
    const roomCreatedPromise = waitForMessage(screenWs, m => m.type === 'ROOM_CREATED');
    screenWs.send(JSON.stringify({ type: 'ROOM_CREATE' }));
    const roomCreatedMsg = await roomCreatedPromise;
    const roomId = roomCreatedMsg.roomId;
    assert(roomId && roomId.length === 4, `Big Screen creates room with 4-char code: ${roomId}`);

    // TEST 2: First Controller Joins -> Becomes Host
    const phone1Ws = await createSocket();
    const phone1JoinPromise = waitForMessage(phone1Ws, m => m.type === 'JOIN_SUCCESS');
    phone1Ws.send(JSON.stringify({
      type: 'ROOM_JOIN',
      roomId,
      playerId: 'pilot_alpha_01',
      payload: { name: 'ALPHA', color: '#00f0ff' }
    }));
    const p1Join = await phone1JoinPromise;
    const p1Id = p1Join.player.id;
    assert(p1Join.isMaster === true && p1Join.isHost === true, 'First phone controller automatically receives Host authority');

    // TEST 3: Controller 1 gets full state sync
    const p1SyncPromise = waitForMessage(phone1Ws, m => m.type === 'SYNC_FULL_STATE');
    phone1Ws.send(JSON.stringify({
      type: 'REQUEST_FULL_SYNC',
      roomId,
      playerId: p1Id
    }));
    const p1Sync = await p1SyncPromise;
    assert(p1Sync.roomId === roomId && p1Sync.devices.length >= 1, 'Controller receives full replicated device state sync');

    // TEST 4: Replicated Device State Diff Broadcast
    const stateChangePromise = waitForMessage(screenWs, m => m.type === 'DEVICE_STATE_CHANGE' && m.deviceId === p1Id && m.diff.color === '#ff0055');
    phone1Ws.send(JSON.stringify({
      type: 'SET_STATE',
      roomId,
      playerId: p1Id,
      state: { isReady: true, color: '#ff0055' }
    }));
    const stateChange = await stateChangePromise;
    assert(stateChange.state.isReady === true && stateChange.state.color === '#ff0055', 'Replicated state diff correctly merges and broadcasts');

    // TEST 5: Second Controller Joins -> Becomes Non-Host Player 2
    const phone2Ws = await createSocket();
    const phone2JoinPromise = waitForMessage(phone2Ws, m => m.type === 'JOIN_SUCCESS');
    phone2Ws.send(JSON.stringify({
      type: 'ROOM_JOIN',
      roomId,
      playerId: 'pilot_bravo_02',
      payload: { name: 'BRAVO', color: '#00ff66' }
    }));
    const p2Join = await phone2JoinPromise;
    const p2Id = p2Join.player.id;
    assert(p2Join.player.playerNumber === 2 && p2Join.isHost === false, 'Second phone controller is Player 2 and NOT Host');

    // TEST 6: Host Authority Guard - Non-Host Rejected from Pausing
    const unauthorizedPromise = waitForMessage(phone2Ws, m => m.type === 'ERROR' && m.code === 'UNAUTHORIZED_HOST');
    phone2Ws.send(JSON.stringify({
      type: 'GAME_STATE_PAUSE',
      roomId,
      playerId: p2Id
    }));
    const unauth = await unauthorizedPromise;
    assert(unauth.code === 'UNAUTHORIZED_HOST', 'Server rejects unauthorized pause command from non-host controller');

    // TEST 7: Host Authority - Host Can Pause
    const pauseBroadcastPromise = waitForMessage(screenWs, m => m.type === 'GAME_STATE_PAUSE');
    phone1Ws.send(JSON.stringify({
      type: 'GAME_STATE_PAUSE',
      roomId,
      playerId: p1Id
    }));
    const pauseMsg = await pauseBroadcastPromise;
    assert(pauseMsg.type === 'GAME_STATE_PAUSE', 'Host successfully pauses simulation and broadcasts to Big Screen');

    // TEST 8: Active Players vs Spectators (AirConsole setActivePlayers)
    const activeChangedPromise = waitForMessage(phone2Ws, m => m.type === 'ACTIVE_PLAYERS_CHANGED');
    screenWs.send(JSON.stringify({
      type: 'SET_ACTIVE_PLAYERS',
      roomId,
      count: 1
    }));
    const activeChanged = await activeChangedPromise;
    assert(activeChanged.activePlayerCount === 1, 'setActivePlayers(1) correctly partitions active vs spectator devices');

    // TEST 9: View-Switching Coordination
    const viewChangedPromise = waitForMessage(phone1Ws, m => m.type === 'CONTROLLERS_VIEW_CHANGED');
    screenWs.send(JSON.stringify({
      type: 'SET_CONTROLLERS_VIEW',
      roomId,
      view: 'MISSION_CONTROL',
      missionId: 'MARS_ROVER'
    }));
    const viewChanged = await viewChangedPromise;
    assert(viewChanged.view === 'MISSION_CONTROL', 'Screen successfully commands all controllers into MISSION_CONTROL view');

    // TEST 10: Fast Transient Input Channel
    const roverMovePromise = waitForMessage(screenWs, m => m.type === 'ROVER_MOVE');
    phone1Ws.send(JSON.stringify({
      type: 'ROVER_MOVE',
      roomId,
      playerId: p1Id,
      payload: { direction: 'up', active: true }
    }));
    const moveMsg = await roverMovePromise;
    assert(moveMsg.direction === 'up' && moveMsg.active === true, 'Fast transient input (ROVER_MOVE) delivered without delay');

    // TEST 11: 60-Second Grace Period Reconnection
    // Disconnect phone 2
    const playerLeftPromise = waitForMessage(screenWs, m => m.type === 'PLAYER_LEFT');
    phone2Ws.close();
    const leftMsg = await playerLeftPromise;
    assert(leftMsg.gracePeriodSeconds === 60, 'Disconnect triggers 60s grace period preserving player slot');

    // Reconnect phone 2 with same playerId and roomId
    const phone2ReconnectWs = await createSocket();
    const reconnectSuccessPromise = waitForMessage(phone2ReconnectWs, m => m.type === 'JOIN_SUCCESS');
    phone2ReconnectWs.send(JSON.stringify({
      type: 'ROOM_JOIN',
      roomId,
      playerId: p2Id,
      payload: { name: 'BRAVO' }
    }));
    const reconnectedMsg = await reconnectSuccessPromise;
    assert(reconnectedMsg.isReconnection === true && reconnectedMsg.player.playerNumber === 2, 'Reconnecting phone immediately rehydrates slot and state');

    // TEST 12: Host Transfer on Host Disconnect
    const hostTransferPromise = waitForMessage(phone2ReconnectWs, m => m.type === 'MASTER_TRANSFERRED');
    phone1Ws.close();
    const transferMsg = await hostTransferPromise;
    assert(transferMsg.masterPlayerId === p2Id, 'Host authority cleanly transfers to next connected player when host disconnects');

    // Cleanup
    screenWs.close();
    phone2ReconnectWs.close();

    console.log(`\n======================================================`);
    console.log(`  ALL ${passed}/${total} AIRCONSOLE TESTS PASSED SUCCESSFULLY!`);
    console.log(`======================================================\n`);
    process.exit(0);

  } catch (err) {
    console.error('\n[TEST RUNNER FAILED]:', err);
    process.exit(1);
  }
}

runTests();

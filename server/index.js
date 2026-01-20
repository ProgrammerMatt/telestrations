const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Round durations in milliseconds
const DRAW_TIME = 60000; // 60 seconds
const GUESS_TIME = 45000; // 45 seconds

// Track active timers per room
const roomTimers = {};

// Track play-again responses per room
const playAgainResponses = {};
const playAgainTimers = {};
const PLAY_AGAIN_TIMEOUT = 15000; // 15 seconds

// Track sockets by player ID for direct emission
const playerSockets = {};

// Track disconnect times for players
const disconnectTimes = {};
const DISCONNECT_TIMEOUT = 30000; // 30 seconds before auto-submitting placeholder
const RECONNECT_WINDOW = 180000; // 3 minutes to reconnect

// Track online count
let onlineCount = 0;

function broadcastOnlineCount() {
  io.emit('online-count', onlineCount);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  onlineCount++;
  broadcastOnlineCount();

  // Send current count to newly connected client
  socket.emit('online-count', onlineCount);

  // Store socket reference for direct emission
  playerSockets[socket.id] = socket;

  // Create a new game room
  socket.on('create-room', (data, callback) => {
    // Support both old format (just playerName string) and new format (object)
    let playerName, isPublic, roomName;
    if (typeof data === 'string') {
      playerName = data;
      isPublic = false;
      roomName = '';
    } else {
      playerName = data.playerName;
      isPublic = data.isPublic || false;
      roomName = data.roomName || '';
    }

    const code = game.createRoom(socket.id, playerName, { isPublic, roomName });
    socket.join(code);
    socket.roomCode = code;
    socket.playerName = playerName;

    const visibility = isPublic ? 'public' : 'private';
    console.log(`Room ${code} (${visibility}) created by ${playerName}`);

    callback({
      success: true,
      roomCode: code,
      room: game.getPublicRoomInfo(code)
    });
  });

  // Get list of public lobbies
  socket.on('get-public-lobbies', (callback) => {
    const lobbies = game.getPublicLobbies();
    callback({ success: true, lobbies });
  });

  // Send chat message
  socket.on('send-chat', (message, callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      callback({ success: false, error: 'Invalid message' });
      return;
    }

    const chatMessage = game.addChatMessage(code, socket.id, socket.playerName, message.trim());
    if (chatMessage) {
      // Broadcast to all players in the room
      io.to(code).emit('chat-message', chatMessage);
      callback({ success: true });
    } else {
      callback({ success: false, error: 'Failed to send message' });
    }
  });

  // Get chat history
  socket.on('get-chat-history', (callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const messages = game.getChatMessages(code);
    callback({ success: true, messages });
  });

  // Join an existing room
  socket.on('join-room', (data, callback) => {
    const { roomCode, playerName } = data;
    const code = roomCode.toUpperCase();

    const result = game.joinRoom(code, socket.id, playerName);

    if (result.success) {
      socket.join(code);
      socket.roomCode = code;
      socket.playerName = playerName;

      console.log(`${playerName} joined room ${code}`);

      // Notify all players in room
      io.to(code).emit('player-joined', game.getPublicRoomInfo(code));

      callback({
        success: true,
        room: game.getPublicRoomInfo(code)
      });
    } else {
      callback({
        success: false,
        error: result.error
      });
    }
  });

  // Start the game
  socket.on('start-game', (callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = game.getRoom(code);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.host !== socket.id) {
      callback({ success: false, error: 'Only the host can start the game' });
      return;
    }

    const result = game.startGame(code);
    if (result.success) {
      console.log(`Game started in room ${code} with ${result.room.players.length} players`);
      callback({ success: true });

      // Send each player their task immediately
      startRound(code);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // Submit a drawing
  socket.on('submit-drawing', (drawingData, callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.submitResponse(code, socket.id, drawingData);
    if (result.success) {
      console.log(`Drawing submitted by ${socket.playerName} in room ${code}`);

      // Notify room of submission count
      const room = game.getRoom(code);
      const submittedCount = Object.keys(room.submissions).length;
      const totalPlayers = room.players.filter(p => p.connected).length;
      io.to(code).emit('submission-update', { submitted: submittedCount, total: totalPlayers });

      callback({ success: true });

      // Check if all submitted
      if (result.allSubmitted) {
        clearRoomTimer(code);
        advanceRound(code);
      }
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // Submit a guess
  socket.on('submit-guess', (guessText, callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.submitResponse(code, socket.id, guessText);
    if (result.success) {
      console.log(`Guess submitted by ${socket.playerName} in room ${code}`);

      // Notify room of submission count
      const room = game.getRoom(code);
      const submittedCount = Object.keys(room.submissions).length;
      const totalPlayers = room.players.filter(p => p.connected).length;
      io.to(code).emit('submission-update', { submitted: submittedCount, total: totalPlayers });

      callback({ success: true });

      // Check if all submitted
      if (result.allSubmitted) {
        clearRoomTimer(code);
        advanceRound(code);
      }
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // Request results
  socket.on('request-results', (callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const results = game.getResults(code);
    if (results) {
      callback({ success: true, chains: results });
    } else {
      callback({ success: false, error: 'Results not available' });
    }
  });

  // Return to lobby (host only)
  socket.on('return-to-lobby', (callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = game.getRoom(code);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.host !== socket.id) {
      callback({ success: false, error: 'Only the host can return to lobby' });
      return;
    }

    // Reset room state
    room.status = 'lobby';
    room.currentRound = 0;
    room.totalRounds = 0;
    room.roundType = null;
    room.chains = {};
    room.submissions = {};

    console.log(`Room ${code} returned to lobby`);

    io.to(code).emit('returned-to-lobby', game.getPublicRoomInfo(code));
    callback({ success: true });
  });

  // Host offers to play again
  socket.on('offer-play-again', (callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = game.getRoom(code);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.host !== socket.id) {
      callback({ success: false, error: 'Only the host can offer to play again' });
      return;
    }

    // Initialize play-again tracking for this room
    playAgainResponses[code] = {};

    // Notify all players to show the play-again prompt
    io.to(code).emit('play-again-prompt', { timeout: PLAY_AGAIN_TIMEOUT });

    console.log(`Room ${code}: Host offered to play again`);
    callback({ success: true });

    // Set timeout to resolve play-again
    playAgainTimers[code] = setTimeout(() => {
      resolvePlayAgain(code);
    }, PLAY_AGAIN_TIMEOUT);
  });

  // Player responds to play-again prompt
  socket.on('play-again-response', (wantsToPlay, callback) => {
    const code = socket.roomCode;
    if (!code) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    if (!playAgainResponses[code]) {
      callback({ success: false, error: 'No play-again in progress' });
      return;
    }

    playAgainResponses[code][socket.id] = wantsToPlay;

    // Broadcast response count update
    const responses = Object.values(playAgainResponses[code]);
    const yesCount = responses.filter(r => r === true).length;
    const totalResponses = responses.length;
    io.to(code).emit('play-again-update', { yesCount, totalResponses });

    console.log(`Room ${code}: ${socket.playerName} responded ${wantsToPlay ? 'yes' : 'no'} (${yesCount} yes so far)`);
    callback({ success: true });

    // Check if all connected players have responded
    const room = game.getRoom(code);
    if (room) {
      const connectedPlayers = room.players.filter(p => p.connected);
      if (totalResponses >= connectedPlayers.length) {
        // All players responded, resolve immediately
        clearTimeout(playAgainTimers[code]);
        resolvePlayAgain(code);
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    onlineCount--;
    broadcastOnlineCount();

    // Clean up socket reference
    delete playerSockets[socket.id];

    if (socket.roomCode) {
      const code = socket.roomCode;
      const playerName = socket.playerName;
      const room = game.removePlayer(code, socket.id);

      if (room) {
        io.to(code).emit('player-left', game.getPublicRoomInfo(code));

        // If game is in progress, track disconnect time and set auto-submit timer
        if (room.status === 'playing') {
          const disconnectKey = `${code}:${playerName}`;
          disconnectTimes[disconnectKey] = {
            time: Date.now(),
            roomCode: code,
            playerName: playerName,
            playerId: socket.id
          };

          // Set timer to auto-submit placeholder after 30 seconds
          setTimeout(() => {
            handleDisconnectTimeout(code, socket.id, playerName);
          }, DISCONNECT_TIMEOUT);

          // Check if all remaining connected players have submitted
          const connectedPlayers = room.players.filter(p => p.connected);
          const allSubmitted = connectedPlayers.every(p => room.submissions[p.id]);
          if (allSubmitted && connectedPlayers.length > 0) {
            clearRoomTimer(code);
            advanceRound(code);
          }
        }
      }
    }
  });

  // Handle reconnection attempt
  socket.on('rejoin-room', (data, callback) => {
    const { roomCode, playerName } = data;
    const code = roomCode.toUpperCase();
    const disconnectKey = `${code}:${playerName}`;

    const room = game.getRoom(code);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    // Check if player was in this room
    const existingPlayer = room.players.find(p => p.name === playerName);
    if (!existingPlayer) {
      callback({ success: false, error: 'Player not found in this room' });
      return;
    }

    // Check if within reconnect window
    const disconnectInfo = disconnectTimes[disconnectKey];
    if (disconnectInfo && Date.now() - disconnectInfo.time > RECONNECT_WINDOW) {
      callback({ success: false, error: 'Reconnect window expired' });
      delete disconnectTimes[disconnectKey];
      return;
    }

    // Reconnect the player
    game.reconnectPlayer(code, existingPlayer.id, socket.id);
    delete disconnectTimes[disconnectKey];

    socket.join(code);
    socket.roomCode = code;
    socket.playerName = playerName;
    playerSockets[socket.id] = socket;

    console.log(`${playerName} reconnected to room ${code}`);

    // Notify all players
    io.to(code).emit('player-rejoined', game.getPublicRoomInfo(code));

    // Send current game state to reconnected player
    if (room.status === 'playing') {
      const task = game.getPlayerTask(code, socket.id);
      const remainingTime = room.roundDuration - (Date.now() - room.roundStartTime);
      callback({
        success: true,
        room: game.getPublicRoomInfo(code),
        gameInProgress: true,
        task: task,
        remainingTime: Math.max(0, remainingTime)
      });
    } else {
      callback({
        success: true,
        room: game.getPublicRoomInfo(code),
        gameInProgress: false
      });
    }
  });
});

// Helper: Start a new round
function startRound(code) {
  const room = game.getRoom(code);
  if (!room || room.status !== 'playing') return;

  const duration = room.roundType === 'draw' ? DRAW_TIME : GUESS_TIME;
  game.setRoundTimer(code, duration);

  console.log(`Starting round ${room.currentRound + 1} for room ${code} (${room.roundType})`);

  // Get all sockets currently in this room and send them their tasks
  const socketsInRoom = io.sockets.adapter.rooms.get(code);
  const sentTo = new Set();

  if (socketsInRoom) {
    socketsInRoom.forEach(socketId => {
      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket && playerSocket.roomCode === code && playerSocket.playerName) {
        // Find player by name (more reliable than socket ID which can change)
        const player = room.players.find(p => p.name === playerSocket.playerName);
        if (player && player.connected) {
          // Update player's socket ID to current socket (handles reconnects)
          player.id = socketId;
          playerSockets[socketId] = playerSocket;

          const task = game.getPlayerTask(code, player.id);
          const roundData = {
            ...task,
            duration,
            roomInfo: game.getPublicRoomInfo(code)
          };
          playerSocket.emit('round-start', roundData);
          sentTo.add(player.name);
          console.log(`Sent round-start to ${player.name}`);
        }
      }
    });
  }

  // Log any players who didn't receive the event
  room.players.forEach(player => {
    if (player.connected && !sentTo.has(player.name)) {
      console.warn(`Could not send round-start to ${player.name} - socket not in room`);
    }
  });

  // Set timer to auto-advance when time runs out
  // 3 second buffer gives clients time to auto-submit their work
  roomTimers[code] = setTimeout(() => {
    console.log(`Timer expired for room ${code}`);
    forceAdvanceRound(code);
  }, duration + 3000);
}

// Helper: Advance to next round
function advanceRound(code) {
  const result = game.nextRound(code);
  if (!result) return;

  if (result.gameOver) {
    console.log(`Game over in room ${code}`);
    io.to(code).emit('game-over', { message: 'Game complete! View the results.' });
  } else {
    // Small delay before next round
    setTimeout(() => startRound(code), 2000);
  }
}

// Helper: Force advance (for timeout - only auto-submit for disconnected players)
function forceAdvanceRound(code) {
  const room = game.getRoom(code);
  if (!room || room.status !== 'playing') return;

  // Only auto-submit for DISCONNECTED players who haven't submitted
  // Connected players should have auto-submitted from their client
  room.players.forEach(player => {
    if (!room.submissions[player.id]) {
      if (!player.connected) {
        // Disconnected player - submit placeholder
        const placeholder = room.roundType === 'draw' ? '' : '(player disconnected)';
        game.submitResponse(code, player.id, placeholder);
        console.log(`Auto-submitted placeholder for disconnected player ${player.name}`);
      }
      // For connected players who somehow didn't submit, give them benefit of doubt
      // Their client should have auto-submitted
    }
  });

  advanceRound(code);
}

// Helper: Handle disconnect timeout (30 seconds)
function handleDisconnectTimeout(code, playerId, playerName) {
  const room = game.getRoom(code);
  if (!room) return;

  // Find player by name (ID may have changed)
  const player = room.players.find(p => p.name === playerName);
  if (!player) return;

  // Only proceed if player is still disconnected
  if (player.connected) {
    console.log(`Player ${playerName} reconnected, skipping disconnect timeout`);
    return;
  }

  // If game is still in progress and player hasn't submitted this round
  if (room.status === 'playing' && !room.submissions[player.id]) {
    const placeholder = room.roundType === 'draw' ? '' : '(player disconnected)';
    const result = game.submitResponse(code, player.id, placeholder);
    console.log(`Disconnect timeout: auto-submitted for ${playerName}`);

    if (result.success) {
      // Notify room
      const submittedCount = Object.keys(room.submissions).length;
      const totalPlayers = room.players.filter(p => p.connected).length;
      io.to(code).emit('submission-update', { submitted: submittedCount, total: totalPlayers });

      // Check if all have now submitted
      if (result.allSubmitted) {
        clearRoomTimer(code);
        advanceRound(code);
      }
    }
  }
}

// Helper: Clear room timer
function clearRoomTimer(code) {
  if (roomTimers[code]) {
    clearTimeout(roomTimers[code]);
    delete roomTimers[code];
  }
}

// Helper: Resolve play-again voting
function resolvePlayAgain(code) {
  const room = game.getRoom(code);
  if (!room) return;

  const responses = playAgainResponses[code] || {};
  const yesCount = Object.values(responses).filter(r => r === true).length;

  // Clean up
  delete playAgainResponses[code];
  delete playAgainTimers[code];

  if (yesCount >= 3) {
    // Enough players want to play again
    console.log(`Room ${code}: ${yesCount} players agreed to play again, starting new game`);

    // Remove players who said no or didn't respond
    const playersWhoSaidYes = Object.keys(responses).filter(id => responses[id] === true);
    room.players = room.players.filter(p => playersWhoSaidYes.includes(p.id));

    // Reset game state
    room.status = 'lobby';
    room.currentRound = 0;
    room.totalRounds = 0;
    room.roundType = null;
    room.chains = {};
    room.submissions = {};

    // Start the game immediately
    const result = game.startGame(code);
    if (result.success) {
      io.to(code).emit('play-again-success', { playerCount: yesCount });
      // Small delay then start the round
      setTimeout(() => startRound(code), 2000);
    }
  } else {
    // Not enough players
    console.log(`Room ${code}: Only ${yesCount} players agreed, not enough to play again`);
    io.to(code).emit('play-again-failed', {
      yesCount,
      message: 'Not enough players agreed to play again.'
    });
  }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SketchySecrets server running on port ${PORT}`);
});

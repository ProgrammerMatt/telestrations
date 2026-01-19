const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Round durations in milliseconds
const DRAW_TIME = 60000; // 60 seconds
const GUESS_TIME = 45000; // 45 seconds

// Track active timers per room
const roomTimers = {};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new game room
  socket.on('create-room', (playerName, callback) => {
    const code = game.createRoom(socket.id, playerName);
    socket.join(code);
    socket.roomCode = code;
    socket.playerName = playerName;

    console.log(`Room ${code} created by ${playerName}`);

    callback({
      success: true,
      roomCode: code,
      room: game.getPublicRoomInfo(code)
    });
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
      console.log(`Game started in room ${code}`);
      callback({ success: true });

      // Send each player their task
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

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (socket.roomCode) {
      const room = game.removePlayer(socket.roomCode, socket.id);
      if (room) {
        io.to(socket.roomCode).emit('player-left', game.getPublicRoomInfo(socket.roomCode));

        // If game is in progress and all remaining players have submitted, advance
        if (room.status === 'playing') {
          const connectedPlayers = room.players.filter(p => p.connected);
          const allSubmitted = connectedPlayers.every(p => room.submissions[p.id]);
          if (allSubmitted && connectedPlayers.length > 0) {
            clearRoomTimer(socket.roomCode);
            advanceRound(socket.roomCode);
          }
        }
      }
    }
  });
});

// Helper: Start a new round
function startRound(code) {
  const room = game.getRoom(code);
  if (!room || room.status !== 'playing') return;

  const duration = room.roundType === 'draw' ? DRAW_TIME : GUESS_TIME;
  game.setRoundTimer(code, duration);

  // Send each player their task
  room.players.forEach(player => {
    if (player.connected) {
      const task = game.getPlayerTask(code, player.id);
      io.to(player.id).emit('round-start', {
        ...task,
        duration,
        roomInfo: game.getPublicRoomInfo(code)
      });
    }
  });

  // Set timer to auto-advance when time runs out
  roomTimers[code] = setTimeout(() => {
    console.log(`Timer expired for room ${code}`);
    forceAdvanceRound(code);
  }, duration + 1000); // Extra second buffer
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

// Helper: Force advance (for disconnected players or timeout)
function forceAdvanceRound(code) {
  const room = game.getRoom(code);
  if (!room || room.status !== 'playing') return;

  // Auto-submit empty responses for players who haven't submitted
  room.players.forEach(player => {
    if (player.connected && !room.submissions[player.id]) {
      const emptyResponse = room.roundType === 'draw' ? '' : '(no guess)';
      game.submitResponse(code, player.id, emptyResponse);
    }
  });

  advanceRound(code);
}

// Helper: Clear room timer
function clearRoomTimer(code) {
  if (roomTimers[code]) {
    clearTimeout(roomTimers[code]);
    delete roomTimers[code];
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`Telestrations server running on http://localhost:${PORT}`);
  console.log(`For local network play, find your IP with 'ipconfig' and share http://YOUR_IP:${PORT}`);
});

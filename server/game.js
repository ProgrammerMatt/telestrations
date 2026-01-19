const { getRandomWords } = require('./words');

// In-memory storage for all game rooms
const rooms = {};

// Generate a random 4-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure uniqueness
  if (rooms[code]) {
    return generateRoomCode();
  }
  return code;
}

// Create a new game room
function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  rooms[code] = {
    host: hostId,
    players: [{
      id: hostId,
      name: hostName,
      connected: true
    }],
    status: 'lobby', // 'lobby', 'playing', 'results'
    currentRound: 0,
    totalRounds: 0,
    roundType: null, // 'draw' or 'guess'
    chains: {},
    submissions: {},
    roundStartTime: null,
    roundDuration: 0
  };
  return code;
}

// Join an existing room
function joinRoom(code, playerId, playerName) {
  const room = rooms[code];
  if (!room) {
    return { success: false, error: 'Room not found' };
  }
  if (room.status !== 'lobby') {
    return { success: false, error: 'Game already in progress' };
  }
  if (room.players.length >= 8) {
    return { success: false, error: 'Room is full (max 8 players)' };
  }
  if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
    return { success: false, error: 'Name already taken' };
  }

  room.players.push({
    id: playerId,
    name: playerName,
    connected: true
  });

  return { success: true, room };
}

// Get room data
function getRoom(code) {
  return rooms[code] || null;
}

// Get room by player ID
function getRoomByPlayerId(playerId) {
  for (const [code, room] of Object.entries(rooms)) {
    if (room.players.some(p => p.id === playerId)) {
      return { code, room };
    }
  }
  return null;
}

// Remove player from room
function removePlayer(code, playerId) {
  const room = rooms[code];
  if (!room) return null;

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return null;

  // If game is in progress, just mark as disconnected
  if (room.status === 'playing') {
    room.players[playerIndex].connected = false;
  } else {
    // In lobby, remove completely
    room.players.splice(playerIndex, 1);
  }

  // If host left and there are other players, assign new host
  if (room.host === playerId && room.players.length > 0) {
    const connectedPlayer = room.players.find(p => p.connected);
    if (connectedPlayer) {
      room.host = connectedPlayer.id;
    }
  }

  // Delete room if empty
  if (room.players.length === 0 || !room.players.some(p => p.connected)) {
    delete rooms[code];
    return null;
  }

  return room;
}

// Reconnect player
function reconnectPlayer(code, playerId, newSocketId) {
  const room = rooms[code];
  if (!room) return null;

  const player = room.players.find(p => p.id === playerId || p.name === playerId);
  if (player) {
    player.id = newSocketId;
    player.connected = true;
    if (room.host === playerId) {
      room.host = newSocketId;
    }
  }
  return room;
}

// Start the game
function startGame(code) {
  const room = rooms[code];
  if (!room) return { success: false, error: 'Room not found' };
  if (room.players.length < 3) {
    return { success: false, error: 'Need at least 3 players to start' };
  }

  room.status = 'playing';
  room.currentRound = 0;
  room.totalRounds = room.players.length; // Each chain passes through all players
  room.roundType = 'draw'; // First round is always drawing the initial word

  // Initialize chains with random words
  const words = getRandomWords(room.players.length);
  room.chains = {};
  room.players.forEach((player, index) => {
    room.chains[player.id] = [{
      type: 'word',
      content: words[index],
      author: 'system'
    }];
  });

  room.submissions = {};

  return { success: true, room };
}

// Get what a player should see this round
function getPlayerTask(code, playerId) {
  const room = rooms[code];
  if (!room || room.status !== 'playing') return null;

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return null;

  // Calculate which chain this player is working on
  // Chains rotate: in round N, player works on chain (playerIndex - N + totalPlayers) % totalPlayers
  const chainOwnerIndex = (playerIndex - room.currentRound + room.players.length) % room.players.length;
  const chainOwnerId = room.players[chainOwnerIndex].id;
  const chain = room.chains[chainOwnerId];

  // Get the last item in the chain (what they need to respond to)
  const lastItem = chain[chain.length - 1];

  return {
    roundType: room.roundType,
    roundNumber: room.currentRound + 1,
    totalRounds: room.totalRounds,
    chainOwnerId,
    prompt: lastItem // The word or drawing they need to respond to
  };
}

// Submit a drawing or guess
function submitResponse(code, playerId, response) {
  const room = rooms[code];
  if (!room || room.status !== 'playing') {
    return { success: false, error: 'Game not in progress' };
  }

  // Check if already submitted
  if (room.submissions[playerId]) {
    return { success: false, error: 'Already submitted' };
  }

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return { success: false, error: 'Player not found' };
  }

  // Find which chain this player is working on
  const chainOwnerIndex = (playerIndex - room.currentRound + room.players.length) % room.players.length;
  const chainOwnerId = room.players[chainOwnerIndex].id;

  // Add to the chain
  room.chains[chainOwnerId].push({
    type: room.roundType === 'draw' ? 'drawing' : 'guess',
    content: response,
    author: playerId,
    authorName: room.players[playerIndex].name
  });

  room.submissions[playerId] = true;

  // Check if all connected players have submitted
  const connectedPlayers = room.players.filter(p => p.connected);
  const allSubmitted = connectedPlayers.every(p => room.submissions[p.id]);

  return { success: true, allSubmitted };
}

// Advance to next round
function nextRound(code) {
  const room = rooms[code];
  if (!room) return null;

  room.currentRound++;
  room.submissions = {};

  // Alternate between guess and draw
  room.roundType = room.roundType === 'draw' ? 'guess' : 'draw';

  // Check if game is over (all rounds complete)
  if (room.currentRound >= room.totalRounds) {
    room.status = 'results';
    return { room, gameOver: true };
  }

  return { room, gameOver: false };
}

// Get results for display
function getResults(code) {
  const room = rooms[code];
  if (!room) return null;

  // Format chains for display
  const formattedChains = [];
  room.players.forEach(player => {
    const chain = room.chains[player.id];
    formattedChains.push({
      originalPlayer: player.name,
      originalPlayerId: player.id,
      items: chain.map(item => ({
        type: item.type,
        content: item.content,
        authorName: item.authorName || (item.author === 'system' ? 'Starting Word' : 'Unknown')
      }))
    });
  });

  return formattedChains;
}

// Set round timer info
function setRoundTimer(code, duration) {
  const room = rooms[code];
  if (room) {
    room.roundStartTime = Date.now();
    room.roundDuration = duration;
  }
}

// Get public room info (safe to send to clients)
function getPublicRoomInfo(code) {
  const room = rooms[code];
  if (!room) return null;

  return {
    code,
    host: room.host,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected
    })),
    status: room.status,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    roundType: room.roundType
  };
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  getRoomByPlayerId,
  removePlayer,
  reconnectPlayer,
  startGame,
  getPlayerTask,
  submitResponse,
  nextRound,
  getResults,
  setRoundTimer,
  getPublicRoomInfo
};

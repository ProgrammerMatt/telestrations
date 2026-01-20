// Socket.io client wrapper
const SocketClient = (function() {
  let socket = null;
  const eventHandlers = {};

  function connect() {
    console.log('Attempting to connect to server...');
    socket = io({
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
      trigger('connected');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      trigger('disconnected');
    });

    // Game events
    socket.on('player-joined', (roomInfo) => {
      trigger('player-joined', roomInfo);
    });

    socket.on('player-left', (roomInfo) => {
      trigger('player-left', roomInfo);
    });

    socket.on('round-start', (data) => {
      trigger('round-start', data);
    });

    socket.on('submission-update', (data) => {
      trigger('submission-update', data);
    });

    socket.on('game-over', (data) => {
      trigger('game-over', data);
    });

    socket.on('returned-to-lobby', (roomInfo) => {
      trigger('returned-to-lobby', roomInfo);
    });

    socket.on('chat-message', (data) => {
      trigger('chat-message', data);
    });
  }

  function on(event, handler) {
    if (!eventHandlers[event]) {
      eventHandlers[event] = [];
    }
    eventHandlers[event].push(handler);
  }

  function off(event, handler) {
    if (eventHandlers[event]) {
      if (handler) {
        eventHandlers[event] = eventHandlers[event].filter(h => h !== handler);
      } else {
        eventHandlers[event] = [];
      }
    }
  }

  function trigger(event, data) {
    if (eventHandlers[event]) {
      eventHandlers[event].forEach(handler => handler(data));
    }
  }

  function createRoom(playerName, options = {}) {
    return new Promise((resolve, reject) => {
      const data = {
        playerName,
        isPublic: options.isPublic || false,
        roomName: options.roomName || ''
      };
      socket.emit('create-room', data, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function getPublicLobbies() {
    return new Promise((resolve, reject) => {
      socket.emit('get-public-lobbies', (response) => {
        if (response.success) {
          resolve(response.lobbies);
        } else {
          reject(new Error(response.error || 'Failed to get lobbies'));
        }
      });
    });
  }

  function sendChat(message) {
    return new Promise((resolve, reject) => {
      socket.emit('send-chat', message, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function getChatHistory() {
    return new Promise((resolve, reject) => {
      socket.emit('get-chat-history', (response) => {
        if (response.success) {
          resolve(response.messages);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function joinRoom(roomCode, playerName) {
    return new Promise((resolve, reject) => {
      socket.emit('join-room', { roomCode, playerName }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function startGame() {
    return new Promise((resolve, reject) => {
      socket.emit('start-game', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function submitDrawing(drawingData) {
    return new Promise((resolve, reject) => {
      socket.emit('submit-drawing', drawingData, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function submitGuess(guessText) {
    return new Promise((resolve, reject) => {
      socket.emit('submit-guess', guessText, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function requestResults() {
    return new Promise((resolve, reject) => {
      socket.emit('request-results', (response) => {
        if (response.success) {
          resolve(response.chains);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function returnToLobby() {
    return new Promise((resolve, reject) => {
      socket.emit('return-to-lobby', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function getSocketId() {
    return socket ? socket.id : null;
  }

  return {
    connect,
    on,
    off,
    createRoom,
    joinRoom,
    startGame,
    submitDrawing,
    submitGuess,
    requestResults,
    returnToLobby,
    getSocketId,
    getPublicLobbies,
    sendChat,
    getChatHistory
  };
})();

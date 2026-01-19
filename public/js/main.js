// App initialization and routing
const App = (function() {
  // Track lobby visibility selection
  let isPublicLobby = false;

  function init() {
    // Connect to socket server
    SocketClient.connect();

    // Initialize modules
    DrawingCanvas.init();
    Chat.init();
    Lobby.init();
    Game.init();

    // Set up navigation
    setupNavigation();

    // Show home screen
    showScreen('home-screen');
  }

  function setupNavigation() {
    // Home screen buttons
    document.getElementById('create-game-btn').addEventListener('click', () => {
      showScreen('create-screen');
    });

    document.getElementById('join-public-btn').addEventListener('click', () => {
      showScreen('public-lobbies-screen');
      loadPublicLobbies();
    });

    document.getElementById('join-private-btn').addEventListener('click', () => {
      showScreen('join-private-screen');
    });

    // Back buttons
    document.getElementById('back-from-create').addEventListener('click', () => {
      showScreen('home-screen');
    });

    document.getElementById('back-from-join-private').addEventListener('click', () => {
      showScreen('home-screen');
    });

    document.getElementById('back-from-public').addEventListener('click', () => {
      showScreen('home-screen');
    });

    // Visibility toggle buttons
    document.getElementById('visibility-public-btn').addEventListener('click', () => {
      isPublicLobby = true;
      document.getElementById('visibility-public-btn').classList.add('active');
      document.getElementById('visibility-private-btn').classList.remove('active');
    });

    document.getElementById('visibility-private-btn').addEventListener('click', () => {
      isPublicLobby = false;
      document.getElementById('visibility-private-btn').classList.add('active');
      document.getElementById('visibility-public-btn').classList.remove('active');
    });

    // Create room
    document.getElementById('create-room-btn').addEventListener('click', createRoom);

    // Join room (private)
    document.getElementById('join-room-btn').addEventListener('click', joinPrivateRoom);

    // Refresh lobbies
    document.getElementById('refresh-lobbies-btn').addEventListener('click', loadPublicLobbies);

    // Start game (host only)
    document.getElementById('start-game-btn').addEventListener('click', startGame);

    // Allow Enter key on inputs
    document.getElementById('host-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') createRoom();
    });

    document.getElementById('room-code').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('player-name').focus();
      }
    });

    document.getElementById('player-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinPrivateRoom();
    });

    document.getElementById('public-player-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        // Focus is on name input, do nothing special on enter
      }
    });
  }

  async function createRoom() {
    const nameInput = document.getElementById('host-name');
    const roomNameInput = document.getElementById('room-name');
    const name = nameInput.value.trim();
    const roomName = roomNameInput ? roomNameInput.value.trim() : '';

    if (!name) {
      showError('Please enter your name');
      nameInput.focus();
      return;
    }

    try {
      const response = await SocketClient.createRoom(name, {
        isPublic: isPublicLobby,
        roomName: roomName
      });
      Lobby.setRoom(response.room);
      showScreen('lobby-screen');
    } catch (error) {
      showError(error.message);
    }
  }

  async function joinPrivateRoom() {
    const codeInput = document.getElementById('room-code');
    const nameInput = document.getElementById('player-name');

    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();

    if (!code || code.length !== 4) {
      showError('Please enter a valid 4-character room code');
      codeInput.focus();
      return;
    }

    if (!name) {
      showError('Please enter your name');
      nameInput.focus();
      return;
    }

    try {
      const response = await SocketClient.joinRoom(code, name);
      Lobby.setRoom(response.room);
      showScreen('lobby-screen');
    } catch (error) {
      showError(error.message);
    }
  }

  async function loadPublicLobbies() {
    const lobbiesList = document.getElementById('lobbies-list');
    if (!lobbiesList) return;

    lobbiesList.innerHTML = '<p class="no-lobbies">Loading lobbies...</p>';

    try {
      const lobbies = await SocketClient.getPublicLobbies();

      if (lobbies.length === 0) {
        lobbiesList.innerHTML = '<p class="no-lobbies">No public games available. Create one!</p>';
        return;
      }

      lobbiesList.innerHTML = '';
      lobbies.forEach(lobby => {
        const lobbyEl = document.createElement('div');
        lobbyEl.className = 'lobby-item';
        lobbyEl.innerHTML = `
          <div class="lobby-item-info">
            <span class="lobby-item-name">${escapeHtml(lobby.roomName || 'Game ' + lobby.code)}</span>
            <span class="lobby-item-details">Host: ${escapeHtml(lobby.hostName)} | ${lobby.playerCount}/${lobby.maxPlayers} players</span>
          </div>
          <button class="btn btn-small btn-primary join-lobby-btn" data-code="${lobby.code}">Join</button>
        `;
        lobbiesList.appendChild(lobbyEl);
      });

      // Add click handlers to join buttons
      lobbiesList.querySelectorAll('.join-lobby-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          joinPublicLobby(btn.dataset.code);
        });
      });
    } catch (error) {
      lobbiesList.innerHTML = '<p class="no-lobbies">Failed to load lobbies. Try again.</p>';
      console.error('Failed to load lobbies:', error);
    }
  }

  async function joinPublicLobby(code) {
    const nameInput = document.getElementById('public-player-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      showError('Please enter your name');
      if (nameInput) nameInput.focus();
      return;
    }

    try {
      const response = await SocketClient.joinRoom(code, name);
      Lobby.setRoom(response.room);
      showScreen('lobby-screen');
    } catch (error) {
      showError(error.message);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function startGame() {
    try {
      await SocketClient.startGame();
    } catch (error) {
      showError(error.message);
    }
  }

  function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }

    // Manage chat visibility
    const screensWithChat = ['lobby-screen', 'game-screen', 'results-screen'];
    if (screensWithChat.includes(screenId)) {
      Chat.show();
    } else {
      Chat.hide();
    }
  }

  function showError(message) {
    const toast = document.getElementById('error-toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    showScreen,
    showError
  };
})();

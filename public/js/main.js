// App initialization and routing
const App = (function() {
  function init() {
    // Connect to socket server
    SocketClient.connect();

    // Initialize modules
    DrawingCanvas.init();
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

    document.getElementById('join-game-btn').addEventListener('click', () => {
      showScreen('join-screen');
    });

    // Back buttons
    document.getElementById('back-from-create').addEventListener('click', () => {
      showScreen('home-screen');
    });

    document.getElementById('back-from-join').addEventListener('click', () => {
      showScreen('home-screen');
    });

    // Create room
    document.getElementById('create-room-btn').addEventListener('click', createRoom);

    // Join room
    document.getElementById('join-room-btn').addEventListener('click', joinRoom);

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
      if (e.key === 'Enter') joinRoom();
    });
  }

  async function createRoom() {
    const nameInput = document.getElementById('host-name');
    const name = nameInput.value.trim();

    if (!name) {
      showError('Please enter your name');
      nameInput.focus();
      return;
    }

    try {
      const response = await SocketClient.createRoom(name);
      Lobby.setRoom(response.room);
      showScreen('lobby-screen');
    } catch (error) {
      showError(error.message);
    }
  }

  async function joinRoom() {
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

// Lobby UI logic
const Lobby = (function() {
  let currentRoom = null;
  let isHost = false;

  function init() {
    // Socket events
    SocketClient.on('player-joined', updateLobby);
    SocketClient.on('player-left', updateLobby);
    SocketClient.on('returned-to-lobby', handleReturnToLobby);
  }

  function updateLobby(roomInfo) {
    currentRoom = roomInfo;
    isHost = roomInfo.host === SocketClient.getSocketId();

    // Update room code display
    const codeDisplay = document.getElementById('display-room-code');
    if (codeDisplay) {
      codeDisplay.textContent = roomInfo.code;
    }

    // Update visibility badge
    const visibilityBadge = document.getElementById('visibility-badge');
    if (visibilityBadge) {
      if (roomInfo.isPublic) {
        visibilityBadge.textContent = 'PUBLIC';
        visibilityBadge.classList.remove('private');
        visibilityBadge.classList.add('public');
      } else {
        visibilityBadge.textContent = 'PRIVATE';
        visibilityBadge.classList.remove('public');
        visibilityBadge.classList.add('private');
      }
    }

    // Update player count
    const countDisplay = document.getElementById('player-count');
    if (countDisplay) {
      countDisplay.textContent = roomInfo.players.length;
    }

    // Update player list
    const playerList = document.getElementById('player-list');
    if (playerList) {
      playerList.innerHTML = '';
      roomInfo.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        if (player.id === roomInfo.host) {
          li.classList.add('host');
        }
        if (!player.connected) {
          li.classList.add('disconnected');
          li.textContent += ' (disconnected)';
        }
        playerList.appendChild(li);
      });
    }

    // Show/hide host controls
    const hostControls = document.getElementById('host-controls');
    const guestControls = document.getElementById('guest-controls');

    if (hostControls && guestControls) {
      if (isHost) {
        hostControls.classList.remove('hidden');
        guestControls.classList.add('hidden');
      } else {
        hostControls.classList.add('hidden');
        guestControls.classList.remove('hidden');
      }
    }

    // Enable/disable start button based on player count
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
      const canStart = roomInfo.players.length >= 3;
      startBtn.disabled = !canStart;
    }
  }

  function handleReturnToLobby(roomInfo) {
    updateLobby(roomInfo);
    App.showScreen('lobby-screen');
  }

  function setRoom(roomInfo) {
    updateLobby(roomInfo);
  }

  function getRoom() {
    return currentRoom;
  }

  function getIsHost() {
    return isHost;
  }

  return {
    init,
    updateLobby,
    setRoom,
    getRoom,
    getIsHost
  };
})();

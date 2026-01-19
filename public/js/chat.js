// Chat UI module
const Chat = (function() {
  let isMinimized = false;
  let unreadCount = 0;

  function init() {
    // Socket event for incoming messages
    SocketClient.on('chat-message', handleNewMessage);

    // Set up event listeners
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');

    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
    }

    if (chatSendBtn) {
      chatSendBtn.addEventListener('click', sendMessage);
    }

    if (chatToggleBtn) {
      chatToggleBtn.addEventListener('click', toggleMinimize);
    }

    // Listen for window resize to auto-minimize on mobile
    window.addEventListener('resize', handleResize);
  }

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function handleResize() {
    // Auto-minimize on mobile if not already minimized
    if (isMobile() && !isMinimized) {
      setMinimized(true);
    }
  }

  function show() {
    const chatPanel = document.getElementById('chat-panel');
    const appWrapper = document.getElementById('app-wrapper');
    if (chatPanel) {
      chatPanel.classList.remove('hidden');
      if (appWrapper) {
        appWrapper.classList.add('chat-active');
      }

      // Start minimized on mobile
      if (isMobile()) {
        setMinimized(true);
      } else {
        setMinimized(false);
      }

      // Load chat history when showing
      loadChatHistory();
    }
  }

  function hide() {
    const chatPanel = document.getElementById('chat-panel');
    const appWrapper = document.getElementById('app-wrapper');
    if (chatPanel) {
      chatPanel.classList.add('hidden');
      if (appWrapper) {
        appWrapper.classList.remove('chat-active');
      }
    }
  }

  function setMinimized(minimized) {
    const chatPanel = document.getElementById('chat-panel');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');

    isMinimized = minimized;

    if (chatPanel) {
      chatPanel.classList.toggle('minimized', isMinimized);
    }

    if (chatToggleBtn) {
      chatToggleBtn.textContent = isMinimized ? '+' : '-';
    }

    if (!isMinimized) {
      unreadCount = 0;
      updateUnreadBadge();
    }
  }

  function toggleMinimize() {
    setMinimized(!isMinimized);
  }

  async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;

    const message = chatInput.value.trim();
    if (!message) return;

    try {
      await SocketClient.sendChat(message);
      chatInput.value = '';
    } catch (error) {
      console.error('Failed to send chat message:', error);
    }
  }

  function handleNewMessage(chatMessage) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const messageEl = createMessageElement(chatMessage);
    chatMessages.appendChild(messageEl);

    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Update unread count if minimized (mobile only)
    if (isMinimized && isMobile()) {
      unreadCount++;
      updateUnreadBadge();
    }
  }

  function createMessageElement(chatMessage) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';

    const isOwnMessage = chatMessage.playerId === SocketClient.getSocketId();
    if (isOwnMessage) {
      messageEl.classList.add('own-message');
    }

    const nameEl = document.createElement('span');
    nameEl.className = 'chat-message-name';
    nameEl.textContent = chatMessage.playerName;

    const textEl = document.createElement('span');
    textEl.className = 'chat-message-text';
    textEl.textContent = chatMessage.message;

    messageEl.appendChild(nameEl);
    messageEl.appendChild(textEl);

    return messageEl;
  }

  async function loadChatHistory() {
    try {
      const messages = await SocketClient.getChatHistory();
      const chatMessages = document.getElementById('chat-messages');
      if (!chatMessages) return;

      // Clear existing messages
      chatMessages.innerHTML = '';

      // Add all messages
      messages.forEach(msg => {
        const messageEl = createMessageElement(msg);
        chatMessages.appendChild(messageEl);
      });

      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }

  function updateUnreadBadge() {
    const badge = document.getElementById('chat-unread-badge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  function clearMessages() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
      chatMessages.innerHTML = '';
    }
    unreadCount = 0;
    updateUnreadBadge();
  }

  return {
    init,
    show,
    hide,
    clearMessages,
    loadChatHistory
  };
})();

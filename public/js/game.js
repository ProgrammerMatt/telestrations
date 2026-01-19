// Game UI and flow
const Game = (function() {
  let timerInterval = null;
  let timeRemaining = 0;
  let hasSubmitted = false;
  let currentChains = [];
  let currentChainIndex = 0;

  function init() {
    // Socket events
    SocketClient.on('round-start', handleRoundStart);
    SocketClient.on('submission-update', handleSubmissionUpdate);
    SocketClient.on('game-over', handleGameOver);

    // Submit buttons
    const submitDrawingBtn = document.getElementById('submit-drawing');
    if (submitDrawingBtn) {
      submitDrawingBtn.addEventListener('click', submitDrawing);
    }

    const submitGuessBtn = document.getElementById('submit-guess');
    if (submitGuessBtn) {
      submitGuessBtn.addEventListener('click', submitGuess);
    }

    // Also allow Enter key for guess
    const guessInput = document.getElementById('guess-input');
    if (guessInput) {
      guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitGuess();
        }
      });
    }

    // Results navigation
    const prevChainBtn = document.getElementById('prev-chain');
    const nextChainBtn = document.getElementById('next-chain');
    if (prevChainBtn) {
      prevChainBtn.addEventListener('click', () => showChain(currentChainIndex - 1));
    }
    if (nextChainBtn) {
      nextChainBtn.addEventListener('click', () => showChain(currentChainIndex + 1));
    }

    // Play again button
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', returnToLobby);
    }
  }

  function handleRoundStart(data) {
    hasSubmitted = false;

    // Update round info
    document.getElementById('current-round').textContent = data.roundNumber;
    document.getElementById('total-rounds').textContent = data.totalRounds;
    document.getElementById('total-players').textContent = data.roomInfo.players.filter(p => p.connected).length;
    document.getElementById('submitted-count').textContent = '0';

    // Start timer
    startTimer(Math.floor(data.duration / 1000));

    // Show appropriate phase
    hideAllPhases();

    if (data.roundType === 'draw') {
      showDrawPhase(data.prompt.content);
    } else {
      showGuessPhase(data.prompt.content);
    }

    App.showScreen('game-screen');
  }

  function handleSubmissionUpdate(data) {
    document.getElementById('submitted-count').textContent = data.submitted;
    document.getElementById('total-players').textContent = data.total;
  }

  function handleGameOver() {
    stopTimer();
    loadResults();
  }

  function hideAllPhases() {
    document.getElementById('draw-phase').classList.add('hidden');
    document.getElementById('guess-phase').classList.add('hidden');
    document.getElementById('waiting-phase').classList.add('hidden');
  }

  function showDrawPhase(word) {
    document.getElementById('word-to-draw').textContent = word;
    document.getElementById('draw-phase').classList.remove('hidden');

    // Reset canvas
    DrawingCanvas.reset();
    DrawingCanvas.resizeCanvas();

    // Enable submit button
    document.getElementById('submit-drawing').disabled = false;
  }

  function showGuessPhase(drawingData) {
    const img = document.getElementById('drawing-to-guess');
    img.src = drawingData || '';
    document.getElementById('guess-phase').classList.remove('hidden');

    // Clear input
    document.getElementById('guess-input').value = '';

    // Enable submit
    document.getElementById('submit-guess').disabled = false;
  }

  function showWaitingPhase() {
    hideAllPhases();
    document.getElementById('waiting-phase').classList.remove('hidden');
  }

  function startTimer(seconds) {
    stopTimer();
    timeRemaining = seconds;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();

      if (timeRemaining <= 0) {
        stopTimer();
        // Auto-submit if not already submitted
        if (!hasSubmitted) {
          autoSubmit();
        }
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const timerEl = document.getElementById('timer');
    timerEl.textContent = timeRemaining;

    // Color based on time remaining
    const timerDisplay = timerEl.parentElement;
    timerDisplay.classList.remove('warning', 'danger');

    if (timeRemaining <= 10) {
      timerDisplay.classList.add('danger');
    } else if (timeRemaining <= 20) {
      timerDisplay.classList.add('warning');
    }
  }

  async function submitDrawing() {
    if (hasSubmitted) return;

    const drawingData = DrawingCanvas.toDataURL();
    document.getElementById('submit-drawing').disabled = true;

    try {
      await SocketClient.submitDrawing(drawingData);
      hasSubmitted = true;
      showWaitingPhase();
    } catch (error) {
      App.showError(error.message);
      document.getElementById('submit-drawing').disabled = false;
    }
  }

  async function submitGuess() {
    if (hasSubmitted) return;

    const guessInput = document.getElementById('guess-input');
    const guess = guessInput.value.trim();

    if (!guess) {
      App.showError('Please enter a guess');
      return;
    }

    document.getElementById('submit-guess').disabled = true;

    try {
      await SocketClient.submitGuess(guess);
      hasSubmitted = true;
      showWaitingPhase();
    } catch (error) {
      App.showError(error.message);
      document.getElementById('submit-guess').disabled = false;
    }
  }

  async function autoSubmit() {
    if (hasSubmitted) return;

    // Check which phase we're in
    const drawPhase = document.getElementById('draw-phase');
    if (!drawPhase.classList.contains('hidden')) {
      // Auto-submit drawing
      const drawingData = DrawingCanvas.toDataURL();
      try {
        await SocketClient.submitDrawing(drawingData);
      } catch (e) {
        console.error('Auto-submit drawing failed:', e);
      }
    } else {
      // Auto-submit guess
      const guess = document.getElementById('guess-input').value.trim() || '(no guess)';
      try {
        await SocketClient.submitGuess(guess);
      } catch (e) {
        console.error('Auto-submit guess failed:', e);
      }
    }

    hasSubmitted = true;
    showWaitingPhase();
  }

  async function loadResults() {
    try {
      currentChains = await SocketClient.requestResults();
      currentChainIndex = 0;
      showChain(0);

      // Show/hide host controls
      const hostControls = document.getElementById('results-host-controls');
      if (hostControls) {
        if (Lobby.getIsHost()) {
          hostControls.classList.remove('hidden');
        } else {
          hostControls.classList.add('hidden');
        }
      }

      App.showScreen('results-screen');
    } catch (error) {
      App.showError('Failed to load results: ' + error.message);
    }
  }

  function showChain(index) {
    if (index < 0) index = currentChains.length - 1;
    if (index >= currentChains.length) index = 0;

    currentChainIndex = index;
    const chain = currentChains[index];

    // Update indicator
    document.getElementById('chain-indicator').textContent =
      `${chain.originalPlayer}'s Chain (${index + 1}/${currentChains.length})`;

    // Build chain display
    const chainDisplay = document.getElementById('chain-display');
    chainDisplay.innerHTML = '';

    chain.items.forEach((item, i) => {
      const itemEl = document.createElement('div');
      itemEl.className = `chain-item ${item.type}`;

      const headerEl = document.createElement('div');
      headerEl.className = 'chain-item-header';

      if (item.type === 'word') {
        headerEl.textContent = `Starting Word`;
      } else if (item.type === 'drawing') {
        headerEl.textContent = `Drawn by ${item.authorName}`;
      } else {
        headerEl.textContent = `Guessed by ${item.authorName}`;
      }

      const contentEl = document.createElement('div');
      contentEl.className = 'chain-item-content';

      if (item.type === 'drawing') {
        const img = document.createElement('img');
        img.src = item.content;
        img.alt = 'Drawing';
        contentEl.appendChild(img);
      } else {
        contentEl.textContent = item.content;
      }

      itemEl.appendChild(headerEl);
      itemEl.appendChild(contentEl);
      chainDisplay.appendChild(itemEl);
    });
  }

  async function returnToLobby() {
    try {
      await SocketClient.returnToLobby();
    } catch (error) {
      App.showError('Failed to return to lobby: ' + error.message);
    }
  }

  return {
    init,
    hideAllPhases,
    stopTimer
  };
})();

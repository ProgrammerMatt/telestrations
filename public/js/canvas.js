// Drawing canvas functionality
const DrawingCanvas = (function() {
  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let currentColor = '#000000';
  let brushSize = 8;
  let lastX = 0;
  let lastY = 0;
  let currentScale = 1;
  let cssWidth = 0;
  let cssHeight = 0;

  function init() {
    canvas = document.getElementById('drawing-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');

    // Don't resize here - canvas might be hidden. Will resize when shown.
    window.addEventListener('resize', resizeCanvas);

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    // Tool buttons
    setupToolButtons();

    // Clear button
    const clearBtn = document.getElementById('clear-canvas');
    if (clearBtn) {
      clearBtn.addEventListener('click', clear);
    }
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;

    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();

    // Skip if container has no dimensions (hidden)
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    // Store CSS dimensions for coordinate calculations
    cssWidth = rect.width;
    cssHeight = rect.height;

    // Set internal resolution (higher for quality on high-DPI screens)
    currentScale = window.devicePixelRatio || 1;
    canvas.width = rect.width * currentScale;
    canvas.height = rect.height * currentScale;

    // Scale context so we can draw in CSS pixel coordinates
    ctx.scale(currentScale, currentScale);

    // Set white background (use CSS dimensions since context is scaled)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Set drawing properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function setupToolButtons() {
    // Color buttons
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        colorButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.dataset.color;
      });
    });

    // Size buttons
    const sizeButtons = document.querySelectorAll('.size-btn');
    sizeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        brushSize = parseInt(btn.dataset.size);
      });
    });
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  function startDrawing(e) {
    if (!ctx || cssWidth === 0) return; // Canvas not ready

    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;

    // Draw a dot for single clicks
    ctx.beginPath();
    ctx.arc(lastX, lastY, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = currentColor;
    ctx.fill();
  }

  function draw(e) {
    if (!isDrawing || !ctx) return;

    const pos = getMousePos(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function handleTouchStart(e) {
    e.preventDefault();
    if (!ctx || cssWidth === 0) return; // Canvas not ready

    isDrawing = true;
    const pos = getTouchPos(e);
    lastX = pos.x;
    lastY = pos.y;

    // Draw a dot for single taps
    ctx.beginPath();
    ctx.arc(lastX, lastY, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = currentColor;
    ctx.fill();
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (!isDrawing || !ctx) return;

    const pos = getTouchPos(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
  }

  function clear() {
    if (!ctx || !canvas) return;
    // Use CSS dimensions since context is scaled
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cssWidth || canvas.width, cssHeight || canvas.height);
  }

  function toDataURL() {
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  }

  function reset() {
    // Reset tools to default
    currentColor = '#000000';
    brushSize = 8;

    // Reset UI
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === '#000000');
    });

    const sizeButtons = document.querySelectorAll('.size-btn');
    sizeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === '8');
    });

    // Clear will be done after resize in resizeCanvas()
  }

  return {
    init,
    clear,
    reset,
    toDataURL,
    resizeCanvas
  };
})();

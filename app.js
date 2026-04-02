const video         = document.getElementById('video');
    const drawCanvas    = document.getElementById('drawCanvas');
    const overlayCanvas = document.getElementById('overlayCanvas');
    const drawCtx       = drawCanvas.getContext('2d');
    const overlayCtx    = overlayCanvas.getContext('2d');
    const status        = document.getElementById('status');
    const gestureInd    = document.getElementById('gestureIndicator');
    const colorCycleEl  = document.getElementById('colorCycle');

    const COLORS = ['#3b82f6','#22c55e','#ef4444','#facc15','#f97316','#a855f7','#ffffff'];
    let colorIndex   = 0;
    let currentColor = COLORS[colorIndex];
    let brushSize    = 7;
    let isEraser     = false;
    let prevX = null, prevY = null;

    // Gesture debounce state
    let lastGesture    = '';
    let gestureFrames  = 0;
    const GESTURE_HOLD = 8; // frames to confirm gesture

    // Color gesture debounce — avoid rapid cycling
    let colorChangeCooldown = 0;
    let gestureIndicatorTimer = null;

    // Build color cycle UI
    function buildColorCycleUI() {
      colorCycleEl.innerHTML = '';
      COLORS.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = 'ccDot' + (i === colorIndex ? ' active' : '');
        d.style.background = c;
        colorCycleEl.appendChild(d);
      });
    }
    buildColorCycleUI();

    function showGestureIndicator(text, duration = 1200) {
      gestureInd.textContent = text;
      gestureInd.classList.add('visible');
      clearTimeout(gestureIndicatorTimer);
      gestureIndicatorTimer = setTimeout(() => {
        gestureInd.classList.remove('visible');
      }, duration);
    }

    function showColorCycle(duration = 1500) {
      buildColorCycleUI();
      colorCycleEl.classList.add('visible');
      clearTimeout(colorCycleEl._timer);
      colorCycleEl._timer = setTimeout(() => {
        colorCycleEl.classList.remove('visible');
      }, duration);
    }

    // Sync toolbar selection to currentColor
    function syncColorButtons() {
      document.querySelectorAll('.colorBtn').forEach(b => {
        b.classList.toggle('active', b.dataset.color === currentColor && !isEraser);
      });
    }

    document.getElementById('startBtn').onclick = async () => {
      status.textContent = 'Покретање камере...';
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          document.getElementById('placeholder').style.display = 'none';
          document.getElementById('videoWrapper').style.display = 'block';
          document.getElementById('controls').style.display   = 'flex';
          document.getElementById('gestureHint').style.display = 'block';
          resizeCanvases();
          initMediaPipe();
        };
      } catch(e) {
        status.textContent = 'Приступ камери одбијен.';
      }
    };

    function resizeCanvases() {
      const w = video.videoWidth  || 640;
      const h = video.videoHeight || 480;
      drawCanvas.width    = w; drawCanvas.height    = h;
      overlayCanvas.width = w; overlayCanvas.height = h;
    }

    document.querySelectorAll('.colorBtn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.colorBtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.dataset.color;
        isEraser     = btn.dataset.eraser === 'true';
        if (!isEraser) {
          colorIndex = COLORS.indexOf(currentColor);
          if (colorIndex < 0) colorIndex = 0;
        }
      };
    });

    document.getElementById('clearBtn').onclick = () => {
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    };

    document.getElementById('saveBtn').onclick = () => {
      const tmp  = document.createElement('canvas');
      tmp.width  = drawCanvas.width;
      tmp.height = drawCanvas.height;
      const tCtx = tmp.getContext('2d');
      tCtx.fillStyle = '#000';
      tCtx.fillRect(0, 0, tmp.width, tmp.height);
      tCtx.drawImage(drawCanvas, 0, 0);
      const a    = document.createElement('a');
      a.href     = tmp.toDataURL('image/png');
      a.download = 'drawing.png';
      a.click();
    };

    const brushRange = document.getElementById('brushRange');
    const brushVal   = document.getElementById('brushVal');
    brushRange.oninput = () => {
      brushSize            = parseInt(brushRange.value);
      brushVal.textContent = brushSize;
    };

    // ─── MediaPipe skeleton colors (inverted = white/bright on dark) ─────────────
    const SKEL_COLOR  = 'rgba(255,255,255,0.55)';
    const JOINT_COLOR = 'rgba(255,255,255,0.85)';
    const JOINT_FILL  = 'rgba(0,0,0,0.4)';

    // Hand connections
    const CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4],     // thumb
      [0,5],[5,6],[6,7],[7,8],     // index
      [5,9],[9,10],[10,11],[11,12],// middle
      [9,13],[13,14],[14,15],[15,16],// ring
      [13,17],[17,18],[18,19],[19,20],// pinky
      [0,17]                        // palm base
    ];

    function drawSkeleton(lm, W, H) {
      // Draw bones
      overlayCtx.save();
      overlayCtx.strokeStyle = SKEL_COLOR;
      overlayCtx.lineWidth   = 1.8;
      overlayCtx.lineCap     = 'round';
      CONNECTIONS.forEach(([a, b]) => {
        const ax = (1 - lm[a].x) * W;
        const ay = lm[a].y * H;
        const bx = (1 - lm[b].x) * W;
        const by = lm[b].y * H;
        overlayCtx.beginPath();
        overlayCtx.moveTo(ax, ay);
        overlayCtx.lineTo(bx, by);
        overlayCtx.stroke();
      });

      // Draw joints
      lm.forEach((pt, i) => {
        const x = (1 - pt.x) * W;
        const y = pt.y * H;
        const r = i === 0 ? 5 : (i % 4 === 0 ? 4 : 2.5);
        overlayCtx.beginPath();
        overlayCtx.arc(x, y, r, 0, Math.PI * 2);
        overlayCtx.fillStyle   = JOINT_FILL;
        overlayCtx.fill();
        overlayCtx.strokeStyle = JOINT_COLOR;
        overlayCtx.lineWidth   = 1.5;
        overlayCtx.stroke();
      });
      overlayCtx.restore();
    }

    function initMediaPipe() {
      if (typeof Hands === 'undefined') {
        status.textContent = 'MediaPipe није учитан. Освежите страницу.';
        return;
      }

      const hands = new Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
      });

      hands.setOptions({
        maxNumHands:            1,
        modelComplexity:        1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence:  0.5
      });

      hands.onResults(onResults);

      const camera = new Camera(video, {
        onFrame: async () => { await hands.send({ image: video }); },
        width: 640, height: 480
      });

      camera.start();
      status.textContent = 'Праћење руке активно';
      setTimeout(() => { status.textContent = ''; }, 3000);
    }

    function onResults(results) {
      const W = drawCanvas.width, H = drawCanvas.height;
      overlayCtx.clearRect(0, 0, W, H);

      if (colorChangeCooldown > 0) colorChangeCooldown--;

      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        prevX = null; prevY = null;
        gestureFrames = 0; lastGesture = '';
        return;
      }

      const lm = results.multiHandLandmarks[0];

      // ── Draw skeleton (mirrored same as drawing) ──────────────────────
      overlayCtx.save();
      overlayCtx.scale(-1, 1);
      overlayCtx.translate(-W, 0);
      drawSkeleton(lm, W, H);
      overlayCtx.restore();

      // ── Finger state detection ────────────────────────────────────────
      const tips = [8, 12, 16, 20];
      const pips = [6, 10, 14, 18];
      const fingersUp = tips.map((tip, i) => lm[tip].y < lm[pips[i]].y);
      // Thumb: compare x instead of y
      const thumbUp = lm[4].x < lm[3].x; // mirrored space

      const upCount = fingersUp.filter(Boolean).length;

      const indexUp  = fingersUp[0];
      const middleUp = fingersUp[1];
      const ringUp   = fingersUp[2];
      const pinkyUp  = fingersUp[3];

      // Determine gesture
      let gesture = '';
      if (indexUp && !middleUp && !ringUp && !pinkyUp)  gesture = 'draw';      // 1 finger
      if (indexUp && middleUp  && !ringUp && !pinkyUp)  gesture = 'pause';     // 2 fingers
      if (indexUp && middleUp  && ringUp  && !pinkyUp)  gesture = 'color';     // 3 fingers

      // Debounce gesture: must hold for GESTURE_HOLD frames
      if (gesture === lastGesture) {
        gestureFrames++;
      } else {
        gestureFrames = 0;
        lastGesture   = gesture;
      }

      const confirmedGesture = gestureFrames >= GESTURE_HOLD ? gesture : '';

      // Cursor position (index fingertip, mirrored)
      const ix = (1 - lm[8].x) * W;
      const iy = lm[8].y * H;

      // ── Draw cursor ───────────────────────────────────────────────────
      overlayCtx.save();
      overlayCtx.scale(-1, 1);
      overlayCtx.translate(-W, 0);

      const cursorX = (1 - lm[8].x) * W; // back in original coords for drawing
      const cursorY = lm[8].y * H;
      const cursorR = isEraser ? 20 : Math.max(brushSize, 8);

      overlayCtx.beginPath();
      overlayCtx.arc(cursorX, cursorY, cursorR, 0, Math.PI * 2);
      if (confirmedGesture === 'pause') {
        overlayCtx.strokeStyle = 'rgba(255,255,255,0.4)';
        overlayCtx.setLineDash([4, 4]);
      } else if (confirmedGesture === 'color') {
        overlayCtx.strokeStyle = COLORS[(colorIndex + 1) % COLORS.length];
        overlayCtx.setLineDash([3, 3]);
      } else {
        overlayCtx.strokeStyle = isEraser ? '#888' : currentColor;
        overlayCtx.setLineDash([]);
      }
      overlayCtx.lineWidth = 2;
      overlayCtx.stroke();
      overlayCtx.setLineDash([]);
      overlayCtx.restore();

      // ── Handle gestures ───────────────────────────────────────────────

      // PAUSE (2 fingers): just stop drawing
      if (confirmedGesture === 'pause') {
        if (lastGesture !== 'pause' || gestureFrames === GESTURE_HOLD) {
          showGestureIndicator('✌ ПАУЗА', 800);
        }
        prevX = null; prevY = null;
        return;
      }

      // COLOR CYCLE (3 fingers): cycle to next color, with cooldown
      if (confirmedGesture === 'color') {
        if (gestureFrames === GESTURE_HOLD && colorChangeCooldown === 0) {
          colorIndex   = (colorIndex + 1) % COLORS.length;
          currentColor = COLORS[colorIndex];
          isEraser     = false;
          colorChangeCooldown = 30; // ~1 sec at 30fps
          syncColorButtons();
          showGestureIndicator('🤟 БОЈА → ' + currentColor, 1200);
          showColorCycle(1500);
        }
        prevX = null; prevY = null;
        return;
      }

      // DRAW (1 finger)
      if (confirmedGesture === 'draw') {
        if (prevX !== null) {
          drawCtx.save();
          if (isEraser) {
            drawCtx.globalCompositeOperation = 'destination-out';
            drawCtx.strokeStyle = 'rgba(0,0,0,1)';
            drawCtx.lineWidth   = brushSize * 3;
          } else {
            drawCtx.globalCompositeOperation = 'source-over';
            drawCtx.strokeStyle = currentColor;
            drawCtx.lineWidth   = brushSize;
          }
          drawCtx.lineCap  = 'round';
          drawCtx.lineJoin = 'round';
          drawCtx.beginPath();
          drawCtx.moveTo(prevX, prevY);
          drawCtx.lineTo(ix, iy);
          drawCtx.stroke();
          drawCtx.restore();
        }
        prevX = ix; prevY = iy;
      } else {
        prevX = null; prevY = null;
      }
    }
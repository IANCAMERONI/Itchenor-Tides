/**
 * Renders the sea window: an animated water surface whose level tracks
 * the live tide height, seen as if through a window on a bridge. Waves,
 * reflections and the floating level readout are all driven from one
 * continuous animation loop so their motion stays smooth and in sync.
 */
function createSeaWindow(canvas, readoutEl) {
  const ctx = canvas.getContext('2d');

  // Layered sine waves build an organic (non-repeating-looking) surface
  // without needing a noise library — each layer scales with the
  // window's own size so the water reads the same at any resolution.
  const WAVE_LAYERS = [
    { ampFrac: 0.016, wavelengthFrac: 0.24, speed: 0.24, phase: 0.0 },
    { ampFrac: 0.009, wavelengthFrac: 0.13, speed: -0.37, phase: 2.1 },
    { ampFrac: 0.004, wavelengthFrac: 0.065, speed: 0.58, phase: 4.4 },
  ];

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let cssWidth = 0, cssHeight = 0;
  let latestData = { heights: [], extremes: [] };
  let range = {
    min: CONFIG.seaWindow.fallbackMinHeight,
    max: CONFIG.seaWindow.fallbackMaxHeight,
  };
  let displayedLevel = 0.5; // eased, normalised 0..1
  let levelInitialised = false;
  let lastFrameAt = performance.now();

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  function update(data) {
    latestData = data;
    if (data.heights && data.heights.length) {
      let min = Infinity, max = -Infinity;
      data.heights.forEach(h => {
        if (h.height < min) min = h.height;
        if (h.height > max) max = h.height;
      });
      const pad = Math.max(0.2, (max - min) * 0.12);
      range = { min: min - pad, max: max + pad };
    }
  }

  function _normalize(h) {
    if (h == null) return displayedLevel;
    const t = (h - range.min) / (range.max - range.min);
    return Math.min(1, Math.max(0, t));
  }

  function _waterlineY(levelNorm) {
    const { waterlineMinPercent, waterlineMaxPercent } = CONFIG.seaWindow;
    const percent = waterlineMaxPercent - levelNorm * (waterlineMaxPercent - waterlineMinPercent);
    return percent * cssHeight;
  }

  function _surfaceY(x, baseY, t) {
    let y = baseY;
    for (const layer of WAVE_LAYERS) {
      const amp = layer.ampFrac * cssHeight;
      const wavelength = Math.max(20, layer.wavelengthFrac * cssWidth);
      y += amp * Math.sin((x / wavelength) * Math.PI * 2 + t * layer.speed + layer.phase);
    }
    return y;
  }

  function _buildSurfacePoints(baseY, t) {
    const step = Math.max(4, cssWidth / 220);
    const pts = [];
    for (let x = 0; x < cssWidth; x += step) {
      pts.push({ x, y: _surfaceY(x, baseY, t) });
    }
    pts.push({ x: cssWidth, y: _surfaceY(cssWidth, baseY, t) });
    return pts;
  }

  function _drawWaterBody(pts, baseY) {
    const grad = ctx.createLinearGradient(0, baseY - 12, 0, cssHeight);
    grad.addColorStop(0, 'rgba(170, 226, 232, 0.55)');
    grad.addColorStop(0.16, 'rgba(143, 217, 224, 0.5)');
    grad.addColorStop(0.45, 'rgba(79, 179, 192, 0.5)');
    grad.addColorStop(0.75, 'rgba(39, 111, 124, 0.55)');
    grad.addColorStop(1, 'rgba(6, 10, 12, 0.92)');

    ctx.beginPath();
    ctx.moveTo(0, cssHeight);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(cssWidth, cssHeight);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function _drawSurfaceHighlight(pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(226, 241, 242, 0.55)';
    ctx.shadowColor = 'rgba(143, 217, 224, 0.6)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /** A soft shimmering reflection beneath a fixed "horizon light". */
  function _drawReflection(baseY, t) {
    const lightX = cssWidth * 0.52;
    const bandWidth = cssWidth * 0.22;
    const maxDepth = Math.min(cssHeight - baseY, cssHeight * 0.4);
    if (maxDepth <= 0) return;

    const streaks = 34;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < streaks; i++) {
      const depthT = i / streaks;
      const y = baseY + 6 + depthT * maxDepth;
      // Deterministic pseudo-random shimmer — no RNG needed, just
      // irrational-ish frequencies so streaks don't visibly repeat.
      const wobble = Math.sin(i * 12.9898 + t * 0.8) * bandWidth * 0.5 * (1 - depthT * 0.6);
      const x = lightX + wobble;
      const width = (18 + Math.sin(i * 3.1 + t * 1.3) * 9) * (1 - depthT * 0.5);
      const flicker = 0.4 + 0.6 * Math.abs(Math.sin(i * 7.7 + t * 2.0));
      const alpha = flicker * (1 - depthT) * 0.30;

      const warmth = 1 - depthT;
      const r = 226 * warmth + 170 * (1 - warmth);
      const g = 224 - depthT * 20;
      const b = 200 * warmth + 232 * (1 - warmth);

      ctx.strokeStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 2.4 * (1 - depthT));
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y);
      ctx.lineTo(x + width / 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Faint horizon glow straddling the waterline, as if lit from beyond it. */
  function _drawHorizonGlow(baseY) {
    const glow = ctx.createRadialGradient(
      cssWidth * 0.52, baseY, 0,
      cssWidth * 0.52, baseY, cssWidth * 0.55
    );
    glow.addColorStop(0, 'rgba(226, 197, 132, 0.10)');
    glow.addColorStop(0.4, 'rgba(201, 164, 100, 0.04)');
    glow.addColorStop(1, 'rgba(201, 164, 100, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, Math.max(0, baseY - cssHeight * 0.25), cssWidth, cssHeight * 0.5);
  }

  function _drawEdgeVignette() {
    const grad = ctx.createLinearGradient(0, 0, cssWidth, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.30)');
    grad.addColorStop(0.12, 'rgba(0,0,0,0)');
    grad.addColorStop(0.88, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
  }

  function _positionReadout(baseY) {
    const gap = cssHeight * 0.06;
    const minTopMargin = cssHeight * 0.03;
    const maxBottomMargin = cssHeight * 0.02;
    // `top` positions the block's *bottom* edge (see the CSS translate),
    // so clamp against its actual rendered height — measured live rather
    // than assumed, so the readout can never clip against either edge of
    // the window regardless of how much content it ends up holding. If
    // the window is too short for both constraints at once, keep the top
    // (the hero number) uncut in preference to the trend row beneath it.
    const blockHeight = readoutEl.offsetHeight;
    let bottomEdge = baseY - gap;
    bottomEdge = Math.min(bottomEdge, cssHeight - maxBottomMargin);
    if (bottomEdge - blockHeight < minTopMargin) {
      bottomEdge = minTopMargin + blockHeight;
    }
    readoutEl.style.top = `${Math.max(0, bottomEdge)}px`;
  }

  // `_render` draws exactly one frame and never schedules anything
  // itself, so it's safe to call directly (e.g. on resume from a
  // hidden tab) without risking a second parallel animation loop.
  function _render(nowPerf) {
    if (cssWidth === 0) resize();

    const dt = Math.min(0.25, (nowPerf - lastFrameAt) / 1000);
    lastFrameAt = nowPerf;

    const nowMs = Date.now();
    const h = TideMath.heightAt(latestData.heights, nowMs);
    const target = _normalize(h);
    if (!levelInitialised) {
      displayedLevel = target;
      levelInitialised = true;
    } else {
      const alpha = 1 - Math.exp(-CONFIG.seaWindow.easingPerSecond * dt);
      displayedLevel += (target - displayedLevel) * alpha;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const baseY = _waterlineY(displayedLevel);
    const t = nowPerf / 1000;
    const pts = _buildSurfacePoints(baseY, t);

    _drawHorizonGlow(baseY);
    _drawWaterBody(pts, baseY);
    _drawReflection(baseY, t);
    _drawSurfaceHighlight(pts);
    _drawEdgeVignette();
    _positionReadout(baseY);
  }

  // The single, permanent animation loop — started exactly once below.
  function _loop(nowPerf) {
    _render(nowPerf);
    requestAnimationFrame(_loop);
  }

  window.addEventListener('resize', () => { resize(); _render(performance.now()); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { resize(); _render(performance.now()); }
  });

  resize();
  _render(performance.now()); // immediate first frame, independent of rAF
  requestAnimationFrame(_loop); // then hand off to the continuous loop

  return { update, resize };
}

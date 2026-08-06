/**
 * Renders the 24-hour tide curve: a single smooth line with a soft wash
 * beneath it, high/low markers labelled directly on the curve, a light
 * metres scale down the left edge, and a gently glowing "now" marker —
 * styled after Apple Weather's hourly graph rather than an engineering
 * chart. No gridlines; all drawing (including type) happens in one
 * canvas pass.
 */
function createTideCurve(canvas) {
  const ctx = canvas.getContext('2d');
  const palette = _readPalette();

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let cssWidth = 0, cssHeight = 0;
  let latestData = { heights: [], extremes: [], extendedExtremes: [] };
  let dayOffset = 0; // 0 = today (live, dense curve); >0 = future day (extremes-only approximation)
  const SAMPLE_INTERVAL_MS = 200;
  let lastSampleAt = 0;

  function _readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const get = name => cs.getPropertyValue(name).trim();
    return {
      brass100: get('--c-brass-100'),
      brass300: get('--c-brass-300'),
      water300: get('--c-water-300'),
      water500: get('--c-water-500'),
      text300: get('--c-text-300'),
      text500: get('--c-text-500'),
      text700: get('--c-text-700'),
    };
  }

  function _hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

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
  }

  /** Called by the day slider. 0 = back to today's live curve. */
  function setDayOffset(days) {
    dayOffset = Math.max(0, Math.min(CONFIG.tideCurve.maxDayOffset, days));
  }

  function getDayOffset() {
    return dayOffset;
  }

  function _timeWindow(nowMs) {
    if (dayOffset === 0) {
      const { hoursBefore, hoursAfter } = CONFIG.tideCurve;
      return {
        startMs: nowMs - hoursBefore * 3600000,
        endMs: nowMs + hoursAfter * 3600000,
      };
    }
    // A future day isn't "now-relative" - show the whole calendar day.
    const startMs = TideMath.startOfDayOffset(dayOffset);
    return { startMs, endMs: startMs + 24 * 3600000 };
  }

  function _xForTime(ms, startMs, endMs) {
    return ((ms - startMs) / (endMs - startMs)) * cssWidth;
  }

  function _buildSamples(startMs, endMs, count) {
    const useExtended = dayOffset > 0;
    const heights = latestData.heights;
    const extremes = latestData.extendedExtremes;
    if (useExtended ? !extremes || !extremes.length : !heights.length) return [];

    const pts = [];
    for (let i = 0; i <= count; i++) {
      const t = startMs + (i / count) * (endMs - startMs);
      const h = useExtended ? TideMath.heightAtFromExtremes(extremes, t) : TideMath.heightAt(heights, t);
      if (h == null) continue;
      pts.push({ t, h });
    }
    return pts;
  }

  function _yScale(samples) {
    if (!samples.length) return { min: 0, max: 1 };
    let min = Infinity, max = -Infinity;
    samples.forEach(s => { if (s.h < min) min = s.h; if (s.h > max) max = s.h; });
    const pad = Math.max(0.25, (max - min) * 0.3);
    return { min: min - pad, max: max + pad };
  }

  function _band() {
    // Vertical band the curve itself occupies, leaving room above for
    // high-tide labels and below for low-tide + time-axis labels.
    return { top: cssHeight * 0.20, bottom: cssHeight * 0.60 };
  }

  function _yForHeight(h, scale, band) {
    const t = (h - scale.min) / (scale.max - scale.min);
    return band.bottom - t * (band.bottom - band.top);
  }

  /** "Nice" round-metre tick values spanning the visible height range. */
  function _yAxisTicks(scale) {
    const range = scale.max - scale.min;
    let step = 1;
    if (range <= 2) step = 0.5;
    else if (range > 6) step = 2;
    const ticks = [];
    const first = Math.ceil(scale.min / step) * step;
    for (let v = first; v <= scale.max; v += step) ticks.push(Math.round(v * 10) / 10);
    return ticks;
  }

  function _drawYAxis(scale, band) {
    const fontSize = Math.max(9, cssHeight * 0.032);
    ctx.font = `300 ${fontSize}px 'Jost', sans-serif`;
    ctx.fillStyle = _hexToRgba(palette.text700, 0.85);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    _yAxisTicks(scale).forEach(v => {
      const y = _yForHeight(v, scale, band);
      ctx.fillText(`${v}m`, cssWidth * 0.012, y);
    });
    ctx.textBaseline = 'alphabetic';
  }

  function _drawWash(pts, band) {
    const grad = ctx.createLinearGradient(0, band.top, 0, band.bottom + cssHeight * 0.08);
    grad.addColorStop(0, _hexToRgba(palette.water300, 0.28));
    grad.addColorStop(0.7, _hexToRgba(palette.water500, 0.08));
    grad.addColorStop(1, _hexToRgba(palette.water500, 0));

    ctx.beginPath();
    ctx.moveTo(pts[0].x, band.bottom + cssHeight * 0.08);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, band.bottom + cssHeight * 0.08);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function _drawLine(pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.lineWidth = Math.max(1.5, cssHeight * 0.006);
    ctx.strokeStyle = _hexToRgba(palette.brass100, 0.9);
    ctx.shadowColor = _hexToRgba(palette.brass300, 0.5);
    ctx.shadowBlur = cssHeight * 0.03;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function _drawExtremeMarkers(startMs, endMs, scale, band) {
    const fontSize = Math.max(11, cssHeight * 0.05);
    const extremes = dayOffset > 0 ? latestData.extendedExtremes : latestData.extremes;

    extremes
      .filter(e => e.dt * 1000 >= startMs && e.dt * 1000 <= endMs)
      .forEach(e => {
        const x = _xForTime(e.dt * 1000, startMs, endMs);
        const y = _yForHeight(e.height, scale, band);
        const isHigh = e.type === 'High';

        ctx.beginPath();
        ctx.arc(x, y, Math.max(2.5, cssHeight * 0.008), 0, Math.PI * 2);
        ctx.fillStyle = isHigh ? _hexToRgba(palette.brass100, 0.95) : _hexToRgba(palette.water300, 0.95);
        ctx.fill();

        const time = TideMath.formatEventTime(new Date(e.dt * 1000));
        const heightLabel = `${e.height.toFixed(2)}m`;
        const labelY = isHigh ? y - fontSize * 1.9 : y + fontSize * 1.9;
        const lineGap = fontSize * 1.15;

        ctx.textAlign = 'center';
        ctx.font = `500 ${fontSize}px 'Jost', sans-serif`;
        ctx.fillStyle = _hexToRgba(palette.text300, 0.85);
        ctx.fillText(time, x, labelY);

        ctx.font = `300 ${fontSize * 0.86}px 'Jost', sans-serif`;
        ctx.fillStyle = _hexToRgba(palette.text500, 0.75);
        ctx.fillText(heightLabel, x, labelY + lineGap);
      });
  }

  function _drawNowMarker(nowMs, startMs, endMs, scale, band, tSec) {
    const h = TideMath.heightAt(latestData.heights, nowMs);
    if (h == null) return;
    const x = _xForTime(nowMs, startMs, endMs);
    const y = _yForHeight(h, scale, band);

    const period = CONFIG.tideCurve.glowPeriodSeconds;
    const pulse = 0.5 + 0.5 * Math.sin((tSec / period) * Math.PI * 2);
    const coreR = cssHeight * 0.011;
    const glowR = coreR * (2.6 + pulse * 1.4);

    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = _hexToRgba(palette.water300, 0.10 + pulse * 0.10);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, Math.PI * 2);
    ctx.fillStyle = '#f4fbfc';
    ctx.shadowColor = _hexToRgba(palette.water300, 0.9);
    ctx.shadowBlur = cssHeight * 0.035;
    ctx.fill();
    ctx.shadowBlur = 0;

    const fontSize = Math.max(11, cssHeight * 0.05);
    ctx.textAlign = 'center';
    ctx.font = `500 ${fontSize * 0.82}px 'Jost', sans-serif`;
    ctx.fillStyle = _hexToRgba(palette.water300, 0.85);
    ctx.fillText('NOW', x, y - coreR - fontSize * 1.3);
  }

  function _drawTimeAxis(startMs, endMs) {
    const fontSize = Math.max(10, cssHeight * 0.038);
    const y = cssHeight * 0.92;
    const stepHours = 6;
    const first = Math.ceil(startMs / (stepHours * 3600000)) * (stepHours * 3600000);

    ctx.font = `300 ${fontSize}px 'Jost', sans-serif`;
    ctx.fillStyle = _hexToRgba(palette.text700, 0.9);
    ctx.textAlign = 'center';
    for (let t = first; t <= endMs; t += stepHours * 3600000) {
      const x = _xForTime(t, startMs, endMs);
      if (x < 4 || x > cssWidth - 4) continue;
      const label = new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      ctx.fillText(label, x, y);
    }
  }

  function _render(nowPerf) {
    if (cssWidth === 0) resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const nowMs = Date.now();
    const { startMs, endMs } = _timeWindow(nowMs);
    const samples = _buildSamples(startMs, endMs, 300);
    if (samples.length < 2) return;

    const scale = _yScale(samples);
    const band = _band();
    const pts = samples.map(s => ({
      x: _xForTime(s.t, startMs, endMs),
      y: _yForHeight(s.h, scale, band),
    }));

    _drawWash(pts, band);
    _drawLine(pts);
    _drawYAxis(scale, band);
    _drawExtremeMarkers(startMs, endMs, scale, band);
    if (dayOffset === 0) {
      _drawNowMarker(nowMs, startMs, endMs, scale, band, nowPerf / 1000);
    }
    _drawTimeAxis(startMs, endMs);
  }

  function _loop(nowPerf) {
    if (nowPerf - lastSampleAt >= SAMPLE_INTERVAL_MS) {
      lastSampleAt = nowPerf;
      _render(nowPerf);
    }
    requestAnimationFrame(_loop);
  }

  window.addEventListener('resize', () => { resize(); _render(performance.now()); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { resize(); _render(performance.now()); }
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => _render(performance.now()));
  }

  resize();
  _render(performance.now());
  requestAnimationFrame(_loop);

  return { update, resize, setDayOffset, getDayOffset };
}

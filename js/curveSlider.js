/**
 * Wires the "days ahead" slider to the tide curve. Kept separate from
 * ui.js since it owns its own small piece of state (last interaction
 * time, for the idle auto-reset) rather than just reflecting data.
 */
function createCurveSlider({ curve, sliderEl, labelEl }) {
  let lastInteractionAt = Date.now();

  function _apply(days) {
    curve.setDayOffset(days);
    labelEl.textContent = TideMath.formatDayOffsetLabel(days);
    const pct = (days / Number(sliderEl.max)) * 100;
    sliderEl.style.setProperty('--curve-slider-fill', `${pct}%`);
  }

  sliderEl.addEventListener('input', () => {
    lastInteractionAt = Date.now();
    _apply(Number(sliderEl.value));
  });

  function enable() {
    sliderEl.disabled = false;
  }

  /** Call once a second or so; snaps back to "today" after a period of no interaction. */
  function tick() {
    const idleMs = CONFIG.tideCurve.idleResetSeconds * 1000;
    if (curve.getDayOffset() !== 0 && Date.now() - lastInteractionAt > idleMs) {
      sliderEl.value = '0';
      _apply(0);
    }
  }

  _apply(Number(sliderEl.value));

  return { enable, tick };
}

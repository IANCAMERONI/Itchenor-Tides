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

  // Manual pointer-driven dragging, alongside the native 'input' handling
  // above rather than replacing it. iOS Safari has a long history of
  // unreliable touch-drag on a heavily-restyled (-webkit-appearance: none)
  // range input: a plain tap lands fine since that's an unambiguous native
  // gesture, but an actual drag can just never fire any native input
  // events at all, on some iOS versions, even with touch-action set
  // correctly. Computing the value straight from pointer position and
  // setting it ourselves sidesteps the platform's own drag handling
  // entirely, so it can't be broken by whatever that's doing (or not
  // doing) internally - this is what actually makes the slider draggable
  // on iOS, not just tappable.
  function _setFromClientX(clientX) {
    if (sliderEl.disabled) return;
    const rect = sliderEl.getBoundingClientRect();
    if (!rect.width) return;
    const min = Number(sliderEl.min);
    const max = Number(sliderEl.max);
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const value = String(Math.round(min + fraction * (max - min)));
    if (value !== sliderEl.value) {
      sliderEl.value = value;
      sliderEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  let dragging = false;
  sliderEl.addEventListener('pointerdown', (event) => {
    if (sliderEl.disabled) return;
    dragging = true;
    sliderEl.setPointerCapture(event.pointerId);
    _setFromClientX(event.clientX);
  });
  sliderEl.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    _setFromClientX(event.clientX);
  });
  ['pointerup', 'pointercancel'].forEach(evt =>
    sliderEl.addEventListener(evt, () => { dragging = false; })
  );

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

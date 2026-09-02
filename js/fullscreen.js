/**
 * Fullscreen control, idle cursor hiding, and a screen wake lock so the
 * display behaves like a dedicated instrument rather than a normal
 * webpage that a screensaver or display sleep would interrupt.
 */
function initFullscreen({ toggleButton, hintText, appEl }) {
  let wakeLock = null;
  let idleTimer = null;
  // Long enough that someone actually using the display - reading it for
  // the first time, then going looking for the Settings button - has a
  // comfortable window to find and reach it, especially on a phone where
  // there's more delay between deciding to tap something and tapping it.
  // Short enough that the display still settles into its clean, chrome-free
  // look during genuinely passive viewing.
  const IDLE_MS = 20000;

  async function _requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (err) {
      /* Wake lock is best-effort; ignore if unsupported or denied. */
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !wakeLock) {
      _requestWakeLock();
    }
  });

  function _isFullscreen() {
    return Boolean(document.fullscreenElement);
  }

  function _updateButton() {
    const fs = _isFullscreen();
    document.body.classList.toggle('is-fullscreen', fs);
    hintText.textContent = fs ? 'Exit Fullscreen' : 'Enter Fullscreen';
  }

  async function toggle() {
    try {
      if (!_isFullscreen()) {
        await appEl.requestFullscreen();
        await _requestWakeLock();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      /* User gesture requirements or platform restrictions — ignore. */
    }
  }

  function _resetIdle() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), IDLE_MS);
  }

  toggleButton.addEventListener('click', toggle);
  document.addEventListener('fullscreenchange', _updateButton);
  document.addEventListener('dblclick', toggle);

  ['mousemove', 'keydown', 'touchstart'].forEach(evt =>
    document.addEventListener(evt, _resetIdle, { passive: true })
  );

  _resetIdle();
  _updateButton();
  _requestWakeLock();

  return { toggle };
}

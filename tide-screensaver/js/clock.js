/**
 * Drives the on-screen clock and fires a callback once per minute
 * boundary, self-correcting against drift rather than relying on a raw
 * setInterval(60000).
 */
function createClock({ onTick, onMinute }) {
  let lastMinute = null;

  function _fire() {
    const now = new Date();
    onTick && onTick(now);

    const minuteKey = `${now.getHours()}:${now.getMinutes()}`;
    if (minuteKey !== lastMinute) {
      lastMinute = minuteKey;
      onMinute && onMinute(now);
    }

    const msToNextSecond = 1000 - now.getMilliseconds();
    setTimeout(_fire, msToNextSecond);
  }

  function start() {
    _fire();
  }

  return { start };
}

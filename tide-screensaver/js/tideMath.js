/**
 * Pure calculations over tide data. No DOM, no network — easy to unit test
 * or reuse (e.g. swap in a different data source) without touching this file.
 */
const TideMath = (() => {

  /** Binary-search the two height samples that straddle `atMs`. */
  function _bracket(heights, atMs) {
    if (!heights.length) return null;
    if (atMs <= heights[0].dt * 1000) return [heights[0], heights[0]];
    if (atMs >= heights[heights.length - 1].dt * 1000) {
      const last = heights[heights.length - 1];
      return [last, last];
    }
    let lo = 0, hi = heights.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (heights[mid].dt * 1000 <= atMs) lo = mid; else hi = mid;
    }
    return [heights[lo], heights[hi]];
  }

  /** Smooth (cosine) interpolation between two bracketing samples. */
  function heightAt(heights, atMs) {
    const bracket = _bracket(heights, atMs);
    if (!bracket) return null;
    const [a, b] = bracket;
    if (a === b) return a.height;
    const aMs = a.dt * 1000, bMs = b.dt * 1000;
    const t = (atMs - aMs) / (bMs - aMs);
    const smooth = (1 - Math.cos(t * Math.PI)) / 2;
    return a.height + (b.height - a.height) * smooth;
  }

  /** Rate of change in metres/hour, via a small central difference. */
  function trendAt(heights, atMs) {
    const dtMs = 5 * 60 * 1000;
    const h1 = heightAt(heights, atMs - dtMs);
    const h2 = heightAt(heights, atMs + dtMs);
    if (h1 == null || h2 == null) return { direction: 'slack', ratePerHour: 0 };
    const ratePerHour = ((h2 - h1) / (2 * dtMs)) * 3600000;
    let direction = 'slack';
    if (ratePerHour > 0.04) direction = 'rising';
    else if (ratePerHour < -0.04) direction = 'falling';
    return { direction, ratePerHour };
  }

  /** Next N extremes (high/low events) strictly after `atMs`. */
  function nextEvents(extremes, atMs, count = 2) {
    return extremes
      .filter(e => e.dt * 1000 > atMs)
      .sort((a, b) => a.dt - b.dt)
      .slice(0, count);
  }

  /**
   * The next High (or Low) water strictly after `atMs`, regardless of
   * how many events of the other type fall in between — so "next high"
   * and "next low" are always correct even when, say, two lows in a
   * row are the nearest events chronologically.
   */
  function nextEventOfType(extremes, atMs, type) {
    return extremes
      .filter(e => e.dt * 1000 > atMs && e.type === type)
      .sort((a, b) => a.dt - b.dt)[0] || null;
  }

  /** The extreme immediately preceding `atMs`, if any (for curve context). */
  function previousEvent(extremes, atMs) {
    const past = extremes
      .filter(e => e.dt * 1000 <= atMs)
      .sort((a, b) => b.dt - a.dt);
    return past[0] || null;
  }

  function formatCountdown(targetMs, fromMs) {
    let diff = Math.max(0, targetMs - fromMs);
    const totalMinutes = Math.round(diff / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h <= 0) return `in ${m}m`;
    return `in ${h}h ${String(m).padStart(2, '0')}m`;
  }

  function formatClockTime(date) {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  function formatEventTime(date) {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  /**
   * Simple synodic moon-phase approximation — accurate to well within a
   * day, which is all a decorative bridge instrument needs.
   */
  function moonPhase(date) {
    const synodicMonth = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 18:14 UTC
    const daysSince = (date.getTime() - knownNewMoon) / 86400000;
    let phase = (daysSince % synodicMonth) / synodicMonth;
    if (phase < 0) phase += 1;

    const phases = [
      { max: 0.03, name: 'New Moon', symbol: '●' },
      { max: 0.22, name: 'Waxing Crescent', symbol: '🌒' },
      { max: 0.28, name: 'First Quarter', symbol: '🌓' },
      { max: 0.47, name: 'Waxing Gibbous', symbol: '🌔' },
      { max: 0.53, name: 'Full Moon', symbol: '○' },
      { max: 0.72, name: 'Waning Gibbous', symbol: '🌖' },
      { max: 0.78, name: 'Last Quarter', symbol: '🌗' },
      { max: 0.97, name: 'Waning Crescent', symbol: '🌘' },
      { max: 1.01, name: 'New Moon', symbol: '●' },
    ];
    const match = phases.find(p => phase <= p.max);
    return match ? match.name : 'New Moon';
  }

  return {
    heightAt,
    trendAt,
    nextEvents,
    nextEventOfType,
    previousEvent,
    formatCountdown,
    formatClockTime,
    formatEventTime,
    moonPhase,
  };
})();

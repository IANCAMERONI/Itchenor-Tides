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

  /** Binary-search the two extremes that straddle `atMs`. */
  function _bracketExtremes(extremes, atMs) {
    if (!extremes.length) return null;
    const sorted = extremes; // callers already pass sorted-by-dt arrays
    if (atMs <= sorted[0].dt * 1000) return [sorted[0], sorted[0]];
    if (atMs >= sorted[sorted.length - 1].dt * 1000) {
      const last = sorted[sorted.length - 1];
      return [last, last];
    }
    let lo = 0, hi = sorted.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].dt * 1000 <= atMs) lo = mid; else hi = mid;
    }
    return [sorted[lo], sorted[hi]];
  }

  /**
   * Approximates the tide curve from highs/lows alone, via cosine
   * interpolation between consecutive extremes — the same "rule of
   * twelfths"-style approximation mariners use by hand. Real tide
   * curves track this closely between a high and the next low, so it's
   * a good stand-in for days too far out to justify fetching dense,
   * per-15-minute height data (which costs far more in API credits).
   * The high/low times and heights themselves are always the real,
   * fetched values — only the shape of the curve between them is
   * approximated.
   */
  function heightAtFromExtremes(extremes, atMs) {
    const bracket = _bracketExtremes(extremes, atMs);
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

  /** All extremes of one type (High/Low) within the 24h starting at `dayStartMs`. */
  function eventsForDay(extremes, dayStartMs, type) {
    const dayEndMs = dayStartMs + 24 * 3600000;
    return extremes
      .filter(e => e.dt * 1000 >= dayStartMs && e.dt * 1000 < dayEndMs && e.type === type)
      .sort((a, b) => a.dt - b.dt);
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

  /** "Today" / "Tomorrow" / "Friday 14 August · in 12 days" for the slider label. */
  function formatDayOffsetLabel(offsetDays) {
    if (offsetDays === 0) return 'Today';
    if (offsetDays === 1) return 'Tomorrow';
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    const dateStr = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${dateStr} · in ${offsetDays} days`;
  }

  /** Start of the local day `offsetDays` from now, as a timestamp (ms). */
  function startOfDayOffset(offsetDays) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.getTime();
  }

  const SYNODIC_MONTH_DAYS = 29.530588853;
  const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 18:14 UTC

  /** Fraction through the current lunar cycle: 0 = new, 0.5 = full, 1 = new again. */
  function _moonPhaseFraction(date) {
    const daysSince = (date.getTime() - KNOWN_NEW_MOON_MS) / 86400000;
    let phase = (daysSince % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
    if (phase < 0) phase += 1;
    return phase;
  }

  /** How many days until the next full moon (0 if it's tonight). */
  function daysUntilFullMoon(date) {
    const phase = _moonPhaseFraction(date);
    let days = (0.5 - phase) * SYNODIC_MONTH_DAYS;
    if (days < 0) days += SYNODIC_MONTH_DAYS;
    return days;
  }

  function formatDaysUntilFullMoon(days) {
    const rounded = Math.round(days);
    if (rounded <= 0) return 'Tonight';
    if (rounded === 1) return 'Tomorrow';
    return `in ${rounded} days`;
  }

  /**
   * Simple synodic moon-phase approximation — accurate to well within a
   * day, which is all a decorative bridge instrument needs.
   */
  function moonPhase(date) {
    const phase = _moonPhaseFraction(date);

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
    heightAtFromExtremes,
    trendAt,
    eventsForDay,
    formatClockTime,
    formatEventTime,
    formatDayOffsetLabel,
    startOfDayOffset,
    moonPhase,
    daysUntilFullMoon,
    formatDaysUntilFullMoon,
  };
})();

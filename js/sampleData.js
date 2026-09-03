/**
 * Generates a synthetic tide dataset for the setup screen's "Preview with
 * sample data" option - lets a first-time visitor see the live display
 * working, with no API key and no network call at all.
 *
 * Shaped exactly like what TideService produces from a real API response
 * (`{heights: [{dt, height}], extremes: [{dt, height, type}]}` for the
 * near-term curve, extremes-only for the extended/slider range) so
 * nothing downstream - seaWindow, tideCurve, curveSlider - needs to know
 * or care that this isn't real data. It's a single clean cosine wave
 * approximating a semi-diurnal tide (the ~12h25m cycle most coastlines,
 * including Itchenor, actually follow), generated fresh from the current
 * time on every call so "now" always lands somewhere sensible on the
 * curve, however long after this file was written someone opens it.
 */
const SampleTideData = (() => {
  const PERIOD_SECONDS = 12.42 * 3600; // M2 tidal constituent - real semi-diurnal period
  const MEAN_HEIGHT = 2.85;
  const AMPLITUDE = 1.65; // -> ~1.2m low, ~4.5m high, matching Itchenor's real range
  const STEP_SECONDS = 900; // matches the real near-term fetch's 15-minute resolution

  function _heightAt(t, peakT) {
    return MEAN_HEIGHT + AMPLITUDE * Math.cos((2 * Math.PI * (t - peakT)) / PERIOD_SECONDS);
  }

  /** Every high/low crossing within [fromT, toT], as real WorldTides extremes are shaped. */
  function _extremesBetween(fromT, toT, peakT) {
    const extremes = [];
    // Walk from the first peak/trough at or before fromT forward past toT.
    let k = Math.floor((fromT - peakT) / (PERIOD_SECONDS / 2)) - 1;
    for (; ; k++) {
      const t = peakT + k * (PERIOD_SECONDS / 2);
      if (t > toT) break;
      if (t >= fromT) {
        const isHigh = k % 2 === 0;
        extremes.push({ dt: Math.round(t), height: Number(_heightAt(t, peakT).toFixed(2)), type: isHigh ? 'High' : 'Low' });
      }
    }
    return extremes;
  }

  /** Fresh sample data, always anchored to the moment this is called. */
  function generate() {
    const now = Math.floor(Date.now() / 1000);
    // A high tide 3 hours ago - puts "now" a little past the peak, gently
    // falling, which is a nice representative moment to land a first-time
    // visitor on (matches the state shown in the README's screenshot).
    const peakT = now - 3 * 3600;

    const nearFrom = now - 26 * 3600;
    const nearTo = now + CONFIG.worldTides.days * 86400;
    const heights = [];
    for (let t = nearFrom; t <= nearTo; t += STEP_SECONDS) {
      heights.push({ dt: t, height: Number(_heightAt(t, peakT).toFixed(2)) });
    }
    const extremes = _extremesBetween(nearFrom, nearTo, peakT);

    const extendedTo = now + CONFIG.worldTides.extendedDays * 86400;
    const extendedExtremes = _extremesBetween(now - 12 * 3600, extendedTo, peakT);

    return {
      near: { heights, extremes, fetchedAt: Date.now() },
      extended: { extremes: extendedExtremes, fetchedAt: Date.now() },
    };
  }

  return { generate };
})();

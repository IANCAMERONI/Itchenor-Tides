/**
 * Central configuration for the Itchenor Tide Bridge Display.
 * Edit the values below — nothing else in the app needs to change.
 */
const CONFIG = {
  // ---- Location -----------------------------------------------------
  location: {
    name: 'Itchenor',
    region: 'Chichester Harbour, West Sussex, UK',
    // Itchenor Sailing Club / Chichester Harbour entrance reach.
    lat: 50.7986,
    lon: -0.8687,
    positionLabel: "50°47.9′ N   000°52.1′ W",
  },

  // ---- Tide data source (WorldTides API) -----------------------------
  // Sign up for a free account at https://www.worldtides.info/register
  // and paste your key below. New accounts receive free trial credits;
  // this app is deliberately frugal with requests (see refreshIntervalMs)
  // so ongoing cost is a handful of credits per day.
  worldTides: {
    apiKey: '28fe2b52-713c-40fd-96f5-2f8b498befb7',
    endpoint: 'https://www.worldtides.info/api/v3',
    // Tide heights relative to Chart Datum, matching Admiralty charts
    // and what a mariner would expect on a bridge display.
    datum: 'CD',
    // How many calendar days of data to request each fetch. Needs to be
    // large enough that we always have future events to show even if a
    // refresh is delayed.
    days: 4,
    // Resolution of the continuous height curve, in seconds.
    stepSeconds: 900,
  },

  // ---- Refresh behaviour ----------------------------------------------
  refresh: {
    // How often to hit the live API for new predictions.
    dataIntervalMs: 3 * 60 * 60 * 1000, // 3 hours
    // How often the on-screen display re-renders from cached data
    // (clock, curve position, countdowns).
    tickIntervalMs: 60 * 1000, // 1 minute
    // If a live fetch fails, how stale cached data may be before the
    // display flags it as out of date rather than silently trusting it.
    staleAfterMs: 12 * 60 * 60 * 1000, // 12 hours
    // Retry cadence while in an error state.
    retryIntervalMs: 5 * 60 * 1000, // 5 minutes
  },

  // ---- Sea window (the animated water level display) --------------------
  seaWindow: {
    // Where the waterline sits within the window at the lowest and
    // highest tide (as a fraction of the window's height, 0 = top).
    // The gap between these two keeps the water roughly centred on the
    // lower half of the window as the tide moves, per the brief.
    waterlineMinPercent: 0.40, // waterline position at the highest tide
    waterlineMaxPercent: 0.72, // waterline position at the lowest tide
    // Height range (metres, Chart Datum) used to normalise the current
    // reading before the data has loaded. Once live data arrives the
    // actual min/max of the fetched predictions is used instead, so
    // this only matters for the very first frame or if the API is
    // unreachable and no cache exists yet.
    fallbackMinHeight: 0.3,
    fallbackMaxHeight: 4.6,
    // How quickly the displayed waterline eases toward the true tide
    // level, in "fraction closed per second" — low values feel slow
    // and elegant, matching how gradually a real tide actually moves.
    easingPerSecond: 0.45,
  },

  // ---- 24-hour tide curve -------------------------------------------------
  tideCurve: {
    // A little history plus the rest of the day ahead, totalling 24h —
    // "now" sits near the left edge, Apple Weather-hourly-graph style,
    // rather than centred.
    hoursBefore: 1,
    hoursAfter: 23,
    // How often (seconds) the glow on the "now" marker breathes in and out.
    glowPeriodSeconds: 2.6,
  },

  // ---- Local persistence -------------------------------------------------
  storage: {
    cacheKey: 'itchenor-tide-cache-v1',
  },
};

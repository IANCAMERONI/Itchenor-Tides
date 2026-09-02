/**
 * Central configuration for the Tide Bridge Display.
 *
 * Location and the WorldTides API key are no longer set here - a fresh
 * visitor is asked for both in an in-app setup screen (see
 * userSettings.js / setupUI.js) and they are saved in that browser's
 * localStorage, so anyone can fork or deploy this project for their
 * own harbour without editing any code. The values below are only the
 * fallback used before that first save completes.
 */
const CONFIG = {
  // ---- Location (overridden by the visitor's saved setup) -------------
  location: {
    name: 'Itchenor',
    region: 'Chichester Harbour, West Sussex, UK',
    // Itchenor Sailing Club / Chichester Harbour entrance reach.
    lat: 50.7986,
    lon: -0.8687,
    positionLabel: "50°47.9′ N   000°52.1′ W",
  },

  // ---- Tide data source (WorldTides API) -----------------------------
  // The API key itself comes from the visitor's own setup, not here -
  // this placeholder is only used if that step is somehow bypassed. Get
  // a free key at https://www.worldtides.info/register - new accounts
  // include free trial credits, and this app is deliberately frugal
  // with requests (see refresh.dataIntervalMs) so a small balance goes
  // a long way.
  worldTides: {
    apiKey: 'YOUR_WORLDTIDES_API_KEY',
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
    // How many days ahead the "future" slider can reach, plus a day of
    // buffer. Fetched as extremes only (highs/lows), not dense heights -
    // roughly 1 credit per week of range, versus ~2 credits per week for
    // dense heights - so this stays cheap even refreshed daily. Keep in
    // sync with tideCurve.maxDayOffset below (should be at least one more).
    extendedDays: 8,
  },

  // ---- Refresh behaviour ----------------------------------------------
  refresh: {
    // How often to hit the live API for new (near-term, dense) predictions.
    dataIntervalMs: 3 * 60 * 60 * 1000, // 3 hours
    // How often to refresh the extended (7-day, extremes-only) range.
    // Tide predictions this far out barely change day to day, so this
    // can be far less frequent than the near-term refresh.
    extendedDataIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
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
    // How far ahead the day slider can be dragged. Kept modest (rather
    // than a full month) partly because a wide 0-30 range is fiddly to
    // land precisely on a touchscreen.
    maxDayOffset: 7,
    // Scrubbed away from "today" and then left alone, the slider snaps
    // back to live "today" after this many seconds - keeps the display
    // from getting stuck showing next month's tides indefinitely.
    idleResetSeconds: 45,
  },

  // ---- Local persistence -------------------------------------------------
  storage: {
    cacheKey: 'itchenor-tide-cache-v1',
    extendedCacheKey: 'itchenor-tide-extended-cache-v1',
  },
};

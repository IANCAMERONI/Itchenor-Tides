/**
 * Fetches tide predictions from the WorldTides API, caches them in
 * localStorage, and exposes the latest known-good dataset even if a
 * refresh fails — the display should keep running quietly rather than
 * going blank because of one dropped request.
 *
 * Two independent pipelines run here:
 *  - the near-term one (dense, 15-minute heights + extremes, a few days
 *    out) that drives the live "now" curve and sea window, refreshed
 *    every few hours;
 *  - the extended one (extremes only - highs/lows, no dense heights - a
 *    month out) that drives the future-day slider, refreshed once a
 *    day since predictions that far out barely change. Extremes-only
 *    is roughly half the API cost of dense heights per day of range,
 *    which is what makes a 30-day lookahead affordable at all.
 */
const TideService = (() => {
  let state = {
    heights: [],
    extremes: [],
    fetchedAt: null,
    status: 'loading', // 'loading' | 'live' | 'stale' | 'error'
    errorMessage: null,
  };

  let extendedState = {
    extremes: [],
    fetchedAt: null,
    status: 'loading',
    errorMessage: null,
  };

  const listeners = new Set();

  function _notify() {
    const snapshot = getSnapshot();
    listeners.forEach(fn => fn(snapshot));
  }

  function subscribe(fn) {
    listeners.add(fn);
    fn(getSnapshot());
    return () => listeners.delete(fn);
  }

  function _loadCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.extremes)) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function _saveCache(key, payload) {
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      /* Storage may be unavailable (private mode, quota) — non-fatal. */
    }
  }

  function _buildUrl({ includeHeights, days }) {
    const { endpoint, apiKey, datum, stepSeconds } = CONFIG.worldTides;
    const { lat, lon } = CONFIG.location;
    const params = new URLSearchParams({
      extremes: '',
      date: 'today',
      days: String(days),
      datum,
      lat: String(lat),
      lon: String(lon),
      key: apiKey,
    });
    if (includeHeights) {
      params.set('heights', '');
      params.set('step', String(stepSeconds));
    }
    return `${endpoint}?${params.toString()}`;
  }

  function _isConfigured() {
    const key = CONFIG.worldTides.apiKey;
    return Boolean(key) && key !== 'YOUR_WORLDTIDES_API_KEY';
  }

  function _parseExtremes(body) {
    return body.extremes.map(e => ({
      dt: e.dt,
      height: e.height,
      type: /high/i.test(e.type) ? 'High' : 'Low',
    }));
  }

  async function _fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.status !== 200) {
      const msg = (body && (body.error || body.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    if (!Array.isArray(body.extremes)) {
      throw new Error('Unexpected API response shape');
    }
    return body;
  }

  async function _fetchNearTerm() {
    const body = await _fetchJson(_buildUrl({ includeHeights: true, days: CONFIG.worldTides.days }));
    if (!Array.isArray(body.heights)) {
      throw new Error('Unexpected API response shape');
    }
    return {
      heights: body.heights.map(h => ({ dt: h.dt, height: h.height })),
      extremes: _parseExtremes(body),
      fetchedAt: Date.now(),
    };
  }

  async function _fetchExtended() {
    const body = await _fetchJson(_buildUrl({ includeHeights: false, days: CONFIG.worldTides.extendedDays }));
    return {
      extremes: _parseExtremes(body),
      fetchedAt: Date.now(),
    };
  }

  function _applyNearTermLive(payload) {
    state = {
      heights: payload.heights,
      extremes: payload.extremes,
      fetchedAt: payload.fetchedAt,
      status: 'live',
      errorMessage: null,
    };
    _saveCache(CONFIG.storage.cacheKey, payload);
    _notify();
  }

  function _applyNearTermError(message) {
    const cached = _loadCache(CONFIG.storage.cacheKey);
    if (cached && cached.heights.length) {
      const age = Date.now() - cached.fetchedAt;
      state = {
        heights: cached.heights,
        extremes: cached.extremes,
        fetchedAt: cached.fetchedAt,
        status: age > CONFIG.refresh.staleAfterMs ? 'stale' : 'error',
        errorMessage: message,
      };
    } else {
      state = { ...state, status: 'error', errorMessage: message };
    }
    _notify();
  }

  function _applyExtendedLive(payload) {
    extendedState = {
      extremes: payload.extremes,
      fetchedAt: payload.fetchedAt,
      status: 'live',
      errorMessage: null,
    };
    _saveCache(CONFIG.storage.extendedCacheKey, payload);
    _notify();
  }

  function _applyExtendedError(message) {
    const cached = _loadCache(CONFIG.storage.extendedCacheKey);
    if (cached && cached.extremes.length) {
      extendedState = {
        extremes: cached.extremes,
        fetchedAt: cached.fetchedAt,
        status: 'stale',
        errorMessage: message,
      };
    } else {
      extendedState = { ...extendedState, status: 'error', errorMessage: message };
    }
    _notify();
  }

  async function refresh() {
    if (!_isConfigured()) {
      _applyNearTermError('No WorldTides API key configured — edit js/config.js');
      return;
    }
    try {
      _applyNearTermLive(await _fetchNearTerm());
    } catch (err) {
      _applyNearTermError(err.message || 'Failed to reach tide data service');
    }
  }

  async function refreshExtended() {
    if (!_isConfigured()) return;
    try {
      _applyExtendedLive(await _fetchExtended());
    } catch (err) {
      _applyExtendedError(err.message || 'Failed to reach tide data service');
    }
  }

  function start() {
    const cached = _loadCache(CONFIG.storage.cacheKey);
    if (cached && cached.heights.length) {
      const age = Date.now() - cached.fetchedAt;
      state = {
        heights: cached.heights,
        extremes: cached.extremes,
        fetchedAt: cached.fetchedAt,
        status: age > CONFIG.refresh.staleAfterMs ? 'stale' : 'live',
        errorMessage: null,
      };
    }

    const cachedExtended = _loadCache(CONFIG.storage.extendedCacheKey);
    if (cachedExtended && cachedExtended.extremes.length) {
      extendedState = {
        extremes: cachedExtended.extremes,
        fetchedAt: cachedExtended.fetchedAt,
        status: 'live',
        errorMessage: null,
      };
    }
    _notify();

    refresh();
    refreshExtended();

    setInterval(() => {
      const interval = state.status === 'error'
        ? CONFIG.refresh.retryIntervalMs
        : CONFIG.refresh.dataIntervalMs;
      if (Date.now() - (state.fetchedAt || 0) >= interval) refresh();

      const extendedInterval = extendedState.status === 'error'
        ? CONFIG.refresh.retryIntervalMs
        : CONFIG.refresh.extendedDataIntervalMs;
      if (Date.now() - (extendedState.fetchedAt || 0) >= extendedInterval) refreshExtended();
    }, 60 * 1000);
  }

  /**
   * Loads a static, locally-generated dataset instead of fetching -
   * used for the setup screen's "Preview with sample data" option. No
   * network call, no API key, and nothing scheduled afterwards (there's
   * nothing to refresh); status is 'preview' throughout so the UI can
   * show a clearly-labelled preview rather than presenting synthetic
   * numbers as if they were real live data.
   */
  function startPreview(sampleData) {
    state = {
      heights: sampleData.near.heights,
      extremes: sampleData.near.extremes,
      fetchedAt: sampleData.near.fetchedAt,
      status: 'preview',
      errorMessage: null,
    };
    extendedState = {
      extremes: sampleData.extended.extremes,
      fetchedAt: sampleData.extended.fetchedAt,
      status: 'preview',
      errorMessage: null,
    };
    _notify();
  }

  function getSnapshot() {
    return {
      ...state,
      extendedExtremes: extendedState.extremes,
      extendedFetchedAt: extendedState.fetchedAt,
      extendedStatus: extendedState.status,
    };
  }

  return { start, startPreview, refresh, refreshExtended, subscribe, getSnapshot };
})();

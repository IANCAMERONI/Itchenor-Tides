/**
 * Fetches tide predictions from the WorldTides API, caches them in
 * localStorage, and exposes the latest known-good dataset even if a
 * refresh fails — the display should keep running quietly rather than
 * going blank because of one dropped request.
 */
const TideService = (() => {
  let state = {
    heights: [],
    extremes: [],
    fetchedAt: null,
    status: 'loading', // 'loading' | 'live' | 'stale' | 'error'
    errorMessage: null,
  };

  const listeners = new Set();

  function _notify() {
    listeners.forEach(fn => fn({ ...state }));
  }

  function subscribe(fn) {
    listeners.add(fn);
    fn({ ...state });
    return () => listeners.delete(fn);
  }

  function _cacheKey() {
    return CONFIG.storage.cacheKey;
  }

  function _loadCache() {
    try {
      const raw = localStorage.getItem(_cacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.heights)) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function _saveCache(payload) {
    try {
      localStorage.setItem(_cacheKey(), JSON.stringify(payload));
    } catch (err) {
      /* Storage may be unavailable (private mode, quota) — non-fatal. */
    }
  }

  function _buildUrl() {
    const { endpoint, apiKey, datum, days, stepSeconds } = CONFIG.worldTides;
    const { lat, lon } = CONFIG.location;
    const params = new URLSearchParams({
      heights: '',
      extremes: '',
      date: 'today',
      days: String(days),
      step: String(stepSeconds),
      datum,
      lat: String(lat),
      lon: String(lon),
      key: apiKey,
    });
    return `${endpoint}?${params.toString()}`;
  }

  function _isConfigured() {
    const key = CONFIG.worldTides.apiKey;
    return Boolean(key) && key !== 'YOUR_WORLDTIDES_API_KEY';
  }

  async function _fetchLive() {
    const res = await fetch(_buildUrl(), { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.status !== 200) {
      const msg = (body && (body.error || body.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    if (!Array.isArray(body.heights) || !Array.isArray(body.extremes)) {
      throw new Error('Unexpected API response shape');
    }
    return {
      heights: body.heights.map(h => ({ dt: h.dt, height: h.height })),
      extremes: body.extremes.map(e => ({
        dt: e.dt,
        height: e.height,
        type: /high/i.test(e.type) ? 'High' : 'Low',
      })),
      fetchedAt: Date.now(),
    };
  }

  function _applyLive(payload) {
    state = {
      heights: payload.heights,
      extremes: payload.extremes,
      fetchedAt: payload.fetchedAt,
      status: 'live',
      errorMessage: null,
    };
    _saveCache(payload);
    _notify();
  }

  function _applyError(message) {
    const cached = _loadCache();
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

  async function refresh() {
    if (!_isConfigured()) {
      _applyError('No WorldTides API key configured — edit js/config.js');
      return;
    }
    try {
      const payload = await _fetchLive();
      _applyLive(payload);
    } catch (err) {
      _applyError(err.message || 'Failed to reach tide data service');
    }
  }

  function start() {
    const cached = _loadCache();
    if (cached && cached.heights.length) {
      const age = Date.now() - cached.fetchedAt;
      state = {
        heights: cached.heights,
        extremes: cached.extremes,
        fetchedAt: cached.fetchedAt,
        status: age > CONFIG.refresh.staleAfterMs ? 'stale' : 'live',
        errorMessage: null,
      };
      _notify();
    }

    refresh();
    setInterval(() => {
      const isErrorState = state.status === 'error';
      const interval = isErrorState
        ? CONFIG.refresh.retryIntervalMs
        : CONFIG.refresh.dataIntervalMs;
      const dueSince = Date.now() - (state.fetchedAt || 0);
      if (dueSince >= interval) refresh();
    }, 60 * 1000);
  }

  function getSnapshot() {
    return { ...state };
  }

  return { start, refresh, subscribe, getSnapshot };
})();

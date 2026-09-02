/**
 * Persists the visitor's chosen location + their own WorldTides API key
 * in localStorage, and applies them onto CONFIG at boot. This is what
 * makes the app "bring your own location and key" - a fresh visitor
 * with nothing saved gets the setup screen instead of js/config.js
 * needing to be hand-edited per deployment. Nothing here is ever sent
 * anywhere except directly to WorldTides, from the visitor's own browser.
 */
const UserSettings = (() => {
  const STORAGE_KEY = 'itchenor-tide-user-settings-v1';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const valid = parsed
        && typeof parsed.name === 'string' && parsed.name.trim()
        && typeof parsed.lat === 'number' && !Number.isNaN(parsed.lat)
        && typeof parsed.lon === 'number' && !Number.isNaN(parsed.lon)
        && typeof parsed.apiKey === 'string' && parsed.apiKey.trim();
      return valid ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function save(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // A saved location's cached tide data belongs to the *previous*
    // place - drop it so a location change never briefly shows the
    // wrong harbour's numbers while the fresh fetch is in flight.
    localStorage.removeItem(CONFIG.storage.cacheKey);
    localStorage.removeItem(CONFIG.storage.extendedCacheKey);
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Mutates CONFIG in place so every other module picks this up automatically. */
  function applyToConfig(settings) {
    CONFIG.location.name = settings.name;
    CONFIG.location.region = settings.region || '';
    CONFIG.location.lat = settings.lat;
    CONFIG.location.lon = settings.lon;
    CONFIG.location.positionLabel = GeoFormat.formatPosition(settings.lat, settings.lon);
    CONFIG.worldTides.apiKey = settings.apiKey;
  }

  return { load, save, clear, applyToConfig };
})();

/**
 * Wires the first-run / settings overlay: collects a location + API key
 * from the visitor, persists them via UserSettings, and reloads the
 * page so the rest of the app boots cleanly against the new
 * configuration rather than trying to reconfigure already-running
 * modules in place.
 *
 * Location search (via Open-Meteo's free, no-key, CORS-enabled
 * geocoding API) is the primary path - most visitors just type a place
 * name. Manual latitude/longitude entry lives behind a collapsed
 * "advanced" disclosure as the fallback for when a search comes back
 * empty/wrong, or for pinning a precise spot. Coordinates there are
 * entered as a positive magnitude plus an N/S or E/W selector rather
 * than a single signed number - mobile Safari's numeric keyboard for
 * <input type="number"> often has no minus key at all, which made
 * negative longitudes (like Itchenor's) impossible to type on iPhone.
 */
function createSetupUI({
  overlayEl, formEl, fields, useLocationBtn, findLocationBtn, geocodeResultsEl,
  advancedEl, openBtn, cancelBtn, errorEl,
}) {
  const GEOCODE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

  function _magnitudeAndHemi(signedValue, positiveLabel, negativeLabel) {
    return {
      magnitude: Math.abs(signedValue),
      hemi: signedValue < 0 ? negativeLabel : positiveLabel,
    };
  }

  function _signedFromMagnitude(magnitude, hemi, negativeLabel) {
    return hemi === negativeLabel ? -Math.abs(magnitude) : Math.abs(magnitude);
  }

  function _setLatLon(lat, lon) {
    const latParts = _magnitudeAndHemi(lat, 'N', 'S');
    fields.lat.value = latParts.magnitude.toFixed(4);
    fields.latHemi.value = latParts.hemi;

    const lonParts = _magnitudeAndHemi(lon, 'E', 'W');
    fields.lon.value = lonParts.magnitude.toFixed(4);
    fields.lonHemi.value = lonParts.hemi;
  }

  function _showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function _hideError() {
    if (errorEl) errorEl.hidden = true;
  }

  function _clearGeocodeResults() {
    if (!geocodeResultsEl) return;
    geocodeResultsEl.innerHTML = '';
    geocodeResultsEl.hidden = true;
  }

  function _regionFromResult(result) {
    const parts = [result.admin2, result.admin1, result.country].filter(Boolean);
    return [...new Set(parts)].join(', ');
  }

  function _applyGeocodeResult(result) {
    fields.name.value = result.name;
    fields.region.value = _regionFromResult(result);
    _setLatLon(result.latitude, result.longitude);
    _clearGeocodeResults();
    _hideError();
    if (advancedEl) advancedEl.open = false;
  }

  function _renderGeocodeResults(results) {
    if (!geocodeResultsEl) return;
    geocodeResultsEl.innerHTML = '';
    results.forEach((result) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'setup-geocode-result';
      const region = _regionFromResult(result);
      btn.innerHTML = `<strong>${result.name}</strong>${region ? `<span>${region}</span>` : ''}`;
      btn.addEventListener('click', () => _applyGeocodeResult(result));
      geocodeResultsEl.appendChild(btn);
    });
    geocodeResultsEl.hidden = false;
  }

  async function _findLocation() {
    const query = fields.name.value.trim();
    if (!query) {
      _showError('Type a place name first.');
      return;
    }

    const label = findLocationBtn.textContent;
    findLocationBtn.disabled = true;
    findLocationBtn.textContent = 'Searching…';
    _hideError();
    _clearGeocodeResults();

    try {
      const url = `${GEOCODE_ENDPOINT}?name=${encodeURIComponent(query)}&count=5&format=json`;
      const res = await fetch(url);
      const body = await res.json().catch(() => null);
      const results = (body && body.results) || [];

      if (!results.length) {
        _showError(`No location found for "${query}" - try a simpler name (just the place, not the country), or set coordinates manually below.`);
        if (advancedEl) advancedEl.open = true;
      } else if (results.length === 1) {
        _applyGeocodeResult(results[0]);
      } else {
        _renderGeocodeResults(results);
      }
    } catch (err) {
      _showError('Could not reach the location search service - set coordinates manually below.');
      if (advancedEl) advancedEl.open = true;
    } finally {
      findLocationBtn.disabled = false;
      findLocationBtn.textContent = label;
    }
  }

  function open(prefill) {
    const hasExisting = Boolean(prefill && prefill.apiKey);
    fields.name.value = (prefill && prefill.name) || '';
    fields.region.value = (prefill && prefill.region) || '';

    if (prefill && prefill.lat != null && prefill.lon != null) {
      _setLatLon(prefill.lat, prefill.lon);
    } else {
      fields.lat.value = '';
      fields.latHemi.value = 'N';
      fields.lon.value = '';
      fields.lonHemi.value = 'W';
    }

    fields.apiKey.value = (prefill && prefill.apiKey) || '';
    if (cancelBtn) cancelBtn.hidden = !hasExisting;
    if (advancedEl) advancedEl.open = false;
    _clearGeocodeResults();
    _hideError();
    overlayEl.hidden = false;
  }

  function close() {
    overlayEl.hidden = true;
  }

  function _useCurrentLocation() {
    if (!('geolocation' in navigator)) {
      _showError('Your browser does not support automatic location detection - enter latitude/longitude manually.');
      return;
    }
    const label = useLocationBtn.textContent;
    useLocationBtn.disabled = true;
    useLocationBtn.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        _setLatLon(pos.coords.latitude, pos.coords.longitude);
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = label;
        _hideError();
      },
      () => {
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = label;
        _showError('Could not determine your location - enter latitude/longitude manually.');
      }
    );
  }

  function _onSubmit(event) {
    event.preventDefault();

    const name = fields.name.value.trim();
    if (!name) {
      _showError('Please enter a location name.');
      return;
    }

    const latMagnitude = parseFloat(fields.lat.value);
    if (Number.isNaN(latMagnitude) || latMagnitude < 0 || latMagnitude > 90) {
      _showError('No coordinates set yet - tap "Find Location" above, or expand "Set coordinates manually" below.');
      if (advancedEl) advancedEl.open = true;
      return;
    }

    const lonMagnitude = parseFloat(fields.lon.value);
    if (Number.isNaN(lonMagnitude) || lonMagnitude < 0 || lonMagnitude > 180) {
      _showError('Longitude must be a number between 0 and 180 (just the magnitude - use the E/W selector for hemisphere).');
      if (advancedEl) advancedEl.open = true;
      return;
    }

    const apiKey = fields.apiKey.value.trim();
    if (!apiKey) {
      _showError('Please enter your WorldTides API key.');
      return;
    }

    const settings = {
      name,
      region: fields.region.value.trim(),
      lat: _signedFromMagnitude(latMagnitude, fields.latHemi.value, 'S'),
      lon: _signedFromMagnitude(lonMagnitude, fields.lonHemi.value, 'W'),
      apiKey,
    };

    UserSettings.save(settings);
    location.reload();
  }

  useLocationBtn.addEventListener('click', _useCurrentLocation);
  if (findLocationBtn) findLocationBtn.addEventListener('click', _findLocation);
  formEl.addEventListener('submit', _onSubmit);
  if (openBtn) openBtn.addEventListener('click', () => open(UserSettings.load()));
  if (cancelBtn) cancelBtn.addEventListener('click', close);

  return { open, close };
}

/**
 * Wires the first-run / settings overlay: collects a location + API key
 * from the visitor, persists them via UserSettings, and reloads the
 * page so the rest of the app boots cleanly against the new
 * configuration rather than trying to reconfigure already-running
 * modules in place.
 */
function createSetupUI({ overlayEl, formEl, fields, useLocationBtn, openBtn, cancelBtn }) {
  function open(prefill) {
    const hasExisting = Boolean(prefill && prefill.apiKey);
    fields.name.value = (prefill && prefill.name) || '';
    fields.region.value = (prefill && prefill.region) || '';
    fields.lat.value = prefill && prefill.lat != null ? prefill.lat : '';
    fields.lon.value = prefill && prefill.lon != null ? prefill.lon : '';
    fields.apiKey.value = (prefill && prefill.apiKey) || '';
    if (cancelBtn) cancelBtn.hidden = !hasExisting;
    overlayEl.hidden = false;
  }

  function close() {
    overlayEl.hidden = true;
  }

  function _useCurrentLocation() {
    if (!('geolocation' in navigator)) {
      alert('Your browser does not support automatic location detection - enter latitude/longitude manually.');
      return;
    }
    const label = useLocationBtn.textContent;
    useLocationBtn.disabled = true;
    useLocationBtn.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fields.lat.value = pos.coords.latitude.toFixed(4);
        fields.lon.value = pos.coords.longitude.toFixed(4);
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = label;
      },
      () => {
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = label;
        alert('Could not determine your location - enter latitude/longitude manually.');
      }
    );
  }

  function _onSubmit(event) {
    event.preventDefault();
    const settings = {
      name: fields.name.value.trim(),
      region: fields.region.value.trim(),
      lat: parseFloat(fields.lat.value),
      lon: parseFloat(fields.lon.value),
      apiKey: fields.apiKey.value.trim(),
    };
    if (!settings.name || Number.isNaN(settings.lat) || Number.isNaN(settings.lon) || !settings.apiKey) {
      return;
    }
    UserSettings.save(settings);
    location.reload();
  }

  useLocationBtn.addEventListener('click', _useCurrentLocation);
  formEl.addEventListener('submit', _onSubmit);
  if (openBtn) openBtn.addEventListener('click', () => open(UserSettings.load()));
  if (cancelBtn) cancelBtn.addEventListener('click', close);

  return { open, close };
}

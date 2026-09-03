/**
 * Boot sequence — wires config, data service, sea window and UI together.
 * Each piece above is independently reusable; this is the only file that
 * needs to know how they fit.
 *
 * Boot is gated on having a saved location + API key (see UserSettings).
 * A fresh visitor sees the setup overlay instead of the live display;
 * on first save, boot() below is called directly with the just-saved
 * settings rather than reloading the page and re-reading them back from
 * storage - a full reload would depend on that write having reliably
 * persisted across the navigation, which isn't true in every browser
 * context (Safari Private Browsing blocks it outright; some tracking
 * protection settings can too), and there is no reason to take that risk
 * when the settings are already sitting right here in memory. Editing
 * settings later (via the Settings button) still reloads, since a full
 * teardown is the safe way to restart already-running modules.
 */
(function bootstrap() {
  /**
   * `preview: true` skips applying any settings (CONFIG's own Itchenor
   * defaults stand as-is) and loads a locally-generated sample dataset
   * instead of subscribing to and starting the real TideService fetch
   * cycle - see js/sampleData.js and TideService.startPreview. Used by
   * the setup screen's "Preview with sample data" option, so a visitor
   * can see the display actually working with no API key at all.
   */
  function boot(settings, { preview = false } = {}) {
    if (!preview) {
      UserSettings.applyToConfig(settings);
    }

    document.querySelector('.location-name').textContent = CONFIG.location.name;
    document.querySelector('.location-sub').textContent = CONFIG.location.region;

    const sea = createSeaWindow(
      document.getElementById('sea-canvas'),
      document.getElementById('sea-readout')
    );

    const curve = createTideCurve(document.getElementById('tide-curve-canvas'));

    const curveSlider = createCurveSlider({
      curve,
      sliderEl: document.getElementById('curve-day-slider'),
      labelEl: document.getElementById('curve-date-label'),
    });

    const ui = createUI({ sea, curve });

    initFullscreen({
      toggleButton: document.getElementById('fullscreen-toggle'),
      hintText: document.getElementById('fullscreen-hint-text'),
      appEl: document.getElementById('app'),
    });

    const clock = createClock({
      onTick: (now) => {
        document.getElementById('clock-time').textContent = TideMath.formatClockTime(now);
        curveSlider.tick();
      },
      onMinute: (now) => ui.render(now),
    });

    TideService.subscribe((snapshot) => {
      ui.render(new Date());
      if (snapshot.extendedExtremes && snapshot.extendedExtremes.length) {
        curveSlider.enable();
      }
    });
    if (preview) {
      TideService.startPreview(SampleTideData.generate());
    } else {
      TideService.start();
    }
    clock.start();
    ui.render(new Date());

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
          /* Offline installability is a nice-to-have, not required for the app to run. */
        });
      });
    }
  }

  let setupUI;
  setupUI = createSetupUI({
    overlayEl: document.getElementById('setup-overlay'),
    formEl: document.getElementById('setup-form'),
    fields: {
      name: document.getElementById('setup-name'),
      region: document.getElementById('setup-region'),
      lat: document.getElementById('setup-lat'),
      latHemi: document.getElementById('setup-lat-hemi'),
      lon: document.getElementById('setup-lon'),
      lonHemi: document.getElementById('setup-lon-hemi'),
      apiKey: document.getElementById('setup-api-key'),
    },
    useLocationBtn: document.getElementById('setup-use-location'),
    findLocationBtn: document.getElementById('setup-find-location'),
    geocodeResultsEl: document.getElementById('setup-geocode-results'),
    advancedEl: document.getElementById('setup-advanced'),
    openBtn: document.getElementById('settings-toggle'),
    cancelBtn: document.getElementById('setup-cancel'),
    errorEl: document.getElementById('setup-error'),
    previewBtn: document.getElementById('setup-preview'),
    onFirstBoot: (settings) => {
      setupUI.close();
      boot(settings);
    },
    onPreview: () => boot(null, { preview: true }),
  });

  const settings = UserSettings.load();
  if (!settings) {
    // Pre-fill the form with CONFIG.location as a visible starting point -
    // Itchenor's name and coordinates by default, but never the API key
    // (that stays blank; only a name/lat/lon prefill is safe to ship in
    // public source - see js/config.js for why the key itself never is).
    // This is a convenience for a fork too: point CONFIG.location at your
    // own harbour and that becomes every fresh visitor's default prefill.
    setupUI.open({
      name: CONFIG.location.name,
      region: CONFIG.location.region,
      lat: CONFIG.location.lat,
      lon: CONFIG.location.lon,
    });
    return;
  }
  boot(settings);
})();

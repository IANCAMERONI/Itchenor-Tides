/**
 * Boot sequence — wires config, data service, sea window and UI together.
 * Each piece above is independently reusable; this is the only file that
 * needs to know how they fit.
 *
 * Boot is gated on having a saved location + API key (see UserSettings):
 * a fresh visitor sees the setup overlay instead of the live display,
 * and nothing below runs until they've saved settings and the page has
 * reloaded against them.
 */
(function bootstrap() {
  const setupUI = createSetupUI({
    overlayEl: document.getElementById('setup-overlay'),
    formEl: document.getElementById('setup-form'),
    fields: {
      name: document.getElementById('setup-name'),
      region: document.getElementById('setup-region'),
      lat: document.getElementById('setup-lat'),
      lon: document.getElementById('setup-lon'),
      apiKey: document.getElementById('setup-api-key'),
    },
    useLocationBtn: document.getElementById('setup-use-location'),
    openBtn: document.getElementById('settings-toggle'),
    cancelBtn: document.getElementById('setup-cancel'),
  });

  const settings = UserSettings.load();
  if (!settings) {
    setupUI.open();
    return;
  }
  UserSettings.applyToConfig(settings);

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
  TideService.start();
  clock.start();
  ui.render(new Date());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* Offline installability is a nice-to-have, not required for the app to run. */
      });
    });
  }
})();

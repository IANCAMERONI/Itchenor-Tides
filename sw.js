/**
 * App-shell service worker. Caches the static files that make up the
 * page itself, so it works offline once installed. Live tide data is
 * deliberately left alone here - the app already has its own
 * freshness/fallback logic in tideService.js, and a service-worker
 * cache would only get in the way of that.
 *
 * The app shell itself is network-first: every fetch tries the network
 * and only falls back to the cache if that fails (offline, or a flaky
 * connection). It used to be cache-first (serve the cached copy
 * instantly, refresh the cache quietly in the background for next
 * time) for a snappier launch, but that meant a fix pushed to the site
 * could take two full reloads to actually reach a visitor - the first
 * reload was still served from the old cache while it refreshed in the
 * background, and the *second* reload was needed to see the update.
 * Combined with how inconsistently iOS Safari checks for service-worker
 * updates in standalone/home-screen mode, that could leave a device
 * stuck on a stale, already-fixed bug indefinitely. Network-first loses
 * a little bit of launch speed on a slow connection, but guarantees a
 * connected visitor always gets what's actually deployed.
 */
const CACHE_NAME = 'itchenor-tide-v14';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/fonts.css',
  './css/variables.css',
  './css/layout.css',
  './css/sea.css',
  './css/curve.css',
  './css/mobile.css',
  './css/setup.css',
  './js/config.js',
  './js/geo.js',
  './js/userSettings.js',
  './js/tideMath.js',
  './js/tideService.js',
  './js/seaWindow.js',
  './js/tideCurve.js',
  './js/curveSlider.js',
  './js/clock.js',
  './js/fullscreen.js',
  './js/setupUI.js',
  './js/ui.js',
  './js/app.js',
  './assets/fonts/cinzel-variable.woff2',
  './assets/fonts/jost-variable.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/icon-180.png',
  './assets/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests - live API calls (a different
  // origin) pass straight through to the network untouched.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

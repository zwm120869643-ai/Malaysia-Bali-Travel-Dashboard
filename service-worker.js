const CACHE_PREFIX = "malaysia-bali-dashboard-";
const CACHE_VERSION = "v1.6.2";
const CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./data/trip-data.js",
  "./data/offline-pack.js",
  "./config/sync-config.js",
  "./js/logic.js",
  "./js/sync.js",
  "./js/weather.js",
  "./js/documents.js",
  "./js/shared-data.js",
  "./js/flight-watcher.js",
  "./js/travel-context.js",
  "./js/timeline-engine.js",
  "./js/app.js",
  "./assets/images/placeholder-cover.svg",
  "./assets/images/placeholder-hotel.svg",
  "./assets/images/placeholder-food.svg",
  "./assets/images/placeholder-map.svg",
  "./assets/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(SHELL.map(async (url) => {
    const response = await fetch(url, { cache: "reload" });
    if (!response.ok) throw new Error(`Failed to cache ${url}`);
    await cache.put(url, response);
  }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const privateRequest = [
    "/rest/v1/",
    "/auth/v1/",
    "/storage/v1/"
  ].some((path) => url.pathname.includes(path));
  if (event.request.method !== "GET" || privateRequest || url.origin !== location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});

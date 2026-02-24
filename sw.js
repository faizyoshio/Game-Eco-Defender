const CACHE_VERSION = "v3";
const CORE_CACHE = `eco-defender-core-${CACHE_VERSION}`;
const RUNTIME_CACHE = `eco-defender-runtime-${CACHE_VERSION}`;
const CACHE_PREFIX = "eco-defender-";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/icons/icon-192.svg",
  "/assets/icons/icon-512.svg"
];

const isAssetRequest = (request) => {
  if (request.destination === "script" || request.destination === "style" || request.destination === "image" || request.destination === "font") {
    return true;
  }

  const url = new URL(request.url);
  return url.pathname.startsWith("/assets/");
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CORE_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CORE_CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/index.html");
          return cached || Response.error();
        })
    );
    return;
  }

  if (!isAssetRequest(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || Response.error());

      return cached || networkFetch;
    })
  );
});

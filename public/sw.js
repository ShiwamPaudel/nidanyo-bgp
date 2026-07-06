/* Nidanyo service worker — app-shell caching for an installable, resilient PWA.
   Strategy: network-first for navigations & API (always fresh data when online,
   graceful offline fallback); cache-first for hashed static assets. Never caches
   authenticated HTML aggressively to avoid leaking stale data. */
const VERSION = "nidanyo-v1";
const STATIC_CACHE = `${VERSION}-static`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(["/favicon.png", "/logo.png", "/manifest.webmanifest"]).catch(() => {})),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache auth, API, or server-action responses.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/login") || url.pathname.startsWith("/r/")) return;

  // Hashed static assets — cache first.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/uploads") || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
        return res;
      })),
    );
    return;
  }

  // Navigations — network first, fall back to cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/dashboard"))),
    );
  }
});

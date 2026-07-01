// FicheDéputé.fr — minimal offline shell. Bump CACHE on shell/asset changes.
const CACHE = "std-v8";
const SHELL = ["/", "/styles.css?v=8", "/i18n.js?v=8", "/app.js?v=8", "/views.js?v=8", "/site.webmanifest"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // network-first for API + navigation, cache-first for static assets
  if (url.pathname.startsWith("/api/") || e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((ch) => ch.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match("/"))));
  } else {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((ch) => ch.put(e.request, c)); return r; })));
  }
});

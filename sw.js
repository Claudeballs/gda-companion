/* GdA Companion service worker — offline-first.
   Strategy: network-first with cache fallback. Online users always get
   the latest deploy; offline users get the full cached app. Bump
   VERSION on every deploy that changes files. */
const VERSION = "gda-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/data.js",
  "./js/app.js",
  "./js/charge.js",
  "./js/melee.js",
  "./js/rolloff.js",
  "./js/fire.js",
  "./js/tracker.js",
  "./js/content.js",
  "./scenarios/hochberg.js",
  "./manifest.webmanifest",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./install-card.html"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copy = resp.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() =>
        caches.match(e.request).then(hit =>
          hit || caches.match("./index.html"))));
});

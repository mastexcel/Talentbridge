/*
 * Service worker de l'application Talent Bridge.
 * - Pages : toujours le réseau (données à jour, pages privées jamais mises en cache) ;
 *   hors connexion, page /hors-ligne.
 * - Fichiers statiques versionnés (/_next/static), visuels, logos et icônes : cache d'abord.
 * - API, fichiers privés et requêtes non GET : jamais interceptés.
 */
const VERSION = "tb-v2";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/hors-ligne.html";
const PRECACHE = [OFFLINE_URL, "/app/icon-192.png", "/brand/tb-wordmark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/optimized/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/app/") || url.pathname.startsWith("/backgrounds/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

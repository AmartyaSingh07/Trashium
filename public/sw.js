/* Trashium service worker — installability + light offline support.

   IMPORTANT: never cache Next.js build output (/_next/*) or HTML documents
   aggressively, otherwise new deploys won't show up. Next content-hashes its
   chunks, so the network is always the source of truth for them. We only
   precache a tiny offline fallback + icons. */
const CACHE = "trashium-v3";
const PRECACHE = [
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only same-origin; let Supabase / Google Fonts / etc. pass straight through.
  if (url.origin !== self.location.origin) return;

  // NEVER intercept Next build assets or data — always go to network so new
  // builds load immediately. This is the key fix for "my changes don't show".
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/")
  ) {
    return; // default browser fetch, no SW caching
  }

  // Document navigations: network-first, fall back to cache only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((r) => r || caches.match("/icon-512.png"))
      )
    );
    return;
  }

  // Other same-origin GETs (icons, manifest, public files): network-first,
  // updating the cache so the offline copy stays fresh.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request))
  );
});

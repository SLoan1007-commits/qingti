/* Offline cache: the app shell and the recognition engine are cached on first visit. */
const CACHE = "qingti-v2-2";
const SHELL = ["./", "index.html", "manifest.json", "js/core.js", "js/pets.js", "js/parse.js", "js/app.js",
  "fonts/newsreader-400.woff2", "fonts/newsreader-400i.woff2", "fonts/newsreader-500.woff2", "img/sky.webp",
  "img/pets/dog-sit.webp", "img/pets/dog-walk.webp", "img/pets/dog-bow.webp", "img/pets/dog-lie.webp", "img/pets/dog-head.webp",
  "img/pets/cat-sit.webp", "img/pets/cat-walk.webp", "img/pets/cat-stretch.webp", "img/pets/cat-sleep.webp", "img/pets/cat-head.webp",
  "icons/icon-180.png", "icons/icon-192.png"];
const LAZY = ["vendor/tesseract.min.js", "vendor/worker.min.js", "vendor/core/tesseract-core-simd-lstm.wasm.js", "vendor/core/tesseract-core-lstm.wasm.js", "vendor/lang/chi_sim-traineddata.wasm"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // app files: network first so updates arrive, cache as fallback; engine files: cache first (large, rarely change)
  const lazy = LAZY.some(p => url.pathname.endsWith(p));
  e.respondWith(lazy
    ? caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; }))
    : fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});

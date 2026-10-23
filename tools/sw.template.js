/* The Bookshelf's service worker, written into sw.js by tools/build.py (which fills in the version and the list).
   It keeps what the reader and Your reading need, the pages you visit, the covers you see and the books you keep
   for offline reading, so a kept book opens with no connection. Pages always come fresh from the network when
   there is one; only without it are the kept copies used. */
const VERSION = "__VERSION__";
const SHELL = `shell-${VERSION}`; // the reader's and the site's own files, for this version of the site
const PAGES = "pages"; // pages you have visited
const IMAGES = "images"; // covers you have seen (the most recent 300)
const BOOKS = "books"; // books you keep for offline reading: only added or removed by you
const FILES = __SHELL__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith("shell-") && key !== SHELL).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

const trim = async (name, keep) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - keep)).map((key) => cache.delete(key)));
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // A book you keep (two big editions come straight from Standard Ebooks, so this is checked for any address)
  if (url.pathname.endsWith(".epub")) {
    event.respondWith(caches.open(BOOKS).then((cache) => cache.match(request, { ignoreSearch: true })).then((kept) => kept || fetch(request)));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages: from the network, kept as they arrive; offline, the kept copy, or Your reading, which lists your kept books
  const page = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
  if (page) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(PAGES).then((cache) => cache.put(request, copy)); }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match("reading.html")) || Response.error()));
    return;
  }

  // Covers: the kept copy at once, refreshed in the background
  if (url.pathname.includes("/image/covers/")) {
    event.respondWith(caches.open(IMAGES).then(async (cache) => {
      const kept = await cache.match(request);
      const fresh = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone()).then(() => trim(IMAGES, 300));
        return response;
      }).catch(() => kept);
      return kept || fresh;
    }));
    return;
  }

  // The site's own files: versioned, so a kept copy is always the right one
  event.respondWith(caches.match(request).then((kept) => kept || fetch(request)));
});

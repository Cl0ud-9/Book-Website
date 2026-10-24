/* The Bookshelf's service worker, written into sw.js by tools/build.py (which fills in the version and the list).
   It keeps what the reader and Your reading need, the pages you visit, the covers you see and the books you keep
   for offline reading, so a kept book opens with no connection. Pages always come fresh from the network when
   there is one; only without it are the kept copies used. */
const VERSION = "d03fb785";
const SHELL = `shell-${VERSION}`; // the reader's and the site's own files, for this version of the site
const PAGES = "pages"; // pages you have visited
const IMAGES = "images"; // covers you have seen (the most recent 300)
const BOOKS = "books"; // books you keep for offline reading: only added or removed by you
const FILES = ["read.html", "reading.html", "account.html", "css/main.css?v=4ed3fc51", "css/reader-content.css?v=4ed3fc51", "js/app.js?v=4ed3fc51", "js/account.js?v=4ed3fc51", "js/account-page.js?v=4ed3fc51", "js/reader.js?v=4ed3fc51", "js/notes-store.js?v=4ed3fc51", "js/reader-notes.js?v=4ed3fc51", "js/your-reading.js?v=4ed3fc51", "js/vendor/gsap.min.js", "js/vendor/ScrollTrigger.min.js", "js/vendor/SplitText.min.js", "js/vendor/CustomEase.min.js", "js/vendor/InertiaPlugin.min.js", "js/vendor/DrawSVGPlugin.min.js", "js/vendor/lenis.min.js", "js/vendor/barba.umd.min.js", "js/vendor/barba-prefetch.umd.min.js", "js/vendor/smooothy.min.js", "js/vendor/jszip.min.js", "js/vendor/epub.min.js", "fonts/rubik.woff2", "fonts/figtree.woff2", "fonts/figtree-italic.woff2", "fonts/gochi-hand.woff2", "fonts/literata.woff2", "fonts/literata-italic.woff2", "image/logo.svg", "manifest.webmanifest"];

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

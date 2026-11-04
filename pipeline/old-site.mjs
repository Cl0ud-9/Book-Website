// What is left of the old address (GitHub Pages, cl0ud-9.github.io/Book-Website): every page it had sends you on to the
// same page at the new address, search engines are told that is the page's home now, and the offline copies that browsers
// kept of the old site are removed. Whatever you read there (your place in each book, your notes) goes along with you,
// because the new address cannot read the old one's data by itself.
// usage: node pipeline/old-site.mjs   writes _old-site/ (the workflow old-site.yml publishes it)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const NEW = "https://the-bookshelf.cl0ud-9.workers.dev/";
const OUT = "_old-site";
const PAGES = ["index", "books", "genres", "faq", "reading", "privacy", "account", "profile", "login", "signup", "read"];
const books = JSON.parse(readFileSync("data/books.json", "utf8"));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const clean = (name) => (name === "index" ? "" : name);
const escape = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Every address is worked out from where you are, with what followed it (?book=dracula, #a-chapter). Any data goes in the
// part of the address that never reaches a server, and the new site only takes it from here (src/scripts/moved.js).
const forward = `(function () {
  var base = "/Book-Website/", path = location.pathname;
  path = path.indexOf(base) === 0 ? path.slice(base.length) : path.replace(/^\\//, "");
  path = path.replace(/(^|\\/)index\\.html$/, "$1").replace(/\\.html$/, "");
  var to = ${JSON.stringify(NEW)} + path + location.search + location.hash;
  var go = function (data) {
    var parcel = data && !location.hash ? "#bookshelf-moved=" + encodeURIComponent(JSON.stringify(data)) : "";
    location.replace(parcel.length < 1500000 ? to + parcel : to);
  };
  var kept = {}, any = false;
  try {
    ["bookshelf:reading", "bookshelf:reader", "bookshelf:stats"].forEach(function (key) {
      var value = localStorage.getItem(key);
      if (value) { kept[key] = value; any = true; }
    });
  } catch (e) { /* nothing to take */ }
  var done = false, finish = function (notes) {
    if (done) return;
    done = true;
    if (notes && notes.length) { kept.notes = notes; any = true; }
    go(any ? kept : null);
  };
  setTimeout(finish, 700);
  try {
    var open = indexedDB.open("bookshelf");
    open.onerror = function () { finish(); };
    open.onsuccess = function () {
      var db = open.result;
      if (!db.objectStoreNames.contains("notes")) { db.close(); return finish(); }
      var all = db.transaction("notes").objectStore("notes").getAll();
      all.onerror = function () { finish(); };
      all.onsuccess = function () { db.close(); finish(all.result); };
    };
  } catch (e) { finish(); }
})();
`;

const page = (name, title) => {
  const home = NEW + clean(name);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}: The Bookshelf has moved</title>
<link rel="canonical" href="${home}">
<meta http-equiv="refresh" content="3; url=${home}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#ffd24a;color:#1d1b16;font:1.1rem/1.5 system-ui,sans-serif;text-align:center;padding:1.5rem;box-sizing:border-box}a{color:inherit;font-weight:700}</style>
</head>
<body>
<p>The Bookshelf has moved to <a href="${home}">the-bookshelf.cl0ud-9.workers.dev</a>.</p>
<script src="/Book-Website/forward.js"></script>
</body>
</html>
`;
};

for (const name of PAGES) writeFileSync(`${OUT}/${name}.html`, page(name, name === "index" ? "Home" : name[0].toUpperCase() + name.slice(1)));
for (const book of books) writeFileSync(`${OUT}/book-${book.slug}.html`, page(`book-${book.slug}`, book.title));
// any other address it ever had (a book's file, a picture): GitHub Pages shows this one
writeFileSync(`${OUT}/404.html`, page("index", "Page"));
writeFileSync(`${OUT}/forward.js`, forward);

// A browser asks for this now and then, and that is the only way to reach an offline copy it already keeps. This one takes
// the old one's place, empties what it kept, removes itself, and shows each open tab the forwarding page instead.
writeFileSync(`${OUT}/sw.js`, `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: "window" });
    await Promise.all(tabs.map((tab) => tab.navigate(tab.url).catch(() => {})));
  })());
});
`);

// feed readers keep the old address: their last entry says where the feed is now
const now = new Date().toISOString().slice(0, 19) + "Z";
writeFileSync(`${OUT}/feed.xml`, `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Bookshelf: book of the month</title>
  <link href="${NEW}"/>
  <link rel="self" href="${NEW}feed.xml"/>
  <id>https://cl0ud-9.github.io/Book-Website/</id>
  <updated>${now}</updated>
  <author><name>The Bookshelf</name></author>
  <entry>
    <title>The Bookshelf has moved: please follow its new feed</title>
    <link href="${NEW}"/>
    <id>${NEW}moved</id>
    <updated>${now}</updated>
    <summary>The site is now at ${NEW} and this feed at ${NEW}feed.xml. This address will get no more entries.</summary>
  </entry>
</feed>
`);
writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${NEW}sitemap.xml\n`);
// an app installed from the old address still opens, and is sent on
writeFileSync(`${OUT}/manifest.webmanifest`, JSON.stringify({ name: "The Bookshelf", short_name: "Bookshelf", start_url: "./", scope: "./", display: "standalone", background_color: "#3b308f", theme_color: "#ffd24a", icons: [] }));
console.log(`${OUT}/: ${PAGES.length + books.length} pages sent on to ${NEW}`);

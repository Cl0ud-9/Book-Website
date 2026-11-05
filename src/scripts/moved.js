/* Arriving from the old address (pipeline/old-site.mjs): what you read there comes along in the address, because this site
   cannot read the old one's data by itself. Taken only when the browser says that is where you came from, and only into
   the places it belongs. Nothing you have here is overwritten: a book's place is only replaced by a later one. */
const OLD = "https://cl0ud-9.github.io";
const MARK = "#bookshelf-moved=";

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

function places(raw) {
  const incoming = parse(raw);
  if (!isObject(incoming)) return;
  const here = parse(localStorage.getItem("bookshelf:reading")) || {};
  let changed = false;
  for (const [slug, place] of Object.entries(incoming)) {
    if (!/^[a-z0-9-]+$/.test(slug) || !isObject(place) || typeof place.cfi !== "string") continue;
    if (!here[slug] || (place.at || 0) > (here[slug].at || 0)) { here[slug] = place; changed = true; }
  }
  if (changed) localStorage.setItem("bookshelf:reading", JSON.stringify(here));
}

function onlyIfNone(key, raw) {
  if (localStorage.getItem(key) === null && isObject(parse(raw))) localStorage.setItem(key, raw);
}

function notes(list) {
  if (!Array.isArray(list) || !list.length) return;
  const open = indexedDB.open("bookshelf", 1);
  open.onupgradeneeded = () => open.result.createObjectStore("notes", { keyPath: "id" }).createIndex("book", "book");
  open.onsuccess = () => {
    const db = open.result;
    const store = db.transaction("notes", "readwrite").objectStore("notes");
    for (const note of list) {
      if (!isObject(note) || typeof note.id !== "string" || typeof note.book !== "string") continue;
      // add, not put: a note already here stays as it is
      store.add(note).onerror = (event) => { event.preventDefault(); event.stopPropagation(); };
    }
    store.transaction.oncomplete = () => db.close();
  };
}

export function arrive() {
  const raw = location.hash.slice(MARK.length);
  // out of the address at once, whatever comes of it
  history.replaceState(history.state, "", location.pathname + location.search);
  let from = "";
  try { from = new URL(document.referrer).origin; } catch { /* no referrer */ }
  if (from !== OLD) return;
  const parcel = parse(decodeURIComponent(raw));
  if (!isObject(parcel)) return;
  try {
    if (parcel["bookshelf:reading"]) places(parcel["bookshelf:reading"]);
    if (parcel["bookshelf:reader"]) onlyIfNone("bookshelf:reader", parcel["bookshelf:reader"]);
    if (parcel["bookshelf:stats"]) onlyIfNone("bookshelf:stats", parcel["bookshelf:stats"]);
    notes(parcel.notes);
    window.dispatchEvent(new Event("bookshelf:changed"));
  } catch { /* storage is unavailable: nothing to do */ }
}

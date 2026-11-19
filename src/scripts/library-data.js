/* What the reader, Your reading, "Continue reading" and your account need to know about each book, from library.json:
   window.BookshelfLibrary.load() fetches it once, and only for a page that asks. (The service worker takes it from the
   network first, so new books are in it, and keeps the last copy for when there is no connection.) */
let loaded = null;

window.BookshelfLibrary = {
  load() {
    loaded ||= fetch("library.json").then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .catch((error) => { loaded = null; throw error; });
    return loaded;
  },
};

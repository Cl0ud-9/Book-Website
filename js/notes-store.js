// @ts-check
/* Your highlights and notes, kept in this browser (IndexedDB). The reader adds and draws them; the Your reading page
   lists, exports and restores them. With an account, js/account.js copies them to it and back. */
(() => {
  "use strict";

  /**
   * @typedef {"yellow" | "green" | "blue" | "pink" | "underline" | "bookmark"} NoteStyle (a bookmark holds the opening words of its page)
   * @typedef {{
   *   id: string, book: string, cfi: string, text: string, prefix: string, suffix: string,
   *   style: NoteStyle, note: string, chapter: string, percent: number | null, created: number, updated: number
   * }} Note
   */

  const DB = "bookshelf";
  const STORE = "notes";
  /** @type {Promise<IDBDatabase | null> | null} */
  let opening = null;
  /** @type {Map<string, Note>} used when the browser refuses IndexedDB (some private windows): kept until the tab closes */
  const memory = new Map();
  let lasting = true;

  /** @returns {Promise<IDBDatabase | null>} */
  function db() {
    opening ||= new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB, 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("book", "book");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => { lasting = false; resolve(null); };
        request.onblocked = () => { lasting = false; resolve(null); };
      } catch {
        lasting = false;
        resolve(null);
      }
    });
    return opening;
  }

  /**
   * @template T
   * @param {"readonly" | "readwrite"} mode
   * @param {(store: IDBObjectStore) => IDBRequest<T>} work
   * @returns {Promise<T>}
   */
  function run(mode, work) {
    return db().then((database) => new Promise((resolve, reject) => {
      if (!database) { reject(new Error("no storage")); return; }
      const request = work(database.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  }

  /** @param {Note[]} notes */
  const byPlace = (notes) => notes.sort((a, b) => (a.book === b.book ? (a.percent ?? 0) - (b.percent ?? 0) || a.created - b.created : a.book.localeCompare(b.book)));

  // Notes removed on this device since the last sync, so the account removes them too: { id: time removed }
  const REMOVED = "bookshelf:removed";
  /** @returns {Record<string, number>} */
  const removedList = () => { try { return JSON.parse(localStorage.getItem(REMOVED) || "{}") || {}; } catch { return {}; } };
  /** @param {Record<string, number>} list */
  const keepRemoved = (list) => { try { localStorage.setItem(REMOVED, JSON.stringify(list)); } catch { /* not kept */ } };
  // tells js/account.js there is something new to keep
  const changed = () => window.dispatchEvent(new Event("bookshelf:changed"));

  const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  const api = {
    /** false when notes can only be kept until this tab closes */
    get lasting() { return lasting; },
    id,
    /** @returns {Promise<Note[]>} */
    all() {
      return run("readonly", (s) => /** @type {IDBRequest<Note[]>} */ (s.getAll())).then(byPlace).catch(() => byPlace([...memory.values()]));
    },
    /** @param {string} book @returns {Promise<Note[]>} */
    forBook(book) {
      return run("readonly", (s) => /** @type {IDBRequest<Note[]>} */ (s.index("book").getAll(book))).then(byPlace)
        .catch(() => byPlace([...memory.values()].filter((n) => n.book === book)));
    },
    /** @param {string} noteId @returns {Promise<Note | undefined>} */
    get(noteId) {
      return run("readonly", (s) => /** @type {IDBRequest<Note | undefined>} */ (s.get(noteId))).catch(() => memory.get(noteId));
    },
    /** @param {Note} note @returns {Promise<Note>} */
    put(note) {
      const saved = { ...note, updated: Date.now() };
      const removed = removedList();
      if (removed[saved.id]) { delete removed[saved.id]; keepRemoved(removed); } // an undo
      return run("readwrite", (s) => s.put(saved)).then(() => saved).catch(() => { memory.set(saved.id, saved); return saved; })
        .finally(changed);
    },
    /** @param {string} noteId @returns {Promise<void>} */
    remove(noteId) {
      keepRemoved({ ...removedList(), [noteId]: Date.now() });
      return api.forget(noteId).finally(changed);
    },
    /** Removes a note from this device only (the account keeps it). @param {string} noteId @returns {Promise<void>} */
    forget(noteId) {
      return run("readwrite", (s) => s.delete(noteId)).then(() => undefined).catch(() => { memory.delete(noteId); });
    },
    /** Saves a note as it is, keeping its own time (a copy from the account). @param {Note} note @returns {Promise<void>} */
    keep(note) {
      return run("readwrite", (s) => s.put(note)).then(() => undefined).catch(() => { memory.set(note.id, note); });
    },
    /** Notes removed here that the account does not know about yet */
    removed: removedList,
    /** @param {string[]} ids the removals the account now has */
    removedSynced(ids) {
      const removed = removedList();
      ids.forEach((noteId) => delete removed[noteId]);
      keepRemoved(removed);
    },
    /** Adds notes from a backup, keeping the newer copy of any note that is in both. @param {Note[]} notes */
    async restore(notes) {
      const valid = notes.filter((n) => n && typeof n.id === "string" && typeof n.book === "string" && typeof n.cfi === "string" && typeof n.text === "string");
      let added = 0;
      for (const n of valid) {
        const have = await api.get(n.id);
        if (!have || (have.updated ?? 0) < (n.updated ?? 0)) { await api.keep(n); added += 1; }
      }
      if (added) changed();
      return added;
    },
  };

  /** @type {any} */ (window).BookshelfNotes = api;
})();

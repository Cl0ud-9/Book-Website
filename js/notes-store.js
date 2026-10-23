// @ts-check
/* Your highlights and notes, kept in this browser (IndexedDB). The reader adds and draws them; the Your reading page
   lists, exports and restores them. Nothing leaves the device. */
(() => {
  "use strict";

  /**
   * @typedef {"yellow" | "green" | "blue" | "pink" | "underline"} NoteStyle
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
      return run("readwrite", (s) => s.put(saved)).then(() => saved).catch(() => { memory.set(saved.id, saved); return saved; });
    },
    /** @param {string} noteId @returns {Promise<void>} */
    remove(noteId) {
      return run("readwrite", (s) => s.delete(noteId)).then(() => undefined).catch(() => { memory.delete(noteId); });
    },
    /** Adds notes from a backup, keeping the newer copy of any note that is in both. @param {Note[]} notes */
    async restore(notes) {
      const valid = notes.filter((n) => n && typeof n.id === "string" && typeof n.book === "string" && typeof n.cfi === "string" && typeof n.text === "string");
      let added = 0;
      for (const n of valid) {
        const have = await api.get(n.id);
        if (!have || (have.updated ?? 0) < (n.updated ?? 0)) { await run("readwrite", (s) => s.put(n)).catch(() => memory.set(n.id, n)); added += 1; }
      }
      return added;
    },
  };

  /** @type {any} */ (window).BookshelfNotes = api;
})();

/* The Bookshelf reader: opens a book's EPUB right in the page with epub.js, and remembers on this device where you
   stopped and how you like to read. app.js loads it, with epub.js and JSZip, only when a book is opened. */
(() => {
  "use strict";

  const PLACES = "bookshelf:reading"; // { slug: { cfi, percent, at } }
  const PREFS = "bookshelf:reader"; // { theme, size, font }

  // Saved places live in this browser only. Private windows and blocked storage simply keep nothing.
  const store = {
    read(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* nothing is kept */ }
    },
  };

  const THEMES = {
    paper: { body: { background: "#fffdf6 !important", color: "#1d1b16 !important" } },
    sepia: { body: { background: "#f3e9d2 !important", color: "#3b2f1e !important" } },
    night: {
      body: { background: "#17161c !important", color: "#e4dfd2 !important" }, a: { color: "#a9bcff !important" },
      // Title pages and ornaments are black artwork on transparent: turned light so they show on the dark page
      "img.epub-type-contains-word-se-image-color-depth-black-on-transparent": { filter: "invert(1)" },
    },
  };
  const FONTS = { book: null, serif: "Georgia, 'Times New Roman', serif", sans: "Figtree, system-ui, sans-serif" };
  const SIZES = [80, 90, 100, 110, 120, 135, 150, 170];

  function placeOf(slug) {
    return store.read(PLACES, {})[slug] || null;
  }

  function open(root, library) {
    const $ = (sel) => root.querySelector(sel);
    const slug = new URLSearchParams(location.search).get("book");
    const info = library[slug];
    const message = $("[data-reader-message]");
    if (!info) {
      root.classList.add("is--missing");
      message.textContent = "That book isn’t on the shelf.";
      return () => {};
    }

    const view = $("[data-reader-view]");
    const chapter = $("[data-reader-chapter]");
    const percent = $("[data-reader-percent]");
    const bar = $("[data-reader-bar]");
    const scrolled = matchMedia("(max-width: 767px)").matches;
    const prefs = { theme: "paper", size: 100, font: "book", ...store.read(PREFS, {}) };
    root.classList.toggle("is--scrolled", scrolled);
    root.dataset.theme = prefs.theme;

    $("[data-reader-title]").textContent = info.title;
    $("[data-reader-author]").textContent = info.author;
    $("[data-reader-back]").href = `book-${slug}.html`;
    $("[data-reader-download]").href = info.epub;
    document.title = `${info.title} | Reading at the Bookshelf`;

    // epub.js adds orientationchange and unload listeners to window and never takes them off, which kept every closed
    // book in memory. While this book is open those are noted, and removed when it closes.
    const leftovers = [];
    const add = window.addEventListener;
    window.addEventListener = function (type, ...rest) {
      if (type === "orientationchange" || type === "unload") leftovers.push([type, ...rest]);
      return add.call(this, type, ...rest);
    };
    const release = () => {
      window.addEventListener = add;
      leftovers.forEach((args) => window.removeEventListener(...args));
    };

    // The file is fetched here rather than by epub.js, which never reports a failed download
    const book = window.ePub();
    const rendition = book.renderTo(view, scrolled
      ? { manager: "continuous", flow: "scrolled", width: "100%", height: "100%" }
      // Two facing pages when there is room for two comfortable columns, one otherwise
      : { flow: "paginated", spread: view.clientWidth >= 1000 ? "always" : "none", width: "100%", height: "100%" });
    Object.entries(THEMES).forEach(([name, rules]) => rendition.themes.register(name, rules));
    // Paginated, epub.js sets the body's padding itself to lay out its columns, so only the scrolled view adds some
    rendition.themes.default({
      body: { "line-height": "1.6 !important", ...(scrolled ? { padding: "0 1.25em !important" } : {}) },
      img: { "max-width": "100%" },
    });
    // The site's own Figtree, for the Sans option
    rendition.hooks.content.register((contents) => contents.addStylesheet(new URL("css/reader-content.css", location.href).href));

    const apply = () => {
      rendition.themes.select(prefs.theme);
      rendition.themes.fontSize(`${prefs.size}%`);
      if (FONTS[prefs.font]) rendition.themes.override("font-family", FONTS[prefs.font], true);
      else rendition.themes.override("font-family", "inherit");
      root.dataset.theme = prefs.theme;
      root.querySelectorAll("[data-reader-theme]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readerTheme === prefs.theme)));
      root.querySelectorAll("[data-reader-font]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readerFont === prefs.font)));
      $("[data-reader-size-value]").textContent = `${prefs.size}%`;
      store.write(PREFS, prefs);
    };
    apply();

    // Where you are: the chapter's name, how far through the book, and a saved place to come back to
    let toc = [];
    const chapterOf = (href) => {
      const file = (href || "").split("#")[0];
      let found = null;
      const walk = (items) => items.forEach((item) => { if (item.href.split("#")[0] === file) found = found || item; walk(item.subitems || []); });
      walk(toc);
      return found ? found.label.trim() : "";
    };
    let current = null;
    const showProgress = () => {
      if (!current) return;
      const ready = book.locations.length() > 0;
      const p = ready ? book.locations.percentageFromCfi(current.start.cfi) : null;
      percent.textContent = p == null ? "" : `${Math.round(p * 100)}%`;
      bar.style.transform = `scaleX(${p == null ? 0 : p})`;
      chapter.textContent = chapterOf(current.start.href);
      const places = store.read(PLACES, {});
      places[slug] = { cfi: current.start.cfi, percent: p == null ? (places[slug]?.percent ?? 0) : p, at: Date.now() };
      store.write(PLACES, places);
    };
    rendition.on("relocated", (location) => { current = location; showProgress(); });

    // If the file can't be fetched (offline, or the source is busy), say so and offer the download, rather than wait
    let failed = false;
    const fail = () => {
      if (failed || root.classList.contains("is--ready")) return;
      failed = true;
      message.innerHTML = "";
      message.append("This book wouldn’t open here. ");
      const link = document.createElement("a");
      link.href = info.epub;
      link.setAttribute("download", "");
      link.textContent = "Download it instead";
      message.append(link, ".");
    };
    fetch(info.epub)
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); })
      .then((data) => book.open(data, "binary"))
      .catch(fail);
    const patience = setTimeout(fail, 30000);
    const saved = placeOf(slug);
    rendition.display(saved?.cfi || undefined).then(() => {
      clearTimeout(patience);
      if (failed) return;
      root.classList.add("is--ready");
      message.textContent = "";
    }).catch(fail);
    // Percentages need the whole book measured once, which can take a moment for a long one
    book.ready.then(() => book.locations.generate(1600)).then(showProgress).catch(() => {});

    // Contents
    const list = $("[data-reader-toc-list]");
    book.loaded.navigation.then((nav) => {
      toc = nav.toc;
      list.innerHTML = "";
      const add = (items, depth) => items.forEach((item) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "reader__toc-link";
        button.style.setProperty("--depth", depth);
        button.textContent = item.label.trim();
        button.addEventListener("click", () => { rendition.display(item.href); closePanels(); });
        li.append(button);
        list.append(li);
        if (depth < 1) add(item.subitems || [], depth + 1);
      });
      add(toc, 0);
      showProgress();
    });

    // Panels: Contents and the text settings
    const panels = [...root.querySelectorAll("[data-reader-panel]")];
    const toggles = [...root.querySelectorAll("[data-reader-toggle]")];
    function closePanels() {
      panels.forEach((p) => { p.hidden = true; });
      toggles.forEach((t) => t.setAttribute("aria-expanded", "false"));
    }
    toggles.forEach((toggle) => toggle.addEventListener("click", () => {
      const panel = root.querySelector(`#${toggle.getAttribute("aria-controls")}`);
      const opening = panel.hidden;
      closePanels();
      if (opening) {
        panel.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        panel.querySelector("button")?.focus();
      }
    }));
    root.querySelectorAll("[data-reader-theme]").forEach((b) => b.addEventListener("click", () => { prefs.theme = b.dataset.readerTheme; apply(); }));
    root.querySelectorAll("[data-reader-font]").forEach((b) => b.addEventListener("click", () => { prefs.font = b.dataset.readerFont; apply(); }));
    root.querySelectorAll("[data-reader-size]").forEach((b) => b.addEventListener("click", () => {
      const i = SIZES.indexOf(prefs.size) + Number(b.dataset.readerSize);
      prefs.size = SIZES[Math.max(0, Math.min(SIZES.length - 1, i < 0 ? 2 : i))];
      apply();
    }));

    // Turning pages: arrows on screen, the arrow keys (also while the book has focus), and a swipe on a tablet
    const prev = () => rendition.prev();
    const next = () => rendition.next();
    $("[data-reader-prev]").addEventListener("click", prev);
    $("[data-reader-next]").addEventListener("click", next);
    const keys = (event) => {
      if (event.key === "Escape") closePanels();
      if (scrolled || event.target.closest?.("input, textarea")) return;
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", keys);
    rendition.on("keyup", keys);
    let touchX = null;
    rendition.on("touchstart", (event) => { touchX = event.changedTouches[0].screenX; });
    rendition.on("touchend", (event) => {
      if (touchX == null || scrolled) return;
      const dx = event.changedTouches[0].screenX - touchX;
      if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
      touchX = null;
    });
    rendition.on("click", closePanels);

    return () => {
      clearTimeout(patience);
      document.removeEventListener("keydown", keys);
      book.destroy();
      release();
    };
  }

  window.BookshelfReader = { open, placeOf };
})();

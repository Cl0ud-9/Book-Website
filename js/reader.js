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

  // shown: settles when the page is on screen (the site's page transition has uncovered it)
  function open(root, library, shown) {
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
    const pages = $("[data-reader-book]");
    const chapter = $("[data-reader-chapter]");
    const percent = $("[data-reader-percent]");
    const bar = $("[data-reader-bar]");
    const scrolled = matchMedia("(max-width: 767px)").matches;
    // Two facing pages when there is room for two comfortable columns, one otherwise
    const spread = !scrolled && innerWidth >= 1100;
    const gsap = matchMedia("(prefers-reduced-motion: reduce)").matches ? null : window.gsap;
    const prefs = { theme: "paper", size: 100, font: "book", ...store.read(PREFS, {}) };
    root.classList.toggle("is--scrolled", scrolled);
    root.classList.toggle("is--spread", spread);
    root.dataset.theme = prefs.theme;

    // While the book opens, its cover waits on the desk, then swings open onto the first page. Both wait until the
    // page is on screen, so neither plays unseen under the page transition.
    const intro = $("[data-reader-intro]");
    const introBook = $("[data-reader-intro-book]");
    const introCover = $("[data-reader-intro-cover]");
    let closed = false;
    let entered = Promise.resolve();
    if (gsap) {
      $("[data-reader-intro-img]").src = `image/covers/${slug}-360.webp`;
      root.classList.add("is--opening");
      entered = Promise.resolve(shown).then(() => new Promise((resolve) => {
        if (closed) return;
        gsap.fromTo(introBook, { y: "2em", scale: 0.92, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: "expo.out" });
        gsap.delayedCall(0.6, resolve);
      }));
    }
    const reveal = () => {
      root.classList.add("is--ready");
      if (!root.classList.contains("is--opening")) return;
      entered.then(() => {
        if (closed) return;
        gsap.timeline({ onComplete: () => root.classList.remove("is--opening") })
          .to(introCover, { rotateY: -165, duration: 1, ease: "power3.inOut" })
          // the open pair is twice as wide, so it slides over to stay in the middle
          .to(introBook, { x: "50%", duration: 1, ease: "power3.inOut" }, 0)
          // and draws in close as the real pages take its place
          .to(introBook, { scale: 1.6, duration: 0.7, ease: "power2.in" }, 0.6)
          .to(intro, { opacity: 0, duration: 0.45, ease: "power2.out" }, 0.75)
          .from(pages, { opacity: 0, y: "1.5em", scale: 0.98, duration: 0.9, ease: "expo.out", clearProps: "transform,opacity" }, 0.75);
      });
    };

    $("[data-reader-title]").textContent = info.title;
    $("[data-reader-author]").textContent = info.author;
    $("[data-reader-back]").href = `book-${slug}.html`;
    $("[data-reader-download]").href = info.epub;
    document.title = `${info.title} | Reading at the Bookshelf`;

    // epub.js adds orientationchange and unload listeners to window and never takes them off, which kept every closed
    // book in memory. While this book is open the first are noted and removed when it closes; unload (deprecated, and
    // only used by epub.js to tidy up, which happens here anyway) is not added at all.
    const leftovers = [];
    const add = window.addEventListener;
    window.addEventListener = function (type, ...rest) {
      if (type === "unload") return undefined;
      if (type === "orientationchange") leftovers.push([type, ...rest]);
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
      : { flow: "paginated", spread: spread ? "always" : "none", width: "100%", height: "100%" });
    Object.entries(THEMES).forEach(([name, rules]) => rendition.themes.register(name, rules));
    // Paginated, epub.js sets the body's padding itself to lay out its columns, so only the scrolled view adds some
    // (room above and below for the bars that float over it)
    rendition.themes.default({
      body: { "line-height": "1.6 !important", transition: "background-color .4s, color .4s", ...(scrolled ? { padding: "4.75em 1.25em 3.75em !important" } : {}) },
      img: { "max-width": "100%" },
    });
    // The site's own Figtree, for the Sans option
    rendition.hooks.content.register((contents) => contents.addStylesheet(new URL(`css/reader-content.css?${window.bookshelfVersion || ""}`, location.href).href));

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
    let tocLinks = [];
    const showProgress = () => {
      if (!current) return;
      const ready = book.locations.length() > 0;
      const p = ready ? book.locations.percentageFromCfi(current.start.cfi) : null;
      percent.textContent = p == null ? "" : `${Math.round(p * 100)}%`;
      bar.style.transform = `scaleX(${p == null ? 0 : p})`;
      const name = chapterOf(current.start.href);
      if (name !== chapter.textContent) {
        chapter.textContent = name;
        // a new chapter's name rises into the footer
        if (gsap && name) gsap.from(chapter, { yPercent: 90, opacity: 0, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
      }
      const file = current.start.href.split("#")[0];
      tocLinks.forEach(([link, href]) => link.setAttribute("aria-current", String(href === file)));
      const places = store.read(PLACES, {});
      places[slug] = { cfi: current.start.cfi, percent: p == null ? (places[slug]?.percent ?? 0) : p, at: Date.now() };
      store.write(PLACES, places);
    };
    rendition.on("relocated", (location) => { current = location; showProgress(); });
    // Each page is shown in a frame of its own, which a screen reader announces by its title
    rendition.on("rendered", (section, view) => view?.iframe?.setAttribute("title", `${info.title}, by ${info.author}`));

    // If the file can't be fetched (offline, or the source is busy), say so and offer the download, rather than wait
    let failed = false;
    const fail = () => {
      if (failed || root.classList.contains("is--ready")) return;
      failed = true;
      root.classList.remove("is--opening");
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
      message.textContent = "";
      reveal();
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
        tocLinks.push([button, item.href.split("#")[0]]);
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
        (panel.querySelector("[aria-current=true]") || panel.querySelector("button"))?.focus();
        if (gsap) {
          gsap.fromTo(panel, { opacity: 0, y: -10, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "expo.out", transformOrigin: "top right", clearProps: "transform,opacity" });
          gsap.from([...panel.querySelectorAll(".reader__toc li, .reader__setting")].slice(0, 14),
            { opacity: 0, y: 8, duration: 0.4, stagger: 0.025, delay: 0.05, ease: "power3.out", clearProps: "transform,opacity" });
        }
      }
    }));
    root.querySelectorAll("[data-reader-theme]").forEach((b) => b.addEventListener("click", () => { prefs.theme = b.dataset.readerTheme; apply(); }));
    root.querySelectorAll("[data-reader-font]").forEach((b) => b.addEventListener("click", () => { prefs.font = b.dataset.readerFont; apply(); }));
    root.querySelectorAll("[data-reader-size]").forEach((b) => b.addEventListener("click", () => {
      const i = SIZES.indexOf(prefs.size) + Number(b.dataset.readerSize);
      prefs.size = SIZES[Math.max(0, Math.min(SIZES.length - 1, i < 0 ? 2 : i))];
      apply();
    }));

    // Turning a page. Two facing pages: a blank leaf lifts, crosses the spine and settles while the words fade over;
    // one page: the words slide on. The page changes when the leaf stands on its edge, once the next one is ready.
    const sheet = $("[data-reader-sheet]");
    let turning = null;
    let queued = 0;
    const flip = (dir, go) => new Promise((resolve) => {
      sheet.classList.toggle("is--prev", dir < 0);
      gsap.set(sheet, { visibility: "visible", rotateY: 0, opacity: 0, "--shade": 0 });
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to(sheet, { opacity: 1, duration: 0.1, ease: "none" })
        .to(view, { opacity: 0, duration: 0.24, ease: "power1.in" }, 0)
        .to(sheet, { rotateY: -90 * dir, "--shade": 1, duration: 0.3, ease: "power2.in" }, 0)
        .add(() => { tl.pause(); Promise.resolve(go()).catch(() => {}).then(() => tl.resume()); })
        .to(sheet, { rotateY: -180 * dir, "--shade": 0, duration: 0.34, ease: "power2.out" })
        .to(view, { opacity: 1, duration: 0.4, ease: "power1.out" }, "<0.06")
        .to(sheet, { opacity: 0, duration: 0.18, ease: "none" }, "-=0.2")
        .set(sheet, { visibility: "hidden" });
      turning = tl;
    });
    const slide = (dir, go) => new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to(view, { x: `${-1.5 * dir}%`, opacity: 0, duration: 0.16, ease: "power2.in" })
        .add(() => { tl.pause(); Promise.resolve(go()).catch(() => {}).then(() => tl.resume()); })
        .fromTo(view, { x: `${1.5 * dir}%` }, { x: 0, opacity: 1, duration: 0.36, ease: "power3.out", immediateRender: false });
      turning = tl;
    });
    const turn = (dir) => {
      const go = () => (dir > 0 ? rendition.next() : rendition.prev());
      if (!gsap || scrolled) return go();
      if (!current || (dir > 0 ? current.atEnd : current.atStart)) return undefined;
      // pressed again mid-turn: this one hurries and the next follows straight on
      if (turning) { queued = dir; turning.timeScale(2.5); return undefined; }
      return (spread ? flip(dir, go) : slide(dir, go)).then(() => {
        turning = null;
        const again = queued;
        queued = 0;
        if (again) turn(again);
      });
    };
    const prev = () => turn(-1);
    const next = () => turn(1);
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
    const panelOpen = () => panels.some((p) => !p.hidden);
    rendition.on("click", (event) => {
      // on a phone a tap on the page brings the bars back, or sends them away
      if (scrolled && !panelOpen() && !event.target.closest?.("a") && !String(event.view?.getSelection?.() || "")) root.classList.toggle("is--immersive");
      closePanels();
    });

    // On a phone the bars slip away while you read down, and come back when you scroll up or reach the top
    let lastY = 0;
    const immersive = (event) => {
      const y = event.target.scrollTop;
      if (typeof y !== "number" || Math.abs(y - lastY) < 8) return;
      root.classList.toggle("is--immersive", y > lastY && y > 120 && !panelOpen());
      lastY = y;
    };
    if (scrolled) view.addEventListener("scroll", immersive, { capture: true, passive: true });
    toggles.forEach((t) => t.addEventListener("click", () => root.classList.remove("is--immersive")));

    return () => {
      closed = true;
      clearTimeout(patience);
      if (gsap) gsap.killTweensOf([intro, introBook, introCover, pages, view, sheet, chapter, ...panels]);
      turning?.kill();
      root.classList.remove("is--opening", "is--immersive");
      view.removeEventListener("scroll", immersive, { capture: true });
      document.removeEventListener("keydown", keys);
      book.destroy();
      release();
    };
  }

  window.BookshelfReader = { open, placeOf };
})();

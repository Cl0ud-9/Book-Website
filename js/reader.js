/* The Bookshelf reader: opens a book's EPUB right in the page with epub.js, and remembers on this device where you
   stopped and how you like to read. app.js loads it, with epub.js and JSZip, only when a book is opened. */
(() => {
  "use strict";

  const PLACES = "bookshelf:reading"; // { slug: { cfi, percent, at, furthest, spine, seen: { chapter2, finished } } }
  const PREFS = "bookshelf:reader"; // { theme, size, font }
  const STATS = "bookshelf:stats"; // { days: { "2026-10-24": seconds }, books: { slug: seconds } }

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
    paper: { page: "#fffdf6", ink: "#1d1b16" },
    sepia: { page: "#f3e9d2", ink: "#3b2f1e" },
    // Title pages and ornaments are black artwork on transparent: turned light so they show on the dark page
    night: { page: "#17161c", ink: "#e4dfd2", more: "a { color: #a9bcff !important; } img.epub-type-contains-word-se-image-color-depth-black-on-transparent { filter: invert(1); }" },
  };
  // The page's colours, in one style element of its own inside each chapter, rewritten when the theme changes. (epub.js's
  // own themes add a stylesheet per theme and never take one out, so going back to a theme already used changed nothing:
  // the one added later still won.)
  const paint = (contents, theme) => {
    const doc = contents?.document;
    if (!doc?.head) return;
    let style = doc.getElementById("bookshelf-theme");
    if (!style) {
      style = doc.createElement("style");
      style.id = "bookshelf-theme";
      doc.head.append(style);
    }
    const { page, ink, more = "" } = THEMES[theme] || THEMES.paper;
    style.textContent = `html, body { background: ${page} !important; color: ${ink} !important; } ${more}`;
  };
  // Serif is Literata (fonts/, made for reading on screens). Most books set no type of their own, so the old "Book"
  // choice showed whatever the device had, Times New Roman on Windows.
  const FONTS = { serif: "Literata, Georgia, serif", classic: "Georgia, 'Times New Roman', serif", sans: "Figtree, system-ui, sans-serif" };
  const SIZES = [80, 90, 100, 110, 120, 135, 150, 170];
  // The edition's own pages (title page, imprint, colophon, licence) are kept apart from the chapters in Contents
  const ABOUT = /(^|\/)(titlepage|halftitlepage|imprint|colophon|uncopyright)\.xhtml$/;
  const BEFORE_STORY = /(^|\/)(titlepage|halftitlepage|imprint|dedication|epigraph|introduction|preface|foreword|toc)\.xhtml$/;

  // Phones (and phones turned sideways) scroll down the book; laptops turn pages, two at a time when there is room
  const layoutNow = () => (matchMedia("(max-width: 767px), (max-height: 500px) and (pointer: coarse)").matches ? "scroll"
    : innerWidth >= 1100 ? "spread" : "single");

  function placeOf(slug) {
    return store.read(PLACES, {})[slug] || null;
  }

  const plain = (text) => text.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").replace(/\s+/g, " ").trim();
  const track = (path, title) => window.bookshelfTrack?.(path, title);

  // shown: settles when the page is on screen (the site's page transition has uncovered it)
  function open(root, library, shown) {
    const $ = (sel) => root.querySelector(sel);
    const params = new URLSearchParams(location.search);
    const slug = params.get("book");
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
    const gsap = matchMedia("(prefers-reduced-motion: reduce)").matches ? null : window.gsap;
    const prefs = { theme: "paper", size: 100, font: "serif", ...store.read(PREFS, {}) };
    if (!FONTS[prefs.font]) prefs.font = "serif";
    let layout = layoutNow();
    const setLayoutClasses = () => {
      root.classList.toggle("is--scrolled", layout === "scroll");
      root.classList.toggle("is--spread", layout === "spread");
    };
    setLayoutClasses();
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
    root.querySelectorAll("[data-reader-download]").forEach((link) => { link.href = info.epub; });
    // Text settings: keep this book for offline reading (js/app.js wires the row)
    const offline = $("[data-offline-row]");
    if (offline) {
      offline.dataset.offlineBook = slug;
      offline.dataset.offlineEpub = info.epub;
      offline.dispatchEvent(new Event("bookshelf:offline-book"));
    }
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

    const book = window.ePub();
    let rendition = null;
    const renditionHooks = []; // run for every rendition, including the new one made when the layout changes

    const apply = () => {
      if (!THEMES[prefs.theme]) prefs.theme = "paper";
      rendition.getContents().forEach((contents) => paint(contents, prefs.theme));
      rendition.themes.fontSize(`${prefs.size}%`);
      rendition.themes.override("font-family", FONTS[prefs.font] || FONTS.serif, true);
      root.dataset.theme = prefs.theme;
      root.querySelectorAll("[data-reader-theme]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readerTheme === prefs.theme)));
      root.querySelectorAll("[data-reader-font]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readerFont === prefs.font)));
      $("[data-reader-size-value]").textContent = `${prefs.size}%`;
      store.write(PREFS, prefs);
      ctx.emit("theme");
    };

    /* ---------- Where you are ---------- */

    // Your saved place moves only when you read. A jump (from Contents, a note or a quote) is a look elsewhere: the
    // place stays put, "Back to …" takes you home, and turning on from the new spot makes it your place.
    let toc = [];
    let current = null;
    let peek = null; // { cfi, label }: where you were before a jump, while you look elsewhere
    let peekMoves = 0;
    let forcedLabel = ""; // the chapter a jump asked for (short end sections cannot reach the top of a scroll)
    let quietUntil = 0; // scrolling until then is the reader's own, after a jump
    const returnButton = $("[data-reader-return]");
    const returnLabel = $("[data-reader-return-label]");

    const chapterOf = (href) => {
      const file = (href || "").split("#")[0];
      let found = null;
      const walk = (items) => items.forEach((item) => { if (item.href.split("#")[0] === file) found = found || item; walk(item.subitems || []); });
      walk(toc);
      return found ? nice(found.label) : "";
    };
    const nice = (label) => {
      // Standard Ebooks names its title pages as one word
      const text = label.trim().replace(/^(half)?title ?page$/i, (_, half) => (half ? "Half title page" : "Title page"));
      return !info.verse && /^([IVXLCDM]+|\d+)\.?$/.test(text) ? `Chapter ${text.replace(/\.$/, "")}` : text;
    };
    const percentOf = (cfi) => (book.locations.length() > 0 ? book.locations.percentageFromCfi(cfi) : null);
    // Showing a place. When scrolling, epub.js loads the next chapter only as you scroll near the end of what it has
    // loaded; a jump can leave you at that very end, where you cannot scroll, so the next chapter never came and the
    // book stopped. It is asked to check again while the chapter settles (its height changes as it lays out).
    let nudges = [];
    const nudge = () => {
      nudges.forEach(clearTimeout);
      nudges = layout === "scroll" ? [150, 600, 1200, 2500].map((ms) => setTimeout(() => !closed && rendition?.manager?.check?.(), ms)) : [];
    };
    const show = (target) => rendition.display(target).then((result) => { nudge(); return result; });

    const save = (location) => {
      const places = store.read(PLACES, {});
      const before = places[slug] || {};
      const p = percentOf(location.start.cfi);
      const place = {
        ...before,
        cfi: location.start.cfi,
        percent: p == null ? (before.percent ?? 0) : p,
        at: Date.now(),
        furthest: Math.max(before.furthest ?? 0, p ?? 0),
        spine: Math.max(before.spine ?? -1, location.start.index ?? -1),
      };
      // For the book of the month: how many people get past the first chapter, and to the end (once per device)
      const seen = { ...(before.seen || {}) };
      if (!seen.chapter2 && firstStory >= 0 && location.start.index > firstStory) { seen.chapter2 = true; track(`read/chapter-2/${slug}`, info.title); }
      if (!seen.finished && (location.atEnd || (p ?? 0) >= 0.98)) { seen.finished = true; place.done = Date.now(); track(`read/finished/${slug}`, info.title); }
      place.seen = seen;
      places[slug] = place;
      store.write(PLACES, places);
      window.dispatchEvent(new Event("bookshelf:changed")); // js/account.js keeps it in your account, if you have one
      markRead(place.spine);
    };

    const showProgress = () => {
      if (!current) return;
      const p = percentOf(current.start.cfi);
      percent.textContent = p == null ? "" : `${Math.round(p * 100)}%`;
      bar.style.transform = `scaleX(${p == null ? 0 : p})`;
      const name = forcedLabel || chapterOf(current.start.href);
      if (name !== chapter.textContent) {
        chapter.textContent = name;
        // a new chapter's name rises into the footer
        if (gsap && name) gsap.from(chapter, { yPercent: 90, opacity: 0, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
      }
      markCurrent(current.start.href);
      if (!peek) save(current);
    };

    const showReturn = () => {
      returnButton.hidden = !peek;
      if (peek) returnLabel.textContent = peek.label || "where you were";
    };
    // Reading on from where a jump landed (two page turns, or two screens of scrolling) makes it your place
    const readOn = () => {
      forcedLabel = "";
      if (!peek || ++peekMoves < 2) return;
      peek = null;
      showReturn();
      if (current) save(current);
    };
    const jumpTo = (target, label = "") => {
      if (!peek && current) {
        peek = { cfi: current.start.cfi, label: forcedLabel || chapterOf(current.start.href) };
        peekMoves = 0;
      }
      forcedLabel = label;
      quietUntil = performance.now() + 1500;
      root.classList.remove("is--immersive");
      showReturn();
      return show(target);
    };
    returnButton.addEventListener("click", () => {
      if (!peek) return;
      const { cfi } = peek;
      peek = null;
      forcedLabel = "";
      quietUntil = performance.now() + 1500;
      showReturn();
      show(cfi);
    });

    /* ---------- The rendition: made again when the layout changes (a window narrowed, a tablet turned) ---------- */

    const makeRendition = () => {
      const scrolled = layout === "scroll";
      rendition = book.renderTo(view, scrolled
        ? { manager: "continuous", flow: "scrolled", width: "100%", height: "100%" }
        : { flow: "paginated", spread: layout === "spread" ? "always" : "none", width: "100%", height: "100%" });
      rendition.hooks.content.register((contents) => paint(contents, prefs.theme));
      // Paginated, epub.js sets the body's padding itself to lay out its columns, so only the scrolled view adds some
      // (room above and below for the bars that float over it)
      rendition.themes.default({
        body: { "line-height": "1.6 !important", transition: "background-color .4s, color .4s", ...(scrolled ? { padding: "4.75em 1.25em 3.75em !important" } : {}) },
        img: { "max-width": "100%" },
      });
      // The site's own Figtree, for the Sans option
      rendition.hooks.content.register((contents) => contents.addStylesheet(new URL(`css/reader-content.css?${window.bookshelfVersion || ""}`, location.href).href));
      rendition.on("relocated", (location) => { current = location; lastActive = Date.now(); showProgress(); ctx.emit("relocated", location); });
      // Each page is shown in a frame of its own, which a screen reader announces by its title
      rendition.on("rendered", (section, v) => { v?.iframe?.setAttribute("title", `${info.title}, by ${info.author}`); nudge(); });
      rendition.on("keyup", keys);
      rendition.on("touchstart", (event) => { touchX = event.changedTouches[0].screenX; });
      rendition.on("touchend", (event) => {
        if (touchX == null || layout === "scroll") return;
        const dx = event.changedTouches[0].screenX - touchX;
        if (Math.abs(dx) > 50 && !ctx.selecting()) (dx < 0 ? next : prev)();
        touchX = null;
      });
      rendition.on("click", (event) => {
        // on a phone a tap on the page brings the bars back, or sends them away; not a tap on a highlight (which opens
        // it, and is told a moment after the tap) or one that puts away the highlight bar
        const wasSelecting = ctx.selecting();
        if (layout === "scroll" && !panelOpen() && !event.target.closest?.("a") && !String(event.view?.getSelection?.() || "")) {
          setTimeout(() => { if (!wasSelecting && !ctx.selecting() && !closed) root.classList.toggle("is--immersive"); }, 0);
        }
        closePanels();
      });
      renditionHooks.forEach((hook) => hook(rendition));
      apply();
      return rendition;
    };

    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const wanted = layoutNow();
        if (wanted === layout || !rendition || !current || closed) return;
        const at = current.start.cfi;
        layout = wanted;
        turning?.kill();
        turning = null;
        gsap?.set([view, sheet], { clearProps: "transform,opacity,visibility" });
        rendition.destroy();
        view.innerHTML = "";
        setLayoutClasses();
        root.classList.remove("is--immersive");
        makeRendition();
        quietUntil = performance.now() + 1500;
        show(at);
      }, 250);
    };
    window.addEventListener("resize", onResize);

    // If the file can't be fetched (offline, or the source is busy), say so and offer the download, rather than wait
    let failed = false;
    const fail = () => {
      if (failed || root.classList.contains("is--ready")) return;
      failed = true;
      root.classList.remove("is--opening");
      message.innerHTML = "";
      message.append(navigator.onLine === false ? "You’re offline, and this book isn’t saved on this device. " : "This book wouldn’t open here. ");
      const link = document.createElement("a");
      link.href = info.epub;
      link.setAttribute("download", "");
      link.textContent = "Download it instead";
      message.append(link, ".");
    };
    // The file is fetched here rather than by epub.js, which never reports a failed download
    fetch(info.epub)
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); })
      .then((data) => book.open(data, "binary"))
      .catch(fail);
    const patience = setTimeout(fail, 30000);
    track(`read/open/${slug}`, info.title);

    /* ---------- Contents ---------- */

    const list = $("[data-reader-toc-list]");
    const aboutBox = $("[data-reader-toc-about]");
    const aboutList = $("[data-reader-toc-about-list]");
    const find = $("[data-reader-toc-find]");
    const search = $("[data-reader-toc-search]");
    const empty = $("[data-reader-toc-empty]");
    let tocLinks = []; // [button, file, spine index, li]
    let firstStory = -1; // the spine index of the first chapter of the story itself
    const spineIndex = (href) => book.spine.get(href.split("#")[0])?.index ?? -1;
    const markCurrent = (href) => {
      const file = (href || "").split("#")[0];
      let marked = false;
      tocLinks.forEach(([link, f]) => {
        const on = !marked && f === file;
        if (on) marked = true;
        link.setAttribute("aria-current", String(on));
      });
    };
    const markRead = (furthest) => tocLinks.forEach(([link, , index]) => link.classList.toggle("is--read", index >= 0 && index < furthest));

    book.loaded.navigation.then((nav) => {
      toc = nav.toc;
      list.innerHTML = "";
      aboutList.innerHTML = "";
      tocLinks = [];
      const add = (items, depth, into) => items.forEach((item) => {
        const file = item.href.split("#")[0];
        // a part's heading often points at its half-title page, but it holds chapters, so it stays with them
        const target = depth === 0 && ABOUT.test(file) && !item.subitems?.length ? aboutList : into;
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "reader__toc-link";
        button.style.setProperty("--depth", depth);
        const label = nice(item.label);
        button.textContent = label;
        button.dataset.find = plain(label);
        button.addEventListener("click", () => { jumpTo(item.href, label); closePanels(); });
        const index = spineIndex(item.href);
        if (firstStory < 0 && !ABOUT.test(file) && !BEFORE_STORY.test(file)) firstStory = index;
        tocLinks.push([button, file, index, li]);
        li.append(button);
        target.append(li);
        if (item.subitems?.length) {
          const sub = document.createElement("ol");
          sub.className = "reader__toc";
          li.append(sub);
          add(item.subitems, depth + 1, sub);
        }
      });
      add(toc, 0, list);
      aboutBox.hidden = aboutList.children.length === 0;
      find.hidden = tocLinks.length < 25;
      markRead(placeOf(slug)?.spine ?? -1);
      if (current) showProgress();
    });
    // Long books: type part of a chapter's name
    search.addEventListener("input", () => {
      const words = plain(search.value).split(" ").filter(Boolean);
      const hits = new Set(tocLinks.filter(([link]) => words.every((w) => link.dataset.find.includes(w))).map(([link]) => link));
      tocLinks.forEach(([link, , , li]) => {
        // a part stays in view, dimmed, when one of its chapters matches
        const inside = [...li.querySelectorAll(".reader__toc-link")].some((b) => hits.has(b));
        li.hidden = !inside;
        link.classList.toggle("is--dim", inside && !hits.has(link));
      });
      empty.hidden = hits.size > 0;
    });

    /* ---------- Panels: Contents, Text and any added by plug-ins ---------- */

    const panels = () => [...root.querySelectorAll("[data-reader-panel]")];
    const toggles = () => [...root.querySelectorAll("[data-reader-toggle]")];
    function closePanels() {
      panels().forEach((p) => { p.hidden = true; });
      toggles().forEach((t) => t.setAttribute("aria-expanded", "false"));
    }
    const panelOpen = () => panels().some((p) => !p.hidden);
    root.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-reader-toggle]");
      if (!toggle) return;
      const panel = root.querySelector(`#${toggle.getAttribute("aria-controls")}`);
      const opening = panel.hidden;
      closePanels();
      root.classList.remove("is--immersive");
      if (!opening) return;
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      ctx.emit("panel", panel.id);
      const here = panel.querySelector("[aria-current=true]");
      here?.scrollIntoView({ block: "center" });
      (here || panel.querySelector(".reader__toc-link, button"))?.focus({ preventScroll: true });
      if (gsap) {
        gsap.fromTo(panel, { opacity: 0, y: -10, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "expo.out", transformOrigin: "top right", clearProps: "transform,opacity" });
        gsap.from([...panel.querySelectorAll(":scope > .reader__toc > li, .reader__setting, .reader__note")].slice(0, 14),
          { opacity: 0, y: 8, duration: 0.4, stagger: 0.025, delay: 0.05, ease: "power3.out", clearProps: "transform,opacity" });
      }
    });
    root.querySelectorAll("[data-reader-theme]").forEach((b) => b.addEventListener("click", () => { prefs.theme = b.dataset.readerTheme; apply(); }));
    root.querySelectorAll("[data-reader-font]").forEach((b) => b.addEventListener("click", () => { prefs.font = b.dataset.readerFont; apply(); }));
    root.querySelectorAll("[data-reader-size]").forEach((b) => b.addEventListener("click", () => {
      const i = SIZES.indexOf(prefs.size) + Number(b.dataset.readerSize);
      prefs.size = SIZES[Math.max(0, Math.min(SIZES.length - 1, i < 0 ? 2 : i))];
      apply();
    }));

    /* ---------- Turning pages ---------- */

    // Two facing pages: a blank leaf lifts, crosses the spine and settles while the words fade over; one page: the
    // words slide on. The page changes when the leaf stands on its edge, once the next one is ready.
    const sheet = $("[data-reader-sheet]");
    let turning = null;
    let queued = 0;
    let touchX = null;
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
      if (!rendition || layout === "scroll") return undefined;
      readOn();
      if (!gsap) return go();
      if (!current || (dir > 0 ? current.atEnd : current.atStart)) return undefined;
      // pressed again mid-turn: this one hurries and the next follows straight on
      if (turning) { queued = dir; turning.timeScale(2.5); return undefined; }
      return (layout === "spread" ? flip(dir, go) : slide(dir, go)).then(() => {
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
    function keys(event) {
      if (event.key === "Escape") { closePanels(); ctx.emit("escape"); }
      if (layout === "scroll" || event.target.closest?.("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", keys);

    // On a phone the bars slip away while you read down, and come back when you scroll up or reach the top. Scrolling
    // the reader does itself (after a jump) does not count.
    let lastY = 0;
    let scrolledSinceJump = 0;
    const immersive = (event) => {
      const y = event.target.scrollTop;
      if (typeof y !== "number") return;
      if (performance.now() < quietUntil) { lastY = y; return; }
      if (peek) {
        scrolledSinceJump += Math.abs(y - lastY);
        if (scrolledSinceJump > innerHeight * 2) { scrolledSinceJump = 0; peekMoves = 1; readOn(); }
      }
      if (Math.abs(y - lastY) < 8) return;
      forcedLabel = "";
      root.classList.toggle("is--immersive", y > lastY && y > 120 && !panelOpen() && !peek);
      lastY = y;
    };
    view.addEventListener("scroll", immersive, { capture: true, passive: true });

    /* ---------- Time spent reading, for Your reading ---------- */

    // A five-second tick counts while the page is showing and you have turned, scrolled, tapped or typed in the last
    // two minutes, so a book left open on the desk does not count. Kept by day and by book, on this device only.
    let lastActive = Date.now();
    let unsaved = 0;
    const active = () => { lastActive = Date.now(); };
    const saveTime = () => {
      if (!unsaved) return;
      const stats = store.read(STATS, {});
      const day = new Date();
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      stats.days = { ...(stats.days || {}), [key]: (stats.days?.[key] || 0) + unsaved };
      stats.books = { ...(stats.books || {}), [slug]: (stats.books?.[slug] || 0) + unsaved };
      store.write(STATS, stats);
      unsaved = 0;
    };
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastActive > 120000 || !root.classList.contains("is--ready")) return;
      unsaved += 5;
      if (unsaved >= 30) saveTime();
    }, 5000);
    ["keydown", "pointerdown", "wheel", "touchstart"].forEach((type) => root.addEventListener(type, active, { passive: true }));
    view.addEventListener("scroll", active, { capture: true, passive: true });
    document.addEventListener("visibilitychange", saveTime);

    /* ---------- What plug-ins (notes, word look-up) can use ---------- */

    const listeners = {};
    const ctx = {
      root, slug, info, book, gsap,
      get rendition() { return rendition; },
      get layout() { return layout; },
      get theme() { return prefs.theme; },
      get current() { return current; },
      chapterOf, jumpTo, closePanels,
      onRendition(hook) { renditionHooks.push(hook); if (rendition) hook(rendition); },
      on(name, fn) { (listeners[name] ||= []).push(fn); },
      emit(name, ...args) { (listeners[name] || []).forEach((fn) => fn(...args)); },
      selecting: () => false,
    };
    const plugins = (window.BookshelfReaderPlugins || []).map((plugin) => plugin(ctx)).filter(Boolean);

    makeRendition();
    // Opened from a quote or a note (?at=<words>&in=<chapter file>, ?note=<id>): the notes plug-in looks for it once the
    // book is showing
    const saved = placeOf(slug);
    const first = saved?.cfi || undefined;
    show(first).then(() => {
      clearTimeout(patience);
      if (failed) return;
      message.textContent = "";
      reveal();
      ctx.emit("ready", params);
    }).catch(fail);
    // Percentages need the whole book measured once, which can take a moment for a long one
    book.ready.then(() => book.locations.generate(1600)).then(showProgress).catch(() => {});

    return () => {
      closed = true;
      nudges.forEach(clearTimeout);
      clearTimeout(patience);
      clearTimeout(resizeTimer);
      plugins.forEach((undo) => typeof undo === "function" && undo());
      if (gsap) gsap.killTweensOf([intro, introBook, introCover, pages, view, sheet, chapter, ...panels()]);
      turning?.kill();
      root.classList.remove("is--opening", "is--immersive");
      clearInterval(tick);
      saveTime();
      ["keydown", "pointerdown", "wheel", "touchstart"].forEach((type) => root.removeEventListener(type, active));
      view.removeEventListener("scroll", active, { capture: true });
      document.removeEventListener("visibilitychange", saveTime);
      view.removeEventListener("scroll", immersive, { capture: true });
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", keys);
      book.destroy();
      release();
    };
  }

  window.BookshelfReader = { open, placeOf };
})();

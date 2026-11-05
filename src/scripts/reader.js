/* The Bookshelf reader: opens a book's EPUB right in the page with epub.js, and remembers on this device where you
   stopped and how you like to read. app.js loads it, with epub.js and JSZip, only when a book is opened. */
// the styles the reader adds inside each chapter (its fonts among them), built and fingerprinted with the site
import readerContentCss from "../styles/reader-content.css?url";

(() => {
  "use strict";

  const PLACES = "bookshelf:reading"; // { slug: { cfi, percent, at, furthest, spine, seen: { chapter2, finished } } }
  const PREFS = "bookshelf:reader"; // { theme, size, font, spacing, flow, at }
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
    paper: { page: "#fffdf6", ink: "#1d1b16", accent: "#a3361b" },
    sepia: { page: "#f3e9d2", ink: "#3b2f1e", accent: "#8f3514" },
    night: { page: "#17161c", ink: "#e4dfd2", accent: "#e8b86e" },
  };
  // The page's colours, in one style element of its own inside each chapter, rewritten when the theme changes. (epub.js's
  // own themes add a stylesheet per theme and never take one out, so going back to a theme already used changed nothing:
  // the one added later still won.)
  const SPACING = { compact: 1.45, normal: 1.6, airy: 1.85 };
  const paint = (contents, prefs) => {
    const doc = contents?.document;
    if (!doc?.head) return;
    let style = doc.getElementById("bookshelf-theme");
    if (!style) {
      style = doc.createElement("style");
      style.id = "bookshelf-theme";
      doc.head.append(style);
    }
    const { page, ink, accent } = THEMES[prefs.theme] || THEMES.paper;
    const lines = SPACING[prefs.spacing] || SPACING.normal;
    // Standard Ebooks' drawings are black on transparent, and its own stylesheet turns them light whenever the phone or
    // computer is in dark mode, whatever page is chosen here: white on the Paper page, or turned back to black on the
    // Night page (inverted twice). They follow the page instead: as drawn on a light page; on the Night page, line
    // drawings turned light, and engravings (which look wrong inverted) on a light card.
    const art = "img.epub-type-contains-word-se-image-color-depth-black-on-transparent";
    const drawings = prefs.theme === "night"
      ? `${art} { filter: invert(1) !important; background: transparent !important; }
         ${art}.epub-type-contains-word-se-image-style-realistic { filter: none !important; background: ${ink} !important; border-radius: .3em; }`
      : `${art} { filter: none !important; background: transparent !important; }`;
    // and the book's frame says which colours it is meant to have, so a browser set to darken pages (Chrome on Android
    // can) leaves the Paper page alone: darkened, its colours and drawings were muddied
    const scheme = prefs.theme === "night" ? "dark" : "only light";
    style.textContent = `:root { color-scheme: ${scheme}; --bookshelf-accent: ${accent}; } html, body { background: ${page} !important; color: ${ink} !important; } body, p, li, blockquote, td { line-height: ${lines} !important; } ${drawings}`;
  };
  // Serif is Literata (fonts/, made for reading on screens). Most books set no type of their own, so the old "Book"
  // choice showed whatever the device had, Times New Roman on Windows.
  const FONTS = { serif: "Literata, Georgia, serif", classic: "Georgia, 'Times New Roman', serif", sans: "Figtree, system-ui, sans-serif" };
  const SIZES = [80, 90, 100, 110, 120, 135, 150, 170];
  // The edition's own pages (title page, imprint, colophon, licence) are kept apart from the chapters in Contents
  const ABOUT = /(^|\/)(titlepage|halftitlepage|imprint|colophon|uncopyright)\.xhtml$/;
  const BEFORE_THE_STORY = /(^|\/)(dedication|epigraph|halftitlepage)(-\d+)?\.xhtml$/;
  const BEFORE_STORY = /(^|\/)(titlepage|halftitlepage|imprint|dedication|epigraph|introduction|preface|foreword|toc)\.xhtml$/;

  // Laptops turn pages, two at a time when there is room. Phones (and phones turned sideways) scroll down the book, or,
  // if you choose Pages in Text settings, turn one page at a time with a tap or a swipe.
  const phoneNow = () => matchMedia("(max-width: 767px), (max-height: 500px) and (pointer: coarse)").matches;
  const layoutNow = (flow) => (phoneNow() ? (flow === "pages" ? "single" : "scroll") : innerWidth >= 1100 ? "spread" : "single");

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
    if (window.BookshelfKids?.allows(info.age) === false) {
      root.classList.add("is--missing");
      root.classList.remove("is--opening", "is--early");
      message.textContent = "This one’s for older readers. Kids mode is on, so it’s put away for now.";
      return () => {};
    }

    const view = $("[data-reader-view]");
    const pages = $("[data-reader-book]");
    const chapter = $("[data-reader-chapter]");
    const percent = $("[data-reader-percent]");
    const bar = $("[data-reader-bar]");
    const gsap = matchMedia("(prefers-reduced-motion: reduce)").matches ? null : window.gsap;
    const prefs = { theme: "paper", size: 100, font: "serif", spacing: "normal", flow: "scroll", ...store.read(PREFS, {}) };
    if (!FONTS[prefs.font]) prefs.font = "serif";
    let layout = layoutNow(prefs.flow);
    const setLayoutClasses = () => {
      root.classList.toggle("is--scrolled", layout === "scroll");
      root.classList.toggle("is--spread", layout === "spread");
      // a phone turning pages: the whole screen is the page, the bars float over it, and taps and swipes turn it
      root.classList.toggle("is--phone-pages", layout === "single" && phoneNow());
      root.querySelectorAll("[data-reader-flow]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readerFlow === (layout === "scroll" ? "scroll" : "pages"))));
      const flowRow = $("[data-reader-flow-row]");
      if (flowRow) flowRow.hidden = !phoneNow();
    };
    setLayoutClasses();
    root.dataset.theme = prefs.theme;

    // While the book opens, its cover waits on the desk, then swings open onto the first page. Both wait until the
    // page is on screen, so neither plays unseen under the page transition.
    const intro = $("[data-reader-intro]");
    const introBook = $("[data-reader-intro-book]");
    const introCover = $("[data-reader-intro-cover]");
    let closed = false;
    // A browser set to darken pages (Chrome on Android can) leaves a page alone that says it has colours of its own, and the
    // site's pages say so. But a frame's saying so (paint, above) only counts if the document around it does not say so too
    // on its root and the <iframe> element does not inherit it: measured on a phone, either one had every book darkened,
    // whatever page colour was chosen. So while a book is open the page says it on <body> (main.css), not on its root.
    const lightOnly = document.querySelector('meta[name="color-scheme"]');
    lightOnly?.remove();
    let entered = Promise.resolve();
    // (Opened straight from its address, the page shows the closed book already, is--early: read.astro)
    const early = root.classList.contains("is--early");
    if (gsap) {
      // (set again, the same picture counted as drawn anew, seconds later, as the page's largest)
      const introImg = $("[data-reader-intro-img]");
      if (!early) introImg.src = `image/covers/${slug}-360.webp`;
      root.classList.add("is--opening");
      entered = Promise.resolve(shown).then(() => new Promise((resolve) => {
        if (closed) return;
        if (!early) gsap.fromTo(introBook, { y: "2em", scale: 0.92, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: "expo.out" });
        gsap.delayedCall(early ? 0.3 : 0.6, resolve);
      }));
    } else root.classList.remove("is--opening", "is--early");
    // The pages are shown once they hold still: their fonts in, and, scrolling, the chapters epub.js adds above them
    // settled. Shown sooner, a slow phone saw them move (a late font reflowed the words, a chapter added above pushed
    // them down). The closed book waits on the desk meanwhile, a second and a half at most.
    const steady = () => {
      const until = performance.now() + 1500;
      const fonts = [document.fonts?.ready, ...[...view.querySelectorAll("iframe")].map((frame) => frame.contentDocument?.fonts?.ready)];
      return Promise.race([Promise.all(fonts), new Promise((resolve) => setTimeout(resolve, 1500))]).then(() => new Promise((resolve) => {
        let last = "";
        let same = 0;
        const check = () => {
          const now = [rendition?.manager?.container?.scrollTop, view.querySelector("iframe")?.offsetHeight].join();
          same = now === last ? same + 1 : 0;
          last = now;
          if (closed || same >= 3 || performance.now() > until) resolve();
          else setTimeout(check, 100);
        };
        check();
      }));
    };
    const reveal = () => {
      root.classList.add("is--ready");
      if (!root.classList.contains("is--opening")) return;
      Promise.all([entered, steady()]).then(() => {
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
    $("[data-reader-back]").href = `book-${slug}`;
    root.querySelectorAll("[data-reader-download]").forEach((link) => { link.href = info.epub; });
    // Text settings: keep this book for offline reading (app.js wires the row)
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
      rendition.getContents().forEach((contents) => paint(contents, prefs));
      rendition.themes.fontSize(`${prefs.size}%`);
      rendition.themes.override("font-family", FONTS[prefs.font] || FONTS.serif, true);
      root.dataset.theme = prefs.theme;
      root.querySelectorAll("[data-reader-theme]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readerTheme === prefs.theme)));
      root.querySelectorAll("[data-reader-font]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readerFont === prefs.font)));
      root.querySelectorAll("[data-reader-spacing]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readerSpacing === (prefs.spacing || "normal"))));
      mirrorKey = ""; // the page's look changed: the copies a turn lifts are made again
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
    let opened; // the place the book opened at (none: its beginning)
    let peekMoves = 0;
    let scrolledSinceJump = 0;
    // when you last touched, scrolled or pressed a key in the reader: scrolling soon after is yours (a fling glides on
    // for a moment); epub.js scrolls by itself too, when it adds a chapter above the one on screen
    let handledAt = 0;
    let scrolledAt = 0; // when you last scrolled yourself (a wheel, a finger moving, a key)
    let ownScrollAt = 0; // when epub.js last scrolled the book itself
    const handled = (event) => {
      handledAt = performance.now();
      if (event && event.type !== "pointerdown" && event.type !== "touchstart") scrolledAt = handledAt;
    };
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
      // a chapter it adds above the one on screen moves the scroll by its height: that is not you reading on
      const check = async () => {
        if (closed) return;
        quietUntil = Math.max(quietUntil, performance.now() + 500);
        await rendition?.manager?.check?.();
        quietUntil = Math.max(quietUntil, performance.now() + 300);
      };
      nudges = layout === "scroll" ? [150, 600, 1200, 2500].map((ms) => setTimeout(check, ms)) : [];
    };
    // A chapter's words reflow after it is shown: epub.js gives it the reader's type, size and spacing only then, and
    // its fonts load after that; changing them reflows it again. A place found before (a saved place, a note, the end
    // of the chapter you go back into) is then on another page, so it is found again once the chapter has settled.
    const styled = new WeakSet(); // frames that have the reader's styles (rendition "rendered")
    const moment = () => new Promise((resolve) => setTimeout(resolve, 30));
    const settle = async () => {
      const frame = view.querySelector("iframe");
      if (!frame || layout === "scroll") return;
      const until = performance.now() + 2500;
      while (!styled.has(frame) && performance.now() < until && !closed) await moment();
      await Promise.race([frame.contentDocument?.fonts?.ready, new Promise((resolve) => setTimeout(resolve, 1200))]);
      // epub.js misses some of that growing (its frame stayed narrower than its words, and the last pages could not
      // be reached until a turn woke it), so the chapter is measured again until it holds still
      const measure = () => rendition?.manager?.views?.all?.().forEach((v) => v.expand?.());
      measure();
      let width = frame.offsetWidth;
      let still = 0;
      while (still < 5 && performance.now() < until && !closed) {
        await moment();
        measure();
        still = frame.offsetWidth === width ? still + 1 : 0;
        width = frame.offsetWidth;
      }
    };
    // moves the book, without a turn, so its left edge is at x in the chapter
    const scrollTo = async (x) => {
      const box = rendition?.manager?.container;
      if (closed || !box || Math.abs(box.scrollLeft - x) < 2) return;
      box.scrollLeft = x;
      await rendition.reportLocation();
    };
    // epub.js finds the page a place is on from where the place lies, and a place at the very top of a page (often the
    // space before its first word, which takes no room there) lies at the end of the line before it too, on the page
    // before; you came back a page early. The first letter from the place says which page it is on.
    const exactly = async (target) => {
      if (closed || layout === "scroll" || typeof target !== "string" || !target.startsWith("epubcfi(")) return;
      const contents = rendition.getContents()[0];
      let range = null;
      try { range = contents?.range(target); } catch { range = null; }
      if (!range) return;
      const walker = contents.document.createTreeWalker(contents.document.body, NodeFilter.SHOW_TEXT);
      let text = range.startContainer;
      let from = range.startOffset;
      if (text.nodeType !== 3) {
        walker.currentNode = text.childNodes[from] || text;
        text = walker.currentNode.nodeType === 3 ? walker.currentNode : walker.nextNode();
        from = 0;
      } else walker.currentNode = text;
      let found = -1;
      for (let tries = 0; text && tries < 30; tries += 1) {
        found = text.data.slice(from).search(/\S/);
        if (found >= 0) break;
        text = walker.nextNode();
        from = 0;
      }
      if (!text || found < 0) return;
      const letter = contents.document.createRange();
      letter.setStart(text, from + found);
      letter.setEnd(text, from + found + 1);
      const at = [...letter.getClientRects()].find((r) => r.width > 0);
      const width = rendition.manager?.container?.clientWidth;
      if (!at || !width) return;
      await scrollTo(Math.floor((at.left + at.width / 2) / width) * width);
    };
    // Scrolling, epub.js adds the chapters above the place it shows and scrolls on by their height to keep the place
    // still, but counts some of it twice as they lay out: a book opened at its first chapter showed it some way down.
    // For a few seconds after a place is shown, until you touch or scroll, it is put back at the top of the screen.
    const placeTop = (target) => {
      const [file, hash] = String(target).split("#");
      for (const contents of rendition.getContents()) {
        const frame = contents.document?.defaultView?.frameElement;
        if (!frame) continue;
        let rect = null;
        if (String(target).startsWith("epubcfi(")) {
          try { rect = contents.range(target)?.getBoundingClientRect(); } catch { rect = null; }
          if (rect && !rect.height && !rect.width) rect = null;
        } else if (contents.sectionIndex === spineIndex(file)) {
          rect = hash ? contents.document.getElementById(decodeURIComponent(hash))?.getBoundingClientRect() : { top: 0 };
        }
        if (rect) return { top: frame.getBoundingClientRect().top + rect.top, start: !hash && !String(target).startsWith("epubcfi(") };
      }
      return null;
    };
    const alignScroll = (target, since) => {
      const box = rendition?.manager?.container;
      if (closed || layout !== "scroll" || !box || handledAt > since || target == null) return;
      const at = placeTop(target);
      if (!at) return;
      // a chapter's start goes to the top (its own margin leaves room for the bar), a pixel past the end of the one
      // before, which epub.js otherwise still counted as on screen (the footer named it); a place inside one, below the bar
      const gap = at.start ? -1 : ($(".reader__bar")?.offsetHeight || 0) + 8;
      const delta = at.top - box.getBoundingClientRect().top - gap;
      if (Math.abs(delta) < (at.start ? 0.5 : 3)) return;
      quietUntil = Math.max(quietUntil, performance.now() + 400);
      box.scrollTop += delta;
    };
    const show = (target) => {
      const before = view.querySelector("iframe");
      const since = performance.now();
      return rendition.display(target).then(async (result) => {
        const frame = view.querySelector("iframe");
        if (layout !== "scroll" && (frame !== before || !styled.has(frame))) {
          await settle();
          if (!closed) await rendition.display(target);
        }
        nudge();
        if (layout === "scroll") [0, 150, 450, 900, 1600, 2600].forEach((ms) => setTimeout(() => alignScroll(target, since), ms));
        return result;
      });
    };
    // where you are, held while the page you are on reflows (the type changed)
    const holdPlace = async () => {
      const at = current?.start?.cfi;
      if (!at || layout === "scroll") return;
      await moment();
      await settle();
      if (closed || !rendition) return;
      await rendition.display(at);
    };
    // the last page of the chapter on screen, once it has settled (going back into it)
    const end = async () => {
      const box = rendition?.manager?.container;
      const frame = view.querySelector("iframe");
      if (!closed && box && frame) await scrollTo(Math.max(0, frame.offsetWidth - box.clientWidth));
    };
    const toEnd = async () => {
      await settle();
      await end();
      hold(end);
    };
    // The words can still move a little once the chapter holds its size (a font for italics coming in), so a place
    // just found is looked for again a few times over the next seconds, until you turn a page.
    let moves = 0; // pages turned, so far
    let holds = [];
    const hold = (find) => {
      holds.forEach(clearTimeout);
      const at = moves;
      holds = [300, 800, 1600, 3000].map((ms) => setTimeout(() => { if (!closed && moves === at) find(); }, ms));
    };

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
      window.dispatchEvent(new Event("bookshelf:changed")); // account.js keeps it in your account, if you have one
      markRead(place.spine);
    };

    // Time left in the chapter: the share of the book's locations between here and the next chapter, at the book's
    // reading time
    const leftLabel = $("[data-reader-left]");
    let chapterStarts = null; // spine index -> its first location
    let measured = false; // the book's locations are all counted (they come in bit by bit)
    // the chapter you are in: its minutes of reading, and the share of it still to read
    const chapterNow = () => {
      const all = book.locations?._locations;
      if (!measured || !all?.length || !current || !info.minutes) return null;
      if (!chapterStarts) {
        chapterStarts = new Map();
        all.forEach((cfi, i) => {
          const step = Number(/^epubcfi\(\/6\/(\d+)/.exec(cfi)?.[1]);
          const index = step / 2 - 1;
          if (Number.isFinite(index) && !chapterStarts.has(index)) chapterStarts.set(index, i);
        });
      }
      // the chapter's share of the book, from its locations; how far into it, from the page you are on (finer than a
      // location, about a minute of reading)
      const startsAt = chapterStarts.get(current.start.index) ?? book.locations.locationFromCfi(current.start.cfi);
      const ends = [...chapterStarts.entries()].filter(([index]) => index > current.start.index).map(([, i]) => i);
      const end = ends.length ? Math.min(...ends) : all.length;
      if (startsAt == null || startsAt < 0 || end <= startsAt) return null;
      const page = /(\d+)(?:–(\d+))? of (\d+)/.exec(pageOf());
      const left = page ? Math.max(0, Number(page[3]) - Number(page[2] || page[1])) / Number(page[3])
        : Math.max(0, end - book.locations.locationFromCfi(current.start.cfi)) / (end - startsAt);
      return { minutes: ((end - startsAt) / all.length) * info.minutes, left };
    };
    // minutes of reading in each chapter (by its first spine index), once the book is measured
    const chapterMinutes = () => {
      const all = book.locations?._locations;
      if (!measured || !all?.length || !info.minutes || !chapterStarts) return new Map();
      const starts = [...chapterStarts.entries()].sort((a, b) => a[1] - b[1]);
      return new Map(starts.map(([index, at], i) => [index, (((starts[i + 1]?.[1] ?? all.length) - at) / all.length) * info.minutes]));
    };
    const timeLeft = () => {
      const here = chapterNow();
      if (!here) return "";
      const { left } = here;
      const minutes = here.minutes * left;
      if (minutes < 1) return left > 0 ? "Less than a minute left in chapter" : "Last page of the chapter";
      return `${Math.round(minutes)} min left in chapter`;
    };
    // The page you are on, of the chapter's pages at this size of screen and type (scrolling, there are none). Counted
    // from where the chapter lies: epub.js's own count, on two facing pages, changed as a chapter settled.
    const pageLabel = $("[data-reader-page]");
    let growing = 0;
    const grown = new ResizeObserver(() => {
      clearTimeout(growing);
      growing = setTimeout(() => {
        if (closed || !current) return;
        if (pageLabel) pageLabel.textContent = pageOf();
        if (leftLabel) leftLabel.textContent = timeLeft();
        prepareTurn();
      }, 150);
    });
    const pageOf = () => {
      const box = view.querySelector(".epub-container")?.getBoundingClientRect();
      const frame = view.querySelector("iframe")?.getBoundingClientRect();
      if (layout === "scroll" || !box?.width || !frame?.width) return "";
      const width = layout === "spread" ? box.width / 2 : box.width;
      const total = Math.max(1, Math.round(frame.width / width));
      const first = Math.min(total, Math.max(1, Math.round((box.left - frame.left) / width) + 1));
      const last = layout === "spread" ? Math.min(total, first + 1) : first;
      return last > first ? `Pages ${first}–${last} of ${total}` : `Page ${first} of ${total}`;
    };
    const showProgress = () => {
      if (!current) return;
      const p = percentOf(current.start.cfi);
      percent.textContent = p == null ? "" : `${Math.round(p * 100)}%`;
      if (leftLabel) leftLabel.textContent = timeLeft();
      if (pageLabel) pageLabel.textContent = pageOf();
      bar.style.transform = `scaleX(${p == null ? 0 : p})`;
      const name = forcedLabel || chapterOf(current.start.href);
      if (name !== chapter.textContent) {
        chapter.textContent = name;
        // a new chapter's name rises into the footer
        if (gsap && name) gsap.from(chapter, { yPercent: 90, opacity: 0, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
      }
      markCurrent(current.start.href);
      showContentsProgress(p);
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
      // found before the first page has said where it is (opening at a line): back to where the book opened
      if (!peek) {
        peek = current ? { cfi: current.start.cfi, label: forcedLabel || chapterOf(current.start.href) } : { cfi: opened, label: "" };
        peekMoves = 0;
      }
      scrolledSinceJump = 0;
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

    const SCREEN_LENGTH = /(-?\d*\.?\d+)(?:[sdl]?(vh|vmin|vmax))\b/gi;
    const screenHeightsFixed = (doc) => {
      const unit = { vh: innerHeight, vmin: Math.min(innerWidth, innerHeight), vmax: Math.max(innerWidth, innerHeight) };
      const inPixels = (value) => value.replace(SCREEN_LENGTH, (_, n, name) => `${(Number(n) * unit[name.toLowerCase()]) / 100}px`);
      const fix = (style) => {
        for (const name of [...style]) {
          const value = style.getPropertyValue(name);
          const fixed = inPixels(value);
          if (fixed !== value) style.setProperty(name, fixed, style.getPropertyPriority(name));
        }
      };
      const walk = (rules) => {
        for (const rule of rules) {
          if (rule.style) fix(rule.style);
          if (rule.cssRules) walk(rule.cssRules);
        }
      };
      for (const sheet of doc.styleSheets) {
        try { walk(sheet.cssRules); } catch { /* a sheet that cannot be read is left as it is */ }
      }
      doc.querySelectorAll("[style]").forEach((el) => fix(el.style));
    };

    const makeRendition = () => {
      const scrolled = layout === "scroll";
      rendition = book.renderTo(view, scrolled
        ? { manager: "continuous", flow: "scrolled", width: "100%", height: "100%" }
        : { flow: "paginated", spread: layout === "spread" ? "always" : "none", width: "100%", height: "100%" });
      // every place shown, epub.js's own too (it shows the place again after the window changes size), lands on the
      // page its first letter is on
      const display = rendition.display.bind(rendition);
      rendition.display = (target) => display(target).then(async (result) => {
        await exactly(target);
        hold(() => exactly(target));
        return result;
      });
      // A book's styles can size things by the height of the screen: a dedication a full screen tall, a title a fifth of
      // the way down. Scrolling, a chapter's frame is as tall as its words, and inside the frame "the screen" is the frame
      // itself, so such a chapter grew its frame, which grew the chapter, for as long as the book stayed open (and the
      // words below slid down the page). Scrolling, those lengths are measured once against the real window.
      if (scrolled) rendition.hooks.content.register((contents) => screenHeightsFixed(contents.document));
      rendition.hooks.content.register((contents) => paint(contents, prefs));
      // scrolling, each chapter ends with a small mark (reader-content.css)
      rendition.hooks.content.register((contents) => contents.document.documentElement.classList.toggle("bookshelf-scroll", scrolled));
      // Paginated, epub.js sets the body's padding itself to lay out its columns, so only the scrolled view adds some
      // (room above and below for the bars that float over it)
      rendition.themes.default({
        body: { "line-height": "1.6 !important", transition: "background-color .4s, color .4s", ...(scrolled ? { padding: "4.75em 1.25em 3.75em !important" } : {}) },
        img: { "max-width": "100%" },
      });
      // The site's own Figtree, for the Sans option
      rendition.hooks.content.register((contents) => contents.addStylesheet(new URL(readerContentCss, location.href).href));
      // epub.js scrolls by itself as it adds and drops chapters above the one on screen, keeping the words still; those
      // scrolls are not you reading on or back (see immersive)
      rendition.on("started", () => {
        const manager = rendition.manager;
        // Where a screen's pixels are not a whole number of the page's (2.625 on many Android phones), each page's scroll
        // lands a fraction past the page's edge, more with every page. epub.js asks whether a whole page more fits, found
        // it short by under a pixel, and went on to the next chapter: every chapter's last page was skipped. If more than
        // half a page is left there is a page left: the scroll is drawn back by that fraction so that epub.js finds it.
        const turnOn = manager?.next?.bind(manager);
        if (!scrolled && turnOn) {
          manager.next = () => {
            const box = manager.container;
            const delta = manager.layout?.delta;
            if (box && delta && manager.isPaginated && manager.settings?.axis === "horizontal" && manager.settings?.direction !== "rtl") {
              const short = box.scrollLeft + box.offsetWidth + delta - box.scrollWidth;
              if (short > 0 && short < delta / 2) box.scrollLeft -= short + 0.5;
            }
            return turnOn();
          };
        }
        ["scrollBy", "scrollTo"].forEach((name) => {
          const own = manager?.[name]?.bind(manager);
          if (own) manager[name] = (...args) => { ownScrollAt = performance.now(); return own(...args); };
        });
        // When a chapter above the one on screen is added or grows, the browser keeps the words still by itself
        // (scroll anchoring), except at the very top of the book; epub.js then moved the scroll by its height as well,
        // and the words jumped down the page. Where the browser anchors, epub.js only does it at the top.
        const counter = manager?.counter?.bind(manager);
        if (scrolled && counter && window.CSS?.supports?.("overflow-anchor", "auto")) {
          manager.counter = (bounds) => { if (!(manager.container?.scrollTop > 0)) counter(bounds); };
        }
      });
      rendition.on("relocated", (location) => { current = location; lastActive = Date.now(); showProgress(); ctx.emit("relocated", location); prepareTurn(); });
      // Each page is shown in a frame of its own, which a screen reader announces by its title
      rendition.on("rendered", (section, v) => {
        v?.iframe?.setAttribute("title", `${info.title}, by ${info.author}`);
        if (v?.iframe) { styled.add(v.iframe); grown.observe(v.iframe); }
        settle();
        nudge();
      });
      rendition.on("keyup", keys);
      // a finger drawing a page across, or swiping (below, at "A finger on the page")
      rendition.hooks.content.register((contents) => {
        const doc = contents.document;
        doc.addEventListener("touchstart", touchStart, { passive: true });
        doc.addEventListener("touchmove", touchMove, { passive: true });
        doc.addEventListener("touchend", touchEnd);
        doc.addEventListener("touchcancel", touchCancel);
        ["touchstart", "touchmove", "wheel", "keydown"].forEach((type) => doc.addEventListener(type, handled, { passive: true }));
        doc.addEventListener("mousemove", pointerMoved, { passive: true });
      });
      rendition.on("click", (event) => {
        // on a phone a tap on the page brings the bars back, or sends them away; not a tap on a highlight (which opens
        // it, and is told a moment after the tap) or one that puts away the highlight bar. Turning pages on a phone, a
        // tap near the left or right edge turns back or on.
        const wasSelecting = ctx.selecting();
        const phonePages = root.classList.contains("is--phone-pages");
        // A tap the page leaves alone is Chrome's on Android: with Touch to Search on, it picks out the word under
        // your finger and opens a search bar, and the page did not turn. Every tap on the words is the reader's.
        if (!event.target.closest?.("a, button, input, textarea, select, label, summary")) event.preventDefault();
        if ((layout === "scroll" || phonePages) && !panelOpen() && !event.target.closest?.("a") && !String(event.view?.getSelection?.() || "")) {
          const frame = event.view?.frameElement?.getBoundingClientRect();
          const box = view.getBoundingClientRect();
          const x = frame ? frame.left + event.clientX - box.left : box.width / 2;
          const y = frame ? frame.top + event.clientY - box.top : box.height / 2;
          setTimeout(() => {
            if (wasSelecting || ctx.selecting() || closed) return;
            if (phonePages && x < box.width * 0.28) turn(-1, y);
            else if (phonePages && x > box.width * 0.72) turn(1, y);
            else root.classList.toggle("is--immersive");
          }, 0);
        } else if (layout !== "scroll" && finePointer.matches && !panelOpen() && !wasSelecting && !event.target.closest?.("a")
          && !String(event.view?.getSelection?.() || "")) {
          // with a mouse, a click near the outer edge of a page turns it (see pointerMoved)
          const { x, y, width } = pointerAt(event);
          const dir = zoneAt(x, width);
          if (dir) setTimeout(() => { if (!ctx.selecting() && !closed) turn(dir, y); }, 0);
        }
        closePanels();
      });
      renditionHooks.forEach((hook) => hook(rendition));
      apply();
      return rendition;
    };

    let resizeTimer = 0;
    const onResize = (force) => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        mirrorKey = "";
        const wanted = layoutNow(prefs.flow);
        if ((wanted === layout && force !== true) || !rendition || !current || closed) return;
        const at = current.start.cfi;
        layout = wanted;
        turning?.kill();
        turning = null;
        drag = null;
        hover?.tween?.kill();
        hover = null;
        hideLeaves();
        gsap?.set(view, { clearProps: "transform,opacity,visibility" });
        dropMirrors();
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
    const search = $("[data-reader-toc-search]");
    const summary = $("[data-reader-toc-summary]");
    const summaryText = $("[data-reader-toc-summary-text]");
    const summaryBar = $("[data-reader-toc-summary-bar]");
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
    const hoursAndMinutes = (minutes) => {
      const m = Math.max(1, Math.round(minutes));
      return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
    };
    // How far through the book, at the top; each chapter's minutes beside its name (a chapter that shares its file
    // with others has none: the book's measure cannot split it); and the chapter you are in, how far through it
    function showContentsProgress(p) {
      if (p != null && info.minutes) {
        summary.hidden = false;
        summaryText.textContent = p >= 0.995 ? "Finished" : `${Math.round(p * 100)}% read · about ${hoursAndMinutes(info.minutes * (1 - p))} left`;
        summaryBar.style.transform = `scaleX(${p})`;
      }
      const here = chapterNow(); // first: it counts where each chapter starts
      const minutes = chapterMinutes();
      const files = new Map();
      tocLinks.forEach(([, file]) => files.set(file, (files.get(file) || 0) + 1));
      tocLinks.forEach(([link, file, index]) => {
        const time = link.querySelector(".reader__toc-time");
        if (!time) return;
        const now = link.getAttribute("aria-current") === "true";
        const whole = files.get(file) === 1 ? minutes.get(index) : undefined;
        time.textContent = now && here ? `${hoursAndMinutes(here.minutes * here.left)} left` : whole != null ? hoursAndMinutes(whole) : "";
        link.style.setProperty("--done", now && here ? String(1 - here.left) : "0");
      });
    }

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
        const name = document.createElement("span");
        name.className = "reader__toc-name";
        name.textContent = label;
        const time = document.createElement("span");
        time.className = "reader__toc-time";
        button.append(name, time);
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
      markRead(placeOf(slug)?.spine ?? -1);
      if (current) showProgress();
    });
    // Searching the book: chapters whose names match stay in the list, and below them, the places in the text where the
    // words are, found chapter by chapter (a long book takes a moment, and shows its progress)
    const results = $("[data-reader-results]");
    const resultsStatus = $("[data-reader-results-status]");
    const resultsList = $("[data-reader-results-list]");
    let searching = 0;
    let searchTimer = 0;
    const showResult = (section, hit, words) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reader__result";
      const where = document.createElement("span");
      where.className = "reader__note-meta";
      const chapterName = chapterOf(section.href);
      where.textContent = chapterName;
      const excerpt = document.createElement("span");
      excerpt.className = "reader__result-text";
      // the words themselves in bold
      // whole words at either end
      const text = hit.excerpt.replace(/\s+/g, " ").trim().replace(/^\.\.\.\S*\s/, "…").replace(/\s\S*\.\.\.$/, "…");
      const lower = text.toLowerCase();
      let at = 0;
      for (;;) {
        const i = words.reduce((best, w) => { const j = lower.indexOf(w, at); return j >= 0 && (best < 0 || j < best) ? j : best; }, -1);
        if (i < 0) { excerpt.append(text.slice(at)); break; }
        const w = words.find((x) => lower.startsWith(x, i));
        excerpt.append(text.slice(at, i));
        const mark = document.createElement("mark");
        mark.textContent = text.slice(i, i + w.length);
        excerpt.append(mark);
        at = i + w.length;
      }
      button.append(where, excerpt);
      button.addEventListener("click", async () => {
        closePanels();
        await jumpTo(hit.cfi, chapterName);
        ctx.emit("flash", hit.cfi);
      });
      li.append(button);
      resultsList.append(li);
    };
    const searchText = async (query) => {
      const run = ++searching;
      resultsList.innerHTML = "";
      if (query.length < 3) { results.hidden = true; return; }
      results.hidden = false;
      // typed quotes and apostrophes find the book's curly ones too
      const words = [...new Set([query, query.replace(/'/g, "’").replace(/"/g, "“"), query.replace(/'/g, "’").replace(/"/g, "”")])].map((w) => w.toLowerCase());
      const sections = book.spine.spineItems.filter((s) => s.linear !== false && s.linear !== "no");
      let found = 0;
      for (let i = 0; i < sections.length && found < 200; i += 1) {
        if (run !== searching || closed) return;
        resultsStatus.textContent = `Searching… ${Math.round((i / sections.length) * 100)}%`;
        const section = sections[i];
        const wasLoaded = Boolean(section.document);
        try {
          await section.load(book.load.bind(book));
          const seen = new Set();
          words.forEach((w) => section.find(w).forEach((hit) => {
            if (seen.has(hit.cfi) || found >= 200 || run !== searching) return;
            seen.add(hit.cfi);
            found += 1;
            showResult(section, hit, words);
          }));
          if (!wasLoaded) section.unload();
        } catch { /* a chapter that would not load is skipped */ }
        await new Promise((resolve) => setTimeout(resolve, 0)); // the page stays responsive
      }
      if (run !== searching || closed) return;
      resultsStatus.textContent = found ? `${found >= 200 ? "200 or more" : found} ${found === 1 ? "place" : "places"} in the text` : "Not in the text of this book.";
    };
    search.addEventListener("input", () => {
      const query = search.value.trim();
      const words = plain(query).split(" ").filter(Boolean);
      const hits = new Set(tocLinks.filter(([link]) => words.every((w) => link.dataset.find.includes(w))).map(([link]) => link));
      tocLinks.forEach(([link, , , li]) => {
        // a part stays in view, dimmed, when one of its chapters matches
        const inside = [...li.querySelectorAll(".reader__toc-link")].some((b) => hits.has(b));
        li.hidden = !inside;
        link.classList.toggle("is--dim", inside && !hits.has(link));
      });
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => searchText(query), 350);
    });
    search.addEventListener("keydown", (event) => { if (event.key === "Enter") { clearTimeout(searchTimer); searchText(search.value.trim()); search.blur(); } });

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
    // A choice is dated, so your account keeps the latest one for your other devices (account.js)
    const choose = (reflows) => {
      prefs.at = Date.now();
      apply();
      if (reflows) holdPlace();
      window.dispatchEvent(new Event("bookshelf:changed"));
    };
    root.querySelectorAll("[data-reader-theme]").forEach((b) => b.addEventListener("click", () => { prefs.theme = b.dataset.readerTheme; choose(); }));
    root.querySelectorAll("[data-reader-font]").forEach((b) => b.addEventListener("click", () => { prefs.font = b.dataset.readerFont; choose(true); }));
    root.querySelectorAll("[data-reader-size]").forEach((b) => b.addEventListener("click", () => {
      const i = SIZES.indexOf(prefs.size) + Number(b.dataset.readerSize);
      prefs.size = SIZES[Math.max(0, Math.min(SIZES.length - 1, i < 0 ? 2 : i))];
      choose(true);
    }));
    root.querySelectorAll("[data-reader-spacing]").forEach((b) => b.addEventListener("click", () => { prefs.spacing = b.dataset.readerSpacing; choose(true); }));
    // Scroll or Pages, on a phone: the book is laid out again at the same place
    root.querySelectorAll("[data-reader-flow]").forEach((b) => b.addEventListener("click", () => {
      if (prefs.flow === b.dataset.readerFlow) return;
      prefs.flow = b.dataset.readerFlow;
      prefs.at = Date.now();
      store.write(PREFS, prefs);
      closePanels();
      onResize(true);
    }));
    // Full screen: on a phone, no status bar or browser bars, only the book
    const screenRow = $("[data-reader-screen-row]");
    const fullButton = $("[data-reader-fullscreen]");
    const fullscreen = () => {
      const on = Boolean(document.fullscreenElement);
      fullButton.setAttribute("aria-pressed", String(on));
      $("[data-reader-fullscreen-label]").textContent = on ? "Leave full screen" : "Full screen";
      fullButton.querySelector("use")?.setAttribute("href", on ? "#i-shrink" : "#i-expand");
    };
    if (screenRow && document.fullscreenEnabled) {
      screenRow.hidden = false;
      fullButton.addEventListener("click", () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      });
      document.addEventListener("fullscreenchange", fullscreen);
      fullscreen();
    }

    /* ---------- The end of the book ---------- */

    // Past the last page of the story come the edition's notes and licence. Turning on from that last page, or
    // scrolling down to the end of it, a card says you finished, with your time in it and three books to read next;
    // turn or scroll on again and the edition's pages follow.
    const BACK_MATTER = /(^|\/)(endnotes|loi|colophon|uncopyright|imprint|titlepage|halftitlepage|toc)\.xhtml$/;
    let lastStory = -1; // the spine index of the story's last part
    book.loaded.spine.then(() => book.spine.spineItems.forEach((s) => { if (s.linear && !BACK_MATTER.test(s.href)) lastStory = s.index; })).catch(() => {});
    const endBox = $("[data-reader-end]");
    let endShown = false;
    const atStoryEnd = () => {
      if (!current || lastStory < 0 || current.end.index !== lastStory) return false;
      const page = /(\d+)(?:–(\d+))? of (\d+)/.exec(pageOf());
      return page ? Number(page[2] || page[1]) >= Number(page[3]) : Boolean(current.atEnd);
    };
    // scrolling: you scrolled down to the end of the story's last part (or on past it); not the reader's own scrolling
    // after a jump
    const storyEndInView = () => {
      const now = performance.now();
      if (lastStory < 0 || (now < quietUntil && now - scrolledAt > 300) || now - handledAt > 3000) return false;
      if ((current?.start?.index ?? -1) > lastStory) return true;
      const box = view.getBoundingClientRect();
      return Boolean(rendition?.manager?.views?.all?.().some((v) => {
        if (v.section?.index !== lastStory || !v.element?.querySelector("iframe")) return false;
        const r = v.element.getBoundingClientRect();
        return r.bottom > box.top && r.bottom <= box.bottom - 24;
      }));
    };
    const markFinished = () => {
      const places = store.read(PLACES, {});
      const place = places[slug] || {};
      if (place.seen?.finished) return;
      places[slug] = { ...place, done: Date.now(), seen: { ...(place.seen || {}), finished: true } };
      store.write(PLACES, places);
      track(`read/finished/${slug}`, info.title);
      window.dispatchEvent(new Event("bookshelf:changed"));
    };
    const finishedBook = (other) => Boolean(placeOf(other)?.done || placeOf(other)?.seen?.finished);
    function showEnd() {
      if (!endBox || closed) return;
      endShown = true;
      markFinished();
      closePanels();
      root.classList.remove("is--immersive");
      $("[data-reader-end-cover]").src = `image/covers/${slug}-360.webp`;
      $("[data-reader-end-book]").textContent = info.title;
      $("[data-reader-end-page]").href = `book-${slug}`;
      saveTime();
      const seconds = store.read(STATS, {}).books?.[slug] || 0;
      const stats = $("[data-reader-end-stats]");
      stats.hidden = seconds < 120;
      stats.textContent = `${hoursAndMinutes(seconds / 60)} of reading, on this device.`;
      const picks = (info.next || []).filter((other) => library[other] && !finishedBook(other) && window.BookshelfKids?.allows(library[other].age) !== false).slice(0, 3);
      $("[data-reader-end-next-head]").hidden = !picks.length;
      $("[data-reader-end-next]").replaceChildren(...picks.map((other) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `book-${other}`;
        const cover = new Image(180, 270);
        cover.alt = "";
        cover.loading = "lazy";
        cover.src = `image/covers/${other}-360.webp`;
        const title = document.createElement("span");
        title.textContent = library[other].title;
        const by = document.createElement("span");
        by.className = "reader__end-by";
        by.textContent = library[other].author;
        link.append(cover, title, by);
        li.append(link);
        return li;
      }));
      endBox.hidden = false;
      $("[data-reader-end-page]").focus({ preventScroll: true });
      if (!gsap) return;
      const card = endBox.querySelector(".reader__end-card");
      gsap.fromTo(endBox, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out", clearProps: "opacity" });
      gsap.fromTo(card, { y: 28, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.8, ease: "expo.out", clearProps: "transform,opacity" });
      gsap.from([...card.querySelectorAll(":scope > :not([hidden]), .reader__end-next > li")],
        { y: 14, opacity: 0, duration: 0.6, stagger: 0.06, delay: 0.12, ease: "power3.out", clearProps: "transform,opacity" });
    }
    $("[data-reader-end-close]").addEventListener("click", closePanels);
    endBox.addEventListener("click", (event) => { if (event.target === endBox) closePanels(); });

    /* ---------- Turning pages ---------- */

    // A turn lifts the page itself. Each chapter is copied, once, into a frame of its own (a "mirror", with its
    // highlights); when you turn, the copy is laid exactly over the page you were reading while the book moves on
    // underneath, and then the copy turns away: around the spine on two facing pages, from the spine edge on one. Turning
    // back, the page you go back to swings down over the one you leave. Until a chapter's copy is ready, and with reduced
    // motion, pages slide or simply change.
    const curl = $("[data-reader-curl]");
    const curlShade = curl.querySelector(".reader__curl-shade");
    const curlBack = curl.querySelector(".reader__curl-back");
    const curlLight = curl.querySelector(".reader__curl-light");
    const curlFlap = curl.querySelector(".reader__curl-flap");
    const curlPage = $("[data-reader-curl-page]");
    const leaves = $("[data-reader-leaves]");
    let turning = null;
    let queued = 0;
    let hover = null; // a page corner lifted a little under the pointer: { dir, c, s, tween }
    let hoverBack = null; // that corner settling back down
    let drag = null;
    let mirrorKey = "";
    let mirrors = [];
    let building = null;
    const frameNow = () => view.querySelector("iframe");
    const keyNow = () => {
      const frame = frameNow();
      return frame && current ? [current.start.href, layout, frame.style.width, frame.offsetHeight, prefs.theme, prefs.size, prefs.font, prefs.spacing].join("|") : "";
    };
    function dropMirrors() {
      mirrors.forEach((m) => m.remove());
      mirrors = [];
      mirrorKey = "";
      swapIn?.discard();
      swapIn = null;
      edges.next?.drop();
      edges.prev?.drop();
      edges = { next: null, prev: null };
      backFrame = null;
      curlPage.replaceChildren();
    }
    // Copies of the chapter on screen, made when the reader is idle (now: at once, a turn is waiting for them): two, the
    // page that turns and the one beneath it
    function prepareTurn(now) {
      if (!gsap || layout === "scroll" || closed) return;
      const key = keyNow();
      if (!key || key === mirrorKey || building === key) return;
      building = key;
      const make = () => {
        if (closed || keyNow() !== key) { building = null; return; }
        const frame = frameNow();
        const doc = frame?.contentDocument;
        if (!doc?.documentElement) { building = null; return; }
        // epub.js puts some of its rules straight into a style element's sheet, not its text, and a copy of the page's
        // HTML lost them: pictures sized to the column (the imprint's logo came out a third of its size), its default
        // line height. They are written into the copy's style elements as text.
        const page = doc.documentElement.cloneNode(true);
        const copied = page.querySelectorAll("style");
        doc.querySelectorAll("style").forEach((style, i) => {
          try {
            const rules = [...(style.sheet?.cssRules || [])].map((rule) => rule.cssText).join("\n");
            if (rules && copied[i]) copied[i].textContent = rules;
          } catch { /* a sheet that cannot be read keeps its text */ }
        });
        const html = `<!DOCTYPE html>${page.outerHTML}`;
        const copy = (source = html, width = frame.style.width || `${frame.offsetWidth}px`) => {
          const m = document.createElement("iframe");
          m.className = "reader__mirror";
          m.setAttribute("aria-hidden", "true");
          m.setAttribute("sandbox", "allow-same-origin"); // the book's own copy: no scripts
          m.tabIndex = -1;
          m.style.width = width;
          m.style.height = `${frame.offsetHeight}px`;
          m.srcdoc = source;
          return m;
        };
        // ready once loaded and its fonts are in: a copy shown in a stand-in font wraps its lines differently, and the
        // page jumped as the turn began
        const loaded = (m) => new Promise((resolve) => {
          m.addEventListener("load", () => {
            const fonts = m.contentDocument?.fonts;
            if (!fonts) { resolve(); return; }
            fonts.forEach((face) => face.load().catch(() => {}));
            Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 2000))]).then(resolve);
          }, { once: true });
          setTimeout(resolve, 4000);
        });
        // A front face and a back face, so the page is never seen through from behind (clipping a copy flattens what is
        // inside it, so the faces, not the page, are what turn their backs away)
        const holderWith = (made = copy()) => {
          const holder = document.createElement("div");
          holder.className = "reader__leaf";
          holder.hidden = true;
          const front = document.createElement("div");
          front.className = "reader__leaf-face";
          front.append(made);
          const back = document.createElement("div");
          back.className = "reader__leaf-face is--back";
          holder.append(front, back);
          leaves.append(holder);
          return loaded(made).then(() => holder);
        };
        // a copy that loads unseen in the curl's back, beside the one in use
        const backWith = (made) => {
          made.style.visibility = "hidden";
          curlPage.append(made);
          return loaded(made).then(() => made);
        };
        // The chapters either side, on two facing pages: its first spread (going on) or its last (going back), so a turn
        // into another chapter curls like any other, with the page it becomes on its back and the next page beneath,
        // instead of blank paper and a wait while that chapter loads. Each is the chapter's text in this chapter's
        // page, with its styles, fonts and columns.
        const neighbour = async (section, last) => {
          if (!section || layout !== "spread") return null;
          let text;
          try { text = await section.render(book.load.bind(book)); } catch { return null; }
          if (closed || keyNow() !== key) return null;
          const xml = new DOMParser().parseFromString(text, "application/xhtml+xml");
          const parsed = xml.querySelector("parsererror") ? new DOMParser().parseFromString(text, "text/html") : xml;
          const source = parsed.querySelector("body");
          const shell = page.cloneNode(true); // this chapter's page, its rules written in
          const body = shell.querySelector("body");
          if (!source || !body) return null;
          // Its own head (its address, and the book's stylesheets it uses: the imprint and title page have one the
          // chapters do not), then the reader's (epub.js's columns, the page colour, our type), so a copy of the
          // imprint made from a chapter is set as the imprint is, not as a chapter
          const head = shell.querySelector("head");
          const reader = [...head.children].filter((e) => (e.tagName === "STYLE" && (e.id.startsWith("epubjs-inserted") || e.id === "bookshelf-theme"))
            || (e.tagName === "LINK" && /stylesheet/i.test(e.getAttribute("rel") || "") && !(e.getAttribute("href") || "").startsWith("blob:")));
          const own = [...(parsed.querySelector("head")?.children || [])].map((e) => doc.importNode(e, true));
          head.replaceChildren(...own, ...reader);
          [...body.attributes].forEach((a) => { if (a.name !== "style") body.removeAttribute(a.name); });
          [...source.attributes].forEach((a) => { if (a.name !== "style") body.setAttribute(a.name, a.value); });
          body.innerHTML = source.innerHTML;
          const markup = `<!DOCTYPE html>${shell.outerHTML}`;
          const wide = `${step() * (last ? 80 : 2)}px`;
          const [holder, back] = await Promise.all([holderWith(copy(markup, wide)), backWith(copy(markup, wide))]);
          // where its spread begins: the last spread of a chapter is found from where its text ends
          let x = 0;
          if (last) {
            const d = holder.querySelector(".reader__mirror").contentDocument;
            const range = d.createRange();
            range.selectNodeContents(d.body);
            const right = range.getBoundingClientRect().right; // as epub.js measures a chapter
            x = Math.max(0, Math.floor((right - 1) / step()) * step());
          }
          return { holder, back, x, drop: () => { holder.remove(); back.remove(); } };
        };
        // On two facing pages a third copy is the back of the page that curls over: the page it becomes, as in a book.
        // It loads beside the one in use (unseen), and takes its place with the others.
        const here = book.spine.get(current.start.href);
        const made = [holderWith(), holderWith(), layout === "spread" ? backWith(copy()) : null,
          neighbour(here?.next?.(), false), neighbour(here?.prev?.(), true)];
        Promise.all(made).then(([leaf, beneath, back, next, prev]) => {
          building = null;
          const discard = () => { leaf.remove(); beneath.remove(); back?.remove(); next?.drop(); prev?.drop(); };
          if (closed || keyNow() !== key) { discard(); return; }
          // The new copies replace the old ones only between turns. Made for a chapter the book has just moved into,
          // they used to arrive in the middle of the turn that moved it, and took the turning page away with them.
          swapIn?.discard();
          swapIn = Object.assign(() => {
            mirrors.forEach((m) => m.remove());
            backFrame?.remove();
            edges.next?.drop();
            edges.prev?.drop();
            mirrors = [leaf, beneath];
            backFrame = back;
            edges = { next, prev };
            mirrorKey = key;
          }, { discard });
          if (!turning && !hover) takeCopies();
        }).catch(() => { building = null; });
      };
      if (now) make();
      else if (window.requestIdleCallback) requestIdleCallback(make, { timeout: 1200 });
      else setTimeout(make, 200);
    }
    let swapIn = null; // new copies, waiting for the turn under way to end
    let backFrame = null; // the copy on the back of a page curling over, two facing pages
    let edges = { next: null, prev: null }; // copies of the chapters either side: { holder, back, x, drop }
    const edgeFor = (dir) => (layout === "spread" ? edges[dir > 0 ? "next" : "prev"] : null);
    function takeCopies() {
      if (!swapIn) return;
      const swap = swapIn;
      swapIn = null;
      swap();
    }
    const ready = () => Boolean(mirrorKey) && mirrorKey === keyNow() && mirrors.length === 2
      && (layout !== "spread" || Boolean(backFrame));
    // how far the book moves for one page
    const step = () => view.querySelector(".epub-container")?.clientWidth || view.clientWidth;
    // the page next to this one (dir 1, the next; -1, the one before) is in this chapter, so in the copies too
    const near = (dir) => {
      const frame = frameNow()?.getBoundingClientRect();
      const box = view.querySelector(".epub-container")?.getBoundingClientRect();
      if (!frame || !box) return false;
      return dir > 0 ? frame.right > box.right + 2 : frame.left < box.left - 2;
    };
    // A copy laid over part of the page area: the whole of it, or its left or right half; showing where the book is now,
    // or a page (shift) on or back
    const lay = (holder, part, shift = 0) => {
      const frame = frameNow();
      const area = view.getBoundingClientRect();
      const box = pages.getBoundingClientRect();
      const width = part === "all" ? area.width : area.width / 2;
      const left = area.left - box.left + (part === "right" ? area.width / 2 : 0);
      Object.assign(holder.style, { left: `${left}px`, top: `${area.top - box.top}px`, width: `${width}px`, height: `${area.height}px` });
      const mirror = holder.querySelector(".reader__leaf-face:not(.is--back) .reader__mirror");
      const at = frame.getBoundingClientRect();
      mirror.style.transform = `translate(${at.left - area.left - (part === "right" ? area.width / 2 : 0) - shift * step()}px, ${at.top - area.top}px)`;
      // the highlights, drawn beside the page's frame, go with it
      holder.querySelector(".reader__marks")?.remove();
      const marks = frame.parentElement?.querySelector(":scope > svg");
      if (marks) {
        const copy = marks.cloneNode(true);
        copy.classList.add("reader__marks");
        copy.style.transform = mirror.style.transform;
        mirror.parentElement.append(copy);
      }
      holder.dataset.part = part;
      holder.hidden = false;
    };
    const hideLeaves = () => {
      [...mirrors, edges.next?.holder, edges.prev?.holder].filter(Boolean).forEach((m) => {
        m.hidden = true;
        m.classList.remove("is--under", "is--beneath");
        m.style.clipPath = "";
        m.querySelectorAll(".reader__mirror").forEach((frame) => { frame.hidden = false; });
        gsap?.set(m, { clearProps: "transform,opacity,visibility,--shade" });
        gsap?.set(m.children, { clearProps: "opacity" });
      });
      view.style.clipPath = "";
      curl.hidden = true;
      curlPage.hidden = true;
      gsap?.set(curl, { clearProps: "opacity" });
      pages.classList.remove("is--turning");
    };
    const ease = "power2.inOut";

    // One page turns like paper. A corner lifts and is carried across, and the page folds where it bends: on one side
    // of the fold it lies flat, over that lies the part already turned, its back to you, and the page it uncovers takes
    // its shadow. The fold is halfway between where the corner was and where it is. t is how far the turn has gone:
    // 0, the page flat; 1, turned.
    const halfOf = (W, H, M, n, keep) => { // the page's part on one side of the fold (keep 1: the lifted side)
      const corners = [[0, 0], [W, 0], [W, H], [0, H]];
      const side = ([x, y]) => keep * ((x - M[0]) * n[0] + (y - M[1]) * n[1]);
      const out = [];
      corners.forEach((p, i) => {
        const q = corners[(i + 1) % 4];
        const a = side(p);
        const b = side(q);
        if (a >= 0) out.push(p);
        if ((a >= 0) !== (b >= 0)) out.push([p[0] + ((q[0] - p[0]) * a) / (a - b), p[1] + ((q[1] - p[1]) * a) / (a - b)]);
      });
      return out;
    };
    const polygon = (points, dx = 0, dy = 0) => (points.length > 2
      ? `polygon(${points.map(([x, y]) => `${(x + dx).toFixed(1)}px ${(y + dy).toFixed(1)}px`).join(", ")})`
      : "polygon(0 0, 0 0, 0 0)");
    // light across the curl's box, from a point on the fold (at) along dir; the stops in pixels from the fold
    const lightFrom = (c, at, dir, stops) => {
      const angle = Math.atan2(dir[0], -dir[1]);
      const length = Math.abs(c.boxW * Math.sin(angle)) + Math.abs(c.boxH * Math.cos(angle));
      const from = (at[0] - c.boxW / 2) * dir[0] + (at[1] - c.boxH / 2) * dir[1] + length / 2;
      return `linear-gradient(${angle.toFixed(4)}rad, ${stops.map(([colour, px]) => `${colour} ${(from + px).toFixed(1)}px`).join(", ")})`;
    };
    // The geometry is worked out for a page lifting at its right edge. A page lifting at its left (going back on two
    // facing pages) is the same seen in a mirror: c.flip turns each point x into W - x as it is drawn.
    const bend = (c, t) => {
      const { W, H } = c;
      const was = [W, c.corner];
      const now = [W - 2 * W * t, c.corner + c.lift * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))];
      const d = Math.hypot(was[0] - now[0], was[1] - now[1]);
      if (d < 0.5) { c.page.style.clipPath = ""; curl.hidden = true; return; }
      const n = [(was[0] - now[0]) / d, (was[1] - now[1]) / d];
      const M = [(was[0] + now[0]) / 2, (was[1] + now[1]) / 2];
      const lifted = halfOf(W, H, M, n, 1);
      const turned = lifted.map(([x, y]) => {
        const s = 2 * ((x - M[0]) * n[0] + (y - M[1]) * n[1]);
        return [x - s * n[0], y - s * n[1]];
      });
      const out = (points) => (c.flip ? points.map(([x, y]) => [W - x, y]) : points);
      c.page.style.clipPath = polygon(out(halfOf(W, H, M, n, -1)));
      curl.hidden = false;
      curlShade.style.clipPath = polygon(out(lifted), c.x, c.y);
      curlBack.style.clipPath = polygon(out(turned), c.x, c.y);
      const at = [(c.flip ? W - M[0] : M[0]) + c.x, M[1] + c.y];
      const along = c.flip ? [-n[0], n[1]] : n;
      const reach = d / 2; // from the fold to the turned corner
      const fade = Math.min(1, t * 8, (1 - t) * 8);
      curlShade.style.backgroundImage = lightFrom(c, at, along, [[`rgba(0, 0, 0, ${(0.3 * fade).toFixed(3)})`, 0],
        [`rgba(0, 0, 0, ${(0.1 * fade).toFixed(3)})`, Math.min(reach * 0.3, 40)], ["rgba(0, 0, 0, 0)", Math.min(reach * 0.6, 110) + 10]]);
      // the bend's light on the turned part, and its shadow on the page, fade as it lands flat, so nothing changes when
      // the copies give way to the book
      curlFlap.style.filter = fade > 0.01 ? `drop-shadow(0 0 .6em rgba(0, 0, 0, ${(0.28 * fade).toFixed(3)}))` : "none";
      const sheen = c.sheen.replace(/[\d.]+\)$/, (a) => `${(parseFloat(a) * fade).toFixed(3)})`);
      curlLight.style.backgroundImage = lightFrom(c, at, [-along[0], -along[1]], [[`rgba(0, 0, 0, ${(0.16 * fade).toFixed(3)})`, 0],
        [`rgba(0, 0, 0, ${(0.03 * fade).toFixed(3)})`, reach * 0.1], [sheen, reach * 0.3], ["rgba(0, 0, 0, 0)", reach * 0.7],
        [`rgba(0, 0, 0, ${(0.07 * fade).toFixed(3)})`, reach]]);
      // Two facing pages: the turned part's back is the page it becomes. A point p of the page is drawn reflected in
      // the fold; the back of p is the point of the new page at (-x, y), mirrored about the spine. The two mirrorings
      // together turn the new page into place, so it is drawn with that one transform; fully turned, it is still.
      if (c.back) {
        const k = 2 * (M[0] * n[0] + M[1] * n[1]);
        let m = [-(1 - 2 * n[0] * n[0]), 2 * n[0] * n[1], -2 * n[0] * n[1], 1 - 2 * n[1] * n[1], k * n[0], k * n[1]];
        // drawn mirrored: x -> W - x before and after
        if (c.flip) m = [m[0], -m[1], -m[2], m[3], W - m[4] - W * m[0], m[5] + W * m[1]];
        curlPage.style.transform = `matrix(${m.map((v) => v.toFixed(5)).join(", ")})`;
      }
    };
    // Sets a curl up. y, where the finger is: the corner nearer it lifts (the bottom one for a key or a button).
    // close: the page next to this one is in the copies, so the book itself moves only once the turn is over.
    const curlFrom = (dir, y, close) => {
      const [leaf, beneath] = mirrors;
      const area = view.getBoundingClientRect();
      const box = pages.getBoundingClientRect();
      const top = y != null && y < area.height * 0.4;
      const c = {
        W: area.width, H: area.height, x: area.left - box.left, y: area.top - box.top, boxW: box.width, boxH: box.height,
        corner: top ? 0 : area.height, lift: (top ? 1 : -1) * area.height * 0.16,
        sheen: prefs.theme === "night" ? "rgba(255, 255, 255, .05)" : "rgba(255, 255, 255, .45)",
        page: leaf,
      };
      pages.classList.add("is--turning");
      if (dir > 0) {
        // on: this page curls away, and beneath it is the next (a copy, until the book moves on)
        lay(leaf, "all");
        if (close) { lay(beneath, "all", 1); beneath.classList.add("is--beneath"); }
      } else if (close) {
        // back: the page before curls in over this one
        lay(leaf, "all", -1);
      } else {
        // back into the chapter before: this page waits underneath while the book moves back, and the page it moves
        // to curls in
        lay(beneath, "all");
        beneath.classList.add("is--under");
        c.page = view;
      }
      bend(c, dir > 0 ? 0 : 1);
      return c;
    };
    const paperOne = (dir, go, y) => new Promise((resolve) => {
      const close = near(dir);
      const c = curlFrom(dir, y, close);
      const s = { t: dir > 0 ? 0 : 1 };
      const moved = () => Promise.resolve(go()).catch(() => {});
      const tl = gsap.timeline({ onComplete: () => (close ? moved() : Promise.resolve()).then(() => { hideLeaves(); resolve(); }) });
      if (!close) tl.add(() => { tl.pause(); moved().then(() => tl.resume()); });
      tl.to(s, { t: dir > 0 ? 1 : 0, duration: 0.62, ease: "power2.out", onUpdate: () => bend(c, s.t) });
      turning = tl;
    });
    // Two facing pages: the outer page curls from its corner across the spine, as paper does, and lands as the next
    // page. Going on, the right page lifts; going back, the left one (drawn mirrored). Beneath it is the page after it,
    // and its back is the page it becomes, both copies. When those are in another chapter (not in the copies yet) the
    // book moves first, the other page of this spread stays as a copy, and the back is plain paper that fades as it
    // lands.
    const spreadCurl = (dir, y, close) => {
      const [leaf, beneath] = mirrors;
      const area = view.getBoundingClientRect();
      const box = pages.getBoundingClientRect();
      const W = area.width / 2;
      const H = area.height;
      const top = y != null && y < H * 0.4;
      const on = dir > 0;
      const c = {
        W, H, x: area.left - box.left + (on ? W : 0), y: area.top - box.top, boxW: box.width, boxH: box.height,
        corner: top ? 0 : H, lift: (top ? 1 : -1) * H * 0.12,
        sheen: prefs.theme === "night" ? "rgba(255, 255, 255, .04)" : "rgba(255, 255, 255, .22)",
        page: leaf, flip: !on, back: close, under: beneath,
      };
      pages.classList.add("is--turning");
      lay(leaf, on ? "right" : "left");
      // the spread it turns to: in this chapter's copies, or in the next or previous chapter's
      const edge = close ? null : edgeFor(dir);
      const frame = frameNow().getBoundingClientRect();
      if (close || edge) {
        // x: where in its copy the spread it turns to begins
        const x = close ? area.left - frame.left + dir * step() : edge.x;
        const under = close ? beneath : edge.holder;
        layAt(under, on ? "right" : "left", close ? frameNow() : null, x);
        under.classList.add("is--beneath");
        c.under = under;
        // the page it becomes, placed in the page's own frame (whose left edge is the spine going on, the book's left
        // edge going back) where it will lie once turned: left of the spine going on, right of it going back
        const back = close ? backFrame : edge.back;
        [...curlPage.children].forEach((m) => { m.style.visibility = m === back ? "" : "hidden"; });
        Object.assign(curlPage.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${2 * W}px`, height: `${H}px` });
        if (close) {
          back.style.width = frameNow().style.width || `${frameNow().offsetWidth}px`;
          back.style.height = `${frameNow().offsetHeight}px`;
        }
        back.style.transform = `translate(${-x - (on ? W : 0)}px, ${frame.top - area.top}px)`;
        // the highlights on the page it becomes come with it, rather than appearing as it lands
        curlPage.querySelector(".reader__marks")?.remove();
        const marks = close ? frameNow().parentElement?.querySelector(":scope > svg") : null;
        if (marks) {
          const copy = marks.cloneNode(true);
          copy.classList.add("reader__marks");
          copy.style.transform = back.style.transform;
          curlPage.append(copy);
        }
        c.back = true;
        c.edge = Boolean(edge);
        curlPage.hidden = false;
      } else {
        lay(beneath, on ? "left" : "right");
        beneath.classList.add("is--beneath");
        curlPage.hidden = true;
      }
      bend(c, 0);
      return c;
    };
    // A copy laid over the left or right page, showing its spread from x (in the copy) on. With the chapter's own frame,
    // the highlights drawn beside it go too.
    const layAt = (holder, part, frame, x) => {
      const area = view.getBoundingClientRect();
      const box = pages.getBoundingClientRect();
      const half = area.width / 2;
      Object.assign(holder.style, { left: `${area.left - box.left + (part === "right" ? half : 0)}px`, top: `${area.top - box.top}px`, width: `${half}px`, height: `${area.height}px` });
      const mirror = holder.querySelector(".reader__leaf-face:not(.is--back) .reader__mirror");
      const top = frameNow().getBoundingClientRect().top - area.top;
      mirror.style.transform = `translate(${-x - (part === "right" ? half : 0)}px, ${top}px)`;
      holder.querySelector(".reader__marks")?.remove();
      const marks = frame?.parentElement?.querySelector(":scope > svg");
      if (marks) {
        const copy = marks.cloneNode(true);
        copy.classList.add("reader__marks");
        copy.style.transform = mirror.style.transform;
        mirror.parentElement.append(copy);
      }
      holder.dataset.part = part;
      holder.hidden = false;
    };
    // once the book has moved into another chapter, it is shown as soon as its page is laid out and its fonts are in
    const laidOut = () => new Promise((resolve) => {
      const fonts = frameNow()?.contentDocument?.fonts;
      const wait = fonts ? Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 600))]) : Promise.resolve();
      wait.then(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const paperSpread = (dir, go, y, from = 0) => new Promise((resolve) => {
      const c = hover?.dir === dir ? hover.c : spreadCurl(dir, y, near(dir));
      hover?.tween?.kill();
      hover = null;
      // the copies show where it lands (in this chapter, or the next or previous one): the book moves once it has
      const close = c.back;
      const s = { t: from };
      const moved = () => Promise.resolve(go()).catch(() => {}).then(() => (c.edge ? laidOut() : undefined));
      const tl = gsap.timeline({ onComplete: () => (close ? moved() : Promise.resolve()).then(() => { hideLeaves(); resolve(); }) });
      if (!close) tl.add(() => { tl.pause(); moved().then(() => tl.resume()); });
      tl.to(s, { t: 1, duration: 0.3 + 0.55 * (1 - from), ease: from ? "power2.out" : "power2.inOut", onUpdate: () => bend(c, s.t) });
      // into another chapter the back is plain paper, lying over the copy of this spread's other page: that copy goes,
      // and the paper fades to show the page the book has moved to
      if (!close) tl.set(c.under, { visibility: "hidden" }).to(curl, { opacity: 0, duration: 0.2, ease: "power1.out" });
      turning = tl;
    });
    const slide = (dir, go) => new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to(view, { x: `${-1.5 * dir}%`, opacity: 0, duration: 0.16, ease: "power2.in" })
        .add(() => { tl.pause(); Promise.resolve(go()).catch(() => {}).then(() => tl.resume()); })
        .fromTo(view, { x: `${1.5 * dir}%` }, { x: 0, opacity: 1, duration: 0.36, ease: "power3.out", immediateRender: false });
      turning = tl;
    });
    // Turns asked for while one is under way wait their turn (each press counts, up to six), and hurry
    const turned = () => {
      turning = null;
      takeCopies();
      if (!queued) return;
      const dir = Math.sign(queued);
      queued -= dir;
      turn(dir);
      if (queued) turning?.timeScale(2.5);
    };
    const canTurn = (dir) => Boolean(current) && !(dir > 0 ? current.atEnd : current.atStart);
    function turn(dir, y) {
      if (dir > 0 && !endShown && layout !== "scroll" && atStoryEnd()) { showEnd(); return undefined; }
      moves += 1;
      // back into the chapter before: its last page, once it has settled
      const into = dir < 0 && !near(-1);
      const go = () => (dir > 0 ? rendition.next() : rendition.prev().then(() => (into ? toEnd() : undefined)));
      if (!rendition || layout === "scroll") return undefined;
      readOn();
      if (!gsap) return go();
      if (!canTurn(dir)) return undefined;
      // pressed again mid-turn: this one hurries and the next follows straight on
      if (turning) { queued = Math.max(-6, Math.min(6, queued + dir)); turning.timeScale(2.5); return undefined; }
      hoverBack?.kill();
      const start = () => {
        const from = hover?.dir === dir ? hover.s.t : 0;
        if (hover && hover.dir !== dir) dropHover(true);
        const animate = !ready() ? slide : layout === "spread" ? paperSpread : paperOne;
        return animate(dir, go, y, from).then(turned);
      };
      takeCopies();
      if (ready()) return start();
      // The copies of this chapter are not made yet (it has just opened, or the book has just moved into it): they are
      // made now, and the turn waits a moment for them, so it curls like every other rather than sliding
      prepareTurn(true);
      if (!building) return start();
      const waiting = { timeScale: () => {}, kill: () => { waiting.off = true; } };
      turning = waiting;
      const until = performance.now() + 700;
      return new Promise((resolve) => {
        const check = () => {
          if (waiting.off || closed) { resolve(); return; }
          takeCopies();
          if (!ready() && performance.now() < until) { requestAnimationFrame(check); return; }
          turning = null;
          start().then(resolve);
        };
        check();
      });
    }

    // With a mouse, the outer part of each page is where it turns: there the pointer becomes a hand, on two facing
    // pages the corner lifts a little (and the turn carries on from it), and a click turns the page. The middle of the
    // page is left for reading, choosing words and double-clicking one.
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const EDGE = 0.13; // the outer part of each side, as a share of the book's width
    const zoneAt = (x, width) => (x > width * (1 - EDGE) ? 1 : x < width * EDGE ? -1 : 0);
    const pointerAt = (event) => {
      const frame = event.view?.frameElement?.getBoundingClientRect();
      const box = view.getBoundingClientRect();
      return { x: (frame ? frame.left : 0) + event.clientX - box.left, y: (frame ? frame.top : 0) + event.clientY - box.top, width: box.width };
    };
    const handCursor = (on) => {
      pages.classList.toggle("is--peek-next", on > 0);
      pages.classList.toggle("is--peek-prev", on < 0);
      view.querySelectorAll("iframe").forEach((f) => { if (f.contentDocument?.documentElement) f.contentDocument.documentElement.style.cursor = on ? "pointer" : ""; });
    };
    function dropHover(now) {
      if (!hover) return;
      const h = hover;
      hover = null;
      h.tween?.kill();
      if (now || turning) { if (!turning) { hideLeaves(); takeCopies(); } return; }
      // settling back, it is stopped by a turn, which draws the same curl from then on
      hoverBack = gsap.to(h.s, {
        t: 0, duration: 0.25, ease: "power2.out", onUpdate: () => bend(h.c, h.s.t),
        onComplete: () => { hoverBack = null; if (!turning && !hover) { hideLeaves(); takeCopies(); } },
      });
    }
    function pointerMoved(event) {
      if (!finePointer.matches || layout === "scroll" || root.classList.contains("is--phone-pages")) return;
      const { x, y, width } = pointerAt(event);
      const dir = turning || drag || panelOpen() || ctx.selecting() || event.buttons ? 0 : zoneAt(x, width);
      const can = dir && canTurn(dir);
      handCursor(can ? dir : 0);
      if (!can || layout !== "spread" || !gsap || !ready() || !(near(dir) || edgeFor(dir))) { dropHover(); return; }
      if (hover?.dir === dir) return;
      dropHover(true);
      hoverBack?.kill();
      const c = spreadCurl(dir, y, near(dir));
      const s = { t: 0 };
      hover = { dir, c, s, tween: gsap.to(s, { t: 0.065, duration: 0.4, ease: "power2.out", onUpdate: () => bend(c, s.t) }) };
    }
    const pointerLeft = () => { handCursor(0); dropHover(); };
    pages.addEventListener("mousemove", pointerMoved);
    pages.addEventListener("mouseleave", pointerLeft);
    // a click on the book outside the text (its margins) turns the page too
    pages.addEventListener("click", (event) => {
      if (!finePointer.matches || layout === "scroll" || panelOpen()) return;
      const { x, y, width } = pointerAt(event);
      const dir = zoneAt(x, width);
      if (dir) turn(dir, y);
    });

    // A finger on the page. On one page at a time, drawn sideways, the page comes with it, curling from the corner
    // nearer the finger; let go past a quarter of the way, or with a flick, and it turns, otherwise it settles back. On
    // two facing pages, or where the next page is in another chapter (not in the copies yet), a swipe turns it.
    const pointIn = (event, touch) => {
      const frame = event.view?.frameElement?.getBoundingClientRect();
      const area = view.getBoundingClientRect();
      return { y: (frame ? frame.top : area.top) + touch.clientY - area.top };
    };
    const letGo = (d, goes) => {
      const s = { t: d.t };
      const to = (d.dir > 0) === goes ? 1 : 0;
      const tl = gsap.timeline({
        onComplete: () => (goes ? Promise.resolve(d.dir > 0 ? rendition.next() : rendition.prev()).catch(() => {}) : Promise.resolve())
          .then(() => { hideLeaves(); if (goes) readOn(); turned(); }),
      });
      tl.to(s, { t: to, duration: 0.2 + 0.45 * Math.abs(to - d.t), ease: "power2.out", onUpdate: () => bend(d.c, s.t) });
      turning = tl;
    };
    const touchStart = (event) => {
      if (event.touches.length > 1) { touchCancel(); return; }
      const t = event.changedTouches[0];
      drag = { x0: t.screenX, y0: t.screenY, y: pointIn(event, t).y, at: performance.now(), state: "maybe" };
    };
    const touchMove = (event) => {
      if (!drag || drag.state === "off" || drag.state === "swipe") return;
      const t = event.changedTouches[0];
      const dx = t.screenX - drag.x0;
      const dy = t.screenY - drag.y0;
      const now = performance.now();
      if (drag.state === "maybe") {
        if (Math.hypot(dx, dy) < 12) return;
        const dir = dx < 0 ? 1 : -1;
        // not a long press choosing words, nor a page scrolled down, nor a page already turning
        if (layout === "scroll" || Math.abs(dx) < Math.abs(dy) * 1.3 || now - drag.at > 450 || ctx.selecting() || panelOpen()) { drag.state = "off"; return; }
        if (layout === "spread" || turning || !gsap || !ready() || !near(dir) || (dir > 0 && !endShown && atStoryEnd())) { drag.state = "swipe"; return; }
        if (!canTurn(dir)) { drag.state = "off"; return; }
        moves += 1;
        Object.assign(drag, { state: "curl", dir, c: curlFrom(dir, drag.y, true), t: dir > 0 ? 0 : 1, speed: 0, last: [dx, now] });
        const held = drag;
        turning = { timeScale: () => {}, kill: () => { held.state = "off"; hideLeaves(); } };
      }
      if (drag.state !== "curl") return;
      const pulled = Math.min(1, Math.max(0, (drag.dir > 0 ? -dx : dx) / (drag.c.W * 1.1)));
      drag.t = drag.dir > 0 ? pulled : 1 - pulled;
      const [lastX, lastAt] = drag.last;
      if (now > lastAt) drag.speed = drag.speed * 0.4 + ((dx - lastX) / (now - lastAt)) * 0.6;
      drag.last = [dx, now];
      bend(drag.c, drag.t);
    };
    const touchEnd = (event) => {
      const d = drag;
      drag = null;
      if (!d) return;
      const dx = event.changedTouches[0].screenX - d.x0;
      // A tap on the words is the reader's (to turn, or to bring the bars back), but Chrome on Android takes a tap the
      // page leaves alone for itself: with Touch to Search on, it picked out the word and opened a search bar. Taken
      // here, before Chrome makes a click of it, the tap is passed on as the reader's own click (a highlight still
      // opens); a long press, a tap that ends a choice of words, and a tap on a link are left to the browser.
      const words = event.view?.getSelection?.();
      if (d.state === "maybe" && performance.now() - d.at < 400 && !String(words || "")
        && !event.target.closest?.("a, button, input, textarea, select, label, summary") && event.view) {
        event.preventDefault();
        const t = event.changedTouches[0];
        event.target.dispatchEvent(new event.view.MouseEvent("click", {
          bubbles: true, cancelable: true, view: event.view, clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY,
        }));
        return;
      }
      if (d.state === "swipe") { if (Math.abs(dx) > 50 && !ctx.selecting()) turn(dx < 0 ? 1 : -1, d.y); return; }
      if (d.state !== "curl") return;
      const share = d.dir > 0 ? d.t : 1 - d.t; // how much of it has turned
      const flick = -d.dir * d.speed; // pixels a millisecond, the way it turns
      letGo(d, flick > 0.3 || (share > 0.25 && flick > -0.3));
    };
    function touchCancel() {
      const d = drag;
      drag = null;
      if (d?.state === "curl") letGo(d, false);
    }
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
    const immersive = (event) => {
      const y = event.target.scrollTop;
      if (typeof y !== "number") return;
      // the reader's own scrolling (after a jump, or as the book lays itself out) does not count; yours always does
      if ((performance.now() < quietUntil && performance.now() - scrolledAt > 300) || performance.now() - ownScrollAt < 100) { lastY = y; return; }
      if (peek && performance.now() - handledAt < 3000) {
        scrolledSinceJump += Math.abs(y - lastY);
        if (scrolledSinceJump > innerHeight * 2) { scrolledSinceJump = 0; peekMoves = 1; readOn(); }
      }
      if (Math.abs(y - lastY) < 8) return;
      forcedLabel = "";
      root.classList.toggle("is--immersive", y > lastY && y > 120 && !panelOpen() && !peek);
      lastY = y;
    };
    view.addEventListener("scroll", immersive, { capture: true, passive: true });

    // Scrolling, epub.js adds the next chapter as an empty space and fills it in as you scroll on. A fast fling can stop
    // at the very bottom with the space still empty, and then nothing scrolls, so nothing filled it: the screen stayed
    // blank. Whenever scrolling stops, and every second and a half while reading, an empty space on screen is filled.
    const emptyOnScreen = () => {
      const box = view.getBoundingClientRect();
      return [...view.querySelectorAll(".epub-view")].some((v) => {
        const r = v.getBoundingClientRect();
        return r.bottom > box.top && r.top < box.bottom && !v.querySelector("iframe");
      });
    };
    let scrollStop = 0;
    const fill = () => { if (layout === "scroll" && !closed && rendition?.manager && emptyOnScreen()) rendition.manager.check(); };
    const onScrollEnd = () => {
      clearTimeout(scrollStop);
      scrollStop = setTimeout(() => { fill(); if (layout === "scroll" && !endShown && !closed && storyEndInView()) showEnd(); }, 150);
    };
    view.addEventListener("scroll", onScrollEnd, { capture: true, passive: true });
    const watchdog = setInterval(fill, 1500);

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
    ["keydown", "pointerdown", "wheel", "touchstart", "touchmove"].forEach((type) => root.addEventListener(type, handled, { passive: true }));
    view.addEventListener("scroll", active, { capture: true, passive: true });
    document.addEventListener("visibilitychange", saveTime);

    /* ---------- A phone: the screen stays on while you read, and Back closes what is open ---------- */

    // The screen is kept awake while the book is showing and you have read in the last five minutes
    let wake = null;
    const keepAwake = async () => {
      if (!("wakeLock" in navigator) || closed) return;
      const reading = document.visibilityState === "visible" && Date.now() - lastActive < 300000 && root.classList.contains("is--ready");
      if (reading && !wake) {
        try { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } catch { wake = null; }
      } else if (!reading && wake) {
        wake.release().catch(() => {});
        wake = null;
      }
    };
    const awake = setInterval(keepAwake, 20000);
    const awakeNow = () => keepAwake();
    document.addEventListener("visibilitychange", awakeNow);
    root.addEventListener("pointerdown", awakeNow, { passive: true });

    // Back (a phone's back gesture) closes an open panel, note or the highlight bar instead of leaving the book. Each
    // one opened adds a step to the history, taken away again when it closes some other way.
    let layered = false;
    let ownBack = false;
    const layerOpen = () => panelOpen() || !$("[data-select-bar]").hidden || !$("[data-note-editor]").hidden || !$("[data-define]").hidden;
    const layer = () => {
      if (layered || closed) return;
      layered = true;
      history.pushState({ ...(history.state || {}), readerLayer: true }, "");
    };
    const unlayer = () => {
      if (!layered || layerOpen()) return;
      layered = false;
      if (history.state?.readerLayer) { ownBack = true; history.back(); }
    };
    const onBack = (event) => {
      if (ownBack) { ownBack = false; event.stopImmediatePropagation(); return; }
      if (!layered) return;
      layered = false;
      event.stopImmediatePropagation();
      closePanels();
      ctx.emit("escape");
    };
    window.addEventListener("popstate", onBack, true); // before the site's page changes hear it
    const watchLayers = new MutationObserver(() => (layerOpen() ? layer() : unlayer()));
    watchLayers.observe(root, { attributes: true, attributeFilter: ["hidden"], subtree: true });

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
    // A book opened for the first time starts at the story, where the book itself says that is (its "bodymatter" landmark,
    // the mark an e-reader's Start goes to), with a dedication or epigraph just before it. A translator's note, an editor's
    // introduction or a list of sources stays in Contents. A book with no such mark starts past its title page and imprint.
    const firstPage = async () => {
      await book.loaded.spine;
      const items = book.spine.spineItems;
      const navigation = await book.loaded.navigation.catch(() => null);
      const story = navigation?.landmark?.("bodymatter")?.href?.split("#")[0];
      let at = story ? items.findIndex((s) => s.href.endsWith(story)) : -1;
      if (at < 0) return items.find((s) => s.linear && !ABOUT.test(s.href) && !/(^|\/)toc\.xhtml$/.test(s.href))?.href;
      for (let i = at - 1; i >= 0 && BEFORE_THE_STORY.test(items[i].href); i -= 1) {
        if (!/halftitlepage/.test(items[i].href)) at = i;
      }
      return items[at].href;
    };
    const start = saved?.cfi ? Promise.resolve(saved.cfi) : firstPage().catch(() => undefined);
    start.then((first) => {
      opened = first;
      quietUntil = performance.now() + 1500; // the book laying itself out is not you scrolling
      return show(first);
    }).then(() => {
      clearTimeout(patience);
      if (failed) return;
      message.textContent = "";
      reveal();
      ctx.emit("ready", params);
    }).catch(fail);
    // Percentages need the whole book measured once, which can take a moment for a long one
    book.ready.then(() => book.locations.generate(1600)).then(() => { measured = true; chapterStarts = null; showProgress(); }).catch(() => {});

    return () => {
      closed = true;
      if (lightOnly) document.head.append(lightOnly);
      holds.forEach(clearTimeout);
      nudges.forEach(clearTimeout);
      clearTimeout(patience);
      clearTimeout(resizeTimer);
      clearTimeout(searchTimer);
      searching += 1;
      clearTimeout(growing);
      grown.disconnect();
      plugins.forEach((undo) => typeof undo === "function" && undo());
      if (gsap) gsap.killTweensOf([intro, introBook, introCover, pages, view, chapter, ...panels()]);
      turning?.kill();
      root.classList.remove("is--opening", "is--immersive");
      clearInterval(tick);
      clearInterval(awake);
      clearInterval(watchdog);
      clearTimeout(scrollStop);
      view.removeEventListener("scroll", onScrollEnd, { capture: true });
      document.removeEventListener("visibilitychange", awakeNow);
      wake?.release().catch(() => {});
      watchLayers.disconnect();
      window.removeEventListener("popstate", onBack, true);
      if (layered && history.state?.readerLayer) history.replaceState({ ...history.state, readerLayer: false }, "");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      document.removeEventListener("fullscreenchange", fullscreen);
      dropMirrors();
      saveTime();
      ["keydown", "pointerdown", "wheel", "touchstart"].forEach((type) => root.removeEventListener(type, active));
      ["keydown", "pointerdown", "wheel", "touchstart", "touchmove"].forEach((type) => root.removeEventListener(type, handled));
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

// loaded as a module (by main.ts or on demand)
export {};

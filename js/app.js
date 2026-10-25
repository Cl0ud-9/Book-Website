/* The Bookshelf: page transitions, smooth scrolling and every animation on the site.
   Built on GSAP (with ScrollTrigger, SplitText, CustomEase, Inertia and DrawSVG), Lenis, Barba and Smooothy.
   Each page's effects are created inside a gsap.context, so leaving a page reverts all of them in one call. */
(() => {
  "use strict";

  const root = document.documentElement;
  window.bookshelfReady = true;

  const reduceMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => reduceMotionQuery.matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const desktop = matchMedia("(min-width: 992px)");

  // Without GSAP (blocked or offline) the site still works: no animation, plain page loads
  if (!window.gsap) {
    root.classList.remove("is-loading");
    initMenuBasic();
    return;
  }

  const { gsap, ScrollTrigger, SplitText, CustomEase } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, window.InertiaPlugin, window.DrawSVGPlugin);
  history.scrollRestoration = "manual";

  CustomEase.create("smooth", "0.625, 0.05, 0, 1");
  CustomEase.create("energy", "M0,0 C0.32,0.72 0,1 1,1");
  gsap.defaults({ ease: "smooth", duration: 0.6 });

  const ELASTIC = "elastic.out(1, 0.72)";
  const ELASTIC_SOFT = "elastic.out(1, 0.75)";
  const header = document.querySelector("[data-header]");
  const transition = document.querySelector("[data-transition-wrap]");
  const snake = transition.querySelector("path");
  const transitionLogo = transition.querySelector("[data-transition-logo]");

  /* ---------------- Smooth scrolling ---------------- */

  let lenis = null;
  if (window.Lenis && !reducedMotion()) {
    lenis = new window.Lenis({ lerp: 0.2, autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target, immediate = false) {
    if (!target) return;
    // Stop short by the target's own scroll-margin-top, so a fixed header or a sticky bar never covers its heading
    const offset = -(parseFloat(getComputedStyle(target).scrollMarginTop) || 16);
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.2, immediate, lock: !immediate });
    else target.scrollIntoView({ behavior: immediate || reducedMotion() ? "auto" : "smooth" });
  }

  function scrollToTop() {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }

  // Links to a part of the page you are already on scroll there instead of loading anything. A link to a part of
  // another page (index.html#new) is remembered here: the page change dropped the #part, and you landed at the top.
  let pendingHash = "";
  window.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const url = new URL(link.href, location.href);
    const here = url.pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");
    if (!here) {
      pendingHash = url.origin === location.origin ? url.hash : "";
      return;
    }
    if (!url.hash) {
      if (url.search !== location.search) return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      if (lenis) lenis.scrollTo(0, { duration: 1.2 }); else window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      return;
    }
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    history.replaceState(null, "", url.hash);
    scrollToTarget(target);
  }, true);

  /* ---------------- Header and menu ---------------- */

  // The Menu button stays put, as on the shelf that inspired the site (it used to slide away while reading down, and
  // seemed to vanish); the header only notes that the page has been scrolled
  const onScroll = () => {
    const y = lenis ? lenis.scroll : window.scrollY;
    header.dataset.scrollingStarted = String(y > 50);
  };
  if (lenis) lenis.on("scroll", onScroll);
  else window.addEventListener("scroll", onScroll, { passive: true });
  // A new page says where it starts (the jump to its scroll position happens while Lenis is paused, unheard)
  function resetHeader(y = 0) {
    header.dataset.scrollingStarted = String(y > 50);
  }

  function setCurrentNav(namespace) {
    const key = { home: "home", books: "books", book: "books", reader: "books", genres: "genres", faq: "faq",
      reading: "reading", account: "account", profile: "account", login: "account", signup: "account", privacy: "faq" }[namespace];
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === key) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  const menu = document.querySelector("[data-menu]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  let menuTimer;

  function openMenu() {
    clearTimeout(menuTimer);
    menu.hidden = false;
    menuToggle.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("is--active")));
    lenis?.stop();
    root.classList.add("has--menu-open");
    menu.querySelector("a, button")?.focus();
    if (!reducedMotion()) {
      const links = menu.querySelectorAll(".menu__link");
      gsap.fromTo(links, { yPercent: 60, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 0.8, ease: ELASTIC, stagger: 0.05, delay: 0.15 });
      gsap.fromTo(links, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out", stagger: 0.05, delay: 0.15 });
    }
  }

  function closeMenu() {
    if (menu.hidden) return;
    menu.classList.remove("is--active");
    menuToggle.setAttribute("aria-expanded", "false");
    root.classList.remove("has--menu-open");
    lenis?.start();
    menuTimer = setTimeout(() => { menu.hidden = true; }, reducedMotion() ? 0 : 600);
  }

  menuToggle.addEventListener("click", openMenu);
  menu.querySelector("[data-menu-close]").addEventListener("click", () => { closeMenu(); menuToggle.focus(); });
  menu.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", (event) => {
    if (menu.hidden) return;
    if (event.key === "Escape") { closeMenu(); menuToggle.focus(); }
    // Keep Tab inside the open menu
    if (event.key === "Tab") {
      // only what can take focus: the account link is hidden when the site has no accounts
      const items = [...menu.querySelectorAll("a, button")].filter((el) => !el.closest("[hidden]") && el.getClientRects().length);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  function initMenuBasic() {
    const m = document.querySelector("[data-menu]");
    const t = document.querySelector("[data-menu-toggle]");
    if (!m || !t) return;
    t.addEventListener("click", () => { m.hidden = false; m.classList.add("is--active"); t.setAttribute("aria-expanded", "true"); });
    m.querySelector("[data-menu-close]").addEventListener("click", () => {
      m.classList.remove("is--active"); m.hidden = true; t.setAttribute("aria-expanded", "false");
    });
  }

  /* ---------------- Text helpers ---------------- */

  // SplitText labels what it splits for screen readers, but a label is only allowed on headings. Anything else is
  // split inside a hidden copy, next to a screen-reader-only copy of the text.
  function split(el, vars) {
    if (/^H[1-6]$/.test(el.tagName)) return SplitText.create(el, vars);
    const text = el.textContent.trim();
    const visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    visual.append(...el.childNodes);
    const spoken = document.createElement("span");
    spoken.className = "sr-only";
    spoken.textContent = text;
    el.append(visual, spoken);
    return SplitText.create(visual, { ...vars, aria: "none" });
  }

  // Headings stretch in word by word with an elastic snap
  // Once text has landed it is put back together: hundreds of finished letters and words that each keep a transform
  // make every later frame slower to put on screen
  function stretchWords(tl, el, position) {
    if (!el) return;
    const split = SplitText.create(el, { type: "words", wordsClass: "split-word" }); // headings only
    gsap.set(split.words, { display: "inline-block", transformOrigin: "top left",
      yPercent: -10, xPercent: 40, scaleY: 0.1, scaleX: 0.85, rotate: 8, opacity: 0 });
    tl.to(split.words,
      {
        keyframes: {
          "10%": { opacity: 1 },
          "100%": { yPercent: 0, xPercent: 0, scaleY: 1, scaleX: 1, rotate: 0, ease: ELASTIC },
        },
        duration: 0.875, stagger: 0.088, onComplete: () => split.revert(),
      }, position);
  }

  // Handwritten notes tumble in letter by letter (returns the SplitText, so a note that plays once can be put back)
  function scribbleIn(el) {
    const parts = split(el, { type: "words, chars", wordsClass: "split-word", charsClass: "split-char" });
    gsap.set(parts.words, { display: "inline-block" });
    gsap.set(parts.chars, { display: "inline-block", opacity: 0, rotate: 22, x: "-0.25em", y: "0.5em" });
    return parts;
  }
  // the letters spring into place, but fade in plainly: a springy fade flickered
  const scribbleTo = { keyframes: { "20%": { opacity: 1, ease: "none" }, "100%": { rotate: 0, x: "0em", y: "0em", ease: ELASTIC_SOFT } },
    ease: "none", duration: 0.75, stagger: 0.016 };

  /* ---------------- Page intros ---------------- */

  // Sets the start state of a page's opening animation and returns a function that plays it on a timeline
  function pageIntro(container) {
    const home = container.querySelector("[data-intro-home]");
    const small = container.querySelector("[data-intro-page]");
    const hero = home || small;
    if (!hero) return () => {};
    const title = hero.querySelector("[data-hero-title]");
    const paragraph = hero.querySelector("[data-hero-paragraph]");
    const button = hero.querySelector("[data-hero-button]");
    const note = hero.querySelector("[data-hero-handwritten-text]");
    const content = hero.querySelector("[data-hero-content]");
    const bg = hero.querySelector("[data-hero-bg]");
    const books = gsap.utils.toArray(".hero__book, .book-hero__visual", hero);
    const noteSplit = note ? scribbleIn(note) : null;

    // Not quite 0: the browser then draws the text and the big covers while the squiggle still hides them. At 0 the
    // covers' first draw cost a couple of frames mid-opening, and Chrome did not count the text as shown until the
    // animation ended, which made the pages look slow to Lighthouse and to Google.
    gsap.set([paragraph, button].filter(Boolean), { opacity: 0.001, y: "-0.75em" });
    if (content) gsap.set(content, { opacity: 0.001, y: "5em" });
    if (books.length) gsap.set(books, { opacity: 0.001, y: "6em" });
    if (bg && desktop.matches) gsap.set(bg, { clipPath: "ellipse(20% 0% at 100% 100%)" });
    if (small) gsap.set(small, { y: "-5em", opacity: 0.001 });

    return (tl, at) => {
      if (small) tl.to(small, { y: "0em", opacity: 1, duration: 0.4, ease: "energy" }, at + 0.1);
      if (bg && desktop.matches) tl.to(bg, { clipPath: "ellipse(150% 130% at 100% 100%)", duration: 1.1, ease: "circ.out" }, at + 0.2);
      stretchWords(tl, title, at + 0.25);
      if (paragraph) tl.to(paragraph, { opacity: 1, y: "0em", duration: 0.35, ease: "energy" }, at + 0.45);
      if (button) tl.to(button, { opacity: 1, y: "0em", duration: 0.35, ease: "energy" }, at + 0.525);
      if (noteSplit) tl.to(noteSplit.chars, { ...scribbleTo, onComplete: () => noteSplit.revert() }, at + 0.45);
      if (content) tl.to(content, { y: "0em", opacity: 1, duration: 0.6, ease: "energy" }, at + 0.35);
      // Straight up into place, no turning: an elastic, rotating entrance made these big books look like they wobbled
      if (books.length) tl.to(books, { opacity: 1, y: "0em", duration: 1.1, ease: "expo.out", stagger: 0.08 }, at + 0.15);
    };
  }

  /* The transition: one fat violet squiggle. Leaving, it draws itself across the screen and swells until nothing
     shows through, and the logo springs in; arriving, the logo springs out and the squiggle slithers away from its
     start, thinning as it goes. */
  const COVER = "100%"; // wide enough that no corner of any screen shows through
  // The book in the middle of the squiggle pops in and drops away. Its fade has an ease of its own that never overshoots:
  // with the elastic one it shared, its opacity swung below nothing and back, so the book vanished and came back
  // before it went, and it shrank through nothing and turned inside out.
  function showLogo(tl, at, delay = 0.05) {
    tl.fromTo(transitionLogo, { scale: 0.4, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.5, ease: "back.out(2)" }, at + delay);
    tl.fromTo(transitionLogo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "power1.out" }, at + delay);
  }
  function hideLogo(tl, at, delay = 0.55) {
    tl.to(transitionLogo, { scale: 0.5, rotate: 30, duration: 0.3, ease: "back.in(2)" }, at + delay);
    tl.to(transitionLogo, { autoAlpha: 0, duration: 0.2, ease: "power1.in" }, at + delay + 0.1);
  }
  function uncover(tl, at, delay) {
    tl.fromTo(snake, { drawSVG: "0% 100%", strokeWidth: COVER }, {
      keyframes: { "95%": { strokeWidth: "8%", ease: "circ.out" }, "100%": { drawSVG: "100% 100%" } },
      duration: 1.25,
    }, at + delay);
  }
  function hideSnake() {
    gsap.set(snake, { drawSVG: "0% 0%" });
    gsap.set(transitionLogo, { autoAlpha: 0 });
  }

  // Settled once the squiggle has uncovered most of the new page, so the reader can open its book where it is seen
  let pageShown = Promise.resolve();
  let showPage = () => {};
  const awaitShown = () => { pageShown = new Promise((resolve) => { showPage = resolve; }); };

  function runOnce(container) {
    gsap.set(snake, { drawSVG: "0% 100%", strokeWidth: COVER });
    // Arriving by a full page load in the middle of a page change (see runLeave): the screen is already covered, with the
    // book showing, so the book stays as it is and only leaves once, as after any other page change
    const carried = root.classList.contains("is-carried");
    gsap.set(transitionLogo, carried ? { scale: 1, rotate: 0, autoAlpha: 1 } : { scale: 0, rotate: -64, autoAlpha: 0 });
    root.classList.remove("is-carried");
    // The page's first script (build.py's boot) decided whether the squiggle opens this visit: only on the home page,
    // on the first page of a visit. Everywhere else the page is already showing as it arrived, so nothing is hidden
    // and played in again.
    const covered = root.classList.contains("is-loading");
    try { sessionStorage.setItem("bookshelf:opened", "1"); } catch { /* no storage */ }
    if (reducedMotion() || !covered) {
      hideSnake();
      root.classList.remove("is-loading");
      if (!reducedMotion()) root.classList.add("is-ready");
      showPage();
      return reducedMotion() ? Promise.resolve() : firstLoadReady(container);
    }
    gsap.set(header, { yPercent: -100 });
    const play = pageIntro(container);
    root.classList.add("is-ready");
    root.classList.remove("is-loading");
    const tl = gsap.timeline({ paused: true });
    if (carried) {
      hideLogo(tl, 0, 0.1);
      uncover(tl, 0, 0.1);
    } else {
      uncover(tl, 0, 0.65);
      showLogo(tl, 0);
      hideLogo(tl, 0);
    }
    tl.call(() => showPage(), null, 1.3);
    // The text and the header carry on by themselves: Barba treats the transition as finished when this promise
    // resolves, and while one is running it answers the back button with a full page reload
    const intro = gsap.timeline({ paused: true });
    intro.to(header, { yPercent: 0, duration: 0.5, ease: "energy" }, 1.6);
    play(intro, 1.1);
    // The heavy first-load work (fonts, measuring every scroll trigger, decoding the hero's covers) is done while the
    // squiggle still covers a still screen: done during the animation, it made the opening stutter
    return firstLoadReady(container).then(() => {
      tl.play();
      intro.play();
      return tl.then();
    });
  }

  function firstLoadReady(container) {
    const loaded = document.readyState === "complete" ? null : new Promise((r) => addEventListener("load", r, { once: true }));
    const covers = [...container.querySelectorAll(".hero img, .book-hero img, .hero-xs img")].map((img) => img.decode().catch(() => {}));
    const ready = Promise.all([document.fonts?.ready, loaded, ...covers]);
    const enough = new Promise((r) => setTimeout(r, 1200)); // a slow network never holds the opening up for long
    return Promise.race([ready, enough])
      .then(() => ScrollTrigger.refresh())
      .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }

  // Back and forward: phones already slide the previous page in with their own gesture animation, so a squiggle on
  // top would play after the page is visible. History moves swap the page at once and only the text animates in.
  const fromHistory = (trigger) => typeof trigger === "string" && trigger !== "barba";

  function runLeave(trigger) {
    if (reducedMotion() || fromHistory(trigger)) return Promise.resolve();
    const tl = gsap.timeline();
    gsap.set(snake, { strokeWidth: "8%", drawSVG: "0% 0%" });
    tl.to(snake, {
      keyframes: { "15%": { strokeWidth: "8%" }, "90%": { drawSVG: "0% 100%" }, "100%": { strokeWidth: COVER } },
      duration: 1.25,
    }, 0);
    showLogo(tl, 0, 0.5);
    // If the next page is slow or its request fails, Barba gives up and loads it in full. That page then starts covered,
    // book showing (build.py's boot), instead of a blank screen and then the book again.
    try { sessionStorage.setItem("bookshelf:covered", String(Date.now())); } catch { /* no storage */ }
    return tl.then();
  }
  const uncovered = () => { try { sessionStorage.removeItem("bookshelf:covered"); } catch { /* no storage */ } };

  function runEnter(container, trigger) {
    uncovered();
    if (reducedMotion()) {
      hideSnake();
      showPage();
      return Promise.resolve();
    }
    const play = pageIntro(container);
    // As in runOnce, only the squiggle holds the transition open; the text intro runs on its own timeline
    const intro = gsap.timeline();
    if (fromHistory(trigger)) {
      hideSnake();
      play(intro, 0);
      showPage();
      return Promise.resolve();
    }
    const tl = gsap.timeline();
    hideLogo(tl, 0, 0.1);
    uncover(tl, 0, 0.1);
    tl.call(() => showPage(), null, 0.75);
    play(intro, 0.45);
    return tl.then();
  }

  /* ---------------- Effects, one function each ---------------- */

  // Background shapes slowly breathe while they are on screen. On touch screens they also ease to a stop while the
  // page is being scrolled: repainting them on top of the scroll cost phones about one frame in five
  function breathingShapes(page) {
    const shapes = [];
    let scrolling = false;
    let rest = 0;
    const settle = (shape) => {
      const run = shape.onScreen && !scrolling;
      if (run === shape.running) return;
      shape.running = run;
      if (run) {
        shape.tl.play();
        gsap.to(shape.tl, { timeScale: 1, duration: 0.4, overwrite: true });
      } else {
        gsap.to(shape.tl, { timeScale: 0, duration: 0.25, overwrite: true, onComplete: () => shape.tl.pause() });
      }
    };
    page.querySelectorAll("[data-background-animation]").forEach((svg) => {
      const paths = svg.querySelectorAll("path");
      const width = svg.hasAttribute("data-background-animation-small") ? 35 : 60;
      gsap.set(paths, { attr: { "stroke-width": 0 } });
      const tl = gsap.timeline({ paused: true, repeat: -1 })
        .to(paths, { attr: { "stroke-width": width }, rotate: 2, duration: 3, ease: "sine.inOut" })
        .to(paths, { attr: { "stroke-width": 0 }, rotate: 0, duration: 3, ease: "sine.inOut" });
      const shape = { tl, onScreen: false, running: false };
      shapes.push(shape);
      ScrollTrigger.create({
        trigger: svg.parentElement, start: "top bottom", end: "bottom top",
        onToggle: (self) => { shape.onScreen = self.isActive; settle(shape); },
      });
    });
    if (!shapes.length || finePointer.matches) return;
    const onScroll = () => {
      if (!scrolling) { scrolling = true; shapes.forEach(settle); }
      clearTimeout(rest);
      rest = setTimeout(() => { scrolling = false; shapes.forEach(settle); }, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(rest); };
  }

  // Hero books float gently up and down, and lean towards the pointer. Only up and down: a rocking turn on top of
  // their 3D angle looked like the books tilting by themselves.
  function floatingBooks(page) {
    const books = page.querySelectorAll("[data-float]");
    if (!books.length) return;
    books.forEach((book, i) => {
      gsap.to(book.firstElementChild, {
        y: i === 0 ? "-0.8em" : "0.7em",
        duration: i === 0 ? 3.2 : 2.8, ease: "sine.inOut", yoyo: true, repeat: -1,
      });
    });
    // A tap or click makes a book dip and lean a little towards where it was touched, then spring back once
    const nudges = [...books].map((book) => {
      const nudge = (event) => {
        const box = book.getBoundingClientRect();
        const side = event.clientX < box.left + box.width / 2 ? -1 : 1;
        gsap.timeline({ overwrite: "auto" })
          .to(book, { rotate: side * 4, scale: 0.97, duration: 0.14, ease: "power2.out" })
          .to(book, { rotate: 0, scale: 1, duration: 0.7, ease: "back.out(2.2)" });
      };
      book.addEventListener("pointerdown", nudge);
      return () => book.removeEventListener("pointerdown", nudge);
    });
    const unnudge = () => nudges.forEach((fn) => fn());
    if (!finePointer.matches) return unnudge;
    const hero = page.querySelector(".hero");
    const movers = [...books].map((book, i) => ({
      x: gsap.quickTo(book, "xPercent", { duration: 0.9, ease: "power3" }),
      y: gsap.quickTo(book, "yPercent", { duration: 0.9, ease: "power3" }),
      depth: [6, 10, 8][i] || 6,
    }));
    const move = (event) => {
      const nx = event.clientX / innerWidth - 0.5;
      const ny = event.clientY / innerHeight - 0.5;
      movers.forEach((m) => { m.x(nx * m.depth); m.y(ny * m.depth); });
    };
    hero.addEventListener("pointermove", move);
    return () => { hero.removeEventListener("pointermove", move); unnudge(); };
  }

  // Letters in buttons dip and spring back on hover
  function waveButtons(scope) {
    const cleanups = [];
    // On a touch screen, which cannot point, the same plays when a button is pressed, and once as it first comes fully
    // into view (so it is seen at all)
    const touch = !finePointer.matches;
    const plays = new Map();
    const seen = touch ? new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      seen.unobserve(entry.target);
      plays.get(entry.target)?.();
    }), { threshold: 1 }) : null;
    scope.querySelectorAll("[data-button-text], [data-button-alt-text]").forEach((text) => {
      if (text.dataset.waved || reducedMotion()) return;
      text.dataset.waved = "true";
      // The letters are split the first time the button is pointed at, when it is surely on screen: split while hidden
      // (a sign-in step not shown yet, Sign in once signed in), the spaces between words landed in the wrong places
      let tl = null;
      let parts = null;
      const ready = () => {
        if (tl) return tl;
        parts = split(text, { type: "chars", charsClass: "split-char" });
        gsap.set(parts.chars, { display: "inline-block", transformOrigin: "center center" });
        tl = gsap.timeline({ paused: true }).to(parts.chars, {
          keyframes: {
            "0%": { yPercent: 0, scaleY: 1, rotate: 0 },
            "20%": { yPercent: 55, scaleY: 0.3, rotate: 17, ease: "power2.in" },
            "100%": { yPercent: 0, scaleY: 1, rotate: 0, ease: "elastic.out(1, 0.4)" },
          },
          duration: 0.725, stagger: { amount: 0.225 },
        });
        return tl;
      };
      const hover = text.closest("a, button");
      const enter = () => ready().restart();
      const leave = () => {
        if (!tl) return;
        tl.pause();
        gsap.to(parts.chars, { yPercent: 0, scaleY: 1, rotate: 0, duration: 0.2, ease: "power2.out", overwrite: "auto" });
      };
      if (touch) {
        let done = 0;
        const play = () => {
          ready().restart();
          hover.classList.add("is--play");
          clearTimeout(done);
          done = setTimeout(() => hover.classList.remove("is--play"), 650);
        };
        plays.set(hover, play);
        seen.observe(hover);
        hover.addEventListener("pointerdown", play);
        cleanups.push(() => {
          hover.removeEventListener("pointerdown", play);
          clearTimeout(done);
          hover.classList.remove("is--play");
          delete text.dataset.waved;
        });
        return;
      }
      const focusIn = () => { if (hover.matches(":focus-visible")) ready().restart(); };
      hover.addEventListener("mouseenter", enter);
      hover.addEventListener("mouseleave", leave);
      hover.addEventListener("focusin", focusIn);
      cleanups.push(() => {
        hover.removeEventListener("mouseenter", enter);
        hover.removeEventListener("mouseleave", leave);
        hover.removeEventListener("focusin", focusIn);
        delete text.dataset.waved;
      });
    });
    return () => { seen?.disconnect(); cleanups.forEach((fn) => fn()); };
  }

  // Cards below the screen wait, lowered and clear, and rise into place as they come into view. The browser does the
  // work (an IntersectionObserver and a CSS transition) instead of one scroll trigger per card: with 144 cards, setting
  // those up held a phone's main thread for over a second. Cards already on screen are never hidden.
  function riseIn(items, stagger = 0.05) {
    if (reducedMotion() || !items.length || !("IntersectionObserver" in window)) return null;
    const below = items.filter((el) => el.getBoundingClientRect().top > innerHeight);
    below.forEach((el) => el.classList.add("is--waiting"));
    const done = (el) => { el.classList.remove("is--rising"); el.style.removeProperty("--rise-delay"); };
    const io = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry, i) => {
        const el = entry.target;
        io.unobserve(el);
        el.style.setProperty("--rise-delay", `${i * stagger}s`);
        el.classList.add("is--rising");
        el.classList.remove("is--waiting");
        const end = (event) => { if (event.target === el && event.propertyName === "translate") { done(el); el.removeEventListener("transitionend", end); } };
        el.addEventListener("transitionend", end);
        setTimeout(() => done(el), 2000 + i * stagger * 1000);
      });
    }, { rootMargin: "0px 0px -5% 0px" });
    below.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }

  // Builds an effect only when its element comes within half a screen of view. Splitting every note and heading on the
  // page into letters at load held up the first screen on a phone for work that was screens away. One shared
  // IntersectionObserver watches them (a scroll trigger each measured the page every time one was made), and the
  // effects are built one per task, so a page with several near the top never blocks the phone for long. (Not for
  // effects that pin: a pin adds height, so it has to be in place before anything below it is measured.)
  const nearJobs = new Map();
  const buildQueue = [];
  let nearObserver = null;
  const nextBuild = () => {
    const job = buildQueue.shift();
    if (!job) return;
    job();
    if (buildQueue.length) setTimeout(nextBuild, 0);
  };
  function whenNear(el, build) {
    let undo = null;
    const run = () => { if (nearJobs.get(el) === run) nearJobs.delete(el); undo = build(); };
    if (!("IntersectionObserver" in window)) { run(); return; }
    nearObserver ||= new IntersectionObserver((entries) => entries.forEach((entry) => {
      const job = nearJobs.get(entry.target);
      if (!entry.isIntersecting || !job) return;
      nearObserver.unobserve(entry.target);
      const context = pageContext;
      buildQueue.push(() => { if (nearJobs.get(entry.target) === job) (context ? context.add(job) : job()); });
      if (buildQueue.length === 1) setTimeout(nextBuild, 0);
    }), { rootMargin: "0px 0px 50% 0px" });
    nearJobs.set(el, run);
    nearObserver.observe(el);
    pageCleanups.push(() => { nearJobs.delete(el); nearObserver.unobserve(el); if (typeof undo === "function") undo(); });
  }

  function handwrittenInView(page) {
    page.querySelectorAll("[data-handwritten-text-inview]").forEach((note) => whenNear(note, () => {
      const parts = scribbleIn(note);
      gsap.to(parts.chars, { ...scribbleTo, onComplete: () => parts.revert(), scrollTrigger: { trigger: note, start: "top 95%" } });
    }));
  }

  // Smooothy's destroy() removes new functions rather than the ones it added to window, so its mousemove, mouseup and
  // touch listeners stayed behind, and with them every shelf and the page around it, on every visit to the home page.
  // The window listeners it adds while it is built are noted here, and removed with it.
  function withWindowListeners(build) {
    const added = [];
    const add = window.addEventListener;
    window.addEventListener = function (...args) { added.push(args); return add.apply(this, args); };
    try {
      return [build(), () => added.forEach((args) => window.removeEventListener(...args))];
    } finally {
      window.addEventListener = add;
    }
  }

  // Draggable shelves: each card tilts and dips the further it is from the middle
  function sliders(page) {
    if (!window.Smooothy || !desktop.matches) return;
    const instances = [];
    page.querySelectorAll("[data-books-slider]").forEach((section) => {
      const wrapper = section.querySelector("[data-books-slider-wrapper]");
      const viewport = section.querySelector("[data-books-slider-viewport]");
      const [prev, next] = section.querySelectorAll("[data-books-slider-controls] button");
      const cards = [...wrapper.querySelectorAll("[data-books-slider-item]")];
      const settings = cards.map((card, i) => {
        const direction = i % 2 === 0 ? -1 : 1;
        const rotation = gsap.utils.random(1.5, 3, 0.1) * direction;
        card.style.setProperty("--book-slider-item-rotate", `${-rotation}deg`);
        return { card, rotation, yOffset: gsap.utils.random(3, 9, 0.1) * direction };
      });
      const tilt = () => {
        const box = viewport.getBoundingClientRect();
        const middle = box.left + box.width / 2;
        // Measure every card before moving any: alternating the two made the browser redo its styles once per card
        const centres = settings.map(({ card }) => { const r = card.getBoundingClientRect(); return r.left + r.width / 2; });
        settings.forEach(({ card, rotation, yOffset }, i) => {
          const strength = Math.sin(gsap.utils.clamp(-2, 2, (centres[i] - middle) / (box.width / 2)) * 1.2);
          card.style.transform = `translateY(${strength * yOffset}%) rotate(${strength * rotation}deg)`;
        });
      };
      let slider = null;
      let unlisten = null;
      [slider, unlisten] = withWindowListeners(() => new window.Smooothy(wrapper, {
        infinite: false, snap: false, dragSensitivity: 0.008, lerpFactor: 0.225, bounceLimit: 0.5,
        setOffset: ({ wrapperWidth }) => wrapperWidth - 32,
        onUpdate: () => {
          if (!slider) return;
          tilt();
          const atStart = slider.currentSlide <= 0;
          const atEnd = gsap.utils.clamp(0, 1, slider.progress) >= 0.95;
          prev?.classList.toggle("is--disabled", atStart);
          next?.classList.toggle("is--disabled", atEnd);
          prev?.setAttribute("aria-disabled", String(atStart));
          next?.setAttribute("aria-disabled", String(atEnd));
        },
      }));
      // A shelf whose books all fit on screen has nothing to slide. Smooothy's limits then turned inside out and any
      // input (even scrolling the page past it) sent the books back and forth, so such a shelf simply stands still.
      if (slider.maxScroll >= 0) {
        slider.destroy();
        unlisten();
        tilt();
        section.querySelector("[data-books-slider-controls]")?.setAttribute("hidden", "");
        viewport.classList.add("is--still");
        viewport.removeAttribute("tabindex");
        return;
      }
      // Smooothy's own wheel handling also reacted to scrolling the page with the pointer over the shelf. Only a
      // sideways swipe (a trackpad) moves the shelf now; scrolling up and down belongs to the page.
      slider.virtualScroll?.destroy();
      viewport.addEventListener("wheel", (event) => {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        slider.target = gsap.utils.clamp(slider.maxScroll, 0, slider.target - event.deltaX * 0.004);
      }, { passive: false });
      let downX = 0;
      let dragged = false;
      wrapper.addEventListener("pointerdown", (event) => { downX = event.clientX; dragged = false; });
      wrapper.addEventListener("pointermove", (event) => { if (Math.abs(event.clientX - downX) > 6) dragged = true; });
      wrapper.addEventListener("click", (event) => {
        if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; }
      }, true);
      prev?.addEventListener("click", () => slider.goToPrev());
      next?.addEventListener("click", () => slider.goToNext());
      viewport.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); slider.goToNext(); }
        if (event.key === "ArrowLeft") { event.preventDefault(); slider.goToPrev(); }
      });
      // The shelf only needs updating while it is on screen
      const tick = () => slider.update();
      ScrollTrigger.create({
        trigger: section, start: "top bottom", end: "bottom top",
        onToggle: (self) => (self.isActive ? gsap.ticker.add(tick) : gsap.ticker.remove(tick)),
      });
      instances.push({ slider, unlisten, tick, cards });
    });
    return () => instances.forEach(({ slider, unlisten, tick, cards }) => {
      gsap.ticker.remove(tick);
      slider.destroy();
      unlisten();
      cards.forEach((card) => { card.style.transform = ""; card.style.removeProperty("--book-slider-item-rotate"); });
    });
  }

  // How it works: cards fly up into a messy fan; the one under the pointer straightens and the rest make room
  function fannedCards(page) {
    const container = page.querySelector("[data-call-out]");
    if (!container) return;
    const cards = [...container.querySelectorAll("[data-call-out-item]")];
    const contents = cards.map((c) => c.querySelector("[data-call-out-child]"));
    const messy = () => ({ xPercent: (Math.random() - 0.5) * 4, yPercent: (Math.random() - 0.5) * 8, rotation: (Math.random() - 0.5) * 9 });
    if (!desktop.matches) {
      gsap.timeline({ scrollTrigger: { trigger: container, start: "top 85%", once: true } })
        .from(cards, { yPercent: 60, duration: 0.9, ease: ELASTIC_SOFT, stagger: 0.08 }, 0)
        .from(cards, { opacity: 0, duration: 0.3, ease: "power1.out", stagger: 0.08 }, 0);
      return;
    }
    cards.forEach((card) => gsap.set(card, messy()));
    gsap.from(cards, { yPercent: "+=150", rotation: (Math.random() - 0.5) * 15, duration: 1.05, ease: ELASTIC_SOFT, stagger: 0.088,
      scrollTrigger: { trigger: container, start: "top 85%", once: true } });
    let active = 0;
    const settle = (i) => {
      gsap.to(cards[i], { xPercent: 0, yPercent: 0, rotation: 0, scale: 1.075, duration: 0.85, ease: ELASTIC_SOFT });
      contents.forEach((content, j) => gsap.to(content, { xPercent: j === i ? 0 : 45 / (j - i), duration: 0.85, ease: ELASTIC_SOFT }));
    };
    const unsettle = (i) => gsap.to(cards[i], { ...messy(), rotation: (Math.random() - 0.5) * 20, scale: 1, duration: 0.85, ease: ELASTIC_SOFT });
    const move = (event) => {
      if (!finePointer.matches) return;
      const box = container.getBoundingClientRect();
      const portion = Math.ceil(((event.clientX - box.left) / box.width) * cards.length);
      if (portion === active || portion < 1 || portion > cards.length) return;
      if (active) unsettle(active - 1);
      active = portion;
      settle(active - 1);
    };
    const leave = () => {
      if (active) unsettle(active - 1);
      active = 0;
      gsap.to(contents, { xPercent: 0, duration: 0.85, ease: ELASTIC_SOFT });
    };
    container.addEventListener("mousemove", move);
    container.addEventListener("mouseleave", leave);
    return () => { container.removeEventListener("mousemove", move); container.removeEventListener("mouseleave", leave); };
  }

  function plopIn(page) {
    page.querySelectorAll("[data-plop-in]").forEach((wrap) => {
      const item = wrap.querySelector("[data-plop-in-item]");
      gsap.fromTo(item, { scale: 0, rotate: -20, y: "-4em" },
        { scale: 1, rotate: 11, y: "0em", duration: 0.7, ease: ELASTIC, scrollTrigger: { trigger: wrap, start: "top 80%" } });
    });
  }

  // A closed book turns to face you, opens, flips a few pages and you fall into the page
  function openingBook(page) {
    const section = page.querySelector("[data-book-open]");
    if (!section) return;
    const book = section.querySelector("[data-book-open-book]");
    const cover = section.querySelector("[data-book-open-cover]");
    const leaves = section.querySelectorAll("[data-book-open-leaf]");
    const note = section.querySelector("[data-book-open-note]");
    const title = section.querySelector("[data-book-open-title]");
    const buttons = section.querySelectorAll("[data-book-open-button]");
    const aside = section.querySelector("[data-book-open-aside]");
    const depth = parseFloat(getComputedStyle(book).getPropertyValue("--d")) * parseFloat(getComputedStyle(book).fontSize) || 50;
    const width = book.offsetWidth;

    gsap.set(cover, { z: depth / 2, transformOrigin: "left center" });
    gsap.set(leaves, { z: (i) => depth / 2 - 3 + i, transformOrigin: "left center" });
    gsap.set(book, { rotationX: 50, rotationZ: -24, scale: 0.72, y: "30vh", x: 0 });

    const noteChars = scribbleIn(note).chars;
    const asideChars = scribbleIn(aside).chars;
    const noteTl = gsap.timeline({ paused: true }).to(noteChars, { ...scribbleTo, duration: 0.625, stagger: 0.011 });
    gsap.set(title, { opacity: 0, y: "1em" });
    gsap.set(buttons, { scale: 0, rotate: () => gsap.utils.random(-16, 16) });
    const finalTl = gsap.timeline({ paused: true })
      .to(title, { y: "0em", ease: ELASTIC_SOFT, duration: 0.625 }, 0)
      .to(title, { opacity: 1, ease: "power1.out", duration: 0.3 }, 0)
      .to(buttons, { scale: 1, rotate: 0, ease: ELASTIC_SOFT, duration: 0.625, stagger: 0.026 }, 0.15)
      .to(asideChars, { ...scribbleTo, duration: 0.625, stagger: 0.011 }, 0.2);

    // The book rises, opens, turns its first pages and draws in until one page fills the screen; then it holds still for
    // the last stretch of the scroll, and only then do the words and buttons come, on a clean page. They follow the
    // book as it is drawn (the animation's own progress, which trails the scroll a little), not the scroll itself:
    // timed by the scroll, they arrived while the book was still half open behind them.
    const tl = gsap.timeline({ defaults: { ease: "none" } })
      .to(book, { rotationX: 8, rotationZ: -4, scale: 1, y: 0, duration: 0.22, ease: "power2.out" }, 0)
      .to(book, { x: width / 2, rotationX: 4, rotationZ: 0, duration: 0.26, ease: "power1.inOut" }, 0.22)
      .to(cover, { rotationY: -178, duration: 0.26, ease: "power2.inOut" }, 0.22)
      .to(leaves, { rotationY: (i) => -172 + i * 6, duration: 0.18, ease: "power2.inOut", stagger: 0.06 }, 0.36)
      .to(book, { scale: 3.2, x: width * 0.05, y: "-4vh", rotationX: 0, duration: 0.24, ease: "power2.inOut" }, 0.62)
      .to({}, { duration: 0.14 }, 0.86);

    let noteState = "before";
    let finalState = "before";
    tl.eventCallback("onUpdate", () => {
      const at = tl.progress();
      const wanted = at >= 0.26 && at < 0.58 ? "played" : "hidden";
      if (wanted !== noteState) {
        if (wanted === "played") noteTl.timeScale(1.5).play(); else noteTl.timeScale(3.5).reverse();
        noteState = wanted;
      }
      const show = at >= 0.88 ? "played" : "hidden";
      if (show !== finalState) {
        if (show === "played") finalTl.timeScale(1.25).play(); else finalTl.timeScale(3.5).reverse();
        finalState = show;
      }
    });
    ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", scrub: 0.6, animation: tl });
  }

  // Genres: four covers pop out around the genre under the pointer and drift with it
  // FAQ page: the topic you are reading lights up in the list (and, on a phone, slides into view in the pill row)
  function faqTopics(page) {
    const pills = [...page.querySelectorAll("[data-faq-pill]")];
    if (!pills.length) return;
    const row = pills[0].closest("ul");
    let settled = false;
    const light = (id) => pills.forEach((pill) => {
      const on = pill.getAttribute("href") === `#${id}`;
      pill.classList.toggle("is--active", on);
      if (on) pill.setAttribute("aria-current", "true"); else pill.removeAttribute("aria-current");
      // Only when the lit pill is out of sight, and never while the page loads: a scroll then (even one made by the
      // page) made Chrome stop measuring when the page's main text appeared
      if (on && settled && (pill.offsetLeft < row.scrollLeft || pill.offsetLeft + pill.offsetWidth > row.scrollLeft + row.clientWidth)) {
        row.scrollTo({ left: pill.offsetLeft - 16, behavior: "smooth" });
      }
    });
    // The topic whose heading has most recently passed the upper third of the screen; short topics included
    const groups = [...page.querySelectorAll("[data-faq-group]")];
    let current = "";
    const pick = () => {
      const passed = groups.filter((g) => g.getBoundingClientRect().top < innerHeight * 0.35);
      const id = (passed[passed.length - 1] || groups[0]).id;
      if (id !== current) { current = id; light(id); }
    };
    ScrollTrigger.create({ trigger: groups[0].parentElement, start: "top bottom", end: "bottom top", onUpdate: pick, onRefresh: pick });
    pills.forEach((pill) => pill.addEventListener("click", () => { current = pill.getAttribute("href").slice(1); light(current); }));
    pick();
    settled = true;
    // The questions rise in a few at a time as they come into view
    const questions = page.querySelectorAll(".faqs .accordion");
    gsap.set(questions, { y: "2em", opacity: 0 });
    ScrollTrigger.batch(questions, {
      start: "top 94%", once: true,
      onEnter: (batch) => gsap.to(batch, { y: "0em", opacity: 1, duration: 0.7, ease: "back.out(1.4)", stagger: 0.06 }),
    });
  }

  // Genres page: covers drop in shelf by shelf, and a mouse can drag a shelf sideways like a phone can swipe it
  function genreShelves(page) {
    const rows = [...page.querySelectorAll("[data-shelf-row]")];
    if (!rows.length) return;
    const stop = riseIn([...page.querySelectorAll(".shelf__item")], 0.04);
    if (stop) pageCleanups.push(stop);
    const cleanups = rows.map((row) => {
      let startX = 0, startLeft = 0, dragging = false, moved = false;
      const down = (event) => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        dragging = true; moved = false; startX = event.clientX; startLeft = row.scrollLeft;
        row.style.scrollSnapType = "none";
      };
      const move = (event) => {
        if (!dragging) return;
        const dx = event.clientX - startX;
        if (Math.abs(dx) > 5) moved = true;
        row.scrollLeft = startLeft - dx;
      };
      const up = () => { dragging = false; row.style.scrollSnapType = ""; };
      const click = (event) => { if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; } };
      row.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      row.addEventListener("click", click, true);
      row.addEventListener("dragstart", (event) => event.preventDefault());
      return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    });
    return () => cleanups.forEach((fn) => fn());
  }

  function genreCovers(page) {
    const section = page.querySelector("[data-genre-interaction]");
    if (!section) return;
    const list = section.querySelector("[data-genre-interaction-list]");
    const scope = section.querySelector("[data-genre-interaction-scope]");
    const items = [...list.querySelectorAll("[data-genre-interaction-item]")];
    const boxes = [...section.querySelectorAll("[data-genre-interaction-box]")];
    let bounds = null;
    const activate = (item) => {
      const index = items.indexOf(item);
      const word = item.querySelector(".genre__default");
      scope.style.setProperty("--hold-y", `${item.offsetTop + item.offsetHeight / 2}px`);
      scope.style.setProperty("--hold-w", `${word.offsetWidth}px`);
      boxes.forEach((box) => {
        [...box.children].forEach((img, i) => img.classList.toggle("is--shown", i === index));
        box.style.setProperty("--x", gsap.utils.random(-15, 15));
        box.style.setProperty("--y", gsap.utils.random(-15, 15));
        box.style.setProperty("--r", gsap.utils.random(-15, 15));
      });
      bounds = list.getBoundingClientRect();
    };
    const parallax = (event) => {
      if (!bounds) return;
      boxes.forEach((box) => {
        box.style.setProperty("--px", (event.clientX - bounds.x) / bounds.width - 0.5);
        box.style.setProperty("--py", (event.clientY - bounds.y) / bounds.height - 0.5);
      });
    };
    // One switch shows a genre (its name handwritten, its covers out): is--active, set by a mouse or pen pointing at
    // it, by the keyboard, or by a press on a touch screen. Not the browser's own :hover: a phone sets that the moment
    // a finger lands, so the covers came out, and then moved again when the press placed them.
    let shown = null;
    const show = (item) => {
      if (item === shown) return;
      shown?.classList.remove("is--active");
      shown = item;
      item.classList.add("is--active");
      activate(item);
    };
    const hide = (item) => {
      if (!item || item !== shown) return;
      item.classList.remove("is--active");
      shown = null;
    };
    const handlers = items.map((item) => {
      const enter = (event) => { if (event.pointerType !== "touch") show(item); };
      const leave = (event) => { if (event.pointerType !== "touch") hide(item); };
      const focusIn = () => show(item);
      const focusOut = () => hide(item);
      item.addEventListener("pointerenter", enter);
      item.addEventListener("pointerleave", leave);
      item.addEventListener("focusin", focusIn);
      item.addEventListener("focusout", focusOut);
      return () => {
        item.removeEventListener("pointerenter", enter);
        item.removeEventListener("pointerleave", leave);
        item.removeEventListener("focusin", focusIn);
        item.removeEventListener("focusout", focusOut);
      };
    });
    list.addEventListener("pointermove", parallax);
    // A phone cannot point: pressing a genre, and holding it, shows it and keeps it so; a tap still opens it. A
    // moment's wait first, so a finger that starts a scroll on the list changes nothing, and holding brings up no
    // menu for the link.
    let waiting = 0;
    let downAt = 0;
    const press = (event) => {
      if (event.pointerType !== "touch") return;
      const item = event.target.closest("[data-genre-interaction-item]");
      if (!item) return;
      downAt = performance.now();
      clearTimeout(waiting);
      waiting = setTimeout(() => show(item), 140);
    };
    const scrolling = () => clearTimeout(waiting); // the finger moved the page: whatever is shown stays, nothing new
    const elsewhere = (event) => { if (event.pointerType === "touch" && shown && !list.contains(event.target)) hide(shown); };
    const noMenu = (event) => { if (event.target.closest("[data-genre-interaction-item]")) event.preventDefault(); };
    // a press held to look is not a tap: letting go does not open the genre
    const heldOpen = (event) => {
      if (downAt && performance.now() - downAt > 450) { event.preventDefault(); event.stopPropagation(); }
      downAt = 0;
    };
    list.addEventListener("pointerdown", press);
    list.addEventListener("pointercancel", scrolling);
    list.addEventListener("contextmenu", noMenu);
    list.addEventListener("click", heldOpen, true);
    document.addEventListener("pointerdown", elsewhere);
    gsap.timeline({ scrollTrigger: { trigger: list, start: "top 85%", once: true } })
      .from(items, { yPercent: 40, rotate: 3, duration: 0.8, ease: ELASTIC_SOFT, stagger: 0.04 }, 0)
      .from(items, { opacity: 0, duration: 0.3, ease: "power1.out", stagger: 0.04 }, 0);
    return () => {
      handlers.forEach((undo) => undo());
      list.removeEventListener("pointermove", parallax);
      clearTimeout(waiting);
      hide(shown);
      list.removeEventListener("pointerdown", press);
      list.removeEventListener("pointercancel", scrolling);
      list.removeEventListener("contextmenu", noMenu);
      list.removeEventListener("click", heldOpen, true);
      document.removeEventListener("pointerdown", elsewhere);
    };
  }

  // Why: stickers slap on one after another; the ring turns as you scroll past
  function stickers(page) {
    page.querySelectorAll("[data-benefits]").forEach((section) => {
      const items = section.querySelectorAll("[data-benefits-item]");
      gsap.fromTo(items, { rotation: () => gsap.utils.random(-33, 33), scale: 0 },
        { rotation: 0, scale: 1, ease: ELASTIC_SOFT, duration: 0.85, stagger: 0.072,
          scrollTrigger: { trigger: section, start: "top 40%", once: true } });
      const ring = section.querySelector(".why__ring");
      gsap.fromTo(ring, { rotation: -60 }, { rotation: 120, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.5 } });
      const badge = section.querySelector("[data-badge-spin]");
      gsap.from(badge, { scale: 0.4, rotate: -40, opacity: 0, duration: 1, ease: ELASTIC_SOFT, scrollTrigger: { trigger: section, start: "top 70%", once: true } });
    });
  }

  // Questions open and close with a smooth height animation
  function accordions(page) {
    page.querySelectorAll("[data-accordion]").forEach((details) => {
      const summary = details.querySelector("[data-accordion-summary]");
      const content = details.querySelector("[data-accordion-content]");
      let animation = null;
      const run = (from, to, open) => {
        animation?.cancel();
        animation = details.animate({ height: [from, to] }, { duration: reducedMotion() ? 0 : 450, easing: "cubic-bezier(.32, .72, 0, 1)" });
        animation.onfinish = () => { details.open = open; animation = null; details.style.height = ""; details.style.overflow = ""; };
      };
      summary.addEventListener("click", (event) => {
        event.preventDefault();
        details.style.overflow = "clip";
        if (!details.open || details.classList.contains("is--closing")) {
          details.style.height = `${details.offsetHeight}px`;
          details.open = true;
          details.classList.add("is--active");
          details.classList.remove("is--closing");
          requestAnimationFrame(() => run(`${details.offsetHeight}px`, `${summary.offsetHeight + content.offsetHeight}px`, true));
        } else {
          details.classList.remove("is--active");
          details.classList.add("is--closing");
          run(`${details.offsetHeight}px`, `${summary.offsetHeight}px`, false);
          animation.addEventListener("finish", () => details.classList.remove("is--closing"));
        }
      });
    });
  }

  /* The tagline slides along its curve as you scroll. Sliding the SVG text along its path made the browser lay the
     text out and repaint it on every frame, the heaviest thing left in a phone's scroll. Instead each letter is an
     element of its own, placed on the curve the way SVG would place it (its middle on the path, turned to follow it)
     and moved with a transform alone, which the graphics card handles without any layout or repaint. */
  function taglineCurve(page) {
    page.querySelectorAll("[data-tagline-curve]").forEach((wrap) => whenNear(wrap, () => {
      const svg = wrap.querySelector("svg");
      const path = wrap.querySelector("path");
      const source = wrap.querySelector("[data-tagline-text]");
      const total = path.getTotalLength();
      // Asking the path for points is slow on a phone, so it is sampled once and read from the samples after that
      const STEP = 4;
      const samples = [];
      for (let d = 0; d <= total + STEP; d += STEP) {
        const point = path.getPointAtLength(Math.min(d, total));
        samples.push(point.x, point.y);
      }
      const last = samples.length / 2 - 2;
      const pointAt = (d) => {
        const f = gsap.utils.clamp(0, total, d) / STEP;
        const i = Math.min(Math.floor(f), last);
        const t = f - i;
        return [samples[2 * i] + (samples[2 * i + 2] - samples[2 * i]) * t,
          samples[2 * i + 1] + (samples[2 * i + 3] - samples[2 * i + 1]) * t];
      };
      const layer = document.createElement("div");
      layer.className = "tagline__letters";
      const ruler = document.createElement("span");
      ruler.className = "tagline__ruler";
      ruler.textContent = source.textContent;
      const baselineMark = document.createElement("i");
      ruler.append(baselineMark);
      const letters = [...source.textContent].map((char) => {
        const letter = document.createElement("span");
        letter.textContent = char;
        return letter;
      });
      layer.append(ruler, ...letters);
      wrap.append(layer);
      wrap.classList.add("is--letters");

      let scale = 1, length = 0, baseline = 0, starts = [], widths = [];
      const measure = () => {
        scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
        layer.style.fontSize = `${parseFloat(getComputedStyle(source.parentNode).fontSize) * scale}px`;
        const box = ruler.getBoundingClientRect();
        const range = document.createRange();
        const text = ruler.firstChild;
        starts = letters.map((_, i) => { range.setStart(text, i); range.setEnd(text, i + 1); return range.getBoundingClientRect().left - box.left; });
        widths = letters.map((_, i) => { range.setStart(text, i); range.setEnd(text, i + 1); return range.getBoundingClientRect().width; });
        length = box.width;
        baseline = baselineMark.getBoundingClientRect().bottom - box.top;
        letters.forEach((letter, i) => { letter.style.transformOrigin = `${widths[i] / 2}px ${baseline}px`; });
      };
      const place = (progress) => {
        // From just past the end of the curve to just before its start, as the text's own startOffset used to go
        const start = total - progress * (total + length / scale);
        letters.forEach((letter, i) => {
          const middle = start + (starts[i] + widths[i] / 2) / scale;
          const off = middle < 0 || middle > total;
          letter.style.visibility = off ? "hidden" : "";
          if (off) return;
          const [x, y] = pointAt(middle);
          const ahead = pointAt(middle + STEP);
          const behind = pointAt(middle - STEP);
          const angle = Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]);
          letter.style.transform = `translate(${x * scale - widths[i] / 2}px, ${y * scale - baseline}px) rotate(${angle}rad)`;
        });
      };
      const state = { progress: 0 };
      measure();
      place(0);
      gsap.to(state, {
        progress: 1, ease: "none", onUpdate: () => place(state.progress),
        scrollTrigger: {
          trigger: wrap, start: "top bottom", end: "bottom top", scrub: 0.5,
          onRefresh: () => { measure(); place(state.progress); },
        },
      });
    }));
  }

  function giftPop(page) {
    page.querySelectorAll("[data-gift]").forEach((wrap) => {
      gsap.fromTo(wrap.querySelector("[data-gift-item]"), { rotate: 30, scale: 0 },
        { rotate: -21, scale: 1, ease: "back.out(1.6)", duration: 0.9, scrollTrigger: { trigger: wrap, start: "top 72%", once: true } });
    });
  }

  // Ribbons run on forever, and turn around when you scroll back up
  function ribbons(page) {
    const tweens = [];
    page.querySelectorAll("[data-marquee]").forEach((ribbon) => {
      const track = ribbon.querySelector(".ribbon__track");
      const way = Number(ribbon.dataset.marquee);
      const tween = gsap.fromTo(track, { xPercent: way > 0 ? 0 : -50 }, { xPercent: way > 0 ? -50 : 0, duration: 40, ease: "none", repeat: -1 });
      tweens.push(tween);
    });
    if (!tweens.length) return;
    ScrollTrigger.create({
      trigger: page.querySelector(".ribbons"), start: "top bottom", end: "bottom top",
      onUpdate: (self) => {
        const speed = gsap.utils.clamp(1, 6, 1 + Math.abs(self.getVelocity()) / 600);
        tweens.forEach((t) => gsap.to(t, { timeScale: self.direction * speed, duration: 0.3, overwrite: true }));
      },
    });
  }

  // Confetti in the brand colours: little sparkles, dots, books and squiggles
  const confettiBox = document.querySelector("[data-confetti-container]");
  const CONFETTI_COLOURS = ["#ffd24a", "#ff008c", "#1ce8ed", "#3b308f", "#f9a220", "#69fe6f", "#9982de"];
  const CONFETTI_SHAPES = [
    (c) => `<svg viewBox="-12 -12 24 24"><path fill="${c}" d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z"/></svg>`,
    (c) => `<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.2" fill="${c}"/></svg>`,
    (c) => `<svg viewBox="0 0 10 14"><rect x="1" y="1" width="8" height="12" rx="1.2" fill="${c}"/><rect x="1" y="1" width="2" height="12" fill="rgba(0,0,0,.2)"/></svg>`,
    (c) => `<svg viewBox="0 0 24 10"><path d="M2 6c3-4 5 4 8 0s5 4 8 0 3-2 4-2" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  ];
  function confettiBit() {
    const bit = document.createElement("div");
    bit.className = "confetti__bit";
    bit.innerHTML = gsap.utils.random(CONFETTI_SHAPES)(gsap.utils.random(CONFETTI_COLOURS));
    confettiBox.appendChild(bit);
    return bit;
  }
  function confettiBurst(x, y, count = 26) {
    if (reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const bit = confettiBit();
      const angle = gsap.utils.random(-160, -20) * Math.PI / 180;
      const speed = gsap.utils.random(140, 340);
      gsap.timeline({ onComplete: () => bit.remove() })
        .set(bit, { x, y, scale: gsap.utils.random(0.6, 1.2), rotation: gsap.utils.random(-90, 90) })
        .to(bit, { x: x + Math.cos(angle) * speed, y: y + Math.sin(angle) * speed, rotation: "+=" + gsap.utils.random(-240, 240), duration: 0.6, ease: "power3.out" })
        .to(bit, { y: "+=" + gsap.utils.random(160, 320), autoAlpha: 0, duration: gsap.utils.random(0.8, 1.3), ease: "power1.in" });
    }
  }
  function confettiRain(page) {
    page.querySelectorAll("[data-confetti-rain]").forEach((section) => {
      let running = false;
      ScrollTrigger.create({
        trigger: section, start: "top 70%",
        onEnter: (self) => {
          if (running || self.direction !== 1 || reducedMotion()) return;
          running = true;
          for (let i = 0; i < 46; i++) {
            const bit = confettiBit();
            const delay = gsap.utils.random(0, 1.2);
            gsap.fromTo(bit, { x: gsap.utils.random(0, innerWidth), y: -40, rotation: gsap.utils.random(0, 360), scale: gsap.utils.random(0.6, 1.3) },
              { y: innerHeight + 60, x: "+=" + gsap.utils.random(-120, 120), rotation: "+=" + gsap.utils.random(-540, 540), delay,
                duration: gsap.utils.random(1.6, 2.6), ease: "power1.in", onComplete: () => bit.remove() });
          }
          gsap.delayedCall(4, () => { running = false; });
        },
      });
    });
  }

  // Book pages: the cover leans towards the pointer and bobs gently; downloading a book sets off confetti
  function bookPage(page) {
    const area = page.querySelector(".book-hero");
    const target = page.querySelector("[data-book-tilt-target]");
    const download = page.querySelector(".book-hero a[download]");
    const cleanups = [];
    if (download) {
      // A little celebration for a book that's yours to keep
      const cheer = () => {
        const box = download.getBoundingClientRect();
        confettiBurst(box.left + box.width / 2, box.top + box.height / 2);
      };
      download.addEventListener("click", cheer);
      cleanups.push(() => download.removeEventListener("click", cheer));
    }
    if (target && !reducedMotion()) {
      gsap.to(target, { y: "-1em", duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
      if (finePointer.matches) {
        const turnY = gsap.quickTo(target, "rotationY", { duration: 0.8, ease: "power3" });
        const turnX = gsap.quickTo(target, "rotationX", { duration: 0.8, ease: "power3" });
        const move = (event) => {
          turnY((event.clientX / innerWidth - 0.5) * 30);
          turnX((event.clientY / innerHeight - 0.5) * -16);
        };
        area.addEventListener("pointermove", move);
        cleanups.push(() => area.removeEventListener("pointermove", move));
      }
    }
    return () => cleanups.forEach((fn) => fn());
  }

  // Emoji you brush past get flung by your pointer's speed and spin back into place
  function momentumHover(page) {
    if (!finePointer.matches || !window.InertiaPlugin) return;
    const cleanups = [];
    page.querySelectorAll("[data-momentum-hover]").forEach((area) => {
      let prevX = 0, prevY = 0, velX = 0, velY = 0, raf = 0;
      const track = (event) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          velX = event.clientX - prevX; velY = event.clientY - prevY;
          prevX = event.clientX; prevY = event.clientY; raf = 0;
        });
      };
      area.addEventListener("mousemove", track);
      cleanups.push(() => area.removeEventListener("mousemove", track));
      area.querySelectorAll("[data-momentum-hover-element]").forEach((el) => {
        const target = el.querySelector("[data-momentum-hover-target]");
        const hit = (event) => {
          const box = target.getBoundingClientRect();
          const ox = event.clientX - (box.left + box.width / 2);
          const oy = event.clientY - (box.top + box.height / 2);
          const torque = (ox * velY - oy * velX) / (Math.hypot(ox, oy) || 1);
          gsap.to(target, {
            inertia: {
              x: { velocity: gsap.utils.clamp(-1080, 1080, velX * 25), end: 0 },
              y: { velocity: gsap.utils.clamp(-1080, 1080, velY * 25), end: 0 },
              rotation: { velocity: gsap.utils.clamp(-60, 60, torque * 15), end: 0 },
              resistance: 160,
            },
          });
        };
        el.addEventListener("mouseenter", hit);
        cleanups.push(() => el.removeEventListener("mouseenter", hit));
      });
      gsap.from(area.querySelectorAll("[data-momentum-hover-element]"), { scale: 0, rotate: -30, duration: 0.8, ease: ELASTIC, stagger: 0.1,
        scrollTrigger: { trigger: area.querySelector(".spotlight__frame"), start: "top 75%", once: true } });
    });
    return () => cleanups.forEach((fn) => fn());
  }

  // The footer slides out from under the page
  function footerParallax(page) {
    const footer = page.querySelector("[data-footer-parallax]");
    if (!footer || !desktop.matches) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: footer, start: "clamp(top bottom)", end: "clamp(top top)", scrub: 0.2 } });
    tl.fromTo(footer.querySelector("[data-footer-parallax-top]"), { y: "-12.5em" }, { y: "0em", ease: "none" })
      .fromTo(footer.querySelector("[data-footer-parallax-bottom]"), { y: "-12.5em" }, { y: "0em", ease: "none" }, "<")
      .fromTo(footer.querySelector(".footer__wordmark"), { yPercent: 35 }, { yPercent: 0, ease: "none" }, "<");
  }

  // Sections pop up a little as they arrive
  function sectionEntrances(page) {
    page.querySelectorAll(".books__title, .flow__title, .faq__title, .favs__title, .spotlight__title, .gift__title, .faqs__title, .shelf__name, .mine__title, .guide__title, .lines__title").forEach((title) => whenNear(title, () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: title, start: "top 88%", once: true } });
      stretchWords(tl, title, 0);
    }));
  }

  // All books: search; fiction or non-fiction; a genre or a collection (From India); mood and length. Every choice is
  // kept in the address, so Back, a reload or a shared link shows the same books.
  function catalogue(page) {
    const rootEl = page.querySelector("[data-search-root]");
    if (!rootEl) return;
    const input = rootEl.querySelector("[data-search-input]");
    const chips = [...rootEl.querySelectorAll(".chip")];
    const kinds = [...rootEl.querySelectorAll(".kinds [data-kind]")];
    const moodSelect = rootEl.querySelector("[data-mood]");
    const lengthSelect = rootEl.querySelector("[data-length]");
    const clear = rootEl.querySelector("[data-clear-filters]");
    const cards = [...rootEl.querySelectorAll(".book-card")];
    const status = rootEl.querySelector("[data-search-status]");
    const empty = rootEl.querySelector("[data-search-empty]");
    const LENGTHS = { short: [0, 180], medium: [180, 480], long: [480, Infinity] };
    const params = new URLSearchParams(location.search);
    const pick = (value, allowed) => (allowed.includes(value) ? value : "");
    const state = {
      kind: pick(params.get("kind"), ["fiction", "nonfiction"]),
      genre: pick(params.get("genre"), chips.map((c) => c.dataset.genre).filter(Boolean)),
      collection: pick(params.get("collection"), chips.map((c) => c.dataset.collection).filter(Boolean)),
      mood: pick(params.get("mood"), [...(moodSelect?.options || [])].map((o) => o.value).filter(Boolean)),
      length: pick(params.get("length"), Object.keys(LENGTHS)),
    };
    // a genre belongs to one kind: choosing it shows that kind, and a kind hides the other kind's genres
    const genreChip = () => chips.find((c) => c.dataset.genre && c.dataset.genre === state.genre);
    if (state.genre && genreChip()) state.kind = genreChip().dataset.chipKind;

    const keep = () => {
      const url = new URL(location.href);
      ["kind", "genre", "collection", "mood", "length"].forEach((key) => {
        if (state[key]) url.searchParams.set(key, state[key]); else url.searchParams.delete(key);
      });
      history.replaceState(history.state, "", url);
    };
    const apply = (animate = true) => {
      // Accents dropped, as in the cards' search text, so "bronte" finds Brontë
      const words = input.value.trim().toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").split(/\s+/).filter(Boolean);
      const [least, most] = LENGTHS[state.length] || [0, Infinity];
      const shown = [];
      cards.forEach((card) => {
        const d = card.dataset;
        const match = words.every((w) => d.search.includes(w))
          && (!state.kind || d.bookKind === state.kind)
          && (!state.genre || d.genres.split(" ").includes(state.genre))
          && (!state.collection || d.collections.split(" ").includes(state.collection))
          && (!state.mood || d.moods.split(" ").includes(state.mood))
          && Number(d.minutes) >= least && Number(d.minutes) < most;
        const was = !card.hidden;
        card.hidden = !match;
        if (match && !was) shown.push(card);
      });
      kinds.forEach((k) => k.setAttribute("aria-pressed", String(k.dataset.kind === state.kind)));
      chips.forEach((c) => {
        c.parentElement.hidden = Boolean(state.kind && c.dataset.chipKind && c.dataset.chipKind !== state.kind);
        c.setAttribute("aria-pressed", String(c.dataset.genre ? c.dataset.genre === state.genre : c.dataset.collection === state.collection));
      });
      if (moodSelect) moodSelect.value = state.mood;
      if (lengthSelect) lengthSelect.value = state.length;
      const count = cards.filter((c) => !c.hidden).length;
      // what the books shown have in common, in words: "12 books match “sea” in Adventure, gripping, under 3 hours"
      const label = (select) => select?.selectedOptions[0]?.textContent.toLowerCase();
      const what = [
        words.length ? `“${input.value.trim()}”` : "",
        state.genre ? genreChip()?.textContent : state.collection ? chips.find((c) => c.dataset.collection === state.collection)?.textContent
          : state.kind === "nonfiction" ? "non-fiction" : state.kind === "fiction" ? "fiction" : "",
        state.mood ? label(moodSelect) : "",
        state.length ? label(lengthSelect) : "",
      ].filter(Boolean);
      status.textContent = count === cards.length ? `Showing all ${count} books.`
        : `${count} ${count === 1 ? "book matches" : "books match"}: ${what.join(", ")}.`;
      empty.hidden = count > 0;
      clear.hidden = !(state.kind || state.genre || state.collection || state.mood || state.length || words.length);
      if (animate && shown.length && !reducedMotion()) {
        gsap.fromTo(shown, { scale: 0.6, rotate: () => gsap.utils.random(-8, 8) },
          { scale: 1, rotate: 0, duration: 0.7, ease: ELASTIC_SOFT, stagger: 0.04, clearProps: "scale,rotate" });
        gsap.fromTo(shown, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.out", stagger: 0.04, clearProps: "opacity" });
      }
      if (animate) ScrollTrigger.refresh();
    };
    const change = () => { keep(); apply(); };
    input.addEventListener("input", () => apply());
    rootEl.querySelector("[data-search-form]").addEventListener("submit", (event) => event.preventDefault());
    kinds.forEach((k) => k.addEventListener("click", () => {
      state.kind = k.dataset.kind;
      if (state.genre && genreChip()?.dataset.chipKind !== state.kind) state.genre = "";
      change();
    }));
    chips.forEach((chip) => chip.addEventListener("click", () => {
      if (chip.dataset.genre) {
        state.genre = state.genre === chip.dataset.genre ? "" : chip.dataset.genre;
        state.collection = "";
        if (state.genre) state.kind = chip.dataset.chipKind;
      } else {
        state.collection = state.collection === chip.dataset.collection ? "" : chip.dataset.collection;
        state.genre = "";
      }
      change();
    }));
    moodSelect?.addEventListener("change", () => { state.mood = moodSelect.value; change(); });
    lengthSelect?.addEventListener("change", () => { state.length = lengthSelect.value; change(); });
    clear.addEventListener("click", () => {
      Object.keys(state).forEach((key) => { state[key] = ""; });
      input.value = "";
      change();
      input.focus();
    });
    apply(false);
    // Sorting: most read (the shelf's own order), title, or length; kept in the address so Back returns to it
    const grid = rootEl.querySelector("[data-search-grid]");
    const sorter = rootEl.querySelector("[data-sort]");
    const orders = {
      rank: (a, b) => a.dataset.rank - b.dataset.rank,
      title: (a, b) => a.dataset.title.localeCompare(b.dataset.title),
      short: (a, b) => a.dataset.words - b.dataset.words,
      long: (a, b) => b.dataset.words - a.dataset.words,
    };
    const sortBy = (key, animate) => {
      if (!orders[key]) return;
      grid.append(...[...cards].sort(orders[key]));
      if (animate && !reducedMotion()) {
        const inView = cards.filter((c) => !c.hidden && c.getBoundingClientRect().top < innerHeight && c.getBoundingClientRect().bottom > 0);
        gsap.fromTo(inView, { y: "2em", opacity: 0, rotate: () => gsap.utils.random(-4, 4) },
          { y: "0em", opacity: 1, rotate: 0, duration: 0.6, ease: "back.out(1.6)", stagger: 0.03, clearProps: "rotate" });
      }
      ScrollTrigger.refresh();
    };
    if (sorter) {
      const wanted = new URLSearchParams(location.search).get("sort");
      if (orders[wanted]) { sorter.value = wanted; sortBy(wanted, false); }
      sorter.addEventListener("change", () => {
        const url = new URL(location.href);
        if (sorter.value === "rank") url.searchParams.delete("sort"); else url.searchParams.set("sort", sorter.value);
        history.replaceState(history.state, "", url);
        sortBy(sorter.value, true);
      });
    }
    // Cards rise in as they come into view, a row or two at a time
    const stop = riseIn(cards);
    if (stop) pageCleanups.push(stop);
  }

  /* ---------------- The library: reading, and coming back to a book ---------------- */

  const libraryOf = (page) => {
    const data = page.querySelector("[data-library]");
    try { return data ? JSON.parse(data.textContent) : {}; } catch { return {}; }
  };
  const places = () => {
    try { return JSON.parse(localStorage.getItem("bookshelf:reading")) || {}; } catch { return {}; }
  };

  // The reader's scripts (about 320 KB) are fetched only when a book is opened, once, with this build's version
  const version = document.querySelector("script[src*='js/app.js']")?.src.split("?")[1] || "";
  window.bookshelfVersion = version;
  let readerScripts = null;
  function loadReader() {
    const load = (src) => new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
    readerScripts ||= load("js/vendor/jszip.min.js").then(() => load("js/vendor/epub.min.js"))
      .then(() => Promise.all([load(`js/notes-store.js?${version}`), load(`js/reader-notes.js?${version}`)]))
      .then(() => load(`js/reader.js?${version}`));
    return readerScripts;
  }

  function readerPage(page) {
    const root = page.querySelector("[data-reader]");
    if (!root) return;
    let undo = null;
    let gone = false;
    const shown = pageShown;
    loadReader().then(() => { if (!gone) undo = window.BookshelfReader.open(root, libraryOf(page), shown); })
      .catch(() => { root.querySelector("[data-reader-message]").textContent = "The reader didn’t load. Check your connection and try again."; });
    return () => { gone = true; undo?.(); };
  }

  // Home: the books you have started, newest first
  function continueReading(page) {
    const section = page.querySelector("[data-continue]");
    if (!section) return;
    const library = libraryOf(page);
    const started = Object.entries(places()).filter(([slug, p]) => library[slug] && p.percent < 0.99)
      .sort((a, b) => b[1].at - a[1].at).slice(0, 4);
    if (!started.length) return;
    const list = section.querySelector("[data-continue-list]");
    const template = section.querySelector("template");
    started.forEach(([slug, p]) => {
      const item = template.content.firstElementChild.cloneNode(true);
      const book = library[slug];
      item.querySelector("a").href = `read.html?book=${slug}`;
      item.querySelector("img").src = `image/covers/${slug}-360.webp`;
      item.querySelector("[data-continue-title]").textContent = book.title;
      item.querySelector("[data-continue-author]").textContent = book.author;
      item.querySelector("[data-continue-percent]").textContent = `${Math.round(p.percent * 100)}% read`;
      item.querySelector("[data-continue-bar]").style.transform = `scaleX(${p.percent})`;
      list.append(item);
    });
    section.hidden = false;
  }

  /* ---------------- Books kept for offline reading ---------------- */

  // The service worker (sw.js, written by tools/build.py) serves the pages, the reader and kept books when there is no
  // connection. Keeping a book stores its file, its page and its cover in the browser's cache; the list of kept books
  // is in localStorage, and checked against the cache, which a browser may empty when space runs short.
  const offlineReady = "caches" in window && "serviceWorker" in navigator && window.isSecureContext;
  if (offlineReady) navigator.serviceWorker.register("sw.js").catch(() => {});
  const KEPT = "bookshelf:offline";
  const readKept = () => { try { return JSON.parse(localStorage.getItem(KEPT)) || {}; } catch { return {}; } };
  const writeKept = (kept) => { try { localStorage.setItem(KEPT, JSON.stringify(kept)); } catch { /* not kept */ } };
  window.BookshelfOffline = {
    supported: offlineReady,
    async list() {
      const kept = readKept();
      if (!offlineReady) return [];
      const books = await caches.open("books");
      const here = await Promise.all(Object.entries(kept).map(async ([slug, info]) => ((await books.match(info.epub, { ignoreSearch: true })) ? [slug, info] : null)));
      const still = Object.fromEntries(here.filter(Boolean));
      if (Object.keys(still).length !== Object.keys(kept).length) writeKept(still);
      return Object.entries(still).map(([slug, info]) => ({ slug, ...info }));
    },
    async has(slug) { return (await this.list()).some((b) => b.slug === slug); },
    async keep(slug, epub) {
      const [books, pages, images] = await Promise.all(["books", "pages", "images"].map((name) => caches.open(name)));
      const response = await fetch(epub, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await books.put(epub, response);
      await Promise.allSettled([pages.add(`book-${slug}.html`), images.add(`image/covers/${slug}-360.webp`), images.add(`image/covers/${slug}-180.webp`)]);
      navigator.storage?.persist?.().catch(() => {});
      writeKept({ ...readKept(), [slug]: { epub, at: Date.now() } });
    },
    async drop(slug) {
      const kept = readKept();
      const epub = kept[slug]?.epub;
      if (epub) await (await caches.open("books")).delete(epub, { ignoreSearch: true });
      delete kept[slug];
      writeKept(kept);
    },
  };
  // Every "Keep for offline reading" row on a page: on a book's page, and in the reader's Text settings. It shows a
  // Keep button, or that the book is kept with a Remove button beside it.
  function offlineButtons(page) {
    page.querySelectorAll("[data-offline-row]").forEach((row) => {
      if (!offlineReady) return;
      const keep = row.querySelector("[data-offline-keep]");
      const label = row.querySelector("[data-offline-label]");
      const kept = row.querySelector("[data-offline-kept]");
      const remove = row.querySelector("[data-offline-remove]");
      const show = (isKept) => {
        keep.hidden = isKept;
        kept.hidden = !isKept;
        remove.hidden = !isKept;
        label.textContent = "Keep for offline reading";
      };
      const refresh = () => { if (row.dataset.offlineBook) window.BookshelfOffline.has(row.dataset.offlineBook).then(show); };
      row.hidden = false;
      refresh();
      keep.addEventListener("click", async () => {
        if (keep.disabled || !row.dataset.offlineBook) return;
        keep.disabled = true;
        label.textContent = "Keeping…";
        try {
          await window.BookshelfOffline.keep(row.dataset.offlineBook, row.dataset.offlineEpub);
          show(true);
          remove.focus();
        } catch {
          label.textContent = navigator.onLine === false ? "You’re offline. Try again later" : "Couldn’t keep it. Try again";
        } finally {
          keep.disabled = false;
        }
      });
      remove.addEventListener("click", async () => {
        await window.BookshelfOffline.drop(row.dataset.offlineBook);
        show(false);
        keep.focus();
      });
      row.addEventListener("bookshelf:offline-book", refresh); // the reader names its book once it knows it
    });
  }

  // Your reading: its script (and the notes store) load only on that page
  function yourReading(page) {
    const root = page.querySelector("[data-your-reading]");
    if (!root) return null;
    let undo = null;
    let gone = false;
    const load = (src) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
    Promise.all([load(`js/notes-store.js?${version}`), load(`js/your-reading.js?${version}`)])
      .then(() => { if (!gone) undo = window.BookshelfYourReading.init(root, libraryOf(page)); })
      .catch(() => { root.prepend(Object.assign(document.createElement("p"), { className: "mine__empty", textContent: "This page didn’t load. Check your connection and try again." })); });
    return () => { gone = true; undo?.(); };
  }

  // Signing in and up, your account and readers' pages (js/account-page.js, with js/account.js on every page)
  function accountPages(page) {
    const root = page.querySelector("[data-account-page], [data-profile-page], [data-auth-page]");
    if (!root) return null;
    let undo = null;
    let gone = false;
    const s = document.createElement("script");
    const src = `js/account-page.js?${version}`;
    const ready = () => { if (!gone) undo = window.BookshelfAccountPage.init(root, libraryOf(page)); };
    if (window.BookshelfAccountPage) ready();
    else if (document.querySelector(`script[src="${src}"]`)) document.querySelector(`script[src="${src}"]`).addEventListener("load", ready, { once: true });
    else {
      s.src = src;
      s.onload = ready;
      s.onerror = () => root.prepend(Object.assign(document.createElement("p"), { className: "mine__empty", textContent: "This page didn’t load. Check your connection and try again." }));
      document.head.append(s);
    }
    return () => { gone = true; undo?.(); };
  }

  // Rows of options where one is chosen (All books, Fiction, Non-fiction; the reader's font and spacing): the
  // highlight slides from the old choice to the new one instead of jumping. The buttons say which is chosen
  // (aria-pressed); this only draws it.
  function segmented(page) {
    const undo = [];
    page.querySelectorAll("[data-segmented]").forEach((row) => {
      if (row.querySelector(":scope > .seg-thumb")) return;
      const thumb = document.createElement("span");
      thumb.className = "seg-thumb";
      thumb.setAttribute("aria-hidden", "true");
      row.prepend(thumb);
      row.classList.add("is--sliding");
      let first = true;
      const place = (animate) => {
        const on = row.querySelector(":scope > [aria-pressed='true']");
        if (!on || !row.offsetWidth) { thumb.style.opacity = "0"; return; }
        const to = { x: on.offsetLeft, y: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight, opacity: 1 };
        if (animate && !first && !reducedMotion()) gsap.to(thumb, { ...to, duration: 0.45, ease: "expo.out", overwrite: true });
        else gsap.set(thumb, to);
        first = false;
      };
      const watch = new MutationObserver(() => place(true));
      watch.observe(row, { attributes: true, attributeFilter: ["aria-pressed"], subtree: true });
      // a row in a panel that was closed has no size until it opens
      const sized = new ResizeObserver(() => place(false));
      sized.observe(row);
      place(false);
      undo.push(() => { watch.disconnect(); sized.disconnect(); });
    });
    return () => undo.forEach((fn) => fn());
  }

  /* ---------------- Lines from the books ---------------- */

  // Home: the line of the day, the same for everyone on a given day (by the reader's own date)
  function dailyLine(page) {
    const box = page.querySelector("[data-daily-line]");
    if (!box) return;
    let lines = [];
    try { lines = JSON.parse(box.querySelector("[data-daily-lines]").textContent); } catch { return; }
    if (!lines.length) return;
    const today = new Date();
    const day = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
    const line = lines[day % lines.length];
    box.querySelector("[data-daily-text]").textContent = line.text;
    const book = box.querySelector("[data-daily-book]");
    book.textContent = line.book;
    book.href = line.page;
    box.querySelector("[data-daily-author]").textContent = line.author;
    box.querySelector("[data-daily-open]").href = line.href;
    Object.assign(box.querySelector("[data-daily-share]").dataset, { quote: line.text, quoteBook: line.book, quoteAuthor: line.author, quoteColour: line.colour });
  }

  // Share: a picture of the line, in the book's colours, for a story or a chat. Phones offer their share sheet; elsewhere
  // the picture is saved.
  function wrapLines(g, text, width) {
    const words = text.split(" ");
    const out = [];
    let line = "";
    words.forEach((w) => {
      const next = line ? `${line} ${w}` : w;
      if (g.measureText(next).width > width && line) { out.push(line); line = w; } else line = next;
    });
    if (line) out.push(line);
    return out;
  }
  async function quoteCard({ quote, quoteBook, quoteAuthor, quoteColour }) {
    await Promise.all(["900 80px Rubik", "600 40px Figtree", "700 30px Figtree"].map((f) => document.fonts?.load(f)));
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const g = canvas.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue(`--${quoteColour}`).trim() || "#ffd24a";
    const ink = ["olive", "violet", "magenta"].includes(quoteColour) ? "#ffffff" : "#000000";
    g.fillStyle = bg;
    g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = ink;
    g.globalAlpha = 0.18;
    g.font = "900 420px Rubik";
    g.fillText("“", 50, 400);
    g.globalAlpha = 1;
    // the largest type at which the line fits in the space above the title
    let size = 76;
    let lines;
    do {
      g.font = `900 ${size}px Rubik`;
      lines = wrapLines(g, quote, 900);
      size -= 4;
    } while (lines.length * size * 1.18 > 690 && size > 34);
    const lineHeight = (size + 4) * 1.18;
    let y = 380;
    lines.forEach((l) => { g.fillText(l, 90, y); y += lineHeight; });
    g.font = "700 46px Figtree";
    g.fillText(quoteBook, 90, 1130, 900);
    g.font = "600 36px Figtree";
    g.globalAlpha = 0.8;
    g.fillText(quoteAuthor, 90, 1182, 900);
    g.font = "700 30px Figtree";
    g.fillText("Read it free at The Bookshelf", 90, 1272);
    g.globalAlpha = 1;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return new File([blob], `${quoteBook.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-quote.png`, { type: "image/png" });
  }
  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-quote-share]");
    if (!button || button.disabled) return;
    const label = button.querySelector("span");
    const was = label.textContent;
    button.disabled = true;
    label.textContent = "Making the picture…";
    const save = (file) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      label.textContent = "Picture saved";
      setTimeout(() => { label.textContent = was; }, 2500);
    };
    let file = null;
    try {
      file = await quoteCard(button.dataset);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: button.dataset.quoteBook });
        label.textContent = was;
      } else save(file);
    } catch (error) {
      // closing the share sheet is a choice, not a failure; any other trouble with sharing saves the picture instead
      if (file && error?.name !== "AbortError") save(file); else label.textContent = was;
    } finally {
      button.disabled = false;
    }
  });

  // A book you have started: its Read button says where you are
  function readButton(page) {
    const button = page.querySelector("[data-read-button]");
    if (!button) return;
    const p = places()[button.dataset.readButton];
    if (!p) return;
    const label = button.querySelector("[data-button-alt-text]");
    label.textContent = `Continue (${Math.round(p.percent * 100)}%)`;
  }

  /* ---------------- Page lifecycle ---------------- */

  let pageContext = null;
  let pageCleanups = [];

  function initPage(container) {
    awaitShown();
    setCurrentNav(container.dataset.barbaNamespace);
    accordions(container);
    continueReading(container);
    readButton(container);
    dailyLine(container);
    offlineButtons(container);
    const closeYours = yourReading(container);
    if (closeYours) pageCleanups.push(closeYours);
    const closeAccount = accountPages(container);
    if (closeAccount) pageCleanups.push(closeAccount);
    pageCleanups.push(segmented(container));
    const closeReader = readerPage(container);
    if (closeReader) pageCleanups.push(closeReader);
    if (reducedMotion()) {
      catalogue(container);
      return;
    }
    pageContext = gsap.context(() => {
      handwrittenInView(container);
      sectionEntrances(container);
      plopIn(container);
      openingBook(container);
      stickers(container);
      taglineCurve(container);
      giftPop(container);
      ribbons(container);
      confettiRain(container);
      footerParallax(container);
      catalogue(container);
      faqTopics(container);
      preloadImages(container);
      [breathingShapes, floatingBooks, waveButtons, sliders, fannedCards, genreCovers, genreShelves, momentumHover, bookPage]
        .forEach((fn) => { const undo = fn(container); if (undo) pageCleanups.push(undo); });
    }, container);
  }

  // Pictures lower on the page (covers, mostly) are fetched once the page has loaded, rather than as you reach them: a
  // phone fetches a lazy picture only when it is nearly on screen, and the covers appeared one by one as you scrolled.
  // A long list (all 161 books) keeps its lazy pictures past the first eighty.
  function preloadImages(container) {
    const lazy = [...container.querySelectorAll("img[loading='lazy']")].slice(0, 80);
    if (!lazy.length) return;
    const fetchAll = () => lazy.forEach((img) => {
      if (!img.isConnected) return;
      img.loading = "eager";
      img.decode?.().catch(() => {});
    });
    const soon = () => (window.requestIdleCallback ? requestIdleCallback(fetchAll, { timeout: 2500 }) : setTimeout(fetchAll, 600));
    if (document.readyState === "complete") soon(); else window.addEventListener("load", soon, { once: true });
  }

  function destroyPage() {
    pageCleanups.forEach((fn) => fn());
    pageCleanups = [];
    pageContext?.revert();
    pageContext = null;
  }

  /* ---------------- Counting (only when the site has GoatCounter turned on) ---------------- */

  // Page views and a few reading moments (a book opened, its second chapter reached, finished, downloaded), with no
  // cookies and no names, so the book of the month can learn what people actually read. Browsers that ask not to be
  // tracked (Do Not Track, Global Privacy Control) are not counted at all.
  const counter = document.querySelector("script[data-goatcounter]");
  const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  const waiting = [];
  window.bookshelfTrack = (path, title, event = true) => {
    if (!counter || optedOut) return;
    const send = () => window.goatcounter.count({ path, title, event });
    if (window.goatcounter?.count) send(); else waiting.push(send);
  };
  counter?.addEventListener("load", () => waiting.splice(0).forEach((send) => send()));
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[download]");
    const book = link?.getAttribute("href")?.match(/([a-z0-9-]+)\.epub/)?.[1];
    if (book) window.bookshelfTrack(`download/${book}`, document.title);
  });

  function afterEnter() {
    window.bookshelfTrack(location.pathname + location.search, document.title, false);
    showPage();
    lenis?.resize();
    ScrollTrigger.refresh();
    const hash = location.hash || pendingHash;
    pendingHash = "";
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        if (!location.hash) history.replaceState(history.state, "", hash);
        scrollToTarget(target, true);
        resetHeader(lenis ? lenis.scroll : window.scrollY);
      }
    }
  }

  waveButtons(header);
  waveButtons(menu);

  // A tap on words that do nothing belongs to the page. Chrome on Android takes such a tap for itself (Touch to Search
  // picks out the word under your finger and opens a search bar), which looked as if one tap selected words. Taken
  // here, before Chrome makes a click of it, the tap still reaches the page as a click; pressing and holding still
  // selects words, and links, buttons and fields behave as ever. (The reader handles taps in the book itself.)
  let tapStart = null;
  document.addEventListener("touchstart", (event) => {
    const t = event.touches[0];
    tapStart = event.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: performance.now() } : null;
  }, { passive: true });
  document.addEventListener("touchend", (event) => {
    const start = tapStart;
    tapStart = null;
    const t = event.changedTouches[0];
    const target = event.target;
    if (!start || !t || performance.now() - start.at > 400 || Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) return;
    if (!(target instanceof Element) || String(getSelection() || "")) return;
    if (target.closest("a, button, input, textarea, select, label, summary, [contenteditable], [role=button], iframe, video, audio")) return;
    event.preventDefault();
    const typing = document.activeElement;
    if (typing instanceof HTMLElement && typing.matches("input, textarea, select, [contenteditable]")) typing.blur();
    target.dispatchEvent(new MouseEvent("click", {
      bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY,
    }));
  }, { passive: false });

  const first = document.querySelector("[data-barba='container']");
  const start = () => {
    initPage(first);
    runOnce(first).then(() => afterEnter());
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  };

  // Barba fetches pages, which browsers do not allow for files opened from disk: there, links load normally
  if (!window.barba || location.protocol === "file:") {
    start();
    return;
  }

  const { barba } = window;
  if (window.barbaPrefetch) barba.use(window.barbaPrefetch, { timeout: 2500, limit: 0 });

  // Barba answers a back or forward press during a transition by reloading the whole page. Registered before Barba's
  // own listener, this holds the press until the transition ends and then replays it, so the page swaps instead
  let heldPop = null;
  window.addEventListener("popstate", (event) => {
    if (!barba.transitions.isRunning) return;
    event.stopImmediatePropagation();
    heldPop = { state: event.state };
  });
  const replayHeldPop = () => {
    if (!heldPop) return;
    const { state } = heldPop;
    heldPop = null;
    // Barba marks the transition finished just after its last hook, so replay a moment later
    requestAnimationFrame(() => setTimeout(() => window.dispatchEvent(new PopStateEvent("popstate", { state })), 0));
  };
  barba.hooks.after(replayHeldPop);
  barba.hooks.afterOnce(replayHeldPop);

  const scrollMemory = new Map(); // page address -> how far down it was when you left

  barba.init({
    // A slow phone can take a while to fetch the next page; past this Barba loads it in full instead (still covered)
    timeout: 12000,
    preventRunning: true,
    // Back and forward have no link element: without the check this threw, and Barba fell back to reloading the page
    prevent: ({ el }) => Boolean(el) && (el.hasAttribute("download") || el.target === "_blank"),
    transitions: [{
      name: "snake",
      once: () => start(),
      leave: ({ current, trigger }) => {
        scrollMemory.set(current.url.href, lenis ? lenis.scroll : window.scrollY);
        lenis?.stop();
        closeMenu();
        return runLeave(trigger);
      },
      afterLeave: ({ current }) => { destroyPage(); current.container.remove(); },
      beforeEnter: ({ next }) => {
        scrollToTop();
        resetHeader();
        initPage(next.container);
      },
      enter: ({ next, trigger }) => runEnter(next.container, trigger),
      afterEnter: ({ next, trigger }) => {
        lenis?.start();
        afterEnter();
        // Back and forward return to where you were on that page, as they do on any other site
        const y = fromHistory(trigger) ? scrollMemory.get(next.url.href) : 0;
        if (y) {
          if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
          resetHeader(y);
          ScrollTrigger.update();
        }
      },
    }],
  });
})();

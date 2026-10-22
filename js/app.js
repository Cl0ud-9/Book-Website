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
    window.BookshelfForms?.init(document);
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
    if (lenis) lenis.scrollTo(target, { offset: -16, duration: 1.2, immediate, lock: !immediate });
    else target.scrollIntoView({ behavior: immediate || reducedMotion() ? "auto" : "smooth" });
  }

  function scrollToTop() {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }

  // Links to a part of the page you are already on scroll there instead of loading anything
  window.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const url = new URL(link.href, location.href);
    const here = url.pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");
    if (!here) return;
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

  let lastY = 0;
  const onScroll = () => {
    const y = lenis ? lenis.scroll : window.scrollY;
    header.dataset.scrollingStarted = String(y > 50);
    // Small jitters do not count, so the Menu button does not flicker
    if (Math.abs(y - lastY) < 8) return;
    header.dataset.scrollDir = y > lastY && y > 50 ? "down" : "up";
    lastY = y;
  };
  if (lenis) lenis.on("scroll", onScroll);
  else window.addEventListener("scroll", onScroll, { passive: true });

  function setCurrentNav(namespace) {
    const key = { home: "home", books: "books", book: "books", login: "account", signup: "account" }[namespace];
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
      gsap.fromTo(menu.querySelectorAll(".menu__link"), { yPercent: 60, rotate: 6, opacity: 0 },
        { yPercent: 0, rotate: 0, opacity: 1, duration: 0.8, ease: ELASTIC, stagger: 0.05, delay: 0.15 });
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
      const items = [...menu.querySelectorAll("a, button")];
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
  function stretchWords(tl, el, position) {
    if (!el) return;
    const { words } = SplitText.create(el, { type: "words", wordsClass: "split-word" }); // headings only
    gsap.set(words, { display: "inline-block", transformOrigin: "top left",
      yPercent: -10, xPercent: 40, scaleY: 0.1, scaleX: 0.85, rotate: 8, opacity: 0 });
    tl.to(words,
      {
        keyframes: {
          "10%": { opacity: 1 },
          "100%": { yPercent: 0, xPercent: 0, scaleY: 1, scaleX: 1, rotate: 0, ease: ELASTIC },
        },
        duration: 0.875, stagger: 0.088,
      }, position);
  }

  // Handwritten notes tumble in letter by letter
  function scribbleIn(el) {
    const parts = split(el, { type: "words, chars", wordsClass: "split-word", charsClass: "split-char" });
    gsap.set(parts.words, { display: "inline-block" });
    gsap.set(parts.chars, { display: "inline-block", opacity: 0, rotate: 22, x: "-0.25em", y: "0.5em" });
    return parts.chars;
  }
  const scribbleTo = { opacity: 1, rotate: 0, x: "0em", y: "0em", ease: ELASTIC_SOFT, duration: 0.75, stagger: 0.016 };

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
    const noteChars = note ? scribbleIn(note) : [];

    gsap.set([paragraph, button].filter(Boolean), { opacity: 0, y: "-0.75em" });
    if (content) gsap.set(content, { opacity: 0, y: "5em" });
    if (books.length) gsap.set(books, { opacity: 0, y: "6em", rotate: (i) => [-30, 40, -25][i] });
    if (bg && desktop.matches) gsap.set(bg, { clipPath: "ellipse(20% 0% at 100% 100%)" });
    if (small) gsap.set(small, { y: "-5em", opacity: 0 });

    return (tl, at) => {
      if (small) tl.to(small, { y: "0em", opacity: 1, duration: 0.4, ease: "energy" }, at + 0.1);
      if (bg && desktop.matches) tl.to(bg, { clipPath: "ellipse(150% 130% at 100% 100%)", duration: 1.1, ease: "circ.out" }, at + 0.2);
      stretchWords(tl, title, at + 0.25);
      if (paragraph) tl.to(paragraph, { opacity: 1, y: "0em", duration: 0.35, ease: "energy" }, at + 0.45);
      if (button) tl.to(button, { opacity: 1, y: "0em", duration: 0.35, ease: "energy" }, at + 0.525);
      if (noteChars.length) tl.to(noteChars, scribbleTo, at + 0.45);
      if (content) tl.to(content, { y: "0em", opacity: 1, duration: 0.6, ease: "energy" }, at + 0.35);
      if (books.length) tl.to(books, { opacity: 1, y: "0em", rotate: 0, duration: 0.85, ease: ELASTIC, stagger: 0.08 }, at + 0.15);
    };
  }

  /* The transition: one fat violet squiggle. Leaving, it draws itself across the screen and swells until nothing
     shows through, and the logo springs in; arriving, the logo springs out and the squiggle slithers away from its
     start, thinning as it goes. */
  const COVER = "100%"; // wide enough that no corner of any screen shows through
  function showLogo(tl, at, delay = 0.05) {
    tl.fromTo(transitionLogo, { scale: 0, rotate: -64, autoAlpha: 0 },
      { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.65, ease: ELASTIC }, at + delay);
  }
  function hideLogo(tl, at, delay = 0.5) {
    tl.to(transitionLogo, { scale: 0, rotate: 64, autoAlpha: 0, duration: 0.6, ease: "elastic.in(1, 0.72)" }, at + delay);
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

  function runOnce(container) {
    gsap.set(snake, { drawSVG: "0% 100%", strokeWidth: COVER });
    gsap.set(transitionLogo, { scale: 0, rotate: -64, autoAlpha: 0 });
    if (reducedMotion()) {
      hideSnake();
      root.classList.remove("is-loading");
      return Promise.resolve();
    }
    gsap.set(header, { yPercent: -100 });
    const play = pageIntro(container);
    root.classList.add("is-ready");
    root.classList.remove("is-loading");
    const tl = gsap.timeline();
    uncover(tl, 0, 0.65);
    showLogo(tl, 0);
    hideLogo(tl, 0);
    // The text and the header carry on by themselves: Barba treats the transition as finished when this promise
    // resolves, and while one is running it answers the back button with a full page reload
    const intro = gsap.timeline();
    intro.to(header, { yPercent: 0, duration: 0.5, ease: "energy" }, 1.6);
    play(intro, 1.1);
    return tl.then();
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
    return tl.then();
  }

  function runEnter(container, trigger) {
    if (reducedMotion()) {
      hideSnake();
      return Promise.resolve();
    }
    const play = pageIntro(container);
    // As in runOnce, only the squiggle holds the transition open; the text intro runs on its own timeline
    const intro = gsap.timeline();
    if (fromHistory(trigger)) {
      hideSnake();
      play(intro, 0);
      return Promise.resolve();
    }
    const tl = gsap.timeline();
    hideLogo(tl, 0, 0.1);
    uncover(tl, 0, 0.1);
    play(intro, 0.45);
    return tl.then();
  }

  /* ---------------- Effects, one function each ---------------- */

  // Background shapes slowly breathe while they are on screen
  function breathingShapes(page) {
    page.querySelectorAll("[data-background-animation]").forEach((svg) => {
      const paths = svg.querySelectorAll("path");
      const width = svg.hasAttribute("data-background-animation-small") ? 35 : 60;
      gsap.set(paths, { attr: { "stroke-width": 0 } });
      const tl = gsap.timeline({ paused: true, repeat: -1 })
        .to(paths, { attr: { "stroke-width": width }, rotate: 2, duration: 3, ease: "sine.inOut" })
        .to(paths, { attr: { "stroke-width": 0 }, rotate: 0, duration: 3, ease: "sine.inOut" });
      ScrollTrigger.create({
        trigger: svg.parentElement, start: "top bottom", end: "bottom top",
        onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
      });
    });
  }

  // Hero books bob gently and lean towards the pointer
  function floatingBooks(page) {
    const books = page.querySelectorAll("[data-float]");
    if (!books.length) return;
    books.forEach((book, i) => {
      gsap.to(book.firstElementChild, {
        y: i === 0 ? "-1.2em" : "1em", rotate: i === 0 ? 2 : -3,
        duration: gsap.utils.random(2.6, 3.4), ease: "sine.inOut", yoyo: true, repeat: -1,
      });
    });
    if (!finePointer.matches) return;
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
    return () => hero.removeEventListener("pointermove", move);
  }

  // Letters in buttons dip and spring back on hover
  function waveButtons(scope) {
    const cleanups = [];
    scope.querySelectorAll("[data-button-text], [data-button-alt-text]").forEach((text) => {
      if (text.dataset.waved || !finePointer.matches || reducedMotion()) return;
      text.dataset.waved = "true";
      const parts = split(text, { type: "chars", charsClass: "split-char" });
      gsap.set(parts.chars, { display: "inline-block", transformOrigin: "center center" });
      const tl = gsap.timeline({ paused: true }).to(parts.chars, {
        keyframes: {
          "0%": { yPercent: 0, scaleY: 1, rotate: 0 },
          "20%": { yPercent: 55, scaleY: 0.3, rotate: 17, ease: "power2.in" },
          "100%": { yPercent: 0, scaleY: 1, rotate: 0, ease: "elastic.out(1, 0.4)" },
        },
        duration: 0.725, stagger: { amount: 0.225 },
      });
      const hover = text.closest("a, button");
      const enter = () => tl.restart();
      const leave = () => {
        tl.pause();
        gsap.to(parts.chars, { yPercent: 0, scaleY: 1, rotate: 0, duration: 0.2, ease: "power2.out", overwrite: "auto" });
      };
      const focusIn = () => { if (hover.matches(":focus-visible")) tl.restart(); };
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
    return () => cleanups.forEach((fn) => fn());
  }

  function handwrittenInView(page) {
    page.querySelectorAll("[data-handwritten-text-inview]").forEach((note) => {
      const chars = scribbleIn(note);
      gsap.to(chars, { ...scribbleTo, scrollTrigger: { trigger: note, start: "top 95%" } });
    });
  }

  function currentMonth(page) {
    const month = new Intl.DateTimeFormat("en", { month: "long" }).format(new Date());
    page.querySelectorAll("[data-current-month]").forEach((el) => { el.textContent = month; });
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
      let slider = null;
      slider = new window.Smooothy(wrapper, {
        infinite: false, snap: false, dragSensitivity: 0.008, lerpFactor: 0.225, bounceLimit: 0.5,
        setOffset: ({ wrapperWidth }) => wrapperWidth - 32,
        onUpdate: () => {
          if (!slider) return;
          const box = viewport.getBoundingClientRect();
          const middle = box.left + box.width / 2;
          settings.forEach(({ card, rotation, yOffset }) => {
            const r = card.getBoundingClientRect();
            const strength = Math.sin(gsap.utils.clamp(-2, 2, (r.left + r.width / 2 - middle) / (box.width / 2)) * 1.2);
            card.style.transform = `translateY(${strength * yOffset}%) rotate(${strength * rotation}deg)`;
          });
          const atStart = slider.currentSlide <= 0;
          const atEnd = gsap.utils.clamp(0, 1, slider.progress) >= 0.95;
          prev?.classList.toggle("is--disabled", atStart);
          next?.classList.toggle("is--disabled", atEnd);
          prev?.setAttribute("aria-disabled", String(atStart));
          next?.setAttribute("aria-disabled", String(atEnd));
        },
      });
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
      const tick = () => slider.update();
      gsap.ticker.add(tick);
      instances.push({ slider, tick, cards });
    });
    return () => instances.forEach(({ slider, tick, cards }) => {
      gsap.ticker.remove(tick);
      slider.destroy();
      cards.forEach((card) => { card.style.transform = ""; card.style.removeProperty("--book-slider-item-rotate"); });
    });
  }

  // How it works: cards fly up into a messy fan; the one under the pointer straightens and the rest make room
  function fannedCards(page) {
    const container = page.querySelector("[data-call-out]");
    if (!container) return;
    const cards = [...container.querySelectorAll("[data-call-out-item]")];
    const contents = cards.map((c) => c.querySelector("[data-call-out-child]"));
    const messy = () => ({ xPercent: (Math.random() - 0.5) * 10, yPercent: (Math.random() - 0.5) * 10, rotation: (Math.random() - 0.5) * 15 });
    if (!desktop.matches) {
      gsap.from(cards, { yPercent: 60, opacity: 0, duration: 0.9, ease: ELASTIC_SOFT, stagger: 0.08, scrollTrigger: { trigger: container, start: "top 85%", once: true } });
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

    const noteChars = scribbleIn(note);
    const asideChars = scribbleIn(aside);
    const noteTl = gsap.timeline({ paused: true }).to(noteChars, { ...scribbleTo, duration: 0.625, stagger: 0.011 });
    gsap.set(title, { opacity: 0, y: "1em" });
    gsap.set(buttons, { scale: 0, rotate: () => gsap.utils.random(-16, 16) });
    const finalTl = gsap.timeline({ paused: true })
      .to(title, { opacity: 1, y: "0em", ease: ELASTIC_SOFT, duration: 0.625 }, 0)
      .to(buttons, { scale: 1, rotate: 0, ease: ELASTIC_SOFT, duration: 0.625, stagger: 0.026 }, 0.15)
      .to(asideChars, { ...scribbleTo, duration: 0.625, stagger: 0.011 }, 0.2);

    const tl = gsap.timeline({ defaults: { ease: "none" } })
      .to(book, { rotationX: 8, rotationZ: -4, scale: 1, y: 0, duration: 0.25, ease: "power2.out" }, 0)
      .to(book, { x: width / 2, rotationX: 4, rotationZ: 0, duration: 0.3, ease: "power1.inOut" }, 0.25)
      .to(cover, { rotationY: -178, duration: 0.3, ease: "power2.inOut" }, 0.25)
      .to(leaves, { rotationY: (i) => -172 + i * 6, duration: 0.22, ease: "power2.inOut", stagger: 0.07 }, 0.42)
      .to(book, { scale: 3.2, x: width * 0.05, y: "-4vh", rotationX: 0, duration: 0.3, ease: "power2.in" }, 0.7);

    let noteState = "before";
    let finalState = "before";
    ScrollTrigger.create({
      trigger: section, start: "top top", end: "bottom bottom", scrub: 0.6, animation: tl,
      onUpdate: ({ progress }) => {
        const wanted = progress >= 0.3 && progress < 0.62 ? "played" : "hidden";
        if (wanted !== noteState) {
          if (wanted === "played") noteTl.timeScale(1.5).play(); else noteTl.timeScale(3.5).reverse();
          noteState = wanted;
        }
        const show = progress >= 0.81 ? "played" : "hidden";
        if (show !== finalState) {
          if (show === "played") finalTl.timeScale(1.25).play(); else finalTl.timeScale(3.5).reverse();
          finalState = show;
        }
      },
    });
  }

  // Genres: four covers pop out around the genre under the pointer and drift with it
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
    const handlers = items.map((item) => {
      const fn = () => activate(item);
      item.addEventListener("pointerenter", fn);
      item.addEventListener("focusin", fn);
      return [item, fn];
    });
    list.addEventListener("pointermove", parallax);
    gsap.from(items, { yPercent: 40, opacity: 0, rotate: 3, duration: 0.8, ease: ELASTIC_SOFT, stagger: 0.04,
      scrollTrigger: { trigger: list, start: "top 85%", once: true } });
    return () => {
      handlers.forEach(([item, fn]) => { item.removeEventListener("pointerenter", fn); item.removeEventListener("focusin", fn); });
      list.removeEventListener("pointermove", parallax);
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

  // The tagline slides along its curve as you scroll
  function taglineCurve(page) {
    page.querySelectorAll("[data-tagline-curve]").forEach((wrap) => {
      const textPath = wrap.querySelector("[data-tagline-text]");
      const path = wrap.querySelector("path");
      const textLength = textPath.getComputedTextLength();
      const end = -(textLength / path.getTotalLength()) * 100;
      gsap.fromTo(textPath, { attr: { startOffset: "100%" } }, {
        attr: { startOffset: `${end}%` }, ease: "none",
        scrollTrigger: { trigger: wrap, start: "top bottom", end: "bottom top", scrub: 0.5 },
      });
    });
  }

  function giftPop(page) {
    page.querySelectorAll("[data-gift]").forEach((wrap) => {
      gsap.fromTo(wrap.querySelector("[data-gift-item]"), { rotate: 30, scale: 0 },
        { rotate: -21, scale: 1, ease: ELASTIC_SOFT, duration: 0.95, scrollTrigger: { trigger: wrap, start: "top 72%", once: true } });
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

  // Book pages: the cover leans towards the pointer and bobs gently; "Add to bag" says thanks with confetti
  function bookPage(page) {
    const area = page.querySelector(".book-hero");
    const target = page.querySelector("[data-book-tilt-target]");
    const bag = page.querySelector("[data-add-to-bag]");
    const status = page.querySelector("[data-bag-status]");
    const cleanups = [];
    if (bag) {
      const add = () => {
        status.textContent = "Added to your bag. (A demo: nothing is ordered.)";
        const box = bag.getBoundingClientRect();
        confettiBurst(box.left + box.width / 2, box.top + box.height / 2);
      };
      bag.addEventListener("click", add);
      cleanups.push(() => bag.removeEventListener("click", add));
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
    page.querySelectorAll(".books__title, .flow__title, .faq__title, .favs__title, .spotlight__title, .gift__title").forEach((title) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: title, start: "top 88%", once: true } });
      stretchWords(tl, title, 0);
    });
  }

  // All books: search, genre chips, and show more
  function catalogue(page) {
    const rootEl = page.querySelector("[data-search-root]");
    if (!rootEl) return;
    const input = rootEl.querySelector("[data-search-input]");
    const chips = [...rootEl.querySelectorAll(".chip")];
    const cards = [...rootEl.querySelectorAll(".book-card")];
    const status = rootEl.querySelector("[data-search-status]");
    const empty = rootEl.querySelector("[data-search-empty]");
    let genre = new URLSearchParams(location.search).get("genre") || "";
    if (!chips.some((c) => c.dataset.genre === genre)) genre = "";

    const apply = (animate = true) => {
      const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const shown = [];
      cards.forEach((card) => {
        const match = words.every((w) => card.dataset.search.includes(w)) && (!genre || card.dataset.genres.split(" ").includes(genre));
        const was = !card.hidden;
        card.hidden = !match;
        if (match && !was) shown.push(card);
      });
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.genre === genre)));
      const count = cards.filter((c) => !c.hidden).length;
      const chip = chips.find((c) => c.dataset.genre === genre);
      const what = [words.length ? `“${input.value.trim()}”` : "", chip ? chip.textContent : ""].filter(Boolean).join(" in ");
      status.textContent = count === cards.length ? `Showing all ${count} books.`
        : `${count} ${count === 1 ? "book matches" : "books match"} ${what}.`;
      empty.hidden = count > 0;
      if (animate && shown.length && !reducedMotion()) {
        gsap.fromTo(shown, { scale: 0.6, opacity: 0, rotate: () => gsap.utils.random(-8, 8) },
          { scale: 1, opacity: 1, rotate: 0, duration: 0.7, ease: ELASTIC_SOFT, stagger: 0.04, clearProps: "scale,rotate" });
      }
      ScrollTrigger.refresh();
    };
    input.addEventListener("input", () => apply());
    rootEl.querySelector("[data-search-form]").addEventListener("submit", (event) => event.preventDefault());
    chips.forEach((chip) => chip.addEventListener("click", () => {
      genre = genre === chip.dataset.genre ? "" : chip.dataset.genre;
      const url = new URL(location.href);
      if (genre) url.searchParams.set("genre", genre); else url.searchParams.delete("genre");
      history.replaceState(history.state, "", url);
      apply();
    }));
    apply(false);
    if (!reducedMotion()) gsap.from(cards.filter((c) => !c.hidden), { y: "4em", opacity: 0, rotate: () => gsap.utils.random(-6, 6), duration: 0.9, ease: ELASTIC_SOFT, stagger: 0.05, delay: 0.6 });
  }

  /* ---------------- Page lifecycle ---------------- */

  let pageContext = null;
  let pageCleanups = [];

  function initPage(container) {
    setCurrentNav(container.dataset.barbaNamespace);
    currentMonth(container);
    pageCleanups.push(window.BookshelfForms?.init(container) || (() => {}));
    accordions(container);
    if (reducedMotion()) {
      catalogue(container);
      return;
    }
    pageContext = gsap.context(() => {
      breathingShapes(container);
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
      [floatingBooks, waveButtons, sliders, fannedCards, genreCovers, momentumHover, bookPage]
        .forEach((fn) => { const undo = fn(container); if (undo) pageCleanups.push(undo); });
    }, container);
  }

  function destroyPage() {
    pageCleanups.forEach((fn) => fn());
    pageCleanups = [];
    pageContext?.revert();
    pageContext = null;
  }

  function afterEnter() {
    lenis?.resize();
    ScrollTrigger.refresh();
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) scrollToTarget(target, true);
    }
  }

  waveButtons(header);
  waveButtons(menu);

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

  barba.init({
    timeout: 7000,
    preventRunning: true,
    // Back and forward have no link element: without the check this threw, and Barba fell back to reloading the page
    prevent: ({ el }) => Boolean(el) && (el.hasAttribute("download") || el.target === "_blank"),
    transitions: [{
      name: "snake",
      once: () => start(),
      leave: ({ trigger }) => { lenis?.stop(); closeMenu(); return runLeave(trigger); },
      afterLeave: ({ current }) => { destroyPage(); current.container.remove(); },
      beforeEnter: ({ next }) => {
        scrollToTop();
        initPage(next.container);
      },
      enter: ({ next, trigger }) => runEnter(next.container, trigger),
      afterEnter: () => { lenis?.start(); afterEnter(); },
    }],
  });
})();

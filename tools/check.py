"""Use The Bookshelf like a visitor would (desktop, phone, reduced motion, no JavaScript) and report what fails.

usage: npm start, then: python tools/check.py [BASE_URL] [SCREENSHOT_DIR]   (needs Playwright and Google Chrome)
"""
import json
import sys
import unicodedata
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "_check"
Path(OUT).mkdir(exist_ok=True)
fails = []
LIBRARY = json.loads((Path(__file__).resolve().parent.parent / "library" / "books.json").read_text(encoding="utf-8"))


def plain(text):
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def ok(cond, what):
    print(("PASS " if cond else "FAIL ") + what)
    if not cond:
        fails.append(what)


def watch(page, errors):
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")

    # ---- desktop: home, interactions, then a page transition
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    watch(page, errors)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(3500)
    ok(page.evaluate("document.documentElement.classList.contains('is-ready')"), "intro ran (is-ready)")
    ok(page.locator("[data-nav=home]").first.get_attribute("aria-current") == "page", "menu marks Home as current")

    # slider: drag left and check it moved
    vp = page.locator(".books__slider")
    vp.scroll_into_view_if_needed()
    page.wait_for_timeout(1200)
    first = page.locator(".books__list .slide").first
    x0 = first.bounding_box()["x"]
    box = vp.bounding_box()
    page.mouse.move(box["x"] + box["width"] * 0.7, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] * 0.2, box["y"] + box["height"] / 2, steps=12)
    page.mouse.up()
    page.wait_for_timeout(1200)
    x1 = first.bounding_box()["x"]
    ok(x1 < x0 - 100, f"slider drags ({x0:.0f} -> {x1:.0f})")
    page.locator(".books [data-books-slider-controls] button").first.click()
    page.wait_for_timeout(900)
    ok(first.bounding_box()["x"] > x1 + 50, "previous arrow moves the shelf back")
    page.screenshot(path=f"{OUT}/slider.png")

    # genre hover shows covers
    item = page.locator(".genre__item").nth(2)
    item.scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    item.hover()
    page.wait_for_timeout(900)
    shown = page.locator(".genre__img.is--shown").count()
    ok(shown == 4, f"genre hover shows 4 covers ({shown})")
    page.screenshot(path=f"{OUT}/genre.png")

    # accordion
    acc = page.locator(".accordion").first
    acc.scroll_into_view_if_needed()
    page.wait_for_timeout(800)
    acc.locator("summary").click()
    page.wait_for_timeout(700)
    ok(acc.evaluate("d => d.open"), "question opens")
    acc.locator("summary").click()
    page.wait_for_timeout(700)
    ok(not acc.evaluate("d => d.open"), "question closes")

    # the footer's feed of the book of the month
    feed_link = page.locator(".footer a[href='feed.xml']")
    ok(feed_link.count() == 1, "the footer links to the book-of-the-month feed")
    feed_link.scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    feed = page.request.get(BASE + "feed.xml")
    ok(feed.ok and "<entry>" in feed.text() and "Book of the month" in feed.text(), "the feed has the books of the month")

    # hash link on the same page scrolls instead of reloading
    page.locator("footer a[href='index.html#new']").click()
    page.wait_for_timeout(2200)
    new_top = page.locator("#new").bounding_box()["y"]
    ok(abs(new_top) < 120, f"New on the shelf link scrolls to the section (top at {new_top:.0f})")

    # page transition to All books via a genre link
    page.locator(".genre__link").first.scroll_into_view_if_needed()
    page.wait_for_timeout(1000)
    page.locator(".genre__link").first.click()
    for i in range(8):
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/trans-{i}.png")
    page.wait_for_timeout(1500)
    ok(page.url.endswith("books.html?genre=romance"), f"genre link opens the catalogue ({page.url})")
    ok(page.locator("[data-barba-namespace=books]").count() == 1, "books page swapped in without reload")
    romance = [b for b in LIBRARY if "Romance" in b["genres"]]
    status = page.locator("[data-search-status]").inner_text()
    ok("Romance" in status and f"{len(romance)} books" in status, f"genre filter applied: {status}")
    ok(page.locator("[data-nav=books]").first.get_attribute("aria-current") == "page", "All books marked current")
    # accents do not matter: "bronte" finds the Brontës
    brontes = [b for b in romance if "bronte" in plain(b["author"])]
    page.fill("#search-box", "bronte")
    page.wait_for_timeout(500)
    st = page.locator("[data-search-status]").inner_text()
    ok(f"{len(brontes)} book" in st and len(brontes) >= 3, f"search + genre finds the Brontës without the accent: {st}")
    page.locator(".chip[aria-pressed=true]").click()
    page.fill("#search-box", "sherlock")
    page.wait_for_timeout(500)
    holmes = [b for b in LIBRARY if "sherlock" in plain(b["title"] + " " + b["author"])]
    st = page.locator("[data-search-status]").inner_text()
    ok(f"{len(holmes)} book" in st, f"search alone finds the Sherlock Holmes books: {st}")
    page.fill("#search-box", "zzzz")
    page.wait_for_timeout(300)
    ok(page.locator("[data-search-empty]").is_visible(), "no-match message shows")
    page.fill("#search-box", "")
    page.wait_for_timeout(400)
    ok(page.locator(".book-card").count() == len(LIBRARY), f"the catalogue has every book ({len(LIBRARY)})")
    # sorting: by length, by title, back to most read, and the choice is kept in the address
    order = "() => [...document.querySelectorAll('.book-card')].map(c => [c.dataset.title, +c.dataset.words, +c.dataset.rank])"
    page.select_option("[data-sort]", "short")
    page.wait_for_timeout(400)
    cards = page.evaluate(order)
    ok([c[1] for c in cards] == sorted(c[1] for c in cards) and "sort=short" in page.url, "Shortest first sorts by length")
    page.select_option("[data-sort]", "title")
    page.wait_for_timeout(400)
    titles = [c[0] for c in page.evaluate(order)]
    in_order = page.evaluate("t => t.every((x, i) => !i || t[i - 1].localeCompare(x) <= 0)", titles)
    ok(in_order and "sort=title" in page.url, f"Title, A to Z sorts by title ({titles[:3]})")
    page.select_option("[data-sort]", "rank")
    page.wait_for_timeout(400)
    cards = page.evaluate(order)
    ok([c[2] for c in cards] == sorted(c[2] for c in cards) and "sort=" not in page.url, "Most read puts the most read first")
    page.screenshot(path=f"{OUT}/books.png")

    # a card opens its book's page: the details, Read now and the download
    first = min(LIBRARY, key=lambda b: b["popularity"] or 10_000)  # the catalogue lists the most read first
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(600)
    page.locator(".book-card").first.click(position={"x": 60, "y": 60})
    page.wait_for_timeout(3200)
    ok(page.url.endswith(f"book-{first['slug']}.html"), f"a card opens its book page ({page.url})")
    ok(page.locator("h1").inner_text().strip() == first["title"], "book page shows the title")
    ok(page.locator(".book-about__facts dt").count() >= 4, "book page lists the details")
    ok(page.locator("[data-barba-namespace=book]").count() == 1, "book page swapped in without reload")
    epub = page.locator("a[download]").first.get_attribute("href")
    ok(page.request.get(BASE + epub).status == 200 if not epub.startswith("http") else True, f"the EPUB download is there ({epub})")
    ok(page.locator(".book-more .book-card").count() == 3, "three related books")
    page.screenshot(path=f"{OUT}/book.png")

    # back: phones animate history moves themselves, so the page must appear at once with no squiggle over it
    page.go_back()
    page.wait_for_timeout(350)
    ok(page.url.split("?")[0].endswith("books.html"), f"back returns to the catalogue ({page.url})")
    covered = page.evaluate("getComputedStyle(document.querySelector('[data-transition-logo]')).opacity !== '0'")
    ok(page.locator("#search-box").is_visible() and not covered, "going back shows the page at once, no transition")

    # the reader: open the book, turn a page, and the book page then offers to continue
    page.go_forward()
    page.wait_for_timeout(2500)
    page.locator("[data-read-button]").click()
    page.wait_for_selector(".reader.is--ready", timeout=20000)
    ok(page.locator("[data-reader-title]").inner_text() == first["title"], "the reader opens the book")
    ok(page.locator("[data-reader-view] iframe").count() >= 1, "the book's pages are shown")
    ok(not page.locator(".header").is_visible(), "the site header steps aside in the reader")
    before = page.evaluate("JSON.parse(localStorage.getItem('bookshelf:reading'))?.[" + repr(first["slug"]) + "]?.cfi")
    for _ in range(3):
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(500)
    after = page.evaluate("JSON.parse(localStorage.getItem('bookshelf:reading'))?.[" + repr(first["slug"]) + "]?.cfi")
    ok(bool(after) and after != before, "turning pages saves your place")
    page.wait_for_timeout(1500)
    settled = page.evaluate("""() => [document.querySelector('.reader').classList.contains('is--opening'),
      getComputedStyle(document.querySelector('[data-reader-sheet]')).visibility,
      getComputedStyle(document.querySelector('[data-reader-view]')).opacity]""")
    ok(settled == [False, "hidden", "1"], f"the cover has opened and each page turn settles with the page in full view ({settled})")
    page.locator("[data-reader-toggle][aria-controls=reader-settings]").click()
    page.locator("[data-reader-theme=night]").click()
    page.wait_for_timeout(300)
    ok(page.locator(".reader").get_attribute("data-theme") == "night", "the Night page works")
    page.keyboard.press("Escape")
    page.screenshot(path=f"{OUT}/reader.png")
    # a narrower window (split screen, a turned tablet) changes two pages to one, at the same place
    chapter_before = page.locator("[data-reader-chapter]").inner_text()
    page.set_viewport_size({"width": 860, "height": 900})
    page.wait_for_timeout(3000)
    one = "is--spread" not in page.locator(".reader").get_attribute("class")
    page.set_viewport_size({"width": 1440, "height": 900})
    page.wait_for_timeout(3000)
    two = "is--spread" in page.locator(".reader").get_attribute("class")
    ok(one and two and page.locator("[data-reader-chapter]").inner_text() == chapter_before,
       "narrowing the window turns two pages into one and back, at the same chapter")
    page.locator("[data-reader-back]").click()
    page.wait_for_timeout(3200)
    ok("Continue (" in page.locator("[data-read-button]").inner_text(), "the book page offers to continue where you were")
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(3500)
    ok(page.locator("[data-continue]").is_visible() and first["title"] in page.locator("[data-continue]").inner_text(),
       "the home page shows Continue reading")

    # the old demo sign-up address leads on; the account page says plainly when accounts are off (tools/accounts_check.py
    # tests accounts themselves, against Firebase's emulators); the privacy page is there
    page.goto(BASE + "signup.html", wait_until="networkidle")
    page.wait_for_timeout(1500)
    accounts_on = page.evaluate("Boolean(window.bookshelfAccounts)")
    if accounts_on:
        ok(page.locator("[data-auth-page][data-auth-mode=up]").count() == 1, "with accounts on, signup.html is the sign-up page")
    else:
        ok(page.url.endswith("reading.html"), f"without accounts, the old sign-up address leads on ({page.url})")
    page.goto(BASE + "account.html", wait_until="networkidle")
    page.wait_for_timeout(2500)
    if not accounts_on:
        ok(page.locator("[data-acct-off]").is_visible() and page.locator(".header .account-chip").is_hidden(),
           "with accounts off, the account page says so and the header has no Sign in")
    page.goto(BASE + "privacy.html", wait_until="networkidle")
    page.wait_for_timeout(1500)
    ok(page.locator(".prose h2").count() >= 4, "the privacy page explains what is kept")

    # from a book page, the menu's Genres and FAQ open their own pages (they used to fall back to the top of home)
    page.goto(BASE + f"book-{first['slug']}.html", wait_until="networkidle")
    page.wait_for_timeout(3000)
    page.locator(".header__nav [data-nav=genres]").click()
    page.wait_for_timeout(3200)
    ok(page.url.endswith("genres.html") and page.locator("[data-barba-namespace=genres]").count() == 1,
       f"Genres opens the genres page without a reload ({page.url})")
    ok(page.locator("[data-nav=genres]").first.get_attribute("aria-current") == "page", "Genres marked current")
    genres = sorted({g for b in LIBRARY for g in b["genres"]})
    collections = {c for b in LIBRARY for c in b.get("collections", [])}
    ok(page.locator(".shelf").count() == len(genres) + len(collections),
       f"a shelf for every genre and collection ({page.locator('.shelf').count()}/{len(genres) + len(collections)})")
    # a full shelf (the first, From India, is a short one)
    row = page.locator(".shelf", has_text="Romance").locator("[data-shelf-row]")
    row.scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    box = row.bounding_box()
    ok(box["x"] + box["width"] <= 1440 and row.evaluate("r => r.scrollWidth > r.clientWidth"), "a shelf fits the screen and scrolls sideways")
    page.mouse.move(box["x"] + box["width"] * 0.7, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] * 0.2, box["y"] + box["height"] / 2, steps=12)
    page.mouse.up()
    page.wait_for_timeout(400)
    ok(row.evaluate("r => r.scrollLeft") > 100 and page.url.endswith("genres.html"), "dragging a shelf scrolls it and opens nothing")
    page.locator(".header__nav [data-nav=faq]").click()
    page.wait_for_timeout(3200)
    ok(page.url.endswith("faq.html") and page.locator("[data-barba-namespace=faq]").count() == 1, f"FAQ opens the questions page ({page.url})")
    # a topic pill jumps to its questions and lights up; scrolling on lights the next topic
    pills = page.locator("[data-faq-pill]")
    pills.nth(2).click()
    page.wait_for_timeout(1800)
    target = pills.nth(2).get_attribute("href")
    top = page.locator(target + " h2").bounding_box()["y"]
    ok(40 < top < 200, f"a topic pill brings its questions under the header (heading at {top:.0f})")
    ok("is--active" in (pills.nth(2).get_attribute("class") or ""), "the pill of the topic in view is lit")
    page.locator(pills.nth(4).get_attribute("href")).scroll_into_view_if_needed()
    page.mouse.wheel(0, 200)
    page.wait_for_timeout(1200)
    lit = [i for i in range(pills.count()) if "is--active" in (pills.nth(i).get_attribute("class") or "")]
    ok(len(lit) == 1 and lit[0] >= 3, f"scrolling lights the topic being read (pill {lit})")
    # a link to a section of another page lands on that section
    page.locator("footer a[href='index.html#new']").click()
    page.wait_for_timeout(3500)
    new_top = page.locator("#new").bounding_box()["y"]
    ok(page.url.endswith("index.html#new") and abs(new_top) < 120, f"a link to a section of home lands on it ({new_top:.0f})")
    print("desktop console:", errors or "clean")
    page.close()

    # ---- phone: menu
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    errors = []
    watch(page, errors)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(3500)
    page.locator("[data-menu-toggle]").click()
    page.wait_for_timeout(900)
    ok(page.locator("#menu").is_visible(), "phone menu opens")
    page.screenshot(path=f"{OUT}/menu.png")
    for _ in range(12):
        page.keyboard.press("Tab")
    ok(page.evaluate("document.getElementById('menu').contains(document.activeElement)"), "Tab stays inside the open menu")
    page.keyboard.press("Escape")
    page.wait_for_timeout(800)
    ok(not page.locator("#menu").is_visible(), "Escape closes the menu")
    wide = page.evaluate("document.documentElement.scrollWidth")
    ok(wide <= 390, f"no sideways scrolling on phones ({wide}px)")
    # big words stay inside their card or panel
    spill = page.evaluate("""() => [...document.querySelectorAll('.book-card__title, .genre__default, .genre__more')].filter(el => {
      const box = el.closest('.book-card, .genre').getBoundingClientRect(), r = document.createRange();
      r.selectNodeContents(el);
      return [...r.getClientRects()].some(t => t.width && (t.right > box.right || t.left < box.left));
    }).map(el => el.textContent.trim())""")
    ok(not spill, f"titles and genres fit their boxes ({spill or 'all fit'})")
    # the Menu button gets out of the way while reading down, and comes back on the way up (Escape left keyboard
    # focus on it, which keeps it in view on purpose, so drop that first)
    page.evaluate("document.activeElement.blur()")
    page.mouse.wheel(0, 1200)
    page.wait_for_timeout(1200)
    ok(page.locator("[data-menu-toggle]").bounding_box()["y"] + 60 < 0, "Menu button hides while scrolling down")
    page.mouse.wheel(0, -300)
    page.wait_for_timeout(1200)
    ok(page.locator("[data-menu-toggle]").bounding_box()["y"] > 0, "Menu button returns on scrolling up")
    # a page opened from halfway down another one starts with its Menu button in view
    page.goto(BASE + "books.html", wait_until="networkidle")
    page.wait_for_timeout(3000)
    page.mouse.wheel(0, 900)
    page.wait_for_timeout(1000)
    page.locator(".book-card").nth(2).click(position={"x": 60, "y": 60})
    page.wait_for_timeout(3200)
    ok(page.locator("[data-menu-toggle]").bounding_box()["y"] >= 0, "a newly opened page shows the Menu button")
    page.go_back()
    page.wait_for_timeout(1500)
    y = page.evaluate("scrollY")
    ok(y > 300, f"going back returns to where you were on the page ({y:.0f}px down)")
    # reading on a phone: the bars slip away while reading down and come back on the way up
    page.goto(BASE + f"read.html?book={LIBRARY[0]['slug']}", wait_until="networkidle")
    page.wait_for_selector(".reader.is--ready", timeout=20000)
    page.wait_for_timeout(2500)
    page.mouse.move(195, 450)
    page.mouse.wheel(0, 1500)
    page.wait_for_timeout(1000)
    hidden = page.evaluate("document.querySelector('.reader').classList.contains('is--immersive')")
    page.mouse.wheel(0, -300)
    page.wait_for_timeout(1000)
    shown = not page.evaluate("document.querySelector('.reader').classList.contains('is--immersive')")
    ok(hidden and shown, f"the reader's bars hide while reading down and return on scrolling up ({hidden}, {shown})")
    # Contents on a phone: a jump keeps the bars, leaves your saved place alone, lets you read on, and offers the way back
    saved = "(s) => JSON.parse(localStorage.getItem('bookshelf:reading'))[s]?.cfi"
    slug = LIBRARY[0]["slug"]
    page.evaluate("document.querySelector('.reader').classList.remove('is--immersive')")
    page.wait_for_timeout(600)
    place = page.evaluate(saved, slug)
    page.locator("[aria-controls=reader-contents]").click()
    page.wait_for_timeout(700)
    links = page.locator("#reader-contents [data-reader-toc-list] .reader__toc-link")
    target = links.nth(min(8, links.count() - 1))
    label = target.inner_text()
    target.click()
    page.wait_for_timeout(3000)
    ok(page.locator("[aria-controls=reader-contents]").is_visible(), "after a Contents jump the reader's bars stay in view")
    ok(page.evaluate(saved, slug) == place, "a Contents jump does not move your saved place")
    ok(page.locator("[data-reader-chapter]").inner_text() == label, f"the footer names the chapter you jumped to ({label})")
    ok(page.locator("[data-reader-return]").is_visible(), "a Back to … button offers the way back")
    # epub.js drops chapters above the screen as you read down, which lowers scrollTop, so the distance is added up
    page.evaluate("""() => { const c = document.querySelector('.epub-container'); let last = c.scrollTop; window.__moved = 0;
      c.addEventListener('scroll', () => { const d = c.scrollTop - last; if (Math.abs(d) < 1500) window.__moved += Math.abs(d); last = c.scrollTop; }); }""")
    page.mouse.move(195, 450)
    for _ in range(8):
        page.mouse.wheel(0, 500)
        page.wait_for_timeout(250)
    page.wait_for_timeout(800)
    moved = page.evaluate("window.__moved")
    ok(moved > 1500, f"you can scroll on after a jump; the next chapter loads ({moved:.0f}px)")
    ok(page.evaluate(saved, slug) != place and page.locator("[data-reader-return]").is_hidden(), "reading on after a jump makes it your place")
    print("phone console:", errors or "clean")
    page.close()

    # ---- your own reading: highlights and notes, keeping a book offline, and Your reading with its backup
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    watch(page, errors)
    book = "dracula"
    page.goto(BASE + f"book-{book}.html", wait_until="networkidle")
    page.wait_for_timeout(2500)
    page.locator(".book-hero [data-offline-keep]").click()
    page.wait_for_selector(".book-hero [data-offline-kept]:not([hidden])", timeout=20000)
    ok(page.locator(".book-hero [data-offline-remove]").is_visible(), "a book can be kept for offline reading, and shows Remove once kept")
    ok(page.locator(".book-hero__listen a").count() == 1, "a book's page links its free LibriVox audiobook")
    page.goto(BASE + f"read.html?book={book}")
    page.wait_for_selector(".reader.is--ready", timeout=20000)
    page.wait_for_timeout(2500)
    page.locator("[aria-controls=reader-contents]").click()
    page.wait_for_timeout(500)
    page.locator("#reader-contents [data-reader-toc-list] .reader__toc-link").nth(3).click()
    page.wait_for_timeout(2500)
    picked = page.evaluate("""() => { const f = [...document.querySelectorAll('.epub-container iframe')].find(fr => { const r = fr.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; });
      const d = f.contentDocument, w = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { if (n.nodeValue.trim().length > 30) { const r = d.createRange(); const i = n.nodeValue.indexOf(n.nodeValue.trim());
        r.setStart(n, i); r.setEnd(n, i + 20); const s = f.contentWindow.getSelection(); s.removeAllRanges(); s.addRange(r); return r.toString(); } } return ''; }""")
    page.wait_for_timeout(900)
    ok(page.locator("[data-select-bar]").is_visible(), f"selecting words shows the highlight bar ({picked!r})")
    page.locator("[data-select-bar] [data-style=blue]").click()
    page.wait_for_timeout(800)
    marks = page.evaluate("[...document.querySelectorAll('.epub-container g[data-id]')].filter(g => g.childNodes.length).length")
    ok(marks == 1, f"the highlight is drawn on the page ({marks})")
    page.locator("[aria-controls=reader-notes]").click()
    page.wait_for_timeout(600)
    ok(page.locator("[data-notes-list] .reader__note").count() == 1, "the Notes panel lists the highlight")
    page.locator("[data-notes-list] .reader__note-act[aria-label=Remove]").click()
    page.wait_for_timeout(500)
    page.locator("[data-reader-toast] [data-toast-undo]").click()
    page.wait_for_timeout(800)
    ok(page.locator("[data-notes-list] .reader__note").count() == 1, "a removed highlight comes back with Undo")
    page.goto(BASE + "reading.html", wait_until="networkidle")
    page.wait_for_timeout(3000)
    ok(page.locator("[data-reading-list] .mine__book").count() == 1 and page.locator("[data-notes-all] .mine__note").count() == 1
       and page.locator("[data-offline-list] .mine__book").count() == 1, "Your reading lists the book being read, the note and the kept book")
    with page.expect_download() as download:
        page.locator("[data-backup]").click()
    backup = json.loads(Path(download.value.path()).read_text(encoding="utf-8"))
    ok(backup.get("app") == "The Bookshelf" and len(backup["notes"]) == 1 and book in backup["places"], "Back up saves the places and notes in one file")
    print("your reading console:", errors or "clean")
    ctx.close()

    # ---- the smallest phones: nothing may make any page wider than the screen, even while it animates in
    for path in ("", "books.html", "genres.html", "faq.html", "reading.html", f"book-{LIBRARY[0]['slug']}.html", f"read.html?book={LIBRARY[0]['slug']}", "account.html", "privacy.html"):
        page = browser.new_page(viewport={"width": 320, "height": 700}, is_mobile=True, has_touch=True)
        page.goto(BASE + path, wait_until="domcontentloaded")
        widths = []
        for _ in range(20):
            page.wait_for_timeout(200)
            widths.append(page.evaluate("innerWidth"))
            page.mouse.wheel(0, 400)
        ok(max(widths) == 320, f"/{path or 'index'} stays 320 px wide on a small phone (widest {max(widths)})")
        page.close()

    # ---- reduced motion: everything visible straight away
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    errors = []
    watch(page, errors)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    ok(page.locator("#hero-title").is_visible(), "reduced motion: hero shows at once")
    ok(not page.locator(".transition").evaluate("e => getComputedStyle(e).visibility === 'visible'"), "reduced motion: no squiggle")
    page.screenshot(path=f"{OUT}/reduced.png")
    print("reduced console:", errors or "clean")
    ctx.close()

    # ---- no JavaScript
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, java_script_enabled=False)
    page = ctx.new_page()
    page.goto(BASE, wait_until="networkidle")
    ok(page.locator("#hero-title").is_visible(), "no JS: hero visible")
    ok(page.locator(".book-card").count() == 10 and page.locator(".book-card").first.is_visible(), "no JS: books visible")
    page.screenshot(path=f"{OUT}/nojs.png", full_page=False)
    page.goto(BASE + "books.html", wait_until="networkidle")
    ok(page.locator(".book-card").nth(9).is_visible(), "no JS: catalogue visible")
    ctx.close()

    browser.close()

print("\n", len(fails), "failures")
for f in fails:
    print(" -", f)

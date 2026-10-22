"""Use The Bookshelf like a visitor would (desktop, phone, reduced motion, no JavaScript) and report what fails.

usage: npm start, then: python tools/check.py [BASE_URL] [SCREENSHOT_DIR]   (needs Playwright and Google Chrome)
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "_check"
Path(OUT).mkdir(exist_ok=True)
fails = []


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
    ok(page.locator("[data-current-month]").inner_text() != "this month", "month filled in")

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

    # newsletter
    page.locator("#newsletter-email").scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    page.locator("[data-newsletter] button[type=submit]").click()
    ok("Enter an email" in page.locator("[data-newsletter-message]").inner_text(), "newsletter rejects empty email")
    page.fill("#newsletter-email", "reader@example.com")
    page.locator("[data-newsletter] button[type=submit]").click()
    ok("Thanks" in page.locator("[data-newsletter-message]").inner_text(), "newsletter thanks you")

    # hash link on the same page scrolls instead of reloading
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(800)
    page.locator(".header__nav a[href='index.html#faq']").click()
    page.wait_for_timeout(1800)
    faq_top = page.locator("#faq").bounding_box()["y"]
    ok(abs(faq_top) < 120, f"FAQ link scrolls to the questions (top at {faq_top:.0f})")

    # page transition to All books via a genre link
    page.locator(".genre__link").first.scroll_into_view_if_needed()
    page.wait_for_timeout(1000)
    page.locator(".genre__link").first.click()
    frames = []
    for i in range(8):
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/trans-{i}.png")
    page.wait_for_timeout(1500)
    ok(page.url.endswith("books.html?genre=romance"), f"genre link opens the catalogue ({page.url})")
    ok(page.locator("[data-barba-namespace=books]").count() == 1, "books page swapped in without reload")
    status = page.locator("[data-search-status]").inner_text()
    ok("Romance" in status and "2 books" in status, f"genre filter applied: {status}")
    ok(page.locator("[data-nav=books]").first.get_attribute("aria-current") == "page", "All books marked current")
    page.fill("#search-box", "the")
    page.wait_for_timeout(500)
    ok("1 book" in page.locator("[data-search-status]").inner_text(), "search + genre narrows to one book")
    page.locator(".chip[aria-pressed=true]").click()
    page.wait_for_timeout(500)
    st = page.locator("[data-search-status]").inner_text()
    ok("3 books" in st, f"search alone finds three titles with “the”: {st}")
    page.fill("#search-box", "zzzz")
    page.wait_for_timeout(300)
    ok(page.locator("[data-search-empty]").is_visible(), "no-match message shows")
    page.fill("#search-box", "")
    page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/books.png")

    # a card opens its book's page, which has its details and an Add to bag button
    page.locator(".book-card").first.click(position={"x": 60, "y": 60})
    page.wait_for_timeout(3200)
    ok(page.url.endswith("book-the-lighthouse-letters.html"), f"a card opens its book page ({page.url})")
    ok(page.locator("h1").inner_text().strip() == "The Lighthouse Letters", "book page shows the title")
    ok(page.locator(".book-about__facts dt").count() == 5, "book page lists the details")
    ok(page.locator("[data-barba-namespace=book]").count() == 1, "book page swapped in without reload")
    page.locator("[data-add-to-bag]").click()
    page.wait_for_timeout(400)
    ok("Added to your bag" in page.locator("[data-bag-status]").inner_text(), "Add to bag answers")
    ok(page.locator(".book-more .book-card").count() == 3, "three related books")
    page.screenshot(path=f"{OUT}/book.png")

    # back: phones animate history moves themselves, so the page must appear at once with no squiggle over it
    page.go_back()
    page.wait_for_timeout(350)
    ok(page.url.split("?")[0].endswith("books.html"), f"back returns to the catalogue ({page.url})")
    covered = page.evaluate("getComputedStyle(document.querySelector('[data-transition-logo]')).opacity !== '0'")
    ok(page.locator("#search-box").is_visible() and not covered, "going back shows the page at once, no transition")

    # to sign-up and the form
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(600)
    page.goto(BASE + "signup.html", wait_until="networkidle")
    page.wait_for_timeout(3000)
    page.locator("form[data-validate] button[type=submit]").click()
    ok(page.locator("#username-error").inner_text() != "", "sign-up shows errors")
    ok(page.evaluate("document.activeElement.id") == "username", "focus moves to first error")
    page.fill("#username", "<img src=x onerror=alert(1)>")
    page.fill("#password", "secret1")
    page.fill("#confirm", "secret1")
    page.fill("#contact", "9876543210")
    page.locator("form[data-validate] button[type=submit]").click()
    msg = page.locator("#form-message").inner_text()
    ok("Account created" in msg and page.locator("#form-message img").count() == 0, "sign-up succeeds, no HTML injection")
    page.screenshot(path=f"{OUT}/signup.png")
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
    print("phone console:", errors or "clean")
    page.close()

    # ---- the smallest phones: nothing may make any page wider than the screen, even while it animates in
    for path in ("", "books.html", "book-paper-moons.html", "signup.html"):
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

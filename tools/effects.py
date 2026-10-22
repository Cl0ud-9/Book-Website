"""After every kind of page change (a link, Back, Forward), check that each hover and pointer effect still responds.

usage: npm start, then: python tools/effects.py [BASE_URL]   (needs Playwright and Google Chrome)
"""
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
results = []


def changes(page, read, act, wait=350):
    before = page.evaluate(read)
    act()
    page.wait_for_timeout(wait)
    return page.evaluate(read) != before


def hover(page, sel, n=0):
    loc = page.locator(sel).nth(n)
    loc.scroll_into_view_if_needed()
    page.wait_for_timeout(900)
    box = loc.bounding_box()
    page.mouse.move(box["x"] - 30, box["y"] - 30)
    page.wait_for_timeout(300)
    return lambda: page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=4)


def check(page, where, name, read, act, wait=350):
    ok = changes(page, read, act, wait)
    results.append((where, name, ok))
    print(f"{'PASS' if ok else 'FAIL'}  {where:28} {name}", flush=True)


def nav_wave(page, where):
    sel = ".header__nav a"
    check(page, where, "nav button letters wave", f"document.querySelectorAll('{sel}')[1].querySelector('.split-char')?.style.transform || 'none'",
          hover(page, sel, 1), 120)


def home_effects(page, where):
    nav_wave(page, where)
    page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(800)
    check(page, where, "hero books lean to the pointer", "document.querySelector('.hero__book.is--main').style.transform",
          lambda: page.mouse.move(200, 600, steps=6), 600)
    book = page.locator(".hero__book.is--main").bounding_box()
    check(page, where, "a hero book leans when clicked", "document.querySelector('.hero__book.is--main').style.transform",
          lambda: page.mouse.click(book["x"] + book["width"] * 0.8, book["y"] + book["height"] / 2), 120)
    check(page, where, "hero button letters wave", "document.querySelector('.hero [data-button-alt-text] .split-char')?.style.transform || 'none'",
          hover(page, ".hero .button-alt"), 120)
    check(page, where, "how-it-works cards fan out", "[...document.querySelectorAll('[data-call-out-item]')].map(c => c.style.transform).join()",
          hover(page, "[data-call-out-item]", 1), 700)
    check(page, where, "genre covers pop out", "document.querySelectorAll('.genre__img.is--shown').length + '|' + document.querySelector('[data-genre-interaction-box]').style.cssText",
          hover(page, ".genre__item", 3), 700)
    check(page, where, "stickers fling", "[...document.querySelectorAll('[data-momentum-hover-target]')].map(t => t.style.transform).join()",
          hover(page, "[data-momentum-hover-element]", 0), 300)
    # dragging the main shelf
    vp = page.locator(".books__slider"); vp.scroll_into_view_if_needed(); page.wait_for_timeout(900); box = vp.bounding_box()
    def drag():
        page.mouse.move(box["x"] + box["width"] * .7, box["y"] + box["height"] / 2); page.mouse.down()
        page.mouse.move(box["x"] + box["width"] * .3, box["y"] + box["height"] / 2, steps=10); page.mouse.up()
    check(page, where, "shelf drags", "Math.round(document.querySelector('.books__list .slide').getBoundingClientRect().left)", drag, 900)


def go(page, sel, n=0, wait=3300):
    page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(500)
    page.locator(sel).nth(n).click(); page.wait_for_timeout(wait)


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 860})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until="networkidle"); page.wait_for_timeout(4000)
    home_effects(page, "home (first load)")

    go(page, ".header__nav a[href='books.html']")
    nav_wave(page, "All books (after transition)")
    check(page, "All books (after transition)", "card cover lifts on hover", "getComputedStyle(document.querySelector('.book-card__cover')).translate",
          hover(page, ".book-card"), 700)

    page.locator(".book-card").first.click(position={"x": 60, "y": 60}); page.wait_for_timeout(3300)
    nav_wave(page, "book page (after transition)")
    page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(600)
    check(page, "book page (after transition)", "cover turns to the pointer", "document.querySelector('[data-book-tilt-target]').style.transform",
          lambda: page.mouse.move(300, 300, steps=6), 900)

    go(page, ".header__logo")
    home_effects(page, "home (after transition)")

    page.go_back(); page.wait_for_timeout(2500)
    nav_wave(page, "book page (after Back)")
    page.go_back(); page.wait_for_timeout(2500)
    nav_wave(page, "All books (after Back)")
    page.go_forward(); page.wait_for_timeout(2500)
    page.go_forward(); page.wait_for_timeout(2500)
    home_effects(page, "home (after Forward)")

    print("\nerrors:", errors or "none")
    print(sum(not ok for *_, ok in results), "failures of", len(results))
    browser.close()
sys.exit(1 if any(not ok for *_, ok in results) else 0)

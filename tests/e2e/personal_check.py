"""What is yours and your family's: suggested ages and the age filter, Kids mode and its PIN, Find my next book and its picks,
what arrives from the old address, where a book opens, and the opt-out from a browser's darkening on the reader page.

usage: npm run build && npm run preview, then: python tests/e2e/personal_check.py [BASE_URL]   (needs Playwright and Google Chrome)
"""
import json
import sys
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
BASE = BASE.rstrip("/") + "/"
bad = 0


def say(ok, what):
    global bad
    bad += not ok
    print("ok " if ok else "BUG", what)


PHONE = dict(viewport={"width": 411, "height": 791}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
VISIBLE = "[...document.querySelectorAll('.book-card')].filter(c => c.offsetParent !== null).length"

with sync_playwright() as p:
    br = p.chromium.launch(channel="chrome")

    # ---- Ages, and covers no wider than a card needs
    ctx = br.new_context(**PHONE)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:160]))
    page.goto(BASE + "books")
    page.wait_for_selector(".book-card")
    everyone = page.evaluate(VISIBLE)
    srcset = page.evaluate("document.querySelector('.book-card img').getAttribute('srcset') || document.querySelector('.book-card img').dataset.srcset || ''")
    say("1080w" not in srcset and "720w" in srcset, f"a card's cover stops at 720 wide ({srcset[-40:]})")
    page.select_option("[data-age-filter]", "10")
    page.wait_for_timeout(300)
    young = page.evaluate(VISIBLE)
    say(0 < young < everyone, f"the age filter narrows the shelf ({everyone} to {young})")
    say("age=10" in page.url, "and stays in the address")
    page.goto(BASE + "books?age=0")
    page.wait_for_selector(".book-card", state="attached")
    page.wait_for_timeout(300)
    say(0 < page.evaluate(VISIBLE) < young, "the address sets the filter")
    page.goto(BASE + "book-dracula")
    facts = page.inner_text(".book-about__facts")
    say("13 and up" in facts and "Frightening scenes" in facts, "a book's page gives its suggested age and notes")
    say(page.locator(".for-older").is_hidden(), "with Kids mode off, nothing is put away")

    # ---- Kids mode
    page.goto(BASE + "reading")
    page.wait_for_selector("[data-kids-on]")
    page.select_option("#kids-age", "10")
    page.fill("#kids-pin", "1234"); page.fill("#kids-again", "4321")
    page.click("[data-kids-on] button")
    page.wait_for_timeout(200)
    say("not the same" in page.inner_text("[data-kids-status]") and page.evaluate("document.documentElement.dataset.kids === undefined"), "two different PINs do not turn it on")
    page.fill("#kids-pin", "12"); page.fill("#kids-again", "12")
    page.click("[data-kids-on] button")
    page.wait_for_timeout(200)
    say("four digits" in page.inner_text("[data-kids-status]"), "a short PIN does not either")
    page.fill("#kids-pin", "1234"); page.fill("#kids-again", "1234")
    page.click("[data-kids-on] button")
    page.wait_for_function("document.documentElement.dataset.kids === '10'")
    stored = page.evaluate("localStorage.getItem('bookshelf:kids')")
    say("1234" not in stored, "the PIN is not kept as it was typed")
    page.goto(BASE + "books")
    page.wait_for_selector(".book-card", state="attached")
    page.wait_for_timeout(400)
    say(page.evaluate("document.documentElement.dataset.kids") == "10", "Kids mode is on from the first script after a reload")
    shown = page.evaluate(VISIBLE)
    say(0 < shown < everyone, f"All books shows only what is allowed ({shown})")
    say(page.evaluate("[...document.querySelectorAll('.book-card')].filter(c => c.offsetParent !== null).every(c => Number(c.dataset.age) <= 10)"), "and nothing older")
    say(str(shown) in page.inner_text("[data-search-status]"), "the count says the same")
    page.goto(BASE + "book-dracula")
    say(page.locator(".for-older").is_visible() and page.locator(".book-hero").is_hidden(), "an older book's page is put away")
    page.goto(BASE + "read?book=dracula")
    page.wait_for_timeout(1500)
    say("older readers" in page.inner_text("[data-reader-message]") and page.locator(".epub-container iframe").count() == 0, "and the reader will not open it")
    page.goto(BASE + "read?book=the-secret-garden")
    page.wait_for_selector(".reader.is--ready", timeout=30000)
    say(page.locator(".epub-container iframe").count() > 0, "a book for this age opens")
    page.goto(BASE)
    page.wait_for_timeout(2500)
    say(page.evaluate("[...document.querySelectorAll('[data-age]')].filter(e => e.tagName !== 'MAIN' && Number(e.dataset.age) > 10 && e.offsetParent !== null).length") == 0, "the home page shows nothing older")
    page.goto(BASE + "reading")
    page.wait_for_selector("[data-kids-off]")
    say(page.locator("[data-kids-on]").is_hidden(), "Your reading shows it is on")
    for i in range(4):
        page.fill("#kids-off-pin", "0000"); page.click("[data-kids-off] button"); page.wait_for_timeout(150)
    say("1 try left" in page.inner_text("[data-kids-status]"), "wrong PINs are counted")
    page.fill("#kids-off-pin", "0000"); page.click("[data-kids-off] button"); page.wait_for_timeout(150)
    say("Too many" in page.inner_text("[data-kids-status]"), "the fifth locks it")
    page.fill("#kids-off-pin", "1234"); page.click("[data-kids-off] button"); page.wait_for_timeout(150)
    say(page.evaluate("document.documentElement.dataset.kids") == "10", "while locked, even the right PIN waits")
    page.evaluate("const k = JSON.parse(localStorage.getItem('bookshelf:kids')); k.lockedUntil = 0; localStorage.setItem('bookshelf:kids', JSON.stringify(k))")
    page.fill("#kids-off-pin", "1234"); page.click("[data-kids-off] button"); page.wait_for_timeout(200)
    say(page.evaluate("document.documentElement.dataset.kids === undefined && !localStorage.getItem('bookshelf:kids')"), "the right PIN turns it off")
    say(not errors, f"no script errors ({errors[:2]})")
    ctx.close()

    # ---- Find my next book
    ctx = br.new_context(**PHONE)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:160]))
    page.goto(BASE)
    page.wait_for_timeout(1500)
    say("Not sure" in page.inner_text("[data-picked-title]") and page.locator("[data-picked-list] li").count() == 0, "before any answers, the home page invites you")
    taste = []
    page.on("request", lambda r: taste.append(r.url) if "taste.json" in r.url else None)
    say(not taste, "and does not fetch the picks' data")
    page.goto(BASE + "start")
    page.wait_for_selector(".start__cover")
    covers = page.locator(".start__cover")
    say(covers.count() == 12, f"twelve covers to choose from ({covers.count()})")
    covers.nth(0).tap(); covers.nth(3).tap(); covers.nth(3).tap(); covers.nth(5).tap()
    say(page.locator('.start__cover[aria-pressed="true"]').count() == 2, "tapping chooses, tapping again unchooses")
    page.tap(".start__next")
    for label in ("In a haunted house", "Keep me up all night", "An afternoon"):
        page.get_by_role("button", name=label).tap()
        page.wait_for_timeout(120)
    page.wait_for_selector(".start__stage .picked__book")
    titles = page.locator(".start__stage .picked__title").all_inner_texts()
    say(len(titles) == 9, f"nine picks ({titles[:3]})")
    why = " ".join(page.locator(".start__stage .picked__why").all_inner_texts())
    say("Horror" in why or "eerie" in why.lower() or "gripping" in why.lower(), "from what you answered")
    page.goto(BASE)
    page.wait_for_selector("[data-picked-list] li", timeout=15000)
    say(page.inner_text("[data-picked-title]") == "Picked for you", "the home page now shows your picks")
    page.goto(BASE + "reading")
    page.wait_for_selector("[data-picked-list] li", timeout=15000)
    say(page.locator("[data-picked-list] li").count() == 9, "and so does Your reading")
    say(not errors, f"no script errors ({errors[:2]})")
    ctx.close()

    # ---- What comes from the old address
    OLD = "https://cl0ud-9.github.io/"
    parcel = {"bookshelf:reading": json.dumps({"dracula": {"cfi": "epubcfi(/6/12!/4/2/4/1:0)", "percent": 0.5, "at": 5}, "../bad": {"cfi": "x"}}),
              "bookshelf:reader": json.dumps({"theme": "sepia"}), "notes": [{"id": "old-1", "book": "dracula", "text": "kept"}, {"nope": 1}], "evil": "x"}
    address = BASE + "#bookshelf-moved=" + quote(json.dumps(parcel))
    ctx = br.new_context(**PHONE)
    page = ctx.new_page()
    page.goto(address, referer=OLD)
    page.wait_for_timeout(1500)
    say("bookshelf-moved" not in page.url, "the address is cleaned at once")
    places = page.evaluate("JSON.parse(localStorage.getItem('bookshelf:reading') || '{}')")
    say(places.get("dracula", {}).get("percent") == 0.5 and "../bad" not in places, "your place comes along, and nothing malformed")
    say(page.evaluate("JSON.parse(localStorage.getItem('bookshelf:reader')).theme") == "sepia" and page.evaluate("localStorage.getItem('evil')") is None, "your settings come along, and only those")
    notes = page.evaluate("new Promise(res => { const o = indexedDB.open('bookshelf', 1); o.onsuccess = () => { const r = o.result.transaction('notes').objectStore('notes').getAll(); r.onsuccess = () => { o.result.close(); res(r.result); }; }; })")
    say([n["id"] for n in notes] == ["old-1"], "your notes come along")
    page.evaluate("localStorage.setItem('bookshelf:reading', JSON.stringify({dracula: {cfi: 'mine', percent: .9, at: 99}}))")
    page.goto("about:blank"); page.goto(address, referer=OLD); page.wait_for_timeout(800)
    say(page.evaluate("JSON.parse(localStorage.getItem('bookshelf:reading')).dracula.cfi") == "mine", "a later place here is not overwritten")
    ctx.close()
    ctx = br.new_context(**PHONE)
    page = ctx.new_page()
    page.goto(address, referer="https://example.com/")
    page.wait_for_timeout(1000)
    say("bookshelf-moved" not in page.url and page.evaluate("localStorage.getItem('bookshelf:reading')") is None, "from anywhere else, it is ignored")
    ctx.close()

    # ---- Where a book opens, and the reader page's opt-out
    ctx = br.new_context(**PHONE)
    page = ctx.new_page()
    FOOT = "document.querySelector('[data-reader-chapter]').textContent.trim()"
    for book, not_at, why in (("buddenbrooks", "Translator", "a translator's note"), ("the-pilgrims-progress", "Works from", "a list of sources"), ("frankenstein", "Introduction", "an introduction")):
        page.goto(BASE + f"read?book={book}")
        page.wait_for_selector(".reader.is--ready", timeout=30000); page.wait_for_timeout(1500)
        at = page.evaluate(FOOT)
        say(not at.startswith(not_at), f"{book} opens past {why} ({at})")
    page.goto(BASE + "read?book=the-great-gatsby")
    page.wait_for_selector(".reader.is--ready", timeout=30000); page.wait_for_timeout(1500)
    say(page.evaluate(FOOT) == "Dedication", f"The Great Gatsby keeps its dedication ({page.evaluate(FOOT)})")
    say(page.locator('meta[name="color-scheme"]').count() == 0, "with a book open, the page's own opt-out steps aside")
    frame = page.evaluate("getComputedStyle(document.querySelector('.epub-container iframe')).colorScheme")
    say(frame == "normal", f"and the frame does not inherit one ({frame})")
    say(page.evaluate("document.querySelector('.epub-container iframe').contentWindow.getComputedStyle(document.querySelector('.epub-container iframe').contentDocument.documentElement).colorScheme") == "light only", "the frame says it for itself")
    page.evaluate("document.querySelector('.reader').classList.remove('is--immersive')")
    page.locator(".reader__back, [data-reader-back], .reader__bar a").first.click()
    page.wait_for_timeout(2500)
    say(page.locator('meta[name="color-scheme"]').count() == 1, f"leaving the book puts it back ({page.url[len(BASE):]})")
    ctx.close()
    br.close()
print("failures:", bad)
sys.exit(1 if bad else 0)

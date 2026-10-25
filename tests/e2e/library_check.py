"""The library's finding aids, on a laptop and a phone: fiction and non-fiction, genres, the From India collection, mood
and length, Clear filters, the genres page's shelves, each book's edition, Before you start, Lines worth knowing (open
the book at a line; share it as a picture), the line of the day, and a Project Gutenberg book in the reader.

usage: npm run build && npm run preview, then: python tests/e2e/library_check.py [BASE_URL] [SCREENSHOT_DIR]   (needs Playwright and Google Chrome)
"""
import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "test-results/e2e"
Path(OUT).mkdir(parents=True, exist_ok=True)
ROOT = Path(__file__).resolve().parents[2]
L = json.load(open(ROOT / "data" / "books.json", encoding="utf-8"))
NONFIC = {"Philosophy", "Lives and memoirs", "History and politics", "Science and nature", "Essays and letters"}
moods = json.load(open(ROOT / "data" / "moods.json", encoding="utf-8"))
n_non = sum(1 for b in L if b["genres"][0] in NONFIC)
n_india = sum(1 for b in L if "india" in b.get("collections", []))
n_funny_short = sum(1 for b in L if "Funny" in moods[b["slug"]] and round(b["words"] / 275) < 180)


bad = 0


def say(ok, msg):
    global bad
    bad += not ok
    print(("ok  " if ok else "BUG ") + msg, flush=True)


def status(page):
    return page.locator("[data-search-status]").inner_text()


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for label, kw in (("laptop", {"viewport": {"width": 1440, "height": 900}}),
                      ("phone", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True})):
        ctx = b.new_context(accept_downloads=True, **kw)
        ctx.add_init_script("navigator.canShare = () => false;")  # this headless browser's share sheet never answers
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.on("console", lambda m: errs.append("console: " + m.text[:150]) if m.type == "error" else None)

        # catalogue filters
        page.goto(BASE + "books.html"); page.wait_for_timeout(2500)
        say(f"all {len(L)} books" in status(page), f"{label}: All books shows all {len(L)}: {status(page)!r}")
        page.locator(".kinds [data-kind=nonfiction]").click(); page.wait_for_timeout(500)
        visible = page.locator(".book-card:not([hidden])").count()
        chips = page.locator(".chips li:not([hidden]) .chip").all_inner_texts()
        say(visible == n_non and "Romance" not in chips and "Lives and memoirs" in chips, f"{label}: Non-fiction shows {visible}/{n_non}, chips {chips}")
        say("kind=nonfiction" in page.url, f"{label}: the choice is kept in the address")
        page.locator(".chip", has_text="Lives and memoirs").click(); page.wait_for_timeout(500)
        say(page.locator(".book-card:not([hidden])").count() == sum(1 for x in L if "Lives and memoirs" in x["genres"]), f"{label}: a non-fiction genre: {status(page)!r}")
        page.locator(".kinds [data-kind=fiction]").click(); page.wait_for_timeout(500)
        say("genre=" not in page.url and page.locator(".chip[aria-pressed=true]").count() == 0, f"{label}: switching to Fiction drops the non-fiction genre")
        page.locator(".kinds [data-kind='']").click(); page.wait_for_timeout(400)
        page.locator(".chip.is--collection").click(); page.wait_for_timeout(500)
        say(page.locator(".book-card:not([hidden])").count() == n_india, f"{label}: From India shows {n_india}: {status(page)!r}")
        page.locator(".chip.is--collection").click(); page.wait_for_timeout(300)
        page.select_option("[data-mood]", "funny"); page.select_option("[data-length]", "short"); page.wait_for_timeout(500)
        say(page.locator(".book-card:not([hidden])").count() == n_funny_short and "mood=funny" in page.url and "length=short" in page.url,
            f"{label}: Funny and under 3 hours: {status(page)!r} (expected {n_funny_short})")
        page.reload(); page.wait_for_timeout(2500)
        say(page.locator(".book-card:not([hidden])").count() == n_funny_short and page.locator("[data-mood]").input_value() == "funny",
            f"{label}: a reload keeps the filters")
        page.select_option("[data-mood]", "eerie"); page.locator(".chip", has_text="Romance").click(); page.wait_for_timeout(500)
        empty = page.locator("[data-search-empty]").is_visible()
        page.screenshot(path=f"{OUT}/p2-filters-{label}.jpg", quality=60)
        say(page.locator("[data-clear-filters]").is_visible(), f"{label}: Clear filters shows ({'no books' if empty else status(page)})")
        page.locator("[data-clear-filters]").click(); page.wait_for_timeout(500)
        say(f"all {len(L)} books" in status(page) and "mood=" not in page.url, f"{label}: Clear filters shows every book again")

        # genres page
        page.goto(BASE + "genres.html"); page.wait_for_timeout(2500)
        shelves = page.locator(".shelf__name").all_text_contents()
        say(shelves[0] == "From India" and "Science and nature" in shelves and len(shelves) == 16, f"{label}: genres page shelves: {shelves[:3]}… ({len(shelves)})")

        # a book page: edition, guide, lines; open at a line; share
        page.goto(BASE + "book-pride-and-prejudice.html"); page.wait_for_timeout(2500)
        say("Standard Ebooks" in page.locator(".book-about__facts").inner_text(), f"{label}: the book page names its edition")
        say(page.locator(".guide__part").count() == 3, f"{label}: Before you start has three parts")
        lines = page.locator(".line")
        say(lines.count() == 3, f"{label}: three lines worth knowing")
        page.locator(".line").nth(1).scroll_into_view_if_needed()
        page.screenshot(path=f"{OUT}/p2-book-{label}.jpg", quality=60)
        if label == "laptop":
            with page.expect_download() as dl:
                page.locator(".line__share").first.click()
            say(dl.value.suggested_filename.endswith(".png"), f"{label}: Share saves a picture ({dl.value.suggested_filename})")
            dl.value.save_as(f"{OUT}/p2-share.png")
        target = lines.nth(1).locator(".line__text").inner_text()
        page.locator(".line__open").nth(1).click()
        page.wait_for_selector(".reader.is--ready", timeout=20000); page.wait_for_timeout(5000)
        words = target.strip("“”…").split()[:5]
        visible_text = page.evaluate("""() => [...document.querySelectorAll('.epub-container iframe')].filter(f => { const r = f.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; })
            .map(f => f.contentDocument.body.innerText).join(' ')""")
        on_line = " ".join(words) in re.sub(r"\s+", " ", visible_text)
        back_to = page.locator("[data-reader-return]").is_visible()
        say(on_line and back_to, f"{label}: Open at this line lands on the line ({on_line}), with Back to ({back_to})")

        # home: line of the day
        page.goto(BASE); page.wait_for_timeout(3000)
        daily = page.locator("[data-daily-text]").inner_text()
        say(len(daily) > 10, f"{label}: line of the day: {daily[:60]!r}")
        # a Project Gutenberg book
        page.goto(BASE + "book-the-golden-threshold.html"); page.wait_for_timeout(2500)
        say("Project Gutenberg" in page.locator(".book-about__facts").inner_text(), f"{label}: a Gutenberg book names its edition")
        page.locator("[data-read-button]").click()
        page.wait_for_selector(".reader.is--ready", timeout=20000); page.wait_for_timeout(2500)
        say(page.locator(".reader__toc-link").count() > 3, f"{label}: a Gutenberg book opens in the reader with its contents ({page.locator('.reader__toc-link').count()} entries)")
        print(f"{label} errors:", errs or "none")
        ctx.close()
    b.close()
print("failures:", bad)
sys.exit(1 if bad else 0)

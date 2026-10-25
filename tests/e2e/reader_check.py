"""The reader: switching between every pair of page colours (the text and page must follow each time, back and forth),
and highlighting on a phone (the bar docks at the top, clear of the words; it stays while a selection is stretched or
scrolled; every button fits and works) and on a laptop (the bar floats by the words).

usage: npm run build && npm run preview, then: python tests/e2e/reader_check.py [BASE_URL] [SCREENSHOT_DIR]   (needs Playwright and Google Chrome)
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "test-results/e2e")
OUT.mkdir(parents=True, exist_ok=True)
WANT = {"paper": ("rgb(29, 27, 22)", "rgb(255, 253, 246)"), "sepia": ("rgb(59, 47, 30)", "rgb(243, 233, 210)"),
        "night": ("rgb(228, 223, 210)", "rgb(23, 22, 28)")}
ORDER = ["paper", "night", "paper", "sepia", "night", "sepia", "paper", "night", "night", "paper"]
bad = 0


def say(ok, msg):
    global bad
    bad += not ok
    print(("ok  " if ok else "BUG ") + msg, flush=True)


# Selects a few words of a long paragraph in the middle of the screen, as a finger would: [words, which paragraph]
SELECT = """([words, para]) => {
  for (const f of document.querySelectorAll('.epub-container iframe')) {
    const r = f.getBoundingClientRect();
    if (r.bottom < 100 || r.top > innerHeight) continue;
    const doc = f.contentDocument;
    const ps = [...doc.querySelectorAll('p')].filter(p => { const b = p.getBoundingClientRect(); const top = r.top + b.top;
      return p.textContent.trim().split(/\\s+/).length > 25 && top > 150 && top < innerHeight - 250; });
    const p = ps[para]; if (!p) continue;
    const walker = doc.createTreeWalker(p, NodeFilter.SHOW_TEXT); const t = walker.nextNode();
    const sel = doc.getSelection(); const range = doc.createRange();
    range.setStart(t, 0);
    let end = 0, seen = 0; const text = t.nodeValue;
    for (let i = 0; i < text.length && seen < words; i++) if (text[i] === ' ') { seen++; end = i; }
    range.setEnd(t, end || Math.min(text.length, 40));
    sel.removeAllRanges(); sel.addRange(range);
    const b = range.getBoundingClientRect();
    return { top: r.top + b.top, bottom: r.top + b.bottom, text: range.toString() };
  }
  return null;
}"""

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    # ---------- page colours ----------
    for label, kw in (("laptop", {"viewport": {"width": 1440, "height": 900}}),
                      ("phone", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True})):
        page = b.new_context(**kw).new_page()
        page.goto(BASE + "read.html?book=pride-and-prejudice")
        page.wait_for_selector(".reader.is--ready", timeout=30000)
        page.wait_for_timeout(2500)
        for step, theme in enumerate(ORDER):
            if label == "phone" and page.locator(".reader").evaluate("r => r.classList.contains('is--immersive')"):
                page.locator(".reader").evaluate("r => r.classList.remove('is--immersive')")
            page.locator("[aria-controls=reader-settings]").first.click()
            page.wait_for_timeout(300)
            page.locator(f"[data-reader-theme={theme}]").click()
            page.wait_for_timeout(700)
            got = page.evaluate("""() => [...document.querySelectorAll('.epub-container iframe')].map(f => {
                const s = getComputedStyle(f.contentDocument.body); const p = f.contentDocument.querySelector('p');
                return [s.color, s.backgroundColor, p ? getComputedStyle(p).color : ''] })""")
            say(all(c == WANT[theme][0] and bg == WANT[theme][1] and (not pc or pc == WANT[theme][0]) for c, bg, pc in got) and got, f"{label} step {step}: {theme}: {got[:2]}")
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
        # a chapter loaded after the switch takes the theme too
        page.keyboard.press("ArrowRight"); page.keyboard.press("ArrowRight"); page.keyboard.press("ArrowRight")
        page.mouse.wheel(0, 6000); page.wait_for_timeout(1500)
        got = page.evaluate("""() => [...document.querySelectorAll('.epub-container iframe')].map(f => getComputedStyle(f.contentDocument.body).color)""")
        say(all(c == WANT[ORDER[-1]][0] for c in got), f"{label}: later chapters keep {ORDER[-1]}: {got}")

    br = b
    # ---------- highlighting ----------
    for width in (360, 390):
        ctx = br.new_context(viewport={"width": width, "height": 780}, is_mobile=True, has_touch=True, device_scale_factor=2)
        ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.goto(BASE + "read.html?book=the-wonderful-wizard-of-oz")
        page.wait_for_selector(".reader.is--ready", timeout=30000)
        page.wait_for_timeout(2500)
        page.mouse.wheel(0, 2500)
        page.wait_for_timeout(1500)
        sel = page.evaluate(SELECT, [5, 0])
        page.wait_for_timeout(700)
        bar = page.locator("[data-select-bar]")
        box = bar.bounding_box() if bar.is_visible() else None
        say(box is not None and abs(box["y"]) < 1 and abs(box["width"] - width) < 1, f"{width}: the bar docks across the top ({box})")
        say(box is not None and sel and box["y"] + box["height"] < sel["top"], f"{width}: it is clear of the selected words (bar ends {box and box['y'] + box['height']:.0f}, words start {sel and sel['top']:.0f})")
        fits = page.evaluate("""() => { const b = document.querySelector('[data-select-bar]');
            const items = [...b.querySelectorAll('button:not([hidden])')].map(x => x.getBoundingClientRect());
            return { over: b.scrollWidth - b.clientWidth, minW: Math.min(...items.map(r => r.width)), minH: Math.min(...items.map(r => r.height)),
                     out: items.filter(r => r.left < 0 || r.right > innerWidth).length,
                     labels: [...b.querySelectorAll('.reader__select-tool:not([hidden]) .reader__select-label')].map(l => [l.textContent, l.scrollWidth <= l.parentElement.clientWidth + 1]) } }""")
        say(fits["over"] <= 0 and fits["out"] == 0 and fits["minW"] >= 30 and fits["minH"] >= 30 and all(ok for _, ok in fits["labels"]),
            f"{width}: every button fits, is a finger's size and its label is whole: {fits}")
        page.screenshot(path=f"{OUT}/phone-select-{width}.png")
        # stretching the selection (dragging a handle) keeps the bar where it is
        page.evaluate(SELECT, [14, 0])
        page.wait_for_timeout(700)
        say(bar.is_visible() and abs(bar.bounding_box()["y"]) < 1, f"{width}: stretching the selection keeps the bar")
        # a little scroll while selected
        page.mouse.wheel(0, 60)
        page.wait_for_timeout(900)
        say(bar.is_visible(), f"{width}: a small scroll with words selected keeps the bar")
        # highlight
        before = page.evaluate("document.querySelectorAll('.epub-container g.note-green').length")
        bar.locator("[data-style=green]").click()
        page.wait_for_timeout(800)
        after = page.evaluate("document.querySelectorAll('.epub-container g.note-green').length")
        collapsed = page.evaluate("[...document.querySelectorAll('.epub-container iframe')].every(f => f.contentDocument.getSelection().isCollapsed)")
        say(after == before + 1 and bar.is_hidden() and collapsed, f"{width}: green highlights the words, and the bar and selection go ({before}->{after})")
        say(page.locator("[data-reader-toast]").is_visible() and "Highlighted" in page.locator("[data-reader-toast]").inner_text(), f"{width}: says Highlighted")
        # selecting then tapping away: the bar goes with the selection
        page.evaluate(SELECT, [3, 0])
        page.wait_for_timeout(700)
        shown = bar.is_visible()
        page.evaluate("document.querySelectorAll('.epub-container iframe').forEach(f => f.contentDocument.getSelection().removeAllRanges())")
        page.wait_for_timeout(800)
        say(shown and bar.is_hidden(), f"{width}: dropping the selection hides the bar")
        # tapping the highlight opens it with Remove
        g = page.locator(".epub-container g.note-green rect").first
        gb = g.bounding_box()
        page.touchscreen.tap(gb["x"] + gb["width"] / 2, gb["y"] + gb["height"] / 2)
        page.wait_for_timeout(700)
        say(bar.is_visible() and bar.locator("[data-select-delete]").is_visible(), f"{width}: tapping a highlight shows it, with Remove")
        page.screenshot(path=f"{OUT}/phone-select-existing-{width}.png")
        bar.locator("[data-select-delete]").click()
        page.wait_for_timeout(700)
        say(page.locator(".epub-container g.note-green").count() == before and page.locator("[data-toast-undo]").is_visible(), f"{width}: Remove takes it away, with Undo")
        page.locator("[data-toast-undo]").click()
        page.wait_for_timeout(700)
        say(page.locator(".epub-container g.note-green").count() == before + 1, f"{width}: Undo brings it back")
        # copy and note
        page.evaluate(SELECT, [9, 0]); page.wait_for_timeout(700)
        bar.locator("[data-select-copy]").click(); page.wait_for_timeout(500)
        clip = page.evaluate("navigator.clipboard.readText()")
        say("Wonderful Wizard" in clip, f"{width}: Copy copies the words with the book's name: {clip[:50]!r}")
        page.evaluate(SELECT, [9, 0]); page.wait_for_timeout(700)
        bar.locator("[data-select-note]").click(); page.wait_for_timeout(500)
        ed = page.locator("[data-note-editor]")
        eb = ed.bounding_box()
        say(ed.is_visible() and eb["x"] >= 0 and eb["x"] + eb["width"] <= width, f"{width}: Note opens the note box on screen")
        page.fill("[data-note-text]", "Remember this")
        page.locator("[data-note-save]").click(); page.wait_for_timeout(500)
        say(ed.is_hidden(), f"{width}: the note saves")
        # the reader's own bar is back once the selection is done
        say(page.locator(".reader__bar").is_visible(), f"{width}: the reader's bar is back")
        print(f"{width} errors:", errs or "none")
        ctx.close()
    # laptop: floats beside the words
    page = br.new_page(viewport={"width": 1440, "height": 900})
    page.goto(BASE + "read.html?book=the-wonderful-wizard-of-oz")
    page.wait_for_selector(".reader.is--ready", timeout=30000)
    page.wait_for_timeout(2500)
    page.keyboard.press("ArrowRight"); page.keyboard.press("ArrowRight"); page.wait_for_timeout(1200)
    sel = page.evaluate(SELECT, [5, 0])
    page.wait_for_timeout(700)
    bar = page.locator("[data-select-bar]")
    bb = bar.bounding_box() if bar.is_visible() else None
    say(bb is not None and bb["width"] < 500 and not page.evaluate("document.querySelector('[data-select-bar]').classList.contains('is--docked')"),
        f"laptop: the bar floats by the words ({bb})")
    title = bar.locator("[data-select-note]").get_attribute("title")
    say(title == "Add a note", "laptop: each tool is named on hover")
    page.screenshot(path=f"{OUT}/laptop-select.png")
    br.close()
print("failures:", bad)
sys.exit(1 if bad else 0)

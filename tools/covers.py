"""Draw the Bookshelf's own covers, for books whose usual cover painting is not free in India, or that have none.

A cover painted by someone who died after 1965 is still under copyright in India, though the book's words are free,
so those books get a cover drawn here instead: the title and author in the site's own type, on bold shapes in a colour
of their own. tools/library.py uses library/covers/<book>.png in place of the painting, on the site and inside the EPUB.

usage: python tools/covers.py      (needs Playwright and Google Chrome) then python tools/library.py and tools/build.py
"""
import base64
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "library" / "covers"

# book: (background, shapes, ink, the motif: "sun", "waves", "rings", "stars", "bars", "leaves" or "grass")
COVERS = {
    "a-princess-of-mars": ("#b63a1a", "#e2702f", "#fff3dc", "sun"),
    "pirates-of-venus": ("#0f5e63", "#1c8f8a", "#eafff7", "waves"),
    "the-count-of-monte-cristo": ("#13294b", "#2b4f86", "#f5e9c8", "bars"),
    "the-great-gatsby": ("#0b1026", "#c9a227", "#f6e7b0", "rings"),
    "the-man-who-was-thursday": ("#3b308f", "#5f50c4", "#ffd24a", "stars"),
    "the-wind-in-the-willows": ("#2f5d2a", "#5b9844", "#fbf5d8", "leaves"),
    "leaves-of-grass": ("#5b6b1e", "#8fa133", "#fdf8df", "grass"),
    # Project Gutenberg books (library/gutenberg.json), which come with no painted cover
    "the-golden-threshold": ("#7a1f3d", "#d9a441", "#fff1d6", "sun"),
    "ancient-ballads-and-legends-of-hindustan": ("#1f3a5f", "#3f6fa3", "#fdf1d8", "waves"),
    "the-song-celestial": ("#14213d", "#e0a526", "#fbefd2", "rings"),
    "shakuntala-and-other-works": ("#2d5a3d", "#7fb069", "#fff6e0", "leaves"),
    "twenty-two-goblins": ("#2b1d4e", "#7e5bd6", "#ffe9a8", "stars"),
}

SHAPES = {
    "sun": '<circle cx="540" cy="700" r="330" fill="{shape}"/><circle cx="540" cy="700" r="230" fill="{bg}" opacity=".35"/>',
    "waves": "".join(f'<path d="M-40 {y} q135 -70 270 0 t270 0 t270 0 t270 0 t270 0" fill="none" stroke="{{shape}}" stroke-width="34" stroke-linecap="round"/>'
                     for y in range(420, 1100, 110)),
    "rings": "".join(f'<circle cx="540" cy="720" r="{r}" fill="none" stroke="{{shape}}" stroke-width="10" opacity="{o}"/>'
                     for r, o in ((120, 1), (200, .8), (280, .6), (360, .45), (440, .3))),
    "bars": "".join(f'<rect x="{x}" y="300" width="46" height="820" rx="23" fill="{{shape}}"/>' for x in range(170, 900, 130))
            + '<rect x="120" y="380" width="840" height="40" rx="20" fill="{shape}"/><rect x="120" y="1000" width="840" height="40" rx="20" fill="{shape}"/>',
    "leaves": "".join(f'<ellipse cx="{x}" cy="{y}" rx="34" ry="120" transform="rotate({r} {x} {y})" fill="{{shape}}"/>'
                      for x, y, r in ((300, 520, -30), (470, 470, 10), (650, 540, 35), (820, 470, -15), (380, 790, 25), (580, 760, -20),
                                      (760, 800, 15), (250, 1020, -10), (470, 1050, 30), (700, 1060, -25), (880, 1010, 20))),
    "grass": "".join(f'<path d="M{x} 1140 Q{x + d * 0.2} 800 {x + d} {top}" fill="none" stroke="{{shape}}" stroke-width="26" stroke-linecap="round"/>'
                     for x, d, top in ((150, 60, 520), (240, -40, 640), (330, 80, 420), (420, -20, 560), (510, 60, 380), (600, -50, 600),
                                       (690, 70, 460), (780, -30, 580), (870, 40, 430), (960, -60, 620))),
    "stars": "".join(f'<path d="M{x} {y} l18 46 46 18 -46 18 -18 46 -18 -46 -46 -18 46 -18z" fill="{{shape}}"/>'
                     for x, y in ((260, 520), (800, 430), (540, 760), (330, 980), (770, 900), (560, 470))),
}

PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Rubik; font-weight: 700 900; src: url(data:font/woff2;base64,{rubik}) format("woff2"); }}
@font-face {{ font-family: Figtree; font-weight: 500 700; src: url(data:font/woff2;base64,{figtree}) format("woff2"); }}
html, body {{ margin: 0; }}
.cover {{ position: relative; width: 1080px; height: 1620px; overflow: hidden; background: {bg}; color: {ink}; }}
svg {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
.text {{ position: absolute; left: 90px; right: 90px; bottom: 120px; display: grid; gap: 34px; }}
h1 {{ margin: 0; font: 900 {size}px/0.92 Rubik, sans-serif; letter-spacing: -0.03em; text-wrap: balance; }}
p {{ margin: 0; font: 700 50px/1.1 Figtree, sans-serif; letter-spacing: .01em; opacity: .92; }}
.mark {{ position: absolute; top: 90px; left: 90px; font: 700 34px Figtree, sans-serif; letter-spacing: .14em; text-transform: uppercase; opacity: .75; }}
</style></head><body><div class="cover">
<svg viewBox="0 0 1080 1620" aria-hidden="true">{shapes}</svg>
<div class="mark">The Bookshelf</div>
<div class="text"><h1>{title}</h1><p>{author}</p></div>
</div></body></html>"""


# The site's fonts, inlined: a page made from a string cannot load files from the disk
FONTS = {name: base64.b64encode((ROOT / "fonts" / f"{name}.woff2").read_bytes()).decode() for name in ("rubik", "figtree")}


def main():
    library = {b["slug"]: b for b in json.loads((ROOT / "library" / "books.json").read_text(encoding="utf-8"))}
    # books from Project Gutenberg are drawn before tools/library.py first adds them, so their names come from here
    for entry in json.loads((ROOT / "library" / "gutenberg.json").read_text(encoding="utf-8")):
        slug = re.sub(r"[^a-z0-9]+", "-", entry["title"].lower().replace("’", "")).strip("-")
        library.setdefault(slug, entry)
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 1080, "height": 1620})
        for slug, (bg, shape, ink, kind) in COVERS.items():
            book = library.get(slug)
            if not book:
                print(f"not on the shelf: {slug}")
                continue
            title = book["title"]
            size = 150 if len(title) <= 14 else 124 if len(title) <= 26 else 104
            html = PAGE.format(rubik=FONTS["rubik"], figtree=FONTS["figtree"], bg=bg, ink=ink, size=size, title=title, author=book["author"],
                               shapes=SHAPES[kind].format(shape=shape, bg=bg))
            page.set_content(html)
            page.evaluate("document.fonts.ready.then(() => [...document.fonts].map(f => f.family + ' ' + f.status))")
            page.wait_for_timeout(200)
            page.locator(".cover").screenshot(path=str(OUT / f"{slug}.png"))
            print(f"library/covers/{slug}.png")
        browser.close()


if __name__ == "__main__":
    main()

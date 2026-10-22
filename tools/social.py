"""Make the link-preview images (1200 x 630 JPEG, one for the site and one per book) and the home-screen icon.

usage: npm start, then: python tools/social.py [BASE_URL]   (needs Playwright, Pillow and Google Chrome)
"""
import io
import re
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
OUT = ROOT / "image" / "social"


def save_jpeg(png, path):
    Image.open(io.BytesIO(png)).convert("RGB").save(path, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"{path.relative_to(ROOT)}: {path.stat().st_size // 1024} KB")


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    # Reduced motion shows every page in its finished state straight away
    ctx = browser.new_context(viewport={"width": 1200, "height": 630}, reduced_motion="reduce")
    page = ctx.new_page()
    OUT.mkdir(exist_ok=True)
    # Each page names its own preview in og:image; the first page to name one is the one pictured
    shots = {}
    for html in [ROOT / "index.html", *sorted(ROOT.glob("book-*.html"))]:
        image = re.search(r'property="og:image" content="[^"]*?(image/social/[^"]+)"', html.read_text(encoding="utf-8"))
        shots.setdefault(image.group(1), "" if html.name == "index.html" else html.name)
    for image, name in shots.items():
        page.goto(BASE + name, wait_until="networkidle")
        page.wait_for_timeout(800)
        save_jpeg(page.screenshot(), ROOT / image)

    # Home-screen icon: the logo edge to edge, since phones round the corners themselves
    logo = (ROOT / "image" / "logo.svg").read_text(encoding="utf-8").replace('rx="16" ', "")
    icon = browser.new_page(viewport={"width": 180, "height": 180})
    icon.set_content(f"<style>html,body{{margin:0}}svg{{display:block;width:180px;height:180px}}</style>{logo}")
    (ROOT / "image" / "apple-touch-icon.png").write_bytes(icon.screenshot())
    print("image/apple-touch-icon.png")
    browser.close()

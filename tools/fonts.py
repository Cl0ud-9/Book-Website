"""Build the three web fonts in fonts/ from their Google Fonts sources.

Rubik is pinned to weight 900 and Figtree to 500-700, all three are cut down to the characters the site uses, and
Rubik gets a ✦ drawn in (none of the three fonts has one; css/main.css lends it to Figtree too).

usage: python tools/fonts.py   (needs fonttools and brotli; the sources are downloaded once into tools/.font-src)
"""
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / ".font-src"
RAW = "https://raw.githubusercontent.com/google/fonts"
SOURCES = {
    "rubik": f"{RAW}/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/rubik/Rubik%5Bwght%5D.ttf",
    "figtree": f"{RAW}/a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/Figtree%5Bwght%5D.ttf",
    "gochi-hand": f"{RAW}/47be017e2beab9d6980d93a2c49d85e4ed837867/ofl/gochihand/GochiHand-Regular.ttf",
}
# Basic Latin, Latin-1, dashes, quotes, ellipsis and the rupee sign
TEXT = [*range(0x20, 0x7F), *range(0xA0, 0x100), 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x2026, 0x20B9]
SPARKLE = 0x2726


def source(name):
    path = SRC / f"{name}.ttf"
    if not path.exists():
        SRC.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(SOURCES[name], path)
    return TTFont(path)


def cut(font):
    options = subset.Options()
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=TEXT)
    subsetter.subset(font)
    return font


def add_sparkle(font):
    """A four-pointed star, the same shape as the site's confetti sparkle, as tall as a capital and centred on it."""
    cap = font["OS/2"].sCapHeight
    k = cap * 0.52 / 10   # the outline spans -10..10
    side = round(cap * 0.08)
    cx, cy = side + 10 * k, cap / 2
    pen = TTGlyphPen(None)
    draw = Cu2QuPen(pen, max_err=1)
    p = lambda x, y: (round(cx + x * k), round(cy - y * k))
    draw.moveTo(p(0, -10))
    draw.curveTo(p(1, -3), p(3, -1), p(10, 0))
    draw.curveTo(p(3, 1), p(1, 3), p(0, 10))
    draw.curveTo(p(-1, 3), p(-3, 1), p(-10, 0))
    draw.curveTo(p(-3, -1), p(-1, -3), p(0, -10))
    draw.closePath()
    glyph = pen.glyph()

    name = "uni2726"
    order = font.getGlyphOrder() + [name]
    font.setGlyphOrder(order)
    glyf = font["glyf"]
    glyf.glyphOrder = order
    glyf.glyphs[name] = glyph
    glyph.recalcBounds(glyf)
    font["hmtx"].metrics[name] = (round(2 * side + 20 * k), glyph.xMin)
    font["maxp"].numGlyphs = len(order)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[SPARKLE] = name


def build():
    rubik = instancer.instantiateVariableFont(source("rubik"), {"wght": 900}, updateFontNames=True)
    cut(rubik)
    add_sparkle(rubik)
    figtree = cut(instancer.instantiateVariableFont(source("figtree"), {"wght": (500, 700)}))
    hand = cut(source("gochi-hand"))
    for name, font in (("rubik", rubik), ("figtree", figtree), ("gochi-hand", hand)):
        out = ROOT / "fonts" / f"{name}.woff2"
        font.flavor = "woff2"
        font.save(out)
        print(f"{out.relative_to(ROOT)}: {out.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    build()

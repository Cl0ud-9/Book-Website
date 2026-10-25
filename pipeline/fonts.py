"""Build the web fonts in fonts/ from their Google Fonts sources.

The site's own three: Rubik pinned to weight 900, Figtree (upright and italic) to 500-700, and Gochi Hand, cut down to
the characters the site uses; Rubik gets a ✦ drawn in (none of them has one; src/styles/main.css lends it to Figtree
too).
The reader's Literata (upright and italic, weights 400-900) is fixed at its text optical size and cut in two, as Google
Fonts does: Western European letters, and the rest of the Latin alphabets, which a browser fetches only for a book
that uses them (css/reader-content.css).

usage: python pipeline/fonts.py   (needs fonttools and brotli; the sources are downloaded once into pipeline/.font-src)
"""
import io
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "pipeline" / ".font-src"
RAW = "https://raw.githubusercontent.com/google/fonts"
SOURCES = {
    "rubik": f"{RAW}/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/rubik/Rubik%5Bwght%5D.ttf",
    "figtree": f"{RAW}/a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/Figtree%5Bwght%5D.ttf",
    "gochi-hand": f"{RAW}/47be017e2beab9d6980d93a2c49d85e4ed837867/ofl/gochihand/GochiHand-Regular.ttf",
    "figtree-italic": f"{RAW}/a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/Figtree-Italic%5Bwght%5D.ttf",
    "literata": f"{RAW}/4e5f06dbb274a27ebe71ed54ea706b3ee40eabd9/ofl/literata/Literata%5Bopsz,wght%5D.ttf",
    "literata-italic": f"{RAW}/4e5f06dbb274a27ebe71ed54ea706b3ee40eabd9/ofl/literata/Literata-Italic%5Bopsz,wght%5D.ttf",
}
# Basic Latin, Latin-1, dashes, quotes, ellipsis and the rupee sign
TEXT = [*range(0x20, 0x7F), *range(0xA0, 0x100), 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x2026, 0x20B9]
SPARKLE = 0x2726
# Literata's two parts, the same ranges as Google Fonts' "latin" and "latin-ext" (and css/reader-content.css)
def ranges(spec):
    out = []
    for part in spec.split(","):
        a, _, b = part.strip()[2:].partition("-")
        out.extend(range(int(a, 16), int(b or a, 16) + 1))
    return out


LATIN = ranges("U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, "
               "U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD")
LATIN_EXT = ranges("U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, "
                   "U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF")


def source(name):
    path = SRC / f"{name}.ttf"
    if not path.exists():
        SRC.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(SOURCES[name], path)
    return TTFont(path)


def cut(font, unicodes=TEXT, book=False):
    options = subset.Options()
    options.flavor = "woff2"
    if book:
        # the usual ligatures and kerning, and the old-style figures Standard Ebooks asks for (true small capitals would
        # add a fifth to the file; browsers draw their own)
        options.layout_features = options.layout_features + ["onum", "lnum"]
        options.hinting = False  # screens smooth text themselves; hints doubled the files
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
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
    figtree_italic = cut(instancer.instantiateVariableFont(source("figtree-italic"), {"wght": (500, 700)}))
    fonts = [("rubik", rubik), ("figtree", figtree), ("gochi-hand", hand), ("figtree-italic", figtree_italic)]
    for name in ("literata", "literata-italic"):
        # instanced once, then written out and read back for each part (subsetting an instanced font twice fails)
        text_size = io.BytesIO()
        instancer.instantiateVariableFont(source(name), {"opsz": 12}).save(text_size)
        for suffix, unicodes in (("", LATIN), ("-ext", LATIN_EXT)):
            text_size.seek(0)
            fonts.append((name + suffix, cut(TTFont(text_size, lazy=False), unicodes, book=True)))
    for name, font in fonts:
        out = ROOT / "src" / "assets" / "fonts" / f"{name}.woff2"
        font.flavor = "woff2"
        font.save(out)
        print(f"{out.relative_to(ROOT)}: {out.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    build()

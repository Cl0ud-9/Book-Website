"""Ten original book covers for The Bookshelf, drawn as SVG and rendered to WebP at 180, 360 and 720 pixels wide.

usage: python tools/covers.py [WORK_DIR]      (needs Pillow and Playwright, and Google Chrome installed)
Writes image/book-N-{180,360,720}.webp, and keeps the SVG sources and a contact sheet in WORK_DIR.
"""
import io
import math
import random
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FONTS, OUT = ROOT / "fonts", ROOT / "image"
WORK = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_covers"
W, H = 360, 574

# Shared: paper grain, a soft spine shadow, and the publisher mark at the foot of every cover
DEFS = """<defs>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/>
  </filter>
  <linearGradient id="spine" x1="0" x2="1">
    <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".05" stop-color="#fff" stop-opacity=".18"/>
    <stop offset=".1" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
</defs>"""

MARK = """<g transform="translate({x} {y}) scale(.34)" fill="{c}"><path d="M24 9.5c-4.2-3.3-10.3-4.4-17-3.5a2 2 0 0 0-1.7 2v27.6a2 2 0 0 0 2.3 2c6.2-.8 11.3.2 15.2 3.1a2 2 0 0 0 2.4 0c3.9-2.9 9-3.9 15.2-3.1a2 2 0 0 0 2.3-2V8a2 2 0 0 0-1.7-2c-6.7-.9-12.8.2-17 3.5Zm-2.2 4.2v20.9c-3.6-1.8-7.9-2.6-12.5-2.4V10c4.9-.4 9.3.8 12.5 3.7Zm4.4 0c3.2-2.9 7.6-4.1 12.5-3.7v22.2c-4.6-.2-8.9.6-12.5 2.4V13.7Z"/></g>"""


def finish(body, mark="#fff", mx=164, my=540):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{DEFS}{body}'
            f'{MARK.format(x=mx, y=my, c=mark)}'
            f'<rect width="{W}" height="{H}" filter="url(#grain)"/><rect width="{W}" height="{H}" fill="url(#spine)"/></svg>')


def stars(n, seed, x0=0, y0=0, x1=W, y1=H, colour="#fff", rmin=.6, rmax=1.8):
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        x, y, r = rnd.uniform(x0, x1), rnd.uniform(y0, y1), rnd.uniform(rmin, rmax)
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{colour}" opacity="{rnd.uniform(.5, 1):.2f}"/>')
    return "".join(out)


def sparkle(x, y, s, colour):
    return (f'<path transform="translate({x} {y}) scale({s})" fill="{colour}" '
            f'd="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z"/>')


def wave(y, amp, length, colour, phase=0, extra=""):
    pts = []
    x = -20
    while x <= W + 40:
        pts.append((x, y + math.sin((x / length) * math.tau + phase) * amp))
        x += 6
    d = "M" + " L".join(f"{a:.1f} {b:.1f}" for a, b in pts) + f" L{W + 40} {H + 10} L-20 {H + 10}Z"
    return f'<path d="{d}" fill="{colour}" {extra}/>'


def title(lines, x, y, size, colour, family="Bricolage Grotesque", anchor="start", lh=.92, style="", spacing=-.03):
    weight = 800 if family.startswith("Bricolage") else 600
    tspans = "".join(f'<tspan x="{x}" dy="{0 if i == 0 else size * lh:.1f}">{t}</tspan>' for i, t in enumerate(lines))
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-weight="{weight}" font-size="{size}" fill="{colour}" '
            f'text-anchor="{anchor}" letter-spacing="{spacing}em" font-style="{style or "normal"}">{tspans}</text>')


def author(name, x, y, colour, anchor="start", size=13):
    return (f'<text x="{x}" y="{y}" font-family="Figtree" font-weight="700" font-size="{size}" fill="{colour}" '
            f'letter-spacing=".16em" text-anchor="{anchor}">{name.upper()}</text>')


def hand(text, x, y, size, colour, anchor="start", rotate=0):
    return (f'<text x="{x}" y="{y}" font-family="Caveat" font-weight="500" font-size="{size}" fill="{colour}" '
            f'text-anchor="{anchor}" transform="rotate({rotate} {x} {y})">{text}</text>')


COVERS = {}

# 1. The Lighthouse Letters: a lighthouse at night, its beam sweeping over a sea with a letter adrift
COVERS[1] = finish(f"""
<rect width="360" height="574" fill="#2a2170"/>
<rect width="360" height="330" fill="#3b308f"/>
{stars(70, 1, 0, 0, 360, 330)}
<circle cx="282" cy="118" r="44" fill="#faed8f"/><circle cx="268" cy="108" r="9" fill="#ffd24a" opacity=".6"/><circle cx="296" cy="132" r="6" fill="#ffd24a" opacity=".6"/>
<path d="M176 236 L-40 150 L-40 290Z" fill="#faed8f" opacity=".32"/>
<path d="M190 236 L400 196 L400 262Z" fill="#faed8f" opacity=".18"/>
<path d="M120 452 C130 420 150 410 182 410 C214 410 236 420 248 452Z" fill="#1d1650"/>
<path d="M160 270 L204 270 L214 440 L150 440Z" fill="#fff"/>
<path d="M158 300 L206 300 L208 330 L156 330Z M154 362 L210 362 L212 392 L152 392Z" fill="#ff008c"/>
<rect x="164" y="244" width="36" height="26" rx="3" fill="#ffd24a"/><rect x="170" y="249" width="24" height="16" fill="#fff6c2"/>
<path d="M158 244 L182 222 L206 244Z" fill="#ff008c"/><rect x="154" y="268" width="56" height="7" rx="2" fill="#1d1650"/>
<rect x="176" y="404" width="12" height="20" rx="6" fill="#1d1650"/>
{wave(448, 6, 90, "#1ce8ed", 0)}
{wave(470, 7, 70, "#3b308f", 1.4)}
{wave(500, 6, 110, "#2a2170", 2.2)}
<g transform="translate(72 470) rotate(-14)"><rect width="56" height="38" rx="3" fill="#fff"/><path d="M0 0 L28 21 L56 0" fill="none" stroke="#3b308f" stroke-width="2.5"/><circle cx="28" cy="25" r="5" fill="#ff008c"/></g>
{title(["The", "Lighthouse", "Letters"], 26, 72, 46, "#fff", "Fraunces", lh=.95, spacing=-.02)}
{author("Mira Kapoor", 26, 205, "#faed8f")}
""")

# 2. Paper Moons: a mobile of paper crescents hanging over a pink sky
moons = ""
for x, top, length, r, col in [(78, 0, 150, 34, "#ffd24a"), (176, 0, 230, 46, "#ff008c"), (282, 0, 118, 28, "#3b308f"), (232, 0, 330, 22, "#ffd24a")]:
    cy = top + length + r
    moons += (f'<line x1="{x}" y1="0" x2="{x}" y2="{top + length}" stroke="#3b308f" stroke-width="1.6"/>'
              f'<mask id="m{x}"><rect width="360" height="574" fill="#fff"/><circle cx="{x + r * .45}" cy="{cy - r * .2}" r="{r * .9}" fill="#000"/></mask>'
              f'<circle cx="{x}" cy="{cy}" r="{r}" fill="{col}" mask="url(#m{x})"/>')
COVERS[2] = finish(f"""
<rect width="360" height="574" fill="#feb6fa"/>
<circle cx="300" cy="420" r="150" fill="#ffdbfd"/>
{moons}
{sparkle(120, 300, 1.2, "#3b308f")}{sparkle(300, 250, .8, "#ff008c")}{sparkle(60, 230, .7, "#3b308f")}{sparkle(320, 60, .6, "#ff008c")}
{title(["Paper", "Moons"], 26, 404, 74, "#2a1a5e")}
{hand("a love story, in pieces", 28, 516, 24, "#ff008c", rotate=-3)}
{author("Aanya Rao", 26, 545, "#2a1a5e")}
""", "#2a1a5e", 306, 528)

# 3. Small Rituals: a morning mug, a rising sun and a notebook
COVERS[3] = finish(f"""
<rect width="360" height="574" fill="#c2b4eb"/>
<circle cx="268" cy="150" r="96" fill="#f9a220"/><circle cx="268" cy="150" r="70" fill="#ffd24a"/>
<rect x="34" y="248" width="150" height="190" rx="10" fill="#fff" transform="rotate(-8 109 343)"/>
<g transform="rotate(-8 109 343)" stroke="#c2b4eb" stroke-width="2"><line x1="54" y1="292" x2="164" y2="292"/><line x1="54" y1="314" x2="164" y2="314"/><line x1="54" y1="336" x2="150" y2="336"/><line x1="54" y1="358" x2="164" y2="358"/><line x1="54" y1="380" x2="130" y2="380"/></g>
<rect x="36" y="250" width="12" height="186" fill="#ff008c" transform="rotate(-8 109 343)"/>
<path d="M190 300 h104 v86 a40 40 0 0 1 -40 40 h-24 a40 40 0 0 1 -40 -40Z" fill="#fff" stroke="#000" stroke-width="4"/>
<path d="M294 318 a24 24 0 0 1 0 48" fill="none" stroke="#000" stroke-width="4"/>
<path d="M200 300 h84" stroke="#3b308f" stroke-width="10"/>
<path d="M222 286 c-10-14 10-22 0-38 M246 286 c-10-14 10-22 0-38 M270 286 c-10-14 10-22 0-38" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
<ellipse cx="242" cy="430" rx="78" ry="8" fill="#000" opacity=".12"/>
{title(["Small", "Rituals"], 26, 72, 62, "#1b1440")}
{hand("keep your days, one page at a time", 26, 486, 24, "#3b308f", rotate=-2)}
{author("Leo Fernandes", 26, 528, "#1b1440")}
""", "#1b1440", 306, 512)

# 4. The Hollow Wood: tall dark trunks, watching eyes, and one glowing door
trunks = ""
rnd = random.Random(4)
for x, w, col in [(-10, 46, "#141c10"), (52, 30, "#26331d"), (104, 58, "#141c10"), (248, 40, "#26331d"), (296, 70, "#141c10")]:
    trunks += f'<path d="M{x} 0 L{x + w} 0 L{x + w + 8} 574 L{x - 8} 574Z" fill="{col}"/>'
eyes = "".join(f'<g fill="#faed8f"><ellipse cx="{x}" cy="{y}" rx="4" ry="2.4"/><ellipse cx="{x + 13}" cy="{y}" rx="4" ry="2.4"/></g>'
               for x, y in [(66, 300), (226, 250), (320, 380), (20, 430)])
COVERS[4] = finish(f"""
<rect width="360" height="574" fill="#2e3b22"/>
<circle cx="180" cy="300" r="170" fill="#69fe6f" opacity=".16" filter="url(#blur8)"/>
{trunks}
<path d="M170 0 L196 0 L232 574 L134 574Z" fill="#1a2414"/>
<path d="M156 474 L156 384 a27 27 0 0 1 54 0 L210 474Z" fill="#ffd24a"/>
<path d="M156 474 L156 384 a27 27 0 0 1 54 0 L210 474Z" fill="#faed8f" filter="url(#blur8)" opacity=".8"/>
<circle cx="200" cy="432" r="3.5" fill="#857521"/>
<path d="M120 476 Q183 462 246 476 L256 574 L110 574Z" fill="#faed8f" opacity=".18"/>
{eyes}
{stars(26, 44, 0, 120, 360, 520, "#69fe6f", .6, 1.4)}
{title(["The Hollow", "Wood"], 180, 82, 52, "#faed8f", "Fraunces", "middle", spacing=-.02)}
{author("Ines Marlow", 180, 170, "#69fe6f", "middle")}
""", "#faed8f")

# 5. Last Seen Wednesday: a torn calendar page, circled in red marker
COVERS[5] = finish(f"""
<rect width="360" height="574" fill="#ff008c"/>
<rect width="360" height="236" fill="#000"/>
{title(["LAST SEEN", "WEDNESDAY"], 24, 92, 50, "#fff", spacing=-.035)}
{author("Dev Malhotra", 26, 196, "#ff008c")}
<g transform="rotate(7 196 390)">
  <rect x="96" y="262" width="200" height="236" rx="6" fill="#000" opacity=".25" transform="translate(8 10)"/>
  <rect x="96" y="262" width="200" height="236" rx="6" fill="#fff"/>
  <rect x="96" y="262" width="200" height="52" rx="6" fill="#000"/><rect x="96" y="296" width="200" height="18" fill="#000"/>
  <text x="196" y="298" font-family="Figtree" font-weight="700" font-size="22" fill="#fff" text-anchor="middle" letter-spacing=".3em">WED</text>
  <text x="196" y="440" font-family="Bricolage Grotesque" font-weight="800" font-size="120" fill="#000" text-anchor="middle" letter-spacing="-.04em">13</text>
  <ellipse cx="196" cy="400" rx="78" ry="62" fill="none" stroke="#e1001d" stroke-width="6" transform="rotate(-8 196 400)"/>
  <path d="M96 498 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 V512 H96Z" fill="#ff008c"/>
</g>
{hand("where were you?", 34, 520, 30, "#000", rotate=-6)}
""", "#000", 306, 538)

# 6. Fog Over Kestrel Lane: a terrace of houses lost in fog, one window still lit
houses = ""
for x, w, h, roof, col in [(-6, 74, 210, 40, "#5b6f9a"), (68, 66, 240, 34, "#465a86"), (134, 80, 200, 46, "#5b6f9a"),
                           (214, 64, 250, 30, "#465a86"), (278, 90, 220, 44, "#5b6f9a")]:
    base = 574
    top = base - h
    houses += f'<path d="M{x} {base} V{top} L{x + w / 2} {top - roof} L{x + w} {top} V{base}Z" fill="{col}"/>'
    for wy in range(int(top + 26), base - 40, 46):
        for wx in (x + 14, x + w - 30):
            lit = (x, wy) == (134, int(top + 26) + 46)
            houses += f'<rect x="{wx}" y="{wy}" width="16" height="22" rx="2" fill="{"#ffd24a" if lit else "#7f93bf"}"/>'
COVERS[6] = finish(f"""
<rect width="360" height="574" fill="#c9eef0"/>
<circle cx="90" cy="140" r="40" fill="#fff" opacity=".9"/>
<path d="M200 170 q16 -14 32 0 q16 -14 32 0" fill="none" stroke="#1b2a4a" stroke-width="4" stroke-linecap="round"/>
{houses}
<rect x="148" y="400" width="16" height="22" rx="2" fill="#faed8f" filter="url(#blur3)"/>
<rect x="-20" y="300" width="400" height="40" fill="#fff" opacity=".55" filter="url(#blur8)"/>
<rect x="-20" y="410" width="400" height="56" fill="#fff" opacity=".6" filter="url(#blur8)"/>
<rect x="-20" y="500" width="400" height="90" fill="#fff" opacity=".7" filter="url(#blur8)"/>
{title(["Fog Over", "Kestrel Lane"], 26, 72, 44, "#1b2a4a", "Fraunces", spacing=-.02)}
{author("Clara Whitby", 26, 140, "#465a86")}
""", "#1b2a4a", 306, 534)

# 7. Wild Green Hours: a low sun behind a tangle of big leaves, title in the open sky above
leaves = ""
for cx, cy, rx, ry, rot, col in [(-10, 420, 70, 170, 28, "#0e5e3a"), (370, 400, 70, 170, -28, "#13774a"), (90, 520, 70, 150, -18, "#13774a"),
                                  (280, 530, 76, 150, 20, "#0e5e3a"), (180, 600, 120, 110, 0, "#0b4a2e")]:
    leaves += (f'<g transform="rotate({rot} {cx} {cy})"><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{col}"/>'
               f'<path d="M{cx} {cy - ry} V{cy + ry}" stroke="#69fe6f" stroke-width="2" opacity=".5"/></g>')
COVERS[7] = finish(f"""
<rect width="360" height="574" fill="#1ce8ed"/>
<circle cx="236" cy="372" r="96" fill="#ffd24a"/><circle cx="236" cy="372" r="122" fill="#ffd24a" opacity=".3"/>
{leaves}
<path d="M150 574 C156 480 170 430 196 392 C190 450 206 510 214 574Z" fill="#69fe6f"/>
<path d="M60 574 C70 500 90 460 120 440 C104 490 100 530 98 574Z" fill="#2de124"/>
{sparkle(300, 90, 1, "#fff")}{sparkle(326, 140, .6, "#fff")}
{title(["Wild", "Green", "Hours"], 26, 84, 64, "#0b2e1d")}
{author("Tara Bose", 26, 250, "#0b2e1d")}
""", "#fff")

# 8. Cities Above the Clouds: a floating island with domed towers, a balloon, and a sea of clouds
clouds = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>' for x, y, r, c in
                 [(-10, 500, 60, "#d7cdf1"), (60, 520, 56, "#fff"), (140, 506, 66, "#d7cdf1"), (230, 524, 60, "#fff"),
                  (320, 500, 70, "#d7cdf1"), (380, 530, 50, "#fff"), (100, 560, 60, "#fff"), (260, 566, 70, "#fff")])
COVERS[8] = finish(f"""
<rect width="360" height="574" fill="#3b308f"/>
<circle cx="180" cy="300" r="240" fill="#9982de" opacity=".55" filter="url(#blur8)"/>
{stars(60, 8, 0, 0, 360, 300)}
<path d="M70 330 Q180 300 290 330 L230 420 Q200 470 180 500 Q160 460 130 420Z" fill="#6b0f37"/>
<path d="M70 330 Q180 300 290 330 Q180 348 70 330Z" fill="#69fe6f"/>
<rect x="104" y="262" width="34" height="62" fill="#ffd24a"/><path d="M104 262 a17 17 0 0 1 34 0Z" fill="#ff008c"/>
<rect x="150" y="214" width="44" height="112" fill="#fff"/><path d="M150 214 a22 22 0 0 1 44 0Z" fill="#f9a220"/><rect x="168" y="178" width="8" height="18" fill="#f9a220"/>
<rect x="206" y="250" width="40" height="76" fill="#feb6fa"/><path d="M206 250 l20 -30 l20 30Z" fill="#ff008c"/>
<g fill="#3b308f"><rect x="164" y="236" width="16" height="22" rx="8"/><rect x="114" y="282" width="12" height="16" rx="6"/><rect x="218" y="270" width="14" height="18" rx="7"/></g>
<g transform="translate(290 186)"><path d="M-22 0 a22 24 0 0 1 44 0 q0 18 -14 30 h-16 q-14 -12 -14 -30Z" fill="#ff008c"/><path d="M-8 0 a8 24 0 0 1 16 0 q0 18 -4 30 h-8 q-4 -12 -4 -30Z" fill="#ffd24a"/><rect x="-7" y="38" width="14" height="10" rx="2" fill="#6b0f37"/><path d="M-8 30 L-6 38 M8 30 L6 38" stroke="#fff" stroke-width="1.5"/></g>
{clouds}
{title(["Cities", "Above the", "Clouds"], 180, 70, 44, "#fff", anchor="middle")}
{author("Noor Haddad", 180, 168, "#faed8f", "middle")}
""", "#3b308f")

# 9. Where Mountains Sleep: layered peaks under a dusk sky and a crescent moon
COVERS[9] = finish(f"""
<linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9982de"/><stop offset=".55" stop-color="#feb6fa"/><stop offset="1" stop-color="#fbbe63"/></linearGradient>
<rect width="360" height="574" fill="url(#dusk)"/>
<mask id="crescent"><rect width="360" height="574" fill="#fff"/><circle cx="104" cy="186" r="32" fill="#000"/></mask>
<circle cx="88" cy="196" r="36" fill="#fff6c2" mask="url(#crescent)"/>
{stars(30, 9, 0, 0, 360, 260)}
<path d="M-20 400 L70 290 L120 340 L200 230 L280 330 L320 290 L380 360 V574 H-20Z" fill="#c2b4eb"/>
<path d="M200 230 L222 258 L206 252 L196 268 L184 250 L176 256Z" fill="#fff"/>
<path d="M-20 450 L60 370 L140 440 L230 350 L300 410 L380 380 V574 H-20Z" fill="#9982de"/>
<path d="M-20 510 L90 430 L180 500 L280 440 L380 500 V574 H-20Z" fill="#3b308f"/>
<g fill="#2a2170">{"".join(f'<path d="M{x} 574 L{x + 10} {574 - h} L{x + 20} 574Z"/>' for x, h in [(10, 90), (28, 70), (46, 110), (250, 80), (268, 120), (292, 90), (318, 70)])}</g>
{title(["Where", "Mountains", "Sleep"], 334, 72, 46, "#2a2170", "Fraunces", "end", style="italic", spacing=-.02)}
{author("Kenji Arai", 334, 230, "#3b308f", "end")}
""")

# 10. Night Swimming: a moon, its broken reflection, and a swimmer's arm mid-stroke
reflection = "".join(f'<rect x="{180 - w / 2:.0f}" y="{y}" width="{w}" height="4" rx="2" fill="#ffd24a" opacity="{o}"/>'
                     for y, w, o in [(330, 90, .9), (344, 70, .8), (358, 100, .7), (372, 56, .7), (388, 80, .6), (404, 40, .5), (420, 64, .45), (440, 30, .4)])
COVERS[10] = finish(f"""
<rect width="360" height="574" fill="#141a3a"/>
{stars(80, 10, 0, 0, 360, 300)}
<circle cx="180" cy="226" r="58" fill="#ffd24a"/><circle cx="180" cy="226" r="86" fill="#ffd24a" opacity=".16" filter="url(#blur8)"/>
<rect y="300" width="360" height="274" fill="#0c1230"/>
{reflection}
<path d="M0 470 Q90 452 180 470 T360 470" fill="none" stroke="#1ce8ed" stroke-width="2" opacity=".5"/>
<path d="M0 500 Q90 482 180 500 T360 500" fill="none" stroke="#1ce8ed" stroke-width="2" opacity=".35"/>
<g transform="translate(232 468)"><path d="M-14 4 C-12 -46 30 -58 46 -20" fill="none" stroke="#ff008c" stroke-width="11" stroke-linecap="round"/><circle cx="-30" cy="0" r="12" fill="#ff008c"/><rect x="-60" y="2" width="130" height="20" fill="#0c1230"/><ellipse cx="-24" cy="4" rx="34" ry="5" fill="none" stroke="#1ce8ed" stroke-width="2.5"/><ellipse cx="46" cy="4" rx="16" ry="3.5" fill="none" stroke="#1ce8ed" stroke-width="2"/></g>
{title(["Night", "Swimming"], 180, 62, 48, "#fff", "Fraunces", "middle", style="italic", spacing=-.02)}
{hand("poems", 180, 148, 28, "#ffd24a", "middle")}
{author("Ruth Okafor", 180, 540, "#1ce8ed", "middle")}
""", "#ffd24a", 164, 500)

page = """<!DOCTYPE html><html><head><style>
@font-face { font-family: "Bricolage Grotesque"; font-weight: 800; src: url("FONTS/bricolage-grotesque.woff2"); }
@font-face { font-family: Figtree; font-weight: 500 700; src: url("FONTS/figtree.woff2"); }
@font-face { font-family: Caveat; font-weight: 500; src: url("FONTS/caveat.woff2"); }
@font-face { font-family: Fraunces; font-weight: 600; src: url("FONTS/fraunces.woff2"); }
@font-face { font-family: Fraunces; font-style: italic; font-weight: 600; src: url("FONTS/fraunces-italic.woff2"); }
html, body { margin: 0; background: #fff; } svg { display: block; width: 360px; height: 574px; }
</style></head><body>SVG</body></html>"""

WORK.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    tab = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
    for i, svg in COVERS.items():
        (WORK / f"cover-{i}.svg").write_text(svg, encoding="utf-8")
        html = WORK / f"cover-{i}.html"
        html.write_text(page.replace("FONTS", FONTS.as_uri()).replace("SVG", svg), encoding="utf-8")
        tab.goto(html.as_uri())
        tab.evaluate("document.fonts.ready")
        tab.wait_for_timeout(150)
        png = tab.screenshot(clip={"x": 0, "y": 0, "width": W, "height": H})
        im = Image.open(io.BytesIO(png)).convert("RGB")  # 720 x 1148
        for width in (720, 360, 180):
            out = im if width == 720 else im.resize((width, round(H * width / W)), Image.LANCZOS)
            out.save(OUT / f"book-{i}-{width}.webp", "WEBP", quality=80, method=6)
        print("cover", i, "done")
    browser.close()

sheet = Image.new("RGB", (10 * 186, 287), "white")
for i in range(1, 11):
    sheet.paste(Image.open(OUT / f"book-{i}-180.webp"), ((i - 1) * 186, 0))
sheet.save(WORK / "covers.jpg", quality=90)

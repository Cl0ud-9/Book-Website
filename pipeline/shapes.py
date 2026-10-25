"""Smooth organic SVG paths (Catmull-Rom through hand-placed points) for the backgrounds and the page transition."""


def _fmt(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def _segments(pts, closed):
    n = len(pts)
    out = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[i - 1] if (closed or i > 0) else pts[i]
        p1, p2 = pts[i], pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(f"C{_fmt(c1[0])} {_fmt(c1[1])} {_fmt(c2[0])} {_fmt(c2[1])} {_fmt(p2[0])} {_fmt(p2[1])}")
    return out


def closed(pts):
    return f"M{_fmt(pts[0][0])} {_fmt(pts[0][1])}" + "".join(_segments(pts, True)) + "Z"


def open_(pts):
    return f"M{_fmt(pts[0][0])} {_fmt(pts[0][1])}" + "".join(_segments(pts, False))


# Hero: a pale band sweeping up to the right, and a row of orange hills along the bottom
HERO_BAND = closed([(-120, 560), (140, 330), (430, 430), (690, 200), (990, 270), (1240, 60), (1560, -80),
                    (1560, 330), (1300, 430), (1060, 590), (760, 540), (520, 740), (250, 640), (-120, 930)])
HERO_HILLS = closed([(-120, 1040), (-120, 780), (110, 650), (270, 790), (430, 570), (580, 720), (720, 540),
                     (850, 700), (990, 610), (1120, 770), (1270, 650), (1560, 830), (1560, 1040)])
HERO_RIDGE = closed([(-120, 1040), (-120, 900), (200, 820), (380, 900), (640, 790), (900, 880), (1180, 800),
                     (1560, 930), (1560, 1040)])

# The page transition: one fat squiggle that, drawn in full, covers the screen
SNAKE = open_([(60, -80), (40, 250), (200, 470), (390, 270), (330, 90), (560, 40), (650, 330), (430, 560),
               (300, 800), (520, 1000), (730, 760), (700, 500), (880, 410), (1010, 620), (950, 900),
               (1110, 1160)])

# Soft blobs for the questions and the "why" sections
BLOB_A = closed([(-80, 120), (160, -40), (420, 60), (520, 300), (360, 460), (120, 420), (-60, 330)])
BLOB_B = closed([(900, 420), (1120, 300), (1380, 360), (1520, 560), (1420, 820), (1140, 860), (960, 700)])
BLOB_C = closed([(560, 760), (760, 660), (900, 800), (820, 980), (600, 1000), (480, 900)])
WHY_A = closed([(-100, 300), (180, 140), (420, 260), (380, 520), (140, 620), (-100, 560)])
WHY_B = closed([(1040, 80), (1300, -40), (1540, 120), (1520, 420), (1280, 480), (1080, 340)])
WHY_C = closed([(860, 640), (1120, 560), (1360, 700), (1300, 960), (980, 980), (820, 840)])

# The curved line the tagline runs along
TAGLINE = open_([(-200, 260), (120, 120), (480, 220), (820, 330), (1160, 170), (1500, 90), (1800, 220)])

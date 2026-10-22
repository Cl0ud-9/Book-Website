"""Write The Bookshelf's pages from the library (library/books.json, made by tools/library.py) and shared parts:
the home page, All books, a page for every book, the reader, log in, sign up and 404.

usage: python tools/build.py [OUTPUT_DIR]      (default: the repository root)
Change the shelf in tools/library.py, and what the home page features in FEATURED below.
"""
import hashlib
import html
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import shapes  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
e = html.escape

# Every book: title, author, translator, abstract, description (paragraphs), words, reading_time, language,
# standard_ebooks, slug, genres, spine, epub, kindle, kobo
LIBRARY = json.loads((ROOT / "library" / "books.json").read_text(encoding="utf-8"))
BOOK = {b["slug"]: b for b in LIBRARY}
GENRES = ["Romance", "Mystery", "Adventure", "Fantasy", "Science fiction", "Horror", "Poetry", "Philosophy",
          "Children’s", "Plays", "Literary fiction"]
TAG_COLOURS = {"Romance": "pale-pink", "Mystery": "pale-blue", "Adventure": "orange", "Fantasy": "pale-periwinkle",
               "Science fiction": "cyan", "Horror": "black", "Poetry": "pale-yellow", "Philosophy": "soft-orange",
               "Children’s": "pale-green", "Plays": "soft-periwinkle", "Literary fiction": "white",
               "Book of the month": "magenta"}
CARD_COLOURS = ["yellow", "pale-green", "pale-orange", "cyan", "periwinkle", "pale-pink", "pale-blue", "olive",
                "violet", "magenta"]
for n, b in enumerate(LIBRARY):
    b["colour"] = CARD_COLOURS[n % len(CARD_COLOURS)]
W, H = 360, 540
DARK = {"olive", "violet"}  # card colours that need white text (both pass WCAG AA with it)

# What the home page shows; every name is a book's slug
FEATURED = {
    "hero": ("wuthering-heights", "pride-and-prejudice"),  # behind, in front
    "shelf": ["pride-and-prejudice", "frankenstein", "the-great-gatsby", "dracula", "jane-eyre",
              "the-adventures-of-sherlock-holmes", "the-picture-of-dorian-gray", "meditations",
              "alices-adventures-in-wonderland", "the-count-of-monte-cristo"],
    "open_book": "alices-adventures-in-wonderland",
    "gift": "little-women",
    "starts": [("pride-and-prejudice", "If you love a love story"),
               ("the-hound-of-the-baskervilles", "If you love a good mystery"),
               ("frankenstein", "If you like a little fear"),
               ("the-count-of-monte-cristo", "If you want an adventure")],
    "spotlight": "the-great-gatsby",
    "spotlight_quotes": ("“So we beat on, boats against the current, borne back ceaselessly into the past.”",
                         "“I hope she’ll be a fool, that’s the best thing a girl can be in this world.”"),
}


def cover(slug, sizes, lazy=True, cls="", priority=False, alt=None):
    b = BOOK[slug]
    srcset = ", ".join(f"image/covers/{slug}-{w}.webp {w}w" for w in (180, 360, 720, 1080))
    attrs = [f'src="image/covers/{slug}-360.webp"', f'srcset="{srcset}"', f'sizes="{sizes}"',
             f'width="{W}" height="{H}"',
             f'alt="{e(alt if alt is not None else b["title"] + " by " + b["author"] + ", book cover")}"']
    if cls:
        attrs.append(f'class="{cls}"')
    if lazy:
        attrs.append('loading="lazy" decoding="async"')
    if priority:
        attrs.append('fetchpriority="high"')
    return f"<img {' '.join(attrs)}>"


def plain(s):
    # Lower case without accents, so a search for "bronte" finds Brontë (app.js does the same to what you type)
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("'", "").replace("’", "")).strip("-")


def icon(name, cls="icon"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"></use></svg>'


def button_alt(href, text, colour="magenta", extra="", size=""):
    cls = f"button-alt is--{colour}" + (f" is--{size}" if size else "")
    return (f'<a class="{cls}" href="{href}" data-button-alt {extra}>'
            f'<span class="button-alt__text-wrap"><span class="button-alt__bg"></span>'
            f'<span class="button-alt__text" data-button-alt-text>{e(text)}</span></span>'
            f'<span class="button-alt__icon-wrap" aria-hidden="true"><span class="button-alt__bg"></span>'
            f'{icon("arrow", "button-alt__icon")}</span></a>')


def submit_alt(text, colour="magenta"):
    return (f'<button type="submit" class="button-alt is--{colour}" data-button-alt>'
            f'<span class="button-alt__text-wrap"><span class="button-alt__bg"></span>'
            f'<span class="button-alt__text" data-button-alt-text>{e(text)}</span></span>'
            f'<span class="button-alt__icon-wrap" aria-hidden="true"><span class="button-alt__bg"></span>'
            f'{icon("arrow", "button-alt__icon")}</span></button>')


def reading_time(b):
    # "7 hours 24 minutes" reads as "7 h 24 min" on a card
    short = b["reading_time"].replace(" hours", " h").replace(" hour", " h").replace(" minutes", " min").replace(" minute", " min")
    return f'<p class="book-card__time">{icon("clock")}<span><span class="sr-only">Reading time: </span>{e(short)}</span></p>'


def tags(genres, card=None):
    # A tag the same colour as its card would vanish into it, so that one turns white
    def colour(g):
        c = TAG_COLOURS.get(g, "white")
        return "white" if c == card else c
    return ('<ul class="tags" aria-label="Genres">' +
            "".join(f'<li class="tag" style="--tag:var(--{colour(g)})">{e(g)}</li>' for g in genres)
            + "</ul>")


def book3d(slug, cls="", sizes="(max-width: 991px) 40vw, 24em", lazy=True, priority=False):
    return (f'<div class="book3d {cls}" style="--spine:{BOOK[slug]["spine"]}">'
            f'<div class="book3d__front">{cover(slug, sizes, lazy=lazy, priority=priority, alt="")}</div>'
            '<div class="book3d__back"></div><div class="book3d__spine"></div>'
            '<div class="book3d__pages"></div><div class="book3d__top"></div><div class="book3d__bottom"></div></div>')


def bg_svg(paths, cls, view="0 0 1440 1000", small=False):
    body = "".join(f'<path class="{c}" d="{d}"/>' for c, d in paths)
    flag = " data-background-animation-small" if small else ""
    return (f'<svg class="{cls}" viewBox="{view}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" '
            f'data-background-animation{flag}>{body}</svg>')


ICON_DIR = Path(__file__).resolve().parent / "icons"
# name used in the pages -> Lucide file
ICONS = {"arrow": "arrow-right", "left": "arrow-left", "up": "arrow-up", "plus": "plus", "menu": "menu", "close": "x",
         "search": "search", "book": "book-open", "sparkles": "sparkles", "gift": "gift",
         "bookmark": "bookmark", "heart": "heart", "mail": "mail", "star": "star", "layers": "layers", "globe": "globe",
         "package": "package", "clock": "clock", "download": "download", "contents": "list-ordered", "type": "type",
         "sun": "sun", "moon": "moon", "prev": "chevron-left", "next": "chevron-right", "read": "book-marked"}


def lucide_symbol(name, file):
    svg = (ICON_DIR / f"{file}.svg").read_text(encoding="utf-8")
    inner = re.sub(r"\s+", " ", svg[svg.index(">", svg.index("<svg")) + 1:svg.rindex("</svg>")]).strip()
    return (f'  <symbol id="i-{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round">{inner}</symbol>')


SPRITE = ("""<svg xmlns="http://www.w3.org/2000/svg" hidden>
  <symbol id="i-logo" viewBox="0 0 48 48"><path fill="currentColor" d="M24 9.5c-4.2-3.3-10.3-4.4-17-3.5a2 2 0 0 0-1.7 2v27.6a2 2 0 0 0 2.3 2c6.2-.8 11.3.2 15.2 3.1a2 2 0 0 0 2.4 0c3.9-2.9 9-3.9 15.2-3.1a2 2 0 0 0 2.3-2V8a2 2 0 0 0-1.7-2c-6.7-.9-12.8.2-17 3.5Zm-2.2 4.2v20.9c-3.6-1.8-7.9-2.6-12.5-2.4V10c4.9-.4 9.3.8 12.5 3.7Zm4.4 0c3.2-2.9 7.6-4.1 12.5-3.7v22.2c-4.6-.2-8.9.6-12.5 2.4V13.7Z"/><path fill="currentColor" d="M33 4h5v12l-2.5-2-2.5 2z"/></symbol>
  <symbol id="i-github" viewBox="0 0 24 24"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.6 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z"/></symbol>
""" + "\n".join(lucide_symbol(k, v) for k, v in ICONS.items()) + "\n</svg>")

# One fat squiggle that, drawn in full, covers the screen. "slice" scales it evenly and crops it, so its round ends stay
# round on any screen shape instead of being squashed into points on a tall phone.
TRANSITION = f"""<div class="transition" data-transition-wrap aria-hidden="true">
  <svg class="transition__svg" viewBox="0 0 1080 1080" preserveAspectRatio="xMidYMid slice"><path d="{shapes.SNAKE}"/></svg>
  <div class="transition__logo" data-transition-logo><svg viewBox="0 0 48 48"><use href="#i-logo"></use></svg></div>
</div>"""


def nav_button(href, text, key):
    return (f'<li><a class="button" href="{href}" data-nav="{key}" data-button>'
            f'<span class="button__bg"></span><span class="button__text" data-button-text>{e(text)}</span></a></li>')


HEADER = f"""<a class="skip-link" href="#main">Skip to content</a>
<header class="header" data-header data-scrolling-started="false">
  <a class="header__logo" href="./" aria-label="The Bookshelf, home">
    <svg class="header__logo-icon" aria-hidden="true"><use href="#i-logo"></use></svg>
    <span class="header__logo-text">Bookshelf</span><span class="header__logo-sub" aria-hidden="true">The<br>library</span>
  </a>
  <nav class="header__nav" aria-label="Main">
    <ul class="header__nav-list">
      {nav_button("books.html", "All books", "books")}
      {nav_button("index.html#genres", "Genres", "genres")}
      {nav_button("index.html#faq", "FAQ", "faq")}
      <li>{button_alt("login.html", "Log in / Sign up", "orange", 'data-nav="account"', "small")}</li>
    </ul>
  </nav>
  <div class="header__side">
    <a class="header__social" href="https://github.com/Cl0ud-9/Book-Website" aria-label="Source code on GitHub">{icon("github")}</a>
  </div>
  <button class="button-alt is--small menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="menu">
    <span class="button-alt__text-wrap"><span class="button-alt__bg"></span><span class="button-alt__text">Menu</span></span>
    <span class="button-alt__icon-wrap" aria-hidden="true"><span class="button-alt__bg"></span>{icon("menu", "button-alt__icon")}</span>
  </button>
</header>
<div class="menu" id="menu" data-menu aria-label="Menu" role="dialog" aria-modal="true" hidden>
  <div class="menu__inner">
    <button class="button-alt is--small menu-toggle is--close" type="button" data-menu-close><span class="button-alt__text-wrap"><span class="button-alt__bg"></span><span class="button-alt__text">Close</span></span><span class="button-alt__icon-wrap" aria-hidden="true"><span class="button-alt__bg"></span>{icon("close", "button-alt__icon")}</span></button>
    <ul class="menu__list">
      <li><a class="menu__link" href="./" data-nav="home">Home</a></li>
      <li><a class="menu__link" href="books.html" data-nav="books">All books</a></li>
      <li><a class="menu__link" href="index.html#genres">Genres</a></li>
      <li><a class="menu__link" href="index.html#faq">FAQ</a></li>
    </ul>
    <div class="menu__account">
      {button_alt("login.html", "Log in", "white")}
      {button_alt("signup.html", "Sign up", "black")}
    </div>
    <p class="menu__note accent-note">See you between the pages!</p>
  </div>
</div>"""


def footer():
    return f"""<footer class="footer" data-footer-parallax>
  <div class="footer__inner">
    <div class="footer__top" data-footer-parallax-top>
      <form class="footer__form" data-newsletter novalidate>
        <h2 class="footer__form-title">Letters from the shelf</h2>
        <p class="footer__text">One email a month: the classics we added, a few favourites, and nothing else.</p>
        <div class="footer__field">
          <label class="sr-only" for="newsletter-email">Email address</label>
          <span class="footer__input">{icon("mail")}<input class="field__input is--light" type="email" id="newsletter-email" name="email" placeholder="you@example.com" autocomplete="email" required></span>
          {submit_alt("Subscribe", "yellow")}
        </div>
        <p class="footer__message" role="status" aria-live="polite" data-newsletter-message></p>
      </form>
      <nav class="footer__nav" aria-label="Footer">
        <div class="footer__col">
          <h2 class="footer__heading">Library</h2>
          <ul><li><a href="books.html">All books</a></li><li><a href="index.html#genres">Genres</a></li><li><a href="index.html#new">Where to start</a></li></ul>
        </div>
        <div class="footer__col">
          <h2 class="footer__heading">Account</h2>
          <ul><li><a href="login.html">Log in</a></li><li><a href="signup.html">Sign up</a></li><li><a href="index.html#faq">Questions</a></li></ul>
        </div>
        <div class="footer__col">
          <h2 class="footer__heading">Elsewhere</h2>
          <ul><li><a href="https://github.com/Cl0ud-9/Book-Website">Source on GitHub</a></li><li><a href="https://github.com/Cl0ud-9">More from Cloud/9</a></li></ul>
        </div>
      </nav>
    </div>
    <p class="footer__wordmark" aria-hidden="true">Bookshelf</p>
    <div class="footer__bottom" data-footer-parallax-bottom>
      <p>© 2023–2026 The Bookshelf</p>
      <p>Designed and built by <a href="https://github.com/Cl0ud-9">Cloud/9</a></p>
      <a class="footer__top-link" href="#main" data-back-to-top>Back to top {icon("up")}</a>
    </div>
  </div>
</footer>"""


# Served with the site: no requests to other servers. Licences are listed in NOTICE and js/vendor/LICENSES.md.
SCRIPTS = [f"js/vendor/{name}.js" for name in (
    "gsap.min", "ScrollTrigger.min", "SplitText.min", "CustomEase.min", "InertiaPlugin.min", "DrawSVGPlugin.min",
    "lenis.min", "barba.umd.min", "barba-prefetch.umd.min", "smooothy.min")]

# Hides what the intro animates in, and gives up after 4 s if the scripts never arrive
BOOT = ("<script>(function(d){var r=d.documentElement;r.classList.add('js');"
        "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)r.classList.add('is-loading');"
        "setTimeout(function(){if(!window.bookshelfReady)r.classList.remove('is-loading')},4000)})(document)</script>")


SITE = "https://cl0ud-9.github.io/Book-Website/"
# The site's own CSS and scripts are linked with ?v=<a hash of them>, so a browser never keeps last week's copy after a
# deploy (GitHub Pages lets them cache files for ten minutes). app.js passes the same version on to the reader's files.
ASSETS = ["css/main.css", "css/reader-content.css", "js/app.js", "js/forms.js", "js/reader.js"]
VERSION = hashlib.sha1(b"".join((ROOT / a).read_bytes() for a in ASSETS)).hexdigest()[:8]


def page(name, path, title, description, body, theme="yellow", book=None, with_footer=True):
    scripts = "\n".join(f'<script src="{s}" defer></script>' for s in SCRIPTS)
    # Link previews: a 1200 x 630 JPEG (made by tools/social.py), the size and format every app shows
    social = f"image/social/{book}.jpg" if book else "image/social/home.jpg"
    alt = f"The cover of {BOOK[book]['title']} on its page at the Bookshelf" if book else "The Bookshelf home page"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<meta name="theme-color" content="#ffd24a">
<link rel="canonical" href="{SITE}{path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Bookshelf">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{SITE}{social}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{e(alt)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="image/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="image/apple-touch-icon.png">
<link rel="preload" href="fonts/rubik.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/figtree.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/main.css?v={VERSION}">
{BOOT}
{scripts}
<script src="js/forms.js?v={VERSION}" defer></script>
<script src="js/app.js?v={VERSION}" defer></script>
</head>
<body data-barba="wrapper">
{SPRITE}
{TRANSITION}
{HEADER}
<main id="main" class="page" data-barba="container" data-barba-namespace="{name}" data-page-theme="{theme}">
{body}
{footer() if with_footer else ""}
</main>
<div class="confetti" data-confetti-container aria-hidden="true"></div>
</body>
</html>
"""


def book_url(s):
    return f"book-{s}.html"


def ink(colour):
    return "#fff" if colour in DARK else "#000"


def library_data():
    # What the reader and "Continue reading" need to know about each book, read by app.js
    data = {b["slug"]: {"title": b["title"], "author": b["author"], "epub": b["epub"]} for b in LIBRARY}
    return f'<script type="application/json" data-library>{json.dumps(data, ensure_ascii=False, separators=(",", ":"))}</script>'


# The title is the card's link; its ::after stretches over the whole card, so the card is one big click target
def book_card(s, sizes, extra_cls="", lazy=True, heading="h3"):
    b = BOOK[s]
    search = plain(" ".join([b["title"], b["author"], *(b["genres"])]))
    return f"""<article class="book-card {extra_cls}" id="book-{s}" style="--card:var(--{b["colour"]});--ink:{ink(b["colour"])}" data-search="{e(search)}" data-genres="{e(" ".join(slug(g) for g in b["genres"]))}" data-books-slider-item>
  <div class="book-card__cover">{cover(s, sizes, lazy=lazy)}</div>
  {tags(b["genres"], b["colour"])}
  <{heading} class="book-card__title" style="--fit:{fit(b["title"])}"><a class="book-card__link" href="{book_url(s)}" draggable="false">{e(b["title"])}</a></{heading}>
  <p class="book-card__author">{e(b["author"])}</p>
  {reading_time(b)}
  <p class="book-card__hook">{e(b["abstract"])}</p>
  <span class="book-card__open" aria-hidden="true">Open the book {icon("arrow")}</span>
</article>"""


def fit(title):
    # About 0.58 em a letter in heavy Rubik: a title's longest unbreakable word, for .book-card__title
    parts = [p + ("-" if i < len(w.split("-")) - 1 else "") for w in title.split() for i, p in enumerate(w.split("-"))]
    return round(max(5.8, 0.58 * max(len(p) for p in parts) + 0.2), 2)


def icon_button(tag, attrs, text, colour, ic):
    return (f'<{tag} class="button-alt is--{colour}" data-button-alt {attrs}><span class="button-alt__text-wrap">'
            f'<span class="button-alt__bg"></span><span class="button-alt__text" data-button-alt-text>{e(text)}</span></span>'
            f'<span class="button-alt__icon-wrap" aria-hidden="true"><span class="button-alt__bg"></span>'
            f'{icon(ic, "button-alt__icon")}</span></{tag}>')


def book_page(s):
    b = BOOK[s]
    # Related: books sharing the most genres, then the rest of the shelf in order
    related = sorted((o for o in LIBRARY if o["slug"] != s), key=lambda o: -len(set(o["genres"]) & set(b["genres"])))
    more = "\n".join(book_card(o["slug"], "(max-width: 767px) 80vw, (max-width: 991px) 40vw, 20em") for o in related[:3])
    words = f"{b['words']:,} words"
    facts = [("clock", "Reading time", b["reading_time"]), ("layers", "Length", words),
             ("bookmark", "Genre", " and ".join(b["genres"])),
             ("globe", "Language", "English")]
    if b["translator"]:
        facts.append(("type", "Translated by", b["translator"]))
    dl = "".join(f"<div><dt>{icon(ic)}{a}</dt><dd>{e(v)}</dd></div>" for ic, a, v in facts)
    about = "\n    ".join(f"<p>{e(p)}</p>" for p in b["description"])
    return f"""<section class="book-hero" style="--card:var(--{b["colour"]});--ink:{ink(b["colour"])}" data-intro-page aria-labelledby="page-title">
  {bg_svg([("is--glow", shapes.BLOB_A), ("is--glow", shapes.BLOB_B)], "book-hero__shapes", "0 0 1440 1000", small=True)}
  <a class="book-hero__back" href="books.html">{icon("left")} All books</a>
  <div class="book-hero__grid">
    <div class="book-hero__visual" data-book-tilt aria-hidden="true">
      <div class="book-hero__float" data-book-tilt-target>{book3d(s, "is--large", "(max-width: 991px) 60vw, 30em", lazy=False, priority=True)}</div>
      <span class="book-hero__shadow"></span>
    </div>
    <div class="book-hero__info">
      <div data-hero-paragraph>{tags(b["genres"])}</div>
      <h1 class="book-hero__title heading-l" id="page-title" data-hero-title>{e(b["title"])}</h1>
      <p class="book-hero__author" data-hero-paragraph>by {e(b["author"])}</p>
      <p class="book-hero__hook accent-note" data-hero-handwritten-text>{e(b["abstract"])}</p>
      <div class="book-hero__buy" data-hero-button>
        <p class="book-hero__price">Free <span class="book-hero__save">{e(b["reading_time"])}</span></p>
        <div class="book-hero__actions">
          {icon_button("a", f'href="read.html?book={s}" data-read-button="{s}"', "Read now", "black", "read")}
          {icon_button("a", f'href="{b["epub"]}" download', "Download EPUB", "white", "download")}
        </div>
        <p class="book-hero__formats">Also for <a href="{b["kindle"]}">Kindle</a> and <a href="{b["kobo"]}">Kobo</a></p>
      </div>
    </div>
  </div>
</section>
<section class="book-about" aria-labelledby="about-title">
  <div class="book-about__text">
    <h2 class="book-about__title heading-m" id="about-title">About the book</h2>
    {about}
  </div>
  <dl class="book-about__facts">{dl}</dl>
</section>
<section class="book-more" aria-labelledby="more-title">
  <h2 class="book-more__title heading-l" id="more-title">You might also like</h2>
  <div class="catalogue__grid is--three">
{more}
  </div>
</section>"""


# Four line drawings for "how it works"
ILLUSTRATIONS = {
    "browse": '<svg viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 104h124"/><rect x="26" y="40" width="16" height="64" rx="2"/><rect x="44" y="28" width="18" height="76" rx="2"/><path d="m66 46 15-4 16 60-15 4z"/><rect x="100" y="52" width="14" height="52" rx="2"/><path d="M31 52h6M49 40h8M49 92h8M105 64h4"/><circle cx="118" cy="40" r="17" fill="#fff"/><path d="m130 52 14 14"/><path d="M110 36a9 9 0 0 1 8-6"/></g></svg>',
    "pick": '<svg viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M28 56h104l-10 50H38z" fill="#fff"/><path d="M22 56h116M52 56l14-30M108 56 94 26"/><path d="M58 70v24M80 70v24M102 70v24"/><path d="M56 40l-6-16 22-6 4 14" fill="#fff"/><path d="M84 36l6-20 20 6-4 14" fill="#fff"/><path d="m120 18 4 8 8 2-8 3-3 8-3-8-8-2 8-3z"/></g></svg>',
    "parcel": '<svg viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M30 50 80 30l50 20v46l-50 20-50-20z" fill="#fff"/><path d="m30 50 50 20 50-20M80 70v46"/><path d="m55 40 50 20v14"/><path d="M60 26 46 10M100 26l14-16M80 22V4"/><path d="M40 84l14 6M40 92l10 4"/></g></svg>',
    "talk": '<svg viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 22h74a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H50l-16 14V72H20a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8z" fill="#fff"/><path d="M30 40h52M30 54h36"/><path d="M146 52h-34a6 6 0 0 0-6 6v28a6 6 0 0 0 6 6h18l14 12V92h2a6 6 0 0 0 6-6V58a6 6 0 0 0-6-6z" fill="#fff"/><path d="m122 72 6 6 10-12"/></g></svg>',
}
STEPS = [
    ("cyan", "browse", "Browse the shelf", "Over a hundred classics, from Austen and Asimov to Sherlock Holmes and Shakespeare."),
    ("pale-pink", "pick", "Pick your reads", "Every book is free. No sign-up, no ads, no catch."),
    ("yellow", "parcel", "Read anywhere", "Right here in your browser, or download it for your phone, Kindle or Kobo."),
    ("periwinkle", "talk", "Talk about it", "Share what you thought, and find your next favourite from other readers."),
]


def home():
    count = len(LIBRARY)
    # Smooothy moves each .slide; the card inside it is free to tilt
    shelf = "\n".join(f'<div class="slide">{book_card(s, "(max-width: 991px) 60vw, 18em")}</div>'
                      for s in FEATURED["shelf"])
    steps = "\n".join(f"""<li class="step" style="--card:var(--{c})" data-call-out-item>
  <div class="step__inner" data-call-out-child>
    <p class="step__number accent-note">Step #{n}</p>
    <div class="step__visual">{ILLUSTRATIONS[ill]}</div>
    <h3 class="step__title">{e(t)}</h3>
    <p class="step__text">{e(d)}</p>
  </div>
</li>""" for n, (c, ill, t, d) in enumerate(STEPS, 1))
    # each genre shows four covers around it, all from that genre
    def covers_for(g):
        return [b["slug"] for b in LIBRARY if g in b["genres"]][:4]
    holders = []
    for h in range(4):
        imgs = "".join(cover(covers_for(g)[h], "17em", alt="", cls="genre__img") for g in GENRES)
        holders.append(f'<div class="genre__holder"><div class="genre__box" data-genre-interaction-box>{imgs}</div></div>')
    genres = "\n".join(f"""<li class="genre__item" data-genre-interaction-item><a class="genre__link" href="books.html?genre={slug(g)}">
  <span class="genre__default">{e(g)}</span><span class="genre__hover" aria-hidden="true">{e(g)}</span></a></li>""" for g in GENRES)
    fav_cards = "\n".join(f"""<div class="slide"><article class="fav-card" style="--card:var(--{BOOK[s]["colour"]});--ink:{ink(BOOK[s]["colour"])}" data-books-slider-item>
  <div class="fav-card__cover">{cover(s, "(max-width: 991px) 60vw, 20em")}</div>
  <p class="fav-card__badge" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="{burst()}"/></svg><span>#{n}</span></p>
  <h3 class="fav-card__title"><a class="book-card__link" href="{book_url(s)}" draggable="false">{e(BOOK[s]["title"])}</a></h3>
  <p class="fav-card__label">{e(label)}</p>
</article></div>""" for n, (s, label) in enumerate(FEATURED["starts"], 1))
    q = [
        ("Are the books really free?",
         f"Yes, all {count} of them, to read here or to download and keep. They are out of copyright, so they belong "
         "to everyone."),
        ("Where do the books come from?",
         "They are public-domain editions from Standard Ebooks, carefully proofread and beautifully typeset, with "
         "the art on their covers taken from public-domain paintings."),
        ("Can I read on my Kindle, Kobo or phone?",
         "Yes. Every book page has an EPUB download for phones and most e-readers, and links to Kindle and Kobo "
         "editions. Or just press Read now and read in your browser."),
        ("Will it remember where I stopped?",
         "Yes, on this device: open the book again and it picks up on your page. Nothing is sent anywhere, so there "
         "is no account to make."),
        ("Why are there no new bestsellers?",
         "Recent books are still under copyright, so they cannot be shared for free. Your local library can lend "
         "you most of them, often as ebooks through an app like Libby."),
    ]
    faq = "\n".join(f"""<details class="accordion" data-accordion>
  <summary class="accordion__summary" data-accordion-summary><span class="accordion__title">{e(a)}</span>{icon("plus", "accordion__icon")}</summary>
  <div class="accordion__content" data-accordion-content><p>{e(b)}</p></div>
</details>""" for a, b in q)
    ribbon_text = f"Free, forever ✦ {count} classics ✦ Read here or download ✦ No sign-up, no ads ✦ "
    spot = BOOK[FEATURED["spotlight"]]
    quote_a, quote_b = FEATURED["spotlight_quotes"]
    back, front = FEATURED["hero"]
    return f"""<section class="hero" data-intro-home aria-labelledby="hero-title">
  <div class="hero__bg" data-hero-bg>{bg_svg([("is--pale-yellow", shapes.HERO_BAND), ("is--pale-orange", shapes.HERO_RIDGE), ("is--orange", shapes.HERO_HILLS)], "hero__shapes", "0 0 1440 1000")}</div>
  <div class="hero__content">
    <h1 class="hero__title heading-xxl" id="hero-title" data-hero-title>Stories you can’t put down</h1>
    <p class="hero__text" data-hero-paragraph>The Bookshelf is a free library of the classics: {count} books to read right here or download, from Austen to Asimov. No sign-up, no ads, no catch.</p>
    <div data-hero-button>{button_alt("books.html", "Browse the shelf")}</div>
  </div>
  <p class="hero__note accent-note" data-hero-handwritten-text>Free, forever!</p>
  <div class="hero__visual" data-hero-visual aria-hidden="true">
    <div class="hero__book is--back" data-float><div class="hero__float">{book3d(back, "", "(max-width: 991px) 38vw, 21em", lazy=False)}</div></div>
    <div class="hero__book is--main" data-float><div class="hero__float">{book3d(front, "", "(max-width: 991px) 45vw, 26em", lazy=False, priority=True)}</div></div>
  </div>
</section>

<section class="continue" aria-labelledby="continue-title" data-continue hidden>
  <h2 class="continue__title heading-m" id="continue-title">Continue reading</h2>
  <ul class="continue__list" data-continue-list></ul>
  <template><li class="continue__item"><a class="continue__link" href="read.html">
    <img src="" width="{W}" height="{H}" alt="" loading="lazy" decoding="async">
    <span class="continue__text"><span class="continue__book" data-continue-title></span><span class="continue__author" data-continue-author></span>
    <span class="continue__progress"><span data-continue-bar></span></span><span class="continue__percent" data-continue-percent></span></span>
  </a></li></template>
</section>

<section class="books" id="new" aria-labelledby="books-title" data-books-slider>
  <div class="books__head">
    <p class="books__note accent-note" data-handwritten-text-inview>The ones everyone talks about</p>
    <h2 class="books__title heading-l" id="books-title">Where to start</h2>
    <p class="books__text">Ten classics that earned the name. Drag the shelf, or use the arrows.</p>
  </div>
  <div class="slider-controls" data-books-slider-controls>
    <button class="slider-arrow" type="button" aria-label="Previous books">{icon("left")}</button>
    <button class="slider-arrow" type="button" aria-label="Next books">{icon("arrow")}</button>
  </div>
  <div class="books__slider" data-books-slider-viewport tabindex="0" role="region" aria-label="Where to start. Use the arrow keys to browse.">
    <div class="books__list" data-books-slider-wrapper>
{shelf}
    </div>
  </div>
</section>

<section class="flow" aria-labelledby="flow-title">
  <div class="flow__head">
    <h2 class="flow__title heading-l" id="flow-title">How it works</h2>
    <p class="flow__note accent-note" data-handwritten-text-inview>Easier than choosing what to read next</p>
    <div class="flow__cta" data-plop-in><span class="flow__emblem" data-plop-in-item>{icon("logo")}</span>{button_alt("signup.html", "Create an account", size="small")}</div>
  </div>
  <ol class="flow__cards" data-call-out>
{steps}
  </ol>
</section>

<section class="open-book" aria-labelledby="open-title" data-book-open>
  <div class="open-book__stage">
    <div class="open-book__scene" aria-hidden="true">
      <div class="open-book__book" data-book-open-book>
        <div class="open-book__back"></div>
        <div class="open-book__block"></div>
        <div class="open-book__leaf" data-book-open-leaf><div class="open-book__leaf-front"></div><div class="open-book__leaf-back"></div></div>
        <div class="open-book__leaf" data-book-open-leaf><div class="open-book__leaf-front"></div><div class="open-book__leaf-back"></div></div>
        <div class="open-book__leaf" data-book-open-leaf><div class="open-book__leaf-front"></div><div class="open-book__leaf-back"></div></div>
        <div class="open-book__cover" data-book-open-cover>
          <div class="open-book__cover-front">{cover(FEATURED["open_book"], "(max-width: 991px) 70vw, 30em", alt="")}</div>
          <div class="open-book__cover-back"><span>Ex libris</span>{icon("logo")}</div>
        </div>
      </div>
    </div>
    <p class="open-book__note accent-note" data-book-open-note>The reader keeps your place, so you never lose your page</p>
    <div class="open-book__final">
      <h2 class="open-book__title" id="open-title" data-book-open-title>Get lost in <span class="open-book__mark">a good book.</span></h2>
      <div class="open-book__buttons">
        <span data-book-open-button>{button_alt("signup.html", "Sign up", "black")}</span>
        <span data-book-open-button>{button_alt("login.html", "Log in", "orange")}</span>
      </div>
      <p class="open-book__aside accent-note" data-book-open-aside>Made by readers, for readers</p>
    </div>
  </div>
</section>

<section class="genre" id="genres" aria-labelledby="genre-title" data-genre-interaction>
  <p class="genre__eyebrow" id="genre-title">Choose from</p>
  <p class="genre__note accent-note" data-handwritten-text-inview>A classic for every kind of reader</p>
  <div class="genre__wrap">
    <ul class="genre__list" data-genre-interaction-list>
{genres}
    </ul>
    <div class="genre__holding" aria-hidden="true" data-genre-interaction-scope>{''.join(holders)}</div>
  </div>
  <p class="genre__more">and more!</p>
  <span class="genre__emblem">{icon("logo")}</span>
</section>

<section class="why" aria-labelledby="why-title" data-benefits>
  {bg_svg([("is--yellow", shapes.WHY_A), ("is--yellow", shapes.WHY_B), ("is--yellow", shapes.WHY_C)], "why__shapes", "0 0 1440 1000", small=True)}
  <div class="why__badge" data-badge-spin>
    <svg class="why__ring" viewBox="0 0 300 300" aria-hidden="true"><defs><path id="why-circle" d="M150 150m-112 0a112 112 0 1 1 224 0a112 112 0 1 1-224 0"/></defs>
      <circle cx="150" cy="150" r="84" fill="none" stroke="currentColor" stroke-width="14"/>
      <text><textPath href="#why-circle" startOffset="0">Why the Bookshelf? ✦ Why the Bookshelf? ✦</textPath></text></svg>
    {icon("logo", "why__logo")}
  </div>
  <h2 class="sr-only" id="why-title">Why the Bookshelf?</h2>
  <ul class="why__stickers">
    <li class="sticker is--magenta" data-benefits-item style="--r:-6deg">{icon("sparkles", "sticker__icon")}Free, forever</li>
    <li class="sticker is--orange" data-benefits-item style="--r:-3deg">{icon("bookmark", "sticker__icon")}Keeps your place</li>
    <li class="sticker is--periwinkle" data-benefits-item style="--r:4deg">{icon("heart", "sticker__icon")}Beautiful editions</li>
    <li class="sticker is--cyan" data-benefits-item style="--r:7deg">{icon("star", "sticker__icon")}Read anywhere</li>
    <li class="sticker is--olive" data-benefits-item style="--r:-4deg">{icon("layers", "sticker__icon")}Every genre you love</li>
  </ul>
</section>

<section class="faq" id="faq" aria-labelledby="faq-title">
  {bg_svg([("is--soft-blue", shapes.BLOB_A), ("is--soft-blue", shapes.BLOB_B), ("is--soft-blue", shapes.BLOB_C)], "faq__shapes", "0 0 1440 1000", small=True)}
  <h2 class="faq__title heading-l" id="faq-title">Common questions</h2>
  <div class="faq__list">
{faq}
  </div>
  <div class="faq__cta">{button_alt("books.html", "Browse all books", size="small")}<span class="faq__emblem">{icon("logo")}</span></div>
</section>

<section class="gift" aria-labelledby="gift-title">
  <div class="tagline" data-tagline-curve aria-hidden="true">
    <svg class="tagline__svg" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMid meet"><path id="tagline-path" d="{shapes.TAGLINE}" fill="none"/>
      <text class="tagline__text" text-anchor="middle"><textPath href="#tagline-path" startOffset="50%" data-tagline-text>A gift that always fits</textPath></text></svg>
  </div>
  <div class="gift__grid">
    <div class="gift__content">
      <h2 class="gift__title heading-m" id="gift-title">A gift that always fits</h2>
      <p class="gift__text">Know someone who would love a classic? Every book here has its own page, free to share. Send them the link and they can start reading in seconds, on any phone or laptop.</p>
      {button_alt("books.html", "Find one to share", size="small")}
      <p class="gift__note accent-note" data-handwritten-text-inview>Wrapped with a ribbon. Naturally.</p>
    </div>
    <div class="gift__visual" data-gift aria-hidden="true"><div class="gift__item" data-gift-item>{book3d(FEATURED["gift"], "is--gift", "(max-width: 991px) 50vw, 22em")}<span class="gift__ribbon"></span><span class="gift__bow"></span></div></div>
  </div>
</section>

<div class="ribbons" aria-label="{e(ribbon_text.replace(' ✦ ', '. ').strip())}" role="note">
  <div class="ribbon is--magenta" data-marquee="1"><div class="ribbon__track"><span>{e(ribbon_text * 3)}</span><span aria-hidden="true">{e(ribbon_text * 3)}</span></div></div>
  <div class="ribbon is--cyan" data-marquee="-1"><div class="ribbon__track"><span aria-hidden="true">{e(ribbon_text * 3)}</span><span aria-hidden="true">{e(ribbon_text * 3)}</span></div></div>
</div>

<section class="favs" aria-labelledby="favs-title" data-books-slider data-confetti-rain>
  <div class="favs__head">
    <span class="favs__badge" data-plop-in aria-hidden="true"><svg data-plop-in-item viewBox="0 0 200 200"><defs><path id="favs-ring" d="M100 100m-70 0a70 70 0 1 1 140 0a70 70 0 1 1-140 0"/></defs><circle cx="100" cy="100" r="96" fill="var(--magenta)"/><text><textPath href="#favs-ring">Start here ✦ Start here ✦ Start here ✦ </textPath></text><path d="{sparkle_path()}" fill="var(--yellow)" transform="translate(100 100) scale(2.4)"/></svg></span>
    <h2 class="favs__title heading-l" id="favs-title">Not sure where to begin?</h2>
    <p class="favs__text">Four doors into the classics. Pick the one that sounds like you.</p>
  </div>
  <div class="favs__slider" data-books-slider-viewport tabindex="0" role="region" aria-label="Where to begin. Use the arrow keys to browse.">
    <div class="favs__list" data-books-slider-wrapper>
{fav_cards}
    </div>
  </div>
  <div class="slider-controls is--center" data-books-slider-controls>
    <button class="slider-arrow" type="button" aria-label="Previous books">{icon("left")}</button>
    <button class="slider-arrow" type="button" aria-label="Next books">{icon("arrow")}</button>
  </div>
</section>

<section class="spotlight" aria-labelledby="spot-title" data-momentum-hover>
  <h2 class="spotlight__title heading-l" id="spot-title">Book of the month</h2>
  <p class="spotlight__text">Our pick for this month. Read it slowly, then read it again.</p>
  <div class="spotlight__frame">
    <p class="spotlight__quote is--left accent-note" data-handwritten-text-inview>{e(quote_a)}</p>
    <span class="spotlight__sticker is--moon" data-momentum-hover-element aria-hidden="true"><span data-momentum-hover-target><svg viewBox="0 0 100 100"><mask id="spot-moon"><rect width="100" height="100" fill="#fff"/><circle cx="64" cy="38" r="34" fill="#000"/></mask><circle cx="50" cy="50" r="42" fill="var(--yellow)" mask="url(#spot-moon)"/></svg></span></span>
    <span class="spotlight__sticker is--star" data-momentum-hover-element aria-hidden="true"><span data-momentum-hover-target><svg viewBox="-12 -12 24 24"><path d="{sparkle_path()}" fill="var(--magenta)"/></svg></span></span>
    <span class="spotlight__sticker is--seal" data-momentum-hover-element aria-hidden="true"><span data-momentum-hover-target><svg viewBox="0 0 100 100"><path d="{burst(18, 50, 44)}" fill="var(--violet)"/><text x="50" y="47" text-anchor="middle">Staff</text><text x="50" y="66" text-anchor="middle">pick</text></svg></span></span>
    <article class="spotlight__card">
      <div class="spotlight__cover">{cover(spot["slug"], "(max-width: 991px) 60vw, 20em")}</div>
      {tags([*spot["genres"][:1], "Book of the month"])}
      <h3 class="spotlight__book">{e(spot["title"])}</h3>
      <p class="spotlight__book-text">{e(spot["abstract"])} By {e(spot["author"])}.</p>
      {button_alt(book_url(spot["slug"]), "Open the book", size="small")}
    </article>
    <aside class="spotlight__facts" aria-label="Inside the book">
      <h4>Inside</h4>
      <p>{e(spot["reading_time"])} of reading, {spot["words"]:,} words.</p>
    </aside>
    <p class="spotlight__quote is--right accent-note" data-handwritten-text-inview>{e(quote_b)}</p>
  </div>
</section>
{library_data()}"""


def sparkle_path():
    return "M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z"


def burst(points=14, r1=50, r2=40):
    import math
    pts = []
    for k in range(points * 2):
        r = r1 if k % 2 == 0 else r2
        a = math.pi * k / points - math.pi / 2
        pts.append(f"{50 + r * math.cos(a):.1f} {50 + r * math.sin(a):.1f}")
    return "M" + "L".join(pts) + "Z"


def books_page():
    cards = "\n".join(book_card(b["slug"], "(max-width: 767px) 80vw, (max-width: 991px) 40vw, 20em") for b in LIBRARY)
    chips = "".join(f'<li><button type="button" class="chip" aria-pressed="false" data-genre="{slug(g)}">{e(g)}</button></li>'
                    for g in GENRES)
    return f"""<section class="hero-xs is--pale-blue" data-intro-page aria-labelledby="page-title">
  {bg_svg([("is--soft-blue", shapes.BLOB_A), ("is--soft-blue", shapes.BLOB_B)], "hero-xs__shapes", "0 0 1440 1000", small=True)}
  <h1 class="hero-xs__title heading-l" id="page-title" data-hero-title>All books</h1>
  <p class="hero-xs__text" data-hero-paragraph>All {len(LIBRARY)} classics in one place, every one of them free. Search by title, author or genre.</p>
  <p class="hero-xs__note accent-note" data-hero-handwritten-text>Go on, pick three</p>
</section>
<section class="catalogue" aria-label="Find a book" data-search-root>
  <form class="search" role="search" data-search-form>
    <label class="sr-only" for="search-box">Search books by title, author or genre</label>
    {icon("search", "search__icon")}
    <input class="search__input" type="search" id="search-box" placeholder="Search titles, authors or genres" autocomplete="off" data-search-input>
  </form>
  <ul class="chips" aria-label="Filter by genre">{chips}</ul>
  <h2 class="sr-only">Books</h2>
  <p class="catalogue__status" role="status" aria-live="polite" data-search-status>Showing all {len(LIBRARY)} books.</p>
  <div class="catalogue__grid" data-search-grid>
{cards}
  </div>
  <p class="catalogue__empty" data-search-empty hidden>No books match. Try another word, or clear the filters.</p>
</section>"""


def field(fid, label, ftype, autocomplete, hint="", extra=""):
    hint_html = f' <span class="field__hint">{e(hint)}</span>' if hint else ""
    return f"""<div class="field">
  <label class="field__label" for="{fid}">{e(label)}{hint_html}</label>
  <input class="field__input" type="{ftype}" id="{fid}" name="{fid}" autocomplete="{autocomplete}" aria-describedby="{fid}-error" {extra}>
  <p class="field__error" id="{fid}-error" aria-live="polite"></p>
</div>"""


def form_page(kind):
    if kind == "login":
        fields = field("username", "Username", "text", "username") + field("password", "Password", "password", "current-password")
        title, text, note, cta = "Welcome back", "Log in to pick up where you left off.", "We saved your spot", "Log in"
        switch = 'New here? <a href="signup.html">Create an account</a>'
        colour = "pale-pink"
    else:
        fields = (field("username", "Username", "text", "username")
                  + field("password", "Password", "password", "new-password", "(at least 6 characters)")
                  + field("confirm", "Confirm password", "password", "new-password")
                  + field("contact", "Contact number", "tel", "tel-national", "(10 digits)", 'inputmode="numeric" maxlength="10"'))
        title, text, note, cta = "Join the Bookshelf", "One account for your shelf, your wish list and your gift cards.", "It takes a minute", "Sign up"
        switch = 'Already have an account? <a href="login.html">Log in</a>'
        colour = "pale-periwinkle"
    return f"""<section class="hero-xs is--{colour} is--form" data-intro-page aria-labelledby="page-title">
  <h1 class="hero-xs__title heading-l" id="page-title" data-hero-title>{title}</h1>
  <p class="hero-xs__text" data-hero-paragraph>{e(text)}</p>
  <p class="hero-xs__note accent-note" data-hero-handwritten-text>{e(note)}</p>
  <form class="form-card" data-validate="{kind}" novalidate data-hero-content>
    {fields}
    {submit_alt(cta)}
    <p class="form-card__message" id="form-message" role="status" aria-live="polite"></p>
    <p class="form-card__switch">{switch}</p>
    <p class="form-card__small">This is a demo: nothing you type is sent or stored.</p>
  </form>
</section>"""


def reader_page():
    themes = "".join(f'<button type="button" class="reader__choice is--{t}" data-reader-theme="{t}" aria-pressed="false">{label}</button>'
                     for t, label in (("paper", "Paper"), ("sepia", "Sepia"), ("night", "Night")))
    fonts = "".join(f'<button type="button" class="reader__choice" data-reader-font="{f}" aria-pressed="false">{label}</button>'
                    for f, label in (("book", "Book"), ("serif", "Serif"), ("sans", "Sans")))
    return f"""<section class="reader" data-reader data-lenis-prevent aria-label="Reader">
  <div class="reader__bar">
    <a class="reader__back" href="books.html" data-reader-back>{icon("left")}<span>Back</span></a>
    <div class="reader__titles"><h1 class="reader__title" data-reader-title>Opening the book…</h1><p class="reader__author" data-reader-author></p></div>
    <div class="reader__tools">
      <button class="reader__tool" type="button" data-reader-toggle aria-expanded="false" aria-controls="reader-contents">{icon("contents")}<span class="reader__tool-label">Contents</span></button>
      <button class="reader__tool" type="button" data-reader-toggle aria-expanded="false" aria-controls="reader-settings">{icon("type")}<span class="reader__tool-label">Text</span></button>
      <a class="reader__tool" href="books.html" data-reader-download download>{icon("download")}<span class="reader__tool-label">Download</span></a>
    </div>
  </div>
  <div class="reader__stage">
    <button class="reader__turn is--prev" type="button" data-reader-prev aria-label="Previous page">{icon("prev")}</button>
    <div class="reader__view" data-reader-view></div>
    <button class="reader__turn is--next" type="button" data-reader-next aria-label="Next page">{icon("next")}</button>
    <p class="reader__message" role="status" data-reader-message>Opening the book…</p>
    <noscript><p class="reader__message">The reader needs JavaScript. Every book can also be downloaded from its page in <a href="books.html">All books</a>.</p></noscript>
  </div>
  <div class="reader__foot"><span class="reader__chapter" data-reader-chapter></span><span class="reader__progress"><span data-reader-bar></span></span><span class="reader__percent" data-reader-percent></span></div>
  <nav class="reader__panel" id="reader-contents" aria-label="Contents" data-reader-panel hidden><h2 class="reader__panel-title">Contents</h2><ol class="reader__toc" data-reader-toc-list></ol></nav>
  <div class="reader__panel is--settings" id="reader-settings" role="group" aria-label="Text settings" data-reader-panel hidden>
    <h2 class="reader__panel-title">Text</h2>
    <p class="reader__setting"><span>Size</span><button type="button" class="reader__choice" data-reader-size="-1" aria-label="Smaller text">A−</button><span class="reader__size" data-reader-size-value>100%</span><button type="button" class="reader__choice" data-reader-size="1" aria-label="Bigger text">A+</button></p>
    <p class="reader__setting"><span>Page</span>{themes}</p>
    <p class="reader__setting"><span>Font</span>{fonts}</p>
  </div>
</section>
{library_data()}"""


NOT_FOUND = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | The Bookshelf</title>
<meta name="description" content="This page of The Bookshelf does not exist.">
<meta name="robots" content="noindex">
<link rel="icon" href="/Book-Website/image/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/Book-Website/css/main.css">
</head>
<body class="not-found">
<main class="hero-xs is--yellow is--404">
  <p class="not-found__code" aria-hidden="true">404</p>
  <h1 class="hero-xs__title heading-l">This page wandered off</h1>
  <p class="hero-xs__text">There is no book on this shelf. It may have been borrowed, or the address is wrong.</p>
  <a class="button-alt is--magenta" href="/Book-Website/"><span class="button-alt__text-wrap"><span class="button-alt__bg"></span><span class="button-alt__text">Back to the shelf</span></span><span class="button-alt__icon-wrap" aria-hidden="true"><span class="button-alt__bg"></span><svg class="button-alt__icon" viewBox="0 0 24 24"><path d="M4 12h15m-6-6.5L19.5 12 13 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></a>
</main>
</body>
</html>
"""


def write(name, text, quiet=False):
    (OUT / name).write_text(text, encoding="utf-8", newline="\n")
    if not quiet:
        print(f"{name}: {len(text):,} bytes")


write("index.html", page("home", "", "The Bookshelf: free classics to read and download",
                         f"A free library of {len(LIBRARY)} classics, from Austen to Asimov, to read in your browser or "
                         "download for your phone, Kindle or Kobo.", home()))
write("books.html", page("books", "books.html", "All books | The Bookshelf",
                         f"All {len(LIBRARY)} free classics on the Bookshelf, searchable by title, author and genre.",
                         books_page(), "pale-blue"))
write("read.html", page("reader", "read.html", "Reading | The Bookshelf", "Read a free classic in your browser.",
                        reader_page(), "pale-yellow", with_footer=False))
write("login.html", page("login", "login.html", "Log in | The Bookshelf", "Log in to the Bookshelf.", form_page("login"),
                         "pale-pink"))
write("signup.html", page("signup", "signup.html", "Sign up | The Bookshelf", "Create a Bookshelf account.",
                          form_page("signup"), "pale-periwinkle"))
write("404.html", NOT_FOUND)
for b in LIBRARY:
    write(book_url(b["slug"]), page("book", book_url(b["slug"]), f"{b['title']} by {b['author']}, free | The Bookshelf",
                                    b["abstract"], book_page(b["slug"]), b["colour"], b["slug"]), quiet=True)
print(f"book-*.html: {len(LIBRARY)} pages")
# Pages of books no longer on the shelf
for old in OUT.glob("book-*.html"):
    if old.name not in {book_url(b["slug"]) for b in LIBRARY}:
        old.unlink()
        print(f"removed {old.name}")

# For search engines: every page except the demo log-in forms and the reader. (A robots.txt only counts at the root
# of cl0ud-9.github.io, not in this folder, so the sitemap is handed to search engines directly.)
urls = ["", "books.html", *(book_url(b["slug"]) for b in LIBRARY)]
write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + "".join(f"  <url><loc>{SITE}{u}</loc></url>\n" for u in urls) + "</urlset>\n")

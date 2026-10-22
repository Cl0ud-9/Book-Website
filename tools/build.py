"""Write The Bookshelf's pages (index, books, login, signup, 404) from one list of books and shared parts.

usage: python tools/build.py [OUTPUT_DIR]      (default: the repository root)
Edit BOOKS below to change the shelf, then run this and commit the regenerated pages.
"""
import html
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import shapes  # noqa: E402

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
e = html.escape

# title, author, price, was, genres, card colour, one-line hook, description, spine colour
BOOKS = [
    ("The Lighthouse Letters", "Mira Kapoor", 249, 499, ["Romance", "Historical"], "yellow",
     "Forty years of letters, one lighthouse, and the reply that never came.",
     "When Asha inherits her grandmother's lighthouse she finds a trunk of unsent letters to a sailor who may still be "
     "alive. A sweeping, tender story about the things we mean to say.", "#3b308f"),
    ("Paper Moons", "Aanya Rao", 249, 499, ["Romance", "Contemporary"], "pale-green",
     "Two strangers, one rooftop, and a string of paper moons.",
     "Every night at 11, someone hangs a new paper moon outside Meera's window. A warm, funny love story told in "
     "notes, rooftops and very bad timing.", "#ff008c"),
    ("Small Rituals", "Leo Fernandes", 299, 649, ["Self-help", "Non-fiction"], "pale-orange",
     "Keep your days, one page at a time.",
     "A gentle guide to journaling and the small daily habits that make a life feel like your own, with prompts for "
     "every season.", "#9982de"),
    ("The Hollow Wood", "Ines Marlow", 169, 299, ["Mystery", "Fantasy"], "olive",
     "Every path in this wood leads somewhere it shouldn't.",
     "Three children go into the Hollow Wood. Two come back, and neither will say what they saw behind the glowing "
     "door. An atmospheric, unsettling fable.", "#2e3b22"),
    ("Last Seen Wednesday", "Dev Malhotra", 69, 199, ["Thriller"], "cyan",
     "Everyone saw her on Wednesday. No one remembers it.",
     "A missing student, a circled date and a town that has quietly agreed to forget. A tight, twisty thriller you "
     "will finish in one sitting.", "#000000"),
    ("Fog Over Kestrel Lane", "Clara Whitby", 117, 449, ["Mystery"], "periwinkle",
     "The fog hides more than the houses.",
     "On a street where the fog never lifts, one window stays lit every night. A cosy mystery with a sharp-eyed "
     "retired postwoman at its heart.", "#465a86"),
    ("Wild Green Hours", "Tara Bose", 269, 479, ["Nature", "Photography"], "pale-pink",
     "Slow down. Look closer.",
     "A year spent watching one small patch of forest, in photographs and short essays about patience, weather and "
     "the creatures that live at our feet.", "#0e5e3a"),
    ("Cities Above the Clouds", "Noor Haddad", 296, 599, ["Fantasy", "Adventure"], "pale-blue",
     "A city above the clouds, and a girl who fell from it.",
     "Zara has never seen the ground. When her balloon tears she lands in a world below the clouds that was never "
     "supposed to exist. A soaring adventure.", "#3b308f"),
    ("Where Mountains Sleep", "Kenji Arai", 699, 999, ["Nature", "Photography"], "violet",
     "Mountains, moons and the quiet in between.",
     "Photographs from twelve years of walking the high ranges at dusk, with notes on light, altitude and learning "
     "to wait.", "#9982de"),
    ("Night Swimming", "Ruth Okafor", 169, 299, ["Poetry"], "magenta",
     "Poems for 2 a.m. and the moon that keeps you up.",
     "Forty-two short poems about water, insomnia and the people we call at midnight. Quiet, funny and bright as "
     "moonlight on a lake.", "#141a3a"),
]
GENRES = ["Romance", "Mystery", "Fantasy", "Thriller", "Poetry", "Photography", "Self-help", "Historical",
          "Adventure", "Contemporary"]
TAG_COLOURS = {"Romance": "pale-pink", "Historical": "soft-orange", "Contemporary": "pale-green",
               "Self-help": "soft-periwinkle", "Non-fiction": "white", "Mystery": "pale-blue", "Fantasy": "pale-periwinkle",
               "Thriller": "black", "Nature": "pale-green", "Photography": "white", "Adventure": "orange",
               "Poetry": "pale-yellow", "Bookshelf pick": "magenta"}
W, H = 360, 574
DARK = {"olive", "violet"}  # card colours that need white text (both pass WCAG AA with it)


def cover(i, sizes, lazy=True, cls="", priority=False, alt=None):
    title, author = BOOKS[i - 1][:2]
    srcset = ", ".join(f"image/book-{i}-{w}.webp {w}w" for w in (180, 360, 720, 1080))
    attrs = [f'src="image/book-{i}-360.webp"', f'srcset="{srcset}"', f'sizes="{sizes}"',
             f'width="{W}" height="{H}"',
             f'alt="{e(alt if alt is not None else f"{title} by {author}, book cover")}"']
    if cls:
        attrs.append(f'class="{cls}"')
    if lazy:
        attrs.append('loading="lazy" decoding="async"')
    if priority:
        attrs.append('fetchpriority="high"')
    return f"<img {' '.join(attrs)}>"


def slug(s):
    return s.lower().replace(" ", "-")


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


def price(now, was):
    return f'<p class="book-card__price">₹{now} <s><span class="sr-only">was </span>₹{was}</s></p>'


def tags(genres):
    return ('<ul class="tags" aria-label="Genres">' +
            "".join(f'<li class="tag" style="--tag:var(--{TAG_COLOURS.get(g, "white")})">{e(g)}</li>' for g in genres)
            + "</ul>")


def book3d(i, cls="", sizes="(max-width: 991px) 40vw, 24em", lazy=True, priority=False):
    return (f'<div class="book3d {cls}" style="--spine:{BOOKS[i - 1][8]}">'
            f'<div class="book3d__front">{cover(i, sizes, lazy=lazy, priority=priority, alt="")}</div>'
            '<div class="book3d__back"></div><div class="book3d__spine"></div>'
            '<div class="book3d__pages"></div><div class="book3d__top"></div><div class="book3d__bottom"></div></div>')


def bg_svg(paths, cls, view="0 0 1440 1000", small=False):
    body = "".join(f'<path class="{c}" d="{d}"/>' for c, d in paths)
    flag = " data-background-animation-small" if small else ""
    return (f'<svg class="{cls}" viewBox="{view}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" '
            f'data-background-animation{flag}>{body}</svg>')


SPRITE = """<svg xmlns="http://www.w3.org/2000/svg" hidden>
  <symbol id="i-logo" viewBox="0 0 48 48"><path fill="currentColor" d="M24 9.5c-4.2-3.3-10.3-4.4-17-3.5a2 2 0 0 0-1.7 2v27.6a2 2 0 0 0 2.3 2c6.2-.8 11.3.2 15.2 3.1a2 2 0 0 0 2.4 0c3.9-2.9 9-3.9 15.2-3.1a2 2 0 0 0 2.3-2V8a2 2 0 0 0-1.7-2c-6.7-.9-12.8.2-17 3.5Zm-2.2 4.2v20.9c-3.6-1.8-7.9-2.6-12.5-2.4V10c4.9-.4 9.3.8 12.5 3.7Zm4.4 0c3.2-2.9 7.6-4.1 12.5-3.7v22.2c-4.6-.2-8.9.6-12.5 2.4V13.7Z"/><path fill="currentColor" d="M33 4h5v12l-2.5-2-2.5 2z"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15m-6-6.5L19.5 12 13 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-left" viewBox="0 0 24 24"><path d="M20 12H5m6-6.5L4.5 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="m16.5 16.5 4.5 4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="i-github" viewBox="0 0 24 24"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.6 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z"/></symbol>
</svg>"""

TRANSITION = f"""<div class="transition" data-transition-wrap aria-hidden="true">
  <svg class="transition__svg" viewBox="0 0 1080 1080" preserveAspectRatio="none"><path d="{shapes.SNAKE}"/></svg>
  <div class="transition__logo" data-transition-logo><svg viewBox="0 0 48 48"><use href="#i-logo"></use></svg></div>
</div>"""


def nav_button(href, text, key):
    return (f'<li><a class="button" href="{href}" data-nav="{key}" data-button>'
            f'<span class="button__bg"></span><span class="button__text" data-button-text>{e(text)}</span></a></li>')


HEADER = f"""<a class="skip-link" href="#main">Skip to content</a>
<header class="header" data-header data-scrolling-started="false">
  <a class="header__logo" href="./" aria-label="The Bookshelf, home">
    <svg class="header__logo-icon" aria-hidden="true"><use href="#i-logo"></use></svg>
    <span class="header__logo-text">Bookshelf</span><span class="header__logo-sub" aria-hidden="true">The<br>shop</span>
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
  <button class="menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="menu">
    <span class="menu-toggle__text">Menu</span>{icon("menu", "menu-toggle__icon")}
  </button>
</header>
<div class="menu" id="menu" data-menu aria-label="Menu" role="dialog" aria-modal="true" hidden>
  <div class="menu__inner">
    <button class="menu-toggle is--close" type="button" data-menu-close><span class="menu-toggle__text">Close</span>{icon("close", "menu-toggle__icon")}</button>
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
    <p class="menu__note handwritten">See you between the pages!</p>
  </div>
</div>"""


def footer():
    return f"""<footer class="footer" data-footer-parallax>
  <div class="footer__inner">
    <div class="footer__top" data-footer-parallax-top>
      <div class="footer__brand">
        <a class="footer__logo" href="./" aria-label="The Bookshelf, home">{icon("logo", "footer__logo-icon")}<span>Bookshelf</span></a>
        <p class="footer__text">A little bookshop with a big appetite for stories.</p>
        <ul class="footer__links">
          <li><a href="books.html">All books</a></li>
          <li><a href="login.html">Log in</a></li>
          <li><a href="signup.html">Sign up</a></li>
          <li><a href="https://github.com/Cl0ud-9/Book-Website">Source code</a></li>
        </ul>
      </div>
      <form class="footer__form" data-newsletter novalidate>
        <h2 class="footer__form-title">Join our mailing list</h2>
        <label class="sr-only" for="newsletter-email">Email address</label>
        <input class="field__input is--light" type="email" id="newsletter-email" name="email" placeholder="Email address" autocomplete="email" required>
        {submit_alt("Subscribe")}
        <p class="footer__message" role="status" aria-live="polite" data-newsletter-message></p>
      </form>
    </div>
    <div class="footer__visual" data-footer-parallax-visual aria-hidden="true">{book3d(8, "is--footer", "20em")}</div>
    <div class="footer__bottom" data-footer-parallax-bottom>
      <p>© 2023–2026 Cloud/9. Every cover drawn for the Bookshelf.</p>
      <p>Built with GSAP, Lenis and Barba</p>
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


def page(name, title, description, body, theme="yellow"):
    scripts = "\n".join(f'<script src="{s}" defer></script>' for s in SCRIPTS)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<meta name="theme-color" content="#ffd24a">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="https://cl0ud-9.github.io/Book-Website/image/book-8-720.webp">
<link rel="icon" href="image/logo.svg" type="image/svg+xml">
<link rel="preload" href="fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/figtree.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/main.css">
{BOOT}
{scripts}
<script src="js/forms.js" defer></script>
<script src="js/app.js" defer></script>
</head>
<body data-barba="wrapper">
{SPRITE}
{TRANSITION}
{HEADER}
<main id="main" class="page" data-barba="container" data-barba-namespace="{name}" data-page-theme="{theme}">
{body}
{footer()}
</main>
<div class="emoji-rain" data-emoji-rain-container aria-hidden="true"></div>
</body>
</html>
"""


def book_card(i, sizes, extra_cls="", details=False, lazy=True):
    title, author, now, was, genres, colour, hook, desc, _ = BOOKS[i - 1]
    more = ""
    if details:
        more = (f'<button type="button" class="book-card__more" aria-expanded="false" aria-controls="about-{i}">'
                f'Show more</button><p class="book-card__about" id="about-{i}" hidden>{e(desc)}</p>')
    search = " ".join([title, author, *genres]).lower()
    ink = "#fff" if colour in DARK else "#000"
    return f"""<article class="book-card {extra_cls}" id="book-{i}" style="--card:var(--{colour});--ink:{ink}" data-search="{e(search)}" data-genres="{e(" ".join(slug(g) for g in genres))}" data-books-slider-item>
  <div class="book-card__cover">{cover(i, sizes, lazy=lazy)}</div>
  {tags(genres)}
  <h3 class="book-card__title">{e(title)}</h3>
  <p class="book-card__author">{e(author)}</p>
  {price(now, was)}
  <p class="book-card__hook">{e(hook)}</p>
  {more}
</article>"""


# Four line drawings for "how it works"
ILLUSTRATIONS = {
    "browse": '<svg viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 104h124"/><rect x="26" y="40" width="16" height="64" rx="2"/><rect x="44" y="28" width="18" height="76" rx="2"/><path d="m66 46 15-4 16 60-15 4z"/><rect x="100" y="52" width="14" height="52" rx="2"/><path d="M31 52h6M49 40h8M49 92h8M105 64h4"/><circle cx="118" cy="40" r="17" fill="#fff"/><path d="m130 52 14 14"/><path d="M110 36a9 9 0 0 1 8-6"/></g></svg>',
    "pick": '<svg viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M28 56h104l-10 50H38z" fill="#fff"/><path d="M22 56h116M52 56l14-30M108 56 94 26"/><path d="M58 70v24M80 70v24M102 70v24"/><path d="M56 40l-6-16 22-6 4 14" fill="#fff"/><path d="M84 36l6-20 20 6-4 14" fill="#fff"/><path d="m120 18 4 8 8 2-8 3-3 8-3-8-8-2 8-3z"/></g></svg>',
    "parcel": '<svg viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M30 50 80 30l50 20v46l-50 20-50-20z" fill="#fff"/><path d="m30 50 50 20 50-20M80 70v46"/><path d="m55 40 50 20v14"/><path d="M60 26 46 10M100 26l14-16M80 22V4"/><path d="M40 84l14 6M40 92l10 4"/></g></svg>',
    "talk": '<svg viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 22h74a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H50l-16 14V72H20a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8z" fill="#fff"/><path d="M30 40h52M30 54h36"/><path d="M146 52h-34a6 6 0 0 0-6 6v28a6 6 0 0 0 6 6h18l14 12V92h2a6 6 0 0 0 6-6V58a6 6 0 0 0-6-6z" fill="#fff"/><path d="m122 72 6 6 10-12"/></g></svg>',
}
STEPS = [
    ("cyan", "browse", "Browse the shelf", "Ten new books every month, from page-turning thrillers to poems for 2 a.m."),
    ("pale-pink", "pick", "Pick your reads", "Add as many as you like. Every book is fairly priced, and most are half off."),
    ("yellow", "parcel", "Open your parcel", "Your books arrive wrapped, with a bookmark for each one."),
    ("periwinkle", "talk", "Talk about it", "Share what you thought, and find your next favourite from other readers."),
]


def home():
    # Smooothy moves each .slide; the card inside it is free to tilt
    shelf = "\n".join(f'<div class="slide">{book_card(i, "(max-width: 991px) 60vw, 18em")}</div>'
                      for i in range(1, 11))
    steps = "\n".join(f"""<li class="step" style="--card:var(--{c})" data-call-out-item>
  <div class="step__inner" data-call-out-child>
    <p class="step__number handwritten">Step #{n}</p>
    <div class="step__visual">{ILLUSTRATIONS[ill]}</div>
    <h3 class="step__title">{e(t)}</h3>
    <p class="step__text">{e(d)}</p>
  </div>
</li>""" for n, (c, ill, t, d) in enumerate(STEPS, 1))
    # each genre shows four covers around it; books of that genre first, then others to fill
    def covers_for(g):
        mine = [i for i, b in enumerate(BOOKS, 1) if g in b[4]]
        rest = [i for i in range(1, 11) if i not in mine]
        return (mine + rest)[:4]
    holders = []
    for h in range(4):
        imgs = "".join(cover(covers_for(g)[h], "17em", alt="", cls="genre__img") for g in GENRES)
        holders.append(f'<div class="genre__holder"><div class="genre__box" data-genre-interaction-box>{imgs}</div></div>')
    genres = "\n".join(f"""<li class="genre__item" data-genre-interaction-item><a class="genre__link" href="books.html?genre={slug(g)}">
  <span class="genre__default">{e(g)}</span><span class="genre__hover" aria-hidden="true">{e(g)}</span></a></li>""" for g in GENRES)
    favourites = [(10, "#1", "Most re-read"), (4, "#2", "Most gifted"), (1, "#3", "Most underlined"),
                  (8, "#4", "Most talked about")]
    fav_cards = "\n".join(f"""<div class="slide"><article class="fav-card" style="--card:var(--{BOOKS[i - 1][5]});--ink:{'#fff' if BOOKS[i - 1][5] in DARK else '#000'}" data-books-slider-item>
  <div class="fav-card__cover">{cover(i, "(max-width: 991px) 60vw, 20em")}</div>
  <p class="fav-card__badge" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="{burst()}"/></svg><span>{rank}</span></p>
  <h3 class="fav-card__title">{e(BOOKS[i - 1][0])}</h3>
  <p class="fav-card__label">{rank}: {e(label)}</p>
</article></div>""" for i, rank, label in favourites)
    q = [
        ("Is the Bookshelf a real shop?",
         "Not yet. It is a design project: you can browse the shelf, search it and try the forms, but nothing is "
         "sold, sent or stored."),
        ("How much do books cost?",
         "Between ₹69 and ₹699 on this shelf, and most of them are half price."),
        ("Do I need an account to browse?",
         "No. Browse and search as much as you like. An account would save your shelf, once accounts exist."),
        ("How often do new books arrive?",
         "The shelf changes on the first of every month, so there is always something new to talk about."),
    ]
    faq = "\n".join(f"""<details class="accordion" data-accordion>
  <summary class="accordion__summary" data-accordion-summary><span class="accordion__title">{e(a)}</span>{icon("plus", "accordion__icon")}</summary>
  <div class="accordion__content" data-accordion-content><p>{e(b)}</p></div>
</details>""" for a, b in q)
    ribbon_text = "New books every month ✦ A free bookmark with every book ✦ Most of the shelf at half price ✦ "
    return f"""<section class="hero" data-intro-home aria-labelledby="hero-title">
  <div class="hero__bg" data-hero-bg>{bg_svg([("is--pale-yellow", shapes.HERO_BAND), ("is--pale-orange", shapes.HERO_RIDGE), ("is--orange", shapes.HERO_HILLS)], "hero__shapes", "0 0 1440 1000")}</div>
  <div class="hero__content">
    <h1 class="hero__title heading-xxl" id="hero-title" data-hero-title>Stories you can’t put down</h1>
    <p class="hero__text" data-hero-paragraph>The Bookshelf is a little online bookshop with a big appetite for stories. Hand-picked reads, fair prices and a fresh shelf every month.</p>
    <div data-hero-button>{button_alt("books.html", "Browse the shelf")}</div>
  </div>
  <p class="hero__note handwritten" data-hero-handwritten-text>Free bookmark with every book!</p>
  <div class="hero__visual" data-hero-visual aria-hidden="true">
    <div class="hero__book is--main" data-float><div class="hero__float">{book3d(8, "", "(max-width: 991px) 45vw, 26em", lazy=False, priority=True)}</div></div>
    <div class="hero__book is--top" data-float><div class="hero__float">{book3d(7, "", "(max-width: 991px) 30vw, 18em", lazy=False)}</div></div>
    <div class="hero__book is--bottom" data-float><div class="hero__float">{book3d(5, "", "(max-width: 991px) 30vw, 18em")}</div></div>
  </div>
</section>

<section class="books" id="new" aria-labelledby="books-title" data-books-slider>
  <div class="books__head">
    <p class="books__note handwritten" data-handwritten-text-inview>Hidden gems and page-turners</p>
    <h2 class="books__title heading-l" id="books-title">Fresh on the shelf</h2>
    <p class="books__text">Ten new reads for <span data-current-month>this month</span>. Drag the shelf, or use the arrows.</p>
  </div>
  <div class="slider-controls" data-books-slider-controls>
    <button class="slider-arrow" type="button" aria-label="Previous books">{icon("left")}</button>
    <button class="slider-arrow" type="button" aria-label="Next books">{icon("arrow")}</button>
  </div>
  <div class="books__slider" data-books-slider-viewport tabindex="0" role="region" aria-label="New books. Use the arrow keys to browse.">
    <div class="books__list" data-books-slider-wrapper>
{shelf}
    </div>
  </div>
</section>

<section class="flow" aria-labelledby="flow-title">
  <div class="flow__head">
    <h2 class="flow__title heading-l" id="flow-title">How it works</h2>
    <p class="flow__note handwritten" data-handwritten-text-inview>Easier than choosing what to read next</p>
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
          <div class="open-book__cover-front">{cover(4, "(max-width: 991px) 70vw, 30em", alt="")}</div>
          <div class="open-book__cover-back"><span>Ex libris</span>{icon("logo")}</div>
        </div>
      </div>
    </div>
    <p class="open-book__note handwritten" data-book-open-note>Every book comes with a bookmark, so you never lose your page</p>
    <div class="open-book__final">
      <h2 class="open-book__title" id="open-title" data-book-open-title>Get lost in <span class="open-book__mark">a good book.</span></h2>
      <div class="open-book__buttons">
        <span data-book-open-button>{button_alt("signup.html", "Sign up", "black")}</span>
        <span data-book-open-button>{button_alt("login.html", "Log in", "orange")}</span>
      </div>
      <p class="open-book__aside handwritten" data-book-open-aside>Made by readers, for readers</p>
    </div>
  </div>
</section>

<section class="genre" id="genres" aria-labelledby="genre-title" data-genre-interaction>
  <p class="genre__eyebrow" id="genre-title">Choose from</p>
  <p class="genre__note handwritten" data-handwritten-text-inview>A book for every kind of reader</p>
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
    <li class="sticker is--magenta" data-benefits-item style="--r:-6deg">Hand-picked reads</li>
    <li class="sticker is--orange" data-benefits-item style="--r:-3deg">Free bookmarks</li>
    <li class="sticker is--periwinkle" data-benefits-item style="--r:4deg">Fair prices</li>
    <li class="sticker is--cyan" data-benefits-item style="--r:7deg">New every month</li>
    <li class="sticker is--olive" data-benefits-item style="--r:-4deg">Every genre you love</li>
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
      <text class="tagline__text"><textPath href="#tagline-path" startOffset="100%" data-tagline-text>A gift that always fits</textPath></text></svg>
  </div>
  <div class="gift__grid">
    <div class="gift__content">
      <h2 class="gift__title heading-m" id="gift-title">A gift that always fits</h2>
      <p class="gift__text">Not sure what they like? Send a gift card and let them pick their own books. No guessing, no spying on their shelves, and they might even lend you one.</p>
      {button_alt("signup.html", "Send a gift card", size="small")}
      <p class="gift__note handwritten" data-handwritten-text-inview>Wrapped with a ribbon. Naturally.</p>
    </div>
    <div class="gift__visual" data-gift aria-hidden="true"><div class="gift__item" data-gift-item>{book3d(2, "is--gift", "(max-width: 991px) 50vw, 22em")}<span class="gift__ribbon"></span><span class="gift__bow"></span></div></div>
  </div>
</section>

<div class="ribbons" aria-label="{e(ribbon_text.replace(' ✦ ', '. ').strip())}" role="note">
  <div class="ribbon is--magenta" data-marquee="1"><div class="ribbon__track"><span>{e(ribbon_text * 3)}</span><span aria-hidden="true">{e(ribbon_text * 3)}</span></div></div>
  <div class="ribbon is--cyan" data-marquee="-1"><div class="ribbon__track"><span aria-hidden="true">{e(ribbon_text * 3)}</span><span aria-hidden="true">{e(ribbon_text * 3)}</span></div></div>
</div>

<section class="favs" aria-labelledby="favs-title" data-books-slider data-emoji-rain data-emoji-rain-set="📚,✨,🎉,💛">
  <div class="favs__head">
    <span class="favs__heart" data-plop-in aria-hidden="true"><svg data-plop-in-item viewBox="0 0 120 110"><path d="M60 104C28 82 6 62 6 36 6 18 20 6 36 6c11 0 19 6 24 15 5-9 13-15 24-15 16 0 30 12 30 30 0 26-22 46-54 68z" fill="var(--magenta)" stroke="#000" stroke-width="5"/><ellipse cx="44" cy="46" rx="11" ry="15" fill="#fff" stroke="#000" stroke-width="4"/><ellipse cx="76" cy="46" rx="11" ry="15" fill="#fff" stroke="#000" stroke-width="4"/><circle cx="47" cy="50" r="6"/><circle cx="79" cy="50" r="6"/><path d="M48 74q12 10 24 0" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/></svg></span>
    <h2 class="favs__title heading-l" id="favs-title">Readers’ favourites</h2>
    <p class="favs__text">The books readers keep coming back to. Every one of them has been re-read, gifted, underlined or argued about.</p>
  </div>
  <div class="favs__slider" data-books-slider-viewport tabindex="0" role="region" aria-label="Readers’ favourites. Use the arrow keys to browse.">
    <div class="favs__list" data-books-slider-wrapper>
{fav_cards}
    </div>
  </div>
  <div class="slider-controls is--center" data-books-slider-controls>
    <button class="slider-arrow" type="button" aria-label="Previous favourites">{icon("left")}</button>
    <button class="slider-arrow" type="button" aria-label="Next favourites">{icon("arrow")}</button>
  </div>
</section>

<section class="spotlight" aria-labelledby="spot-title" data-momentum-hover>
  <h2 class="spotlight__title heading-l" id="spot-title">Only on the Bookshelf</h2>
  <p class="spotlight__text">Our pick of the month. Read it slowly, then read it again.</p>
  <div class="spotlight__frame">
    <p class="spotlight__quote is--left handwritten" data-handwritten-text-inview>“Perfect for 2 a.m. thoughts and rainy Sundays.”</p>
    <span class="spotlight__emoji is--eyes" data-momentum-hover-element><span data-momentum-hover-target>👀</span></span>
    <span class="spotlight__emoji is--star" data-momentum-hover-element><span data-momentum-hover-target>🤩</span></span>
    <span class="spotlight__emoji is--sparkle" data-momentum-hover-element><span data-momentum-hover-target>✨</span></span>
    <article class="spotlight__card">
      <div class="spotlight__cover">{cover(10, "(max-width: 991px) 60vw, 20em")}</div>
      {tags(["Poetry", "Bookshelf pick"])}
      <h3 class="spotlight__book">Night Swimming</h3>
      <p class="spotlight__book-text">Poems for 2 a.m. and the moon that keeps you up, by Ruth Okafor. ₹169, down from ₹299.</p>
      {button_alt("books.html#book-10", "See the book", size="small")}
    </article>
    <aside class="spotlight__facts" aria-label="Inside the book">
      <h4>Inside</h4>
      <p>Forty-two short poems about water, insomnia and the people we call at midnight.</p>
    </aside>
    <p class="spotlight__quote is--right handwritten" data-handwritten-text-inview>“Keep a pencil handy. You will want to underline.”</p>
  </div>
</section>"""


def burst(points=14, r1=50, r2=40):
    import math
    pts = []
    for k in range(points * 2):
        r = r1 if k % 2 == 0 else r2
        a = math.pi * k / points - math.pi / 2
        pts.append(f"{50 + r * math.cos(a):.1f} {50 + r * math.sin(a):.1f}")
    return "M" + "L".join(pts) + "Z"


def books_page():
    cards = "\n".join(book_card(i, "(max-width: 767px) 80vw, (max-width: 991px) 40vw, 20em", details=True)
                      for i in range(1, 11))
    chips = "".join(f'<li><button type="button" class="chip" aria-pressed="false" data-genre="{slug(g)}">{e(g)}</button></li>'
                    for g in sorted({g for b in BOOKS for g in b[4]}))
    return f"""<section class="hero-xs is--pale-blue" data-intro-page aria-labelledby="page-title">
  {bg_svg([("is--soft-blue", shapes.BLOB_A), ("is--soft-blue", shapes.BLOB_B)], "hero-xs__shapes", "0 0 1440 1000", small=True)}
  <h1 class="hero-xs__title heading-l" id="page-title" data-hero-title>All books</h1>
  <p class="hero-xs__text" data-hero-paragraph>The whole shelf in one place. Search by title, author or genre.</p>
  <p class="hero-xs__note handwritten" data-hero-handwritten-text>Go on, pick three</p>
</section>
<section class="catalogue" aria-label="Find a book" data-search-root>
  <form class="search" role="search" data-search-form>
    <label class="sr-only" for="search-box">Search books by title, author or genre</label>
    {icon("search", "search__icon")}
    <input class="search__input" type="search" id="search-box" placeholder="Search titles, authors or genres" autocomplete="off" data-search-input>
  </form>
  <ul class="chips" aria-label="Filter by genre">{chips}</ul>
  <h2 class="sr-only">Books</h2>
  <p class="catalogue__status" role="status" aria-live="polite" data-search-status>Showing all 10 books.</p>
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
  <h1 class="hero-xs__title heading-l" id="page-title" data-hero-title>{e(title)}</h1>
  <p class="hero-xs__text" data-hero-paragraph>{e(text)}</p>
  <p class="hero-xs__note handwritten" data-hero-handwritten-text>{e(note)}</p>
  <form class="form-card" data-validate="{kind}" novalidate data-hero-content>
    {fields}
    {submit_alt(cta)}
    <p class="form-card__message" id="form-message" role="status" aria-live="polite"></p>
    <p class="form-card__switch">{switch}</p>
    <p class="form-card__small">This is a demo: nothing you type is sent or stored.</p>
  </form>
</section>"""


NOT_FOUND = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | The Bookshelf</title>
<meta name="description" content="This page of The Bookshelf does not exist.">
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


def write(name, text):
    (OUT / name).write_text(text, encoding="utf-8", newline="\n")
    print(f"{name}: {len(text):,} bytes")


write("index.html", page("home", "The Bookshelf: stories you can’t put down",
                         "A little online bookshop with hand-picked reads, fair prices and a fresh shelf every month.",
                         home()))
write("books.html", page("books", "All books | The Bookshelf",
                         "Every book on the Bookshelf, searchable by title, author and genre.", books_page(), "pale-blue"))
write("login.html", page("login", "Log in | The Bookshelf", "Log in to the Bookshelf.", form_page("login"), "pale-pink"))
write("signup.html", page("signup", "Sign up | The Bookshelf", "Create a Bookshelf account.", form_page("signup"),
                          "pale-periwinkle"))
write("404.html", NOT_FOUND)

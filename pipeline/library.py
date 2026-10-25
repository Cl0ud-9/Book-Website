"""Build the library: every book's details, cover and EPUB, from Standard Ebooks (standardebooks.org).

Standard Ebooks' editions are in the US public domain and its own work is dedicated to the public domain (CC0), so the
books and covers are copied here and served with the site. Downloads are cached in pipeline/.library-cache and spaced
out, so a re-run only fetches what is new and never hammers their server.

usage: python pipeline/library.py [--refresh-popularity]   (needs Pillow; writes data/books.json, .assets/image/covers/, .assets/books/)
Then run npm run build to regenerate the pages.
"""
import html
import io
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".library-cache"
SE = "https://standardebooks.org/ebooks/"
AGENT = "Mozilla/5.0 (The Bookshelf library builder; https://github.com/Cl0ud-9/Book-Website)"
PAUSE = 2.5  # seconds between requests to standardebooks.org
WIDTHS = (180, 360, 720, 1080)  # covers are 2:3
PUBLISHERS = {"Chapman and Hall", "The Modern Library"}
MAX_EPUB = 8_000_000  # bytes; bigger books are made lighter (see lighter()), or failing that stay on Standard Ebooks

# The shelf: the Standard Ebooks edition of each book and its genres here (theirs have no Romance, for one).
# Every book is in the public domain in the US (Standard Ebooks' rule) and in India (life of the author plus 60 years),
# so authors who died after 1965, such as Agatha Christie, are left out even where Standard Ebooks has them. The same
# goes for translators (Seneca's letters in Gummere's translation, Gandhi's autobiography, part translated by Pyarelal)
# and for a translator whose dates cannot be found (Arsène Lupin's George Morehead). pipeline/rights.py checks them all.
CATALOGUE = [
    # Romance
    ("jane-austen/pride-and-prejudice", ["Romance"]),
    ("jane-austen/sense-and-sensibility", ["Romance"]),
    ("jane-austen/emma", ["Romance"]),
    ("jane-austen/persuasion", ["Romance"]),
    ("jane-austen/northanger-abbey", ["Romance"]),
    ("charlotte-bronte/jane-eyre", ["Romance"]),
    ("emily-bronte/wuthering-heights", ["Romance"]),
    ("anne-bronte/the-tenant-of-wildfell-hall", ["Romance"]),
    ("elizabeth-gaskell/north-and-south", ["Romance"]),
    ("edith-wharton/the-age-of-innocence", ["Romance"]),
    ("l-m-montgomery/the-blue-castle", ["Romance"]),
    ("thomas-hardy/tess-of-the-durbervilles", ["Romance", "Literary fiction"]),
    ("gustave-flaubert/madame-bovary/eleanor-marx-aveling", ["Romance", "Literary fiction"]),
    ("leo-tolstoy/anna-karenina/constance-garnett", ["Romance", "Literary fiction"]),
    ("kate-chopin/the-awakening", ["Romance", "Literary fiction"]),
    # Mystery
    ("arthur-conan-doyle/the-adventures-of-sherlock-holmes", ["Mystery"]),
    ("arthur-conan-doyle/a-study-in-scarlet", ["Mystery"]),
    ("arthur-conan-doyle/the-sign-of-the-four", ["Mystery"]),
    ("arthur-conan-doyle/the-hound-of-the-baskervilles", ["Mystery"]),
    ("arthur-conan-doyle/the-memoirs-of-sherlock-holmes", ["Mystery"]),
    ("wilkie-collins/the-moonstone", ["Mystery"]),
    ("wilkie-collins/the-woman-in-white", ["Mystery"]),
    ("dashiell-hammett/the-maltese-falcon", ["Mystery"]),
    ("g-k-chesterton/the-innocence-of-father-brown", ["Mystery"]),
    ("john-buchan/the-thirty-nine-steps", ["Mystery", "Adventure"]),
    ("arthur-conan-doyle/the-return-of-sherlock-holmes", ["Mystery"]),
    ("arthur-conan-doyle/the-valley-of-fear", ["Mystery"]),
    ("arthur-conan-doyle/his-last-bow", ["Mystery"]),
    ("g-k-chesterton/the-man-who-was-thursday", ["Mystery"]),
    # Adventure
    ("alexandre-dumas/the-count-of-monte-cristo/chapman-and-hall", ["Adventure"]),
    ("alexandre-dumas/the-three-musketeers/william-robson", ["Adventure"]),
    ("robert-louis-stevenson/treasure-island", ["Adventure"]),
    ("herman-melville/moby-dick", ["Adventure", "Literary fiction"]),
    ("jules-verne/around-the-world-in-eighty-days/george-makepeace-towle", ["Adventure"]),
    ("jules-verne/journey-to-the-center-of-the-earth/f-a-malleson", ["Adventure", "Science fiction"]),
    ("jules-verne/the-mysterious-island/stephen-w-white", ["Adventure"]),
    ("jack-london/the-call-of-the-wild", ["Adventure"]),
    ("jack-london/white-fang", ["Adventure"]),
    ("mark-twain/the-adventures-of-huckleberry-finn", ["Adventure"]),
    ("mark-twain/the-adventures-of-tom-sawyer", ["Adventure", "Children’s"]),
    ("daniel-defoe/the-life-and-adventures-of-robinson-crusoe", ["Adventure"]),
    ("jonathan-swift/gullivers-travels", ["Adventure", "Fantasy"]),
    ("h-rider-haggard/king-solomons-mines", ["Adventure"]),
    ("arthur-conan-doyle/the-lost-world", ["Adventure", "Science fiction"]),
    ("miguel-de-cervantes-saavedra/don-quixote/john-ormsby", ["Adventure", "Literary fiction"]),
    # Fantasy
    ("lewis-carroll/alices-adventures-in-wonderland/john-tenniel", ["Fantasy", "Children’s"]),
    ("lewis-carroll/through-the-looking-glass/john-tenniel", ["Fantasy", "Children’s"]),
    ("l-frank-baum/the-wonderful-wizard-of-oz", ["Fantasy", "Children’s"]),
    ("j-m-barrie/peter-and-wendy", ["Fantasy", "Children’s"]),
    ("lord-dunsany/the-king-of-elflands-daughter", ["Fantasy"]),
    ("robert-e-howard/conan-stories", ["Fantasy"]),
    ("thomas-malory/le-morte-darthur", ["Fantasy"]),
    ("anonymous/sir-gawain-and-the-green-knight/s-o-andrew", ["Fantasy", "Poetry"]),
    ("edgar-rice-burroughs/a-princess-of-mars", ["Fantasy", "Science fiction"]),
    ("mark-twain/a-connecticut-yankee-in-king-arthurs-court", ["Fantasy"]),
    # Science fiction
    ("mary-shelley/frankenstein", ["Science fiction", "Horror"]),
    ("h-g-wells/the-time-machine", ["Science fiction"]),
    ("h-g-wells/the-war-of-the-worlds", ["Science fiction"]),
    ("h-g-wells/the-invisible-man", ["Science fiction"]),
    ("h-g-wells/the-island-of-doctor-moreau", ["Science fiction", "Horror"]),
    ("yevgeny-zamyatin/we/gregory-zilboorg", ["Science fiction"]),
    ("edwin-a-abbott/flatland", ["Science fiction"]),
    ("mary-shelley/the-last-man", ["Science fiction"]),
    ("h-g-wells/short-fiction", ["Science fiction"]),
    ("edgar-rice-burroughs/pirates-of-venus", ["Science fiction", "Adventure"]),
    # Horror
    ("bram-stoker/dracula", ["Horror"]),
    ("robert-louis-stevenson/the-strange-case-of-dr-jekyll-and-mr-hyde", ["Horror"]),
    ("edgar-allan-poe/short-fiction", ["Horror", "Mystery"]),
    ("h-p-lovecraft/short-fiction", ["Horror"]),
    ("h-p-lovecraft/at-the-mountains-of-madness", ["Horror"]),
    ("henry-james/the-turn-of-the-screw", ["Horror"]),
    ("robert-w-chambers/the-king-in-yellow", ["Horror"]),
    ("j-sheridan-le-fanu/short-fiction", ["Horror"]),
    ("gaston-leroux/the-phantom-of-the-opera/alexander-teixeira-de-mattos", ["Horror", "Romance"]),
    ("william-hope-hodgson/the-house-on-the-borderland", ["Horror"]),
    ("oscar-wilde/the-picture-of-dorian-gray", ["Horror", "Literary fiction"]),
    # Poetry
    ("walt-whitman/leaves-of-grass", ["Poetry"]),
    ("kahlil-gibran/the-prophet", ["Poetry", "Philosophy"]),
    ("edgar-allan-poe/poetry", ["Poetry"]),
    ("john-keats/poetry", ["Poetry"]),
    ("w-b-yeats/poetry", ["Poetry"]),
    ("john-donne/poetry", ["Poetry"]),
    ("john-milton/paradise-lost", ["Poetry"]),
    ("dante-alighieri/the-divine-comedy/henry-wadsworth-longfellow", ["Poetry"]),
    ("homer/the-odyssey/william-cullen-bryant", ["Poetry", "Adventure"]),
    ("homer/the-iliad/william-cullen-bryant", ["Poetry"]),
    ("anonymous/beowulf/john-lesslie-hall", ["Poetry", "Fantasy"]),
    # Philosophy
    ("marcus-aurelius/meditations/george-long", ["Philosophy"]),
    ("sun-tzu/the-art-of-war/lionel-giles", ["Philosophy"]),
    ("laozi/tao-te-ching/james-legge", ["Philosophy"]),
    ("niccolo-machiavelli/the-prince/w-k-marriott", ["Philosophy"]),
    ("friedrich-nietzsche/beyond-good-and-evil/helen-zimmern", ["Philosophy"]),
    ("friedrich-nietzsche/thus-spake-zarathustra/thomas-common", ["Philosophy"]),
    ("epictetus/discourses/george-long", ["Philosophy"]),
    ("plato/dialogues/benjamin-jowett", ["Philosophy"]),
    ("henry-david-thoreau/walden", ["Lives and memoirs", "Philosophy"]),
    ("boethius/the-consolation-of-philosophy/h-r-james", ["Philosophy"]),
    ("hermann-hesse/siddhartha/various-translators", ["Literary fiction", "Philosophy"]),
    ("william-james/the-varieties-of-religious-experience", ["Philosophy"]),
    # Lives and memoirs
    ("frederick-douglass/narrative-of-the-life-of-frederick-douglass", ["Lives and memoirs"]),
    ("benjamin-franklin/the-autobiography-of-benjamin-franklin", ["Lives and memoirs"]),
    ("booker-t-washington/up-from-slavery", ["Lives and memoirs"]),
    ("rabindranath-tagore/my-reminiscences/the-macmillan-company", ["Lives and memoirs"]),
    # History and politics
    ("john-stuart-mill/on-liberty", ["History and politics", "Philosophy"]),
    ("mary-wollstonecraft/a-vindication-of-the-rights-of-woman", ["History and politics"]),
    ("w-e-b-du-bois/the-souls-of-black-folk", ["History and politics", "Essays and letters"]),
    ("thomas-paine/the-rights-of-man", ["History and politics"]),
    ("adam-smith/the-wealth-of-nations", ["History and politics"]),
    # Science and nature
    ("charles-darwin/the-origin-of-species", ["Science and nature"]),
    ("charles-darwin/the-voyage-of-the-beagle", ["Science and nature"]),
    # Essays and letters
    ("ralph-waldo-emerson/essays", ["Essays and letters"]),
    # From India (with the Project Gutenberg books in data/gutenberg.json)
    ("rabindranath-tagore/gitanjali", ["Poetry"]),
    ("rabindranath-tagore/the-home-and-the-world/surendranath-tagore", ["Literary fiction"]),
    # Children's
    ("frances-hodgson-burnett/the-secret-garden", ["Children’s"]),
    ("frances-hodgson-burnett/a-little-princess", ["Children’s"]),
    ("l-m-montgomery/anne-of-green-gables", ["Children’s"]),
    ("louisa-may-alcott/little-women", ["Children’s", "Romance"]),
    ("a-a-milne/winnie-the-pooh", ["Children’s"]),
    ("kenneth-grahame/the-wind-in-the-willows", ["Children’s"]),
    ("anna-sewell/black-beauty", ["Children’s"]),
    ("hugh-lofting/the-story-of-doctor-dolittle", ["Children’s"]),
    ("rudyard-kipling/the-jungle-book", ["Children’s", "Adventure"]),
    ("aesop/fables/v-s-vernon-jones", ["Children’s"]),
    ("oscar-wilde/childrens-stories", ["Children’s", "Fantasy"]),
    # Plays
    ("william-shakespeare/hamlet", ["Plays"]),
    ("william-shakespeare/macbeth", ["Plays"]),
    ("william-shakespeare/romeo-and-juliet", ["Plays", "Romance"]),
    ("william-shakespeare/othello", ["Plays"]),
    ("william-shakespeare/a-midsummer-nights-dream", ["Plays", "Fantasy"]),
    ("william-shakespeare/king-lear", ["Plays"]),
    ("william-shakespeare/the-tempest", ["Plays", "Fantasy"]),
    ("oscar-wilde/the-importance-of-being-earnest", ["Plays"]),
    # Literary fiction
    ("f-scott-fitzgerald/the-great-gatsby", ["Literary fiction", "Romance"]),
    ("fyodor-dostoevsky/crime-and-punishment/constance-garnett", ["Literary fiction"]),
    ("fyodor-dostoevsky/the-brothers-karamazov/constance-garnett", ["Literary fiction"]),
    ("fyodor-dostoevsky/notes-from-underground/constance-garnett", ["Literary fiction", "Philosophy"]),
    ("charles-dickens/great-expectations", ["Literary fiction"]),
    ("charles-dickens/a-tale-of-two-cities", ["Literary fiction"]),
    ("charles-dickens/a-christmas-carol", ["Literary fiction", "Fantasy"]),
    ("charles-dickens/oliver-twist", ["Literary fiction"]),
    ("george-eliot/middlemarch", ["Literary fiction", "Romance"]),
    ("virginia-woolf/to-the-lighthouse", ["Literary fiction"]),
    ("virginia-woolf/mrs-dalloway", ["Literary fiction"]),
    ("virginia-woolf/orlando", ["Literary fiction", "Fantasy"]),
    ("james-joyce/dubliners", ["Literary fiction"]),
    ("ernest-hemingway/the-sun-also-rises", ["Literary fiction"]),
    ("ernest-hemingway/a-farewell-to-arms", ["Literary fiction", "Romance"]),
    ("joseph-conrad/heart-of-darkness", ["Literary fiction", "Adventure"]),
    ("nathaniel-hawthorne/the-scarlet-letter", ["Literary fiction"]),
    ("thomas-hardy/jude-the-obscure", ["Literary fiction"]),
    ("william-makepeace-thackeray/vanity-fair", ["Literary fiction"]),
    ("henry-james/the-portrait-of-a-lady", ["Literary fiction", "Romance"]),
    ("voltaire/candide/the-modern-library", ["Literary fiction", "Philosophy"]),
    ("anton-chekhov/short-fiction/constance-garnett", ["Literary fiction"]),
    ("o-henry/short-fiction", ["Literary fiction"]),
    ("jerome-k-jerome/three-men-in-a-boat", ["Literary fiction", "Adventure"]),
]

last_request = 0.0


def fetch(url, binary=False):
    global last_request
    wait = PAUSE - (time.time() - last_request)
    if wait > 0:
        time.sleep(wait)
    last_request = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")


def cached(name, url, binary=False):
    path = CACHE / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        data = fetch(url, binary)
        path.write_bytes(data if binary else data.encode("utf-8"))
    return path.read_bytes() if binary else path.read_text(encoding="utf-8")


def text(fragment):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", fragment))).strip()


def slug_of(title, taken):
    # Plain letters for the address: Arsène becomes arsene, not ars-ne
    plain = "".join(c for c in unicodedata.normalize("NFD", text(title).lower()) if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", "-", plain.replace("’", "").replace("'", "")).strip("-")
    base, n = s, 2
    while s in taken:
        s, n = f"{base}-{n}", n + 1
    taken.add(s)
    return s


def parse(page, se_path):
    title = text(re.search(r'<h1 property="schema:name">(.*?)</h1>', page, re.S).group(1))
    og = text(re.search(r'content="([^"]+)" property="og:title"', page).group(1))
    by = og.removesuffix(" - Free ebook download").split(", by ", 1)[1]
    # "F. Scott Fitzgerald. Translated by F. A. Malleson": split only where a credit begins, never at an initial
    author, *credits = re.split(r"\. (?=(?:Translated|Illustrated|Edited|Introduced|Annotated) by )", by)
    translator = next((c.removeprefix("Translated by ").rstrip(".") for c in credits if c.startswith("Translated by ")), None)
    if translator in PUBLISHERS:  # an anonymous translation, known by its publisher: not a person to credit
        translator = None
    abstract = text(re.search(r'property="schema:abstract" content="([^"]+)"', page).group(1))
    body = re.search(r'<div property="schema:description">(.*?)</div>', page, re.S).group(1)
    paragraphs = [text(p) for p in re.findall(r"<p>(.*?)</p>", body, re.S)]
    words = re.search(r"([0-9,]+) words \(([^)]+)\)", page)
    epub = re.search(r'downloads/([a-z0-9_-]+)\.epub"', page).group(1)
    return {
        "title": title, "author": author, "translator": translator,
        "abstract": abstract, "description": paragraphs,
        "words": int(words.group(1).replace(",", "")), "reading_time": words.group(2),
        "language": re.search(r'property="schema:inLanguage" content="([^"]+)"', page).group(1),
        "standard_ebooks": SE + se_path,
        "epub_name": epub,
    }


def spine_colour(im):
    # The average of the cover's left edge, darkened a little: the colour of the book's spine in 3D
    strip = im.crop((0, 0, max(1, im.width // 25), im.height)).resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return "#%02x%02x%02x" % tuple(int(c * 0.7) for c in strip[:3])


def popularity(paths, refresh=False):
    """Each book's place in Standard Ebooks' own popularity ranking (by how much its books are read there).
    The listing pages are cached like everything else; pass --refresh-popularity to take a new reading."""
    ranks, page, wanted = {}, 1, set(paths)
    while not wanted <= ranks.keys() and page <= 40:
        name = f"popularity-{page:02}.html"
        if refresh:
            (CACHE / name).unlink(missing_ok=True)
        listing = cached(name, f"{SE[:-1]}?sort=popularity&view=list&per-page=48&page={page}")
        found = re.findall(r'href="/ebooks/([a-z0-9-]+/[a-z0-9-]+(?:/[a-z0-9-]+)*)"', listing)
        if not found:
            break
        for path in dict.fromkeys(found):
            ranks.setdefault(path, len(ranks) + 1)
        page += 1
    return {p: ranks.get(p) for p in paths}


def opening_line(epub_bytes):
    """The first sentence of the book's first chapter, read from the EPUB (None for books not kept here)."""
    if not epub_bytes:
        return None
    with zipfile.ZipFile(io.BytesIO(epub_bytes)) as z:
        opf_path = next(n for n in z.namelist() if n.endswith(".opf"))
        opf = z.read(opf_path).decode("utf-8")
        items = dict(re.findall(r'<item[^>]*?id="([^"]+)"[^>]*?href="([^"]+)"', opf))
        items.update({i: h for h, i in re.findall(r'<item[^>]*?href="([^"]+)"[^>]*?id="([^"]+)"', opf)})
        base = opf_path.rsplit("/", 1)[0] + "/" if "/" in opf_path else ""
        for idref in re.findall(r'<itemref[^>]*idref="([^"]+)"', opf):
            doc = z.read(base + items[idref]).decode("utf-8")
            if not re.search(r'epub:type="[^"]*bodymatter', doc):
                continue
            for p in re.findall(r"<p[^>]*>(.*?)</p>", doc, re.S):
                # without footnote markers and the invisible joiners the editions use around dashes
                p = re.sub(r'<a[^>]*noteref[^>]*>.*?</a>', "", p, flags=re.S)
                line = re.sub(r"[⁠﻿​]", "", text(p))
                if len(line) >= 40:
                    first = re.match(r"(.{30,240}?[.!?][”’\"]?)(?:\s|$)", line)
                    return first.group(1) if first else (line[:200].rsplit(" ", 1)[0] + "…")
    return None


# A few books Standard Ebooks does not have (Indian classics, for now) come from Project Gutenberg, through its mirror
# (its website is for people, not scripts). Their details, written here, are in data/gutenberg.json; their covers are
# drawn by pipeline/covers.py; their files are kept exactly as Project Gutenberg made them, with its licence inside, as
# that licence asks of anyone sharing them.
GUTENBERG = "https://gutenberg.pglaf.org/cache/epub/{id}/pg{id}-images-3.epub"


def reading_time(words):
    # as Standard Ebooks counts it: about 275 words a minute
    minutes = max(1, round(words / 275))
    hours, rest = divmod(minutes, 60)
    parts = ([f"{hours} hour{'s' if hours != 1 else ''}"] if hours else []) + ([f"{rest} minute{'s' if rest != 1 else ''}"] if rest else [])
    return " ".join(parts)


def gutenberg_books(taken):
    books = []
    source = ROOT / "data" / "gutenberg.json"
    for entry in json.loads(source.read_text(encoding="utf-8")) if source.exists() else []:
        data = cached(f"pg{entry['id']}.epub", GUTENBERG.format(id=entry["id"]), binary=True)
        archive = zipfile.ZipFile(io.BytesIO(data))
        words_text = " ".join(text(archive.read(n).decode("utf-8", "ignore")) for n in archive.namelist() if n.endswith((".xhtml", ".html", ".htm")))
        # only the book itself counts, not Project Gutenberg's header and licence
        start = words_text.find("*** START OF")
        end = words_text.find("*** END OF")
        body = words_text[start:end] if 0 <= start < end else words_text
        words = len(re.findall(r"\w+", body))
        slug = slug_of(entry["title"], taken)
        own = ROOT / "data" / "covers" / f"{slug}.png"
        if not own.exists():
            raise SystemExit(f"{slug} needs a cover: add it to pipeline/covers.py and run that first")
        im = Image.open(own).convert("RGB")
        for w in WIDTHS:
            im.resize((w, w * 3 // 2), Image.LANCZOS).save(ROOT / ".assets" / "image" / "covers" / f"{slug}-{w}.webp", "WEBP",
                                                         quality=82 if w < 720 else 78, method=6)
        epub = ROOT / ".assets" / "books" / f"{slug}.epub"
        epub.write_bytes(data)
        page = f"https://www.gutenberg.org/ebooks/{entry['id']}"
        books.append({
            "title": entry["title"], "author": entry["author"], "translator": entry["translator"],
            "abstract": entry["abstract"], "description": entry["description"], "words": words,
            "reading_time": reading_time(words), "language": "en", "standard_ebooks": None, "gutenberg": page,
            "slug": slug, "genres": entry["genres"], "collections": entry.get("collections", []), "spine": spine_colour(im),
            "epub": f"books/{slug}.epub", "size": len(data), "popularity": None, "opening": None,
            "kindle": f"{page}.kf8.images", "kobo": f"{page}.epub3.images",
        })
        print(f"    {entry['title']} (Project Gutenberg, {len(data) // 1024} KB, {words:,} words)", flush=True)
    return books


def with_cover(data, im):
    """The EPUB with its cover image replaced (the file named as cover-image in its package)."""
    source = zipfile.ZipFile(io.BytesIO(data))
    opf_name = next(n for n in source.namelist() if n.endswith(".opf"))
    opf = source.read(opf_name).decode("utf-8")
    href = re.search(r'<item href="([^"]+)"[^>]*properties="cover-image"', opf).group(1)
    cover_name = str(Path(opf_name).parent / href).replace("\\", "/")
    jpeg = io.BytesIO()
    im.save(jpeg, "JPEG", quality=88, optimize=True)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as target:
        # an EPUB starts with its mimetype, stored uncompressed
        target.writestr(zipfile.ZipInfo("mimetype"), source.read("mimetype"), compress_type=zipfile.ZIP_STORED)
        for item in source.infolist():
            if item.filename == "mimetype":
                continue
            body = jpeg.getvalue() if item.filename == cover_name else source.read(item.filename)
            target.writestr(item.filename, body, compress_type=zipfile.ZIP_DEFLATED)
    return out.getvalue()


def lighter(data):
    """A heavily illustrated EPUB made light enough to read in a browser: Standard Ebooks gives each illustration twice,
    at double resolution for sharp screens too (two thirds of Alice's 18 MB), and serves those big files slowly. This
    keeps the ordinary ones only, and stores line art that is black on transparent (Tenniel's engravings) in sixteen
    shades of transparency, which looks the same. The text is untouched."""
    source = zipfile.ZipFile(io.BytesIO(data))
    doubles = {n for n in source.namelist() if re.search(r"-2x\.(png|jpe?g)$", n)}
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as target:
        target.writestr(zipfile.ZipInfo("mimetype"), source.read("mimetype"), compress_type=zipfile.ZIP_STORED)
        for item in source.infolist():
            if item.filename == "mimetype" or item.filename in doubles:
                continue
            body = source.read(item.filename)
            if item.filename.endswith(".opf"):
                # their entries leave the package list
                body = re.sub(r'\s*<item [^>]*href="[^"]*-2x\.(?:png|jpe?g)"[^>]*/>', "", body.decode("utf-8")).encode("utf-8")
            elif item.filename.endswith(".xhtml"):
                body = re.sub(r'\s+srcset="[^"]*"', "", body.decode("utf-8")).encode("utf-8")
            elif item.filename.endswith(".png"):
                body = black_line_art(body) or body
            target.writestr(item.filename, body, compress_type=zipfile.ZIP_DEFLATED)
    return out.getvalue()


def black_line_art(png):
    """The PNG in sixteen levels of transparency, if it is black drawn on transparent and that makes it smaller"""
    im = Image.open(io.BytesIO(png))
    if "A" not in im.convert("RGBA").getbands():
        return None
    rgba = im.convert("RGBA")
    if max(band.getextrema()[1] for band in rgba.split()[:3]) > 40:  # not black line art
        return None
    # each pixel is one of sixteen palette entries, all black, from clear to solid
    levels = rgba.getchannel("A").point(lambda v: round(v / 255 * 15))
    art = Image.frombytes("P", rgba.size, levels.tobytes())
    art.putpalette([0, 0, 0] * 16)
    small = io.BytesIO()
    art.save(small, "PNG", optimize=True, bits=4, transparency=bytes(i * 17 for i in range(16)))
    return small.getvalue() if len(small.getvalue()) < len(png) else None


def main():
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / ".assets" / "books").mkdir(exist_ok=True)
    (ROOT / ".assets" / "image" / "covers").mkdir(parents=True, exist_ok=True)
    taken, books, skipped, capped = set(), [], [], []
    ranks = popularity([path for path, _ in CATALOGUE], refresh="--refresh-popularity" in sys.argv)
    for n, (se_path, genres) in enumerate(CATALOGUE, 1):
        key = se_path.replace("/", "_")
        try:
            page = cached(f"{key}.html", SE + se_path)
            book = parse(page, se_path)
        except Exception as error:  # a moved or renamed edition: report it and carry on with the rest
            skipped.append(f"{se_path}: {error}")
            print(f"{n:3}/{len(CATALOGUE)} SKIPPED {se_path}: {error}", flush=True)
            continue
        # "Short Fiction" and "Poetry" belong to several authors, so those addresses start with the author's name
        generic = book["title"] in {"Short Fiction", "Poetry", "Short Science Fiction", "Short Works", "Dialogues", "Essays"}
        book["slug"] = slug_of(f"{book['author']} {book['title']}" if generic else book["title"], taken)
        book["genres"] = genres
        book["collections"] = ["india"] if se_path.startswith("rabindranath-tagore/") else []
        cover = CACHE / f"{key}.jpg"
        if not cover.exists():
            cover.write_bytes(fetch(f"{SE}{se_path}/downloads/cover.jpg", binary=True))
        # A cover painted by someone who died after 1965 is not free in India: those books have one drawn by
        # pipeline/covers.py instead, used here and inside the book's file
        own = ROOT / "data" / "covers" / f"{book['slug']}.png"
        im = Image.open(own if own.exists() else cover).convert("RGB")
        book["spine"] = spine_colour(im)
        for w in WIDTHS:
            out = ROOT / ".assets" / "image" / "covers" / f"{book['slug']}-{w}.webp"
            if own.exists() or not out.exists():
                im.resize((w, w * 3 // 2), Image.LANCZOS).save(out, "WEBP", quality=82 if w < 720 else 78, method=6)
        source = f"{SE}{se_path}/downloads/{book['epub_name']}.epub?source=download"
        epub = ROOT / ".assets" / "books" / f"{book['slug']}.epub"
        try:
            if capped and not (CACHE / f"{key}.epub").exists():
                raise urllib.error.HTTPError(source, 429, "capped earlier in this run", None, None)
            data = cached(f"{key}.epub", source, binary=True)
        except urllib.error.HTTPError as error:
            if error.code != 429:
                raise
            # Standard Ebooks caps how many books one visitor downloads in a while. Until a later run fetches it, the
            # book is read and downloaded from Standard Ebooks itself, so the shelf is complete either way.
            capped.append(book["title"])
            epub.unlink(missing_ok=True)
            book["epub"] = source
            data = None
        if data is not None and len(data) > MAX_EPUB:
            data = lighter(data)
        if data is None:
            pass
        elif len(data) > MAX_EPUB:
            # Heavily illustrated editions run to tens of MB: those are read and downloaded from Standard Ebooks itself
            # (its server allows other sites to read its files), so the repository stays small
            epub.unlink(missing_ok=True)
            book["epub"] = source
        else:
            if own.exists():
                epub.write_bytes(with_cover(data, im))
            elif not epub.exists() or epub.stat().st_size != len(data):
                epub.write_bytes(data)
            book["epub"] = f"books/{book['slug']}.epub"
        book["size"] = len(data) if data else None
        book["popularity"] = ranks.get(se_path)
        book["opening"] = opening_line(data if data and len(data) <= MAX_EPUB else None)
        book["kindle"] = f"{SE}{se_path}/downloads/{book['epub_name']}.azw3?source=download"
        book["kobo"] = f"{SE}{se_path}/downloads/{book['epub_name']}.kepub.epub?source=download"
        del book["epub_name"]
        books.append(book)
        where = "fetched later" if data is None else f"{len(data) // 1024} KB" + (", from Standard Ebooks" if len(data) > MAX_EPUB else "")
        print(f"{n:3}/{len(CATALOGUE)} {book['title']} ({where})", flush=True)
    books.extend(gutenberg_books(taken))
    (ROOT / "data" / "books.json").write_text(json.dumps(books, ensure_ascii=False, indent=1) + "\n", encoding="utf-8",
                                                 newline="\n")
    # Files of books that have left the shelf
    slugs = {b["slug"] for b in books}
    for f in [*(ROOT / ".assets" / "books").glob("*.epub"), *(ROOT / ".assets" / "image" / "covers").glob("*.webp")]:
        if f.name.rsplit("-", 1)[0] not in slugs and f.stem not in slugs:
            f.unlink()
            print(f"removed {f.relative_to(ROOT)}")
    size = sum(f.stat().st_size for f in (ROOT / ".assets" / "books").glob("*.epub")) + sum(
        f.stat().st_size for f in (ROOT / ".assets" / "image" / "covers").glob("*.webp"))
    print(f"{len(books)} books, {size / 1e6:.0f} MB of books and covers")
    if capped:
        print(f"{len(capped)} books are read from Standard Ebooks until its download limit resets; run this again later "
              "to keep them here: " + ", ".join(capped))
    if skipped:
        print("Skipped (fix their address in CATALOGUE):\n  " + "\n  ".join(skipped))


if __name__ == "__main__":
    main()

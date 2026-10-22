"""Build the library: every book's details, cover and EPUB, from Standard Ebooks (standardebooks.org).

Standard Ebooks' editions are in the US public domain and its own work is dedicated to the public domain (CC0), so the
books and covers are copied here and served with the site. Downloads are cached in tools/.library-cache and spaced
out, so a re-run only fetches what is new and never hammers their server.

usage: python tools/library.py [--refresh-popularity]   (needs Pillow; writes library/books.json, image/covers/, books/)
Then run tools/build.py to regenerate the pages.
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
CACHE = ROOT / "tools" / ".library-cache"
SE = "https://standardebooks.org/ebooks/"
AGENT = "Mozilla/5.0 (The Bookshelf library builder; https://github.com/Cl0ud-9/Book-Website)"
PAUSE = 2.5  # seconds between requests to standardebooks.org
WIDTHS = (180, 360, 720, 1080)  # covers are 2:3
PUBLISHERS = {"Chapman and Hall", "The Modern Library"}
MAX_EPUB = 8_000_000  # bytes; bigger books stay on Standard Ebooks (see below)

# The shelf: the Standard Ebooks edition of each book and its genres here (theirs have no Romance, for one).
# Every book is in the public domain in the US (Standard Ebooks' rule) and in India (life of the author plus 60 years),
# so authors who died after 1965, such as Agatha Christie, are left out even where Standard Ebooks has them.
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
    ("maurice-leblanc/the-extraordinary-adventures-of-arsene-lupin-gentleman-burglar/george-morehead", ["Mystery"]),
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
    ("seneca/moral-letters-to-lucilius/richard-m-gummere", ["Philosophy"]),
    ("laozi/tao-te-ching/james-legge", ["Philosophy"]),
    ("niccolo-machiavelli/the-prince/w-k-marriott", ["Philosophy"]),
    ("friedrich-nietzsche/beyond-good-and-evil/helen-zimmern", ["Philosophy"]),
    ("friedrich-nietzsche/thus-spake-zarathustra/thomas-common", ["Philosophy"]),
    ("epictetus/discourses/george-long", ["Philosophy"]),
    ("plato/dialogues/benjamin-jowett", ["Philosophy"]),
    ("henry-david-thoreau/walden", ["Philosophy"]),
    ("boethius/the-consolation-of-philosophy/h-r-james", ["Philosophy"]),
    ("mahatma-gandhi/the-story-of-my-experiments-with-truth/mahadev-desai", ["Philosophy"]),
    ("hermann-hesse/siddhartha/various-translators", ["Philosophy", "Literary fiction"]),
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


def main():
    (ROOT / "library").mkdir(exist_ok=True)
    (ROOT / "books").mkdir(exist_ok=True)
    (ROOT / "image" / "covers").mkdir(parents=True, exist_ok=True)
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
        generic = book["title"] in {"Short Fiction", "Poetry", "Short Science Fiction", "Short Works", "Dialogues"}
        book["slug"] = slug_of(f"{book['author']} {book['title']}" if generic else book["title"], taken)
        book["genres"] = genres
        cover = CACHE / f"{key}.jpg"
        if not cover.exists():
            cover.write_bytes(fetch(f"{SE}{se_path}/downloads/cover.jpg", binary=True))
        im = Image.open(cover).convert("RGB")
        book["spine"] = spine_colour(im)
        for w in WIDTHS:
            out = ROOT / "image" / "covers" / f"{book['slug']}-{w}.webp"
            if not out.exists():
                im.resize((w, w * 3 // 2), Image.LANCZOS).save(out, "WEBP", quality=82 if w < 720 else 78, method=6)
        source = f"{SE}{se_path}/downloads/{book['epub_name']}.epub?source=download"
        epub = ROOT / "books" / f"{book['slug']}.epub"
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
        if data is None:
            pass
        elif len(data) > MAX_EPUB:
            # Heavily illustrated editions run to tens of MB: those are read and downloaded from Standard Ebooks itself
            # (its server allows other sites to read its files), so the repository stays small
            epub.unlink(missing_ok=True)
            book["epub"] = source
        else:
            if not epub.exists():
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
    (ROOT / "library" / "books.json").write_text(json.dumps(books, ensure_ascii=False, indent=1) + "\n", encoding="utf-8",
                                                 newline="\n")
    # Files of books that have left the shelf
    slugs = {b["slug"] for b in books}
    for f in [*(ROOT / "books").glob("*.epub"), *(ROOT / "image" / "covers").glob("*.webp")]:
        if f.name.rsplit("-", 1)[0] not in slugs and f.stem not in slugs:
            f.unlink()
            print(f"removed {f.relative_to(ROOT)}")
    size = sum(f.stat().st_size for f in (ROOT / "books").glob("*.epub")) + sum(
        f.stat().st_size for f in (ROOT / "image" / "covers").glob("*.webp"))
    print(f"{len(books)} books, {size / 1e6:.0f} MB of books and covers")
    if capped:
        print(f"{len(capped)} books are read from Standard Ebooks until its download limit resets; run this again later "
              "to keep them here: " + ", ".join(capped))
    if skipped:
        print("Skipped (fix their address in CATALOGUE):\n  " + "\n  ".join(skipped))


if __name__ == "__main__":
    main()

"""Grow the shelf from Project Gutenberg, with nobody choosing: the most downloaded English books there, a few at a time.

Where the hand-chosen Standard Ebooks books (pipeline/grow.py) have genres, moods and ages written for each, these are
worked out from what Gutenberg itself says about a book (its subjects, its shelves, its summary, the years its author
died), the choices err on the cautious side, and the site says so on the book's page (data/gutenberg.json, "auto").

A book is added only if all of these hold:
  - Gutenberg's catalogue lists everyone whose work is in it (the author, and any translator) with the year they died,
    and it was 1965 or before: free in India as well as in the United States (pipeline/rights.py's rule). Anonymous
    books and any with a date missing are left out, because nobody can say who else worked on them.
  - the book is not already on the shelf (the same title by the same author from Standard Ebooks, or taken earlier),
  - its genre shelves give it at least one of this site's genres, and none is of a kind the site leaves out,
  - the file is Gutenberg's text-only EPUB (so there are no illustrations whose artists could not be checked), it is
    a book (at least 5,000 words) and it reads.
Its cover is drawn here (pipeline/covers.py's shapes and the site's own type, in colours chosen from its address), since
Gutenberg's own are plain.

usage: python pipeline/gutenberg_feed.py [N]    adds up to N books (default 10), printing one "added <slug>: <title>" line each.
       Exit codes: 0 added something, 3 nothing new was found, 4 Gutendex or Gutenberg could not be reached.
       Run pipeline/library.py --keep next: it turns the entries added here into books.json.
"""
import hashlib
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import covers as C  # noqa: E402  (the site's cover shapes and fonts)
from names import on_the_shelf, pair, pair_of_path, person  # noqa: E402
import library as L  # noqa: E402
import rights as R  # noqa: E402

from PIL import Image  # noqa: E402

ROOT = L.ROOT
FEED = ROOT / "data" / "gutenberg.json"
SKIPPED = ROOT / "pipeline" / "gutenberg-skipped.json"
CURSOR = ROOT / "pipeline" / "gutenberg-cursor.json"
PAGES = L.CACHE / "gutendex"
AGENT = "TheBookshelf (https://github.com/Cl0ud-9/Book-Website; contact via the repository)"
LIST = "https://gutendex.com/books/?languages=en&page={page}"
MIRROR = "https://gutenberg.pglaf.org/cache/epub/{id}/pg{id}.epub"  # the text-only EPUB, on Project Gutenberg's own mirror
PAUSE = 3.0  # seconds between requests to Gutenberg's mirror
MAX_FAILURES = 4  # downloads failing in a row before the run gives up for the day
EPUBS = L.CACHE / "pg"  # the files fetched, so the same book is never fetched twice
PER_PAGE = 32
MIN_WORDS = 5000
GENERIC = {"Poetry", "Short Fiction", "Short Stories", "Essays", "Letters", "Poems", "Plays", "Works", "Selected Poems"}

# Shelves and subjects of Gutenberg's, and the genre each gives. The first column is looked for in the shelves (their
# "Category: " dropped), the second in the subjects (case does not matter).
SHELF_GENRE = [
    ("romance", "Romance"), ("crime, thrillers", "Mystery"), ("mystery", "Mystery"), ("adventure", "Adventure"),
    ("science-fiction", "Science fiction"), ("science fiction", "Science fiction"), ("horror", "Horror"), ("gothic", "Horror"),
    ("poetry", "Poetry"), ("philosophy", "Philosophy"), ("religion", "Philosophy"), ("biographies", "Lives and memoirs"),
    ("travel writing", "Lives and memoirs"), ("history", "History and politics"), ("politics", "History and politics"),
    ("archaeology", "History and politics"), ("science -", "Science and nature"), ("natural history", "Science and nature"),
    ("essays, letters", "Essays and letters"), ("children", "Children’s"), ("plays/films", "Plays"), ("mythology", "Fantasy"),
    ("humour", "Literary fiction"), ("short stories", "Literary fiction"), ("novels", "Literary fiction"),
    ("classics of literature", "Literary fiction"), ("historical novels", "Literary fiction"), ("historical fiction", "Literary fiction"),
]
SUBJECT_GENRE = [
    ("detective and mystery", "Mystery"), ("ghost stories", "Horror"), ("horror tales", "Horror"), ("fairy tales", "Fantasy"),
    ("fantasy", "Fantasy"), ("love stories", "Romance"), ("science fiction", "Science fiction"), ("sea stories", "Adventure"),
    ("adventure stories", "Adventure"), ("western stories", "Adventure"), ("juvenile fiction", "Children’s"),
    ("juvenile literature", "Children’s"), ("drama", "Plays"), ("poetry", "Poetry"), ("biography", "Lives and memoirs"),
    ("humorous stories", "Literary fiction"),
]
FICTION_ORDER = ["Mystery", "Horror", "Science fiction", "Fantasy", "Adventure", "Romance", "Children’s", "Plays", "Poetry", "Literary fiction"]
NONFICTION_ORDER = ["Lives and memoirs", "History and politics", "Science and nature", "Philosophy", "Essays and letters"]
# what a book of each genre feels like, and what a parent may want to know, until someone reads it and says otherwise
MOODS = {
    "Mystery": ["Gripping"], "Horror": ["Eerie", "Dark"], "Science fiction": ["Adventurous", "Thoughtful"], "Fantasy": ["Adventurous"],
    "Adventure": ["Adventurous", "Gripping"], "Romance": ["Romantic"], "Children’s": ["Heartwarming"], "Plays": ["Thoughtful"],
    "Poetry": ["Thoughtful"], "Literary fiction": ["Thoughtful"], "Lives and memoirs": ["Thoughtful"], "History and politics": ["Thoughtful"],
    "Science and nature": ["Thoughtful"], "Philosophy": ["Thoughtful"], "Essays and letters": ["Thoughtful"],
}
NOTES = {"Mystery": ["violence"], "Horror": ["fear"], "Philosophy": ["ideas"], "History and politics": ["war"]}
# subjects that keep a book off the shelf
DENY = ("erotic", "pornograph", "sexual", "sexology", "prostitut", "occult", "witchcraft", "spiritualism", "cookery", "cookbook",
        "periodical", "encyclopedia", "dictionar", "catalog", "almanac", "textbook", "arithmetic", "grammar")
LATIN = re.compile(r"^[\u0000-ɏ‘’“”–—…•· ]*$")


def pause():
    time.sleep(PAUSE)


def get(url, binary=False, timeout=25):
    request = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")


def page_of(number):
    """Gutendex's list of English books, most downloaded first: 32 to a page; kept, so a page is asked for once"""
    PAGES.mkdir(parents=True, exist_ok=True)
    kept = PAGES / f"en-{number:03}.json"
    if kept.exists():
        return json.loads(kept.read_text(encoding="utf-8"))["results"]
    for attempt in range(3):
        try:
            data = get(LIST.format(page=number), timeout=20)
            results = json.loads(data)["results"]
            kept.write_text(data, encoding="utf-8")
            time.sleep(2.5)
            return results
        except Exception as error:  # Gutendex stalls on some pages for a while
            print(f"gutendex page {number}: {str(error)[:60]} (try {attempt + 1})", flush=True)
            time.sleep(4 * (attempt + 1))
    return None


SMALL = {"a", "an", "the", "of", "in", "on", "and", "or", "but", "for", "to", "at", "by", "with", "from", "as", "nor"}


def short_title(title):
    """"Frankenstein; or, The modern Prometheus" is Frankenstein on the shelf; "…, Complete" is the book; a title Gutenberg set
    in lower case ("Twenty years after") is capitalised as a title is"""
    main = re.split(r";| or,? |\s--\s", title)[0].strip()
    main = re.sub(r",? *\(?\b(complete|illustrated|annotated|unabridged)\b\)?$", "", main, flags=re.I).strip()
    main = re.sub(r"\s+", " ", main).rstrip(".,:;—–- ")
    words = main.split(" ")
    if len(words) > 1 and not any(w[:1].isupper() for w in words[1:] if w.lower() not in SMALL and w != "I"):
        words = [w if (i and w.lower() in SMALL) else w[:1].upper() + w[1:] for i, w in enumerate(words)]
    return " ".join(words)


def free(book):
    """(True, "") when everyone in the book died in time for it to be free in India, else (False, why)"""
    if book.get("copyright") is not False or book.get("media_type") != "Text":
        return False, "not clearly in the public domain"
    if "en" not in book.get("languages", []) or len(book["languages"]) != 1:
        return False, "not English"
    people = [*book["authors"], *book["translators"]]
    if not book["authors"] or any(re.match(r"(various|anonymous|unknown)", a["name"].lower()) for a in book["authors"]):
        return False, "no author named"
    if re.search(r"\bvol(ume)?s?\.? ?[0-9ivx]|\[vol|complete works|works of |collected (works|poems|plays)|\bseries\b|\bpart [0-9ivx]+ of\b",
                 book["title"].lower()):
        return False, "one volume of a set, or a whole set"
    for p in people:
        if p.get("death_year") is None:
            return False, f"{p['name']}: no date of death"
        if p["death_year"] > R.LAST_FREE_DEATH:
            return False, f"{p['name']} died {p['death_year']}"
    return True, ""


def genres_of(book):
    shelves = [s.removeprefix("Category: ").lower() for s in book["bookshelves"]]
    subjects = " | ".join(book["subjects"]).lower()
    if any(word in subjects or word in " ".join(shelves) for word in DENY):
        return None, "a kind of book the shelf leaves out"
    # a genre's weight: two for each of Gutenberg's shelves that says so, one for each of its subjects
    weight = {}
    for needle, genre in SHELF_GENRE:
        weight[genre] = weight.get(genre, 0) + 2 * sum(needle in s for s in shelves)
    for needle, genre in SUBJECT_GENRE:
        weight[genre] = weight.get(genre, 0) + int(needle in subjects)
    weight = {g: w for g, w in weight.items() if w}
    if not weight:
        return None, "no genre of the shelf's"
    tells_fiction = any(s.lower().endswith(("fiction", "stories", "tales")) or "-- fiction" in s.lower() for s in book["subjects"]) or any(
        k in " ".join(shelves) for k in ("novels", "short stories", "adventure", "romance", "children", "plays/", "humour"))
    priority = FICTION_ORDER + NONFICTION_ORDER
    by_weight = sorted(weight, key=lambda g: (-weight[g], priority.index(g)))
    fiction = [g for g in by_weight if g in FICTION_ORDER]
    non = [g for g in by_weight if g in NONFICTION_ORDER]
    # a book is fiction when its shelves and subjects say it tells a story (or when nothing says it is a work of fact), and
    # then its first genre is the one the most say; non-fiction is never also "Literary fiction"
    if fiction and (tells_fiction or not non):
        ordered = fiction  # (a story is not also a work of fact: letters and diaries inside it are not Essays and letters)
    else:
        ordered = non + [g for g in fiction if g == "Poetry"]
    return ordered[:3], ""


def sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z“\"])", re.sub(r"\s+", " ", text).strip()) if s.strip()]


def describe(book, title, author):
    """The abstract (a card's line) and the description, from Gutenberg's own summary where it has one"""
    raw = next((s for s in book.get("summaries", []) if s.strip()), "")
    automatic = "automatically generated" in raw.lower()
    raw = re.sub(r"\s*\(This is an automatically generated summary\.?\)\s*$", "", raw).strip()
    if not raw:
        topic = next((s.split(" -- ")[0] for s in book["subjects"]), "")
        raw = f"{title} by {author}" + (f", on the subject of {topic.lower()}" if topic else "") + "."
        return raw[:140], [raw], False
    parts = sentences(raw)
    # the first sentence usually only says what it is and when it was published; the second says what it is about
    line = parts[1] if len(parts) > 1 and len(parts[0]) < 110 else parts[0]
    if len(line) > 150:
        line = line[:147].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return line, [raw], automatic


def age_of(genres):
    if "Children’s" in genres and "Horror" not in genres:
        return 10
    if genres[0] in NONFICTION_ORDER or genres[0] in ("Poetry",):
        return 13
    return 16


PALETTES = [
    ("#7a1f3d", "#d9a441", "#fff1d6"), ("#1f3a5f", "#3f6fa3", "#fdf1d8"), ("#2d5a3d", "#7fb069", "#fff6e0"), ("#2b1d4e", "#7e5bd6", "#ffe9a8"),
    ("#b63a1a", "#e2702f", "#fff3dc"), ("#0f5e63", "#1c8f8a", "#eafff7"), ("#13294b", "#2b4f86", "#f5e9c8"), ("#3b308f", "#5f50c4", "#ffd24a"),
    ("#5b6b1e", "#8fa133", "#fdf8df"), ("#1b1f3b", "#c7c9d9", "#fff7d6"), ("#6e1414", "#b5301f", "#fbe6c9"), ("#123c3a", "#2f7f73", "#e9fff6"),
    ("#3a2e2a", "#8a6f5a", "#f7ead8"), ("#7a5a1c", "#c49a3a", "#fff5d9"), ("#2c2233", "#6b4f7a", "#f3e6d0"), ("#12343f", "#2a6f7f", "#f1ead6"),
]


def draw_cover(page, slug, title, author):
    """The cover, as pipeline/covers.py draws the hand-made ones, in colours and a motif chosen from the book's address"""
    h = int(hashlib.sha256(slug.encode()).hexdigest(), 16)
    bg, shape, ink = PALETTES[h % len(PALETTES)]
    kind = list(C.SHAPES)[(h // len(PALETTES)) % len(C.SHAPES)]
    size = 150 if len(title) <= 14 else 124 if len(title) <= 26 else 104 if len(title) <= 44 else 84
    html = C.PAGE.format(rubik=C.FONTS["rubik"], figtree=C.FONTS["figtree"], bg=bg, ink=ink, size=size, title=title, author=author,
                         shapes=C.SHAPES[kind].format(shape=shape, bg=bg))
    page.set_content(html)
    page.evaluate("document.fonts.ready.then(() => 1)")
    page.wait_for_timeout(150)
    return Image.open(io.BytesIO(page.locator(".cover").screenshot())).convert("RGB")


def prepare_epub(data, im):
    """Gutenberg's EPUB with its cover picture replaced by the one drawn here (nobody can say who made Gutenberg's: a scan of an
    old binding, or a modern design), and its cover page left out of the pages that are read, so the book opens at its text.
    Nothing else is touched."""
    source = zipfile.ZipFile(io.BytesIO(data))
    opf_name = next(n for n in source.namelist() if n.endswith(".opf"))
    opf = source.read(opf_name).decode("utf-8")
    base = opf_name.rsplit("/", 1)[0] + "/" if "/" in opf_name else ""
    items = {i: h for i, h in re.findall(r'<item[^>]*?id="([^"]+)"[^>]*?href="([^"]+)"', opf)}
    items.update({i: h for h, i in re.findall(r'<item[^>]*?href="([^"]+)"[^>]*?id="([^"]+)"', opf)})
    named = re.search(r'<meta[^>]*name="cover"[^>]*content="([^"]+)"', opf) or re.search(r'<meta[^>]*content="([^"]+)"[^>]*name="cover"', opf)
    cover = base + items[named.group(1)] if named and named.group(1) in items else next(
        (n for n in source.namelist() if re.search(r"cover[^/]*\.(jpe?g|png)$", n, re.I)), None)
    jpeg = io.BytesIO()
    im.resize((720, 1080), Image.LANCZOS).save(jpeg, "JPEG", quality=85, optimize=True)
    # the cover's own page (a wrapper around the picture) is not one to read
    wrappers = {i for i, h in items.items() if re.search(r"(^|/)(wrap\d*|cover(page)?(-wrapper)?)\.x?html?$", h, re.I) or i == "coverpage-wrapper"}

    def not_linear(tag):
        found = re.search(r'idref="([^"]+)"', tag.group(0))
        if not found or found.group(1) not in wrappers:
            return tag.group(0)
        return re.sub(r"\s+linear=\"[^\"]*\"", "", tag.group(0)).replace("<itemref", '<itemref linear="no"', 1)

    opf = re.sub(r"<itemref[^>]*>", not_linear, opf)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as target:
        target.writestr(zipfile.ZipInfo("mimetype"), source.read("mimetype"), compress_type=zipfile.ZIP_STORED)  # first, uncompressed
        for item in source.infolist():
            if item.filename == "mimetype":
                continue
            body = source.read(item.filename)
            if item.filename == cover:
                body = jpeg.getvalue()
            elif item.filename == opf_name:
                body = opf.encode("utf-8")
            target.writestr(item.filename, body, compress_type=zipfile.ZIP_DEFLATED)
    return out.getvalue()


def read_epub(data):
    """(words, None) for an EPUB that is a book, else (0, why)"""
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
        opf = next(n for n in archive.namelist() if n.endswith(".opf"))
        archive.read(opf)
        pages = [n for n in archive.namelist() if n.endswith((".xhtml", ".html", ".htm"))]
        text = " ".join(L.text(archive.read(n).decode("utf-8", "ignore")) for n in pages)
    except Exception as error:
        return 0, f"the file does not read ({str(error)[:40]})"
    start, end = text.find("*** START OF"), text.find("*** END OF")
    body = text[start:end] if 0 <= start < end else text
    words = len(re.findall(r"\w+", body))
    return (words, None) if words >= MIN_WORDS else (words, f"only {words} words")


def main():
    wanted = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    feed = json.loads(FEED.read_text(encoding="utf-8"))
    skipped = json.loads(SKIPPED.read_text(encoding="utf-8")) if SKIPPED.exists() else {}
    cursor = json.loads(CURSOR.read_text(encoding="utf-8")) if CURSOR.exists() else {"page": 1}
    shelf = json.loads((ROOT / "data" / "books.json").read_text(encoding="utf-8"))
    taken = {b["slug"] for b in shelf} | {e["slug"] for e in feed if e.get("slug")}
    have_ids = {e["id"] for e in feed} | {int(k) for k in skipped}
    have_titles = {pair(b["title"], b["author"]) for b in shelf}
    queue = ROOT / "pipeline" / "queue.json"  # the hand-chosen books still to come from Standard Ebooks: those editions are better
    have_titles |= {pair_of_path(e["path"]) for e in (json.loads(queue.read_text(encoding="utf-8")) if queue.exists() else [])}
    added, unreachable, scanned, failures, halted = [], 0, 0, 0, False
    (ROOT / ".assets" / "books").mkdir(parents=True, exist_ok=True)
    (ROOT / ".assets" / "image" / "covers").mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = None
        number = cursor["page"]
        while len(added) < wanted and number < 400 and not halted:
            results = page_of(number)
            if results is None:
                unreachable += 1
                number += 1
                if unreachable >= 5 and not added:
                    break
                continue
            if not results:
                break
            for rank, book in enumerate(results, (number - 1) * PER_PAGE + 1):
                if len(added) >= wanted:
                    break
                if book["id"] in have_ids:
                    continue
                scanned += 1
                ok, why = free(book)
                genres = None
                if ok:
                    genres, why = genres_of(book)
                    ok = genres is not None
                title = short_title(book["title"])
                author = " and ".join(person(a["name"]) for a in book["authors"]) if book["authors"] else ""
                if ok and on_the_shelf(title, book["authors"][0]["name"], have_titles):
                    ok, why = False, "already on the shelf"
                if ok and not LATIN.match(title + author):
                    ok, why = False, "letters the site's fonts do not have"
                if not ok:
                    skipped[str(book["id"])] = why
                    have_ids.add(book["id"])
                    continue
                # the file: kept once fetched (a book is asked of Gutenberg once), and after a few failures in a row the run stops:
                # a server that is refusing is not asked again by the next hundred books
                kept = EPUBS / f"{book['id']}.epub"
                if kept.exists():
                    data = kept.read_bytes()
                else:
                    try:
                        data = get(MIRROR.format(id=book["id"]), binary=True, timeout=60)
                    except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
                        print(f"#{book['id']} {title}: {error}", flush=True)
                        unreachable += 1
                        failures += 1
                        if failures >= MAX_FAILURES:
                            print(f"{failures} failures in a row: Project Gutenberg is not answering, so the run stops here", flush=True)
                            halted = True
                            break
                        pause()
                        continue
                    failures = 0
                    EPUBS.mkdir(parents=True, exist_ok=True)
                    kept.write_bytes(data)
                    pause()
                words, problem = read_epub(data)
                if problem or len(data) > L.MAX_EPUB:
                    skipped[str(book["id"])] = problem or "too heavy"
                    have_ids.add(book["id"])
                    continue
                name = f"{author} {title}" if title in GENERIC else title
                slug = L.slug_of(name, taken)
                if browser is None:
                    browser = p.chromium.launch(channel="chrome")
                    cover_page = browser.new_page(viewport={"width": 1080, "height": 1620})
                im = draw_cover(cover_page, slug, title, author)
                for w in L.WIDTHS:
                    im.resize((w, w * 3 // 2), Image.LANCZOS).save(ROOT / ".assets" / "image" / "covers" / f"{slug}-{w}.webp", "WEBP",
                                                                  quality=82 if w < 720 else 78, method=6)
                data = prepare_epub(data, im)
                (ROOT / ".assets" / "books" / f"{slug}.epub").write_bytes(data)
                abstract, description, automatic = describe(book, title, author)
                moods = list(dict.fromkeys(m for g in genres for m in MOODS[g]))[:3]
                if any("humo" in s.lower() for s in [*book["bookshelves"], *book["subjects"]]):
                    moods = list(dict.fromkeys(["Funny", *moods]))[:3]
                entry = {
                    "id": book["id"], "title": title, "author": author, "slug": slug, "rank": rank,
                    "translator": " and ".join(person(t["name"]) for t in book["translators"]) or None,
                    "genres": genres, "collections": [], "abstract": abstract,
                    # said plainly where a machine wrote it
                    "description": [*description, "This description comes from Project Gutenberg’s catalogue, where an automatic tool wrote it."] if automatic else description,
                    "words": words, "spine": L.spine_colour(im), "size": len(data), "auto": True,
                    "moods": moods, "age": age_of(genres), "notes": list(dict.fromkeys(n for g in genres for n in NOTES.get(g, []))),
                    "people": [{"name": person(a["name"]), "roles": ["author"], "died": a["death_year"]} for a in book["authors"]]
                              + [{"name": person(t["name"]), "roles": ["translator"], "died": t["death_year"]} for t in book["translators"]],
                }
                feed.append(entry)
                taken.add(slug)
                have_ids.add(book["id"])
                have_titles.add(pair(title, book["authors"][0]["name"]))
                added.append(entry)
                print(f"added {slug}: {title} by {author} (Project Gutenberg #{book['id']}, rank {rank})", flush=True)
            cursor["page"] = max(1, number)
            number += 1
        if browser:
            browser.close()
    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    SKIPPED.write_text(json.dumps(dict(sorted(skipped.items(), key=lambda kv: int(kv[0]))), ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    CURSOR.write_text(json.dumps(cursor) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(added)} added from Project Gutenberg ({scanned} looked at, {len(skipped)} set aside in all)", flush=True)
    if not added:
        sys.exit(4 if unreachable else 3)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

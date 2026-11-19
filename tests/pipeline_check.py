"""The rules the automatic growth of the shelf depends on (pipeline/names.py, pipeline/gutenberg_feed.py, pipeline/grow.py):
how a name is written, when two books are the same one, who counts as free in India, which genres a book gets, and that the
EPUB a book is kept as is the original with only its cover and cover page changed. No network and no browser.

usage: python tests/pipeline_check.py     (needs Pillow, and Playwright's Python package only to be imported)
"""
import io
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import gutenberg_feed as F  # noqa: E402
import names as N  # noqa: E402
import rights as R  # noqa: E402
from PIL import Image  # noqa: E402

bad = 0


def check(ok, message):
    global bad
    bad += not ok
    print(("ok  " if ok else "BUG ") + message)


# ---- how a name is written
for given, shown in (("Austen, Jane", "Jane Austen"), ("Marcus Aurelius, Emperor of Rome", "Marcus Aurelius"), ("Tolstoy, Leo, graf", "Leo Tolstoy"),
                     ("Doyle, Arthur Conan, Sir", "Arthur Conan Doyle"), ("Smollett, T. (Tobias)", "Tobias Smollett"), ("Homer", "Homer"),
                     ("Aurelius, Marcus, Emperor of Rome", "Marcus Aurelius"), ("Van Dyke, Henry", "Henry Van Dyke")):
    check(N.person(given) == shown, f"{given!r} is written {shown!r} (not {N.person(given)!r})")

# ---- a title
for given, shown in (("Frankenstein; or, The modern Prometheus", "Frankenstein"), ("The Adventures of Tom Sawyer, Complete", "The Adventures of Tom Sawyer"),
                     ("Twenty years after", "Twenty Years After"), ("The Adventures of Ferdinand Count Fathom —", "The Adventures of Ferdinand Count Fathom"),
                     ("Pride and Prejudice", "Pride and Prejudice"), ("Barry Locke, half-back", "Barry Locke, half-back")):
    check(F.short_title(given) == shown, f"the title {given!r} is {shown!r} (not {F.short_title(given)!r})")

# ---- the same book, or not
have = {N.pair("Crime and Punishment", "Fyodor Dostoevsky"), N.pair("Meditations", "Marcus Aurelius"), N.pair("The Enchanted April", "Elizabeth von Arnim"),
        N.pair("Narrative of the Life of Frederick Douglass", "Frederick Douglass"), N.pair("Hamlet", "William Shakespeare"), N.pair_of_path("jane-austen/emma")}
for title, author, same in (("Crime and Punishment", "Dostoyevsky, Fyodor", True), ("Meditations", "Marcus Aurelius, Emperor of Rome", True),
                            ("The Enchanted April", "Von Arnim, Elizabeth", True), ("Narrative of the Life of Frederick Douglass, an American Slave", "Douglass, Frederick", True),
                            ("Hamlet", "Shakespeare, William", True), ("Macbeth", "Shakespeare, William", False), ("Emma", "Austen, Jane", True),
                            ("Persuasion", "Austen, Jane", False), ("Meditations", "Descartes, René", False), ("Crime and Punishment", "Someone, Else", False)):
    check(N.on_the_shelf(title, author, have) == same, f"{title} by {author}: {'the same book as one here' if same else 'a different book'}")
check(N.pair_of_path("jane-austen/pride-and-prejudice") == ("pride and prejudice", "austen"), "a Standard Ebooks address stands for its title and surname")
check(N.pair_of_path("h-g-wells/the-time-machine/x-y")[1] == "wells", "a Standard Ebooks address with a translator names the author")


# ---- free in India: everyone named died in 1965 or before
def record(**more):
    base = {"id": 1, "title": "A Book", "authors": [{"name": "Writer, A.", "birth_year": 1800, "death_year": 1880}], "translators": [], "subjects": [],
            "bookshelves": [], "languages": ["en"], "copyright": False, "media_type": "Text", "summaries": [], "download_count": 1}
    base.update(more)
    return base


last = R.LAST_FREE_DEATH
check(F.free(record())[0], "an author who died in 1880 is free")
check(F.free(record(authors=[{"name": "Writer, A.", "death_year": last}]))[0], f"an author who died in {last} is free")
check(not F.free(record(authors=[{"name": "Writer, A.", "death_year": last + 1}]))[0], f"an author who died in {last + 1} is not")
check(not F.free(record(authors=[{"name": "Writer, A.", "death_year": None}]))[0], "an author with no date of death is not")
check(not F.free(record(translators=[{"name": "Translator, T.", "death_year": 1990}]))[0], "a translator who died in 1990 makes it not free")
check(not F.free(record(translators=[{"name": "Translator, T.", "death_year": None}]))[0], "a translator with no date of death makes it not free")
check(F.free(record(translators=[{"name": "Translator, T.", "death_year": 1946}]))[0], "a translator who died in 1946 is fine")
check(not F.free(record(authors=[]))[0] and not F.free(record(authors=[{"name": "Anonymous", "death_year": None}]))[0], "an anonymous book is not")
check(not F.free(record(authors=[{"name": "Various", "death_year": 1900}]))[0], "'Various' is not an author")
check(not F.free(record(copyright=True))[0] and not F.free(record(copyright=None))[0], "a book not clearly out of copyright is not free")
check(not F.free(record(languages=["fr"]))[0] and not F.free(record(languages=["en", "fr"]))[0], "only English books")
check(not F.free(record(media_type="Sound"))[0], "only text")
for title in ("The Complete Works of William Shakespeare", "The Works of Charles Dickens [Vol. 5 of 9]", "Poems, Volume 2", "A Series of Tales"):
    check(not F.free(record(title=title))[0], f"{title!r} is not one book")

# ---- genres, from Gutenberg's shelves and subjects
novel = record(bookshelves=["Category: Novels", "Category: British Literature", "Category: Classics of Literature"], subjects=["Love stories", "England -- Fiction"])
check(F.genres_of(novel)[0][0] == "Literary fiction" and "Romance" in F.genres_of(novel)[0], f"a classic novel is Literary fiction first ({F.genres_of(novel)[0]})")
phil = record(bookshelves=["Category: Philosophy & Ethics"], subjects=["Stoics", "Conduct of life"])
check(F.genres_of(phil)[0] == ["Philosophy"], f"a work of philosophy is Philosophy ({F.genres_of(phil)[0]})")
check("Literary fiction" not in F.genres_of(record(bookshelves=["Category: Biographies", "Category: Novels"], subjects=["Biography"]))[0][1:], "non-fiction is not also Literary fiction")
check(F.genres_of(record(bookshelves=["Category: Encyclopedias/Dictionaries/Reference"]))[0] is None, "a reference book has no genre of the shelf's")
check(F.genres_of(record(bookshelves=["Category: Novels"], subjects=["Erotic fiction"]))[0] is None, "a kind of book the shelf leaves out is left out")
letters = record(bookshelves=["Category: Novels"], subjects=["Epistolary fiction", "Letters -- Fiction"])
check(all(g in F.FICTION_ORDER for g in F.genres_of(letters)[0]), "a story told in letters is not Essays and letters")
check(F.age_of(["Children’s", "Fantasy"]) == 10 and F.age_of(["Literary fiction"]) == 16 and F.age_of(["Philosophy"]) == 13, "ages err on the cautious side")

# ---- the EPUB a book is kept as: the original, with its cover and cover page changed
buffer = io.BytesIO()
opf = """<?xml version="1.0"?><package><metadata><meta name="cover" content="item0"/></metadata><manifest>
<item href="cover.jpg" id="item0" media-type="image/jpeg"/><item href="wrap0000.html" id="coverpage-wrapper" media-type="application/xhtml+xml"/>
<item href="ch1.html" id="item1" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="coverpage-wrapper" linear="yes"/><itemref idref="item1" linear="yes"/></spine></package>"""
with zipfile.ZipFile(buffer, "w") as z:
    z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
    z.writestr("META-INF/container.xml", "<container/>")
    z.writestr("OEBPS/content.opf", opf)
    z.writestr("OEBPS/cover.jpg", b"the original cover")
    z.writestr("OEBPS/wrap0000.html", "<html><body><img src='cover.jpg'/></body></html>")
    z.writestr("OEBPS/ch1.html", "<html><body><p>The text.</p></body></html>")
cover = Image.new("RGB", (1080, 1620), (200, 30, 30))
made = zipfile.ZipFile(io.BytesIO(F.prepare_epub(buffer.getvalue(), cover)))
names = made.namelist()
check(names[0] == "mimetype" and made.getinfo("mimetype").compress_type == zipfile.ZIP_STORED, "the EPUB still starts with its mimetype, stored")
check(made.read("OEBPS/cover.jpg")[:2] == b"\xff\xd8", "the cover picture is the one drawn here (a JPEG)")
check(made.read("OEBPS/ch1.html") == b"<html><body><p>The text.</p></body></html>", "the text is untouched")
package = made.read("OEBPS/content.opf").decode("utf-8")
check(re.search(r'<itemref[^>]*idref="coverpage-wrapper"[^>]*linear="no"', package) is not None or re.search(r'<itemref linear="no"[^>]*idref="coverpage-wrapper"', package) is not None,
      "the cover page is not one of the pages that are read")
check(re.search(r'<itemref[^>]*idref="item1"[^>]*linear="yes"', package) is not None, "the text is")

print("failures:", bad)
sys.exit(1 if bad else 0)

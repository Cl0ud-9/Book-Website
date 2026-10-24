"""Check every quote in library/quotes.json is in our edition of its book, word for word, and note where.

Quotes on the site come from our own copies of the books, so each one can open the reader at that very line. This finds
each quote in the book's EPUB (curly or straight quotes, dashes and line breaks do not matter, as in the reader), writes
the chapter file it is in ("in") and how far into the book that is ("at", 0 to 1) back into library/quotes.json, and
reports any it cannot find. The build shows only quotes that were found, from the first 70% of their book.

usage: python tools/quotes.py      then python tools/build.py
"""
import html
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".library-cache"


def loose(text):
    text = re.sub("[\u2060\ufeff\u200b]", "", unicodedata.normalize("NFKC", text))  # invisible joiners around dashes
    text = re.sub(r"[‘’ʼ]", "'", text)
    text = re.sub(r"[“”]", '"', text)
    text = re.sub(r"[‐-―]", "-", text)
    return re.sub(r"\s+", " ", text).strip()


def chapters(epub):
    """(file, text) for each file of the book in reading order, the file named as the reader's spine names it."""
    z = zipfile.ZipFile(epub)
    opf_name = next(n for n in z.namelist() if n.endswith(".opf"))
    opf = z.read(opf_name).decode("utf-8")
    base = str(Path(opf_name).parent).replace("\\", "/")
    items = dict(re.findall(r'<item\b[^>]*?id="([^"]+)"[^>]*?href="([^"]+)"', opf))
    items.update({i: h for h, i in re.findall(r'<item\b[^>]*?href="([^"]+)"[^>]*?id="([^"]+)"', opf)})
    for idref in re.findall(r'<itemref\b[^>]*idref="([^"]+)"', opf):
        href = items.get(idref)
        if not href:
            continue
        path = f"{base}/{href}" if base not in ("", ".") else href
        raw = z.read(path).decode("utf-8", "ignore")
        body = re.sub(r"<[^>]+>", "", re.sub(r"<(script|style)\b.*?</\1>", "", raw, flags=re.S))
        yield href, loose(html.unescape(body))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    source = ROOT / "library" / "quotes.json"
    quotes = json.loads(source.read_text(encoding="utf-8"))
    library = {b["slug"]: b for b in json.loads((ROOT / "library" / "books.json").read_text(encoding="utf-8"))}
    found = missing = 0
    for slug, items in quotes.items():
        if slug.startswith("_"):
            continue
        book = library.get(slug)
        epub = ROOT / book["epub"] if book and not book["epub"].startswith("http") else None
        if book and not epub and book.get("standard_ebooks"):
            # a big book read from Standard Ebooks: tools/library.py keeps its file in the cache
            epub = CACHE / (book["standard_ebooks"].split("/ebooks/", 1)[1].replace("/", "_") + ".epub")
        if not epub or not epub.exists():
            print(f"no local copy of {slug}; its quotes are left as they are")
            continue
        texts = list(chapters(epub))
        total = sum(len(text) for _, text in texts) or 1
        for quote in items:
            want = loose(quote["text"])
            where = next((n for n, (href, text) in enumerate(texts) if want in text), None)
            if where is not None:
                quote["in"] = texts[where][0]
                # how far into the book, by its words: the site leaves out lines from the last part, so opening one never
                # lands near the ending
                before = sum(len(text) for _, text in texts[:where]) + texts[where][1].find(want)
                quote["at"] = round(before / total, 2)
                found += 1
            else:
                quote.pop("in", None)
                missing += 1
                print(f"NOT FOUND  {slug}: {quote['text']}")
    source.write_text(json.dumps(quotes, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{found} quotes found in their books, {missing} not found (left off the site)")


if __name__ == "__main__":
    main()

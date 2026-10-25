"""Find a free audiobook of each book on LibriVox, whose volunteers' recordings are in the public domain.

usage: python pipeline/listen.py      writes data/librivox.json ({ book: page on librivox.org }); then run npm run build

Each book is looked up once, slowly, and the answers are cached in pipeline/.library-cache. A recording counts only when it
is in English and its author's surname matches ours, so a different book of the same name is never linked.
"""
import json
import re
import time
import unicodedata
from difflib import SequenceMatcher
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".library-cache" / "librivox"
OUT = ROOT / "data" / "librivox.json"
AGENT = "TheBookshelf/3 (https://cl0ud-9.github.io/Book-Website/)"


def plain(text):
    text = text.lower().replace("’", "'").replace("‘", "'")
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def search(title):
    CACHE.mkdir(parents=True, exist_ok=True)
    file = CACHE / (re.sub(r"[^a-z0-9]+", "-", plain(title)).strip("-") + ".json")
    if file.exists():
        return json.loads(file.read_text(encoding="utf-8"))
    query = urllib.parse.urlencode({"title": "^" + title, "format": "json", "fields": "{id,title,url_librivox,language,authors,totaltimesecs}"})
    request = urllib.request.Request(f"https://librivox.org/api/feed/audiobooks/?{query}", headers={"User-Agent": AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        data = {"books": []} if error.code == 404 else None  # LibriVox answers 404 when nothing matches
    if data is None:
        return []
    books = data.get("books") or []
    file.write_text(json.dumps(books), encoding="utf-8")
    time.sleep(1.5)
    return books


def bare(title):
    # LibriVox files "The Scarlet Letter" as "Scarlet Letter", and adds "(version 2)" to later recordings
    title = plain(re.split(r"[:;(]", title)[0]).strip()
    return re.sub(r"^(the|a|an) ", "", title)


def surname(author):
    return plain(author.split(",")[0].split(" and ")[0].strip().split()[-1])


def main():
    library = json.loads((ROOT / "data" / "books.json").read_text(encoding="utf-8"))
    found = {}
    for book in library:
        # "Pride and Prejudice" and "The Adventures of Sherlock Holmes" are searched as they are; a subtitle is dropped
        title = re.split(r"[:;]", book["title"])[0].strip()
        want = surname(book["author"])
        matches = [r for r in search(re.sub(r"^(The|A|An) ", "", title))
                   if r.get("language") == "English" and r.get("url_librivox")
                   # spellings vary between editions: Dostoevsky, Dostoyevsky
                   and any(SequenceMatcher(None, plain(a.get("last_name", "")).split()[-1] if a.get("last_name") else "", want).ratio() > 0.8
                           for a in r.get("authors", []))
                   and bare(r["title"]) == bare(title)]
        if matches:
            # the most complete recording: the longest, as some are single chapters or abridged
            best = max(matches, key=lambda r: int(r.get("totaltimesecs") or 0))
            found[book["slug"]] = best["url_librivox"]
        print(f"{'found' if matches else 'none '}  {book['title']}")
    OUT.write_text(json.dumps(found, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(found)} of {len(library)} books have a LibriVox recording")


if __name__ == "__main__":
    main()

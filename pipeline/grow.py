"""Grow the shelf by itself: take the next books from pipeline/queue.json and add them to the catalogue.

The queue is written ahead of time, by hand: the next of Standard Ebooks' most read, each already given its genres,
moods, suggested age and notes (the judgments a script should not make). This script does the mechanical part: fetch
the book, check that everyone whose work is in it died in time for it to be free in India (pipeline/rights.py), and
only then write it into CATALOGUE in pipeline/library.py, data/moods.json, data/ages.json (the README's count is kept by pipeline/readme_count.py).
A book that is not clearly free is set aside in pipeline/queue-skipped.json, with who blocked it, and the next book
in the queue takes its place. The daily workflow (.github/workflows/grow.yml) runs this, then pipeline/library.py
--keep and the build, so new books appear without anyone at the keyboard.

usage: python pipeline/grow.py [N]    adds up to N books (default 2), printing one "added <slug>: <title>" line each.
       Exit codes: 0 added something (or had nothing to do but the queue moved), 3 the queue is empty,
       4 Standard Ebooks' download cap stopped the run before anything was added. Run pipeline/library.py --keep next.
"""
import json
import sys
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import library as L  # noqa: E402  (the shelf's own fetcher, parser and slugs, so a book is read one way only)
import rights as R  # noqa: E402
from names import on_the_shelf, pair  # noqa: E402

ROOT = L.ROOT
QUEUE = ROOT / "pipeline" / "queue.json"
SKIPPED = ROOT / "pipeline" / "queue-skipped.json"
MARK = '    # pipeline/grow.py adds the next books from pipeline/queue.json above this line\n'
GENERIC = {"Short Fiction", "Poetry", "Short Science Fiction", "Short Works", "Dialogues", "Essays"}
LOW = 10  # with fewer than this many books left, the workflow opens an issue asking for a refill


def read_keep_newlines(path):
    """The file's text as \\n, and the newline to write it back with (the repo may sit on Windows or Linux)."""
    with open(path, encoding="utf-8", newline="") as f:  # (Path.read_text has no newline option before Python 3.13)
        raw = f.read()
    return raw.replace("\r\n", "\n"), ("\r\n" if "\r\n" in raw else "\n")


def write_json(path, value):
    """data/moods.json and data/ages.json style: one line per book, "_about" first."""
    about = value.pop("_about")
    lines = [f' "_about": {json.dumps(about, ensure_ascii=False)}']
    lines += [f' {json.dumps(key)}: {json.dumps(value[key], ensure_ascii=False)}' for key in value]
    path.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8", newline="\n")


def fetch_and_clear(wanted):
    """Walk the queue: fetch each book and check its rights, until `wanted` books are cleared or the queue ends."""
    queue = json.loads(QUEUE.read_text(encoding="utf-8"))
    skipped = json.loads(SKIPPED.read_text(encoding="utf-8")) if SKIPPED.exists() else []
    shelf = json.loads((ROOT / "data" / "books.json").read_text(encoding="utf-8"))
    taken = {b["slug"] for b in shelf}
    here = {pair(b["title"], b["author"]) for b in shelf if b.get("gutenberg")}  # (a Standard Ebooks edition replaces nothing, so only these)
    added, capped = [], False
    while queue and len(added) < wanted:
        entry = queue[0]
        key = entry["path"].replace("/", "_")
        try:
            page = L.cached(f"{key}.html", L.SE + entry["path"])
            book = L.parse(page, entry["path"])
            L.cached(f"{key}.epub", f"{L.SE}{entry['path']}/downloads/{book['epub_name']}.epub?source=download", binary=True)
        except urllib.error.HTTPError as error:
            if error.code == 429:  # Standard Ebooks' download cap: stop here, the next run carries on
                capped = True
                break
            queue.pop(0)
            skipped.append({**entry, "why": f"HTTP {error.code}"})
            print(f"skipped {entry['path']}: HTTP {error.code}", flush=True)
            continue
        except Exception as error:  # a moved or renamed edition: set it aside rather than stall the queue
            queue.pop(0)
            skipped.append({**entry, "why": str(error)[:200]})
            print(f"skipped {entry['path']}: {error}", flush=True)
            continue
        queue.pop(0)
        if on_the_shelf(book["title"], book["author"], here):
            skipped.append({**entry, "why": "already on the shelf (from Project Gutenberg)"})
            print(f"skipped {entry['path']}: already on the shelf", flush=True)
            continue
        verdict = R.check(L.CACHE / f"{key}.epub")
        if not verdict["free"]:
            who = "; ".join(f"{p['name']} ({', '.join(p['roles'])}, died {p.get('died') or 'unknown'})"
                            for p in verdict["people"] if not p["free"])
            skipped.append({**entry, "why": who})
            print(f"skipped {entry['path']}: {who}", flush=True)
            continue
        # the slug exactly as pipeline/library.py will make it, collections and all in catalogue order
        name = f"{book['author']} {book['title']}" if book["title"] in GENERIC else book["title"]
        added.append({**entry, "slug": L.slug_of(name, taken), "title": book["title"], "author": book["author"]})
        print(f"added {added[-1]['slug']}: {book['title']} by {book['author']}", flush=True)
    return queue, skipped, added, capped


def main():
    wanted = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    queue, skipped, added, capped = fetch_and_clear(wanted)
    if added:
        # the catalogue, above the marker line
        path = ROOT / "pipeline" / "library.py"
        text, newline = read_keep_newlines(path)
        assert text.count(MARK) == 1, "the grow marker is missing from CATALOGUE"
        lines = "".join(f'    ("{b["path"]}", {json.dumps(b["genres"], ensure_ascii=False)}),\n' for b in added)
        path.write_text(text.replace(MARK, lines + MARK).replace("\n", newline), encoding="utf-8", newline="")
        # each book's moods, and its suggested age and notes (ages.json stays alphabetical)
        moods = json.loads((ROOT / "data" / "moods.json").read_text(encoding="utf-8"))
        for b in added:
            moods[b["slug"]] = b["moods"]
        write_json(ROOT / "data" / "moods.json", moods)
        ages = json.loads((ROOT / "data" / "ages.json").read_text(encoding="utf-8"))
        for b in added:
            ages[b["slug"]] = {"age": b["age"], "notes": b["notes"]}
        write_json(ROOT / "data" / "ages.json", {"_about": ages.pop("_about"), **{k: ages[k] for k in sorted(ages)}})
    QUEUE.write_text(json.dumps(queue, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    if skipped:
        SKIPPED.write_text(json.dumps(skipped, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(added)} added, {len(queue)} waiting in the queue", flush=True)
    if len(queue) < LOW:
        print(f"QUEUE LOW: {len(queue)} left", flush=True)
    if not added:
        sys.exit(4 if capped else 3)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

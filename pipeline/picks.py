"""Choose the book of the month for the year ahead and write them into data/picks.json, each with a line saying why.

Every book that can be a pick (one with a known opening line, which the home page prints) gets a score for each month:

  how much it is read    Standard Ebooks' popularity ranking (35%) and, from Open Library, how many people have read
                         it, are reading it or want to, and how they rate it (25%)
  interest right now     its Wikipedia article's views over the last month against the three before (10%)
  the time of year       a day that belongs to a book or its author counts most (Shakespeare in April: World Book
                         Day, 23 April, is his birthday and the day he died; Tagore in May, born 7 May; A Christmas
                         Carol in December), then the season's kind of book (February love stories, summer
                         adventures, October ghost stories), then its mood (cosy books for December evenings)
  what readers here do   once the site counts (GoatCounter, with GOATCOUNTER and GOATCOUNTER_TOKEN set), how many who
                         open a book reach its second chapter and its end; it counts for more as more people read,
                         n / (n + 200) of the score for a book opened n times

and then the best is taken month by month under four rules: no book twice within twelve months, no author twice within
six, never the same genre two months running, and a short book (under four hours) every third month, so a busy month
has something to finish. Ties go to the book first in the alphabet, so the same data always gives the same picks.
Months already in picks.json that have begun are never changed. Answers from Open Library and Wikipedia are kept in
pipeline/.picks-cache for a week.

usage: python pipeline/picks.py [--months 12]   then npm run build
"""
import datetime
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".picks-cache"
AGENT = "TheBookshelf/1.0 (book-of-the-month picker; https://github.com/Cl0ud-9/Book-Website)"
WEEK = 7 * 24 * 3600
SHORT = 240  # minutes: a short book
WEIGHTS = {"rank": 0.35, "openlibrary": 0.25, "momentum": 0.10}
DAY, KIND, MOOD = 0.6, 0.3, 0.15  # how much the time of year adds: a book's own day, the season's kind of book, its mood

# The time of year: (month, how much, why, which books fit); a book takes the first that fits it
SEASONS = [
    (2, KIND, "a love story for February", lambda b: "Romance" in b["genres"]),
    (4, DAY, "for World Book Day on 23 April, Shakespeare’s birthday", lambda b: b["author"] == "William Shakespeare"),
    (5, DAY, "for Rabindranath Tagore’s birthday on 7 May", lambda b: b["author"] == "Rabindranath Tagore"),
    (7, KIND, "an adventure for the summer holidays", lambda b: "Adventure" in b["genres"]),
    (8, KIND, "an adventure for the summer holidays", lambda b: "Adventure" in b["genres"]),
    (10, KIND, "a ghost story for October and Halloween", lambda b: "Horror" in b["genres"]),
    (12, DAY, "the Christmas story, for December", lambda b: b["slug"] == "a-christmas-carol"),
    (12, MOOD, "a book for long winter evenings", lambda b: bool({"Cosy", "Heartwarming"} & set(b.get("moods", [])))),
]


def plain(text):
    return re.sub(r"[^a-z0-9 ]", "", unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode())


def fetch(url, name):
    """JSON from url, kept in pipeline/.picks-cache/<name> for a week; None if the site does not answer."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (re.sub(r"[^a-z0-9.-]+", "_", name.lower())[:150] + ".json")
    if path.exists() and time.time() - path.stat().st_mtime < WEEK:
        return json.loads(path.read_text(encoding="utf-8"))
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": AGENT}), timeout=30) as response:
            data = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        print(f"  no answer from {urllib.parse.urlsplit(url).netloc} for {name}: {error}")
        return None
    path.write_text(json.dumps(data), encoding="utf-8")
    time.sleep(0.5)  # politely
    return data


def open_library(book):
    """(readers, rating, ratings) on Open Library: how many have read it, are reading it or want to, and its stars."""
    query = urllib.parse.urlencode({"title": book["title"], "author": book["author"], "limit": 3,
                                    "fields": "title,ratings_average,ratings_count,already_read_count,currently_reading_count,want_to_read_count"})
    data = fetch(f"https://openlibrary.org/search.json?{query}", f"ol-{book['slug']}")
    docs = [d for d in (data or {}).get("docs", []) if plain(d.get("title", "")).startswith(plain(book["title"])[:20])]
    if not docs:
        return 0, None, 0
    best = max(docs, key=lambda d: d.get("already_read_count", 0) + d.get("want_to_read_count", 0))
    readers = best.get("already_read_count", 0) + best.get("currently_reading_count", 0) + best.get("want_to_read_count", 0)
    return readers, best.get("ratings_average"), best.get("ratings_count", 0)


def wikipedia_momentum(book, today):
    """Views of the book's Wikipedia article in the last 30 days against the 90 before (1 = steady), or None."""
    if re.search(r"Short Fiction|Poetry|Short Works|Essays|Dialogues|Stories", book["title"]):
        return None  # collections have no article of their own
    query = urllib.parse.urlencode({"action": "query", "list": "search", "srsearch": f'{book["title"]} {book["author"]}',
                                    "srlimit": 5, "format": "json"})
    found = fetch(f"https://en.wikipedia.org/w/api.php?{query}", f"wp-{book['slug']}")
    titles = [r["title"] for r in (found or {}).get("query", {}).get("search", [])]
    # the article named after the book itself, "(novel)" and the like allowed
    article = next((t for t in titles if plain(re.sub(r"\s*\(.*\)$", "", t)) == plain(book["title"])), None)
    if not article:
        return None
    end = today - datetime.timedelta(days=1)
    start = end - datetime.timedelta(days=119)
    url = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/"
           f"{urllib.parse.quote(article.replace(' ', '_'), safe='')}/daily/{start:%Y%m%d}/{end:%Y%m%d}")
    views = [item["views"] for item in (fetch(url, f"pv-{book['slug']}-{end:%Y%m}") or {}).get("items", [])]
    if len(views) < 100:
        return None
    recent, before = sum(views[-30:]) / 30, sum(views[:-30]) / max(1, len(views) - 30)
    return recent / before if before else None


def readers_here(today):
    """{slug: (opened, reached chapter 2, finished)} over the last year, from GoatCounter, if it is set up; else {}."""
    site, token = os.environ.get("GOATCOUNTER", "").strip(), os.environ.get("GOATCOUNTER_TOKEN", "").strip()
    if not (site and token):
        return {}
    counts = {}
    for kind in ("open", "chapter-2", "finished"):
        query = urllib.parse.urlencode({"start": f"{today - datetime.timedelta(days=365):%Y-%m-%d}", "end": f"{today:%Y-%m-%d}",
                                        "limit": 200, "path_by_name": "true"})
        request = urllib.request.Request(f"https://{site}.goatcounter.com/api/v0/stats/hits?{query}",
                                         headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                hits = json.loads(response.read()).get("hits", [])
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f"  GoatCounter did not answer: {error}")
            return {}
        for hit in hits:
            match = re.fullmatch(rf"read/{kind}/([a-z0-9-]+)", hit.get("path", "").lstrip("/"))
            if match:
                counts.setdefault(match.group(1), [0, 0, 0])[("open", "chapter-2", "finished").index(kind)] += hit.get("count", 0)
    return {slug: tuple(c) for slug, c in counts.items()}


def scores(books, today):
    """Each book's score for any month, before the time of year, and the facts behind it."""
    ranked = sorted((b for b in books if b.get("popularity")), key=lambda b: b["popularity"])
    rank_of = {b["slug"]: i for i, b in enumerate(ranked)}
    ol = {b["slug"]: open_library(b) for b in books}
    most = max(math.log1p(r) for r, _, _ in ol.values()) or 1
    here = readers_here(today)
    out = {}
    for b in books:
        s = b["slug"]
        rank = 1 - rank_of[s] / len(ranked) if s in rank_of else 0.3
        readers, rating, ratings = ol[s]
        stars = (rating / 5) if rating and ratings >= 20 else 0.75
        openlib = math.log1p(readers) / most * (0.6 + 0.4 * stars)
        momentum = wikipedia_momentum(b, today)
        lift = 0.5 if momentum is None else min(1.0, max(0.0, (momentum - 0.5) / 1.5))
        base = WEIGHTS["rank"] * rank + WEIGHTS["openlibrary"] * openlib + WEIGHTS["momentum"] * lift
        opened, chapter2, finished = here.get(s, (0, 0, 0))
        if opened:
            # readers who carry on past the first chapter and to the end, against the shelf's own score
            kept = (chapter2 / opened) * 0.6 + (finished / opened) * 0.4
            share = opened / (opened + 200)
            base = (1 - share) * base + share * kept
        out[s] = {"base": base, "rank": rank_of.get(s), "readers": readers, "rating": rating, "ratings": ratings,
                  "momentum": momentum, "opened": opened}
    return out


def why(book, facts, season):
    """A sentence or two, from the facts that chose the book: the time of year, how it is read, and its length."""
    sentences = []
    if season:
        sentences.append(season[0].upper() + season[1:] + ".")
    rated = facts["rating"] and facts["ratings"] >= 50 and facts["rating"] >= 4
    if facts["rank"] is not None and facts["rank"] < 20:
        sentences.append("One of the twenty most read books here"
                         + (f", and rated {facts['rating']:.1f} out of 5 on Open Library." if rated else "."))
    elif facts["readers"] >= 2000:
        sentences.append(f"{facts['readers']:,} people on Open Library have read it or mean to"
                         + (f", and they rate it {facts['rating']:.1f} out of 5." if rated else "."))
    elif rated:
        sentences.append(f"Rated {facts['rating']:.1f} out of 5 on Open Library.")
    if facts["momentum"] and facts["momentum"] >= 1.3:
        sentences.append("More people are looking it up lately.")
    if book["minutes"] < SHORT:
        hours = max(1, round(book["minutes"] / 60))
        sentences.append(f"A short one, about {hours} hour{'s' if hours > 1 else ''} to read.")
    return " ".join(sentences) or "A classic worth a month of anyone’s time."


def choose(books, existing, today, months):
    by_slug = {b["slug"]: b for b in books}
    facts = scores(books, today)
    eligible = [b for b in books if b.get("opening")]
    picks = dict(existing)
    this_month = datetime.date(today.year, today.month, 1)
    for k in range(months):
        y, m = divmod(this_month.month - 1 + k, 12)
        month = datetime.date(this_month.year + y, m + 1, 1)
        key = f"{month:%Y-%m}"
        if key in picks and month <= this_month:
            continue  # a month that has begun keeps its book
        picks.pop(key, None)
        earlier = sorted(k_ for k_ in picks if k_ < key)

        def months_since(k_):
            return (int(key[:4]) - int(k_[:4])) * 12 + int(key[5:]) - int(k_[5:])

        def pick_slug(p):
            return p["book"] if isinstance(p, dict) else p

        recent = {pick_slug(picks[k_]) for k_ in earlier if months_since(k_) < 12}
        authors = {by_slug[pick_slug(picks[k_])]["author"] for k_ in earlier if months_since(k_) < 6 and pick_slug(picks[k_]) in by_slug}
        last_genre = by_slug[pick_slug(picks[earlier[-1]])]["genres"][0] if earlier and pick_slug(picks[earlier[-1]]) in by_slug else None
        short_month = month.month % 3 == 0
        best = None
        for b in eligible:
            if b["slug"] in recent or b["author"] in authors or b["genres"][0] == last_genre:
                continue
            if short_month and b["minutes"] >= SHORT:
                continue
            weight, season = next(((w, reason) for mm, w, reason, fits in SEASONS if mm == month.month and fits(b)), (0, None))
            score = facts[b["slug"]]["base"] + weight
            entry = (-score, b["slug"])
            if best is None or entry < best[0]:
                best = (entry, b, season)
        if best is None:
            sys.exit(f"no book can be the pick for {key} under the rules")
        _, book, season = best
        picks[key] = {"book": book["slug"], "why": why(book, facts[book["slug"]], season)}
        print(f"{key}: {book['title']} ({facts[book['slug']]['base']:.3f}{' + season' if season else ''}) — {picks[key]['why']}")
    return dict(sorted(picks.items()))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    months = int(sys.argv[sys.argv.index("--months") + 1]) if "--months" in sys.argv else 12
    books = json.loads((ROOT / "data" / "books.json").read_text(encoding="utf-8"))
    moods = json.loads((ROOT / "data" / "moods.json").read_text(encoding="utf-8"))
    for b in books:
        b["moods"] = moods.get(b["slug"], [])
        b["minutes"] = round(b["words"] / 275)
    path = ROOT / "data" / "picks.json"
    existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    picks = choose(books, existing, datetime.date.today(), months)
    path.write_text(json.dumps(picks, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/picks.json: {len(picks)} months")


if __name__ == "__main__":
    main()

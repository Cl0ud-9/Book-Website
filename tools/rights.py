"""Check every book is free in India too: everyone whose work is in it must have died 60 full years ago.

Standard Ebooks only takes books that are in the US public domain. India's copyright lasts for the author's life and
60 years, counted from the January after they died, so in 2026 everyone must have died in 1965 or earlier. That covers
the author, and also translators, illustrators, writers of introductions and notes, and the painter of the cover.

Each EPUB names its contributors with a link to Wikipedia or the Library of Congress; Wikidata gives their date of
death from either. Answers are cached in tools/.library-cache/rights.

usage: python tools/rights.py [books/a.epub ...]    prints every book that is not clearly free, and writes
       library/rights.json (each book: free or not, and who was checked). With files given, checks only those.
"""
import datetime
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".library-cache" / "rights"
AGENT = "TheBookshelf/3 (https://cl0ud-9.github.io/Book-Website/) rights check"
YEAR = datetime.date.today().year
LAST_FREE_DEATH = YEAR - 61  # died in 1965 or before: free in India from 1 January 2026
# Roles whose work is in the book (MARC relator codes). Standard Ebooks' own roles (producer, proofreader, transcriber,
# typesetter) are left out: they dedicate their work to the public domain.
ROLES = {"aut": "author", "trl": "translator", "ill": "illustrator", "ann": "notes", "win": "introduction",
         "wpr": "preface", "aft": "afterword", "cmm": "commentary", "art": "cover painting", "edt": "editor"}


# Checked by hand, with the reason. Wikidata has no date for these, or the work was given away.
CLEARED = {
    "L. A. Magnus": "Leonard Arthur Magnus, 1879 to 1924",
    "H. C. Murphy": "Henry Cruse Murphy Jr., died 1931",
    "Anthony Oberman": "Dutch painter, 1781 to 1845",
    "Joseph Magnus Stäck": "Swedish painter, 1812 to 1868",
    "William Michaud von Vevey": "Swiss painter, 1828 to 1902",
    "Cuthbert Edmund Swan": "British painter, 1870 to 1931",
    "Peter Graham": "Scottish painter, 1836 to 1921",
    "The Modern Library": "an unsigned publisher's translation of 1918: free in India 60 years after publication",
    "Chapman and Hall": "an unsigned publisher's translation of 1846: free in India 60 years after publication",
    "The Macmillan Company": "an unsigned publisher's translation of 1917: free in India 60 years after publication",
    **{name: "the translators released their translation to the public domain in 2001 (the book's colophon)"
       for name in ("Gunther Olesch", "Anke Dreher", "Amy Coulter", "Stefan Langer", "Semyon Chaichenets")},
}
# Standard Ebooks' and Project Gutenberg's volunteers, who also write notes and edit, give their work to the public
# domain. They are known by producing or transcribing the book as well (MARC: bkp, pfr, trc, mrk, tyg, blw, cov).
VOLUNTEER_ROLES = {"bkp", "pfr", "trc", "mrk", "tyg", "blw", "cov"}


def get(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    file = CACHE / (re.sub(r"[^a-zA-Z0-9]+", "-", url)[-150:] + ".json")
    if file.exists():
        return json.loads(file.read_text(encoding="utf-8"))
    request = urllib.request.Request(url, headers={"User-Agent": AGENT})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < 2:
                time.sleep(10)
                continue
            raise
    file.write_text(json.dumps(data), encoding="utf-8")
    time.sleep(0.5)
    return data


def from_wikipedia(link):
    title = urllib.parse.unquote(link.split("/wiki/", 1)[1])
    data = get("https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&redirects=1&format=json&titles=" + urllib.parse.quote(title))
    pages = data.get("query", {}).get("pages", {})
    return next((p.get("pageprops", {}).get("wikibase_item") for p in pages.values()), None)


def from_loc(link):
    loc = link.rstrip("/").split("/")[-1].replace(".html", "")
    data = get("https://www.wikidata.org/w/api.php?action=query&list=search&format=json&srsearch=" + urllib.parse.quote(f"haswbstatement:P244={loc}"))
    hits = data.get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None


def died(qid):
    """The year someone died, from Wikidata: an int, None if no date (alive, or not known)."""
    data = get(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json")
    claims = data["entities"][next(iter(data["entities"]))]["claims"]
    for claim in claims.get("P570", []):
        value = claim["mainsnak"].get("datavalue", {}).get("value", {})
        match = re.match(r"([+-])(\d+)", value.get("time", ""))
        if match:
            return int(match.group(2)) * (-1 if match.group(1) == "-" else 1)
    return None


def contributors(epub):
    opf_name = next(n for n in zipfile.ZipFile(epub).namelist() if n.endswith(".opf"))
    opf = zipfile.ZipFile(epub).read(opf_name).decode("utf-8")
    people = []
    for tag, pid, name in re.findall(r'<dc:(creator|contributor) id="([^"]+)">([^<]+)</dc:\1>', opf):
        all_roles = re.findall(rf'<meta property="role" refines="#{re.escape(pid)}" scheme="marc:relators">(\w+)</meta>', opf)
        roles = [r for r in all_roles if r in ROLES]
        if not roles or name.strip().lower() in ("anonymous", "unknown", "various"):
            continue
        links = re.findall(rf'<link href="([^"]+)" refines="#{re.escape(pid)}" rel="schema:sameAs"/>', opf)
        volunteer = bool(set(all_roles) & VOLUNTEER_ROLES) or (not links and set(roles) <= {"ann", "edt"})
        people.append({"name": name.strip(), "roles": [ROLES[r] for r in roles], "links": links, "volunteer": volunteer})
    return people


def check(epub):
    # Project Gutenberg's files name nobody's Wikipedia page; their people and years come from its catalogue, written
    # into library/gutenberg.json
    gutenberg = {g["title"]: g for g in json.loads((ROOT / "library" / "gutenberg.json").read_text(encoding="utf-8"))}
    books = {b["slug"]: b for b in json.loads((ROOT / "library" / "books.json").read_text(encoding="utf-8"))}
    entry = gutenberg.get(books.get(epub.stem, {}).get("title"))
    if entry:
        verdicts = [{**person, "free": person["died"] <= LAST_FREE_DEATH, "why": "Project Gutenberg's catalogue"} for person in entry["people"]]
        return {"free": all(v["free"] for v in verdicts), "people": verdicts}
    people = contributors(epub)
    own_cover = (ROOT / "library" / "covers" / f"{epub.stem}.png").exists()
    verdicts = []
    for person in people:
        if person["roles"] == ["cover painting"] and own_cover:
            verdicts.append({"name": person["name"], "roles": person["roles"], "free": True, "why": "not used: the book has its own cover"})
            continue
        if person["volunteer"] or person["name"] in CLEARED:
            why = CLEARED.get(person["name"], "a volunteer, whose work is given to the public domain")
            verdicts.append({"name": person["name"], "roles": person["roles"], "free": True, "why": why})
            continue
        qid = None
        for link in person["links"]:
            if "wikipedia.org/wiki/" in link:
                qid = from_wikipedia(link)
            elif "id.loc.gov" in link:
                qid = from_loc(link)
            if qid:
                break
        year = died(qid) if qid else None
        verdicts.append({**{k: person[k] for k in ("name", "roles")}, "wikidata": qid, "died": year,
                         "free": year is not None and year <= LAST_FREE_DEATH})
    return {"free": all(v["free"] for v in verdicts), "people": verdicts}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    files = [Path(f) for f in sys.argv[1:]] or sorted((ROOT / "books").glob("*.epub"))
    out = ROOT / "library" / "rights.json"
    results = json.loads(out.read_text(encoding="utf-8")) if out.exists() and sys.argv[1:] else {}
    for epub in files:
        result = check(epub)
        results[epub.stem] = result
        if not result["free"]:
            who = "; ".join(f"{p['name']} ({', '.join(p['roles'])}, died {p['died'] or 'unknown'})" for p in result["people"] if not p["free"])
            print(f"NOT CLEAR  {epub.stem}: {who}")
    out.write_text(json.dumps(results, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    clear = sum(r["free"] for r in results.values())
    print(f"{clear} of {len(results)} books are clearly free in India in {YEAR} (everyone died in {LAST_FREE_DEATH} or before)")


if __name__ == "__main__":
    main()

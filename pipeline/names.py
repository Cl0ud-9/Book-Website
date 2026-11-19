"""Names and titles, as the pipeline compares them: so the same book is never on the shelf twice, whichever source it comes from
(Standard Ebooks by hand, Project Gutenberg by script), and a person is written one way ("Jane Austen", not "Austen, Jane")."""
import difflib
import re

TITLES = re.compile(r"\b(emperor|empress|king|queen|prince|princess|saint|st\.|sir|lord|lady|baron|baroness|count|countess|graf|duke|earl|bishop|pope|"
                    r"archbishop|cardinal|dr\.|rev\.|of|de|di|van|von)\b", re.I)


def person(name):
    """Gutenberg's "Austen, Jane" as "Jane Austen"; "Doyle, Arthur Conan, Sir" and "Tolstoy, Leo, graf" without the title; and
    "Marcus Aurelius, Emperor of Rome", whose second part is a title and not a given name, as "Marcus Aurelius" """
    parts = [p.strip() for p in name.split(",")]
    if len(parts) >= 2 and parts[1] and not TITLES.search(parts[1]) and parts[1][0].isupper():
        given = re.sub(r"\b[A-Z]\.? ?\(([^)]+)\)", r"\1", parts[1])  # "T. (Tobias)" is Tobias
        return f"{given} {parts[0]}".strip()
    return parts[0].strip()


def norm(title):
    """A title as it is compared: no subtitle, no article, no punctuation"""
    main = re.split(r"[;:,]| or,? | \(", title.lower())[0]
    return re.sub(r"[^a-z0-9 ]", "", main).strip().removeprefix("the ").removeprefix("a ")


def surname(name):
    """The last word of a name as it is shown ("Marcus Aurelius"), or of Gutenberg's ("Aurelius, Marcus, Emperor of Rome")"""
    shown = person(name) if "," in name else name
    return re.sub(r"[^a-z]", "", shown.split()[-1].lower()) if shown.split() else ""


def on_the_shelf(title, author, have):
    """The same book as one in `have` (pairs of norm(title) and surname)? A title alike, and an author whose surname is spelled alike
    (Dostoyevsky, Dostoevsky)"""
    me, mine = surname(author), norm(title)
    return any(difflib.SequenceMatcher(None, t, mine).ratio() >= 0.9 and (s == me or s in me or me in s or difflib.SequenceMatcher(None, s, me).ratio() >= 0.8)
               for t, s in have)


def pair(title, author):
    return (norm(title), surname(author))


def pair_of_path(path):
    """The title and surname a Standard Ebooks address stands for ("jane-austen/pride-and-prejudice/…" is Pride and Prejudice, Austen)"""
    parts = path.split("/")
    author = parts[0].split("-")[-1]
    return (norm(parts[1].replace("-", " ")), re.sub(r"[^a-z]", "", author))

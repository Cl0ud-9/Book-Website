"""Does the new site render the same pages as the old one? Compares the built pages, element by element.

usage: python tests/parity/compare.py OLD_DIR NEW_DIR [PAGE ...]      (default: every .html page in OLD_DIR)

Both sides are parsed and compared as trees: tags, attributes and text (whitespace collapsed). What is meant to differ
is left out: the bundled scripts and styles, font preloads (their addresses carry a fingerprint now), and comments.
Any other difference is reported with where it is, and the script exits with 1.
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
# The parts that are built differently on purpose
SKIP_LINK = re.compile(r"stylesheet|preload")
# The old site's address and the new one's are the same place
SITES = [("https://cl0ud-9.github.io/Book-Website/", "https://the-bookshelf.cl0ud-9.workers.dev/")]
# Changes made on purpose, listed in tests/parity/intended.txt as "page<TAB>a regular expression the report matches"
INTENDED = [line.split("\t", 1) for line in (Path(__file__).parent / "intended.txt").read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")]


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, attrs, parent, []

    def path(self):
        parts, node = [], self
        while node and node.tag != "#root":
            ident = node.attrs.get("id") or node.attrs.get("class", "").split(" ")[0]
            parts.append(node.tag + (f"[{ident}]" if ident else ""))
            node = node.parent
        return " > ".join(reversed(parts))


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", {})
        self.at = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, {k: (v if v is not None else "") for k, v in attrs}, self.at)
        self.at.children.append(node)
        if tag not in VOID:
            self.at = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.at = self.at.parent

    def handle_endtag(self, tag):
        node = self.at
        while node and node.tag != tag and node.tag != "#root":
            node = node.parent
        if node and node.tag == tag:
            self.at = node.parent

    def handle_data(self, data):
        text = re.sub(r"\s+", " ", data)
        if text.strip():
            if self.at.children and isinstance(self.at.children[-1], str):
                self.at.children[-1] += text
            else:
                self.at.children.append(text)


def skipped(node):
    if isinstance(node, str):
        return False
    if node.tag == "script" and ("src" in node.attrs or node.attrs.get("type") == "module"):
        return True
    return node.tag == "link" and SKIP_LINK.search(node.attrs.get("rel", "")) is not None


def norm_attr(name, value):
    value = re.sub(r"\s+", " ", value).strip()
    for old_site, new_site in SITES:
        value = value.replace(old_site, new_site)
    if name == "style":
        value = ";".join(p.strip() for p in value.rstrip(";").split(";"))
    return value


def same_json(x, y):
    # data for the scripts: the same values, however it is spaced
    try:
        return json.loads(x) == json.loads(y)
    except ValueError:
        return False


def compare(a, b, out, limit=12):
    ca = [c for c in a.children if not skipped(c)]
    cb = [c for c in b.children if not skipped(c)]
    for x, y in zip(ca, cb):
        if len(out) >= limit:
            return
        if isinstance(x, str) or isinstance(y, str):
            tx = x.strip() if isinstance(x, str) else f"<{x.tag}>"
            ty = y.strip() if isinstance(y, str) else f"<{y.tag}>"
            if a.tag == "script" and a.attrs.get("type") == "application/json" and same_json(tx, ty):
                continue
            if tx != ty:
                out.append(f"{a.path()}: text\n    old: {tx[:160]}\n    new: {ty[:160]}")
            continue
        if x.tag != y.tag:
            out.append(f"{a.path()}: <{x.tag}> became <{y.tag}>")
            continue
        ax = {k: norm_attr(k, v) for k, v in x.attrs.items()}
        ay = {k: norm_attr(k, v) for k, v in y.attrs.items()}
        if ax != ay:
            diff = {k: (ax.get(k), ay.get(k)) for k in set(ax) | set(ay) if ax.get(k) != ay.get(k)}
            out.append(f"{x.path()}: attributes {diff}")
        compare(x, y, out, limit)
    if len(ca) != len(cb) and len(out) < limit:
        extra = ca[len(cb):] or cb[len(ca):]
        side = "old" if len(ca) > len(cb) else "new"
        what = [e if isinstance(e, str) else f"<{e.tag} {e.attrs.get('class', '')}>" for e in extra][:3]
        out.append(f"{a.path()}: {len(ca)} children old, {len(cb)} new; only in {side}: {what}")


def parse(path):
    tree = Tree()
    tree.feed(path.read_text(encoding="utf-8"))
    return tree.root


def main():
    old, new = Path(sys.argv[1]), Path(sys.argv[2])
    pages = sys.argv[3:] or sorted(p.name for p in old.glob("*.html"))
    failed = 0
    for name in pages:
        if not (new / name).exists():
            print(f"MISSING {name}")
            failed += 1
            continue
        out = []
        compare(parse(old / name), parse(new / name), out, limit=40)
        out = [line for line in out if not any(page in (name, "*") and re.search(rx, line) for page, rx in INTENDED)][:12]
        if out:
            failed += 1
            print(f"DIFF {name}")
            for line in out:
                print("  " + line)
    print(f"{len(pages) - failed} of {len(pages)} pages the same")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

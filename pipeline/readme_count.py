"""Keep the number of books the README states in step with data/books.json (run after pipeline/library.py)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
count = len(json.loads((ROOT / "data" / "books.json").read_text(encoding="utf-8")))
readme = ROOT / "README.md"
with open(readme, encoding="utf-8", newline="") as f:  # (Path.read_text has no newline option before Python 3.13)
    raw = f.read()
text = raw
for pattern, fill in ((r"library of \d+ classics", f"library of {count} classics"), (r"\d+ books, from Austen", f"{count} books, from Austen"),
                      (r"All \d+ books, most read first", f"All {count} books, most read first")):
    text = re.sub(pattern, fill, text, count=1)
if text != raw:
    readme.write_text(text, encoding="utf-8", newline="")
print(f"README: {count} books")

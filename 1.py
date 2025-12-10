import argparse
import hashlib
from pathlib import Path


def md5_of(file: Path) -> str:
    h = hashlib.md5()
    with file.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def is_hidden(path: Path):
    return any(part.startswith('.') for part in path.parts)


parser = argparse.ArgumentParser(description="Lister tous les PDF dans un dossier.")
parser.add_argument("folder", help="Chemin à scanner")
args = parser.parse_args()

base = Path(args.folder)

for pdf in base.rglob("*.pdf"):
    if is_hidden(pdf):
        continue
    print(f"{md5_of(pdf)}  {pdf.stem}")

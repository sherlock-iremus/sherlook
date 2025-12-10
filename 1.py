from pathlib import Path
import argparse

parser = argparse.ArgumentParser(description="Lister tous les PDF dans un dossier.")
parser.add_argument("folder", help="Chemin à scanner")
args = parser.parse_args()

base = Path(args.folder)

for pdf in base.rglob("*.pdf"):
    print(pdf)

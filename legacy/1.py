import argparse
from colorama import Fore
from dataclasses import dataclass
import hashlib
from pathlib import Path
from pypdf import PdfReader
import requests
from requests.adapters import HTTPAdapter
from tqdm import tqdm
from typing import Sequence
import urllib3
from urllib3.util.retry import Retry
import yaml

from common import Conf

urllib3.disable_warnings()
session = requests.Session()
retry_strategy = Retry(
    total=5,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["HEAD", "GET", "OPTIONS", "POST"]
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("https://", adapter)
session.mount("http://", adapter)


@dataclass
class PDF:
    filename: str
    MD5: str
    n_pages: int
    path: Sequence[Path]


def md5_of(file: Path) -> str:
    h = hashlib.md5()
    with file.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def is_hidden(path: Path):
    return any(part.startswith('.') for part in path.parts)


corpus: dict[str, PDF] = {}

####################################################################################################
# SETUP
####################################################################################################

parser = argparse.ArgumentParser()
parser.add_argument("--conf")
args = parser.parse_args()

yaml_conf_file = Path(args.conf)
with yaml_conf_file.open("r") as f:
    conf = Conf(**yaml.safe_load(f))

####################################################################################################
# PDF COLLECT
####################################################################################################

paths = Path(conf.PDF_FOLDER).rglob("*.pdf")
paths = [f for f in paths if not is_hidden(f)]

for pdf in tqdm(paths, desc=Fore.GREEN + 'Processing PDF files'):
    md5 = md5_of(pdf)
    reader = PdfReader(pdf)
    corpus[md5] = PDF(
        filename=pdf.stem,
        MD5=md5,
        n_pages=len(reader.pages),
        path=pdf.parents
    )

####################################################################################################
# SEND TO GRIST
####################################################################################################

for md5, item in tqdm(corpus.items(), desc=Fore.GREEN + 'Sending to Grist'):
    x = session.put(
        f"{conf.GRIST_BASE}/docs/{conf.GRIST_DOC_ID}/tables/{conf.GRIST_TABLE_ID}/records",
        headers={
            "Authorization": f"Bearer {conf.GRIST_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "records": [
                {
                    "require": {
                        "MD5": item.MD5
                    },
                    "fields": {
                        "filename": item.filename,
                        "MD5": item.MD5,
                        "n_pages": str(item.n_pages)
                    }
                }
            ]
        },
        verify=False
    ).json()

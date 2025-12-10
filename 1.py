import argparse
from colorama import Fore
from dataclasses import dataclass
import hashlib
from pathlib import Path
from tqdm import tqdm
from typing import Sequence
import yaml

from common import Conf

import requests
from requests.adapters import HTTPAdapter
import urllib3
from urllib3.exceptions import InsecureRequestWarning
from urllib3.util.retry import Retry


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

urllib3.disable_warnings(InsecureRequestWarning)
session = requests.Session()
session.verify = False
retry = Retry(connect=3, backoff_factor=0.5)
adapter = HTTPAdapter(max_retries=retry)
session.mount('http://', adapter)
session.mount('https://', adapter)

####################################################################################################
# PDF COLLECT
####################################################################################################

x = Path(conf.PDF_FOLDER).rglob("*.pdf")
x = [f for f in x if not is_hidden(f)]

for pdf in tqdm(x, desc=Fore.GREEN + 'Processing PDF files'):
    md5 = md5_of(pdf)
    corpus[md5] = PDF(
        filename=pdf.stem,
        MD5=md5,
        n_pages=0,
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
                        "MD5": item.MD5
                    }
                }
            ]
        },
        verify=False
    ).json()

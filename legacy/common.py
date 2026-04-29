from dataclasses import dataclass


@dataclass
class Conf:
    GRIST_API_KEY: str
    GRIST_BASE: str
    GRIST_DOC_ID: str
    GRIST_TABLE_ID: str
    PDF_FOLDER: str

"""Server-side translations for text the API sends: action names, nudges, reasons.

English (locales/en.json) is the source. Gujarati and Hindi catalogues are
generated from it with Adaption (tools/translate_with_adaption.py) and reviewed
by a native speaker; any key missing from them falls back to English, so a
partial translation never breaks the app.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, Request

LOCALES_DIR = Path(__file__).parent / "locales"
Locale = Literal["en", "gu", "hi"]
SUPPORTED: tuple[Locale, ...] = ("en", "gu", "hi")


@lru_cache
def catalogue(locale: str) -> dict[str, str]:
    path = LOCALES_DIR / f"{locale}.json"
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not k.startswith("_") and isinstance(v, str)}


def tr(locale: str, key: str, **params: object) -> str:
    text = catalogue(locale).get(key) or catalogue("en")[key]
    try:
        return text.format(**params) if params else text
    except (KeyError, IndexError, ValueError):
        # A translation that lost or broke a placeholder: fall back to English rather than fail.
        return catalogue("en")[key].format(**params)


def locale_from_header(accept_language: str | None) -> Locale:
    """First supported language in an Accept-Language header, else English."""
    for part in (accept_language or "").split(","):
        code = part.split(";")[0].strip().lower()[:2]
        if code in SUPPORTED:
            return code  # type: ignore[return-value]
    return "en"


def get_locale(request: Request) -> Locale:
    return locale_from_header(request.headers.get("accept-language"))


RequestLocale = Annotated[Locale, Depends(get_locale)]

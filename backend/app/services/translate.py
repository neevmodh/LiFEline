"""Live Gujarati and Hindi for text people type while the app runs: GEDA campaign titles and
descriptions and community notices are translated; names (people, communities) are transliterated,
so "Shanti Apartments" reads શાંતિ એપાર્ટમેન્ટ્સ rather than being turned into "peace apartments".

The app's own words are fixed catalogues (locales/*.json, web/src/i18n); this is only for text
nobody could translate in advance. Sarvam AI translates it, and every result is cached twice:
in memory for this process and in the translation_cache table for every process, so each
sentence goes to Sarvam once per language however many people read it.

Pages never wait for Sarvam. A reader gets the cached translation; a sentence that isn't cached
yet is shown as written and translated in the background, and new campaigns and notices are
translated the moment they are posted. With no key, external APIs off, an error, or an answer
that lost a number or isn't in the reader's script, the text simply stays as written; a failure
is remembered for a few minutes so a Sarvam outage doesn't turn into a request per page view.
"""

import hashlib
import logging
import re
import time
from collections import OrderedDict
from threading import Lock

import httpx
from fastapi import BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db import SessionLocal
from app.models import TranslationCache

log = logging.getLogger(__name__)

SARVAM_URL = "https://api.sarvam.ai/translate"
TRANSLIT_URL = "https://api.sarvam.ai/transliterate"
TARGETS = {"gu": "gu-IN", "hi": "hi-IN"}
SCRIPTS = {"gu": re.compile(r"[઀-૿]"), "hi": re.compile(r"[ऀ-ॿ]")}
LATIN = re.compile(r"[A-Za-z]")
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
MAX_CHARS = {"mayura:v1": 1000, "sarvam-translate:v1": 2000}
MEMORY_SIZE = 2000
RETRY_AFTER_S = 600

_memory: "OrderedDict[tuple[str, str], str]" = OrderedDict()
_failed: dict[tuple[str, str], float] = {}
_lock = Lock()


def clear_memory() -> None:
    with _lock:
        _memory.clear()
        _failed.clear()


def enabled() -> bool:
    settings = get_settings()
    return bool(settings.sarvam_api_key) and settings.enable_external_apis


def source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def numbers(text: str) -> list[str]:
    """Every number in the text, separators dropped: 1,00,000 and 100000 are the same number."""
    return sorted(n.replace(",", "") for n in NUMBER.findall(text))


def acceptable(source: str, translated: object, locale: str) -> bool:
    """A translation is used only if it is in the reader's script and kept every number."""
    if not isinstance(translated, str) or not translated.strip():
        return False
    if not SCRIPTS[locale].search(translated):
        return False
    return numbers(source) == numbers(translated)


def needs_translation(text: str | None, locale: str) -> bool:
    if locale not in TARGETS or not text or not text.strip():
        return False
    if SCRIPTS[locale].search(text):
        return False  # already written in the reader's language
    return bool(LATIN.search(text))  # nothing to translate in "18:00 to 20:00"


def call_sarvam(text: str, locale: str, *, timeout: float | None = None) -> str | None:
    """One request to Sarvam's translate API; None when it fails or the answer isn't usable."""
    settings = get_settings()
    model = settings.sarvam_model
    if len(text) > MAX_CHARS.get(model, 1000):
        return None
    body = {
        "input": text,
        "source_language_code": "en-IN",
        "target_language_code": TARGETS[locale],
        "model": model,
    }
    if model == "mayura:v1":  # these options exist only on Mayura
        body |= {"mode": settings.sarvam_mode, "numerals_format": "international"}
    try:
        resp = httpx.post(
            SARVAM_URL,
            json=body,
            headers={"api-subscription-key": settings.sarvam_api_key or ""},
            timeout=timeout or settings.external_timeout_seconds,
        )
        resp.raise_for_status()
        translated = resp.json().get("translated_text")
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Sarvam translation failed (%s): %s", locale, exc)
        return None
    if not acceptable(text, translated, locale):
        log.warning("Sarvam translation rejected (%s): lost a number or wrong script", locale)
        return None
    return translated.strip()


LETTERS = {
    "gu": dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "એ બી સી ડી ઈ એફ જી એચ આઈ જે કે એલ એમ એન ઓ પી ક્યૂ આર એસ ટી યુ વી ડબલ્યુ એક્સ વાય ઝેડ".split())),
    "hi": dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "ए बी सी डी ई एफ़ जी एच आई जे के एल एम एन ओ पी क्यू आर एस टी यू वी डब्ल्यू एक्स वाई ज़ेड".split())),
}
INITIALS = re.compile(r"^((?:[A-Z]\.)+)\s+(.+)$")


def call_sarvam_name(text: str, locale: str, *, timeout: float | None = None) -> str | None:
    """A name written in the reader's script by Sarvam's transliteration; None when unusable.
    Leading initials ("L.D. Engineering College") are spelt out here: Sarvam invents letters for them."""
    m = INITIALS.match(text)
    if m:
        rest = _transliterate(m.group(2), locale, timeout)
        if rest is None:
            return None
        letters = " ".join(LETTERS[locale][c] + "." for c in m.group(1) if c.isalpha())
        return f"{letters} {rest}"
    return _transliterate(text, locale, timeout)


def _transliterate(text: str, locale: str, timeout: float | None) -> str | None:
    settings = get_settings()
    if len(text) > 1000:
        return None
    try:
        resp = httpx.post(
            TRANSLIT_URL,
            json={"input": text, "source_language_code": "en-IN", "target_language_code": TARGETS[locale]},
            headers={"api-subscription-key": settings.sarvam_api_key or ""},
            timeout=timeout or settings.external_timeout_seconds,
        )
        resp.raise_for_status()
        out = resp.json().get("transliterated_text")
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Sarvam transliteration failed (%s): %s", locale, exc)
        return None
    # It sometimes invents an initial ("L.D." came back as "J. L. D."): the dots must match too.
    if not acceptable(text, out, locale) or out.count(".") != text.count("."):
        return None
    return out.strip()


def _cache_lang(locale: str, kind: str) -> str:
    return locale if kind == "text" else f"{locale}-n"


def _remember(key: tuple[str, str], text: str) -> None:
    with _lock:
        _memory[key] = text
        _memory.move_to_end(key)
        while len(_memory) > MEMORY_SIZE:
            _memory.popitem(last=False)


def cached(text: str, locale: str, kind: str = "text") -> str | None:
    """The stored translation, from memory or the database, without calling Sarvam."""
    key = (source_hash(text), _cache_lang(locale, kind))
    with _lock:
        if key in _memory:
            _memory.move_to_end(key)
            return _memory[key]
    try:
        with SessionLocal() as db:
            row = db.get(TranslationCache, key)
    except Exception as exc:  # noqa: BLE001  a cache problem must never break a page
        log.warning("Translation cache unavailable: %s", exc)
        return None
    if row is None:
        return None
    _remember(key, row.text)
    return row.text


def translate(text: str | None, locale: str, kind: str = "text") -> str | None:
    """`text` in the reader's language (a name in the reader's script), calling Sarvam if it isn't
    cached; else exactly as written."""
    if not enabled() or not needs_translation(text, locale):
        return text
    assert text is not None
    hit = cached(text, locale, kind)
    if hit is not None:
        return hit
    key = (source_hash(text), _cache_lang(locale, kind))
    with _lock:
        if _failed.get(key, 0) > time.monotonic():
            return text
    translated = call_sarvam(text, locale) if kind == "text" else call_sarvam_name(text, locale)
    if translated is None:
        with _lock:
            _failed[key] = time.monotonic() + RETRY_AFTER_S
        return text
    try:
        with SessionLocal() as db:
            db.add(TranslationCache(source_hash=key[0], lang=key[1], source_text=text, text=translated,
                                    provider="sarvam" if kind == "text" else "sarvam-tl"))
            try:
                db.commit()
            except IntegrityError:  # another request cached the same sentence first
                db.rollback()
    except Exception as exc:  # noqa: BLE001
        log.warning("Couldn't store a translation: %s", exc)
    _remember(key, translated)
    return translated


def warm(texts: list[str], locales: tuple[str, ...] = tuple(TARGETS), kind: str = "text") -> None:
    """Translate text (or write names) ahead of its readers (run as a background task)."""
    for text in dict.fromkeys(t for t in texts if t):
        for locale in locales:
            translate(text, locale, kind)


def localize(texts: list[str | None], locale: str, background: BackgroundTasks | None = None,
             kind: str = "text") -> list[str | None]:
    """Each text in the reader's language if it's cached, else as written; misses are translated
    in the background so the next reader gets them. Never waits for Sarvam."""
    if not enabled():
        return list(texts)
    out, misses = [], []
    for text in texts:
        if not needs_translation(text, locale):
            out.append(text)
            continue
        assert text is not None
        hit = cached(text, locale, kind)
        out.append(hit if hit is not None else text)
        if hit is None:
            misses.append(text)
    if misses and background is not None:
        background.add_task(warm, misses, (locale,), kind)
    return out


def localize_names(names: list[str | None], locale: str, background: BackgroundTasks | None = None) -> list[str | None]:
    """Names (people, communities) in the reader's script, from the cache; never waits for Sarvam."""
    return localize(names, locale, background, kind="name")


def name(text: str | None, locale: str, background: BackgroundTasks | None = None) -> str | None:
    return localize_names([text], locale, background)[0]


NAME_FIELDS = ("name", "first_name", "author")


def names_in(obj, locale: str, background: BackgroundTasks | None = None):
    """Every name, first_name and author field in a reply (models, lists, nested), in the reader's script."""
    if not enabled() or locale not in TARGETS:
        return obj
    spots: list[tuple[object, str, str]] = []

    def walk(o):
        if isinstance(o, BaseModel):
            for field in type(o).model_fields:
                v = getattr(o, field)
                if field in NAME_FIELDS and isinstance(v, str):
                    spots.append((o, field, v))
                else:
                    walk(v)
        elif isinstance(o, (list, tuple)):
            for x in o:
                walk(x)

    walk(obj)
    for (o, field, _), new in zip(spots, localize_names([v for _, _, v in spots], locale, background)):
        setattr(o, field, new)
    return obj

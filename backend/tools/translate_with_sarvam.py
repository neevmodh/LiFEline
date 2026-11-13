"""Re-translate every fixed Nidhi string into Gujarati and Hindi with Sarvam AI.

    cd backend
    uv run python tools/translate_with_sarvam.py                 # count strings and estimate the cost
    uv run python tools/translate_with_sarvam.py --run --limit 40   # try a sample first
    uv run python tools/translate_with_sarvam.py --run           # translate everything, write the catalogues

Reads SARVAM_API_KEY from backend/.env. The English source is the same as for the Adaption tool:
web/src/i18n/en.json plus copy.ts and the phone app's mobile.ts (the phone app reads the web
catalogues), and the server's app/locales/en.json.

Every answer is cached in tools/sarvam_cache.json by language and English text, so a re-run only
pays for strings that are new or changed, and an interrupted run carries on where it stopped.
Sarvam's Starter plan allows 60 requests a minute; the tool keeps under that.

Sarvam's "formal" mode is used (SARVAM_MODE): its colloquial modes leave many words in English.
A new translation replaces today's only if it passes every check, otherwise today's stays:
- it is in Gujarati or Devanagari script, with no more English words left in it than today's,
- it keeps exactly the same {placeholders} and the same numbers as the English,
- it keeps every brand or unit name (GEDA, LiFE, DISCOM, kWh, CO₂, ...) that today's translation keeps,
- it follows the glossary: points = પોઇન્ટ in Gujarati and अंक in Hindi.
By default only strings whose translation still has English words in it are sent (names and units
such as GEDA, kWh, Android or Green Hours don't count), and Sarvam's version is used only when it
leaves fewer English words: a trial showed that re-translating short, already-translated UI labels
without context makes them worse ("Logging…" came back as "wood-cutting"). --all-strings and
--replace-all lift those limits.
A review file (tools/sarvam_review.md) lists every change and every rejection, old beside new.
"""

import argparse
import hashlib
import json
import re
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from translate_with_adaption import (
    LANGUAGES,
    PLACEHOLDER,
    ROOT,
    SOURCES,
    english_strings,
    existing,
)

URL = "https://api.sarvam.ai/translate"
TARGET = {"gu": "gu-IN", "hi": "hi-IN"}
CACHE = Path(__file__).with_name("sarvam_cache.json")
REVIEW = Path(__file__).with_name("sarvam_review.md")
REJECTS = Path(__file__).with_name("sarvam_rejects.json")  # turned down by a person after review
RUPEES_PER_10K_CHARS = 20
MIN_GAP_S = 1.05  # 60 requests a minute on the Starter plan
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
LATIN = re.compile(r"[A-Za-z]")
# Names and units that stay in Latin letters when today's translation keeps them that way.
TERMS = ["GEDA", "LiFE", "DISCOM", "GERC", "PVGIS", "CEA", "IPCC", "UGVCL", "MGVCL", "DGVCL", "PGVCL",
         "Torrent", "PM Surya Ghar", "kWh", "kW", "CO₂", "LED", "WhatsApp", "Android", "iPhone", "UPI", "QR"]
# Also fine to leave in Latin letters: names of products and screens, and units.
KEEP_LATIN = TERMS + ["Add to Home Screen", "Home Screen", "Green Hours", "Nidhi", "Groq", "Claude", "Chrome",
                      "Safari", "Share", "BEE", "CSV", "PDF", "OTP", "SMS", "AI", "IST", "AM", "PM", "kg", "km",
                      "m²", "°C", "AC", "EV", "LPG", "CNG", "ID"]
GU_POINTS_BAD = re.compile(r"ગુણ|મુદ્દાઓ|પોઈન્ટ્સ")
WORD = re.compile(r"[A-Za-z][A-Za-z'’-]*")


def key_of(lang: str, text: str) -> str:
    return f"{lang}:{hashlib.sha256(text.encode('utf-8')).hexdigest()}"


def numbers(text: str) -> list[str]:
    return sorted(n.replace(",", "") for n in NUMBER.findall(PLACEHOLDER.sub("", text)))


def fix_placeholders(english: str, text: str) -> str:
    """Put back placeholder names the model re-capitalised ({Title} -> {title})."""
    for name in set(PLACEHOLDER.findall(english)):
        text = re.sub(r"\{" + re.escape(name) + r"\}", "{" + name + "}", text, flags=re.IGNORECASE)
    return text


def english_words(text: str | None) -> int:
    """Words left in Latin letters, not counting {placeholders} and brand or unit names."""
    if not text:
        return 0
    text = PLACEHOLDER.sub("", text)
    for term in sorted(KEEP_LATIN, key=len, reverse=True):
        text = re.sub(rf"(?<![A-Za-z]){re.escape(term)}(?![A-Za-z])", "", text)
    return len(WORD.findall(text))


def glossary(lang: str, english: str, text: str) -> str:
    """The project's one word for points, whatever variant the model chose."""
    if "point" not in english.lower():
        return text
    if lang == "gu":
        return text.replace("પોઈન્ટ્સ", "પોઇન્ટ").replace("પોઇન્ટ્સ", "પોઇન્ટ").replace("પોઈન્ટ", "પોઇન્ટ")
    return re.sub(r"पॉइंट्स|पॉइंट|प्वाइंट्स|प्वाइंट|पॉइन्ट्स|पॉइन्ट", "अंक", text)


def problems(lang: str, english: str, new: str, old: str | None) -> list[str]:
    """Why a new translation can't replace today's (empty list: it can)."""
    out = []
    if not LANGUAGES[lang].search(new):
        out.append("not in the right script")
    if set(PLACEHOLDER.findall(new)) != set(PLACEHOLDER.findall(english)):
        out.append("placeholders changed")
    if numbers(new) != numbers(english):
        out.append("numbers changed")
    for term in TERMS:
        if term in english and old and term in old and term not in new:
            out.append(f"lost {term}")
    if lang == "gu" and GU_POINTS_BAD.search(new):
        out.append("glossary: points")
    if english_words(new) > english_words(old):
        out.append("more English words than today")
    return out


class Sarvam:
    def __init__(self, key: str, model: str, mode: str = "formal"):
        self.key, self.model, self.mode, self.last = key, model, mode, 0.0
        self.http = httpx.Client(timeout=30)

    def translate(self, text: str, lang: str) -> str | None:
        body = {"input": text, "source_language_code": "en-IN", "target_language_code": TARGET[lang], "model": self.model}
        if self.model == "mayura:v1":
            body |= {"mode": self.mode, "numerals_format": "international"}
        for attempt in range(6):
            wait = self.last + MIN_GAP_S - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            try:
                resp = self.http.post(URL, json=body, headers={"api-subscription-key": self.key})
            except httpx.HTTPError as exc:
                print(f"    network error ({exc}); retrying", flush=True)
                time.sleep(5 * (attempt + 1))
                continue
            if resp.status_code == 429 or resp.status_code >= 500:
                time.sleep(15 * (attempt + 1))
                continue
            if resp.status_code == 403:
                sys.exit("Sarvam refused the key (403). Check SARVAM_API_KEY in backend/.env.")
            if resp.status_code != 200:
                print(f"    {resp.status_code}: {resp.text[:200]}", flush=True)
                return None
            return (resp.json().get("translated_text") or "").strip() or None
        return None


def load_cache() -> dict[str, str]:
    return json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}


def save_cache(cache: dict[str, str]) -> None:
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True) + "\n", encoding="utf-8")


def write_catalogues(new: dict[str, dict[str, str]], model: str) -> None:
    """Merge accepted translations over today's catalogues, keeping each file's key order."""
    for scope, folder in SOURCES.items():
        for lang in LANGUAGES:
            path = folder / f"{lang}.json"
            catalogue = json.loads(path.read_text(encoding="utf-8"))
            for full_key, text in new[lang].items():
                s, k = full_key.split(":", 1)
                if s == scope:
                    catalogue[k] = text
            path.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        meta_path = folder / "translations.meta.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        meta["generated_by"] = "Adaption (tools/translate_with_adaption.py); Sarvam AI finishes strings that still had English left (tools/translate_with_sarvam.py), each change reviewed"
        meta["generated_at"] = datetime.now(UTC).isoformat(timespec="seconds")
        meta["sarvam_model"] = model
        meta["reviewed_by_native_speaker"] = False
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--run", action="store_true", help="call Sarvam (default: count and estimate only)")
    parser.add_argument("--limit", type=int, help="translate only this many new strings per language (a trial)")
    parser.add_argument("--no-write", action="store_true", help="translate and review, but leave the catalogues")
    parser.add_argument("--all-strings", action="store_true",
                        help="send every string, not only those whose translation still has English words left")
    parser.add_argument("--replace-all", action="store_true",
                        help="use any new translation that passes the checks, not only ones that leave less English")
    args = parser.parse_args()

    english = english_strings()
    today_by_lang = {lang: existing(lang) for lang in LANGUAGES}

    def unfinished(key: str) -> bool:
        """Today's translation is missing or still has English words in it, in some language."""
        return any(english_words(today_by_lang[lang].get(key) or english[key]) > 0 for lang in LANGUAGES)

    by_text: dict[str, list[str]] = {}
    for key, text in english.items():
        if LATIN.search(text) and (args.all_strings or unfinished(key)):
            by_text.setdefault(text, []).append(key)
    cache = load_cache()
    todo = [(lang, t) for lang in LANGUAGES for t in by_text if key_of(lang, t) not in cache]
    chars = sum(len(t) for _, t in todo)
    print(f"{len(by_text)} distinct English strings, {len(by_text) * len(LANGUAGES)} translations; "
          f"{len(todo)} not cached yet ({chars:,} characters, about ₹{chars / 10_000 * RUPEES_PER_10K_CHARS:,.0f}, "
          f"about {len(todo) * MIN_GAP_S / 60:.0f} minutes)")
    if not args.run:
        print("Estimate only. Add --run to translate.")
        return

    sys.path.insert(0, str(ROOT / "backend"))
    from app.config import get_settings

    settings = get_settings()
    if not settings.sarvam_api_key:
        sys.exit("Add SARVAM_API_KEY to backend/.env first.")
    api = Sarvam(settings.sarvam_api_key, settings.sarvam_model, settings.sarvam_mode)

    done: dict[str, int] = {}
    for i, (lang, text) in enumerate(todo, 1):
        if args.limit and done.get(lang, 0) >= args.limit:
            continue
        out = api.translate(text, lang)
        if out:
            cache[key_of(lang, text)] = out
            done[lang] = done.get(lang, 0) + 1
        if i % 20 == 0:
            save_cache(cache)
            print(f"  {i}/{len(todo)}", flush=True)
    save_cache(cache)

    # Decide string by string, and write the review file.
    turned_down = json.loads(REJECTS.read_text(encoding="utf-8")) if REJECTS.exists() else {}
    accepted: dict[str, dict[str, str]] = {lang: {} for lang in LANGUAGES}
    changed, rejected = [], []
    for lang in LANGUAGES:
        today = existing(lang)
        for text, keys in by_text.items():
            raw = cache.get(key_of(lang, text))
            if not raw:
                continue
            new = glossary(lang, text, fix_placeholders(text, raw))
            for k in keys:
                old = today.get(k)
                why = problems(lang, text, new, old)
                if not why and not args.replace_all and english_words(new) >= english_words(old or text):
                    why = ["no less English than today"]
                if not why and k in turned_down.get(lang, []):
                    why = ["turned down in review"]
                if why:
                    rejected.append((lang, k, text, old, new, ", ".join(why)))
                elif new != old:
                    accepted[lang][k] = new
                    changed.append((lang, k, text, old, new))
    lines = ["# Sarvam re-translation review", "",
             f"{sum(len(v) for v in accepted.values())} strings changed, {len(rejected)} kept as they were.", "",
             "## Changed", "", "| Lang | Key | English | Before | After |", "|---|---|---|---|---|"]
    lines += [f"| {lang} | `{k}` | {en} | {old or ''} | {new} |" for lang, k, en, old, new in changed]
    lines += ["", "## Kept (new translation failed a check)", "", "| Lang | Key | English | Kept | Sarvam | Why |",
              "|---|---|---|---|---|---|"]
    lines += [f"| {lang} | `{k}` | {en} | {old or ''} | {new} | {why} |" for lang, k, en, old, new, why in rejected]
    REVIEW.write_text("\n".join(s.replace("\n", " ") for s in lines) + "\n", encoding="utf-8")
    print(f"{len(changed)} changed, {len(rejected)} kept. Review: {REVIEW.relative_to(ROOT)}")
    if args.no_write or args.limit:
        print("Catalogues left as they were (--no-write or --limit).")
        return
    write_catalogues(accepted, settings.sarvam_model)
    print("Catalogues written. Run the web and backend tests before committing.")


if __name__ == "__main__":
    main()

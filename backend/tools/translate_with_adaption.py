"""Translate Nidhi into Gujarati and Hindi with Adaption's dataset translation API.

    cd backend
    uv run --with adaption python tools/translate_with_adaption.py            # estimate cost only
    uv run --with adaption python tools/translate_with_adaption.py --run      # translate and write catalogues

Reads ADAPTION_API_KEY from backend/.env. Every English UI string (frontend
src/i18n/en.json) and server string (backend app/locales/en.json) becomes one
row of a JSONL dataset. Adaption translates the dataset; this script then:

- matches each translated row back to its key by the row id, and recognises the
  language by its script (Gujarati or Devanagari), so it doesn't depend on the
  output's column layout;
- keeps a translation only if it has exactly the same {placeholders} as the
  English, so numbers and names can't be lost;
- writes gu.json and hi.json next to each en.json, plus translations.meta.json
  recording the Adaption dataset ids and that a native speaker still has to review.

Missing or rejected keys fall back to English in the app.
"""

import argparse
import io
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    "web": ROOT / "frontend/src/i18n",
    "api": ROOT / "backend/app/locales",
}
LANGUAGES = {"gu": re.compile(r"[઀-૿]"), "hi": re.compile(r"[ऀ-ॿ]")}
PLACEHOLDER = re.compile(r"\{(\w+)\}")


def english_strings() -> dict[str, str]:
    """Every English string, keyed "web:<key>" or "api:<key>"."""
    out = {}
    for scope, folder in SOURCES.items():
        for key, text in json.loads((folder / "en.json").read_text(encoding="utf-8")).items():
            out[f"{scope}:{key}"] = text
    return out


def existing(lang: str) -> dict[str, str]:
    out = {}
    for scope, folder in SOURCES.items():
        path = folder / f"{lang}.json"
        if path.exists():
            out.update({f"{scope}:{k}": v for k, v in json.loads(path.read_text(encoding="utf-8")).items()})
    return out


def build_rows(only_missing: bool = False) -> tuple[list[dict], dict[str, list[str]]]:
    """One row per distinct English text (Adaption rejects duplicate rows), and which keys share it."""
    have = [existing(lang) for lang in LANGUAGES] if only_missing else []
    by_text: dict[str, list[str]] = {}
    for key, text in english_strings().items():
        if only_missing and all(key in h for h in have):
            continue
        by_text.setdefault(text, []).append(key)
    rows, groups = [], {}
    for i, (text, keys) in enumerate(sorted(by_text.items())):
        row_id = f"s{i:04d}"
        rows.append({"id": row_id, "text": text})
        groups[row_id] = keys
    return rows, groups


def client():
    sys.path.insert(0, str(ROOT / "backend"))
    from adaption import Adaption  # noqa: PLC0415  (only needed for this tool)

    from app.config import get_settings

    key = get_settings().adaption_api_key
    if not key:
        sys.exit("Add ADAPTION_API_KEY to backend/.env first.")
    return Adaption(api_key=key)


def upload(api, rows: list[dict]) -> str:
    data = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows).encode()
    name = f"nidhi-ui-{datetime.now(timezone.utc):%Y%m%d-%H%M}"
    init = api.datasets.upload.initiate(name=name, file_format="jsonl")
    httpx.put(init.upload_url, content=data, timeout=60).raise_for_status()
    s3_key = urlparse(init.upload_url).path.lstrip("/")
    done = api.datasets.upload.complete(s3_key=s3_key, name=name, file_format="jsonl", file_size_bytes=len(data))
    print(f"Uploaded {len(rows)} strings as dataset {done.dataset_id} ({done.status})")
    return done.dataset_id


def wait(api, dataset_id: str, until: tuple[str, ...] = ("succeeded", "failed"), timeout_s: int = 3600) -> str:
    start, last = time.monotonic(), None
    while True:
        st = api.datasets.get_status(dataset_id)
        pct = st.progress.percent if st.progress else None
        line = f"  {st.status}{f' {pct}%' if pct is not None else ''}"
        if line != last:
            print(line, flush=True)
            last = line
        if st.status in until or st.status == "failed":
            if st.status == "failed":
                print(f"  failed: {st.error_data}")
            return st.status
        if time.monotonic() - start > timeout_s:
            sys.exit("Timed out waiting for Adaption")
        time.sleep(15)


def _row_id_and_text(row: dict, english: dict[str, str]) -> tuple[str | None, str | None]:
    """The string id and translated text of an output row, whatever the output's column layout."""
    row_id = row.get("id")
    if row_id not in english:  # the id may come back inside a context or metadata field
        blob = json.dumps(row, ensure_ascii=False)
        row_id = next((m for m in re.findall(r"s\d{4}", blob) if m in english), None)
    # Translated prompt columns only: a completion column would be generated text, not a translation.
    columns = ("enhanced_prompt", "translated_prompt", "prompt", "text", "original_prompt")
    text = next((row[c] for c in columns if isinstance(row.get(c), str) and row[c].strip()), None)
    return row_id, text


def collect(downloaded: bytes, english: dict[str, str]) -> tuple[dict[str, dict[str, str]], list[str]]:
    """Map Adaption's output rows back to keys per language. Returns (translations, problems)."""
    out: dict[str, dict[str, str]] = {lang: {} for lang in LANGUAGES}
    problems = []
    for line in io.StringIO(downloaded.decode("utf-8")):
        if not line.strip():
            continue
        row = json.loads(line)
        row_id, text = _row_id_and_text(row, english)
        if row_id not in english or not isinstance(text, str) or text == english[row_id]:
            continue
        lang = next((code for code, script in LANGUAGES.items() if script.search(text)), None)
        if lang is None:
            continue
        if set(PLACEHOLDER.findall(text)) != set(PLACEHOLDER.findall(english[row_id])):
            problems.append(f"{lang} {row_id}: placeholders changed, kept English")
            continue
        out[lang][row_id] = text.strip()
    return out, problems


def write(translations: dict[str, dict[str, str]], dataset_ids: dict[str, str]) -> None:
    """Merge new translations into the existing catalogues (new ones win), dropping keys English no longer has."""
    english = english_strings()
    for scope, folder in SOURCES.items():
        for lang, rows in translations.items():
            merged = {k: v for k, v in {**existing(lang), **rows}.items() if k in english}
            catalogue = {k.split(":", 1)[1]: v for k, v in sorted(merged.items()) if k.startswith(f"{scope}:")}
            (folder / f"{lang}.json").write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"  {folder.relative_to(ROOT)}/{lang}.json: {len(catalogue)} strings")
        meta_path = folder / "translations.meta.json"
        runs = json.loads(meta_path.read_text())["adaption_runs"] if meta_path.exists() and "adaption_runs" in meta_path.read_text() else []
        meta = {
            "generated_by": "Adaption dataset translation (tools/translate_with_adaption.py)",
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "adaption_runs": [*runs, dataset_ids],
            "reviewed_by_native_speaker": False,
        }
        (folder / "translations.meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--run", action="store_true", help="spend credits and translate (default: estimate only)")
    parser.add_argument("--dataset", help="reuse an already uploaded dataset id")
    parser.add_argument("--missing", action="store_true", help="only send strings not yet translated in every language")
    parser.add_argument("--from-raw", action="store_true", help="re-read tools/adaption_output.jsonl instead of calling the API")
    args = parser.parse_args()

    rows, groups = build_rows(only_missing=args.missing)
    if not rows:
        sys.exit("Everything is already translated.")
    print(f"{len(rows)} distinct strings to translate")
    english = {r["id"]: r["text"] for r in rows}
    if args.from_raw:
        by_row, problems = collect(Path(__file__).with_name("adaption_output.jsonl").read_bytes(), english)
        for p in problems:
            print("  !", p)
        write({lang: {k: v for rid, v in t.items() for k in groups[rid]} for lang, t in by_row.items()}, {"source": "raw file"})
        return
    api = client()
    dataset_id = args.dataset or upload(api, rows)
    # Uploaded datasets wait for a column selection before any run.
    wait(api, dataset_id, until=("awaiting_input", "awaiting_column_selection", "succeeded"))

    # The text to translate is the "prompt"; the id travels as context so rows can be matched back.
    request = {
        "column_mapping": {"prompt": "text", "context": ["id"]},
        "translate": {"languages": list(LANGUAGES), "sample_rate": 1.0},
    }
    estimate = api.datasets.adapt(dataset_id, estimate=True, **request)
    print(f"Estimate: {estimate.estimated_credits_consumed} credits, about {estimate.estimated_minutes} minutes")
    if not args.run:
        print(f"Estimate only. To translate: --run --dataset {dataset_id}")
        return

    run = api.datasets.adapt(dataset_id, **request)
    print(f"Running (run {run.run_id})", flush=True)
    wait(api, dataset_id)
    downloaded = api.datasets.download(dataset_id, file_format="jsonl").read()
    raw = Path(__file__).with_name("adaption_output.jsonl")
    raw.write_bytes(downloaded)
    print(f"Raw output saved to {raw.relative_to(ROOT)} for inspection")
    by_row, problems = collect(downloaded, english)
    # Each distinct text was translated once; give it to every key that uses it.
    translations = {lang: {k: text for rid, text in t.items() for k in groups[rid]} for lang, t in by_row.items()}
    for p in problems:
        print("  !", p)
    write(translations, {"dataset": dataset_id, "run": str(run.run_id)})
    total = sum(len(keys) for keys in groups.values())
    missing = {lang: total - len(t) for lang, t in translations.items()}
    print(f"Done. Untranslated (English fallback): {missing}. Have a native speaker review before the demo.")


if __name__ == "__main__":
    main()

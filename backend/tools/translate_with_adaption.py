"""Translate LiFEline into Gujarati and Hindi with Adaption's dataset translation API.

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
import uuid
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
CONTEXT = (
    "User interface text for LiFEline, a Mission LiFE app from Gujarat Energy Development Agency that helps "
    "households cut electricity and carbon. Keep {placeholders} exactly as written. Keep brand names "
    "(LiFEline, Mission LiFE, GEDA, PM Surya Ghar, PVGIS, DGVCL, UGVCL, Torrent Power), units (kWh, kW, CO₂, m², °C) "
    "and numbers unchanged."
)


def build_rows() -> list[dict]:
    rows = []
    for scope, folder in SOURCES.items():
        for key, text in json.loads((folder / "en.json").read_text(encoding="utf-8")).items():
            rows.append({"id": f"{scope}:{key}", "text": text, "context": CONTEXT})
    return rows


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
    name = f"lifeline-ui-{datetime.now(timezone.utc):%Y%m%d-%H%M}"
    init = api.datasets.upload.initiate(name=name, file_format="jsonl")
    httpx.put(init.upload_url, content=data, timeout=60).raise_for_status()
    s3_key = urlparse(init.upload_url).path.lstrip("/")
    done = api.datasets.upload.complete(s3_key=s3_key, name=name, file_format="jsonl", file_size_bytes=len(data))
    print(f"Uploaded {len(rows)} strings as dataset {done.dataset_id} ({done.status})")
    return done.dataset_id


def wait(api, dataset_id: str, timeout_s: int = 1800) -> None:
    start = time.monotonic()
    while True:
        st = api.datasets.get_status(dataset_id)
        pct = st.progress.percent if st.progress else None
        print(f"  {st.status}{f' {pct}%' if pct is not None else ''}")
        if st.status in ("succeeded", "failed"):
            if st.status == "failed":
                print(f"  failed: {st.error_data}")
            return
        if time.monotonic() - start > timeout_s:
            sys.exit("Timed out waiting for Adaption")
        time.sleep(15)


def collect(downloaded: bytes, english: dict[str, str]) -> tuple[dict[str, dict[str, str]], list[str]]:
    """Map Adaption's output rows back to keys per language. Returns (translations, problems)."""
    out: dict[str, dict[str, str]] = {lang: {} for lang in LANGUAGES}
    problems = []
    for line in io.StringIO(downloaded.decode("utf-8")):
        if not line.strip():
            continue
        row = json.loads(line)
        row_id, text = row.get("id"), row.get("text")
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
    for scope, folder in SOURCES.items():
        for lang, rows in translations.items():
            catalogue = {k.split(":", 1)[1]: v for k, v in sorted(rows.items()) if k.startswith(f"{scope}:")}
            (folder / f"{lang}.json").write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"  {folder.relative_to(ROOT)}/{lang}.json: {len(catalogue)} strings")
        meta = {
            "generated_by": "Adaption datasets.translate (tools/translate_with_adaption.py)",
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "adaption_datasets": dataset_ids,
            "reviewed_by_native_speaker": False,
        }
        (folder / "translations.meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--run", action="store_true", help="spend credits and translate (default: estimate only)")
    parser.add_argument("--dataset", help="reuse an already uploaded dataset id")
    args = parser.parse_args()

    rows = build_rows()
    english = {r["id"]: r["text"] for r in rows}
    api = client()
    dataset_id = args.dataset or upload(api, rows)
    wait(api, dataset_id)

    estimate = api.datasets.translate(dataset_id, sample_rate=1.0, languages=list(LANGUAGES), estimate=True)
    print(f"Estimate: {estimate.estimated_credits_consumed} credits for {estimate.estimated_new_rows} new rows")
    if not args.run:
        print(f"Estimate only. To translate: --run --dataset {dataset_id}")
        return

    job = api.datasets.translate(
        dataset_id, sample_rate=1.0, languages=list(LANGUAGES), idempotency_key=f"lifeline-{uuid.uuid4()}"
    )
    print(f"Translating into dataset {job.dataset_id}")
    wait(api, job.dataset_id)
    downloaded = api.datasets.download(job.dataset_id, file_format="jsonl").read()
    translations, problems = collect(downloaded, english)
    for p in problems:
        print("  !", p)
    write(translations, {"source": dataset_id, "translated": job.dataset_id})
    missing = {lang: len(english) - len(t) for lang, t in translations.items()}
    print(f"Done. Untranslated (English fallback): {missing}. Have a native speaker review before the demo.")


if __name__ == "__main__":
    main()

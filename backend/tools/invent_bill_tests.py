"""Build a test set for the on-device bill reader with Adaption's "invent a dataset".

    cd backend
    uv run --with adaption python tools/invent_bill_tests.py            # cost estimate only
    uv run --with adaption python tools/invent_bill_tests.py --run      # generate (needs ADAPTION_API_KEY in .env)

Adaption generates OCR-style text of Gujarat electricity bills (every DISCOM,
bilingual labels, OCR noise, bills with only meter readings) paired with the
true figures. Generated labels can be wrong, so each bill is verified against
its own text before it is kept: the units must be printed on the bill, or equal
present minus previous reading, and the billing days and amount must appear.
Verified bills are written to frontend/src/lib/__fixtures__/bills.adaption.jsonl
and the bill parser's unit test reports its accuracy on them.

These bills are test data only. They never appear in the app.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend/src/lib/__fixtures__/bills.adaption.jsonl"

PROMPT = """Electricity bills from Gujarat, India, as raw OCR text from a phone photo, each paired with the true figures.

prompt: the OCR text of one residential electricity bill, 8-25 lines, as an OCR engine would output it from a photo:
- issuers vary evenly across DGVCL (Dakshin Gujarat Vij Company), MGVCL, PGVCL, UGVCL and Torrent Power (Ahmedabad, Surat);
- realistic layouts: consumer name and number, bill date, billing period dates, present and previous meter readings,
  units consumed, billing days, energy charges, fixed charge, FPPPA/FPPAS, electricity duty, net amount payable;
- most bills bi-monthly (55-65 days), some monthly; units 40-1500;
- some bills bilingual with Gujarati labels (e.g. વપરાશ યુનિટ, કુલ રકમ), some with only meter readings and no units line,
  some with OCR noise (O for 0, broken lines, stray | characters, merged words).

completion: JSON only, {"units_kwh": number, "billing_days": number or null, "amount_rs": number or null},
with values exactly as printed on that bill (units = present minus previous reading when no units line is printed)."""


def numbers_in(text: str) -> set[float]:
    cleaned = text.replace(",", "")
    return {float(n) for n in re.findall(r"\d+(?:\.\d+)?", cleaned)}


def readings_difference(text: str) -> float | None:
    upper = text.upper().replace(",", "")
    cur = re.search(r"(?:PRESENT|CURRENT|CURR\.?|CLOSING|FINAL)\D{0,30}?(\d{3,8})", upper)
    prev = re.search(r"(?:PREVIOUS|PREV\.?|PAST|OPENING|INITIAL)\D{0,30}?(\d{3,8})", upper)
    return float(cur.group(1)) - float(prev.group(1)) if cur and prev else None


def verify(text: str, label: dict) -> str | None:
    """None if the label is supported by the bill text, otherwise why not."""
    units = label.get("units_kwh")
    if not isinstance(units, (int, float)) or not 0 < units <= 5000:
        return "units missing or implausible"
    present = numbers_in(text)
    if float(units) not in present and readings_difference(text) != float(units):
        return "units not on the bill"
    for key in ("billing_days", "amount_rs"):
        v = label.get(key)
        if v is not None and float(v) not in present:
            return f"{key} not on the bill"
    return None


def extract(row: dict) -> tuple[str | None, dict | None]:
    text = row.get("enhanced_prompt") or row.get("prompt")
    answer = row.get("enhanced_completion") or row.get("completion")
    if not isinstance(text, str) or not isinstance(answer, str):
        return None, None
    match = re.search(r"\{.*\}", answer, flags=re.S)
    try:
        return text, json.loads(match.group(0)) if match else None
    except json.JSONDecodeError:
        return text, None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--run", action="store_true", help="spend credits and generate (default: estimate only)")
    parser.add_argument("--rows", type=int, default=300)
    parser.add_argument("--dataset", help="download an already generated dataset instead of inventing a new one")
    args = parser.parse_args()

    sys.path.insert(0, str(ROOT / "backend"))
    from adaption import Adaption  # noqa: PLC0415

    from app.config import get_settings

    key = get_settings().adaption_api_key
    if not key:
        sys.exit("Add ADAPTION_API_KEY to backend/.env first.")
    api = Adaption(api_key=key)

    dataset_id = args.dataset
    if not dataset_id:
        est = api.datasets.invent(name="gujarat-bill-ocr-test", rows=args.rows, dataset_prompt=PROMPT, estimate=True)
        print(f"Estimate: {est.estimated_credits} credits for {args.rows} bills (available: {est.available_credits})")
        if not args.run:
            return
        job = api.datasets.invent(name="gujarat-bill-ocr-test", rows=args.rows, dataset_prompt=PROMPT)
        dataset_id = job.id
        print(f"Generating dataset {dataset_id}", flush=True)

    last = None
    while True:
        st = api.datasets.get_status(dataset_id)
        line = f"  {st.status}{f' {st.progress.percent}%' if st.progress and st.progress.percent is not None else ''}"
        if line != last:
            print(line, flush=True)
            last = line
        if st.status in ("succeeded", "failed"):
            break
        time.sleep(20)
    if st.status == "failed":
        sys.exit(f"Adaption failed: {st.error_data}")

    raw = api.datasets.download(dataset_id, file_format="jsonl").read().decode("utf-8")
    kept, rejected = [], {}
    for line in raw.splitlines():
        if not line.strip():
            continue
        text, label = extract(json.loads(line))
        if text is None or label is None:
            rejected["unreadable row"] = rejected.get("unreadable row", 0) + 1
            continue
        reason = verify(text, label)
        if reason:
            rejected[reason] = rejected.get(reason, 0) + 1
            continue
        kept.append({"text": text, "units_kwh": label["units_kwh"], "billing_days": label.get("billing_days"),
                     "amount_rs": label.get("amount_rs")})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    header = {"_source": f"Adaption invent, dataset {dataset_id}", "_generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "_note": "Synthetic test bills, verified against their own text. Test data only."}
    OUT.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in [header, *kept]) + "\n", encoding="utf-8")
    print(f"Kept {len(kept)} verified bills, rejected {sum(rejected.values())}: {rejected}")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

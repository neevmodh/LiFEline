"""The weekly coach: a short note about the household's own week.

The numbers are computed here, from the database, and nowhere else. An AI model may turn them into
friendlier words, but its note is only used when every number in it is one of the numbers it was
given (and written in ASCII digits, so none can slip past in another script); otherwise, or with no
AI key, the note is the plain template. The app labels an AI note "written by AI from your numbers".
"""

import json
import logging
import re

import httpx

from app.config import get_settings
from app.i18n import tr
from app.services.bill_scan import GROQ_URL

log = logging.getLogger(__name__)

NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
OTHER_DIGITS = re.compile(r"[०-९૦-૯]")  # Devanagari and Gujarati digits
LANGUAGE = {"en": "English", "gu": "Gujarati", "hi": "Hindi"}


def _forms(v: float) -> set[str]:
    out = {str(v)}
    if isinstance(v, float):
        out |= {f"{v:g}", f"{v:.1f}", str(round(v))}
        if v.is_integer():
            out.add(str(int(v)))
    return out


def numbers_ok(text: str, facts: dict) -> bool:
    """True when every number written in `text` is one of the fact values."""
    if OTHER_DIGITS.search(text):
        return False
    allowed: set[str] = set()
    for v in facts.values():
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            allowed |= _forms(v)
    return all(n.replace(",", ".") in allowed or n in allowed for n in NUMBER.findall(text))


def template(facts: dict, locale: str) -> str:
    if not facts.get("actions"):
        return tr(locale, "coach.empty")
    return tr(locale, "coach.template", **facts)


async def ask_llm(prompt: str) -> str:
    settings = get_settings()
    body = {
        "model": settings.groq_model,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_schema", "json_schema": {
            "name": "coach", "strict": True,
            "schema": {"type": "object", "properties": {"note": {"type": "string"}}, "required": ["note"],
                       "additionalProperties": False}}},
        "max_completion_tokens": 400,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(GROQ_URL, json=body, headers={"Authorization": f"Bearer {settings.groq_api_key}"})
    resp.raise_for_status()
    return json.loads(resp.json()["choices"][0]["message"]["content"])["note"].strip()


async def weekly_note(facts: dict, locale: str) -> tuple[str, bool]:
    """(note, written_by_ai)."""
    settings = get_settings()
    if not (settings.groq_api_key and settings.enable_external_apis) or not facts.get("actions"):
        return template(facts, locale), False
    prompt = (
        f"Write a warm, two-sentence note in {LANGUAGE.get(locale, 'English')} to a household in Gujarat about their "
        "week of green actions for Mission LiFE. Use ONLY these facts and no other numbers, no percentages, no "
        "comparisons with anyone; write numbers with ASCII digits exactly as given:\n"
        + json.dumps(facts, ensure_ascii=False)
    )
    try:
        text = await ask_llm(prompt)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("Coach model unavailable: %s", exc)
        return template(facts, locale), False
    if text and numbers_ok(text, facts):
        return text, True
    log.info("Coach note rejected: a number not in its input")
    return template(facts, locale), False

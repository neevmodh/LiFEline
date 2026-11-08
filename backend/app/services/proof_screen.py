"""AI pre-screening of action proof photos.

A vision model looks at the photo and the action it claims to show, and says
whether it is likely, unlikely or unclear. It never approves anything: GEDA
reviewers still decide, but the queue shows them what to look at first. If no
AI provider is configured or it fails, the proof simply goes to review
unscreened.
"""

import json
import logging
from dataclasses import dataclass

from app.config import get_settings
from app.services.bill_scan import (
    BillScanFailed,
    BillScanUnavailable,
    anthropic_json,
    groq_json,
)

log = logging.getLogger(__name__)

SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["likely", "unlikely", "unsure"]},
        "confidence": {"type": "number"},
        "reason": {"type": "string"},
    },
    "required": ["verdict", "confidence", "reason"],
    "additionalProperties": False,
}

PROMPT = """A citizen submitted this photo as proof of a green action in a Mission LiFE app.

Action: {title}
Description: {description}

Does the photo plausibly show this action being done? Answer:
- verdict: "likely" if it clearly shows it, "unlikely" if it shows something unrelated
  (a screenshot, a stock image, a different activity), "unsure" otherwise.
- confidence: from 0 to 1.
- reason: one short sentence a reviewer can check. Do not describe people's faces or identify anyone."""


@dataclass(frozen=True)
class Screening:
    verdict: str
    confidence: float
    reason: str


async def screen_proof(image: bytes, media_type: str, title: str, description: str) -> Screening | None:
    settings = get_settings()
    prompt = PROMPT.format(title=title, description=description)
    try:
        if settings.groq_api_key:
            text = await groq_json(image, media_type, prompt, SCHEMA, "proof")
        elif settings.anthropic_api_key:
            text = await anthropic_json(image, media_type, prompt, SCHEMA)
        else:
            return None
        data = json.loads(text)
        return Screening(
            verdict=data["verdict"] if data["verdict"] in ("likely", "unlikely", "unsure") else "unsure",
            confidence=max(0.0, min(1.0, float(data["confidence"]))),
            reason=str(data["reason"])[:300],
        )
    except (BillScanUnavailable, BillScanFailed, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        log.warning("Proof screening skipped: %s", exc)
        return None

"""Read an electricity bill photo with Claude vision.

Only the consumption figures are extracted. The image is not stored, and the
prompt tells the model to ignore personal details such as name, address and
consumer number.
"""

import base64
import json
import logging
from dataclasses import dataclass

import anthropic

from app.config import get_settings

log = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
# Server-side fallback re-runs a declined request on Anthropic's recommended model.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

PROMPT = """This is a photo of an Indian residential electricity bill.
Extract the consumption figures for the billing period shown.

- units_kwh: total units (kWh) billed for the period. If only meter readings are shown, use current minus previous.
- billing_days: number of days in the billing period, if shown or derivable from the period dates.
- billing_period_end: the month the billing period ends, as YYYY-MM.
- bill_amount_rs: the total amount payable in rupees.
- distributor: the electricity distribution company (for example DGVCL, MGVCL, PGVCL, UGVCL, Torrent Power).
- confidence: high if the units figure is printed clearly, medium if you derived it, low if you are unsure.

Use null for anything that is not on the bill. Do not include names, addresses, or account numbers.
If the image is not an electricity bill, return null for every field and confidence low."""

SCHEMA = {
    "type": "object",
    "properties": {
        "units_kwh": {"type": ["number", "null"]},
        "billing_days": {"type": ["integer", "null"]},
        "billing_period_end": {"type": ["string", "null"]},
        "bill_amount_rs": {"type": ["number", "null"]},
        "distributor": {"type": ["string", "null"]},
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
    },
    "required": ["units_kwh", "billing_days", "billing_period_end", "bill_amount_rs", "distributor", "confidence"],
    "additionalProperties": False,
}


class BillScanUnavailable(Exception):
    """AI scanning is not configured; the client should fall back to on-device OCR."""


class BillScanFailed(Exception):
    pass


@dataclass(frozen=True)
class BillReading:
    units_kwh: float | None
    billing_days: int | None
    billing_period_end: str | None
    bill_amount_rs: float | None
    distributor: str | None
    confidence: str

    @property
    def monthly_kwh(self) -> float | None:
        """Normalise to a 30-day month; many Gujarat residential bills are bi-monthly."""
        if self.units_kwh is None:
            return None
        if self.billing_days and 20 <= self.billing_days <= 70:
            return round(self.units_kwh * 30 / self.billing_days, 1)
        return self.units_kwh


_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    settings = get_settings()
    if not settings.ai_bill_scan_enabled:
        raise BillScanUnavailable("AI bill scanning is not configured")
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=45.0, max_retries=2)
    return _client


async def scan_bill(image: bytes, media_type: str) -> BillReading:
    client = _get_client()
    try:
        response = await client.beta.messages.create(
            model=MODEL,
            max_tokens=2048,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            # Reading a few numbers off a bill is simple; low effort keeps it fast and cheap.
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64.standard_b64encode(image).decode(),
                            },
                        },
                        {"type": "text", "text": PROMPT},
                    ],
                }
            ],
        )
    except anthropic.AuthenticationError as exc:
        log.error("Anthropic credentials rejected: %s", exc)
        raise BillScanUnavailable("AI bill scanning credentials are invalid") from exc
    except (anthropic.RateLimitError, anthropic.APIConnectionError, anthropic.APIStatusError) as exc:
        log.warning("Bill scan request failed: %s", exc)
        raise BillScanFailed("The bill reader is busy. Try again or enter the units manually.") from exc

    if response.stop_reason == "refusal":
        raise BillScanFailed("Couldn't read this image. Try a clearer photo of the bill.")
    if response.stop_reason == "max_tokens":
        raise BillScanFailed("Couldn't read this bill. Enter the units manually.")

    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise BillScanFailed("Couldn't read this bill. Enter the units manually.")
    data = json.loads(text)
    return BillReading(**data)

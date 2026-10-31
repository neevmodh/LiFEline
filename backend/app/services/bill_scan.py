"""Read an electricity bill photo with a vision model.

Two providers are supported, chosen by which API key is configured (Groq first):
- Groq: an OpenAI-compatible vision model with strict JSON-schema output
- Anthropic: Claude vision with structured output and server-side fallback

Only the consumption figures are extracted. The image is not stored, and the
prompt tells the model to leave out personal details such as name, address and
consumer number. When no provider is configured, or the provider is busy or
unreachable, BillScanUnavailable tells the client to read the bill on-device.
"""

import base64
import json
import logging
from dataclasses import dataclass

import anthropic
import httpx

from app.config import get_settings

log = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Groq rejects base64 image payloads above 4 MB.
GROQ_MAX_BASE64_BYTES = 4 * 1024 * 1024

ANTHROPIC_MODEL = "claude-opus-5-5"
# Server-side fallback re-runs a declined request on Anthropic's recommended model.
ANTHROPIC_FALLBACK_BETA = "server-side-fallback-2026-07-01"

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
    """No AI reader right now (not configured, busy or unreachable); the client reads on-device."""


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


@dataclass(frozen=True)
class ScanResult:
    reading: BillReading
    provider: str  # "groq" or "anthropic"


UNREADABLE = "Couldn't read this bill. Try a clearer photo or enter the units manually."


def _reading_from_json(text: str) -> BillReading:
    try:
        data = json.loads(text)
        return BillReading(**{key: data[key] for key in SCHEMA["required"]})
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        log.warning("Bill reader returned malformed output: %s", exc)
        raise BillScanFailed(UNREADABLE) from exc


async def _scan_with_groq(image: bytes, media_type: str) -> BillReading:
    settings = get_settings()
    data_url = f"data:{media_type};base64,{base64.standard_b64encode(image).decode()}"
    if len(data_url) > GROQ_MAX_BASE64_BYTES:
        raise BillScanUnavailable("Photo is too large for the AI reader")

    body = {
        "model": settings.groq_model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
        "response_format": {"type": "json_schema", "json_schema": {"name": "bill", "schema": SCHEMA, "strict": True}},
        "max_completion_tokens": 2048,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(GROQ_URL, json=body, headers={"Authorization": f"Bearer {settings.groq_api_key}"})
    except httpx.HTTPError as exc:
        log.warning("Groq unreachable: %s", exc)
        raise BillScanUnavailable("AI reader unreachable") from exc

    if resp.status_code in (401, 403):
        log.error("Groq rejected the API key (%s)", resp.status_code)
        raise BillScanUnavailable("AI reader credentials are invalid")
    if resp.status_code == 429 or resp.status_code >= 500:
        log.warning("Groq busy (%s): %s", resp.status_code, resp.text[:200])
        raise BillScanUnavailable("AI reader is busy")
    if resp.status_code != 200:
        log.warning("Groq request failed (%s): %s", resp.status_code, resp.text[:300])
        raise BillScanFailed(UNREADABLE)

    choice = resp.json()["choices"][0]
    if choice.get("finish_reason") != "stop":
        raise BillScanFailed(UNREADABLE)
    return _reading_from_json(choice["message"]["content"] or "")


_anthropic_client: anthropic.AsyncAnthropic | None = None


async def _scan_with_anthropic(image: bytes, media_type: str) -> BillReading:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic(
            api_key=get_settings().anthropic_api_key, timeout=45.0, max_retries=2
        )
    try:
        response = await _anthropic_client.beta.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=2048,
            betas=[ANTHROPIC_FALLBACK_BETA],
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
        raise BillScanUnavailable("AI reader credentials are invalid") from exc
    except (anthropic.RateLimitError, anthropic.APIConnectionError, anthropic.InternalServerError) as exc:
        log.warning("Anthropic busy or unreachable: %s", exc)
        raise BillScanUnavailable("AI reader is busy") from exc
    except anthropic.APIStatusError as exc:
        log.warning("Bill scan request failed: %s", exc)
        raise BillScanFailed(UNREADABLE) from exc

    if response.stop_reason != "end_turn":  # refusal, max_tokens, ...
        raise BillScanFailed(UNREADABLE)
    text = next((b.text for b in response.content if b.type == "text"), "")
    return _reading_from_json(text)


async def scan_bill(image: bytes, media_type: str) -> ScanResult:
    settings = get_settings()
    if settings.groq_api_key:
        return ScanResult(await _scan_with_groq(image, media_type), "groq")
    if settings.anthropic_api_key:
        return ScanResult(await _scan_with_anthropic(image, media_type), "anthropic")
    raise BillScanUnavailable("AI bill scanning is not configured")

"""Groq provider: request shape and how each kind of response is handled (no network)."""

import asyncio
import json

import httpx
import pytest

from app.config import get_settings
from app.services import bill_scan
from app.services.bill_scan import BillScanFailed, BillScanUnavailable, scan_bill

GOOD = {
    "units_kwh": 540, "billing_days": 61, "billing_period_end": "2026-08",
    "bill_amount_rs": 4215.5, "distributor": "DGVCL", "confidence": "high",
}


@pytest.fixture()
def groq(monkeypatch):
    """Route the Groq call to a handler; returns the list of captured requests."""
    monkeypatch.setattr(get_settings(), "groq_api_key", "test-key")
    captured: list[httpx.Request] = []
    reply: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return reply["fn"](request)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        bill_scan.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)
    )
    return captured, reply


def completion(content: str, finish_reason: str = "stop") -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"finish_reason": finish_reason, "message": {"content": content}}]})


def run(image: bytes = b"\x89PNG data"):
    return asyncio.run(scan_bill(image, "image/png"))


def test_groq_success_sends_image_and_strict_schema(groq):
    captured, reply = groq
    reply["fn"] = lambda req: completion(json.dumps(GOOD))
    result = run()
    assert result.provider == "groq"
    assert result.reading.units_kwh == 540 and result.reading.monthly_kwh == 265.6

    body = json.loads(captured[0].content)
    assert captured[0].headers["authorization"] == "Bearer test-key"
    assert body["model"] == get_settings().groq_model
    assert body["response_format"]["json_schema"]["strict"] is True
    image_part = body["messages"][0]["content"][0]
    assert image_part["image_url"]["url"].startswith("data:image/png;base64,")


@pytest.mark.parametrize("status", [429, 500, 503, 401])
def test_groq_busy_or_misconfigured_falls_back_to_device(groq, status):
    _, reply = groq
    reply["fn"] = lambda req: httpx.Response(status, json={"error": {"message": "nope"}})
    with pytest.raises(BillScanUnavailable):
        run()


def test_groq_unreachable_falls_back_to_device(groq):
    _, reply = groq

    def boom(req):
        raise httpx.ConnectError("down", request=req)

    reply["fn"] = boom
    with pytest.raises(BillScanUnavailable):
        run()


@pytest.mark.parametrize(
    "response",
    [
        completion("not json"),
        completion(json.dumps({"units_kwh": 5})),  # missing fields
        completion(json.dumps(GOOD), finish_reason="length"),
        httpx.Response(400, json={"error": {"message": "bad image"}}),
    ],
)
def test_groq_unusable_output_is_a_clear_failure(groq, response):
    _, reply = groq
    reply["fn"] = lambda req: response
    with pytest.raises(BillScanFailed):
        run()


def test_oversized_photo_skips_groq(groq):
    captured, reply = groq
    reply["fn"] = lambda req: completion(json.dumps(GOOD))
    with pytest.raises(BillScanUnavailable):
        run(b"x" * (3 * 1024 * 1024 + 1))  # base64 grows by a third, past Groq's 4 MB limit
    assert captured == []

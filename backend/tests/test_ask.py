"""Ask Nidhi: grounded answers in the asker's language, with a template whenever the AI can't be trusted."""

import asyncio
from types import SimpleNamespace

import httpx
import pytest

from app.services import ask as ask_service
from app.services.ask import household_facts, template_answer, topic_of


def home(**over):
    base = {"monthly_kwh": 300, "discom": "ugvcl", "area": "urban", "ac_count": 2, "has_geyser": True, "has_washing_machine": True,
                "has_ev": False, "has_solar": False, "roof_area_sqm": 40, "commute_mode": "car", "commute_km_per_day": 8,
                "lpg_cylinders_per_month": 1}
    base.update(over)
    return SimpleNamespace(**base)


@pytest.mark.parametrize(("question", "topic"), [
    ("Is 24°C on my AC worth it?", "ac"),
    ("When should I run the washing machine?", "peak"),
    ("Is rooftop solar worth it for me?", "solar"),
    ("Why is my bill so high?", "bill"),
    ("How much do LED bulbs save?", "led"),
    ("Should I unplug the TV at night?", "standby"),
    ("How do I save on the geyser?", "geyser"),
    ("મારું બિલ કેમ વધારે છે?", "bill"),
    ("શું છત પર સોલર ફાયદાકારક છે?", "solar"),
    ("गीज़र पर कैसे बचत करें?", "geyser"),
    ("वॉशिंग मशीन कब चलाऊँ?", "peak"),
    ("Tell me a joke", "general"),
    ("Go back", "general"),  # "ac" inside "back" is not about the AC
])
def test_topics_in_three_languages(question, topic):
    assert topic_of(question) == topic


def test_facts_are_this_households_own():
    f = household_facts(home(), 1550)
    assert f["kwh"] == 300 and f["acs"] == 2 and f["ac_rs"] > 0
    assert f["solar_kw"] == 2.5  # min(40 m² / 10, 300 × 12 / 1550 = 2.3) rounded to halves
    assert f["peak_from"] == 18 and f["peak_to"] == 22


def test_no_roof_means_no_solar_size():
    assert household_facts(home(roof_area_sqm=None), 1550)["solar_kw"] == 0


@pytest.mark.parametrize("locale", ["en", "gu", "hi"])
def test_every_topic_has_a_template_in_every_language(locale):
    for topic in ("ac", "geyser", "solar", "bill", "peak", "led", "standby", "water", "travel", "general"):
        text, _ = template_answer(topic, home(), household_facts(home(), 1550), locale)
        assert text and "{" not in text


def test_templates_respect_the_home():
    facts = household_facts(home(ac_count=0, has_geyser=False, has_solar=True), 1550)
    assert template_answer("ac", home(ac_count=0), facts, "en") == (template_answer("ac", home(ac_count=0), facts, "en")[0], None)
    assert "no AC" in template_answer("ac", home(ac_count=0), facts, "en")[0]
    assert "no electric geyser" in template_answer("geyser", home(has_geyser=False), facts, "en")[0]
    assert "already has rooftop solar" in template_answer("solar", home(has_solar=True), facts, "en")[0]
    assert template_answer("travel", home(commute_mode="bus"), facts, "en")[1] == "cycle_walk"


def _fake_llm(text, code):
    async def fake(question, facts, locale):
        return text, code
    return fake


@pytest.fixture()
def ai_on(monkeypatch):
    from app.config import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "groq_api_key", "test-key")
    monkeypatch.setattr(s, "enable_external_apis", True)


def test_an_ai_answer_with_only_known_numbers_is_used(ai_on, monkeypatch):
    monkeypatch.setattr(ask_service, "_ask_llm", _fake_llm("Set it to 24°C and save on your 300 units.", "ac_24"))
    a = asyncio.run(ask_service.answer("AC?", home(), 1550, "en"))
    assert a.written_by_ai and a.action_code == "ac_24"


def test_an_ai_answer_with_an_invented_number_falls_back(ai_on, monkeypatch):
    monkeypatch.setattr(ask_service, "_ask_llm", _fake_llm("You will save ₹9999 a month!", "ac_24"))
    a = asyncio.run(ask_service.answer("Is 24°C on my AC worth it?", home(), 1550, "en"))
    assert not a.written_by_ai and "9999" not in a.text and a.action_code == "ac_24"


def test_an_ai_answer_with_an_unknown_action_falls_back(ai_on, monkeypatch):
    monkeypatch.setattr(ask_service, "_ask_llm", _fake_llm("Do this.", "delete_everything"))
    assert not asyncio.run(ask_service.answer("AC?", home(), 1550, "en")).written_by_ai


def test_the_model_being_down_falls_back(ai_on, monkeypatch):
    async def down(*_):
        raise httpx.ConnectError("down")
    monkeypatch.setattr(ask_service, "_ask_llm", down)
    a = asyncio.run(ask_service.answer("Why is my bill so high?", home(), 1550, "gu"))
    assert not a.written_by_ai and "₹" in a.text


def test_endpoint(client, citizen):
    r = client.post("/api/coach/ask", json={"question": "How much do LED bulbs save?"}, headers=citizen)
    assert r.status_code == 200
    body = r.json()
    assert body["topic"] == "led" and body["action_code"] == "led_switch" and body["action_title"]
    gu = client.post("/api/coach/ask", json={"question": "LED"}, headers={**citizen, "Accept-Language": "gu"}).json()
    assert "₹" in gu["answer"] and "saves" not in gu["answer"]


def test_endpoint_validation_and_limits(client, citizen):
    from tests.conftest import register

    assert client.post("/api/coach/ask", json={"question": "  "}, headers=citizen).status_code == 422
    assert client.post("/api/coach/ask", json={"question": "x" * 301}, headers=citizen).status_code == 422
    assert client.post("/api/coach/ask", json={"question": "AC?"}).status_code == 401
    assert client.post("/api/coach/ask", json={"question": "AC?"}, headers=register(client, "new@example.com")).status_code == 409
    codes = [client.post("/api/coach/ask", json={"question": "AC?"}, headers=citizen).status_code for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429


def test_gujarati_and_hindi_never_use_the_model(ai_on, monkeypatch):
    called = []

    async def spy(*args):
        called.append(args)
        return "x", None
    monkeypatch.setattr(ask_service, "_ask_llm", spy)
    for locale in ("gu", "hi"):
        a = asyncio.run(ask_service.answer("LED?", home(), 1550, locale))
        assert not a.written_by_ai and a.topic == "led"
    assert called == []

"""The weekly coach: AI writes the note, but only from the household's own numbers."""

import pytest

from app.services import coach

FACTS = {"actions": 5, "verified": 2, "co2_kg": 3.4, "kwh": 4.2, "rs": 31, "active_days": 4, "streak": 3}


def test_numbers_ok_accepts_only_numbers_from_the_input():
    assert coach.numbers_ok("You logged 5 actions and saved ₹31 and 3.4 kg CO₂ over 4 days.", FACTS)
    assert not coach.numbers_ok("You logged 5 actions and saved ₹45.", FACTS)  # 45 is invented
    assert not coach.numbers_ok("That's 20% better than last week.", FACTS)
    assert coach.numbers_ok("Keep going: a 3-day streak is a habit forming.", FACTS)


def test_template_uses_the_numbers(monkeypatch):
    text = coach.template(FACTS, "en")
    assert "5" in text and "3.4" in text and coach.numbers_ok(text, FACTS)


@pytest.fixture()
def ai(monkeypatch):
    s = coach.get_settings()
    monkeypatch.setattr(s, "groq_api_key", "test-key")
    monkeypatch.setattr(s, "enable_external_apis", True)
    reply = {"text": ""}

    async def fake_llm(prompt):
        return reply["text"]

    monkeypatch.setattr(coach, "ask_llm", fake_llm)
    return reply


def test_ai_note_is_used_when_every_number_is_real(client, citizen, ai):
    client.post("/api/actions", data={"action_code": "geyser_off"}, headers=citizen)
    facts = client.get("/api/coach/weekly", headers=citizen).json()["facts"]
    ai["text"] = f"Nice week: {facts['actions']} action logged. Try one more tomorrow."
    note = client.get("/api/coach/weekly", headers=citizen).json()
    assert note["written_by_ai"] is True and note["text"] == ai["text"]


def test_ai_note_with_an_invented_number_falls_back_to_the_template(client, citizen, ai):
    ai["text"] = "You cut your bill by 40% this week!"
    note = client.get("/api/coach/weekly", headers=citizen).json()
    assert note["written_by_ai"] is False and "40" not in note["text"]


def test_no_ai_key_means_the_template(client, citizen):
    note = client.get("/api/coach/weekly", headers=citizen).json()
    assert note["written_by_ai"] is False and note["text"]
    assert client.get("/api/coach/weekly").status_code == 401

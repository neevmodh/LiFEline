"""Server-side translations and the Adaption translation pipeline's safety checks."""

import importlib.util
import json
from pathlib import Path

import pytest

from app import i18n
from app.i18n import locale_from_header, tr
from app.services.nudges import Nudge


@pytest.mark.parametrize(
    "header,locale",
    [("gu-IN,gu;q=0.9,en;q=0.8", "gu"), ("hi", "hi"), ("en-US,en", "en"), ("fr-FR", "en"), (None, "en"), ("", "en")],
)
def test_locale_from_accept_language(header, locale):
    assert locale_from_header(header) == locale


@pytest.fixture()
def gujarati(monkeypatch):
    """A tiny Gujarati catalogue, one entry with a broken placeholder."""
    fake = {
        "gu": {
            "action.ac_24.title": "આખો દિવસ AC 24°C પર",
            "nudge.short_commute.body": "{km} કિમી રોજ બસથી {kg} kg CO2 બચે છે.",
            "nudge.pre_cool.title": "પીક {wrong}:00 વાગ્યે",
        }
    }
    real = i18n.catalogue

    def catalogue(locale):
        return fake.get(locale) or real(locale)

    monkeypatch.setattr(i18n, "catalogue", catalogue)


def test_translation_with_placeholders_and_fallbacks(gujarati):
    assert tr("gu", "action.ac_24.title") == "આખો દિવસ AC 24°C પર"
    assert tr("gu", "nudge.short_commute.body", km="6", kg="0.8") == "6 કિમી રોજ બસથી 0.8 kg CO2 બચે છે."
    # Missing key: English.
    assert tr("gu", "action.geyser_off.title") == "Geyser off after use"
    # Translation that broke a placeholder: English rather than an error.
    assert tr("gu", "nudge.pre_cool.title", peak_start=18) == "Peak starts at 18:00 - pre-cool now"


def test_nudges_and_actions_follow_accept_language(client, citizen, gujarati):
    types = client.get("/api/actions/types", headers={**citizen, "Accept-Language": "gu"}).json()
    assert next(t for t in types if t["code"] == "ac_24")["title"] == "આખો દિવસ AC 24°C પર"
    english = client.get("/api/actions/types", headers=citizen).json()
    assert next(t for t in english if t["code"] == "ac_24")["title"] == "AC at 24°C all day"


def test_nudge_appliances_are_translated_at_render_time():
    nudge = Nudge(code="peak_defer", category="peak_shift", priority=100, params={"peak_end": 22},
                  appliances=["geyser", "ev"])
    assert "geyser, EV charging" in nudge.body


def test_every_english_key_used_by_the_api_exists():
    en = json.loads((Path(i18n.__file__).parent / "locales/en.json").read_text())
    from app.seed import ACTIONS

    for code, *_ in ACTIONS:
        assert f"action.{code}.title" in en and f"action.{code}.description" in en


# --- the Adaption pipeline -----------------------------------------------------------

def _tool():
    path = Path(__file__).resolve().parents[1] / "tools/translate_with_adaption.py"
    spec = importlib.util.spec_from_file_location("translate_with_adaption", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_pipeline_maps_rows_by_id_and_script_and_rejects_lost_placeholders():
    tool = _tool()
    english = {"web:nav.home": "Home", "web:dashboard.greeting": "Namaste, {name}", "api:reason.no_ac": "No AC"}
    output = "\n".join(json.dumps(r, ensure_ascii=False) for r in [
        {"id": "web:nav.home", "text": "Home"},                         # original row: ignored
        {"id": "web:nav.home", "text": "હોમ"},                          # Gujarati script
        {"id": "web:nav.home", "text": "होम"},                          # Devanagari script
        {"id": "web:dashboard.greeting", "text": "નમસ્તે, {name}"},
        {"id": "web:dashboard.greeting", "text": "नमस्ते, {नाम}"},        # placeholder translated: rejected
        {"id": "unknown:key", "text": "કંઈક"},                          # not ours: ignored
    ]).encode()
    out, problems = tool.collect(output, english)
    assert out["gu"] == {"web:nav.home": "હોમ", "web:dashboard.greeting": "નમસ્તે, {name}"}
    assert out["hi"] == {"web:nav.home": "होम"}
    assert problems == ["hi web:dashboard.greeting: placeholders changed, kept English"]


def test_pipeline_covers_every_string():
    tool = _tool()
    rows = tool.build_rows()
    ids = {r["id"] for r in rows}
    assert len(ids) == len(rows)  # unique ids
    assert "web:nav.home" in ids and "api:action.ac_24.title" in ids


"""Live translation of typed text (campaigns, notices) with Sarvam AI, cached so each sentence is
translated once per language, and never blocking or breaking a page when Sarvam can't help."""

from datetime import timedelta

import httpx
import pytest
from conftest import HOUSEHOLD, register

from app.config import get_settings
from app.db import SessionLocal
from app.models import TranslationCache
from app.services import translate as tx
from app.timeutil import today_ist

GU = {"Accept-Language": "gu"}
HI = {"Accept-Language": "hi"}
FAKE = {
    ("gu", "Diwali LED switch"): "દિવાળી LED સ્વિચ",
    ("hi", "Diwali LED switch"): "दिवाली LED स्विच",
    ("gu", "Swap 2 bulbs for LEDs before 12 Nov"): "12 નવેમ્બર પહેલાં 2 બલ્બ LED થી બદલો",
    ("hi", "Swap 2 bulbs for LEDs before 12 Nov"): "12 नवंबर से पहले 2 बल्ब LED से बदलें",
    ("gu", "Water tank cleaning on Sunday"): "રવિવારે પાણીની ટાંકીની સફાઈ",
    ("hi", "Water tank cleaning on Sunday"): "रविवार को पानी की टंकी की सफाई",
}


@pytest.fixture()
def sarvam(monkeypatch):
    """Sarvam switched on, with a fake translator that counts its calls."""
    monkeypatch.setattr(get_settings(), "sarvam_api_key", "test-key")
    monkeypatch.setattr(get_settings(), "enable_external_apis", True)
    calls = []

    def fake(text, locale, **_):
        calls.append((locale, text))
        return FAKE.get((locale, text))

    monkeypatch.setattr(tx, "call_sarvam", fake)
    return calls


def campaign(**kw):
    t = today_ist()
    base = {"title": "Diwali LED switch", "description": "Swap 2 bulbs for LEDs before 12 Nov", "target": 50,
            "starts_on": str(t), "ends_on": str(t + timedelta(days=6)), "scope": "state", "action_code": "led_switch"}
    return {**base, **kw}


def citizen(client, n=1):
    h = register(client, email=f"t{n}@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    return h


def cached_rows():
    with SessionLocal() as db:
        return {(r.lang, r.source_text): r.text for r in db.query(TranslationCache)}


# --- the rules a translation must pass -------------------------------------------------------

def test_a_translation_must_keep_every_number_and_be_in_the_readers_script():
    src = "Swap 2 bulbs for LEDs before 12 Nov"
    assert tx.acceptable(src, "12 નવેમ્બર પહેલાં 2 બલ્બ LED થી બદલો", "gu")
    assert not tx.acceptable(src, "નવેમ્બર પહેલાં 2 બલ્બ બદલો", "gu")  # lost the 12
    assert not tx.acceptable(src, "12 नवंबर से पहले 2 बल्ब", "gu")  # Hindi, not Gujarati
    assert not tx.acceptable(src, "", "gu") and not tx.acceptable(src, None, "gu")
    assert tx.acceptable("Save 1,00,000 units", "1,00,000 યુનિટ બચાવો", "gu")
    assert tx.acceptable("Save 100000 units", "1,00,000 યુનિટ બચાવો", "gu")  # separators don't matter


def test_only_english_text_for_a_gujarati_or_hindi_reader_is_sent():
    assert tx.needs_translation("Diwali LED switch", "gu")
    assert not tx.needs_translation("Diwali LED switch", "en")
    assert not tx.needs_translation("દિવાળી LED સ્વિચ", "gu")  # already Gujarati
    assert not tx.needs_translation("18:00 – 20:00", "hi")  # nothing to translate
    assert not tx.needs_translation("", "gu") and not tx.needs_translation(None, "gu")


# --- campaigns -----------------------------------------------------------------------------

def test_a_new_campaign_is_translated_once_and_read_from_the_cache(client, admin_headers, sarvam):
    assert client.post("/api/campaigns", json=campaign(), headers=admin_headers).status_code == 201
    # Translated in the background as it was posted: 2 texts x 2 languages.
    assert sorted(sarvam) == sorted([("gu", "Diwali LED switch"), ("hi", "Diwali LED switch"),
                                     ("gu", "Swap 2 bulbs for LEDs before 12 Nov"),
                                     ("hi", "Swap 2 bulbs for LEDs before 12 Nov")])
    assert cached_rows()[("gu", "Diwali LED switch")] == "દિવાળી LED સ્વિચ"
    asha = citizen(client)
    gu = client.get("/api/campaigns", headers={**asha, **GU}).json()[0]
    assert gu["title"] == "દિવાળી LED સ્વિચ" and gu["description"].startswith("12 નવેમ્બર")
    hi = client.get("/api/campaigns", headers={**asha, **HI}).json()[0]
    assert hi["title"] == "दिवाली LED स्विच"
    en = client.get("/api/campaigns", headers=asha).json()[0]
    assert en["title"] == "Diwali LED switch"  # English readers see what GEDA typed
    tx.clear_memory()  # a fresh server process still has the database cache
    assert client.get("/api/campaigns", headers={**asha, **GU}).json()[0]["title"] == "દિવાળી LED સ્વિચ"
    assert len(sarvam) == 4  # nothing was translated twice


def test_the_campaign_label_and_action_follow_the_readers_language(client, admin_headers):
    client.post("/api/campaigns", json=campaign(), headers=admin_headers)
    asha = citizen(client)
    gu = client.get("/api/campaigns", headers={**asha, **GU}).json()[0]
    assert gu["scope_label"] == "સમગ્ર ગુજરાત"
    assert gu["action_title"] != "Replaced a bulb with LED" and any("઀" <= ch <= "૿" for ch in gu["action_title"])
    assert client.get("/api/campaigns", headers=asha).json()[0]["scope_label"] == "All of Gujarat"


def test_without_a_key_text_stays_as_written_and_nothing_is_called(client, admin_headers, monkeypatch):
    calls = []
    monkeypatch.setattr(tx, "call_sarvam", lambda *a, **k: calls.append(a))
    client.post("/api/campaigns", json=campaign(), headers=admin_headers)
    asha = citizen(client)
    assert client.get("/api/campaigns", headers={**asha, **GU}).json()[0]["title"] == "Diwali LED switch"
    assert calls == [] and cached_rows() == {}


def test_with_external_apis_off_nothing_is_called_even_with_a_key(client, admin_headers, monkeypatch):
    monkeypatch.setattr(get_settings(), "sarvam_api_key", "test-key")
    calls = []
    monkeypatch.setattr(tx, "call_sarvam", lambda *a, **k: calls.append(a))
    client.post("/api/campaigns", json=campaign(), headers=admin_headers)
    assert calls == []


def test_a_failed_translation_shows_the_original_and_is_not_retried_at_once(client, admin_headers, sarvam):
    client.post("/api/campaigns", json=campaign(title="Cycle to work week"), headers=admin_headers)
    asha = citizen(client)
    assert client.get("/api/campaigns", headers={**asha, **GU}).json()[0]["title"] == "Cycle to work week"
    tried = [c for c in sarvam if c[1] == "Cycle to work week"]
    assert tried == [("gu", "Cycle to work week"), ("hi", "Cycle to work week")]  # once each, when posted
    client.get("/api/campaigns", headers={**asha, **GU})
    assert len([c for c in sarvam if c[1] == "Cycle to work week"]) == 2  # remembered as failed
    assert ("gu", "Cycle to work week") not in cached_rows()


def test_a_page_never_waits_for_sarvam_an_uncached_text_is_translated_after(client, admin_headers, monkeypatch):
    client.post("/api/campaigns", json=campaign(), headers=admin_headers)  # posted before the key was added
    monkeypatch.setattr(get_settings(), "sarvam_api_key", "test-key")
    monkeypatch.setattr(get_settings(), "enable_external_apis", True)
    monkeypatch.setattr(tx, "call_sarvam", lambda text, locale, **_: FAKE.get((locale, text)))
    asha = citizen(client)
    first = client.get("/api/campaigns", headers={**asha, **GU}).json()[0]
    assert first["title"] == "Diwali LED switch"  # not cached yet: shown as written, translated behind
    assert client.get("/api/campaigns", headers={**asha, **GU}).json()[0]["title"] == "દિવાળી LED સ્વિચ"


# --- community notices and the alerts that quote them ----------------------------------------

def test_a_community_notice_and_its_alert_are_translated(client, sarvam):
    chair = citizen(client, 1)
    s = client.post("/api/societies", json={"name": "Shanti Apartments"}, headers=chair).json()
    member = citizen(client, 2)
    client.post("/api/societies/join", json={"code": s["join_code"]}, headers=member)
    assert client.post("/api/societies/announcements", json={"text": "Water tank cleaning on Sunday"},
                       headers=chair).status_code == 201
    mine = client.get("/api/societies/mine", headers={**member, **GU}).json()
    assert mine["announcements"][0]["text"] == "રવિવારે પાણીની ટાંકીની સફાઈ"
    assert client.get("/api/societies/mine", headers=member).json()["announcements"][0]["text"] == \
        "Water tank cleaning on Sunday"
    alerts = client.get("/api/notifications", headers={**member, **HI}).json()["items"]
    assert any("रविवार को पानी की टंकी की सफाई" in (a["title"] + a["body"]) for a in alerts)


# --- the request to Sarvam itself --------------------------------------------------------------

def test_the_sarvam_request_and_its_failures(monkeypatch):
    monkeypatch.setattr(get_settings(), "sarvam_api_key", "test-key")
    seen = {}

    def ok(url, json, headers, timeout):
        seen.update(url=url, json=json, headers=headers)
        return httpx.Response(200, json={"translated_text": "દિવાળી LED સ્વિચ"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(tx.httpx, "post", ok)
    assert tx.call_sarvam("Diwali LED switch", "gu") == "દિવાળી LED સ્વિચ"
    assert seen["url"] == "https://api.sarvam.ai/translate"
    assert seen["headers"]["api-subscription-key"] == "test-key"
    assert seen["json"]["source_language_code"] == "en-IN" and seen["json"]["target_language_code"] == "gu-IN"
    assert seen["json"]["numerals_format"] == "international"

    def denied(url, json, headers, timeout):
        return httpx.Response(403, json={"error": {"code": "invalid_api_key_error"}}, request=httpx.Request("POST", url))

    monkeypatch.setattr(tx.httpx, "post", denied)
    assert tx.call_sarvam("Diwali LED switch", "gu") is None

    def down(url, json, headers, timeout):
        raise httpx.ConnectTimeout("slow")

    monkeypatch.setattr(tx.httpx, "post", down)
    assert tx.call_sarvam("Diwali LED switch", "gu") is None
    assert tx.call_sarvam("x" * 1001, "gu") is None  # over Mayura's limit: not sent


# --- names, the console and the sources table ----------------------------------------------

NAMES = {("gu", "Shanti Apartments"): "શાંતિ એપાર્ટમેન્ટ્સ", ("gu", "Asha"): "આશા", ("hi", "Shanti Apartments"): "शांति अपार्टमेंट्स"}


@pytest.fixture()
def names(monkeypatch, sarvam):
    monkeypatch.setattr(tx, "call_sarvam_name", lambda text, locale, **_: NAMES.get((locale, text)))


def test_names_are_written_in_the_readers_script_once_cached(client, names):
    chair = register(client, email="asha@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=chair)
    client.post("/api/societies", json={"name": "Shanti Apartments"}, headers=chair)
    first = client.get("/api/societies/mine", headers={**chair, **GU}).json()
    assert first["name"] == "Shanti Apartments"  # not cached yet: shown as typed, written behind
    again = client.get("/api/societies/mine", headers={**chair, **GU}).json()
    assert again["name"] == "શાંતિ એપાર્ટમેન્ટ્સ"
    assert [m["first_name"] for m in again["members"]] == ["આશા"]
    assert client.get("/api/societies/mine", headers=chair).json()["name"] == "Shanti Apartments"


def test_a_transliteration_that_invents_an_initial_is_kept_out(monkeypatch):
    monkeypatch.setattr(get_settings(), "sarvam_api_key", "test-key")

    def reply(url, json, headers, timeout):
        return httpx.Response(200, json={"transliterated_text": "જે. એલ. ડી. કોલેજ"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(tx.httpx, "post", reply)
    assert tx.call_sarvam_name("L.D. College", "gu") is None


def test_the_console_feed_is_in_the_readers_language(client, admin_headers, names):
    ravi = register(client, email="ravi@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=ravi)
    client.post("/api/actions", data={"action_code": "led_switch"}, headers=ravi)
    client.get("/api/admin/activity", headers={**admin_headers, **GU})  # names are written behind
    feed = client.get("/api/admin/activity", headers={**admin_headers, **GU}).json()
    act = next(e for e in feed if e["kind"] == "action")
    assert act["first_name"] == "આશા"  # the test helper names everyone Asha
    assert any("઀" <= ch <= "૿" for ch in act["action_title"])
    assert any("઀" <= ch <= "૿" for ch in act["district"])
    en = next(e for e in client.get("/api/admin/activity", headers=admin_headers).json() if e["kind"] == "action")
    assert en["action_title"] == "Replaced a bulb with LED" and en["first_name"] == "Asha"


def test_the_sources_table_is_translated_for_gujarati_readers(client, monkeypatch, sarvam):
    from app.services import factors

    topic = factors.SOURCES[0]["topic"]
    FAKE[("gu", topic)] = "ગ્રીડ ઉત્સર્જન પરિબળ"
    client.get("/api/config", headers=GU)
    rows = client.get("/api/config", headers=GU).json()["sources"]
    assert rows[0]["topic"] == "ગ્રીડ ઉત્સર્જન પરિબળ"
    assert client.get("/api/config").json()["sources"][0]["topic"] == topic


def test_leading_initials_are_spelt_out_and_the_rest_transliterated(monkeypatch):
    monkeypatch.setattr(get_settings(), "sarvam_api_key", "test-key")
    sent = []

    def reply(url, json, headers, timeout):
        sent.append(json["input"])
        return httpx.Response(200, json={"transliterated_text": "એન્જિનિયરિંગ કોલેજ (ડેમો)"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(tx.httpx, "post", reply)
    assert tx.call_sarvam_name("L.D. Engineering College (Demo)", "gu") == "એલ. ડી. એન્જિનિયરિંગ કોલેજ (ડેમો)"
    assert sent == ["Engineering College (Demo)"]  # Sarvam never sees the initials it would mangle


def test_my_own_name_is_shown_in_my_script(client, names):
    me = register(client, email="asha2@example.com")
    client.get("/api/auth/me", headers={**me, **GU})
    assert client.get("/api/auth/me", headers={**me, **GU}).json()["name"] == "આશા"
    assert client.get("/api/auth/me", headers=me).json()["name"] == "Asha"

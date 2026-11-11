"""Issue #2: the Action Engine ranks what matters for this home now, and says why."""

from datetime import datetime

from app.services.engine import Candidate, EngineContext, rank
from app.services.impact import Impact
from app.timeutil import IST
from conftest import HOUSEHOLD, register


def cand(code, co2=1.0, rs=5.0, theme="energy", points=10, max_per_day=1, applicable=True, estimated=True, kwh=1.0):
    return Candidate(code=code, theme=theme, points=points, max_per_day=max_per_day,
                     impact=Impact(kwh=kwh, co2_kg=co2, applicable=applicable, estimated=estimated), rs=rs)


BASE = [cand("ac_24", co2=0.6, rs=7), cand("shift_heavy_load", co2=0.4, rs=0, kwh=0), cand("geyser_off", co2=0.6, rs=7),
        cand("standby_off", co2=0.2, rs=2), cand("millet_meal", co2=0, rs=0, estimated=False, theme="food")]


def at(hour):
    return datetime(2026, 11, 11, hour, 0, tzinfo=IST)


def order(ctx):
    return [c.code for c in rank(ctx)]


def test_hot_day_lifts_the_ac_and_says_why():
    cool = rank(EngineContext(now=at(13), candidates=BASE, temperature_c=22, days_since_done={c.code: 5 for c in BASE}))
    hot = rank(EngineContext(now=at(13), candidates=BASE, temperature_c=38, district="Surat",
                             days_since_done={c.code: 5 for c in BASE}))
    assert [c.code for c in hot][0] == "ac_24"
    assert [c.code for c in cool].index("ac_24") > 0
    assert any("38°C in Surat" in r for r in hot[0].reasons)


def test_evening_lifts_load_shifting_and_green_hours_more():
    seen = {c.code: 5 for c in BASE}
    noon = rank(EngineContext(now=at(12), candidates=BASE, days_since_done=seen))
    before_peak = rank(EngineContext(now=at(17), candidates=BASE, days_since_done=seen))
    sunny = rank(EngineContext(now=at(12), candidates=BASE, green_window=(11, 14), days_since_done=seen))
    score = lambda cards: next(c.score for c in cards if c.code == "shift_heavy_load")  # noqa: E731
    assert score(before_peak) > score(noon) and score(sunny) > score(before_peak)
    assert any("evening peak starts at 18:00" in r for c in before_peak if c.code == "shift_heavy_load" for r in c.reasons)


def test_recently_done_drops_and_maxed_out_or_inapplicable_disappear():
    fresh = order(EngineContext(now=at(13), candidates=BASE, days_since_done={c.code: 5 for c in BASE}))
    recent = order(EngineContext(now=at(13), candidates=BASE, days_since_done={**{c.code: 5 for c in BASE}, "ac_24": 0}))
    assert recent.index("ac_24") > fresh.index("ac_24")
    maxed = order(EngineContext(now=at(13), candidates=BASE, done_today={"geyser_off": 1}))
    assert "geyser_off" not in maxed
    cands = [*BASE, cand("cycle_walk", applicable=False)]
    assert "cycle_walk" not in order(EngineContext(now=at(13), candidates=cands))


def test_one_off_actions_rest_for_a_month():
    cands = [*BASE, cand("led_switch", co2=2, rs=20)]
    assert "led_switch" in order(EngineContext(now=at(13), candidates=cands, days_since_done={"led_switch": 40}))
    assert "led_switch" not in order(EngineContext(now=at(13), candidates=cands, days_since_done={"led_switch": 3}))


def test_challenge_and_points_only_are_honest():
    cards = rank(EngineContext(now=at(13), candidates=BASE, challenge_code="millet_meal"))
    millet = next(c for c in cards if c.code == "millet_meal")
    assert millet.is_challenge and millet.co2_kg == 0 and not millet.impact_estimated
    assert any("double points" in r for r in millet.reasons) and any("doesn't claim" in r for r in millet.reasons)
    assert sum(c.top for c in cards) == 3 and all(c.top for c in cards[:3])


def test_endpoint_returns_ranked_cards_with_reasons_for_this_home(client):
    h = register(client)
    assert client.get("/api/engine/today", headers=h).status_code == 409
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    body = client.get("/api/engine/today", headers=h).json()
    cards = body["cards"]
    assert len(cards) >= 10 and sum(c["top"] for c in cards) == 3
    assert all(c["reasons"] and c["title"] for c in cards)
    assert [c["score"] for c in cards] == sorted((c["score"] for c in cards), reverse=True)
    first = cards[0]["code"]
    client.post("/api/actions", data={"action_code": first}, headers=h)
    again = {c["code"]: c for c in client.get("/api/engine/today", headers=h).json()["cards"]}
    assert first not in again or again[first]["done_today"] == 1


def test_measured_everyday_savings_outrank_points_only_actions():
    cands = [cand("led_switch", co2=4.4, rs=54), cand("geyser_off", co2=0.57, rs=7), cand("ac_24", co2=1.6, rs=20),
             cand("public_transport", co2=0.87, rs=0, kwh=0), cand("cloth_bag", co2=0, rs=0, estimated=False, theme="plastic")]
    seen = {c.code: 5 for c in cands}
    ranked = order(EngineContext(now=at(13), candidates=cands, days_since_done=seen))
    assert ranked.index("cloth_bag") > ranked.index("geyser_off")
    assert ranked.index("cloth_bag") > ranked.index("public_transport")

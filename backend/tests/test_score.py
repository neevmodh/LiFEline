"""Issue #3: LiFE Score and "homes like yours" (Opower-style), with a privacy floor of 5."""

from app.services.score import compare, life_score
from conftest import HOUSEHOLD, register


def test_hand_computed_score():
    cmp_ = compare(my_kwh=200, baseline_kwh=300, district_peers=[300] * 5 + [100], state_peers=[])
    assert cmp_.scope == "district" and cmp_.typical_kwh == 300 and cmp_.group_size == 6
    s = life_score(cmp_, active_days_14=5, verified_30=2)
    # efficiency 50*(1.5-0.667)=41.65 -> 41.6 (ratio kept to 3 dp), consistency 30*0.5=15, verified 20*0.5=10
    assert (s.efficiency, s.consistency, s.verified, s.score) == (41.6, 15.0, 10.0, 67)


def test_peers_below_five_fall_back_to_state_then_own_baseline():
    assert compare(250, 300, [200] * 4, [220] * 5).scope == "state"
    own = compare(250, 300, [200] * 4, [220] * 4)
    assert own.scope == "own_baseline" and own.group_size == 0 and own.typical_kwh == 300 and own.efficient_kwh is None


def test_score_is_bounded():
    worst = life_score(compare(900, 300, [], []), 0, 0)
    best = life_score(compare(100, 300, [], []), 30, 30)
    assert worst.score == 0 and best.score == 100


def citizen(client, n, district_id=1, **hh):
    h = register(client, email=f"s{n}@example.com", district_id=district_id)
    client.put("/api/household", json={**HOUSEHOLD, **hh}, headers=h)
    return h


def test_endpoint_compares_with_similar_homes_only_from_five(client):
    me = citizen(client, 0, monthly_kwh=300)
    first = client.get("/api/me/score", headers=me).json()
    assert first["comparison"]["scope"] == "own_baseline"
    for i in range(1, 6):  # five similar homes in the same district
        citizen(client, i, monthly_kwh=200 + i * 10)
    citizen(client, 9, monthly_kwh=50, members=12)  # not similar: much bigger household
    body = client.get("/api/me/score", headers=me).json()
    c = body["comparison"]
    assert c["scope"] == "district" and c["group_size"] == 5 and c["typical_kwh"] == 230
    assert "similar homes" in c["summary"] and 0 <= body["score"] <= 100


def test_actions_raise_consistency(client):
    me = citizen(client, 0)
    before = client.get("/api/me/score", headers=me).json()
    client.post("/api/actions", data={"action_code": "millet_meal"}, headers=me)
    after = client.get("/api/me/score", headers=me).json()
    assert after["active_days_14"] == 1 and after["consistency"] > before["consistency"]

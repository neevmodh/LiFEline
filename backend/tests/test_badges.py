from datetime import date, timedelta

from app.services.badges import History, badges_for, longest_streak
from conftest import photo


def test_longest_streak_counts_consecutive_days_only():
    d = date(2026, 11, 1)
    assert longest_streak({d, d + timedelta(1), d + timedelta(2), d + timedelta(5)}) == 3
    assert longest_streak(set()) == 0


def test_badges_from_history():
    start = date(2026, 11, 1)
    h = History(
        counted_by_code={"shift_heavy_load": 5, "cycle_walk": 3},
        verified_by_code={},
        co2_avoided_kg=4.0,
        action_days={start + timedelta(i) for i in range(7)},
        bills=1,
    )
    b = {x.code: x for x in badges_for(h)}
    assert b["first_step"].earned and b["peak_shifter"].earned and b["week_streak"].earned
    assert not b["co2_10"].earned and b["co2_10"].progress == 0.4
    assert not b["verified"].earned and not b["tree_planter"].earned
    assert b["bill_tracker"].progress == 0.33


def test_badges_endpoint_follows_real_actions(client, citizen, admin_headers):
    before = {b["code"]: b for b in client.get("/api/badges", headers=citizen).json()}
    assert not before["first_step"]["earned"]
    log = client.post("/api/actions", data={"action_code": "plant_tree"},
                      files={"proof": ("t.png", photo(30), "image/png")}, headers=citizen).json()
    pending = {b["code"]: b for b in client.get("/api/badges", headers=citizen).json()}
    assert not pending["tree_planter"]["earned"]  # awaiting review doesn't count
    client.post(f"/api/admin/reviews/{log['id']}", json={"approve": True}, headers=admin_headers)
    after = {b["code"]: b for b in client.get("/api/badges", headers=citizen).json()}
    assert after["first_step"]["earned"] and after["verified"]["earned"] and after["tree_planter"]["earned"]

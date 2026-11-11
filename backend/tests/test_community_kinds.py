"""Community kinds: societies, colleges, schools, offices and wards take part alike."""

from conftest import HOUSEHOLD, register
from sqlalchemy import text

from app.db import SessionLocal
from app.routers.societies import MIN_GROUP_SIZE


def person(client, n):
    h = register(client, email=f"k{n}@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    return h


def community(client, n, name, kind=None):
    chair = person(client, n * 10)
    body = {"name": name} | ({"kind": kind} if kind else {})
    resp = client.post("/api/societies", json=body, headers=chair)
    assert resp.status_code == 201, resp.text
    s = resp.json()
    for i in range(1, MIN_GROUP_SIZE):
        client.post("/api/societies/join", json={"code": s["join_code"]}, headers=person(client, n * 10 + i))
    return chair, s


def test_kind_defaults_to_society_and_is_returned(client):
    chair, s = community(client, 1, "Shanti Apartments")
    assert s["kind"] == "society"
    assert client.get("/api/societies/mine", headers=chair).json()["kind"] == "society"


def test_create_a_college_and_join_returns_its_kind(client):
    _, s = community(client, 2, "LD Engineering College", kind="college")
    assert s["kind"] == "college"
    joined = client.post("/api/societies/join", json={"code": s["join_code"]}, headers=person(client, 99)).json()
    assert joined["kind"] == "college"


def test_invalid_kind_is_rejected(client):
    resp = client.post("/api/societies", json={"name": "Somewhere", "kind": "club"}, headers=person(client, 1))
    assert resp.status_code == 422


def test_leaderboard_filters_by_kind_within_the_district(client):
    chair, _ = community(client, 3, "Shanti Apartments")
    community(client, 4, "LD Engineering College", kind="college")
    every = client.get("/api/societies/leaderboard", headers=chair).json()
    assert {r["kind"] for r in every} == {"society", "college"}
    colleges = client.get("/api/societies/leaderboard?kind=college", headers=chair).json()
    assert [r["name"] for r in colleges] == ["LD Engineering College"]
    assert client.get("/api/societies/leaderboard?kind=club", headers=chair).status_code == 422


def test_rows_without_a_kind_read_as_society(client):
    """Societies created before the column existed migrate as 'society' (the column's server default)."""
    with SessionLocal() as db:
        db.execute(text("INSERT INTO societies (name, district_id, join_code, created_at) VALUES ('Old Society', 1, 'OLDCODE1', CURRENT_TIMESTAMP)"))
        kind = db.execute(text("SELECT kind FROM societies WHERE join_code = 'OLDCODE1'")).scalar()
    assert kind == "society"

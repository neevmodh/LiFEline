"""The demo seeder: creates communities of every kind, duels and a peak event, all tagged, and removes them cleanly."""

import sys
from pathlib import Path

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Campaign, Duel, Society, User

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import seed_demo  # noqa: E402

DISTRICTS = "Ahmedabad,Surat,Vadodara,Rajkot,Bhavnagar"


def run(monkeypatch, *args):
    monkeypatch.setenv("DEMO_PASSWORD", "demo-pass-123")
    monkeypatch.setattr(sys, "argv", ["seed_demo.py", "--in-process", "--districts", DISTRICTS, *args])
    assert seed_demo.main() == 0


def counts():
    with SessionLocal() as db:
        return {
            "users": db.scalar(select(func.count(User.id)).where(User.email.like("demo-nidhi-%"))),
            "communities": db.scalar(select(func.count(Society.id))),
            "kinds": set(db.scalars(select(Society.kind))),
            "duels": {d.status for d in db.scalars(select(Duel))},
            "peak": db.scalar(select(func.count(Campaign.id)).where(Campaign.kind == "peak")),
            "untagged": db.scalar(select(func.count(Society.id)).where(~Society.name.contains("ડેમો"))),
        }


def test_creates_everything_tagged_and_removes_it_cleanly(client, monkeypatch):
    run(monkeypatch, "--apply", "--peak-day", "2026-11-14")
    made = counts()
    assert made["users"] > 0 and made["untagged"] == 0
    assert made["kinds"] == {"society", "college", "school"}  # the five districts' communities
    assert made["duels"] == {"active", "pending"} and made["peak"] == 1
    with SessionLocal() as db:
        assert all("ડેમો" in u.name for u in db.scalars(select(User).where(User.email.like("demo-nidhi-%"))))
        assert db.scalar(select(Campaign.starts_on).where(Campaign.kind == "peak")).isoformat() == "2026-11-14"

    run(monkeypatch, "--remove")
    gone = counts()
    assert (gone["users"], gone["communities"], gone["duels"], gone["peak"]) == (0, 0, set(), 0)
